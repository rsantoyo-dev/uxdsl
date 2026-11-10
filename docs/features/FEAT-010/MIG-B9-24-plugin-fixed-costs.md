# MIG-B9-24 — The plugin's fixed per-build costs

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | None (registered by decision D3 of 2026-11-04, as proposed in MIG-B9-23 §15). Four questions for the owner are open in §15 and are answered before implementing; the contract states what it assumes until then |
| Status | Ready |
| Size | S |
| Depends on | MIG-B9-20, MIG-B9-21 |
| Blocks | — (under §7, MIG-B9-30 to 35 and MIG-B9-37 wait for it) |
| Base | `feat/beta9` after MIG-B9-20 and after MIG-B9-21, within §7 (it also waits for MIG-B9-27, which edits `plugin.ts` from an earlier row of §5). Drafted on `f855765`; §3 and §4 are re-run on BASE when the story starts |
| Owns | `packages/uxdsl/test/plugin-work-per-compilation.test.js` (new) |
| Shares | `packages/uxdsl/src/plugin.ts` (`validateOptions`, `emitTheme`, `expandResponsive`, `checkReferences`), `packages/uxdsl/src/ds-runtime/theme-validate.ts` (the engine pass of `validateTheme`), `packages/uxdsl/src/ds-runtime/theme-generator.ts` (`themeParts`, `renderTheme`), `packages/uxdsl/CHANGELOG.md` (one subsection: `plugin.ts` and `theme-generator.ts` are in the docs guard's `VISUAL_DEFAULT_FILES`), `packages/uxdsl/README.md` (one sentence). This list follows Q1 (b) and Q2 (a) of §15; another answer changes it as §15 says |
| Output impact | none |

## 1. Goal

A compilation does the theme's work once and skips the work that can report
nothing. The theme's engines run once per compilation instead of twice
(once inside `validateTheme`, once to render the theme), the reference pass
inspects nothing when it has nothing to check, and a value with no `(` is not
parsed. Every output, warning and error stays BASE's; the gain is measured
and recorded, not budgeted (§15, Q3).

## 2. Sources

- The registration, decision D3 of 2026-11-04
  ([FEAT-010-beta9.md](../FEAT-010-beta9.md), line 178):

  > **D3 — MIG-B9-24 registered,** "The plugin's fixed per-build costs": S, wave 2, low priority. Proposed in MIG-B9-23 §15.

- The proposal, MIG-B9-23 §15, "By story"
  ([MIG-B9-23-compile-within-budget.md](MIG-B9-23-compile-within-budget.md),
  lines 869 to 903), measured on `7aec3e0`:

  > - **MIG-B9-24 (proposed): the plugin's fixed per-build costs.** Size S. It
  >   edits `plugin.ts`, and for some candidates `compile.ts`,
  >   `ds-runtime/theme-validate.ts` and `ds-runtime/theme-generator.ts`. §7
  >   therefore puts it after MIG-B9-20 and MIG-B9-21, in wave 2 or after wave 3
  >   (where MIG-B9-32 to 34 also edit `theme-validate.ts`).
  >   - **The cost:** a `compile()` of a one-rule input takes 19.5 ms with
  >     `includeTheme: false` and 24.6 ms with `true`. The PostCSS pass alone
  >     takes 18.5 and 23.6 ms, and 8.65 ms with references `'off'`. Every module
  >     a Vite or webpack build compiles pays it.
  >   - **Inside one `compile()` of the corpus:** `checkReferences` takes 20.9 ms
  >     (`renderThemeCss` 12.6, `enforceReferences` 7.5), `validateTheme` 13.2,
  >     and `expandResponsive` 13.2. GC takes 31–33 ms per run, against 19.8 for
  >     plain Dart Sass.
  >   - **The output-free candidates:**
  >     - skip the reference pass when it can report nothing (no consumer, no
  >       `references.css`, no `externalTokens`): 29–30 ms on the corpus, a
  >       2-line prototype;
  >     - skip a value with no `(` in both walks of `expandResponsive`:
  >       11.5–12.6 ms, a 3-line prototype.
  >
  >     Both combined prototypes include them. Every package suite and the
  >     parity oracles equal the unmodified copy in both, except one core test
  >     in combo, MIG-B9-12's `sourceMapIncludeSources` option test, which its
  >     `sourcesContent` change fails (§7, item 1).
  >   - **The estimated ones:**
  >     - render the theme once per compilation and share it with
  >       `validateTheme`: 8.5–13 ms. `validateTheme` is public, so its errors,
  >       warnings and bytes must not move;
  >     - parse each value once: 5–10 ms. `postcss-value-parser`'s self time
  >       under `expandResponsive` is 7.7 ms per run, and 16.3 ms under the
  >       theme's engines (§4's profile).
  >   - **Gated on the owner:**
  >     - the stage map only when a map is requested (MIG-B9-13's flag 2): 52 ms;
  >     - Dart Sass's map without `sourcesContent` (MIG-B9-12's M1 and its
  >       options test): 26–31 ms.

- MIG-B9-23 §6 (lines 362 to 368):

  > - **The plugin's fixed per-build costs:** the reference pass on a stylesheet
  >   with no consumer, each value parsed three times, the theme rendered twice,
  >   `validateTheme`. Proposed as MIG-B9-24, after MIG-B9-20 and MIG-B9-21,
  >   which rewrite the same functions of `plugin.ts` (§7, §15).
  > - **The always-on stage map and its `sourcesContent`:** MIG-B9-13's owner
  >   flag 2 and MIG-B9-12's M1, both the owner's. If the owner changes either,
  >   the candidates go to MIG-B9-24 (§15).

- MIG-B9-23 §15, its delivery of 2026-11-09, new fact 7 (line 1040):

  > 7\. **A forced full GC before each `compile()`** made it about 45% slower (median 625 against 428 ms) and widened the spread. It is not a lever for MIG-B9-24.

  and its follow-up (line 1082):

  > - **MIG-B9-24.** The plugin's fixed per-build costs are the lever if the margin of new fact 2 shrinks. A forced GC is not (new fact 7).

- The owner's acceptance of the always-on stage map, decision D18 of
  2026-11-04 ([FEAT-010-beta9.md](../FEAT-010-beta9.md), line 193), of which
  flag 2 is "P1 as built (RR-4)", the stage "called with `sourceMap: true` on
  every build" (MIG-B9-13, line 628):

  > **D18 — MIG-B9-13's owner flags 2, 3, 4, 5, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18 and 19 are accepted as delivered**

  and MIG-B9-12's M1 ([MIG-B9-12-compile-sass.md](MIG-B9-12-compile-sass.md),
  lines 147 to 148): "With `sourceMap: true`, Sass runs with
  `sourceMap: true, sourceMapIncludeSources: true`".
- The statistic, decision 4 of 2026-11-09
  ([FEAT-010-beta9.md](../FEAT-010-beta9.md), line 262), recorded for
  MIG-B9-91 in its §15 (line 190):

  > **Decision 4 — T3's statistic (flag 4).** The budget fixture keeps the difference of the two medians, with 61 rounds by default (C2 allows at least 9). MIG-B9-91 decides whether T3 also reports a paired statistic, the median of per-round differences. Kept.

- The order, the index ([README.md](README.md), lines 261 to 269 and 364
  to 369):

  > MIG-B9-25 is early in wave 2 and MIG-B9-24 is low priority (decisions D2
  > and D3), so their rows are the first and the last of the wave-2 stories
  > registered on 2026-11-04. […] And MIG-B9-24, the last row before wave 3, makes
  > MIG-B9-30 to 35 and MIG-B9-37 wait for it (`plugin.ts`, `theme-validate.ts`,
  > `theme-generator.ts`); only MIG-B9-36 does not, and neither do MIG-B9-38 and
  > 39, registered on 2026-11-08.

  and, of the §7 table:

  > The rows that name MIG-B9-24 to 29, 37 and 92 come from their proposals, […]
  > they are provisional:
  > each story file states its Owns and Shares, and this table follows them
  > before the story starts.

- The rule the change keeps, README §2 (lines 46 to 49): "No parallel parser,
  no duplicated default, no process-global cache."
- The code on `f855765`, `packages/uxdsl/src/`:
  - `plugin.ts:137`, in `validateOptions`, the validator with its engines:
    `const validated = validateTheme(theme, { references: false });`
  - `plugin.ts:547`, in `emitTheme`, the theme rendered and parsed:
    `const parsed = inheritSource(postcss.parse(renderThemeCss(c.theme, c.bps)), undefined);`
  - `plugin.ts:946` to `951`, in `checkReferences`, the consumers and the
    render when the theme is not emitted:
    `if (!c.originalSources.has(node.source) || c.dslSources.has(node.source)) consumers.push(node);`
    and
    `if (!c.themeEmitted && c.references.mode !== 'off') css.push(renderThemeCss(c.theme, c.bps));`
  - `plugin.ts:831` to `834`, the first walk of `expandResponsive`:
    `if (typeof decl.value !== 'string' || c.generated.has(decl)) return;`,
    `checkResponsiveStructure(c, decl);`,
    `const rewritten = rewriteTokens(c, decl.value);`,
    `const parsed = valueParser(rewritten);`; and `plugin.ts:907`, the second:
    `if (typeof decl.value === 'string' && !c.generated.has(decl)) assignValue(decl, rewriteTokens(c, decl.value), (raw) => rewriteTokens(c, raw));`
  - `ds-runtime/theme-validate.ts:349` to `357`, the engine pass, from
    `engine('theme', () => { generateFoundationCss(theme); });` to
    `engine('borders/radii', () => { compileEdgeRules(theme, bps); });`
  - `ds-runtime/theme-generator.ts:21` to `28`, `themeParts`, the same
    engines again, from `families: [` to
    `responsiveBlocks(compileDensityRules(getDensityTokens(theme), breakpoints, (value) => tokenValueToCss(value, theme))),`
  - `reference-integrity.ts:52`, the rendered theme parsed for the check:
    `for (const css of options.css || []) postcss.parse(css).walkDecls((node) => { definitions.push(recordOf(node)); });`
  - `reference-core.ts:174` and `176`: `if (options.mode === 'off') return [];`
    and the `UXD_REFERENCE_CONTEXT: Invalid external token` check, both before
    any consumer is read.
- The tests that already pin what this story keeps:
  - `packages/uxdsl/test/performance/reference-performance.test.js:3`: "It
    asserts a *ratio*, never a millisecond budget"; line 57 captures
    `implementation.enforceReferences = (root, consumers, options) => {`
    from a compilation run with
    `plugin({ includeTheme: true, references: { mode: 'off' } })` (line 62).
  - `packages/uxdsl/test/core/sass-source-maps.test.js:321`: "The theme
    validator lets an unclosed comment through, so the plugin's parse of the
    theme CSS it generates fails."

## 3. Preconditions

```bash
git merge-base --is-ancestor f855765 HEAD                                                                   # the base this story was drafted on
grep -q "const validated = validateTheme(theme, { references: false });" packages/uxdsl/src/plugin.ts       # the plugin runs the validator, engines included
grep -q "postcss.parse(renderThemeCss(c.theme, c.bps))" packages/uxdsl/src/plugin.ts                        # emitTheme renders the theme
grep -q "css.push(renderThemeCss(c.theme, c.bps))" packages/uxdsl/src/plugin.ts                             # so does the reference pass when the theme is not emitted
grep -q "engine('surfaces', () => { compileSurfaceRules(theme, bps); });" packages/uxdsl/src/ds-runtime/theme-validate.ts   # validateTheme runs the engines
grep -q "responsiveBlocks(compileSurfaceRules(theme, breakpoints))," packages/uxdsl/src/ds-runtime/theme-generator.ts      # renderTheme runs them again
grep -q "if (typeof decl.value !== 'string' || c.generated.has(decl)) return;" packages/uxdsl/src/plugin.ts # the first walk of expandResponsive
grep -q "implementation.enforceReferences = (root, consumers, options) => {" packages/uxdsl/test/performance/reference-performance.test.js
test -f fixtures/mig-b9-23-compile-budget/run.js                                                            # the base comparison of §9's AC7
```

All nine exit 0 on `f855765`, run while drafting on 2026-11-10.

The dependency gate. Both lines exit 1 on `f855765`, by design, and exit 0
once MIG-B9-20 and MIG-B9-21 are merged:

```bash
! grep -q "includeTheme" packages/uxdsl/src/types.ts       # MIG-B9-20's M2: the option is gone from the types
test ! -f packages/uxdsl/src/ds-runtime/breakpoints.ts      # MIG-B9-21's K4
```

MIG-B9-20, MIG-B9-21 (K3, K7) and MIG-B9-27 edit `plugin.ts` before this
story starts. A line above that one of them rewrote is only stale (README
§1.4): the agent corrects it here and records the old and new line in §15.

**BASE** is the `feat/beta9` commit the story's branch starts from,
`git merge-base HEAD origin/feat/beta9`, as in MIG-B9-23. Every comparison in
§4, §5, §8 and §9 is against BASE, not against `f855765`.

## 4. Baseline

Run from the repository root, with `TMPDIR` set to a scratch directory. The
script is written to a file because `compile()` cannot run from `node -`
(§15, new fact 6):

```bash
cat > "$TMPDIR/mig-b9-24-baseline.js" <<'EOF'
const path = require('path');
const dist = (file) => path.resolve('packages/uxdsl/dist', file);
const vpPath = require.resolve('postcss-value-parser', { paths: [path.resolve('packages/uxdsl')] });
const vp = require(vpPath);
const keys = ['validateTheme', 'theme renders', 'engine runs', 'reference inspections', 'value parses'];
let n = {};
const parse = function (value) { n['value parses']++; return new vp(value); };
Object.assign(parse, vp); parse.prototype = vp.prototype;
require.cache[vpPath].exports = parse;
const spy = (file, name, key) => { const m = require(dist(file)); const f = m[name]; m[name] = function (...a) { n[key]++; return f.apply(this, a); }; };
for (const [file, name] of [['surfaces.js', 'compileSurfaceRules'], ['buttons.js', 'compileButtonRules'], ['inputs.js', 'compileInputRules'], ['shadows.js', 'compileShadowRules'], ['edges.js', 'compileEdgeRules'], ['language.js', 'compileDensityRules']]) spy(file, name, 'engine runs');
spy('ds-runtime/theme-validate.js', 'validateTheme', 'validateTheme');
spy('ds-runtime/theme-generator.js', 'renderThemeCss', 'theme renders');
spy('reference-core.js', 'inspectDeclarationReferences', 'reference inspections');
const { compile } = require(dist('entries/index.js'));
const from = path.resolve('mig-b9-24-baseline.uxdsl');
const run = async (source, theme = {}) => {
  n = Object.fromEntries(keys.map((k) => [k, 0]));
  const r = await compile({ source, from }, { theme, includeTheme: false });
  return { bytes: Buffer.byteLength(r.css), ...n };
};
const show = (label, r) => console.log(`${label}: ${Object.entries(r).map(([k, v]) => `${k} ${v}`).join(', ')}`);
(async () => {
  await run('.w{padding:density(4)}');
  show('a token, no marker', await run('.card{padding:density(4)}'));
  show('no token, no marker', await run('.card{padding:4px}'));
  show('a token, the marker', await run('@uxdsl theme;\n.card{padding:density(4)}'));
  const one = (await run('.card{padding:4px}'))['value parses'];
  const many = (await run(`.card{${Array.from({ length: 101 }, (_, i) => `--p${i}:${i}px;`).join('')}}`))['value parses'];
  console.log(`value parses for 100 more declarations with no "(": ${many - one}`);
  try { await run('.card{padding:4px}', { palette: { primary: { main: 'red /* oops' } } }); console.log('an unclosed comment in a theme value, no token, no marker: compiles'); }
  catch (e) { console.log(`an unclosed comment in a theme value, no token, no marker: ${e.name}: ${e.message.split('\n')[0]}`); }
})();
EOF
node "$TMPDIR/mig-b9-24-baseline.js"; rm "$TMPDIR/mig-b9-24-baseline.js"
```

`theme: {}` is passed, so no theme file is discovered and the default theme
is used. `includeTheme: false` keeps a compilation without the marker from
emitting the theme on `f855765`; on a base with MIG-B9-20 the option is a
`UXD_OPTION_REMOVED` warning and is ignored, and a compilation without the
marker emits no theme either, so the counts do not depend on it. The six
spied engines are the ones both `validateTheme` and `renderTheme` call by
name.

Recorded on `f855765` on 2026-11-10 at 09:10:11, 09:10:12 and 09:21:12 EST
(three runs, the last one of the block above as extracted from this file;
the same output, exit 0 each, `$TMPDIR` left empty):

```text
a token, no marker: bytes 46, validateTheme 1, theme renders 1, engine runs 12, reference inspections 1, value parses 23001
no token, no marker: bytes 25, validateTheme 1, theme renders 1, engine runs 12, reference inspections 1, value parses 22998
a token, the marker: bytes 47275, validateTheme 1, theme renders 1, engine runs 12, reference inspections 1, value parses 23246
value parses for 100 more declarations with no "(": 400
an unclosed comment in a theme value, no token, no marker: CssSyntaxError: uxdsl: <css input>:2:45: Unclosed comment
```

- **Compared, must match on BASE:** every line. These are counts, not
  timings, so the machine's load does not move them. On BASE, a line that
  differs is a finding (§15), and BASE's lines are the ones §5 and §9 keep.
- **Read:** six engines run twice per compilation (`engine runs 12`), once
  in `validateTheme` and once in `renderThemeCss`; the reference pass
  inspects once even when the stylesheet uses no token; each declaration
  whose value has no `(` is parsed four times; and a compilation that
  neither emits the theme nor uses a token fails on a theme value PostCSS
  cannot parse, because the reference pass parses the rendered theme.

The same counts on the Bootstrap 5.3.8 corpus (92 files renamed, as
`fixtures/sass-corpus/run.js`'s `installCorpus()` makes it, in a scratch
directory), one warm `compile({ entry }, { includeTheme: false })`:
`validateTheme` 1, `renderThemeCss` 1, each of the six engines 2, one
reference inspection, and 44,482 `postcss-value-parser` calls:

- 21,484 are the responsive pass's: `rewriteTokens` 10,742,
  `analyzeResponsiveValue` 5,371 and the rewritten value 5,371
  (`plugin.ts:834`). That is four for each of the output's 5,371
  declarations, of which 1,379 have a `(` in their value.
- 4 are `rejectLineComment`'s.
- 22,994 are the theme's engines', the same number as for a one-rule input:
  `mergePresetTokens` 10,478, `tokenValueToCss` 5,248,
  `resolveResponsiveValue` 4,960, `toneReferences` 1,104,
  `validateResponsiveExpression` 636 and `surfaceValueToCss` 568.

### The profile on `f855765` (indicative)

**Recorded, not compared.** MIG-B9-20's workflow ran `npm test`, builds and
Chrome on this machine at the same time, so every figure below is
indicative only. The load averages are printed with each one. The story's
scout re-measures the profile on BASE, with MIG-B9-20 and MIG-B9-21 merged,
before the implementation starts. The scripts and logs stay in the drafting
run's scratch evidence, outside the repository.

- **The machine:** MacBookPro18,3 (Apple M1 Pro, 8 cores, 16 GB), macOS 27.0
  (26A428). Node 20.19.0, npm 11.21.1, PostCSS 8.5.31,
  `postcss-value-parser` 4.2.0, the worktree's `packages/uxdsl/dist` built
  from `f855765`. No theme file in the project directory: the default theme
  (47,228 bytes rendered).

**V8's sampling profiler,** at a 250 µs interval, started through the
inspector after the warm-up runs, as MIG-B9-23 §4 did. Inclusive time per
run, 09:05:43 to 09:06:06 EST:

| Step | One-rule `compile()`, `.card{padding:density(4)}`, no theme emitted (200 runs, load 15.70) | The corpus's `compile()`, no theme emitted (20 runs, load 21.58) |
| --- | --- | --- |
| Wall time per run | 28.5 ms | 570.5 ms |
| `compileSassStage` | 1.2 | 447.7 |
| `validateOptions` | 11.2 | 15.8 |
| of which `validateTheme` | 11.1 | 14.1 |
| `checkReferences` | 12.2 | 22.6 |
| of which `renderTheme` | 10.9 | 13.7 |
| of which `inspectReferences` | 1.3 | 8.2 (`inspectDeclarationReferences` 6.2) |
| `expandResponsive` | 0.1 | 15.1 (`rewriteTokens` 7.2, `checkResponsiveStructure` 3.1) |
| `rejectSassSyntax`, `expandDirectives`, `rejectLeftoverDirectives` | 0.0 | 1.9, 1.1, 0.5 |
| `postcss-value-parser`, self time | 11.1 | 25.1 |

On a one-rule module, `validateTheme` and the theme render take about three
quarters of `compile()`. Both run the same six engines plus the foundation
and typography ones.

**Timings,** each variant's median over 61 rounds (one-rule) or 21 rounds
(corpus), the variants alternated in rotation within each round, 5 and 3
warm-up rounds left out, 09:13:15 to 09:14:04 EST, load 22.08 at the start,
20.22 after the one-rule rounds, 14.29 at the end:

| Variant | Median (ms) | IQR (ms) |
| --- | --- | --- |
| One-rule `compile()`, a token, no theme emitted | 28.40 | 27.97–29.71 |
| One-rule `compile()`, no token, no theme emitted | 28.49 | 27.88–29.23 |
| One-rule `compile()`, a token, the theme emitted | 33.56 | 32.87–35.73 |
| The PostCSS pass alone on the one-rule input | 27.63 | 26.96–28.60 |
| The same with `references: { mode: 'off' }` | 13.07 | 12.76–13.69 |
| `validateTheme(theme, { references: false })` on the default theme | 12.70 | 12.46–13.09 |
| `renderThemeCss(theme)` on the default theme | 12.77 | 12.49–13.15 |
| `postcss.parse()` of the rendered theme | 0.63 | 0.62–0.65 |
| Plain Dart Sass on `bootstrap.scss` | 329.18 | 314.24–336.13 |
| The corpus's `compile()`, no theme emitted | 448.41 (1.362× Dart Sass) | 437.21–454.95 |
| The PostCSS pass alone on the corpus's Sass stage output | 66.30 | 64.89–68.21 |
| The same with `references: { mode: 'off' }` | 45.75 | 44.98–50.08 |

A first timing pass at 09:04:03 (load 9.14, then 21.22) had IQRs up to
57 ms on the one-rule variants, which are not quoted. Its corpus medians
were within 15 ms of these: Dart Sass 314.39, `compile()` 440.48, and the
PostCSS pass alone 66.17 ms.

**The two candidates MIG-B9-23 prototyped,** applied to a copy of the
`f855765` build: the whole reference pass skipped when there is no consumer,
no `references.css` and no `externalTokens` (render, parse and inspection,
which is Q4 (b)'s behavior), and a value with no `(` skipped by both walks.
In the same rounds as above:

- The copy's output equals the base's (`css`, `map`, `warnings` and
  `dependencies`) for the three one-rule inputs and for the corpus with
  `sourceMap: 'external'` (276,926 bytes, 21 warnings).
- One-rule `compile()` with no token: 28.49 → 14.31 ms. With a token:
  28.40 → 29.34 ms, no change, since the reference pass has a consumer.
- The corpus's `compile()`: 448.41 → 422.71 ms (1.284× Dart Sass). The
  PostCSS pass alone: 66.30 → 42.72 ms.
- The no-`(` skip alone, in a separate run (09:14:26, load 11.48 then 10.09;
  61 rounds, base and copy alternated, 3 left out): the PostCSS pass alone on
  the corpus, 63.64 → 59.44 ms. The difference of the medians is 4.20 ms,
  and the median of the per-round differences 4.29 ms. MIG-B9-23 measured
  11.5–12.6 ms on `7aec3e0`; the scout's re-measure settles it.

Not prototyped: one engine pass per compilation (C1). The profile bounds it
by the render it removes, about 11–13 ms per compilation that validates and
renders the theme. That is every compilation except one with references
`'off'` and no marker.

## 5. Contract

This contract assumes the answers §15 recommends: Q1 (b), Q2 (a), Q3 (a) and
Q4 (a). Another answer changes it as §15 says, before the story starts.

- **C1 — The theme's engines run once per compilation.** For every input,
  one `compile()` (`uxdsl`) and one run of the PostCSS plugin
  (`uxdsl/postcss`) run each of `compileSurfaceRules`, `compileButtonRules`,
  `compileInputRules`, `compileShadowRules`, `compileEdgeRules` and
  `compileDensityRules` exactly once. This holds whether the compilation
  emits the theme at `@uxdsl theme;`, checks its references against the
  theme without emitting it, or is rejected by an engine. The one exception
  is unchanged from BASE: with an invalid breakpoint map, `validateTheme`
  reports `UXD_BP_INVALID` and runs no engine.
  - On BASE each runs twice when the theme is rendered (§4:
    `engine runs 12`).
  - The theme the plugin validates is the theme it renders. Its verdict is
    `validateTheme`'s: the same errors, in the same order, with the same
    codes, paths and messages, and the same warnings. The CSS it emits or
    checks against is `renderThemeCss`'s, byte for byte.
- **C2 — No inspection when nothing can be reported.** The reference pass
  inspects no declaration when all of the following hold:
  - it has no declaration to check: none generated by the theme or a
    directive, and no author declaration that uses a token function (the
    declarations `checkReferences` collects as consumers on BASE);
  - `references.css` has no entry;
  - `references.externalTokens` has no entry.

  Then `inspectDeclarationReferences` runs 0 times per compilation (BASE:
  once, over every declaration of the stylesheet and of the rendered theme).
  - The rendered theme is still parsed whenever BASE parses it (Q4 (a)). A
    theme value PostCSS cannot parse fails as on BASE: §4's
    `CssSyntaxError: uxdsl: <css input>:2:45: Unclosed comment`, with the
    same code, message and position.
  - A `references.css` entry PostCSS cannot parse and an invalid
    `externalTokens` entry fail as on BASE. `references.mode: 'off'` behaves
    as on BASE.
- **C3 — A value with no `(` is not parsed by the responsive pass.** Neither
  walk of `expandResponsive` parses a declaration whose value holds no `(`.
  - Compiling 100 more declarations whose values hold no `(`, `$`, `#{` or
    `//` adds 0 calls to `postcss-value-parser` (BASE: 400, four per
    declaration, §4).
  - Such a value keeps its bytes as written, comments and spacing included
    (MIG-B9-05).
- **C4 — The output is unchanged.** For every input, `compile()` returns
  what it returns on BASE: `css`, `map`, `dependencies`, `warnings` (text,
  file, line and column), and `themeEmitted` (MIG-B9-20). It throws the same
  errors (name, code, message, file, line and column). So do the PostCSS
  plugin alone and `validateTheme`, `generateThemeCss` and
  `renderThemeCss` (`uxdsl/theme`, `uxdsl/engine`).
- **C5 — Per compilation.** Nothing the plugin computes about the theme
  outlives one compilation (README §2).
  - One plugin instance with theme-file discovery, run twice with the theme
    file edited between the runs, emits and checks each run's own theme.
  - So does `compile()` called with two different `theme` options in turn.

Must stay byte-identical with BASE. BASE's figures are measured when the
story starts (§4); those below are `f855765`'s:

- the corpus through `compile()`: 276,926 bytes, equal to Dart Sass's, in
  the three `sourceMap` modes, with BASE's external map, `dependencies` and
  warnings (21 on `f855765`), by `fixtures/mig-b9-23-compile-budget/run.js`'s
  T4 against a build of BASE;
- every parity oracle (`fixtures/parity/expected/**`), without `--update`;
- the playground's `src/app/uxdsl.css`, `src/generated/examples.json`, and
  the CLI and compiler captures;
- `validateTheme`'s results on every input the suites give it
  (`theme-validation-matrix.test.js`, `theme-validate-*.test.js` and the
  others);
- `generateThemeCss`'s and `renderThemeCss`'s bytes, and `applyTheme`'s
  results;
- every existing test's assertion: `packages/uxdsl/test` differs from BASE
  only by the new test file;
- `DIAGNOSTIC_CATALOG`: BASE's codes (106 on `f855765`), none added;
- the gate's verdicts.

## 6. Out of scope

- **The stage map only when a map is requested, and Dart Sass's map without
  `sourcesContent`** (MIG-B9-23's "gated on the owner": 52 ms and 26–31 ms
  on `7aec3e0`). They are the Sass stage's costs, not the plugin's. Decision
  D18 of 2026-11-04 accepted MIG-B9-13's flag 2, the stage map on every
  build, as delivered, and MIG-B9-12's M1 stands. They are the owner's: Q2.
- **Parsing each value once** (MIG-B9-23's estimate: 5–10 ms). It would add
  `packages/uxdsl/src/language.ts`, whose `analyzeResponsiveValue` and
  `resolveResponsiveValue` take strings, to Shares. After C3, only values
  with a `(` are left (1,379 of the corpus's 5,371 declarations). The
  owner's: Q1 (c).
- **Sharing the rendered theme between compilations.** Every module of a
  Vite or webpack build validates and renders the same theme. Keeping that
  work between compilations is a process-global cache, which README §2 and
  the plugin's header ("Nothing is stored on the PostCSS root or on the
  plugin instance") forbid. The owner's, and not proposed here.
- **`generateThemeCss` and `applyTheme`'s own engine runs**
  (`ds-runtime/theme-generator.ts`, `ds-runtime/apply-theme.ts`). They are not a per-build cost of
  the plugin, and their outputs stay as they are (C4). Recorded in §15, new
  fact 5.
- **K3, one theme discovery per compilation:** MIG-B9-21. MIG-B9-23 §15
  measured it at about 0.06–0.09 ms per `compile()`.
- **A `validateTheme` rule for an unclosed comment or string in a theme
  value:** proposed in MIG-B9-13 §15 (line 759) as an S story beside
  MIG-B9-32 to 34, and not registered. The owner's: Q4 (c).
- **GC:** not a lever (MIG-B9-23, new fact 7).
- **P10's method, budget and re-measure:** MIG-B9-91 (decision D9 of
  2026-11-04). This story runs P10's runner as an invariant and records its
  ratio (§9, AC6).
- **Windows:** MIG-B9-28.

## 7. Approach and traps

Non-normative.

1. **C1, one engine pass.** `validateTheme`'s engine pass and
   `themeParts` call the same engines with the same arguments:
   - `generateFoundationCss(theme)` is `serializeBlocks(foundationBlocks(theme), ' ')`;
   - the `fonts` engine is `typographyBlocks` without `typography_details`,
     and the `typography_details` engine is `compileTypographyRules(details, bps, theme)`,
     which `typographyBlocks` also calls;
   - the six spied engines are called identically in both.

   One way: a function inside `theme-validate.ts`, not exported from any
   entry, runs `validateTheme`'s three passes, keeps each engine's output
   and, when the theme is valid, returns the blocks `renderTheme` serializes.
   `validateTheme` calls it and drops the blocks, so its results cannot move.
   The plugin keeps the render on its `Compilation`; `emitTheme` and
   `checkReferences` read it from there.
   - The two passes do not run the engines in the same order. Validation's
     order (foundation, fonts, `typography_details`, densities, inputs,
     buttons, surfaces, shadows, borders and radii) fixes the order of the
     errors; `themeParts`' order (foundation, typography, edges, shadows,
     surfaces, buttons, inputs, densities) fixes the CSS.
   - `validateTheme` validates a deep copy (`cloneThemeValue`), and the
     plugin renders `c.theme`. Both have the same content.
   - AGENTS.md (lines 782 to 786) says that the plugin calls `validateTheme`
     "on the effective theme before any engine runs". Keep that true. If the
     wording becomes inexact, update it and regenerate the agent guide;
     AGENTS.md then joins Shares (§10).
2. **C2, where to stop.** Decide after the consumers are collected. Keep
   `references.mode: 'off'`, `references.css` and `externalTokens` on
   BASE's path. Under Q4 (a) the rendered theme is still parsed, so its parse
   errors stay; only the inspection is skipped.
3. **C3.** Guard both walks with the same test of the value. A value
   without `(` holds no function, so neither the responsive check, the token
   rewrite nor the breakpoint check has anything to read in it.
   `rejectSassSyntax` and `rejectLineComment` keep their own guards (`$`,
   `#{`, a namespaced call, `//`).

Traps:

- **`test/performance/reference-performance.test.js`** captures
  `enforceReferences`'s arguments from a compilation with
  `references: { mode: 'off' }` that emits the theme (lines 57 and 62). Its
  consumers are the theme's declarations, so C2 never applies there. An
  implementation that also stops calling `enforceReferences` for
  `mode: 'off'` breaks its capture (`the compilation never reached reference
  validation`). MIG-B9-20 rewrites that test's `includeTheme: true` before
  this story starts.
- **`test/core/sass-source-maps.test.js:316` to `326`** pins the
  unparsable-theme `CssSyntaxError` at `<css input>`, with PostCSS's own
  position. Under Q4 (a) it stays as it is.
- **No cache between compilations** (C5). The `Compilation` object is the
  only place the shared render may live. Do not memoize on the theme object
  or on the plugin instance: the plugin's header forbids it, and a dev
  server reuses one instance.
- **`validateTheme` is public** (`uxdsl/theme`). Its signature, its result
  (`ok`, `theme`, `errors`, `warnings`) and the reference pass it runs when
  `references` is not `false` stay as they are.
- **The tests count through the dist modules' exports,** as the base's calls
  go (`(0, surfaces_1.compileSurfaceRules)(…)`). An engine called through a
  local binding would read 0 and fail T1. Keep the calls through their
  modules.
- **The timings are indicative.** The machine is never quiet, and the
  owner's dev servers and other workflows run on it. Use MIG-B9-23's
  discipline when recording them (§15, Q3): alternate BASE and head within
  each round; leave the cold rounds out; compile the corpus from a fresh
  directory outside `os.tmpdir()`; print the start time and
  `sysctl -n vm.loadavg` with every figure; never re-run a run to get a
  better one.
- **`node -` cannot run `compile()`** (§15, new fact 6). Write a measuring
  script to a file.

Stop rule: stop if C1 cannot hold with `validateTheme`'s results unchanged
(errors, their order, codes, paths and messages; warnings), or if the change
needs a file outside `plugin.ts`, `theme-validate.ts`, `theme-generator.ts`,
the new test, the CHANGELOG and the package README. Set the story to Blocked,
with the finding and the measurements in §15 (README §2, "Authority"). The
owner decides, for instance whether to split C1 into its own story (Q1).
Never change an existing test's assertion, a parity oracle or the
diagnostics catalog to make the change pass.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `packages/uxdsl/test/plugin-work-per-compilation.test.js` (new) | `MIG-B9-24: each theme engine runs once per compilation, whether the theme is emitted at @uxdsl theme;, only checked against, or rejected by an engine` | unit (`compile()` and `uxdsl/postcss`, counted through the dist modules' exports) | C1 | `MIG-B9-24: validateTheme then renderThemeCss, called one after the other, count two runs of each engine (negative control)`: the counter sees a second run, which BASE's plugin makes |
| T2 | same | `MIG-B9-24: the reference pass inspects no declaration when it can report nothing, and a theme value PostCSS cannot parse still fails there as on the base` | unit | C2, C4 | `MIG-B9-24: one token, one references.css entry or one externalTokens entry brings the inspection back, and their errors stay (negative control)`: one inspection each; `.y {` in `references.css` is `CssSyntaxError` `Unclosed block`; `bad token` is `UXD_REFERENCE_CONTEXT` |
| T3 | same | `MIG-B9-24: a declaration whose value has no "(" is parsed by neither walk of the responsive pass and keeps its bytes` | unit | C3, C4 | `MIG-B9-24: 100 declarations whose values hold a "(" add value parses (negative control)`: `calc(1px + <n>px)` adds at least 100 calls |
| T4 | same | `MIG-B9-24: nothing outlives one compilation: one plugin instance with an edited theme file, and compile() with two themes in turn, emit and check each compilation's own theme` | unit | C5 | the test also runs its assertion on a planted wrapper that returns the first compilation's result for the second, and expects the assertion to fail |
| T5 | the suites `npm test` runs, unedited from BASE: `theme-validation-matrix.test.js`, `theme-validate-*.test.js`, `theme-marker.test.js`, `preserve-untouched-declarations.test.js`, `build-runtime-parity.test.js`, `unified-engine.test.js`, `core/sass-source-maps.test.js`, `performance/reference-performance.test.js`, and the rest | unchanged assertions | all | C4 | — (invariant) |
| T6 | `fixtures/parity/run.js` | unchanged oracles | parity | C4 | — |
| T7 | `fixtures/sass-corpus/run.js --no-timing-budget` | `byte-identical: true`, BASE's warning count, the five mixed checks `ok` | fixture | C4 | — |
| T8 | `fixtures/mig-b9-23-compile-budget/run.js --base <a build of BASE>` | its T4: the corpus through `compile()` equals the base build's `css`, `map`, `dependencies` and `warnings` in the three `sourceMap` modes | fixture | C4 | its own: a wrapper that changes the case of one `dependencies` entry fails it |
| T9 | `npm --prefix packages/playground-nextjs run uxdsl:build`, and the captures check in `npm test` | `unchanged src/app/uxdsl.css` | build | C4 | — |

C1, C2 and C3 have the failing-first tests (README §2). On BASE, T1 counts
two runs per engine, T2 one inspection and T3 400 parses, deterministically
and on every machine. All three pass after the change. C4 and C5 state what
the change must keep: their tests pass on BASE by design, and each negative
control shows that its test can fail.

## 9. Acceptance criteria

BASE below is `git merge-base HEAD origin/feat/beta9` (§3).

- **AC1** `node --test packages/uxdsl/test/plugin-work-per-compilation.test.js`
  exits 0, with T1 to T4 and their negative controls run, none skipped.
  - Test file: `packages/uxdsl/test/plugin-work-per-compilation.test.js`.
  - Mutations, each failing it:
    - the plugin calling `validateTheme` and then `renderThemeCss` separately
      fails T1 (2 runs, not 1);
    - the inspection run with nothing to check fails T2 (1, not 0);
    - removing the `(` guard from the first walk fails T3 (300 parses, not
      0), from the second walk too (100), and from both (400);
    - a render kept on the plugin instance or at module level fails T4.
- **AC2** `node fixtures/parity/run.js` exits 0 without `--update`, and
  `git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- fixtures/parity/expected`
  exits 0.
  - Test file: `fixtures/parity/run.js`.
  - Mutation: none; an invariant guard, like C4.
- **AC3** `npm test` exits 0, and
  `git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- packages/uxdsl/test ':(exclude)packages/uxdsl/test/plugin-work-per-compilation.test.js'`
  exits 0.
  - Test files: the suites `npm test` runs, `test/performance/*.test.js`
    included.
  - Mutation: AC1's, which `npm test` runs.
- **AC4** `npm run verify:1.0 -- --skip-playground-walk` exits 0.
  - Test file: `fixtures/release-1.0/run.js`.
  - Mutation: none; an invariant guard.
- **AC5** `npm --prefix packages/playground-nextjs run uxdsl:build` exits 0
  and prints `unchanged src/app/uxdsl.css`.
  - Test file: the playground's `uxdsl:build`, which compares its output
    with the committed `src/app/uxdsl.css`.
  - Mutation: none; an invariant guard.
- **AC6** `node fixtures/sass-corpus/run.js --no-timing-budget` exits 0 and
  prints `byte-identical: true`, BASE's warning count and the five mixed
  checks `ok`. §14 records its ratio, with the start time and load average.
  - Test file: `fixtures/sass-corpus/run.js`, unedited.
  - Mutation: none; an invariant guard. P10 itself is MIG-B9-91's to
    re-measure (decision D9).
- **AC7** `node fixtures/mig-b9-23-compile-budget/run.js --base <a build of BASE>`
  exits 0, its T4 equal in the three `sourceMap` modes.
  - Test file: `fixtures/mig-b9-23-compile-budget/run.js`.
  - Mutation: its own planted control (T8).
  - Run it last, alone. Its location check writes 129,944 files and sets off
    the endpoint security agent for minutes (MIG-B9-23, new fact 6).

Owner checks, never marked PASS by the agent:

- Answer Q1 to Q4 (§15) before the story starts.
- Read §14's timings, which are recorded and not asserted (Q3).

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes. `plugin.ts` and `theme-generator.ts` are in `VISUAL_DEFAULT_FILES`, so the docs guard requires it in the same commit. One subsection under `## 0.5.0-beta.9 — unreleased`, with `### Visual changes`: none |
| package README | yes (the guard): one sentence |
| `verify-docs-update.js` classification | no (no file added under `src`; yes if the implementation adds one) |
| `npm run generate:language` | no |
| `AGENTS.md` + agent guide | no, unless the sentence at lines 782 to 786 becomes inexact (§7, item 1); then yes, and AGENTS.md joins Shares |
| `DIAGNOSTIC_CATALOG` | no |
| `npm run generate:capabilities` | no |
| playground `uxdsl:build` + captures | run, with no change expected (`unchanged src/app/uxdsl.css`; `npm test` checks the captures) |
| `migration.md` | no |

## 11. Documentation

- `packages/uxdsl/CHANGELOG.md`: one subsection under
  `## 0.5.0-beta.9 — unreleased`. It says that a compilation runs the theme's
  engines once, that the reference pass inspects nothing when it has nothing
  to check, and that the responsive pass does not parse a value with no `(`.
  It has `### Visual changes`: none.
- `packages/uxdsl/README.md`: one sentence beside the pipeline's plugin
  stage.

No user-facing documentation describes these internals, and none changes.

## 12. Verification

```bash
node --test packages/uxdsl/test/plugin-work-per-compilation.test.js            # exit 0, nothing skipped
node fixtures/parity/run.js                                                    # exit 0
npm test                                                                       # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                                   # background; exit 0
npm --prefix packages/playground-nextjs run uxdsl:build                        # exit 0; unchanged src/app/uxdsl.css
node fixtures/sass-corpus/run.js --no-timing-budget                            # exit 0; network; date and sysctl -n vm.loadavg before it
node fixtures/mig-b9-23-compile-budget/run.js --base <a build of BASE>         # last and alone; exit 0; network
```

Then §4's baseline on the head, whose counts become: `engine runs 6` on the
three lines, `reference inspections 0` for "no token, no marker",
`value parses for 100 more declarations with no "(": 0`, and the same
`CssSyntaxError` line. And the timings of §15's Q3, recorded in §14.

## 13. Delivery

Branch `feat/b9-24-plugin-fixed-costs`. Commit:
`perf(FEAT-010): MIG-B9-24 - a compilation runs the theme's engines once and skips the reference inspection and value parses that can report nothing`.

PR title: `FEAT-010: MIG-B9-24 - the plugin's fixed per-build costs`. The
body:

- **Goal:** §1, in two sentences.
- **Counts:** §4's baseline on BASE and on the head.
- **Timings:** the one-rule module and the corpus, BASE against the head,
  with both statistics, start times and load averages (Q3).
- **C4:** parity, `npm test`, `verify:1.0`, `uxdsl.css` unchanged, and
  T8 against BASE (its SHA).
- **Not run, or not a pass:** Windows, and the timing assertion the
  contract does not make.
- **Owner checks:** the list in §9.
- The last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Drafting of 2026-11-10

Facts found while writing this story on `f855765`. The scripts and logs
stay in the drafting run's scratch evidence, outside the repository. This
story fixes none of them beyond its contract.

1. **The engines run twice per compilation.** Every compilation that
   renders the theme runs the six spied engines twice, once in
   `validateTheme` and once in `renderThemeCss` (§4). That is every
   compilation except one with references `'off'` and no marker. About
   23,000 of a compilation's `postcss-value-parser` calls are the theme's
   engines', whatever the stylesheet. MIG-B9-23 §6 calls this "the theme
   rendered twice".
2. **The skip MIG-B9-23 called output-free changes one error.** On
   `f855765`, a compilation that neither emits the theme nor uses a token
   still fails on a theme value PostCSS cannot parse
   (`CssSyntaxError: uxdsl: <css input>:2:45: Unclosed comment`, §4),
   because the reference pass parses the rendered theme. `validateTheme`
   accepts the value. Skipping the whole pass makes that compilation succeed.
   The suites did not catch it: `sass-source-maps.test.js:316` uses a
   stylesheet with a token. The contract keeps the error (Q4).
3. **`compile.ts` holds none of the plugin's costs.** In the one-rule
   profile, `compile.ts`'s own work besides the Sass stage is
   `reservedNames`, about 0.1 ms (discovery, which is K3's). The candidates
   that would edit it are the stage map's (Q2). README §7's `compile.ts` row
   should drop MIG-B9-24 unless Q2 is answered (b).
4. **`language.ts` is needed only to parse each value once** (Q1 (c)): its
   `analyzeResponsiveValue` (`language.ts:448`) and
   `resolveResponsiveValue` (`language.ts:145`) take strings.
5. **`applyTheme` and `generateThemeCss` repeat the engines too.**
   - `applyTheme` (`ds-runtime/apply-theme.ts:223` and `:232`) calls `validateTheme`
     with its default reference pass, which renders the theme
     (`theme-validate.ts:363`), then `renderThemeCss`: three engine runs per
     patch, read from the code and not measured.
   - `generateThemeCss` (`theme-generator.ts:70` and `73`) runs them twice.

   Neither is the plugin's per-build cost, and both stay as they are here
   (§6). No story is proposed: it is the owner's whether the runtime's cost
   matters.
6. **`compile()` cannot run when the main module is standard input**
   (`node -`). Dart Sass's `NodePackageImporter`, which the Sass stage
   constructs on every pass (`compile-sass.ts:669`), reads `process.argv[1]`.
   For `-` it throws `TypeError [ERR_INVALID_ARG_VALUE]: The argument
   'filename' must be a file URL object, file URL string, or absolute path
   string. Received '-'`. `node -e` and a script file work. Found while
   writing §4's baseline; no story is proposed, since Dart Sass owns the
   behavior.
7. **The no-`(` skip measured smaller than registered:** 4.2 ms on the
   corpus's PostCSS pass here, against MIG-B9-23's 11.5–12.6 ms on
   `7aec3e0` (§4). The scout re-measures it.

**README §7, to update before the story starts** (README lines 364 to 369:
the table follows each story file's Shares). With Q1 (b) and Q2 (a):

- `packages/uxdsl/src/plugin.ts`: keep MIG-B9-24. By §5's row order it waits
  for MIG-B9-20, 21 and 27, and MIG-B9-30, 31 and 35 wait for it.
- `packages/uxdsl/src/compile.ts`: remove MIG-B9-24 (new fact 3).
- `packages/uxdsl/src/ds-runtime/theme-validate.ts`: keep MIG-B9-24;
  MIG-B9-32, 33, 34 and 37 wait for it.
- `packages/uxdsl/src/ds-runtime/theme-generator.ts`: keep MIG-B9-24;
  MIG-B9-34 waits for it.
- `packages/uxdsl/CHANGELOG.md` and `packages/uxdsl/README.md`: the
  append-only rows. Whether they serialize stories is still open
  (MIG-B9-23 §15, finding 1 and flag 6, not among the decisions of
  2026-11-09).

### Open questions for the owner (answer before implementing)

**Q1 — Which candidates are in the story?** The registration lists
MIG-B9-23's candidates as output-free, estimated and gated (§2). The profile
of §4 shows where a module's time goes: a one-rule `compile()` takes
28.4 ms, of which `validateTheme` takes about 12.7 and the theme render
about 12.8.

- **(a) The two output-free candidates only:** C2 and C3, in `plugin.ts`
  only. C1 is dropped. A module that uses a token (most Vite and webpack
  modules) gains nothing, since its reference pass has a consumer.
  `theme-validate.ts` and `theme-generator.ts` leave Shares, so MIG-B9-32,
  33, 34 and 37 no longer wait for this story on them.
- **(b) (a) plus one engine pass per compilation (C1).** This adds
  `theme-validate.ts` and `theme-generator.ts`. It is the largest lever on
  every module, bounded by the render (about 11–13 ms of about 28, §4).
  `validateTheme`'s results are pinned by C4 and the existing suites.
- **(c) (b) plus parsing each value once.** This also adds `language.ts` to
  Shares (§7's row for 04, 30 and 31; 30 and 31 already wait for this story
  on `plugin.ts`). After C3 only values with a `(` are left, so its gain is
  below the registered 5–10 ms, and the story may no longer be S.

Recommendation: **(b)**. It is the only option that lowers the cost the
registration names: "Every module a Vite or webpack build compiles pays it."
It stays within S: three source files and one test file, no new code, no
output change. **The contract assumes (b).** Under (a), C1, T1 and the two
`ds-runtime` files are dropped. Under (c), the scout re-sizes the story
first.

**Q2 — The gated candidates:** the stage map only when a map is requested,
and Dart Sass's map without `sourcesContent`. MIG-B9-23 measured 52 ms and
26–31 ms on the corpus, on `7aec3e0`.

- **(a) Out of this story.** Decision D18 of 2026-11-04 accepted MIG-B9-13's
  flag 2, the stage map on every build, as delivered, and MIG-B9-12's M1
  stands. Both are the Sass stage's, not the plugin's.
- **(b) In.** The owner reopens flag 2 or amends M1, or both.
  - `packages/uxdsl/src/compile.ts` (line 178,
    `sourceMap: true, sass: config.sass`) and
    `packages/uxdsl/src/sass/compile-sass.ts` (lines 671 and 672) join
    Shares.
  - So does `packages/uxdsl/test/core/compile-sass.test.js`, whose
    MIG-B9-12 test at line 1199 asserts
    `{ sourceMap: true, sourceMapIncludeSources: true }`. That is a change
    to an existing assertion, which only the owner's amendment allows.
  - §7's `compile-sass.ts` row gains MIG-B9-24, which then waits for
    MIG-B9-26 there, and its `compile-sass.test.js` row makes it wait for
    MIG-B9-25.
  - The story likely becomes M.

Recommendation: **(a)**. **The contract assumes (a).**

**Q3 — Is there a timing criterion?** The registration names the lever, not
a target.

- **(a) None asserted.** C1 to C3's deterministic counts are the contract.
  §14 records indicative timings with MIG-B9-23's runner discipline (§7):
  - the one-rule module (61 rounds or more) and the corpus (21 or more),
    BASE build against the head, alternated within each round, the cold
    rounds left out;
  - the corpus compiled from a fresh directory outside `os.tmpdir()`, as
    `fixtures/sass-corpus/run.js` makes it;
  - both the difference of the two medians and the median of per-round
    differences, since decision 4 of 2026-11-09 leaves the paired statistic
    for T3 to MIG-B9-91;
  - each figure with its start time and load average.
- **(b) A relative criterion, with a number the owner names.** For example:
  the median of the PostCSS pass on the one-rule module falls by at least N%
  against a build of BASE, by (a)'s method. It adds a fixture,
  `fixtures/mig-b9-24-plugin-costs/` (run by hand, like MIG-B9-23's), to
  Owns, with a planted slow plugin as its negative control.
- **(c) A share of `compile()` on the corpus,** with a number the owner
  names. For example: the plugin's pass is at most X of `compile()`'s median.

Recommendation: **(a)**. The counts fail on BASE on every machine and pass
after the change. The existing performance test asserts "a *ratio*, never a
millisecond budget" for the same reason (§2). This machine is never quiet:
§4's one-rule IQR was 28–30 ms in one pass and 30–87 ms in the pass before
it. **The contract assumes (a)**, and no number is invented here.

**Q4 — A theme value PostCSS cannot parse** (new fact 2).

- **(a) Keep every error as on BASE.** The reference pass still parses the
  rendered theme whenever BASE parses it, and C2 skips only the inspection.
  Output impact stays none, and every existing assertion stays, including
  `sass-source-maps.test.js:316`. It costs the parse, 0.63 ms per
  compilation (§4). C2 then saves the inspection only: about 1 ms on a
  one-rule module, and up to the 8.2 ms of `inspectReferences` on the
  corpus (§4's profile).
- **(b) Accept that a compilation that emits no theme and uses no token no
  longer parses it.** The error stays wherever the theme is emitted or a
  token is checked against it. The CHANGELOG records the change. It saves
  the parse and the render's serialization too: the prototype gave
  28.49 → 14.31 ms for a one-rule module with no token (§4).
- **(c) First add a `validateTheme` rule for an unclosed comment or string**
  (MIG-B9-13 §15, line 759; not registered, so it needs a registration).
  Then (b) loses no error, since the validator names the key path.

Recommendation: **(a)**. A performance story changes no output, and nothing
it keeps depends on registering another story. **The contract assumes
(a).**

### Review of 2026-11-10 (applied in the PR that adds this file)

A static review of the seven wave-2 story files written on 2026-11-10. Its
findings on this story were applied before the owner's review:

- **The `compile.ts` row (R9).** The index removes MIG-B9-24 from that row,
  as new fact 3 proposes, and MIG-B9-26's story file no longer lists this
  story under Blocks. Under Q2 (b) this story would rejoin that row and the
  `compile-sass.ts` row, after MIG-B9-26.
- **A path (R16).** New fact 5 and §6 name `ds-runtime/apply-theme.ts` and
  `ds-runtime/theme-generator.ts` with their directory.
