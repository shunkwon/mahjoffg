// Glyph variants for the ff favicon, side by side at 16, 32 and 4× 32.
//   node explore.mjs      writes out/variants.png
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SKY, render, canvas, fill, blit, png } from '../ribbon-m/lib.mjs';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const disc = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
// quarter ring; qx/qy = which side of the centre (+1 right/below, -1 left/above)
const quarter = (cx, cy, ri, ro, qx, qy) => (x, y) => {
  if ((x - cx) * qx < 0 || (y - cy) * qy < 0) return false;
  const d = (x - cx) ** 2 + (y - cy) ** 2;
  return d <= ro * ro && d >= ri * ri;
};

// one mirrored f: stem at sx (width t) from y0 to y1, hook top-left
function f({ sx, t = 4, top = 4, base = 28, r = 6, term = 4, bar, tail = false, round = false }) {
  const ri = r - t, cx = sx - ri, cy = top + r;
  const p = [quarter(cx, cy, ri, r, 1, -1), rect(cx - term, top, cx, top + t)];
  if (tail) {
    // descender mirrored too: curls to the right at the foot
    const bx = sx + t + ri, by = base - r;
    p.push(rect(sx, cy, sx + t, by), quarter(bx, by, ri, r, -1, 1), rect(bx, base - t, bx + term, base));
    if (round) p.push(disc(bx + term, base - t / 2, t / 2));
  } else p.push(rect(sx, cy, sx + t, base));
  if (bar) p.push(rect(...bar));
  if (round) p.push(disc(cx - term, top + t / 2, t / 2));
  return p;
}
const V = {
  'A 现在：共用横杠': [...f({ sx: 10 }), ...f({ sx: 22 }), rect(8, 12, 28, 16)],
  'B 各自横杠': [...f({ sx: 10, bar: [7, 12, 17, 16] }), ...f({ sx: 22, bar: [19, 12, 29, 16] })],
  'C 圆头 + 大弯': [...f({ sx: 11, r: 7, term: 3, round: true }), ...f({ sx: 22, r: 7, term: 3, round: true }), rect(8, 13, 28, 17)],
  'D 下端也镜像（尾巴朝右）': [...f({ sx: 8, top: 2, base: 30, r: 5, term: 2, tail: true }), ...f({ sx: 19, top: 2, base: 30, r: 5, term: 2, tail: true }), rect(5, 12, 26, 16)],
  'E 细笔画 3': [...f({ sx: 10, t: 3, r: 6, term: 4 }), ...f({ sx: 21, t: 3, r: 6, term: 4 }), rect(7, 12, 27, 15)],
  'F 错位：右 f 高一截': [...f({ sx: 10, top: 6, base: 28 }), ...f({ sx: 22, top: 2, base: 28 }), rect(8, 14, 28, 18)],
};

const names = Object.keys(V), cell = 152;
const sheet = canvas(cell * names.length + 16, 236, [0xF2, 0xF2, 0xF2]);
names.forEach((name, i) => {
  const hit = { hit: (x, y) => V[name].some((p) => p(x, y)), rgb: SKY };
  const x = 16 + i * cell;
  const i16 = render([hit], 16, { scale: 0.5 }), i32 = render([hit], 32, { scale: 1 });
  fill(sheet, x, 16, 128, 128, [255, 255, 255]); blit(sheet, render([hit], 128, { scale: 4 }), x, 16);
  fill(sheet, x, 152, 128, 32, [255, 255, 255]); blit(sheet, i16, x + 8, 160); blit(sheet, i32, x + 32, 152);
  fill(sheet, x, 192, 128, 32, [0x20, 0x21, 0x24]); blit(sheet, i16, x + 8, 200); blit(sheet, i32, x + 32, 192);
  console.log(i, name);
});
writeFileSync(OUT + 'variants.png', png(sheet, { opaque: true }));
