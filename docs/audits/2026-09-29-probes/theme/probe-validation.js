// Validation matrix: same invalid theme through PostCSS plugin, validateAndNormalizeTheme (=applyTheme's gate),
// applyTheme (DOM stub), and the JSON schema via ajv. Read-only against the repo; requires dist to be built.
const path = require('path');
const PKG = '/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl';
const postcss = require(path.join(PKG, 'node_modules/postcss'));
const uxdsl = require(path.join(PKG, 'dist/index.js'));
const rt = require(path.join(PKG, 'dist/ds-runtime.js'));
const schema = require(path.join(PKG, 'schema/theme.schema.json'));
const Ajv = require(path.join(PKG, 'node_modules/ajv'));
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

const cases = {
  'number where string (spacing.1 = 8)': { spacing: { '1': 8 } },
  'number palette value (palette.primary.main = 123)': { palette: { primary: { main: 123 } } },
  'object where string (shadows.1 = {})': { shadows: { '1': { x: 1 } } },
  'unknown family (colours)': { colours: { red: '#f00' } },
  'unknown nested key surface (surfaces.contained.bogus)': { surfaces: { contained: { bogus: 'red' } } },
  'unknown nested state (buttons.contained.states.hovered)': { buttons: { contained: { states: { hovered: { bg: 'red' } } } } },
  'unknown fonts key (fonts.weights)': { fonts: { weights: { bold: 700 } } },
  'unknown mode (modes.light)': { modes: { light: { palette: { primary: { main: '#000' } } } } },
  'bad responsive string (densities.2 uses xxl)': { densities: { '2': 'xs(space(1)) xxl(space(2))' } },
  'undefined reference palette->color': { palette: { primary: { main: 'var(--uxdsl__color__blue-500)' } } },
  'undefined reference surface radius(9)': { surfaces: { contained: { radius: 'radius(9)' } } },
  'undefined density reference in typography (fontSize: density(99))': { typography_details: { h1: { fontSize: 'density(99)' } } },
  'empty families (palette {}, typography_details {}, breakpoints {})': { palette: {}, typography_details: {}, breakpoints: {} },
  'null family (palette: null)': { palette: null },
  'null nested family (palette.primary = null)': { palette: { primary: null } },
  'null leaf (palette.primary.light = null)': { palette: { primary: { light: null } } },
  'null spacing leaf (spacing.16 = null)': { spacing: { '16': null } },
  'string breakpoint (breakpoints.md = "768")': { breakpoints: { md: '768' } },
  'non-zero base breakpoint (xs = 10)': { breakpoints: { xs: 10 } },
  'duplicate breakpoint width (sm = 768)': { breakpoints: { sm: 768 } },
  'number typography field (h1.fontWeight = 700)': { typography_details: { h1: { fontWeight: 700 } } },
  'fonts.google not array ("Inter")': { fonts: { google: 'Inter' } },
  'fonts.google with empty string': { fonts: { google: [''] } },
  'multi-word font family unquoted': { fonts: { families: { ui: 'Inter Tight, sans-serif' } } },
  'array as theme': ['a'],
  'palette family that is a string (palette.brand = "#000")': { palette: { brand: '#000' } },
  'button base with number (opacity: 0.5)': { buttons: { contained: { base: { opacity: 0.5 } } } },
  'typography role with uppercase name (H1)': { typography_details: { H1: { fontSize: '1rem' } } },
  'legacy typography family value': { typography: { 'font-x': 'xs(1rem) md(2rem)' } },
  'space-prefixed spacing key': { spacing: { 'space-1': '10px' } },
};

const summarize = (s) => String(s).replace(/\s+/g, ' ').slice(0, 160);

for (const [name, theme] of Object.entries(cases)) {
  const row = { case: name };
  // (a) PostCSS plugin
  try {
    const r = postcss([uxdsl({ theme, discoverTheme: false })]).process('.a { padding: space(1); color: palette(primary); }', { from: undefined });
    const css = r.css;
    const warns = r.warnings().map((w) => w.text);
    row.plugin = 'OK' + (warns.length ? ` (warnings: ${summarize(warns.join(' | '))})` : '');
    if (/@import url\('https:\/\/fonts.googleapis.com\/css2\?family=&/.test(css)) row.plugin += ' [emits empty @import]';
    const m = css.match(/--uxdsl__(space__1|palette__primary-main|palette__primary|font__ui|palette__primary-light|space__16): ([^;]*);/g);
    if (m) row.plugin += ' emits: ' + m.slice(0, 3).join(' ');
  } catch (e) {
    row.plugin = 'THROWS ' + summarize(e.message);
  }
  // (b) validateAndNormalizeTheme over resolveTheme (applyTheme's gate)
  try {
    const eff = rt.resolveTheme(theme);
    const v = rt.validateAndNormalizeTheme(eff);
    row.validate = (v.ok ? 'ok' : 'ERRORS: ' + summarize(v.errors.map((e) => `${e.path}: ${e.message}`).join(' | '))) + (v.warnings.length ? ' WARN: ' + summarize(v.warnings.map((w) => `${w.path}: ${w.message}`).join(' | ')) : '');
    // note: unknown-family warning is only emitted for keys of `input` (the effective theme here), so also test raw
    const vr = rt.validateAndNormalizeTheme(theme);
    const rawWarn = vr.warnings.filter((w) => /Unknown theme family/.test(w.message)).map((w) => w.path);
    if (rawWarn.length) row.validate += ` [raw-input unknown-family warn: ${rawWarn.join(',')}]`;
  } catch (e) {
    row.validate = 'THROWS ' + summarize(e.message);
  }
  // (c) applyTheme with DOM stub
  const prev = globalThis.document;
  globalThis.document = makeDocument();
  try {
    rt.__resetThemeStateForTests();
    const res = rt.applyTheme(theme, { replace: true });
    row.applyTheme = res.ok ? 'ok' + (res.warnings.length ? ' WARN: ' + summarize(res.warnings.join(' | ')) : '') : 'REJECT ' + summarize(res.error.message);
  } catch (e) {
    row.applyTheme = 'THROWS ' + summarize(e.message);
  } finally {
    globalThis.document = prev;
  }
  // (d) JSON schema (ajv)
  const ok = validateSchema(theme);
  row.schema = ok ? 'valid' : 'INVALID: ' + summarize(validateSchema.errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join(' | '));
  console.log('\n### ' + name);
  console.log('  plugin     : ' + row.plugin);
  console.log('  validate   : ' + row.validate);
  console.log('  applyTheme : ' + row.applyTheme);
  console.log('  schema     : ' + row.schema);
}
