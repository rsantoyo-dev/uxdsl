import baseThemeJson from './theme/base.json';

/**
 * MIG-B6-29 (FEAT-008): the one place the shipped `theme/base.json` is
 * loaded and frozen. A pure leaf — imports nothing from `default-theme.ts`
 * (the resolver) or any engine (`language.ts`, `edges.ts`, `shadows.ts`,
 * `surfaces.ts`, `buttons.ts`, `inputs.ts`), all of which import `BASE_THEME`
 * from here to derive their own `DEFAULT_*` family export. That one-way
 * direction (engines -> this module -> JSON) is what keeps the graph
 * acyclic: if this file imported anything back from an engine, or from the
 * resolver, every engine that also imports this file would form a cycle
 * through it.
 *
 * `require('./theme/base.json')` is cached by Node (and by bundlers) like
 * any other module, keyed by resolved absolute path — not by import
 * specifier. `postcss-uxdsl/theme/base.json` is also the package's public
 * export for this same file (`"./theme/*": "./src/theme/*"`), so *any*
 * other code in the same process/bundle that imports that public path
 * (directly, or via a build tool aliasing `postcss-uxdsl/*` straight to
 * this package's own source — the Next.js playground's webpack config
 * does exactly that, "to consume current engine source, not a stale local
 * dist") resolves to the exact same physical file, and therefore the exact
 * same parsed object, as this module's own `baseThemeJson` import.
 *
 * That was a real, shipped bug (not hypothetical): deep-freezing
 * `baseThemeJson` in place froze that shared object, and the playground's
 * own `themes.js` — an *unrelated* consumer that happens to import the
 * same public path, with no reason to expect it to be frozen — went on to
 * `deepMergeTheme` it and later mutate an untouched, reference-preserved
 * sub-object in place (`ds-runtime/theme-validate.ts`'s
 * `theme.fonts.families[k] = ...`), which threw
 * `TypeError: Cannot assign to read only property`. `dist/theme/base.json`
 * (a separate, tsc-copied file only this package's own compiled output
 * ever reads) never exposed this, since nothing outside `dist/` shares
 * that particular file — only testing against real source-resolution
 * tooling (a real bundler honoring a real monorepo alias) surfaced it.
 *
 * The fix: freeze a fresh, independent deep clone, never the imported
 * object itself. `BASE_THEME`'s *content* is unaffected — every consumer
 * still gets a theme deep-equal to `theme/base.json` — but no other code
 * holding a reference to the original parsed JSON (by any import path)
 * is affected by this module choosing to freeze its own copy.
 */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

export const BASE_THEME: Readonly<Record<string, any>> = deepFreeze(JSON.parse(JSON.stringify(baseThemeJson)));
