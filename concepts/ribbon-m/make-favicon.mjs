// Mahjoffg favicon — ribbon M (丝带 M).
//   node make-favicon.mjs        writes out/ and checks what it wrote
// Zero dependencies. One geometry in a 32-unit space, rendered at 16, 32 and
// 180. The M is a single open polyline stroked with round caps and joins, so
// it reads as one folded ribbon rather than a built-up letterform.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SKY, WHITE, rrect, render, png, unpng } from './lib.mjs';
import { polyline, mPath, foldAngle, crispness } from './stroke.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = HERE + 'out/';
const TAG = 'mahjoffg-ribbon-20260919a';
mkdirSync(OUT + 'src', { recursive: true });
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

// ── geometry ────────────────────────────────────────────────────────────────
// L 6  legs at x=6 and x=26, so the M spans 20 of the 32-unit box (62%).
//      With sw 4 the legs' edges are 4 and 8 — both EVEN, which is what makes
//      the two vertical strokes land on whole pixels at 16px as well as 32px.
//      sw 6 at L 7 (edges 4 and 10) is the only heavier weight that also does
//      this, but 6 pinches the counters shut; see sheets/final.png.
// T 8, B 24  legs 16 tall; the round caps carry the ink to 6 and 26, so the
//      glyph's visual centre is the canvas centre (T + B = 32).
// V 20  the fold. 2·atan(10/12) = 79.6°, the one angle in sheets/final.png
//      where the V is unmistakable at 16px and the counters still breathe.
const M = { L: 6, T: 8, B: 24, V: 20, sw: 4 };
const RX = 7; // 22% of 32, the chip radius the direction was drawn with

const shapes = ({ tile = true } = {}) => [
  ...(tile ? [{ kind: 'rrect', a: [0, 0, 32, 32, RX], rgb: SKY }] : []),
  { kind: 'stroke', a: [mPath(M), M.sw / 2], rgb: WHITE },
];
const HIT = { rrect, stroke: polyline };
const layers = (list) => list.map((s) => ({ hit: HIT[s.kind](...s.a), rgb: s.rgb }));

const svg = (list, { size = 32, ground = null, scale = 1 } = {}) => {
  const el = list.map((s) => {
    if (s.kind === 'rrect') { const [x0, y0, x1, y1, r] = s.a; return `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="${r}" fill="${hex(s.rgb)}"/>`; }
    const [pts, r] = s.a; // the capsule chain is exactly a round-capped, round-joined stroke
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join('');
    return `<path d="${d}" fill="none" stroke="${hex(s.rgb)}" stroke-width="${r * 2}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('\n  ');
  const body = scale === 1 ? el : `<g transform="scale(${scale})">\n  ${el}\n  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">\n  ${ground ? `<rect width="${size}" height="${size}" fill="${hex(ground)}"/>\n  ` : ''}${body}\n</svg>\n`;
};

// ── outputs ─────────────────────────────────────────────────────────────────
const tab = shapes();
// Home screen: iOS paints transparent pixels black and applies its own corner
// mask, so this one is a full-bleed opaque square with no rounding of its own.
const touch = shapes({ tile: false });
const S180 = 180 / 32;

const files = {
  [`${TAG}-16.png`]: png(render(layers(tab), 16)),
  [`${TAG}-32.png`]: png(render(layers(tab), 32)),
  [`${TAG}-180.png`]: png(render(layers(touch), 180, { scale: S180, bg: SKY, ss: 8 }), { opaque: true }),
  [`${TAG}.svg`]: svg(tab),
  [`src/${TAG}-180.svg`]: svg(touch, { size: 180, ground: SKY, scale: S180 }),
};
for (const [name, body] of Object.entries(files)) writeFileSync(OUT + name, body);

// ── checks (read the files back; judge numbers, not looks) ──────────────────
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ok ' : 'FAIL '} ${msg}`); if (!cond) bad++; };
const at = (im, x, y) => Array.from(im.data.subarray((y * im.w + x) * 4, (y * im.w + x) * 4 + 4));
const is = (px, rgb, a = 255) => px[3] === a && (a === 0 || px.slice(0, 3).every((v, i) => v === rgb[i]));

const c = crispness(M);
console.log(`ribbon M  L${M.L} sw${M.sw} fold ${foldAngle(M).toFixed(1)}°  leg edges ${JSON.stringify(c.edges)}`);
ok(c.at16 && c.at32, 'leg edges are even, so the vertical strokes are whole pixels at 16px and 32px');

for (const [size, k] of [[16, 1], [32, 2]]) {
  const buf = readFileSync(`${OUT}${TAG}-${size}.png`), im = unpng(buf);
  console.log(`\n${TAG}-${size}.png  ${im.w}x${im.h}  ${buf.length} bytes`);
  ok(im.w === size && im.h === size && im.colorType === 6, 'size and RGBA');
  ok(is(at(im, 0, 0), null, 0), 'corner (0,0) is fully transparent — the chip is rounded, not a square');
  ok(is(at(im, 8 * k, 0), SKY), `top edge midpoint is solid ${hex(SKY)}`);
  // row 22 of 32 sits below the fold and above the leg bottoms, where each leg
  // is a plain vertical bar: pixel L-1 is ground, L..L+sw-1 white, L+sw ground
  const row = 11 * k, x0 = 2 * k, x1 = 4 * k;
  ok(is(at(im, x0 - 1, row), SKY), `left leg: x=${x0 - 1} is ground, untouched`);
  ok(is(at(im, x0, row), WHITE) && is(at(im, x1 - 1, row), WHITE), `left leg: x=${x0}..${x1 - 1} is pure white`);
  ok(is(at(im, x1, row), SKY), `left leg: x=${x1} is ground again — no half-covered column on either side`);
  ok(is(at(im, 8 * k, row - 6 * k), SKY), "the V's opening is clear ground");
  let asym = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size / 2; x++) { const a = at(im, x, y), b = at(im, size - 1 - x, y); if (a.some((v, i) => v !== b[i])) asym++; }
  ok(asym === 0, `left/right mirror image is byte-identical (${asym} differing pixels)`);
  let soft = 0, solid = 0;
  for (let i = 0; i < size * size; i++) { const p = at(im, i % size, (i / size) | 0); if (p[3] === 0) continue; if (p[3] === 255 && (is(p, SKY) || is(p, WHITE))) solid++; else soft++; }
  console.log(`       ${solid} pixels are flat palette colour, ${soft} are antialiased (${(100 * soft / (soft + solid)).toFixed(0)}%) — the diagonals cannot be anything else`);
}
{
  const buf = readFileSync(`${OUT}${TAG}-180.png`), im = unpng(buf);
  console.log(`\n${TAG}-180.png  ${im.w}x${im.h}  ${buf.length} bytes`);
  ok(im.colorType === 2, 'colour type 2: no alpha channel at all, nothing for iOS to fill with black');
  ok([[0, 0], [179, 0], [0, 179], [179, 179]].every(([x, y]) => is(at(im, x, y), SKY)), 'full-bleed: all four corners are ground (iOS does the rounding)');
  // the leg's edges fall at 4·5.625 = 22.5 and 8·5.625 = 45, so at this size
  // one column straddles the left edge and the right edge lands whole
  ok(is(at(im, 21, 124), SKY) && is(at(im, 23, 124), WHITE) && is(at(im, 44, 124), WHITE) && is(at(im, 45, 124), SKY),
    'left leg spans x=23..44 in pure white, ground on both sides');
  ok(is(at(im, 90, 60), SKY), "the V's opening is clear ground");
}
console.log(`\n${TAG}.svg  ${files[`${TAG}.svg`].length} bytes`);
console.log(bad ? `\n${bad} check(s) FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);
