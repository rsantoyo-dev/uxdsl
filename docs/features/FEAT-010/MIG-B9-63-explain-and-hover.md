# MIG-B9-63 — `uxdsl explain` and editor hover with the project theme

| Field | Value |
| --- | --- |
| Feature · Release | FEAT-010 · `0.5.0-beta.9` |
| Wave | 6 |
| Decision gate | None (plan §5.4; FEAT-009 MIG-B7-13, unblocked by the plan) |
| Status | Ready |
| Size | M |
| Depends on | MIG-B9-62 |
| Blocks | — |
| Base | `feat/beta9` after MIG-B9-62 |
| Owns | `packages/uxdsl/src/explain.ts` (new), `packages/uxdsl/test/cli/explain.test.js` (new), `packages/uxdsl-vscode/src/hover.ts`, `src/project-theme.ts` (new) |
| Shares | `packages/uxdsl/bin/uxdsl.js`, `packages/uxdsl-vscode/src/extension.ts`, `fixtures/vscode-extension/run.js` |
| Output impact | CLI (a new command); the extension (0.3.0) |

## 1. Goal

A token's value is visible where it is written: `uxdsl explain density(4)`
prints what it resolves to at every breakpoint with the project's own theme,
and hovering `density(4)` in VS Code shows the same. Completion of roles and
tones reads the project's theme, not the base.

## 2. Sources

- Plan §5.4: "Editor hover on `density(4)` → `0.75rem · md 1rem · xl 1.5rem`,
  resolved with the **project's** theme, not the base theme (this is
  MIG-B7-13 …). Same data as a small `uxdsl explain density(4)` CLI command,
  which the hover can call."
- FEAT-009 MIG-B7-13 and its decision D-11: reading a `.cjs` theme in the
  extension host means executing project code; the recommended path is to
  delegate to the project's own CLI.
- `uxdsl/language`: `inspectResponsiveValue(input, width, bps)`,
  `responsiveEntries`, `resolveResponsiveValue`; `uxdsl/theme`: `resolveTheme`,
  `generateThemeCss`; `uxdsl/engine`: `inspectTypographyTheme`,
  `inspectSurfaceTheme`, `inspect*Theme(theme, width)`, `*Declarations`.
- The extension: `extension.ts` registers a `CompletionItemProvider` with
  `generated-completions.ts` (the base theme's roles); `completion-context.ts`.

## 3. Preconditions

```bash
test -f packages/playground-nextjs/src/generated/reference.json
grep -q "registerCompletionItemProvider" packages/uxdsl-vscode/src/extension.ts
grep -q "export function inspectResponsiveValue" packages/uxdsl/src/language.ts
```

## 4. Baseline

```bash
node packages/uxdsl/bin/uxdsl.js explain 'density(4)' 2>&1 | head -1   # "Unknown command" today
```

## 5. Contract

- **E1 — `uxdsl explain <expression> [--width <px>] [--json]`.** With the
  project's discovered theme (the same discovery as `build`): for a token
  function, prints the variable name, the value at each breakpoint (and the
  resolved chain: `density(4)` → `space(4)`…`space(6)` → `0.75rem`…;
  `palette(primary.main)` → `color(purple.700)` → `#7e22ce`, light and dark);
  for a directive (`@ds-button(contained primary 2)`), the declarations and
  states it emits with their resolved values; for a breakpoint name, its
  width; for a theme key path (`densities.4`), its definition. `--width`
  answers for one viewport. Unknown input is the compiler's own error
  (`UXD_*`), exit 1. `--json` returns the structure the hover renders.
- **E2 — Hover.** The extension registers a `HoverProvider` for `.uxdsl`:
  on a token function, a directive or a breakpoint at-rule under the cursor,
  it runs `uxdsl explain --json <expression>` with the **workspace's**
  installed CLI (`node_modules/.bin/uxdsl` of the workspace folder; never a
  bundled copy), with the file's directory as cwd, a 2 s timeout and a per-
  expression cache invalidated on theme-file changes (the file watcher
  watches `uxdsl.theme.*`, `uxdsl.config.*`); renders the result as Markdown.
  No workspace CLI → a hover saying so with the install line. The extension
  never `require`s a theme file.
- **E3 — Completion from the project theme.** Roles, tones and sizes offered
  inside `@ds-*(` come from `uxdsl theme --json` of the workspace (cached,
  invalidated the same way), falling back to the base theme's generated
  completions when no CLI is found; custom breakpoint names of the project
  are completed as functions and at-rules.
- **E4 — Tests.** CLI tests over fixtures; extension unit tests with a fake
  `uxdsl` binary on the PATH of a temp workspace (no extension host);
  `fixtures/vscode-extension/run.js` asserts the VSIX declares the hover
  provider and the watcher.

Must stay byte-identical: compiled outputs.

## 6. Out of scope

- Diagnostics in the editor (squiggles): later, through the same CLI
  (`uxdsl build --json`).

## 7. Approach and traps

- `src/explain.ts` is a library (`explain(theme, expression, { width })`)
  the CLI wraps and the playground may reuse in `TokenEditor`'s readouts.
- Spawning the CLI per hover is cheap only with the cache; debounce hovers.
- Stop rule: never read or evaluate the theme inside the extension host.

## 8. Tests

| Id | File | Title | Level | Proves | Negative control |
| --- | --- | --- | --- | --- | --- |
| T1 | `test/cli/explain.test.js` | `MIG-B9-63: explain resolves a token, a directive, a breakpoint and a theme path with the project theme; --width; --json; an unknown token is the compiler's error` | CLI | E1 | a project override changes the printed value (control against the base theme) |
| T2 | `packages/uxdsl-vscode/test/hover.test.js` (new) | `MIG-B9-63: the hover runs the workspace CLI and renders its JSON; no CLI → the install hint; the cache invalidates on theme change` | unit | E2 | — |
| T3 | `packages/uxdsl-vscode/test/completion.test.js` | `MIG-B9-63: roles and tones come from uxdsl theme --json when available` | unit | E3 | the base list is used without a CLI |
| T4 | `fixtures/vscode-extension/run.js` | the VSIX declares the hover provider | fixture | E4 | — |

## 9. Acceptance criteria

- **AC1** `node --test packages/uxdsl/test/cli/explain.test.js` exits 0.
- **AC2** `npm --prefix packages/uxdsl-vscode test` exits 0; `npm run verify:vscode-extension` exits 0.
- **AC3** `npm test` exits 0.

## 10. Generated artifacts and guards

| Artifact | Needed |
| --- | --- |
| CHANGELOG | yes (`### CLI`) |
| package README | yes |
| `verify-docs-update.js` classification | yes (`src/explain.ts` non-visual) |
| `npm run generate:capabilities` | yes |
| playground captures | yes (`explain` transcript) |
| `AGENTS.md` ("Editor support") | yes |

## 11. Documentation

`packages/uxdsl/docs/integrations/cli.md`, `packages/uxdsl-vscode/README.md`,
`AGENTS.md`, the playground's `/docs/tooling` page.

## 12. Verification

```bash
node --test packages/uxdsl/test/cli/explain.test.js   # exit 0
npm --prefix packages/uxdsl-vscode test                # exit 0
npm run verify:vscode-extension                        # exit 0
npm test                                               # background; exit 0
```

## 13. Delivery

Branch `feat/b9-63-explain-hover`. Commit:
`feat(FEAT-010): MIG-B9-63 - uxdsl explain; hover and completion from the project's theme through the workspace CLI`.

## 14. Closure record

To be filled in the delivering PR.

## 15. Findings and follow-ups

### Review of 2026-10-11 (apply before implementing)

Static review of the plan against `main` at `685c132`; not a change to the contract until the owner accepts it in PR review.

- `uxdsl theme --json` does not exist (bin/uxdsl.js ~1929): `uxdsl theme` already prints JSON and unknown flags fail. Recommended: defer; the extension is not published yet.
