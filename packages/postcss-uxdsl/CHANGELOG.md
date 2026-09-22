# Changelog

All notable changes to `postcss-uxdsl` are documented here. Dates are
omitted for entries that have not been published to npm — the package
version stays at whatever `package.json` currently says until a release
actually happens. See
[`docs/migration.md`](https://github.com/rsantoyo-dev/uxdsl/blob/main/packages/postcss-uxdsl/docs/migration.md)
for a narrative migration guide covering the same ground.

## 0.5.0-beta.6 — unreleased

FEAT-008, MIG-B6-29 (part 1 of this story — see "Not yet done" below):

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
