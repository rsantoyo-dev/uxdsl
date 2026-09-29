'use strict';

// Stability phase 1 (audit 2026-09-29, T2/T4/T3/R6): there is one answer to
// "is this theme valid?". The same theme goes through the PostCSS plugin,
// `generateThemeCss`, `applyTheme` and the packaged JSON Schema, and the four
// must agree on every case below — the audit's own probe
// (docs/audits/2026-09-29-probes/theme/probe-validation.js) found five
// different answers, with numeric, `null` and object leaves emitted literally
// (`--uxdsl__space__1: 8;`, `[object Object]`, `null;`) by everything but the
// schema, and coercions (`"768"`, `fontWeight: 700`) accepted at run time but
// rejected at build time.
//
// `engines` is the verdict shared by the plugin, `generateThemeCss` and
// `applyTheme`: `ok`, `error`, or `warn` (accepted, with an unknown-family
// warning reported by all three). `schema` is the JSON Schema's own verdict —
// it cannot see a dangling reference (`valid` there is expected), and it
// rejects an unknown family outright where the engines only warn.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const postcss = require('postcss');
const Ajv = require('ajv');

const exported = require('../dist/index');
const plugin = exported.default || exported;
const runtime = require('../dist/ds-runtime');
const schema = require(path.join(__dirname, '..', 'schema', 'theme.schema.json'));

const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schema);

function makeDocument() {
  const byId = new Map();
  return {
    createElement(tagName) {
      const attributes = {};
      return { tagName: tagName.toUpperCase(), id: '', textContent: '', setAttribute(n, v) { attributes[n] = v; }, getAttribute(n) { return n in attributes ? attributes[n] : null; } };
    },
    getElementById(id) { return byId.get(id) || null; },
    head: { appendChild(node) { if (node.id) byId.set(node.id, node); return node; } },
  };
}

const CASES = [
  // --- leaves that are not non-empty strings -------------------------------
  ['number where string (spacing.1 = 8)', { spacing: { 1: 8 } }, 'error', 'invalid'],
  ['number palette value (palette.primary.main = 123)', { palette: { primary: { main: 123 } } }, 'error', 'invalid'],
  ['object where string (shadows.1 = {})', { shadows: { 1: { x: 1 } } }, 'error', 'invalid'],
  ['array where string (radii.1 = [])', { radii: { 1: ['8px'] } }, 'error', 'invalid'],
  ['boolean where string (densities.2 = true)', { densities: { 2: true } }, 'error', 'invalid'],
  ['empty string leaf (palette.primary.main = "")', { palette: { primary: { main: '' } } }, 'error', 'invalid'],
  ['whitespace-only leaf (spacing.1 = "  ")', { spacing: { 1: '  ' } }, 'error', 'invalid'],
  ['null family (palette: null)', { palette: null }, 'error', 'invalid'],
  ['null nested family (palette.primary = null)', { palette: { primary: null } }, 'error', 'invalid'],
  ['null leaf (palette.primary.light = null)', { palette: { primary: { light: null } } }, 'error', 'invalid'],
  ['null spacing leaf (spacing.16 = null)', { spacing: { 16: null } }, 'error', 'invalid'],
  ['null modes (modes = null)', { modes: null }, 'error', 'invalid'],
  ['null fonts.families entry', { fonts: { families: { code: null } } }, 'error', 'invalid'],
  ['null surface field (surfaces.contained.shadow = null)', { surfaces: { contained: { shadow: null } } }, 'error', 'invalid'],
  ['null button state (buttons.contained.states.hover = null)', { buttons: { contained: { states: { hover: null } } } }, 'error', 'invalid'],
  ['number typography field (h1.fontWeight = 700)', { typography_details: { h1: { fontWeight: 700 } } }, 'error', 'invalid'],
  ['button base with number (opacity: 0.5)', { buttons: { contained: { base: { opacity: 0.5 } } } }, 'error', 'invalid'],
  ['palette family that is a string (palette.brand = "#000")', { palette: { brand: '#000' } }, 'error', 'invalid'],
  ['array as theme', ['a'], 'error', 'invalid'],
  ['string as theme', 'not-a-theme', 'error', 'invalid'],
  // --- no coercion ----------------------------------------------------------
  ['string breakpoint (breakpoints.md = "768")', { breakpoints: { md: '768' } }, 'error', 'invalid'],
  ['fonts.google not array ("Inter")', { fonts: { google: 'Inter' } }, 'error', 'invalid'],
  ['fonts.google with empty string', { fonts: { google: [''] } }, 'error', 'invalid'],
  ['fonts.google with a number', { fonts: { google: [400] } }, 'error', 'invalid'],
  // --- breakpoints, validated once ------------------------------------------
  ['non-zero base breakpoint (xs = 10)', { breakpoints: { xs: 10 } }, 'error', 'valid'],
  ['duplicate breakpoint width (sm = 768)', { breakpoints: { sm: 768 } }, 'error', 'valid'],
  ['negative breakpoint (md = -1)', { breakpoints: { md: -1 } }, 'error', 'invalid'],
  // JSON has no Infinity, so the schema cannot see one; the engines do.
  ['non-finite breakpoint (md = Infinity)', { breakpoints: { md: Infinity } }, 'error', 'valid'],
  // --- closed sets ------------------------------------------------------------
  ['unknown fonts key (fonts.weights)', { fonts: { weights: { bold: '700' } } }, 'error', 'invalid'],
  ['unknown mode (modes.light)', { modes: { light: { palette: { primary: { main: '#000' } } } } }, 'error', 'invalid'],
  ['unknown modes.dark key (modes.dark.spacing)', { modes: { dark: { spacing: { 1: '1px' } } } }, 'error', 'invalid'],
  ['unknown nested key surface (surfaces.contained.bogus)', { surfaces: { contained: { bogus: 'red' } } }, 'error', 'invalid'],
  ['unknown nested state (buttons.contained.states.hovered)', { buttons: { contained: { states: { hovered: { bg: 'red' } } } } }, 'error', 'invalid'],
  ['unknown typography field (h1.fontsize)', { typography_details: { h1: { fontsize: '2rem' } } }, 'error', 'invalid'],
  ['unknown control key (buttons.contained.surfce)', { buttons: { contained: { surfce: 'contained' } } }, 'error', 'invalid'],
  // --- names ------------------------------------------------------------------
  ['typography role with uppercase name (H1)', { typography_details: { H1: { fontSize: '1rem' } } }, 'error', 'invalid'],
  ['surface role with uppercase name (Card)', { surfaces: { Card: { padding: '1rem' } } }, 'error', 'invalid'],
  ['button role with underscore (call_to_action)', { buttons: { call_to_action: { surface: 'contained' } } }, 'error', 'invalid'],
  ['input role starting with a digit (1st)', { inputs: { '1st': { surface: 'outlined' } } }, 'error', 'invalid'],
  ['palette family with uppercase name (Brand)', { palette: { Brand: { main: '#000' } } }, 'error', 'invalid'],
  ['breakpoint name with uppercase (Md)', { breakpoints: { Md: 700 } }, 'error', 'invalid'],
  // --- CSS injection through theme strings (T3) -------------------------------
  ['semicolon in a legacy typography value', { typography: { 'font-x': 'a; } .hack { color: blue' } }, 'error', 'invalid'],
  ['brace in a palette value', { palette: { primary: { main: 'red; } .hack { color: blue' } } }, 'error', 'invalid'],
  ['brace in a font family', { fonts: { families: { ui: 'Inter } .hack { color: red' } } }, 'error', 'invalid'],
  ['unbalanced parenthesis (spacing.1 = "calc(1px")', { spacing: { 1: 'calc(1px' } }, 'error', 'valid'],
  ['unbalanced parenthesis in a shadow', { shadows: { 1: '0 1px 2px rgba(0,0,0,0.1' } }, 'error', 'valid'],
  // --- bad responsive expressions / references (engine and integrity errors) ---
  ['bad responsive string (densities.2 uses xxl)', { densities: { 2: 'xs(space(1)) xxl(space(2))' } }, 'error', 'valid'],
  ['undefined reference palette->color', { palette: { primary: { main: 'var(--uxdsl__color__blue-500)' } } }, 'error', 'valid'],
  ['undefined reference surface radius(9)', { surfaces: { contained: { radius: 'radius(9)' } } }, 'error', 'valid'],
  ['undefined density reference in typography (fontSize: density(99))', { typography_details: { h1: { fontSize: 'density(99)' } } }, 'error', 'valid'],
  // --- unknown top-level family: a warning for the engines, invalid for the schema
  ['unknown family (colours)', { colours: { red: '#f00' } }, 'warn', 'invalid'],
  ['theme shaped like a build config', { entry: './a.uxdsl', outFile: './a.css' }, 'warn', 'invalid'],
  // --- valid themes (controls) --------------------------------------------------
  ['empty theme', {}, 'ok', 'valid'],
  ['empty families (palette {}, typography_details {}, breakpoints {})', { palette: {}, typography_details: {}, breakpoints: {} }, 'ok', 'valid'],
  ['multi-word font family unquoted', { fonts: { families: { ui: 'Inter Tight, sans-serif' } } }, 'ok', 'valid'],
  ['quoted font family list', { typography: { 'font-x': '"JetBrains Mono", "SF Mono", Menlo, monospace' } }, 'ok', 'valid'],
  ['legacy typography family value', { typography: { 'font-x': 'xs(1rem) md(2rem)' } }, 'ok', 'valid'],
  ['space-prefixed spacing key', { spacing: { 'space-1': '10px' } }, 'ok', 'valid'],
  ['$schema pointer', { $schema: './node_modules/postcss-uxdsl/schema/theme.schema.json' }, 'ok', 'valid'],
  ['custom palette family with a color-mix value', { palette: { brand: { main: 'color-mix(in srgb, #000 50%, #fff)' } } }, 'ok', 'valid'],
  ['new breakpoint name', { breakpoints: { xxl: 1536 } }, 'ok', 'valid'],
  ['valid modes.dark palette override', { modes: { dark: { palette: { primary: { main: '#fff' } } } } }, 'ok', 'valid'],
  ['standalone color and a scale', { colors: { white: '#ffffff', gray: { 300: '#CBD5E1' } } }, 'ok', 'valid'],
];

const summarize = (value) => String(value).replace(/\s+/g, ' ').slice(0, 200);

function throughPlugin(theme) {
  try {
    const result = postcss([plugin({ theme, discoverTheme: false })]).process('.a { padding: space(1); color: palette(primary); }', { from: undefined });
    const css = result.css;
    const warnings = result.warnings().map((w) => w.text);
    return { ok: true, css, warnings };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

function throughGenerator(theme) {
  try {
    return { ok: true, css: runtime.generateThemeCss(theme) };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

function throughApplyTheme(theme) {
  const previous = globalThis.document;
  globalThis.document = makeDocument();
  try {
    runtime.__resetThemeStateForTests();
    let result;
    try {
      result = runtime.applyTheme(theme, { replace: true });
    } catch (error) {
      return { ok: false, threw: true, message: error.message };
    }
    return result.ok
      ? { ok: true, warnings: result.warnings, css: document.getElementById('uxdsl-theme').textContent }
      : { ok: false, message: result.error.message, code: result.error.code };
  } finally {
    globalThis.document = previous;
  }
}

const isUnknownFamily = (text) => /Unknown theme family/.test(text);

for (const [label, theme, engines, schemaVerdict] of CASES) {
  test(`validation matrix: ${label}`, () => {
    const viaPlugin = throughPlugin(theme);
    const viaGenerator = throughGenerator(theme);
    const viaApply = throughApplyTheme(theme);
    const viaSchema = validateSchema(theme);

    const expectOk = engines !== 'error';
    assert.equal(viaPlugin.ok, expectOk, `plugin: ${summarize(viaPlugin.message || viaPlugin.css)}`);
    assert.equal(viaGenerator.ok, expectOk, `generateThemeCss: ${summarize(viaGenerator.message || viaGenerator.css)}`);
    assert.equal(viaApply.threw, undefined, `applyTheme must return ok:false, never throw: ${summarize(viaApply.message)}`);
    assert.equal(viaApply.ok, expectOk, `applyTheme: ${summarize(viaApply.message || viaApply.css)}`);
    assert.equal(viaSchema, schemaVerdict === 'valid', `schema: ${summarize((validateSchema.errors || []).map((e) => `${e.instancePath || '/'} ${e.message}`).join(' | '))}`);

    if (engines === 'error') {
      // The three engine surfaces name the same code, and never a bare
      // "[object Object]"/"null" leaking into CSS.
      const code = (viaGenerator.message.match(/\bUXD_[A-Z0-9_]+\b/) || [])[0];
      assert.ok(code, `generateThemeCss must report a UXD_* code: ${summarize(viaGenerator.message)}`);
      assert.match(viaPlugin.message, new RegExp(code), `plugin must report ${code}: ${summarize(viaPlugin.message)}`);
      assert.match(viaApply.message, new RegExp(code), `applyTheme must report ${code}: ${summarize(viaApply.message)}`);
    } else {
      for (const [name, css] of [['plugin', viaPlugin.css], ['generateThemeCss', viaGenerator.css], ['applyTheme', viaApply.css]]) {
        assert.doesNotMatch(css, /\[object Object\]|:\s*null;|:\s*undefined;/, `${name} must never emit a non-string leaf literally`);
      }
      const pluginWarned = viaPlugin.warnings.some(isUnknownFamily);
      const applyWarned = viaApply.warnings.some(isUnknownFamily);
      assert.equal(pluginWarned, engines === 'warn', `plugin unknown-family warning: ${JSON.stringify(viaPlugin.warnings)}`);
      assert.equal(applyWarned, engines === 'warn', `applyTheme unknown-family warning: ${JSON.stringify(viaApply.warnings)}`);
      const validated = runtime.validateTheme(theme);
      assert.equal(validated.ok, true);
      assert.equal(validated.warnings.some((w) => isUnknownFamily(w.message)), engines === 'warn');
    }
  });
}

test('validation matrix: the PostCSS plugin reports an unknown family through result.warn, with the key', () => {
  const { warnings } = throughPlugin({ palete: { primary: { main: '#000' } } });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Unknown theme family "palete"/);
});

test('validation matrix: a structural error carries the key path, in the validator and in the plugin', () => {
  const validated = runtime.validateTheme({ palette: { primary: { main: 5 } } });
  assert.equal(validated.ok, false);
  assert.equal(validated.errors[0].code, 'UXD_THEME_INVALID');
  assert.equal(validated.errors[0].path, 'palette.primary.main');
  assert.match(validated.errors[0].message, /^UXD_THEME_INVALID: .*\(at palette\.primary\.main\)/);

  let caught;
  try { postcss([plugin({ theme: { palette: { primary: { main: 5 } } }, discoverTheme: false })]).process('.a{}', { from: undefined }).css; } catch (error) { caught = error; }
  assert.ok(caught);
  assert.equal(caught.keyPath, 'palette.primary.main');
});

test('validation matrix: every structural error is collected, not just the first', () => {
  const validated = runtime.validateTheme({ spacing: { 1: 8, 2: null }, breakpoints: { md: '768' }, fonts: { google: 'Inter' } });
  assert.deepEqual(validated.errors.map((e) => e.path).sort(), ['breakpoints.md', 'fonts.google', 'spacing.1', 'spacing.2']);
  assert.ok(validated.errors.every((e) => e.code === 'UXD_THEME_INVALID'));
});

test('validation matrix: a breakpoint problem is reported once, as UXD_BP_INVALID, by every surface', () => {
  const theme = { breakpoints: { xs: 0, sm: 480, md: -1, lg: 1024, xl: 1280 } };
  const validated = runtime.validateTheme(theme);
  assert.equal(validated.ok, false);
  assert.equal(validated.errors.length, 1, JSON.stringify(validated.errors));
  assert.equal(validated.errors[0].code, 'UXD_BP_INVALID');
  assert.equal(validated.errors[0].path, 'breakpoints.md');
  assert.match(throughGenerator(theme).message, /UXD_BP_INVALID/);
  assert.doesNotMatch(throughGenerator(theme).message, /UXD_TYPO_BP|UXD_EDGE_BP/);
  assert.match(throughPlugin(theme).message, /UXD_BP_INVALID/);
  // The engines no longer re-check the map under their own family code.
  assert.match(throughGenerator({ breakpoints: { xs: 10 } }).message, /UXD_BP_INVALID/);
  assert.equal(runtime.validateTheme({ breakpoints: { xs: 10 } }).errors.length, 1);
});

test('validation matrix: validateTheme does not normalize — fonts.families are emitted as written by both paths', async () => {
  const theme = { fonts: { families: { ui: 'Inter Tight, sans-serif' } } };
  const validated = runtime.validateTheme(theme);
  assert.equal(validated.theme.fonts.families.ui, 'Inter Tight, sans-serif');
  assert.match(runtime.generateThemeCss(theme), /--uxdsl__font__ui: Inter Tight, sans-serif;/);
  const compiled = await postcss([plugin({ theme, discoverTheme: false })]).process('', { from: undefined });
  assert.match(compiled.css, /--uxdsl__font__ui: Inter Tight, sans-serif;/);
});

test('validation matrix: the deprecated alias still validates the same way', () => {
  assert.equal(typeof runtime.validateAndNormalizeTheme, 'function');
  const viaAlias = runtime.validateAndNormalizeTheme({ spacing: { 1: 8 } });
  const viaValidator = runtime.validateTheme({ spacing: { 1: 8 } });
  assert.deepEqual(viaAlias.errors, viaValidator.errors);
});
