// Mahjoffg favicon — the whole wordmark.
//   node make-favicon.mjs        writes out/ and checks what it wrote
// "Mahjoffg" set exactly as the masthead sets it (.site-brand: system font,
// weight 600, letter-spacing −0.03em, #101820). Headless Chrome draws it once
// at 400px (render.html); every size here is that master's coverage
// area-sampled down, so all sizes are the same shape, centred on the real ink.
// Only coverage is kept, and every pixel is painted the one ink, so the
// result is a flat silhouette with no shading at any size.
// On a Mac the system font is SF Pro; elsewhere Chrome falls back and the
// letterforms change, so run this on a Mac.
//
// Transparent ground is the primary set. White ground is for places that need
// an opaque square: apple-touch-icon and the Android maskable icons.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WHITE, canvas, fill, blit, png } from '../ribbon-m/lib.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = HERE + 'out/';
const TAG = 'mahjoffg-wordmark-20261030a';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const INK = [0x10, 0x18, 0x20];
mkdirSync(OUT, { recursive: true });

// ink width as a fraction of the canvas
//   tab sizes: 1px clear each side (14/16, 30/32)
//   apple-touch-icon: 80% — iOS rounds the corners itself
//   maskable: 74% — the wordmark's box then fits inside the 80% safe circle
const JOBS = [
  ['16', 16, 14 / 16], ['32', 32, 30 / 32], ['192', 192, 0.9], ['512', 512, 0.9],
  ['apple-180', 180, 0.8], ['maskable-192', 192, 0.74], ['maskable-512', 512, 0.74],
];
const WHITE_BG = new Set(['apple-180', 'maskable-192', 'maskable-512']);

// Inter Display: Inter's cut for large sizes, tighter and closer to the
// masthead's SF Pro Display than Inter's text cut
const FACE = 'InterDisplay-SemiBold.woff2';
const url = pathToFileURL(HERE + 'render.html').href + '#' + encodeURIComponent(FACE);
const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--virtual-time-budget=5000', '--dump-dom', url], { maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const res = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/)[1].trim();
if (!/^\d/.test(res)) throw new Error('render.html: ' + (res || 'no output'));
const [MW, MH, b64] = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/)[1].trim().split(' ');
const master = Buffer.from(b64, 'base64');
if (master.length !== MW * MH) throw new Error(`master: got ${master.length} bytes for ${MW}×${MH}`);
console.log(`master ${FACE} ${MW}×${MH}`);

// area coverage of each output pixel: the master is ≥10× every output, so an
// SS×SS grid of master samples per pixel is a close box filter
const SS = 16;
function sample(size, frac) {
  const k = (frac * size) / MW, ox = (size - MW * k) / 2, oy = (size - MH * k) / 2;
  const out = new Uint8Array(size * size);
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let sum = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const mx = Math.floor((px + (i + 0.5) / SS - ox) / k), my = Math.floor((py + (j + 0.5) / SS - oy) / k);
      if (mx >= 0 && my >= 0 && mx < MW && my < MH) sum += master[my * MW + mx];
    }
    out[py * size + px] = Math.round(sum / (SS * SS));
  }
  return out;
}

const imgs = {};
for (const [name, size, frac] of JOBS) {
  const alpha = sample(size, frac), px = (400 * frac * size / MW).toFixed(2);
  const white = WHITE_BG.has(name);
  const img = white ? canvas(size, size, WHITE) : { w: size, h: size, data: new Uint8ClampedArray(size * size * 4) };
  let ink = 0, x0 = size, x1 = -1, y0 = size, y1 = -1;
  for (let i = 0; i < size * size; i++) {
    const a = alpha[i] / 255, o = i * 4;
    if (white) for (let c = 0; c < 3; c++) img.data[o + c] = Math.round(INK[c] * a + 255 * (1 - a));
    else if (alpha[i]) { img.data[o] = INK[0]; img.data[o + 1] = INK[1]; img.data[o + 2] = INK[2]; img.data[o + 3] = alpha[i]; }
    if (alpha[i]) { const x = i % size, y = (i / size) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (alpha[i] > 127) ink++;
  }
  // nothing may touch the edge, and the ink box must sit centred within 1px
  if (x0 < 1 || y0 < 1 || x1 > size - 2 || y1 > size - 2) throw new Error(`${name}: ink touches the edge ${[x0, y0, x1, y1]}`);
  if (Math.abs(x0 - (size - 1 - x1)) > 1.5 || Math.abs(y0 - (size - 1 - y1)) > 1.5) throw new Error(`${name}: ink box off centre ${[x0, y0, x1, y1]}`);
  imgs[name] = img;
  writeFileSync(`${OUT}${TAG}-${name}.png`, png(img, { opaque: white }));
  console.log(`${TAG}-${name}.png  ${size}×${size}  ${white ? 'white' : 'transparent'}  font ${px}px  ink box ${x1 - x0 + 1}×${y1 - y0 + 1}  ink ${(100 * ink / size / size).toFixed(1)}%`);
}

// ── preview sheet ───────────────────────────────────────────────────────────
const sheet = canvas(912, 224, [0xF2, 0xF2, 0xF2]);
let x = 16;
for (const bgc of [[255, 255, 255], [0xDE, 0xE1, 0xE6], [0x35, 0x36, 0x3A], [0x20, 0x21, 0x24]]) {
  fill(sheet, x, 16, 56, 32, bgc); blit(sheet, imgs['16'], x + 4, 24); blit(sheet, imgs['32'], x + 22, 16); x += 64;
}
fill(sheet, 16, 64, 128, 128, [255, 255, 255]); blit(sheet, imgs['16'], 16, 64, 8);
fill(sheet, 152, 64, 128, 128, [255, 255, 255]); blit(sheet, imgs['32'], 152, 64, 4);
blit(sheet, imgs['apple-180'], 300, 16);
blit(sheet, imgs['maskable-192'], 496, 16);
const circ = canvas(192, 192, [0xF2, 0xF2, 0xF2]), m = imgs['maskable-192'];
for (let yy = 0; yy < 192; yy++) for (let xx = 0; xx < 192; xx++) if ((xx - 95.5) ** 2 + (yy - 95.5) ** 2 <= 96 * 96) {
  const o = (yy * 192 + xx) * 4; for (let c = 0; c < 4; c++) circ.data[o + c] = m.data[o + c];
}
blit(sheet, circ, 704, 16);
writeFileSync(OUT + 'preview.png', png(sheet, { opaque: true }));
console.log('preview.png');
