# mig-b9-23-compile-budget

MIG-B9-23 (FEAT-010): `compile()` within 1.5 times Dart Sass, wherever the project is. On
Bootstrap 5.3.8 renamed to `.uxdsl`, three checks, each with a control that must fail:

```sh
node fixtures/mig-b9-23-compile-budget/run.js --base <dir>                  # the repository build against a build of the base
node fixtures/mig-b9-23-compile-budget/run.js --base <dir> --uxdsl <dir>    # another build
node fixtures/mig-b9-23-compile-budget/run.js --base <dir> --rounds 15      # more rounds for the location check (at least 9)
```

| Check | What it runs | Passes when | Its control |
| --- | --- | --- | --- |
| T2 | `fixtures/sass-corpus/run.js --uxdsl <wrapper>`, twice | the runner exits 1 both times | a `compile()` 250 ms slower per call must print `FAIL  compile() is over the 1.5x budget`; one that changes the last byte of its CSS must print `byte-identical: false` |
| T3 | `compile()` on two copies of the corpus root, interleaved in one process, the order swapped each round: 2 warm-up rounds, then 11 | the two medians differ by at most 15 ms | the same with a `compile()` that lists the directory holding the corpus root on each call, as the base build's `realCase` does, must differ by more |
| T4 | `compile()` from `--uxdsl` and from `--base`, in one process, for `sourceMap` `false`, `'inline'` and `'external'` | `css`, `map`, `dependencies` and warnings (text, file, line, column) are equal | a `compile()` that changes the case of one `dependencies` entry must differ |

T3's copies: one corpus root alone in its directory, and one in a directory that also holds 129,944
empty entries, the size of the temporary directory where the budget was first measured. T4 compiles
the entry as written and, where the filesystem folds case (macOS, Windows), also written in another
case and through a symlinked ancestor written in another case; elsewhere those two are skipped, with
the reason printed.

Every line is `ok`, `FAIL` or `skip`, and the run exits 0 when no line is `FAIL`, 1 otherwise, and
2 on a usage error (`--base` is required).

**The base build.** `--base` is a `uxdsl` package directory with `dist/`, built from the commit the
story branched from (`git merge-base HEAD origin/feat/beta9`), outside the repository:

```sh
BASE=$(git merge-base HEAD origin/feat/beta9)
mkdir -p <scratch>/base-build
git archive "$BASE" tsconfig.base.json packages/uxdsl | tar -x -C <scratch>/base-build
(cd <scratch>/base-build/packages/uxdsl && npm ci --ignore-scripts --no-audit --no-fund && npm run build)
node fixtures/mig-b9-23-compile-budget/run.js --base <scratch>/base-build/packages/uxdsl
```

**What it leaves.** Everything it makes is in one directory under the temporary directory, removed at
the end, the 129,944 entries included; the corpus runner removes its own directory under
`fixtures/sass-corpus/.work`.

**Network.** It installs `bootstrap@5.3.8` three times: once here, and once in each of T2's two runs
of the corpus runner.

**Timing.** Writing 129,944 files can keep the machine busy for a minute or two after the run (a
file-scanning agent, for one). T3 compares two medians measured in the same rounds, so a busy
machine moves both, but a timing that counts on its own, such as `fixtures/sass-corpus/run.js`'s
ratio, is better taken before this fixture, or once the load has fallen after it.

It is not part of `npm test`: it needs the network and takes a few minutes.
