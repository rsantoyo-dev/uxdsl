# Changelog

All notable changes to `postcss-uxdsl` are documented here. Dates are
omitted for entries that have not been published to npm — the package
version stays at whatever `package.json` currently says until a release
actually happens. See [`docs/migration.md`](docs/migration.md) for a
narrative migration guide covering the same ground.

## Unreleased

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

### Fixed

- `package.json`'s `exports` map was missing `"./package.json"`, so an
  external consumer resolving `require("postcss-uxdsl/package.json")` (a
  common way to read a dependency's own version) got
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. Found via `fixtures/mig07-consumer`,
  which installs this package from a real `npm pack` tarball instead of
  importing the monorepo source — a class of issue source imports can't
  surface, since they never go through Node's `exports` resolution.
- Spacing keys: `"space-1"` and `"1"` in `theme.spacing` now both resolve
  to `--space-1` (previously `"space-1"` doubled the prefix to
  `--space-space-1`). Defining both spellings for the same key in one
  config now raises `UXD_SPACING_COLLISION` instead of one silently
  winning by object-key order.
- Naming collisions: two different logical identifiers that concatenate to
  the same generated CSS variable name (e.g. palette key `"primary-main"`
  vs. structured `palette.primary.main`; a surface/button/input/edge/
  shadow family+key pair colliding with a different one, such as family
  `"x"` key `"a-b"` vs. family `"x-a"` key `"b"`, both `--x-a-b`) now raise
  `UXD_FOUNDATION_NAME_COLLISION` / `UXD_PRESET_NAME_COLLISION` instead of
  one silently overwriting the other.

### Known limitations

- The shipped default Density scale (`space(1)` through `space(16)`)
  still needs your theme to cover that full spacing range to validate
  strictly — there is no default spacing scale, unlike the `gray` color
  scale `border(1..5)` now gets automatically.
- `includeTheme: false` still requires passing the same `theme` object to
  every entry; there's no way yet for a component entry to validate
  against a theme it doesn't otherwise need to know about.
