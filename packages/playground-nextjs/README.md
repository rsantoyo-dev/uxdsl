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

## Scripts worth knowing

- `npm run theme:audit` — a **narrow** check of palette `main`/`contrast` pairs. It is not
  the accessibility gate: the script says how many pairs the shared gate reports failing
  for the same themes. For the real check use `uxdsl theme --contrast` (see the
  `postcss-uxdsl` README).
