# MIG-B9-02 — Refresh the repository's dependencies

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 0 |
| Decision gate | None |
| Status | Ready |
| Size | S |
| Depends on | — |
| Blocks | MIG-B9-91 (the gate's audit check) |
| Base | `main` at `685c132` or later |
| Owns | `packages/uxdsl/package-lock.json` (dependency versions), `packages/playground-nextjs/package-lock.json`, `.github/dependabot.yml` (new), `fixtures/vite-adapter/run.js` |
| Shares | `packages/uxdsl/package.json` (`devDependencies.vite`), `fixtures/release-1.0/run.js` (one new check) |
| Output impact | none |

## 1. Goal

`npm audit` reports zero vulnerabilities for the package's own lockfile, not
only for a fresh install, and the next advisory is found by a tool instead of
by chance.

## 2. Sources

Plan §1.6 (`docs/audits/2026-10-08-plan-beta9.md`), measured 2026-10-09 with
GitHub's advisory database:

| Package | Pinned | First fixed | Lockfile |
| --- | --- | --- | --- |
| `postcss` | 8.5.6 | 8.5.23 | `packages/uxdsl`, `packages/playground-nextjs` |
| `nanoid` | 3.3.11 | 3.3.18 | both |
| `source-map-js` | 1.2.1 | 1.2.2 | both |
| `vite` (dev, tests), with its `esbuild` | 5.4.21, `esbuild` 0.21.5 | 6.4.3, `esbuild` 0.25.0 | `packages/uxdsl` |
| `vite` | 7.2.6 | 7.3.5 | `packages/playground-nextjs` |
| `nanoid` under `@vue/devtools-core` | 5.1.6 | 5.1.16 | `packages/playground-nextjs` |
| `postcss` inside `next` 14 | 8.4.31 | Next 16 ships 8.5.23 | `packages/playground-nextjs` |

The advisories: `GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, `GHSA-fxqj-rqcc-2cmp`,
`GHSA-r28c-9q8g-f849` (postcss); `GHSA-28wg-ghj8-5hjv`, `GHSA-2v37-7h3g-55p8`,
`GHSA-xwg4-73v4-xw9w` (nanoid); `GHSA-68fv-2mgg-jv7q` (source-map-js);
`GHSA-4w7w-66w2-5vf9`, `GHSA-v6wh-96g9-6wx3`, `GHSA-fx2h-pf6j-xcff` (vite);
`GHSA-67mh-4wv8-2f99` (esbuild).

## 3. Preconditions

```bash
(cd packages/uxdsl && npm audit --omit=dev --json | node -e "const a=JSON.parse(require('fs').readFileSync(0,'utf8'));process.exit(Object.keys(a.vulnerabilities).length?0:1)")   # vulnerable today: exit 0
test ! -f .github/dependabot.yml
grep -qF 'vite@^5' fixtures/vite-adapter/run.js
```

## 4. Baseline

```bash
cd packages/uxdsl && npm audit 2>&1 | tail -3
```

Recorded: `3 high severity vulnerabilities` in production dependencies
(`nanoid`, `postcss`, `source-map-js`) and, with dev dependencies, `esbuild`
(moderate) and `vite` (high) as well.

## 5. Contract

- **C1** `packages/uxdsl/package-lock.json` resolves `postcss` ≥ 8.5.23,
  `nanoid` ≥ 3.3.18, `source-map-js` ≥ 1.2.2; `npm audit` inside
  `packages/uxdsl` reports 0 vulnerabilities, dev dependencies included.
- **C2** `packages/uxdsl/package.json` `devDependencies.vite` moves to the
  current major with the fix (`^7.3.5` or later); `test/vite/*.test.js` pass
  against it. The peer range `vite: ">=4.0.0"` does not change.
- **C3** `fixtures/vite-adapter/run.js` installs and builds the fixture twice,
  with `vite@^5` and with the current major (`vite@^7`), and reports both in
  its output; the release gate's `N-04` covers both.
- **C4** `packages/playground-nextjs/package-lock.json`: `vite` ≥ 7.3.5,
  `nanoid` under `@vue/devtools-core` ≥ 5.1.16, top-level `postcss`,
  `nanoid`, `source-map-js` as in C1. `npm audit` there reports nothing but
  the advisory inside `next`'s own `postcss` 8.4.31, which is recorded in
  §15 as the one remaining item (a Next.js upgrade is MIG-B9-43's call).
- **C5** `.github/dependabot.yml` exists with `version: 2` and one `npm`
  entry per lockfile the repository owns (`/`, `/packages/uxdsl`,
  `/packages/playground-nextjs`, `/packages/uxdsl-vscode`,
  `/fixtures/mig02-nextjs-cssmodules`), weekly schedule, grouped minor and
  patch updates, `open-pull-requests-limit: 3`. Enabling Dependabot security
  updates in the repository settings is an owner step.
- **C6** The release gate gains `AUDIT-lock`: `npm audit --json` run inside
  `packages/uxdsl` of the repository (not the tarball consumer) must report
  zero vulnerabilities; `AUDIT` (fresh install) stays.
- **C7** The `postcss` peer floor stays `^8.4.31`. Raising it to `^8.5.23`
  was considered and declined: Next.js 14 and 15 run the plugin inside their
  own `postcss` 8.4.31, so the warning would fire in every such project while
  the advisories concern source maps named inside untrusted CSS, which UXDSL
  never reads. Record the reasoning in the CHANGELOG entry.

Must stay byte-identical: every compiled CSS output (a `postcss` patch
release must not change stringification; `fixtures/parity` proves it).

## 6. Out of scope

- Moving the playground to Next 16: MIG-B9-43 decides; it is a larger change
  and Next's own PostCSS only reads the project's CSS at build time.
- The `sass` dependency and its audit status: MIG-B9-12.

## 7. Approach and traps

- `npm audit fix` inside `packages/uxdsl` resolves C1 without a `package.json`
  change; check the diff is only lockfile versions.
- The Vite 7 dev dependency needs Node ≥ 20.19 (CI uses Node 20; verify the
  exact minor with `node -v` in CI logs or pin `node-version: 20.19`).
- `fixtures/vite-adapter/run.js` uses `packAndInstall` from
  `fixtures/lib/tarball-consumer.js`; run the second install in a second temp
  directory, never by re-installing over the first.
- Stop rule: if a lockfile change alters a parity oracle, stop and record it;
  do not re-record oracles here.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `fixtures/release-1.0/run.js` | `AUDIT-lock \| npm audit inside packages/uxdsl: 0 vulnerabilities` | tarball/repo | C1, C6 | temporarily pin `source-map-js` to 1.2.1 in the lockfile: the check fails |
| T2 | `fixtures/vite-adapter/run.js` | prints `vite@^5 … ok` and `vite@^7 … ok` | tarball | C2, C3 | — |
| T3 | `fixtures/parity/run.js` | existing oracles | parity | byte-identity | — |
| T4 | `packages/uxdsl/test/vite/index.test.js` | existing 17 tests | unit | C2 | — |

## 9. Acceptance criteria

- **AC1** `cd packages/uxdsl && npm audit` exits 0 and prints `found 0 vulnerabilities`.
- **AC2** `node fixtures/vite-adapter/run.js` exits 0 and its output names both
  Vite majors.
- **AC3** `node fixtures/parity/run.js` exits 0 without `--update`.
- **AC4** `test -f .github/dependabot.yml` and the file lists the five directories.
- **AC5** `npm test` exits 0; `npm run verify:1.0 -- --skip-playground-walk`
  exits 0 with `AUDIT-lock ok`.

Owner steps: enable Dependabot security updates in the GitHub repository
settings.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes (dependency section; the declined peer floor) |
| package README | yes (the guard asks for it on a `package.json` change; one line in "Install") |
| everything else | no |

## 11. Documentation

`packages/uxdsl/CHANGELOG.md` (dependencies), `packages/uxdsl/README.md`
("Install": the audit statement), `docs/releases/0.5.0-beta.9.md` (the fresh
install figures are refreshed by MIG-B9-91).

## 12. Verification

```bash
(cd packages/uxdsl && npm audit)                     # exit 0
(cd packages/playground-nextjs && npm audit)         # report; only next's postcss may remain
node fixtures/vite-adapter/run.js                    # background; exit 0
node fixtures/parity/run.js                          # exit 0
npm test                                             # background; exit 0
npm run verify:1.0 -- --skip-playground-walk         # background; exit 0
```

## 13. Delivery

Branch `feat/b9-02-dependencies`. Commit:
`chore(FEAT-010): MIG-B9-02 - refresh lockfiles, Vite 7 in tests, Dependabot, AUDIT-lock gate check`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

- Next 14's bundled `postcss` 8.4.31 remains in the playground lockfile until
  the playground moves to Next 16 (MIG-B9-43).

### Findings of the delivery (2026-10-24)

- **Preconditions corrected (README §1.4, stale lines only).** `grep -q
  "vite@^5" …` → `grep -qF 'vite@^5' …`: BSD grep (macOS) reads `^` as an
  anchor, so the line exited 1 although the file contains `vite@^5`; `-F`
  matches the literal on both GNU and BSD grep. The two `cd` lines became
  `(cd packages/uxdsl && …)` and a bare `test ! -f .github/dependabot.yml`,
  so each line runs from the repository root (the review item below).
- **The baseline moved.** `npm audit` in `packages/uxdsl` on the base reports
  6 vulnerabilities (2 moderate, 4 high), not the recorded 3 high + esbuild +
  vite: `fast-uri` 3.1.8 (moderate, GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h,
  GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp) was published after the story
  was measured. `npm audit fix` moves it to 3.1.9.
- **Vite's floor moved too.** An advisory covering `vite` 7.0.0–7.3.6 was
  published after the story's 7.3.5; `^7.3.5` resolves to 7.3.7 (published
  2026-10-06), and the dev dependency is written `^7.3.7` so the range itself
  states the first clean version. Vite 7 brings `esbuild` 0.28.2, `rollup`
  4.64.2, `fdir`, `tinyglobby` and `picomatch` 4.0.7 into the dev tree.
- **Vite 7 is ESM-only.** `vite@7.3.7` has `"type": "module"`, one `import`
  export (`./dist/node/index.js`) and no `index.cjs`; `engines.node` is
  `^20.19.0 || >=22.12.0`. `require('vite')` still works on Node 20.19 through
  `require(esm)` (checked: `defineConfig`, `createServer` and `build` are
  functions), which is what makes the suite's Node version matter. CI's
  `node-version: 20` resolves to the latest 20.x (≥ 20.19), so nothing in
  `ci.yml` changed. The package's own `engines` is not touched: a *consumer*
  needs Node 20.19 only if it uses Vite 7, which Vite's own `engines` already
  says. Proposed: state the repository's development requirement (Node ≥
  20.19) in `CONTRIBUTING.md` (MIG-B9-51) and in the root `package.json`
  `engines`, not in `packages/uxdsl`'s.
- **The Vite 7 consumer in the fixture is ESM.** `fixtures/vite-adapter/run.js`
  keeps the `vite@^5` consumer as it was (a CommonJS `vite.config.js` with
  `require('vite')` and `require('uxdsl/vite')`) and writes the `vite@^7`
  consumer as Vite 7 documents it (`vite.config.mjs`, `import uxdsl from
  'uxdsl/vite'`, an `.mjs` HMR check). The adapter's `module.exports =
  Object.assign(uxdsl, { default: uxdsl })` serves both without a change. A
  CommonJS consumer on Vite 7 is not exercised by the fixture.
- **C4 holds only in part.** After three passes of `npm audit fix` (each pass
  fixes one layer; the first left 14, the second 10, the third 9), the
  playground's `npm audit` still reports **9 (8 high, 1 critical)**, not only
  next's `postcss`: `next` 14.2.35 itself (critical; 25 advisories; the fix
  is `next@16`, a major — MIG-B9-43's call), its bundled `postcss` 8.4.31
  (the recorded item), and the Nuxt tree — `nuxt` 4.6.2, `@nuxt/nitro-server`,
  `@nuxt/vite-builder`, `@nuxt/vite-server`, `nitropack`, `listhen`,
  `node-forge` 1.4.0 (GHSA-86w9-cpqp-85rv, range `*`: no fixed version
  exists). The Nuxt tree is installed because `@vercel/analytics` 1.6.0 and
  `@vercel/speed-insights` 1.3.0 list `nuxt` as a peer dependency; the Next
  playground never loads it. What C4 names is in place: top-level `postcss`
  8.5.31, `nanoid` 3.3.20, `source-map-js` 1.2.2; `@vue/devtools-core` moved
  8.0.5 → 8.2.1 and no longer nests a `nanoid` 5.x (the only `nanoid` left is
  3.3.20); the top-level `vite` 7.2.6 is gone and the three nested copies
  (under `nuxt`, `@nuxt/vite-builder`, `vite-node`) are 8.3.5. Proposed
  follow-up (a story of its own, or inside MIG-B9-43): drop the unused Nuxt
  peer tree from the playground install (npm `overrides`, or a replacement
  for the two `@vercel/*` packages), which removes seven of the nine.
- **The playground lockfile diff is large for the same reason.** 928 version
  lines changed and the package count went 1268 → 1277, almost all of it the
  Nuxt tree moving 4.2.1 → 4.6.2 with its dependencies; also the two stale
  extraneous entries for the former `../postcss-uxdsl` and `../uxdsl-cli`
  workspaces are gone, and `../uxdsl` is recorded at `0.5.0-beta.9` (it said
  `1.0.0-dev`). `npm ci --ignore-scripts` of both rewritten lockfiles exits 0.
- **`fixtures/mig02-nextjs-cssmodules` (no lockfile) resolves today** to
  `next` 14.2.35, `react`/`react-dom` 18.3.1, `playwright-core` 1.63.0, and
  next's own `postcss` 8.4.31 hoisted to the fixture's top level; `npm audit`
  there: 2 (next critical, postcss high), both the Next 16 items above.
- **Byte-identity holds for the parity oracles, not for every compiled
  output.** `npm test` failed at the playground's `test:captures`: the
  captured CLI build of `capability-fixtures/cli-project` is 49,487 bytes
  with `postcss` 8.5.31 and 49,478 with 8.5.6 — 9 inserted newlines, and
  identical once newlines are removed (checked by compiling the same project
  with both versions). Cause, bisected over the postcss tarballs: 8.5.19
  changed `Root.normalize` to keep the `raws.before` of a node inserted with
  one of its own instead of overwriting it with the previous sibling's.
  `emitTheme` (`plugin.ts`) re-applies the parsed `raws.before` after
  inserting, so the theme blocks are unchanged; the `@ds-button`/`@ds-input`
  state rules (`plugin.ts:313`, `insertAfter` of nodes parsed from text with
  a blank line between rules) and the rules `postcss-import` inlines do not,
  so their `\n\n` now survives. Every audit-clean `postcss` (≥ 8.5.23) has the
  change, so the text difference cannot be avoided by this story; the eight
  `fixtures/parity` oracles do not contain such a rule and are unchanged, so
  the stop rule ("a lockfile change alters a parity oracle") did not fire.
  Done here: the captures regenerated with the documented command
  (`node packages/playground-nextjs/scripts/capture-capabilities.js`; only
  `cli-captures.json` changed, by the byte counts), and the CHANGELOG's
  "Visual changes" states the text change. Not done here (engine, shared
  `plugin.ts`): pinning `raws.before` on the inserted state rules as
  `emitTheme` does, which would make the component output independent of the
  installed postcss again. Proposed for the owner: decide whether that
  whitespace is wanted (then a parity case with a `@ds-button` rule and an
  `@import` pins it) or not (then MIG-B9-13/21, which rewrite `plugin.ts`,
  re-apply the raw as `emitTheme` does).
- **A unit test outside this story's files was changed.**
  `packages/uxdsl/test/theme-blocks.test.js` ("splitSelectorList splits a
  selector list exactly as postcss.list.comma does") failed with the refreshed
  `postcss`: `postcss.list.split` changed twice in 8.5.x — since 8.5.27 an
  empty segment before a comma is kept (`list.comma(',.a')` is `['', '.a']`,
  it was `['.a']`), and since 8.5.29 a comma inside a comment no longer
  splits. UXDSL's `splitSelectorList` (`src/control-engine.ts`) is unchanged
  and compiled output is byte-identical (parity passed against 8.5.31); only
  the oracle claim over `',.a'`, which is not a valid selector list, became
  false. The test now keeps exact equality for every valid input (the comment
  case included, where the two now agree) and asserts UXDSL's `['.a']` for
  the leading comma, with the postcss versions named. The engine comment
  "the same contract as postcss.list.comma" in `control-engine.ts` is now
  stale; MIG-B9-21 (K7, comments in every `src` file) is where to rewrite it.
  Not fixed in the engine: keeping the empty segment would emit a state rule
  for an empty selector.
- **The negative control is encoded as well as run by hand.**
  `fixtures/release-1.0/audit-lock.test.js` (in the root `npm test`, next to
  `contrast-baseline.test.js`) audits the real lockfile (must be clean) and a
  copy with `source-map-js` pinned to 1.2.1 (must fail naming it); both ask
  the registry, like the gate. The root `package.json` `test` script gained
  that line (the file is in this story's shared list).
- `docs/releases/0.5.0-beta.9.md` still shows the gate at 65 checks and only
  `AUDIT`; with `AUDIT-lock` there are 66. MIG-B9-91 refreshes those figures
  (§11); not edited here.

### Review of 2026-10-11 (applied 2026-10-24)

Static review of the plan against `main` at `685c132`; applied in this
delivery as recorded above (the mig02 versions, and every precondition
runnable from the repository root).

- `fixtures/mig02-nextjs-cssmodules` has no lockfile, so "refresh" there means `npm install`; say which versions the fixture pins.
- A precondition `cd ../..` depends on the previous line's `cd`; make each line runnable from the repository root.
