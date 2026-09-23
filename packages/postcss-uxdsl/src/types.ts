// MIG-B6-27 (FEAT-008): the public type surface for `uxdsl.config.cjs`,
// `uxdsl.theme.json` and the plugin's own options.
//
// Typos are made while *writing* configuration, so that is where they have to
// be caught. Every closed set below is derived from the engine constant that
// actually decides the behaviour — `TYPOGRAPHY_PROPERTIES`, `SURFACE_PROPERTIES`,
// `BUTTON_PROPERTIES`/`BUTTON_STATES`, `INPUT_PROPERTIES`/`INPUT_STATES` — so a
// field added to an engine appears here without anyone remembering to copy it,
// and a field removed stops type-checking. Nothing here is a second,
// hand-maintained list of what the compiler accepts.
//
// What stays open is open on purpose: role names, palette families, font family
// names and typography role names are registries a project extends, so they are
// `Record<string, …>`. `Record<string, any>` is never used to skip validation.
import type { ReferenceOptions } from './reference-integrity';
import type { TYPOGRAPHY_PROPERTIES } from './typography';
import type { SURFACE_PROPERTIES } from './surfaces';
import type { BUTTON_PROPERTIES, BUTTON_STATES } from './buttons';
import type { INPUT_PROPERTIES, INPUT_STATES } from './inputs';

/** A `typography_details` field name, e.g. `fontSize`. Closed: `fontsize` is a typo. */
export type UxdslTypographyField = keyof typeof TYPOGRAPHY_PROPERTIES;
/** A Surface field name. Closed. */
export type UxdslSurfaceField = keyof typeof SURFACE_PROPERTIES;
/** A Button field name, inside `base` or a state. Closed. */
export type UxdslButtonField = keyof typeof BUTTON_PROPERTIES;
/** A Button interaction state, e.g. `focusvisible` (not `focusVisible`). Closed. */
export type UxdslButtonState = keyof typeof BUTTON_STATES;
/** An Input field name, inside `base` or a state. Closed. */
export type UxdslInputField = keyof typeof INPUT_PROPERTIES;
/** An Input interaction state. Closed. */
export type UxdslInputState = keyof typeof INPUT_STATES;

/**
 * Any value the engines accept for a token: a plain CSS value (`1rem`), a token
 * reference (`palette(primary.main)`, `density(2)`) or a responsive expression
 * (`xs(space(1)) md(space(2))`). All three are strings, and the distinction is
 * resolved by the compiler, not by the type system — this alias exists to say
 * so at the point of use rather than leaving a bare `string`.
 */
export type UxdslTokenValue = string;

/** Breakpoint thresholds, in any of the three shapes the plugin accepts. */
export type UxdslBreakpointSpec =
  | Record<string, number>
  | Array<[string, number]>
  | Array<{ name: string; min?: number; px?: number }>;

/**
 * One Palette family. Variant names are open, and `main` is deliberately not
 * required: `action` in the shipped base theme has only `disabled`, and a
 * semantic group like `divider` is a valid family that is not a tone.
 * Requiring `main`/`dark`/`contrast` here would reject the base theme itself —
 * that trio is the *tone* predicate Buttons and Inputs apply when generating
 * tone variants, not the definition of a valid family.
 */
export type UxdslPaletteFamily = Record<string, UxdslTokenValue>;

/** One Color family: a standalone color (`white`) or a shade scale (`gray.300`). */
export type UxdslColorFamily = UxdslTokenValue | Record<string, UxdslTokenValue>;

/** One `typography_details` role. Field names are closed; the role name is not. */
export type UxdslTypographyRole = Partial<Record<UxdslTypographyField, UxdslTokenValue>>;

/** One Surface role. Field names are closed; the role name is not. */
export type UxdslSurfaceRole = Partial<Record<UxdslSurfaceField, UxdslTokenValue>>;

/** One Button role: a Surface to compose from, base fields, and per-state fields. */
export interface UxdslButtonRole {
  /** Name of the Surface role this composes from. Custom roles inherit `contained`. */
  surface?: string;
  base?: Partial<Record<UxdslButtonField, UxdslTokenValue>>;
  states?: Partial<Record<UxdslButtonState, Partial<Record<UxdslButtonField, UxdslTokenValue>>>>;
}

/** One Input role. Same shape as a Button role, with the Input field and state sets. */
export interface UxdslInputRole {
  /** Name of the Surface role this composes from. Custom roles inherit `contained`. */
  surface?: string;
  base?: Partial<Record<UxdslInputField, UxdslTokenValue>>;
  states?: Partial<Record<UxdslInputState, Partial<Record<UxdslInputField, UxdslTokenValue>>>>;
}

/** Font families by role name, plus the Google Fonts specs to import. */
export interface UxdslFonts {
  families?: Record<string, string>;
  /** Google Fonts family specs, e.g. `Inter:wght@400;700`. */
  google?: string[];
}

/** A theme mode. Only `palette` is compiled today. */
export interface UxdslMode {
  palette?: Record<string, UxdslPaletteFamily>;
}

/**
 * The shape of a theme file. Every family is optional: an omitted one falls
 * back to the packaged base theme through `resolveTheme`, which is why this is
 * not a type with required members. The *family names* are closed — they are
 * `KNOWN_THEME_FAMILIES` — so `palete` or `spacings` fails to type-check, which
 * is the same thing `validateAndNormalizeTheme` warns about at build time.
 */
export interface UxdslTheme {
  breakpoints?: Record<string, number>;
  /** Keys accept the bare number (`"1"`) or the prefixed form (`"space-1"`). */
  spacing?: Record<string, UxdslTokenValue>;
  palette?: Record<string, UxdslPaletteFamily>;
  fonts?: UxdslFonts;
  colors?: Record<string, UxdslColorFamily>;
  typography_details?: Record<string, UxdslTypographyRole>;
  densities?: Record<string, UxdslTokenValue>;
  inputs?: Record<string, UxdslInputRole>;
  buttons?: Record<string, UxdslButtonRole>;
  surfaces?: Record<string, UxdslSurfaceRole>;
  shadows?: Record<string, UxdslTokenValue>;
  borders?: Record<string, UxdslTokenValue>;
  radii?: Record<string, UxdslTokenValue>;
  modes?: { dark?: UxdslMode };
  /** Legacy flat typography variables (`font-code`). `typography_details` is the current form. */
  typography?: Record<string, UxdslTokenValue>;
}

/**
 * Deep-partial, with arrays kept whole.
 *
 * `deepMergeTheme` merges nested objects but *replaces* an array outright, so
 * an override's `fonts.google` is the complete new list rather than a patch.
 * Modelling that as `(string | undefined)[]` would invite writing holes into a
 * list that replaces the original wholesale.
 */
export type UxdslDeepPartial<T> =
  T extends readonly unknown[] ? T
  : T extends object ? { [K in keyof T]?: UxdslDeepPartial<T[K]> }
  : T;

/**
 * A theme override: the partial patch a project merges over the base theme, as
 * `deepMergeTheme` and `resolveTheme` apply it. Nested objects merge key by
 * key; arrays and responsive strings replace the whole field.
 *
 * Use this for a `uxdsl.theme.*` file that intentionally declares only what it
 * changes, and `UxdslTheme` for one meant to stand on its own.
 */
export type UxdslThemeOverride = UxdslDeepPartial<UxdslTheme>;

/** Options accepted by the PostCSS plugin. */
export interface UxdslOptions {
  breakpoints?: UxdslBreakpointSpec;
  themeVar?: (path: string) => string;
  spaceVar?: (index: string) => string;
  colorVar?: (path: string) => string;
  theme?: UxdslThemeOverride;
  /**
   * Whether this compilation emits the global `:root` token definitions
   * (foundations, typography, density, shadows, edges, surfaces, buttons,
   * inputs). Defaults to `true`, matching the historical single-entry
   * behavior where one compiled file both defines and consumes tokens.
   *
   * Set to `false` for a component/CSS-Module entry that only consumes
   * tokens a separate `includeTheme: true` entry already defines — for
   * example, one shared theme import plus several CSS Module files. This
   * avoids re-emitting duplicate global declarations and the bare `:root`
   * selector that CSS Modules loaders reject as impure. Token references
   * (`space()`, `palette()`, `density()`, `@ds-surface`, `@ds-button`,
   * `@ds-input`, ...) still resolve and validate normally either way —
   * only the definitions themselves are skipped.
   */
  includeTheme?: boolean;
  references?: ReferenceOptions;
  /**
   * When `theme` is omitted (and this isn't `false`), the plugin looks for
   * a conventional `uxdsl.theme.config.{cjs,js,json}`/`uxdsl.theme.json` in
   * `configRoot` (default `process.cwd()`) and validates/compiles against
   * it instead of the built-in default theme — the same discovery
   * uxdsl-cli has always done, now available with the plugin used
   * directly (e.g. from a project's own `postcss.config.js`). An explicit
   * `theme` always wins outright; this has no effect when one is given.
   * Set to `false` to keep the old always-default-theme behavior.
   */
  discoverTheme?: boolean;
  /** Directory theme discovery searches from. Defaults to `process.cwd()`.
   * Ignored when `theme` is explicit or `discoverTheme` is `false`. */
  configRoot?: string;
}

/**
 * @deprecated Renamed to {@link UxdslOptions} in 0.5.0-beta.6, so every public
 * type spells the product the same way. This alias still resolves to the same
 * type and is not scheduled for removal within 0.5.x.
 */
export type UxDslOptions = UxdslOptions;

/**
 * Where compiled CSS is written. `output` is the older spelling the CLI still
 * accepts (`configModule.outFile || configModule.output`); it is modelled here
 * so adding a type annotation to a working config does not report an error the
 * CLI would not — a false positive teaches people to delete the annotation.
 */
export type UxdslOutTarget =
  | { outFile: string; output?: never }
  /** @deprecated Use `outFile`. Still accepted by the CLI. */
  | { output: string; outFile?: never };

/** One entry of a multi-entry `builds` array. */
export type UxdslBuild = UxdslOutTarget & {
  entry: string;
  /** Overrides the shared `includeTheme` for this entry only. A `--include-theme`
   * / `--no-include-theme` flag still wins over both. */
  includeTheme?: boolean;
};

/** The options a build config shares across every entry it declares. */
export interface UxdslConfigShared {
  /** Extra paths for `--watch` to observe, beyond the entries and their imports. */
  watch?: string[];
  breakpoints?: UxdslBreakpointSpec;
  /** Inline theme override. Mutually exclusive in practice with `themeFile`,
   * which points at a file holding the same thing. */
  theme?: UxdslThemeOverride;
  /** Path to the theme file, resolved relative to this config file. */
  themeFile?: string;
  references?: ReferenceOptions;
  /** `true` checks every touched family; an array limits the check to those families. */
  strictTheme?: boolean | string[];
  /** `'external'` writes `<outFile>.map`; `'inline'` appends a data URI. Shared by
   * every entry — there are no per-entry map overrides. */
  sourceMap?: false | 'inline' | 'external';
}

/**
 * The shape of `uxdsl.config.cjs`.
 *
 * The union models what the CLI actually accepts: a single `entry`/`outFile`,
 * or a `builds` array — never both, which the CLI rejects outright rather than
 * guessing which one to compile. A type that allowed the combination would
 * describe a config that fails at run time.
 */
export type UxdslConfig =
  | (UxdslConfigShared & UxdslOutTarget & {
      entry: string;
      includeTheme?: boolean;
      builds?: never;
    })
  | (UxdslConfigShared & {
      builds: UxdslBuild[];
      entry?: never;
      outFile?: never;
      output?: never;
      /** Applies to every entry that does not set its own. */
      includeTheme?: boolean;
    });
