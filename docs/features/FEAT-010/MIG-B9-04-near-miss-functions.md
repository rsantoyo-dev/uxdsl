# MIG-B9-04 — Near-miss function names are errors

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 0 |
| Decision gate | DEC-02 (recommended: `space()` stays the name; `spacing()` and every near-miss is an error with a suggestion) |
| Status | Blocked (DEC-02) |
| Size | S |
| Depends on | — |
| Blocks | MIG-B9-10 (the Sass matrix cites the code) |
| Base | `feat/beta9` |
| Owns | `packages/uxdsl/test/near-miss-functions.test.js` (new) |
| Shares | `packages/uxdsl/src/language.ts`, `packages/uxdsl/src/plugin.ts`, `packages/uxdsl/src/diagnostics.ts`, `packages/uxdsl/CHANGELOG.md`, `AGENTS.md` |
| Output impact | breaking for inputs that compiled silently to invalid CSS (none valid before) |

## 1. Goal

A misspelled UXDSL function never reaches the browser as an unknown CSS
function. `padding: spacing(2)` and `color: palete(primary.main)` fail where
they are written, naming the function the author meant.

## 2. Sources

- DEC-00: "`padding: xs(spacing(2))` y `padding: density(2)` que deben también
  ser leídas". The token function is `space()`; `spacing()` is the owner's
  own near-miss.
- Verified on `main` (2026-10-11), through `compile()` with `includeTheme: false`:
  `padding: spacing(2)` → `padding: spacing(2)` (silent); `color: palete(primary.main)`
  → silent; `padding: densty(2)` → silent; `rounded(2)` and `densities(2)` →
  `UXD_SYNTAX_REMOVED` (located).
- `packages/uxdsl/src/language.ts`: `KNOWN_CSS_FUNCTIONS` ("consulted before
  any edit-distance heuristic runs specifically so a real `log(...)` … is never
  misread as a typo of `lg(...)`"), `TOKEN_FUNCTIONS`, `REMOVED_FUNCTIONS`,
  `removedSyntaxMessage`. `packages/uxdsl/src/diagnostics.ts`: `editDistance`,
  `closestKey`, `missingKeyMessage` (which skips suggestions for numeric keys:
  `/^\d+$/.test(key) ? undefined : closestKey(key, available)`).
- Theme values are already strict: `validateResponsiveExpression` fails a
  "function that is neither a breakpoint nor a known CSS function"
  (`UXD_VALUE`). Author declarations are not.
- Plan §3.4: "Did you mean" for numeric keys should prefer the numerically
  nearest key (`color(gray.350)` suggests `gray.340`/`gray.300`, not `gray.50`).

## 3. Preconditions

```bash
grep -q "const REMOVED_FUNCTIONS" packages/uxdsl/src/language.ts
grep -q "export function missingKeyMessage" packages/uxdsl/src/diagnostics.ts
grep -q "UXD_SYNTAX_REMOVED" packages/uxdsl/src/diagnostics.ts
test ! -f packages/uxdsl/test/near-miss-functions.test.js
```

## 4. Baseline

```bash
cd packages/uxdsl && node -e "
const { compile } = require('./dist/entries/index.js');
(async () => { for (const s of ['.a{padding:spacing(2)}', '.a{color:palete(primary.main)}', '.a{padding:densty(2)}'])
  console.log(JSON.stringify((await compile({ source: s, from: process.cwd()+'/x.uxdsl' }, { includeTheme: false })).css)); })()"
```

Recorded: three lines echoing the input unchanged.

## 5. Contract

- **C1 — `UXD_FUNCTION_UNKNOWN`.** A function call in an author declaration
  whose lowercase name is (a) not in `KNOWN_CSS_FUNCTIONS`, (b) not a
  breakpoint of the effective theme, (c) not prefixed with `-` (vendor
  functions) and (d) within edit distance of a UXDSL name — a token function,
  `tone`, or a breakpoint name — fails with
  `UXD_FUNCTION_UNKNOWN: <name>() is not a function CSS or UXDSL knows; did you mean <suggestion>()?`,
  located at the declaration. Distance: 1 for names of up to 4 characters, 2
  otherwise; the suggestion is the closest UXDSL name. A name farther than that
  (`foo(1)`) is left untouched, as today: CSS keeps adding functions.
- **C2 — Explicit near-misses.** A table of spellings that are not typos of
  one letter but are what people write — `spacing` → `space`, `colour` →
  `color`, `pallete`/`palete`/`pallet` → `palette`, `radii` → `radius`,
  `borders` → `border`, `shadows` → `shadow`, `density`-plural `densities` is
  already `UXD_SYNTAX_REMOVED` — produces the same code and message as C1.
  The table lives next to `REMOVED_FUNCTIONS` in `language.ts`.
- **C3 — Both paths.** The rule runs in the plugin's token rewrite
  (`rewriteTokens` in `plugin.ts`) for author declarations. Theme values keep
  their existing `UXD_VALUE`/`UXD_<FAMILY>_VALUE` strictness; the near-miss
  message text is reused there so the suggestion appears in both places.
- **C4 — Case.** Names are case-insensitive (`SPACING(2)` is the same error).
- **C5 — Numeric suggestions.** `missingKeyMessage` suggests, for a numeric
  key, the nearest lower and higher numeric keys that exist
  (`space(17)` → "did you mean 16?"; `color(gray.350)` → "did you mean
  gray.340 or gray.400?" when both exist). Non-numeric keys keep `closestKey`.
- **C6 — Never flagged:** every name in `KNOWN_CSS_FUNCTIONS`; `log`, `rem`,
  `mod`, `sign`, `exp` (CSS math) next to `lg`, `md`, `sm`, `xs`, `xl`; any
  breakpoint name of the effective theme, including custom ones; `-webkit-*`;
  a Sass function the author used in a `.uxdsl` file (after MIG-B9-13, Sass
  evaluates it before the plugin sees the CSS; before that, the SCSS subset
  rejects it as `UXD_SCSS_UNSUPPORTED` — either way it never reaches this rule).

Must stay byte-identical: every output of the parity oracles and the
Bootstrap corpus (MIG-B9-10) — Bootstrap uses no near-miss names; prove it by
running the corpus after this change.

## 6. Out of scope

- Unknown at-rules: CSS has many legitimate ones (`@container`, `@layer`,
  `@scope`, `@starting-style`, `@property`, vendor rules); they stay untouched.
  Only breakpoint-named at-rules get a meaning (MIG-B9-30).
- Renaming `space()` to `spacing()`: DEC-02 keeps `space()`.

## 7. Approach and traps

- The check belongs where `removedSyntaxMessage` is consulted in
  `rewriteTokens`: first the removed table, then the near-miss table, then the
  distance rule, then the existing `TOKEN_FUNCTIONS` branch.
- `editDistance` already exists in `diagnostics.ts`; do not add another.
- The breakpoint names come from the compilation's effective theme
  (`c.bpNames`), not from `DEFAULT_BREAKPOINTS`: a project with a `xxl`
  breakpoint must not see `xxl(...)` flagged.
- Stop rule: if a real CSS function in use by the playground or the doc
  examples is flagged, add it to `KNOWN_CSS_FUNCTIONS` with a test, do not
  loosen the distance.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/near-miss-functions.test.js` | `MIG-B9-04: spacing(), palete(), densty() and SPACING() are UXD_FUNCTION_UNKNOWN with the right suggestion, located` | unit (`uxdsl/postcss` and `compile()`) | C1, C2, C4 | `space(2)`, `palette(primary.main)`, `density(2)` compile in the same test |
| T2 | same file | `MIG-B9-04 (negative control): log(), rem(), mod(), calc(), color-mix(), -webkit-foo() and a custom breakpoint xxl() are never flagged` | unit | C6 | — |
| T3 | same file | `MIG-B9-04: a far name such as foo(1) passes through untouched` | unit | C1 | — |
| T4 | same file | `MIG-B9-04: a theme value spelled spacing(2) fails with the suggestion in its message` | unit (`generateThemeCss`) | C3 | — |
| T5 | same file | `MIG-B9-04: numeric did-you-mean names the nearest keys (space(17) → 16; color(gray.350) → 340 or 400)` | unit | C5 | planted key list without 340: the suggestion changes accordingly |
| T6 | `test/diagnostics-catalog.test.js` | existing: every code produced is catalogued and asserted | unit | catalog | — |
| T7 | `fixtures/parity/run.js` | oracles unchanged | parity | byte-identity | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/near-miss-functions.test.js` exits 0;
  on the base (before the change) T1 and T5 fail.
- **AC2** `UXD_FUNCTION_UNKNOWN` is in `DIAGNOSTIC_CATALOG` with meaning, fix
  and owner `compiler`; `node --test packages/uxdsl/test/diagnostics-catalog.test.js`
  exits 0.
- **AC3** `node fixtures/parity/run.js` exits 0 without `--update`.
- **AC4** `npm test` exits 0; the playground builds
  (`npm --prefix packages/playground-nextjs run uxdsl:build` exit 0) and its
  diagnostics captures are regenerated.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:language` | yes (the catalog feeds the completions/docs) |
| `AGENTS.md` + agent guide | yes (the canonical grammar bullet: one spelling, near-misses fail) |
| CHANGELOG | yes (`### Removed`/`### Diagnostics`: inputs that were silently invalid now fail) |
| `migration.md` | yes (one line) |
| package README | yes ("The canonical grammar" section) |
| `verify-docs-update.js` classification | no (no new file) |
| `DIAGNOSTIC_CATALOG` | yes (`UXD_FUNCTION_UNKNOWN`) |
| `npm run generate:capabilities` | yes (a new code appears on `/docs/diagnostics`) |
| playground captures | yes |

## 11. Documentation

`packages/uxdsl/README.md` "The canonical grammar (token functions and
directives)": one paragraph and one error example with its
`/* UXD_FUNCTION_UNKNOWN: … */` comment (the doc-examples harness compiles
it and expects exactly that code). `AGENTS.md` "Build time, runtime and one
source of truth": the grammar paragraph. `packages/uxdsl/CHANGELOG.md`.

## 12. Verification

```bash
node --test packages/uxdsl/test/near-miss-functions.test.js   # exit 0
node --test packages/uxdsl/test/diagnostics-catalog.test.js   # exit 0
node fixtures/parity/run.js                                    # exit 0
npm run verify:doc-examples                                    # exit 0
npm test                                                       # background; exit 0
```

## 13. Delivery

Branch `feat/b9-04-near-miss-functions`. Commit:
`feat(FEAT-010): MIG-B9-04 - near-miss function names fail as UXD_FUNCTION_UNKNOWN with a suggestion; numeric did-you-mean`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

None yet.
