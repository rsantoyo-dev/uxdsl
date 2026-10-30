# MIG-B9-11 — `src/sass/protect.ts`: protect and restore

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 1 |
| Decision gate | DEC-01 (decided); DEC-17 (decided 2026-10-23: the author's SCSS wins, with a warning) |
| Status | In review (PR #49) |
| Size | M |
| Depends on | MIG-B9-10 |
| Blocks | MIG-B9-12 |
| Base | `feat/beta9` after MIG-B9-10 |
| Owns | `packages/uxdsl/src/sass/protect.ts` (new), the unit section of `packages/uxdsl/test/core/protect.test.js` |
| Shares | `packages/uxdsl/src/directives.ts` (the optional whitespace before `(`), `scripts/verify-docs-update.js` (classification of the new file), `packages/uxdsl/CHANGELOG.md` |
| Output impact | none until MIG-B9-13 uses it; the directive grammar accepting a space is API-visible (documented in MIG-B9-15) |

## 1. Goal

A single-pass tokenizer that lets UXDSL's syntax pass through Dart Sass
unchanged — dotted token keys, `$var` inside directive arguments — while
touching nothing else, preserving line numbers and recording how columns
moved, plus the one-line restore that undoes the spacing Sass adds to
`@ds-x (…)`.

## 2. Sources

- The regex prototype (`docs/audits/2026-10-09-sass-layer/run.js`) got 21 of
  the 63 cases wrong (strings, comments, interpolation, uppercase, keys with
  dashes, reserved names); the tokenizer prototype got 61 right (README §9).
- Verified Sass behaviors (2026-10-09, Dart Sass 1.94.2): Sass reads
  `palette(primary.main)` as a module member access and fails; it passes
  unknown functions through as plain CSS and **evaluates their arguments**
  (`md($g * 2)` → `md(32px)`); it writes an unknown at-rule with a space
  before its parenthesis (`@ds-surface (contained)`); `#{"text"}` interpolation
  emits `text` unquoted; `//` comments are dropped; unknown at-rules nested in
  a rule bubble like `@media`.
- `packages/uxdsl/src/directives.ts`: `Write @${name}(${bare}), with the
  parentheses directly after the name.` — the grammar currently rejects the
  space Sass itself writes.

## 3. Preconditions

```bash
test -f packages/uxdsl/test/core/protect.cases.js
test ! -d packages/uxdsl/src/sass
grep -q "directly after the name" packages/uxdsl/src/directives.ts
node -p "require('./packages/uxdsl/package.json').devDependencies.sass"
```

## 4. Baseline

```bash
cd packages/uxdsl && node -e "
const postcss=require('postcss'), plugin=require('./dist/plugin.js');
postcss([plugin({includeTheme:false,theme:{}})]).process('.a { @ds-surface (contained); }',{from:'x.css'}).then(r=>console.log(r.css)).catch(e=>console.log(e.message.split('\n')[0]))"
```

Recorded: `UXD_SURFACE_ARGUMENT: Write @ds-surface(contained), with the parentheses directly after the name.`

## 5. Contract

### 5.1 Exports

```ts
// packages/uxdsl/src/sass/protect.ts
export interface ProtectProblem { code: 'UXD_RESERVED_NAME'; message: string; line: number; column: number } // 1-based
export interface ProtectResult {
  code: string;                                           // the text to hand to Sass
  toOriginalColumn(line0: number, column0: number): number; // 0-based in, 0-based out, same line
  problems: ProtectProblem[];
}
export const TOKEN_FUNCTION_NAMES: ReadonlySet<string>;     // from language.ts's TOKEN_FUNCTIONS, lowercase
export function protect(source: string, options: { reserved: Iterable<string> }): ProtectResult;
export const restoreDirectiveSpacing: PostCSS plugin;        // postcssPlugin: 'uxdsl/sass-restore'
```

### 5.2 Rules of `protect`

- **R1 — Token calls with a dotted key.** A call `name(args)` where `name`
  (case-insensitive) is a token function and the first argument contains a
  `.` is rewritten to `#{"name(key[, arg…])"}` where, inside `key`, `$v`
  becomes `#{$v}` and `ns.$v` becomes `#{ns.$v}`, and each further argument
  is kept as written when it is a bare number and wrapped in `#{…}`
  otherwise. Sass evaluates the interpolations and emits the call text
  unquoted, so nothing needs restoring. A call whose first argument has no
  dot (`space(2)`, `space($n)`, `palette(primary)`, `color(white)`,
  `radius(pill)`) is **not** rewritten: Sass passes it through and evaluates
  `$n`.
- **R2 — Directive arguments.** Inside the parentheses of `@ds-<name>(…)`
  (name case-insensitive; whitespace before `(` allowed; parameters may span
  lines), every `$var` and `ns.$var` outside `#{}`, strings and comments
  becomes `#{$var}` / `#{ns.$var}`. Everything else in the parameters is
  untouched.
- **R3 — Never inside:** block comments, line comments, strings (with `\`
  escapes and `#{}` inside them), and unquoted `url(…)`. A `(` or `)` inside
  any of those does not count for parenthesis matching.
- **R4 — Reserved names.** `@function <name>` where `<name>` (lowercase,
  `_` read as `-`) is a token function, `tone`, or one of `options.reserved`
  (the effective theme's breakpoint names, passed by the caller) records a
  problem `UXD_RESERVED_NAME: @function <name> would shadow UXDSL's <name>();
  rename the function.` at the function name's line and column. `@mixin`
  names are never reserved.
- **R5 — Lines preserved.** `code` has exactly as many lines as `source`; a
  rewrite that spans lines re-emits its newlines after the replacement.
- **R6 — Columns mapped.** `toOriginalColumn(line0, col0)` returns the column
  in `source` for a column in `code`: identical before the first rewrite on
  that line, shifted after it, and the rewrite's own start when inside it.
- **R7 — Identity otherwise.** For a source with no dotted token call, no
  `$var` inside a directive and no reserved `@function`, `code === source`.
  Every Sass-valid case of the matrix and every Bootstrap file satisfy this.
- **R8 — Single pass, linear.** One scan of the text; the 96 Bootstrap files
  (about 1 MB) protect in under 20 ms in total.
- **R9 — The restore.** `restoreDirectiveSpacing` is a PostCSS plugin whose
  `Once` sets `raws.afterName = ''` on every at-rule named `/^ds-/i`. It runs
  before the UXDSL plugin (both do their work in `Once`; plugin order decides).

### 5.3 The directive grammar accepts the space

`directives.ts` accepts optional whitespace between a directive's name and
its `(` in both paths (`.uxdsl` through `compile()`, `.css` through the
plugin). The `_ARGUMENT` codes stay for every other malformed form. The
"directly after the name" message is deleted.

Must stay byte-identical: every parity oracle (this story changes no compiled
output; the grammar change only accepts an input that failed).

## 6. Out of scope

- Calling Sass: MIG-B9-12.
- `url()` with unquoted token text (`url(img/color(gray.900).png)`) is a
  Sass error by Sass's own grammar; not worked around.

## 7. Approach and traps

- Start from the prototype's structure: skippers for comments, strings,
  interpolation and unquoted `url(`; `matchParen` that respects them; a
  top-level comma split; `tokenKey` that accepts identifier characters, dots,
  `#{…}` and `$var`/`ns.$var` and returns null for anything else (so
  `space(2 + 1)` is left to Sass).
- The identifier test for a function name must reject a preceding `.`, `#`,
  `$`, `%`, `@`, `&` or `\` so that `.palette(`-like selectors, `%placeholder`
  and `&__x` are never treated as calls (case O9).
- Case C3 (a block comment holding `@ds-surface(outlined $tone)`) failed in
  the prototype only because the harness collapsed whitespace inside the
  comment; the contract is "verbatim".
- `toOriginalColumn` is what MIG-B9-12 uses to fix Sass's source map and
  error spans; test it directly with multi-rewrite lines.
- Stop rule: if a case needs the tokenizer to understand Sass expressions
  (precedence, strings with operators), stop; the rule is "token-like keys
  only", everything else is Sass's.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/core/protect.test.js` (unit section, real tests) | `MIG-B9-11: protect rewrites a dotted token key, $var and ns.$var inside it, and extra arguments` | unit | R1 | `space(2)` and `palette(primary)` are returned unchanged |
| T2 | same | `MIG-B9-11: protect substitutes $var inside @ds-*(…), case-insensitively, across lines, not inside #{} strings or comments` | unit | R2, R3 | — |
| T3 | same | `MIG-B9-11: protect is the identity on every Sass-valid matrix case and on a 10 KB CSS sample` | unit | R7 | a source with `palette(x.y)` changes |
| T4 | same | `MIG-B9-11: @function space and @function md are UXD_RESERVED_NAME at their line and column; @mixin border is not` | unit | R4 | — |
| T5 | same | `MIG-B9-11: lines are preserved and toOriginalColumn maps before, inside and after two rewrites on one line` | unit | R5, R6 | — |
| T6 | same | `MIG-B9-11: protect → Dart Sass → restore → plugin gives the expected CSS for each of the 63 cases` (flipped from todo to real here, using `sass` directly, without compile()) | unit | the cases | the regex prototype's 21 failures are the control: the test documents three of them as inputs that must now pass |
| T7 | `test/canonical-grammar.test.js` | the directive test updated: `@ds-surface (contained)` compiles | unit | §5.3 | `@ds-surface(contained extra extra extra)` still fails |
| T8 | `test/core/protect.test.js` | `MIG-B9-11: protect handles the Bootstrap corpus in under 20 ms` (skipped when the corpus temp dir is absent; the fixture of MIG-B9-10 exposes a helper) | perf | R8 | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/core/protect.test.js` exits 0 with
  the unit tests and the 63 end-to-end cases passing (no todo left in it).
- **AC2** `node --test packages/uxdsl/test/canonical-grammar.test.js` exits 0.
- **AC3** `node fixtures/parity/run.js` exits 0 without `--update`.
- **AC4** `src/sass/protect.ts` is classified in `scripts/verify-docs-update.js`
  as a visual-default file (it changes compiled output once MIG-B9-13 uses it),
  and `node --test scripts/verify-docs-update.test.js` exits 0.
- **AC5** `npm test` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes (grammar: whitespace before a directive's `(` accepted) |
| package README | yes (one sentence in "The canonical grammar") |
| `verify-docs-update.js` classification | yes (`src/sass/protect.ts`) |
| `DIAGNOSTIC_CATALOG` | no (`UXD_RESERVED_NAME` is catalogued by MIG-B9-12, which throws it) |
| everything else | no |

## 11. Documentation

`packages/uxdsl/README.md` "The canonical grammar": one sentence. The rest is
MIG-B9-15.

## 12. Verification

```bash
node --test packages/uxdsl/test/core/protect.test.js       # exit 0
node --test packages/uxdsl/test/canonical-grammar.test.js  # exit 0
node fixtures/parity/run.js                                 # exit 0
node --test scripts/verify-docs-update.test.js              # exit 0
npm test                                                    # background; exit 0
```

## 13. Delivery

Branch `feat/b9-11-protect`. Commit:
`feat(FEAT-010): MIG-B9-11 - src/sass/protect.ts: the protect pass and the directive-spacing restore`.

## 14. Closure record

Delivered in one PR (#49), from `feat/b9-11-protect`, with the review of
2026-10-11 and the owner decisions of 2026-10-23 (§15) applied as they rule.

- **Base:** `feat/beta9` at `0b7d476` (wave 0 closed; MIG-B9-10 complete:
  `sass@^1.107.0`, the 110-case matrix, the 63 protect cases, the source-map
  fixture, the pipeline tests, the Bootstrap corpus runner).
- **Environment:** macOS (Darwin 27.0.0, Apple Silicon), Node 20.19.0, npm
  11.21.1, `sass` 1.107.0 (Dart Sass, the package's own copy), PostCSS 8,
  Google Chrome at the macOS default path. The worktree prepared exactly as
  `ci.yml` does (README §1.3): `npm ci` at the root and in the three packages,
  the cssmodules fixture's install, the package build and
  `fixtures/mig07-consumer/run.js` (`All checks passed`) — every step exit 0.
  Husky's hook directory (`.husky/_`) did not exist in the fresh worktree
  (`npm ci --ignore-scripts` skips `prepare`), so `npm run prepare` was run
  once; `git config core.hooksPath` is `.husky/_` and the pre-commit hook (the
  docs guard and the playground build) ran on every commit.
- **Preconditions** (§3): the four lines exit 0 on the base, as written.
- **Baseline** (§4): the recorded line is a prefix of what the base prints; the
  message continues with the usage:
  `uxdsl: …/x.css:1:6: UXD_SURFACE_ARGUMENT: Write @ds-surface(contained), with the parentheses directly after the name. Usage: @ds-surface(role [tone] [size] [radius(k)] [shadow(k)]).`
  Unchanged by this story (§5.3 is dropped, see below).
- **Failing test first.** `test/core/protect.test.js` (T1–T6, T8 and the
  restore test) was committed before the module (`test(FEAT-010): MIG-B9-11 - …
  (failing first)`); on the base it cannot load `dist/sass/protect.js`:
  `# Error: Cannot find module '../../dist/sass/protect.js'` — `tests 1, pass
  0, fail 1` (run on the full tree with `dist/sass` set aside, the same state
  as the base). Then the module was added and the same file reports 76 pass.
  The 63 case tests were `todo` on the base (MIG-B9-10 ran them through
  `compile()`); they are real tests here.
- **Contract as delivered, where it differs from §5 (the §15 blocks rule):**
  - **R1 (review):** every token-function call whose first argument is key-like
    is protected, not only dotted keys — `space(10-2)`, `space(0-5)`,
    `color(white)`, `color(black, 0.5)`, `radius($r)`, `palette(primary)`
    included. Verified against Dart Sass 1.107.0 before implementing:
    unprotected, `color(white)` fails with `$description: white is not a
    string.`, `color(black, 0.5)` with `Only 1 argument allowed, but 2 were
    passed.`, `space(10-2)` compiles to `space(8)` and `space(0-5)` to
    `space(-5)`; `color(display-p3 1 0 0)` and `color(from … / 0.5)` pass
    through (the latter serialized as `b/0.5`). Encoded in T1 and its negative
    control, and the cases NC5, NC6, K1, K2 pass. The exemptions are not a
    name list: a first argument that is not key-like (spaces, a nested call, a
    quoted string, an operator) is left to Sass, which covers `color(<space> …)`
    and `color(from …)` exactly.
  - **R4 → DEC-17:** `ProtectProblem.code` is `UXD_FUNCTION_SHADOWED` (a
    warning; `protect()` never throws). `@function <name>` with `<name>` a
    token function, `tone` or one of `options.reserved` (the caller passes the
    effective theme's breakpoint names) records the warning at the name's line
    and column, with the message
    `UXD_FUNCTION_SHADOWED: @function space (entry.uxdsl:2) replaces UXDSL's space() in this build; rename it to use the token`
    (`(line N)` when no `options.file` is given), and every call to that bare
    name later in the same text is left untouched so Dart Sass calls the
    author's function (T4: `.b { padding: 6px; }` from `@function space($k) {
    @return $k * 3px; }`). `_` and `-` are the same character, as for Sass
    (`@function x_large` shadows the breakpoint `x-large`). **Case:** Sass
    resolves functions by their exact name — verified: with `@function
    space($k) { @return 1 }`, `SPACE(2)` is emitted as `SPACE(2)` and `space(2)`
    as `1` — so the comparison is case-sensitive and `@function Space`
    shadows nothing (old R4 said "lowercase"; lowercasing would have left
    `palette(primary.main)` unprotected after a `@function Palette` Sass
    never calls). `@mixin`/`@include` names are never calls; a namespaced
    call (`helpers.space()`) is never protected. The API for MIG-B9-12's
    second pass: `options.unprotected: Iterable<string>` (names defined in
    other loaded files, calls to them left untouched) and
    `findShadowingFunctions(source, options): ProtectProblem[]` (the same scan
    over a file whose text is not rewritten, `.scss` included); a definition
    in the same file is handled in the one pass (a call before the definition
    is plain CSS to Sass whether protected or not — verified, and pinned by
    T4's negative control).
  - **§5.3 dropped (review):** `directives.ts` is untouched; "the parentheses
    directly after the name" stays (AGENTS.md's rule). R9 does the work: the
    restore plugin clears `raws.afterName` on every `/^ds-/i` at-rule. T7 and
    the §10 CHANGELOG/README "grammar" items fall away; the §8/§10 rows are
    left as written and this record says so. The header's "Output impact"
    note about the grammar is therefore moot: the output impact is none.
  - **`DIAGNOSTIC_CATALOG`:** `UXD_FUNCTION_SHADOWED` is catalogued in this
    story (owner `compiler`, meaning and fix), produced by `protect.ts` and
    asserted by `protect.test.js`, so `test/diagnostics-catalog.test.js`
    passes (§10 said "no"; the review said to add it here).
  - **`options.reserved` is optional** (the contract wrote it required): the
    built-in set is always the token functions plus `tone`; `reserved` adds
    the breakpoints.
- **Exports as implemented** (`packages/uxdsl/src/sass/protect.ts`, no public
  entry — MIG-B9-12 imports it): `TOKEN_FUNCTION_NAMES: ReadonlySet<string>`
  (from `language.ts`'s `TOKEN_FUNCTIONS`); `interface ProtectProblem { code:
  'UXD_FUNCTION_SHADOWED'; message; line; column; name }` (1-based);
  `interface ProtectOptions { reserved?; unprotected?; file? }`; `interface
  ProtectResult { code; toOriginalColumn(line0, column0); problems }`;
  `protect(source, options?)`; `findShadowingFunctions(source, options?)`;
  `restoreDirectiveSpacing` (PostCSS plugin object, `postcssPlugin:
  'uxdsl/sass-restore'`, `Once`).
- **T6, the 63 cases:** all 63 pass through protect → `sass.compileString`
  (expanded, silent logger) → `restoreDirectiveSpacing` → `uxdsl/postcss` on
  the built `dist`, against `THEME` merged over the base, compared with
  `flat()`. **One harness change, recorded:** `flat()` now also normalizes
  whitespace around `/` — Dart Sass serializes `color(from … r g b / 0.5)`
  and `rgb(from … / 50%)` as `b/0.5` and `b/50%` (verified on 1.107.0), so NC3
  and NC4 compared unequal on that character alone; the `sameAs` oracles are
  right and were not changed. No case expectation was re-recorded; every
  `verify:` note of MIG-B9-10 held (S4 `'say "space(2)"'`, C5 the loud
  comment dropped, N6 `if()` with a deprecation warning that the logger
  swallows, U3 `Expected digit.`, D4 `2.7182818285`, D7 the comment kept
  inside the parameters and accepted by the plugin, NC3/NC4 as above, NC5/NC6
  through protection). The regex prototype (its two expressions, verbatim
  from `docs/audits/2026-10-09-sass-layer/run.js`) is the encoded control: it
  fails C3 (interpolates `$x` inside a comment), K1 (`space(-5)`) and K5
  (`PALETTE(` uppercase), which the tokenizer passes.
- **R7, identity:** `code === source` and no problem on the 75 `sass`-group
  matrix cases, on the 47 KB theme CSS the plugin generates for `@uxdsl
  theme;`, and on all **92** `.scss` files of `bootstrap@5.3.8` (328,410
  bytes; none contains a token-like call — the expanded R1 did not break it).
- **R8, timing (T8):** 92 files in **2.1 ms** on the second pass, 3.3 ms on the
  first pass of the test process (in a fresh process the first pass is about
  12 ms, JIT warm-up; steady state 2 ms). T8 asserts `< 20 ms` on the second
  pass and prints both. It runs when `UXDSL_SASS_CORPUS` names a directory
  holding `node_modules/bootstrap` (or `bootstrap` resolves from the package),
  and is **skipped** otherwise — so it is skipped in CI, where no corpus is
  installed (recorded as a limit; the run above was local).
- **Commands** (every one ran locally):

  | Command | Exit | Output |
  | --- | --- | --- |
  | `node --test packages/uxdsl/test/core/protect.test.js` with `UXDSL_SASS_CORPUS` (AC1) | 0 | **76 tests, 76 pass, 0 fail, 0 todo** (63 cases, the control, T1–T5 with their negative controls, T8, the restore test) |
  | same, without the corpus | 0 | 76 tests, 75 pass, 1 skipped (T8, with the reason) |
  | `node --test packages/uxdsl/test/canonical-grammar.test.js` (AC2) | 0 | 36 pass |
  | `node fixtures/parity/run.js` (AC3) | 0 | `PASS: 8 parity case(s) — CLI, compile(), and the Vite/Webpack adapters agree, matching the committed oracle.` (no `--update`) |
  | `node --test scripts/verify-docs-update.test.js` (AC4) | 0 | 15 pass (`src/sass/protect.ts` is in `VISUAL_DEFAULT_FILES`) |
  | `node --test packages/uxdsl/test/diagnostics-catalog.test.js` | 0 | 7 pass |
  | `npm run verify:doc-examples` | 0 | 49 examples and 24 theme excerpts across 101 files |
  | `node scripts/generate-language-artifacts.js --check` | 0 | no drift (the catalog does not feed the artifacts) |
  | `node scripts/generate-agent-guide.js --check` | 0 | no drift (AGENTS.md untouched; its edits are MIG-B9-15's) |
  | `npm run generate:capabilities` | 0 | matrix unchanged (`UXD_*` codes are one derived row, already live) |
  | `npm test` (AC5), background with a log, `UXDSL_SASS_CORPUS` set | 0 | 1,410 `ok`, 0 failures outside `todo`, 133 `todo` (the matrix and pipeline cases MIG-B9-13 turns green; none of this story's) |
  | `npm run verify:1.0`, background with a log | 0 | `66/66 automated checks passed`; `AUDIT ok — 0 critical, 0 high, 0 moderate, 0 low`; `AUDIT-lock` 0 vulnerabilities; `N-03`, `N-04` (real webpack and Vite builds from the tarball), `contrast`, `B7-01` ok |
  | `npm run verify:playground-browser` (real Chrome, one run, after `verify:1.0`) | 0 | `PASS`: 380 pages loaded, 2,218 focusable elements checked, no console errors, no UXDSL warnings, no unresolved `var()`, visible keyboard focus, contrast page = Node; 1,532 hosting-only 404s exempted and listed; the planted negative controls caught |

- **Guards (§10):** `packages/uxdsl/CHANGELOG.md` gained an append-only
  subsection under `## 0.5.0-beta.9 — unreleased` (no output impact yet; the
  module and the new code); `packages/uxdsl/README.md` gained sentences in the
  paragraph that describes the pending pipeline and its tests (as MIG-B9-10
  did), not a grammar change; `scripts/verify-docs-update.js` classifies
  `src/sass/protect.ts` as a visual-default file; no capture was refreshed
  (the CLI prints nothing new: nothing emits `UXD_FUNCTION_SHADOWED` as a
  warning until MIG-B9-12, so the `/docs/diagnostics` page lists the code
  from `DIAGNOSTIC_CATALOG` with no captured example — see §15).
- **Not run / not PASS:** T8 in CI (skipped there, by design). The
  `UXD_FUNCTION_SHADOWED` warning is not yet emitted by any build (`result.warn`
  is MIG-B9-12's). No browser claim is made by this story beyond the standard
  playground walk.
- **Owner steps pending:** merge of the PR into `feat/beta9` by the agent once
  CI is green (README §6); the wave-1 review.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **Blocking — R1 protects too little.** R1 protects only keys that contain a dot; Dart Sass evaluates every other argument: `space(10-2)` becomes `space(8)` (a silently wrong token that exists in the base theme), `space(0-5)` becomes `space(-5)`, a key such as `2-inset` becomes `2 -inset`. K1/K2 cannot pass. Protect every UXDSL token call (`space density radius border shadow palette color`) whose first argument is key-like, and define `$v` and `#{…}` arguments explicitly; exempt only native `color(<color-space> …)` and `color(from …)`. R7 (identity on Bootstrap) still holds.
- **`color()` in Dart Sass ≥ 1.79.** Sass now parses `color()` as the CSS Color 4 function, so `color(white)`, `color(black, 0.5)` (NC5, NC6 and R1's own exemption list) are probably errors or misparsed. Verify against the pinned `sass` version and add them to the case list.
- `UXD_RESERVED_NAME` is produced here but catalogued in MIG-B9-12, so `test/diagnostics-catalog.test.js` fails this story's AC5. Add the catalog entry in this story.
- §5.3 (accept a space between a directive name and its parenthesis) and R9 (restore the spacing Sass changes) are redundant, and §5.3 contradicts AGENTS.md ("the parentheses directly after the name"). Keep R9, drop §5.3.
- **R4 needs an owner decision (DEC-17, open).** Reserving `@function color/space/shadow/…` and breakpoint-named mixins makes common SCSS fail after the rename, against DEC-00 ("a person renames .scss to .uxdsl and it works"); and a `.scss` dependency pulled in by `@import` is not scanned, so it can still shadow `color(white)` silently.

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-17: R4 is replaced.** `@function <name>`, where `<name>` is a token function, `tone` or a breakpoint, is not an error. Wherever Sass calls the author's function by its bare name (the same file, a file loaded with `@import`, `@use … as *`), `protect()` leaves those calls untouched so Dart Sass calls it, and the build emits one warning located at the definition: `UXD_FUNCTION_SHADOWED: @function <name> (<file>:<line>) replaces UXDSL's <name>() in this build; rename it to use the token`. Catalogue the code in this story. A call through a namespace (`helpers.space()`) is never protected and shadows nothing.
- **Every loaded file is checked, `.scss` included**, so no shadowing is silent (the review's finding on `.scss` partials). One way that needs no import resolver of its own: after Sass compiles, scan the entry and every file Sass loaded (`loadedUrls`) for such definitions; when one exists, compile once more with those names unprotected. The second pass runs only in projects that shadow; MIG-B9-12 owns the call.
- **T4 changes:** `@function space` and `@function md` produce Sass's output and `UXD_FUNCTION_SHADOWED` at their line and column; `@mixin border` produces nothing. `ProtectProblem` carries warnings, not errors. Mixins never conflict: UXDSL has no `@include`-able names, and DEC-07 adds no breakpoint at-rule.
- The review's blocking R1 finding (protect every token call whose first argument is key-like) still applies; a name the author defines is removed from that set for the build.

### Delivery of 2026-10-29

- **`color()` under Dart Sass ≥ 1.79 — confirmed.** On 1.107.0 `color(white)`
  is `$description: white is not a string.` and `color(black, 0.5)` is `Only 1
  argument allowed, but 2 were passed.`; both are now protected (NC5, NC6
  pass), and the review's exemption list is realized as "a first argument that
  is not key-like", which is exactly `color(<space> …)` and `color(from …)`.
  For MIG-B9-15: document that `color(white)` works in a `.uxdsl` file only
  because of this pass — a host that runs its own Sass on the file sees the
  Sass error.
- **Dart Sass serializes `/` in a relative color without spaces** (`r g b/0.5`).
  `protect.test.js`'s `flat()` normalizes it; MIG-B9-13's matrix comparison
  and the parity oracles should expect the same when a case holds a relative
  color (none of the 110 does today). Proposed for MIG-B9-13.
- **Bootstrap's file count is 92, not 96** (§2, R8 and FEAT-010 README §9 say
  96; MIG-B9-10 already recorded 92). The corpus is 328,410 bytes of `.scss`
  (du: 572 KB on disk), not "about 1 MB". The budget holds with margin either
  way. Proposed for MIG-B9-13, which wires the corpus into the gate, to
  correct the numbers in one place.
- **`fixtures/sass-corpus/run.js` exposes no helper** (§8 T8 says "the
  fixture of MIG-B9-10 exposes a helper"): it installs Bootstrap into a
  temporary directory and deletes it unless `--keep`. T8 therefore reads
  `UXDSL_SASS_CORPUS` (a directory holding `node_modules/bootstrap`, which
  `run.js --keep` prints) or a `bootstrap` resolvable from the package, and
  skips otherwise — in CI it is skipped. MIG-B9-13 could export the install
  step from `run.js` (or install Bootstrap as a devDependency of the test) so
  T8 and the corpus comparison run in CI. Proposed for MIG-B9-13.
- **For MIG-B9-12 — the unprotected-names API.** `protect(text, { reserved,
  unprotected, file })` handles a shadowing `@function` in the same text in
  its one pass (calls after the definition untouched, the warning located).
  For other files: after Sass compiles, run `findShadowingFunctions(source, {
  reserved, file })` over every `loadedUrls` entry (`.scss` included; it is
  the same scan, read-only), collect `problems[].name`, and when the set is
  non-empty re-run `protect` on the entry with `unprotected: names` and
  compile again; report every problem as a warning (`result.warn`, file +
  line + column from the problem). `toOriginalColumn(line0, column0)` is
  0-based both ways and per line; the restore plugin must precede
  `uxdsl/postcss` in the PostCSS plugin list.
- **`UXD_FUNCTION_SHADOWED` has no captured example on `/docs/diagnostics`**:
  the page renders the catalog (meaning and fix) for every code, and the
  captured examples come from `uxdsl build`, which cannot produce this code
  until `compile()` runs on Sass. MIG-B9-13 adds the capture case
  (`capture-capabilities.js`, as MIG-B9-04 did for `UXD_FUNCTION_UNKNOWN`)
  when the CLI can emit it.
- **`@include`/`@mixin`/`@function` names are skipped by the scanner** so
  `@include border(1px)` is never read as a token call (O4). A `@return` or
  `@if` expression is scanned like any other, so `@return space(#{$k})` inside
  a helper is protected and works (verified).
- **Sass function names are case-sensitive**, UXDSL's are not: after
  `@function space`, `SPACE(2)` is still UXDSL's token (Sass passes it
  through). Documented in the module; worth one line in MIG-B9-15.
