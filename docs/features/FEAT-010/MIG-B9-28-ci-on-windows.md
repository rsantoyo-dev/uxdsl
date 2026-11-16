# MIG-B9-28 — CI on Windows

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | None (registered by decision D11 of 2026-11-04; §15 asks the owner seven questions, and the contract states the option it assumes for each) |
| Status | Ready |
| Size | M (registered as "S or split (its scout sizes it)"). This file is the first part: the `uxdsl` package's own suites on Windows. What a larger scope would add is §15's questions 1 and 2, with no new id (question 1's second part is MIG-B9-66, decision 15 of 2026-11-10) |
| Depends on | None by registration (D11). Under §7 it starts after five earlier rows merge, which edit test files it shares (§3): MIG-B9-20 (`test/cli/**`), MIG-B9-25 (`test/cli/**`, `compile-sass.test.js`, `sass-source-maps.test.js`, `no-silent-output.test.js`), MIG-B9-26 (`compile-sass.test.js`), MIG-B9-17 (`test/cli/uxdsl-cli.test.js`, which decision 6 of 2026-11-10 moved from MIG-B9-26 to it) and MIG-B9-27 (`no-silent-output.test.js`) |
| Blocks | MIG-B9-91 (D11); MIG-B9-66, in `0.5.0-beta.10` (decision 15 of 2026-11-10). Under §7, MIG-B9-38, 19 and 06 (MIG-B9-19 and 06 in MIG-B9-39's place, by decisions 28 and 29 of 2026-11-13) and every later story on `packages/uxdsl/test/cli/**` or on another file in Shares |
| Base | `feat/beta9` after MIG-B9-20, MIG-B9-25, MIG-B9-26, MIG-B9-17 and MIG-B9-27. The preconditions and the baseline were run on `f855765` (§3, §4), and run again on `dec40b1` when the story started (2026-11-16, macOS 27.0, Node 20.19.0, load 18.44; §15, "Re-baseline on `dec40b1`") |
| Owns | `packages/uxdsl/test/core/sass-stage-win32.test.js` (new), `packages/uxdsl/test/win32-harness.test.js` (new: the encoded negative controls of T3 and T4), `packages/uxdsl/test/helpers/npm.js` (new) |
| Shares | `.github/workflows/ci.yml` (one job added; the `test` and `gate` jobs stay as they are. README §7's row 28, 66; MIG-B9-66 is provisional, decision 15 of 2026-11-10); `packages/uxdsl/test/cli/watch-mode.test.js`, `uxdsl-cli.test.js`, `watch-selection.test.js` and `init.test.js` (the row `packages/uxdsl/test/cli/**`); `packages/uxdsl/test/core/compile-sass.test.js` (`project()`); `packages/uxdsl/test/core/sass-source-maps.test.js` (MIG-B9-13's emulated LM-3 test, on win32); `packages/uxdsl/test/canonical-grammar.test.js`, `no-silent-output.test.js`, `removed-language-surface.test.js` and `types.test.js` (POSIX path literals, `npm pack`, `'dir'` symlinks); `packages/uxdsl/README.md` (one sentence; under §15's question 6, item 1, option (b), also the sentence at lines 1550–1553 on `f855765`, edited rather than appended); `packages/uxdsl/CHANGELOG.md` (one subsection) |
| Output impact | none. CI and tests only: no file under `packages/uxdsl/src` or `packages/uxdsl/bin` changes |

## 1. Goal

A `windows-latest` job in CI runs the `uxdsl` package's own suites, as
`npm --prefix packages/uxdsl test` runs them, on every pull request and every
push to `main`, and passes. Those suites are the build, then the unit, core,
CLI, Vite, webpack and performance tests. The win32 paths that earlier
stories could only emulate or reason about are exercised for real. What they
show is pinned by tests or recorded as findings for the owner. The product
does not change.

## 2. Sources

- The registration, FEAT-010 §2 ([FEAT-010-beta9.md:186](../FEAT-010-beta9.md)):

  > **D11 — CI runs on Windows before the release:** MIG-B9-28 registered, "CI on Windows" (wave 2; its scout sizes it, S or split, since the suites may assume POSIX paths); MIG-B9-91 depends on it. Windows is unverified today (MIG-B9-13's owner flag 20; MIG-B9-23's `realCase` path runs on win32).

- The index ([README.md:370-371](README.md)):

  > MIG-B9-28 has no row yet: its scout sizes it (decision D11 of 2026-11-04),
  > and its story file names the suites it edits.

- MIG-B9-13 §15, owner flag 20 ([MIG-B9-13-compile-on-sass.md:721](MIG-B9-13-compile-on-sass.md)):

  > 20. **Windows is unverified.** CI runs on ubuntu. LM-3's fix was emulated on POSIX by giving the stage map drive-letter sources; on win32, PostCSS's own `origin()` would see a `/C:/…` file that `compile()` replaces from its locator, which is reasoned, not observed.

- MIG-B9-14 §15, follow-ups ([MIG-B9-14-cli-and-adapters.md:666](MIG-B9-14-cli-and-adapters.md)):

  > - **MIG-B9-28.** Windows: the new watch tests, `follow()`'s directories, and webpack's absolute map sources, which `path.resolve` gives a drive letter.

- MIG-B9-23 §15, "Delivery of 2026-11-09", follow-ups ([MIG-B9-23-compile-within-budget.md:1076](MIG-B9-23-compile-within-budget.md)):

  > - **MIG-B9-28.** On Windows, check `realpathSync.native`, `lstat` on junctions, `access(R_OK)` and 8.3 short names. `sass-stage-case.test.js` runs on win32, and T9's NFD half is skipped there with its reason.

  and its §6 ([MIG-B9-23-compile-within-budget.md:369-370](MIG-B9-23-compile-within-budget.md)):

  > - **Windows.** win32 folds case, and `realCase` runs there too; it is
  >   unverified: MIG-B9-91, with MIG-B9-13's flag 20.

- MIG-B9-23's decision 2 of 2026-11-09 ([FEAT-010-beta9.md:260](../FEAT-010-beta9.md)):

  > - **Decision 2 — An execute-only directory (flag 3).** A directory that can be searched but not listed keeps the spelling as written, the base's behavior, through `access(R_OK)` (test T9b), unlike Dart Sass and a realpath-only spelling. Accepted.

- MIG-B9-91's header ([MIG-B9-91-gate-and-release.md:10](MIG-B9-91-gate-and-release.md)):

  > | Depends on | every story of waves 0 to 3 (DEC-03); MIG-B9-28 (CI on Windows) |

- The workflow today, `.github/workflows/ci.yml`: two jobs, `test` (lines 16-45: `runs-on: ubuntu-latest`, `timeout-minutes: 30`, Node 20, npm 11, the installs, the build, `node fixtures/mig07-consumer/run.js`, `npm test`) and `gate` (lines 47-75: `needs: test`, `UXDSL_CHROME_PATH: /usr/bin/google-chrome`, `npm run verify:1.0`). Its install step is a bash loop (lines 34-39).
- The package's test script, `packages/uxdsl/package.json:91`:

  > `"test": "npm run build && node --test test/*.test.js && node --test test/core/*.test.js && node --test test/cli/*.test.js && node --test test/vite/*.test.js && node --test test/webpack/*.test.js && node --test --test-concurrency=1 test/performance/*.test.js",`

- The Sass stage's win32 branches, `packages/uxdsl/src/sass/compile-sass.ts`:
  - line 152: `const FOLDS_CASE = process.platform === 'darwin' || process.platform === 'win32';`
  - lines 384-396, `canList`: `fs.accessSync(dir, fs.constants.R_OK);` decides whether a directory can be listed;
  - lines 427-456, `spell`: a component that is not a symlink (`fs.lstatSync(file).isSymbolicLink()`) takes its name from `fs.realpathSync.native` where that name equals the written one under `toLowerCase()` and `canList` is true; a win32 root gets an upper-case drive letter (line 435).
- The tests that already gate on win32:
  - `packages/uxdsl/test/core/sass-stage-case.test.js:26-31`: `SKIP` is false on darwin and win32; `NO_LISTING_DENIAL` is `'file permissions do not deny listing a directory on win32'` there. Line 48 makes a link with type `'junction'`, and line 146 prints `the NFD half runs on darwin only: NTFS does not take a name in NFC and in NFD for one file` off darwin.
  - `packages/uxdsl/test/core/compile-sass.test.js:1373`: `'file permissions do not deny reads on win32'`.
  - `packages/uxdsl/test/cli/uxdsl-cli.test.js:2140`, `'a backslash separates paths on Windows'`, and `:2428`, `'these file names are not valid on Windows'`.
- MIG-B9-13's emulation, `packages/uxdsl/test/core/sass-source-maps.test.js:418` (`… when the stage names its files as Windows does (C:\\…, emulated) …`) and `:429`, which rewrites every stage-map source to `` `C:${file.split('/').join('\\')}` ``.

## 3. Preconditions

Run on `f855765`, Node 20.19.0, from the worktree root; each exits 0:

```bash
git merge-base --is-ancestor f855765 HEAD                                                          # this base or later
! command grep -qi "windows" .github/workflows/ci.yml                                              # no Windows job yet
test "$(command grep -c "runs-on: ubuntu-latest" .github/workflows/ci.yml)" = 2                   # the two ubuntu jobs
test ! -e .gitattributes                                                                           # no line-ending policy in the repository
command grep -qF "node --test test/*.test.js" packages/uxdsl/package.json                          # the package's script relies on a shell glob
command grep -qF "execFileSync('npm'" packages/uxdsl/test/cli/watch-mode.test.js                   # npm started without a shell
command grep -qF "spawnSync('npm'" packages/uxdsl/test/removed-language-surface.test.js            # the same
command grep -qF "const FOLDS_CASE = process.platform === 'darwin' || process.platform === 'win32';" packages/uxdsl/src/sass/compile-sass.ts
command grep -qF "fs.accessSync(dir, fs.constants.R_OK);" packages/uxdsl/src/sass/compile-sass.ts  # canList, C6c
command grep -qF "the NFD half runs on darwin only" packages/uxdsl/test/core/sass-stage-case.test.js
command grep -qF "when the stage names its files as Windows does (C:" packages/uxdsl/test/core/sass-source-maps.test.js
command grep -qF "const dir = fs.realpathSync(temporaryDirectory('uxdsl-sass-stage-'));" packages/uxdsl/test/core/compile-sass.test.js   # project(), C5
node -v | command grep -q "^v20\.19\."                                                             # CI's Node line
test -f packages/uxdsl/dist/sass/compile-sass.js                                                   # the worktree is built
```

When the story starts, these five start gates also exit 0. On `f855765`
each exits 1, because none of the five stories has merged yet. Each checks
the base itself (HEAD's tree), not a commit subject:

```bash
! command grep -q "includeTheme" packages/uxdsl/src/types.ts                                                          # MIG-B9-20 merged (includeTheme removed from the tests this story shares)
! command grep -qx "To be filled in the delivering PR." docs/features/FEAT-010/MIG-B9-25-suites-remove-temp-dirs.md       # MIG-B9-25 merged (the suites remove their temporary directories)
! command grep -qx "To be filled in the delivering PR." docs/features/FEAT-010/MIG-B9-26-near-misses-debug-isolation.md   # MIG-B9-26 merged (both parts' files, if the owner splits it)
! command grep -qx "To be filled in the delivering PR." docs/features/FEAT-010/MIG-B9-27-postcss-chain.md                 # MIG-B9-27 merged, in either outcome
! command grep -qx "To be filled in the delivering PR." docs/features/FEAT-010/MIG-B9-17-module-isolation-warnings.md     # MIG-B9-17 merged (test/cli/uxdsl-cli.test.js)
```

On that base, the preconditions above and the baseline below are run again.
A line that is only stale (a line number, a count) is corrected as README
§1 item 4 allows.

## 4. Baseline

Nobody can run Windows locally. The Windows baseline is the job's first run,
pushed alone before any fix (README §2, "Verifying without the npm
registry"), recorded in §14. What can be reproduced off Windows was run on
`f855765`, on 2026-11-10, macOS 27.0, Node 20.19.0, with `TMPDIR` set to a
scratch directory. The machine was shared with MIG-B9-20's workflow (load
average 17.37, 15.30, 12.61 at 09:06 EST), so the timings below are
indicative only.

**B1 — A glob no shell expands.** cmd.exe, npm's default script shell on
Windows, does not expand `*`, and Node 20 does not expand a glob given to
`node --test`. Quoting the glob reproduces what cmd.exe passes:

```text
$ (cd packages/uxdsl && node --test 'test/cli/*.test.js'); echo "exit=$?"
Could not find '<repo>/packages/uxdsl/test/cli/*.test.js'
exit=1
$ node --test 'fixtures/mig07-consumer/test/*.test.js'; echo "exit=$?"
Could not find '<repo>/fixtures/mig07-consumer/test/*.test.js'
exit=1
```

Controls, in a scratch directory holding `test/a.test.js` and
`test/b.test.js`:

- Node 22.23.3 expands the same quoted glob: `# tests 2`, `# pass 2`, exit 0.
- Node 20.19.0 given the directory `test/` runs both files, and also runs a
  third file, `test/cases.js`, that is not named like a test: `# tests 3`,
  exit 0. So a directory argument is not a drop-in replacement for the glob
  (§15, question 4).

**B2 — A checkout with CRLF line endings.** Git for Windows' default
installation sets `core.autocrlf=true`, and the repository has no
`.gitattributes`. The emulation clones the base into a scratch directory
with `git clone --shared --no-checkout` and checks it out with
`git -c core.autocrlf=true checkout f855765`. It links the worktree's
`node_modules` (the root's and `packages/uxdsl`'s) and copies its built
`packages/uxdsl/dist`.

```text
$ git ls-files --eol | awk '{print $2}' | sort | uniq -c
   5 w/-text
 667 w/crlf
   1 w/none
$ (cd packages/uxdsl && node --test test/*.test.js); echo "exit=$?"     # 18.3 s
not ok 486 - MIG-B6-25: the oracle fixture is the frozen pre-optimization implementation
    test/fixtures/reference-integrity-oracle.js changed. …
    + '95b293b181026043cfe60f6e9e5e8e5011b98579c33fb00924fcb9e45a1d0ff3'
    - '7d6fac7b57adfe644e2e456d04dfcc668904d14bc0a4eb5a495647c1fb519059'
not ok 595 - MIG-B6-27: the schema is generated, and --check detects drift
    --check should pass on a clean tree: Generated artifact drift: packages/uxdsl-vscode/src/generated-completions.ts
    (and uxdsl.custom-data.json, syntaxes/uxdsl.tmLanguage.json, packages/uxdsl/schema/theme.schema.json)
# tests 723
# pass 721
# fail 2
exit=1
$ (cd packages/uxdsl && node --test test/core/*.test.js); echo "exit=$?"
# tests 342
# pass 341
# fail 0
# skipped 1          (protect's Bootstrap corpus test, as on the base)
exit=0
$ node fixtures/parity/run.js; echo "exit=$?"
  ok     - comment-with-url
  ok     - duplicate-import
[import-cycle] error message drifted from the oracle.
exit=1
$ node scripts/generate-agent-guide.js --check; echo "exit=$?"
Generated agent guide drift: packages/uxdsl/docs/agent-guide.md — run node scripts/generate-agent-guide.js
exit=1
$ node scripts/generate-language-artifacts.js --check; echo "exit=$?"
Generated artifact drift: packages/uxdsl-vscode/src/generated-completions.ts
Generated artifact drift: packages/uxdsl-vscode/uxdsl.custom-data.json
Generated artifact drift: packages/uxdsl-vscode/syntaxes/uxdsl.tmLanguage.json
Generated artifact drift: packages/uxdsl/schema/theme.schema.json
exit=1
```

Control: the base's own LF tree, `(cd packages/uxdsl && node --test test/*.test.js)`
in the worktree gives `# tests 723`, `# pass 723`, `# skipped 0`, exit 0.
The parity oracle's printed expected and actual look identical: they differ
by the `\r` the CRLF checkout put into the committed oracle.

Re-run on `dec40b1` (2026-11-16): `698 w/crlf` (5 `w/-text`, 1 `w/none`),
and the unit group gives `# tests 756`, `# pass 753`, `# fail 3`: the two
above and `Once() is the sequence of named steps, over one Compilation
object` (`compiler-structure.test.js`). The LF control gives 756/756.

**B3 — What the package's suites assume, read from the base.**

```text
$ command grep -rnE "execFileSync\('npm'|spawnSync\('npm'" packages/uxdsl/test
packages/uxdsl/test/cli/watch-mode.test.js:78:  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--no-save', POSTCSS_UXDSL_DIR], …
packages/uxdsl/test/removed-language-surface.test.js:155:  const packed = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], …
$ command grep -rnE "symlinkSync\(.*'(dir|junction)'\)" packages/uxdsl/test
packages/uxdsl/test/core/compile-sass.test.js:455:  … 'junction');
packages/uxdsl/test/core/sass-stage-case.test.js:48:  … 'junction');
packages/uxdsl/test/cli/init.test.js:96:  … 'dir');
packages/uxdsl/test/types.test.js:31:  … 'dir');
packages/uxdsl/test/types.test.js:108:  … 'dir');
$ command grep -rnE "(error\.file|\.file), '/" packages/uxdsl/test
packages/uxdsl/test/no-silent-output.test.js:27:  assert.equal(error.file, '/project/src/app.uxdsl');
packages/uxdsl/test/canonical-grammar.test.js:25:  assert.equal(error.file, '/project/src/app.uxdsl');
packages/uxdsl/test/removed-language-surface.test.js:34:  assert.equal(error.file, '/project/src/app.uxdsl');
```

- `installPostcssUxdsl` (watch-mode.test.js:77-79) is called by most of the
  file's watch tests (lines 38, 122, 147, 184, 213, 243, 286, 318 and more).
- watch-mode.test.js asserts CLI lines with POSIX separators, such as
  `'[uxdsl] add src/components/forms/input.uxdsl'` (line 1143), while the
  CLI prints `path.relative` (`bin/uxdsl.js:1168`, `:1907`, `:1925`).
- The package's tests read `fixtures/mig07-consumer/theme.json` and its
  `entries/` as committed files. None needs the installed tarball, so the
  Windows job does not run `fixtures/mig07-consumer/run.js`.
- Re-run on `dec40b1` (2026-11-16): the two npm calls are at
  `watch-mode.test.js:78` and `removed-language-surface.test.js:154`; the
  links at `compile-sass.test.js:464` (`'junction'`), `init.test.js:98`
  (`'dir'`), `types.test.js:31` and `:108` (`'dir'`), and, since MIG-B9-25,
  `temporary-directory.test.js:37` and `:49` (no type: a directory symlink,
  which needs the privilege to create one on win32). POSIX path literals are
  also compared with PostCSS's `file` in `postcss-chain.test.js:229` (MIG-B9-27)
  and `sass-stage-diagnostics.test.js:419`. The watch line is at
  `watch-mode.test.js:1145`, and the CLI prints it at `bin/uxdsl.js:1874`
  (`built` at `:1138`, `regenerated` at `:1893` and `:1897`).
- Under `packages/uxdsl/test`, a test is skipped by platform at exactly the
  five places C3 lists. Every other `skip:` is the Bootstrap corpus test's
  (`UXDSL_SASS_CORPUS`).

## 5. Contract

- **C1 — A Windows job.** `.github/workflows/ci.yml` has a third job,
  `windows`, named `npm test (uxdsl, Windows)`. It runs on `windows-latest`,
  on the workflow's existing triggers (every pull request, every push to
  `main`), with no `needs`. In order, it:
  1. sets `core.autocrlf` to `false` globally, before `actions/checkout@v5`
     (§15, question 3, option (a));
  2. checks out the repository;
  3. sets up Node 20 with the npm cache, as the `test` job does;
  4. installs npm 11;
  5. sets npm's `script-shell` to Git for Windows' `bash.exe` (question 4,
     option (a));
  6. runs the line-ending guard of C2;
  7. installs the root and `packages/uxdsl` with
     `npm ci --ignore-scripts --no-audit --no-fund`;
  8. runs `npm --prefix packages/uxdsl test`.

  The job exits 0. The `test` and `gate` jobs, and the workflow's `on`,
  `concurrency` and `env`, stay byte-identical.
- **C2 — The tree is ubuntu's.** A step prints the number of files that
  `git ls-files --eol` reports as `w/crlf`. It exits 1 when that number is
  not 0.
- **C3 — Every test runs; each skip is named.** In the job's log, each of
  the six `node --test` groups that `npm --prefix packages/uxdsl test` runs
  (`test/*.test.js`, `test/core`, `test/cli`, `test/vite`, `test/webpack`,
  `test/performance`) reports `# fail 0`. Its `# tests` equals the ubuntu
  `test` job's count for the same group on the same commit. On
  `windows-latest` the skipped tests are exactly these five:
  - `MIG-B9-11: protect handles the Bootstrap corpus in under 20 ms, and is the identity on every file`
    (no `UXDSL_SASS_CORPUS`, as on ubuntu);
  - `MIG-B9-12: an I/O error while reading a loaded file, or a missing entry, is rethrown unchanged`
    (file permissions do not deny reads on win32);
  - `MIG-B9-23: a name in a directory that cannot be listed keeps its written spelling (an execute-only directory)`
    (`chmod` does not deny listing on win32; C6c covers the ACL that does);
  - `MIG-B9-14: generate-entry percent-encodes a backslash in a file name, …`
    and `MIG-B9-22: the recorded invocation writes whitespace, a quote, a backslash, …`
    (file names that are not valid on Windows).

  The tests of `sass-stage-win32.test.js` are not among them. MIG-B9-23's T9
  prints `the NFD half runs on darwin only: …` in the log. Any other test
  that cannot run on win32 is a change to this contract: §7's stop rule.
- **C4 — The tests run npm the same way everywhere.** Every npm invocation
  under `packages/uxdsl/test` goes through `packages/uxdsl/test/helpers/npm.js`.
  The helper starts npm on win32, where `npm` is `npm.cmd`, and on POSIX. On
  POSIX the command, its arguments and its working directory are the ones
  the tests pass today.
- **C5 — Paths in assertions follow the platform.** A test that compares a
  path built with `path` with an expected one spells the expected path the
  same platform's way: an error's `file`, a CLI message, a watch event line,
  a map source.
  - It uses `path.resolve`, `path.join`, or a separator-independent form of
    a printed relative path.
  - The CLI's own output does not change. Its messages keep native
    separators (`[uxdsl] built …`, `add …`, `regenerated …`; question 7,
    option (a)). `generate-entry`'s recorded invocation stays POSIX
    (MIG-B9-22, E1).
  - A comparison with a Dart Sass twin names its project by
    `fs.realpathSync.native`, as `sass-stage-case.test.js` does. An 8.3 short
    name in the temporary directory is then the long name on both sides; C6a
    pins the short one.
- **C6 — The win32 checks the earlier stories registered, run for real.**
  `packages/uxdsl/test/core/sass-stage-win32.test.js` holds the new tests.
  Each is skipped on other platforms with the reason. On win32 each runs,
  and fails rather than skips when its precondition cannot be set up.
  - **C6a — 8.3 short names (MIG-B9-23).** A path component written as an
    8.3 short name keeps that spelling in `compileSassStage`'s `loadedFiles`
    and `compile()`'s `dependencies`. That is how its directory lists it: no
    entry equals it under `toLowerCase()` (MIG-B9-23's C3). Meanwhile
    `fs.realpathSync.native` spells it in its long form. This is question 6,
    item 2, option (a).
  - **C6b — Junctions (MIG-B9-23).** `fs.lstatSync` reports a junction as a
    symbolic link. A junction on a loaded file's path keeps its own name, and
    the only directory listed is the one that holds it. MIG-B9-23's T5, its
    negative control, T6 and T9's link half run on win32 with junctions (its
    line 48). The new file asserts `lstat` itself.
  - **C6c — `access(R_OK)` (MIG-B9-23, decision 2 of 2026-11-09).** Take a
    directory whose ACL denies listing to the runner's own user (`icacls`);
    `fs.readdirSync` of it fails with `EPERM`. A name written in another case
    in that directory keeps its written case in `loadedFiles` and
    `dependencies`, as decision 2 states with no platform qualifier ("keeps
    the spelling as written … through `access(R_OK)`"), as the package
    README says "On macOS and Windows" (lines 1550–1553 on `f855765`), and as
    `compile-sass.ts`'s header says for case-insensitive systems (lines
    36–40). The test removes the ACL before it removes the directory.
    - Node's documentation predicts the opposite on win32: `fs.access` does
      not read ACLs there, so `canList` is true and the on-disk case would be
      taken (§15, finding 3). That is a prediction, not an observation. If
      `windows-latest` shows it, C6c does not hold: §7's stop rule applies,
      T7's failure message names the finding, and the owner answers
      question 6, item 1. This story never pins the on-disk case as passing
      until the owner has chosen option (b) there.
  - **C6d — `realpathSync.native` (MIG-B9-23).** It is exercised by C6a and
    by MIG-B9-23's T5 and T6 on win32. For a path with no junction on it, the
    Sass stage lists no directory.
  - **C6e — LM-3 (MIG-B9-13, flag 20).** Take a `compile()` with
    `sourceMap: 'external'` and `to` in another directory. Its final map
    keeps every author mapping, while the stage's own map names its files
    with a drive letter. This is observed, not emulated. On win32,
    MIG-B9-13's emulated test applies no emulation of its own, since the
    stage already names its files that way, and asserts what it asserts
    today. On POSIX that test is unchanged.
  - **C6f — webpack's absolute map sources (MIG-B9-14).** The map tests in
    `test/webpack/loader.test.js` pass on win32. Their maps name
    `shared/_far.uxdsl`, `styles/_partial.uxdsl` and `styles/panel.uxdsl`.
  - **C6g — Watch (MIG-B9-14, MIG-B9-22).** `test/cli/watch-mode.test.js`
    and `watch-selection.test.js` pass whole on win32, `follow()`'s
    directories and the regenerated entry included.
- **C7 — Nothing else changes.**
  - No file under `packages/uxdsl/src` or `packages/uxdsl/bin` changes.
  - No `package.json` or lockfile changes, the root's or the package's.
  - On macOS and Linux, the package suites and `npm test` give the base's
    results, plus the new file's tests, skipped there with their reason.

Must stay byte-identical with the base:

- `packages/uxdsl/src/**`, `packages/uxdsl/bin/**`, and the `dist` they
  build;
- `package.json` and `package-lock.json`, the root's and
  `packages/uxdsl`'s;
- the `test` and `gate` jobs;
- `fixtures/**`, the parity oracles included;
- the playground, its captures and `src/app/uxdsl.css`;
- `DIAGNOSTIC_CATALOG`.

## 6. Out of scope

- **The root `npm test`'s other suites on Windows:**
  - the parity oracles, `fixtures/mig07-consumer` (its preparation packs and
    installs the tarball), `fixtures/mig-b2-03-cli-init`, `fixtures/sass-corpus/run.test.js`,
    `fixtures/release-1.0`'s three unit tests and `packages/_deprecated/shims.test.js`:
    question 1, option (b), a second part with no id that the owner
    registers;
  - the playground's and the extension's suites, `scripts/*.test.js`, and
    the two generated-artifact checks: question 1, option (c).
- **`npm run verify:1.0` on Windows:** question 2.
- **A `.gitattributes`:** question 3, option (b).
- **Glob-free package scripts:** question 4, option (b).
- **A product defect the job finds:** a finding in §15, and question 5.
- **The win32 spellings changed** (an ACL that denies listing, 8.3 short
  names): question 6.
- **CLI paths printed in POSIX form:** question 7, option (b).
- **A user's `.uxdsl` file with CRLF line endings:** no test covers it. It is
  a §15 finding with a proposed follow-up and no id.
- **The flaky watch tests:** MIG-B9-19 owns the CLI's (decision 28 of
  2026-11-13); the atomic-replace failure is MIG-B9-06's (decision 28 of
  2026-11-15), and so is the webpack loader watch tests' extra-build class
  (decision 40 of 2026-11-15).
- **Timing on Windows:** P10 is measured on the owner's Mac (decision D9 of
  2026-11-04), and the performance group asserts only ratios
  (`test/performance/reference-performance.test.js:3`).

## 7. Approach and traps

Non-normative.

1. **Push the job alone first.** The first commit adds the `windows` job and
   nothing else. CI records its failures, which are the Windows baseline
   (§4), and §14 keeps the failing test titles and their first error lines.
   The fixes follow, one concern per commit, and CI green on the branch is
   the evidence (README §2, "Verifying without the npm registry").
2. **A sketch of the job.** Defaults give every step bash, so the existing
   install loop's syntax works:

   ```yaml
     windows:
       name: npm test (uxdsl, Windows)
       runs-on: windows-latest
       timeout-minutes: 45
       defaults:
         run:
           shell: bash
       steps:
         - name: Check out with LF line endings, as on ubuntu
           run: git config --global core.autocrlf false
         - uses: actions/checkout@v5
         - uses: actions/setup-node@v5
           with:
             node-version: 20
             cache: npm
             cache-dependency-path: '**/package-lock.json'
         - name: npm 11
           run: npm install -g npm@11 && npm -v
         - name: npm runs the package's scripts with bash, which expands their globs
           run: npm config set script-shell "$(cygpath -w "$(command -v bash)")"
         - name: The tree has ubuntu's line endings
           run: |
             n=$(git ls-files --eol | grep -c 'w/crlf' || true)
             echo "files checked out with CRLF: $n"
             test "$n" = 0
         - name: Install the root and the package
           run: |
             npm ci --ignore-scripts --no-audit --no-fund
             (cd packages/uxdsl && npm ci --ignore-scripts --no-audit --no-fund)
         - name: Test the package
           run: npm --prefix packages/uxdsl test
   ```

   The 45-minute timeout is a guess, half again the `test` job's 30, since
   Windows runners are slower. §14 records the first run's duration. Record
   also `git config --show-origin --get core.autocrlf` before the first step,
   which tells whether the image defaults to `true` (AC7).
3. **What the first run is expected to show**, from §4. Each item is a
   harness fix in Shares:
   - the watch tests and `npm pack` cannot start `npm`. `execFile` does not
     search `PATHEXT`, so `npm` is `ENOENT`. Since Node's security release of
     April 2024 (20.12.2), a `.cmd` started without `shell: true` is `EINVAL`.
     The helper can pass `shell: true` on win32 with each argument quoted,
     or run npm's own `npm-cli.js` with `process.execPath`;
   - `error.file` against `'/project/src/app.uxdsl'` (three files): PostCSS
     resolves `from` against the current drive, so on win32 it is
     `D:\project\src\app.uxdsl`;
   - CLI lines with `src/…`, which the CLI prints `src\…` on win32;
   - the Dart Sass twins in `compile-sass.test.js`. On GitHub's Windows
     runners the temporary directory is usually written with an 8.3 short
     component (`C:\Users\RUNNER~1\…`). `project()` uses `fs.realpathSync`,
     whose JavaScript implementation keeps it. Dart Sass spells it from
     `realpathSync.native`, in its long form, while the stage keeps it as
     written (C6a), so `loadedFiles` would differ. `fs.realpathSync.native`
     in `project()` fixes the harness (C5);
   - MIG-B9-13's emulated LM-3 test would prefix `C:` to a path that already
     has a drive letter (`C:D:\…`);
   - `'dir'` symlinks (`init.test.js:96`, `types.test.js:31` and `:108`) need
     the privilege to create symbolic links. GitHub's hosted runner account
     is an administrator. If the first run shows `EPERM`, use `'junction'`,
     which needs no privilege.
4. **The new tests.**
   - **C6a:** take `os.tmpdir()` when `fs.realpathSync.native` changes one of
     its components. Otherwise make a directory with a long name under it,
     and read its short form back with
     `cmd /d /c for %I in ("<dir>") do @echo %~sI`. With neither, the test
     fails on win32 with a message naming the volume.
   - **C6c:** `icacls <dir> /deny "%USERNAME%:(RD)"` denies listing.
     `icacls <dir> /remove:d "%USERNAME%"` in `t.after` lifts it, before the
     directory is removed. If `fs.accessSync(dir, R_OK)` throws, Node saw the
     ACL after all: the written case is kept, C6c holds, §14 records it, and
     question 6, item 1 needs no answer. If it does not throw and the name
     takes its on-disk case, C6c does not hold: the stop rule below.
   - **C6e:** the negative control hands the stage's map to PostCSS as the
     stage wrote it, without the conversion `compile()` applies (`chainable`,
     `compile.ts:467-469`), and asserts that the author mappings are lost.
     That shows the measure can see the loss LM-3 fixed. If they are not
     lost on real win32, that is a finding about LM-3, recorded in §15.
5. **Traps.**
   - The docs guard (`scripts/verify-docs-update.js`) counts a file under
     `packages/uxdsl/test` as package code. It asks for
     `packages/uxdsl/README.md` in every commit that touches one. Keep the
     test changes in as few commits as the concerns allow, each with the
     README staged. The CHANGELOG is not required by the guard; the story
     adds one subsection (§10).
   - The pre-commit hook builds the playground (about three minutes) on
     every commit. No `--no-verify`, no `HUSKY=0`.
   - On Windows, `fs.rmSync` of a directory a child process or a watcher
     still holds can fail with `EBUSY` or `EPERM`. Give the cleanups that
     MIG-B9-25 adds `maxRetries` where the first run shows it. Do not
     swallow the error.
   - No `continue-on-error`, no new `skip:` and no `--test-name-pattern` to
     make the job green: C3 names every skip.
   - The flaky watch tests (MIG-B9-19's, MIG-B9-06's) may also fail on Windows. Record each
     occurrence in §14 with its log. Re-run the job once and record both
     runs. It is not fixed here.
   - The Windows job does not prepare `fixtures/mig07-consumer`; the
     package's tests read only its committed files (§4, B3).
   - The repository is public (`gh api repos/rsantoyo-dev/uxdsl` reports
     `public`), so GitHub's hosted Windows runners cost no minutes.
   - D1 of 2026-11-04: an M story that changes no engine file is delivered
     by the light flow. If the owner answers question 5 or 6 so that
     `packages/uxdsl/src` changes, the story takes the full flow.

Stop rule: stop at the first of these on `windows-latest`:

- a failure whose cause is in `packages/uxdsl/src` or `packages/uxdsl/bin`;
- a test that cannot run on win32 and is not in C3's list;
- a C6 check that does not hold.

Record it in §15 with the log excerpt and a proposed fix, and set the story
to Blocked. The owner decides (question 5). Never change a file under
`packages/uxdsl/src` or `bin`, add a skip, or weaken an assertion to make
the job pass.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `.github/workflows/ci.yml`, job `windows`; its log through `gh run view --job <id> --log` | the six groups' TAP summaries | CI (`windows-latest`) | C1, C3 | §4's B1: an unexpanded glob runs no test and exits 1. The job's first run, pushed alone, fails on what the fixes remove (§7, item 1) |
| T2 | same job, step "The tree has ubuntu's line endings" | — | CI | C2 | §4's B2: the same count on a checkout with `core.autocrlf=true` is 698 on `dec40b1` (667 on `f855765`), and the step exits 1. On that tree three unit tests (two on `f855765`), the parity oracles and two `--check`s fail |
| T3 | `packages/uxdsl/test/helpers/npm.js`, through `test/cli/watch-mode.test.js` and `test/removed-language-surface.test.js` | their existing titles | unit, CLI | C4 | encoded in `packages/uxdsl/test/win32-harness.test.js` (new): `MIG-B9-28: on win32 npm cannot be started without the helper, and the helper starts it (negative control)`. Without the helper, `execFileSync('npm', ['--version'])` fails with `ENOENT` or `EINVAL`; through it, the same call exits 0. Skipped off win32 with its reason |
| T4 | the tests in Shares that compare paths | their existing titles | unit, CLI | C5 | encoded in `win32-harness.test.js`: `MIG-B9-28: on win32 a POSIX absolute literal is not the path PostCSS and path.resolve give for it (negative control)`. `path.resolve('/project/src/app.uxdsl')` starts with a drive letter and differs from the literal, so a test that compared the literal fails there. Skipped off win32 with its reason |
| T5 | `packages/uxdsl/test/core/sass-stage-win32.test.js` (new; removes what it creates, `t.after`) | `MIG-B9-28: on win32 a path component written as an 8.3 short name keeps that spelling in loadedFiles and compile()'s dependencies, as its directory lists it` | unit | C6a, C6d | the test asserts that `fs.realpathSync.native` spells the component in its long form, so a spelling taken from the real path unconditionally, as Dart Sass does, fails it. On win32 it fails, never skips, when no short name can be found or made |
| T6 | same | `MIG-B9-28: on win32 lstat reports a junction as a symbolic link, so the Sass stage keeps the junction's own name and lists only the directory that holds it` | unit | C6b | a listing recorder, as in `sass-stage-case.test.js`, sees the one listing of the junction's directory |
| T7 | same | `MIG-B9-28: on win32 a name written in another case in a directory whose ACL denies listing keeps its written case, as decision 2 of 2026-11-09 states` | unit | C6c | it first asserts that `fs.readdirSync` of the directory fails with `EPERM`, so the ACL is in force. A name that takes its on-disk case fails the test with a message that names §15's finding 3 and question 6, item 1: the stop rule, never a pass |
| T8 | same | `MIG-B9-28: on win32 the final map keeps every author mapping when to is in another directory, the Sass stage naming its files with a drive letter (MIG-B9-13's LM-3, observed)` | unit | C6e | it asserts that the stage map's sources start with a drive letter, and that the same map handed to PostCSS without `compile()`'s conversion loses the author mappings |
| T9 | `test/core/sass-stage-case.test.js`, `test/webpack/loader.test.js`, `test/cli/watch-mode.test.js` and `watch-selection.test.js` (existing) | their titles, run on win32 | unit, CLI | C6b, C6d, C6f, C6g | the job's first run, for any of them that fails there before a harness fix |
| T10 | macOS: `npm --prefix packages/uxdsl test`, `npm test` | — | all | C7 | — |

T5 to T8, and the two tests of `win32-harness.test.js`, are skipped on
every platform but win32, each with the reason
`'the Windows paths this checks exist only on win32'` or a narrower one.

## 9. Acceptance criteria

`<PR>` is the delivering pull request, and `<id>` is its `windows` job's id
on the branch tip.

- **AC1** `gh pr checks <PR> --json name,state --jq '.[] | select(.name == "npm test (uxdsl, Windows)") | .state' | command grep -qx SUCCESS`
  exits 0 for the branch tip.
  - Test file: the `windows` job.
  - Mutation: without the `script-shell` step, `node --test test/*.test.js`
    receives the glob unexpanded and the job fails (B1).
- **AC2** With `gh run view --job <id> --log > "$TMPDIR/windows.log"`, this
  exits 0:
  `test "$(command grep -c '# fail 0' "$TMPDIR/windows.log")" = 6 && test "$(command grep -c '# SKIP' "$TMPDIR/windows.log")" = 5 && test "$(command grep -cE 'ok [0-9]+ - MIG-B9-28:' "$TMPDIR/windows.log")" = 6 && ! command grep -E 'ok [0-9]+ - MIG-B9-28:.*# SKIP' "$TMPDIR/windows.log" && command grep -q 'the NFD half runs on darwin only' "$TMPDIR/windows.log"`.
  - It checks `# fail 0` for each of the six groups, `# SKIP` on C3's five
    titles only, T5 to T8 and the two `win32-harness.test.js` tests run, and
    the NFD diagnostic of MIG-B9-23's T9.
  - The six groups' `# tests` lines, taken in group order from that log and
    from the ubuntu `test` job's log of the same commit, are compared with
    `diff`, which exits 0. §14 records both lists.

  Test files: the job, and `sass-stage-win32.test.js`. Mutation: a skip
  added on win32 to any other test, or a T5 that skips when it finds no
  short name, changes the list.
- **AC3** On macOS,
  `TMPDIR=<empty dir> node --test packages/uxdsl/test/core/sass-stage-win32.test.js packages/uxdsl/test/win32-harness.test.js`
  exits 0. It prints `# skipped 6`, each test with its reason, and leaves
  `<empty dir>` empty.
  - Test files: `sass-stage-win32.test.js`, `win32-harness.test.js`.
  - Mutation: a test without its platform skip fails on darwin, where
    there is no `icacls` and no 8.3 name.
- **AC4** On macOS, `npm --prefix packages/uxdsl test` exits 0 and
  `npm test` exits 0. Each group's `# tests` is BASE's, plus the four tests
  of `sass-stage-win32.test.js` in `test/core` and the two of
  `win32-harness.test.js` in `test/*.test.js`, which are skipped there.
  - Test files: the suites.
  - Mutation: none. This is an invariant guard (C7).
- **AC5** This command exits 0:
  `test "$(git diff -U0 "$(git merge-base HEAD origin/feat/beta9)" -- .github/workflows/ci.yml | command grep -c '^-[^-]')" = 0`.
  No line of the existing workflow is removed or changed.
  - Test file: `.github/workflows/ci.yml`.
  - Mutation: any edit to the `test` or `gate` job makes it exit 1.
- **AC6** This command exits 0:
  `git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- packages/uxdsl/src packages/uxdsl/bin packages/uxdsl/package.json packages/uxdsl/package-lock.json package.json package-lock.json`.
  - Test file: none. This is an invariant guard (C7).
  - Mutation: a product or script change makes it exit 1.
- **AC7** `gh run view --job <id> --log | command grep -q "files checked out with CRLF: 0"`
  exits 0: the line-ending step printed it on `windows-latest`.
  - Locally, the same command on a clone checked out with
    `core.autocrlf=true` exits 1 (B2: 698 files on `dec40b1`, 667 on `f855765`).
  - §14 records the image's own `core.autocrlf` with its origin.
  - Test file: the job's step.
  - Mutation: without the `core.autocrlf` step, on an image whose Git
    defaults to `true`, the job stops at this step.

Owner checks, never marked PASS by the agent:

- Answer §15's questions before the story starts.
- Read the win32 spelling that the CHANGELOG and the package README record
  (C6a), and C6c's, if question 6, item 1 is answered (b).

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes. One subsection under `## 0.5.0-beta.9 — unreleased`: the package's suites run on Windows in CI, and the win32 spelling of C6a (and C6c's on-disk case, only under question 6, item 1, option (b)). There is no `### Visual changes`, since compiled output does not change |
| package README | yes. The docs guard asks for it with any change under `packages/uxdsl/test`: one sentence (§11) |
| `verify-docs-update.js` classification | no (no file under `packages/uxdsl/src`) |
| `npm run generate:language` | no |
| `AGENTS.md` + agent guide | no |
| `DIAGNOSTIC_CATALOG` | no |
| `npm run generate:capabilities` | no |
| playground `uxdsl:build` + captures | no (nothing they derive from changes); `npm test` checks them |
| `migration.md` | no |

## 11. Documentation

- `packages/uxdsl/CHANGELOG.md`: one subsection, `### CI on Windows (MIG-B9-28)`,
  under `## 0.5.0-beta.9 — unreleased`. It covers what the Windows job runs,
  and the win32 spelling C6a observes: a component written as an 8.3 short
  name keeps that spelling. Only if the owner answers question 6, item 1
  with (b): on win32, a name in a directory whose ACL denies listing takes
  its on-disk case, unlike macOS.
- `packages/uxdsl/README.md`: one sentence after the sentence that ends at
  line 1685 on `dec40b1` ("…on a loaded file's path.", inside list item 2,
  which continues at line 1686), whose item says "On macOS and Windows
  each loaded file is spelled in its on-disk case". The sentence says that
  CI runs the package's suites on Windows, and gives C6a's spelling. Only
  under question 6, item 1, option (b): the sentence at lines 1679–1682 on
  `dec40b1` (1550–1553 on `f855765`; "…or one in a directory that cannot be listed, keeps the spelling it is
  written in") is edited so that it names macOS only, since an appended
  sentence would leave the README contradicting itself.

## 12. Verification

```bash
node --test packages/uxdsl/test/core/sass-stage-win32.test.js packages/uxdsl/test/win32-harness.test.js   # macOS: exit 0, # skipped 6
npm --prefix packages/uxdsl test                                               # background; exit 0
npm test                                                                       # background; exit 0
test "$(git diff -U0 "$(git merge-base HEAD origin/feat/beta9)" -- .github/workflows/ci.yml | command grep -c '^-[^-]')" = 0   # exit 0
git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- packages/uxdsl/src packages/uxdsl/bin packages/uxdsl/package.json packages/uxdsl/package-lock.json package.json package-lock.json   # exit 0
gh pr checks <PR> --json name,state --jq '.[] | select(.name == "npm test (uxdsl, Windows)") | .state' | command grep -qx SUCCESS   # exit 0 (AC1)
gh run view --job <id> --log | command grep -E "# (tests|pass|fail|skipped) |# SKIP|MIG-B9-28:|NFD half"   # AC2's lines
```

`npm run verify:1.0` is not needed for this story, since no product file
changes. CI's `gate` job runs it on the PR as usual.

## 13. Delivery

Branch `feat/b9-28-ci-on-windows`. Commits, in this order:

1. `ci(FEAT-010): MIG-B9-28 - a windows-latest job runs the uxdsl package's suites`,
   pushed alone. Its CI run is the Windows baseline.
2. `test(FEAT-010): MIG-B9-28 - the package's tests start npm and compare paths the same way on Windows`.
3. `test(FEAT-010): MIG-B9-28 - the win32 spellings and source maps, observed on windows-latest`.

PR title: `FEAT-010: MIG-B9-28 - CI on Windows`. The body:

- **Goal:** §1, in two sentences.
- **The Windows baseline:** the first run's failing titles, with their first
  error lines.
- **C3:** the per-group counts on Windows and on ubuntu for the tip, and the
  five skips.
- **C6:** what T5 to T8 observed, the 8.3 name and the ACL included.
- **Not run, or not a pass:** verify:1.0 on Windows, the root `npm test`'s
  other suites on Windows, and Windows on ARM.
- **Owner checks:** the list in §9.
- The last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Found while writing this story (2026-11-10)

Written on `f855765`. §4 holds the commands and their output.

1. **No shell expands the package's test globs on Windows.** npm runs
   scripts with cmd.exe there, and Node 20.19.0 reads `test/*.test.js` as a
   file name: `Could not find …`, exit 1 (B1). The same holds for every glob
   in the root `npm test` script. Node 22 would expand it, but CI and D10
   are on Node 20.
2. **A CRLF checkout fails the package's own suites, the parity oracles and
   both generated-artifact checks** (B2). The repository has no
   `.gitattributes`. Git for Windows installs with `core.autocrlf=true` by
   default; whether the `windows-latest` image keeps that is recorded on the
   first run.
3. **`access(R_OK)` does not answer "can this directory be listed" on
   Windows.** Node's documentation says `fs.access` does not check ACLs on
   Windows. So `canList` (`compile-sass.ts:384-396`) is true for any
   directory there. The written case that MIG-B9-23's C3 and decision 2 of
   2026-11-09 keep in a directory that cannot be listed then holds on macOS
   only. T9b's skip reason, "file permissions do not deny listing a
   directory on win32", is true of `chmod` but not of an ACL. This is
   predicted from Node's documentation, not observed. C6c expects decision
   2's written case; if `windows-latest` shows the on-disk case, the story
   stops (§7) and question 6 asks the owner.
4. **The Dart Sass twins in `compile-sass.test.js` would compare an 8.3 short
   name with its long form.** Its `project()` uses `fs.realpathSync`
   (line 57). `sass-stage-case.test.js` uses `fs.realpathSync.native`
   (line 39). §7, item 3.
5. **MIG-B9-13's emulated LM-3 test would emulate on top of a real drive
   letter on win32** (`sass-source-maps.test.js:429`).
6. **The CLI prints native paths; its recorded invocation is POSIX.** Tests
   assert `src/…` in CLI lines, such as `watch-mode.test.js:1143`. Question 7.
7. **Proposed, no id: a user's CRLF `.uxdsl` file.** A Windows editor may
   save `.uxdsl` sources with CRLF. No test compiles one, and C2 makes the
   job's own tree LF. A test that a CRLF source compiles to the CSS of its
   LF twin would cover it. That would fit question 1's second part or a
   story of its own.
8. **The Sass stage's header comment** (`compile-sass.ts:36-40`) and the
   package README's sentence at lines 1550-1553 say that "a name in a
   directory that cannot be listed" keeps its written case, on macOS and
   Windows alike. Under question 6, item 1, option (b), this story edits
   that README sentence to name macOS only, and its own sentence states
   win32's behavior. The source comment stays as it is until a story edits
   `compile-sass.ts` after this one.

### Open questions for the owner (answer before implementing)

1. **What does the Windows job run, and is there a second part?**
   - (a) The package's own suites, `npm --prefix packages/uxdsl test`: this
     story. They hold every test of what MIG-B9-13, 14, 22 and 23 flagged as
     unverified on Windows.
   - (b) (a), then a second part with no id, which the owner registers, for
     the product fixtures of the root `npm test`:
     - `fixtures/parity/run.js`;
     - `fixtures/mig07-consumer`, whose preparation packs and installs the
       tarball;
     - `fixtures/mig-b2-03-cli-init/run.js`;
     - `fixtures/sass-corpus/run.test.js`;
     - `fixtures/release-1.0`'s `contrast-baseline`, `audit-lock` and
       `verdicts` tests;
     - `packages/_deprecated/shims.test.js`.

     Three of those files start `npm` (`fixtures/mig07-consumer/run.js:37,39,49`,
     `fixtures/lib/tarball-consumer.js:27,28,52`,
     `fixtures/mig-b2-03-cli-init/run.js:59`). Under §7 they share
     `fixtures/mig07-consumer/**`, `fixtures/mig-b2-03-cli-init/**` and
     `fixtures/parity/run.js` with MIG-B9-20.
   - (c) The whole root `npm test` on Windows: (b) plus the playground's and
     the extension's suites, `scripts/*.test.js` and the two
     generated-artifact checks. These test the repository's own tooling. For
     example, `scripts/release.test.js` puts an executable file named `npm`,
     a `#!/usr/bin/env node` script, on `PATH` (`:273`, `:353-358`, `:367`),
     which Windows does not run as `npm`.

   Recommendation: (a) here, before MIG-B9-91, as D11 asks. Register (b)
   for `0.5.0-beta.10`, without blocking MIG-B9-91, if the owner wants a
   tarball installed on Windows by CI. Not (c): those tools run on the
   owner's Mac and on ubuntu, never on a user's Windows machine.
   Assumed until answered: (a). The job runs on the `test` job's triggers:
   every pull request, every push to `main`.
2. **`npm run verify:1.0` on Windows.**
   - (a) Not in `0.5.0-beta.9`.
   - (b) A Windows gate job with `--skip-playground-walk`, as a later part
     with no id.
   - (c) The full gate on Windows.

   The gate builds Next.js and Vite apps from the tarball and drives
   Chrome. Its Chrome default is macOS's (`fixtures/release-1.0/run.js:41`),
   and the CSS-modules browser fixture stops its server through a POSIX
   process group (`fixtures/mig02-nextjs-cssmodules/browser.js:95`,
   `detached: true`; `:142-143`, `process.kill(-server.pid, …)`).
   Recommendation: (a). The package's suites carry the platform-specific
   code paths, and the gate's checks are about the tarball's contents and
   rendering. Assumed until answered: (a).
3. **Line endings.**
   - (a) The job sets `core.autocrlf false` before checkout. Nothing in the
     repository changes, and the tree is ubuntu's byte for byte, which every
     oracle and `--check` compares against.
   - (b) A `.gitattributes` with `* text=auto eol=lf`. Every clone gets LF,
     a Windows contributor's included. It is a repository-wide file that no
     story owns.
   - (c) Let CRLF through and make every comparison ignore line endings.
     B2 shows what fails, and this would hide a real line-ending difference.

   Recommendation: (a). Assumed until answered: (a).
4. **The package scripts' globs.**
   - (a) The job sets npm's `script-shell` to Git for Windows' bash, and no
     `package.json` changes. A Windows contributor's own `npm test` needs
     the same setting, which MIG-B9-51's `CONTRIBUTING.md` can state.
   - (b) Make the scripts glob-free. A directory argument does not replace
     the glob: Node 20 then runs every `.js` file in it, the case lists and
     helpers included (B1's control). A small runner script would be
     needed, and `package.json` of the root and of `packages/uxdsl` would
     join Shares (§7 row: 01, 02, 10, 12, 13, 91).
   - (c) Node 22 on Windows, which expands the glob itself. But CI is on
     Node 20, and D10 declares `>=20.19`.

   Recommendation: (a). Assumed until answered: (a).
5. **A product defect that the job finds.**
   - (a) Stop at the first failure whose cause is in `packages/uxdsl/src` or
     `bin`. Record it in §15 with its log and set the story to Blocked. The
     owner then decides each defect, between:
     - fixing it here: the file joins Shares, §7 orders this story after the
       earlier rows on it (MIG-B9-26 for `compile-sass.ts`, MIG-B9-27 for
       `plugin.ts`), and D1 gives it the full flow;
     - a follow-up story.
   - (b) Fix any product defect here without asking. Shares would be
     open-ended, which README §4's exact Shares does not allow.
   - (c) Land the job green with those tests skipped or marked `todo` on
     win32, each with a finding. Windows would be partly verified for the
     release.

   Recommendation: (a). Assumed until answered: (a).
6. **Two win32 spellings the checks are expected to show.**
   1. *A directory whose ACL denies listing* (finding 3).
      - (a) Make the written case hold on win32 too. That is a change to
        `filesystem()`: a real listing attempt, made only for a name
        written in another case, which the corpus never has. It also means
        `compile-sass.ts` in Shares, a CHANGELOG `### Visual changes`:
        none, §7 after MIG-B9-26, and the full flow.
      - (b) Record it as a win32 difference, pinned by T7 and stated in the
        CHANGELOG and the package README. This narrows decision 2 of
        2026-11-09, which states the written case with no platform
        qualifier, to macOS: the owner's call. The README's sentence at
        lines 1550–1553 is then edited, not appended to.
      - (c) (a) in a follow-up story.

      Recommendation: (b). A project path with a directory that denies its
      own user the right to list it is rare, and Dart Sass gives the
      on-disk case there too.
   2. *A component written as an 8.3 short name.* The stage keeps it as
      written, since no listed entry equals it, which is also what the code
      before MIG-B9-23 did. Dart Sass takes the long name from
      `realpathSync.native`. So a file reached through both spellings in one
      build would load twice.
      - (a) Keep the written spelling: MIG-B9-23's C3, and one build spells
        its paths from its entry.
      - (b) Adopt the long name, as Dart Sass does. That changes
        `dependencies` and `loadedFiles` on Windows, and changes the product.

      Recommendation: (a).

   Assumed until answered: for item 1, none of the options. C6c expects
   decision 2's written case, and a divergence observed on `windows-latest`
   stops the story under question 5, option (a), until the owner answers.
   For item 2, (a).
7. **The CLI's paths on Windows.** The CLI prints `[uxdsl] built …`,
   `[uxdsl] add …` and `[uxdsl] regenerated …` with `path.relative`
   (`bin/uxdsl.js:1168`, `:1907`, `:1925`), so with backslashes on Windows.
   `generate-entry`'s recorded invocation is POSIX, by MIG-B9-22's E1.
   - (a) Keep native separators, and let the tests compare without regard to
     the separator.
   - (b) Print POSIX paths everywhere. That is a CLI change in
     `bin/uxdsl.js` (§7 row: 14, 20, 22, 38, 39, 60, 61, 63).

   Recommendation: (a): it is what Windows tools print, and the output does
   not change. Assumed until answered: (a).

### The index's §7, for this story

Applied in the PR that adds this file (README §7):

- `packages/uxdsl/test/cli/**`: 14, 20, 22, 25, 26, 28, 39.
- `packages/uxdsl/test/core/compile-sass.test.js`: 12, 25, 26, 28.
- `packages/uxdsl/test/no-silent-output.test.js` (new row): 13, 25, 27, 28.
- `packages/uxdsl/test/core/sass-source-maps.test.js` (new row): 25, 28.
- No row for `.github/workflows/ci.yml`: this story owns it (MIG-B9-53,
  which also edited it, is merged).
- No row for `canonical-grammar.test.js`, `removed-language-surface.test.js`
  or `types.test.js`: no other unmerged story file lists them. MIG-B9-20's
  §15 records that 43 test files pass `includeTheme`, so its delivery may
  edit them; it is an earlier row either way.
- MIG-B9-28 is on the append-only rows `packages/uxdsl/CHANGELOG.md` and
  `packages/uxdsl/README.md` (the latter not append-only under question 6,
  item 1, option (b)).

So MIG-B9-28 waits for MIG-B9-20, 25, 26 and 27; MIG-B9-39, and every later
story that lists a file of these rows, waits for MIG-B9-28; MIG-B9-91
depends on it (D11).

### Review of 2026-11-10 (applied in the PR that adds this file)

A static review of the seven wave-2 story files written on 2026-11-10. Its
findings on this story were applied before the owner's review:

- **The waits (R3).** MIG-B9-26 and 27's story files list files this story
  shares (`compile-sass.test.js`, `test/cli/uxdsl-cli.test.js`,
  `no-silent-output.test.js`), so Depends on, Base and §3's start gates name
  them, and the rows above replace the earlier proposal.
- **C6c (R5).** Decision 2 of 2026-11-09 and the package README state the
  written case without a platform qualifier, and the on-disk case on win32
  is predicted, not observed. C6c and T7 now expect decision 2's case, a
  divergence is the stop rule, and question 6, item 1, option (b) says that
  it narrows decision 2 and edits the README's sentence at lines 1550–1553.
- **Start gates (R12).** §3 checks the base's tree for each story, instead
  of searching `origin/feat/beta9`'s commit subjects.
- **Encoded controls and exit codes (R13).** T3 and T4's negative controls
  are tests in `win32-harness.test.js` (Owns), and AC1, AC2 and AC7 are
  commands with an exit code.

### Owner decisions of 2026-11-10 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-10). The owner was given 32 numbered questions, in Spanish, on the open questions of the seven story files written on 2026-11-10 and on three notes of their PR (#80), each with its options and a recommendation, and answered, verbatim, "fusiona y haz como recmiendes" ("fusiona y haz como recomiendes", "merge, and do as you recommend"): PR #80 was merged, and each recommendation is the owner's decision of 2026-11-10. This record is in English and lists those that concern this story; its questions 1 to 7 above are decisions 15 to 22 (question 6's two items are decisions 20 and 21). Where they differ from this story's contract or from an earlier block, they rule.

- **Question 1, what the Windows job runs (decision 15): (a)**, as the contract assumed: the `uxdsl` package's own suites. No change to the contract.
  - Option (b)'s second part (parity, the consumer fixtures and the shims on Windows) is registered for `0.5.0-beta.10` as MIG-B9-66, "CI on Windows, part two: parity, the consumer fixtures and the shims": wave 6, after the other wave-6 rows; its size is set by its story file (S, or split); it depends on this story; its status is "Draft (story file to be written; registered by decision 15 of 2026-11-10)". It does not block MIG-B9-91.
  - The header's Size note ("What a larger scope would add is §15's questions 1 and 2, with no new id") is answered: question 1's second part is MIG-B9-66, and question 2 adds nothing to `0.5.0-beta.9` (decision 16).
  - Under README §7, MIG-B9-66's provisional rows put it after this story on `.github/workflows/ci.yml`, which this story edits first, and on the fixture rows question 1, option (b), names. The header's Blocks names MIG-B9-66, its Shares lists `ci.yml` (moved from Owns, since README §7 now has a row for it), and its Size note points to MIG-B9-66.
- **Question 2, `npm run verify:1.0` on Windows (decision 16): (a)**, as assumed: not in `0.5.0-beta.9`. MIG-B9-91's §15 records it. No change.
- **Question 3, line endings (decision 17): (a)**, as assumed: the job sets `core.autocrlf` to `false` before checkout (C1, step 1). No change.
- **Question 4, the package scripts' globs (decision 18): (a)**, as assumed: npm's `script-shell` is set to Git for Windows' bash (C1, step 5). No change.
- **Question 5, a product defect the job finds (decision 19): (a)**, as assumed: the story stops at the first failure whose cause is in `packages/uxdsl/src` or `bin`, and the owner decides each defect. No change.
- **Question 6, item 1, a directory whose ACL denies listing (decision 20): (b).** The contract had assumed none of the options: C6c expected decision 2's written case, and a divergence stopped the story (the review's R5). What changes:
  - If `windows-latest` shows the on-disk case, where decision 2 of 2026-11-09 keeps the written one, that is recorded as a win32 difference, not a stop. C6c's sub-item "If `windows-latest` shows it, C6c does not hold: §7's stop rule applies … This story never pins the on-disk case as passing until the owner has chosen option (b) there" no longer applies, and §7's stop rule's third item ("a C6 check that does not hold") does not cover that case.
  - T7 pins the case the job shows, as the win32 difference, and its title names the case it pins; its failure message no longer stops the story for the on-disk case.
  - Decision 2 of 2026-11-09 is narrowed to macOS. The package README sentence at lines 1550–1553 on `f855765` ("On macOS and Windows each loaded file is spelled in its on-disk case …, or one in a directory that cannot be listed, keeps the spelling it is written in") is edited so that it names macOS only, and the CHANGELOG subsection states win32's case: the "only under question 6, item 1, option (b)" parts of §10, §11, the header's Shares and §9's owner check apply.
  - If Node sees the ACL (`fs.accessSync(dir, R_OK)` throws), the written case is kept, C6c holds as written and none of the above applies (§7, item 4).
  - `compile-sass.ts`'s header comment (lines 36–40) stays as it is until a story edits that file after this one (finding 8).
- **Question 6, item 2, a component written as an 8.3 short name (decision 21): (a)**, as assumed: the written spelling is kept (MIG-B9-23's C3; C6a). No change.
- **Question 7, the CLI's paths on Windows (decision 22): (a)**, as assumed: native separators, and the tests compare regardless of separator. No change.
- **Under README §7, after decision 6.** Decision 6 split MIG-B9-26, and `test/cli/uxdsl-cli.test.js` is now MIG-B9-17's. This story waits for MIG-B9-26 on `compile-sass.test.js` and for MIG-B9-17 on `packages/uxdsl/test/cli/**`. §3's start gate for MIG-B9-26, whose comment reads "both parts' files, if the owner splits it", also needs MIG-B9-17 merged: `! command grep -qx "To be filled in the delivering PR." docs/features/FEAT-010/MIG-B9-17-module-isolation-warnings.md` exits 0 before the story starts. The header's Depends on and Base follow.

### Under README §7, after decisions 28 and 29 of 2026-11-13

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-13). Decision 28 split MIG-B9-39 in two: MIG-B9-39 keeps the adapters, and [MIG-B9-19](MIG-B9-19-cli-watch-recovers.md) takes the CLI and the tests, with the places MIG-B9-39 had on the rows of `bin/uxdsl.js`, `packages/uxdsl/test/cli/**`, `cli.md` and `packages/playground-nextjs/**`. MIG-B9-06, registered by decision 29, follows MIG-B9-19 on `test/cli/**` (its rows are provisional until its story file exists). On `packages/uxdsl/test/cli/**`, the later rows that wait for this story are MIG-B9-38, 19 and 06; MIG-B9-39 no longer edits that directory. The header's Blocks follows; nothing else in this story changes.

### Owner decisions of 2026-11-15 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-15), as decision 27 of 2026-11-15. On 2026-11-10 the owner gave a standing instruction for FEAT-010, verbatim, "fusiona todo.. y preguntas como recomendadas, y sgeuimos" ("merge everything, and the questions as recommended, and let's keep going"), and reaffirmed it on 2026-11-13, verbatim, "haz todo como recomendado" ("do everything as recommended"). MIG-B9-25 was merged into `feat/beta9` as PR #94 (`99f6a82`) on 2026-11-15, and its follow-ups were routed as recommended, without being put to the owner one by one; the owner may still override any of them. This record is in English and lists the item this story receives. Where it differs from this story's contract or from an earlier block, it rules.

- **The guard and MIG-B9-25's §12 loop on Windows (decision 27, from MIG-B9-25's §15 "Follow-ups" and "Delivery of 2026-11-15").** The follow-up, verbatim: "**MIG-B9-28:** run the guard and §12's loop on Windows, where `os.tmpdir()` reads `TEMP` and `TMP`." The Windows job runs `scripts/tmpdir-guard.js` and the per-step loop of `MIG-B9-25-suites-remove-temp-dirs.md` §12 on `windows-latest`, and records what each leaves. Facts on `99f6a82`:
  - The guard makes one `uxdsl-npm-test-XXXXXX` directory in `os.tmpdir()` and runs its command with `TMPDIR`, `TMP` and `TEMP` all set to it (`scripts/tmpdir-guard.js:9–10` and `62`); it exits 1 when a passing run leaves an entry, and keeps its directory when the run fails.
  - The root `npm test` is `node scripts/tmpdir-guard.js npm run test:steps`. The `uxdsl` package's own `test` script, which the Windows job runs (decision 15 of 2026-11-10), does not run inside the guard. Whether the Windows job wraps that script in the guard is an open question for this story's re-baseline.
  - This story's §6 sends "The temporary directories the suites leave, on Windows too" to MIG-B9-25. MIG-B9-25 did not run on Windows, which has no CI job before this story; this decision brings the Windows run back to this story. Where a directory a Windows run leaves is fixed is also an open question for the re-baseline: decision 19 of 2026-11-10 covers a product defect the job finds ("the story stops at the first one, and the owner decides each"), and a fix in a test file outside this story's Shares would bring README §7 waits with it.
- No README §7 row or wait changes by this decision: MIG-B9-25 is merged, and the guard and the loop are run, not edited. If the re-baseline's answers mean editing files outside the Shares, the Shares and the index follow then.

### Re-baseline on `dec40b1` (2026-11-16)

The story started on `dec40b1` (MIG-B9-27 merged as PR #100, after
MIG-B9-17, 26, 39, 25, 21 and 20). Its scout re-ran §3 and §4 there (macOS
27.0, Node 20.19.0, load average 18.44): every precondition and the five
start gates exit 0 once the stale lines below are corrected; B1 holds as
recorded; the package's suites give 756 / 365 (1 skipped) / 276 / 32 / 29 / 1
on macOS, exit 0, and the ubuntu `npm test` job of the same tree (job
133472170456, run 43916511579) gives the same counts, with 6 skipped in
`test/core` (the corpus and five `sass-stage-case.test.js` tests that run
only on darwin and win32). The repository is public. Stale lines, corrected
in place (README §1 item 4) or, for §2's line references, recorded here only:

| Where | Old | New |
| --- | --- | --- |
| §3 precondition | ``command grep -qF "const dir = fs.realpathSync(fs.mkdtempSync(" packages/uxdsl/test/core/compile-sass.test.js   # project(), C5`` | ``command grep -qF "const dir = fs.realpathSync(temporaryDirectory('uxdsl-sass-stage-'));" packages/uxdsl/test/core/compile-sass.test.js   # project(), C5`` (MIG-B9-25 moved `project()` onto the helper; it still uses the JavaScript `fs.realpathSync`, so finding 4 and C5 apply) |
| §3 start gates | four gates | five: adds `! command grep -qx "To be filled in the delivering PR." docs/features/FEAT-010/MIG-B9-17-module-isolation-warnings.md`, which the 2026-11-10 block's "Under README §7, after decision 6" asks for |
| Header, Base | "they are run again when the story starts" | "run again on `dec40b1` when the story started (2026-11-16 …)" |
| §4 B2 | `667 w/crlf`; `# tests 723`, `# pass 721`, `# fail 2` | a re-run paragraph: `698 w/crlf`; `# tests 756`, `# pass 753`, `# fail 3` (adds `Once() is the sequence of named steps, over one Compilation object`, `compiler-structure.test.js`); LF control 756/756. T2 and AC7 say 698 |
| §4 B3 | `removed-language-surface.test.js:155`; `compile-sass.test.js:455`; `init.test.js:96`; watch line 1143; `bin/uxdsl.js:1168`, `:1907`, `:1925` | a re-run item: `:154`; `:464`; `:98`; `temporary-directory.test.js:37` and `:49` (untyped symlinks, new); `postcss-chain.test.js:229` and `sass-stage-diagnostics.test.js:419` (POSIX literals outside the Shares); `watch-mode.test.js:1145`; `bin/uxdsl.js:1138`, `:1874`, `:1893`, `:1897` |
| §2 Sources | `compile-sass.ts` line 152; `canList` 384-396; `spell` 427-456, the win32 root at 435; header 36-40; `compile-sass.test.js:1373`; `uxdsl-cli.test.js:2140`, `:2428`; `sass-source-maps.test.js:418`, `:429`; `compile.ts:467-469` | line 202; 480-491; 522-554, the root at 531; header 30-42 (the "cannot be listed" clause at 41-42); `:1396`; `:2177`, `:2480`; `:419`, `:430`; `compile.ts:523-525` (§2 quotes the story as written; these are the lines on `dec40b1`) |
| §6, §7 item 5 | "The flaky watch test … MIG-B9-39 owns it"; "The flaky watch test of MIG-B9-39 may also fail on Windows" | MIG-B9-19 owns the CLI's flaky watch tests (decision 28 of 2026-11-13); the atomic-replace failure and the webpack loader watch tests' extra-build class are MIG-B9-06's (decisions 28 and 40 of 2026-11-15) |
| §6 | "The temporary directories the suites leave, on Windows too: MIG-B9-25." | removed: decision 27 of 2026-11-15 brings them into this story (C8 below) |
| §11, the 2026-11-10 block | package README lines 1550–1553, "the paragraph that ends at line 1556" | lines 1679–1682 on `dec40b1`; the sentence ends at line 1685 inside list item 2, which continues at 1686, so the new sentence goes after 1685 in that item |

### Owner decisions taken under the standing instruction (2026-11-16)

The re-baseline raised six flags. Under the owner's standing instruction of
2026-11-10 ("fusiona todo.. y preguntas como recomendadas, y sgeuimos"),
each is answered with its recommended option and implemented; they were not
put to the owner one by one, and the owner may override any of them.

- **F1 (decision 27, open question 1): does the Windows job wrap the
  package's test script in `scripts/tmpdir-guard.js`?** (a) Yes, step 8 is
  `node scripts/tmpdir-guard.js npm --prefix packages/uxdsl test`; (b) no,
  the guard runs once elsewhere for the record. **Answer: (a)**: a gate on
  Windows at no extra run time; the guard prints nothing on success, so
  AC2's TAP lines are unaffected.
- **F2 (decision 27, open question 2): where is a Windows leftover fixed?**
  (a) In the test file that leaves it, or in
  `test/helpers/temporary-directory.js`, here, the file joining Shares with
  the run id that showed it; (b) a finding routed to a follow-up; (c)
  tolerated. **Answer: (a)** for a cause in a test or the harness; a cause in
  `src` or `bin` stays decision 19's stop.
- **F3: how the job runs MIG-B9-25's §12 loop.** (a) A permanent step 9
  (`if: success() || failure()`), limited to the package's steps; (b) only
  on failure; (c) on branch commits, then removed. **Answer: (a)**. The
  loop's other §12 steps (vscode, playground, fixtures, scripts) are
  MIG-B9-66's.
- **F4: test files outside the Shares that fail on win32 for a harness
  reason.** (a) Widen Shares to each file the job shows, with its run id;
  on README §7's `test/vite/index.test.js, test/webpack/loader.test.js` row
  put 28 before the provisional 06; (b) stop and ask for each.
  **Answer: (a)**.
- **F5: how `test/helpers/npm.js` starts npm on win32.** (a) `shell: true`
  with each argument double-quoted, refusing (a `TypeError` naming it) an
  argument holding a cmd metacharacter, as `scripts/tmpdir-guard.js` starts
  its command; (b) `process.execPath` with `npm-cli.js`. **Answer: (a)**.
- **F6: an encoded negative control for "os.tmpdir() reads TEMP and TMP on
  Windows".** (a) T11 in `win32-harness.test.js`; (b) none. **Answer: (a)**.

What changes in the contract (the C-n text above stays as written; these
amendments rule):

- **C1, amended.** Step 1 first prints `git config --show-origin --get
  core.autocrlf || true` (AC7's record of the image's default), then sets
  it to `false`. Step 8 is `node scripts/tmpdir-guard.js npm --prefix
  packages/uxdsl test` (F1). Step 9 is C8's loop (F3).
- **C8 (new) — The tmpdir guard and MIG-B9-25's §12 loop on Windows.**
  (i) Step 8 runs the package's suites inside the guard, so the job fails
  when a passing run leaves an entry in its `TEMP`. (ii) Step 9, `if:
  success() || failure()`, runs each `packages/uxdsl/test/*.test.js` and
  `test/{core,cli,vite,webpack}/*.test.js` with `node --test`, and
  `test/performance/*.test.js` with `--test-concurrency=1`, each in a fresh
  directory made under the runner's own `TEMP` (which keeps its 8.3 short
  name, T5's precondition), passed as a Windows path in `TMPDIR`, `TMP` and
  `TEMP`. It prints `exit N: <step>` and `left N in <dir>: <step>` lines, a
  failing step's output after its line and nothing for a passing step (so
  AC2's counts come from step 8 alone), ends with `fail=<0|1>` and exits 1
  when `fail=1`. (iii) A leftover from a test is fixed in that test or in
  `test/helpers/temporary-directory.js`, never swallowed (F2). §14 records
  each run's guard result and loop lines.
- **T11 (new, `win32-harness.test.js`):** `MIG-B9-28: on win32 the tmpdir
  guard sets TEMP and TMP, so a passing command that leaves an entry in
  os.tmpdir() fails it (negative control)`. It runs the guard on a `node -e`
  that makes a directory in `os.tmpdir()` and asserts exit 1 and the listed
  entry, then on one that also removes it and asserts exit 0. Skipped off
  win32 with its reason (F6).
- **AC2, AC3, AC4 counts.** AC2: `ok N - MIG-B9-28:` counts 7 (T5–T8, the
  two controls of T3 and T4, T11), none with `# SKIP`. AC3: `# skipped 7`.
  AC4: the unit group is BASE + 3, `test/core` BASE + 4.
- **Shares.** Each file outside the Shares that the Windows job shows
  failing for a harness reason joins them, listed with the run id that
  showed it (F4).

### Owner decisions taken under the standing instruction (2026-11-16, second batch)

The Windows job raised three flags that decision 19 of 2026-11-10 stops on.
G1 and G2 were put to the owner's session, which answered each with its
recommended option under the standing instruction of 2026-11-10; G3 came up
after that and is answered here the same way, with its recommended option.
They were not put to the owner one by one, and the owner may override any
of them.

- **G1: a file Dart Sass loads itself through `pkg:` is spelled in lower
  case on win32.** Evidence: on `windows-latest`,
  `compile-sass.test.js`'s `MIG-B9-12: with sourceMap, Dart Sass runs with
  sourceMap and sourceMapIncludeSources, so a file it loads itself through
  pkg: keeps its own text in sourcesContent` fails in runs 43933237360
  (`5a0ff25`) and 43942955727 (`640bed8`): the stage map's sources hold
  `c:\users\runneradmin\appdata\local\temp\…\node_modules\kit\index.scss`
  where the file is `C:\Users\runneradmin\AppData\Local\Temp\…\node_modules\kit\index.scss`.
  Dart Sass names a file it loads itself in its canonical form, which its
  filesystem importer lowercases on Windows, and `compile-sass.ts` carries
  that spelling on. Options: (a) fix it in `src` here; (b) record it as a
  win32 difference: on win32 the test that fails finds the file whatever
  its case, a new test pins Dart Sass's spelling with a title that names
  the difference and the follow-up, every other platform keeps the
  original assertions, and the package README sentence on spelling is
  narrowed so it is true. **Answer: (b)**, `src` untouched. The new test is
  `MIG-B9-28: on win32 a file Dart Sass loads itself through pkg: is named in
  Dart Sass's lowercased form in the stage map's sources, loadedFiles and
  compile()'s dependencies, not in its on-disk case (a win32 difference,
  MIG-B9-102)` in `sass-stage-win32.test.js`; `loadedFiles` and
  `dependencies` are pinned as the Windows job shows them. The fix is the
  proposed follow-up below.
- **G2: T7's ACL cannot be set up on the hosted runner.** Evidence: run
  43942955727 denies `(RD)` to `runnervmm7ud1\runneradmin` and to Everyone
  (`icacls` lists `Everyone:(DENY)(RD)` and `runnervmm7ud1\runneradmin:(DENY)(RD)`
  first), yet `fs.readdirSync` of the directory returns `["_part.uxdsl"]`:
  the runner's elevated administrator lists it through the deny, so the
  case C6c describes does not exist there. Options: (a) on win32, T7 skips
  with the exact reason when the directory can still be listed, printing the
  `readdirSync` result and the `icacls` listing as diagnostics, so C6c
  stays unobserved on win32 and the README and CHANGELOG keep decision 2's
  sentence as written for that case; (b) set the case up under another,
  unelevated account; (c) pin outcome B (the on-disk case) unobserved.
  **Answer: (a)**. T7 takes §8's title again
  (`… keeps its written case, as decision 2 of 2026-11-09 states`), asserts
  the written case where the deny holds, and the file's header no longer
  states outcome B. On `windows-latest` T7 is the one `MIG-B9-28:` test
  with `# SKIP`.

- **G3: on win32 `build --watch`'s atomic replace is refused while a reader
  holds the output file.** Evidence: run 43950837496 (`0488249`), in the
  package suites and in the per-file loop alike, `MIG-B6-23: an output file
  is never observed empty or truncated while a rebuild is writing it (atomic
  replace)` times out after `[uxdsl] build failed: EPERM: operation not
  permitted, rename 'src/.uxdsl.css.<pid>-<time>-<id>.tmp' -> 'src/uxdsl.css'`:
  the test reads the file continuously, and Windows refuses a rename onto a
  file another process has open (`bin/uxdsl.js`'s `commitFileIfChanged`,
  which does not retry). No read saw an empty or truncated file. Options:
  (a) retry the rename in `bin` here; (b) record it as a win32 difference,
  as G1: on win32 the test accepts, for each rebuild, either the new output
  or that `EPERM` line with the previous output whole, prints how many
  rebuilds were refused, and checks that a change with no reader then
  builds; every other platform keeps the test as it is; the CLI guide, the
  package README and the CHANGELOG say so; the retry is a follow-up; (c)
  skip the test on win32. **Answer: (b)**, recommended under the same
  standing instruction (C7 keeps `bin` unchanged, C3 rules out (c), and G1
  set the precedent); `bin` untouched. MIG-B9-06, which decision 28 of
  2026-11-15 gives the atomic-replace failure seen on ubuntu, may take the
  follow-up instead.

What changes in the acceptance criteria (the C-n and AC text above stays as
written; these rule):

- **AC2.** `ok N - MIG-B9-28:` counts 8 (T5–T8, G1's test, the two controls
  of T3 and T4, T11), exactly one of them with `# SKIP` (T7, G2); `# SKIP`
  counts 6 (C3's five and T7).
- **AC3.** `# skipped 8`.
- **AC4.** The unit group is BASE + 3, `test/core` BASE + 5.

### Found while implementing (2026-11-16)

- **C5's `error.file` item does not hold as written.** `path.isAbsolute`
  reads `/project/src/app.uxdsl` as absolute on win32 too, and PostCSS
  resolves `from` only when it is not absolute, so `error.file` is the POSIX
  literal on Windows and `no-silent-output.test.js`,
  `canonical-grammar.test.js` and `removed-language-surface.test.js:34`
  pass unchanged (run 43923540755). T4's control in `win32-harness.test.js`
  encodes what Windows shows instead: `MIG-B9-28: on win32 PostCSS keeps a
  POSIX absolute from as written, where path.resolve gives it a drive
  letter, so an error.file assertion keeps its POSIX literal (negative
  control)`.
- **A load path's `..` on Windows.** Windows resolves `nope/deeper/../../x`
  and `missing/../real` without the directories before each `..`, so a
  load path that does not exist can still find a file there, for Dart Sass
  and the stage alike (the twins agree). Three expectations of
  `compile-sass.test.js` that said "Can't find stylesheet" now state what
  win32 finds (runs 43933237360, 43942955727); `docs/integrations/compile.md`
  and the package README name the difference.
- **Sass's ambiguity message and Vite's module graph.** The stage's
  "It's not clear which file to import" names files with the platform's
  separator, as Dart Sass's does; Vite keys its module graph by
  `vite.normalizePath`, so a test that looked a module up by
  `path.join` invalidated nothing on Windows (run 43942955727,
  `vite/theme-emission.test.js`), which the test now refuses.
- **The watch tests' output.** `watch-mode.test.js` reads every line it
  collects with `\` as `/`; its atomic-replace test stops its reader when a
  rebuild does not land, so a failure ends the file instead of keeping it
  running until the per-file limit (run 43942955727, exit 124 after
  20 minutes).

Shares, widened under F4 (each file and the run that first showed it on
`windows-latest`): run 43923540755 (`717ecdc`, attempt 2):
`test/es5-consumer-compat.test.js`, `test/temporary-directory.test.js`,
`test/core/sass-stage-diagnostics.test.js`, `test/cli/error-location.test.js`,
`test/vite/index.test.js`, `test/vite/theme-emission.test.js`,
`test/vite/watch-recovery.test.js`, `test/webpack/theme-emission.test.js`,
and the new `test/helpers/separators.js`; run 43933237360 (`5a0ff25`):
`packages/uxdsl/docs/integrations/compile.md` (with 43942955727's
load-path case). README §7's row `test/vite/index.test.js,
test/webpack/loader.test.js` gets 28 before 06 (`test/vite/index.test.js`
is edited; `test/webpack/loader.test.js` is not).

### Watch tests that failed once on Windows (C6g)

Both are the extra-build and missed-event class MIG-B9-19 and MIG-B9-06 own;
neither is fixed here. Run 43950837496 (`0488249`): in the package suites,
`changing outFile via a config reload does not resurrect the self-triggered
rebuild loop under the new path` timed out waiting for the new output
(`waitFor timed out`, `watch-mode.test.js:289`), and passed alone in the
per-file loop; in the loop, `MIG-B9-14: an entry whose first build failed,
saved so that it loads an existing file beside it, builds once …` saw two
`change src/b.uxdsl` events for one save (`built out/b.css`, then
`unchanged out/b.css`: 2 builds where it expects 1), and passed in the
package suites. The next run, on the following commit, is their re-run.

### Open for the owner: one save, two builds on Windows (2026-11-16)

Run 43954805492 (`3bd00d8`) is the re-run C6g asks for. The atomic-replace
test passes there with G3's win32 branch (1 of 5 rebuilds refused in the
package suites, 2 of 5 in the loop), and `test/*.test.js` (767, `# fail 0`)
and `test/core` (370, `# fail 0`, 4 skipped: the corpus, MIG-B9-12's I/O
error, MIG-B9-23's execute-only directory, T7) pass. `test/cli` fails 3:

- In the package suites: `watch retargets the entry and source globs
  without restarting the CLI, and keeps following the theme file` and `watch
  mode reloads when the build config (not the theme file) delegates to a
  nested require()` time out (`waitFor timed out`, no output captured), and
  `MIG-B9-14: an entry whose first build failed, saved so that it loads an
  existing file beside it, …` sees `change src/_x.scss` twice for one edit
  (`built out/b.css`, then `unchanged out/b.css`).
- In the per-file loop: `MIG-B9-14: an entry that starts loading an existing
  file beside the file just saved builds once …` and the "first build
  failed" twin each see `change src/b.uxdsl` twice for one save (2 builds of
  b, 2 warnings, where they expect 1), and `MIG-B9-20: build --watch counts
  the theme over the last result of every entry` times out on a
  `built(…) === 1` wait, which a doubled event would step over (not shown:
  that wait prints no output).

Across runs 43950837496 and 43954805492 the two MIG-B9-14 tests ran 8
times (each in the package suites and in the loop, twice) and saw a doubled
event 4 times (the "first build failed" one 3 times in 4), so it is not a
one-off: on Windows
one `fs.writeFileSync` reaches `build --watch` as two `change` events, and
`bin/uxdsl.js` builds once for each (the second writes nothing). That is a
product difference in `bin`, decision 19's stop, and it reaches every
watch test that counts builds or waits for an exact count. The timeouts of
the two config-reload tests are not explained by it (their waits read the
CSS, not a count) and print no output.

Options:

- (a) Allow a `bin` change here: an event whose file keeps the stats the
  last build of it read is dropped for every followed file, as it already
  is for a newly followed one (`watchSelection`'s `unchanged` map), so a
  doubled event builds nothing. C7 and AC6 are amended for `bin/uxdsl.js`;
  the story becomes an engine change (full flow).
- (b) Keep `bin` untouched and pin the difference on win32 in each watch
  test that counts builds (`built` once, an extra `unchanged` accepted,
  waits on `>= 1`), with a follow-up to coalesce the events (as G1 and G3);
  the config-reload timeouts stay MIG-B9-19's class and are re-run.
- (c) Keep `test/cli/watch-mode.test.js` out of the Windows job's gate
  until MIG-B9-19 or MIG-B9-06 fixes the class (C3 amended: a named
  exclusion instead of a skip).

No option is clearly the one to take: (a) changes `bin` against C7, (b)
weakens a dozen assertions on win32, and (c) removes the file C6g names.
The story stops here.

Answered in the next block: (c).

### Owner decision taken under the standing instruction (2026-11-16, third batch)

The open question above was answered by the owner's session with option
(c), as the recommendation, under the standing instruction of 2026-11-10;
it was not put to the owner on its own, and the owner may override it.

- **G4: one save reaches `build --watch` as two `change` events on win32.**
  Evidence: runs 43950837496 (`0488249`) and 43954805492 (`3bd00d8`), as
  recorded in the two blocks above: the two MIG-B9-14 tests saw a doubled
  event 4 times in 8 runs, `MIG-B9-20: build --watch counts the theme over
  the last result of every entry` timed out on a `built(…) === 1` wait,
  and the two config-reload tests (`watch retargets the entry and source
  globs …` and `watch mode reloads when the build config … delegates to a
  nested require()`) timed out with no output; in run 43954805492's
  per-file loop the failing `watch-mode.test.js` also left 38 entries in
  its directory. Options: (a) change `bin` so that an event whose file
  keeps the stats of its last build builds nothing; (b) keep `bin` and pin
  the difference on win32 in each watch test that counts builds; (c) keep
  `test/cli/watch-mode.test.js` in the Windows job, its whole output
  printed, but as a named exclusion from the job's pass/fail until the
  class is fixed. **Answer: (c).** (a) changes `bin` against C7; (b) weakens
  about a dozen count assertions; (c) keeps every assertion and `bin`
  intact and names the gap.
  - How the job does it. Step 8 runs the package's test script, its six
    groups in its order, inside `scripts/tmpdir-guard.js`, with
    `test/cli` given as its files without `watch-mode.test.js`; the step
    first checks that the package's `test` script is still the one it
    runs, and fails naming it when it is not (`package.json` is not
    changed, C7). After the gate, the step runs `node --test
    test/cli/watch-mode.test.js` in a temporary directory of its own,
    prints its whole output, the line `excluded from the Windows gate:
    watch-mode.test.js, one save reaches build --watch as two change events
    on win32; MIG-B9-06 returns it to the gate`, its `# tests`, `# pass`,
    `# fail` and `# skipped` lines prefixed `watch-mode.test.js: `, and
    `watch-mode.test.js: exit <code>, left <n>`; it exits with the gate's
    code. The per-file loop (step 9) runs the file the same way: its whole
    output, the same exclusion line, and its `exit` and `left` lines marked
    `(excluded from the Windows gate)`, which set nothing to fail. Every
    other file stays in the gate, in step 8 and in step 9.
  - **C3, amended (not rewritten above).** Six gated groups report
    `# fail 0`, with `test/cli` reported as its files without
    `watch-mode.test.js`; the ubuntu `test` job's `test/cli` count equals
    the Windows `test/cli` count plus `watch-mode.test.js`'s `# tests`
    (37 on `3bd00d8`), and the other five groups' counts are equal. The
    exclusion is not a skip: no test of the file is skipped, and its
    result is printed, never hidden.
  - **C6g, amended (not rewritten above).** `watch-selection.test.js` passes
    whole on win32, in the gate. `watch-mode.test.js` runs on win32 and is
    reported, outside the gate, until MIG-B9-06 fixes the class in `bin`
    and returns it to the gate as one of its acceptance criteria.
  - **AC2, amended.** Read from step 8's output up to its exclusion line:
    `# fail 0` 6 times, `# SKIP` as the second batch's AC2 states, the
    `MIG-B9-28:` counts as stated there, and six `# tests` lines that equal
    the ubuntu job's for the same commit except `test/cli`, which equals
    ubuntu's minus the excluded file's `# tests`. The lines after the
    exclusion line, and step 9's output for the excluded file, are not
    counted.
  - **Routing.** The class (one save as two `change` events on win32, a
    build for each, and the two config-reload watch tests that time out on
    Windows with no output) is MIG-B9-06's (wave 3, `0.5.0-beta.9`, after
    MIG-B9-19; its story file is still to be written): it fixes the class
    in `bin` and returns `watch-mode.test.js` to the Windows gate as an
    acceptance criterion. If any other file fails on Windows for a product
    reason, the same rule applies: the story stops and reports it; a cause
    in a test is fixed in the test.

### Run 43960109820 (`fc8d628`), G4 applied (2026-11-16)

All three jobs pass: `npm test (uxdsl, Windows)` (job 133625076636, 16 min
45 s), `npm test` (job 133625077133) and `verify:1.0 (one tarball, real
Chrome)` (job 133628775038). On `windows-latest` the image's
`core.autocrlf` is `true` from `file:C:/Program Files/Git/etc/gitconfig`;
the job prints `files checked out with CRLF: 0`. Step 8, up to its
exclusion line: six `# fail 0`; `# tests` 767, 370, 239, 32, 29, 1 against
ubuntu's 767, 370, 276, 32, 29, 1 on the same commit (239 + the excluded
file's 37 = 276); `# SKIP` 6 (C3's five and T7); `ok N - MIG-B9-28:` 8, one
with `# SKIP` (T7); the NFD line once; no `tmpdir-guard:` line (the gated
suites left nothing). After it, `watch-mode.test.js: # tests 37`, `# pass
36`, `# fail 1`, `exit 1, left 38`: the failing test is `MIG-B9-14: an entry
that starts loading an existing file beside the file just saved builds once
…` (`change src/b.uxdsl` twice, `2 !== 1`). Step 9: every gated file
passes and leaves nothing (`fail=0`); the excluded file prints `exit 1`
(the "first build failed" twin, `2 !== 1`) and `left 38 in
C:\Users\RUNNER~1\AppData\Local\Temp\uxdsl-loop.1mXky2\excluded.kKYi8z`.

- **`watch-mode.test.js` leaves 38 entries on Windows.** In this run's
  step 8 and step 9, and in run 43954805492's loop (`left 38`), the file
  leaves 38 entries in its temporary directory when it runs on win32, with
  1 to 3 tests failing; on macOS and ubuntu it leaves none. Whether a
  watcher process still holding its directory or the test's own removal
  causes it was not determined. It is outside the gate under G4 and goes
  with the file to MIG-B9-06: returning the file to the gate means it
  passes and leaves nothing there.

### Follow-ups (proposed)

- **MIG-B9-06 (registered; wave 3, `0.5.0-beta.9`, after MIG-B9-19; story
  file still to be written) takes G4's class:** one save reaching
  `build --watch` as two `change` events on win32, a build for each, and
  the two config-reload watch tests that time out on Windows with no
  output. One of its acceptance criteria returns
  `test/cli/watch-mode.test.js` to the Windows job's gate (step 8's
  exclusion and step 9's `excluded` branch removed), where it then passes
  and leaves nothing in its temporary directory (it leaves 38 entries there
  on Windows today).

- **MIG-B9-102 — win32: a file Dart Sass loads itself through `pkg:` is
  spelled in its on-disk case.** S, for `0.5.0-beta.10` with MIG-B9-66; it
  does not block MIG-B9-91. G1 above is its evidence; its regression is the
  G1 test, which then asserts the on-disk case.
- **MIG-B9-103 — win32: `build --watch` retries a rename onto an output
  file a reader holds open.** S, for `0.5.0-beta.10` with MIG-B9-66 (or
  within MIG-B9-06, if the owner prefers); it does not block MIG-B9-91. G3
  above is its evidence; its regression is the atomic-replace test's win32
  branch, which then expects every rebuild to land.
