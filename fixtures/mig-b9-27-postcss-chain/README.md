# `uxdsl/postcss` in a PostCSS chain

`run.js` runs `uxdsl/postcss` in one PostCSS run with the real plugins that
resolve Sass-like syntax a stylesheet holds, in both plugin orders, and
compares each run with the documented two passes: that plugin in a PostCSS
pass of its own, then `uxdsl/postcss` (FEAT-010, MIG-B9-27).

```bash
node fixtures/mig-b9-27-postcss-chain/run.js                       # exit 0 when every registered chain compiles
node fixtures/mig-b9-27-postcss-chain/run.js --uxdsl <package dir> # another build of uxdsl (its dist/plugin.js and its postcss)
node fixtures/mig-b9-27-postcss-chain/run.js --help
```

**Network:** it installs into a temporary directory, which it removes whatever
the exit code:

- `postcss-nested@7.0.2`, `postcss-simple-vars@7.0.1` and
  `tailwindcss@3.4.19` (its `tailwindcss/nesting`; tailwindcss 4 has none),
  the versions the story registers;
- separately, `postcss-nested@latest`, whose version it prints.

It runs with `npm install --ignore-scripts`, and changes no `package.json` of
the repository. `npm test` does not run it: the package's suite pins the same
timings with stand-ins (`packages/uxdsl/test/postcss-chain.test.js`).

**What it runs.** Each line is one PostCSS run, `<plugin> <version>, <order>,
<input>: ok` when it gives the two passes' CSS (each printed with PostCSS's
`cleanRaws()`, so only formatting may differ), or the error's line, column and
reason up to its first `;`:

- the registered chains, which must compile in both orders: postcss-nested
  7.0.2 and `tailwindcss/nesting` with `.phone { &_title { padding:
  space(2); } }`, and postcss-simple-vars 7.0.1 with `$gap: 4px; .card {
  padding: $gap; margin: space(2); }`;
- the evidence, which must give the two passes' CSS or the plugin alone's
  error for its input: the same `&_title` holding a responsive value,
  `@ds-surface(contained)` or `@ds-button(contained)`, with every nesting
  plugin; the latest postcss-nested with every `&_title` input; and, with
  postcss-simple-vars, the Sass constructs `uxdsl/postcss`'s own steps read
  (`$n: 2; … space($n)`, `$pad: space(2)`, `$pad: xs(1rem) md(2rem)`), which
  fail as `UXD_SASS_CONTEXT` at 1:1 in both orders. `tailwindcss/nesting`
  listed first flattens the stylesheet in its own `Once`, so that run must
  compile whatever `uxdsl/postcss` does with the rest.

It exits 1 when a registered chain does not give the two passes' CSS, when a
run gives other CSS or another error, or when the install fails or installs
another version than the pinned one. With `--uxdsl` pointing at a build of the
plugin before MIG-B9-27 (its `dist/` and a `node_modules` holding `postcss`),
it exits 1: postcss-nested's `&_title` and postcss-simple-vars' `$gap` fail as
`UXD_SASS_CONTEXT` in both orders, and `tailwindcss/nesting` listed after
`uxdsl/postcss` too.
