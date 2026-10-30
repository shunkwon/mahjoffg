// What fits in a browser tab: the full wordmark against a monogram, at the
// sizes a tab actually shows (16 on a 1× screen, 32 on Retina), on light and
// dark tab strips, plus 6× zooms.
//   node compare-tab.mjs      writes out/compare-tab.png
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canvas, fill, blit, png } from '../ribbon-m/lib.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const INK = [0x10, 0x18, 0x20];

function master(text) {
  const url = pathToFileURL(HERE + 'render.html').href + '#' + encodeURIComponent(`InterDisplay-SemiBold.woff2|${text}`);
  const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--virtual-time-budget=5000', '--dump-dom', url], { maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const [w, h, b64] = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/)[1].trim().split(' ');
  return { w: +w, h: +h, a: Buffer.from(b64, 'base64') };
}
// fit the ink box inside `fill` of the square, centred, area-sampled
function icon(m, size, fillFrac) {
  const k = (fillFrac * size) / Math.max(m.w, m.h), ox = (size - m.w * k) / 2, oy = (size - m.h * k) / 2, SS = 16;
  const img = { w: size, h: size, data: new Uint8ClampedArray(size * size * 4) };
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let sum = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const mx = Math.floor((px + (i + 0.5) / SS - ox) / k), my = Math.floor((py + (j + 0.5) / SS - oy) / k);
      if (mx >= 0 && my >= 0 && mx < m.w && my < m.h) sum += m.a[my * m.w + mx];
    }
    const o = (py * size + px) * 4;
    img.data[o] = INK[0]; img.data[o + 1] = INK[1]; img.data[o + 2] = INK[2]; img.data[o + 3] = Math.round(sum / SS / SS);
  }
  return img;
}

const rows = [['Mahjoffg', 14 / 16], ['M', 13 / 16], ['ff', 13 / 16]];
const sheet = canvas(16 + 3 * 232, 16 + 2 * 120, [0xF2, 0xF2, 0xF2]);
rows.forEach(([text, f], i) => {
  const m = master(text), i16 = icon(m, 16, f), i32 = icon(m, 32, f), x = 16 + i * 232;
  // a light and a dark tab: icon at 16 (1×) and at 32 (Retina, drawn 1:1 here so it reads twice as big)
  fill(sheet, x, 16, 216, 40, [255, 255, 255]); blit(sheet, i16, x + 8, 28); blit(sheet, i32, x + 40, 20);
  fill(sheet, x, 64, 216, 40, [0x35, 0x36, 0x3A]); blit(sheet, i16, x + 8, 76); blit(sheet, i32, x + 40, 68);
  fill(sheet, x, 120, 96, 96, [255, 255, 255]); blit(sheet, i16, x, 120, 6);
  fill(sheet, x + 104, 120, 96, 96, [255, 255, 255]); blit(sheet, i32, x + 104, 120, 3);
  console.log(text);
});
writeFileSync(HERE + 'out/compare-tab.png', png(sheet, { opaque: true }));
