/**
 * Bundles index.html into one self-contained file for previewing somewhere
 * that can only take a single file. Deploy the normal index.html instead —
 * this exists only so the page can be handed around as one attachment.
 *
 *   node build/inline.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let out = readFileSync(join(root, 'index.html'), 'utf8');

// inline the screenshot favicon, drop the raster links, so the single file resolves
// every request it makes (no implicit /favicon.ico 404)
const favicon = readFileSync(join(root, 'sky-logo-20260824.png'));
const faviconUri = 'data:image/png;base64,' + favicon.toString('base64');
out = out.replace(/\n\s*<link rel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*\/?>/g, '');
out = out.replace('</title>', `</title>\n  <link rel="icon" type="image/png" href="${faviconUri}" />`);

// the wordmark mask is only used by the archived painting version; inline it
// if the page happens to reference it
if (out.includes('url("wordmark-mask.png")') && existsSync(join(root, 'wordmark-mask.png'))) {
  const mask = readFileSync(join(root, 'wordmark-mask.png'));
  out = out.replaceAll('url("wordmark-mask.png")', `url("data:image/png;base64,${mask.toString('base64')}")`);
}

if (/(?:src|href)="(?!https:|data:)[^"]+"/.test(out.replace(/<link rel="icon"[^>]*>/, ''))) {
  console.warn('warning: page still references a local file');
}

mkdirSync(join(root, 'build'), { recursive: true });
const dest = join(root, 'build', 'mahjoffg-standalone.html');
writeFileSync(dest, out);
console.log(`wrote ${dest} (${(out.length / 1024).toFixed(1)} KB)`);
