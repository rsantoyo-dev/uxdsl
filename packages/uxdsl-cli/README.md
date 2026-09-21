# uxdsl-cli

> The official command-line interface for compiling **UXDSL** files into optimized CSS.

[![npm version](https://img.shields.io/npm/v/uxdsl-cli.svg)](https://www.npmjs.com/package/uxdsl-cli)
[![License](https://img.shields.io/npm/l/uxdsl-cli.svg)](LICENSE)

**[Visit the Official Documentation & Playground](https://uxdsl.vercel.app/)**

---

## Overview

`uxdsl-cli` is a standalone build tool designed to compile `.uxdsl` files into standard CSS.

### Why does this exist?
While UXDSL has plugins for [Vite](../vite-plugin-uxdsl) and [Webpack](../uxdsl-webpack-loader), there are many scenarios where a dedicated build process is preferred or required:
- **Framework Agnostic**: Use UXDSL with any framework or static site generator (Next.js, CLI tools, legacy apps) by simply generating a CSS file.
- **Performance**: Run your CSS compilation in a separate process or during a build step, keeping your main bundler fast.
- **Watch Mode**: Includes a robust file watcher that recompiles your styles instantly as you edit your `.uxdsl` files.

The CLI's `@import`/`$var`/theme compilation pipeline is the shared
[`compile()`](../uxdsl-core#compile-input-config) from `uxdsl-core` — the
same pipeline any future Vite/Webpack adapter will use, so behavior can't
silently drift between them. Two related, user-visible fixes came with
that: a missing `@import` now always fails with a located error instead of
silently passing the `@import` line through untouched, and an import cycle
(`a.uxdsl` importing `b.uxdsl` importing `a.uxdsl`) now always fails naming
the file chain instead of silently duplicating content once.

---

## Installation

```bash
# Install locally in your project (Recommended)
npm install -D uxdsl-cli@beta postcss-uxdsl@beta

# Or install globally
npm install -g uxdsl-cli
```

For a new project, run the first-run setup after installation:

```bash
npx uxdsl init
npm run uxdsl:build
```

`init` creates `uxdsl.config.cjs` and `src/uxdsl-entry.uxdsl`, adds the
`uxdsl:build` and `uxdsl:watch` scripts when they are missing, and never
overwrites existing project configuration. The generated entry gets the
canonical default theme from `postcss-uxdsl`; it does not need to import the
legacy `default-*` packs. Import the generated `src/uxdsl.css` once from the
application's root layout or entrypoint.

Already know the project needs a theme plus several CSS-Module panels?
`npx uxdsl init --multi` scaffolds that shape directly — a `builds` array in
`uxdsl.config.cjs` with a theme entry (`src/theme.uxdsl`) and one example
component entry (`src/panel-a.uxdsl`, `includeTheme: false`) — instead of
starting from the single-entry form and hand-writing `builds` from the
"Multiple entries, one shared theme" section below. Add more entries to the
array as the project grows.

## Usage

### 1. Configuration (Recommended)

Create an `uxdsl.config.cjs` file in your project root to define your entry point, output file, and watch paths.

```js
const path = require('path');

module.exports = {
  // The main entry file that imports all your styles
  entry: path.join(process.cwd(), 'src/app/uxdsl-entry.uxdsl'),
  
  // Where the compiled CSS should be saved
  outFile: path.join(process.cwd(), 'src/app/uxdsl.css'),
  
  // Custom breakpoints (optional)
  breakpoints: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 },
  
  // Files to watch for changes
  watch: ['src/**/*.uxdsl', 'src/**/*.css'],
};
```

If `breakpoints` is omitted, CLI uses UXDSL shared defaults:

```ts
{ xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 }
```

### 2. Theme configuration (`uxdsl.theme.config.cjs`)

Keep your theme separate from build settings by adding a theme config file
next to `uxdsl.config.cjs`. The CLI discovers it automatically — no import
needed in `uxdsl.config.cjs`:

```text
uxdsl.theme.config.cjs   (or .js / .json, or uxdsl.theme.json)
```

It can export the theme directly:

```js
module.exports = {
  fonts: { families: { ui: 'var(--font-geist-sans, Arial, sans-serif)' } },
};
```

...or `{ theme, references }` explicitly — the recommended form once you
reference a host variable UXDSL doesn't define itself, such as a
framework-injected font variable:

```js
module.exports = {
  theme: {
    fonts: { families: { ui: 'var(--font-geist-sans)' } },
  },
  references: {
    externalTokens: ['--font-geist-sans'],
  },
};
```

`references.externalTokens` tells the reference-integrity check (on by
default — see `postcss-uxdsl`'s README) that a variable with no fallback is
guaranteed by the host, instead of failing the build with
`UXD_REFERENCE_MISSING`. If `references` is declared in **both**
`uxdsl.config.cjs` and the theme file, the build config's value wins
completely (they are not merged):

```js
// uxdsl.config.cjs
module.exports = {
  entry: './src/uxdsl-entry.uxdsl',
  outFile: './src/uxdsl.css',
  references: { externalTokens: ['--font-geist-sans', '--font-geist-mono'] },
};
```

A custom path can be pointed to explicitly with `themeFile` in
`uxdsl.config.cjs` (resolved relative to that config file, taking priority
over the conventional name):

```js
module.exports = {
  entry: './src/uxdsl-entry.uxdsl',
  outFile: './src/uxdsl.css',
  themeFile: './config/brand-theme.cjs',
};
```

The theme file is added to the watch list automatically. Set `UXDSL_DEBUG=1`
to see which config and theme files were discovered, and which external
tokens were loaded (never their values):

```bash
UXDSL_DEBUG=1 npx uxdsl build
```

If a theme file has no `theme` or `references` key, its entire export is
treated as theme data (see the two forms above). If that export also has
build-config-shaped keys (`entry`, `outFile`, `watch`, `themeFile`,
`plugins`, `builds`) — typically a `uxdsl.config.cjs` accidentally saved
under the theme-file name — the CLI prints a warning naming the file and
the stray keys instead of silently ignoring them as unknown tokens.

`build`/`watch` also warn about an unrecognized top-level theme family
(`color` instead of `colors`) — a typo that would otherwise compile into
nothing, silently. It is a warning, not an error: the build still
succeeds, and the same message is never repeated across rebuilds in one
`watch` session.

Entry *names* inside `typography_details`/`palette`/`fonts.families` are
not checked against any list — those are open registries, so a role or
tag your project invents compiles normally. (beta.5 warned on names
outside `postcss-uxdsl`'s own minimal defaults; beta.6 removed that
warning as a false positive.) A misspelled *field* inside a typography
tag — `fontsize` for `fontSize` — is still a hard `UXD_TYPO_FIELD` build
error.

## Diagnostics

Build failures from UXDSL include the source file, line, column and a code frame
when they originate in CSS, including imported partials. Theme failures name the
theme/configuration file and the invalid key path; diagnostic messages start with
their stable `UXD_*` code:

```console
$ npx uxdsl build
[uxdsl] Error: uxdsl.theme.config.cjs: UXD_EDGE_VALUE: Invalid token 1 (at radii.1).
```

Surfaces, Densities, Radii, Borders, Shadows and Typography details theme
errors all carry this key path today; Button/Input role/state errors and a
few lower-level theme-map checks do not yet.

### 3. Multiple entries, one shared theme (`includeTheme`)

`postcss-uxdsl`'s `includeTheme` option (see that package's README) reaches
`uxdsl build`/`watch` directly, so a theme entry and any number of
component/CSS-Module entries can each be built with the CLI, without a
custom PostCSS pipeline:

```bash
npx uxdsl build --entry src/theme.uxdsl   --out src/theme.css
npx uxdsl build --entry src/panel-a.uxdsl --out src/panel-a.css --no-include-theme
```

`--include-theme`/`--no-include-theme` always overrides `includeTheme` in
`uxdsl.config.cjs`; the config's own value is the default when the flag is
omitted, and `true` is the default when neither is set. With
`--no-include-theme`, the entry still validates every `space()`/`palette()`/
`@ds-surface`/`@ds-button`/`@ds-input` reference against the theme — it just
skips writing the global `:root` definitions and the runtime breakpoint
marker (`#uxdsl-bp-meta`), both of which belong to the one entry that does
define the theme.

`breakpoints` can now come from either `uxdsl.config.cjs` or the theme
file — both merge onto the shared defaults (config wins key-for-key), the
same partial-override contract the theme itself already has:

```js
// uxdsl.theme.config.cjs
module.exports = { breakpoints: { xl: 1440 } }; // xs/sm/md/lg keep their defaults
```

Running the CLI once per entry works, but a `builds` array in
`uxdsl.config.cjs` compiles all of them — against the one shared
`theme`/`references`/`breakpoints` — from a single `build`/`watch`
invocation and a single watcher, instead:

```js
module.exports = {
  builds: [
    { entry: './src/theme.uxdsl', outFile: './src/theme.css' }, // includeTheme: true is the default
    { entry: './src/panel-a.uxdsl', outFile: './src/panel-a.css', includeTheme: false },
    { entry: './src/panel-b.uxdsl', outFile: './src/panel-b.css', includeTheme: false },
  ],
  watch: ['src/**/*.uxdsl'],
};
```

`builds` cannot be combined with a top-level `entry`/`outFile` — declare
every entry inside `builds` instead. `--include-theme`/`--no-include-theme`
still overrides every entry uniformly when passed; without the flag, each
entry uses its own `includeTheme` (default `true`). Every entry is
compiled in memory before anything is written: a failure in any one of
them aborts the whole build with no output files touched at all, rather
than leaving some freshly rebuilt and others missing or stale.

### 4. Running the CLI

Add scripts to your `package.json` or run directly via `npx`:

```bash
# Build once for production
npx uxdsl build

# Watch mode for development
npx uxdsl build --watch
```

Watch mode reloads `uxdsl.config.cjs` and the theme file from disk on every
rebuild — editing either while `watch` is running takes effect on the next
save. The output file (`outFile`) is automatically excluded from the watch
list even if a broader glob like `src/**/*.css` would otherwise match it,
so the CLI's own write never re-triggers itself, including after changing
`outFile`. Changes to `watch` patterns or `themeFile` update the active watcher
without restarting the CLI. Local modules the config or theme file
`require()`s — transitively, at any depth — are watched automatically too;
editing one of them alone (without touching the file that requires it)
triggers a rebuild. `node_modules` dependencies are excluded, since they
don't change between rebuilds.

### 5. CLI Arguments (No Config)

You can also skip the config file and pass paths directly via command line arguments:

```bash
npx uxdsl build --entry src/app/uxdsl-entry.uxdsl --out src/app/uxdsl.css --watch
```

### 6. Theme introspection (`uxdsl theme`)

Print the theme your build actually resolves — same discovery
(`uxdsl.config.cjs`/`--config`/`--entry`+`--out`) and resolution
(`resolveTheme`) as `build`, no CSS written:

```bash
npx uxdsl theme
```

`--diff` prints only the families your own `uxdsl.config.cjs`/theme file
mentions, one row per leaf, each labeled `"project"` (you supplied that
value) or `"default"` (silently inherited from `postcss-uxdsl`'s
`DEFAULT_THEME`) — instead of the full resolved tree:

```bash
npx uxdsl theme --diff
```

```json
[
  { "path": "palette.primary.main", "value": "#123456", "source": "project" },
  { "path": "palette.primary.dark", "value": "#581c87", "source": "default" }
]
```

`--strict` exits non-zero if any family you declared ended up partially
filled from defaults — the case a plain diff of compiled CSS can't
distinguish from "this value happens to match the default anyway":

```bash
npx uxdsl theme --strict
```

`--strict=palette,breakpoints` scopes the check to only those families —
see `--strict-theme`'s own note below for why this is usually what you
want over the bare flag.

Both flags combine. Output is always parseable JSON on stdout (no log
lines mixed in), so `uxdsl theme` composes with `| jq` or a script —
except when `UXDSL_DEBUG=1` is also set, which prints its own discovery
lines the same way `build` does; the two aren't meant to be combined when
a script needs clean JSON.

### 7. Failing the build on partial theme inheritance (`--strict-theme`)

The same check `uxdsl theme --strict` runs is also reachable directly from
`build`/`watch`, so CI doesn't need a separate `uxdsl theme` step to catch
it:

```bash
npx uxdsl build --strict-theme
```

Fails before writing anything if a theme family you declared (via
`uxdsl.config.cjs`'s `theme`, or a theme file) ended up partially filled
from `DEFAULT_THEME`. Defaults to `false` — an existing project never
starts failing builds it didn't ask to be stricter about just from
upgrading. `strictTheme: true` in `uxdsl.config.cjs` has the same effect;
`--strict-theme`/`--no-strict-theme` on the command line always overrides
it. With a `builds` array, the shared theme is checked once, not once per
entry.

**Scope it to specific families** — recommended for most projects:

```bash
npx uxdsl build --strict-theme=palette,breakpoints
```

```js
// uxdsl.config.cjs
module.exports = {
  strictTheme: ['palette', 'breakpoints'],
};
```

`typography_details` documents per-key partial override as the intended
pattern (see "Guía de 5 entradas" and the migration guide) — declaring
`typography_details.h2.fontSize` alone and inheriting the rest of `h2`,
and every other tag, from `DEFAULT_THEME` is normal, encouraged usage, not
an oversight. The bare `--strict-theme` (every touched family) checks
`typography_details` too, so it tends to fail on exactly that recommended
usage — this isn't unique to `typography_details` either: the
zero-config `palette.primary.main` example a few sections up, and a
partial `spacing` override, are checked the same unforgiving way. Scoping
to the families you actually want fully specified (typically `palette`
and/or `breakpoints`) avoids the conflict while keeping the guarantee
where it's meaningful. `true` remains available for a project that
deliberately wants maximum strictness everywhere.

### 8. Strict flag parsing: accepted values, unknown flags, unknown families

Every flag accepts a fixed, explicit set of forms — anything else is a hard
error before any build runs, not a silent no-op:

| Flag | Accepted forms |
| --- | --- |
| `--include-theme` | bare (`true`), `--no-include-theme` (`false`), `=true`, `=false`. Any other value (`--include-theme=banana`) fails with `Invalid value for --include-theme: "banana"...`. |
| `--strict-theme` (build/watch) | bare (check every touched family), `--no-strict-theme`/`=false` (off), `=true` (same as bare), `=<family1>,<family2>` (scoped). `=true`/`=false` are recognized as the booleans they mean, not as families literally named "true"/"false". |
| `--strict` (theme) | same forms and rules as `--strict-theme`. |

A family name in `--strict-theme`/`--strict`/`strictTheme` (in
`uxdsl.config.cjs`) is validated against the same top-level family set the
compiler itself recognizes. A typo fails immediately with a suggestion:

```console
$ npx uxdsl build --strict-theme=pallete
[uxdsl] Error: Unknown theme family "pallete" in --strict-theme. Did you mean "palette"?
```

An unrecognized flag — a typo, or a real flag used on the wrong command
(`--strict` on `build` instead of `--strict-theme`, or `--watch` on
`theme`) — fails the same way instead of being silently ignored:

```console
$ npx uxdsl build --strict-thme
[uxdsl] Error: Unknown option --strict-thme. Did you mean --strict-theme?
```

`--help`/`-h` and every flag documented above are the only ones each
command accepts; a positional argument (a bare path with no leading `-`)
is never mistaken for a flag.

A stray comma in a family list is also rejected, not silently dropped:
`--strict-theme=,` and `--strict-theme=palette,,fonts` both fail with "A
family list cannot contain an empty entry" instead of quietly checking
zero or fewer families than you named. `--include-theme=0`/`=1` fail the
same way `=banana` does — only `true`/`false` (or the bare/`--no-` forms)
are accepted, never a number. If the resolved `postcss-uxdsl` install
predates the family registry this validates against, scoping to specific
families (`--strict-theme=palette`) fails with an "upgrade postcss-uxdsl"
error rather than silently skipping the check; the unscoped boolean form
(`--strict-theme`/`=false`) still works without it.

---

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
