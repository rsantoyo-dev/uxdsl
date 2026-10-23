# MIG-B9-31 — Scoped palettes reach every composite

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | DEC-08 (recommended: palette modes match any element; composites re-declared on `[data-theme]` and `[data-uxdsl-scope]`) |
| Status | Blocked (DEC-08) |
| Size | M |
| Depends on | MIG-B9-13 |
| Blocks | MIG-B9-40 |
| Base | `feat/beta9` after MIG-B9-13 |
| Owns | `fixtures/scoped-palettes/**` (new: a page and a Chrome check), `packages/uxdsl/test/scoped-palettes.test.js` (new) |
| Shares | `packages/uxdsl/src/foundations.ts`, `css-blocks.ts`, `reference-core.ts`, `reference-integrity.ts`, `typography.ts`, `control-engine.ts`, `edges.ts`, `shadows.ts`, `surfaces.ts`, `language.ts` (default selectors), `fixtures/parity/expected/**`, `fixtures/release-1.0/run.js`, `packages/uxdsl/CHANGELOG.md`, `AGENTS.md` |
| Output impact | **visual-neutral for unscoped pages; the theme CSS changes its selectors** (every parity oracle with a theme block changes) |

## 1. Goal

A palette scoped to an element — a dark section inside a light page, a brand
container, a light card inside a dark app — reaches every token built on it:
borders, shadows, surfaces, buttons, inputs. The author adds one attribute;
nothing else.

## 2. Sources

- Press Craftor's first finding (F‑16, plan §8 item 1): Border, Shadow,
  Surface, Button and Input variables are declared on `:root` as
  `var(--uxdsl__palette__…)` and resolve there once, so an element that
  overrides `--uxdsl__palette__*` keeps root colors in every preset; their
  workaround re-declares composites on `[style*="--uxdsl__palette__"]`
  (`postcss-uxdsl-source.cjs`).
- Plan §8.1: "Re-declare the composite custom properties wherever a palette
  is scoped … the same idea as `modes.dark`, which already re-declares palette
  values under another selector"; FEAT-010 §1 table, clause 3 (inspired by
  MUI's nested `ThemeProvider`).
- `foundations.ts` `foundationBlocks`: `{ selector: ':root', … }` for the
  base; dark palette under `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }`
  and `:root[data-theme='dark']`. `css-blocks.ts` `responsiveBlocks(rules, selector = ':root')`
  is the default selector of every composite family; `typography.ts` emits
  `fonts.families` on `:root`; each engine's `generateCss(theme, breakpoints, selector = ':root')`.
- `reference-core.ts`: contexts are bucketed by selector; a `:root` consumer
  reaches `:root`-prefixed scopes (`selector.startsWith(':root')`,
  `entry.context.selector === ':root'` in `resolve()`); `reference-integrity.ts`
  reads `let selector = ':root'`.
- CSS: a custom property's `var()` is substituted on the element that
  declares the property; re-declaring `--uxdsl__border__1: 1px solid var(--uxdsl__palette__…)`
  on an element makes the palette resolve there.

## 3. Preconditions

```bash
grep -q "selector: ':root', declarations: cssVars" packages/uxdsl/src/foundations.ts
grep -q "startsWith(':root')" packages/uxdsl/src/reference-core.ts
grep -q "compileSassStage" packages/uxdsl/src/compile.ts
```

## 4. Baseline

```bash
cd packages/uxdsl && node -e "const {generateThemeCss}=require('./dist/entries/theme.js');const css=generateThemeCss();console.log((css.match(/:root\[data-theme='dark'\]/g)||[]).length, (css.match(/\[data-uxdsl-scope\]/g)||[]).length, css.length)"
```

Recorded: `1 0 <bytes>` — the dark palette is root-only; no scope selector
exists.

## 5. Contract

- **S1 — Palette modes on any element.** `foundationBlocks` emits the base
  palette, colors and spacing on `:root, [data-theme='light']`; the dark
  palette on `[data-theme='dark']` (any element) and, unchanged, under
  `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }`.
  A `<section data-theme="dark">` in a light page gets the dark palette; a
  `<div data-theme="light">` in a dark page gets the light one.
- **S2 — Composites follow scopes.** Every composite block — typography
  variables and `fonts.families`, edges, shadows, surfaces, buttons, inputs,
  densities — is emitted on the selector list
  `:root, [data-theme], [data-uxdsl-scope]`, in the base block and inside
  every `@media` block. An element carrying `data-theme` or
  `data-uxdsl-scope` therefore recomputes every composite against the
  palette it sees (its own override or an inherited one).
- **S3 — One constant.** `css-blocks.ts` exports `ROOT_SCOPE`
  (`':root, [data-theme], [data-uxdsl-scope]'`) and `isRootScope(selector)`;
  every default selector of a generator and every `:root` comparison in
  `reference-core.ts`/`reference-integrity.ts` uses them, so the reference
  pass still treats the composites as root-scoped and the dark blocks as
  reachable from them. No other string `':root'` remains in `src` except
  inside `ROOT_SCOPE`'s definition and the foundation/mode selectors above.
- **S4 — Parity.** The plugin and `generateThemeCss` emit the same bytes
  (same generator); `applyTheme` applies the same CSS; `themeStructure` is
  unchanged (selectors are not structure); `checkThemeContrast` is unchanged.
- **S5 — Chrome.** `fixtures/scoped-palettes/index.html` built from a
  `.uxdsl` through the CLI, with: (a) a `@ds-surface(contained)` card inside
  `<section data-theme="dark">` whose computed background equals the dark
  `surface.main`; (b) inside `<div data-uxdsl-scope style="--uxdsl__palette__primary-main: #ff0000; --uxdsl__palette__primary-contrast: #ffffff">`,
  a `@ds-button(contained primary)` with computed background `rgb(255, 0, 0)`
  and a `@ds-surface(outlined primary)` with border color `rgb(255, 0, 0)`;
  (c) the same `div` **without** `data-uxdsl-scope`: the button keeps the
  root primary (the negative control, proving the attribute is the
  mechanism); (d) under `<html data-theme="dark">`, a `<div data-theme="light">`
  card has the light `surface.main`. `fixtures/scoped-palettes/browser.js`
  drives Chrome and asserts the four.
- **S6 — Size.** The theme CSS grows only by the selector-list bytes; the
  story records before/after sizes (expected under +2%).
- **S7 — Press Craftor.** Their composite workaround becomes deletable: the
  elements that carry inline `--uxdsl__palette__*` overrides get
  `data-uxdsl-scope`. The MIG-B9-03 procedure is repeated with the workaround
  removed and the attribute added; appended to the evidence file.
- **S8 — Documentation.** `AGENTS.md` "Colors and Palette" and the README
  describe `data-theme` on any element and `data-uxdsl-scope`; the
  limitation that a scope is an element attribute, not a selector list in the
  theme (plan §8.1's `scope` option was not adopted; one attribute is simpler
  and needs no configuration).

Must stay byte-identical: every compiled component rule (only the theme's
selectors change); `uxdsl theme` JSON output.

## 6. Out of scope

- A theme field listing scope selectors: not adopted (S8).
- Per-scope *values* in the theme JSON (`modes.brand`): generalized modes are
  outside the 1.0 contract.

## 7. Approach and traps

- Specificity: `[data-theme]` is (0,1,0) like `:root`; declarations on the
  element itself always beat inherited values, which is what makes S1(d)
  work. Verify in Chrome, not by reasoning.
- The `@media (prefers-color-scheme: dark)` block keeps `:root:not([data-theme='light'])`;
  a `[data-theme='light']` section under an OS-dark root gets the base block
  (S1) declared on itself and wins.
- `reference-core.ts`'s `rootScopedContexts` keyed on `startsWith(':root')`
  must become `isRootScope(selector) || selector.startsWith(':root')` so the
  mode blocks (which start with `:root` or are `[data-theme='dark']`) stay
  reachable; add the `[data-theme='dark']` selector to the root-reachable set
  explicitly.
- Parity oracles change for every case that emits the theme; re-record with
  `--update`, review that only selector lists changed (a diff that touches a
  value is a bug).
- Stop rule: if any computed color in S5 disagrees, stop; do not add
  `!important` or inline-style tricks.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/scoped-palettes.test.js` | `MIG-B9-31: the generated theme declares the base palette on :root and [data-theme='light'], the dark palette on [data-theme='dark'], and every composite on ROOT_SCOPE, inside media blocks too` | unit | S1, S2 | — |
| T2 | same | `MIG-B9-31: no generator or reference check compares against a bare ':root' string` (a source scan) | unit | S3 | a planted `':root'` default fails |
| T3 | `test/build-runtime-parity.test.js`, `test/theme-marker.test.js` | existing byte-identity | unit | S4 | — |
| T4 | `test/reference-integrity.test.js` | a dangling dark-mode reference is still caught; a composite's palette reference resolves | unit | S3 | — |
| T5 | `fixtures/scoped-palettes/browser.js` | the four computed-style assertions | Chrome | S5 | (c) is the control |
| T6 | `fixtures/parity/run.js` | re-recorded, selector-only diff | parity | S4 | — |
| T7 | `fixtures/release-1.0/run.js` | `S-5 | [tarball, Chrome] a scoped palette reaches a Surface, a Button and a border preset (fixtures/scoped-palettes)` | tarball | S5 | — |
| T8 | `fixtures/playground-browser/walk.js` | the site is unchanged (no `data-theme` below root today) | Chrome | S4 | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/scoped-palettes.test.js` exits 0.
- **AC2** `node fixtures/scoped-palettes/browser.js` exits 0 in real Chrome
  and prints the four computed colors.
- **AC3** `node fixtures/parity/run.js` exits 0 after a reviewed `--update`
  whose diff is selector lists only (stated in the PR).
- **AC4** `npm test` exits 0; `npm run verify:1.0` exits 0 with `S-5 ok`.
- **AC5** The MIG-B9-03 evidence file has the "scoped palettes" section with
  the workaround deleted and the project building.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `AGENTS.md` + agent guide | yes |
| CHANGELOG | yes (`### Visual changes`: none for unscoped pages; `### Added`: scopes) |
| `migration.md` | yes (Press Craftor-style workarounds) |
| package README | yes ("Dark mode and scopes") |
| `verify-docs-update.js` | no (no new source file) |
| `npm run generate:capabilities` | yes if a capability is derived from it |
| playground `uxdsl:build` + captures | yes |
| contrast baseline | no |

## 11. Documentation

`AGENTS.md` ("Colors and Palette"; "Build time, runtime …": modes),
`packages/uxdsl/README.md`, `packages/uxdsl/CHANGELOG.md`,
`packages/uxdsl/docs/migration.md`, the playground's `/docs/colors` page
(a live scoped example is MIG-B9-42's).

## 12. Verification

```bash
node --test packages/uxdsl/test/scoped-palettes.test.js   # exit 0
node fixtures/scoped-palettes/browser.js                    # exit 0 (Chrome)
node fixtures/parity/run.js                                 # exit 0
npm test                                                    # background; exit 0
npm run verify:1.0                                          # background; exit 0 (Chrome)
```

## 13. Delivery

Branch `feat/b9-31-scoped-palettes`. Commit:
`feat(FEAT-010): MIG-B9-31 - palette modes on any element; composites re-declared on [data-theme] and [data-uxdsl-scope]`.

## 14. Closure record

To be filled in the delivering PR, with the theme CSS sizes before and after.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- S1 lowers `:root[data-theme='dark']` (0,2,0) to `[data-theme='dark']` (0,1,0): an author's later `:root { --uxdsl__palette__… }` then wins in forced dark mode but still loses in OS dark mode (`:root:not(…)` is 0,2,0). Use `:root[data-theme='dark'], [data-theme='dark']` and flag the change.
- Re-declaring composites on every scope overrides an author's `:root` composite overrides inside each scoped subtree — the override path AGENTS.md documents. Test it and document the rule.
- `[data-theme='light']` also re-declares colors and spacing, because `foundationBlocks` emits one block (foundations.ts:63): re-declare only the palette for light, and only palette-dependent composites per scope.
- Measure style recalculation with many scoped elements; T2's scan for `':root'` must skip comments.
- Also edits `control-engine.ts` and `surfaces.ts` (missing from README §7).
