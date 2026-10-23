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
cd packages/uxdsl && npm audit --omit=dev --json | node -e "const a=JSON.parse(require('fs').readFileSync(0,'utf8'));process.exit(Object.keys(a.vulnerabilities).length?0:1)"   # vulnerable today: exit 0
cd ../.. && test ! -f .github/dependabot.yml
grep -q "vite@^5" fixtures/vite-adapter/run.js
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
| T1 | `fixtures/release-1.0/run.js` | `AUDIT-lock | npm audit inside packages/uxdsl: 0 vulnerabilities` | tarball/repo | C1, C6 | temporarily pin `source-map-js` to 1.2.1 in the lockfile: the check fails |
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

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- `fixtures/mig02-nextjs-cssmodules` has no lockfile, so "refresh" there means `npm install`; say which versions the fixture pins.
- A precondition `cd ../..` depends on the previous line's `cd`; make each line runnable from the repository root.
