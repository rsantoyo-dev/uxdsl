const { test } = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../scripts/codemod-namespace');
test('editor metadata offers independent overrides on every container/control directive', () => {
  const { LANGUAGE_COMPLETIONS } = require('../dist/language');
  for (const name of ['ds-surface', 'ds-button', 'ds-input']) assert.deepEqual(LANGUAGE_COMPLETIONS.directiveArguments[name], ['radius', 'shadow']);
});
test('namespace migration preserves references, definitions, fallbacks and idempotence', () => {
  const source = '.x { --space-1: 4px; padding: var(--space-1, 2px); color: var(--ds__palette__primary-main); --external: red; }';
  const { output } = migrate(source);
  assert.match(output, /--uxdsl__space__1: 4px/);
  assert.match(output, /var\(--uxdsl__space__1, 2px\)/);
  assert.match(output, /var\(--uxdsl__palette__primary-main\)/);
  assert.match(output, /--external: red/);
  assert.equal(migrate(output).output, output);
});
test('JSON references and externalTokens migrate without changing logical keys', () => {
  const source = JSON.stringify({ spacing: { 1: '4px' }, typography_details: { h1: { fontFamily: 'var(--font-ui)' } }, externalTokens: ['--border-1', '--host'] });
  const result = JSON.parse(migrate(source).output);
  assert.deepEqual(result.spacing, { 1: '4px' });
  assert.equal(result.typography_details.h1.fontFamily, 'var(--uxdsl__font__ui)');
  assert.deepEqual(result.externalTokens, ['--uxdsl__border__1', '--host']);
});
test('custom roles and conflicting host names require explicit mappings', () => {
  const source = '.x { color: var(--host-size); padding: var(--space-owned-by-host); font-size: var(--custom-title-size); }';
  const { output } = migrate(source, { '--space-owned-by-host': '--space-owned-by-host', '--custom-title-size': '--uxdsl__typography__custom-title-size' });
  assert.match(output, /var\(--host-size\)/);
  assert.match(output, /var\(--space-owned-by-host\)/);
  assert.match(output, /var\(--uxdsl__typography__custom-title-size\)/);
});
