# MIG-B9-32 — Custom roles start from their own Surface

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | DEC-09 (recommended: a custom Button or Input role inherits nothing; `extends` opts into another role) |
| Status | Blocked (DEC-09) |
| Size | S |
| Depends on | MIG-B9-34 (the global focus rule keeps every control focusable before roles lose the inherited ring) |
| Blocks | MIG-B9-40 |
| Base | `feat/beta9` after MIG-B9-34 |
| Owns | `packages/uxdsl/test/custom-roles.test.js` (new) |
| Shares | `packages/uxdsl/src/control-engine.ts`, `ds-runtime/theme-validate.ts`, `diagnostics.ts`, `scripts/generate-language-artifacts.js` (schema), `packages/uxdsl/CHANGELOG.md`, `AGENTS.md` |
| Output impact | **visual**: custom roles lose the states they did not declare |

## 1. Goal

A theme author who defines `buttons.checkout` gets exactly what they wrote:
its Surface and its states. Nothing arrives silently from `contained`; a role
that wants another role's behavior says `"extends": "contained"`.

## 2. Sources

- Press Craftor F‑11 (plan §8 2b): "Custom Button roles inherit `contained`'s
  `hover`/`selected` fill, padding and shadow" — 23 roles, every state
  spelled out to defeat the inheritance ("a custom role otherwise inherits
  the stock hover and selected colors (a dark fill), which none of these
  designs use", their `uxdsl.config.js`).
- `control-engine.ts` `getTokens`: `const fallback = (Object.hasOwnProperty.call(defaults, role) ? defaults[role] : defaults.contained);`
  then `states[key] = { ...fallback.states?.[key], ...fields(input.states?.[key]) }`
  and `base: { ...fallback.base, ...fields(input.base) }`; a role object may
  only have `surface`, `base`, `states` (`UXD_<FAMILY>_FIELD` otherwise).
- `AGENTS.md` Buttons: "Custom roles inherit contained defaults"; the
  `checkout` example declares `surface`, `base.padding` and three states.
- `theme-structure.ts`: a role's states set and per-state declaration set are
  structural (an `applyTheme` patch that changes them is refused).

## 3. Preconditions

```bash
grep -q "defaults.contained" packages/uxdsl/src/control-engine.ts
grep -q "focus" packages/uxdsl/src/ds-runtime/theme-validate.ts   # MIG-B9-34 merged
```

## 4. Baseline

```bash
cd packages/uxdsl && node -e "const {generateThemeCss}=require('./dist/entries/theme.js');const css=generateThemeCss({buttons:{checkout:{surface:'outlined',base:{padding:'density(3)'}}}});console.log(/--uxdsl__button__checkout-hover-bg/.test(css), /--uxdsl__button__checkout-disabled-opacity/.test(css))"
```

Recorded: `true true` — the custom role has hover and disabled variables it
never declared.

## 5. Contract

- **R1 — No implicit inheritance.** For a role not among the family's
  defaults, `getTokens` starts from
  `{ surface: input.surface ?? 'contained', base: {}, states: {} }`. Default
  roles (`contained`, `outlined`, `flat` for buttons; `contained`, `outlined`,
  `underline` for inputs) keep merging a partial override over their default.
- **R2 — `extends`.** A role object may carry `"extends": "<role>"` naming a
  default or theme role of the same family; the role then starts from that
  role's effective `surface`, `base` and `states` (resolved recursively) and
  its own fields merge on top. An unknown name or a cycle is
  `UXD_BUTTON_EXTENDS` / `UXD_INPUT_EXTENDS` (the control engine's naming
  pattern), located at the theme key path. `extends` is accepted next to
  `surface`, `base`, `states` by the engine and by `validateTheme`; the JSON
  Schema is regenerated.
- **R3 — Directive output.** `@ds-button(checkout)` for a role with no
  states emits its base declarations and no state rules; with
  `"extends": "contained"` it emits `contained`'s states filled by its own.
- **R4 — Structure.** `themeStructure` treats `extends` through its effect on
  states and surface (already structural); no new field in the signature.
- **R5 — Documentation and migration.** The CHANGELOG `### Visual changes`
  entry says which states a custom role used to receive (`hover`,
  `focusvisible`, `selected`, `disabled` for buttons; `focus`, `invalid`,
  `disabled` for inputs) and the one-line fix (`"extends": "contained"`).
  `AGENTS.md`'s Buttons and Inputs sections replace "Custom roles inherit
  contained defaults" with the `extends` rule.

Must stay byte-identical: the output of every default role; the output of a
custom role that declares every state (Press Craftor's).

## 6. Out of scope

- A `uxdsl doctor` check listing roles that relied on inheritance: MIG-B9-60
  (recorded in §15 for it).
- Surfaces: a custom Surface role already inherits `contained`'s fields by
  the documented rule ("custom roles inherit contained"); unchanged here and
  noted for the owner in §15.

## 7. Approach and traps

- `extends` must be resolved before `states` are merged and before the
  `surface` existence check; a role extending a role whose surface is missing
  reports the missing surface, not the extends.
- The focus ring: MIG-B9-34's global rule covers `button` elements; a custom
  role without `focusvisible` still shows a visible focus in the walk
  (`focus-invisible` control). Verify in Chrome through the playground walk
  after regenerating.
- Stop rule: if a default role's output changes, the merge order is wrong;
  revert.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/custom-roles.test.js` | `MIG-B9-32: a custom Button role gets no state it did not declare; a custom Input role the same` | unit (`generateThemeCss`, `buttonComponentCss`) | R1, R3 | `contained` keeps its four states (control) |
| T2 | same | `MIG-B9-32: "extends": "contained" brings its states and base; a two-level chain resolves; an unknown name and a cycle are UXD_BUTTON_EXTENDS / UXD_INPUT_EXTENDS at the key path` | unit | R2 | — |
| T3 | `test/theme-schema.test.js` | the schema accepts `extends` and rejects an unknown role key | unit | R2 | — |
| T4 | `test/ds-runtime-theme-structure.test.js` | adding `extends` to a role at run time is refused as structural when it changes states | unit | R4 | — |
| T5 | `fixtures/playground-browser/walk.js` | focus still visible on every button | Chrome | §7 | the `no-focus` control |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/custom-roles.test.js packages/uxdsl/test/theme-schema.test.js` exits 0.
- **AC2** The baseline command prints `false false`.
- **AC3** `npm test` exits 0; `npm run verify:playground-browser` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:language` | yes (schema) |
| `AGENTS.md` + agent guide | yes |
| CHANGELOG | yes (`### Visual changes`) |
| `migration.md` | yes |
| package README | yes |
| `DIAGNOSTIC_CATALOG` | yes (two codes) |
| playground captures | yes |

## 11. Documentation

`AGENTS.md` (Buttons, Inputs), `packages/uxdsl/README.md` (the Button/Input
sections and the doc example `checkout`, which keeps compiling),
`packages/uxdsl/CHANGELOG.md`, `packages/uxdsl/docs/migration.md`.

## 12. Verification

```bash
node --test packages/uxdsl/test/custom-roles.test.js packages/uxdsl/test/theme-schema.test.js   # exit 0
npm run generate:language && node scripts/generate-language-artifacts.js --check                   # exit 0
npm test                                                                                           # background; exit 0
npm run verify:playground-browser                                                                  # background; exit 0 (Chrome)
```

## 13. Delivery

Branch `feat/b9-32-custom-roles`. Commit:
`feat(FEAT-010): MIG-B9-32 - custom Button and Input roles inherit nothing; "extends" opts into another role`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

- For MIG-B9-60: a `doctor` check that lists custom roles whose output
  changed because of R1.
- For the owner: Surface custom roles still inherit `contained`'s fields by
  the documented rule; aligning them with R1 is a separate decision.

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- Three inheritance rules for one concept: typography inherits by default with `"extends": "none"`, Buttons/Inputs inherit nothing, Surfaces still inherit `contained`. Use one rule for all three — inherit by default, `"extends": "none" | "<role>"` — and reserve `none` as a role name.
- R1 silently removes hover from existing custom roles, and the detection tool (MIG-B9-60) ships later; R5 omits the Input base fields also lost (`caret`, `placeholder`). Recommended: defer to beta.10 or adopt the single rule above.
