/**
 * The home page's hero feed: one banner per entry, shown in turn. Each banner is a
 * configuration, not a design: a Palette tone for its background, a layout, a Density
 * token for its padding, and which part of the theme it shows. HeroFeed.uxdsl turns each
 * value into UXDSL (a tone is @ds-surface(contained <tone>), a density is density(n)), so
 * adding a banner is adding an entry here, and every banner follows the theme editor.
 */
export type BannerLayout = 'split' | 'reverse' | 'stacked'
export type BannerShow = 'palette' | 'type' | 'density' | 'roles' | 'responsive'

export type Banner = {
  id: string
  /** A Palette family used as @ds-surface(contained <tone>): primary, secondary, dark, light, surface… */
  tone: string
  layout: BannerLayout
  /** The Density token of the banner's padding, density(n). */
  density: number
  show: BannerShow
  eyebrow: string
  title: string
  text: string
}

export const BANNERS: Banner[] = [
  {
    id: 'palette',
    tone: 'primary',
    layout: 'split',
    density: 6,
    show: 'palette',
    eyebrow: 'palette()',
    title: 'One theme, every color',
    text: 'Each role has a light, a main and a dark variant, and the contrast text that reads on them. Components name the role; the theme decides the color, in light and dark mode.',
  },
  {
    id: 'type',
    tone: 'surface',
    layout: 'reverse',
    density: 5,
    show: 'type',
    eyebrow: '@ds-typo()',
    title: 'Type that steps with the screen',
    text: 'A text role holds its font, size, weight and line height, and how they change at each breakpoint. Write @ds-typo(h1) and the heading follows the theme.',
  },
  {
    id: 'density',
    tone: 'secondary',
    layout: 'stacked',
    density: 6,
    show: 'density',
    eyebrow: 'density()',
    title: 'Spacing that breathes',
    text: 'A Density token is spacing with a progression: tight on a phone, roomier on a laptop. The boxes below are density(2), (4) and (6), live.',
  },
  {
    id: 'roles',
    tone: 'dark',
    layout: 'split',
    density: 6,
    show: 'roles',
    eyebrow: '@ds-button() · @ds-surface()',
    title: 'Roles, not recipes',
    text: 'A button, a field or a card is one line: the role brings padding, corners, colors, border, shadow and every state from the theme.',
  },
  {
    id: 'responsive',
    tone: 'light',
    layout: 'reverse',
    density: 5,
    show: 'responsive',
    eyebrow: 'xs() md() lg()',
    title: 'Breakpoints belong to the theme',
    text: 'Write xs(column) md(row) and the layout changes at the theme’s md. Move md in the theme and every component moves with it.',
  },
]
