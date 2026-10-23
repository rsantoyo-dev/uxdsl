# MIG-B9-42 — Every principle demonstrated live, the superset included

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 4 |
| Decision gate | DEC-14 (decided) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-41 |
| Blocks | MIG-B9-43 |
| Base | `feat/beta9` after MIG-B9-41 |
| Owns | `packages/playground-nextjs/src/app/page.tsx` (the home's demo sequence), `src/app/docs/introduction/page.mdx`, `src/app/docs/from-scss/page.mdx` (new), the demo content files |
| Shares | `src/runtime-sandbox/**` (the compiler in the page), `src/lib/docs.ts` (navigation), `fixtures/playground-browser/walk.js` (new checks) |
| Output impact | the site only |

## 1. Goal

The site proves each of the five principles with a demo that drives the real
API, and shows the superset the way a visitor will meet it: paste SCSS, see it
compile unchanged, add one token.

## 2. Sources

- Plan §4.1, the five principles: components name decisions, never values;
  the theme resolves each decision for its context; a decision that cannot be
  honoured is an error; the theme is data; it is CSS.
- Plan §7.3: one demo per principle, each "driving the real API rather than
  describing it" (the component next to its compiled CSS with an editor; the
  resize frame plus the light/dark switch with a readout; an editor where
  typing an undefined token shows the real `UXD_*` diagnostic from the real
  compiler running in the page; one JSON seen in the page, the contrast
  report and the CLI's `theme --diff`; the compiled output as plain custom
  properties with a native-CSS escape hatch).
- DEC-00 and the plan's ladder: "rename `.scss` to `.uxdsl` and everything
  keeps working"; "UXDSL is to SCSS what TypeScript is to JavaScript".
- The runtime sandbox (`RuntimeLab`) already runs the real runtime in an
  iframe; the diagnostics page renders `DIAGNOSTIC_CATALOG`; the contrast page
  calls `checkThemeContrast` for real and the walk checks it equals Node.
- MIG-B9-31 (scoped palettes) and MIG-B9-34 (focus) need live examples for
  the capability matrix.

## 3. Preconditions

```bash
test -d packages/playground-nextjs/src/components/ds/DemoFrame
grep -q "'/docs/introduction'" packages/playground-nextjs/src/lib/docs.ts
test ! -d packages/playground-nextjs/src/app/docs/from-scss
```

## 4. Baseline

The MIG-B9-41 after snapshot; the capability matrix's current list.

## 5. Contract

- **P1 — Principle 1, "components name decisions".** A `DemoFrame` with a
  card (`@ds-surface(contained)`, `padding: density(4)`), its compiled CSS,
  and a `TokenEditor` on `densities.4` and `palette.surface.main`: editing
  the theme changes the preview and the compiled CSS panel shows the
  component's source unchanged.
- **P2 — Principle 2, "the theme resolves each decision for its context".**
  The resizable frame (viewport) and the light/dark switch (mode) on the same
  component, with a live readout of `--uxdsl__density__4`, the padding, the
  `surface.main` color and the matching breakpoint, read from the frame's
  computed style (the home page's frame, extended with the mode switch).
  A second frame shows a scoped palette: a `data-uxdsl-scope` container
  with a brand override and a `data-theme="dark"` section, both inside a
  light page (MIG-B9-31 live).
- **P3 — Principle 3, "a decision that cannot be honoured is an error".** An
  editor where the visitor types UXDSL and sees the result of the **real
  compiler** running in the page: `space(17)` → `UXD_SPACE_REFERENCE` with
  its suggestion; `padding: spacing(2)` → `UXD_FUNCTION_UNKNOWN`;
  `@ds-surface(outlined light)` → `UXD_TONE_CANVAS`; `xxl(1rem)` →
  `UXD_BREAKPOINT_UNKNOWN`; valid input → the compiled CSS. The compiler runs
  in the sandbox iframe; if the full `compile()` (Sass) cannot run in the
  browser, the editor compiles with the PostCSS plugin alone and says so
  (CSS plus UXDSL), and the Sass part is shown through P6's precomputed
  outputs.
- **P4 — Principle 4, "the theme is data".** One JSON edited once (a
  `TokenEditor` on `palette.primary.main`) and seen in three places at the
  same time: the page (through `applyTheme`), the contrast report (through
  `checkThemeContrast`, recomputed in the page) and the `uxdsl theme --diff`
  view (the CLI's output for the same override, from the captures or the
  sandbox).
- **P5 — Principle 5, "it is CSS".** The compiled output of P1 shown as plain
  custom properties, and the same component with a native-CSS exception
  written after the directive (`border-style: dashed`) to show the escape
  hatch and the cascade rule.
- **P6 — The superset, live.** `/docs/from-scss`: three steps on one page.
  (1) A real SCSS snippet (a map, `@each`, a mixin, `&__title`, `math.div`)
  shown with its Dart Sass output and its UXDSL output side by side,
  byte-identical, from `capture-examples.js` at build time (the Bootstrap
  figures from `fixtures/sass-corpus` quoted as a line of evidence). (2) The
  same snippet with one value replaced by `density(4)` and one color by
  `palette(primary.main)`, its output. (3) The adoption ladder in three
  sentences and the TypeScript line. The page is linked from the home page
  and from the "Start" section of the navigation.
- **P7 — Focus, live.** `/docs/accessibility` shows the focus rule: a link, a
  button and a summary element with keyboard focus and the `focus` family's
  values, editable through `TokenEditor` (MIG-B9-34 live).
- **P8 — The walk grows.** `walk.js` gains: on the P3 route, typing `space(17)`
  in the editor yields a diagnostic whose code equals Node's for the same
  input; on the P4 route, after an edit, the contrast report in the page
  equals `checkThemeContrast` in Node for the same theme; on `/docs/from-scss`,
  the two outputs of step 1 are identical strings.
- **P9 — No gap.** `npm run generate:capabilities` records none; every family
  (including `focus`), directive, function and documented runtime function
  has a live example.

Must stay byte-identical: the package.

## 6. Out of scope

- The strict check: MIG-B9-43.
- "Why UXDSL" (the owner's voice): MIG-B9-54.

## 7. Approach and traps

- P3's in-page compiler: the sandbox already bundles the engine; check
  whether `uxdsl/postcss` (PostCSS in the browser) is bundleable
  (`esbuild` with a browser target; PostCSS runs in browsers). Dart Sass's
  JS build also runs in browsers (`sass` ships a pure-JS bundle) but is
  large; the contract allows the plugin-only editor with a visible note.
- Diagnostics shown must be the real messages: never a hand-written copy of
  the catalog.
- Every demo is content for `DemoFrame`; adding a component for a demo is a
  regression of MIG-B9-41.
- Stop rule: a demo that needs a hand-written value (a pixel, a hex) is
  wrong by construction; find the token or stop.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `fixtures/playground-browser/walk.js` | the three new checks of P8 | Chrome | P3, P4, P6 | a planted wrong expected code is reported (negative control added to the controls list) |
| T2 | `scripts/capability-matrix.test.js` | no gap | docs | P9 | — |
| T3 | `packages/playground-nextjs/scripts/capture-examples.js --check` | the From-SCSS outputs are current and identical | docs | P6 | — |
| T4 | `fixtures/playground-browser/compare.js` | only intended differences (new content) | Chrome | all | — |

## 9. Acceptance criteria

- **AC1** `npm run verify:playground-browser` exits 0 with the new checks and
  their control.
- **AC2** `npm run generate:capabilities && node --test scripts/capability-matrix.test.js` exits 0.
- **AC3** `npm --prefix packages/playground-nextjs run test:examples` exits 0.
- **AC4** `/docs/from-scss` is in `DOCS_SECTIONS` and in the sitemap (the walk
  discovers it).

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:capabilities` | yes |
| playground captures and examples | yes |
| `AGENTS.md` documentation-sources list | yes |

## 11. Documentation

The site itself; `packages/playground-nextjs/README.md` (the demos and the
walk checks).

## 12. Verification

```bash
npm --prefix packages/playground-nextjs run build         # background; exit 0
npm run verify:playground-browser                         # background; exit 0 (Chrome)
npm run generate:capabilities && node --test scripts/capability-matrix.test.js   # exit 0
```

## 13. Delivery

Branch `feat/b9-42-principles-live`. Commit:
`feat(FEAT-010): MIG-B9-42 - the five principles demonstrated live; /docs/from-scss shows the superset`.

## 14. Closure record

To be filled in the delivering PR, including whether the in-page editor runs
`compile()` or the plugin alone.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- P4: `theme --diff` exists only inside the CLI (`diffThemeAgainstDefaults`, bin/uxdsl.js ~1127), so it cannot update live in the page: export it from `uxdsl/theme` or drop the third view.
