# postcss-uxdsl

<p align="center">
  <img src="./assets/logo-uxdsl.png" alt="UX-DSL Logo" width="120" />
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
generated for you.

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
property; everything else stays generated.

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

<img src="./assets/uxdsl-intro-page.png" width="400px" alt="UXDSL Intro" />

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
[`docs/migration.md`](docs/migration.md)
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
