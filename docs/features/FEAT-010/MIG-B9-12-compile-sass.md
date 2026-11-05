# MIG-B9-12 — `src/sass/compile-sass.ts`: Dart Sass with the `.uxdsl` importer

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 1 |
| Decision gate | DEC-01 (decided); DEC-04 (decided 2026-10-23: `sass` is a regular dependency, loaded lazily) |
| Status | Merged (PR #62) |
| Size | M |
| Depends on | MIG-B9-11 |
| Blocks | MIG-B9-13 |
| Base | `feat/beta9` after MIG-B9-11 |
| Owns | `packages/uxdsl/src/sass/compile-sass.ts` (new), `packages/uxdsl/test/core/compile-sass.test.js` (new) |
| Shares | `packages/uxdsl/package.json` (`dependencies.sass`), `packages/uxdsl/src/diagnostics.ts` (four codes), `scripts/verify-docs-update.js`, `packages/uxdsl/CHANGELOG.md` |
| Output impact | none until MIG-B9-13 (this module is not yet called by `compile()`) |

## 1. Goal

One function compiles a `.uxdsl` entry with Dart Sass: it resolves `.uxdsl`
files next to `.scss`, `.sass` and `.css` with Sass's own rules, protects
UXDSL's syntax on the way in, turns Sass's errors and warnings into located
UXDSL diagnostics, and returns a source map whose positions point at the
author's files.

## 2. Sources

- Verified with Dart Sass 1.94.2 (2026-10-09):
  - a `FileImporter` cannot serve a `.uxdsl` file (Sass accepts only
    `.scss`/`.sass`/`.css` from `findFileUrl`); a full `Importer`
    (`canonicalize` + `load` returning `{ contents, syntax }`) can;
  - with such an importer, `@use "./button"` loads `button.uxdsl`,
    `@use "./partial"` loads `_partial.uxdsl`, `@use "./dir-index"` loads
    `dir-index/_index.uxdsl`, `@use "./sub/deep"` loads `sub/_deep.uxdsl`,
    `@import "partial"` works with the `import` deprecation warning;
  - `@use "./plain"` inlines `plain.css`; `@import "plain.css"` (with the
    extension) stays `@import "plain.css";` in the output;
  - `pkg:` URLs resolve through `NodePackageImporter` for `.scss`/`.css`
    packages; a package whose `exports` points at a `.uxdsl` file is rejected
    by Sass ("not a '.scss', '.sass', or '.css' file"); a bare path such as
    `fake-ds/scss/index` resolves when `node_modules` is in `loadPaths`; the
    legacy `~` prefix does not resolve;
  - errors are `sass.Exception` with `sassMessage`, `span.url`,
    `span.start.line`/`column` (0-based), `sassStack`, and a `message` that
    contains the formatted code frame;
  - the logger receives `warn(message, { deprecation, deprecationType, span, stack })`;
    deprecation ids include `import` (deprecated in 1.80.0, removed in 3.0.0),
    `global-builtin`, `color-functions`, `slash-div`, `mixed-decls` (obsolete
    since 1.92.0); `silenceDeprecations` removes a type; without `verbose`
    Sass caps repeated deprecations at five per type and adds a summary line;
  - `sass` 1.105.1 on npm: ~6 MB unpacked, dependencies `chokidar ^5`,
    `immutable ^5`, `source-map-js`.
- Source maps (prototype `uxsass.js`, `e5-maps.js`): Sass's map, with columns
  translated back through `toOriginalColumn` and the original text as
  `sourcesContent`, handed to PostCSS as `map.prev`, makes a plugin error on
  `heavy.uxdsl` report line 18; PostCSS reports the column one less than the
  author's (`65` for `66`) because it treats the map's 0-based column as
  1-based. A Sass error's own column translates exactly (`48`).

## 3. Preconditions

```bash
test -f packages/uxdsl/src/sass/protect.ts
test -f packages/uxdsl/test/core/sass-pipeline.test.js
test ! -f packages/uxdsl/src/sass/compile-sass.ts
node -p "require('./packages/uxdsl/package.json').devDependencies.sass"
```

## 4. Baseline

None (new module). The todo tests of MIG-B9-10 in `sass-pipeline.test.js`
describe the behaviors.

## 5. Contract

### 5.1 Exports

```ts
// packages/uxdsl/src/sass/compile-sass.ts
export interface SassStageInput { entry: string; source?: string }   // entry: absolute path; source: in-memory text when given
export interface SassStageOptions {
  reserved: Iterable<string>;              // breakpoint names of the effective theme (for UXD_RESERVED_NAME)
  sourceMap: boolean;
  loadPaths?: string[];                    // default: every node_modules from dirname(entry) up to the root
  sass?: { silenceDeprecations?: string[]; quietDeps?: boolean };
}
export interface SassStageResult {
  css: string;
  map?: RawSourceMap;                      // columns translated; sources absolute paths; sourcesContent = original text
  loadedFiles: string[];                   // absolute paths, entry first, then in Sass's load order, deduplicated
  warnings: CompileWarning[];              // { text, file, line, column }, text starts with 'UXD_SASS_WARNING: '
}
export function compileSassStage(input: SassStageInput, options: SassStageOptions): SassStageResult;   // synchronous
```

### 5.2 The importer (IM)

- **IM1** Resolution follows Sass (`resolveImportPath`): an explicit known
  extension (`.uxdsl`, `.scss`, `.sass`, `.css`) is tried as written and as a
  partial (`_name.ext`); without one, `.uxdsl`, `.scss`, `.sass` (partials
  first) then `.css`; then `name/_index.*` and `name/index.*`; for `@import`,
  the `.import` variants first.
- **IM2** More than one candidate in one directory for one URL (`thing.uxdsl`
  and `thing.scss`) is an error, in Sass's words ("It's not clear which file
  to import"), surfaced as `UXD_SASS` at the `@use`.
- **IM3** The importer is both the `importer` option (relative loads from the
  entry or an in-memory source) and the first of `importers`, followed by
  `new NodePackageImporter(dirname(entry))` so `pkg:` works for `.scss`/`.css`
  packages. `sass:` and other schemes are left to Sass.
- **IM4** `load()` returns `{ contents: protect(text).code, syntax: 'scss' }`
  for `.uxdsl`; `.scss` as `scss`, `.sass` as `indented`, `.css` as `css`
  without protection. A protect problem (`UXD_RESERVED_NAME`) is thrown from
  `load()` as the located UXDSL error (file, line, column from the problem),
  and `compileSassStage` rethrows it instead of Sass's wrapper.
- **IM5** `loadPaths` defaults to every `node_modules` directory from the
  entry's directory up to the filesystem root, so `@use "pkg/scss/index"`
  resolves like Node would. `~pkg/…` is not supported; Sass's own "Can't find
  stylesheet" is the error (documented in MIG-B9-15).
- **IM6** `loadedFiles` is `result.loadedUrls` as paths, with the entry
  first.

### 5.3 Errors (E)

- **E1** A `sass.Exception` becomes an `Error` whose message is
  `<file>:<line>:<column>: UXD_SASS: <sassMessage>`, with `file` from
  `span.url`, `line = span.start.line + 1`, `column = toOriginalColumn(…) + 1`
  for a `.uxdsl` file (unchanged for `.scss`), `code = 'UXD_SASS'`,
  `sassFrame = exception.message` (Sass's formatted message with the code
  frame and stack) and `cause = exception`.
- **E2** A protect problem is thrown as `<file>:<line>:<column>: UXD_RESERVED_NAME: …`.
- **E3** Any other error (I/O) is rethrown unchanged.

### 5.4 Warnings (W)

- **W1** Every `logger.warn` call becomes a `CompileWarning` whose text is
  `UXD_SASS_WARNING: [<deprecationType.id>] <first line of message>` for a
  deprecation, `UXD_SASS_WARNING: <first line>` for `@warn`; `file`, `line`,
  `column` from `span` (column translated), when Sass gives one.
- **W2** `verbose` is `false`: Sass's own cap (five per deprecation type plus
  a summary) applies, so Bootstrap's 247 deprecations arrive as about 16
  lines.
- **W3** `options.sass.silenceDeprecations` is passed through; `quietDeps`
  too (it silences dependencies loaded through `loadPaths`/`pkg:`).
- **W4** `logger.debug` is dropped.

### 5.5 Source maps (M)

- **M1** With `sourceMap: true`, Sass runs with
  `sourceMap: true, sourceMapIncludeSources: true`; the returned map has every
  mapping's original column translated through the file's `toOriginalColumn`,
  `sources` as absolute paths (no `file:` URLs), and `sourcesContent` set to
  the **original** text of each `.uxdsl` file (the protected text never
  appears).
- **M2** With `sourceMap: false`, no map is produced and Sass runs without
  one (faster).
- **M3** `css` never carries a `sourceMappingURL` comment.

### 5.6 Dependency (D)

- **D1** `sass` moves from `devDependencies` to `dependencies` at the current
  1.x (DEC-04); `npm audit` on a fresh install stays at 0 (`sass`'s own
  dependencies are checked; its `chokidar ^5` coexists with UXDSL's `^4`).
- **D2** The tarball budget (300 KB) is unaffected: `sass` is a dependency,
  not bundled.

### 5.7 Catalog

`DIAGNOSTIC_CATALOG` gains `UXD_SASS` (error: Sass could not compile the
file; fix: read Sass's message below the location), `UXD_SASS_WARNING`
(warning: Sass warned, a deprecation or `@warn`; fix: follow Sass's
suggestion or silence the deprecation type in the `sass` option),
`UXD_RESERVED_NAME` (error: a project `@function` would shadow a UXDSL
function or breakpoint; fix: rename it). Owner `core`. (MIG-B9-13 adds
`UXD_SASS_CONTEXT`.) Each is asserted by a test in this story.

Must stay byte-identical: everything compiled today (this module is not yet
wired).

## 6. Out of scope

- Wiring into `compile()`: MIG-B9-13.
- The off-by-one of PostCSS's prev-map column: corrected in `compile()`
  (MIG-B9-13), because it is PostCSS's reporting, not the map.
- `sass-embedded`: not used; it needs a platform binary and gains little
  below a few thousand rules.

## 7. Approach and traps

- Keep one `Map<fileUrl, { original, toOriginalColumn }>` per compilation;
  `canonicalize` must not read files (only `stat`), `load` reads once.
- `compileString` with `url: pathToFileURL(entry)` resolves relative loads
  through the `importer` option; a `source` whose `entry` does not exist on
  disk works because the importer resolves from the URL's directory
  (`compile({ source, from })` in the webpack loader depends on it).
- Sass's `fs-importer-cwd` deprecation fires only when the cwd is used
  implicitly; explicit `loadPaths` avoid it.
- A `@use` loop is reported by Sass as a module loop error; `@import` loops
  as "already being loaded". Both are `UXD_SASS`.
- The ambiguity rule (IM2) must look only in the directory of the candidate,
  as Sass does; a `.uxdsl` in `./` and a `.scss` in a `loadPaths` entry are
  not ambiguous (the first importer wins).
- Stop rule: if Sass's API lacks something the contract needs on the resolved
  version (for example `NodePackageImporter`, added in 1.71), raise the
  minimum version in `package.json` and record it; never emulate the feature.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/core/compile-sass.test.js` | `MIG-B9-12: the importer resolves .uxdsl, _partial.uxdsl, dir/_index.uxdsl, sub/_deep.uxdsl, .scss, .sass and .css next to each other` | unit | IM1 | `thing.uxdsl` + `thing.scss` in one directory → UXD_SASS naming the ambiguity |
| T2 | same | `MIG-B9-12: @import of a .uxdsl loads and warns UXD_SASS_WARNING [import]; @import "x.css" stays a CSS import; @use "./x" inlines x.css` | unit | IM1, W1 | — |
| T3 | same | `MIG-B9-12: pkg: resolves a package's scss and css; a bare package path resolves through node_modules; a .uxdsl export is UXD_SASS with Sass's reason` | unit | IM3, IM5 | — |
| T4 | same | `MIG-B9-12: a Sass error is UXD_SASS at the author's file, line and translated column, with sassFrame and cause` (E1–E4 shapes: syntax error, error in a @use'd mixin, @error, undefined variable) | unit | E1 | — |
| T5 | same | `MIG-B9-12: @function space in a loaded partial is UXD_RESERVED_NAME at that file's line and column` | unit | E2, IM4 | `@mixin border` loads fine |
| T6 | same | `MIG-B9-12: deprecation warnings are located, capped by Sass, and silenceDeprecations removes a type; @warn is reported; debug is dropped` | unit | W1–W4 | — |
| T7 | same | `MIG-B9-12: the map's original columns are translated, sources are absolute paths, sourcesContent is the original text` (queried with `source-map-js` on `heavy.uxdsl`: the `inset` mapping points at line 18 column 65 0-based) | unit | M1 | `sourceMap: false` → no map |
| T8 | same | `MIG-B9-12: loadedFiles lists the entry first and every loaded file once` | unit | IM6 | — |
| T9 | same | `MIG-B9-12: an in-memory source whose entry path does not exist resolves its relative @use` | unit | IM3 | — |
| T10 | `test/diagnostics-catalog.test.js` | existing: the three codes are catalogued and asserted | unit | §5.7 | — |
| T11 | `fixtures/release-1.0/run.js` `I-1`, `AUDIT` | one package installs with its peers; audit 0 with `sass` | tarball | D1 | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/core/compile-sass.test.js` exits 0.
- **AC2** `node --test packages/uxdsl/test/diagnostics-catalog.test.js` exits 0
  with the three new codes.
- **AC3** `node -p "require('./packages/uxdsl/package.json').dependencies.sass"`
  prints a `^1.x` range; `cd packages/uxdsl && npm audit` prints 0
  vulnerabilities.
- **AC4** `src/sass/compile-sass.ts` is classified as a visual-default file in
  `scripts/verify-docs-update.js`; `node --test scripts/verify-docs-update.test.js`
  exits 0.
- **AC5** `node fixtures/parity/run.js` exits 0 without `--update` (nothing
  wired yet).
- **AC6** `npm test` exits 0; `npm run verify:1.0 -- --skip-playground-walk`
  exits 0 (`I-1`, `AUDIT` with `sass` installed).

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:language` | yes (the catalog) |
| CHANGELOG | yes (`### Dependencies`: `sass`; `### Diagnostics`: the codes) |
| package README | yes ("Install": `sass` arrives with `uxdsl`) |
| `verify-docs-update.js` classification | yes |
| `DIAGNOSTIC_CATALOG` | yes (three codes) |
| playground captures | yes (`/docs/diagnostics`) |

## 11. Documentation

`packages/uxdsl/CHANGELOG.md`, `packages/uxdsl/README.md` ("Install"). The
Sass section of the docs is MIG-B9-15.

## 12. Verification

```bash
node --test packages/uxdsl/test/core/compile-sass.test.js    # exit 0
node --test packages/uxdsl/test/diagnostics-catalog.test.js  # exit 0
(cd packages/uxdsl && npm audit)                              # 0 vulnerabilities
node fixtures/parity/run.js                                   # exit 0
npm test                                                      # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                  # background; exit 0
```

## 13. Delivery

Branch `feat/b9-12-compile-sass`. Commit:
`feat(FEAT-010): MIG-B9-12 - src/sass/compile-sass.ts: Dart Sass with the .uxdsl importer, located errors, warnings, translated source maps`.

## 14. Closure record

Delivered in one PR (#62), from `feat/b9-12-compile-sass`. The §15 blocks are applied where they rule: the review of 2026-10-11, and the owner decisions of 2026-10-23 (DEC-04, DEC-17). The work follows a design record written before the code (2026-10-30: decisions Q1–Q12, 16 owner flags, 13 stop conditions). That record stays with the run's evidence outside the repository; the decisions that change §5 are summarized below.

- **Base:** `feat/beta9` at `b864194` (MIG-B9-11 merged, PR #49). `origin/feat/beta9` had not moved at delivery, so there was no rebase (stop condition 13 did not apply). The head before this record is `ec245cf`, 24 commits:
  - `e6eab11`: the failing tests;
  - `9fe6364`: the module;
  - `f81c53a`: documentation;
  - `5e168dc` … `ec245cf`: 21 fix, test and documentation commits from the review.
- **Environment:**
  - macOS (Darwin 27.0.0, Apple Silicon); Node 20.19.0 and npm 11.21.1, the CI versions (never the machine's default Node 20.14 or npm 10.7);
  - `sass` 1.107.0 (Dart Sass, the package's own copy; the playground keeps its own 1.94.2);
  - Google Chrome 156 at the macOS default path.

  The worktree was prepared as `ci.yml` does (README §1.3), and every step exited 0 (`fixtures/mig07-consumer/run.js`: `All checks passed.`). `npm run prepare` created husky's `.husky/_`, so the pre-commit hook (the docs guard and the playground build) ran on every commit. No commit used `--no-verify` or `HUSKY=0`.
- **Preconditions (§3):** the four lines exit 0 on the base, as written; `devDependencies.sass` printed `^1.107.0`.
- **Baseline (§4):** none (new module).
- **Failing test first:**
  - `e6eab11` (the tests and protect's `site` option) was pushed before any implementation. On the base, `compile-sass.test.js` gives `tests 33, pass 2, fail 31`: every stage test fails with `Cannot find module …/dist/sass/compile-sass.js`. The two that pass are oracle-side controls that never call the stage: T12's planted eager-`sass` module, and T16's scan of the raw `.sass` text.
  - On the same base, `protect.test.js` gives 78 tests: 75 pass, 2 fail and 1 is skipped (the corpus). The two failures are the new `site` tests, because `protect()` ignored the option.
  - After `9fe6364`: 33/33, and protect 78/78 with the corpus.
  - Every fix in the review was written test first. Each test failed on the build before the fix, as recorded per finding below.
- **Contract as delivered, where it differs from §5:**
  - **DEC-17 replaces E2, T5 and part of §5.7.** Nothing produces `UXD_RESERVED_NAME`: it is not catalogued, never thrown, and absent from `src`. `options.reserved` is the set of breakpoint names a project `@function` is checked against, together with the token functions and `tone`. `@function space` in a loaded partial gives Dart Sass's output and one `UXD_FUNCTION_SHADOWED` at that file's line and column (tests 16 and 17). A `@mixin border` and a helper reached only through a namespace give nothing.
  - **Q2: the DEC-17 mechanism is a per-call-site probe, not MIG-B9-11 §15's per-build recipe.**

    The recipe scans every loaded file, unprotects those names for the whole build and compiles again. The scout's prototype of it (scout `e15`/`e20`, Dart Sass 1.107.0) breaks DEC-17:
    - T-c: a helper reached only through a namespaced `@use "helpers"` still warns.
    - C-1: a namespaced `color` helper plus `color(white)` in the entry throws `$description: white is not a string.`.
    - C-2: a function private to `_a.uxdsl` silently turns `_b.uxdsl`'s `space(10-2)` into `space(8)`.
    - When pass 1 throws, Sass exposes no public `loadedUrls`, so pass 2 never runs.

    Scored against Dart Sass on 20 cases, the recipe gets 8/20, per-file unprotection 17/20 (a silent `space(8)` depending on call order) and the per-site probe 20/20; the synthesis passed 33/33.

    As delivered:
    - Pass 1 uses protect's default rule.
    - When a loaded file defines a function named like a token function, `tone` or a breakpoint, a silent probe compile asks Sass at each candidate call written in a `.uxdsl` file whether the bare name means a project function there. It does this through a host function and `function-exists`/`get-function`, recording per evaluation.
    - A call that is always the project function is left as written; one that never is keeps the token. A call seen both ways is written as `uxdsl-probe-pick(if(sass(uxdsl-probe-replay("<site>")): <call>; else: <token>))`, replaying the probe's records in order.
    - A build with no such definition runs Dart Sass once. The exception is a build whose first compile fails while a served file contains `pkg:` (RR-3).

    The fix pass changed the record's form in four places:
    - A call Sass never evaluates keeps the token (LOC-1, `702c34f`). The record's stop condition 6 was not taken; see owner flag 21.
    - `pkg:` helpers are probed when pass 1 fails (SH-2, `2aea2d1`).
    - Attribution is per definition, by a capture inserted after each definition's body (SH-1, `b17ff28`; protect's `bodies` option).
    - The final pass no longer writes a `sass:meta` dispatch; it replays (RR-1, `4eb7d3b`). This replaces design note 9.7. The probe again reads visibility with the global meta functions (note 9.5). It reads through `sass:meta` under the `uxdsl-probe-meta` namespace only in a build that defines `function-exists` or `get-function` (LOC-6), and never gives a file Sass `@import`s a `@use` (RR-1, `4eb7d3b` and `ec245cf`).

    Do not carry over fixer B's statement in `702c34f` that "the probe reads visibility through `sass:meta`".
  - **Q1: `sourceMap` is kept as §5.1 and M2 write it.** The review's blocking item ("always run Sass with a map") is honored by the caller:
    - The stage locates errors, warnings and `UXD_FUNCTION_SHADOWED` from Sass's spans and stack frames through protect's column map, never from a map. T7's mapping of `heavy.uxdsl`'s `inset` is 18:65 (0-based), which PostCSS 8.5.31 reports as `heavy.uxdsl:18:66` through `map.prev`.
    - MIG-B9-13 passes `sourceMap: true` on every build and emits the final map only on request.
    - MIG-B9-13 locates plugin errors with `originalPositionFor` on the stage map, not a fixed +1. PostCSS 8.5.16+ reports the prev-map column exactly, while 8.4.49 to 8.5.15 report it one less, and the `^8.4.31` peer range allows those.

    Tests 41 and 42 pin how Sass is called: `sourceMap` and `sourceMapIncludeSources` with a map, neither without one, including in probe compiles (F6).
  - **Review item 2 (Q3).** `sassFrame` is Sass's own frame and stack without the leading `sassMessage` line (MIG-B9-14 A1 prints the message itself). It is produced with `alertColor: false` and `alertAscii: false`, and redrawn line by line with the author's text:
    - markers are moved through the column map;
    - multi-line connectors of any width are kept (LOC-2), and so are CRLF lines covered by a multi-line span (RR-2);
    - an end marker sits under the span's last character (`8bdb066`).

    A position inside a rewrite is reported at the token's start (MIG-B9-11 R6; LOC-3 refuted).
  - **Review item 3 and IM5 (Q4).** The importer owns the load paths and Dart Sass receives none, so a package can ship `.uxdsl` partials that a bare path (`kit/tokens`) reaches.
    - A URL with no scheme is tried relative to the importing file, then under `options.loadPaths` (default: every `node_modules` from the entry's directory up), then under each directory of `SASS_PATH` (RES-3, `0f4b6ac`).
    - Each candidate is joined to its load path as Dart Sass joins one, unnormalized, with the load path itself kept as written (RES-1 `5e168dc`, RR-4 `8cd40e5`). A `../x` that misses beside its file is therefore Sass's `Can't find stylesheet to import.`, never a same-named file elsewhere. This corrects the record's formula `fileURLToPath(new URL(url, pathToFileURL(B + path.sep)))`, which was lexical; IM1's "follows Sass" is unchanged.
    - `pkg:` stays `NodePackageImporter`'s, so a `.uxdsl` export is Sass's error (T3); `~pkg/…` is Sass's `Can't find stylesheet to import.`.
    - **Recorded difference (RES-2, owner flag 17).** Inside a package that `pkg:` loaded, `NodePackageImporter` is the base importer. Sass's own `.sass`/`.scss`/`.css` candidates, or a directory index, therefore answer a relative URL before a `.uxdsl` partial, and `_x.uxdsl` beside `_x.scss` is not ambiguous. Tests 9 and 10 pin this against the twin.
  - **IM1's wording.** Dart Sass orders candidates by extension group (`.sass`, `.scss`, then `.uxdsl`, a partial first within each). `_x` and `x` are co-candidates, so two matches are Sass's `It's not clear which file to import`; "partials first" is not a precedence. The binding phrase "follows Sass" holds; a twin differential checks it (tests 1 and 2).
  - **IM4 and Q9.** A `.css` file is plain CSS, served as written. A `$variable` or `palette(primary.main)` in it is `UXD_SASS` at the token, as in Dart Sass (tests 5 and 6).
  - **DEC-04 and D1.** `sass` `^1.107.0` is in `dependencies` and is required only inside `compileSassStage`. Tests 47 and 48 check this in fresh `node -e` children: `require('uxdsl/postcss')`, `require('uxdsl')` and requiring the stage module each leave `sass` out of `require.cache`. An encoded eager-`require` control shows the check can fail.

    `source-map-js` also moves to `dependencies` (Q10). It is pinned at `^1.2.2`, not the record's `^1.2.1`: the repository's AUDIT-lock control shows 1.2.1 has a high advisory, and `postcss` already requires `^1.2.2`, so no consumer installs a new package. `test/entries.test.js`, which pins the hard-dependency list, is updated.
  - **E3 (Q7) is literal.** An I/O error reading a loaded file, or a missing entry without `source`, is rethrown unchanged (test 51). A file missing at resolution is Sass's `Can't find stylesheet to import.` at the `@use` (test 52).
  - **W1 is wider than §5.7's "a deprecation or `@warn`".** Sass's unlocated notices about an unknown, obsolete or user-authored `silenceDeprecations` id are `UXD_SASS_WARNING` too, and the catalog meaning says so (GH-4, `0c448c5`).
  - **The catalog (Q5).** `UXD_SASS` and `UXD_SASS_WARNING` are added with owner `core`, for 111 codes: theme 59, compiler 40, runtime 6, core 6. `UXD_FUNCTION_SHADOWED` stays `compiler`; MIG-B9-13 moves it. AC2's "three new codes" are two under DEC-17.
  - **Recorded differences from the twin** (test pairs, owner decisions):
    - SH-4: a function reached under a UXDSL name only through `@forward … as <prefix>*` is not found (tests 23 and 24, `a5dfdac`).
    - RR-1 residual: in a build that also defines `get-function` or `function-exists`, some `@import`ed files ask the project's function (tests 29 and 30).
  - **Shares as delivered.** Files touched outside the header's Owns and Shares:
    - `packages/uxdsl/src/sass/protect.ts`: the additive `site` and `bodies` options. Without them the output, the column map and the problems are unchanged, and the 63 cases and MIG-B9-11's tests pass as before.
    - `packages/uxdsl/test/core/protect.test.js`: 4 tests.
    - `packages/uxdsl/test/entries.test.js`.
    - `scripts/verify-docs-update.test.js`: AC4's pin.
    - `fixtures/sass-corpus/README.md`: "devDependency" became "dependency".
    - `packages/uxdsl/README.md`: the docs guard asks for it.
    - `packages/uxdsl/package-lock.json`: synced with `npm install` on Node 20.19 and npm 11; the two ranges moved and `"dev": true` was dropped from `sass`'s subtree.
- **Exports as implemented** (`packages/uxdsl/src/sass/compile-sass.ts`; no public entry until MIG-B9-13):
  - `compileSassStage(input: SassStageInput, options: SassStageOptions): SassStageResult`, synchronous. Invalid input (a relative `entry`, a `source` that is not a string, a missing `reserved`) is a `TypeError` thrown before Sass runs (test 57).
  - `SassStageInput { entry; source? }`.
  - `SassStageOptions { reserved; sourceMap; loadPaths?; sass?: { silenceDeprecations?; quietDeps? } }`.
  - `SassStageResult { css; map?; loadedFiles; warnings }`.
  - `SassStageError { code: 'UXD_SASS'; file?; line?; column?; sassMessage; sassFrame; cause }`.
  - In `protect.ts`: `ProtectCall`, `ProtectOptions.site`, `ProtectOptions.bodies`, `ProtectProblem.end`.
  - The prefix `uxdsl-probe-` is reserved for the probe's host functions and namespace.
- **Criterion → test** (the numbers are the TAP numbers of `compile-sass.test.js`):

  | Criterion or §8 test | Evidence |
  | --- | --- |
  | AC1 | `compile-sass.test.js`, 57/57 |
  | T1 | tests 1–2 |
  | T2 | tests 3–4 |
  | T3 | tests 7–8, with 9–13: the `pkg:` order, `..` under load paths, `SASS_PATH` |
  | T4 | tests 14–15 |
  | T5 (as DEC-17 words it) | tests 16–17 |
  | T6 | tests 37–38 |
  | T7 | tests 39–42 |
  | T8 | test 43 |
  | T9 | tests 44–45 |
  | T10 | test 46 and `test/diagnostics-catalog.test.js` |
  | T11 | `verify:1.0` `I-1`, `AUDIT` and `AUDIT-lock` |
  | The design's T5b (per call site) | tests 18–34 |
  | T5c (one compile) | tests 35–36 |
  | T12 (DEC-04) | tests 47–48 |
  | T13 (read as Sass) | tests 49–50 |
  | T14 (E3) | tests 51–52 |
  | T16 (indented comments) | tests 53–54 |
  | T17 (no state) | tests 55–56 |
  | IM4 | tests 5–6 |
  | T15 | `protect.test.js` tests 76–79 |
  | AC2 | `diagnostics-catalog.test.js`, 7/7 |
  | AC3 | `dependencies.sass` prints `^1.107.0`; `npm audit` in `packages/uxdsl` prints `found 0 vulnerabilities` |
  | AC4 | `VISUAL_DEFAULT_FILES` holds `src/sass/compile-sass.ts`; `verify-docs-update.test.js`, 16/16 (its new test fails when the file moves to `NON_VISUAL_SOURCE_FILES`) |
  | AC5 | `fixtures/parity/run.js` without `--update`, PASS |
  | AC6 | `npm test` exit 0; `verify:1.0` exit 0 (see the commands) |

- **The review, the session-limit cut, and how the unverified findings were verified.**
  - **First run, 2026-10-30, 12:13–16:33.** It ran a scout, three independent designs and a synthesis (the design record), the implementation (`e6eab11`, `9fe6364`, `f81c53a`) and five review lenses (contract, resolution, locations, shadowing, guards and honesty). The lenses raised 27 findings, and every finding that was not a nit went to two independent skeptics:
    - 6 confirmed by both skeptics: F1, RES-1, RES-2, RES-3, LOC-1, LOC-2.
    - 10 left unverified, because their skeptics were cut by the plan's session limit: F4, F5, F6, SH-1–SH-5, GH-1, GH-2.
    - 3 refuted by both skeptics: F2, F3, LOC-3.
    - 8 nits: RES-4, RES-5, RES-6, LOC-4, LOC-5, LOC-6, GH-3, GH-4.

    The same limit cut the fix and delivery steps.
  - **This run (fix commits from 2026-10-30 22:49 to 2026-11-01 01:05).** Four area fixers reproduced every finding with a failing test before fixing it. That reproduction is how the ten unverified findings were verified: each was found real (behavior or coverage). Next, an adversarial re-review mutation-checked each fix (22 mutants: every applied fix and test-only guard has a test that fails without it) and raised four findings. A second fixer then handled those, and its own changes were mutation-checked with 15 mutants.

    Outcomes:
    - **F1 and RES-1** (a load path that does not exist resolved `../x` lexically). The fix is `5e168dc`. Before it, the new test failed on its first case: `Dart Sass fails on the twin (Can't find stylesheet to import.); the stage compiled`. 6 of 9 layouts differed; after the fix, 9 are the same.

      T9's control is back to its designed form (the default load paths) with a Dart Sass oracle. The implementer's deviation note, "with the default node_modules load paths, `../../part` … resolves … exactly as Dart Sass resolves it", is false: Dart Sass stats the unnormalized `<lp>/../../_part.*`. That note is not carried over.
    - **RES-3** (`SASS_PATH`). The fix is `0f4b6ac`. Before it: `SASS_PATH=env: the stage failed: … UXD_SASS: Can't find stylesheet to import.`, and 7 of 8 cases differed. After it, all 8 are the same.
    - **RES-2** (inside `pkg:`). Documented and pinned (`1697112`). The behavior cannot change inside this story; see owner flag 17.
    - **F5** (relative-before-load-path order inside `pkg:`). A test was added (`1697112`). A load-paths-first mutant passed the old 36-test file and fails the new case.
    - **RES-6** (Sass re-reads `pkg:` files in each pass). The `Stage.texts` comment and the header were corrected (`1697112`).
    - **LOC-1 and SH-3** (the probe crashed with `uxdsl: the Sass stage's probe failed where the build did not (an internal error): expected "{".` on a token call inside `::part`, `:lang`, `:dir`, `:state`, `::highlight`, `::view-transition-group`, an unknown pseudo-class, a placeholder, an `@extend` target, `&::part` or `@at-root`). The fix is `702c34f`: a call Sass never evaluated whose probe text it cannot parse keeps the token, and the probe reruns. The negative control checks that a call Sass evaluates and that fails stays Sass's error.

      The implementer's open-issue claim that "token-like calls inside selectors already fail in pass 1" is false for these raw-text arguments. It holds only for selector-argument pseudo-classes (`:is`, `:not`, `:where`, `:has`, `:nth-child`, `::slotted`, `:host`).
    - **LOC-6** (a project `function-exists` or `get-function` answered the probe's lookups). Applied in `702c34f`, with a `sass:meta` prefix on every probed file. That prefix caused **RR-1**, and the rework is described there.
    - **LOC-2** (the frame showed `#{"…"}` text when multi-line spans overlap). The fix is `8bdb066`. A second instance with a single connector column was found while reproducing: an end marker drawn as `└─────^` where Sass draws `└────────────^`. Both are pinned by T4 shapes.
    - **SH-1** (`UXD_FUNCTION_SHADOWED` dropped when a file is evaluated twice, or a name is redefined). The fix is `b17ff28`. Before it, 12 of 14 shapes differed, for example `+ [] - ['_helpers.scss:1:11']`.
    - **SH-2** (a `pkg:` helper used `as *` while pass 1 fails). The fix is `2aea2d1`. Before it: `UXD_SASS: Undefined operation "space(2) * 2".`, where Dart Sass gives `.a { margin: 12px; w: 24px; }`.
    - **SH-5** (`options.reserved` unguarded). Tests were added (`4b1e2a1`). A mutant that hard-codes the reserved names passed the old suite 45/45 and fails both new tests.
    - **SH-4** (`@forward … as <prefix>*`). Reproduced: the stage gives `space(2)` where Dart Sass gives `6px`, with no warning. It is not fixable without modeling `@forward` (stop condition 4), so it is recorded as a difference (`a5dfdac`); owner flag 18.
    - **C-NEW-1** (found while verifying: a bare name two modules used `as *` both define; the stage was silent, or threw its internal error). The fix is `860851b`. The result is now Dart Sass's error at the call, or Sass's CSS where the call is raw text.
    - **F4 and F6** (`.css` as plain CSS; Sass's map options). Tests were added (`5912559`). Four mutants (`.css` served as SCSS, `.css` protected, Sass always run with a map, `sourceMapIncludeSources` false) each passed the 51 tests and each fails exactly its new test.
    - **GH-1** (AC4 unpinned). A test was added (`3f69864`). Moving `compile-sass.ts` or `protect.ts` to `NON_VISUAL_SOURCE_FILES` passed the 15 earlier guard tests and fails the new one.
    - **GH-4** (`UXD_SASS_WARNING`'s notices). The catalog, README and CHANGELOG were corrected (`0c448c5`).
    - **GH-3** (the CHANGELOG's 1.04×). The ratio was removed (`975feed`). Six runs at `860851b` on a loaded machine gave 1.01–1.43×.
    - **GH-2** (the AC6 evidence predated the code). This record's own runs on `ec245cf` replace it. The implementer's `npm test` (15:22) and `verify:1.0` (15:24) ran on the working tree before `9fe6364` (15:29).
    - **RR-1** (blocking, a regression introduced in `702c34f`). Dart Sass evaluates an `@import`ed file that has a `@use` apart from the importing file's modules, so the probe's prefix changed what Sass resolved there:
      - the author's function was silently replaced by the token, and the warning was lost (IMP-A, IMP-B, IMP-M);
      - or the stage threw its internal error where Dart Sass compiles (IMP-H1–H3, IMP-N1).

      The fixes are `4eb7d3b`, `ec245cf` and `810edd5`. Before them, 10 of 11 new rows failed on `975feed`; the control row IMP-U passed.
    - **RR-2** (a CRLF line covered by a multi-line span kept protect's text). The fixes are `b231d06` and `cef5921`.
    - **RR-3** (the one-compile claim did not hold for a failing build with `pkg:`). The documentation was corrected (`db20b2c`). With 40 distinct calls the build ran 44 compiles, and with 600 it ran 603 (224 ms).
    - **RR-4** (load-path and `SASS_PATH` entries were normalized). The fix is `8cd40e5`. Before it: `a load path written through a directory that does not exist: … the stage compiled`.
    - **Refuted, kept deliberate:**
      - F2: a `.scss` or `.sass` file's own bare calls do not warn (W5 scope (a), owner flag 3).
      - F3: breakpoint and `tone` calls warn by their end-of-file meaning (owner flag 5).
      - LOC-3: a position inside a rewrite reports the token's start (MIG-B9-11 R6).
    - **Nits left for later stories:** RES-4, RES-5, LOC-4, LOC-5 (§15).
- **Interruptions and an incident:**
  - Fixer B's first attempt hung after reproducing its first finding; it was stopped and restarted from scratch.
  - Fixer C's first attempt died when the owner's machine went to sleep (`Connection lost while your computer was asleep`) and was restarted.

    Neither attempt left changes in the worktree.
  - **Incident.** At 2026-10-31 00:49, while splitting its commits, fixer B ran `mkdir -p` with relative paths from the session's working directory, which is the owner's checkout. An unquoted zsh variable is not word-split, so the paths were wrong. It created one empty directory there: `/Users/ricardosantoyo/Documents/projects/uxdsl/packages/uxdsl/test/core/compile-sass.test.js`.

    Fixer B noticed and removed it with `rmdir` a minute later. Its parent directory's mtime is the only trace. The main session verified afterwards that the owner's checkout has no lasting change. The other files modified there that night came from the owner's own `npm run dev` of the playground (started 22:34:14), not from an agent. Checked read-only at delivery (2026-11-01, about 01:23), the checkout is clean on `main` at `ccd8a88`, with no stash, and the path does not exist.

    **Guard added:** every later agent's instructions carry a "shell traps" block:
    - start every command with `cd` into the worktree or its scratch directory, and prefer absolute paths;
    - zsh does not word-split an unquoted variable, so list items literally or expand an array quoted;
    - before any command that creates, moves or deletes files, check that every path it touches is inside the worktree or the scratch directory.
  - Fixer 2 had two more:
    - One `npm test` run hung in Node 20.19's test runner. It sat at about 97% CPU for 14 minutes in `Buffer.indexOf` while parsing a child's output after the child exited, and was killed with SIGKILL. The same suite then passed four times in 16–17 s, and every later `npm test` exited 0.
    - Stopping a superseded `npm test` left one orphan process: PID 85045, `node …/packages/uxdsl/bin/uxdsl.js build --watch`, a CLI watch test's child watching a temporary directory. Its `kill` was denied by the session's permission classifier. It was still running at delivery (owner step below). Later test runs passed with it alive.
- **Commands.** Exit codes are as reported by each agent. The fixers' and the re-review's runs were at their own heads; the delivery's runs are at `ec245cf`.

  *Implementer (2026-10-30):*

  | Command | Exit | Output |
  | --- | --- | --- |
  | `node --test packages/uxdsl/test/core/compile-sass.test.js` (tests committed, module absent) | 1 | `tests 33, pass 2, fail 31` (`Cannot find module …/dist/sass/compile-sass.js`) |
  | `node --test packages/uxdsl/test/core/protect.test.js` (with T15, on the base) | 1 | 78 tests: 75 pass, 2 fail (`site` ignored), 1 skipped |
  | `npm --prefix packages/uxdsl run build` | 0 | `tsc` clean |
  | `node --test …/compile-sass.test.js` (module added) | 0 | 33/33 |
  | `UXDSL_SASS_CORPUS=<corpus> node --test …/protect.test.js` | 0 | 78/78; `Bootstrap corpus: 92 files, 328410 bytes; protect 2.1 ms` |
  | `node --test packages/uxdsl/test/diagnostics-catalog.test.js` | 0 | 7/7; 111 codes |
  | `node --test scripts/verify-docs-update.test.js` | 0 | 15/15 |
  | `(cd packages/uxdsl && npm install --no-audit --no-fund)` after the move | 0 | lock synced (two ranges; `"dev": true` dropped from `sass`'s subtree) |
  | `(cd packages/uxdsl && npm ci --ignore-scripts --no-audit --no-fund && npm audit)` | 0 | `added 116 packages`; `found 0 vulnerabilities` |
  | `(cd packages/playground-nextjs && npm ci --ignore-scripts --no-audit --no-fund)` | 0 | `added 1133 packages`; its lock needed no refresh |
  | `npm run generate:language && node scripts/generate-language-artifacts.js --check` | 0 | no drift |
  | `npm run generate:capabilities` | 0 | no diff |
  | `node packages/playground-nextjs/scripts/capture-capabilities.js --check` | 0 | `Captured CLI and compiler output is up to date.` |
  | `node scripts/generate-agent-guide.js --check` | 0 | no drift |
  | `npm run verify:doc-examples` | 0 | 49 examples, 24 theme excerpts, 101 files |
  | `node fixtures/parity/run.js` | 0 | `PASS: 8 parity case(s)` |
  | `npm test` (first run) | 1 | `test/entries.test.js` pinned the old dependency list; updated |
  | `npm test` (second run) | 0 | 1,525 tests, 1,391 pass, 0 fail, 133 todo, 1 skipped (on the working tree before `9fe6364`) |
  | `node --test packages/uxdsl/test/core/*.test.js && node --test packages/uxdsl/test/*.test.js` (after the last code change) | 0 | core 407: 273 pass, 133 todo, 1 skipped; top level 709/709 |
  | `npm run verify:1.0 -- --skip-playground-walk` | 0 | `65/65`; 257,731 bytes packed (before `9fe6364`: not AC6 evidence, GH-2) |
  | `npm run verify:pack-budget` | 0 | `uxdsl: 251.7KB / 300KB budget — ok` |
  | `npm run verify:playground-browser` | 0 | `PASS`, 380 pages, 2,218 focusable elements |
  | twin experiments `i03`–`i09` (scratch) | 0 | Bootstrap: 1 compile, CSS byte-identical, 87 loaded files; maps equal Dart Sass's on the twin (6/6); 18 more frame shapes equal after one fix |
  | `git commit` ×3 (hook), `git push` | 0 | `e6eab11`, `9fe6364`, `f81c53a` |

  *Fix pass (2026-10-30 22:49 to 2026-11-01 01:05).* Each "before" run used the build of the commit before the fix:

  | Command | Exit | Output |
  | --- | --- | --- |
  | A: `node --test --test-name-pattern 'begins with \.\.\|in-memory source' …/compile-sass.test.js` on `f81c53a` | 1 | pass 1, fail 2 (the stage compiled where Dart Sass fails) |
  | A: twin differentials `e03` (`..`), `e05` (`SASS_PATH`), `e07` (`pkg:` order), `r09` (state), reviewer `r01`–`r14` rerun | 0 | before 6/9 and 7/8 differ, after all the same; RES-2 and RES-6 reproduced; r06 (RES-4) and r08 `%2F` (RES-5) remain |
  | A: weaker-fix mutant; load-paths-first mutant (36- then 38-test file) | 1 | 33/34; 36/36 pass (the F5 gap), then 37/38 |
  | A: SASS_PATH test on `5e168dc` | 1 | `UXD_SASS: Can't find stylesheet to import.` |
  | B: `compile-sass.test.js` with `1697112`'s module swapped into `dist` | 1 | 3 fail as intended (T4 frames, raw pseudo-class internal error, meta names); controls pass |
  | B: four mutants of the fixed module | 1 | each caught (naive retry 2 tests, no prefix 10, end marker as a start T4, two-character connector T4) |
  | C: SH-1, `bodies`, SH-2, SH-5 (mutant), SH-4, C-NEW-1 tests before their fixes | 1 | `+ [] - ['_helpers.scss:1:11']`; 2 fail; `Undefined operation "space(2) * 2".`; 45/45, then both new fail; `space(2)` vs `6px`; `the stage compiled` |
  | C: `UXDSL_SASS_CORPUS=<corpus> node --test …/protect.test.js` | 0 | 80/80, Bootstrap identity unchanged, 2.1 ms |
  | C: `x06` (Bootstrap and one shadowing helper) | 0 | 5 compiles, `.app { margin: 16px; padding: palette(primary.main); gap: 32px; }`, one warning at `_myfns.scss:1:11` |
  | D: four `dist` mutants with the old tests, then the new | 0, then 1 | 51/51 each (the gaps), then each fails exactly its new test |
  | D: guard mutants (`compile-sass.ts` or `protect.ts` moved to `NON_VISUAL_SOURCE_FILES`) | 1 | the 15 old tests pass, the new one fails |
  | D: `d03-bootstrap.js` ×6 at `860851b` | 0 | stage 410–540 ms vs Dart Sass 368–406 ms, maps on (1.01–1.43×, load average 4–8); 1 compile, byte-identical CSS |
  | re-review (read-only at `975feed`): the four suites; 22 mutants; twin experiments `e01`–`e15` on builds of `f81c53a`, `1697112`, `702c34f`, `975feed` | 0; 1 per mutant | 55/55, 79+1 skipped, 7/7, 16/16; every mutant caught; RR-1 to RR-4 |
  | fixer 2: the new DEC-17 and meta rows on `975feed`; the final test file on `975feed`'s `dist`; CRLF rows on `4eb7d3b`; `..` on `b231d06` | 1 | 10 of 11 import rows and 3 meta rows fail; 51 of 57; 3 fail; `the stage compiled` |
  | fixer 2: 15 mutants; experiments `e01`–`e15`, `f02`, `f03` | 1 per mutant; 0 | each caught; every re-review case equal to the twin; the recorded differences remain |
  | fixer 2: `d03`, `x06` at the final build | 0 | no definition: 1 compile, byte-identical CSS, 424 ms median, 1.16× plain Dart Sass (maps on); with a helper: 5 compiles, the same CSS and warning |
  | every fixer, at each commit state: `npm --prefix packages/uxdsl run build`; `compile-sass.test.js`; `protect.test.js`; `diagnostics-catalog.test.js`; `node fixtures/parity/run.js`; `npm run verify:doc-examples`; both `--check`s | 0 | compile-sass 34 → 36 → 38 → 42 → 51 → 55 → 57, all pass; protect 77 or 79 + 1 skipped; 7/7; PASS 8; hold; no drift |
  | `npm test` (background, logged): A before each of its 3 commits, B at both states, C before each of its 5, D once on the tree committed as `975feed`, fixer 2 before each of its 7 | 0 | 0 fail, 133 todo, 1 skipped each time; last 1,552 tests, 1,418 pass |
  | fixer 2: one extra `npm test` (RR-2 state) | killed | Node 20 test-runner hang (see the incident above); rerun passed |
  | every fixer: `git commit -F …` (hook: `✅ Docs check passed.` and the playground build), `git push` | 0 | `5e168dc` … `ec245cf`, 21 commits |

  *Delivery (2026-11-01, `ec245cf`):*

  | Command | Exit | Output |
  | --- | --- | --- |
  | `npm --prefix packages/uxdsl run build` | 0 | `tsc -p tsconfig.json`, clean |
  | `node --test packages/uxdsl/test/core/compile-sass.test.js` (AC1) | 0 | `# tests 57`, `# pass 57`, `# fail 0`, `# skipped 0` (18 s) |
  | `node --test packages/uxdsl/test/core/protect.test.js` | 0 | `# tests 80`, `# pass 79`, `# skipped 1` (the Bootstrap corpus test: `UXDSL_SASS_CORPUS` unset) |
  | `UXDSL_SASS_CORPUS=<a directory holding bootstrap 5.3.8> node --test packages/uxdsl/test/core/protect.test.js` | 0 | 80/80; `Bootstrap corpus: 92 files, 328410 bytes; protect 2.1 ms (first pass, cold: 3.2 ms)` |
  | `node --test packages/uxdsl/test/diagnostics-catalog.test.js` (AC2) | 0 | 7/7; the catalog holds 111 codes (theme 59, compiler 40, runtime 6, core 6) and no `UXD_RESERVED_NAME` |
  | `node --test scripts/verify-docs-update.test.js` (AC4) | 0 | 16/16 |
  | `node -p "require('./packages/uxdsl/package.json').dependencies.sass"` (AC3) | 0 | `^1.107.0` (installed 1.107.0; `source-map-js` `^1.2.2`; neither left in devDependencies) |
  | `(cd packages/uxdsl && npm audit)` (AC3) | 0 | `found 0 vulnerabilities` |
  | `node fixtures/parity/run.js` (AC5, no `--update`) | 0 | `PASS: 8 parity case(s) — CLI, compile(), and the Vite/Webpack adapters agree, matching the committed oracle.` |
  | `npm test` (AC6), background, logged | 0 | 1,552 tests: 1,418 pass, 0 fail, 133 todo (MIG-B9-10/13's), 1 skipped. `Captured CLI and compiler output is up to date.`; parity `PASS`; mig07 `All checks passed.`; the capability matrix up to date. 2 min 20 s |
  | `npm run verify:doc-examples` | 0 | `49 examples and 24 theme excerpts checked across 101 documentation files. All documentation examples hold.` |
  | `node scripts/generate-language-artifacts.js --check` | 0 | no drift |
  | `node scripts/generate-agent-guide.js --check` | 0 | no drift |
  | `npm run verify:1.0`: the full gate with real Chrome, background, logged (AC6) | 0 | `66/66 automated checks passed.` `PASS: the 1.0 gate (automated portion) for uxdsl@0.5.0-beta.9.` Details: the tarball is 263,456 bytes packed (94 files); `I-1`: postcss 8.5.32 as the peer; `AUDIT` and `AUDIT-lock`: 0 critical, 0 high, 0 moderate, 0 low; `B7-17E` (the Chrome walk): `PASS`; `UX-20`: maps byte-identical; packages installed with uxdsl: 30. Not executed, as always: B7-12 (manual VS Code), the external story-radar validation, postpublish. 5 min 25 s |
  | `npm run verify:playground-browser` (run 1, port 3919) | 1 | environmental: `browserType.launch: Timeout 180000ms exceeded`. The playground build had succeeded (25/25 pages); Chrome started (pid 97986) and never answered Playwright. The walk then held its own `next start` on 3919 until this session stopped that server |
  | `npm run verify:playground-browser -- --port 3929` (run 2, the one re-run) | 0 | `PASS: no console errors, no UXDSL warnings, no unresolved var(), visible keyboard focus, contrast page = Node.` 380 pages loaded, 2,218 focusable elements checked. The contrast page matches Node for `default` and `green`, light and dark (1,004 and 911 pairs checked, 0 failing). 1,532 hosting-only 404s were exempted and listed. All six planted negative controls were caught (unresolved var, console error, invisible focus, contrast mismatch, horizontal overflow, paradigm mismatch). 4 min |
  | `npm run verify:1.0 -- --skip-playground-walk` (AC6, as written) | 0 | `65/65 automated checks passed.` `PASS: the 1.0 gate (automated portion) …`: the same tarball (263,456 bytes), `I-1`, `AUDIT` and `AUDIT-lock` ok, B7-17E delegated by the flag. 1 min 34 s |

- **Guards (§10):**
  - `packages/uxdsl/CHANGELOG.md` gained one subsection under `## 0.5.0-beta.9 — unreleased`, with `#### Dependencies` and `#### Diagnostics`. There is no compiled-output change, so there is no `### Visual changes` entry.
  - `packages/uxdsl/README.md` gained the "Install" sentence (`sass` arrives with `uxdsl` and is never loaded by the plugin alone) and sentences in the Sass paragraph.
  - `scripts/verify-docs-update.js` lists `src/sass/compile-sass.ts` in `VISUAL_DEFAULT_FILES`, pinned by a test.
  - `DIAGNOSTIC_CATALOG` gained two codes, produced by `compile-sass.ts` and provoked by tests 14 and 37.
  - `npm run generate:language` shows no drift (the catalog does not feed the artifacts). The captures are unchanged and up to date: `uxdsl build` cannot emit the new codes before MIG-B9-13. `AGENTS.md` is untouched (MIG-B9-15 owns it).
- **Not run, or not a pass:**
  - Windows is unverified (CI runs on ubuntu). By construction Dart Sass and the stage hand the same raw path to Node's `fs`, and `fs` normalizes `..` on win32.
  - T14 (test 51) is skipped on win32 and when running as root. It ran here and runs in CI (uid ≠ 0).
  - protect's Bootstrap corpus test is skipped in CI, where no corpus is installed. It ran locally (80/80).
  - The Bootstrap timings are one machine's figures. The CHANGELOG quotes no ratio.
  - No external consumer or browser claim is made by this story beyond the standard gates: the module has no output impact until MIG-B9-13.
  - CI's result on this PR comes after this record is committed, and is not part of it.
- **Owner steps pending:**
  - Review the owner flags: the design record's 16 and the fix pass's 6, listed in §15 "Delivery of 2026-11-01".
  - Confirm the DEC-17 mechanism (flag 1, with the replay form).
  - Decide on RES-2, SH-4, the RR-1 residual and RES-4's extension rule.
  - Merge the PR into `feat/beta9` once CI is green (README §6). This delivery was instructed not to merge.
  - The wave-1 review.
  - Stop the orphan process PID 85045 (`kill 85045`).

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **Blocking — error locations.** Sass returns a source map only when asked; with the CLI default (no map) errors and warnings carry Sass-output coordinates under the entry's name (13 T3's own control expects line 29), so P5, A1 and gate S-3 (`heavy.uxdsl:18:66`) cannot hold. Always run Sass with a map internally and emit the final map only on request; measure the P10 budget with maps on.
- The code frame (`sassFrame`, E1) is rendered from the text Sass received, so the CLI would print `#{"palette(…)"}`; re-render it from the original source.
- IM5: `.uxdsl` files inside `node_modules` are unreachable through the importer as specified; define whether a package can ship `.uxdsl` partials.

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-04, confirmed:** `sass` (the pure-JavaScript package, not `sass-embedded`) goes in `dependencies`, and `compile()` loads it at call time, so `require('uxdsl/postcss')` alone never loads it. Add a test that requiring `uxdsl/postcss` leaves `sass` out of `require.cache`. Updating the lockfile needs a session with npm registry access.
- **DEC-17:** nothing throws `UXD_RESERVED_NAME`. `options.reserved` becomes the set of names checked for shadowing; E2 and T5 become the `UXD_FUNCTION_SHADOWED` warning located in the file that defines the function (`@function space` in a loaded partial: Sass's output and one warning at that file's line and column). The second compile MIG-B9-11 describes is this story's.

### Delivery of 2026-11-01

New facts from the design, the implementation, the review and the fixes, each with a proposed owner. None is fixed beyond what §14 records.

**Owner decisions requested (the design record's flags, then the fix pass's):**

1. **DEC-17 mechanism.** A per-call-site probe replaces MIG-B9-11 §15's per-build recipe (Q2; scout `e15`/`e20`; the recipe scores 8/20 against Dart Sass, the probe 20/20 and 33/33). The fix pass extended it:
   - a call Sass never evaluates keeps the token;
   - `pkg:` helpers are probed when pass 1 fails;
   - attribution is per definition;
   - a call seen both ways replays the probe's records (`uxdsl-probe-replay`) instead of the record's `sass:meta` dispatch. This changes Q2 step 5 and note 9.7; Q2's decision is unchanged.

   Please confirm in PR review.
2. **`protect.ts` and `protect.test.js` are outside Owns and Shares.** The changes are the additive options `site` (calls reported and decided) and `bodies` (`ProtectProblem.end`), and four tests. Without the options the output is byte-identical.
3. **W5 scope (a).** A `.scss` or `.sass` file's own bare calls of its own function do not warn, because their output is Dart Sass's either way (F2, refuted as deliberate). The alternative is (b): count them too.
4. **A call Sass cannot parse keeps the token** (`palette(primary.main)`), even where a project `palette()` is visible. A call Sass can parse goes to the author's function, as in Dart Sass: `color(gray.300)` is read as `color(gray .3)`.
5. **Calls protect never rewrites warn by their end-of-file meaning.** These are breakpoints, `tone`, and token calls with a non-key-like argument; their CSS is always Dart Sass's. A call before a mid-file `@import` can over-warn, and a definition in a nested scope can under-warn (F3, refuted as deliberate).
6. **Q1: `sourceMap` is kept as §5.1 writes it.** MIG-B9-13 passes `sourceMap: true` on every build and locates plugin errors with `originalPositionFor`. Dropping the option would rewrite M2 and T7's control; tests 41 and 42 enforce the current form.
7. **E3 is literal.** An I/O error reading a loaded file is rethrown unchanged. Dart Sass reports an unreadable `.scss` as an error at the `@use`.

   One more instance, found by fixer A and covered by no test: a symlinked load path whose `..` leads to an existing file where the written path does not exist. Dart Sass canonicalizes to the written path and reports `no such file or directory` at the `@use`; the stage rethrows the raw `ENOENT`.
8. **`sassFrame`** is the frame and stack without the message line, never colored. `@debug` output is dropped (W4), whereas Dart Sass prints it.
9. **`source-map-js`** moves to `dependencies` at `^1.2.2`.
10. **`UXD_FUNCTION_SHADOWED` stays `compiler`.** Proposed for MIG-B9-13.
11. **Node engines.** `sass` 1.107.0, `chokidar` 5 and `readdirp` 5 require Node 20.19 or later, and `uxdsl` declares no `engines`, so consumers on an older Node 20 get EBADENGINE warnings. Decide whether `uxdsl` declares `engines`. Proposed for MIG-B9-91, with the release note in MIG-B9-52.
12. **`compile({ source })` without `from`** has no entry path, and `SassStageInput.entry` stays required. Proposed for MIG-B9-13.
13. **MIG-B9-14:**
    - read `error.code`, because `diagnosticCode()` returns `undefined` when the message starts with a location;
    - an unknown key in `config.sass` must be a config error, since the stage reads only `silenceDeprecations` and `quietDeps`.
    - **Widened by LOC-5:** when the reported pass throws, the build loses the `UXD_FUNCTION_SHADOWED` warnings and also every Sass deprecation and `@warn` delivered before the failure (`[import]` and `[slash-div]` are lost before `Undefined variable.`). Proposal: `error.warnings`, later and non-breaking.
14. **Story size.** `compile-sass.ts` is 1,419 lines and `compile-sass.test.js` 1,448. Splitting the DEC-17 machinery out would have moved T5, which is an AC-level change.
15. **The playground's lockfile** records `../uxdsl`'s manifest. It was already stale for devDependencies since MIG-B9-10, and `npm ci` there still passed after the move, so no refresh was needed. Proposed for MIG-B9-91.
16. **MIG-B9-11 follow-ups.** See the protect items in the MIG-B9-11 follow-up story list below.
17. **RES-2.** Inside a package that `pkg:` loaded, Sass's own `.sass`/`.scss`/`.css` candidates, or a directory index, answer a relative URL before a `.uxdsl` partial. `_tokens.uxdsl` beside `_tokens.scss` silently loads the `.scss`, where the same files reached through a load path are Sass's ambiguity error. Tests 9 and 10 pin this.

    Correcting it would mean resolving `pkg:` in UXDSL code, which §7 forbids, or serving `pkg:` files through the stage's importer, which changes Q4. Accept it as a documented limitation, or revisit Q4.
18. **SH-4.** A function reached under a UXDSL name only through `@forward … as <prefix>*` is not found. With `@forward "x" as spa*` and `@function ce`, `space(2)` keeps the token where Dart Sass gives `6px`, with no warning. Tests 23 and 24 pin this.

    The alternative is a gated composition scan: the prefixes of `@forward … as P*` combined with the `@function S` names into candidates P+S, with visibility left to Sass. That scan brushes against stop condition 4. Accept the limitation, or ask for the scan.
19. **RR-1 residual.** In a build where a loaded file defines `get-function` or `function-exists`, an `@import`ed file still asks the project's function, where it is visible there, in four cases:
    - the file has no `@use` of its own but is also loaded with `@use`;
    - the file has its own `@use` and is imported by another `@import`ed file;
    - the file is reached only through a mixin;
    - the file is imported by an indented `.sass` module or a `pkg:` file.

    Tests 29 and 30 pin this. Accept it, or ask for more.
20. **RES-4, case-variant extensions.** The design's ENTRY rule says "anything else, `.uxdsl` included, protected scss". On darwin and win32, `_x.SCSS` reached by `@use "x"` is therefore served as a protected `.uxdsl`. Dart Sass's `Syntax.forPath` reads it as plain SCSS, so it gives `$description: white is not a string.` where the stage compiles `.x { c: color(white); }`. Matching Sass changes the ENTRY rule.
21. **Stop condition 6, not taken.** The record called a probe failure "a bug, never expected" and a reason to stop (LOC-1/SH-3). Instead, a call Sass never evaluated whose probe text it cannot parse keeps the token, which is exactly what Sass leaves in a raw pseudo-class argument. A call Sass evaluates and that fails is never retried: a negative control covers it, and a naive-retry mutant fails that control. This extends Q2's "unparseable calls keep the token".
22. **`sass:meta` mode.** The probe's lookups go through `sass:meta` under the reserved `uxdsl-probe-meta` namespace only in a build that defines `function-exists` or `get-function` (LOC-6, reworked by RR-1). Design note 9.5's global lookups are the form for every other build.

**Follow-ups, by story:**

- **MIG-B9-13:**
  - P1: pass `sourceMap: true` on every build (flag 6).
  - P5: locate plugin errors with `originalPositionFor` on the stage map, not a fixed +1. PostCSS 8.5.16+ is exact; the `^8.4.31` peer range allows the older one-less versions.
  - P3: it still lists `UXD_RESERVED_NAME` under `core` (Q12 k). Nothing produces it under DEC-17.
  - Move `UXD_FUNCTION_SHADOWED` to `core` (flag 10) and retitle the playground's core group, "compile() (the SCSS subset and imports)" (Q12 l).
  - Add the `/docs/diagnostics` capture of `UXD_FUNCTION_SHADOWED` once the CLI can emit it, as recorded by MIG-B9-11.
  - Decide `compile({ source })` without `from` (flag 12).
  - `sass-pipeline.test.js`'s "a missing @use fails as UXD_SASS…" todo fails for the wrong reason (`@use rules must be written before any other rules.` at line 2). Write the `@use` first and assert `Can't find stylesheet to import.` (Q12 a).
  - The same file passes `silenceDeprecations` at the top level of `compile()`'s config, while MIG-B9-13 and MIG-B9-14 name it `sass.silenceDeprecations` (Q12 i).
  - P9: chaining the stage map through PostCSS needs its `sources` made relative to `dirname(to)` and PostCSS's own-input mappings dropped (Q12 j).
  - P10, the Bootstrap figures on `sass` 1.107.0 (Q12 b):
    - 330 deprecations (`import` 87, `if-function` 83, `global-builtin` 154, `color-functions` 6), delivered as 21 warnings (`310 repetitive deprecation warnings omitted.`). W2's "247 / about 16" and README §9 are 1.94.2 figures.
    - The corpus has 92 `.scss` files.
    - Re-measure the ratio on a quiet machine: 1.04× at `f81c53a`, 1.01–1.43× on a loaded machine at `860851b` (six runs), and 1.16× at `ec245cf` (maps on, one compile, byte-identical CSS). The budget is 1.5×.
    - A failing build that names `pkg:` probes every token call, which costs one parse-check compile per distinct unparseable call (60 distinct `palette(x.y)` calls: 63–65 compiles, 25–35 ms; 600: 603 compiles, 224 ms). A possible optimization: after a parse error at line k, the lines before k are known to parse.
  - MIG-B9-13 P7 (Q9): a local `.css` imported with its extension reaches the browser without UXDSL processing.
- **MIG-B9-14:** flag 13, widened by LOC-5 (`error.code`, unknown `config.sass` keys, the warnings lost when the reported pass throws).
- **MIG-B9-15:**
  - D2's "`.uxdsl` before `.scss`" is not the delivered rule. Sass gives no precedence: a `.uxdsl` and a `.scss` answering one URL in one directory are Sass's ambiguity error, and a candidate in the importing file's directory beats a load path.
  - D2 also needs the `pkg:` exception (flag 17), the `SASS_PATH` directories searched after the load paths, and load paths joined as Dart Sass joins them (a `../x` that misses is never a file elsewhere).
  - Document SH-4 and the RR-1 residual (flags 18 and 19).
  - Document that a `.css` partial is plain CSS (Q9), and that a package can ship `.uxdsl` partials, reached by a bare path or relatively from its own files, while a `pkg:` export cannot point at a `.uxdsl` file.
  - D7 still lists `UXD_RESERVED_NAME` among the codes to capture, which DEC-17 removed.
- **MIG-B9-52 and MIG-B9-91:**
  - A fresh `npm i -D uxdsl` now installs 30 packages (`verify:1.0`'s measurement; about 10 more with Dart Sass). The "20 packages" claims in `docs/releases/0.5.0-beta.9.md` and the CHANGELOG's stability-phase-4 entry are stale (Q12 c).
  - Node engines (flag 11).
  - The playground's lockfile (flag 15, Q12 n).
- **A MIG-B9-11 follow-up story (protect):**
  - (Q12 h) `@function SPACE` (uppercase) is not reported while `SPACE(…)` is protected, so the author's function never runs.
  - (Q12 h) A `@function` local to a style rule is treated as file-wide; the stage corrects it whenever a definition exists, but protect's comment is inaccurate.
  - (Q12 h, widened by LOC-4) A lone CR is a newline for Sass but not for protect. After it, the error, warning and map columns all move, and `sassFrame` shows protect's `#{"…"}` text: Dart Sass reports 3:17, the stage 3:22.
  - (Q12 h) `findShadowingFunctions` does not know indented-syntax comments; the stage blanks them.
  - protect re-emits only `\n` after a multi-line rewrite. A CRLF file therefore loses the `\r` inside a token call written across lines, and a frame covering that line shows a trailing `\r` where Dart Sass shows none.
  - A token call written across lines in a raw selector argument (`.a::part(space(\n  2))`) compiles to `.a::part(space(2)\n)`, where Dart Sass keeps `space(\n  2)`. Test 25 pins this as a stated expectation.
  - A token call written as a property name (`.a { space(2): 1px; }`) compiles through protect's interpolation, where Dart Sass rejects the `.scss` twin with `expected "{".`.
  - RES-4: on darwin, the canonical spelling of a symlinked directory written in another case, and NFD file names, differ from Dart Sass's `_realCasePath`, so a module can load twice. CI on ubuntu cannot exercise this.
  - RES-5: `%2F` in a URL is decoded by Dart Sass but is `Can't find stylesheet to import.` here, in both branches. A decoder for one branch only would turn a loud error into a silent pick.
- **No action, recorded:**
  - `.a:not(space(2))` fails in both, located at the token's start (2:8) where Dart Sass reports 2:13. This is deliberate per Q3 and MIG-B9-11 R6 (LOC-3 refuted).
  - Two of the run's own statements were false and are not carried over:
    - the implementer's T9 deviation note (Dart Sass does not resolve `../../part` through a missing load path);
    - its claim that token calls in selectors always fail in pass 1.
  - The record's Q4 candidate formula was lexical; corrected by `5e168dc` and `8cd40e5`.
  - Q12 d, e, g and m need no action:
    - (d) there is no `test/fixtures/diagnostic-cases.js`;
    - (e) §2's prototypes are not in the repository, and were re-verified;
    - (g) the scout's "`loadedUrls` carry the case written" is wrong on darwin and win32;
    - (m) MIG-B9-11's closure advice to report every protect problem is superseded by W5.
  - Node 20.19's test runner hung once, for 14 minutes, while parsing a child's output after the child exited. A rerun passed. Recorded in case it recurs in CI (MIG-B9-91).
  - In this delivery, the first `verify:playground-browser` run failed before walking: Chrome never answered Playwright's launch within 180 s. The one re-run, on another port, passed (§14).

### Owner decisions of 2026-11-04

The owner decided the flags of "Delivery of 2026-11-01" above on 2026-11-04. The owner was given 19 numbered recommendations, in Spanish, and answered, verbatim, "voy a seguir todas tus recomendciones" ("I will follow all your recommendations"): each recommendation is the owner's decision of 2026-11-04, recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-04). This record is in English and lists those that concern this story. Where they differ from this story's contract, they rule.

- **Accepted as delivered (D19):** flags 1, 2, 3, 4, 5, 7, 9, 14, 15, 16, 17, 18, 19, 20, 21 and 22. Flag 15's lockfile item goes to MIG-B9-91.
- **Settled by MIG-B9-13 and MIG-B9-14 (D19):** flags 6, 10, 12 and 13.
- **Flag 8, `@debug` (D12):** Sass's `@debug` output is accepted as dropped for now; MIG-B9-26, "Dotted near-misses keep DEC-02's "did you mean" through `compile()`; Sass's `@debug` reaches the build as a warning" (S, wave 2, after MIG-B9-14), shows it as a warning.
- **Flag 11, Node engines (D10):** `uxdsl` declares `"engines": { "node": ">=20.19" }`, in MIG-B9-91, with the release note in the beta.9 migration section.
