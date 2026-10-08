#!/usr/bin/env node
'use strict';

/**
 * Stability phase 4 (decision DE-9): UXDSL in Next.js with PostCSS only — no
 * CLI, no generated stylesheet. The project's postcss.config.js is Next's
 * default plugins plus `'uxdsl/postcss': { includeTheme: false }`; the one
 * global stylesheet starts with `@uxdsl theme;`; CSS Modules just use tokens.
 *
 * The package is the tarball ../mig07-consumer/run.js packs and installs (this
 * script runs it first; `--installed` reuses the install run.js just made). A real `next build` (static export, the
 * Pages Router's CSS Modules pipeline in css-loader's pure mode) is then loaded
 * in real Chrome, and computed styles are read at two breakpoints:
 *
 *   positive   the module's tokens resolve against the theme the marker emits,
 *              the project's uxdsl.theme.json included (discovered by the
 *              plugin from Next's working directory);
 *   control 1  the marker moved into the .module.css: the build fails with
 *              css-loader's "is not pure" — a theme in a module is rejected;
 *   control 2  the marker removed: the page builds, and the tokens resolve to
 *              nothing — the marker is what emits the theme.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');

const APP = path.join(__dirname, 'postcss-only');
const INSTALLED = path.resolve(__dirname, '../mig07-consumer/node_modules/uxdsl');
const NEXT = path.join(__dirname, 'node_modules/next/dist/bin/next');
const CHROME = process.env.UXDSL_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const GLOBALS = path.join(APP, 'styles/globals.css');
const MODULE = path.join(APP, 'styles/card.module.css');

const checks = [];
function check(label, condition) {
  checks.push({ label, ok: !!condition });
  console.log(`  ${condition ? 'ok ' : 'FAIL'} - ${label}`);
}

function build() {
  fs.rmSync(path.join(APP, '.next'), { recursive: true, force: true });
  fs.rmSync(path.join(APP, 'out'), { recursive: true, force: true });
  try {
    execFileSync(process.execPath, [NEXT, 'build'], { cwd: APP, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
    return { ok: true, output: '' };
  } catch (error) {
    return { ok: false, output: `${error.stdout || ''}${error.stderr || ''}` };
  }
}

/** Serves out/ and reports the card's computed style at each width. */
async function measure(browser, widths) {
  const root = path.join(APP, 'out');
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(root, url === '/' ? 'index.html' : url);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; res.end(); return; }
    res.setHeader('content-type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const out = {};
    for (const width of widths) {
      await page.setViewportSize({ width, height: 400 });
      out[width] = await page.locator('#card').evaluate((el) => {
        const s = getComputedStyle(el);
        return { padding: s.paddingTop, background: s.backgroundColor, color: s.color, radius: s.borderTopLeftRadius, rootVar: getComputedStyle(document.documentElement).getPropertyValue('--uxdsl__palette__primary-main').trim() };
      });
    }
    return out;
  } finally {
    await page.close();
    server.close();
  }
}

async function main() {
  // A fresh pack and install every run, so this never tests a stale tarball.
  if (!process.argv.includes('--installed')) {
    execFileSync(process.execPath, [path.resolve(__dirname, '../mig07-consumer/run.js')], { stdio: 'inherit' });
  }
  // The project resolves `uxdsl/postcss` the way Next does — from its own
  // node_modules — and that is the installed tarball, nothing from the repo.
  const nm = path.join(APP, 'node_modules');
  fs.rmSync(nm, { recursive: true, force: true });
  fs.mkdirSync(nm);
  fs.symlinkSync(INSTALLED, path.join(nm, 'uxdsl'), 'dir');

  const globals = fs.readFileSync(GLOBALS, 'utf8');
  const cardModule = fs.readFileSync(MODULE, 'utf8');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    console.log('Building (positive): `@uxdsl theme;` in globals.css, tokens in a CSS Module, no CLI...');
    const positive = build();
    check('next build succeeds with PostCSS only (pure-mode CSS Modules, no :root in a module)', positive.ok);
    if (!positive.ok) console.log(positive.output);
    if (positive.ok) {
      const styles = await measure(browser, [500, 900]);
      // Next minifies the value (#0055aa is written #05a), so the color is
      // compared as Chrome computes it.
      check('the theme reached the page: :root defines --uxdsl__palette__primary-main', /^#(0055aa|05a)$/i.test(styles[500].rootVar));
      check('the module\'s palette() token resolves to the project\'s uxdsl.theme.json primary, discovered by the plugin', styles[500].background === 'rgb(0, 85, 170)');
      check('the module\'s responsive padding steps at the theme\'s md breakpoint (4px below, 16px from 768px)', styles[500].padding === '4px' && styles[900].padding === '16px');
      check('the module\'s radius() token resolves', styles[500].radius !== '0px');
    }

    console.log('\nBuilding (control 1): the marker moved into the CSS Module...');
    fs.writeFileSync(GLOBALS, globals.replace('@uxdsl theme;\n', ''));
    fs.writeFileSync(MODULE, `@uxdsl theme;\n${cardModule}`);
    const inModule = build();
    check('css-loader rejects a theme emitted into a .module.css ("is not pure")', !inModule.ok && /is not pure/.test(inModule.output));

    console.log('\nBuilding (control 2): no marker anywhere...');
    fs.writeFileSync(MODULE, cardModule);
    const none = build();
    check('without the marker the page still builds', none.ok);
    if (none.ok) {
      const styles = await measure(browser, [500]);
      check('…and no theme reaches it: the token is undefined and the background transparent', styles[500].rootVar === '' && styles[500].background === 'rgba(0, 0, 0, 0)');
    }
  } finally {
    fs.writeFileSync(GLOBALS, globals);
    fs.writeFileSync(MODULE, cardModule);
    await browser.close();
    for (const dir of ['.next', 'out', 'node_modules']) fs.rmSync(path.join(APP, dir), { recursive: true, force: true });
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${failed.length ? 'FAIL' : 'PASS'}: ${checks.length - failed.length}/${checks.length} checks — UXDSL through PostCSS only in Next.js, in Chrome.`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
