# MIG-02 Next.js CSS Modules build fixture

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

First run installs `next`/`react`/`react-dom` locally (not from the
monorepo — this fixture is a real, if minimal, Next.js app). `postcss-uxdsl`
itself is required directly from `../../packages/postcss-uxdsl` (its
current built `dist/`, not installed as a dependency) — this fixture is
about the Next.js/css-loader build behavior, not packaging fidelity, which
`fixtures/mig07-consumer/` already covers separately and more rigorously
(a real `npm pack` tarball install).

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
3. **Negative control**: copies the *theme* output (which does contain
   `:root`) to a `.module.css` path and imports it from a throwaway page.
   `next build` must now **fail** with css-loader's real "is not pure"
   error. Without this, check #2 passing wouldn't prove much — a
   misconfigured or bypassed loader would let anything through silently.
4. Cleans up the throwaway negative-control page and style file, and the
   `.next` build cache, so the directory is back in its normal,
   always-succeeding state for the next run.

## What this does not verify

- **Real browser rendering** of the built pages — this only proves the
  *build* step (the webpack/css-loader compilation itself) succeeds or
  fails as expected, not that the pages render correctly once served.
- **The App Router (`app/`) specifically** — this fixture uses the Pages
  Router (`pages/`) for simplicity. Next.js's CSS Modules loader
  (`loaders/modules.js`) is shared by both routers, so the mechanism under
  test is identical either way, but the App Router's own build path was
  not separately exercised.

See [`docs/features/FEAT-002-beta-migration-hardening.md`](../../docs/features/FEAT-002-beta-migration-hardening.md)
(MIG-02) for how this fits into the rest of the migration-hardening work.
