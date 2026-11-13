# MIG-B9-27 — `uxdsl/postcss` in a PostCSS chain: run the Sass-syntax checks at `OnceExit` if that keeps every contract

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 2 |
| Decision gate | DEC-05 (decided 2026-10-23). Registered by decision D7 of 2026-11-04, on MIG-B9-13 §15, flag 8 (F3) |
| Status | Ready |
| Size | S |
| Depends on | MIG-B9-21 (D7: "after MIG-B9-21, since it edits `plugin.ts`"). Under README §7 also: MIG-B9-20, an earlier row of the `plugin.ts` and `migration.md` rows, which also removes the `includeTheme` option that `test/no-silent-output.test.js` passes 12 times; MIG-B9-25 (`test/no-silent-output.test.js`); MIG-B9-26 (`compile.md`, `migration.md`); MIG-B9-17 (`migration.md`, where both stories rewrite an item: decisions 6 and 31 of 2026-11-10) |
| Blocks | MIG-B9-24, 30, 31 and 35 (later rows of README §7's `plugin.ts` row); MIG-B9-28 (`test/no-silent-output.test.js`); in `0.5.0-beta.10`, MIG-B9-52 (`migration.md`, which it restructures), and MIG-B9-60 there only if its re-baselined file rewrites a passage (decision 31 of 2026-11-10 makes `migration.md` append-only, so MIG-B9-30 to 36 no longer wait for this story on it); MIG-B9-91 (every story of waves 0 to 3) |
| Base | `feat/beta9` after MIG-B9-20, MIG-B9-21, MIG-B9-25, MIG-B9-26 and MIG-B9-17. §3 and §4 were recorded on `f855765`, before all of them; they are re-run when the story starts (§3) |
| Owns | Outcome A only: `packages/uxdsl/test/postcss-chain.test.js` (new), `fixtures/mig-b9-27-postcss-chain/` (new: `run.js`, `README.md`) |
| Shares | Outcome A only: `packages/uxdsl/src/plugin.ts` (the plugin factory, `rejectSassSyntax`, the header comment), `packages/uxdsl/test/no-silent-output.test.js` (F3's pin), `packages/uxdsl/CHANGELOG.md`, `packages/uxdsl/README.md`, `packages/uxdsl/docs/integrations/compile.md`, `packages/uxdsl/docs/migration.md` (item 4 of "beta.9 — Sass inside compile()"). Outcome B edits this file only |
| Output impact | Outcome A: API — a PostCSS chain that fails as `UXD_SASS_CONTEXT` on BASE compiles; the plugin alone and `compile()` are byte-identical. Outcome B: none |

## 1. Goal

`uxdsl/postcss`, listed before or after postcss-nested, postcss-simple-vars
or `tailwindcss/nesting` in one PostCSS run, compiles what those plugins
resolve (`&_title`, `$gap`) instead of failing as `UXD_SASS_CONTEXT`, if and
only if running the Sass-syntax checks at `OnceExit` keeps every contract the
plugin has on BASE. The story closes either way, without a new decision:
outcome A adopts the change, with the chains pinned by tests; outcome B keeps
the plugin and its documentation as they are, with the evidence in §14.

## 2. Sources

- The registration, decision D7 of 2026-11-04
  ([FEAT-010 §2](../FEAT-010-beta9.md), line 182):

  > **D7 — MIG-B9-13's owner flag 8 (F3):** `uxdsl/postcss` after postcss-nested or postcss-simple-vars failing, in either order, is accepted as documented for now; MIG-B9-27 registered, "`uxdsl/postcss` in a PostCSS chain: run the Sass-syntax checks at `OnceExit` if that keeps every contract" (S, wave 2, after MIG-B9-21, since it edits `plugin.ts`), which also verifies `tailwindcss/nesting`.

- The same decision, as MIG-B9-13 records it
  ([MIG-B9-13 §15](MIG-B9-13-compile-on-sass.md), "Owner decisions of
  2026-11-04", line 820):

  > it is a narrower form of the flag's option (b), in which only the Sass-syntax checks move, and only if every contract holds. It also verifies `tailwindcss/nesting`.

- The flag it answers (MIG-B9-13 §15, "Delivery of 2026-11-02", lines
  662–670):

  > 8. **F3: PostCSS chains.** `uxdsl/postcss` checks the stylesheet in its `Once` listener, and PostCSS runs every plugin's `Once` before any visitor. So syntax another plugin resolves in a visitor fails as `UXD_SASS_CONTEXT`, in either plugin order: postcss-nested 7.0.2's `&_title`, postcss-simple-vars 7.0.1's `$gap`.
  >    - All four combinations compiled on `ed498e3`.
  >    - `tailwindcss/nesting`, which wraps postcss-nested, was not tried.
  >    - The CHANGELOG, the migration guide and the README give the workaround: a PostCSS pass of its own, or a `.uxdsl` file through `compile()`.
  >
  >    Options:
  >    - (a) accept it;
  >    - (b) move `uxdsl`'s steps to `OnceExit`, which changes plugin order;
  >    - (c) make these cases a warning, which narrows DEC-05.

- DEC-05 ([FEAT-010 §2](../FEAT-010-beta9.md), line 97):

  > The PostCSS plugin used alone compiles CSS plus UXDSL, without Sass: its own `$variable` resolution is deleted, and Sass syntax in a file it compiles is a located error that names the fix (a `.uxdsl` file through `uxdsl build`, `compile()` or an adapter). Every Sass construct is detected, not only `$name`: `@use`, `@forward`, `@mixin`, `@include`, `@function`, `@extend`, the control rules, `#{…}`, `&`-suffix selectors and `%placeholders`. `--x: $var` has its own message: Sass keeps `$var` literally in a custom property; write `#{$var}`.

- `packages/uxdsl/src/plugin.ts` on `f855765`:
  - the header, lines 3–8 and 31–35:

    ```ts
    //   Sass        A stylesheet this plugin compiles alone is CSS plus UXDSL:
    //               Sass syntax in it fails as UXD_SASS_CONTEXT, naming uxdsl
    //               build, compile() or an adapter, where Dart Sass runs first.
    //               Behind compile(), the same check catches a $variable Dart
    //               Sass kept as written (a custom property, a plain-CSS
    //               at-rule's prelude), whose fix is #{$variable}.
    ```

    ```ts
    // One compilation is one `Compilation` object, built by `validateOptions` and
    // handed through `rejectSassSyntax`, `emitTheme`, `expandDirectives`,
    // `expandResponsive`, `rejectLeftoverDirectives` and `checkReferences`, in that
    // order. Nothing is stored on the PostCSS root or on the plugin instance.
    ```

  - `rejectSassSyntax`'s comment, lines 470–476, ends: "The first construct
    found fails as UXD_SASS_CONTEXT at its own line and column. Runs before
    the theme is emitted, so every node is the author's."
  - the factory, lines 960–973: one `Once(root, { result })` listener that
    calls `validateOptions`, `rejectSassSyntax`, `emitTheme`,
    `expandDirectives`, `expandResponsive`, `rejectLeftoverDirectives` and
    `checkReferences`, in that order. `command grep -c OnceExit` prints 0.
- PostCSS 8.5.31 (`packages/uxdsl/node_modules/postcss/lib/lazy-result.js`,
  `runAsync`, lines 292–343): every plugin's `Once` runs first, in plugin
  order (lines 294–304); then the visitors of every plugin, until the tree
  is clean (306–323); then every `OnceExit`, in plugin order (325–341). For
  a `Document` root, `Once` (`runOnRoot`, lines 353–362) and `OnceExit`
  (lines 327–334) run once per sub-root.
- The other plugins' listeners, as installed for §4:
  - postcss-nested 7.0.2 unwraps a nested rule in its `Rule(rule)` visitor
    (`index.js`, line 324); its `Once` only normalizes `@at-root` (line 308).
    9.0.1 has the same shape (`Rule(rule)`, line 412).
  - postcss-simple-vars 7.0.1 returns from `prepare()` the visitors
    `Declaration` (line 175), `AtRule`, `Rule` and `Comment`, and an
    `OnceExit` that only reports variables (line 162).
  - tailwindcss 3.4.19's `tailwindcss/nesting` is a `Once(root, { result })`
    listener (`lib/postcss-plugins/nesting/index.js`, line 15) that runs its
    own postcss-nested, 6.2.0, synchronously over the root
    (`lib/postcss-plugins/nesting/plugin.js`, line 47:
    `.process(root, result.opts).sync()`).
- F3's pin, `packages/uxdsl/test/no-silent-output.test.js`, lines 205–229:
  a stand-in `unwrapNested` with a `Rule` visitor, and the test
  `MIG-B9-13: in a PostCSS chain, Sass-like syntax another plugin resolves in a visitor (postcss-nested's &_title) reaches uxdsl/postcss first, in either order, because PostCSS runs every plugin's Once before any visitor; that plugin in a pass of its own first compiles`,
  which asserts `UXD_SASS_CONTEXT` for `&_title` at 2:3 in both orders, and
  `.phone_title { padding: var(--uxdsl__space__2); }` through two passes.
- The documentation of the limitation:
  - `packages/uxdsl/README.md`, lines 1500–1507, in the paragraph that
    starts at line 1486 ("The PostCSS plugin on its own (`uxdsl/postcss`)
    compiles CSS plus UXDSL, and no Sass (FEAT-010, DEC-05)."):

    > In a PostCSS chain the plugin checks the stylesheet in its `Once` listener, which PostCSS runs for every plugin before any plugin's visitors, so what another plugin resolves in a visitor reaches it first, in whichever order the plugins are listed: postcss-nested's `&_title` and postcss-simple-vars' `$gap` fail as `UXD_SASS_CONTEXT`. Run such a plugin in a PostCSS pass of its own before `uxdsl/postcss`, or move the file to `.uxdsl` and compile it with `compile()`, where Dart Sass resolves both.

  - `packages/uxdsl/docs/integrations/compile.md`, lines 538–541, under
    "The PostCSS plugin on its own" (line 514).
  - `packages/uxdsl/docs/migration.md`, lines 128–133, item 4 of
    "beta.9 — Sass inside compile()" (lines 35 and 118).
  - `packages/uxdsl/CHANGELOG.md`, lines 440–446, in MIG-B9-13's
    `### Breaking` (line 409) under `## 0.5.0-beta.9 — unreleased`: "That
    includes a PostCSS chain, in either plugin order: […] Both chains
    compiled before."
- MIG-B9-15 §15, "Owner decisions of 2026-11-04", line 335: "MIG-B9-27
  (wave 2) may remove the limitation. Decision D7 gives this story no task."
- `AGENTS.md`, lines 894–896: "The PostCSS plugin used alone
  (`uxdsl/postcss`) compiles CSS plus UXDSL and no Sass: a Sass construct
  reaching it is `UXD_SASS_CONTEXT`". `AGENTS.md` does not describe PostCSS
  chains (`command grep -n -i chain AGENTS.md` finds only "fallback chain",
  line 577).
- README §2: "No parallel parser, no duplicated default, no process-global
  cache." README §7's `plugin.ts` row (line 332): 04, 05, 13, 20, 21, 24,
  27, 30, 31, 35.

## 3. Preconditions

Recorded on `f855765` on 2026-11-10, from the repository root of a worktree
prepared as README §1.3 says. Each exits 0:

```bash
git merge-base --is-ancestor f855765 HEAD
command grep -q "rejectSassSyntax(compilation);" packages/uxdsl/src/plugin.ts            # the checks run in Once
test "$(command grep -c "OnceExit" packages/uxdsl/src/plugin.ts)" = 0                     # nothing runs at OnceExit
command grep -q "MIG-B9-13: in a PostCSS chain" packages/uxdsl/test/no-silent-output.test.js   # F3's pin
(for f in packages/uxdsl/README.md packages/uxdsl/docs/integrations/compile.md packages/uxdsl/docs/migration.md packages/uxdsl/CHANGELOG.md; do command grep -q "postcss-simple-vars" "$f" || exit 1; done)   # the documented limitation
test "$(node -p "require('./packages/uxdsl/node_modules/postcss/package.json').version")" = 8.5.31   # the run order of §2
command grep -q "plugin.ts" scripts/verify-docs-update.js                                   # a visual-default file: the CHANGELOG is required with it
test -f packages/uxdsl/dist/plugin.js                                                       # §4 runs the built plugin
node --test --test-name-pattern "MIG-B9-13: in a PostCSS chain" packages/uxdsl/test/no-silent-output.test.js   # 1 pass, 27 skipped by the pattern
```

When the story starts, these four start gates must also exit 0. On
`f855765` each exits 1, as expected: none of the four stories is merged yet.
Each checks the base itself (HEAD's tree), not a commit subject.

```bash
! command grep -q "includeTheme" packages/uxdsl/src/types.ts                                                                # MIG-B9-20 is in the base: the option is gone
test ! -f packages/uxdsl/src/ds-runtime/breakpoints.ts                                                                     # MIG-B9-21 is in the base: K4 deleted the file
! command grep -qx "To be filled in the delivering PR." docs/features/FEAT-010/MIG-B9-25-suites-remove-temp-dirs.md             # MIG-B9-25 is in the base: its closure record is filled
! command grep -qx "To be filled in the delivering PR." docs/features/FEAT-010/MIG-B9-26-near-misses-debug-isolation.md         # MIG-B9-26 is in the base (both parts' files, if the owner splits it)
```

On that base every line above, and §4, are run again. MIG-B9-20 removes
`includeTheme` and MIG-B9-21 rewrites `plugin.ts`'s comments (K7), so a line
number quoted in §2 may move; a precondition that only went stale is
corrected here, with the old and the new value in §15 (README §1.4).

## 4. Baseline

The real plugins are installed under a scratch directory, never in the
worktree. From the repository root, with `packages/uxdsl/dist` built:

```bash
SCRATCH=<an empty directory outside the repository>
for d in chain chain-latest; do mkdir -p "$SCRATCH/$d" && echo '{"private":true}' > "$SCRATCH/$d/package.json"; done
(cd "$SCRATCH/chain" && npm install --ignore-scripts --no-audit --no-fund postcss-nested@7.0.2 postcss-simple-vars@7.0.1 tailwindcss@3.4.19)
(cd "$SCRATCH/chain-latest" && npm install --ignore-scripts --no-audit --no-fund postcss-nested@latest)
# write chain.js and alone.js, below, into $SCRATCH; then:
node "$SCRATCH/chain.js" packages/uxdsl "$SCRATCH/chain"
node "$SCRATCH/chain.js" packages/uxdsl "$SCRATCH/chain-latest"
node "$SCRATCH/alone.js" packages/uxdsl
```

`chain.js`:

```js
'use strict';
// node chain.js <uxdsl package dir> <dir whose node_modules hold the other plugins>
// Each input through uxdsl/postcss and one other plugin, in both orders, in one
// PostCSS run: the rule uxdsl/postcss compiled, or its error and position.
const path = require('node:path');
const [uxdslDir, chainDir] = process.argv.slice(2).map((p) => path.resolve(p));
const load = (name) => { const m = require(require.resolve(name, { paths: [chainDir] })); return m.default || m; };
const version = (name) => { try { return require(require.resolve(`${name}/package.json`, { paths: [chainDir] })).version; } catch { return null; } };
const postcss = require(require.resolve('postcss', { paths: [uxdslDir] }));
const exported = require(path.join(uxdslDir, 'dist/plugin.js'));
const uxdsl = () => (exported.default || exported)({ discoverTheme: false });
const nested = '.phone {\n  &_title {\n    padding: space(2);\n  }\n}\n';
const cases = [
  ['postcss-nested', 'postcss-nested', nested, /\.phone_title \{[^}]*\}/],
  ['postcss-simple-vars', 'postcss-simple-vars', '$gap: 4px;\n.card {\n  padding: $gap;\n  margin: space(2);\n}\n', /\.card \{[^}]*\}/],
  ['tailwindcss', 'tailwindcss/nesting', nested, /\.phone_title \{[^}]*\}/],
  ['postcss-simple-vars', 'postcss-simple-vars', '$n: 2;\n.card {\n  padding: space($n);\n}\n', /\.card \{[^}]*\}/],
  ['postcss-simple-vars', 'postcss-simple-vars', '$pad: space(2);\n.card {\n  padding: $pad;\n}\n', /\.card \{[^}]*\}/],
  ['postcss-simple-vars', 'postcss-simple-vars', '$pad: xs(1rem) md(2rem);\n.card {\n  padding: $pad;\n}\n', /\.card \{[^}]*\}/],
].filter(([pkg]) => version(pkg));

(async () => {
  for (const [pkg, plugin, source, pick] of cases) {
    for (const order of ['other first', 'uxdsl first']) {
      const plugins = order === 'other first' ? [load(plugin)(), uxdsl()] : [uxdsl(), load(plugin)()];
      const label = `${plugin} ${version(pkg)}, ${order}, ${JSON.stringify(source.split('\n')[source.startsWith('$') ? 0 : 1].trim())}`;
      try {
        const { css } = await postcss(plugins).process(source, { from: '/project/src/app.css' });
        console.log(`${label}: compiled ${(css.match(pick) || ['(rule not found)'])[0].replace(/\s+/g, ' ')}`);
      } catch (error) {
        console.log(`${label}: ${error.line}:${error.column} ${(error.reason || error.message).split(';')[0]}`);
      }
    }
  }
})();
```

`alone.js`:

```js
'use strict';
// node alone.js <uxdsl package dir>
// The plugin alone on stylesheets that hold Sass and something UXDSL's own steps
// read: the error each one fails with, and where.
const path = require('node:path');
const dir = path.resolve(process.argv[2]);
const postcss = require(require.resolve('postcss', { paths: [dir] }));
const exported = require(path.join(dir, 'dist/plugin.js'));
const uxdsl = () => (exported.default || exported)({ discoverTheme: false });
const inputs = [
  ['P1', '@use "sass:math";\n.a {\n  padding: space(99);\n}\n'],
  ['P2', '.a {\n  padding: space($gap);\n}\n'],
  ['P3', '.a {\n  padding: xs($gap) md(2rem);\n}\n'],
  ['P4', '@mixin card {\n  @ds-surface(contained);\n}\n'],
  ['P5', '.a {\n  @if $wide {\n    @ds-surface(contained);\n  }\n}\n'],
  ['P6', '.a {\n  color: palete($tone);\n}\n'],
  ['P7', '.a {\n  &__title {\n    padding: xs(1rem) md(2rem);\n  }\n}\n'],
  ['P8', '.a {\n  &__title {\n    @ds-surface(contained);\n  }\n}\n'],
  ['P9', '$pad: xs(1rem) md(2rem);\n.a {\n  padding: $pad;\n}\n'],
  ['P10', '.a {\n  margin: space(99);\n  padding: space(2) // inner\n}\n'],
];
(async () => {
  for (const [id, source] of inputs) {
    try {
      await postcss([uxdsl()]).process(source, { from: '/project/src/app.css' });
      console.log(`${id}: compiled`);
    } catch (error) {
      console.log(`${id}: ${error.line}:${error.column} ${(error.reason || error.message).split(';')[0]}`);
    }
  }
})();
```

Neither script passes `includeTheme`: on `f855765` the theme is emitted at
the top of each output, and after MIG-B9-20 it is not emitted, since no input
writes the marker; the printed lines are the same either way.

Recorded on `f855765`, 2026-11-10, Node 20.19.0, npm 11.21.1, PostCSS
8.5.31; `postcss-nested@latest` installed 9.0.1. Each command exited 0. The
output, exactly (each `UXD_SASS_CONTEXT` reason is cut at its first `;`; the
full reason is `<construct> is Sass; the PostCSS plugin compiles CSS plus
UXDSL. Name the file .uxdsl and compile it with uxdsl build, compile() or an
adapter, or remove the Sass.`):

```text
postcss-nested 7.0.2, other first, "&_title {": 2:3 UXD_SASS_CONTEXT: &_title is Sass
postcss-nested 7.0.2, uxdsl first, "&_title {": 2:3 UXD_SASS_CONTEXT: &_title is Sass
postcss-simple-vars 7.0.1, other first, "$gap: 4px;": 1:1 UXD_SASS_CONTEXT: $gap is Sass
postcss-simple-vars 7.0.1, uxdsl first, "$gap: 4px;": 1:1 UXD_SASS_CONTEXT: $gap is Sass
tailwindcss/nesting 3.4.19, other first, "&_title {": compiled .phone_title { padding: var(--uxdsl__space__2); }
tailwindcss/nesting 3.4.19, uxdsl first, "&_title {": 2:3 UXD_SASS_CONTEXT: &_title is Sass
postcss-simple-vars 7.0.1, other first, "$n: 2;": 1:1 UXD_SASS_CONTEXT: $n is Sass
postcss-simple-vars 7.0.1, uxdsl first, "$n: 2;": 1:1 UXD_SASS_CONTEXT: $n is Sass
postcss-simple-vars 7.0.1, other first, "$pad: space(2);": 1:1 UXD_SASS_CONTEXT: $pad is Sass
postcss-simple-vars 7.0.1, uxdsl first, "$pad: space(2);": 1:1 UXD_SASS_CONTEXT: $pad is Sass
postcss-simple-vars 7.0.1, other first, "$pad: xs(1rem) md(2rem);": 1:1 UXD_SASS_CONTEXT: $pad is Sass
postcss-simple-vars 7.0.1, uxdsl first, "$pad: xs(1rem) md(2rem);": 1:1 UXD_SASS_CONTEXT: $pad is Sass
```

```text
postcss-nested 9.0.1, other first, "&_title {": 2:3 UXD_SASS_CONTEXT: &_title is Sass
postcss-nested 9.0.1, uxdsl first, "&_title {": 2:3 UXD_SASS_CONTEXT: &_title is Sass
```

```text
P1: 1:1 UXD_SASS_CONTEXT: @use is Sass
P2: 2:18 UXD_SASS_CONTEXT: $gap is Sass
P3: 2:15 UXD_SASS_CONTEXT: $gap is Sass
P4: 1:1 UXD_SASS_CONTEXT: @mixin is Sass
P5: 2:3 UXD_SASS_CONTEXT: @if is Sass
P6: 2:17 UXD_SASS_CONTEXT: $tone is Sass
P7: 2:3 UXD_SASS_CONTEXT: &__title is Sass
P8: 2:3 UXD_SASS_CONTEXT: &__title is Sass
P9: 1:1 UXD_SASS_CONTEXT: $pad is Sass
P10: 3:21 UXD_SASS_CONTEXT: a // comment is Sass
```

What it shows:

- F3 reproduces with the real plugins: postcss-nested (7.0.2 and 9.0.1) and
  postcss-simple-vars 7.0.1 fail in both orders.
- `tailwindcss/nesting`, which D7 asks this story to verify, compiles on
  BASE when it is listed before `uxdsl/postcss`, because it flattens the
  stylesheet in its own `Once`; listed after, it fails like postcss-nested.
- P1 to P10 are BASE's errors for the plugin alone on stylesheets that hold
  Sass and something UXDSL's own steps read (a token, a responsive value, a
  directive, a near-miss). C1 keeps them.

On the story's base, after MIG-B9-20 and MIG-B9-21, the three commands are
run again and their output compared with this record (README §1.5). A
different line is a finding for §15, and the base's output is then the one
C1 keeps.

## 5. Contract

The change, if adopted, moves only the Sass-syntax checks, wholly or in
part, to `OnceExit`. UXDSL's own steps (`validateOptions`, `emitTheme`,
`expandDirectives`, `expandResponsive`, `rejectLeftoverDirectives`,
`checkReferences`) stay in `Once`, in that order (D7: "only the Sass-syntax
checks move"). BASE is `git merge-base HEAD origin/feat/beta9`. "The two
passes" for an input and another plugin are the documented workaround:
`postcss([other]).process(source, { from })`, then
`postcss([uxdsl(opts)]).process(first.css, { from })`. Two CSS results are
equal when `postcss.parse(css)` followed by `root.cleanRaws()` prints the
same text. Two errors are equal when their `name`, `reason`, `line` and
`column` are.

- **C1 — The plugin alone is unchanged.** For every input,
  `postcss([uxdsl(opts)]).process(css, processOptions)` returns what it
  returns on BASE:
  - the CSS, byte for byte;
  - `result.warnings()` (text, line and column), and the calls to
    `references.onWarning`, in order;
  - the error: name, `reason`, `line`, `column`, `endLine`, `endColumn`.

  That includes a stylesheet holding Sass and something UXDSL's own steps
  read or reject: §4's P1 to P10 keep BASE's errors (Q2 in §15). Every
  `UXD_SASS_CONTEXT` reason keeps its text (`sassContext`, `keptBySass`).
  Pinned by the package suites as they are on BASE, and by T4 and T5.
- **C2 — `compile()` and every host are unchanged.** `compile()`, the CLI,
  `uxdsl/vite` and `uxdsl/webpack` return BASE's `css`, `map`,
  `dependencies`, `warnings` and errors (and `error.warnings`, which
  MIG-B9-21 adds), for every input. Pinned by the package suites (core,
  cli, vite, webpack), the parity oracles without `--update`, the Sass
  corpus, the playground's build and `verify:1.0`, whose DE-9 is Next.js
  with PostCSS only.
- **C3 — P10's budget holds.** MIG-B9-23's C1, as merged: on the machine
  where P10 was measured (`sysctl -n hw.model` prints `MacBookPro18,3`),
  `node fixtures/sass-corpus/run.js` exits 0 on three consecutive
  invocations, the first three after the last change to `plugin.ts`. A
  plugin with an `OnceExit` listener turns on PostCSS's visitor walk over
  the whole tree (`lazy-result.js`, line 289: `hasListener` counts every
  listener; lines 306–323), on every compilation, `compile()` included
  (§7 measured it).
- **C4 — Nothing silent in a chain.** For each input of T3 and T7, each
  other plugin and each order, the result of one PostCSS run is either the
  two passes' CSS, or BASE's error for that run. Anything else fails C4: CSS
  that differs from the two passes, or another error.
- **C5 — The registered chains compile.** In both orders, one PostCSS run
  gives the two passes' CSS for the inputs decision D7 and MIG-B9-13's flag 8
  name:
  - postcss-nested 7.0.2: §4's `&_title` input;
  - postcss-simple-vars 7.0.1: §4's `$gap: 4px` input;
  - `tailwindcss/nesting` from tailwindcss 3.4.19 (its `v3-lts` tag;
    tailwindcss 4 has no `tailwindcss/nesting`): §4's `&_title` input.

  Further inputs are evidence, not part of C5, and do not decide the
  outcome: the latest postcss-nested published when the story starts (9.0.1
  on 2026-11-10) with §4's `&_title` input, and the same rule holding
  `padding: xs(1rem) md(2rem)`, `@ds-surface(contained)` or
  `@ds-button(contained)` in place of its declaration. T1 and T7 run them,
  C4 applies to them (the two passes' CSS or BASE's error, nothing else),
  and §14 records which compiled.
- **C6 — The decision rule.** Outcome A, adopted, if and only if C1 to C5
  all hold with the change described above. Otherwise outcome B. No other
  outcome exists: a change that meets some of C1 to C5 and not the others
  is outcome B.
- **C7 — Outcome A delivers:**
  - `plugin.ts`: the change, its per-compilation state kept per root inside
    `prepare()` (never on the plugin object or the root), and the header and
    `rejectSassSyntax`'s comment stating the new contract;
  - F3's pin, inverted: in both orders the stand-in chain compiles (T6);
  - T1 to T5 and the fixture T7;
  - the documentation of §11, which states that a plugin resolving `&`
    selectors or `$variables` in its visitors, or in its own `Once`, may be
    listed before or after `uxdsl/postcss`; which Sass constructs still fail
    as `UXD_SASS_CONTEXT` in a chain, as T3 pins them; and the workaround,
    unchanged, for those.
- **C8 — Outcome B delivers:** this story file only. `plugin.ts`, F3's pin
  and the documentation stay as on BASE. §14 records:
  - for each of C1 to C5 that failed, the input, BASE's result and the
    change's;
  - §4's three commands run on the delivering base;
  - the verification of `tailwindcss/nesting`: listed before
    `uxdsl/postcss` it compiles, listed after it fails.

No `UXD_*` code is added or changed. Every command named in §9 exits 0
unless §9 says otherwise.

Must stay byte-identical with BASE, in both outcomes:

- every output, warning and error of the plugin alone for the package
  suites' inputs and §4's P1 to P10;
- the parity oracles, `fixtures/parity/expected/**`, without `--update`;
- the Sass corpus through `compile()`: 276,926 bytes, equal to Dart Sass's,
  with its 21 warnings;
- the playground's `src/app/uxdsl.css` (`unchanged src/app/uxdsl.css`),
  `src/generated/examples.json`, and the CLI and compiler captures;
- the gate's verdicts (`verify:1.0`), DE-9 included;
- `DIAGNOSTIC_CATALOG`: BASE's codes, `UXD_SASS_CONTEXT`'s meaning and fix
  included.

## 6. Out of scope

- **Moving UXDSL's own steps to `OnceExit`** (flag 8's option (b), whole):
  D7 registered the narrower form only. A construct UXDSL's steps read
  (a token's `$variable` argument, a `$variable` holding a token or a
  responsive value) keeps failing in a chain. A new owner decision would be
  needed; no story is registered.
- **Making chain cases a warning** (flag 8's option (c)): not chosen by D7.
- **Other PostCSS plugins** (postcss-nesting, postcss-mixins, whose
  `@mixin` is a Sass at-rule name to this plugin, postcss-for,
  postcss-each, …): not registered and not verified.
- **What PostCSS's parser rejects first** (MIG-B9-13's CT-5, flag 7,
  accepted by D18): unchanged, since it fails before any plugin runs.
- **`compile()`**: Dart Sass runs before the plugin there; C2 keeps it as
  it is.
- **The plugin's fixed per-build costs**, the visitor walk of C3 included:
  MIG-B9-24.

## 7. Approach and traps

Non-normative. Two prototypes were measured while writing the story, on
copies of `f855765`'s `packages/uxdsl` under a scratch directory, with the
compiled `dist/plugin.js` edited. Neither is committed. Timings were taken
while MIG-B9-20's workflow ran its suites, builds and Chrome on the same
machine (load average 14–20): they are indicative only.

**Prototype N, the naive move.** `rejectSassSyntax` is called from an
`OnceExit` listener, over the whole root, instead of from `Once`.

- The registered chains compile, in both orders, for every plugin of §4,
  postcss-nested 9.0.1 included.
- The package's top-level suite gave 723 tests, 720 passing. The failures
  were F3's pin, as expected, and two tests that need the repository around
  the package, which fail the same way in an unedited copy (MIG-B6-25 and
  MIG-B6-27). Both pass in the worktree
  (`node --test test/reference-integrity-equivalence.test.js test/theme-schema.test.js`,
  17 of 17). The core suite gave 342 tests, 341 passing and 1 skipped, as
  BASE. The CLI, Vite, webpack and performance suites were not run.
- It breaks C1. `alone.js` gives, for P1, P2, P4, P5, P6 and P10, another
  error than BASE:

  | Input | BASE | Prototype N |
  | --- | --- | --- |
  | P1 | `1:1 UXD_SASS_CONTEXT: @use is Sass` | `3:12 UXD_SPACE_REFERENCE: space(99) does not exist` |
  | P2 | `2:18 UXD_SASS_CONTEXT: $gap is Sass` | `2:12 UXD_TOKEN_KEY: space($gap) is not a token key: space(k).` |
  | P4 | `1:1 UXD_SASS_CONTEXT: @mixin is Sass` | `2:3 UXD_DIRECTIVE_CONTEXT: Directives apply to a whole rule and are not responsive` |
  | P5 | `2:3 UXD_SASS_CONTEXT: @if is Sass` | `3:5 UXD_DIRECTIVE_CONTEXT: …` |
  | P6 | `2:17 UXD_SASS_CONTEXT: $tone is Sass` | `2:10 UXD_FUNCTION_UNKNOWN: palete() is not a function CSS or UXDSL knows` |
  | P10 | `3:21 UXD_SASS_CONTEXT: a // comment is Sass` | `2:11 UXD_SPACE_REFERENCE: space(99) does not exist` |

  For P2, P4 and P5 the only problem is Sass, and the error no longer names
  the fix DEC-05 requires.
- It breaks C4. With postcss-simple-vars, in both orders,
  `$pad: xs(1rem) md(2rem); .a { padding: $pad; }` compiles to
  `.a { padding: 1rem; } @media (min-width: 768px) {}`: the `md` value
  is lost, silently, where the two passes give it. `expandResponsive` split
  the root-level `$pad` declaration in `Once`, before postcss-simple-vars
  read it. And `$n: 2; … space($n)` fails as `UXD_TOKEN_KEY` instead of
  BASE's error.
- On the playground's compiled `src/app/uxdsl.css` (332,328 characters),
  the plugin alone with `references: { mode: 'off' }`, 21 interleaved rounds
  at 09:08 EST, load 15.3: BASE 48.9 ms, prototype N 53.1 ms (+4.2 ms), the
  CSS byte-identical.

**Prototype V, deferring only what UXDSL's steps leave alone.** In
`prepare()`, a `WeakMap` keyed by root holds the state.

- In `Once`: `validateOptions`; then every node the Sass check rejects is
  collected, without throwing, with the error the check builds for it and
  the node's own text (a declaration's property and value, a rule's
  selector, an at-rule's name and prelude).
- Then the steps run:
  - if a step throws while a finding is pending, the first finding's error
    is thrown, which is BASE's error;
  - if a step changed or removed a node that holds a finding, the first
    finding's error is thrown;
  - otherwise the findings are kept for `OnceExit`.
- In `OnceExit`: the first kept finding whose node is still in the root,
  with the same own text, throws its stored error. If none does, the check
  runs again over the root, skipping the theme's generated nodes.

Results:

- `alone.js` printed BASE's ten lines exactly.
- `chain.js`: the three registered inputs compile in both orders, for every
  plugin and version of §4; the three other inputs fail with BASE's errors.
- Against the two passes: postcss-nested's `&_title` holding a token, a
  responsive value, `@ds-surface` and `@ds-button`, postcss-simple-vars'
  `$gap` and `tailwindcss/nesting`'s responsive value are equal to the two
  passes, in both orders. `$n`, `$pad: space(2)` and
  `$pad: xs(1rem) md(2rem)` fail with BASE's errors. Prototype N had
  compiled `$pad: space(2)` correctly; V refuses it because `expandResponsive`
  rewrote the declaration that holds `$pad`. C4 allows either.
- The suites gave the same counts as prototype N: 720 of 723 top-level
  tests, failing only F3's pin and the two copy-only tests, and core 341
  passing with 1 skipped.
- On the same stylesheet, at 09:11 EST, load 20.4: BASE 53.7 ms, V 58.9 ms
  (+5.3 ms).
- It still breaks C1, on warnings. With `references: { mode: 'warn',
  onWarning }`, `.a { padding: calc(space(2) + var(--nope)); } .b { &__x { color: red; } }`
  calls `onWarning` once (`UXD_REFERENCE_MISSING: padding -> --nope …`) and
  then throws `&__x`'s error; BASE throws without calling it. Buffering what
  the steps report (`result.warn`, `references.onWarning`) while a finding
  is pending, and releasing it only when `OnceExit` passes, is the evident
  fix. It was not prototyped.

Traps:

- **State per root, never on the plugin or the root.** PostCSS calls
  `Once` and `OnceExit` once per sub-root of a `Document`, and one plugin
  object serves many `process()` calls (a dev server). `prepare()` returns
  new listeners per `process()` call; keep a map from root to state there
  (`plugin.ts` line 35; README §2).
- **BASE's error is built before the steps.** Store the error of each
  finding when it is collected, and throw that object, so its reason and
  position are BASE's whatever a step did afterwards.
- **What a step reads is wider than values.** The steps read a directive's
  ancestors (P4, P5: `UXD_DIRECTIVE_CONTEXT`), every function call (P6: the
  near-miss check), a root-level declaration (prototype N's `$pad`), and a
  rule the responsive split empties, which it removes. Wave 3 adds more:
  MIG-B9-30 reads `@media` preludes. A test on what the steps changed or
  removed (prototype V) follows the steps as they are; a list of
  "places UXDSL reads" would have to be kept in step with them.
- **Warnings and `error.warnings`.** C1 and C2 include the warnings, the
  `onWarning` calls and MIG-B9-21's `error.warnings`. A failing compilation
  on BASE reports none of the steps' warnings, because the steps never ran.
- **Skip what the theme generated.** The check at `OnceExit` sees the theme
  and every expanded directive. `c.generated` marks the theme's nodes; T4
  and the package suites show whether anything else needs skipping.
- **Stand-ins must match the real hooks.** postcss-nested and
  postcss-simple-vars resolve in visitors; `tailwindcss/nesting` resolves
  in its own `Once` and then marks every node dirty (its `markDirty`), so
  the visitors of later plugins run again. T1 and T2's stand-ins reproduce
  each timing; T7 runs the real plugins.
- **Documentation examples are compiled.** `scripts/doc-examples.test.js`
  compiles every `css` example with the plugin alone. A chain cannot be
  shown as a compiled `css` example: show the `postcss.config.js` in a `js`
  fence, or describe it in prose.

Stop rule: if C1 to C5 cannot all hold while UXDSL's own steps stay in
`Once`, stop and deliver outcome B (C8). Never move a step to `OnceExit`,
weaken or delete a C1 pin, update a parity oracle, change a
`UXD_SASS_CONTEXT` reason, or narrow C5's list to reach outcome A.

## 8. Tests

Outcome A commits T1 to T7; outcome B commits none (C8). T1, T2 and T6 are
the failing-first tests: they fail on BASE. T3, T4 and T5 state what the
change must keep, so they pass on BASE by design; each negative control
shows that its test can fail.

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `packages/uxdsl/test/postcss-chain.test.js` (new) | `MIG-B9-27: a nesting plugin's &_title compiles with uxdsl/postcss listed before or after it, to what the two passes give; with a responsive value, @ds-surface or @ds-button inside, it gives the two passes' CSS or BASE's error` | unit | C5 (the token input), C4 (C5's evidence inputs) | a Rule-visitor stand-in (as postcss-nested) and a Once stand-in that marks nodes dirty (as `tailwindcss/nesting`); the same stand-ins configured to leave `&_title` in place give BASE's error, `&_title` at 2:3, in both orders |
| T2 | same | `MIG-B9-27: a variables plugin's $gap compiles with uxdsl/postcss listed before or after it, to what the two passes give` | unit | C5 | a Declaration-visitor stand-in (as postcss-simple-vars) that resolves nothing gives BASE's error, `$gap` at 1:1 |
| T3 | same | `MIG-B9-27: in a chain, a Sass construct UXDSL's own steps read fails as on BASE, never as other CSS` | unit | C4 | for `$n` in `space($n)`, `$pad: space(2)` and `$pad: xs(1rem) md(2rem)`, the test asserts first that the two passes compile, so a chain that compiled, or lost `md`'s value, would be seen |
| T4 | same | `MIG-B9-27: the plugin alone reports BASE's error for a stylesheet holding Sass and something UXDSL's own steps read (P1 to P10)` | unit | C1 | each input's twin, its Sass construct replaced by CSS (`$gap` by `2`, `@mixin card` by `.card`, `&__title` by `.title`), compiles or fails with another code than the pinned one, so the pin holds only while the Sass check comes first |
| T5 | same | `MIG-B9-27: while a Sass construct is pending, the plugin alone reports no warning and calls no onWarning before its error` | unit | C1 | the same stylesheet without its `&__x` rule warns `UXD_REFERENCE_MISSING` once, through both `result.warnings()` and `onWarning`, so the test sees warnings when there are some |
| T6 | `packages/uxdsl/test/no-silent-output.test.js` (F3's pin, rewritten and renamed) | `MIG-B9-27: in a PostCSS chain, Sass-like syntax another plugin resolves in a visitor (postcss-nested's &_title) compiles with uxdsl/postcss in either order, as through two passes` | unit | C5 | without the stand-in, `&_title` is BASE's error at 2:3 |
| T7 | `fixtures/mig-b9-27-postcss-chain/run.js` (new; network; run by hand) | the real plugins of C5 at their versions, and the latest postcss-nested, installed into a temporary directory the fixture removes: §4's six inputs and C5's evidence inputs, in both orders, each against the two passes | fixture | C4, C5 | `--uxdsl <a build of BASE>` exits 1, printing §4's errors |
| T8 | the package suites, unedited (`no-silent-output.test.js`'s other tests, `core/sass-pipeline.test.js`, `diagnostics-catalog.test.js`, `near-miss-functions.test.js`, core, cli, vite, webpack) | unchanged outcomes | all | C1, C2 | — (invariant) |
| T9 | `fixtures/parity/run.js`, `npm run verify:1.0 -- --skip-playground-walk`, `npm --prefix packages/playground-nextjs run uxdsl:build` | unchanged outputs and verdicts, DE-9 included | all | C2 | — (invariant) |
| T10 | `fixtures/sass-corpus/run.js`, unedited, the first three invocations after the last change to `plugin.ts` | its own output | fixture | C3 | MIG-B9-23's slow wrapper (`fixtures/mig-b9-23-compile-budget/run.js`, its T2) exits 1 |

## 9. Acceptance criteria

BASE is `git merge-base HEAD origin/feat/beta9`.

Outcome A:

- **AC1** `node --test packages/uxdsl/test/postcss-chain.test.js packages/uxdsl/test/no-silent-output.test.js`
  exits 0.
  - Test files: `postcss-chain.test.js`, `no-silent-output.test.js`.
  - Mutations: BASE's factory, the check in `Once` before the steps, fails
    T1, T2 and T6; prototype N (§7) fails T3 (`$pad`'s `md` value lost) and
    T4 (P2 is `UXD_TOKEN_KEY`); prototype V without buffering fails T5.
- **AC2** `node fixtures/mig-b9-27-postcss-chain/run.js` exits 0 and prints
  `ok` for every input of C5 in both orders, and, for each of C5's evidence
  inputs, `ok` or BASE's error (C4: never other CSS or another error);
  `node fixtures/mig-b9-27-postcss-chain/run.js --uxdsl <a build of BASE>`
  exits 1 and prints §4's errors.
  - Test file: `fixtures/mig-b9-27-postcss-chain/run.js`.
  - Mutation: BASE's build, as given.
- **AC3** `node fixtures/parity/run.js` exits 0 without `--update`, and
  `git diff --exit-code "$(git merge-base HEAD origin/feat/beta9)" -- fixtures/parity/expected`
  exits 0.
  - Test file: `fixtures/parity/run.js`.
  - Mutation: none; an invariant guard, like C2.
- **AC4** `npm test` exits 0; `npm run verify:1.0 -- --skip-playground-walk`
  exits 0 with DE-9 `ok`; `npm --prefix packages/playground-nextjs run uxdsl:build`
  exits 0 and prints `unchanged src/app/uxdsl.css`.
  - Test files: the suites `npm test` runs; `fixtures/release-1.0/run.js`.
  - Mutation: AC1's, which `npm test` runs; the rest are invariant guards.
- **AC5** On the machine where `sysctl -n hw.model` prints `MacBookPro18,3`,
  `node fixtures/sass-corpus/run.js` exits 0 on three consecutive
  invocations, the first three after the last change to `plugin.ts`, none
  discarded or repeated. §14 records each one's start time, load average,
  `$TMPDIR` entry count and output.
  - Test file: `fixtures/sass-corpus/run.js`, unedited from BASE.
  - Mutation: MIG-B9-23's slow wrapper exits 1.

Outcome B:

- **AC6** `git diff --name-only "$(git merge-base HEAD origin/feat/beta9)"`
  prints only `docs/features/FEAT-010/MIG-B9-27-postcss-chain.md`. §14
  names each of C1 to C5 that failed, with its input and both results, and
  holds §4's three commands run on the delivering base.
  - Test file: none; the record is the evidence.
  - Mutation: none.

Owner checks, never marked PASS by the agent:

- Answer §15's open questions before the story starts.
- Read the outcome in the PR body, and the evidence behind it.

## 10. Generated artifacts and guards

| Artifact | Outcome A | Outcome B |
| --- | --- | --- |
| CHANGELOG | yes: `plugin.ts` is in `VISUAL_DEFAULT_FILES` (`scripts/verify-docs-update.js`, line 78), so the docs guard requires it in the same commit; one subsection, `### Visual changes`: none | no |
| package README | yes: the chain sentences rewritten (§11), which also meets the guard | no |
| `verify-docs-update.js` classification | no (no file added under `src`) | no |
| `npm run generate:language` | no | no |
| `AGENTS.md` + agent guide | no: `AGENTS.md` does not describe PostCSS chains (§2) | no |
| `DIAGNOSTIC_CATALOG` | no | no |
| `npm run generate:capabilities` | no | no |
| playground `uxdsl:build` + captures | run, with no change expected (`unchanged src/app/uxdsl.css`; `npm test` checks the captures) | no |
| `migration.md` | yes (item 4) | no |

## 11. Documentation

Outcome A only:

- `packages/uxdsl/README.md`: the chain sentences of the paragraph that
  starts at line 1486 (lines 1500–1507 on `f855765`), rewritten as C7
  says.
- `packages/uxdsl/docs/integrations/compile.md`: "The PostCSS plugin on its
  own", the bullet at lines 538–541.
- `packages/uxdsl/docs/migration.md`: item 4 of "beta.9 — Sass inside
  compile()", lines 128–133.
- `packages/uxdsl/CHANGELOG.md`: one subsection under
  `## 0.5.0-beta.9 — unreleased`, `### uxdsl/postcss in a PostCSS chain (MIG-B9-27)`,
  with `### Visual changes`: none. It says that the PostCSS-chain item of
  MIG-B9-13's `### Breaking` (lines 440–446 on `f855765`) no longer holds
  (Q3 in §15).
- `fixtures/mig-b9-27-postcss-chain/README.md` (new): what the fixture
  installs (network), at which versions, the two passes it compares
  against, and `--uxdsl`.
- `packages/uxdsl/src/plugin.ts`: the header (lines 3–8 and 31–35) and
  `rejectSassSyntax`'s comment (lines 470–476) state the new contract,
  without a story id.

Outcome B: none.

## 12. Verification

Outcome A:

```bash
node --test packages/uxdsl/test/postcss-chain.test.js packages/uxdsl/test/no-silent-output.test.js   # exit 0
node fixtures/mig-b9-27-postcss-chain/run.js                                     # exit 0; network
node fixtures/mig-b9-27-postcss-chain/run.js --uxdsl <a build of BASE>           # exit 1, §4's errors
node fixtures/parity/run.js                                                      # exit 0
npm test                                                                         # background; exit 0
npm run verify:1.0 -- --skip-playground-walk                                     # background; exit 0, DE-9 ok
npm --prefix packages/playground-nextjs run uxdsl:build                          # exit 0; unchanged src/app/uxdsl.css
node fixtures/sass-corpus/run.js                                                 # MacBookPro18,3: the first 3 after the last change to plugin.ts, in a row, each with date, sysctl -n vm.loadavg and the $TMPDIR count; exit 0 each
```

Outcome B:

```bash
git diff --name-only "$(git merge-base HEAD origin/feat/beta9)"                  # only this story file
node "$SCRATCH/chain.js" packages/uxdsl "$SCRATCH/chain"                         # §4, on the delivering base; exit 0
node "$SCRATCH/chain.js" packages/uxdsl "$SCRATCH/chain-latest"                  # exit 0
node "$SCRATCH/alone.js" packages/uxdsl                                          # exit 0
```

## 13. Delivery

Branch `feat/b9-27-postcss-chain`.

Commit, outcome A:
`feat(FEAT-010): MIG-B9-27 - uxdsl/postcss checks Sass syntax at OnceExit, so postcss-nested, postcss-simple-vars and tailwindcss/nesting chain with it in either order`.

Commit, outcome B:
`docs(FEAT-010): MIG-B9-27 - OnceExit not adopted: the evidence recorded, the documentation kept`.

PR title: `FEAT-010: MIG-B9-27 - uxdsl/postcss in a PostCSS chain`. The body:

- **Outcome:** A or B, in one sentence, with the C-n that decided it.
- **Goal:** §1, in two sentences.
- **Outcome A:** C5's chains, before and after (§4's output and T7's);
  C1's pins (T4, T5); C2's invariants (parity, `npm test`, `verify:1.0`,
  `uxdsl.css` unchanged); C3's three corpus runs.
- **Outcome B:** each failed C-n, with its input and both results.
- **Not run, or not a pass:** what §14 lists.
- **Owner checks:** the list in §9.
- The last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Findings while writing the story (2026-11-10, `f855765`)

1. **`tailwindcss/nesting` listed first already compiles.** It flattens in
   its own `Once`, which PostCSS runs in plugin order, so it reaches
   `uxdsl/postcss` resolved (§4). Listed after, it fails like
   postcss-nested. The documentation's claim is about what another plugin
   resolves "in a visitor", so it stays true, but it does not name
   `tailwindcss/nesting`. In outcome B the documentation is kept, as D7
   accepts the limitation as documented; §14 records the verification.
2. **The latest postcss-nested.** 9.0.1 (published 2026-10-21) is
   ESM-only and declares `"engines": { "node": "^22.0.0 || ^24.0.0 || >= 26.0.0" }`,
   while `uxdsl`'s floor is 20.19 (D10). It loads on Node 20.19.0 through
   `require(esm)` and behaves as 7.0.2 in §4.
3. **The suites do not pin what prototype N breaks.** No test on BASE fixes
   which error the plugin alone reports for a stylesheet that holds Sass and
   something UXDSL's own steps read (prototype N changes P1, P2, P4, P5, P6
   and P10), nor the warnings before a Sass error: prototype N passed every
   test but F3's pin. Outcome A adds T4 and T5. Outcome B adds no test (C8).
4. **Files outside README §7.** `packages/uxdsl/test/no-silent-output.test.js`
   (MIG-B9-13, MIG-B9-20, MIG-B9-25, MIG-B9-28 and this story),
   `packages/uxdsl/docs/migration.md` (MIG-B9-20, MIG-B9-26, MIG-B9-30 to
   36, MIG-B9-52, MIG-B9-60 and this story) and
   `packages/uxdsl/docs/integrations/compile.md` (MIG-B9-13, MIG-B9-15,
   MIG-B9-26 and this story) had no row in README §7. The PR that adds this
   file adds them; on them this story waits for MIG-B9-25 and 26, and
   MIG-B9-28 and wave 3's MIG-B9-30 to 36 wait for it.

### Open questions for the owner (answer before implementing)

1. **Q1 — Where the real plugins come from.** C5 names real plugins at
   pinned versions. `npm test` runs offline today, and
   `packages/uxdsl/package.json` is a shared file (README §7: MIG-B9-01,
   02, 10, 12, 13 and 91).
   - (a) Add postcss-nested, postcss-simple-vars and tailwindcss 3 as
     devDependencies of `packages/uxdsl`, and test them in `npm test`. The
     three brought 75 packages into §4's scratch install.
   - (b) Stand-ins in `npm test` that reproduce each plugin's timing (T1,
     T2, T6), plus a fixture run by hand that installs the real plugins
     into a temporary directory at run time, with network, like
     `fixtures/sass-corpus` (T7). The outcome is recorded in §14.
   - (c) Stand-ins only; the real plugins checked once, by §4's scripts,
     in §14.

   Recommendation: (b). It keeps the package's dependencies and `npm test`
   offline, and still runs the real plugins before the merge. The contract
   assumes (b) until answered: T7 is a fixture, and no `package.json`
   changes.
2. **Q2 — What "every contract" covers for a stylesheet with Sass and
   another mistake.** On BASE the Sass check runs before every step, so P1
   (`@use` and an unknown `space(99)`) and P10 report the Sass construct
   first.
   - (a) Strict: the plugin alone returns BASE's result for every input, as
     C1 is written.
   - (b) DEC-05's letter: an input whose only problem is Sass fails as on
     BASE (P2 to P5 and P7 to P9 keep their errors), and a stylesheet with
     Sass and another UXDSL error may report the other error first (P1, P6
     and P10 may change: an unknown `space(99)`, the near-miss `palete()`).

   Recommendation: (a). Prototype V met it on P1 to P10, so it costs no
   chain, and "every contract" then means "nothing changes for the plugin
   alone". The contract assumes (a) until answered.
3. **Q3 — The CHANGELOG item that outcome A makes false.** MIG-B9-13's
   `### Breaking` says that a PostCSS chain fails in either order (lines
   440–446). `0.5.0-beta.9` is unreleased, and README §7 makes the
   CHANGELOG append-only, one subsection per story.
   - (a) Append only: this story's subsection says that the item no longer
     holds.
   - (b) Also rewrite MIG-B9-13's item, so the unreleased section does not
     list a breaking change that never ships.

   Recommendation: (b). The item would be false in the published notes,
   MIG-B9-91's release record copies "What changes for you" from the
   CHANGELOG (its §5, G3), and
   no other story edits that item, so the edit serializes nothing new. The
   contract assumes (a), README §7's rule as it stands, until answered.

### Review of 2026-11-10 (applied in the PR that adds this file)

A static review of the seven wave-2 story files written on 2026-11-10. Its
findings on this story were applied before the owner's review:

- **The earlier rows that share this story's files (R2).** MIG-B9-25 also
  edits `test/no-silent-output.test.js`, and MIG-B9-26 `compile.md` and
  `migration.md`; both come before this story in README §5, so Depends on,
  Base, §3's start gates and finding 4 name them, and Blocks names
  MIG-B9-28 and the wave-3 stories that edit `migration.md`.
- **C5 (R7).** C5 holds the inputs the registration names. The latest
  postcss-nested and the responsive value or directive inside `&_title`
  stay in T1 and T7 as evidence under C4, recorded in §14, and do not decide
  the outcome.
- **Start gates (R12).** §3 checks the base's tree for each story, instead
  of searching `origin/feat/beta9`'s commit subjects.

### Owner decisions of 2026-11-10 (apply before implementing)

Recorded in [FEAT-010 §2](../FEAT-010-beta9.md#owner-decisions-of-2026-11-10). The owner was given 32 numbered questions, in Spanish, on the open questions of the seven story files written on 2026-11-10 and on three notes of their PR (#80), each with its options and a recommendation, and answered, verbatim, "fusiona y haz como recmiendes" ("fusiona y haz como recomiendes", "merge, and do as you recommend"): PR #80 was merged, and each recommendation is the owner's decision of 2026-11-10. This record is in English and lists those that concern this story; its Q1 to Q3 above are decisions 12 to 14. Where they differ from this story's contract or from an earlier block, they rule.

- **Q1, where the real plugins come from (decision 12): (b)**, as the contract assumed. Stand-ins in `npm test` reproduce each plugin's timing (T1, T2, T6), and T7 is a fixture run by hand that installs the pinned real plugins, postcss-nested and postcss-simple-vars among them, into a temporary directory. No `package.json` changes. No change to the contract.
- **Q2, what "every contract" covers for a stylesheet with Sass and another mistake (decision 13): (a)**, the strict reading, as the contract assumed. The plugin alone returns BASE's result for every input, as C1 is written. No change.
- **Q3, MIG-B9-13's CHANGELOG item that outcome A makes false (decision 14): (b).** The contract had assumed (a), append only, until answered. What changes, in outcome A only:
  - Besides this story's own subsection, MIG-B9-13's `### Breaking` item that says a PostCSS chain fails in either order (lines 440–446 on `f855765`) is rewritten in the `## 0.5.0-beta.9 — unreleased` section, so that section lists no breaking change that never ships.
  - §11's CHANGELOG item follows: the subsection, and that item rewritten, rather than a subsection that says the item no longer holds. `packages/uxdsl/CHANGELOG.md` is already in Shares; README §7's CHANGELOG row records the rewrite, and no other story edits that item.
  - Outcome B edits nothing, as before.
- **Under README §7, after decisions 6 and 31.** Decision 6 split MIG-B9-26: its C4 to C6 are MIG-B9-17, whose row comes between MIG-B9-26's and this story's. Decision 31 makes `migration.md` append-only; a story that rewrites one of its passages stays serialized. This story rewrites item 4 of "beta.9 — Sass inside compile()" (§11), so:
  - it waits on `migration.md` for MIG-B9-26 (item 6; also `compile.md`) and for MIG-B9-17 (item 9);
  - MIG-B9-30 to 36 no longer wait for it on `migration.md`; MIG-B9-24, 30, 31 and 35 still wait for it on `plugin.ts`, MIG-B9-28 on `no-silent-output.test.js`, and MIG-B9-52, which restructures `migration.md`, there;
  - §3's start gate for MIG-B9-26, whose comment reads "both parts' files, if the owner splits it", also needs MIG-B9-17 merged: `! command grep -qx "To be filled in the delivering PR." docs/features/FEAT-010/MIG-B9-17-module-isolation-warnings.md` exits 0 before the story starts.

  The header's Depends on, Base and Blocks follow.
