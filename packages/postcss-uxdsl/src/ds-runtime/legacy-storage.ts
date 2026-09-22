// MIG-B6-30 (FEAT-008), phase 2: reading what the old setters persisted.
//
// Before the JSON theme API there were four independent keys —
// `uxdsl:palette`, `uxdsl:colors`, `uxdsl:spacing`, `uxdsl:breakpoints` — each
// a flat map of *normalized variable key* to value, written by `updatePalette`
// and friends. A user who customized a theme in a shipped app has their work
// in those keys; this converts it into one theme override.
//
// The hard part is undoing the normalization. `normalizeTokenKey('palette', …)`
// turns `primary.main` into `primary-main` and `brand-accent.main` into
// `brand-accent-main`, so the hyphen that separates family from variant is
// indistinguishable from a hyphen *inside* either name: `primary-dark-hover`
// is `primary` + `dark-hover`, not `primary-dark` + `hover`, and nothing in the
// string says which. Splitting on the last hyphen would quietly invent a
// family. Instead the split is resolved against the family names the effective
// theme actually declares, longest first, and an entry that matches none of
// them is reported and skipped rather than guessed at.
import { cloneThemeValue } from './theme-validate';

export const LEGACY_STORAGE_KEYS = Object.freeze({
  palette: 'uxdsl:palette',
  colors: 'uxdsl:colors',
  spacing: 'uxdsl:spacing',
  breakpoints: 'uxdsl:breakpoints',
});

export interface LegacyMigration {
  /** The override built from whatever legacy keys were present. */
  override: Record<string, any>;
  /** Legacy keys that contributed at least one entry. Only these are cleared,
   * and only after the converted override has been written and read back. */
  sourceKeys: string[];
  /** Entries that could not be converted, each explained. Never silently lost. */
  warnings: string[];
  /** True when at least one entry was converted. */
  found: boolean;
}

function readJson(storage: any, key: string, warnings: string[]): Record<string, any> | null {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch (cause) {
    warnings.push(`UXD_THEME_PERSIST: "${key}" could not be read (${cause instanceof Error ? cause.message : String(cause)}); it was skipped and left in place.`);
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      warnings.push(`UXD_THEME_PERSIST: "${key}" is not an object of token values; it was skipped and left in place.`);
      return null;
    }
    return parsed;
  } catch (cause) {
    warnings.push(`UXD_THEME_PERSIST: "${key}" is not valid JSON (${cause instanceof Error ? cause.message : String(cause)}); it was skipped and left in place.`);
    return null;
  }
}

/**
 * Splits `family-variant` using the family names that really exist.
 *
 * Longest match wins, so a theme declaring both `brand` and `brand-accent`
 * resolves `brand-accent-main` to the more specific family — the same way the
 * normalizer produced it.
 */
function splitByKnownFamily(key: string, families: string[]): { family: string; variant: string } | null {
  let best: { family: string; variant: string } | null = null;
  for (const family of families) {
    if (!key.startsWith(`${family}-`)) continue;
    const variant = key.slice(family.length + 1);
    if (!variant) continue;
    if (!best || family.length > best.family.length) best = { family, variant };
  }
  return best;
}

function setIn(target: Record<string, any>, path: string[], value: unknown): void {
  let node = target;
  for (const segment of path.slice(0, -1)) {
    if (!node[segment] || typeof node[segment] !== 'object') node[segment] = {};
    node = node[segment];
  }
  node[path[path.length - 1]] = value;
}

/**
 * Converts every legacy key present into a single theme override.
 *
 * `effectiveTheme` supplies the family names used to undo normalization; it is
 * the theme currently applied, so a project's own `palette.brand` is resolved
 * just as well as a packaged one.
 */
export function readLegacyThemeStorage(storage: any, effectiveTheme: Record<string, any>): LegacyMigration {
  const warnings: string[] = [];
  const override: Record<string, any> = {};
  const sourceKeys: string[] = [];
  let found = false;

  const paletteFamilies = Object.keys((effectiveTheme && effectiveTheme.palette) || {});
  const colorFamilies = Object.keys((effectiveTheme && effectiveTheme.colors) || {});

  const palette = readJson(storage, LEGACY_STORAGE_KEYS.palette, warnings);
  if (palette) {
    let used = false;
    for (const [key, value] of Object.entries(palette)) {
      if (typeof value !== 'string') {
        warnings.push(`UXD_THEME_PERSIST: "${LEGACY_STORAGE_KEYS.palette}" entry "${key}" is not a string; skipped.`);
        continue;
      }
      const split = splitByKnownFamily(key, paletteFamilies);
      if (!split) {
        warnings.push(`UXD_THEME_PERSIST: stored palette token "${key}" does not start with a palette family this theme declares, so where the family ends cannot be known; skipped.`);
        continue;
      }
      setIn(override, ['palette', split.family, split.variant], value);
      used = true;
    }
    if (used) { sourceKeys.push(LEGACY_STORAGE_KEYS.palette); found = true; }
  }

  const colors = readJson(storage, LEGACY_STORAGE_KEYS.colors, warnings);
  if (colors) {
    let used = false;
    for (const [key, value] of Object.entries(colors)) {
      if (typeof value !== 'string') {
        warnings.push(`UXD_THEME_PERSIST: "${LEGACY_STORAGE_KEYS.colors}" entry "${key}" is not a string; skipped.`);
        continue;
      }
      const split = splitByKnownFamily(key, colorFamilies);
      if (split) setIn(override, ['colors', split.family, split.variant], value);
      else if (key.includes('-')) {
        warnings.push(`UXD_THEME_PERSIST: stored color token "${key}" does not start with a color family this theme declares; skipped.`);
        continue;
      } else {
        // No hyphen at all: a standalone color like `white`, which the
        // normalizer leaves untouched.
        setIn(override, ['colors', key], value);
      }
      used = true;
    }
    if (used) { sourceKeys.push(LEGACY_STORAGE_KEYS.colors); found = true; }
  }

  const spacing = readJson(storage, LEGACY_STORAGE_KEYS.spacing, warnings);
  if (spacing) {
    let used = false;
    for (const [key, value] of Object.entries(spacing)) {
      if (typeof value !== 'string') {
        warnings.push(`UXD_THEME_PERSIST: "${LEGACY_STORAGE_KEYS.spacing}" entry "${key}" is not a string; skipped.`);
        continue;
      }
      // Spacing keys are flat — there is nothing to disambiguate.
      setIn(override, ['spacing', key], value);
      used = true;
    }
    if (used) { sourceKeys.push(LEGACY_STORAGE_KEYS.spacing); found = true; }
  }

  const breakpoints = readJson(storage, LEGACY_STORAGE_KEYS.breakpoints, warnings);
  if (breakpoints) {
    let used = false;
    for (const [key, value] of Object.entries(breakpoints)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        warnings.push(`UXD_THEME_PERSIST: "${LEGACY_STORAGE_KEYS.breakpoints}" entry "${key}" is not a number; skipped.`);
        continue;
      }
      setIn(override, ['breakpoints', key], value);
      used = true;
    }
    if (used) { sourceKeys.push(LEGACY_STORAGE_KEYS.breakpoints); found = true; }
  }

  return { override: cloneThemeValue(override), sourceKeys, warnings, found };
}

/**
 * Removes the legacy keys that were converted.
 *
 * Called only after the new key has been written *and* read back, so a storage
 * that accepts a write but loses it never costs the user the only copy of their
 * customizations. A removal that fails is reported, not swallowed: leaving a
 * stale key behind is harmless (the new key wins from then on) but worth saying.
 */
export function clearLegacyThemeStorage(storage: any, keys: string[], warnings: string[]): void {
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch (cause) {
      warnings.push(`UXD_THEME_PERSIST: "${key}" was migrated but could not be removed (${cause instanceof Error ? cause.message : String(cause)}); it will be ignored from now on.`);
    }
  }
}
