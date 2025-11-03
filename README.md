# UXDSL Monorepo

This repo contains a minimal UX-focused CSS dialect (UXDSL) and tooling to load it in a Vite + React app.

Packages:

- `packages/postcss-uxdsl` — PostCSS plugin that supports root-level `$var: value;` declarations and `$var` substitutions in values.
- `packages/vite-plugin-uxdsl` — Vite loader that transforms `.uxdsl` files and injects resulting CSS at runtime.
- `packages/playground` — React demo app importing a `.uxdsl` stylesheet.

## Quick start

1. Open a terminal in `packages/playground`.
2. Install deps: `npm install` (or `pnpm install` / `yarn`).
3. Start dev server: `npm run dev`.
4. Visit the printed URL to see “Hello UXDSL”.

Notes:

- The `.uxdsl` files accept plain CSS plus the root-level `$var` feature. Nested rules and other SCSS features are not implemented (by design, to keep the demo minimal). You can extend the PostCSS plugin to support more features.

