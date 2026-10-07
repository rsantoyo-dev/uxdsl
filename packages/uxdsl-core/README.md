# uxdsl-core

> The compile pipeline behind **UXDSL**'s CLI, Vite plugin and Webpack loader.

[![npm version](https://img.shields.io/npm/v/uxdsl-core.svg)](https://www.npmjs.com/package/uxdsl-core)
[![License](https://img.shields.io/npm/l/uxdsl-core.svg)](LICENSE)

**[Visit the Official Documentation & Playground](https://uxdsl.io/)**

---

## Overview

`uxdsl-core` exports one function, `compile()`: the pipeline that turns a
`.uxdsl` entry (or an in-memory source) into CSS — `postcss-scss` syntax,
`postcss-import` with a shared resolver, `postcss-advanced-variables` for
`$var`/`@each`/`@mixin`, then `postcss-uxdsl`. `uxdsl-cli`, `vite-plugin-uxdsl`
and `uxdsl-webpack-loader` all call it, so the same entry and theme produce
the same CSS everywhere.

### Who is this for?

You typically do **not** need to install this directly unless you are building
a custom integration (a plugin for another bundler, a build script). For
standard projects, use [uxdsl-cli](../uxdsl-cli) or the plugins for
[Vite](../vite-plugin-uxdsl) and [Webpack](../uxdsl-webpack-loader).

---

## Installation

```bash
npm install uxdsl-core
```

`postcss` (`^8.4.31`) is a peer dependency: npm 7+ installs it automatically; with
`--legacy-peer-deps` or pnpm in strict mode, add it yourself.

## API

### `compile(input, config?)`

```javascript
const { compile } = require('uxdsl-core');

const { css, map, dependencies, warnings } = await compile(
  { entry: './src/uxdsl-entry.uxdsl' },   // or { source, from? } for in-memory input
  {
    theme,               // theme override, same shape as postcss-uxdsl's `theme` option
    references,          // same shape as postcss-uxdsl's `references` option
    includeTheme: true,  // emit the theme's :root tokens (default: true)
    to: './dist/app.css',
    sourceMap: false,    // false (default) | 'inline' | 'external'
    sourcesContent: true // embed the original sources in the map (default: true)
  }
);
```

- `input`: exactly one of `{ entry: string }` (a real `.uxdsl` file on disk)
  or `{ source: string, from?: string }` (in-memory source; `from` is used
  as the base path for relative `@import`s, bare/`~` specifier resolution,
  cycle detection and diagnostics — it need not exist on disk).
- `theme`: the project's theme override. Its `breakpoints` family is where
  thresholds are declared — there is no separate `breakpoints` option, so
  every integration reads them from the one place. `compile()` does not
  discover a theme file itself; the CLI and the adapters do that
  (`postcss-uxdsl/config`'s `discoverThemeAsync`) and pass the result here.
- `dependencies`: every file actually read, entry first — safe to feed to a
  bundler's file-watcher.
- `warnings`: `{ text, file?, line?, column? }[]` from the underlying
  PostCSS run.
- `sourceMap`: `'external'` returns the map as a JSON string in `map` and
  leaves `css` untouched — the caller adds the `sourceMappingURL` comment,
  since only it knows what the `.map` will be called. `'inline'` appends the
  map to `css` as a base64 data URI (last in the file, so it is the
  annotation that counts) *and* still returns it in `map`. `false` (the
  default) returns no map and produces **byte-identical** CSS to omitting the
  option entirely. Any other value throws rather than silently emitting
  nothing.
- `to` is what map `sources` are resolved against, so pass the real output
  path: an external `.map` lands next to the CSS, making one `to` correct
  for both modes. Without `to`, PostCSS falls back to `from`'s directory.
- Generated nodes carry the source of whatever produced them: a declaration
  rewritten from `density()` maps to the original declaration, and the
  declarations a `@ds-button` expands into map to the directive's own line.
  CSS generated purely from the theme (the `:root` token blocks) is
  deliberately left unmapped rather than pointed at an invented file.
- `@import` resolution: relative paths (`./x.uxdsl`), bare package
  specifiers (`some-package/tokens.css`), and `~`-prefixed
  specifiers (`~some-package/x.css`) are all supported — the last two
  resolve through real Node module resolution.
- A missing import is a real, located error (`Failed to find '...' in
  [...]`), not a silently-untouched `@import` line in the output.
- An import cycle (`a.uxdsl` → `b.uxdsl` → `a.uxdsl`) always fails
  (`UXD_IMPORT_CYCLE`), naming the full file chain, rather than silently
  duplicating content.
- **Every `@import` in the output precedes every other rule** (after an
  `@charset`, if you have one) — the theme's Google Fonts import first, then
  yours in the order you wrote them, then the theme's `:root`. Nothing you
  wrote is reordered. `includeTheme: false` emits no theme `:root` and no
  theme import.
- `//` line comments are stripped from the compiled output (as a real Sass
  compiler would); `/* ... */` block comments, including ones containing a
  URL, and `url(...)` values containing `//`, are left completely intact.
- The output ends with the stylesheet's last rule. Nothing is appended after
  it (an earlier version added a `/*@uxdsl-bp*/` comment and a
  `#uxdsl-bp-meta` rule for a runtime breakpoint rewriter that no longer
  exists).

## The SCSS subset

`compile()` reads `.uxdsl` with `postcss-scss` and runs
`postcss-advanced-variables`, so a stylesheet may use **this subset of Sass,
and only this**:

| Supported | Notes |
| --- | --- |
| `$variables` | `$x: 1px;` at the root or inside a block (block scope), `!default`, `#{$x}` interpolation in a selector, a value or a media query |
| `@if` / `@else` | `@else if` is not supported (it fails with the variables plugin's own error) |
| `@each $x in (a, b)` | lists only — no maps, no `@each $k, $v` |
| `@for $i from 1 through 3` | |
| `@mixin` / `@include` | positional arguments, defaults (`@mixin m($a: 1px)`), `@content`; an argument may be any value, token functions and responsive expressions included: `@include pad(density(2))`, `@include pad(xs(1px) md(2px))`, `@include box(rgba(0,0,0,.5), 2px)` all work as written. No keyword (`$b: 9px`) or variadic (`$args...`) arguments |
| `@import "./partial"` | a path, with or without the extension-less `_partial` convention |
| native CSS nesting | `.a { .b {} }`, `&:hover`, `& .child`, `&.other`, `.x &`, `@media` inside a rule — **forwarded to the browser as written, not flattened** (Chrome 120+, Safari 17.2+, Firefox 117+) |
| `//` line comments | stripped from the output |

Everything else Sass has is **not** compiled and fails with a located error
naming what to write instead — never text the browser would silently discard:

| Unsupported | Error | Instead |
| --- | --- | --- |
| `&__item`, `&--mod`, `&-suffix` | `UXD_NESTING_INVALID` | native nesting cannot concatenate the parent selector; write `.block__item` |
| `@extend`, `%placeholder` | `UXD_SCSS_UNSUPPORTED` | a mixin, or a shared class in the markup |
| `@use`, `@forward` | `UXD_SCSS_UNSUPPORTED` | `@import "./partial"` |
| `@function` / `@return`, `@while`, `@at-root`, `@debug` / `@warn` / `@error` | `UXD_SCSS_UNSUPPORTED` | a mixin, `@for`/`@each`, a root-level rule, nothing |
| `!global` | `UXD_SCSS_UNSUPPORTED` | declare the variable at the root |
| `#{…}` around anything but a `$variable` (`#{palette(primary.main)}`) | `UXD_SCSS_UNSUPPORTED` | write the value directly |
| an undefined `$x`, or `$x` where the variables plugin could not resolve it | `UXD_SCSS_UNSUPPORTED` (or the plugin's own located error) | declare it before its use |
| Sass functions: `darken()`, `lighten()`, `mix()`, `map-get()`, `nth()`, `percentage()`, `unquote()`, `str-*()`, `math.*`, `map.*`, `color.*`, Sass's `if(a, b, c)`, `rgba($color, .5)` | `UXD_SCSS_UNSUPPORTED` | a Palette variant or alpha (`palette(primary, 0.5)`), `color-mix()`, `rgb(from … / .5)`, `calc()`, the value itself |
| arithmetic outside `calc()`: `10px * 2`, `1rem + 2px`, `$a + $b`, `10px / 2`, `"a" + "b"` | `UXD_SCSS_UNSUPPORTED` | `calc(10px * 2)` (a slash between two plain numbers or two lengths — `aspect-ratio: 16 / 9`, `border-radius: 10px / 20px` — is CSS and stays) |
| an `@include` with unbalanced parentheses | `UXD_INCLUDE_ARGUMENT` | balance them |

`test/scss-subset.test.js` pins all of this with the 110-case matrix of the
2026-09-29 audit: every case either compiles to the exact CSS recorded there —
valid CSS, with no Sass construct left in it — or fails with the recorded
error. There is no third outcome.

### What this package no longer exports

`require('uxdsl-core')` used to be callable — `processUxdsl(source, { fileId,
...config })` returned `Promise<string>`. That was a second signature for the
same pipeline and is gone: `compile({ entry: fileId }, config)` or
`compile({ source, from }, config)` and read `.css` from the result. The
`breakpoints` config option is gone too — declare `breakpoints` in the theme.

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
