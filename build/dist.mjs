/**
 * Assembles the exact set of files that get deployed, and nothing else.
 *
 * The project directory also holds a README, tests, the standalone build, the
 * archived painting version and its mask, and the source art. None of that
 * belongs on the public site, so deploying the directory itself would leak
 * all of it — always deploy `dist/`.
 *
 *   node build/dist.mjs
 *   npx wrangler pages deploy dist --project-name=mahjoffg
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const ICON = 'mahjoffg-mosaic-blue-20261030b';
const SHIP = ['index.html', 'manifest.webmanifest',
  ...['16', '32', 'apple-180', '192', '512', 'maskable-192', 'maskable-512'].map(s => `${ICON}-${s}.png`)];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const f of SHIP) writeFileSync(join(dist, f), readFileSync(join(root, f)));

// every local reference in index.html must be one of the shipped files
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(?!https:|data:|mailto:|#)([^"]+)"/g)].map(m => m[1]);
const missing = refs.filter(r => !SHIP.includes(r.replace(/^\.\//, '')));
if (missing.length) throw new Error('index.html references files not in dist: ' + missing.join(', '));

// and so must every icon the manifest names
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
const missingIcons = manifest.icons.map(i => i.src).filter(r => !SHIP.includes(r));
if (missingIcons.length) throw new Error('manifest references files not in dist: ' + missingIcons.join(', '));
const unused = SHIP.filter(f => f !== 'index.html' && !refs.includes(f) && !manifest.icons.some(i => i.src === f));
if (unused.length) throw new Error('shipped but referenced by nothing: ' + unused.join(', '));

console.log('dist/ contains:', readdirSync(dist).sort().join(', '));
console.log('local refs in index.html:', refs.length ? refs.join(', ') : '(none besides fonts)');
