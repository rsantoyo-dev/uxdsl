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

**Known caveat:** the shipped default tokens are not self-contained. The
default Density scale (`DEFAULT_DENSITIES`) references `space(1)` through
`space(16)`, and the default border/radius presets reference
`color(gray.300..600)`. If your theme's `spacing` or `colors.gray` does not
cover that full range, compiling with the defaults active will fail
reference validation. Either configure a full spacing scale and a `gray`
color scale, override the specific density/border/radius tokens you use, or
set `references: { mode: 'warn' }` while you migrate a theme that only
partially covers the defaults.

---

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
