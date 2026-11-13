# `compile()` — the one pipeline

> The compile pipeline behind **UXDSL**'s CLI, Vite plugin and Webpack loader.

Part of the [`uxdsl`](../../README.md) package (`npm i -D uxdsl`). Until 0.5.0-beta.6 this was the separate `uxdsl-core` package; that name is deprecated and only re-exports `uxdsl`.

**[Visit the Official Documentation & Playground](https://uxdsl.io/)**

---

## Overview

The package root exports `compile()`: the pipeline that turns a `.uxdsl`
entry (or an in-memory source) into CSS. Dart Sass compiles the file first,
so every Sass feature works in a `.uxdsl` file, and the UXDSL plugin then
resolves the theme, token functions, responsive values and directives in
Dart Sass's output ([Sass inside `compile()`](#sass-inside-compile), below).
The CLI, `uxdsl/vite` and `uxdsl/webpack` all call it, so the same entry and
theme produce the same CSS everywhere. The PostCSS plugin used on its own
(`uxdsl/postcss`) is not this pipeline: it compiles CSS plus UXDSL, without
Sass ([below](#the-postcss-plugin-on-its-own)).

### Who is this for?

You typically do **not** call it directly unless you are building
a custom integration (a plugin for another bundler, a build script). For
standard projects, use [the CLI](cli.md) or the plugins for
[Vite](vite.md) and [Webpack](webpack.md).

---

## Installation

```bash
npm i -D uxdsl
```

`postcss` (`^8.4.31`) is a peer dependency: npm 7+ installs it automatically; with
`--legacy-peer-deps` or pnpm in strict mode, add it yourself. `sass` (Dart
Sass, the pure-JavaScript package) arrives with `uxdsl` as a regular
dependency; `compile()` loads it, and the PostCSS plugin used alone never
does. Dart Sass declares Node 20.19 or later in its `engines`.

## API

### `compile(input, config?)`

```javascript
const { compile } = require('uxdsl');

const { css, map, dependencies, warnings, themeEmitted } = await compile(
  { entry: './src/uxdsl-entry.uxdsl' },   // or { source, from? } for in-memory input
  {
    theme,               // theme override, same shape as the PostCSS plugin's `theme` option
    references,          // same shape as the PostCSS plugin's `references` option
    to: './dist/app.css',
    sourceMap: false,    // false (default) | 'inline' | 'external'
    sourcesContent: true, // embed the original sources in the map (default: true)
    sass: { silenceDeprecations: ['import'], quietDeps: true }, // passed to Dart Sass
  }
);
```

- `input`: exactly one of `{ entry: string }` (a file on disk, which Dart
  Sass reads) or `{ source: string, from?: string }`: in-memory text compiled
  as if it were the file `from`, which need not exist. Relative `@use`,
  `@forward` and `@import` resolve from `from`'s directory, positions and the
  source map name it, and `dependencies` lists it first. Without `from`,
  `source` is an anonymous `.uxdsl` file in the working directory: relative
  loads resolve from there, positions print `<css input>`, and it is never a
  dependency. The extension of `entry` or `from` decides how the text is read
  ([What the extension decides](#what-the-extension-decides)).
- `theme`: the project's theme override. Its `breakpoints` family is where
  thresholds are declared — there is no separate `breakpoints` option, so
  every integration reads them from the one place. Omitted, `compile()`
  discovers the theme file from the working directory, as the PostCSS plugin
  does; the CLI and the adapters discover it from their own root
  (`uxdsl/config`'s `discoverThemeAsync`) and pass the result here.
- `sass`: `{ silenceDeprecations?: string[], quietDeps?: boolean }`, passed to
  Dart Sass: the deprecation ids it stops reporting, and whether to silence
  the deprecations of the files it loads through a load path or `pkg:` (never
  those of the project's own files). Any other key, or a value of the wrong
  type, is an error (`uxdsl: unknown sass option "…"`), never silently
  ignored.
- `dependencies`: every file Dart Sass loaded, absolute — the entry (or
  `from`) first, then Sass's load order, each once, with no `sass:` module and
  no plain-CSS `@import` target — then the theme files the plugin discovered.
  Safe to feed to a bundler's file-watcher.
- `warnings`: `{ text, file?, line?, column? }[]`: Dart Sass's
  (`UXD_SASS_WARNING`, then `UXD_FUNCTION_SHADOWED`), then the plugin's, each
  at the author's file, line and column when it has a position; one without
  a position is `{ text }` alone.
- **The theme is emitted only where `@uxdsl theme;` is written**, in the
  stylesheet or in a file it loads (`@use` of a partial that writes it, which
  Dart Sass loads once per compilation): its `:root` blocks take the marker's
  place and its Google Fonts `@import` leads the output. A stylesheet without
  the marker carries only its own rules — `.card{padding:density(4)}` compiles
  to `.card {\n  padding: var(--uxdsl__density__4);\n}` — and still checks
  every reference against the theme. There is no option for it: a removed
  option passed in `config` (`includeTheme`, `breakpoints`, `themeVar`,
  `spaceVar`, `colorVar`) is ignored with one
  `UXD_OPTION_REMOVED: the "<name>" option was removed and is ignored; …`
  warning per call, after Dart Sass's.
- `themeEmitted`: `true` when this compilation emitted the theme, `false`
  when it did not. A tool that builds several stylesheets counts them from
  it — the CLI, the Vite plugin and the webpack loader warn
  `UXD_THEME_MARKER` when no stylesheet of a build that references tokens
  emitted it, or more than one did — rather than from its options or a
  `:root` search.
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
  for both modes. Without `to`, sources are relative to the working
  directory. A map names only the files the author wrote, as PostCSS names a
  file (relative and URL-encoded), with their text: Dart Sass's map and
  PostCSS's are chained.
- Generated nodes carry the source of whatever produced them: a declaration
  rewritten from `density()` maps to the original declaration, and the
  declarations a `@ds-button` expands into map to the directive's own line.
  CSS generated purely from the theme (the `:root` token blocks) is
  deliberately left unmapped rather than pointed at an invented file.
- **Every `@import` in the output precedes every other rule** (after an
  `@charset`, if there is one) — the theme's Google Fonts import first, then
  yours in the order you wrote them, then the theme's `:root`. Dart Sass
  moves an `@import` you wrote after another rule up there; nothing else is
  reordered. A stylesheet without `@uxdsl theme;` has no theme `:root` and
  no theme import.
- The output ends with the stylesheet's last rule, and, like Dart Sass's own
  output, without a final newline. Nothing is appended after it (an earlier
  version added a `/*@uxdsl-bp*/` comment and a `#uxdsl-bp-meta` rule for a
  runtime breakpoint rewriter that no longer exists).
- A failure is thrown as the stage that failed reports it, at the author's
  position ([Errors and warnings](#errors-and-warnings)).

### What is no longer exported

`require('uxdsl-core')` used to be callable — `processUxdsl(source, { fileId,
...config })` returned `Promise<string>`. That was a second signature for the
same pipeline and is gone: `compile({ entry: fileId }, config)` or
`compile({ source, from }, config)` and read `.css` from the result. The
`breakpoints` config option is gone too — declare `breakpoints` in the theme.

## Sass inside `compile()`

### The four stages

`compile()` runs four stages, and each changes only what it names:

1. **protect** (`src/sass/protect.ts`). In a `.uxdsl` file, the UXDSL syntax
   Dart Sass would read differently — a token call such as
   `palette(primary.main)` or `color(white)`, a `$var` inside `@ds-*(…)` — is
   rewritten so that Sass passes it through, with a column map back to the
   author's text. A `.scss`, `.sass` or `.css` file is served as written.
2. **Dart Sass** (`src/sass/compile-sass.ts`) compiles the entry exactly as
   Dart Sass does, in expanded style: `@use`, `@forward` and `@import`,
   nesting, mixins, functions, control rules, maps and math. A Sass failure
   is `UXD_SASS`, a Sass warning `UXD_SASS_WARNING`. The stage always
   produces a source map, which locates everything after it.
3. **restore**: `@ds-surface (contained)`, as Dart Sass writes an unknown
   at-rule, is `@ds-surface(contained)` again.
4. **The UXDSL plugin** (`src/plugin.ts`), on Dart Sass's output with
   PostCSS's default parser: the theme, the directives, responsive values,
   token functions and the reference check. Nothing else in Sass's output
   changes.

### Everything SCSS, as Dart Sass compiles it

A `.scss` file renamed to `.uxdsl` compiles to the CSS Dart Sass produces
for it: `@use` and `@forward`, `@mixin`/`@include` and `@content`,
`@function`, maps and lists, `@if`/`@each`/`@for`/`@while`, `@extend` with
`%placeholder`, the `sass:` modules, nesting and `&` all behave as Dart Sass
defines them. Bootstrap 5.3.8, renamed, is byte-identical
(`fixtures/sass-corpus`). UXDSL's words work inside it — a token can be a
variable's or a map's value, a mixin argument, or what `@each` and `@if`
pick — and the plugin resolves them after Sass has run:

```scss
@use 'sass:math';
@use 'sass:map';

$sizes: (sm: 1, md: 2, lg: 4);

@mixin stack($gap) {
  display: flex;
  flex-direction: column;
  gap: $gap;
}

.card {
  @include stack(density(2));
  padding: space(map.get($sizes, md));
  border-radius: radius(2);
  width: math.div(100%, 3);

  &__title {
    color: palette(primary.main);
  }
}
```

compiles to:

<!-- doc-example: output -->
```css
.card {
  display: flex;
  flex-direction: column;
  gap: var(--uxdsl__density__2);
  padding: var(--uxdsl__space__2);
  border-radius: var(--uxdsl__radius__2);
  width: 33.3333333333%;
}
.card__title {
  color: var(--uxdsl__palette__primary-main);
}
```

Apart from the recorded differences of functions named like UXDSL's
([below](#functions-named-like-uxdsls)), three things differ from plain Dart
Sass: `compile()` removes a top-level comment whose text starts with
`# sourceMappingURL=`, and two things fail, a `$variable` Sass keeps as
written ([below](#a-variable-sass-keeps-as-written)) and text Sass prints
that is not CSS ([below](#text-sass-prints-that-is-not-css)).

### Tokens are strings to Sass

To Sass, a UXDSL token — `palette(primary.main)`, `space(4)`,
`color(gray.300)` — is an unknown CSS function, a string it passes through;
it becomes a color, a length or a `var()` only in the plugin, after Sass has
run. A Sass function that needs a color or a number therefore fails on a
token, as `UXD_SASS` in Sass's words: `darken()`, `lighten()`,
`rgba($color, .5)`, `mix()`, `color.adjust()`, and the library functions
built on them — Bootstrap's `tint-color()`, `shade-color()` and
`button-variant()` among them, which report the error in Bootstrap's file
with the author's line in the stack. Arithmetic is the same: `space(4) * 2`
is `Undefined operation`, and `math.div(space(4), 2)` warns and leaves
`var(--uxdsl__space__4)/2`, which is not a length once the browser has
substituted the variable. Write the operation in CSS
instead, where the browser computes it with the token's value — a Palette
alpha (`palette(primary.main, 0.5)` is `color-mix(in srgb, … 50%,
transparent)`), `color-mix()`, relative color syntax
(`rgb(from palette(primary.main) r g b / 0.5)`) or `calc()`:

```scss
.badge {
  background: palette(primary.main, 0.5);
  border-color: color-mix(in srgb, palette(primary.main) 70%, black);
  padding: calc(space(2) / 2);
  color: darken(palette(primary.main), 10%);  /* UXD_SASS: $color: palette(primary.main) is not a color. */
}
```

```scss
.stack {
  gap: calc(space(4) * 2);
  margin: space(4) * 2;  /* UXD_SASS: Undefined operation "space(4) * 2". */
}
```

Anything that only moves a token around works, a responsive value
included:

```scss
$tones: (info: palette(info.main), danger: palette(error.main));
$gap: xs(space(2)) md(space(4));

@mixin bordered($color) {
  border: 1px solid $color;
}

@each $name, $tone in $tones {
  .alert--#{$name} {
    @include bordered($tone);
    gap: $gap;
  }
}
```

### How files are found

Dart Sass resolves every `@use`, `@forward` and `@import`, with `.uxdsl` as
a third Sass extension beside `.scss` and `.sass`:

- **Candidates.** A URL is answered by Sass's own candidates: the partial
  `_card` and `card`, each with `.uxdsl`, `.scss` or `.sass` (and the
  `.import` variants for `@import`); a `.css` file only when no Sass file
  matches; then `card/_index` and `card/index` when no file answers.
- **No precedence among Sass files.** Two Sass files of one directory that
  answer a URL — `card.uxdsl` beside `card.scss`, or `_card.uxdsl` beside
  `card.uxdsl` — are Sass's error, `UXD_SASS: It's not clear which file to
  import. Found: …`. Rename one; when converting a project, rename each
  `.scss` file rather than copying it.
- **Where.** First beside the importing file, then under each load path in
  order: every `node_modules` directory from the entry's directory up to the
  root, nearest first, then each directory of the `SASS_PATH` environment
  variable. A candidate beside the importing file wins over a load path, and
  files in different directories are never ambiguous. Each load path is
  searched as Dart Sass searches one: the URL is joined to it as written, and
  the file system resolves its `..`. A load path that does not exist
  therefore finds nothing, but through one that exists a `../x` that misses
  beside its file can still be found: `<root>/node_modules/../x` is
  `<root>/x`, as in plain Dart Sass.
- **Packages.** A package can ship `.uxdsl` partials: a bare path
  (`@use 'kit/scss/tokens'`) finds them under `node_modules`, and they `@use`
  each other relatively. `pkg:` URLs are Dart Sass's `NodePackageImporter`'s,
  so what a `pkg:` URL resolves to through the package's `package.json` must
  be a `.scss`, `.sass` or `.css` file (a `.uxdsl` export is Sass's error),
  and inside a package loaded through `pkg:`, Sass's own `.sass`, `.scss` and
  `.css` candidates or a directory index answer a relative URL before a
  `.uxdsl` partial does, without the ambiguity error.
- **No `~`.** `@use '~kit/tokens'` is `UXD_SASS: Can't find stylesheet to
  import.`: write `pkg:kit/tokens` or the bare `kit/tokens`.

```scss
// src/app.uxdsl
@use 'tokens';           // src/_tokens.uxdsl, or src/tokens/_index.uxdsl
@use 'kit/scss/forms';   // node_modules/kit/scss/_forms.uxdsl, or its .scss
@use 'pkg:sass-kit';     // the .scss file sass-kit's package.json names
```

### What the extension decides

The extension of the entry, of `from` or of a loaded file decides how Dart
Sass reads it:

- A `.uxdsl` file goes through protect, so UXDSL's words pass through Sass.
- A `.scss`, `.sass` or `.css` file is read as written, as plain Dart Sass
  reads it, so the UXDSL syntax Sass reads differently is Sass's there. A
  dotted key fails as `UXD_SASS` (`palette(primary.main)` is
  `expected "(".`). In a `.scss` or `.sass` file a `color()` token fails even
  without a dot (`color(white)` is `$description: white is not a string.`),
  an arithmetic key is evaluated (`space(10-2)` becomes `space(8)`, where a
  `.uxdsl` file reports `UXD_SPACE_REFERENCE`), and a `$var` inside
  `@ds-*(…)` stays as written, so it fails as `UXD_SASS_CONTEXT`. In a `.css`
  file a `$variable` is `Sass variables aren't allowed in plain CSS.`, and an
  operator `Operators aren't allowed in plain CSS.`
- So write UXDSL's tokens in `.uxdsl` files, name an entry `.uxdsl`
  (`uxdsl build --entry src/app.css` reads the file as CSS), and apply
  `uxdsl/webpack` to `.uxdsl` files rather than `.css`. A `.uxdsl` file may
  `@use` a `.scss`, `.sass` or `.css` file, which stays plain Sass or CSS:

```scss
// src/app.uxdsl
@use 'vendor' as v;   // src/_vendor.scss: plain SCSS, read as written
```

### Imports

Sass's import rules apply:

- `@use` and `@forward` load a module once per compilation, and
  `meta.load-css()` inlines a file where it is included, in a rule or under
  an `@if` too.
- `@import` of a `.uxdsl`, `.scss` or `.sass` partial inlines it, with Dart
  Sass's `[import]` deprecation as a `UXD_SASS_WARNING`, and a file
  `@import`ed twice is emitted twice (`@use`d twice, once).
- `@import 'x.css'`, and an `@import` with a media query, `layer()`,
  `supports()` or `url()` — of a `.uxdsl` file too — stays a plain CSS
  `@import`, moved before every other rule: the browser loads that file
  itself, untouched by UXDSL. `@use './x'` of a `.css` file inlines it, read
  as written.
- A loop is `UXD_SASS: Module loop: this module is already being loaded.`
  (through `@use`) or `This file is already being loaded.` (through
  `@import`), and a missing file `Can't find stylesheet to import.`, at the
  `@use` or `@import`.

```scss
@use 'tokens';           // inlined, once
@import 'reset.css';     // stays a CSS @import
@import 'print' print;   // stays a CSS @import: it has a media query
@import 'legacy';        // inlined, with the [import] deprecation
```

### What Dart Sass's output looks like

- Nested rules come out flattened, each with its parent selector written in
  place of `&`: `&__title` concatenates (`.card__title`), and
  `.a { .b { … } }` is `.a .b`.
- `//` comments are dropped, and so are comments inside values; every other
  `/* … */` comment, and a `url(//…)`, is kept.
- The formatting is Dart Sass's: `0.5` for `.5`, `""` for `''`,
  `@charset "UTF-8";` first for any non-ASCII text, a `calc()` inside `min()`,
  `max()` or `clamp()` written without `calc()` (`min(700px, 100% - 2rem)`
  for `min(700px, calc(100% - 2rem))`, the same value), no final newline.
- `compile()` removes a top-level comment whose text starts with
  `# sourceMappingURL=` (Dart Sass keeps `/* # sourceMappingURL=… */`), so the
  CSS is the same in the three `sourceMap` modes.

The [migration guide](../migration.md#beta9--sass-inside-compile) lists what
this changes for a project that compiled with the earlier SCSS subset.

### Functions named like UXDSL's

No UXDSL name is reserved; the one exception is the Sass stage's own helper
prefix, `uxdsl-probe-` (see the recorded differences below). A project
`@function` named like a UXDSL function — a
token function (`space`, `palette`, …), `tone`, or a breakpoint of the
effective theme (`md`, or a project's own `xxl`) — wins wherever Dart Sass
calls its bare name, as it would in plain Dart Sass, and `compile()` reports
one `UXD_FUNCTION_SHADOWED` warning per definition, at the definition:
`@function space (src/_helpers.uxdsl:1) replaces UXDSL's space() in this
build; rename it to use the token`. Rename the function to get the token
back. Where Sass does not call the bare name, the token stays: a call
through a namespace (`helpers.space(2)`) is the project's function and
shadows nothing, and a bare `space(2)` in that file is the token. Sass's
names are case-sensitive and UXDSL's are not, so after `@function space`,
`SPACE(2)` is still UXDSL's token:

```scss
@function space($n) {
  @return $n * 4px;
}

.card {
  padding: space(2);
  margin: SPACE(2);
}
```

compiles to this, with one `UXD_FUNCTION_SHADOWED` warning at line 1:

<!-- doc-example: output -->
```css
.card {
  padding: 8px;
  margin: var(--uxdsl__space__2);
}
```

Three recorded differences from plain Dart Sass, none of which warns: a
function reached under a UXDSL name only through `@forward … as <prefix>*` is
not found, so its calls keep the token; in a build where a loaded file
defines a function named `get-function` or `function-exists`, a call in some
`@import`ed files keeps the token where Dart Sass calls the project's
function; and the Sass stage names its own helper functions with the prefix
`uxdsl-probe-`, so a project function with that prefix can change the output
of a build that defines a function named like UXDSL's.

### A `$variable` Sass keeps as written

Dart Sass substitutes a `$variable` in a value, but keeps it as written
where it does not evaluate the text: in a custom property (`--gap: $gap`, a
`url()` there too), in the prelude of a plain-CSS at-rule (`@container`,
`@layer`, `@keyframes`, `@property`, an unknown at-rule, …), in a supports
condition it does not evaluate, in an `@import`'s `layer()`, in a `progid:`
value, in a CSS `@function` body, and in the arguments of `expression()`,
`element()`, `type()` and a vendor-prefixed `calc()`. CSS would read that
`$` as text, so `compile()` fails there as `UXD_SASS_CONTEXT`, with Sass's
fix: write `#{$gap}`. The check reads Sass's output, not the intent: a `$`
followed by a name outside a string fails wherever it comes from, Sass's
`#{"$x"}` and `string.unquote("$x")` included. Outside a string, the one way
to write such a `$name` into the CSS is the escape `\$gap`, which passes
with its backslash: a browser then reads the custom property as `\$gap`, not
`$gap`. A `$` that no name follows, or that is glued to a word
(`--price: $5`, `--y: a$v`), passes.

```scss
$gap: 4px;

.stack {
  padding: space(2);
  --gap: #{$gap};
  --label: \$gap;
  --raw: $gap;  /* UXD_SASS_CONTEXT: Sass keeps $gap as written in a custom property */
}
```

### Text Sass prints that is not CSS

The plugin reads Dart Sass's output as CSS, so text Sass prints from a
string (`string.unquote()`, `#{…}`) that is not CSS fails at the author's
position. PostCSS's parser rejects it as its own error, with no UXD code: a
`;` or a brace, an unclosed comment or string, an unclosed bracket in a
declaration, and a colon outside parentheses and strings in the value of a
property that is not custom (`b: a:b`, which Sass prints for
`string.unquote("a:b")`, is `Missed semicolon`; a custom property or a
`progid:` filter with such a colon is read). A `//` printed in such a value,
outside a string and a `url()`, is read as a `//` comment:
`UXD_SASS_CONTEXT`.

### Errors and warnings

- **A Sass failure** is an `Error` whose `code` is `UXD_SASS`, with `file`,
  `line` and `column` at the author's position (columns translated back
  through protect), `sassMessage` (Sass's message, verbatim), `sassFrame`
  (Sass's code frame and stack, redrawn with the author's text) and the
  `sass.Exception` as `cause`. Its message is
  `<file>:<line>:<column>: UXD_SASS: <Sass's message>` (`<css input>` for an
  anonymous source). An `@error`, or an argument a mixin does not take, is
  located at the call; a frame across two files shows the invocation and
  the declaration.
- **A UXDSL error** in Dart Sass's output is PostCSS's `CssSyntaxError`,
  whose `reason` starts with its `UXD_*` code, at the author's file, line
  and column: the start of the declaration or at-rule Dart Sass mapped or,
  for a value Sass copied, where it was written (a `$variable`'s definition,
  the declaration in a mixin). `error.showSourceCode()` frames the author's
  line. On a line the map does not cover, the error names the entry with no
  line or column.
- **A dotted near-miss** such as `palete(primary.main)` is Dart Sass's
  `UXD_SASS: expected "(".` through `compile()`, before the plugin's
  `UXD_FUNCTION_UNKNOWN` suggestion can run; an undotted one (`spacing(2)`)
  keeps the suggestion.
- **Warnings.** Every Sass warning is `UXD_SASS_WARNING: …` — a deprecation
  with its id in brackets (`[import]`, `[global-builtin]`, `[slash-div]`, …)
  or an `@warn`'s text — located like an error. Sass's own cap applies: five
  warnings per deprecation type, then one summary with no position
  (`UXD_SASS_WARNING: 3 repetitive deprecation warnings omitted.`).
  `sass.silenceDeprecations` silences a type and `sass.quietDeps` the
  deprecations of the files loaded through a load path or `pkg:`; an
  `@debug` prints nothing.

```scss
@mixin size($name) {
  @if $name != sm and $name != md {
    @error "No size #{$name}.";
  }
  padding: space(2);
}

.a { @include size(xl); }  /* UXD_SASS: "No size xl." */
```

### The PostCSS plugin on its own

`uxdsl/postcss` used alone — a `postcss.config.js` in Next.js, for instance
— compiles CSS plus UXDSL, and no Sass (FEAT-010, DEC-05). A Sass construct
reaching it fails as `UXD_SASS_CONTEXT` at the construct, naming the fix:
name the file `.uxdsl` and compile it with `uxdsl build`, `compile()` or an
adapter, or remove the Sass. Native nesting passes:

```css
.card { padding: density(2); }
.card { gap: $gap; }                  /* UXD_SASS_CONTEXT: a $variable */
.card { &__title { color: red; } }    /* UXD_SASS_CONTEXT: an &-suffix selector */
@use 'sass:math';                     /* UXD_SASS_CONTEXT: a Sass at-rule */
.card { &:hover { color: palette(primary.main); } }
```

- PostCSS's own parser rejects some Sass before the plugin runs, as its
  located `Unknown word` error with no UXD code: a `#{…}` in a selector, in a
  property name or bare in a value, and a `//` comment after a `;`, on a line
  of its own inside a block, or after the last rule.
- What looks like Sass but is valid CSS passes, undetected: a global Sass
  function such as `darken(red, 10%)` (to a browser, an unknown function that
  drops the declaration), `url($img)` on a property that is not custom,
  `#{…}` inside a string, and a `$` glued to a word (`--y: a$v`).
- In a PostCSS chain the plugin checks the stylesheet before any plugin's
  visitors run, so postcss-nested's `&_title` and postcss-simple-vars' `$gap`
  fail as `UXD_SASS_CONTEXT` in whichever order the plugins are listed; the
  [package README](../../README.md) gives the workaround.
- `compile()` accepts `@ds-surface (contained)`, with a space before the
  parenthesis, because restore removes it; the plugin alone refuses it
  (`UXD_SURFACE_ARGUMENT`). Write no space.

### The tests that pin it

`test/core/sass-matrix.test.js` holds the 110-case matrix: every Sass-valid
source recorded from the `sass` package itself and compared with live Dart
Sass, `compile()`'s output included, byte for byte.
`test/core/protect.test.js` runs the protect/restore cases through Dart Sass
directly and through `compile()`; `test/core/sass-source-maps.test.js` pins
positions and the final map through both stages,
`test/core/sass-pipeline.test.js` the pipeline's behaviors, and
`test/core/compile-sass.test.js` the Sass stage against Dart Sass on the same
project written as `.scss`; `fixtures/sass-corpus` compiles Bootstrap 5.3.8,
renamed. Every code on this page is in `DIAGNOSTIC_CATALOG` (`uxdsl/language`)
with its meaning and fix.

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
