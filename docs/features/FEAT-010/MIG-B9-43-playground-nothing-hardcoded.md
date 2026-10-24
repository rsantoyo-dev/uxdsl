# MIG-B9-43 — Nothing hand-written, nothing hardcoded, enforced

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 4 |
| Decision gate | DEC-14 (decided) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-42 |
| Blocks | MIG-B9-61 (the check becomes `uxdsl audit --check`) |
| Base | `feat/beta9` after MIG-B9-42 |
| Owns | `scripts/playground-strict.test.js` (new), `packages/playground-nextjs/uxdsl.exceptions.json` (new, the allowlist), the dark-mode fixes in the playground's `.uxdsl` |
| Shares | `scripts/lib/capabilities.js`, `packages/playground-nextjs/**`, `fixtures/playground-browser/walk.js` |
| Output impact | the site only |

## 1. Goal

A test fails when the playground writes a value by hand. The remaining
exceptions are listed in one file with one reason each, and the dark mode
is finished.

## 2. Sources

- DEC-00: "nada manual ni nada hardcoded".
- Plan §7.4: fail on a literal `font-size`; a hand-written `var(--uxdsl__…)`;
  `px` on spacing, edge or shadow properties; a hex, `rgb()` or `hsl()`
  color outside theme JSON; a hand-written `@media`; a `style={{ }}` carrying
  a literal; a `<button>`, `<input>`, `<textarea>` or `<pre>` outside its one
  component; an allowlist file with a one-line reason per exception, counted
  by the test; expected exceptions: literal code samples shown as text;
  `not-found`'s `@media` became a breakpoint block (MIG-B9-30).
- Plan §3.1: the remaining dark-mode polish (the header gradient, the hero
  subtitle contrast).
- `scripts/lib/capabilities.js`: the playground's sources as three views
  (`uxdsl`, `code`, `docs`) with comments stripped; the ratchet's manual
  evidence file `capability-evidence.json`.
- Press Craftor's `scripts/uxdsl-audit.mjs`: the categories (`color`,
  `spacing`, `radius`, `border`, `shadow`, `type`, `focus`, `button`,
  `surface`, `important`, `exception`), the `uxdsl-exception: <reason>`
  marker, `--check` against a baseline.
- The playground's `package.json` depends on `next ^14.0.0`; MIG-B9-02 left
  Next 14's bundled `postcss` 8.4.31 as the one remaining advisory.

## 3. Preconditions

```bash
test -d packages/playground-nextjs/src/components/ds/DemoFrame
test ! -f scripts/playground-strict.test.js
grep -rc "@media" packages/playground-nextjs/src --include='*.uxdsl' | grep -v ":0$" | wc -l | grep -q "^0$"   # MIG-B9-30 done
```

## 4. Baseline

```bash
cd packages/playground-nextjs && grep -rhoE 'font-size:\s*[0-9.]+(px|rem|em)' src --include='*.uxdsl' | wc -l; grep -rho 'var(--uxdsl__' src --include='*.uxdsl' | wc -l; grep -rhoE '(padding|margin|gap|border|border-radius|box-shadow)[a-z-]*:[^;]*[0-9]px' src --include='*.uxdsl' | wc -l; grep -rho 'style={{' src --include='*.tsx' --include='*.mdx' | wc -l
```

Recorded after MIG-B9-42 (the §2 figures were 78, 131, 128, 20 on `main`).

## 5. Contract

- **H1 — The check.** `scripts/playground-strict.test.js` scans the
  playground's sources through `scripts/lib/capabilities.js`'s views and
  fails on: a literal `font-size` in a `.uxdsl`; `var(--uxdsl__` in a
  `.uxdsl` or `.tsx` (the generated captures excluded); a `px` value on
  `padding`, `margin`, `gap`, `border*`, `border-radius`, `box-shadow`,
  `outline*` in a `.uxdsl`; a hex, `rgb()`, `hsl()`, `oklch()` color
  anywhere outside theme JSON files; `@media` in a `.uxdsl`; `style={{`
  carrying a literal (a value that is not a `var(--…)` custom property passed
  as a measured width or a theme-derived value); `<button`, `<input`,
  `<textarea`, `<pre` outside `components/ds`; a `<iframe` outside
  `components/ds/DemoFrame` and `RuntimeLab`. Each hit prints file, line and
  the rule.
- **H2 — The allowlist.** `packages/playground-nextjs/uxdsl.exceptions.json`
  lists each remaining exception as `{ "file", "line" | "pattern", "rule",
  "reason" }`; the test subtracts them and fails if an entry no longer
  matches anything (a stale exception). Expected content: code samples shown
  as text (strings in `examples.json` and `CodeBlock` children), the
  `ParadigmFrame`-style measured width custom property, nothing else. A
  `/* uxdsl-exception: <reason> */` comment on the line is an alternative
  form the test honours, so the exception sits next to the code.
- **H3 — The counts are zero.** After the story the §4 figures are 0 outside
  the allowlist; the allowlist has at most 10 entries, each with a reason a
  reviewer accepts.
- **H4 — Dark mode finished.** The header gradient and the hero subtitle
  contrast are expressed through palette roles (no literal), and the walk's
  contrast assertions pass in dark mode on every route; the `prefers-color-scheme`
  path and the `data-theme` path both render correctly (the walk runs both
  schemes).
- **H5 — Next.js.** The playground moves to the current Next major when its
  `postcss` is ≥ 8.5.23 (Next 16 ships 8.5.23), unless the migration costs more
  than one day; the decision and its reason are recorded in §14. With the
  move, `npm audit` in the playground is 0.
- **H6 — Hand-off to the CLI.** The check is written so MIG-B9-61's
  `uxdsl audit --check` can replace it with the same allowlist file: the
  rules are a table, the scanner is `scripts/lib/capabilities.js`'s source
  views, the exceptions file format is the one `uxdsl audit` will read.

Must stay byte-identical: the package.

## 6. Out of scope

- Productizing the check as `uxdsl audit`: MIG-B9-61.

## 7. Approach and traps

- Run the check first; fix the playground until it passes; add an exception
  only with a reason a stranger would accept ("the resize handle passes the
  measured width as a custom property" yes; "legacy" no).
- Comments are stripped by the views, so a comment showing a `px` value is
  not a hit; a string in a `.tsx` showing code is a hit unless allowlisted
  (that is the expected content of the allowlist).
- `BreakpointsProvider.tsx` is a read-only context over the theme's
  breakpoints; it writes no CSS and stays.
- Stop rule: an exception that exists because a token is missing from the
  theme is a theme change (the playground's override files), not an
  exception.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `scripts/playground-strict.test.js` | `MIG-B9-43: the playground writes no value by hand outside its exceptions file` | unit | H1–H3 | a planted `padding: 12px` in a `.uxdsl` fails; a stale exception fails |
| T2 | `fixtures/playground-browser/walk.js` | dark and light schemes, contrast page equal to Node, no overflow | Chrome | H4 | — |
| T3 | `fixtures/playground-browser/compare.js` | intended differences only (dark-mode fixes declared) | Chrome | H4 | — |
| T4 | `npm --prefix packages/playground-nextjs audit` | 0 (if H5 moved) | audit | H5 | — |

## 9. Acceptance criteria

- **AC1** `node --test scripts/playground-strict.test.js` exits 0 and is part
  of the root `npm test` chain.
- **AC2** The exceptions file has at most 10 entries, each with a reason.
- **AC3** `npm run verify:playground-browser` exits 0.
- **AC4** `npm test` exits 0; `npm run verify:1.0` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| root `package.json` `test` script | yes (add the strict test) |
| `npm run generate:capabilities` | yes |
| playground captures | yes |
| `AGENTS.md` | yes (the playground section: the strict check and the exceptions file) |

## 11. Documentation

`packages/playground-nextjs/README.md` (the strict check, the exceptions
file), `AGENTS.md` ("Maintaining this guide": the playground is checked).

## 12. Verification

```bash
node --test scripts/playground-strict.test.js     # exit 0
npm run verify:playground-browser                 # background; exit 0 (Chrome)
npm test                                          # background; exit 0
npm run verify:1.0                                # background; exit 0
```

## 13. Delivery

Branch `feat/b9-43-strict`. Commit:
`feat(FEAT-010): MIG-B9-43 - the playground writes nothing by hand: the strict check, the exceptions file, dark mode finished`.

## 14. Closure record

To be filled in the delivering PR, with the H5 decision.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- **The rule cannot be enforced as written.** Token demos must build names from the live theme (DemoShadows.tsx:51, DemoBorders.tsx:51-60, DemoColors.tsx:171, RussianDoll.tsx:16 — 31 hits in 11 files); the regex text views cannot tell CodeBlock children from style strings (capabilities.js:52-66); "hex anywhere" catches theme patches used as data (RuntimeLab.tsx:74-75, RuntimeEngines.tsx:34, ColorGuide.tsx:7-9); the views walk only `src/`, so `paradigm/frame.uxdsl` and `runtime-sandbox/sandbox.uxdsl` escape; there is no font token function, and the `.uxdsl` files hold 26 hand-written `var(--uxdsl__font__…)`; "≤10 entries" counts allowlist entries, not hits.
- Fix: scan a declared list of directories; move code samples to `src/examples/**`, excluded by path and compiled by a capture script; make one helper the only builder of `--uxdsl__` names (export `buildVarName` from `uxdsl/language`); keep theme patches in `.json`; allow `style` only when every key starts with `--` (checked with the TypeScript AST); fonts through typography roles; count allowlisted hits.
