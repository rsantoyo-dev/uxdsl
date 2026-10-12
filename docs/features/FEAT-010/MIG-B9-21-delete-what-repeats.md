# MIG-B9-21 — Delete what repeats

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | None (`uxdsl/engine` is exempt from semver by contract; nothing semver-bound is removed) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-13 |
| Blocks | — |
| Base | `feat/beta9` after MIG-B9-13 |
| Owns | `packages/uxdsl/src/default-theme.ts`, `base-theme.ts`, `ds-runtime/breakpoints.ts`, `entries/engine.ts`, `reference-integrity.ts` (the `!important` comparator), `scripts/measure-exports.js` (new) |
| Shares | `packages/uxdsl/src/compile.ts`, `vite.ts`, `webpack.ts`, `plugin.ts` (comments and `REMOVED_OPTIONS`), `bin/uxdsl.js` (comments), `scripts/verify-docs-update.js`, `packages/uxdsl/CHANGELOG.md` |
| Output impact | API (`uxdsl/engine`, semver-exempt): exports with no consumer removed |

## 1. Goal

The package has one of each thing and says what it does, not how it got
there: one theme resolution per compilation, no re-export files that exist for
history, no engine export nobody calls, no comment that narrates a story id.
Every deletion is measured and every behavior kept is pinned by a test that
already exists.

## 2. Sources

- DEC-00: "La teoría es sencilla, así que en lo posible es simplificar el
  código al máximo".
- Measured on `main` (2026-10-11): `packages/uxdsl/src` is 7,191 lines in 41
  files; `bin/uxdsl.js` is 2,170 lines; `default-theme.ts` is 54 lines of
  which 40 are a history comment; `base-theme.ts` 54 lines of which 45 are
  comment; `ds-runtime/breakpoints.ts` is one re-export line; theme-file
  discovery is called from `plugin.ts` (`discoverThemeSync`), `vite.ts` and
  `webpack.ts` (`discoverThemeAsync`) and the CLI (`loadConfig`, through the
  same `config.ts` functions).
- `plugin.ts` `REMOVED_OPTIONS` still warns for `themeVar`, `spaceVar`,
  `colorVar` (removed in beta.1) and `breakpoints` (removed in the stability
  work that beta.8 did not ship).
- FEAT-009 R-16 / MIG-B7-10: "The `!important` term of the comparator in
  `resolve()` in `reference-integrity.ts` is demonstrably dead code, left so
  on purpose because fixing it would change semantics" (now in
  `reference-core.ts`: `Number(a.node.important) - Number(b.node.important)`
  with a comment that `Number(undefined)` is `NaN` and "that quirk decides
  real orderings today").
- `uxdsl/engine` (`entries/engine.ts`) re-exports every engine, the generator,
  the validator, the contrast checker, the structure gate, the reference
  checker and the serializers. Who uses what is not recorded anywhere.

## 3. Preconditions

```bash
grep -q "compileSassStage" packages/uxdsl/src/compile.ts
test -f packages/uxdsl/src/ds-runtime/breakpoints.ts
grep -c "MIG-B\|FEAT-0\|stability phase" packages/uxdsl/src/*.ts packages/uxdsl/src/*/*.ts packages/uxdsl/bin/uxdsl.js | awk -F: '{s+=$2} END {print s}'   # record the count
```

## 4. Baseline

```bash
wc -l packages/uxdsl/src/*.ts packages/uxdsl/src/*/*.ts packages/uxdsl/bin/uxdsl.js | tail -1
```

Recorded: the total line count before the story.

## 5. Contract

- **K1 — Measure first.** `scripts/measure-exports.js` lists every export of
  `uxdsl/engine`, `uxdsl/language`, `uxdsl/theme`, `uxdsl/runtime`, `uxdsl`
  and `uxdsl/config` with its consumers outside `packages/uxdsl/test`
  (searched in `packages/uxdsl/src`, `packages/uxdsl/bin`,
  `packages/playground-nextjs/src` and `scripts`, `packages/uxdsl-vscode/src`,
  `fixtures/**` excluding `node_modules`), and prints the ones with zero
  consumers. The script is committed and its output is in the PR body.
- **K2 — Delete from `uxdsl/engine` only.** An export of `uxdsl/engine` with
  zero consumers (K1) is removed from `entries/engine.ts`; if nothing inside
  the package uses the implementation either, the implementation goes too. No
  export of a semver-bound entry (`uxdsl`, `uxdsl/postcss`, `uxdsl/runtime`,
  `uxdsl/theme`, `uxdsl/language`, `uxdsl/config`) is removed; a dead one
  there is listed in §15 for 1.0.
- **K3 — One theme resolution per compilation.** `compile()` accepts
  `configRoot` and `discoverTheme` (the adapters' options today) and performs
  discovery once, adding the theme file's own require tree to `dependencies`;
  `vite.ts` and `webpack.ts` pass those options through instead of
  discovering themselves; the plugin keeps discovery for the standalone path
  (a `.css` file in a host's PostCSS) and skips it when `theme` is given, as
  today. Net lines must go down; if they do not, K3 is dropped and the reason
  recorded.
- **K4 — Re-export files.** `ds-runtime/breakpoints.ts` is deleted and its
  one importer (if any) imports from `language.ts`. `default-theme.ts` and
  `base-theme.ts` stay two files (the import graph needs the leaf) with
  three-line contract comments each.
- **K5 — Old option warnings.** `REMOVED_OPTIONS` keeps `breakpoints` (a
  beta.8 project may pass it) and `includeTheme` (MIG-B9-20); `themeVar`,
  `spaceVar`, `colorVar` are deleted with their test cases
  (`removed-options.test.js` updated).
- **K6 — The dead comparator term.** `reference-core.ts`'s `resolve()`: the
  `important` term is either made real (a declaration with `!important` wins
  over a later one without; a test proves it on a theme override) or removed
  with its comment, whichever the reference-integrity equivalence oracle
  (`test/reference-integrity-equivalence.test.js`, `test/fixtures/reference-integrity-oracle.js`)
  accepts without a change. The choice and its proof are recorded in §14.
- **K7 — Comments describe behavior.** In `packages/uxdsl/src/**/*.ts` and
  `bin/uxdsl.js`, no comment names a story id (`MIG-`, `FEAT-`), a phase
  ("stability phase"), a date, or what the code used to do. Each file's
  header states what the module is for and what it guarantees. Tests keep
  story ids in their titles. Rule for rewriting: keep the sentence that
  states a contract or a non-obvious reason; delete the sentence that
  narrates.
- **K8 — Nothing else changes.** Compiled output, the theme CSS, the
  diagnostics, the CLI's output text, every test's assertion.

Must stay byte-identical: every parity oracle; the gate's outputs; the
contrast baseline.

## 6. Out of scope

- Splitting `bin/uxdsl.js` into modules: it changes nothing observable and
  risks regressions; after 1.0.
- Deleting removed-command/config-key errors in the CLI (`REMOVED_COMMANDS`,
  `REMOVED_CONFIG_KEYS`): they serve beta.8 users for this release.

## 7. Approach and traps

- Run K1 before touching anything and paste the list in the PR description;
  the reviewer judges deletions against it.
- The playground imports from `uxdsl/engine` for its demos (the capability
  matrix says the Button and Input demos render through `buttonComponentCss`
  and `inputComponentCss`); the vscode extension imports completion data; the
  gate imports `checkThemeContrast`. K1's search must include
  `packages/playground-nextjs/src/**/*.{ts,tsx,mdx}` and the fixtures.
- Comment rewriting is done file by file with the tests running after each
  file; a comment that explains a trap (for example `base-theme.ts`'s reason
  for freezing a clone) keeps the reason in one sentence.
- Stop rule: a deletion that makes any test fail is reverted, not patched
  around; the test documents a consumer K1 missed, and that goes to §15.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `scripts/measure-exports.test.js` (new) | `MIG-B9-21: measure-exports lists the engine's exports and finds a planted consumer` | unit | K1 | a planted unused export is reported |
| T2 | `test/entries.test.js` | updated to the kept export lists | unit | K2 | — |
| T3 | `test/vite/index.test.js`, `test/webpack/loader.test.js` | discovery tests keep passing with `configRoot` passed to `compile()` | unit | K3 | — |
| T4 | `test/removed-options.test.js` | `breakpoints` and `includeTheme` warn; the three `*Var` options are plain unknown options | unit | K5 | — |
| T5 | `test/reference-integrity-equivalence.test.js`, `test/reference-integrity.test.js` | the oracle accepts the comparator decision; a new test pins it | unit | K6 | — |
| T6 | `scripts/no-history-comments.test.js` (new) | `MIG-B9-21: no source comment under packages/uxdsl/src or bin names a story id, a phase or a date` | unit | K7 | a planted `// MIG-B6-17:` comment fails it |
| T7 | `fixtures/parity/run.js`, `npm test`, `verify:1.0` | unchanged outputs | all | K8 | — |

## 9. Acceptance criteria

- **AC1** `node scripts/measure-exports.js` runs and its output is in the PR;
  every removed export appears in it with zero consumers.
- **AC2** `node --test scripts/no-history-comments.test.js` exits 0.
- **AC3** `wc -l` of §4 is lower than the baseline; the PR body has the
  before/after table per file.
- **AC4** `node fixtures/parity/run.js` exits 0 without `--update`;
  `npm test` exits 0; `npm run verify:1.0 -- --skip-playground-walk` exits 0.
- **AC5** `test ! -f packages/uxdsl/src/ds-runtime/breakpoints.ts` and the
  file is removed from `scripts/verify-docs-update.js`.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes (`### Removed` under `uxdsl/engine`, the three option warnings) |
| package README | yes (the guard) |
| `verify-docs-update.js` classification | yes (`breakpoints.ts` removed) |
| `AGENTS.md` | yes if an engine function it names was removed |
| everything else | no |

## 11. Documentation

`packages/uxdsl/CHANGELOG.md`; `docs/architecture/unified-engine-audit.md`
if ownership text changes; `AGENTS.md` only where it names a removed export.

## 12. Verification

```bash
node scripts/measure-exports.js                      # list; exit 0
node --test scripts/no-history-comments.test.js      # exit 0
node fixtures/parity/run.js                          # exit 0
npm test                                             # background; exit 0
npm run verify:1.0 -- --skip-playground-walk         # background; exit 0
```

## 13. Delivery

Branch `feat/b9-21-delete-what-repeats`. Commit:
`refactor(FEAT-010): MIG-B9-21 - one theme resolution per compilation, unused engine exports and re-export files deleted, comments state behavior`.

## 14. Closure record

To be filled in the delivering PR, with the before/after line table and the
K6 decision.

## 15. Findings and follow-ups

Dead exports of semver-bound entries found by K1 are listed here for 1.0.
