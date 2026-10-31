'use strict';

// The Sass stage (src/sass/compile-sass.ts): Dart Sass with the .uxdsl importer,
// located errors and warnings, translated source maps, and the rule that the
// author's SCSS wins where Sass calls a project @function by a UXDSL name.
//
// Most expectations are differential. The same project is written twice: once
// with .uxdsl files, compiled by the stage, and once with every .uxdsl renamed
// to .scss (the "twin"), compiled by Dart Sass alone with the same load paths.
// On sources whose keys Sass reads as written (`space(2)`, `border(1)`), the
// twin is the oracle for the CSS, the loaded files, the warnings, and the
// error message, location and code frame. Where Sass would evaluate or reject a
// key (`palette(primary.main)`, `space(10-2)`), the expectation is stated.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { spawnSync } = require('node:child_process');

const PACKAGE = path.resolve(__dirname, '../..');
const sass = require(require.resolve('sass', { paths: [PACKAGE] }));
const { SourceMapConsumer } = require('source-map-js');
const { protect, findShadowingFunctions } = require('../../dist/sass/protect.js');
const { DIAGNOSTIC_CATALOG, diagnostic } = require('../../dist/diagnostics.js');
const { resolveTheme } = require('../../dist/entries/theme.js');

const MAPS = path.join(__dirname, 'fixtures/sass-maps');
const STAGE_MODULE = path.join(PACKAGE, 'dist/sass/compile-sass.js');

/** The effective theme's breakpoint names: what a project @function is checked against besides the token functions and tone(). */
const RESERVED = Object.keys(resolveTheme().breakpoints);

/** compileSassStage, loaded when a test runs. */
function stage(input, options = {}) {
  const { compileSassStage } = require(STAGE_MODULE);
  return compileSassStage(input, { reserved: RESERVED, sourceMap: false, ...options });
}

// --- projects --------------------------------------------------------------------

function write(dir, files) {
  for (const [file, content] of Object.entries(files)) {
    const abs = path.join(dir, file);
    if (content === null) {
      fs.mkdirSync(abs, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

/** Writes `files` ({ relativePath: text | Buffer | null for a directory }) into a fresh real directory. */
function project(files) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-stage-')));
  write(dir, files);
  return dir;
}

/** The file map for one side: `{X}` in names and text becomes the side's extension, and the twin renames every .uxdsl to .scss. */
function side(files, x) {
  return Object.fromEntries(Object.entries(files).map(([file, text]) => {
    let name = file.replace(/\{X\}/g, x);
    if (x === 'scss') name = name.replace(/\.uxdsl$/, '.scss');
    return [name, typeof text === 'string' ? text.replace(/\{X\}/g, x) : text];
  }));
}

/** Every node_modules from the file's directory up to the root, nearest first: the stage's default load paths. */
function nodeModulesChain(file) {
  const out = [];
  let dir = path.dirname(file);
  for (;;) {
    out.push(path.join(dir, 'node_modules'));
    const up = path.dirname(dir);
    if (up === dir) return out;
    dir = up;
  }
}

function inDir(dir, fn) {
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    return fn();
  } finally {
    process.chdir(cwd);
  }
}

const flat = (css) => css.replace(/\s+/g, ' ').trim();

/** A Dart Sass logger call, written the way the stage reports it. */
function asStageWarning(message, options) {
  const first = message.split('\n')[0];
  const text = options.deprecation && options.deprecationType ? `UXD_SASS_WARNING: [${options.deprecationType.id}] ${first}` : `UXD_SASS_WARNING: ${first}`;
  if (options.span && options.span.url) return { text, file: fileURLToPath(options.span.url), line: options.span.start.line + 1, column: options.span.start.column + 1 };
  const frame = typeof options.stack === 'string' && options.stack !== 'null' ? /^(.+) (\d+):(\d+)(?: {2,}.*)?$/.exec(options.stack.split('\n')[0]) : null;
  if (frame && frame[1] !== '-') return { text, file: path.resolve(frame[1]), line: Number(frame[2]), column: Number(frame[3]) };
  return { text };
}

/** Dart Sass alone on `entry` inside `dir` (cwd = dir), with the stage's default load paths. */
function dartSass(dir, entry, options = {}) {
  const warnings = [];
  const logger = { warn: (message, opts) => warnings.push(asStageWarning(message, opts)), debug() {} };
  const file = path.join(dir, entry);
  return inDir(dir, () => {
    try {
      const result = sass.compile(file, { style: 'expanded', alertColor: false, alertAscii: false, logger, loadPaths: nodeModulesChain(file), ...options });
      return { css: result.css, loadedFiles: result.loadedUrls.filter((url) => url.protocol === 'file:').map((url) => fileURLToPath(url)), warnings, sourceMap: result.sourceMap };
    } catch (error) {
      if (!(error instanceof sass.Exception)) throw error;
      return { error, warnings };
    }
  });
}

/** The stage on `entry` inside `dir` (cwd = dir): its result, or `{ error }` for a UXD_SASS failure. */
function stageIn(dir, entry, options = {}) {
  return inDir(dir, () => {
    try {
      return stage({ entry: path.join(dir, entry) }, options);
    } catch (error) {
      if (error && error.code === 'UXD_SASS') return { error };
      throw error;
    }
  });
}

/** A project path relative to its directory with .uxdsl and .scss erased, so both sides compare. */
const rel = (dir) => (file) => (file === undefined ? undefined : path.relative(dir, file).replace(/\.(uxdsl|scss)$/, '.X'));
const neutral = (dir) => (text) => text.split(dir).join('<dir>').replace(/\.(uxdsl|scss)\b/g, '.X');
const warningOf = (dir) => (w) => ({ text: neutral(dir)(w.text), file: rel(dir)(w.file), line: w.line, column: w.column });
const sassWarnings = (warnings) => warnings.filter((w) => !/^UXD_FUNCTION_SHADOWED:/.test(w.text));
const twinLocation = (dir, error) => `${rel(dir)(fileURLToPath(error.span.url))}:${error.span.start.line + 1}:${error.span.start.column + 1}`;
const stageLocation = (dir, error) => `${rel(dir)(error.file)}:${error.line}:${error.column}`;
/** Sass's own frame and stack: its message without the first line(s), which repeat sassMessage. */
const sassFrameOf = (error) => (error.message.startsWith(`${error.sassMessage}\n`) ? error.message.slice(error.sassMessage.length + 1) : error.message);

/** Compiles `files` with the stage and its twin with Dart Sass alone; `prepare(dir)` runs on each side's directory first. */
function twin(files, { entry = 'entry', sassOptions = {}, stageOptions = {}, dartOptions = {}, prepare = () => {} } = {}) {
  const ux = project(side(files, 'uxdsl'));
  const sc = project(side(files, 'scss'));
  prepare(ux);
  prepare(sc);
  const expected = dartSass(sc, `${entry}.scss`, { ...sassOptions, ...dartOptions });
  const actual = stageIn(ux, `${entry}.uxdsl`, { sass: sassOptions, ...stageOptions });
  return { ux, sc, expected, actual };
}

/** A frame with .uxdsl/.scss erased and the stack's alignment padding collapsed: a stack that mixes renamed and real .scss files pads differently on each side. */
const frameOf = (dir, frame, exact) => {
  const text = neutral(dir)(frame);
  return exact ? text : text.split('\n').map((line) => (/[│╷╵┌└]/.test(line) ? line : line.replace(/ {2,}(?=\S)/g, (spaces, offset) => (offset === 0 ? spaces : '  ')))).join('\n');
};

/** The stage agrees with Dart Sass on the twin: CSS byte for byte, loaded files, warnings, or the error's message, location and frame (`exactFrame`: alignment included). */
function assertSameAsTwin({ ux, sc, expected, actual }, label, { exactFrame = false } = {}) {
  if (expected.error) {
    assert.ok(actual.error, `${label}: Dart Sass fails on the twin (${expected.error.sassMessage}); the stage compiled`);
    assert.equal(neutral(ux)(actual.error.sassMessage), neutral(sc)(expected.error.sassMessage), label);
    assert.equal(stageLocation(ux, actual.error), twinLocation(sc, expected.error), label);
    assert.equal(frameOf(ux, actual.error.sassFrame, exactFrame), frameOf(sc, sassFrameOf(expected.error), exactFrame), `${label}: frame`);
  } else {
    assert.ok(!actual.error, `${label}: the stage failed: ${actual.error && actual.error.message}`);
    assert.equal(actual.css, expected.css, label);
    assert.deepEqual(actual.loadedFiles.map(rel(ux)), expected.loadedFiles.map(rel(sc)), label);
  }
  const warnings = actual.error ? [] : sassWarnings(actual.warnings);
  if (!actual.error) assert.deepEqual(warnings.map(warningOf(ux)), expected.warnings.map(warningOf(sc)), `${label}: warnings`);
}

function stageError(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  assert.fail('the stage compiled; it should fail');
}

const shadowOf = (dir, result) => result.warnings.filter((w) => /^UXD_FUNCTION_SHADOWED:/.test(w.text)).map((w) => `${path.relative(dir, w.file)}:${w.line}:${w.column}`).sort();

// --- T1: resolution (IM1, IM2, IM3) --------------------------------------------------

const RESOLUTION = [
  ['plain file, partial, dir/_index, dir/index, sub/_deep, ../leaf', {
    'entry.uxdsl': '@use "button";\n@use "partial";\n@use "dir-index";\n@use "dir2";\n@use "sub/deep";\n.e { padding: space(2); }\n',
    'button.uxdsl': '.btn { border: border(1); }\n',
    '_partial.uxdsl': '.partial { radius: radius(pill); }\n',
    'dir-index/_index.uxdsl': '.di { color: red; }\n',
    'dir2/index.uxdsl': '.d2 { color: red; }\n',
    'sub/_deep.uxdsl': '@use "../leaf";\n.deep { color: red; }\n',
    '_leaf.uxdsl': '.leaf { color: red; }\n',
  }],
  ['ambiguity: _x + x', { 'entry.uxdsl': '@use "x";\n', '_x.uxdsl': '.a{b:c}\n', 'x.uxdsl': '.a{b:d}\n' }],
  ['ambiguity: x.sass next to x.{X}', { 'entry.uxdsl': '@use "x";\n', 'x.sass': '.a\n  b: c\n', 'x.uxdsl': '.a{b:d}\n' }],
  ['ambiguity: d/index + d/_index', { 'entry.uxdsl': '@use "d";\n', 'd/index.uxdsl': '.a{b:c}\n', 'd/_index.uxdsl': '.a{b:d}\n' }],
  ['@import picks w.import.{X}; @use picks w.{X}', { 'entry.uxdsl': '@import "w";\n', 'w.import.uxdsl': '.imp{b:c}\n', 'w.uxdsl': '.use{b:c}\n' }],
  ['@use ignores w.import.{X}', { 'entry.uxdsl': '@use "w";\n', 'w.import.uxdsl': '.imp{b:c}\n', 'w.uxdsl': '.use{b:c}\n' }],
  ['@import of a directory picks index.import.{X}', { 'entry.uxdsl': '@import "d";\n', 'd/index.import.uxdsl': '.imp{b:c}\n', 'd/index.uxdsl': '.use{b:c}\n' }],
  ['a file beats a directory index', { 'entry.uxdsl': '@use "e";\n', 'e.uxdsl': '.file{b:c}\n', 'e/index.uxdsl': '.dir{b:c}\n' }],
  ['{X} beats css', { 'entry.uxdsl': '@use "y";\n', 'y.uxdsl': '.x{b:c}\n', 'y.css': '.css{b:c}\n' }],
  ['css only: @use inlines; @import "p.css" stays; @import "other" inlines', { 'entry.uxdsl': '@use "plain";\n@import "plain.css";\n@import "other";\n.a{b:c}\n', 'plain.css': '.plain{color:blue}\n', 'other.css': '.other{color:blue}\n' }],
  ['explicit extension: @use "button.{X}"', { 'entry.uxdsl': '@use "button.{X}";\n', 'button.uxdsl': '.btn{b:c}\n' }],
  ['explicit extension to a partial: @use "partial.{X}"', { 'entry.uxdsl': '@use "partial.{X}";\n', '_partial.uxdsl': '.p{b:c}\n' }],
  ['explicit extension and @import pick name.import.{X}', { 'entry.uxdsl': '@import "w.{X}";\n', 'w.import.uxdsl': '.imp{b:c}\n', 'w.uxdsl': '.use{b:c}\n' }],
  ['explicit index: @use "d/index"', { 'entry.uxdsl': '@use "d/index";\n', 'd/_index.uxdsl': '.di{b:c}\n' }],
  ['missing @use', { 'entry.uxdsl': '@use "nope";\n' }],
  ['missing @import', { 'entry.uxdsl': '.a { padding: space(2); }\n@import "nope";\n' }],
  ['missing @use in a partial', { 'entry.uxdsl': '@use "a";\n', '_a.uxdsl': '\n  @use "nope" as n;\n' }],
  ['@use loop', { 'entry.uxdsl': '@use "a";\n', '_a.uxdsl': '@use "b";\n', '_b.uxdsl': '@use "a";\n' }],
  ['@import loop', { 'entry.uxdsl': '@import "a";\n', '_a.uxdsl': '@import "b";\n', '_b.uxdsl': '@import "a";\n' }],
  ['@import twice includes twice; @use twice is one module', { 'entry.uxdsl': '@import "p";\n@import "p";\n@use "q";\n@use "q" as q2;\n', '_p.uxdsl': '.p{b:c}\n', '_q.uxdsl': '.q{b:c}\n' }],
  ['one file through two URLs loads once', { 'entry.uxdsl': '@use "button";\n@use "./button.{X}" as b2;\n', 'button.uxdsl': '.btn{b:c}\n' }],
  ['meta.load-css of a partial', { 'entry.uxdsl': '@use "sass:meta";\n.wrap { @include meta.load-css("partial"); }\n', '_partial.uxdsl': '.p{b:c}\n' }],
  ['@forward chain with show/hide/prefix', { 'entry.uxdsl': '@use "lib";\n.a { w: lib.$k-w; }\n', '_lib.uxdsl': '@forward "tokens" as k-* hide $h;\n', '_tokens.uxdsl': '$w: 1px;\n$h: 2px;\n' }],
  ['.scss and .sass partials next to .uxdsl', { 'entry.uxdsl': '@use "legacy";\n@use "indented";\n', '_legacy.scss': '$c: red;\n.legacy { color: $c; }\n', '_indented.sass': '.ind\n  color: blue\n' }],
  ['nested @import inside a rule', { 'entry.uxdsl': '.wrap {\n  @import "p";\n}\n', '_p.uxdsl': '.p{b:c}\n' }],
];

test('MIG-B9-12: the importer resolves .uxdsl, _partial.uxdsl, dir/_index.uxdsl, sub/_deep.uxdsl, .scss, .sass and .css next to each other', () => {
  for (const [label, files] of RESOLUTION) assertSameAsTwin(twin(files), label);
});

test('MIG-B9-12: the importer resolves .uxdsl, _partial.uxdsl, dir/_index.uxdsl, sub/_deep.uxdsl, .scss, .sass and .css next to each other (negative control: ambiguity is an error, in Sass\'s order)', () => {
  const ambiguous = (files, target = 'thing') => {
    const dir = project({ ...files, 'entry.uxdsl': `.z { padding: space(2); }\n@import "${target}";\n` });
    const error = stageError(() => inDir(dir, () => stage({ entry: path.join(dir, 'entry.uxdsl') })));
    assert.equal(error.code, 'UXD_SASS');
    assert.equal(error.file, path.join(dir, 'entry.uxdsl'));
    assert.equal(error.line, 2);
    assert.equal(error.column, 9, 'the @import URL string, as Sass locates it');
    return error.sassMessage;
  };
  // A .uxdsl and a .scss for one URL in one directory: Sass's words, Sass's order (.sass, .scss, then .uxdsl).
  assert.equal(ambiguous({ 'thing.uxdsl': '.u{b:c}\n', 'thing.scss': '.s{b:c}\n' }), "It's not clear which file to import. Found:\n  thing.scss\n  thing.uxdsl");
  // A partial and a non-partial are co-candidates: "partials first" would pick _x.uxdsl here.
  assert.equal(ambiguous({ '_x.uxdsl': '.p{b:c}\n', 'x.uxdsl': '.n{b:c}\n' }, 'x'), "It's not clear which file to import. Found:\n  _x.uxdsl\n  x.uxdsl");
  // Dart Sass lists x.sass before _x.scss; so does the stage.
  const files = { '_x.scss': '.a{b:c}\n', 'x.sass': '.a\n  b: c\n' };
  const sc = project({ ...files, 'entry.scss': '.z { padding: space(2); }\n@import "x";\n' });
  const twinError = dartSass(sc, 'entry.scss').error;
  assert.equal(twinError.sassMessage, "It's not clear which file to import. Found:\n  x.sass\n  _x.scss");
  assert.equal(ambiguous(files, 'x'), twinError.sassMessage);
});

// --- T2: CSS rules of Sass (IM1, W1) -----------------------------------------------------

test('MIG-B9-12: @import of a .uxdsl loads and warns UXD_SASS_WARNING [import]; @import "x.css" stays a CSS import; @use "./x" inlines x.css', () => {
  const source = '.z { color: palette(primary.main); } @import "part";\n';
  const dir = project({ 'entry.uxdsl': source, '_part.uxdsl': '.p { padding: space(1); color: palette(primary.main); }\n' });
  const result = inDir(dir, () => stage({ entry: path.join(dir, 'entry.uxdsl') }));
  assert.equal(result.css, '.z {\n  color: palette(primary.main);\n}\n\n.p {\n  padding: space(1);\n  color: palette(primary.main);\n}');
  assert.deepEqual(result.warnings, [{
    text: 'UXD_SASS_WARNING: [import] Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.',
    file: path.join(dir, 'entry.uxdsl'),
    line: 1,
    column: source.indexOf('"part"') + 1,
  }], 'located at the URL string, at the author\'s column after a protected token');
  assert.deepEqual(result.loadedFiles, [path.join(dir, 'entry.uxdsl'), path.join(dir, '_part.uxdsl')]);

  // The plain-CSS rules, each against Dart Sass on the twin.
  const cssImport = twin({ 'entry.uxdsl': '@import "x.css";\n.a { padding: space(2); }\n', 'x.css': '.x { color: blue; }\n' });
  assertSameAsTwin(cssImport, '@import "x.css"');
  assert.match(cssImport.actual.css, /^@import "x\.css";/);
  assert.ok(!cssImport.actual.loadedFiles.some((file) => file.endsWith('x.css')), 'a CSS @import is not loaded');
  const useCss = twin({ 'entry.uxdsl': '@use "./x";\n.a { padding: space(2); }\n', 'x.css': '.x { color: blue; }\n' });
  assertSameAsTwin(useCss, '@use "./x"');
  assert.match(useCss.actual.css, /^\.x \{\n  color: blue;\n\}/);
  const importCss = twin({ 'entry.uxdsl': '@import "x";\n.a { padding: space(2); }\n', 'x.css': '.x { color: blue; }\n' });
  assertSameAsTwin(importCss, '@import "x" of a .css');
  assert.match(importCss.actual.css, /^\.x \{\n  color: blue;\n\}/);
  assert.equal(importCss.actual.warnings.length, 1);
  assert.match(importCss.actual.warnings[0].text, /^UXD_SASS_WARNING: \[import\] /);
});

test('MIG-B9-12: @import of a .uxdsl loads and warns UXD_SASS_WARNING [import] (negative control): silenceDeprecations removes the warning and nothing else', () => {
  const dir = project({ 'entry.uxdsl': '.z { color: palette(primary.main); } @import "part";\n', '_part.uxdsl': '.p { padding: space(1); }\n' });
  const loud = inDir(dir, () => stage({ entry: path.join(dir, 'entry.uxdsl') }));
  const quiet = inDir(dir, () => stage({ entry: path.join(dir, 'entry.uxdsl') }, { sass: { silenceDeprecations: ['import'] } }));
  assert.equal(loud.warnings.length, 1);
  assert.deepEqual(quiet.warnings, []);
  assert.equal(quiet.css, loud.css);
});

// --- T3: pkg: and load paths (IM3, IM5) ---------------------------------------------------

const PKG = {
  'node_modules/scss-kit/package.json': JSON.stringify({ name: 'scss-kit', exports: { '.': { sass: './index.scss' }, './sub': { sass: './sub/_sub.scss' } } }),
  'node_modules/scss-kit/index.scss': '@use "inner";\n@use "tokens";\n.kit { color: inner.$c; width: tokens.$w; }\n',
  'node_modules/scss-kit/_inner.scss': '$c: red;\n',
  'node_modules/scss-kit/_tokens.uxdsl': '$w: 1px;\n',
  'node_modules/scss-kit/sub/_sub.scss': '.sub { color: green; }\n',
  'node_modules/css-kit/package.json': JSON.stringify({ name: 'css-kit', exports: { '.': { style: './kit.css' } } }),
  'node_modules/css-kit/kit.css': '.css-kit { color: blue; }\n',
  'node_modules/root-kit/package.json': JSON.stringify({ name: 'root-kit', sass: '_index.scss' }),
  'node_modules/root-kit/_index.scss': '.root-kit { color: red; }\n',
};

test('MIG-B9-12: pkg: resolves a package\'s scss and css; a bare package path resolves through node_modules, .uxdsl partials included; a .uxdsl export is UXD_SASS with Sass\'s reason', () => {
  // pkg: through NodePackageImporter: a scss export whose relative partials include a .uxdsl, a css export, the root "sass" field, a subpath.
  const pkg = twin({ ...PKG, 'entry.uxdsl': '@use "pkg:scss-kit";\n@use "pkg:css-kit";\n@use "pkg:root-kit";\n@use "pkg:scss-kit/sub";\n.a { padding: space(2); }\n' }, {
    dartOptions: { importers: [new sass.NodePackageImporter()] },
  });
  assertSameAsTwin(pkg, 'pkg:');
  assert.ok(pkg.actual.loadedFiles.includes(path.join(pkg.ux, 'node_modules/scss-kit/_tokens.uxdsl')), 'a .scss of a pkg: package reaches a sibling .uxdsl partial');
  // A bare path through the node_modules chain, the outer directory included.
  assertSameAsTwin(twin({ 'app/entry.uxdsl': '@use "theme-kit/scss/base";\n', 'node_modules/theme-kit/scss/_base.scss': '.base { color: red; }\n' }, { entry: 'app/entry' }), 'bare path');
  // The nearest node_modules wins.
  assertSameAsTwin(twin({
    'app/entry.uxdsl': '@use "kit/base";\n',
    'app/node_modules/kit/_base.scss': '.near { b: c; }\n',
    'node_modules/kit/_base.uxdsl': '.outer { b: c; }\n',
  }, { entry: 'app/entry' }), 'nearest node_modules');
  // A relative file beats a load path; a bare .uxdsl partial in a package is reached through the load paths.
  assertSameAsTwin(twin({ 'app/entry.uxdsl': '@use "kit/base";\n', 'app/kit/_base.uxdsl': '.relative{b:c}\n', 'app/node_modules/kit/_base.uxdsl': '.loadpath{b:c}\n' }, { entry: 'app/entry' }), 'relative first');
  assertSameAsTwin(twin({ 'entry.uxdsl': '@use "kit";\n@import "kit/legacy";\n', 'node_modules/kit/_index.uxdsl': '.idx{b:c}\n', 'node_modules/kit/_legacy.import.uxdsl': '.imp{b:c}\n', 'node_modules/kit/_legacy.uxdsl': '.use{b:c}\n' }), 'package index and .import variant');
  // quietDeps: a load-path package's deprecations are silenced, its @warn is not, and the entry's relative partial is not a dependency.
  const deps = {
    'entry.uxdsl': '@use "own";\n@use "kit/base";\n',
    '_own.uxdsl': '.d { w: (10px/2); }\n',
    'node_modules/kit/_base.uxdsl': '@use "child";\n.d { w: (10px/2); }\n@warn "kit warns";\n',
    'node_modules/kit/_child.uxdsl': '.d { w: (10px/2); }\n',
  };
  const quiet = twin(deps, { sassOptions: { quietDeps: true } });
  assertSameAsTwin(quiet, 'quietDeps');
  assert.deepEqual(quiet.actual.warnings.map((w) => path.relative(quiet.ux, w.file)), ['_own.uxdsl', 'node_modules/kit/_base.uxdsl']);
  assert.match(quiet.actual.warnings[0].text, /^UXD_SASS_WARNING: \[slash-div\] /);
  assert.equal(quiet.actual.warnings[1].text, 'UXD_SASS_WARNING: kit warns');
  assertSameAsTwin(twin(deps), 'without quietDeps');
  // A package's .uxdsl partial reached by a bare path keeps UXDSL's syntax protected.
  const dir = project({ 'entry.uxdsl': '@use "ux-kit/tokens";\n', 'node_modules/ux-kit/_tokens.uxdsl': '.kit { padding: space(10-2); color: palette(primary.main); }\n' });
  assert.equal(stage({ entry: path.join(dir, 'entry.uxdsl') }).css, '.kit {\n  padding: space(10-2);\n  color: palette(primary.main);\n}');
  // A .uxdsl and a .scss for one bare URL in one node_modules directory are ambiguous.
  const both = project({ 'entry.uxdsl': '@use "kit/base";\n', 'node_modules/kit/_base.uxdsl': '.a{b:c}\n', 'node_modules/kit/base.scss': '.b{b:c}\n' });
  const ambiguity = stageError(() => inDir(both, () => stage({ entry: path.join(both, 'entry.uxdsl') })));
  assert.equal(ambiguity.sassMessage, "It's not clear which file to import. Found:\n  node_modules/kit/base.scss\n  node_modules/kit/_base.uxdsl");
  assert.equal(`${ambiguity.line}:${ambiguity.column}`, '1:1');
});

test('MIG-B9-12: pkg: resolves a package\'s scss and css; a bare package path resolves through node_modules (negative control: no load path, ~, and a .uxdsl export)', () => {
  const dir = project({ 'entry.uxdsl': '@use "theme-kit/scss/base";\n', 'node_modules/theme-kit/scss/_base.scss': '.base { color: red; }\n' });
  const unresolved = stageError(() => stage({ entry: path.join(dir, 'entry.uxdsl') }, { loadPaths: [] }));
  assert.equal(unresolved.code, 'UXD_SASS');
  assert.equal(unresolved.sassMessage, "Can't find stylesheet to import.", 'the importer, not Sass, resolves bare paths');
  const tilde = project({ 'entry.uxdsl': '@use "~kit/base";\n', 'node_modules/kit/_base.uxdsl': '.base{b:c}\n' });
  assert.equal(stageError(() => stage({ entry: path.join(tilde, 'entry.uxdsl') })).sassMessage, "Can't find stylesheet to import.");
  const uxExport = project({
    'entry.uxdsl': '@use "pkg:ux-kit";\n',
    'node_modules/ux-kit/package.json': JSON.stringify({ name: 'ux-kit', exports: { '.': { sass: './index.uxdsl' } } }),
    'node_modules/ux-kit/index.uxdsl': '.kit { color: palette(primary.main); }\n',
  });
  const rejected = stageError(() => stage({ entry: path.join(uxExport, 'entry.uxdsl') }));
  assert.equal(rejected.code, 'UXD_SASS');
  assert.match(rejected.sassMessage, /^The export for 'root' in 'ux-kit' resolved to '.*index\.uxdsl', which is not a '\.scss', '\.sass', or '\.css' file\.$/);
  assert.equal(`${path.basename(rejected.file)}:${rejected.line}:${rejected.column}`, 'entry.uxdsl:1:1');
});

// Sass keeps only leading `..` segments in a URL, joins the URL to a load path without normalizing, and
// lets the filesystem walk that `..` from the load path itself: a `node_modules` that does not exist
// finds nothing, even for "../x", and a symlinked one leads where the link points.
const DOTDOT = [
  ['"../x" from a/b, with only a/b/_x (the entry\'s sibling)', { 'a/b/entry.uxdsl': '@use "../x";\n', 'a/b/_x.uxdsl': '.sibling { b: c; }\n' }, 'a/b/entry'],
  ['a stale "../../tokens", with only src/_tokens', { 'src/components/button.uxdsl': '@use "../../tokens";\n.b { c: d; }\n', 'src/_tokens.uxdsl': '.moved { a: b; }\n' }, 'src/components/button'],
  ['a partial\'s "../tokens", with an unrelated a/_tokens', { 'a/b/entry.uxdsl': '@use "c/btn";\n', 'a/b/c/_btn.uxdsl': '@use "../tokens";\n', 'a/_tokens.uxdsl': '.unrelated { a: b; }\n' }, 'a/b/entry'],
  ['"../theme" reaches the theme beside the one node_modules that exists', { 'app/src/main.uxdsl': '@use "../theme";\n', 'app/src/_theme.uxdsl': '.beside-the-entry { a: b; }\n', '_theme.uxdsl': '.beside-node-modules { a: b; }\n', node_modules: null }, 'app/src/main'],
  ['control: with every node_modules on the way, "../x" from a/b reaches a/b/_x', { 'a/b/entry.uxdsl': '@use "../x";\n', 'a/b/_x.uxdsl': '.sibling { b: c; }\n', 'a/b/node_modules': null, 'a/node_modules': null, node_modules: null }, 'a/b/entry'],
];

/** Links `app/node_modules` to `store/nm` (a junction on win32, which needs no privilege). */
const linkNodeModules = (dir) => fs.symlinkSync(path.join(dir, 'store/nm'), path.join(dir, 'app/node_modules'), 'junction');

test('MIG-B9-12: a URL that begins with .. is searched under each load path as Dart Sass searches it: a load path that does not exist finds nothing', () => {
  for (const [label, files, entry] of DOTDOT) assertSameAsTwin(twin(files, { entry }), label);
  // An explicit load path, relative to the working directory, that does not exist; then the same one existing.
  const part = { 'entry.uxdsl': '@use "../../part";\n', '_part.uxdsl': '.p { b: c; }\n' };
  const options = { stageOptions: { loadPaths: ['nope/deeper'] }, dartOptions: { loadPaths: ['nope/deeper'] } };
  const missing = twin(part, options);
  assertSameAsTwin(missing, 'an explicit load path that does not exist');
  assert.equal(missing.actual.error.sassMessage, "Can't find stylesheet to import.");
  const present = twin({ ...part, 'nope/deeper': null }, options);
  assertSameAsTwin(present, 'the same load path, existing');
  assert.equal(flat(present.actual.css), '.p { b: c; }');
  // A symlinked node_modules: Sass checks the file the filesystem reaches through the link's "..",
  // then loads the path as written.
  const linked = { 'app/src/deep/entry.uxdsl': '@use "../q";\n', 'app/_q.uxdsl': '.written { a: b; }\n', 'store/nm': null };
  assertSameAsTwin(twin(linked, { entry: 'app/src/deep/entry', prepare: linkNodeModules }), 'a symlinked node_modules, nothing where its ".." leads');
  const both = twin({ ...linked, 'store/_q.uxdsl': '.through-the-link { a: b; }\n' }, { entry: 'app/src/deep/entry', prepare: linkNodeModules });
  assertSameAsTwin(both, 'a symlinked node_modules, a file where its ".." leads');
  assert.equal(flat(both.actual.css), '.written { a: b; }');
});

// --- T4: Sass errors (E1) ------------------------------------------------------------------

const ERRORS = [
  ['a syntax error', { 'entry.uxdsl': '.a { padding: space(2); width: 1px + ; }\n' }],
  ['an error in a @use\'d mixin', { 'entry.uxdsl': '@use "mixins" as m;\n.a { @include m.broken(space(2)); }\n', '_mixins.uxdsl': '@mixin broken($c) {\n  color: $c; w: space(1);\n  width: 1px + 1em;\n}\n' }],
  ['@error', { 'entry.uxdsl': '.a { b: space(2); @error "boom #{1+1}"; }\n' }],
  ['an undefined variable after a tab and a token', { 'entry.uxdsl': '.a {\n\tcolor: space(2) $nope;\n}\n' }],
  ['a multi-line span with a declaration span and a token on a frame line', { 'entry.uxdsl': '@mixin m($a, $b) { x: space(2) $a; }\n.a {\n  @include m(\n    space(2)\n  );\n}\n' }],
  ['a multi-line span ending on a line with a token', { 'entry.uxdsl': '@mixin m($a, $b) { x: $a; }\n.a {\n  @include m(\n    1,\n    border(1) radius(pill), 3);\n}\n' }],
  ['a multi-line span starting after a token on its first line', { 'entry.uxdsl': '@mixin m($a) { x: $a; }\n.a { p: space(2); @include m(\n    1,\n    2); }\n' }],
  ['a declaration span in another file, on a line with a token', { 'entry.uxdsl': '@use "m";\n.a { p: space(2); @include m.x(1, 2); }\n', '_m.uxdsl': '.z { q: border(1); } @mixin x($a) { r: $a; }\n' }],
  ['an @import loop with tokens (two regions)', { 'entry.uxdsl': '.z { p: space(2); } @import "a";\n', '_a.uxdsl': '.y { p: space(1); } @import "a";\n' }],
  ['a @use loop', { 'entry.uxdsl': '@use "a";\n', '_a.uxdsl': '@use "b";\n.a { p: space(1); }\n', '_b.uxdsl': '@use "a";\n' }],
  ['a missing @use after a token', { 'entry.uxdsl': '@use "sass:math";\n.a { p: space(2); }\n@import "nope";\n' }],
];

test('MIG-B9-12: a Sass error is UXD_SASS at the author\'s file, line and translated column, with sassFrame and cause', () => {
  for (const [label, files] of ERRORS) {
    const run = twin(files);
    assertSameAsTwin(run, label, { exactFrame: true });
    const { error } = run.actual;
    assert.equal(error.code, 'UXD_SASS', label);
    assert.equal(error.message, `${error.file}:${error.line}:${error.column}: UXD_SASS: ${error.sassMessage}`, label);
    assert.ok(path.isAbsolute(error.file), label);
    assert.ok(error.cause instanceof sass.Exception, `${label}: cause is the sass.Exception`);
    assert.equal(error.sassMessage, error.cause.sassMessage, label);
    assert.ok(!error.sassFrame.startsWith(error.sassMessage), `${label}: sassFrame does not repeat the message`);
    assert.doesNotMatch(error.sassFrame, /#\{"/, `${label}: the frame shows the author's text`);
  }
  // The repository fixture: an undefined variable in a file that @uses a partial full of UXDSL.
  const fixture = stageError(() => inDir(MAPS, () => stage({ entry: path.join(MAPS, 'sass-error.uxdsl') })));
  assert.equal(`${path.basename(fixture.file)}:${fixture.line}:${fixture.column}`, 'sass-error.uxdsl:4:18');
  assert.equal(fixture.sassMessage, 'Undefined variable.');
  assert.match(fixture.sassFrame, /^4 │ {3}color: red; c: \$undefined;$/m);
});

test('MIG-B9-12: a Sass error is UXD_SASS at the author\'s file, line and translated column (negative control: Sass\'s own exception has the protected column and text, and colors under a terminal)', () => {
  const dir = project({ 'entry.uxdsl': '.a { color: palette(primary.main); width: 1px + 1em; }\n' });
  const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  process.stdout.isTTY = true;
  let error;
  let colored;
  try {
    error = stageError(() => inDir(dir, () => stage({ entry: path.join(dir, 'entry.uxdsl') })));
    try {
      sass.compileString('.a { w: 1px + 1em; }');
    } catch (direct) {
      colored = direct.message;
    }
  } finally {
    if (ttyDescriptor) Object.defineProperty(process.stdout, 'isTTY', ttyDescriptor);
    else delete process.stdout.isTTY;
  }
  assert.equal(error.column, 43);
  assert.equal(error.cause.span.start.column + 1, 48);
  assert.match(error.cause.message, /#\{"palette\(primary\.main\)"\}/);
  assert.match(error.cause.message, /1:48/);
  assert.doesNotMatch(error.sassFrame, /#\{|1:48/);
  assert.match(error.sassFrame, /^1 │ \.a \{ color: palette\(primary\.main\); width: 1px \+ 1em; \}$/m);
  assert.match(error.sassFrame, /entry\.uxdsl 1:43 {2}root stylesheet/);
  // Dart Sass colors its message when stdout is a terminal; the stage never does.
  assert.match(colored, /\u001b\[/);
  assert.doesNotMatch(error.cause.message, /\u001b\[/);
  assert.doesNotMatch(error.sassFrame, /\u001b\[/);
});

// --- T5: DEC-17, a shadowing @function in a loaded file (W5) --------------------------------

const HELPER = '@function space($k) { @return $k * 3px; }\n';
const shadowMessage = /^UXD_FUNCTION_SHADOWED: @function space \((.+):1\) replaces UXDSL's space\(\) in this build; rename it to use the token$/;

test('MIG-B9-12: @function space in a loaded partial gives Sass\'s output and one UXD_FUNCTION_SHADOWED at that file\'s line and column', () => {
  const cases = [
    ['a .scss partial with @import', { 'entry.uxdsl': '@import "helpers";\n.a { padding: space(2); margin: border(1); }\n', '_helpers.scss': HELPER }, '_helpers.scss'],
    ['a .scss partial with @use as *', { 'entry.uxdsl': '@use "helpers" as *;\n.a { padding: space(2); margin: border(1); }\n', '_helpers.scss': HELPER }, '_helpers.scss'],
    ['a .uxdsl partial with @import', { 'entry.uxdsl': '@import "helpers";\n.a { padding: space(2); margin: border(1); }\n', '_helpers.uxdsl': HELPER }, '_helpers.uxdsl'],
  ];
  for (const [label, files, definer] of cases) {
    const run = twin(files);
    assertSameAsTwin(run, label);
    assert.equal(run.actual.css, '.a {\n  padding: 6px;\n  margin: border(1);\n}', label);
    const shadow = run.actual.warnings.filter((w) => /^UXD_FUNCTION_SHADOWED:/.test(w.text));
    assert.equal(shadow.length, 1, label);
    assert.deepEqual({ file: shadow[0].file, line: shadow[0].line, column: shadow[0].column }, { file: path.join(run.ux, definer), line: 1, column: 11 }, label);
    assert.equal(shadowMessage.exec(shadow[0].text)[1], path.join(run.ux, definer), label);
  }
  // The other tokens of the files stay UXDSL's.
  const dir = project({ 'entry.uxdsl': '@import "helpers";\n.a { padding: space(2); color: palette(primary.main); w: space(10-2); }\n', '_helpers.scss': HELPER });
  assert.equal(stage({ entry: path.join(dir, 'entry.uxdsl') }).css, '.a {\n  padding: 6px;\n  color: palette(primary.main);\n  w: 24px;\n}');
});

test('MIG-B9-12: @function space in a loaded partial gives Sass\'s output and one UXD_FUNCTION_SHADOWED (negative control: a @mixin and a namespaced helper shadow nothing)', () => {
  const mixin = project({ 'entry.uxdsl': '@import "mix";\n.a { @include border(1px); border: border(1); color: palette(primary.main); }\n', '_mix.scss': '@mixin border($w) { outline: $w solid red; }\n' });
  const mixed = stage({ entry: path.join(mixin, 'entry.uxdsl') });
  assert.equal(mixed.css, '.a {\n  outline: 1px solid red;\n  border: border(1);\n  color: palette(primary.main);\n}');
  assert.equal(mixed.warnings.filter((w) => /^UXD_FUNCTION_SHADOWED:/.test(w.text)).length, 0);
  const namespaced = project({
    'entry.uxdsl': '@use "helpers";\n.a { margin: helpers.space(2); padding: space(2); w: space(10-2); }\n',
    'plain.uxdsl': '.a { margin: 6px; padding: space(2); w: space(10-2); }\n',
    '_helpers.scss': HELPER,
  });
  const result = stage({ entry: path.join(namespaced, 'entry.uxdsl') });
  assert.equal(result.css, stage({ entry: path.join(namespaced, 'plain.uxdsl') }).css);
  assert.deepEqual(result.warnings, []);
});

// Each case: the files, the expected CSS (null: Dart Sass's own output on the twin), and the
// UXD_FUNCTION_SHADOWED locations.
const H = '@function space($k) { @return $k * 3px; }\n';
const DEC17 = [
  ['T-a same file', { 'entry.uxdsl': '.a { color: red; }\n@function space($k) { @return $k * 3px; }\n.b { padding: space(2); }\n' }, null, ['entry.uxdsl:2:11']],
  ['T-b a .scss color via @import', { 'entry.uxdsl': '@import "helpers";\n.a { color: color(brand); }\n', '_helpers.scss': '@use "sass:map";\n$colors: (brand: #123456);\n@function color($name) { @return map.get($colors, $name); }\n' }, null, ['_helpers.scss:3:11']],
  ['T-c namespaced', { 'entry.uxdsl': '@use "helpers";\n.a { margin: helpers.space(2); padding: space(2); }\n', '_helpers.scss': H }, null, []],
  ['C-1 namespaced color and a color(white) token', { 'entry.uxdsl': '@use "helpers";\n.a { b: helpers.color(brand); c: color(white); }\n', '_helpers.scss': '@use "sass:map";\n$colors: (brand: #123456);\n@function color($name) { @return map.get($colors, $name); }\n' }, '.a { b: #123456; c: color(white); }', []],
  ['C-2 a function private to _a', { 'entry.uxdsl': '@use "a";\n@use "b";\n', '_a.uxdsl': `${H}.a { p: space(1); }\n`, '_b.uxdsl': '.b { p: space(10-2); q: palette(primary.main); }\n' }, '.a { p: 3px; } .b { p: space(10-2); q: palette(primary.main); }', ['_a.uxdsl:1:11']],
  ['C-3 @use as *', { 'entry.uxdsl': '@use "helpers" as *;\n.a { padding: space(2); }\n', '_helpers.scss': H }, null, ['_helpers.scss:1:11']],
  ['P1 pass 1 throws (space(2) * 2)', { 'entry.uxdsl': '@import "helpers";\n.a { margin: space(2) * 2; }\n', '_helpers.scss': '@function space($k) { @return $k * 4px; }\n' }, null, ['_helpers.scss:1:11']],
  ['P2 two arithmetic sites', { 'entry.uxdsl': '@import "helpers";\n.a { w: space(2) * 2; }\n.b { w: space(3) * 2; }\n', '_helpers.scss': '@function space($k) { @return $k * 4px; }\n' }, null, ['_helpers.scss:1:11']],
  ['M1 a mixin before and after @import', { 'entry.uxdsl': '@import "mix";\n.before { @include m; }\n@import "helpers";\n.after { @include m; }\n', '_mix.uxdsl': '@mixin m { v: space(2); }\n', '_helpers.scss': H }, null, ['_helpers.scss:1:11']],
  ['M2 a mixin, the helper imported later, one include', { 'entry.uxdsl': '@import "mix";\n@import "helpers";\n.a { @include m; }\n', '_mix.uxdsl': '@mixin m { v: space(2); w: space(10-2); }\n', '_helpers.scss': H }, '.a { v: 6px; w: 24px; }', ['_helpers.scss:1:11']],
  ['M3 a mixed site with an unstable key', { 'entry.uxdsl': '@import "m";\n.x { @include m; }\n@import "helpers";\n.y { @include m; }\n', '_m.uxdsl': '@mixin m { p: space(10-2); }\n', '_helpers.scss': H }, '.x { p: space(10-2); } .y { p: 24px; }', ['_helpers.scss:1:11']],
  ['I2 a partial imported around a definition', { 'entry.uxdsl': '@import "p";\n@function space($k) { @return $k * 3px; }\n@import "p";\n', '_p.uxdsl': '.p { v: space(2); }\n' }, null, ['entry.uxdsl:2:11']],
  ['L1 a style-rule-local @function', { 'entry.uxdsl': '.x {\n  @function space($k) { @return 1px; }\n  a: space(2);\n}\n.y { b: space(10-2); }\n' }, '.x { a: 1px; } .y { b: space(10-2); }', ['entry.uxdsl:2:13']],
  ['K1 a custom property and calc, visible', { 'entry.uxdsl': '@import "helpers";\n.a { --x: space(2); y: calc(space(2) + 1px); }\n', '_helpers.scss': H }, null, ['_helpers.scss:1:11']],
  ['K1b a custom property only, visible', { 'entry.uxdsl': '@import "helpers";\n.a { --x: space(10-2); }\n', '_helpers.scss': H }, '.a { --x: space(10-2); }', []],
  ['K1c a directive parameter only, visible radius', { 'entry.uxdsl': '@import "helpers";\n.a { @ds-surface(contained radius(2)); }\n', '_helpers.scss': '@function radius($k) { @return $k * 1px; }\n' }, '.a { @ds-surface (contained radius(2)); }', []],
  ['K2 calc with a token, the helper namespaced', { 'entry.uxdsl': '@use "helpers";\n.a { y: calc(100% - space(4)); z: helpers.space(1); }\n', '_helpers.scss': H }, null, []],
  ['MC a mixed site inside calc', { 'entry.uxdsl': '@import "p";\n@function space($k) { @return $k * 3px; }\n@import "p";\n', '_p.uxdsl': '.p { w: calc(space(2) + 1px); }\n' }, '.p { w: calc(space(2) + 1px); } .p { w: 7px; }', ['entry.uxdsl:2:11']],
  ['MK a mixed site in a custom property', { 'entry.uxdsl': '@import "p";\n@function space($k) { @return $k * 3px; }\n@import "p";\n', '_p.uxdsl': '.p { --w: space(10-2); }\n' }, '.p { --w: space(10-2); } .p { --w: space(10-2); }', []],
  ['MCOL a mixed color', { 'entry.uxdsl': '@import "p";\n@function color($k) { @return red; }\n@import "p";\n', '_p.uxdsl': '.p { c: color(white); }\n' }, '.p { c: color(white); } .p { c: red; }', ['entry.uxdsl:2:11']],
  ['W1 @forward as h-*', { 'entry.uxdsl': '@use "lib" as *;\n.a { v: space(2); w: h-space(2); }\n', '_lib.scss': '@forward "helpers" as h-*;\n', '_helpers.scss': H }, null, []],
  ['W2 @forward hide', { 'entry.uxdsl': '@use "lib" as *;\n.a { v: space(2); }\n', '_lib.scss': '@forward "helpers" hide space;\n', '_helpers.scss': H }, null, []],
  ['W3 an @forward chain as *', { 'entry.uxdsl': '@use "lib" as *;\n.a { v: space(2); }\n', '_lib.scss': '@forward "helpers";\n', '_helpers.scss': H }, null, ['_helpers.scss:1:11']],
  ['D2 a namespaced helper and the entry\'s own', { 'entry.uxdsl': '@use "helpers";\n@function space($k) { @return $k * 5px; }\n.a { v: space(2); w: helpers.space(2); }\n', '_helpers.scss': H }, null, ['entry.uxdsl:2:11']],
  ['B1 @function md in a .scss via @import', { 'entry.uxdsl': '@import "bp";\n.a { padding: md(2px); }\n', '_bp.scss': '@function md($v) { @return $v * 2; }\n' }, null, ['_bp.scss:1:11']],
  ['B2 @function md namespaced only', { 'entry.uxdsl': '@use "bp";\n.a { padding: md(2px); q: bp.md(1px); }\n', '_bp.scss': '@function md($v) { @return $v * 2; }\n' }, null, []],
  ['O3 md in the same file', { 'entry.uxdsl': '@function md($v) { @return $v; }\n.a { padding: md(2px); }\n' }, null, ['entry.uxdsl:1:11']],
  ['U1 a helper used by a .scss partial only', { 'entry.uxdsl': '@use "part";\n.a { v: space(10-2); }\n', '_part.scss': '@use "helpers" as *;\n.p { v: space(2); }\n', '_helpers.scss': H }, '.p { v: 6px; } .a { v: space(10-2); }', []],
  ['ORD a call before the @import', { 'entry.uxdsl': '.x { p: space(10-2); }\n@import "helpers";\n.a { p: space(2); }\n', '_helpers.scss': H }, '.x { p: space(10-2); } .a { p: 6px; }', ['_helpers.scss:1:11']],
  ['ORD2 a $var before @use as *', { 'entry.uxdsl': '$v: space(10-2);\n@use "helpers" as *;\n.a { b: $v; c: space(2); }\n', '_helpers.scss': H }, '.a { b: space(10-2); c: 6px; }', ['_helpers.scss:1:11']],
  ['PAL an unparseable palette(primary.main)', { 'entry.uxdsl': '@import "helpers";\n.a { c: palette(primary.main); d: palette(brand); }\n', '_helpers.scss': '@function palette($n) { @return red; }\n' }, '.a { c: palette(primary.main); d: red; }', ['_helpers.scss:1:11']],
  ['ERR an author @error at a user site', { 'entry.uxdsl': '@import "helpers";\n.a { c: space(9); }\n', '_helpers.scss': '@function space($k) { @error "no #{$k}"; }\n' }, null, null],
  ['NONE no definition', { 'entry.uxdsl': '@use "p";\n.a { v: space(10-2); }\n', '_p.uxdsl': '.p { w: color(white); }\n' }, '.p { w: color(white); } .a { v: space(10-2); }', []],
  ['PKG a pkg: helper used as *', {
    'entry.uxdsl': '@use "pkg:kit" as *;\n.a { v: space(2); w: space(10-2); }\n',
    'node_modules/kit/package.json': JSON.stringify({ name: 'kit', exports: { '.': { sass: './index.scss' } } }),
    'node_modules/kit/index.scss': H,
  }, '.a { v: 6px; w: 24px; }', ['node_modules/kit/index.scss:1:11']],
  ['LP a load-path .uxdsl helper used only through a namespace', { 'entry.uxdsl': '@use "kit/helpers";\n.a { v: space(2); w: helpers.space(1); }\n', 'node_modules/kit/_helpers.uxdsl': H }, '.a { v: space(2); w: 3px; }', []],
  ['SASS an indented .sass helper', { 'entry.uxdsl': '@import "helpers";\n.a { v: space(2); }\n', '_helpers.sass': '@function space($k)\n  @return $k * 3px\n' }, null, ['_helpers.sass:1:11']],
  ['GRAY color(gray.300) with a visible project color()', { 'entry.uxdsl': '@import "helpers";\n.a { c: color(gray.300); d: color(brand); }\n', '_helpers.scss': '@function color($n) { @return red; }\n' }, '.a { c: red; d: red; }', ['_helpers.scss:1:11']],
];

test('MIG-B9-12: a project function wins exactly where Dart Sass calls its bare name, decided per call site', () => {
  for (const [label, files, expectCss, expectShadow] of DEC17) {
    const run = twin(files, { dartOptions: { importers: [new sass.NodePackageImporter()] } });
    if (expectCss === null) {
      assertSameAsTwin(run, label);
    } else {
      assert.ok(!run.actual.error, `${label}: ${run.actual.error && run.actual.error.message}`);
      assert.equal(flat(run.actual.css), expectCss, label);
      // Where the twin compiles, the stage reports exactly its Sass warnings: the probe passes add none.
      if (!run.expected.error) assert.deepEqual(sassWarnings(run.actual.warnings).map(warningOf(run.ux)), run.expected.warnings.map(warningOf(run.sc)), `${label}: warnings`);
    }
    if (expectShadow !== null) assert.deepEqual(shadowOf(run.ux, run.actual), [...expectShadow].sort(), `${label}: UXD_FUNCTION_SHADOWED`);
    for (const w of run.actual.warnings || []) if (/^UXD_FUNCTION_SHADOWED:/.test(w.text)) assert.match(w.text, /^UXD_FUNCTION_SHADOWED: @function [a-z-]+ \(.+:\d+\) replaces UXDSL's [a-z-]+\(\) in this build; rename it to use the token$/, label);
  }
});

/** The second-compile recipe recorded in MIG-B9-11's story, as written there: scan every loaded file, unprotect the names for the whole build, compile again. */
function perBuildRecipe(dir) {
  const entry = path.join(dir, 'entry.uxdsl');
  const read = (file) => fs.readFileSync(file, 'utf8');
  const candidates = (p) => {
    const partial = path.join(path.dirname(p), `_${path.basename(p)}`);
    return [`${partial}.uxdsl`, `${p}.uxdsl`, `${partial}.scss`, `${p}.scss`];
  };
  const importerFor = (unprotected) => ({
    canonicalize(url, { containingUrl }) {
      const base = url.startsWith('file:') ? fileURLToPath(url) : containingUrl ? fileURLToPath(new URL(url, containingUrl)) : null;
      const found = base && candidates(base).find((file) => fs.existsSync(file));
      return found ? pathToFileURL(found) : null;
    },
    load(url) {
      const file = fileURLToPath(url);
      return file.endsWith('.uxdsl') ? { contents: protect(read(file), { reserved: RESERVED, unprotected, file }).code, syntax: 'scss' } : { contents: read(file), syntax: 'scss' };
    },
  });
  const once = (unprotected) => sass.compileString(protect(read(entry), { reserved: RESERVED, unprotected, file: entry }).code, { url: pathToFileURL(entry), importer: importerFor(unprotected), style: 'expanded', logger: sass.Logger.silent });
  const first = once([]);
  const problems = first.loadedUrls.map((url) => fileURLToPath(url)).flatMap((file) => findShadowingFunctions(read(file), { reserved: RESERVED, file }));
  const names = [...new Set(problems.map((problem) => problem.name))];
  try {
    return { css: flat((names.length ? once(names) : first).css), warned: problems.length };
  } catch (error) {
    return { error: error.sassMessage, warned: problems.length };
  }
}

test('MIG-B9-12: a project function wins exactly where Dart Sass calls its bare name, decided per call site (negative control: the per-build recipe is wrong where the stage is right)', () => {
  const files = (label) => side(DEC17.find(([id]) => id.startsWith(label))[1], 'uxdsl');
  const c1 = project(files('C-1'));
  const c2 = project(files('C-2'));
  const tc = project(files('T-c'));
  const l1 = project(files('L1'));
  assert.equal(perBuildRecipe(c1).error, '$description: white is not a string.');
  assert.match(perBuildRecipe(c2).css, /space\(8\)/);
  assert.equal(perBuildRecipe(tc).warned, 1);
  assert.match(flat(stage({ entry: path.join(c1, 'entry.uxdsl') }).css), /c: color\(white\);/);
  for (const dir of [c2, l1]) {
    const css = stage({ entry: path.join(dir, 'entry.uxdsl') }).css;
    assert.match(css, /space\(10-2\)/);
    assert.doesNotMatch(css, /space\(8\)/);
  }
  assert.deepEqual(stage({ entry: path.join(tc, 'entry.uxdsl') }).warnings, []);
});

/** Counts the Dart Sass compiles of `fn` (the stage calls compileString on the module it shares with this test). */
function countCompiles(fn) {
  const original = sass.compileString;
  let calls = 0;
  sass.compileString = function counted(...args) {
    calls++;
    return original.apply(this, args);
  };
  try {
    fn();
  } finally {
    sass.compileString = original;
  }
  return calls;
}

test('MIG-B9-12: a build that defines no shadowing function runs Dart Sass once and equals Dart Sass on the renamed .scss', () => {
  const files = {
    'entry.uxdsl': '@use "sass:math";\n@use "tokens" as t;\n@use "mixins" as *;\n.card { @include pad(2); width: math.div(t.$w, 2); border: border(1); }\n@each $n in 1, 2 {\n  .s-#{$n} { padding: space($n); margin: radius(pill); }\n}\n',
    '_tokens.uxdsl': '$w: 100px;\n$radii: (sm: 4px, lg: 8px);\n',
    '_mixins.uxdsl': '@use "sass:map";\n@use "tokens";\n@mixin pad($k) { padding: space($k); border-radius: map.get(tokens.$radii, lg); }\n',
  };
  let run;
  const calls = countCompiles(() => {
    run = twin(files);
  });
  assertSameAsTwin(run, 'no definition');
  assert.equal(calls, 1, 'one Dart Sass compile');
});

test('MIG-B9-12: a build that defines no shadowing function runs Dart Sass once (negative control: a build with a shadowing helper runs the probe)', () => {
  const dir = project({ 'entry.uxdsl': '@import "helpers";\n.a { padding: space(2); }\n', '_helpers.scss': H });
  const calls = countCompiles(() => stage({ entry: path.join(dir, 'entry.uxdsl') }));
  assert.ok(calls > 1, `${calls} compiles`);
});

// --- T6: warnings (W1–W4) --------------------------------------------------------------------

const many = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
const TOKENS = ' padding: space(2) space(3);';

test('MIG-B9-12: deprecation warnings are located, capped by Sass, and silenceDeprecations removes a type; @warn is reported; debug is dropped', () => {
  assertSameAsTwin(twin({ 'entry.uxdsl': `.z {${TOKENS} }\n@import "a";\n`, '_a.uxdsl': `.a {${TOKENS} }\n` }), 'an import deprecation');
  const located = twin({ 'entry.uxdsl': `.a {${TOKENS} w: (10px/2); }\n` });
  assertSameAsTwin(located, 'a deprecation after protected tokens');
  assert.ok(located.actual.warnings[0].column > `.a {${TOKENS} w: `.length, 'past the tokens, at the author\'s column');
  const capped = twin({ 'entry.uxdsl': many(8, (i) => `.s${i} { w: (${i}px/2); p: space(2); }\n`) + many(7, (i) => `.g${i} { w: percentage(0.${i + 1}); }\n`) });
  assertSameAsTwin(capped, 'the cap');
  assert.equal(capped.actual.warnings.length, 11);
  assert.deepEqual(capped.actual.warnings.slice(-1), [{ text: 'UXD_SASS_WARNING: 5 repetitive deprecation warnings omitted.' }]);
  const warned = twin({ 'entry.uxdsl': '@use "w";\n.a { @include w.m; }\n', '_w.uxdsl': `@mixin m {\n ${TOKENS} @warn "careful";\n}\n` });
  assertSameAsTwin(warned, '@warn in a mixin of a partial');
  assert.deepEqual(warned.actual.warnings.map((w) => `${path.basename(w.file)}:${w.line}:${w.column} ${w.text}`), [`_w.uxdsl:2:${` ${TOKENS} `.length + 1} UXD_SASS_WARNING: careful`]);
  assertSameAsTwin(twin({ 'entry.uxdsl': `.a {${TOKENS} }\n@warn "root warn";\n` }), '@warn at the root');
  const debug = twin({ 'entry.uxdsl': '@debug "dbg";\n.a { b: c; }\n' });
  assertSameAsTwin(debug, '@debug');
  assert.deepEqual(debug.actual.warnings, []);
  const notices = twin({ 'entry.uxdsl': '.a { b: c; }\n' }, { sassOptions: { silenceDeprecations: ['mixed-decls', 'not-a-real-id'] } });
  assertSameAsTwin(notices, 'an obsolete and an unknown id');
  assert.deepEqual(notices.actual.warnings, [
    { text: 'UXD_SASS_WARNING: Invalid deprecation "not-a-real-id".' },
    { text: 'UXD_SASS_WARNING: mixed-decls deprecation is obsolete. If you were previously silencing it, your code may now behave in unexpected ways.' },
  ]);
  assertSameAsTwin(twin({ 'entry.uxdsl': '@use "kit/base";\n.a { w: (10px/2); }\n', 'node_modules/kit/_base.uxdsl': '.d { w: (10px/2); }\n' }, { sassOptions: { quietDeps: true } }), 'quietDeps');
  // A cwd inside a directory whose name has a space: Sass prints the @warn frame relative to it.
  const spaced = project({ 'sub dir/entry.uxdsl': '@use "w";\n.a { @include w.m; }\n', 'sub dir/_w.uxdsl': `@mixin m {\n ${TOKENS} @warn "careful";\n}\n` });
  const fromInside = inDir(path.join(spaced, 'sub dir'), () => stage({ entry: path.join(spaced, 'sub dir/entry.uxdsl') }));
  assert.deepEqual(fromInside.warnings, [{ text: 'UXD_SASS_WARNING: careful', file: path.join(spaced, 'sub dir/_w.uxdsl'), line: 2, column: ` ${TOKENS} `.length + 1 }]);
});

test('MIG-B9-12: deprecation warnings are located, capped by Sass, and silenceDeprecations removes a type (negative control: only the silenced type disappears)', () => {
  const dir = project({ 'entry.uxdsl': '@import "a";\n.z { w: (10px/2); }\n', '_a.uxdsl': '.a { b: c; }\n' });
  const ids = (options) => stage({ entry: path.join(dir, 'entry.uxdsl') }, options).warnings.map((w) => (/^UXD_SASS_WARNING: \[([a-z-]+)\]/.exec(w.text) || [])[1]);
  assert.deepEqual(ids({}), ['import', 'slash-div']);
  assert.deepEqual(ids({ sass: { silenceDeprecations: ['import'] } }), ['slash-div']);
  const summary = stage({ entry: path.join(project({ 'entry.uxdsl': many(6, (i) => `.s${i} { w: (${i}px/2); }\n`) }), 'entry.uxdsl') }).warnings.pop();
  assert.deepEqual(summary, { text: 'UXD_SASS_WARNING: 1 repetitive deprecation warnings omitted.' });
});

// --- T7: the source map (M1–M3) ----------------------------------------------------------------

/** The generated position of heavy.uxdsl's `inset: space(404)` declaration. */
function insetPosition(css) {
  const lines = css.split('\n');
  const index = lines.findIndex((line) => line.includes('inset: space(404)'));
  assert.ok(index >= 0, 'the inset declaration is in the output');
  return { line: index + 1, column: lines[index].indexOf('inset') };
}

test('MIG-B9-12: the map\'s original columns are translated, sources are absolute paths, sourcesContent is the original text', () => {
  const heavy = path.join(MAPS, 'heavy.uxdsl');
  const result = stage({ entry: heavy }, { sourceMap: true });
  const original = new SourceMapConsumer(result.map).originalPositionFor(insetPosition(result.css));
  assert.deepEqual({ source: original.source, line: original.line, column: original.column }, { source: heavy, line: 18, column: 65 });
  assert.ok(result.map.sources.length >= 2);
  for (const source of result.map.sources) {
    assert.ok(path.isAbsolute(source), source);
    assert.doesNotMatch(source, /^(file|data):/);
  }
  assert.deepEqual(result.map.sources.slice().sort(), [path.join(MAPS, '_mixins.uxdsl'), heavy].sort());
  assert.equal(result.map.sourcesContent[result.map.sources.indexOf(heavy)], fs.readFileSync(heavy, 'utf8'));
  assert.equal(result.map.sourcesContent[result.map.sources.indexOf(path.join(MAPS, '_mixins.uxdsl'))], fs.readFileSync(path.join(MAPS, '_mixins.uxdsl'), 'utf8'));
  assert.ok(result.map.sourcesContent.every((content) => !content.includes('#{"')), 'the protected text never appears');
  assert.doesNotMatch(result.css, /sourceMappingURL/);
});

test('MIG-B9-12: the map\'s original columns are translated (negative control: no map without sourceMap, and Sass\'s own map points at the protected column)', () => {
  const heavy = path.join(MAPS, 'heavy.uxdsl');
  assert.equal(stage({ entry: heavy }, { sourceMap: false }).map, undefined);
  const importer = {
    canonicalize(url) {
      if (!url.startsWith('file:')) return null;
      const file = fileURLToPath(url);
      const partial = path.join(path.dirname(file), `_${path.basename(file)}.uxdsl`);
      return fs.existsSync(partial) ? pathToFileURL(partial) : null;
    },
    load(url) {
      return { contents: protect(fs.readFileSync(fileURLToPath(url), 'utf8'), { reserved: RESERVED }).code, syntax: 'scss', sourceMapUrl: url };
    },
  };
  const raw = sass.compileString(protect(fs.readFileSync(heavy, 'utf8'), { reserved: RESERVED }).code, { url: pathToFileURL(heavy), importer, sourceMap: true, logger: sass.Logger.silent });
  const position = new SourceMapConsumer(raw.sourceMap).originalPositionFor(insetPosition(raw.css));
  assert.equal(`${position.line}:${position.column}`, '18:80');
});

// --- T8: loadedFiles (IM6) --------------------------------------------------------------------------

test('MIG-B9-12: loadedFiles lists the entry first and every loaded file once', () => {
  const run = twin({
    'entry.uxdsl': '@use "sass:math";\n@use "a";\n@import "p";\n@import "p";\n@import "x.css";\n.e { w: math.div(1px, 2); p: space(2); }\n',
    '_a.uxdsl': '@use "b";\n.a { b: c; }\n',
    '_b.uxdsl': '.b { b: c; }\n',
    '_p.uxdsl': '.p { b: c; }\n',
  });
  assertSameAsTwin(run, 'loadedFiles');
  assert.deepEqual(run.actual.loadedFiles.map((file) => path.relative(run.ux, file)), ['entry.uxdsl', '_a.uxdsl', '_b.uxdsl', '_p.uxdsl']);
  // On a case-insensitive filesystem, one file reached through two spellings is one canonical file, in its on-disk case.
  const cased = twin({ 'entry.uxdsl': '@use "Button";\n@use "button" as b2;\n', 'button.uxdsl': '.btn { b: c; }\n' });
  assertSameAsTwin(cased, 'two spellings of one file');
  if (process.platform === 'darwin' || process.platform === 'win32') {
    assert.deepEqual(cased.actual.loadedFiles.map((file) => path.relative(cased.ux, file)), ['entry.uxdsl', 'button.uxdsl']);
    assert.equal(cased.actual.css, '.btn {\n  b: c;\n}');
  } else {
    assert.equal(cased.actual.error.sassMessage, "Can't find stylesheet to import.");
  }
});

// --- T9: an in-memory source (IM3) -------------------------------------------------------------------

test('MIG-B9-12: an in-memory source whose entry path does not exist resolves its relative @use', () => {
  const dir = project({
    '_part.uxdsl': '.p { c: palette(primary.main); }\n',
    'node_modules/kit/package.json': JSON.stringify({ name: 'kit', exports: { '.': { sass: './i.scss' } } }),
    'node_modules/kit/i.scss': '.kit { a: b; }\n',
  });
  const entry = path.join(dir, 'missing/deeper/virtual.uxdsl');
  const source = '@use "../../part";\n@use "pkg:kit";\n.v { w: space(10-2); }\n';
  const result = stage({ entry, source }, { sourceMap: true });
  assert.equal(result.css, '.p {\n  c: palette(primary.main);\n}\n\n.kit {\n  a: b;\n}\n\n.v {\n  w: space(10-2);\n}');
  assert.deepEqual(result.loadedFiles.map((file) => path.relative(dir, file)), ['missing/deeper/virtual.uxdsl', '_part.uxdsl', 'node_modules/kit/i.scss']);
  assert.equal(result.map.sourcesContent[result.map.sources.indexOf(entry)], source);
});

test('MIG-B9-12: an in-memory source whose entry path does not exist resolves its relative @use (negative control: another directory, and the text on disk never compiles)', () => {
  const dir = project({ '_part.uxdsl': '.p { c: red; }\n', 'real.uxdsl': '.disk { a: b; }\n' });
  // The same source in a sibling directory, with the default load paths: none of them exists, so "../../part" is not found.
  const virtual = path.join(dir, 'elsewhere/virtual.uxdsl');
  const elsewhere = stageError(() => stage({ entry: virtual, source: '@use "../../part";\n' }));
  assert.equal(elsewhere.code, 'UXD_SASS');
  assert.equal(elsewhere.sassMessage, "Can't find stylesheet to import.");
  // Dart Sass on the .scss twin, with the same load paths, says the same.
  const twinDir = project({ '_part.scss': '.p { c: red; }\n' });
  const twinEntry = path.join(twinDir, 'elsewhere/virtual.scss');
  assert.throws(() => sass.compileString('@use "../../part";\n', { url: pathToFileURL(twinEntry), loadPaths: nodeModulesChain(twinEntry), logger: sass.Logger.silent }), { sassMessage: "Can't find stylesheet to import." });
  const memory = stage({ entry: path.join(dir, 'real.uxdsl'), source: '@use "part";\n.mem { a: b; }\n' });
  assert.equal(memory.css, '.p {\n  c: red;\n}\n\n.mem {\n  a: b;\n}');
  assert.doesNotMatch(memory.css, /disk/);
});

// --- T10: the catalog -------------------------------------------------------------------------------

test('MIG-B9-12: DIAGNOSTIC_CATALOG lists UXD_SASS and UXD_SASS_WARNING with owner core, and no UXD_RESERVED_NAME', () => {
  for (const code of ['UXD_SASS', 'UXD_SASS_WARNING']) {
    const entry = DIAGNOSTIC_CATALOG[code];
    assert.ok(entry, `${code} is catalogued`);
    assert.equal(entry.owner, 'core', code);
    assert.ok(entry.meaning.length > 20 && entry.fix.length > 10, code);
  }
  assert.equal(DIAGNOSTIC_CATALOG.UXD_RESERVED_NAME, undefined, 'a shadowing @function is a warning (UXD_FUNCTION_SHADOWED), never an error');
  assert.equal(DIAGNOSTIC_CATALOG.UXD_FUNCTION_SHADOWED.owner, 'compiler');
  // Both codes are produced for real by the stage (T4 and T6 provoke them), and the catalog still refuses an unknown one.
  const dir = project({ 'entry.uxdsl': '@import "a";\n.b { c: $nope; }\n', '_a.uxdsl': '.a { b: c; }\n' });
  const error = stageError(() => stage({ entry: path.join(dir, 'entry.uxdsl') }));
  assert.equal(error.code, 'UXD_SASS');
  assert.match(error.message, /: UXD_SASS: Undefined variable\.$/);
  const warned = stage({ entry: path.join(dir, 'virtual.uxdsl'), source: '@import "a";\n' });
  assert.match(warned.warnings[0].text, /^UXD_SASS_WARNING: \[import\] /);
  assert.throws(() => diagnostic('UXD_NOT_A_CODE: nothing'), /not in DIAGNOSTIC_CATALOG/);
});

// --- T12: Dart Sass is loaded only when the stage runs (DEC-04) -----------------------------------------

/** In a fresh process with cwd packages/uxdsl: whether Dart Sass's entry is in require.cache after requiring `specifier` and running `then`. */
function sassLoadedAfter(specifier, then = '') {
  const code = `const sassMain = require.resolve('sass');
const loaded = require(${JSON.stringify(specifier)});
const before = Boolean(require.cache[sassMain]);
${then}
process.stdout.write(JSON.stringify({ before, after: Boolean(require.cache[sassMain]) }));`;
  const child = spawnSync(process.execPath, ['-e', code], { cwd: PACKAGE, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

test('MIG-B9-12: requiring uxdsl/postcss, uxdsl or the stage module leaves sass out of require.cache; the first compileSassStage call loads it', () => {
  assert.deepEqual(sassLoadedAfter('uxdsl/postcss'), { before: false, after: false });
  assert.deepEqual(sassLoadedAfter('uxdsl'), { before: false, after: false });
  const dir = project({ 'entry.uxdsl': '.a { padding: space(2); }\n' });
  const call = `loaded.compileSassStage({ entry: ${JSON.stringify(path.join(dir, 'entry.uxdsl'))} }, { reserved: [], sourceMap: false });`;
  assert.deepEqual(sassLoadedAfter(STAGE_MODULE, call), { before: false, after: true });
});

test('MIG-B9-12: requiring uxdsl/postcss, uxdsl or the stage module leaves sass out of require.cache (negative control: a module that requires sass at load is detected)', () => {
  const dir = project({});
  const planted = path.join(dir, 'eager.js');
  fs.writeFileSync(planted, `module.exports = require(${JSON.stringify(require.resolve('sass', { paths: [PACKAGE] }))});\n`);
  assert.deepEqual(sassLoadedAfter(planted), { before: true, after: true });
});

// --- T13: files are read as Dart Sass reads them ------------------------------------------------------------

const INVALID = Buffer.concat([Buffer.from('.a { content: "a'), Buffer.from([0xff]), Buffer.from('b"; }\n')]);

test('MIG-B9-12: files are read as Dart Sass reads them: invalid UTF-8 is UXD_SASS at the byte; a BOM and CRLF keep Sass\'s positions', () => {
  const cases = [
    ['an invalid byte in a partial', { 'entry.uxdsl': '@use "p";\n', '_p.uxdsl': INVALID }],
    ['an invalid byte in the entry', { 'entry.uxdsl': INVALID }],
    ['a literal U+FFFD in a partial', { 'entry.uxdsl': '@use "p";\n', '_p.uxdsl': '.l { content: "�"; }\n' }],
    ['an error after a BOM', { 'entry.uxdsl': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('.e { c: $nope; }\n')]) }],
  ];
  for (const [label, files] of cases) {
    const run = twin(files);
    assert.ok(run.expected.error && run.actual.error, label);
    assert.equal(run.actual.error.sassMessage, run.expected.error.sassMessage, label);
    assert.equal(stageLocation(run.ux, run.actual.error), twinLocation(run.sc, run.expected.error), label);
    assert.equal(run.actual.error.code, 'UXD_SASS', label);
  }
  const bom = twin({ 'entry.uxdsl': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('.e { c: $nope; }\n')]) });
  assert.equal(`${bom.actual.error.line}:${bom.actual.error.column}`, '1:10', 'the BOM is a column, as in Dart Sass');
  const partial = twin({ 'entry.uxdsl': '@use "p";\n', '_p.uxdsl': INVALID });
  assert.equal(stageLocation(partial.ux, partial.actual.error), '_p.X:1:17');
  assert.match(partial.actual.error.sassFrame, /^1 │ \.a \{ content: "a�b"; \}$/m);
  // A CRLF file: Dart Sass's CSS, and its own frame.
  assertSameAsTwin(twin({ 'entry.uxdsl': '@use "p";\n', '_p.uxdsl': '.p {\r\n  b: space(2);\r\n}\r\n' }), 'a CRLF partial');
  assertSameAsTwin(twin({ 'entry.uxdsl': '.a {\r\n  b: space(2) $nope;\r\n}\r\n' }), 'a CRLF error', { exactFrame: true });
});

test('MIG-B9-12: files are read as Dart Sass reads them (negative control: no CSS for an invalid file, and the BOM is not stripped)', () => {
  const dir = project({ 'entry.uxdsl': '@use "p";\n.x { a: b; }\n', '_p.uxdsl': INVALID });
  const error = stageError(() => stage({ entry: path.join(dir, 'entry.uxdsl') }));
  assert.equal(error.code, 'UXD_SASS');
  assert.equal(error.sassMessage, 'Invalid UTF-8.');
  const bom = project({ 'entry.uxdsl': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('.e { c: $nope; }\n')]) });
  assert.notEqual(stageError(() => stage({ entry: path.join(bom, 'entry.uxdsl') })).column, 9, 'a decoder that strips the BOM would report column 9');
});

// --- T14: I/O errors are rethrown unchanged (E3) -------------------------------------------------------------------

const noPermissions = process.platform === 'win32' ? 'file permissions do not deny reads on win32' : process.getuid && process.getuid() === 0 ? 'running as root, which reads a file whatever its mode' : false;

test('MIG-B9-12: an I/O error while reading a loaded file, or a missing entry, is rethrown unchanged', { skip: noPermissions }, () => {
  const dir = project({ 'entry.uxdsl': '@use "a";\n', '_a.uxdsl': '.a { b: c; }\n' });
  const locked = path.join(dir, '_a.uxdsl');
  fs.chmodSync(locked, 0o000);
  let error;
  try {
    error = stageError(() => stage({ entry: path.join(dir, 'entry.uxdsl') }));
  } finally {
    fs.chmodSync(locked, 0o644);
  }
  assert.equal(error.code, 'EACCES');
  assert.doesNotMatch(error.message, /UXD_SASS/);
  const missing = stageError(() => stage({ entry: path.join(dir, 'nowhere/entry.uxdsl') }));
  assert.equal(missing.code, 'ENOENT');
});

test('MIG-B9-12: an I/O error while reading a loaded file, or a missing entry, is rethrown unchanged (negative control: a missing partial is Sass\'s error)', () => {
  const dir = project({ 'entry.uxdsl': '@use "a";\n' });
  const error = stageError(() => stage({ entry: path.join(dir, 'entry.uxdsl') }));
  assert.equal(error.code, 'UXD_SASS');
  assert.equal(error.sassMessage, "Can't find stylesheet to import.");
  assert.equal(`${error.line}:${error.column}`, '1:1');
});

// --- T15 is in protect.test.js; T16: an indented .sass file is scanned for definitions ---------------------------------

const UNCLOSED = '/* note\n  that continues\n@function color($x)\n  @return #123\n';

test('MIG-B9-12: a @function in an indented .sass partial is found behind a comment that has no closing marker', () => {
  const run = twin({ 'entry.uxdsl': '@import "helpers";\n.a { c: color(brand); }\n', '_helpers.sass': UNCLOSED });
  assertSameAsTwin(run, 'an indented helper behind an unclosed comment');
  assert.deepEqual(shadowOf(run.ux, run.actual), ['_helpers.sass:3:11']);
});

test('MIG-B9-12: a @function in an indented .sass partial is found behind a comment that has no closing marker (negative control: the SCSS scan alone misses it)', () => {
  assert.deepEqual(findShadowingFunctions(UNCLOSED, { reserved: RESERVED }), []);
  const css = sass.compileString(`${UNCLOSED}.z\n  v: color(1)\n`, { syntax: 'indented' }).css;
  assert.match(css, /v: #123/, 'Dart Sass sees the function');
});

// --- T17: no state between calls; decoded paths ----------------------------------------------------------------------

test('MIG-B9-12: the stage keeps no state between calls and reports decoded absolute paths', () => {
  const name = 'we ird #dir% é';
  const dir = project({ [`${name}/entry.uxdsl`]: '@use "part";\n.a { w: (10px/2); c: palette(primary.main); }\n', [`${name}/_part.uxdsl`]: '.p { b: space(2); }\n', [`${name}/broken.uxdsl`]: '@use "part";\n.b { c: palette(primary.main) $nope; }\n' });
  const base = path.join(dir, name);
  const entry = path.join(base, 'entry.uxdsl');
  const first = stage({ entry }, { sourceMap: true });
  const second = stage({ entry }, { sourceMap: true });
  assert.deepEqual(second, first);
  assert.deepEqual(first.loadedFiles, [entry, path.join(base, '_part.uxdsl')]);
  assert.equal(first.warnings[0].file, entry);
  assert.deepEqual(first.map.sources.slice().sort(), [path.join(base, '_part.uxdsl'), entry].sort());
  const error = stageError(() => stage({ entry: path.join(base, 'broken.uxdsl') }));
  assert.equal(error.file, path.join(base, 'broken.uxdsl'));
  assert.equal(`${error.line}:${error.column}`, '2:31');
});

test('MIG-B9-12: the stage keeps no state between calls (negative control: an edited partial is read again)', () => {
  const dir = project({ 'entry.uxdsl': '@use "part";\n', '_part.uxdsl': '.p { v: 1; }\n' });
  const before = stage({ entry: path.join(dir, 'entry.uxdsl') }).css;
  fs.writeFileSync(path.join(dir, '_part.uxdsl'), '.p { v: 2; }\n');
  const after = stage({ entry: path.join(dir, 'entry.uxdsl') }).css;
  assert.notEqual(after, before);
  assert.match(after, /v: 2/);
});

// --- input validation -------------------------------------------------------------------------------------------------

test('MIG-B9-12: invalid input is a TypeError before Dart Sass runs', () => {
  assert.throws(() => stage({ entry: 'relative/entry.uxdsl', source: '.a{}' }), TypeError);
  assert.throws(() => stage({ entry: path.join(os.tmpdir(), 'x.uxdsl'), source: 42 }), TypeError);
  assert.throws(() => require(STAGE_MODULE).compileSassStage({ entry: path.join(os.tmpdir(), 'x.uxdsl'), source: '.a{}' }, { sourceMap: false }), TypeError);
});
