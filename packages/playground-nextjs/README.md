# uxdsl-playground-nextjs

The UXDSL documentation site and playground (Next.js). Private: it is not published to npm.

It compiles against the **local** packages in this repository (`file:` dependencies), so
what you see here is the code on your branch, not a published release. `npm run dev`
and `npm run build` first build those packages (`local-deps`).

## Tests

```bash
npm test                 # everything below
npm run test:themes      # the four named themes inherit and generate standalone CSS
npm run test:scheduler   # theme-edit batching (src/lib/theme-scheduler.js)
npm run test:components  # ThemeContext.tsx, rendered for real in jsdom
npm run test:audit       # scripts/audit-themes.mjs
```

All of them run on `node --test`; there is no second test runner. Component tests use
jsdom and React Testing Library, and `scripts/lib/component-harness.cjs` bundles the
component from its own source with esbuild on every load: relative imports are inlined,
bare imports (`react`, `postcss-uxdsl/ds-runtime`) resolve from this package's
`node_modules`, so the component and the test share one React and the runtime under test
is the built package. Build `../postcss-uxdsl` first if `dist/` is missing.

The component tests also run each behavior against a copy of the component with that
behavior deliberately broken and require the test to fail (`negative control:` in
`scripts/test-theme-context.cjs`). Add one when you add a scenario.

The runtime keeps its state per document, so each scenario installs a fresh jsdom
document rather than resetting the previous one.

## Component style scope

The generated `src/app/uxdsl.css` is global. A `.uxdsl` filename alone does not
scope selectors. Every component-owned `.uxdsl` sheet is listed in
`uxdsl-module-entries.json` and compiled to a `.module.css` file with
`includeTheme: false`. Components import that file and apply its exported classes. `scopedClasses`
keeps the original class names where shared page rules or browser controls use them
and adds the module classes. Dynamic classes need the same mapping.

The component styles use local classes for scope; their `id` attributes are still
available to runtime demos that generate CSS against a specific preview. Only the
three sheets shared across components (`CapabilityDocs`, `DocumentationSection`,
`EditDialog`), page styles and design tokens enter the global sheet. Run
`npm run uxdsl:build` after adding a module entry. The capability gate checks that
every component-owned sheet is registered and imported, and that handwritten CSS
Modules stay at zero.

## Scripts worth knowing

- `npm run theme:audit` — runs the shared WCAG gate (`checkThemeContrast`, with the
  shipped exceptions, the same call as `uxdsl theme --contrast`) over the four named themes,
  summarizes the failing pairs per mode/family/pair, and checks typography progressions
  with the engine's own resolvers (`resolveTypographyRole`, `resolveResponsiveValue`). It
  exits 1 while the gate fails — which it does today for every shipped theme (MIG-B6-29);
  that is the honest verdict, not a broken script. Per-pair detail: `uxdsl theme --contrast`.

## Capability coverage

`capability-evidence.json` holds what a text search cannot find (each entry names a file and a
string a test checks), the capabilities that still have no live example, and the baseline for
styling written outside UXDSL. `scripts/capability-matrix.test.js` (run from the repository
root) keeps all three honest; the derived matrix is
`docs/architecture/playground-capability-matrix.md`. When you close a gap, remove it from
`knownGaps` and run `npm run generate:capabilities`.
