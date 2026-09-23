// MIG-B6-30 (FEAT-008): the operations of the JSON theme API.
//
// These run against a DOM stub, which is the right tool for *what the API
// does* — what it writes, what it refuses, what it leaves untouched on
// failure, what it reports. It is emphatically not evidence about computed
// styles, cascade or hydration; that is the browser fixture's job, and this
// file does not claim it.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const runtime = require('../dist/ds-runtime');
const { applyTheme, getAppliedTheme, resetTheme, subscribeTheme, generateThemeCss, DEFAULT_THEME_STYLE_ID } = runtime;

/** A document stub with only what the API touches. Each call builds a fresh
 * one, and the runtime keys its state by document, so tests never leak into
 * each other through module state. */
function makeDocument() {
  const byId = new Map();
  const appended = [];
  const doc = {
    createElement(tagName) {
      const attributes = {};
      return {
        tagName: tagName.toUpperCase(),
        id: '',
        textContent: '',
        setAttribute(name, value) { attributes[name] = value; },
        getAttribute(name) { return name in attributes ? attributes[name] : null; },
        attributes,
      };
    },
    getElementById(id) { return byId.get(id) || null; },
    head: {
      appendChild(node) {
        appended.push(node);
        if (node.id) byId.set(node.id, node);
        return node;
      },
    },
    /** Puts an element in the document without going through appendChild, the
     * way a server-rendered tag arrives. */
    seed(node) { byId.set(node.id, node); appended.push(node); return node; },
    appended,
  };
  return doc;
}

function makeStorage({ failOn = [] } = {}) {
  const data = new Map();
  return {
    getItem(key) {
      if (failOn.includes('read')) throw new Error('read blocked');
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (failOn.includes('write')) throw new Error('quota exceeded');
      data.set(key, value);
    },
    removeItem(key) {
      if (failOn.includes('remove')) throw new Error('remove blocked');
      data.delete(key);
    },
    data,
  };
}

/** Installs a document (and optionally a storage) for the duration of `run`. */
function withDocument(run, { storage } = {}) {
  const doc = makeDocument();
  const previousDocument = globalThis.document;
  const previousStorage = globalThis.localStorage;
  globalThis.document = doc;
  if (storage) globalThis.localStorage = storage;
  try {
    return run(doc);
  } finally {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage;
  }
}

const styleOf = (doc) => doc.getElementById(DEFAULT_THEME_STYLE_ID);

test('MIG-B6-30: the first call establishes the project theme and one managed style element', () => {
  withDocument((doc) => {
    const result = applyTheme({ palette: { primary: { main: '#0ea5e9' } } }, { replace: true });
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    const style = styleOf(doc);
    assert.ok(style, 'expected a managed <style>');
    assert.equal(style.tagName, 'STYLE');
    assert.equal(style.getAttribute('data-uxdsl-theme'), '');
    assert.match(style.textContent, /--uxdsl__palette__primary-main:\s*#0ea5e9/);
    assert.equal(doc.appended.length, 1, 'exactly one element was appended');
    assert.deepEqual(getAppliedTheme(), { palette: { primary: { main: '#0ea5e9' } } });
  });
});

test('MIG-B6-30: a server-rendered style tag is adopted, not duplicated', () => {
  withDocument((doc) => {
    const ssr = doc.createElement('style');
    ssr.id = 'uxdsl-ssr-theme';
    ssr.textContent = '/* rendered on the server */';
    doc.seed(ssr);
    const before = doc.appended.length;

    const result = applyTheme({}, { replace: true, styleId: 'uxdsl-ssr-theme' });
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    assert.equal(doc.appended.length, before, 'no second style element was created');
    assert.equal(doc.getElementById('uxdsl-ssr-theme'), ssr);
    assert.notEqual(ssr.textContent, '/* rendered on the server */', 'the adopted tag was rewritten');
    assert.match(ssr.textContent, /--uxdsl__/);
  });
});

test('MIG-B6-30: later patches merge, replace starts from the base, reset restores the project', () => {
  withDocument(() => {
    applyTheme({ palette: { primary: { main: '#111111' }, secondary: { main: '#222222' } } }, { replace: true });

    const merged = applyTheme({ palette: { primary: { main: '#333333' } } });
    assert.equal(merged.ok, true, merged.ok ? '' : merged.error.message);
    assert.deepEqual(getAppliedTheme(), {
      palette: { primary: { main: '#333333' }, secondary: { main: '#222222' } },
    }, 'a patch merges; it does not drop the rest of the override');

    const replaced = applyTheme({ palette: { primary: { main: '#444444' } } }, { replace: true });
    assert.equal(replaced.ok, true, replaced.ok ? '' : replaced.error.message);
    assert.deepEqual(getAppliedTheme(), { palette: { primary: { main: '#444444' } } },
      'replace starts from the base theme, so secondary is gone');

    const reset = resetTheme();
    assert.equal(reset.ok, true, reset.ok ? '' : reset.error.message);
    assert.deepEqual(getAppliedTheme(), {
      palette: { primary: { main: '#111111' }, secondary: { main: '#222222' } },
    }, 'reset restores the project override, not the packaged base');
  });
});

test('MIG-B6-30: returned state is a copy, so callers cannot mutate it', () => {
  withDocument(() => {
    const result = applyTheme({ palette: { primary: { main: '#0ea5e9' } } }, { replace: true });
    assert.equal(result.ok, true);
    result.override.palette.primary.main = '#ffffff';
    const applied = getAppliedTheme();
    applied.palette.primary.main = '#000000';
    assert.equal(getAppliedTheme().palette.primary.main, '#0ea5e9');
  });
});

test('MIG-B6-30: an invalid patch changes nothing at all', () => {
  withDocument((doc) => {
    applyTheme({ palette: { primary: { main: '#0ea5e9' } } }, { replace: true });
    const cssBefore = styleOf(doc).textContent;
    const appliedBefore = getAppliedTheme();

    // An unknown typography *field* is a hard error (`UXD_TYPO_FIELD`).
    // Note a bare number is not: the validator coerces `42` to `"42"` and
    // accepts it, so using that here would have asserted nothing.
    const result = applyTheme({ typography_details: { h1: { fontsize: '2rem' } } });
    assert.equal(result.ok, false, 'an unknown typography field must be rejected');
    assert.equal(result.error.code, 'UXD_THEME_INVALID');
    assert.equal(styleOf(doc).textContent, cssBefore, 'the stylesheet was left untouched');
    assert.deepEqual(getAppliedTheme(), appliedBefore, 'the applied override was left untouched');
  });
});

test('MIG-B6-30: a reference that does not resolve is rejected before anything is committed', () => {
  withDocument((doc) => {
    applyTheme({}, { replace: true });
    const cssBefore = styleOf(doc).textContent;
    const result = applyTheme({ surfaces: { contained: { bg: 'palette(missing.main)' } } });
    assert.equal(result.ok, false);
    assert.equal(styleOf(doc).textContent, cssBefore);
  });
});

test('MIG-B6-30: changing the styleId after initialization is an error, not a second stylesheet', () => {
  withDocument((doc) => {
    applyTheme({}, { replace: true, styleId: 'first-theme' });
    const result = applyTheme({}, { styleId: 'second-theme' });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UXD_THEME_STYLE_ID');
    assert.equal(doc.getElementById('second-theme'), null, 'no second style element was created');
  });
});

test('MIG-B6-30: an element that is not a <style> is never overwritten', () => {
  withDocument((doc) => {
    const div = doc.createElement('div');
    div.id = 'taken';
    div.textContent = 'someone else owns this';
    doc.seed(div);

    const result = applyTheme({}, { replace: true, styleId: 'taken' });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UXD_THEME_STYLE_ELEMENT');
    assert.equal(div.textContent, 'someone else owns this');
  });
});

test('MIG-B6-30: listeners are notified with a copy, unsubscribe works, and one that throws does not block the rest', () => {
  withDocument(() => {
    const seen = [];
    const unsubscribe = subscribeTheme((override) => seen.push(override));
    const afterThrower = [];
    subscribeTheme(() => { throw new Error('listener blew up'); });
    subscribeTheme((override) => afterThrower.push(override));

    applyTheme({ palette: { primary: { main: '#0ea5e9' } } }, { replace: true });
    assert.equal(seen.length, 1);
    assert.equal(afterThrower.length, 1, 'a throwing listener must not stop the ones after it');
    assert.deepEqual(seen[0], { palette: { primary: { main: '#0ea5e9' } } });

    seen[0].palette.primary.main = '#ffffff';
    assert.equal(getAppliedTheme().palette.primary.main, '#0ea5e9', 'listeners receive a copy');

    unsubscribe();
    applyTheme({ palette: { primary: { main: '#123456' } } });
    assert.equal(seen.length, 1, 'unsubscribed listener was not called again');
    assert.equal(afterThrower.length, 2);
  });
});

test('MIG-B6-30: a rejected patch notifies nobody', () => {
  withDocument(() => {
    applyTheme({}, { replace: true });
    let calls = 0;
    subscribeTheme(() => { calls++; });
    const result = applyTheme({ breakpoints: { md: 900 } });
    assert.equal(result.ok, false, 'moving a threshold is structural');
    assert.equal(calls, 0, 'no success notification for a rejected patch');
  });
});

test('MIG-B6-30: without a document, every operation reports the environment and touches nothing', () => {
  const previous = globalThis.document;
  delete globalThis.document;
  try {
    for (const [name, call] of [
      ['applyTheme', () => applyTheme({})],
      ['resetTheme', () => resetTheme()],
      ['loadPersistedTheme', () => runtime.loadPersistedTheme()],
    ]) {
      const result = call();
      assert.equal(result.ok, false, `${name} must not claim success without a document`);
      assert.equal(result.error.code, 'UXD_THEME_ENVIRONMENT', `${name}: ${result.error.message}`);
    }
    assert.deepEqual(getAppliedTheme(), {});
    assert.equal(typeof subscribeTheme(() => {}), 'function', 'subscribeTheme stays callable and returns a no-op');
  } finally {
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
});

test('MIG-B6-30: load and reset before initialization are errors, not silent no-ops', () => {
  withDocument(() => {
    const reset = resetTheme();
    assert.equal(reset.ok, false);
    assert.equal(reset.error.code, 'UXD_THEME_NOT_INITIALIZED');
    const load = runtime.loadPersistedTheme();
    assert.equal(load.ok, false);
    assert.equal(load.error.code, 'UXD_THEME_NOT_INITIALIZED');
  }, { storage: makeStorage() });
});

test('MIG-B6-30: two documents keep separate themes and separate style elements', () => {
  const first = makeDocument();
  const second = makeDocument();
  const previous = globalThis.document;
  try {
    globalThis.document = first;
    applyTheme({ palette: { primary: { main: '#111111' } } }, { replace: true });

    globalThis.document = second;
    assert.deepEqual(getAppliedTheme(), {}, 'a second document starts uninitialized');
    applyTheme({ palette: { primary: { main: '#222222' } } }, { replace: true });
    assert.equal(getAppliedTheme().palette.primary.main, '#222222');

    globalThis.document = first;
    assert.equal(getAppliedTheme().palette.primary.main, '#111111', 'the first document kept its own state');
    assert.match(styleOf(first).textContent, /#111111/);
    assert.match(styleOf(second).textContent, /#222222/);
  } finally {
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
});

test('MIG-B6-30: SSR generation stays pure — two themes in one process do not share state', () => {
  const previous = globalThis.document;
  delete globalThis.document;
  try {
    const first = generateThemeCss(runtime.resolveTheme({ palette: { primary: { main: '#111111' } } }));
    const second = generateThemeCss(runtime.resolveTheme({ palette: { primary: { main: '#222222' } } }));
    const again = generateThemeCss(runtime.resolveTheme({ palette: { primary: { main: '#111111' } } }));
    assert.match(first, /--uxdsl__palette__primary-main:\s*#111111/);
    assert.match(second, /--uxdsl__palette__primary-main:\s*#222222/);
    assert.equal(again, first, 'generating the same theme twice, around a different one, is identical');
    assert.doesNotMatch(second, /#111111/);
  } finally {
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
});

test('MIG-B6-30: persistence is per call and happens after the visual commit', () => {
  const storage = makeStorage();
  withDocument((doc) => {
    applyTheme({ palette: { primary: { main: '#111111' } } }, { replace: true, persist: true });
    assert.equal(JSON.parse(storage.data.get('uxdsl:theme')).palette.primary.main, '#111111');

    // No persist option: the stored value must not follow.
    applyTheme({ palette: { primary: { main: '#222222' } } });
    assert.equal(JSON.parse(storage.data.get('uxdsl:theme')).palette.primary.main, '#111111',
      'persisting once must not make every later call persist');
    assert.match(styleOf(doc).textContent, /#222222/, 'the visual change still happened');
  }, { storage });
});

test('MIG-B6-30: a storage failure is a warning on a real success, not a fake failure', () => {
  const storage = makeStorage({ failOn: ['write'] });
  withDocument((doc) => {
    const result = applyTheme({ palette: { primary: { main: '#0ea5e9' } } }, { replace: true, persist: true });
    assert.equal(result.ok, true, 'the theme really was applied');
    assert.match(styleOf(doc).textContent, /#0ea5e9/);
    assert.ok(result.warnings.some((w) => w.includes('UXD_THEME_PERSIST')),
      `expected an explicit not-saved warning, got ${JSON.stringify(result.warnings)}`);
  }, { storage });
});

test('MIG-B6-30: a corrupt stored theme is reported and never replaces the applied one', () => {
  const storage = makeStorage();
  withDocument((doc) => {
    applyTheme({ palette: { primary: { main: '#0ea5e9' } } }, { replace: true });
    const cssBefore = styleOf(doc).textContent;

    storage.data.set('uxdsl:theme', '{ not json');
    const corrupt = runtime.loadPersistedTheme();
    assert.equal(corrupt.ok, false);
    assert.equal(corrupt.error.code, 'UXD_THEME_PERSIST');
    assert.equal(styleOf(doc).textContent, cssBefore);

    storage.data.set('uxdsl:theme', '["not","an","override"]');
    const wrongShape = runtime.loadPersistedTheme();
    assert.equal(wrongShape.ok, false);
    assert.equal(styleOf(doc).textContent, cssBefore);
    assert.equal(getAppliedTheme().palette.primary.main, '#0ea5e9');
  }, { storage });
});

test('MIG-B6-30: a stored theme round-trips and reset can clear its key', () => {
  const storage = makeStorage();
  withDocument(() => {
    applyTheme({ palette: { primary: { main: '#111111' } } }, { replace: true });
    applyTheme({ palette: { primary: { main: '#999999' } } }, { persist: true });
    assert.equal(getAppliedTheme().palette.primary.main, '#999999');

    applyTheme({ palette: { primary: { main: '#111111' } } }, { replace: true });
    const loaded = runtime.loadPersistedTheme();
    assert.equal(loaded.ok, true, loaded.ok ? '' : loaded.error.message);
    assert.equal(getAppliedTheme().palette.primary.main, '#999999', 'the stored override was applied');

    const reset = resetTheme({ clearPersist: true });
    assert.equal(reset.ok, true, reset.ok ? '' : reset.error.message);
    assert.equal(storage.data.has('uxdsl:theme'), false, 'clearPersist removed the managed key');
    assert.equal(getAppliedTheme().palette.primary.main, '#111111');
  }, { storage });
});

test('MIG-B6-30: reset does not clear persistence unless asked', () => {
  const storage = makeStorage();
  withDocument(() => {
    applyTheme({}, { replace: true });
    applyTheme({ palette: { primary: { main: '#999999' } } }, { persist: true });
    resetTheme();
    assert.equal(storage.data.has('uxdsl:theme'), true, 'reset alone leaves the stored theme alone');
  }, { storage });
});
