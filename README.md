# UXDSL Monorepo

UXDSL is a design-system-oriented CSS dialect with compiler + runtime tooling.

## Feature roadmap

- [FEAT-001 — Unified UXDSL Language Engine](docs/features/FEAT-001-unified-language-engine.md): proposed roadmap to align PostCSS, runtime, playground and VS Code around shared semantics, with migration gates and contract tests.

### Shared language foundation (in progress)

`postcss-uxdsl/language` now owns breakpoint defaults, Density defaults,
responsive selection and Density rule generation. PostCSS, the runtime theme
generator and the Density playground delegate to this module. Existing runtime
breakpoint exports remain compatible. The module has no DOM or Node built-in
dependencies; a production browser bundle remains to be measured.

Run `npm test` for shared language tests, existing core import tests and generated
artifact drift checks. Run `npm run generate:language` after changing language
defaults or completion metadata. This generates the Density theme file, the
Density/breakpoint portions of the manifest, and VS Code completion data.

This is not full engine unification: other token families, strict reference
validation, process-global compiler caches, full editor schema/diagnostics and
browser verification remain tracked in FEAT-001. Density-15's pre-existing
reference to space-17 is preserved pending default-scale reconciliation.

### Density documentation simulator

`/docs/densities` includes an isolated iframe viewport with Auto, theme breakpoint
buttons, a width slider and exact pixel input. It reports the actual iframe width,
active breakpoint, inherited token rule and browser-computed padding. Card/form
examples share the selected Density token; a `space(4)` example shows fixed spacing.
The main Russian Doll and token cards still follow the outer browser viewport.

To check locally, start the Next.js playground and compare widths 767/768/769 and
1279/1280/1281 with default breakpoints. At 1024px, Density 4 should report `lg`
with the inherited `md` rule. Edit that rule and verify both examples change while
the fixed comparison does not. Auto should follow the available documentation
width. Custom themes may have different thresholds and spacing values.

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

## NPM release auto-increment workflow

Before publish commands, ensure npm auth is active:

- `npm whoami`
- if needed: `npm login`

If your npm account enforces 2FA for publish, pass OTP when running release:

- `NPM_OTP=123456 npm run release:patch`
- or `node scripts/release.js --bump patch --otp 123456`

Use automated semver bumping for all publishable UXDSL packages (publish by default):

- Patch: `npm run release:patch`
- Minor: `npm run release:minor`
- Major: `npm run release:major`

Bump-only variants (no publish):

- Patch: `npm run release:patch:bump-only`
- Minor: `npm run release:minor:bump-only`
- Major: `npm run release:major:bump-only`

You can run these from repo root or from `packages/playground-nextjs` (proxied scripts are available there too).

You can also include a short tweak note (stored in `packages/uxdsl-core/README.md`):

- `node scripts/release.js --bump patch --note "small parser fix"`
