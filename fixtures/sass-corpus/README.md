# The Bootstrap corpus

`run.js` is the guarantee behind "rename `.scss` to `.uxdsl` and it works"
(FEAT-010, MIG-B9-10): Bootstrap 5.3.8's SCSS, every file renamed to `.uxdsl`,
compiled with `uxdsl`'s `compile()`, must equal what Dart Sass produces from the
original `.scss`, byte for byte. A second compile adds `_uxdsl-extras.uxdsl`
— UXDSL tokens and directives mixed with Bootstrap's own variables, functions,
mixins and `$theme-colors` — and checks that Bootstrap's part is unchanged and
the UXDSL constructs resolve.

```bash
node fixtures/sass-corpus/run.js            # exit 0 when identical, 1 otherwise
node fixtures/sass-corpus/run.js --keep     # keep the temporary directory
node fixtures/sass-corpus/run.js --help
```

It prints the sizes, the median of three timings for each compiler, the
deprecation warnings Bootstrap's own sources raise (by id) and the number of
files the entry loads, then the first ten differing lines on a difference.

**Network:** it installs `bootstrap@5.3.8` from the npm registry into a
temporary directory. It compares against the repository's own Dart Sass — the
`sass` dependency of `packages/uxdsl`, found by resolving the package's
entry file, since its `exports` map hides `sass/package.json` (`--sass <path>`
to choose another) — and tests the repository build of `packages/uxdsl`
(`--uxdsl <dir>` to test an installed tarball instead).

Until the Sass pipeline lands (MIG-B9-13), `compile()` emulates a subset of Sass
and resolves `@import` with postcss-import, which cannot find Bootstrap's
partials (`bootstrap.uxdsl:1:1: Failed to find 'mixins/banner'`), so the script
stops before the comparison with `byte-identical: false — compile() failed: …`
and exits 1. That is the expected state of the base; MIG-B9-13 wires it into
the release gate.
