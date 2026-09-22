// MIG-B6-30 (FEAT-008): one theme model at build time and at run time.
//
// The project's theme is JSON: a base plus an override. A build compiles that
// JSON; this applies the same JSON in the browser, so editing a value needs no
// rebuild. What it explicitly is *not* is a compiler — see `theme-structure.ts`
// for the line between a value change (safe) and a change to what the compiler
// would emit for the host's own components (rejected with an actionable error).
//
// Everything here is synchronous. `applyTheme` validates, generates and checks
// the structure *before* touching the DOM or any stored state, so when it
// returns `ok: true` the stylesheet and the reported state already agree, and
// when it returns `ok: false` nothing moved at all. There is no
// requestAnimationFrame inside: batching belongs to the editor that produces
// the patches, which is the only layer that knows what a "frame" of input is.
import { generateThemeCss } from './theme-generator';
import { validateAndNormalizeTheme, deepMergeTheme } from './theme-validate';
import { resolveTheme } from '../default-theme';
import { themeStructure, structuralChanges, structuralChangeError, ThemeStructure } from './theme-structure';

export type ThemeOverride = Record<string, any>;

export type ThemeResult =
  | { ok: true; override: ThemeOverride; warnings: string[] }
  | { ok: false; error: Error };

export interface ApplyThemeOptions {
  /** Start from the base theme instead of merging over what is applied. */
  replace?: boolean;
  /** Id of the managed `<style>` element. Default `uxdsl-theme`. Fixed after
   * the first successful call — a second id would mean two global stylesheets
   * competing, and the later one would silently win by document order. */
  styleId?: string;
  /** Persist the resulting override. `true` uses the default key. Per call:
   * persisting once does not make later calls persist. */
  persist?: boolean | string;
}

export const DEFAULT_THEME_STYLE_ID = 'uxdsl-theme';
export const DEFAULT_THEME_STORAGE_KEY = 'uxdsl:theme';

type Listener = (override: ThemeOverride) => void;

interface ThemeState {
  initialized: boolean;
  styleId: string;
  style: any;
  /** The override the project built with, restored by `resetTheme`. */
  projectOverride: ThemeOverride;
  applied: ThemeOverride;
  structure: ThemeStructure | null;
  listeners: Set<Listener>;
}

// Keyed by document: an iframe, a popout or a second document gets its own
// managed element and its own applied state. The legacy setters in
// `./index.ts` are module singletons that always write to the global
// `document`; this deliberately is not.
const states = new WeakMap<object, ThemeState>();

function currentDocument(): any | null {
  return typeof document === 'undefined' ? null : document;
}

function environmentError(operation: string): Error {
  const error = new Error(
    `UXD_THEME_ENVIRONMENT: ${operation} needs a document and this environment has none. ` +
    'On the server, generate CSS with generateThemeCss(theme) and render it yourself — ' +
    'that path is pure and per-request, with no shared state.'
  );
  (error as any).code = 'UXD_THEME_ENVIRONMENT';
  return error;
}

function notInitializedError(operation: string): Error {
  const error = new Error(
    `UXD_THEME_NOT_INITIALIZED: ${operation} needs an applied theme. ` +
    "Call applyTheme(projectOverride, { replace: true }) once with the override the project was built with " +
    '(use {} for a zero-config project) before loading or resetting.'
  );
  (error as any).code = 'UXD_THEME_NOT_INITIALIZED';
  return error;
}

/** Theme JSON is data, so a JSON round trip is a faithful deep copy and keeps
 * callers from mutating internal state through a returned reference. */
function copy<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function stateFor(doc: any): ThemeState {
  let state = states.get(doc);
  if (!state) {
    state = {
      initialized: false,
      styleId: DEFAULT_THEME_STYLE_ID,
      style: null,
      projectOverride: {},
      applied: {},
      structure: null,
      listeners: new Set(),
    };
    states.set(doc, state);
  }
  return state;
}

/**
 * Finds or creates the managed `<style>`.
 *
 * An existing element with that id is adopted — that is how a server-rendered
 * theme tag is taken over without a second one appearing at hydration — but
 * only when it really is a `<style>`. Overwriting someone else's element with
 * generated CSS would be a destructive surprise, so that is an error instead.
 */
function ensureStyleElement(doc: any, styleId: string): any {
  const existing = doc.getElementById ? doc.getElementById(styleId) : null;
  if (existing) {
    const tag = String(existing.tagName || '').toLowerCase();
    if (tag !== 'style') {
      const error = new Error(
        `UXD_THEME_STYLE_ELEMENT: #${styleId} is a <${tag}>, not a <style>. ` +
        'Refusing to overwrite it; give applyTheme a different styleId.'
      );
      (error as any).code = 'UXD_THEME_STYLE_ELEMENT';
      throw error;
    }
    existing.setAttribute('data-uxdsl-theme', '');
    return existing;
  }
  const style = doc.createElement('style');
  style.id = styleId;
  style.setAttribute('data-uxdsl-theme', '');
  (doc.head || doc.documentElement).appendChild(style);
  return style;
}

function storageKeyFor(persist: boolean | string | undefined): string | null {
  if (persist === undefined || persist === false) return null;
  return persist === true ? DEFAULT_THEME_STORAGE_KEY : persist;
}

/** Writes the override, reporting failure as a warning rather than an error:
 * the visual change already happened and is real. Claiming the whole operation
 * failed would be wrong, and silently swallowing it would claim a save that
 * never happened. */
function persistOverride(key: string, override: ThemeOverride, warnings: string[]): void {
  try {
    if (typeof localStorage === 'undefined') {
      warnings.push(`UXD_THEME_PERSIST: the theme was applied but not saved — this environment has no localStorage.`);
      return;
    }
    localStorage.setItem(key, JSON.stringify(override));
  } catch (cause) {
    warnings.push(
      `UXD_THEME_PERSIST: the theme was applied but not saved to "${key}" ` +
      `(${cause instanceof Error ? cause.message : String(cause)}).`
    );
  }
}

/** A listener that throws must not stop the others, and must not invalidate a
 * commit that already happened. Its error is reported, not propagated. */
function notify(state: ThemeState, override: ThemeOverride): void {
  for (const listener of Array.from(state.listeners)) {
    try {
      listener(copy(override));
    } catch (cause) {
      try {
        console.error('[uxdsl] a theme listener threw; the theme was still applied', cause);
      } catch {
        /* console is optional */
      }
    }
  }
}

/**
 * Applies a theme override and returns synchronously.
 *
 * The first call establishes the project's theme and the structure every later
 * patch is checked against, so it has to be the override the project actually
 * compiled with (`{}` for a zero-config project). The library cannot infer that
 * from the page: reading the compiled CSS back does not reconstruct the JSON.
 */
export function applyTheme(patch: ThemeOverride = {}, options: ApplyThemeOptions = {}): ThemeResult {
  const doc = currentDocument();
  if (!doc) return { ok: false, error: environmentError('applyTheme') };

  const state = stateFor(doc);
  const requestedId = options.styleId || DEFAULT_THEME_STYLE_ID;
  if (state.initialized && options.styleId && options.styleId !== state.styleId) {
    const error = new Error(
      `UXD_THEME_STYLE_ID: the theme is already managed through #${state.styleId}; ` +
      `switching to #${options.styleId} would leave two global stylesheets competing. ` +
      'Reload the document to change it.'
    );
    (error as any).code = 'UXD_THEME_STYLE_ID';
    return { ok: false, error };
  }

  const nextOverride = state.initialized && !options.replace
    ? deepMergeTheme(state.applied, patch || {})
    : copy(patch || {});

  // Validate, generate and compare the structure before anything is committed.
  const effective = resolveTheme(nextOverride as any);
  const validated = validateAndNormalizeTheme(effective as any);
  if (!validated.ok) {
    const error = new Error(
      'UXD_THEME_INVALID: the theme was rejected, and nothing was changed.\n  - ' +
      validated.errors.map((issue: any) => `${issue.path}: ${issue.message}`).join('\n  - ')
    );
    (error as any).code = 'UXD_THEME_INVALID';
    (error as any).issues = validated.errors;
    return { ok: false, error };
  }

  let css: string;
  try {
    css = generateThemeCss(validated.theme as any);
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause : new Error(String(cause)) };
  }

  let structure: ThemeStructure;
  try {
    structure = themeStructure(validated.theme, css);
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause : new Error(String(cause)) };
  }
  if (state.initialized && state.structure) {
    const changes = structuralChanges(state.structure, structure);
    if (changes.length) return { ok: false, error: structuralChangeError(changes) };
  }

  let style: any;
  try {
    style = state.style || ensureStyleElement(doc, requestedId);
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause : new Error(String(cause)) };
  }

  // --- commit ---
  style.textContent = css;
  state.style = style;
  state.styleId = state.initialized ? state.styleId : requestedId;
  state.applied = nextOverride;
  state.structure = structure;
  if (!state.initialized) {
    state.projectOverride = copy(nextOverride);
    state.initialized = true;
  }

  const warnings = (validated.warnings || []).map((issue: any) => `${issue.path}: ${issue.message}`);
  const key = storageKeyFor(options.persist);
  if (key) persistOverride(key, nextOverride, warnings);
  notify(state, nextOverride);

  return { ok: true, override: copy(nextOverride), warnings };
}

/** The override currently applied, as a copy. `{}` before initialization. */
export function getAppliedTheme(): ThemeOverride {
  const doc = currentDocument();
  if (!doc) return {};
  const state = states.get(doc);
  return state && state.initialized ? copy(state.applied) : {};
}

/** Restores the override the project was initialized with — not the packaged
 * base theme, which would discard the project's own design. */
export function resetTheme(options: { clearPersist?: boolean; key?: string } = {}): ThemeResult {
  const doc = currentDocument();
  if (!doc) return { ok: false, error: environmentError('resetTheme') };
  const state = states.get(doc);
  if (!state || !state.initialized) return { ok: false, error: notInitializedError('resetTheme') };

  const result = applyTheme(copy(state.projectOverride), { replace: true });
  if (!result.ok) return result;

  if (options.clearPersist) {
    const key = options.key || DEFAULT_THEME_STORAGE_KEY;
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch (cause) {
      result.warnings.push(
        `UXD_THEME_PERSIST: the theme was reset but "${key}" could not be cleared ` +
        `(${cause instanceof Error ? cause.message : String(cause)}).`
      );
    }
  }
  return result;
}

/**
 * Applies a previously persisted override.
 *
 * A stored theme is untrusted input — it may be corrupt, or written by an older
 * version — so it goes through the same validation and structural check as any
 * other patch. A rejected one leaves the applied theme alone rather than being
 * silently replaced by something else.
 */
export function loadPersistedTheme(options: { key?: string } = {}): ThemeResult {
  const doc = currentDocument();
  if (!doc) return { ok: false, error: environmentError('loadPersistedTheme') };
  const state = states.get(doc);
  if (!state || !state.initialized) return { ok: false, error: notInitializedError('loadPersistedTheme') };

  const key = options.key || DEFAULT_THEME_STORAGE_KEY;
  let raw: string | null = null;
  try {
    raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch (cause) {
    const error = new Error(
      `UXD_THEME_PERSIST: "${key}" could not be read ` +
      `(${cause instanceof Error ? cause.message : String(cause)}).`
    );
    (error as any).code = 'UXD_THEME_PERSIST';
    return { ok: false, error };
  }
  if (!raw) return { ok: true, override: getAppliedTheme(), warnings: [`UXD_THEME_PERSIST: nothing stored under "${key}".`] };

  let stored: any;
  try {
    stored = JSON.parse(raw);
  } catch (cause) {
    const error = new Error(
      `UXD_THEME_PERSIST: "${key}" does not contain valid JSON and was left untouched ` +
      `(${cause instanceof Error ? cause.message : String(cause)}).`
    );
    (error as any).code = 'UXD_THEME_PERSIST';
    return { ok: false, error };
  }
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    const error = new Error(`UXD_THEME_PERSIST: "${key}" does not contain a theme override object.`);
    (error as any).code = 'UXD_THEME_PERSIST';
    return { ok: false, error };
  }

  return applyTheme(stored, { replace: true });
}

/** Notified after every successful application, with a copy of the override.
 * Returns the unsubscribe function. Safe to call before initialization. */
export function subscribeTheme(listener: Listener): () => void {
  const doc = currentDocument();
  if (!doc || typeof listener !== 'function') return () => {};
  const state = stateFor(doc);
  state.listeners.add(listener);
  return () => { state.listeners.delete(listener); };
}

/** Test-only: forgets this document's managed state without touching the DOM,
 * so a suite can exercise the uninitialized path more than once. Not part of
 * the supported API. */
export function __resetThemeStateForTests(doc?: any): void {
  const target = doc || currentDocument();
  if (target) states.delete(target);
}
