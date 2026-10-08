// Stability phase 2: one runtime API, one storage key.
//
// The per-token setters (`updatePalette`, `updateSpacing`, `updateBreakpoint`,
// …) and the conversion of the four keys they persisted under are gone. What
// this pins: the barrel exports exactly the theme API and nothing of the old
// surface, and `loadPersistedTheme` reads exactly one key — it never touches,
// converts or removes anything else in storage.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const runtime = require('./helpers/ds-runtime');
const { applyTheme, getAppliedTheme, loadPersistedTheme } = runtime;
const MANAGED = 'uxdsl:theme';

const REMOVED_EXPORTS = [
  // palette
  'updatePalette', 'applyPalette', 'getPalette', 'resetPalette', 'loadPersisted',
  // colors
  'updateColor', 'applyColors', 'getColor', 'resetColors', 'loadPersistedColors',
  // spacing
  'updateSpacing', 'applySpacing', 'getSpacing', 'resetSpacing', 'loadPersistedSpacing',
  // dependency graph and event bus
  'link', 'unlink', 'subscribe',
  // breakpoint rewriter
  'getBreakpoints', 'applyBreakpoints', 'updateBreakpoint', 'resetBreakpoints', 'loadPersistedBreakpoints',
  // grouped objects and the default export
  'breakpoints', 'spacing', 'colors', 'default',
  // storage migration
  'LEGACY_STORAGE_KEYS',
  // test-only hook, reachable through the internal module only
  '__resetThemeStateForTests',
];

const RUNTIME_API = [
  'applyTheme', 'getAppliedTheme', 'resetTheme', 'subscribeTheme', 'loadPersistedTheme',
  'DEFAULT_THEME_STYLE_ID', 'DEFAULT_THEME_STORAGE_KEY',
];

test('phase 2: the barrel exports the theme API and none of the removed per-token runtime', () => {
  for (const name of RUNTIME_API) assert.ok(name in runtime, `${name} must be exported`);
  for (const name of REMOVED_EXPORTS) assert.equal(name in runtime, false, `${name} must not be exported any more`);
  // The test hook still exists, but only on the internal module, never on the public entry.
  assert.equal(typeof require('../dist/ds-runtime/apply-theme').__resetThemeStateForTests, 'function');
  // DEFAULT_BREAKPOINTS stays: it is data, not the removed rewriter.
  assert.deepEqual(runtime.DEFAULT_BREAKPOINTS, { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 });
});

test('phase 2: the legacy-storage adapter is gone from the source tree', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'ds-runtime', 'legacy-storage.ts')), false);
});

function makeDocument() {
  const byId = new Map();
  return {
    createElement(tagName) {
      const attributes = {};
      return {
        tagName: tagName.toUpperCase(), id: '', textContent: '',
        setAttribute(name, value) { attributes[name] = value; },
        getAttribute(name) { return name in attributes ? attributes[name] : null; },
      };
    },
    getElementById(id) { return byId.get(id) || null; },
    head: { appendChild(node) { if (node.id) byId.set(node.id, node); return node; } },
  };
}

/** A storage that records every key it was asked about. */
function makeStorage(initial = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  const reads = [];
  const removals = [];
  return {
    getItem(key) { reads.push(key); return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { removals.push(key); data.delete(key); },
    data, reads, removals,
  };
}

function withRuntime(storage, run, { project = {} } = {}) {
  const doc = makeDocument();
  const prevDoc = globalThis.document;
  const prevStorage = globalThis.localStorage;
  globalThis.document = doc;
  globalThis.localStorage = storage;
  try {
    const init = applyTheme(project, { replace: true });
    assert.equal(init.ok, true, init.ok ? '' : `setup failed: ${init.error.message}`);
    return run(doc);
  } finally {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    if (prevStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevStorage;
  }
}

test('phase 2: loadPersistedTheme reads only the managed key; the pre-beta.6 keys are neither read, applied nor removed', () => {
  const legacy = {
    'uxdsl:palette': { 'primary-main': '#0ea5e9' },
    'uxdsl:colors': { 'gray-300': '#cccccc' },
    'uxdsl:spacing': { 4: '0.8rem' },
    'uxdsl:breakpoints': { xs: 0, md: 900 },
  };
  const storage = makeStorage(legacy);
  withRuntime(storage, () => {
    const before = getAppliedTheme();
    const result = loadPersistedTheme();
    assert.equal(result.ok, true);
    assert.deepEqual(getAppliedTheme(), before, 'nothing was applied from the old keys');
    assert.ok(result.warnings.some((w) => w.includes(`nothing stored under "${MANAGED}"`)), JSON.stringify(result.warnings));
    assert.deepEqual(storage.reads, [MANAGED], 'exactly one key is read');
    assert.deepEqual(storage.removals, [], 'nothing is removed');
    for (const key of Object.keys(legacy)) assert.ok(storage.data.has(key), `${key} is left exactly where it was`);
    assert.equal(storage.data.has(MANAGED), false, 'and nothing was written');
  });
});

test('phase 2: a stored override under the managed key is applied, validated like any patch', () => {
  const storage = makeStorage({ [MANAGED]: { palette: { primary: { main: '#111111' } } } });
  withRuntime(storage, () => {
    const result = loadPersistedTheme();
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    assert.equal(getAppliedTheme().palette.primary.main, '#111111');
  });
});

test('phase 2: `key` selects the one key read', () => {
  const storage = makeStorage({ 'my-app:theme': { spacing: { 4: '0.8rem' } }, [MANAGED]: { spacing: { 4: '9rem' } } });
  withRuntime(storage, () => {
    const result = loadPersistedTheme({ key: 'my-app:theme' });
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    assert.equal(getAppliedTheme().spacing['4'], '0.8rem');
    assert.deepEqual(storage.reads, ['my-app:theme']);
  });
});

test('phase 2: a corrupt managed key is an error and leaves the applied theme alone', () => {
  const storage = makeStorage({ [MANAGED]: '{ not json' });
  withRuntime(storage, () => {
    const before = getAppliedTheme();
    const result = loadPersistedTheme();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UXD_THEME_PERSIST');
    assert.deepEqual(getAppliedTheme(), before);
  });
});

test('phase 2: a stored override the structural gate refuses is not applied', () => {
  // Breakpoints saved by an older session that no longer match the compiled
  // build: applying them would leave component media queries pointing at the
  // old thresholds.
  const storage = makeStorage({ [MANAGED]: { breakpoints: { md: 900 } } });
  withRuntime(storage, () => {
    const before = getAppliedTheme();
    const result = loadPersistedTheme();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UXD_THEME_STRUCTURE');
    assert.deepEqual(getAppliedTheme(), before);
  });
});
