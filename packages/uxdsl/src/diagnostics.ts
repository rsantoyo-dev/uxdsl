import type { Node } from 'postcss';

const CODE_PATTERN = /^(UXD_[A-Z0-9_]+):/;

/** Who produces a code: the PostCSS compiler, the theme validator and engines
 * (both CSS paths), the browser runtime (returned on a result, never thrown),
 * or `uxdsl-core`'s SCSS-subset pass. */
export type DiagnosticOwner = 'compiler' | 'theme' | 'runtime' | 'core';

export interface DiagnosticEntry {
  /** One line: what the code means. */
  meaning: string;
  /** One line: what to do about it. */
  fix: string;
  owner: DiagnosticOwner;
}

const entry = (owner: DiagnosticOwner, meaning: string, fix: string): DiagnosticEntry => Object.freeze({ owner, meaning, fix });
const compiler = (meaning: string, fix: string) => entry('compiler', meaning, fix);
const theme = (meaning: string, fix: string) => entry('theme', meaning, fix);
const runtime = (meaning: string, fix: string) => entry('runtime', meaning, fix);
const core = (meaning: string, fix: string) => entry('core', meaning, fix);

/** The per-family codes the preset engine composes (`<FAMILY>_MAP`, `_VALUE`, …). */
function presetFamily(owner: DiagnosticOwner, prefix: string, what: string, path: string): Record<string, DiagnosticEntry> {
  return {
    [`${prefix}_MAP`]: entry(owner, `\`${path}\` is not an object of ${what} tokens.`, `Write \`${path}\` as { "key": "value" }.`),
    [`${prefix}_VALUE`]: entry(owner, `A ${what} token's value is empty, not a string, has unclosed parentheses or names a breakpoint the theme does not have.`, 'Give the token a nonempty CSS value or responsive expression over the theme\'s breakpoints.'),
    [`${prefix}_BASE`]: entry(owner, `A responsive ${what} token has no value at the base breakpoint.`, 'Add the base breakpoint\'s group, e.g. xs(…), so every width has a value.'),
    [`${prefix}_NAME_COLLISION`]: entry(owner, `Two different ${what} keys compile to the same CSS custom property name.`, 'Rename one of the two keys.'),
    [`${prefix}_VIEWPORT`]: entry(owner, `inspect*Theme was given a width that is not a non-negative number.`, 'Pass a viewport width in pixels, 0 or more.'),
  };
}

/**
 * The frozen catalog of every `UXD_*` code — one line of meaning and one line
 * of fix each — that the compiler, the theme validator and engines, the
 * browser runtime and `uxdsl-core` can produce. A code is produced only if it
 * is listed here (`diagnostic()` refuses an uncatalogued one), and
 * `test/diagnostics-catalog.test.js` keeps the list exact: every code the
 * sources emit is in it, every entry is emitted somewhere and asserted by a
 * test. The playground's /docs/diagnostics page renders this object.
 */
export const DIAGNOSTIC_CATALOG: Readonly<Record<string, DiagnosticEntry>> = Object.freeze({
  // --- the theme (validateTheme and the engines; both CSS paths) ---------------
  UXD_THEME_INVALID: theme('A theme leaf or key is structurally wrong: a value that is not a nonempty string, a closed key, a name outside ^[a-z][a-z0-9-]*$, a `;`/`{`/`}` or unbalanced parentheses in a value, or the removed flat `typography` family.', 'Fix the value at the key path the message names; strings only, lowercase names, text roles under `typography_details`.'),
  UXD_THEME_FAMILY: theme('A top-level theme key is not a family the compiler reads (a warning: nothing compiles it).', 'Check the spelling against KNOWN_THEME_FAMILIES, or remove the key.'),
  UXD_SPACING_KEY: theme('A `spacing` key uses the removed `space-` prefix.', 'Write the bare key: "1" instead of "space-1"; it is referenced as space(1).'),
  UXD_FOUNDATION_NAME_COLLISION: theme('Two Palette, Color or Spacing entries compile to the same CSS custom property name.', 'Rename one of the two entries.'),
  UXD_BP_INVALID: theme('The breakpoint map is invalid: no zero-width base, a negative or non-finite width, or two breakpoints with the same width.', 'Give `breakpoints` one entry at 0 and distinct non-negative pixel widths.'),
  UXD_VALUE: theme('A responsive expression is empty, unclosed, or uses a function that is neither a breakpoint nor a known CSS function.', 'Write `xs(…) md(…)` over the theme\'s breakpoint names around CSS values.'),
  UXD_DENSITY_MAP: theme('`densities` is not an object.', 'Write `densities` as { "key": "xs(space(1)) md(space(2))" }.'),
  UXD_DENSITY_VALUE: theme('A Density token\'s value is empty, not a string or contains `;`/`{`/`}`.', 'Give the token a nonempty responsive expression over Spacing.'),
  UXD_DENSITY_KEY: theme('A Density key is not a plain identifier.', 'Use letters, digits, hyphens and underscores.'),
  UXD_DENSITY_BASE: theme('A Density token has no value at the base breakpoint.', 'Add the base group, e.g. xs(space(1)).'),
  UXD_TYPO_DETAILS: theme('`typography_details` is not an object of roles.', 'Write `typography_details` as { "role": { "fontSize": "…" } }.'),
  UXD_TYPO_ROLE: theme('A typography role name is not lowercase-with-hyphens or its value is not an object.', 'Name the role ^[a-z][a-z0-9-]*$ and give it an object of fields.'),
  UXD_TYPO_FIELD: theme('A typography field is not one of fontFamily, fontSize, lineHeight, fontWeight, letterSpacing, textTransform, textDecoration, fontStyle, marginBlockStart, marginBlockEnd, or its value is empty.', 'Use one of the ten fields with a nonempty string value.'),
  UXD_TYPO_BASE: theme('A responsive typography field has no value at the base breakpoint.', 'Add the base group, e.g. xs(space(7)).'),
  UXD_SURFACE_ROLE: theme('A Surface role name is not lowercase-with-hyphens or its value is not an object.', 'Name the role ^[a-z][a-z0-9-]*$ and give it an object of fields.'),
  UXD_SURFACE_FIELD: theme('A Surface field is not one of padding, radius, bg, color, border, shadow.', 'Use one of the six fields.'),
  UXD_SURFACE_SIZE: theme('A directive\'s numeric size names a key that Density or Radius does not define.', 'Use a size both `densities` and `radii` define, or omit it.'),
  UXD_SURFACE_TONE: theme('The tone named by @ds-surface is not a Palette family with main, dark and contrast.', 'Name a tone family (the message lists them), or omit the tone.'),
  UXD_SURFACE_ARGUMENT: compiler('@ds-surface is not written as @ds-surface(role [tone] [size] [radius(k)] [shadow(k)]).', 'Put the parentheses directly after the name, separate arguments with spaces, the role first, each override once.'),
  UXD_SURFACE_REFERENCE: theme('@ds-surface or a Surface value names a role, radius, border or shadow that does not exist.', 'Use a defined role or token; the message lists what exists.'),
  ...presetFamily('theme', 'UXD_SURFACE', 'Surface', 'surfaces'),
  ...presetFamily('theme', 'UXD_EDGE', 'Border/Radius', 'borders / radii'),
  UXD_EDGE_REFERENCE: compiler('radius(k) or border(k) names a token the theme does not define.', 'Use a defined key or the keywords pill/circle; the message lists them.'),
  UXD_EDGE_ARGUMENT: compiler('radius() or border() was given more than one argument.', 'Write radius(k) / border(k); set border-color or border-style as declarations after border: border(k).'),
  ...presetFamily('theme', 'UXD_SHADOW', 'Shadow', 'shadows'),
  UXD_SHADOW_REFERENCE: compiler('shadow(k) names a token the theme does not define.', 'Use a defined shadow key; the message lists them.'),
  UXD_SHADOW_ARGUMENT: compiler('shadow() was given more than one argument.', 'Write shadow(k).'),
  ...controlFamily('UXD_BUTTON', 'Button', 'buttons', '@ds-button'),
  ...controlFamily('UXD_INPUT', 'Input', 'inputs', '@ds-input'),
  UXD_TONE_CONTEXT: theme('tone() appears outside a Button or Input theme value.', 'Use tone(main|dark|contrast) only in `buttons`/`inputs` values; in a stylesheet name the tone through @ds-button(role tone).'),
  // --- the compiler (author declarations and directives) ---------------------
  UXD_TOKEN_KEY: compiler('A token function\'s key is quoted, contains a dot where none is allowed, or is not a bare word.', 'Write the key as a bare word: space(1), density(section).'),
  UXD_TOKEN_ALPHA: compiler('The alpha of palette() or color() is not a number between 0 and 1.', 'Write palette(primary, 0.5) with an alpha from 0 to 1.'),
  UXD_SPACE_ARGUMENT: compiler('space() was given no argument or more than one.', 'Write space(k).'),
  UXD_SPACE_REFERENCE: compiler('space(k) names a Spacing key the theme does not define.', 'Use a defined key; the message lists them and suggests a close one.'),
  UXD_DENSITY_ARGUMENT: compiler('density() was given no argument or more than one.', 'Write density(k).'),
  UXD_DENSITY_REFERENCE: compiler('density(k) names a Density key the theme does not define.', 'Use a defined key; the message lists them.'),
  UXD_PALETTE_ARGUMENT: compiler('palette() was given no argument or more than a key and an alpha.', 'Write palette(family[.variant][, alpha]).'),
  UXD_PALETTE_REFERENCE: compiler('palette() names a family or variant the theme does not define.', 'Use a defined family and variant; the message lists them and suggests a close one.'),
  UXD_PALETTE_SYNTAX: compiler('A palette() argument uses the removed dashed spelling or is not family[.variant].', 'Write palette(family.variant), e.g. palette(primary.main).'),
  UXD_COLOR_ARGUMENT: compiler('color() was given no argument or more than a key and an alpha.', 'Write color(family[.shade][, alpha]).'),
  UXD_COLOR_REFERENCE: compiler('color() names a family or shade the theme does not define.', 'Use a defined family and shade; the message lists them.'),
  UXD_COLOR_SYNTAX: compiler('A color() argument uses the removed dashed spelling or is not family[.shade].', 'Write color(family.shade), e.g. color(gray.300).'),
  UXD_SYNTAX_REMOVED: compiler('A spelling the language removed: rounded(), elevation(), densities() or radius(full).', 'Write radius(k), shadow(k), density(k) or radius(pill); the message names the replacement.'),
  UXD_THEME_BLOCK_REMOVED: compiler('A `@theme { … }` block: in-stylesheet token packs were removed.', 'Define the tokens in the theme JSON under densities, radii, borders, shadows, surfaces, buttons or inputs.'),
  UXD_OPTION_REMOVED: compiler('A plugin option that no longer exists was passed (a warning; the option is ignored).', 'Remove the option; breakpoints live in the theme and variable names are the --uxdsl__ contract.'),
  UXD_DIRECTIVE_UNKNOWN: compiler('An at-rule in the reserved ds/ds-* namespace is not one of the four directives.', 'Use @ds-surface, @ds-button, @ds-input or @ds-typo; the message suggests the closest.'),
  UXD_DIRECTIVE_CONTEXT: compiler('A directive is not a direct child of the rule it styles (at the root, or under @media/@supports).', 'Move the directive into the rule; put responsive expressions on individual properties instead.'),
  UXD_DIRECTIVE_DUPLICATE: compiler('A second @ds-button or @ds-input in the same rule would emit competing states.', 'Keep one control directive per rule, or split the selectors.'),
  UXD_TYPO_ARGUMENT: compiler('@ds-typo is not written as @ds-typo(role).', 'Write exactly one bare role inside parentheses directly after the name.'),
  UXD_TYPO_REFERENCE: compiler('@ds-typo names a typography role the theme does not define.', 'Use a defined role; the message lists them.'),
  UXD_BREAKPOINT_UNKNOWN: compiler('A top-level function is neither a configured breakpoint nor a known CSS function, next to a real breakpoint or one edit away from one.', 'Use a breakpoint name the theme defines; the message lists them.'),
  UXD_BREAKPOINT_CONTEXT: compiler('A breakpoint function is nested inside another function or breakpoint, or a responsive value sits under @keyframes/@font-face/@page/@counter-style.', 'Write the breakpoint functions at the top level of the value, with the inner function in each group; outside those at-rules, set the responsive value on a custom property.'),
  UXD_BREAKPOINT_EMPTY: compiler('A breakpoint function has no value, e.g. xs().', 'Write the value inside the parentheses, or remove the breakpoint.'),
  UXD_BREAKPOINT_IMPORTANT: compiler('`!important` appears inside a breakpoint group.', 'Put `!important` after the groups; it then applies at every breakpoint.'),
  UXD_BREAKPOINT_BASE: compiler('In a multi-part value, a responsive group has no value at the base breakpoint, so the value would change shape between widths.', 'Give the group a base, e.g. xs(…), or make the whole value one responsive expression.'),
  UXD_VARIABLE_CONTEXT: compiler('A `$variable` is declared inside a rule, which the standalone plugin does not scope.', 'Declare it at the root of the file, or compile through uxdsl-core / uxdsl build.'),
  UXD_VARIABLE_UNDEFINED: compiler('A `$name` in a value was never declared.', 'Declare `$name: …;` at the root of the file before the rule.'),
  UXD_REFERENCE_MISSING: compiler('An emitted var(--uxdsl__…) points at a custom property nothing defines.', 'Define the token in the theme, declare it in references.externalTokens, or fix the name; the message names the chain.'),
  UXD_REFERENCE_CYCLE: compiler('Theme tokens reference each other in a cycle.', 'Break the cycle; the message shows the chain.'),
  UXD_REFERENCE_CONTEXT: compiler('A token is referenced from a scope (a mode) where it is not defined.', 'Define the token in that scope too, or reference one defined in every scope.'),
  // --- the browser runtime (returned on a ThemeResult, never thrown) -----------
  UXD_THEME_ENVIRONMENT: runtime('applyTheme, loadPersistedTheme or resetTheme was called where there is no document.', 'Call them in the browser; use generateThemeCss on the server.'),
  UXD_THEME_NOT_INITIALIZED: runtime('loadPersistedTheme or resetTheme ran before the project theme was applied once.', 'Call applyTheme(projectOverride, { replace: true }) first.'),
  UXD_THEME_STYLE_ID: runtime('A second styleId was given after the runtime was initialized with another.', 'Keep one styleId per document.'),
  UXD_THEME_STYLE_ELEMENT: runtime('The element with the requested id is not a <style>.', 'Use an id that is free or belongs to a <style> element.'),
  UXD_THEME_STRUCTURE: runtime('The patch changes what the compiler would emit (a field, state, surface or breakpoint), which custom properties cannot express.', 'Change the theme file and rebuild; apply values, not structure, at run time.'),
  UXD_THEME_PERSIST: runtime('Browser storage could not be read, written or cleared.', 'Check storage availability; the theme was still applied.'),
  // --- uxdsl-core (the SCSS subset) --------------------------------------------
  UXD_SCSS_UNSUPPORTED: core('A Sass construct outside the subset was left in the stylesheet: @extend, @use, a %placeholder, !global, a Sass function, interpolation around a non-variable, an unresolved $var, or arithmetic outside calc().', 'Write the CSS the message names instead; the subset is $variables, @if/@else, @each, @for, @mixin/@include, @import.'),
  UXD_NESTING_INVALID: core('A selector concatenates the parent with &-suffix, &__x or &--x, which native CSS nesting cannot express.', 'Write the full selector, e.g. .block__item.'),
  UXD_IMPORT_CYCLE: core('Two or more .uxdsl files import each other in a cycle.', 'Break the cycle; the message lists the files in order.'),
  UXD_INCLUDE_ARGUMENT: core('An @include has unbalanced parentheses in its arguments.', 'Balance the parentheses: @include name(arg, arg).'),
});

/** The Button/Input codes the control engine composes from one template. */
function controlFamily(prefix: string, what: string, path: string, directive: string): Record<string, DiagnosticEntry> {
  return {
    ...presetFamily('theme', prefix, what, path),
    [`${prefix}_ROLE`]: theme(`A ${what} role is not lowercase-with-hyphens, is not an object, or ${directive} names a role the theme does not define.`, `Name the role ^[a-z][a-z0-9-]*$ in \`${path}\`, and use a defined role in ${directive}.`),
    [`${prefix}_FIELD`]: theme(`A ${what} field is not one of the supported fields, or a role key is not surface, base or states.`, 'Use the documented fields and the three role keys.'),
    [`${prefix}_FIELDS`]: theme(`A ${what} base or state is not an object of fields.`, 'Write base and each state as { "field": "value" }.'),
    [`${prefix}_SURFACE`]: theme(`A ${what} role names a Surface that does not exist.`, 'Name a defined Surface role in `surface`.'),
    [`${prefix}_STATES`]: theme(`A ${what} role's states is not an object.`, 'Write states as { "hover": { … } }.'),
    [`${prefix}_STATE`]: theme(`A ${what} state is not one of the supported states.`, 'Use the documented state names (e.g. hover, focusvisible, disabled).'),
    [`${prefix}_TONE`]: theme(`The tone named by ${directive}, or a tone() variant in a ${what} value, is not valid.`, 'Name a Palette family with main, dark and contrast, and write tone(main|dark|contrast).'),
    [`${prefix}_ARGUMENT`]: compiler(`${directive} is not written as ${directive}(role [tone] [size] [radius(k)] [shadow(k)]).`, 'Put the parentheses directly after the name, separate arguments with spaces, the role first, each override once.'),
  };
}

/** The codes of the catalog, for membership checks. */
export const DIAGNOSTIC_CODES: ReadonlySet<string> = new Set(Object.keys(DIAGNOSTIC_CATALOG));

export function diagnostic(message: string, word?: string): Error {
  // The catalog is the registry: a code it does not list is a programming
  // error here, never a message a user has to search for in vain.
  const code = message.match(CODE_PATTERN)?.[1];
  if (code && !DIAGNOSTIC_CODES.has(code)) throw new Error(`uxdsl: diagnostic ${code} is not in DIAGNOSTIC_CATALOG`);
  const error = new Error(message);
  if (word) (error as any).word = word;
  return error;
}

export function themeError(code: string, message: string, keyPath: string): Error {
  const error = diagnostic(`${code}: ${message} (at ${keyPath}).`);
  (error as any).keyPath = keyPath;
  return error;
}

export function diagnosticCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  return error.message.match(CODE_PATTERN)?.[1];
}

export function locateError(error: unknown, node: Node | undefined): unknown {
  if (!(error instanceof Error) || !diagnosticCode(error) || (error as any).keyPath || error.name === 'CssSyntaxError' || error.name === 'ReferenceIntegrityError') {
    return error;
  }

  let located: any = node;
  while (located && !(located.source?.input && located.source.start)) located = located.parent;
  if (!located) return error;

  const wrapped: any = located.error(error.message, {
    plugin: 'uxdsl',
    ...((error as any).word ? { word: (error as any).word } : {}),
  });
  wrapped.cause = error;
  return wrapped;
}

export function formatKeyList(keys: Iterable<string>): string {
  const all = Array.from(new Set(Array.from(keys, String)));
  const numeric = all.filter(key => /^\d+$/.test(key)).map(Number).sort((left, right) => left - right);
  const named = all.filter(key => !/^\d+$/.test(key)).sort();
  const parts: string[] = [];
  for (let index = 0; index < numeric.length;) {
    let end = index;
    while (end + 1 < numeric.length && numeric[end + 1] === numeric[end] + 1) end++;
    if (end - index >= 2) parts.push(`${numeric[index]}–${numeric[end]}`);
    else for (let current = index; current <= end; current++) parts.push(String(numeric[current]));
    index = end + 1;
  }
  return [...parts, ...named].join(', ') || '(none)';
}

// Exported so index.ts's UXD_BREAKPOINT_UNKNOWN check
// can require an exact distance of 1 (a typo of a specific breakpoint name)
// rather than closestKey's own ≤2 threshold, which is right for a longer
// token key but too loose for short 2-3 letter breakpoint names like `lg`.
export function editDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= right.length; column++) rows[0][column] = column;
  for (let row = 1; row <= left.length; row++) {
    for (let column = 1; column <= right.length; column++) {
      const substitution = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + substitution,
      );
    }
  }
  return rows[left.length][right.length];
}

export function closestKey(key: string, keys: Iterable<string>): string | undefined {
  let closest: string | undefined;
  let distance = 3;
  for (const candidate of Array.from(keys)) {
    const candidateDistance = editDistance(key.toLowerCase(), candidate.toLowerCase());
    if (candidateDistance > 2 || candidateDistance >= distance) continue;
    closest = candidate;
    distance = candidateDistance;
  }
  return closest;
}

export function missingKeyMessage(code: string, functionName: string, key: string, keys: Iterable<string>): string {
  const available = Array.from(keys, String);
  const suggestion = /^\d+$/.test(key) ? undefined : closestKey(key, available);
  return `${code}: ${functionName}(${key}) does not exist; available keys: ${formatKeyList(available)}.${suggestion ? ` Did you mean "${suggestion}"?` : ''}`;
}