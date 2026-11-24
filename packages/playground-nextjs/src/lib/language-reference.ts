// What each value function and directive of the language does, for /docs/language.
//
// The page shows these tables in the order written here, the order a reader meets the
// constructs in. Which names exist is not decided here: `describe()` compares each table
// with LANGUAGE_COMPLETIONS (uxdsl/language), the metadata the editor extension completes
// from, and fails the build when the language gains a function or directive this file does
// not describe, or loses one it still describes. So the page cannot silently miss a construct.

export type FunctionReference = {
  signature: string
  example: string
  notes: string
}

export const FUNCTIONS: Record<string, FunctionReference> = {
  space: {
    signature: 'space(k)',
    example: 'gap: space(4);',
    notes: 'A step of the spacing scale, the same at every width.',
  },
  density: {
    signature: 'density(k)',
    example: 'padding: density(4);',
    notes: 'Spacing that changes at the theme’s breakpoints. The usual choice for a component’s padding and gap.',
  },
  palette: {
    signature: 'palette(family.variant)',
    example: 'color: palette(primary.contrast);',
    notes: 'A color by its role: primary, surface, error. It changes with dark mode. palette(primary) is palette(primary.main).',
  },
  color: {
    signature: 'color(family.shade)',
    example: 'background: color(gray.300);',
    notes: 'One exact color of the theme’s collection, the same in both modes. For when the color itself is the point, such as a swatch.',
  },
  radius: {
    signature: 'radius(k)',
    example: 'border-radius: radius(2);',
    notes: 'A corner preset. radius(pill) and radius(circle) are built in: 9999px and 50%.',
  },
  border: {
    signature: 'border(k)',
    example: 'border: border(1);',
    notes: 'A whole edge: width, style and color. To change one of them in a rule, write border-color or border-style after it.',
  },
  shadow: {
    signature: 'shadow(k)',
    example: 'box-shadow: shadow(2);',
    notes: 'A box-shadow preset. shadow(0) is none.',
  },
}

export type DirectiveReference = {
  signature: string
  example: string
  notes: string
}

export const DIRECTIVES: Record<string, DirectiveReference> = {
  'ds-surface': {
    signature: '@ds-surface(role)',
    example: '.card { @ds-surface(contained); }',
    notes: 'A container: padding, corners, background, text color, border and shadow.',
  },
  'ds-typo': {
    signature: '@ds-typo(role)',
    example: '.title { @ds-typo(h2); }',
    notes: 'A text style: the font, size, weight, line height and margins the theme defines for that role.',
  },
  'ds-button': {
    signature: '@ds-button(role)',
    example: '.save { @ds-button(contained); }',
    notes: 'A button with its states: hover, keyboard focus, selected and disabled.',
  },
  'ds-input': {
    signature: '@ds-input(role)',
    example: '.email { @ds-input(outlined); }',
    notes: 'A text field: its surface, caret and placeholder, with the focus, invalid and disabled states.',
  },
}

/** The table's entries in its own order, once it describes exactly the listed names. */
export function describe<T>(names: readonly string[], table: Record<string, T>, kind: string): Array<[string, T]> {
  const missing = names.filter((name) => !(name in table))
  const extra = Object.keys(table).filter((name) => !names.includes(name))
  if (missing.length || extra.length) {
    throw new Error(`/docs/language is out of date with LANGUAGE_COMPLETIONS: ${kind} ${missing.length ? `not described: ${missing.join(', ')}` : ''}${extra.length ? ` described but not in the language: ${extra.join(', ')}` : ''}`)
  }
  return Object.entries(table)
}
