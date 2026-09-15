'use strict';

/**
 * MIG-07: compares two compiled CSS strings the way a browser actually
 * resolves competing custom-property declarations, instead of comparing
 * raw declaration text.
 *
 * Two things a naive "collect every `--` declaration, then sort() the
 * flat list" comparison gets wrong, both found by review:
 *
 * 1. Source order within one scope: `:root { --x: 1px; --x: 2px; }` and
 *    the same two declarations reversed both produce the same *set* of
 *    strings, so sorting can't tell them apart — but a browser applies
 *    the *last* one, so they resolve to different values (2px vs 1px).
 *    `!important` overrides this: an earlier `!important` declaration
 *    still beats a later non-important one.
 * 2. Source order *between* overlapping `@media (min-width: …)` blocks:
 *    at a width where two such blocks are simultaneously active (e.g.
 *    both `min-width: 600px` and `min-width: 800px` at width 800),
 *    whichever block comes *later in the stylesheet* wins for that
 *    shared property — regardless of which threshold is numerically
 *    higher. Swapping the order of two such blocks changes the winner
 *    from the higher threshold upward, but a flat per-block comparison
 *    (each `@media` treated as its own independent scope) never notices,
 *    because reordering doesn't change any individual scope's own value.
 *
 * `cascadedVariables` resolves both: for every (scope, property) pair, it
 * finds every distinct `min-width` threshold that could change the
 * winner, and at each one, simulates which declaration is actually active
 * and wins — same "important, then source order" tie-break
 * `reference-integrity.ts`'s `resolve()` already uses elsewhere in this
 * repo, generalized across every width, not just one.
 *
 * Deliberately out of scope (documented, not silently ignored): any
 * `@media` condition other than a bare `min-width` (e.g.
 * `prefers-color-scheme`) is kept as part of the declaration's *scope*
 * rather than modeled as a width threshold — two declarations under
 * different such conditions are never compared against each other, which
 * matches how CSS actually treats mutually-exclusive media features, but
 * means this does not model two conditions that can be simultaneously
 * true in ways this function doesn't recognize (e.g. a nested
 * `min-width` *inside* a `prefers-color-scheme` block: this reduces the
 * whole chain to one attribute-like scope, still analyzed as a min-width
 * threshold within that scope — a `prefers-color-scheme` block itself is
 * not, since it never keys off a numeric viewport threshold at all).
 */

const MIN_WIDTH_RE = /^\(\s*min-width\s*:\s*([\d.]+)\s*px\s*\)$/;

function parseChain(declaration) {
  const scopeParts = [];
  let minWidth = 0;
  for (let parent = declaration.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    if (parent.type === 'rule') {
      scopeParts.push(`rule:${parent.selector}`);
      continue;
    }
    if (parent.type === 'atrule') {
      if (parent.name === 'media') {
        const match = MIN_WIDTH_RE.exec(String(parent.params || '').trim());
        if (match) {
          // Nested min-width conditions AND together; the binding one is
          // the largest (most restrictive) threshold.
          minWidth = Math.max(minWidth, Number(match[1]));
          continue;
        }
      }
      scopeParts.push(`at:${parent.name}:${parent.params}`);
    }
  }
  return { scope: scopeParts.reverse().join(' > '), minWidth };
}

/**
 * Returns a sorted array of `"<scope> | <prop> @ <threshold>px | <value>[
 * !important]"` strings — one entry per (scope, prop, threshold) triple
 * where `threshold` is a width at or above which this is the winning
 * value (the next higher threshold for the same scope/prop, if any,
 * takes over from its own width upward).
 */
function cascadedVariables(css, runtimePostcss) {
  const root = runtimePostcss.parse(css);
  const groups = new Map(); // "scope | prop" -> [{ minWidth, important, order, value }]
  let order = 0;
  root.walkDecls(/^--/, (declaration) => {
    const { scope, minWidth } = parseChain(declaration);
    const key = `${scope} | ${declaration.prop}`;
    const list = groups.get(key) || [];
    list.push({ minWidth, important: !!declaration.important, order: order++, value: declaration.value });
    groups.set(key, list);
  });

  const output = [];
  for (const [key, candidates] of groups) {
    const thresholds = Array.from(new Set(candidates.map((c) => c.minWidth))).sort((a, b) => a - b);
    let previousWinner;
    for (const threshold of thresholds) {
      const active = candidates.filter((c) => c.minWidth <= threshold);
      const winner = active.reduce((best, candidate) => {
        if (!best) return candidate;
        if (Number(candidate.important) !== Number(best.important)) {
          return Number(candidate.important) > Number(best.important) ? candidate : best;
        }
        return candidate.order > best.order ? candidate : best;
      }, undefined);
      const rendered = `${winner.value}${winner.important ? ' !important' : ''}`;
      // Only the widths where the winner actually *changes* are
      // meaningful; skip re-emitting an identical winner at a later
      // threshold that didn't introduce a new candidate value.
      if (rendered !== previousWinner) output.push(`${key} @ ${threshold}px | ${rendered}`);
      previousWinner = rendered;
    }
  }
  return output.sort();
}

function mapsEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

module.exports = { cascadedVariables, mapsEqual };
