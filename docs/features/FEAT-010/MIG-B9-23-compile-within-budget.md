# MIG-B9-23 — `compile()` within 1.5× of Dart Sass, wherever the project is

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | None (the owner's decision of 2026-11-02 on MIG-B9-13's AC1 asks for this story; it is recorded in MIG-B9-13 §15) |
| Status | Ready |
| Size | S |
| Depends on | MIG-B9-13 |
| Blocks | MIG-B9-91 |
| Base | `feat/beta9` after MIG-B9-13 (`7aec3e0` or later) |
| Owns | `packages/uxdsl/test/core/sass-stage-case.test.js` (new), `fixtures/mig-b9-23-compile-budget/` (new: `run.js`, `README.md`) |
| Shares | `packages/uxdsl/src/sass/compile-sass.ts` (`filesystem()`'s `realCase`; MIG-B9-12's module), `packages/uxdsl/CHANGELOG.md` (the docs guard lists `compile-sass.ts` as a visual-default file), `packages/uxdsl/README.md` (one sentence) |
| Output impact | none |

## 1. Goal

P10's own runner, `node fixtures/sass-corpus/run.js`, passes on the machine
where P10 was measured. By P10's method, `compile()`'s median on Bootstrap
5.3.8 is at most 1.5× plain Dart Sass's on three invocations in a row, and it
no longer depends on how many entries the directories above the project
hold. The corpus stays byte-identical to Dart Sass, every parity oracle and
every other output stays as it is, and `npm test` stays green.

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
  >   - PR #63 is merged into `feat/beta9` with AC1 recorded as not met on its timing half. The corpus stayed byte-identical: every delivery run printed `byte-identical: true`. The ratio was over 1.5× (flag 1).
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

## 4. Baseline

```bash
for i in 1 2 3; do date; sysctl -n vm.loadavg; find "$TMPDIR" -mindepth 1 -maxdepth 1 | wc -l; node fixtures/sass-corpus/run.js; echo "exit=$?"; done
```

Recorded on `7aec3e0` by the profile of 2026-11-02:

- **The machine:** MacBookPro18,3 (Apple M1 Pro, 8 cores, 16 GB), macOS 27.0
  (26A428). It was never quiet: VS Code, Chrome and an endpoint security
  agent ran throughout.
- **The tools:** Node 20.19.0 and npm 11.21.1, CI's versions; `sass` 1.107.0;
  PostCSS 8.5.31.
- **`$TMPDIR`** (`/var/folders/kv/gp_3sskx7kb8vy0d00hyjgpr0000gn/T`) held
  129,944 entries, 127,359 of them left by uxdsl's test suites (§15).

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

| Run | Start (EST, 2026-11-02) | Load average (1, 5, 15 min) | Dart Sass runs (ms) | `compile()` runs (ms) | Medians (ms) | Ratio | Exit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 21:38:39 | 4.40 11.30 13.15 → 4.12 11.13 13.08 | 656, 401, 332 | 1022, 600, 556 | 401, 600 | 1.49× | 0 |
| 2 | 21:38:45 | 4.12 11.13 13.08 → 4.11 11.01 13.02 | 587, 422, 330 | 678, 612, 551 | 422, 612 | 1.45× | 0 |
| 3 | 21:38:50 | 4.11 11.01 13.02 → 4.03 10.88 12.96 | 608, 399, 329 | 681, 614, 560 | 399, 614 | 1.54× | 1: `FAIL  compile() is over the 1.5x budget` |
| 4 | about 22:11 | 2.27 4.18 4.99 | 571, 387, 326 | 1055, 602, 547 | 387, 602 | 1.56× | 1 |
| 5 | about 22:11 | 1.98 3.99 4.90 | 569, 379, 318 | 656, 587, 544 | 379, 587 | 1.55× | 1 |
| 6 | about 22:11 | 2.20 3.94 4.87 | 572, 382, 323 | 666, 598, 545 | 382, 598 | 1.57× | 1 |

Runs 4 to 6 ran the same build through `--uxdsl <worktree>/packages/uxdsl`,
interleaved with the prototypes of §7.

**The breakdown.** One process, run from the worktree root, on the corpus
kept by `TMPDIR=<scratch> node fixtures/sass-corpus/run.js --keep --no-timing-budget`
(a parent directory with 4 entries). There were 3 warm-up rounds, then 15
rounds with the order of the variants rotated each round, from 21:42:56 to
21:43:39 EST at load 4.71–5.47. Every variant's CSS was byte-identical to
Dart Sass's.

| Variant | Median (ms) | Spread (ms) | × plain Dart Sass |
| --- | --- | --- | --- |
| Plain Dart Sass, as `run.js` runs it: `sass.compile(bootstrap.scss, { style: 'expanded', logger })` | 315.9 | min 307.7, IQR 310.9–324.9, max 397.1 | 1.000 |
| Dart Sass with its source map (`sourceMap: true`) | 345.0 | min 332.5, IQR 340.8–355.2, max 390.2 | 1.092 |
| Dart Sass with the stage's map options (`sourceMap: true`, `sourceMapIncludeSources: true`) | 372.1 | min 355.2, IQR 357.2–396.2, max 529.7 | 1.178 |
| `compileSassStage` with its map | 379.9 | min 361.5, IQR 368.9–399.1, max 426.2 | 1.203 |
| `compileSassStage` without its map | 323.4 | min 314.0, IQR 319.8–343.6, max 418.1 | 1.024 |
| The PostCSS pass alone on the stage's output (`restoreDirectiveSpacing`, the plugin with `includeTheme: false`, `dropAnnotations`) | 74.8 | min 69.5, IQR 73.0–77.1, max 82.8 | 0.237 |
| `compile({ entry }, { includeTheme: false })`, end to end | 436.4 | min 424.9, IQR 430.6–442.7, max 512.3 | 1.381 |

**The location.** The same corpus was also copied under a parent holding
129,945 entries: 129,944 empty ones, the size of that `$TMPDIR`, and the
corpus. Both copies ran interleaved in one process, 11 rounds, at 21:47:57
EST, load 4.67–9.28:

| Variant | Median at the 129,945-entry parent (ms) | Spread (ms) | × plain Dart Sass | Against the 4-entry parent |
| --- | --- | --- | --- | --- |
| Plain Dart Sass | 316.8 | min 309.1, max 794.7 | 1.000 | +2.3 ms (314.5) |
| `compileSassStage` with its map | 472.6 | min 458.7, max 581.6 | 1.492 | +103.4 ms (369.2) |
| `compileSassStage` without its map | 421.5 | min 411.2, max 483.9 | 1.330 | +98.1 ms (323.4) |
| `compile()`, end to end | 545.7 | min 524.7, max 689.8 | 1.722 | +96.7 ms (448.9) |

**The profile.** V8's sampling profiler ran at a 250 µs interval, started
through the inspector after 4 warm-up runs. It sampled 20 warm `compile()`
runs (median 459.3 ms) under a small parent, at load 2.2–2.4. Per run:

| Module | Self (ms) | Total (ms) | Notes |
| --- | --- | --- | --- |
| Dart Sass (`sass.dart.js`) | 338.6 | 359.4 | plain Dart Sass profiled the same way: 290.1 of 318.8 |
| GC | 33.1 | 33.1 | plain Dart Sass: 19.8 |
| `postcss-value-parser` | 24.0 | 26.7 | each value parsed three times by `expandResponsive` |
| the engines the plugin calls | 18.1 | 37.2 | |
| `postcss` | 17.7 | 64.2 | parsing Dart Sass's 276,926 bytes: 9.4–9.7 |
| `node:fs` | 14.8 | 14.9 | plain Dart Sass: 8.0 |
| `plugin.ts` | 4.4 | 52.2 | `checkReferences` 20.9, `validateOptions` 14.8 (`validateTheme` 13.2), `expandResponsive` 13.2 |
| `compile-sass.ts` | 2.8 | 360.7 | `canonicalize` 14.1 (`realCase` 7.5–8.1), the importer's loads 6.3 |
| `protect.ts` | 2.2 | 2.9 | protect changed none of the 87 files Bootstrap's entry loads |

At the 129,945-entry parent, `node:fs` rose to 106.7 ms per run. Of that,
95.8 ms was one listing: `openStage` → `realCase` → `readdirSync` of the
large ancestor.

**The counts**, per warm `compile()` of the corpus under a small parent:

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
- Under a 4-entry parent, the base already meets P10 by its method:
  1.256–1.289× (6 processes).

## 5. Contract

- **C1 — The budget, by P10's method.** On the machine where P10 was
  measured, `node fixtures/sass-corpus/run.js` exits 0 on three consecutive
  invocations from the repository root.
  - The runner is the base's, unedited: its method, its budget, its flags and
    its corpus location. In one process, Dart Sass compiles `bootstrap.scss`
    three times without a map, then `compile()` compiles `bootstrap.uxdsl`
    three times, and the medians are compared. The corpus sits under
    `os.tmpdir()`, whatever that directory holds.
  - Each invocation prints `byte-identical: true`, a ratio within the 1.5×
    budget and the five mixed checks `ok`.
  - The playground's `uxdsl build` wall time before and after is recorded in
    §14 (P10's own clause).
- **C2 — Wherever the project is.** On darwin, where P10 was measured,
  `compile()`'s time does not grow with the number of entries in a directory
  that contains the project. (win32 runs the same code, unverified: §6.)
  - The measure: in one process, two copies of the corpus, one under a
    parent that also holds 129,944 empty entries and one under a parent
    holding 4 entries. `compile()` is called as `run.js` calls it, the two
    copies interleaved, with 2 warm-up rounds and then at least 9.
  - The two medians differ by at most 15 ms. On `7aec3e0` they differ by
    96.7 ms; plain Dart Sass's differ by 2.3 ms.
- **C3 — The output is unchanged.** For every input, `compile()` returns what
  it returns on `7aec3e0`:
  - `css`, `map`, `dependencies` and `warnings` (text, file, line and column);
  - the same errors (code, message, file, line and column).

  So does `compileSassStage`, for its `css`, `map`, `loadedFiles` and
  `warnings`. Each loaded file keeps today's spelling:
  - on darwin and win32, each component spelled as its directory lists it;
  - a symlink kept, not resolved;
  - today's name where it differs from Dart Sass's (RES-4).
- **C4 — Per call.** Nothing the Sass stage learns about the filesystem
  outlives one call. When a file is renamed, in case only, between two
  `compile()` calls in one process, the second call spells it as the disk
  does.

Must stay byte-identical:

- the corpus through `compile()`: 276,926 bytes, equal to Dart Sass's, in the
  three `sourceMap` modes (`'inline'` without its final comment);
- the corpus's external map, `dependencies` and 21 warnings, against
  `7aec3e0`'s build;
- every parity oracle (`fixtures/parity/expected/**`), without `--update`;
- the playground's `src/app/uxdsl.css` (337,214 bytes, sha256
  `1f7eb19e7549…`), `src/generated/examples.json`, and the CLI and compiler
  captures;
- the gate's verdicts: S-1's `byte-identical`, S-2, S-3
  (`heavy.uxdsl:18:66`), N-02 and UX-20;
- `fixtures/sass-corpus/**` and `packages/uxdsl/test/core/compile-sass.test.js`,
  unedited;
- `DIAGNOSTIC_CATALOG`: 106 codes, none added.

A problem with P10's method is a finding for the owner (§15), never a change
to C1.

## 6. Out of scope

- **K3,** one theme discovery and resolution per compilation: MIG-B9-21. It
  saves about 0.01 ms per `compile()` of the corpus, or 0.09 ms with a theme
  file in the working directory (§15). This story neither needs it nor waits
  for it.
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
  listed in MIG-B9-12 §15. This story keeps today's results (C3).
- **The temporary directories the suites leave** (127,359 entries in that
  `$TMPDIR`): proposed as MIG-B9-25 (§15). Emptying `$TMPDIR` is never a
  means to C1.
- **P10's method** (the cold first run inside the median, the order of the
  runs, the location, the load): the owner's (§15).
  `fixtures/sass-corpus/run.js` stays as it is.
- **What the profile shows is not `compile()`'s:**
  - Dart Sass's own compile, about 316 ms of `compile()`'s 436 ms under a
    small parent. It is not UXDSL's code, and P10 measures against it.
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
   - `compile()`'s warm median went from 532.0 to 425.7 ms at a 129,945-entry
     parent (1.734× → 1.388×), and from 437.4 to 425.6 ms at a 4-entry one
     (9 rounds, load 2.2–3.6).
   - The prototype is a 28-line diff, and the corpus stayed byte-identical.
     Through a symlinked ancestor and three miscased spellings of the entry,
     the stage's `loadedFiles`, map and warnings, and `compile()`'s CSS,
     external map and `dependencies`, were the base's. In the two combined
     prototypes that include it, every package suite and the parity oracles
     gave the same results as the unmodified copy.

   It meets C1 with a margin of about 0.2× by P10's method; the warm
   steady-state ratio is still 1.39×. Of all the candidates, it is the only
   one that meets C2.
2. **Read each directory once per call.** This keeps the listing and caches
   it per directory, for 11–15 ms. It still lists a large ancestor, so it
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
   - K3: about 0.01 ms (MIG-B9-21).

   With 1, the plugin's two output-free changes and the map without
   `sourcesContent`, the prototypes gave 1.14×, 1.00× (Dart Sass's own runs
   disturbed) and 1.13× by `run.js`. With the stage map built only on request
   in place of the `sourcesContent` change, they gave 1.01×, 1.04× and 1.03×.

Traps:

- **Do not port Dart Sass's cache.** Its `_realCaseCache` is process-wide.
  The stage's header ("Nothing is shared between calls") and README §2 forbid
  one, and C4 tests it.
- **Keep today's spelling where Dart Sass's differs** (C3, RES-4):
  - Today a name is the one entry of its directory equal to it under
    `toLowerCase()`. With no such entry, or more than one, it is the name as
    written.
  - A realpath can return a name that compares differently, such as an NFD
    name for an NFC spelling. Keep the written name there, as today.
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
  - The machine is never quiet, so do not wait for quiet. On the base, a
    lower load did not bring the ratio under 1.5×: 1.56×, 1.55× and 1.57× at
    load 2.0–2.3.
- **The fixture removes what it creates,** C2's 129,944 empty entries
  included, which it makes inside its own temporary directory. Unlike the
  suites (§15), it leaves nothing behind.
- **Compare with the base build, not only with Dart Sass.** Byte identity
  with Dart Sass does not cover `map`, `dependencies` or how a loaded file is
  spelled. T4 compares them with a build of `7aec3e0` made in a scratch
  worktree.

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
| T1 | `fixtures/sass-corpus/run.js` (unedited), three invocations in a row | its own output: `byte-identical: true`, `timing: compile()'s median is …x`, the five mixed checks | fixture | C1 | T2's slow wrapper |
| T2 | `fixtures/mig-b9-23-compile-budget/run.js` (new; run by hand, since it installs Bootstrap) | `MIG-B9-23 (negative control): run.js fails a compile() 250 ms slower per call, and one that changes a byte` | fixture | C1, C3 | itself: `run.js --uxdsl <wrapper>` must exit 1, with `FAIL  compile() is over the 1.5x budget` for the slow wrapper and `byte-identical: false` for the changed byte |
| T3 | same | `MIG-B9-23: compile()'s median on the corpus moves at most 15 ms when its parent also holds 129,944 empty entries` | fixture | C2 | a wrapper that lists the large parent on each `compile()` call, as the base does, fails the check |
| T4 | same, with `--base <dir>` (a build of `7aec3e0`) | `MIG-B9-23: the corpus through compile() equals the base build's css, map, dependencies and warnings in the three sourceMap modes` | fixture | C3 | a wrapper that changes the case of one `dependencies` entry fails it |
| T5 | `packages/uxdsl/test/core/sass-stage-case.test.js` (new) | `MIG-B9-23: on darwin and win32 the Sass stage lists no directory to spell a path component that is not a symlink` | unit | C2 | through a symlinked directory the count is not 0, because the symlink's own directory is listed: the counter sees listings. Skipped on other platforms, with the reason |
| T6 | same | `MIG-B9-23: the Sass stage spells a file as the disk does in each call: an entry written in three cases, a symlinked ancestor, a case-only rename between two calls` | unit | C3, C4 | the two calls around the rename must spell the file differently, which a cache kept across calls would not. Skipped on other platforms, with the reason |
| T7 | `packages/uxdsl/test/core/compile-sass.test.js` (MIG-B9-12's, unedited) | the Dart Sass twin comparisons: two spellings of one file, a symlinked `node_modules`, `..` under load paths | unit | C3 | — |
| T8 | `fixtures/parity/run.js`, `npm test`, `npm run verify:1.0 -- --skip-playground-walk`, `npm --prefix packages/playground-nextjs run uxdsl:build` | unchanged outputs | all | C3 | — |

C1 and C2 fail on the base and pass after the change (README §2). C3 and C4
state what the change must keep: their tests pass on the base by design, and
each negative control shows that its test can fail.

## 9. Acceptance criteria

- **AC1** On the machine where P10 was measured (`sysctl -n hw.model` prints
  `MacBookPro18,3`), `node fixtures/sass-corpus/run.js` exits 0 on three
  consecutive invocations from the repository root.
  - Each prints `byte-identical: true`, a ratio within the 1.5× budget and
    the five mixed checks `ok`.
  - §14 records each invocation's start time, load average, `$TMPDIR` entry
    count and output.
  - Test file: `fixtures/sass-corpus/run.js`, unedited
    (`git diff --exit-code 7aec3e0 -- fixtures/sass-corpus` exits 0).
  - Mutation: a `compile()` 250 ms slower per call (T2's wrapper) exits 1. So
    does the base's `realCase` with a `$TMPDIR` of about 130,000 entries
    (§4: 1.54×, then 1.56×, 1.55× and 1.57×).
- **AC2** `node fixtures/mig-b9-23-compile-budget/run.js --base <a build of 7aec3e0>`
  exits 0 and prints `ok` for T2's two controls, T3 with its planted
  control, and T4 in the three `sourceMap` modes.
  - Test file: `fixtures/mig-b9-23-compile-budget/run.js`.
  - Mutation: the base's `realCase` fails T3 (+96.7 ms in §4).
- **AC3** `node --test packages/uxdsl/test/core/sass-stage-case.test.js`
  exits 0 on darwin, with T5 and T6 run, not skipped.
  - Test file: `packages/uxdsl/test/core/sass-stage-case.test.js`.
  - Mutation: the base's `realCase`, which lists a directory for each
    component, fails T5.
- **AC4** `node --test packages/uxdsl/test/core/*.test.js` exits 0, and
  `git diff --exit-code 7aec3e0 -- packages/uxdsl/test/core/compile-sass.test.js`
  exits 0.
  - Test files: `compile-sass.test.js` and `sass-stage-case.test.js`.
  - Mutation: a `realCase` that returns the path as written fails
    `compile-sass.test.js`'s "two spellings of one file".
- **AC5** `node fixtures/parity/run.js` exits 0 without `--update`, and
  `git diff --exit-code 7aec3e0 -- fixtures/parity/expected` exits 0.
- **AC6** `npm test` exits 0, and
  `npm run verify:1.0 -- --skip-playground-walk` exits 0 with S-1, S-2, S-3,
  N-02 and UX-20 `ok`.
- **AC7** `npm --prefix packages/playground-nextjs run uxdsl:build` exits 0
  and prints `unchanged src/app/uxdsl.css`. §14 records
  `/usr/bin/time -p npx uxdsl build` in `packages/playground-nextjs`: three
  runs on `7aec3e0`'s build and three after (P10's clause).

Owner checks, never marked PASS by the agent:

- Accept this story's scope, or fold MIG-B9-24 into it (§15, finding 1). The
  decision of 2026-11-02 anticipated the Sass stage, the plugin's fixed
  costs and K3.
- Decide the findings on P10's method (§15, finding 2). C1 keeps P10 as
  written until the owner says otherwise.
- Decide whether MIG-B9-91 runs P10's method again, asserted, on this
  machine before the publish (§15, finding 3).

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
  `compile()` no longer lists directories to spell paths, and has
  `### Visual changes`: none.
- `packages/uxdsl/README.md`: one sentence beside the Sass pipeline
  paragraph.
- `fixtures/mig-b9-23-compile-budget/README.md` (new): what the fixture runs,
  its network use, the `--base` build and the controls.

`fixtures/sass-corpus/README.md` is unchanged, like the runner.

## 12. Verification

```bash
node fixtures/sass-corpus/run.js                                     # 3 in a row, each with date, sysctl -n vm.loadavg and the $TMPDIR count; exit 0 each
node fixtures/mig-b9-23-compile-budget/run.js --base <dir>           # exit 0; network
node --test packages/uxdsl/test/core/sass-stage-case.test.js         # exit 0 on darwin, nothing skipped
node --test packages/uxdsl/test/core/*.test.js                       # exit 0
node fixtures/parity/run.js                                          # exit 0
npm test                                                             # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                         # background; exit 0
npm --prefix packages/playground-nextjs run uxdsl:build              # exit 0; unchanged src/app/uxdsl.css
(cd packages/playground-nextjs && /usr/bin/time -p npx uxdsl build)  # 3 runs on 7aec3e0's build, 3 after
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
- **C3 and C4:** T4 against `7aec3e0`; parity, `npm test`, `verify:1.0`, and
  `uxdsl.css` unchanged.
- **Not run, or not a pass:** Windows, and what CI cannot show (§7).
- **Owner checks:** the list in §9.
- The last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 14. Closure record

Filled once, in the delivering PR.

## 15. Findings and follow-ups

### The profile of 2026-11-02

New facts from the profile this story was drafted from (`7aec3e0`, on the
machine where P10 was measured), each with a proposed owner. Its scripts and
logs stay in the run's scratch evidence, outside the repository. This story
fixes none of them.

**For the owner:**

1. **This story's scope differs from what the decision anticipated.** The
   decision said the story "would cover the Sass stage, the plugin's fixed
   costs and the double theme discovery (K3)". The profile shows:
   - **The Sass stage explains the failure.** At P10's location, `realCase`'s
     listing of the 129,944-entry `$TMPDIR` costs 95.8 ms per `compile()`.
     Without it, `run.js` gave 1.25×, 1.26× and 1.30× instead of 1.56×,
     1.55× and 1.57×.
   - **The plugin's fixed costs are about 45 ms** (0.14× of Dart Sass), and
     they are not the cause: under a 4-entry parent the base already meets
     P10 (1.256–1.289×).
   - **K3 saves about 0.01 ms.**

   This story takes the first only. That keeps it off `plugin.ts` and
   `compile.ts`, so under §7 it waits for no story, and MIG-B9-30, 31 and 35
   do not wait for it. Folding MIG-B9-24 in would make this story an M that
   depends on MIG-B9-20 and MIG-B9-21.
2. **P10's method.** The contract keeps it as written; these are the owner's
   to weigh:
   - **The cold first run is inside the median of three.** Every series falls
     run by run, so the median is always the second run.
     - Dart Sass's second runs are still warming up: 401, 422 and 399 ms,
       against third runs of 332, 330 and 329.
     - `compile()`'s second runs are only 1.08–1.11× its third.
     - So the median ratio (1.49×, 1.45×, 1.54×) is about 0.15× below the
       third-run ratio of the same runs (1.67×, 1.67×, 1.70×).
   - **The order.** Dart Sass runs first, so `compile()`'s stage runs on a
     Dart Sass already JIT-warmed. With `compile()` first, the ratio rose by
     0.3–0.5×:
     - at a 129,945-entry parent, 1.817–1.984× against 1.506–1.528×;
     - at a 4-entry parent, 1.667–1.695× against 1.256–1.288×.
   - **The location.** The corpus sits under `os.tmpdir()`, and on darwin the
     base lists every ancestor of every loaded file. The ratio grew by about
     0.75–0.86 µs per `$TMPDIR` entry per call: about 97 ms, 0.31× of Dart
     Sass, at 130,000 entries. C2 removes that dependence, and the runner
     keeps its location.
   - **The load.** The base gave 1.49×, 1.45× and 1.54× at load 4.0–4.4, and
     1.56×, 1.55× and 1.57× at load 2.0–2.3. A quieter machine does not meet
     P10 here, which answers option (a) of MIG-B9-13's flag 1.
   - **CI.** The gate's S-1 runs on ubuntu, where `FOLDS_CASE` is false, with
     a fresh `$TMPDIR`. Its 1.09× and this machine's 1.45–1.57× measure
     different code paths, not only different machines.
   - **MIG-B9-13's flag-1 breakdown** fits a corpus kept under `os.tmpdir()`:
     - flag 1 gave the stage with its map 1.38–1.40×, without it 1.23–1.24×,
       and `compile()` 1.62–1.63×;
     - under a 4-entry parent the same breakdown is 1.20×, 1.02× and 1.38×;
     - under a 129,945-entry parent it is 1.49×, 1.33× and 1.72×.

     This is inferred from the numbers: the size of `$TMPDIR` at the
     delivery's runs is not known. 33,455 of today's `uxdsl-sass-stage-*`
     entries are dated 2026-11-02.
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

    In the combined prototypes that include them, every suite and the parity
    oracles gave the same results as the unmodified copy.
  - **The estimated ones:**
    - render the theme once per compilation and share it with
      `validateTheme`: 8.5–13 ms. `validateTheme` is public, so its errors,
      warnings and bytes must not move;
    - parse each value once: 5–10 ms.
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
- **MIG-B9-21:** K3, measured.
  - A `compile()` calls `discoverThemeSync` twice and `resolveTheme` twice.
  - One discovery takes 10.1 µs without a theme file and 81.7 µs with one.
    One resolution takes 0.3 µs, or 6.2 µs with a theme.
  - Inside `compile()`, both discoveries take 0.10–0.29 ms.

  The saving is about 0.01 ms per `compile()`: K3 is a simplification, not a
  performance lever.
- **MIG-B9-20 (found while drafting, not by the profile):**
  `fixtures/sass-corpus/run.js` passes `{ includeTheme: false }` twice. Under
  M2 that is a `UXD_OPTION_REMOVED` warning, so the timed `compile()` would
  return one more warning than the 21 it prints today. The file is not in
  MIG-B9-20's Shares. Add it and drop the option: Bootstrap has no marker, so
  no theme is emitted either way.
- **MIG-B9-91:**
  - `realCase` on win32 is unverified; it joins MIG-B9-13's flag 20.
  - The P10 re-run (finding 3).
- **The follow-up listed in MIG-B9-12 §15 (RES-4):** adopting Dart Sass's
  spelling where today's differs is an output change. This story keeps
  today's (C3).

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
