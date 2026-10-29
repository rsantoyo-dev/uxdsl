# MIG-B9-10 — The superset's tests, first

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 1 |
| Decision gate | DEC-01 (decided) |
| Status | In review (PR #46; part 1 merged as PR #34) |
| Size | M |
| Depends on | MIG-B9-05 (byte-preserving plugin) |
| Blocks | MIG-B9-11, MIG-B9-12, MIG-B9-13 |
| Base | `feat/beta9` after MIG-B9-05 |
| Owns | `packages/uxdsl/test/core/sass-matrix.test.js`, `packages/uxdsl/test/core/sass-matrix.cases.js`, `packages/uxdsl/test/core/sass-matrix.record.js`, `packages/uxdsl/test/core/protect.cases.js`, `packages/uxdsl/test/core/protect.test.js`, `packages/uxdsl/test/core/sass-source-maps.test.js`, `packages/uxdsl/test/core/fixtures/sass-maps/**`, `packages/uxdsl/test/core/sass-pipeline.test.js`, `fixtures/sass-corpus/**` (all new) |
| Shares | `packages/uxdsl/package.json` (`devDependencies.sass`) |
| Output impact | none (tests and fixtures only) |

## 1. Goal

Before a line of the superset is implemented, the promise is written as
tests that fail: the 110-case matrix re-expected to what Dart Sass produces,
the 63 protect/restore cases, the source-map fixture, the pipeline behaviors,
and Bootstrap 5.3.8's SCSS renamed to `.uxdsl` compiling byte-identical to
Dart Sass. MIG-B9-13 turns them green.

## 2. Sources

- DEC-00: "una persona cambia `.scss` por `.uxdsl` y debe funcionar, y a partir
  de ahí agregar cualquier cosa de UXDSL".
- Plan §9.1 "Done when" and §9.5 "Tests and evidence": the matrix "equal to
  Dart Sass"; "A real, large SCSS codebase as a fixture (for example Bootstrap
  5's SCSS source, MIT) renamed to `.uxdsl`: its compiled CSS equals Dart
  Sass's"; "A diagnostic inside a file that uses `@use`, mixins and nesting
  points at the original line".
- Guardrail 2 (plan): "'Rename and it works' must be 100% true … the large real
  SCSS codebase in §9.5 is the guarantee of the promise, not a detail".
- `packages/uxdsl/test/core/scss-subset.test.js`: the 110 cases as
  `[name, source, { css } | { error }]`, the `normalize()` and `problemsOf()`
  helpers (csstree validates the output is CSS), the tally test
  (`ok >= 68 && error >= 41`).
- The prototypes under the session scratchpad (not in the repository), whose
  results README §9 records: the 63-case list (`e4-cases.js`), the source-map
  fixture (`maps/heavy.uxdsl`, `maps/_mixins.uxdsl`), the Bootstrap pipeline
  (`lib.js`: a Sass `Importer` with Sass's own resolution rules, `.uxdsl` as a
  first-class extension). Their content is reproduced in this story's §7 where
  it is normative.

## 3. Preconditions

```bash
test -f packages/uxdsl/test/core/scss-subset.test.js
test -f fixtures/sass-corpus/run.js && test -f packages/uxdsl/test/core/protect.cases.js && test ! -f packages/uxdsl/test/core/sass-matrix.cases.js   # part 1 (PR #34) is merged; part 2 has not started
test -f packages/playground-nextjs/node_modules/sass/package.json || npm view sass version >/dev/null   # Dart Sass is reachable (this worktree's playground copy, or the registry)
grep -q "assignValue" packages/uxdsl/src/plugin.ts   # MIG-B9-05 merged
```

## 4. Baseline

```bash
cd packages/uxdsl && node --test test/core/scss-subset.test.js 2>&1 | tail -4
```

Recorded: 110 case tests plus 2 pass; the tally is `ok 69, error 41` (or the
current values; record them).

## 5. Contract

- **C1 — `sass` as a devDependency.** `packages/uxdsl/package.json` gains
  `devDependencies.sass` at the current 1.x (`^1.94.0` or later; record the
  exact resolved version). MIG-B9-12 promotes it to a dependency (DEC-04).
- **C2 — The Sass matrix.** `test/core/sass-matrix.cases.js` exports the 110
  cases with the same names and sources as `scss-subset.test.js` and new
  expectations:
  - a case whose source is valid Sass expects the CSS Dart Sass produces for
    it (through `compile()`, with UXDSL constructs then resolved by the
    plugin). Nesting is flattened; `&-suffix` concatenates; `@at-root` works;
    `map-get`, `nth`, arithmetic and string concatenation are evaluated;
  - a case that is invalid Sass expects `UXD_SASS` (for example an undefined
    variable, incompatible units) — located;
  - a case that is UXDSL-only (`sass-tol-*`, `interact-*`) expects today's
    output, byte for byte;
  - the recorded expectation of a Sass-valid case is **produced by Dart Sass**:
    `test/core/sass-matrix.record.js --update` compiles each Sass-valid
    source with the `sass` package directly (no UXDSL) and writes the literal
    into the cases file; the test compares `compile()`'s output with the
    literal, and a second test compares the literal with live Dart Sass's
    output, so a Sass upgrade that changes output is noticed.
  `test/core/sass-matrix.test.js` runs every case through `compile()` with
  `includeTheme: false`, asserts the expectation, validates the output with
  `problemsOf()` (CSS, no Sass construct left), and keeps a tally test:
  `CASES.length === 110`, and the number of error cases equals the number of
  invalid-Sass sources (recorded in the cases file as `expectedErrors`).
- **C3 — The protect/restore cases.** `test/core/protect.cases.js` exports the
  63 cases of §7.2 as `[id, source, expectedFinalCss | 'ERROR:<code>']`, with
  the theme they run against
  (`{ spacing: { '0-5': '2px', '10-2': '40px' }, palette: { brand: { main, dark, contrast, light, '100' } } }`
  merged over the base). `test/core/protect.test.js` runs each through
  `compile()` and compares the flattened final CSS (whitespace collapsed, as
  the prototype's `flat()` does). It also holds the unit tests MIG-B9-11
  fills in (`protect()` itself).
- **C4 — The source-map fixture.** `test/core/fixtures/sass-maps/heavy.uxdsl`
  and `_mixins.uxdsl` are the prototype's files verbatim (§7.3).
  `test/core/sass-source-maps.test.js` asserts: a UXDSL error inside a
  Sass-heavy file is reported at `heavy.uxdsl:18:66` (the `inset: space(404)`
  declaration, line and column of the author's file); an error inside a mixin
  of a `@use`d partial is reported in `_mixins.uxdsl` at the `padding:
  density(99)` line and column; a Sass error (`c: $undefined`) is reported at
  its exact column; the final map of a successful compile has `sources`
  naming the `.uxdsl` files (relative to `to`, no `file:` URLs, no
  duplicates) with `sourcesContent`, and `originalPositionFor` of the emitted
  `inset: var(--uxdsl__space__4)` points at line 18 of `heavy.uxdsl`.
- **C5 — Pipeline behaviors.** `test/core/sass-pipeline.test.js` holds one
  test per behavior MIG-B9-12 and MIG-B9-13 must deliver (titles in §8). They
  are written now against `compile()`.
- **C6 — The Bootstrap corpus.** `fixtures/sass-corpus/run.js`:
  1. installs `bootstrap@5.3.8` (exact) into a temp directory with
     `npm install --no-audit --no-fund` (network; `--offline` is not an
     option, like the gate's `AUDIT`);
  2. copies `node_modules/bootstrap/scss/**` to `<tmp>/corpus/` renaming every
     `.scss` to `.uxdsl` (partials keep their `_`); 96 files;
  3. compiles `corpus/bootstrap.uxdsl` with `compile()` of the package under
     test (the repository build, or the installed tarball when run from the
     gate), `includeTheme: false` until MIG-B9-20 removes the option, no
     theme;
  4. compiles `node_modules/bootstrap/scss/bootstrap.scss` with plain Dart
     Sass (`style: 'expanded'`);
  5. asserts the two outputs are byte-identical; prints sizes, the median of
     three timings for each, the count of deprecation warnings by id, and the
     number of loaded files (87);
  6. adds `corpus/_uxdsl-extras.uxdsl` (§7.4) and an entry that imports it,
     compiles with the default theme, and asserts Bootstrap's part is a
     byte-identical prefix and the extras compile to the expected tokens
     (`.card-x { padding: var(--uxdsl__density__4) …`, the `@ds-button` per
     `$theme-colors` entry);
  7. exits 1 on any difference, printing the first 10 differing lines.
  Flags: `--keep` (leave the temp dir), `--sass <path>` (a Sass to compare
  against; default the repository's own).
- **C7 — Green CI while the implementation is pending.** Every new test that
  cannot pass before MIG-B9-13 is declared with `test.todo(...)` (node:test
  runs it and reports it without failing the suite); MIG-B9-13 flips them to
  `test(...)`. The old `scss-subset.test.js` and `scss-expansion.test.js`
  keep running until MIG-B9-13 deletes them. The corpus fixture is not wired
  into the gate here (MIG-B9-13 wires it as `S-1`).

Must stay byte-identical: everything (no source change).

## 6. Out of scope

- The implementation: MIG-B9-11 to 14.
- Parity oracles: MIG-B9-13 re-records them with the reviewed diff.
- Performance budgets as tests: written here as todo (`sass-pipeline.test.js`:
  "the corpus pipeline is at most 1.5× plain Sass"), measured in MIG-B9-13.

## 7. Approach and traps

### 7.1 Recording the matrix

The expectation of a Sass-valid case is Dart Sass's expanded output of the
source **after** UXDSL constructs are resolved by the plugin — so the recorder
cannot simply call Sass on a source that contains `palette(primary.main)`
(Sass fails on the dotted key). Record in two groups: pure-Sass sources →
Sass's output literal; sources with UXDSL constructs → today's `compile()`
output (the UXDSL semantics are not changing). A source that mixes both
(`interact-*`) is recorded by hand from the two parts and marked `reviewed`.
Keep `normalize()` from the old test so literals stay comparable.

### 7.2 The protect/restore cases (normative list)

Ids and intent; sources and expectations are in the cases file. Each case's
expectation is what the end-to-end pipeline must produce.

- Strings: S1 token text inside a string stays text; S2 parentheses inside a
  string; S3 directive text inside a string; S4 escaped quote; S5
  interpolation inside a string.
- Comments: C1 block comment holding a token call stays; C2 line comment is
  dropped (Sass drops `//`); C3 block comment holding `@ds-*` with `$var`
  stays verbatim; C4 comment opener inside a string; C5 trailing comment
  after a token.
- Nested parentheses: N1 token inside `color-mix()`; N2 inside `calc()`; N3
  tokens inside breakpoint functions; N4 alpha as a Sass expression
  (`math.div(1, 2)`); N5 two shadow layers, two tokens; N6 Sass `if()`
  choosing between tokens.
- Interpolation: I1 interpolated family `palette(#{$t}.main)`; I2 `@each`
  with interpolated selector and family; I3 token call inside `#{}`; I4 key
  from a quoted `$var`; I5 `calc` with `#{$g * 2}`; I6 family and variant
  both interpolated.
- `url()`: U1 unquoted with `//`; U2 quoted holding token text; U3 unquoted
  holding token text is a Sass error (`Expected digit`).
- Directive parameters: D1 `$vars` in `@ds-surface` from `@each` over a map;
  D2 already interpolated; D3 `$var` inside `radius()` override; D4 module
  variable `m.$e` reaches the directive and fails as the directive's own
  argument error; D5 a space before `(` compiles (DEC-01: Sass itself writes
  the space, so the grammar accepts it); D6 uppercase directive name; D7 `)`
  inside a comment in params; D8 multi-line params with `$var`; D9 `@ds-typo`
  from a mixin parameter; D10 directive inside `@media` inside a rule (Sass
  bubbles; compiles).
- Maps: M1 tokens as map values with `map.get`; M2 `@each $k, $v` over a map
  of tokens.
- `!important`: IM1 token + `!important`; IM2 responsive + `!important`.
- Multi-line: ML1 multi-line value; ML2 token call split across lines.
- Native color functions, never touched: NC1 `color(display-p3 …)`; NC2
  `color(srgb … / a)`; NC3 `color(from <token> …)`; NC4 `rgb(from <token> …)`;
  NC5 standalone `color(white)`; NC6 `color(black, 0.5)`; NC7
  `color(gray.900)`; NC8 `palette(primary)` without a dot.
- Keys: K1 `space(0-5)`; K2 `space(10-2)`; K3 `palette(brand.100)`; K4
  uppercase key `color(Gray.900)`; K5 uppercase name `PALETTE(primary.main)`.
- Other: O1 `@uxdsl theme;` passes through Sass; O2 `@function space`
  wins over the token: Sass's output and the `UXD_FUNCTION_SHADOWED` warning (DEC-17);
  O3 `@function md` → the same;
  O4 a mixin named `border` is allowed; O5 `tone()` outside a theme →
  `UXD_TONE_CONTEXT`; O6 `$var` holding a token; O7 a mixin argument holding a
  token; O8 `@keyframes` with tokens; O9 pseudo-class and placeholder
  selectors named like tokens.

### 7.3 The source-map fixture (verbatim)

`heavy.uxdsl`:

```scss
@use "sass:map";
@use "./mixins" as m;

$tones: (primary: 1, secondary: 2);
$gutter: 16px;

%reset { margin: 0; }

.card {
  @extend %reset;
  @include m.card(primary);
  .icon { width: $gutter * 2; color: palette(primary.main); border-color: palette(secondary.main, 0.5); }
  @each $t, $n in $tones {
    &--#{$t} { @ds-button(contained $t $n); }
  }
  &__body {
    @media (min-width: 600px) {
      padding: density(2); margin: space(1); outline: border(1); inset: space(404);
    }
  }
}
```

`_mixins.uxdsl`:

```scss
// Partial: mixins that use UXDSL inside Sass constructs.
@use "sass:math";

@mixin card($tone, $size: 2) {
  @ds-surface(outlined $tone $size);
  gap: xs(math.div(16px, 2)) md(16px);
  &__title { @ds-typo(h3); color: palette(#{$tone}.main); }
}

@mixin broken-pad {
  padding: density(99);
}
```

Expected positions: `inset: space(404)` is line 18, column 66 (1-based, the
`i` of `inset`); `padding: density(99)` is `_mixins.uxdsl` line 11, column 3.

### 7.4 The mixed extras (verbatim)

```scss
// UXDSL constructs mixed with Bootstrap's own Sass variables, functions and mixins.
.card-x {
  padding: density(4);
  color: palette(primary.main);
  border: 1px solid palette(primary.main, 0.5);
  margin: xs($spacer * .5) md($spacer);
  max-width: xs(100%) md(map-get($container-max-widths, md));
  @include media-breakpoint-up(md) { gap: space(3); }
  &__title { @ds-typo(h2); color: color(gray.900); }
  &--raised { box-shadow: shadow(2); border-radius: radius(2); }
}

// A Surface directive inside a mixin, called from @each over Bootstrap's $theme-colors.
@mixin x-tinted-surface($value) {
  @ds-surface(contained);
  border-color: $value;
  --x-tint: #{tint-color($value, 80%)};
}
@each $name, $value in $theme-colors {
  .surface-#{$name} { @include x-tinted-surface($value); }
}

// A Sass variable inside a directive's arguments: Bootstrap's names mapped to UXDSL palette families.
$x-tones: (primary: primary, secondary: secondary, success: success, info: info, warning: warning, danger: error);
@each $name, $tone in $x-tones {
  .btn-x-#{$name} { @ds-button(contained $tone 2); }
}
```

### 7.5 Traps

- The corpus importer must follow Sass's resolution exactly (partials, index
  files, the `.import` suffix for `@import`); the prototype's `resolveImportPath`
  reproduced `lib/src/importer/utils.dart`. MIG-B9-12 owns the real one; the
  fixture only calls `compile()`.
- A `var(--bs-…)` inside the same declaration as a UXDSL token fails the
  reference pass (`UXD_REFERENCE_MISSING`) unless declared in
  `references.externalTokens`; the extras avoid that mix on purpose, and
  the fixture asserts the failure separately as a documented behavior.
- Stop rule: a case whose Dart Sass output you cannot explain is not
  recorded; it is listed in §15 for MIG-B9-13.

## 8. Tests

All new, all `todo` until MIG-B9-13 except where noted.

| Id | File | Title | Level | Proves |
| --- | --- | --- | --- | --- |
| T1 | `test/core/sass-matrix.test.js` | `MIG-B9-10: sass matrix: <name>` ×110; `the matrix has 110 cases and its errors are exactly the invalid-Sass sources` | unit | C2 |
| T2 | same | `MIG-B9-10: every recorded Sass expectation equals live Dart Sass` (runs now, not todo: it compares literals with `sass`) | unit | C2 |
| T3 | `test/core/protect.test.js` | `MIG-B9-10: protect/restore end to end: <id>` ×63 | unit | C3 |
| T4 | `test/core/sass-source-maps.test.js` | `MIG-B9-10: a UXDSL error in a Sass-heavy file is reported at heavy.uxdsl:18:66`; `… inside a @use'd mixin at _mixins.uxdsl:11:3`; `a Sass error keeps its exact column`; `the final map names the original files with their content` | unit | C4 |
| T5 | `test/core/sass-pipeline.test.js` | `@use "sass:math" compiles`; `@use of a .uxdsl partial, an index file and a sub-directory partial`; `@use of a .scss and of a .css next to .uxdsl`; `@import of a .uxdsl works and reports UXD_SASS_WARNING [import]`; `@import "x.css" with its extension stays a CSS @import`; `a missing @use fails as UXD_SASS naming the importing file and line`; `a @use loop fails as UXD_SASS`; `pkg: imports resolve a package's scss`; `a bare package path resolves through node_modules`; `@function space() is UXD_RESERVED_NAME at its line`; `@ds-surface (contained) with a space compiles`; `$var inside @ds-button(…) is substituted`; `dependencies lists the entry first and every loaded file`; `compile({ source, from }) resolves relative loads from a from that does not exist on disk`; `deprecation warnings are reported once each and silenceDeprecations removes them`; `the corpus pipeline is at most 1.5× plain Sass` | unit | C5 |
| T6 | `fixtures/sass-corpus/run.js` | prints `byte-identical: true` and the figures | fixture | C6 |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/core/sass-matrix.test.js` exits 0
  with 110 todo and T2 passing; `node --test packages/uxdsl/test/core/protect.test.js`
  exits 0 with 63 todo; the source-map and pipeline tests exit 0 with every
  case todo.
- **AC2** `node fixtures/sass-corpus/run.js` runs to the comparison and exits
  1 on the base (today's compile() rejects `@use`), printing the first
  difference; `--help` describes its flags.
- **AC3** `npm test` exits 0 (todo tests do not fail it).
- **AC4** `test/core/sass-matrix.record.js --update` regenerates the cases
  file without a diff when run twice.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | no (no behavior change) |
| package README | yes (the guard asks for it on a `package.json` change: one sentence under "Install" saying `sass` arrives as a dependency in beta.9) |
| everything else | no |

## 11. Documentation

`fixtures/sass-corpus/README.md` (what it proves, flags, network), one
sentence in `packages/uxdsl/README.md`.

## 12. Verification

```bash
node --test packages/uxdsl/test/core/sass-matrix.test.js packages/uxdsl/test/core/protect.test.js packages/uxdsl/test/core/sass-source-maps.test.js packages/uxdsl/test/core/sass-pipeline.test.js   # exit 0, todo counts as described
node fixtures/sass-corpus/run.js   # exit 1 on the base, with the first difference printed
npm test                           # background; exit 0
```

## 13. Delivery

Branch `feat/b9-10-superset-tests`. Commit:
`test(FEAT-010): MIG-B9-10 - the superset's tests first: Sass matrix, protect cases, source maps, pipeline behaviors, Bootstrap corpus`.

Delivered in two PRs (§14): part 1 on that branch (PR #34), part 2 — C1 and
C2, which needed the npm registry — on `feat/b9-10-superset-tests-part2`.

## 14. Closure record

Two PRs: part 1 (PR #34, 2026-10-11, C3–C7 without the registry; its record is
in §15 "Part 1") and part 2 below, which completes the story (C1 and C2, and C6
run for the first time).

### Part 2 (2026-10-29, a session with npm registry access)

- **Base:** `feat/beta9` at `0c9fbf6` (MIG-B9-02's lockfile refresh and
  MIG-B9-04's `UXD_FUNCTION_UNKNOWN` included). **Branch:**
  `feat/b9-10-superset-tests-part2` (§13 names part 1's branch, already
  merged). **PR:** #46.
- **Environment:** macOS (Darwin 27.0.0, Apple Silicon), Node 20.19.0, npm
  11.21.1 (CI: `node-version: 20` + `npm install -g npm@11`), Google Chrome at
  the macOS default path. The worktree prepared exactly as `ci.yml` does
  (README §1.3): every step exit 0 (`mig07-consumer`: `All checks passed`).
- **Preconditions** (§3): as written on the base, line 2 (`test ! -d
  fixtures/sass-corpus`) exited 1 — part 1 created the directory; a stale
  precondition, corrected in §3 (old and new lines in §15), not a moved base.
  Line 3 read the owner's checkout (the review of 2026-10-11 had flagged it);
  corrected to this worktree's playground copy. Lines 1, 3 and 4: exit 0; the
  corrected block: exit 0 on every line.
- **Baseline** (§4): `node --test test/core/scss-subset.test.js` → 112 pass,
  0 fail; the tally is `ok 69, error 41`, exactly as recorded.
- **C1:** `npm install -D sass@^1.107.0 --ignore-scripts` in `packages/uxdsl`
  (the current release, published 2026-10-28): resolved **`sass@1.107.0`**;
  `added 10 packages` — `sass`, `immutable`, `@parcel/watcher` (optional, with
  its 12 platform packages), `detect-libc`, `node-addon-api`, `is-glob`,
  `is-extglob`, and `sass`'s own `chokidar`/`readdirp` nested under it (409
  lockfile lines added, lockfile v3 from npm 11). `npm audit` in
  `packages/uxdsl`: **`found 0 vulnerabilities`**, exit 0 — MIG-B9-02's
  `AUDIT-lock` gate check keeps holding. DEC-04: MIG-B9-12 moves it to
  `dependencies`.
- **C2, the matrix** (`sass-matrix.cases.js`, `sass-matrix.record.js`,
  `sass-matrix.test.js`): 110 cases, same names and sources as
  `scss-subset.test.js` (a test pins it while that file exists). Groups: **75
  `sass`** (no UXDSL construct; Dart Sass's own output, recorded by the
  recorder — 73 compile, **2 are invalid Sass**, `expectedErrors = 2`:
  `arith-03-unit-mismatch` "1rem and 2px have incompatible units.",
  `ctrl-09-each-over-map-single-var` "expected selector." — a map's (key value)
  pairs interpolated into a selector), **20 `today`** (`sass-tol-*`,
  `interact-*`, `interp-03`, `interp-05`, `modern-08/10/11/12`: today's
  `compile()` output after `normalize()`, recorded from the current build;
  Dart Sass is structurally a no-op on them), **15 `mixed`** (Sass flattens or
  protect is needed: `nest-09…12`, `mixin-04…08`, `mixin-11…13`, `ctrl-07`,
  `import-03`, `interp-01`; recorded by hand from the two parts — Dart Sass on
  the hand-protected source, then today's plugin on Sass's output — each with
  a note, marked `reviewed`). Compared with the old matrix: 69 → **86 cases
  compile** (`ok`), 41 → **24 fail** (2 `UXD_SASS`, 22 UXDSL codes: the 2 old
  UXDSL errors `modern-11` and `mixin-08` keep their codes; every
  `UXD_SCSS_UNSUPPORTED`/`UXD_NESTING_INVALID`/`postcss-import` case becomes
  Sass's output or `UXD_SASS`). Expectations that change with the pipeline
  are listed in §15 for MIG-B9-13. No case defines a shadowing `@function`
  (`fn-01` defines `double`), so DEC-17 touches none of the 110. The stop rule
  was not triggered: every Sass output is explained in its case's `note`
  (`#{$i}0%` → `10 %`, `darken()` → `rgb(…%)` since Dart Sass 1.79, a `.css`
  `@import` kept, `10px/2` kept as a separator).
- **AC4:** `node test/core/sass-matrix.record.js --update` twice → the second
  run prints `sass-matrix.cases.js is up to date (110 cases, 2 invalid-Sass
  sources, sass 1.107.0)`, exit 0; without `--update` it exits 1 on drift,
  naming each case.
- **C6, first run** (`node fixtures/sass-corpus/run.js`, network): `--help`
  exit 0 with the flags; the run installs `bootstrap@5.3.8`, renames **92**
  files, compiles the original with the repository's own Dart Sass (found
  through the corrected `loadSass`: **1.107.0**, 276,926 bytes, median 399 ms)
  and stops before the comparison, as predicted: `byte-identical: false —
  compile() failed: postcss-import: …/corpus/bootstrap.uxdsl:1:1: Failed to
  find 'mixins/banner'`, **exit 1**. The expected state of this base, not a
  pass (AC2). The README's wording ("rejects `@use`") was corrected to what
  happens first.
- **Commands** (every one ran locally):

  | Command | Exit | Output |
  | --- | --- | --- |
  | `(cd packages/uxdsl && npm audit)` | 0 | `found 0 vulnerabilities` |
  | `node --test packages/uxdsl/test/core/sass-matrix.test.js` (AC1) | 0 | **117 tests: 6 pass, 0 fail, 111 todo** — 110 case tests through `compile()` plus the tally through `compile()` are `todo` (§8: all todo until MIG-B9-13); passing now: the static tally (`CASES.length === 110`, `expectedErrors` = the `UXD_SASS` cases, 75/20/15), the names-and-sources check, **T2** `every recorded Sass expectation equals live Dart Sass`, its negative control, `every recorded Sass CSS is valid CSS with no Sass construct left`, and `every "today" expectation is what compile() produces today, byte for byte` |
  | `node --test packages/uxdsl/test/core/scss-subset.test.js packages/uxdsl/test/core/scss-expansion.test.js` (C7) | 0 | 124 pass, 0 fail, 0 todo — kept until MIG-B9-13 |
  | `node packages/uxdsl/test/core/sass-matrix.record.js --update` ×2, then without the flag (AC4) | 0, 0, 0 | second run and check: `up to date` |
  | `node fixtures/sass-corpus/run.js --help` / `node fixtures/sass-corpus/run.js` (AC2) | 0 / 1 | above |
  | `npm run verify:doc-examples` | 0 | 49 examples and 24 theme excerpts across 101 files |
  | `node scripts/generate-language-artifacts.js --check` | 0 | no-op |
  | `node scripts/generate-agent-guide.js --check` | 0 | no-op |
  | `npm test` (AC3), background with a log | 0 | 1,381 `ok`, 0 failures outside `todo`, 196 `todo` (this part's 111 among them) |
  | `npm run verify:1.0`, background with a log | 0 | `66/66 automated checks passed`; `AUDIT ok — 0 critical, 0 high, 0 moderate, 0 low`; `AUDIT-lock ok — 0 critical, 0 high, 0 moderate, 0 low` (with `sass` in the lockfile); `N-03`, `N-04`, `cssmod` (Chrome), `contrast`, `B7-16`, `B7-17` ok |
  | `npm run verify:playground-browser` (real Chrome, one run) | 0 | `PASS`: 380 pages loaded, 2,218 focusable elements checked, no console errors, no UXDSL warnings, no unresolved `var()`, visible keyboard focus, contrast page = Node; 1,532 hosting-only 404s exempted and listed; the planted negative controls (`undefined-var`, `console-error`, `no-focus`, `contrast-mismatch`, `overflow`, `paradigm-mismatch`) all caught |

- **Negative controls, encoded:** `… equals live Dart Sass (negative control)`
  plants a wrong CSS literal, a wrong Sass message and CSS expected of a
  source Sass rejects, and asserts each is noticed; the recorder refuses a
  `sass`-group source that holds a UXDSL construct and an unreviewed `mixed`
  case (`expectationFor`); of the 110 todo case tests, **58 fail today** (51
  of the 75 `sass` cases, 7 of the 15 `mixed` ones — the flattened and the
  interpolated) and 52 pass (24 `sass`, all 20 `today`, 8 `mixed`), plus the
  tally through `compile()`; node:test reports them as `# TODO`, which is the
  failing-test-first evidence MIG-B9-13 turns green.
- **Guards (§10):** `package.json` changed → one sentence in
  `packages/uxdsl/README.md` (appended to part 1's paragraph on the pending
  pipeline tests rather than under "Install", because `sass` is not yet
  something a consumer installs — MIG-B9-12 updates "Install" when DEC-04
  lands); `packages/uxdsl/CHANGELOG.md` gained an append-only subsection under
  `## 0.5.0-beta.9 — unreleased` stating there is no output impact; no file
  under `packages/uxdsl/src` was added, so `scripts/verify-docs-update.js` is
  untouched; `generate:language` and the agent guide are no-ops.
- **Not run / not PASS:** nothing of the story's §12 was skipped. The corpus
  comparison itself (`byte-identical: true`) cannot pass on this base and is
  not claimed. CI's run of the PR is the evidence the lockfile installs on
  `ubuntu-latest`.
- **Owner steps pending:** merge of the PR into `feat/beta9` by the agent once
  CI is green (README §6); the wave-1 review.

## 15. Findings and follow-ups

### Part 2 (2026-10-29)

- **Preconditions corrected** (README §1.4; recorded here, old → new). Line 2:
  `test ! -d fixtures/sass-corpus` → `test -f fixtures/sass-corpus/run.js &&
  test -f packages/uxdsl/test/core/protect.cases.js && test ! -f
  packages/uxdsl/test/core/sass-matrix.cases.js` (part 1 created the
  directory; the new line asserts part 1 is merged and part 2 not started).
  Line 3: `node -e "require('/Users/ricardosantoyo/Documents/projects/uxdsl/packages/playground-nextjs/node_modules/sass/package.json')"
  2>/dev/null || npm view sass version >/dev/null` → `test -f
  packages/playground-nextjs/node_modules/sass/package.json || npm view sass
  version >/dev/null` (it read the owner's checkout, the review's last
  finding; it now reads the worktree's own copy).
- **Expectations that change with the pipeline** — recorded in the matrix,
  listed here so MIG-B9-13 (the CHANGELOG's "Visual changes") and MIG-B9-15
  (the migration guide) name them for authors of today's `.uxdsl` files:
  nesting flattens (`nest-01…12`, `mixin-07`, `mixin-09`: `.a .b`, `.a:hover`,
  `.a-suffix`); an `@import` whose URL ends in `.css` stays a CSS `@import`
  (`import-04`, `import-05`) where postcss-import inlined the file or failed —
  the same rule `sass-pipeline.test.js` pins for `"x.css"`; `#{$i}0%` is the
  string `10 %` (`ctrl-05`), not `10%`; `darken()`/`lighten()`/`color.adjust`
  results are serialized as `rgb(…%)` with non-integer channels (Dart Sass
  ≥ 1.79); `10px / 2` is kept as `10px/2`; `'<length>'` is written
  `"<length>"`; `rgba(0,0,0,.5)` is written `rgba(0, 0, 0, 0.5)`; `#{density(2)}`
  and `#{palette(primary.main)}` compile. Proposed for MIG-B9-13 and
  MIG-B9-15.
- **`normalize()` and the `today` group.** The 20 `today` literals carry the
  subset's own raws (`.a { padding: 1px; }@media (min-width: 768px) {.a {
  padding: 2px; } }`), which `normalize()` keeps. The pipeline's plugin runs
  on Sass's expanded output, so its raws around `{`/`}` may differ while the
  declarations are the same; if the byte-for-byte pin then fails on whitespace
  only, MIG-B9-13 should compare through a punctuation-insensitive `flat()`
  (as `protect.test.js` does) rather than re-record, and say so. Proposed for
  MIG-B9-13.
- **The recorder re-records `today` from the current build.** `--update`
  writes the `today` group from whatever `compile()` produces, so run after
  MIG-B9-13 it would silently accept a changed output. MIG-B9-13 should flip
  the group to `reviewed` (or compare it against the committed literals) in
  the same change that deletes `scss-subset.test.js`. Proposed for MIG-B9-13.
- **`UXD_SASS` must carry Sass's message verbatim.** The todo case tests
  assert `compile()`'s error message includes the recorded `sass` text
  (`error.sassMessage`, e.g. "1rem and 2px have incompatible units."), the
  plan's §9.2 contract. For MIG-B9-12.
- **Bootstrap's file count.** C6.2 and FEAT-010 README §9 say 96 `.scss`
  files; `bootstrap@5.3.8`'s `scss/**` holds 92 (the runner renames 92, as
  MIG-B9-04's run also saw). Proposed for MIG-B9-13, which wires the corpus
  into the gate, to reconcile the number (the "87 loaded by the entry" figure
  is reported by the runner once the comparison runs).
- **Dart Sass's output for Bootstrap moved between versions:** 273,591 bytes
  with 1.94.2 (MIG-B9-04's run), 276,926 with 1.107.0. The corpus compares the
  same Sass on both sides, so this is not a defect; the plan's §9 timings and
  sizes were measured on 1.94.2. For MIG-B9-13's record.
- **A stale package name in a case source:** `import-05-node-modules` imports
  `postcss-uxdsl/theme/default-colors.css`, a package and file that no longer
  exist; the source is kept by contract (same names and sources). Its
  expectation does not depend on them (a `.css` URL stays a CSS `@import`).
- **The `-part2` branch.** §13 names `feat/b9-10-superset-tests`, which part 1
  used and merged; part 2 was delivered from
  `feat/b9-10-superset-tests-part2` (noted in §13).

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **The case list is not in the repository.** The 63 protect/restore cases, the tokenizer prototype and its `lib.js` are referred to as normative, but `docs/audits/2026-10-09-sass-layer/` holds only the regex prototype. Commit them (as `test/core/fixtures/protect-cases.js` or under the audit folder) before MIG-B9-11, or 11 T6's control cannot be checked.
- The source-map fixture is incomplete: no `c: $undefined`, `m.broken-pad` is never included (so Sass never emits it), and the "successful map" assertion expects `space(4)` while the file has `space(404)`.
- §7.1 "UXDSL cases → today's `compile()` output" is wrong for every case that also nests (nest-09…12, mixin-07): Sass flattens. Record Dart Sass's output for those.
- C6.6: with the theme emitted, Bootstrap's output is not a prefix of the result; compare with `includeTheme: false` or strip the theme run.
- A precondition reads the owner's checkout or another agent's worktree, against README §1.2; use only files in the repository.

### Part 1 (2026-10-11, a session without npm registry access)

Delivered: C3 (the 63 protect/restore cases and their end-to-end test), C4
(the source-map fixture and its tests), C5 (the pipeline behaviors), C6 (the
Bootstrap corpus script, its extras file and README). Not delivered, because
they need Dart Sass installed: **C1** (`sass` as a devDependency; the lockfile
cannot be regenerated without the registry) and **C2** (the 110-case matrix
re-recorded from live Dart Sass, `sass-matrix.*`). The story stays In
progress until a session with the registry does C1 and C2.

- **C3, the expectations.** The prototype's cases file was never committed (the
  review of 2026-10-11), so the cases were written from §7.2's intents. Most
  expectations are stated as `{ sameAs: <plain UXDSL> }`: the pipeline's output
  must equal what the UXDSL plugin alone produces for the case written without
  Sass, which pins UXDSL's semantics without restating generated CSS by hand.
  CSS literals are used only where the case is plain CSS. Twelve cases carry a
  `verify` note — a Dart Sass behavior this list was written without running
  Sass on (S4 re-quoting, C5 comments in values, N6 `if()`, U3, D4, D7, NC3–NC6,
  and O2/O3, which depend on DEC-17). MIG-B9-13 confirms each against live
  Sass before flipping it from `todo`, and records any expectation it changes.
- `flat()` normalizes whitespace around `{ } ; ,` as well as runs of
  whitespace (the prototype collapsed runs only): Sass's expanded layout and
  the plugin's media blocks differ in spacing around braces.
- **C4.** `heavy.uxdsl` and `_mixins.uxdsl` are verbatim. Three small fixtures
  close the gaps the review found: `ok.uxdsl` (heavy with `space(4)`, for the
  successful map), `uses-broken.uxdsl` (calls `m.broken-pad`, which heavy never
  includes) and `sass-error.uxdsl` (`$undefined` at 4:18). A test that runs now
  pins the four positions.
- **C5.** `silenceDeprecations` is assumed to be a `compile()` option; MIG-B9-12
  owns its name.
- **C6** was not run (no registry). On the base it should stop at the
  comparison with "compile() failed" (today's `compile()` rejects `@use`) and
  exit 1; the extras compile uses `includeTheme: false`, so the prefix check is
  exact (the review's C6.6 finding).

### Owner decisions of 2026-10-23 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#2-decisions). Where they differ from this story's contract or from the review above, they rule.

- **DEC-17:** a project `@function` named like a UXDSL function wins, with a warning. O2 and O3 in `test/core/protect.cases.js` now expect Sass's output and `UXD_FUNCTION_SHADOWED` (a case may carry `warning: '<code>'`), so ten cases carry a `verify` note, not twelve. In `sass-pipeline.test.js` the `UXD_RESERVED_NAME` case became three `todo` cases: the warning at the definition's line, a `.scss` partial loaded with `@import` (found, not silent), and a helper reached only through a namespace (shadows nothing).
- **DEC-04:** C1 still adds `sass` as a devDependency for the tests; MIG-B9-12 moves it to `dependencies`. Both need a session with npm registry access.
