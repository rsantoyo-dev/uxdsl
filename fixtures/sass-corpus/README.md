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
node fixtures/sass-corpus/run.js --keep              # keep the corpus root (its path is printed)
node fixtures/sass-corpus/run.js --help
```

It prints the number of files the entry loads, where the corpus root is, the
sizes, `byte-identical:` and, on a difference, the first ten differing lines;
then the timing, the deprecation warnings and the five mixed checks (`ok` or
`FAIL`). It exits 1 on any byte difference, on a failed mixed check, or over
the timing budget.

**Timing budget.** In one process, Dart Sass compiles `bootstrap.scss` and
`compile()` compiles `bootstrap.uxdsl` alternately, Dart Sass first, four
times each. Each one's first run is cold and is left out: `compile()`'s median
of its three warm runs must be at most 1.5 times Dart Sass's (FEAT-010,
MIG-B9-13, P10; the method is decision D8 of 2026-11-04, MIG-B9-23).
`compile()` always runs Dart Sass with its source map, which plain
Dart Sass is not asked for. Every run's duration (the cold ones marked
`discarded`), both medians and the ratio are printed. `--no-timing-budget`
prints the same figures without asserting the ratio: the release gate runs the
corpus that way (`S-1`), since it does not control the machine's load.

**Where the corpus is compiled.** Each invocation makes the corpus root in a
fresh directory that holds nothing else,
`fixtures/sass-corpus/.work/run-XXXXXX/corpus-root` (git-ignored), and removes
it afterwards. It is outside the temporary directory, so what that directory
holds is not on the corpus's path; the run prints where the corpus root is.
`--keep` keeps it and prints its path: it holds `node_modules/bootstrap`, which
`UXDSL_SASS_CORPUS` accepts in `packages/uxdsl/test/core/protect.test.js`.

**Deprecation warnings.** Dart Sass delivers at most five warnings per
deprecation type to a logger, then one summary of the rest; the
`deprecation warnings Dart Sass delivered` line counts what arrives that way,
which is also what `compile()` returns (its warning count is printed).
`deprecation totals (verbose)` counts every one, from one more untimed Dart
Sass compile with `verbose: true` (Bootstrap 5.3.8 on Dart Sass 1.107.0: 330,
delivered as 21 warnings).

`run.test.js` tests the timing verdict, the flag, the alternated timing and
its warm runs, the fresh directory, the two deprecation counts and the byte
comparison without the network; `npm test` runs it.

**Network:** it installs `bootstrap@5.3.8` from the npm registry into the
corpus root. It compares against the repository's own Dart Sass — the
`sass` dependency of `packages/uxdsl`, found by resolving the package's
entry file, since its `exports` map hides `sass/package.json` (`--sass <path>`
to choose another) — and tests the repository build of `packages/uxdsl`
(`--uxdsl <dir>` to test an installed tarball instead).
