'use strict';

// Every code in DIAGNOSTIC_CATALOG is provoked by some test
// (test/diagnostics-catalog.test.js checks it). Most are, in the test of the
// behavior they guard; the theme engines' structural codes are mostly
// reached first as `UXD_THEME_INVALID` through `validateTheme`, so here each
// one is provoked through the public engine function that owns it — the
// direct call a tool (the playground's editors, a script) makes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');

const exported = require('../dist/index');
const plugin = exported.default || exported;
const runtime = require('../dist/ds-runtime');
const { compileDensityRules, getDensityTokens } = require('../dist/language');
const { compilePresetRules } = require('../dist/preset-engine');

const theme = runtime.resolveTheme({});
const withButtons = (buttons) => ({ ...theme, buttons });
const withInputs = (inputs) => ({ ...theme, inputs });

const CASES = [
  // Buttons and Inputs: the control engine, one template for both families.
  // The codes are listed literally so the catalog test can find each one.
  ...[
    ['UXD_BUTTON_MAP', 'UXD_BUTTON_ROLE', 'UXD_BUTTON_FIELD', 'UXD_BUTTON_FIELDS', 'UXD_BUTTON_SURFACE', 'UXD_BUTTON_STATES', 'UXD_BUTTON_STATE', 'UXD_BUTTON_VALUE', 'UXD_BUTTON_BASE', 'UXD_BUTTON_VIEWPORT', 'UXD_BUTTON_NAME_COLLISION'],
    ['UXD_INPUT_MAP', 'UXD_INPUT_ROLE', 'UXD_INPUT_FIELD', 'UXD_INPUT_FIELDS', 'UXD_INPUT_SURFACE', 'UXD_INPUT_STATES', 'UXD_INPUT_STATE', 'UXD_INPUT_VALUE', 'UXD_INPUT_BASE', 'UXD_INPUT_VIEWPORT', 'UXD_INPUT_NAME_COLLISION'],
  ].flatMap((codes) => {
    const button = codes[0].startsWith('UXD_BUTTON');
    const generate = button ? runtime.generateButtonCss : runtime.generateInputCss;
    const inspect = button ? runtime.inspectButtonTheme : runtime.inspectInputTheme;
    const parse = button ? runtime.parseButtonArguments : runtime.parseInputArguments;
    const set = button ? withButtons : withInputs;
    const provoke = {
      MAP: () => generate(set(5)),
      ROLE: () => parse(theme, 'missing'),
      FIELD: () => generate(set({ x: { base: { bogus: '1px' } } })),
      FIELDS: () => generate(set({ x: { base: 'padding: 1px' } })),
      SURFACE: () => generate(set({ x: { surface: 'missing' } })),
      STATES: () => generate(set({ x: { states: 'hover' } })),
      STATE: () => generate(set({ x: { states: { bogus: { bg: 'red' } } } })),
      VALUE: () => generate(set({ x: { base: { padding: '' } } })),
      BASE: () => generate(set({ x: { base: { padding: 'md(8px)' } } })),
      VIEWPORT: () => inspect(theme, -1),
      // A role literally named after another role's per-tone variable: role "x"
      // toned "primary" and role "x-tone-primary" both claim
      // `<family>__x-tone-primary-hover-bg`.
      NAME_COLLISION: () => generate(set({ x: { states: { hover: { bg: 'tone(dark)' } } }, 'x-tone-primary': { states: { hover: { bg: 'red' } } } })),
    };
    return codes.map((code) => [code, provoke[code.replace(/^UXD_(BUTTON|INPUT)_/, '')]]);
  }),
  // Surfaces.
  ['UXD_SURFACE_MAP', () => runtime.getSurfaceTokens({ surfaces: 5 })],
  ['UXD_SURFACE_ROLE', () => runtime.getSurfaceTokens({ surfaces: { Bad: { bg: 'red' } } })],
  ['UXD_SURFACE_VALUE', () => runtime.getSurfaceTokens({ surfaces: { x: { bg: '' } } })],
  ['UXD_SURFACE_BASE', () => runtime.generateSurfaceCss({ ...theme, surfaces: { contained: { padding: 'md(1px)' } } })],
  ['UXD_SURFACE_VIEWPORT', () => runtime.inspectSurfaceTheme(theme, -1)],
  ['UXD_SURFACE_NAME_COLLISION', () => compilePresetRules({ x: { 'y__z': '1px' }, 'x__y': { z: '2px' } }, { xs: 0 }, 'UXD_SURFACE')],
  // Borders and Radii.
  ['UXD_EDGE_MAP', () => runtime.getEdgeTokens({ radii: 5 })],
  ['UXD_EDGE_VALUE', () => runtime.getEdgeTokens({ radii: { x: '' } })],
  ['UXD_EDGE_BASE', () => runtime.generateEdgeCss({ radii: { x: 'md(8px)' } })],
  ['UXD_EDGE_VIEWPORT', () => runtime.inspectEdgeTheme({}, -1)],
  ['UXD_EDGE_NAME_COLLISION', () => compilePresetRules({ x: { 'y__z': '1px' }, 'x__y': { z: '2px' } }, { xs: 0 }, 'UXD_EDGE')],
  // Shadows.
  ['UXD_SHADOW_MAP', () => runtime.getShadowTokens({ shadows: 5 })],
  ['UXD_SHADOW_VALUE', () => runtime.getShadowTokens({ shadows: { x: '' } })],
  ['UXD_SHADOW_BASE', () => runtime.generateShadowCss({ shadows: { x: 'md(0 1px 2px red)' } })],
  ['UXD_SHADOW_VIEWPORT', () => runtime.inspectShadowTheme({}, -1)],
  ['UXD_SHADOW_NAME_COLLISION', () => compilePresetRules({ x: { 'y__z': '1px' }, 'x__y': { z: '2px' } }, { xs: 0 }, 'UXD_SHADOW')],
  ['UXD_SHADOW_REFERENCE', () => postcss([plugin({ discoverTheme: false, includeTheme: false })]).process('.a { box-shadow: shadow(99); }', { from: undefined }).css],
  // Densities.
  ['UXD_DENSITY_MAP', () => getDensityTokens({ densities: 5 })],
  ['UXD_DENSITY_VALUE', () => getDensityTokens({ densities: { x: '' } })],
  ['UXD_DENSITY_KEY', () => compileDensityRules({ 'a b': '1px' })],
  ['UXD_DENSITY_BASE', () => compileDensityRules({ x: 'md(space(1))' })],
  // Typography.
  ['UXD_TYPO_DETAILS', () => runtime.compileTypographyRules([])],
  ['UXD_TYPO_ROLE', () => runtime.compileTypographyRules({ Hero: { fontSize: '2rem' } })],
  ['UXD_TYPO_BASE', () => runtime.compileTypographyRules({ h1: { fontSize: 'md(2rem)' } })],
  // References: an external token is a custom property name.
  ['UXD_REFERENCE_CONTEXT', () => postcss([plugin({ discoverTheme: false, includeTheme: false, references: { externalTokens: ['not-a-custom-property'] } })]).process('.a { color: palette(primary); }', { from: undefined }).css],
];

for (const [code, provoke] of CASES) {
  test(`${code} is produced by its owner`, () => {
    assert.throws(provoke, (error) => new RegExp(`\\b${code}\\b`).test(error.message), code);
  });
}

test('UXD_THEME_FAMILY is a warning, with its code, for an unknown top-level family', () => {
  const result = runtime.validateTheme({ palete: {} });
  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings.map((warning) => [warning.code, warning.path]), [['UXD_THEME_FAMILY', 'palete']]);
});
