// 180px apple-touch candidates, previewed under an iOS-like corner mask
// (the shipped file stays a full-bleed square — iOS does the masking itself).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SKY, WHITE, rrect, disc, ring, render, canvas, blit, png } from './lib.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
mkdirSync(HERE + 'sheets', { recursive: true });
const mix = (a, b, t) => a.map((v, i) => Math.round(v * t + b[i] * (1 - t)));

// tile in 32-unit space; colours are parameters so the same geometry can sit on either ground
const tile = ({ back, edge, face = WHITE, ink = SKY, rx = 4, rd = 2, ri = 4, ro = 8, extra = [] }) => [
  { hit: rrect(4, 4, 28, 32, rx), rgb: back },
  { hit: rrect(4, 0, 28, 28, rx), rgb: edge },
  { hit: rrect(6, 2, 26, 26, Math.max(rx - 2, 0)), rgb: face },
  { hit: ring(16, 14, ro, ri), rgb: ink },
  ...extra,
  { hit: disc(16, 14, rd), rgb: ink },
];

const DEEP = mix([0x1F, 0x6F, 0xB8], SKY, 0.6);
const items = [
  ['white ground', WHITE, tile({ back: SKY, edge: mix(SKY, WHITE, 0.65) })],
  ['white ground rx3', WHITE, tile({ back: SKY, edge: mix(SKY, WHITE, 0.65), rx: 3 })],
  ['white ground 3/2/3', WHITE, tile({ back: SKY, edge: mix(SKY, WHITE, 0.65), rd: 3, ri: 5 })],
  ['sky ground, pale side', SKY, tile({ back: mix(SKY, WHITE, 0.45), edge: WHITE })],
  ['sky ground, deep side', SKY, tile({ back: DEEP, edge: WHITE })],
];

const S = 180, SCALE = 4, DX = (S - 32 * SCALE) / 2, DY = (S - 32 * SCALE) / 2, GAP = 20;
const W = GAP + items.length * (S + GAP), H = GAP + S + GAP + 60 + GAP;
const sheet = canvas(W, H, [0x6B, 0x70, 0x78]);
const mask = rrect(0, 0, S, S, S * 0.2237);
items.forEach(([name, ground, layers], i) => {
  const full = render(layers, S, { scale: SCALE, dx: DX, dy: DY, bg: ground, ss: 8 });
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (!mask(x + 0.5, y + 0.5)) full.data[(y * S + x) * 4 + 3] = 0;
  blit(sheet, full, GAP + i * (S + GAP), GAP);
  // 60px: roughly how large it looks on a home screen
  const small = render(layers, 60, { scale: SCALE / 3, dx: DX / 3, dy: DY / 3, bg: ground, ss: 8 });
  const m60 = rrect(0, 0, 60, 60, 60 * 0.2237);
  for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) if (!m60(x + 0.5, y + 0.5)) small.data[(y * 60 + x) * 4 + 3] = 0;
  blit(sheet, small, GAP + i * (S + GAP) + 60, GAP + S + GAP);
});
writeFileSync(HERE + 'sheets/touch180.png', png(sheet, { opaque: true }));
console.log(`sheets/touch180.png ${W}x${H}: ${items.map(([n]) => n).join(' | ')}`);
