// What each theme family is for, for /docs/theme.
//
// The LIST of families, their field sets and the base theme's keys are not here: the page
// reads them from the packaged JSON Schema (uxdsl/schema/theme.schema.json, generated from
// the validator's own patterns) and from the base theme (uxdsl/theme/base.json). A family
// the schema gains without a line here — or a line for a family the schema dropped — fails
// the build (describeFamilies throws).

export type FamilyReference = { what: string; consumedBy: string; page?: string }

export const FAMILIES: Record<string, FamilyReference> = {
  breakpoints: { what: 'The viewport widths, in px, where responsive values step. The base (xs) must be 0.', consumedBy: 'xs() … xl() and every responsive value in the theme', page: '/docs/breakpoints' },
  spacing: { what: 'The spacing scale: a key per step, one value each, the same at every width.', consumedBy: 'space(k); densities, radii and typography reference it', page: '/docs/spacing' },
  densities: { what: 'Spacing steps that move at breakpoints: each value is usually a responsive expression over space().', consumedBy: 'density(k); surface sizes', page: '/docs/spacing' },
  colors: { what: 'The color collection: families of shades (gray.50 … gray.950) or single named colors.', consumedBy: 'color(family.shade); palette values reference it', page: '/docs/colors' },
  palette: { what: 'Semantic roles (primary, surface, text, …), each a family of variants (main, light, dark, contrast, …).', consumedBy: 'palette(family.variant); every role and directive', page: '/docs/colors' },
  modes: { what: 'Dark mode: modes.dark.palette redefines palette values, and only those; nothing else has a dark variant.', consumedBy: 'the same palette() references, under prefers-color-scheme and data-theme', page: '/docs/colors' },
  fonts: { what: 'families: the font stacks typography roles name; google: the Google Fonts families to @import ([] opts out).', consumedBy: '--uxdsl__font__name; typography_details', page: '/docs/typography' },
  typography_details: { what: 'Text roles (default, h1 … h6, p, caption, …): each field a CSS value or a responsive expression; default fills the fields a role omits.', consumedBy: '@ds-typo(role)', page: '/docs/typography' },
  borders: { what: 'Whole-edge presets (width, style, color), static or responsive. border(0) is none.', consumedBy: 'border(k); surfaces', page: '/docs/borders' },
  radii: { what: 'Corner presets, static or responsive. radius(0) is square; pill and circle are built in.', consumedBy: 'radius(k); surfaces and sizes', page: '/docs/borders' },
  shadows: { what: 'box-shadow presets, static or responsive, layers allowed. shadow(0) is none.', consumedBy: 'shadow(k); surfaces', page: '/docs/shadows' },
  surfaces: { what: 'Container roles composed from the families above: padding, radius, bg, color, border, shadow.', consumedBy: '@ds-surface(role); buttons and inputs build on a surface', page: '/docs/surfaces' },
  buttons: { what: 'Action roles: a surface, base overrides and per-state fields.', consumedBy: '@ds-button(role)', page: '/docs/buttons' },
  inputs: { what: 'Text-field roles: a surface, base overrides (caret, placeholder, underline …) and per-state fields.', consumedBy: '@ds-input(role)', page: '/docs/inputs' },
}

export function describeFamilies(names: string[]): Array<[string, FamilyReference]> {
  const missing = names.filter((name) => !(name in FAMILIES))
  const extra = Object.keys(FAMILIES).filter((name) => !names.includes(name))
  if (missing.length || extra.length) {
    throw new Error(`/docs/theme is out of date with the theme schema:${missing.length ? ` not described: ${missing.join(', ')}` : ''}${extra.length ? ` described but not in the schema: ${extra.join(', ')}` : ''}`)
  }
  return names.map((name) => [name, FAMILIES[name]])
}
