// Mahjoffg favicon — the ff.
//   node make-favicon.mjs        writes out/ and checks what it wrote
// Two f's mirrored left-to-right, hooks pointing left, each with its own
// crossbar — drawn from the reference the user supplied on 2026-10-30.
// Flat: one colour (INK, the masthead's #101820), no depth, bevel or shading
// at any size. The only partial-alpha pixels are antialiasing along the hook
// curves, the slanted tip and edges that fall between pixels.
//
// Transparent ground is the primary set (16, 32, svg, 192/512 "any"). White
// ground is only for places that need an opaque square: apple-touch-icon and
// the Android maskable icons, which the OS crops to its own shape.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WHITE, render, canvas, fill, blit, png, unpng } from '../ribbon-m/lib.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = HERE + 'out/';
const TAG = 'mahjoffg-ff-20261030a';
mkdirSync(OUT, { recursive: true });

// ── geometry (32-unit grid) ─────────────────────────────────────────────────
// Measured off the reference (a 270px glyph square) and fitted to 4..28 both
// ways. Stem 4 wide; crossbar 3 tall, thinner than the stem as in the
// reference, overhanging the stem 4 on the left and 3 on the right; the hook's
// terminal is 3 thick, ends level with the crossbar's left end, and is cut on
// a slant (tip leaning left at the top). Outer corner radius 4, inner fillet 1.
// The two f's are 13 apart, so at 32 every vertical edge is on a whole pixel.
const INK = [0x10, 0x18, 0x20];
const TOP = 4, BASE = 28, BAR = [11, 14], TERM = 3, R = 4, SLANT = 0.27;
const STEMS = [8, 21];
const f = (sx) => {
  const x0 = sx - 4, cx = sx, cy = TOP + R, hy = TOP + TERM;
  return (x, y) => {
    if (y >= BAR[0] && y <= BAR[1] && x >= x0 && x <= sx + 7) return true;           // crossbar
    if (y < TOP || y > BASE || x > sx + 4) return false;
    if (y <= hy && x < x0 + (y - TOP) * SLANT) return false;                           // slanted tip
    if (x > cx && y < cy && (x - cx) ** 2 + (y - cy) ** 2 > R * R) return false;       // outer corner
    if (x < sx && y > hy) return x > sx - 1 && y < hy + 1 && (x - sx + 1) ** 2 + (y - hy - 1) ** 2 > 1; // inner fillet
    return true;
  };
};
const parts = STEMS.map(f);
const ff = { hit: (x, y) => parts.some((p) => p(x, y)), rgb: INK };

// the same outline as SVG
const hex = '#' + INK.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const n = (v) => +v.toFixed(2);
const fPath = (sx) => {
  const hy = TOP + TERM, x0 = sx - 4;
  return `M${sx} ${BASE}V${hy + 1}A1 1 0 0 0 ${sx - 1} ${hy}H${n(x0 + TERM * SLANT)}L${x0} ${TOP}H${sx}A${R} ${R} 0 0 1 ${sx + 4} ${TOP + R}V${BASE}Z`
    + `M${x0} ${BAR[0]}H${sx + 7}V${BAR[1]}H${x0}Z`;
};
const d = STEMS.map(fPath).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="${hex}" d="${d}"/></svg>\n`;

// ── outputs ─────────────────────────────────────────────────────────────────
// glyph height as a fraction of the canvas for each placement
//   tab sizes use the grid as-is (24/32 = 75%)
//   apple-touch-icon: 60% — iOS rounds the corners itself and the mark should
//     sit like the other home-screen icons, not touch the mask
//   maskable: 50% — the 24×24 glyph's diagonal is then 0.71 of the canvas,
//     inside the 0.80 safe circle every Android mask keeps
const place = (size, frac) => { const scale = (size * frac) / 24; return { scale, dx: size / 2 - 16 * scale, dy: size / 2 - 16 * scale }; };
const files = [
  ['16', 16, { scale: 0.5 }, false],
  ['32', 32, { scale: 1 }, false],
  ['192', 192, place(192, 0.75), false],
  ['512', 512, place(512, 0.75), false],
  ['apple-180', 180, place(180, 0.6), true],
  ['maskable-192', 192, place(192, 0.5), true],
  ['maskable-512', 512, place(512, 0.5), true],
];
const imgs = {};
for (const [name, size, opt, white] of files) {
  const img = render([ff], size, { ...opt, bg: white ? WHITE : null });
  imgs[name] = img;
  writeFileSync(`${OUT}${TAG}-${name}.png`, png(img, { opaque: white }));
}
writeFileSync(`${OUT}${TAG}.svg`, svg);

// ── checks ──────────────────────────────────────────────────────────────────
// Read every file back. Transparent files: every pixel with any alpha is
// exactly INK. White files: opaque, and every pixel lies on the white→INK line
// (no third colour = no shading).
for (const [name, , , white] of files) {
  const { w, h, data } = unpng(readFileSync(`${OUT}${TAG}-${name}.png`));
  let ink = 0;
  for (let i = 0; i < w * h; i++) {
    const p = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]], a = data[i * 4 + 3];
    if (white) {
      if (a !== 255) throw new Error(`${name}: not opaque`);
      const t = (255 - p[0]) / (255 - INK[0]);
      for (let c = 0; c < 3; c++) if (Math.abs(255 - t * (255 - INK[c]) - p[c]) > 1) throw new Error(`${name}: off-palette pixel ${p}`);
      if (t > 0.5) ink++;
    } else if (a) {
      if (p.some((v, c) => v !== INK[c])) throw new Error(`${name}: off-palette pixel ${p}`);
      if (a > 127) ink++;
    }
  }
  console.log(`${TAG}-${name}.png  ${w}×${h}  ${white ? 'white' : 'transparent'}  ink ${(100 * ink / (w * h)).toFixed(1)}%`);
}
// the hooks must face left: terminals left of each stem, nothing to the right
const at32 = imgs['32'], alpha = (x, y) => at32.data[(y * 32 + x) * 4 + 3];
if (!(alpha(5, 4) === 255 && alpha(13, 4) === 0 && alpha(18, 4) === 255 && alpha(26, 4) === 0)) throw new Error('hooks are not pointing left');

// ── preview sheet ───────────────────────────────────────────────────────────
// tab sizes at 1× and zoomed on light and dark tab strips, then the white
// home-screen tiles with a squircle-ish crop and a circle crop.
const sheet = canvas(912, 224, [0xF2, 0xF2, 0xF2]);
let x = 16;
for (const bgc of [[255, 255, 255], [0xDE, 0xE1, 0xE6], [0x35, 0x36, 0x3A], [0x20, 0x21, 0x24]]) {
  fill(sheet, x, 16, 56, 32, bgc); blit(sheet, imgs['16'], x + 4, 24); blit(sheet, imgs['32'], x + 22, 16); x += 64;
}
fill(sheet, 16, 64, 128, 128, [0x35, 0x36, 0x3A]); blit(sheet, imgs['16'], 16, 64, 8);
fill(sheet, 152, 64, 128, 128, [255, 255, 255]); blit(sheet, imgs['32'], 152, 64, 4);
blit(sheet, imgs['apple-180'], 300, 16);
blit(sheet, imgs['maskable-192'], 496, 16);
// circle crop of the maskable, as the strictest Android mask
const circ = canvas(192, 192, [0xF2, 0xF2, 0xF2]);
const m = imgs['maskable-192'];
for (let yy = 0; yy < 192; yy++) for (let xx = 0; xx < 192; xx++) if ((xx - 95.5) ** 2 + (yy - 95.5) ** 2 <= 96 * 96) {
  const o = (yy * 192 + xx) * 4; for (let c = 0; c < 4; c++) circ.data[o + c] = m.data[o + c];
}
blit(sheet, circ, 704, 16);
writeFileSync(OUT + 'preview.png', png(sheet, { opaque: true }));
console.log('preview.png');
