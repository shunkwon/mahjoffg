/**
 * Rule-level CSS diff between the reference demo and this page.
 *
 * The brief was "copy the demo exactly, only change the name and empty the
 * boxes", so this prints every CSS difference. Anything listed here should be
 * an intended consequence of that brief — if something else shows up, the
 * copy drifted.
 *
 *   node test/diff-reference.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REF = '/Users/yeleizh/glassmorphism-demo/index.html';

const styleOf = f => {
  const m = readFileSync(f, 'utf8').match(/<style>([\s\S]*?)<\/style>/);
  if (!m) throw new Error('no <style> block in ' + f);
  return m[1];
};

/** flatten to { selector -> declarations }, keeping @media scope in the key */
function rules(css) {
  const out = new Map();
  // strip comments
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const push = (scope, sel, body) => {
    const key = (scope ? scope + ' || ' : '') + sel.replace(/\s+/g, ' ').trim();
    const decls = body.split(';').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).sort().join('; ');
    out.set(key, decls);
  };
  // pull @media / @keyframes blocks out first (one level of nesting)
  const atRe = /@(media|keyframes)([^{]*)\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  let m;
  const nested = [];
  while ((m = atRe.exec(css))) nested.push(m);
  for (const n of nested) {
    const scope = ('@' + n[1] + n[2]).replace(/\s+/g, ' ').trim();
    const inner = n[3];
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let r;
    while ((r = ruleRe.exec(inner))) push(scope, r[1], r[2]);
  }
  const flat = css.replace(atRe, '');
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let r;
  while ((r = ruleRe.exec(flat))) {
    const sel = r[1].replace(/@import[^;]*;/g, '').trim();
    if (sel) push('', sel, r[2]);
  }
  return out;
}

const ref  = rules(styleOf(REF));
const mine = rules(styleOf(join(root, 'index.html')));

const removed = [...ref.keys()].filter(k => !mine.has(k));
const added   = [...mine.keys()].filter(k => !ref.has(k));
const changed = [...ref.keys()].filter(k => mine.has(k) && mine.get(k) !== ref.get(k));

console.log(`reference: ${ref.size} rules    this page: ${mine.size} rules\n`);
console.log(`— dropped from the demo (${removed.length}):`);
for (const k of removed) console.log('    ' + k);
console.log(`\n— not in the demo (${added.length}):`);
for (const k of added) console.log('    ' + k);
console.log(`\n— same selector, different declarations (${changed.length}):`);
for (const k of changed) {
  console.log('    ' + k);
  console.log('      demo: ' + ref.get(k));
  console.log('      mine: ' + mine.get(k));
}

const identical = [...ref.keys()].filter(k => mine.has(k) && mine.get(k) === ref.get(k)).length;
console.log(`\n${identical} rules byte-identical to the demo.`);
