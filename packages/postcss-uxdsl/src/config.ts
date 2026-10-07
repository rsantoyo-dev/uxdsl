import fs from 'fs';
import path from 'path';
import type { UxdslConfig } from './types';

// The JSDoc form in a `.cjs` config refers to this entry point by name
// (`@type {import('postcss-uxdsl/config').UxdslConfig}`), so the types it
// names have to be reachable from here, not only from the package root.
export type { UxdslConfig, UxdslConfigShared, UxdslBuild, UxdslTheme, UxdslThemeOverride } from './types';

// The one shared theme-file loader, used by the PostCSS plugin's own
// discovery, uxdsl-cli, vite-plugin-uxdsl and uxdsl-webpack-loader, so they
// can never disagree about which file wins or what shape it accepts.
//
// Two files, two jobs (stability phase 2, DE-10):
//   - the theme file (one of THEME_CANDIDATES) exports the theme, and only the
//     theme: `module.exports = { palette: … }`, `uxdsl.theme.json` holding the
//     same object, or a function (sync; async where the loader can await it)
//     returning it. Breakpoints live here, under `breakpoints`.
//   - the build config (`uxdsl.config.js`/`.cjs`) says what to compile and
//     where, and carries `references`. It never carries a theme.
// A theme file exporting the former `{ theme, references }` wrapper is refused
// with an error that says where each half now goes, rather than being read as
// a theme with two unknown families.

export const THEME_CANDIDATES = [
  'uxdsl.theme.config.cjs',
  'uxdsl.theme.config.js',
  'uxdsl.theme.json',
];

export interface NormalizedThemeExport {
  theme: unknown;
}

export interface DiscoveredTheme extends NormalizedThemeExport {
  themeConfigPath: string;
  /** `themeConfigPath` plus every local (non-`node_modules`) module it
   * transitively `require()`d while loading — safe to feed directly into
   * a PostCSS `dependency` message or a file watcher's list. */
  dependencies: string[];
  /** Always `undefined`: a theme file no longer carries `references` (they
   * live in the build config or the plugin/adapter option). Kept on the type
   * only until the plugin's own `discovered?.references` read is retired. */
  references?: undefined;
}

export function findThemeConfigPath(dir: string): string | null {
  for (const candidate of THEME_CANDIDATES) {
    const full = path.resolve(dir, candidate);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

const WRAPPER_KEYS = ['theme', 'references'];

/** A theme file exports the theme itself. The `{ theme, references }` wrapper
 * it used to accept is refused, not guessed at: silently reading it as a theme
 * would compile the project against an empty override (with `theme` and
 * `references` reported as unknown families at best), and the two halves now
 * have different homes. */
export function assertBareThemeExport(themeModule: any, themeConfigPath: string): void {
  const found = WRAPPER_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(themeModule, key));
  if (found.length === 0) return;
  throw new Error(
    `${themeConfigPath} exports { ${found.join(', ')} }. That wrapper was removed: a theme file exports ` +
    'the theme itself (module.exports = { palette: { … }, … }), and `references` belongs in ' +
    'uxdsl.config.cjs (or in the `references` option of the PostCSS plugin, Vite plugin or Webpack loader).'
  );
}

// Keys that only make sense on a build config (uxdsl.config.cjs), never on
// theme data. Used only as a heuristic for the warning below — not an
// exhaustive/validated list, since a real theme family could coincidentally
// use one of these names.
const BUILD_CONFIG_SHAPED_KEYS = ['entry', 'outFile', 'watch', 'plugins', 'builds'];

/** A theme file's entire export is theme data, so a uxdsl.config.cjs
 * accidentally renamed/copied to a theme-file name silently "works" (no throw
 * anywhere), with its entry/outFile/watch keys quietly ignored as unknown
 * theme tokens. This is a warning, not an error: a project could legitimately
 * have a token family literally named "watch" or "plugins", and
 * warning-then-continuing costs nothing there. Re-runs on every
 * rebuild/discovery — without dedup this would repeat on every keystroke in
 * watch mode or every recompilation of a long-running plugin instance. Keyed
 * by path so an unrelated project (or a second theme file) still gets its own
 * warning, and cleared/replaced when the shape actually changes so a
 * later-introduced or later-fixed collision is still caught. */
const warnedBuildConfigShapes = new Map<string, string>();

export function warnIfLooksLikeBuildConfig(themeModule: any, themeConfigPath: string): void {
  const suspects = BUILD_CONFIG_SHAPED_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(themeModule, key)
  );
  if (suspects.length === 0) {
    warnedBuildConfigShapes.delete(themeConfigPath);
    return;
  }
  const signature = suspects.join(',');
  if (warnedBuildConfigShapes.get(themeConfigPath) === signature) return; // Same shape already warned this session.
  warnedBuildConfigShapes.set(themeConfigPath, signature);
  const keyList = suspects.map((k) => `"${k}"`).join(', ');
  console.warn(
    `[uxdsl] Warning: ${themeConfigPath} looks like a build config (found ${keyList}), but a theme file ` +
    `is read entirely as theme data — ${suspects.length > 1 ? 'those keys are' : 'that key is'} silently ignored as unknown tokens. ` +
    'If it is a build config, name it uxdsl.config.cjs instead.'
  );
}

/** Same tree-walking `require.cache` traversal the CLI's watch mode has
 * always used to find nested local modules to invalidate/watch — moved
 * here so the plugin's own discovery gets the same "don't serve a stale
 * require() result" guarantee. `node_modules` is excluded: those files
 * don't change during a project's own dev loop and walking into a large
 * dependency graph would be wasteful. */
export function collectLocalRequireTree(filePath: string): Set<string> {
  const ids = new Set<string>();
  let resolved: string;
  try {
    resolved = require.resolve(filePath);
  } catch (_) {
    return ids; // Not required yet (or already gone) — nothing to report.
  }
  const visit = (id: string) => {
    if (ids.has(id)) return;
    ids.add(id);
    const mod = require.cache[id];
    if (!mod) return;
    for (const child of mod.children || []) {
      if (child.id && !child.id.split(path.sep).includes('node_modules')) {
        visit(child.id);
      }
    }
  };
  visit(resolved);
  return ids;
}

export function clearLocalRequireCache(filePath: string | null | undefined): void {
  if (!filePath) return;
  for (const id of collectLocalRequireTree(filePath)) delete require.cache[id];
}

function unwrapDefault(mod: any): any {
  if (mod && typeof mod === 'object' && 'default' in mod) return mod.default;
  return mod;
}

function acceptThemeExport(mod: any, themeConfigPath: string): NormalizedThemeExport {
  if (!mod || typeof mod !== 'object' || Array.isArray(mod)) {
    throw new Error(`Invalid theme export in ${themeConfigPath}: expected an object (or a function returning one).`);
  }
  assertBareThemeExport(mod, themeConfigPath);
  warnIfLooksLikeBuildConfig(mod, themeConfigPath);
  return { theme: mod };
}

/** Synchronous loader — required by the PostCSS plugin, whose factory and
 * `Once()` visitor are both synchronous, including uses that read
 * `.process().css` without ever awaiting anything. A plain object export and
 * a synchronous factory (`module.exports = () => ({...})`) are accepted; an
 * async factory can't be — there is nothing to await into — and is rejected
 * with a clear, actionable message rather than silently falling back to a
 * default theme, which would look like a validation bug (unrelated tokens
 * suddenly "missing") instead of the actual unsupported-shape problem. */
export function loadThemeConfigSync(themeConfigPath: string): NormalizedThemeExport {
  clearLocalRequireCache(themeConfigPath);
  let mod = require(themeConfigPath);
  mod = unwrapDefault(mod);
  if (typeof mod === 'function') {
    const result = mod();
    if (result && typeof result.then === 'function') {
      throw new Error(
        `${themeConfigPath} exports an async function. Synchronous theme discovery ` +
        '(used by the PostCSS plugin) cannot await it — pass a resolved `theme` object ' +
        'to the plugin directly (`uxdsl({ theme: {...} })`), or use an integration that ' +
        'supports async config (uxdsl-cli, vite-plugin-uxdsl or uxdsl-webpack-loader).'
      );
    }
    mod = result;
  }
  return acceptThemeExport(mod, themeConfigPath);
}

/** Async counterpart used by uxdsl-cli and the bundler adapters — accepts
 * everything the sync loader does, plus an async factory export. */
export async function loadThemeConfigAsync(themeConfigPath: string): Promise<NormalizedThemeExport> {
  clearLocalRequireCache(themeConfigPath);
  let mod = require(themeConfigPath);
  mod = unwrapDefault(mod);
  if (typeof mod === 'function') mod = await mod();
  return acceptThemeExport(mod, themeConfigPath);
}

function dependenciesFor(themeConfigPath: string): string[] {
  const deps = [themeConfigPath, ...collectLocalRequireTree(themeConfigPath)];
  return [...new Set(deps)];
}

/** Looks for a conventional theme file in `dir` and loads it synchronously
 * — the shape the PostCSS plugin's own factory/`Once()` needs. Returns
 * `null` when no candidate exists (not an error: discovery is opt-out, not
 * mandatory). */
export function discoverThemeSync(dir: string): DiscoveredTheme | null {
  const themeConfigPath = findThemeConfigPath(dir);
  if (!themeConfigPath) return null;
  const { theme } = loadThemeConfigSync(themeConfigPath);
  return { theme, themeConfigPath, dependencies: dependenciesFor(themeConfigPath) };
}

/** Async counterpart, for uxdsl-cli and the bundler adapters. */
export async function discoverThemeAsync(dir: string): Promise<DiscoveredTheme | null> {
  const themeConfigPath = findThemeConfigPath(dir);
  if (!themeConfigPath) return null;
  const { theme } = await loadThemeConfigAsync(themeConfigPath);
  return { theme, themeConfigPath, dependencies: dependenciesFor(themeConfigPath) };
}

// Identity at run time, a type checkpoint at edit time.
//
// Deliberately *not* generic. `defineConfig<T extends UxdslConfig>(config: T)`
// reads as stricter and is in fact weaker: inference widens `T` to include
// whatever extra keys the literal has, so `includeThem: false` would be
// accepted and silently ignored by the CLI — exactly the typo this exists to
// catch. A plain parameter type gets TypeScript's excess property check on the
// object literal instead, which is what reports the typo.
//
// The check only applies to a *fresh* object literal. For a config assembled
// beforehand, annotate at the definition site or use
// `satisfies UxdslConfig` — passing an already-widened variable through here
// cannot recover information the assignment already discarded.
/**
 * Type-checks a `uxdsl.config.cjs` export and returns it unchanged.
 *
 * ```js
 * const { defineConfig } = require('postcss-uxdsl/config');
 * module.exports = defineConfig({ entry: './src/a.uxdsl', outFile: './out/a.css' });
 * ```
 */
export function defineConfig(config: UxdslConfig): UxdslConfig {
  return config;
}
