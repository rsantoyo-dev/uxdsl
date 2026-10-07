'use strict';

// Stability phase 3 (audit DE-6, L20): a typography variable is named after
// the CSS property it holds — `--uxdsl__typography__<role>-font-size`, not
// `-size` — the way `-font-family` and `-margin-block-start` always were.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');

const exported = require('../dist/index');
const plugin = exported.default || exported;
const runtime = require('../dist/ds-runtime');
const { TYPOGRAPHY_PROPERTIES, TYPOGRAPHY_CSS_PROPERTIES } = require('../dist/typography');

const CSS_PROPERTIES = {
  fontFamily: 'font-family', fontSize: 'font-size', lineHeight: 'line-height', fontWeight: 'font-weight',
  letterSpacing: 'letter-spacing', textTransform: 'text-transform', textDecoration: 'text-decoration', fontStyle: 'font-style',
  marginBlockStart: 'margin-block-start', marginBlockEnd: 'margin-block-end',
};

test('the variable suffix of every typography field is its CSS property name', () => {
  assert.deepEqual({ ...TYPOGRAPHY_PROPERTIES }, CSS_PROPERTIES);
  assert.deepEqual({ ...TYPOGRAPHY_CSS_PROPERTIES }, CSS_PROPERTIES);
});

test('the generated theme emits the property-named variables and none of the abbreviated ones', () => {
  const css = runtime.generateThemeCss({
    typography_details: { hero: { fontSize: 'xs(2rem) md(3rem)', lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em', textTransform: 'uppercase', textDecoration: 'none', fontStyle: 'italic', fontFamily: 'var(--uxdsl__font__ui)', marginBlockStart: '0', marginBlockEnd: 'space(2)' } },
  });
  for (const suffix of Object.values(CSS_PROPERTIES)) assert.match(css, new RegExp(`--uxdsl__typography__hero-${suffix}:`), suffix);
  assert.match(css, /@media \(min-width: 768px\) \{ :root \{[^}]*--uxdsl__typography__hero-font-size: 3rem;/);
  for (const old of ['-size:', '-line:', '-weight:', '-spacing:', '-transform:', '-decoration:', '-style:']) {
    assert.doesNotMatch(css, new RegExp(`--uxdsl__typography__hero${old}`), `the abbreviated ${old} is gone`);
  }
  // Every emitted typography variable ends in one of the ten property names.
  const names = [...css.matchAll(/--uxdsl__typography__([\w-]+?):/g)].map((m) => m[1]);
  const suffixes = Object.values(CSS_PROPERTIES);
  for (const name of names) assert.ok(suffixes.some((suffix) => name.endsWith(`-${suffix}`)), name);
});

test('@ds-typo consumes the same names it defines, so a role resolves in a build and at run time alike', () => {
  const css = postcss([plugin({ discoverTheme: false, includeTheme: true })]).process('.title { @ds-typo(h1); }', { from: undefined }).css;
  const emitted = css.match(/\.title \{([^}]*)\}/)[1];
  for (const reference of emitted.matchAll(/var\((--uxdsl__typography__h1-[\w-]+)\)/g)) {
    assert.ok(css.includes(`${reference[1]}:`), `${reference[1]} is defined by the theme block`);
  }
  assert.match(emitted, /font-size: var\(--uxdsl__typography__h1-font-size\)/);
  assert.match(emitted, /line-height: var\(--uxdsl__typography__h1-line-height\)/);
  assert.match(emitted, /font-weight: var\(--uxdsl__typography__h1-font-weight\)/);
  assert.match(emitted, /letter-spacing: var\(--uxdsl__typography__h1-letter-spacing\)/);
  // The declaration and its variable carry the same property name.
  for (const [, prop, name] of emitted.matchAll(/([a-z-]+): var\(--uxdsl__typography__h1-([\w-]+)\)/g)) {
    assert.equal(name, prop);
  }
});

test('the codemods rename the former suffixes', () => {
  const { migrate } = require('../scripts/codemod-namespace.js');
  const { output } = migrate('.a { font-size: var(--h1-size); line-height: var(--p-line); letter-spacing: var(--caption-spacing); margin-block-end: var(--h1-margin-block-end); }');
  assert.equal(output, '.a { font-size: var(--uxdsl__typography__h1-font-size); line-height: var(--uxdsl__typography__p-line-height); letter-spacing: var(--uxdsl__typography__caption-letter-spacing); margin-block-end: var(--uxdsl__typography__h1-margin-block-end); }');
});
