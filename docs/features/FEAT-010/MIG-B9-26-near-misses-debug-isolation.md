# MIG-B9-26 — Dotted near-misses keep DEC-02's "did you mean" through `compile()`; Sass's `@debug` reaches the build as a warning

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | DEC-02 (decided 2026-10-23) for C1; C3 stays within DEC-17 (decided 2026-10-23). No DEC is open. The owner answered §15's six questions on 2026-11-10 (§15, "Owner decisions of 2026-11-10"); C4 to C6, C5 included, are now MIG-B9-17's |
| Status | Ready |
| Size | S. Registered S by decision D5 of 2026-11-04. The decisions of 2026-11-08 added four detections of module isolation, which need a catalog code and work in the Sass stage's probe, and the removal of the probe prefix's exception, which made it M at its upper bound. Decision 6 of 2026-11-10 split it (§15, Q1, option (b)): this story is the S part, C1 to C3, and the M part, C4 to C6, is MIG-B9-17 |
| Depends on | MIG-B9-14 (merged, PR #71: the CLI prints `compile()`'s warnings, which D5 waits for) and MIG-B9-21 (C2 relies on its `error.warnings`, in `compile-sass.ts`: README §7's note on that file. README §5's row names it since decision 6 of 2026-11-10 took `compile.ts`, the §7 row that carried this wait, to MIG-B9-17). Under README §7: MIG-B9-16 (`packages/playground-nextjs/**`: the two pages whose three-cases sentence C3 edits), MIG-B9-20 (`fixtures/release-1.0/run.js`, `migration.md`, the playground, and the tests it rewrites when it removes `includeTheme`) and MIG-B9-25 (`compile-sass.test.js`, `fixtures/release-1.0/verdicts.test.js`) |
| Blocks | MIG-B9-17 (decision 6 of 2026-11-10) and MIG-B9-91. Under README §7: MIG-B9-27 (`compile.md`, `migration.md`); MIG-B9-28 (`compile-sass.test.js`); MIG-B9-30, 32, 33, 34, 35, 37 and 38 (`diagnostics.ts`); MIG-B9-30 and 31 (`fixtures/release-1.0/run.js`); MIG-B9-30, 33, 34, 35, 36 and 19 (`packages/playground-nextjs/**`; MIG-B9-19 in MIG-B9-39's place, by decision 28 of 2026-11-13); in `0.5.0-beta.10`, MIG-B9-40 to 43 (the playground), MIG-B9-52 (`migration.md`) and, provisionally, MIG-B9-66 (`verdicts.test.js`; decision 15 of 2026-11-10). MIG-B9-24 shares no file with this story under the answers its §15 assumes |
| Base | `feat/beta9` after MIG-B9-16, after MIG-B9-20, after MIG-B9-21 and after MIG-B9-25. §3 and §4 were recorded on `f855765`, before any of the four; they are re-run on that base before work starts |
| Owns | None: the test file this story adds is shared with MIG-B9-17 (below) |
| Shares | `packages/uxdsl/test/core/sass-stage-diagnostics.test.js` (new: this story makes it, and MIG-B9-17 adds its T6 and T8); `packages/uxdsl/src/sass/protect.ts` (C1); `packages/uxdsl/src/sass/compile-sass.ts` (C2, C3, C9 (decision 30 of 2026-11-10) and its header comment); `packages/uxdsl/src/diagnostics.ts` (`UXD_SASS_WARNING`'s meaning); `packages/uxdsl/test/near-miss-functions.test.js` (`SASS_REJECTS`); `packages/uxdsl/test/core/compile-sass.test.js` (the twin's logger and "debug is dropped"); `fixtures/release-1.0/run.js` and `fixtures/release-1.0/verdicts.test.js` (S-7); `packages/uxdsl/docs/integrations/compile.md`; `packages/uxdsl/docs/migration.md` (item 6 of "beta.9 — Sass inside compile()"); `packages/uxdsl/README.md` ("From SCSS", and one sentence); `packages/uxdsl/CHANGELOG.md`; `packages/playground-nextjs/src/app/docs/introduction/page.mdx` and `packages/playground-nextjs/src/app/docs/language/page.tsx` (the three-cases sentence only, C3) |
| Output impact | API/CLI: `compile()`'s `warnings` gain one per `@debug` (C2); a dotted near-miss fails with the plugin's error instead of `UXD_SASS` (C1); a project name with the `uxdsl-probe-` prefix gets Dart Sass's CSS (C3); `compile()` run from a script read on standard input (`node -`) compiles instead of rejecting with `ERR_INVALID_ARG_VALUE` (C9, decision 30 of 2026-11-10). No other compiled CSS changes. The isolation warnings (C4 to C6, one new catalogued code) are MIG-B9-17's |

## 1. Goal

Through `compile()`, a near-miss with a dotted argument (`palete(primary.main)`)
fails as it fails through `uxdsl/postcss`, naming the function meant, and every
`@debug` Dart Sass evaluates reaches the build as a located warning. No project
name can change what the Sass stage's probe decides. Compiled CSS stays as it
is, except for a project that named something with the probe's prefix, which
now gets Dart Sass's CSS. The four cases in which `@use`'s module isolation
changes a build without an error are MIG-B9-17's (decision 6 of 2026-11-10).

## 2. Sources

- The registration, decision D5 of 2026-11-04 (`docs/features/FEAT-010-beta9.md:180`):

  > **D5 — MIG-B9-26 registered,** "Dotted near-misses keep DEC-02's "did you mean" through `compile()`; Sass's `@debug` reaches the build as a warning": S, wave 2, after MIG-B9-14 (which makes the CLI print `compile()`'s warnings). It answers MIG-B9-13's owner flag 10 (`palete(primary.main)` through `compile()` is `UXD_SASS: expected "(".`, with no suggestion) and MIG-B9-12's owner flag 8 (`@debug` dropped).

- Decision D12 of 2026-11-04 (`FEAT-010-beta9.md:187`):

  > **D12 — Sass's `@debug` output** is accepted as dropped for now; MIG-B9-26 shows it as a warning.

- The sources of C4 to C6 (the extension on MIG-B9-14's flag 3, decision of
  2026-11-08; MIG-B9-14 §15's owner flag 3 and its follow-up; README §7's
  note on `diagnostics.ts`; the isolation pins in `uxdsl-cli.test.js`,
  `cli.md` and `migration.md` item 9) moved with them to MIG-B9-17 §2, by
  decision 6 of 2026-11-10.

- The extension on MIG-B9-15's flag 1, decision of 2026-11-08, as FEAT-010 §2 points to it (`FEAT-010-beta9.md:232–233`):

  > flag 1, D3's sentence, which also gives MIG-B9-26 the removal of the
  > `uxdsl-probe-` prefix exception;

  and as MIG-B9-15 §15 records it (`MIG-B9-15-superset-docs.md:434`):

  > **Flag 1, D3's sentence:** qualified rather than left unqualified. The package README, `compile.md` and the introduction page now say that every SCSS file is a valid UXDSL file except in the three cases `compile.md` documents: a `$variable` Sass keeps as written (`UXD_SASS_CONTEXT`), text Sass prints that is not CSS (a parse error), and a project function named with the Sass stage's internal prefix `uxdsl-probe-`. "No name is reserved" now reads "No UXDSL name is reserved", with the prefix named as the one exception. MIG-B9-26 removes the prefix exception (a located error for a project definition with the prefix, or an unguessable prefix). Applied in this PR, after the closure record, by the commit that adds this block.

  The flag itself (`MIG-B9-15-superset-docs.md:382`): "a project function named with the internal `uxdsl-probe-` prefix silently changes the output of a build that also defines a function named like UXDSL's, which makes the prefix reserved in practice." Its follow-up (`:419`): "Give a project definition with the prefix a located error, or use a prefix no project would write."

- MIG-B9-13 §15, owner flag 10 (`MIG-B9-13-compile-on-sass.md:672–674`):

  > **DEC-02 partly regresses through `compile()`.** `palete(primary.main)`, `pallete(…)` and `pallet(…)` become Dart Sass's `UXD_SASS: expected "(".`: still located, but without "did you mean". Dart Sass parses `primary.main` as a module member before the plugin runs.
  >
  > The fix belongs in `protect.ts` (MIG-B9-11's module, outside Owns and Shares): treat a near-miss call whose argument Sass cannot parse as a kept token. Through `uxdsl/postcss`, all 11 near-misses keep `UXD_FUNCTION_UNKNOWN`. Decide whether this waits for a follow-up story (below) or comes here, widening Shares.

  Its decision (`:821`): "The flag's own question, whether the fix waits for a follow-up story or comes here, is answered: it waits for MIG-B9-26."
- MIG-B9-12 §15, owner flag 8 (`MIG-B9-12-compile-sass.md:590`): "**`sassFrame`** is the frame and stack without the message line, never colored. `@debug` output is dropped (W4), whereas Dart Sass prints it."
- DEC-02 (`FEAT-010-beta9.md:94`): "every near-miss of a UXDSL function name is an error with a "did you mean". With the review's precisions: a real CSS function (`shape()`) is never flagged; a top-level name one edit from a breakpoint stays `UXD_BREAKPOINT_UNKNOWN`; the check lives in `language.ts`, so theme values fail the same way."
- DEC-17 (`FEAT-010-beta9.md:107`): "Where Sass calls it by its bare name (the same file, a file loaded with `@import`, `@use … as *`), the name means the author's function and the output is what Dart Sass produces; UXDSL emits one warning, located at the definition […]. A function reached only through a namespace (`helpers.space()`) shadows nothing, and mixins never conflict."
- The code and the pins, on `f855765`:
  - `packages/uxdsl/src/sass/compile-sass.ts:49–51`: "Every Sass warning is a `UXD_SASS_WARNING: …` warning, located like an error; an `@warn` is located by its stack frame. Sass's own cap (five per deprecation type, then a summary) applies; debug output is dropped." Line 660, in the reporting logger: `debug: () => undefined,`.
  - `compile-sass.ts:97–99`: "The `uxdsl-probe-` prefix is reserved for the probe: its functions, and the namespace under which it reaches `sass:meta`." The probe's names: `uxdsl-probe-builtin`, `-site`, `-pick`, `-eof`, `-cap`, `-replay` and the namespace `uxdsl-probe-meta` (`:156`, `:836–1100`).
  - `packages/uxdsl/test/near-miss-functions.test.js:42–44`: "Dart Sass reads a dotted argument as a module member, so through compile() a near-miss of palette() with a dotted key fails in Sass, located, before the plugin can name the function meant." `const SASS_REJECTS = new Set(['palete(primary.main)', 'pallete(primary.main)', 'pallet(primary.main)']);`
  - `packages/uxdsl/test/core/compile-sass.test.js:1096` and `:1109–1111`: the test titled "… @warn is reported; debug is dropped" ends with `assert.deepEqual(debug.actual.warnings, []);`, and the Dart Sass twin's logger (`:108`) has `debug() {}`.
  - `packages/uxdsl/docs/integrations/compile.md:490–493`: "**A dotted near-miss** such as `palete(primary.main)` is Dart Sass's `UXD_SASS: expected "(".` through `compile()`, before the plugin's `UXD_FUNCTION_UNKNOWN` suggestion can run"; `:501`: "an `@debug` prints nothing."; `:385–386`: "No UXDSL name is reserved; the one exception is the Sass stage's own helper prefix, `uxdsl-probe-`"; `:425–430`, the third recorded difference.
  - `packages/uxdsl/README.md:118–125` ("From SCSS"): "every SCSS file is a valid UXDSL file, except in three cases […] and a project function named with the Sass stage's internal prefix `uxdsl-probe-` can change the output."
  - `packages/uxdsl/docs/migration.md:145–148` (item 6) gives the dotted near-miss as `UXD_SASS`.

## 3. Preconditions

```bash
git merge-base --is-ancestor db0e28d HEAD                                       # MIG-B9-14 (PR #71): the CLI prints compile()'s warnings
grep -qF "debug: () => undefined," packages/uxdsl/src/sass/compile-sass.ts      # @debug is dropped (D12)
grep -qF "const SASS_REJECTS = new Set(['palete(primary.main)', 'pallete(primary.main)', 'pallet(primary.main)']);" packages/uxdsl/test/near-miss-functions.test.js   # MIG-B9-13's flag 10, pinned
grep -qF "assert.deepEqual(debug.actual.warnings, []);" packages/uxdsl/test/core/compile-sass.test.js   # "debug is dropped", pinned
grep -qF "'uxdsl-probe-pick(\$value)': (args) => args[0]," packages/uxdsl/src/sass/compile-sass.ts      # the probe's prefix
grep -qF 'internal prefix `uxdsl-probe-`' packages/uxdsl/README.md              # the documented exception (MIG-B9-15's flag 1)
grep -qF "a function call and a !default change without an error" packages/uxdsl/test/cli/uxdsl-cli.test.js   # isolation's silent cases, pinned
grep -qF "with no error or warning, while a bare variable or mixin fails" packages/uxdsl/test/cli/uxdsl-cli.test.js
grep -qF '`@debug` prints nothing.' packages/uxdsl/docs/integrations/compile.md
node -e "const d = require('./packages/uxdsl/dist/diagnostics'); process.exit(d.DIAGNOSTIC_CODES.has('UXD_SASS_WARNING') && d.DIAGNOSTIC_CODES.has('UXD_FUNCTION_UNKNOWN') && !d.DIAGNOSTIC_CODES.has('UXD_MODULE_ISOLATION') ? 0 : 1)"
```

All ten exit 0 on `f855765` (2026-11-10, Node 20.19.0, npm 11.21.1, after the
README §1 preparation).

When the story starts, these four start gates also exit 0. On `f855765` each
exits 1, by design: none of the four stories is merged yet.

```bash
! command grep -qx "To be filled in the delivering PR." docs/features/FEAT-010/MIG-B9-16-language-page-superset.md   # MIG-B9-16 merged: its closure record is filled
! command grep -q "includeTheme" packages/uxdsl/src/types.ts                                                         # MIG-B9-20 merged: the option is gone
test ! -f packages/uxdsl/src/ds-runtime/breakpoints.ts                                                              # MIG-B9-21 merged: K4 deleted the file
! command grep -qx "To be filled in the delivering PR." docs/features/FEAT-010/MIG-B9-25-suites-remove-temp-dirs.md      # MIG-B9-25 merged: its closure record is filled
```

None of the four is expected to change a line of the first block. A line
that only went stale (a line moved, a test renamed) is corrected in the
story with the old and the new line recorded in §15 (README §1, item 4).

**BASE** is the `feat/beta9` commit the branch starts from,
`git merge-base HEAD origin/feat/beta9`. Every "as on BASE" below is against
it, not against `f855765`.

## 4. Baseline

Run from the repository root after `npm --prefix packages/uxdsl run build`.
The script is written to a file: `compile()` cannot run from a script read on
standard input (`node -`), see §15, finding F1.

```bash
cat > "$TMPDIR/mig-b9-26-baseline.js" <<'EOF'
'use strict';
const fs = require('fs'); const os = require('os'); const path = require('path');
const { spawnSync } = require('child_process');
const core = require(path.resolve('packages/uxdsl/dist/entries/index.js'));
const loaded = require(path.resolve('packages/uxdsl/dist/plugin')); const plugin = loaded.default || loaded;
const postcss = require(path.resolve('packages/uxdsl/node_modules/postcss'));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-b9-26-'));
const put = (dir, files) => { for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); } return dir; };
const rel = (s) => String(s).split(root + path.sep).join('');
const err = (e) => (e ? `${e.code || e.name}${e.file ? ` ${rel(e.file)}:${e.line}:${e.column}` : ""} ${(e.reason || e.sassMessage || e.message).split("\n")[0]}` : "compiled");
const cli = (dir, ...args) => spawnSync(process.execPath, [path.resolve('packages/uxdsl/bin/uxdsl.js'), ...args], { cwd: dir, encoding: 'utf8' });
const opts = { includeTheme: false, discoverTheme: false };
const config = (entry) => `module.exports = { entry: './src/${entry}', outFile: './out/app.css', includeTheme: false };\n`;
(async () => {
  console.log('B1 a near-miss with a dotted argument (compile() | uxdsl/postcss)');
  const from = path.join(root, 'b1/src/panel.uxdsl');
  for (const value of ['palete(primary.main)', 'xs(palete(primary.main)) md(red)', 'xd(primary.main)', 'palete(primary)']) {
    const source = `.a {\n  color: ${value};\n}\n`;
    const c = await core.compile({ source, from }, opts).then(() => null, (e) => e);
    const p = await postcss([plugin(opts)]).process(source, { from }).then(() => null, (e) => e);
    console.log(`  ${value}\n    ${err(c)}\n    ${err(p)}`);
  }
  const b2 = put(path.join(root, 'b2'), { 'uxdsl.config.cjs': config('main.uxdsl'), 'src/main.uxdsl': '.a {\n  color: palete(primary.main);\n}\n' });
  const r2 = cli(b2, 'build');
  console.log(`B2 uxdsl build: exit ${r2.status}; ${r2.stderr.split('\n')[0]}`);
  const b3 = put(path.join(root, 'b3'), { 'uxdsl.config.cjs': config('main.uxdsl'), 'src/_part.scss': '@debug "from a .scss partial";\n', 'src/main.uxdsl': "@use './part';\n$gap: 4px;\n@debug \"gap is #{$gap}\";\n.a {\n  padding: space(2);\n}\n" });
  const r3 = await core.compile({ entry: path.join(b3, 'src/main.uxdsl') }, opts);
  const c3 = cli(b3, 'build');
  console.log(`B3 @debug: compile() warnings ${JSON.stringify(r3.warnings)}; uxdsl build exit ${c3.status}, stderr ${JSON.stringify(c3.stderr)}`);
  console.log('B4 a project function named with the uxdsl-probe- prefix, beside @function space (Dart Sass: v: space(2), then v: 6px)');
  const mixed = (name) => `@function ${name}($value) {\n  @return 1;\n}\n@mixin m {\n  v: space(2);\n}\n.a {\n  @include m;\n}\n@function space($n) {\n  @return $n * 3px;\n}\n.b {\n  @include m;\n}\n`;
  for (const name of ['my-pick', 'uxdsl-probe-pick', 'uxdsl-probe-replay', 'uxdsl-probe-site']) {
    const r = await core.compile({ source: mixed(name), from }, opts).then((x) => JSON.stringify(x.css.replace(/\s+/g, ' ')), (e) => err(e));
    console.log(`  ${name}: ${r}`);
  }
  const meta = '@use "sass:math" as uxdsl-probe-meta;\n@function get-function($n) {\n  @return null;\n}\n@function space($n) {\n  @return $n * 3px;\n}\n.a {\n  v: space(2);\n}\n';
  console.log(`  @use "sass:math" as uxdsl-probe-meta: ${await core.compile({ source: meta, from }, opts).then((x) => JSON.stringify(x.css.replace(/\s+/g, ' ')), (e) => err(e))}`);
  fs.rmSync(root, { recursive: true, force: true });
})();
EOF
node "$TMPDIR/mig-b9-26-baseline.js"; echo "exit=$?"; rm "$TMPDIR/mig-b9-26-baseline.js"
```

On a base that includes MIG-B9-20, which removes `includeTheme`, the
script's `includeTheme: false` (in `opts` and in `config`) is dropped first;
nothing else in it changes. Recorded on `f855765`, 2026-11-10 09:17 EST,
exit 0, exactly, with a fifth part, B5, that moved to MIG-B9-17's §4 with C4
to C6 (decision 6 of 2026-11-10). The script without B5 was run again on
`e704b3e` (2026-11-10, 14:06 EST; the package's code is `f855765`'s) and
printed the same lines, exit 0:

```text
B1 a near-miss with a dotted argument (compile() | uxdsl/postcss)
  palete(primary.main)
    UXD_SASS b1/src/panel.uxdsl:2:29 expected "(".
    CssSyntaxError b1/src/panel.uxdsl:2:10 UXD_FUNCTION_UNKNOWN: palete() is not a function CSS or UXDSL knows; did you mean palette()?
  xs(palete(primary.main)) md(red)
    UXD_SASS b1/src/panel.uxdsl:2:32 expected "(".
    CssSyntaxError b1/src/panel.uxdsl:2:13 UXD_FUNCTION_UNKNOWN: palete() is not a function CSS or UXDSL knows; did you mean palette()?
  xd(primary.main)
    UXD_SASS b1/src/panel.uxdsl:2:25 expected "(".
    CssSyntaxError b1/src/panel.uxdsl:2:3 UXD_BREAKPOINT_UNKNOWN: xd(...) is not a configured breakpoint or a known CSS function; configured breakpoints: xs, sm, md, lg, xl.
  palete(primary)
    CssSyntaxError b1/src/panel.uxdsl:2:3 UXD_FUNCTION_UNKNOWN: palete() is not a function CSS or UXDSL knows; did you mean palette()?
    CssSyntaxError b1/src/panel.uxdsl:2:10 UXD_FUNCTION_UNKNOWN: palete() is not a function CSS or UXDSL knows; did you mean palette()?
B2 uxdsl build: exit 1; [uxdsl] Error: src/main.uxdsl:2:29: UXD_SASS: expected "(".
B3 @debug: compile() warnings []; uxdsl build exit 0, stderr ""
B4 a project function named with the uxdsl-probe- prefix, beside @function space (Dart Sass: v: space(2), then v: 6px)
  my-pick: ".a { v: var(--uxdsl__space__2); } .b { v: 6px; }"
  uxdsl-probe-pick: ".a { v: 1; } .b { v: 1; }"
  uxdsl-probe-replay: Error uxdsl: the Sass stage's build evaluated a call other than its probe did (an internal error)
  uxdsl-probe-site: ".a { v: var(--uxdsl__space__2); } .b { v: var(--uxdsl__space__2); }"
  @use "sass:math" as uxdsl-probe-meta: Error uxdsl: the Sass stage's probe failed where the build did not (an internal error): There's already a module with namespace "uxdsl-probe-meta".
```

What it shows:

- **B1, B2.** A dotted near-miss is Dart Sass's `UXD_SASS` through `compile()`
  and the CLI, where `uxdsl/postcss` names the function meant. An undotted one
  already gives the plugin's error through `compile()`, located at the
  declaration's start (`2:3`), which is the form C1 asks of the dotted one.
  `xd(primary.main)` is a breakpoint near-miss: the plugin gives
  `UXD_BREAKPOINT_UNKNOWN` (DEC-02's precision).
- **B3.** Dart Sass's own logger receives two `debug` calls for this input
  (`src/_part.scss:1:1 DEBUG: from a .scss partial`, then
  `src/main.uxdsl:3:1 DEBUG: gap is 4px`); `compile()` returns no warning and
  the CLI prints nothing. Dart Sass's CLI prints each `@debug` as
  `<file>:<line> DEBUG: <message>`, one line per evaluation (a `@debug` in a
  loop prints once per iteration), and `quietDeps` does not silence it (both
  checked with the repository's `sass` 1.107.0).
- **B4.** MIG-B9-15's R3 (`v: 1` twice) reproduces, and the prefix does more:
  a project `uxdsl-probe-replay` or a `@use … as uxdsl-probe-meta` in a build
  that defines `get-function` makes `compile()` throw an internal error where
  Dart Sass compiles, and a project `uxdsl-probe-site` turns `.b`'s `6px`
  into the token. The prefix matters only where a call is probed: with no
  function named like UXDSL's, a project `uxdsl-probe-pick` is called like any
  function.

The pins, each exit 0 on `f855765` (with `TMPDIR` set to a scratch directory):

```bash
node --test packages/uxdsl/test/near-miss-functions.test.js                                       # 5 pass: SASS_REJECTS pins UXD_SASS for the three dotted calls
node --test --test-name-pattern="debug is dropped" packages/uxdsl/test/core/compile-sass.test.js  # 1 pass, 56 skipped: pins []
```

The third pin, on the isolation cases' empty stderr, moved to MIG-B9-17's §4.

The Bootstrap corpus, for C7 (Bootstrap 5.3.8's `scss/` copied from
`npm pack bootstrap@5.3.8`, every file renamed to `.uxdsl`, compiled with
`compile({ entry: 'bootstrap.uxdsl' }, { includeTheme: false })` against
Dart Sass on the `.scss` original, in a scratch directory; not `run.js`,
which installs into the repository): 92 files, 276,926 bytes, byte-identical,
21 warnings, none from `@debug`. Bootstrap's SCSS has no `@debug`, 27
`@function` definitions and 1,043 `!default` declarations, all in files
loaded with `@import`. Its compiled CSS calls none of its 27 function names
(0 matches of `<name>(`). Timing, indicative only (load average 12–15 while
another workflow ran the suites and Chrome): warm medians 352 ms (Dart Sass)
and 475 ms (`compile()`), 1.35×.

## 5. Contract

The contract assumes the recommended option of each §15 question until the
owner answers it. Each item names its part for Q1: part 1 is C1 to C3, part 2
is C4 to C6; C7 and C8 apply to both. The owner answered on 2026-11-10 (§15,
"Owner decisions of 2026-11-10"): this story is part 1, and part 2 is
MIG-B9-17 (decision 6).

- **C1 — A dotted near-miss fails as it fails through `uxdsl/postcss` (DEC-02; MIG-B9-13's flag 10; part 1).**
  In a `.uxdsl` file, take a call in a declaration value whose name
  `uxdsl/postcss` reports as a near-miss and whose first argument Dart Sass
  cannot parse as written, because it is a key with a dot followed by an
  identifier (`primary.main`). The call may sit at the top of the value or
  inside another function (`xs(…)`, `calc(…)`).
  - Through `compile()` it fails with the error `uxdsl/postcss` gives for the
    same declaration: the same code (`UXD_FUNCTION_UNKNOWN`, or
    `UXD_BREAKPOINT_UNKNOWN` for a top-level name one edit from a breakpoint)
    and the same message. It is located at the declaration's file and line,
    at the column where `compile()` locates the plugin's errors: the
    declaration's start, `2:3` in §4's B1, as for `palete(primary)` today.
  - Covered at least: `palete`, `pallete`, `pallet`, `pallette`, `palettes`,
    `paltte` and `PALETE(primary.main)`, `palete(primary.main, 0.5)`,
    `xs(palete(primary.main)) md(red)`, `calc(palete(primary.main) + 1px)`
    and `xd(primary.main)`.
  - `uxdsl build` exits 1 and prints
    `[uxdsl] Error: uxdsl: src/main.uxdsl:2:3: UXD_FUNCTION_UNKNOWN: palete() is not a function CSS or UXDSL knows; did you mean palette()?`,
    then the plugin's frame, as for an undotted near-miss. On BASE:
    `[uxdsl] Error: src/main.uxdsl:2:29: UXD_SASS: expected "(".`.
  - Stays as on BASE:
    - a call Sass parses: `palete(primary)`, `colour(gray.300)` and
      `colors(blue.700)` (the plugin's error already); with a project
      `@function colour`, `colour(gray.300)` is that function's value;
    - the same dotted call in a selector or in an at-rule prelude
      (`UXD_SASS`: no compiled selector or prelude may carry an unchecked
      near-miss);
    - in a `.scss`, `.sass` or `.css` file, which Dart Sass reads as written
      (the extension rule MIG-B9-15 documents): `UXD_SASS`;
    - after a `@function` of that name in the same file (DEC-17: the call
      means the author's function, and Dart Sass's error stays);
    - in a custom property or a directive's arguments, where Sass never
      parses the call: the plugin's error already.
- **C2 — Each `@debug` is a warning (D12; MIG-B9-12's flag 8; part 1; Q2 (a)).**
  - **What becomes a warning.** Each evaluation of a `@debug` in any file the
    build loads is one `compile()` warning: `.uxdsl`, `.scss` or `.sass`, a
    load-path or `pkg:` dependency, with `quietDeps` or without.
  - **Its form.** `{ text: 'UXD_SASS_WARNING: DEBUG: <first line of Sass's message>', file, line, column }`,
    at the `@debug` rule's start, the author's column through protect's map.
  - **Its order.** Sass's order among the Sass warnings, before the
    `UXD_FUNCTION_SHADOWED` ones. For §4's B3:
    `src/_part.scss:1:1` `UXD_SASS_WARNING: DEBUG: from a .scss partial`, then
    `src/main.uxdsl:3:1` `UXD_SASS_WARNING: DEBUG: gap is 4px`.
  - **The CLI.** `uxdsl build` exits 0 and prints each, as it prints every
    warning: `[uxdsl] Warning: src/main.uxdsl:3:1: UXD_SASS_WARNING: DEBUG: gap is 4px`.
  - **Before a failure.** A `@debug` evaluated before a failure is on the
    thrown error's `warnings` (MIG-B9-21's `error.warnings`), in the same
    form and order.
  - **The catalog.** `DIAGNOSTIC_CATALOG`'s meaning of `UXD_SASS_WARNING`
    names `@debug`.
  - **The plugin alone.** Through `uxdsl/postcss` alone, `@debug` stays
    `UXD_SASS_CONTEXT` (DEC-05).
- **C3 — No project name changes what `compile()` produces (MIG-B9-15's flag 1; part 1; Q3 (c)).**
  - A project `@function`, `@mixin`, variable or `@use … as` namespace named
    with any prefix, `uxdsl-probe-` included, compiles as it compiles under
    another name.
  - §4's B4 cases `uxdsl-probe-pick`, `uxdsl-probe-replay` and
    `uxdsl-probe-site` each give `.a { v: var(--uxdsl__space__2); } .b { v: 6px; }`
    with one `UXD_FUNCTION_SHADOWED` at `10:11`, as `my-pick` does on
    `f855765`.
  - The namespace case gives `.a { v: 6px; }` with one
    `UXD_FUNCTION_SHADOWED` at `5:11`, as the same input with the namespace
    `my-meta` does on `f855765`; Dart Sass gives `v: 6px`.
  - The stage's own names reach no result: not `css`, `map`, `dependencies`,
    `warnings`, nor an error's message or frame.
  - Two `compile()` calls with the same input return equal results.
  - The documentation drops the prefix exception: the package README's "From
    SCSS" names two cases, not three; compile.md's "the one exception"
    sentence goes, and its recorded differences are two, not three. The two
    playground pages that carry the same sentence follow it: the
    introduction page (`page.mdx:53` on `f855765`, "apart from three edge
    cases the `compile()` guide documents") and `/docs/language`, where
    MIG-B9-16's C1.2 writes it. These are the three places the owner's
    decision on MIG-B9-15's flag 1 names ("The package README, `compile.md`
    and the introduction page"), plus the page MIG-B9-16 adds.
- **C4 to C6 — Module isolation's silent cases (part 2).** MIG-B9-17, under
  the same numbers, by decision 6 of 2026-11-10.
- **C7 — Everything else stays silent (the negative controls of parts 1 and 2).**
  - The same files through an `@import` entry, or with the reading file's own
    `@use … as *`, share their members, and nothing new warns.
    `UXD_FUNCTION_SHADOWED` is as on BASE.
  - A call through the namespace (`helpers.double(4px)`, `helpers.space(2)`)
    warns nothing new.
  - A function no loaded file defines (`foo(1px)`) and a CSS function the
    compiler knows warn nothing.
  - A file with no `@debug` gets BASE's warnings, in BASE's order.
  - `uxdsl/postcss` alone is unchanged in everything.
- **C8 — The cost (both parts).**
  - **Dart Sass runs as often as on BASE** in a build whose loaded files
    define no `@function` named like a UXDSL function and in which no `.uxdsl`
    module declares a top-level `!default`. C4 reads Dart Sass's output and
    never compiles again.
  - **The Bootstrap corpus, by P10's method (MIG-B9-23's C1).** On the
    machine where P10 was measured (`sysctl -n hw.model` prints
    `MacBookPro18,3`), `node fixtures/sass-corpus/run.js` exits 0 on three
    consecutive invocations from the repository root: the first three after
    the last change to `compile-sass.ts` or `protect.ts`, run in a row, none
    discarded or repeated. Each prints `byte-identical: true`, BASE's warning
    count (21 on `f855765`) and a ratio within P10's 1.5× budget.

Must stay byte-identical with BASE:

- for every input that compiles on BASE, `compile()`'s `css`, `map` and
  `dependencies`, except for a project that names a function, mixin,
  variable or namespace with the `uxdsl-probe-` prefix (C3);
- `compile()`'s `warnings`: BASE's, in BASE's order, plus only C2's
  additions (C4 to C6's are MIG-B9-17's);
- every error on BASE, except C1's dotted near-misses and C3's internal
  errors, which then compile;
- `uxdsl/postcss` used alone, in everything;
- the parity oracles (`fixtures/parity/expected/**`), without `--update`;
- the Bootstrap corpus: 276,926 bytes and 21 warnings on `f855765`;
- the playground: `src/app/uxdsl.css`, the warning lines of its `uxdsl:build`,
  `src/generated/examples.json`, and the CLI and compiler captures; no
  playground file is edited but the three-cases sentence of the introduction
  page and of `/docs/language` (C3);
- `DIAGNOSTIC_CATALOG`: BASE's codes, with `UXD_SASS_WARNING`'s meaning
  extended (Q2 (a)); every other entry as on BASE (`UXD_MODULE_ISOLATION`,
  Q4 (a), is MIG-B9-17's).

## 6. Out of scope

- **A near-miss name that another file of the build defines as a `@function`.**
  The dotted call fails either way. Through `compile()` it is reported as
  `UXD_FUNCTION_UNKNOWN`, whose message does not know the project's function;
  only a same-file definition keeps Sass's error (C1). Recorded; no
  destination.
- **Near-misses in selectors and at-rule preludes, and in `.scss`, `.sass` or
  `.css` files:** they keep Dart Sass's error (C1), because the plugin checks
  function names only in declaration values (DEC-02), and Dart Sass reads
  those files as written (MIG-B9-15's extension rule). No destination.
- **Module isolation's silent cases (C4 to C6) and the out-of-scope items
  that concern them** (`generate-entry`'s warning when it replaces an
  `@import` entry, an `--import` escape hatch, the isolation of variables,
  mixins and placeholders, a `/docs/diagnostics` capture of
  `UXD_MODULE_ISOLATION`): MIG-B9-17, by decision 6 of 2026-11-10.
- **`error.warnings` itself:** MIG-B9-21. C2 only relies on it.
- **SH-4 and RR-1,** the other recorded differences of functions named like
  UXDSL's: accepted by decision D19 of 2026-11-04 (MIG-B9-12's flags 18 and
  19). Unchanged.
- **`compile()` from a script read on standard input:** §15, finding F1.
- **Windows:** MIG-B9-28.

## 7. Approach and traps

Non-normative.

1. **C1 in `protect.ts`.** Treat a call whose name is not a token function
   like a protected token call, rewritten `#{"name(key…)"}`, when four things
   hold:
   - the first argument is key-like and holds `<identifier>.<identifier>`;
   - `unknownFunctionMessage` from `language.ts` gives a message for the name,
     with the reserved names as breakpoints, or the name is one edit from a
     breakpoint;
   - no `@function` of that name precedes it in the file, nor is the name in
     `options.unprotected`;
   - the call sits in a declaration value.

   Sass then passes the text through, and the plugin's existing check reports
   it, in a responsive value as at the top level. `language.ts` is imported,
   never edited, so its rule stays the only rule (DEC-02).
2. **C2 in `compile-sass.ts`.** The reporting logger's `debug(message, { span })`
   records an entry beside the warns, in the same list, so that Sass's order
   is kept. `convertWarning` writes it, located through `columnIn` like any
   span. The probe's passes keep Sass's silent logger.
3. **C3 (Q3 (c)).** Build every name the probe writes from one random tag
   made per `compileSassStage` call: its functions, its `sass:meta`
   namespace, `LOOKUP_CALL` and `MISSING_NAMESPACE`. Keep the tag in the
   call's `Stage`. Nothing is shared between calls, as the module's header
   requires.
4. **C4 to C6:** MIG-B9-17's approach, items 4 to 6 (decision 6 of
   2026-11-10).

Traps:

- **Never make a loud error silent.** A near-miss protected in a selector or
  an at-rule prelude reaches the CSS unchecked: `.a:not(palete(primary.main))`
  would compile. Find the context by looking ahead to the first `;`, `{` or
  `}` at depth 0: a `{` means a selector or prelude. §8's T2 control covers
  it.
- **Never protect a call Sass can parse.** `colour(gray.300)` is Sass's to
  evaluate, and a project `@function colour` gives its value.
- **P10.**
  - `protect()` runs on every `.uxdsl` file. Test the dotted shape before
    calling `unknownFunctionMessage`.
  - The P10 traps of C4 to C6's detections are MIG-B9-17's.
- **C3's tag must reach no result.** Test with a scan of every result field
  and two compiles of the same input, including the corpus.
- **Positions.** The CLI already removes the working directory from every
  path in a message (`formatCliDiagnostic`), so `bin/uxdsl.js` needs no
  change. C4 to C6's positions, the `@use … with` trap and `compile.ts`'s
  `CompileResult.warnings` comment are MIG-B9-17's.
- **Comments.** `compile-sass.ts`'s header says "debug output is dropped"
  and "the `uxdsl-probe-` prefix is reserved". Rewrite each to state the new
  behavior, with no story id (README §2).
- **`TMPDIR`.** The new test file removes every directory it creates
  (`t.after`), unlike `compile-sass.test.js`'s `project()`.

Stop rule:

- **Stop if** C1 cannot be met without making a BASE error silent.
- The two stop rules of C4 to C6's detections are MIG-B9-17's.

Set the story to Blocked, with the measurements in §15; the owner decides
(README §2, "Authority"). Never change a test's assertion, the corpus
runner or P10's budget to pass.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `packages/uxdsl/test/near-miss-functions.test.js` (`SASS_REJECTS` removed) | `MIG-B9-26: every near-miss fails through compile() as through uxdsl/postcss, palete, pallete and pallet(primary.main) included: the same code and message, at the declaration` | unit (`uxdsl`, `uxdsl/postcss`) | C1 | the same test's canonical spellings (`palette(primary.main)`, `space(2)`) compile to their variables. Mutation: protect without the near-miss rule gives `UXD_SASS: expected "(".` and fails it |
| T2 | `packages/uxdsl/test/core/sass-stage-diagnostics.test.js` (new) | `MIG-B9-26: a dotted near-miss nested in a responsive value or calc(), with an alpha, in capitals, and a breakpoint's (xd(primary.main)) gives the plugin's error through compile() and uxdsl build (exit 1)` | unit, CLI subprocess | C1 | `MIG-B9-26: a dotted near-miss in a selector, an @media prelude, a .scss partial or after a same-file @function of that name stays UXD_SASS, and colour(gray.300) with a project @function colour is its value (negative control)`. A rule without the context guard compiles the selector silently and fails it |
| T3 | same | `MIG-B9-26: each @debug Dart Sass evaluates is a UXD_SASS_WARNING: DEBUG: warning at its rule, in Sass's order, from a .uxdsl, a .scss partial, a load-path dependency with quietDeps, and once per evaluation in a loop; uxdsl build prints it and exits 0` | unit, CLI subprocess | C2 | a `@warn` and an `[import]` deprecation in the same build keep BASE's text, with no `DEBUG:`. Mutation: `debug: () => undefined` restored fails it |
| T3b | same | `MIG-B9-26: a @debug evaluated before an @error is on the thrown error's warnings` | unit | C2 | the thrown error is BASE's (`UXD_SASS`, `"stop"`, `2:1`) |
| T4 | `packages/uxdsl/test/core/compile-sass.test.js` (the twin's logger writes `debug` as the stage does; the title's "debug is dropped" becomes "@debug is reported") | the existing deprecation test, retitled `MIG-B9-12: … @warn is reported; @debug is reported as a warning` | unit | C2 | `assertSameAsTwin` compares the stage with the twin: a stage that drops `@debug` fails it |
| T5 | `packages/uxdsl/test/core/sass-stage-diagnostics.test.js` | `MIG-B9-26: a project function named uxdsl-probe-pick, uxdsl-probe-replay or uxdsl-probe-site, and a @use … as uxdsl-probe-meta in a build that defines get-function, compile as under any other name; no result holds the stage's own names, and two compiles are equal` | unit | C3 | the test first asserts that its input is probed (a call seen both ways: `.a` the token, `.b` `6px` under `my-pick`), so it cannot pass on a path that never probes. Mutation: the fixed `uxdsl-probe-` prefix gives `v: 1` twice and fails it |
| T9 | `fixtures/release-1.0/run.js` (S-7) and `fixtures/release-1.0/verdicts.test.js` | S-7 `[tarball] the installed CLI prints a dotted near-miss as UXD_FUNCTION_UNKNOWN with its suggestion (exit 1) and a @debug as a located warning (exit 0)`; `MIG-B9-26: S-7 rejects BASE's UXD_SASS line, an empty stderr and an unlocated warning (negative control)` | tarball | C1, C2 | the verdict test's control |
| T10 | `fixtures/sass-corpus/run.js` (unedited) | its own output | fixture | C8 | a detection that probes every build exceeds the budget |
| T11 | `packages/uxdsl/test/diagnostics-catalog.test.js`, `scripts/doc-examples.test.js`, `fixtures/parity/run.js` (unedited) | as they are | unit, docs, parity | C2, C7, the catalog and the documentation | their own |

T6, T7 and T8, and S-7's isolation case of T9, moved to MIG-B9-17 with C4
to C6 (decision 6 of 2026-11-10); they keep their ids there.

T1, T2, T3 and T5 fail on BASE, as §4 shows. T4 fails on BASE once the
twin's logger writes `@debug`. T3b needs MIG-B9-21's `error.warnings`. The
C7 controls pass on BASE by design, and each has a control that shows it
can fail.

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/near-miss-functions.test.js packages/uxdsl/test/core/sass-stage-diagnostics.test.js` exits 0, run with `TMPDIR` set to an empty scratch directory, which it leaves empty.
  - Test files: `near-miss-functions.test.js` and `sass-stage-diagnostics.test.js`.
  - Mutations, each failing it:
    - `protect.ts` without the near-miss rule (T1, T2);
    - the rule without the context guard (T2's control);
    - `debug: () => undefined` restored (T3);
    - the fixed `uxdsl-probe-` prefix (T5).
  - The mutations of T6 and T8 (each detection removed in turn; a probe
    compile on every build) moved to MIG-B9-17's AC1.
- **AC2** `node --test packages/uxdsl/test/core/compile-sass.test.js` exits 0.
  - Test file: `compile-sass.test.js`.
  - Mutation: a stage that drops `@debug` fails T4's twin comparison.
- **AC3 and AC4** (T7; `UXD_MODULE_ISOLATION` in the catalog) moved to
  MIG-B9-17 with C4 to C6 (decision 6 of 2026-11-10), under the same
  numbers.
- **AC5** `node fixtures/parity/run.js` exits 0 without `--update`, and `git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- fixtures/parity/expected` exits 0.
  - Test file: `fixtures/parity/run.js`.
  - Mutation: none; an invariant guard (C7).
- **AC6** On the machine where P10 was measured (`sysctl -n hw.model` prints
  `MacBookPro18,3`), `node fixtures/sass-corpus/run.js` exits 0 on three
  consecutive invocations from the repository root.
  - The three are the first invocations after the last change to
    `compile-sass.ts` or `protect.ts`, run in a row; none is discarded or
    repeated.
  - Each prints `byte-identical: true`, BASE's warning count and a ratio
    within the 1.5× budget.
  - §14 records each invocation's start time, load average, `$TMPDIR` entry
    count and output.
  - Test file: `fixtures/sass-corpus/run.js`, unedited.
  - Mutation: a detection that runs a probe compile on every build.
- **AC7** `npm run verify:doc-examples` exits 0, and `node scripts/generate-agent-guide.js --check` exits 0.
  - Test files: `scripts/doc-examples.test.js`, `scripts/agent-guide.test.js`.
  - Mutation: compile.md documenting the dotted near-miss as
    `UXD_FUNCTION_UNKNOWN` in an example while the code still gives
    `UXD_SASS` fails the first.
- **AC8** `node --test fixtures/release-1.0/verdicts.test.js` exits 0, and `npm run verify:1.0 -- --skip-playground-walk` exits 0 with S-7 `ok`.
  - Test files: `fixtures/release-1.0/run.js` and `verdicts.test.js`.
  - Mutation: BASE's tarball fails S-7.
- **AC9** The playground stays as it is, apart from the three-cases sentence
  of its introduction and `/docs/language` pages (C3).
  - `git diff --name-only "$(git merge-base HEAD origin/feat/beta9)" -- packages/playground-nextjs`
    lists only `src/app/docs/introduction/page.mdx` and
    `src/app/docs/language/page.tsx`.
  - `npm --prefix packages/playground-nextjs run uxdsl:build` exits 0 and
    prints `unchanged src/app/uxdsl.css`, with BASE's warning lines.
  - `node packages/playground-nextjs/scripts/capture-capabilities.js --check`
    exits 0.
  - Test file: the playground's build and the captures check.
  - Mutation: none; an invariant guard (C7, C8).
- **AC10** `npm test` exits 0.
  - Test files: the suites `npm test` runs.
  - Mutation: AC1's, which `npm test` runs.

Owner checks, never marked PASS by the agent:

- Answer §15's Q1 to Q6 before the story starts. The contract assumes each
  recommended option until then. (Answered on 2026-11-10: §15, "Owner
  decisions of 2026-11-10".)
- The review of the `UXD_MODULE_ISOLATION` messages and catalog entry moved
  to MIG-B9-17.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes: `protect.ts` and `compile-sass.ts` are in `VISUAL_DEFAULT_FILES`. One subsection under `## 0.5.0-beta.9 — unreleased`. Its `### Visual changes`: a project that named something with `uxdsl-probe-` gets Dart Sass's CSS (C3); none otherwise |
| package README | yes: the "From SCSS" exceptions (C3), and one sentence on the `@debug` warning |
| `verify-docs-update.js` classification | no (no file added under `src`; if one is added, it is classified) |
| `npm run generate:language` | no |
| `AGENTS.md` + agent guide | no. Its near-miss sentence (`AGENTS.md:771`) becomes true through `compile()`, and nothing it says about Sass warnings changes; `--check` runs (AC7) |
| `DIAGNOSTIC_CATALOG` | yes: `UXD_SASS_WARNING`'s meaning (`UXD_MODULE_ISOLATION` is MIG-B9-17's) |
| `npm run generate:capabilities` | run, no diff expected (the diagnostics capability is one row) |
| playground `uxdsl:build` + captures | run, no change expected (AC9) |
| `migration.md` | yes (item 6; item 9 is MIG-B9-17's) |
| `docs/architecture/unified-engine-audit.md` | no (the Sass stage's codes, line 59, gain `UXD_MODULE_ISOLATION` in MIG-B9-17) |

## 11. Documentation

- `packages/uxdsl/docs/integrations/compile.md`:
  - the "A dotted near-miss" bullet (`:490–493`): through `compile()` it now
    fails as through the plugin;
  - the "Warnings" bullet (`:494–501`): `@debug` is a `UXD_SASS_WARNING`;
  - "Functions named like UXDSL's" (`:383–386`) and its recorded differences
    (`:425–430`): the prefix exception goes (C3);
  - one example that documents the dotted near-miss's
    `UXD_FUNCTION_UNKNOWN`, compiled by the harness.
- `packages/uxdsl/docs/migration.md`, "beta.9 — Sass inside compile()": item
  6 (`:145–148`) is rewritten.
- `packages/uxdsl/README.md`: "From SCSS" (`:118–125`) with two exceptions
  (Q3 (c)), and one sentence beside the pipeline paragraph.
- `packages/uxdsl/CHANGELOG.md`: one subsection.
- MIG-B9-17 documents C4 to C6: `cli.md`'s `generate-entry`, item 9 of
  `migration.md`, and `unified-engine-audit.md:59`.
- `packages/playground-nextjs/src/app/docs/introduction/page.mdx` (line 53
  on `f855765`) and `packages/playground-nextjs/src/app/docs/language/page.tsx`
  (the sentence MIG-B9-16's C1.2 writes): the three-cases sentence, as the
  package README words it after C3 (Q3 (c): two cases). No other playground
  text changes.

## 12. Verification

```bash
TMPDIR=<empty dir> node --test packages/uxdsl/test/near-miss-functions.test.js packages/uxdsl/test/core/sass-stage-diagnostics.test.js   # exit 0; <empty dir> stays empty
node --test packages/uxdsl/test/core/compile-sass.test.js                                    # exit 0
node --test --test-concurrency=1 packages/uxdsl/test/performance/*.test.js                    # exit 0
node fixtures/parity/run.js                                                                  # exit 0
sysctl -n hw.model                                                                           # MacBookPro18,3 (AC6)
node fixtures/sass-corpus/run.js                                                             # exit 0, three times in a row after the last change to compile-sass.ts or protect.ts; record each start time, sysctl -n vm.loadavg, the $TMPDIR entry count and the output (network)
npm run verify:doc-examples                                                                  # exit 0
node scripts/generate-agent-guide.js --check && node scripts/generate-language-artifacts.js --check   # exit 0
npm --prefix packages/playground-nextjs run uxdsl:build                                      # exit 0; unchanged src/app/uxdsl.css
node packages/playground-nextjs/scripts/capture-capabilities.js --check                      # exit 0
npm test                                                                                     # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                                                 # background; exit 0, S-7 ok
npm run verify:playground-browser                                                            # background; exit 0 (Chrome; README §2, before a PR)
```

AC3's and AC4's commands moved to MIG-B9-17's §12; `npm test` still runs
both files.

## 13. Delivery

Branch `feat/b9-26-near-misses-debug-isolation`. Commit:
`feat(FEAT-010): MIG-B9-26 - dotted near-misses keep their suggestion through compile(), @debug is a warning, and no project name changes the probe`.

PR title: `FEAT-010: MIG-B9-26 - Dotted near-misses keep DEC-02's "did you mean" through compile(); Sass's @debug reaches the build as a warning`.
The body:

- **Goal:** §1, in two sentences.
- **The owner's answers:** Q1 to Q6, as given, and where the contract
  follows them.
- **C1 to C3:** §4's B1 to B4 before and after, from the same script.
- **C7 and C8:**
  - parity, the playground and the captures unchanged;
  - the corpus run's output.
- **Not run, or not a pass:** Windows; what an ubuntu CI run cannot show.
- **Owner checks:** the list in §9.
- The last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Open questions for the owner (answer before implementing)

1. **Q1 — One story or two?** As registered on 2026-11-04 the story is S: a
   change in `protect.ts` and one in the logger. The decisions of 2026-11-08
   add four detections, which need a probe extension in `compile-sass.ts`
   (1,474 lines) and a catalog code, and the prefix's removal.
   - (a) One M story, as this file is written. The full flow (D1) covers all
     of it.
   - (b) Two stories, both in wave 2:
     - **an S part:** C1 to C3, keeping MIG-B9-26;
     - **an M part:** C4 to C6, under an id the owner assigns.

     Each keeps its C-n, T-n and AC-n as numbered here, and C7 and C8 apply
     to both. Under §7 both parts are on `compile-sass.ts` and
     `diagnostics.ts`. Only the S part is on `packages/playground-nextjs/**`
     (C3's sentence). Only the M part is on `compile.ts`'s comment and
     `test/cli/**`, so MIG-B9-39 would wait for it there.

   **Recommendation: (b).** C1 to C3 are settled by the decisions, apart
   from Q2 and Q3. C4 to C6 depend on Q4 to Q6 and carry the design risk
   and P10's: the S part can merge through the light flow while the M part
   is designed. **Until answered:** one story (a).
2. **Q2 — `@debug`'s code (C2).**
   - (a) `UXD_SASS_WARNING`, its text `UXD_SASS_WARNING: DEBUG: <message>`
     after Dart Sass's own `DEBUG:` marker. The catalog's meaning of
     `UXD_SASS_WARNING` is extended to name `@debug`. No new code: the stage
     keeps one code for everything Sass's logger reports.
   - (b) A new code, `UXD_SASS_DEBUG`, with its own catalog entry, so a
     `@debug` is not read as a warning.

   Both edit `diagnostics.ts`. **Recommendation: (a).** D12 says "as a
   warning", and the brackets of `[<id>]` stay reserved for deprecation ids.
   **Until answered:** (a).
3. **Q3 — The prefix (C3).** MIG-B9-15's decision offers "a located error
   for a project definition with the prefix, or an unguessable prefix".
   - (a) A located error, with a new catalog code, for a project
     `@function`, `@mixin`, variable or namespace named `uxdsl-probe-…`. The
     README keeps three exceptions; the third becomes this error.
   - (b) A fixed prefix no project would write: a constant with a long tag.
     This is outside the decision, which names a located error or an
     unguessable prefix: a fixed name stays guessable from the source, so
     the exception is not removed, only made less likely to be hit. It is
     listed so the owner sees why it is not recommended.
   - (c) A tag made fresh for each `compile()` call, reaching no result.
     The exception goes entirely, and no code is added.

   **Recommendation: (c).** It removes the exception rather than making it
   loud, and needs no code. T5 pins that results are equal across calls and
   free of the tag. **Until answered:** (c).
4. **Q4 — The isolation code (C4 to C6).** MIG-B9-14's flag 3 says
   detection needs "a catalog code".
   - (a) One code for the four cases, `UXD_MODULE_ISOLATION`, owner `core`,
     with a message per case.
   - (b) One code per kind: an unresolved function call, a token-named
     function no call reaches, and a `!default` that applies.

   Either name is the owner's to change. **Recommendation: (a).** One cause
   (each file is its own Sass module), one fix (an `@use` or the namespace),
   and one catalog line. **Until answered:** (a), named
   `UXD_MODULE_ISOLATION`.
5. **Q5 — A function named like a UXDSL function and called through a
   namespace (C5).** DEC-17 and compile.md (`:394–396`) say that "a call
   through a namespace (`helpers.space(2)`) is the project's function and
   shadows nothing, and a bare `space(2)` in that file is the token". The
   decision of 2026-11-08 detects "a bare call under a namespaced `@use`".
   - (a) A bare call keeping the token warns only when no call of the build
     reaches the definition, through a namespace either. An author who calls
     `helpers.space()` and writes the token as `space()` deliberately gets no
     warning. §4's case 4, which never calls `helpers.space()`, warns.
   - (b) It warns whenever a bare call keeps the token while a loaded module
     defines the name, whatever else calls it. That is simpler: no probe
     instrumentation of function bodies. But the documented pattern above
     then warns, and the only way to silence it is to rename the function.

   **Recommendation: (a).** It keeps DEC-17's documented use silent.
   **Until answered:** (a).
6. **Q6 — When a `!default` warns (C6).** Two independent modules can each
   use `$padding`, one with `!default`, by design.
   - (a) Any build: an earlier, invisible top-level assignment of the same
     name.
   - (b) As (a), only where the earlier file emits no CSS of its own (a
     file of settings, like §4's `_a-config.uxdsl`), whose variables only a
     shared scope could have used.
   - (c) Only under an entry that `generate-entry` wrote. That couples
     `compile()` to the CLI's header text.

   **Recommendation: (b).** (a) warns on modules designed for `@use`, with
   no way to silence it but a rename. (c) misses a hand-written `@use`
   entry migrated from `@import`. **Until answered:** (b).

### Findings

- **F1 — `compile()` cannot run from a script read on standard input.**
  - **What fails.** With `node -` (the script on stdin), `compile()` rejects
    with `ERR_INVALID_ARG_VALUE` ("The argument 'filename' must be a file URL
    object, file URL string, or absolute path string. Received '-'").
  - **Where.** `compile-sass.ts:669` constructs
    `new sass.NodePackageImporter(path.dirname(stage.entryPath))`, and Dart
    Sass 1.107.0's constructor calls its `entrypointFilename` even when it
    is given a directory. `new NodePackageImporter(process.cwd())` alone
    throws the same from stdin.
  - **What works.** `node -e` and a script file.
  - **Who is affected.** A tool or a test harness that pipes a script into
    Node; the CLI and the adapters are not.
  - **Found** while writing §4, on `f855765`.
  - **Proposed:** MIG-B9-21, which edits `compile-sass.ts` for
    `error.warnings`, or an S story of its own. Not fixed here.
- **F2 — The prefix does more than MIG-B9-15's R3 recorded.** §4's B4 adds
  two internal errors where Dart Sass compiles: a project
  `uxdsl-probe-replay`, and a `@use … as uxdsl-probe-meta` in a build that
  defines `get-function`. It also adds a wrong token for a project
  `uxdsl-probe-site`. C3 covers all three.
- **F3 — Shares that README §7 does not list.**
  - `packages/uxdsl/test/near-miss-functions.test.js`,
    `packages/uxdsl/docs/integrations/cli.md`,
    `packages/uxdsl/docs/migration.md`, `compile.md` and
    `docs/architecture/unified-engine-audit.md` have no row. MIG-B9-20
    edits the first three (its `includeTheme` removal, and its §11), and
    MIG-B9-21 may edit the last, so the dependency on 20 and 21 covers them.
  - `fixtures/release-1.0/verdicts.test.js` has no row either; MIG-B9-14
    edited it, MIG-B9-25's story file shares it, and it belongs on
    `fixtures/release-1.0/run.js`'s row.
  - MIG-B9-27's story file (written beside this one) also edits
    `compile.md` and `migration.md` (item 4), and MIG-B9-28's edits
    `compile-sass.test.js` and `uxdsl-cli.test.js`; both rows come after
    this one in README §5, so both wait for this story on those files.
  - Proposed: add this story to the rows its header names, and rows for
    `compile.md` and `migration.md`, before it starts.

### Review of 2026-11-10 (applied in the PR that adds this file)

A static review of the seven wave-2 story files written on 2026-11-10. Its
findings on this story were applied before the owner's review:

- **The two playground pages (R1).** The owner's decision on MIG-B9-15's
  flag 1 names three places that carry the three-cases sentence; the
  introduction page was missing from C3, and `/docs/language` carries it
  once MIG-B9-16 merges. Both pages are in Shares, C3, AC9 and §11, so this
  story is on §7's `packages/playground-nextjs/**` row, after MIG-B9-16, 20
  and 22, and §3 gates on MIG-B9-16.
- **P10's method (R6).** C8 and AC6 use MIG-B9-23's AC1: the machine, three
  consecutive invocations after the last change to the Sass stage, none
  discarded.
- **MIG-B9-24 (R9).** Dropped from Blocks: MIG-B9-24's story file removes it
  from `compile.ts`'s row (its §15, new fact 3), and it shares no other file
  with this story under the answers it assumes.
- **Q3 (b) (R10).** Labelled as outside the decision, which names a located
  error or an unguessable prefix.
- **Start gates (R11).** §3 checks that MIG-B9-16, 20, 21 and 25 are in the
  base.
- **F3.** The index's §7 now lists this story on the rows of every file in
  Shares, with new rows for `compile.md`, `migration.md`, `cli.md`,
  `unified-engine-audit.md` and `fixtures/release-1.0/verdicts.test.js`.

### Owner decisions of 2026-11-10 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-10). The owner was given 32 numbered questions, in Spanish, on the open questions of the seven story files written on 2026-11-10 and on three notes of their PR (#80), each with its options and a recommendation, and answered, verbatim, "fusiona y haz como recmiendes" ("fusiona y haz como recomiendes", "merge, and do as you recommend"): PR #80 was merged, and each recommendation is the owner's decision of 2026-11-10. This record is in English and lists those that concern this story; its Q1 to Q6 above are decisions 6 to 11. Where they differ from this story's contract or from an earlier block, they rule.

- **Q1, one story or two (decision 6): (b), a split.** The contract had assumed (a), one story, until answered.
  - This story keeps the S part, C1 to C3, and is S. It also takes decision 30 (below).
  - The M part, C4 to C6, with Q4 to Q6 (decisions 9 to 11), is [MIG-B9-17](MIG-B9-17-module-isolation-warnings.md), "The silent cases of `@use`'s module isolation warn": wave 2, right after this story, which it depends on. Its file is made from this file's C4 to C6 material.
  - **The numbering.** Option (b) reads "Each keeps its C-n, T-n and AC-n as numbered here, and C7 and C8 apply to both", so the numbers do not change: this story's C4, C5 and C6 are MIG-B9-17's C4, C5 and C6; C7 and C8 are in both files, as written; T6, T7 and T8 are MIG-B9-17's, retitled `MIG-B9-17: …`; T9 is divided, S-7's near-miss and `@debug` cases staying here and its isolation case becoming MIG-B9-17's T9; T10 and T11 are in both; AC1 is in both, its mutations divided (T1, T2, T3 and T5's here, T6 and T8's there); AC2 stays here; AC3 and AC4 are MIG-B9-17's; AC5 to AC8 and AC10 are in both; AC9 stays here as written, and MIG-B9-17's AC9 asserts that no playground file changes. §4's B5 and its isolation pin are MIG-B9-17's §4; Q4 to Q6 are in MIG-B9-17's §15 as they were asked here.
  - The header, §1, §2 and §4 to §13 of this file drop what moved and say where it went; §3 and the questions above stay as written.
  - **Under README §7.** This story leaves the rows of `compile.ts`, `test/cli/**`, `cli.md` and `unified-engine-audit.md`, which MIG-B9-17 takes. The new row `packages/uxdsl/test/core/sass-stage-diagnostics.test.js` lists this story, which makes the file, then MIG-B9-17. Decision 31 makes `migration.md` append-only: MIG-B9-30 to 36 no longer wait for this story on it, while MIG-B9-17, 27 and 52, which rewrite a passage of it too, still do (this story rewrites item 6). The header's Owns, Shares, Depends on and Blocks follow decisions 6 and 31.
- **Q2, `@debug`'s code (decision 7): (a)**, as the contract assumed. A `@debug` is `UXD_SASS_WARNING: DEBUG: …`, and the catalog's meaning of `UXD_SASS_WARNING` is extended. C2 does not change.
- **Q3, the prefix (decision 8): (c)**, as the contract assumed. The probe's names come from a random tag made per `compile()` call, which reaches no result. C3 does not change.
- **`compile()` from standard input (decision 30), added to this story's contract.** Finding F1 above records that `compile()` rejects with `ERR_INVALID_ARG_VALUE` when Node reads the main module from standard input (`node -`): Dart Sass's `NodePackageImporter`, which the Sass stage constructs on every pass (`compile-sass.ts:669` on `f855765`), reads `process.argv[1]`. MIG-B9-16 (its F2) and MIG-B9-24 (its new fact 6) found the same. The decision puts the fix in this story, so §6's item "`compile()` from a script read on standard input: §15, finding F1" no longer applies.
  - **C9 (added).** When `process.argv[1]` is not a file path, the Sass stage gives `NodePackageImporter` the current working directory as its entry-point directory, so `compile()` run from a script read on standard input compiles as it does from a script file.
  - **T12 (added),** in `packages/uxdsl/test/core/sass-stage-diagnostics.test.js`, the file this story makes: a test runs `compile()` from `node -`. Its negative control is BASE's `ERR_INVALID_ARG_VALUE`. AC1, which runs that file, covers it.
  - **A fact for the implementer, not a change to the decision.** F1 also records that `new NodePackageImporter(process.cwd())` alone throws the same from standard input. Dart Sass 1.107.0's constructor calls `entrypointFilename()`, which reads `require.main` and then `process.argv[1]`, before it reads the directory it is given (`sass.dart.js`, the `nodePackageImporterClass` closure). Checked again on `e704b3e` on 2026-11-10: piped into `node -`, the constructor given `process.cwd()` throws `ERR_INVALID_ARG_VALUE`; the same text run with `node -e` constructs the importer. So the directory alone does not avoid the throw; how the stage keeps the constructor from reading `-` is the implementation's. If no way meets C9, the story is set to Blocked with a finding and the owner decides (README §2, "Authority").

### Under README §7, after decisions 28 and 29 of 2026-11-13

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-13). Decision 28 split MIG-B9-39 in two: MIG-B9-39 keeps the adapters, and [MIG-B9-19](MIG-B9-19-cli-watch-recovers.md) takes the CLI and the tests, with the places MIG-B9-39 had on the rows of `bin/uxdsl.js`, `packages/uxdsl/test/cli/**`, `cli.md` and `packages/playground-nextjs/**`. On `packages/playground-nextjs/**`, the later row that waits for this story is MIG-B9-19, not MIG-B9-39, which no longer edits the playground. MIG-B9-06, registered by decision 29, is not on that row. The header's Blocks follows; nothing else in this story changes.
