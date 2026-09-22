// MIG-B6-30 (FEAT-008): what a runtime theme patch may and may not change.
//
// `applyTheme` replaces one managed `<style>` element holding the generated
// theme CSS. That covers every custom property — values, mode palettes, new
// tokens. What it cannot touch is the CSS a *build* already produced for the
// host's own components: the declarations `@ds-surface`/`@ds-button`/
// `@ds-input`/`@ds-typo` expanded into their rules, and the `@media` queries
// baked into responsive declarations written in component files. Those live in
// the host's compiled stylesheet, which this library never sees.
//
// So a patch that changes only values is safe, and a patch that changes *which
// declarations a directive would emit* is not: the compiled rules would keep
// the old shape while the tokens moved under them. Rather than guess, the
// signature below asks the very functions the compiler emits with —
// `buttonDeclarations`, `inputDeclarations`, `surfaceDeclarations`,
// `resolveTypographyRole` — what each role expands to, and records the property
// *names* while ignoring their values. There is no second interpretation of the
// theme here, which is the point: a field added to an engine shows up in the
// signature without anyone updating this file.
import { buttonDeclarations, getButtonTokens } from '../buttons';
import { inputDeclarations, getInputTokens } from '../inputs';
import { surfaceDeclarations, getSurfaceTokens } from '../surfaces';
import { resolveTypographyRole } from '../typography';
import { getToneFamilies, DEFAULT_BREAKPOINTS } from '../language';

/** One control role's emitted shape: which Surface it composes from, which
 * properties its base rule carries, and which properties each state rule does. */
export interface ControlStructure {
  surface: string;
  base: string[];
  states: Record<string, string[]>;
}

export interface ThemeStructure {
  breakpoints: Record<string, number>;
  typography: Record<string, string[]>;
  surfaces: Record<string, string[]>;
  buttons: Record<string, ControlStructure>;
  inputs: Record<string, ControlStructure>;
  /** Palette families that qualify as Button/Input tones. A family that stops
   * qualifying changes what `@ds-button(role family)` emits. */
  tones: string[];
  /** Every custom property the generated theme CSS defines. Taken from the
   * generated output itself, not recomputed from the theme. */
  variables: string[];
}

const sortedKeys = (value: Record<string, unknown> | undefined) => Object.keys(value || {}).sort();

function controlStructure(
  declarations: (theme: any, role: string) => { base: Record<string, string>; states: Record<string, Record<string, string>> },
  tokens: Record<string, { surface?: string }>,
  theme: any,
): Record<string, ControlStructure> {
  const result: Record<string, ControlStructure> = {};
  for (const role of Object.keys(tokens)) {
    const { base, states } = declarations(theme, role);
    result[role] = {
      surface: tokens[role].surface || '',
      base: sortedKeys(base),
      states: Object.fromEntries(Object.keys(states).sort().map((state) => [state, sortedKeys(states[state])])),
    };
  }
  return result;
}

/** Custom properties defined by a stylesheet: `--name` immediately followed by
 * a colon, which is a declaration rather than a `var()` reference. */
function definedVariables(css: string): string[] {
  const names = new Set<string>();
  const pattern = /(--[A-Za-z0-9_-]+)\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css))) names.add(match[1]);
  return Array.from(names).sort();
}

/**
 * Derives the structural signature of an effective theme.
 *
 * `generatedCss` is the output of `generateThemeCss` for that same theme; it is
 * passed in rather than regenerated so the caller — which has to generate
 * before applying anyway — does the work once, and so the variable list is
 * taken from what is actually emitted.
 */
export function themeStructure(theme: any, generatedCss: string): ThemeStructure {
  const effective = theme || {};
  const typography: Record<string, string[]> = {};
  const details = effective.typography_details || {};
  for (const role of Object.keys(details)) {
    const style = resolveTypographyRole(details, role);
    typography[role] = style ? Object.keys(style).sort() : [];
  }

  const surfaces: Record<string, string[]> = {};
  for (const role of Object.keys(getSurfaceTokens(effective))) {
    surfaces[role] = sortedKeys(surfaceDeclarations(effective, role));
  }

  return {
    breakpoints: { ...DEFAULT_BREAKPOINTS, ...effective.breakpoints },
    typography,
    surfaces,
    buttons: controlStructure(buttonDeclarations as any, getButtonTokens(effective) as any, effective),
    inputs: controlStructure(inputDeclarations as any, getInputTokens(effective) as any, effective),
    tones: getToneFamilies(effective.palette).sort(),
    variables: definedVariables(generatedCss),
  };
}

const sameList = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((value, index) => value === b[index]);
const listing = (values: string[]) => (values.length ? values.join(', ') : '(none)');

function compareControls(kind: string, before: Record<string, ControlStructure>, after: Record<string, ControlStructure>, changes: string[]) {
  for (const [role, previous] of Object.entries(before)) {
    const current = after[role];
    if (!current) {
      changes.push(`${kind} role "${role}" was removed`);
      continue;
    }
    if (previous.surface !== current.surface) {
      changes.push(`${kind} role "${role}" changed its Surface from "${previous.surface}" to "${current.surface}"`);
    }
    if (!sameList(previous.base, current.base)) {
      changes.push(`${kind} role "${role}" now emits a different set of base declarations (was: ${listing(previous.base)}; now: ${listing(current.base)})`);
    }
    const previousStates = Object.keys(previous.states);
    const currentStates = Object.keys(current.states);
    if (!sameList(previousStates, currentStates)) {
      changes.push(`${kind} role "${role}" changed its states (was: ${listing(previousStates)}; now: ${listing(currentStates)})`);
      continue;
    }
    for (const state of previousStates) {
      if (!sameList(previous.states[state], current.states[state])) {
        changes.push(`${kind} role "${role}" state "${state}" now emits a different set of declarations (was: ${listing(previous.states[state])}; now: ${listing(current.states[state])})`);
      }
    }
  }
}

/**
 * Lists the differences that compiled component CSS could not follow. An empty
 * array means the patch only moves values, which a regenerated theme stylesheet
 * applies correctly.
 *
 * Additions are deliberately asymmetric. A *new* role, breakpoint name or token
 * cannot break a stylesheet compiled before it existed — nothing references it
 * yet. A removal can: the compiled rule keeps referencing a custom property
 * that no longer has a definition. So removals count and additions do not,
 * except where the addition changes what an existing role emits (a new
 * typography field, a new state), which is reported like any other change.
 */
export function structuralChanges(before: ThemeStructure, after: ThemeStructure): string[] {
  const changes: string[] = [];

  for (const [name, width] of Object.entries(before.breakpoints)) {
    if (!(name in after.breakpoints)) {
      changes.push(`breakpoint "${name}" was removed`);
    } else if (after.breakpoints[name] !== width) {
      changes.push(`breakpoint "${name}" moved from ${width}px to ${after.breakpoints[name]}px`);
    }
  }

  for (const [role, fields] of Object.entries(before.typography)) {
    const current = after.typography[role];
    if (!current) changes.push(`typography role "${role}" was removed`);
    else if (!sameList(fields, current)) {
      changes.push(`typography role "${role}" now emits a different set of fields (was: ${listing(fields)}; now: ${listing(current)})`);
    }
  }

  for (const [role, fields] of Object.entries(before.surfaces)) {
    const current = after.surfaces[role];
    if (!current) changes.push(`surface role "${role}" was removed`);
    else if (!sameList(fields, current)) {
      changes.push(`surface role "${role}" now emits a different set of declarations (was: ${listing(fields)}; now: ${listing(current)})`);
    }
  }

  compareControls('button', before.buttons, after.buttons, changes);
  compareControls('input', before.inputs, after.inputs, changes);

  const lostTones = before.tones.filter((family) => !after.tones.includes(family));
  if (lostTones.length) {
    changes.push(`palette ${lostTones.length === 1 ? 'family' : 'families'} ${listing(lostTones)} no longer ${lostTones.length === 1 ? 'qualifies' : 'qualify'} as a Button/Input tone`);
  }

  const removedVariables = before.variables.filter((name) => !after.variables.includes(name));
  if (removedVariables.length) {
    const shown = removedVariables.slice(0, 5);
    changes.push(`${removedVariables.length} custom ${removedVariables.length === 1 ? 'property is' : 'properties are'} no longer defined (${listing(shown)}${removedVariables.length > shown.length ? ', …' : ''})`);
  }

  return changes;
}

/** The error a rejected patch carries: what changed, and what to do about it. */
export function structuralChangeError(changes: string[]): Error {
  const error = new Error(
    'UXD_THEME_STRUCTURE: this patch changes what the compiler would emit for your components, ' +
    'which applying a theme stylesheet cannot do — the rules compiled into your CSS keep their old shape. ' +
    `Rebuild the project with the new theme and reinitialize the runtime with it.\n  - ${changes.join('\n  - ')}`
  );
  (error as any).code = 'UXD_THEME_STRUCTURE';
  (error as any).changes = changes;
  return error;
}
