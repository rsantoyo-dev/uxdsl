# MIG-B9-12 — `src/sass/compile-sass.ts`: Dart Sass with the `.uxdsl` importer

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 1 |
| Decision gate | DEC-01 (decided); DEC-04 (recommended: `sass` is a regular dependency) |
| Status | Blocked (DEC-04) |
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

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **Blocking — error locations.** Sass returns a source map only when asked; with the CLI default (no map) errors and warnings carry Sass-output coordinates under the entry's name (13 T3's own control expects line 29), so P5, A1 and gate S-3 (`heavy.uxdsl:18:66`) cannot hold. Always run Sass with a map internally and emit the final map only on request; measure the P10 budget with maps on.
- The code frame (`sassFrame`, E1) is rendered from the text Sass received, so the CLI would print `#{"palette(…)"}`; re-render it from the original source.
- IM5: `.uxdsl` files inside `node_modules` are unreachable through the importer as specified; define whether a package can ship `.uxdsl` partials.
