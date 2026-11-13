# MIG-B9-38 — A located CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the CSS

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 3 |
| Decision gate | None (registered by the decision of 2026-11-08 on MIG-B9-14's flag 12, as proposed in MIG-B9-14 §15; it answers MIG-B9-13 §15, flag 14, and takes over the warning that D18 of 2026-11-04 kept with MIG-B9-14). Four questions for the owner are open in §15 and are answered before implementing; the contract states what it assumes until then |
| Status | Ready |
| Size | S |
| Depends on | MIG-B9-14 and MIG-B9-22 (README §5; both merged, PR #71 and PR #76). Under README §7 it also waits for the earlier rows of the files it shares: MIG-B9-21 and 17 (`compile.ts`); MIG-B9-26, 17, 30, 32, 33, 34, 35 and 37 (`diagnostics.ts`); MIG-B9-37 (`bin/uxdsl.js`); MIG-B9-21, 25, 17 and 28 (`test/cli/**`); MIG-B9-26 and 27 (`compile.md`); MIG-B9-26, 17, 30 and 31 (`fixtures/release-1.0/run.js`); MIG-B9-25, 26 and 17 (`verdicts.test.js`); and MIG-B9-21, which every wave-3 story waits for (§7's preamble). MIG-B9-20, on several of these rows, is merged (PR #88) |
| Blocks | MIG-B9-91 (it depends on every story of waves 0 to 3). Under §7: MIG-B9-39 (`bin/uxdsl.js`, `test/cli/**`); MIG-B9-91 and 92 (`fixtures/release-1.0/run.js`); in `0.5.0-beta.10`, MIG-B9-60, 61 and 63 (`bin/uxdsl.js`) and MIG-B9-66 (`verdicts.test.js`) |
| Base | `feat/beta9` after MIG-B9-14 and 22, and within §7 after MIG-B9-17, 21, 25, 26, 27, 28, 30, 31, 32, 33, 34, 35 and 37. §3 and §4 were recorded on `5a041fc` (2026-11-13: `docs/b9-wave3-story-files` with `origin/feat/beta9` at `cc10de6` merged in, PR #88, MIG-B9-20; its package, fixtures and scripts equal `cc10de6`'s, `git diff --stat cc10de6 5a041fc -- packages fixtures scripts` is empty). Both are re-run on the base the story starts from (§3) |
| Owns | `packages/uxdsl/test/core/plain-import-warning.test.js` (new), `packages/uxdsl/test/cli/plain-import-warning.test.js` (new; it sits under §7's `test/cli/**` pattern), `packages/uxdsl/test/vite/plain-import-warning.test.js` (new), `packages/uxdsl/test/webpack/plain-import-warning.test.js` (new) |
| Shares | `packages/uxdsl/src/compile.ts` (one step in `compile()`'s PostCSS chain, and the `CompileResult.warnings` comment), `packages/uxdsl/src/diagnostics.ts` (one catalog entry), `packages/uxdsl/bin/uxdsl.js` (the two byte counts of `[uxdsl] built …`, Q4 (b)), `packages/uxdsl/docs/integrations/compile.md` (the `warnings` item and the "Sass's import rules apply" bullet), `fixtures/release-1.0/run.js` (one check, `B9-38`, and its verdict function), `fixtures/release-1.0/verdicts.test.js` (that verdict and its negative control), `packages/uxdsl/CHANGELOG.md` (one subsection), `packages/uxdsl/README.md` (one sentence). This list follows Q1 (a), Q2 (a), Q3 (a) and Q4 (b) of §15; another answer changes it as §15 says |
| Output impact | API/CLI: a new warning, `UXD_PLAIN_IMPORT` (Q2 (a)), in `compile()`'s `warnings`, so printed by the CLI (`build` and `build --watch`), `uxdsl/vite` and `uxdsl/webpack` (Q1 (a)); the CLI's `(<n> bytes)` counts bytes (Q4 (b)). Compiled output: none |

## 1. Goal

An `@import` that Dart Sass keeps as a plain CSS `@import` (a media query,
`supports()`, `layer()`, a `url()`, or an `http://`, `https://` or `//`
URL) is never compiled, even when its URL names a `.uxdsl`, `.scss` or
`.sass` file, and today nothing says so: the CLI ships a URL no browser can
use, and Vite and webpack inline the file as written. After this story every
such `@import` left in `compile()`'s CSS is one `UXD_PLAIN_IMPORT` warning
at the author's file, line and column, printed by the CLI, and the CSS does
not change.

## 2. Sources

All quoted on `5a041fc`.

- **The registration.** FEAT-010 §2, "Owner decisions of 2026-11-08"
  (`docs/features/FEAT-010-beta9.md`, line 226; the owner's answer,
  "todo como recomendado", line 204):

  > - **Flag 12 — MIG-B9-38 registered,** "A located CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the CSS": S, wave 3, depends on MIG-B9-14 and 22; one new catalogued code. It answers MIG-B9-13's flag 14 and moves to MIG-B9-38 the warning that decision D18 of 2026-11-04 kept with MIG-B9-14, which did not implement it.

  The same decision in MIG-B9-14's own record
  (`docs/features/FEAT-010/MIG-B9-14-cli-and-adapters.md`, line 694):

  > - **Flag 12, MIG-B9-13's flag 14:** MIG-B9-38 is registered as proposed in the follow-ups above, "A located CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the CSS" (S, wave 3, depends on MIG-B9-14 and 22), with one new catalogued code. It answers MIG-B9-13's flag 14 and moves to MIG-B9-38 the warning that decision D18 of 2026-11-04 kept with this story, which did not implement it.

- **The proposal it registers "as proposed"** (MIG-B9-14 §15, "Follow-ups",
  lines 667–669):

  > - **MIG-B9-38, new.** "A located CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the CSS". S, wave 3, depends on 14 and 22 (`bin/uxdsl.js`).
  >   - It answers MIG-B9-13's flag 14 (D18) with one new catalog code.
  >   - The byte count of `[uxdsl] built … (<n> bytes)` (fact 4) can ride along.

  MIG-B9-14's owner flag 12 (line 588) and fact 4 (line 535):

  > 12. **MIG-B9-13's flag 14, kept with this story by D18.** The proposed CLI warning, for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the output, is not implemented. It needs a new catalog code, and §10 says "`DIAGNOSTIC_CATALOG`: no" for this story.

  > 4. **Byte counts.** The CLI's `[uxdsl] built <file> (<n> bytes)` counts characters, not bytes. The Next.js fixture's module is 302 bytes on disk, and the CLI reports 297. This predates the story (MIG-B9-03 §2 noted it).

- **The flag it answers** (MIG-B9-13 §15, flag 14,
  `docs/features/FEAT-010/MIG-B9-13-compile-on-sass.md`, lines 684–689):

  > 14. **Sass's import rules are breaking.**
  >     - An `@import` with a media query, `layer()`, `supports()` or `url()` stays a plain CSS `@import`, even for a `.uxdsl` target, so a CLI build silently ships a URL no browser can load.
  >     - `@import "x.css"` is not inlined.
  >     - A file `@import`ed twice is emitted twice.
  >
  >     Proposed: a CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL left in the output (MIG-B9-14).

- **D18 of 2026-11-04** (`FEAT-010-beta9.md`, line 193; MIG-B9-13 §15,
  line 818):

  > For flag 14, the proposed CLI warning for a plain `@import` of a `.uxdsl`, `.scss` or `.sass` URL stays with MIG-B9-14.

- **The index** (`docs/features/FEAT-010/README.md`): the row (line 224)
  (wave 3, gate "—", size S, depends on "14, 22", status "Draft (story
  file to be written; registered by the decision of 2026-11-08 on
  MIG-B9-14's flag 12, as proposed in its §15; …)");
  lines 287–288, "MIG-B9-38 and 39 are the last wave-3 rows, right before
  MIG-B9-91; both edit `bin/uxdsl.js`, so MIG-B9-39 waits for MIG-B9-38";
  §7 rows (lines 390 and 392):
  "`| packages/uxdsl/bin/uxdsl.js | 14, 20, 22, 38, 39, 60, 61, 63 |`" and
  "`| packages/uxdsl/src/diagnostics.ts | 04, 11, 12, 13, 26, 17, 30, 32, 33, 34, 35, 37, 38 |`",
  provisional until this file states its Owns and Shares (lines 439–445).

- **Dart Sass's rule.** The Sass documentation, "Plain CSS `@import`s"
  (<https://sass-lang.com/documentation/at-rules/import/>): "Sass will
  compile any `@import`s with the following characteristics to plain CSS
  imports:" "Imports where the URL ends with `.css`." "Imports where the URL
  begins `http://` or `https://`." "Imports where the URL is written as a
  `url()`." "Imports that have media queries." The page does not mention
  `supports()` or `layer()`. The implementation the repository runs
  (`packages/uxdsl/node_modules/sass/sass.dart.js`, Dart Sass 1.107.0) is
  wider: `importArgument$0()` returns a plain `StaticImport` when
  `if (_this.isPlainImportUrl$1(url) || modifiers != null)` (line 62936),
  and `isPlainImportUrl$1` (line 62959) is true for a URL that ends with
  `.css`, starts with `//`, or starts with `http://` or `https://`; a
  `url(…)` argument is always a `StaticImport`; and `modifiers` is any
  media query, `supports()` or `layer()` after the URL. A plain `@import`
  raises no Sass warning (§4).

- **What the documentation says today.** `packages/uxdsl/docs/integrations/compile.md`,
  lines 364–368:

  > - `@import 'x.css'`, and an `@import` with a media query, `layer()`,
  >   `supports()` or `url()` — of a `.uxdsl` file too — stays a plain CSS
  >   `@import`, moved before every other rule: the browser loads that file
  >   itself, untouched by UXDSL. `@use './x'` of a `.css` file inlines it, read
  >   as written.

  and lines 89–92, on `compile()`'s result:

  > - `warnings`: `{ text, file?, line?, column? }[]`: Dart Sass's
  >   (`UXD_SASS_WARNING`, then `UXD_FUNCTION_SHADOWED`), then the plugin's, each
  >   at the author's file, line and column when it has a position; one without
  >   a position is `{ text }` alone.

  The package README (line 1637) and `migration.md` (item 2, line 96) say
  the same of the import rules.

- **How every host prints `compile()`'s warnings today** (MIG-B9-14,
  merged; its flag 7, "Located adapter warnings", accepted as delivered on
  2026-11-08):
  - `packages/uxdsl/src/compile.ts`, lines 234–237:
    `const warnings: CompileWarning[] = [ …stage.warnings…, ...result.warnings().map((warning) => relocateWarning(warning, locate, stageEntry, hidden)), ];`
    — every PostCSS warning of the chain is located through the Sass
    stage's map by `relocateWarning` (line 416).
  - `packages/uxdsl/bin/uxdsl.js`, line 1071:
    `for (const warning of result.warnings || []) {` — each printed as
    `[uxdsl] Warning: <file>:<line>:<column>: <text>` (`formatCompileWarning`,
    line 797), a line with a file once per build.
  - `packages/uxdsl/src/vite.ts`, line 200:
    `for (const warning of warnings) this.warn(formatWarning(warning, projectRoot));`
  - `packages/uxdsl/src/webpack.ts`, line 228:
    `for (const warning of warnings) this.emitWarning(new Error(formatWarning(warning, this.rootContext)));`
  - The CLI's byte count, `bin/uxdsl.js` lines 1131 and 1133:
    `` ? ` + ${path.basename(mapFile)} (${mapContent.length} bytes)` `` and
    `` console.log(`[uxdsl] built ${rel} (${finalCss.length} bytes)${mapNote}`); ``.

- **The precedent for a build-level warning built in `compile.ts`.**
  MIG-B9-20 (merged) produces `UXD_THEME_MARKER`'s build-level text in
  `compile.ts` (`themeEmissionWarning`, line 562) and every host prints it;
  its catalog owner is `compiler` (`diagnostics.ts`, line 104).
  `test/diagnostics-catalog.test.js`, lines 94–100, pins the `core` owner
  to exactly `UXD_FUNCTION_SHADOWED`, `UXD_SASS` and `UXD_SASS_WARNING`.

## 3. Preconditions

Run from the worktree root.

```bash
git merge-base --is-ancestor db0e28d HEAD                                    # PR #71, MIG-B9-14
git merge-base --is-ancestor 08d00e0 HEAD                                    # PR #76, MIG-B9-22
git merge-base --is-ancestor cc10de6 HEAD                                    # PR #88, MIG-B9-20
grep -qF 'for (const warning of result.warnings || []) {' packages/uxdsl/bin/uxdsl.js
grep -qF '...result.warnings().map((warning) => relocateWarning(warning, locate, stageEntry, hidden)),' packages/uxdsl/src/compile.ts
grep -qF 'for (const warning of warnings) this.warn(formatWarning(warning, projectRoot));' packages/uxdsl/src/vite.ts
grep -qF 'for (const warning of warnings) this.emitWarning(new Error(formatWarning(warning, this.rootContext)));' packages/uxdsl/src/webpack.ts
grep -qF 'export function themeEmissionWarning(' packages/uxdsl/src/compile.ts
grep -qF '(${finalCss.length} bytes)' packages/uxdsl/bin/uxdsl.js                 # Q4's line
node -e "process.exit(Object.keys(require('./packages/uxdsl/dist/diagnostics').DIAGNOSTIC_CATALOG).some((code) => /^UXD_PLAIN_IMPORT/.test(code)) ? 1 : 0)"
node -e "const c = require('./packages/uxdsl/dist/diagnostics').DIAGNOSTIC_CATALOG; process.exit(c.UXD_THEME_MARKER.owner === 'compiler' && Object.keys(c).filter((k) => c[k].owner === 'core').sort().join() === 'UXD_FUNCTION_SHADOWED,UXD_SASS,UXD_SASS_WARNING' ? 0 : 1)"
node -e "process.exit(JSON.parse(require('fs').readFileSync('packages/uxdsl/node_modules/sass/package.json', 'utf8')).version === '1.107.0' ? 0 : 1)"
grep -qF 'if (_this.isPlainImportUrl$1(url) || modifiers != null)' packages/uxdsl/node_modules/sass/sass.dart.js
grep -qF -- '`supports()` or `url()` — of a `.uxdsl` file too — stays a plain CSS' packages/uxdsl/docs/integrations/compile.md
test ! -e packages/uxdsl/test/core/plain-import-warning.test.js && test ! -e packages/uxdsl/test/cli/plain-import-warning.test.js && test ! -e packages/uxdsl/test/vite/plain-import-warning.test.js && test ! -e packages/uxdsl/test/webpack/plain-import-warning.test.js
```

All fifteen exit 0 on `5a041fc` (2026-11-13, run through `bash` with
`grep` the system's; the writer's zsh defines `grep` as a function, so the
lines are written for a plain shell). They are re-run on the base the story
starts from. A line that is only stale (MIG-B9-17, 21 or 37 moved a line of
`compile.ts` or `bin/uxdsl.js`, say) is corrected as README §1 item 4
allows. If MIG-B9-17 has added a `core` code (its Q4 (a),
`UXD_MODULE_ISOLATION`), the eleventh line is corrected to that set.

## 4. Baseline

Run from the worktree root on `5a041fc`, through `bash`, with `TMPDIR` set
to an empty scratch directory; the repository's own `dist`, built from
`5a041fc`. Environment: macOS 27.0 (Darwin 27.0.0, arm64), Node 20.19.0,
npm 11.21.1, Dart Sass 1.107.0 (the repository's).

### Part 1 — `uxdsl build` and `compile()`

```bash
U="$PWD/packages/uxdsl"
X="$(mktemp -d "${TMPDIR:?}/mig-b9-38.XXXXXX")"
mkdir -p "$X/src/parts"
printf '%s\n' '@use "./parts/j";' '@import "./parts/a.uxdsl" screen;' '@import url("./parts/b.uxdsl");' '@import url(./parts/c.scss);' '@import "./parts/d.scss" layer(base);' '@import "./parts/e.sass" supports(display: grid);' '@import "//cdn.example.com/f.uxdsl";' '@import "https://cdn.example.com/g.scss";' '@import "./parts/h.css";' '@import "./parts/i.uxdsl";' '@uxdsl theme;' '.main { color: palette(primary.main); }' '@media print { @import url("./parts/m.uxdsl"); }' > "$X/src/main.uxdsl"
printf '.k { margin: 0; }\n@import url("./k.uxdsl") print;\n' > "$X/src/parts/_j.uxdsl"
printf '.i { margin: space(1); }\n' > "$X/src/parts/i.uxdsl"
# (1) uxdsl build: what it prints, its exit status, and every @import of a .uxdsl, .scss or .sass URL it writes.
(cd "$X" && node "$U/bin/uxdsl.js" build --entry src/main.uxdsl --out out/main.css; echo "build exit=$?")
grep -nE '@import .*\.(uxdsl|scss|sass)' "$X/out/main.css"
# (2) compile(): its warnings, and where the Sass stage's map puts each such @import, as compile() locates a position.
(cd "$X" && node -e '
const path = require("path"); const U = process.argv[1];
const { compile } = require(U + "/dist/compile");
const { compileSassStage } = require(U + "/dist/sass/compile-sass");
const { SourceMapConsumer } = require(require.resolve("source-map-js", { paths: [U] }));
const postcss = require(require.resolve("postcss", { paths: [U] }));
(async () => {
  const entry = path.resolve("src/main.uxdsl");
  const r = await compile({ entry });
  for (const w of r.warnings) console.log("warning:", path.relative(".", w.file || "") + ":" + w.line + ":" + w.column, w.text.slice(0, 40));
  console.log("themeEmitted:", r.themeEmitted);
  const stage = compileSassStage({ entry }, { reserved: [], sourceMap: true });
  const map = new SourceMapConsumer(stage.map);
  postcss.parse(stage.css).walkAtRules("import", (n) => {
    if (!/\.(uxdsl|scss|sass)\b/.test(n.params)) return;
    const at = map.originalPositionFor({ line: n.source.start.line, column: n.source.start.column - 1 });
    console.log("stage:", n.source.start.line + ":" + n.source.start.column, "@import " + n.params, "->", path.relative(".", at.source) + ":" + at.line + ":" + (at.column + 1));
  });
})().catch((e) => { console.error(e.message); process.exit(1); });
' "$U"; echo "compile exit=$?")
rm -rf "$X"
```

Recorded (the script exits 0):

```text
[uxdsl] Warning: src/main.uxdsl:10:9: UXD_SASS_WARNING: [import] Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.
[uxdsl] built out/main.css (47718 bytes)
build exit=0
2:@import url("./k.uxdsl") print;
3:@import "./parts/a.uxdsl" screen;
4:@import url("./parts/b.uxdsl");
5:@import url(./parts/c.scss);
6:@import "./parts/d.scss" layer(base);
7:@import "./parts/e.sass" supports(display: grid);
8:@import "//cdn.example.com/f.uxdsl";
9:@import "https://cdn.example.com/g.scss";
40:  @import url("./parts/m.uxdsl");
warning: src/main.uxdsl:10:9 UXD_SASS_WARNING: [import] Sass @import 
themeEmitted: true
stage: 1:1 @import url("./k.uxdsl") print -> src/parts/_j.uxdsl:2:9
stage: 2:1 @import "./parts/a.uxdsl" screen -> src/main.uxdsl:2:9
stage: 3:1 @import url("./parts/b.uxdsl") -> src/main.uxdsl:3:9
stage: 4:1 @import url(./parts/c.scss) -> src/main.uxdsl:4:9
stage: 5:1 @import "./parts/d.scss" layer(base) -> src/main.uxdsl:5:9
stage: 6:1 @import "./parts/e.sass" supports(display: grid) -> src/main.uxdsl:6:9
stage: 7:1 @import "//cdn.example.com/f.uxdsl" -> src/main.uxdsl:7:9
stage: 8:1 @import "https://cdn.example.com/g.scss" -> src/main.uxdsl:8:9
stage: 24:3 @import url("./parts/m.uxdsl") -> src/main.uxdsl:13:24
compile exit=0
```

What it shows:

- Nine `@import`s of a `.uxdsl`, `.scss` or `.sass` URL reach the CSS,
  eight hoisted before the theme and one left nested in `@media print`, one
  of them from a partial. The build exits 0 and prints nothing about any of
  them; the only warning is the `[import]` deprecation of line 10, which
  Dart Sass inlined. `./parts/h.css` stays a plain `@import` too (line 10
  of the output, not matched by the `grep`), as the control.
- The Sass stage's map locates every one in the author's source. The
  position is where Dart Sass maps the rule, the first character of its URL
  (`src/main.uxdsl:2:9` for line 2's `@import "./parts/a.uxdsl" screen;`),
  the same column at which `compile()` reports the `[import]` deprecation
  (`10:9`); the nested one is at `13:24`.
- None of the files the plain `@import`s name needs to exist: Dart Sass
  does not load them.

The final map keeps these positions after the plugin hoists the `@import`s
above the theme. Through the packed `5a041fc` tarball of Part 4, the same
entry (without line 13, with `@uxdsl theme;` last) compiled by
`compile({ entry }, { sourceMap: 'external' })` maps each output `@import`
back with `source-map-js`:

```text
1:1 @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap')  ->  <no source>:1:1
2:1 @import url("./k.uxdsl") print  ->  ../src/parts/_j.uxdsl:2:9
3:1 @import "./parts/a.uxdsl" screen  ->  ../src/main2.uxdsl:2:9
4:1 @import url("./parts/b.uxdsl")  ->  ../src/main2.uxdsl:3:9
5:1 @import url(./parts/c.scss)  ->  ../src/main2.uxdsl:4:9
6:1 @import "./parts/d.scss" layer(base)  ->  ../src/main2.uxdsl:5:9
7:1 @import "./parts/e.sass" supports(display: grid)  ->  ../src/main2.uxdsl:6:9
8:1 @import "//cdn.example.com/f.uxdsl"  ->  ../src/main2.uxdsl:7:9
9:1 @import "https://cdn.example.com/g.scss"  ->  ../src/main2.uxdsl:8:9
10:1 @import "./parts/h.css"  ->  ../src/main2.uxdsl:9:9
```

(the theme's Google Fonts `@import` is generated and has no source).

### Part 2 — `uxdsl build --watch`

```bash
U="$PWD/packages/uxdsl"
X="$(mktemp -d "${TMPDIR:?}/mig-b9-38-watch.XXXXXX")"
mkdir -p "$X/src"
printf '%s\n' '@import "./a.uxdsl" screen;' '@import url("./b.scss");' '@import "./c.sass" supports(display: grid);' '@uxdsl theme;' '.main { color: palette(primary.main); }' > "$X/src/main.uxdsl"
# (3) uxdsl build --watch: the first build, one save of the entry, the rebuild, then SIGINT.
(cd "$X" && node -e '
const { spawn } = require("child_process"); const fs = require("fs");
const child = spawn(process.execPath, [process.argv[1] + "/bin/uxdsl.js", "build", "--entry", "src/main.uxdsl", "--out", "out/main.css", "--watch"]);
let log = ""; const keep = (tag) => (d) => { for (const l of String(d).split("\n")) if (l.trim()) log += tag + " " + l + "\n"; };
child.stdout.on("data", keep("[stdout]")); child.stderr.on("data", keep("[stderr]"));
const built = () => (log.match(/\[uxdsl\] (built|unchanged)/g) || []).length;
const until = (n) => new Promise((ok, no) => { const t = Date.now(); const i = setInterval(() => { if (built() >= n) { clearInterval(i); ok(); } else if (Date.now() - t > 20000) { clearInterval(i); no(new Error("no build " + n)); } }, 50); });
(async () => {
  try { await until(1); await new Promise((r) => setTimeout(r, 400)); fs.appendFileSync("src/main.uxdsl", "/* saved */\n"); await until(2); await new Promise((r) => setTimeout(r, 300)); }
  catch (e) { log += "[harness] " + e.message + "\n"; }
  child.on("exit", (code, signal) => { process.stdout.write(log + "[harness] watcher exited, signal " + signal + "\n"); });
  child.kill("SIGINT");
})();
' "$U")
grep -cE '^@import .*\.(uxdsl|scss|sass)' "$X/out/main.css"
rm -rf "$X"
```

Recorded (exit 0; `pgrep -fl "uxdsl.*--watch"` found no watcher left):

```text
[stdout] [uxdsl] built out/main.css (47381 bytes)
[stdout] [uxdsl] watching for changes...
[stdout] [uxdsl] change src/main.uxdsl
[stdout] [uxdsl] built out/main.css (47395 bytes)
[harness] watcher exited, signal SIGINT
3
```

Three plain `@import`s of a `.uxdsl`, `.scss` and `.sass` URL, two builds,
nothing on stderr.

### Part 3 — the byte count (MIG-B9-14 §15, fact 4; Q4)

```bash
U="$PWD/packages/uxdsl"
X="$(mktemp -d "${TMPDIR:?}/mig-b9-38-bytes.XXXXXX")"
printf '.a { content: "→ é"; }\n' > "$X/a.uxdsl"
(cd "$X" && node "$U/bin/uxdsl.js" build --entry a.uxdsl --out out/a.css --sourcemap; echo "build exit=$?")
wc -c < "$X/out/a.css" | tr -d ' '; wc -c < "$X/out/a.css.map" | tr -d ' '
rm -rf "$X"
```

Recorded (exit 0):

```text
[uxdsl] built out/a.css (76 bytes) + a.css.map (141 bytes)
build exit=0
79
144
```

`→` is three bytes in UTF-8 and `é` two: the CLI prints 76 and 141, the
files hold 79 and 144 bytes.

### Part 4 — Vite and webpack, from a packed copy of the package

Run outside the repository: `packages/uxdsl` of `5a041fc` copied (without
`node_modules` and `dist`) beside `tsconfig.base.json`, with the
repository's `node_modules` linked, then `npm pack` (its `prepack` builds
it); a scratch project ran
`npm install <tarball> vite@7.3.7 webpack@5.111.1 css-loader@7.1.5 mini-css-extract-plugin@2.10.2`,
which resolved `uxdsl` 0.5.0-beta.9, Dart Sass 1.108.2 (from `^1.107.0`;
the repository tests 1.107.0) and PostCSS 8.5.32. Each case is one entry
`cases/<name>.uxdsl` of three lines: the `@import` shown, `@uxdsl theme;`,
and `.main { color: palette(primary.main); }`; the imported files are
`src/parts/a.uxdsl` (`.a { color: palette(primary.main); }`), `b.uxdsl`
(`.b { padding: space(2); }`), `c.scss` (`$c: red;` and `.c { color: $c; }`),
`d.scss` (`.d { &__x { color: blue; } }`), `e.sass` (indented `.e` /
`color: green`), `h.css`, and the partial `_j.uxdsl` of Part 1. The script,
run as `node hosts.js a-media b-url c-url-scss d-layer-scss e-supports-sass f-protorel g-https h-css k-partial`:

```js
// For each case entry: what `vite build` and webpack (the documented chain) print and write.
const fs = require('fs'); const path = require('path');
const root = process.cwd();
const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.trim()).filter((l) => l && !l.includes('--uxdsl__') && !l.includes('fonts.googleapis') && l !== '}' && !/^:root|^\[data-theme|^@media \(prefers-color-scheme/.test(l)).join(' ').replace(/\.main \{ color: var\(--uxdsl__palette__primary-main\); \}/, '');
const cssBefore = (css) => { const i = css.indexOf('.main'); return clean(i === -1 ? css : css.slice(0, i)); };
async function vite(name) {
  const { build } = await import('vite'); const uxdsl = (await import('uxdsl/vite')).default;
  const input = path.join(root, `cases/${name}.js`); fs.writeFileSync(input, `import './${name}.uxdsl';\n`);
  const out = path.join(root, `out/h-vite-${name}`); const warns = [];
  try { await build({ root, configFile: false, logLevel: 'silent', plugins: [uxdsl()], build: { outDir: out, emptyOutDir: true, minify: false, rollupOptions: { input, onwarn(w) { warns.push(w.message); } } } }); }
  catch (e) { return `FAILS: ${e.message.split('\n')[0].replaceAll(root + '/', '')}`; }
  const dir = path.join(out, 'assets'); const f = fs.readdirSync(dir).find((x) => x.endsWith('.css'));
  return `exit 0, ${warns.length} warning(s); CSS: ${cssBefore(fs.readFileSync(path.join(dir, f), 'utf8'))}`;
}
function webpack(name) {
  const wp = require('webpack'); const M = require('mini-css-extract-plugin');
  const out = path.join(root, `out/h-wp-${name}`);
  return new Promise((resolve) => { const c = wp({ mode: 'development', devtool: false, context: root, entry: path.join(root, `cases/${name}.uxdsl`), output: { path: out }, module: { rules: [{ test: /\.uxdsl$/, use: [M.loader, 'css-loader', 'uxdsl/webpack'] }] }, plugins: [new M()], infrastructureLogging: { level: 'error' } });
    c.run((err, stats) => { const j = stats.toJson({ all: false, errors: true, warnings: true }); c.close(() => {});
      if (j.errors.length) return resolve(`FAILS: ${j.errors[0].message.replace(/\s+/g, ' ').replaceAll(root + '/', '').slice(0, 150)}`);
      resolve(`ok, ${j.warnings.length} warning(s); CSS: ${cssBefore(fs.readFileSync(path.join(out, 'main.css'), 'utf8'))}`); }); });
}
(async () => { for (const name of process.argv.slice(2)) { console.log(`${name}: ${fs.readFileSync(`cases/${name}.uxdsl`, 'utf8').split('\n')[0]}`); console.log(`  vite:    ${await vite(name)}`); console.log(`  webpack: ${await webpack(name)}`); } })();
```

Recorded on 2026-11-13 (the CSS column is the output before the first
`.main`, with comments, the theme's blocks and the Google Fonts `@import`
filtered out; for `a-media` the first `.main` is the one inside
`palette(primary.main)`, which is why that line stops there):

```text
a-media: @import "../src/parts/a.uxdsl" screen;
  vite:    exit 0, 0 warning(s); CSS: @media screen{ .a { color: palette(primary
  webpack: ok, 0 warning(s); CSS: @media screen { .a { color: palette(primary
b-url: @import url("../src/parts/b.uxdsl");
  vite:    exit 0, 0 warning(s); CSS: .b { padding: space(2); }
  webpack: ok, 0 warning(s); CSS: .b { padding: space(2); }
c-url-scss: @import url(../src/parts/c.scss);
  vite:    exit 0, 0 warning(s); CSS: .c { color: red;
  webpack: ok, 0 warning(s); CSS: $c: red; .c { color: $c; }
d-layer-scss: @import "../src/parts/d.scss" layer(base);
  vite:    exit 0, 0 warning(s); CSS: @layer base{ .d__x { color: blue;
  webpack: ok, 0 warning(s); CSS: @layer base { .d { &__x { color: blue; } }
e-supports-sass: @import "../src/parts/e.sass" supports(display: grid);
  vite:    exit 0, 0 warning(s); CSS: @supports (display: grid){ .e { color: green;
  webpack: FAILS: Module build failed (from ./node_modules/css-loader/dist/cjs.js): SyntaxError (2:3) src/parts/e.sass Unknown word color 1 | .e > 2 | color: green | ^ 
f-protorel: @import "//cdn.example.com/f.uxdsl";
  vite:    exit 0, 0 warning(s); CSS: 
  webpack: ok, 0 warning(s); CSS: @import url(//cdn.example.com/f.uxdsl);
g-https: @import "https://cdn.example.com/g.scss";
  vite:    exit 0, 0 warning(s); CSS: 
  webpack: ok, 0 warning(s); CSS: @import url(https://cdn.example.com/g.scss);
h-css: @import "../src/parts/h.css";
  vite:    exit 0, 0 warning(s); CSS: .h { color: black; }
  webpack: ok, 0 warning(s); CSS: .h { color: black; }
k-partial: @use "../src/parts/j";
  vite:    FAILS: [vite:css] [postcss] ENOENT: no such file or directory, open './k.uxdsl'
  webpack: FAILS: Module build failed (from ./node_modules/css-loader/dist/cjs.js): Error: Can't resolve './k.uxdsl' in 'cases' at finishWithoutResolve (node_modules/en
```

For `f-protorel` and `g-https`, Vite keeps the remote `@import` on the
Google Fonts line, which the script filters out:
`grep -o '@import[^;]*;'` of the asset prints `@import "//cdn.example.com/f.uxdsl";`
and `@import "https://cdn.example.com/g.scss";`.

What it shows: no host warns. Neither bundler leaves a local plain `@import`
for the browser; each inlines the file through its own CSS pipeline, never
through UXDSL: a `.uxdsl` file's `palette(primary.main)` and `space(2)`
reach the asset as written in both; Vite compiles `.scss` and `.sass` with
its own Sass; webpack's `css-loader` inlines `.scss` as written (`$c`,
`&__x`) and fails on `.sass`. A remote URL stays an `@import` in both. A
plain `@import` written in a partial is resolved against the module's
directory, not the partial's, and fails in both (`k-partial`). The CLI
(Part 1) leaves every one of them for the browser.

### Part 5 — edge forms through `compile()`

`compile({ source })` on `5a041fc`, each source alone (no theme marker, so
no theme in the output):

```text
"@media print { @import url(\"x.uxdsl\"); }\n.a { color: red; }" => "@media print {\n  @import url(\"x.uxdsl\");\n}\n.a {\n  color: red;\n}" | warnings: 0
".a { @import url(\"x.scss\"); color: red; }" => ".a {\n  @import url(\"x.scss\");\n  color: red;\n}" | warnings: 0
"@import \"x.SCSS\" screen;" => "@import \"x.SCSS\" screen;" | warnings: 0
"@import \"x.scss?v=1\" screen;" => "@import \"x.scss?v=1\" screen;" | warnings: 0
"@import \"x.uxdsl#a\" print;" => "@import \"x.uxdsl#a\" print;" | warnings: 0
"@import url(\"a.uxdsl\"), url(\"b.scss\");" => "@import url(\"a.uxdsl\");\n@import url(\"b.scss\");" | warnings: 0
"@import url(  \"d.uxdsl\"  ) layer(x) supports(display:grid) screen;" => "@import url(\"d.uxdsl\") layer(x) supports(display: grid) screen;" | warnings: 0
"@import URL(e.uxdsl);" => "@import url(e.uxdsl);" | warnings: 0
"@import \"x.uxdsl\" screen, \"y.css\";" THREW <css input>:1:27: UXD_SASS: Expected identifier.
"@import \"x.css\";\n@import url(x.css) print;" => "@import \"x.css\";\n@import url(x.css) print;" | warnings: 0
"@import \"x.uxdsl\" screen;\n@import \"x.uxdsl\" screen;" => "@import \"x.uxdsl\" screen;\n@import \"x.uxdsl\" screen;" | warnings: 0
```

And a partial `_p.uxdsl` holding `@import url("./x.uxdsl") print;`,
`@import`ed twice by `m.uxdsl`: the output holds that plain `@import` twice,
both from the same author position (`_p.uxdsl:1:9`), and the two warnings
are Dart Sass's `[import]` deprecations at `m.uxdsl:1:9` and `m.uxdsl:2:9`.

## 5. Contract

The public entry points are `compile()` (`uxdsl`), the CLI as a subprocess
(`uxdsl build`, `uxdsl build --watch`), `uxdsl/vite` and `uxdsl/webpack`,
and `DIAGNOSTIC_CATALOG` (`uxdsl/language`). Where §15's open questions
leave a choice, the contract assumes Q1 (a), Q2 (a), Q3 (a) and Q4 (b).

- **C1 — `compile()` warns for every plain `@import` of such a URL in its
  CSS.** For every `@import` at-rule in `compile()`'s `css`, at any depth
  (top level, inside an at-rule such as `@media`, inside a rule), whose URL
  C2 matches, `warnings` holds one entry:
  - `text` is exactly
    `UXD_PLAIN_IMPORT: @import <params> is left in the CSS as a plain @import, so <url> is not compiled; load a local file with @use (or @include meta.load-css() under a condition), or link the compiled CSS of a remote one.`
    where `<params>` is the at-rule's prelude as `compile()`'s CSS writes it
    (`"./parts/a.uxdsl" screen`, `url("./parts/b.uxdsl")`) and `<url>` its URL
    without quotes or `url()` (`./parts/a.uxdsl`). The text does not contain
    `[import]` (the release gate's S-4 counts the stderr lines that do).
  - It is located as `compile()` locates every plugin warning
    (`relocateWarning`, through the Sass stage's map): where Dart Sass maps
    the rule, the first character of its URL in the author's file. For
    §4 Part 1's entry that is `src/parts/_j.uxdsl:2:9`, `src/main.uxdsl:2:9`
    to `8:9` and `src/main.uxdsl:13:24` (absolute `file` in `compile()`; the
    hosts make it relative). An anonymous source gets what `relocateWarning`
    gives any plugin warning there.
  - Entries are appended after every warning `compile()` reports today, in
    the order the at-rules appear in the CSS. Two at-rules with the same
    `text` at the same `file`, `line` and `column` (a partial `@import`ed
    twice, §4 Part 5) are one entry.
  - `css`, `map`, `dependencies` and `themeEmitted` do not change, and
    neither does any warning `compile()` reports today, nor its order.
- **C2 — Which URLs (Q3 (a)).** The URL's path, the text before its first
  `?` or `#`, ends with `.uxdsl`, `.scss` or `.sass`, compared without
  regard to case, whatever its scheme (a relative path, `//…`, `http://…`,
  `https://…`), written as a string or as `url()` in any case. Not matched:
  `.css` and every other extension, a URL with no extension (`@import 'print' print;`),
  and the theme's Google Fonts `@import` (its path ends `/css2`). An
  `@import` Dart Sass inlined is not in the CSS and is never matched. Of
  §4 Part 5's forms, all but `x.css` and the one that throws `UXD_SASS`
  warn, `x.SCSS`, `x.scss?v=1` and `x.uxdsl#a` included.
- **C3 — The CLI prints it.** `uxdsl build` prints each `UXD_PLAIN_IMPORT`
  entry as it prints every `compile()` warning:
  `[uxdsl] Warning: src/main.uxdsl:2:9: UXD_PLAIN_IMPORT: @import "./parts/a.uxdsl" screen is left in the CSS as a plain @import, so ./parts/a.uxdsl is not compiled; …`
  on stderr, a line with a file once per build (two `builds` entries that
  load the same partial print its line once). The exit status stays 0 and
  every written file keeps its bytes. `uxdsl build --watch` prints it again
  on every build that recompiles the entry, as every warning (MIG-B9-14's
  flag 6), and keeps watching. §4 Part 1 on the head prints the nine lines
  of AC5 after the `[import]` deprecation.
- **C4 — Vite and webpack relay it (Q1 (a)).** `uxdsl/vite` passes it to
  `this.warn` as `src/main.uxdsl:2:9: UXD_PLAIN_IMPORT: …` (relative to
  Vite's root), and `uxdsl/webpack` to `this.emitWarning` (relative to
  `rootContext`), which webpack prints under `Module Warning (from …)`; a
  `vite build` and a webpack build still succeed, and their assets keep
  their bytes. Where `css-loader` then fails (§4 Part 4, `e-supports-sass`),
  it fails as it does on BASE, and the warning was emitted before it.
- **C5 — One catalogued code (Q2 (a)).** `DIAGNOSTIC_CATALOG` gains
  `UXD_PLAIN_IMPORT`, owner `compiler`, with one line of meaning and one of
  fix:
  - meaning: ``An @import that compile()'s CSS keeps as plain CSS names a .uxdsl, .scss or .sass URL (Dart Sass keeps an @import with a media query, supports(), layer() or url(), or of an http://, https:// or // URL), so that file is never compiled: a browser or bundler loads it as written (a warning, at the @import's URL).``
  - fix: ``Load a local file with @use (or @include meta.load-css() under a condition); for a remote stylesheet, link its compiled CSS.``

  Every other entry keeps its text. `test/diagnostics-catalog.test.js` and
  `test/diagnostics-coverage.test.js` pass unedited (the `core` set stays
  the three codes MIG-B9-13 pinned, plus any a story merged before this one
  added).
- **C6 — The CLI counts bytes (Q4 (b)).** `[uxdsl] built <file> (<n> bytes)`
  and its ` + <map> (<n> bytes)` print `Buffer.byteLength` of the text
  written, so `<n>` equals the file's size on disk: §4 Part 3 prints
  `(79 bytes) + a.css.map (144 bytes)`. For ASCII output the line is
  unchanged.
- **C7 — The tarball gate checks it.** `fixtures/release-1.0/run.js` gains
  one check, `B9-38`, `[tarball] the installed CLI warns UXD_PLAIN_IMPORT at the author's file, line and column for a plain @import of a .uxdsl, .scss and .sass URL, and writes the same CSS`,
  whose verdict function is exported and tested in `verdicts.test.js` with a
  negative control (README §3: "Every change a consumer sees").

**Must stay byte-identical:**

- `compile()`'s `css`, `map`, `dependencies` and `themeEmitted` for every
  input, and its `warnings` for every input with no `@import` C2 matches.
- The plugin used alone (`uxdsl/postcss`): its CSS, warnings and messages
  for every input. The step runs in `compile()`'s chain only (§6).
- Every file the CLI writes, its exit status, and its stdout except C6's
  counts for a non-ASCII output; `cli-captures.json` and
  `compiler-captures.json` (their CLI project is ASCII, §7) and the
  `capture-capabilities.js --check` result.
- The assets of every Vite and webpack build; `uxdsl/vite`'s and
  `uxdsl/webpack`'s warnings for every module with no such `@import`
  (the gate's S-5 and S-6 expect exactly their deprecation and one
  `UXD_THEME_MARKER`, decision 4 of 2026-11-13).
- `fixtures/parity/expected/**`, every documentation example's compiled
  output (`npm run verify:doc-examples`), and the playground's `uxdsl.css`.
- Every existing `DIAGNOSTIC_CATALOG` entry.

## 6. Out of scope

- **`uxdsl/postcss` used alone.** It runs no Sass, so a plain `@import` of a
  `.uxdsl` file there is the author's CSS, left as written. The step is not
  added to `plugin.ts` (finding F4: the owner's call).
- **An `@import` with no extension** (`@import 'print' print;`, compile.md's
  own example), which the registration's "a `.uxdsl`, `.scss` or `.sass`
  URL" does not name. Q3 (c) offers it; otherwise finding F3.
- **What the bundlers do with the file** (§4 Part 4: Vite and webpack inline
  it outside UXDSL; a partial's plain `@import` resolved from the module's
  directory). The warning says the file is not compiled; changing the
  bundlers' resolution is not registered (finding F2).
- **The warning lost when `compile()` throws** after Sass succeeded:
  `error.warnings`, MIG-B9-21 (the decision of 2026-11-08 on MIG-B9-14's
  flag 11).
- **A migration note.** `migration.md`'s item 2 already says which imports
  stay plain; a beta.8 → beta.9 note about the new warning belongs to the
  release's migration section, MIG-B9-91 (D13 of 2026-11-04).
- **`AGENTS.md`.** Its Sass paragraph states the import rules the warning
  enforces (`@import "x.css"` stays a CSS `@import`, `@use` inlines a file)
  and sends an agent to `DIAGNOSTIC_CATALOG` for every code; no rule an
  agent follows changes, so it is not edited, which keeps the story off
  §7's `AGENTS.md` row.

## 7. Approach and traps

Non-normative.

- One small PostCSS step in `compile()`'s chain, after `uxdslPlugin` (next
  to `dropAnnotations`), walks `@import` at-rules and calls
  `result.warn(text, { node })`. `relocateWarning` then locates it with no
  new code, and the CLI, Vite and webpack print it with no change of
  theirs. No second parser: the URL is read with `postcss-value-parser`
  (already a dependency) from `node.params`, its first node being a string
  or a `url` function.
- The plugin hoists every `@import` above the theme; the hoisted nodes keep
  their `source` (§4 Part 1, the final map). The theme's generated Google
  Fonts `@import` has no `source` and does not match C2 anyway.
- Deduplicate on the located `file:line:column` and `text`, after
  relocation, not on PostCSS positions: the two copies of a partial's
  `@import` are at different output lines (§4 Part 5).
- `compile.ts` is in the docs guard's `VISUAL_DEFAULT_FILES`
  (`scripts/verify-docs-update.js`), so the commit stages the CHANGELOG;
  `diagnostics.ts` is a not-visual file; no file is added under `src`.
- Q4 (b) is two expressions in `bin/uxdsl.js` (`Buffer.byteLength(finalCss)`,
  `Buffer.byteLength(mapContent)`); `uxdsl-cli.test.js:1426` only matches
  `\(\d+ bytes\)` and stays as it is.
- Cost, indicative only (another workflow was running on the machine, load
  average 4.82): one `walkAtRules('import')` over the playground's
  `uxdsl.css` (332,328 characters, 7,515 nodes) took a median of 0.260 ms
  (maximum 2.099 ms) over 21 runs on `5a041fc`. MIG-B9-23's budget test
  (`test/performance/`) must stay green.
- The test for C4 follows MIG-B9-20's `test/vite/theme-emission.test.js`
  and `test/webpack/theme-emission.test.js`: real builds in a temporary
  directory each test removes (MIG-B9-25).
- **Stop rule.** If any byte-identical item of §5 changes, or the warning
  cannot be located through the Sass stage's map for one of §4's forms,
  stop and record it in §15; the contract is not rewritten.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/core/plain-import-warning.test.js` | `MIG-B9-38: compile() warns UXD_PLAIN_IMPORT at the author's file, line and column for each plain @import of a .uxdsl, .scss or .sass URL, and its CSS does not change` | unit (`uxdsl`) | C1, C2 | the same entry's `.css` `@import`, its inlined `@import "./parts/i.uxdsl"` and the theme's Google Fonts `@import` give no `UXD_PLAIN_IMPORT`; its `css` equals the recorded literal |
| T2 | same | `MIG-B9-38: a plain @import in a partial, nested in @media or in a rule is located where it is written; a partial imported twice warns once` | unit | C1 | a source with only `@use` and `.css` imports has `warnings` equal to BASE's |
| T3 | same | `MIG-B9-38: the URL's path decides, without regard to case, for a quoted, url() and remote URL; .css and an extensionless URL never warn` | unit | C2 | `x.css`, `x.css?v=.scss` and `print` give no warning |
| T4 | `test/cli/plain-import-warning.test.js` | `MIG-B9-38: uxdsl build prints UXD_PLAIN_IMPORT at the author's position, exits 0 and writes the same CSS; build --watch prints it on every rebuild` | CLI | C3 | an entry without such an `@import` prints no `UXD_PLAIN_IMPORT` line |
| T5 | same | `MIG-B9-38: two builds entries loading the same partial print its plain @import once` | CLI | C3 | the line is printed for each distinct position |
| T6 | same | `MIG-B9-38: the CLI's byte counts equal the sizes of the files it writes` | CLI | C6 | the non-ASCII case's count differs from the text's `.length` (so the test fails on BASE) |
| T7 | `test/vite/plain-import-warning.test.js` | `MIG-B9-38: a vite build relays UXD_PLAIN_IMPORT at the author's position and writes the same asset` | Vite | C4 | a module with `@use` relays no `UXD_PLAIN_IMPORT` |
| T8 | `test/webpack/plain-import-warning.test.js` | `MIG-B9-38: a webpack build emits UXD_PLAIN_IMPORT as a module warning and writes the same asset` | webpack | C4 | as T7 |
| T9 | `test/diagnostics-catalog.test.js`, `test/diagnostics-coverage.test.js` (unedited) | as they are | unit | C5 | built in: a code produced and not catalogued, or catalogued and not asserted, fails |
| T10 | `fixtures/release-1.0/verdicts.test.js` | `MIG-B9-38: B9-38 accepts the installed CLI's located UXD_PLAIN_IMPORT lines and rejects an unlocated or missing one (negative control)` | gate verdict | C7 | the verdict throws on stderr without the lines, with a line at another position, and on a changed CSS |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/core/plain-import-warning.test.js` exits 0.
  Test file: `packages/uxdsl/test/core/plain-import-warning.test.js` (T1 to
  T3). Mutation: remove `sass` from the extensions the step
  matches, or drop the step from `compile()`'s chain; T1 fails.
- **AC2** `node --test packages/uxdsl/test/cli/plain-import-warning.test.js` exits 0.
  Test file: `packages/uxdsl/test/cli/plain-import-warning.test.js` (T4 to
  T6). Mutation: restore `finalCss.length` in
  `bin/uxdsl.js`; T6 fails.
- **AC3** `node --test packages/uxdsl/test/vite/plain-import-warning.test.js packages/uxdsl/test/webpack/plain-import-warning.test.js` exits 0.
  Test files: `packages/uxdsl/test/vite/plain-import-warning.test.js` (T7)
  and `packages/uxdsl/test/webpack/plain-import-warning.test.js` (T8).
  Mutations: drop the warnings loop of `vite.ts` line 200; T7 fails. Drop
  the `emitWarning` loop of `webpack.ts` line 228; T8 fails.
- **AC4** `node --test packages/uxdsl/test/diagnostics-catalog.test.js packages/uxdsl/test/diagnostics-coverage.test.js` exits 0.
  Test files: `packages/uxdsl/test/diagnostics-catalog.test.js` and
  `packages/uxdsl/test/diagnostics-coverage.test.js` (T9, unedited).
  Mutation: remove the catalog entry; "every code the sources can produce
  is cataloged" fails.
- **AC5** §4 Part 1 on the head exits 0 and its stderr holds, after the
  `[import]` line, exactly these nine `UXD_PLAIN_IMPORT` lines, in this
  order: `src/parts/_j.uxdsl:2:9`, `src/main.uxdsl:2:9`, `3:9`, `4:9`, `5:9`,
  `6:9`, `7:9`, `8:9` and `13:24`; its `grep` output equals BASE's; and none
  for `./parts/h.css` or `./parts/i.uxdsl`. Test file: none (the
  reproduction of §4). Mutation: as AC1.
- **AC6** `node --test fixtures/release-1.0/verdicts.test.js` exits 0, and
  `npm run verify:1.0 -- --skip-playground-walk` exits 0 with `B9-38`
  passing. Test file: `fixtures/release-1.0/verdicts.test.js` (T10).
  Mutation: have the verdict accept any stderr; T10's negative
  control fails.
- **AC7** `npm test` exits 0, and
  `git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- fixtures/parity/expected packages/playground-nextjs/src/generated packages/playground-nextjs/src/app/uxdsl.css packages/uxdsl/test/diagnostics-catalog.test.js packages/uxdsl/test/diagnostics-coverage.test.js`
  exits 0. Test files: every suite `npm test` runs. Mutation: none; an
  invariant guard (AC1 to AC4's mutations fail it through `npm test`).

Owner checks, never marked PASS by the agent:

- Answer §15's Q1 to Q4 before the story starts. The contract assumes
  Q1 (a), Q2 (a), Q3 (a) and Q4 (b) until then.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes: one subsection under `## 0.5.0-beta.9 — unreleased`, with `### Visual changes`: none. The docs guard demands it (`compile.ts` is in `VISUAL_DEFAULT_FILES`) |
| package README | yes: the docs guard demands it; one sentence (§11) |
| `verify-docs-update.js` classification | no (no file added or deleted under `packages/uxdsl/src`) |
| `npm run generate:language` | no (no completion, grammar or schema change) |
| `AGENTS.md` + agent guide | no (§6) |
| `DIAGNOSTIC_CATALOG` | yes (C5) |
| `npm run generate:capabilities` | no (diagnostics are one capability row, "UXD_* error codes") |
| playground `uxdsl:build` + captures | no change expected: the playground has no such `@import` (§7's search) and the catalog page reads `DIAGNOSTIC_CATALOG` when it builds; `node packages/playground-nextjs/scripts/capture-capabilities.js --check` runs in `npm test` and must exit 0 |
| `migration.md` | no (§6) |

## 11. Documentation

- `packages/uxdsl/docs/integrations/compile.md`:
  - the `warnings` item (lines 89–92): "…, then the plugin's, then one
    `UXD_PLAIN_IMPORT` per plain `@import` of a `.uxdsl`, `.scss` or `.sass`
    URL left in the CSS, …";
  - the "Sass's import rules apply" bullet (lines 364–368): one sentence,
    "When such an `@import` names a `.uxdsl`, `.scss` or `.sass` URL,
    `compile()` warns `UXD_PLAIN_IMPORT` at its URL: that file is not
    compiled." No new example: `scripts/doc-examples.test.js` compiles the
    file and reads no warnings.
- `packages/uxdsl/src/compile.ts`: the `CompileResult.warnings` comment
  (lines 122–125) names the new entries and their place.
- `packages/uxdsl/README.md`: one sentence after "Sass's import rules
  apply: …" (line 1637).
- `packages/uxdsl/CHANGELOG.md`: one subsection, "A plain `@import` of a
  `.uxdsl`, `.scss` or `.sass` URL left in the CSS warns `UXD_PLAIN_IMPORT`
  (MIG-B9-38)", with the CLI's byte count (C6) in the same subsection.
- `cli.md`, `vite.md` and `webpack.md` describe every `compile()` warning
  generically and are not edited.

## 12. Verification

```bash
node --test packages/uxdsl/test/core/plain-import-warning.test.js                                        # exit 0
node --test packages/uxdsl/test/cli/plain-import-warning.test.js                                         # exit 0
node --test packages/uxdsl/test/vite/plain-import-warning.test.js packages/uxdsl/test/webpack/plain-import-warning.test.js   # exit 0
node --test packages/uxdsl/test/diagnostics-catalog.test.js packages/uxdsl/test/diagnostics-coverage.test.js                # exit 0
bash <§4 Part 1>                                                                                          # exit 0, AC5's lines
node --test fixtures/release-1.0/verdicts.test.js                                                         # exit 0
npm test                                                                                                  # background, with a log; exit 0
npm run verify:doc-examples                                                                               # exit 0
npm run verify:1.0 -- --skip-playground-walk                                                              # background, with a log; exit 0
npm run verify:playground-browser                                                                         # background, with a log; exit 0 (Chrome)
```

§4 Part 4 may be re-run on the head from a packed copy: each case then
shows one warning on each host and BASE's CSS.

## 13. Delivery

Delivered by the light flow for an S story (decision D1 of 2026-11-04): a
scout, one implementer, one review and the deliverer.

Branch `feat/b9-38-plain-import-warning`. Commit:
`feat(FEAT-010): MIG-B9-38 - a plain @import of a .uxdsl, .scss or .sass URL left in the CSS warns UXD_PLAIN_IMPORT at its position`.

PR title: `FEAT-010: MIG-B9-38 - a located CLI warning for a plain @import of a .uxdsl, .scss or .sass URL left in the CSS`.
The body:

- **Goal:** §1, in two sentences.
- **Owner answers:** Q1 to Q4 as answered, and what each changed in §5.
- **C1 to C4:** AC5's output next to BASE's, and T1 to T8's results.
- **C5 to C7:** AC4 and AC6, against BASE's SHA.
- **Gates:** `npm test`, `verify:1.0 -- --skip-playground-walk`,
  `verify:playground-browser`, with exit codes.
- **Not run, or not a pass:** anything §14 lists so.
- The last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

Found while writing this story, on `5a041fc`, 2026-11-13. None is fixed
here.

- **F1 — compile.md's "moved before every other rule" is true at the top
  level only.** A plain `@import` Dart Sass leaves inside `@media` or a rule
  stays there (§4 Parts 1 and 5), where a browser ignores it. Proposed: the
  owner's call; the sentence this story adds to the same bullet (§11) can
  state it, or MIG-B9-52.
- **F2 — The bundlers inline a local plain `@import` outside UXDSL.** §4
  Part 4: Vite and webpack ship a `.uxdsl` file's tokens as written, Vite
  compiles `.scss`/`.sass` with its own Sass, webpack inlines `.scss` as
  written and fails on `.sass`, and a partial's plain `@import` resolves
  against the module, not the partial. This story makes each of them a
  warning (Q1 (a)); it does not change the bundlers. Proposed: the owner's
  call; no story.
- **F3 — An extensionless plain `@import`** (`@import 'print' print;`, the
  most likely way to mean a partial and get a plain `@import`) does not
  match the registration's ".uxdsl, .scss or .sass URL". Q3 (c) covers it;
  otherwise the owner's call.
- **F4 — `uxdsl/postcss` alone has no such warning.** A `.uxdsl` `@import`
  in a stylesheet the plugin compiles is left as written, silently.
  Proposed: the owner's call.
- **F5 — MIG-B9-37 shares `bin/uxdsl.js` beyond §7's row.** Its story file
  (recorded on `5a041fc`, not yet merged into the index) lists
  `bin/uxdsl.js` in Shares and says "Under §7, MIG-B9-38 waits for it
  (`diagnostics.ts`, `bin/uxdsl.js`)"; §7's row for `bin/uxdsl.js` lists
  14, 20, 22, 38, 39, 60, 61 and 63. This story's header follows the story
  file. Proposed: the index adds 37 to that row (done in the PR that adds
  this file).
- **F6 — MIG-B9-17 and the `core` pin.** MIG-B9-17's Q4 (a) adds
  `UXD_MODULE_ISOLATION` with owner `core`, and its T11 keeps
  `test/diagnostics-catalog.test.js` unedited, but that file's lines 94–100
  pin `core` to exactly three codes. Under Q2 (a) this story does not touch
  that test; under Q2 (b) it would share it with MIG-B9-17. Proposed:
  MIG-B9-17's scout.

### Open questions for the owner (answer before implementing)

Under the owner's standing instruction of 2026-11-10 (FEAT-010 §2, the
lead-in to decisions 33 to 37), each question below is answered with its
recommended option unless the owner overrides it. The contract assumes the
recommended option of every question, so answering as recommended changes
nothing in this file. Q1's recommendation, (a), goes beyond the registered
title's word "CLI": the title stays as registered until the owner answers,
and an answer of (a) may retitle the story ("A located warning for …").

1. **Q1 — Which hosts print it.** The registration says "A located CLI
   warning" and names no other host; MIG-B9-13's flag 14 was about "a CLI
   build". It does not say that only the CLI reports it. "Located" in this
   codebase is a position that `compile()` maps through the Sass stage's
   map (§2); only `compile.ts` has that map, and every host prints every
   `compile()` warning since MIG-B9-14 (its flag 7, accepted).
   - (a) `compile()` reports it in `warnings`: the CLI, `build --watch`,
     `uxdsl/vite`, `uxdsl/webpack` and any direct caller print it, located,
     with no code in the CLI or the adapters. Vite's and webpack's builds
     gain a warning they did not have (§4 Part 4 shows they also ship the
     file uncompiled). Owns gains the Vite and webpack tests (T7, T8).
   - (b) Only the CLI: `compile()` reports it only when the CLI asks, through
     a new `CompileConfig` option, a public API addition the registration
     does not name either; or the adapters drop the code. Vite and webpack
     stay silent; T7 and T8 assert that they do.

   Recommendation: (a). It is the smaller change, it keeps one pipeline, and
   the bundlers' case is as silent as the CLI's. It goes beyond the title's
   word "CLI", which the owner decides. The contract assumes (a).
2. **Q2 — The code.** The registration says "one new catalogued code" and
   names none.
   - (a) `UXD_PLAIN_IMPORT`, owner `compiler`, as `UXD_THEME_MARKER`, the
     other build-level warning `compile.ts` produces. The catalog tests stay
     unedited.
   - (b) The same name, owner `core` (`compile()`'s, next to the Sass
     codes): `test/diagnostics-catalog.test.js`'s `core` pin (lines 94–100)
     changes, a file MIG-B9-17 may change too (F6).
   - (c) Another name: `UXD_IMPORT_PLAIN`, `UXD_SASS_PLAIN_IMPORT`.

   Recommendation: (a). The contract assumes (a).
3. **Q3 — Which URLs.**
   - (a) The URL's path (before `?` or `#`) ends with `.uxdsl`, `.scss` or
     `.sass`, compared without regard to case, for every scheme, at any
     depth (C2).
   - (b) The whole URL ends with one of the three, case-sensitively: `x.SCSS`,
     `x.scss?v=1` and `x.uxdsl#a` do not warn.
   - (c) As (a), and also a URL with no extension that names a file Dart Sass
     would have loaded (`@import 'print' print;` beside a `_print.uxdsl`),
     found with Dart Sass's own resolution. Wider than the registration's
     words, and more code (F3).

   Recommendation: (a). It reads "a `.uxdsl`, `.scss` or `.sass` URL" as a
   URL means it, with no file-system lookup. The contract assumes (a).
4. **Q4 — The byte count.** The proposal the decision registered "as
   proposed" says "The byte count of `[uxdsl] built … (<n> bytes)` (fact 4)
   can ride along": a choice, not an instruction.
   - (a) Not in this story. Under Q1 (a) this story then edits no line of
     `bin/uxdsl.js`, leaves §7's `bin/uxdsl.js` row, and fact 4 waits for
     another story.
   - (b) It rides along (C6, T6): two expressions in `bin/uxdsl.js`, the
     CHANGELOG subsection, §4 Part 3 as its baseline. The captures do not
     change (their CLI project is ASCII); the playground's own build, whose
     `uxdsl.css` has two lines with non-ASCII text, would print a different
     count, which nothing reads.

   Recommendation: (b): a two-line fix of a recorded defect in a file this
   story is already serialized on. The contract assumes (b).
