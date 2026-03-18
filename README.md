# UXDSL Monorepo

UXDSL is a design-system-oriented CSS dialect with compiler + runtime tooling.

## Main packages

- `packages/postcss-uxdsl` — Core compiler and runtime helpers.
- `packages/vite-plugin-uxdsl` — Vite integration for `.uxdsl` files.
- `packages/uxdsl-cli` — Build/watch CLI for framework-agnostic usage.
- `packages/uxdsl-core` — Low-level processing engine used by integrations.
- `packages/uxdsl-webpack-loader` — Webpack integration.
- `packages/uxdsl-vscode` — VS Code language support.
- `packages/playground` / `packages/playground-nextjs` — Demo apps.

## Breakpoint source of truth

Breakpoint defaults are centralized in:

- `packages/postcss-uxdsl/src/ds-runtime/breakpoints.ts`

Please reuse this shared default map (`DEFAULT_BREAKPOINTS`) in integrations and demos rather than redefining the values.

Default values:

```ts
{ xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 }
```

## Quick start (Next.js playground)

1. Open a terminal in `packages/playground-nextjs`.
2. Install deps: `npm install`.
3. Build UXDSL CSS: `npm run uxdsl:build`.
4. Start app: `npm run dev`.

## Commit policy for npm package updates

To keep npm consumers and viewers informed, commits now enforce a docs update step for publishable packages.

- If code changes are staged under `packages/<pkg>/` (non-private npm packages), you must also stage:
  - `packages/<pkg>/README.md`, or
  - root `README.md`

This runs automatically in pre-commit via:

- `npm run verify:docs`

You can run it manually before committing.

