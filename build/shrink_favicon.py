"""Shrink the mahjoffg-m glyph in place: crop to its alpha bbox, scale down, recenter.
Keeps the exact same pixels/font/glow — only size and padding change.
Writes new cache-busted filenames (same-day revision -> 'b' suffix on the date).
"""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCALE = 0.75
OLD_TAG = "20260911"
NEW_TAG = "20260911b"

def shrink(src_path, out_path, canvas_size, scale_factor):
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
    canvas.save(out_path)
    print(f"{out_path}: bbox={bbox} glyph={glyph.size}->{glyph_small.size} canvas={canvas_size}")

if __name__ == "__main__":
    for size in (32, 180, 512):
        src = os.path.join(ROOT, f"mahjoffg-m-{OLD_TAG}-{size}.png")
        out = os.path.join(ROOT, f"mahjoffg-m-{NEW_TAG}-{size}.png")
        shrink(src, out, size, SCALE)
