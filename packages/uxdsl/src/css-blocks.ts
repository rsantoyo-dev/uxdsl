import type { ReferenceDeclaration } from './reference-core';

// The generated theme stylesheet as data before it is text.
//
// Every engine produces rules of one shape — a selector, its declarations, and
// at most one at-rule around it (`@media (min-width: 768px)`,
// `@media (prefers-color-scheme: dark)`). They build these blocks, and this
// module is the one serializer that turns them into CSS, so the string the
// PostCSS plugin inserts, the string `generateThemeCss` returns and the string
// `applyTheme` writes are the same bytes by construction. The reference check
// on a generated theme reads the same blocks as declarations, so the theme
// paths never parse the CSS they just wrote.

/** One generated rule. */
export interface CssBlock {
  selector: string;
  declarations: Array<[property: string, value: string]>;
  /** The at-rule around the rule, as `@<name> <params>`, if any. */
  condition?: string;
}

/** `selector { a: b; c: d; }`, wrapped as `@media … { … }` when the block has a condition. */
export function serializeBlock(block: CssBlock): string {
  const body = `${block.selector} { ${block.declarations.map(([property, value]) => `${property}: ${value};`).join(' ')} }`;
  return block.condition === undefined ? body : `${block.condition} { ${body} }`;
}

export function serializeBlocks(blocks: CssBlock[], separator = '\n'): string {
  return blocks.map(serializeBlock).join(separator);
}

/** The compiled-rule shape every responsive engine returns (`compile*Rules`):
 * one entry per breakpoint that changes something, the base one unconditional. */
export interface ResponsiveRule { minWidth: number | null; values: Record<string, string> }

/** Responsive rules as blocks: the base rule bare, every other breakpoint under
 * `@<atRule> (min-width: <n>px)`. */
export function responsiveBlocks(rules: ResponsiveRule[], selector = ':root', atRule = 'media'): CssBlock[] {
  return rules.map((rule) => ({
    selector,
    declarations: Object.entries(rule.values),
    condition: rule.minWidth === null ? undefined : `@${atRule} (min-width: ${rule.minWidth}px)`,
  }));
}

/** The blocks' declarations as the reference engine reads them, in document order. */
export function blockDeclarations(blocks: CssBlock[]): ReferenceDeclaration[] {
  const out: ReferenceDeclaration[] = [];
  for (const block of blocks) {
    const conditions = block.condition === undefined ? [] : [block.condition];
    for (const [prop, value] of block.declarations) out.push({ prop, value, selector: block.selector, conditions });
  }
  return out;
}
