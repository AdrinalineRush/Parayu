# Parayu — Packaging a Professional DMG (macOS)

The **styled DMG background** (gradient + "Drag Parayu to Applications" + arrow)
is the part that breaks for everyone. This document is the exact, repeatable
recipe that works on macOS **Sonoma / Sequoia**, plus *why* the obvious
approaches fail.

---

## TL;DR — the only two commands you run

```bash
npm run dist                    # electron-builder: builds + signs the .app and a plain DMG
./seal-dmg-background.sh        # re-seals the DMG with a Finder-authored background
```

That's it. `dist/Parayu-0.1.0-arm64.dmg` now opens with the full styled layout.

> ⚠️ Do **NOT** run `build/fix-dmg-applescript.sh` (v1) or `build/fix-dmg-v2.sh`
> on Sequoia. v1's AppleScript path and v2's programmatic `.DS_Store` both
> produce a DMG where the **icons land correctly but the background is blank**.
> They are kept only for reference. Use `seal-dmg-background.sh`.

---

## Why this is hard (read this once)

A DMG's window appearance (background image, icon positions, window size) lives
in a hidden `.DS_Store` file on the disk image. To show a background, that file
must contain an `icvp` record whose `backgroundImageAlias` points at an image
inside the volume (e.g. `.background/background.tiff`).

**The trap:** on macOS 14/15, Finder **ignores a `backgroundImageAlias` that was
written programmatically** (by electron-builder's bundled `dmgbuild`, or by the
Python `ds_store`/`mac_alias` libraries). The icon *positions* from the same
`.DS_Store` are honored — so you get correctly-placed icons on a **plain black
window**, which looks like "it almost worked." It didn't.

What macOS *does* trust is a `.DS_Store` that **Finder itself wrote**. So the
only reliable method is: mount a writable DMG, ask Finder (via AppleScript) to
set the background picture and icon positions, let Finder save its own
`.DS_Store`, then re-compress the image. That's what `seal-dmg-background.sh`
does.

### Things that DON'T work on Sequoia (don't waste time)
| Approach | Symptom |
|---|---|
| `electron-builder` `dmg.background` alone | icons placed, **background blank** |
| Python `ds_store` + `mac_alias` (`fix-dmg-v2.sh`) | icons placed, **background blank** |
| `tiffutil` PNG vs TIFF — either format | no difference; the *alias* is what's ignored |
| `fix-dmg-applescript.sh` (v1) | fails with Finder error **-1728** (timing/volume-name) |

### The one thing that DOES work
Finder authors the `.DS_Store` while the writable DMG is mounted, **after** the
background file is already in `.background/`. Then convert back to compressed
read-only. (`seal-dmg-background.sh`.)

---

## Prerequisites (already set up in this repo)

1. **Background art** — `build/dmg-background.png` (540×540) and
   `build/dmg-background@2x.png` (1080×1080).
   Regenerate from the SVG if the art changes:
   ```bash
   ./build/make-dmg-bg.sh        # rasterizes build/dmg-bg.svg -> the two PNGs
   ```
   The SVG draws the gradient, the title text, the two drop-frames, and the
   arrow. **The empty frames in the art sit where the icons get placed.**

2. **`package.json` → `build.dmg`** must match the art:
   ```jsonc
   "dmg": {
     "title": "Parayu Setup",
     "background": "build/dmg-background.png",
     "iconSize": 128,
     "contents": [
       { "x": 130, "y": 270, "type": "file" },   // Parayu.app  -> left frame
       { "x": 410, "y": 270, "type": "link", "path": "/Applications" } // right frame
     ],
     "window": { "width": 540, "height": 540 }
   }
   ```
   If you move the frames in the SVG, update these coordinates **and** the
   positions inside `seal-dmg-background.sh` (they must agree: `130,270` and
   `410,270` in a 540×540 window).

---

## What `seal-dmg-background.sh` actually does

1. `hdiutil convert … -format UDRW` → a **writable** copy of the DMG.
2. `hdiutil resize -size 300m` → headroom so Finder can write freely.
3. `hdiutil attach` → mount it; capture the **real** `/Volumes/...` name.
4. Copy a **hi-DPI** background into the volume:
   `tiffutil -cathidpicheck dmg-background.png dmg-background@2x.png -out .background/background.tiff`
5. **Drive Finder via AppleScript** to: set icon view, hide toolbar/statusbar,
   set window bounds, set `background picture` to the tiff, place
   `Parayu.app` at `{130,270}` and `Applications` at `{410,270}`, then `update`
   and `close`. → Finder writes a `.DS_Store` macOS will honor.
6. `hdiutil detach` → unmount.
7. `hdiutil convert … -format UDZO -imagekey zlib-level=9` → final compressed,
   read-only DMG (overwrites `dist/Parayu-0.1.0-arm64.dmg`).

If a **"Terminal/osascript wants to control Finder"** prompt appears, **click
OK** — Finder automation permission is required for step 5.

---

## Gotchas that "destroy" the DMG (and the fix)

- **Plain background after building?** Finder is showing a *cached* window for a
  previously-mounted "Parayu Setup" volume. Fix:
  ```bash
  hdiutil detach "/Volumes/Parayu Setup" -force
  killall Finder
  hdiutil attach dist/Parayu-0.1.0-arm64.dmg
  open "/Volumes/Parayu Setup"
  ```
  But note: if it's *still* plain after a Finder restart, the `.DS_Store` is
  programmatic → you skipped `seal-dmg-background.sh`. Re-run it.

- **Eject every "Parayu Setup" volume before `npm run dist` or sealing.** A
  mounted copy locks the name and the seal script can mount it as
  "Parayu Setup 1", breaking the AppleScript target.

- **`hdiutil … -nobrowse is deprecated` warning** — harmless, ignore.

- **Don't double-apply.** Run `seal-dmg-background.sh` exactly **once** after
  each `npm run dist`. Running `npm run dist` again throws away the sealed
  `.DS_Store`, so you must re-seal.

- **Verify the background file resolves** (sanity check the sealed DMG):
  ```bash
  hdiutil attach dist/Parayu-0.1.0-arm64.dmg
  ls "/Volumes/Parayu Setup/.background/"   # must contain background.tiff
  ```

---

## Replacing the logo / icons (all assets from one source)

Drop a square master (≥1024×1024, transparent) and regenerate everything:

```bash
# Color app icon → icns/ico/png + in-app sidebar logo
python3 - "/path/to/Final Logo.png" <<'PY'
from PIL import Image; import os, sys
img = Image.open(sys.argv[1]).convert("RGBA")
rs = lambda n: img.resize((n,n), Image.LANCZOS)
os.makedirs("build/icon.iconset", exist_ok=True)
rs(1024).save("build/icon.png")
for nm,n in {"icon_16x16.png":16,"icon_16x16@2x.png":32,"icon_32x32.png":32,
 "icon_32x32@2x.png":64,"icon_128x128.png":128,"icon_128x128@2x.png":256,
 "icon_256x256.png":256,"icon_256x256@2x.png":512,"icon_512x512.png":512,
 "icon_512x512@2x.png":1024}.items(): rs(n).save("build/icon.iconset/"+nm)
rs(256).save("build/icon.ico", sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
rs(512).save("src/renderer/logo.png")
PY
iconutil -c icns build/icon.iconset -o build/icon.icns && rm -rf build/icon.iconset
```

**Menu-bar (tray) icon** is separate — it's a white-on-transparent logo:
```bash
python3 build/make-tray-icon.py     # if using the drawn waveform, OR
# generate from a white logo file → src/renderer/tray-icon.png (1x) + tray-icon@2x.png
```
`src/main.js` loads `tray-icon.png` (+ `@2x`). It does **NOT** call
`setTemplateImage(true)` — template mode dims the icon to the system glyph
color; leaving it off renders full-bright white (only downside: invisible on a
*light* menu bar).

After any icon change: `npm run dist && ./seal-dmg-background.sh`.

---

## Installing the freshly built app over an old one

The DMG/app you build does **not** update an already-installed
`/Applications/Parayu.app`. To run the new build, drag Parayu from the DMG into
Applications (replace), or:
```bash
pkill -f "/Applications/Parayu.app"
rm -rf "/Applications/Parayu.app"
cp -R "dist/mac-arm64/Parayu.app" "/Applications/Parayu.app"
open "/Applications/Parayu.app"
```

---

## Distribution checklist (for OTHER people's Macs)

The current build is **dev-signed, not notarized**, so other users hit
Gatekeeper. For real distribution:
1. Get a **"Developer ID Application"** certificate (not "Apple Development").
2. Export env before building:
   ```bash
   export APPLE_ID="you@example.com"
   export APPLE_ID_PASSWORD="app-specific-password"
   export APPLE_TEAM_ID="XXXXXXXXXX"
   npm run dist && ./seal-dmg-background.sh
   ```
   `build/afterSign.js` notarizes automatically when those three are set.
3. (Optional) `xcrun stapler staple dist/Parayu-0.1.0-arm64.dmg`.
