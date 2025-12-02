# uxdsl-cli

> The official command-line interface for compiling **UXDSL** files into optimized CSS.

[![npm version](https://img.shields.io/npm/v/uxdsl-cli.svg)](https://www.npmjs.com/package/uxdsl-cli)
[![License](https://img.shields.io/npm/l/uxdsl-cli.svg)](LICENSE)

**[Visit the Official Documentation & Playground](https://uxdsl.vercel.app/)**

---

## Overview

`uxdsl-cli` is a standalone build tool designed to compile `.uxdsl` files into standard CSS.

### Why does this exist?
While UXDSL has plugins for [Vite](../vite-plugin-uxdsl) and [Webpack](../uxdsl-webpack-loader), there are many scenarios where a dedicated build process is preferred or required:
- **Framework Agnostic**: Use UXDSL with any framework or static site generator (Next.js, CLI tools, legacy apps) by simply generating a CSS file.
- **Performance**: Run your CSS compilation in a separate process or during a build step, keeping your main bundler fast.
- **Watch Mode**: Includes a robust file watcher that recompiles your styles instantly as you edit your `.uxdsl` files.

---

## Installation

```bash
# Install locally in your project (Recommended)
npm install uxdsl-cli --save-dev

# Or install globally
npm install -g uxdsl-cli
```

## Usage

### 1. Configuration (Recommended)

Create an `uxdsl.config.cjs` file in your project root to define your entry point, output file, and watch paths.

```js
const path = require('path');

module.exports = {
  // The main entry file that imports all your styles
  entry: path.join(process.cwd(), 'src/app/uxdsl-entry.uxdsl'),
  
  // Where the compiled CSS should be saved
  outFile: path.join(process.cwd(), 'src/app/uxdsl.css'),
  
  // Custom breakpoints (optional)
  breakpoints: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 },
  
  // Files to watch for changes
  watch: ['src/**/*.uxdsl', 'src/**/*.css'],
};
```

### 2. Running the CLI

Add scripts to your `package.json` or run directly via `npx`:

```bash
# Build once for production
npx uxdsl build

# Watch mode for development
npx uxdsl build --watch
```

### 3. CLI Arguments (No Config)

You can also skip the config file and pass paths directly via command line arguments:

```bash
npx uxdsl build --entry src/app/uxdsl-entry.uxdsl --out src/app/uxdsl.css --watch
```

---

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)