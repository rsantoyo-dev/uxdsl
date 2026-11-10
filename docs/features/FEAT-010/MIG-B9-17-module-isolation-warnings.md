# MIG-B9-17 — The silent cases of `@use`'s module isolation warn

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | DEC-17 (decided 2026-10-23), within which C5 stays. No DEC is open. Registered by decision 6 of 2026-11-10, which split MIG-B9-26 into MIG-B9-26 (C1 to C3) and this story (C4 to C6); its three questions, MIG-B9-26's Q4 to Q6, are answered by decisions 9 to 11 of 2026-11-10 (§15) |
| Status | Ready |
| Size | M (decision 6 of 2026-11-10: "The M part, C4 to C6") |
| Depends on | MIG-B9-26 (decision 6 of 2026-11-10: this story is its M part, and edits after it the files both share). As MIG-B9-26's file named them for C4 to C6: MIG-B9-14 (merged, PR #71: the CLI prints `compile()`'s warnings). Under README §7: MIG-B9-20 (`compile.ts`, `test/cli/**`, `fixtures/release-1.0/run.js`, `migration.md`, `cli.md`, `unified-engine-audit.md`, and the tests it rewrites when it removes `includeTheme`), MIG-B9-21 (`compile.ts`, `unified-engine-audit.md`) and MIG-B9-25 (`test/cli/**`, `fixtures/release-1.0/verdicts.test.js`); MIG-B9-26 also waits for all three |
| Blocks | MIG-B9-91. Under README §7: MIG-B9-27 (`migration.md`, where both rewrite an item); MIG-B9-28 and 39 (`test/cli/**`); MIG-B9-30, 32, 33, 34, 35, 37 and 38 (`diagnostics.ts`); MIG-B9-30 and 31 (`fixtures/release-1.0/run.js`); in `0.5.0-beta.10`, MIG-B9-52 (`migration.md`) and MIG-B9-60, 61 and 63 (`cli.md`) |
| Base | `feat/beta9` after MIG-B9-26, and so after MIG-B9-16, 20, 21 and 25. §3 and §4 were recorded on `f855765` for MIG-B9-26 and re-run on `e704b3e` when this file was made (the package's code is `f855765`'s); both are re-run on BASE before work starts |
| Owns | None: every file this story edits is shared (below) |
| Shares | `packages/uxdsl/src/sass/compile-sass.ts` (C4 to C6); `packages/uxdsl/src/diagnostics.ts` (one new code); `packages/uxdsl/src/compile.ts` (the `CompileResult.warnings` comment only); `packages/uxdsl/test/core/sass-stage-diagnostics.test.js` (made by MIG-B9-26; this story adds T6 and T8); `packages/uxdsl/test/cli/uxdsl-cli.test.js` (`ISOLATION_CASES`'s silent cases and the namespaced-`@use` test); `fixtures/release-1.0/run.js` and `fixtures/release-1.0/verdicts.test.js` (S-7's isolation case); `packages/uxdsl/docs/integrations/cli.md` (`generate-entry`); `packages/uxdsl/docs/migration.md` (item 9 of "beta.9 — Sass inside compile()"); `docs/architecture/unified-engine-audit.md` (the Sass stage's codes); `packages/uxdsl/README.md` (one sentence); `packages/uxdsl/CHANGELOG.md` |
| Output impact | API/CLI: `compile()`'s `warnings` gain the isolation warnings (C4 to C6, one new catalogued code). No compiled CSS changes |

## 1. Goal

The four cases in which `@use`'s module isolation changes a build without an
error each produce a located warning. Compiled CSS stays as it is. This story
is MIG-B9-26's C4 to C6, split from it by decision 6 of 2026-11-10 (§15);
MIG-B9-26 keeps the dotted near-misses, `@debug` and the probe's prefix.

## 2. Sources

- The split, decision 6 of 2026-11-10 (`docs/features/FEAT-010-beta9.md:320–324`):

  > - **Decision 6 — One story or two (Q1).** (b), a split.
  >   - MIG-B9-26 keeps the S part, C1 to C3: dotted near-misses keep DEC-02's "did you mean" through `compile()`; Sass's `@debug` reaches the build as a warning; the `uxdsl-probe-` prefix exception is removed. It also takes decision 30.
  >   - The M part, C4 to C6 (module isolation's silent cases), is registered as MIG-B9-17, in wave 2, right after MIG-B9-26. Its story file is made from MIG-B9-26's C4 to C6 material: contract, tests, acceptance criteria, sources, questions 9 to 11 and their answers.

The sources below are MIG-B9-26 §2's that concern C4 to C6, as it recorded
them on `f855765`:

- The extension on MIG-B9-14's flag 3, decision of 2026-11-08 (`FEAT-010-beta9.md:220`):

  > **Flag 3 — isolation's silent cases.** The silent cases of `@use`'s module isolation (another file's `@function` called, a `!default` set by an earlier file, a project `@function` shadowing a token, a bare call under a namespaced `@use`) are detected by MIG-B9-26.

- MIG-B9-14 §15, owner flag 3 (`MIG-B9-14-cli-and-adapters.md:549–555`):

  > **A4 review item: isolation's silent cases.** These compile differently without an error:
  >    - a call to another file's `@function` stays in the CSS as written;
  >    - a value an earlier file set for a variable declared `!default` elsewhere no longer reaches it;
  >    - a project `@function` named like a UXDSL function no longer replaces the token in the other files.
  >
  >    Review DGE-1 adds a fourth: under a file's own namespaced `@use`, a bare function call stays in the CSS too. […]
  >    - Options: an `--import` escape hatch for one release, or detection of an unresolved project-`@function` call. Detection needs `compile-sass.ts` and a catalog code, and is proposed with MIG-B9-26.

  Its follow-up (`:660`): "Detect an unresolved call of a project `@function`, the silent isolation case of owner flag 3. It is the same files and the same kind of warning as its dotted near-misses and `@debug`."
- DEC-17 (`FEAT-010-beta9.md:107`): "Where Sass calls it by its bare name (the same file, a file loaded with `@import`, `@use … as *`), the name means the author's function and the output is what Dart Sass produces; UXDSL emits one warning, located at the definition […]. A function reached only through a namespace (`helpers.space()`) shadows nothing, and mixins never conflict."
- README §7's note (`docs/features/FEAT-010/README.md:380–383` on `f855765`): "`packages/uxdsl/src/diagnostics.ts` for the catalog code that MIG-B9-26's detection of isolation's silent cases needs (MIG-B9-14 §15, flag 3; the `compile-sass.ts` row lists 26 already): MIG-B9-30, 32 to 35, 37 and 38 would wait for MIG-B9-26."
- The code and the pins, on `f855765`:
  - `packages/uxdsl/test/cli/uxdsl-cli.test.js:2238`: "MIG-B9-14: under a generated @use entry each file is its own module: a variable, mixin or placeholder from another file fails as UXD_SASS, a function call and a !default change without an error, and the file's own @use restores each" (it asserts `built.stderr === ''` for the three silent cases), and `:2296`: "MIG-B9-14: under a file's own namespaced @use, a bare call of the module's @function stays in the CSS and one named like a UXDSL function stays the token, with no error or warning, while a bare variable or mixin fails; […]".
  - `packages/uxdsl/docs/integrations/cli.md:162–172` and `packages/uxdsl/docs/migration.md:160–213` (item 9) describe the three silent cases as compiling "differently, without an error".

## 3. Preconditions

MIG-B9-26 §3's lines that concern C4 to C6:

```bash
git merge-base --is-ancestor db0e28d HEAD                                       # MIG-B9-14 (PR #71): the CLI prints compile()'s warnings
grep -qF "a function call and a !default change without an error" packages/uxdsl/test/cli/uxdsl-cli.test.js   # isolation's silent cases, pinned
grep -qF "with no error or warning, while a bare variable or mixin fails" packages/uxdsl/test/cli/uxdsl-cli.test.js
node -e "const d = require('./packages/uxdsl/dist/diagnostics'); process.exit(d.DIAGNOSTIC_CODES.has('UXD_SASS_WARNING') && d.DIAGNOSTIC_CODES.has('UXD_FUNCTION_UNKNOWN') && !d.DIAGNOSTIC_CODES.has('UXD_MODULE_ISOLATION') ? 0 : 1)"
```

All four exit 0 on `f855765` (MIG-B9-26 §3) and on `e704b3e` (2026-11-10,
Node 20.19.0, npm 11.21.1, after the README §1 preparation).

When the story starts, this start gate also exits 0. On `e704b3e` it exits
1, by design: MIG-B9-26 is not merged yet.

```bash
! command grep -qx "To be filled in the delivering PR." docs/features/FEAT-010/MIG-B9-26-near-misses-debug-isolation.md   # MIG-B9-26 merged: its closure record is filled (it waits for MIG-B9-16, 20, 21 and 25)
```

MIG-B9-26 is not expected to change a line of the first block: it does not
edit `uxdsl-cli.test.js` or add a catalog code. A line that only went stale
(a line moved, a test renamed) is corrected in the story with the old and
the new line recorded in §15 (README §1, item 4).

**BASE** is the `feat/beta9` commit the branch starts from,
`git merge-base HEAD origin/feat/beta9`. Every "as on BASE" below is against
it, not against `f855765`.

## 4. Baseline

Run from the repository root after `npm --prefix packages/uxdsl run build`.
The script is written to a file: `compile()` cannot run from a script read on
standard input (`node -`) on `f855765` (MIG-B9-26 §15, finding F1, which
decision 30 of 2026-11-10 gives MIG-B9-26 to fix). It is MIG-B9-26 §4's
script reduced to its fifth part, B5, the part that concerns C4 to C6.

```bash
cat > "$TMPDIR/mig-b9-17-baseline.js" <<'EOF'
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
node "$TMPDIR/mig-b9-17-baseline.js"; echo "exit=$?"; rm "$TMPDIR/mig-b9-17-baseline.js"
```

On a base that includes MIG-B9-20, which removes `includeTheme`, the
script's `includeTheme: false` (in `opts` and in `config`) is dropped first;
nothing else in it changes. MIG-B9-26 §4 recorded these lines on `f855765`,
2026-11-10 09:17 EST, exit 0, exactly; this script printed the same on
`e704b3e`, 2026-11-10 14:06 EST, exit 0:

```text
B5 under a generated @use entry (generate-entry --src src, then build)
  another file's @function: generate-entry exit 0; build exit 0, stderr ""; ".w { width: double(4px); }"
  a !default an earlier file sets: generate-entry exit 0; build exit 0, stderr ""; ".btn { color: blue; }"
  a project @function shadowing a token: generate-entry exit 0; build exit 0, stderr ""; ".p { padding: var(--uxdsl__space__2); }"
  a bare call under a namespaced @use: generate-entry exit 0; build exit 0, stderr ""; ".p { padding: var(--uxdsl__space__2); height: double(4px); }"
```

What it shows:

- **B5.** Each of the four registered cases compiles with exit 0 and an empty
  stderr. Dart Sass compiles the `.scss` twins of the same files under a
  `@use` entry to the same CSS (`double(4px)`, `blue`, and `space(2)` where
  UXDSL writes the token), also without a message. Through a hand-written
  `@import` entry the same files give `8px`, `red` and `8px`, the last with
  one `UXD_FUNCTION_SHADOWED`.

The pin, exit 0 on `f855765` and on `e704b3e` (with `TMPDIR` set to a
scratch directory):

```bash
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
and 475 ms (`compile()`), 1.35×. (MIG-B9-26 §4, on `f855765`.)

## 5. Contract

The items keep the numbers they had in MIG-B9-26, as decision 6 of
2026-11-10 chose MIG-B9-26's Q1, option (b): "Each keeps its C-n, T-n and
AC-n as numbered here, and C7 and C8 apply to both". C4 to C6 are this
story's, C7 and C8 apply to both stories, and C1 to C3 are MIG-B9-26's.
"Part 2" below is this story. Each item states the option of MIG-B9-26's Q4
to Q6 it assumed; decisions 9 to 11 of 2026-11-10 chose those options (§15).

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

Must stay byte-identical with BASE (which includes MIG-B9-26):

- for every input that compiles on BASE, `compile()`'s `css`, `map` and
  `dependencies`;
- `compile()`'s `warnings`: BASE's, in BASE's order, plus only C4 to C6's
  additions;
- every error on BASE;
- `uxdsl/postcss` used alone, in everything;
- the parity oracles (`fixtures/parity/expected/**`), without `--update`;
- the Bootstrap corpus: 276,926 bytes and 21 warnings on `f855765`;
- the playground: `src/app/uxdsl.css`, the warning lines of its `uxdsl:build`,
  `src/generated/examples.json`, and the CLI and compiler captures; no
  playground file is edited;
- `DIAGNOSTIC_CATALOG`: BASE's codes plus `UXD_MODULE_ISOLATION` (Q4 (a));
  every other entry as on BASE.

## 6. Out of scope

- **C1 to C3, and decision 30** (dotted near-misses, `@debug`, the probe's
  prefix, `compile()` from standard input): MIG-B9-26.
- **`generate-entry`'s warning when it replaces an `@import` entry**
  (`bin/uxdsl.js`, `writeEntry`): it says the three cases compile
  "differently, without an error", which stays true. It is not edited, so the
  story stays off `bin/uxdsl.js`'s row.
- **An `--import` escape hatch for one release:** MIG-B9-14's flag 3 offered
  it; the decision of 2026-11-08 chose detection. Not done.
- **Isolation of variables, mixins and placeholders read from another
  file:** these are loud already (`UXD_SASS`). No change.
- **SH-4 and RR-1,** the other recorded differences of functions named like
  UXDSL's: accepted by decision D19 of 2026-11-04 (MIG-B9-12's flags 18 and
  19). Unchanged.
- **A `/docs/diagnostics` capture of `UXD_MODULE_ISOLATION`:** not required,
  since the page renders the catalog. It would put the story on the
  playground's §7 row. Proposed for MIG-B9-42 (wave 4) if wanted.
- **Windows:** MIG-B9-28.

## 7. Approach and traps

Non-normative. Items 4 to 6 are MIG-B9-26's, under their numbers; its items
1 to 3 are C1 to C3's.

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

- **P10.**
  - Bootstrap loads every file with `@import` and its output holds none of
    its function names, so C4 to C6 must cost it no compile.
  - A detection that probes every build fails C8: the ratio roughly doubles.
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
- **Comments.** `compile.ts`'s `CompileResult.warnings` comment lists the
  warning sources (lines 124–126 on `e704b3e`), and `compile-sass.ts`'s
  header states what the stage reports. Rewrite each comment this story
  touches to state the new behavior, with no story id (README §2).
- **`TMPDIR`.** The test file removes every directory it creates
  (`t.after`), unlike `compile-sass.test.js`'s `project()`.

Stop rule:

- **Stop if** C4 to C6 cannot be detected without a Dart Sass compile in a
  build that has no candidate (C8).
- **Stop if** a detection would change any `compile()` result other than
  `warnings`.

Set the story to Blocked, with the measurements in §15; the owner decides
(README §2, "Authority"). Never change a test's assertion, the corpus
runner or P10's budget to pass.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T6 | `packages/uxdsl/test/core/sass-stage-diagnostics.test.js` (made by MIG-B9-26) | `MIG-B9-17: under a generated @use entry, another file's @function left as written, a project @function named like a token that no call reaches, a !default an earlier file sets, and a bare call under a namespaced @use each warn UXD_MODULE_ISOLATION once, located, with the CSS unchanged` | unit (`compile()`) | C4, C5, C6 | `MIG-B9-17: an @import entry, the reading file's own @use … as *, calls through the namespace, a function no file defines, a known CSS function, and a module configured with @use … with warn nothing new (negative control)` |
| T7 | `packages/uxdsl/test/cli/uxdsl-cli.test.js` (`ISOLATION_CASES`'s three silent cases and the namespaced-`@use` test) | the two MIG-B9-14 tests, retitled: each silent case builds with exit 0 and its one `UXD_MODULE_ISOLATION` line on stderr instead of `''`; the namespaced form warns for `double` and `space` | CLI subprocess | C4, C5, C6 | the same tests' `@import`-entry test, `as *` and qualified forms keep their stderr (`''`, or BASE's `UXD_FUNCTION_SHADOWED` line) |
| T8 | `packages/uxdsl/test/core/sass-stage-diagnostics.test.js` | `MIG-B9-17: a build with no project @function named like a UXDSL function and no !default in a module runs Dart Sass once, as on BASE` | unit (counts `compileString` through a wrapper of `sass` in `require.cache`) | C8 | a build with a C6 candidate runs a probe: the count is above 1, so the counter sees compiles |
| T9 | `fixtures/release-1.0/run.js` (S-7, which MIG-B9-26 adds) and `fixtures/release-1.0/verdicts.test.js` | S-7 gains its isolation case: `[tarball] the installed CLI prints … an isolation case as a located UXD_MODULE_ISOLATION warning (exit 0)`; `MIG-B9-17: S-7 rejects an empty stderr and an unlocated warning for the isolation case (negative control)` | tarball | C4 | the verdict test's control |
| T10 | `fixtures/sass-corpus/run.js` (unedited) | its own output | fixture | C8 | a detection that probes every build exceeds the budget |
| T11 | `packages/uxdsl/test/diagnostics-catalog.test.js`, `scripts/doc-examples.test.js`, `fixtures/parity/run.js` (unedited) | as they are | unit, docs, parity | C7, the catalog and the documentation | their own |

T1 to T5 and T3b are MIG-B9-26's. T6 and T7 fail on BASE, as §4 shows. T8
and the C7 controls pass on BASE by design, and each has a control that
shows it can fail.

## 9. Acceptance criteria

The numbers are MIG-B9-26's (§5). AC2 is MIG-B9-26's only (T4, C2).

- **AC1** `node --test packages/uxdsl/test/near-miss-functions.test.js packages/uxdsl/test/core/sass-stage-diagnostics.test.js` exits 0, run with `TMPDIR` set to an empty scratch directory, which it leaves empty.
  - Test files: `near-miss-functions.test.js` and `sass-stage-diagnostics.test.js`.
  - Mutations, each failing it:
    - each detection removed in turn (T6);
    - a probe compile on every build (T8).
  - MIG-B9-26's AC1 holds the mutations of T1, T2, T3 and T5.
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
  - Mutation: none for this story; an invariant guard over the examples of
    the documentation it edits (`cli.md`, `migration.md`, the package
    README). MIG-B9-26's AC7 holds the mutation of its C1 example.
- **AC8** `node --test fixtures/release-1.0/verdicts.test.js` exits 0, and `npm run verify:1.0 -- --skip-playground-walk` exits 0 with S-7 `ok`.
  - Test files: `fixtures/release-1.0/run.js` and `verdicts.test.js`.
  - Mutation: BASE's tarball fails S-7.
- **AC9** The playground stays as it is.
  - `git diff --name-only "$(git merge-base HEAD origin/feat/beta9)" -- packages/playground-nextjs`
    lists nothing.
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

- Review the wording of the three `UXD_MODULE_ISOLATION` messages and of the
  catalog entry in the PR.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes: `compile-sass.ts` and `compile.ts` are in `VISUAL_DEFAULT_FILES`. One subsection under `## 0.5.0-beta.9 — unreleased`. Its `### Visual changes`: none |
| package README | yes: one sentence on the isolation warnings |
| `verify-docs-update.js` classification | no (no file added under `src`; if one is added, it is classified) |
| `npm run generate:language` | no |
| `AGENTS.md` + agent guide | no; `--check` runs (AC7) |
| `DIAGNOSTIC_CATALOG` | yes: `UXD_MODULE_ISOLATION` (`core`) |
| `npm run generate:capabilities` | run, no diff expected (the diagnostics capability is one row) |
| playground `uxdsl:build` + captures | run, no change expected (AC9) |
| `migration.md` | yes (item 9) |
| `docs/architecture/unified-engine-audit.md` | yes: the Sass stage's codes (line 59) |

## 11. Documentation

- `packages/uxdsl/docs/integrations/cli.md`, `generate-entry` (`:162–185`):
  the three cases compile differently and now warn `UXD_MODULE_ISOLATION`,
  and so does the bare call under a namespaced `@use`.
- `packages/uxdsl/docs/migration.md`, "beta.9 — Sass inside compile()": item
  9 (`:160–213`) names the warning.
- `packages/uxdsl/README.md`: one sentence beside the pipeline paragraph.
- `packages/uxdsl/CHANGELOG.md`: one subsection.
- `docs/architecture/unified-engine-audit.md:59`: the Sass stage's
  diagnostics, with `UXD_MODULE_ISOLATION`.

## 12. Verification

```bash
TMPDIR=<empty dir> node --test packages/uxdsl/test/near-miss-functions.test.js packages/uxdsl/test/core/sass-stage-diagnostics.test.js   # exit 0; <empty dir> stays empty
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

Branch `feat/b9-17-module-isolation-warnings`. Commit:
`feat(FEAT-010): MIG-B9-17 - the silent cases of @use's module isolation warn UXD_MODULE_ISOLATION`.

PR title: `FEAT-010: MIG-B9-17 - The silent cases of @use's module isolation warn`.
The body:

- **Goal:** §1, in two sentences.
- **The owner's answers:** decisions 9 to 11 of 2026-11-10 (MIG-B9-26's Q4
  to Q6), and where the contract follows them.
- **C4 to C6:** §4's B5 before and after, from the same script.
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

### Made from MIG-B9-26 (decision 6 of 2026-11-10)

This file was written on 2026-11-10, on `e704b3e` (PR #80's merge into
`feat/beta9`), from MIG-B9-26's file as PR #80 merged it. What moved, and
under which numbers:

- **Kept numbers.** MIG-B9-26's Q1, option (b), which decision 6 chose,
  reads "Each keeps its C-n, T-n and AC-n as numbered here, and C7 and C8
  apply to both". So MIG-B9-26's C4, C5 and C6 are this story's C4, C5 and
  C6, and the map is the identity:
  - C4 → C4, C5 → C5, C6 → C6; C7 and C8 are in both files, as written;
  - T6 → T6, T7 → T7, T8 → T8, retitled `MIG-B9-17: …` (README §3: a
    test's title starts with its story id); T9 is divided: S-7's near-miss
    and `@debug` cases stay in MIG-B9-26, and its isolation case is this
    story's T9, which extends the S-7 that MIG-B9-26 adds; T10 and T11 are
    in both;
  - AC1 is in both, with its mutations divided (T6's and T8's here); AC3 →
    AC3, AC4 → AC4; AC5, AC6, AC7, AC8 and AC10 are in both (this AC7 has
    no mutation of its own: MIG-B9-26's was its C1 example); AC9 is
    MIG-B9-26's as written, and here asserts that no playground file
    changes; AC2 stays in MIG-B9-26;
  - §4's B5, its "What it shows" item and its pin; §7's items 4 to 6 and
    the traps and stop rules of C4 to C6; §6's items on isolation;
  - MIG-B9-26's Q4, Q5 and Q6 (questions 9 to 11 of 2026-11-10), below as
    they were asked.
- **Renumbered or reworded only where this file needs it:** the test titles
  (`MIG-B9-17: …`), the baseline script's temporary file name
  (`mig-b9-17-baseline.js`; the script itself is unchanged), T9's S-7 title
  and verdict test (its isolation case only), T11's Proves column (C2 is
  MIG-B9-26's), the AC1 mutation list, AC7's mutation and AC9, the "must
  stay byte-identical" list (BASE now includes MIG-B9-26), the Comments and
  `TMPDIR` traps (MIG-B9-26 keeps the header comment's `@debug` and prefix
  sentences and makes the test file), and the header, §1, the opening lines
  of §3 to §9, §6's first item and §13.
- **Re-run on `e704b3e`.** §3's first block (all four lines exit 0), §4's
  script (the same B5 lines, exit 0, 14:06 EST) and §4's pin (3 pass, 158
  skipped). The package's code on `e704b3e` is `f855765`'s: PR #80 changed
  only story files and the index.
- **MIG-B9-26's §15 findings and review that concern this story.** Its F3
  listed the Shares README §7 did not: `cli.md`, `migration.md`,
  `unified-engine-audit.md` and `fixtures/release-1.0/verdicts.test.js`; the
  index's §7 now lists this story on each, and on the rows of every file in
  its Shares. Its review of 2026-11-10 applied R6 (C8 and AC6 use
  MIG-B9-23's AC1: the machine, three consecutive invocations after the
  last change to the Sass stage, none discarded), R9 (MIG-B9-24 shares no
  file with it) and R11 (start gates), which this file keeps.

### Open questions for the owner, as asked in MIG-B9-26 §15 (answered on 2026-11-10)

MIG-B9-26's Q4 to Q6, verbatim. They were questions 9 to 11 of 2026-11-10.

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

### Owner decisions of 2026-11-10 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-10). The owner was given 32 numbered questions, in Spanish, on the open questions of the seven story files written on 2026-11-10 and on three notes of their PR (#80), each with its options and a recommendation, and answered, verbatim, "fusiona y haz como recmiendes" ("fusiona y haz como recomiendes", "merge, and do as you recommend"): PR #80 was merged, and each recommendation is the owner's decision of 2026-11-10. This record is in English and lists those that concern this story. Where they differ from this story's contract, they rule.

- **MIG-B9-26's Q1 (decision 6): (b), a split.** MIG-B9-26 keeps the S part, C1 to C3, and decision 30. The M part, C4 to C6 (module isolation's silent cases), is this story, MIG-B9-17, in wave 2, right after MIG-B9-26; its file is made from MIG-B9-26's C4 to C6 material, with questions 9 to 11 and their answers. The header and the section above record what moved and how it is numbered.
- **Q4, the isolation code (decision 9): (a)**, as the contract assumed. One code for the four cases, named `UXD_MODULE_ISOLATION`. C4 to C6 do not change.
- **Q5, a function named like a UXDSL function and called through a namespace (decision 10): (a)**, as the contract assumed (DEC-17's pattern). A bare call that keeps the token warns only when no call reaches the definition, through a namespace either. C5 does not change.
- **Q6, when a `!default` warns (decision 11): (b)**, as the contract assumed. Only when the earlier file that assigns it emits no CSS, as a settings file does. C6 does not change.
