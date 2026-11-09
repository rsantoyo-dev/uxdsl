# MIG-B9-23 — `compile()` within 1.5× of Dart Sass, wherever the project is

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | None (the owner's decision of 2026-11-02 on MIG-B9-13's AC1 asks for this story; it is recorded in MIG-B9-13 §15) |
| Status | In review (PR #75) |
| Size | S |
| Depends on | MIG-B9-13 |
| Blocks | MIG-B9-91 |
| Base | `feat/beta9` after MIG-B9-13 (`7aec3e0` or later), within §7 (§15, finding 1). Every comparison is against BASE, the story's own base (§3) |
| Owns | `packages/uxdsl/test/core/sass-stage-case.test.js` (new), `fixtures/mig-b9-23-compile-budget/` (new: `run.js`, `README.md`) |
| Shares | `packages/uxdsl/src/sass/compile-sass.ts` (`filesystem()`'s `realCase`; MIG-B9-12's module), `fixtures/sass-corpus/run.js` (P10's corrected method; the owner's decision D8 of 2026-11-04, §15), `packages/uxdsl/CHANGELOG.md` (the docs guard lists `compile-sass.ts` as a visual-default file), `packages/uxdsl/README.md` (one sentence) |
| Output impact | none |

## 1. Goal

P10's own runner, `node fixtures/sass-corpus/run.js`, passes on the machine
where P10 was measured. By P10's method, `compile()`'s median on Bootstrap
5.3.8 is at most 1.5× plain Dart Sass's on three invocations in a row. Except
where a symlink is on the path, it no longer depends on how many entries the
directories above the project hold. The corpus stays byte-identical to Dart
Sass, every parity oracle and every other output stays as it is, and
`npm test` stays green.

## 2. Sources

- MIG-B9-13 §5, P10 ([MIG-B9-13-compile-on-sass.md](MIG-B9-13-compile-on-sass.md)):

  > **P10 — Performance.** On the Bootstrap corpus the median of three runs of
  > the pipeline is at most 1.5× plain Dart Sass (`fixtures/sass-corpus/run.js`
  > asserts it); the playground's `uxdsl build` wall time before and after is
  > recorded in §14.

- MIG-B9-13 §9, AC1:

  > **AC1** `node fixtures/sass-corpus/run.js` exits 0 and prints
  > `byte-identical: true`, the timing ratio ≤ 1.5, the warning counts.

- P10's method, as `fixtures/sass-corpus/README.md` states it:

  > **Timing budget.** In one process, Dart Sass compiles `bootstrap.scss` three
  > times, then `compile()` compiles `bootstrap.uxdsl` three times; `compile()`'s
  > median must be at most 1.5 times Dart Sass's (FEAT-010, MIG-B9-13, P10).
  > `compile()` always runs Dart Sass with its source map, which plain Dart Sass is
  > not asked for. Every run's duration, both medians and the ratio are printed.
  > `--no-timing-budget` prints the same figures without asserting the ratio: the
  > release gate runs the corpus that way (`S-1`), since it does not control the
  > machine's load.

  `fixtures/sass-corpus/run.js` copies the corpus under
  `fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-sass-corpus-'))` and times
  `compile({ entry: path.join(corpus, 'bootstrap.uxdsl') }, { includeTheme: false })`.

- The owner's decision, MIG-B9-13 §15, "Owner decision of 2026-11-02":

  > - **Decided: merge now, and do the performance work after** (the option recommended to the owner):
  >   - PR #63 is merged into `feat/beta9` with AC1 recorded as not met on its timing half. The corpus stayed byte-identical: every delivery run printed `byte-identical: true`. The ratio was over 1.5× on four of the six delivery runs, three of them in a row (flag 1).
  >   - P10's 1.5× budget is carried by [MIG-B9-23](MIG-B9-23-compile-within-budget.md). That performance story brings the corpus to at most 1.5× and must pass before `0.5.0-beta.9` is published. In the option's words, it would cover the Sass stage, the plugin's fixed costs and the double theme discovery (K3).
  >   - The merge unblocks MIG-B9-14 and MIG-B9-15.

- MIG-B9-13 §15, "Delivery of 2026-11-02", owner flag 1:

  > 1. **AC1 / P10: the timing budget is not met at delivery.** On `b4227eb`, `node fixtures/sass-corpus/run.js` is byte-identical every time.
  >    - Its ratio exceeded 1.5× on three consecutive runs: 1.52×, 1.56× and 1.51× at 13:20, load average 2.5–2.8. That is the design's stop condition.
  >    - Three more runs at a load average of 6.3–7.0 gave 1.40×, 0.84× (Dart Sass's own runs were disturbed: 1,247/765/625 ms) and 1.57×.
  >    - The re-review's fixer measured 1.53×, 1.54× and 1.52× on the same commit.
  >    - I3's six runs at `e08e428` gave 1.53× (exit 1), then 1.47×, 1.46×, 1.23×, 1.46× and 1.47×. I1's three runs at `d708d85`, before the budget was asserted, gave 1.48×, 1.24× and 1.37×.
  >    - The gate's S-1 reported 1.42×, 1.40×, 1.51×, 1.52× and 1.59× without asserting.
  >    - The fix pass did not slow the pipeline: an interleaved A/B gave `compile()` 597–609 ms on `bcb1228` against 597–612 ms on `b4227eb`.
  >
  >    The breakdown, warm and interleaved, against plain Dart Sass at 307–322 ms:
  >    - Dart Sass with its own source map is 1.07×;
  >    - the Sass stage with its map is 1.38–1.40×, and without it 1.23–1.24×;
  >    - the plugin's pass adds about 64–70 ms;
  >    - `compile()` is 1.62–1.63× plain Dart Sass and 1.52× Dart Sass with its map.
  >
  >    The machine was never quiet: the owner's Chrome, VS Code and system agents were busy. As the design required, the method, the baseline, the always-on stage map and the plugin were not changed. Options:
  >    - (a) accept the incumbent method and re-measure on a quiet machine;
  >    - (b) budget against Dart Sass with its source map;
  >    - (c) schedule work on the plugin's fixed per-build costs: `validateTheme`, the reference pass's theme render, and the double theme discovery until MIG-B9-21 K3;
  >    - (d) restate P10.

- MIG-B9-21 §5, K3 ([MIG-B9-21-delete-what-repeats.md](MIG-B9-21-delete-what-repeats.md)):

  > **K3 — One theme resolution per compilation.** `compile()` accepts
  > `configRoot` and `discoverTheme` (the adapters' options today) and performs
  > discovery once, adding the theme file's own require tree to `dependencies`;
  > `vite.ts` and `webpack.ts` pass those options through instead of
  > discovering themselves; the plugin keeps discovery for the standalone path
  > (a `.css` file in a host's PostCSS) and skips it when `theme` is given, as
  > today. Net lines must go down; if they do not, K3 is dropped and the reason
  > recorded.

- The Sass stage's own contract, in the header of
  `packages/uxdsl/src/sass/compile-sass.ts`:

  > Canonical paths are normalized, have the on-disk
  > case on case-insensitive systems and keep symlinks, as Dart Sass's
  > filesystem importer does.

  and, further down the same header:

  > Nothing is shared between calls: every cache lives in one call's state,

  On darwin and win32, its `filesystem()`'s `realCase` spells each component
  of a path by listing the directory that holds it
  (`fs.readdirSync(realDir).filter((entry) => entry.toLowerCase() === lower)`).
  It does so for every loaded file and every ancestor directory, in every call.
- README §2: "No parallel parser, no duplicated default, no process-global
  cache."
- MIG-B9-12 §15, its RES-4 follow-up ([MIG-B9-12-compile-sass.md](MIG-B9-12-compile-sass.md)):

  > RES-4: on darwin, the canonical spelling of a symlinked directory written in another case, and NFD file names, differ from Dart Sass's `_realCasePath`, so a module can load twice. CI on ubuntu cannot exercise this.

## 3. Preconditions

```bash
git merge-base --is-ancestor 7aec3e0 HEAD                                    # MIG-B9-13 (PR #63) is in the base
test ! -f packages/uxdsl/src/scss-subset.ts                                  # compile() runs on Dart Sass
grep -q "fs.readdirSync(realDir)" packages/uxdsl/src/sass/compile-sass.ts    # the case lookup §4 measured
grep -q "sourceMap: true, sass: config.sass" packages/uxdsl/src/compile.ts   # the stage map on every build, as §4 measured (MIG-B9-13's flag 2 is open)
grep -q "const TIMING_BUDGET = 1.5;" fixtures/sass-corpus/run.js              # P10's runner and budget
test "$(sysctl -n hw.model)" = "MacBookPro18,3"                               # the machine where P10 was measured
```

All six exit 0 on `7aec3e0`, checked while drafting.

**BASE** is the `feat/beta9` commit the story's branch starts from:
`git merge-base HEAD origin/feat/beta9`. It moves only when the branch is
rebased onto a later `feat/beta9`, or merges one. §14 records it: the
commit the story started from, and each later one the branch moved to.
Every comparison in §4, §5, §8 and §9 is against BASE, not against
`7aec3e0`. A story that merges before this one can change `compile()`'s
results or a file this story keeps unedited: MIG-B9-20's M2 turns the
`includeTheme` option that `run.js` passes into a warning, MIG-B9-21's K3
adds a theme file's require tree to `dependencies`, and the proposals of §15
edit `fixtures/sass-corpus/run.js` and `compile-sass.test.js`. The figures
quoted from `7aec3e0` below are examples, re-recorded on BASE (§4, §14).

## 4. Baseline

```bash
for i in 1 2 3; do date; sysctl -n vm.loadavg; find "$TMPDIR" -mindepth 1 -maxdepth 1 | wc -l; node fixtures/sass-corpus/run.js; echo "exit=$?"; done
```

Run it on BASE and compare its output with the record below (README §1.5):

- **Compared, must match:** `byte-identical: true`, 276926 bytes, the 92 and
  87 files, the deprecation counts, the 21 warnings and the five mixed checks
  `ok`.
- **Recorded, not compared:** the timings, the ratio and the exit code, the
  load averages and the `$TMPDIR` count.

§14 records BASE's three runs. On a BASE later than `7aec3e0`, a compared
line that differs is a finding (§15), and BASE's figures are the ones §5
keeps: MIG-B9-20, for one, can change the warning count.

Recorded on `7aec3e0` by the profile of 2026-11-02, and by the plan's review
(runs 7 to 9):

- **The machine:** MacBookPro18,3 (Apple M1 Pro, 8 cores, 16 GB), macOS 27.0
  (26A428). It was never quiet: VS Code, Chrome and an endpoint security
  agent ran throughout.
- **The tools:** Node 20.19.0 and npm 11.21.1, CI's versions; `sass` 1.107.0;
  PostCSS 8.5.31.
- **`$TMPDIR`** (`/var/folders/kv/gp_3sskx7kb8vy0d00hyjgpr0000gn/T`) held
  129,944 entries when the profile started, 127,359 of them left by uxdsl's
  test suites (§15); 129,940 when it ended; 129,956 at the review's runs.

The first run's output, exactly:

```text
Bootstrap 5.3.8: 92 files renamed to .uxdsl, 87 loaded by the entry; Dart Sass 1.107.0
  Dart Sass: 276926 bytes, median 401 ms
  compile(): 276926 bytes, median 600 ms
  byte-identical: true
  Dart Sass runs: 656, 401, 332 ms; compile() runs: 1022, 600, 556 ms
  timing: compile()'s median is 1.49x Dart Sass's (budget 1.5x; compile() always runs Dart Sass with its source map)
  deprecation warnings Dart Sass delivered (capped at five per type, then a summary): {"import":5,"if-function":5,"global-builtin":5,"color-functions":5,"other":1}
  deprecation totals (verbose): {"import":87,"if-function":83,"global-builtin":154,"color-functions":6}
  compile() returned 21 warnings
  ok  Bootstrap's CSS is an unchanged prefix
  ok  .card-x reads its padding from density(4)
  ok  color(gray.900) resolves inside a Bootstrap-flavoured rule
  ok  a Surface per $theme-colors entry
  ok  a Button per mapped tone, Bootstrap's danger as UXDSL's error
```

Every run printed `byte-identical: true`, the same deprecation counts, 21
warnings and the five mixed checks `ok`:

| Run | Start (EST, 2026-11-02) | Load average (1, 5, 15 min) | `$TMPDIR` entries | Dart Sass runs (ms) | `compile()` runs (ms) | Medians (ms) | Ratio | Exit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 21:38:39 | 4.40 11.30 13.15 → 4.12 11.13 13.08 | not printed | 656, 401, 332 | 1022, 600, 556 | 401, 600 | 1.49× | 0 |
| 2 | 21:38:45 | 4.12 11.13 13.08 → 4.11 11.01 13.02 | not printed | 587, 422, 330 | 678, 612, 551 | 422, 612 | 1.45× | 0 |
| 3 | 21:38:50 | 4.11 11.01 13.02 → 4.03 10.88 12.96 | not printed | 608, 399, 329 | 681, 614, 560 | 399, 614 | 1.54× | 1: `FAIL  compile() is over the 1.5x budget` |
| 4 | about 22:11 | 2.27 4.18 4.99 | not printed | 571, 387, 326 | 1055, 602, 547 | 387, 602 | 1.56× | 1 |
| 5 | about 22:11 | 1.98 3.99 4.90 | not printed | 569, 379, 318 | 656, 587, 544 | 379, 587 | 1.55× | 1 |
| 6 | about 22:11 | 2.20 3.94 4.87 | not printed | 572, 382, 323 | 666, 598, 545 | 382, 598 | 1.57× | 1 |
| 7 | 22:59:24 | 1.65 3.21 3.02 → 1.76 3.21 3.02 | 129,956 | 575, 383, 328 | 669, 590, 555 | 383, 590 | 1.54× | 1 |
| 8 | 22:59:29 | 1.76 3.21 3.02 → 1.86 3.20 3.02 | 129,956 | 570, 400, 381 | 723, 602, 545 | 400, 602 | 1.51× | 1 |
| 9 | 22:59:34 | 1.86 3.20 3.02 → 2.11 3.23 3.03 | 129,956 | 572, 384, 331 | 670, 596, 549 | 384, 596 | 1.55× | 1 |

- Runs 1 to 6 are the profile's. Its script did not print the `$TMPDIR`
  count per run: the directory held 129,944 entries when the profile started
  and 129,940 when it ended.
- Runs 4 to 6 ran the same build through `--uxdsl <worktree>/packages/uxdsl`,
  interleaved with the prototypes of §7.
- Runs 7 to 9 are the plan review's, with the command above, on the same
  build.
- Every group of three had at least one exit 1, but runs 1 and 2 passed on
  their own: the base fails P10 here often, not on every invocation.

The breakdown, the location and the profile below put the corpus root, the
directory `run.js` makes (`corpus/`, `node_modules/`, `package.json`,
`package-lock.json`), in one of two directories. **The small directory**
holds the corpus root and nothing else. **The large directory** holds it
beside 129,944 empty entries, the size of that `$TMPDIR`.

**The breakdown.** One process, run from the worktree root, on the corpus
kept by `TMPDIR=<scratch> node fixtures/sass-corpus/run.js --keep --no-timing-budget`,
in the small directory. There were 3 warm-up rounds, then 15 rounds with the
order of the variants rotated each round, from 21:42:56 to 21:43:39 EST at
load 4.71–5.47. Every variant's CSS was byte-identical to Dart Sass's.

| Variant | Median (ms) | Spread (ms) | × plain Dart Sass |
| --- | --- | --- | --- |
| Plain Dart Sass, as `run.js` runs it: `sass.compile(bootstrap.scss, { style: 'expanded', logger })` | 315.9 | min 307.7, IQR 310.9–324.9, max 397.1 | 1.000 |
| Dart Sass with its source map (`sourceMap: true`) | 345.0 | min 332.5, IQR 340.8–355.2, max 390.2 | 1.092 |
| Dart Sass with the stage's map options (`sourceMap: true`, `sourceMapIncludeSources: true`) | 372.1 | min 355.2, IQR 357.2–396.2, max 529.7 | 1.178 |
| `compileSassStage` with its map | 379.9 | min 361.5, IQR 368.9–399.1, max 426.2 | 1.203 |
| `compileSassStage` without its map | 323.4 | min 314.0, IQR 319.8–343.6, max 418.1 | 1.024 |
| The PostCSS pass alone on the stage's output (`restoreDirectiveSpacing`, the plugin with `includeTheme: false`, `dropAnnotations`) | 74.8 | min 69.5, IQR 73.0–77.1, max 82.8 | 0.237 |
| `compile({ entry }, { includeTheme: false })`, end to end | 436.4 | min 424.9, IQR 430.6–442.7, max 512.3 | 1.381 |

**The location.** A copy of the same corpus root was also put in the large
directory, which then held 129,945 entries. Both copies ran interleaved in
one process, 11 rounds, at 21:47:57 EST, load 4.67–9.28:

| Variant | Median in the large directory (ms) | Spread (ms) | × plain Dart Sass | Against the small directory |
| --- | --- | --- | --- | --- |
| Plain Dart Sass | 316.8 | min 309.1, max 794.7 | 1.000 | +2.3 ms (314.5) |
| `compileSassStage` with its map | 472.6 | min 458.7, max 581.6 | 1.492 | +103.4 ms (369.2) |
| `compileSassStage` without its map | 421.5 | min 411.2, max 483.9 | 1.330 | +98.1 ms (323.4) |
| `compile()`, end to end | 545.7 | min 524.7, max 689.8 | 1.722 | +96.7 ms (448.9) |

**The profile.** V8's sampling profiler ran at a 250 µs interval, started
through the inspector after 4 warm-up runs. It sampled 20 warm `compile()`
runs (median 459.3 ms) in the small directory, at load 2.2–2.4. Per run:

| Module | Self (ms) | Total (ms) | Notes |
| --- | --- | --- | --- |
| Dart Sass (`sass.dart.js`) | 338.6 | 359.4 | plain Dart Sass profiled the same way: 290.1 of 318.8 |
| GC | 33.1 | 33.1 | plain Dart Sass: 19.8 |
| `postcss-value-parser` | 24.0 | 26.7 | self time by caller: `validateTheme`'s engines 8.4, the reference pass's theme render 7.9, `expandResponsive` 7.7 (it parses each value three times) |
| the engines the plugin calls | 18.1 | 37.2 | |
| `postcss` | 17.7 | 64.2 | parsing Dart Sass's 276,926 bytes: 9.4–9.7 |
| `node:fs` | 14.8 | 14.9 | plain Dart Sass: 8.0 |
| `plugin.ts` | 4.4 | 52.2 | `checkReferences` 20.9, `validateOptions` 14.8 (`validateTheme` 13.2), `expandResponsive` 13.2 |
| `compile-sass.ts` | 2.8 | 360.7 | `canonicalize` 14.1 (`realCase` 7.5–8.1), the importer's loads 6.3 |
| `protect.ts` | 2.2 | 2.9 | protect changed none of the 87 files Bootstrap's entry loads |

In the large directory, `node:fs` rose to 106.7 ms per run. Of that,
95.8 ms was one listing: `openStage` → `realCase` → `readdirSync` of the
large directory.

**The counts**, per warm `compile()` of the corpus in the small directory:

- `statSync` 1,205 (1,118 missing), `readdirSync` 103, `readFileSync` 87,
  `existsSync` 11, `realpathSync` 1.
- The 103 listings cover 17 directories: `corpus/` 44 times,
  `corpus/mixins` 25 times, `corpus/helpers` 12 times, `corpus/forms` 9
  times, and every ancestor once.
- Plain Dart Sass, warm: `existsSync` 860, `statSync` 86, `readFileSync` 87,
  and no listing. Its case cache is process-wide; on its first run only, it
  adds `lstatSync` 105 and `realpathSync.native` 87.
- Each call costs what it should on this machine: `statSync` 1.0–1.6 µs,
  `readdirSync` 24–49 µs on 22–49 entries. One listing of that `$TMPDIR`
  costs 112 ms warm and 430 ms cold, about 0.8 µs per entry.
- In the small directory, the base already meets P10 by its method:
  1.256–1.289× (6 processes).

## 5. Contract

- **C1 — The budget, by P10's method.** On the machine where P10 was
  measured, `node fixtures/sass-corpus/run.js` exits 0 on three consecutive
  invocations from the repository root.
  - The three are the first invocations after the last change to the Sass
    stage, run in a row. §14 records each one, and none is discarded or
    repeated.
  - The runner is BASE's, unedited: its method, its budget, its flags and
    its corpus location. In one process, Dart Sass compiles `bootstrap.scss`
    three times without a map, then `compile()` compiles `bootstrap.uxdsl`
    three times, and the medians are compared. The corpus sits under
    `os.tmpdir()`, whatever that directory holds.
  - Each invocation prints `byte-identical: true`, a ratio within the 1.5×
    budget and the five mixed checks `ok`.
  - Three in a row is stricter than MIG-B9-13's AC1, which asked for one
    invocation: the base passes some single invocations (§4, runs 1 and 2),
    so one passing invocation would not show the change.
  - The playground's `uxdsl build` wall time before and after is recorded in
    §14 (P10's own clause).
- **C2 — Wherever the project is.** On darwin, where P10 was measured,
  `compile()`'s time does not grow with the number of entries in the
  directories above the project, except a directory that holds a symlink on
  a loaded file's path: that one is listed to spell the symlink's own name.
  (win32 runs the same code, unverified: §6.)
  - The measure: in one process, two copies of the corpus root, one in a
    directory that also holds 129,944 empty entries and one alone in its
    directory (§4's large and small directories). `compile()` is called as
    `run.js` calls it, the two copies interleaved, with 2 warm-up rounds and
    then at least 9.
  - The two medians differ by at most 15 ms. On `7aec3e0` they differ by
    96.7 ms; plain Dart Sass's differ by 2.3 ms.
- **C3 — The output is unchanged.** For every input, `compile()` returns what
  it returns on BASE:
  - `css`, `map`, `dependencies` and `warnings` (text, file, line and column);
  - the same errors (code, message, file, line and column).

  So does `compileSassStage`, for its `css`, `map`, `loadedFiles` and
  `warnings`. Each loaded file keeps BASE's spelling:
  - on darwin and win32, each component spelled as its directory lists it;
  - a symlink kept, not resolved;
  - BASE's name where it differs from Dart Sass's (RES-4): a file stored in
    NFD and written in NFC keeps the written NFC name, and a symlinked
    directory written in another case keeps the link's own name as its
    directory lists it.
- **C4 — Per call.** Nothing the Sass stage learns about the filesystem
  outlives one call. When a file is renamed, in case only, between two
  `compile()` calls in one process, the second call spells it as the disk
  does, in `compile()`'s `dependencies` as in the stage's `loadedFiles`.

Must stay byte-identical with BASE. The figures are `7aec3e0`'s; §14
records BASE's, measured when the story starts (the corpus's by §4's
baseline):

- the corpus through `compile()`: 276,926 bytes, equal to Dart Sass's, in the
  three `sourceMap` modes (`'inline'` without its final comment);
- the corpus's external map, `dependencies` and warnings (21), against
  BASE's build;
- every parity oracle (`fixtures/parity/expected/**`), without `--update`;
- the playground's `src/app/uxdsl.css` (337,214 bytes, sha256
  `1f7eb19e7549…`), `src/generated/examples.json`, and the CLI and compiler
  captures;
- the gate's verdicts: S-1's `byte-identical`, S-2, S-3
  (`heavy.uxdsl:18:66`), N-02 and UX-20;
- `fixtures/sass-corpus/**` and `packages/uxdsl/test/core/compile-sass.test.js`,
  unedited from BASE;
- `DIAGNOSTIC_CATALOG`: BASE's codes (106), none added.

A problem with P10's method is a finding for the owner (§15), never a change
to C1.

## 6. Out of scope

- **K3,** one theme discovery and resolution per compilation: MIG-B9-21.
  Removing one discovery saves about 0.06–0.09 ms per `compile()` of the
  corpus, under 0.03% of it (§15). This story does not need it; whether
  it waits for MIG-B9-21's merge is §7's question (§15, finding 1).
- **The plugin's fixed per-build costs:** the reference pass on a stylesheet
  with no consumer, each value parsed three times, the theme rendered twice,
  `validateTheme`. Proposed as MIG-B9-24, after MIG-B9-20 and MIG-B9-21,
  which rewrite the same functions of `plugin.ts` (§7, §15).
- **The always-on stage map and its `sourcesContent`:** MIG-B9-13's owner
  flag 2 and MIG-B9-12's M1, both the owner's. If the owner changes either,
  the candidates go to MIG-B9-24 (§15).
- **Windows.** win32 folds case, and `realCase` runs there too; it is
  unverified: MIG-B9-91, with MIG-B9-13's flag 20.
- **RES-4,** where the stage's spelling differs from Dart Sass's on darwin (a
  symlinked directory written in another case, NFD names): the follow-up
  listed in MIG-B9-12 §15. This story keeps BASE's results (C3).
- **The temporary directories the suites leave** (127,359 entries in that
  `$TMPDIR`): proposed as MIG-B9-25 (§15). Emptying `$TMPDIR` is never a
  means to C1.
- **P10's method** (the cold first run inside the median, the order of the
  runs, the location, the load): the owner's (§15).
  `fixtures/sass-corpus/run.js` stays as it is.
- **What the profile shows is not `compile()`'s:**
  - Dart Sass's own compile, which `compile()` runs with the stage's map
    options: about 360–372 ms of `compile()`'s 436–459 ms in the small
    directory (§4's breakdown and profile), where plain Dart Sass takes
    316 ms. It is not UXDSL's code, and P10 measures against it.
  - The machine's load, and the runner's `npm install` of Bootstrap.

## 7. Approach and traps

Non-normative. The candidates, ranked by the profile's evidence. The
prototypes' diffs stay in the profile's scratch evidence, outside the
repository.

1. **Spell a path as Dart Sass's `realCasePath` does.** This is
   `compile-sass.ts`'s `filesystem().realCase`, used by `openStage` and
   `canonicalize`:
   - for a component that is not a symlink (`lstatSync`), take the case from
     `fs.realpathSync.native` of the loaded file, one call per file, and let
     each ancestor take its case from that realpath's `dirname`;
   - list a directory only to spell a symlink's own name;
   - keep the cache per call.

   Measured:
   - At P10's location, `run.js` gave 1.25×, 1.26× and 1.30× (exit 0 three
     times), against 1.56×, 1.55× and 1.57× (exit 1 three times) for the
     base, interleaved, at load 2.0–2.3.
   - `compile()`'s warm median went from 532.0 to 425.7 ms in the large
     directory (1.734× → 1.388×), and from 437.4 to 425.6 ms in the small
     one (9 rounds, load 2.2–3.6).
   - The prototype is a 28-line diff, and the corpus stayed byte-identical.
     Through a symlinked ancestor and three miscased spellings of the entry,
     the stage's `loadedFiles`, map and warnings, and `compile()`'s CSS,
     external map and `dependencies`, were the base's.
   - It lacks the NFD guard of the traps below. It takes the realpath's
     basename unconditionally, so a file stored in NFD and written in NFC
     comes out with its NFD name, where the base keeps the written NFC one
     (the plan review's check, §15). As measured, it does not meet C3.
   - The realpath change alone was not run through the suites. In
     combolazy (the realpath change, the reference pass skipped, the stage
     map built on request and the `(` skip), every package suite and the
     parity oracles equal the unmodified copy, whose one top-level failure
     (MIG-B6-27's schema check) every copy shares. In combo (the same, with
     the map without `sourcesContent` in place of the map on request), core
     gave 335 of 337: the `sourcesContent` change fails MIG-B9-12's
     `sourceMapIncludeSources` option test, and that is the only difference.

   It meets C1 with a margin of about 0.2× by P10's method; the warm
   steady-state ratio is still 1.39×. Of all the candidates, it is the only
   one that meets C2.
2. **Read each directory once per call.** This keeps the listing and caches
   it per directory, for 11–15 ms. It still lists the large directory, so it
   fails C2: it is not an alternative to 1.
3. **Not in this story.** Each needs the owner or another story (§6, §15):
   - the stage map built only when a map is requested: 52 ms (MIG-B9-13's
     flag 2);
   - Dart Sass's map without `sourcesContent`: 26–31 ms (MIG-B9-12's M1 and
     its options test);
   - the reference pass skipped when nothing can be reported: 29–30 ms
     (`plugin.ts`, MIG-B9-24);
   - a value with no `(` skipped by `expandResponsive`: 11.5–12.6 ms
     (MIG-B9-24);
   - one theme render per compilation: 8.5–13 ms, estimated (MIG-B9-24);
   - K3: about 0.06–0.09 ms (MIG-B9-21).

   With 1, the plugin's two output-free changes and the map without
   `sourcesContent`, the prototypes gave 1.14×, 1.00× (Dart Sass's own runs
   disturbed) and 1.13× by `run.js`. With the stage map built only on request
   in place of the `sourcesContent` change, they gave 1.01×, 1.04× and 1.03×.

Traps:

- **Do not port Dart Sass's cache.** Its `_realCaseCache` is process-wide.
  The stage's header ("Nothing is shared between calls") and README §2 forbid
  one, and C4 tests it.
- **Keep BASE's spelling where Dart Sass's differs** (C3, RES-4):
  - On BASE a name is the one entry of its directory equal to it under
    `toLowerCase()`. With no such entry, or more than one, it is the name as
    written.
  - A realpath can return a name that compares differently, such as an NFD
    name for an NFC spelling. Keep the written name there, as BASE does. The
    measured prototype does not: it takes the realpath's basename
    unconditionally, and T9 fails it.
  - A symlink keeps its own name, and its target's names must not leak into
    the spelling of the link's ancestors. That is why Dart Sass checks every
    component with `lstat`.
  - A path whose realpath fails keeps its spelling, as the listing's `catch`
    did.
- **The cost is darwin's and win32's.** On Linux `FOLDS_CASE` is false and
  `realCase` returns its argument, so CI on ubuntu exercises none of this.
  S-1's 1.09× there measures another code path. Only the machine where P10
  was measured gives evidence for C1, C2 and C4.
- **Do not make the budget by changing the environment.**
  - Run `run.js` with `$TMPDIR` as you find it.
  - Record its entry count, the start time and `sysctl -n vm.loadavg` with
    every timing.
  - Do not re-run a failing invocation: C1 counts the first three after the
    last change to the Sass stage.
  - The machine is never quiet, so do not wait for quiet. On the base, a
    lower load did not bring the ratio under 1.5×: 1.56×, 1.55× and 1.57× at
    load 2.0–2.3, and 1.54×, 1.51× and 1.55× at load 1.65–2.11.
- **The fixture removes what it creates,** C2's 129,944 empty entries
  included, which it makes inside its own temporary directory. Unlike the
  suites (§15), it leaves nothing behind.
- **So does the new unit test.** `sass-stage-case.test.js` removes every
  directory it creates, symlinks and renamed files included (`t.after`),
  unlike `compile-sass.test.js`'s `project()`.
- **Compare with the base build, not only with Dart Sass.** Byte identity
  with Dart Sass does not cover `map`, `dependencies` or how a loaded file is
  spelled. T4 compares them with a build of BASE made in a scratch worktree.

Stop rule: if C1 or C2 cannot be met by changing the Sass stage alone, with
every output of §5's byte-identical list kept, stop. Set the story to Blocked
with the measurements in §15 (README §2, "Authority"); the owner decides. The
owner can fold in MIG-B9-24's candidates (with their §7 order), answer
MIG-B9-13's flag 2, amend MIG-B9-12's M1, or restate P10. Never edit
`fixtures/sass-corpus/run.js`'s method, budget or flags, empty `$TMPDIR`, or
change a test's assertion to make the budget.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `fixtures/sass-corpus/run.js` (unedited from BASE), the first three invocations after the last change, in a row | its own output: `byte-identical: true`, `timing: compile()'s median is …x`, the five mixed checks | fixture | C1 | T2's slow wrapper |
| T2 | `fixtures/mig-b9-23-compile-budget/run.js` (new; run by hand, since it installs Bootstrap) | `MIG-B9-23: run.js fails a compile() 250 ms slower per call, and one that changes a byte (negative control)` | fixture | C1, C3 | itself: `run.js --uxdsl <wrapper>` must exit 1, with `FAIL  compile() is over the 1.5x budget` for the slow wrapper and `byte-identical: false` for the changed byte |
| T3 | same | `MIG-B9-23: compile()'s median on the corpus moves at most 15 ms when the directory that holds the corpus root also holds 129,944 empty entries` | fixture | C2 | a wrapper that, on each `compile()` call, lists the directory that holds the compiled copy's corpus root, as the base does, fails the check |
| T4 | same, with `--base <dir>` (a build of BASE, made in a scratch worktree) | `MIG-B9-23: the corpus through compile() equals the base build's css, map, dependencies and warnings in the three sourceMap modes` | fixture | C3 | a wrapper that changes the case of one `dependencies` entry fails it |
| T5 | `packages/uxdsl/test/core/sass-stage-case.test.js` (new; it removes every directory it creates, `t.after`) | `MIG-B9-23: on darwin and win32 the Sass stage lists no directory to spell a path component that is not a symlink` | unit | C2 | through a symlinked directory the count is not 0, because the symlink's own directory is listed: the counter sees listings. Skipped on other platforms, with the reason |
| T6 | same | `MIG-B9-23: the Sass stage spells a file as the disk does in each call, in compileSassStage's loadedFiles and compile()'s dependencies: an entry written in three cases, a symlinked ancestor, a case-only rename between two calls` | unit | C3, C4 | the two calls around the rename must spell the file differently, which a cache kept across calls would not. Skipped on other platforms, with the reason |
| T7 | `packages/uxdsl/test/core/compile-sass.test.js` (MIG-B9-12's, unedited) | the Dart Sass twin comparisons: two spellings of one file, a symlinked `node_modules`, `..` under load paths | unit | C3 | — |
| T8 | `fixtures/parity/run.js`, `npm test`, `npm run verify:1.0 -- --skip-playground-walk`, `npm --prefix packages/playground-nextjs run uxdsl:build` | unchanged outputs | all | C3 | — |
| T9 | `packages/uxdsl/test/core/sass-stage-case.test.js` | `MIG-B9-23: where Dart Sass spells a file differently, the Sass stage keeps BASE's spelling (RES-4), in loadedFiles and compile()'s dependencies: a file stored in NFD and written in NFC keeps the written name, a symlinked directory written in another case keeps the link's own name` | unit | C3 | the test first asserts that `fs.realpathSync.native` returns the file's NFD name, so a `realCase` that takes the realpath's basename unconditionally (the profile's prototype) fails it. Skipped on other platforms, with the reason |

C2's tests, T3 and T5, are the failing-first tests (README §2): on BASE,
T3's two medians differ by about 97 ms and T5 counts listings, on every run,
and both pass after the change. C1's test does not fail on BASE every time.
`run.js` fails there only with `$TMPDIR` as found, about 130,000 entries on
this machine, and only as three consecutive invocations: §4's runs 1 and 2
passed on their own. C3 and C4 state what the change must keep: their tests
pass on the base by design, and each negative control shows that its test
can fail.

## 9. Acceptance criteria

BASE below is `git merge-base HEAD origin/feat/beta9` (§3).

- **AC1** On the machine where P10 was measured (`sysctl -n hw.model` prints
  `MacBookPro18,3`), `node fixtures/sass-corpus/run.js` exits 0 on three
  consecutive invocations from the repository root.
  - The three are the first invocations after the last change to the Sass
    stage, run in a row; none is discarded or repeated.
  - Each prints `byte-identical: true`, a ratio within the 1.5× budget and
    the five mixed checks `ok`.
  - §14 records each invocation's start time, load average, `$TMPDIR` entry
    count and output.
  - Test file: `fixtures/sass-corpus/run.js`, unedited from BASE
    (`git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- fixtures/sass-corpus`
    exits 0).
  - Mutation: a `compile()` 250 ms slower per call (T2's wrapper) exits 1.
    So does the base's `realCase` at P10's location, with about 130,000
    entries in `$TMPDIR`, though not on every invocation. Runs 1 to 3 of §4
    exited 0, 0 and 1 (1.49×, 1.45×, 1.54×), and runs 4 to 6 and 7 to 9
    exited 1 each: each group of three fails AC1, but runs 1 and 2 passed on
    their own. AC2's T3 is the deterministic mutation.
- **AC2** `node fixtures/mig-b9-23-compile-budget/run.js --base <a build of BASE>`
  exits 0 and prints `ok` for T2's two controls, T3 with its planted
  control, and T4 in the three `sourceMap` modes.
  - Test file: `fixtures/mig-b9-23-compile-budget/run.js`.
  - Mutation: the base's `realCase` fails T3 (+96.7 ms on `7aec3e0`, §4).
- **AC3** `node --test packages/uxdsl/test/core/sass-stage-case.test.js`,
  run with `TMPDIR` set to an empty scratch directory, exits 0 on darwin,
  with T5, T6 and T9 run, not skipped, and leaves that directory empty.
  - Test file: `packages/uxdsl/test/core/sass-stage-case.test.js`.
  - Mutations: the base's `realCase`, which lists a directory for each
    component, fails T5; the profile's prototype, which takes the
    realpath's basename unconditionally, fails T9.
- **AC4** `node --test packages/uxdsl/test/core/*.test.js` exits 0, and
  `git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- packages/uxdsl/test/core/compile-sass.test.js`
  exits 0.
  - Test files: `compile-sass.test.js` and `sass-stage-case.test.js`.
  - Mutation: a `realCase` that returns the path as written fails
    `compile-sass.test.js`'s "two spellings of one file".
- **AC5** `node fixtures/parity/run.js` exits 0 without `--update`, and
  `git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- fixtures/parity/expected`
  exits 0.
  - Test file: `fixtures/parity/run.js`.
  - Mutation: none; an invariant guard, like C3.
- **AC6** `npm test` exits 0, and
  `npm run verify:1.0 -- --skip-playground-walk` exits 0 with S-1, S-2, S-3,
  N-02 and UX-20 `ok`.
  - Test files: the suites `npm test` runs, and `fixtures/release-1.0/run.js`.
  - Mutation: AC4's, which `npm test` runs; `verify:1.0` is an invariant
    guard, like C3.
- **AC7** `npm --prefix packages/playground-nextjs run uxdsl:build` exits 0
  and prints `unchanged src/app/uxdsl.css`. §14 records
  `/usr/bin/time -p npx uxdsl build` in `packages/playground-nextjs`: three
  runs on BASE's build and three after (P10's clause).
  - Test file: the playground's `uxdsl:build`, which compares its output with
    the committed `src/app/uxdsl.css`.
  - Mutation: none; an invariant guard, like C3.

Owner checks, never marked PASS by the agent:

- Decide the findings on P10's method (§15, finding 2). C1 keeps P10's
  method as written until the owner says otherwise.
- Decide whether MIG-B9-91 runs P10's method again, asserted, on this
  machine before the publish (§15, finding 3).

The scope (§15, finding 1) is not an owner check here: it is answered in this
plan's review, before the story starts.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes: `compile-sass.ts` is in `VISUAL_DEFAULT_FILES`, so the docs guard requires it in the same commit; one subsection under `## 0.5.0-beta.9 — unreleased`, with `### Visual changes`: none |
| package README | yes (the guard): one sentence |
| `verify-docs-update.js` classification | no (no file added under `src`) |
| `npm run generate:language` | no |
| `AGENTS.md` + agent guide | no |
| `DIAGNOSTIC_CATALOG` | no |
| `npm run generate:capabilities` | no |
| playground `uxdsl:build` + captures | run, with no change expected (`unchanged src/app/uxdsl.css`; `npm test` checks the captures) |
| `migration.md` | no |

## 11. Documentation

- `packages/uxdsl/CHANGELOG.md`: one subsection under
  `## 0.5.0-beta.9 — unreleased`. It says that on macOS and Windows
  `compile()` lists a directory only to spell a symlink's own name, so its
  time no longer depends on how many entries the directories above the
  project hold, and it has `### Visual changes`: none.
- `packages/uxdsl/README.md`: one sentence beside the Sass pipeline
  paragraph.
- `fixtures/mig-b9-23-compile-budget/README.md` (new): what the fixture runs,
  its network use, the `--base` build and the controls.

`fixtures/sass-corpus/README.md` is unchanged, like the runner.

## 12. Verification

```bash
node fixtures/sass-corpus/run.js                                     # the first 3 after the last change, in a row, each with date, sysctl -n vm.loadavg and the $TMPDIR count; exit 0 each
node fixtures/mig-b9-23-compile-budget/run.js --base <dir>           # exit 0; network
TMPDIR=<empty dir> node --test packages/uxdsl/test/core/sass-stage-case.test.js  # exit 0 on darwin, nothing skipped; <empty dir> stays empty
node --test packages/uxdsl/test/core/*.test.js                       # exit 0
node fixtures/parity/run.js                                          # exit 0
npm test                                                             # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                         # background; exit 0
npm --prefix packages/playground-nextjs run uxdsl:build              # exit 0; unchanged src/app/uxdsl.css
(cd packages/playground-nextjs && /usr/bin/time -p npx uxdsl build)  # 3 runs on BASE's build, 3 after
```

## 13. Delivery

Branch `feat/b9-23-compile-within-budget`. Commit:
`perf(FEAT-010): MIG-B9-23 - the Sass stage spells a path from its realpath, so compile() is within 1.5x of Dart Sass wherever the project is`.

PR title: `FEAT-010: MIG-B9-23 - compile() within 1.5x of Dart Sass, wherever the project is`.
The body:

- **Goal:** §1, in two sentences.
- **C1:** the three outputs of `run.js`, each with its start time, load
  average and `$TMPDIR` entry count.
- **C2:** T3's two medians, and its control's.
- **C3 and C4:** T4 against BASE (its SHA); parity, `npm test`,
  `verify:1.0`, and `uxdsl.css` unchanged.
- **Not run, or not a pass:** Windows, and what CI cannot show (§7).
- **Owner checks:** the list in §9.
- The last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 14. Closure record

Delivered in one PR (#75), from `feat/b9-23-compile-within-budget`, by the light flow the owner chose for an S story on 2026-11-04 (FEAT-010 §2, D1): one scout, one implementer, one review and the deliverer. Where this record differs from §5 to §9, the owner's decisions of 2026-11-04 rule (§15), D8 first: P10's method is corrected and the budget stays 1.5×. The scout's report, the implementer's evidence and the review stay with the run's evidence outside the repository. What they decided is summarized below.

- **Base and merges.**
  - The story started from `feat/beta9` at `4ecdc51` (wave 1 complete).
  - Before the PR, `origin/feat/beta9` had moved to `7e8d7b4` (PR #74, the owner's decisions of 2026-11-08, documentation only). It was merged into the branch as `4401f7b`, a merge commit with no rebase or force-push. BASE is now `7e8d7b4`.
  - `packages/`, `fixtures/` and `tsconfig.base.json` are identical at `4ecdc51` and `7e8d7b4`, so every comparison with a build of `4ecdc51` is a comparison with BASE. The merge changes no file this story edits.
  - The story commits:
    - by the implementer: `1038d94` (D8's runner), `0f6f5d9` (the Sass stage, its tests, the fixture, the CHANGELOG and the README) and `4248603` (the fixture's 61-round default and its order);
    - by the deliverer: `f442d02` (the review's fixes), `4401f7b` (the merge) and this record.
- **Environment.**
  - MacBookPro18,3: Apple M1 Pro, 8 cores, 16 GB; macOS 27.0 (26A428, Darwin 27.0.0).
  - Node 20.19.0 and npm 11.21.1, CI's versions. Dart Sass 1.107.0 and PostCSS 8.5.31 in the repository.
  - Every command ran with `TMPDIR` set to a scratch directory of the role's own, except the AC1 triple. That ran with the owner's `$TMPDIR` as found, as C1 says; the corrected runner does not use it.
  - The scout prepared the worktree as `ci.yml` does, and every step exited 0. `npm run prepare` installed husky's hooks, so the pre-commit hook (the docs guard, then the full playground build) ran on every commit. No commit used `--no-verify` or `HUSKY=0`.
  - Running throughout and not touched: the owner's dev servers (story-radar's `next dev` and `uxdsl watch`; the playground's `next dev` in the owner's checkout), the endpoint security agent, and MIG-B9-22's workflow in its own worktree. Before each timing that counts, the deliverer waited until none of that workflow's tests, builds or fixtures was running and the 1-minute load was below 6.
- **Preconditions (§3).**
  - On `4ecdc51` all six exit 0 (the scout).
  - On the head, line 3 exits 1, because this story replaced the case lookup it pins. The other five exit 0.
- **Baseline (§4), re-recorded by the scout on `4ecdc51` on 2026-11-08.**
  - P10's runner as written, with `$TMPDIR` holding 130,041 entries, exited 1, 0, 1 (1.57×, 1.49×, 1.56×). Every compared line matched §4.
  - The location A/B: `compile()` +140.3 ms beside 129,944 entries, plain Dart Sass +1.7 ms. 103 `readdirSync` per warm `compile()`.
  - The playground's `uxdsl build`: real 2.04, 1.54 and 1.00 s.
  - The core suite: 337 tests, 336 pass, 1 skipped. `DIAGNOSTIC_CATALOG` holds 106 codes.
- **Failing test first.** Each test below was run against the base before the change it guards:
  - `run.test.js`'s two D8 tests, against the base runner: 4 pass, 2 fail (`undefined !== 4`, because `ROUNDS` does not exist, and `freshCorpusRoot is not a function`).
  - T5 and its control, with `TMPDIR` empty, on the base build: T5 fails with 17 listings over 14 directories, from `/` down. The control fails because the base lists every ancestor, not only the directory that holds the symlink. T6, T9 and T9b pass on the base, by design.
  - T3, with `--uxdsl <base build>`: FAIL at +142.6 ms (11 rounds) and +145.7 ms (61 rounds). T2, T4 and the planted control are ok.
  - The review's R1 test (a whole run of `runCorpus()` on fakes) fails under each of the review's three mutations of the runner: the cold runs in the medians, the root under `os.tmpdir()`, and no alternation.
  - The review's R3 case in T6 fails under the mutant that spells a symlink's directory from the target's, and passes on the base and the head.
- **Contract as delivered.**
  - **C1, by D8's method.** `fixtures/sass-corpus/run.js` exits 0 on the triple below.
    - Dart Sass and `compile()` alternate, Dart Sass first, four runs each. Each first, cold run is printed as discarded and left out of the median.
    - The corpus root is `fixtures/sass-corpus/.work/run-XXXXXX/corpus-root`: git-ignored, alone in its directory, outside `os.tmpdir()`, removed unless `--keep`.
    - Unchanged from P10: `TIMING_BUDGET = 1.5`, the plain Dart Sass baseline without a map, the timed `compile({ entry }, { includeTheme: false })`, the flags, the byte comparison, the deprecation counts and the five mixed checks.
    - `main()` is a thin shell around an exported `runCorpus()` (review R1).
  - **C2.** T3 moves +0.7 ms. On darwin a directory is listed only to spell a symlink's own name.
  - **C3.** T4 is equal to the base in 9 of 9 combinations. The three spellings where Dart Sass differs stay the base's, pinned by T9 and T9b:
    - a name stored in NFD and written in NFC;
    - a symlinked directory written in another case;
    - a name in a directory that cannot be listed (execute-only).
  - **C4.** Every cache lives in one `filesystem()`, made per call. T6's case-only rename between two calls is spelled as the disk spells it.
  - **The fixture directory.** `git diff --name-only 7e8d7b4 -- fixtures/sass-corpus` lists `.gitignore`, `README.md`, `run.js` and `run.test.js`; `_uxdsl-extras.uxdsl` is unedited.
- **Deviations from the plan.**
  - **The fixture's T3** takes 61 measured rounds by default, not 11 (C2 allows any number from 9), and it runs last, after its planted control. With 11 rounds, this machine's spread falsely failed 9–25% of bootstrap draws (§15).
  - **Test titles.**
    - T9b's title ends "(an execute-only directory)", which states behavior where the plan's ending stated history.
    - T5's negative control is a test of its own. It also asserts that the only directory listed is the one that holds the symlink.
  - **`run.js`'s exports.** Beyond the plan: `installCorpus` (which the fixture reuses), `removeCorpusRoot`, `WORK` and `runCorpus`.
  - **The Sass stage.** The plan's `realCase(file, real?)` is an internal `spell(file, real?)`, exposed as `realCase: (file) => spell(file)`. A short-circuit, `onDisk !== base`, comes first, so `accessSync` runs only for a name written in another case: 0 calls per warm `compile()` of the corpus.
- **The review and its outcome.** One review read `4248603`. It raised R1 to R3 as should-fix and R4 as a nit. The deliverer reproduced each one before fixing it, in `f442d02`:
  - **R1, fixed.**
    - Reproduction: three mutations of `main()` (the cold runs in the medians, the root under `os.tmpdir()`, no alternation) each passed `run.test.js` 6 of 6.
    - Fix: `runCorpus()` takes the install, Dart Sass, `compile()`, the clock and the output. A new `run.test.js` test runs it whole on fakes, and each mutation now fails it.
    - The fixture's T2 also checks, in both of its runner runs:
      - the corpus-root line;
      - four runs of each compiler, the first marked cold;
      - a printed ratio equal, within rounding, to the three warm runs' medians.

      The parser was checked on a real output and on five planted variants.
  - **R2, resolved by the order of the runs.** R1's fix edits `run.js`, so the count of invocations restarted at `f442d02`. The AC1 triple below is the first three invocations after it.
    - Before `f442d02`, after the last Sass-stage change `0f6f5d9`, the runner had been invoked 13 times:
      - once plain, by the implementer, at 2026-11-08 21:32:48 EST (1.25×, exit 0);
      - 6 times by the implementer's T2 wrappers, at 21:33, 08:52 and 09:01 (the last two around the base build);
      - 6 times by the review's T2 wrappers, at 09:31:23, 09:34:33 and 09:38:13.
    - After the triple, AC2's T2 invoked it twice (wrapped) and `verify:1.0`'s S-1 once (`--no-timing-budget`).
  - **R3, fixed.**
    - Reproduction: the mutant `spell(dir, path.dirname(real))` in the symlink branch passed all 5 stage tests.
    - Fix: T6 adds `links/Link` → `targets/t`, written `LINKS/Link/entry.uxdsl` and reached by `@use "LINKS/LINK/part"`. The head and the base spell `links/Link/…`, the mutant `LINKS/Link/…`, so the mutant now fails T6. The fixture's T4 also writes the link's directory in another case.
  - **R4, fixed.** The package README sentence names the spellings kept as written, and says that a directory holding a symlink on a loaded file's path is still listed.
- **Final verification, on `4401f7b`, by the deliverer, on 2026-11-09.** The commands ran in this order. `4401f7b` is the head before this record, whose commit changes only `docs/features/FEAT-010`.

  | Command | Exit | Result |
  | --- | --- | --- |
  | AC1 `node fixtures/sass-corpus/run.js`, three in a row | 0, 0, 0 | See the triple below. |
  | AC2 `node fixtures/mig-b9-23-compile-budget/run.js --base <build of 4ecdc51>` (11:52:33–11:55:13 EST) | 0 | `All checks ok.` T2: 1.99× and `FAIL  compile() is over the 1.5x budget`; `byte-identical: false`; the method check ok. T4: 9 of 9 equal (276,926 bytes, 792,018 inline, 87 dependencies, 21 warnings), and its control differs. T3: see C2 below. `TMPDIR` and `.work` were left empty. |
  | AC3 `TMPDIR=<empty dir> node --test packages/uxdsl/test/core/sass-stage-case.test.js` | 0 | 5 tests, 5 pass, 0 skipped; the directory stays empty |
  | `node --test fixtures/sass-corpus/run.test.js` | 0 | 7 of 7 (the 4 tests of MIG-B9-13 and 3 of this story) |
  | AC7 `npm --prefix packages/playground-nextjs run uxdsl:build` (12:05:58) | 0 | `[uxdsl] unchanged src/app/uxdsl.css` (337,214 bytes, sha256 `1f7eb19e75490097…`); `examples.json` sha256 `57f326055f415f11…` unchanged |
  | AC7 `/usr/bin/time -p npx uxdsl build` ×3, in `packages/playground-nextjs` (12:06:01–12:06:03, load 3.19–3.50) | 0, 0, 0 | real 1.11, 1.04 and 1.04 s (user 1.66–1.69, sys 0.12–0.13). The base, by the scout: 2.04, 1.54 and 1.00 s. The implementer, after: 1.01, 0.92 and 0.94 s. |
  | AC4 `node --test packages/uxdsl/test/core/*.test.js` | 0 | 342 tests, 341 pass, 0 fail, 1 skipped (protect's Bootstrap test without `UXDSL_SASS_CORPUS`, as on the base) |
  | AC4 `git diff --exit-code 7e8d7b4 -- packages/uxdsl/test/core/compile-sass.test.js` | 0 | unedited |
  | AC5 `node fixtures/parity/run.js`; `git diff --exit-code 7e8d7b4 -- fixtures/parity/expected` | 0; 0 | `PASS: 10 parity case(s)`; expected unchanged |
  | AC6 `npm test` (12:06:42–12:09:58) | 0 | 1,538 tests: 1,537 pass, 0 fail, 1 skipped, no `not ok`. `Captured CLI and compiler output is up to date.`, `Compiled examples are up to date (11).`, parity `PASS`, mig07 `All checks passed.` |
  | AC6 `npm run verify:1.0 -- --skip-playground-walk` (12:09:58–12:11:47) | 0 | `71/71 automated checks passed.` The tarball is 272,626 bytes packed, 92 files. S-1 says `byte-identical, the five mixed checks ok; compile() 1.35x Dart Sass (reported, not asserted)`. S-2, S-3 (`heavy.uxdsl:18:66`), N-02 and UX-20 are ok. |
  | Invariants | — | `DIAGNOSTIC_CATALOG` holds 106 codes; `grep -c "const TIMING_BUDGET = 1.5;" fixtures/sass-corpus/run.js` prints 1; `git status --short` is empty after every run |

- **The AC1 triple (C1).**
  - Which runs count: the first three invocations of the runner after its last change (`f442d02`, 2026-11-09 09:59:53 EST), from the repository root, one after another. None was discarded or repeated.
  - When: the moment was chosen before the first one started. The 1-minute load had been below 6, with no test, build, fixture or install running, for 60 s, from 11:26:42 EST.
  - `$TMPDIR` is the owner's, as found: 3,411 entries before and after each one. The scout counted 130,041 there on 2026-11-08, before someone else removed the suites' entries.

  | # | Start (EST) | `vm.loadavg` | `$TMPDIR` | Dart Sass runs, ms | `compile()` runs, ms | Warm medians | Ratio | Exit |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | 1 | 11:26:42 | 2.09 3.96 5.49 | 3,411 | 613 (cold, discarded), 341, 323, 319 | 633 (cold, discarded), 482, 429, 430 | 323 / 430 | 1.33× | 0 |
  | 2 | 11:26:48 | 2.64 4.04 5.51 | 3,411 | 587 (cold, discarded), 348, 329, 351 | 633 (cold, discarded), 498, 447, 454 | 348 / 454 | 1.31× | 0 |
  | 3 | 11:26:54 | 2.59 4.01 5.49 | 3,411 | 588 (cold, discarded), 350, 323, 321 | 636 (cold, discarded), 494, 437, 439 | 323 / 439 | 1.36× | 0 |

  Each invocation printed:
  - `Bootstrap 5.3.8: 92 files renamed to .uxdsl, 87 loaded by the entry; Dart Sass 1.107.0`;
  - `corpus root: …/fixtures/sass-corpus/.work/run-XXXXXX/corpus-root (fresh, alone in its directory, outside the temporary directory)`;
  - `Dart Sass: 276926 bytes` and `compile(): 276926 bytes`, then `byte-identical: true`;
  - the runs line and `timing: compile()'s median is <r>x Dart Sass's (budget 1.5x; each median is of the 3 warm runs, the cold first run left out; compile() always runs Dart Sass with its source map)`;
  - the deprecations delivered, `{"import":5,"if-function":5,"global-builtin":5,"color-functions":5,"other":1}`, and the verbose totals, `{"import":87,"if-function":83,"global-builtin":154,"color-functions":6}`;
  - `compile() returned 21 warnings`;
  - the five mixed checks `ok`.

  No `.work` was left behind.
- **C2: T3 in the AC2 run.**
  - The planted control started 24 s after the 129,944 entries were written, at load 11.98: small 427.4 ms, large 569.4 ms, +142.0 ms. It fails, as it must.
  - The check started 87 s after, at load 6.19: small 428.9 ms, large 429.6 ms, **+0.7 ms**, ok.
- **CI.** PR #75's checks run on the branch tip after this record is pushed. Their result is the PR's, not this record's.
- **Not run, or not a pass.**
  - Windows (MIG-B9-28, MIG-B9-91). CI's ubuntu job skips `sass-stage-case.test.js`, with its reason, because the filesystem does not fold case there.
  - Nothing in CI asserts P10: S-1 runs `--no-timing-budget`. MIG-B9-91 re-measures it on the owner's Mac (D9).
  - Folders protected by macOS privacy controls (TCC) cannot be tested on this machine.
  - The budget fixture is not in `npm test`: it needs the network and a quiet machine.
  - `verify:playground-browser`, Press Craftor and `fixtures/parity/run.js --update` were not run: the compiled output does not change.
- **Owner steps.**
  - Review PR #75, and answer the owner flags in §15's "Delivery of 2026-11-09".
  - Merge the PR into `feat/beta9`. This run does not merge it.
  - `main` receives this story when `feat/beta9` is next merged into it, as PR #73 did.

## 15. Findings and follow-ups

### The profile of 2026-11-02

New facts from the profile this story was drafted from (`7aec3e0`, on the
machine where P10 was measured), each with a proposed owner. Its scripts and
logs stay in the run's scratch evidence, outside the repository. This story
fixes none of them.

**For the owner:**

1. **This story's scope differs from what the decision anticipated. It is
   answered before the story starts, in this plan's review,** as a §15
   review block is (README §1.4): merging this plan as drafted accepts the
   Sass-stage-only scope. The decision said the story "would cover the Sass
   stage, the plugin's fixed costs and the double theme discovery (K3)". The
   profile shows:
   - **The Sass stage explains the failure.** With the corpus root in §4's
     large directory, `realCase`'s listing of that directory costs 95.8 ms
     per `compile()`; one listing of the real `$TMPDIR` takes 112 ms warm.
     Without the listing, `run.js` gave 1.25×, 1.26× and 1.30× instead of
     1.56×, 1.55× and 1.57×.
   - **The plugin's fixed costs are about 49–52 ms** (0.15–0.17× of Dart
     Sass): `plugin.ts` totals 52.2 ms in §4's profile, 48.9 of them in
     `checkReferences`, `validateOptions` and `expandResponsive`. They are
     not the cause: in the small directory the base already meets P10
     (1.256–1.289×).
   - **K3 saves about 0.06–0.09 ms** (MIG-B9-21, below).

   This story takes the first only. If the owner folds MIG-B9-24 in instead,
   the story is redrafted before it starts: Size M; Depends on MIG-B9-13, 20
   and 21; Shares `plugin.ts`, `compile.ts`, `ds-runtime/theme-validate.ts`
   and `ds-runtime/theme-generator.ts`; new §7 rows.

   **§7, to confirm in the same review.** Taking the Sass stage only keeps
   the story off `plugin.ts` and `compile.ts`. It still shares
   `packages/uxdsl/CHANGELOG.md` and `packages/uxdsl/README.md`, whose §7
   rows are append-only, with the unmerged rows before it (MIG-B9-14, 15,
   20, 21 and 22) and with rows after it (MIG-B9-30 to 36 among them).
   Under §7 as written, this story starts only after those five merge, and
   MIG-B9-30 to 36 wait for it. If the owner confirms that the append-only
   rows do not serialize stories, it can start now (MIG-B9-13 is merged) and
   waits for no story. Either order keeps its checks valid, since they
   compare against BASE (§3).
2. **P10's method.** The contract keeps P10's method as written: `run.js`
   unedited, with its budget, its order and its location. It asks for three
   passing invocations in a row where MIG-B9-13's AC1 asked for one, because
   the base passes single invocations (§4). These are the owner's to weigh:
   - **The cold first run is inside the median of three.** In 83 of the 84
     series of the profile's 42 `method.js` processes, and in all 18 of §4's,
     each run is faster than the one before, so the median is nearly always
     the second run. The exception is one prototype's Dart Sass series: 569,
     384 and 389 ms.
     - Dart Sass's second runs are still warming up: 401, 422 and 399 ms,
       against third runs of 332, 330 and 329.
     - `compile()`'s second runs are only 1.08–1.11× its third.
     - So the median ratio (1.49×, 1.45×, 1.54×) is 0.16–0.22× below the
       third-run ratio of the same runs (1.67×, 1.67×, 1.70×).
   - **The order.** Dart Sass runs first, so `compile()`'s stage runs on a
     Dart Sass already JIT-warmed. With `compile()` first, the ratio rose by
     0.3–0.5×:
     - in the large directory, 1.817–1.984× against 1.506–1.528×;
     - in the small directory, 1.667–1.695× against 1.256–1.288×.
   - **The location.** The corpus sits under `os.tmpdir()`, and on darwin the
     base lists every ancestor of every loaded file. `compile()`'s time grew
     by about 0.75–0.86 µs per `$TMPDIR` entry per call: about 97 ms, 0.31×
     of Dart Sass, at 130,000 entries. C2 removes that dependence, and the
     runner keeps its location.
   - **The load.** The base gave 1.49×, 1.45× and 1.54× at load 4.0–4.4,
     1.56×, 1.55× and 1.57× at load 2.0–2.3, and 1.54×, 1.51× and 1.55× at
     load 1.65–2.11. A quieter machine does not meet P10 here, which answers
     option (a) of MIG-B9-13's flag 1.
   - **CI.** The gate's S-1 runs on ubuntu, where `FOLDS_CASE` is false, with
     a fresh `$TMPDIR`. Its 1.09× and this machine's 1.45–1.57× measure
     different code paths, not only different machines.
   - **MIG-B9-13's flag-1 breakdown** fits a corpus kept under `os.tmpdir()`:
     - flag 1 gave the stage with its map 1.38–1.40×, without it 1.23–1.24×,
       and `compile()` 1.62–1.63×;
     - in the small directory the same breakdown is 1.20×, 1.02× and 1.38×;
     - in the large directory it is 1.49×, 1.33× and 1.72×.

     The delivery did not print the size of `$TMPDIR`, but birth times give
     a lower bound. Of the 129,956 entries counted at 23:25 EST on
     2026-11-02, 127,680 already existed at 13:20 EST that day, when the
     delivery's first three runs started (`b4227eb` was committed at
     13:04:41 EST). `$TMPDIR` held at least 127,680 entries then.
3. **Nothing asserts P10 after this story.** S-1 runs with
   `--no-timing-budget`, and CI never runs `realCase`. Later stories can move
   the ratio: MIG-B9-20 changes where the theme is emitted, and MIG-B9-31, 34
   and 35 add work to the plugin. Proposed for MIG-B9-91: run P10's method
   again, asserted, on this machine before the publish (an owner check), or
   assert S-1 on darwin.

**By story:**

- **MIG-B9-24 (proposed): the plugin's fixed per-build costs.** Size S. It
  edits `plugin.ts`, and for some candidates `compile.ts`,
  `ds-runtime/theme-validate.ts` and `ds-runtime/theme-generator.ts`. §7
  therefore puts it after MIG-B9-20 and MIG-B9-21, in wave 2 or after wave 3
  (where MIG-B9-32 to 34 also edit `theme-validate.ts`).
  - **The cost:** a `compile()` of a one-rule input takes 19.5 ms with
    `includeTheme: false` and 24.6 ms with `true`. The PostCSS pass alone
    takes 18.5 and 23.6 ms, and 8.65 ms with references `'off'`. Every module
    a Vite or webpack build compiles pays it.
  - **Inside one `compile()` of the corpus:** `checkReferences` takes 20.9 ms
    (`renderThemeCss` 12.6, `enforceReferences` 7.5), `validateTheme` 13.2,
    and `expandResponsive` 13.2. GC takes 31–33 ms per run, against 19.8 for
    plain Dart Sass.
  - **The output-free candidates:**
    - skip the reference pass when it can report nothing (no consumer, no
      `references.css`, no `externalTokens`): 29–30 ms on the corpus, a
      2-line prototype;
    - skip a value with no `(` in both walks of `expandResponsive`:
      11.5–12.6 ms, a 3-line prototype.

    Both combined prototypes include them. Every package suite and the
    parity oracles equal the unmodified copy in both, except one core test
    in combo, MIG-B9-12's `sourceMapIncludeSources` option test, which its
    `sourcesContent` change fails (§7, item 1).
  - **The estimated ones:**
    - render the theme once per compilation and share it with
      `validateTheme`: 8.5–13 ms. `validateTheme` is public, so its errors,
      warnings and bytes must not move;
    - parse each value once: 5–10 ms. `postcss-value-parser`'s self time
      under `expandResponsive` is 7.7 ms per run, and 16.3 ms under the
      theme's engines (§4's profile).
  - **Gated on the owner:**
    - the stage map only when a map is requested (MIG-B9-13's flag 2): 52 ms;
    - Dart Sass's map without `sourcesContent` (MIG-B9-12's M1 and its
      options test): 26–31 ms.
- **MIG-B9-25 (proposed): the suites remove the temporary directories they
  create.** Size S. Nothing was removed while drafting.
  - **What is left:** 127,359 of that `$TMPDIR`'s 129,944 entries are uxdsl
    test leftovers, dated 2026-10-25 to 2026-11-02:
    - 99,469 `uxdsl-sass-stage-*`, because `compile-sass.test.js`'s
      `project()` never removes its directories;
    - 7,460 `uxdsl-cli-test*`;
    - 2,492 `uxdsl-core-test*`;
    - 2,470 `uxdsl-sass-pipeline*`;
    - 1,690 `postcss-uxdsl-config-test*`;
    - 1,680 `uxdsl-theme-cmd-test*`;
    - and others.
  - **How fast it grows:** one `node --test test/core/*.test.js` leaves 549
    directories, 492 of them from `compile-sass.test.js`. One full package
    suite leaves about 795.
  - **What it costs:** one listing of that directory takes 112 ms warm and
    430 ms cold.
  - **The kept corpus:** `run.js --keep` leaves `_uxdsl-extras.uxdsl` and
    `with-extras.uxdsl` in it (49 entries), so a kept corpus is not pristine.
  - **Shared with this story:** it would edit `compile-sass.test.js`'s
    `project()` and, for `--keep`, `fixtures/sass-corpus/run.js`, both of
    which this story keeps unedited from its BASE. If it merges first, this
    story's BASE carries the edits; while this story is in progress, they
    wait for it.
- **MIG-B9-21:** K3, measured.
  - A `compile()` calls `discoverThemeSync` twice and `resolveTheme` twice.
  - In a hot loop, one discovery takes 10.1 µs without a theme file and
    81.7 µs with one. One resolution takes 0.3 µs, or 6.2 µs with a theme.
  - Inside `compile()`, timing wrapper included, both discoveries take
    0.12–0.17 ms per call of the corpus (0.29 ms on one first call), and
    0.10–0.16 ms on a one-rule input.

  Removing one discovery saves about 0.06–0.09 ms per `compile()` of the
  corpus, or 0.01 ms by the hot-loop figures: under 0.03% of `compile()`
  either way. K3 is a simplification, not a performance lever.
- **MIG-B9-20 (found while drafting, not by the profile):**
  `fixtures/sass-corpus/run.js` passes `{ includeTheme: false }` twice. Under
  M2 that is a `UXD_OPTION_REMOVED` warning, so the timed `compile()` would
  return one more warning than the 21 it prints today. The file is not in
  MIG-B9-20's Shares. Add it and drop the option: Bootstrap has no marker, so
  no theme is emitted either way. Editing `run.js` changes P10's runner,
  which this story's C1 and AC1 run unedited from their BASE, so the two
  stories coordinate it: if MIG-B9-20 merges first, this story's BASE
  carries the edit and its §4 is re-recorded on it; while this story is in
  progress, the edit waits for it.
- **MIG-B9-91:**
  - `realCase` on win32 is unverified; it joins MIG-B9-13's flag 20.
  - The P10 re-run (finding 3).
- **The follow-up listed in MIG-B9-12 §15 (RES-4):** adopting Dart Sass's
  spelling where BASE's differs is an output change. This story keeps
  BASE's (C3, T9).

**No action, recorded:**

- **Profiling.** On macOS, `node --cpu-prof` and `process.hrtime` timestamps
  come from different clocks, so hrtime marks cannot cut a `--cpu-prof`
  profile to the warm runs. V8's sampling profiler, started through the
  inspector after the warm-up, gives the same distribution per run as a
  whole-process profile.
- **No sign of interception.** With the endpoint security agent running,
  each file-system call costs what it should: `statSync` 1.0–1.6 µs,
  `existsSync` 1.0 µs, `realpathSync.native` 16.7 µs, `readdirSync`
  24–49 µs on 22–49 entries.

### The plan's review of 2026-11-02

Facts the review of this plan found, which the sections above now cite.
The fix pass re-ran the RES-4 check and the `$TMPDIR` count, and split the
profile's `postcss-value-parser` time by caller. None of them changes P10,
its method or the owner's decision.

- **RES-4 on `7aec3e0`,** in a scratch project removed afterwards (23:25 EST):
  - a file stored in NFD and written in NFC (`@use "café"`): the base build
    spells the written NFC name; the profile's realpath prototype, and Dart
    Sass on the same files as `.scss`, spell the NFD name;
  - a symlink `Link` written `LINK/`: the base and the prototype spell
    `Link`, and Dart Sass spells `LINK`;
  - the prototype lists no directory for a path without a symlink, and
    through a symlinked directory it lists the directory that holds the
    symlink, twice.

  C3 keeps the base's two spellings, and T9 pins them.
- **§4's runs 7 to 9** are the review's: the first base runs with the
  `$TMPDIR` count printed.
- **The size of `$TMPDIR` at MIG-B9-13's delivery:** at least 127,680
  entries at 13:20 EST (finding 2). The profile's "33,455 entries dated
  2026-11-02" counted UTC dates; by EST date, 20,172 `uxdsl-sass-stage-*`
  entries are from 2026-11-02.
- **`postcss-value-parser`'s self time** in §4's profile, 24.0 ms per run,
  by caller: 8.4 ms under `validateTheme`'s engines, 7.9 under the
  reference pass's theme render, 7.7 under `expandResponsive`, and none
  under `rejectSassSyntax`.

### Owner decisions of 2026-11-04 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-04). The owner was given 19 numbered recommendations, in Spanish, and answered, verbatim, "voy a seguir todas tus recomendciones" ("I will follow all your recommendations"): each recommendation is the owner's decision of 2026-11-04. This record is in English and lists those that concern this story. Of the findings for the owner in "The profile of 2026-11-02" above, they answer findings 2 and 3, which are also §9's two owner checks, and keep finding 1's scope as the merge of this plan (PR #64) accepted it. Finding 1's §7 question, whether the append-only CHANGELOG and README rows serialize stories, is not among these decisions and stays open for the owner. Where they differ from this story's contract, they rule.

- **P10's measuring method is corrected; the budget stays 1.5× (decision D8 of 2026-11-04; finding 2 and the first owner check of §9).** The cold first run is discarded, Dart Sass and `compile()` alternate, and the corpus is compiled from a fresh directory. Decision D8 amends C1's method: C1 uses the corrected method, which this story implements in `fixtures/sass-corpus/run.js`, and that file joins this story's Shares (the header lists it). C2 (location independence) stays. Where this story keeps the runner unedited or P10's method as written (§5's C1 and its byte-identical list, §6, §7's stop rule, §8's T1, §9's AC1), decision D8 rules.
- **MIG-B9-91 re-measures P10 (decision D9 of 2026-11-04; finding 3 and the second owner check of §9)** on the owner's Mac, with the corrected method, before publishing.
- **MIG-B9-24 registered (decision D3 of 2026-11-04; finding 1's scope),** "The plugin's fixed per-build costs": S, wave 2, low priority, as proposed in "By story" above. It stays a story of its own, so this story's scope stays the Sass stage.
- **MIG-B9-25 registered (decision D2 of 2026-11-04),** "The test suites remove the temporary directories they create": S, wave 2, early, as proposed in "By story" above. It and this story both edit `fixtures/sass-corpus/run.js` (the index's §7).

### Delivery of 2026-11-09

Written by the deliverer with PR #75. It records new facts, the owner flags, Shares as delivered and the follow-ups, each with the story proposed for it. §14 has the evidence.

**New facts.**

1. **`feat/beta9` moved during the run.** It went from `4ecdc51` to `7e8d7b4` (PR #74, the owner's decisions of 2026-11-08, documentation only). The branch merged it as `4401f7b`. `packages/`, `fixtures/` and `tsconfig.base.json` are identical at both, so BASE is `7e8d7b4` and the base build made from `4ecdc51` is a build of BASE.
2. **By D8's method, the budget no longer tells the base from the change where the corpus sits in a clean directory.**
   - This change: 1.33×, 1.31× and 1.36× (§14's triple). The implementer measured 1.25×, and `verify:1.0`'s S-1 reports 1.35× from the tarball.
   - The base's Sass stage in a clean directory: 1.36–1.39× (the scout's prototype of D8's runner, and the implementer's corrected runner).
   - In a fresh directory whose grandparent held 129,946 entries, the base gave 1.71–1.77× and the change 1.35–1.38× (the scout).
   - The change rests on C2: T3, and T5's zero listings. The margin under the budget is about 0.14–0.19×.
3. **What the Sass stage asks of the filesystem, per warm `compile()` of the corpus.**

   | Call | Before | After |
   | --- | --- | --- |
   | `readdirSync` | 103 | 0 (1, of `/`, when the project is under `/var` or `/tmp`, which are symlinks on macOS) |
   | `lstatSync` | — | 103 |
   | `realpathSync.native` | — | 87 |
   | `accessSync` | — | 0 (it runs only for a name written in another case) |

   `existsSync` (11), `statSync` (1,205) and `readFileSync` (87) are unchanged. A project with no symlink on its path lists no directory. Through a symlinked directory, the only directory listed is the one that holds the link.
4. **`realpathSync.native` as a spelling source on APFS (scout, implementer, review).**
   - It returns a hard link's own path, even right after the other link is read.
   - It keeps firmlink paths (`/Users`, `/System/Volumes/Data/…`) as written.
   - It resolves a mode-000 file, and names in execute-only and ACL deny-list directories, where `readdir` and `access(R_OK)` both fail.
   - It returns the NFD name of a file stored in NFD.

   The `toLowerCase()` guard and the `access(R_OK)` check keep the base's spelling in the last two cases.
5. **T3's measure is noisy on this machine.**
   - One `compile()` of the corpus varies by tens of milliseconds from run to run. Settled, the true move between the two copies is about −2 to +4 ms: −2.3 ms over 122 rounds, and +4.3 ms over 93 rounds.
   - With 11 rounds, the difference of the two medians exceeds 15 ms in 8.8% (morning) to 24.6% (evening) of bootstrap draws. With 61 rounds, 0.0–0.8%.
   - The fixture's 61-round default gave +8.2 ms (implementer), −0.4 ms (review) and +0.7 ms (§14). With C2's minimum of 9 rounds at load 11–13, the review measured +12.6 ms.
6. **Writing 129,944 files sets off the endpoint security agent.** The agent, and Spotlight, keep the load at 10–12 for minutes. In the first 50 s, 5-round blocks of T3 swung from −62 to +152 ms. Writing hard links instead of files does not avoid it. The fixture therefore runs T3 last and prints how long after the write it starts.
7. **A forced full GC before each `compile()`** made it about 45% slower (median 625 against 428 ms) and widened the spread. It is not a lever for MIG-B9-24.
8. **The suites' temporary directories (MIG-B9-25).**
   - One `npm test` run left 929 entries in its `TMPDIR`: 492 `uxdsl-sass-stage-*`, 152 `uxdsl-cli-test-*`, 26 `postcss-uxdsl-config-test-*`, 24 `uxdsl-theme-cmd-test-*`, 22 `uxdsl-cli-watch-*`, 21 `uxdsl-core-test-*`, 20 `uxdsl-sass-pipeline-*` and 15 `vite-plugin-uxdsl-test-*`.
   - One run of the core suite alone left 559, and `verify:1.0` left 18.
   - All were removed, from the roles' own scratch only.
   - The owner's `$TMPDIR` held 130,041 entries on 2026-11-08 and 3,411 on 2026-11-09. Someone outside this run removed the difference between the two, so §4's "as found" counts and §14's are not comparable.

**Owner flags.**

1. **Where D8's fresh directory lives.** The runner makes the corpus root in `fixtures/sass-corpus/.work/run-XXXXXX/`: git-ignored, outside `os.tmpdir()`, and holding nothing else. This follows recommendation 8's reason, that the corpus lived in the temporary directory. The consequence is new fact 2: AC1 no longer fails on the base's spelling in a clean location, and C2 carries the change.

   The other reading, a fresh subdirectory of `os.tmpdir()`, would keep `$TMPDIR`'s size in the base's figure. Recommendation: confirm the first reading.
2. **D8's implementation edits more than `run.js`.** It also changes `run.test.js` (the failing-first tests and the whole-run test), `README.md` (the method) and a new `.gitignore` (`.work/`), all in `fixtures/sass-corpus`.
   - This story's header Shares and README §7's `fixtures/sass-corpus/run.js` row name only `run.js`.
   - This record updates only README §5's MIG-B9-23 row.

   Recommendation: the §7 row reads `fixtures/sass-corpus/run.js`, `run.test.js`, `README.md`, `.gitignore`, for 10, 23 and 25.
3. **An execute-only directory keeps the base's spelling.** In a directory that can be searched but not listed, the base keeps the written case, and so does this change (T9b), through an `access(R_OK)` check, a system call rather than a listing. Dart Sass and a realpath-only spelling give the on-disk case. §7's traps did not list this input; C3's "every input" covers it. Recommendation: accept, since C3 asks for the base's output everywhere.
4. **T3's statistic.** The fixture defaults to 61 rounds; C2 allows any number from 9. A paired statistic (the median of per-round differences, −1.7 ms over 122 rounds) would be sturdier than the difference of the two medians that C2 names. Recommendation: keep C2's statistic with the 61-round default, and decide in MIG-B9-91 whether its re-measure should also use the paired one.
5. **"Before any other invocation of the runner" (C1, AC1).** The runner was invoked 13 times after the Sass stage's last change (§14). The review's fix then changed the runner (`f442d02`), which restarted the count, and the triple was the first three invocations after it. Recommendation: accept the triple. Read literally from the Sass stage's change alone, no triple could satisfy the clause any more.
6. **The CHANGELOG and the package README are append-only, shared with MIG-B9-22.** MIG-B9-22 runs in parallel and has no PR yet. Following the owner's "si fusiona y arranca" of 2026-11-04 (finding 1's §7 question), the story that merges second rebases its CHANGELOG subsection and README sentence. Recommendation: record that answer to finding 1's question.
7. **MIG-B9-21 and `compile-sass.ts`.** MIG-B9-21's `error.warnings` (the decision on MIG-B9-14's flag 11) likely needs `compile-sass.ts`'s `finish()`. README §7 says that listing 21 on that file's row makes 23 and 26 wait for it. This story changes only `filesystem()`, which is disjoint from `finish()`. Recommendation: merge this story first, and let MIG-B9-21 rebase on it when it adds the file to its Shares.
8. **The PR targets `feat/beta9`, as the plan says.** `main` gets it at the next `feat/beta9` → `main` merge, as PR #73 did.

**Shares as delivered.**
- `packages/uxdsl/src/sass/compile-sass.ts`: `filesystem()`, and the header paragraph on canonical paths.
- `fixtures/sass-corpus/`: `run.js` (D8's three corrections and `runCorpus()`), `run.test.js` (three tests), `README.md` and the new `.gitignore`. `_uxdsl-extras.uxdsl` is unedited.
- `packages/uxdsl/CHANGELOG.md`: one subsection, at the top of `## 0.5.0-beta.9 — unreleased`, with `### Visual changes`: none.
- `packages/uxdsl/README.md`: one sentence in step 2 of the Sass pipeline list.
- Owns: `packages/uxdsl/test/core/sass-stage-case.test.js` (5 tests) and `fixtures/mig-b9-23-compile-budget/` (`run.js`, `README.md`).
- Not touched: `compile-sass.test.js`, `fixtures/parity/expected`, the diagnostics catalog (106 codes), `AGENTS.md` and the generated artifacts.

**Follow-ups, each with its proposed story.**
- **MIG-B9-91.**
  - Re-measure P10 on the owner's Mac with the corrected runner (D9). It prints where the corpus root is.
  - Decide flag 4's paired statistic for T3.
- **MIG-B9-28.** On Windows, check `realpathSync.native`, `lstat` on junctions, `access(R_OK)` and 8.3 short names. `sass-stage-case.test.js` runs on win32, and T9's NFD half is skipped there with its reason.
- **MIG-B9-25.**
  - The suites' leftovers (new fact 8).
  - `run.js --keep` now keeps a root under `fixtures/sass-corpus/.work/`, which protect's `UXDSL_SASS_CORPUS` test reads.
  - MIG-B9-25 also edits `run.js`, after this story.
- **MIG-B9-20.** It owns dropping `run.js`'s `{ includeTheme: false }` (its M2). This story left it as it was.
- **MIG-B9-24.** The plugin's fixed per-build costs are the lever if the margin of new fact 2 shrinks. A forced GC is not (new fact 7).
- **MIG-B9-26.** It edits `compile-sass.ts` after this story, and rebases on it.
- **The next FEAT-010 documentation PR.** README §7's `fixtures/sass-corpus` row (flag 2), and finding 1's §7 answer (flag 6), if the owner accepts them.
