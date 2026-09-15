const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { inspectReferences } = require('../dist/reference-integrity');
const plugin = require('../dist');
const { generateThemeCss } = require('../dist/ds-runtime');
const theme = require('../../../fixtures/mig07-consumer/theme.json');
function inspect(css) {
  const root = postcss.parse(css, { from: 'reference-fixture.css' });
  const consumers = [];
  root.walkDecls('color', node => consumers.push(node));
  return inspectReferences(root, consumers);
}
test('missing transitives carry consumer, chain and location', () => {
  const [issue] = inspect(':root { --a: var(--b); } .x { color: var(--a); }');
  assert.equal(issue.code, 'UXD_REFERENCE_MISSING');
  assert.deepEqual(issue.chain, ['color', '--a', '--b']);
  assert.equal(issue.consumer, 'color');
  assert.ok(issue.source.endsWith('reference-fixture.css'));
  assert.equal(issue.line, 1);
});
test('cycles fail and valid fallbacks recover absent tokens', () => {
  assert.equal(inspect(':root { --a: var(--b); --b: var(--a); } .x { color: var(--a); }')[0].code, 'UXD_REFERENCE_CYCLE');
  assert.deepEqual(inspect('.x { color: var(--missing, red); }'), []);
});
test('scope and breakpoint availability are respected', () => {
  assert.equal(inspect('.other { --a: red; } .x { color: var(--a); }').length, 1);
  assert.equal(inspect('@media (min-width: 800px) { :root { --a: red; } } .x { color: var(--a); }').length, 1);
  assert.deepEqual(inspect('@media (min-width: 800px) { :root { --a: red; } } @media (min-width: 900px) { .x { color: var(--a); } }'), []);
});
test('strict components use declared themes and custom density 16 without globals', async () => {
  const result = await postcss([plugin({ theme: { ...theme, densities: { 16: 'xs(space(1)) md(space(2))' } }, includeTheme: false })]).process('.x { padding: density(16); }', { from: undefined });
  assert.match(result.css, /var\(--uxdsl__density__16\)/);
  assert.ok(!result.css.includes(':root'));
});
test('external providers are explicit and plain host CSS stays outside DSL validation', async () => {
  await postcss([plugin({ includeTheme: false, references: { externalTokens: ['--uxdsl__border__1'] } })]).process('.x { border: border(1); color: var(--host); }', { from: undefined });
  await assert.rejects(postcss([plugin({ includeTheme: false })]).process('.x { border: border(1); }', { from: undefined }), /UXD_REFERENCE_MISSING/);
});
test('runtime and PostCSS reject missing mandatory theme dependencies', async () => {
  const invalid = { ...theme, surfaces: { contained: { bg: 'palette(missing.main)' } } };
  assert.throws(() => generateThemeCss(invalid), /UXD_REFERENCE_MISSING/);
  await assert.rejects(postcss([plugin({ theme: invalid })]).process('.x { @ds-surface(contained); }', { from: undefined }), /UXD_REFERENCE_MISSING/);
});
