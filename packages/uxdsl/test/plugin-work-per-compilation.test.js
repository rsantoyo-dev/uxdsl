'use strict';

// The work one compilation does, counted. A compilation runs each of the
// theme's engines once (the validator's run renders the theme too), inspects
// no declaration when the reference pass has nothing it could report, and
// leaves a value with no "(" unparsed by the responsive pass; the output stays
// what it was. Nothing the plugin computes about the theme outlives one
// compilation.
//
// The counts go through the built modules' exports, which is how the
// compiler's own calls reach them, and `postcss-value-parser` is replaced in
// the module cache before anything loads it, so every parse is counted.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const parserPath = require.resolve('postcss-value-parser');
const realParser = require(parserPath);
const counts = { parses: 0, engines: {}, validateTheme: 0, inspections: 0, enforce: 0 };
function countingParser(value) {
  counts.parses++;
  return new realParser(value);
}
Object.assign(countingParser, realParser);
countingParser.prototype = realParser.prototype;
require.cache[parserPath].exports = countingParser;

const postcss = require('postcss');
const { temporaryDirectory } = require('./helpers/temporary-directory');

const DIST = path.resolve(__dirname, '../dist');
const load = (file) => require(path.join(DIST, file));

/** The six engines both the validator and the theme render call. */
const ENGINES = [
  ['surfaces.js', 'compileSurfaceRules'],
  ['buttons.js', 'compileButtonRules'],
  ['inputs.js', 'compileInputRules'],
  ['shadows.js', 'compileShadowRules'],
  ['edges.js', 'compileEdgeRules'],
  ['language.js', 'compileDensityRules'],
];
const ENGINE_NAMES = ENGINES.map(([, name]) => name);

/** Wraps an exported function so each call through the module counts. */
function count(file, name, tally) {
  const mod = load(file);
  const original = mod[name];
  mod[name] = function counted(...args) {
    tally();
    return original.apply(this, args);
  };
}
for (const [file, name] of ENGINES) count(file, name, () => { counts.engines[name] = (counts.engines[name] || 0) + 1; });
count('ds-runtime/theme-validate.js', 'validateTheme', () => { counts.validateTheme++; });
count('reference-core.js', 'inspectDeclarationReferences', () => { counts.inspections++; });
count('reference-integrity.js', 'enforceReferences', () => { counts.enforce++; });

const { compile } = load('entries/index.js');
const pluginModule = load('plugin.js');
const plugin = pluginModule.default || pluginModule;
const { validateTheme, themeValidationError } = load('ds-runtime/theme-validate.js');
const { renderThemeCss } = load('ds-runtime/theme-generator.js');
const { resolveTheme } = load('default-theme.js');

function reset() {
  counts.parses = 0;
  counts.engines = Object.fromEntries(ENGINE_NAMES.map((name) => [name, 0]));
  counts.validateTheme = 0;
  counts.inspections = 0;
  counts.enforce = 0;
}

/** Runs `work` from zero counts; returns the counts with its result or error. */
async function measure(work) {
  reset();
  let value = null;
  let error = null;
  try { value = await work(); } catch (caught) { error = caught; }
  return { engines: { ...counts.engines }, validateTheme: counts.validateTheme, inspections: counts.inspections, enforce: counts.enforce, parses: counts.parses, value, error };
}

const FROM = path.join(__dirname, 'mig-b9-24.uxdsl');
const viaCompile = (source, options = {}) => compile({ source, from: FROM }, { theme: {}, ...options });
const viaPlugin = (source, options = {}) => postcss([plugin({ theme: {}, ...options })]).process(source, { from: FROM });
const PATHS = [['compile()', viaCompile], ['the plugin alone', viaPlugin]];

const eachEngine = (n) => Object.fromEntries(ENGINE_NAMES.map((name) => [name, n]));
const REJECTED_THEME = { surfaces: { contained: { radius: 'radius(99)' } } };

// --- C1 ---------------------------------------------------------------------

test('MIG-B9-24: each theme engine runs once per compilation, whether the theme is emitted at @uxdsl theme;, only checked against, or rejected by an engine', async () => {
  const cases = [
    ['a token, no marker', '.card{padding:density(4)}', {}],
    ['no token, no marker', '.card{padding:4px}', {}],
    ['a token, the marker', '@uxdsl theme;\n.card{padding:density(4)}', {}],
    ['references.css', '.card{padding:4px}', { references: { css: ['.x{--a:1}'] } }],
    ['references.externalTokens', '.card{padding:4px}', { references: { externalTokens: ['--host-a'] } }],
    ["references mode 'off'", '.card{padding:density(4)}', { references: { mode: 'off' } }],
    ["references mode 'off', the marker", '@uxdsl theme;\n.card{padding:density(4)}', { references: { mode: 'off' } }],
    ['a theme an engine rejects', '.card{padding:4px}', { theme: REJECTED_THEME }],
  ];
  for (const [label, run] of PATHS) {
    for (const [what, source, options] of cases) {
      const measured = await measure(() => run(source, options));
      assert.deepEqual(measured.engines, eachEngine(1), `${label}, ${what}: each engine runs once`);
      assert.equal(measured.validateTheme, 1, `${label}, ${what}: one validation`);
    }
    // An invalid breakpoint map stops the validator before any engine runs.
    const invalid = await measure(() => run('.card{padding:4px}', { theme: { breakpoints: { md: -1 } } }));
    assert.ok(invalid.error, `${label}: an invalid breakpoint map fails`);
    assert.deepEqual(invalid.engines, eachEngine(0), `${label}: no engine runs on an invalid breakpoint map`);
  }

  // compile() runs the plugin a second time to name a near-miss Sass left in
  // an unincluded mixin; each plugin run runs each engine once.
  const nearMiss = await measure(() => viaCompile('@mixin m {\n  color: palete(primary.main);\n}\n.a{padding:4px}\n'));
  assert.match(String(nearMiss.error?.message), /UXD_FUNCTION_UNKNOWN: palete\(\) is not a function CSS or UXDSL knows/);
  assert.equal(nearMiss.validateTheme, 2, 'two plugin runs');
  assert.deepEqual(nearMiss.engines, eachEngine(2), 'each engine runs once per plugin run');
});

test("MIG-B9-24: the plugin's verdict and CSS are validateTheme's and renderThemeCss's", async () => {
  // The CSS emitted at the marker is renderThemeCss's, byte for byte.
  const emitted = await viaPlugin('@uxdsl theme;\n.card{padding:density(4)}');
  assert.ok(emitted.css.includes(renderThemeCss(resolveTheme({}))), 'the plugin emits renderThemeCss');
  const compiled = await viaCompile('@uxdsl theme;\n.card{padding:density(4)}');
  assert.ok(compiled.css.includes(renderThemeCss(resolveTheme({}))), 'compile() emits renderThemeCss');

  // A theme an engine rejects fails with validateTheme's errors.
  const expected = themeValidationError(validateTheme(resolveTheme(REJECTED_THEME), { references: false }).errors);
  for (const [label, run] of PATHS) {
    const error = await run('.card{padding:4px}', { theme: REJECTED_THEME }).then(() => null, (caught) => caught);
    assert.ok(error, `${label}: the theme is rejected`);
    assert.equal(error.code, expected.code, `${label}: the code is validateTheme's`);
    assert.ok(error.message.includes(expected.message), `${label}: the message is validateTheme's`);
  }

  // Its warnings are validateTheme's.
  const warned = { scratch: { a: 'b' } };
  const issued = validateTheme(resolveTheme(warned), { references: false }).warnings.map((warning) => warning.message);
  assert.ok(issued.length, 'the unknown family warns');
  const result = await viaPlugin('.card{padding:4px}', { theme: warned });
  assert.deepEqual(result.warnings().map((warning) => warning.text), issued);
  const fromCompile = await viaCompile('.card{padding:4px}', { theme: warned });
  assert.deepEqual(fromCompile.warnings.map((warning) => warning.text), issued);
});

test('MIG-B9-24: validateTheme then renderThemeCss, called one after the other, count two runs of each engine (negative control)', async () => {
  const theme = resolveTheme({});
  const measured = await measure(() => {
    validateTheme(theme, { references: false });
    return renderThemeCss(theme);
  });
  assert.deepEqual(measured.engines, eachEngine(2));
});

// --- C2 ---------------------------------------------------------------------

test('MIG-B9-24: the reference pass inspects no declaration when it can report nothing, and a theme value PostCSS cannot parse still fails there as on the base', async () => {
  for (const [label, run] of PATHS) {
    const nothing = await measure(() => run('.card{padding:4px}'));
    assert.equal(nothing.error, null, `${label}: compiles`);
    assert.equal(nothing.inspections, 0, `${label}: nothing to check, no inspection`);

    // references mode 'off' still reaches the reference pass, which returns at once.
    const off = await measure(() => run('.card{padding:4px}', { references: { mode: 'off' } }));
    assert.equal(off.inspections, 0, `${label}: mode 'off' inspects nothing`);
    assert.equal(off.enforce, 1, `${label}: mode 'off' still reaches the reference pass`);

    // The rendered theme is still parsed, so a value PostCSS cannot parse fails there.
    const unparsable = { palette: { primary: { main: 'red /* oops' } } };
    let expected = null;
    try { postcss.parse(renderThemeCss(resolveTheme(unparsable))); } catch (caught) { expected = caught; }
    assert.ok(expected, 'PostCSS cannot parse the rendered theme');
    const failed = await measure(() => run('.card{padding:4px}', { theme: unparsable }));
    assert.equal(failed.error?.name, 'CssSyntaxError', `${label}: CssSyntaxError`);
    assert.equal(failed.error.message.split('\n')[0], 'uxdsl: <css input>:2:45: Unclosed comment', `${label}: the base's message and position`);
    assert.equal(failed.error.reason, expected.reason);
    assert.equal(failed.error.line, expected.line);
    assert.equal(failed.error.column, expected.column);
  }
});

test('MIG-B9-24: one token, one references.css entry or one externalTokens entry brings the inspection back, and their errors stay (negative control)', async () => {
  for (const [label, run] of PATHS) {
    for (const [what, source, options] of [
      ['one token', '.card{padding:density(4)}', {}],
      ['one references.css entry', '.card{padding:4px}', { references: { css: ['.x{--a:1}'] } }],
      ['one externalTokens entry', '.card{padding:4px}', { references: { externalTokens: ['--host-a'] } }],
    ]) {
      const measured = await measure(() => run(source, options));
      assert.equal(measured.error, null, `${label}, ${what}: compiles`);
      assert.equal(measured.inspections, 1, `${label}, ${what}: one inspection`);
    }
    const unclosed = await measure(() => run('.card{padding:4px}', { references: { css: ['.y {'] } }));
    assert.equal(unclosed.error?.name, 'CssSyntaxError', `${label}: an unparsable references.css entry fails`);
    assert.equal(unclosed.error.reason, 'Unclosed block');
    const invalid = await measure(() => run('.card{padding:4px}', { references: { externalTokens: ['bad token'] } }));
    assert.match(String(invalid.error?.message), /UXD_REFERENCE_CONTEXT: Invalid external token bad token\./, `${label}: an invalid external token fails`);
  }
});

// --- C3 ---------------------------------------------------------------------

/** 100 declarations whose values hold no "(", "$", "#{" or "//", comments and odd spacing included. */
const PLAIN = Array.from({ length: 100 }, (_, i) => (i % 2
  ? `--p${i}:  ${i}px   /* note ${i} */  solid`
  : `margin:${i}px /* c${i} */  auto`)).join(';\n  ');

test('MIG-B9-24: a declaration whose value has no "(" is parsed by neither walk of the responsive pass and keeps its bytes', async () => {
  for (const [label, run] of PATHS) {
    const one = await measure(() => run('.card {\n  padding:4px\n}'));
    const many = await measure(() => run(`.card {\n  padding:4px;\n  ${PLAIN}\n}`));
    assert.equal(one.error, null);
    assert.equal(many.error, null);
    assert.equal(many.parses - one.parses, 0, `${label}: 100 more declarations with no "(" add no parse`);
  }
  const source = `.card {\n  padding:4px;\n  ${PLAIN}\n}`;
  const result = await viaPlugin(source);
  assert.equal(result.css, source, 'the plugin keeps every byte as written');
});

test('MIG-B9-24: 100 declarations whose values hold a "(" add value parses (negative control)', async () => {
  // translateX() rather than calc(): Dart Sass keeps it as written, where it
  // would reduce calc(1px + 2px) to 3px before the plugin sees it.
  const calls = Array.from({ length: 100 }, (_, i) => `transform: translateX(${i}px)`).join(';\n  ');
  for (const [label, run] of PATHS) {
    const one = await measure(() => run('.card {\n  padding:4px\n}'));
    const many = await measure(() => run(`.card {\n  padding:4px;\n  ${calls}\n}`));
    assert.equal(many.error, null);
    assert.ok(many.parses - one.parses >= 100, `${label}: ${many.parses - one.parses} more parses`);
  }
});

// --- C5 ---------------------------------------------------------------------

const THEME_ONE = { densities: { '17': 'space(15)' } };
const THEME_TWO = { densities: { '17': 'space(16)', '18': 'space(16)' } };
const EMITS = '@uxdsl theme;\n.card{padding:density(4)}';
const USES_18 = '.card{padding:density(18)}';

/**
 * Runs, in turn: the marker with theme one, density(18) with theme one, the
 * marker with theme two, density(18) with theme two. `runWith(theme, source)`
 * compiles under that theme. Returns what each emitted or threw.
 */
async function twoThemes(runWith) {
  const outcome = async (theme, source) => runWith(theme, source).then((result) => ({ css: result.css }), (error) => ({ error }));
  return [
    await outcome(THEME_ONE, EMITS),
    await outcome(THEME_ONE, USES_18),
    await outcome(THEME_TWO, EMITS),
    await outcome(THEME_TWO, USES_18),
  ];
}

/** Each compilation emitted and checked against its own theme. */
function assertOwnTheme(outcomes, label) {
  const [emitOne, useOne, emitTwo, useTwo] = outcomes;
  assert.ok(emitOne.css?.includes(renderThemeCss(resolveTheme(THEME_ONE))), `${label}: the first compilation emits the first theme`);
  assert.ok(useOne.error, `${label}: density(18) fails against the first theme`);
  assert.ok(emitTwo.css?.includes(renderThemeCss(resolveTheme(THEME_TWO))), `${label}: the second compilation emits the second theme`);
  assert.equal(useTwo.error, undefined, `${label}: density(18) passes against the second theme`);
}

test('MIG-B9-24: nothing outlives one compilation: one plugin instance with an edited theme file, and compile() with two themes in turn, emit and check each compilation\'s own theme', async (t) => {
  const dir = temporaryDirectory('mig-b9-24-', t);
  const themeFile = path.join(dir, 'uxdsl.theme.json');
  const instance = plugin({ configRoot: dir });
  const from = path.join(dir, 'card.css');
  const discovered = await twoThemes((theme, source) => {
    fs.writeFileSync(themeFile, JSON.stringify(theme));
    return postcss([instance]).process(source, { from });
  });
  assertOwnTheme(discovered, 'one plugin instance, the theme file edited');

  const compiled = await twoThemes((theme, source) => compile({ source, from }, { theme }));
  assertOwnTheme(compiled, 'compile() with two themes in turn');

  // The assertion fails on a run that hands the first compilation's result
  // to the second, as a cache kept between compilations would.
  const stale = await twoThemes((() => {
    const first = new Map();
    return (theme, source) => {
      const key = source;
      if (!first.has(key)) first.set(key, compile({ source, from }, { theme }));
      return first.get(key);
    };
  })());
  assert.throws(() => assertOwnTheme(stale, 'a planted cache'), assert.AssertionError);
});
