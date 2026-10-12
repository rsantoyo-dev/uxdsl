# MIG-B9-13 — `compile()` on the new pipeline; the subset deleted

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 1 |
| Decision gate | DEC-01 (decided); DEC-05 (recommended: the PostCSS plugin alone compiles CSS plus UXDSL, without `$variables`) |
| Status | Blocked (DEC-05) |
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

To be filled in the delivering PR, including the playground build time before
and after and the `uxdsl.css` diff summary.

## 15. Findings and follow-ups

None yet.
