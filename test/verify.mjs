/**
 * Zero-dependency DOM/render verification for mahjoffg.com.
 *
 * The page is one thing: a WebGL2 gradient field filling the viewport, with a
 * grain overlay on top. No text, no panels, no pointer reactivity. So the
 * checks are mostly geometry (does it actually cover the screen, at the aspect
 * it is drawn at) and framebuffer readbacks (is it a smooth diffuse gradient
 * in the intended palette). Nothing here can look at a screenshot, so every
 * claim is a measurement.
 *
 * Drives headless Chrome over the DevTools Protocol using Node's built-in
 * WebSocket (Node >= 21).
 *
 *   python3 -m http.server 8788 --bind 127.0.0.1 &
 *   node test/verify.mjs [http://127.0.0.1:8788]
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

const results = [];
const check = (name, cond, detail = '') => results.push({ pass: !!cond, name, detail });

/* colour maths for judging framebuffer readbacks in node */
const lin = v => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function hue([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    h = (mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
    if (h < 0) h += 360;
  }
  return { h, c: d };
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) this.events.push(msg);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.delete(id)) reject(new Error('CDP timeout: ' + method)); }, 30000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('page eval threw: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
}

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
        return new CDP(ws);
      }
    } catch {}
    await sleep(250);
  }
  throw new Error('could not attach to Chrome');
}

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  // the field is WebGL2; there is no GPU here, so render it in software
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--user-data-dir=' + (process.env.TMPDIR || '/tmp') + '/mahjoffg-verify-profile',
  'about:blank',
], { stdio: 'ignore' });

let exitCode = 0;
try {
  const cdp = await connect();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');

  async function load(width, height, mobile = false, reducedMotion = false, screen = null, test = '1') {
    cdp.events.length = 0;
    const metrics = { width, height, deviceScaleFactor: 2, mobile };
    // a screen taller than the viewport is what a phone looks like with the
    // browser toolbars taking a slice off the bottom
    if (screen) { metrics.screenWidth = screen[0]; metrics.screenHeight = screen[1]; }
    await cdp.send('Emulation.setDeviceMetricsOverride', metrics);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }],
    });
    // ?test=1 asks the page for preserveDrawingBuffer, so readPixels returns
    // the frame that was actually shown rather than an emptied buffer.
    // ?test=mask does that and paints the edge fade in place of the picture.
    await cdp.send('Page.navigate', { url: BASE + '/index.html?test=' + test });
    for (let i = 0; i < 60; i++) {
      if (await cdp.eval(`document.readyState === 'complete'`).catch(() => false)) break;
      await sleep(100);
    }
    await sleep(600);
  }
  const consoleErrors = () => cdp.events
    .filter(e => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
    .map(e => e.params.entry.text);
  const failedRequests = () => cdp.events
    .filter(e => e.method === 'Network.responseReceived' && e.params.response.status >= 400)
    .map(e => e.params.response.status + ' ' + e.params.response.url);

  /* geometry of the canvas against the viewport it has to fill */
  const coverage = () => cdp.eval(`(() => {
    const el = document.getElementById('field'), r = el.getBoundingClientRect();
    const g = document.querySelector('.grain').getBoundingClientRect();
    return { l: r.left, t: r.top, w: r.width, h: r.height,
             grainW: g.width, grainH: g.height,
             vw: innerWidth, vh: innerHeight,
             docW: document.documentElement.scrollWidth,
             docH: document.documentElement.scrollHeight,
             clientH: document.documentElement.clientHeight,
             store: window.__field ? window.__field.info() : null };
  })()`);

  function checkCoverage(label, c) {
    check(`${label}: field starts at the viewport origin`,
      c.l <= 0.5 && c.t <= 0.5, `left ${c.l}, top ${c.t}`);
    check(`${label}: field reaches both far edges`,
      c.l + c.w >= c.vw - 0.5 && c.t + c.h >= c.vh - 0.5,
      `covers ${c.w}×${c.h} of ${c.vw}×${c.vh}`);
    check(`${label}: grain overlay covers the same box`,
      Math.abs(c.grainW - c.w) <= 1 && Math.abs(c.grainH - c.h) <= 1,
      `${c.grainW}×${c.grainH} vs ${c.w}×${c.h}`);
    // a backing store cut to a different aspect than the box it is stretched
    // into is a visibly distorted field, and it is invisible in a DOM dump
    const boxAR = c.w / c.h, storeAR = c.store.W / c.store.H;
    check(`${label}: field is not stretched (backing store matches its box)`,
      Math.abs(boxAR - storeAR) / boxAR < 0.02,
      `box ${boxAR.toFixed(3)} vs store ${storeAR.toFixed(3)} (${c.store.W}×${c.store.H})`);
    check(`${label}: nothing scrolls`,
      c.docW <= c.vw + 1 && c.docH <= c.clientH + 1,
      `doc ${c.docW}×${c.docH}, viewport ${c.vw}×${c.clientH}`);
  }

  const toneObservations = [];
  async function checkField(label) {
    // The field drifts, and a phone shows a small window of it, so the hue
    // balance at any one instant is a sample of one. Pool several moments and
    // judge the average — the claim is about the field, not about a frame.
    const samples = [];
    for (let i = 0; i < 4; i++) {
      if (i) await sleep(1200);
      samples.push(await cdp.eval(`window.__field.grid(0, 0, innerWidth, innerHeight, 26, 16)`));
    }
    const field = samples[0];
    const Ls = field.map(lum);
    check(`${label}: a gradient, not a flat wash`,
      Math.max(...Ls) - Math.min(...Ls) > 0.06,
      'luminance spread ' + (Math.max(...Ls) - Math.min(...Ls)).toFixed(3));

    const step = await cdp.eval(`window.__field.steps()`);
    check(`${label}: bleeds seamlessly (no hard edges)`,
      step.p999 <= 6 && step.max <= 10,   // ~4% of full range: a fast ramp, not an edge
      `p99.9 ${step.p999}/255, max ${step.max}/255 over ${step.n.toLocaleString()} pairs`);

    // below ~0.18 chroma a cell is near-neutral and its hue is mostly noise
    const cells = samples.flat().map(hue);
    const chromatic = cells.filter(x => x.c > 0.18);
    const total = samples.length * field.length;
    const band = (lo, hi) => chromatic.filter(p => p.h >= lo && p.h < hi).length / total;
    const yellow = band(30, 68), green = band(68, 168), blue = band(168, 258);
    const bal = `yellow ${(yellow*100).toFixed(0)}%  blue ${(blue*100).toFixed(0)}%  green ${(green*100).toFixed(0)}%`
              + ` (mean of ${samples.length} moments)`;
    check(`${label}: keeps a blue-sky palette`, blue > 0.18, bal);
    check(`${label}: contains no yellow or green cast`,
      yellow < 0.01 && green < 0.01, bal);
    // Judge white only in the interior; the required white edge fade is not
    // cloud content and must not make this check pass by itself.
    const interior = samples.flatMap(sample => sample.filter((_, i) => {
      const x = i % 26, y = Math.floor(i / 26);
      return x >= 3 && x < 23 && y >= 2 && y < 14;
    }));
    const blankWhite = interior.filter(p => lum(p) > 0.72 && hue(p).c < 0.18).length / interior.length;
    check(`${label}: no large blank-white interior patch`,
      blankWhite < 0.10, `blank-white interior ${(blankWhite*100).toFixed(0)}%`);
    // Two exhaustive tone buckets. The former soft-sky source and its mask
    // are gone; intermediate pixels are only the smooth edge of blue-white
    // ribbons and belong to the deep-blue ground rather than a third layer.
    const blueWhite = interior.filter(p => lum(p) >= 0.60).length / interior.length;
    const deepBlue = 1 - blueWhite;
    const toneBalance = `deep ${(deepBlue*100).toFixed(0)}%, blue-white ${(blueWhite*100).toFixed(0)}%`;
    toneObservations.push({ deepBlue, blueWhite });
    // A moving ribbon field sampled through a narrow crop naturally fluctuates by a
    // few points. Keep each crop close, then enforce the exact art-direction
    // ranges on the pooled desktop/phone/tablet field below.
    check(`${label}: tone crop stays near the prescribed balance`,
      deepBlue >= 0.80 && deepBlue <= 0.95 &&
      blueWhite >= 0.05 && blueWhite <= 0.20,
      toneBalance);
    check(`${label}: never out-saturates its own source colours`,
      Math.max(...cells.map(p => p.c)) <= 0.80,
      'max chroma ' + Math.max(...cells.map(p => p.c)).toFixed(2));
  }

  /* ================= DESKTOP ================= */
  await load(1440, 900);

  check('desktop: no console errors', consoleErrors().length === 0, consoleErrors().join(' | '));
  check('desktop: no failed requests', failedRequests().length === 0, failedRequests().join(' | '));
  check('title is still the brand name', await cdp.eval(`document.title`) === 'Mahjoffg');

  /* everything but the backdrop is gone */
  const stripped = await cdp.eval(`(() => ({
    text: document.body.innerText.trim(),
    glass: document.querySelectorAll('.glass, .hero').length,
    nav: document.querySelectorAll('nav, main, .brand').length,
    cursor: document.querySelectorAll('.cursor-light, .aurora, .orb').length,
    // Cloudflare injects its bot-management script and a hidden 1×1 iframe on
    // the live origin, so judge only what actually paints
    elements: [...document.body.children]
      .filter(el => el.tagName !== 'SCRIPT')
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; })
      .map(el => el.tagName + (el.className ? '.' + el.className : '')),
    fonts: [...document.querySelectorAll('link[href*="fonts."], style')].some(
      el => /fonts\\.googleapis/.test(el.href || el.textContent || '')),
  }))()`);
  check('page renders no text at all', stripped.text === '', JSON.stringify(stripped.text));
  check('the glass panel is gone', stripped.glass === 0, stripped.glass + ' found');
  check('nav, main and wordmark are gone', stripped.nav === 0, stripped.nav + ' found');
  check('cursor light and the old aurora layers are gone', stripped.cursor === 0, stripped.cursor + ' found');
  check('body holds only the canvas and the grain',
    stripped.elements.join(', ') === 'CANVAS, DIV.grain', stripped.elements.join(', '));
  check('no webfont request remains (nothing renders type)', !stripped.fonts);

  const live = await cdp.eval(`(() => ({
    live: !!window.__field,
    fallback: document.documentElement.classList.contains('no-webgl'),
    grainBlend: getComputedStyle(document.querySelector('.grain')).mixBlendMode,
    grainOpacity: getComputedStyle(document.querySelector('.grain')).opacity,
  }))()`);
  check('field shader is running (no fallback)', live.live && !live.fallback, JSON.stringify(live));
  check('grain overlay is present',
    live.grainBlend === 'overlay' && live.grainOpacity === '0.055', JSON.stringify(live));
  const shaderSource = await cdp.eval(`[...document.scripts].map(s => s.textContent).join('\\n')`);
  check('the separate light-blue layer is removed',
    !/SKY_SOFT|softCloud/.test(shaderSource));

  checkCoverage('desktop', await coverage());
  await checkField('desktop');

  /* ================= PHONE AND TABLET ================= */
  for (const [w, h, name] of [[390, 844, 'iphone 390×844'], [360, 740, 'android 360×740'], [768, 1024, 'tablet 768×1024']]) {
    await load(w, h, true);
    check(`${name}: no console errors`, consoleErrors().length === 0, consoleErrors().join(' | '));
    checkCoverage(name, await coverage());
    await checkField(name);
  }

  /* ================= PHONE WITH TOOLBARS SHOWING =================
     The reported bug: a fixed layer is sized against the small viewport and
     leaves a strip along the bottom once the toolbars retract. Here the
     viewport is 745 tall while the screen is 844 — the state the page is in
     before anything retracts — so the cover layer has to already be 844. */
  await load(390, 745, true, false, [390, 844]);
  const bar = await cdp.eval(`(() => {
    const r = document.getElementById('field').getBoundingClientRect();
    const g = document.querySelector('.grain').getBoundingClientRect();
    return { h: Math.round(r.height), gh: Math.round(g.height), top: Math.round(r.top),
             vh: innerHeight, screenH: screen.height,
             store: window.__field.info(),
             docH: document.documentElement.scrollHeight,
             clientH: document.documentElement.clientHeight };
  })()`);
  check('toolbar case: field is already as tall as the screen, not the viewport',
    bar.h >= bar.screenH, `field ${bar.h}px, viewport ${bar.vh}px, screen ${bar.screenH}px`);
  check('toolbar case: grain covers the same extended box',
    bar.gh === bar.h, `${bar.gh} vs ${bar.h}`);
  check('toolbar case: the drawing buffer is cut to the extended box',
    Math.abs((bar.store.W / bar.store.H) - (390 / bar.h)) / (390 / bar.h) < 0.03,
    `store ${bar.store.W}×${bar.store.H} for a 390×${bar.h} box`);
  check('toolbar case: the taller layer does not make the page scroll',
    bar.docH <= bar.clientH + 1, `doc ${bar.docH}, viewport ${bar.clientH}`);
  await checkField('toolbar case');

  const meanTone = key => toneObservations.reduce((sum, x) => sum + x[key], 0) / toneObservations.length;
  const deepMean = meanTone('deepBlue');
  const blueWhiteMean = meanTone('blueWhite');
  const meanBalance = `deep ${(deepMean*100).toFixed(1)}%, blue-white ${(blueWhiteMean*100).toFixed(1)}%`;
  check('pooled field: deep blue stays within 85–90%',
    deepMean >= 0.85 && deepMean <= 0.90, meanBalance);
  check('pooled field: blue-white stays within 10–15%',
    blueWhiteMean >= 0.10 && blueWhiteMean <= 0.15, meanBalance);

  /* the layer must not shrink back when the viewport grows and shrinks again */
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
  await sleep(500);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 745, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
  await sleep(500);
  const held = await cdp.eval(`Math.round(document.getElementById('field').getBoundingClientRect().height)`);
  check('toolbar case: the layer never shrinks back below its tallest',
    held >= 844, held + 'px after the viewport grew then shrank');

  /* ================= BROWSER BAR TINT =================
     The bars a phone browser draws outside the page take their colour from
     theme-color. If it stays at its static default they read as flat bands
     cutting the gradient off, which looks like the page not filling the
     screen even when the canvas covers every pixel of it. */
  await load(390, 745, true, false, [390, 844]);
  const tint = await cdp.eval(`(() => {
    const m = document.querySelector('meta[name="theme-color"]');
    // The seam is at the edges of the VISIBLE band — the canvas runs the full
    // screen height and its own bottom rows are hidden behind the URL bar.
    const w = document.getElementById('field').getBoundingClientRect().width;
    return { content: m && m.getAttribute('content'),
             bodyBgComputed: getComputedStyle(document.body).backgroundColor,
             topRow:    window.__field.grid(0, 0, w, 3, 10, 1),
             bottomRow: window.__field.grid(0, innerHeight - 3, w, 3, 10, 1),
             leftCol:   window.__field.grid(0, 0, 3, innerHeight, 1, 10),
             rightCol:  window.__field.grid(w - 3, 0, 3, innerHeight, 1, 10) };
  })()`);
  check('theme-color is the browser white the bars already paint',
    (tint.content || '').toLowerCase() === '#ffffff', tint.content);
  check('the page ground is that same white',
    /^(rgb\(255,\s*255,\s*255\)|#fff(fff)?|white)$/i.test(tint.bodyBgComputed || ''), tint.bodyBgComputed);

  const t = [255, 255, 255];
  const worst = (row) => Math.max(...row.map(p => Math.max(...[0,1,2].map(i => Math.abs(p[i] - t[i])))));
  const spreadOf = (row) => Math.max(...[0,1,2].map(i =>
    Math.max(...row.map(p => p[i])) - Math.min(...row.map(p => p[i]))));

  // all four edges dissolve into the ground; top and bottom also carry the
  // join with the browser's own bars
  for (const [name, row] of [['top', tint.topRow], ['bottom', tint.bottomRow],
                             ['left', tint.leftCol], ['right', tint.rightCol]]) {
    check(`${name} edge of the picture has reached the ground white`,
      worst(row) <= 6, `worst channel off by ${worst(row)}/255`);
    check(`${name} edge is flat along its length, not a ramp meeting the ground`,
      spreadOf(row) <= 5, `spread ${spreadOf(row)}`);
  }

  // the colour must still be there in the middle — a fade that swallowed the
  // picture would pass every check above
  const mid = await cdp.eval(`(() => { const w = document.getElementById('field').getBoundingClientRect().width;
    return window.__field.grid(0, innerHeight * 0.3, w, innerHeight * 0.4, 8, 8); })()`);
  const midChroma = Math.max(...mid.map(p => (Math.max(...p) - Math.min(...p)) / 255));
  check('the palette still blooms in the middle of the screen',
    midChroma > 0.20, `peak chroma ${midChroma.toFixed(2)} between 30% and 70% of the height`);

  /* ================= CORNERS =================
     Every check above samples edge MIDLINES, and all of them passed while the
     picture still ended in a square vertex aimed down each 45-degree diagonal.
     The fade used to take min() over the four edge distances, which is a
     Chebyshev field — its contours are rectangles, so a point on a corner
     diagonal was faded by the nearer edge only, exactly as if the other were
     not there. Measured at 1440x900, the boundary ran dead straight at 32.8px
     from each edge and turned the whole 90 degrees at a single point 46.7px
     from the corner, on all four corners.

     Each edge now dissolves the picture independently and the four veils
     multiply, which gives the law asserted here: the mask at a corner is the
     PRODUCT of the two edges' masks at the same depth. min() would give their
     minimum instead — 0.483 where the product is 0.233, twelve times the
     tolerance below, so this cannot silently come back.

     ?test=mask paints the mask itself, so these are exact numbers: no field
     colour to see through, and no need to pool several moments. */
  for (const [label, vw, vh] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
    await load(vw, vh, vw < 500, false, null, 'mask');
    const probe = await cdp.eval(`(() => {
      const v = (x, y) => window.__field.grid(x, y, 1, 1, 1, 1)[0][0] / 255;
      const W = innerWidth, H = innerHeight;
      // a third of the way through the fade, where the curve is steep and a
      // wrong shape has nowhere to hide. The two axes differ on a phone: the
      // fade is capped at 18% of each one, so 390px wide gives 70px not 96px.
      const dx = Math.min(96, W * 0.18) / 3, dy = Math.min(96, H * 0.18) / 3;
      return {
        dx, dy,
        left: v(dx, H / 2), right: v(W - dx, H / 2),
        top:  v(W / 2, dy), bottom: v(W / 2, H - dy),
        corners: {
          'top-left':     [v(dx, dy),         'left',  'top'],
          'top-right':    [v(W - dx, dy),     'right', 'top'],
          'bottom-left':  [v(dx, H - dy),     'left',  'bottom'],
          'bottom-right': [v(W - dx, H - dy), 'right', 'bottom'],
        },
      };
    })()`);
    // An emptied drawing buffer reads as all zeros, and 0 === 0 * 0, so the
    // product law below would be satisfied by no picture at all. Refuse to
    // judge the frame unless the mask is actually present first.
    check(`${label}: the mask readback is a real frame, not an empty buffer`,
      [probe.left, probe.right, probe.top, probe.bottom].every(x => x > 0.30 && x < 0.65),
      `edge masks ${[probe.left, probe.right, probe.top, probe.bottom].map(x => x.toFixed(3)).join(' / ')}`);
    for (const [corner, [got, ea, eb]] of Object.entries(probe.corners)) {
      const a = probe[ea], b = probe[eb];
      check(`${label} ${corner}: the corner is faded by both its edges`,
        Math.abs(got - a * b) <= 0.02,
        `mask ${got.toFixed(3)}, edges ${a.toFixed(3)} x ${b.toFixed(3)} = ${(a * b).toFixed(3)}`);
      check(`${label} ${corner}: no square vertex pointing down the diagonal`,
        Math.min(a, b) - got >= 0.15,
        `mask ${got.toFixed(3)} vs ${a.toFixed(3)} / ${b.toFixed(3)} at the same depth`);
    }
    // A fade that had simply grown would pass both checks above by swallowing
    // the corners, so pin the single-edge curve too. Measure where it reaches
    // half rather than its value at a fixed depth: grid() rounds its sample to
    // whole device pixels, and on this curve one pixel of position is 0.02 of
    // value — enough to make a fixed-depth reading look asymmetric when only
    // the rounding differs. A crossing found by interpolation is not sensitive
    // to that. pow(smoothstep(k), 2.2) = 0.5 at k = 0.658, so the half point
    // sits 0.342 of the way in from the edge, and always has.
    const half = await cdp.eval(`(() => {
      const W = innerWidth, H = innerHeight;
      const fx = Math.min(96, W * 0.18), fy = Math.min(96, H * 0.18);
      const strip = (x, y, w, h, n, vertical) =>
        window.__field.grid(x, y, w, h, vertical ? 1 : n, vertical ? n : 1).map(p => p[0] / 255);
      // depth, in css px from the edge, at which the mask passes 0.5
      const cross = (vals, span) => {
        for (let i = 1; i < vals.length; i++)
          if (vals[i - 1] < 0.5 && vals[i] >= 0.5)
            return (i - 1 + (0.5 - vals[i - 1]) / (vals[i] - vals[i - 1])) * span / vals.length;
        return NaN;
      };
      const n = 96;
      return {
        fx, fy,
        left:   cross(strip(0,      H / 2, fx, 1, n, false), fx),
        right:  cross(strip(W - fx, H / 2, fx, 1, n, false).reverse(), fx),
        top:    cross(strip(W / 2, 0,      1, fy, n, true), fy),
        bottom: cross(strip(W / 2, H - fy, 1, fy, n, true).reverse(), fy),
      };
    })()`);
    const wantX = half.fx * 0.342, wantY = half.fy * 0.342;
    const found = [half.left, half.right, half.top, half.bottom].every(Number.isFinite);
    const off = !found ? [Infinity] :
      [[half.left, wantX], [half.right, wantX],
       [half.top, wantY], [half.bottom, wantY]].map(([g, w]) => Math.abs(g - w));
    const px = v => Number.isFinite(v) ? v.toFixed(1) : 'not found';
    check(`${label}: the single-edge fade curve is where it was`,
      found && off.every(d => d <= 1.5),
      `half point L ${px(half.left)} R ${px(half.right)} ` +
      `T ${px(half.top)} B ${px(half.bottom)}px, ` +
      `expected ${wantX.toFixed(1)} / ${wantY.toFixed(1)}px`);
  }

  /* ================= POINTER IS INERT ================= */
  // With motion suppressed the clock is frozen, so any change in the frame
  // after a pointer sweep could only have come from the pointer.
  await load(1440, 900, false, true);
  const before = await cdp.eval(`window.__field.hash()`);
  const after = await cdp.eval(`(async () => {
    for (const [x, y] of [[80, 80], [700, 200], [1300, 820], [400, 600]]) {
      dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
    }
    await new Promise(r => setTimeout(r, 400));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return window.__field.hash();
  })()`);
  check('pointer does not move the field', before === after, `${before} → ${after}`);
  const residue = await cdp.eval(`(() => ({
    cursorVar: document.documentElement.style.getPropertyValue('--cursor-x'),
    pointingClass: document.body.className,
  }))()`);
  check('no pointer state is written to the page',
    residue.cursorVar === '' && residue.pointingClass === '', JSON.stringify(residue));

  /* ================= REDUCED MOTION ================= */
  const rmClock = await cdp.eval(`window.__field.info().clock`);
  check('reduced motion: the field reports itself frozen',
    await cdp.eval(`window.__field.info().reduced`) === true);
  await sleep(900);
  check('reduced motion: the clock does not advance',
    (await cdp.eval(`window.__field.info().clock`)) === rmClock, `${rmClock} held`);
  const frozen = await cdp.eval(`window.__field.grid(0, 0, innerWidth, innerHeight, 10, 6)`);
  check('reduced motion: the still frame is still a full gradient',
    Math.max(...frozen.map(lum)) - Math.min(...frozen.map(lum)) > 0.04,
    'spread ' + (Math.max(...frozen.map(lum)) - Math.min(...frozen.map(lum))).toFixed(3));

} catch (err) {
  check('harness', false, err.message);
  exitCode = 1;
} finally {
  chrome.kill('SIGKILL');
}

const passed = results.filter(r => r.pass).length;
for (const r of results) console.log(`${r.pass ? '  ok  ' : ' FAIL '} ${r.name}${r.detail ? '   → ' + r.detail : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length && !exitCode ? 0 : 1);
