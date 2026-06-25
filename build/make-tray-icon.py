#!/usr/bin/env python3
"""
Generates the macOS menu-bar (tray) icon for Parayu: a clean white waveform mark
echoing the app logo (left "headphone" hump, a dip, then a tall right peak).

Rendered as a black-on-transparent template at high resolution, then downsampled
to the 18pt (1x) and 36px (2x) sizes Electron's Tray expects. main.js calls
setTemplateImage(true), so macOS recolours it to crisp white in a dark menu bar
(and dark in a light menu bar) — matching the weight/brightness of system icons.
"""
from PIL import Image, ImageDraw

# Design in 18-pt units, rendered at 20x for clean anti-aliased downscaling.
UNIT = 18
SCALE = 20
S = UNIT * SCALE  # 360px master

# Bar heights (in 18-pt units) trace the actual Parayu logo waveform: a broad
# rounded "headphone" hump on the left, a low ripple through the middle, then a
# tall sharp peak on the right. 13 bars keeps that silhouette readable at the
# menu-bar's tiny size (the logo's ~40 hair-thin bars would smear together).
HEIGHTS = [2.2, 5.9, 10.1, 12.9, 10.9, 5.9, 3.1, 2.8, 4.8, 9.2, 14.0, 9.2, 4.2]
BAR_W = 0.85          # thin bars like the logo, but thick enough to read at 18px
GAP = 0.40
CY = UNIT / 2.0       # vertical centre

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

n = len(HEIGHTS)
total_w = n * BAR_W + (n - 1) * GAP
x = (UNIT - total_w) / 2.0
for h in HEIGHTS:
    x0 = x * SCALE
    x1 = (x + BAR_W) * SCALE
    y0 = (CY - h / 2.0) * SCALE
    y1 = (CY + h / 2.0) * SCALE
    r = (BAR_W * SCALE) / 2.0  # pill caps
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=(0, 0, 0, 255))
    x += BAR_W + GAP

# Downsample to the two sizes Electron needs.
out_1x = img.resize((18, 18), Image.LANCZOS)
out_2x = img.resize((36, 36), Image.LANCZOS)
out_1x.save("src/renderer/tray-icon.png")
out_2x.save("src/renderer/tray-icon@2x.png")

# A larger white-on-dark preview so the shape can be eyeballed.
preview = Image.new("RGBA", (144, 144), (20, 22, 30, 255))
white = Image.new("RGBA", (S, S), (0, 0, 0, 0))
wd = ImageDraw.Draw(white)
x = (UNIT - total_w) / 2.0
for h in HEIGHTS:
    wd.rounded_rectangle(
        [x * SCALE, (CY - h / 2.0) * SCALE, (x + BAR_W) * SCALE, (CY + h / 2.0) * SCALE],
        radius=(BAR_W * SCALE) / 2.0, fill=(255, 255, 255, 255))
    x += BAR_W + GAP
preview.alpha_composite(white.resize((144, 144), Image.LANCZOS))
preview.save("build/tray-icon-preview.png")

print("Wrote src/renderer/tray-icon.png (18), tray-icon@2x.png (36), build/tray-icon-preview.png")
