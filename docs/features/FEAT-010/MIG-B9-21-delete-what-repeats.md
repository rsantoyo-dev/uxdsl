# MIG-B9-21 — Delete what repeats

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | None (`uxdsl/engine` is exempt from semver by contract; nothing semver-bound is removed) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-13; MIG-B9-20 (merged, PR #88), whose CLI hint decision 8 of 2026-11-13 has this story reword (§15) |
| Blocks | — |
| Base | `feat/beta9` after MIG-B9-13 and MIG-B9-20 (`cc10de6` or later) |
| Owns | `packages/uxdsl/src/default-theme.ts`, `base-theme.ts`, `ds-runtime/breakpoints.ts`, `entries/engine.ts`, `reference-integrity.ts` (the `!important` comparator), `scripts/measure-exports.js` (new) |
| Shares | `packages/uxdsl/src/compile.ts`, `vite.ts`, `webpack.ts`, `plugin.ts` (comments and `REMOVED_OPTIONS`), `bin/uxdsl.js` (comments, and the "none" hint of `themeEmissionMessage`: decision 8 of 2026-11-13), `scripts/verify-docs-update.js`, `packages/uxdsl/CHANGELOG.md`; for decision 8 of 2026-11-13 (§15): `packages/uxdsl/test/cli/uxdsl-cli.test.js`, `packages/uxdsl/docs/integrations/cli.md`, `packages/playground-nextjs/src/generated/cli-captures.json` and `compiler-captures.json` (regenerated); under §15's Q1 (a), one sentence each in `packages/uxdsl/docs/integrations/cli.md`, `vite.md` and `webpack.md` |
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
