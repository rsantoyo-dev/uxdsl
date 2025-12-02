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

`vite-plugin-uxdsl` provides a fast and efficient way to process `.uxdsl` files within your Vite development and build workflows. It acts as a custom loader, transforming your UXDSL syntax into standard CSS, allowing Vite to bundle it effectively. This is the **recommended and most actively supported integration** for UXDSL in modern frontend projects.

### Features
- **Zero-Config (Optional):** Works out of the box with minimal setup for common use cases.
- **Hot Module Replacement (HMR):** Enjoy instant CSS updates without page refreshes during development.
- **Optimized Builds:** Integrates smoothly with Vite's highly optimized production builds.
- **Full UXDSL Feature Support:** Leverage all UXDSL features like theme functions, responsive utilities, and smart mixins.

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
import vitePluginUxdsl from 'vite-plugin-uxdsl';

export default defineConfig({
  plugins: [
    vitePluginUxdsl({
      // Optional: Custom breakpoints (defaults shown)
      breakpoints: {
        xs: 0,
        sm: 480,
        md: 768,
        lg: 1024,
        xl: 1280,
      },
      // Optional: Pass other options directly to uxdsl-core
    }),
  ],
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

### 3. TypeScript Support

If you are using TypeScript, you may encounter a `Cannot find module...` error (TS2307) when importing `.uxdsl` files. To fix this, add the following declaration to your `vite-env.d.ts` (or any `.d.ts` file in your source):

```typescript
/// <reference types="vite/client" />

declare module '*.uxdsl' {
  const content: string;
  export default content;
}
```

## Options

The plugin accepts options that are passed directly to `uxdsl-core`'s processing engine:

-   `breakpoints`: An object defining custom responsive breakpoints (e.g., `{ sm: 480, md: 768 }`).
-   Any other valid `options` for the `processUxdsl` function from `uxdsl-core`.

---

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
