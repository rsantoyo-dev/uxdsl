# uxdsl-webpack-loader

> The official **Webpack** loader for **UXDSL** — enabling seamless import and compilation of `.uxdsl` files.

[![npm version](https://img.shields.io/npm/v/uxdsl-webpack-loader.svg)](https://www.npmjs.com/package/uxdsl-webpack-loader)
[![License](https://img.shields.io/npm/l/uxdsl-webpack-loader.svg)](LICENSE)

**[Visit the Official Documentation & Playground](https://uxdsl.vercel.app/)**

---

## Overview

`uxdsl-webpack-loader` allows you to import `.uxdsl` files directly into your JavaScript/TypeScript modules. It processes them on the fly, converting UXDSL syntax into standard CSS that can be handled by `css-loader` and `style-loader`.

### Features
- **Direct Imports**: `import './styles.uxdsl';` works out of the box.
- **Hot Module Replacement (HMR)**: Updates your styles instantly during development (when used with `style-loader`).
- **Configurable**: Pass your custom breakpoints and theme settings directly via webpack config.

---

## Installation

```bash
npm install uxdsl-webpack-loader uxdsl-core --save-dev
```

## Usage

In `webpack.config.js`:

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.uxdsl$/,
        use: [
          'style-loader', // 3. Inject styles into DOM
          'css-loader',   // 2. Turn CSS into CommonJS
          {
            loader: 'uxdsl-webpack-loader', // 1. Compile UXDSL to CSS
            options: {
              // Optional: Custom Breakpoints
              breakpoints: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 }
            }
          }
        ]
      }
    ]
  }
};
```

Then in your application code:

```javascript
import './styles.uxdsl';
```

## Options

- `breakpoints`: Object defining responsive breakpoints (e.g. `{ sm: 480, md: 768 }`)
- Any other options accepted by `uxdsl-core`.

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)