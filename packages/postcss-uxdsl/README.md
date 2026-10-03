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

`postcss` (`^8.4.31`) is a peer dependency, as for every PostCSS plugin: npm 7+ and
Yarn install it automatically. With `--legacy-peer-deps`, pnpm in strict mode, or
an older npm, add it yourself (`npm install -D postcss`).

`init` scaffolds a `uxdsl.config.cjs` and an entry file (no theme file — the
default theme is built in); `build` compiles it once
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
import { applyTheme } from 'postcss-uxdsl/ds-runtime';

applyTheme({}, { replace: true });                          // once: the override the project was built with
applyTheme({ palette: { primary: { main: '#e11d48' } } });  // then: any value, any time
```

Every `.btn` and every `palette(primary)` reference above updates
instantly in the browser — no CSS rebuild, no page reload. The compiler
only ever emitted `var(--uxdsl__palette__primary-main)`; `applyTheme`
replaces that one custom property in the stylesheet it manages, and the
cascade does the rest. It is the same JSON the build compiled, so a value
that works in the theme file works here — see
[Applying a theme at run time](#applying-a-theme-at-run-time-applytheme).

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

**The theme is the only place a breakpoint is configured.** A project changes
or adds a threshold in its theme's `breakpoints` family (`{ "breakpoints":
{ "md": 800, "xxl": 1536 } }`, merged over the base map and validated once as
`UXD_BP_INVALID`); the plugin reads that map and nothing else. The plugin's
options are:

```ts
uxdsl({ theme?, includeTheme?, references?, discoverTheme?, configRoot? })
```

Stability phase 1 removed the `breakpoints` option (in the three shapes it
accepted), which replaced the theme's map wholesale and was one of three places
a threshold could come from, and the `themeVar`/`spaceVar`/`colorVar` callbacks,
which let a caller rename the `--uxdsl__<family>__<key>` variables every other
part of the system relies on. A JavaScript caller that still passes one gets a
`UXD_OPTION_REMOVED` warning and the option is ignored (never a throw); in
TypeScript it no longer type-checks, and neither do the `UxDslOptions` alias
(use `UxdslOptions`) or `UxdslBreakpointSpec`.

### Thresholds are compiled, not applied at run time

A threshold is baked into every component's `@media` rule at build time, so
there is no runtime call that moves one: `applyTheme({ breakpoints: { md:
900 } })` is refused with `UXD_THEME_STRUCTURE`, and the fix is to change
`breakpoints` in the theme file and rebuild. (The `breakpoints.update()`
rewriter that used to exist regex-edited the compiled media queries of some
stylesheets and left the theme's own untouched, so the two disagreed; it is
gone.) To ask what a responsive value resolves to at a given width without a
document — an editor, an inspector — use `inspectResponsiveValue` from
`postcss-uxdsl/language`.

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
shadow, edge, surface, button and input `:root` emitters, plus the theme's
`fonts.google` `@import`. Token references
and validation are unchanged — an entry compiled with `includeTheme: false`
still rejects an undefined `@ds-surface(missing)` or `shadow(missing)` the
same way a full entry does; it just relies on the theme entry's output being
present in the page for the referenced `var()`s to resolve. Both entries
must share the same effective theme (breakpoints, tokens, overrides) or the
generated variable names can diverge.

---

## Where the theme goes in the compiled output

With `includeTheme: true` (the default) the compiled stylesheet is, in order:

1. the author's `@charset`, if any, and leading comments;
2. the theme's Google Fonts `@import`s (from `fonts.google`);
3. the rest of the author's prelude — body-less `@layer` statements and the
   author's own `@import`s, in written order;
4. **the whole generated theme, as one contiguous run** — the exact string
   `generateThemeCss` returns for the same theme: foundations (`:root` with
   Palette, Colors, Spacing, then the dark-mode scopes), `fonts.families` and
   Typography, Borders and Radii, Shadows, Surfaces, Buttons, Inputs,
   Densities, each family's `:root` followed by its `@media (min-width)`
   blocks, every block on one line;
5. the author's rules, in written order, with the `@media` blocks the compiler
   creates for their responsive declarations right after each rule.

So an author's own `:root { --uxdsl__palette__primary-main: … }` comes
**after** the theme's declaration of the same name and wins the cascade, the
way any later declaration of a custom property does. Before stability phase 1
(audit finding T10) only the imports and the density block were placed at
the prelude and every other family was appended *after* the author's rules,
so that override silently lost. The theme JSON is the only source of a
token: a `@theme { … }` block in a stylesheet is `UXD_THEME_BLOCK_REMOVED`
(stability phase 3), naming the family its contents belong to.

`test/theme-insertion.test.js` pins the order, and
`test/build-runtime-parity.test.js` asserts that a theme-only entry compiles
to a string byte-identical to `generateThemeCss(resolveTheme(theme))` — for
the packaged base theme, each playground theme and a synthetic theme using
every token function in every family.

## Reference integrity (`references`)

Every compilation validates that every `var(--token)` it emits resolves
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

**Density and a partial spacing scale:** the shipped default Density scale
(`DEFAULT_DENSITIES`) references `space(1)` through `space(16)`. A theme that
defines only some spacing keys does not break it: the plugin resolves your
theme over the packaged base (`resolveTheme`), so the base's `spacing` 1–16
stay defined unless you override them — `theme: { spacing: { 1: '4px' } }`
compiles with no reference error. The same resolution covers
`border(1..5)`'s `color(gray.*)` dependency (the base defines `colors.gray`).

**Cost:** validation used to grow with the *square* of the stylesheet, so a
large module could spend most of a rebuild in it — 24,000 lines took 63 s on
an M1 Pro, against 1 s with `mode: 'off'`. Since beta.6 the same file takes
0.79 s on that machine (measured for MIG-B6-25, 2026-09-22; reproduce with
`npm run bench:references` from the repository root), and doubling the input
costs about 1.9x rather than up to 6.3x. If
you turned validation off to keep watch mode usable, turn it back on. The
reported issues did not change: the previous implementation is kept as a
frozen fixture and both are required to produce identical output.

---

### One line per missing token

A theme value that does not resolve is referenced by everything built on it —
a dangling `palette.primary.main` is consumed by every Surface, Button and
Input variable that says `palette(primary…)` — so one typo used to come back as
a dozen `UXD_REFERENCE_MISSING` lines naming the same token. Since stability
phase 1 the error message groups them: one line per missing token, listing
its consumers (an author's own declaration first, with its `file:line:column`,
then the theme's), capped at five with `and N more`:

```text
UXD_REFERENCE_MISSING: --uxdsl__color__brand-500 has no definition in the active theme/scope. Define it or declare its external provider. Referenced by 14 definitions: color (src/app.uxdsl:2:3), --uxdsl__palette__primary-main, --uxdsl__button__outlined-selected-bg, --uxdsl__button__outlined-selected-border, --uxdsl__button__outlined-tone-primary-selected-bg and 9 more.
```

A token with a single consumer keeps the full chain
(`color -> --uxdsl__palette__primary-main -> --uxdsl__color__brand-500`) behind
its position, as before; cycles are always one line per issue. The
`ReferenceIntegrityError.issues` array, `references.onWarning` and warn mode
stay one entry per consumer. The `Did you mean "…"?` hint never suggests the
missing name itself — a token defined only in the dark-mode palette used to be
proposed as the fix for its own absence in the light scope.

## Spacing keys

A `theme.spacing` key is the token key itself: `"1"` emits `--uxdsl__space__1`
and is referenced as `space(1)`; `"gutter"` emits `--uxdsl__space__gutter`.
The former `space-`-prefixed spelling of the same key (`"space-1"`) is
`UXD_SPACING_KEY`, with the key path and the bare key to write instead
(stability phase 3); a key that merely contains the word, such as
`"outer-space"`, is an ordinary key.

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
appear once: a repeated `radius()` or `shadow()` fails as
`UXD_SURFACE_ARGUMENT`/`UXD_BUTTON_ARGUMENT`/`UXD_INPUT_ARGUMENT`, and an
undefined key as `UXD_SURFACE_REFERENCE` (the standalone functions report
`UXD_EDGE_REFERENCE`/`UXD_SHADOW_REFERENCE` instead). A later plain CSS
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

## Theme values: one grammar, both paths (`tokenValueToCss`)

Every string value in the theme JSON — in every family, whichever path compiles
it — is read by one grammar:

- a **literal CSS value**: `1rem`, `#7e22ce`, `0 1px 2px rgba(0, 0, 0, 0.1)`,
  `Inter, sans-serif`, `none`;
- a **token function**: `space(k)`, `density(k)`, `color(family.shade[, alpha])`,
  `palette(family[.variant][, alpha])` (no variant means `.main`),
  `radius(k | pill | circle)`, `border(k)`, `shadow(k)` — one name per concept:
  the former aliases `rounded()`, `elevation()` and `radius(full)` are
  `UXD_SYNTAX_REMOVED`, naming the replacement. Each compiles to its `var(--uxdsl__<family>__<key>)`
  reference; a radius keyword to its literal (`9999px`, `50%`); an alpha, allowed
  on `palette()`/`color()` only, to `color-mix(in srgb, <ref> N%, transparent)`
  (a value outside 0–1 is `UXD_TOKEN_ALPHA`);
- a **responsive expression** over the theme's breakpoints, `xs(…) md(…)`, whose
  groups hold any of the above (Spacing, Colors, Palette and `fonts.families`
  are not responsive; every other family is);
- **`var(--…)`** as the escape hatch, passed through untouched.

So a Palette value may say `palette(surface.contrast)` or `color(gray.300)` just
as a Surface field may say `radius(2)`; the compiled variable name is never
something you have to know to write a theme. Whether the token *exists* is the
reference pass's question (`UXD_REFERENCE_MISSING`), asked of the emitted
stylesheet on both paths.

Before stability phase 1 (audit finding T1) only the preset families resolved
these functions; a Palette, Color, Spacing or `fonts.families` value was emitted
raw, and the PostCSS plugin's *final* pass — which rewrote every declaration in
the tree, generated `:root` blocks included — papered over that at build time
only. `radii: { x: 'radius(2)' }` therefore compiled to `var(--uxdsl__radius__2)`
in a build and stayed the literal `radius(2)` in `generateThemeCss` and
`applyTheme`, which reported `ok: true`. Now the engines every path shares
(foundations, typography, densities, the preset engine, Surfaces, Buttons,
Inputs) resolve the grammar themselves through `tokenValueToCss`
(`postcss-uxdsl/language`), and the plugin's own value passes run over the
author's declarations only. `test/build-runtime-parity.test.js` pins it: for the
packaged base theme, each of the playground's themes and a synthetic theme that
uses every function in every family, each top-level block of the plugin's theme
CSS is byte-identical to a block of `generateThemeCss(resolveTheme(theme))`.

`presetValueToCss`, `spacingValueToCss` and the per-family `*_ALPHA`/
`UXD_TYPO_TOKEN` codes are deprecated or gone in favour of the one function and
its two codes, `UXD_TOKEN_ALPHA` and `UXD_TOKEN_KEY`.

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
custom property name the compiler produces underneath. There is no
exception: the flat `theme.typography` family, whose keys became
un-namespaced variables (`--font-code`), is gone (stability phase 3) — a
theme that still carries it is `UXD_THEME_INVALID` at `typography`, pointing
at `typography_details` (text roles) and `fonts.families` (font stacks).

`applyTheme` writes only this canonical name too; if you read a Palette
token's CSS variable directly (`getComputedStyle(...).getPropertyValue`),
use `--uxdsl__palette__<token>` — there is no bare `--<token>` alias.

## Naming collisions

Every generated CSS variable name is built from a logical identifier —
a family and a key (`surface.contained.padding`), or a namespace and a key
(`palette.primary-main`). Two different identifiers can concatenate to the
identical name (a palette key literally named `"primary-main"` collides
with the structured `palette.primary.main`; a `colors` key `"gray-300"`
with `colors.gray.300`). When that happens, compiling throws a
`*_NAME_COLLISION` error — `UXD_FOUNDATION_NAME_COLLISION` for Palette/Colors,
`UXD_TYPO_NAME_COLLISION` for Typography, and the preset engines' own
`UXD_EDGE_`/`UXD_SHADOW_`/`UXD_SURFACE_`/`UXD_BUTTON_`/`UXD_INPUT_NAME_COLLISION`
— naming both
identifiers and the variable they both produce, instead of one silently
overwriting the other. Rename whichever one you didn't intend to share
that variable.

---

## Zero-config defaults (`resolveTheme`)

`theme` can be omitted or partial. An omitted or missing family resolves
against a built-in `DEFAULT_THEME` instead of leaving `var()` references
with no definition:

```js
uxdsl()                    // no options at all — compiles against DEFAULT_THEME
uxdsl({ theme: { palette: { primary: { main: '#123456' } } } })
// -> primary.main overridden; every other palette family, and every other
//    top-level family (fonts, spacing, densities, borders, radii, shadows,
//    surfaces, buttons, inputs, typography_details), keeps its default
```

**MIG-B6-29 (FEAT-008): `DEFAULT_THEME` is `postcss-uxdsl/theme/base.json`
itself** — the reviewed base theme, not a "deliberately minimal" 4-family
stub kept just to avoid a crash. It defines a full 14-family Palette
(`primary`/`secondary`/`surface`/`tertiary`/`success`/`info`/`warning`/
`error`/`dark`/`neutral`/`light`/`text`/`divider`/`action`), font families
`ui`/`code` (no built-in `ui-2`), the full 1-16 Spacing scale, and every
Density/Border/Radius/Shadow/Surface/Button/Input default those engines
already shipped — extracted into this same file instead of staying
hardcoded separately in each one.

Two of its fields change what a zero-config project actually renders,
compared to any earlier beta:

- **`fonts.google: ["Inter:wght@400;500;600;700"]`** — every project
  with no theme of its own now emits a real
  `@import url('https://fonts.googleapis.com/css2?family=Inter...')`, a
  request to Google's servers. Opt out with an empty array in your own
  override — arrays replace whole, so this genuinely means "none", not
  "append nothing":
  ```json
  { "fonts": { "google": [] } }
  ```
- **`modes.dark`** — every project with no theme of its own now follows
  the OS `prefers-color-scheme: dark` preference automatically (11 of the
  14 palette families redefine at least `main`/`contrast` for dark). Pin
  light mode regardless of OS preference with `data-theme="light"` on
  `<html>` (the generated dark-mode selector already excludes it —
  `:root:not([data-theme='light'])` — no override theme needed just for
  this); pin dark mode the same way with `data-theme="dark"`. An override
  of `modes: {}` does **not** disable dark mode — like every other family,
  objects merge by key, so an empty object changes nothing.

Both gaps that used to exist here are closed (MIG-B6-29 phase 4): the
Google Fonts URL is now built by a shared, tested encoder
(`encodeGoogleFontFamily`/`googleFontsImportUrls`, `postcss-uxdsl/ds-runtime`)
that safely handles a family name with a space (`"Open Sans:wght@400;700"`
→ `family=Open+Sans:wght@400;700`) or any other character outside css2's
own syntax, instead of a bare, unescaped template interpolation; and
`generateThemeCss()` (the runtime/SSR path) now emits the identical
`@import` the PostCSS plugin does, for the same theme — an app calling
`generateThemeCss` directly for SSR no longer needs to add its own Google
Fonts `<link>`/`@import` to match. See "Google Fonts URL encoding" below
for the exact rules and how to reuse the encoder for a hand-rolled
`<link>`, e.g. a client-side theme switcher managing its own tag. The
theme's colors have
been run through the accessibility contrast gate and corrected where an
automated, minimal, hue-preserving fix existed (MIG-B6-29 phase 3 — see
below); the findings still open are listed under
"Current status against `theme/base.json`" below.

Merge rules: object keys merge recursively; arrays and scalars (including
`null`) replace the previous value whole; `undefined` never overwrites a
default. A `theme` that isn't an object (and isn't `undefined`/`null`)
throws `UXD_THEME_INVALID` rather than being silently ignored. `generateThemeCss`
(`postcss-uxdsl/ds-runtime`) and the PostCSS plugin resolve through the
exact same `resolveTheme` — `postcss-uxdsl/ds-runtime` also exports
`DEFAULT_THEME` directly, for an app that needs to build the same effective
theme during SSR (`resolveTheme()` with no override returns a fresh, mutable
copy of it; the former `getDefaultTheme()` did the same and is removed).

`DEFAULT_THEME` is deep-frozen, but only an internal clone of
`theme/base.json` — never the module object that path itself resolves to.
If your own bundler aliases `postcss-uxdsl/*` straight to this package's
source (rather than its published `dist/`, e.g. for a monorepo dev setup),
importing `postcss-uxdsl/theme/base.json` directly still gives you a plain,
mutable object, safe to `deepMergeTheme` and pass around without it being
affected by anything this package itself froze.

### Recognized theme families

`postcss-uxdsl/ds-runtime` exports `KNOWN_THEME_FAMILIES`, the shared registry
used by theme validation. Nested Palette, font-family and Typography role names
remain open. For example, this partial theme introduces no unknown-family warnings:

```json
{
  "modes": { "dark": { "palette": { "primary": { "main": "#000000" } } } },
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
import from `language.ts`). It is not re-exported from the
`postcss-uxdsl/ds-runtime` entry point, but it is exported by the public
`postcss-uxdsl/language` entry (the package `exports` map); the repository's own
`scripts/generate-language-artifacts.js` (which builds the VS Code
extension's completion metadata) already reaches into compiled `dist/*`
modules directly for several such internals, `getToneFamilies` among them.

### `tone()` in Button and Input values

A Button or Input theme value says "the tone the component asks for" with
`tone(main)`, `tone(dark)` or `tone(contrast)`:

```json
{ "buttons": { "cta": { "surface": "contained", "states": { "hover": { "bg": "tone(dark)", "color": "tone(contrast)" } } } } }
```

```css
.cta { @ds-button(cta); }            /* hover: primary's dark and contrast */
.save { @ds-button(cta success); }   /* hover: success's dark and contrast */
```

`tone(dark)` compiles to the fallback chain the components already consume —
`var(--uxdsl__button__tone-dark, var(--uxdsl__palette__primary-dark))` in the
role's own variable (`--uxdsl__button__cta-hover-bg`), and to the family's own
variant, `var(--uxdsl__palette__success-dark)`, in the per-tone variable
(`--uxdsl__button__cta-tone-success-hover-bg`) that `@ds-button(cta success)`
references first. An explicit Palette reference keeps its configured meaning:
`"bg": "palette(primary.dark)"` is primary's dark whichever tone the component
asks for. `tone()` is valid only inside `buttons`/`inputs` values (a Surface,
Palette or Typography value, or an author's own declaration, has no tone to
supply it: `UXD_TONE_CONTEXT`); a variant other than the three is
`UXD_BUTTON_TONE`/`UXD_INPUT_TONE`.

Before stability phase 1 (audit finding T6) the substitution was a regex over
that exact literal chain, which the base theme spelled out by hand 17 times, and
nothing else varied by tone. `theme/base.json` now says `tone(…)`, and its
palette aliases say `palette(surface.light)` rather than the compiled
`var(--uxdsl__palette__surface-light)`; its compiled CSS is byte-identical
before and after (`test/tone-function.test.js` compiles the former spelling as
an override and compares). **Deprecated:** the literal chain is still recognised
in a theme value for one release and will stop being substituted in the next
minor — write `tone(…)`.

A per-tone variable is emitted only when the tone changes the value: a field
that says `tone(…)` gets one per tone family, a field that says
`palette(error.main)`, `0.6` or `shadow(2)` gets none, and the component's
reference — always `var(<per-tone>, var(<role's own>))` — falls back to the
role's own variable. That halves the size of the theme block for the base
theme (745 → 591 declarations; the 154 dropped ones were byte-identical
copies). Read a component's value through that fallback, never by looking
up the per-tone name alone.


### Accessibility contrast gate (`checkThemeContrast`)

**MIG-B6-29 (FEAT-008), phase 2/4 (the gate) and phase 3/4 (color
correction).** `postcss-uxdsl/ds-runtime` exports
`checkThemeContrast(theme, { exceptions? })`, which MIG-B6-16 uses for
`uxdsl theme --contrast`. It checks every text/placeholder color and every
border/underline color this theme's Surface/Button/Input engines actually
define — for every role, every tone `getToneFamilies` recognizes, every
state (including the implicit base), in light mode and (since `modes.dark`
is now a real default — see above) dark mode, at every configured
breakpoint — against WCAG's normal-text ratio (4.5:1) and non-text ratio
(3:1, WCAG 1.4.11 — the threshold a border needs to stay visible against
its surroundings).

```js
const { checkThemeContrast, resolveTheme } = require('postcss-uxdsl/ds-runtime')
const exceptions = require('postcss-uxdsl/theme/base.contrast-exceptions.json')

const report = checkThemeContrast(resolveTheme(myTheme), { exceptions })
report.passed    // false if any non-excepted pair fails, or any exception is stale/duplicated
report.failures  // { mode, family, component, tone, state, pair, ratio, required, reason, ... }[]
report.checked   // every pair actually evaluated, including passes and exempt ones
```

Every check is derived from the same functions the real compiler calls
(`surfaceDeclarations`, `buttonDeclarations`, `inputDeclarations`,
`inspectSurfaceTheme`/`inspectButtonTheme`/`inspectInputTheme`) — never a
hand-written list of pairs, and never a second color parser independent of
what PostCSS/the runtime actually emit. An unresolvable color reference
always fails the check (never a silent pass, never treated as a 0 ratio).
A `disabled` state is still computed and listed in `report.checked`, but
never blocks `report.passed` on its own (`exempt: true`) — WCAG itself
does not hold inactive controls to the normative threshold.

**Exceptions** (`postcss-uxdsl/theme/base.contrast-exceptions.json`) cover
a specific (mode, family, component, tone, state, pair) combination that
is unsupported *by the nature of the role* — e.g. the palette's `light`
family (a background role) used as a text color on a transparent-background
role, which this JSON file itself documents as its only current entry —
never a color the theme could reasonably fix instead. Matching is exact:
an exception also records the resolved foreground/background hex it was
written against, and stops applying the moment either one changes for any
reason (a theme override, or a future color correction) — it can never
silently keep "covering" a color that is not the one it was reviewed for.
A duplicate exception `id`, or an exception whose recorded colors no
longer occur anywhere, fails the gate too (`report.exceptionIssues`), so a
stale entry can't quietly accumulate.

**What this does not check**: it is a compiled-output check, not a DOM or
browser certification — no real layout, no stacking context, no
`filter`/`mix-blend-mode`, no arbitrary CSS a project layers on top of
what these engines emit. Border contrast is only checked against the
theme's ambient page background (`palette.surface.main`), not also against
each component's own inner background — a component's border touches both,
and only the outer, more common failure mode is verified here. Passing
this gate is not, by itself, an accessibility certification for a real
page.

**Current status against `theme/base.json`**: phase 3 corrected 16 colors
(hue and chroma held fixed, only lightness moved, in both directions,
smallest valid step — see the CHANGELOG's "phase 3 of 4" entry for the
full before/after table). `report.passed` is still honestly `false`: as
of 2026-09-28, `checkThemeContrast(resolveTheme(), { exceptions })` with the
shipped exceptions file reports 123 failing pairs (124 without it) —
`uxdsl theme --contrast` in a project with no theme override reports the same
123. MIG-B7-01 (FEAT-009, in `0.5.0-beta.7`, unreleased as of 2026-09-28)
closed one of phase 3's three findings:
`inputs.*.base.placeholder` follows the requested tone on `contained`
(the only Input role whose background actually tints), using that tone's
own `contrast` color instead of the fixed `neutral.dark` gray that could
not read on every toned background at once. Two of the original three
remain open, plus a fourth surfaced while closing the first — three open
findings in all: `light`/`dark`/`surface` are
canvas-identity families whose own `main`/`dark` are asked to double as
text/border when used as an explicit tone; `warning.main` (light mode)
isn't dark enough for direct text/border use without losing its own
identity; and `palette(neutral.dark)`, the Input placeholder's *untoned*
default (all three roles), is not dark-mode-aware enough against dark
mode's own background — a plain color choice, not a tone-substitution
mechanism gap, so MIG-B7-01 deliberately left it open. Each is recommended
as its own follow-up in the relevant story's evidence, not swept into an
exception.

**Input placeholder tone (MIG-B7-01, FEAT-009 — `0.5.0-beta.7`, unreleased as
of 2026-09-28; `0.5.0-beta.6` still uses `palette(neutral.dark)` here):**

```css
.field { @ds-input(contained error); }
```

compiles `.field::placeholder`'s color to `palette(error.contrast)` —
varying with whichever tone is requested — instead of the fixed
`palette(neutral.dark)` every role used before this story. `contained` is
the only role affected, since it is the only one whose background actually
tints; `@ds-input(outlined error)` and `@ds-input(underline error)` keep the
plain gray placeholder unchanged, and any role used with no tone at all is
also unchanged.

### Google Fonts URL encoding (`encodeGoogleFontFamily`, `googleFontsImportUrls`)

**MIG-B6-29 (FEAT-008), phase 4/4.** Both the PostCSS plugin and
`generateThemeCss` build a theme's `fonts.google` entries into
`@import url('https://fonts.googleapis.com/css2?family=...&display=swap')`
through this one shared, pure encoder — never a second, independently
hand-rolled URL builder — so a build-time compile and a runtime/SSR call
for the same theme always emit byte-identical imports.

**Placement (MIG-B7-14, FEAT-009).** CSS only honors an `@import` that comes
before every other rule (and an `@charset` only as the very first thing);
a browser silently discards one that follows a style rule. Through
`0.5.0-beta.6` compiled output — the CLI, `compile()`, the plugin — put the
theme's `:root` block above every import, so the font request was never made.
From `0.5.0-beta.7` (unreleased as of 2026-09-28) the theme's imports come first (after your `@charset`, if you have one),
then any `@import` you wrote yourself in the order you wrote it, then the
theme's `:root`. Nothing you wrote is reordered. Two consequences worth
knowing: Inter is actually requested (and your visitors' browsers contact
`fonts.googleapis.com`), and an `@import` of your own that used to be silently
dropped applies. `fonts: { google: [] }` still opts out of the theme's.

```js
const { encodeGoogleFontFamily, googleFontsImportUrls } = require('postcss-uxdsl/ds-runtime')

encodeGoogleFontFamily('Open Sans:wght@400;700') // 'Open+Sans:wght@400;700'
googleFontsImportUrls(['Inter:wght@400;700', 'Playfair Display'])
// ['https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
//  'https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap']

// Variable fonts keep their axis syntax intact — the commas separating axis
// tags and the `..` ranges are structural, not characters to escape:
encodeGoogleFontFamily('Roboto Flex:opsz,wght@8..144,100..1000')
// 'Roboto+Flex:opsz,wght@8..144,100..1000'
encodeGoogleFontFamily('Nunito Sans:ital,wght@0,400;1,400')
// 'Nunito+Sans:ital,wght@0,400;1,400'
```

A space becomes `+` (css2's own convention, not `%20`); `:`, `@`, `;` and
`,` — the characters css2's own syntax depends on for the family name /
axis-tag / value-list structure — pass through unescaped; anything else is
percent-encoded one character at a time. This is stricter than
`encodeURIComponent` alone: that leaves `' ( ) ! ~ *` unescaped by spec,
and the result is embedded in a single-quoted `url('...')` CSS string by
both callers, where an unescaped `'` would close the string early and
corrupt the generated CSS, not just misencode a character — this module
explicitly re-escapes all six regardless of what `encodeURIComponent`
itself considers safe. `googleFontsImportUrls([])` (or `undefined`)
returns `[]`, matching `fonts: { google: [] }` emitting no import at all.
Neither function performs the request itself, and neither imports
anything Node-only — both are exported from the same browser-safe
`postcss-uxdsl/ds-runtime` entry as `checkThemeContrast` and
`generateThemeCss`, so a project managing its own font `<link>` (a
client-side theme switcher, for example) can reuse the exact same
encoding instead of drifting from what the compiler itself emits.

### What `@ds-typo` emits

**MIG-B6-17 (FEAT-008).** `@ds-typo(role)` emits exactly one declaration per
field the effective theme defines for that role — the role's own fields layered
over `default`'s, the same composition the variable generator uses — and nothing
else. Every declaration is a bare `var(--uxdsl__typography__<role>-<suffix>)`
with **no literal fallback**, so the directive can never apply a value your
theme did not ask for:

```css
/* theme/base.json defines fontFamily, fontSize, lineHeight, fontWeight,
   letterSpacing, marginBlockStart and marginBlockEnd for `caption`. */
.eyebrow { margin: 0; @ds-typo(caption); }
```

```css
.eyebrow {
  margin: 0;
  font-family: var(--uxdsl__typography__caption-font-family);
  font-size: var(--uxdsl__typography__caption-size);
  line-height: var(--uxdsl__typography__caption-line);
  font-weight: var(--uxdsl__typography__caption-weight);
  letter-spacing: var(--uxdsl__typography__caption-spacing);
  margin-block-start: var(--uxdsl__typography__caption-margin-block-start);
  margin-block-end: var(--uxdsl__typography__caption-margin-block-end);
}
```

A field the theme does not define is simply not emitted — the element keeps
whatever it inherits, or the browser default. In particular the directive does
**not** reset `text-transform`, `font-style` or `text-decoration`, and never
emits `opacity` (not a typography field at all). Define the field in
`typography_details` when that value is the intended design; see the beta.6
CHANGELOG entry for the exact before/after list and a recipe to restore the
previous behaviour.

**Precedence** follows the directive's position in the rule, like any other
declaration: `.a { @ds-typo(h1); font-size: 3rem; }` keeps `3rem`, while
`.a { font-size: 3rem; @ds-typo(h1); }` lets the role's size win.

A role the effective theme does not define fails as `UXD_TYPO_REFERENCE`,
pointing at the directive and listing the roles that do exist — it never
silently falls back to `default`.

### The theme files the package ships

Exactly two, both explicit exports: `postcss-uxdsl/theme/base.json`
(`DEFAULT_THEME`) and `postcss-uxdsl/theme/base.contrast-exceptions.json`.
Every built-in preset reads its defaults from the base JSON directly — no
import is needed for `density()`/`border()`/`radius()`/`shadow()`/
`@ds-surface`/`@ds-button`/`@ds-input`/`@ds-typo` to work out of the box.
The legacy opt-in packs (`theme/default-*.uxdsl`, `theme/default-*.css`) and
`theme/theme-manifest.json` were removed in stability phase 3: they defined
every token a second time, in `@theme { … }` blocks the compiler no longer
accepts. A project that imported `default-colors.css` for its color
collection declares those colors under its own theme's `colors` family instead
(`color(blue.500)` keeps resolving).

### Theme discovery (`discoverTheme`, `configRoot`)

When `theme` is omitted (and `discoverTheme` isn't `false`), the plugin looks
for the project's theme file — `uxdsl.theme.json`, or
`uxdsl.theme.config.js`/`.cjs` exporting the theme object — in `configRoot`
(default `process.cwd()`) — the exact same discovery `uxdsl-cli` does,
available with the plugin used directly since 0.5.0-beta.6, e.g. from a
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

A theme file exports the theme itself and nothing else — `breakpoints`
included, since thresholds are a theme family. `references` is the plugin
option (or the build config's key), never something the theme file carries:
a file exporting the former `{ theme, references }` wrapper is refused with a
message saying where each half goes. The loader, the factory-export support
and the "looks like a build config" warning are exactly `uxdsl-cli`'s own —
both share `postcss-uxdsl/config`, so they can never quietly disagree. One
difference: discovery inside the plugin is **synchronous** (the plugin
factory and its compilation pass both are), so an `uxdsl.theme.config.cjs`
exporting an async factory function (`module.exports = async () => ({...})`)
throws a clear error naming the file — pass a resolved `theme` object to the
plugin directly instead, or use an integration that supports async config
(`uxdsl-cli`, `vite-plugin-uxdsl` or `uxdsl-webpack-loader`, which all use
`discoverThemeAsync`). The discovered theme file (and anything it locally
`require()`s) is reported as a real PostCSS `dependency` message, so a
bundler's own watcher picks up an edit to it.

### Diagnostics

Compiler diagnostics start with a stable `UXD_*` code. CSS value functions and
`@ds-typo`, `@ds-surface`, `@ds-button`, and `@ds-input` directives are reported
with their stylesheet location; direct expansion failures are PostCSS
`CssSyntaxError`s, while post-expansion reference failures retain
`ReferenceIntegrityError` and its issues. Imported partials retain their own
source location. A theme error names a key path (`.keyPath`, e.g.
`palette.primary.main`, `surfaces.contained.bogus`, `densities.x`, `radii.1`,
`breakpoints.md`, `typography_details.h1.fontSize`) where the validator
provides one — `uxdsl-cli` prepends the theme file's own path when it resolved
one, so `uxdsl build` names both the file and the exact key. Every structural
problem is `UXD_THEME_INVALID` with a key path (see "One theme validator"
below); a breakpoint-map problem is `UXD_BP_INVALID`, reported once.
Button/Input closed-set errors (`UXD_BUTTON_*`/`UXD_INPUT_*`) do not carry a
key path (as of 2026-09-29); they still preserve their code and message.

The per-family default constants (`DEFAULT_RADII`, `DEFAULT_SHADOWS`,
`DEFAULT_BORDERS`/`DEFAULT_BORDER_COLORS`, `DEFAULT_SURFACES`,
`DEFAULT_BUTTONS`, `DEFAULT_INPUTS`) are read from the same
`theme/base.json` as `DEFAULT_THEME` (MIG-B6-29), not maintained separately.

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
UXDSL's own value functions) is `KNOWN_CSS_FUNCTIONS` from `postcss-uxdsl/language` —
consulted before any edit-distance check, so a real `log(...)` next to
`lg(...)` is never misread as a typo of it.

`color()` is a token reference only when its first argument looks like one
(`color(gray-300)`, `color(gray.300)`); native CSS forms — relative color
syntax, an explicit color space — pass through untouched. The token must
exist: `gray` is the only color collection the default theme defines, so
`color(brand-500)` fails as `UXD_REFERENCE_MISSING` until your theme's
`colors` defines `brand`:

```css
.a { color: color(from red srgb r g b / 0.5); }  /* untouched */
.a { color: color(display-p3 1 0 0); }           /* untouched */
.a { color: color(gray-300); }                   /* var(--uxdsl__color__gray-300) */
.a { color: color(brand-500); }                  /* UXD_REFERENCE_MISSING: not in the default theme */
```

A `$var` holding a responsive expression expands correctly when this
plugin runs standalone (not only via a build that resolves `$var`s first):
`$gap: xs(1rem) md(2rem); .a { gap: $gap; }` produces the same base value
plus `@media` block as writing the responsive value inline.

### One theme validator (`validateTheme`)

There is one answer to "is this theme valid?", and every path asks the same
function for it: the PostCSS plugin (on the effective theme, before any engine
reads it), `generateThemeCss`, `applyTheme` and `uxdsl-cli` all call
`validateTheme(theme, { references? })` from `postcss-uxdsl/ds-runtime`. The
packaged JSON Schema is generated from the validator's own patterns, so an
editor rejects the same names and leaves. The result is
`{ ok, theme, errors, warnings }`; each issue is `{ code, path, message }`, and
`theme` is a deep copy of the input, **unchanged** — nothing is normalized or
coerced.

What it checks, in order:

- **Structure — `UXD_THEME_INVALID`, with the key path.** Every leaf is a
  nonempty string; a number, boolean, `null`, array or object where a string
  belongs is an error (`spacing.1: 8`, `fontWeight: 700`, `palette.primary.light:
  null` all fail — none of them is coerced, and none reaches CSS as `8`, `null`
  or `[object Object]`). A `breakpoints` value is a finite number, never
  `"768"`. `fonts` is closed to `families` and `google` (`google` is an array of
  nonempty Google Fonts specs); `modes` is closed to `dark`, and `modes.dark` to
  `palette`. A palette family is an object of variants, never a single color.
  Role, family and breakpoint names (typography roles, surfaces, buttons,
  inputs, palette and color families, `fonts.families`, breakpoints) match
  `^[a-z][a-z0-9-]*$`; token keys (spacing, densities, radii, borders, shadows,
  color shades, palette variants) may also start with a digit. A value cannot
  contain `;`, `{` or `}`, and its parentheses must balance — a theme string is
  compiled into a stylesheet, so a value carrying `; } .hack {` used to inject
  a rule.
- **Breakpoints, once — `UXD_BP_INVALID`.** The effective map (the base theme's
  plus yours) needs a zero-width base and distinct, finite, non-negative widths.
  The engines no longer restate this under their own family (`UXD_TYPO_BP`,
  `UXD_EDGE_BP`, … are gone); a theme value naming a breakpoint the map does not
  have is that family's `_VALUE` error.
- **Engines.** The same `compile*Rules` the CSS paths run: closed field sets
  (`fontsize` is `UXD_TYPO_FIELD`, `focusVisible` is `UXD_BUTTON_STATE`),
  Surface references, responsive expressions — each judged by its owner, with
  its own code.
- **References**, unless `references: false`: the generated theme's `var()`
  graph, as `UXD_REFERENCE_MISSING`/`UXD_REFERENCE_CYCLE`. The plugin passes
  `false` here because it checks the references of the exact stylesheet it
  emits, once at the end.

An unknown **top-level** family is a warning (`UXD_THEME_FAMILY`), never an
error: nothing compiles it into CSS, so this catches a typo (`color` instead of
`colors`) or a stray field from copy-pasting the wrong file — but the validator
cannot tell a typo from a family a newer version knows about. The PostCSS plugin
reports it through `result.warn`, `uxdsl-cli` prints it, `applyTheme` returns it
in `warnings`. The recognized families are `KNOWN_THEME_FAMILIES`
(`breakpoints`, `spacing`, `palette`, `fonts`, `colors`, `typography_details`,
`densities`, `inputs`, `buttons`, `surfaces`, `shadows`, `borders`, `radii`,
`modes`, `typography`); `$schema` is metadata and is ignored.

The families whose own design is a registry of named entries —
`typography_details` (roles), `palette` (families), `fonts.families`, and the
Surface/Button/Input roles — are **open**: every name your theme declares is
compiled, whether or not it appears in this package's own defaults, so
`palette.brand`, `fonts.families.marketing` or `typography_details.display-xl`
are ordinary valid names. Only their *shape* (the pattern above) is checked.

`validateTheme` replaces the former `validateAndNormalizeTheme`, which is removed.
Nothing is normalized: multi-word font families are emitted exactly as written by both the
plugin and `generateThemeCss` (`Inter Tight, sans-serif` stays unquoted, which is
valid CSS), and its former `requireXsForResponsive` option — dead since a base
value became mandatory — is ignored.

---

## What a partial override actually inherits

A theme is the packaged base plus your override, merged key by key. That is the
product's design, not an accident — you write only what differs. What is easy to
miss is that "key by key" reaches all the way down:

```json
{ "palette": { "primary": { "main": "#00aa00" } } }
```

You now have a green `primary.main` **and the base theme's purple
`primary.dark`, `primary.light` and white `primary.contrast`.** Nothing is
wrong, and nothing warns: your button is green, and its `:hover` — which uses
`primary.dark` — is purple. To change the hover too, override `dark` as well:

```json
{ "palette": { "primary": { "main": "#00aa00", "dark": "#007700", "contrast": "#ffffff" } } }
```

The same applies to a `typography_details` role: setting `h1.fontSize` keeps the
base's `fontWeight` and `lineHeight` for that role.

Two commands make this visible rather than surprising:

```bash
uxdsl theme --diff       # every value, labeled "project" or "default"
uxdsl theme --contrast   # do the resulting pairs meet WCAG?
```

`--diff` prints a one-line summary on **stderr** for each entry that mixes both
sources, leaving stdout a clean JSON document:

```text
[uxdsl] palette.primary mixes your values (main) with base values (light, dark, contrast)
```

`--contrast` answers the question that actually matters after a partial
override. The green above against the inherited white `contrast` is about
3.11:1 — below WCAG's 4.5:1 for text — and the report names the pair, its mode,
state, breakpoint and ratio. It exits 1 when anything fails, and it is
deliberately **not** part of `build`.

One caveat worth knowing before you run it: as of 2026-09-28 the packaged base
theme does not pass its own contrast gate (123 failing pairs with no override —
see "Current status against `theme/base.json`" above). Those failures are real,
disclosed and tracked (see MIG-B6-29 and MIG-B7-01 in the repository), not a
problem with your configuration — so
read the report for the pairs *your* override introduced.

---

## Applying a theme at run time (`applyTheme`)

Your theme is JSON: a base plus your override. A build compiles that JSON;
`applyTheme` applies the *same* JSON in the browser, so changing a value needs
no rebuild. It is synchronous — when it returns `ok: true`, the stylesheet and
the reported state already agree; when it returns `ok: false`, nothing moved.

```ts
import { applyTheme, getAppliedTheme, resetTheme, subscribeTheme } from 'postcss-uxdsl/ds-runtime';

// Once, at startup: hand it the override your project was built with.
applyTheme(projectOverride, { replace: true, styleId: 'uxdsl-ssr-theme' });

// Later: a patch merges over what is applied.
const result = applyTheme({ palette: { primary: { main: '#0ea5e9' } } });
if (!result.ok) console.error(result.error.message);
```

The first call has to be the override the project actually compiled with (`{}`
for a zero-config project). The library cannot infer it: reading compiled CSS
back does not reconstruct your JSON. That call also fixes the managed
`<style>` — an element with that id is *adopted*, which is how a
server-rendered theme tag is taken over without a second one appearing at
hydration.

| Call | Does |
| --- | --- |
| `applyTheme(patch, opts?)` | Merges `patch` over the applied override, or replaces it with `replace: true` |
| `getAppliedTheme()` | The applied override, as a copy. `{}` before initialization |
| `resetTheme({ clearPersist? })` | Restores the override you initialized with — not the packaged base |
| `loadPersistedTheme({ key? })` | Applies a stored override, validated like any other patch |
| `subscribeTheme(listener)` | Notified after each success; returns the unsubscribe function |

`persist` is per call: persisting once does not make later calls persist.
Saving happens *after* the visual commit, so a storage failure comes back as
`ok: true` with an explicit warning rather than pretending the theme did not
apply — or pretending it was saved.

### One runtime API

`applyTheme`, `getAppliedTheme`, `resetTheme`, `subscribeTheme` and
`loadPersistedTheme` are the whole browser API. The per-token setters that
predated it (`updatePalette`, `updateColor`, `updateSpacing`, the
`breakpoints`/`spacing`/`colors` objects, `link`/`subscribe`) are removed:
they wrote inline styles on `<html>`, which beat any stylesheet, so a page
that used both could call `applyTheme`, get `ok: true`, and see nothing
change. Every value they could set is one `applyTheme` patch — the mapping is
in the CHANGELOG under "Removed" — and `loadPersistedTheme({ key })` reads
exactly that one key: it no longer converts the four keys the old setters
persisted under.

### What it will refuse, and why

`applyTheme` replaces a stylesheet of custom properties. It cannot rewrite the
rules your **build** already compiled: the declarations a `@ds-button` expanded
into, or the `@media` queries baked into a component's responsive declaration.
So a patch that changes *which declarations a directive would emit* is rejected
with `UXD_THEME_STRUCTURE`, naming what changed and telling you to rebuild:

| Rejected — rebuild required | Allowed — applied immediately |
| --- | --- |
| Adding or removing a `typography_details` field | Changing any token's value |
| Introducing a state such as `focusvisible` | Responsive expressions over the same thresholds |
| Changing the Surface a Button or Input composes from | Dark-mode (`modes.dark`) colors |
| Moving an existing breakpoint threshold | Adding a new token or breakpoint name |
| A palette family losing `main`/`dark`/`contrast` | A field a role already emits |

The distinction is derived from the engines themselves — the same
`buttonDeclarations`, `inputDeclarations`, `surfaceDeclarations` and
`resolveTypographyRole` the compiler emits with — so a field added to an engine
is accounted for without anyone updating a list.

On the server there is no state to share: call `generateThemeCss(theme)` and
render the result. `applyTheme` reports `UXD_THEME_ENVIRONMENT` where there is
no document rather than silently doing nothing.

---

## Typed config and theme (`defineConfig`, `$schema`)

Most UXDSL mistakes are typos, and they are made while writing configuration —
where nothing used to help. `includeThem` and `palete` compile to *nothing at
all*, with no compile error, because an unknown key is simply not read (only
the theme validator's unknown-family warning flags `palete`); `fontsize` and
`focusVisible` do fail (`UXD_TYPO_FIELD`, `UXD_BUTTON_STATE`), but only once
you build. Since beta.6 the editor catches all four as you type.

Setting this up in a consuming app — which of these `uxdsl init` already writes,
the `$schema` path in a monorepo, and the VS Code extension for `.uxdsl` files —
is covered from the start in
[uxdsl-cli's "Editor support"](https://github.com/rsantoyo-dev/uxdsl/blob/main/packages/uxdsl-cli/README.md#editor-support).

**In a plain `uxdsl.config.cjs`**, with no TypeScript in the project — the form
`uxdsl init` writes since `0.5.0-beta.7` (unreleased as of 2026-09-28),
type-only, nothing loaded at run time:

```js
// @ts-check
/** @type {import('postcss-uxdsl/config').UxdslConfig} */
const config = {
  entry: './src/app.uxdsl',
  outFile: './dist/app.css',
  includeTheme: true,
};

module.exports = config;
```

`// @ts-check` is what makes the editor report errors in plain JavaScript, and
the type has to sit on the `const`: placed directly above `module.exports = {…}`
it checks nothing. Or, with a run-time `require` that needs `postcss-uxdsl`
resolvable from the project root (under pnpm, a direct dependency):

```js
// @ts-check
const { defineConfig } = require('postcss-uxdsl/config');

module.exports = defineConfig({
  entry: './src/app.uxdsl',
  outFile: './dist/app.css',
  includeTheme: true,
});
```

`defineConfig` returns its argument unchanged — it exists so the object literal
is checked against `UxdslConfig`. It is deliberately **not** generic: a
`defineConfig<T extends UxdslConfig>` infers `T` from the literal, extra keys
and all, which would accept the typo it is supposed to catch.

The check applies to a *fresh object literal*. For a config assembled
beforehand, annotate it where it is defined, or use
`satisfies UxdslConfig` — passing an already-widened variable through
`defineConfig` cannot recover what the earlier assignment discarded.

**In TypeScript**, the types are exported from the package root:

```ts
import type { UxdslTheme, UxdslThemeOverride, UxdslOptions, UxdslConfig } from 'postcss-uxdsl';
```

`UxdslTheme` is a complete theme; `UxdslThemeOverride` is the partial patch
`resolveTheme` merges over the base, with arrays replaced rather than merged.
The former `UxDslOptions` alias was removed in stability phase 1; the type is `UxdslOptions`.

**In a `uxdsl.theme.json`**, point `$schema` at the packaged JSON Schema:

```json
{
  "$schema": "./node_modules/postcss-uxdsl/schema/theme.schema.json",
  "palette": { "primary": { "main": "#7e22ce", "contrast": "#ffffff" } }
}
```

What is closed and what is open is the same split the compiler makes, because
the schema and the types are both generated from the engine constants rather
than hand-written beside them:

| Closed — a typo is an error | Open — a project extends it |
| --- | --- |
| Theme family names (`KNOWN_THEME_FAMILIES`) | Palette family names (`palette.brand`) |
| `typography_details` field names | `typography_details` role names |
| Surface / Button / Input field names | Surface / Button / Input role names |
| Button and Input state names | `fonts.families` role names |
| `modes` (only `dark` is compiled) | Spacing, density, shadow, border, radius keys |

A family that gains a field in a future release appears in both without anyone
remembering to copy it; one that is removed stops type-checking.

Note that `$schema` itself is metadata, not a family: it compiles to nothing by
design, and the theme validator does not report it as an unknown family.

---

## Source maps

This plugin has no source-map option of its own — it works with PostCSS's
own `map`, so a project that already asks for maps in its
`postcss.config.js` gets them with no extra configuration:

```js
postcss([require('postcss-uxdsl')()]).process(css, {
  from: 'src/panel.uxdsl',
  to: 'dist/panel.css',
  map: { inline: false },
});
```

Positions point at the `.uxdsl` you wrote, not at the compiled CSS:

| Output | Maps back to |
| --- | --- |
| A declaration the plugin rewrote (`density()`, `palette()`, …) | That declaration's own line |
| A responsive declaration split into `@media` rules | The single original declaration |
| Every declaration `@ds-button`/`@ds-surface`/`@ds-input`/`@ds-typo` expands into | The directive's own line |
| A declaration from an `@import`-ed partial | That partial, at its own line |

The theme CSS added by `includeTheme` (the `:root` custom-property blocks,
the `@media` mode blocks, the generated component classes) is deliberately
**not** mapped: it is built from your theme JSON and has no origin in any
`.uxdsl` file, so it lands under PostCSS's own `<no source>` placeholder
with no `sourcesContent`. Through beta.5 each generated block instead
became an invented `<input css …>` source with its entire body inlined in
the map — a handful of authored lines could produce a map several times the
size of the CSS, listing eight "files" that do not exist. Since 0.5.0-beta.6 `sources` is
limited to files you can actually open.

Compiling through `uxdsl-cli` instead? It exposes this as
`--sourcemap`/`--no-sourcemap` and a `sourcemap` config option (spelled like
the flag), and writes the `.map` file next to the CSS — see
[`uxdsl-cli`'s README](../uxdsl-cli/README.md).

---

## Verified from a real install

`fixtures/mig07-consumer/` (in the monorepo, `npm run
verify:consumer-fixture`) installs this package from an actual `npm pack`
tarball — never the monorepo's TypeScript source — and compiles a theme
entry plus four CSS-Module-style panel entries against it. That check is
what caught `package.json`'s `exports` map missing `"./package.json"`,
which broke `require("postcss-uxdsl/package.json")` for any consumer that
reads a dependency's own version that way; fixed in 0.5.0-beta.1.

`fixtures/mig-b3-06-release/` (`npm run verify:beta3`) does the same from
fresh tarballs of all five coordinated packages, exercising `uxdsl-cli`'s
`builds` array end to end: a theme entry and four component entries built
from one `uxdsl.config.cjs`, a partial theme with `externalTokens` and a
theme-file-only `breakpoints.xl`, exactly one entry defining `:root`
across the five outputs, and both negative controls (an unknown token still
fails; `--no-include-theme` overrides every entry).

## Guide for AI agents

Since `0.5.0-beta.7` (unreleased as of 2026-09-28), the package ships the UXDSL
agent guide at `docs/agent-guide.md`, generated from
the repository's `AGENTS.md` for this exact version. Point a consuming project's
agent instructions at `node_modules/postcss-uxdsl/docs/agent-guide.md` rather
than keeping a copy that ages with each upgrade.

---

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
