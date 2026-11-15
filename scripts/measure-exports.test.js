'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { measureExports } = require('./measure-exports');

const REPO = path.resolve(__dirname, '..');

/** A repository-shaped tree with one entry and a consumer in each kind of root. */
function fixture(t, extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-measure-exports-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = {
    'packages/uxdsl/src/lib.ts': [
      'export function used() { return 1; }',
      'export function unusedFn() { return 2; }',
      'export function internalOnly() { return 3; }',
      'export function spreadUsed() { return 4; }',
      'export function shimKept() { return 5; }',
      'export function mdxUsed() { return 6; }',
      'export type UnusedType = { a: string };',
      '',
    ].join('\n'),
    'packages/uxdsl/src/entries/engine.ts':
      "export { used, unusedFn, internalOnly, spreadUsed, shimKept, mdxUsed } from '../lib';\nexport type { UnusedType } from '../lib';\n",
    'packages/uxdsl/src/other.ts': "import { internalOnly } from './lib';\nexport const value = internalOnly();\n",
    // The consumer names unusedFn only in a comment and a string: neither counts.
    'packages/playground-nextjs/src/page.tsx':
      "import { used } from 'uxdsl/engine';\n// unusedFn is not called here\nexport const label = 'unusedFn';\nexport default function Page() { return used(); }\n",
    'packages/playground-nextjs/src/app/doc/page.mdx':
      "import { mdxUsed } from 'uxdsl/engine'\n\n# A page\n\nThe prose mentions unusedFn and `import { unusedFn } from 'uxdsl/engine'` in code.\n",
    'packages/uxdsl/bin/uxdsl.js': "const rt = {\n  ...require('../dist/entries/engine'),\n};\nrt.spreadUsed();\n",
    'packages/_deprecated/shims.test.js': "const FORMER = {\n  'postcss-uxdsl/ds-runtime': ['shimKept', 'gone'],\n};\nconst DROPPED = {};\n",
    'packages/_deprecated/postcss-uxdsl/ds-runtime.js': "module.exports = { ...require('uxdsl/engine') };\n",
    'packages/uxdsl/test/lib.test.js': "const { unusedFn } = require('../dist/entries/engine');\nunusedFn();\n",
    ...extra,
  };
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

const engineOf = (root) => measureExports({ root, entries: { 'uxdsl/engine': 'engine' } })['uxdsl/engine'];
const row = (report, name) => report.rows.find((candidate) => candidate.name === name);

test('MIG-B9-21: measure-exports lists the engine\'s exports and finds a planted consumer', (t) => {
  const report = engineOf(fixture(t));
  assert.deepEqual(report.rows.map(({ name, kind }) => `${name}:${kind}`), [
    'internalOnly:value', 'mdxUsed:value', 'shimKept:value', 'spreadUsed:value', 'unusedFn:value', 'UnusedType:type', 'used:value',
  ]);
  // Neither the comment, the string, the mdx prose nor the test file counts.
  assert.deepEqual(report.zero, ['unusedFn', 'UnusedType']);
  assert.deepEqual(row(report, 'unusedFn').tests, ['packages/uxdsl/test/lib.test.js']);
  assert.deepEqual(row(report, 'used').outside, ['packages/playground-nextjs/src/page.tsx']);
  assert.deepEqual(row(report, 'mdxUsed').outside, ['packages/playground-nextjs/src/app/doc/page.mdx']);
  assert.deepEqual(row(report, 'spreadUsed').outside, ['packages/uxdsl/bin/uxdsl.js']);
  assert.deepEqual(row(report, 'shimKept').outside, ['packages/_deprecated/postcss-uxdsl/ds-runtime.js']);
  // An import by another src module keeps an export; the defining file does not.
  assert.deepEqual(row(report, 'internalOnly').outside, []);
  assert.deepEqual(row(report, 'internalOnly').src, ['other.ts']);
  assert.equal(row(report, 'internalOnly').definedIn, 'lib.ts');

  // Negative control: a real import moves the planted export out of the zero list.
  const planted = engineOf(fixture(t, { 'scripts/use.js': "import { unusedFn } from 'uxdsl/engine';\nunusedFn();\n" }));
  assert.deepEqual(planted.zero, ['UnusedType']);
  assert.deepEqual(row(planted, 'unusedFn').outside, ['scripts/use.js']);
});

test('MIG-B9-21: measure-exports on the repository agrees with the built engine and counts the gate and the shims', () => {
  const report = measureExports();
  assert.deepEqual(Object.keys(report), ['uxdsl/engine', 'uxdsl/language', 'uxdsl/theme', 'uxdsl/runtime', 'uxdsl', 'uxdsl/config']);
  const engine = report['uxdsl/engine'];
  const values = engine.rows.filter((candidate) => candidate.kind === 'value').map((candidate) => candidate.name).sort();
  assert.deepEqual(values, Object.keys(require(path.join(REPO, 'packages/uxdsl/dist/entries/engine'))).sort());
  // The gate reaches checkThemeContrast through uxdsl/theme.
  assert.ok(row(report['uxdsl/theme'], 'checkThemeContrast').outside.some((file) => file.startsWith('fixtures/release-1.0/')));
  assert.ok(row(engine, 'contrastRatio').outside.includes('packages/_deprecated/postcss-uxdsl/ds-runtime.js'));
  assert.ok(row(engine, 'resolveTheme').outside.includes('packages/uxdsl/bin/uxdsl.js'));
});
