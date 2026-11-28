/**
 * The tabs of the Live theme handler (/docs/theme), in order. The id is the tab's anchor:
 * /docs/theme#surfaces opens the Surfaces tab, and the home page's invitation links to each.
 */
export const THEME_TABS = [
  { id: 'colors', label: 'Colors / Palette' },
  { id: 'breakpoints', label: 'Breakpoints' },
  { id: 'spacing', label: 'Spacing / Density' },
  { id: 'typography', label: 'Typography' },
  { id: 'edges', label: 'Borders / Radii' },
  { id: 'shadows', label: 'Shadows' },
  { id: 'surfaces', label: 'Surfaces' },
  { id: 'controls', label: 'Buttons / Inputs' },
  { id: 'json', label: 'JSON' },
] as const

export type ThemeTabId = (typeof THEME_TABS)[number]['id']

/** Where the handler starts on its page, and the page itself. */
export const THEME_HANDLER_HREF = '/docs/theme#editor'
export const themeTabHref = (id: ThemeTabId) => `/docs/theme#${id}`
