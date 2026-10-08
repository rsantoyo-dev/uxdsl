// What each value function and directive of the language does, for /docs/language.
//
// The LIST is not here: the page iterates LANGUAGE_COMPLETIONS (uxdsl/language), the same
// metadata the editor extension completes from, and fails the build (`describe()` throws)
// when the language gains a function or directive this file does not describe, or loses one
// it still describes. So the page cannot silently miss a construct.

export type FunctionReference = {
  signature: string
  compilesTo: string
  example: string
  notes: string
}

export const FUNCTIONS: Record<string, FunctionReference> = {
  space: {
    signature: 'space(k)',
    compilesTo: 'var(--uxdsl__space__k)',
    example: 'gap: space(4);',
    notes: 'A step of the spacing scale, the same at every width. k is a key of the theme’s spacing, not a number of pixels.',
  },
  density: {
    signature: 'density(k)',
    compilesTo: 'var(--uxdsl__density__k)',
    example: 'padding: density(4);',
    notes: 'A spacing step that the theme moves at its breakpoints. The preferred way to space a component.',
  },
  color: {
    signature: 'color(family.shade[, alpha])',
    compilesTo: 'var(--uxdsl__color__family-shade)',
    example: 'background: color(gray.300, 0.5);',
    notes: 'A specific color of the collection, for a swatch or an identity. With an alpha (0–1) it compiles to color-mix(… transparent).',
  },
  palette: {
    signature: 'palette(family[.variant][, alpha])',
    compilesTo: 'var(--uxdsl__palette__family-variant)',
    example: 'color: palette(primary.contrast);',
    notes: 'A semantic role; palette(primary) is palette(primary.main). Follows dark mode (modes.dark.palette).',
  },
  radius: {
    signature: 'radius(k | pill | circle)',
    compilesTo: 'var(--uxdsl__radius__k), 9999px, 50%',
    example: 'border-radius: radius(2);',
    notes: 'A corner preset, or one of the two built-in shapes.',
  },
  border: {
    signature: 'border(k)',
    compilesTo: 'var(--uxdsl__border__k)',
    example: 'border: border(1);',
    notes: 'A whole edge (width, style, color). Change the color or style locally with the longhands after it.',
  },
  shadow: {
    signature: 'shadow(k)',
    compilesTo: 'var(--uxdsl__shadow__k)',
    example: 'box-shadow: shadow(2);',
    notes: 'A box-shadow preset; shadow(0) is none.',
  },
}

export type DirectiveReference = {
  signature: string
  example: string
  notes: string
}

export const DIRECTIVES: Record<string, DirectiveReference> = {
  'ds-surface': {
    signature: '@ds-surface(role [tone] [size] [radius(k)] [shadow(k)])',
    example: '.card { @ds-surface(contained); }',
    notes: 'A container role: padding, radius, background, color, border and shadow. A tone swaps its colors for a Palette family; a size picks density(n) and radius(n).',
  },
  'ds-typo': {
    signature: '@ds-typo(role)',
    example: '.title { @ds-typo(h2); }',
    notes: 'A text role from typography_details: one declaration per field the theme defines for it, and nothing else.',
  },
  'ds-button': {
    signature: '@ds-button(role [tone] [size] [radius(k)] [shadow(k)])',
    example: '.save { @ds-button(contained primary); }',
    notes: 'An action role and its states (hover, active, focus, focusvisible, selected, disabled). Hover and active exclude a disabled control.',
  },
  'ds-input': {
    signature: '@ds-input(role [tone] [size] [radius(k)] [shadow(k)])',
    example: '.email { @ds-input(outlined); }',
    notes: 'A text-field role: the surface, caret, placeholder and states (hover, focus, focusvisible, readonly, invalid, disabled).',
  },
}

/** Every listed name described, and nothing described that is not listed. */
export function describe<T>(names: readonly string[], table: Record<string, T>, kind: string): Array<[string, T]> {
  const missing = names.filter((name) => !(name in table))
  const extra = Object.keys(table).filter((name) => !names.includes(name))
  if (missing.length || extra.length) {
    throw new Error(`/docs/language is out of date with LANGUAGE_COMPLETIONS: ${kind} ${missing.length ? `not described: ${missing.join(', ')}` : ''}${extra.length ? ` described but not in the language: ${extra.join(', ')}` : ''}`)
  }
  return names.map((name) => [name, table[name]])
}
