#!/bin/bash
# Renders the DMG background SVG to the exact 1x (540) and 2x (1080) PNGs.
set -e
cd "$(dirname "$0")/.."

npx electron build/make-dmg-bg.js

if [ ! -s build/dmg-bg.raw.png ]; then
  echo "render failed: build/dmg-bg.raw.png missing/empty" >&2
  exit 1
fi

# Force exact output dimensions (source is rendered larger, so this downsamples cleanly).
cp build/dmg-bg.raw.png build/dmg-background@2x.png
sips --resampleHeightWidth 1080 1080 build/dmg-background@2x.png >/dev/null

cp build/dmg-bg.raw.png build/dmg-background.png
sips --resampleHeightWidth 540 540 build/dmg-background.png >/dev/null

rm -f build/dmg-bg.raw.png
echo "Wrote build/dmg-background.png (540) and build/dmg-background@2x.png (1080)"
