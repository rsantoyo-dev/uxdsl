# MIG-B9-11 — `src/sass/protect.ts`: protect and restore

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 1 |
| Decision gate | DEC-01 (decided) |
| Status | Ready |
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

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **Blocking — R1 protects too little.** R1 protects only keys that contain a dot; Dart Sass evaluates every other argument: `space(10-2)` becomes `space(8)` (a silently wrong token that exists in the base theme), `space(0-5)` becomes `space(-5)`, a key such as `2-inset` becomes `2 -inset`. K1/K2 cannot pass. Protect every UXDSL token call (`space density radius border shadow palette color`) whose first argument is key-like, and define `$v` and `#{…}` arguments explicitly; exempt only native `color(<color-space> …)` and `color(from …)`. R7 (identity on Bootstrap) still holds.
- **`color()` in Dart Sass ≥ 1.79.** Sass now parses `color()` as the CSS Color 4 function, so `color(white)`, `color(black, 0.5)` (NC5, NC6 and R1's own exemption list) are probably errors or misparsed. Verify against the pinned `sass` version and add them to the case list.
- `UXD_RESERVED_NAME` is produced here but catalogued in MIG-B9-12, so `test/diagnostics-catalog.test.js` fails this story's AC5. Add the catalog entry in this story.
- §5.3 (accept a space between a directive name and its parenthesis) and R9 (restore the spacing Sass changes) are redundant, and §5.3 contradicts AGENTS.md ("the parentheses directly after the name"). Keep R9, drop §5.3.
- **R4 needs an owner decision (DEC-17, open).** Reserving `@function color/space/shadow/…` and breakpoint-named mixins makes common SCSS fail after the rename, against DEC-00 ("a person renames .scss to .uxdsl and it works"); and a `.scss` dependency pulled in by `@import` is not scanned, so it can still shadow `color(white)` silently.
