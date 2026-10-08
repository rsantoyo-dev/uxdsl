# `uxdsl/webpack` — the Webpack loader

> The official **Webpack** loader for **UXDSL** — enabling seamless import and compilation of `.uxdsl` files.

Part of the [`uxdsl`](../../README.md) package (`npm i -D uxdsl`). Until 0.5.0-beta.6 this was the separate `uxdsl-webpack-loader` package; that name is deprecated and only re-exports `uxdsl`.

**[Visit the Official Documentation & Playground](https://uxdsl.io/)**

---

## Overview

`uxdsl/webpack` compiles a `.uxdsl` file to real CSS text (MIG-B6-20,
FEAT-008, decision D-4) — the same `compile()` pipeline the CLI and
`uxdsl/vite` use, so the same entry and theme produce the same CSS
everywhere. Chain it before `css-loader` (with `style-loader` or
`MiniCssExtractPlugin` in front of that) exactly like any other CSS-producing
loader.

### Features

- **Direct Imports**: `import './styles.uxdsl';` works out of the box.
- **Real dependency tracking**: every `@import`-ed partial (and the
  discovered theme file) is registered via `this.addDependency()`, so
  webpack's cache and watch mode actually see an edit to either.
- **Project theme discovery**: reads `uxdsl.theme.json` /
  `uxdsl.theme.{js,cjs}` from `rootContext` automatically, the same
  way the `uxdsl` CLI does.
- **Configurable**: options arrive via webpack 5's real `this.getOptions()`.

---

## Installation

```bash
npm i -D uxdsl
```

MIG-B6-28 (FEAT-008, `0.5.0-beta.6`): the published tarball declares an explicit `files`
field (`index.js`, `README.md`) instead of shipping everything not
gitignored — this loader has no build step and no other runtime file, so
nothing else was ever needed.

## Usage

In `webpack.config.js`:

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.uxdsl$/,
        use: [
          'style-loader', // 3. Inject styles into the DOM (or MiniCssExtractPlugin.loader to extract a real .css file)
          'css-loader',   // 2. Turn CSS into a CommonJS module
          'uxdsl/webpack', // 1. Compile UXDSL to CSS
        ],
      },
    ],
  },
};
```

Then in your application code:

```javascript
import './styles.uxdsl';
```

## Options

```js
{
  loader: 'uxdsl/webpack',
  options: {
    theme,            // explicit theme object — skips discovery entirely when given
    references,       // same shape as the PostCSS plugin's `references` option
    includeTheme,      // emit (or skip) the global :root token definitions — default true
    discoverTheme,     // default true; see "Project theme" below
    configRoot,        // directory theme discovery searches from — default webpack's rootContext
  },
}
```

### Project theme (`discoverTheme`, `configRoot`)

When `theme` is omitted, the loader looks for the project's theme file —
`uxdsl.theme.json`, or `uxdsl.theme.js`/`.cjs` exporting the theme
object (or a function returning it) — in `rootContext` (webpack's `context`
option, which defaults to the current working directory) and compiles
against it; no extra option needed for a normal project. `configRoot` points
discovery somewhere else; `discoverTheme: false` always validates against
the built-in default theme instead. An explicit `theme` always wins
outright, regardless of `discoverTheme`.

A theme file exports the theme and nothing else. `references` is a loader
option, never something the theme file carries — a file exporting the former
`{ theme, references }` wrapper fails the compilation with a message saying so.

### Breakpoints

Thresholds are the theme's own `breakpoints` family, declared in the theme
file (or the `theme` option); there is no `breakpoints` loader option. With
no theme at all, the defaults are `{ xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 }`.

## Source maps

**Verified end to end** (`fixtures/webpack-adapter/run.js`): with
`devtool: 'source-map'` and `css-loader`'s own `sourceMap: true`, the map
this loader produces reaches `css-loader`, `MiniCssExtractPlugin` emits
`styles.css.map`, and resolving a position in that map lands back on the
original `.uxdsl` source. The fixture asserts exactly that lookup, not just
that a map file exists.

The loader follows webpack's own `this.sourceMap` (set from `devtool`), so
no loader option is needed; pass `sourceMap: true`/`false` in the loader
options only to override it. The map is handed to the next loader as a real
object, never as a JSON string or an inline data URI, so `css-loader` can
compose it with its own.

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
