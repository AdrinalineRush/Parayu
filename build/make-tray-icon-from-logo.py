#!/usr/bin/env python3
import os
import sys
from PIL import Image

def main():
    logo_path = "/Users/workmode/Desktop/Final Logo.png"
    if not os.path.exists(logo_path):
        print(f"Error: Logo file not found at {logo_path}")
        sys.exit(1)

    print(f"Loading logo from: {logo_path}")
    img = Image.open(logo_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()

    # Step 1: Threshold by luminance and alpha to get binary mask
    binary = []
    for y in range(height):
        row = []
        for x in range(width):
            r, g, b, a = pixels[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            row.append(1 if (lum >= 40 and a > 0) else 0)
        binary.append(row)

    # Step 2: Connected component analysis
    visited = [[False]*width for _ in range(height)]
    components = []
    for y in range(height):
        for x in range(width):
            if binary[y][x] == 1 and not visited[y][x]:
                comp = []
                queue = [(x, y)]
                visited[y][x] = True
                while queue:
                    cx, cy = queue.pop(0)
                    comp.append((cx, cy))
                    for dx, dy in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < width and 0 <= ny < height:
                            if binary[ny][nx] == 1 and not visited[ny][nx]:
                                visited[ny][nx] = True
                                queue.append((nx, ny))
                components.append(comp)

    # Step 3: Filter components belonging to the waveform
    waveform_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    waveform_pixels = waveform_img.load()

    kept_count = 0
    for comp in components:
        ys = [p[1] for p in comp]
        if 100 < len(comp) < 30000 and min(ys) > 150 and max(ys) < 900:
            kept_count += 1
            for px, py in comp:
                waveform_pixels[px, py] = (255, 255, 255, 255)

    print(f"Isolated {kept_count} components belonging to the waveform.")

    bbox = waveform_img.getbbox()
    if not bbox:
        print("Error: Could not isolate any waveform components!")
        sys.exit(1)

    cropped = waveform_img.crop(bbox)
    w, h = cropped.size
    print(f"Cropped waveform size: {w}x{h} (aspect ratio: {w/h:.3f})")

    # Step 4: Stretch height by 1.25x to make it taller and more prominent in the menu bar
    stretched = cropped.resize((w, int(h * 1.25)), Image.Resampling.LANCZOS)
    sw, sh = stretched.size
    print(f"Stretched waveform size: {sw}x{sh} (aspect ratio: {sw/sh:.3f})")

    # Step 5: Center in a square canvas with 94% fill ratio (less padding to make it larger)
    fill_ratio = 0.94
    canvas_size = int(sw / fill_ratio)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    paste_x = (canvas_size - sw) // 2
    paste_y = (canvas_size - sh) // 2
    canvas.paste(stretched, (paste_x, paste_y))

    # Step 6: Resize and boost alpha for standard resolution (18x18)
    out_1x = canvas.resize((18, 18), Image.Resampling.LANCZOS)
    boosted_1x = Image.new("RGBA", (18, 18), (0, 0, 0, 0))
    for y in range(18):
        for x in range(18):
            r, g, b, a = out_1x.getpixel((x, y))
            new_a = min(255, int(a * 2.0)) # Make lines thicker and brighter
            boosted_1x.putpixel((x, y), (255, 255, 255, new_a))
    boosted_1x.save("src/renderer/tray-icon.png")

    # Step 7: Resize and boost alpha for retina resolution (36x36)
    out_2x = canvas.resize((36, 36), Image.Resampling.LANCZOS)
    boosted_2x = Image.new("RGBA", (36, 36), (0, 0, 0, 0))
    for y in range(36):
        for x in range(36):
            r, g, b, a = out_2x.getpixel((x, y))
            new_a = min(255, int(a * 2.0))
            boosted_2x.putpixel((x, y), (255, 255, 255, new_a))
    boosted_2x.save("src/renderer/tray-icon@2x.png")

    print("Saved src/renderer/tray-icon.png (18x18)")
    print("Saved src/renderer/tray-icon@2x.png (36x36)")

    # Step 8: Save a preview image for visual check
    preview = Image.new("RGBA", (144, 144), (20, 22, 30, 255))
    preview_canvas = canvas.resize((144, 144), Image.Resampling.LANCZOS)
    # Boost alpha of preview as well
    for y in range(144):
        for x in range(144):
            r, g, b, a = preview_canvas.getpixel((x, y))
            new_a = min(255, int(a * 2.0))
            preview_canvas.putpixel((x, y), (255, 255, 255, new_a))
    preview.alpha_composite(preview_canvas)
    preview.save("build/tray-icon-preview.png")
    print("Saved build/tray-icon-preview.png")

if __name__ == "__main__":
    main()
