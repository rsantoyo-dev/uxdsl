# MIG-B9-13 — `compile()` on the new pipeline; the subset deleted

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 1 |
| Decision gate | DEC-01 (decided); DEC-05 (decided 2026-10-23: the PostCSS plugin alone compiles CSS plus UXDSL, without Sass) |
| Status | Merged (PR #63) |
| Size | M |
| Depends on | MIG-B9-12 |
| Blocks | MIG-B9-14, MIG-B9-20, MIG-B9-21, MIG-B9-30 to 36 |
| Base | `feat/beta9` after MIG-B9-12 |
| Owns | `packages/uxdsl/src/compile.ts`, `packages/uxdsl/src/scss-subset.ts` (deleted), `packages/uxdsl/test/core/scss-subset.test.js` and `scss-expansion.test.js` (deleted), `packages/uxdsl/test/vars-responsive.test.js` (deleted), `fixtures/parity/expected/**` |
| Shares | `packages/uxdsl/src/plugin.ts` (`resolveVariables` deleted; `UXD_SASS_CONTEXT`), `packages/uxdsl/src/diagnostics.ts`, `packages/uxdsl/package.json` (`postcss-import`, `postcss-scss` removed), `scripts/verify-docs-update.js`, `fixtures/release-1.0/run.js`, `packages/uxdsl/CHANGELOG.md`, `AGENTS.md` |
| Output impact | **breaking**: nesting is flattened by Sass; `$variables` in a `.css` file compiled by the plugin alone are errors; six codes retired; `@import "x.css"` is no longer inlined |

## 1. Goal

`compile()` is the four-stage pipeline of FEAT-010 §1: protect, Dart Sass,
restore, the UXDSL plugin. Everything UXDSL wrote to imitate Sass is deleted.
The tests of MIG-B9-10 turn green, Bootstrap compiles byte-identical, and a
diagnostic inside a Sass-heavy file points at the author's line and column.

## 2. Sources

- `packages/uxdsl/src/compile.ts` on `main`: `postcss-scss` syntax,
  `postcss-import` with `createImportResolver`, `checkImportCycles`
  (postcss-import does not detect cycles), `scssSubset()`,
  `sassLeftoverGuard()`, the plugin, then the `//` comment stripping
  (`result.root.walkComments`); `postcss-import`'s `dependency` messages feed
  `dependencies`.
- `packages/uxdsl/src/plugin.ts` `resolveVariables`: root-level `$var`
  substitution, `UXD_VARIABLE_CONTEXT`, `UXD_VARIABLE_UNDEFINED`.
- The catalog's `core` codes: `UXD_SCSS_UNSUPPORTED`, `UXD_NESTING_INVALID`,
  `UXD_IMPORT_CYCLE`, `UXD_INCLUDE_ARGUMENT` (owner `core`); compiler codes
  `UXD_VARIABLE_CONTEXT`, `UXD_VARIABLE_UNDEFINED`.
- `scripts/verify-docs-update.js` lists `compile.ts` and `scss-subset.ts` in
  `VISUAL_DEFAULT_FILES`.
- The release gate checks that pin today's import behavior: `N-02` (a missing
  `@import` fails), `UX-02` (`url(https://…)` and URL comments survive),
  `UX-16` (`$vars` in responsive values expand through `compile()`), `UX-20`
  (source maps external, inline and off are byte-identical CSS).
- Parity cases (`fixtures/parity/cases`): `comment-with-url`,
  `duplicate-import`, `import-cycle`, `line-comment`, `missing-import`,
  `nested-imports`, `url-unquoted`, `vars-responsive`.
- Measured (README §9): the Bootstrap pipeline is 385–502 ms against plain
  Sass 324–625 ms; the plugin on 273 KB of foreign CSS takes 68–154 ms.

## 3. Preconditions

```bash
test -f packages/uxdsl/src/sass/compile-sass.ts
grep -q "scssSubset()" packages/uxdsl/src/compile.ts
grep -q "function resolveVariables" packages/uxdsl/src/plugin.ts
grep -c "todo(" packages/uxdsl/test/core/sass-matrix.test.js | grep -qv "^0$"
```

## 4. Baseline

```bash
node fixtures/sass-corpus/run.js 2>&1 | tail -3      # exit 1: UXD_SCSS_UNSUPPORTED on @import/@use
cd packages/uxdsl && node -e "const {compile}=require('./dist/entries/index.js');compile({source:'.a{color:red;&__t{color:blue}}',from:process.cwd()+'/x.uxdsl'},{includeTheme:false}).then(r=>console.log(r.css)).catch(e=>console.log(e.message.split('\n')[0]))"
```

Recorded: the corpus fails; the nested rule is `UXD_NESTING_INVALID`.

## 5. Contract

- **P1 — The pipeline.** `compile()` reads the entry (or takes `source`),
  calls `compileSassStage` with the effective theme's breakpoint names as
  `reserved`, the `sass` options from `config.sass`, and `sourceMap` when a
  map is requested; then runs
  `postcss([restoreDirectiveSpacing, uxdslPlugin(opts)]).process(css, { from, to, map })`
  with PostCSS's default parser (`postcss-scss` is gone) and
  `map: { prev: stage.map, inline: false, annotation: false, sourcesContent }`
  when a map is requested.
- **P2 — Deleted.** `src/scss-subset.ts`; the dependencies `postcss-import`
  and `postcss-scss`; in `compile.ts`: `createImportResolver`,
  `resolveForCycleCheck`, `checkImportCycles`, the `//` comment stripping,
  `sassLeftoverGuard`; in `plugin.ts`: `resolveVariables` (DEC-05). A
  `$name:` declaration, or a `$name` word in a value, reaching the plugin is
  `UXD_SASS_CONTEXT: $name is Sass; the PostCSS plugin compiles CSS plus
  UXDSL. Name the file .uxdsl and compile it with uxdsl build or compile(),
  or remove the Sass.`, located.
- **P3 — Codes.** Retired from `DIAGNOSTIC_CATALOG`: `UXD_SCSS_UNSUPPORTED`,
  `UXD_NESTING_INVALID`, `UXD_IMPORT_CYCLE`, `UXD_INCLUDE_ARGUMENT`,
  `UXD_VARIABLE_CONTEXT`, `UXD_VARIABLE_UNDEFINED`. Added: `UXD_SASS_CONTEXT`
  (owner `compiler`). The catalog test's inventory is updated; the owner
  type `core` keeps `UXD_SASS`, `UXD_SASS_WARNING`, `UXD_RESERVED_NAME`.
- **P4 — Results.** `CompileResult.dependencies` is the stage's
  `loadedFiles` (entry first, absolute); `warnings` contains the Sass
  warnings (file, line, column) followed by the plugin's.
- **P5 — Locations.** A Sass error is reported as MIG-B9-12 E1 says. A UXDSL
  error thrown by the plugin on Sass's output is reported at the author's
  file, line and **column** (`heavy.uxdsl:18:66`): `compile()` corrects the
  column PostCSS derives from `map.prev` by one (PostCSS returns the map's
  0-based column where it prints 1-based ones), and only when the position
  came from the prev map. `error.showSourceCode()` frames show the original
  source (from `sourcesContent`).
- **P6 — Sass semantics.** Nesting is flattened and `&__x`/`&-x` concatenate;
  `@at-root`, maps, lists, math, string functions, `@extend`, `@function`,
  `@mixin`/`@include`/`@content`, `@each`/`@for`/`@while`/`@if`, `!default`,
  `!global`, `@use`/`@forward` with namespaces, module variables and
  built-in modules all behave as Dart Sass defines. `@import` of a `.uxdsl`
  works with the `import` deprecation reported as `UXD_SASS_WARNING`; the same
  file imported twice with `@import` is included twice (Sass semantics) and
  once with `@use`.
- **P7 — Plain CSS imports.** `@import "x.css"` (explicit `.css`) stays an
  `@import` in the output; `@use "./x"` of a `.css` file inlines it. Both are
  Sass's rules and are documented (MIG-B9-15).
- **P8 — In-memory source.** `compile({ source, from })` compiles `source`
  as if it were the file `from`, which need not exist; relative `@use`
  resolves from `dirname(from)`.
- **P9 — Source maps.** `sourceMap: false | 'inline' | 'external'` keep their
  contract; the three modes produce byte-identical CSS (gate `UX-20`); the
  final map's `sources` are relative to `to` (as before), with no `file:`
  URLs and no duplicate entries, and include every `.uxdsl` file that
  contributed a mapping; `sourcesContent` is the original text.
- **P10 — Performance.** On the Bootstrap corpus the median of three runs of
  the pipeline is at most 1.5× plain Dart Sass (`fixtures/sass-corpus/run.js`
  asserts it); the playground's `uxdsl build` wall time before and after is
  recorded in §14.
- **P11 — Unchanged in this story.** `includeTheme` and `@uxdsl theme;`
  behave as today through the new pipeline (MIG-B9-20 changes them later);
  the reference pass, directives and responsive expansion are untouched.
- **P12 — The file reads as a contract.** `compile.ts`'s header comment
  states the four stages and what each may change; the history comments are
  deleted.

Must stay byte-identical: every parity case whose source has no nesting, no
`$variable`, no `@import` of a `.css` file and no `//` comment (`url-unquoted`,
`comment-with-url`); every `.uxdsl` of the playground that uses only the
canonical grammar (the before/after diff of `src/app/uxdsl.css` is part of §14,
every hunk explained by flattening or by a deleted `//` comment).

## 6. Out of scope

- The CLI's error printing and `generate-entry` with `@use`: MIG-B9-14.
- `includeTheme` removal: MIG-B9-20.
- Deleting duplicated discovery and dead exports: MIG-B9-21.

## 7. Approach and traps

- Flip the todo tests of MIG-B9-10 to real tests in this story; delete
  `scss-subset.test.js`, `scss-expansion.test.js` and `vars-responsive.test.js`
  (their surviving intents are in the matrix and in `sass-pipeline.test.js`).
  `compile.test.js`: the cycle tests become "a @use loop is UXD_SASS"; the
  nonexistent import test becomes UXD_SASS naming the importing file and
  line; `url()` and block-comment tests stay; the `//` comment test now
  asserts Sass dropped it; the `$var` responsive test stays (through
  `compile()`, Sass substitutes, the plugin splits).
  `no-silent-output.test.js`: the standalone-plugin `$var` test becomes the
  `UXD_SASS_CONTEXT` test. `diagnostics-location.test.js`: "reached through
  $var expansion" becomes "reached through Sass".
- Parity oracles: run `node fixtures/parity/run.js --update`, then read the
  diff of `fixtures/parity/expected/**` and list every change in the PR body
  under the P6/P7 rule that explains it (flattened nesting, `//` dropped,
  `@import "x.css"` kept, Sass's expanded formatting). An unexplained hunk is
  a finding and blocks the story.
- The gate: `N-02` now expects `UXD_SASS`; `UX-16` still passes (through
  `compile()`); add `S-1` (the corpus from the tarball: `fixtures/sass-corpus/run.js`
  run against the installed package, byte-identical), `S-2` (the matrix
  equals live Dart Sass, `sass-matrix.test.js`'s T2 run from the repo), `S-3`
  (a Sass-heavy file's UXDSL error, through the CLI installed from the
  tarball, is printed at `heavy.uxdsl:18:66`).
- `verify-docs-update.js`: remove `scss-subset.ts`; `compile.ts` stays
  visual; `src/sass/*.ts` already classified by 11 and 12.
- Keep `postcss-value-parser`; it is the plugin's, not the subset's.
- Stop rule: a matrix case whose Sass output differs from the recorded
  literal means either Sass moved (re-record with T2's blessing) or the
  pipeline altered Sass's output (a bug): decide which with
  `fixtures/sass-corpus/run.js --keep` and the intermediate files, never by
  editing the expectation to match.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/core/sass-matrix.test.js` | the 110 cases, real | unit | P6 | T2 of MIG-B9-10 guards the literals |
| T2 | `test/core/protect.test.js` | the 63 end-to-end cases through `compile()` | unit | P1 | — |
| T3 | `test/core/sass-source-maps.test.js` | `heavy.uxdsl:18:66`, the partial, the Sass column, the final map | unit | P5, P9 | a build without `map.prev` reports Sass's output line (29): asserted as the control |
| T4 | `test/core/sass-pipeline.test.js` | every behavior test, real | unit | P6–P10 | — |
| T5 | `test/core/compile.test.js` | updated as §7 says | unit | P2, P4, P9 | — |
| T6 | `test/no-silent-output.test.js` | `MIG-B9-13: a $variable reaching the plugin alone is UXD_SASS_CONTEXT, located` | unit | P2 | the same source through `compile()` compiles |
| T7 | `test/diagnostics-catalog.test.js` | inventory updated | unit | P3 | — |
| T8 | `fixtures/parity/run.js` | re-recorded oracles, reviewed | parity | P6, P7 | — |
| T9 | `fixtures/sass-corpus/run.js` | byte-identical; mixed extras; timing ≤ 1.5× | fixture | P6, P10 | — |
| T10 | `fixtures/release-1.0/run.js` | `S-1`, `S-2`, `S-3` new; `N-02`, `UX-02`, `UX-16`, `UX-20` adapted | tarball | P1–P10 | — |
| T11 | `test/performance/reference-performance.test.js` | existing budget holds | perf | P10 | — |

## 9. Acceptance criteria

- **AC1** `node fixtures/sass-corpus/run.js` exits 0 and prints
  `byte-identical: true`, the timing ratio ≤ 1.5, the warning counts.
- **AC2** `node --test packages/uxdsl/test/core/*.test.js` exits 0 with zero
  todo tests left in the four files of MIG-B9-10.
- **AC3** `test ! -f packages/uxdsl/src/scss-subset.ts`;
  `node -e "require('./packages/uxdsl/package.json').dependencies['postcss-import'] && process.exit(1)"`
  exits 0; same for `postcss-scss`.
- **AC4** `node fixtures/parity/run.js` exits 0 after the reviewed
  `--update`; the PR body lists every oracle change with its rule.
- **AC5** `npm test` exits 0; `npm run verify:1.0 -- --skip-playground-walk`
  exits 0 with `S-1`, `S-2`, `S-3` ok.
- **AC6** `grep -c "MIG-B" packages/uxdsl/src/compile.ts` prints 0 (no history
  in the source).
- **AC7** The playground builds (`npm --prefix packages/playground-nextjs run uxdsl:build`
  exit 0) and the before/after diff of `src/app/uxdsl.css` is attached to the
  PR with every hunk explained.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:language` | yes (the catalog) |
| `AGENTS.md` + agent guide | yes (the SCSS paragraph; MIG-B9-15 completes it) |
| CHANGELOG | yes (`### Visual changes`: flattened nesting; `### Removed`: the subset, the codes, `postcss-import`/`postcss-scss`; `### Breaking`: `$var` in plugin-only files, `@import "x.css"` not inlined) |
| `migration.md` | yes (one section: "beta.9 — Sass inside compile()") |
| package README | yes |
| `verify-docs-update.js` classification | yes (remove `scss-subset.ts`) |
| `DIAGNOSTIC_CATALOG` | yes |
| `npm run generate:capabilities` | yes |
| playground `uxdsl:build` + captures | yes |
| `docs/architecture/unified-engine-audit.md` | yes ("Process flow and ownership": the Sass stage owns SCSS) |

## 11. Documentation

`packages/uxdsl/CHANGELOG.md`, `packages/uxdsl/docs/migration.md`,
`AGENTS.md` (the paragraph at "The SCSS subset `compile()` compiles …"),
`docs/architecture/unified-engine-audit.md`. The full user documentation is
MIG-B9-15.

## 12. Verification

```bash
node fixtures/sass-corpus/run.js                              # exit 0
node --test packages/uxdsl/test/core/*.test.js                 # exit 0
node fixtures/parity/run.js                                    # exit 0
npm test                                                       # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                   # background; exit 0
npm --prefix packages/playground-nextjs run uxdsl:build        # exit 0
```

## 13. Delivery

Branch `feat/b9-13-compile-on-sass`. Commit:
`feat(FEAT-010): MIG-B9-13 - compile() runs protect, Dart Sass, restore, UXDSL; the SCSS subset and postcss-import are deleted`.

## 14. Closure record

Delivered in one PR (#63), from `feat/b9-13-compile-on-sass`. Where they differ from §5, the §15 blocks rule: the review of 2026-10-11 and the owner decisions of 2026-10-23 (DEC-05, DEC-17). So do the follow-ups MIG-B9-12 left for this story (its §15, "Delivery of 2026-11-01").

Two documents were written before the code, and both stay with the run's evidence outside the repository:
- a scout report (2026-11-01): the "before" figures, 34 checked facts, 11 open questions;
- a design record (2026-11-01): decisions Q1–Q11 and X1, tests T1–T26, 15 owner flags, 13 stop conditions.

The decisions that change §5 are summarized below.

**AC1 is not met at delivery.** The timing ratio was over budget on three consecutive runs (design stop condition 3; owner flag 1 in §15). The story is in review for the owner's decision; the method, the baseline, the always-on stage map and the plugin were not changed to make the budget.

- **Base:** `feat/beta9` at `ed498e3` (MIG-B9-12 merged, PR #62). `origin/feat/beta9` was checked at the start of every session and before the PR, and had not moved, so there was no rebase. The head before this record is `b4227eb`, 19 commits:
  - `d708d85`: the switch (implementer I1);
  - `44daadd`, `77adc53`: the plugin's Sass rejection, the catalog and the `/docs/diagnostics` captures (I2);
  - `e08e428`, `cda8655`, `bcb1228`: the corpus budget, the release gate, the documentation (I3);
  - `dcb76ce` … `9e1f1a6`: 11 commits from the four review lenses' fixers;
  - `7e9fba5`, `b4227eb`: 2 commits from the re-review's fixer.
- **Environment:**
  - macOS (Darwin 27.0.0, Apple Silicon, 8 cores);
  - Node 20.19.0 and npm 11.21.1, CI's versions (never the machine's default Node 20.14 or npm 10.7);
  - `sass` 1.107.0; PostCSS 8.5.31 installed, and 8.5.32 as the tarball's peer in the gate;
  - Google Chrome 156.0.8078.74 at the macOS default path.

  The worktree was prepared as `ci.yml` does (README §1.3), and every step exited 0. `npm run prepare` installed husky's hooks, so the pre-commit hook (the docs guard and the full playground build) ran on every commit; none used `--no-verify` or `HUSKY=0`.

  The owner's dev servers ran throughout and were idle: story-radar's `next dev` and `uxdsl watch` on port 3000, the playground's `next dev` on 3001. The load average was 1.8 to 6.
- **Preconditions (§3):** the four lines exit 0 on the base. The scout ran them; `todo(` appeared at 2 call sites, which expand to 111 todos at run time.
- **Baseline (§4):**
  - The corpus line exits 1 as recorded, but its message is postcss-import's `Failed to find 'mixins/banner'`, not `UXD_SCSS_UNSUPPORTED`; §4 is stale (§15). `fixtures/sass-corpus/README.md` already recorded the postcss-import message.
  - The nested rule is `UXD_NESTING_INVALID`, as recorded.
  - Also on the base:
    - the core suite gave 433 tests: 299 pass, 1 skipped, 133 todo;
    - parity passed with 8 cases;
    - the playground's `uxdsl.css` was 338,844 bytes, sha256 `9f8c13e4…`.
- **Failing test first.** Every code change was written test first. These failures were run, and logged in the run's scratch evidence:
  - **I1,** the new and flipped tests run on `ed498e3`'s build: 299 tests, 186 pass, 112 fail, 1 skipped (exit 1). By file:
    - `sass-matrix` 61 of 119 fail: 58 cases, the tally, T12 and its control;
    - `protect` 1 of 81: T2;
    - `sass-pipeline` 17 of 18;
    - `sass-source-maps` 9 of 12;
    - `compile` 17 of 36;
    - `near-miss-functions` 3 of 5;
    - `preserve-untouched-declarations` 2 of 5;
    - `cli/error-location` 1 of 8;
    - `entries` 1 of 11.

    The controls that run the plugin alone passed on both sides, as designed.
  - **I2,** on `d708d85`:
    - `no-silent-output`, `diagnostics-location`, `diagnostics-catalog` and `compiler-structure` give 52 tests, 7 failing. T24 alone had 27 disagreements: 22 probes compiled silently and 5 threw `UXD_VARIABLE_UNDEFINED`.
    - T23 on `ed498e3`'s build reports 3:3 for 1:7, and its control 2:12 for 2:3.
    - `capture-capabilities.js --check` exited 1 until the two new captures were regenerated.
  - **I3:**
    - `fixtures/sass-corpus/run.test.js` against the unchanged runner: 4/4 fail.
    - The new gate verdicts against the base's output: S-3 got `heavy.uxdsl:1:1: UXD_SCSS_UNSUPPORTED`, and N-02 got postcss-import's `Failed to find` with no code.
    - S-1's command against the base exits 1 with `byte-identical: false`.
  - **The fixers:** each finding was reproduced by a test that fails on the build before its fix (the review list below gives each). Where the behavior was already right and only a test was missing, the gap was shown by mutating `dist` until the old suite still passed and the new test failed.
- **Contract as delivered, where it differs from §5:**
  - **"Must stay byte-identical"** now reads "equal to Dart Sass's output for the same source, with UXDSL's constructs then resolved" (the review). Sass formatting is its own hunk category (F) in the parity and playground diffs, and the CHANGELOG lists it.

    `url-unquoted` and `comment-with-url`, which §5 lists as byte-identical, lose their final newline: Dart Sass's API writes none, and like it, `compile()`'s CSS has no final newline.

    T12 shows that no stage alters Dart Sass's output: `compile()` equals live Dart Sass byte for byte on the 73 compiling "sass" matrix cases. Bootstrap 5.3.8 renamed to `.uxdsl` is byte-identical in the three `sourceMap` modes.
  - **P1, as built** (owner flag 2):
    - The stage is called with `sourceMap: true` on every build, as MIG-B9-12's delivery required, and the final map is written only on request.
    - PostCSS runs `postcss([restoreDirectiveSpacing, uxdslPlugin(…), dropAnnotations])` with `map: { prev: chainable(stage.map), inline: false, annotation: false, sourcesContent }`.
      - `dropAnnotations` removes a top-level comment whose text starts with `# sourceMappingURL=` in every mode (LM-2). Before, it was kept only when a map was written.
      - `chainable` (LM-3) hands PostCSS a copy of the stage map whose sources that do not start with `/` are written from `/`. It is identical on POSIX, and keeps a Windows path's author mappings when `to` is elsewhere (emulated only).
    - `reserved` holds the breakpoint names of the effective theme: `config.theme`, or the theme discovered from the working directory, by the plugin's own rule. The plugin still discovers by itself, so discovery runs twice until MIG-B9-21 K3.
    - `config.sass` accepts `silenceDeprecations` and `quietDeps` only. An unknown key or a wrong type is an error raised before any I/O.
  - **P2 and DEC-05** (owner flags 5–9):
    - `rejectSassSyntax` is one pass in the plugin, run right after option validation. It replaces `resolveVariables`.
    - The message names "uxdsl build, compile() or an adapter", as DEC-05 words it, rather than P2's "uxdsl build or compile()".
    - Every construct DEC-05 enumerates is detected, and more besides (flag 5). `@else` alone is not flagged.
    - `--x: $var`'s message is the "kept" message, `Sass keeps <construct> literally in <where>; write #{<construct>}`. It applies wherever Dart Sass keeps a `$variable` or a namespaced call as written; the CHANGELOG's Breaking entry lists those places.
    - The plugin cannot tell whether it runs inside `compile()`; the design rejected a plugin option for that. So detection and wording are the same on both paths, and through `compile()` only the kept places can reach it.
    - What PostCSS's own parser rejects first cannot be `UXD_SASS_CONTEXT` (CT-5, flag 7): `#{…}` in a selector, in a property name or bare in a value, and a `//` after a `;`.
    - Not detected, by design: global Sass functions (`darken()`), `url($x)` where Sass evaluates the call, and `#{…}` inside a string.
  - **P3 and DEC-17:**
    - retired: `UXD_SCSS_UNSUPPORTED`, `UXD_NESTING_INVALID`, `UXD_IMPORT_CYCLE` and `UXD_INCLUDE_ARGUMENT` (with their producers, in `d708d85`), then `UXD_VARIABLE_CONTEXT` and `UXD_VARIABLE_UNDEFINED` (`44daadd`);
    - added: `UXD_SASS_CONTEXT`, owner `compiler`;
    - moved: `UXD_FUNCTION_SHADOWED`, from `compiler` to `core`.

    `core` is exactly `UXD_SASS`, `UXD_SASS_WARNING` and `UXD_FUNCTION_SHADOWED`, and `UXD_RESERVED_NAME` does not exist. The catalog goes from 111 codes to 106 (theme 59, compiler 38, runtime 6, core 3). There is no explicit inventory to update: the catalog test's derived scans enforce it.
  - **P4:**
    - `dependencies` is the stage's `loadedFiles` (absolute; the entry first, then Sass's load order, each once), then the theme files the plugin discovered. `compile({ source, from })` lists `from` first even when it does not exist; MIG-B6-18 expected `[]` (flag 12).
    - `warnings` lists the stage's (Sass's own order and cap, then `UXD_FUNCTION_SHADOWED`), then the plugin's, each relocated to the author's file, line and column (the review and DEC-05).
    - A warning with no position is `{ text }`, and an unmapped one is `{ text, file: entry }`.
  - **P5,** the review's `originalPositionFor`, not a fixed +1:
    - **The lookup.** `compile()` relocates every plugin diagnostic from PostCSS's generated position (`error.input`), with `originalPositionFor({ line, column: column - 1 })` on the stage map. The result is the same on every PostCSS of `^8.4.31`; T14 stubs 8.4.31's prev-map arithmetic and still reads 18:66.
    - **Precision** is the author position of the nearest mapping Dart Sass emitted at or before the diagnostic (flag 11): the start of the declaration or at-rule (`heavy.uxdsl:18:66` is `inset`'s start, with `space(404)` at column 73), or, for a value Sass copied, where it was written (a `$variable`'s definition `1:7`, an `@include` argument `4:17`).
    - **The error's other fields.** `endLine`/`endColumn` equal the start, so PostCSS frames a line over 160 characters. `error.source` is the author's text. `error.input` keeps PostCSS's own position in Dart Sass's output.
    - **What else is relocated:** a `ReferenceIntegrityError`'s issues (the message is rebuilt with `formatReferenceIssues`), the issue a `references.onWarning` callback receives, and the stack frame PostCSS adds for the node.
    - **A position the map does not cover** names the entry, with no line, column or frame.
    - **A parse error in CSS that Dart Sass did not produce** keeps PostCSS's `<css input>:line:column` under no file, as on the base (LM-1). That covers the theme the plugin generates and a `references.css` entry.
  - **P6:** as written. The matrix passes 110/110 through `compile()`. A file `@import`ed twice is emitted twice, and once with `@use`.
  - **P7:** as written. Dart Sass's rule goes further than P7's text: an `@import` with a media query, `layer()`, `supports()` or `url()` stays a plain CSS `@import`, even when its target is a `.uxdsl` file (flag 14). Sass hoists plain-CSS imports to the top.
  - **P8,** with MIG-B9-12's flag 12 decided:
    - `compile({ source })` without `from` keeps its former behavior (flag 12). It is compiled as an anonymous `.uxdsl` file at `<cwd>/__uxdsl_css_input__.uxdsl`, a name that never surfaces. Positions print `<css input>` with no `file`; relative loads resolve from the working directory; it is never a dependency; the map names it `<css input>`.
    - The extension of `entry` or `from` decides the reading (flag 13): `.scss`, `.sass` and `.css` as written, anything else protected as `.uxdsl`.
  - **P9:**
    - Sources are the author's files, relative to `dirname(to)` (to the working directory without `to`), named as PostCSS names them (URL-encoded, unique, never absolute, never `file:`).
    - Every mapping PostCSS kept from its own input (Dart Sass's output under the entry's name) is dropped. On the playground that is 1,211 of 14,053 mappings, almost all rule-closing braces.
    - `sourcesContent` is the original text, and `<no source>` stays for generated nodes.
    - MIG-B9-12's follow-up, "sources relative to `dirname(to)`", is superseded. PostCSS resolves a prev map's relative sources against `dirname(from)`, so the absolute stage sources need no rebasing.
  - **P10:** asserted by `fixtures/sass-corpus/run.js` by default, with its existing method:
    - one process: Dart Sass three times without a map, then `compile()` three times; medians compared;
    - `--no-timing-budget` reports the ratio without asserting it, and the gate's S-1 uses it;
    - the deprecation line is labeled as Sass's capped delivery, and an untimed `verbose` run prints the real totals (330).

    Not met at delivery (flag 1).
  - **P11 holds.** The marker passes Sass unchanged and must follow any `@use`. The theme's `@import` goes after Sass's `@charset` and hoisted imports.
  - **P12 holds.** `compile.ts`'s header states the four stages and what each may change, including the two failure classes added by the review. AC6's grep already printed 0 on the base; `compiler-structure.test.js`'s "no history tags" test enforces it across `src`.
  - **§7.** The review's claim that `watch-mode:496`, `vite:117` and `webpack:80` need edits here is refuted: they pass unchanged and their titles stay true. The MIG-B9-14 test that changed is `cli/error-location` (3:12 becomes 3:3).
  - **§8.** T1–T11 hold as the review amends them, with three adjustments:
    - T7 has no inventory; its derived scans enforce the change.
    - T11 moved from `postcss-scss` to PostCSS's default parser, as did `reference-integrity-equivalence.test.js` and `scripts/bench-references.js`.
    - The 1.5× placeholder in `sass-pipeline.test.js` is deleted: T9 measures the budget, and AC2 counts only todos.

    The design added T12–T26. The fixers and the re-review added the rest.
- **API as implemented** (`packages/uxdsl/src/compile.ts`):
  - `compile(input: { entry?; source?; from? }, config?: { theme?; references?; includeTheme?; to?; sourcesContent?; sourceMap?: false | 'inline' | 'external'; sass?: { silenceDeprecations?: string[]; quietDeps?: boolean } }): Promise<{ css; map?; dependencies; warnings }>`.
  - Input or option problems are plain `Error`s starting `uxdsl: `, raised before any I/O.
  - `UXD_SASS` errors are MIG-B9-12's `SassStageError`, passed through.
  - A plugin or parser `CssSyntaxError` is relocated as P5 says, with its message rebuilt by `setMessage()` and the first line of its stack rewritten.
- **Criterion → test:**

  | Criterion or §8 test | Evidence |
  | --- | --- |
  | AC1 | `fixtures/sass-corpus/run.js`: `byte-identical: true`, the five mixed checks `ok`, counts printed; **the timing fails** (delivery runs). The runner's own logic is covered by `fixtures/sass-corpus/run.test.js` (4) |
  | AC2 | `node --test packages/uxdsl/test/core/*.test.js`: 337 tests, 336 pass, 1 skipped, 0 todo; `todo(` appears 0 times in the four files |
  | AC3 | `test ! -f …/scss-subset.ts` and the two `node -e` checks exit 0; `test/entries.test.js` pins the six hard dependencies (T26) |
  | AC4 | `fixtures/parity/run.js` PASS (8), the oracles re-recorded in `d708d85` (table below) |
  | AC5 | `npm test` exit 0 (1,478 tests); `verify:1.0 -- --skip-playground-walk` 68/68 with S-1, S-2 and S-3 `ok`; full `verify:1.0` 69/69 |
  | AC6 | `grep -c "MIG-B" packages/uxdsl/src/compile.ts` prints 0; `compiler-structure.test.js` "no history tags" |
  | AC7 | `uxdsl:build` exit 0; the diff of `src/app/uxdsl.css` is classified hunk by hunk in the PR body, summarized below |
  | T1 | `sass-matrix.test.js`: 110 cases and the tally (titles kept), 110/110; the vacuous "same names as scss-subset.test.js" test deleted; `MIG-B9-13: the recorder keeps the today group as written` |
  | T2 | `protect.test.js`: `MIG-B9-13: the 63 protect/restore cases through compile() …` (O2 and O3 warn `UXD_FUNCTION_SHADOWED` at 1:11); the ten `verify` notes confirmed and removed |
  | T3 | `sass-source-maps.test.js`: the 4 todos flipped (18:66, `_mixins.uxdsl:11:3`, `sass-error.uxdsl:4:18`, the final map), a strict final-map test, and its control (the plugin directly on the stage's CSS reports 29:12) |
  | T4 | `sass-pipeline.test.js`: 15 todos flipped as written, 2 rewritten (the missing `@use` written first, `sass.silenceDeprecations`), and the two non-CSS-text tests (SO-4, RR-2) |
  | T5 | `compile.test.js`: 20 `MIG-B9-13:` tests, the adapted cycle, missing-import, duplicate, media-import, bare-specifier and virtual-`from` cases, plus T16–T19 |
  | T6, T24 | `no-silent-output.test.js`: 16 `MIG-B9-13:` tests. T24 pins 54 kept/generic probes, 18 `url()` probes and 22 nested-property probes against live Dart Sass, each table with a planted-row control; there are 63 look-alikes |
  | T7 | `diagnostics-catalog.test.js`: `MIG-B9-13: the six SCSS-subset and $variable codes are retired …` and the derived scans |
  | T8 | `fixtures/parity/expected/*.json` (8) |
  | T9 | `fixtures/sass-corpus/run.js` and `run.test.js` |
  | T10 | `fixtures/release-1.0/run.js`: S-1, S-2, S-3, N-02 and UX-20 (map integrity with a planted-mapping control); `fixtures/release-1.0/verdicts.test.js` (4) gives S-3's and N-02's verdicts encoded negative controls |
  | T11 | `test/performance/reference-performance.test.js` (budget holds, default parser) |
  | T12 | `sass-matrix.test.js`: `MIG-B9-13: every "sass" case that compiles equals live Dart Sass byte for byte through compile()` (73), with its control |
  | T13–T15 | `sass-source-maps.test.js`: warnings, `onWarning` and `ReferenceIntegrityError` relocated; independence from PostCSS's arithmetic; the unmapped fallback (extended to warnings and reference issues by LM-4) |
  | T16–T19 | `compile.test.js`: the anonymous source; `config.sass`; the cascade after a directive; `dependencies` and reserved names |
  | T20, T21 | `near-miss-functions.test.js` (3), `preserve-untouched-declarations.test.js` (2) |
  | T22, T23 | `cli/error-location.test.js` (`src/partial.uxdsl:3:3`), `diagnostics-location.test.js` (1:7, 4:17, control 2:3) |
  | T25 | `compiler-structure.test.js`: `Once()`'s step list, plus `MIG-B9-13: no source file holds a raw Unicode noncharacter …` (RR-1) |
  | Review additions | CT-1, CT-2, CT-3, CT-7 (`compile.test.js`, `sass-source-maps.test.js`); CT-4 (nested properties); SO-2 (supports grammar); SO-4 and RR-2 (non-CSS text); LM-1 to LM-4; F1, F2 and F4 (`url()`, special functions, compound placeholders, `//` in a value); F3 (a PostCSS chain); RR-5 (`fixtures/mig-b9-13-compile-on-sass/browser.js`, 13 Chrome checks, not part of `npm test`) |

- **The review and its outcome:**
  - **Round 1, at `bcb1228`.** Four lenses (contract-tests, sass-oracles, locations-maps, dec05-guards) raised 23 findings: 4 blocking, 14 should-fix and 5 nits. None was judged not real.
    - **CT-1 (blocking)**: P4's warning order and a positionless warning's `{ text }` shape had no test. Tests added in `9d32de5`. Mutations M1 (spreads swapped) and M19 (a positionless warning given a position) left 639 tests passing before; each fails the new test.
    - **CT-2 (blocking)**: `quietDeps` was not shown to reach Dart Sass through `compile()`. Test added in `9d32de5`; mutation M21 fails it.
    - **CT-3**: a relocated error's end position and frame were not pinned. Test added in `9d32de5`, with a 265-character line; mutations M8, M8b and M8c fail it.
    - **CT-4**: Sass nested properties passed the plugin alone silently. Fixed in `dcb76ce` (`nestedPropertyName()`, pinned on 22 probes against live Sass). The first full `npm test` caught `@theme` packs, which were then excluded.
    - **CT-5**: what PostCSS's parser rejects first cannot be `UXD_SASS_CONTEXT`. Documented; owner flag 7.
    - **CT-6**: S-3's and N-02's verdicts had no encoded negative control. Fixed in `bceb192` (`verdicts.test.js`), and S-3 now also requires the author's declaration and caret on the framed line. Mutations G1–G3, G5 and N1–N4 each fail one test.
    - **CT-7**: URL-encoded map sources were not covered. Test added in `9d32de5`; mutations M15, M15b and M15c fail it.
    - **CT-8**: two titles did not start with `MIG-B9-13:`. Renamed in `9d32de5`.
    - **SO-1**: the docs said flattening cannot change rendering. Rewritten in `b2f0fb5`, with three patterns and the double `@import`. Chrome 156 compared `ed498e3` and HEAD in scratch; RR-5 later encoded the check.
    - **SO-2**: the kept-place classifier was narrower than Sass's supports grammar. Fixed in `ede2657`: 11 rows disagreed with live Sass before, 0 after. T24 grew from 27 to 41 probes.
    - **SO-3**: a literal `$identifier` in a custom property cannot be emitted. Owner flag 6.
    - **SO-4**: a top-level colon Sass prints (`b: a:b`) is PostCSS's `Missed semicolon`. Documented and pinned in `479c24f`; a `checkMissedSemicolon` mutation fails the pin. The base rejected it too.
    - **SO-5**: Sass's unquoted attribute values were not listed. Added to the formatting lists in `b2f0fb5`.
    - **LM-1 (blocking)**: a parse error in the generated theme or a `references.css` entry was relocated into the author's file. Fixed in `05320a6`: only a `CssSyntaxError` whose input is Dart Sass's output is relocated. The CLI again prints `<css input>:2:73: Unclosed comment`. Mutations L1–L3 fail the test.
    - **LM-2**: the three `sourceMap` modes treated a kept `/* # sourceMappingURL=… */` comment differently. Fixed in `8c6b6d7` (`dropAnnotations`); A1 and A2 fail the test. The asymmetry predates this story (it is on `ed498e3` and on beta.8 `0446d7c`).
    - **LM-3**: on win32 the final map would lose every author mapping. Fixed in `8c6b6d7` (`chainable`), emulated on POSIX. B1 fails the test, and B2, the review's file-URL variant, throws a `TypeError` for an anonymous source.
    - **LM-4**: the unmapped fallbacks of warnings and reference issues were untested. Tests added in `05320a6`; W1 and I1 fail them.
    - **F1 (blocking)**: `--x: url($v)` passed `compile()` silently. Fixed in `bb61147`: a `$variable` in a `url()` gets the kept message wherever Sass keeps the `url()` as written. It is pinned on 18 probes; 11 rows disagreed before.
    - **F2**: `expression()`, `element()`, `type()` and a vendor-prefixed `calc()` keep their arguments, and a dotted call in `expression()` is script. Fixed in `bb61147`; the supports rows were already fixed by `ede2657`.
    - **F3**: PostCSS chains (postcss-nested, postcss-simple-vars). Documented and pinned in `9e1f1a6`; the pin fails on `ed498e3`. Owner flag 8.
    - **F4**: a `%placeholder` inside a compound and a `//` comment read into a value were silent. Fixed in `993e6ae`. Nested properties were fixed by CT-4, and the parser-first forms are flag 7.
    - **F5**: `compile.ts`'s header did not name `UXD_SASS_CONTEXT`. Fixed in `9e1f1a6`.
    - **F6**: evidence figures. Corrected in this record: `uxdsl.css` is 337,214 bytes, 8,072 → 8,350 lines; there were 57 look-alikes then, and there are 63 now.
  - **The mutation re-review, read-only at `9e1f1a6`.**
    - It reverted each of 16 fixes or test-only findings in 24 mutations, rebuilt, and ran the named tests: each fails without its fix.
    - 8 mutations of the gate verdicts each fail a verdict test.
    - A false-positive scan found no changed outcome between `bcb1228` and HEAD on 189 real CSS files or the 86 tracked stylesheets.
    - 97 highlight.js themes and Bootstrap's 4 entry points equal Dart Sass through `compile()` in the three map modes.

    It raised 6 findings, handled by the second fixer in `7e9fba5` and `b4227eb`:
    - **RR-6 (should-fix)**: the gate evidence predated the fixes. Re-run on `b4227eb` by the second fixer and again by this delivery.
    - **RR-1**: a raw U+FFFF in a regex. Escaped, with a `src` scan test that failed on `9e1f1a6`; behavior is unchanged on 262,153 probes.
    - **RR-2**: non-CSS text Sass prints, and a printed `//`. Documented and pinned in `sass-pipeline.test.js`.
    - **RR-3**: the headline claims. Qualified.
    - **RR-4**: P1's deviations. Owner flag 2.
    - **RR-5**: the SO-1 claims rested on scratch scripts. `fixtures/mig-b9-13-compile-on-sass/browser.js` now holds 13 Chrome checks; all pass on HEAD, and 7 fail on `ed498e3`'s build. It also covers the `@ds-button` cascade claim, which no earlier run had checked in Chrome.
  - **Interruptions.** The contract-tests fixer's first session was cut. Its uncommitted patch was not applied as it stood; the resumed fixer rewrote its four tests and verified each under mutation. Every agent reported writing only in this worktree and its scratch directory. At delivery the owner's checkout was clean on `main` at `ccd8a88`, with no stash (checked read-only), and no process of this run was left running.
- **Commands.** Exit codes are as each agent reported them, with logs in the run's scratch evidence. The implementers' and fixers' runs were at their own heads; the delivery's runs are at `b4227eb`.

  *Implementers (2026-11-01):*

  | Command | Exit | Output |
  | --- | --- | --- |
  | I1: the new and flipped tests on `ed498e3`'s build (9 files) | 1 | 299 tests, 112 fail (failing first) |
  | I1: `node test/core/sass-matrix.record.js`, with `--update`, then again | 1, 0, 0 | header-only rewrite, no expectation moved; then up to date |
  | I1: `npm uninstall postcss-import postcss-scss` in `packages/uxdsl` (Node 20.19, npm 11) | 0 | removed 10 packages; lock synced |
  | I1: the package suites | 0 | top level 705/705; core 327 (326 pass, 1 skipped, 0 todo); cli 218; vite 17; webpack 7; performance 1 |
  | I1: `uxdsl:build` after `paradigm/frame.uxdsl` moved to `@use './card';` | 0 | paradigm frame 53,459 bytes, no warning; `examples.json` changes `bytes` only |
  | I1: `capture-capabilities.js`; `generate:capabilities` | 0 | captures regenerated (10 diagnostics carets move to the statement start); matrix unchanged |
  | I1: `node fixtures/parity/run.js`, then `--update`, diff read, then again | 1, 0, 0 | 8 of 8 changed; classified F, I and E; PASS |
  | I1: `node fixtures/sass-corpus/run.js` ×3 (budget not yet asserted) | 0 | byte-identical; 1.48×, 1.24×, 1.37× |
  | I1: `npm ci` in the playground; `npm test`; `verify:doc-examples`; both `--check`s; mig07; `verify:docs` | 0 | all pass; 49 examples |
  | I1: `npm run verify:1.0 -- --skip-playground-walk` | 0 | 65/65; UX-20 `ok` with the new lookup; 20 packages installed |
  | I1: `git commit` (hook, 27 s), `git push -u` | 0 | `d708d85` |
  | I2: the four files on `d708d85`; T23 on `ed498e3` | 1, 1 | 52 tests, 7 fail; 3:3 for 1:7 (failing first) |
  | I2: the package suites (first run) | 1 | `compile-sass.test.js` T10 still asserted owner `compiler` for `UXD_FUNCTION_SHADOWED`. That is a gap in the design's lists, not a contract conflict; the one assertion was changed |
  | I2: core; the four files; parity; `uxdsl:build`; corpus; mig07; doc examples; `generate:language` and both `--check`s | 0 | core 327 (0 todo); 52/52; catalog 106; `uxdsl.css` unchanged; byte-identical, 1.41× |
  | I2: the plugin alone over the 86 tracked stylesheets | 0 | 8 flagged, all Sass sources compiled through `compile()` by design |
  | I2: `capture-capabilities.js --check` before, then after regeneration | 1, 0 | stale, then the 2 new captures (exit 1 each) and 22 diagnostics |
  | I2: `npm test` ×2; commits (hook 18 s, 19 s), pushes | 0 | `44daadd`, `77adc53` |
  | I3: `run.test.js` on the unchanged runner, then after | 1, 0 | 4/4 fail, then 4/4 pass |
  | I3: `node fixtures/sass-corpus/run.js` ×6 (budget asserted) | 1, 0 ×5 | 1.53×, 1.47×, 1.46×, 1.23×, 1.46×, 1.47× |
  | I3: the gate verdicts on the base's outputs; S-1's command on the base | 0; 1 | S-3 and N-02 fail on the base and pass on the branch; `byte-identical: false` |
  | I3: `npm run verify:1.0 -- --skip-playground-walk`; full `verify:1.0`; `verify:playground-browser` | 0 | 68/68 (S-1 1.42×); 69/69 (S-1 1.40×); `PASS`, 380 pages |
  | I3: `uxdsl:build` ×3, `uxdsl build` ×3, the classification script, warm interleaved timing | 0 | 2.18 s, 1.02 s (medians); nothing outside N, F, I and O; figures below |
  | I3: `npm test` ×3; commits (hook 17–18 s), pushes | 0 | `e08e428`, `cda8655`, `bcb1228` |

  *The fix pass and the re-review (2026-11-02, 09:30–13:13):*

  | Command | Exit | Output |
  | --- | --- | --- |
  | contract-tests: the pristine suites under M1, M19, M21, M8, M8b, M15, M15b and M15c (22 files, 639 tests) | 0 | 0 failures each (the gaps); then each fails exactly its new test |
  | contract-tests: `no-silent-output` on `bcb1228` with the CT-4 tests; `verdicts.test.js` against `bcb1228`'s runner | 1, 1 | nested properties compiled; S-3's control: `Missing expected exception` |
  | contract-tests: `npm test` (first run for `dcb76ce`) | 1 | 4 `@theme` tests failed until `@theme` was excluded |
  | contract-tests: e4-nested-pin, corpus `--no-timing-budget`, tarball verdicts (e6), gate-verdict mutations | 0 | 27 probes agree; byte-identical; both verdicts pass from a packed tarball; each mutation caught |
  | sass-oracles: live-Sass probes before and after `ede2657`; the new tests on `bceb192` | 0; 1 | 15 + 7 disagreements, then 0; two tests fail before |
  | sass-oracles: the Chrome comparison of `ed498e3` and HEAD (scratch); the nesting scan; the SO-4 pin under the `checkMissedSemicolon` mutation | 0; 0; 1 | `{red, "A", red, blue}` then `{blue, "B", black, red}`; 0 hits in 370 nested rules, 3 in the planted control; the pin fails |
  | locations-maps: the LM-1 test on `b2f0fb5`; LM-2 and LM-3 on `05320a6`; mutations L1–L3, A1, A2, B1, B2, W1, I1 | 1; 1; 0 | `no author file`; `external` differs from false and 141 → 0 mappings; each mutation caught |
  | locations-maps: `compare-maps.js` (9 inputs); `sass-source-maps` on PostCSS 8.4.31 | 0; 1 | identical on POSIX; 17/18, where T14's control reads 18:64 (it assumes 8.5.16 or later) and `compile()` reads 18:66 |
  | dec05-guards: the F1/F2 tests on `8c6b6d7`; the F4 test on `bb61147`; the F3 pin on `ed498e3` | 1; 1; 1 | 6 failures; `a%primary` compiled; `expected unwrap-nested, uxdsl to fail` |
  | dec05-guards: real postcss-nested 7.0.2 and postcss-simple-vars 7.0.1 chains; the plugin bench on Bootstrap's output | 0 | fail in both orders on HEAD and compiled on the base; no measurable cost |
  | every fixer, before each commit: `npm test`; `verify:doc-examples`; both `--check`s; core; catalog; parity; `generate:capabilities` | 0 | 1,455 → 1,476 tests, 0 fail, 1 skipped, 0 todo; 51 examples; core 331 → 336; catalog 8/8; PASS 8; no diff |
  | every fixer: `git commit -F …` (hook) and `git push` | 0 | `dcb76ce` … `9e1f1a6`, 11 commits |
  | re-review: 24 fix-revert or behavior mutations and 8 gate-verdict mutations; read-only suites; false-positive scans; second corpus; Chrome re-run | 0 (harness), 1 per mutation | every mutation caught; core 336 + 1 skipped, top level 722, cli 218, vite and webpack 24; 0 changed outcomes; 101 entries equal Dart Sass |
  | second fixer: the RR-1 test on `9e1f1a6`; the RR-2 test under M-RR2a and M-RR2b; `browser.js` on HEAD and on `ed498e3`'s build | 1; 1; 0 and 1 | two raw U+FFFF found; each mutation caught; 13/13, then 7 FAIL |
  | second fixer: `npm test` ×2; `verify:1.0 -- --skip-playground-walk` and `verify:playground-browser` on `b4227eb` | 0 | 1,478 tests; 68/68; `PASS` |
  | second fixer: `node fixtures/sass-corpus/run.js` ×3 on `b4227eb`; A/B `--no-timing-budget` ×4 each, `bcb1228` against `b4227eb` | 1, 1, 1; 0 | 1.53×, 1.54×, 1.52×; `compile()` 608/609/597/597 against 603/603/597/612 ms (no regression) |
  | second fixer: commits (hook) and pushes | 0 | `7e9fba5`, `b4227eb` |

  *Delivery (2026-11-02, `b4227eb`):*

  | Command | Exit | Output |
  | --- | --- | --- |
  | `git fetch`; `git rev-parse origin/feat/beta9 HEAD` | 0 | `ed498e3`, `b4227eb` (= the pushed branch); worktree clean; hooks installed |
  | `npm --prefix packages/uxdsl run clean && npm --prefix packages/uxdsl run build` | 0 | `tsc -p tsconfig.json`, clean; no `dist/scss-subset.js` |
  | `node fixtures/sass-corpus/run.js` ×3 (AC1), 13:20, load average 2.5–2.8 | 1, 1, 1 | `byte-identical: true` each time. The Dart Sass and `compile()` medians and ratios: 389 and 593 ms (1.52×), 399 and 624 ms (1.56×), 405 and 612 ms (1.51×), each with `FAIL  compile() is over the 1.5x budget`. `deprecation warnings Dart Sass delivered (capped at five per type, then a summary): {"import":5,"if-function":5,"global-builtin":5,"color-functions":5,"other":1}`; `deprecation totals (verbose): {"import":87,"if-function":83,"global-builtin":154,"color-functions":6}`; `compile() returned 21 warnings`; the five mixed checks `ok` |
  | `node fixtures/sass-corpus/run.js` ×3 more, 13:41, load average 6.3–7.0 | 0, 0, 1 | 1.40× (612/438 ms); 0.84× (642/765 ms, with Dart Sass's own runs disturbed at 1,247/765/625 ms); 1.57× (647/413 ms); `byte-identical: true` each time |
  | `/usr/bin/time -p npm --prefix packages/playground-nextjs run uxdsl:build` ×3 (AC7) | 0, 0, 0 | real 2.40, 2.42 and 2.25 s. Output: `[uxdsl] unchanged src/app/uxdsl.css (compiled output identical to the file on disk; not rewritten)`, `paradigm frame: public/paradigm-frame/index.html (css 53459 bytes)`, `wrote src/generated/examples.json (11 examples)`. The tree stayed clean |
  | `/usr/bin/time -p npx uxdsl build` ×3 in `packages/playground-nextjs` | 0, 0, 0 | real 1.07, 1.05 and 0.93 s; `unchanged src/app/uxdsl.css` |
  | `git diff --no-index <the scout's before-uxdsl.css> packages/playground-nextjs/src/app/uxdsl.css` | 1 (they differ) | `5274 insertions(+), 4996 deletions(-)`; 60 hunks, 195 with `-U0`. The before copy equals `git show ed498e3:…` (sha256 `9f8c13e4…`) |
  | I3's classification script at `b4227eb`; the hunk labeler (`label-hunks.js`, scratch) | 0, 0 | the report is identical to I3's; 60 hunks: N 39, F 59, I 1, O 9, unlabeled 0 |
  | `node --test packages/uxdsl/test/core/*.test.js` (AC2) | 0 | `# tests 337`, `# pass 336`, `# fail 0`, `# skipped 1`, `# todo 0` (47 s). `grep -c 'todo('` is 0 in `sass-matrix`, `protect`, `sass-pipeline` and `sass-source-maps` |
  | `UXDSL_SASS_CORPUS=<the scout's bootstrap 5.3.8> node --test packages/uxdsl/test/core/protect.test.js` | 0 | 81/81; `Bootstrap corpus: 92 files, 328410 bytes; protect 2.4 ms (first pass, cold: 3.3 ms)` |
  | AC3: `test ! -f packages/uxdsl/src/scss-subset.ts`; `node -e "require('./packages/uxdsl/package.json').dependencies['postcss-import'] && process.exit(1)"`; the same for `postcss-scss` | 0, 0, 0 | `dependencies`: chokidar, minimist, picomatch, postcss-value-parser, sass, source-map-js |
  | AC6: `grep -c "MIG-B" packages/uxdsl/src/compile.ts` | 1 (no match) | prints `0`. `grep -cE 'MIG-B\|FEAT-0\|stability phase'` prints 0 for each of `compile.ts`, `plugin.ts` and `diagnostics.ts`; `compile.ts` holds one `uxdslPlugin({` literal |
  | the catalog, read from `dist/diagnostics.js` | 0 | 106 codes (theme 59, compiler 38, runtime 6, core 3: `UXD_SASS`, `UXD_SASS_WARNING`, `UXD_FUNCTION_SHADOWED`); none of the six retired codes and no `UXD_RESERVED_NAME`, in the catalog or in `src` |
  | `node fixtures/parity/run.js` (AC4, no `--update`) | 0 | `PASS: 8 parity case(s) — CLI, compile(), and the Vite/Webpack adapters agree, matching the committed oracle.` |
  | `npm run verify:doc-examples` | 0 | `51 examples and 24 theme excerpts checked across 101 documentation files. All documentation examples hold.` |
  | `node scripts/generate-language-artifacts.js --check`; `node scripts/generate-agent-guide.js --check` | 0, 0 | no drift |
  | `node fixtures/mig07-consumer/run.js`, run before `npm test` as CI does | 0 | `PASS`, `All checks passed.` |
  | `npm test` (AC5), background, logged, 13:24–13:27 | 0 | 1,478 tests: 1,477 pass, 0 fail, 1 skipped, 0 todo. By suite: package top level 723, core 337, cli 218, vite 17, webpack 7, performance 1; vscode 30; playground 34; root fixtures and scripts 111. `Captured CLI and compiler output is up to date.`, `Compiled examples are up to date (11).`, parity `PASS`, mig07 `All checks passed.`, the capability matrix up to date |
  | `npm run verify:1.0` (the full gate, real Chrome), background, 13:28–13:34 | 0 | `69/69 automated checks passed.` The tarball is 262,934 bytes packed (92 files); I-1 has postcss 8.5.32 as the peer. Check by check: S-1 `byte-identical, the five mixed checks ok; compile() 1.52x Dart Sass (reported, not asserted)`; S-2 `4 tests, their negative controls included`; S-3 `heavy.uxdsl:18:66 UXD_SPACE_REFERENCE, framed at the author's line 18`; N-02 `UXD_SASS at missing-partial.uxdsl:1:9: Can't find stylesheet to import.`; UX-20 sources `["<no source>","map.uxdsl"]`, every mapping inside its text; UX-02 and UX-16 `ok`; B7-17E `PASS`; AUDIT and AUDIT-lock 0 vulnerabilities; packages installed with uxdsl: 20. Not executed, as always: B7-12, the story-radar validation, postpublish |
  | `npm run verify:1.0 -- --skip-playground-walk` (AC5 as written), 13:34–13:36 | 0 | `68/68 automated checks passed.` S-1 `byte-identical, …; compile() 1.59x Dart Sass (reported, not asserted)`; S-2, S-3 and N-02 as above; B7-17E skipped by the flag |
  | `npm run verify:playground-browser`, 13:36–13:40 | 0 | `PASS: no console errors, no UXDSL warnings, no unresolved var(), visible keyboard focus, contrast page = Node.` It loaded 380 pages and checked 2,218 focusable elements. The contrast page equals Node for `default` (1,004 pairs) and `green` (911), light and dark, 0 failing. 1,532 hosting-only 404s were exempted and listed, and all six planted negative controls were caught |
  | `node fixtures/mig-b9-13-compile-on-sass/browser.js` | 0 | Chrome 156.0.8078.74; 13 checks `ok`, `PASS`. The t1–t4 probes are Dart Sass's own output. `compile()` gave `{"t1":"rgb(0, 0, 255)","t2":"\"B\"","t3":"rgb(0, 0, 0)","t4":"rgb(255, 0, 0)","t5":"rgb(255, 0, 0)"}`, and the negative control `{"t1":"rgb(255, 0, 0)","t2":"\"A\"","t3":"rgb(255, 0, 0)","t4":"rgb(0, 0, 255)","t5":"rgb(88, 28, 135)"}` |
  | `gh pr create --base feat/beta9 --head feat/b9-13-compile-on-sass …` | 0 | https://github.com/rsantoyo-dev/uxdsl/pull/63 |
  | on the tree with this record: `npm test`, `npm run verify:doc-examples`, both `--check`s | 0, 0, 0, 0 | 1,478 tests: 1,477 pass, 0 fail, 1 skipped, 0 todo; 51 examples and 24 theme excerpts hold; no drift |

- **The playground's build time and `src/app/uxdsl.css`:**
  - **Build time:**
    - before (the scout, at `ed498e3`): `npm --prefix packages/playground-nextjs run uxdsl:build` 1.63, 1.52 and 1.58 s (median 1.58 s, after a 1.727 s first run); `uxdsl build` alone 0.82, 0.72 and 0.71 s (median 0.72 s);
    - after (this delivery, at `b4227eb`): 2.40, 2.42 and 2.25 s (median 2.40 s); `uxdsl build` 1.07, 1.05 and 0.93 s (median 1.05 s);
    - I3's same commands at `bcb1228`: medians 2.18 s and 1.02 s.

    The before and after runs come from different sessions. In one process and one session, `compile()` of the playground entry takes 113 ms on the base and 213 ms on the branch, and `require('sass')` takes 107–121 ms.
  - **The diff of `src/app/uxdsl.css`,** from `ed498e3` to `b4227eb`:
    - 338,844 → 337,214 bytes, and 8,072 → 8,350 lines (no final newline now);
    - sha256 `9f8c13e46b04…` → `1f7eb19e7549…`, byte-identical to the scout's classified prototype output;
    - +5,274 / −4,996 lines in 60 hunks (195 with `-U0`).

    The rule-level classification re-serializes both sides with Dart Sass:
    - **N:** 727 rules and 12 at-rules nested in rules before, 0 after.
    - **F:**
      - `@charset` 0 → 1;
      - the final newline dropped;
      - single-quoted strings 12 → 8;
      - leading-dot numbers 5 → 0, and `a / b` slashes 3 → 0;
      - blank lines 790 → 512;
      - one-line rules expanded;
      - 24 attribute selectors unquoted;
      - 10 declarations that differ only by quotes, zeros or slashes.
    - **I:** 22 RussianDoll rules (79 declarations) only after.
    - **O:** 9 of 1,208 rules moved.
    - **Outside these categories:** 0.

    Every one of the 60 hunks carries a category (N in 39, F in 59, I in 1, O in 9); the labeled table is in the PR body. The one crossing on a shared property, `.ai-submit-btn:disabled` against the generated selected state on `color`, matters only for a disabled and selected button.
- **Guards (§10):**
  - `npm run generate:language`: no change (the catalog does not feed the artifacts).
  - `AGENTS.md`: the paragraph at "The SCSS subset `compile()` compiles …" is rewritten, and the agent guide regenerated.
  - **CHANGELOG:** one topic, `### compile() runs on Dart Sass; the SCSS subset is deleted (MIG-B9-13)`, with sibling `### Visual changes`, `### Breaking` and `### Removed`.
  - **Migration guide:** `migration.md` gains "beta.9 — Sass inside compile()".
  - **The package README:** the Sass pipeline paragraph and the `$variables` paragraph.
  - **`scripts/verify-docs-update.js`:** `scss-subset.ts` is removed and `compile.ts` stays visual.
  - **`DIAGNOSTIC_CATALOG`:** as P3 says.
  - **The playground:** `npm run generate:capabilities` changed nothing. `uxdsl:build` and the captures were regenerated.
  - **The engine audit:** `docs/architecture/unified-engine-audit.md` "Process flow and ownership" names the Sass stage.
- **Shares as delivered.** Files outside the header's Owns and Shares:
  - **the package's tests:**
    - in `test/core`: `sass-matrix.test.js`, `sass-matrix.record.js`, `sass-matrix.cases.js` (header only), `protect.test.js`, `protect.cases.js`, `sass-pipeline.test.js`, `sass-source-maps.test.js`, `compile.test.js`, `import-order.test.js` (a comment) and `compile-sass.test.js` (one assertion, MIG-B9-12's file);
    - at the top level: `near-miss-functions`, `preserve-untouched-declarations`, `entries`, `performance/reference-performance`, `reference-integrity-equivalence`, `theme-marker` (a title), `no-silent-output`, `diagnostics-location`, `diagnostics-catalog` and `compiler-structure`;
    - `cli/error-location` (MIG-B9-14's `test/cli`, edited as the review authorized);
  - **scripts and fixtures:** `scripts/bench-references.js`; `fixtures/sass-corpus/run.js`, `README.md` and the new `run.test.js`; the new `fixtures/release-1.0/verdicts.test.js`; the new `fixtures/mig-b9-13-compile-on-sass/` (`browser.js`, `README.md`);
  - **the root `package.json` test script:** two `node --test` entries (README §7 lists 13 for it);
  - **documentation:** `packages/uxdsl/README.md`, `packages/uxdsl/docs/migration.md`, the generated `packages/uxdsl/docs/agent-guide.md`, and `docs/architecture/unified-engine-audit.md` (named in §11, not in Shares);
  - **the playground:** `paradigm/frame.uxdsl` (`@use './card';`), `scripts/capture-capabilities.js`, `src/components/DiagnosticsCaptures.tsx`, and the generated `src/app/uxdsl.css`, `src/generated/examples.json`, `cli-captures.json` and `compiler-captures.json`.
- **Not run, or not a pass:**
  - **AC1's timing (owner flag 1).** Four of the six delivery runs exited 1, three of them in a row. The two that exited 0 ran on a more loaded machine, and one of them (0.84×) had Dart Sass's own runs disturbed. The machine was never quiet (the owner's Chrome, VS Code and system agents; load average 2.5–7.0), so the runs are recorded as they are, without a "quiet machine" claim.
  - **Windows** is unverified: CI runs on ubuntu, and LM-3's fix was emulated on POSIX.
  - **What the gate never executes:** B7-12 (a manual VS Code check), the external story-radar validation, and postpublish.
  - **No whole-playground before/after comparison in Chrome.** `verify:playground-browser` checks console errors, UXDSL warnings, unresolved `var()`, focus and contrast, not identical rendering. The specific rendering changes the documentation claims are checked by `fixtures/mig-b9-13-compile-on-sass/browser.js`, which is not part of `npm test` or the gate.
  - **No published build.** No external consumer project was compiled against this branch.
  - **CI's result on this PR** comes after this record is committed, and is not part of it.
- **Owner steps pending:**
  - Decide AC1 and P10 (flag 1) before merging.
  - Review the other owner flags in §15, "Delivery of 2026-11-02".
  - Merge the PR into `feat/beta9` once CI is green and AC1 is decided (README §6). This delivery was instructed not to merge.
  - The wave-1 review.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **"Byte-identical" is not achievable through Sass.** Expanded style re-lays-out whitespace and one-line rules, turns `''` into `""` (the playground has 66 single-quoted strings), writes `.5` as `0.5` and `16 / 9` as `16/9`, drops empty rules and adds `@charset "UTF-8"` for non-ASCII text. Restate §5 and AC7 as "equal to Dart Sass's output for the same source", list Sass formatting as its own hunk category in the parity diff, and add a CHANGELOG line.
- P2 is narrower than DEC-05: it catches only `$name`; `@include`, `@use`, `#{}` and `&__x` in a `.css` compiled by the plugin alone still pass silently. Detect all of them.
- Sass does not evaluate `$var` inside a custom-property value (it needs `#{$var}`), so `--x: $gap` reaches the plugin through `compile()` and gets a message telling the author to use `compile()`. Today the subset substitutes it: a regression. Give it its own message ("write `#{$gap}`").
- Plugin warnings are not mapped: a PostCSS `Warning` uses the node's generated position, not `input.origin`. P4 must map warnings as well as errors.
- P5's "correct by one" is fragile across the `postcss` peer range `^8.4.31`; use `originalPositionFor` directly.
- Tests owned by MIG-B9-14 (`watch-mode:496`, `vite:117`, `webpack:80`) need edits in this story; list them in Shares.

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-05, confirmed** with the review's conditions: every Sass construct reaching the plugin alone is a located `UXD_SASS_CONTEXT` naming the fix (`$name`, `@use`, `@forward`, `@mixin`, `@include`, `@function`, `@extend`, the control rules, `#{…}`, `&`-suffix selectors, `%placeholders`), not only `$name`; `--x: $var` gets its own message (Sass keeps `$var` literally in a custom property; write `#{$var}`); warnings are mapped to the original position like errors.
- **DEC-17:** the `core` diagnostics keep `UXD_SASS`, `UXD_SASS_WARNING` and `UXD_FUNCTION_SHADOWED` (a warning), not `UXD_RESERVED_NAME`. O2 and O3 in `test/core/protect.cases.js` already expect Sass's output plus that warning.

### Delivery of 2026-11-02

New facts from the scout, the design, the implementation, the review and the fixes, each with a proposed owner. None is fixed beyond what §14 records.

**Owner decisions requested** (the design record's 15 flags, then the fix pass's and the re-review's):

1. **AC1 / P10: the timing budget is not met at delivery.** On `b4227eb`, `node fixtures/sass-corpus/run.js` is byte-identical every time.
   - Its ratio exceeded 1.5× on three consecutive runs: 1.52×, 1.56× and 1.51× at 13:20, load average 2.5–2.8. That is the design's stop condition.
   - Three more runs at a load average of 6.3–7.0 gave 1.40×, 0.84× (Dart Sass's own runs were disturbed: 1,247/765/625 ms) and 1.57×.
   - The re-review's fixer measured 1.53×, 1.54× and 1.52× on the same commit.
   - I3's six runs at `e08e428` gave 1.53× (exit 1), then 1.47×, 1.46×, 1.23×, 1.46× and 1.47×. I1's three runs at `d708d85`, before the budget was asserted, gave 1.48×, 1.24× and 1.37×.
   - The gate's S-1 reported 1.42×, 1.40×, 1.51×, 1.52× and 1.59× without asserting.
   - The fix pass did not slow the pipeline: an interleaved A/B gave `compile()` 597–609 ms on `bcb1228` against 597–612 ms on `b4227eb`.

   The breakdown, warm and interleaved, against plain Dart Sass at 307–322 ms:
   - Dart Sass with its own source map is 1.07×;
   - the Sass stage with its map is 1.38–1.40×, and without it 1.23–1.24×;
   - the plugin's pass adds about 64–70 ms;
   - `compile()` is 1.62–1.63× plain Dart Sass and 1.52× Dart Sass with its map.

   The machine was never quiet: the owner's Chrome, VS Code and system agents were busy. As the design required, the method, the baseline, the always-on stage map and the plugin were not changed. Options:
   - (a) accept the incumbent method and re-measure on a quiet machine;
   - (b) budget against Dart Sass with its source map;
   - (c) schedule work on the plugin's fixed per-build costs: `validateTheme`, the reference pass's theme render, and the double theme discovery until MIG-B9-21 K3;
   - (d) restate P10.
2. **P1 as built (RR-4).** The pipeline is `postcss([restoreDirectiveSpacing, uxdslPlugin(opts), dropAnnotations])` with `map: { prev: chainable(stage.map), inline: false, annotation: false, sourcesContent }`, and the stage is called with `sourceMap: true` on every build, where P1 says "when a map is requested".
   - `dropAnnotations` (LM-2) keeps P9's byte-identical modes.
   - `chainable` (LM-3) is identical to `stage.map` on POSIX.
   - The always-on map is MIG-B9-12's delivery decision.

   Please accept the amended P1.
3. **LM-2: P9 against "equal to Dart Sass's output".** Dart Sass keeps a top-level `/* # sourceMappingURL=… */` comment, and `compile()` removes it in every mode. PostCSS always removed it when it wrote no map (on `ed498e3`, and on beta.8 `0446d7c`); `'external'` and `'inline'` used to keep it. Keeping it in every mode instead would need a map on every build, or PostCSS's stringifier replaced. Please confirm.
4. **"Must stay byte-identical" is restated** as the review asked. `url-unquoted` and `comment-with-url` lose their final newline, because Dart Sass's API writes none. Accept the restatement of §5 and AC7.
5. **DEC-05, applied beyond its enumerated text** (the design's flag 1, widened by the fix pass):
   - **Through `compile()`,** a `$variable` or namespaced call Dart Sass keeps as written gets the kept message. That covers:
     - custom properties (DEC-05's own case);
     - every plain-CSS at-rule prelude Sass leaves alone (`@container`, `@layer`, `@scope`, `@custom-media`, `@keyframes`, `@counter-style`, `@property`, `@page`, `@font-feature-values`, `@namespace`, unknown at-rules);
     - the supports conditions Sass does not evaluate (SO-2), in `@supports` and in an `@import`'s `supports()`;
     - an `@import`'s `layer()` and other functions;
     - `progid:` values and CSS `@function` bodies;
     - the arguments of `expression()`, `element()`, `type()` and a vendor-prefixed `calc()` (F2);
     - a `url()` in those places (F1).
   - **The plugin alone also rejects** `@at-root`, `@content`, `@return`, `@debug`, `@warn`, `@error`, namespaced calls (outside `expression()`, whose argument is script), nested properties (CT-4), a `%placeholder` anywhere in a compound, and a `//` comment PostCSS read into a value (F4).
   - **`@else` alone is not flagged,** because `@if` always precedes it.

   The SCSS subset substituted `$variables` in all of these places, so silence there would have been a regression. Confirm, or trim the list.
6. **An error, not a warning, for a `$variable` Sass keeps** (the design's flag 2). A valid SCSS file that outputs `$var` literally (`--x: $gap`, `@layer $l`) now fails through `compile()`, where Dart Sass compiles it. No such file was found in Bootstrap, the playground, 189 local `.scss` files or the documentation.

   SO-3 adds two cases where the message's premise is false, so `compile()` cannot emit a custom property whose value is a literal `$identifier`, although that is valid CSS:
   - a declaration in a plain `.css` file loaded with `@use` or `@import`, where the suggested `#{$x}` is itself Sass's error (`Sass variables aren't allowed in plain CSS.`);
   - an author who wrote `#{'$x'}` or `string.unquote('$x')`, and is told to write the interpolation they already wrote.

   Only `\$x` passes, and Chrome then reads `\$x`. Options:
   - (a) accept and document it;
   - (b) skip the kept rule, or warn, for a declaration whose author file is `.css`; this needs a plugin option or `result.opts`, which the design rejected;
   - (c) make the kept `$variable` a warning.

   A test should pin the choice.
7. **CT-5: a PostCSS plugin cannot meet DEC-05 for the Sass PostCSS's own parser rejects first:** `#{…}` in a selector, in a property name or bare in a value, and a `//` comment after a `;`, on a line of its own inside a block or after the last rule. These stay PostCSS's located `Unknown word`, with no UXD code and no fix. The README and the CHANGELOG say so. Please accept the limitation; MIG-B9-15 documents it.
8. **F3: PostCSS chains.** `uxdsl/postcss` checks the stylesheet in its `Once` listener, and PostCSS runs every plugin's `Once` before any visitor. So syntax another plugin resolves in a visitor fails as `UXD_SASS_CONTEXT`, in either plugin order: postcss-nested 7.0.2's `&_title`, postcss-simple-vars 7.0.1's `$gap`.
   - All four combinations compiled on `ed498e3`.
   - `tailwindcss/nesting`, which wraps postcss-nested, was not tried.
   - The CHANGELOG, the migration guide and the README give the workaround: a PostCSS pass of its own, or a `.uxdsl` file through `compile()`.

   Options:
   - (a) accept it;
   - (b) move `uxdsl`'s steps to `OnceExit`, which changes plugin order;
   - (c) make these cases a warning, which narrows DEC-05.
9. **RR-2.** A `//` Dart Sass prints into a non-custom value (`string.unquote("a // c")`) is read as a comment and gets the plugin-alone message, which tells the author to use `compile()`. The plugin cannot tell that it runs inside `compile()`. Documented and pinned (`sass-pipeline.test.js`).
10. **DEC-02 partly regresses through `compile()`.** `palete(primary.main)`, `pallete(…)` and `pallet(…)` become Dart Sass's `UXD_SASS: expected "(".`: still located, but without "did you mean". Dart Sass parses `primary.main` as a module member before the plugin runs.

    The fix belongs in `protect.ts` (MIG-B9-11's module, outside Owns and Shares): treat a near-miss call whose argument Sass cannot parse as a kept token. Through `uxdsl/postcss`, all 11 near-misses keep `UXD_FUNCTION_UNKNOWN`. Decide whether this waits for a follow-up story (below) or comes here, widening Shares.
11. **Location precision is "where Dart Sass mapped the text",** not the token's column:
    - the start of the declaration or at-rule (`heavy.uxdsl:18:66`, where `space(404)` is column 73);
    - or, for a value Sass copied, where it was written: a `$variable`'s definition (`1:7`), an `@include` argument (`4:17`).

    Consequences: the CLI's partial test moved from `3:12` to `3:3`; 10 carets in the `/docs/diagnostics` captures moved; MIG-B6-13's "the consuming declaration, not the definition" now reads "the definition". Searching from the mapped start for the token would give `18:73`, against T3's and S-3's `18:66`. Please confirm.
12. **The anonymous source and `dependencies`.**
    - `compile({ source })` without `from` keeps its behavior: `<css input>`, relative loads from the working directory, never a dependency. A hidden `<cwd>/__uxdsl_css_input__.uxdsl` serves as the Sass entry.
    - `compile({ source, from })` lists `from` first in `dependencies` even when the file does not exist (P4 read literally); MIG-B6-18's `[]` changed.
13. **The extension of `entry` or `from` decides how the text is read.** `.css`, `.scss` and `.sass` are read as written, so a webpack rule that applies `uxdsl/webpack` to `.css` files, or `uxdsl build --entry x.css`, loses UXDSL's dotted tokens (`UXD_SASS`). Neither setup is documented. MIG-B9-15 documents it.
14. **Sass's import rules are breaking.**
    - An `@import` with a media query, `layer()`, `supports()` or `url()` stays a plain CSS `@import`, even for a `.uxdsl` target, so a CLI build silently ships a URL no browser can load.
    - `@import "x.css"` is not inlined.
    - A file `@import`ed twice is emitted twice.

    Proposed: a CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the output (MIG-B9-14).
15. **The cascade and nesting changes,** in the CHANGELOG as visual changes:
    - a rule nested after `@ds-button` or `@ds-input` now follows the generated state rules and wins ties;
    - responsive `@media` blocks follow their flat rule;
    - flattened nesting changes rendering in three patterns;
    - a double `@import` re-applies.

    All are now checked in Chrome by `fixtures/mig-b9-13-compile-on-sass/browser.js` (13 checks, 7 of them fail on `ed498e3`'s build). In the playground, one moved rule swaps with another on a shared property: `.ai-submit-btn:disabled` against the generated selected state, on `color`. That affects only a disabled and selected button, which `AIPrompt.tsx` never renders. Please confirm.
16. **RussianDoll.uxdsl is emitted twice in the playground,** because it is imported by both `app.uxdsl` and the generated entry. It is harmless by specificity: the other rules for those classes are scoped under `#DemoDensity` and `#DemoSpacing`. Fixing it is a playground generator change (MIG-B9-22 or a playground story).
17. **SO-4 and RR-2: text Dart Sass prints from a string that is not CSS fails as PostCSS's own located error, with no UXD code.** The cases:
    - a colon outside parentheses and strings in a non-custom value (`Missed semicolon`; the base rejected it too);
    - a `;` or a brace;
    - an unclosed comment, string or bracket in a declaration.

    Both remedies depart from the design, so they are the owner's call:
    - parse Sass's output with a PostCSS `Parser` subclass whose `checkMissedSemicolon` does nothing (against P1's "PostCSS's default parser");
    - rewrite the error's reason (against Q2's "reason kept").
18. **Shares as delivered:** the files edited outside Owns and Shares, listed in §14. They include MIG-B9-12's `compile-sass.test.js` (one assertion, owner `core`), MIG-B9-14's `cli/error-location.test.js`, the root `package.json` test script, and the playground's `paradigm/frame.uxdsl`, `capture-capabilities.js` and `DiagnosticsCaptures.tsx`.
19. **Inputs this run contradicted:**
    - §4's recorded corpus baseline: the base fails inside postcss-import.
    - §5's "must stay byte-identical" list.
    - The 2026-10-11 review's claim that `watch-mode`, `vite` and `webpack` tests need edits here: they pass unchanged.
    - The scout's "UX-20 passes unchanged": as written it throws on Sass's expanded layout.
    - MIG-B9-12's "sources relative to `dirname(to)`": absolute stage sources need no rebasing.
    - `run.js`'s deprecation line printed Sass's capped counts as if they were totals.
    - AC6 already passed on the base.
    - The run's own figures, corrected in §14 (F6):
      - `uxdsl.css` is 337,214 bytes, not 337,208;
      - the base file has 8,072 lines, not 8,073;
      - the scout's "240 hunks" are 60 (195 with `-U0`);
      - there were 57 look-alikes then, and there are 63 now;
      - the design's "about 1.40× Dart Sass with maps" is 1.52×.
20. **Windows is unverified.** CI runs on ubuntu. LM-3's fix was emulated on POSIX by giving the stage map drive-letter sources; on win32, PostCSS's own `origin()` would see a `/C:/…` file that `compile()` replaces from its locator, which is reasoned, not observed.

**Follow-ups, by story:**

- **MIG-B9-14:**
  - **The `/docs/diagnostics` capture of `UXD_FUNCTION_SHADOWED`.** The CLI destructures only `{ css, map, dependencies }` from `compile()` and prints no warning, and `capture-capabilities.js` requires a failing exit.
  - **Located warnings in the adapters.** Vite's `this.warn(text)` and webpack's `emitWarning` drop the located file, line and column.
  - **The CLI's output format.**
    - Dart Sass's CLI ends its output with a newline, while `compile()` and `uxdsl build` do not.
    - Dart Sass writes `@charset "UTF-8"` for any non-ASCII text, comments included, which matters to bundlers that concatenate modules.
  - **A warning for a plain `@import` of `.uxdsl`, `.scss` or `.sass` left in the output** (flag 14).
  - **Sass's warnings lost when the plugin throws** after Sass succeeded (`UXD_FUNCTION_SHADOWED` included; MIG-B9-12's LOC-5). `error.warnings` would be a non-breaking addition.
  - **The playground build's 53 Sass warnings print once the CLI prints warnings:** 42 `[import]`, and 11 `You probably don't mean to use the color value … in interpolation here` from `DemoColors.uxdsl:104`.
  - **The `UXD_SASS` capture prints one line with no frame;** A1 prints Sass's frame.
  - **`bin/uxdsl.js:710-711` still names `postcss-scss`, `postcss-import` and the SCSS subset.**
  - **The playground's `generate-uxdsl-entry.js` writes `@import`s** (§6: `generate-entry` with `@use`).
- **MIG-B9-15:**
  - `packages/uxdsl/docs/integrations/compile.md` still describes the subset: its "The SCSS subset" section, the `@import` and cycle bullets, `UXD_IMPORT_CYCLE`, and the "without `to`" claim. When it is rewritten, AGENTS.md's sentence "`compile.md` still describes the SCSS subset it replaced" changes with it.
  - `docs/integrations/vite.md`'s "### No SCSS pre-pass" is inaccurate.
  - The playground's language page is stale: `src/app/docs/language/page.tsx:108` ("The standalone PostCSS plugin reads plain CSS with $variables at the root of a file.") and `:125–126` (retired codes). So is the introduction page, `src/app/docs/introduction/page.mdx:34`.
  - Document:
    - the extension rule (flag 13);
    - Sass's import rules;
    - the forms PostCSS's parser rejects first (flag 7);
    - what is not detected: global Sass functions, `url($x)` where Sass evaluates the call, `#{…}` in a string, and `--y: a$v` (a `$` glued to a word passes);
    - the `\$name` escape and its caveat (flag 6);
    - the non-CSS text shapes (flag 17).
- **MIG-B9-21:**
  - `compile()` ignores an unknown top-level config key silently, so a top-level `silenceDeprecations` does nothing. A generic unknown-key check belongs here.
  - The double theme discovery: `compile()` discovers for `reserved`, then the plugin discovers again (K3).
- **MIG-B9-22, or a playground story:** RussianDoll's double `@import` (flag 16).
- **A MIG-B9-11 follow-up story (protect):** dotted near-misses (flag 10). This joins MIG-B9-12's list of protect follow-ups.
- **MIG-B9-91 and MIG-B9-52:**
  - Windows verification of `finalMap` and `chainable` (flag 20).
  - The playground's lockfile still records `postcss-import` and `postcss-scss` for `../uxdsl`; `npm ci` there passes.
  - T14's negative control assumes PostCSS 8.5.16 or later: on 8.4.31 it reads 18:64 instead of 18:65, while `compile()` reads 18:66 on both.
  - The P10 decision (flag 1).
  - The install count is now 20 packages (MIG-B9-12 recorded 30 with `postcss-import` and `postcss-scss`).
- **A new S story beside MIG-B9-32 to 34,** serialized on `theme-validate.ts` by §7: `validateTheme` accepts a theme value with an unclosed comment (`red /* oops`) or string (`'Inter, sans-serif`). It fails later as PostCSS's parse error in the generated theme CSS, under `<css input>:line:column`, as on `ed498e3`, and the CLI frames it with a 10,000-character line. A validator rule could name the key path.

**Closed here, from MIG-B9-12's follow-ups:**
- `sourceMap: true` on every build;
- `originalPositionFor` instead of +1;
- P3 without `UXD_RESERVED_NAME`, and `UXD_FUNCTION_SHADOWED` moved to `core`;
- the playground's core group retitled;
- `compile({ source })` without `from` decided;
- the missing-`@use` todo rewritten, with `silenceDeprecations` under `sass`;
- P9's chaining, by absolute stage sources;
- P10's Bootstrap figures on `sass` 1.107.0: 92 files, 330 deprecations delivered as 21 warnings;
- P7 (Q9): a local `.css` imported with its extension reaches the browser without UXDSL processing.

The `UXD_FUNCTION_SHADOWED` capture stays open for MIG-B9-14.

**No action, recorded:**
- **The tool inputs of this run's agents turned some `\u` escapes into raw characters.** This is the likely origin of RR-1's raw U+FFFF. `compiler-structure.test.js` now scans `packages/uxdsl/src` for noncharacters; tests, docs and fixtures are not scanned.
- **A `//color: blue;` line parses as a declaration named `//color`.** A browser drops it, as Dart Sass drops the comment, so it is left as is.
- **`@-moz-document url-prefix($v)` never reaches the plugin through `compile()`.** It is a Dart Sass error (`Expected string.`).
- **MIG-B9-12's orphan process, PID 85045,** was gone when this run started.

### Owner decision of 2026-11-02

The owner answered one question about flag 1 above, after the delivery and before the merge. The owner writes in Spanish; this record is in English. Where it differs from this story's contract, it rules.

- **The question:** how to resolve AC1, this story's time budget, before merging #63.
- **Decided: merge now, and do the performance work after** (the option recommended to the owner):
  - PR #63 is merged into `feat/beta9` with AC1 recorded as not met on its timing half. The corpus stayed byte-identical: every delivery run printed `byte-identical: true`. The ratio was over 1.5× on four of the six delivery runs, three of them in a row (flag 1).
  - P10's 1.5× budget is carried by [MIG-B9-23](MIG-B9-23-compile-within-budget.md). That performance story brings the corpus to at most 1.5× and must pass before `0.5.0-beta.9` is published. In the option's words, it would cover the Sass stage, the plugin's fixed costs and the double theme discovery (K3).
  - The merge unblocks MIG-B9-14 and MIG-B9-15.
- **Not chosen:**
  - the performance work inside this story, on its branch, before merging;
  - restating P10 and merging: for example a budget of 1.75× on a local machine, or 1.5× asserted only in CI, where the gate's S-1 reported 1.09×.
- **The merge:** PR #63 was merged into `feat/beta9` as `7aec3e0` on 2026-11-02 (02:30 UTC on 2026-11-03).
- **Still open.** This answers flag 1. The other owner flags of "Delivery of 2026-11-02" stay open, and this answer decides none of them:
  - 2: P1 as built (RR-4);
  - 3: LM-2, P9 against "equal to Dart Sass's output";
  - 4: "must stay byte-identical" restated;
  - 5: DEC-05 applied beyond its enumerated text;
  - 6: an error, not a warning, for a `$variable` Sass keeps;
  - 7: CT-5, the Sass PostCSS's own parser rejects first;
  - 8: F3, PostCSS chains;
  - 9: RR-2, a `//` Dart Sass prints into a value;
  - 10: DEC-02 partly regresses through `compile()`;
  - 11: location precision;
  - 12: the anonymous source and `dependencies`;
  - 13: the extension of `entry` or `from` decides how the text is read;
  - 14: Sass's import rules are breaking;
  - 15: the cascade and nesting changes;
  - 16: RussianDoll.uxdsl emitted twice in the playground;
  - 17: SO-4 and RR-2, text Dart Sass prints that is not CSS;
  - 18: Shares as delivered;
  - 19: the inputs this run contradicted;
  - 20: Windows is unverified.

### Owner decisions of 2026-11-04

The owner decided the flags the decision of 2026-11-02 left open (2 to 20) on 2026-11-04. The owner was given 19 numbered recommendations, in Spanish, and answered, verbatim, "voy a seguir todas tus recomendciones" ("I will follow all your recommendations"): each recommendation is the owner's decision of 2026-11-04, recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-04). This record is in English and lists those that concern this story. Where they differ from this story's contract, they rule.

- **Accepted as delivered (decision D18 of 2026-11-04):** flags 2, 3, 4, 5, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18 and 19. Flag 1 was decided on 2026-11-02 (above). For flag 14, the proposed CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL stays with MIG-B9-14.
- **Flag 6 (decision D6 of 2026-11-04):** a `$variable` Dart Sass keeps as written stays an error (`UXD_SASS_CONTEXT`), not a warning, which is the flag's option (a); a literal `$identifier` cannot be emitted except through the `\$` escape. MIG-B9-15 documents the limitation and the escape's caveat.
- **Flag 8, F3 (decision D7 of 2026-11-04):** `uxdsl/postcss` after postcss-nested or postcss-simple-vars failing, in either order, is accepted as documented for now (the flag's option (a)). MIG-B9-27 is registered, "`uxdsl/postcss` in a PostCSS chain: run the Sass-syntax checks at `OnceExit` if that keeps every contract" (S, wave 2, after MIG-B9-21, since it edits `plugin.ts`); it is a narrower form of the flag's option (b), in which only the Sass-syntax checks move, and only if every contract holds. It also verifies `tailwindcss/nesting`.
- **Flag 10 (decision D5 of 2026-11-04):** MIG-B9-26 is registered to answer it, "Dotted near-misses keep DEC-02's "did you mean" through `compile()`; Sass's `@debug` reaches the build as a warning" (S, wave 2, after MIG-B9-14, which makes the CLI print `compile()`'s warnings). The flag's own question, whether the fix waits for a follow-up story or comes here, is answered: it waits for MIG-B9-26.
- **Flag 20 (decision D11 of 2026-11-04):** CI runs on Windows before the release. MIG-B9-28 is registered, "CI on Windows" (wave 2; its scout sizes it, S or split, since the suites may assume POSIX paths), and MIG-B9-91 depends on it.
