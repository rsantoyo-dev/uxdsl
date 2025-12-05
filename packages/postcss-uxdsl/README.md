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

<p align="center">
  <a href="https://uxdsl.vercel.app/docs/home">
    <strong>Explore the Full Docs &rarr;</strong>
  </a>
</p>

---

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
