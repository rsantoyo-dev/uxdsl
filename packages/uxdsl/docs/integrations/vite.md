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

## The theme: `@uxdsl theme;` in the global `.uxdsl`

Each `.uxdsl` import is compiled on its own, and a module emits the theme —
the `:root` token definitions and the theme's Google Fonts `@import` — only
where it writes `@uxdsl theme;`. Write it once, at the top level of the global
stylesheet the app imports first; every component module leaves it out and
carries only its own rules:

```css
/* src/global.uxdsl — imported once, from main.js */
@uxdsl theme;
body { margin: 0; }
```

```css
/* src/panel.uxdsl — tokens only */
.panel { @ds-surface(contained); padding: density(2); }
```

A component module alone compiles to its own rules: `.card{padding:density(4)}`
is `.card {\n  padding: var(--uxdsl__density__4);\n}` from `load()`, and 40
bytes in a minified `vite build` asset. There is no option for it; the former
`includeTheme` option is ignored with one `UXD_OPTION_REMOVED` warning per
build (at `buildStart`, once per dev server), as are the other removed options.

`vite build` counts the modules that emitted the theme, from each
compilation's report, and warns `UXD_THEME_MARKER` once at the end of the
build when the theme is defined nowhere or more than once:

```text
[plugin uxdsl] UXD_THEME_MARKER: no module reaches `@uxdsl theme;`, so nothing this build writes defines the --uxdsl__ tokens its CSS references. Write `@uxdsl theme;` once, at the top level of the global stylesheet that defines them.
[plugin uxdsl] UXD_THEME_MARKER: 2 modules emit the theme (src/a.uxdsl, src/b.uxdsl): each reaches `@uxdsl theme;`, itself or through a file it loads. Keep the marker in the one global stylesheet that defines the tokens, not in a partial other stylesheets load.
```

- "No module" is reported only when some module's CSS references a
  `--uxdsl__` token, so a build of plain CSS says nothing.
- "More than one" is reported always: a marker in a partial two modules
  `@use`, or one file imported both plainly and with `?inline` (two modules,
  labelled `src/panel.uxdsl` and `src/panel.uxdsl?inline`). Keep the marker in
  the file imported plainly, once.
- Every rebuild of `vite build --watch` counts again; an SSR build counts its
  own modules; a failed build says nothing.
- **The dev server has no end of build**, so it cannot tell that no module
  emitted the theme: it warns only "more than one", when the set of emitting
  modules changes, and never "no module". Run `vite build` to check for a
  missing marker.

There is no switch to silence the warning.

## Options

```ts
uxdsl({
  theme,             // explicit theme object — skips discovery entirely when given
  references,        // same shape as the PostCSS plugin's `references` option
  discoverTheme,      // default true; see "Project theme" below
  configRoot,         // directory theme discovery searches from — default Vite's own project root
  sass,               // Dart Sass options, passed to compile(): { silenceDeprecations?, quietDeps? }
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

### Dart Sass options (`sass`)

```js
uxdsl({ sass: { silenceDeprecations: ['import'], quietDeps: true } })
```

`compile()` passes `sass` to Dart Sass: `silenceDeprecations` lists the
deprecation ids it stops reporting (each is otherwise a `UXD_SASS_WARNING`),
and `quietDeps` silences the deprecations of packages loaded from load paths
or `pkg:`. `compile()` validates it: another key, or a value of the wrong
type, fails the load with its message (`uxdsl: unknown sass option "…"`). It
is the same option as the CLI's `sass` config key.

### Warnings and watched files

Every `compile()` warning reaches Vite through `this.warn()` as one line,
`<file>:<line>:<column>: <text>`, with the file relative to Vite's root —
`styles/_partial.uxdsl:1:9: UXD_SASS_WARNING: [import] Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.`
— and a warning with no position (Dart Sass's
`N repetitive deprecation warnings omitted.`) is its text alone. Every file
Dart Sass loaded for the module (a `@use`d, `@forward`ed or `@import`ed
partial, a `.scss` file, a package's file) and the discovered theme file are
added with `addWatchFile`, so an edit to any of them recompiles it, with two
exceptions. The dev server does not watch `node_modules` (Vite's default
`server.watch.ignored`), so an edit to a package's file is not seen. And a
load that fails adds no file: a partial an earlier load added stays
watched, but one the failing load was the first to load (a new `@use`
whose file has an error) recompiles nothing when it is fixed, until the
`.uxdsl` file Vite imports is saved.

### Dart Sass runs inside `compile()`

`compile()` runs Dart Sass itself, so the plugin needs no Sass pre-pass: a
`.uxdsl` file reaches Vite as compiled CSS, Vite's own
`css.preprocessorOptions` do not apply to it, and Dart Sass's options go in
`sass` (above). The former `scss: 'on'` option, which ran the `sass` package
over a `.uxdsl` file before the pipeline, is gone. A `.uxdsl` file may `@use`
a `.scss`, `.sass` or `.css` file, which Dart Sass reads as written, so
UXDSL's dotted tokens belong in the `.uxdsl` files:

```scss
// src/app.uxdsl
@use 'vendor' as v;   // src/_vendor.scss: plain SCSS, read as written
```

The `compile()` guide's [Sass inside `compile()`](compile.md#sass-inside-compile)
has the importer rules and what each extension decides.

---

## Source maps

**Not advertised as supported.** When Vite's own `build.sourcemap` (or
`css.devSourcemap`) is on, this plugin does hand Vite a correct source map
for the CSS it compiled — but `fixtures/vite-adapter/run.js` checks the
emitted asset and finds that Vite's CSS pipeline does not carry the
`.uxdsl` source through to the final `.css.map`. Rather than claim a
feature the fixture does not prove, the outcome is reported by that fixture
on every run — against `vite@^5` and `vite@^7`, each in its own fresh
install — so if a future Vite version does chain it, the fixture starts
asserting the real lookup instead.

The plugin never returns a CSS map as the source map of a JavaScript
module; the map it returns belongs to the CSS module it just produced.

Use the CLI (`uxdsl build --sourcemap`) or the Webpack loader, both of
which have verified map support, if source maps are a requirement today.

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
