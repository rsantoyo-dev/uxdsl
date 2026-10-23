# MIG-B9-15 — Documentation of the superset

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 1 |
| Decision gate | DEC-01 (decided) |
| Status | Ready |
| Size | S |
| Depends on | MIG-B9-14 |
| Blocks | MIG-B9-50, MIG-B9-51 |
| Base | `feat/beta9` after MIG-B9-14 |
| Owns | `packages/uxdsl/docs/integrations/compile.md`, `packages/uxdsl/docs/integrations/{cli,vite,webpack}.md` (the Sass parts), `scripts/lib/doc-examples.js` (the `scss` fence rule) |
| Shares | `packages/uxdsl/README.md`, `AGENTS.md`, `packages/uxdsl/docs/migration.md`, `packages/uxdsl/CHANGELOG.md` |
| Output impact | none |

## 1. Goal

A reader learns in one place that every Sass feature works in a `.uxdsl`
file, how to start from an SCSS project, what UXDSL reserves, and what the
Sass stage reports. Every example compiles through the real pipeline.

## 2. Sources

- Plan §9.6: "'From SCSS' becomes a first-class path in the quick start and
  the README: rename, build, then adopt tokens gradually"; "The language
  reference says plainly: every SCSS feature works; UXDSL adds its words on
  top; the reserved names".
- Vision (plan): "UXDSL is to SCSS what TypeScript is to JavaScript"; the
  positioning always says "inspired by Material UI".
- `packages/uxdsl/docs/integrations/compile.md` has `## The SCSS subset`
  (line 109 on `main`); `AGENTS.md` describes the subset at "The SCSS subset
  `compile()` compiles (`$variables`, `@if/@else`, …" (around line 860).
- `scripts/lib/doc-examples.js`: fenced `css`, `scss` and `uxdsl` blocks that
  contain UXDSL syntax are compiled; most through the plugin
  (`postcss([plugin({ theme, includeTheme: false })])`), "a few" through
  `core.compile()` — a Sass example must go through `compile()`.
- The facts to document come from MIG-B9-12 to 14's contracts (importer rules,
  `@import "x.css"`, `pkg:`, reserved names, warnings, `sass` option,
  `@use` entries, the Next.js path).

## 3. Preconditions

```bash
grep -q "^## The SCSS subset" packages/uxdsl/docs/integrations/compile.md
grep -q "The SCSS subset" AGENTS.md
grep -q "core.compile(" scripts/lib/doc-examples.js
```

## 4. Baseline

```bash
npm run verify:doc-examples 2>&1 | tail -3
```

Recorded: the count of examples and theme excerpts compiled (48 examples, 24
excerpts in 101 files on `main` at beta.7; record the current figures).

## 5. Contract

- **D1 — The harness compiles Sass examples.** In `scripts/lib/doc-examples.js`
  a fenced block whose language is `scss`, or whose code contains a Sass-only
  construct (`@use`, `@mixin`, `@include`, `@each`, `$name:`, `&`-nesting,
  `#{`), compiles through `compile({ source, from })`, never through the plugin
  alone; `css` blocks keep the plugin. The error-comment rule
  (`/* UXD_CODE: … */`) applies to `UXD_SASS` examples too.
- **D2 — `compile.md`.** `## The SCSS subset` is replaced by `## Sass inside
  compile()`: the four stages; what Sass handles (everything SCSS); the
  importer rules (extensions, partials, index files, `.uxdsl` before `.scss`,
  ambiguity error, `pkg:`, `node_modules` load paths, no `~`); `@import "x.css"`
  stays a CSS import, `@use "./x"` inlines it; nesting flattened; reserved
  names; errors (`UXD_SASS` with Sass's frame) and warnings
  (`UXD_SASS_WARNING`, the `sass.silenceDeprecations` option); source maps
  point at the author's files. One compiled example with `@use "sass:math"`,
  a map, a mixin and three UXDSL tokens, with its output shown
  (`<!-- doc-example: output -->`).
- **D3 — README "From SCSS".** `packages/uxdsl/README.md` gains, right after
  "Install", a section `## From SCSS: rename and keep building` with three
  steps (rename `.scss` → `.uxdsl`, run `uxdsl build` or add the plugin,
  change one value to a token), the sentence "UXDSL is to SCSS what TypeScript
  is to JavaScript: every SCSS file is a valid UXDSL file", and the two
  limits (a `.module.scss` compiled by a host's own Sass cannot carry dotted
  tokens; `~pkg` imports become `pkg:` or a bare path). The intro paragraph
  says "inspired by Material UI's theme engine" where it positions UXDSL.
- **D4 — Integrations.** `cli.md`: `generate-entry` with `@use` and
  `--first`; the `sass` config key; the Next.js subsection (MIG-B9-14 A8).
  `vite.md`, `webpack.md`: the `sass` option; a `.uxdsl` may `@use` a `.scss`.
- **D5 — `AGENTS.md`.** The SCSS paragraph is rewritten: Sass runs first and
  handles all of SCSS; UXDSL's words are resolved after; the reserved names;
  `$variables` in a `.css` file compiled by the plugin alone are
  `UXD_SASS_CONTEXT`; agents write Sass features freely in `.uxdsl` files and
  never emulate them with UXDSL constructs. The generated agent guide follows.
- **D6 — `migration.md`.** A "beta.9 — Sass inside compile()" section: what
  changes for a project (nesting flattened, `//` comments dropped by Sass,
  `@import` of `.uxdsl` deprecated → `@use`, `@import "x.css"` no longer
  inlined, retired codes and their replacements, the `sass` key).
- **D7 — Diagnostics page.** The playground's `/docs/diagnostics` captures are
  regenerated so `UXD_SASS`, `UXD_SASS_WARNING`, `UXD_SASS_CONTEXT`,
  `UXD_RESERVED_NAME` appear with their meaning and fix.

Must stay byte-identical: compiled outputs (documentation only, plus the
harness rule).

## 6. Out of scope

- The root README rewrite and the audience paragraph: MIG-B9-50.
- The playground's live "From SCSS" demo: MIG-B9-42.
- AGENTS.md's size and structure: MIG-B9-51.

## 7. Approach and traps

- Every example in D2–D4 must compile under the harness after D1; write the
  example, run `npm run verify:doc-examples`, then write the prose.
- An example that shows a `UXD_SASS` error needs a source Sass rejects and the
  comment `/* UXD_SASS: … */` on the statement's line; the harness checks the
  code, not the message.
- Do not write "replaces SCSS" or "no media queries" anywhere (the audit
  retired both claims); write "SCSS plus a design-system engine" and, for
  media queries, what MIG-B9-30 ships when it ships.
- Stop rule: if an example cannot compile because of a pipeline defect, that
  is a finding for MIG-B9-13/14; do not weaken the example.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `scripts/doc-examples.test.js` | existing: every example compiles | docs | D1–D4, D6 | a planted invalid Sass example without an error comment fails the run |
| T2 | `scripts/doc-examples.test.js` (new unit) | `MIG-B9-15: a scss fence or a Sass construct routes through compile(), a css fence through the plugin` | unit | D1 | — |
| T3 | `scripts/agent-guide.test.js` + `generate-agent-guide.js --check` | the guide matches AGENTS.md | docs | D5 | — |
| T4 | `scripts/capability-matrix.test.js` | no recorded gap | docs | D7 | — |

## 9. Acceptance criteria

- **AC1** `npm run verify:doc-examples` exits 0 and reports more examples than
  the baseline (the new Sass examples are counted).
- **AC2** `grep -c "replaces SCSS\|no media queries" README.md packages/uxdsl/README.md AGENTS.md`
  prints 0 for each.
- **AC3** `grep -c "inspired by Material UI" packages/uxdsl/README.md` prints
  at least 1 and `grep -ci "is MUI\|Material UI's engine" packages/uxdsl/README.md AGENTS.md`
  prints 0.
- **AC4** `node scripts/generate-agent-guide.js --check` exits 0.
- **AC5** `npm test` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `AGENTS.md` + agent guide | yes |
| CHANGELOG | no (documentation) |
| `migration.md` | yes |
| package README | yes |
| `npm run generate:capabilities` | yes |
| playground captures | yes (diagnostics) |

## 11. Documentation

This story is documentation: the files in §5.

## 12. Verification

```bash
npm run verify:doc-examples                        # exit 0
node scripts/generate-agent-guide.js --check       # exit 0
node --test scripts/doc-examples.test.js scripts/capability-matrix.test.js   # exit 0
npm test                                           # background; exit 0
```

## 13. Delivery

Branch `feat/b9-15-superset-docs`. Commit:
`docs(FEAT-010): MIG-B9-15 - Sass inside compile(): From SCSS, the importer rules, reserved names, warnings; examples compile through compile()`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- D1: the doc-example harness compiles only pipeline examples (doc-examples.js:193-198) and per-statement error comments rely on `postcss.parse`; define how a Sass example is compiled and how an error example is marked.
- D2 omits the limitation users hit first: tokens are opaque strings to Sass, so `darken(palette(…))`, `rgba(color(…), .5)` and Bootstrap's color mixins applied to tokens are Sass errors. Document it with the alternative (`palette(x, 0.5)`, `color-mix()`).
- D3 ("every SCSS file is a valid UXDSL file") is false while MIG-B9-11 R4 reserves names; qualify it according to DEC-17.
- AC2 already passes on the base (vacuous); give it a negative control.
