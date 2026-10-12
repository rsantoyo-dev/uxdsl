# MIG-B9-41 — One demo frame, one token editor

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` (or beta.10 under DEC-03 (b)) |
| Wave | 4 |
| Decision gate | DEC-14 (decided) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-40 |
| Blocks | MIG-B9-42 |
| Base | `feat/beta9` after MIG-B9-40 |
| Owns | `packages/playground-nextjs/src/components/ds/DemoFrame/**`, `src/components/ds/TokenEditor/**` (new), the components they absorb (deleted) |
| Shares | `packages/playground-nextjs/src/components/ThemeContext.tsx`, `src/runtime-sandbox/**`, `scripts/build-paradigm-frame.js`, `fixtures/playground-browser/**` |
| Output impact | the site only |

## 1. Goal

Every interactive demo on the site is the same component with different
content: a live preview, the UXDSL that produced it, its compiled CSS, and
optionally a resize handle and a theme editor. Every theme value is edited
through one editor that applies through `applyTheme`.

## 2. Sources

- Plan §7.2: "`DemoFrame` — the only interactive demo container: a live
  preview, the UXDSL that produced it, its compiled CSS, and optionally a
  resize handle and a theme editor. The home page's resize frame and every
  token page's demo are the same component with different content";
  "`TokenEditor` — one editor for any theme value (today the Density, Space
  and Typography edit dialogs and the JSON editor are separate
  implementations), applying through `applyTheme`."
- Today: `ParadigmFrame.tsx` (an iframe whose width is dragged across the
  breakpoints; the page inside is built by `scripts/build-paradigm-frame.js`;
  the readout is read from the frame's own computed style),
  `InteractiveDemoContainer.tsx`, `Demo*.tsx` (Borders, Breakpoints,
  BreakpointsCards, Buttons, Colors, Density, Shadows, Spacing, Surfaces),
  `InputDemo.tsx`, `RuntimeLab.tsx` (state-changing calls run in an iframe
  sandbox with its own copy of the runtime, `src/runtime-sandbox/sandbox-entry.ts`),
  `EditDialog.uxdsl`, `BreakpointEditor.tsx`, `PalettePlayground.tsx`,
  `ThemeContext.tsx` (`applyTheme(theme, { replace: true, styleId })`, a
  per-frame scheduler that coalesces rapid edits outside `applyTheme`).
- The walk reads the home frame's readout against the theme (the
  `paradigm-mismatch` negative control).

## 3. Preconditions

```bash
test -d packages/playground-nextjs/src/components/ds/Button
test -f packages/playground-nextjs/src/components/ParadigmFrame.tsx
test -f packages/playground-nextjs/src/components/EditDialog.uxdsl
```

## 4. Baseline

Snapshots as in MIG-B9-40 §4 (`/tmp/pg-before.json.gz` from the MIG-B9-40
after state).

## 5. Contract

- **D1 — `DemoFrame`.** Props: `source` (the UXDSL text), `theme` (an
  override or none), `preview` (`'inline' | 'frame'`), `resizable`
  (a width handle across the theme's breakpoints, with a readout from the
  frame's computed style, as `ParadigmFrame` does today), `editor` (a
  `TokenEditor` scope: which theme paths are editable), `showCompiled`
  (the compiled CSS, from the real compiler running in the page through the
  sandbox or precomputed by `capture-examples.js` when the source is static).
  It renders the preview, the source in `CodeBlock`, the compiled CSS in
  `CodeBlock`, and the readout. The home page's frame is
  `<DemoFrame resizable preview="frame" …>`; every token page's demo is a
  `DemoFrame` with inline preview.
- **D2 — `TokenEditor`.** Props: `paths` (theme key paths such as
  `densities.4`, `palette.primary.main`, `typography_details.h1.fontSize`,
  `breakpoints.md`), `theme` (the current effective theme from
  `ThemeContext`). Renders one control per path by value kind (a color, a
  length, a responsive expression as per-breakpoint fields, a plain string),
  validates through `validateTheme` on each change, applies through the
  context's scheduler → `applyTheme`, and shows the runtime's result: a
  `UXD_THEME_STRUCTURE` refusal (for example a moved breakpoint) is displayed
  with its message and a "this needs a rebuild" note, never swallowed.
- **D3 — Absorbed and deleted.** `ParadigmFrame.tsx`, `InteractiveDemoContainer.tsx`,
  `EditDialog.uxdsl`, `BreakpointEditor.tsx`, `PalettePlayground.tsx`'s own
  editor, and the editing parts of `DemoSpacing`, `DemoDensity`, `DemoColors`,
  `TypographyDocumentation`; the `Demo*` components become `DemoFrame`
  instances with content, kept only where their content differs (a demo is
  content, not a component).
- **D4 — Runtime calls stay sandboxed.** State-changing runtime calls keep
  running in the iframe sandbox (`RuntimeLab`); `DemoFrame`'s `showCompiled`
  uses the same sandbox to compile a source on the page (it has the engine
  and the plugin's grammar; if full compilation in the browser is not
  available, the compiled CSS comes from `capture-examples.js` at build time
  and the story says so).
- **D5 — The site looks the same** (declared differences only) and the walk
  passes, including the `paradigm-mismatch` control against the home frame's
  readout.

Must stay byte-identical: the package.

## 6. Out of scope

- New demos: MIG-B9-42.
- The strict check: MIG-B9-43.

## 7. Approach and traps

- `ParadigmFrame`'s iframe page is a compiled example (`public/paradigm-frame/`);
  `DemoFrame preview="frame"` keeps that mechanism (an iframe is a viewport,
  so breakpoints apply) and generalizes the build script to produce one frame
  page per `resizable` demo.
- The scheduler in `ThemeContext.tsx` is the one place edits are batched;
  `TokenEditor` must not call `applyTheme` directly.
- `TokenEditor` for a responsive expression edits `responsiveEntries()` of
  the value (from `uxdsl/language`) and re-serializes; it never parses with
  a regex of its own.
- Stop rule: if a demo's content cannot be expressed as `DemoFrame` props
  without a new prop, add the prop; never a second frame component.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `packages/playground-nextjs/scripts/test-demo-frame.cjs` (new) | `MIG-B9-41: every demo on the site is a DemoFrame; no other component renders an iframe or an editor` (source scan) | unit | D1, D3 | — |
| T2 | `scripts/test-theme-scheduler.cjs` (existing 8) + new | `MIG-B9-41: TokenEditor edits go through the scheduler and a refusal is shown` | unit | D2 | a structural patch is displayed as refused |
| T3 | `fixtures/playground-browser/walk.js` | the home frame readout equals the theme at every width; the `paradigm-mismatch` control still fails | Chrome | D1, D5 | — |
| T4 | `fixtures/playground-browser/compare.js` | only intended differences | Chrome | D5 | — |

## 9. Acceptance criteria

- **AC1** `node packages/playground-nextjs/scripts/test-demo-frame.cjs` exits 0;
  `grep -rl "<iframe" packages/playground-nextjs/src --include='*.tsx' | grep -v components/ds/DemoFrame | grep -v RuntimeLab` prints nothing.
- **AC2** `npm --prefix packages/playground-nextjs test` exits 0.
- **AC3** `npm run verify:playground-browser` exits 0; the compare report has
  only intended differences.
- **AC4** `ls packages/playground-nextjs/src/components/*.tsx | wc -l` is at
  most 25.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:capabilities` | yes |
| playground captures and examples | yes |
| `AGENTS.md` documentation-sources list | yes |

## 11. Documentation

`packages/playground-nextjs/README.md` (DemoFrame, TokenEditor, how a page
adds a demo).

## 12. Verification

```bash
node packages/playground-nextjs/scripts/test-demo-frame.cjs      # exit 0
npm --prefix packages/playground-nextjs test                       # exit 0
npm --prefix packages/playground-nextjs run build                  # background; exit 0
npm run verify:playground-browser                                  # background; exit 0 (Chrome)
```

## 13. Delivery

Branch `feat/b9-41-demo-frame`. Commit:
`feat(FEAT-010): MIG-B9-41 - one DemoFrame and one TokenEditor; the frames and editors they absorb are deleted`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

None yet.
