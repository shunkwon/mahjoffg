// Inspection sheets for the ribbon-M direction.
//   node explore.mjs width   line weight
//   node explore.mjs fold    fold angle, at the chosen weight
// Each column: 16px and 32px blown up with nearest-neighbour so every
// antialiased pixel is visible, then both at true size on a light and a dark
// tab. Not a deliverable.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SKY, WHITE, rrect, render, canvas, fill, blit, png } from './lib.mjs';
import { polyline, mPath, foldAngle, crispness } from './stroke.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
mkdirSync(HERE + 'sheets', { recursive: true });

// p: { L, T, B, V, sw, rx } in the 32-unit design space
const mark = (p) => [
  { hit: rrect(0, 0, 32, 32, p.rx ?? 7), rgb: SKY },
  { hit: polyline(mPath(p), p.sw / 2), rgb: WHITE },
];

// the preview the direction was picked from: legs on half-pixels, sw 4
const DRAFT = { L: 8.5, T: 10, B: 23, V: 19, sw: 4 };
const BASE = { L: 8, T: 8, B: 22, V: 17 }; // V = T + 9
const SW = Number(process.argv[3]) || 6;   // weight the fold sheet is drawn at

const sets = {
  width: [
    ['draft sw4 L8.5', DRAFT],
    ['sw4  L8', { ...BASE, sw: 4 }],
    ['sw6  L9', { ...BASE, L: 9, V: 17, sw: 6 }],
    ['sw6  L8', { ...BASE, sw: 6 }],
    ['sw8  L8', { ...BASE, sw: 8 }],
  ],
  fold: [
    ['d6   wide', { ...BASE, V: BASE.T + 6, sw: SW }],
    ['d9   mid', { ...BASE, V: BASE.T + 9, sw: SW }],
    ['d11  narrow', { ...BASE, V: BASE.T + 11, sw: SW }],
    ['d13  sharp', { ...BASE, V: BASE.T + 13, sw: SW }],
  ],
  // sw4 won on legibility; L6 fills the square more than L8. Legs 8..24 put the
  // glyph's visual centre on the canvas centre (T + B = 32, caps included).
  size: [
    ['L8 d10', { L: 8, T: 8, B: 24, V: 18, sw: 4 }],
    ['L8 d12', { L: 8, T: 8, B: 24, V: 20, sw: 4 }],
    ['L6 d10', { L: 6, T: 8, B: 24, V: 18, sw: 4 }],
    ['L6 d12', { L: 6, T: 8, B: 24, V: 20, sw: 4 }],
    ['L6 d14', { L: 6, T: 8, B: 24, V: 22, sw: 4 }],
  ],
  // L7/sw6 is the one heavier weight whose leg edges are still even (4 and 10),
  // so it is crisp at 16px too — worth a look before settling on sw4.
  final: [
    ['L6 sw4 d11', { L: 6, T: 8, B: 24, V: 19, sw: 4 }],
    ['L6 sw4 d12', { L: 6, T: 8, B: 24, V: 20, sw: 4 }],
    ['L6 sw4 d13', { L: 6, T: 8, B: 24, V: 21, sw: 4 }],
    ['L7 sw6 d12', { L: 7, T: 8, B: 24, V: 20, sw: 6 }],
    ['L7 sw6 d14', { L: 7, T: 8, B: 24, V: 22, sw: 6 }],
  ],
};

const which = process.argv[2] || 'width';
const items = sets[which];
if (!items) throw new Error('unknown set: ' + which);

const Z16 = 12, Z32 = 6, CELL = 192, GAP = 16;
const LIGHT = [255, 255, 255], TABL = [0xDE, 0xE1, 0xE6], DARK = [0x35, 0x36, 0x3A], FRAME = [0x20, 0x21, 0x24];
const W = GAP + items.length * (CELL + GAP), H = GAP + 3 * (CELL + GAP) + 64 + GAP;
const sheet = canvas(W, H, [0x80, 0x80, 0x80]);

items.forEach(([name, p], i) => {
  const layers = mark(p), x = GAP + i * (CELL + GAP);
  let y = GAP;
  const i16 = render(layers, 16), i32 = render(layers, 32);
  fill(sheet, x, y, CELL, CELL, LIGHT); blit(sheet, i16, x, y, Z16); y += CELL + GAP;
  fill(sheet, x, y, CELL, CELL, DARK); blit(sheet, i16, x, y, Z16); y += CELL + GAP;
  fill(sheet, x, y, CELL, CELL, LIGHT); blit(sheet, i32, x, y, Z32); y += CELL + GAP;
  fill(sheet, x, y, CELL / 2, 64, TABL); fill(sheet, x + 8, y + 8, CELL / 2 - 16, 48, LIGHT);
  blit(sheet, i16, x + 16, y + 24, 1); blit(sheet, i32, x + 48, y + 16, 1);
  fill(sheet, x + CELL / 2, y, CELL / 2, 64, FRAME); fill(sheet, x + CELL / 2 + 8, y + 8, CELL / 2 - 16, 48, DARK);
  blit(sheet, i16, x + CELL / 2 + 16, y + 24, 1); blit(sheet, i32, x + CELL / 2 + 48, y + 16, 1);
  const c = crispness(p);
  console.log(`${name.padEnd(16)} fold ${foldAngle(p).toFixed(1).padStart(5)}°  leg edges ${JSON.stringify(c.edges).padEnd(9)}` +
    `  crisp: 32px ${c.at32 ? 'yes' : 'NO '}  16px ${c.at16 ? 'yes' : 'NO'}`);
});

writeFileSync(`${HERE}sheets/${which}.png`, png(sheet, { opaque: true }));
console.log(`\nsheets/${which}.png  ${W}x${H}`);
