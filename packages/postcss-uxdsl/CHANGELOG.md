# Changelog

All notable changes to `postcss-uxdsl` are documented here. Dates are
omitted for entries that have not been published to npm — the package
version stays at whatever `package.json` currently says until a release
actually happens. See [`docs/migration.md`](docs/migration.md) for a
narrative migration guide covering the same ground.

## 0.5.0-beta.3 — prepared, not published

FEAT-004 (`0.5.0-beta.3`), MIG-B3-01, MIG-B3-03 and MIG-B3-04 so far:

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
  [`docs/migration.md`](docs/migration.md) for the full before/after
  table.
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
