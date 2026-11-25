// What the Live theme handler checks before it applies an edit: the same three things
// applyTheme checks, asked first so the editor can say why, instead of the runtime
// refusing in the console with the page unchanged.
//
//   1. validateTheme: the grammar and every reference (`palette(nope.main)` is refused).
//   2. generateThemeCss: the engines compile it (`xxl(…)` is refused).
//   3. structuralChanges: a patch that changes *which declarations* a directive emits — a
//      field or a state a role did not have, a Button's Surface — cannot reach CSS a build
//      already compiled, so it is refused with the change named (a rebuild applies it).
//
// Plain JS so scripts/test-role-editing.cjs can test it with node:test.

const { deepMergeTheme, validateTheme, generateThemeCss } = require('uxdsl/theme');
const { themeStructure, structuralChanges } = require('uxdsl/engine');

// The structure of a theme is computed once per theme object: the active theme does not
// change between two edits, and generating it is the costly part.
const structures = new WeakMap();
function structureOf(theme) {
  if (!structures.has(theme)) structures.set(theme, themeStructure(theme, generateThemeCss(theme)));
  return structures.get(theme);
}

/**
 * `{ ok: true }`, or `{ ok: false, kind: 'invalid' | 'structure', message }`.
 * `theme` is the active effective theme; `patch` is what setCustomTheme would merge over it.
 */
function checkPatch(theme, patch) {
  const next = deepMergeTheme(theme, patch);
  const checked = validateTheme(next);
  if (!checked.ok) return { ok: false, kind: 'invalid', message: checked.errors.map((issue) => issue.message).join('; ') };
  let css;
  try {
    css = generateThemeCss(next);
  } catch (cause) {
    return { ok: false, kind: 'invalid', message: cause instanceof Error ? cause.message : String(cause) };
  }
  const changes = structuralChanges(structureOf(theme), themeStructure(next, css));
  if (changes.length) {
    return {
      ok: false,
      kind: 'structure',
      message: `This changes what the compiled CSS emits (${changes.join('; ')}), so a running page cannot follow it: write it in the theme file and rebuild.`,
    };
  }
  return { ok: true };
}

module.exports = { checkPatch };
