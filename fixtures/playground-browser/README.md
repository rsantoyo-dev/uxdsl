# playground-browser

MIG-B7-17 (FEAT-009). A computed-style snapshot of the playground in real Chrome, to prove
that a change to *how* the playground is styled did not change *how it looks*.

```sh
# 1. snapshot the build you are starting from
node fixtures/playground-browser/snapshot.js --out /tmp/before.json.gz --build
# 2. change the source, then snapshot again
node fixtures/playground-browser/snapshot.js --out /tmp/after.json.gz --build
# 3. compare (exit 1 when anything differs)
node fixtures/playground-browser/compare.js /tmp/before.json.gz /tmp/after.json.gz
```

It builds and serves the production site (`next start`), visits every route at widths on
both sides of each configured breakpoint (390, 479, 480, 767, 768, 1023, 1024, 1279, 1280,
1440), and records for every element in `<body>` its box and the computed properties that
carry the visual result. `compare.js` reports which properties changed, on which routes and
at which widths.

Options: `--widths 390,768`, `--routes /,/colors`, `--port` (snapshot.js); `--noise <another
snapshot of the *before* build>` (subtract what an unchanged build already differs by) and
`--max <n>` (how many differences to print) (compare.js). A comparison covers the routes and
widths both snapshots share.

## What makes it trustworthy

- **Deterministic.** Animations and transitions are frozen, `Math.random` is seeded,
  `Date.now` is fixed, requests to the network are answered locally, and the requestAnimationFrame
  loop is stepped by hand. Two snapshots of the same build are identical (0 differences over
  193,930 element records).
- **It can fail.** Changing one breakpoint in one component (`md` → `lg`) made it report 3,146
  property differences, on exactly the routes and widths where that component renders between
  the two thresholds.

## What it does not prove

It compares computed styles and boxes, not pixels: a change that leaves every recorded
property equal but paints differently (a canvas, an image replaced behind the same URL)
is outside it. It runs Chrome only, in the light theme, without hover
or focus states, and does not open the theme editor — that is the browser walk of phase E.
Nothing here replaces looking at the page.

It needs `playwright-core`, which it takes from `fixtures/mig02-nextjs-cssmodules`
(`npm install` there), and Google Chrome at its macOS default path or at `UXDSL_CHROME_PATH`.
