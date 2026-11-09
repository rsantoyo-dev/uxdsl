'use strict';

// MIG-B9-10 (FEAT-010): one test per behavior compile() delivers when it runs a
// .uxdsl file through Dart Sass; each one names the behavior it pins.
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

test('MIG-B9-10: @use "sass:math" compiles', async () => {
  const dir = project({ 'entry.uxdsl': '@use "sass:math";\n.a { width: math.div(10px, 2); padding: space(2); }\n' });
  assert.equal(flat((await build(dir)).css), '.a { width: 5px; padding: var(--uxdsl__space__2); }');
});

test('MIG-B9-10: @use of a .uxdsl partial, an index file and a sub-directory partial', async () => {
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

test('MIG-B9-10: @use of a .scss and of a .css next to .uxdsl', async () => {
  const dir = project({
    'entry.uxdsl': '@use "legacy";\n@use "plain";\n',
    '_legacy.scss': '$c: red;\n.legacy { color: $c; }\n',
    '_plain.css': '.plain { color: blue; }\n',
  });
  const css = flat((await build(dir)).css);
  assert.match(css, /\.legacy \{ color: red; \}/);
  assert.match(css, /\.plain \{ color: blue; \}/);
});

test('MIG-B9-10: @import of a .uxdsl works and reports UXD_SASS_WARNING [import]', async () => {
  const dir = project({ 'entry.uxdsl': '@import "part";\n', '_part.uxdsl': '.p { padding: space(1); }\n' });
  const result = await build(dir);
  assert.match(flat(result.css), /\.p \{ padding: var\(--uxdsl__space__1\); \}/);
  assert.ok(result.warnings.some((warning) => /UXD_SASS_WARNING/.test(warning.text) && /\bimport\b/.test(warning.text)), JSON.stringify(result.warnings));
});

test('MIG-B9-10: @import "x.css" with its extension stays a CSS @import', async () => {
  const dir = project({ 'entry.uxdsl': '@import "x.css";\n.a { color: red; }\n' });
  assert.match((await build(dir)).css, /@import "x\.css";/);
});

test('MIG-B9-13: a missing @use (written first) fails as UXD_SASS "Can\'t find stylesheet to import." at entry.uxdsl:1:1', async () => {
  const dir = project({ 'entry.uxdsl': '@use "nope";\n.a { color: red; }\n' });
  const error = await failure(build(dir));
  assert.equal(error.code, 'UXD_SASS');
  assert.equal(error.sassMessage, "Can't find stylesheet to import.");
  assert.equal(path.basename(error.file || ''), 'entry.uxdsl');
  assert.equal(error.line, 1);
  assert.equal(error.column, 1);
});

test('MIG-B9-13: a missing @use (written first) fails as UXD_SASS "Can\'t find stylesheet to import." at entry.uxdsl:1:1 (negative control)', async () => {
  // Written after a rule, the same @use is a different Sass error, on line 2: the reason a missing
  // @use written there failed for the wrong reason.
  const dir = project({ 'entry.uxdsl': '.a { color: red; }\n@use "nope";\n' });
  const error = await failure(build(dir));
  assert.equal(error.code, 'UXD_SASS');
  assert.equal(error.sassMessage, '@use rules must be written before any other rules.');
  assert.equal(error.line, 2);
});

test('MIG-B9-10: a @use loop fails as UXD_SASS', async () => {
  const dir = project({ 'entry.uxdsl': '@use "a";\n', '_a.uxdsl': '@use "b";\n', '_b.uxdsl': '@use "a";\n' });
  assert.match(String((await failure(build(dir))).message), /UXD_SASS/);
});

test('MIG-B9-10: pkg: imports resolve a package\'s scss', async () => {
  const dir = project({
    'entry.uxdsl': '@use "pkg:theme-kit";\n',
    'node_modules/theme-kit/package.json': JSON.stringify({ name: 'theme-kit', sass: '_index.scss' }),
    'node_modules/theme-kit/_index.scss': '.kit { color: red; }\n',
  });
  assert.match(flat((await build(dir)).css), /\.kit \{ color: red; \}/);
});

test('MIG-B9-10: a bare package path resolves through node_modules', async () => {
  const dir = project({
    'entry.uxdsl': '@use "theme-kit/scss/base";\n',
    'node_modules/theme-kit/scss/_base.scss': '.base { color: red; }\n',
  });
  assert.match(flat((await build(dir)).css), /\.base \{ color: red; \}/);
});

// FEAT-010 DEC-17 (decided 2026-10-23): a project function named like a UXDSL
// function wins where Sass calls it by its bare name, with one located warning.
const shadowed = (result) => result.warnings.filter((warning) => /UXD_FUNCTION_SHADOWED/.test(warning.text));

test('MIG-B9-10: @function space() wins over the token and warns UXD_FUNCTION_SHADOWED at its line', async () => {
  const dir = project({ 'entry.uxdsl': '.a { color: red; }\n@function space($k) { @return $k * 3px; }\n.b { padding: space(2); }\n' });
  const result = await build(dir);
  assert.match(flat(result.css), /\.b \{ padding: 6px; \}/);
  const [warning, ...more] = shadowed(result);
  assert.ok(warning, 'one warning names the replaced UXDSL function');
  assert.equal(more.length, 0);
  assert.equal(warning.line, 2);
});

test('MIG-B9-10: a @function color in a .scss partial loaded with @import is found and warned', async () => {
  const dir = project({
    'entry.uxdsl': '@import "helpers";\n.a { color: color(brand); }\n',
    '_helpers.scss': '@use "sass:map";\n$colors: (brand: #123456);\n@function color($name) { @return map.get($colors, $name); }\n',
  });
  const result = await build(dir);
  assert.match(flat(result.css), /\.a \{ color: #123456; \}/);
  const [warning] = shadowed(result);
  assert.ok(warning, 'a shadowing function in a .scss partial is not silent');
  assert.match(String(warning.file), /_helpers\.scss$/);
});

test('MIG-B9-10: a helper reached only through a namespace shadows nothing', async () => {
  const dir = project({
    'entry.uxdsl': '@use "helpers";\n.a { margin: helpers.space(2); padding: space(2); }\n',
    'plain.uxdsl': '.a { margin: 6px; padding: space(2); }\n',
    '_helpers.scss': '@function space($k) { @return $k * 3px; }\n',
  });
  const result = await build(dir);
  assert.equal(flat(result.css), flat((await build(dir, 'plain.uxdsl')).css));
  assert.equal(shadowed(result).length, 0);
});

test('MIG-B9-10: @ds-surface (contained) with a space compiles', async () => {
  const dir = project({ 'entry.uxdsl': '.a { @ds-surface (contained); }\n', 'plain.uxdsl': '.a { @ds-surface(contained); }\n' });
  assert.equal(flat((await build(dir)).css), flat((await build(dir, 'plain.uxdsl')).css));
});

test('MIG-B9-10: $var inside @ds-button(…) is substituted', async () => {
  const dir = project({ 'entry.uxdsl': '$t: error;\n.a { @ds-button(contained $t); }\n', 'plain.uxdsl': '.a { @ds-button(contained error); }\n' });
  assert.equal(flat((await build(dir)).css), flat((await build(dir, 'plain.uxdsl')).css));
});

test('MIG-B9-10: dependencies lists the entry first and every loaded file', async () => {
  const dir = project({ 'entry.uxdsl': '@use "a";\n', '_a.uxdsl': '@use "b";\n.a { color: red; }\n', '_b.uxdsl': '.b { color: blue; }\n' });
  const result = await build(dir);
  assert.deepEqual(result.dependencies.map((file) => path.basename(file)), ['entry.uxdsl', '_a.uxdsl', '_b.uxdsl']);
});

test('MIG-B9-10: compile({ source, from }) resolves relative loads from a from that does not exist on disk', async () => {
  const dir = project({ '_part.uxdsl': '.p { color: red; }\n' });
  const result = await core.compile({ source: '@use "part";\n', from: path.join(dir, 'virtual.uxdsl') }, { includeTheme: false });
  assert.match(flat(result.css), /\.p \{ color: red; \}/);
});

test('MIG-B9-13: sass.silenceDeprecations removes the [import] warnings', async () => {
  const dir = project({ 'entry.uxdsl': '@import "a";\n@import "b";\n', '_a.uxdsl': '.a { color: red; }\n', '_b.uxdsl': '.b { color: red; }\n' });
  const importWarnings = (result) => result.warnings.filter((warning) => warning.text.startsWith('UXD_SASS_WARNING: [import] '));
  const loud = importWarnings(await build(dir));
  // Control: without the option, each @import is reported once, at its own line.
  assert.deepEqual(loud.map((warning) => `${path.basename(warning.file)}:${warning.line}:${warning.column}`), ['entry.uxdsl:1:9', 'entry.uxdsl:2:9']);
  const quiet = await build(dir, 'entry.uxdsl', { sass: { silenceDeprecations: ['import'] } });
  assert.deepEqual(importWarnings(quiet), []);
  assert.equal(flat(quiet.css), '.a { color: red; } .b { color: red; }');
});

test('MIG-B9-13: a declaration value with a colon outside parentheses and strings, which Dart Sass prints (b: a:b), is PostCSS\'s located "Missed semicolon" error with no UXD code; a custom property, a progid: filter and a quoted colon compile as Dart Sass prints them', async () => {
  const sass = require('sass');
  const entry = '@use "sass:string";\n.x {\n  b: string.unquote("a:b");\n}\n';
  const controls = '@use "sass:selector";\n.x {\n  --sel: #{selector.nest(".a", "&:hover")};\n  filter: progid:DXImageTransform.Microsoft.gradient(startColorstr="#80000000");\n  content: "a:b";\n}\n';
  const dir = project({ 'entry.uxdsl': entry, 'controls.uxdsl': controls });
  // Dart Sass prints the value; PostCSS's parser reads its top-level colon as a missing semicolon.
  assert.equal(sass.compileString(entry, { style: 'expanded' }).css, '.x {\n  b: a:b;\n}');
  const error = await failure(build(dir, 'entry.uxdsl', { theme: {} }));
  assert.equal(error.name, 'CssSyntaxError');
  assert.equal(error.reason, 'Missed semicolon');
  assert.equal(error.code, undefined);
  assert.deepEqual([error.file, error.line, error.column], [path.join(dir, 'entry.uxdsl'), 3, 3]);
  assert.match(error.showSourceCode(false), /> 3 \|   b: string\.unquote\("a:b"\);/);
  // A custom property, a progid: filter and a string hold the same colon and compile (negative control).
  const { css } = await build(dir, 'controls.uxdsl', { theme: {} });
  assert.equal(css, sass.compileString(controls, { style: 'expanded' }).css);
  assert.match(css, /--sel: \.a:hover;/);
});

test('MIG-B9-13: other text Dart Sass prints that is not CSS (a ";", a brace, an unclosed comment, string or bracket) is PostCSS\'s located error with no UXD code, and a "//" it prints in a value is UXD_SASS_CONTEXT with the message of the plugin alone; in a custom property or a string that "//" compiles', async () => {
  const sass = require('sass');
  const source = (value) => `@use "sass:string";\n.x {\n  b: string.unquote(${JSON.stringify(value)});\n}\n`;
  const VALUES = ['a;c', 'a}c', 'a{c', 'a /* c', "a 'c", 'a(c', 'a // c'];
  const controls = '@use "sass:string";\n.x {\n  --b: #{string.unquote("a // c")};\n  content: "a // c";\n}\n';
  const dir = project({ ...Object.fromEntries(VALUES.map((value, i) => [`v${i}.uxdsl`, source(value)])), 'controls.uxdsl': controls });
  const outcomes = [];
  for (const [i, value] of VALUES.entries()) {
    // Dart Sass prints the value as written, inside the declaration.
    assert.equal(sass.compileString(source(value), { style: 'expanded' }).css, `.x {\n  b: ${value};\n}`);
    try {
      await build(dir, `v${i}.uxdsl`, { theme: {} });
      outcomes.push(`${value}: compiled`);
    } catch (error) {
      // PostCSS before 8.5 says "Unknown word" without the word.
      const reason = error.reason.replace(/^Unknown word .*/, 'Unknown word').split(';')[0];
      const framed = /> 3 \|   b: string\.unquote\(/.test(error.showSourceCode(false));
      outcomes.push(`${value}: ${error.name} ${reason} (code ${error.code}) at ${path.basename(error.file)}:${error.line}:${error.column}, author frame ${framed}`);
      // The plugin cannot tell it runs inside compile(), so its message still names compile().
      if (value === 'a // c') assert.match(error.reason, /compile it with uxdsl build, compile\(\) or an adapter/);
    }
  }
  assert.deepEqual(outcomes, [
    'a;c: CssSyntaxError Unknown word (code undefined) at v0.uxdsl:3:3, author frame true',
    'a}c: CssSyntaxError Unknown word (code undefined) at v1.uxdsl:3:3, author frame true',
    'a{c: CssSyntaxError Unknown word (code undefined) at v2.uxdsl:3:3, author frame true',
    'a /* c: CssSyntaxError Unclosed comment (code undefined) at v3.uxdsl:3:3, author frame true',
    "a 'c: CssSyntaxError Unclosed string (code undefined) at v4.uxdsl:3:3, author frame true",
    'a(c: CssSyntaxError Unclosed bracket (code undefined) at v5.uxdsl:3:3, author frame true',
    'a // c: CssSyntaxError UXD_SASS_CONTEXT: a // comment is Sass (code undefined) at v6.uxdsl:3:3, author frame true',
  ]);
  // In a custom property and in a string the same "//" is text, and compiles as Dart Sass prints it (negative control).
  assert.equal((await build(dir, 'controls.uxdsl', { theme: {} })).css, sass.compileString(controls, { style: 'expanded' }).css);
});
