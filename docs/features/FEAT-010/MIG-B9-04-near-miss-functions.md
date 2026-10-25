# MIG-B9-04 — Near-miss function names are errors

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 0 |
| Decision gate | DEC-02 (decided 2026-10-23: `space()` stays; `spacing()` and every near-miss is an error with a suggestion) |
| Status | In review (PR #44) |
| Size | S |
| Depends on | — |
| Blocks | — (MIG-B9-10 cites the code once it exists; it does not wait for it — review 2026-10-11) |
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

- **Base:** `feat/beta9` at `def145e`. **PR:** #44. **Commits:** `6d42162`
  (the test alone, with the README paragraph the docs guard asks for),
  `e24d8f6` (the change), then the closure record.
- **Environment:** macOS (Darwin 27.0.0), Node 20.19.0, npm 11.19.0, Chrome at the
  macOS default path; the worktree prepared as CI does (`npm ci --ignore-scripts`
  at the root and in `uxdsl`, `uxdsl-vscode`, `playground-nextjs`; `npm install`
  in `fixtures/mig02-nextjs-cssmodules`; `npm --prefix packages/uxdsl run build`;
  `node fixtures/mig07-consumer/run.js` — all exit 0). The pre-commit hook ran
  on both commits (docs guard and playground build).
- **Preconditions (§3):** the four lines exit 0 on `def145e`.
- **Baseline (§4):** on `def145e` the three inputs were echoed unchanged, as
  recorded. After `e24d8f6`:
  `x.uxdsl:1:12: UXD_FUNCTION_UNKNOWN: spacing() is not a function CSS or UXDSL knows; did you mean space()?`,
  `x.uxdsl:1:10: … palete() … did you mean palette()?`,
  `x.uxdsl:1:12: … densty() … did you mean density()?`.
- **Failing first (AC1):** `node --test packages/uxdsl/test/near-miss-functions.test.js`
  against the base build: T1 fails (`spacing(2)` compiles), T4 fails
  (`generateThemeCss` with `xs(spacing(2))` does not throw), T5 fails
  (`space(17)` gets no suggestion); T2 and T3, the negative controls, pass
  (2 pass, 3 fail). After the change: 5 pass, 0 fail.
- **Criteria → evidence:**

  | Criterion | Command | Exit |
  | --- | --- | --- |
  | AC1 | `node --test packages/uxdsl/test/near-miss-functions.test.js` | 0 (5/5) |
  | AC2 | `node --test packages/uxdsl/test/diagnostics-catalog.test.js` (with `breakpoint-unknown`, `language`, `diagnostics-coverage`, `diagnostics-location`, `entries`: 113/113) | 0 |
  | AC3 | `node fixtures/parity/run.js` (8 cases, no `--update`) | 0 |
  | AC4 | `npm test` (1360 tests, 0 fail; 85 `# TODO` are MIG-B9-10's pre-declared cases, present on the base) | 0 |
  | AC4 | `npm --prefix packages/playground-nextjs run uxdsl:build` | 0 |
  | AC4 | `node packages/playground-nextjs/scripts/capture-capabilities.js` (adds the `UXD_FUNCTION_UNKNOWN` capture; the `shadow(9)`/`radius(12)` captures now carry C5's `Did you mean "5"?`) | 0 |
  | §10 | `npm run generate:capabilities`; `node --test scripts/capability-matrix.test.js` (7/7; the matrix file is unchanged — the one Diagnostics capability stays live) | 0 |
  | §10 | `npm run generate:language`; `node scripts/generate-language-artifacts.js --check` (no artifact changed: the catalog does not feed the completions) | 0 |
  | §10 | `npm run generate:agent-guide`; `node scripts/generate-agent-guide.js --check` | 0 |
  | §12 | `npm run verify:doc-examples` (49 examples, 24 excerpts, 101 files; the README's `UXD_FUNCTION_UNKNOWN` example among them) | 0 |
  | §2 | `npm run verify:1.0` | 0 (the automated gate; its manual, external and postpublish items remain owner steps, as it prints) |
  | §2 | `npm run verify:playground-browser` | 0 (real Chrome: no console errors, no UXDSL warnings, no unresolved `var()`, visible keyboard focus) |

- **Controls:** T2 (`log()`, `rem()`, `mod()`, `sign()`, `exp()`, `calc()`,
  `color-mix()`, `-webkit-foo()`, `-moz-spcae()`, `shape()`, `counter()`,
  `circle()`, `ray()`, `inset()`, `image()` byte-identical through the plugin
  and `compile()`; `xxl()` with `breakpoints: { xxl: 1536 }` compiles alone,
  next to `xs()`, and in a Density value); T3 (`foo(1)`, `myfn(1px, 2px)`,
  `notAFunction(1)` untouched); in T1, `xd(1rem)` stays `UXD_BREAKPOINT_UNKNOWN`
  and the canonical spellings compile; in T5, a planted shade list without 340
  offers `300`, with 345 offers `345`, and `50` (one edit from `350`) is never
  offered. `test/breakpoint-unknown.test.js`'s positive control now samples
  every function added to `KNOWN_CSS_FUNCTIONS`. Stop rule: a scan of every
  function name in the playground's sources, the package docs, the fixtures
  and the architecture docs through `unknownFunctionMessage` flagged no real
  CSS function — only the README's own near-miss examples, the documented
  top-level `xxl()` (left to the breakpoint check) and names from selectors
  and prose (`:is(`, `m(`, `ds(`), which are not declaration values.
- **Decisions taken inside the contract:** the distance is one edit for names
  of up to five characters and two for longer ones (the review's precision
  under DEC-02; C1's "up to 4" would have made `shape()` depend on the list
  alone), *and* `KNOWN_CSS_FUNCTIONS` was audited against MDN's list. The
  effective breakpoint map inside the check is the theme's `breakpoints` over
  `DEFAULT_BREAKPOINTS`, exactly as the plugin and `validateTheme` build
  theirs; the plugin passes `c.bps`, the engines pass the theme object they
  already hand to `tokenValueToCss`. In `validateResponsiveExpression` a
  top-level near-miss is `UXD_FUNCTION_UNKNOWN` (as a removed spelling is
  `UXD_SYNTAX_REMOVED` there); a far name keeps `UXD_<FAMILY>_VALUE`. C5's
  Palette/Color suggestions come from `suggestKeys`/`didYouMean`
  (`diagnostics.ts`), used by `missingKeyMessage` and by `checkReference` in
  `plugin.ts`; a numeric variant is offered bare (`"340" or "400"`), the form
  the existing `"main"` suggestion uses.
- **Not run as PASS:** the Bootstrap corpus (`node fixtures/sass-corpus/run.js`):
  without `--sass` it stops at "No Dart Sass found" (see §15); with
  `--sass packages/playground-nextjs/node_modules/sass` it renames 92 files,
  runs Dart Sass 1.94.2 (273,591 bytes) and stops before any comparison —
  `compile() failed: postcss-import: … bootstrap.uxdsl:1:1: Failed to find
  'mixins/banner'` — exit 1, the expected state of this base until MIG-B9-13.
- **Owner steps pending:** merge of the PR into `feat/beta9` by the agent once
  CI is green (README §6); nothing for the owner beyond the wave review.

## 15. Findings and follow-ups

### Delivery of 2026-10-24

- **`fixtures/sass-corpus/run.js` does not find the repository's own Dart Sass.**
  `loadSass` resolves `sass/package.json` with `require.resolve`, which
  `sass@1.94.2`'s `exports` map refuses (`ERR_PACKAGE_PATH_NOT_EXPORTED`), so
  the playground's copy is never found and the runner exits with "No Dart Sass
  found" even on a worktree prepared as CI does; `--sass <dir>` works. Proposed
  for MIG-B9-10 (the file's owner) or MIG-B9-13, which wires the corpus into the
  gate: resolve `sass` itself and read the `package.json` next to it. Not fixed
  here.
- **T4 also fails on the base**, besides T1 and T5 named by AC1: a theme value
  `xs(spacing(2))` was emitted as CSS, so `generateThemeCss` did not throw.
  Recorded as evidence, not a deviation.

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **Precedence with `UXD_BREAKPOINT_UNKNOWN`.** `rewriteTokens` runs before the unknown-function check (plugin.ts `expandResponsive`): a near-miss check inside `rewriteTokens` changes the code `xd(1px)` reports and breaks `test/breakpoint-unknown.test.js:41-44`. State the rule: a top-level name one edit from a breakpoint is `UXD_BREAKPOINT_UNKNOWN`; everything else near a token function is the new code.
- **False positive.** Distance 2 from `space` flags the real CSS function `shape()`, which is not in `KNOWN_CSS_FUNCTIONS`. Audit `KNOWN_CSS_FUNCTIONS` against the CSS function list in the same change, or use distance 1 for names of five letters or fewer; add `shape(…)` as a negative control.
- **Theme values.** C3 relies on `validateResponsiveExpression`, which checks only top-level functions (language.ts:59), so the owner's own `xs(spacing(2))` stays silent in a theme value. Put the near-miss check in `language.ts`, shared by `tokenValueToCss` and `rewriteTokens`.
- C5 names `missingKeyMessage`, but Palette/Color suggestions come from `closestKey` in plugin.ts; name the function that actually produces them.
- The header says this story blocks MIG-B9-10; it does not (README §5: 10 depends on 05). Removed from the order.

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-02, confirmed** with the review's precisions, which are now part of the contract: a real CSS function is never flagged (audit `KNOWN_CSS_FUNCTIONS` against the CSS function list, or use distance 1 for names of five letters or fewer; `shape(…)` is a negative control); a top-level name one edit from a breakpoint stays `UXD_BREAKPOINT_UNKNOWN`; the check lives in `language.ts`, shared by `tokenValueToCss` and `rewriteTokens`, so a theme value such as `xs(spacing(2))` fails the same way.
