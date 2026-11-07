'use strict';

// Chrome, two checks. (1) A controlled document: the installed package's
// generated theme and component CSS, computed styles at twelve boundary
// widths in light and dark. (2) The served page: the `next build` run.js has
// just made, started with `next start` on a free 127.0.0.1 port, where
// styles/panel.generated.module.css (built by the installed CLI from
// styles/panel.module.uxdsl) is imported by pages/index.js; Chrome reads its
// computed styles there, and the server is stopped whatever happens.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const { chromium } = require('playwright-core');
const installed = createRequire(path.resolve(__dirname, '../mig07-consumer/package.json'));
const postcss = installed('postcss');
const plugin = installed('uxdsl/postcss');
const { generateThemeCss } = installed('uxdsl/theme');
const sourceTheme = require('../mig07-consumer/theme.json');

const CHROME = process.env.UXDSL_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/** palette(primary.main) in mig07-consumer/theme.json, #2563eb. */
const PRIMARY = 'rgb(37, 99, 235)';

async function controlledDocument() {
  const theme = { ...sourceTheme, modes: { dark: { palette: { surface: { main: '#111111', contrast: '#eeeeee' } } } } };
  const css = (await postcss([plugin({ theme, includeTheme: false })]).process('.probe { @ds-surface(contained 2); border: border(2); }', { from: undefined })).css;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<style id="theme"></style><style id="components"></style><div class="probe">Theme probe</div>');
    await page.evaluate(({ themeCss, css }) => {
      document.querySelector('#theme').textContent = themeCss;
      document.querySelector('#components').textContent = css;
    }, { themeCss: generateThemeCss(theme), css });
    for (const mode of ['light', 'dark']) {
      await page.evaluate(mode => document.documentElement.setAttribute('data-theme', mode), mode);
      for (const width of [479, 480, 481, 767, 768, 769, 1023, 1024, 1025, 1279, 1280, 1281]) {
        await page.setViewportSize({ width, height: 500 });
        const actual = await page.locator('.probe').evaluate(el => {
          const s = getComputedStyle(el);
          return { padding: s.paddingTop, radius: s.borderTopLeftRadius, border: s.borderTopWidth, bg: s.backgroundColor };
        });
        assert.deepEqual(actual, {
          padding: `${width >= 1280 ? 16 : width >= 768 ? 12 : 8}px`,
          radius: `${width >= 1024 ? 12 : 8}px`,
          border: '4px', bg: mode === 'dark' ? 'rgb(17, 17, 17)' : 'rgb(255, 255, 255)',
        }, `${mode} @ ${width}`);
      }
    }
    // Failed generation must never replace the stylesheet already on screen.
    const before = await page.locator('#theme').textContent();
    assert.throws(() => generateThemeCss({ ...theme, surfaces: { contained: { bg: 'palette(missing)' } } }), /UXD_REFERENCE_MISSING/);
    assert.equal(await page.locator('#theme').textContent(), before);
    console.log('PASS: browser computed padding/radius/border/modes at 12 boundary widths; invalid generation preserves applied CSS.');
  } finally { await browser.close(); }
}

/** A port the system reports free on 127.0.0.1. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** The status of a GET, or 0 when nothing answers. */
function statusOf(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => { response.resume(); resolve(response.statusCode); });
    request.on('error', () => resolve(0));
    request.setTimeout(2000, () => { request.destroy(); resolve(0); });
  });
}

async function servedPage() {
  if (!fs.existsSync(path.join(__dirname, '.next', 'BUILD_ID'))) {
    throw new Error('no .next/BUILD_ID: run.js runs `next build` before this check');
  }
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  let output = '';
  // Its own process group, so stopping it stops every process it started.
  const server = spawn(process.execPath, [path.join(__dirname, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: __dirname,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  const exited = new Promise((resolve) => server.once('exit', resolve));
  let browser;
  try {
    const deadline = Date.now() + 30000;
    while ((await statusOf(url)) !== 200) {
      if (server.exitCode !== null) throw new Error(`next start exited ${server.exitCode}:\n${output}`);
      if (Date.now() > deadline) throw new Error(`next start did not answer 200 at ${url} within 30 s:\n${output}`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ executablePath: CHROME, headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'load' });
    const missing = await page.evaluate(() => ['cli-panel', 'cli-panel-title', 'cli-panel-body'].filter((id) => !document.getElementById(id)));
    assert.deepEqual(missing, [], 'the served page renders the CLI-built panel');
    const actual = await page.evaluate(() => {
      const computed = (id) => getComputedStyle(document.getElementById(id));
      return {
        padding: computed('cli-panel').paddingTop,
        radius: computed('cli-panel').borderTopLeftRadius,
        border: computed('cli-panel').borderTopColor,
        titleColor: computed('cli-panel-title').color,
        titleMarginBottom: computed('cli-panel-title').marginBottom,
        titleClass: document.getElementById('cli-panel-title').className,
        bodyColor: computed('cli-panel-body').color,
      };
    });
    // $gap: math.div(48px, 3) = 16px, $radius: $gap * 0.5 = 8px, the title's
    // bottom margin math.div($gap, 2) = 8px, and palette(primary.main) from
    // the theme styles/theme.css defines.
    assert.deepEqual(
      { padding: actual.padding, radius: actual.radius, border: actual.border, titleColor: actual.titleColor, titleMarginBottom: actual.titleMarginBottom },
      { padding: '16px', radius: '8px', border: PRIMARY, titleColor: PRIMARY, titleMarginBottom: '8px' },
      'the CLI-built module on the served page'
    );
    // Negative controls: css-loader hashed the module's class names, and the
    // title's color is the module's, not one the panel passes down.
    assert.ok(actual.titleClass.includes('panel__title') && actual.titleClass !== 'panel__title', `hashed class name: ${actual.titleClass}`);
    assert.notEqual(actual.bodyColor, PRIMARY, '#cli-panel-body sets no color, so it must not be the title\'s');
    console.log(`PASS: the served next build renders the CLI-built styles/panel.generated.module.css: padding 16px, radius 8px, border and title ${PRIMARY}, title margin-bottom 8px, class ${actual.titleClass}, body ${actual.bodyColor}.`);
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null && server.signalCode === null) {
      const stopped = setTimeout(() => { try { process.kill(-server.pid, 'SIGKILL'); } catch { /* already gone */ } }, 5000);
      try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already gone */ }
      await exited;
      clearTimeout(stopped);
    }
  }
}

async function main() {
  await controlledDocument();
  await servedPage();
}

main().catch(error => { console.error(error); process.exitCode = 1; });
