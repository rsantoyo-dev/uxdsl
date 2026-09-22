# vite-plugin-uxdsl

<p align="center">
  <img src="./assets/logo-uxdsl.png" alt="UX-DSL Logo" width="120" />
</p>

> The official **Vite** plugin for **UXDSL** — seamlessly integrating `.uxdsl` files into your Vite projects.

[![npm version](https://img.shields.io/npm/v/vite-plugin-uxdsl.svg)](https://www.npmjs.com/package/vite-plugin-uxdsl)
[![License](https://img.shields.io/npm/l/vite-plugin-uxdsl.svg)](LICENSE)

**[Visit the Official Documentation & Playground](https://uxdsl.vercel.app/)**

---

## Overview

`vite-plugin-uxdsl` turns a `.uxdsl` import into a real CSS import, handled by
Vite's own CSS pipeline (MIG-B6-20, FEAT-008, decision D-4) — the same
extraction, HMR and SSR handling Vite gives any other `.css` file, not a
custom runtime `<style>` injection. This is the **recommended and most
actively supported integration** for UXDSL in modern frontend projects.

### Features

- **Real CSS, Vite's way:** `vite build` extracts a real `.css` asset; dev
  mode gets Vite's native CSS HMR; SSR gets an empty/no-op module instead of
  reaching for `document`.
- **`?inline` works like it does for any Vite CSS import:** `import css from
  './panel.uxdsl?inline'` returns the compiled CSS as a string.
- **Project theme discovery:** reads `uxdsl.theme.config.*`/
  `uxdsl.theme.json` automatically, the same way `uxdsl-cli` always has.
- **Full UXDSL Feature Support:** theme functions, responsive utilities and
  `@ds-*` directives — compiled through the same `compile()` pipeline the
  CLI uses, so the same entry and theme produce the same CSS everywhere.

---

## Installation

```bash
npm install vite-plugin-uxdsl uxdsl-core --save-dev
```

## Usage

### 1. Configure the Plugin

Add `vite-plugin-uxdsl` to your `vite.config.js` or `vite.config.ts`:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import uxdsl from 'vite-plugin-uxdsl';

export default defineConfig({
  plugins: [uxdsl()],
});
```

### 2. Import Your Styles

In your application's main entry file (e.g., `main.js`, `main.ts`, `App.jsx`, `App.tsx`), import your `.uxdsl` stylesheet:

```javascript
// main.js or App.jsx
import './index.uxdsl';
// or
import './app.uxdsl';
```

This is a plain CSS-language import — like `import './index.css'` — so it
has no meaningful default export. Need the compiled CSS as a string
instead (for CSS-in-JS, inlining into an email template, etc.)? Use Vite's
own `?inline` suffix:

```javascript
import panelCss from './panel.uxdsl?inline'; // panelCss is the compiled CSS string
```

### 3. TypeScript Support

If you are using TypeScript, you may encounter a `Cannot find module...` error (TS2307) when importing `.uxdsl` files. To fix this, you need to provide a type declaration.

**If `vite-env.d.ts` exists:** Add the following to your `vite-env.d.ts` file:

**If `vite-env.d.ts` does not exist:** Create a new file (e.g., `src/uxdsl-env.d.ts` or `uxdsl-env.d.ts` at your project root) and add the following content:

```typescript
/// <reference types="vite/client" />

declare module '*.uxdsl' {}
```

`?inline` is already covered by Vite's own client types
(`declare module '*?inline' { const src: string; export default src }`) —
nothing extra to declare for that form.

Ensure your `tsconfig.json`'s `include` array covers this new file (e.g., `"include": ["src/**/*.ts", "src/**/*.d.ts"]`).

## Options

```ts
uxdsl({
  theme,             // explicit theme object — skips discovery entirely when given
  references,        // same shape as postcss-uxdsl's `references` option
  breakpoints,        // same shape as postcss-uxdsl's `breakpoints` option
  includeTheme,       // emit (or skip) the global :root token definitions — default true
  discoverTheme,      // default true; see "Project theme" below
  configRoot,         // directory theme discovery searches from — default Vite's own project root
  scss,               // 'on' | 'off' — see "SCSS pre-pass" below; default off
  scssLoadPaths,      // extra Sass load paths, only consulted when scss: 'on'
})
```

### Project theme (`discoverTheme`, `configRoot`)

When `theme` is omitted, the plugin looks for a conventional
`uxdsl.theme.config.{cjs,js,json}`/`uxdsl.theme.json` next to your Vite
project root and compiles against it — no extra option needed for a normal
project. `configRoot` points discovery somewhere else (a monorepo running
Vite with a non-default `root`, for instance); `discoverTheme: false`
always validates against the built-in default theme instead, matching
every version of this plugin before this feature existed. An explicit
`theme` always wins outright, regardless of `discoverTheme`.

### `breakpoints` default

If you do not provide `breakpoints` (and no theme — explicit or
discovered — declares its own), the plugin uses UXDSL's shared default map:

```ts
{ xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 }
```

### SCSS pre-pass (`scss: 'on'`)

Off by default. UXDSL's own `$var`, responsive expressions (`xs()`/`md()`)
and `@ds-*` directives don't need this at all — plain `$var`, `@each` and
`@mixin` are already handled by `postcss-advanced-variables` inside the
normal compile pipeline. `scss: 'on'` opts a `.uxdsl` file into a full Sass
pre-pass (via the `sass` package, which you install yourself) before UXDSL
compiles it, for projects that genuinely want Sass's nesting/functions/
control-flow syntax mixed into their `.uxdsl` files. It is **not covered by
the CLI/core/Webpack parity guarantee** the rest of this plugin has:
Sass runs first, then the exact same `compile()` pipeline everything else
uses runs on its output.

There used to be an `'auto'` mode that activated silently whenever the
*host project* happened to have `sass` installed, for any reason — removed:
a `.uxdsl` file's own syntax is not valid SCSS, so an unrelated dependency
silently changing how every file in the project compiled was never safe.

---

## Source maps

**Not advertised as supported.** When Vite's own `build.sourcemap` (or
`css.devSourcemap`) is on, this plugin does hand Vite a correct source map
for the CSS it compiled — but `fixtures/vite-adapter/run.js` checks the
emitted asset and finds that Vite's CSS pipeline does not carry the
`.uxdsl` source through to the final `.css.map`. Rather than claim a
feature the fixture does not prove, the outcome is reported by that fixture
on every run, so if a future Vite version does chain it, the fixture starts
asserting the real lookup instead.

The plugin never returns a CSS map as the source map of a JavaScript
module; the map it returns belongs to the CSS module it just produced.

Use the CLI (`uxdsl build --sourcemap`) or the Webpack loader, both of
which have verified map support, if source maps are a requirement today.

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
