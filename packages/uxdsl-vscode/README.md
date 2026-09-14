# UXDSL for VS Code

This extension provides language support for **UXDSL** (User Experience Design System Language).

## Features

- **Syntax Highlighting**: Colorization for `.uxdsl` files, including:
  - Directives: `@theme`, `@ds-button`, `@ds-surface`, etc.
  - Functions: `palette()`, `space()`, `radius()`, `density()`.
  - Responsive modifiers: `xs()`, `sm()`, `md()`, `lg()`, `xl()`.
  - Standard CSS syntax support.
- **IntelliSense**: Basic autocompletion for UXDSL directives.
- **Snippets**: (Coming soon)

## Installation

1. Install `vsce` globally: `npm install -g @vscode/vsce`
2. Package the extension: `vsce package`
3. Install the generated `.vsix` file in VS Code:
   - Open Command Palette (`Cmd+Shift+P`)
   - Run "Extensions: Install from VSIX..."

## Development

1. Open this folder in VS Code.
2. Press `F5` to launch a new Extension Development Host window.
3. Open a `.uxdsl` file to test the highlighting and completion.

## Connect & Support

- **Website**: [uxdsl.vercel.app](https://uxdsl.vercel.app)
- **Twitter**: [@rsantoyo_dev](https://twitter.com/rsantoyo_dev)
- **LinkedIn**: [Ricardo Santoyo](https://www.linkedin.com/in/ricardo-santoyo)
- **GitHub**: [rsantoyo-dev/uxdsl](https://github.com/rsantoyo-dev/uxdsl)


## Typography configuration

Use `@ds-typo(h1)` (or another configured role) in component styles. Define its
responsive fields in `typography_details` in the theme JSON, alongside `fonts`,
`spacing`, and `breakpoints`. PostCSS and runtime use the same Typography compiler;
the playground is an editor and consumer of that contract.

The extension currently offers syntax highlighting and basic directive completion.
It does not yet validate theme JSON or provide theme-aware Typography role/field
completion. See `docs/features/FEAT-002-unified-typography-engine.md` for that roadmap.
