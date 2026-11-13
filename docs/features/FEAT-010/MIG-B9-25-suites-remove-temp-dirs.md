# MIG-B9-25 — The test suites remove the temporary directories they create

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | None (registered by decision D2 of 2026-11-04) |
| Status | Ready |
| Size | S |
| Depends on | MIG-B9-13 (merged, PR #63). Under README §7 it also waits for MIG-B9-20, which edits most of the files this story edits (§3, §15) |
| Blocks | Under README §7: MIG-B9-26 (`test/core/compile-sass.test.js`, `fixtures/release-1.0/verdicts.test.js`); MIG-B9-17 (`test/cli/**`, `fixtures/release-1.0/verdicts.test.js`; decision 6 of 2026-11-10); MIG-B9-27 (`test/no-silent-output.test.js`); MIG-B9-28 (`test/cli/**`, `compile-sass.test.js`, `sass-source-maps.test.js`, `no-silent-output.test.js`); MIG-B9-39 (`test/cli/**`); MIG-B9-91 (the root `package.json`; it also depends on every story of waves 0 to 3); in `0.5.0-beta.10`, MIG-B9-51 and 52 (`scripts/agent-guide.test.js`) and, provisionally, MIG-B9-66 (decision 15 of 2026-11-10: the fixtures and shims it would run on Windows) |
| Base | `feat/beta9` after MIG-B9-13 and MIG-B9-20. §3 and §4 were recorded on `f855765`, before MIG-B9-20; both are re-run on the base the story starts from (§3) |
| Owns | `scripts/tmpdir-guard.js` (new), `scripts/tmpdir-guard.test.js` (new), `packages/uxdsl/test/helpers/temporary-directory.js` (new), `packages/uxdsl/test/temporary-directory.test.js` (new) |
| Shares | the root `package.json` (the `test` script); `packages/uxdsl/test/cli/error-location.test.js`, `init.test.js`, `theme-command.test.js`, `uxdsl-cli.test.js`, `watch-mode.test.js`; `packages/uxdsl/test/core/compile-sass.test.js`, `compile.test.js`, `import-order.test.js`, `protect.test.js`, `sass-matrix.test.js`, `sass-matrix.record.js`, `sass-pipeline.test.js`, `sass-source-maps.test.js`; `packages/uxdsl/test/config.test.js`, `es5-consumer-compat.test.js`, `no-silent-output.test.js`, `vite/index.test.js`, `webpack/loader.test.js`; `packages/_deprecated/shims.test.js`; `scripts/verify-docs-update.test.js`, `scripts/release.test.js`, `scripts/agent-guide.test.js`; `fixtures/parity/run.js`; `fixtures/mig-b2-03-cli-init/run.js`; `fixtures/release-1.0/verdicts.test.js`, `fixtures/release-1.0/audit-lock.test.js`; `fixtures/sass-corpus/run.js`, `run.test.js`, `README.md` (§15, question 1); `packages/uxdsl/README.md` (one sentence) |
| Output impact | none (no compiled output, API or CLI change; `npm test` fails when a passing step leaves an entry in its temporary directory) |

## 1. Goal

`npm test` leaves the temporary directory it is given as it found it. Every
test file and fixture it runs removes what it made there, and a guard fails
the run, naming each entry, when a passing step leaves one. Whether a test
that fails keeps what it made, and the run says where, is §15's question 3;
the contract assumes it does not until the owner answers.

## 2. Sources

- The registration, decision D2 of 2026-11-04
  ([FEAT-010-beta9.md](../FEAT-010-beta9.md), line 177):

  > - **D2 — MIG-B9-25 registered,** "The test suites remove the temporary directories they create": S, wave 2, early. Proposed in MIG-B9-23 §15: the owner's `$TMPDIR` held 127,359 entries left by the suites, 99,469 of them `uxdsl-sass-stage-*` from `compile-sass.test.js`.

- The proposal it accepts, [MIG-B9-23 §15](MIG-B9-23-compile-within-budget.md),
  "The profile of 2026-11-02", "By story" (lines 904–927):

  > - **MIG-B9-25 (proposed): the suites remove the temporary directories they
  >   create.** Size S. Nothing was removed while drafting.
  >   - **What is left:** 127,359 of that `$TMPDIR`'s 129,944 entries are uxdsl
  >     test leftovers, dated 2026-10-25 to 2026-11-02:
  >     - 99,469 `uxdsl-sass-stage-*`, because `compile-sass.test.js`'s
  >       `project()` never removes its directories;
  >   […]
  >   - **What it costs:** one listing of that directory takes 112 ms warm and
  >     430 ms cold.
  >   - **The kept corpus:** `run.js --keep` leaves `_uxdsl-extras.uxdsl` and
  >     `with-extras.uxdsl` in it (49 entries), so a kept corpus is not pristine.
  >   - **Shared with this story:** it would edit `compile-sass.test.js`'s
  >     `project()` and, for `--keep`, `fixtures/sass-corpus/run.js`, both of
  >     which this story keeps unedited from its BASE.

- The same story's "Delivery of 2026-11-09", new fact 8 (lines 1041–1045):

  > 8. **The suites' temporary directories (MIG-B9-25).**
  >    - One `npm test` run left 929 entries in its `TMPDIR`: 492 `uxdsl-sass-stage-*`, 152 `uxdsl-cli-test-*`, 26 `postcss-uxdsl-config-test-*`, 24 `uxdsl-theme-cmd-test-*`, 22 `uxdsl-cli-watch-*`, 21 `uxdsl-core-test-*`, 20 `uxdsl-sass-pipeline-*` and 15 `vite-plugin-uxdsl-test-*`.
  >    - One run of the core suite alone left 559, and `verify:1.0` left 18.
  >    - All were removed, from the roles' own scratch only.
  >    - The owner's `$TMPDIR` held 130,041 entries on 2026-11-08 and 3,411 on 2026-11-09. Someone outside this run removed the difference between the two, so §4's "as found" counts and §14's are not comparable.

  and its follow-up (lines 1077–1080):

  > - **MIG-B9-25.**
  >   - The suites' leftovers (new fact 8).
  >   - `run.js --keep` now keeps a root under `fixtures/sass-corpus/.work/`, which protect's `UXDSL_SASS_CORPUS` test reads.
  >   - MIG-B9-25 also edits `run.js`, after this story.

- [MIG-B9-14 §15](MIG-B9-14-cli-and-adapters.md), "Delivery of 2026-11-06",
  new fact 5 (line 536) and the follow-up (line 659):

  > 5. **Temporary directories left by the suites.** Every run of the suites leaves directories in `TMPDIR`: `uxdsl-sass-stage-*` (984 of 1,814 entries after one fixer's battery), `uxdsl-cli-watch-*`, `uxdsl-parity-*`, and `uxdsl-gate-verdicts-*`, two more per run since S-5 and S-6. This story's new watch tests add to the second kind. This is for MIG-B9-25.

  > - **MIG-B9-25.** The directories the suites leave in `TMPDIR` (fact 5), these two included: `watch-mode.test.js`'s `uxdsl-cli-watch-*` and `verdicts.test.js`'s `uxdsl-gate-verdicts-*`.

- The index ([README.md](README.md)): the row (line 209), "MIG-B9-25 is
  early in wave 2" (lines 261–266: "MIG-B9-25 waits for MIG-B9-23
  (`fixtures/sass-corpus/run.js`) and for MIG-B9-14
  (`packages/uxdsl/test/cli/**`); MIG-B9-23 §15 accepts either order between
  it and MIG-B9-25"), and the provisional §7 rows (lines 336, 337 and 350):

  > | `packages/uxdsl/test/core/compile-sass.test.js` | 12, 25 |
  > | `packages/uxdsl/test/cli/**` | 14, 22, 25, 39 |
  > | `fixtures/sass-corpus/run.js`, `run.test.js`, `README.md`, `.gitignore` | 10, 23, 25 |

- The code at `f855765`:
  - `packages/uxdsl/test/core/compile-sass.test.js:54-59`:

    ```js
    /** Writes `files` ({ relativePath: text | Buffer | null for a directory }) into a fresh real directory. */
    function project(files) {
      const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-stage-')));
      write(dir, files);
      return dir;
    }
    ```

  - `packages/uxdsl/test/cli/watch-mode.test.js:71-75` (`mkProject`,
    `'uxdsl-cli-watch-'`) and `fixtures/release-1.0/verdicts.test.js:21`
    (`const temporaryDirectory = () => fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-gate-verdicts-'));`):
    neither removes what it makes.
  - `fixtures/sass-corpus/run.js:276-278` writes the mixed check's two files
    into the corpus, and `:292-293` keeps or removes the root:

    ```js
        fs.writeFileSync(path.join(corpus, '_uxdsl-extras.uxdsl'), extras);
        fs.writeFileSync(path.join(corpus, 'with-extras.uxdsl'), '@import "bootstrap";\n@import "uxdsl-extras";\n');
    ```

    ```js
        if (args.keep) log(`Kept ${root}`);
        else removeCorpusRoot(root);
    ```

  - `fixtures/sass-corpus/README.md:40-41`: "`--keep` keeps it and prints its
    path: it holds `node_modules/bootstrap`, which `UXDSL_SASS_CORPUS` accepts
    in `packages/uxdsl/test/core/protect.test.js`."
- README §2: "**Negative controls are encoded, never manual.**"

## 3. Preconditions

```bash
git merge-base --is-ancestor 7aec3e0 HEAD                                                     # MIG-B9-13 (PR #63)
git merge-base --is-ancestor dfcd216 HEAD                                                     # MIG-B9-23 (PR #75): the corpus root under fixtures/sass-corpus/.work
git merge-base --is-ancestor 08d00e0 HEAD                                                     # MIG-B9-22 (PR #76): the CLI suite §4 measured
command grep -q "fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-stage-'))" packages/uxdsl/test/core/compile-sass.test.js   # project() as §4 measured it
command grep -q "'uxdsl-cli-watch-'" packages/uxdsl/test/cli/watch-mode.test.js
command grep -q "'uxdsl-gate-verdicts-'" fixtures/release-1.0/verdicts.test.js
command grep -q "path.join(corpus, '_uxdsl-extras.uxdsl')" fixtures/sass-corpus/run.js       # the mixed check writes into the corpus
command grep -q "if (args.keep) log" fixtures/sass-corpus/run.js                              # --keep keeps the root
test ! -e scripts/tmpdir-guard.js && test ! -e packages/uxdsl/test/helpers/temporary-directory.js   # neither new file exists yet
node -e "require('node:test').test('t', (t) => { if (!('passed' in t)) throw new Error('no t.passed'); })"   # node:test's TestContext has passed
```

All ten exit 0 on `f855765`, run on 2026-11-10 from the repository root
with Node 20.19.0 (CI's version) and `TMPDIR` set to a scratch directory of
the writer's own. The last line's control, with `'passedx'` in place of
`'passed'`, exits 1.

**The base moves before this story starts.** MIG-B9-20 (Ready, in progress
on `feat/b9-20-theme-marker`) removes `includeTheme` and its flags, which 17
of the 25 files that leave entries (§4) and `fixtures/sass-corpus/run.js`
use, so it edits those files; it also edits `packages/uxdsl/test/cli/**`,
`fixtures/parity/run.js` and `fixtures/mig-b2-03-cli-init/**`. Under README
§7 this story starts after MIG-B9-20 merges. When it starts, the agent adds
the line `git merge-base --is-ancestor <MIG-B9-20's merge commit> HEAD` to
this block (recorded in §15, as README §1 item 4 allows for a stale line),
re-runs the block and §4 on that base, and records the base's figures in
§14. A count that differs from §4 is a finding, not a reason to stop
(README §1 item 5): MIG-B9-20's new tests can add entries through the same
helpers. The same applies to MIG-B9-21 if its story file adds files this
story edits (§15, fact 4).

## 4. Baseline

Run on a copy of `f855765` prepared as README §1 item 3 says (a clone
under the writer's scratch directory, with the prepared worktree's
`node_modules` and `packages/uxdsl/dist`), never in the owner's checkout,
and never with the owner's `$TMPDIR`:

```bash
T=<an empty directory of your own>
TMPDIR=$T npm test; echo "exit=$?"
ls -A "$T" | wc -l
ls -A "$T" | sed -E 's/[A-Za-z0-9]{6}$//' | sort | uniq -c | sort -rn
```

then every step `npm test` runs, alone, each with its own empty `TMPDIR`
(§12's loop; the writer's run used the same steps, working directories and
flags, and set `TMPDIR` alone, which `os.tmpdir()` reads first on macOS).

Recorded on 2026-11-10, macOS 27.0 (Darwin 27.0.0, Apple M1 Pro), Node
20.19.0, npm 11.21.1:

- **The whole run.** `npm test` exited 0 at 09:03:53 EST, after starting at
  09:00:00 (3 min 53 s; 1-minute load between about 13 and 20, since
  MIG-B9-20's workflow ran tests, builds and Chrome at the same time: the
  timing is indicative only). 1,556 tests: 1,555 pass, 0 fail, 1 skipped
  (protect's Bootstrap test, without `UXDSL_SASS_CORPUS`); parity `PASS`,
  `All checks passed.`, the captures and examples up to date.
- **What it left in `TMPDIR`:** 957 entries, all directories, 28 MB, 6,340
  paths inside them.
  - 52 of those paths are symbolic links. 45 resolve into the repository's
    `packages/uxdsl` (the package directory, or `bin/uxdsl.js`): 13 + 13 in
    `uxdsl-cli-watch-*`, 5 + 5 in `uxdsl-cli-init-*`, 5 in `uxdsl-shims-*`, 2
    in `uxdsl-init-multi-*` and 2 in `uxdsl-init-plain-*`. The other 7 (3 in
    `uxdsl-cli-init-tarball-*`, 4 in `uxdsl-sass-stage-*`) point inside the
    temporary directory or nowhere.
  - The 957 are 28 more than MIG-B9-23 counted (§2): 170 `uxdsl-cli-test-*`
    instead of 152 and 32 `uxdsl-cli-watch-*` instead of 22, from MIG-B9-22's
    19 CLI tests.
- **What it left in the repository:** nothing tracked or untracked
  (`git status --porcelain` empty). The one new path is
  `packages/uxdsl-vscode/out`, the extension's compiled output, which the
  `uxdsl-vscode` test step makes and `.gitignore` ignores (`out/`).
  `fixtures/sass-corpus/.work` does not exist before or after.
- **Each step alone** (09:05 to 09:12 EST): all 105 steps exit 0; 80 leave
  nothing, 25 leave the 957 entries, the same set as the whole run:

  | Step (as `npm test` runs it) | Prefixes left (`mkdtemp`'s six characters removed) | Entries |
  | --- | --- | --- |
  | `packages/uxdsl/test/core/compile-sass.test.js` | `uxdsl-sass-stage-` | 492 |
  | `packages/uxdsl/test/cli/uxdsl-cli.test.js` | `uxdsl-cli-test-` 170, `uxdsl-cli-map-` 10, `uxdsl-cli-flags-` 8 | 188 |
  | `packages/uxdsl/test/cli/init.test.js` | `uxdsl-init-plain-` 15, `uxdsl-init-next-` 9, `uxdsl-init-vite-` 8, `uxdsl-init-multi-` 8 | 40 |
  | `packages/uxdsl/test/cli/watch-mode.test.js` | `uxdsl-cli-watch-` | 32 |
  | `packages/uxdsl/test/config.test.js` | `postcss-uxdsl-config-test-` | 26 |
  | `packages/uxdsl/test/cli/theme-command.test.js` | `uxdsl-theme-cmd-test-` | 24 |
  | `packages/uxdsl/test/core/compile.test.js` | `uxdsl-core-test-` | 21 |
  | `packages/uxdsl/test/core/sass-pipeline.test.js` | `uxdsl-sass-pipeline-` | 20 |
  | `packages/uxdsl/test/vite/index.test.js` | `vite-plugin-uxdsl-test-` | 15 |
  | `packages/uxdsl/test/cli/error-location.test.js` | `uxdsl-cli-theme-location-` 7, `uxdsl-cli-location-`, `uxdsl-cli-sass-frame-`, `uxdsl-cli-sass-frame-builds-`, `uxdsl-cli-sass-heavy-`, `uxdsl-cli-sass-protected-` 1 each | 12 |
  | `scripts/verify-docs-update.test.js` | `verify-docs-guard-` | 12 |
  | `packages/uxdsl/test/webpack/loader.test.js` | `uxdsl-webpack-loader-test-` | 11 |
  | `fixtures/release-1.0/verdicts.test.js` | `uxdsl-gate-verdicts-` | 11 |
  | `fixtures/parity/run.js` | `uxdsl-parity-` | 10 |
  | `packages/uxdsl/test/core/sass-source-maps.test.js` | `uxdsl-sass-maps-references-` 3, `-annotated-`, `-annotation-`, `-encoded-`, `-long-`, `-own-css-` 1 each | 8 |
  | `packages/uxdsl/test/no-silent-output.test.js` | `uxdsl-sass-context-` | 7 |
  | `fixtures/mig-b2-03-cli-init/run.js` | `uxdsl-cli-init-` 5, `uxdsl-cli-init-tarball-` 1 (10.7 MB, made by `fixtures/lib/tarball-consumer.js`'s `packAndInstall`) | 6 |
  | `scripts/release.test.js` | `uxdsl-release-guard-` | 6 |
  | `packages/_deprecated/shims.test.js` | `uxdsl-shims-` | 5 |
  | `packages/uxdsl/test/core/import-order.test.js` | `uxdsl-core-import-order-` | 4 |
  | `packages/uxdsl/test/core/sass-matrix.test.js` | `uxdsl-sass-matrix-`, `uxdsl-sass-matrix-bytes-`, `uxdsl-sass-matrix-sass-` (the last through `sass-matrix.record.js`'s `liveSass`) 1 each | 3 |
  | `packages/uxdsl/test/core/protect.test.js` | `uxdsl-protect-compile-` | 1 |
  | `packages/uxdsl/test/es5-consumer-compat.test.js` | `uxdsl-es5-check-` | 1 |
  | `fixtures/release-1.0/audit-lock.test.js` | `uxdsl-audit-lock-` | 1 |
  | `scripts/agent-guide.test.js` | `uxdsl-agent-guide-` | 1 |

  Each prefix is made by one file only, so a leftover's name says which
  file left it. The 80 steps that leave nothing include the files that
  already remove theirs (`cli/watch-selection.test.js`,
  `core/sass-stage-case.test.js`, `namespace-migration.test.js`,
  `codemod-size-overrides.test.js`, `types.test.js`,
  `fixtures/sass-corpus/run.test.js`), the `uxdsl-vscode` and playground
  steps, `fixtures/mig07-consumer/test/cascade-compare.test.js`, and the two
  `--check` scripts.
- **No test keeps a directory on failure on purpose.** A search of the test
  files and of the fixtures `npm test` runs finds no test that keeps its
  directory only when it fails. The 25 above never remove theirs, so they
  keep them whether they pass or fail; `packAndInstall` prints
  `Tarball consumer: <dir>` on every run, and that directory stays in both
  cases. The others remove theirs in `t.after` or `finally`, so they remove
  them whether they pass or fail.
- **A kept corpus.** `runCorpus` from `fixtures/sass-corpus/run.js`, run
  with `parseArgs(['--keep'])` on a fake install, Dart Sass and `compile()`
  (no network), passed and printed `Kept <root>`; the root was under
  `fixtures/sass-corpus/.work`, and its `corpus/` held `_uxdsl-extras.uxdsl`,
  `bootstrap.uxdsl` (the fake's) and `with-extras.uxdsl`. The writer removed
  the root afterwards. The "49 entries" of §2 need the real Bootstrap
  install and were not re-counted.

## 5. Contract

- **C1 — `npm test` leaves its temporary directory as it found it.**
  `TMPDIR=<an empty directory> npm test` exits 0 and leaves the directory
  empty. On `f855765` it leaves 957 entries (§4).
- **C2 — So does each step alone.** Every step `npm test` runs, run on its
  own as `npm test` runs it (the same working directory and flags; one
  `node --test <file>` for each file of a glob), with `TMPDIR`, `TMP` and
  `TEMP` set to an empty directory, exits 0 and leaves that directory
  empty. On `f855765`, 25 of its 105 steps leave entries (§4). Each file
  keeps the prefixes of §4's table.
- **C3 — The guard.** `npm test` runs its steps through
  `node scripts/tmpdir-guard.js <command> [args…]`, which:
  - makes one directory, `uxdsl-npm-test-XXXXXX`, in the temporary
    directory it is given (`os.tmpdir()`), and runs the command with
    `TMPDIR`, `TMP` and `TEMP` set to it, its standard streams inherited;
  - when it cannot make that directory, runs nothing, prints
    `tmpdir-guard: cannot make a temporary directory in <directory>: <reason>`
    on stderr and exits 1;
  - reads, lists and removes nothing in the directory it is given but its
    own directory;
  - when the command exits 0 and leaves nothing: removes its directory,
    prints nothing and exits 0;
  - when the command exits 0 and leaves something: prints
    `tmpdir-guard: the tests passed but left these entries in their temporary directory, now removed:`
    on stderr, then each entry's name, sorted, one per line, indented by
    two spaces; removes its directory; exits 1;
  - when the command exits non-zero or is ended by a signal: exits with the
    command's code (1 for a signal), and
    - under §15's question 3, option (a), assumed until the owner answers:
      removes its directory and prints nothing of its own;
    - under option (b): keeps its directory as it is and prints
      `tmpdir-guard: the tests failed; their temporary directory is kept: <absolute path>`
      on stderr.
- **C4 — A failing test's directories (§15, question 3).**
  - Under option (a), assumed until the owner answers, as the registration
    reads ("the test suites remove the temporary directories they
    create"): a directory a test makes is removed when that test ends,
    whether it passes or fails. A directory a test file or a fixture makes
    outside any test is removed when the file or fixture exits, whatever
    its code.
  - Under option (b): a directory a test makes is removed when that test
    passes and kept when it fails. A directory a test file or a fixture
    makes outside any test is removed when the file or fixture exits 0 and
    kept when it exits non-zero. Each kept directory's path is printed in
    the failing output. Under the guard, what is kept sits inside the
    guard's kept directory (C3), so no step removes it.
  - Either way, the tests that already remove their directories when they
    fail (§4) are not edited and keep doing so.
- **C5 — A link is removed, never followed.** Removing a test's, a
  fixture's or the guard's directory removes a symbolic link inside it and
  never touches what the link points to: `packages/uxdsl`, which 45 links in
  §4's leftovers point into, is unchanged by `npm test`.
- **C6 — A kept corpus is the corpus as installed** (this assumes §15,
  question 1, option (a), until the owner answers).
  `node fixtures/sass-corpus/run.js --keep` keeps a corpus root whose
  `corpus/` holds the renamed Bootstrap files only: the mixed check's
  `_uxdsl-extras.uxdsl` and `with-extras.uxdsl` are removed after the mixed
  compile, whether it succeeds or throws. The `Kept <root>` line stays.
  Without `--keep` the root is removed, as on the base.

Must stay as on BASE (the `feat/beta9` commit the story starts from):

- every test and every assertion: none removed, skipped, renamed or
  loosened; `npm test`'s TAP totals are BASE's plus this story's new tests,
  0 fail, and the same skipped test (on `f855765`: 1,556 tests, 1,555 pass,
  1 skipped);
- how each test spells its directory's path (`fs.realpathSync`,
  `fs.realpathSync.native` or as `mkdtemp` returns it): MIG-B9-23's spelling
  tests (`sass-stage-case.test.js`) and `compile-sass.test.js`'s twin
  comparisons depend on it on darwin;
- the files of the 80 steps that leave nothing (§4), unedited, except
  `fixtures/sass-corpus/run.test.js`, which gains T9;
- nothing under `packages/uxdsl/src`, `bin` or `schema`; the parity oracles
  (`fixtures/parity/expected/**`, `node fixtures/parity/run.js` without
  `--update`); the playground's captures and compiled examples
  (`test:captures` and `test:examples` pass with no regeneration);
  `DIAGNOSTIC_CATALOG` (106 codes on `f855765`);
- `fixtures/sass-corpus/run.js`'s timing method (D8 of 2026-11-04:
  `TIMING_BUDGET`, `ROUNDS`, `alternate`, `warm`, `timingVerdict`,
  `freshCorpusRoot`, `removeCorpusRoot`, `parseArgs`) and every line it
  prints; `fixtures/lib/tarball-consumer.js`, unedited (the gate and the
  `verify:*` fixtures use it; §15, question 2);
- the repository after `npm test`: no new path but the build outputs (on
  `f855765`, `packages/uxdsl-vscode/out` only);
- the temporary directory `npm test` is given: nothing in it but the
  guard's own directory is read, moved or removed.

## 6. Out of scope

- **The release gate and the `verify:*` fixtures,** which `npm test` does
  not run (`npm run verify:1.0` left 18 entries in MIG-B9-23's run, §2;
  `packAndInstall` never removes the consumer directory it makes): §15,
  question 2. Assumed out until the owner answers; proposed for MIG-B9-91.
- **Leftovers already in a temporary directory,** the owner's included,
  and the two directories MIG-B9-14 §15 (fact 9) found there: the owner's.
  No step of this story or its tests removes anything it did not make.
- **Windows.** The guard sets `TMP` and `TEMP`, which `os.tmpdir()` reads
  on win32 instead of `TMPDIR`; running it there is MIG-B9-28's.
- **The flaky watch-mode test** (`waitFor timed out` on CI's ubuntu runner):
  MIG-B9-39, which owns it.
- **Build outputs in the repository** (`packages/uxdsl/dist`,
  `packages/uxdsl-vscode/out`, `fixtures/mig07-consumer/.out`): made on
  purpose, git-ignored.
- **The rule for contributors in `CONTRIBUTING.md`:** MIG-B9-51, which
  writes that file (§15, follow-ups).
- **Merging the test files' own project helpers into one:** only how their
  directories are removed changes.

## 7. Approach and traps

Non-normative.

1. **One helper for the package's tests,**
   `packages/uxdsl/test/helpers/temporary-directory.js`: it makes the
   directory with `fs.mkdtempSync(path.join(os.tmpdir(), prefix))`.
   - Given a test context `t`, it registers `t.after`, which removes the
     directory. Under question 3 (b) it removes it only when `t.passed` is
     true, and otherwise prints its path with `t.diagnostic`; `t.passed`
     exists on Node 20.19 (§3's last line).
   - Given none, it removes the directory in a synchronous `exit` handler.
     Under question 3 (b) it does so only when the exit code is 0, and
     prints its path otherwise; a `node --test` child exits 1 when one of
     its tests failed (checked on 20.19.0).
   - Each file replaces its `fs.mkdtempSync(path.join(os.tmpdir(), …))` with
     the helper and keeps its own `realpathSync` call around it.
2. **Where there is no test context.** `compile-sass.test.js`'s
   `project(files)` is called without one, in hundreds of places: use the
   `exit` path and edit no call site. Directories made when a file loads are
   shared by several of its tests (`sass-matrix.test.js:24` and `:124`,
   `sass-matrix.record.js`'s `fixtureDir` through `liveSass`,
   `protect.test.js:109`): never remove them after one test.
3. **The root's tests and fixtures** (`scripts/*.test.js`,
   `fixtures/release-1.0/*.test.js`, `packages/_deprecated/shims.test.js`,
   `fixtures/parity/run.js`, `fixtures/mig-b2-03-cli-init/run.js`) can
   require the same helper by relative path, so T7 covers their `exit`
   path. `fixtures/parity/run.js` ends with `process.exit(1)` on failure and
   `fixtures/mig-b2-03-cli-init/run.js` sets `process.exitCode = 1`: both
   reach the handler with a non-zero code. The CLI-init fixture also removes
   `packAndInstall`'s `tarball.dir` itself; `fixtures/lib/tarball-consumer.js`
   is not edited.
4. **The guard,** `scripts/tmpdir-guard.js`, wraps the existing chain: for
   instance `"test": "node scripts/tmpdir-guard.js npm run test:steps"`, with
   `test:steps` holding today's chain plus
   `node --test scripts/tmpdir-guard.test.js`. It spawns the command with
   `shell: process.platform === 'win32'` (npm is a `.cmd` there), forwards
   `SIGINT` and `SIGTERM`, and removes with
   `fs.rmSync(dir, { recursive: true, force: true })`.

Traps:

- **An empty `TMPDIR` is `/tmp`.** On POSIX, `os.tmpdir()` reads `TMPDIR`,
  then `TMP`, then `TEMP`, and falls back to `/tmp` when all three are
  empty. While this story was written, a loop whose `mktemp -d` failed ran
  two test files with an empty `TMPDIR`; they left `uxdsl-es5-check-*` and
  `uxdsl-agent-guide-*` in `/private/tmp`, which the writer removed. The
  guard and §12's loop run nothing when their directory cannot be made.
- **Links into the repository.** `uxdsl-cli-watch-*`, `uxdsl-cli-init-*`,
  `uxdsl-init-*` and `uxdsl-shims-*` projects hold `node_modules/uxdsl`
  links to `packages/uxdsl`, relative or absolute (§4). `fs.rmSync` with
  `recursive` removes a link without following it; a hand-written walk that
  uses `stat` rather than `lstat` would delete the package's sources. T5
  and T8 plant a link to a sentinel directory.
- **A watcher still running.** `watch-mode.test.js` kills its CLI child in
  `t.after`; removing the project before the child has exited lets the
  watcher write into a directory being removed (`ENOTEMPTY`) or rebuild
  into a removed one. Wait for the child's `exit` event, then remove.
- **Only the guard's own directory.** On the owner's machine the directory
  `npm test` is given is the owner's `$TMPDIR`: the guard never lists it.
  T1 plants a sentinel beside the guard's directory.
- **The spelling of a path** stays each file's (§5, must stay).
- **Windows** reads `TEMP` and `TMP`, not `TMPDIR`: the guard sets all
  three.
- **Timing.** The base's leftovers are 28 MB in 957 directories; removing
  them should not change `npm test`'s duration materially. This machine's
  timings are indicative only while other workflows run.

Stop rule: if a file's directories cannot be removed without changing an
assertion or the order of its tests (a test that reads a directory another
test made, say), stop, set the story to Blocked and record it in §15 for
the owner. If the base the story starts from leaves entries from a step §4
does not list, that step joins the story (a stale line, README §1 item 4,
recorded in §14). Never loosen an assertion, skip a test, change a prefix,
or remove anything the given temporary directory held before the run.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `scripts/tmpdir-guard.test.js` (new) | `MIG-B9-25: the guard runs a command with TMPDIR, TMP and TEMP set to a directory of its own inside the one it is given, and removes it when the command passes and leaves nothing` | unit (the guard as a subprocess, on a scratch directory) | C3 | a sentinel file placed in the given directory before the run is still there afterwards, and nothing else is; the command prints its three variables, which must all name the guard's directory |
| T2 | same | `MIG-B9-25: the guard fails a command that passes but leaves an entry, names it and removes it (negative control)` | unit | C1, C3 | itself: a command that runs `fs.mkdtempSync(path.join(os.tmpdir(), 'planted-'))` and exits 0 makes the guard exit 1, print the message line and `  planted-XXXXXX`, and leave the given directory with the sentinel only |
| T3 | same | under question 3 (a): `MIG-B9-25: when the command fails, the guard exits with the command's code and removes its directory`; under (b): `MIG-B9-25: the guard keeps its directory when the command fails, prints its path and exits with the command's code` | unit | C3, C4 | a command that makes a directory and exits 3: the guard exits 3, and under (a) the given directory holds the sentinel only; under (b) the printed path exists and holds that directory |
| T4 | same | `MIG-B9-25: the guard runs nothing and exits 1 when it cannot make its directory` | unit | C3 | a given `TMPDIR` that does not exist, and a command that would write a marker file: exit 1, the message line, and no marker |
| T5 | same | `MIG-B9-25: the guard removes a symbolic link left in its directory, never what the link points to` | unit | C5 | a command that leaves a link to a sentinel directory outside the given one: the sentinel and its file are still there |
| T6 | `packages/uxdsl/test/temporary-directory.test.js` (new) | under question 3 (a): `MIG-B9-25: a test's temporary directory is removed when the test passes and when it fails`; under (b): `MIG-B9-25: a test's temporary directory is removed when the test passes and kept, with its path printed, when it fails` | unit (a planted test file run by `node --test` in a subprocess, with its own `TMPDIR`) | C2, C4 | both halves in one test. Under (a): a helper that removes only when the test passes fails the failing half, and one that never removes fails both. Under (b): a helper that always removes fails the failing half, and one that never removes fails the passing half |
| T7 | same | under question 3 (a): `MIG-B9-25: a temporary directory made outside any test is removed when its file exits, whatever its code`; under (b): `MIG-B9-25: a temporary directory made outside any test is removed when its file exits 0 and kept when it exits non-zero` | unit | C2, C4 | as T6, for the `exit` path |
| T8 | same | `MIG-B9-25: removing a test's temporary directory removes a link inside it, never the link's target` | unit | C5 | a sentinel directory outside the test's directory, reached by a link from inside it |
| T9 | `fixtures/sass-corpus/run.test.js` | `MIG-B9-25: a corpus root kept with --keep holds the corpus as installed, without the mixed check's two files` | unit (`runCorpus` on the existing fakes, no network) | C6 | fails on the base: the kept `corpus/` holds `_uxdsl-extras.uxdsl` and `with-extras.uxdsl` (§4) |
| T10 | every step `npm test` runs, alone (§12's loop) | — | suite | C2 | on the base the loop reports the 25 steps of §4 |
| T11 | `npm test`, through the guard | — | suite | C1, C3, C5 | AC1's mutation |

C1 and C2 fail on the base, by §4. C3's tests fail there because the guard
does not exist; T9 fails there by §4's reproduction. T6 to T8 test a
helper that is new, so their negative controls are their failing halves
and planted links, encoded in the tests (README §2).

## 9. Acceptance criteria

BASE below is `git merge-base HEAD origin/feat/beta9`.

- **AC1** `TMPDIR=<an empty directory of your own> npm test` exits 0, and
  `test -z "$(ls -A <that directory>)"` exits 0 afterwards.
  - Test: `npm test`, run through `scripts/tmpdir-guard.js`.
  - Mutation: `compile-sass.test.js`'s `project()` restored to BASE's,
    which never removes its directory: `npm test` exits 1, and the guard's
    stderr has the message line of C3 and the `uxdsl-sass-stage-*` entries;
    the given directory is still empty.
- **AC2** §12's loop prints `fail=0`, and its scratch directory is gone.
  - Test: every step `npm test` runs, alone (T10).
  - Mutation: any one of §4's 25 files restored to BASE's: the loop prints
    `left <n> in <directory>: <that step>` and `fail=1`.
- **AC3** `node --test scripts/tmpdir-guard.test.js` exits 0.
  - Test file: `scripts/tmpdir-guard.test.js` (T1 to T5).
  - Mutations: a guard that exits 0 on a leak fails T2; under question 3
    (a), one that keeps its directory when the command fails fails T3
    (under (b), one that removes it); one that runs the
    command when it cannot make its directory fails T4; one that removes
    with a `stat`-based walk fails T5; one that sets `TMPDIR` alone fails
    T1.
- **AC4** `node --test packages/uxdsl/test/temporary-directory.test.js`,
  run with `TMPDIR` set to an empty directory, exits 0 and leaves that
  directory empty.
  - Test file: `packages/uxdsl/test/temporary-directory.test.js` (T6 to
    T8).
  - Mutations: under question 3 (a), a helper that removes only on success
    fails the failing halves of T6 and T7, and one that never removes fails
    both halves; under (b), a helper that always removes fails their failing
    halves, and one that never removes fails their passing halves; a
    `stat`-based removal fails T8.
- **AC5** `node --test fixtures/sass-corpus/run.test.js` exits 0, with no
  `fixtures/sass-corpus/.work` before or after; and
  `git diff "$(git merge-base HEAD origin/feat/beta9)" -- fixtures/sass-corpus/run.js | command grep -E '^[-+].*(TIMING_BUDGET|ROUNDS|const warm|function (alternate|timingVerdict|freshCorpusRoot|removeCorpusRoot|parseArgs))'`
  exits 1 (no line that declares the budget, the rounds or those functions
  changes; the PR review reads the rest of the diff against §5's must-stay
  list).
  - Test file: `fixtures/sass-corpus/run.test.js` (T9).
  - Mutation: BASE's `runCorpus`, which leaves the two files in a kept
    corpus, fails T9.
- **AC6** After AC1's run, `git status --porcelain` is empty (which also
  shows C5 on the suite: a removal that followed one of §4's links would
  delete tracked files under `packages/uxdsl`);
  `node fixtures/parity/run.js` exits 0 without `--update`; the TAP totals
  of AC1's log are BASE's plus this story's new tests, with 0 fail and
  BASE's one skipped test; and
  `git diff --name-only "$(git merge-base HEAD origin/feat/beta9)"` lists
  only files in this story's Owns and Shares, and this story's file.
  - Test files: the suites `npm test` runs.
  - Mutation: none; an invariant guard.

Owner checks, never marked PASS by the agent:

- Answer §15's question 1 (the kept corpus). C6 assumes option (a) until
  then.
- Answer §15's question 2 (the gate and the `verify:*` fixtures). This
  story assumes option (a), `npm test` only, until then.
- Answer §15's question 3 (a failing test's directories). C3 and C4 assume
  option (a), always removed, until then.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | no: no file in `VISUAL_DEFAULT_FILES`, and nothing a consumer of the package sees |
| package README | yes: the docs guard asks for it for any change under `packages/uxdsl/` that is not documentation (`isCodeChangeInPackage`), and the helper and the test files are; one sentence |
| `verify-docs-update.js` classification | no (no file added under `packages/uxdsl/src`) |
| `npm run generate:language` | no |
| `AGENTS.md` + agent guide | no |
| `DIAGNOSTIC_CATALOG` | no |
| `npm run generate:capabilities` | no |
| playground `uxdsl:build` + captures | no change expected; `npm test` runs `test:captures` and `test:examples` |
| `migration.md` | no |

## 11. Documentation

- `packages/uxdsl/README.md`, "Verified from a real install", after the
  paragraph on the package's own test files: one sentence saying that the
  package's tests remove the temporary directories they make (under §15's
  question 3, option (b): when they pass, and keep them when they fail), and
  that the repository's `npm test` fails when a passing step leaves one.
- `fixtures/sass-corpus/README.md`, the `--keep` sentence (lines 40–41):
  what a kept root holds, as §15's question 1 is answered.
- The headers of `scripts/tmpdir-guard.js` and
  `packages/uxdsl/test/helpers/temporary-directory.js` state C3 and C4 as
  behavior, without a story id.

## 12. Verification

```bash
node --test scripts/tmpdir-guard.test.js                                          # exit 0
TMPDIR=<empty dir> node --test packages/uxdsl/test/temporary-directory.test.js    # exit 0; <empty dir> stays empty
node --test fixtures/sass-corpus/run.test.js                                      # exit 0; no fixtures/sass-corpus/.work afterwards
TMPDIR=<empty dir> npm test                                                       # background, with a log; exit 0; <empty dir> stays empty
node fixtures/parity/run.js                                                       # exit 0
```

Then every step alone (AC2), in the background, from the repository root,
after `npm test` has built `packages/uxdsl/dist` and
`packages/uxdsl-vscode/out` (about 7 minutes on this machine, indicative).
Save it as a script and run it with bash or zsh; `SCRATCH` is a scratch
directory of your own, and the loop removes only empty directories:

```bash
S="$(mktemp -d "${SCRATCH:?}/c2.XXXXXX")" || exit 1; fail=0
step() {
  local cwd=$1 d; shift
  d=$(mktemp -d "$S/step.XXXXXX") || { echo "no step directory: $*"; fail=1; return; }
  (cd "$cwd" && TMPDIR=$d TMP=$d TEMP=$d "$@") > /dev/null 2>&1 || { echo "exit $?: $*"; fail=1; }
  rmdir "$d" 2> /dev/null || { echo "left $(ls -A "$d" | wc -l | tr -d ' ') in $d: $*"; fail=1; }
}
for f in packages/uxdsl/test/*.test.js packages/uxdsl/test/{core,cli,vite,webpack}/*.test.js; do step packages/uxdsl node --test "${f#packages/uxdsl/}"; done
for f in packages/uxdsl/test/performance/*.test.js; do step packages/uxdsl node --test --test-concurrency=1 "${f#packages/uxdsl/}"; done
for f in packages/uxdsl-vscode/test/*.test.js; do step packages/uxdsl-vscode node --test "${f#packages/uxdsl-vscode/}"; done
for s in test:themes test:scheduler test:components test:audit test:captures test:examples; do step packages/playground-nextjs npm run -s "$s"; done
step . node fixtures/parity/run.js
step . node fixtures/mig-b2-03-cli-init/run.js
for f in fixtures/mig07-consumer/test/*.test.js fixtures/release-1.0/{contrast-baseline,audit-lock,verdicts}.test.js fixtures/sass-corpus/run.test.js scripts/*.test.js scripts/lib/oklch.test.js packages/_deprecated/shims.test.js; do step . node --test "$f"; done
step . node scripts/generate-language-artifacts.js --check
step . node scripts/generate-agent-guide.js --check
echo "fail=$fail"; rmdir "$S"
```

On the base the loop prints one `left …` line for each of §4's 25 steps
(the writer checked its form on three of them: two `left 1 …` lines and
nothing for the clean one). A step a later story adds to `npm test` joins
the loop.

`npm run verify:1.0` is not part of this story's acceptance (§6); CI runs
it on the pull request, and its result is the PR's.

## 13. Delivery

Branch `feat/b9-25-suites-remove-temp-dirs`. Commit:
`test(FEAT-010): MIG-B9-25 - the test suites remove the temporary directories they create, and npm test fails when one is left`.

PR title: `FEAT-010: MIG-B9-25 - the test suites remove the temporary directories they create`.
The body:

- **Goal:** §1, in two sentences.
- **C1 and C2:** AC1's and AC2's outputs, with the base's counts beside
  them (§4, re-run on BASE).
- **C3 to C5:** AC3's and AC4's results, and each mutation's.
- **C6:** T9, and the owner's answer to §15's question 1.
- **Not run, or not a pass:** Windows (MIG-B9-28), the gate's leftovers
  (§15, question 2), and the timing caveat.
- **Owner checks:** the list in §9.
- The last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Open questions for the owner (answer before implementing)

1. **What `--keep` should leave.** The registration records that
   `run.js --keep` "leaves `_uxdsl-extras.uxdsl` and `with-extras.uxdsl` in
   it (49 entries), so a kept corpus is not pristine", and that the root now
   stays under `fixtures/sass-corpus/.work/` (§2), without saying what to
   change. Today nothing reads the two files: protect's `UXDSL_SASS_CORPUS`
   test reads `node_modules/bootstrap/scss`, and `corpus/bootstrap.uxdsl`
   does not load them.
   - (a) A kept corpus is the corpus as installed: `runCorpus` removes the
     two files after the mixed compile, in every case. `run.js`,
     `run.test.js` (T9) and the README's `--keep` sentence change; the
     timing method does not.
   - (b) Documentation only: `fixtures/sass-corpus/README.md` says that a
     kept root also holds the mixed check's two files and stays under
     `.work/` until it is removed by hand. `run.js` is not edited, so the
     story leaves `fixtures/sass-corpus/run.js` and `run.test.js` out of its
     Shares.
   - (c) Nothing: the item is closed as recorded.

   Recommendation: (a). It is a few lines and one test, it makes "kept"
   mean what the README says a kept root holds, and the registration
   expected this story to edit `run.js` "for `--keep`". C6 assumes (a)
   until the owner answers.
2. **Only `npm test`, or the gate too.** D2 registers "the test suites", and
   the registration's counts are `npm test`'s; MIG-B9-23's new fact 8 also
   records that `verify:1.0` left 18 entries, and `fixtures/lib/tarball-consumer.js`'s
   `packAndInstall` (used by the gate, the Vite, webpack and consumer
   fixtures, and by `fixtures/mig-b2-03-cli-init/run.js`) never removes the
   directory it makes.
   - (a) `npm test` only, as measured in §4. The gate's and the `verify:*`
     fixtures' leftovers become a follow-up, proposed for MIG-B9-91, which
     runs the gate, or a story the owner registers.
   - (b) `npm test` and `npm run verify:1.0`: `fixtures/release-1.0/run.js`
     and `fixtures/lib/tarball-consumer.js` join the Shares. Under README §7
     the `fixtures/release-1.0/run.js` row (02, 13, 14, 20, 30, 31, 91, 92)
     then makes MIG-B9-30 and 31 wait for this story, and the verification
     adds a gate run with Chrome.
   - (c) Every `verify:*` fixture as well (Vite, webpack, the CSS-modules,
     extension and playground fixtures, MIG-B9-13's browser fixture and
     MIG-B9-23's budget fixture): larger than S, so split.

   Recommendation: (a). It keeps the story to what D2 counted and keeps it
   off the gate's file, which wave 3 edits. This story assumes (a) until
   the owner answers.
3. **A failing test's directories.** D2 and the facts it was registered
   from (MIG-B9-23's proposal and new fact 8, MIG-B9-14's fact 5) ask that
   the suites remove the directories they create; none says what a failing
   test does with them.
   - (a) Always removed: a test removes its directory when it ends, pass or
     fail; a test file or fixture when it exits, whatever its code; the
     guard removes its own directory on every exit and still exits 1 when a
     passing run left something.
   - (b) Kept when it fails: removed when the test passes; kept, with its
     path printed, when it fails; the guard keeps its directory when the
     command fails. A failed compile's project can then be inspected, and
     what failing runs leave stays inside one guard directory per run.
     `t.passed` (Node 20.19, §3) and the `exit` handler's code make it a
     few lines more than (a).

   Recommendation: (b). Keeping a failing test's files is what makes a
   failure in a project fixture readable, and the guard bounds what is
   kept. It goes beyond the registration's words, so C3 and C4 assume (a)
   until the owner answers; T3, T6, T7, AC3 and AC4 state both forms.

### Facts found while writing (2026-11-10)

1. **The count on `f855765` is 957,** 28 more than MIG-B9-23 recorded,
   from MIG-B9-22's new CLI tests (§4). Every one of the 105 steps passes on
   its own; 25 leave entries, and the per-step sum equals the whole run's.
2. **45 links in the leftovers point into `packages/uxdsl`** (§4). Any
   cleanup that follows links would delete the package's sources (§7).
3. **An empty `TMPDIR` sends `os.tmpdir()` to `/tmp`** (§7). The writer's
   first try of §12's loop, with a missing scratch directory, left two
   directories in `/private/tmp` from `es5-consumer-compat.test.js` and
   `agent-guide.test.js`; the writer removed both. The loop as written in
   §12 stops a step whose directory cannot be made.
4. **Who waits for whom (README §7).**
   - This story waits for MIG-B9-20, the earlier row: 17 of §4's 25 files,
     and `fixtures/sass-corpus/run.js`, use `includeTheme` or
     `--no-include-theme` (`uxdsl-cli.test.js` 84 times, `compile.test.js`
     36, `watch-mode.test.js` 23), and MIG-B9-20 edits
     `packages/uxdsl/test/cli/**`, `fixtures/parity/run.js`,
     `fixtures/mig-b2-03-cli-init/**` and `fixtures/sass-corpus/run.js`.
   - MIG-B9-21 lists no test file in its Shares, but its §8 names
     `test/vite/index.test.js` and `test/webpack/loader.test.js` (T3) and
     adds two `scripts/*.test.js` that `npm test` runs only if the root
     `package.json` lists them. If its story file adds those files, this
     story waits for it too.
   - MIG-B9-16 (the playground) shares no file with this story.
   - Later rows wait for this story where they edit a file it edits:
     MIG-B9-39 (`test/cli/**`), MIG-B9-91 (the root `package.json`), and,
     as their story files written on 2026-11-10 say, MIG-B9-26
     (`compile-sass.test.js`, `test/cli/uxdsl-cli.test.js`,
     `fixtures/release-1.0/verdicts.test.js`), MIG-B9-27
     (`no-silent-output.test.js`) and MIG-B9-28 (`test/cli/**`,
     `compile-sass.test.js`, `sass-source-maps.test.js`,
     `no-silent-output.test.js`); in `0.5.0-beta.10`, MIG-B9-51 and 52
     (`scripts/agent-guide.test.js`). MIG-B9-38's story file is still to be
     written; it waits for this story if it lists a file of `test/cli/**`.
5. **`npm test` writes nothing into the repository** but the extension's
   `packages/uxdsl-vscode/out` (§4).

### Follow-ups

- **The index's §7 (the index's owner, before this story starts):** this
  story on the rows of every file in its Shares, and MIG-B9-20 on the
  `packages/uxdsl/test/cli/**` and `fixtures/sass-corpus/run.js` rows
  (fact 4). This story file does not edit the index.
- **MIG-B9-91, or a story the owner registers:** the gate's and the
  `verify:*` fixtures' leftovers, if question 2 is answered (a).
- **MIG-B9-28:** run the guard and §12's loop on Windows, where
  `os.tmpdir()` reads `TEMP` and `TMP`.
- **MIG-B9-51:** `CONTRIBUTING.md` states the rule for a new test: make
  its directories with the helper, and expect `npm test` to fail when one
  is left.
- **MIG-B9-39:** it rebases its watch-mode work on this story's
  `watch-mode.test.js`.

### Review of 2026-11-10 (applied in the PR that adds this file)

A static review of the seven wave-2 story files written on 2026-11-10. Its
findings on this story were applied before the owner's review:

- **Keep-on-failure (R4).** No source registers it, so it is §15's question
  3, with a recommendation; C3 and C4 assume option (a), the registration's
  words, until the owner answers, and the tests and acceptance criteria
  that depend on it state both forms.
- **Blocks (R14).** The later rows that share this story's files are named,
  with the files: MIG-B9-26, 27, 28, 39 and 91, and MIG-B9-51 and 52 in
  `0.5.0-beta.10`. The index's §7 lists this story on the rows of its
  Shares, MIG-B9-20 on `test/cli/**` and `fixtures/sass-corpus/run.js`, and
  new rows for the test files it shares with MIG-B9-20, 26, 27 and 28.

### Owner decisions of 2026-11-10 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-10). The owner was given 32 numbered questions, in Spanish, on the open questions of the seven story files written on 2026-11-10 and on three notes of their PR (#80), each with its options and a recommendation, and answered, verbatim, "fusiona y haz como recmiendes" ("fusiona y haz como recomiendes", "merge, and do as you recommend"): PR #80 was merged, and each recommendation is the owner's decision of 2026-11-10. This record is in English and lists those that concern this story; its questions 1 to 3 above are decisions 3 to 5. Where they differ from this story's contract or from an earlier block, they rule.

- **Question 1, what `--keep` leaves (decision 3): (a)**, as C6 assumed. `fixtures/sass-corpus/run.js --keep` leaves the corpus as installed: the mixed check's `_uxdsl-extras.uxdsl` and `with-extras.uxdsl` are removed. No change.
- **Question 2, `npm test` or the gate too (decision 4): (a)**, as the story assumed: `npm test` only. The release gate's and the `verify:*` fixtures' leftovers become a follow-up, proposed for MIG-B9-91, the first destination the follow-up above names; MIG-B9-91's §15 records the proposal. No change.
- **Question 3, a failing test's directories (decision 5): (b).** The story had assumed (a) until answered. A failing test's temporary directories are kept, with the path printed, and the guard keeps its directory. What changes:
  - §1: a test that fails keeps what it made, and the run says where.
  - C3: when the command exits non-zero or is ended by a signal, the guard exits with the command's code (1 for a signal), keeps its directory as it is and prints `tmpdir-guard: the tests failed; their temporary directory is kept: <absolute path>` on stderr: C3's "under option (b)" branch, not its option (a) branch.
  - C4: its "under option (b)" paragraph applies. A directory a test makes is removed when that test passes and kept when it fails; a directory a test file or a fixture makes outside any test is removed when the file or fixture exits 0 and kept when it exits non-zero; each kept directory's path is printed in the failing output; under the guard, what is kept sits inside the guard's kept directory (C3). The tests that already remove their directories when they fail are not edited.
  - T3, T6 and T7 take their "under (b)" titles and controls; AC3's and AC4's mutations are the "under (b)" ones; §7's "under question 3 (b)" sentences describe the helper; §11's README sentence says that the tests remove their directories when they pass and keep them when they fail.
- **Under README §7, after decision 6.** MIG-B9-26's split gives `packages/uxdsl/test/cli/**` to MIG-B9-17, so the later rows that wait for this story there are MIG-B9-17, 28 and 39. MIG-B9-26 still waits for it on `compile-sass.test.js` and `fixtures/release-1.0/verdicts.test.js`, and MIG-B9-17 also on `verdicts.test.js`. The header's Blocks follows, and names MIG-B9-66, registered by decision 15, whose rows are provisional.
