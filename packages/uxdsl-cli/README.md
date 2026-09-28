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
[`compile()`](../uxdsl-core/README.md#compileinput-config) from `uxdsl-core` — the
same pipeline the Vite plugin and the Webpack loader use, so behavior can't
silently drift between them. Two related, user-visible fixes came with
that in `0.5.0-beta.6`: a missing `@import` always fails with a located error
instead of silently passing the `@import` line through untouched, and an
import cycle (`a.uxdsl` importing `b.uxdsl` importing `a.uxdsl`) always fails
(`UXD_IMPORT_CYCLE`) naming the file chain instead of silently duplicating
content once.

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

`init` creates `uxdsl.config.cjs` and `src/uxdsl-entry.uxdsl` (and, in a
Next.js project without one, a `postcss.config.js`), adds the
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

## Editor support

Three kinds of help, from two mechanisms. None of them changes what compiles.

| What you get | In which file | How you get it |
| --- | --- | --- |
| Types, completion and typo detection | `uxdsl.config.cjs` | `init` already writes it, since `0.5.0-beta.7` (TypeScript types, through JSDoc) |
| Completion and validation of families, fields and states | your theme JSON | one `$schema` line (JSON Schema shipped in `postcss-uxdsl`) |
| Highlighting and completion | `.uxdsl` files | the `uxdsl-vscode` extension, installed from a `.vsix` |

### The build config: types from `init`

Since `0.5.0-beta.7`, the config `init` writes starts like this (its comments
omitted):

```js
// @ts-check
/** @type {import('postcss-uxdsl/config').UxdslConfig} */
const config = {
  entry: './src/uxdsl-entry.uxdsl',
  outFile: './src/uxdsl.css',
  watch: ['src/**/*.uxdsl', 'src/**/*.css'],
};

module.exports = config;
```

A mistyped key (`includeThem: false`, which the CLI would silently ignore) or a
wrong value type is then underlined as you type, in VS Code with no extension
and no TypeScript in the project. Each of the three details is load-bearing,
and each was measured against TypeScript 5.9 before `init` adopted it:

- **`// @ts-check`.** Editors do not check plain JavaScript by default; without
  this line the type only completes, it does not report the typo.
- **The type sits on a `const`.** Written as `/** @type {…} */` directly above
  `module.exports = {…}`, TypeScript checks nothing — not a typo, not even
  `entry: 123`.
- **It is a type import, not a `require`.** Nothing runs at build time. If the
  editor cannot resolve `postcss-uxdsl` from the project root, you lose the type
  (the editor reports *Cannot find module*); the build is unaffected.

To get the types, install `postcss-uxdsl` as a direct dependency of the project,
as the installation step above does. Under pnpm's strict `node_modules`, a
project that installed only `uxdsl-cli` cannot resolve it from its root. This is
also why `init` does not use `defineConfig`: `require('postcss-uxdsl/config')` in
that project **fails the build** instead of only losing the type (tested under
npm 10.8, pnpm 9.15 and Yarn 1.22). An existing config can adopt the same form by
hand; `init` never rewrites one that exists.

### The theme JSON: `$schema`

`init` does not create a theme file. A `uxdsl.theme.json` containing only
`$schema` compiles to byte-identical CSS, but it makes every build print
`[uxdsl] Theme config detected` — so the line is yours to add, in the theme file
you create when you first override something:

```json
{
  "$schema": "./node_modules/postcss-uxdsl/schema/theme.schema.json",
  "palette": { "primary": { "main": "#7e22ce", "contrast": "#ffffff" } }
}
```

The path is relative to the theme file itself. It is correct when the theme sits
at the project root next to a `node_modules` that contains `postcss-uxdsl` (npm,
Yarn, and pnpm with the package as a direct dependency). In a monorepo whose
`node_modules` is hoisted to the workspace root, point it there instead (for
example `../../node_modules/postcss-uxdsl/schema/theme.schema.json`), or map the
schema once in the editor instead of in the file — in VS Code,
`.vscode/settings.json`:

```jsonc
{
  "json.schemas": [
    {
      "fileMatch": ["uxdsl.theme.json"],
      "url": "./node_modules/postcss-uxdsl/schema/theme.schema.json"
    }
  ]
}
```

`$schema` is metadata: it compiles to nothing, and the theme validator does not
report it as an unknown family. `uxdsl theme --diff` does list it as a value
from your project, like any other key in the file. The `uxdsl.theme.config.cjs`
form has no `$schema`; see
[`postcss-uxdsl`'s "Typed config and theme"](https://github.com/rsantoyo-dev/uxdsl/blob/main/packages/postcss-uxdsl/README.md#typed-config-and-theme-defineconfig-schema)
for its TypeScript types and for which names the schema closes and which it
leaves open for your own roles.

### `.uxdsl` files: the VS Code extension

`uxdsl-vscode` highlights `.uxdsl` files and completes, by context: functions
(`palette()`, `density()`, `radius()`, the breakpoints…) inside a declaration
value, directives after `@`, and roles, tones and sizes inside
`@ds-surface(`/`@ds-button(`/`@ds-input(`. It also contributes CSS custom data
for the `@ds-*` directives to VS Code's CSS language service.

What it does **not** do (as of 2026-09-28): complete the roles and tones of
**your** theme (its suggestions come from the built-in default theme — accurate
until you add or rename roles), live diagnostics, hover, or go-to-definition.

As of 2026-09-28 it is not published to a marketplace; it is installed from a
`.vsix` built from this repository:

```bash
git clone https://github.com/rsantoyo-dev/uxdsl.git
cd uxdsl/packages/uxdsl-vscode
npm install
npm run package                               # writes uxdsl-vscode-<version>.vsix
code --install-extension uxdsl-vscode-*.vsix  # or: Extensions: Install from VSIX...
```

The extension's own
[README](https://github.com/rsantoyo-dev/uxdsl/blob/main/packages/uxdsl-vscode/README.md)
covers the `files.associations → scss` alternative and its trade-off.

### Other editors

As of 2026-09-28, only VS Code has been tested. The config types are ordinary TypeScript types and
the theme schema an ordinary JSON Schema, so an editor with a TypeScript language
server or JSON Schema support should be able to use them, and the extension's
`uxdsl.custom-data.json` follows VS Code's CSS custom data format — but none of
that has been verified in WebStorm, Neovim or any other editor.

## Before you upgrade

A new version can change a default in a family your theme never mentions — and
`theme --diff` and `--strict` only look at families you declared (see
[Theme introspection](#6-theme-introspection-uxdsl-theme)). `uxdsl theme` with no
flags prints the **effective** theme, every family included, as JSON on stdout.
Save it before upgrading, save it again after, and compare:

```bash
npx uxdsl theme > effective.before.json
npm install -D uxdsl-cli@<next> postcss-uxdsl@<next>
npx uxdsl theme > effective.after.json
diff effective.before.json effective.after.json
```

Keep both packages on the same version. What this shows, measured with one
project whose theme sets only `typography_details.h1.fontWeight`, upgraded from
`0.5.0-beta.5` to `0.5.0-beta.6` from the registry:

| | beta.5 | beta.6 |
| --- | --- | --- |
| bytes of `uxdsl theme` | 8 438 | 13 159 |
| top-level families | 4 | 15 |

Leaf keys per family, beta.6 against beta.5:

| Family | added | changed | removed |
| --- | --- | --- | --- |
| `modes` | 33 | — | — |
| `palette` | 43 | 5 | — |
| `inputs` | 23 | — | — |
| `surfaces` | 18 | — | — |
| `buttons` | 14 | — | — |
| `densities` | 16 | — | — |
| `fonts` | 1 | 2 | 1 |
| `typography_details` | 24 | 18 | 69 |

(plus `colors` 4, `breakpoints` 5, `borders` 5, `radii` 6, `shadows` 6 and
`typography` 1, all added). `theme --diff` on the same project, after the
upgrade, lists only the 78 `typography_details` rows.

**What this cannot show:** it compares the *theme*, not the compiled CSS. A
change in how the compiler emits CSS from the same theme — for example the order
of the Google Fonts `@import` fixed in `0.5.0-beta.7` — leaves both files
identical. Those changes are announced only in `postcss-uxdsl`'s
[CHANGELOG](https://github.com/rsantoyo-dev/uxdsl/blob/main/packages/postcss-uxdsl/CHANGELOG.md):
read every `### Visual changes` section between your version and the new one.
If the project keeps local patches of UXDSL packages (`patches/`, via
patch-package), check them too — see "Antes de actualizar" in the
[migration guide](https://github.com/rsantoyo-dev/uxdsl/blob/main/packages/postcss-uxdsl/docs/migration.md).

`UXDSL_DEBUG=1` adds discovery lines to stdout; leave it unset when saving the
snapshots.

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
  
  // Files to watch for changes
  watch: ['src/**/*.uxdsl', 'src/**/*.css'],
};
```

`init` never writes `breakpoints:` here (MIG-B6-19, FEAT-008) — see "Breakpoints
and the theme file" below for why, and where they actually belong. If
`breakpoints` is omitted everywhere (here and in the theme file), the CLI uses
UXDSL's shared defaults:

```ts
{ xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 }
```

**Let your editor check it.** An unknown key here is not an error — nothing
reads it, so `includeThem: false` silently does nothing and the build just
behaves as if you had never written it. The config `init` writes (since
`0.5.0-beta.7`) is already typed so the typo is flagged as you type; for a config you write by hand, use
the same form:

```js
// @ts-check
/** @type {import('postcss-uxdsl/config').UxdslConfig} */
const config = {
  entry: './src/app/uxdsl-entry.uxdsl',
  outFile: './src/app/uxdsl.css',
  watch: ['src/**/*.uxdsl'],
};

module.exports = config;
```

This needs no TypeScript in your project, but it does need the `// @ts-check`
line (editors do not check plain JavaScript by default) and the type on a
`const` (on `module.exports = {…}` it checks nothing). The type also knows
`entry`/`outFile` and `builds` are alternatives, not a combination, which is
what the CLI enforces at run time. `defineConfig` from `postcss-uxdsl/config`
checks the same way, at the cost of a run-time `require` that fails the build
where `postcss-uxdsl` is not resolvable from the project root. See
[Editor support](#editor-support) for why each detail matters, and for the
theme file's `$schema`.

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

As of 2026-09-28, Surfaces, Densities, Radii, Borders, Shadows and Typography
details theme errors carry this key path; Button/Input role/state errors (for
example `UXD_BUTTON_SURFACE: Unknown nope.`) and a few lower-level theme-map
checks do not.

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

### Breakpoints and the theme file

`breakpoints` can come from either `uxdsl.config.cjs` or the theme
file — both merge onto the shared defaults (config wins key-for-key), the
same partial-override contract the theme itself already has:

```js
// uxdsl.theme.config.cjs
module.exports = { breakpoints: { xl: 1440 } }; // xs/sm/md/lg keep their defaults
```

Prefer declaring `breakpoints` in the theme file, not `uxdsl.config.cjs` — the
theme is the one thing `uxdsl-cli`, the plugin used directly, the Vite plugin
and the Webpack loader all discover and agree on, while `uxdsl.config.cjs` is
build-orchestration specific to this CLI. `init` never writes `breakpoints:`
into `uxdsl.config.cjs` for exactly this reason (MIG-B6-19, FEAT-008): a full
copy of the defaults there used to permanently shadow every key the theme
file declared, since the config wins key-for-key on any name it repeats —
including the ones it never meant to override. If both files declare the
same key with genuinely different values, the build still lets
`uxdsl.config.cjs` win (unchanged), but warns once, naming both files, so the
shadowing is visible instead of a silent "why isn't my theme's breakpoint
taking effect".

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

**A `.module.css` entry must never define `:root`** (MIG-B6-24, FEAT-008):
a CSS Modules loader (Next.js's own included) rejects a bare `:root`
selector outright ("Selector :root is not pure"). An entry whose `outFile`
ends in `.module.css` and would still emit `:root`/`#uxdsl-bp-meta` — its
own `includeTheme` resolving to `true`, or a legacy import/explicit native
CSS reintroducing either selector even with `includeTheme: false` — fails
**before anything is written**, naming the entry:

```
[uxdsl] Error: builds[1] (src/panel.module.css): this entry would emit :root and #uxdsl-bp-meta, which CSS Modules reject ("Selector :root is not pure"). Set includeTheme: false for component entries.
```

The fix is almost always `includeTheme: false` on that entry — name the
shared theme entry's own `outFile` without a `.module.css` suffix instead
(`theme.css`, not `theme.module.css`), and keep `.module.css` for the
per-component panels that don't define the theme. Separately, if more
than one entry in `builds` ends up emitting the theme at all (regardless
of file name — usually a config mistake, not a CSS Modules one), the CLI
warns once, naming every offending entry, without failing the build:

```
[uxdsl] Warning: 2 entries emit the theme (builds[0], builds[1]); usually only one theme entry should.
```

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

**Watch survives errors** (MIG-B6-23, FEAT-008): an initial build that fails
to compile, or a config/theme file that fails to load at all (a syntax
error, for instance), does not end the process — the error prints and
`watch` keeps running, watching `uxdsl.config.cjs`/`uxdsl.theme.config.*`'s
usual candidate names (plus any explicit `--config`/`--entry`) until one
loads successfully. A plain `uxdsl build` (no `--watch`) is unaffected —
it still exits non-zero on any failure, same as always.

**Selective rebuilds:** editing a source file only recompiles the
`builds[]` entries that actually depend on it (tracked via each entry's own
`compile()` dependency list) — not every entry on every change. Editing
`uxdsl.config.cjs`, the theme file, or anything either of them `require()`s
still rebuilds everything, since those are shared across every entry. A
file watch mode doesn't yet know about (e.g. a previously-missing `@import`
target just created) also rebuilds everything, as the safe fallback.

**Writes only what changed, atomically:** an entry whose compiled output is
byte-identical to what's already on disk is left completely alone — same
mtime, same inode — instead of being rewritten every rebuild (before
`0.5.0-beta.6` every entry was rewritten unconditionally, so a dev server watching the
output directory reloaded stylesheets nothing had actually changed in). A
real write goes to a temp file in the same directory first, then an atomic
rename — a reader can never observe a truncated or empty output file mid-write.

That is what the log line means, in `build` and `watch` alike (the text in
parentheses was added in `0.5.0-beta.7`; earlier versions print only
`[uxdsl] unchanged <file>`):

```text
[uxdsl] unchanged src/uxdsl.css (compiled output identical to the file on disk; not rewritten)
```

"Unchanged" is about the **output**, not the inputs: you may well have edited
the theme or a `.uxdsl` file, but it compiled to exactly the bytes already on
disk (or another process — a running `watch` — had already written them).
`[uxdsl] built <file> (<n> bytes)` means the file was written.

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
`DEFAULT_THEME`) — instead of the full resolved tree. **A family you never
declared does not appear at all**, even though your build uses it in full from
the defaults: with a theme that only sets `typography_details.h1.fontWeight`,
`--diff` lists 78 `typography_details` rows and nothing from `modes`, `fonts`
or `palette`. So it cannot tell you that an upgrade changed one of those; for
that, see [Before you upgrade](#before-you-upgrade).

```bash
npx uxdsl theme --diff
```

```json
[
  { "path": "palette.primary.main", "value": "#123456", "source": "project" },
  { "path": "palette.primary.light", "value": "#a855f7", "source": "default" },
  { "path": "palette.primary.dark", "value": "#581c87", "source": "default" },
  { "path": "palette.primary.contrast", "value": "#ffffff", "source": "default" }
]
```

`--strict` exits non-zero if any family you declared ended up partially
filled from defaults — the case a plain diff of compiled CSS can't
distinguish from "this value happens to match the default anyway":

```bash
npx uxdsl theme --strict
```

A family you did not declare is not "partially filled" — it is entirely
inherited — so `--strict` never fails on it, and naming it does not change
that: `--strict=modes` exits 0 when `modes` comes wholly from the defaults. The
same holds for `build --strict-theme`. Changes to undeclared families across
versions are what the [Before you upgrade](#before-you-upgrade) snapshot shows.

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

### Source maps (`--sourcemap`, `sourceMap`)

Off by default. Turn it on so devtools point at your `.uxdsl` sources
instead of the compiled CSS:

```bash
npx uxdsl build --sourcemap            # external: writes <outFile>.map
npx uxdsl build --sourcemap=inline     # embeds the map as a data URI
npx uxdsl build --no-sourcemap         # off (the default)
```

Or in `uxdsl.config.cjs`, shared by every entry in a `builds` array:

```javascript
module.exports = { entry: 'src/app.uxdsl', outFile: 'dist/app.css', sourceMap: 'external' };
```

Precedence is **flag > config > off**. Accepted values are `false`,
`'inline'` and `'external'`; a bare `--sourcemap` means `external`. Anything
else fails before the build runs rather than quietly producing no map.

- **`external`** writes `<outFile>.map` next to the CSS and appends
  `/*# sourceMappingURL=<name>.map */` as the very last line. The build log
  reports the two sizes separately, e.g.
  `built dist/app.css (50854 bytes) + app.css.map (8702 bytes)`.
- **`inline`** embeds the map as a base64 data URI and writes no `.map`.
- **`false`** produces byte-identical CSS to not passing the option at all.

What the map points at: a plain declaration maps to its own line; a
declaration the compiler rewrote (`density()`, `palette()`, …) maps to the
original declaration, not to wherever the generated value landed; the
declarations a `@ds-button`/`@ds-input`/`@ds-typo` directive expands into
map to the directive's own line; and a declaration from an `@import`-ed
partial maps to that partial, with its own line. The `:root` token blocks
generated purely from the theme are left unmapped rather than pointed at a
file you never wrote.

Switching an output from `external` to `inline`/off retires that output's
own `.map`. A file sitting at the same path that is *not* a source map is
never deleted. In a multi-entry `builds`, a compile failure in any entry
still writes nothing at all — neither CSS nor maps.

### Verifying a partial override (`theme --diff`, `theme --contrast`)

A theme is the base plus your override, merged key by key — so overriding
`palette.primary.main` keeps the base's `primary.light`, `primary.dark` and
`primary.contrast`.
Your button turns green and its `:hover`, which uses `dark`, stays purple.

`uxdsl theme --diff` labels every value `project` or `default` on stdout, and
(since `0.5.0-beta.6`) also prints a summary of the mixed entries on **stderr**:

```text
$ uxdsl theme --diff
[uxdsl] palette.primary mixes your values (main) with base values (light, dark, contrast)
```

stdout is untouched — still one JSON document — so `uxdsl theme --diff | jq`
keeps working exactly as before.

`uxdsl theme --contrast` answers the question that follows: do the resulting
pairs meet WCAG? It prints the full report as JSON and exits 1 if any pair
fails.

```bash
uxdsl theme --contrast | jq '.failures[] | {tone, state, ratio, required}'
```

Each failure carries its mode (light/dark), component, tone, state, pair,
breakpoint and the measured and required ratio, so it points at something you
can change. It does not include the resolved hex colors (as of 2026-09-28).
It loads the exceptions shipped with the base theme; those match on the
resolved colors, so overriding one of them stops inheriting its exception and
reports it as stale instead of silently excusing a pair you changed.

`--contrast` is **not** part of `build` — it is an audit you run when you want
it — and it cannot be combined with `--diff` or `--strict`, because each prints
its own document on stdout.

One thing to expect on a first run: the packaged base theme does not pass its
own gate (as of 2026-09-28, `uxdsl theme --contrast` in a project with no theme
override reports 123 failing pairs). Those failures are real and disclosed upstream, not a problem
with your config, so focus on the pairs your own override introduced.

### 8. Strict flag parsing: accepted values, unknown flags, unknown families

Every flag accepts a fixed, explicit set of forms — anything else is a hard
error before any build runs, not a silent no-op:

| Flag | Accepted forms |
| --- | --- |
| `--include-theme` | bare (`true`), `--no-include-theme` (`false`), `=true`, `=false`. Any other value (`--include-theme=banana`) fails with `Invalid value for --include-theme: "banana"...`. |
| `--sourcemap` (build/watch) | bare (`external`), `--no-sourcemap` (off), `=inline`, `=external`, `=true` (same as bare), `=false` (off). Any other value (`--sourcemap=yes`, `--sourcemap=0`) fails with `Invalid value for --sourcemap: ...`. |
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

### 9. Dependency status: `postcss-advanced-variables` stays on `^3`

`uxdsl-core` (this CLI's compiler dependency) pins `postcss-advanced-variables`
to `^3.0.0` deliberately, not because no one has checked for a newer one.
MIG-B6-28 (FEAT-008) tried both `^4.0.0` and `^5.0.0` and ran this repo's
`npm run test:parity` plus a full `packages/playground-nextjs` production
build against each. Both newer majors break a real pattern already shipping
in that playground — an `@mixin` whose SCSS parameter is used as a bare
UXDSL directive argument and inside a `#{...}` interpolation:

```scss
@mixin palette-card($tone, $variant) {
  .palette-card-#{$tone}-#{$variant} {
    @ds-surface($tone, 1);
    background: palette(#{$tone}-#{$variant});
  }
}
```

Under `^3`, `postcss-advanced-variables` expands `$tone`/`$variant` to their
literal values before `postcss-uxdsl` ever sees `@ds-surface(...)`. Under
`^4` and `^5`, `$tone` reaches `@ds-surface` unexpanded, and compilation
fails with `UXD_SURFACE_REFERENCE: Undefined surface or palette family
$tone` — the mixin argument was never substituted for this shape. This
repo's smaller synthetic fixtures (the parity suite, the beta2–beta5
release-gate tarball builds) do not happen to exercise this exact
mixin-parameter-as-directive-argument pattern, so they stayed green against
both newer majors — only the full playground build caught it. Re-attempt
the upgrade only after confirming a newer `postcss-advanced-variables`
release changes this specific behavior, and verify with the same
`packages/playground-nextjs` production build, not just the parity/release
fixtures.

---

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
