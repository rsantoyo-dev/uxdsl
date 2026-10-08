# `uxdsl/vite` — the Vite plugin

> The official **Vite** plugin for **UXDSL** — seamlessly integrating `.uxdsl` files into your Vite projects.

Part of the [`uxdsl`](../../README.md) package (`npm i -D uxdsl`). Until 0.5.0-beta.6 this was the separate `vite-plugin-uxdsl` package; that name is deprecated and only re-exports `uxdsl`.

**[Visit the Official Documentation & Playground](https://uxdsl.io/)**

---

## Overview

`uxdsl/vite` turns a `.uxdsl` import into a real CSS import, handled by
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
- **Project theme discovery:** reads `uxdsl.theme.json` /
  `uxdsl.theme.{js,cjs}` automatically, the same way the `uxdsl` CLI does.
- **Full UXDSL Feature Support:** theme functions, responsive utilities and
  `@ds-*` directives — compiled through the same `compile()` pipeline the
  CLI uses, so the same entry and theme produce the same CSS everywhere.

---

## Installation

```bash
npm i -D uxdsl
```

Works with Vite 4 and later (`peerDependencies.vite: ">=4.0.0"`, verified through
Vite 8). `postcss` is a peer dependency that Vite already brings.

## Usage

### 1. Configure the Plugin

Add `uxdsl/vite` to your `vite.config.js` or `vite.config.ts`:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import uxdsl from 'uxdsl/vite';

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
  references,        // same shape as the PostCSS plugin's `references` option
  includeTheme,       // emit (or skip) the global :root token definitions — default true
  discoverTheme,      // default true; see "Project theme" below
  configRoot,         // directory theme discovery searches from — default Vite's own project root
})
```

### Project theme (`discoverTheme`, `configRoot`)

When `theme` is omitted, the plugin looks for the project's theme file —
`uxdsl.theme.json`, or `uxdsl.theme.js`/`.cjs` exporting the theme
object (or a function returning it) — in your Vite project root (Vite's
resolved `root`) and compiles against it; no extra option needed for a
normal project. `configRoot` points discovery somewhere else (a monorepo
running Vite with a non-default `root`, for instance); `discoverTheme: false`
always validates against the built-in default theme instead. An explicit
`theme` always wins outright, regardless of `discoverTheme`.

A theme file exports the theme and nothing else. `references` is a plugin
option, never something the theme file carries — a file exporting the former
`{ theme, references }` wrapper fails the build with a message saying so.

### Breakpoints

Thresholds are the theme's own `breakpoints` family, declared in the theme
file (or the `theme` option) and read from there by every integration:

```js
// uxdsl.theme.cjs
module.exports = { breakpoints: { xl: 1440 } }; // xs/sm/md/lg keep UXDSL's defaults
```

There is no `breakpoints` plugin option. With no theme at all, the defaults
are `{ xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 }`.

### No SCSS pre-pass

`$var`, `@each`, `@mixin`/`@include` and `@if` are handled by the shared
compile pipeline itself. The former `scss: 'on'` option ran the `sass`
package over a `.uxdsl` file first; a `.uxdsl` file's own syntax is not valid
SCSS, so that was a second compiler with no parity guarantee, and it is gone.

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
