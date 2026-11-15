# MIG-B9-39 — Every host's watch recovers after a failed compile

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | None (registered by the decision of 2026-11-08 on MIG-B9-14's flag 16, as proposed in MIG-B9-14 §15's follow-ups; §15 asks the owner six questions, and the contract states the option it assumes for each (answered 2026-11-13, decisions 28 to 33; §15)) |
| Status | In review (PR #96) |
| Size | S, by decision 28 of 2026-11-13 (§15, Q1 (b)): this file was split into two S stories. This story keeps the adapters (C1 to C5, T1 to T10, AC1 to AC3, and AC7 to AC9 for its part); the CLI and the tests (C6 to C9, T11 to T14, AC4 to AC6, and AC7 to AC9 for their part) are [MIG-B9-19](MIG-B9-19-cli-watch-recovers.md). Registered as "S or split by its scout". The CLI watch's four older gaps that the registration also lists are MIG-B9-06 (decision 29 of 2026-11-13) |
| Depends on | MIG-B9-14 (merged, PR #71), MIG-B9-22 (merged, PR #76) and MIG-B9-21 (Ready; its status is README §5's; it follows MIG-B9-20, merged as PR #88), as README §5 says. Under README §7 it waits for MIG-B9-21 alone on its files (`vite.ts`, `webpack.ts`, `vite.md`, `webpack.md`), as Q1 (b) says (decision 28 of 2026-11-13); MIG-B9-20, on those rows, is merged. It does not depend on MIG-B9-19: the two share only the append-only CHANGELOG and package README |
| Blocks | MIG-B9-06 (decision 29 of 2026-11-13: after this story, for the adapters' class of the older gaps) and MIG-B9-91 (it depends on every story of waves 0 to 3). Under README §7: MIG-B9-64 (`vite.ts`, `webpack.ts`) |
| Base | `feat/beta9` after MIG-B9-21 (decision 28 of 2026-11-13). §3 and §4 were recorded on `5a041fc` (`docs/b9-wave3-story-files`: `origin/feat/beta9` at `cc10de6`, MIG-B9-20 merged, plus story files only; `git diff --stat cc10de6 5a041fc -- packages fixtures scripts .github` is empty). Both are re-run on the base the story starts from, which will include MIG-B9-21 (§3, "Before starting": its lines for MIG-B9-38, 25, 17 and 28 are MIG-B9-19's since the split, §15) |
| Owns | `packages/uxdsl/test/webpack/watch-recovery.test.js` (new), `packages/uxdsl/test/vite/watch-recovery.test.js` (new). `packages/playground-nextjs/scripts/test-captures-check.cjs` (T14) is MIG-B9-19's since decision 28 of 2026-11-13 |
| Shares | `packages/uxdsl/src/webpack.ts`, `packages/uxdsl/src/vite.ts`, `fixtures/vite-adapter/run.js`, `fixtures/webpack-adapter/run.js`, `packages/uxdsl/docs/integrations/vite.md` and `webpack.md`, `packages/uxdsl/CHANGELOG.md` (one subsection under `## 0.5.0-beta.9 — unreleased`), `packages/uxdsl/README.md` (one sentence, lines 89–95). Since decision 28 of 2026-11-13, `packages/uxdsl/bin/uxdsl.js`, `packages/uxdsl/test/cli/watch-mode.test.js`, `packages/playground-nextjs/scripts/capture-capabilities.js`, `packages/playground-nextjs/package.json` and `packages/uxdsl/docs/integrations/cli.md` are MIG-B9-19's |
| Output impact | API: `uxdsl/webpack` and `uxdsl/vite` rebuild after a failed compile when the file at fault is fixed; their errors carry the location and the frame (Vite's `loc` and `frame`; webpack's message). Compiled output: none. The `build --watch` items this field listed (it follows the file a failed build names, and prints `[uxdsl] watching for changes...` once its watcher is ready) are MIG-B9-19's since decision 28 of 2026-11-13 |

## 1. Goal

Under every host's watch, a compile that fails and is then fixed rebuilds
on the save that fixes it, with the last good output kept meanwhile:
`uxdsl/webpack` with mini-css-extract-plugin and with style-loader, the Vite
dev server, `vite build --watch`, and `uxdsl build --watch`, a first build
that failed included. The adapters' errors point at the file, line and
column, with the frame, as the CLI's do. The watch-mode test that fails on
CI's ubuntu runner (`waitFor timed out`), and the captures check that
sometimes reports a byte-identical file as stale, either stop failing for
the mechanism this story fixes or fail with output that names the step.

## 2. Sources

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
  - MIG-B9-21 line 212: "**The files Dart Sass loaded, for information (the decision on MIG-B9-14's flag 16).** Flag 16 offered this story as the alternative to a new one, if `compile()` should put the files Dart Sass loaded on its error. The decision registers MIG-B9-39 instead, in which the adapters re-register the last good dependencies and `err.file`; MIG-B9-39 depends on this story."
  - MIG-B9-22 line 315 (a follow-up of its delivery, not settled by a decision): "**MIG-B9-39** (every host's watch recovers after a failed compile) builds on E2's watcher: `refreshWatcher` now runs before selective builds too, and an error while a recreated watcher starts is not caught there, as it already was not on a full rebuild."
  - MIG-B9-26 line 636 (its split, decision 6 of 2026-11-10): "`test/cli/**`, so MIG-B9-39 would wait for it there."
  - MIG-B9-14 line 386: "Review PR #71. Answer the owner flags in §15, "Delivery of 2026-11-06", and decide the proposed stories MIG-B9-38 and MIG-B9-39."
- What the documentation says today:
  - `packages/uxdsl/docs/integrations/webpack.md`, lines 29–32: "And a compile that fails registers only the module's own file, so fixing a partial that broke it, or re-creating a partial it could not find, rebuilds once that `.uxdsl` file is saved."
  - `packages/uxdsl/docs/integrations/vite.md`, lines 220–223: "And a load that fails adds no file: a partial an earlier load added stays watched, but one the failing load was the first to load (a new `@use` whose file has an error) recompiles nothing when it is fixed, until the `.uxdsl` file Vite imports is saved."
  - `packages/uxdsl/docs/integrations/cli.md`, lines 544–549: "A partial a build could not find (`Can't find stylesheet to import.`) is noticed when it appears only where a `watch` pattern matches it, since Dart Sass does not report the paths it tried: […] Add its directory to `watch` (`'shared/**/*.scss'`) to have it noticed."
- The code:
  - `packages/uxdsl/src/webpack.ts` lines 216–228: `addDependency` runs only after `compile()` resolves; the `catch (err)` emits `err.warnings`, then calls `callback(err)`.
  - `packages/uxdsl/src/vite.ts` lines 174–191: `compile(...).catch()` emits `err.warnings` through `this.warn()` and rethrows; `addWatchFile` runs only after `compile()` resolves, and the plugin has no `hotUpdate` or `handleHotUpdate` hook.
  - `packages/uxdsl/bin/uxdsl.js` line 1696: `console.log('[uxdsl] watching for changes...');`, right after `createWatcher` (line 1685) and `followAll()` (line 1695), without waiting for the watcher's `ready`; lines 1780 and 1796: a failed build prints and follows nothing new; line 1852: the queued selective batch, `else runSelectiveBuild([...indices]).finally(…)`, runs after `building = false`.

## 3. Preconditions

Run from the worktree root on `5a041fc`, 2026-11-13, macOS 27.0, Node
v20.19.0, npm 11.21.1. Each exited 0.

```bash
git rev-parse --short HEAD                                  # cf98cb8 (feat/beta9 after MIG-B9-21, PR #92)
for c in db0e28d 08d00e0 cc10de6; do git merge-base --is-ancestor "$c" HEAD || exit 1; done   # PR #71 (14), PR #76 (22), PR #88 (20) merged
grep -n "addDependency\|addWatchFile\|catch (err)\|callback(err)" packages/uxdsl/src/webpack.ts packages/uxdsl/src/vite.ts   # webpack.ts:6 (comment), 58 (type), 216, 224, 227; vite.ts:20 (comment), 191
grep -n "console.log('\[uxdsl\] watching for changes...')" packages/uxdsl/bin/uxdsl.js           # 1696
grep -n "else runSelectiveBuild(\[...indices\])" packages/uxdsl/bin/uxdsl.js                     # 1852
node -e "for (const p of ['vite','webpack','mini-css-extract-plugin','style-loader','css-loader','chokidar','sass']) console.log(p, require('./packages/uxdsl/node_modules/'+p+'/package.json').version)"
# vite 7.3.7, webpack 5.111.1, mini-css-extract-plugin 2.10.2, style-loader 4.0.0, css-loader 7.1.5, chokidar 4.0.3, sass 1.107.0
TMPDIR=<scratch> node --test --test-name-pattern="MIG-B9-20" packages/uxdsl/test/cli/watch-mode.test.js        # 6 pass, 0 fail (31 filtered out)
TMPDIR=<scratch> node --test packages/uxdsl/test/vite/theme-emission.test.js packages/uxdsl/test/webpack/theme-emission.test.js   # 11 pass, 0 fail
TMPDIR=<scratch> node --test --test-name-pattern="MIG-B9-14|MIG-B6-23" packages/uxdsl/test/cli/watch-mode.test.js packages/uxdsl/test/vite/index.test.js packages/uxdsl/test/webpack/loader.test.js   # 21 pass, 0 fail
node packages/playground-nextjs/scripts/capture-capabilities.js --check   # "Captured CLI and compiler output is up to date." (run 5 times, §4.5)
```

The targeted test runs leave directories in `TMPDIR` (61 `uxdsl-cli-watch-*`,
4 `uxdsl-webpack-loader-test-*`, 2 `vite-plugin-uxdsl-test-*` after this
step's runs): MIG-B9-25's subject. They were removed.

**Before starting**, on the base the story starts from, these must also exit
0. On `5a041fc` each exited 1, as expected, since the stories are not merged:

```bash
git log --oneline --grep='MIG-B9-21 -' HEAD | grep -q .    # MIG-B9-21 merged (exit 0 on cf98cb8)
git log --oneline --grep='MIG-B9-38 -' HEAD | grep -q .    # MIG-B9-38 merged (README §7, bin/uxdsl.js)
for s in 25 17 28; do git log --oneline --grep="MIG-B9-$s -" HEAD | grep -q . || exit 1; done   # README §7, test/cli/**
```

Then re-run the block above and §4, and record any difference in §15. The
line numbers above will have moved: MIG-B9-21's K7 rewrites the comments of
`vite.ts`, `webpack.ts` and `bin/uxdsl.js`, and MIG-B9-38 edits
`bin/uxdsl.js`. On that base also check:

- whether MIG-B9-21's `error.warnings` made the adapters emit the warnings of
  a failed compile. If it did, the tests of §8 assert them unchanged; if it
  did not, that is MIG-B9-21's finding, not this story's;
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
# uxdsl-0.5.0-beta.9.tgz, 282,518 bytes, 90 files (cf98cb8); its dist equals the worktree's (diff -rq exit 0)
cd "$S/consumer" && printf '{"name":"mig-b9-39-consumer","version":"1.0.0","private":true}\n' > package.json
npm install --save-dev --ignore-scripts --no-audit --no-fund "$S/pack/uxdsl-0.5.0-beta.9.tgz" \
  vite@7.3.7 webpack@5.111.1 css-loader@7.1.5 mini-css-extract-plugin@2.10.2 style-loader@4.0.0
# installed: uxdsl 0.5.0-beta.9, vite 7.3.7, webpack 5.111.1, css-loader 7.1.5, mini-css-extract-plugin 2.10.2,
# style-loader 4.0.0, sass 1.108.2, chokidar 4.0.3, postcss 8.5.33
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

`vite-dev.mjs`:

```js
// The Vite dev server with uxdsl/vite, from the installed tarball: what a
// browser would fetch, and what the server sends to its clients over HMR.
// Run from inside the project (node <this file> <project dir>), as
// fixtures/vite-adapter does.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = process.argv[2];
const require = createRequire(path.join(root, 'package.json'));
const { createServer } = await import(require.resolve('vite'));
const uxdsl = require('uxdsl/vite');
const put = (f, t) => { const a = path.join(root, f); fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a, t); };
const rel = (f) => (f ? String(f).replace(root, '<root>') : f);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let events = [];
const probe = {
  name: 'mig-b9-39-probe',
  hotUpdate(ctx) { if (this.environment.name === 'client') events.push(`hotUpdate ${ctx.type} ${rel(ctx.file)} -> modules [${ctx.modules.map((m) => rel(m.file)).join(', ')}]`); },
};
const MAIN = "@use './parts/card';\n@use '../shared/tokens.scss' as t;\n.main { color: t.$brand; }\n";
for (const d of ['styles', 'shared']) fs.rmSync(path.join(root, d), { recursive: true, force: true });
put('index.html', '<!doctype html><script type="module" src="/main.js"></script>\n');
put('main.js', "import './styles/main.uxdsl';\n");
put('styles/main.uxdsl', MAIN);
put('styles/parts/_card.uxdsl', process.argv[3] === 'first-fails' ? '.card { color: ; }\n' : '.card { color: red; }\n');
put('shared/tokens.scss', '$brand: blue;\n');
const server = await createServer({ root, configFile: false, plugins: [uxdsl({ discoverTheme: false }), probe], logLevel: 'silent', server: { port: 45391, strictPort: false }, appType: 'spa' });
const send = server.ws.send.bind(server.ws);
server.ws.send = (payload, ...rest) => {
  const p = typeof payload === 'string' ? { type: 'custom', event: payload } : payload;
  if (p.type === 'update') events.push(`ws update [${p.updates.map((u) => `${u.type} ${u.path}`).join(', ')}]`);
  else if (p.type === 'error') events.push(`ws error: ${String(p.err.message).split('\n')[0].slice(0, 160)}`);
  else events.push(`ws ${p.type}${p.event ? ' ' + p.event : ''}`);
  return send(payload, ...rest);
};
const chot = server.environments.client.hot;
const csend = chot.send.bind(chot);
chot.send = (payload, ...rest) => {
  if (payload && payload.type === 'error') {
    const e = payload.err;
    events.push(`client error payload: plugin=${e.plugin} id=${rel(e.id)} loc=${JSON.stringify(e.loc)} frame=${e.frame ? 'yes' : 'none'} message=${String(e.message).split('\n')[0].replace(root, '<root>').slice(0, 150)}`);
  }
  return csend(payload, ...rest);
};
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const js = await (await fetch(`${base}/main.js`)).text();
const cssUrl = js.match(/import\s+["']([^"']+)["']/)[1];
async function fetchCss(t) {
  const res = await fetch(`${base}${cssUrl}${t ? `${cssUrl.includes('?') ? '&' : '?'}t=${t}` : ''}`);
  const body = await res.text();
  const rule = (body.match(/\.(main|card|newpart|missing)\s*\{[^}]*\}/g) || []).join(' ');
  return `HTTP ${res.status}${res.status === 200 ? `, rules: ${rule.replace(/\\n/g, ' ')}` : `, ${body.split('\n')[0].slice(0, 140)}`}`;
}
async function stepV(label, action, { fetchAfter = true } = {}) {
  events = [];
  await action();
  await delay(2500);
  const before = events.length;
  const fetched = fetchAfter ? await fetchCss(Date.now()) : null;
  await delay(200);
  console.log(`\n### ${label}`);
  events.slice(0, before).forEach((e) => console.log(`  | ${e}`));
  if (!before) console.log('  | (nothing: no hotUpdate, no message to clients)');
  if (fetchAfter) console.log(`  = the browser re-fetches the module: ${fetched}`);
  events.slice(before).forEach((e) => console.log(`    | ${e}`));
}
console.log(`Vite ${server.config.logger ? '' : ''}${require('vite/package.json').version}, module ${cssUrl}`);
console.log(`V0 first fetch: ${await fetchCss()}`);
await delay(200); events.forEach((e) => console.log(`    | ${e}`)); events = [];
if (process.argv[3] === 'first-fails') {
  await stepV('W1 fix styles/parts/_card.uxdsl (the first load failed in it)', () => put('styles/parts/_card.uxdsl', '.card { color: red; }\n'));
} else {
  await stepV('V1 Sass error in styles/parts/_card.uxdsl (loaded by the last good load)', () => put('styles/parts/_card.uxdsl', '.card { color: ; }\n'));
  await stepV('V2 fix it', () => put('styles/parts/_card.uxdsl', '.card { color: red; }\n'));
  await stepV('V3 UXDSL error (unknown token) in the partial', () => put('styles/parts/_card.uxdsl', '.card { padding: space(99); }\n'));
  await stepV('V4 fix it', () => put('styles/parts/_card.uxdsl', '.card { color: red; }\n'));
  put('styles/parts/_newpart.uxdsl', '.newpart { color: ; }\n');
  await delay(1000);
  await stepV('V5 the module starts @using styles/parts/_newpart.uxdsl, which has a Sass error', () => put('styles/main.uxdsl', "@use './parts/newpart';\n" + MAIN));
  await stepV('V6 fix styles/parts/_newpart.uxdsl', () => put('styles/parts/_newpart.uxdsl', '.newpart { color: green; }\n'), { fetchAfter: false });
  await stepV('V7 save the module unchanged (touch)', () => { const f = path.join(root, 'styles/main.uxdsl'); fs.writeFileSync(f, fs.readFileSync(f)); });
  await stepV('V8 the module @uses a missing partial', () => put('styles/main.uxdsl', "@use './parts/missing';\n@use './parts/newpart';\n" + MAIN));
  await stepV('V9 create styles/parts/_missing.uxdsl', () => put('styles/parts/_missing.uxdsl', '.missing { color: teal; }\n'), { fetchAfter: false });
  await stepV('V10 save the module unchanged (touch)', () => { const f = path.join(root, 'styles/main.uxdsl'); fs.writeFileSync(f, fs.readFileSync(f)); });
}
await server.close();
console.log('\nexit: server closed');
```

`vite-build-watch.mjs`:

```js
// `vite build --watch` (Vite's build() with build.watch) with uxdsl/vite,
// from the installed tarball. Run from inside the project.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const root = process.argv[2];
const require = createRequire(path.join(root, 'package.json'));
const { build } = await import(require.resolve('vite'));
const uxdsl = require('uxdsl/vite');
const put = (f, t) => { const a = path.join(root, f); fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a, t); };
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = path.join(root, 'dist/assets/index.css');
const out = () => { try { const b = fs.readFileSync(OUT, 'utf8'); return `${crypto.createHash('sha1').update(b).digest('hex').slice(0, 10)} (${b.length} B) rules: ${(b.match(/\.(main|card|newpart|missing)\s*\{[^}]*\}/g) || []).join(' ').replace(/\s+/g, ' ')}`; } catch { return 'absent'; } };
const MAIN = "@use './parts/card';\n@use '../shared/tokens.scss' as t;\n.main { color: t.$brand; }\n";
for (const d of ['styles', 'shared', 'dist']) fs.rmSync(path.join(root, d), { recursive: true, force: true });
put('index.html', '<!doctype html><script type="module" src="/main.js"></script>\n');
put('main.js', "import './styles/main.uxdsl';\n");
put('styles/main.uxdsl', MAIN);
put('styles/parts/_card.uxdsl', process.argv[3] === 'first-fails' ? '.card { color: ; }\n' : '.card { color: red; }\n');
put('shared/tokens.scss', '$brand: blue;\n');
let events = [];
const watcher = await build({
  root, configFile: false, logLevel: 'silent', plugins: [uxdsl({ discoverTheme: false })],
  build: { watch: {}, outDir: 'dist', emptyOutDir: true, minify: false, rollupOptions: { output: { assetFileNames: 'assets/[name].[ext]', entryFileNames: 'assets/[name].js' } } },
});
watcher.on('event', (e) => {
  if (e.code === 'ERROR') events.push(`ERROR ${String(e.error.message).split('\n')[0].replace(root, '<root>').slice(0, 160)} (loc=${JSON.stringify(e.error.loc ? { ...e.error.loc, file: e.error.loc.file && e.error.loc.file.replace(root, '<root>') } : undefined)}, frame=${e.error.frame ? 'yes' : 'none'})`);
  else if (e.code === 'BUNDLE_END') events.push(`BUNDLE_END in ${e.duration} ms`);
  if (e.result && e.result.close) e.result.close();
});
watcher.on('change', (id, { event }) => events.push(`change ${event} ${id.replace(root, '<root>')}`));
async function stepB(label, action) {
  events = [];
  await action();
  await delay(3000);
  console.log(`\n### ${label}`);
  events.forEach((e) => console.log(`  | ${e}`));
  if (!events.length) console.log('  | (nothing: no change seen, no rebuild)');
  console.log(`  = dist/assets/index.css: ${out()}`);
}
await stepB('B0 start', async () => {});
if (process.argv[3] === 'first-fails') {
  await stepB('C1 fix styles/parts/_card.uxdsl (the first build failed in it)', () => put('styles/parts/_card.uxdsl', '.card { color: red; }\n'));
  await stepB('C2 save the module unchanged (touch)', () => { const f = path.join(root, 'styles/main.uxdsl'); fs.writeFileSync(f, fs.readFileSync(f)); });
  await stepB('C3 save main.js, the JavaScript module that imports it, unchanged (touch)', () => { const f = path.join(root, 'main.js'); fs.writeFileSync(f, fs.readFileSync(f)); });
} else {
  await stepB('B1 Sass error in styles/parts/_card.uxdsl (loaded by the last good build)', () => put('styles/parts/_card.uxdsl', '.card { color: ; }\n'));
  await stepB('B2 fix it', () => put('styles/parts/_card.uxdsl', '.card { color: red; }\n'));
  await stepB('B3 UXDSL error (unknown token) in the partial', () => put('styles/parts/_card.uxdsl', '.card { padding: space(99); }\n'));
  await stepB('B4 fix it', () => put('styles/parts/_card.uxdsl', '.card { color: red; }\n'));
  put('styles/parts/_newpart.uxdsl', '.newpart { color: ; }\n');
  await delay(1000);
  await stepB('B5 the module starts @using styles/parts/_newpart.uxdsl, which has a Sass error', () => put('styles/main.uxdsl', "@use './parts/newpart';\n" + MAIN));
  await stepB('B6 fix styles/parts/_newpart.uxdsl', () => put('styles/parts/_newpart.uxdsl', '.newpart { color: green; }\n'));
  await stepB('B7 save the module unchanged (touch)', () => { const f = path.join(root, 'styles/main.uxdsl'); fs.writeFileSync(f, fs.readFileSync(f)); });
  await stepB('B8 the module @uses a missing partial', () => put('styles/main.uxdsl', "@use './parts/missing';\n@use './parts/newpart';\n" + MAIN));
  await stepB('B9 create styles/parts/_missing.uxdsl', () => put('styles/parts/_missing.uxdsl', '.missing { color: teal; }\n'));
  await stepB('B10 save the module unchanged (touch)', () => { const f = path.join(root, 'styles/main.uxdsl'); fs.writeFileSync(f, fs.readFileSync(f)); });
}
await watcher.close();
console.log('\nexit: watcher closed');
```

`webpack-watch.js`:

```js
'use strict';
// webpack's watch mode with uxdsl/webpack, from the installed tarball, with
// MiniCssExtractPlugin or style-loader. Usage: node webpack-watch.js <project> <extract|style> [first-fails]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const [root, kind, first] = process.argv.slice(2);
const req = require('node:module').createRequire(path.join(root, 'package.json'));
const webpack = req('webpack');
const MiniCssExtractPlugin = req('mini-css-extract-plugin');
const put = (f, t) => { const a = path.join(root, f); fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a, t); };
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = path.join(root, 'dist', kind === 'extract' ? 'main.css' : 'main.js');
const out = () => {
  try {
    const b = fs.readFileSync(OUT, 'utf8');
    const rules = (b.match(/\.(main|card|newpart|missing)\s*\{[^}]*\}/g) || []).join(' ').replace(/\\n|\s+/g, ' ');
    const failed = /Module build failed/.test(b) ? ' + a module that throws "Module build failed"' : '';
    return `${crypto.createHash('sha1').update(b).digest('hex').slice(0, 10)} (${b.length} B) rules: ${rules || '(none)'}${failed}`;
  } catch { return 'absent'; }
};
const MAIN = "@use './parts/card';\n@use '../shared/tokens.scss' as t;\n.main { color: t.$brand; }\n";
for (const d of ['src', 'styles', 'shared', 'dist']) fs.rmSync(path.join(root, d), { recursive: true, force: true });
put('src/index.js', "import '../styles/main.uxdsl';\n");
put('styles/main.uxdsl', MAIN);
put('styles/parts/_card.uxdsl', first ? '.card { color: ; }\n' : '.card { color: red; }\n');
put('shared/tokens.scss', '$brand: blue;\n');
const loaders = [kind === 'extract' ? MiniCssExtractPlugin.loader : req.resolve('style-loader'), req.resolve('css-loader'), { loader: req.resolve('uxdsl/webpack'), options: { discoverTheme: false } }];
const compiler = webpack({
  mode: 'development', devtool: false, context: root, entry: './src/index.js',
  output: { path: path.join(root, 'dist'), filename: 'main.js' },
  module: { rules: [{ test: /\.uxdsl$/, use: loaders }] },
  plugins: kind === 'extract' ? [new MiniCssExtractPlugin({ filename: 'main.css' })] : [],
  infrastructureLogging: { level: 'none' },
});
let events = [];
const watching = compiler.watch({ aggregateTimeout: 100 }, (err, stats) => {
  if (err) { events.push(`fatal ${err.message}`); return; }
  const j = stats.toJson({ all: false, errors: true, warnings: true });
  const deps = [...stats.compilation.fileDependencies].filter((f) => f.startsWith(root) && !f.includes('node_modules')).map((f) => path.relative(root, f)).sort();
  events.push(`compiled: ${j.errors.length} error(s)${j.errors.length ? ': ' + j.errors.map((e) => String(e.message).split('\n').slice(0, 2).join(' / ').replace(new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '<root>').slice(0, 200)).join(' | ') : ''}`);
  events.push(`watched files of the project: ${deps.join(', ')}`);
});
compiler.hooks.invalid.tap('probe', (file) => events.push(`invalid ${file ? path.relative(root, file) : ''}`));
async function stepW(label, action) {
  events = [];
  await action();
  await delay(3000);
  console.log(`\n### ${label}`);
  events.forEach((e) => console.log(`  | ${e}`));
  if (!events.length) console.log('  | (nothing: no rebuild)');
  console.log(`  = dist/${path.basename(OUT)}: ${out()}`);
}
(async () => {
  console.log(`webpack ${req('webpack/package.json').version}, ${kind === 'extract' ? `mini-css-extract-plugin ${req('mini-css-extract-plugin/package.json').version}` : `style-loader ${req('style-loader/package.json').version}`}, css-loader ${req('css-loader/package.json').version}, mode development`);
  await stepW('K0 start', async () => {});
  const touch = (f) => () => { const a = path.join(root, f); fs.writeFileSync(a, fs.readFileSync(a)); };
  if (first) {
    await stepW('L1 fix styles/parts/_card.uxdsl (the first build failed in it)', () => put('styles/parts/_card.uxdsl', '.card { color: red; }\n'));
    await stepW('L2 save the module unchanged (touch)', touch('styles/main.uxdsl'));
  } else {
    await stepW('K1 Sass error in styles/parts/_card.uxdsl (loaded by the last good build)', () => put('styles/parts/_card.uxdsl', '.card { color: ; }\n'));
    await stepW('K2 fix it', () => put('styles/parts/_card.uxdsl', '.card { color: red; }\n'));
    await stepW('K3 save the module unchanged (touch)', touch('styles/main.uxdsl'));
    await stepW('K4 UXDSL error (unknown token) in the partial', () => put('styles/parts/_card.uxdsl', '.card { padding: space(99); }\n'));
    await stepW('K5 fix it', () => put('styles/parts/_card.uxdsl', '.card { color: red; }\n'));
    await stepW('K6 save the module unchanged (touch)', touch('styles/main.uxdsl'));
    await stepW('K7 delete styles/parts/_card.uxdsl', async () => fs.rmSync(path.join(root, 'styles/parts/_card.uxdsl')));
    await stepW('K8 create it again', () => put('styles/parts/_card.uxdsl', '.card { color: red; }\n'));
    await stepW('K9 save the module unchanged (touch)', touch('styles/main.uxdsl'));
  }
  await new Promise((r) => watching.close(r));
  console.log('\nexit: watching closed');
})();
```

`webpack-theme-first.js`:

```js
'use strict';
// webpack watch (style-loader) whose first build fails in the discovered theme file; then the theme is fixed.
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const req = require('node:module').createRequire(path.join(root, 'package.json'));
const webpack = req('webpack');
const put = (f, t) => { const a = path.join(root, f); fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a, t); };
for (const d of ['src', 'styles', 'shared', 'dist']) fs.rmSync(path.join(root, d), { recursive: true, force: true });
put('src/index.js', "import '../styles/main.uxdsl';\n");
put('styles/main.uxdsl', '.main { padding: space(2); }\n');
put('uxdsl.theme.json', '{ "spacing": { "2": 5 } }\n');
let events = [];
const compiler = webpack({ mode: 'development', devtool: false, context: root, entry: './src/index.js', output: { path: path.join(root, 'dist') }, infrastructureLogging: { level: 'none' },
  module: { rules: [{ test: /\.uxdsl$/, use: [req.resolve('style-loader'), req.resolve('css-loader'), req.resolve('uxdsl/webpack')] }] } });
const watching = compiler.watch({ aggregateTimeout: 100 }, (err, stats) => {
  const j = stats.toJson({ all: false, errors: true });
  events.push(`compiled: ${j.errors.length} error(s)${j.errors.length ? ': ' + String(j.errors[0].message).split('\n').slice(1, 2).join(' ').split(root).join('<root>').slice(0, 160) : ''}`);
  events.push(`watched files of the project: ${[...stats.compilation.fileDependencies].filter((f) => f.startsWith(root) && !f.includes('node_modules')).map((f) => path.relative(root, f)).sort().join(', ')}`);
});
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await delay(3000); console.log('### T0 start (the discovered uxdsl.theme.json holds a number leaf)'); events.forEach((e) => console.log(`  | ${e}`)); events = [];
  put('uxdsl.theme.json', '{ "spacing": { "2": "5px" } }\n');
  await delay(3000); console.log('### T1 fix uxdsl.theme.json'); events.forEach((e) => console.log(`  | ${e}`)); if (!events.length) console.log('  | (nothing: no rebuild)'); events = [];
  const f = path.join(root, 'styles/main.uxdsl'); fs.writeFileSync(f, fs.readFileSync(f));
  await delay(3000); console.log('### T2 save the module unchanged (touch)'); events.forEach((e) => console.log(`  | ${e}`)); events = [];
  watching.close(() => console.log('exit: watching closed'));
})();
```

`webpack-error-text.js`:

```js
'use strict';
// The text webpack prints for a failed uxdsl/webpack module (style-loader, one run).
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const req = require('node:module').createRequire(path.join(root, 'package.json'));
const webpack = req('webpack');
fs.writeFileSync(path.join(root, 'styles/parts/_card.uxdsl'), '.card { color: ; }\n');
webpack({ mode: 'development', devtool: false, context: root, entry: './src/index.js', output: { path: path.join(root, 'dist-error') },
  module: { rules: [{ test: /\.uxdsl$/, use: [req.resolve('style-loader'), req.resolve('css-loader'), { loader: req.resolve('uxdsl/webpack'), options: { discoverTheme: false } }] }] } }).run((err, stats) => {
  const text = stats.toString({ all: false, errors: true, colors: false, errorDetails: true });
  console.log(text.split('\n').slice(0, 16).map((l) => l.split(root).join('<root>').split(path.dirname(path.dirname(root))).join('<scratch>')).join('\n'));
  fs.writeFileSync(path.join(root, 'styles/parts/_card.uxdsl'), '.card { color: red; }\n');
});
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

The Vite dev server (`vite-dev.mjs`, then `vite-dev.mjs … first-fails`):

```text
Vite 7.3.7, module /styles/main.uxdsl?uxdsl&lang.css
V0 first fetch: HTTP 200, rules: .card {   color: red; } .main {   color: blue; }

### V1 Sass error in styles/parts/_card.uxdsl (loaded by the last good load)
  | hotUpdate update <root>/styles/parts/_card.uxdsl -> modules [<root>/styles/parts/_card.uxdsl]
  | ws update [js-update /styles/main.uxdsl?uxdsl&lang.css]
  = the browser re-fetches the module: HTTP 500, 
    | client error payload: plugin=undefined id=undefined loc=undefined frame=none message=<root>/styles/parts/_card.uxdsl:1:16: UXD_SASS: Expected expression.
    | ws error: <S>/projects/vite-dev

### V2 fix it
  | hotUpdate update <root>/styles/parts/_card.uxdsl -> modules [<root>/styles/parts/_card.uxdsl]
  | ws update [js-update /styles/main.uxdsl?uxdsl&lang.css]
  = the browser re-fetches the module: HTTP 200, rules: .card {   color: red; } .main {   color: blue; }

### V3 UXDSL error (unknown token) in the partial
  | hotUpdate update <root>/styles/parts/_card.uxdsl -> modules [<root>/styles/parts/_card.uxdsl]
  | ws update [js-update /styles/main.uxdsl?uxdsl&lang.css]
  = the browser re-fetches the module: HTTP 500, 
    | client error payload: plugin=uxdsl id=undefined loc=undefined frame=none message=uxdsl: <root>/styles/parts/_card.uxdsl:1:9: UXD_SPACE_REFERENCE: space(99) does not exist; available keys: 0–16. Did you mean "16"?
    | ws error: uxdsl: <S>/projects/v

### V4 fix it
  | hotUpdate update <root>/styles/parts/_card.uxdsl -> modules [<root>/styles/parts/_card.uxdsl]
  | ws update [js-update /styles/main.uxdsl?uxdsl&lang.css]
  = the browser re-fetches the module: HTTP 200, rules: .card {   color: red; } .main {   color: blue; }

### V5 the module starts @using styles/parts/_newpart.uxdsl, which has a Sass error
  | hotUpdate update <root>/styles/main.uxdsl -> modules [<root>/styles/main.uxdsl, <root>/styles/main.uxdsl]
  | ws update [js-update /styles/main.uxdsl?uxdsl&lang.css]
  = the browser re-fetches the module: HTTP 500, 
    | client error payload: plugin=undefined id=undefined loc=undefined frame=none message=<root>/styles/parts/_newpart.uxdsl:1:19: UXD_SASS: Expected expression.
    | ws error: <S>/projects/vite-dev

### V6 fix styles/parts/_newpart.uxdsl
  | hotUpdate update <root>/styles/parts/_newpart.uxdsl -> modules []

### V7 save the module unchanged (touch)
  | hotUpdate update <root>/styles/main.uxdsl -> modules [<root>/styles/main.uxdsl, <root>/styles/main.uxdsl]
  | ws update [js-update /styles/main.uxdsl?uxdsl&lang.css]
  = the browser re-fetches the module: HTTP 200, rules: .newpart {   color: green; } .card {   color: red; } .main {   color: blue; }

### V8 the module @uses a missing partial
  | hotUpdate update <root>/styles/main.uxdsl -> modules [<root>/styles/main.uxdsl, <root>/styles/main.uxdsl]
  | ws update [js-update /styles/main.uxdsl?uxdsl&lang.css]
  = the browser re-fetches the module: HTTP 500, 
    | client error payload: plugin=undefined id=undefined loc=undefined frame=none message=<root>/styles/main.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import.
    | ws error: <S>/projects/vite-dev

### V9 create styles/parts/_missing.uxdsl
  | hotUpdate create <root>/styles/parts/_missing.uxdsl -> modules []

### V10 save the module unchanged (touch)
  | hotUpdate update <root>/styles/main.uxdsl -> modules [<root>/styles/main.uxdsl, <root>/styles/main.uxdsl]
  | ws update [js-update /styles/main.uxdsl?uxdsl&lang.css]
  = the browser re-fetches the module: HTTP 200, rules: .missing {   color: teal; } .newpart {   color: green; } .card {   color: red; } .main {   color: blue; }

exit: server closed
```

```text
Vite 7.3.7, module /styles/main.uxdsl?uxdsl&lang.css
V0 first fetch: HTTP 500, 
    | client error payload: plugin=undefined id=undefined loc=undefined frame=none message=<root>/styles/parts/_card.uxdsl:1:16: UXD_SASS: Expected expression.
    | ws error: <S>/projects/vite-dev

### W1 fix styles/parts/_card.uxdsl (the first load failed in it)
  | hotUpdate update <root>/styles/parts/_card.uxdsl -> modules []
  = the browser re-fetches the module: HTTP 200, rules: .card {   color: red; } .main {   color: blue; }

exit: server closed
```

`vite build --watch` (`vite-build-watch.mjs`, then `… first-fails`):

```text

### B0 start
  | BUNDLE_END in 273 ms
  = dist/assets/index.css: 7715671a50 (49 B) rules: .card { color: red; } .main { color: blue; }

### B1 Sass error in styles/parts/_card.uxdsl (loaded by the last good build)
  | change update <root>/styles/parts/_card.uxdsl
  | ERROR [commonjs] Could not load <root>/styles/main.uxdsl?uxdsl&lang.css: <S…> (loc=undefined, frame=none)
  = dist/assets/index.css: 7715671a50 (49 B) rules: .card { color: red; } .main { color: blue; }

### B2 fix it
  | change update <root>/styles/parts/_card.uxdsl
  | BUNDLE_END in 64 ms
  = dist/assets/index.css: 7715671a50 (49 B) rules: .card { color: red; } .main { color: blue; }

### B3 UXDSL error (unknown token) in the partial
  | change update <root>/styles/parts/_card.uxdsl
  | ERROR [commonjs] Could not load <root>/styles/main.uxdsl?uxdsl&lang.css: uxdsl: <S…> (loc=undefined, frame=none)
  = dist/assets/index.css: 7715671a50 (49 B) rules: .card { color: red; } .main { color: blue; }

### B4 fix it
  | change update <root>/styles/parts/_card.uxdsl
  | BUNDLE_END in 69 ms
  = dist/assets/index.css: 7715671a50 (49 B) rules: .card { color: red; } .main { color: blue; }

### B5 the module starts @using styles/parts/_newpart.uxdsl, which has a Sass error
  | change update <root>/styles/main.uxdsl
  | ERROR [commonjs] Could not load <root>/styles/main.uxdsl?uxdsl&lang.css: <S…> (loc=undefined, frame=none)
  = dist/assets/index.css: 7715671a50 (49 B) rules: .card { color: red; } .main { color: blue; }

### B6 fix styles/parts/_newpart.uxdsl
  | (nothing: no change seen, no rebuild)
  = dist/assets/index.css: 7715671a50 (49 B) rules: .card { color: red; } .main { color: blue; }

### B7 save the module unchanged (touch)
  | change update <root>/styles/main.uxdsl
  | BUNDLE_END in 65 ms
  = dist/assets/index.css: 4b3c626800 (79 B) rules: .newpart { color: green; } .card { color: red; } .main { color: blue; }

### B8 the module @uses a missing partial
  | change update <root>/styles/main.uxdsl
  | ERROR [commonjs] Could not load <root>/styles/main.uxdsl?uxdsl&lang.css: <S…> (loc=undefined, frame=none)
  = dist/assets/index.css: 4b3c626800 (79 B) rules: .newpart { color: green; } .card { color: red; } .main { color: blue; }

### B9 create styles/parts/_missing.uxdsl
  | (nothing: no change seen, no rebuild)
  = dist/assets/index.css: 4b3c626800 (79 B) rules: .newpart { color: green; } .card { color: red; } .main { color: blue; }

### B10 save the module unchanged (touch)
  | change update <root>/styles/main.uxdsl
  | BUNDLE_END in 40 ms
  = dist/assets/index.css: 64940e8e47 (108 B) rules: .missing { color: teal; } .newpart { color: green; } .card { color: red; } .main { color: blue; }

exit: watcher closed
```

```text

### B0 start
  | ERROR [uxdsl] Could not load <root>/styles/main.uxdsl?uxdsl&lang.css (imported by main.js): <S…> (loc=undefined, frame=none)
  = dist/assets/index.css: absent

### C1 fix styles/parts/_card.uxdsl (the first build failed in it)
  | (nothing: no change seen, no rebuild)
  = dist/assets/index.css: absent

### C2 save the module unchanged (touch)
  | (nothing: no change seen, no rebuild)
  = dist/assets/index.css: absent

### C3 save main.js, the JavaScript module that imports it, unchanged (touch)
  | change update <root>/main.js
  | BUNDLE_END in 166 ms
  = dist/assets/index.css: 7715671a50 (49 B) rules: .card { color: red; } .main { color: blue; }

exit: watcher closed
```

webpack watch with mini-css-extract-plugin (`webpack-watch.js … extract`, then `… extract first-fails`):

```text
webpack 5.111.1, mini-css-extract-plugin 2.10.2, css-loader 7.1.5, mode development

### K0 start
  | compiled: 0 error(s)
  | watched files of the project: , package.json, shared/tokens.scss, src, src/index.js, styles, styles/main.uxdsl, styles/parts/_card.uxdsl
  = dist/main.css: f1c987b600 (547 B) rules: .card { color: red; } .main { color: blue; }

### K1 Sass error in styles/parts/_card.uxdsl (loaded by the last good build)
  | invalid styles/parts/_card.uxdsl
  | compiled: 2 error(s): Module build failed (from ../../consumer/node_modules/uxdsl/dist/webpack.js): / Error: <root>/styles/parts/_card.uxdsl:1:16: UXD_SASS: Expected expression. | Module build failed (from ../../consumer/node_modules/mini-css-extract-plugin/dist/loader.js): / Error: Execution of module code from module graph (./styles/main.uxdsl.webpack[javascript/auto]!=!../..
  | watched files of the project: , package.json, src, src/index.js, styles, styles/main.uxdsl
  = dist/main.css: f1c987b600 (547 B) rules: .card { color: red; } .main { color: blue; }

### K2 fix it
  | (nothing: no rebuild)
  = dist/main.css: f1c987b600 (547 B) rules: .card { color: red; } .main { color: blue; }

### K3 save the module unchanged (touch)
  | invalid styles/main.uxdsl
  | compiled: 0 error(s)
  | watched files of the project: , package.json, shared/tokens.scss, src, src/index.js, styles, styles/main.uxdsl, styles/parts/_card.uxdsl
  = dist/main.css: f1c987b600 (547 B) rules: .card { color: red; } .main { color: blue; }

### K4 UXDSL error (unknown token) in the partial
  | invalid styles/parts/_card.uxdsl
  | compiled: 2 error(s): Module build failed (from ../../consumer/node_modules/uxdsl/dist/webpack.js): / CssSyntaxError: uxdsl: <root>/styles/parts/_card.uxdsl:1:9: UXD_SPACE_REFERENCE: space(99) does not exist; available key | Module build failed (from ../../consumer/node_modules/mini-css-extract-plugin/dist/loader.js): / Error: Execution of module code from module graph (./styles/main.uxdsl.webpack[javascript/auto]!=!../..
  | watched files of the project: , package.json, src, src/index.js, styles, styles/main.uxdsl
  = dist/main.css: f1c987b600 (547 B) rules: .card { color: red; } .main { color: blue; }

### K5 fix it
  | (nothing: no rebuild)
  = dist/main.css: f1c987b600 (547 B) rules: .card { color: red; } .main { color: blue; }

### K6 save the module unchanged (touch)
  | invalid styles/main.uxdsl
  | compiled: 0 error(s)
  | watched files of the project: , package.json, shared/tokens.scss, src, src/index.js, styles, styles/main.uxdsl, styles/parts/_card.uxdsl
  = dist/main.css: f1c987b600 (547 B) rules: .card { color: red; } .main { color: blue; }

### K7 delete styles/parts/_card.uxdsl
  | compiled: 2 error(s): Module build failed (from ../../consumer/node_modules/uxdsl/dist/webpack.js): / Error: <root>/styles/main.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import. | Module build failed (from ../../consumer/node_modules/mini-css-extract-plugin/dist/loader.js): / Error: Execution of module code from module graph (./styles/main.uxdsl.webpack[javascript/auto]!=!../..
  | watched files of the project: , package.json, src, src/index.js, styles, styles/main.uxdsl
  = dist/main.css: f1c987b600 (547 B) rules: .card { color: red; } .main { color: blue; }

### K8 create it again
  | (nothing: no rebuild)
  = dist/main.css: f1c987b600 (547 B) rules: .card { color: red; } .main { color: blue; }

### K9 save the module unchanged (touch)
  | invalid styles/main.uxdsl
  | compiled: 0 error(s)
  | watched files of the project: , package.json, shared/tokens.scss, src, src/index.js, styles, styles/main.uxdsl, styles/parts/_card.uxdsl
  = dist/main.css: f1c987b600 (547 B) rules: .card { color: red; } .main { color: blue; }

exit: watching closed
```

```text
webpack 5.111.1, mini-css-extract-plugin 2.10.2, css-loader 7.1.5, mode development

### K0 start
  | compiled: 2 error(s): Module build failed (from ../../consumer/node_modules/uxdsl/dist/webpack.js): / Error: <root>/styles/parts/_card.uxdsl:1:16: UXD_SASS: Expected expression. | Module build failed (from ../../consumer/node_modules/mini-css-extract-plugin/dist/loader.js): / Error: Execution of module code from module graph (./styles/main.uxdsl.webpack[javascript/auto]!=!../..
  | watched files of the project: , package.json, src, src/index.js, styles, styles/main.uxdsl
  = dist/main.css: absent

### L1 fix styles/parts/_card.uxdsl (the first build failed in it)
  | (nothing: no rebuild)
  = dist/main.css: absent

### L2 save the module unchanged (touch)
  | invalid styles/main.uxdsl
  | compiled: 0 error(s)
  | watched files of the project: , package.json, shared/tokens.scss, src, src/index.js, styles, styles/main.uxdsl, styles/parts/_card.uxdsl
  = dist/main.css: f1c987b600 (547 B) rules: .card { color: red; } .main { color: blue; }

exit: watching closed
```

webpack watch with style-loader (`webpack-watch.js … style`, then `… style first-fails`):

```text
webpack 5.111.1, style-loader 4.0.0, css-loader 7.1.5, mode development

### K0 start
  | compiled: 0 error(s)
  | watched files of the project: , package.json, shared/tokens.scss, src, src/index.js, styles, styles/main.uxdsl, styles/parts/_card.uxdsl
  = dist/main.js: aa63d11702 (23150 B) rules: .card { color: red; } .main { color: blue; }

### K1 Sass error in styles/parts/_card.uxdsl (loaded by the last good build)
  | invalid styles/parts/_card.uxdsl
  | compiled: 1 error(s): Module build failed (from ../../consumer/node_modules/uxdsl/dist/webpack.js): / Error: <root>/styles/parts/_card.uxdsl:1:16: UXD_SASS: Expected expression.
  | watched files of the project: , package.json, src, src/index.js, styles, styles/main.uxdsl
  = dist/main.js: 1e107a739e (19392 B) rules: (none) + a module that throws "Module build failed"

### K2 fix it
  | (nothing: no rebuild)
  = dist/main.js: 1e107a739e (19392 B) rules: (none) + a module that throws "Module build failed"

### K3 save the module unchanged (touch)
  | invalid styles/main.uxdsl
  | compiled: 0 error(s)
  | watched files of the project: , package.json, shared/tokens.scss, src, src/index.js, styles, styles/main.uxdsl, styles/parts/_card.uxdsl
  = dist/main.js: aa63d11702 (23150 B) rules: .card { color: red; } .main { color: blue; }

### K4 UXDSL error (unknown token) in the partial
  | invalid styles/parts/_card.uxdsl
  | compiled: 1 error(s): Module build failed (from ../../consumer/node_modules/uxdsl/dist/webpack.js): / CssSyntaxError: uxdsl: <root>/styles/parts/_card.uxdsl:1:9: UXD_SPACE_REFERENCE: space(99) does not exist; available key
  | watched files of the project: , package.json, src, src/index.js, styles, styles/main.uxdsl
  = dist/main.js: f270e3809d (19713 B) rules: (none) + a module that throws "Module build failed"

### K5 fix it
  | (nothing: no rebuild)
  = dist/main.js: f270e3809d (19713 B) rules: (none) + a module that throws "Module build failed"

### K6 save the module unchanged (touch)
  | invalid styles/main.uxdsl
  | compiled: 0 error(s)
  | watched files of the project: , package.json, shared/tokens.scss, src, src/index.js, styles, styles/main.uxdsl, styles/parts/_card.uxdsl
  = dist/main.js: aa63d11702 (23150 B) rules: .card { color: red; } .main { color: blue; }

### K7 delete styles/parts/_card.uxdsl
  | compiled: 1 error(s): Module build failed (from ../../consumer/node_modules/uxdsl/dist/webpack.js): / Error: <root>/styles/main.uxdsl:1:1: UXD_SASS: Can't find stylesheet to import.
  | watched files of the project: , package.json, src, src/index.js, styles, styles/main.uxdsl
  = dist/main.js: 0cf1563281 (19396 B) rules: (none) + a module that throws "Module build failed"

### K8 create it again
  | (nothing: no rebuild)
  = dist/main.js: 0cf1563281 (19396 B) rules: (none) + a module that throws "Module build failed"

### K9 save the module unchanged (touch)
  | invalid styles/main.uxdsl
  | compiled: 0 error(s)
  | watched files of the project: , package.json, shared/tokens.scss, src, src/index.js, styles, styles/main.uxdsl, styles/parts/_card.uxdsl
  = dist/main.js: aa63d11702 (23150 B) rules: .card { color: red; } .main { color: blue; }

exit: watching closed
```

```text
webpack 5.111.1, style-loader 4.0.0, css-loader 7.1.5, mode development

### K0 start
  | compiled: 1 error(s): Module build failed (from ../../consumer/node_modules/uxdsl/dist/webpack.js): / Error: <root>/styles/parts/_card.uxdsl:1:16: UXD_SASS: Expected expression.
  | watched files of the project: , package.json, src, src/index.js, styles, styles/main.uxdsl
  = dist/main.js: 889f09ece6 (20456 B) rules: (none) + a module that throws "Module build failed"

### L1 fix styles/parts/_card.uxdsl (the first build failed in it)
  | (nothing: no rebuild)
  = dist/main.js: 889f09ece6 (20456 B) rules: (none) + a module that throws "Module build failed"

### L2 save the module unchanged (touch)
  | invalid styles/main.uxdsl
  | compiled: 0 error(s)
  | watched files of the project: , package.json, shared/tokens.scss, src, src/index.js, styles, styles/main.uxdsl, styles/parts/_card.uxdsl
  = dist/main.js: aa63d11702 (23150 B) rules: .card { color: red; } .main { color: blue; }

exit: watching closed
```

The text webpack prints for the failed module (`webpack-error-text.js`, `<scratch>` as the script prints it):

```text
ERROR in ./styles/main.uxdsl (../../consumer/node_modules/css-loader/dist/cjs.js!../../consumer/node_modules/uxdsl/dist/webpack.js??ruleSet[1].rules[0].use[2]!./styles/main.uxdsl)
Module build failed (from ../../consumer/node_modules/uxdsl/dist/webpack.js):
Error: <root>/styles/parts/_card.uxdsl:1:16: UXD_SASS: Expected expression.
    at diagnostic (<scratch>/consumer/node_modules/uxdsl/dist/diagnostics.js:141:19)
    at stageError (<scratch>/consumer/node_modules/uxdsl/dist/sass/compile-sass.js:1015:48)
    at finish (<scratch>/consumer/node_modules/uxdsl/dist/sass/compile-sass.js:518:15)
    at compileSassStage (<scratch>/consumer/node_modules/uxdsl/dist/sass/compile-sass.js:50:16)
    at compileInto (<scratch>/consumer/node_modules/uxdsl/dist/compile.js:113:53)
    at compile (<scratch>/consumer/node_modules/uxdsl/dist/compile.js:76:22)
    at Object.uxdslLoader (<scratch>/consumer/node_modules/uxdsl/dist/webpack.js:149:96)
```

A first webpack build that fails in the discovered theme file (`webpack-theme-first.js`):

```text
### T0 start (the discovered uxdsl.theme.json holds a number leaf)
  | compiled: 1 error(s): Error: UXD_THEME_INVALID: Expected a nonempty string, got number 5 (at spacing.2).
  | watched files of the project: , package.json, src, src/index.js, styles, styles/main.uxdsl
### T1 fix uxdsl.theme.json
  | (nothing: no rebuild)
### T2 save the module unchanged (touch)
  | compiled: 0 error(s)
  | watched files of the project: , package.json, src, src/index.js, styles, styles/main.uxdsl, uxdsl.theme.json
exit: watching closed
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
| Vite dev | error in a partial the last good load loaded (V1–V4) | yes; payload without `loc` or `frame` | — | yes (`ws update`) |
| Vite dev | error in a partial the failing load loaded first (V5–V7) | yes | — | **no**: `hotUpdate … -> modules []`; saving the module recovers |
| Vite dev | first load fails in a partial (W1) | yes | — | **no update sent**; only a reload fetches the fixed CSS |
| Vite dev | a missing partial, then created (V8–V10) | yes | — | **no**; saving the module recovers |
| `vite build --watch` | error in a partial the last good build loaded (B1–B4) | yes, `[commonjs] Could not load …`, no `loc` or `frame` | yes | yes |
| `vite build --watch` | error in a partial the failing build loaded first (B5–B7) | yes | yes | **no**; saving the module recovers |
| `vite build --watch` | a missing partial, then created (B8–B10) | yes | yes | **no**; saving the module recovers |
| `vite build --watch` | first build fails in a partial (C1–C3) | yes, `[uxdsl] Could not load …` | — | **no**, and saving the module does not either; only saving `main.js` recovers |
| webpack (both) | error in a partial the last good build loaded (K1–K6) | yes, absolute path, uxdsl's JS stack, no frame | extract: yes; style-loader: the bundle holds a module that throws | **no**: webpack then watches only `styles/main.uxdsl`; saving it recovers |
| webpack (both) | a partial deleted, then re-created (K7–K9) | yes | as above | **no**; saving the module recovers |
| webpack (both) | first build fails in a partial (L1–L2) | yes | — | **no**; saving the module recovers |
| webpack | first build fails in the discovered theme file (T0–T2) | yes, `UXD_THEME_INVALID` | — | **no**; saving the module recovers |

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

The hosts: `uxdsl/webpack` under `compiler.watch()` with
mini-css-extract-plugin's loader and with style-loader; `uxdsl/vite` in the
dev server (Vite 5 and Vite 7) and in `vite build --watch`; and
`uxdsl build --watch` with a single entry and with `builds`. "A failed
compile" is any error `compile()` throws: `UXD_SASS`, a UXDSL error, a theme
error.

- **C1 — webpack recovers.** When a module's compile fails, the loader
  registers with `this.addDependency()`, before it reports the error:
  (a) every file the module's last successful compile in the same compiler
  registered, which is its `compile()` dependencies and the discovered theme
  file's `require()` tree;
  (b) the file the error names (`err.file`), when it is an absolute path;
  (c) under Q3 (a), the discovered theme file's `require()` tree of this
  compile, also when no compile of the module has succeeded yet.
  An edit to any of them starts a compilation, and an edit that fixes the
  failure makes it succeed. On §4's steps K2, K5, K8 (both chains), L1 (both)
  and T1, the next compilation runs with 0 errors. Its `dist/main.css`
  (mini-css-extract-plugin) or `dist/main.js` (style-loader) equals K0's
  byte for byte, and T1's equals the output of a build with the fixed theme.
  The record is kept per compiler and per resource, never process-wide.
- **C2 — the Vite dev server recovers.** When a module's load fails, an edit
  to (a) a file its last successful load added with `addWatchFile`, (b) the
  file the error names, or (c), under Q3 (a), the discovered theme file's
  tree sends the clients an `update` for that module. That happens through
  `handleHotUpdate` on Vite 5 and `hotUpdate` on Vite 6 and later. The
  module's next fetch returns 200 with the fixed CSS. On §4's V6 and W1, an
  `update` naming `/styles/main.uxdsl?uxdsl&lang.css` is sent, where the base
  sends nothing. V2, V4, V7 and V10 send the same updates as on the base.
- **C3 — `vite build --watch` recovers.** When a build fails in a `.uxdsl`
  module, an edit to (a) that module's own file, (b) a file its last
  successful load added, (c) the file the error names, or (d), under Q3 (a),
  the discovered theme file's tree starts a rebuild. A rebuild that succeeds
  writes the fixed CSS. On §4's B6, C1 and C2 a rebuild runs (`BUNDLE_END`).
  After B6 the CSS holds `.newpart { color: green; }`; after C1 it equals B0's
  output in the run without `first-fails`.
- **C4 — Vite's error is located.** The error the plugin's `load` throws for
  a failed compile has:
  - `loc: { file, line, column }`, with `compile()`'s `err.file` (absolute),
    `err.line` and `err.column`;
  - `frame`, which is Dart Sass's frame (`err.sassFrame`) for `UXD_SASS`, and
    PostCSS's `showSourceCode(false)` (no color codes) for a UXDSL error.

  Its `message` is unchanged. The dev server's error payload (`type: 'error'`)
  and the error of `vite build --watch`'s `ERROR` event carry both. Today
  neither does (§4: `loc=undefined`, `frame=none`). An error with no `file`
  (a theme error) has no `loc` and no `frame`, as today.
- **C5 — webpack's error is located.** The error webpack reports for a failed
  compile shows, after webpack's own `Module build failed (from …):` line:
  - `compile()`'s message, with every occurrence of the module's
    `rootContext` followed by the path separator removed (Q4 (a)), as the CLI
    removes its working directory;
  - then the frame of C4, each line indented by two spaces;
  - and no stack line from uxdsl's `dist` (`at diagnostic (`,
    `at compile (`, `at Object.uxdslLoader (`).

  This holds both in `stats.toJson({ errors: true }).errors[*].message` and
  in `stats.toString({ colors: false })`. Today the message carries the
  absolute path, then the stack, and no frame (§4.3).
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

- **The CLI watch's four older gaps** (MIG-B9-14 §15's follow-up, third
  bullet): the queued selective batch that runs outside `building`
  (`bin/uxdsl.js:1852`); a glob root or plain `watch` path deleted and
  re-created; a file modified after Dart Sass read it, during the build that
  first loads it; a missing partial created where no pattern matches. The
  same class in the adapters (a partial that never existed, created later:
  V9, B9) goes with them. Proposed: a separate story (§15, Q2).
- **An error while a recreated watcher starts** (`refreshWatcher`, MIG-B9-22
  line 315): mentioned there, not registered. Proposed with Q2's story.
- **The atomic-replace failure on PR #84** (§4.5): not in the registration.
  §15, Q6.
- **`compile()` reporting the files Dart Sass loaded on its error:** the
  decision chose this story's adapter-side record instead (MIG-B9-21
  line 212).
- **`error.warnings`:** MIG-B9-21 (the decision on MIG-B9-14's flag 11).
- **A `UXD_*` code on the `CssSyntaxError` `compile()` throws** (§4.6:
  `code=undefined` for a UXDSL error): §15, F3.
- **Windows:** MIG-B9-28 runs the tests there.

## 7. Approach and traps

Non-normative.

- **webpack.** Keep the last successful dependencies in a `WeakMap` keyed by
  the compiler (`this._compiler`; a call with no compiler keeps nothing),
  each a `Map` from `resourcePath` to its files. The README §2 rule forbids a
  process-global cache. In the `catch`, call `addDependency` for each
  recorded file, for `err.file` and (Q3) for `discovered.dependencies`, then
  `callback(err)`. Do not write the theme flags to `buildInfo` on that path:
  MIG-B9-20's count relies on their absence (§5).
- **webpack's message.** `ModuleBuildError` (webpack 5.111.1,
  `lib/errors/ModuleBuildError.js`) prints `err.stack` unless
  `err.hideStack` is set, in which case the stack goes to `details`. Check
  that `stats.toString()` with its default preset does not then print
  `details`. Hand webpack a new `Error` whose message is C5's text, with
  `hideStack = true`, and keep the original as its `cause`.
- **Vite dev.** On a failed load, record the module id against `err.file`,
  the last successful load's files and (Q3) the theme's. In `hotUpdate`
  (Vite ≥ 6, client environment), return the module nodes for `ctx.file`
  from `this.environment.moduleGraph.getModulesByFile()` or `getModuleById()`.
  In `handleHotUpdate` (Vite 4 and 5) return them from `ctx.server.moduleGraph`.
  Clear the record when the module loads again. The baseline probe used
  `hotUpdate` on Vite 7.3.7. Vite 5 needs the tarball fixture
  (`fixtures/vite-adapter/run.js` installs `vite@^5` and `vite@^7`). The
  package's own devDependency is Vite 7 only.
- **`vite build --watch`.** Rollup 4.68.3 attaches the build's watch files
  to the error (`dist/shared/rollup.js:25600–25602`,
  `error_.watchFiles = watchFiles`), and its watcher follows them
  (`dist/shared/watch.js:337–338`). So `this.addWatchFile` for the module's
  real path, `err.file`, the last good files and the theme's, called before
  the error is rethrown, should be what C3 needs. In the baseline even saving
  the module did nothing after a first failed build (C2). Rollup labels a
  later failure `[commonjs] Could not load …` and a first one
  `[uxdsl] Could not load …` (§4.3). Do not assert the plugin name.
- **Vite's frame.** Strip ANSI codes from `showSourceCode(false)`. Use
  `err.sassFrame` as it is. The CLI's `errorFrame` (`bin/uxdsl.js:880–885`)
  is the model; do not add a second formatter for the CLI.
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
  - Vite 5 and Vite 7 need behaviors that differ beyond the hook's name;
  - a test can pass only with a timeout above 20 s;
  - a MIG-B9-20 theme-count test changes;
  - fixing C6 or C7 needs one of §6's four gaps.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `packages/uxdsl/test/webpack/watch-recovery.test.js` (new) | `MIG-B9-39: webpack watch rebuilds when the partial that broke a module is fixed, with mini-css-extract-plugin and with style-loader` | unit (real webpack 5 `watch()`) | C1 (a) | In the same session, an edit to a `.uxdsl` file the module never loaded starts no compilation within 2 s, so the test cannot pass because the loader registers everything. The base fails: no compilation after the fix within the wait |
| T2 | same | `MIG-B9-39: webpack watch recovers when the failing compile's own partial, or the partial of a first build that failed, is fixed` | unit | C1 (b) | The partial is first loaded by the failing compile, so it is in no earlier record; without (b) the base fails. The unrelated-file control of T1 applies |
| T3 | same | `MIG-B9-39: a partial deleted while a module loads it fails the module, and re-creating it rebuilds the module` | unit | C1 (a) | Deleting it must fail the compilation with `UXD_SASS` `Can't find stylesheet to import.`, so a run in which the delete went unseen fails |
| T4 | same | `MIG-B9-39: a first webpack build that fails in the discovered theme file recovers when the theme file is fixed` | unit | C1 (c), Q3 (a) | With `discoverTheme: false` and a `theme` option, an edit to a `uxdsl.theme.json` on disk starts no compilation |
| T5 | same | `MIG-B9-39: webpack reports a failed compile at the file relative to rootContext, then the frame, with no uxdsl stack line` | unit | C5 | A UXDSL error (`space(99)`) must show PostCSS's frame (`> 1 \|`) and a Sass error Dart Sass's (`╷`), so a loader that prints one kind for both fails; the base fails on the stack line and the missing frame |
| T6 | `packages/uxdsl/test/vite/watch-recovery.test.js` (new) | `MIG-B9-39: the Vite dev server sends the module's update when the failing load's own partial, or a first load's partial, is fixed` | unit (real Vite 7 `createServer`) | C2 | An edit to a `.uxdsl` file the module never loaded sends no update for it. The base fails (`modules []`) |
| T7 | same | `MIG-B9-39: vite build --watch rebuilds after a failed build when the module, the failing build's own partial, or a first build's partial is fixed` | unit (real Vite 7 `build({ build: { watch } })`) | C3 | An unrelated file starts no rebuild; the base fails on all three |
| T8 | same | `MIG-B9-39: a failed Vite load carries loc and frame, in the dev server's error payload and in build --watch's ERROR event` | unit | C4 | A theme error (no `file`) has neither, and the UXDSL and Sass frames differ as in T5 |
| T9 | `fixtures/vite-adapter/run.js` | a new step, on each of its two installs (`vite@^5`, `vite@^7`), from the tarball: a fix in the partial a failing load loaded first sends the module's update | fixture (tarball) | C2 on Vite 5 and 7 | The same step's unrelated-file edit sends none. On Vite 5 it fails without `handleHotUpdate` |
| T10 | `fixtures/webpack-adapter/run.js` | a new step, from the tarball: §4's K1–K2 recover | fixture (tarball) | C1 | The unrelated-file control |
| T11 | `packages/uxdsl/test/cli/watch-mode.test.js` | `MIG-B9-39: a file outside the watch patterns that a failing build loaded first is followed, and fixing it rebuilds, the first build included` | CLI (subprocess) | C6 | An edit to a file outside the patterns that no build loaded builds nothing; the base fails on both halves (§4: S10, F1) |
| T12 | same | `MIG-B9-39: the watching line is printed once the watcher is ready, so a write right after it rebuilds even when the watcher is slow to be ready` | CLI | C7 | Under the same `--require` shim (chokidar's `ready` delayed 1.5 s), a write made 200 ms after start, before `ready`, is not built. That proves the delay is in effect. The base prints the line before `ready`, and the write after it is lost |
| T13 | same | `MIG-B9-39: a wait that times out names its step and prints the CLI's output (negative control)`, and the two tests of lines 36 and 145 edited as C8 says | CLI | C8 | A deliberately unmet wait must reject with its step name and a line of the CLI's output; on the base the message is `waitFor timed out` alone |
| T14 | `packages/playground-nextjs/scripts/test-captures-check.cjs` (new), run by `test:captures` | `MIG-B9-39: --check on a captured file that differs in one line prints that line's number, the committed and the captured text` | unit (the script's comparison, exported) | C9 | Two identical texts report no line, and a difference only in the last line is found, so a check that compares lengths or the first line alone fails |
| T15 | `test/vite/theme-emission.test.js`, `test/webpack/theme-emission.test.js`, the `MIG-B9-20`, `MIG-B9-14` and `MIG-B6-23` tests of `watch-mode.test.js`, `test/vite/index.test.js`, `test/webpack/loader.test.js` (unedited except C8's two tests) | as they are | unit | the must-stay list | An invariant guard: they pass on the base (§3) and must pass unchanged |

T1 to T8, T11, T12 and T14 are the failing-first tests (README §2). Each fails
on the base for the reason its row gives and passes after the change. T9
and T10 run from the tarball, and fail on the base the same way.

## 9. Acceptance criteria

BASE below is `git merge-base HEAD origin/feat/beta9`. Each test command
runs with `TMPDIR` set to an empty scratch directory, which must be empty
again afterwards.

- **AC1** `node --test packages/uxdsl/test/webpack/watch-recovery.test.js`
  exits 0, with T1 to T5 run and none skipped.
  - Test file: `packages/uxdsl/test/webpack/watch-recovery.test.js`.
  - Mutations: no `addDependency` in the `catch` fails T1 to T3; no theme
    tree there fails T4; the base's `callback(err)` fails T5.
- **AC2** `node --test packages/uxdsl/test/vite/watch-recovery.test.js`
  exits 0, with T6 to T8 run and none skipped.
  - Test file: `packages/uxdsl/test/vite/watch-recovery.test.js`.
  - Mutations: no `hotUpdate` fails T6; no `addWatchFile` before the rethrow
    fails T7; no `loc` or `frame` fails T8.
- **AC3** `npm run verify:vite-adapter` and `npm run verify:webpack-adapter`
  exit 0, and their output shows T9's step on Vite 5 and on Vite 7, and
  T10's.
  - Test files: `fixtures/vite-adapter/run.js`, `fixtures/webpack-adapter/run.js`.
  - Mutation: without `handleHotUpdate`, the Vite 5 run of T9 fails.
- **AC4** `node --test --test-name-pattern="MIG-B9-39" packages/uxdsl/test/cli/watch-mode.test.js`
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
- **AC7** T15's commands, as §3 runs them, exit 0 with the counts of §3 plus
  the new tests. `git diff --exit-code "$BASE" -- packages/uxdsl/src/compile.ts packages/uxdsl/src/sass packages/uxdsl/src/diagnostics.ts packages/playground-nextjs/src/generated`
  exits 0.
  - Test files: T15's.
  - Mutation: writing theme flags on the failed path fails
    `test/webpack/theme-emission.test.js`.
- **AC8** §4's reproduction, re-run on the head, exits 0 and prints a
  rebuild at K2, K5, K8 and L1 (both chains), T1, V6, W1 (`ws update`), B6,
  C1, C2, S10 and F1, with the outputs of C1 to C6. It prints what §4.3
  records at S13, V9 and B9 (§6) and at every other step.
  - Test file: none (the reproduction of §4).
  - Mutation: the base prints §4.3.
- **AC9** `npm test` and `npm run verify:1.0 -- --skip-playground-walk` exit
  0.
  - Test files: every suite `npm test` runs, among them AC1 to AC4's, and
    `fixtures/release-1.0/run.js`.
  - Mutation: AC1 to AC4's, which `npm test` runs; `verify:1.0` is an
    invariant guard.

Owner checks, separate from the above: Q1 to Q6 answered (§15) before the
story starts. (Answered 2026-11-13, decisions 28 to 33, §15.)

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes: one subsection under `## 0.5.0-beta.9 — unreleased`; `### Visual changes`: none |
| package README | yes: the docs guard demands it for a change under `packages/uxdsl`; one sentence (§11) |
| `verify-docs-update.js` classification | no (no file added or deleted under `packages/uxdsl/src`) |
| `npm run generate:language` | no |
| `AGENTS.md` + agent guide | no: it says nothing about watch recovery or adapter error text |
| `DIAGNOSTIC_CATALOG` | no (no new code) |
| `npm run generate:capabilities` | no |
| playground `uxdsl:build` + captures | no regeneration: C7 keeps the CLI's text, and `--check` must pass unchanged (AC6, AC7) |
| `migration.md` | no: nothing a user has to change |

## 11. Documentation

- `packages/uxdsl/docs/integrations/webpack.md`, lines 23–32: replace "And a
  compile that fails registers only the module's own file, …" with C1. A
  compile that fails still registers the files of the module's last
  successful compile and the file its error names (and, under Q3 (a), the
  theme file), so fixing it rebuilds. A partial that never existed is
  noticed when the module is saved. One sentence on the error text (C5).
- `packages/uxdsl/docs/integrations/vite.md`, lines 210–223: replace "And a
  load that fails adds no file: …" with C2 and C3, keeping the
  `node_modules` exception and stating the never-existed partial's limit.
  One sentence on `loc` and `frame` (C4).
- `packages/uxdsl/docs/integrations/cli.md`, Watch mode (lines 484–514): one
  sentence for C6, which says that a failed build follows the file its error
  names; and one for C7, which says that the watching line is printed once
  the watcher is ready. Lines 544–549 stay.
- `packages/uxdsl/README.md`, lines 89–95: one sentence after "…webpack's
  `rootContext`;". It says that both adapters rebuild after a failed compile
  when the file at fault, or a file the last good compile loaded, is saved,
  and that their errors carry the location and the frame.
- `packages/uxdsl/CHANGELOG.md`: one subsection at the top of
  `## 0.5.0-beta.9 — unreleased`, ending `(MIG-B9-39)`. It covers C1 to C7,
  as the user sees them; C8 and C9 as one sentence on the tests and the
  check; and `### Visual changes`: none.
- The source comments of `webpack.ts` (lines 1–30), `vite.ts` (lines 8–38) and
  `startWatch` (`bin/uxdsl.js` lines 1617–1646) are rewritten to state the
  failure path (README §2).

## 12. Verification

```bash
TMPDIR=<empty dir> node --test packages/uxdsl/test/webpack/watch-recovery.test.js packages/uxdsl/test/vite/watch-recovery.test.js   # exit 0
TMPDIR=<empty dir> node --test --test-name-pattern="MIG-B9-39" packages/uxdsl/test/cli/watch-mode.test.js                          # exit 0
npm run verify:vite-adapter && npm run verify:webpack-adapter                                                                     # exit 0; T9 on Vite 5 and 7, T10
npm --prefix packages/playground-nextjs run test:captures                                                                          # exit 0
for i in $(seq 1 20); do node packages/playground-nextjs/scripts/capture-capabilities.js --check || break; done                    # 20 × exit 0
for i in $(seq 1 20); do TMPDIR=<empty dir> node --test --test-name-pattern="^watch (retargets the entry and source globs|mode reloads a theme value that comes from a nested require)" packages/uxdsl/test/cli/watch-mode.test.js || break; done   # 20 × exit 0, with npm test in the background
<T15's commands from §3>                                                                                                          # exit 0
git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- packages/uxdsl/src/compile.ts packages/uxdsl/src/sass packages/uxdsl/src/diagnostics.ts packages/playground-nextjs/src/generated   # exit 0
TMPDIR=<empty dir> bash <§4.1's reproduction>                   # exit 0; AC8's steps
npm test                                                        # background, with a log; exit 0
npm run verify:1.0 -- --skip-playground-walk                    # background, with a log; exit 0
```

Stop every watcher and server a step started (`pgrep -fl "uxdsl.*--watch|vite|webpack"`
shows none of this worktree's).

## 13. Delivery

Under Q1 (a), as written, the flow is an assumption, which §15's Q1 asks
the owner to confirm with it: decision D1 of 2026-11-04 defines the light
flow for S stories and keeps the full flow "for M stories that change the
engine", and says nothing of an M story that does not change the engine.
This file assumes the light flow with two implementers, the adapters
(C1 to C5, T1 to T10) and the CLI and tests (C6 to C9, T11 to T14), and one
review that covers the timing-sensitive tests. Under Q1 (b) the question
does not arise: each part is an S story delivered by the light flow.

Branch `feat/b9-39-watch-recovers-after-failure`. Commit:
`fix(FEAT-010): MIG-B9-39 - every host's watch recovers after a failed compile; adapter errors carry the location and the frame`.

PR title: `FEAT-010: MIG-B9-39 - every host's watch recovers after a failed compile`.
The body:

- **Goal:** §1, in two sentences.
- **Owner answers:** Q1 to Q6 as answered, and what each changed.
- **Per host:** §4.4's table, base against head (AC8).
- **The flake and the captures:** AC5's and AC6's runs, CI's runs of the
  PR, and any named step that failed.
- **Gates:** `npm test`, `verify:1.0 -- --skip-playground-walk`,
  `verify:vite-adapter`, `verify:webpack-adapter`, with exit codes.
- **Not run, or not a pass:** anything §14 lists so (Linux reproduction of
  the flake, Vite 6).
- The last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 14. Closure record

Delivered in PR #96, from `feat/b9-39-watch-recovers-after-failure` into `feat/beta9`, by the light flow for an S story (decision D1 of 2026-11-04; decision 28 of 2026-11-13): one scout, one implementer, one review and one deliverer. Where the delivered contract differs from §5, §8 or §9, §15's blocks rule; the differences are listed below. Only the owner merges.

**Base and commits.** The base is `feat/beta9` at `cf98cb8`, after MIG-B9-21 (PR #92).

| Commit | Content |
| --- | --- |
| `f38af40` | §15: stale lines corrected on `cf98cb8`, and the scout's findings and flags 1 to 4 answered as recommended |
| `15689c1` | C1 to C5 in `webpack.ts` and `vite.ts`; T1 to T8 (two new files); T9 and T10 in the fixtures; `webpack.md`, `vite.md`, the README clause and the CHANGELOG subsection |
| `be465ba` | Review findings: the theme-flags test (AC7's mutation), the `hotUpdate` spy in T6, T1 rebuilt to prove C1 (a), the per-compiler test, and the CHANGELOG narrowed for style-loader |
| `ef0dc8f` | Merge of `origin/feat/beta9` at `44eac7c` (PR #93, MIG-B9-16), with no conflict |
| `f769c95` | T1's waits pass over a build from before the edit (the first `npm test` failed T1 once) |
| `5745377` | Merge of `origin/feat/beta9` at `99f6a82` (PR #94, MIG-B9-25), with no conflict |
| `514d067` | The new tests use MIG-B9-25's `temporaryDirectory` helper (flag 4; decision 15 of 2026-11-15) |
| `8f0815c` | Every wait after an edit in the webpack tests passes over a build from before it; `quiet` names the unrelated file (PR #96's first CI run failed T2 to T4) |
| `59f1706` | Merge of `origin/feat/beta9` at `65359cf` (PR #95, the owner's decisions of 2026-11-15), with no conflict |

`src/compile.ts`, `src/sass/**`, `src/diagnostics.ts` and the playground's generated files are unchanged: `git diff --exit-code cf98cb8 -- …` exits 0.

**Environment.** macOS (Darwin 27), Node 20.19.0, npm 11.21.1, Chrome 157.0.8103.51. Package devDependencies: Vite 7.3.7, webpack 5.111.1, css-loader 7.1.5, mini-css-extract-plugin 2.10.2, style-loader 4.0.0. The fixtures installed vite 5.4.21 and 7.3.8. `TMPDIR` pointed into the session scratchpad for every run. The machine ran two other story workflows at the same time (load average 10 to 37), and it was suspended several times during the delivery: a test that "ran" for 500 to 990 s is a suspension.

**Failing first.** On the base's `dist`, T1 to T4 failed with `<step>: no webpack build within 20 s`. T5 failed on the absolute path, the stack and the missing frame. T6 failed with `not sent within 10 s; sent: []`, T7 with `no build within 20 s`, and T8 on a missing `loc`. T9's child script failed on a base install (vite 7.3.7). T10 was not run against a base install; T1 covers the same mechanism there. The tests added at review are guards over a correct head, each shown failing under its mutation (below).

**Criteria.**

| AC | Result |
| --- | --- |
| AC1 | `node --test packages/uxdsl/test/webpack/watch-recovery.test.js`: 7 pass (T1 to T5, and the per-compiler and theme-flags tests), none skipped. `TMPDIR` is empty afterwards. Mutations: no `addDependency` in the `catch` fails T1 to T4; no theme tree fails T4; `callback(err)` fails T5 |
| AC2 | `node --test packages/uxdsl/test/vite/watch-recovery.test.js`: 3 pass (T6 to T8), and `TMPDIR` is empty. Mutations: no `hotUpdate` fails T6 (with the spy; §15); no `addWatchFile` before the rethrow fails T7; no `loc` or `frame` fails T8 |
| AC3 | `npm run verify:vite-adapter`: exit 0, with T9's line on vite 5.4.21 (cjs) and 7.3.8 (esm). `npm run verify:webpack-adapter`: exit 0, with T10's line. Mutation: without `handleHotUpdate` in the installed vite 5.4.21 consumer, T9's script fails (`not sent within 10 s; sent: []`). The fixtures' `packAndInstall` directories were removed by hand after each run (flag 3) |
| AC7 | `theme-emission` (vite and webpack): 11 pass. `--test-name-pattern="MIG-B9-14\|MIG-B6-23"` over `vite/index.test.js` and `webpack/loader.test.js`: 6 pass, 34 skipped. The adapter suites: 61 of 61, which is 51 on the base plus 10 new, all in new files. `git diff --exit-code cf98cb8 -- …` exits 0. AC7's mutation (theme flags on the failed path) does not fail `theme-emission.test.js`; it fails this story's theme-flags test (§15, flag 5) |
| AC8 | §4's adapter reproduction, from a tarball packed on `ef0dc8f`'s sources (90 files, 284,465 B; vite 7.3.7, webpack 5.111.1, sass 1.108.2, postcss 8.5.33), exits 0 on every script. It prints a rebuild at K2, K5 and K8 and at L1 (both chains), at T1, at V6 (`ws update [js-update /styles/main.uxdsl?uxdsl&lang.css]`), at W1 (`ws full-reload`, then 200; flag 1), and at B6, C1 and C2 (BUNDLE_END; C1's CSS is `7715671a50`, equal to B0's). Every successful hash is as on the base (`f1c987b600`, `aa63d11702`, `7715671a50`, `4b3c626800`, `64940e8e47`). Errors carry `loc` and a frame, and the theme error has neither. webpack's text is `styles/parts/_card.uxdsl:1:16: UXD_SASS: Expected expression.`, then the indented frame, with no stack line. V9 (`modules []`) and B9 (`nothing`) are unchanged. style-loader's failed bundles now differ from §4.3's (K1 `d2f5b14bc7` 18841 B, K4 `6b8f4cf036` 18771 B, K7 `66ef2406b1` 18778 B, first-fails K0 `8df247dab6` 19905 B), because the thrown module embeds the new message, which has no stack. `pgrep` afterwards finds nothing |
| AC9 | `npm test`: run 1 on `ef0dc8f` exited 1 (T1, fixed in `f769c95`). Run 2 on `514d067` exited 1 (`MIG-B9-20: build --watch counts the theme over the last result of every entry`, `waitFor timed out` after 605 s, outside this story, during a suspension). Run 3 on `59f1706` exited 0, with 0 `not ok` and the tmpdir guard passing. `npm run verify:1.0 -- --skip-playground-walk`: run 1 exit 0 (71/71). Run 2 exit 1 (N-04's vite-adapter fixture exited 1, and `cssmod` was ended by a signal, both during that suspended, loaded window; the same `verify:vite-adapter` passed alone in the same gate run). Run 3 on `59f1706` exit 0 (`71/71 automated checks passed`) |

**Other gates.** `npm run verify:playground-browser` (real Chrome): run 1 and run 2 exit 0 (`pages loaded: 380`, `PASS: no console errors, no UXDSL warnings, …`). `node --test scripts/no-history-comments.test.js`: 4 pass. `plugin-option-parity.test.js`: 5 pass. `node fixtures/parity/run.js`: 10 cases PASS.

**CI.** Recorded in PR #96's closure comment. The first run (43726201875, on `514d067`) failed T2 to T4 on ubuntu, fixed in `8f0815c`. The run on `59f1706` (43732946338) passed `npm test`.

**Not run, or not a pass.** Vite 6 was not run. There was no Linux or Windows reproduction beyond CI's ubuntu job. The CLI's §4 steps (S10, F1, S13), C6 to C9 and AC4 to AC6 are MIG-B9-19's. `npm test` runs 1 and 2 and `verify:1.0` run 2 are failures, recorded above, not passes.

## 15. Findings and follow-ups

**New facts, from writing this file.**

- **F1 — The flake, four times, in two tests.** §4.5 lists every CI
  occurrence: the test at line 36 three times (PR #72, PR #80 and Dependabot's
  PR #66 against `main`), and the one at line 145 once (PR #71). It never
  failed in 20 local runs. Its log cannot say which wait timed out (C8).
- **F2 — Another watch-mode test failed on CI once.**
  `MIG-B6-23: an output file is never observed empty or truncated while a
  rebuild is writing it (atomic replace)`, on Dependabot's PR #84 against
  `main` (§4.5). It is not in the registration. Q6.
- **F3 — The error `compile()` throws for a UXDSL error has no `code`.**
  `name=CssSyntaxError`, `code=undefined`, while its message carries
  `UXD_SPACE_REFERENCE` (§4.6); a `UXD_SASS` error has `code`. A host that
  branches on `err.code` sees no code there. Not changed here (§5 keeps
  `compile()`). Proposed: MIG-B9-21, which already changes the error
  `compile()` throws (`error.warnings`), or the owner's choice.
- **F4 — Rollup names the failing plugin differently.** A later failure
  under `vite build --watch` reads `[commonjs] Could not load …`, a first one
  `[uxdsl] Could not load …` (§4.3). C4 does not assert the name. For
  information.
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
- **F8 — Index bookkeeping, for the index's owner.** README §5 still reads
  "In review (PR #88)" for MIG-B9-20, merged as `cc10de6`. README §7 needs
  these changes for this story:
  - add 39 to `packages/uxdsl/docs/integrations/cli.md` (20, 21, 17, **39**,
    60, 61, 63; MIG-B9-21 is on it by decision 8 of 2026-11-13);
  - a new row `packages/uxdsl/docs/integrations/vite.md`, `webpack.md`
    (20, 39, 64; MIG-B9-64 lists them);
  - a new row `fixtures/vite-adapter/**` (20, 39);
  - the row `fixtures/mig07-consumer/**`, `fixtures/webpack-adapter/**`
    (20, 66) gains 39 for `fixtures/webpack-adapter/**` only (20, **39**, 66),
    for instance by splitting it.

  Corrected when the index took these rows: MIG-B9-64's story file does not
  list `vite.md` or `webpack.md` (its Shares are `plugin.ts`, `compile.ts`,
  `types.ts`, `vite.ts`, `webpack.ts`, `bin/uxdsl.js`, `apply-theme.ts` and
  `fixtures/release-1.0/run.js`), and the index's row gives MIG-B9-66
  `fixtures/mig07-consumer/**` only, as MIG-B9-28's Q1 (b) names it. The
  index's row for `vite.md` and `webpack.md` is 20, 21 (MIG-B9-21's Q1 (a))
  and 39; `fixtures/vite-adapter/**` gets no row, since no other unmerged
  story edits it (§7's rule); and 39 is added to `fixtures/webpack-adapter/**`
  in the existing row, where 66 does not wait for it.

  The rows it is already on (`bin/uxdsl.js`, `vite.ts`/`webpack.ts`,
  `test/cli/**`, `packages/playground-nextjs/**`, the append-only CHANGELOG
  and README) are as README §7 has them, except that the `bin/uxdsl.js` row
  gains MIG-B9-21 and MIG-B9-37 before 38 (their story files share it), and
  the `test/cli/**` and `packages/playground-nextjs/**` rows gain MIG-B9-21
  (decision 8 of 2026-11-13) and, on `test/cli/**`, MIG-B9-38 before 39. So
  this story also waits for MIG-B9-37 on `bin/uxdsl.js`. The index applies
  these changes in the PR that adds this file.

### Open questions for the owner (answer before implementing)

Under the owner's standing instruction of 2026-11-10 (FEAT-010 §2, the
lead-in to decisions 33 to 37), each question below is answered with its
recommended option unless the owner overrides it. The contract assumes the
recommended option for Q2 to Q6. For Q1 it assumes (a), one M story as
written, although the recommendation is (b). Answered as recommended:
Q1 (b) splits this file into two S stories, the second under an id the
owner assigns (the standing instruction does not assign one), and its §13
and the index's §5 and §7 follow the split; Q2 (a) proposes a new wave-3
story, also under an id the owner assigns; Q3 (a) goes beyond the decision's
words "the adapters re-register the last good dependencies and `err.file`"
(C6 and the theme file's tree). These three widen the registration, so they
are listed for the owner in the PR that adds this file.

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
4. **Q4 — The path in webpack's error text.**
   - (a) Relative to `rootContext`, as the loader's warnings are (README
     lines 91–94) and as the CLI prints.
   - (b) Absolute, as `compile()` gives it. C5 then only adds the frame and
     drops the stack.

   Vite's `loc.file` stays absolute either way, since Vite needs it, and its
   `message` is unchanged. **Recommendation: (a).** **Until answered:** (a).
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

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-13), as decisions 28 to 33 of 2026-11-13. PR #89, which added this file, put Q1 to Q6 above to the owner as its questions 17 to 22. On 2026-11-10 the owner gave a standing instruction for FEAT-010, verbatim, "fusiona todo.. y preguntas como recomendadas, y sgeuimos" ("merge everything, and the questions as recommended, and let's keep going"). The questions were not put to the owner one by one: under that instruction each recommended option is the owner's decision of 2026-11-13, and the owner may still override any of them. This record is in English and lists the decisions that concern this story. Where a decision differs from this story's contract, it rules; the contract is not rewritten here, and the items each decision changes are named below.

- **Q1 (decision 28): (b), a split into two S stories.** It differs from the contract, which assumed (a), one M story.
  - **What stays here:** the adapters, C1 to C5, T1 to T10, AC1 to AC3, and AC7 to AC9 for their part. This story is S. Under the index's §7 it waits for MIG-B9-21 alone on its files.
  - **What moved to [MIG-B9-19](MIG-B9-19-cli-watch-recovers.md),** "The CLI's watch recovers after a failed compile, and its flaky watch test and captures check name what failed" (wave 3, S, Ready; the id was taken by the recorder, and the owner may renumber it): C6 to C9; T11 to T14 (retitled `MIG-B9-19: …`); AC4 to AC6; and, for the CLI's part, AC7 to AC9. MIG-B9-19's file is made from this file's material for them: §2's items on the registration, the CLI, the flake and the captures; §3's lines for `bin/uxdsl.js`, `watch-mode.test.js` and the captures check, and the "Before starting" lines for MIG-B9-38, 25, 17 and 28; §4's setup, `lib.js`, `cli-single.js`, `cli-first-and-builds.js`, the CLI's output, §4.4's CLI rows, §4.5 and §4.6; F1, F2, F5, F6 and F7; and Q1, Q2, Q3, Q5 and Q6.
  - **The numbers do not change.** Option (b) reads "Each keeps its C-n, T-n and AC-n as numbered here, and the must-stay list applies to both". So §5's "must stay byte-identical" list holds for both stories as written.
  - **How to read the rest of this file.** §1 to §14 are kept as written, and that text stays valid for this story's part. Where it names C6 to C9, T11 to T14, AC4 to AC6 or the CLI, those items are MIG-B9-19's, and this story does not implement them:
    - §1's `uxdsl build --watch` and its sentence on the flaky test and the captures check;
    - §5's hosts sentence, for `uxdsl build --watch`;
    - §6's CLI items, now with their destinations: the four older gaps and `refreshWatcher` are MIG-B9-06's (decision 29), and the atomic-replace failure is the owner's to route (decision 33);
    - §7's "CLI, C6", "CLI, C7" and "The captures" items, the CLI's part of "Tests that wait", and the stop rule's "fixing C6 or C7" item;
    - §8's T11 to T14, and T15's `watch-mode.test.js` tests. T15 here keeps the Vite and webpack files: `test/vite/theme-emission.test.js`, `test/webpack/theme-emission.test.js`, `test/vite/index.test.js` and `test/webpack/loader.test.js`;
    - §9: AC4 to AC6. AC7 here runs T15's adapter commands as §3 runs them, with the same `git diff`. AC8 here runs the adapters' steps (K2, K5, K8 and L1 on both chains, T1, V6, W1, B6, C1, C2, V9 and B9), and S10, F1 and S13 are MIG-B9-19's. AC9 is in both;
    - §10's playground row;
    - §11's `cli.md` item and the `startWatch` comments. The CHANGELOG subsection here covers C1 to C5; MIG-B9-19 writes its own for C6 to C9;
    - §12's CLI, captures and stress lines.
  - **§13's flow.** Q1 (a)'s assumption, the light flow with two implementers, no longer arises: each part is an S story delivered by the light flow (decision D1 of 2026-11-04), with one implementer.
  - **The index.** Its §5 marks this row S and adds MIG-B9-19's. Its §7 takes this story off the rows for `bin/uxdsl.js`, `packages/uxdsl/test/cli/**`, `cli.md` and `packages/playground-nextjs/**`, and puts MIG-B9-19 on them. The header's Size, Owns, Shares, Depends on, Blocks, Base and Output impact follow (done in the PR that records this decision).
- **Q2 (decision 29): (a)**, as the contract assumed. The CLI watch's four older gaps are registered as MIG-B9-06, "The CLI watch's four older gaps, the same class in the adapters, and an error while a recreated watcher starts" (wave 3, S, story file to be written). It also covers the same class in the adapters, a partial that never existed and is created later (§4's V9 and B9), and MIG-B9-22's uncaught error while a recreated watcher starts. It comes after MIG-B9-19 and, for the adapters' class, after this story. §5's must-stay item for V9 and B9 holds here, and MIG-B9-06 changes it.
- **Q3 (decision 30): (a), both extensions**, as the contract assumed. This story's is (ii): the adapters register the discovered theme file's tree on a failed compile, the first included (C1 (c), C2 (c), C3 (d)). Extension (i), C6, is MIG-B9-19's. The decision widens the registration's words "the adapters re-register the last good dependencies and `err.file`".
- **Q4 (decision 31): (a)**, as the contract assumed. webpack's error text gives the path relative to `rootContext`, then the frame, with no stack (C5).
- **Q5 (decision 32): (a)**, as the contract assumed. It concerns the flake and the captures, which are now MIG-B9-19's (C7 to C9, AC5, AC6).
- **Q6 (decision 33): (a)**, as the contract assumed. The atomic-replace failure on PR #84 (F2) is out of scope here and in MIG-B9-19; the owner routes it, and no story is assigned it.

### Starting base: stale lines corrected (cf98cb8, 2026-11-15)

The story starts from `feat/beta9` at `cf98cb8` (MIG-B9-21 merged as PR #92). Its scout re-ran §3 and §4 there. The lines below were stale and are corrected in place; the old and new line of each is recorded here.

- **§3, HEAD.** Old: `git rev-parse --short HEAD                                  # 5a041fc`. New: `… # cf98cb8 (feat/beta9 after MIG-B9-21, PR #92)`. The story starts from the base after MIG-B9-21, as its header says.
- **§3, the adapters' lines.** Old: `… # webpack.ts:6 (comment), 58 (type), 226, 227, 235, 236; vite.ts:20 (comment), 198, 199`. New: `… # webpack.ts:6 (comment), 58 (type), 216, 224, 227; vite.ts:20 (comment), 191`. MIG-B9-21 moved theme discovery into `compile()`, removed the adapters' own discovery and their `addDependency`/`addWatchFile` of the theme, and added the failed compile's warnings to the `catch`.
- **§2, "The code".** Old: "`packages/uxdsl/src/webpack.ts` lines 226–237: `addDependency` runs only after `compile()` resolves; the `catch (err)` calls `callback(err)` alone. `packages/uxdsl/src/vite.ts` lines 190–199: `addWatchFile` runs only after `compile()` resolves; `load` has no `catch`, and the plugin has no `hotUpdate` or `handleHotUpdate` hook." New: "`webpack.ts` lines 216–228: `addDependency` runs only after `compile()` resolves; the `catch (err)` emits `err.warnings`, then calls `callback(err)`. `vite.ts` lines 174–191: `compile(...).catch()` emits `err.warnings` through `this.warn()` and rethrows; `addWatchFile` runs only after `compile()` resolves, and the plugin has no `hotUpdate` or `handleHotUpdate` hook." The recovery gap is the same.
- **§3, "Before starting".** Old: `git log --oneline --grep='MIG-B9-21 -' HEAD | grep -q .    # MIG-B9-21 merged`. New: the same command, `# MIG-B9-21 merged (exit 0 on cf98cb8)`. The MIG-B9-38, 25, 17 and 28 lines still exit 1; since decision 28 they are MIG-B9-19's and do not gate this story.
- **§3, the checks on the starting base.** Both adapters emit `err.warnings` before the error (webpack through `emitWarning`, Vite through `this.warn`), and MIG-B9-21's tests `the Vite plugin and the webpack loader emit a failed compile's warnings before the error` pin it; the failure path keeps that order. `compile()`'s error still carries `file`, `line`, `column`, `code` (`UXD_SASS` only) and `sassFrame` as §4.6 records, and now `warnings`; it never carries `dependencies`. MIG-B9-25's temporary-directory helper is not merged, and `ci.yml` has no Windows job (MIG-B9-28 is not merged).
- **§4.1, the tarball and the install.** Old: `# uxdsl-0.5.0-beta.9.tgz, 284,866 bytes, 92 files; …` and `# style-loader 4.0.0, sass 1.108.2, chokidar 4.0.3, postcss 8.5.32`. New: `# uxdsl-0.5.0-beta.9.tgz, 282,518 bytes, 90 files (cf98cb8); …` and `… postcss 8.5.33`. MIG-B9-21 deleted files, and the registry now resolves postcss 8.5.33.
- **§4.3, `webpack-error-text.js`'s stack.** Old: `at compile (…/dist/compile.js:95:53)` then `at Object.uxdslLoader (…/dist/webpack.js:163:96)`, with `diagnostics.js:138:19` and `compile-sass.js:997:48`, `510:15`, `48:12` above them. New: `at compileInto (…/dist/compile.js:113:53)`, `at compile (…/dist/compile.js:76:22)`, `at Object.uxdslLoader (…/dist/webpack.js:149:96)`, with `diagnostics.js:141:19` and `compile-sass.js:1015:48`, `518:15`, `50:16`. MIG-B9-21 split `compile()` into `compile()` and `compileInto()`, so C5's "no stack line from uxdsl's `dist`" also excludes `at compileInto (`.
- **§4.3, style-loader's failed bundles.** Old: K1 `7ea9f76150 (19318 B)`, K4 `e46744181c (19719 B)`, K7 `66603e08ac (19322 B)`, first-fails K0 `775654737f (20382 B)`. New: K1 `1e107a739e (19392 B)`, K4 `f270e3809d (19713 B)`, K7 `0cf1563281 (19396 B)`, first-fails K0 `889f09ece6 (20456 B)`. The bundled module that throws embeds the error's stack, which changed with MIG-B9-21. Every successful output's hash is unchanged.

### Findings and owner flags from the scout (2026-11-15)

- **§7's `hideStack` (a finding; §7 is non-normative and is not rewritten).** On webpack 5.111.1, `ModuleBuildError` puts `err.stack` into `details` when `hideStack` is set, and `stats.toString()` prints `details` by default (`errorDetails: 'auto'`, fewer than three errors). Measured, that printed a stack line, which C5 forbids. The loader hands webpack an `Error` whose `stack` is its message instead: `toJson()` and `toString()` then show webpack's header and the text, and `details` is undefined.

The four flags below were answered with their recommended option under the owner's standing instruction of 2026-11-10 ("fusiona todo.. y preguntas como recomendadas, y sgeuimos"), not put to the owner one by one. The owner may override any of them.

1. **W1, a Vite dev module whose first load failed (a finding: C2's W1 line is wrong, and it is not rewritten).** Vite 5 and 7 never propagate an `update` through a module node they have not analyzed (Vite 7.3.7's `propagateUpdate` stops at `isSelfAccepting === undefined`), and Vite's client ignores an update for a module it never executed, so C2's "an `update` naming `/styles/main.uxdsl?uxdsl&lang.css`" at W1 cannot happen. Options: (a) the HMR hook returns the failed node's importers, so Vite sends its own `full-reload` (measured on 7.3.7 and 5.4.21), and V6 keeps its `update`; (b) force an `update` through Vite's internals, which is fragile and still does not recover the page; (c) leave W1 a documented limit. **Answer: (a).** It is the only option that recovers the page, and it uses Vite's own propagation on both majors.
2. **Where the adapters get the theme file's `require()` tree on a failed compile (C1 (c), C2 (c), C3 (d)).** `compile()`'s error carries no dependencies, and `compile.ts` must not change. Options: (a) each adapter calls `config.ts`'s existing exports `findThemeConfigPath(configRoot)` and `collectLocalRequireTree(file)` in a `try`, only when `theme` is undefined and `discoverTheme !== false`, so MIG-B9-21's `/discoverTheme(?:Async|Sync)/` guard still holds and `config.ts` is not edited; (b) a shared helper in `config.ts`, which adds it to the Shares; (c) `compile()` puts its dependencies on its error, which the must-stay list forbids. **Answer: (a).** The documented limit: a theme file whose own `require()` throws part-way registers only the theme file, not the files it failed to load.
3. **TMPDIR after the fixtures (AC3).** `fixtures/vite-adapter` and `fixtures/webpack-adapter` leave `packAndInstall`'s consumer directories in `TMPDIR` on the base, and MIG-B9-25 keeps `fixtures/lib/tarball-consumer.js` unedited. Options: (a) the new tests clean up after themselves, and the deliverer removes the fixtures' directories by hand and records them as base behaviour; (b) edit `tarball-consumer.js` here, outside the Shares and against MIG-B9-25's decision. **Answer: (a).**
4. **MIG-B9-25's temporary-directory helper (in progress).** Options: (a) do not wait: the new test files make and remove their own directories (`mkdtemp`, `realpathSync`, `rmSync` in `t.after`), so they pass a leak guard, and whichever story merges second switches them to the helper; (b) wait for MIG-B9-25. **Answer: (a).** README §7 does not order the two stories on these new files.

### Review findings and the implementer's (2026-11-15)

The review mutated the built adapters one change at a time and ran the new tests. What it found, and what the deliverer did:

- **AC7's mutation does not hold as written (a finding: AC7's mutation line is wrong, and it is not rewritten).** Writing theme flags on the failed path (`buildInfo.uxdslTheme = { themeEmitted: false, … }` before the error) passed every webpack test, `test/webpack/theme-emission.test.js` included, and in a real build whose global (`@uxdsl theme;` plus a broken `@use`) fails next to a component that references a token, it printed a false `UXD_THEME_MARKER` "no module reaches `@uxdsl theme;`" warning (none on the head). The guard is now `MIG-B9-39: a webpack module whose compile failed carries no theme flags, so a build whose global fails reports no missing @uxdsl theme`, in this story's new `test/webpack/watch-recovery.test.js`: both chains, with a control in which the same component without a global, every module compiled, gets the warning once. The mutation fails it; the head passes. An owner flag, answered with its recommended option under the owner's standing instruction of 2026-11-10 ("fusiona todo.. y preguntas como recomendadas, y sgeuimos"), not put to the owner one by one; the owner may override it. Options: (a) pin the must-stay line in the new file, leaving T15's `theme-emission.test.js` unedited as T15 requires (and clear of MIG-B9-25, which may edit `test/webpack`); (b) add the test to `theme-emission.test.js`, against T15's "unedited". **Answer: (a).**
- **AC2's mutation "no `hotUpdate` fails T6" does not hold on Vite 7 as T6 was first written (a finding; the contract is not rewritten).** With `hotUpdate` removed, Vite 7.3.7's `handleHMRUpdate` falls back to the plugin's `handleHotUpdate` for a client `update`, so every dev step behaved as on the head (the review ran them all from the packed tarball). Only removing both hooks failed T6. T6 now wraps the plugin's HMR hooks and asserts that on Vite 7 `hotUpdate` is the hook that runs and returns the module (`/styles/main.uxdsl?uxdsl&lang.css` for V6, its importer `/main.js` for W1), and that `handleHotUpdate` is not called. With `hotUpdate` removed, T6 now fails (`hotUpdate returned the module for the fix: [{"hook":"handleHotUpdate",…}]`). An owner flag, answered the same way. Options: (a) pin the hook with a spy in T6, so AC2's mutation holds; (b) record that the mutation that holds is "no HMR hook" and leave `hotUpdate` unpinned. **Answer: (a).**
- **T1 did not prove C1 (a) (a finding on the test; fixed).** Its break was a Sass error in the partial itself, which the error names, so (b), `err.file`, recovered it alone: with the last-good record removed from the `catch`, T1 passed and only T3 failed. T1's partial now defines `$c`, which the module reads as `card.$c`; the break removes `$c`, so `Undefined variable.` is reported at `styles/main.uxdsl:2:`, and the test asserts that the error names the module and not the partial. Without the record, T1 now fails on both chains (`extract: the build after the partial is fixed: no webpack build within 20 s`), as do T3 and the per-compiler test below.
- **"Per compiler, never process-wide" was unpinned (a nit; now pinned).** A process-wide record passed every webpack test. `MIG-B9-39: webpack keeps a module's last successful files per compiler: another compiler's failed compile of the same module does not register them` runs one compiler twice (good, then failing at the module) and a second compiler once on the same project: the first compiler's failed compile registers the partial its good compile loaded, the second's does not. A process-wide record fails it, as does no record.
- **The CHANGELOG said the last good output is kept on every host (fixed).** style-loader's `dist/main.js` changes on each failure: webpack writes a bundle whose CSS module throws. The subsection now says that mini-css-extract-plugin's extracted CSS and `vite build --watch`'s output stay the last good ones, while a style-loader bundle carries the error until the fix.
- **webpack's watch in a test (the implementer's finding; fixed in the tests only).** webpack registers the project directory as a file dependency, and two things changed it right after a first build, each starting a spurious extra build: webpack creating `dist` inside it, and a project created next to one already watched (watchpack shares its directory watchers within a process). The tests pre-create `dist`, date every file and directory ten seconds back, and create all of a test's projects before any watcher starts.
- **T1's new break made it flaky under load (found by the deliverer's `npm test`; fixed in the test).** The first `npm test` after the change above failed T1 once (`style: the build after the partial is fixed: no webpack build within 20 s`), and 2 of 5 runs of `node --test test/webpack/*.test.js` failed it at load average 15 to 27: once the build after the break had no error, once the build after the fix still had the break's error. Both are an extra webpack build of the module from before the edit took effect, taken by the test as the build that carries the edit. The test from before the change passed 6 of 6 runs under the same load, and 10 of 10 instrumented runs of the new one passed, so the cause was not pinned down. T1's two waits now pass over builds that do not show the edit (`next(step, accept)`: the break's wait wants `Undefined variable.`, the fix's wants no error), and a wait that times out names the builds it passed over. The recovery claim is unchanged: without the last-good record no build without errors arrives, and T1 still times out. Afterwards, 8 runs of `node --test test/webpack/*.test.js` at load average 10 to 37: T1 passed 7. In the eighth, its first build timed out after the test had run for 909 s, and in three runs MIG-B9-20's watch test timed out after 510 to 991 s. Those durations mean the host was suspended, not that the tests failed. With the record removed, T1 still fails (`extract: the build after the partial is fixed: no webpack build within 20 s`).
- **Flag 4 carried out.** MIG-B9-25 merged first (PR #94, merged into this branch with `99f6a82`), so the two new test files now make their directories with its `temporaryDirectory` helper (`test/helpers/temporary-directory.js`). They keep their own last-in-first-out cleanup, so a watcher or server closes before its project is removed. A project is removed when its test passes, and kept with `temporary directory kept: <path>` printed when it fails, as the helper does. Both files leave `TMPDIR` empty (10 of 10 pass).
- **The same extra build on CI's ubuntu runner, in T2 to T4 (found by PR #96's first CI run; fixed in the tests).** Run 43726201875 failed T2 (the build after the module `@use`s the broken partial had no error), T3 (the build after the delete had no `Can't find stylesheet to import.`) and T4 (the build after the theme fix still had `UXD_THEME_INVALID`). The cause is the same as T1's: an extra build from before the edit, taken as the build that carries it. Every wait after an edit now passes over builds that do not show the edit (`clean`, or the expected error). `quiet(step, ms, file)` now fails when the watcher reports the unrelated file changed, through webpack's `invalid` hook or a build's `compiler.modifiedFiles`, rather than on any build in the window, so an extra build from the previous edit no longer trips it. The negative controls keep their meaning: a loader that registered the unrelated file would make the watcher report it. Locally, three runs of `node --test packages/uxdsl/test/webpack/*.test.js` passed, and `TMPDIR` was left empty.

### Delivery of 2026-11-15

New facts and follow-ups from the delivery. Each follow-up has a proposed story id.

- **F3 is not taken here, so it is MIG-B9-96 (decision 19 of 2026-11-15).** Giving the `CssSyntaxError` that `compile()` throws a `code` changes `compile.ts` or `diagnostics.ts`, which this story's must-stay list forbids. Under decision 19 it is registered as MIG-B9-96 when this story merges. Proposed: **MIG-B9-96**, as the decision says.
- **webpack runs an extra build of a module edited just before a build starts (follow-up for the test helpers).** It was seen locally under load and on CI's ubuntu runner. The new tests pass over it (§15, the two blocks above). The older watch tests in `test/webpack/loader.test.js` (MIG-B9-20's `in webpack watch mode the count covers modules the rebuild kept`) still take the next build as the one that carries an edit. Proposed: fold the same `next(step, accept)` into those tests, in **MIG-B9-19** (the story on watch tests) or a new story under an id the owner assigns (MIG-B9-98 was proposed for, and not given to, another item: decision 25).
- **The machine sleeps during long runs.** Three `npm test` and three `verify:1.0` runs were needed, and every failure outside this story's tests had a duration of 500 to 990 s. A workflow that runs `npm test` on this machine should keep it awake (for example `caffeinate -i`). For the owner; no story.
- **The fixtures' `packAndInstall` directories (flag 3)** stay in `TMPDIR` after `verify:vite-adapter`, `verify:webpack-adapter` and `verify:1.0`. They were removed by hand each time. MIG-B9-25's question 2 proposes the follow-up, which `fixtures/lib/tarball-consumer.js` would take. Proposed: the story decision 15's routing names, or **MIG-B9-25's follow-up**.
- **Vite 6 is untested.** `hotUpdate` is the hook on Vite 6 and later, and it was measured only on 7.3.7 and 7.3.8. Proposed: an install of `vite@^6` in `fixtures/vite-adapter`, in **MIG-B9-64** (on `vite.ts`) or a new story.

