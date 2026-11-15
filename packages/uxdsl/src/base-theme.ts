import baseThemeJson from './theme/base.json';

/**
 * The one place the shipped `theme/base.json` is loaded and frozen: a leaf
 * that imports no engine and not `default-theme.ts`, so the engines that
 * derive their `DEFAULT_*` exports from `BASE_THEME` form no cycle through it.
 * It freezes a deep clone, never the parsed JSON itself, because any other
 * code importing the public `uxdsl/theme/base.json` path shares that object
 * and may merge and mutate it.
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
