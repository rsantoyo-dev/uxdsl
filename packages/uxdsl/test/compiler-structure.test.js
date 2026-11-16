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
  // The per-run state is created in prepare(); Once() and OnceExit() only call named steps.
  const factory = index.match(/^function uxdslPlugin\(opts: UxdslOptions = \{\}\) \{\n  return \{\n    postcssPlugin: PLUGIN,\n    prepare\(\) \{\n      const pending = new Map<[^\n]*>\(\);\n      return \{\n([\s\S]*?)\n      \};\n    \},\n  \};\n\}$/m);
  assert.ok(factory, 'the factory creates its per-run map in prepare()');
  const once = factory[1].match(/Once\(root: Root, \{ result \}: \{ result: Result \}\) \{([\s\S]*?)\n {8}\},/);
  assert.ok(once, 'Once() is found');
  const onceCalls = [...once[1].matchAll(/\b(\w+)\((compilation(?:, constructs)?|root, result, opts)\)/g)].map((match) => match[1]);
  assert.deepEqual(onceCalls, ['validateOptions', 'holdSassSyntax', 'runSteps']);
  assert.ok(once[1].trim().split('\n').length <= 4, 'Once() only sequences the steps');
  const onceExit = factory[1].match(/OnceExit\(root: Root\) \{([\s\S]*?)\n {8}\},/);
  assert.ok(onceExit, 'OnceExit() is found');
  assert.equal(onceExit[1].trim(), 'releaseSassSyntax(root, pending);');
  const steps = index.match(/^function runSteps\(c: Compilation, constructs: SassConstruct\[\]\) \{\n  try \{\n([\s\S]*?)\n  \} catch/m);
  assert.ok(steps, 'runSteps() is found');
  const calls = [...steps[1].matchAll(/\b(\w+)\(c\)/g)].map((match) => match[1]);
  assert.deepEqual(calls, ['rewriteBreakpointMedia', 'emitTheme', 'expandDirectives', 'expandResponsive', 'rejectLeftoverDirectives', 'checkReferences', 'reportThemeEmission']);
  assert.equal(steps[1].trim().split('\n').length, calls.length, 'runSteps() only sequences the steps');
  for (const step of ['validateOptions', 'holdSassSyntax', 'runSteps', 'releaseSassSyntax', 'rejectSassSyntax', ...calls]) {
    assert.match(index, new RegExp(`^function ${step}\\(`, 'm'), `${step} is a top-level function`);
  }
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
  const instance = plugin({ discoverTheme: false });
  const a = postcss([plugin({ discoverTheme: false, theme: { breakpoints: { md: 900 } } })]).process('.a { padding: xs(1px) md(2px); }', { from: undefined }).css;
  const b = postcss([instance]).process('.a { padding: xs(1px) md(2px); }', { from: undefined }).css;
  const c = postcss([instance]).process('.b { padding: xs(1px) md(2px); }', { from: undefined }).css;
  assert.match(a, /min-width: 900px/);
  assert.match(b, /min-width: 768px/);
  assert.equal(c, b.replace('.a', '.b').replace('.a', '.b'));
});
