# MIG-B9-55 — The VS Code extension, packaged

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` (or beta.10 under DEC-03 (b)) |
| Wave | 5 |
| Decision gate | None (plan §3.2) |
| Status | Ready |
| Size | S |
| Depends on | MIG-B9-30 (the breakpoint at-rules in the grammar) |
| Blocks | — |
| Base | `feat/beta9` after MIG-B9-30 |
| Owns | `packages/uxdsl-vscode/**` (manifest, README, icon, CHANGELOG), `fixtures/vscode-extension/run.js` |
| Shares | `scripts/generate-language-artifacts.js` (grammar for `@uxdsl theme;`), `scripts/release.js` (VSIX step) |
| Output impact | none (the extension's own version moves to 0.2.0) |

## 1. Goal

The extension is ready for the Marketplace and Open VSX: an icon, a license,
keywords, a marketplace-facing README, and highlighting and completion for
everything beta.9's language has. Publishing stays the owner's.

## 2. Sources

- Plan §3.2: "128 px icon, `license` + LICENSE, `keywords`, a marketplace-
  facing README, `@uxdsl theme;` highlighted and completed;
  `npm run verify:vscode-extension`. Publishing (Marketplace, Open VSX) is the
  owner's."
- `packages/uxdsl-vscode/package.json`: `uxdsl-vscode` 0.1.0, publisher
  `rsantoyo-dev`, `engines.vscode ^1.80.0`, contributes `css`, `languages`,
  `grammars`; no `icon`, `license`, `keywords`, `galleryBanner`.
- `fixtures/vscode-extension/run.js`: a real `vsce package`, verifying the
  VSIX contains the manifest, the grammar, the language configuration, the
  custom data and the compiled activation entry; it does not launch an
  extension host (documented gap).
- `scripts/generate-language-artifacts.js` generates the TextMate grammar
  and `src/generated-completions.ts` from `LANGUAGE_COMPLETIONS`; MIG-B9-30
  adds the breakpoint at-rules; `scripts/release.js` builds the VSIX.
- The extension README says a project's own breakpoint names are not
  highlighted or completed (MIG-B9-63 adds project-theme completion).

## 3. Preconditions

```bash
test "$(node -p "require('./packages/uxdsl-vscode/package.json').version")" = "0.1.0"
node -e "const p=require('./packages/uxdsl-vscode/package.json');process.exit(p.icon||p.license||p.keywords?1:0)"
grep -q "ds-" packages/uxdsl-vscode/syntaxes/uxdsl.tmLanguage.json
```

## 4. Baseline

```bash
npm run verify:vscode-extension 2>&1 | tail -3
```

## 5. Contract

- **X1 — Manifest.** `version` 0.2.0; `icon` → `assets/icon.png` (128×128,
  the project's mark, no third-party logo); `license` `MIT` and a `LICENSE`
  file copied from the repository root; `keywords` (`css`, `scss`, `design
  system`, `design tokens`, `theme`, `uxdsl`); `galleryBanner`;
  `repository`, `bugs`, `homepage` (`https://uxdsl.io`); `categories`
  `Programming Languages`, `Snippets`? (only if snippets exist; otherwise
  `Programming Languages` alone).
- **X2 — Language surface.** `@uxdsl theme;` is highlighted as a UXDSL at-rule
  and completed after `@`; the breakpoint at-rules (`@xs` … `@xl`, default
  names) are highlighted (from MIG-B9-30's generated grammar); `tone()` in
  theme JSON is not the extension's concern (JSON files use the schema).
- **X3 — README for the marketplace.** What it does (highlighting,
  completion, the schema for theme files), what it does not (project theme
  names — until MIG-B9-63), install (Marketplace, Open VSX, `.vsix`), a
  screenshot (the playground's `/docs/tooling` page provides the image source;
  stored under `assets/`), a link to `uxdsl.io`.
- **X4 — The fixture.** `fixtures/vscode-extension/run.js` additionally asserts
  the VSIX contains the icon and the LICENSE, that the manifest has the X1
  fields, and that the grammar has the `uxdsl` at-rule and the breakpoint
  at-rules.
- **X5 — Not published.** The story leaves `vsce package` output in
  `packages/uxdsl-vscode/*.vsix` (gitignored); publishing to the Marketplace
  (`vsce publish`, publisher `rsantoyo-dev`) and Open VSX (`ovsx publish`) is
  the owner's, documented in the release record as two commands.

Must stay byte-identical: the package `uxdsl`.

## 6. Out of scope

- Hover and project-theme completion: MIG-B9-63.
- An extension-host test: still a gap, recorded.

## 7. Approach and traps

- The icon is generated from the same mark the playground uses (an SVG in
  `public/`), rendered to PNG at 128×128 by a script committed next to it
  (`scripts/render-icon.js` exists in the session's scratch history as a
  precedent); no binary without its source.
- `vsce` refuses a README with relative image paths unless `repository` is
  set; set it and use repository-relative paths.
- Stop rule: none specific.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `fixtures/vscode-extension/run.js` | the VSIX contains the icon, the LICENSE, the manifest fields, the at-rules in the grammar | fixture | X1, X2, X4 | a manifest without `icon` fails |
| T2 | `packages/uxdsl-vscode` `npm test` | existing tests | unit | X2 | — |
| T3 | `scripts/release.js --dry-run` | builds the VSIX | release | X5 | — |

## 9. Acceptance criteria

- **AC1** `npm run verify:vscode-extension` exits 0.
- **AC2** `node scripts/release.js --version 0.5.0-beta.9 --tag latest --dry-run --skip-build`
  exits 0 and reports the VSIX built.
- **AC3** `npm test` exits 0.

Owner steps: `vsce publish` and `ovsx publish` after the npm release.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| `npm run generate:language` | yes (if the grammar gains the `uxdsl` at-rule here) |
| `AGENTS.md` ("Editor support") | yes (one sentence: Marketplace availability once published) |

## 11. Documentation

`packages/uxdsl-vscode/README.md`, `packages/uxdsl-vscode/CHANGELOG.md`,
`docs/releases/0.5.0-beta.9.md` (the two publish commands).

## 12. Verification

```bash
npm run verify:vscode-extension                                                   # exit 0
node scripts/release.js --version 0.5.0-beta.9 --tag latest --dry-run --skip-build   # exit 0
npm test                                                                          # background; exit 0
```

## 13. Delivery

Branch `feat/b9-55-vscode`. Commit:
`feat(FEAT-010): MIG-B9-55 - the VS Code extension packaged for the Marketplace: icon, license, keywords, README, @uxdsl theme; and breakpoint at-rules`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- The dry run prints "would package" and builds no VSIX (release.js:310-313); there is no SVG mark in the playground's `public/` (only PNGs); it cites a session-scratch script that is not in the repository.
