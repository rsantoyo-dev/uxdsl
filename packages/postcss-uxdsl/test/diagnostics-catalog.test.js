'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DIAGNOSTIC_CODES } = require('../dist/diagnostics');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return entry.name.endsWith('.ts') && entry.name !== 'diagnostics.ts' ? [entryPath] : [];
  });
}

const COMPOSED_PREFIXES_BY_FILE = new Map([
  ['preset-engine.ts', ['UXD_PRESET', 'UXD_EDGE', 'UXD_SHADOW', 'UXD_SURFACE', 'UXD_BUTTON', 'UXD_INPUT']],
  ['surfaces.ts', ['UXD_SURFACE', 'UXD_BUTTON', 'UXD_INPUT']],
  ['naming.ts', ['UXD_FOUNDATION', 'UXD_TYPO', 'UXD_PRESET', 'UXD_EDGE', 'UXD_SHADOW', 'UXD_SURFACE', 'UXD_BUTTON', 'UXD_INPUT']],
]);

/** Scans `{ fileName, source }` entries for every UXD_* code they emit —
 * literal, family-prefix-composed, or Button-derived-from-Input — plus two
 * kinds of mistake: a composed prefix/suffix combination with no matching
 * catalog entry, and a `${...}_SUFFIX`-shaped composition in a file that
 * isn't listed in `composedPrefixesByFile` at all (so its codes were never
 * checked against the catalog in the first place). Extracted into its own
 * function, rather than inlined in the test, so a code-review-caught gap in
 * the logic (an uninventoried file's composed codes being silently ignored)
 * can have a real negative-control test that calls this same function with
 * a synthetic file, instead of only re-deriving the same condition inline.
 */
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
      if (prefixes.length === 0) {
        uninventoriedComposedMatches.push(`${fileName}: \${...}${match[1]}`);
        continue;
      }
      for (const prefix of prefixes) {
        const code = `${prefix}${match[1]}`;
        composedCodes.add(code);
        attemptedComposedCodes.push(code);
      }
    }
    if (fileName === 'control-engine.ts') {
      for (const match of source.matchAll(/\bUXD_INPUT_([A-Z0-9_]+)\b/g)) buttonCodes.add(`UXD_BUTTON_${match[1]}`);
    }
    // MIG-B6-13 code-review follow-up: `presetValueToCss`'s only composed
    // code is `${errorPrefix}_ALPHA`, and every call site passes a literal
    // string prefix (index.ts's `presetValueToCss(..., 'UXD_TOKEN', ...)`
    // is the one call that doesn't reuse a family already covered by
    // COMPOSED_PREFIXES_BY_FILE — see surfaces.ts/edges.ts/shadows.ts for
    // the rest). A per-file prefix inventory can't express "this specific
    // call site's prefix produces only the ALPHA suffix" without also
    // spuriously claiming MAP/VALUE/BP/BASE for it (those come from
    // `mergePresetTokens`/`compilePresetRules`, functions 'UXD_TOKEN' is
    // never passed to), so this call-site-specific scan stands in for that
    // narrower claim instead of widening the file-level inventory.
    for (const match of source.matchAll(/\bpresetValueToCss\([^,]+,\s*['"]([A-Z_]+)['"]/g)) composedCodes.add(`${match[1]}_ALPHA`);
  }
  return { emitted, composedCodes, attemptedComposedCodes, uninventoriedComposedMatches, buttonCodes };
}

function readRealSourceFiles() {
  const sourceDirectory = path.resolve(__dirname, '../src');
  return sourceFiles(sourceDirectory).map(filePath => ({
    fileName: path.basename(filePath),
    source: fs.readFileSync(filePath, 'utf8'),
  }));
}

test('MIG-B6-13: every literal or family-prefix UXD code is cataloged', () => {
  const { emitted, composedCodes, attemptedComposedCodes, uninventoriedComposedMatches, buttonCodes } =
    scanDiagnosticCodes(readRealSourceFiles(), COMPOSED_PREFIXES_BY_FILE);

  const unknown = [...emitted].filter(code => !DIAGNOSTIC_CODES.has(code) && ![...DIAGNOSTIC_CODES].some(known => known.startsWith(`${code}_`)));
  assert.deepEqual(unknown, []);
  assert.deepEqual([...new Set(attemptedComposedCodes.filter(code => !DIAGNOSTIC_CODES.has(code)))].sort(), [], 'Register every emitted prefix/suffix combination.');
  assert.deepEqual([...buttonCodes].filter(code => !DIAGNOSTIC_CODES.has(code)).sort(), [], 'Register Button diagnostics derived from the Input template.');
  assert.deepEqual(uninventoriedComposedMatches, [], 'A file composing ${prefix}_SUFFIX codes must be listed in COMPOSED_PREFIXES_BY_FILE.');

  // MIG-B6-13 code-review follow-up: the reverse direction. A code sitting
  // in DIAGNOSTIC_CODES that nothing in src actually produces (literally or
  // via a registered composed prefix) is stale — either a typo that was
  // "fixed" by adding to the catalog instead of the source, or a code for a
  // check that was removed without removing its catalog entry. Previously
  // nothing checked this direction at all: adding an unused code to the Set
  // stayed green forever.
  const emittedOrComposed = new Set([...emitted, ...composedCodes, ...buttonCodes]);
  const staleCatalogCodes = [...DIAGNOSTIC_CODES].filter(code => !emittedOrComposed.has(code));
  assert.deepEqual(staleCatalogCodes.sort(), [], 'Every catalog code must be emitted somewhere in src; remove a code nothing produces.');
});

// MIG-B6-13 code-review follow-up: permanent positive/negative fixtures for
// scanDiagnosticCodes itself, independent of what the real src currently
// contains — these are what a future edit that reintroduces the "silently
// ignore an uninventoried file's composed codes" bug would need to keep green.
test('MIG-B6-13: scanDiagnosticCodes flags a composed pattern in a file missing from the inventory', () => {
  const files = [{ fileName: 'not-inventoried.ts', source: 'throw new Error(`${errorPrefix}_ROGUE: not registered.`);' }];
  const { uninventoriedComposedMatches, attemptedComposedCodes } = scanDiagnosticCodes(files, COMPOSED_PREFIXES_BY_FILE);
  assert.deepEqual(uninventoriedComposedMatches, ['not-inventoried.ts: ${...}_ROGUE']);
  assert.deepEqual(attemptedComposedCodes, [], 'an uninventoried match must not also be silently treated as a checked composed code');
});

test('MIG-B6-13: scanDiagnosticCodes does not flag a composed pattern in a file that IS inventoried', () => {
  const files = [{ fileName: 'preset-engine.ts', source: 'throw new Error(`${errorPrefix}_ALPHA: bad.`);' }];
  const { uninventoriedComposedMatches, attemptedComposedCodes } = scanDiagnosticCodes(files, COMPOSED_PREFIXES_BY_FILE);
  assert.deepEqual(uninventoriedComposedMatches, []);
  assert.deepEqual(attemptedComposedCodes, ['UXD_PRESET_ALPHA', 'UXD_EDGE_ALPHA', 'UXD_SHADOW_ALPHA', 'UXD_SURFACE_ALPHA', 'UXD_BUTTON_ALPHA', 'UXD_INPUT_ALPHA']);
});

test('MIG-B6-13: scanDiagnosticCodes catches a stale catalog code (nothing emits it) via the caller\'s comparison', () => {
  const files = [{ fileName: 'index.ts', source: 'throw new Error("UXD_REAL_CODE: fine.");' }];
  const { emitted, composedCodes, buttonCodes } = scanDiagnosticCodes(files, COMPOSED_PREFIXES_BY_FILE);
  const emittedOrComposed = new Set([...emitted, ...composedCodes, ...buttonCodes]);
  const fakeCatalog = new Set(['UXD_REAL_CODE', 'UXD_NEVER_EMITTED']);
  const stale = [...fakeCatalog].filter(code => !emittedOrComposed.has(code));
  assert.deepEqual(stale, ['UXD_NEVER_EMITTED']);
});
