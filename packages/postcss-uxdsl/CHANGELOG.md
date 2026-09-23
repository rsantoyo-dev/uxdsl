# Changelog

All notable changes to `postcss-uxdsl` are documented here. Dates are
omitted for entries that have not been published to npm — the package
version stays at whatever `package.json` currently says until a release
actually happens. See
[`docs/migration.md`](https://github.com/rsantoyo-dev/uxdsl/blob/main/packages/postcss-uxdsl/docs/migration.md)
for a narrative migration guide covering the same ground.

## 0.5.0-beta.7 — unreleased

FEAT-009, MIG-B7-01 (Input placeholder follows the requested tone):

### Visual changes

- Any `@ds-input(<role> <tone>)` already in use with an explicit tone and a
  `contained` role: the `::placeholder` color changes from the fixed
  `palette(neutral.dark)` gray to that tone's own `contrast` color — the same
  color already used for that role's typed text and border, so a gray that
  could turn illegible against a saturated tone-colored background now stays
  readable. `outlined` and `underline` are unchanged (their background never
  tints, so the gray placeholder already read fine there), and any Input used
  without an explicit tone is unchanged in all three roles.

FEAT-009, MIG-B7-01 (continued — diagnosis and scope):

- **Fix:** closes finding (1) from MIG-B6-29 phase 3
  (`inputs.*.base.placeholder` never tone-substituted). The ficha's own
  written diagnosis undercounted the problem — 3 known failures
  (`warning`+`contained` only) — and proposed a JSON-only fix: rewrite
  `placeholder`'s literal value in `theme/base.json` to reuse the
  `tone-main, primary-main` fallback pattern Button's own states already use.
  Re-verified against the real contrast gate before writing that JSON: the
  true count was 42 failures across 3 causal groups, and the proposed pattern
  reuse has **zero effect** — `compileRules`'s regex substitution only
  matches a fallback whose literal text is exactly `palette__primary-
  <variant>`, so any other literal fallback (including `neutral-dark`) is
  never substituted, tone or no tone. Implemented instead as a TypeScript
  override in `control-engine.ts`'s `declarations()` — not a `theme/base.json`
  change — reusing the same `background === 'transparent'` signal
  `surfaceDeclarations` already computes to tell `contained` (background
  tints) apart from `outlined`/`flat` (it does not), and substituting the
  tone's `contrast` variant (matching that role's own already-tinted text),
  not `main` (which would match the background and make the placeholder
  invisible). Scoped to `contained` only: `outlined`/`underline` never had a
  tonalized failure to begin with, and applying the same substitution there
  would introduce new invisible-placeholder failures for tones whose
  `contrast` is white against those roles' always-white/transparent
  background. `compileRules`'s own pattern-substitution mechanism is
  unchanged — Button's own states and Input's own `caret` still rely on it
  (regression-tested: Button's 47 pre-existing contrast failures are
  unchanged in count and in exact signature). Net effect on the full theme:
  156 → 123 total contrast failures, exactly the 33 tonalized `contained`
  placeholder failures resolved, zero new failures introduced.
- **Not fixed, by design — a fourth finding, distinct from MIG-B6-29's three:**
  `palette(neutral.dark)`, the untoned placeholder default shared by all
  three Input roles, is not dark-mode-aware enough against dark mode's own
  background — 9 failures (3 roles × base/focus/invalid), present before and
  after this fix, all `tone: null`. Out of scope here: this story closes the
  *tonalized* gap only; the untoned gap is a plain color choice, not a
  tone-substitution mechanism gap. Recommended follow-up: review
  `neutral.dark` for dark mode the way MIG-B6-29 phase 3 reviewed other
  colors.

## 0.5.0-beta.6 — unreleased

FEAT-008, MIG-B6-16 (partial overrides, made explicit):

- **New (CLI):** `uxdsl theme --diff` now prints a one-line summary on
  **stderr** for every entry that mixes your values with the base theme's —
  `[uxdsl] palette.primary mixes your values (main) with base values (light,
  dark, contrast)`. stdout is unchanged, still a clean JSON document, because
  scripts already parse it. Merging key by key stays the design; what changes
  is that it stops being invisible.
- **New (CLI):** `uxdsl theme --contrast` runs the WCAG check over the
  effective theme and prints the full report as JSON on stdout, exiting 1 if
  any pair fails. It loads the exceptions shipped with the base theme, which
  match on resolved colors — so overriding one of those colors stops
  inheriting its exception and reports it as stale. Not part of `build`, and
  refused in combination with `--diff` or `--strict`, since each prints its
  own document on stdout.
- Note: the packaged base theme does not pass its own gate yet. Those
  failures are real and disclosed (MIG-B6-29), not a configuration problem.

FEAT-008, MIG-B6-30 (phase 2/4: migrating off the four legacy storage keys):

- **New:** the first `loadPersistedTheme()` that finds nothing under the
  managed key converts `uxdsl:palette`, `uxdsl:colors`, `uxdsl:spacing` and
  `uxdsl:breakpoints` into one theme override, applies it through the same
  validation and structural check as any other patch, writes the managed key,
  **reads it back**, and only then removes the old keys. A refused patch, a
  blocked write, or a write a private-mode/full store silently drops leaves all
  four legacy keys exactly as they were — a failure can never cost the user
  both copies. `{ migrateLegacy: false }` opts out.
- Undoing the old key format is resolved against the family names the theme
  declares, longest match first, rather than by splitting on a hyphen:
  `primary-dark-hover` is `primary` + `dark-hover` while `brand-accent-main`
  is `brand-accent` + `main`, and the string alone cannot tell them apart. A
  token matching no declared family is reported in `warnings` and skipped, not
  filed under an invented one.
- A valid managed key wins outright and is never merged with the legacy keys.
  A *corrupt* managed key is an error, not a silent fall back to whatever the
  old keys contain — which would replace the user's theme with a different one
  and call it success.

FEAT-008, MIG-B6-30 (phase 1/4: the JSON theme applied at run time):

- **New:** `applyTheme`, `getAppliedTheme`, `resetTheme`, `loadPersistedTheme`
  and `subscribeTheme` on `postcss-uxdsl/ds-runtime`. The same theme JSON a
  build compiles can now be applied in the browser, synchronously: on
  `ok: true` the stylesheet and the reported state already agree, on
  `ok: false` nothing changed at all. State is per document (a WeakMap keyed
  by it), not a module singleton, so an iframe or a second document gets its
  own managed `<style>` and its own applied override.
- **New:** a structural gate. A patch that changes *which declarations a
  directive would emit* — a `typography_details` field added or removed, a
  state such as `focusvisible` introduced, the Surface a Button composes from
  changed, an existing breakpoint threshold moved, a palette family losing
  `main`/`dark`/`contrast` — is rejected with `UXD_THEME_STRUCTURE`, naming
  every change and saying to rebuild, because compiled component rules keep
  their old shape. Value changes, responsive expressions over the same
  thresholds, dark-mode colors and new tokens apply normally. The distinction
  is derived from the engines the compiler emits with, not from a second list.
- **Fixed:** `validateAndNormalizeTheme` mutated the theme it was given. Its
  "work on a copy" step was `deepMergeTheme({}, input)`, which shares every
  nested object by reference (only arrays are copied), so normalization wrote
  into the caller's object — invisible with a freshly parsed JSON literal, and
  a hard `TypeError` as soon as the input shared a sub-object with the packaged
  deep-frozen base. That made `validateAndNormalizeTheme(resolveTheme(x))`,
  the documented composition, throw outright. It now deep-copies
  (`cloneThemeValue`, also exported) and leaves the input untouched.

FEAT-008, MIG-B6-27 (exported types, `defineConfig`, generated theme schema):

- **New:** the public type surface is exported from the package root —
  `UxdslTheme`, `UxdslThemeOverride`, `UxdslOptions`, `UxdslConfig`,
  `UxdslBuild` and the field/state unions they are built from. `theme` is no
  longer `Record<string, any>`. `UxDslOptions` remains as a deprecated alias
  of `UxdslOptions`, unchanged in meaning.
- **New:** `defineConfig` from `postcss-uxdsl/config`, an identity function
  that type-checks a `uxdsl.config.cjs` export. It is intentionally not
  generic — `defineConfig<T extends UxdslConfig>` infers `T` from the literal
  including its extra keys, so it would accept the very typo it exists to
  catch. Works with JSDoc alone, no TypeScript needed in the project.
- **New:** `schema/theme.schema.json`, shipped with the package and exported
  as `postcss-uxdsl/schema/theme.schema.json`, for `"$schema"` in a
  `uxdsl.theme.json`. Generated by `scripts/generate-language-artifacts.js`
  from `KNOWN_THEME_FAMILIES`, `TYPOGRAPHY_PROPERTIES` and the Surface,
  Button and Input field/state maps, so it cannot drift from what the
  compiler accepts; `--check` fails on a hand-edited copy.
- **Fixed:** a theme declaring `"$schema"` — the documented way to get editor
  completion — was reported by `validateAndNormalizeTheme` as an unknown
  family that "will not be compiled into any CSS", which argued against the
  line the README tells you to add. It is metadata and is now recognized as
  such (`THEME_SCHEMA_KEY`), while a real typo like `palete` still warns.
- **Fixed:** `exports` listed the `types` condition *after* `require`/`import`
  for `.`, `./ds-runtime` and `./config`. Conditions match in order, so the
  types entry was never reached under `node16`/`nodenext` resolution; it now
  comes first everywhere.
- `BUTTON_PROPERTIES`, `BUTTON_STATES`, `INPUT_PROPERTIES` and `INPUT_STATES`
  lost their `Record<string, …>` annotations so their keys are literal types.
  Same values, same runtime behavior; the public unions derive from them.

FEAT-008, MIG-B6-25 (reference validation in near-linear time):

- **Fixed:** strict reference validation — on by default, and one of the
  reasons to use UXDSL at all — grew quadratically with the size of the
  stylesheet, which made watch mode unusable on a large module. It is now
  near-linear. Same inputs, same issues, same order; only the time changes.

  Measured with `npm run bench:references` on an Apple M1 Pro (Node
  v20.19.0, macOS 25.2.0, median of 3 samples after a warmup), compiling
  the same synthetic module with `includeTheme: true`:

  | Líneas | Antes | Después | Sin validación |
  | --- | --- | --- | --- |
  | 3.000 | 813 ms | 119 ms | 75 ms |
  | 6.000 | 1.867 ms | 204 ms | 142 ms |
  | 12.000 | 11.813 ms | 410 ms | 291 ms |
  | 24.000 | 63.308 ms | 786 ms | 565 ms |

  Doubling the input used to multiply the time by up to 6.3x; it now costs
  about 1.9x, the same curve the compilation follows with validation
  switched off entirely — validation is no longer the dominant term.

- **No behavior change.** Every issue's code, message, chain, consumer,
  source, line, column, dedup and ordering is unchanged. The previous
  implementation is kept, compiled and frozen, as a test fixture, and
  `test/reference-integrity-equivalence.test.js` runs both over the same
  inputs — the repository's own `.uxdsl` entries, media/mode scopes,
  shared cycles, nested fallbacks, `!important`, external providers,
  successive compilations with different themes — and requires identical
  output. Its digest is pinned so the fixture cannot be regenerated to make
  a disagreement disappear.
- `test/performance/reference-performance.test.js` keeps the quadratic term
  from coming back, asserting a growth *ratio* (≤ 2.5x per doubling) rather
  than a millisecond budget that would only describe one machine. It runs in
  its own `--test-concurrency=1` pass after the rest of the suite: measured
  inside `node --test`'s parallel file pool it was timing the scheduler, not
  the algorithm.

FEAT-008, MIG-B6-21 (source maps through PostCSS):

- **New:** `compile()` (`uxdsl-core`) implements `sourceMap: false | 'inline'
  | 'external'`, returning the map as a JSON string in `map`. `'external'`
  leaves the CSS untouched so the writer can add the `sourceMappingURL`
  comment; `'inline'` appends a base64 data URI last in the file. `false`
  (the default) is **byte-identical** to omitting the option. An
  unrecognised value throws instead of silently emitting nothing.
- **New (CLI):** `--sourcemap`, `--sourcemap=inline`, `--no-sourcemap`, and
  `sourceMap` in `uxdsl.config.cjs`, with flag > config > off precedence.
  `external` writes `<outFile>.map` and annotates the CSS; the build log
  reports CSS and map bytes separately. Switching an output away from
  `external` retires that output's own map, and never a foreign file
  sitting at the same path. A multi-entry build that fails still writes
  nothing at all.
- **Mapped positions**, each asserted with a real `SourceMapConsumer`
  lookup rather than a "a map exists" check: a plain declaration maps to
  its own line; a declaration rewritten from `density()` maps to the
  original declaration; the declarations a `@ds-button` expands into map to
  the directive's own line; and a declaration from an `@import`-ed partial
  maps to that partial, with its own line.
- **Theme-generated globals no longer invent source files.** The `:root`
  token blocks are built from the theme, then parsed with
  `postcss.parse()`, which gave every node an anonymous `<input css …>`
  input — PostCSS then listed seven of those in the map's `sources`, each
  with its whole body in `sourcesContent`. A small stylesheet's map was
  58,366 bytes, most of it advertising files the user never wrote; it is
  now 9,045 (−85%), with `sources` limited to the real `.uxdsl` files.
  Those generated bytes are simply left unmapped, which is the honest
  answer for them. Reference diagnostics are unaffected — an anonymous
  input never had a `file` to report in the first place.
- **Adapters, only what their fixtures prove:** the Webpack loader's map
  support is verified end to end (`devtool: 'source-map'` + `css-loader`,
  with a real position resolving back to the `.uxdsl`). The Vite plugin
  hands Vite a correct map, but its fixture shows Vite's CSS pipeline does
  not carry the `.uxdsl` source through to the emitted asset, so Vite map
  support is **not** advertised; the fixture reports that outcome on every
  run so it flips to a real assertion if Vite ever chains it.

FEAT-008, MIG-B6-17 (`@ds-typo` emits only what the theme defines):

### Visual changes

`@ds-typo(role)` used to emit a fixed list of 10–11 declarations per use,
whose fallback values came from a hardcoded map in the compiler rather than
from your theme. It now emits **one declaration per field the effective theme
actually defines for that role, with no literal fallback**.

What the compiler used to invent, and what happens now:

| Declaration | Before (invented) | After |
| --- | --- | --- |
| `margin-block-start` / `-end` | `var(…, auto)` | `var(…)` — `theme/base.json` now defines both as `"0"` |
| `text-decoration` | `var(…, none)` | not emitted unless the theme defines `textDecoration` |
| `text-transform` | `var(…, none)` | not emitted unless the theme defines `textTransform` |
| `font-style` | `var(…, normal)` | not emitted unless the theme defines `fontStyle` |
| `opacity` (`caption`, `small`) | `var(…, 0.8)` | **removed** |
| `font-family` | hardcoded `ui` / `ui-2` / `code` chain | `var(…)` — the chains moved into `theme/base.json` |
| `font-weight`, `letter-spacing` on `code`/`pre` | not emitted at all | now emitted (the theme defined them; the directive just never read them) |

Four of these are deliberate behaviour changes, not just refactors:

- **Links keep their underline.** `text-decoration: none` was applied to
  every `@ds-typo` use, including on an `<a>` — a WCAG 1.4.1 problem.
- **Margins no longer break flex and grid.** `auto` collapses to `0` in
  normal flow but *absorbs free space* in a flex or grid container, pushing
  the element. `"0"` in the base theme keeps the normal-flow rendering
  identical while removing that trap.
- **`caption` and `small` are no longer dimmed to `opacity: 0.8`.** That
  reduced contrast and could not be overridden from a theme at all, because
  `opacity` is not one of the typography fields. Express a muted caption with
  a palette color on the component instead.
- **`text-transform` and `font-style` are no longer reset.** Their CSS initial
  values are already `none`/`normal`, so nothing changes in isolation — but
  both are inherited, so a `@ds-typo` element inside an uppercased or
  italicised parent now inherits that parent instead of silently resetting.

Other changes in the same story:

- `@ds-typo(role)` with a role the effective theme does not define now fails
  with `UXD_TYPO_REFERENCE`, pointing at the directive and listing the
  available roles, instead of silently emitting declarations that referenced
  variables nothing defined. A missing role never falls back to `default`.
- Deleted `src/typography-defaults.ts` (`DEFAULT_TYPOGRAPHY`) and
  `TYPOGRAPHY_DEFAULTS` from `src/typography.ts`; both lost their last
  consumer here. `typography.ts` gains `TYPOGRAPHY_CSS_PROPERTIES` (JSON field
  → CSS property) and `resolveTypographyRole` (`default` merged under a role's
  own fields), the resolver the directive and the generator now share.
- **Output size:** a fixture of 100 `@ds-typo` uses across 13 roles compiles
  to **40,296 bytes, down from 63,455 (−36.5%)**.

**To restore the beta.5 appearance**, define the fields in your own theme —
they are ordinary typography fields now, so they are also overridable, which
the hardcoded fallbacks never were:

```json
{
  "typography_details": {
    "default": {
      "textTransform": "none",
      "textDecoration": "none",
      "fontStyle": "normal",
      "marginBlockStart": "auto",
      "marginBlockEnd": "auto"
    }
  }
}
```

`opacity` has no equivalent: it was never a typography field, so it cannot be
restored through the theme. Apply it in the component if you need it.

FEAT-008, MIG-B6-29 (phase 4 of 4 — the shared Google Fonts encoder, this story's own "paso 9". This closes the story):

- **New:** `encodeGoogleFontFamily(spec)` and `googleFontsImportUrls(google)`,
  exported from `postcss-uxdsl/ds-runtime`. The one shared, pure, browser-safe
  encoder both the PostCSS plugin and `generateThemeCss` now use to build a
  `fonts.google` entry into a Google Fonts css2 `@import` URL — a space
  becomes `+` (css2's own convention), `:`/`@`/`;`/`,` (the characters css2's
  own syntax depends on) pass through unescaped, and anything else is
  percent-encoded per character. Stricter than plain `encodeURIComponent`:
  that leaves `' ( ) ! ~ *` unescaped by spec, but the result is embedded in
  a single-quoted `url('...')` CSS string by both callers, where an
  unescaped `'` would close the string early and corrupt the generated CSS
  — found while writing this module's own test suite, confirmed to actually
  produce invalid CSS (`postcss.parse` threw) before being fixed here.
- **Fix:** the PostCSS plugin's own Google Fonts `@import` builder used a
  bare `family=${font}` template interpolation with no escaping at all — a
  family name with a space (e.g. `"Open Sans:wght@400;700"`) produced a
  literal space in the emitted URL, an invalid `@import`. The shipped
  default (`"Inter:wght@400;500;600;700"`) has no space and was never
  affected; any project that had set `fonts.google` to a multi-word family
  explicitly was.
- **Fix (build/runtime parity):** `generateThemeCss()` (the runtime/SSR
  path) previously emitted nothing at all for `theme.fonts.google` — only
  the PostCSS plugin did. It now emits the identical `@import` (same URL,
  same order) for the same theme, verified directly by compiling a theme
  both ways and comparing the two outputs byte-for-byte. A project calling
  `generateThemeCss` directly for SSR no longer needs to hand-roll its own
  Google Fonts `<link>`/`@import` to match what a build-time compile of the
  same theme would produce (`packages/playground-nextjs`'s own
  `ThemeContext.tsx` still does today — removing that now-redundant,
  independently hand-rolled implementation in favor of this shared encoder
  is MIG-B6-30's job, not this story's; until that lands, the playground
  temporarily has *more* overlapping font-loading paths, not fewer, which
  is the expected, understood order — paso 9 has to exist before paso 30
  can safely remove what it was covering for).
- Covered by `test/fonts.test.js`: the encoding rules themselves (css2
  syntax characters preserved, spaces, percent-encoding, the apostrophe/
  quote-corruption case above verified by actually parsing the emitted
  CSS, not just inspecting the encoded string), plugin/runtime parity,
  an empty `fonts.google: []` emitting nothing in both paths, and repeated
  compilation of the same theme producing identical output every time
  (no accumulation or drift) — this story's own "paso 9" explicitly asks
  for exactly these cases. `test/default-theme.test.js`'s existing
  zero-config test now checks the full URL, not just its prefix.

FEAT-008, MIG-B6-29 (phase 3 of 4 — color correction, this story's own "paso 8"):

- **Visual (default theme and every named playground theme):** 16 palette
  colors in `theme/base.json` moved to clear WCAG contrast, following this
  story's own rules: minimal change in OKLCH (hue and chroma held fixed,
  only lightness moved, smallest valid step, both directions searched),
  `dark`/`contrast` touched before `main`, `main` only moved when no
  white/black `contrast` choice could resolve it alone. Every corrected
  value already existed as `main`/`dark`/`contrast` for its family; nothing
  was invented. Light mode: `surface.dark` (`#e2e8f0`→`#8d929a`, its own
  border against the page background 1.23:1→3.13:1), `tertiary.dark`
  (`#475569`→`#68778c`, text on `tertiary.dark` as a hover background
  2.77:1→4.61:1 — the story's own named example), `tertiary.main`
  (`#94a3b8`→`#68768a`, direct text/border via `outlined`/`flat` tone
  2.56:1→4.62:1). Dark mode: 6 families that previously redefined only
  `main`/`contrast` in `modes.dark` now also have their own `dark`
  (`secondary`, `surface`, `tertiary`, `success`, `info`, `error` — the
  story's step 8 explicitly asks for this instead of inheriting light
  mode's `dark` into a dark background), and 7 families' `main` moved to
  stay readable as `placeholder` text (`palette(neutral.dark)`, the same
  value regardless of tone) on their own toned `contained`-input
  background. Every change is a same-hue lightening/darkening, not a hue
  or identity change; see this story's own evidence for the full per-color
  table with exact ratios. The Next.js playground's `green` and `slate`
  named themes received their own, independently-computed corrections
  (10 and 15 colors respectively) using the same rules and search, since
  they ship their own literal palette values rather than inheriting the
  package's — `default` and `purple` needed none, since neither overrides
  the palette (see this story's evidence for exactly which playground
  colors changed).
- **Not fixed, by design — three real, disclosed engine/architecture
  findings, not color choices:**
  1. `inputs.*.base.placeholder` is a literal `palette(neutral.dark)`
     reference in every input role's definition, never tone-substituted
     the way `bg`/`color`/`border` already are. A single gray cannot
     simultaneously read on the near-white ambient (works today, untoned)
     and on a saturated, often-dark toned `contained` background — moving
     `neutral.dark` to fix one breaks the other; moving a tone's own
     `main` to fix its own placeholder reading routinely requires erasing
     that color's identity (verified empirically: doing so in one
     playground theme's dark mode pushed multiple accent colors to
     near-white before this was caught and reverted in favor of leaving
     it open). Affects most tone families' `contained`-input placeholder
     in light mode. Recommended follow-up: make `placeholder`
     tone-substituted like the other Surface-composed fields.
  2. `light`, `dark`, and `surface` are canvas-identity families (their
     `main`/`dark` are meant to stay near-white or near-black to do their
     real job as page/recessed backgrounds) used as an explicit `tone=`
     accent on `outlined`/`flat`/`underline`, which reads that same value
     directly as text/border against the page's own ambient. This is the
     same class of finding as the one exception this story already
     shipped (`light`-as-text) — that shipped exception covers exactly the
     one case the story's own "Por qué" section names; the others
     (`light`-as-border, `dark`-as-tone in dark mode, `surface`-as-tone in
     both modes) remain open. Recommended follow-up: either exception the
     whole pattern per family once reviewed, or reconsider whether these
     three families should be valid `tone=` choices for text-bearing
     roles at all.
  3. `warning.main` (light mode only) isn't dark/saturated enough to read
     as direct text/border via `outlined`/`flat`/`underline` tone; fixing
     it within this story's own rules would require moving it far enough
     to lose its identity as a vivid, recognizable warning accent, which
     `main`'s own protection ("last resort, brand identity") is meant to
     prevent. Recommended follow-up: same as (2) — a reviewed exception,
     or a deliberate, owner-approved re-pick of `warning.main` itself
     (out of scope for an automated minimal-change pass).
  `checkThemeContrast` still correctly reports `passed: false` against
  `theme/base.json` and every named playground theme — honestly, by
  design. Phase 4 (this story's remaining scope: the Google Fonts encoding
  helper) does not touch colors and will not change this.

FEAT-008, MIG-B6-29 (phase 2 of 4 — the accessibility contrast gate):

- **New:** `checkThemeContrast(theme, { exceptions? })`, exported from
  `postcss-uxdsl/ds-runtime` (MIG-B6-16 uses it for `uxdsl theme
  --contrast`). Checks every text/placeholder/border color the theme's
  Surface/Button/Input engines actually define — every role, every real
  tone family, every state, light and dark mode, every configured
  breakpoint — against WCAG 4.5:1 (text) / 3:1 (non-text, WCAG 1.4.11).
  Derives every pair from the same functions the compiler itself calls
  (`surfaceDeclarations`, `buttonDeclarations`, `inputDeclarations`,
  `inspectSurfaceTheme`/`inspectButtonTheme`/`inspectInputTheme`), never a
  hand-written pair list. An unresolvable color reference always fails;
  a `disabled` state is computed and reported but never blocks the gate
  on its own. New `theme/base.contrast-exceptions.json` (empty except one
  entry — see below) holds exact-match exceptions: an exception records
  the resolved colors it was written against and stops applying the
  moment either one changes, and a duplicate or stale (no-longer-matching)
  exception fails the gate too, so an outdated entry can never silently
  keep "covering" a color that isn't the one it was reviewed for.
- **Fix (build compatibility):** the first version of `contrast.ts` used a
  `Map<string, number>` with a bare `for (const [k, v] of map)`. Every file
  reachable through `postcss-uxdsl/ds-runtime` is compiled a second time by
  any consumer that aliases that specifier straight to this package's
  source — the Next.js playground's `next.config.js`/`tsconfig.json` does
  exactly that, under the playground's own `target: "es5"` with no
  `downlevelIteration`, where iterating a `Map` this way does not compile
  (`Type 'Map<string, number>' can only be iterated through when using the
  '--downlevelIteration' flag or with a '--target' of 'es2015' or
  higher`). This package's own `tsc` (target ES2019) never caught it; only
  the playground's real production build did. Fixed by using
  `Record<string, number>` and `Object.entries(...)`, matching the
  convention already followed by every other file in this package's `src`.
  New `test/es5-consumer-compat.test.js` compiles `ds-runtime.ts` with the
  real TypeScript compiler API under the playground's exact settings so
  this class of bug is caught locally instead of only by a downstream
  build; verified to fail before this fix and pass after.
- Running this gate against the theme this same story's phase 1 shipped
  (see "Not yet done" below, still true) reproduces this story's own
  hand-computed reproduction numbers exactly — `tertiary`/contained/hover
  2.77:1, `warning`/outlined 3.19:1, `light`-tone/outlined 1.10:1 — plus
  many more once every tone family and state is checked exhaustively
  instead of by a few illustrative hand-picked examples. One exception is
  recorded: the `light` palette family (a background role) used as a text
  color on any role whose background is otherwise transparent is
  unsupported by the nature of the role, not a color this theme can fix
  without giving `light` a second, contradictory meaning. Every other
  failure remains open, real, and undisclosed-as-exception — phase 3 of
  this story (color correction) is what addresses them, not this phase.

FEAT-008, MIG-B6-29 (phase 1 of 4):

- **Fix (review follow-up):** the first version of this change deep-froze
  `theme/base.json`'s own parsed module object in place. `postcss-uxdsl/theme/base.json`
  is also this package's public export for that same file
  (`"./theme/*": "./src/theme/*"`); anything else in the same process or
  bundle that imports that public path — directly, or via a build tool
  aliasing `postcss-uxdsl/*` straight to this package's own source, which
  the Next.js playground's `next.config.js` does specifically "to consume
  current engine source, not a stale local dist" — resolves to the exact
  same file, and Node's/webpack's module cache is keyed by resolved path,
  not specifier, so it got back the exact same (now frozen) object. The
  playground crashed on load with `TypeError: Cannot assign to read only
  property 'ui' of object` the moment its own theme-editor code
  (`ThemeContext.tsx`, client-side) deep-merged that shared object and then
  mutated an untouched, reference-preserved `fonts.families` in place.
  Fixed by freezing an independent clone instead of the shared import —
  `DEFAULT_THEME`'s own content is unaffected, but no other code holding a
  reference to the original parsed JSON is affected by this package
  choosing to freeze its own copy. Regression test asserts the exact
  invariant (`base-theme.ts`'s own `require('./theme/base.json')` resolves
  to `dist/theme/base.json`, an independent second require of that same
  path must never come back frozen), verified to fail before this fix and
  pass after.
- **Visual (default theme, every zero-config project):** `DEFAULT_THEME` is
  now `postcss-uxdsl/theme/base.json` — the full theme previously used only
  by the Next.js playground — instead of a "deliberately minimal" 4-family
  Palette (`primary`/`surface`/`neutral`/`error`) with hand-picked hex
  values. A project with no theme override of its own now gets:
  - a full 14-family Palette (adds `secondary`, `tertiary`, `success`,
    `info`, `warning`, `dark`, `light`, `text`, `divider`, `action`; the 4
    previous families keep their same *role* but different hex values);
  - **`fonts.google: ["Inter:wght@400;500;600;700"]`** — a real
    `@import` to Google's servers on every compile with no theme, unless
    the project's own theme sets `fonts: { google: [] }`;
  - **`modes.dark`** — the OS `prefers-color-scheme: dark` is now followed
    automatically; pin light with `data-theme="light"` on `<html>`;
  - font families `ui`/`code` only (the old minimal theme's third,
    hardcoded `ui-2` is gone — a project can still add its own);
  - `densities`/`borders`/`radii`/`shadows`/`surfaces`/`buttons`/`inputs`
    populated in the JSON itself for the first time (previously computed
    or hardcoded independently inside `language.ts`/`edges.ts`/
    `shadows.ts`/`surfaces.ts`/`buttons.ts`/`inputs.ts`, with identical
    values — this is a source-of-truth change, not a value change, for
    these seven families specifically).
  - `theme.colors.gray` (the dependency `border(1..5)` resolves against)
    now matches the base theme's own gray (`#CBD5E1`/`#94A3B8`/`#64748B`/
    `#475569`) instead of a second, independently hardcoded gray
    (`#d1d5db`/`#9ca3af`/`#6b7280`/`#4b5563`) that only ever lived in
    `edges.ts` — border colors shift slightly for any project that didn't
    already override `colors.gray` itself.
- **Fix:** a real precedence bug this same change would otherwise have
  newly triggered on every project using a legacy `@theme { shadow-N: ...
  }` / `border-N` / `radius-N` / `density-N` / `surface-<role>` /
  `button-<role>` / `input-<role>` block without also setting the
  equivalent field on `theme` itself. `index.ts` merged legacy declarations
  under the *resolved* effective theme (`{ ...legacy, ...effectiveTheme.shadows
  }`), which only ever meant "legacy loses to an explicit override" back
  when `DEFAULT_THEME` didn't define these seven families at all — once it
  does, `effectiveTheme.shadows` is always populated by the default, so
  legacy silently lost to the default instead of winning as documented
  ("defaults < legacy < explicit override"). Fixed by merging legacy
  declarations under the *unresolved* theme the caller/discovery actually
  provided, for all seven families, and now covered by a fake-`npm`-free
  regression test per family (four already existed; density did not and is
  new here).
- `typography-defaults.ts`'s `DEFAULT_TYPOGRAPHY` no longer feeds
  `DEFAULT_THEME.typography_details` (the JSON's own is already complete on
  its own terms) — left in place, unused, as MIG-B6-17's own explicit
  exception to remove. A `@ds-typo` role with no explicit
  `typography_details` entry of its own no longer inherits
  `textTransform`/`textDecoration`/`fontStyle`/`marginBlockStart`/
  `marginBlockEnd` from a `typography_details.default` that used to
  provide them (the base JSON's own `default` role provides
  `fontSize`/`fontWeight`/`lineHeight`/`letterSpacing` instead) —
  reconciling `@ds-typo`'s consumption side with the new shape is
  MIG-B6-17's stated scope, not this change's.
- `theme/base.json` is generated nowhere and hand-edited directly; the
  legacy `default-{densities,borders,radii,shadows,buttons,inputs,
  surfaces}.uxdsl`/`default-spacing.css`/`default-typography.uxdsl` packs
  remain generated *from* it via `scripts/generate-language-artifacts.js`
  (unchanged mechanism, now reading a JSON-derived engine default instead
  of a hardcoded one). `default-colors.css`/`default-palette.css` are a
  deliberately separate, richer, opt-in legacy palette (a different design
  direction, not this JSON) and are untouched.
- The Next.js playground's own copy of this file
  (`packages/playground-nextjs/uxdsl.theme.base.json`) is deleted;
  `packages/playground-nextjs/themes.js` now requires
  `postcss-uxdsl/theme/base.json` instead.
- **Not yet done** (explicitly later parts of this same story, per its own
  multi-phase scope): the accessibility contrast gate (`checkThemeContrast`)
  has not run against this theme yet, so none of its colors have been
  verified or corrected for contrast; the Google Fonts URL is not yet
  percent-encoded (a family name with a space would currently produce an
  invalid URL — the shipped default has none, so it is unaffected); and
  `generateThemeCss()` (the runtime/SSR path) does not emit the Google
  Fonts `@import` at all yet — only the PostCSS plugin does. Neither
  Google Fonts gap is new (both already existed for any project that had
  set `fonts.google` explicitly); both simply become visible on the
  *default* path now that `fonts.google` ships by default.

FEAT-008, MIG-B6-28:

- **Packaging:** the published tarball now declares an explicit `files`
  field (`dist`, `src/theme`, the two documented `scripts/codemod-*.js`
  entry points, `README.md`, `CHANGELOG.md`) instead of shipping everything
  not gitignored. The tarball dropped from ~2 040 KB (117 files — three
  README images totalling ~1 930 KB, 19 test files, and every loose `.ts`
  source alongside its compiled `dist/` output) to ~87 KB (61 files). The
  three README images now load from an absolute GitHub URL instead of a
  relative path that only ever resolved inside this repository, and the
  `docs/migration.md` link does the same, since `docs/` is no longer
  shipped either (pure prose, no runtime import ever pointed at it).
- **Fix:** `src/theme/theme-manifest.json`'s `defaults.files.motion` pointed
  at `src/theme/default-motion.css`, which has never existed. Removed; a
  new `test/theme-manifest-files.test.js` now fails if any `defaults.files`
  entry ever points somewhere outside the real packed tarball again.
- Not otherwise a `postcss-uxdsl` runtime/compiler change — this story's
  broader scope (pack-size budgets, dist-tag verification) lives in
  `scripts/release.js`, outside any single published package.

FEAT-008, MIG-B6-26:

- **New:** `getToneFamilies(palette)` exported from `language.ts` — the
  exact tone predicate `control-engine.ts`'s button/input tone generation
  already used (a full color family with `main`/`dark`/`contrast`, not a
  partial semantic group like `divider`), moved here so `uxdsl-vscode`'s
  completion generator can derive the same tone list from
  `DEFAULT_THEME.palette` without duplicating the predicate by hand.
  `control-engine.ts` now imports and reuses it; no behavior change.
- Not a `postcss-uxdsl` runtime change otherwise — this story's actual
  scope is `packages/uxdsl-vscode` (grammar/completion/custom-data
  generation, packaging). See that package's own `CHANGELOG.md`.

FEAT-008, MIG-B6-15:

- **Fix:** `@ds-button`/`@ds-input`'s host selector used to be split on
  every comma, including commas inside a functional pseudo-class's own
  argument list (`:is(.x, .y)`, `:where(...)`, `:not(...)`, `:has(...)`).
  `.btn:is(.x, .y) { @ds-button(...); }` generated the invalid
  `.btn:is(.x:hover, .y):hover` instead of `.btn:is(.x, .y):hover`. Now
  uses `postcss.list.comma`, which only splits top-level commas.
  `@ds-surface` was never affected — it inserts declarations directly
  into the host rule rather than generating a separate selector list.
- **Fix:** `!important` on a responsive value (`padding: xs(1rem)
  md(2rem) !important;`) was kept in the base breakpoint's declaration
  but silently dropped from every `@media` block generated for the
  other breakpoints, so a competing, non-responsive `!important`
  declaration elsewhere in the cascade could still win from md/lg/xl up.

FEAT-008, MIG-B6-14:

- **Fix:** three cases where compiled output silently didn't reflect the
  source now fail instead. A directive (`@ds-typo`/`@ds-surface`/
  `@ds-button`/`@ds-input`) that isn't a direct child of the rule it styles
  — at the document root, or nested inside `@media`/`@supports` under that
  rule — now fails as `UXD_DIRECTIVE_CONTEXT` instead of reaching CSS
  untouched for a browser to silently discard, along with everything
  inside it. A reserved-namespace at-rule that isn't a real directive (a
  typo, or an alias like `@ds-h1`/`@ds(h1)` that was never implemented
  despite an old comment claiming otherwise) fails as
  `UXD_DIRECTIVE_UNKNOWN`, with a suggestion when a real directive is one
  edit away. A top-level value function that is neither a configured
  breakpoint nor a known CSS function — `padding: xs(1rem) xxl(2rem);`,
  `xxl` unconfigured — now fails as `UXD_BREAKPOINT_UNKNOWN` when it
  co-occurs with a real breakpoint function or sits at edit distance 1 from
  one; `KNOWN_CSS_FUNCTIONS` (new export from `./language`) is consulted
  first so a real `log(...)` next to `lg(...)` is never misread as a typo.
- **Fix:** `color()` is now recognized as a token reference only when its
  first argument has a token's shape (`color(primary)`, `color(blue.500)`);
  any other form — relative color syntax, an explicit color space — passes
  through untouched. Replaces a fixed, necessarily incomplete list of known
  color-space keywords.
- **Fix:** a `$var` holding a responsive expression
  (`$gap: xs(1rem) md(2rem);`) now expands correctly when this plugin runs
  standalone, matching what a build that resolves `$var`s ahead of this
  plugin already produced. Substitution now happens before responsive
  expansion instead of after it.

FEAT-008, MIG-B6-13:

- **Fix:** CSS diagnostics now retain their source location through PostCSS,
  reference validation and the CLI, including imported partials. The CLI prints
  a color-free code frame, and diagnostics identify invalid theme key paths.

FEAT-007 / FEAT-008 (`0.5.0-beta.6`), MIG-B6-01:

- **Fix (regression from beta.5):** `validateAndNormalizeTheme` no longer
  warns about entry names inside `typography_details` (tags), `palette`
  (roles) and `fonts.families` (roles). beta.5 compared those names
  against `DEFAULT_THEME`'s own key sets (4 palette roles, 3 font roles,
  2 typography tags) and warned that anything else "will not be compiled
  into any CSS". That was a false positive: `DEFAULT_THEME` is a
  deliberately minimal zero-crash fallback, not a catalog of permitted
  names, and all three families are open registries — `foundations.ts`
  emits a CSS var for every key a theme provides, and `typography.ts`
  validates a tag name by shape only. Any project with a richer palette,
  a custom font role or a custom typography tag got the warning on every
  plain `uxdsl build`/`watch`, with no flag to opt out. Removed at the
  source rather than repointed at a longer list, because no closed list
  of valid entry names exists to point at.
- The closed top-level family registry now includes `modes` and legacy
  `typography`, both already consumed by the compiler. They no longer emit
  false "will not be compiled" warnings; unknown top-level names still do.
- The public runtime exports `KNOWN_THEME_FAMILIES`. AST negative controls
  cover optional/literal access and destructuring; executable README and
  playground-base tests protect the documented validation contract.
- Unchanged by that fix, and covered by new regression tests:
  MIG-B3-03's top-level "Unknown theme family" warning (`palete` for
  `palette`) — that family set genuinely is closed — and the hard
  `UXD_TYPO_FIELD` error for a misspelled *field* inside a typography tag
  (`fontsize` for `fontSize`), whose `TYPOGRAPHY_PROPERTIES` list is also
  closed. `--strict-theme` and its family scoping are untouched.
- Tests: `test/theme-validate-open-registries.test.js` (three open
  registries, the top-level negative control, and the closed-field
  error), a CLI no-warning regression test, and
  `fixtures/mig-b5-03-release/run.js` — the beta.5 release gate — updated
  to assert from a real build that the reverted warning stays gone while
  the top-level one still prints.

## 0.5.0-beta.5 — 2026-09-17

FEAT-006 (`0.5.0-beta.5`), MIG-B5-01 through MIG-B5-03 (all three stories):

- `uxdsl build`/`watch --strict-theme` and `uxdsl theme --strict` now
  accept an optional family scope (`--strict-theme=palette,breakpoints`,
  or `strictTheme: ['palette', 'breakpoints']` in `uxdsl.config.cjs`),
  checking only the named families instead of every family the project
  touched. Fixes a real false positive: `typography_details` documents
  per-key partial override as the intended pattern, but the bare
  `--strict-theme` (unchanged, still available) flags any such override as
  "incomplete" — and the same is true of the zero-config `palette`
  example this package's own README uses, and of a partial `spacing`
  override, not just `typography_details`. Purely additive; `true`
  (or the bare flag) behaves exactly as it did in beta.4.
- `validateAndNormalizeTheme` now also warns about an unrecognized entry
  name inside `typography_details` (tags), `palette` (roles) and
  `fonts.families` (roles) — a typo (`h9`, `primry`) — without requiring
  every entry to be present, since partial per-entry override is the
  intended usage for all three. These warnings, and MIG-B3-03's own
  top-level "Unknown theme family" warning from FEAT-004, now also print
  from a real `uxdsl build`/`watch` — previously neither reached the CLI
  at all, only the playground's theme editor called
  `validateAndNormalizeTheme`. Deduplicated by exact message across
  rebuilds in one `watch` session.
- Release gate (`fixtures/mig-b5-03-release/`, `npm run verify:beta5`)
  reproducing the origin report's exact scenario against real tarballs of
  the five coordinated packages.
- Fixed unrelated to this feature's own work but caught while building
  its release gate: `theme-manifest.json`'s `uxdslVersion` had gone stale
  again after the beta.4 publish bumped every package's version — the
  same class of drift MIG-B4-04 patched once for beta.4 itself without
  fixing the cause. `scripts/release.js` now runs
  `generate-language-artifacts.js` automatically after bumping every
  package's version (and building `postcss-uxdsl`, which it depends on),
  instead of relying on someone remembering to run it by hand.

## 0.5.0-beta.4 — 2026-09-17

FEAT-005 (`0.5.0-beta.4`), MIG-B4-01 through MIG-B4-04 (all four stories):

- `uxdsl build`/`watch` (uxdsl-cli) now watch every local module a build
  config or theme file `require()`s transitively, not just the top-level
  file — `clearRequireCache` already walked that exact tree to invalidate
  the cache; the same walk (`collectLocalRequireTree`) now also populates
  the watch list. Editing a module the config/theme delegates to
  (`module.exports = require('./real-config.js')`, or a theme that reads
  `require('./theme-data.json')`) now triggers a rebuild on its own,
  without touching the file that requires it.
- `uxdsl build`/`watch` accept `--strict-theme` (or `strictTheme: true` in
  `uxdsl.config.cjs`), reusing the same check `uxdsl theme --strict`
  already ran — fails before writing anything if a declared theme family
  ended up partially filled from `DEFAULT_THEME`. Defaults to `false`, and
  is checked once per build even with a `builds` array (the theme is
  shared across every entry).
- `uxdsl init --multi` scaffolds a theme entry plus one example component
  entry (a `builds` array) directly, instead of starting from the
  single-entry form and hand-writing `builds` from the README. Plain
  `init` (no flag) is unaffected.
- Release gate (`fixtures/mig-b4-04-release/`, `npm run verify:beta4`)
  reproducing all three stories above against real tarballs of the five
  coordinated packages.
- Fixed unrelated to this feature's own work but caught while building its
  release gate: `theme-manifest.json`'s `uxdslVersion` had gone stale at
  `0.5.0-beta.2` after the beta.3 publish bumped every package's own
  version — `npm run generate:language` wasn't re-run afterward. Re-run
  now; the root `npm test`'s drift check (`generate-language-artifacts.js
  --check`) catches this going forward, but only when it's actually run.

## 0.5.0-beta.3 — 2026-09-16

FEAT-004 (`0.5.0-beta.3`), MIG-B3-01 through MIG-B3-06 (all six stories):

- `uxdsl build`/`watch` (uxdsl-cli) now forward `includeTheme` to the plugin
  (`--include-theme`/`--no-include-theme`, or `includeTheme` in
  `uxdsl.config.cjs`) — it was previously unreachable from the CLI, forcing
  every CLI build to emit global `:root` even for a component/CSS-Module
  entry meant to only consume tokens.
- `theme.breakpoints` (already supported and validated by the plugin) is no
  longer permanently shadowed by the CLI's own `config.breakpoints ||
  DEFAULT_BREAKPOINTS` fallback — config and theme breakpoints now merge
  onto the shared defaults, config winning key-for-key.
- The CLI's `#uxdsl-bp-meta` runtime marker and `@uxdsl-bp` comment are
  emitted once, by the entry that has `includeTheme: true`, instead of once
  per compiled entry.
- `validateAndNormalizeTheme` (`postcss-uxdsl/ds-runtime`) now warns about
  any top-level theme key it doesn't recognize, instead of silently
  ignoring it — catches a typo (`color` for `colors`) or a build config
  accidentally saved under a theme-file name.
- `uxdsl.theme.config.*`/`uxdsl.theme.json` files shaped like a build config
  (no `theme`/`references` key, but `entry`/`outFile`/`watch`/... present)
  now print a CLI warning naming the file and the stray keys, deduplicated
  across watch-mode rebuilds.
- New `uxdsl theme` command prints the resolved effective theme as JSON,
  using the same discovery/resolution `build` uses. `--diff` shows only the
  families the project's own config/theme mentions, one row per leaf,
  labeled `project` or `default` by presence in the raw theme (not value
  equality — a value that happens to match the default is still yours if
  you wrote it). `--strict` exits non-zero if a declared family ended up
  partially filled from defaults.
- `uxdsl.config.cjs` can now declare a `builds` array — several
  `{ entry, outFile, includeTheme }` entries compiled against one shared
  `theme`/`references`/`breakpoints` from a single `build`/`watch`
  invocation and one watcher, instead of running the CLI once per entry.
  Every entry compiles in memory before any of them are written, so a
  failure in one leaves every output file untouched rather than partially
  rebuilt.
- Repo tooling: `scripts/verify-docs-update.js` (the pre-commit docs guard)
  now also requires `CHANGELOG.md` — not just any README — when a commit
  touches `default-theme.ts`, `typography-defaults.ts` or `typography.ts`,
  since those files define default *visual* output. See the "Visual
  changes" entry under 0.5.0-beta.2 below for why this exists.
- `fixtures/mig-b3-06-release/` (`npm run verify:beta3`) reproduces the
  origin consumer report end to end against real tarballs of all five
  packages: a theme entry plus four component entries built from one
  `builds` array, zero duplicate `:root`/`#uxdsl-bp-meta`, a
  theme-file-only `breakpoints.xl` reaching a component entry's media
  query, and both negative controls.

## 0.5.0-beta.2 — 2026-09-16

FEAT-003 (`0.5.0-beta.2`), MIG-B2-01 through MIG-B2-05:

- Fresh CLI `init` + `build` works with no theme; missing scripts are added
  without replacing user scripts. Generated entries use compiler defaults.
- Default heading Typography is shared with generated compatibility artifacts.
- Namespace migration preserves host font variables (including Next Geist),
  object keys and explicit identity mappings; preview/write remain idempotent.
- Coordinated five-package tarball gate covers partial themes, external fonts,
  fallback/negative cases and CLI/PostCSS/runtime parity.
- CLI watch reloads local config dependencies, updates watched paths when
  `themeFile` or patterns change, and ignores its current output file.

### Added

- `resolveTheme(override)` / `DEFAULT_THEME` / `getDefaultTheme()`
  (exported from `postcss-uxdsl/ds-runtime`): an omitted or partial `theme`
  now resolves against a built-in default (Spacing 1-16, Palette
  `primary`/`surface`/`neutral`/`error`, font families `ui`/`ui-2`/`code`)
  instead of leaving those families' `var()` references undefined.
  `generateThemeCss()` with no arguments now generates valid CSS; before
  this it returned an empty string. The PostCSS plugin resolves through
  the same function, so both always agree on the same effective theme.
- `uxdsl.theme.config.cjs`/`.js`/`.json` (or `uxdsl.theme.json`), discovered
  automatically by `uxdsl-cli` next to `uxdsl.config.cjs` — see that
  package's own CHANGELOG/README for the full contract (`references`
  precedence, `themeFile`, `UXDSL_DEBUG`).

### Fixed

- A `theme` that isn't `undefined`/`null` or a plain object now throws
  `UXD_THEME_INVALID` instead of being silently ignored.

### Visual changes

- Added retroactively (FEAT-004/MIG-B3-05): `h2`/`h3`'s default `line-height`
  became responsive — `h2: xs(1.2) md(1.15)`, `h3: xs(1.3) md(1.25)`,
  instead of the flat `1.2`/`1.3` every other beta used. Only projects with
  no `typography_details.h2`/`.h3` override of their own are affected. This
  shipped in beta.2 without a changelog note; recorded here once a beta.2
  consumer's migration report surfaced it as an unannounced visual change.

## 0.5.0-beta.1 — 2026-09-15

- FEAT-002: explicit namespace migration included in 0.5.0-beta.1, with
  preview/write codemod and explicit mappings for host tokens/custom roles.
- Shared radius/shadow directive-argument completion metadata for VS Code.
- Reference-integrity regression coverage and atomic playground theme application.
- Integrated tarball → Next.js strict CSS Modules → Chrome computed-style checks.

### Added

- `includeTheme` plugin option: set to `false` on a component/CSS-Module
  entry so it only *consumes* tokens a separate `includeTheme: true` theme
  entry already defines, instead of re-emitting duplicate `:root`
  declarations (and the bare `:root` selector CSS Modules loaders reject).
- Reference integrity validation: every compilation now checks that each
  `var(--token)` it emits resolves to an actual definition, failing the
  build by default (`UXD_REFERENCE_MISSING` / `UXD_REFERENCE_CYCLE`) with
  the full dependency chain. Configurable via a new `references` option
  (`mode: 'error' | 'warn' | 'off'`, `css`, `externalTokens`, `onWarning`).
- `border(1..5)` now resolves without configuring `theme.colors.gray`
  yourself — the default presets' `color(gray.300..600)` dependency is
  supplied automatically (your own shades still win per-key).
- `radius(key)` / `shadow(key)` override arguments on
  `@ds-surface`/`@ds-button`/`@ds-input`, so radius and shadow can be set
  independently of the numeric `size` argument (and of each other)
  instead of requiring a manual `border-radius`/`box-shadow` override
  after the mixin.
- `scripts/codemod-size-overrides.js` (`npm run codemod:size-overrides`):
  folds an existing manual `border-radius: radius(N);` /
  `box-shadow: shadow(N);` override that follows a sized mixin call into
  the new `radius()`/`shadow()` argument syntax. Preview by default,
  `--write` to apply; idempotent; flags ambiguous cases (multiple
  candidate declarations, non-token values, `!important`, a nearer second
  mixin call, an interleaved corner longhand, an interleaved `all` reset,
  an interleaved nested rule/at-rule such as `@media`) for manual review
  instead of guessing.

### Changed

- Every CSS custom property this compiler generates or consumes now
  shares one `--uxdsl__<family>__<key>` shape, centralized in
  `src/naming.ts`. Previously only palette/color carried a namespace
  (`--ds__palette__primary-main`); every other family used a bare
  `--<family>-<key>` (`--space-1`, `--radius-2`,
  `--surface-contained-padding`, `--h1-size`, `--font-ui`). Now all of
  them do: `--uxdsl__space__1`, `--uxdsl__radius__2`,
  `--uxdsl__surface__contained-padding`, `--uxdsl__typography__h1-size`,
  `--uxdsl__font__ui`, `--uxdsl__palette__primary-main`,
  `--uxdsl__color__gray-300`. This makes a UXDSL-generated variable
  unambiguous to spot in devtools, generated CSS or a diagnostic message.
  The DSL syntax (`palette()`, `space()`, `@ds-surface`, ...) and theme
  JSON's logical keys are unchanged — only the generated CSS variable
  name. The one deliberate exception is a flat `theme.typography` entry
  (not `theme.typography_details`): its JSON key is still emitted
  verbatim, since that name is the consumer's own choice, not one this
  compiler assigns. Done while the package is still unpublished (0.3.0,
  no npm release) — the safest time for a public-name change, since there
  is no external consumer yet to alias, deprecate or break. See
  [`docs/migration.md`](https://github.com/rsantoyo-dev/uxdsl/blob/main/packages/postcss-uxdsl/docs/migration.md)
  for the full before/after table.
- `ds-runtime`'s `updatePalette`/`getPalette`/`resetPalette` no longer
  write or read a second, bare `--<token>` alias alongside the canonical
  `--uxdsl__palette__<token>` name. That dual-write predated this
  changelog entry and was never documented publicly; removing it is a
  cleanup, not a deprecation. The compatibility strategy for a consumer
  that already reads/writes the previous plain-family variable names
  directly (not through this runtime) is still an open decision — see
  MIG-08 in `docs/features/FEAT-002-beta-migration-hardening.md`.

### Fixed

- `package.json`'s `exports` map was missing `"./package.json"`, so an
  external consumer resolving `require("postcss-uxdsl/package.json")` (a
  common way to read a dependency's own version) got
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Found via `fixtures/mig07-consumer`,
  which installs this package from a real `npm pack` tarball instead of
  importing the monorepo source — a class of issue source imports can't
  surface, since they never go through Node's `exports` resolution.
- Spacing keys: `"space-1"` and `"1"` in `theme.spacing` now both resolve
  to `--uxdsl__space__1` (previously `"space-1"` doubled the prefix to
  `--space-space-1`). Defining both spellings for the same key in one
  config now raises `UXD_SPACING_COLLISION` instead of one silently
  winning by object-key order.
- Naming collisions: two different logical identifiers that concatenate to
  the same generated CSS variable name (e.g. palette key `"primary-main"`
  vs. structured `palette.primary.main`; a surface/button/input/edge/
  shadow family+key pair colliding with a different one, such as a token
  key literally containing `__` landing on the family/key separator) now
  raise `UXD_FOUNDATION_NAME_COLLISION` / `UXD_PRESET_NAME_COLLISION`
  instead of one silently overwriting the other.

### Known limitations

- The shipped default Density scale (`space(1)` through `space(16)`)
  still needs your theme to cover that full spacing range to validate
  strictly — there is no default spacing scale, unlike the `gray` color
  scale `border(1..5)` now gets automatically.
- `includeTheme: false` still requires passing the same `theme` object to
  every entry; there's no way yet for a component entry to validate
  against a theme it doesn't otherwise need to know about.
