# MIG-B9-19 — The CLI's watch recovers after a failed compile, and its flaky watch test and captures check name what failed

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | None (registered by decision 28 of 2026-11-13, which split MIG-B9-39 into MIG-B9-39, the adapters (C1 to C5), and this story, the CLI and the tests (C6 to C9); MIG-B9-39 was registered by the decision of 2026-11-08 on MIG-B9-14's flag 16. MIG-B9-39's six questions are answered by decisions 28 to 33 of 2026-11-13 (§15)) |
| Status | Ready |
| Size | S (decision 28 of 2026-11-13: "two S stories") |
| Depends on | MIG-B9-14 (merged, PR #71), MIG-B9-22 (merged, PR #76) and MIG-B9-21 (Ready; its status is README §5's), as MIG-B9-39's registration says. Under README §7 it also waits for MIG-B9-37 and MIG-B9-38 (`bin/uxdsl.js`); for MIG-B9-21, 25, 17, 28 and 38 (`packages/uxdsl/test/cli/**`); for MIG-B9-21 and 17 (`cli.md`); and for MIG-B9-21, 16, 26, 30, 33, 34, 35 and 36 (`packages/playground-nextjs/**`, for `capture-capabilities.js` and the `test:captures` script). MIG-B9-20, on each of these rows, is merged (PR #88). It does not depend on MIG-B9-39: the two share only the append-only CHANGELOG and package README |
| Blocks | MIG-B9-06 (decision 29 of 2026-11-13: after this story, on `bin/uxdsl.js`, `test/cli/**` and `cli.md`) and MIG-B9-91 (it depends on every story of waves 0 to 3). Under README §7, in `0.5.0-beta.10`: MIG-B9-60, 61 and 63 (`bin/uxdsl.js`, `cli.md`); MIG-B9-40 to 43 (`packages/playground-nextjs/**`) |
| Base | `feat/beta9` after MIG-B9-21, 37 and 38, and after the earlier stories of each README §7 row above. §3 and §4 are MIG-B9-39's, recorded on `5a041fc` (`docs/b9-wave3-story-files`: `origin/feat/beta9` at `cc10de6`, MIG-B9-20 merged, plus story files only). This file was made on `d1e07a3` (PR #89's merge into `feat/beta9`), where `git diff --stat cc10de6 d1e07a3 -- packages fixtures scripts .github` is empty. Both are re-run on the base the story starts from (§3, "Before starting") |
| Owns | `packages/playground-nextjs/scripts/test-captures-check.cjs` (new) |
| Shares | `packages/uxdsl/bin/uxdsl.js` (`startWatch`, `runFullBuild`, `runSelectiveBuild`, `loadAndBuildForWatch`), `packages/uxdsl/test/cli/watch-mode.test.js`, `packages/playground-nextjs/scripts/capture-capabilities.js`, `packages/playground-nextjs/package.json` (the `test:captures` script), `packages/uxdsl/docs/integrations/cli.md` (Watch mode), `packages/uxdsl/CHANGELOG.md` (one subsection under `## 0.5.0-beta.9 — unreleased`), `packages/uxdsl/README.md` (one sentence, lines 63–68 on `d1e07a3`) |
| Output impact | CLI: `build --watch` follows the file a failed build names, and prints `[uxdsl] watching for changes...` once its watcher is ready; `capture-capabilities.js --check` prints the first line that differs in a capture it reports stale. Compiled output: none |

## 1. Goal

Under `uxdsl build --watch`, with a single entry and with `builds`, a build
that fails and is then fixed rebuilds on the save that fixes it, the first
build included, also when the file at fault is outside the `watch`
patterns, and the last good output is kept meanwhile; the watching line is
printed once the watcher is ready. The watch-mode test that fails on CI's
ubuntu runner (`waitFor timed out`), and the captures check that sometimes
reports a byte-identical file as stale, either stop failing for the
mechanism this story fixes or fail with output that names the step. This
story is MIG-B9-39's C6 to C9, split from it by decision 28 of 2026-11-13
(§15); MIG-B9-39 keeps the adapters.

## 2. Sources

- The split, decision 28 of 2026-11-13 (`docs/features/FEAT-010-beta9.md:509–513`):

  > - **Decision 28 — One M story, or two S stories (Q1).** (b), a split into two S stories, as Q1 (b) describes; the contract had assumed (a), one M story.
  >   - MIG-B9-39 keeps the adapters: C1 to C5, T1 to T10, AC1 to AC3, and AC7 to AC9 for its part. It shares only `vite.ts`, `webpack.ts`, `vite.md`, `webpack.md`, the two adapter fixtures and the append-only rows, so under the index's §7 it waits for MIG-B9-21 alone on its files.
  >   - The second story, the CLI and the tests, C6 to C9, T11 to T14, AC4 to AC6, and AC7 to AC9 for its part, is registered as MIG-B9-19, "The CLI's watch recovers after a failed compile, and its flaky watch test and captures check name what failed": wave 3, S, decision gate none, depends on MIG-B9-14, 21 and 22 (MIG-B9-39's registration); it is on `bin/uxdsl.js`, `packages/uxdsl/test/cli/**`, `cli.md` and `packages/playground-nextjs/**`, as MIG-B9-39 was; branch `feat/b9-19-cli-watch-recovers`. The title given to the recorder, "… and its watch test is stable", was adjusted: C8 makes the two CI-flaky tests diagnosable and C9 makes the captures check name the differing line, and neither promises stability (decision 32).
  >   - Each keeps its C-n, T-n and AC-n as numbered in MIG-B9-39, and the "must stay byte-identical" list applies to both. Neither story depends on the other: they share only the append-only CHANGELOG and package README.
  >   - The id: the owner assigns ids, and the standing instruction does not, so the recorder took the first free id in the 1x range, 19, as MIG-B9-17 and 18 had been taken. The owner may renumber.

The sources below are MIG-B9-39 §2's that concern C6 to C9, verbatim, as
it recorded them on `5a041fc` (line numbers in them are of that commit).
MIG-B9-39 §2's other items concern only the adapters and stay there.

All quotes were checked on `5a041fc`.

- The decision, FEAT-010 §2, "Owner decisions of 2026-11-08"
  (`docs/features/FEAT-010-beta9.md`, line 227):

  > - **Flag 16 — MIG-B9-39 registered,** "Every host's watch recovers after a failed compile": wave 3, S or split by its scout, depends on MIG-B9-14, 21 and 22; the adapters re-register the last good dependencies and `err.file`. It also owns the flaky watch-mode test that failed on CI's ubuntu runner for PR #71 and PR #72 (`waitFor timed out`) and the occasionally stale `cli-captures.json` `--check` (MIG-B9-15 §15).

  and, on MIG-B9-15's flags (same file, line 236):

  > Shares; and the flaky watch test, which goes to MIG-B9-39.

  The same decision accepted MIG-B9-14's flag 15 (line 222):

  > - **Flags 5, 6, 7, 9, 13, 14, 15 and 18 — accepted as delivered:** […] A3's fallback limits; […]

- The decision as MIG-B9-14 records it
  (`docs/features/FEAT-010/MIG-B9-14-cli-and-adapters.md`, line 698):

  > - **Flag 16, the adapters after a failed compile:** MIG-B9-39 is registered as proposed in the follow-ups above, "Every host's watch recovers after a failed compile" (wave 3, S or split by its scout, depends on MIG-B9-14, 21 and 22): the adapters re-register the last good dependencies and `err.file`. It also owns the flaky watch-mode test that failed on CI's ubuntu runner for PR #71 and PR #72 (`waitFor timed out`), and the occasionally stale `cli-captures.json` `--check` (MIG-B9-15 §15).

- "The follow-ups above", MIG-B9-14 §15 (lines 670–678):

  > - **MIG-B9-39, new.** "Every host's watch recovers after a failed compile". Wave 3, S or split by its scout, depends on 14, 21 and 22. It covers:
  >   - the adapters' recovery (owner flag 16), with the reviewer's measured patches;
  >   - adapters' error frames (Vite's `err.loc` and `err.frame`, webpack's message);
  >   - the CLI watch's gaps that predate this story:
  >     - the queued selective batch that runs outside the `building` flag;
  >     - a glob root or plain `watch` path that holds no followed file, which is not watched again once deleted and re-created;
  >     - a file modified during the build that first loads it, after Dart Sass read it, which chokidar then discovers without an event;
  >     - a missing partial created where no pattern matches (owner flag 15).

- Owner flag 16, with the reviewer's measured patches (same file, lines 597–604):

  > 16. **The adapters after a failed compile.** This predates the story (measured identical at `7aec3e0`) and is documented, not fixed (design X5).
  >     - `uxdsl/webpack`: after a failed compile it watches only the module's own file. Fixing a broken partial, or re-creating a deleted one, rebuilds only when the module is saved.
  >     - `uxdsl/vite`: a partial that the failing load was the first to load stays out of the module graph, so fixing it sends no update.
  >
  >     The reviewer measured fixes on webpack 5.112.2 and on Vite 5.4.21 and 7.3.7:
  >     - webpack: keep the last successful dependencies per resource, and re-add them and `err.file` in the catch;
  >     - Vite: map `err.file` to the failing module in `handleHotUpdate`, or in `hotUpdate` on Vite 7.
  >     - Proposed: MIG-B9-39 below, or MIG-B9-21 if `compile()` should put the files Dart Sass loaded on its error.

  Owner flag 15 (lines 592–596), whose limit the fourth gap above names:

  > 15. **A3's full-rebuild fallback.** "Creating the file triggers a full rebuild" holds only where a `watch` pattern matches the new file. Dart Sass reports no candidate paths, so a missing `.scss` partial under the default `**/*.uxdsl`, or one outside every pattern, is noticed at the next save of a watched file.
  >
  >     A file written within 100 ms of the build that first loads it may build its entry twice (2 s on a file system with whole-second times). That margin keeps an edit made during the build from being dropped (RR-2).
  >
  >     Both are documented in cli.md's Watch mode.

- The index row (`docs/features/FEAT-010/README.md`, line 225):

  > | MIG-B9-39 | Every host's watch recovers after a failed compile | 3 | — | S or split (its scout sizes it) | 14, 21, 22 | Draft (story file to be written; registered by the decision of 2026-11-08 on MIG-B9-14's flag 16, as proposed in its §15) |

  and README §5 on its place (lines 287–292):

  > MIG-B9-38 and 39 are the last wave-3 rows, right before MIG-B9-91; both edit
  > `bin/uxdsl.js`, so MIG-B9-39 waits for MIG-B9-38. MIG-B9-39 is also on the
  > rows for `packages/uxdsl/test/cli/**` and `packages/playground-nextjs/**`,
  > for the watch-mode test and the captures check the decision gives it
  > (`watch-mode.test.js`, `capture-capabilities.js`), so it also waits for
  > MIG-B9-25 and for the earlier stories of the playground row.

- The captures check, MIG-B9-15 §15 (`MIG-B9-15-superset-docs.md`), new
  fact 6 (line 373) and its follow-up (line 427):

  > 6. **Captures.** In this run `cli-captures.json` was never reported stale: both of the deliverer's `npm test` runs and the direct `--check` passed. The implementer saw the false report twice, once in a full run and once in three direct `--check` runs.

  > - **MIG-B9-39, or the story that owns the captures.** `capture-capabilities.js --check` sometimes reports `src/generated/cli-captures.json` as stale while the file is byte-identical (new fact 6). The likely cause is the timing-dependent `uxdsl build --watch` transcript in `captureWatch()`.

- **The flaky test: in the registration, and only mentioned elsewhere.** The
  decision text itself (FEAT-010 line 227, MIG-B9-14 line 698) gives this
  story the flaky test and the captures check: both are in the registration.
  The other files only defer to it:
  - MIG-B9-15 line 438: "**The flaky watch test** (`watch-mode.test.js`, "waitFor timed out" on CI's ubuntu runner): owned by MIG-B9-39."
  - MIG-B9-16 lines 566–568 (its AC4): "Mutation: none; an invariant guard. MIG-B9-39 owns its occasional false stale report (MIG-B9-15 §15, new fact 6). If it fires, §14 records the failing run and a second run."
  - MIG-B9-25 lines 346–347: "**The flaky watch-mode test** (`waitFor timed out` on CI's ubuntu runner): MIG-B9-39, which owns it."; line 11 lists MIG-B9-39 among the stories it blocks (`test/cli/**`); lines 726–727: "**MIG-B9-39:** it rebases its watch-mode work on this story's `watch-mode.test.js`."
  - MIG-B9-28 lines 372–373: "**The flaky watch test** (`waitFor timed out` on ubuntu): MIG-B9-39 owns it (the decision of 2026-11-08 on MIG-B9-14's flag 16)."; lines 485–487: "The flaky watch test of MIG-B9-39 may also fail on Windows. Record each occurrence in §14 with its log. Re-run the job once and record both runs. It is not fixed here."; lines 856–858: "So MIG-B9-28 waits for MIG-B9-20, 25, 26 and 27; MIG-B9-39, and every later story that lists a file of these rows, waits for MIG-B9-28".
- The other mentions of MIG-B9-39, none of which registers more:
  - MIG-B9-22 line 315 (a follow-up of its delivery, not settled by a decision): "**MIG-B9-39** (every host's watch recovers after a failed compile) builds on E2's watcher: `refreshWatcher` now runs before selective builds too, and an error while a recreated watcher starts is not caught there, as it already was not on a full rebuild."
  - MIG-B9-26 line 636 (its split, decision 6 of 2026-11-10): "`test/cli/**`, so MIG-B9-39 would wait for it there."
- What the documentation says today:
  - `packages/uxdsl/docs/integrations/cli.md`, lines 544–549: "A partial a build could not find (`Can't find stylesheet to import.`) is noticed when it appears only where a `watch` pattern matches it, since Dart Sass does not report the paths it tried: […] Add its directory to `watch` (`'shared/**/*.scss'`) to have it noticed."
- The code:
  - `packages/uxdsl/bin/uxdsl.js` line 1696: `console.log('[uxdsl] watching for changes...');`, right after `createWatcher` (line 1685) and `followAll()` (line 1695), without waiting for the watcher's `ready`; lines 1780 and 1796: a failed build prints and follows nothing new; line 1852: the queued selective batch, `else runSelectiveBuild([...indices]).finally(…)`, runs after `building = false`.

## 3. Preconditions

MIG-B9-39 §3's lines that concern this story, verbatim, with their
recorded output. The `node -e` line and the `MIG-B9-14|MIG-B6-23` line also
cover MIG-B9-39's files; they are kept whole, as recorded, and their counts
are those of the whole line.

Run from the worktree root on `5a041fc`, 2026-11-13, macOS 27.0, Node
v20.19.0, npm 11.21.1. Each exited 0.

```bash
git rev-parse --short HEAD                                  # 5a041fc
for c in db0e28d 08d00e0 cc10de6; do git merge-base --is-ancestor "$c" HEAD || exit 1; done   # PR #71 (14), PR #76 (22), PR #88 (20) merged
grep -n "console.log('\[uxdsl\] watching for changes...')" packages/uxdsl/bin/uxdsl.js           # 1696
grep -n "else runSelectiveBuild(\[...indices\])" packages/uxdsl/bin/uxdsl.js                     # 1852
node -e "for (const p of ['vite','webpack','mini-css-extract-plugin','style-loader','css-loader','chokidar','sass']) console.log(p, require('./packages/uxdsl/node_modules/'+p+'/package.json').version)"
# vite 7.3.7, webpack 5.111.1, mini-css-extract-plugin 2.10.2, style-loader 4.0.0, css-loader 7.1.5, chokidar 4.0.3, sass 1.107.0
TMPDIR=<scratch> node --test --test-name-pattern="MIG-B9-20" packages/uxdsl/test/cli/watch-mode.test.js        # 6 pass, 0 fail (31 filtered out)
TMPDIR=<scratch> node --test --test-name-pattern="MIG-B9-14|MIG-B6-23" packages/uxdsl/test/cli/watch-mode.test.js packages/uxdsl/test/vite/index.test.js packages/uxdsl/test/webpack/loader.test.js   # 21 pass, 0 fail
node packages/playground-nextjs/scripts/capture-capabilities.js --check   # "Captured CLI and compiler output is up to date." (run 5 times, §4.5)
```

The targeted test runs leave directories in `TMPDIR` (61 `uxdsl-cli-watch-*`,
4 `uxdsl-webpack-loader-test-*`, 2 `vite-plugin-uxdsl-test-*` after this
step's runs): MIG-B9-25's subject. They were removed.

**Before starting**, on the base the story starts from, these must also exit
0. On `5a041fc` each exited 1, as expected, since the stories are not merged:

```bash
git log --oneline --grep='MIG-B9-21 -' HEAD | grep -q .    # MIG-B9-21 merged
git log --oneline --grep='MIG-B9-38 -' HEAD | grep -q .    # MIG-B9-38 merged (README §7, bin/uxdsl.js)
for s in 25 17 28; do git log --oneline --grep="MIG-B9-$s -" HEAD | grep -q . || exit 1; done   # README §7, test/cli/**
```

Then re-run the block above and §4, and record any difference in §15. The
line numbers above will have moved: MIG-B9-21's K7 rewrites the comments of
`vite.ts`, `webpack.ts` and `bin/uxdsl.js`, and MIG-B9-38 edits
`bin/uxdsl.js`. On that base also check:

- whether `compile()`'s error still carries `file`, `line`, `column`, `code`
  and `sassFrame` as §4.6 records. C1 to C6 rely on `err.file`;
- that `test/cli/watch-mode.test.js` and the new test files use MIG-B9-25's
  temporary-directory helper, whose guard fails a test that leaves a
  directory;
- what MIG-B9-21 changed in `bin/uxdsl.js`, `test/cli/**` and the captures.
  When this file was written, a record of owner decisions dated 2026-11-13
  was in progress in the same worktree and not committed. Its decision 8
  gives MIG-B9-21 the rewording of the CLI's `UXD_THEME_MARKER` "none" hint,
  with `cli-captures.json` regenerated. If that is merged, §4's
  `UXD_THEME_MARKER` lines (cut at 220 characters, before the hint) do not
  change, and AC7's `git diff` of `src/generated` is still taken against a
  BASE that includes it;
- whether MIG-B9-28's Windows job runs `packages/uxdsl/test/{cli,vite,webpack}/**`.
  The new tests must then pass there, or be skipped with the reason MIG-B9-28's
  C3 requires.

## 4. Baseline

Recorded on `5a041fc`, 2026-11-13 between 09:15 and 09:45 EST, on the
owner's Mac. Other agents' workflows ran on the same machine (load average
3.7 to 10.3), so every "seen after N ms" below is indicative only. The same
reproduction on `a00fbbe` (before MIG-B9-20), on 2026-11-10, gave the same
outcome at every step. Only the output sizes differed (47 KB then, 84 bytes
now, because the theme is emitted only at `@uxdsl theme;`), along with the
`UXD_THEME_MARKER` lines.

§4.1's block is MIG-B9-39's, verbatim. This story's lines in it are the
setup, the two that run `cli-single.js` and `cli-first-and-builds.js`, the
final `pgrep` and `rm`; §4.2 below holds the three scripts they need, and
the other five are in MIG-B9-39 §4.2.

### 4.1 Setup

Everything runs from a packed tarball installed in a scratch consumer, as a
user's project would. From the worktree root, through `bash`, with `TMPDIR`
set to an empty scratch directory:

```bash
S="${TMPDIR:?}/mig-b9-39-baseline"; W="$PWD"
mkdir -p "$S/src" "$S/pack" "$S/consumer" "$S/projects" "$S/scripts"
git archive HEAD packages/uxdsl tsconfig.base.json | tar -x -C "$S/src"
ln -s "$W/packages/uxdsl/node_modules" "$S/src/packages/uxdsl/node_modules"
(cd "$S/src/packages/uxdsl" && npm run build && npm pack --ignore-scripts --pack-destination "$S/pack")
# uxdsl-0.5.0-beta.9.tgz, 284,866 bytes, 92 files; its dist equals the worktree's (diff -rq exit 0)
cd "$S/consumer" && printf '{"name":"mig-b9-39-consumer","version":"1.0.0","private":true}\n' > package.json
npm install --save-dev --ignore-scripts --no-audit --no-fund "$S/pack/uxdsl-0.5.0-beta.9.tgz" \
  vite@7.3.7 webpack@5.111.1 css-loader@7.1.5 mini-css-extract-plugin@2.10.2 style-loader@4.0.0
# installed: uxdsl 0.5.0-beta.9, vite 7.3.7, webpack 5.111.1, css-loader 7.1.5, mini-css-extract-plugin 2.10.2,
# style-loader 4.0.0, sass 1.108.2, chokidar 4.0.3, postcss 8.5.32
cd "$W"
# Write the eight scripts of §4.2 into "$S/scripts", then:
node "$S/scripts/cli-single.js" "$S/consumer" "$S/projects/cli-single"
node "$S/scripts/cli-first-and-builds.js" "$S/consumer" "$S/projects"
for k in dev build; do P="$S/projects/vite-$k"; mkdir -p "$P"; ln -s "$S/consumer/node_modules" "$P/node_modules"
  printf '{"name":"vite-%s","private":true,"type":"module"}\n' "$k" > "$P/package.json"; done
cp "$S/scripts/vite-dev.mjs" "$S/projects/vite-dev/"; cp "$S/scripts/vite-build-watch.mjs" "$S/projects/vite-build/"
(cd "$S/projects/vite-dev" && node vite-dev.mjs "$PWD" && node vite-dev.mjs "$PWD" first-fails)
(cd "$S/projects/vite-build" && node vite-build-watch.mjs "$PWD" && node vite-build-watch.mjs "$PWD" first-fails)
for k in extract style; do P="$S/projects/webpack-$k"; mkdir -p "$P"; ln -s "$S/consumer/node_modules" "$P/node_modules"
  printf '{"name":"webpack-%s","private":true}\n' "$k" > "$P/package.json"
  node "$S/scripts/webpack-watch.js" "$P" "$k"; node "$S/scripts/webpack-watch.js" "$P" "$k" first-fails; done
node "$S/scripts/webpack-error-text.js" "$S/projects/webpack-style"
P="$S/projects/webpack-theme"; mkdir -p "$P"; ln -s "$S/consumer/node_modules" "$P/node_modules"
printf '{"name":"webpack-theme","private":true}\n' > "$P/package.json"; node "$S/scripts/webpack-theme-first.js" "$P"
pgrep -fl "uxdsl.*--watch|vite-dev|vite-build-watch|webpack-watch|webpack-theme-first"   # exit 1: nothing left running
rm -rf "$S"
```

Every script exited 0, and the final `pgrep` exited 1.

### 4.2 The scripts

`lib.js`, the CLI's helpers:

```js
'use strict';
// Helpers for the MIG-B9-39 baseline: a child process whose output is
// collected, steps that write files and wait for a line, and a hash of a file.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function hash(file) {
  try { return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 10) + ` (${fs.statSync(file).size} B)`; } catch { return 'absent'; }
}
function proc(cmd, args, cwd, env = {}) {
  const child = spawn(cmd, args, { cwd, stdio: 'pipe', env: { ...process.env, ...env } });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  return {
    child,
    get log() { return log; },
    since(mark) { return log.slice(mark); },
    async waitFor(re, mark = 0, timeout = 20000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const m = log.slice(mark).match(re);
        if (m) return { ok: true, ms: Date.now() - start };
        await delay(100);
      }
      return { ok: false, ms: Date.now() - start };
    },
    stop() { child.kill('SIGTERM'); },
  };
}
function writer(root) {
  return (file, text) => { const f = path.join(root, file); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
}
// One step: an action, then wait for `re` (or `quietMs` of no match), then
// report the new output, trimmed, and the files' hashes.
async function step(p, label, action, { re, quietMs, files = [], root, show = 6 } = {}) {
  const mark = p.log.length;
  await action();
  let outcome;
  if (re) {
    const r = await p.waitFor(re, mark, 20000);
    outcome = r.ok ? `seen after ${r.ms} ms` : `NOT seen in ${r.ms} ms`;
  } else {
    await delay(quietMs);
    outcome = `waited ${quietMs} ms`;
  }
  await delay(400);
  const out = p.since(mark).split('\n').filter((l) => l.trim()).map((l) => l.replace(root, '<root>'));
  const shown = out.length > show ? [...out.slice(0, show), `… (${out.length - show} more lines)`] : out;
  console.log(`\n### ${label} — ${outcome}`);
  for (const l of shown) console.log(`  | ${l.slice(0, 220)}`);
  for (const f of files) console.log(`  = ${f}: ${hash(path.join(root, f))}`);
  return out;
}
module.exports = { delay, hash, proc, writer, step };
```

`cli-single.js`:

```js
'use strict';
// The CLI's `uxdsl build --watch`, single entry, from the installed tarball.
// Usage: node cli-single.js <consumer dir> <project dir>
const fs = require('node:fs');
const path = require('node:path');
const { proc, writer, step, delay } = require('./lib');
const [consumer, root] = process.argv.slice(2);
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(root, { recursive: true });
fs.symlinkSync(path.join(consumer, 'node_modules'), path.join(root, 'node_modules'));
const put = writer(root);
const OUT = 'dist/out.css';
const MAIN = "@use './parts/card';\n@use '../shared/tokens.scss' as t;\n.main { color: t.$brand; padding: space(2); }\n";
put('uxdsl.config.cjs', "module.exports = { entry: './src/main.uxdsl', outFile: './dist/out.css' };\n");
put('src/main.uxdsl', MAIN);
put('src/parts/_card.uxdsl', '.card { color: red; }\n');
put('shared/tokens.scss', '$brand: blue;\n');
(async () => {
  const p = proc(process.execPath, [path.join(consumer, 'node_modules/uxdsl/bin/uxdsl.js'), 'build', '--watch'], root);
  const opt = (o) => ({ root, files: [OUT], ...o });
  await step(p, 'S0 start', async () => {}, opt({ re: /\[uxdsl\] (built|build failed)/ }));
  await delay(1500);
  await step(p, 'S1 Sass error in src/parts/_card.uxdsl (a watched .uxdsl partial)', async () => put('src/parts/_card.uxdsl', '.card { color: ; }\n'), opt({ re: /build failed/ }));
  await step(p, 'S2 fix it', async () => put('src/parts/_card.uxdsl', '.card { color: red; }\n'), opt({ re: /\[uxdsl\] (built|unchanged)/ }));
  await step(p, 'S3 UXDSL error (unknown token space(99)) in the partial', async () => put('src/parts/_card.uxdsl', '.card { padding: space(99); }\n'), opt({ re: /build failed/ }));
  await step(p, 'S4 fix it', async () => put('src/parts/_card.uxdsl', '.card { color: red; }\n'), opt({ re: /\[uxdsl\] (built|unchanged)/ }));
  await step(p, 'S5 the entry @uses a missing .uxdsl partial', async () => put('src/main.uxdsl', "@use './parts/missing';\n" + MAIN), opt({ re: /build failed/ }));
  await step(p, 'S6 create src/parts/_missing.uxdsl (a watch pattern matches it)', async () => put('src/parts/_missing.uxdsl', '.missing { color: green; }\n'), opt({ re: /\[uxdsl\] (built|unchanged)/ }));
  await step(p, 'S7 Sass error in shared/tokens.scss (outside the patterns; loaded by the last good build)', async () => put('shared/tokens.scss', '$brand: ;\n'), opt({ re: /build failed/ }));
  await step(p, 'S8 fix it', async () => put('shared/tokens.scss', '$brand: blue;\n'), opt({ re: /\[uxdsl\] (built|unchanged)/ }));
  put('shared/extra.scss', '$e: ;\n');
  await delay(500);
  await step(p, 'S9 the entry starts @using shared/extra.scss, which has a Sass error (first loaded by a failing build)', async () => put('src/main.uxdsl', "@use '../shared/extra.scss' as x;\n@use './parts/missing';\n" + MAIN), opt({ re: /build failed/ }));
  await step(p, 'S10 fix shared/extra.scss', async () => put('shared/extra.scss', '$e: 1px;\n'), opt({ quietMs: 5000 }));
  await step(p, 'S11 save the entry unchanged (touch)', async () => { const f = path.join(root, 'src/main.uxdsl'); fs.writeFileSync(f, fs.readFileSync(f)); }, opt({ re: /\[uxdsl\] (built|unchanged)/ }));
  await step(p, 'S12 the entry @uses a missing .scss partial', async () => put('src/main.uxdsl', "@use '../shared/later.scss' as l;\n@use './parts/missing';\n" + MAIN), opt({ re: /build failed/ }));
  await step(p, 'S13 create shared/later.scss (no pattern matches it)', async () => put('shared/later.scss', '$l: 1px;\n'), opt({ quietMs: 5000 }));
  await step(p, 'S14 save the entry unchanged (touch)', async () => { const f = path.join(root, 'src/main.uxdsl'); fs.writeFileSync(f, fs.readFileSync(f)); }, opt({ re: /\[uxdsl\] (built|unchanged)/ }));
  p.stop();
  await delay(500);
  console.log(`\nexit: watcher stopped (signal ${p.child.signalCode})`);
})();
```

`cli-first-and-builds.js`:

```js
'use strict';
// The CLI's `uxdsl build --watch`: a first build that fails, and `builds`.
// Usage: node cli-first-and-builds.js <consumer dir> <project dir>
const fs = require('node:fs');
const path = require('node:path');
const { proc, writer, step, delay } = require('./lib');
const [consumer, base] = process.argv.slice(2);
const BIN = path.join(consumer, 'node_modules/uxdsl/bin/uxdsl.js');
function project(name) {
  const root = path.join(base, name);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  fs.symlinkSync(path.join(consumer, 'node_modules'), path.join(root, 'node_modules'));
  return root;
}
const MAIN = "@use './parts/card';\n@use '../shared/tokens.scss' as t;\n.main { color: t.$brand; padding: space(2); }\n";
(async () => {
  for (const which of ['uxdsl', 'scss']) {
    const root = project(`cli-first-${which}`);
    const put = writer(root);
    put('uxdsl.config.cjs', "module.exports = { entry: './src/main.uxdsl', outFile: './dist/out.css' };\n");
    put('src/main.uxdsl', MAIN);
    put('src/parts/_card.uxdsl', which === 'uxdsl' ? '.card { color: ; }\n' : '.card { color: red; }\n');
    put('shared/tokens.scss', which === 'scss' ? '$brand: ;\n' : '$brand: blue;\n');
    const p = proc(process.execPath, [BIN, 'build', '--watch'], root);
    const opt = (o) => ({ root, files: ['dist/out.css'], ...o });
    console.log(`\n## First build fails in ${which === 'uxdsl' ? 'src/parts/_card.uxdsl (a watch pattern matches it)' : 'shared/tokens.scss (no pattern matches it)'}`);
    await step(p, 'F0 start', async () => {}, opt({ re: /watching for changes/ }));
    await delay(1500);
    if (which === 'uxdsl') {
      await step(p, 'F1 fix src/parts/_card.uxdsl', async () => put('src/parts/_card.uxdsl', '.card { color: red; }\n'), opt({ re: /\[uxdsl\] (built|unchanged|build failed)/ }));
    } else {
      await step(p, 'F1 fix shared/tokens.scss', async () => put('shared/tokens.scss', '$brand: blue;\n'), opt({ quietMs: 5000 }));
      await step(p, 'F2 save the entry unchanged (touch)', async () => { const f = path.join(root, 'src/main.uxdsl'); fs.writeFileSync(f, fs.readFileSync(f)); }, opt({ re: /\[uxdsl\] (built|unchanged|build failed)/ }));
    }
    p.stop();
    await delay(500);
  }
  {
    const root = project('cli-builds');
    const put = writer(root);
    put('uxdsl.config.cjs', "module.exports = { builds: [ { entry: './src/a.uxdsl', outFile: './dist/a.css' }, { entry: './src/b.uxdsl', outFile: './dist/b.css' } ] };\n");
    put('src/a.uxdsl', "@use './parts/card';\n.a { color: red; }\n");
    put('src/b.uxdsl', '.b { color: blue; }\n');
    put('src/parts/_card.uxdsl', '.card { color: red; }\n');
    const p = proc(process.execPath, [BIN, 'build', '--watch'], root);
    const opt = (o) => ({ root, files: ['dist/a.css', 'dist/b.css'], ...o });
    console.log('\n## builds: a loads src/parts/_card.uxdsl, b does not');
    await step(p, 'B0 start', async () => {}, opt({ re: /watching for changes/ }));
    await delay(1500);
    await step(p, 'B1 Sass error in the partial a loads', async () => put('src/parts/_card.uxdsl', '.card { color: ; }\n'), opt({ re: /build failed/ }));
    await step(p, 'B2 edit b while a is broken (selective build of b)', async () => put('src/b.uxdsl', '.b { color: navy; }\n'), opt({ re: /\[uxdsl\] (built|unchanged|build failed)/ }));
    await step(p, 'B3 edit the config while a is broken (full rebuild)', async () => put('uxdsl.config.cjs', "module.exports = { builds: [ { entry: './src/a.uxdsl', outFile: './dist/a.css' }, { entry: './src/b.uxdsl', outFile: './dist/b.css', sourcemap: false } ] };\n"), opt({ re: /\[uxdsl\] (built|unchanged|build failed)/ }));
    await step(p, 'B4 fix the partial', async () => put('src/parts/_card.uxdsl', '.card { color: red; }\n'), opt({ re: /\[uxdsl\] (built|unchanged|build failed)/ }));
    p.stop();
    await delay(500);
  }
  console.log('\nexit: watchers stopped');
})();
```

### 4.3 The output, exactly

The scratch directory is shown as `<S>`. A path the scripts cut at 160
characters, after the scratch prefix had been cut too, is shown as `<S…>`.

`uxdsl build --watch`, single entry (`cli-single.js`):

```text

### S0 start — seen after 302 ms
  | [uxdsl] Warning: UXD_THEME_MARKER: no entry reaches `@uxdsl theme;`, so nothing this build writes defines the --uxdsl__ tokens its CSS references. Write `@uxdsl theme;` once, at the top level of the global stylesheet tha
  | [uxdsl] built dist/out.css (84 bytes)
  | [uxdsl] watching for changes...
  = dist/out.css: 825978cd2b (84 B)

### S1 Sass error in src/parts/_card.uxdsl (a watched .uxdsl partial) — seen after 101 ms
  | [uxdsl] change src/parts/_card.uxdsl
  | [uxdsl] build failed: src/parts/_card.uxdsl:1:16: UXD_SASS: Expected expression.
  |     ╷
  |   1 │ .card { color: ; }
  |     │                ^
  |     ╵
  | … (2 more lines)
  = dist/out.css: 825978cd2b (84 B)

### S2 fix it — seen after 101 ms
  | [uxdsl] change src/parts/_card.uxdsl
  | [uxdsl] unchanged dist/out.css (compiled output identical to the file on disk; not rewritten)
  = dist/out.css: 825978cd2b (84 B)

### S3 UXDSL error (unknown token space(99)) in the partial — seen after 99 ms
  | [uxdsl] change src/parts/_card.uxdsl
  | [uxdsl] build failed: uxdsl: src/parts/_card.uxdsl:1:9: UXD_SPACE_REFERENCE: space(99) does not exist; available keys: 0–16. Did you mean "16"?
  | > 1 | .card { padding: space(99); }
  |     |         ^
  |   2 | 
  = dist/out.css: 825978cd2b (84 B)

### S4 fix it — seen after 101 ms
  | [uxdsl] change src/parts/_card.uxdsl
  | [uxdsl] unchanged dist/out.css (compiled output identical to the file on disk; not rewritten)
  = dist/out.css: 825978cd2b (84 B)

### S5 the entry @uses a missing .uxdsl partial — seen after 101 ms
  | [uxdsl] change src/main.uxdsl
  | [uxdsl] build failed: src/main.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import.
  |     ╷
  |   1 │ @use './parts/missing';
  |     │ ^^^^^^^^^^^^^^^^^^^^^^
  |     ╵
  | … (1 more lines)
  = dist/out.css: 825978cd2b (84 B)

### S6 create src/parts/_missing.uxdsl (a watch pattern matches it) — seen after 101 ms
  | [uxdsl] add src/parts/_missing.uxdsl
  | [uxdsl] built dist/out.css (114 bytes)
  = dist/out.css: 8a1351d721 (114 B)

### S7 Sass error in shared/tokens.scss (outside the patterns; loaded by the last good build) — seen after 100 ms
  | [uxdsl] change shared/tokens.scss
  | [uxdsl] build failed: shared/tokens.scss:1:9: UXD_SASS: Expected expression.
  |     ╷
  |   1 │ $brand: ;
  |     │         ^
  |     ╵
  | … (2 more lines)
  = dist/out.css: 8a1351d721 (114 B)

### S8 fix it — seen after 101 ms
  | [uxdsl] change shared/tokens.scss
  | [uxdsl] unchanged dist/out.css (compiled output identical to the file on disk; not rewritten)
  = dist/out.css: 8a1351d721 (114 B)

### S9 the entry starts @using shared/extra.scss, which has a Sass error (first loaded by a failing build) — seen after 100 ms
  | [uxdsl] change src/main.uxdsl
  | [uxdsl] build failed: shared/extra.scss:1:5: UXD_SASS: Expected expression.
  |     ╷
  |   1 │ $e: ;
  |     │     ^
  |     ╵
  | … (2 more lines)
  = dist/out.css: 8a1351d721 (114 B)

### S10 fix shared/extra.scss — waited 5000 ms
  = dist/out.css: 8a1351d721 (114 B)

### S11 save the entry unchanged (touch) — seen after 101 ms
  | [uxdsl] change src/main.uxdsl
  | [uxdsl] unchanged dist/out.css (compiled output identical to the file on disk; not rewritten)
  = dist/out.css: 8a1351d721 (114 B)

### S12 the entry @uses a missing .scss partial — seen after 101 ms
  | [uxdsl] change src/main.uxdsl
  | [uxdsl] build failed: src/main.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import.
  |     ╷
  |   1 │ @use '../shared/later.scss' as l;
  |     │ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  |     ╵
  | … (1 more lines)
  = dist/out.css: 8a1351d721 (114 B)

### S13 create shared/later.scss (no pattern matches it) — waited 5000 ms
  = dist/out.css: 8a1351d721 (114 B)

### S14 save the entry unchanged (touch) — seen after 101 ms
  | [uxdsl] change src/main.uxdsl
  | [uxdsl] unchanged dist/out.css (compiled output identical to the file on disk; not rewritten)
  = dist/out.css: 8a1351d721 (114 B)

exit: watcher stopped (signal SIGTERM)
```

`uxdsl build --watch`, a first build that fails, and `builds` (`cli-first-and-builds.js`):

```text

## First build fails in src/parts/_card.uxdsl (a watch pattern matches it)

### F0 start — seen after 301 ms
  | [uxdsl] build failed: src/parts/_card.uxdsl:1:16: UXD_SASS: Expected expression.
  |     ╷
  |   1 │ .card { color: ; }
  |     │                ^
  |     ╵
  |     src/parts/_card.uxdsl 1:16  @use
  | … (2 more lines)
  = dist/out.css: absent

### F1 fix src/parts/_card.uxdsl — seen after 101 ms
  | [uxdsl] change src/parts/_card.uxdsl
  | [uxdsl] Warning: UXD_THEME_MARKER: no entry reaches `@uxdsl theme;`, so nothing this build writes defines the --uxdsl__ tokens its CSS references. Write `@uxdsl theme;` once, at the top level of the global stylesheet tha
  | [uxdsl] built dist/out.css (84 bytes)
  = dist/out.css: 825978cd2b (84 B)

## First build fails in shared/tokens.scss (no pattern matches it)

### F0 start — seen after 303 ms
  | [uxdsl] build failed: shared/tokens.scss:1:9: UXD_SASS: Expected expression.
  |     ╷
  |   1 │ $brand: ;
  |     │         ^
  |     ╵
  |     shared/tokens.scss 1:9  @use
  | … (2 more lines)
  = dist/out.css: absent

### F1 fix shared/tokens.scss — waited 5000 ms
  = dist/out.css: absent

### F2 save the entry unchanged (touch) — seen after 101 ms
  | [uxdsl] change src/main.uxdsl
  | [uxdsl] Warning: UXD_THEME_MARKER: no entry reaches `@uxdsl theme;`, so nothing this build writes defines the --uxdsl__ tokens its CSS references. Write `@uxdsl theme;` once, at the top level of the global stylesheet tha
  | [uxdsl] built dist/out.css (84 bytes)
  = dist/out.css: 825978cd2b (84 B)

## builds: a loads src/parts/_card.uxdsl, b does not

### B0 start — seen after 403 ms
  | [uxdsl] built dist/a.css (45 bytes)
  | [uxdsl] built dist/b.css (21 bytes)
  | [uxdsl] watching for changes...
  = dist/a.css: e35a41d2a6 (45 B)
  = dist/b.css: dafffd133b (21 B)

### B1 Sass error in the partial a loads — seen after 101 ms
  | [uxdsl] change src/parts/_card.uxdsl
  | [uxdsl] build failed: builds[0] (dist/a.css): src/parts/_card.uxdsl:1:16: UXD_SASS: Expected expression.
  |     ╷
  |   1 │ .card { color: ; }
  |     │                ^
  |     ╵
  | … (2 more lines)
  = dist/a.css: e35a41d2a6 (45 B)
  = dist/b.css: dafffd133b (21 B)

### B2 edit b while a is broken (selective build of b) — seen after 102 ms
  | [uxdsl] change src/b.uxdsl
  | [uxdsl] built dist/b.css (21 bytes)
  = dist/a.css: e35a41d2a6 (45 B)
  = dist/b.css: 80802f54fa (21 B)

### B3 edit the config while a is broken (full rebuild) — seen after 102 ms
  | [uxdsl] change uxdsl.config.cjs
  | [uxdsl] build failed: builds[0] (dist/a.css): src/parts/_card.uxdsl:1:16: UXD_SASS: Expected expression.
  |     ╷
  |   1 │ .card { color: ; }
  |     │                ^
  |     ╵
  | … (2 more lines)
  = dist/a.css: e35a41d2a6 (45 B)
  = dist/b.css: 80802f54fa (21 B)

### B4 fix the partial — seen after 101 ms
  | [uxdsl] change src/parts/_card.uxdsl
  | [uxdsl] unchanged dist/a.css (compiled output identical to the file on disk; not rewritten)
  = dist/a.css: e35a41d2a6 (45 B)
  = dist/b.css: 80802f54fa (21 B)

exit: watchers stopped
```

### 4.4 What the baseline shows

"Kept" means the last good output stays on disk. "Recovers" means the save
that fixes the file rebuilds.

| Host | Failure | Reported | Kept | Recovers on the fix |
| --- | --- | --- | --- | --- |
| CLI | Sass or UXDSL error in a partial the last good build loaded (S1–S4, S7–S8, B1–B4) | yes, with the frame | yes | yes |
| CLI | a missing `.uxdsl` partial a pattern matches, then created (S5–S6) | yes | yes | yes |
| CLI | an error in a file outside the patterns that the failing build loaded first (S9–S11) | yes | yes | **no**: nothing for 5 s; saving the entry recovers |
| CLI | a first build failing in a partial a pattern matches (F0–F1) | yes | — | yes |
| CLI | a first build failing in `shared/tokens.scss`, outside the patterns (F0–F2) | yes | — | **no**: nothing for 5 s; saving the entry recovers |
| CLI | a missing `.scss` partial outside the patterns, then created (S12–S14) | yes | yes | **no** (documented, cli.md 544–549; flag 15); saving the entry recovers |

(MIG-B9-39 §4.4's other rows, for Vite and webpack, stay in that file.)

`UXD_THEME_MARKER` (MIG-B9-20) under the CLI: printed by the first build that
succeeds (S0, and F1 or F2 after a first failure). It is not printed again
after a failure and a fix, because the session's count is updated only by a
build that succeeds and the warning is printed only when it differs.

### 4.5 The flaky test and the captures check

Every CI run of the `npm test` job that failed in `watch-mode.test.js` since
PR #71 (`gh run list --workflow CI`; the job logs were fetched with
`gh api --allow-escape-sequences repos/rsantoyo-dev/uxdsl/actions/jobs/<id>/logs`):

| Run (attempt), job | Date (UTC) | Branch, base | Test (file line) | Error | Duration |
| --- | --- | --- | --- | --- | --- |
| 42342121515 (1), 128311883517 | 2026-11-07 | PR #71, `feat/b9-14-cli-adapters` | `watch mode reloads a theme value that comes from a nested require() …` (145) | `waitFor timed out` | — |
| 42539238452 (1), 128910321164 | 2026-11-09 | PR #72, `feat/b9-15-superset-docs` | `watch retargets the entry and source globs without restarting the CLI, and keeps following the theme file` (36) | `waitFor timed out` | 22,424 ms |
| 42842861249 (1), 129922388725 | 2026-11-10 | PR #80, `docs/b9-wave2-story-files` | the same (36) | `waitFor timed out` | — |
| 43367559177 (1), 131695444161 | 2026-11-13 | PR #66 (Dependabot, `packages/uxdsl-vscode`), base `main` | the same (36) | `waitFor timed out` | 22,323 ms |

Each stack names only `waitFor`'s own `tick` (`watch-mode.test.js:101:16`),
so the log does not say which of the test's waits timed out. Each re-run
passed.

On the same days one other watch-mode test failed, outside the registration:
run 43367584099 (PR #84, Dependabot, `packages/playground-nextjs`, base
`main`), job 131695521250, `MIG-B6-23: an output file is never observed empty
or truncated while a rebuild is writing it (atomic replace)` (line 442):
`output file observed empty/truncated: "@import url('https://fonts.googleapis.com/…` (§15, Q6).

On this machine neither test failed:

- the two tests alone, ten runs on `a00fbbe` and ten on `5a041fc`
  (`node --test --test-name-pattern="^watch (retargets the entry and source globs|mode reloads a theme value that comes from a nested require)" packages/uxdsl/test/cli/watch-mode.test.js`):
  20 of 20 exit 0, 5–7 s each;
- `capture-capabilities.js --check` on a scratch copy of the playground's
  `scripts`, `capability-fixtures` and `src/generated` with the package built
  from the base: 15 of 15 runs on `a00fbbe` and 5 of 5 on `5a041fc` printed
  "Captured CLI and compiler output is up to date.", 13–17 s each;
- a write made 0 ms or 1000 ms after `[uxdsl] watching for changes...`, in
  test 145's scenario (a theme file that requires a JSON file; script below):
  10 of 10 rebuilt within about 100 ms. So on macOS (FSEvents) the line being
  printed before chokidar's `ready` (§2, `bin/uxdsl.js:1696`) loses no event.
  Whether it does on Linux (inotify, where chokidar adds a watch per
  directory before `ready`) was not measured: no Linux machine was available,
  and CI has no `workflow_dispatch` trigger.

```js
'use strict';
// Writes the nested theme JSON (watch-mode.test.js:145's scenario) N ms after
// `[uxdsl] watching for changes...` is printed, and reports whether the session
// rebuilt with the new value within 8 s. Usage: node ready-race.js <consumer> <base dir> <delay ms> <runs>
const fs = require('node:fs');
const path = require('node:path');
const { proc, delay } = require('./lib');
const [consumer, base, delayMs, runs] = process.argv.slice(2);
(async () => {
  let seen = 0;
  for (let i = 1; i <= Number(runs); i++) {
    const dir = path.join(base, `ready-race-${i}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.symlinkSync(path.join(consumer, 'node_modules'), path.join(dir, 'node_modules'));
    fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), "module.exports = { entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css', watch: ['src/**/*.uxdsl'] };\n");
    fs.writeFileSync(path.join(dir, 'src/uxdsl-entry.uxdsl'), '@uxdsl theme;\n');
    fs.writeFileSync(path.join(dir, 'theme-data.json'), JSON.stringify({ palette: { primary: { main: '#111111' } } }));
    fs.writeFileSync(path.join(dir, 'uxdsl.theme.cjs'), "module.exports = require('./theme-data.json');\n");
    const p = proc(process.execPath, [path.join(consumer, 'node_modules/uxdsl/bin/uxdsl.js'), 'build', '--watch'], dir);
    await p.waitFor(/watching for changes/);
    await delay(Number(delayMs));
    fs.writeFileSync(path.join(dir, 'theme-data.json'), JSON.stringify({ palette: { primary: { main: '#333333' } } }));
    const start = Date.now();
    let ok = false;
    while (Date.now() - start < 8000) {
      if (fs.readFileSync(path.join(dir, 'src/uxdsl.css'), 'utf8').includes('#333333')) { ok = true; break; }
      await delay(100);
    }
    if (ok) seen++;
    console.log(`run ${i}: write ${delayMs} ms after the line -> ${ok ? `rebuilt in ${Date.now() - start} ms` : 'NOT rebuilt in 8000 ms'}`);
    p.stop();
    await delay(300);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`${seen}/${runs} rebuilt`);
})();
```

Its output (`node ready-race.js <consumer> <projects> 0 5`, then `… 1000 5`):

```text
run 1: write 0 ms after the line -> rebuilt in 101 ms
run 2: write 0 ms after the line -> rebuilt in 102 ms
run 3: write 0 ms after the line -> rebuilt in 100 ms
run 4: write 0 ms after the line -> rebuilt in 102 ms
run 5: write 0 ms after the line -> rebuilt in 101 ms
5/5 rebuilt
run 1: write 1000 ms after the line -> rebuilt in 101 ms
run 2: write 1000 ms after the line -> rebuilt in 102 ms
run 3: write 1000 ms after the line -> rebuilt in 102 ms
run 4: write 1000 ms after the line -> rebuilt in 101 ms
run 5: write 1000 ms after the line -> rebuilt in 104 ms
5/5 rebuilt
```

How `captureWatch()` records a step
(`packages/playground-nextjs/scripts/capture-capabilities.js`, lines 163–208).
It collects stdout and stderr from two pipes into one array, in the order the
`data` events arrive. A step's output is every line from the cursor to 400 ms
after the awaited line. The committed transcript interleaves the two streams
(`[uxdsl] change src/card.uxdsl` on stdout, then `! [uxdsl] build failed: …`
on stderr). A different arrival order between the pipes, or a line that
arrives after the 400 ms, would make `--check` report a byte-identical
committed file as stale. Neither was observed (§15, F6).

### 4.6 The error `compile()` throws

From the installed tarball, `compile({ entry }, { loadPaths, theme })` on four
failures (a probe in the scratch consumer):

```text
Sass error in a partial -> code=UXD_SASS file=parts/_card.uxdsl line=1 column=13 loc=undefined sassFrame=string showSourceCode=undefined dependencies=undefined warnings=undefined name=Error
UXDSL error in a partial -> code=undefined file=parts/_card.uxdsl line=1 column=6 loc=undefined sassFrame=undefined showSourceCode=function dependencies=undefined warnings=undefined name=CssSyntaxError
missing partial -> code=UXD_SASS file=main.uxdsl line=1 column=1 loc=undefined sassFrame=string showSourceCode=undefined dependencies=undefined warnings=undefined name=Error
invalid theme -> code=UXD_THEME_INVALID file=undefined line=undefined column=undefined loc=undefined sassFrame=undefined showSourceCode=undefined dependencies=undefined warnings=undefined name=Error
```

`file` is absolute (shown relative here). The error names the file at fault
and its position, but not the files the compile had loaded, so "the last good
dependencies" have to come from the adapter's own record of its last
successful compile. For a missing partial, `file` is the file that `@use`s it.

## 5. Contract

The host: `uxdsl build --watch` with a single entry and with `builds`, as
MIG-B9-39's contract names it. "A failed compile" is any error `compile()`
throws: `UXD_SASS`, a UXDSL error, a theme error. C6 to C9 are MIG-B9-39's,
verbatim and with their numbers (decision 28 of 2026-11-13); C1 to C5 are
MIG-B9-39's.

- **C6 — the CLI follows the file a failed build names (Q3 (a)).** When a
  build of `uxdsl build --watch` fails, the first build included, the
  session follows `err.file` when no `watch` pattern matches it and the last
  graph does not hold it. An edit to that file then rebuilds, as any file
  outside the graph does (a full rebuild), and the build succeeds when the
  edit fixes it. On §4's S10 and F1 (`shared/tokens.scss`) a build runs and
  prints `[uxdsl] built …` or `[uxdsl] unchanged …`, where the base prints
  nothing for 5 s. The file stops being followed once a successful build no
  longer loads it, as any followed file does today.
- **C7 — the CLI's watching line means ready.** `[uxdsl] watching for
  changes...` is printed once the session's watcher has reported `ready`,
  so a file written after the line is seen. Its text, its stream (stdout)
  and its place after the first build's lines are unchanged. A watcher the
  session recreates (`refreshWatcher`) prints nothing, as today.
- **C8 — the two CI-flaky tests are diagnosable.** In
  `packages/uxdsl/test/cli/watch-mode.test.js`, the tests at lines 36 and
  145 wait for C7's line instead of `WATCHER_SETTLE_MS`. Every wait in them
  that times out fails with an error naming its step and holding the CLI's
  output so far. Their assertions are otherwise unchanged.
- **C9 — the captures check names the difference.**
  `node packages/playground-nextjs/scripts/capture-capabilities.js --check`,
  for each file it reports stale, prints the first line that differs: the
  file's path and line number, the committed text and the captured text. Its
  exit code (1) and its existing lines (`Stale captured output: …`,
  `Run: node …`) are unchanged.

No new `UXD_*` code. `DIAGNOSTIC_CATALOG` is unchanged.

MIG-B9-39's list, verbatim, which decision 28 of 2026-11-13 applies to both
stories:

**Must stay byte-identical, or unchanged:**

- `compile()` and the error it throws: `packages/uxdsl/src/compile.ts`,
  `src/sass/**` and `src/diagnostics.ts` are not edited.
- Every successful build's output on every host: its CSS, maps and
  warnings.
- A failed compile still fails, as today. webpack reports one module error
  (mini-css-extract-plugin adds its own execution error), and the extracted
  `main.css` on disk stays the last good one. Vite sends its error payload,
  and `vite build --watch` emits `ERROR`. The CLI prints `[uxdsl] build
  failed:` with the same text and frame. One-shot `uxdsl build` exits 1, and
  one-shot `vite build` and `webpack` fail as today.
- The CLI's text: the `[uxdsl] watching for changes...` line itself,
  `built`, `unchanged`, `change`, `add`, `regenerated`. The committed
  captures (`packages/playground-nextjs/src/generated/cli-captures.json`
  and `compiler-captures.json`) are not regenerated, and `--check` exits 0.
- MIG-B9-20's theme count:
  - the CLI session's count is updated only by a build that succeeds, and
    `UXD_THEME_MARKER` is printed when it differs from the one printed last;
  - Vite's `buildEnd` warns nothing for a failed build, and the dev server's
    rule is unchanged;
  - a webpack module whose compile failed carries no theme flags, so the
    count at `finishModules` stays incomplete and never reports "none".
  So a recovered build warns exactly as a first successful build would.
- Vite's `resolveId`, `?inline` handling, and the updates already sent for
  steps that recover today (V2, V4, V7, V10).
- `cli.md`'s documented limit for a missing partial created where no
  pattern matches (lines 544–549), and the same case in Vite (V9, B9) and
  webpack. A partial that never existed is not one the error names: §6.

## 6. Out of scope

- **The adapters** (MIG-B9-39's C1 to C5, T1 to T10, AC1 to AC3, and AC7 to
  AC9 for their part): MIG-B9-39 (decision 28 of 2026-11-13).
- **The CLI watch's four older gaps** (MIG-B9-14 §15's follow-up, third
  bullet): the queued selective batch that runs outside `building`
  (`bin/uxdsl.js:1852`); a glob root or plain `watch` path deleted and
  re-created; a file modified after Dart Sass read it, during the build that
  first loads it; a missing partial created where no pattern matches. The
  same class in the adapters (a partial that never existed, created later:
  V9, B9) goes with them. Destination: MIG-B9-06 (decision 29 of 2026-11-13).
- **An error while a recreated watcher starts** (`refreshWatcher`, MIG-B9-22
  line 315): MIG-B9-06 (decision 29 of 2026-11-13).
- **The atomic-replace failure on PR #84** (§4.5): out of scope; the owner
  routes it (decision 33 of 2026-11-13).
- **`compile()` reporting the files Dart Sass loaded on its error:** the
  decision of 2026-11-08 chose an adapter-side record instead (MIG-B9-21
  line 212); C6 uses `err.file` alone.
- **`error.warnings`:** MIG-B9-21 (the decision on MIG-B9-14's flag 11).
- **A `UXD_*` code on the `CssSyntaxError` `compile()` throws** (§4.6:
  `code=undefined` for a UXDSL error): MIG-B9-39 §15, F3, the owner's choice.
- **Windows:** MIG-B9-28 runs the tests there.

## 7. Approach and traps

Non-normative. MIG-B9-39 §7's items for C6 to C9, verbatim; its items for
the adapters stay there. In "Tests that wait", the new webpack and Vite
watch tests are MIG-B9-39's; its last sentence applies to T11 to T13.

- **CLI, C6.** `watcher.follow([err.file])` in the `catch` of
  `runFullBuild`, `runSelectiveBuild` and the first build. The first build's
  error is printed in `loadAndBuildForWatch` (`bin/uxdsl.js:2714`) before
  `startWatch` exists, so it has to be handed over, as `report.results` is.
  `classify()` already turns a file outside the graph into a full rebuild.
- **CLI, C7.** Print the line on the watcher's `ready`, not after
  `createWatcher` returns. T12 delays chokidar's `ready` with a preload
  (`NODE_OPTIONS=--require <shim>` that wraps `require('chokidar').watch`);
  `bin/uxdsl.js` loads chokidar with `require('chokidar')` (line 7). The shim
  must not change what is watched.
- **Tests that wait.** MIG-B9-14's webpack T7 failed in 4 of 4 runs of the
  whole file until it dated its files ten seconds back before the watcher
  started (MIG-B9-14 line 443). Do the same in the new webpack and Vite
  watch tests. Wait for the build that carries the edit, and give each wait
  a name.
- **The captures.** If C9's output ever shows the two pipes' lines in
  another order, recording stdout and stderr per step in a fixed order is
  the fix. That changes `cli-captures.json`'s shape and the playground
  component that renders it, so it is a finding first (§15).
- **Stop rule.** Stop and record a finding in §15 if:
  - a contract item cannot be met without editing `compile.ts`, `src/sass/**`
    or `diagnostics.ts`;
  - a test can pass only with a timeout above 20 s;
  - a MIG-B9-20 theme-count test changes;
  - fixing C6 or C7 needs one of §6's four gaps (MIG-B9-06's).

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T11 | `packages/uxdsl/test/cli/watch-mode.test.js` | `MIG-B9-19: a file outside the watch patterns that a failing build loaded first is followed, and fixing it rebuilds, the first build included` | CLI (subprocess) | C6 | An edit to a file outside the patterns that no build loaded builds nothing; the base fails on both halves (§4: S10, F1) |
| T12 | same | `MIG-B9-19: the watching line is printed once the watcher is ready, so a write right after it rebuilds even when the watcher is slow to be ready` | CLI | C7 | Under the same `--require` shim (chokidar's `ready` delayed 1.5 s), a write made 200 ms after start, before `ready`, is not built. That proves the delay is in effect. The base prints the line before `ready`, and the write after it is lost |
| T13 | same | `MIG-B9-19: a wait that times out names its step and prints the CLI's output (negative control)`, and the two tests of lines 36 and 145 edited as C8 says | CLI | C8 | A deliberately unmet wait must reject with its step name and a line of the CLI's output; on the base the message is `waitFor timed out` alone |
| T14 | `packages/playground-nextjs/scripts/test-captures-check.cjs` (new), run by `test:captures` | `MIG-B9-19: --check on a captured file that differs in one line prints that line's number, the committed and the captured text` | unit (the script's comparison, exported) | C9 | Two identical texts report no line, and a difference only in the last line is found, so a check that compares lengths or the first line alone fails |
| T15 | the `MIG-B9-20`, `MIG-B9-14` and `MIG-B6-23` tests of `packages/uxdsl/test/cli/watch-mode.test.js` (unedited except C8's two tests) | as they are | CLI | the must-stay list | An invariant guard: they pass on the base (§3) and must pass unchanged. MIG-B9-39's T15 keeps the Vite and webpack files |

T11, T12 and T14 are the failing-first tests (README §2). Each fails on the
base for the reason its row gives and passes after the change.

## 9. Acceptance criteria

BASE below is `git merge-base HEAD origin/feat/beta9`. Each test command
runs with `TMPDIR` set to an empty scratch directory, which must be empty
again afterwards.

- **AC4** `node --test --test-name-pattern="MIG-B9-19" packages/uxdsl/test/cli/watch-mode.test.js`
  exits 0, with T11 to T13 run.
  - Test file: `packages/uxdsl/test/cli/watch-mode.test.js`.
  - Mutations: printing the line right after `createWatcher` fails T12; no
    follow of `err.file` fails T11; a plain `waitFor timed out` fails T13.
- **AC5** Twenty consecutive runs of
  `node --test --test-name-pattern="^watch (retargets the entry and source globs|mode reloads a theme value that comes from a nested require)" packages/uxdsl/test/cli/watch-mode.test.js`,
  and three of the whole `watch-mode.test.js`, all exit 0 while `npm test`
  runs in the background.
  - Test file: `watch-mode.test.js`.
  - Mutation: none; a stress guard. CI's runs of the PR are recorded in §14.
    A CI failure of these tests is recorded with its named step, not
    re-run silently.
- **AC6** `npm --prefix packages/playground-nextjs run test:captures` exits 0
  (T14, then `--check`), and twenty consecutive
  `node packages/playground-nextjs/scripts/capture-capabilities.js --check`
  exit 0.
  - Test file: `packages/playground-nextjs/scripts/test-captures-check.cjs`.
  - Mutation: a check that prints only the file name fails T14.
- **AC7** (this story's part) T15's commands, as §3 runs them (the
  `MIG-B9-20` line, and the `MIG-B9-14|MIG-B6-23` line, which also runs
  MIG-B9-39's adapter tests), exit 0 with the counts of §3 plus the new
  tests. `git diff --exit-code "$BASE" -- packages/uxdsl/src/compile.ts packages/uxdsl/src/sass packages/uxdsl/src/diagnostics.ts packages/playground-nextjs/src/generated`
  exits 0.
  - Test files: T15's.
  - Mutation: a change to any CLI text C7 keeps (the watching line, `built`,
    `unchanged`), with the captures regenerated, fails the `git diff` of
    `packages/playground-nextjs/src/generated`.
- **AC8** (this story's part) §4's reproduction for the CLI
  (`cli-single.js`, `cli-first-and-builds.js`), re-run on the head, exits 0
  and prints a rebuild at S10 and F1, with C6's outputs. It prints what
  §4.3 records at S13 (§6) and at every other step.
  - Test file: none (the reproduction of §4).
  - Mutation: the base prints §4.3.
- **AC9** `npm test` and `npm run verify:1.0 -- --skip-playground-walk` exit
  0.
  - Test files: every suite `npm test` runs, among them AC4's and AC6's,
    and `fixtures/release-1.0/run.js`.
  - Mutation: AC4's, which `npm test` runs; `verify:1.0` is an invariant
    guard.

Owner checks, separate from the above: none open. MIG-B9-39's Q1 to Q6 were
answered on 2026-11-13 (decisions 28 to 33, §15).

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes: one subsection under `## 0.5.0-beta.9 — unreleased`; `### Visual changes`: none |
| package README | yes: the docs guard demands it for a change under `packages/uxdsl`; one sentence (§11) |
| `verify-docs-update.js` classification | no (no file added or deleted under `packages/uxdsl/src`) |
| `npm run generate:language` | no |
| `AGENTS.md` + agent guide | no: it says nothing about watch recovery |
| `DIAGNOSTIC_CATALOG` | no (no new code) |
| `npm run generate:capabilities` | no |
| playground `uxdsl:build` + captures | no regeneration: C7 keeps the CLI's text, and `--check` must pass unchanged (AC6, AC7) |
| `migration.md` | no: nothing a user has to change |

## 11. Documentation

- `packages/uxdsl/docs/integrations/cli.md`, Watch mode (lines 484–514 on
  `5a041fc` and `d1e07a3`): one sentence for C6, which says that a failed
  build follows the file its error names; and one for C7, which says that
  the watching line is printed once the watcher is ready. Lines 544–549
  stay. (MIG-B9-39 §11's item for this file, which is this story's now.)
- `packages/uxdsl/README.md`, lines 63–68 on `d1e07a3` ("The CLI prints a
  compile error …"): one sentence after "…leaves the last good CSS on
  disk." It says that a failed build of `--watch` also follows the file its
  error names, outside the `watch` patterns, so fixing it rebuilds.
- `packages/uxdsl/CHANGELOG.md`: one subsection at the top of
  `## 0.5.0-beta.9 — unreleased`, ending `(MIG-B9-19)`. It covers C6 and C7,
  as the user sees them; C8 and C9 as one sentence on the tests and the
  check; and `### Visual changes`: none.
- The source comments of `startWatch` (`bin/uxdsl.js` lines 1617–1646 on
  `5a041fc` and `d1e07a3`) are rewritten to state the failure path
  (README §2).

## 12. Verification

```bash
TMPDIR=<empty dir> node --test --test-name-pattern="MIG-B9-19" packages/uxdsl/test/cli/watch-mode.test.js                          # exit 0
npm --prefix packages/playground-nextjs run test:captures                                                                          # exit 0
for i in $(seq 1 20); do node packages/playground-nextjs/scripts/capture-capabilities.js --check || break; done                    # 20 × exit 0
for i in $(seq 1 20); do TMPDIR=<empty dir> node --test --test-name-pattern="^watch (retargets the entry and source globs|mode reloads a theme value that comes from a nested require)" packages/uxdsl/test/cli/watch-mode.test.js || break; done   # 20 × exit 0, with npm test in the background
<T15's commands from §3>                                                                                                          # exit 0
git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- packages/uxdsl/src/compile.ts packages/uxdsl/src/sass packages/uxdsl/src/diagnostics.ts packages/playground-nextjs/src/generated   # exit 0
TMPDIR=<empty dir> bash <§4.1's reproduction, its CLI lines>     # exit 0; AC8's steps
npm test                                                        # background, with a log; exit 0
npm run verify:1.0 -- --skip-playground-walk                    # background, with a log; exit 0
```

Stop every watcher a step started (`pgrep -fl "uxdsl.*--watch"` shows none
of this worktree's).

## 13. Delivery

Delivered by the light flow for an S story (decision D1 of 2026-11-04): a
scout, one implementer, one review that covers the timing-sensitive tests,
and the deliverer.

Branch `feat/b9-19-cli-watch-recovers`. Commit:
`fix(FEAT-010): MIG-B9-19 - the CLI's watch recovers after a failed compile; its flaky watch test and captures check name what failed`.

PR title: `FEAT-010: MIG-B9-19 - the CLI's watch recovers after a failed compile`.
The body:

- **Goal:** §1, in two sentences.
- **Owner answers:** decisions 28 to 33 of 2026-11-13 as they apply here.
- **The CLI:** §4.4's CLI rows, base against head (AC8).
- **The flake and the captures:** AC5's and AC6's runs, CI's runs of the
  PR, and any named step that failed.
- **Gates:** `npm test`, `verify:1.0 -- --skip-playground-walk`, with exit
  codes.
- **Not run, or not a pass:** anything §14 lists so (a Linux reproduction
  of the flake).
- The last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Made from MIG-B9-39 (decision 28 of 2026-11-13)

This file was written on 2026-11-13, on `d1e07a3` (PR #89's merge into
`feat/beta9`), from MIG-B9-39's file as PR #89 merged it. What moved, and
under which numbers:

- **Kept numbers.** MIG-B9-39's Q1, option (b), which decision 28 chose,
  reads "Each keeps its C-n, T-n and AC-n as numbered here, and the
  must-stay list applies to both". So the map is the identity:
  - C6 → C6, C7 → C7, C8 → C8, C9 → C9; the "must stay byte-identical"
    list is in both files, as written;
  - T11 → T11, T12 → T12, T13 → T13, T14 → T14, retitled `MIG-B9-19: …`
    (README §3: a test's title starts with its story id); T15 is divided:
    its `watch-mode.test.js` tests are this story's, its Vite and webpack
    files MIG-B9-39's;
  - AC4 → AC4 (its name pattern now `MIG-B9-19`), AC5 → AC5, AC6 → AC6;
    AC7, AC8 and AC9 are in both, each for its part: here, T15's CLI tests
    and the `git diff`, the CLI steps of §4 (S10, F1, S13), and AC4's and
    AC6's suites;
  - §2's items on the registration, the CLI, the flake and the captures;
    §3's lines for the CLI and the captures; §4's setup, its three CLI
    scripts, the CLI's output, §4.4's CLI rows, §4.5 and §4.6; §6's items
    on the four gaps, `refreshWatcher` and the atomic-replace failure;
    §7's CLI, wait and captures traps; §11's `cli.md` item and the
    `startWatch` comments;
  - MIG-B9-39's F1, F2, F5, F6 and F7, and its Q1, Q2, Q3, Q5 and Q6, below
    as written there. Q4 (webpack's error path) stays with MIG-B9-39.
- **Reworded only where this file needs it:** the header, §1, the opening
  lines of §2 to §9, §6's destinations (decisions 28, 29 and 33), the stop
  rule (its adapter items dropped), T15's row, AC7 to AC9 and the owner
  checks, §10 to §13 (this story's own CHANGELOG subsection, README
  sentence, branch, commit and PR title), and the test titles.
- **§3's "Before starting" block** names MIG-B9-38, 25, 17 and 28, as
  MIG-B9-39's did, and not MIG-B9-37, which this story also waits for on
  `bin/uxdsl.js`: MIG-B9-38 waits for MIG-B9-37 (README §7), so a base with
  MIG-B9-38 merged has MIG-B9-37 too.
- **Not re-run.** §3 and §4 are MIG-B9-39's, recorded on `5a041fc`. On
  `d1e07a3` the package, fixtures and scripts equal `cc10de6`'s, as on
  `5a041fc`. Both are re-run on the base the story starts from.
- **MIG-B9-39's F8** (the index's bookkeeping) was applied by the index in
  PR #89; the index's §7 moves MIG-B9-39's places on the `bin/uxdsl.js`,
  `test/cli/**`, `cli.md` and `packages/playground-nextjs/**` rows to this
  story.

### MIG-B9-39's findings that concern this story

Verbatim, as MIG-B9-39 §15 recorded them on `5a041fc`.

- **F1 — The flake, four times, in two tests.** §4.5 lists every CI
  occurrence: the test at line 36 three times (PR #72, PR #80 and Dependabot's
  PR #66 against `main`), and the one at line 145 once (PR #71). It never
  failed in 20 local runs. Its log cannot say which wait timed out (C8).
- **F2 — Another watch-mode test failed on CI once.**
  `MIG-B6-23: an output file is never observed empty or truncated while a
  rebuild is writing it (atomic replace)`, on Dependabot's PR #84 against
  `main` (§4.5). It is not in the registration. Q6.
- **F5 — The watching line comes before `ready`** (`bin/uxdsl.js:1694–1696`).
  It cost no event on macOS (§4.5) and was not measured on Linux. C7 removes
  the question. If AC5 or CI still fails after C7, the step C8 names is the
  next lead.
- **F6 — The captures' likely mechanisms.** `captureWatch()` merges two
  pipes by arrival order and takes 400 ms of output after the awaited line
  (§4.5). Neither was observed in 20 runs. C9 makes the next false report
  show which. A fix that records the streams separately changes
  `cli-captures.json`'s shape and its playground component, and is a
  follow-up for the owner.
- **F7 — Flag 15 and the fourth gap.** The same decision of 2026-11-08
  accepted MIG-B9-14's flag 15 "as delivered, with its documented limits"
  and registered this story "as proposed", whose proposal lists that limit
  as a gap to fix ("a missing partial created where no pattern matches
  (owner flag 15)"). This file reads both: the limit stays documented until
  a story fixes it, and Q2 asks which.

### Open questions for the owner, as asked in MIG-B9-39 §15 (answered on 2026-11-13)

MIG-B9-39's Q1, Q2, Q3, Q5 and Q6, verbatim; Q4 concerns only webpack. They
were PR #89's questions 17, 18, 19, 21 and 22, and are decisions 28, 29, 30,
32 and 33 of 2026-11-13. "This file" and "this story" in them mean
MIG-B9-39 as it was written then.

1. **Q1 — One M story, or two S stories?** The registration says "S or
   split by its scout".
   - (a) One M story, as this file is written, delivered by two implementers
     (§13).
   - (b) Two S stories:
     - MIG-B9-39 keeps the adapters: C1 to C5, T1 to T10, AC1 to AC3, and
       AC7 to AC9 for its part. It shares only `vite.ts`, `webpack.ts`,
       `vite.md`, `webpack.md`, the two adapter fixtures and the append-only
       rows, so under README §7 it waits for MIG-B9-21 alone, not for 38,
       25, 17, 28 or the playground row.
     - A second story, under an id the owner assigns, takes the CLI and the
       tests: C6 to C9, T11 to T14, AC4 to AC6 and AC7 to AC9 for its part.
       It is on `bin/uxdsl.js`, `test/cli/**`, `cli.md` and
       `packages/playground-nextjs/**` as this file is.

     Each keeps its C-n, T-n and AC-n as numbered here, and the must-stay
     list applies to both.

   Under (a), §13's flow (the light flow with two implementers, for an M
   story that does not change the engine) is an assumption the owner
   confirms with this answer; D1 does not define it.

   **Recommendation: (b).** The adapters part carries most of the user-visible
   value and could start as soon as MIG-B9-21 merges. The CLI part waits
   anyway for the `test/cli/**` and playground rows. **Until answered:** (a),
   as written.
2. **Q2 — The CLI watch's four older gaps.** The registration lists them
   under this story. Writing them in would make it larger than M, which
   README §4 does not allow.
   - (a) A separate story, under an id the owner assigns: S, wave 3, after
     this one, on `bin/uxdsl.js`, `test/cli/**` and `cli.md`. It would cover
     the four gaps, the same class in the adapters (a partial that never
     existed, created later), and MIG-B9-22's uncaught error while a
     recreated watcher starts.
   - (b) In this story, which is then larger than M.
   - (c) Documented limits, not fixed. The fourth is already documented
     (cli.md 544–549) and was accepted by flag 15; the other three are not
     documented.

   **Recommendation: (a).** **Until answered:** (a); the contract does not
   cover them (§6).
3. **Q3 — Two extensions of "the last good dependencies and `err.file`".**
   (i) The CLI follows the file a failed build names (C6): the CLI's form of
   the same mechanism, and the registration's title says every host. (ii)
   The adapters also register the discovered theme file's tree on a failed
   compile, the first included (C1 (c), C2 (c), C3 (d)). A theme error has no
   `err.file` (§4.6), and without (ii) a first build that fails in the theme
   file recovers only when the module is saved (§4.3, T0–T2).
   - (a) Both.
   - (b) (i) only.
   - (c) Neither: both stay documented limits.

   **Recommendation: (a).** **Until answered:** (a).
5. **Q5 — When the flake and the captures count as done.** Neither was
   reproduced here (§4.5).
   - (a) C7 and C8 for the test and C9 for the captures, AC5's and AC6's
     stress runs, and the PR's CI runs. A later occurrence is recorded with
     its named step by the story whose run sees it, and routed by the owner.
   - (b) Block until reproduced on Linux (a container, or a scratch CI
     workflow that loops the two tests), then fix the observed cause.

   **Recommendation: (a)**, since (b) needs a Linux harness the repository
   does not have. **Until answered:** (a).
6. **Q6 — The atomic-replace failure (F2).**
   - (a) Out of scope here; the owner routes it, for instance to Q2's
     story.
   - (b) In this story, with a named step as C8 gives the other two.

   **Recommendation: (a).** It is a different failure (an output judged
   truncated, not a lost event), seen once. **Until answered:** (a).

### Owner decisions of 2026-11-13 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-13). PR #89 put MIG-B9-39's Q1 to Q6 to the owner as its questions 17 to 22. On 2026-11-10 the owner gave a standing instruction for FEAT-010, verbatim, "fusiona todo.. y preguntas como recomendadas, y sgeuimos" ("merge everything, and the questions as recommended, and let's keep going"). The questions were not put to the owner one by one: under that instruction each recommended option is the owner's decision of 2026-11-13, and the owner may still override any of them. This record is in English and lists those that concern this story. Where a decision differs from the contract as MIG-B9-39 wrote it, it rules.

- **Q1 (decision 28): (b), a split into two S stories.** It differs from MIG-B9-39's contract, which assumed (a), one M story. This story is the second part, the CLI and the tests: C6 to C9, T11 to T14, AC4 to AC6, and AC7 to AC9 for its part. MIG-B9-39 keeps the adapters. The items it changes: the size (S, not M), the header's Owns, Shares, Depends on and Blocks, and §13's flow, which is the light flow for an S story rather than MIG-B9-39's assumed two implementers. The id 19 was taken by the recorder, not assigned by the owner, who may renumber it; the title was adjusted to this story's content (FEAT-010 §2, decision 28).
- **Q2 (decision 29): (a)**, as the contract assumed. The four older gaps, the same class in the adapters and MIG-B9-22's uncaught error while a recreated watcher starts are MIG-B9-06, after this story (§6). The stop rule's last item names it.
- **Q3 (decision 30): (a), both extensions**, as the contract assumed. Extension (i), the CLI following the file a failed build names, is this story's C6. Extension (ii), the adapters' theme tree, is MIG-B9-39's. It widens the registration's words "the adapters re-register the last good dependencies and `err.file`"; C6 does not change.
- **Q5 (decision 32): (a)**, as the contract assumed. C7 and C8 for the test, C9 for the captures, AC5's and AC6's stress runs and the PR's CI runs are what "done" means; a later occurrence is recorded with its named step by the story whose run sees it, and routed by the owner.
- **Q6 (decision 33): (a)**, as the contract assumed. The atomic-replace failure on PR #84 is out of scope; the owner routes it, and no story is assigned it (§6).
