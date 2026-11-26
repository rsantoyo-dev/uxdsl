// The Live theme handler's quick looks: one click, one theme patch, the whole page changes.
//
// Each look is a patch built from the theme on the page, so looks compose (Rounder, then
// Ocean brand) and each one is a value change only: no field, state or breakpoint the
// compiled CSS does not already have, so applyTheme takes it live. The tests check that for
// every look over every named theme, and that none adds a contrast failure.
//
// Plain JS so `scripts/test-quick-looks.cjs` can test it with node:test.

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => String(from + index));

/** Every token of `keys` set to `value(key)`. */
const each = (keys, value) => Object.fromEntries(keys.map((key) => [key, value(key)]));

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
    label: 'Sharp & flat',
    hint: 'Square corners and no shadows: radius(1–5) to 0, shadow(1–5) to none.',
    patch: () => ({ radii: each(range(1, 5), () => '0'), shadows: each(range(1, 5), () => 'none') }),
  },
  {
    id: 'compact',
    label: 'Compact',
    hint: 'Every density one step tighter: density(n) takes what density(n−1) gave.',
    patch: (theme) => ({ densities: each(range(2, 15).filter((key) => theme.densities?.[String(Number(key) - 1)]), (key) => theme.densities[String(Number(key) - 1)]) }),
  },
  {
    id: 'roomy',
    label: 'Roomy',
    hint: 'Every density one step looser: density(n) takes what density(n+1) gave.',
    patch: (theme) => ({ densities: each(range(1, 14).filter((key) => theme.densities?.[String(Number(key) + 1)]), (key) => theme.densities[String(Number(key) + 1)]) }),
  },
  {
    id: 'ocean',
    label: 'Ocean brand',
    hint: 'primary from the blue shades, in light and dark mode: every primary button, link and accent follows.',
    patch: brand('blue'),
  },
  {
    id: 'teal',
    label: 'Teal brand',
    hint: 'primary from the teal shades, in light and dark mode.',
    patch: brand('teal'),
  },
  {
    id: 'deeper',
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
];

/** The look with this id, or undefined. */
const lookById = (id) => LOOKS.find((look) => look.id === id);

module.exports = { LOOKS, lookById };
