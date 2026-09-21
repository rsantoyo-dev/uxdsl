# Changelog

## 0.1.0 (MIG-B6-26, FEAT-008)

First reliable release. Everything below fixes a real bug in `0.0.1`
(never published) — see `docs/features/FEAT-008/MIG-B6-26-*.md` for the
full reproduction and evidence.

- **Grammar**: the TextMate grammar (`syntaxes/uxdsl.tmLanguage.json`) is
  now generated from `postcss-uxdsl`'s own `LANGUAGE_COMPLETIONS`, instead
  of a hand-maintained file that could silently drift from what the
  compiler actually accepts. Verified by tokenizing real UXDSL source with
  the actual Oniguruma engine VS Code uses (`vscode-textmate` +
  `vscode-oniguruma`), not just `JSON.parse`/`new RegExp` in Node. Also
  adds an explicit string-literal rule: text inside a quoted string (e.g.
  `content: "@ds-button"`) was previously highlighted as a real directive/
  function call.
- **CSS custom data** (`uxdsl.custom-data.json`) is now generated the same
  way. The hand-written version used a `functions` key the CSS custom data
  format doesn't recognize (only `atDirectives`/`properties`/
  `pseudoClasses`/`pseudoElements` are valid), documented a `typography()`
  function and `@ds-typography` directive that don't exist, was missing
  `@ds-input` entirely, and its own `radius(md)` example didn't compile
  (`md` isn't a valid radius key).
- **Completion** is now context-aware: functions are only suggested inside
  a declaration's value (never in a selector or a comment/string),
  directives only after `@`, and `@ds-surface`/`@ds-button`/`@ds-input`'s
  own arguments now offer real roles, tones (palette families with
  main/dark/contrast) and sizes (the Density/Radius intersection), not
  just the `radius`/`shadow` override functions. The detection logic moved
  to a pure `src/completion-context.ts` module, tested directly with
  `node --test` (no extension host needed). The space character (`' '`)
  was removed from the completion trigger characters — it fired the
  suggestion widget on every space, including inside a selector.
- **`language-configuration.json`**: fixed `"{ "` (with a trailing space)
  in `brackets`/`autoClosingPairs`/`surroundingPairs` to `"{"`, and added
  `"lineComment": "//"`.
- **Packaging**: the extension version bumped to `0.1.0`; the previously
  committed `uxdsl-vscode-0.0.1.vsix` (built in December 2025, with an
  invalid grammar that failed to load at all — `Bad escaped character in
  JSON at position 468`) is removed from the repository; `*.vsix` is now
  gitignored. `npm run package` (via `@vscode/vsce`) produces a real
  package, verified end to end (manifest, grammar, language configuration
  and compiled entry points present; dev-only source/test files excluded
  via `.vscodeignore`).

### Known limitations

- Not published to the Marketplace or Open VSX yet — publishing requires
  the maintainer's own tokens.
- No CI workflow packages or tests this extension automatically yet; this
  release only makes `npm run compile`/`test`/`package` work correctly
  when run locally (or from a future CI step). See the story's own
  "Límites y seguimiento" for why: no CI configuration exists anywhere in
  this repository yet (a separate, later story's scope).
- Completion is not launched inside a real VS Code Extension Host as part
  of automated testing — verified instead via the real Oniguruma
  tokenization engine (grammar) and a pure unit-tested context function
  (completion), both of which run in plain Node.
