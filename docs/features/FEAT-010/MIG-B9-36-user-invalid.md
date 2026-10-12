# MIG-B9-36 — Inputs: `:user-invalid`

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | DEC-13 (recommended: the invalid state matches `:user-invalid` and `[aria-invalid="true"]`) |
| Status | Blocked (DEC-13) |
| Size | S |
| Depends on | MIG-B9-13 |
| Blocks | MIG-B9-40 |
| Base | `feat/beta9` after MIG-B9-13 |
| Owns | `packages/uxdsl/test/user-invalid.test.js` (new) |
| Shares | `packages/uxdsl/src/inputs.ts`, `fixtures/mig02-nextjs-cssmodules/browser.js`, `packages/uxdsl/CHANGELOG.md`, `AGENTS.md` |
| Output impact | **visual**: an empty required field is no longer red before the user touches it |

## 1. Goal

A required field shows its error after the user has interacted with it, not
on first paint. The generated Input CSS matches `:user-invalid` instead of
`:invalid`; `aria-invalid="true"` keeps styling immediately for
application-driven validation.

## 2. Sources

- Press Craftor F‑12 (plan §8 2c): "`@ds-input` styles native `:invalid`, so an
  empty required field is red before typing".
- `inputs.ts`: `INPUT_STATES.invalid = [':invalid', '[aria-invalid="true"]']`.
- `AGENTS.md` Inputs: "Native :invalid may match before interaction."
- Browser support for `:user-invalid`: Chrome 119, Edge 119, Firefox 88,
  Safari 16.5 (Baseline 2023). The compiled selector list contains both forms,
  so a browser without `:user-invalid` ignores that selector and still styles
  `[aria-invalid="true"]`.

## 3. Preconditions

```bash
grep -q "invalid: \[':invalid'" packages/uxdsl/src/inputs.ts
grep -q "compileSassStage" packages/uxdsl/src/compile.ts
```

## 4. Baseline

```bash
cd packages/uxdsl && node -e "const {inputComponentCss}=require('./dist/entries/engine.js');const {resolveTheme}=require('./dist/entries/theme.js');console.log(inputComponentCss(resolveTheme(),'.f').match(/\.f:[a-z-]*invalid[^{]*/g))"
```

Recorded: `[ '.f:invalid, .f[aria-invalid="true"] ' ]` (or equivalent).

## 5. Contract

- **V1** `INPUT_STATES.invalid` is `[':user-invalid', '[aria-invalid="true"]']`.
  Every generated Input rule for the `invalid` state uses that list; nothing
  else in the Input engine changes.
- **V2** Chrome: in `fixtures/mig02-nextjs-cssmodules/browser.js`, a
  `required` email input styled with `@ds-input(outlined)`: on first paint its
  computed `border-color` equals the role's base border color; after typing
  `x`, pressing Tab and blurring, it equals the resolved `palette.error.main`;
  a sibling with `aria-invalid="true"` has the error border on first paint.
- **V3** Documentation: `AGENTS.md` Inputs replaces "Native :invalid may match
  before interaction" with the `:user-invalid` rule and the support note;
  the CHANGELOG lists the visual change.

Must stay byte-identical: every Input variable; every non-invalid state rule.

## 6. Out of scope

- A theme option to opt back into `:invalid`: not offered; a project can add
  its own `:invalid` rule.

## 7. Approach and traps

- `theme-structure.ts` reads the states' names and declaration sets, not the
  selectors; the change is not structural for `applyTheme`.
- The walk's playground pages with inputs must not show red fields on load;
  the visual comparison lists the Input demo as an intended change.
- Stop rule: none specific.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/user-invalid.test.js` | `MIG-B9-36: the invalid state compiles to :user-invalid and [aria-invalid="true"], never :invalid` | unit | V1 | — |
| T2 | `test/inputs.test.js` | existing state tests updated | unit | V1 | — |
| T3 | `fixtures/mig02-nextjs-cssmodules/browser.js` | the three computed border colors | Chrome | V2 | the first-paint assertion is the control against `:invalid` |
| T4 | `fixtures/playground-browser/compare.js` | the Input demo difference is declared | Chrome | V3 | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/user-invalid.test.js packages/uxdsl/test/inputs.test.js` exits 0.
- **AC2** `npm run verify:cssmodules-build` exits 0 in Chrome with the new
  assertions.
- **AC3** `npm test` exits 0; `npm run verify:playground-browser` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `AGENTS.md` + agent guide | yes |
| CHANGELOG | yes (`### Visual changes`) |
| `migration.md` | yes (one line) |
| package README | yes |
| playground `uxdsl:build` + captures | yes |

## 11. Documentation

`AGENTS.md` (Inputs), `packages/uxdsl/README.md`, `packages/uxdsl/CHANGELOG.md`,
the playground's `/docs/inputs` page (`InputDocumentation.tsx`).

## 12. Verification

```bash
node --test packages/uxdsl/test/user-invalid.test.js packages/uxdsl/test/inputs.test.js   # exit 0
npm run verify:cssmodules-build                                                              # exit 0 (Chrome)
npm test                                                                                     # background; exit 0
npm run verify:playground-browser                                                            # background; exit 0 (Chrome)
```

## 13. Delivery

Branch `feat/b9-36-user-invalid`. Commit:
`feat(FEAT-010): MIG-B9-36 - the Input invalid state matches :user-invalid and [aria-invalid="true"]`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

None yet.
