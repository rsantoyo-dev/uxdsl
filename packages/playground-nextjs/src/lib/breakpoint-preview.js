// The Live theme handler's breakpoint preview: move the page's breakpoints
// without a rebuild, in this playground only.
//
// A breakpoint cannot move through the theme at run time. Every `md(...)` and
// `@media (--md)` is already compiled to `@media (min-width: 768px)`, and a
// media query cannot read a custom property, so `applyTheme` refuses a
// breakpoint change (UXD_THEME_STRUCTURE). What the page can do is move the
// compiled rules themselves: this walks the CSSOM and rewrites each media
// rule's `min-width` from the compiled width of a breakpoint to its previewed
// one.
//
// Unlike the runtime's removed `updateBreakpoint` (stability phase 2), it does
// not rewrite stylesheet text or replace <link> elements, and it always starts
// from the rule's compiled condition, remembered per rule. So moving md past
// lg's compiled width does not then drag lg's rules along, and a reset puts
// every rule back exactly.
//
// The limit, said in the editor: a hand-written `min-width` equal to a
// breakpoint's compiled width cannot be told from a compiled one, and moves
// too. A reload brings back the compiled widths.
//
// Plain JS so `scripts/test-breakpoint-preview.cjs` can test it with node:test.

const MIN_WIDTH = /(min-width\s*:\s*)(\d+(?:\.\d+)?)px/gi;

/**
 * A media condition with every `min-width: Npx` that is a compiled breakpoint
 * width moved to that breakpoint's previewed width. Other widths stay.
 */
function rewriteMediaText(text, compiled, next) {
  const byWidth = new Map();
  for (const [name, width] of Object.entries(compiled || {})) byWidth.set(Number(width), name);
  return String(text).replace(MIN_WIDTH, (whole, prefix, value) => {
    const name = byWidth.get(Number(value));
    if (name === undefined || next[name] === undefined || Number(next[name]) === Number(value)) return whole;
    return `${prefix}${next[name]}px`;
  });
}

/**
 * Why a previewed map cannot apply, or null. The base breakpoint stays at 0,
 * every other one is a whole number of pixels, and the order of the compiled
 * map is kept: a breakpoint cannot overtake the next one.
 */
function checkPreview(compiled, next) {
  const names = Object.keys(compiled || {}).sort((a, b) => compiled[a] - compiled[b]);
  let previous = -1;
  for (const name of names) {
    const width = next[name];
    if (typeof width !== 'number' || !Number.isInteger(width) || width < 0) return `${name}: a width is a whole number of pixels.`;
    if (compiled[name] === 0 && width !== 0) return `${name} is the base breakpoint and stays at 0.`;
    if (width <= previous) return `${name} (${width}px) must be wider than the breakpoint before it (${previous}px).`;
    previous = width;
  }
  return null;
}

/** Only the breakpoints that differ from the compiled map: what to write in the theme file. */
function changedBreakpoints(compiled, next) {
  const out = {};
  for (const [name, width] of Object.entries(next || {})) if (compiled[name] !== width) out[name] = width;
  return out;
}

/**
 * Rewrites the media rules of every stylesheet the document can read, from
 * each rule's compiled condition. `originals` (a WeakMap) remembers that
 * condition per rule across calls. Returns how many rules now differ from it.
 */
function applyToDocument(doc, compiled, next, originals) {
  let moved = 0;
  const visit = (rules) => {
    for (const rule of Array.from(rules || [])) {
      if (rule.media && typeof rule.media.mediaText === 'string' && rule.type === 4) {
        if (!originals.has(rule)) originals.set(rule, rule.media.mediaText);
        const original = originals.get(rule);
        const target = rewriteMediaText(original, compiled, next);
        if (rule.media.mediaText !== target) rule.media.mediaText = target;
        if (target !== original) moved += 1;
      }
      // @media, @supports, @layer and nested style rules can all hold media rules.
      if (rule.cssRules) visit(rule.cssRules);
    }
  };
  for (const sheet of Array.from(doc.styleSheets || [])) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // a cross-origin stylesheet cannot be read, and holds no compiled UXDSL
    }
    visit(rules);
  }
  return moved;
}

/** The theme as the page uses it: its breakpoints replaced by the previewed ones, in place. */
function withBreakpoints(theme, breakpoints) {
  return theme && breakpoints ? { ...theme, breakpoints: { ...breakpoints } } : theme;
}

/**
 * Splits an edit of the whole theme (the JSON tab) into what applyTheme can take and what
 * only the preview can: the theme with its compiled breakpoints back, and the previewed
 * breakpoints (null when they are the compiled ones). A breakpoint can be moved, not added
 * or removed: that changes which xs()...xl() functions exist, and needs a rebuild.
 */
function splitThemeEdit(compiled, theme) {
  const requested = (theme && theme.breakpoints) || compiled;
  const have = Object.keys(compiled).sort().join(',');
  const want = Object.keys(requested).sort().join(',');
  if (have !== want) {
    return { error: `Breakpoints can be moved here, not added or removed (${want || 'none'} instead of ${have}): a new name is a new function, which needs a rebuild.` };
  }
  const problem = checkPreview(compiled, requested);
  if (problem) return { error: problem };
  const changed = changedBreakpoints(compiled, requested);
  return {
    theme: { ...theme, breakpoints: { ...compiled } },
    preview: Object.keys(changed).length ? { ...compiled, ...requested } : null,
  };
}

module.exports = { rewriteMediaText, checkPreview, changedBreakpoints, applyToDocument, withBreakpoints, splitThemeEdit };
