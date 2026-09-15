# MIG-02 Next.js CSS Modules build fixture

Current integrated command: `npm run verify:cssmodules-build` from the root.
It builds and installs MIG-07's tarball, uses that installation for the
Next.js positive/negative controls, then checks Chrome computed styles at
twelve boundary widths in light/dark. Set `UXDSL_CHROME_PATH` if Chrome is
not installed at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

Proves the 5-entry guide (`includeTheme: true` theme entry + four
`includeTheme: false` CSS-Module panels) compiles in a **real Next.js
production build**, under css-loader's actual strict/pure CSS Modules
mode — not a hand-rolled webpack config that approximates it.

Next.js's own webpack config
(`next/dist/build/webpack/config/blocks/css/loaders/modules.js`) sets
`modules: { mode: "pure" }` unconditionally for every `.module.css` file.
That mode is what rejects a selector with no local class or id — a bare
`:root` included — with `Selector "..." is not pure (pure selectors must
contain at least one local class or id)`. Running `next build` exercises
that exact code path; no browser is needed (`next build` is a Node-only
static/SSR compile step).

## Run it

```bash
node run.js         # from this directory
# or
npm run verify
```

First run installs the fixture dependencies locally. Every run builds and
packs `postcss-uxdsl`, installs it through `fixtures/mig07-consumer/`, then
compiles using that installed package. No compiler source is imported from
the monorepo by this fixture.

Each run:

1. **Compile** (`compile.js`): builds the same 5 entries
   `fixtures/mig07-consumer/entries/` defines — `theme.uxdsl`
   (`includeTheme: true`) into `styles/theme.css` (plain global CSS), and
   the four panels (`includeTheme: false`) into `styles/panel-*.module.css`.
2. **Positive control**: `next build` with `styles/theme.css` imported
   globally from `pages/_app.js` and all four `.module.css` files imported
   (and their classes actually referenced in JSX, so nothing gets
   tree-shaken away unused) from `pages/index.js`. Must succeed — the
   panels never contain `:root` (MIG-01/MIG-02 already guarantee that),
   so there is nothing for pure mode to reject.
3. **Browser verification**: Chrome checks padding, radius, border and modes
   at twelve boundary widths using the installed package's generated CSS.
4. **Negative control**: copies the *theme* output (which does contain
   `:root`) to a `.module.css` path and imports it from a throwaway page.
   `next build` must now **fail** with css-loader's real "is not pure"
   error. Without this, check #2 passing wouldn't prove much — a
   misconfigured or bypassed loader would let anything through silently.
5. Cleans up the throwaway negative-control page and style file, and the
   `.next` build cache, so the directory is back in its normal,
   always-succeeding state for the next run.

## What this does not verify

- **Visual review of all built pages** — computed-style tests run in a
  controlled document with the package CSS, not a screenshot audit.
- **The App Router (`app/`) specifically** — this fixture uses the Pages
  Router (`pages/`) for simplicity. Next.js's CSS Modules loader
  (`loaders/modules.js`) is shared by both routers, so the mechanism under
  test is identical either way, but the App Router's own build path was
  not separately exercised.

See [`docs/features/FEAT-002-beta-migration-hardening.md`](../../docs/features/FEAT-002-beta-migration-hardening.md)
(MIG-02) for how this fits into the rest of the migration-hardening work.
