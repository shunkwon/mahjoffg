// Round 3: slab tile is settled; now the face-edge tint and the ring's rhythm (dot / gap / ring, summing to 8).
import { slab } from './sets-round2.mjs';

export default () => [
  ['edge50  2/2/4', slab({ b: 4, cy: 14, edge: 0.5, rd: 2, ri: 4 })],
  ['edge65  2/2/4', slab({ b: 4, cy: 14, edge: 0.65, rd: 2, ri: 4 })],
  ['edge65  3/2/3', slab({ b: 4, cy: 14, edge: 0.65, rd: 3, ri: 5 })],
  ['edge65  2/3/3', slab({ b: 4, cy: 14, edge: 0.65, rd: 2, ri: 5 })],
  ['edge65  2.5/2/3.5', slab({ b: 4, cy: 14, edge: 0.65, rd: 2.5, ri: 4.5 })],
];
