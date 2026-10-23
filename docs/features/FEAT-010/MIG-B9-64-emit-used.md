# MIG-B9-64 — `emit: 'used'`, opt-in

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 6 |
| Decision gate | None (plan §5.5; opt-in, no syntax change) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-20 |
| Blocks | — |
| Base | `feat/beta9` after MIG-B9-20 |
| Owns | `packages/uxdsl/test/emit-used.test.js` (new) |
| Shares | `packages/uxdsl/src/plugin.ts`, `compile.ts`, `types.ts`, `vite.ts`, `webpack.ts`, `bin/uxdsl.js`, `ds-runtime/apply-theme.ts` (a warning), `fixtures/release-1.0/run.js` |
| Output impact | none by default; opt-in smaller theme block |

## 1. Goal

A project that wants the smallest stylesheet asks for it and gets only the
tokens its sources reference, with the trade-off stated by the tool: a token
the page does not carry cannot be applied at run time.

## 2. Sources

- Plan §5.5: "A build option (for example `emit: 'used'`) that emits only the
  tokens and roles the compiled sources reference (the compiler already
  resolves every reference). It is **not** the default and must say so:
  `applyTheme` can only change custom properties that exist on the page, so
  a pruned build cannot apply an unused token at run time. Measure the
  one-card, one-button app before and after (today 38–48 KB)."
- The reference pass (`reference-core.ts`) computes definitions and
  consumers and follows `var()` chains; the theme block is one contiguous run
  of blocks (`css-blocks.ts`); `applyTheme` regenerates the whole theme and
  swaps the managed stylesheet.
- Measured: a one-rule module with the theme is 47,273 bytes.

## 3. Preconditions

```bash
grep -q "themeEmitted" packages/uxdsl/src/compile.ts   # MIG-B9-20 merged
grep -q "export function enforceDeclarationReferences" packages/uxdsl/src/reference-core.ts
```

## 4. Baseline

```bash
cd packages/uxdsl && node -e "const {compile}=require('./dist/entries/index.js');compile({source:'@uxdsl theme;\n.card{@ds-surface(contained);padding:density(4)}\n.go{@ds-button(contained primary 2)}',from:process.cwd()+'/x.uxdsl'}).then(r=>console.log(r.css.length))"
```

Recorded: the byte count of the one-card, one-button stylesheet (expected
38–48 KB).

## 5. Contract

- **U1 — The option.** `emit: 'all' | 'used'` (default `'all'`) on the
  plugin, `compile()`, the Vite plugin, the webpack loader and the CLI config
  (`UxdslConfigShared.emit`). With `'used'`, the theme block written at the
  marker contains only: the custom properties that the compiled rules of
  **this compilation** reference, transitively through the theme's own
  `var()` chains (a Surface variable pulls its palette, which pulls its
  color), plus the foundations those depend on; the `@import`s; the mode
  blocks restricted to the same names; the focus rule only if a focusable
  selector or the focus variables are referenced.
- **U2 — Multi-file truth.** In a `builds` project the entry that carries the
  marker emits the union of what **every** entry of the build references
  (the CLI compiles all entries before writing, so it knows); `compile()`
  alone (one file) emits what that file references and documents the limit.
- **U3 — The warning.** The CLI prints `[uxdsl] emit: used — N of M tokens
  emitted; applyTheme can only update tokens the page carries` once per
  build. `applyTheme` gains a warning in its result (`UXD_THEME_PRUNED`,
  owner `runtime`) when the applied patch names a token the managed
  stylesheet does not carry — detected by comparing the generated names with
  the names present in the current managed stylesheet.
- **U4 — Correctness.** The pruned stylesheet renders the one-card,
  one-button app identically in Chrome (computed styles of the card and the
  button equal those of the full build); the reference pass still runs on the
  full theme (a dangling reference fails as before).
- **U5 — Measurement.** The story records the one-card, one-button app's
  bytes before and after in §14 and in the CHANGELOG (expected: under 8 KB
  after).

Must stay byte-identical: every build with the default `emit: 'all'`.

## 6. Out of scope

- Making `'used'` the default: no (the plan says so).
- Pruning component CSS (the directives' own output): there is nothing
  unused there.

## 7. Approach and traps

- Compute the used set from the reference pass's records (consumers →
  definitions, transitively) instead of a second walk; the pass already has
  the graph.
- Mode blocks and `@media` blocks of composites must prune by name as well,
  or a dark-mode override of an emitted token is lost.
- Stop rule: if the pruned output differs in a computed style, the dependency
  chain is incomplete; fix the chain, never widen the set by family.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/emit-used.test.js` | `MIG-B9-64: emit used keeps exactly the referenced tokens and their chains, including mode and media blocks; emit all is byte-identical to today` | unit | U1 | a referenced token missing from the output fails |
| T2 | `test/cli/uxdsl-cli.test.js` | `MIG-B9-64: a builds project emits the union at the marker entry and prints the summary` | CLI | U2, U3 | — |
| T3 | `test/ds-runtime-apply-theme.test.js` | `MIG-B9-64: applyTheme warns UXD_THEME_PRUNED when a patched token is absent from the page` | unit | U3 | a present token does not warn |
| T4 | `fixtures/mig02-nextjs-cssmodules/browser.js` or a new fixture | the pruned app renders identically in Chrome | Chrome | U4 | — |
| T5 | `fixtures/release-1.0/run.js` | `EU-1 | emit: used from the tarball: bytes and identical rendering` | tarball | U4, U5 | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/emit-used.test.js` exits 0; the
  default output is byte-identical (parity unchanged).
- **AC2** The Chrome check passes; the bytes before/after are in the PR.
- **AC3** `npm test` exits 0; `npm run verify:1.0` exits 0 with `EU-1 ok`.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes (`### Added`, with the measurement) |
| package README | yes (one section, with the trade-off) |
| `DIAGNOSTIC_CATALOG` | yes (`UXD_THEME_PRUNED`) |
| `AGENTS.md` | yes (one paragraph under build/runtime) |
| playground captures | yes (`--help`) |

## 11. Documentation

`packages/uxdsl/README.md`, `packages/uxdsl/docs/integrations/{cli,vite,webpack}.md`,
`AGENTS.md`, `packages/uxdsl/CHANGELOG.md`.

## 12. Verification

```bash
node --test packages/uxdsl/test/emit-used.test.js packages/uxdsl/test/ds-runtime-apply-theme.test.js   # exit 0
node fixtures/parity/run.js                                                                              # exit 0
npm test                                                                                                 # background; exit 0
npm run verify:1.0                                                                                       # background; exit 0 (Chrome)
```

## 13. Delivery

Branch `feat/b9-64-emit-used`. Commit:
`feat(FEAT-010): MIG-B9-64 - emit: 'used' (opt-in) emits only the referenced tokens; applyTheme warns on a pruned token`.

## 14. Closure record

To be filled in the delivering PR, with the bytes before and after.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **Recommended cut.** Vite, webpack and Next's PostCSS compile each module alone; after MIG-B9-20 the marker file sees only its own references, so tokens used in other modules would be pruned silently, against clause 7. U2's "the CLI compiles every entry before writing" does not hold in watch mode (`runSelectiveBuild(indices)`, bin/uxdsl.js ~1508-1517). The 47 KB theme block is about 5 KB gzipped.
