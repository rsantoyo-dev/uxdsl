// MIG-B6-30 (FEAT-008), phase 2: the four pre-beta.6 storage keys.
//
// A user who customized a shipped app has their work in `uxdsl:palette`,
// `uxdsl:colors`, `uxdsl:spacing` and `uxdsl:breakpoints`. Migration has one
// hard requirement that every test here circles: it must never be possible for
// a failure to leave the user with neither the old copy nor the new one.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const runtime = require('../dist/ds-runtime');
const { applyTheme, getAppliedTheme, loadPersistedTheme } = runtime;
const LEGACY = {
  palette: 'uxdsl:palette',
  colors: 'uxdsl:colors',
  spacing: 'uxdsl:spacing',
  breakpoints: 'uxdsl:breakpoints',
};
const MANAGED = 'uxdsl:theme';

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

/** A storage that can be told to fail a specific operation, optionally only
 * for one key, and that can silently drop writes the way a full or
 * private-mode store does. */
function makeStorage(initial = {}, behaviour = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  const { failRead = [], failWrite = [], failRemove = [], dropWrites = [] } = behaviour;
  const hits = (list, key) => list.includes(key) || list.includes('*');
  return {
    getItem(key) {
      if (hits(failRead, key)) throw new Error(`read blocked: ${key}`);
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (hits(failWrite, key)) throw new Error(`write blocked: ${key}`);
      if (hits(dropWrites, key)) return; // accepted, silently not kept
      data.set(key, value);
    },
    removeItem(key) {
      if (hits(failRemove, key)) throw new Error(`remove blocked: ${key}`);
      data.delete(key);
    },
    data,
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

test('MIG-B6-30: the four legacy keys convert into one override and are then cleared', () => {
  const storage = makeStorage({
    [LEGACY.palette]: { 'primary-main': '#0ea5e9', 'surface-contrast': '#101010' },
    [LEGACY.colors]: { 'gray-300': '#cccccc', white: '#fefefe' },
    [LEGACY.spacing]: { 4: '0.8rem' },
    [LEGACY.breakpoints]: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 },
  });
  withRuntime(storage, () => {
    const result = loadPersistedTheme();
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);

    const applied = getAppliedTheme();
    assert.equal(applied.palette.primary.main, '#0ea5e9');
    assert.equal(applied.palette.surface.contrast, '#101010');
    assert.equal(applied.colors.gray['300'], '#cccccc');
    assert.equal(applied.colors.white, '#fefefe', 'a standalone color has no family to split');
    assert.equal(applied.spacing['4'], '0.8rem');
    assert.equal(applied.breakpoints.md, 768);

    assert.ok(storage.data.has(MANAGED), 'the converted override was written to the managed key');
    for (const key of Object.values(LEGACY)) {
      assert.equal(storage.data.has(key), false, `${key} should be gone once the new key is verified`);
    }
  });
});

test('MIG-B6-30: a valid managed key wins outright and legacy keys are not mixed in', () => {
  const storage = makeStorage({
    [MANAGED]: { palette: { primary: { main: '#111111' } } },
    [LEGACY.palette]: { 'secondary-main': '#999999' },
  });
  withRuntime(storage, () => {
    const result = loadPersistedTheme();
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    const applied = getAppliedTheme();
    assert.equal(applied.palette.primary.main, '#111111');
    assert.equal(applied.palette.secondary, undefined, 'the legacy key must not be merged in');
    assert.ok(storage.data.has(LEGACY.palette), 'nor consumed');
  });
});

test('MIG-B6-30: a corrupt managed key is an error, never a silent fall back to the legacy keys', () => {
  const storage = makeStorage({
    [MANAGED]: '{ not json',
    [LEGACY.palette]: { 'primary-main': '#0ea5e9' },
  });
  withRuntime(storage, () => {
    const before = getAppliedTheme();
    const result = loadPersistedTheme();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UXD_THEME_PERSIST');
    assert.deepEqual(getAppliedTheme(), before, 'the applied theme was not replaced by something else');
    assert.ok(storage.data.has(LEGACY.palette), 'the legacy key was not consumed behind the corrupt one');
  });
});

test('MIG-B6-30: family names containing hyphens are split by the theme, not by the last hyphen', () => {
  // `primary-dark-hover` is `primary` + `dark-hover`; `brand-accent-main` is
  // `brand-accent` + `main`. The string alone cannot tell them apart, so the
  // theme's own family names decide, longest match first.
  const storage = makeStorage({
    [LEGACY.palette]: {
      'primary-dark-hover': '#020617',
      'brand-accent-main': '#ff00ff',
      'brand-main': '#00ff00',
    },
  });
  withRuntime(storage, () => {
    const result = loadPersistedTheme();
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    const palette = getAppliedTheme().palette;
    assert.equal(palette.primary['dark-hover'], '#020617');
    assert.equal(palette['brand-accent'].main, '#ff00ff', 'the longer family wins');
    assert.equal(palette.brand.main, '#00ff00');
  }, {
    project: { palette: {
      brand: { main: '#000000', dark: '#111111', contrast: '#ffffff' },
      'brand-accent': { main: '#222222', dark: '#333333', contrast: '#ffffff' },
    } },
  });
});

test('MIG-B6-30: a token whose family cannot be identified is reported, not guessed', () => {
  const storage = makeStorage({
    [LEGACY.palette]: { 'primary-main': '#0ea5e9', 'unknownfamily-main': '#123456' },
  });
  withRuntime(storage, () => {
    const result = loadPersistedTheme();
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    assert.equal(getAppliedTheme().palette.primary.main, '#0ea5e9', 'the recognizable one still migrated');
    assert.equal(getAppliedTheme().palette.unknownfamily, undefined, 'no family was invented');
    assert.ok(result.warnings.some((w) => w.includes('unknownfamily-main')),
      `the skipped token must be reported: ${JSON.stringify(result.warnings)}`);
  });
});

test('MIG-B6-30: corrupt legacy JSON is skipped with a diagnostic and left in place', () => {
  const storage = makeStorage({
    [LEGACY.palette]: '{ broken',
    [LEGACY.spacing]: { 4: '0.8rem' },
  });
  withRuntime(storage, () => {
    const result = loadPersistedTheme();
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    assert.equal(getAppliedTheme().spacing['4'], '0.8rem', 'the readable key still migrated');
    assert.ok(result.warnings.some((w) => w.includes(LEGACY.palette)));
    assert.equal(storage.data.get(LEGACY.palette), '{ broken', 'the unreadable key was left exactly as it was');
  });
});

test('MIG-B6-30: a write that is silently dropped never costs the user the legacy copy', () => {
  const storage = makeStorage(
    { [LEGACY.palette]: { 'primary-main': '#0ea5e9' } },
    { dropWrites: [MANAGED] });
  withRuntime(storage, () => {
    const result = loadPersistedTheme();
    assert.equal(result.ok, true, 'the values were applied, which really happened');
    assert.equal(getAppliedTheme().palette.primary.main, '#0ea5e9');
    assert.ok(storage.data.has(LEGACY.palette),
      'the legacy key must survive: the new key did not keep the value');
    assert.ok(result.warnings.some((w) => w.includes('did not keep')),
      `expected an explicit warning, got ${JSON.stringify(result.warnings)}`);
  });
});

test('MIG-B6-30: a storage that refuses the write keeps the legacy keys and says so', () => {
  const storage = makeStorage(
    { [LEGACY.palette]: { 'primary-main': '#0ea5e9' } },
    { failWrite: [MANAGED] });
  withRuntime(storage, () => {
    const result = loadPersistedTheme();
    assert.equal(result.ok, true);
    assert.ok(storage.data.has(LEGACY.palette));
    assert.ok(result.warnings.some((w) => w.includes('could not be saved')),
      `expected a not-saved warning, got ${JSON.stringify(result.warnings)}`);
  });
});

test('MIG-B6-30: a legacy key that cannot be removed is reported but does not fail the migration', () => {
  const storage = makeStorage(
    { [LEGACY.spacing]: { 4: '0.8rem' } },
    { failRemove: [LEGACY.spacing] });
  withRuntime(storage, () => {
    const result = loadPersistedTheme();
    assert.equal(result.ok, true);
    assert.equal(getAppliedTheme().spacing['4'], '0.8rem');
    assert.ok(storage.data.has(MANAGED), 'the managed key was written');
    assert.ok(result.warnings.some((w) => w.includes('could not be removed')));
  });
});

test('MIG-B6-30: a legacy key that cannot be read is skipped, not fatal', () => {
  const storage = makeStorage(
    { [LEGACY.palette]: { 'primary-main': '#0ea5e9' }, [LEGACY.spacing]: { 4: '0.8rem' } },
    { failRead: [LEGACY.palette] });
  withRuntime(storage, () => {
    const result = loadPersistedTheme();
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    assert.equal(getAppliedTheme().spacing['4'], '0.8rem');
    assert.ok(result.warnings.some((w) => w.includes(LEGACY.palette)));
  });
});

test('MIG-B6-30: migrating twice is idempotent', () => {
  const storage = makeStorage({
    [LEGACY.palette]: { 'primary-main': '#0ea5e9' },
    [LEGACY.spacing]: { 4: '0.8rem' },
  });
  withRuntime(storage, () => {
    const first = loadPersistedTheme();
    assert.equal(first.ok, true, first.ok ? '' : first.error.message);
    const afterFirst = getAppliedTheme();

    const second = loadPersistedTheme();
    assert.equal(second.ok, true, second.ok ? '' : second.error.message);
    assert.deepEqual(getAppliedTheme(), afterFirst, 'the second load changed nothing');

    const third = loadPersistedTheme();
    assert.equal(third.ok, true);
    assert.deepEqual(getAppliedTheme(), afterFirst);
  });
});

test('MIG-B6-30: a converted theme the structural gate refuses leaves every legacy key intact', () => {
  // Breakpoints saved by an older session that no longer match the compiled
  // build: applying them would leave component media queries pointing at the
  // old thresholds, so the migration must refuse and change nothing.
  const storage = makeStorage({
    [LEGACY.breakpoints]: { xs: 0, sm: 480, md: 900, lg: 1024, xl: 1280 },
  });
  withRuntime(storage, () => {
    const before = getAppliedTheme();
    const result = loadPersistedTheme();
    assert.equal(result.ok, false, 'a structural change must not be applied silently');
    assert.equal(result.error.code, 'UXD_THEME_PERSIST');
    assert.match(result.error.message, /UXD_THEME_STRUCTURE/, 'the underlying reason is reported');
    assert.deepEqual(getAppliedTheme(), before, 'nothing was applied');
    assert.ok(storage.data.has(LEGACY.breakpoints), 'and nothing was deleted');
    assert.equal(storage.data.has(MANAGED), false, 'nor written');
  });
});

test('MIG-B6-30: migration can be turned off', () => {
  const storage = makeStorage({ [LEGACY.palette]: { 'primary-main': '#0ea5e9' } });
  withRuntime(storage, () => {
    const result = loadPersistedTheme({ migrateLegacy: false });
    assert.equal(result.ok, true);
    assert.equal(getAppliedTheme().palette, undefined, 'nothing was migrated');
    assert.ok(storage.data.has(LEGACY.palette), 'and nothing was consumed');
  });
});
