#!/usr/bin/env node
'use strict';

// MIG-B7-17 (FEAT-009), phase B: a computed-style snapshot of the playground, in real
// Chrome, so a refactor of how the playground is styled can be proven not to have
// changed how it looks. Phase E reuses the same harness for its browser walk.
//
// It serves the production build (`next start`), visits every route at a set of
// viewport widths, and records for every element in <body> a compact string of the
// computed properties that carry the visual result plus its rounded box. Two
// snapshots of two builds are then compared by compare.js.
//
// Determinism is the whole difficulty, so it is engineered rather than hoped for:
// animations and transitions are frozen, Math.random is seeded, Date.now is fixed,
// requests to the network are answered locally, and compare.js can subtract the
// noise found by snapshotting the SAME build twice.
//
//   node fixtures/playground-browser/snapshot.js --out /tmp/before.json.gz [--widths 390,768,1280] [--routes /,/buttons] [--build]

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '../..');
const PLAYGROUND = path.join(ROOT, 'packages/playground-nextjs');
const { chromium } = createRequire(path.join(ROOT, 'fixtures/mig02-nextjs-cssmodules/package.json'))('playwright-core');

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? fallback : process.argv[i + 1]; };
const flag = (name) => process.argv.includes(`--${name}`);

// Widths on both sides of the configured thresholds (480, 768, 1024, 1280).
const WIDTHS = arg('widths', '390,479,480,767,768,1023,1024,1279,1280,1440').split(',').map(Number);
const PORT = Number(arg('port', 3917));

/** Every route the app serves, from its own file tree (no dynamic segments, no API). */
function discoverRoutes() {
  const appDir = path.join(PLAYGROUND, 'src/app');
  const routes = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name === 'api' || entry.name.startsWith('[') || entry.name.startsWith('_')) continue; walk(full); }
      else if (/^page\.(tsx|mdx|jsx|js)$/.test(entry.name)) routes.push(`/${path.relative(appDir, dir).split(path.sep).join('/')}`.replace(/\/$/, '') || '/');
    }
  };
  walk(appDir);
  return [...new Set(routes)].sort();
}

const PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'zIndex', 'overflowX', 'overflowY', 'opacity', 'transform', 'filter',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
  'backgroundColor', 'backgroundImage', 'color', 'boxShadow', 'textShadow',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign', 'textTransform', 'textDecorationLine', 'whiteSpace',
  'flexDirection', 'flexWrap', 'flexGrow', 'flexShrink', 'justifyContent', 'alignItems', 'alignSelf', 'rowGap', 'columnGap',
  'gridTemplateColumns', 'gridTemplateRows', 'gridColumnStart', 'gridColumnEnd', 'listStyleType', 'cursor', 'visibility', 'pointerEvents',
];

/** Runs in the page. One entry per element in <body>: `path` -> "tag|rect|props". */
function collect(props) {
  const out = {};
  const visit = (el, key) => {
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'template'].includes(tag)) return;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    out[key] = `${tag}|${Math.round(r.x)},${Math.round(r.y + window.scrollY)},${Math.round(r.width)},${Math.round(r.height)}|${props.map((p) => cs[p]).join('|')}`;
    const counters = {};
    for (const child of el.children) {
      const t = child.tagName.toLowerCase();
      counters[t] = (counters[t] || 0) + 1;
      visit(child, `${key}>${t}:${counters[t]}`);
    }
  };
  const counters = {};
  for (const child of document.body.children) {
    const t = child.tagName.toLowerCase();
    counters[t] = (counters[t] || 0) + 1;
    visit(child, `body>${t}:${counters[t]}`);
  }
  return out;
}

async function waitForServer(port, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ok = await new Promise((resolve) => http.get({ port, path: '/robots.txt', timeout: 1500 }, (res) => { res.resume(); resolve(res.statusCode < 500); }).on('error', () => resolve(false)));
    if (ok) return;
    if (Date.now() > deadline) throw new Error(`next start did not answer on ${port} within ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 400));
  }
}

async function main() {
  const out = arg('out');
  if (!out) throw new Error('--out <file.json.gz> is required');
  if (flag('build')) {
    console.log('Building the playground (uxdsl build + next build)...');
    execFileSync('npm', ['run', 'uxdsl:build'], { cwd: PLAYGROUND, stdio: 'inherit' });
    execFileSync('npx', ['next', 'build'], { cwd: PLAYGROUND, stdio: 'inherit' });
  }
  if (!fs.existsSync(path.join(PLAYGROUND, '.next/BUILD_ID'))) throw new Error('no production build: run with --build');

  const routes = arg('routes') ? arg('routes').split(',') : discoverRoutes();
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { cwd: PLAYGROUND, stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: process.env.UXDSL_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const snapshot = { widths: WIDTHS, props: PROPS, routes: {} };
  try {
    await waitForServer(PORT);
    const context = await browser.newContext({ deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      let seed = 123456789;
      Math.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
      const fixed = 1735689600000;
      Date.now = () => fixed;
      // requestAnimationFrame becomes manual: how many frames a page had rendered when
      // it was measured was the one thing that still varied (the home page's animated
      // blobs). The harness now steps a fixed number of frames, at fixed timestamps.
      const queue = [];
      let handle = 0;
      window.requestAnimationFrame = (callback) => { queue.push([++handle, callback]); return handle; };
      window.cancelAnimationFrame = (h) => { const i = queue.findIndex((entry) => entry[0] === h); if (i >= 0) queue.splice(i, 1); };
      window.__stepFrames = (count) => { for (let k = 1; k <= count; k++) queue.splice(0).forEach(([, callback]) => callback(16.667 * k)); };
    });
    // Nothing leaves the machine: fonts and any other external request are answered locally.
    await context.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (route) => {
      route.request().resourceType() === 'stylesheet' ? route.fulfill({ status: 200, contentType: 'text/css', body: '' }) : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
    for (const route of routes) {
      snapshot.routes[route] = {};
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'load' });
        await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
        await page.evaluate(() => document.fonts && document.fonts.ready);
        await page.waitForTimeout(350);
        await page.evaluate(() => window.__stepFrames(8));
        snapshot.routes[route][width] = await page.evaluate(collect, PROPS);
      }
      process.stdout.write(`  ${route}\n`);
    }
    snapshot.pageErrors = [...new Set(errors)];
  } finally { await browser.close(); server.kill('SIGTERM'); }
  fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(snapshot)));
  const elements = Object.values(snapshot.routes).reduce((n, byWidth) => n + Object.values(byWidth).reduce((m, els) => m + Object.keys(els).length, 0), 0);
  console.log(`snapshot: ${routes.length} routes × ${WIDTHS.length} widths, ${elements} element records → ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
  if (snapshot.pageErrors.length) console.log(`page errors seen (${snapshot.pageErrors.length}): ${snapshot.pageErrors.slice(0, 3).join(' | ')}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
