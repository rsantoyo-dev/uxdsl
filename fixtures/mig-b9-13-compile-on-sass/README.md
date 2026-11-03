# mig-b9-13-compile-on-sass

MIG-B9-13 (FEAT-010). What renders differently now that `compile()` runs on Dart Sass, read in
real Chrome. The package CHANGELOG's "Visual changes" and the migration guide ("beta.9 — Sass
inside compile()", items 1 and 2) describe these changes; `browser.js` checks each one on a
computed style.

```sh
node fixtures/mig-b9-13-compile-on-sass/browser.js                   # the repository build
node fixtures/mig-b9-13-compile-on-sass/browser.js --package <dir>   # the build in <dir>/dist
```

| Probe | Source | `compile()`'s output in Chrome | Negative control in Chrome |
| --- | --- | --- | --- |
| t1 | `.x, #y { .c { … } }` against `.x .c.d` | `.x .c.d` wins: `.x .c` keeps its own specificity | the nested rule wins: native nesting weighs `:is(.x, #y) .c` |
| t2 | `.q::before { content: "A"; & { content: "B"; } }` | `"B"` | `"A"`: native nesting under a pseudo-element matches nothing |
| t3 | `.a .b { .c & { … } }` on `.a > .c > .b` | no match: `.c .a .b` needs `.c` above `.a` | matches |
| t4 | a partial `@import`ed by `_a.uxdsl`, then again by the entry | the second copy wins over `_a`'s rule | emitted once, the partial loses to `_a`'s rule |
| t5 | `.btn { @ds-button(contained); &:hover { … } }` | the nested rule follows the generated state rules and wins the `:hover` tie | placed before the state rules, it loses |

The probes without UXDSL syntax (t1–t4) must also compile to Dart Sass's own output for the same
source. The negative control loads what a browser gets without each change — the rules as
native CSS nesting, the partial once, the nested rule before the directive's state rules — and
must render the other value for every probe, so each check can fail. Every check is printed,
and the script exits 1 when any fails.

It is not part of `npm test`. It needs Google Chrome (the macOS default path, or
`UXDSL_CHROME_PATH`) and `playwright-core`, which it takes from
`fixtures/mig02-nextjs-cssmodules` (`npm install` there); without Chrome it fails, never passes.
