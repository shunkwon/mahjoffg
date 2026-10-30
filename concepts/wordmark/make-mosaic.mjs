// Mahjoffg favicon — the wordmark as a 16×16 mosaic.
//   node make-mosaic.mjs blue   blue cells on a transparent ground
//   node make-mosaic.mjs tile   white letters on a solid blue square
//   node make-mosaic.mjs blue --grid grids/20261030b.json
//                               a hand-painted grid instead of the font's,
//                               as copied from the playground; tagged by the
//                               file's name
// writes out/ and checks what it wrote
// The mark IS the 16px rendering of the wordmark: "Mahjoffg" in Inter Display
// SemiBold (fonts/, SIL OFL 1.1) at the masthead's −0.03em tracking, 14 of 16
// cells wide, each cell's tone its ink coverage. Every larger size enlarges
// that same 16×16 grid with hard-edged square cells, so the mosaic is the
// design, not a side effect of shrinking.
//
// Two colours only, the site field's: SKY_DEEP #49A5E8 and white. A cell's
// tone is its coverage between the two.
//   blue: the letters are blue at coverage as alpha, on a transparent ground
//     at every size — apple-touch-icon and maskable included, by choice
//     (2026-10-30): iOS paints a transparent home-screen icon's ground black,
//     and an Android launcher fills it with its own colour.
//   tile: the letters are white on a full blue square, opaque at every size.
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SKY, WHITE, canvas, fill, blit, png, unpng } from '../ribbon-m/lib.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = HERE + 'out/';
const WAY = process.argv[2];
if (!['blue', 'tile'].includes(WAY)) throw new Error('usage: node make-mosaic.mjs blue|tile');
const gi = process.argv.indexOf('--grid'), GRID_FILE = gi > 0 ? process.argv[gi + 1] : null;
const TAG = `mahjoffg-mosaic-${WAY}-${GRID_FILE ? GRID_FILE.replace(/^.*\//, '').replace(/\.json$/, '') : '20261030a'}`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const N = 16, FRAC = 14 / 16;
mkdirSync(OUT, { recursive: true });

// ── the grid ────────────────────────────────────────────────────────────────
// Chrome draws the wordmark once at 400px (render.html); each cell is the
// area coverage of the master under it. With --grid the cells come from the
// file instead, which must be 16×16 integers 0–255 in the icon's own blue.
const GRID = new Uint8Array(N * N);
if (GRID_FILE) {
  const j = JSON.parse(readFileSync(new URL(GRID_FILE, pathToFileURL(HERE)), 'utf8'));
  if (j.cells !== N || j.alpha.length !== N || j.alpha.some((r) => r.length !== N)) throw new Error(`${GRID_FILE}: not ${N}×${N}`);
  if (j.color.toUpperCase() !== '#' + SKY.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()) throw new Error(`${GRID_FILE}: colour ${j.color} is not the site blue`);
  j.alpha.flat().forEach((v, i) => { if (!Number.isInteger(v) || v < 0 || v > 255) throw new Error(`${GRID_FILE}: cell ${i} is ${v}`); GRID[i] = v; });
} else {
const url = pathToFileURL(HERE + 'render.html').href + '#' + encodeURIComponent('InterDisplay-SemiBold.woff2');
const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--virtual-time-budget=5000', '--dump-dom', url], { maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const res = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/)[1].trim();
if (!/^\d/.test(res)) throw new Error('render.html: ' + (res || 'no output'));
const [MW, MH] = res.split(' ').map(Number), master = Buffer.from(res.split(' ')[2], 'base64');
const SS = 32, k = (FRAC * N) / MW, ox = (N - MW * k) / 2, oy = (N - MH * k) / 2;
for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
  let sum = 0;
  for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
    const mx = Math.floor((cx + (i + 0.5) / SS - ox) / k), my = Math.floor((cy + (j + 0.5) / SS - oy) / k);
    if (mx >= 0 && my >= 0 && mx < MW && my < MH) sum += master[my * MW + mx];
  }
  GRID[cy * N + cx] = Math.round(sum / SS / SS);
}
}
for (let cy = 0; cy < N; cy++) {
  const row = [...GRID.subarray(cy * N, cy * N + N)];
  if (row.some(Boolean)) console.log(row.map((v) => (v ? v.toString(16).padStart(2, '0') : '··')).join(' '));
}

// ── outputs ─────────────────────────────────────────────────────────────────
// [name, size, cell px]. The grid is cell × 16 and centred.
//   apple-touch-icon: 11px cells (176 of 180); iOS rounds the corners itself.
//   maskable: the inked cells span 14×4 of the grid, so 9px / 24px cells keep
//   their box's diagonal (131 / 349px) inside the 80% safe circle.
const JOBS = [
  ['16', 16, 1], ['32', 32, 2], ['192', 192, 12], ['512', 512, 32],
  ['apple-180', 180, 11], ['maskable-192', 192, 9], ['maskable-512', 512, 24],
];
// RGBA of a cell at coverage a; null = left fully transparent
const mix = (from, to, a) => from.map((v, c) => Math.round(v + (to[c] - v) * a / 255));
function tone(a) {
  if (WAY === 'tile') return [...mix(SKY, WHITE, a), 255];
  return a ? [...SKY, a] : null;
}
const opaque = WAY === 'tile';

const imgs = {};
for (const [name, size, cell] of JOBS) {
  const off = (size - cell * N) / 2;
  if (off !== Math.floor(off)) throw new Error(`${name}: grid not on whole pixels`);
  const img = { w: size, h: size, data: new Uint8ClampedArray(size * size * 4) };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = Math.floor((x - off) / cell), gy = Math.floor((y - off) / cell);
    const t = tone(gx >= 0 && gy >= 0 && gx < N && gy < N ? GRID[gy * N + gx] : 0);
    if (t) img.data.set(t, (y * size + x) * 4);
  }
  imgs[name] = img;
  writeFileSync(`${OUT}${TAG}-${name}.png`, png(img, { opaque }));
}

// ── checks ──────────────────────────────────────────────────────────────────
// Read every file back: each cell is one flat tone edge to edge (hard edges,
// no smoothing between cells), it is the grid's tone, and nothing outside the
// grid is inked. Only blue, white and blends of the two appear.
for (const [name, size, cell] of JOBS) {
  const { data } = unpng(readFileSync(`${OUT}${TAG}-${name}.png`)), off = (size - cell * N) / 2;
  const at = (x, y) => [...data.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)].join();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = Math.floor((x - off) / cell), gy = Math.floor((y - off) / cell);
    const inGrid = gx >= 0 && gy >= 0 && gx < N && gy < N, a = inGrid ? GRID[gy * N + gx] : 0;
    const t = tone(a), want = t && t.join();
    const got = at(x, y);
    if (want === null ? data[(y * size + x) * 4 + 3] !== 0 : got !== want) throw new Error(`${name}: pixel ${x},${y} is ${got}, want ${want}`);
  }
  console.log(`${TAG}-${name}.png  ${size}×${size}  ${opaque ? 'opaque' : 'transparent'}  ${cell}px cells`);
}

// ── preview sheet ───────────────────────────────────────────────────────────
const sheet = canvas(912, 224, [0xF2, 0xF2, 0xF2]);
let x = 16;
for (const bgc of [[255, 255, 255], [0xDE, 0xE1, 0xE6], [0x35, 0x36, 0x3A], [0x20, 0x21, 0x24]]) {
  fill(sheet, x, 16, 56, 32, bgc); blit(sheet, imgs['16'], x + 4, 24); blit(sheet, imgs['32'], x + 22, 16); x += 64;
}
fill(sheet, 16, 64, 128, 128, [255, 255, 255]); blit(sheet, imgs['16'], 16, 64, 8);
fill(sheet, 152, 64, 128, 128, [0x35, 0x36, 0x3A]); blit(sheet, imgs['16'], 152, 64, 8);
blit(sheet, imgs['apple-180'], 300, 16);
blit(sheet, imgs['maskable-192'], 496, 16);
const circ = canvas(192, 192, [0xF2, 0xF2, 0xF2]), m = imgs['maskable-192'];
for (let yy = 0; yy < 192; yy++) for (let xx = 0; xx < 192; xx++) if ((xx - 95.5) ** 2 + (yy - 95.5) ** 2 <= 96 * 96) {
  const o = (yy * 192 + xx) * 4; for (let c = 0; c < 4; c++) circ.data[o + c] = m.data[o + c];
}
blit(sheet, circ, 704, 16);
writeFileSync(`${OUT}${TAG}-preview.png`, png(sheet, { opaque: true }));
console.log(`${TAG}-preview.png`);
