#!/bin/bash
# fix-dmg-applescript.sh — Uses AppleScript via Finder to set background and layout.
# This ensures Finder compiles a native, fully compatible .DS_Store.

set -e

DMG_PATH="dist/Parayu-0.1.0-arm64.dmg"
VOLUME_NAME="Parayu Setup"
export VOLUME_PATH="/Volumes/${VOLUME_NAME}"
WRITABLE_DMG="/tmp/parayu_rw.dmg"
BG_1X="build/dmg-background.png"
BG_2X="build/dmg-background@2x.png"

echo "==> Step 1: Converting DMG to read-write..."
rm -f "${WRITABLE_DMG}"
hdiutil convert "${DMG_PATH}" -format UDRW -o "${WRITABLE_DMG}" -quiet

echo "==> Step 2: Expanding DMG..."
hdiutil resize -size 300m "${WRITABLE_DMG}" -quiet 2>/dev/null || true

echo "==> Step 3: Mounting writable DMG..."
hdiutil detach "${VOLUME_PATH}" 2>/dev/null || true
sleep 1
# Attach WITHOUT -noautoopen so Finder can open it for AppleScript
hdiutil attach "${WRITABLE_DMG}" -readwrite -noverify -quiet
sleep 3

echo "==> Step 4: Copying background image..."
mkdir -p "${VOLUME_PATH}/.background"
tiffutil -cathidpicheck "${BG_1X}" "${BG_2X}" -out "${VOLUME_PATH}/.background/background.tiff"
echo "    Background TIFF created"

# Also clean up any background.png to avoid conflicts
rm -f "${VOLUME_PATH}/.background/background.png"

echo "==> Step 5: Applying Finder layout via AppleScript..."
osascript <<'APPLESCRIPT'
tell application "Finder"
    tell disk "Parayu Setup"
        open
        delay 3
        
        try
            set current view of container window to icon view
        on error errMsg
            log "view: " & errMsg
        end try
        
        try
            set toolbar visible of container window to false
        on error errMsg
            log "toolbar: " & errMsg
        end try
        
        try
            set statusbar visible of container window to false
        on error errMsg
            log "statusbar: " & errMsg
        end try
        
        try
            -- Bounds are {left, top, right, bottom} -> 540x540 window
            set the bounds of container window to {400, 200, 940, 740}
        on error errMsg
            log "bounds: " & errMsg
        end try
        
        try
            set theViewOptions to the icon view options of container window
            set arrangement of theViewOptions to not arranged
            set icon size of theViewOptions to 128
            set text size of theViewOptions to 12
            set background picture of theViewOptions to file ".background:background.tiff"
        on error errMsg
            log "viewOptions: " & errMsg
        end try
        
        try
            set position of item "Parayu.app" of container window to {130, 270}
        on error errMsg
            log "pos1: " & errMsg
        end try
        
        try
            set position of item "Applications" of container window to {410, 270}
        on error errMsg
            log "pos2: " & errMsg
        end try
        
        -- Place hidden folder and files out of bounds
        try
            set position of item ".background" of container window to {140, 500}
            set position of item ".DS_Store" of container window to {140, 500}
        on error errMsg
            -- ignore hidden files positioning errors
        end try
        
        close
        delay 1
        open
        delay 3
        
        try
            update without registering applications
        on error errMsg
            log "update: " & errMsg
        end try
        
        delay 3
        close
    end tell
end tell
APPLESCRIPT

echo "==> Step 6: Syncing filesystem..."
sync
sleep 3
sync

echo "==> Step 7: Unmounting..."
hdiutil detach "${VOLUME_PATH}" -quiet
sleep 2

echo "==> Step 8: Converting back to compressed read-only..."
rm -f "${DMG_PATH}"
hdiutil convert "${WRITABLE_DMG}" -format UDZO -imagekey zlib-level=9 -o "${DMG_PATH}" -quiet

echo "==> Step 9: Cleanup..."
rm -f "${WRITABLE_DMG}"

echo ""
echo "✅ Premium DMG created: ${DMG_PATH}"
ls -lh "${DMG_PATH}"

# Auto-upload to Google Drive if credentials or token exists
if [ -f "build/credentials.json" ] || [ -f "build/token.json" ]; then
  echo ""
  echo "==> Step 10: Auto-uploading to Google Drive..."
  python3 build/upload-dmg.py
fi
