// Round 2: how thick is the base, and is the face edge the same ink as the base?
import { SKY, WHITE, rrect, disc, ring } from './lib.mjs';

const mix = (a, b, t) => a.map((v, i) => Math.round(v * t + b[i] * (1 - t)));

// slab tile: a solid back peeking out under a white face whose own edge is a lighter tint
export const slab = ({ x0 = 4, x1 = 28, rx = 4, o = 2, b, edge = 0.5, cy, ro = 8, ri = 4, rd = 2 }) => [
  { hit: rrect(x0, b, x1, 32, rx), rgb: SKY },                                  // back, shifted down by b
  { hit: rrect(x0, 0, x1, 32 - b, rx), rgb: mix(SKY, WHITE, edge) },            // face edge
  { hit: rrect(x0 + o, o, x1 - o, 32 - b - o, Math.max(rx - o, 0)), rgb: WHITE }, // face
  { hit: ring(16, cy, ro, ri), rgb: SKY },
  { hit: disc(16, cy, rd), rgb: SKY },
];

export default (tile) => [
  ['outline b6 (round1 pick)', tile({ x0: 4, x1: 28, rx: 4, o: 2, b: 6, cy: 14, ro: 8, ri: 4, rd: 2 })],
  ['outline b4 cy14', tile({ x0: 4, x1: 28, rx: 4, o: 2, b: 4, cy: 14, ro: 8, ri: 4, rd: 2 })],
  ['outline b4 cy15', tile({ x0: 4, x1: 28, rx: 4, o: 2, b: 4, cy: 15, ro: 8, ri: 4, rd: 2 })],
  ['slab b4 edge50', slab({ b: 4, cy: 14, edge: 0.5 })],
  ['slab b4 edge35', slab({ b: 4, cy: 14, edge: 0.35 })],
];
