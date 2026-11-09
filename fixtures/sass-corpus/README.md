# The Bootstrap corpus

`run.js` is the guarantee behind "rename `.scss` to `.uxdsl` and it works"
(FEAT-010, MIG-B9-10): Bootstrap 5.3.8's SCSS, every file renamed to `.uxdsl`,
compiled with `uxdsl`'s `compile()`, must equal what Dart Sass produces from the
original `.scss`, byte for byte. A second compile adds `_uxdsl-extras.uxdsl`
— UXDSL tokens and directives mixed with Bootstrap's own variables, functions,
mixins and `$theme-colors` — and checks that Bootstrap's part is unchanged and
the UXDSL constructs resolve.

```bash
node fixtures/sass-corpus/run.js                     # exit 0 when identical, within budget and every mixed check ok
node fixtures/sass-corpus/run.js --no-timing-budget  # print the timing ratio without asserting it
node fixtures/sass-corpus/run.js --keep              # keep the temporary directory
node fixtures/sass-corpus/run.js --help
```

It prints the number of files the entry loads, the sizes, `byte-identical:`
and, on a difference, the first ten differing lines; then the timing, the
deprecation warnings and the five mixed checks (`ok` or `FAIL`). It exits 1 on
any byte difference, on a failed mixed check, or over the timing budget.

**Timing budget.** In one process, Dart Sass compiles `bootstrap.scss` three
times, then `compile()` compiles `bootstrap.uxdsl` three times; `compile()`'s
median must be at most 1.5 times Dart Sass's (FEAT-010, MIG-B9-13, P10).
`compile()` always runs Dart Sass with its source map, which plain Dart Sass is
not asked for. Every run's duration, both medians and the ratio are printed.
`--no-timing-budget` prints the same figures without asserting the ratio: the
release gate runs the corpus that way (`S-1`), since it does not control the
machine's load.

**Deprecation warnings.** Dart Sass delivers at most five warnings per
deprecation type to a logger, then one summary of the rest; the
`deprecation warnings Dart Sass delivered` line counts what arrives that way,
which is also what `compile()` returns (its warning count is printed).
`deprecation totals (verbose)` counts every one, from one more untimed Dart
Sass compile with `verbose: true` (Bootstrap 5.3.8 on Dart Sass 1.107.0: 330,
delivered as 21 warnings).

`run.test.js` tests the timing verdict, the flag, the two deprecation counts
and the byte comparison without the network; `npm test` runs it.

**Network:** it installs `bootstrap@5.3.8` from the npm registry into a
temporary directory. It compares against the repository's own Dart Sass — the
`sass` dependency of `packages/uxdsl`, found by resolving the package's
entry file, since its `exports` map hides `sass/package.json` (`--sass <path>`
to choose another) — and tests the repository build of `packages/uxdsl`
(`--uxdsl <dir>` to test an installed tarball instead).
