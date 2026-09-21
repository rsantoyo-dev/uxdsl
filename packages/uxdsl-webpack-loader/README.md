# uxdsl-webpack-loader

> The official **Webpack** loader for **UXDSL** — enabling seamless import and compilation of `.uxdsl` files.

[![npm version](https://img.shields.io/npm/v/uxdsl-webpack-loader.svg)](https://www.npmjs.com/package/uxdsl-webpack-loader)
[![License](https://img.shields.io/npm/l/uxdsl-webpack-loader.svg)](LICENSE)

**[Visit the Official Documentation & Playground](https://uxdsl.vercel.app/)**

---

## Overview

`uxdsl-webpack-loader` compiles a `.uxdsl` file to real CSS text (MIG-B6-20,
FEAT-008, decision D-4) — the same `compile()` pipeline `uxdsl-cli` and
`vite-plugin-uxdsl` use, so the same entry and theme produce the same CSS
everywhere. Chain it before `css-loader` (with `style-loader` or
`MiniCssExtractPlugin` in front of that) exactly like any other CSS-producing
loader.

### Features

- **Direct Imports**: `import './styles.uxdsl';` works out of the box.
- **Real dependency tracking**: every `@import`-ed partial (and the
  discovered theme file) is registered via `this.addDependency()`, so
  webpack's cache and watch mode actually see an edit to either.
- **Project theme discovery**: reads `uxdsl.theme.config.*`/
  `uxdsl.theme.json` from `rootContext` automatically, the same way
  `uxdsl-cli` always has.
- **Configurable**: options arrive via webpack 5's real `this.getOptions()`.

---

## Installation

```bash
npm install uxdsl-webpack-loader uxdsl-core --save-dev
```

MIG-B6-28 (FEAT-008): the published tarball now declares an explicit `files`
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
          'uxdsl-webpack-loader', // 1. Compile UXDSL to CSS
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
  loader: 'uxdsl-webpack-loader',
  options: {
    theme,            // explicit theme object — skips discovery entirely when given
    references,       // same shape as postcss-uxdsl's `references` option
    breakpoints,       // same shape as postcss-uxdsl's `breakpoints` option
    includeTheme,      // emit (or skip) the global :root token definitions — default true
    discoverTheme,     // default true; see "Project theme" below
    configRoot,        // directory theme discovery searches from — default webpack's rootContext
  },
}
```

### Project theme (`discoverTheme`, `configRoot`)

When `theme` is omitted, the loader looks for a conventional
`uxdsl.theme.config.{cjs,js,json}`/`uxdsl.theme.json` in `rootContext` (your
webpack config's own directory, by default) and compiles against it — no
extra option needed for a normal project. `configRoot` points discovery
somewhere else; `discoverTheme: false` always validates against the
built-in default theme instead. An explicit `theme` always wins outright,
regardless of `discoverTheme`.

### `breakpoints` default

If you do not provide `breakpoints` (and no theme — explicit or
discovered — declares its own), the loader uses UXDSL's shared default map:

```ts
{ xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 }
```

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
