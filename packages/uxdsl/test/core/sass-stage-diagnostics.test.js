'use strict';

// What compile()'s Sass stage reports, beyond the CSS it compiles:
// - a near-miss of a UXDSL function with a dotted argument (palete(primary.main)),
//   which Dart Sass cannot parse, fails with the plugin's error and its
//   suggestion, as it does through uxdsl/postcss, wherever a declaration value
//   holds it; in a selector, an at-rule prelude, a Sass statement or a file Sass
//   reads as written it keeps Dart Sass's error;
// - every @debug Dart Sass evaluates is a located warning;
// - no name a project writes changes what the stage's probe decides, and the
//   probe's own names reach no result;
// - compile() runs from a script Node reads on standard input.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const postcss = require('postcss');

const core = require('../../dist/entries/index.js');
const exported = require('../../dist/plugin');
const { temporaryDirectory } = require('../helpers/temporary-directory');

const plugin = exported.default || exported;
const BIN = path.join(__dirname, '..', '..', 'bin', 'uxdsl.js');
const DIST_ENTRY = path.join(__dirname, '..', '..', 'dist', 'entries', 'index.js');
const OPTIONS = { discoverTheme: false };
const CONFIG = "module.exports = { entry: './src/main.uxdsl', outFile: './out/app.css' };\n";

/** A project holding `files`, in a directory removed when the test passes; its real path. */
function project(t, files = {}) {
  const dir = fs.realpathSync(temporaryDirectory('uxdsl-stage-diagnostics-', t));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  return dir;
}

const build = (dir) => spawnSync(process.execPath, [BIN, 'build'], { cwd: dir, encoding: 'utf8' });
const failure = (promise) => promise.then(() => null, (error) => error);
const compileSource = (source, from, options = {}) => core.compile({ source, from }, { ...OPTIONS, ...options });
const throughPlugin = (source, from) => postcss([plugin(OPTIONS)]).process(source, { from });
const flat = (css) => css.replace(/\s+/g, ' ').trim();

const DOTTED_NEAR_MISSES = [
  'palete(primary.main)',
  'pallete(primary.main)',
  'pallet(primary.main)',
  'pallette(primary.main)',
  'palettes(primary.main)',
  'paltte(primary.main)',
  'PALETE(primary.main)',
  'palete(primary.main, 0.5)',
  'xs(palete(primary.main)) md(red)',
  'calc(palete(primary.main) + 1px)',
  'xd(primary.main)',
];

test('MIG-B9-26: a dotted near-miss nested in a responsive value or calc(), with an alpha, in capitals, and a breakpoint\'s (xd(primary.main)) gives the plugin\'s error through compile() and uxdsl build (exit 1)', async (t) => {
  const dir = project(t);
  const from = path.join(dir, 'src', 'panel.uxdsl');
  for (const value of DOTTED_NEAR_MISSES) {
    const source = `.a {\n  color: ${value};\n}\n`;
    const viaPlugin = await failure(throughPlugin(source, from));
    assert.ok(viaPlugin && /^UXD_(FUNCTION|BREAKPOINT)_UNKNOWN: /.test(viaPlugin.reason), `${value}: the plugin's error`);
    const viaCompile = await failure(compileSource(source, from));
    assert.ok(viaCompile, `${value} fails through compile()`);
    assert.notEqual(viaCompile.code, 'UXD_SASS', `${value}: not Dart Sass's error (${viaCompile.message.split('\n')[0]})`);
    assert.equal(viaCompile.reason, viaPlugin.reason, `${value}: the plugin's code and message`);
    assert.deepEqual([viaCompile.file, viaCompile.line, viaCompile.column], [from, 2, 3], `${value}: at the declaration`);
  }
  const breakpoint = await failure(compileSource('.a {\n  color: xd(primary.main);\n}\n', from));
  assert.match(breakpoint.reason, /^UXD_BREAKPOINT_UNKNOWN: xd\(\.\.\.\) is not a configured breakpoint/);

  for (const [value, line] of [
    ['palete(primary.main)', '[uxdsl] Error: uxdsl: src/main.uxdsl:2:3: UXD_FUNCTION_UNKNOWN: palete() is not a function CSS or UXDSL knows; did you mean palette()?'],
    ['xs(palete(primary.main)) md(red)', '[uxdsl] Error: uxdsl: src/main.uxdsl:2:3: UXD_FUNCTION_UNKNOWN: palete() is not a function CSS or UXDSL knows; did you mean palette()?'],
    ['xd(primary.main)', '[uxdsl] Error: uxdsl: src/main.uxdsl:2:3: UXD_BREAKPOINT_UNKNOWN: xd(...) is not a configured breakpoint or a known CSS function; configured breakpoints: xs, sm, md, lg, xl.'],
  ]) {
    const cli = project(t, { 'uxdsl.config.cjs': CONFIG, 'src/main.uxdsl': `.a {\n  color: ${value};\n}\n` });
    const built = build(cli);
    assert.equal(built.status, 1, built.stderr);
    const lines = built.stderr.split('\n');
    assert.equal(lines[0], line, built.stderr);
    assert.ok(lines.slice(1).some((frame) => frame.includes(value)), `the plugin's frame shows the author's line: ${built.stderr}`);
  }
});

test('MIG-B9-26: a dotted near-miss in a selector, an @media prelude, a .scss partial or after a same-file @function of that name stays UXD_SASS, and colour(gray.300) with a project @function colour is its value (negative control)', async (t) => {
  const dir = project(t, {
    'src/_part.scss': '.p {\n  color: palete(primary.main);\n}\n',
  });
  const from = path.join(dir, 'src', 'main.uxdsl');
  for (const [label, source, line] of [
    ['a selector', '.a:not(palete(primary.main)) {\n  color: red;\n}\n', 1],
    ['a selector that starts like a declaration', '.a {\n  b:not(palete(primary.main)) {\n    color: red;\n  }\n}\n', 2],
    ['an @media prelude', '@media (min-width: palete(a.b)) {\n  .a {\n    color: red;\n  }\n}\n', 1],
    ['an @supports condition', '@supports (color: palete(primary.main)) {\n  .a {\n    color: red;\n  }\n}\n', 1],
    ['a same-file @function of that name', '@function palete($key) {\n  @return red;\n}\n.a {\n  color: palete(primary.main);\n}\n', 5],
    ['a variable a selector interpolates', '$x: palete(primary.main);\n.#{$x} {\n  color: red;\n}\n', 1],
    ['a mixin argument a selector interpolates', '@mixin m($v) {\n  .#{$v} {\n    color: red;\n  }\n}\n@include m(palete(primary.main));\n', 6],
    ['a function\'s @return', '@function f() {\n  @return palete(primary.main);\n}\n.a {\n  color: f();\n}\n', 2],
    ['an interpolation in a selector', '.#{palete(primary.main)} {\n  color: red;\n}\n', 1],
    ['a nested property with a value', '.a {\n  font: palete(primary.main) {\n    family: x;\n  }\n}\n', 2],
  ]) {
    const error = await failure(compileSource(source, from));
    assert.ok(error, `${label}: compile() fails`);
    assert.equal(error.code, 'UXD_SASS', `${label}: Dart Sass's error (${error.message.split('\n')[0]})`);
    assert.equal(error.line, line, `${label}: at the call's line`);
  }
  const partial = await failure(compileSource('@use "part";\n', from));
  assert.equal(partial.code, 'UXD_SASS', partial.message);
  assert.equal(partial.file, path.join(dir, 'src', '_part.scss'));

  // A call Sass parses is Sass's: a project @function colour gives its value.
  const own = await compileSource('@function colour($key) {\n  @return blue;\n}\n.a {\n  color: colour(gray.300);\n}\n', from);
  assert.equal(flat(own.css), '.a { color: blue; }');
  // Without the function, colour(gray.300) is the plugin's error, as on uxdsl/postcss.
  const plain = await failure(compileSource('.a {\n  color: colour(gray.300);\n}\n', from));
  assert.match(plain.reason, /^UXD_FUNCTION_UNKNOWN: colour\(\) is not a function CSS or UXDSL knows; did you mean color\(\)\?$/);
});

test('MIG-B9-26: a dotted near-miss in a declaration Sass never evaluates (an unused @mixin, @if false, a placeholder nothing extends) fails with the plugin\'s error at the declaration, never compiles silently', async (t) => {
  const dir = project(t);
  const from = path.join(dir, 'src', 'main.uxdsl');
  const PALETE = 'UXD_FUNCTION_UNKNOWN: palete() is not a function CSS or UXDSL knows; did you mean palette()?';
  for (const [label, source, line, column, reason] of [
    ['an unused @mixin', '@mixin m {\n  color: palete(primary.main);\n}\n.a {\n  color: red;\n}\n', 2, 3, PALETE],
    ['@if false', '@if false {\n  .a { color: palete(primary.main); }\n}\n.b {\n  color: red;\n}\n', 2, 8, PALETE],
    ['a placeholder nothing extends', '%p {\n  color: palete(primary.main);\n}\n.a {\n  color: red;\n}\n', 2, 3, PALETE],
    ['nested in calc() in an unused @mixin', '@mixin m {\n  width: calc(palete(primary.main) + 1px);\n}\n', 2, 3, PALETE],
    ['a breakpoint\'s near-miss in an unused @mixin', '@mixin m {\n  color: xd(primary.main);\n}\n', 2, 3, null],
  ]) {
    const error = await failure(compileSource(source, from));
    assert.ok(error, `${label}: compile() fails`);
    assert.notEqual(error.code, 'UXD_SASS', `${label}: not Dart Sass's error (${error.message.split('\n')[0]})`);
    // The same reason the plugin gives for the declaration where it is evaluated.
    const evaluated = await failure(throughPlugin(`.a {\n  ${source.split('\n')[line - 1].trim().replace(/^\.a \{ | \}$/g, '')}\n}\n`, from));
    assert.equal(error.reason, evaluated.reason, `${label}: the plugin's code and message`);
    if (reason) assert.equal(error.reason, reason, label);
    else assert.match(error.reason, /^UXD_BREAKPOINT_UNKNOWN: xd\(\.\.\.\) is not a configured breakpoint/, label);
    assert.deepEqual([error.file, error.line, error.column], [from, line, column], `${label}: at the declaration`);
    assert.ok(error.showSourceCode(false).includes(source.split('\n')[line - 1]), `${label}: the frame shows the author's line`);
    assert.doesNotMatch(error.stack, /<input css/, `${label}: no position outside the author's file`);
  }
  // Warnings given before the failure stay on the error.
  const debugged = await failure(compileSource('@debug "first";\n@mixin m {\n  color: palete(primary.main);\n}\n', from));
  assert.equal(debugged.reason, PALETE);
  assert.deepEqual(debugged.warnings, [{ text: 'UXD_SASS_WARNING: DEBUG: first', file: from, line: 1, column: 1 }]);
  // An anonymous source names no file.
  const anonymous = await failure(core.compile({ source: '@mixin m {\n  color: palete(primary.main);\n}\n' }, OPTIONS));
  assert.equal(anonymous.reason, PALETE);
  assert.deepEqual([anonymous.file, anonymous.line, anonymous.column], [undefined, 2, 3]);
  assert.match(anonymous.message, /^uxdsl: <css input>:2:3: UXD_FUNCTION_UNKNOWN: /);
  // A breakpoint's near-miss nested in calc() is read as the plugin reads a nested call: a function it suggests, not a breakpoint.
  const nestedSource = '@mixin m {\n  width: calc(xd(primary.main) + 1px);\n}\n';
  const nested = await failure(compileSource(nestedSource, from));
  const nestedEvaluated = await failure(throughPlugin('.a {\n  width: calc(xd(primary.main) + 1px);\n}\n', from));
  assert.equal(nested.reason, nestedEvaluated.reason, 'a nested breakpoint near-miss: the plugin\'s code and message');
  assert.equal(nested.reason, 'UXD_FUNCTION_UNKNOWN: xd() is not a function CSS or UXDSL knows; did you mean xs()?');
  assert.deepEqual([nested.file, nested.line, nested.column], [from, 2, 3]);
  // One in a .uxdsl partial the entry loads is reported in the partial, with the partial's frame.
  const partialDir = project(t, { 'src/_mod.uxdsl': '// mod\n@mixin m {\n  color: palete(primary.main);\n}\n' });
  const partialFrom = path.join(partialDir, 'src', 'main.uxdsl');
  const partial = await failure(compileSource("@use 'mod';\n.b { color: red; }\n", partialFrom));
  assert.ok(partial, 'a near-miss in a @use\'d partial: compile() fails');
  assert.equal(partial.reason, PALETE);
  assert.deepEqual([partial.file, partial.line, partial.column], [path.join(partialDir, 'src', '_mod.uxdsl'), 3, 3]);
  assert.match(partial.showSourceCode(false), /^> 3 \|   color: palete\(primary\.main\);$/m, 'the frame shows the partial\'s line');
  // With two, the first in the source is reported.
  const two = await failure(compileSource('@mixin m {\n  color: palete(primary.main);\n}\n@mixin n {\n  color: pallete(primary.main);\n}\n', from));
  assert.equal(two.reason, PALETE);
  assert.deepEqual([two.line, two.column], [2, 3]);
  // A warning the plugin gave before the failure (an unknown theme family) stays on the error.
  const themed = await failure(compileSource('@mixin m {\n  color: palete(primary.main);\n}\n', from, { theme: { widgets: { a: 'b' } } }));
  assert.equal(themed.reason, PALETE);
  assert.ok(themed.warnings.some((warning) => /^Unknown theme family "widgets"/.test(warning.text)), JSON.stringify(themed.warnings));
  // Inside a Sass function that evaluates its argument, the near-miss fails as that function's error, as the canonical token does.
  for (const name of ['palete', 'palette']) {
    const inRgb = await failure(compileSource(`.a {\n  color: rgb(${name}(primary.main));\n}\n`, from));
    assert.equal(inRgb.code, 'UXD_SASS', `rgb(${name}(…))`);
    assert.equal(inRgb.sassMessage, `$channels: Expected red channel to be a number, was ${name}(primary.main).`);
  }

  const cli = project(t, { 'uxdsl.config.cjs': CONFIG, 'src/main.uxdsl': '@mixin m {\n  color: palete(primary.main);\n}\n.a {\n  color: red;\n}\n' });
  const built = build(cli);
  assert.equal(built.status, 1, built.stderr);
  assert.equal(built.stderr.split('\n')[0], `[uxdsl] Error: uxdsl: src/main.uxdsl:2:3: ${PALETE}`, built.stderr);
  assert.equal(fs.existsSync(path.join(cli, 'out', 'app.css')), false, 'nothing is written');
});

test('MIG-B9-26: each @debug Dart Sass evaluates is a UXD_SASS_WARNING: DEBUG: warning at its rule, in Sass\'s order, from a .uxdsl, a .scss partial, a load-path dependency with quietDeps, and once per evaluation in a loop; uxdsl build prints it and exits 0', async (t) => {
  const files = {
    'uxdsl.config.cjs': "module.exports = { entry: './src/main.uxdsl', outFile: './out/app.css', sass: { quietDeps: true } };\n",
    'src/_part.scss': '@debug "from a .scss partial";\n',
    'node_modules/kit/_tools.scss': '@debug "from a dependency";\n.k {\n  color: red;\n}\n',
    'src/_legacy.uxdsl': '.l {\n  color: blue;\n}\n',
    'src/main.uxdsl': '@use "part";\n@use "kit/tools";\n$gap: 4px;\n@debug "gap is #{$gap}";\n@each $i in 1, 2 {\n  @debug "i=#{$i}";\n}\n@warn "careful";\n@import "legacy";\n.a {\n  padding: 1px;\n}\n',
  };
  const dir = project(t, files);
  const main = path.join(dir, 'src', 'main.uxdsl');
  const result = await core.compile({ entry: main }, { ...OPTIONS, sass: { quietDeps: true } });
  const expected = [
    { text: 'UXD_SASS_WARNING: [import] Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.', file: main, line: 9, column: 9 },
    { text: 'UXD_SASS_WARNING: DEBUG: from a .scss partial', file: path.join(dir, 'src', '_part.scss'), line: 1, column: 1 },
    { text: 'UXD_SASS_WARNING: DEBUG: from a dependency', file: path.join(dir, 'node_modules', 'kit', '_tools.scss'), line: 1, column: 1 },
    { text: 'UXD_SASS_WARNING: DEBUG: gap is 4px', file: main, line: 4, column: 1 },
    { text: 'UXD_SASS_WARNING: DEBUG: i=1', file: main, line: 6, column: 3 },
    { text: 'UXD_SASS_WARNING: DEBUG: i=2', file: main, line: 6, column: 3 },
    // The negative control: an @warn keeps its text, with no DEBUG:.
    { text: 'UXD_SASS_WARNING: careful', file: main, line: 8, column: 1 },
  ];
  assert.deepEqual(result.warnings, expected);

  const built = build(dir);
  assert.equal(built.status, 0, built.stderr);
  const rel = (warning) => `[uxdsl] Warning: ${path.relative(dir, warning.file)}:${warning.line}:${warning.column}: ${warning.text}`;
  assert.deepEqual(built.stderr.split('\n').filter(Boolean), expected.map(rel));

  // The column is the author's, after a protected token on the same line.
  const after = await compileSource('.b { padding: space(2); @debug "after a token"; }\n', main);
  assert.deepEqual(after.warnings, [{ text: 'UXD_SASS_WARNING: DEBUG: after a token', file: main, line: 1, column: 25 }]);
});

test('MIG-B9-26: a @debug evaluated before an @error is on the thrown error\'s warnings', async (t) => {
  const dir = project(t);
  const from = path.join(dir, 'src', 'main.uxdsl');
  const error = await failure(compileSource('@debug "before";\n@error "stop";\n', from));
  assert.ok(error, 'compile() fails');
  assert.equal(error.code, 'UXD_SASS');
  assert.equal(error.sassMessage, '"stop"');
  assert.deepEqual([error.file, error.line, error.column], [from, 2, 1]);
  assert.deepEqual(error.warnings, [{ text: 'UXD_SASS_WARNING: DEBUG: before', file: from, line: 1, column: 1 }]);
});

/** §4's B4 input: a project function `name` beside `@function space`, which `.a` evaluates before and `.b` after. */
const mixed = (name) => `@function ${name}($value) {\n  @return 1;\n}\n@mixin m {\n  v: space(2);\n}\n.a {\n  @include m;\n}\n@function space($n) {\n  @return $n * 3px;\n}\n.b {\n  @include m;\n}\n`;
const META = (namespace) => `@use "sass:math" as ${namespace};\n@function get-function($n) {\n  @return null;\n}\n@function space($n) {\n  @return $n * 3px;\n}\n.a {\n  v: space(2);\n}\n`;
const GENERATED_NAME = /uxdsl-probe-[0-9a-f]{16}/;
const shadowed = (result) => result.warnings.map((warning) => `${warning.line}:${warning.column} ${warning.text.split(':')[0]}`);

test('MIG-B9-26: a project function named uxdsl-probe-pick, uxdsl-probe-replay or uxdsl-probe-site, and a @use … as uxdsl-probe-meta in a build that defines get-function, compile as under any other name; no result holds the stage\'s own names, and two compiles are equal', async (t) => {
  const dir = project(t);
  const from = path.join(dir, 'src', 'main.uxdsl');
  const compileBoth = async (source, label) => {
    const first = await compileSource(source, from, { sourceMap: 'external' });
    const second = await compileSource(source, from, { sourceMap: 'external' });
    assert.deepEqual(second, first, `${label}: two compiles are equal`);
    assert.doesNotMatch(JSON.stringify(first), GENERATED_NAME, `${label}: no result holds the stage's names`);
    return first;
  };

  // The input is probed: under another name, the call is seen both ways.
  const control = await compileBoth(mixed('my-pick'), 'my-pick');
  assert.equal(flat(control.css.replace(/\/\*# sourceMappingURL=.*\*\//, '')), '.a { v: var(--uxdsl__space__2); } .b { v: 6px; }');
  assert.deepEqual(shadowed(control), ['10:11 UXD_FUNCTION_SHADOWED']);

  for (const name of ['uxdsl-probe-pick', 'uxdsl-probe-replay', 'uxdsl-probe-site']) {
    const result = await compileBoth(mixed(name), name);
    assert.equal(flat(result.css.replace(/\/\*# sourceMappingURL=.*\*\//, '')), '.a { v: var(--uxdsl__space__2); } .b { v: 6px; }', name);
    assert.deepEqual(shadowed(result), ['10:11 UXD_FUNCTION_SHADOWED'], name);
  }
  for (const namespace of ['my-meta', 'uxdsl-probe-meta']) {
    const result = await compileBoth(META(namespace), namespace);
    assert.equal(flat(result.css.replace(/\/\*# sourceMappingURL=.*\*\//, '')), '.a { v: 6px; }', namespace);
    assert.deepEqual(shadowed(result), ['5:11 UXD_FUNCTION_SHADOWED'], namespace);
  }

  // A failing build whose failing call is one the stage rewrote: its message, stack and frame hold none of its names.
  const failing = mixed('uxdsl-probe-replay').replace('@function space($n) {', '@function space($n, $m) {');
  const errors = [await failure(compileSource(failing, from)), await failure(compileSource(failing, from))];
  for (const error of errors) {
    assert.ok(error, 'the failing variant fails');
    assert.equal(error.code, 'UXD_SASS', error.message);
    assert.equal(error.sassMessage, 'Missing argument $m.');
    assert.equal(error.line, 5);
    for (const text of [error.message, error.stack, error.sassFrame, JSON.stringify(error.warnings)]) assert.doesNotMatch(String(text), GENERATED_NAME);
    assert.match(error.sassFrame, /v: space\(2\);/, 'the frame shows the author\'s line');
  }
  assert.equal(errors[1].message, errors[0].message);
  assert.equal(errors[1].sassFrame, errors[0].sassFrame);
});

test('MIG-B9-26: compile() run from a script Node reads on standard input (node -) compiles as from a script file', (t) => {
  const dir = project(t);
  const script = [
    "'use strict';",
    "const path = require('path');",
    `const core = require(${JSON.stringify(DIST_ENTRY)});`,
    "core.compile({ source: '.a { b: space(2); }', from: path.join(process.cwd(), 'a.uxdsl') }, { discoverTheme: false })",
    '  .then((result) => { process.stdout.write(result.css); }, (error) => { process.stderr.write(`${error.code} ${error.message}`); process.exitCode = 1; });',
  ].join('\n');
  const run = spawnSync(process.execPath, ['-'], { input: script, cwd: dir, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, '.a {\n  b: var(--uxdsl__space__2);\n}');

  // The condition is exercised: from standard input, Dart Sass's importer given a directory still throws.
  const control = [
    `const sass = require(${JSON.stringify(require.resolve('sass'))});`,
    'try { new sass.NodePackageImporter(process.cwd()); process.stdout.write("constructed"); } catch (error) { process.stdout.write(String(error.code)); }',
  ].join('\n');
  const raw = spawnSync(process.execPath, ['-'], { input: control, cwd: dir, encoding: 'utf8' });
  assert.equal(raw.stdout, 'ERR_INVALID_ARG_VALUE', raw.stderr);
});

// --- module isolation: what a file loaded with @use does not see ---------------------------

/** The files of §4's B5 cases, as uxdsl-cli.test.js's ISOLATION_CASES and its namespaced-@use test write them, with the names a generated entry lists, in its order. */
const B5 = {
  function: { files: { 'src/_helpers.uxdsl': '@function double($x) { @return $x * 2; }\n', 'src/widget.uxdsl': '.w { width: double(4px); }\n' }, names: ['helpers', 'widget'] },
  default: { files: { 'src/_a-config.uxdsl': '$tone: red;\n', 'src/b-button.uxdsl': '$tone: blue !default;\n.btn { color: $tone; }\n' }, names: ['a-config', 'b-button'] },
  shadow: { files: { 'src/_shadow.uxdsl': '@function space($n) { @return $n * 4px; }\n', 'src/pad.uxdsl': '.p { padding: space(2); }\n' }, names: ['shadow', 'pad'] },
  namespaced: {
    files: {
      'src/_helpers.uxdsl': '@function space($n) { @return $n * 4px; }\n@function double($x) { @return $x * 2; }\n$gap: 3px;\n@mixin pad { padding: 1px; }\n',
      'src/pad.uxdsl': "@use './helpers';\n.p { padding: space(2); height: double(4px); }\n",
    },
    names: ['helpers', 'pad'],
  },
};
/** The entry `uxdsl generate-entry` writes for these names, without its theme file. */
const useEntry = (names) => names.map((name) => `@use './${name}.uxdsl' as ${name};\n`).join('');
const importEntry = (names) => names.map((name) => `@import './${name}';\n`).join('');

/** Compiles src/uxdsl-entry.uxdsl over `files`; the CSS flattened, and each warning as `<file>:<line>:<column> <text>` with the project's directory removed. */
async function isolated(t, files, entry) {
  const dir = project(t, { ...files, 'src/uxdsl-entry.uxdsl': entry });
  const result = await core.compile({ entry: path.join(dir, 'src', 'uxdsl-entry.uxdsl') }, OPTIONS);
  const strip = (text) => text.split(`${dir}${path.sep}`).join('');
  return { dir, css: flat(result.css), warnings: result.warnings.map((w) => (w.file ? `${path.relative(dir, w.file)}:${w.line}:${w.column} ${strip(w.text)}` : strip(w.text))) };
}
const isolationOf = (warnings) => warnings.filter((w) => / UXD_MODULE_ISOLATION: /.test(w) || /^UXD_MODULE_ISOLATION: /.test(w));

const C4_WIDGET = "src/widget.uxdsl:1:6 UXD_MODULE_ISOLATION: @function double (src/_helpers.uxdsl:1) is not visible here, so Dart Sass leaves double() in the CSS as written; @use that file as * here, or call it through its namespace (helpers.double())";
const C5_SHADOW = "src/_shadow.uxdsl:1:11 UXD_MODULE_ISOLATION: @function space (src/_shadow.uxdsl:1) is reached by no call, and in src/pad.uxdsl:1 the bare space() is UXDSL's token, because the function is not visible there; @use that file as * there or call it through its namespace (shadow.space()) to use it, or remove or rename it to keep the token";
const C5_HELPERS = "src/_helpers.uxdsl:1:11 UXD_MODULE_ISOLATION: @function space (src/_helpers.uxdsl:1) is reached by no call, and in src/pad.uxdsl:2 the bare space() is UXDSL's token, because the function is not visible there; @use that file as * there or call it through its namespace (helpers.space()) to use it, or remove or rename it to keep the token";
const C6_BUTTON = 'src/b-button.uxdsl:1:1 UXD_MODULE_ISOLATION: $tone: … !default applies its default here, because the $tone that src/_a-config.uxdsl:1 sets is not visible in this module; @use that file as * here, or configure this module with @use … with ($tone: …)';
const C4_PAD = "src/pad.uxdsl:2:25 UXD_MODULE_ISOLATION: @function double (src/_helpers.uxdsl:2) is not visible here, so Dart Sass leaves double() in the CSS as written; @use that file as * here, or call it through its namespace (helpers.double())";

test('MIG-B9-17: under a @use entry, another file\'s @function left as written, a project @function named like a token that no call reaches, a !default an earlier file sets, and a bare call under a namespaced @use each warn UXD_MODULE_ISOLATION once, located, with the CSS unchanged', async (t) => {
  const fn = await isolated(t, B5.function.files, useEntry(B5.function.names));
  assert.equal(fn.css, '.w { width: double(4px); }');
  assert.deepEqual(fn.warnings, [C4_WIDGET]);

  const defaulted = await isolated(t, B5.default.files, useEntry(B5.default.names));
  assert.equal(defaulted.css, '.btn { color: blue; }');
  assert.deepEqual(defaulted.warnings, [C6_BUTTON]);

  const shadow = await isolated(t, B5.shadow.files, useEntry(B5.shadow.names));
  assert.equal(shadow.css, '.p { padding: var(--uxdsl__space__2); }');
  assert.deepEqual(shadow.warnings, [C5_SHADOW]);

  const namespaced = await isolated(t, B5.namespaced.files, useEntry(B5.namespaced.names));
  assert.equal(namespaced.css, '.p { padding: var(--uxdsl__space__2); height: double(4px); }');
  assert.deepEqual(namespaced.warnings, [C5_HELPERS, C4_PAD]);
});

test('MIG-B9-17: an @import entry, the reading file\'s own @use … as *, calls through the namespace, a function no file defines, a known CSS function, a call Dart Sass leaves as written where even a visible function stays (a custom property, an at-rule prelude, progid:, a CSS @function body), and a module configured with @use … with or @forward … with warn nothing new (negative control)', async (t) => {
  // The same files under the @use entry warn (T6), so a detection that never fires fails one of the two.
  const imported = await isolated(t, B5.function.files, importEntry(B5.function.names));
  assert.equal(imported.css, '.w { width: 8px; }');
  assert.deepEqual(isolationOf(imported.warnings), []);
  const own = await isolated(t, { ...B5.function.files, 'src/widget.uxdsl': "@use './helpers' as *;\n.w { width: double(4px); }\n" }, useEntry(B5.function.names));
  assert.equal(own.css, '.w { width: 8px; }');
  assert.deepEqual(own.warnings, []);
  const qualified = await isolated(t, { ...B5.namespaced.files, 'src/pad.uxdsl': "@use './helpers';\n.p { padding: helpers.space(2); height: helpers.double(4px); }\n" }, useEntry(B5.namespaced.names));
  assert.equal(qualified.css, '.p { padding: 8px; height: 8px; }');
  assert.deepEqual(qualified.warnings, []);
  // The shadowing case under an @import entry and with its own @use … as *: BASE's UXD_FUNCTION_SHADOWED only.
  const SHADOWED = "src/_shadow.uxdsl:1:11 UXD_FUNCTION_SHADOWED: @function space (src/_shadow.uxdsl:1) replaces UXDSL's space() in this build; rename it to use the token";
  const shadowImported = await isolated(t, B5.shadow.files, importEntry(B5.shadow.names));
  assert.equal(shadowImported.css, '.p { padding: 8px; }');
  assert.deepEqual(shadowImported.warnings.filter((w) => !/ UXD_SASS_WARNING: \[import\]/.test(w)), [SHADOWED]);
  const shadowOwn = await isolated(t, { ...B5.shadow.files, 'src/pad.uxdsl': "@use './shadow' as *;\n.p { padding: space(2); }\n" }, useEntry(B5.shadow.names));
  assert.equal(shadowOwn.css, '.p { padding: 8px; }');
  assert.deepEqual(shadowOwn.warnings, [SHADOWED]);
  // SPACE(2) is not the function's name, so it is UXDSL's token and nothing else: Sass resolves names by case.
  const otherCase = await isolated(t, { ...B5.shadow.files, 'src/pad.uxdsl': "@use './shadow' as *;\n.p { padding: SPACE(2); }\n" }, useEntry(B5.shadow.names));
  assert.equal(otherCase.css, '.p { padding: var(--uxdsl__space__2); }');
  assert.deepEqual(otherCase.warnings, []);

  const helpers = { 'src/_helpers.uxdsl': '@function double($x) { @return $x * 2; }\n@function translate($x) { @return $x; }\n' };
  for (const [label, widget, css] of [
    ['a function no file defines and known CSS functions', '.w { a: foo(1px); b: calc(1px + 2px); transform: translateX(1px); filter: blur(1px); background: -webkit-gradient(linear, left top, left bottom); }\n', '.w { a: foo(1px); b: 3px; transform: translateX(1px); filter: blur(1px); background: -webkit-gradient(linear, left top, left bottom); }'],
    ['a project function named like a known CSS function', '.w { transform: translate(4px); }\n', '.w { transform: translate(4px); }'],
    ['a custom property', '.w { --w: double(4px); }\n', '.w { --w: double(4px); }'],
    ['an @container prelude', '@container (min-width: double(4px)) {\n  .w { color: red; }\n}\n', '@container (min-width: double(4px)) { .w { color: red; } }'],
    ['a progid: value', '.w { filter: progid:DXImageTransform.Microsoft.Alpha(opacity=double(4)); }\n', '.w { filter: progid:DXImageTransform.Microsoft.Alpha(opacity=double(4)); }'],
    ['a CSS @function body', '@function --double(--x) {\n  result: double(4px);\n}\n.w { width: --double(4px); }\n', '@function --double(--x) { result: double(4px); } .w { width: --double(4px); }'],
  ]) {
    const run = await isolated(t, { ...helpers, 'src/widget.uxdsl': widget }, useEntry(['helpers', 'widget']));
    assert.equal(run.css, css, label);
    assert.deepEqual(run.warnings, [], label);
  }

  // A !default the earlier file's value reaches, or one a configuration replaces: nothing.
  const defaultImported = await isolated(t, B5.default.files, importEntry(B5.default.names));
  assert.equal(defaultImported.css, '.btn { color: red; }');
  assert.deepEqual(isolationOf(defaultImported.warnings), []);
  const defaultOwn = await isolated(t, { ...B5.default.files, 'src/b-button.uxdsl': "@use './a-config' as *;\n$tone: blue !default;\n.btn { color: $tone; }\n" }, useEntry(B5.default.names));
  assert.equal(defaultOwn.css, '.btn { color: red; }');
  assert.deepEqual(defaultOwn.warnings, []);
  for (const [label, entry, files, css] of [
    ['@use … with', "@use './a-config.uxdsl' as a-config;\n@use './b-button.uxdsl' as b-button with ($tone: green);\n", {}, '.btn { color: green; }'],
    ['@use … with the default\'s own value', "@use './a-config.uxdsl' as a-config;\n@use './b-button.uxdsl' as b-button with ($tone: blue);\n", {}, '.btn { color: blue; }'],
    ['@forward … with', "@use './a-config.uxdsl' as a-config;\n@use './lib.uxdsl' as lib;\n", { 'src/_lib.uxdsl': "@forward './b-button' with ($tone: green !default);\n" }, '.btn { color: green; }'],
  ]) {
    const run = await isolated(t, { ...B5.default.files, ...files }, entry);
    assert.equal(run.css, css, label);
    assert.deepEqual(run.warnings, [], label);
  }
  // A configuration of null is no configuration to Sass: the default applies, and it warns.
  const nulled = await isolated(t, B5.default.files, "@use './a-config.uxdsl' as a-config;\n@use './b-button.uxdsl' as b-button with ($tone: null);\n");
  assert.equal(nulled.css, '.btn { color: blue; }');
  assert.deepEqual(nulled.warnings, [C6_BUTTON]);

  // uxdsl/postcss alone runs no Sass, and is unchanged.
  const alone = await throughPlugin(B5.function.files['src/widget.uxdsl'], '/project/src/widget.uxdsl');
  assert.equal(flat(alone.css), '.w { width: double(4px); }');
  assert.deepEqual(alone.warnings(), []);
});

test('MIG-B9-17: a call Dart Sass leaves as written is reported once per declaration, where compile() locates a diagnostic in that declaration, and never where Sass leaves a visible function as written', async (t) => {
  const helpers = { 'src/_helpers.uxdsl': '@function my_fn($x) { @return $x; }\n@function double($x) { @return $x * 2; }\n' };
  const run = (widget) => isolated(t, { ...helpers, 'src/widget.uxdsl': widget }, useEntry(['helpers', 'widget']));

  // Two spellings of one name in one declaration: one warning, in the first spelling.
  const spellings = await run('.w { box-shadow: my_fn(3px) my-fn(4px); }\n');
  assert.equal(spellings.css, '.w { box-shadow: my_fn(3px) my-fn(4px); }');
  assert.deepEqual(spellings.warnings, ['src/widget.uxdsl:1:6 UXD_MODULE_ISOLATION: @function my_fn (src/_helpers.uxdsl:1) is not visible here, so Dart Sass leaves my_fn() in the CSS as written; @use that file as * here, or call it through its namespace (helpers.my_fn())']);

  // A mixin included twice: one warning, at the mixin's declaration, where both outputs map.
  const mixin = await run('@mixin m {\n  width: double(4px);\n}\n.a { @include m; }\n.b { @include m; }\n');
  assert.equal(mixin.css, '.a { width: double(4px); } .b { width: double(4px); }');
  assert.deepEqual(mixin.warnings.map((w) => w.split(' ')[0]), ['src/widget.uxdsl:2:3']);

  // A value on the line after its property: where compile() reports a plugin error in the same layout.
  const nextLine = await run('.w {\n  width:\n    double(4px);\n}\n');
  const oracle = await failure(isolated(t, { ...helpers, 'src/widget.uxdsl': '.w {\n  width:\n    space(999);\n}\n' }, useEntry(['helpers', 'widget'])));
  assert.match(oracle.reason, /^UXD_SPACE_REFERENCE: /);
  assert.deepEqual(nextLine.warnings.map((w) => w.split(' ')[0]), [`src/widget.uxdsl:${oracle.line}:${oracle.column}`]);
  assert.deepEqual([oracle.line, oracle.column], [3, 5]);

  // The call's own file defines the function, after the call: the fix is to define it before.
  const later = await run('.w { width: twice(4px); }\n@function twice($x) { @return $x * 2; }\n');
  assert.equal(later.css, '.w { width: twice(4px); }');
  assert.deepEqual(later.warnings, ['src/widget.uxdsl:1:6 UXD_MODULE_ISOLATION: @function twice (src/widget.uxdsl:2) is not visible here, so Dart Sass leaves twice() in the CSS as written; define it at the top level of its file, before this call']);

  // A visible function Sass leaves as written in a custom property, an unknown at-rule's prelude,
  // a string or a comment: nothing.
  const visible = await run("@use './helpers' as *;\n.w { --x: double(4px); content: \"double(4px)\"; /* double(1px) */ }\n@foo double(4px);\n");
  assert.equal(visible.css, '.w { --x: double(4px); content: "double(4px)"; /* double(1px) */ } @foo double(4px);');
  assert.deepEqual(visible.warnings, []);

  // Output PostCSS cannot parse, with a call left as written: the same located parse error as
  // where no file defines the function.
  const broken = (defined) => failure(isolated(t, { 'src/_helpers.uxdsl': defined ? '@function double($x) { @return $x * 2; }\n' : '', 'src/widget.uxdsl': '.w { width: double(4px); content: #{"}"}; }\n' }, useEntry(['helpers', 'widget'])));
  const [withCandidate, withoutCandidate] = [await broken(true), await broken(false)];
  assert.ok(withCandidate, 'the output does not parse');
  assert.equal(withCandidate.name, withoutCandidate.name);
  assert.equal(withCandidate.message.split(path.sep).slice(-2).join('/'), withoutCandidate.message.split(path.sep).slice(-2).join('/'));
  assert.deepEqual([withCandidate.line, withCandidate.column], [withoutCandidate.line, withoutCandidate.column]);
  assert.deepEqual(withCandidate.warnings, withoutCandidate.warnings);
});

test('MIG-B9-17: a project function named like a token warns only when no call reaches its definition, through a namespace or from another function of its module (decision 10)', async (t) => {
  const helpers = '@function space($n) { @return $n * 4px; }\n@function twice($n) { @return space($n) * 2; }\n';
  // Reached through the namespace, or from twice() in a .scss module, whose bare calls are Sass's
  // alone: the bare space(2) is the token, by DEC-17, and nothing warns.
  for (const [label, helper, pad, css] of [
    ['a call through the namespace', 'src/_helpers.uxdsl', "@use './helpers';\n.p { padding: space(2); margin: helpers.space(1); }\n", '.p { padding: var(--uxdsl__space__2); margin: 4px; }'],
    ['another function of its module', 'src/_helpers.scss', "@use './helpers';\n.p { padding: space(2); margin: helpers.twice(1); }\n", '.p { padding: var(--uxdsl__space__2); margin: 8px; }'],
  ]) {
    const run = await isolated(t, { [helper]: helpers, 'src/pad.uxdsl': pad }, "@use './helpers' as helpers;\n@use './pad.uxdsl' as pad;\n");
    assert.equal(run.css, css, label);
    assert.deepEqual(run.warnings, [], label);
  }
  // No call reaches it (negative control: the same files without the namespace call).
  const none = await isolated(t, { 'src/_helpers.uxdsl': helpers, 'src/pad.uxdsl': "@use './helpers';\n.p { padding: space(2); }\n" }, useEntry(['helpers', 'pad']));
  assert.deepEqual(none.warnings, [C5_HELPERS]);

  // A breakpoint's function under a namespaced @use, called bare: the call a line at the end of the file reads.
  const breakpoint = await isolated(t, { 'src/_bp.uxdsl': '@function md($v) { @return $v * 2; }\n', 'src/pad.uxdsl': "@use './bp';\n.p {\n  padding: xs(1px) md(2px);\n}\n" }, useEntry(['bp', 'pad']));
  assert.deepEqual(breakpoint.warnings, ["src/_bp.uxdsl:1:11 UXD_MODULE_ISOLATION: @function md (src/_bp.uxdsl:1) is reached by no call, and in src/pad.uxdsl:3 the bare md() is UXDSL's token, because the function is not visible there; @use that file as * there or call it through its namespace (bp.md()) to use it, or remove or rename it to keep the token"]);

  // A directive's parameter is not evaluated by Sass: no call there keeps or loses the token.
  const directive = await isolated(t, { 'src/_shapes.uxdsl': '@function radius($k) { @return $k * 1px; }\n', 'src/card.uxdsl': '.c { @ds-surface(contained radius(2)); }\n' }, useEntry(['shapes', 'card']));
  assert.deepEqual(isolationOf(directive.warnings), []);

  // A build that defines get-function: the probe may keep a token Sass would replace, so it never claims none reached.
  const meta = await isolated(t, { ...B5.shadow.files, 'src/_meta.uxdsl': '@function get-function($n) { @return null; }\n' }, useEntry(['meta', ...B5.shadow.names]));
  assert.deepEqual(isolationOf(meta.warnings), []);
});

test('MIG-B9-17: a !default warns only when an earlier file that emits no CSS set the variable before the module\'s default applied', async (t) => {
  const button = B5.default.files['src/b-button.uxdsl'];
  // Negative control: §4's case warns.
  assert.deepEqual((await isolated(t, B5.default.files, useEntry(B5.default.names))).warnings, [C6_BUTTON]);

  // The entry itself sets it before its @use of the module.
  const entrySets = await isolated(t, { 'src/b-button.uxdsl': button }, "$tone: red;\n@use './b-button.uxdsl' as b-button;\n");
  assert.equal(entrySets.css, '.btn { color: blue; }');
  assert.deepEqual(entrySets.warnings, [C6_BUTTON.replace('src/_a-config.uxdsl:1', 'src/uxdsl-entry.uxdsl:1')]);

  // Sass's spelling (_ read as -), and one warning per declaration.
  const two = await isolated(t, { 'src/_a-config.uxdsl': '$brand_tone: red;\n$gap: 1px;\n', 'src/b-button.uxdsl': '$brand-tone: blue !default;\n$gap: 2px !default;\n.btn { color: $brand-tone; margin: $gap; }\n' }, useEntry(B5.default.names));
  assert.equal(two.css, '.btn { color: blue; margin: 2px; }');
  assert.deepEqual(two.warnings, [
    'src/b-button.uxdsl:1:1 UXD_MODULE_ISOLATION: $brand-tone: … !default applies its default here, because the $brand-tone that src/_a-config.uxdsl:1 sets is not visible in this module; @use that file as * here, or configure this module with @use … with ($brand-tone: …)',
    'src/b-button.uxdsl:2:1 UXD_MODULE_ISOLATION: $gap: … !default applies its default here, because the $gap that src/_a-config.uxdsl:2 sets is not visible in this module; @use that file as * here, or configure this module with @use … with ($gap: …)',
  ]);

  // Two earlier files set it: the last one is named, the value an @import entry would have used.
  const twice = await isolated(t, { ...B5.default.files, 'src/_a2-config.uxdsl': '$tone: green;\n' }, useEntry(['a-config', 'a2-config', 'b-button']));
  assert.deepEqual(twice.warnings, [C6_BUTTON.replace('src/_a-config.uxdsl:1', 'src/_a2-config.uxdsl:1')]);

  for (const [label, files, entry, css] of [
    ['the entry sets it after the module applied its default', { 'src/b-button.uxdsl': button }, "@use './b-button.uxdsl' as b-button;\n$tone: red;\n", '.btn { color: blue; }'],
    ['the earlier file emits CSS', { ...B5.default.files, 'src/_a-config.uxdsl': '$tone: red;\n.a { color: $tone; }\n' }, useEntry(B5.default.names), '.a { color: red; } .btn { color: blue; }'],
    ['the earlier file keeps a loud comment', { ...B5.default.files, 'src/_a-config.uxdsl': '/* settings */\n$tone: red;\n' }, useEntry(B5.default.names), '/* settings */ .btn { color: blue; }'],
    ['the module loads its settings file itself, under a namespace', { 'src/_a-config.uxdsl': '$tone: red;\n', 'src/b-button.uxdsl': `@use './a-config' as cfg;\n${button}` }, useEntry(['b-button']), '.btn { color: blue; }'],
  ]) {
    const run = await isolated(t, files, entry);
    assert.equal(run.css, css, label);
    assert.deepEqual(run.warnings, [], label);
  }
});

const SASS_ID = require.resolve('sass', { paths: [path.join(__dirname, '..', '..', 'dist', 'sass')] });
/** How many times `fn` makes the Sass stage call one of Dart Sass's compile functions, through the copy of `sass` the stage requires. */
async function compilesOf(fn) {
  require(SASS_ID);
  const cached = require.cache[SASS_ID];
  const original = cached.exports;
  let count = 0;
  cached.exports = new Proxy(original, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof key !== 'string' || !key.startsWith('compile') || typeof value !== 'function') return value;
      return (...args) => {
        count++;
        return value.apply(target, args);
      };
    },
  });
  try {
    const result = await fn();
    return { count, result };
  } finally {
    cached.exports = original;
  }
}

test('MIG-B9-17: a build with no project @function named like a UXDSL function and no !default candidate runs Dart Sass once, as on BASE', async (t) => {
  const once = [
    ['another file\'s @function left as written', B5.function.files, useEntry(B5.function.names), [C4_WIDGET]],
    ['a module with a top-level !default and nothing earlier', { 'src/_mod.uxdsl': '$gap: 2px !default;\n.m { margin: $gap; }\n' }, useEntry(['mod']), []],
    ['a call through a namespace only', { 'src/_helpers.uxdsl': '@function space($n) { @return $n * 4px; }\n', 'src/pad.uxdsl': "@use './helpers';\n.p { padding: helpers.space(2); }\n" }, useEntry(['helpers', 'pad']), []],
    ['plain tokens', { 'src/a.uxdsl': '.a { padding: space(2); color: palette(primary.main); }\n' }, useEntry(['a']), []],
    ['@import only, with a function and !default declarations the output never calls', { 'src/_tools.uxdsl': '@function double($x) { @return $x * 2; }\n$gap: 2px !default;\n$tone: red !default;\n' }, "@import 'tools';\n.a { padding: space(2); margin: $gap; }\n", []],
  ];
  for (const [label, files, entry, expected] of once) {
    const { count, result } = await compilesOf(() => isolated(t, files, entry));
    assert.equal(count, 1, `${label}: Dart Sass runs once`);
    assert.deepEqual(isolationOf(result.warnings), expected, label);
  }
  // The counter sees every compile: a build with a !default candidate runs one probe, and one with a
  // project function named like a token runs the probe it always ran.
  const candidate = await compilesOf(() => isolated(t, B5.default.files, useEntry(B5.default.names)));
  assert.equal(candidate.count, 2, 'a !default candidate: one probe');
  assert.deepEqual(candidate.result.warnings, [C6_BUTTON]);
  const probed = await compilesOf(() => isolated(t, B5.shadow.files, useEntry(B5.shadow.names)));
  assert.ok(probed.count > 1, `the probe runs (${probed.count})`);
  // Both at once: the !default candidates ride on that probe, with no compile of their own.
  const both = await compilesOf(() => isolated(t, { ...B5.default.files, ...B5.shadow.files }, useEntry([...B5.default.names, ...B5.shadow.names])));
  assert.equal(both.count, probed.count, 'the !default records come from the probe the build runs anyway');
  assert.deepEqual(both.result.warnings, [C6_BUTTON, C5_SHADOW]);
  assert.equal(both.result.css, '.btn { color: blue; } .p { padding: var(--uxdsl__space__2); }');
});
