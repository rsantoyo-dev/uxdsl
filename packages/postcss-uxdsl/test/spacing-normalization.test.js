const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;
const { normalizeSpacingKey, normalizeSpacingDefinitions } = require('../dist/language');
const { generateFoundationCss } = require('../dist/foundations');

const compile = (source, options = {}) => postcss([plugin({ references: { mode: 'off' }, ...options })]).process(source, { from: undefined });

test('MIG-01: "1" and "space-1", in separate configurations, both produce --space-1', () => {
  assert.equal(generateFoundationCss({ spacing: { 1: '4px' } }), generateFoundationCss({ spacing: { 'space-1': '4px' } }));
  assert.match(generateFoundationCss({ spacing: { 'space-1': '4px' } }), /--space-1: 4px/);
});

test('MIG-01: both keys in the same configuration collide instead of one winning by accidental order', () => {
  assert.throws(() => normalizeSpacingDefinitions({ 1: '4px', 'space-1': '4px' }), /UXD_SPACING_COLLISION/);
  assert.throws(() => normalizeSpacingDefinitions({ 'space-1': '4px', 1: '4px' }), /UXD_SPACING_COLLISION/);
  assert.throws(() => generateFoundationCss({ spacing: { 1: '4px', 'space-1': '8px' } }), /UXD_SPACING_COLLISION/);
});

test('MIG-01: an arbitrary identifier prefix is never stripped without the documented rule (exactly one leading "space-")', () => {
  assert.equal(normalizeSpacingKey('outer-space'), 'outer-space');
  assert.equal(normalizeSpacingKey('space-gutter'), 'gutter');
  // A repeated prefix is invalid, not silently unwrapped down to the bare identifier.
  assert.throws(() => normalizeSpacingDefinitions({ 'space-space-1': '4px' }), /UXD_SPACING_KEY/);
  assert.throws(() => normalizeSpacingDefinitions({ 'space-': '4px' }), /UXD_SPACING_KEY/);
});

test('MIG-01: Density and radius resolve against a configured spacing key regardless of which spelling defined it', async () => {
  const bySpace1 = await compile('.x { padding: space(gutter); }', { theme: { spacing: { 'space-gutter': '12px' } } });
  const byBare = await compile('.x { padding: space(gutter); }', { theme: { spacing: { gutter: '12px' } } });
  assert.match(bySpace1.css, /padding: var\(--space-gutter\)/);
  assert.equal(bySpace1.css, byBare.css);
  const themeCss = generateFoundationCss({ spacing: { 'space-gutter': '12px' } });
  assert.match(themeCss, /--space-gutter: 12px/);
});

test('MIG-01: legacy, new and custom-scale spacing configurations are all covered', () => {
  const legacy = { ...normalizeSpacingDefinitions({ 'space-1': '4px', 'space-2': '8px' }) };
  assert.deepEqual(legacy, { 1: '4px', 2: '8px' });
  const modern = { ...normalizeSpacingDefinitions({ 1: '4px', 2: '8px' }) };
  assert.deepEqual(modern, { 1: '4px', 2: '8px' });
  const custom = { ...normalizeSpacingDefinitions({ gutter: '16px', 'space-tight': '2px' }) };
  assert.deepEqual(custom, { gutter: '16px', tight: '2px' });
});
