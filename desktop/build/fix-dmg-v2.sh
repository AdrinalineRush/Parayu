#!/bin/bash
# fix-dmg-v2.sh — Uses Python DS_Store writer + careful alias creation
# AppleScript doesn't work on macOS Sequoia, so we write .DS_Store directly

set -e

DMG_PATH="dist/Parayu-0.1.0-arm64.dmg"
VOLUME_NAME="Parayu Setup"
export VOLUME_PATH="/Volumes/${VOLUME_NAME}"
WRITABLE_DMG="/tmp/parayu_rw.dmg"
BG_1X="build/dmg-background.png"
BG_2X="build/dmg-background@2x.png"
VENDOR="node_modules/dmg-builder/vendor"
export VENDOR_PATH="${PWD}/${VENDOR}"

echo "==> Step 1: Converting DMG to read-write..."
rm -f "${WRITABLE_DMG}"
hdiutil convert "${DMG_PATH}" -format UDRW -o "${WRITABLE_DMG}" -quiet

echo "==> Step 2: Expanding DMG..."
hdiutil resize -size 300m "${WRITABLE_DMG}" -quiet 2>/dev/null || true

echo "==> Step 3: Mounting writable DMG..."
hdiutil detach "${VOLUME_PATH}" 2>/dev/null || true
sleep 1
hdiutil attach "${WRITABLE_DMG}" -readwrite -noverify -quiet
sleep 2

echo "==> Step 4: Copying background image..."
mkdir -p "${VOLUME_PATH}/.background"
cp "${BG_2X}" "${VOLUME_PATH}/.background/background.png"
echo "    Background PNG copied"

echo "==> Step 5: Writing .DS_Store directly with Python..."
python3 << 'PYTHON_SCRIPT'
import sys, os

sys.path.insert(0, os.environ.get("VENDOR_PATH"))

import biplist
from mac_alias import Alias, Bookmark
from ds_store import DSStore

volume_path = os.environ["VOLUME_PATH"]
bg_file = os.path.join(volume_path, ".background", "background.png")

print(f"  Volume: {volume_path}")
print(f"  Background: {bg_file}")
print(f"  Background exists: {os.path.exists(bg_file)}")

# Create alias and bookmark for the background file
alias = Alias.for_file(bg_file)
bookmark = Bookmark.for_file(bg_file)

ds_store_path = os.path.join(volume_path, ".DS_Store")

# Remove existing .DS_Store
if os.path.exists(ds_store_path):
    os.remove(ds_store_path)
    print("  Removed old .DS_Store")

# Window settings
bwsp = {
    'ShowStatusBar': False,
    'ContainerShowSidebar': False,
    'PreviewPaneVisibility': False,
    'SidebarWidth': 180,
    'ShowTabView': False,
    'ShowToolbar': False,
    'ShowPathbar': False,
    'ShowSidebar': False,
    'WindowBounds': '{{400, 200}, {540, 540}}'
}

# Icon view settings with background image
icvp = {
    'viewOptionsVersion': 1,
    'backgroundType': 2,
    'backgroundColorRed': 1.0,
    'backgroundColorGreen': 1.0,
    'backgroundColorBlue': 1.0,
    'backgroundImageAlias': biplist.Data(alias.to_bytes()),
    'gridOffsetX': 0.0,
    'gridOffsetY': 0.0,
    'gridSpacing': 100.0,
    'arrangeBy': 'none',
    'showIconPreview': False,
    'showItemInfo': False,
    'labelOnBottom': True,
    'textSize': 12.0,
    'iconSize': 128.0,
    'scrollPositionX': 0.0,
    'scrollPositionY': 0.0
}

with DSStore.open(ds_store_path, 'w+') as d:
    d['.']['vSrn'] = ('long', 1)
    d['.']['bwsp'] = bwsp
    d['.']['icvp'] = icvp
    d['.']['pBBk'] = bookmark
    d['.']['icvl'] = (b'type', b'icnv')

    # Position main items — centered on the drop-frames drawn in the background
    d['Parayu.app']['Iloc'] = (130, 270)
    d['Applications']['Iloc'] = (410, 270)

    # Position hidden items inside viewport bounds
    d['.background']['Iloc'] = (140, 500)
    d['.DS_Store']['Iloc'] = (140, 500)
    d['.fseventsd']['Iloc'] = (140, 500)
    d['.Trashes']['Iloc'] = (140, 500)
    d['.VolumeIcon.icns']['Iloc'] = (140, 500)

print("  .DS_Store written successfully")

# Verify
with DSStore.open(ds_store_path, 'r') as d:
    for entry in d:
        if entry.code == b'icvp':
            print(f"  backgroundType: {entry.value.get('backgroundType')}")
        elif entry.code == b'Iloc':
            print(f"  {entry.filename}: Iloc = {entry.value}")

PYTHON_SCRIPT

echo "==> Step 6: Syncing filesystem..."
sync
sleep 2

echo "==> Step 7: Unmounting..."
hdiutil detach "${VOLUME_PATH}" -quiet
sleep 2

echo "==> Step 8: Converting to compressed read-only..."
rm -f "${DMG_PATH}"
hdiutil convert "${WRITABLE_DMG}" -format UDZO -imagekey zlib-level=9 -o "${DMG_PATH}" -quiet

echo "==> Step 9: Cleanup..."
rm -f "${WRITABLE_DMG}"

echo ""
echo "✅ Premium DMG created: ${DMG_PATH}"
ls -lh "${DMG_PATH}"
