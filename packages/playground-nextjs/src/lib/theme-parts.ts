/**
 * The parts of the theme the Live theme handler (/docs/theme) edits, in order: what each is
 * called and what a visitor does with it. The id is the part's anchor: /docs/theme#surfaces
 * opens Surfaces, and the home page's invitation links to each.
 */
export const THEME_PARTS = [
  { id: 'palette', label: 'Palette', hint: 'Recolor a role, light and dark' },
  { id: 'colors', label: 'Colors', hint: 'The shades the palette draws from' },
  { id: 'breakpoints', label: 'Breakpoints', hint: 'Move where layouts switch' },
  { id: 'spacing', label: 'Spacing & density', hint: 'Let the whole site breathe' },
  { id: 'typography', label: 'Typography', hint: 'Change fonts and the type scale' },
  { id: 'edges', label: 'Borders & radii', hint: 'Round or sharpen every corner' },
  { id: 'shadows', label: 'Shadows', hint: 'Lift or flatten every card' },
  { id: 'surfaces', label: 'Surfaces', hint: 'Restyle every container' },
  { id: 'controls', label: 'Buttons & inputs', hint: 'Every state of every control' },
  { id: 'json', label: 'JSON', hint: 'The whole theme, as one file' },
] as const

export type ThemePartId = (typeof THEME_PARTS)[number]['id']

/** Where the handler starts on its page, and the address of one of its parts. */
export const THEME_HANDLER_HREF = '/docs/theme#editor'
export const themePartHref = (id: ThemePartId) => `/docs/theme#${id}`
