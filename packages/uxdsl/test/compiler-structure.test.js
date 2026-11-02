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

const exported = require('../dist/plugin');
const plugin = exported.default || exported;

const SRC = path.resolve(__dirname, '../src');
const index = fs.readFileSync(path.join(SRC, 'plugin.ts'), 'utf8');

test('Once() is the sequence of named steps, over one Compilation object', () => {
  const once = index.match(/Once\(root: Root, \{ result \}: \{ result: Result \}\) \{([\s\S]*?)\n    \},/);
  assert.ok(once, 'Once() is found');
  const calls = [...once[1].matchAll(/\b(\w+)\((compilation|root, result, opts)\)/g)].map((match) => match[1]);
  assert.deepEqual(calls, ['validateOptions', 'rejectSassSyntax', 'emitTheme', 'expandDirectives', 'expandResponsive', 'rejectLeftoverDirectives', 'checkReferences']);
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
  const tagged = files.flatMap((file) => fs.readFileSync(file, 'utf8').split('\n').map((line, i) => [file, i + 1, line]))
    .filter(([, , line]) => /\b(MIG-[A-Z0-9]|FEAT-\d)/.test(line))
    .map(([file, line]) => `${path.relative(SRC, file)}:${line}`);
  assert.deepEqual(tagged, []);
});

test('MIG-B9-13: no source file holds a raw Unicode noncharacter; a character range that ends at U+FFFF is written \\uFFFF', () => {
  // U+FDD0–U+FDEF and every code point ending in FFFE or FFFF: invisible in an
  // editor and in a diff, and a tool that normalizes text may drop them.
  const noncharacters = (text) => {
    const found = [];
    let line = 1;
    let column = 1;
    for (const char of text) {
      const code = char.codePointAt(0);
      if ((code >= 0xfdd0 && code <= 0xfdef) || (code & 0xfffe) === 0xfffe) found.push(`${line}:${column} U+${code.toString(16).toUpperCase()}`);
      if (char === '\n') { line += 1; column = 1; } else column += char.length;
    }
    return found;
  };
  // Negative control: the scan reports each kind it looks for, where it is.
  const [ffff, fdd0, plane1] = [0xffff, 0xfdd0, 0x1fffe].map((code) => String.fromCodePoint(code));
  assert.deepEqual(noncharacters(`a${ffff}\n${fdd0}b${plane1}`), ['1:2 U+FFFF', '2:1 U+FDD0', '2:3 U+1FFFE']);
  const files = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|json)$/.test(e.name)) files.push(p); } };
  walk(SRC);
  const found = files.flatMap((file) => noncharacters(fs.readFileSync(file, 'utf8')).map((at) => `${path.relative(SRC, file)}:${at}`));
  assert.deepEqual(found, []);
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
