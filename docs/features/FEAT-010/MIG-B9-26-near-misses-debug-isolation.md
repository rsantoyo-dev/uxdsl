# MIG-B9-26 — Dotted near-misses keep DEC-02's "did you mean" through `compile()`; Sass's `@debug` reaches the build as a warning

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | DEC-02 (decided 2026-10-23) for C1; C3 and C5 stay within DEC-17 (decided 2026-10-23). No DEC is open; six owner questions (§15) choose between options the registration leaves open |
| Status | Ready |
| Size | M. Registered S by decision D5 of 2026-11-04. The decisions of 2026-11-08 add four detections of module isolation, which need a catalog code and work in the Sass stage's probe, and the removal of the probe prefix's exception. As one story it is M at its upper bound; §15, Q1 proposes a split into an S part (C1 to C3) and an M part (C4 to C6) |
| Depends on | MIG-B9-14 (merged, PR #71: the CLI prints `compile()`'s warnings, which D5 waits for). Under README §7: MIG-B9-16 (`packages/playground-nextjs/**`: the two pages whose three-cases sentence C3 edits), MIG-B9-20 (`compile.ts`, `test/cli/**`, `fixtures/release-1.0/run.js`, `migration.md`, `cli.md`, `unified-engine-audit.md`, the playground, and the tests it rewrites when it removes `includeTheme`), MIG-B9-21 (`compile.ts`, `unified-engine-audit.md`; `compile-sass.ts` for `error.warnings`, which C2 relies on) and MIG-B9-25 (`compile-sass.test.js`, `test/cli/**`, `fixtures/release-1.0/verdicts.test.js`) |
| Blocks | MIG-B9-91. Under README §7: MIG-B9-27 (`compile.md`, `migration.md`); MIG-B9-28 (`compile-sass.test.js`, `test/cli/**`); MIG-B9-30, 32, 33, 34, 35, 37 and 38 (`diagnostics.ts`); MIG-B9-30 and 31 (`fixtures/release-1.0/run.js`); MIG-B9-30 to 36 (`migration.md`); MIG-B9-30, 33, 34, 35, 36 and 39 (`packages/playground-nextjs/**`); MIG-B9-39 (`test/cli/**`); in `0.5.0-beta.10`, MIG-B9-40 to 43 (the playground) and MIG-B9-60, 61 and 63 (`cli.md`). MIG-B9-24 shares no file with this story under the answers its §15 assumes |
| Base | `feat/beta9` after MIG-B9-16, after MIG-B9-20, after MIG-B9-21 and after MIG-B9-25. §3 and §4 were recorded on `f855765`, before any of the four; they are re-run on that base before work starts |
| Owns | `packages/uxdsl/test/core/sass-stage-diagnostics.test.js` (new) |
| Shares | `packages/uxdsl/src/sass/protect.ts` (C1); `packages/uxdsl/src/sass/compile-sass.ts` (C2 to C6 and its header comment); `packages/uxdsl/src/diagnostics.ts` (one new code; `UXD_SASS_WARNING`'s meaning); `packages/uxdsl/src/compile.ts` (the `CompileResult.warnings` comment only); `packages/uxdsl/test/near-miss-functions.test.js` (`SASS_REJECTS`); `packages/uxdsl/test/core/compile-sass.test.js` (the twin's logger and "debug is dropped"); `packages/uxdsl/test/cli/uxdsl-cli.test.js` (`ISOLATION_CASES`'s silent cases and the namespaced-`@use` test); `fixtures/release-1.0/run.js` and `fixtures/release-1.0/verdicts.test.js` (S-7); `packages/uxdsl/docs/integrations/compile.md`; `packages/uxdsl/docs/integrations/cli.md` (`generate-entry`); `packages/uxdsl/docs/migration.md` (items 6 and 9 of "beta.9 — Sass inside compile()"); `docs/architecture/unified-engine-audit.md` (the Sass stage's codes); `packages/uxdsl/README.md` ("From SCSS", and one sentence); `packages/uxdsl/CHANGELOG.md`; `packages/playground-nextjs/src/app/docs/introduction/page.mdx` and `packages/playground-nextjs/src/app/docs/language/page.tsx` (the three-cases sentence only, C3) |
| Output impact | API/CLI: `compile()`'s `warnings` gain one per `@debug` (C2) and the isolation warnings (C4 to C6, one new catalogued code); a dotted near-miss fails with the plugin's error instead of `UXD_SASS` (C1); a project name with the `uxdsl-probe-` prefix gets Dart Sass's CSS (C3). No other compiled CSS changes |

## 1. Goal

Through `compile()`, a near-miss with a dotted argument (`palete(primary.main)`)
fails as it fails through `uxdsl/postcss`, naming the function meant, and every
`@debug` Dart Sass evaluates reaches the build as a located warning. No project
name can change what the Sass stage's probe decides. The four cases in which
`@use`'s module isolation changes a build without an error each produce a
located warning. Compiled CSS stays as it is, except for a project that named
something with the probe's prefix, which now gets Dart Sass's CSS.

## 2. Sources

- The registration, decision D5 of 2026-11-04 (`docs/features/FEAT-010-beta9.md:180`):

  > **D5 — MIG-B9-26 registered,** "Dotted near-misses keep DEC-02's "did you mean" through `compile()`; Sass's `@debug` reaches the build as a warning": S, wave 2, after MIG-B9-14 (which makes the CLI print `compile()`'s warnings). It answers MIG-B9-13's owner flag 10 (`palete(primary.main)` through `compile()` is `UXD_SASS: expected "(".`, with no suggestion) and MIG-B9-12's owner flag 8 (`@debug` dropped).

- Decision D12 of 2026-11-04 (`FEAT-010-beta9.md:187`):

  > **D12 — Sass's `@debug` output** is accepted as dropped for now; MIG-B9-26 shows it as a warning.

- The extension on MIG-B9-14's flag 3, decision of 2026-11-08 (`FEAT-010-beta9.md:220`):

  > **Flag 3 — isolation's silent cases.** The silent cases of `@use`'s module isolation (another file's `@function` called, a `!default` set by an earlier file, a project `@function` shadowing a token, a bare call under a namespaced `@use`) are detected by MIG-B9-26.

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
- MIG-B9-14 §15, owner flag 3 (`MIG-B9-14-cli-and-adapters.md:549–555`):

  > **A4 review item: isolation's silent cases.** These compile differently without an error:
  >    - a call to another file's `@function` stays in the CSS as written;
  >    - a value an earlier file set for a variable declared `!default` elsewhere no longer reaches it;
  >    - a project `@function` named like a UXDSL function no longer replaces the token in the other files.
  >
  >    Review DGE-1 adds a fourth: under a file's own namespaced `@use`, a bare function call stays in the CSS too. […]
  >    - Options: an `--import` escape hatch for one release, or detection of an unresolved project-`@function` call. Detection needs `compile-sass.ts` and a catalog code, and is proposed with MIG-B9-26.

  Its follow-up (`:660`): "Detect an unresolved call of a project `@function`, the silent isolation case of owner flag 3. It is the same files and the same kind of warning as its dotted near-misses and `@debug`."
- DEC-02 (`FEAT-010-beta9.md:94`): "every near-miss of a UXDSL function name is an error with a "did you mean". With the review's precisions: a real CSS function (`shape()`) is never flagged; a top-level name one edit from a breakpoint stays `UXD_BREAKPOINT_UNKNOWN`; the check lives in `language.ts`, so theme values fail the same way."
- DEC-17 (`FEAT-010-beta9.md:107`): "Where Sass calls it by its bare name (the same file, a file loaded with `@import`, `@use … as *`), the name means the author's function and the output is what Dart Sass produces; UXDSL emits one warning, located at the definition […]. A function reached only through a namespace (`helpers.space()`) shadows nothing, and mixins never conflict."
- README §7's note (`docs/features/FEAT-010/README.md:380–383`): "`packages/uxdsl/src/diagnostics.ts` for the catalog code that MIG-B9-26's detection of isolation's silent cases needs (MIG-B9-14 §15, flag 3; the `compile-sass.ts` row lists 26 already): MIG-B9-30, 32 to 35, 37 and 38 would wait for MIG-B9-26."
- The code and the pins, on `f855765`:
  - `packages/uxdsl/src/sass/compile-sass.ts:49–51`: "Every Sass warning is a `UXD_SASS_WARNING: …` warning, located like an error; an `@warn` is located by its stack frame. Sass's own cap (five per deprecation type, then a summary) applies; debug output is dropped." Line 660, in the reporting logger: `debug: () => undefined,`.
  - `compile-sass.ts:97–99`: "The `uxdsl-probe-` prefix is reserved for the probe: its functions, and the namespace under which it reaches `sass:meta`." The probe's names: `uxdsl-probe-builtin`, `-site`, `-pick`, `-eof`, `-cap`, `-replay` and the namespace `uxdsl-probe-meta` (`:156`, `:836–1100`).
  - `packages/uxdsl/test/near-miss-functions.test.js:42–44`: "Dart Sass reads a dotted argument as a module member, so through compile() a near-miss of palette() with a dotted key fails in Sass, located, before the plugin can name the function meant." `const SASS_REJECTS = new Set(['palete(primary.main)', 'pallete(primary.main)', 'pallet(primary.main)']);`
  - `packages/uxdsl/test/core/compile-sass.test.js:1096` and `:1109–1111`: the test titled "… @warn is reported; debug is dropped" ends with `assert.deepEqual(debug.actual.warnings, []);`, and the Dart Sass twin's logger (`:108`) has `debug() {}`.
  - `packages/uxdsl/test/cli/uxdsl-cli.test.js:2238`: "MIG-B9-14: under a generated @use entry each file is its own module: a variable, mixin or placeholder from another file fails as UXD_SASS, a function call and a !default change without an error, and the file's own @use restores each" (it asserts `built.stderr === ''` for the three silent cases), and `:2296`: "MIG-B9-14: under a file's own namespaced @use, a bare call of the module's @function stays in the CSS and one named like a UXDSL function stays the token, with no error or warning, while a bare variable or mixin fails; […]".
  - `packages/uxdsl/docs/integrations/compile.md:490–493`: "**A dotted near-miss** such as `palete(primary.main)` is Dart Sass's `UXD_SASS: expected "(".` through `compile()`, before the plugin's `UXD_FUNCTION_UNKNOWN` suggestion can run"; `:501`: "an `@debug` prints nothing."; `:385–386`: "No UXDSL name is reserved; the one exception is the Sass stage's own helper prefix, `uxdsl-probe-`"; `:425–430`, the third recorded difference.
  - `packages/uxdsl/README.md:118–125` ("From SCSS"): "every SCSS file is a valid UXDSL file, except in three cases […] and a project function named with the Sass stage's internal prefix `uxdsl-probe-` can change the output."
  - `packages/uxdsl/docs/integrations/cli.md:162–172` and `packages/uxdsl/docs/migration.md:160–213` (item 9) describe the three silent cases as compiling "differently, without an error"; `migration.md:145–148` (item 6) gives the dotted near-miss as `UXD_SASS`.

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
  console.log('B5 under a generated @use entry (generate-entry --src src, then build)');
  const cases = {
    "another file's @function": { 'src/_helpers.uxdsl': '@function double($x) { @return $x * 2; }\n', 'src/widget.uxdsl': '.w { width: double(4px); }\n' },
    'a !default an earlier file sets': { 'src/_a-config.uxdsl': '$tone: red;\n', 'src/b-button.uxdsl': '$tone: blue !default;\n.btn { color: $tone; }\n' },
    'a project @function shadowing a token': { 'src/_shadow.uxdsl': '@function space($n) { @return $n * 4px; }\n', 'src/pad.uxdsl': '.p { padding: space(2); }\n' },
    'a bare call under a namespaced @use': { 'src/_helpers.uxdsl': '@function space($n) { @return $n * 4px; }\n@function double($x) { @return $x * 2; }\n', 'src/pad.uxdsl': "@use './helpers';\n.p { padding: space(2); height: double(4px); }\n" },
  };
  let n = 0;
  for (const [name, files] of Object.entries(cases)) {
    const dir = put(path.join(root, `b5-${++n}`), { 'uxdsl.config.cjs': config('uxdsl-entry.uxdsl'), ...files });
    const g = cli(dir, 'generate-entry', '--src', 'src');
    const b = cli(dir, 'build');
    const css = fs.readFileSync(path.join(dir, 'out/app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
    console.log(`  ${name}: generate-entry exit ${g.status}; build exit ${b.status}, stderr ${JSON.stringify(b.stderr)}; ${JSON.stringify(css)}`);
  }
  fs.rmSync(root, { recursive: true, force: true });
})();
EOF
node "$TMPDIR/mig-b9-26-baseline.js"; echo "exit=$?"; rm "$TMPDIR/mig-b9-26-baseline.js"
```

On a base that includes MIG-B9-20, which removes `includeTheme`, the
script's `includeTheme: false` (in `opts` and in `config`) is dropped first;
nothing else in it changes. Recorded on `f855765`, 2026-11-10 09:17 EST,
exit 0, exactly:

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
B5 under a generated @use entry (generate-entry --src src, then build)
  another file's @function: generate-entry exit 0; build exit 0, stderr ""; ".w { width: double(4px); }"
  a !default an earlier file sets: generate-entry exit 0; build exit 0, stderr ""; ".btn { color: blue; }"
  a project @function shadowing a token: generate-entry exit 0; build exit 0, stderr ""; ".p { padding: var(--uxdsl__space__2); }"
  a bare call under a namespaced @use: generate-entry exit 0; build exit 0, stderr ""; ".p { padding: var(--uxdsl__space__2); height: double(4px); }"
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
- **B5.** Each of the four registered cases compiles with exit 0 and an empty
  stderr. Dart Sass compiles the `.scss` twins of the same files under a
  `@use` entry to the same CSS (`double(4px)`, `blue`, and `space(2)` where
  UXDSL writes the token), also without a message. Through a hand-written
  `@import` entry the same files give `8px`, `red` and `8px`, the last with
  one `UXD_FUNCTION_SHADOWED`.

The pins, each exit 0 on `f855765` (with `TMPDIR` set to a scratch directory):

```bash
node --test packages/uxdsl/test/near-miss-functions.test.js                                       # 5 pass: SASS_REJECTS pins UXD_SASS for the three dotted calls
node --test --test-name-pattern="debug is dropped" packages/uxdsl/test/core/compile-sass.test.js  # 1 pass, 56 skipped: pins []
node --test --test-name-pattern="MIG-B9-14: (under a generated @use entry|through a hand-written @import entry|under a file's own namespaced @use)" packages/uxdsl/test/cli/uxdsl-cli.test.js   # 3 pass, 158 skipped: pins the empty stderr
```

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
is C4 to C6; C7 and C8 apply to both.

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
- **C4 — A function the build defines but Sass leaves as written (MIG-B9-14's flag 3: "another file's `@function` called", and the bare call under a namespaced `@use`; part 2; Q4 (a)).**
  - **When.** All three hold:
    - Dart Sass leaves a call `name(…)` in its output as written;
    - a file the build loaded defines `@function name` (Sass's spelling:
      `_` read as `-`);
    - `name` is not a CSS function the compiler knows
      (`KNOWN_CSS_FUNCTIONS`), and not a UXDSL function or breakpoint.
  - **What.** One warning per author position and name, coded
    `UXD_MODULE_ISOLATION`. The message names the function and the file that
    defines it, and says that the function is not visible here, so Dart Sass
    leaves the call in the CSS as written. It names the fix: `@use` that file
    `as *`, or call it through its namespace. The test pins the wording.
  - **Where.** Located where `compile()` locates a position in Dart Sass's
    output: the declaration's start, as MIG-B9-13's flag 11 accepted.
  - **The CSS** is unchanged.
  - **§4's B5.** Case 1 (`double(4px)` in `widget.uxdsl`) and case 4
    (`double(4px)` in `pad.uxdsl`) each warn once, and `uxdsl build` exits 0
    with the warning on stderr.
- **C5 — A project function named like a UXDSL function that no call reaches (flag 3: "a project `@function` shadowing a token", and the bare call under a namespaced `@use`; part 2; Q5 (a)).**
  - **When.** All three hold:
    - a loaded file defines `@function <name>`, where `<name>` is a token
      function, `tone` or a breakpoint of the effective theme;
    - no call of the build reaches that definition: neither a bare call
      (which `UXD_FUNCTION_SHADOWED` reports) nor a call through a namespace
      (`helpers.space(2)`);
    - at least one bare call of that name in a `.uxdsl` file of the build
      keeps UXDSL's token.
  - **What.** One `UXD_MODULE_ISOLATION` warning per such definition. It is
    located at the definition, as `UXD_FUNCTION_SHADOWED` is. It names the
    function, its file, a file where the bare call keeps the token, and the
    fix.
  - **The CSS** is unchanged: the token, by DEC-17.
  - **§4's B5.** Case 3 warns at `src/_shadow.uxdsl:1:11` and case 4 at
    `src/_helpers.uxdsl:1:11`.
- **C6 — A `!default` an earlier file sets (flag 3: "a `!default` set by an earlier file"; part 2; Q6 (b)).**
  - **When.** All of these hold:
    - a `.uxdsl` file that Sass loads as a module, through `@use` or
      `@forward` and not `@import`, declares a top-level `$name: … !default`;
    - that default applies, because no `$name` is visible there;
    - a file Sass evaluated earlier in the build assigns a top-level `$name`
      without `!default`;
    - that earlier file is not visible from the module and emits no CSS of
      its own.
  - **What.** One `UXD_MODULE_ISOLATION` warning at the `!default`
    declaration. It names the variable and the earlier file, and says that
    the default applies. It names the fix: `@use` that file `as *`, or
    configure the module with `@use … with (…)`.
  - **Never reported.** A module configured with `@use … with (…)` or
    `@forward … with (…)`.
  - **The CSS** is unchanged.
  - **§4's B5.** Case 2 warns at `src/b-button.uxdsl:1:1`.
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
- `compile()`'s `warnings`: BASE's, in BASE's order, plus only C2's and C4 to
  C6's additions;
- every error on BASE, except C1's dotted near-misses and C3's internal
  errors, which then compile;
- `uxdsl/postcss` used alone, in everything;
- the parity oracles (`fixtures/parity/expected/**`), without `--update`;
- the Bootstrap corpus: 276,926 bytes and 21 warnings on `f855765`;
- the playground: `src/app/uxdsl.css`, the warning lines of its `uxdsl:build`,
  `src/generated/examples.json`, and the CLI and compiler captures; no
  playground file is edited but the three-cases sentence of the introduction
  page and of `/docs/language` (C3);
- `DIAGNOSTIC_CATALOG`: BASE's codes plus `UXD_MODULE_ISOLATION` (Q4 (a)),
  with `UXD_SASS_WARNING`'s meaning extended (Q2 (a)); every other entry as
  on BASE.

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
- **`generate-entry`'s warning when it replaces an `@import` entry**
  (`bin/uxdsl.js`, `writeEntry`): it says the three cases compile
  "differently, without an error", which stays true. It is not edited, so the
  story stays off `bin/uxdsl.js`'s row.
- **An `--import` escape hatch for one release:** MIG-B9-14's flag 3 offered
  it; the decision of 2026-11-08 chose detection. Not done.
- **Isolation of variables, mixins and placeholders read from another
  file:** these are loud already (`UXD_SASS`). No change.
- **`error.warnings` itself:** MIG-B9-21. C2 only relies on it.
- **SH-4 and RR-1,** the other recorded differences of functions named like
  UXDSL's: accepted by decision D19 of 2026-11-04 (MIG-B9-12's flags 18 and
  19). Unchanged.
- **A `/docs/diagnostics` capture of `UXD_MODULE_ISOLATION`:** not required,
  since the page renders the catalog. It would put the story on the
  playground's §7 row. Proposed for MIG-B9-42 (wave 4) if wanted.
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
4. **C4.** After the reported pass:
   - collect the `@function` names of every loaded file, with the same scan
     `findShadowingFunctions` uses, extended to every name;
   - find calls of those names in Dart Sass's output, outside strings,
     comments and `url()`, skipping known CSS, UXDSL and breakpoint names;
   - locate each through the stage's map.

   Bootstrap's 27 functions never appear in its output (§4), so the corpus
   pays one scan and no compile.
5. **C5.** The probe already records, at each bare token call, what the name
   means there. A definition that no record reaches, while a call of its name
   kept the token, is the case. For Q5 (a) the probe must also see calls
   through a namespace. One way: a statement at the start of each such
   function's body that records the definition, much as the probe already
   records it after the body.
6. **C6.** Make the candidates lexically:
   - top-level `!default` names in `.uxdsl` files Sass loaded as modules
     (not in `pass.imported`);
   - top-level plain assignments of the same name in files evaluated
     earlier;
   - for Q6 (b), only earlier files to which no mapping of the output points.

   Confirm with the probe: `global-variable-exists("<name>")` just before the
   declaration. Only a build with a candidate pays a probe compile.

Traps:

- **Never make a loud error silent.** A near-miss protected in a selector or
  an at-rule prelude reaches the CSS unchecked: `.a:not(palete(primary.main))`
  would compile. Find the context by looking ahead to the first `;`, `{` or
  `}` at depth 0: a `{` means a selector or prelude. §8's T2 control covers
  it.
- **Never protect a call Sass can parse.** `colour(gray.300)` is Sass's to
  evaluate, and a project `@function colour` gives its value.
- **P10.**
  - Bootstrap loads every file with `@import` and its output holds none of
    its function names, so C4 to C6 must cost it no compile.
  - A detection that probes every build fails C8: the ratio roughly doubles.
  - `protect()` runs on every `.uxdsl` file. Test the dotted shape before
    calling `unknownFunctionMessage`.
- **C3's tag must reach no result.** Test with a scan of every result field
  and two compiles of the same input, including the corpus.
- **`@use … with`.** A configured module's `!default` takes the configured
  value. Do not report it; `global-variable-exists` may not see the
  configuration.
- **Positions.**
  - C4 is located through the map (the declaration's start), never by
    searching the author's text.
  - C5 is located at the definition, as `UXD_FUNCTION_SHADOWED` is.
  - C6 is located at the declaration.
  - The CLI already removes the working directory from every path in a
    message (`formatCliDiagnostic`), so `bin/uxdsl.js` needs no change.
- **Comments.**
  - `compile-sass.ts`'s header says "debug output is dropped" and "the
    `uxdsl-probe-` prefix is reserved".
  - `compile.ts`'s `CompileResult.warnings` comment lists the warning
    sources.

  Rewrite each to state the new behavior, with no story id (README §2).
- **`TMPDIR`.** The new test file removes every directory it creates
  (`t.after`), unlike `compile-sass.test.js`'s `project()`.

Stop rule:

- **Stop if** C4 to C6 cannot be detected without a Dart Sass compile in a
  build that has no candidate (C8).
- **Stop if** a detection would change any `compile()` result other than
  `warnings`.
- **Stop if** C1 cannot be met without making a BASE error silent.

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
| T6 | same | `MIG-B9-26: under a generated @use entry, another file's @function left as written, a project @function named like a token that no call reaches, a !default an earlier file sets, and a bare call under a namespaced @use each warn UXD_MODULE_ISOLATION once, located, with the CSS unchanged` | unit (`compile()`) | C4, C5, C6 | `MIG-B9-26: an @import entry, the reading file's own @use … as *, calls through the namespace, a function no file defines, a known CSS function, and a module configured with @use … with warn nothing new (negative control)` |
| T7 | `packages/uxdsl/test/cli/uxdsl-cli.test.js` (`ISOLATION_CASES`'s three silent cases and the namespaced-`@use` test) | the two MIG-B9-14 tests, retitled: each silent case builds with exit 0 and its one `UXD_MODULE_ISOLATION` line on stderr instead of `''`; the namespaced form warns for `double` and `space` | CLI subprocess | C4, C5, C6 | the same tests' `@import`-entry test, `as *` and qualified forms keep their stderr (`''`, or BASE's `UXD_FUNCTION_SHADOWED` line) |
| T8 | `packages/uxdsl/test/core/sass-stage-diagnostics.test.js` | `MIG-B9-26: a build with no project @function named like a UXDSL function and no !default in a module runs Dart Sass once, as on BASE` | unit (counts `compileString` through a wrapper of `sass` in `require.cache`) | C8 | a build with a C6 candidate runs a probe: the count is above 1, so the counter sees compiles |
| T9 | `fixtures/release-1.0/run.js` (S-7) and `fixtures/release-1.0/verdicts.test.js` | S-7 `[tarball] the installed CLI prints a dotted near-miss as UXD_FUNCTION_UNKNOWN with its suggestion (exit 1), a @debug as a located warning (exit 0), and an isolation case as a located UXD_MODULE_ISOLATION warning (exit 0)`; `MIG-B9-26: S-7 rejects BASE's UXD_SASS line, an empty stderr and an unlocated warning (negative control)` | tarball | C1, C2, C4 | the verdict test's control |
| T10 | `fixtures/sass-corpus/run.js` (unedited) | its own output | fixture | C8 | a detection that probes every build exceeds the budget |
| T11 | `packages/uxdsl/test/diagnostics-catalog.test.js`, `scripts/doc-examples.test.js`, `fixtures/parity/run.js` (unedited) | as they are | unit, docs, parity | C2, C7, the catalog and the documentation | their own |

T1, T2, T3, T5, T6 and T7 fail on BASE, as §4 shows. T4 fails on BASE once the
twin's logger writes `@debug`. T3b needs MIG-B9-21's `error.warnings`. T8 and
the C7 controls pass on BASE by design, and each has a control that shows it
can fail.

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/near-miss-functions.test.js packages/uxdsl/test/core/sass-stage-diagnostics.test.js` exits 0, run with `TMPDIR` set to an empty scratch directory, which it leaves empty.
  - Test files: `near-miss-functions.test.js` and `sass-stage-diagnostics.test.js`.
  - Mutations, each failing it:
    - `protect.ts` without the near-miss rule (T1, T2);
    - the rule without the context guard (T2's control);
    - `debug: () => undefined` restored (T3);
    - the fixed `uxdsl-probe-` prefix (T5);
    - each detection removed in turn (T6);
    - a probe compile on every build (T8).
- **AC2** `node --test packages/uxdsl/test/core/compile-sass.test.js` exits 0.
  - Test file: `compile-sass.test.js`.
  - Mutation: a stage that drops `@debug` fails T4's twin comparison.
- **AC3** `node --test packages/uxdsl/test/cli/uxdsl-cli.test.js` exits 0.
  - Test file: `uxdsl-cli.test.js`.
  - Mutation: no detection, so stderr is `''`, fails T7.
- **AC4** `node --test packages/uxdsl/test/diagnostics-catalog.test.js packages/uxdsl/test/diagnostics-coverage.test.js` exits 0.
  - Test files: as named.
  - Mutation: a catalogued `UXD_MODULE_ISOLATION` that no source emits, or
    that no test asserts, fails it.
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
  recommended option until then.
- Review the wording of the three `UXD_MODULE_ISOLATION` messages and of the
  catalog entry in the PR.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes: `protect.ts`, `compile-sass.ts` and `compile.ts` are in `VISUAL_DEFAULT_FILES`. One subsection under `## 0.5.0-beta.9 — unreleased`. Its `### Visual changes`: a project that named something with `uxdsl-probe-` gets Dart Sass's CSS (C3); none otherwise |
| package README | yes: the "From SCSS" exceptions (C3), and one sentence on the new warnings |
| `verify-docs-update.js` classification | no (no file added under `src`; if one is added, it is classified) |
| `npm run generate:language` | no |
| `AGENTS.md` + agent guide | no. Its near-miss sentence (`AGENTS.md:771`) becomes true through `compile()`, and nothing it says about Sass warnings changes; `--check` runs (AC7) |
| `DIAGNOSTIC_CATALOG` | yes: `UXD_MODULE_ISOLATION` (`core`), and `UXD_SASS_WARNING`'s meaning |
| `npm run generate:capabilities` | run, no diff expected (the diagnostics capability is one row) |
| playground `uxdsl:build` + captures | run, no change expected (AC9) |
| `migration.md` | yes (items 6 and 9) |
| `docs/architecture/unified-engine-audit.md` | yes: the Sass stage's codes (line 59) |

## 11. Documentation

- `packages/uxdsl/docs/integrations/compile.md`:
  - the "A dotted near-miss" bullet (`:490–493`): through `compile()` it now
    fails as through the plugin;
  - the "Warnings" bullet (`:494–501`): `@debug` is a `UXD_SASS_WARNING`;
  - "Functions named like UXDSL's" (`:383–386`) and its recorded differences
    (`:425–430`): the prefix exception goes (C3);
  - one example that documents the dotted near-miss's
    `UXD_FUNCTION_UNKNOWN`, compiled by the harness.
- `packages/uxdsl/docs/integrations/cli.md`, `generate-entry` (`:162–185`):
  the three cases compile differently and now warn `UXD_MODULE_ISOLATION`,
  and so does the bare call under a namespaced `@use`.
- `packages/uxdsl/docs/migration.md`, "beta.9 — Sass inside compile()": item
  6 (`:145–148`) is rewritten, and item 9 (`:160–213`) names the warning.
- `packages/uxdsl/README.md`: "From SCSS" (`:118–125`) with two exceptions
  (Q3 (c)), and one sentence beside the pipeline paragraph.
- `packages/uxdsl/CHANGELOG.md`: one subsection.
- `docs/architecture/unified-engine-audit.md:59`: the Sass stage's
  diagnostics, with `UXD_MODULE_ISOLATION`.
- `packages/playground-nextjs/src/app/docs/introduction/page.mdx` (line 53
  on `f855765`) and `packages/playground-nextjs/src/app/docs/language/page.tsx`
  (the sentence MIG-B9-16's C1.2 writes): the three-cases sentence, as the
  package README words it after C3 (Q3 (c): two cases). No other playground
  text changes.

## 12. Verification

```bash
TMPDIR=<empty dir> node --test packages/uxdsl/test/near-miss-functions.test.js packages/uxdsl/test/core/sass-stage-diagnostics.test.js   # exit 0; <empty dir> stays empty
node --test packages/uxdsl/test/core/compile-sass.test.js                                    # exit 0
node --test packages/uxdsl/test/cli/uxdsl-cli.test.js                                        # background; exit 0
node --test packages/uxdsl/test/diagnostics-catalog.test.js packages/uxdsl/test/diagnostics-coverage.test.js   # exit 0
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

## 13. Delivery

Branch `feat/b9-26-near-misses-debug-isolation`. Commit:
`feat(FEAT-010): MIG-B9-26 - dotted near-misses keep their suggestion through compile(), @debug is a warning, no project name changes the probe, and module isolation's silent cases warn`.

PR title: `FEAT-010: MIG-B9-26 - Dotted near-misses keep DEC-02's "did you mean" through compile(); Sass's @debug reaches the build as a warning`.
The body:

- **Goal:** §1, in two sentences.
- **The owner's answers:** Q1 to Q6, as given, and where the contract
  follows them.
- **C1 to C6:** §4's B1 to B5 before and after, from the same script.
- **C7 and C8:**
  - parity, the playground and the captures unchanged;
  - the corpus run's output;
  - T8's compile counts.
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
