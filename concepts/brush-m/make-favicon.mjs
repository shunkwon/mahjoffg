// Mahjoffg favicon — the hand-written m.
//   node make-favicon.mjs        writes out/ and checks what it wrote
// The mark is not drawn here. It is a drawing supplied as-is — one brush stroke
// of blue on white, src/mahjoffg-brush-m-source.webp (1254×1254, lossy WebP,
// sRGB profile) — and this script only fits it to 16, 32 and 180. Decoding
// needs dwebp (Homebrew `webp`); everything else is node built-ins and
// ../ribbon-m/lib.mjs.
//
// The chip is the eyes icon's: a white rounded square, the white the page, the
// masthead and the browser's own bars are already painted. It is also simply
// the drawing's own ground. On a light tab it disappears and only the m is
// left; on a dark one it carries it.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SKY, WHITE, rrect, render, canvas, fill, blit, png, unpng } from '../ribbon-m/lib.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = HERE + 'out/';
const SRC = HERE + 'src/mahjoffg-brush-m-source.webp';
const TAG = 'mahjoffg-brush-m-20260929a';
mkdirSync(OUT, { recursive: true });
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

// ── layout ──────────────────────────────────────────────────────────────────
// The m is 1.94:1 and its stroke is about 64 of its 840 source px, so at tab
// sizes width is everything. 28 of 32 wide puts the stroke at ~2.1px at 32 and
// the glyph 14.5 tall — y 8.8..23.2, clear of the chip's corner arcs, which end
// at 7 and 25. The home-screen icon is a picture at 180px rather than a glyph
// fighting for pixels, so it keeps the drawing's own framing: the source is
// 67% ink-wide, and 22 of 32 is 69%.
// 16px halves everything again. At 1.05px the stroke touches 58 pixels and
// only 30 of them are even half sky — a faint, broken scribble. So there it is
// thickened by GROW16 source px per side (~1.4px) before scaling: 25% more ink
// and 37 pixels at least half sky. The outer extent is held, so the glyph keeps
// its size, and both arches still show ground between their legs.
const TAB_W = 28, HOME_W = 22, GROW16 = 10;
const CHIP_R = 7; // the eyes icon's chip radius, 22% of 32

// ── source ──────────────────────────────────────────────────────────────────
const pam = execFileSync('dwebp', ['-quiet', SRC, '-pam', '-o', '-'], { maxBuffer: 64 << 20 });
const hdrEnd = pam.indexOf('ENDHDR\n') + 7, hdr = pam.toString('ascii', 0, hdrEnd);
if (!/\nDEPTH 4\n/.test(hdr) || !/\nMAXVAL 255\n/.test(hdr)) throw new Error('unexpected PAM header:\n' + hdr);
const W = +hdr.match(/\nWIDTH (\d+)\n/)[1], H = +hdr.match(/\nHEIGHT (\d+)\n/)[1], px = pam.subarray(hdrEnd);

// One blue on white, softened at its edges by antialiasing and speckled all
// over by WebP (the ground alone is #FEFEFE, #FFFFFF and a tail down to #F5).
// The drawing's own ink is measured — the mean of the stroke's interior, where
// red is below half — every pixel is projected onto the white→ink line, and
// the mask is cut at the midpoint. Coverage below comes from area rather than
// from the source's edge pixels, so none of the noise reaches the icon, and the
// ink is repainted in the site's SKY (it measures within a few units of it).
const INK = [0, 0, 0];
let interior = 0;
for (let i = 0; i < W * H; i++) if (px[i * 4] < 128) { for (let c = 0; c < 3; c++) INK[c] += px[i * 4 + c]; interior++; }
for (let c = 0; c < 3; c++) INK[c] = Math.round(INK[c] / interior);
const axis = INK.map((v) => 255 - v), axis2 = axis.reduce((a, v) => a + v * v, 0);
const mask = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  let t = 0;
  for (let c = 0; c < 3; c++) t += (255 - px[i * 4 + c]) * axis[c];
  mask[i] = t / axis2 >= 0.5 ? 1 : 0;
}

function bbox(m) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1, area = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!m[y * W + x]) continue;
    area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1: x1 + 1, y1: y1 + 1, area }; // x1/y1 exclusive: pixel i covers [i, i+1)
}

// Squared Euclidean distance from every pixel to the nearest ink, by
// Felzenszwalb & Huttenlocher's lower envelope of parabolas, one pass per axis.
// Only used to thicken the stroke for 16px: dilation by a true disc, so the
// brush keeps its round ends instead of growing square corners.
function dist2ToInk(m) {
  const INF = 1e20, N = Math.max(W, H), out = new Float64Array(W * H);
  const f = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1);
  const pass = (n) => {
    let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
  };
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = m[y * W + x] ? 0 : INF; pass(H); for (let y = 0; y < H; y++) out[y * W + x] = d[y]; }
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = out[y * W + x]; pass(W); for (let x = 0; x < W; x++) out[y * W + x] = d[x]; }
  return out;
}
const grow = (m, r) => { const d2 = dist2ToInk(m), g = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) g[i] = d2[i] <= r * r ? 1 : 0; return g; };

// Summed-area table: the ink area inside any rectangle, fractional corners
// included (the integral is bilinear inside each source pixel). Each icon pixel
// is then exactly the fraction of its footprint the stroke covers — the box
// filter lib.mjs's render() approximates with N×N samples, without the N.
function areaTable(m) {
  const S = new Float64Array((W + 1) * (H + 1));
  for (let y = 1; y <= H; y++) {
    let row = 0;
    for (let x = 1; x <= W; x++) { row += m[(y - 1) * W + x - 1]; S[y * (W + 1) + x] = S[(y - 1) * (W + 1) + x] + row; }
  }
  const F = (x, y) => {
    x = Math.min(Math.max(x, 0), W); y = Math.min(Math.max(y, 0), H);
    const i = Math.min(Math.floor(x), W - 1), j = Math.min(Math.floor(y), H - 1), u = x - i, t = y - j;
    const a = S[j * (W + 1) + i], b = S[j * (W + 1) + i + 1], c = S[(j + 1) * (W + 1) + i], e = S[(j + 1) * (W + 1) + i + 1];
    return a + u * (b - a) + t * (c - a) + u * t * (e - b - c + a);
  };
  return (ax, ay, bx, by) => F(bx, by) - F(ax, by) - F(bx, ay) + F(ax, ay);
}

// The glyph's box, `widthUnits` of 32 wide, centred on the square. Returns each
// icon pixel's ink coverage and the total the icon should hold.
function fit(m, size, widthUnits) {
  const b = bbox(m), area = areaTable(m);
  const k = (widthUnits * size / 32) / (b.x1 - b.x0); // icon px per source px
  const ox = size / 2 - k * (b.x0 + b.x1) / 2, oy = size / 2 - k * (b.y0 + b.y1) / 2;
  const cov = new Float64Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = area((x - ox) / k, (y - oy) / k, (x + 1 - ox) / k, (y + 1 - oy) / k) * k * k;
    cov[y * size + x] = c < 1e-9 ? 0 : Math.min(c, 1);
  }
  return { cov, k, w: (b.x1 - b.x0) * k, h: (b.y1 - b.y0) * k, inkArea: b.area * k * k, widthPx: widthUnits * size / 32 };
}
// Ink over the white of `base`. It must only ever land on fully opaque chip.
function paint(base, cov) {
  for (let i = 0; i < cov.length; i++) {
    if (!cov[i]) continue;
    if (base.data[i * 4 + 3] !== 255) throw new Error(`ink at pixel ${i % base.w},${(i / base.w) | 0} lands on the chip's antialiased rim`);
    for (let c = 0; c < 3; c++) base.data[i * 4 + c] = Math.round(WHITE[c] + cov[i] * (SKY[c] - WHITE[c]));
  }
  return base;
}

// ── outputs ─────────────────────────────────────────────────────────────────
const chip = (size) => render([{ hit: rrect(0, 0, 32, 32, CHIP_R), rgb: WHITE }], size);
const fits = { 16: fit(grow(mask, GROW16), 16, TAB_W), 32: fit(mask, 32, TAB_W), 180: fit(mask, 180, HOME_W) };
const files = {
  [`${TAG}-16.png`]: png(paint(chip(16), fits[16].cov)),
  [`${TAG}-32.png`]: png(paint(chip(32), fits[32].cov)),
  // Home screen: iOS paints transparent pixels black and applies its own corner
  // mask, so this one is a full-bleed opaque square with no rounding of its own.
  [`${TAG}-180.png`]: png(paint(canvas(180, 180, WHITE), fits[180].cov), { opaque: true }),
};
for (const [name, body] of Object.entries(files)) writeFileSync(OUT + name, body);

// ── preview (for looking at; nothing is judged from it) ─────────────────────
// 16 and 32 at 1:1 on four tab-strip colours — white, Chrome's light strip,
// Chrome's dark strip, near-black — then 16 at 8× and 32 at 4× to see the
// pixels, then the home-screen icon under an iOS-like corner mask.
{
  const [i16, i32, i180] = [16, 32, 180].map((s) => unpng(readFileSync(`${OUT}${TAG}-${s}.png`)));
  const sheet = canvas(752, 200, [245, 245, 245]);
  [[255, 255, 255], [222, 225, 230], [53, 54, 58], [32, 33, 36]].forEach((bg, i) => {
    fill(sheet, 10 + i * 64, 10, 60, 40, bg); blit(sheet, i16, 16 + i * 64, 22); blit(sheet, i32, 34 + i * 64, 14);
  });
  fill(sheet, 276, 10, 128, 128, [53, 54, 58]); blit(sheet, i16, 276, 10, 8);
  fill(sheet, 414, 10, 128, 128, [53, 54, 58]); blit(sheet, i32, 414, 10, 4);
  const ios = rrect(0, 0, 180, 180, 180 * 0.2237);
  for (let y = 0; y < 180; y++) for (let x = 0; x < 180; x++) if (!ios(x + 0.5, y + 0.5)) i180.data[(y * 180 + x) * 4 + 3] = 0;
  fill(sheet, 552, 0, 200, 200, [40, 40, 44]); blit(sheet, i180, 562, 10);
  writeFileSync(OUT + 'preview.png', png(sheet));
}

// ── checks (read the files back; judge numbers, not looks) ──────────────────
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ok ' : 'FAIL '} ${msg}`); if (!cond) bad++; };
const at = (im, x, y) => Array.from(im.data.subarray((y * im.w + x) * 4, (y * im.w + x) * 4 + 4));
const is = (p, rgb, a = 255) => p[3] === a && (a === 0 || p.slice(0, 3).every((v, i) => v === rgb[i]));
// 1 = pure sky, 0 = white. The red channel carries the most range (0x49 vs 0xFF).
const skyness = (p) => ((255 - p[0]) / (255 - SKY[0])) * (p[3] / 255);

// Connected regions of cells equal to `val` in a w×h grid, 8- or 4-connected;
// their sizes, largest first.
function regions(grid, w, h, val, eight) {
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h), sizes = [];
  const steps = eight ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let p = 0; p < w * h; p++) {
    if (seen[p] || grid[p] !== val) continue;
    let top = 0, n = 0; stack[top++] = p; seen[p] = 1;
    while (top) {
      const q = stack[--top], x = q % w, y = (q / w) | 0; n++;
      for (const [dx, dy] of steps) {
        const nx = x + dx, ny = y + dy, r = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[r] || grid[r] !== val) continue;
        seen[r] = 1; stack[top++] = r;
      }
    }
    sizes.push(n);
  }
  return sizes.sort((a, b) => b - a);
}

{
  const b = bbox(mask);
  console.log(`source  src/${SRC.split('/src/')[1]}  ${W}x${H}  sha256 ${createHash('sha256').update(readFileSync(SRC)).digest('hex')}`);
  console.log(`        ink measures ${hex(INK)} over ${interior} interior px, painted ${hex(SKY)}; glyph ${b.x1 - b.x0}x${b.y1 - b.y0} px, ${b.area} px of ink`);
  // Both matter before anything is scaled: a speck of WebP noise past the cut
  // would join the glyph's box and pull it off centre, and a hole would be a
  // white fleck inside the stroke.
  const inkRegions = regions(mask, W, H, 1, true), groundRegions = regions(mask, W, H, 0, false);
  ok(inkRegions.length === 1, `the drawing is one stroke: ${inkRegions.length} connected region(s) of ink, no specks`);
  ok(groundRegions.length === 1, `the white around it is ${groundRegions.length} connected region(s): no holes in the stroke`);
}

// Checks every size shares. Returns the ink's pixel footprint.
function common(im, f) {
  // Nothing but white, sky and the straight line between them. A pixel off that
  // line is colour that came from somewhere other than coverage.
  let off = 0;
  for (let i = 0; i < im.w * im.h; i++) {
    const p = at(im, i % im.w, (i / im.w) | 0);
    if (p[3] === 0) continue;
    const t = (255 - p[0]) / (255 - SKY[0]);
    if (p[3] !== 255 ? !is(p, WHITE, p[3]) : [1, 2].some((c) => Math.abs(p[c] - (WHITE[c] + t * (SKY[c] - WHITE[c]))) > 1)) off++;
  }
  ok(off === 0, `every pixel is ${hex(WHITE)}, ${hex(SKY)} or a blend of the two (${off} off that line)`);

  // Ink area against the stroke's own area scaled down. Coverage is area, so
  // this holds to rounding; it catches a glyph that lost or gained weight.
  let ink = 0, x0 = im.w, x1 = -1, y0 = im.h, y1 = -1;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const s = skyness(at(im, x, y));
    if (!s) continue;
    ink += s; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  ok(Math.abs(ink - f.inkArea) / f.inkArea < 0.01,
    `ink area ${ink.toFixed(1)}px² vs the source stroke scaled down, ${f.inkArea.toFixed(1)}px² (${(100 * (ink - f.inkArea) / f.inkArea).toFixed(2)}%)`);
  const l = x0, r = im.w - 1 - x1, t = y0, b = im.h - 1 - y1;
  ok(Math.abs(l - r) <= 1 && Math.abs(t - b) <= 1, `centred: margins left ${l} / right ${r}, top ${t} / bottom ${b}`);
  ok(Math.abs(x1 - x0 + 1 - f.widthPx) <= 1, `ink spans ${x1 - x0 + 1}px across, drawn to ${f.widthPx}`);

  // What the icon has to be: one stroke. Pixels that are more sky than not,
  // 8-connected — a stroke too thin for its size falls apart into dashes here.
  const grid = new Uint8Array(im.w * im.h);
  for (let i = 0; i < grid.length; i++) grid[i] = skyness(at(im, i % im.w, (i / im.w) | 0)) >= 0.5 ? 1 : 0;
  const pieces = regions(grid, im.w, im.h, 1, true);
  ok(pieces.length === 1, `one unbroken stroke: ${pieces.length} region(s) at least half sky${pieces.length > 1 ? ` (${pieces.join(' / ')} px)` : ''}`);
}

for (const size of [16, 32]) {
  const f = fits[size], s = size / 32;
  const buf = readFileSync(`${OUT}${TAG}-${size}.png`), im = unpng(buf);
  console.log(`\n${TAG}-${size}.png  ${im.w}x${im.h}  ${buf.length} bytes  glyph ${f.w.toFixed(1)}x${f.h.toFixed(1)}px${size === 16 ? `, stroke grown ${GROW16} source px per side` : ''}`);
  ok(im.w === size && im.h === size && im.colorType === 6, 'size and RGBA');
  ok(is(at(im, 0, 0), null, 0), 'corner (0,0) is fully transparent — the chip is rounded, not a square');
  ok(is(at(im, size / 2, 0), WHITE), `top edge midpoint is solid ${hex(WHITE)} ground`);
  let corner = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / s, v = (y + 0.5) / s;
    if ((u < CHIP_R || u > 32 - CHIP_R) && (v < CHIP_R || v > 32 - CHIP_R) && skyness(at(im, x, y))) corner++;
  }
  ok(corner === 0, `no ink in the four ${CHIP_R}/32 corner squares, where the chip's rim curves (${corner} px)`);
  common(im, f);
}
{
  const f = fits[180], buf = readFileSync(`${OUT}${TAG}-180.png`), im = unpng(buf);
  console.log(`\n${TAG}-180.png  ${im.w}x${im.h}  ${buf.length} bytes  glyph ${f.w.toFixed(1)}x${f.h.toFixed(1)}px`);
  ok(im.w === 180 && im.h === 180, 'size');
  ok(im.colorType === 2, 'colour type 2: no alpha channel at all, nothing for iOS to fill with black');
  ok([[0, 0], [179, 0], [0, 179], [179, 179]].every(([x, y]) => is(at(im, x, y), WHITE)),
    'full-bleed: all four corners are ground white (iOS does the rounding)');
  common(im, f);
}
console.log(`\npreview.png  ${readFileSync(OUT + 'preview.png').length} bytes (not checked — for looking at)`);
console.log(bad ? `\n${bad} check(s) FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);
