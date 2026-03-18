# uxdsl-core

> The core processing engine for **UXDSL** — powering the CLI, Vite plugin, and Webpack loader.

[![npm version](https://img.shields.io/npm/v/uxdsl-core.svg)](https://www.npmjs.com/package/uxdsl-core)
[![License](https://img.shields.io/npm/l/uxdsl-core.svg)](LICENSE)

**[Visit the Official Documentation & Playground](https://uxdsl.vercel.app/)**

**Demo release track:** this package may receive frequent small tweaks while docs and playground evolve.

- npm package: [uxdsl-core on npm](https://www.npmjs.com/package/uxdsl-core)
- npm versions: [Version history](https://www.npmjs.com/package/uxdsl-core?activeTab=versions)

---

## Overview

`uxdsl-core` is the low-level transformation library that parses and compiles UXDSL syntax into standard CSS. It is the brain behind the entire ecosystem, responsible for:

- Parsing **Responsive Functions** (`xs()`, `md()`, etc.).
- Resolving **Theme Functions** (`palette()`, `space()`, `radius()`, etc.).
- Handling **Native Variables** (`$var`).
- Managing **Mixins** and **Theme Packs**.


### Who is this for?

You typically do **not** need to install this directly unless you are building a custom integration, such as a plugin for a new bundler (e.g., Rollup, esbuild) or a custom Node.js script. For standard projects, use [uxdsl-cli](../uxdsl-cli) or the plugins for [Vite](../vite-plugin-uxdsl) and [Webpack](../uxdsl-webpack-loader).

---

## Installation

```bash
npm install uxdsl-core
```

## Usage

```javascript
const processUxdsl = require('uxdsl-core');

const css = await processUxdsl(`
body {
  background: palette(primary-main);
  padding: xs(10px) lg(20px);
}
`, {
  breakpoints: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 }
});

console.log(css); // Processed CSS
```

## API

### processUxdsl(source, options)

- `source`: String containing UXDSL code
- `options`: Object with configuration
  - `fileId`: Optional file path for imports
  - `breakpoints`: Object with breakpoint definitions

Returns a Promise that resolves to processed CSS string.

## Demo update notes

Use this section for short release notes on each npm tweak.

- v0.1.9 — baseline demo release for current docs/playground flow.

For automated version bumps in this monorepo:

- Patch: `npm run release:patch` (bump + publish)
- Minor: `npm run release:minor` (bump + publish)
- Major: `npm run release:major` (bump + publish)

For bump-only mode (no publish):

- `npm run release:patch:bump-only`
- `npm run release:minor:bump-only`
- `npm run release:major:bump-only`

If npm publish uses 2FA, pass OTP when releasing:

- `NPM_OTP=123456 npm run release:patch`

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
