# MIG-B9-91 — Press Craftor on the `0.5.0-beta.9` release candidate

The external check of [MIG-B9-91](../MIG-B9-91-gate-and-release.md) (decision
D13 of 2026-11-04): Press Craftor (the owner's `story-radar` repository) moved
from the four `0.5.0-beta.8` packages to the tarball of the release candidate
by the steps of the release record's section "From 0.5.0-beta.8 to
0.5.0-beta.9" alone, then built and probed in Chrome as
[MIG-B9-03](MIG-B9-03-press-craftor.md) did, and compared with its results
and with MIG-B9-14's ("On the superset pipeline"). The owner's repository was
only read.

Run on 2026-11-23, 18:19–18:30 UTC. Environment: macOS 27.0 (Darwin 27.0.0),
MacBookPro18,3, Node v20.19.0, npm 11.21.1, Google Chrome 158.0.8127.37
driven by playwright-core from `fixtures/mig02-nextjs-cssmodules`, Next.js
16.3.5 (`next build --webpack`, the project's own script). UXDSL at `3e1e269`
(`feat/b9-91-gate`: `feat/beta9` at `6cdadaf`, the owner decisions of
2026-11-23 and this story's code). Press Craftor at `2b92723`
(`2b9272350e3e007dd9a1a73c9320931133e7e52e`), 7 commits after MIG-B9-03's
`dbec897`; `git diff --stat dbec897 HEAD -- '*.uxdsl' 'uxdsl.*'
postcss.config.mjs postcss-uxdsl-source.cjs package.json .npmrc` is empty.
`<scratch>` is the session's scratch directory
(`/private/tmp/claude-501/…/scratchpad/b9-91`); nothing was written in the
UXDSL repository or in `story-radar`, and no `.env*` file was read, copied or
listed.

## The tarball

`npm pack` in `packages/uxdsl` at `3e1e269` (after `npm run build`):
`uxdsl-0.5.0-beta.9.tgz`, 306,956 bytes packed, 1,131,509 unpacked, 90
files, shasum `c4a25fefe7e372c0c2180382828031757b1eb67f`, sha256
`370532d24421a1abe09fdad35eaef1ab79b0788e5540fe8b3b0fe277444a474d`, written
to `<scratch>/pc-tarball`. The record's figures come from the gate's own pack
of the final tree. After this run, the release review's fixes changed the
package README and the message of a theme file under a former name; the
final tarball differs from this one in those two places only. This run was
not repeated on it: neither is on the path it exercises, and the record's
steps it followed are the same apart from the sentences the review added
(of those, only the `@theme` step touches this project, in its own test, below).

## Steps, with exit codes

| # | Step (record section "From 0.5.0-beta.8 to 0.5.0-beta.9") | Command | Exit |
| --- | --- | --- | --- |
| 0 | `story-radar` before | `git -C …/story-radar status --porcelain` → `?? 4f91cb9c-7c15-4f6d-bf64-0b3a71a8213b.png`; HEAD `2b92723` | 0 |
| 1 | The clone | `git clone --quiet …/story-radar <scratch>/press-craftor` (HEAD `2b92723`, clean) | 0 |
| 2 | The beta.8 baseline | `npm ci --ignore-scripts --no-audit --no-fund` (586 packages, 13 s); `npm run uxdsl:build` (4 s): the seven files at MIG-B9-03 §2's "before" sizes exactly | 0; 0 |
| 3 | Node 20.19 or later | `node --version` → `v20.19.0` | 0 |
| 4 | Step 1: replace the packages | `npm uninstall postcss-uxdsl uxdsl-cli uxdsl-core vite-plugin-uxdsl uxdsl-webpack-loader` ("removed 21 packages"); `npm i -D <scratch>/pc-tarball/uxdsl-0.5.0-beta.9.tgz` ("added 13 packages, and changed 1 package") | 0; 0 |
| 4a | check | `npx uxdsl --version` → `Error: Cannot find module 'postcss'` (the project's `.npmrc` sets `legacy-peer-deps=true`, so npm installs no peer) | **1**, as the step's third command says |
| 4b | Step 1's third command | `npm i -D postcss` ("added 1 package, and changed 1 package in 761ms"; `postcss ^8.5.33`); `npx uxdsl --version` → `uxdsl 0.5.0-beta.9` | 0; 0 |
| 5 | Step 2: the theme file | `uxdsl.theme.config.cjs` → `uxdsl.theme.cjs` exporting the theme itself, `references` into `uxdsl.config.cjs`, `postcss.config.mjs` importing the two (MIG-B9-03 §8's hunks for these four files, `git apply --include`); the seven `includeTheme` keys of `uxdsl.config.cjs`'s `builds` removed | 0 |
| 6 | Step 3: the codemod, preview | `node node_modules/uxdsl/scripts/codemod-canonical-grammar.js --theme uxdsl.theme.cjs src uxdsl.config.js`: "15 file(s) would change (15 with findings)" (the seven `.uxdsl` sources, the seven generated `.css` files, and `uxdsl.config.js`, "palette()/color() dashed -> dotted ×98") | 0 |
| 7 | Step 3: `--write` | the same with `--write`: "15 file(s) rewritten (15 with findings)." | 0 |
| 7a | one run is enough | the preview again: "0 file(s) would change (0 with findings)." The seven `.uxdsl` files and `uxdsl.config.js` are byte-identical (`cmp`) to MIG-B9-03 §8's patch applied to a copy of the clone | 0 |
| 8 | Step 4: the marker | `@uxdsl theme;` after the leading comments of `src/app/uxdsl.uxdsl`, the global stylesheet; `includeTheme: false` removed from `postcss.config.mjs` (the project's plugin entry becomes the `'uxdsl/postcss': {}` form with its `theme` and `references`) | — |
| 9 | Step 5: scripts | `"uxdsl:watch": "uxdsl build --watch"` | — |
| 10 | Step 6: imports | `postcss-uxdsl-source.cjs`: `require("postcss-uxdsl")` → `require("uxdsl/postcss")`. No other import of a former name, no `ds-runtime` import and no per-token setter in the code (a grep over the tree without `node_modules`, `.next`, `.git` and `.env*` finds them only in comments and in the project's own docs) | — |
| 11 | Step 7: rebuild | `npm run uxdsl:build`, 2 s: seven `built` lines, no warning | 0 |
| 12 | `next build` | `npm run build`, 32 s: **`TypeError: plugin.Once is not a function`** at `postcss-uxdsl-source.cjs:47` in every stylesheet the project's PostCSS wrapper handles (finding 1) | **1** |
| 12a | Step 6's wrapper item | the wrapper takes `uxdsl/postcss`'s listeners from `plugin.prepare(result)` and forwards both `Once` and `OnceExit` (the hunk below) | — |
| 12b | `next build` again | `rm -rf .next && npm run build`, 60 s: the seven files "unchanged", "✓ Compiled successfully in 25.9s", 70 static pages | 0 |
| 13 | Chrome | `<scratch>/bin/pc-probe.js`: negative control, then `next start` on a free `127.0.0.1` port (61864) with only `PATH`, `HOME`, `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1` and `TMPDIR` in its environment, `/login` and `/help` at 390 and 1280 px in light and dark; the server's process group is stopped at the end (no `next start` left) | 0 |
| 14 | `story-radar` after | `git -C …/story-radar status --porcelain` → `?? 4f91cb9c-7c15-4f6d-bf64-0b3a71a8213b.png`; HEAD `2b9272350e3e007dd9a1a73c9320931133e7e52e`: identical to step 0 | 0 |
| 15 | cleanup | the clone, the "before" copies, and a `press-craftor-fontconfig` entry found in the `TMPDIR` of the builds and the probe afterwards, removed | 0 |

npm 11.21.1 printed, on every install, `npm warn install-scripts … not yet
covered by allowScripts` for the project's own packages and for
`@parcel/watcher@2.6.0`, an optional dependency of `sass`; its prebuilt
`@parcel/watcher-darwin-arm64` is installed, and nothing failed.

## Sizes

`wc -c` of the seven files `uxdsl build` wrote at step 11, with MIG-B9-03's
and MIG-B9-14's columns (MIG-B9-03 §2, "On the superset pipeline", "Sizes"):

| File | Before (beta.8) | After (MIG-B9-03) | Superset (MIG-B9-14) | Release candidate |
| --- | --- | --- | --- | --- |
| `src/app/uxdsl.css` | 368,181 B | 89,566 B | 89,582 B | 89,582 B |
| `src/app/radar-dashboard.generated.module.css` | 463,716 B | 497,778 B | 506,158 B | 506,158 B |
| `src/app/creative-draft-workspace.generated.module.css` | 276,300 B | 293,052 B | 294,878 B | 294,878 B |
| `src/app/draft-2-canvas.generated.module.css` | 60,710 B | 62,247 B | 65,112 B | 65,112 B |
| `src/app/editorial-profile-panel.generated.module.css` | 10,460 B | 10,796 B | 10,915 B | 10,915 B |
| `src/app/topic-configuration-panel.generated.module.css` | 41,507 B | 43,633 B | 44,495 B | 44,495 B |
| `src/app/ui/primitives.generated.module.css` | 35,764 B | 39,982 B | 41,169 B | 41,169 B |

Every file has the superset's size. The superset's files were not kept
(macOS's cleaning of the scratch directory emptied them), so the comparison
is by size, not byte for byte. The `wc -c` sizes, and the global chunk's
size below, were read at run time and not saved; the saved
`uxdsl build` log prints the CLI's own counts, which are characters (89576,
506122, 294862, 65109, …: the files' multi-byte characters account for the
difference, as MIG-B9-03 explained). The release review of 2026-11-23 moved
a fresh clone by the record's steps and read the same seven sizes with
`wc -c`. `:root` appears only in `uxdsl.css` (14
occurrences), none in the six modules. In `.next/static/css`: seven chunks,
`:root` only in the global one (11 blocks, 124,806 bytes, the size MIG-B9-14
recorded for both of its builds).

## Rendering

Negative control first: a page with `.x { color: var(--uxdsl__nope); }` and
a `console.error` reported `console-error injected` and `unresolved-var
--uxdsl__nope (read by color in ".x") on div.x`.

| Route | light 390 | light 1280 | dark 390 | dark 1280 |
| --- | --- | --- | --- | --- |
| `/login` (`ui/primitives`, `uxdsl.css`) | 200, no problem | 200, no problem | 200, no problem | 200, no problem |
| `/help` (`creative-draft-workspace`) | 200, 4 | 200, 4 | 200, 4 | 200, 4 |

The four problems on `/help` are, in every case, the four `emphasis`
typography variables MIG-B9-03 recorded as its finding 4, the project's
`inherit` declarations: `--uxdsl__typography__emphasis-font-family`,
`-font-size`, `-line-height` and `-letter-spacing`, read by
`.helpContent a`. No console error, page error, failed request, response of
400 or more, or UXDSL warning; the server logged no error.

**Not run**, never counted as a pass: the two routes that need data, `/`
(`radar-dashboard`) and the story and Draft 2 pages
(`creative-draft-workspace` with data), which need `DATABASE_URL` and a
sign-in; MIG-B9-14's static proxy and computed-style comparison; interaction
states; `uxdsl build --watch` (the script was changed, not run); the
project's own tests (`npm test`, whose `src/design/uxdsl-postcss.test.ts`
still asserts the `@theme` block MIG-B9-03's patch removes); a visual
review; Vercel.

## Finding 1: a PostCSS plugin that calls `uxdsl/postcss`'s `Once` itself

`uxdsl/postcss` returns `{ postcssPlugin, prepare }` since MIG-B9-27
(`d049f2f`): `prepare(result)` creates the per-run state and returns its
`Once` and `OnceExit` listeners. On `0.5.0-beta.8` and on MIG-B9-14's
superset it returned `{ postcssPlugin, Once }`. Press Craftor's
`postcss-uxdsl-source.cjs` wraps the plugin to skip the CSS Modules the CLI
already compiled, and called `plugin.Once(root, helpers)` itself, so
`next build` failed on every stylesheet it handles. MIG-B9-27's CHANGELOG
entry says the plugin "still checks the stylesheet for Sass in its `Once`
listener" and does not say that the plugin object no longer has a `Once`
property. A plugin listed in `postcss.config.js` is unaffected: PostCSS
calls `prepare` itself.

The fix in a wrapper, applied in the clone (step 12a), and now in the
record's step 7 ("Imports") and in MIG-B9-91's CHANGELOG subsection:

```js
module.exports = function sourceOnlyUxdsl(options) {
  const plugin = uxdsl(options);
  const compiled = (root) => root.source?.input.file?.endsWith(".generated.module.css");
  return {
    postcssPlugin: "press-craftor-uxdsl-source",
    prepare(result) {
      const listeners = plugin.prepare(result);
      return {
        Once(root, helpers) {
          // … the project's own work, then:
          if (!compiled(root)) return listeners.Once(root, helpers);
        },
        OnceExit(root, helpers) {
          if (!compiled(root)) return listeners.OnceExit?.(root, helpers);
        },
      };
    },
  };
};
```

Forwarding `OnceExit` matters: a Sass construct the plugin holds in `Once` is
judged there, and an unknown `(--name)` in an `@media` prelude too. Decided
under the owner's standing instruction (MIG-B9-91 §15, "Delivery of
2026-11-23"): documented in `0.5.0-beta.9`, with no change to the plugin;
a compatibility `Once` on the plugin object is offered to `0.5.0-beta.10`.
The owner's Press Craftor patch (decision D17) needs this hunk besides
MIG-B9-03 §8's.

## What differs from MIG-B9-03's patch

The hand-written changes beyond MIG-B9-03 §8's patch, all from the record's
steps: the seven `includeTheme` keys removed from `uxdsl.config.cjs` and the
one in `postcss.config.mjs`, `@uxdsl theme;` in `src/app/uxdsl.uxdsl`
(MIG-B9-20), and the wrapper's `prepare` (finding 1). The codemod's
rewrites equal the patch's (step 7a). Not taken from the patch, since no
step of the record says so: the removal of the wrapper's `:root` stripping
for the generated modules (MIG-B9-03's C4; harmless, the CLI writes no
`:root` there) and of the two project tests that assert it.
