# MIG-B9-34 — The `focus` family and one `:focus-visible` rule

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | DEC-11 (decided 2026-10-23: a `focus` family and one generated `:where(…):focus-visible` rule) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-13 |
| Blocks | MIG-B9-32, MIG-B9-40, MIG-B9-62 |
| Base | `feat/beta9` after MIG-B9-13 |
| Owns | `packages/uxdsl/src/focus.ts` (new), `packages/uxdsl/test/focus.test.js` (new) |
| Shares | `packages/uxdsl/src/theme/base.json`, `ds-runtime/theme-validate.ts` (`KNOWN_THEME_FAMILIES`), `ds-runtime/theme-generator.ts`, `ds-runtime/contrast.ts`, `diagnostics.ts`, `scripts/generate-language-artifacts.js`, `scripts/verify-docs-update.js`, `fixtures/parity/expected/**`, `fixtures/release-1.0/run.js`, `packages/uxdsl/CHANGELOG.md`, `AGENTS.md` |
| Output impact | **visual** (additive): links, summaries and focusable elements gain the theme's focus ring; Button `focusvisible` reads the family |

## 1. Goal

One focus ring, defined once in the theme, applied to everything that takes
keyboard focus, overridable by any author rule because it has zero
specificity. Press Craftor's 66 copies of a focus ring become one theme entry.

## 2. Sources

- Press Craftor F‑14 and F‑3 (plan §8 item 4): "No focus primitive: only
  Buttons/Inputs carry focus; links, `summary`, tabs repeat a ring (66
  copies)". Plan recommendation: "A `focus` theme family … and a theme option
  that emits one `:where(a, button, summary, [tabindex]):focus-visible { … }`
  rule with the theme; Button/Input `focusvisible` states default to it. No
  `@ds-focus` directive in beta.9".
- `theme/base.json` `buttons.contained.states.focusvisible`:
  `{ "outline": "2px solid tone(main)", "outline-offset": "2px" }` (the same
  in `outlined` and `flat`); inputs have a `focus` state (border) and no
  `focusvisible`.
- `KNOWN_THEME_FAMILIES` (14 names); the JSON Schema is generated from the
  validator; `theme-structure.ts` lists what is structural; the generator
  `themeParts` orders imports, foundations, then one run per family.
- The browser walk checks visible keyboard focus at 390 and 1280 px and has a
  `no-focus` negative control (`fixtures/playground-browser/walk.js`).
- `tone()` is valid only in Button/Input values (`UXD_TONE_CONTEXT` elsewhere).

## 3. Preconditions

```bash
node -e "const f=require('./packages/uxdsl/src/theme/base.json').focus; process.exit(f===undefined?0:1)"
grep -q "'modes',$" packages/uxdsl/src/ds-runtime/theme-validate.ts || grep -q "'modes'" packages/uxdsl/src/ds-runtime/theme-validate.ts
grep -q "compileSassStage" packages/uxdsl/src/compile.ts
```

## 4. Baseline

```bash
cd packages/uxdsl && node -e "const {generateThemeCss}=require('./dist/entries/theme.js');const css=generateThemeCss();console.log(/:focus-visible/.test(css), /--uxdsl__focus__/.test(css))"
```

Recorded: `false false` — the theme CSS has no focus rule and no focus
variables (the Button states live in component CSS).

## 5. Contract

- **F1 — The family.** `focus` joins `KNOWN_THEME_FAMILIES`. Its closed field
  set is `outline` and `outline-offset` (`UXD_FOCUS_FIELD` otherwise, owner
  `theme`); values follow the one grammar (literals, token functions,
  responsive expressions over the theme's breakpoints); `tone()` is not valid
  in it (`UXD_TONE_CONTEXT`). The base theme sets
  `"focus": { "outline": "2px solid palette(primary.main)", "outline-offset": "2px" }`.
  Variables: `--uxdsl__focus__outline`, `--uxdsl__focus__outline-offset`,
  emitted on the theme's root scope like every family (responsive values
  produce `@media` blocks as elsewhere).
- **F2 — The rule.** The generator emits, right after the foundations and
  before the families, exactly one rule:
  `:where(a[href], button, summary, [tabindex]:not([tabindex="-1"])):focus-visible { outline: var(--uxdsl__focus__outline); outline-offset: var(--uxdsl__focus__outline-offset); }`.
  `:where` gives it zero specificity: any author rule for the element wins.
  Inputs, selects and textareas are **not** in the list: Input roles own
  their focus treatment through their `focus` state (border); a theme may
  reference the focus variables there.
- **F3 — Buttons read the family.** `theme/base.json`: every default Button
  role's `focusvisible` becomes
  `{ "outline": "var(--uxdsl__focus__outline)", "outline-offset": "var(--uxdsl__focus__outline-offset)" }`,
  so the ring is defined once. (The `tone(main)`-colored ring is dropped: one
  ring color, as MUI does; a theme that wants tone-colored rings writes
  `tone(main)` in its own Button states.)
- **F4 — Runtime.** Changing `focus.outline` through `applyTheme` applies
  live (it is a custom property); the rule itself is not structural.
- **F5 — Contrast.** `checkThemeContrast` adds the pair "focus outline color
  against `surface.main`" in both modes to its checked set; the base value
  passes (3:1 for a non-text indicator) or the story picks a value that does
  — no exception.
- **F6 — Chrome.** `fixtures/mig02-nextjs-cssmodules/browser.js` (or the
  scoped-palettes fixture page) focuses a link with the keyboard and asserts
  its computed `outline-color` equals the resolved `palette.primary.main` and
  `outline-width` is `2px`; a second assertion overrides the ring with an
  author rule of specificity (0,1,0) and sees the override win. The
  playground walk's focus check keeps passing; its `no-focus` control still
  fails as intended.
- **F7 — Capability.** The new family appears in the derived capability
  matrix and has a live example: the playground's theme override declares
  `focus` (a different offset) and `/docs/accessibility` shows the rule.

Must stay byte-identical: every family's variables other than Button
`focusvisible`; component CSS of Inputs.

## 6. Out of scope

- An `@ds-focus` directive (plan): not adopted.
- Per-tone focus rings in the base theme (F3 drops them on purpose).
- Inputs in the global rule (F2).

## 7. Approach and traps

- `src/focus.ts` owns: the field set, `compileFocusRules` (the two variables,
  responsive-aware through `responsiveBlocks`), `focusRule(theme)` (the one
  rule as a `CssBlock`), and is wired in `theme-generator.ts`'s `themeParts`.
  Classify it as a visual-default file.
- The reference pass must see the rule's `var()`s as consumers of the focus
  variables (it reads `blockDeclarations`), so a theme that deletes
  `focus.outline` fails with `UXD_REFERENCE_MISSING`, not silently.
- `theme-families-drift.test.js` scans source reads for family names: adding
  `focus` to the registry and reading `theme.focus` in `focus.ts` keeps it
  green.
- Stop rule: if the base focus color fails F5's contrast in dark mode, pick a
  passing color (a lighter primary variant or `palette.primary.light`) and
  record the choice; never add an exception.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/focus.test.js` | `MIG-B9-34: the focus family emits two variables and one :where(…):focus-visible rule after the foundations; an unknown field is UXD_FOCUS_FIELD; tone() is UXD_TONE_CONTEXT` | unit | F1, F2 | — |
| T2 | same | `MIG-B9-34: the base Button roles' focusvisible read the focus variables; Input roles are unchanged` | unit | F3 | — |
| T3 | `test/ds-runtime-apply-theme.test.js` | `MIG-B9-34: applyTheme({ focus: { outline: … } }) is not structural and updates the variable` | unit | F4 | moving a breakpoint is still refused (control) |
| T4 | `test/contrast.test.js`, `test/base-theme-contrast.test.js` | the focus pair is checked and passes in both modes | unit | F5 | a planted low-contrast focus color fails |
| T5 | `fixtures/mig02-nextjs-cssmodules/browser.js` | the computed outline and the override | Chrome | F6 | — |
| T6 | `fixtures/playground-browser/walk.js` | focus visible; `no-focus` control caught | Chrome | F6 | — |
| T7 | `test/theme-schema.test.js`, `test/theme-families-drift.test.js` | the family is in the schema and the registry | unit | F1 | — |
| T8 | `fixtures/parity/run.js` | re-recorded, reviewed | parity | F2, F3 | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/focus.test.js` exits 0; the
  baseline command prints `true true`.
- **AC2** `node --test packages/uxdsl/test/contrast.test.js packages/uxdsl/test/base-theme-contrast.test.js` exits 0.
- **AC3** `npm run verify:cssmodules-build` exits 0 in Chrome with the focus
  assertions; `npm run verify:playground-browser` exits 0.
- **AC4** `npm run generate:capabilities` leaves no recorded gap; `npm test`
  exits 0; `npm run verify:1.0` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:language` | yes (schema, completions) |
| `AGENTS.md` + agent guide | yes (a "Focus" subsection under Buttons/Inputs; the responsibilities table gains a row) |
| CHANGELOG | yes (`### Added`, `### Visual changes`: Button ring color) |
| `migration.md` | yes |
| package README | yes |
| `verify-docs-update.js` classification | yes (`src/focus.ts` visual) |
| `DIAGNOSTIC_CATALOG` | yes (`UXD_FOCUS_FIELD`) |
| `npm run generate:capabilities` | yes |
| playground `uxdsl:build` + captures | yes |
| contrast baseline | yes (re-pin with `--write-contrast-baseline`; the diff is the review) |

## 11. Documentation

`AGENTS.md`, `packages/uxdsl/README.md`, `packages/uxdsl/CHANGELOG.md`,
`packages/uxdsl/docs/migration.md`, the playground's `/docs/accessibility` and
`/docs/buttons` pages.

## 12. Verification

```bash
node --test packages/uxdsl/test/focus.test.js packages/uxdsl/test/contrast.test.js packages/uxdsl/test/base-theme-contrast.test.js   # exit 0
npm run generate:language && node scripts/generate-language-artifacts.js --check   # exit 0
npm run verify:cssmodules-build                                                     # exit 0 (Chrome)
npm run generate:capabilities && node --test scripts/capability-matrix.test.js      # exit 0
npm test                                                                            # background; exit 0
npm run verify:1.0                                                                  # background; exit 0 (Chrome)
```

## 13. Delivery

Branch `feat/b9-34-focus`. Commit:
`feat(FEAT-010): MIG-B9-34 - the focus family and one :where(...):focus-visible rule; Buttons read it`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- Base Buttons would read `var(--uxdsl__focus__outline)`, a compiled name written by hand, which the one-grammar rule says a theme never contains. Drop `focusvisible` from the base Buttons (the global rule covers `button`) or add a token function.
- A project cannot switch the global rule off (closed field set; a deep merge cannot delete a base key): add an opt-out.
- The Goal says "everything" takes the ring, but the selector list excludes `select`, checkboxes, `area` and `contenteditable`: align them.
- If MIG-B9-31 lands first, the focus variables must use its `ROOT_SCOPE`; say so.

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-11, confirmed** with the review's conditions: a theme can switch the global rule off; the selector list covers every focusable element (links and areas with `href`, `button`, `input` including checkboxes, `select`, `textarea`, `summary`, `[tabindex]`, `[contenteditable]`).
- **Buttons and Inputs keep their own focus states** (the `tone(main)` ring; an Input's focus border), which win by specificity: the base theme writes no `var(--uxdsl__focus__…)` by hand, and the plan's "the base Button and Input states reference it" is dropped. A Chrome check pins that a control styled by `@ds-button` or `@ds-input` looks focused exactly as it does today, and that an unstyled link, `summary` and `[tabindex]` element shows the theme's ring.
- If MIG-B9-31 lands first, the focus variables use its scope selector.
