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

Returns a Promise that resolves to processed CSS string. Kept unchanged for
backward compatibility — new integrations should prefer `compile()` below.

### compile(input, config?)

The one shared compile pipeline (`postcss-scss` → `postcss-import` →
`postcss-advanced-variables` → `postcss-uxdsl`), used by `uxdsl-cli` and
intended for any future bundler adapter (Vite/Webpack) so every consumer
gets identical `@import`, `$var` and comment handling.

```javascript
const { compile } = require('uxdsl-core');

const { css, dependencies, warnings } = await compile(
  { entry: './src/uxdsl-entry.uxdsl' },   // or { source, from? } for in-memory input
  {
    theme,               // effective theme, same shape as postcss-uxdsl's `theme` option
    references,          // same shape as postcss-uxdsl's `references` option
    breakpoints,         // same shape as postcss-uxdsl's `breakpoints` option
    includeTheme: true,  // append the `/*@uxdsl-bp ...*/` + #uxdsl-bp-meta marker (default: true)
    to: './dist/app.css',
    sourceMap: false,    // only `false` is implemented; anything else throws (see MIG-B6-21)
  }
);
```

- `input`: exactly one of `{ entry: string }` (a real `.uxdsl` file on disk)
  or `{ source: string, from?: string }` (in-memory source; `from` is used
  as the base path for relative `@import`s and diagnostics).
- `dependencies`: every file actually read, entry first — safe to feed to a
  bundler's file-watcher.
- `warnings`: `{ text, file?, line?, column? }[]` from the underlying
  PostCSS run.
- `@import` resolution: relative paths (`./x.uxdsl`), bare package
  specifiers (`postcss-uxdsl/theme/default-colors.css`), and `~`-prefixed
  specifiers (`~some-package/x.css`) are all supported — the last two
  resolve through real Node module resolution.
- A missing import is a real, located error (`Failed to find '...' in
  [...]`), not a silently-untouched `@import` line in the output.
- An import cycle (`a.uxdsl` → `b.uxdsl` → `a.uxdsl`) always fails, naming
  the full file chain, rather than silently duplicating content.
- `//` line comments are stripped from the compiled output (as a real Sass
  compiler would); `/* ... */` block comments, including ones containing a
  URL, and `url(...)` values containing `//`, are left completely intact.

## Demo update notes

Use this section for short release notes on each npm tweak.

- v0.1.9 — baseline demo release for current docs/playground flow.
- v0.5.0-beta.6 (MIG-B6-20, FEAT-008) — `compile({ source, from })` (used
  exclusively by `uxdsl-webpack-loader` and by `vite-plugin-uxdsl`'s
  optional Sass pre-pass) now gets the same import-cycle detection and
  bare/`~`-specifier resolution `compile({ entry })` already had — both now
  key off `from`, not just `entry`. Previously an import cycle reached only
  through `{ source, from }` silently duplicated content instead of
  failing, undoing MIG-B6-18's own guarantee for that call shape. No API
  change — `from` was already accepted, just under-used internally.
- v0.5.0-beta.6 (MIG-B6-18, FEAT-008) — replaced the old comment-stripping,
  string-based `@import` inliner with a real `compile()` built on
  `postcss-scss`/`postcss-import`/`postcss-advanced-variables`/
  `postcss-uxdsl`, now shared with `uxdsl-cli`. Fixes silent corruption of
  `url(...)`/block comments containing `//`, and a missing `@import` that
  used to pass through untouched instead of erroring. An import cycle now
  always fails (previously postcss-import silently duplicated content
  instead). `processUxdsl(source, options)`'s signature and `Promise<string>`
  return are unchanged; `compile` is a new named export.
- v0.3.0 — `test/inline-imports.test.js`'s duplicate-import case now passes
  `references: { mode: 'off' }` to `processUxdsl`. It exercises `@import`
  deduplication, not styling, and `postcss-uxdsl`'s reference-integrity
  check (on by default) was aborting the whole test process on unrelated
  always-on defaults the fixture never uses. No change to `uxdsl-core`
  itself.

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
