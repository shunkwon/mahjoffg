// Mahjoffg mosaic playground.
// The same pipeline as concepts/wordmark/make-mosaic.mjs, run in the browser:
// set the text once at 400px in Inter Display SemiBold with the masthead's
// tracking, crop to the inked pixels, then give each of n×n cells the area
// coverage of the master under it (0–255). With the defaults (16 cells, 14
// wide, −0.03em) the grid shown is LIVE itself, the alpha grid of the icon on
// mahjoffg.com (mahjoffg-mosaic-blue-20261030a-16.png): a browser's own
// antialiasing differs from headless Chrome's by ±1 in a cell or two, so
// resampling would not quite reproduce the file. Any other parameters are
// sampled here.
'use strict';

const LIVE = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,167,4,162,0,0,93,0,59,0,0,117,115,6,0,0,0,199,117,168,107,151,157,144,129,140,136,170,168,139,165,0,0,122,178,118,155,152,116,116,134,139,120,116,112,134,169,0,0,0,0,0,0,0,0,15,93,2,0,0,0,82,116,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
const DEFAULTS = { n: 16, w: 14, track: -0.03, text: 'Mahjoffg', color: '#49a5e8', levels: 256 };
const PX = 400;

const $ = (id) => document.getElementById(id);
const S = {
  ...DEFAULTS,
  base: new Uint8Array(256),   // as sampled
  grid: new Uint8Array(256),   // as shown: sampled, quantised, then hand edits
  edits: new Map(),            // cell index → value painted by hand
  mode: 'look', bg: 'checker', vals: true, pct: false,
  exCellTouched: false, hover: -1, fontOk: false,
};

// ── sampling ────────────────────────────────────────────────────────────────
let masterCache = { key: '', m: null };
function master(text, track) {
  const key = text + '|' + track;
  if (masterCache.key === key) return masterCache.m;
  const font = `600 ${PX}px Mark, sans-serif`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const plain = probe.measureText(text).width;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(plain + Math.abs(track) * PX * text.length + PX * 2);
  cv.height = PX * 2;
  const g = cv.getContext('2d');
  g.font = font;
  g.fillStyle = '#000';
  if ('letterSpacing' in g) {
    g.letterSpacing = `${track * PX}px`;
    g.fillText(text, PX, PX * 1.3);
  } else {
    // no canvas letterSpacing (older Safari/Firefox): set each character
    let x = PX;
    for (const ch of text) { g.fillText(ch, x, PX * 1.3); x += g.measureText(ch).width + track * PX; }
  }
  const W = cv.width, H = cv.height, d = g.getImageData(0, 0, W, H).data;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  let m = null;
  if (x1 >= 0) {
    const w = x1 - x0 + 1, h = y1 - y0 + 1, a = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = d[((y0 + y) * W + x0 + x) * 4 + 3];
    m = { w, h, a };
  }
  masterCache = { key, m };
  return m;
}

function sample() {
  const n = S.n, out = new Uint8Array(n * n), m = master(S.text, S.track);
  if (m) {
    const SS = n <= 24 ? 32 : 12, k = S.w / m.w, ox = (n - m.w * k) / 2, oy = (n - m.h * k) / 2;
    for (let cy = 0; cy < n; cy++) for (let cx = 0; cx < n; cx++) {
      let sum = 0;
      for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
        const mx = Math.floor((cx + (i + 0.5) / SS - ox) / k), my = Math.floor((cy + (j + 0.5) / SS - oy) / k);
        if (mx >= 0 && my >= 0 && mx < m.w && my < m.h) sum += m.a[my * m.w + mx];
      }
      out[cy * n + cx] = Math.round(sum / SS / SS);
    }
  }
  S.base = out;
}

function quantise(v) {
  if (S.levels >= 256 || !v) return v;
  const L = S.levels - 1;
  return Math.round(Math.round((v / 255) * L) / L * 255);
}

function compose() {
  const g = new Uint8Array(S.base.length);
  for (let i = 0; i < g.length; i++) g[i] = quantise(S.base[i]);
  for (const [i, v] of S.edits) g[i] = v;
  S.grid = g;
}

const isDefault = () => S.n === DEFAULTS.n && S.w === DEFAULTS.w && S.track === DEFAULTS.track && S.text === DEFAULTS.text;
function resample() {
  S.edits.clear();
  if (isDefault()) S.base = Uint8Array.from(LIVE); else sample();
  compose(); drawAll();
}

// ── colour helpers ──────────────────────────────────────────────────────────
const rgb = () => [1, 3, 5].map((i) => parseInt(S.color.slice(i, i + 2), 16));
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = (v) => (S.pct ? `${Math.round((v / 255) * 100)}%` : String(v));

// ── the big grid ────────────────────────────────────────────────────────────
const gridCv = $('grid');
let cellPx = 0;
function drawGrid() {
  const n = S.n, dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(160, gridCv.parentElement.clientWidth);
  cellPx = Math.max(2, Math.floor((cssW * dpr) / n));
  const side = cellPx * n;
  gridCv.width = side; gridCv.height = side;
  gridCv.style.width = side / dpr + 'px';
  const g = gridCv.getContext('2d'), [r, gg, b] = rgb();
  const ground = { checker: null, white: '#ffffff', dark: '#35363a', black: '#000000' }[S.bg];
  const ca = css('--check-a'), cb = css('--check-b');
  for (let cy = 0; cy < n; cy++) for (let cx = 0; cx < n; cx++) {
    const x = cx * cellPx, y = cy * cellPx, h = cellPx / 2;
    if (ground) { g.fillStyle = ground; g.fillRect(x, y, cellPx, cellPx); }
    else {
      g.fillStyle = ca; g.fillRect(x, y, cellPx, cellPx);
      g.fillStyle = cb; g.fillRect(x, y, h, h); g.fillRect(x + h, y + h, cellPx - h, cellPx - h);
    }
    const v = S.grid[cy * n + cx];
    if (v) { g.fillStyle = `rgba(${r},${gg},${b},${v / 255})`; g.fillRect(x, y, cellPx, cellPx); }
  }
  // cell lines, then the hovered cell
  g.strokeStyle = css('--line'); g.lineWidth = Math.max(1, Math.round(dpr * 0.75));
  g.beginPath();
  for (let i = 0; i <= n; i++) { const p = Math.min(side - 0.5, i * cellPx + 0.5); g.moveTo(p, 0); g.lineTo(p, side); g.moveTo(0, p); g.lineTo(side, p); }
  g.stroke();
  if (S.vals && cellPx >= 26 * dpr) {
    g.font = `${Math.round(cellPx * (S.pct ? 0.27 : 0.3))}px ui-monospace, Menlo, monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const darkGround = S.bg === 'dark' || S.bg === 'black' || (S.bg === 'checker' && matchMedia('(prefers-color-scheme: dark)').matches);
    for (let i = 0; i < n * n; i++) {
      const v = S.grid[i]; if (!v) continue;
      const lum = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
      const over = darkGround ? lum * v / 255 : 1 - (1 - lum) * v / 255;
      g.fillStyle = over < 0.55 ? '#ffffff' : '#101820';
      g.fillText(fmt(v), (i % n + 0.5) * cellPx, (Math.floor(i / n) + 0.5) * cellPx);
    }
  }
  if (S.hover >= 0 && S.hover < n * n) {
    g.strokeStyle = css('--fg'); g.lineWidth = Math.max(2, dpr * 2);
    g.strokeRect((S.hover % n) * cellPx + 1, Math.floor(S.hover / n) * cellPx + 1, cellPx - 2, cellPx - 2);
  }
}

// ── stats ───────────────────────────────────────────────────────────────────
function drawStats() {
  const n = S.n, g = S.grid, inked = [...g].filter(Boolean);
  $('s-total').textContent = `${n} × ${n} = ${n * n}`;
  $('s-inked').textContent = String(inked.length);
  $('s-empty').textContent = String(n * n - inked.length);
  $('s-max').textContent = inked.length ? fmt(Math.max(...inked)) : '—';
  $('s-min').textContent = inked.length ? fmt(Math.min(...inked)) : '—';
  $('s-mean').textContent = inked.length ? fmt(Math.round(inked.reduce((a, v) => a + v, 0) / inked.length)) : '—';

  const m = $('match');
  if (n !== 16) { m.className = 'match'; m.textContent = '线上图标是 16 × 16；换成 16 格才能逐格对比。'; }
  else {
    let diff = 0, maxd = 0;
    for (let i = 0; i < 256; i++) { const d = Math.abs(g[i] - LIVE[i]); if (d) { diff++; maxd = Math.max(maxd, d); } }
    if (!diff) { m.className = 'match same'; m.textContent = '和 mahjoffg.com 上的图标逐格相同。'; }
    else { m.className = 'match diff'; m.textContent = `和 mahjoffg.com 上的图标有 ${diff} 格不同，最多差 ${maxd}。`; }
    if (!isDefault()) m.textContent += ' 这是浏览器按当前参数重新采样的结果。';
  }

  // histogram of the inked cells, 16 bins over 1–255
  const hc = $('hist'), dpr = window.devicePixelRatio || 1, W = hc.clientWidth || 300, H = 56;
  hc.width = W * dpr; hc.height = H * dpr; hc.style.height = H + 'px';
  const x = hc.getContext('2d'); x.scale(dpr, dpr);
  const bins = new Array(16).fill(0); for (const v of inked) bins[Math.min(15, Math.floor((v - 1) / 16))]++;
  const top = Math.max(1, ...bins), bw = W / 16;
  x.fillStyle = css('--line'); x.fillRect(0, H - 13, W, 1);
  const [r, gg, b] = rgb();
  bins.forEach((c, i) => {
    const h = ((H - 16) * c) / top;
    x.fillStyle = `rgba(${r},${gg},${b},${(i * 16 + 8) / 255})`;
    x.fillRect(i * bw + 1, H - 13 - h, bw - 2, h);
  });
  x.fillStyle = css('--muted'); x.font = '10px ui-monospace, Menlo, monospace'; x.textBaseline = 'bottom';
  x.textAlign = 'left'; x.fillText(S.pct ? '浅 0%' : '浅 1', 0, H); x.textAlign = 'right'; x.fillText(S.pct ? '100% 深' : '255 深', W, H);
}

// ── sizes ───────────────────────────────────────────────────────────────────
const SIZES = [
  ['浏览器标签', 16, 1], ['标签（Retina 屏）', 32, 1], ['iPhone 主屏幕', 180, 1],
  ['安卓图标', 192, 1], ['安卓图标', 512, 1], ['安卓 maskable', 192, 0.75], ['安卓 maskable', 512, 0.75],
];
const cellFor = (size, share) => Math.floor((size * share) / S.n);
function drawSizes() {
  $('sizes').innerHTML = SIZES.map(([what, size, share]) => {
    const c = cellFor(size, share);
    if (c < 1) return `<tr><td>${what}</td><td class="num">${size}</td><td colspan="2">格数比像素多，一格不到 1 像素</td></tr>`;
    const rest = size - c * S.n, a = Math.floor(rest / 2), b = rest - a;
    return `<tr><td>${what}</td><td class="num">${size}×${size}</td><td class="num">${c}×${c} px</td><td class="num">${a === b ? a : a + ' / ' + b} px</td></tr>`;
  }).join('');
}

// ── icons ───────────────────────────────────────────────────────────────────
// size × size, the grid drawn at `cell` px per cell and centred; below 1px a
// cell, the grid is smoothed down instead.
function icon(size, cell, white) {
  const n = S.n, [r, g, b] = rgb();
  const small = document.createElement('canvas'); small.width = small.height = n;
  const sg = small.getContext('2d'), img = sg.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = S.grid[i]; }
  sg.putImageData(img, 0, 0);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d');
  if (white) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, size, size); }
  const side = cell >= 1 ? cell * n : size, off = Math.floor((size - side) / 2);
  c.imageSmoothingEnabled = cell < 1;
  c.drawImage(small, off, off, side, side);
  return cv;
}

function drawPreviews() {
  const row = $('prev-row'); row.innerHTML = '';
  const add = (label, cv, cssSize, wrap) => {
    const box = document.createElement('div'); box.className = 'prev';
    cv.style.width = cv.style.height = cssSize + 'px';
    const frame = wrap(cv);
    box.append(frame);
    const cap = document.createElement('span'); cap.textContent = label; box.append(cap);
    row.append(box);
  };
  const tab = (cls) => (cv) => { const t = document.createElement('div'); t.className = 'tab ' + cls; t.append(cv, document.createTextNode('Mahjoffg')); return t; };
  const solid = (bg, cls = '') => (cv) => { const f = document.createElement('div'); f.className = 'frame ' + cls; f.style.background = bg; f.append(cv); return f; };
  add('标签栏 · 浅色', icon(32, cellFor(32, 1), false), 16, tab('light'));
  add('标签栏 · 深色', icon(32, cellFor(32, 1), false), 16, tab('dark'));
  add('iPhone 主屏幕（透明处是黑）', icon(180, cellFor(180, 1), false), 90, solid('#000', 'ios'));
  add('安卓 maskable · 圆形', icon(192, cellFor(192, 0.75), false), 96, solid('#fff', 'round'));
  add('16 px 放大 6 倍', icon(16, cellFor(16, 1), false), 96, solid(css('--check-a')));
}

// ── export ──────────────────────────────────────────────────────────────────
function exportInfo() {
  const size = +$('ex-size').value || 0;
  if (!S.exCellTouched) $('ex-cell').value = Math.max(1, Math.floor(size / S.n));
  const c = +$('ex-cell').value || 0, side = c * S.n;
  $('ex-info').textContent = side > size
    ? `${S.n} 格 × ${c} px = ${side} px，比 ${size} 大，会被裁掉。`
    : `${size}×${size}，每格 ${c}×${c} px，四周留白 ${size - side} px（两边各一半）。`;
}
function download() {
  const size = Math.min(2048, Math.max(8, +$('ex-size').value || 512)), c = Math.max(1, +$('ex-cell').value || 1);
  icon(size, c, $('ex-white').checked).toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mahjoffg-mosaic-${S.n}x${S.n}-${size}.png`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

// ── hover + paint ───────────────────────────────────────────────────────────
function cellAt(e) {
  const r = gridCv.getBoundingClientRect(), n = S.n;
  const cx = Math.floor(((e.clientX - r.left) / r.width) * n), cy = Math.floor(((e.clientY - r.top) / r.height) * n);
  return cx >= 0 && cy >= 0 && cx < n && cy < n ? cy * n + cx : -1;
}
function showHover(i) {
  const h = $('hover');
  if (i < 0) { h.textContent = '把鼠标移到某一格上，看它的位置和数值。'; return; }
  const n = S.n, cx = i % n, cy = Math.floor(i / n), v = S.grid[i], [r, g, b] = rgb();
  const c180 = cellFor(180, 1), o180 = Math.floor((180 - c180 * n) / 2);
  const where = c180 >= 1 ? `；在 iPhone 图标里是从 (${o180 + cx * c180}, ${o180 + cy * c180}) 开始的 ${c180}×${c180} 像素` : '';
  h.innerHTML = `第 <b>${cy + 1}</b> 行第 <b>${cx + 1}</b> 列 · 深浅 <b>${v}</b>（${Math.round((v / 255) * 100)}%）` +
    (v ? ` · rgba(${r}, ${g}, ${b}, ${(v / 255).toFixed(2)})` : ' · 空白') + where +
    (S.edits.has(i) ? ' · 手画' : '');
}
let painting = false;
function paintAt(i) {
  if (i < 0) return;
  const v = S.mode === 'erase' ? 0 : +$('brush').value;
  if (v === quantise(S.base[i])) S.edits.delete(i); else S.edits.set(i, v);
  compose(); drawGrid(); showHover(i);
}
gridCv.addEventListener('pointerdown', (e) => {
  if (S.mode === 'look') return;
  painting = true; gridCv.setPointerCapture(e.pointerId); paintAt(cellAt(e));
});
gridCv.addEventListener('pointermove', (e) => {
  const i = cellAt(e);
  if (painting) { paintAt(i); return; }
  if (i !== S.hover) { S.hover = i; drawGrid(); showHover(i); }
});
const endPaint = () => { if (painting) { painting = false; drawStats(); drawPreviews(); editNote(); } };
gridCv.addEventListener('pointerup', endPaint);
gridCv.addEventListener('pointercancel', endPaint);
gridCv.addEventListener('pointerleave', () => { if (!painting) { S.hover = -1; drawGrid(); showHover(-1); } });

function editNote() {
  $('edit-note').textContent = S.edits.size
    ? `有 ${S.edits.size} 格是手画的。改上面任何参数都会重新采样，这些修改会被清掉。`
    : '改上面任何参数都会重新采样，手画的修改会被清掉。';
}

// ── controls ────────────────────────────────────────────────────────────────
function seg(ids, key, onPick) {
  for (const id of ids) $(id).addEventListener('click', () => {
    for (const other of ids) { $(other).classList.toggle('on', other === id); $(other).setAttribute('aria-pressed', String(other === id)); }
    S[key] = id.split('-')[1]; onPick();
  });
}
seg(['mode-look', 'mode-paint', 'mode-erase'], 'mode', () => {
  document.querySelector('.board').classList.toggle('painting', S.mode !== 'look');
});
seg(['bg-checker', 'bg-white', 'bg-dark', 'bg-black'], 'bg', drawGrid);
$('brush').addEventListener('input', () => { $('brush-out').textContent = $('brush').value; });

function syncOutputs() {
  $('n-out').textContent = S.n;
  $('w').max = S.n; $('w-out').textContent = S.w;
  $('track-out').textContent = (S.track < 0 ? '−' : '') + Math.abs(S.track).toFixed(2);
  $('color-out').textContent = S.color.toUpperCase();
  $('levels-out').textContent = S.levels >= 256 ? '不分档' : `${S.levels} 档`;
  $('hex').textContent = S.color.toUpperCase();
  $('sw').style.background = S.color;
}
$('n').addEventListener('input', () => {
  const n = +$('n').value, ratio = S.w / S.n;
  S.n = n; S.w = Math.max(1, Math.min(n, Math.round(ratio * n)));
  $('w').max = n; $('w').value = S.w; syncOutputs(); resample(); exportInfo();
});
$('w').addEventListener('input', () => { S.w = +$('w').value; syncOutputs(); resample(); });
$('track').addEventListener('input', () => { S.track = +$('track').value; syncOutputs(); resample(); });
$('text').addEventListener('input', () => { S.text = $('text').value; resample(); });
$('color').addEventListener('input', () => { S.color = $('color').value; syncOutputs(); drawAll(); });
$('levels').addEventListener('input', () => { S.levels = +$('levels').value; syncOutputs(); resample(); });
$('vals').addEventListener('change', () => { S.vals = $('vals').checked; drawGrid(); });
$('pct').addEventListener('change', () => { S.pct = $('pct').checked; drawAll(); });
$('reset').addEventListener('click', () => {
  Object.assign(S, DEFAULTS);
  $('n').value = S.n; $('w').max = S.n; $('w').value = S.w; $('track').value = S.track; $('text').value = S.text;
  $('color').value = S.color; $('levels').value = S.levels;
  S.exCellTouched = false; syncOutputs(); resample(); exportInfo();
});
$('copy').addEventListener('click', async () => {
  const n = S.n, rows = [];
  for (let y = 0; y < n; y++) rows.push('  [' + [...S.grid.subarray(y * n, y * n + n)].join(', ') + ']');
  const text = `{\n "cells": ${n},\n "color": "${S.color.toUpperCase()}",\n "alpha": [\n${rows.join(',\n')}\n ]\n}\n`;
  const btn = $('copy');
  try { await navigator.clipboard.writeText(text); btn.textContent = '已复制'; }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); btn.textContent = '已复制'; } catch { btn.textContent = '复制失败'; }
    ta.remove();
  }
  setTimeout(() => { btn.textContent = '复制格子数据'; }, 1600);
});
$('ex-size').addEventListener('input', exportInfo);
$('ex-cell').addEventListener('input', () => { S.exCellTouched = true; exportInfo(); });
$('ex-go').addEventListener('click', download);

function drawAll() { drawGrid(); drawStats(); drawSizes(); drawPreviews(); editNote(); showHover(S.hover); }
let resizeT = 0;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(drawAll, 80); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawAll);

// ── start ───────────────────────────────────────────────────────────────────
// Until the font is in, show the live grid itself so the page is never empty.
S.base = Uint8Array.from(LIVE); compose(); syncOutputs(); drawAll(); exportInfo();
(async () => {
  try {
    const face = new FontFace('Mark', 'url(InterDisplay-SemiBold.woff2)', { weight: '600' });
    document.fonts.add(await face.load());
    S.fontOk = true;
    resample();
  } catch (e) {
    $('hover').textContent = '字体没有加载成功，现在显示的是线上图标的格子；改参数需要字体。';
  }
})();
