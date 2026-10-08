'use strict';

// Stability phase 4 (audit R5): the theme paths no longer parse the CSS they
// generate. The engines build blocks; one serializer writes them
// (src/css-blocks.ts) and the reference check reads the same blocks as
// declarations. These tests hold the two views to each other with PostCSS as
// the independent reader: what the check sees is exactly what PostCSS would
// read back from the string that ships — for the base theme and every theme
// the playground ships.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { renderTheme } = require('../dist/ds-runtime/theme-generator');
const { generateThemeCss, validateTheme, resolveTheme, deepMergeTheme } = require('../dist/entries/theme');
const { splitSelectorList, buttonComponentCss } = require('../dist/entries/engine');

const PLAYGROUND = path.resolve(__dirname, '../../playground-nextjs');

/** What PostCSS reads back from a stylesheet, in the reference engine's terms. */
function parsedDeclarations(css) {
  const out = [];
  postcss.parse(css).walkDecls((decl) => {
    let selector = ':root';
    const conditions = [];
    for (let parent = decl.parent; parent && parent.type !== 'root'; parent = parent.parent) {
      if (parent.type === 'rule') selector = parent.selector;
      if (parent.type === 'atrule') conditions.unshift(`@${parent.name} ${parent.params}`);
    }
    out.push({ prop: decl.prop, value: decl.value, selector, conditions, important: decl.important });
  });
  return out;
}

function themesUnderTest() {
  const themes = [['base', resolveTheme()]];
  const shared = JSON.parse(fs.readFileSync(path.join(PLAYGROUND, 'uxdsl.theme.shared.json'), 'utf8'));
  for (const name of ['default', 'green', 'purple', 'slate']) {
    const override = JSON.parse(fs.readFileSync(path.join(PLAYGROUND, `uxdsl.theme.${name}.json`), 'utf8'));
    themes.push([`playground ${name}`, resolveTheme(deepMergeTheme(shared, override))]);
  }
  themes.push(['google fonts + custom breakpoints', resolveTheme({ fonts: { google: ['Inter:wght@400;700'] }, breakpoints: { md: 900, xl: 1440 } })]);
  return themes;
}

test('phase 4: the declarations the reference check reads are exactly what PostCSS reads back from the generated CSS', () => {
  for (const [label, theme] of themesUnderTest()) {
    const { css, declarations } = renderTheme(theme);
    const fromBlocks = declarations.map(({ prop, value, selector, conditions, important }) => ({ prop, value, selector, conditions, important }));
    assert.deepEqual(fromBlocks, parsedDeclarations(css), `${label}: the blocks and the serialized CSS disagree`);
    assert.ok(declarations.length > 500, `${label}: control — the comparison is not vacuous (${declarations.length} declarations)`);
  }
});

test('phase 4: generateThemeCss is still the string the plugin inserts (renderTheme().css)', () => {
  for (const [label, theme] of themesUnderTest()) {
    assert.equal(generateThemeCss(theme), renderTheme(theme).css, label);
  }
});

test('phase 4: a dangling reference is still caught on the theme paths, without a parser', () => {
  const dangling = { palette: { primary: { main: 'color(nope.500)' } } };
  assert.throws(() => generateThemeCss(dangling), /UXD_REFERENCE_MISSING: .*--uxdsl__color__nope-500/);
  const result = validateTheme(resolveTheme(dangling));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === 'UXD_REFERENCE_MISSING'));
  // …and an external the host declares is accepted, as before.
  assert.doesNotThrow(() => generateThemeCss({ fonts: { families: { ui: 'var(--host-font)' } } }, { externalTokens: ['--host-font'] }));
  assert.throws(() => generateThemeCss({ fonts: { families: { ui: 'var(--host-font)' } } }), /UXD_REFERENCE_MISSING/);
});

test('phase 4: compiled `references.css` is the PostCSS plugin\'s option; the theme paths refuse it instead of ignoring it', () => {
  const css = [':root { --host-font: Inter; }'];
  assert.throws(() => generateThemeCss({}, { css }), (error) => error.code === 'UXD_REFERENCE_CONTEXT' && /references\.css/.test(error.message) && /externalTokens/.test(error.message));
  const result = validateTheme(resolveTheme(), { references: { css } });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'UXD_REFERENCE_CONTEXT');
  // The plugin still reads it: a component entry validated against another entry's CSS.
  const plugin = require('../dist/plugin');
  const out = postcss([plugin({ discoverTheme: false, includeTheme: false, references: { css: [':root { --host-font: Inter; }'] } })])
    .process('.a { font-family: var(--host-font); color: palette(primary); }', { from: undefined }).css;
  assert.match(out, /var\(--host-font\)/);
});

test('phase 4: splitSelectorList splits a selector list exactly as postcss.list.comma does', () => {
  const corpus = [
    '.btn', '.a, .b', '.a,.b', ' .a ,  .b ', '.btn:is(.x, .y)', '.btn:where(.a, .b):not(.c, .d)', ':is(.a, .b) .c, .d',
    'a[href="x,y"]', "a[title='a, b'], b", '.a:has(> .b, + .c)', '.a\\,b', '.x > .y ~ .z, .w + .v', 'html[data-theme="dark"] .btn, .btn.is-selected',
    '.a:nth-child(2n + 1), .b:nth-of-type(odd)', '.a,', ',.a', '.a, , .b', '.€, .日本',
  ];
  for (const selector of corpus) assert.deepEqual(splitSelectorList(selector), postcss.list.comma(selector), JSON.stringify(selector));
  // The one deliberate difference: a comma inside a comment is not a separator
  // (postcss.list.comma splits there). PostCSS keeps comments out of
  // rule.selector, so the plugin never hands one over; a direct caller of
  // buttonComponentCss/inputComponentCss gets the comment kept whole.
  assert.deepEqual(splitSelectorList('.a /* c, d */, .b'), ['.a /* c, d */', '.b']);
});

test('phase 4: a control directive on a selector list keeps functional pseudo-classes whole', () => {
  const css = buttonComponentCss(resolveTheme(), '.btn:is(.x, .y), .z', 'contained');
  assert.match(css, /\.btn:is\(\.x, \.y\):hover/);
  assert.match(css, /\.z:hover/);
  assert.doesNotMatch(css, /\.btn:is\(\.x:hover/);
});
