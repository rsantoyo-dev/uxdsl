// What the "Use it in your project" block at the end of every tab of the Live theme handler
// shows (UsageExample.tsx): the selection written as a stylesheet, and the part of
// uxdsl.theme.json that defines it. Built from the theme on the page, so it is always what
// the page is showing.
//
// Every stylesheet here is compiled by `scripts/test-usage-snippets.cjs` through the real
// PostCSS plugin against every named theme: an example on this page is code that builds.
//
// Plain JS so the test can require it with node:test.

const { themeFileText } = require('./theme-download.js');
const { colorValue, colorPatch } = require('./color-editing.js');

const css = (lines) => lines.join('\n');

/** The family's light value and, when the theme sets one, its dark-mode value. */
function paletteExcerpt(theme, family) {
  const excerpt = { palette: { [family]: theme?.palette?.[family] ?? {} } };
  const dark = theme?.modes?.dark?.palette?.[family];
  if (dark) excerpt.modes = { dark: { palette: { [family]: dark } } };
  return excerpt;
}

function paletteUsage(theme, family) {
  const variants = Object.keys(theme?.palette?.[family] || {});
  const first = variants[0] || 'main';
  const stylesheet = variants.includes('main') && variants.includes('contrast')
    ? css([
      '.cta {',
      `  background: palette(${family}.main);`,
      `  color: palette(${family}.contrast);`,
      '}',
      '',
      '.cta:hover {',
      `  background: palette(${family}${variants.includes('dark') ? '.dark' : '.main, 0.85'});`,
      '}',
      '',
      '.badge {',
      `  background: palette(${family}.main, 0.15);`,
      `  color: palette(${family}.main);`,
      '}',
    ])
    : family === 'text'
      ? css(['.muted {', `  color: palette(text.${variants.includes('secondary') ? 'secondary' : first});`, '}'])
      : css(['.rule {', `  border-bottom: 1px solid palette(${family}.${first});`, '}']);
  return { stylesheet, excerpt: paletteExcerpt(theme, family) };
}

function breakpointsUsage(breakpoints) {
  return {
    stylesheet: css([
      '.layout {',
      '  display: flex;',
      '  flex-direction: xs(column) md(row);',
      '  gap: density(3);',
      '}',
      '',
      '@media (--lg) {',
      '  .layout > * {',
      '    flex: 1;',
      '  }',
      '}',
    ]),
    excerpt: { breakpoints },
  };
}

function densityUsage(theme, key) {
  return {
    stylesheet: css([
      '.card {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      `  gap: density(${key});`,
      `  padding: density(${key});`,
      '}',
    ]),
    excerpt: { densities: { [key]: theme?.densities?.[key] ?? '' } },
  };
}

function spacingUsage(theme, key) {
  return {
    stylesheet: css(['.icon {', `  width: space(${key});`, `  height: space(${key});`, '}']),
    excerpt: { spacing: { [key]: theme?.spacing?.[key] ?? '' } },
  };
}

// A class a project would give the text that wears each role, so the example for `caption`
// is not a page title.
const TYPOGRAPHY_SELECTORS = {
  h1: 'page-title',
  h2: 'section-title',
  h3: 'card-title',
  h4: 'card-title',
  h5: 'card-title',
  h6: 'card-title',
  p: 'lead',
  body: 'article',
  'body-sm': 'note',
  subtitle2: 'eyebrow',
  small: 'fine-print',
  caption: 'caption',
  span: 'label',
  tag: 'tag',
  code: 'snippet',
  pre: 'snippet',
};

/** The selector the Typography example writes for a role (a role added in the JSON tab gets `.text`). */
const typographySelector = (role) => `.${TYPOGRAPHY_SELECTORS[role] || 'text'}`;

function typographyUsage(theme, role) {
  const excerpt = { typography_details: { [role]: theme?.typography_details?.[role] ?? {} } };
  return { stylesheet: css([`${typographySelector(role)} {`, `  @ds-typo(${role});`, '}']), excerpt };
}

/** A shade used for itself, plain and translucent. `key` is `family.shade`, or a name such as `white`. */
function colorsUsage(theme, key) {
  return {
    stylesheet: css(['.swatch {', `  background: color(${key});`, '}', '', '.scrim {', `  background: color(${key}, 0.5);`, '}']),
    excerpt: colorPatch(key, colorValue(theme?.colors, key) ?? ''),
  };
}

function edgeUsage(theme, kind, key) {
  const property = kind === 'borders' ? 'border' : 'border-radius';
  const fn = kind === 'borders' ? 'border' : 'radius';
  const lines = ['.card {', `  ${property}: ${fn}(${key});`, '}'];
  if (kind === 'borders') lines.push('', '/* One card dashed, the shared edge kept: a longhand after it. */', '.card.is-draft {', '  border-style: dashed;', '}');
  return { stylesheet: css(lines), excerpt: { [kind]: { [key]: theme?.[kind]?.[key] ?? '' } } };
}

function shadowUsage(theme, key) {
  return {
    stylesheet: css(['.card {', `  box-shadow: shadow(${key});`, '}']),
    excerpt: { shadows: { [key]: theme?.shadows?.[key] ?? '' } },
  };
}

const directiveArgs = (role, tone) => (tone ? `${role} ${tone}` : role);

function surfaceUsage(theme, role, tone) {
  return {
    stylesheet: css(['.card {', `  @ds-surface(${directiveArgs(role, tone)});`, '}']),
    excerpt: { surfaces: { [role]: theme?.surfaces?.[role] ?? {} } },
  };
}

function controlUsage(theme, family, role, tone) {
  const stylesheet = family === 'buttons'
    ? css(['.save {', `  @ds-button(${directiveArgs(role, tone)});`, '}'])
    : css(['.email {', `  @ds-input(${directiveArgs(role, tone)});`, '}']);
  return { stylesheet, excerpt: { [family]: { [role]: theme?.[family]?.[role] ?? {} } } };
}

/** The JSON tab's ending: the whole way from this page to a project. */
function projectUsage(theme) {
  return {
    file: themeFileText(theme),
    stylesheet: css([
      '@uxdsl theme;',
      '',
      '.card {',
      '  @ds-surface(contained);',
      '}',
      '',
      '.save {',
      '  @ds-button(contained primary);',
      '}',
    ]),
    build: 'npx uxdsl build',
    runtime: css([
      "import { applyTheme } from 'uxdsl/runtime'",
      "import theme from './uxdsl.theme.json'",
      '',
      '// Once, with the theme you built with.',
      'applyTheme(theme, { replace: true })',
    ]),
  };
}

module.exports = {
  paletteUsage,
  breakpointsUsage,
  colorsUsage,
  densityUsage,
  spacingUsage,
  typographyUsage,
  typographySelector,
  edgeUsage,
  shadowUsage,
  surfaceUsage,
  controlUsage,
  projectUsage,
};
