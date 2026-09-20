// Mahjoffg favicon — two dots, a pair of eyes.
//   node make-favicon.mjs        writes out/ and checks what it wrote
// Zero dependencies. One geometry in a 32-unit space, rendered at 16, 32 and
// 180. Two sky discs on the ground white — the same white the page, the
// masthead and the browser's own bars are already painted, so on a light tab
// the chip disappears and only the eyes are left floating, which is the page's
// own premise at 16 pixels. On a dark tab the chip shows and carries them.
//
// This inverts the ribbon-M and 一筒 icons, where the mark was white on a sky
// chip. Here the mark IS the blue, so the ground has to be the white.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SKY, WHITE, rrect, disc, render, png, unpng } from '../ribbon-m/lib.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = HERE + 'out/';
const TAG = 'mahjoffg-eyes-20260920a';
mkdirSync(OUT + 'src', { recursive: true });
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

// ── geometry ────────────────────────────────────────────────────────────────
// r 4, dx 6  centres at x=10 and x=22, so each disc spans 6..14 and 18..26 and
//      every one of those four edges is EVEN. That is the whole constraint: at
//      16px the design is halved, so an even design edge is a whole pixel and
//      an odd one puts a half-covered column down the side of a 4px dot, which
//      at that size is most of the dot. r 5 (edges 5,15,17,27) and dx 7 (edges
//      3,15,17,29) both fail it; r 6 needs dx 8 and then the discs run into the
//      chip's corners. r 4 / dx 6 is the only pair in the legible range.
// cy 16  dead centre. A circle is never crisp at its own edges — only its
//      bounding box can land on the grid — so symmetry is what is left to get
//      exactly right, and centring buys mirror symmetry on BOTH axes.
// Each disc is 25% of the box and the pair spans 20 of 32 (62%), the same
// width the ribbon M was drawn to.
const EYE = { cy: 16, dx: 6, r: 4 };
const RX = 7; // 22% of 32, the chip radius the direction was drawn with

const shapes = ({ chip = true } = {}) => [
  ...(chip ? [{ kind: 'rrect', a: [0, 0, 32, 32, RX], rgb: WHITE }] : []),
  { kind: 'disc', a: [16 - EYE.dx, EYE.cy, EYE.r], rgb: SKY },
  { kind: 'disc', a: [16 + EYE.dx, EYE.cy, EYE.r], rgb: SKY },
];
const HIT = { rrect, disc };
const layers = (list) => list.map((s) => ({ hit: HIT[s.kind](...s.a), rgb: s.rgb }));

const svg = (list, { size = 32, ground = null, scale = 1 } = {}) => {
  const el = list.map((s) => {
    const f = `fill="${hex(s.rgb)}"`;
    if (s.kind === 'rrect') { const [x0, y0, x1, y1, r] = s.a; return `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="${r}" ${f}/>`; }
    const [cx, cy, r] = s.a; return `<circle cx="${cx}" cy="${cy}" r="${r}" ${f}/>`;
  }).join('\n  ');
  const body = scale === 1 ? el : `<g transform="scale(${scale})">\n  ${el}\n  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">\n  ${ground ? `<rect width="${size}" height="${size}" fill="${hex(ground)}"/>\n  ` : ''}${body}\n</svg>\n`;
};

// ── outputs ─────────────────────────────────────────────────────────────────
const tab = shapes();
// Home screen: iOS paints transparent pixels black and applies its own corner
// mask, so this one is a full-bleed opaque square with no rounding of its own.
const touch = shapes({ chip: false });
const S180 = 180 / 32;

const files = {
  [`${TAG}-16.png`]: png(render(layers(tab), 16)),
  [`${TAG}-32.png`]: png(render(layers(tab), 32)),
  [`${TAG}-180.png`]: png(render(layers(touch), 180, { scale: S180, bg: WHITE, ss: 8 }), { opaque: true }),
  [`${TAG}.svg`]: svg(tab),
  [`src/${TAG}-180.svg`]: svg(touch, { size: 180, ground: WHITE, scale: S180 }),
};
for (const [name, body] of Object.entries(files)) writeFileSync(OUT + name, body);

// ── checks (read the files back; judge numbers, not looks) ──────────────────
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ok ' : 'FAIL '} ${msg}`); if (!cond) bad++; };
const at = (im, x, y) => Array.from(im.data.subarray((y * im.w + x) * 4, (y * im.w + x) * 4 + 4));
const is = (px, rgb, a = 255) => px[3] === a && (a === 0 || px.slice(0, 3).every((v, i) => v === rgb[i]));
// 1 = pure sky, 0 = white. The red channel carries the most range (0x49 vs 0xFF).
const skyness = (p) => ((255 - p[0]) / (255 - SKY[0])) * (p[3] / 255);

// How many separate blobs of ink are there? This is the one thing the icon has
// to be — two dots, not one bar and not three — and no per-pixel assertion says
// it. 4-connected flood fill over pixels that are more sky than not.
function blobs(im) {
  const seen = new Uint8Array(im.w * im.h), out = [];
  const ink = (x, y) => skyness(at(im, x, y)) > 0.5;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    if (seen[y * im.w + x] || !ink(x, y)) continue;
    let n = 0, sx = 0, sy = 0; const stack = [[x, y]];
    seen[y * im.w + x] = 1;
    while (stack.length) {
      const [cx, cy] = stack.pop(); n++; sx += cx; sy += cy;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || ny < 0 || nx >= im.w || ny >= im.h) continue;
        if (seen[ny * im.w + nx] || !ink(nx, ny)) continue;
        seen[ny * im.w + nx] = 1; stack.push([nx, ny]);
      }
    }
    out.push({ n, cx: sx / n, cy: sy / n });
  }
  return out.sort((a, b) => a.cx - b.cx);
}

console.log(`eyes  r${EYE.r} dx${EYE.dx}  disc edges ${JSON.stringify([16 - EYE.dx - EYE.r, 16 - EYE.dx + EYE.r, 16 + EYE.dx - EYE.r, 16 + EYE.dx + EYE.r])}`);
ok([16 - EYE.dx - EYE.r, 16 - EYE.dx + EYE.r, 16 + EYE.dx - EYE.r, 16 + EYE.dx + EYE.r].every((v) => v % 2 === 0),
  'every disc edge is even, so both dots keep their exact width at 16px as well as 32px');

for (const size of [16, 32]) {
  const s = size / 32;
  const buf = readFileSync(`${OUT}${TAG}-${size}.png`), im = unpng(buf);
  console.log(`\n${TAG}-${size}.png  ${im.w}x${im.h}  ${buf.length} bytes`);
  ok(im.w === size && im.h === size && im.colorType === 6, 'size and RGBA');
  ok(is(at(im, 0, 0), null, 0), 'corner (0,0) is fully transparent — the chip is rounded, not a square');
  ok(is(at(im, 16 * s, 0), WHITE), `top edge midpoint is solid ${hex(WHITE)} ground`);

  const row = 16 * s;                       // the row through both centres
  ok(is(at(im, (16 - EYE.dx) * s, row), SKY), `left eye's centre column is pure ${hex(SKY)}`);
  ok(is(at(im, 16 * s, row), WHITE) && is(at(im, 16 * s - 1, row), WHITE),
    'the gap between the eyes is untouched ground, not a bridge');
  ok(is(at(im, (16 - EYE.dx - EYE.r) * s - 1, row), WHITE),
    `the column outside the left eye (x=${(16 - EYE.dx - EYE.r) * s - 1}) is untouched ground`);

  // Ink area against the analytic 2·πr². The discs are the only ink, so this
  // catches a dot that silently lost or gained a pixel ring of coverage.
  let ink = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) ink += skyness(at(im, x, y));
  const want = 2 * Math.PI * (EYE.r * s) ** 2;
  ok(Math.abs(ink - want) / want < 0.02,
    `ink area ${ink.toFixed(1)}px² vs 2·πr² = ${want.toFixed(1)}px² (${(100 * (ink - want) / want).toFixed(1)}%)`);

  const b = blobs(im);
  ok(b.length === 2, `exactly two separate blobs of ink (${b.length})`);
  ok(b.length === 2 && Math.abs(b[0].n - b[1].n) === 0, `both blobs are the same size (${b.map((x) => x.n).join(' / ')} px)`);
  ok(b.length === 2 && Math.abs((b[1].cx - b[0].cx) - 2 * EYE.dx * s) < 0.01,
    `blob centres are ${2 * EYE.dx * s}px apart as drawn (${b.length === 2 ? (b[1].cx - b[0].cx).toFixed(2) : '—'})`);

  let asymX = 0, asymY = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size / 2; x++) { const a = at(im, x, y), c = at(im, size - 1 - x, y); if (a.some((v, i) => v !== c[i])) asymX++; }
  for (let y = 0; y < size / 2; y++) for (let x = 0; x < size; x++) { const a = at(im, x, y), c = at(im, x, size - 1 - y); if (a.some((v, i) => v !== c[i])) asymY++; }
  ok(asymX === 0, `left/right mirror image is byte-identical (${asymX} differing pixels)`);
  ok(asymY === 0, `top/bottom mirror image is byte-identical (${asymY} differing pixels)`);

  let soft = 0, solid = 0;
  for (let i = 0; i < size * size; i++) { const p = at(im, i % size, (i / size) | 0); if (p[3] === 0) continue; if (p[3] === 255 && (is(p, SKY) || is(p, WHITE))) solid++; else soft++; }
  console.log(`       ${solid} pixels are flat palette colour, ${soft} are antialiased (${(100 * soft / (soft + solid)).toFixed(0)}%) — a circle has no straight edge to land on the grid`);
}
{
  const buf = readFileSync(`${OUT}${TAG}-180.png`), im = unpng(buf);
  console.log(`\n${TAG}-180.png  ${im.w}x${im.h}  ${buf.length} bytes`);
  ok(im.w === 180 && im.h === 180, 'size');
  ok(im.colorType === 2, 'colour type 2: no alpha channel at all, nothing for iOS to fill with black');
  ok([[0, 0], [179, 0], [0, 179], [179, 179]].every(([x, y]) => is(at(im, x, y), WHITE)),
    'full-bleed: all four corners are ground white (iOS does the rounding)');
  ok(is(at(im, Math.round((16 - EYE.dx) * S180), 90), SKY) && is(at(im, Math.round((16 + EYE.dx) * S180), 90), SKY),
    'both eye centres are pure sky');
  ok(is(at(im, 90, 90), WHITE), 'the gap between the eyes is untouched ground');
  const b = blobs(im);
  ok(b.length === 2, `exactly two separate blobs of ink (${b.length})`);
}
console.log(`\n${TAG}.svg  ${files[`${TAG}.svg`].length} bytes`);
console.log(bad ? `\n${bad} check(s) FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);
