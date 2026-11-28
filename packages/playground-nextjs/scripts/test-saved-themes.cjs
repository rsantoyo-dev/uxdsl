// The saved themes' storage (src/lib/saved-themes.js): what a browser keeps of the themes a
// visitor made, and what it gives back. ThemeContext's own tests cover when it is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const { deepMergeTheme, validateTheme } = require('uxdsl/theme');
const { baseTheme, themes } = require('../themes');
const { themeDiff, themeFamilies } = require('../src/lib/theme-download.js');
const { DIALS, TOP, dialPatch, LOOKS, lookPatch } = require('../src/lib/quick-looks.js');
const { FONT_PRESETS, fontPresetPatch } = require('../src/lib/typography-editing.js');
const saved = require('../src/lib/saved-themes.js');

const record = (id, name, at, override = {}) => ({ id, name, origin: 'default', override, now: at });
const fill = (count) => {
  let store = saved.emptyStore();
  for (let n = 1; n <= count; n += 1) store = saved.saveTheme(store, record(`theme-${n}`, `My theme ${n}`, n));
  return store;
};

function memoryStorage() {
  const items = new Map();
  return { getItem: (key) => (items.has(key) ? items.get(key) : null), setItem: (key, value) => { items.set(key, String(value)); } };
}

test('a new theme gets the first free name and id', () => {
  assert.equal(saved.nextName([]), 'My theme 1');
  assert.equal(saved.nextId([]), 'theme-1');
  const { themes: list } = fill(3);
  assert.equal(saved.nextName(list), 'My theme 4');
  assert.equal(saved.nextId(list), 'theme-4');
  // A removed one frees its name, never its id: an id is not reused while a higher one lives.
  const without = saved.removeTheme(fill(3), 'theme-2').themes;
  assert.equal(saved.nextName(without), 'My theme 2');
  assert.equal(saved.nextId(without), 'theme-4');
  for (const name of ['Custom Theme', '', '  ', undefined, null]) assert.equal(saved.isGenericName(name), true, String(name));
  assert.equal(saved.isGenericName('Ocean night'), false);
});

test('saving updates a theme where it stands and makes it the one on the page', () => {
  let store = fill(3);
  assert.equal(store.active, 'theme-3');
  store = saved.saveTheme(store, { ...record('theme-1', 'My theme 1', 10, { spacing: { 4: '1rem' } }), origin: 'green' });
  assert.deepEqual(store.themes.map((theme) => theme.id), ['theme-1', 'theme-2', 'theme-3']);
  assert.deepEqual(store.themes[0], { id: 'theme-1', name: 'My theme 1', origin: 'green', override: { spacing: { 4: '1rem' } }, updatedAt: 10 });
  assert.equal(store.active, 'theme-1');
  assert.equal(saved.latestTheme(store.themes).id, 'theme-1');
  assert.equal(saved.latestTheme([]), null);
  // A record that is not one changes nothing.
  assert.equal(saved.saveTheme(store, { id: '', name: 'x', override: {}, now: 1 }), store);
  assert.equal(saved.saveTheme(store, { id: 'theme-9', name: 'x', override: 'no', now: 1 }), store);
});

test('past the limit, the theme edited longest ago makes room, never the one being saved', () => {
  let store = fill(saved.LIMIT);
  store = saved.saveTheme(store, record('theme-1', 'My theme 1', 100)); // theme-2 is now the oldest
  store = saved.saveTheme(store, record('theme-7', 'My theme 7', 101));
  assert.equal(store.themes.length, saved.LIMIT);
  assert.ok(!store.themes.some((theme) => theme.id === 'theme-2'));
  assert.ok(store.themes.some((theme) => theme.id === 'theme-1') && store.themes.some((theme) => theme.id === 'theme-7'));
  // Even when the one being saved carries the oldest date.
  store = saved.saveTheme(store, record('theme-8', 'My theme 8', -5));
  assert.ok(store.themes.some((theme) => theme.id === 'theme-8'));
  assert.equal(store.themes.length, saved.LIMIT);
});

test('removing and leaving', () => {
  const store = fill(2);
  assert.equal(saved.setActive(store, 'theme-2'), store, 'nothing to write when nothing changed');
  assert.equal(saved.setActive(store, null).active, null);
  assert.equal(saved.setActive(store, 'theme-9').active, null, 'a theme that is not saved cannot be the one on the page');
  assert.equal(saved.removeTheme(store, 'theme-2').active, null);
  assert.equal(saved.removeTheme(store, 'theme-1').active, 'theme-2');
  assert.deepEqual(saved.removeTheme(store, 'theme-1').themes.map((theme) => theme.id), ['theme-2']);
});

test('what was written is what is read', () => {
  const storage = memoryStorage();
  assert.deepEqual(saved.loadStore(storage), saved.emptyStore());
  const store = saved.saveTheme(fill(2), { ...record('theme-3', 'Ocean night', 9, { palette: { primary: { main: 'color(sky.700)' } } }), backgroundImage: 'waves' });
  assert.equal(saved.persistStore(storage, store), true);
  assert.deepEqual(saved.loadStore(storage), store);
  assert.equal(saved.loadStore(storage).themes[2].backgroundImage, 'waves');
});

test('a browser that refuses storage reads an empty store and reports the failed write', () => {
  const refusing = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
  assert.deepEqual(saved.loadStore(refusing), saved.emptyStore());
  assert.equal(saved.persistStore(refusing, fill(1)), false);
  assert.deepEqual(saved.loadStore(null), saved.emptyStore());
});

test('a stored text that is not a store is an empty one, and a record that is not one is left out', () => {
  for (const text of ['', 'undefined', '{', '[]', 'null', '{"version":2,"themes":[]}', '{"version":1,"themes":{}}']) {
    assert.deepEqual(saved.parseStore(text), saved.emptyStore(), text);
  }
  const good = { id: 'theme-1', name: 'Kept', origin: 'green', override: {}, updatedAt: 4 };
  const parsed = saved.parseStore(JSON.stringify({
    version: 1,
    active: 'theme-5',
    themes: [
      good,
      { ...good, name: 'Same id' },
      { id: 'theme-2', name: '', override: {} },
      { id: 'theme-3', name: 'No override' },
      { id: 'theme-4', name: 'Odd origin', origin: 'neon', override: {}, updatedAt: 'yesterday' },
      'text',
      null,
    ],
  }));
  assert.deepEqual(parsed.themes, [good, { id: 'theme-4', name: 'Odd origin', origin: 'default', override: {}, updatedAt: 0 }]);
  assert.equal(parsed.active, null, 'the one on the page has to be one that is saved');
  // No more than the limit is read, whatever was stored.
  const many = Array.from({ length: saved.LIMIT + 3 }, (_, n) => ({ ...good, id: `theme-${n + 1}` }));
  assert.equal(saved.parseStore(JSON.stringify({ version: 1, active: null, themes: many })).themes.length, saved.LIMIT);
});

test('a theme stored as its override over the base comes back as the theme that was edited', () => {
  const edits = [
    ...LOOKS.map((look) => lookPatch(look, themes.green)),
    ...DIALS.flatMap((dial) => [0, TOP].map((level) => dialPatch(dial, themes.green, level))),
    ...FONT_PRESETS.slice(0, 12).map((preset) => fontPresetPatch(themes.green.fonts, 'ui', preset)),
    { modes: { dark: { palette: { primary: { main: 'color(green.200)' } } } }, shadows: { 2: 'xs(0 2px 4px color(black, 0.2))' } },
  ];
  let checked = 0;
  for (const named of Object.values(themes)) {
    for (const patch of edits) {
      const edited = deepMergeTheme(named, patch);
      if (!validateTheme(themeFamilies(edited)).ok) continue;
      checked += 1;
      const override = themeDiff(themeFamilies(baseTheme), themeFamilies(edited));
      const stored = JSON.parse(JSON.stringify(saved.saveTheme(saved.emptyStore(), record('theme-1', 'x', 1, override)))).themes[0];
      // Opened again the way ThemeContext does it: the override over this site's base.
      assert.deepEqual(themeFamilies(deepMergeTheme(baseTheme, stored.override)), themeFamilies(edited));
    }
  }
  assert.ok(checked > edits.length, 'the edits were valid themes, on more than one named theme');
});
