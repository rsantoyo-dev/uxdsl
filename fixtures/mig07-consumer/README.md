# MIG-07 consumer fixture

Verifies `postcss-uxdsl` from the outside: installs it from a real
`npm pack` tarball (never the monorepo's TypeScript source) and compiles
one theme entry (`includeTheme: true`) plus four CSS-Module-style panel
entries (`includeTheme: false`), covering the `@ds-surface`/`@ds-button`/
`@ds-input`/`@ds-typo`/`border()`/`radius()` families from the original
migration report.

## Run it

```bash
npm run verify:consumer-fixture   # from the repo root
# or
node run.js                       # from this directory
```

Each run: packs `postcss-uxdsl`, does a clean install of that tarball into
this directory's own `node_modules` (deleting any previous install
first), builds the five entries, and checks:

- All five entries compile without throwing — MIG-03's reference
  validation runs by default, so this alone proves zero unresolved
  mandatory UXDSL references.
- The four panel entries emit zero `:root` blocks; the theme entry does.
- PostCSS and the installed `postcss-uxdsl/ds-runtime`'s `generateThemeCss`
  agree on the same set of theme-entry variables.
- Building twice from the same install produces byte-identical CSS.
- The installed tarball actually ships `README.md`, `CHANGELOG.md` and
  `docs/migration.md` (not just source and `dist/`).
- Effective padding/radius/border resolve via the installed package's own
  inspector functions (`inspectSurfaceTheme`, `inspectEdgeTheme`) at a
  couple of breakpoints.

Compiled CSS is written to `.out/` (gitignored) for manual inspection.

## What this does not verify

Printed at the end of every run, and tracked in
[`docs/features/FEAT-002-beta-migration-hardening.md`](../../docs/features/FEAT-002-beta-migration-hardening.md)
(MIG-07):

- **Real browser-computed styles at each breakpoint.** No headless browser
  is available in this environment (this repo's FEAT-001 implementation
  record notes the same Chromium-download timeout). The inspector-function
  check above is the same non-browser substitute the rest of this
  package's test suite already relies on — not equivalent to an actual
  paint, and documented as such rather than presented as full coverage.
- **An actual CSS Modules build** (e.g. webpack's `css-loader` in strict
  mode) accepting the panel output. This fixture confirms the panels
  contain no `:root` selector, which is the specific thing that loader
  rejects, but does not run that loader.
- **Coordinated multi-package install.** Only `postcss-uxdsl` is packed
  and installed here. `uxdsl-core`, `uxdsl-cli` and `vite-plugin-uxdsl`
  are not exercised by this fixture.
