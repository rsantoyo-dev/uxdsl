# postcss-uxdsl

<p align="center">
  <img src="https://raw.githubusercontent.com/rsantoyo-dev/uxdsl/main/packages/postcss-uxdsl/assets/logo-uxdsl.png" alt="UX-DSL Logo" width="120" />
</p>

> **The core PostCSS engine for UXDSL** — a type-safe design system language.

[![npm version](https://img.shields.io/npm/v/postcss-uxdsl.svg)](https://www.npmjs.com/package/postcss-uxdsl)
[![License](https://img.shields.io/npm/l/postcss-uxdsl.svg)](LICENSE)

<p align="center">
  <a href="https://uxdsl.vercel.app/">
    <img src="https://img.shields.io/badge/Read_Full_Documentation-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Read Full Documentation" />
  </a>
</p>

---

## Overview

`postcss-uxdsl` transforms `.uxdsl` files — plain CSS plus a small set of
responsive/theme functions and component mixins — into optimized, plain
CSS. It's typically used alongside `uxdsl-cli`, or directly inside Next.js
and Vite.

## Install

```bash
npm install -D postcss-uxdsl@beta uxdsl-cli@beta
npx uxdsl init
npx uxdsl build
```

`init` scaffolds a starter theme and entry file; `build` compiles it once
to a plain `.css` file you import from your app like any other stylesheet.
`npx uxdsl build --watch` recompiles as you edit. See
[`uxdsl-cli`'s README](../uxdsl-cli/README.md) for the full setup
(Next.js/Vite detection, `uxdsl:build`/`uxdsl:watch` scripts, multi-entry
projects).

---

## See it in 60 seconds

Everything below is real, verified UXDSL — write it into the entry file
`init` created and it compiles exactly as shown.

### Responsive values, without writing a single media query

```css
.card { padding: xs(0.5rem) md(1rem) xl(1.5rem); }
```

compiles to:

```css
.card { padding: 0.5rem; }
@media (min-width: 768px)  { .card { padding: 1rem; } }
@media (min-width: 1280px) { .card { padding: 1.5rem; } }
```

Any property accepts any of the five breakpoints (`xs sm md lg xl`) —
write the value once per breakpoint you care about, get the media queries
generated for you. `!important` on a responsive value is kept at every
breakpoint, not just the base one — `padding: xs(1rem) md(2rem)
!important;` compiles to `!important` in both the base rule and the
generated `@media` block.

### Theme tokens instead of hex codes

```css
.card { background: palette(primary); color: palette(primary.contrast); }
```

`palette(primary)` resolves to `primary.main` by default —
`palette(primary.contrast)` reaches a specific shade the same way. Both
compile to `var(--uxdsl__palette__primary-main)`/`...-contrast`: every
UXDSL-generated custom property follows the same
`--uxdsl__<family>__<key>` shape, so it's unmistakable in devtools.

### Density: one scale, proportionally airier as the viewport grows

```css
.stack { gap: density(4); }
```

`density(4)` *is* `space(4)` on mobile — and automatically becomes
`space(5)` at the `md` breakpoint, `space(6)` at `xl`, following your own
spacing scale. One token, no manual media queries, spacing that breathes
more on a bigger screen the way a real layout should.

### A full component, one line

```css
.btn { @ds-button(contained primary); }
```

generates padding, radius, background, text color, border, shadow, and
working `:hover`/selected states — all wired to `primary` from your
palette. Add a plain CSS declaration below it to override just one
property; everything else stays generated. The host selector can be a
comma-separated list, including one with functional pseudo-classes —
`.btn:is(.a, .b) { @ds-button(...); }` generates
`.btn:is(.a, .b):hover { ... }`, never splitting inside the `:is()`/
`:where()`/`:not()`/`:has()` argument list.

### Live theming — change it with no rebuild at all

```ts
import { updatePalette } from 'postcss-uxdsl/ds-runtime';

updatePalette('primary.main', '#e11d48');
```

Every `.btn` and every `palette(primary)` reference above updates
instantly in the browser — no CSS rebuild, no page reload. The compiler
only ever emitted `var(--uxdsl__palette__primary-main)`; this just
changes that one custom property, and the cascade does the rest.

<p align="center">
  <a href="https://uxdsl.vercel.app/">
    <strong>Explore Smart Mixins, Theming and Component Packs in the full docs & playground &rarr;</strong>
  </a>
</p>

<img src="https://raw.githubusercontent.com/rsantoyo-dev/uxdsl/main/packages/postcss-uxdsl/assets/uxdsl-intro-page.png" width="400px" alt="UXDSL Intro" />

---

## Breakpoints (source of truth)

The default breakpoint map is centralized and exported from the runtime:

- `postcss-uxdsl/ds-runtime` → `DEFAULT_BREAKPOINTS`

Canonical defaults:

```ts
{ xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 }
```

Use this exported constant in integrations instead of duplicating literal values.

### Runtime breakpoint API

The runtime supports live breakpoint updates by rewriting generated media queries:

```ts
import { breakpoints } from 'postcss-uxdsl/ds-runtime'

breakpoints.get()                     // current map
breakpoints.set({ md: 900 })         // apply new values
breakpoints.update('lg', 1200)       // update one token
breakpoints.reset()                  // reset to initial map
breakpoints.load()                   // load persisted map from localStorage
```

<p align="center">
  <a href="https://uxdsl.vercel.app/docs/home">
    <strong>Explore the Full Docs &rarr;</strong>
  </a>
</p>

---

## Multi-entry theming (`includeTheme`)

A single compiled `.uxdsl` file normally both **defines** the global design
tokens (`:root { --uxdsl__space__1: ...; --uxdsl__surface__contained-padding: ...; }`) and
**consumes** them (`@ds-surface`, `space()`, `palette()`, ...). That is the
default and requires no configuration.

Some setups compile several entries from one theme — for example, a Next.js
app with one theme entry (`includeTheme: true`, the default) and multiple
CSS Module entries per panel. CSS Modules loaders reject a bare `:root`
selector as impure, and repeating the same global block in every entry is
wasted, duplicate output. Pass `includeTheme: false` to a component entry so
it only *consumes* tokens the theme entry already defines:

```js
// theme entry — emits the global :root definitions once
uxdsl({ theme, includeTheme: true }) // or omit the option; true is the default

// component entries — resolve space()/palette()/@ds-surface/... against the
// same theme, but do not redeclare :root
uxdsl({ theme, includeTheme: false })
```

`includeTheme: false` affects only the foundations, typography, density,
shadow, edge, surface, button and input `:root` emitters. Token references
and validation are unchanged — an entry compiled with `includeTheme: false`
still rejects an undefined `@ds-surface(missing)` or `shadow(missing)` the
same way a full entry does; it just relies on the theme entry's output being
present in the page for the referenced `var()`s to resolve. Both entries
must share the same effective theme (breakpoints, tokens, overrides) or the
generated variable names can diverge.

---

## Reference integrity (`references`)

Every compilation now validates that every `var(--token)` it emits resolves
to an actual definition — in this compilation, in a declared dependency
(`references.css`), or in an explicitly declared external token
(`references.externalTokens`). An unresolved reference fails the build by
default:

```text
UXD_REFERENCE_MISSING: color -> --uxdsl__palette__text-secondary has no
definition in the active theme/scope. Define it or declare its external
provider.
```

```js
uxdsl({
  theme,
  references: {
    mode: 'error' | 'warn' | 'off', // default: 'error'
    css: [themeEntryCss],           // already-compiled CSS this entry depends on
    externalTokens: ['--brand-accent'], // custom properties a host guarantees
    onWarning: (issue) => { /* ... */ },
  },
})
```

With `includeTheme: false`, the plugin already validates against the theme
entry's output automatically — you do not need to pass `references.css`
yourself for that case.

**Known caveat:** the shipped default Density scale (`DEFAULT_DENSITIES`)
references `space(1)` through `space(16)`. If your theme's `spacing` does
not cover that full range, compiling with density active (it always is,
unless `includeTheme: false`) will fail reference validation for the
uncovered keys. Either configure a full spacing scale, override the
specific density tokens you use, or set `references: { mode: 'warn' }`
while you migrate a theme that only partially covers the defaults. The
equivalent gap for `border(1..5)`'s `color(gray.*)` dependency is closed —
see the next section.

---

## Spacing keys (`space-1` vs `1`)

`theme.spacing` accepts either the bare numeric/named key (`"1"`,
`"gutter"`) or the legacy `space-`-prefixed form (`"space-1"`,
`"space-gutter"`) — both emit `--uxdsl__space__1` / `--uxdsl__space__gutter`. `space-` is a
reserved prefix removed exactly once; `"outer-space"` is untouched, and a
repeated or empty prefix (`"space-space-1"`, `"space-"`) raises
`UXD_SPACING_KEY`. Defining both spellings for the same key in one config
(`{ "1": "4px", "space-1": "4px" }`) raises `UXD_SPACING_COLLISION` even
when the values agree — pick one spelling.

---

## Independent radius/shadow overrides (`@ds-surface`/`@ds-button`/`@ds-input`)

A numeric `size` argument sets padding and border-radius together
(`@ds-surface(contained 2)`). To adjust radius or shadow without also
changing padding — or without touching padding's size at all — add an
explicit `radius(key)` / `shadow(key)` argument; `key` is the same kind of
token key the standalone `radius()`/`shadow()` value functions accept:

```text
@ds-surface(contained 2 radius(4));
@ds-surface(contained primary 2 radius(pill) shadow(3));
@ds-button(outlined 2 radius(1));
@ds-input(contained 2 shadow(0));
```

The override replaces only that one property — `size`'s padding is
untouched, and the two overrides are independent of each other. Each may
appear once; a repeated `radius()`/`radius()` or an undefined key throws
the same diagnostics as the standalone functions. A later plain CSS
declaration in the same rule still wins last, as always. See
[`docs/migration.md`](https://github.com/rsantoyo-dev/uxdsl/blob/main/packages/postcss-uxdsl/docs/migration.md)
for the full precedence rules and a codemod that folds an existing manual
`border-radius: radius(N);` override into this syntax
(`npm run codemod:size-overrides`). The codemod skips (and reports for
manual review) a case where folding would change which declaration wins —
a nearer second mixin call, an interleaved corner longhand, an
interleaved `all` reset, or an interleaved nested rule/at-rule such as
`@media` — rather than guessing; see the linked guide for the full list.

---

## Generated variable names (`--uxdsl__<family>__<key>`)

Every custom property this compiler emits or consumes carries the shared
`--uxdsl__<family>__<key>` shape — `--uxdsl__space__1`,
`--uxdsl__density__2`, `--uxdsl__radius__2`/`--uxdsl__border__1`,
`--uxdsl__shadow__1`, `--uxdsl__surface__contained-padding`,
`--uxdsl__button__contained-hover-bg`,
`--uxdsl__input__outlined-focus-border`, `--uxdsl__typography__h1-size`,
`--uxdsl__font__ui`, `--uxdsl__palette__primary-main`,
`--uxdsl__color__gray-300`. One shared, always-`uxdsl__`-prefixed
namespace is what makes a UXDSL-generated variable unambiguous to spot in
a browser's computed-style/devtools view, in generated CSS, or in a
diagnostic message — nothing else on the page uses it by accident. This
does not change the DSL syntax you write (`palette()`, `space()`,
`@ds-surface`, ...) or the logical keys in your theme JSON — only the CSS
custom property name the compiler produces underneath.

The one exception is a flat `theme.typography` entry (as opposed to the
structured `theme.typography_details`): its JSON key becomes the variable
name verbatim (`{ typography: { "h1-size": "2rem" } }` emits
`--h1-size: 2rem;`), since that key is a name you chose yourself, not one
this compiler assigns from a family/key pair.

`postcss-uxdsl/ds-runtime`'s `updatePalette`/`getPalette`/`resetPalette`
read and write only this canonical name — they no longer also
write/read a second, bare `--<token>` alias. If you were reading or
setting a Palette token's CSS variable directly (outside these runtime
functions), use `--uxdsl__palette__<token>`.

## Naming collisions

Every generated CSS variable name is built from a logical identifier —
a family and a key (`surface.contained.padding`), or a namespace and a key
(`palette.primary-main`). Two different identifiers can concatenate to the
identical name (a palette key literally named `"primary-main"` collides
with the structured `palette.primary.main`; a surface role named
`"contained-shadow"` field `"x"` collides with role `"contained"` field
`"shadow-x"`). When that happens, compiling throws
`UXD_FOUNDATION_NAME_COLLISION` or `UXD_PRESET_NAME_COLLISION` naming both
identifiers and the variable they both produce, instead of one silently
overwriting the other. Rename whichever one you didn't intend to share
that variable.

---

## Zero-config defaults (`resolveTheme`)

`theme` can be omitted or partial. An omitted or missing family — Spacing
1-16, Palette `primary`/`surface`/`neutral`/`error`, and font families
`ui`/`ui-2`/`code` — resolves against a built-in `DEFAULT_THEME` instead of
leaving `var()` references with no definition:

```js
uxdsl()                    // no options at all — compiles against DEFAULT_THEME
uxdsl({ theme: { palette: { primary: { main: '#123456' } } } })
// -> primary.main overridden; primary.dark/contrast, surface, neutral,
//    error, spacing and fonts keep their defaults
```

Merge rules: object keys merge recursively; arrays and scalars (including
`null`) replace the previous value whole; `undefined` never overwrites a
default. A `theme` that isn't an object (and isn't `undefined`/`null`)
throws `UXD_THEME_INVALID` rather than being silently ignored. `generateThemeCss`
(`postcss-uxdsl/ds-runtime`) and the PostCSS plugin resolve through the
exact same `resolveTheme` — `postcss-uxdsl/ds-runtime` also exports
`DEFAULT_THEME` and `getDefaultTheme()` (a mutable copy) directly, for an
app that needs to build the same effective theme during SSR.

### Recognized theme families

`postcss-uxdsl/ds-runtime` exports `KNOWN_THEME_FAMILIES`, the shared registry
used by theme validation. Nested Palette, font-family and Typography role names
remain open. For example, this partial theme introduces no unknown-family warnings:

```json
{
  "modes": { "dark": { "palette": { "primary": { "main": "#000000" } } } },
  "typography": { "hero": "2rem" },
  "typography_details": { "lead": { "fontSize": "1.25rem" } },
  "palette": { "brand": { "main": "#ff5722" } },
  "fonts": { "families": { "display": "Poppins" } }
}
```

### Palette tone families (internal: `getToneFamilies`)

`src/language.ts` exports `getToneFamilies(palette)`, the predicate
Buttons/Inputs use to decide which Palette roles are valid "tones": a role
qualifies only when it defines all three of `main`, `dark` and `contrast`. A
partial semantic group (e.g. a `divider`-only role) does not qualify. This
was previously duplicated inline inside `control-engine.ts`; both now import
the single implementation from `language.ts` (chosen to avoid a circular
import, since `default-theme.ts`/`surfaces.ts`/`control-engine.ts` already
import from `language.ts`). It is not re-exported from the public
`postcss-uxdsl/ds-runtime` entry point; the repository's own
`scripts/generate-language-artifacts.js` (which builds the VS Code
extension's completion metadata) already reaches into compiled `dist/*`
modules directly for several such internals, `getToneFamilies` among them.

### Theme discovery (`discoverTheme`, `configRoot`)

When `theme` is omitted (and `discoverTheme` isn't `false`), the plugin looks
for a conventional `uxdsl.theme.config.{cjs,js,json}`/`uxdsl.theme.json` in
`configRoot` (default `process.cwd()`) — the exact same discovery `uxdsl-cli`
has always done, now available with the plugin used directly, e.g. from a
project's own `postcss.config.js`:

```js
// postcss.config.js — no `theme` option needed at all; discovered from cwd.
module.exports = { plugins: { 'postcss-uxdsl': { includeTheme: false } } };
```

```js
uxdsl({ theme: {...} })                    // explicit theme always wins — discovery never runs
uxdsl({ discoverTheme: false })            // opt out — validates against DEFAULT_THEME, as before this feature
uxdsl({ configRoot: '/path/to/project' })  // search a directory other than process.cwd()
```

The theme file's export shape (`{ theme, references }` or a bare theme
object), the async-factory support, and the "looks like a build config"
warning are exactly `uxdsl-cli`'s own — both share `postcss-uxdsl/config`, so
they can never quietly disagree. One difference: discovery inside the plugin
is **synchronous** (the plugin factory and its compilation pass both are), so
an `uxdsl.theme.config.cjs` exporting an async factory function
(`module.exports = async () => ({...})`) throws a clear error naming the
file — pass a resolved `theme` object to the plugin directly instead, or use
an integration that supports async config (`uxdsl-cli`, or a future bundler
adapter). The discovered theme file (and anything it locally `require()`s)
is reported as a real PostCSS `dependency` message, so a bundler's own
watcher picks up an edit to it.

### Diagnostics

Compiler diagnostics start with a stable `UXD_*` code. CSS value functions and
`@ds-typo`, `@ds-surface`, `@ds-button`, and `@ds-input` directives are reported
with their stylesheet location; direct expansion failures are PostCSS
`CssSyntaxError`s, while post-expansion reference failures retain
`ReferenceIntegrityError` and its issues. Imported partials retain their own
source location. Theme validators name a key path (`.keyPath`, e.g.
`surfaces.contained.bogus`, `densities.x`, `radii.1`, `shadows.1`,
`borders.1`, `typography_details.h1.fontSize`) where that validator provides
one — `uxdsl-cli` prepends the theme file's own path when it resolved one, so
`uxdsl build` names both the file and the exact key. Button/Input theme
errors (`UXD_BUTTON_*`/`UXD_INPUT_*`) and a few lower-level theme-map checks
do not yet carry a key path; they still preserve their code and message.

Radius, Shadow, Border, Surface, Button and Input shapes already had their
own defaults (`DEFAULT_RADII`, `DEFAULT_SHADOWS`, `DEFAULT_BORDERS`/
`DEFAULT_BORDER_COLORS`, `DEFAULT_SURFACES`, `DEFAULT_BUTTONS`,
`DEFAULT_INPUTS`) before this — `DEFAULT_THEME` only adds the two families
(Spacing, Palette) those defaults depend on but that had none of their own.

### Zero silent output: leftover directives and unknown breakpoints (MIG-B6-14)

A directive at-rule (`@ds-typo`, `@ds-surface`, `@ds-button`, `@ds-input`) is
only recognized as a **direct child of the rule it styles**:

```css
.card { @ds-surface(contained); }              /* recognized */
@ds-surface(contained);                        /* UXD_DIRECTIVE_CONTEXT: at the document root */
.card { @media (min-width: 10px) { @ds-surface(contained); } }  /* UXD_DIRECTIVE_CONTEXT: nested under @media */
```

Directives style a whole rule and are not themselves responsive — put
responsive values on the individual properties instead
(`padding: xs(1rem) md(2rem);`). Any at-rule in the reserved `ds`/`ds-*`
namespace that isn't one of the four names above — a typo, or an alias that
was never implemented (`@ds-h1`, `@ds(h1)`) — fails as `UXD_DIRECTIVE_UNKNOWN`
with a "did you mean" suggestion when a configured directive is one edit away.
Previously an at-rule like this compiled through untouched, and a browser
silently discarded it along with every declaration inside it.

A responsive value's top-level function that is neither a configured
breakpoint nor a known CSS function fails as `UXD_BREAKPOINT_UNKNOWN` when it
appears next to a real breakpoint function in the same value, or is one edit
away from a configured breakpoint name:

```css
.a { padding: xs(1rem) xxl(2rem); }  /* UXD_BREAKPOINT_UNKNOWN: xxl is not configured */
.a { padding: xd(1rem); }            /* UXD_BREAKPOINT_UNKNOWN: one edit from "xs" */
.a { width: log(1, 2); }             /* fine — a known CSS function, not a typo of "lg" */
```

The known-function list (math, color, gradients, transforms, filters, and
UXDSL's own value functions) is `KNOWN_CSS_FUNCTIONS` from `./language` —
consulted before any edit-distance check, so a real `log(...)` next to
`lg(...)` is never misread as a typo of it.

`color()` is a token reference only when its first argument looks like one
(`color(primary)`, `color(blue.500)`); native CSS forms — relative color
syntax, an explicit color space — pass through untouched:

```css
.a { color: color(from red srgb r g b / 0.5); }  /* untouched */
.a { color: color(display-p3 1 0 0); }           /* untouched */
.a { color: color(primary); }                    /* var(--uxdsl__color__primary) */
```

A `$var` holding a responsive expression now expands correctly when this
plugin runs standalone (not only via a build that resolves `$var`s first):
`$gap: xs(1rem) md(2rem); .a { gap: $gap; }` produces the same base value
plus `@media` block as writing the responsive value inline.

### Unknown theme families and keys (`validateAndNormalizeTheme`)

`postcss-uxdsl/ds-runtime`'s `validateAndNormalizeTheme(theme)` — the
validator behind the playground's theme editor, and behind `uxdsl-cli`'s
own build-time warnings — warns (`result.warnings`, not `result.errors`)
about any top-level key it doesn't recognize (`breakpoints`, `spacing`,
`palette`, `fonts`, `colors`, `typography_details`, `densities`, `inputs`,
`buttons`, `surfaces`, `shadows`, `borders`, `radii`, `modes`, `typography`). An unrecognized key
is silently unused — nothing compiles it into CSS — so this catches a typo
(`color` instead of `colors`) or a stray field left over from
copy-pasting the wrong file, that would otherwise produce no error and no
visible effect at all.

That check stops at the top level. The three families whose own design
is a registry of named entries — `typography_details` (tags), `palette`
(roles) and `fonts.families` (roles) — are **open registries**: every
entry name your theme declares is compiled, whether or not it appears in
this package's own defaults, so `palette.brand`,
`fonts.families.marketing` or `typography_details.display-xl` are all
ordinary valid names. beta.5 briefly warned on entry names outside
`DEFAULT_THEME`'s minimal fallback set; beta.6 removed that check as a
false positive — `DEFAULT_THEME` is a zero-crash fallback, not a catalog
of permitted names, and no closed set of entry names exists anywhere in
the compiler to check against.

What *is* still checked for real, one level deeper still, is the set of
**fields** inside a `typography_details` tag: `fontsize` instead of
`fontSize` is a hard `UXD_TYPO_FIELD` error, not a warning, because that
list (`TYPOGRAPHY_PROPERTIES`) genuinely is closed.

---

## Verified from a real install

`fixtures/mig07-consumer/` (in the monorepo, `npm run
verify:consumer-fixture`) installs this package from an actual `npm pack`
tarball — never the monorepo's TypeScript source — and compiles a theme
entry plus four CSS-Module-style panel entries against it. That check is
what caught `package.json`'s `exports` map missing `"./package.json"`,
which broke `require("postcss-uxdsl/package.json")` for any consumer that
reads a dependency's own version that way; now fixed.

`fixtures/mig-b3-06-release/` (`npm run verify:beta3`) does the same from
fresh tarballs of all five coordinated packages, exercising `uxdsl-cli`'s
`builds` array end to end: a theme entry and four component entries built
from one `uxdsl.config.cjs`, a partial theme with `externalTokens` and a
theme-file-only `breakpoints.xl`, zero duplicate `:root`/`#uxdsl-bp-meta`
across the five outputs, and both negative controls (an unknown token still
fails; `--no-include-theme` overrides every entry).

---

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
