#!/usr/bin/env node
'use strict';

// MIG-B7-17 (FEAT-009), phase C: builds public/runtime-sandbox/, the iframe the /docs/runtime
// page runs its state-changing runtime calls in (see src/runtime-sandbox/sandbox-entry.ts
// for why they need their own document and realm).
//
//   1. runtime-sandbox/sandbox.uxdsl is compiled by uxdsl-core's compile() — the pipeline
//      `uxdsl build` uses — with the site's own default theme, so the sandbox is a real
//      compiled UXDSL project.
//   2. src/runtime-sandbox/sandbox-entry.ts is bundled with esbuild. Like next.config.js,
//      it resolves postcss-uxdsl/ds-runtime to the package's current source.
//   3. index.html inlines the CSS as a <style> and loads the bundle.
//
// Runs as part of `npm run uxdsl:build`, so `dev` and `build` always serve a fresh one.
// The output is generated and git-ignored.

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const PLAYGROUND = path.resolve(__dirname, '..');
const OUT = path.join(PLAYGROUND, 'public/runtime-sandbox');

function loadCore() {
  const cliRequire = require('node:module').createRequire(path.join(PLAYGROUND, '../uxdsl-cli/package.json'));
  return cliRequire('uxdsl-core');
}

async function main() {
  const { themes } = require(path.join(PLAYGROUND, 'themes.js'));
  const theme = themes.default;
  const { compile } = loadCore();
  const entry = path.join(PLAYGROUND, 'runtime-sandbox/sandbox.uxdsl');
  const { css, warnings } = await compile({ entry }, { theme });
  if (warnings.length) throw new Error(`runtime sandbox: the compiler warned:\n${warnings.map((w) => w.text).join('\n')}`);

  const bundle = await esbuild.build({
    entryPoints: [path.join(PLAYGROUND, 'src/runtime-sandbox/sandbox-entry.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2019',
    minify: true,
    write: false,
    alias: {
      'postcss-uxdsl/ds-runtime': path.resolve(PLAYGROUND, '../postcss-uxdsl/src/ds-runtime.ts'),
      'postcss-uxdsl/language': path.resolve(PLAYGROUND, '../postcss-uxdsl/src/language.ts'),
    },
    logLevel: 'silent',
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UXDSL runtime sandbox</title>
<style>
${css.replace(/<\/style/gi, '<\\/style')}
</style>
</head>
<body>
<main class="lab">
  <div class="lab-row">
    <div class="lab-swatch lab-swatch--palette">background: palette(primary.main)</div>
    <div class="lab-swatch lab-swatch--color">background: color(gray.300)</div>
  </div>
  <div class="lab-row">
    <div class="lab-box lab-box--space">padding: space(4)</div>
    <div class="lab-box lab-box--density">padding: density(4)</div>
  </div>
  <div class="lab-layout"><div>flex-direction:</div><div>xs(column) md(row)</div></div>
</main>
<script src="./sandbox.js"></script>
</body>
</html>
`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'sandbox.js'), bundle.outputFiles[0].text);
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`runtime sandbox: ${path.relative(PLAYGROUND, OUT)}/ (css ${css.length} bytes, js ${bundle.outputFiles[0].text.length} bytes)`);
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
