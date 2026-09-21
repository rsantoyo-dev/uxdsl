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
 * `require('./theme/base.json')` is cached by Node like any other module,
 * so every engine that imports `BASE_THEME` receives the exact same object
 * reference — `deepFreeze` below only ever runs once, the first time any of
 * them is loaded, not once per importer.
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

export const BASE_THEME: Readonly<Record<string, any>> = deepFreeze(baseThemeJson);
