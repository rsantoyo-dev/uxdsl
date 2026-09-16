const { test } = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../scripts/codemod-namespace');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
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

test('MIG-B2-04: migrates spacing 4–10 and Typography, preserving host fonts, logical keys and helpers', () => {
  const source = JSON.stringify({ spacing: { 'space-4': '12px' }, typography: { 'h1-size': '2rem', '--h2-size': '3rem' }, typography_details: { h1: { fontSize: 'var(--h1-size)', fontFamily: 'var(--font-ui, var(--font-geist-sans))' } }, references: { externalTokens: ['--font-geist-sans', '--font-geist-mono'] }, values: Array.from({ length: 7 }, (_, i) => `var(--space-${i + 4})`), helper: 'space(7)' });
  const result = JSON.parse(migrate(source).output);
  assert.deepEqual(result.spacing, { 'space-4': '12px' });
  assert.deepEqual(result.typography, { 'h1-size': '2rem', '--h2-size': '3rem' });
  assert.deepEqual(result.references.externalTokens, ['--font-geist-sans', '--font-geist-mono']);
  assert.equal(result.typography_details.h1.fontFamily, 'var(--uxdsl__font__ui, var(--font-geist-sans))');
  assert.equal(result.typography_details.h1.fontSize, 'var(--uxdsl__typography__h1-size)');
  assert.deepEqual(result.values, Array.from({ length: 7 }, (_, i) => `var(--uxdsl__space__${i + 4})`));
  assert.equal(result.helper, 'space(7)');
});

test('MIG-B2-04: real CLI preview, write, identity mapping and second write are safe and idempotent', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-migration-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'input.css'), map = path.join(dir, 'map.json');
  const original = '.x { padding: var(--space-4); font: var(--font-geist-sans); color: var(--space-host); }';
  fs.writeFileSync(file, original);
  fs.writeFileSync(map, JSON.stringify({ '--space-host': '--space-host' }));
  const run = (...args) => execFileSync(process.execPath, [path.resolve(__dirname, '../scripts/codemod-namespace.js'), '--map', map, ...args, file], { encoding: 'utf8' });
  assert.match(run(), /preview/);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  run('--write');
  const migrated = fs.readFileSync(file, 'utf8');
  assert.match(migrated, /--uxdsl__space__4/);
  assert.match(migrated, /--font-geist-sans/);
  assert.match(migrated, /--space-host/);
  assert.match(run('--write'), /0 replacements/);
  assert.equal(fs.readFileSync(file, 'utf8'), migrated);
});
