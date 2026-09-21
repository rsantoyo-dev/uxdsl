# UXDSL for VS Code

Language support for **UXDSL** (User Experience Design System Language)
`.uxdsl` files.

## Features

- **Syntax highlighting**, generated from the compiler's own language
  metadata (`postcss-uxdsl`'s `LANGUAGE_COMPLETIONS`) — never hand-typed,
  so it can't silently drift from what actually compiles:
  - Directives: `@theme`, `@ds-surface`, `@ds-typo`, `@ds-button`, `@ds-input`.
  - Functions: `palette()`, `color()`, `space()`, `density()`, `radius()`,
    `rounded()`, `border()`, `shadow()`, `elevation()`, and the configured
    breakpoints (`xs()`, `sm()`, `md()`, `lg()`, `xl()` by default).
  - Standard CSS syntax, via the built-in `source.css` grammar.
- **Context-aware completion** — functions only inside a declaration's
  value, directives only after `@`, and role/tone/size/override arguments
  once inside `@ds-surface(`/`@ds-button(`/`@ds-input(`. Nothing is
  suggested inside a selector, a comment, or a string.
- **CSS IntelliSense** for the same directives via `uxdsl.custom-data.json`
  (VS Code's built-in CSS language service reads this directly — hover and
  completion for `@ds-*` work in any editor that supports the CSS custom
  data format, not just this extension's own completion provider).

### Known gaps (out of scope for this release)

Completion based on your project's *own* theme (roles/tones/sizes it
actually resolves to), live diagnostics, breakpoint hover, go-to-definition,
and real CSS IntelliSense *inside* `.uxdsl` files (e.g. property-value
validation) are not implemented yet — planned as a future story (MIG-B6-08,
post-0.5.0; see `docs/features/FEAT-008/MIG-B6-26-*.md`'s own "Fuera de
alcance" section). Today's role/tone/size completions are generated from
the compiler's *built-in default* theme — accurate for a project that
hasn't customized those families, not necessarily for one that has.

In the meantime, `.uxdsl` files can be associated with the `scss` language
instead, trading this extension's UXDSL-aware grammar for full IntelliSense
of the parts of the file that *are* valid SCSS:

```json
// .vscode/settings.json
{ "files.associations": { "*.uxdsl": "scss" } }
```

This is a real trade-off, not a strict upgrade: UXDSL-specific syntax
(`@ds-*` directives, `xs()`/`md()` responsive functions) won't highlight or
complete correctly under the `scss` grammar, since none of it is real SCSS.

## Installation (from source)

Not yet published to the Marketplace or Open VSX (see
`docs/features/FEAT-008/MIG-B6-26-*.md` for status). Package it yourself:

```bash
npm install
npm run package        # produces uxdsl-vscode-<version>.vsix
```

Then in VS Code: Command Palette → "Extensions: Install from VSIX...".

## Development

```bash
npm install
npm run compile   # or `npm run watch` while editing
npm test          # completion-context.test.js + grammar.test.js (node --test)
```

`F5` in this folder launches a real Extension Development Host window to
try highlighting/completion interactively against a `.uxdsl` file.

The grammar (`syntaxes/uxdsl.tmLanguage.json`), the CSS custom data
(`uxdsl.custom-data.json`) and the completion data
(`src/generated-completions.ts`) are all generated —
`npm run generate:language` at the repository root regenerates them from
`postcss-uxdsl`'s compiled `LANGUAGE_COMPLETIONS`/engine defaults. Do not
hand-edit any of the three; `node scripts/generate-language-artifacts.js
--check` (run from the repo root) fails if they drift from source.

## Typography configuration

Use `@ds-typo(h1)` (or another configured role) in component styles. Define
its responsive fields in `typography_details` in the theme JSON, alongside
`fonts`, `spacing`, and `breakpoints`. PostCSS and runtime use the same
Typography compiler; the playground is an editor and consumer of that
contract.

## Connect & Support

- **Website**: [uxdsl.vercel.app](https://uxdsl.vercel.app)
- **Twitter**: [@rsantoyo_dev](https://twitter.com/rsantoyo_dev)
- **LinkedIn**: [Ricardo Santoyo](https://www.linkedin.com/in/ricardo-santoyo)
- **GitHub**: [rsantoyo-dev/uxdsl](https://github.com/rsantoyo-dev/uxdsl)
