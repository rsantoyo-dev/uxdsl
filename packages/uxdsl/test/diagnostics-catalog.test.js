'use strict';

// The diagnostics catalog is exact in both directions: every UXD_* code the
// sources can produce is in it (with a meaning and a fix), every entry is
// produced somewhere, and every entry is asserted by a test — in this package
// for the compiler, theme and runtime codes, in uxdsl-core for the SCSS-subset
// codes. Codes composed from a family prefix (`${prefix}_VALUE`) are expanded
// per the inventory below so none of them bypasses the check.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DIAGNOSTIC_CATALOG, DIAGNOSTIC_CODES, diagnostic } = require('../dist/diagnostics');

const PACKAGE = path.resolve(__dirname, '..');
const CORE = path.resolve(__dirname, '..');

function filesUnder(directory, keep) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === 'fixtures' ? [] : filesUnder(entryPath, keep);
    return keep(entry.name) ? [entryPath] : [];
  });
}

/** Files composing `${prefix}_SUFFIX` codes, and the prefixes they compose with. */
const COMPOSED_PREFIXES_BY_FILE = new Map([
  ['preset-engine.ts', ['UXD_EDGE', 'UXD_SHADOW', 'UXD_SURFACE', 'UXD_BUTTON', 'UXD_INPUT']],
  ['surfaces.ts', ['UXD_SURFACE', 'UXD_BUTTON', 'UXD_INPUT']],
  ['naming.ts', ['UXD_FOUNDATION', 'UXD_EDGE', 'UXD_SHADOW', 'UXD_SURFACE', 'UXD_BUTTON', 'UXD_INPUT']],
  ['language.ts', ['UXD_SPACE', 'UXD_DENSITY', 'UXD_COLOR', 'UXD_PALETTE', 'UXD_EDGE', 'UXD_SHADOW']],
  ['directives.ts', ['UXD_SURFACE', 'UXD_BUTTON', 'UXD_INPUT', 'UXD_TYPO']],
]);

/** Every UXD_* code a set of `{ fileName, source }` entries can produce: literal, composed, or Button-derived-from-Input. */
function scanDiagnosticCodes(files, composedPrefixesByFile) {
  const emitted = new Set();
  const composedCodes = new Set();
  const attemptedComposedCodes = [];
  const uninventoriedComposedMatches = [];
  const buttonCodes = new Set();
  for (const { fileName, source: rawSource } of files) {
    const source = rawSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    for (const match of source.matchAll(/\bUXD_[A-Z0-9_]*[A-Z0-9]\b/g)) emitted.add(match[0]);
    const prefixes = composedPrefixesByFile.get(fileName) || [];
    for (const match of source.matchAll(/\$\{[^}]+\}(_[A-Z][A-Z0-9_]*)/g)) {
      if (prefixes.length === 0) { uninventoriedComposedMatches.push(`${fileName}: \${...}${match[1]}`); continue; }
      for (const prefix of prefixes) { const code = `${prefix}${match[1]}`; composedCodes.add(code); attemptedComposedCodes.push(code); }
    }
    if (fileName === 'control-engine.ts') {
      for (const match of source.matchAll(/\bUXD_INPUT_([A-Z0-9_]+)\b/g)) buttonCodes.add(`UXD_BUTTON_${match[1]}`);
    }
  }
  return { emitted, composedCodes, attemptedComposedCodes, uninventoriedComposedMatches, buttonCodes };
}

function readSources(directory) {
  return filesUnder(directory, (name) => name.endsWith('.ts') && name !== 'diagnostics.ts').map((filePath) => ({ fileName: path.basename(filePath), source: fs.readFileSync(filePath, 'utf8') }));
}

test('every code the sources can produce is cataloged, with a meaning and a fix', () => {
  const sources = [...readSources(path.join(PACKAGE, 'src')), ...readSources(path.join(CORE, 'src'))];
  const { emitted, attemptedComposedCodes, uninventoriedComposedMatches, buttonCodes } = scanDiagnosticCodes(sources, COMPOSED_PREFIXES_BY_FILE);
  // A prefix alone (`UXD_SURFACE` in `${prefix}_FIELD`) is not a code; only a name the catalog has or extends counts.
  const unknown = [...emitted].filter((code) => !DIAGNOSTIC_CODES.has(code) && ![...DIAGNOSTIC_CODES].some((known) => known.startsWith(`${code}_`)));
  assert.deepEqual(unknown, []);
  assert.deepEqual([...new Set(attemptedComposedCodes.filter((code) => !DIAGNOSTIC_CODES.has(code)))].sort(), [], 'Register every emitted prefix/suffix combination.');
  assert.deepEqual([...buttonCodes].filter((code) => !DIAGNOSTIC_CODES.has(code)).sort(), [], 'Register Button diagnostics derived from the Input template.');
  assert.deepEqual(uninventoriedComposedMatches, [], 'A file composing ${prefix}_SUFFIX codes must be listed in COMPOSED_PREFIXES_BY_FILE.');
  for (const [code, entry] of Object.entries(DIAGNOSTIC_CATALOG)) {
    assert.match(code, /^UXD_[A-Z0-9_]+$/);
    assert.ok(entry.meaning.trim().length > 20 && !entry.meaning.includes('\n'), `${code}: one line of meaning`);
    assert.ok(entry.fix.trim().length > 10 && !entry.fix.includes('\n'), `${code}: one line of fix`);
    assert.ok(['compiler', 'theme', 'runtime', 'core'].includes(entry.owner), `${code}: owner`);
  }
  assert.ok(Object.isFrozen(DIAGNOSTIC_CATALOG));
});

test('every catalog entry is produced somewhere in the sources', () => {
  const sources = [...readSources(path.join(PACKAGE, 'src')), ...readSources(path.join(CORE, 'src'))];
  const { emitted, composedCodes, buttonCodes } = scanDiagnosticCodes(sources, COMPOSED_PREFIXES_BY_FILE);
  const producible = new Set([...emitted, ...composedCodes, ...buttonCodes]);
  const stale = [...DIAGNOSTIC_CODES].filter((code) => !producible.has(code));
  assert.deepEqual(stale.sort(), [], 'Remove a catalog entry nothing produces.');
});

test('every catalog entry is asserted by a test', () => {
  const tests = [...filesUnder(path.join(PACKAGE, 'test'), (name) => name.endsWith('.test.js')), ...filesUnder(path.join(CORE, 'test'), (name) => name.endsWith('.test.js'))]
    .filter((file) => path.basename(file) !== 'diagnostics-catalog.test.js')
    .map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const untested = [...DIAGNOSTIC_CODES].filter((code) => !new RegExp(`\\b${code}\\b`).test(tests));
  assert.deepEqual(untested.sort(), [], 'Every code needs a test that provokes it (or, for a runtime code, receives it).');
});

test('diagnostic() refuses a code the catalog does not list', () => {
  assert.throws(() => diagnostic('UXD_NOT_A_CODE: nothing'), /not in DIAGNOSTIC_CATALOG/);
  assert.equal(diagnostic('UXD_TOKEN_KEY: fine').message, 'UXD_TOKEN_KEY: fine');
  assert.equal(diagnostic('no code at all').message, 'no code at all');
});

test('the catalog is exported from the plugin entry and the runtime entry, and they are the same object', () => {
  const plugin = require('../dist/plugin');
  const runtime = require('./helpers/ds-runtime');
  assert.strictEqual(plugin.DIAGNOSTIC_CATALOG, DIAGNOSTIC_CATALOG);
  assert.strictEqual(runtime.DIAGNOSTIC_CATALOG, DIAGNOSTIC_CATALOG);
  assert.strictEqual(runtime.DIAGNOSTIC_CODES, DIAGNOSTIC_CODES);
});

// Permanent fixtures for the scanner itself, independent of what the real sources contain.
test('scanDiagnosticCodes flags a composed pattern in a file missing from the inventory', () => {
  const files = [{ fileName: 'not-inventoried.ts', source: 'throw new Error(`${errorPrefix}_ROGUE: not registered.`);' }];
  const { uninventoriedComposedMatches, attemptedComposedCodes } = scanDiagnosticCodes(files, COMPOSED_PREFIXES_BY_FILE);
  assert.deepEqual(uninventoriedComposedMatches, ['not-inventoried.ts: ${...}_ROGUE']);
  assert.deepEqual(attemptedComposedCodes, []);
});

test('scanDiagnosticCodes expands a composed pattern in an inventoried file', () => {
  const files = [{ fileName: 'preset-engine.ts', source: 'throw new Error(`${errorPrefix}_VALUE: bad.`);' }];
  const { attemptedComposedCodes } = scanDiagnosticCodes(files, COMPOSED_PREFIXES_BY_FILE);
  assert.deepEqual(attemptedComposedCodes, ['UXD_EDGE_VALUE', 'UXD_SHADOW_VALUE', 'UXD_SURFACE_VALUE', 'UXD_BUTTON_VALUE', 'UXD_INPUT_VALUE']);
});
