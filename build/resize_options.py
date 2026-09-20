"""Generate several candidate shrink ratios for side-by-side comparison."""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "mahjoffg-m-20260911-180.png")  # the un-shrunk original

def shrink(src_path, canvas_size, scale_factor):
    img = Image.open(src_path).convert("RGBA")
    alpha = img.split()[3]
    bbox = alpha.getbbox()
    glyph = img.crop(bbox)
    gw, gh = glyph.size
    new_w = max(1, round(gw * scale_factor))
    new_h = max(1, round(gh * scale_factor))
    glyph_small = glyph.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    px = (canvas_size - new_w) // 2
    py = (canvas_size - new_h) // 2
    canvas.alpha_composite(glyph_small, (px, py))
    return canvas

def on_dark(img, bg=(30, 30, 35, 255)):
    c = Image.new("RGBA", img.size, bg)
    c.alpha_composite(img)
    return c

options = [("100% (original)", 1.00), ("90%", 0.90), ("85%", 0.85), ("75% (shipped)", 0.75)]
size = 180
tiles = []
for label, scale in options:
    icon = shrink(SRC, size, scale)
    icon.save(os.path.join(ROOT, f"mahjoffg-m-preview-{int(scale*100)}.png"))
    tiles.append(on_dark(icon))

gap = 16
W = size * len(tiles) + gap * (len(tiles) - 1)
H = size + 30
strip = Image.new("RGBA", (W, H), (20, 20, 24, 255))
x = 0
for t in tiles:
    strip.paste(t, (x, 30))
    x += size + gap
strip.save(os.path.join(ROOT, "compare_size_options.png"))
print("saved compare_size_options.png and per-option preview files")
