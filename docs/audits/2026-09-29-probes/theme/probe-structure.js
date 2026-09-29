// Which patches applyTheme accepts vs refuses (UXD_THEME_STRUCTURE) after init with {}.
const path = require('path');
const PKG = '/Users/ricardosantoyo/Documents/projects/uxdsl/packages/postcss-uxdsl';
const rt = require(path.join(PKG, 'dist/ds-runtime.js'));

function makeDocument() {
  const byId = new Map();
  return {
    createElement(tagName) { const a = {}; return { tagName: tagName.toUpperCase(), id: '', textContent: '', style: { setProperty() {} }, setAttribute(n, v) { a[n] = v; }, getAttribute(n) { return n in a ? a[n] : null; } }; },
    getElementById(id) { return byId.get(id) || null; },
    head: { appendChild(node) { if (node.id) byId.set(node.id, node); return node; } },
    documentElement: { style: { setProperty() {}, removeProperty() {}, length: 0, item() { return null; } } },
  };
}
const patches = {
  'value: palette.primary.main': { palette: { primary: { main: '#0ea5e9' } } },
  'value: spacing.1': { spacing: { '1': '0.2rem' } },
  'value: densities.2 different thresholds (drop xl)': { densities: { '2': 'xs(space(2)) md(space(3))' } },
  'value: surfaces.contained.bg': { surfaces: { contained: { bg: 'palette(primary.main)' } } },
  'value: surfaces.contained.border -> none': { surfaces: { contained: { border: 'none' } } },
  'value: modes.dark.palette.primary.main': { modes: { dark: { palette: { primary: { main: '#fff' } } } } },
  'value: typography_details.h1.fontSize': { typography_details: { h1: { fontSize: 'xs(2rem)' } } },
  'add: new palette family (tone-qualifying)': { palette: { brand: { main: '#111', dark: '#000', contrast: '#fff' } } },
  'add: new breakpoint xxl': { breakpoints: { xxl: 1536 } },
  'add: new density key 16': { densities: { '16': 'xs(space(16))' } },
  'add: new typography role': { typography_details: { display: { fontSize: 'xs(3rem)' } } },
  'add: new surface role': { surfaces: { hero: { bg: 'palette(primary.main)' } } },
  'add: typography field on existing role (h1.textTransform)': { typography_details: { h1: { textTransform: 'uppercase' } } },
  'add: typography field on default (cascades to all roles)': { typography_details: { default: { fontStyle: 'normal' } } },
  'add: button state focusvisible': { buttons: { contained: { states: { focusvisible: { outline: '2px solid red' } } } } },
  'add: button base field (font-weight)': { buttons: { contained: { base: { 'font-weight': '600' } } } },
  'add: input state readonly': { inputs: { outlined: { states: { readonly: { opacity: '0.7' } } } } },
  'change: buttons.contained.surface -> outlined': { buttons: { contained: { surface: 'outlined' } } },
  'change: breakpoints.md 768 -> 800': { breakpoints: { md: 800 } },
  'remove: palette.primary.light (null)': { palette: { primary: { light: null } } },
  'remove: spacing.16 (null)': { spacing: { '16': null } },
  'remove: fonts.families.code (null)': { fonts: { families: { code: null } } },
  'remove: modes.dark entirely (null)': { modes: null },
  'remove: modes.dark.palette.secondary (null)': { modes: { dark: { palette: { secondary: null } } } },
  'remove: surfaces.contained.shadow field (null)': { surfaces: { contained: { shadow: null } } },
  'remove: buttons.contained.states.hover (null)': { buttons: { contained: { states: { hover: null } } } },
  'change: fonts.google list': { fonts: { google: ['Roboto:wght@400'] } },
  'legacy typography: add font-x': { typography: { 'font-x': '1rem' } },
  'legacy typography: remove font-code (null)': { typography: { 'font-code': null } },
  'palette.primary loses dark (null) -> not a tone': { palette: { primary: { dark: null } } },
};
const prev = globalThis.document;
globalThis.document = makeDocument();
try {
  for (const [name, patch] of Object.entries(patches)) {
    rt.__resetThemeStateForTests();
    const init = rt.applyTheme({}, { replace: true });
    if (!init.ok) { console.log('init failed', init.error.message); break; }
    const res = rt.applyTheme(patch);
    const tag = res.ok ? 'ACCEPTED' : (res.error.code || 'REJECT');
    const detail = res.ok ? (res.warnings.length ? ' warnings: ' + res.warnings.join(' | ').slice(0, 140) : '') : ' — ' + (res.error.changes ? res.error.changes.join('; ').slice(0, 220) : res.error.message.replace(/\s+/g, ' ').slice(0, 220));
    console.log(`${tag.padEnd(20)} ${name}${detail}`);
  }
  // Legacy interplay: updatePalette then applyTheme
  rt.__resetThemeStateForTests();
  rt.applyTheme({}, { replace: true });
  rt.updatePalette('primary.main', '#ff0000');
  const r2 = rt.applyTheme({ palette: { primary: { main: '#00ff00' } } });
  console.log('\nupdatePalette then applyTheme ->', r2.ok, '(inline style on <html> is untouched by applyTheme; by cascade it wins over the managed <style>)');
  // updateBreakpoint after applyTheme
  rt.updateBreakpoint('md', 900);
  console.log('after updateBreakpoint(md,900): getBreakpoints().md =', rt.getBreakpoints().md, '; getAppliedTheme().breakpoints =', JSON.stringify(rt.getAppliedTheme().breakpoints));
  const r3 = rt.applyTheme({ breakpoints: { md: 900 } });
  console.log('applyTheme({breakpoints:{md:900}}) ->', r3.ok ? 'ok' : r3.error.code);
} finally { globalThis.document = prev; }
