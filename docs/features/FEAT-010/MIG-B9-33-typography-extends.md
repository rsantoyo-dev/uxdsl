# MIG-B9-33 — Typography without inherited margins; `extends`

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | DEC-10 (recommended: `default` declares no margins; `"extends": "none"` opts out of `default`; `"extends": "<role>"` builds on a role) |
| Status | Blocked (DEC-10) |
| Size | S |
| Depends on | MIG-B9-13 |
| Blocks | MIG-B9-40 |
| Base | `feat/beta9` after MIG-B9-13 |
| Owns | `packages/uxdsl/test/typography-extends.test.js` (new) |
| Shares | `packages/uxdsl/src/typography.ts`, `src/theme/base.json`, `ds-runtime/theme-validate.ts`, `diagnostics.ts`, `scripts/generate-language-artifacts.js`, `fixtures/parity/expected/**`, `packages/uxdsl/CHANGELOG.md`, `AGENTS.md`, the playground's `.uxdsl` files that relied on zero margins |
| Output impact | **visual**: `@ds-typo(role)` no longer emits `margin-block-start/end: 0` for roles that did not declare margins |

## 1. Goal

A typography role emits what it declares. Spacing belongs to the component
and to Density, not to a text role's hidden `margin: 0`; a weight-only role is
one theme entry; a role can build on another.

## 2. Sources

- Press Craftor F‑9 and F‑13 (plan §8 2d and 3): "`@ds-typo` emits
  `margin-block`, cancelling a margin written before it (137 rules)";
  "Typography roles emit every field with `default` filling gaps; no
  weight-only change".
- `typography.ts` `resolveTypographyRole`: `role === 'default' ? { ...style } : { ...details.default, ...style }`;
  `compileTypographyRules` merges the same way for the variables.
- `theme/base.json` `typography_details.default`:
  `{ fontFamily, fontSize: "xs(space(5))", fontWeight: "400", lineHeight: "xs(1.6) md(1.7)", letterSpacing: "normal", marginBlockStart: "0", marginBlockEnd: "0" }`;
  roles with their own margins: `default`, `h1`.
- `validateTheme`: every leaf is a nonempty string; `null` is invalid, which
  is why the opt-out is the string `"none"`.
- `AGENTS.md` Typography: "Defaults supply missing fields. A role's own field
  replaces that default field as a whole"; "The directive emits at its own
  position in the rule, so a declaration written after it wins".
- `theme-structure.ts`: typography field sets are structural for `applyTheme`.

## 3. Preconditions

```bash
node -e "const t=require('./packages/uxdsl/src/theme/base.json');process.exit(t.typography_details.default.marginBlockStart==='0'?0:1)"
grep -q "compileSassStage" packages/uxdsl/src/compile.ts
```

## 4. Baseline

```bash
cd packages/uxdsl && node -e "const {compile}=require('./dist/entries/index.js');compile({source:'.t{margin:1rem;@ds-typo(p)}',from:process.cwd()+'/x.uxdsl'},{}).then(r=>console.log(r.css.slice(r.css.indexOf('.t{')||r.css.indexOf('.t {'))))"
```

Recorded: the rule contains `margin-block-start: var(--uxdsl__typography__p-margin-block-start)`
and `margin-block-end: …` after `margin: 1rem`, cancelling it.

## 5. Contract

- **Y1 — No margins in `default`.** `theme/base.json`'s
  `typography_details.default` has no `marginBlockStart`/`marginBlockEnd`;
  `h1` keeps its own two. A role that wants margins declares them.
- **Y2 — `extends`.** A role may carry `"extends"`: `"none"` means the role's
  own fields only (no `default` underneath); `"<role>"` means that role's
  effective fields underneath, then its own (chain allowed; a cycle or an
  unknown role is `UXD_TYPO_EXTENDS` at the key path). Without `extends`,
  behavior is unchanged (`default` underneath). `extends` is never emitted as
  a CSS property and is not in `TYPOGRAPHY_PROPERTIES`; `UXD_TYPO_FIELD`
  tolerates it; the JSON Schema is regenerated.
- **Y3 — Directive output.** `{ "strong": { "extends": "none", "fontWeight": "600" } }`
  makes `@ds-typo(strong)` emit exactly one declaration,
  `font-weight: var(--uxdsl__typography__strong-font-weight)`, and the
  generator exactly one variable for it.
- **Y4 — Structure.** A patch that adds or removes `extends` changes a role's
  field set and is refused by `applyTheme` as structural (existing behavior
  of field-set changes).
- **Y5 — The playground.** Every element whose zero margin came from `default`
  is checked in the visual comparison; where the zero margin was intended,
  the component declares `margin: 0` in its own `.uxdsl`; unintended
  differences are reported as findings. `typography-roles.uxdsl` (the
  `.ds-typo` selector rules) is reviewed first.
- **Y6 — Parity and contrast.** Parity oracles with a theme block change (two
  variables fewer per role); re-recorded with a reviewed diff. The contrast
  gate is unaffected.

Must stay byte-identical: every role's non-margin variables; `h1`'s margins.

## 6. Out of scope

- A `@ds-typo(caption strong)` modifier syntax (Press Craftor's proposal): not
  adopted; composing two roles stays two declarations or an `extends` role.
- Changing `h1`'s margins: an owner choice, noted in §15.

## 7. Approach and traps

- Implement `extends` in one resolver used by both `resolveTypographyRole`
  (the directive) and `compileTypographyRules` (the variables), so what the
  directive consumes is exactly what the generator defines (the existing
  invariant).
- `UXD_TYPO_BASE` (a responsive field without a base) still applies to
  inherited fields.
- The doc example in `AGENTS.md` (`h1` with `fontSize`, `fontWeight`,
  `lineHeight` over a `default` with family/weight/line-height) keeps
  compiling; add `strong` as a second example with its one-declaration output.
- Stop rule: if removing the margins breaks the walk's layout checks
  (overflow) on any route, stop and list the routes; do not restore the
  margins in `default`.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/typography-extends.test.js` | `MIG-B9-33: default declares no margins; @ds-typo(p) emits no margin; h1 keeps its two` | unit | Y1 | — |
| T2 | same | `MIG-B9-33: "extends": "none" emits the role's own fields only (strong → one declaration, one variable); "extends": "h2" builds on h2; a cycle and an unknown role are UXD_TYPO_EXTENDS` | unit | Y2, Y3 | a role without `extends` still gets `default`'s family |
| T3 | `test/theme-schema.test.js` | the schema accepts `extends` with `none` or a role name | unit | Y2 | — |
| T4 | `test/ds-runtime-theme-structure.test.js` | adding `extends` is structural | unit | Y4 | — |
| T5 | `test/base-theme-states.test.js` / `test/default-theme.test.js` | the base `default` keys are pinned (no margins) | unit | Y1 | — |
| T6 | `fixtures/parity/run.js` | re-recorded, reviewed | parity | Y6 | — |
| T7 | `fixtures/playground-browser/compare.js` | differences are the declared ones only | Chrome | Y5 | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/typography-extends.test.js packages/uxdsl/test/theme-schema.test.js` exits 0.
- **AC2** The baseline command prints a rule without `margin-block`.
- **AC3** `node fixtures/parity/run.js` exits 0 after a reviewed `--update`.
- **AC4** `npm test` exits 0; `npm run verify:playground-browser` exits 0 and
  the compare report's differences are listed in the PR as intended.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:language` | yes (schema) |
| `AGENTS.md` + agent guide | yes (Typography: `extends`, margins) |
| CHANGELOG | yes (`### Visual changes`) |
| `migration.md` | yes |
| package README | yes |
| `DIAGNOSTIC_CATALOG` | yes (`UXD_TYPO_EXTENDS`) |
| playground `uxdsl:build` + captures | yes |
| contrast baseline | no |

## 11. Documentation

`AGENTS.md` (Typography), `packages/uxdsl/README.md`, `packages/uxdsl/CHANGELOG.md`,
`packages/uxdsl/docs/migration.md`, the playground's `/docs/typography` page
(`TypographyDocumentation.tsx`).

## 12. Verification

```bash
node --test packages/uxdsl/test/typography-extends.test.js packages/uxdsl/test/theme-schema.test.js   # exit 0
npm run generate:language && node scripts/generate-language-artifacts.js --check                       # exit 0
node fixtures/parity/run.js                                                                            # exit 0
npm test                                                                                               # background; exit 0
npm run verify:playground-browser                                                                      # background; exit 0 (Chrome)
```

## 13. Delivery

Branch `feat/b9-33-typography-extends`. Commit:
`feat(FEAT-010): MIG-B9-33 - typography roles emit no inherited margins; "extends" opts out of default or builds on a role`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

- For the owner: whether `h1` should keep its own margins (MUI's `h1` has
  none unless `gutterBottom`).
