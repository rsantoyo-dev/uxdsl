'use strict';

// MIG-B9-10 (FEAT-010): one test per behavior MIG-B9-12 and MIG-B9-13 must deliver
// when compile() runs a .uxdsl file through Dart Sass. Written now against
// compile(), `todo` until those stories turn them green; each one names the
// behavior it pins so the implementation is read against it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const core = require('../../dist/entries/index.js');

/** Writes `files` ({ relativePath: text }) into a fresh directory and returns its path. */
function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-pipeline-'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  return dir;
}

const flat = (css) => css.replace(/\s+/g, ' ').trim();
const build = (dir, file = 'entry.uxdsl', config = {}) => core.compile({ entry: path.join(dir, file) }, { includeTheme: false, ...config });

async function failure(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail('the compile succeeded; it should fail');
}

test.todo('MIG-B9-10: @use "sass:math" compiles', async () => {
  const dir = project({ 'entry.uxdsl': '@use "sass:math";\n.a { width: math.div(10px, 2); padding: space(2); }\n' });
  assert.equal(flat((await build(dir)).css), '.a { width: 5px; padding: var(--uxdsl__space__2); }');
});

test.todo('MIG-B9-10: @use of a .uxdsl partial, an index file and a sub-directory partial', async () => {
  const dir = project({
    'entry.uxdsl': '@use "tokens";\n@use "components";\n@use "lib/buttons";\n.a { width: tokens.$w; }\n',
    '_tokens.uxdsl': '$w: 10px;\n',
    'components/_index.uxdsl': '.card { padding: density(2); }\n',
    'lib/_buttons.uxdsl': '.btn { color: palette(primary.main); }\n',
  });
  const css = flat((await build(dir)).css);
  assert.match(css, /\.card \{ padding: var\(--uxdsl__density__2\); \}/);
  assert.match(css, /\.btn \{ color: var\(--uxdsl__palette__primary-main\); \}/);
  assert.match(css, /\.a \{ width: 10px; \}/);
});

test.todo('MIG-B9-10: @use of a .scss and of a .css next to .uxdsl', async () => {
  const dir = project({
    'entry.uxdsl': '@use "legacy";\n@use "plain";\n',
    '_legacy.scss': '$c: red;\n.legacy { color: $c; }\n',
    '_plain.css': '.plain { color: blue; }\n',
  });
  const css = flat((await build(dir)).css);
  assert.match(css, /\.legacy \{ color: red; \}/);
  assert.match(css, /\.plain \{ color: blue; \}/);
});

test.todo('MIG-B9-10: @import of a .uxdsl works and reports UXD_SASS_WARNING [import]', async () => {
  const dir = project({ 'entry.uxdsl': '@import "part";\n', '_part.uxdsl': '.p { padding: space(1); }\n' });
  const result = await build(dir);
  assert.match(flat(result.css), /\.p \{ padding: var\(--uxdsl__space__1\); \}/);
  assert.ok(result.warnings.some((warning) => /UXD_SASS_WARNING/.test(warning.text) && /\bimport\b/.test(warning.text)), JSON.stringify(result.warnings));
});

test.todo('MIG-B9-10: @import "x.css" with its extension stays a CSS @import', async () => {
  const dir = project({ 'entry.uxdsl': '@import "x.css";\n.a { color: red; }\n' });
  assert.match((await build(dir)).css, /@import "x\.css";/);
});

test.todo('MIG-B9-10: a missing @use fails as UXD_SASS naming the importing file and line', async () => {
  const dir = project({ 'entry.uxdsl': '.a { color: red; }\n@use "nope";\n' });
  const error = await failure(build(dir));
  assert.match(String(error.message), /UXD_SASS/);
  assert.equal(path.basename(error.file || ''), 'entry.uxdsl');
  assert.equal(error.line, 2);
});

test.todo('MIG-B9-10: a @use loop fails as UXD_SASS', async () => {
  const dir = project({ 'entry.uxdsl': '@use "a";\n', '_a.uxdsl': '@use "b";\n', '_b.uxdsl': '@use "a";\n' });
  assert.match(String((await failure(build(dir))).message), /UXD_SASS/);
});

test.todo('MIG-B9-10: pkg: imports resolve a package\'s scss', async () => {
  const dir = project({
    'entry.uxdsl': '@use "pkg:theme-kit";\n',
    'node_modules/theme-kit/package.json': JSON.stringify({ name: 'theme-kit', sass: '_index.scss' }),
    'node_modules/theme-kit/_index.scss': '.kit { color: red; }\n',
  });
  assert.match(flat((await build(dir)).css), /\.kit \{ color: red; \}/);
});

test.todo('MIG-B9-10: a bare package path resolves through node_modules', async () => {
  const dir = project({
    'entry.uxdsl': '@use "theme-kit/scss/base";\n',
    'node_modules/theme-kit/scss/_base.scss': '.base { color: red; }\n',
  });
  assert.match(flat((await build(dir)).css), /\.base \{ color: red; \}/);
});

test.todo('MIG-B9-10: @function space() is UXD_RESERVED_NAME at its line', async () => {
  const dir = project({ 'entry.uxdsl': '.a { color: red; }\n@function space($k) { @return $k; }\n' });
  const error = await failure(build(dir));
  assert.match(String(error.message), /UXD_RESERVED_NAME/);
  assert.equal(error.line, 2);
});

test.todo('MIG-B9-10: @ds-surface (contained) with a space compiles', async () => {
  const dir = project({ 'entry.uxdsl': '.a { @ds-surface (contained); }\n', 'plain.uxdsl': '.a { @ds-surface(contained); }\n' });
  assert.equal(flat((await build(dir)).css), flat((await build(dir, 'plain.uxdsl')).css));
});

test.todo('MIG-B9-10: $var inside @ds-button(…) is substituted', async () => {
  const dir = project({ 'entry.uxdsl': '$t: error;\n.a { @ds-button(contained $t); }\n', 'plain.uxdsl': '.a { @ds-button(contained error); }\n' });
  assert.equal(flat((await build(dir)).css), flat((await build(dir, 'plain.uxdsl')).css));
});

test.todo('MIG-B9-10: dependencies lists the entry first and every loaded file', async () => {
  const dir = project({ 'entry.uxdsl': '@use "a";\n', '_a.uxdsl': '@use "b";\n.a { color: red; }\n', '_b.uxdsl': '.b { color: blue; }\n' });
  const result = await build(dir);
  assert.deepEqual(result.dependencies.map((file) => path.basename(file)), ['entry.uxdsl', '_a.uxdsl', '_b.uxdsl']);
});

test.todo('MIG-B9-10: compile({ source, from }) resolves relative loads from a from that does not exist on disk', async () => {
  const dir = project({ '_part.uxdsl': '.p { color: red; }\n' });
  const result = await core.compile({ source: '@use "part";\n', from: path.join(dir, 'virtual.uxdsl') }, { includeTheme: false });
  assert.match(flat(result.css), /\.p \{ color: red; \}/);
});

test.todo('MIG-B9-10: deprecation warnings are reported once each and silenceDeprecations removes them', async () => {
  const dir = project({ 'entry.uxdsl': '@import "a";\n@import "b";\n', '_a.uxdsl': '.a { color: red; }\n', '_b.uxdsl': '.b { color: red; }\n' });
  const loud = await build(dir);
  const importWarnings = loud.warnings.filter((warning) => /\bimport\b/.test(warning.text));
  assert.ok(importWarnings.length >= 1);
  assert.equal(new Set(importWarnings.map((warning) => `${warning.file}:${warning.line}`)).size, importWarnings.length, 'no duplicates');
  const quiet = await build(dir, 'entry.uxdsl', { silenceDeprecations: ['import'] });
  assert.equal(quiet.warnings.filter((warning) => /\bimport\b/.test(warning.text)).length, 0);
});

test.todo('MIG-B9-10: the corpus pipeline is at most 1.5× plain Sass (measured by fixtures/sass-corpus/run.js)', () => {
  // MIG-B9-13 measures the budget with the corpus fixture and turns it into a
  // test; there is nothing to compare before the pipeline exists.
  assert.fail('measured in MIG-B9-13');
});
