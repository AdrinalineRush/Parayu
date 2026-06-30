#!/usr/bin/env bash
# seal-dmg-background.sh — Re-seals a Parayu DMG with a Finder-authored
# background image so macOS Sonoma/Sequoia renders it correctly.
#
# Usage:
#   ./seal-dmg-background.sh                          # seals dist/Parayu-superdev-*.dmg
#   ./seal-dmg-background.sh dist/Parayu-dev-0.1.0.dmg   # seals a specific DMG
#
# Prerequisites:
#   - build/dmg-background.png (540×540 1x)
#   - build/dmg-background@2x.png (1080×1080 2x)
#   - macOS with Finder automation permission for Terminal/osascript

set -euo pipefail

# ---- Resolve the DMG to seal ----
if [[ $# -ge 1 ]]; then
  DMG="$1"
else
  # Auto-detect: prefer superdev, fall back to dev
  DMG=$(ls -t dist/Parayu-superdev-*.dmg 2>/dev/null | head -1)
  [[ -z "$DMG" ]] && DMG=$(ls -t dist/Parayu-dev-*.dmg 2>/dev/null | head -1)
  [[ -z "$DMG" ]] && DMG=$(ls -t dist/Parayu-*.dmg 2>/dev/null | head -1)
fi

if [[ -z "$DMG" || ! -f "$DMG" ]]; then
  echo "❌ No DMG found. Run 'npm run dist' first, or pass a path as argument."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BG_1X="$SCRIPT_DIR/build/dmg-background.png"
BG_2X="$SCRIPT_DIR/build/dmg-background@2x.png"

if [[ ! -f "$BG_1X" ]]; then
  echo "❌ Missing build/dmg-background.png"
  exit 1
fi
if [[ ! -f "$BG_2X" ]]; then
  echo "⚠️  Missing build/dmg-background@2x.png — using 1x only"
  BG_2X=""
fi

echo "🔧 Sealing DMG: $DMG"

# ---- Detect the app name inside the DMG ----
PROBE_OUT=$(hdiutil attach "$DMG" -readonly -noverify -nobrowse 2>&1 || true)
PROBE_VOL=$(echo "$PROBE_OUT" | grep '/Volumes/' | sed 's|.*\(/Volumes/.*\)|\1|' | head -1 | xargs)

if [[ -z "$PROBE_VOL" || ! -d "$PROBE_VOL" ]]; then
  echo "❌ Could not mount DMG to probe contents."
  echo "$PROBE_OUT"
  exit 1
fi

APP_NAME=$(ls "$PROBE_VOL" | grep '\.app$' | head -1)
VOL_NAME=$(basename "$PROBE_VOL")

if [[ -z "$APP_NAME" ]]; then
  echo "❌ No .app found inside the DMG volume."
  hdiutil detach "$PROBE_VOL" -force 2>/dev/null || true
  exit 1
fi

echo "   App: $APP_NAME"
echo "   Volume: $VOL_NAME"

# Detach the probe mount
hdiutil detach "$PROBE_VOL" -force 2>/dev/null || true
sleep 1

# ---- Phase 2: Re-seal with Finder-authored .DS_Store ----

# 1. Eject ALL volumes with the same name
for vol in /Volumes/"$VOL_NAME"*; do
  [[ -d "$vol" ]] && hdiutil detach "$vol" -force 2>/dev/null || true
done
sleep 1

RW_DMG="/tmp/parayu-rw-$$.dmg"

# 2. Convert to read-write
echo "   Converting to read-write…"
hdiutil convert "$DMG" -format UDRW -o "$RW_DMG" -quiet

# 3. Resize to add headroom
hdiutil resize -size 8g "$RW_DMG" 2>/dev/null || true

# 4. Mount read-write
echo "   Mounting read-write…"
ATTACH_OUT=$(hdiutil attach "$RW_DMG" -readwrite -noverify -nobrowse 2>&1)
VOL_PATH=$(echo "$ATTACH_OUT" | grep '/Volumes/' | sed 's|.*\(/Volumes/.*\)|\1|' | head -1 | xargs)

if [[ -z "$VOL_PATH" || ! -d "$VOL_PATH" ]]; then
  echo "❌ Could not mount read-write DMG."
  echo "$ATTACH_OUT"
  rm -f "$RW_DMG"
  exit 1
fi

echo "   Mounted at: $VOL_PATH"

# 5. Create .background and build HiDPI TIFF
echo "   Installing background image…"
mkdir -p "$VOL_PATH/.background"

if [[ -n "$BG_2X" ]]; then
  tiffutil -cathidpicheck "$BG_1X" "$BG_2X" -out "$VOL_PATH/.background/background.tiff" 2>/dev/null
else
  sips -s format tiff "$BG_1X" --out "$VOL_PATH/.background/background.tiff" >/dev/null 2>&1
fi

# 6. Drive Finder via AppleScript to author the .DS_Store
echo "   Configuring Finder window layout…"

APP_ESCAPED=$(echo "$APP_NAME" | sed 's/"/\\\\"/g')
RW_VOL_NAME=$(basename "$VOL_PATH")

osascript <<APPLESCRIPT
tell application "Finder"
    tell disk "$RW_VOL_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {300, 200, 840, 740}
        set theViewOptions to icon view options of container window
        set arrangement of theViewOptions to not arranged
        set icon size of theViewOptions to 128
        set background picture of theViewOptions to file ".background:background.tiff"
        set position of item "$APP_ESCAPED" to {130, 270}
        set position of item "Applications" to {410, 270}
        close
        open
        update without registering applications
        delay 2
        close
    end tell
end tell
APPLESCRIPT

echo "   Finder layout applied."

# 7. Sync and detach
sync
sleep 2
hdiutil detach "$VOL_PATH" -force 2>/dev/null || true
sleep 1

# 8. Convert back to compressed read-only
echo "   Compressing final DMG…"
rm -f "$DMG"
hdiutil convert "$RW_DMG" -format UDZO -imagekey zlib-level=9 -o "$DMG" -quiet
rm -f "$RW_DMG"

FINAL_SIZE=$(du -h "$DMG" | cut -f1 | xargs)
echo ""
echo "✅ Sealed DMG ready: $DMG ($FINAL_SIZE)"
echo "   Verify: open \"$DMG\" and confirm the background + icon positions render."
