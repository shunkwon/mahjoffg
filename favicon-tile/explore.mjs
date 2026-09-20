// Inspection sheet: candidates side by side, 16px and 32px blown up with
// nearest-neighbour so every antialiased pixel is visible. Not a deliverable.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SKY, WHITE, rrect, disc, ring, render, canvas, fill, blit, png } from './lib.mjs';

// fileURLToPath, not URL.pathname: pathname keeps "%20", and mkdir -p then
// happily builds a parallel "Application%20Support" tree next to the real one.
const HERE = fileURLToPath(new URL('.', import.meta.url));
mkdirSync(HERE + 'sheets', { recursive: true });

// outline tile: ink silhouette, white face inset by `o` (bottom inset `b` = the thickness), ring + dot
export const tile = ({ x0, x1, y0 = 0, y1 = 32, rx, o, b, cx = 16, cy, ro, ri, rd = 0, ri2 = 0, ro2 = 0 }) => [
  { hit: rrect(x0, y0, x1, y1, rx), rgb: SKY },
  { hit: rrect(x0 + o, y0 + o, x1 - o, y1 - b, Math.max(rx - o, 0)), rgb: WHITE },
  { hit: ring(cx, cy, ro, ri), rgb: SKY },
  ...(ro2 ? [{ hit: ring(cx, cy, ro2, ri2), rgb: SKY }] : []),
  ...(rd ? [{ hit: disc(cx, cy, rd), rgb: SKY }] : []),
];

// the first sketch, for before/after
const draft = [
  { hit: rrect(6, 5, 26, 30, 4), rgb: SKY },
  { hit: rrect(6, 2, 26, 27, 4), rgb: [0xBC, 0xD0, 0xE2] },
  { hit: rrect(7, 3, 25, 26, 3), rgb: WHITE },
  { hit: ring(16, 14.5, 7.5, 4.5), rgb: SKY },
  { hit: disc(16, 14.5, 1.8), rgb: SKY },
];

const sets = {
  round1: [
    ['draft', draft],
    ['3:4 bullseye', tile({ x0: 4, x1: 28, rx: 4, o: 2, b: 6, cy: 14, ro: 8, ri: 4, rd: 2 })],
    ['3:4 light ring', tile({ x0: 4, x1: 28, rx: 4, o: 2, b: 6, cy: 14, ro: 8, ri: 5, rd: 2.5 })],
    ['3:4 donut', tile({ x0: 4, x1: 28, rx: 4, o: 2, b: 6, cy: 14, ro: 8, ri: 4 })],
    ['7:8 wide', tile({ x0: 2, x1: 30, rx: 4, o: 2, b: 6, cy: 14, ro: 10, ri: 6, rd: 2 })],
  ],
};

const which = process.argv[2] || 'round1';
const items = (await loadExtra(which)) || sets[which];
async function loadExtra(name) { try { return (await import(`./sets-${name}.mjs`)).default(tile, draft); } catch { return null; } }

const Z16 = 12, Z32 = 6, CELL = 192, GAP = 16, LIGHT = [255, 255, 255], TABL = [0xDE, 0xE1, 0xE6], DARK = [0x35, 0x36, 0x3A], FRAME = [0x20, 0x21, 0x24];
const W = GAP + items.length * (CELL + GAP), H = GAP + 3 * (CELL + GAP) + 64 + GAP;
const sheet = canvas(W, H, [0x80, 0x80, 0x80]);
items.forEach(([name, layers], i) => {
  const x = GAP + i * (CELL + GAP); let y = GAP;
  const i16 = render(layers, 16), i32 = render(layers, 32);
  fill(sheet, x, y, CELL, CELL, LIGHT); blit(sheet, i16, x, y, Z16); y += CELL + GAP;
  fill(sheet, x, y, CELL, CELL, DARK); blit(sheet, i16, x, y, Z16); y += CELL + GAP;
  fill(sheet, x, y, CELL, CELL, LIGHT); blit(sheet, i32, x, y, Z32); y += CELL + GAP;
  // true size: 16 and 32 on light tab, then on dark tab
  fill(sheet, x, y, CELL / 2, 64, TABL); fill(sheet, x + 8, y + 8, CELL / 2 - 16, 48, LIGHT);
  blit(sheet, i16, x + 16, y + 24, 1); blit(sheet, i32, x + 48, y + 16, 1);
  fill(sheet, x + CELL / 2, y, CELL / 2, 64, FRAME); fill(sheet, x + CELL / 2 + 8, y + 8, CELL / 2 - 16, 48, DARK);
  blit(sheet, i16, x + CELL / 2 + 16, y + 24, 1); blit(sheet, i32, x + CELL / 2 + 48, y + 16, 1);
});
writeFileSync(`${HERE}sheets/${which}.png`, png(sheet, { opaque: true }));
console.log(`sheets/${which}.png  ${W}x${H}  columns: ${items.map(([n]) => n).join(' | ')}`);
