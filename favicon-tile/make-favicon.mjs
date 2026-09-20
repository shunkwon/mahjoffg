// Mahjoffg favicon — 一筒 (one-of-circles) mahjong tile.
//   node make-favicon.mjs        writes out/ and checks what it wrote
// Zero dependencies. One geometry, in a 32-unit space where every straight edge
// is an EVEN number, so the same drawing lands on whole pixels at 32px and at 16px.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SKY, WHITE, rrect, disc, ring, render, png, unpng } from './lib.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = HERE + 'out/';
const TAG = 'mahjoffg-tile-20260919a';
mkdirSync(OUT, { recursive: true });

const mix = (a, b, t) => a.map((v, i) => Math.round(v * t + b[i] * (1 - t)));
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

// ── geometry ────────────────────────────────────────────────────────────────
// Tile is 24×32 (3:4), full height of the box. Reading bottom-up:
//   back  — solid sky, the same slab pushed down 4: only its bottom 4 units show  → the tile's thickness
//   edge  — face slab in a 65% sky tint: a 2-unit rim so a white face survives a white tab
//   face  — white, inset 2
//   ring + dot — centred on the face at (16,14), outer diameter 16 = 80% of the face's width
const TILE = { x0: 4, x1: 28, rx: 4, rim: 2, depth: 4, cx: 16, cy: 14, ro: 8 };
// dot radius / ring inner radius. 3·2·3 (dot, gap, ring) from 32px up; at 16px only
// 2·2·4 keeps every radius a whole pixel, anything else turns the centre to mush.
const RING = { big: { rd: 3, ri: 5 }, small: { rd: 2, ri: 4 } };
const EDGE = mix(SKY, WHITE, 0.65);
const SIDE_ON_SKY = mix(SKY, WHITE, 0.45);

const shapes = ({ rd, ri }, { back = SKY, edge = EDGE, rim = TILE.rim } = {}) => {
  const { x0, x1, rx, depth, cx, cy, ro } = TILE;
  return [
    { kind: 'rrect', a: [x0, depth, x1, 32, rx], rgb: back },
    ...(rim ? [{ kind: 'rrect', a: [x0, 0, x1, 32 - depth, rx], rgb: edge }] : []),
    { kind: 'rrect', a: [x0 + rim, rim, x1 - rim, 32 - depth - rim, rx - rim], rgb: WHITE },
    { kind: 'ring', a: [cx, cy, ro, ri], rgb: SKY },
    { kind: 'disc', a: [cx, cy, rd], rgb: SKY },
  ];
};
const HIT = { rrect, ring, disc };
const layers = (list) => list.map((s) => ({ hit: HIT[s.kind](...s.a), rgb: s.rgb }));
const svg = (list, { size = 32, ground = null, scale = 1, dx = 0, dy = 0 } = {}) => {
  const el = list.map((s) => {
    const f = `fill="${hex(s.rgb)}"`;
    if (s.kind === 'rrect') { const [x0, y0, x1, y1, r] = s.a; return `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="${r}" ${f}/>`; }
    if (s.kind === 'disc') { const [cx, cy, r] = s.a; return `<circle cx="${cx}" cy="${cy}" r="${r}" ${f}/>`; }
    const [cx, cy, ro, ri] = s.a; // ring as a stroked circle: radius is the stroke's centreline
    return `<circle cx="${cx}" cy="${cy}" r="${(ro + ri) / 2}" fill="none" stroke="${hex(s.rgb)}" stroke-width="${ro - ri}"/>`;
  }).join('\n  ');
  const g = scale === 1 && !dx && !dy ? el : `<g transform="translate(${dx} ${dy}) scale(${scale})">\n  ${el}\n  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">\n  ${ground ? `<rect width="${size}" height="${size}" fill="${hex(ground)}"/>\n  ` : ''}${g}\n</svg>\n`;
};

// ── outputs ─────────────────────────────────────────────────────────────────
const tab16 = shapes(RING.small), tab32 = shapes(RING.big);
// Home-screen icon: iOS paints transparent pixels black and cuts its own corners, so this one is a
// full-bleed opaque square. On a sky ground the rim has nothing to do (white on sky needs no help) and a
// sky back would vanish, so the rim goes and the side turns pale. Tile at ×4 = 96×128, every edge on a pixel.
const touch = shapes(RING.big, { back: SIDE_ON_SKY, rim: 0 });
const T = { scale: 4, dx: (180 - 32 * 4) / 2, dy: (180 - 32 * 4) / 2 };

const files = {
  [`${TAG}-16.png`]: png(render(layers(tab16), 16)),
  [`${TAG}-32.png`]: png(render(layers(tab32), 32)),
  [`${TAG}-180.png`]: png(render(layers(touch), 180, { ...T, bg: SKY, ss: 8 }), { opaque: true }),
  [`${TAG}.svg`]: svg(tab32),
  // hint sources: what the 16px and 180px PNGs were drawn from, so a browser can be asked to redraw them
  [`src/${TAG}-16.svg`]: svg(tab16),
  [`src/${TAG}-180.svg`]: svg(touch, { size: 180, ground: SKY, ...T }),
};
mkdirSync(OUT + 'src', { recursive: true });
for (const [name, body] of Object.entries(files)) writeFileSync(OUT + name, body);

// ── checks (read the files back; judge numbers, not looks) ──────────────────
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ok ' : 'FAIL '} ${msg}`); if (!cond) bad++; };
const at = (im, x, y) => Array.from(im.data.subarray((y * im.w + x) * 4, (y * im.w + x) * 4 + 4));
const is = (px, rgb, a = 255) => px[3] === a && (a === 0 || px.slice(0, 3).every((v, i) => v === rgb[i]));

for (const [size, k] of [[16, 1], [32, 2]]) {
  const im = unpng(readFileSync(`${OUT}${TAG}-${size}.png`));
  console.log(`\n${TAG}-${size}.png  ${im.w}x${im.h}  ${readFileSync(`${OUT}${TAG}-${size}.png`).length} bytes`);
  ok(im.w === size && im.h === size && im.colorType === 6, 'size and RGBA');
  const mid = 7 * k; // a row that crosses the ring's centre band, away from every corner
  ok(is(at(im, 2 * k - 1, mid), null, 0), `left of the tile is fully transparent (x=${2 * k - 1})`);
  ok(is(at(im, 2 * k, mid), EDGE), `rim starts exactly at x=${2 * k}, pure ${hex(EDGE)}`);
  ok(is(at(im, 3 * k, mid), WHITE), `face starts exactly at x=${3 * k}, pure white`);
  ok(is(at(im, 14 * k - 1, mid), EDGE) && is(at(im, 14 * k, mid), null, 0), `right rim ends exactly at x=${14 * k}`);
  ok(is(at(im, 8 * k, 0), EDGE) && is(at(im, 8 * k, k), WHITE), 'top rim is one step thick');
  ok(is(at(im, 8 * k, 13 * k), EDGE) && is(at(im, 8 * k, 14 * k), SKY) && is(at(im, 8 * k, 16 * k - 1), SKY), `base: rim then solid sky from y=${14 * k} to the bottom row`);
  // a circle only touches its bounding pixel column at one point, so "on the grid" here means: the column
  // outside is untouched white, and the column inside is sky to within the sliver the curve shaves off
  const skyness = (p) => (255 - p[0]) / (255 - SKY[0]); // 1 = pure sky, 0 = white
  ok(is(at(im, 4 * k - 1, mid), WHITE) && skyness(at(im, 4 * k, mid)) > 0.95, `ring's outer edge lands on x=${4 * k}: x=${4 * k - 1} is untouched white, x=${4 * k} is ${(100 * skyness(at(im, 4 * k, mid))).toFixed(0)}% sky`);
  ok(skyness(at(im, 8 * k, 7 * k)) > 0.7, `centre dot reads as sky (${(100 * skyness(at(im, 8 * k, 7 * k))).toFixed(0)}% — a 2px dot cannot fill its four pixels, a 6px one can)`);
  // mirror symmetry, left/right: the drawing is symmetric about x=16, so the raster must be too
  let asym = 0; for (let y = 0; y < size; y++) for (let x = 0; x < size / 2; x++) { const a = at(im, x, y), b = at(im, size - 1 - x, y); if (a.some((v, i) => v !== b[i])) asym++; }
  ok(asym === 0, `left/right mirror image is byte-identical (${asym} differing pixels)`);
  // how much of the picture is antialiasing: only corners and the circles are allowed to be soft
  const pal = [SKY, EDGE, WHITE]; let soft = 0, solid = 0;
  for (let i = 0; i < size * size; i++) { const p = at(im, i % size, i / size | 0); if (p[3] === 0) continue; (p[3] === 255 && pal.some((c) => is(p, c)) ? solid++ : soft++, 0); }
  console.log(`       ${solid} pixels are flat palette colour, ${soft} are antialiased (${(100 * soft / (soft + solid)).toFixed(0)}%)`);
}
{
  const buf = readFileSync(`${OUT}${TAG}-180.png`), im = unpng(buf);
  console.log(`\n${TAG}-180.png  ${im.w}x${im.h}  ${buf.length} bytes`);
  ok(im.w === 180 && im.h === 180, 'size');
  ok(im.colorType === 2, 'colour type 2: the file has no alpha channel at all, nothing for iOS to fill with black');
  ok([[0, 0], [179, 0], [0, 179], [179, 179]].every(([x, y]) => is(at(im, x, y), SKY)), 'full-bleed: all four corners are ground colour (iOS does the rounding)');
  ok(is(at(im, 41, 90), SKY) && is(at(im, 42, 90), WHITE), 'tile face starts exactly at x=42');
  ok(is(at(im, 90, 137), WHITE) && is(at(im, 90, 138), SIDE_ON_SKY) && is(at(im, 90, 153), SIDE_ON_SKY) && is(at(im, 90, 154), SKY), `side band is y=138..153, pure ${hex(SIDE_ON_SKY)}`);
  ok(is(at(im, 90, 82), SKY), 'centre dot');
}
console.log(`\n${TAG}.svg  ${files[`${TAG}.svg`].length} bytes`);
console.log(bad ? `\n${bad} check(s) FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);
