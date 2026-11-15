# MIG-B9-21 — Delete what repeats

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | None (`uxdsl/engine` is exempt from semver by contract; nothing semver-bound is removed) |
| Status | In review (PR #92) |
| Size | M |
| Depends on | MIG-B9-13; MIG-B9-20 (merged, PR #88), whose CLI hint decision 8 of 2026-11-13 has this story reword (§15) |
| Blocks | — |
| Base | `feat/beta9` after MIG-B9-13 and MIG-B9-20 (`cc10de6` or later) |
| Owns | `packages/uxdsl/src/default-theme.ts`, `base-theme.ts`, `ds-runtime/breakpoints.ts`, `entries/engine.ts`, `reference-core.ts` (the `!important` comparator), `scripts/measure-exports.js` (new) |
| Shares | `packages/uxdsl/src/compile.ts`, `vite.ts`, `webpack.ts`, `plugin.ts` (comments and `REMOVED_OPTIONS`), `bin/uxdsl.js` (comments, and the "none" hint of `themeEmissionMessage`: decision 8 of 2026-11-13), `scripts/verify-docs-update.js`, `packages/uxdsl/CHANGELOG.md`; for decision 8 of 2026-11-13 (§15): `packages/uxdsl/test/cli/uxdsl-cli.test.js`, `packages/uxdsl/docs/integrations/cli.md`, `packages/playground-nextjs/src/generated/cli-captures.json` and `compiler-captures.json` (regenerated); under §15's Q1 (a), one sentence each in `packages/uxdsl/docs/integrations/cli.md`, `vite.md` and `webpack.md`; for the items decided before the story started (§15, "Facts re-measured on `d1e07a3`"): `packages/uxdsl/src/sass/compile-sass.ts` and `compile.ts` (`error.warnings`), `src/config.ts` (comments) and every other file under `packages/uxdsl/src/**` (K7, comments only; K2 drops `export` on types in `css-blocks.ts`, `language.ts`, `typography.ts`, `surfaces.ts`, `buttons.ts`, `inputs.ts` and `ds-runtime/contrast.ts`), `packages/uxdsl/docs/integrations/compile.md` (K3's options, its discovery passages, `error.warnings`), `packages/uxdsl/README.md` (the discovery passages K3 makes untrue, and the guard's sentence), the root `package.json` (two `scripts` tests added to `npm test`), `fixtures/parity/run.js` (compares the CLI's error part exactly), `docs/architecture/unified-engine-audit.md` (§11), and the tests `packages/uxdsl/test/cli/error-location.test.js`, `test/cli/plugin-option-parity.test.js`, `test/language.test.js`, `test/entries.test.js`, `test/reference-integrity.test.js`, `test/vite/index.test.js` and `test/webpack/loader.test.js`; new: `scripts/measure-exports.test.js`, `scripts/no-history-comments.test.js`, `packages/uxdsl/test/core/compile-discovery.test.js` and `test/core/compile-error-warnings.test.js` |
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

Delivered in PR #92, from `feat/b9-21-delete-what-repeats` into `feat/beta9`. This was an M engine story, so it went through the full flow (FEAT-010 §2, D1 of 2026-11-04): a scout, a design synthesis from two designers, two implementers, a review through three lenses (contract and tests, engine behaviour, docs and evidence), one fixer, a mutation re-review, and the deliverer. Where the delivered contract differs from §5, §15's blocks rule; the differences are listed below. Only the owner merges.

**Base and commits.** The base is `feat/beta9` at `d1e07a3`.

| Commit | Content |
| --- | --- |
| `a90042b` | §15 block "Facts re-measured on `d1e07a3`"; header Shares and README §7 rows for the decided items |
| `191df66` | K1: `scripts/measure-exports.js` and T1 |
| `fa6978f` | K2, K4, K6: the unused `uxdsl/engine` exports, `ds-runtime/breakpoints.ts` and the dead `!important` term removed |
| `63cd5ce` | K3: one theme resolution per compilation, in `compile()`; the adapters pass their root; the CLI passes `discoverTheme: false` |
| `4095c2b` | `error.warnings`; the CLI, Vite and webpack print a failed compile's warnings first; the parity and error-location narrowings |
| `0b49fba` | F8 hint and Q1 sentences; captures regenerated |
| `7ab1ff4` | K7, RR-1 and T6 |
| `e53333a` | `unified-engine-audit.md` ownership bullets |
| `29b126b` | Review fixes |
| `b1acabf` | Merge of `origin/feat/beta9` at `f6c009d` (PR #90, the owner's decisions of 2026-11-13; PR #91, MIG-B9-18) |

The merge had conflicts in three files, all documentation:
- this file's §15: `feat/beta9`'s "Owner decisions of 2026-11-13, on the open questions above" block was kept first, then this branch's re-measured facts;
- `packages/uxdsl/CHANGELOG.md`: both subsections were kept, MIG-B9-21's first as the newest, then MIG-B9-18's;
- FEAT-010 README §7: `feat/beta9`'s 19 and 06 were kept alongside this branch's 21 on the `bin/uxdsl.js`, `cli.md`, `compile.md` and Vite/webpack test rows.

`packages/uxdsl/README.md` merged cleanly.

**Environment.** macOS (Darwin 27), Node 20.19.0, npm 11.21.1, Dart Sass 1.107.0, PostCSS 8.5.31, Vite 7.3.7, webpack 5.111.1, TypeScript from `packages/uxdsl/node_modules`, Chrome 157.0.8103.51. `TMPDIR` pointed into the session scratchpad for every run.

**Failing first.** Each new test was shown failing on the base, or under a mutation of its fix, before its change. TAP logs are in the session scratchpad under `b9-21/i1`, `i2` and `fixer`.
- T1: `Cannot find module ./measure-exports`, with the script moved away.
- T2 (`entries.test.js`): the deepEqual showed `+ serializeBlock` on the base.
- T-K4: after `npm run clean && npm run build`, `require('dist/ds-runtime/breakpoints')` throws `Cannot find module`.
- T5 pins kept behaviour, so it passes on the base by design. Its discriminating half reports `UXD_REFERENCE_MISSING`. With the term made real (`!!a.node.important`), T5 and the oracle's `!important` case both fail.
- T3a/T3c (`core/compile-discovery.test.js`) failed on the base: `configRoot` was ignored and 9px was absent; the async theme factory was refused; the counters showed sync=2 where the target is async=1, sync=0.
- T3d failed with the working directory's 9px emitted.
- `plugin-option-parity` failed, naming the CLI's `["discoverTheme","configRoot"]`, until the CLI line and the list entry were in.
- T-EW1: `+ undefined` on the base. T-EW2 failed against the old bin, and T-EW3 against the old `vite.ts`/`webpack.ts`.
- `error-location`'s "never the importing file" failed once warnings printed, until its scoping.
- T-F8: the updated `NONE_WARNING` test and the new behavioural test both failed against the old hint (2 fail).
- T6: on `0b49fba`, before K7, it reported 82 hits on 69 distinct comment lines.
- The fixer's tests:
  - CT-1 fails under `stageWarnings(reported.report, [])`.
  - CT-3's lowercase control failed with `+ []`. With the rule made case-insensitive, the real scan then failed on `bin/uxdsl.js:547 mig-b2-05-release`.
  - CT-7's per-host control failed with Vite and webpack reporting `[]`.
- The mutation re-review confirmed every one of these fixes. It also showed that CT-6's `notEqual(-1)` guard fails when the CLI's error prefix is renamed, where the old slice passed vacuously.

**Commands.** Implementers (I1, I2), fixer, and deliverer on HEAD `b1acabf`.

| Who | Command | Exit | Result |
| --- | --- | --- | --- |
| I1 | gate c2, c3 (build, `npm test`, doc examples, language and agent-guide `--check`, parity, mig07-consumer) | 0 | green |
| I1 | K2 and K4+K6 steps, each from a clean `dist` (package suite, `shims.test.js`, playground build) | 0 | green; no stale `breakpoints.js` |
| I1 | gate c4 | 1 | only `watch-mode.test.js` timed out (load average 85–91); a rerun under load failed different tests |
| I1 | everything but watch-mode for c4; then `watch-mode.test.js` at load ~10 | 0; 0 | green; 37/37 |
| I1 | `node fixtures/parity/run.js` after `error.warnings`, before the narrowing | 1 | `[import-cycle] error message drifted` (two `[import]` warning lines ahead of an identical error: owner flag 2) |
| I1 | the same, after the narrowing | 0 | 10/10, `expected/` untouched |
| I1 | gate c5, `npm run verify:1.0 -- --skip-playground-walk`, captures `--check` | 0 | green; S-3 and S-4 ok; no capture change |
| I2 | T-F8 before and after the bin change | 1; 0 | 2 fail, then 2 pass |
| I2 | `capture-capabilities.js`, then `git diff -U0` | 0 | exactly `cli-captures.json:71/108` and `compiler-captures.json:384/400`; `--check` 0 |
| I2 | gate c6, c7 (adds `capability-matrix.test.js` and captures `--check`) | 0 | green, watch-mode included |
| I2 | comment-only check (TypeScript printer, `removeComments`) | 0 | 23 files comments-only; control DIFF |
| I2 | `npm run verify:1.0 -- --skip-playground-walk` | 0 | 71/71 |
| fixer | targeted tests; root `npm test`; doc examples; language and agent-guide `--check`; parity; mig07-consumer; comment-only check over 17 files | 0 | 1,611 pass, 0 fail; parity 10/10 |
| deliverer | `node scripts/measure-exports.js` | 0 | `uxdsl/engine: 134 exports (110 values, 24 types); 11 with zero consumers` |
| deliverer | `node --test scripts/no-history-comments.test.js` | 0 | 4 pass, 0 fail |
| deliverer | `wc -l` of §4 | 0 | 11,902 |
| deliverer | `node fixtures/parity/run.js` | 0 | `PASS: 10 parity case(s)` |
| deliverer | `npm test` (root, background, log in scratch) | 0 | 1,617 pass, 0 fail |
| deliverer | `npm run verify:1.0` (full: real Chrome, playground walk included) | 0 | `72/72 automated checks passed`; S-3, S-4, cssmod, DE-9 and B7-17E ok |
| deliverer | `test ! -f packages/uxdsl/src/ds-runtime/breakpoints.ts`; `grep -c ds-runtime/breakpoints scripts/verify-docs-update.js` | 0; 0 matches | AC5 |
| deliverer | `node fixtures/webpack-adapter/run.js`; `node fixtures/vite-adapter/run.js` | 0; 0 | All checks passed |
| deliverer | `npm run verify:cssmodules-build` (Chrome) | 0 | All checks passed |
| deliverer | `npm run verify:doc-examples` | 0 | 65 examples and 24 theme excerpts hold |
| deliverer | `node scripts/generate-language-artifacts.js --check`; `node scripts/generate-agent-guide.js --check` | 0; 0 | no drift |
| deliverer | `npm run verify:playground-browser` (Chrome) | 0 | `PASS: no console errors, no UXDSL warnings, no unresolved var(), visible keyboard focus, contrast page = Node.` |
| deliverer | `git diff --exit-code d1e07a3 -- fixtures/parity/expected fixtures/release-1.0/contrast-baseline.json` | 0 | byte-identical |

**AC3, `wc -l` of §4.** Base `d1e07a3`: **11,929**. HEAD: **11,902**, so −27. The total was 11,960 after I1's commits, 11,855 after K7, and 11,902 after the review's 12 module headers. Changed files:

| File | `d1e07a3` | HEAD |
| --- | ---: | ---: |
| `bin/uxdsl.js` | 2846 | 2844 |
| `src/base-theme.ts` | 54 | 21 |
| `src/buttons.ts` | 29 | 30 |
| `src/compile.ts` | 582 | 606 |
| `src/config.ts` | 287 | 288 |
| `src/control-engine.ts` | 233 | 235 |
| `src/default-theme.ts` | 54 | 30 |
| `src/diagnostics.ts` | 251 | 255 |
| `src/ds-runtime/breakpoints.ts` | 1 | deleted |
| `src/ds-runtime/contrast.ts` | 740 | 736 |
| `src/ds-runtime/theme-generator.ts` | 76 | 80 |
| `src/ds-runtime/theme-validate.ts` | 401 | 404 |
| `src/edges.ts` | 49 | 50 |
| `src/foundations.ts` | 82 | 85 |
| `src/inputs.ts` | 21 | 25 |
| `src/language.ts` | 534 | 531 |
| `src/naming.ts` | 75 | 68 |
| `src/plugin.ts` | 1003 | 1002 |
| `src/preset-engine.ts` | 73 | 71 |
| `src/reference-core.ts` | 394 | 387 |
| `src/sass/compile-sass.ts` | 1474 | 1493 |
| `src/shadows.ts` | 25 | 28 |
| `src/surfaces.ts` | 141 | 143 |
| `src/types.ts` | 229 | 228 |
| `src/typography.ts` | 104 | 108 |
| `src/vite.ts` | 245 | 237 |
| `src/webpack.ts` | 240 | 231 |
| **total** | **11,929** | **11,902** |

K3 alone, by `git diff --numstat` on `63cd5ce` over `compile.ts`, `vite.ts` and `webpack.ts`: +35/−50, net **−15**. K3 therefore stays. Discovery counts per compilation are now: `compile()` without `theme` makes 1 async and 0 sync discoveries (base: 2 sync); Vite, webpack and the CLI each make 1.

**K6 decision.** The `Number(a.node.important) - Number(b.node.important) ||` term was removed. PostCSS sets `important` to `true` or leaves it unset, and `Number(undefined)` is `NaN`, so the term always fell through. The equivalence oracle (`ORACLE_SHA256`, unchanged) passes with the term removed, as it did on the base. Making the term real fails its "important declared before a plain override" case (scout's scratch copies; reviewer mutation). The comment now states the behaviour: the definition that applies is the last one in document order, one on the context's own selector before one on `:root`, and `!important` takes no part. T5 pins this. The one edge is an `inspectDeclarationReferences` record with `important: false`. That function is engine-only, has no outside consumer, and no `src` caller builds such a record; its ordering is unchanged in practice.

**Contract as delivered, where it differs from §5, and why.**
- **K1.** `packages/_deprecated` was added to the roots (design decision Q-K1), because root `npm test` runs `shims.test.js`, which pins every `FORMER` name. In-package use by a module other than the defining file and `entries/` counts as a consumer: that is K1's root list read literally (Q-K1b).
- **K2.** 18 exports were removed: the value `serializeBlock`, whose implementation stays because `serializeBlocks` uses it, and 17 types. The design listed 16 types; `TypographyStyle` was also zero in the script, and the design said to follow the script. Types were un-exported by dropping `export` on their declarations; no barrel was rewritten (Q-K2b). `splitSelectorList` stays because `test/theme-blocks.test.js` imports it (§7 stop rule, Q-K2). No semver-bound entry lost a name, and their `.d.ts` files are byte-identical to the base.
- **K3.** As specified, plus owner flag 1 (a): the CLI passes `discoverTheme: false`, which fixes the working-directory theme leak. The fixer narrowed `configRoot`'s parity exemption to the CLI alone.
- **K4.** `test/language.test.js:26`'s first assertion now reads the same binding through `dist/entries/engine`. This is the one assertion edit AC5 forces.
- **K5.** Not applied as written. Decision 7 of 2026-11-13 keeps all five `REMOVED_OPTIONS` entries on four hosts, and owner decisions rule. T4 is the existing tests, unchanged, and §10's "the three option warnings" is not written. The review's "no silent ignore" holds because each option still warns. Owner flag 3 records the generic unknown-option warning as a follow-up.
- **K7.** Each file in scope has a purpose-and-guarantee header; the review added 12. T6 also covers review and audit ids, releases and story items, matches story ids case-insensitively, and skips a `fixtures/<name>` path only when that path exists. Narration words that state a contract about a removed name were kept by hand review. Three comments that were wrong about behaviour now match the code: bin's `strictTheme` block, `fonts.ts`'s plugin path, and `types.ts`'s `discoverTheme`.
- **K8 exceptions.**
  - the F8 hint (decision 8);
  - `err.warnings` and the warning lines printed before an error (decision of 2026-11-08);
  - the parity `runCli` narrowing and the `error-location` scoping (owner flag 2);
  - the `language.test.js` retarget (AC5);
  - the `configRoot` parity entry (K3);
  - `compile()` accepting an async theme factory (K3);
  - the CLI working-directory fix (owner flag 1).
- **F8.** The wording differs from decision 8's example, which decision 8 allows when review finds the example untrue. The example is untrue in two cases: (i) a missing `uxdsl-theme.uxdsl` fails the build with `UXD_SASS`, so the warning never prints; (ii) an older generated entry has no theme file. Two more cases show why the old hint does not work: (iii) a bare `uxdsl generate-entry` replays a recorded `--no-theme`; (iv) for an older entry at a non-default path, a bare run writes a new default entry and the configured one keeps warning.
- **`error.warnings`.** The plugin used alone keeps none, because the host's PostCSS runner owns the Result; this is a limit. No test covers watch mode printing a failed compile's warnings, and the CHANGELOG makes no such claim, though `buildOnce` is shared with watch mode.

**Review and outcome.** The review found 19 findings across three lenses. One was blocking (DE-1: K7's header clause unmet in 12 files). The should-fix findings were CT-1, CT-2, CT-3, CT-4, EB-1 and DE-2; the rest were nits. The fixer applied all 19 in `29b126b`; none was judged not real and none was left unapplied. DE-6 was applied with a different wording, because the reviewer's suggested sentence was false. The mutation re-review confirmed each new test fails without its fix and the comment-only check over the 17 changed files. It left one nit, RR-N1: an unreflowed 118-character comment line at `bin/uxdsl.js:756`, not fixed.

**Not run, and why.** Nothing in §12 or the delivery list was skipped. Windows is MIG-B9-28's. External validation in Press Craftor is the owner's step after beta.9 (D17 of 2026-11-04). CI results are on PR #92.

**Owner steps.** Answer owner flags 1–5 (§15, "Delivery of 2026-11-15") by exception. Merge PR #92 into `feat/beta9` once CI is green.

## 15. Findings and follow-ups

Dead exports of semver-bound entries found by K1 are listed here for 1.0.

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- K5 leaves `themeVar`, `spaceVar` and `colorVar` silently ignored: the plugin never warns about an option it does not know. Add one generic unknown-option warning instead of a list of removed names.
- `plugin.ts` is missing from this story's Shares and from README §7's row for it.

### Owner decisions of 2026-11-08 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-08). The owner was given numbered recommendations, in Spanish, on the owner flags of MIG-B9-14 and MIG-B9-15, and answered, verbatim, "todo como recomendado" ("everything as recommended"): each recommendation is the owner's decision of 2026-11-08. This record is in English and lists those that concern this story. Where they differ from this story's contract or from the review above, they rule.

- **`error.warnings` (the decision on MIG-B9-14's flag 11).** `error.warnings` goes to this story. Today it does not exist, so every host loses the warnings `compile()` produced before it threw, a Dart Sass deprecation printed before a UXDSL error included. MIG-B9-14 §15 proposed it for `compile.ts` and `compile-sass.ts`, and says that the CLI's printer is ready for it.
- **The files Dart Sass loaded, for information (the decision on MIG-B9-14's flag 16).** Flag 16 offered this story as the alternative to a new one, if `compile()` should put the files Dart Sass loaded on its error. The decision registers MIG-B9-39 instead, in which the adapters re-register the last good dependencies and `err.file`; MIG-B9-39 depends on this story.

A fact, not a decision: `compile-sass.ts` is in neither this story's Shares nor README §7's row for that file (MIG-B9-12, 23 and 26). Its `finish()` throws the Sass stage's error without the warnings Sass raised before it (line 664 at `4ecdc51`), so `error.warnings` likely needs that file. Listing this story on that row makes MIG-B9-23 and MIG-B9-26, later rows, wait for it (README §7).

### Owner decisions of 2026-11-13 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-13), as decision 8 of 2026-11-13. On 2026-11-10 the owner gave a standing instruction for FEAT-010, verbatim, "fusiona todo.. y preguntas como recomendadas, y sgeuimos" ("merge everything, and the questions as recommended, and let's keep going"). MIG-B9-20 was merged into `feat/beta9` as PR #88 (`cc10de6`) and left eight owner flags in its §15 ("Delivery of 2026-11-13"). They were not put to the owner one by one: under that instruction each recommendation is the owner's decision of 2026-11-13, and the owner may still override any of them. This record is in English and lists the decision that concerns this story. It adds two items to this story, because this story is the next one on `bin/uxdsl.js` and `packages/uxdsl/test/cli/**`. Where it differs from this story's contract or from an earlier block, it rules. Facts below were checked on `5a041fc` (`feat/beta9` after MIG-B9-20, merged into `docs/b9-wave3-story-files`).

**Added item F8 — the CLI's "none" hint is reworded so that it is true in general (MIG-B9-20's flag F8, option (b); review finding HB-5).**

- What stays: the `UXD_THEME_MARKER`-coded text the CLI shares with Vite and webpack (`themeEmissionWarning` in `packages/uxdsl/src/compile.ts:562`, its "none" text at line 578). It stands as MIG-B9-20's M4, a recorded deviation from M4's literal sentence (review finding CT-3). The "many" hint is not part of the decision.
- The current text. `themeEmissionMessage` in `packages/uxdsl/bin/uxdsl.js` (lines 854–865) appends a hint to the shared text; the "none" hint is line 863:

  ```js
      : ' For an entry generate-entry wrote, run uxdsl generate-entry again.';
  ```

  The CLI prints it at the end of this line (`cli.md:399`):

  ```text
  [uxdsl] Warning: UXD_THEME_MARKER: no entry reaches `@uxdsl theme;`, so nothing this build writes defines the --uxdsl__ tokens its CSS references. Write `@uxdsl theme;` once, at the top level of the global stylesheet that defines them. For an entry generate-entry wrote, run uxdsl generate-entry again.
  ```
- The new text, as the decision gives it, "for example": `' An entry generate-entry wrote without --no-theme loads its theme file; run uxdsl generate-entry again if that file is missing.'`. This story writes that text unless its review finds it untrue for some entry; a different wording is recorded in §14 with the reason.
- Where the current hint is repeated, all of which change with it:
  - `packages/uxdsl/test/cli/uxdsl-cli.test.js:1325`, the constant `NONE_WARNING`, which the test `MIG-B9-20: a build with no marker warns once; with two emitters warns once; a marker in a *.module.css entry is an error` (line 1334) compares, and whose line 1340 restates the hint in an `assert.equal` literal.
  - `packages/uxdsl/docs/integrations/cli.md:399`, the example output.
  - `packages/playground-nextjs/src/generated/cli-captures.json:71` and `108`, and `packages/playground-nextjs/src/generated/compiler-captures.json:384` and `400`: `stderr` captured by `packages/playground-nextjs/scripts/capture-capabilities.js`, which writes both files (its lines 35 and 36). The decision names `cli-captures.json`; `compiler-captures.json` also holds the hint, and the same script regenerates both. `npm test` fails while they are stale (AGENTS.md).
  - The CHANGELOG: MIG-B9-20's subsection quotes the warning only up to "…" (`packages/uxdsl/CHANGELOG.md:65–67`), without the hint. This story's own subsection says that the hint changed.
- Unaffected, because they match the warning without its hint: `packages/uxdsl/test/cli/watch-mode.test.js:1483` and `1557`, and `fixtures/release-1.0/run.js:697`. The package README, `migration.md`, AGENTS.md and the generated agent guide do not quote the hint. The playground's `tooling/page.mdx` and `test/cli/init.test.js` contain "no entry reaches" but not the hint.
- K8 ("Nothing else changes", which lists "the CLI's output text") has one exception: this hint.
- A test pins it, with a negative control: the updated `NONE_WARNING` assertion fails with the current line 863.

**Added item RR-1 — the comment above `loadConfig`'s sourcemap validation (MIG-B9-20's review nit RR-1).**

- `packages/uxdsl/bin/uxdsl.js:341–343` on `5a041fc`:

  ```js
        // MIG-B6-21 (FEAT-008): validated here, naming the file, like entry and
        // outFile above — a typo'd value ('External', true) must fail loudly
        // rather than read as "no map" and leave the user hunting for one.
  ```

- The `MIG-B6-21 (FEAT-008):` prefix is dropped; the sentence states a reason and stays (K7's rule).
- K7 already covers it, and T6 fails on it: no comment in `bin/uxdsl.js` may name a story id. RR-1 names it so that it is not missed. On `5a041fc`, 40 lines of `bin/uxdsl.js` match `MIG-B6-21\|FEAT-0\|MIG-B`, among them the other `MIG-B6-21` comments at lines 459, 515, 940, 955 and 1127. All of them are K7's.

**Size, Base and Shares.**

- The size stays M. F8 changes one message line, one test constant and its restated literal, one documentation line and two regenerated captures, and adds a CHANGELOG sentence. RR-1 is within K7.
- F8's hint exists only since MIG-B9-20, which is merged, so the story's base must include `cc10de6`. Every base of this story from now on does.
- The added item touches files outside this story's Shares: `packages/uxdsl/test/cli/uxdsl-cli.test.js`, `packages/uxdsl/docs/integrations/cli.md`, and `packages/playground-nextjs/src/generated/{cli,compiler}-captures.json`. Its `bin/uxdsl.js` entry also covers the message, not only comments.
- In the index's §7, those files are on the rows for `packages/uxdsl/test/cli/**`, `cli.md` and `packages/playground-nextjs/**`. Several stories that come after this story in the index's §5 are on those rows, among them MIG-B9-16 (`packages/playground-nextjs/**`), MIG-B9-25 and 28 (`test/cli/**`) and MIG-B9-17 (`test/cli/**`, `cli.md`). Who waits for whom is set when the header's Shares and the index follow, before the story starts. This block does not edit either.

### Open questions for the owner (answer before implementing)

Raised by the review of the decisions of 2026-11-13, on `5a041fc`. Under the owner's standing instruction of 2026-11-10 (FEAT-010 §2, the lead-in to decisions 33 to 37), each question is answered with its recommended option unless the owner overrides it. This story's header Shares and the index's §7 rows already follow the option each question assumes.

1. **Q1 — Who documents the out-of-band case of decision 2 of 2026-11-13.** Decision 2 (MIG-B9-20's flag F2, option (a)) keeps the "none" warning for a project that delivers its theme out of band (SSR `generateThemeCss`, `applyTheme`, another build) and documents the case. On `5a041fc` no shipped document states it: `cli.md:416` says "There is no switch to silence it.", and `vite.md:153` and `webpack.md:141` say "There is no switch to silence the warning." (FEAT-010 §2, the second fact under the decisions of 2026-11-13). No story is assigned the sentence.
   - (a) This story: one sentence next to each of those three lines, with its F8 edit of `cli.md`. It adds `vite.md` and `webpack.md` to its Shares.
   - (b) MIG-B9-39, which already edits `cli.md`, `vite.md` and `webpack.md` (its Shares).
   - (c) MIG-B9-91 lists it among beta.9's known limitations in `docs/releases/0.5.0-beta.9.md`, and the three documents stay as they are.

   Recommendation: (a). This story already rewords the same warning's hint and edits `cli.md` for it, and the integration pages are where a user reads the warning. The header's Shares and the index assume (a) until the owner answers.
2. **Q2 — Who waits for whom on the files decision 8 of 2026-11-13 adds.** Decision 8 assigns the hint to this story as "the next story on `bin/uxdsl.js` and `packages/uxdsl/test/cli/**`". On `5a041fc` this story was on neither of those §7 rows, and in §5's order it comes before MIG-B9-16 and MIG-B9-25. With this story added to the rows for `packages/uxdsl/test/cli/**`, `cli.md` and `packages/playground-nextjs/**`, MIG-B9-25 (`uxdsl-cli.test.js`) and MIG-B9-16 (the playground) wait for it; neither did before. MIG-B9-17 and 28 already waited for it, through MIG-B9-26, which depends on this story. MIG-B9-26 waits for MIG-B9-16, 25 and this story either way, so either order serializes one S story behind or before this one.
   - (a) §5's order, as the index now has it: MIG-B9-25 and 16 wait for this story on those files.
   - (b) This story's row moves after MIG-B9-25's in §5, so it waits for MIG-B9-16 and 25 on those files, and MIG-B9-25 stays "early in wave 2" (decision D2 of 2026-11-04) ahead of it.

   Recommendation: (a). It keeps §5's order and makes decision 8's premise true; the critical path is the same under both, since MIG-B9-26 waits for all three stories. The index assumes (a) until the owner answers.

### Owner decisions of 2026-11-13, on the open questions above (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-13), as decisions 17 and 18 of 2026-11-13. PR #89 put Q1 and Q2 above to the owner as its questions 6 and 7. Under the owner's standing instruction of 2026-11-10, verbatim, "fusiona todo.. y preguntas como recomendadas, y sgeuimos" ("merge everything, and the questions as recommended, and let's keep going"), they were not put to the owner one by one: each recommended option is the owner's decision of 2026-11-13, and the owner may still override either. This record is in English. Both are the option this story's header and the index already assumed, so nothing changes; this story is being implemented with both applied.

- **Q1 (decision 17): (a).** This story writes one sentence next to each of the "no switch" lines of `cli.md` (`cli.md:416` on `5a041fc`), `vite.md` (`vite.md:153`) and `webpack.md` (`webpack.md:141`), documenting decision 2's out-of-band case (a theme delivered through SSR `generateThemeCss`, `applyTheme` or another build still warns "none"), with its F8 edit of `cli.md`. `vite.md` and `webpack.md` are in the header's Shares, as they already are on `d1e07a3`.
- **Q2 (decision 18): (a).** The index's §5 order stands: MIG-B9-25 and MIG-B9-16 wait for this story on `packages/uxdsl/test/cli/**` and `packages/playground-nextjs/**`.

For information, from the other decisions of the same list: MIG-B9-18 does not wait for this story (decision 15), and MIG-B9-39's split (decision 28) leaves MIG-B9-39 waiting for this story alone on its files (`vite.ts`, `webpack.ts`, `vite.md`, `webpack.md`), while MIG-B9-19, its CLI part, waits for it on `bin/uxdsl.js`, `test/cli/**`, `cli.md` and the playground.

### Facts re-measured on `d1e07a3` (2026-11-13)

Re-measured by the delivery's scout on `d1e07a3` (`feat/beta9` with waves 0 and 1 and MIG-B9-20, 22, 23 and 29 merged), before any code was written (README §1 item 4). Each item is a finding: the old line above stays as written, and this block gives the line as it stands on the base. None of them changes a contract line or an acceptance criterion.

- **§2, the size of the package.** Old: "`packages/uxdsl/src` is 7,191 lines in 41 files; `bin/uxdsl.js` is 2,170 lines". On `d1e07a3` the §4 baseline is **11,929** lines: 40 `.ts` files under `packages/uxdsl/src` totalling 9,083 lines, plus `bin/uxdsl.js` at 2,846. Why: measured on 2026-10-11; the Sass stage (`sass/compile-sass.ts` 1,474 lines, `sass/protect.ts` 622) and MIG-B9-20/22/23/29 landed since. AC3 is measured against 11,929.
- **§2, the two theme files.** Old: "`default-theme.ts` is 54 lines of which 40 are a history comment; `base-theme.ts` 54 lines of which 45 are comment". From the TypeScript AST on the base: `default-theme.ts` 54 lines, 41 of them comment (its 26-line header narrates history); `base-theme.ts` 54 lines, 41 of them comment.
- **Header Shares, §2 and K5, `REMOVED_OPTIONS`.** Old: "`plugin.ts` `REMOVED_OPTIONS` still warns for `themeVar`, `spaceVar`, `colorVar` … and `breakpoints`". On the base `REMOVED_OPTIONS` lives in `src/config.ts:266-272` with five entries (`breakpoints`, `themeVar`, `spaceVar`, `colorVar`, `includeTheme`); `removedOptionWarnings` (`config.ts:275-279`) builds the one `UXD_OPTION_REMOVED` template and `removedOptionsIn` (`config.ts:282-286`) is what `compile()` forwards to the plugin. The plugin (`plugin.ts:129`), Vite's `buildStart`, the webpack loader (once per compilation) and `compile()` all warn. Why: MIG-B9-20 moved the table and extended it to every host, which decision 7 of 2026-11-13 (its flag F7, option (a)) accepted for all five options. The tests that pin the three `*Var` warnings are `test/removed-options.test.js:61-66`, `test/theme-marker.test.js:279-285`, `test/vite/index.test.js:336-347`, `test/webpack/loader.test.js:436-447`, `test/cli/plugin-option-parity.test.js:56` and `test/types/removed.ts`. How K5 and T4 apply against decision 7 is recorded in §14.
- **K4, the importers of `ds-runtime/breakpoints.ts`.** Old: "its one importer (if any)". It has two: `src/compile.ts:56` and `src/plugin.ts:59`, both `import { DEFAULT_BREAKPOINTS } from './ds-runtime/breakpoints'`. A test requires it directly: `test/language.test.js:26`, in `shared module imports without a browser and preserves breakpoint compatibility export`. `scripts/verify-docs-update.js:124` classifies it. The path is not in the package's `exports` map. The package's `build` is plain `tsc` with no clean step, so a stale `dist/ds-runtime/breakpoints.js` survives locally after the source is deleted and keeps that test green; only a clean build (or a fresh CI checkout) shows the failure.
- **§15, owner decisions of 2026-11-08, the line of `finish()`.** Old: "line 664 at `4ecdc51`". On the base `finish()` starts at `src/sass/compile-sass.ts:717`, and line 719, `if (pass.failed) throw stageError(pass, pass.error as Sass.Exception);`, drops `pass.warns`. `compile.ts` has two more throw sites that drop warnings: line 182 (the Sass stage's error, rethrown, hidden for an anonymous source) and line 212 (`relocateError` for the PostCSS stage), by which time `stage.warnings` and the plugin's `result.warn` calls exist and are lost.
- **K1 and §7, the roots.** Old: "searched in `packages/uxdsl/src`, `packages/uxdsl/bin`, `packages/playground-nextjs/src` and `scripts`, `packages/uxdsl-vscode/src`, `fixtures/**`". Those roots miss a consumer of `uxdsl/engine`: `packages/_deprecated/postcss-uxdsl/ds-runtime.js` and `language.js` re-export `{ ...require('uxdsl/engine'), … }`, and `packages/_deprecated/shims.test.js`, which root `npm test` runs, asserts in `a shim keeps every name its package exported, except the internals dropped on purpose` that every name in its `FORMER` table stays exported unless listed in `DROPPED`. 13 of the engine's 15 zero-consumer values are in `FORMER`.
- **§8 T2 and §10, `test/entries.test.js`.** Old: "updated to the kept export lists". `entries.test.js` pins key lists only for `uxdsl`, `uxdsl/runtime`, `uxdsl/theme`, `uxdsl/language` and `uxdsl/config` (lines 65-91), plus binding identity across entries (lines 93-101). No test pins `uxdsl/engine`'s key list, so T2 adds one.
- **§15, decision 8 of 2026-11-13, F8's lines.** Verified, not stale: the hint at `bin/uxdsl.js:863`, `NONE_WARNING` at `uxdsl-cli.test.js:1325`, the test at 1334 and its restated literal at 1340, `cli.md:399`, `cli-captures.json:71` and `108`, `compiler-captures.json:384` and `400`, RR-1 at `bin/uxdsl.js:341-343`. 40 lines of `bin/uxdsl.js` match `MIG-B6-21\|FEAT-0\|MIG-B`; the `MIG-B6-21` comments are at lines 341, 459, 515, 940, 955 and 1127. The Q1 lines are also unchanged: `cli.md:416` ("There is no switch to silence it."), `vite.md:153` and `webpack.md:141` ("There is no switch to silence the warning.").
- **§3, the precondition count.** The third precondition prints **48** on the base (`bin/uxdsl.js` 41, `ds-runtime/contrast.ts` 4, `config.ts` 1, `ds-runtime/index.ts` 1, `ds-runtime/theme-validate.ts` 1). Its pattern is case-sensitive, so it misses the "Stability phase" lines (18 lines case-insensitively) and audit ids such as "audit T6" or "DE-7"; read through the TypeScript parser, 120 comment lines in 22 files are candidates for K7.
- **K3, where discovery runs today.** Without `theme`, `compile()` discovers twice per compilation, both times synchronously from `process.cwd()`: `reservedNames()` (`compile.ts:275`) discards the result's dependencies, and the plugin (`plugin.ts:107-116`) discovers again. Vite (`vite.ts:167-181`) and webpack (`webpack.ts:178-192`) each discover once per module, asynchronously, from their own root, and pass a defined `theme`. The CLI reads the theme once per build in `loadConfig` (`bin/uxdsl.js:417-421`), searching only the build config's directory; when that directory has no theme file it passes `theme: undefined`, and `compile()` then uses a theme file found in the working directory, silently (no "Theme config detected"), against `loadConfig`'s own comment. Reproduced: a working-directory `uxdsl.theme.json` with `spacing.2` set to `9px` is emitted for a config in another directory.

The files the decided items need, and the order on them, follow the header's Shares and README §7 from this block on (Q2 (a)): `src/sass/compile-sass.ts` (`error.warnings`); `src/config.ts` and the rest of `packages/uxdsl/src/**` for K7's comment-only edits; `docs/integrations/compile.md` (K3's options, its discovery passages and `error.warnings`); `packages/uxdsl/README.md`'s discovery passages, which K3 makes untrue; the root `package.json` (the two new `scripts` tests in `npm test`); `fixtures/parity/run.js` and `test/cli/error-location.test.js` (the CLI prints a failed entry's warnings before its error); and the tests named in the header.

### Delivery of 2026-11-15

Recorded by the deliverer of PR #92, on `b1acabf`.

**New facts.**
- `origin/feat/beta9` moved from `d1e07a3` to `f6c009d` during the delivery (PR #90 and PR #91) and was merged in. The conflicts were documentation only (§14).
- The `uxdsl` root entry's `DEFAULT_THEME` and `defineConfig` have no consumer in K1's roots. Other repositories, such as a project's `uxdsl.config.cjs`, are outside the roots.
- With `error.warnings` printed, the gate's S-4 output now carries the `[import]` deprecation before the error, and its verdict is still ok (72/72).
- `compile()` without `theme` discovers asynchronously, so it now accepts a theme file exporting an async function. The plugin used alone still refuses one.

**Dead exports of semver-bound entries, for 1.0.** None was removed (K2):
- `uxdsl/language`: `DIAGNOSTIC_CODES`;
- `uxdsl/theme`: `ContrastCheckedPair`, `ContrastExceptedPair`, `ContrastException`, `ContrastExceptionPattern`, `ContrastExceptionRecord`, `ContrastFailure`, `ContrastReport`, `ThemeValidationIssue`, `ThemeValidationResult`, `ValidateThemeOptions` (also exported by `uxdsl/engine`, which keeps them while `uxdsl/theme` does);
- `uxdsl`: `CompileInput`, `CompileResult`, `DEFAULT_THEME`, `defineConfig`;
- `uxdsl/config`: `DiscoveredTheme`, whose `references` member is always undefined.

**Kept in `uxdsl/engine`, for a later decision.**
- `splitSelectorList`: a test consumer (stop rule).
- The 13 values `packages/_deprecated/shims.test.js` `FORMER` pins, removable together with the shims: `DIAGNOSTIC_CODES`, `TOKEN_FUNCTION_CODES`, `typographyValueToCss`, `TYPOGRAPHY_CSS_PROPERTIES`, `edgeValueToCss`, `DEFAULT_SHADOWS`, `cloneThemeValue`, `THEME_SCHEMA_KEY`, `parseLiteralColor`, `relativeLuminance`, `contrastRatio`, `compositeOver`, `resolveExpression`.
- Exports used only inside `src`, kept under K1's literal roots (Q-K1b): `serializeBlocks`, `responsiveBlocks`, `blockDeclarations`, `foundationBlocks`, `generateFoundationCss`, `typographyBlocks`, `unknownFunctionMessage`, `inspectDeclarationReferences`, and the types `scripts/measure-exports.js` marks `SRC`.

**Press Craftor.** Nothing to change for this story. A read-only grep of `/Users/ricardosantoyo/Documents/projects/story-radar` (`.env*` and `node_modules` excluded) found:
- no import of `uxdsl/engine`, `ds-runtime/breakpoints` or any removed export or type;
- no `themeVar`, `spaceVar`, `colorVar`, `discoverTheme` or `configRoot`;
- nothing that reads the CLI's "no entry" hint, its `[uxdsl] Warning:`/`[uxdsl] Error:` lines or an error's `warnings`.

It is on the beta.8 packages: `postcss-uxdsl` with `theme` given through `postcss-uxdsl-source.cjs`, and the `uxdsl-cli` build with its config at the project root. With `theme` given, discovery does not run there. The working-directory fix cannot change its build, because its working directory is the config's directory. Its beta.9 migrations (the one package, a theme file next to the build config, `includeTheme`) belong to other stories. The owner patches it after beta.9 (D17 of 2026-11-04).

**Owner flags.** Each was implemented as its recommendation; answer by exception.
1. **CLI working-directory theme (K3 vs K8).**
   - (a) The CLI passes `discoverTheme: false`.
   - (b) Keep the leak and list both keys as unforwarded.
   - (c) Pass `configRoot` = the config's directory, which searches twice.

   Recommendation: (a), implemented. If (b) is chosen instead, it is a one-line revert plus the list entry.
2. **Warnings printed before an error vs frozen checks.**
   - (a) `fixtures/parity/run.js` compares the CLI output from `[uxdsl] Error:` on, still exactly, and `error-location.test.js` scopes its two `doesNotMatch` assertions to that part.
   - (b) No host prints.
   - (c) Re-record the oracles, which K8 forbids.

   Recommendation: (a), implemented.
3. **K5 vs decision 7 (informational).**
   - (a) Keep all five `REMOVED_OPTIONS`, with no generic warning here.
   - (b) Also add a generic unknown-option warning, a new `UXD_` code.
   - (c) Delete three and add the generic warning.

   Recommendation: (a).
4. **Shares extended** for the decided items (`a90042b`).
   - (a) Keep.
   - (b) Restrict, deferring K3's doc corrections and the parity narrowing.

   Recommendation: (a).
5. **MIG-B9-39 F3, a `code` on the CssSyntaxError `compile()` throws for a UXDSL error.**
   - (a) Not here.
   - (b) Add it here.

   Recommendation: (a), with the follow-up below.

**Follow-ups.**
- **A generic unknown-option warning on the plugin, `compile()`, Vite and webpack.** Any key other than the five removed ones is still ignored silently. Proposed: MIG-B9-60 (doctor) or a new MIG-B9-94.
- **The reference checker ignores `!important` where the CSS cascade does not.** An important `:root` definition followed by a plain one hides a dangling reference in the important one. Fixing it re-records the equivalence oracle. Proposed: a new MIG-B9-95, or 1.0.
- **`code` on the CssSyntaxError `compile()` throws** (MIG-B9-39 F3). Proposed: MIG-B9-39, or a new MIG-B9-96 if MIG-B9-39's contract does not take it.
- **Removing the 13 `FORMER` engine values together with the shims.** Proposed: the story that removes `packages/_deprecated` (none is registered yet), at 1.0 at the latest.
- **The `src`-only engine exports and the semver-bound dead exports above.** Proposed: a 1.0 API review story (new MIG-B9-97, or FEAT-011).
- **A watch-mode test that a failed compile's warnings print before its error.** Proposed: MIG-B9-19, which owns CLI watch recovery.
- **T6's remaining blind spots.** A new `src` file before `git add`, and a bare id with no prefix (`B6-17`, `PR #88`). Proposed: no story; recorded.
- **RR-N1.** An unreflowed 118-character comment line at `bin/uxdsl.js:756`. Proposed: the next story on `bin/uxdsl.js` (MIG-B9-19).
