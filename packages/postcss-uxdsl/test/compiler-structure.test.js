'use strict';

// Stability phase 3 (audit L21): the plugin's `Once()` is a sequence of named
// steps over one per-compilation object — nothing is stored on the PostCSS
// root or on the plugin instance — and the sources describe behavior, not
// the history of the stories that produced them (the CHANGELOG has that).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');

const exported = require('../dist/index');
const plugin = exported.default || exported;

const SRC = path.resolve(__dirname, '../src');
const index = fs.readFileSync(path.join(SRC, 'index.ts'), 'utf8');

test('Once() is the sequence of named steps, over one Compilation object', () => {
  const once = index.match(/Once\(root: Root, \{ result \}: \{ result: Result \}\) \{([\s\S]*?)\n    \},/);
  assert.ok(once, 'Once() is found');
  const calls = [...once[1].matchAll(/\b(\w+)\((compilation|root, result, opts)\)/g)].map((match) => match[1]);
  assert.deepEqual(calls, ['validateOptions', 'emitTheme', 'expandDirectives', 'resolveVariables', 'expandResponsive', 'rejectLeftoverDirectives', 'checkReferences']);
  assert.ok(once[1].trim().split('\n').length <= 8, 'Once() only sequences the steps');
  for (const step of calls) assert.match(index, new RegExp(`^function ${step}\\(`, 'm'), `${step} is a top-level function`);
  assert.match(index, /^interface Compilation \{/m);
});

test('no state on the PostCSS root, and no history tags in the sources', () => {
  assert.doesNotMatch(index, /\(root as any\)|root\.__|\broot\[['"]__/);
  // Phase 5 owns ds-runtime/contrast.ts and theme/base.contrast-exceptions.json.
  const owned = (file) => !/ds-runtime[\\/]contrast\.ts$|base\.contrast-exceptions\.json$/.test(file);
  const files = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|json)$/.test(e.name) && owned(p)) files.push(p); } };
  walk(SRC);
  walk(path.resolve(__dirname, '../../uxdsl-core/src'));
  const tagged = files.flatMap((file) => fs.readFileSync(file, 'utf8').split('\n').map((line, i) => [file, i + 1, line]))
    .filter(([, , line]) => /\b(MIG-[A-Z0-9]|FEAT-\d)/.test(line))
    .map(([file, line]) => `${path.relative(SRC, file)}:${line}`);
  assert.deepEqual(tagged, []);
});

test('one plugin instance compiles two stylesheets with two themes independently', () => {
  const instance = plugin({ discoverTheme: false, includeTheme: false });
  const a = postcss([plugin({ discoverTheme: false, includeTheme: false, theme: { breakpoints: { md: 900 } } })]).process('.a { padding: xs(1px) md(2px); }', { from: undefined }).css;
  const b = postcss([instance]).process('.a { padding: xs(1px) md(2px); }', { from: undefined }).css;
  const c = postcss([instance]).process('.b { padding: xs(1px) md(2px); }', { from: undefined }).css;
  assert.match(a, /min-width: 900px/);
  assert.match(b, /min-width: 768px/);
  assert.equal(c, b.replace('.a', '.b').replace('.a', '.b'));
});
