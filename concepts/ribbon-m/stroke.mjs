// A round-joined, round-capped stroked polyline, as a hit test.
//
// The filled region of such a stroke is exactly the union of one capsule per
// segment — a segment thickened by r, with semicircular ends. The caps supply
// the round line caps at the two open ends and, where two capsules overlap at
// a shared point, the round join. So there is nothing to construct: test the
// point against each capsule and OR the results.
export const capsule = (x1, y1, x2, y2, r) => (x, y) => {
  const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - x1) * dx + (y - y1) * dy) / len2)) : 0;
  const ex = x - (x1 + t * dx), ey = y - (y1 + t * dy);
  return ex * ex + ey * ey <= r * r;
};

export const polyline = (pts, r) => {
  const segs = pts.slice(1).map((p, i) => capsule(pts[i][0], pts[i][1], p[0], p[1], r));
  return (x, y) => segs.some((f) => f(x, y));
};

// The M, as five points: up the left leg, down into the fold, up to the right
// shoulder, down the right leg. Symmetric about x = 16 by construction.
export const mPath = ({ L, T, B, V }) => [[L, B], [L, T], [16, V], [32 - L, T], [32 - L, B]];

// Opening angle at the fold, in degrees — the angle between the two arms that
// meet at the vertex. This is what "折角" refers to.
export const foldAngle = ({ L, T, V }) => 2 * Math.atan((16 - L) / (V - T)) * 180 / Math.PI;

// Where the vertical legs' edges land. A vertical edge is crisp at a given
// pixel size only if it falls on a whole pixel there: integer at 32px, even at
// 16px (since 16px halves every coordinate).
export const legEdges = ({ L, sw }) => [L - sw / 2, L + sw / 2];
export const crispness = (p) => {
  const e = legEdges(p);
  const int = e.every((v) => Number.isInteger(v));
  return { edges: e, at32: int, at16: int && e.every((v) => v % 2 === 0) };
};
