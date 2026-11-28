// The themes a visitor made, kept in the browser so they can be returned to.
//
// Every edit on this site is saved as it is made: an edit on a named theme (Default, Green,
// Slate) starts a new saved theme, and an edit on a saved theme updates it. Switching theme
// never loses one; the Live theme handler lists them and the header returns to the last.
//
// A saved theme is stored the way a project's theme file is written: as an override, the
// leaves that differ from this site's base theme. Opening it merges that override over the
// base again, and the result goes through applyTheme like any edit, so a saved theme the
// site can no longer apply (the base changed in a later build) is dropped, never applied
// half way.
//
// This module is the storage only: pure functions over a store object, and two that read
// and write it under one localStorage key. ThemeContext.tsx owns when they run. Plain JS so
// `scripts/test-saved-themes.cjs` can test it with node:test.

const STORAGE_KEY = 'uxdsl-playground:saved-themes';
const VERSION = 1;
/** How many are kept: past it, the one edited longest ago makes room. */
const LIMIT = 6;
/** The name the editors pass when they have none of their own. */
const GENERIC_NAME = 'Custom Theme';
const ORIGINS = ['default', 'green', 'purple', 'slate'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const emptyStore = () => ({ version: VERSION, active: null, themes: [] });

/** A name an editor passed for want of one: the theme gets a name of its own instead. */
const isGenericName = (name) => typeof name !== 'string' || name.trim() === '' || name === GENERIC_NAME;

/** "My theme 1", or the first number no saved theme has. */
function nextName(themes) {
  const taken = new Set(themes.map((theme) => theme.name));
  let n = 1;
  while (taken.has(`My theme ${n}`)) n += 1;
  return `My theme ${n}`;
}

/** An id no saved theme has: one past the highest. */
function nextId(themes) {
  const numbers = themes.map((theme) => Number(/^theme-(\d+)$/.exec(theme.id)?.[1] ?? 0));
  return `theme-${Math.max(0, ...numbers) + 1}`;
}

function cleanRecord(record) {
  if (!isObject(record) || typeof record.id !== 'string' || !record.id) return null;
  if (typeof record.name !== 'string' || !record.name.trim() || !isObject(record.override)) return null;
  return {
    id: record.id,
    name: record.name,
    origin: ORIGINS.includes(record.origin) ? record.origin : 'default',
    override: record.override,
    ...(typeof record.backgroundImage === 'string' && record.backgroundImage ? { backgroundImage: record.backgroundImage } : {}),
    updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : 0,
  };
}

/** The store a stored text holds. Anything that is not one (another version, a broken text) is an empty store. */
function parseStore(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return emptyStore();
  }
  if (!isObject(data) || data.version !== VERSION || !Array.isArray(data.themes)) return emptyStore();
  const themes = [];
  for (const record of data.themes.map(cleanRecord)) {
    if (record && !themes.some((theme) => theme.id === record.id) && themes.length < LIMIT) themes.push(record);
  }
  return { version: VERSION, active: themes.some((theme) => theme.id === data.active) ? data.active : null, themes };
}

/** Reads the store; a browser that refuses storage has an empty one. */
function loadStore(storage) {
  try {
    return parseStore(storage.getItem(STORAGE_KEY) ?? '');
  } catch {
    return emptyStore();
  }
}

/** Writes the store; false when the browser refused (private window, full or blocked storage). */
function persistStore(storage, store) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves a theme and makes it the one on the page: the record with this `id` is replaced
 * where it stands, a new one goes last. Past LIMIT, the one edited longest ago is dropped
 * (never the one being saved).
 */
function saveTheme(store, { id, name, origin, override, backgroundImage, now }) {
  const record = cleanRecord({ id, name, origin, override, backgroundImage, updatedAt: now });
  if (!record) return store;
  const exists = store.themes.some((theme) => theme.id === id);
  let themes = exists ? store.themes.map((theme) => (theme.id === id ? record : theme)) : [...store.themes, record];
  while (themes.length > LIMIT) {
    const oldest = themes.filter((theme) => theme.id !== id).reduce((a, b) => (b.updatedAt < a.updatedAt ? b : a));
    themes = themes.filter((theme) => theme !== oldest);
  }
  return { version: VERSION, active: id, themes };
}

function removeTheme(store, id) {
  return { version: VERSION, active: store.active === id ? null : store.active, themes: store.themes.filter((theme) => theme.id !== id) };
}

/** Which saved theme is on the page: an id, or null for a named theme. */
function setActive(store, id) {
  const active = id !== null && store.themes.some((theme) => theme.id === id) ? id : null;
  return active === store.active ? store : { ...store, active };
}

/** The one edited last. */
function latestTheme(themes) {
  return themes.length ? themes.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)) : null;
}

module.exports = {
  STORAGE_KEY, VERSION, LIMIT, GENERIC_NAME,
  emptyStore, isGenericName, nextName, nextId, parseStore, loadStore, persistStore, saveTheme, removeTheme, setActive, latestTheme,
};
