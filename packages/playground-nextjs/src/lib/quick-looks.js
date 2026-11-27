// The Live theme handler's quick looks: one click, one theme patch, the whole page changes.
//
// Each look is a patch of absolute values, built from the named theme the page started from
// (`base`: this site's default, or Green, Purple, Slate), so:
//   - looks of different kinds compose (Rounder, then Ocean brand, then Compact);
//   - two looks of one kind replace each other (Roomy after Compact is Roomy, not "back to
//     where it was"), and pressing one twice changes nothing more;
//   - whether a look is on is read from the theme itself (`lookIsOn`): every token it sets
//     has its value. An edit in a tab, another theme or the JSON tab turns it off by itself;
//   - taking a look off (`lookOffPatch`) puts the tokens it set back to that theme's values.
// Each one is a value change only: no field, state or breakpoint the compiled CSS does not
// already have, so applyTheme takes it live. The tests check that for every look over every
// named theme, and that none adds a contrast failure.
//
// Plain JS so `scripts/test-quick-looks.cjs` can test it with node:test.

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => String(from + index));

/** Every token of `keys` set to `value(key)`. */
const each = (keys, value) => Object.fromEntries(keys.map((key) => [key, value(key)]));

/**
 * Each density one step along the scale: density(n) takes what density(n + by) gives in
 * `densities`. Step 0 stays zero, and a step with no neighbour that way keeps its own value,
 * so both density looks write the same keys and one replaces the other whole.
 */
const shifted = (densities = {}, by) => Object.fromEntries(
  Object.keys(densities)
    .filter((key) => key !== '0')
    .map((key) => {
      const neighbour = String(Number(key) + by);
      return [key, neighbour !== '0' && densities[neighbour] ? densities[neighbour] : densities[key]];
    }),
);

/** A Palette family moved to another color family's shades, in light and dark mode. */
const brand = (family) => () => ({
  palette: {
    primary: { main: `color(${family}.700)`, light: `color(${family}.500)`, dark: `color(${family}.900)`, contrast: 'color(white)' },
  },
  modes: {
    dark: {
      palette: {
        primary: { main: `color(${family}.300)`, light: `color(${family}.100)`, dark: `color(${family}.200)`, contrast: 'color(black)' },
      },
    },
  },
});

const LOOKS = [
  {
    id: 'rounder',
    kind: 'corners',
    label: 'Rounder',
    hint: 'Every radius token a few steps up: cards, buttons and fields round together.',
    patch: () => ({
      radii: {
        1: 'xs(space(2)) lg(space(3))',
        2: 'xs(space(4)) lg(space(5))',
        3: 'xs(space(5)) lg(space(6))',
        4: 'xs(space(6)) lg(space(8))',
        5: 'xs(space(8)) lg(space(10))',
      },
    }),
  },
  {
    id: 'sharp',
    kind: 'corners',
    label: 'Sharp',
    hint: 'Square corners: radius(1–5) to 0, on every card, button and field.',
    patch: () => ({ radii: each(range(1, 5), () => '0') }),
  },
  {
    id: 'compact',
    kind: 'density',
    label: 'Compact',
    hint: 'Every density one step tighter than the theme you started from: density(n) gives what density(n−1) gave.',
    patch: (base) => ({ densities: shifted(base.densities, -1) }),
  },
  {
    id: 'roomy',
    kind: 'density',
    label: 'Roomy',
    hint: 'Every density one step looser than the theme you started from: density(n) gives what density(n+1) gave.',
    patch: (base) => ({ densities: shifted(base.densities, 1) }),
  },
  {
    id: 'ocean',
    kind: 'brand',
    label: 'Ocean brand',
    hint: 'primary from the blue shades, in light and dark mode: every primary button, link and accent follows.',
    patch: brand('blue'),
  },
  {
    id: 'teal',
    kind: 'brand',
    label: 'Teal brand',
    hint: 'primary from the teal shades, in light and dark mode.',
    patch: brand('teal'),
  },
  {
    id: 'deeper',
    kind: 'shadows',
    label: 'Deeper shadows',
    hint: 'shadow(1–5) with more blur and more depth: every surface lifts.',
    patch: () => ({
      shadows: {
        1: '0 1px 3px color(black, 0.1), 0 2px 6px color(black, 0.12)',
        2: '0 2px 4px color(black, 0.1), 0 6px 16px color(black, 0.18)',
        3: '0 4px 8px color(black, 0.1), 0 12px 24px color(black, 0.2)',
        4: '0 6px 12px color(black, 0.12), 0 18px 36px color(black, 0.24)',
        5: '0 10px 20px color(black, 0.14), 0 28px 56px color(black, 0.3)',
      },
    }),
  },
  {
    id: 'flat',
    kind: 'shadows',
    label: 'Flat',
    hint: 'No shadows: shadow(1–5) to none, so borders and backgrounds carry the depth.',
    patch: () => ({ shadows: each(range(1, 5), () => 'none') }),
  },
];

/** The look with this id, or undefined. */
const lookById = (id) => LOOKS.find((look) => look.id === id);

/** Every leaf of a patch as [path, value]. */
function leaves(patch, path = []) {
  return Object.entries(patch).flatMap(([key, value]) =>
    value && typeof value === 'object' ? leaves(value, [...path, key]) : [[[...path, key], value]]);
}
const at = (theme, path) => path.reduce((node, key) => (node == null ? undefined : node[key]), theme);
const nest = (path, value) => path.reduceRight((inner, key) => ({ [key]: inner }), value);
const merge = (into, from) => {
  for (const [key, value] of Object.entries(from)) {
    if (value && typeof value === 'object') into[key] = merge(into[key] || {}, value);
    else into[key] = value;
  }
  return into;
};

/** What the look writes: `base` is the named theme the page started from, the one "Start over" goes back to. */
const lookPatch = (look, base) => look.patch(base);

/** True when every token the look sets has the look's value in `theme`. */
const lookIsOn = (look, theme, base) => leaves(lookPatch(look, base)).every(([path, value]) => at(theme, path) === value);

/** The patch that takes the look off: `base`'s value for every token the look sets. */
function lookOffPatch(look, base) {
  const patch = {};
  for (const [path] of leaves(lookPatch(look, base))) {
    const value = at(base, path);
    if (typeof value === 'string') merge(patch, nest(path, value));
  }
  return patch;
}

module.exports = { LOOKS, lookById, lookPatch, lookIsOn, lookOffPatch };
