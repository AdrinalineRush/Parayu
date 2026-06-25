#!/bin/bash
# seal-dmg-background.sh — applies the styled DMG background the ONLY way that
# renders on macOS Sonoma/Sequoia: by letting Finder itself author the .DS_Store.
#
# Programmatic backgrounds (electron-builder's alias, ds_store/mac_alias, etc.)
# position the icons correctly but Sequoia's Finder ignores the background-image
# alias, so the window shows up plain. A background Finder writes always renders.
#
# Run AFTER `npm run dist`:  ./seal-dmg-background.sh
set -e

# Find the DMG dynamically to handle version/architecture changes
DMG=$(ls dist/Parayu-*.dmg 2>/dev/null | head -n 1)
if [ -z "$DMG" ]; then
  echo "❌ No DMG found in dist/ directory. Please run 'npm run dist' first."
  exit 1
fi

RW="/tmp/parayu_rw.dmg"

# Eject any existing mounted volumes of the same name to avoid collisions
for v in "/Volumes/Parayu Setup" "/Volumes/Parayu Setup 1"; do
  [ -d "$v" ] && hdiutil detach "$v" -force >/dev/null 2>&1 || true
done
rm -f "$RW"

echo "==> convert to read-write"
hdiutil convert "$DMG" -format UDRW -o "$RW" -quiet
hdiutil resize -size 300m "$RW" -quiet 2>/dev/null || true

echo "==> attach"
# -nobrowse keeps the volume hidden in Finder's sidebar, avoiding popups
ATTACH_OUT=$(hdiutil attach "$RW" -readwrite -noverify -nobrowse)
VOL=$(echo "$ATTACH_OUT" | grep -o '/Volumes/.*' | head -1)
VOLNAME=$(basename "$VOL")
sleep 2

echo "==> copy hidpi background tiff"
mkdir -p "$VOL/.background"
tiffutil -cathidpicheck build/dmg-background.png build/dmg-background@2x.png \
  -out "$VOL/.background/background.tiff" >/dev/null

echo "==> let Finder author the layout ($VOLNAME)"
osascript <<APPLESCRIPT
tell application "Finder"
    tell disk "$VOLNAME"
        open
        delay 2
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {300, 200, 840, 740}
        set vo to the icon view options of container window
        set arrangement of vo to not arranged
        set icon size of vo to 128
        set text size of vo to 12
        set background picture of vo to file ".background:background.tiff"
        set position of item "Parayu.app" of container window to {130, 270}
        set position of item "Applications" of container window to {410, 270}
        update without registering applications
        delay 2
        close
    end tell
end tell
APPLESCRIPT

echo "==> seal back to compressed read-only"
sync; sleep 1
hdiutil detach "$VOL" -force -quiet 2>/dev/null || true
sleep 2
rm -f "$DMG"
hdiutil convert "$RW" -format UDZO -imagekey zlib-level=9 -o "$DMG" -quiet
rm -f "$RW"

echo "✅ Styled DMG sealed: $DMG"
ls -lh "$DMG" | awk '{print $5, $NF}'
