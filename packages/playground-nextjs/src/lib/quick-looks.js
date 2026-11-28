// The Live theme handler's quick looks: one click, one theme patch, the whole page changes.
//
// Two kinds of shortcut, both read from the theme on the page and never remembered:
//
//   - a dial (DIALS: Round, Space, Text, Border, Shadow) steps one family of the theme from
//     0 to 5 with − and +. Level 2 is the named theme the page started from (`base`: this
//     site's default, or Green, Purple, Slate); every other level is made of that theme's
//     own values, in one of two ways:
//       · `shift` (Round, Border, Shadow): each token takes the string of a neighbour on
//         its family's scale. At Round 4, radius(n) gives what radius(n + 2) gave. No value
//         is invented and none is parsed, so a reference stays a reference. Level 0 is the
//         zero token everywhere: square corners, no border, no shadow.
//       · `scale` (Space, Text): each value is kept and multiplied, breakpoint by
//         breakpoint: xs(space(4)) md(space(5)) becomes xs(calc(space(4) * 1.15))
//         md(calc(space(5) * 1.15)). A step along the Spacing scale is a third to a half
//         more, too abrupt for a whole site at once; a factor makes a step small. The
//         expression is split by responsiveEntries (uxdsl/language), not by a parser here.
//   - a look (LOOKS: the brands) is a patch of absolute values that is on or off.
//
// So:
//   - dials and looks compose (Round 4, then Ocean brand, then Space 1);
//   - the level a dial shows is the one whose values the theme has (`dialLevel`). After an
//     edit by hand in a part it has none, and a step then moves the values that are on the
//     page (`dialStep`), one place along the scale or by one factor, instead of
//     overwriting them;
//   - whether a look is on is read the same way (`lookIsOn`), and taking it off
//     (`lookOffPatch`) puts the tokens it set back to that theme's values.
// Each one is a value change only: no field, state or breakpoint the compiled CSS does not
// already have, so applyTheme takes it live. The tests check that for every level and every
// look over every named theme, and that none adds a contrast failure.
//
// Plain JS so `scripts/test-quick-looks.cjs` can test it with node:test.

const { responsiveEntries } = require('uxdsl/language');

/** The numbered keys of a family, without its zero: the tokens a shift or a scale writes. */
const steps = (tokens = {}) => Object.keys(tokens).filter((key) => /^[1-9]\d*$/.test(key));

/**
 * Each token one or more places along its family's scale: token n takes what token n + by
 * gives in `tokens`. Past the top of the scale it takes the top's value, and below 0 the
 * zero token's. The zero token itself is never written.
 */
function shifted(tokens = {}, by) {
  const keys = steps(tokens);
  const top = Math.max(...keys.map(Number));
  return Object.fromEntries(keys.map((key) => {
    const neighbour = String(Math.min(top, Math.max(0, Number(key) + by)));
    return [key, typeof tokens[neighbour] === 'string' ? tokens[neighbour] : tokens[key]];
  }));
}

// A keyword or a bare zero: nothing calc() can multiply, so it stays as written.
const PLAIN = /^(0|[a-z-]+)$/i;

/** A value multiplied at each breakpoint it is written for: xs(a) md(b) → xs(calc(a * f)) md(calc(b * f)). */
function scaled(value, factor, breakpoints) {
  if (factor === 1) return value;
  const entries = responsiveEntries(value, breakpoints && Object.keys(breakpoints).length ? breakpoints : { xs: 0 });
  if (Object.values(entries).every((part) => PLAIN.test(part))) return value;
  return Object.entries(entries).map(([name, part]) => `${name}(${PLAIN.test(part) ? part : `calc(${part} * ${factor})`})`).join(' ');
}

/** The level every dial shows on the theme the page started from. */
const HOME = 2;
/** The highest level; the lowest is 0. */
const TOP = 5;

// A shift's `by` is how many places along the scale each level is from the starting theme
// (a family with five tokens and a zero is all zero at −5); a scale's `times` is the factor
// of each level, and `nudge` the factor of one step down and up from values edited by hand.
const DIALS = [
  {
    id: 'round',
    kind: 'shift',
    family: 'radii',
    token: 'radius',
    label: 'Round',
    less: 'Sharper',
    more: 'Rounder',
    by: [-5, -1, 0, 1, 2, 3],
    zero: 'square corners on every card, button and field',
    what: 'cards, buttons and fields round together',
  },
  {
    id: 'space',
    kind: 'scale',
    family: 'densities',
    token: 'density',
    label: 'Space',
    less: 'Tighter',
    more: 'Roomier',
    times: [0.7, 0.85, 1, 1.15, 1.3, 1.45],
    nudge: [0.87, 1.15],
    what: 'every padding and gap follows, at every breakpoint',
  },
  {
    id: 'text',
    kind: 'scale',
    family: 'typography_details',
    field: 'fontSize',
    token: 'font size',
    label: 'Text',
    less: 'Smaller',
    more: 'Larger',
    times: [0.85, 0.925, 1, 1.075, 1.15, 1.25],
    nudge: [0.93, 1.075],
    what: 'headings and body text follow together',
  },
  {
    id: 'border',
    kind: 'shift',
    family: 'borders',
    token: 'border',
    label: 'Border',
    less: 'Thinner',
    more: 'Thicker',
    by: [-5, -1, 0, 1, 2, 3],
    zero: 'no borders, so backgrounds and shadows carry the edges',
    what: 'every edge drawn with a border token follows',
  },
  {
    id: 'shadow',
    kind: 'shift',
    family: 'shadows',
    token: 'shadow',
    label: 'Shadow',
    less: 'Flatter',
    more: 'Deeper',
    by: [-5, -1, 0, 1, 2, 3],
    zero: 'no shadows, so borders and backgrounds carry the depth',
    what: 'every raised surface follows',
  },
];

/** The dial with this id, or undefined. */
const dialById = (id) => DIALS.find((dial) => dial.id === id);

/** The strings a dial writes, by key: a family's numbered tokens, or one field of each role that has it. */
function dialValues(dial, theme) {
  const family = (theme && theme[dial.family]) || {};
  if (!dial.field) return Object.fromEntries(steps(family).map((key) => [key, family[key]]));
  return Object.fromEntries(Object.entries(family)
    .filter(([, role]) => role && typeof role[dial.field] === 'string')
    .map(([name, role]) => [name, role[dial.field]]));
}

/** Those strings as a theme patch. */
const dialWrite = (dial, values) => ({
  [dial.family]: dial.field ? Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { [dial.field]: value }])) : values,
});

/** The values of `theme` moved by a number of places (a shift) or by a factor (a scale). */
function moved(dial, theme, amount) {
  if (dial.kind === 'shift') return shifted(theme[dial.family], amount);
  return Object.fromEntries(Object.entries(dialValues(dial, theme)).map(([key, value]) => [key, scaled(value, amount, theme.breakpoints)]));
}

const amounts = (dial) => (dial.kind === 'shift' ? dial.by : dial.times);

/** What a level writes: `base` is the named theme the page started from. */
const dialPatch = (dial, base, level) => dialWrite(dial, moved(dial, base, amounts(dial)[level]));

const sameValues = (now, values) => Object.entries(values).every(([key, value]) => now[key] === value);

/** The level whose values `theme` has, 0 to 5, or null when the family was edited by hand. */
function dialLevel(dial, theme, base) {
  const now = dialValues(dial, theme);
  // The starting theme is asked first: a family with one token has the same values at every level.
  for (const level of [HOME, ...amounts(dial).keys()]) {
    if (sameValues(now, moved(dial, base, amounts(dial)[level]))) return level;
  }
  return null;
}

/**
 * One step, down (−1) or up (+1): `{ patch, level }`, or null when there is nowhere to go.
 * From a level it is the next level of the starting theme. From values edited by hand
 * (`level: null`) it is those values, one place along the scale or by one factor.
 */
function dialStep(dial, theme, base, direction) {
  const level = dialLevel(dial, theme, base);
  if (level !== null) {
    const next = level + direction;
    return next < 0 || next > TOP ? null : { patch: dialPatch(dial, base, next), level: next };
  }
  const values = moved(dial, theme, dial.kind === 'shift' ? direction : dial.nudge[direction > 0 ? 1 : 0]);
  if (sameValues(dialValues(dial, theme), values)) return null;
  const patch = dialWrite(dial, values);
  // A step can land on a level again (the hand edit undone, or the bottom reached).
  const family = Object.fromEntries(Object.entries(theme[dial.family]).map(([key, value]) =>
    [key, dial.field && key in values ? { ...value, [dial.field]: values[key] } : key in values ? values[key] : value]));
  return { patch, level: dialLevel(dial, { ...theme, [dial.family]: family }, base) };
}

/** What a step did, for the line under the dials. */
function dialHint(dial, level, direction) {
  const name = `${dial.label} ${level === null ? '' : level}`.trim();
  if (level === null) {
    const word = direction > 0 ? dial.more : dial.less;
    if (dial.kind === 'scale') return `${word}: every ${dial.token} on the page × ${dial.nudge[direction > 0 ? 1 : 0]}, your own edits included.`;
    return `${word}: every ${dial.token}(n) now gives what ${dial.token}(${direction > 0 ? 'n+1' : 'n−1'}) gave on the page, your own edits included.`;
  }
  if (level === HOME) return `${name}: the values of the theme you started from.`;
  if (dial.kind === 'scale') return `${name}: every ${dial.token} is ${dial.times[level]}× what the theme you started from gives, so ${dial.what}.`;
  const by = dial.by[level];
  if (by <= -TOP) return `${name}: ${dial.zero}. Every ${dial.token}(n) gives what ${dial.token}(0) gives.`;
  return `${name}: ${dial.token}(n) gives what ${dial.token}(n${by > 0 ? '+' : '−'}${Math.abs(by)}) gave in the theme you started from, so ${dial.what}.`;
}

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

module.exports = { DIALS, HOME, TOP, dialById, dialPatch, dialLevel, dialStep, dialHint, LOOKS, lookById, lookPatch, lookIsOn, lookOffPatch };
