#!/usr/bin/env node
'use strict';

// Builds public/paradigm-frame/index.html, the page inside the home page's resizable frame.
//
// paradigm/frame.uxdsl (which imports paradigm/card.uxdsl, the example the home page shows)
// is compiled by uxdsl's compile() — the pipeline `uxdsl build` uses — with the site's
// default theme and the example's own theme excerpt (paradigm/theme.json) merged over it.
// The frame is an iframe, so its media queries follow the frame's width, not the window's:
// dragging the frame across a breakpoint is the theme's breakpoint, compiled.
//
// The page has no script. The home page reads the computed values out of it (it is the same
// origin) and mirrors the site's theme into it when the header switches theme or mode.
//
// Runs as part of `npm run uxdsl:build`. The output is generated and git-ignored.

const fs = require('node:fs');
const path = require('node:path');

const PLAYGROUND = path.resolve(__dirname, '..');
const OUT = path.join(PLAYGROUND, 'public/paradigm-frame');

async function main() {
  const { compile } = require('uxdsl');
  const { deepMergeTheme } = require('uxdsl/theme');
  const { themes } = require(path.join(PLAYGROUND, 'themes.js'));
  const theme = deepMergeTheme(themes.default, require(path.join(PLAYGROUND, 'paradigm/theme.json')));
  const entry = path.join(PLAYGROUND, 'paradigm/frame.uxdsl');
  const { css, warnings } = await compile({ entry }, { theme });
  if (warnings.length) throw new Error(`paradigm frame: the compiler warned:\n${warnings.map((w) => w.text).join('\n')}`);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>A card with no breakpoint in it</title>
<style>
${css.replace(/<\/style/gi, '<\\/style')}
</style>
</head>
<body>
<article class="card">
  <h2>No breakpoint in this card</h2>
  <p>The tinted band is <code>padding: density(4)</code>; the title is <code>@ds-typo(h2)</code>. Both step at the theme's breakpoints as you drag the frame.</p>
</article>
</body>
</html>
`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`paradigm frame: ${path.relative(PLAYGROUND, OUT)}/index.html (css ${css.length} bytes)`);
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
