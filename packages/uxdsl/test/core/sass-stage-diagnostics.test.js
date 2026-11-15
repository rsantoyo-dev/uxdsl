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
