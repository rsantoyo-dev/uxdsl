# MIG-B9-05 — The plugin preserves untouched declarations byte for byte

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 0 |
| Decision gate | None |
| Status | In review (PR #30) |
| Size | S |
| Depends on | — |
| Blocks | MIG-B9-10 (the Bootstrap corpus cannot be byte-identical without it) |
| Base | `feat/beta9` |
| Owns | `packages/uxdsl/test/preserve-untouched-declarations.test.js` (new) |
| Shares | `packages/uxdsl/src/plugin.ts`, `packages/uxdsl/CHANGELOG.md` |
| Output impact | visual-neutral: whitespace and comments inside values that the grammar did not change are no longer altered |

## 1. Goal

A declaration the UXDSL grammar does not change leaves the plugin exactly as
it entered: its value's whitespace, its inline comments, an empty custom
property. "Rename `.scss` to `.uxdsl` and get Dart Sass's CSS" needs the plugin
to be an identity on foreign CSS.

## 2. Sources

- Measured on Bootstrap 5.3.8 through the prototype pipeline
  (`docs/features/FEAT-010/README.md` §9): the Sass stage equals plain Dart
  Sass byte for byte; the plugin then changed three declarations:
  `--bs-btn-font-family: ;` → `--bs-btn-font-family:;`,
  `--bs-dropdown-box-shadow: ;`, `--bs-nav-link-font-weight: ;`. With a
  one-function patch that assigns `decl.value` only when the grammar changed it,
  the final CSS equals Dart Sass's (273,591 bytes, `cmp` clean).
- Cause: PostCSS discards a declaration's `raws.value` (the raw text with its
  whitespace and comments) whenever `decl.value` is assigned, even to the same
  string. `plugin.ts`'s responsive pass and token pass assign unconditionally
  (`decl.value = parsed.toString().trim()`; `decl.value = rewriteTokens(c, decl.value)`).
- Probes recorded in the prototype (`probe-cause.js`): `a{--x: ;}`,
  `a{content: var(--d, "/") /* rtl: var(--d, "/") */;}`,
  `a{transform: rotate(360deg) /* rtl:ignore */;}`, `a{color: red/* c */;}`,
  `a{margin: 0 /* c */ auto;}`, `a{--y: 1px /* keep */;}`.

## 3. Preconditions

```bash
grep -n "decl.value = parsed.toString().trim()" packages/uxdsl/src/plugin.ts
grep -n "decl.value = rewriteTokens(c, decl.value)" packages/uxdsl/src/plugin.ts
test ! -f packages/uxdsl/test/preserve-untouched-declarations.test.js
```

## 4. Baseline

```bash
cd packages/uxdsl && node -e "
const postcss = require('postcss'); const plugin = require('./dist/plugin.js');
(async () => { for (const s of ['a{--x: ;}', 'a{color: red/* c */;}', 'a{margin: 0 /* c */ auto;}'])
  { const out = (await postcss([plugin({ includeTheme: false, theme: {} })]).process(s, { from: 'x.css' })).css; console.log(JSON.stringify(s), out === s ? 'SAME' : 'CHANGED -> ' + JSON.stringify(out)); } })()"
```

Recorded on the base: `a{--x: ;}` CHANGED (`a{--x:;}`); the two comment
probes CHANGED (comment or spacing altered).

## 5. Contract

- **C1** For every declaration whose value the grammar leaves semantically
  unchanged (no token function rewritten, no responsive group split), the
  plugin does not assign `decl.value`; `raws.value`, `raws.between` and inline
  comments survive. Implementation: one helper, `assignValue(decl, next)`, that
  assigns only when `next !== decl.value.trim()`, used at both call sites.
- **C2** For every declaration the grammar does change, the output is
  byte-identical to today's (the parity oracles do not change).
- **C3** The six probes of §2 compile to themselves through `uxdsl/postcss`
  with `includeTheme: false` and through `compile()`.
- **C4** A declaration that contains a token *and* a comment keeps the comment:
  `a{padding: space(2) /* keep */;}` → `a{padding: var(--uxdsl__space__2) /* keep */;}`.
  If `postcss-value-parser` cannot round-trip a comment inside a changed
  value, the story records it in §15 and C4 is downgraded to "the comment is
  dropped only in changed declarations", stated in the CHANGELOG.

## 6. Out of scope

- Preserving raws of nodes the plugin generates (the theme) — they are
  serialized by `css-blocks.ts` and byte-identical with `generateThemeCss`
  already.
- Sass's own output formatting — Sass decides it; the plugin must not touch it.

## 7. Approach and traps

- Do not compare `next !== decl.value`: PostCSS's `decl.value` is already
  trimmed while `raws.value.raw` holds the original; comparing with
  `decl.value.trim()` is what the prototype proved.
- Run the probes with plain `postcss([])` first: PostCSS's own parse and
  stringify are identity on them (verified), so any change is the plugin's.
- Stop rule: if making the plugin an identity on a probe requires touching
  `css-blocks.ts` or the theme serializer, stop — that is a different problem.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/preserve-untouched-declarations.test.js` | `MIG-B9-05: declarations the grammar does not change are byte-identical through the plugin and through compile()` (the six probes) | unit | C1, C3 | the test fails on the base (three probes change) |
| T2 | same | `MIG-B9-05 (positive control): a declaration with a token is still rewritten, and keeps a trailing comment` | unit | C2, C4 | — |
| T3 | `fixtures/parity/run.js` | existing oracles | parity | C2 | — |
| T4 | `test/theme-insertion.test.js`, `test/theme-marker.test.js` | existing byte-identity with `generateThemeCss` | unit | C2 | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/preserve-untouched-declarations.test.js`
  exits 0; T1 fails on the base.
- **AC2** `node fixtures/parity/run.js` exits 0 without `--update`.
- **AC3** `npm test` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes (`plugin.ts` is in `VISUAL_DEFAULT_FILES`; one line under the beta.9 section: "untouched declarations keep their raw text") |
| package README | yes (the guard; one sentence in "Where the theme goes in the compiled output" or "Verified from a real install") |
| everything else | no |

## 11. Documentation

`packages/uxdsl/CHANGELOG.md`, `packages/uxdsl/README.md` (one sentence).

## 12. Verification

```bash
node --test packages/uxdsl/test/preserve-untouched-declarations.test.js   # exit 0
node fixtures/parity/run.js                                                # exit 0
npm test                                                                   # background; exit 0
```

## 13. Delivery

Branch `feat/b9-05-preserve-untouched`. Commit:
`fix(FEAT-010): MIG-B9-05 - the plugin leaves untouched declarations byte-identical`.

## 14. Closure record

- **Base:** `feat/beta9` at `d8677d8`. **PR:** #30. **Commits:** `4fb2e0c`
  (the test alone), `ca413c3` (the fix), `965c11d` (a control's regex).
- **Environment:** a cloud session without npm registry access, so nothing
  was installed, built or tested locally and the pre-commit hook did not run;
  every suite ran in CI (GitHub Actions, ubuntu-latest, Node 20, Chrome for the
  gate). Locally: a TypeScript syntax check of `plugin.ts` and `scss-subset.ts`
  and `node scripts/verify-docs-update.js` (exit 0).
- **Commands, in CI:**

  | Commit | `npm test` | `verify:1.0` |
  | --- | --- | --- |
  | `4fb2e0c` (test only) | failure, in the Test step | skipped |
  | `ca413c3` (fix) | failure: one control (T3's regex expected a space the plugin's compact output does not have); every other test passed | skipped |
  | `965c11d` | success | success |

  CI's job logs are served from a host this session cannot reach; the
  `ca413c3` failure was read through a temporary branch that printed the
  failing lines as a GitHub annotation (PR #32, closed). The `4fb2e0c` failure
  is known only by its step.
- **Controls:** T1 failed on the base (the test-only commit); T2 and the
  responsive control pass after the fix; parity (T3) and theme byte-identity
  (T4) are part of `npm test` and passed unchanged.
- **Owner steps pending:** none.

## 15. Findings and follow-ups

- C1's helper also rewrites the author's raw text when a value does change, so
  C4 holds as written (`padding: space(2) /* keep */` keeps its comment): the
  same token rewrite is applied to `raws.value.raw` and kept only when it holds
  the same comments and, without them, the new value.
- `compile()` needed `scss-subset.ts` to assign `$variable` substitutions only
  on change, like the plugin; that file was not in the story's Shares. It is
  deleted by MIG-B9-13 anyway.
