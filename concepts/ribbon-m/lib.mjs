// Zero-dependency raster + PNG helpers for the tile favicon.
// Shapes are analytic (rounded rects, discs, rings); antialiasing is an N×N
// box filter per output pixel, so any edge that sits on a whole output pixel
// comes out exactly crisp — that is what the 32-unit even-number grid is for.
import { deflateSync, inflateSync } from 'node:zlib';

export const SKY = [0x49, 0xA5, 0xE8];
export const WHITE = [255, 255, 255];

export const rrect = (x0, y0, x1, y1, r) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
};
export const disc = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
export const ring = (cx, cy, ro, ri) => (x, y) => {
  const d = (x - cx) ** 2 + (y - cy) ** 2;
  return d <= ro * ro && d >= ri * ri;
};

// layers: [{hit(x,y), rgb}] in paint order, all opaque; topmost hit wins.
// Design space is mapped to pixels by  px = design * scale + (dx, dy).
export function render(layers, size, { scale = size / 32, dx = 0, dy = 0, bg = null, ss = 16 } = {}) {
  const w = size, h = size, out = new Uint8ClampedArray(w * h * 4);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const x = (px + (i + 0.5) / ss - dx) / scale, y = (py + (j + 0.5) / ss - dy) / scale;
      let c = bg;
      for (let k = layers.length - 1; k >= 0; k--) if (layers[k].hit(x, y)) { c = layers[k].rgb; break; }
      if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
    }
    const o = (py * w + px) * 4, n = ss * ss;
    if (a) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
    out[o + 3] = Math.round(255 * a / n);
  }
  return { w, h, data: out };
}

export function canvas(w, h, rgb) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255; }
  return { w, h, data };
}
export function fill(dst, x0, y0, w, h, rgb) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const o = (y * dst.w + x) * 4; dst.data[o] = rgb[0]; dst.data[o + 1] = rgb[1]; dst.data[o + 2] = rgb[2]; dst.data[o + 3] = 255;
  }
}
// alpha-over blit with nearest-neighbour zoom (dst must be opaque)
export function blit(dst, src, x0, y0, zoom = 1) {
  for (let y = 0; y < src.h * zoom; y++) for (let x = 0; x < src.w * zoom; x++) {
    const s = ((y / zoom | 0) * src.w + (x / zoom | 0)) * 4, d = ((y0 + y) * dst.w + x0 + x) * 4;
    const a = src.data[s + 3] / 255;
    for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round(src.data[s + c] * a + dst.data[d + c] * (1 - a));
  }
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
// opaque:true writes colour type 2 (no alpha channel at all) and refuses if any pixel is not fully opaque
export function png(img, { opaque = false } = {}) {
  const { w, h, data } = img, bpp = opaque ? 3 : 4;
  const raw = Buffer.alloc((w * bpp + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * bpp + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = y * (w * bpp + 1) + 1 + x * bpp;
      if (opaque && data[s + 3] !== 255) throw new Error(`pixel ${x},${y} is not opaque`);
      raw[d] = data[s]; raw[d + 1] = data[s + 1]; raw[d + 2] = data[s + 2]; if (!opaque) raw[d + 3] = data[s + 3];
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// minimal decoder for our own files (filter 0 only) — used by the checks
export function unpng(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const bpp = ct === 2 ? 3 : 4, raw = inflateSync(Buffer.concat(idat)), data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    if (raw[y * (w * bpp + 1)] !== 0) throw new Error('unexpected PNG filter');
    for (let x = 0; x < w; x++) {
      const s = y * (w * bpp + 1) + 1 + x * bpp, o = (y * w + x) * 4;
      data[o] = raw[s]; data[o + 1] = raw[s + 1]; data[o + 2] = raw[s + 2]; data[o + 3] = bpp === 4 ? raw[s + 3] : 255;
    }
  }
  return { w, h, data, colorType: ct };
}
