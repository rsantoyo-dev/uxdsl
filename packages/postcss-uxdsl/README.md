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

`postcss-uxdsl` transforms `.uxdsl` files into optimized CSS. It is typically used alongside `uxdsl-cli` or within frameworks like Next.js and Vite to power your design system.

It enables features like:
- **Variables**: `$primary: #000;`
- **Responsive Functions**: `width: xs(100%) md(50%);`
- **Theme Tokens**: `color: palette(primary-main);`
- **Smart Mixins**: `@ds-button primary;`

<img src="./assets/uxdsl-intro-page.png" width="400px" alt="UXDSL Intro" />

---

## Quick Start

This package works best when initialized with the CLI.

### 1. Install
```bash
npm install -D postcss-uxdsl uxdsl-cli concurrently
```

### 2. Initialize
Auto-configure your project (creates `uxdsl.config.cjs` and entry files).
```bash
npx uxdsl init
```

### 3. Connect & Run
Import the generated CSS in your root layout (e.g., `src/app/layout.tsx`) and start the watcher.

```tsx
// src/app/layout.tsx
import '../src/uxdsl.css';
```

```json
// package.json
"scripts": {
  "dev": "concurrently \"npx uxdsl build --watch\" \"next dev\""
}
```

---

## Syntax Preview

<img src="./assets/code-example.png" width="400px" alt="Code Example" />

For a deep dive into Smart Mixins, Theming, and Component Packs, please visit the official documentation.

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
tokens (`:root { --space-1: ...; --surface-contained-padding: ...; }`) and
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
UXD_REFERENCE_MISSING: color -> --ds__palette__text-secondary has no
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
`"space-gutter"`) — both emit `--space-1` / `--space-gutter`. `space-` is a
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

## Naming collisions

Every generated CSS variable name is built from a logical identifier —
a family and a key (`surface.contained.padding`), or a namespace and a key
(`palette.primary-main`). Two different identifiers can concatenate to the
identical name (a palette key literally named `"primary-main"` collides
with the structured `palette.primary.main`; a surface role named
`"contained-shadow"` collides with role `"contained"` field `"shadow"`).
When that happens, compiling throws `UXD_FOUNDATION_NAME_COLLISION` or
`UXD_PRESET_NAME_COLLISION` naming both identifiers and the variable they
both produce, instead of one silently overwriting the other. Rename
whichever one you didn't intend to share that variable.

---

## Verified from a real install

`fixtures/mig07-consumer/` (in the monorepo, `npm run
verify:consumer-fixture`) installs this package from an actual `npm pack`
tarball — never the monorepo's TypeScript source — and compiles a theme
entry plus four CSS-Module-style panel entries against it. That check is
what caught `package.json`'s `exports` map missing `"./package.json"`,
which broke `require("postcss-uxdsl/package.json")` for any consumer that
reads a dependency's own version that way; now fixed.

---

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
