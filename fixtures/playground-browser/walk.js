#!/usr/bin/env node
'use strict';

// MIG-B7-17 (FEAT-009), phase E: the playground driven in real Chrome, route by route.
//
// Closes beta.6's limit 6 ("the playground app itself was not driven in a browser"). It
// serves the production build (`next start`) and, for every route the app has (read from
// its own file tree, so a new page is walked without being listed), in the light and the
// dark scheme, at every width on both sides of each configured breakpoint:
//
//   - no console error and no uncaught exception;
//   - no UXDSL warning on the console;
//   - no unresolved var(): every custom property a matching rule reads, without a fallback,
//     resolves on the elements that rule applies to (computed style, not source text);
//   - keyboard: Tab through the page; every element that takes focus shows a visible change
//     (outline, box-shadow, border or background differ from the same element unfocused);
//   - /docs/accessibility: the report the page renders is the one checkThemeContrast gives in
//     Node for the same theme — for the default theme and after switching to another one.
//
// Then, unless --no-negative-control, it proves each check can fail: it injects an undefined
// var(), a console.error, a focus style that removes the indicator, and a wrong theme for the
// contrast comparison, one at a time, and requires each to be reported.
//
//   node fixtures/playground-browser/walk.js [--build] [--routes /,/docs/tooling] [--widths 390,768] [--no-negative-control]
//
// Exit 1 when anything fails. Needs playwright-core (fixtures/mig02-nextjs-cssmodules) and
// Chrome (macOS default path or UXDSL_CHROME_PATH).

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '../..');
const PLAYGROUND = path.join(ROOT, 'packages/playground-nextjs');
const { chromium } = createRequire(path.join(ROOT, 'fixtures/mig02-nextjs-cssmodules/package.json'))('playwright-core');

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? fallback : process.argv[i + 1]; };
const flag = (name) => process.argv.includes(`--${name}`);

const WIDTHS = arg('widths', '390,479,480,767,768,1023,1024,1279,1280,1440').split(',').map(Number);
const SCHEMES = arg('schemes', 'light,dark').split(',');
const FOCUS_WIDTHS = [390, 1280];
// Every walked width: a page must never be wider than its viewport (code blocks scroll inside
// themselves instead). 390px is the phone width the audit measured.
const OVERFLOW_WIDTHS = WIDTHS;
const PORT = Number(arg('port', 3919));
const MAX_TABS = 80;

// Requests that leave the machine are answered locally, as in snapshot.js (fonts are
// fulfilled with an empty stylesheet). Two scripts the production layout adds only exist
// on Vercel's hosting; outside it `next start` answers 404, which is an environment fact,
// not a defect of the page. They are the ONLY exemption, matched by exact path, and every
// exempted message is still counted and printed.
const HOSTING_ONLY = ['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js'];

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

async function waitForServer(port, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ok = await new Promise((resolve) => http.get({ port, path: '/robots.txt', timeout: 1500 }, (res) => { res.resume(); resolve(res.statusCode < 500); }).on('error', () => resolve(false)));
    if (ok) return;
    if (Date.now() > deadline) throw new Error(`next start did not answer on ${port} within ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 400));
  }
}

/** In the page: every var() a matching rule reads without a fallback, that does not resolve. */
function findUnresolvedVars() {
  const problems = new Map();
  const REF = /var\(\s*(--[\w-]+)\s*(,)?/g;
  const strip = (selector) => selector.replace(/::?[\w-]+(\([^)]*\))?/g, (m) => (/^:(not|is|where|has)\(/.test(m) ? m : '')).trim() || '*';
  const visit = (rules) => {
    for (const rule of rules) {
      if (rule.type === CSSRule.MEDIA_RULE) { if (window.matchMedia(rule.media.mediaText).matches) visit(rule.cssRules); continue; }
      if (rule.type === CSSRule.SUPPORTS_RULE) { if (CSS.supports(rule.conditionText)) visit(rule.cssRules); continue; }
      if (rule.type !== CSSRule.STYLE_RULE) { if (rule.cssRules) visit(rule.cssRules); continue; }
      const text = rule.style.cssText;
      if (!text.includes('var(')) { if (rule.cssRules && rule.cssRules.length) visit(rule.cssRules); continue; }
      const refs = [];
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style.item(i);
        const value = rule.style.getPropertyValue(prop);
        for (const m of value.matchAll(REF)) if (!m[2]) refs.push([prop, m[1]]);
      }
      if (refs.length) {
        let elements = [];
        try { elements = [...document.querySelectorAll(strip(rule.selectorText))].slice(0, 25); } catch { elements = []; }
        for (const el of elements) {
          const cs = getComputedStyle(el);
          for (const [prop, name] of refs) {
            if (cs.getPropertyValue(name).trim() === '') {
              const key = `${name} (read by ${prop} in "${rule.selectorText.slice(0, 80)}")`;
              if (!problems.has(key)) problems.set(key, `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`);
            }
          }
        }
      }
      if (rule.cssRules && rule.cssRules.length) visit(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    visit(rules);
  }
  return [...problems.entries()].map(([ref, el]) => `${ref} on ${el}`);
}

/** In the page: what the focused element looks like — outline (only when drawn), shadow,
 * border and background colors, underline — to compare with the same element unfocused. */
function focusStyle() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const signature = () => {
    const cs = getComputedStyle(el);
    const outline = cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) === 0 ? 'no-outline' : `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`;
    return [outline, cs.boxShadow, cs.borderTopColor, cs.borderBottomColor, cs.backgroundColor, cs.textDecorationLine].join('|');
  };
  const describe = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : ''}${el.getAttribute('title') ? `[title="${el.getAttribute('title')}"]` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''} "${(el.textContent || '').trim().slice(0, 30)}"`;
  const focused = signature();
  const visible = el.matches(':focus-visible');
  // Measure the same element without focus, then give focus back so Tab continues from it.
  el.blur();
  const unfocused = signature();
  el.focus({ focusVisible: true });
  return { describe, tag: el.tagName, visible, focused, unfocused };
}

function createReport() {
  const failures = [];
  const exempt = [];
  return {
    failures, exempt,
    fail: (where, what) => failures.push(`${where}: ${what}`),
    summary() {
      const byKind = {};
      for (const f of failures) { const kind = f.split(': ')[1]?.split(' ')[0] || 'other'; byKind[kind] = (byKind[kind] || 0) + 1; }
      return byKind;
    },
  };
}

async function newContext(browser, scheme) {
  const context = await browser.newContext({ deviceScaleFactor: 1, colorScheme: scheme });
  await context.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (route) => {
    route.request().resourceType() === 'stylesheet' ? route.fulfill({ status: 200, contentType: 'text/css', body: '' }) : route.fulfill({ status: 204, body: '' });
  });
  return context;
}

function attachConsole(page, report, where) {
  const onConsole = (msg) => {
    const text = msg.text();
    const location = msg.location()?.url || '';
    if (msg.type() === 'error') {
      if (HOSTING_ONLY.some((p) => location.endsWith(p) || text.includes(p))) { report.exempt.push(`${where()}: ${text.slice(0, 160)}`); return; }
      report.fail(where(), `console-error ${text.slice(0, 200)}`);
    } else if (msg.type() === 'warning' && /uxdsl|UXD_/i.test(text)) {
      report.fail(where(), `uxdsl-warning ${text.slice(0, 200)}`);
    }
  };
  const onError = (error) => report.fail(where(), `page-error ${String(error.message).slice(0, 200)}`);
  const onResponse = (response) => {
    const url = new URL(response.url());
    if (response.status() >= 400 && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
      if (HOSTING_ONLY.includes(url.pathname)) report.exempt.push(`${where()}: ${response.status()} ${url.pathname}`);
    }
  };
  page.on('console', onConsole);
  page.on('pageerror', onError);
  page.on('response', onResponse);
  return () => { page.off('console', onConsole); page.off('pageerror', onError); page.off('response', onResponse); };
}

async function load(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(250);
}

async function checkFocus(page, report, where) {
  await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); window.scrollTo(0, 0); });
  const seen = new Set();
  let checked = 0;
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(focusStyle);
    if (!focused) continue;
    if (focused.tag === 'IFRAME') { report.exempt.push(`${where}: focus entered an iframe (the sandbox has no focusable content)`); continue; }
    if (seen.has(focused.describe)) break; // wrapped around
    seen.add(focused.describe);
    checked++;
    if (!focused.visible) report.fail(where, `focus-not-visible ${focused.describe}: reached by Tab but :focus-visible does not match`);
    else if (focused.focused === focused.unfocused) report.fail(where, `focus-invisible ${focused.describe}: nothing about it changes when it has keyboard focus`);
  }
  return checked;
}

async function checkContrast(page, report, where, themeName) {
  const { checkThemeContrast, resolveTheme } = require(path.join(ROOT, 'packages/uxdsl/dist/entries/engine'));
  const exceptions = require(path.join(ROOT, 'packages/uxdsl/src/theme/base.contrast-exceptions.json'));
  const { themes } = require(path.join(PLAYGROUND, 'themes.js'));
  const node = checkThemeContrast(resolveTheme(themes[themeName]), { exceptions });
  const signatureOf = (f) => `${f.mode}.${f.family}.${f.component}.${f.tone ?? '-'}.${f.state}.${f.pair}.${f.background}.${f.breakpoint}`;
  const nodeSignatures = node.failures.map(signatureOf).sort();
  // Excepted pairs are compared too, each with the exception that covers it:
  // the page must not show fewer covered pairs than the checker reports.
  const nodeExcepted = node.excepted.map((f) => `${signatureOf(f)}|${f.exception}`).sort();
  const shown = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="contrast-report"]');
    return el ? {
      summary: JSON.parse(el.getAttribute('data-contrast-summary')),
      signatures: JSON.parse(el.getAttribute('data-contrast-signatures')),
      excepted: JSON.parse(el.getAttribute('data-contrast-excepted') || 'null'),
      exceptedRows: el.querySelectorAll('[data-testid="contrast-excepted"] tbody tr').length,
    } : null;
  });
  if (!shown) { report.fail(where, 'contrast-mismatch the page rendered no report'); return null; }
  const expected = { passed: node.passed, checked: node.checked.length, failures: node.failures.length, excepted: node.excepted.length, exceptions: node.exceptions.length, exceptionIssues: node.exceptionIssues.length };
  const got = { passed: shown.summary.passed, checked: shown.summary.checked, failures: shown.summary.failures, excepted: shown.summary.excepted, exceptions: shown.summary.exceptions, exceptionIssues: shown.summary.exceptionIssues };
  if (JSON.stringify(expected) !== JSON.stringify(got)) report.fail(where, `contrast-mismatch summary for ${themeName}: page ${JSON.stringify(got)} vs Node ${JSON.stringify(expected)}`);
  if (JSON.stringify(nodeSignatures) !== JSON.stringify(shown.signatures)) report.fail(where, `contrast-mismatch failing pairs for ${themeName} differ from Node's (${shown.signatures.length} vs ${nodeSignatures.length})`);
  if (JSON.stringify(nodeExcepted) !== JSON.stringify(shown.excepted)) report.fail(where, `contrast-mismatch excepted pairs for ${themeName} differ from Node's (${shown.excepted ? shown.excepted.length : 'none exposed'} vs ${nodeExcepted.length})`);
  if (shown.exceptedRows !== nodeExcepted.length) report.fail(where, `contrast-mismatch the page lists ${shown.exceptedRows} excepted pair(s) for ${themeName}, Node reports ${nodeExcepted.length}`);
  if (shown.summary.theme !== themeName) report.fail(where, `contrast-mismatch the page says theme "${shown.summary.theme}", expected "${themeName}"`);
  return { themeName, ...got };
}

/** In the page: the document is wider than the viewport; and the elements sticking out the most. */
function findHorizontalOverflow() {
  const root = document.documentElement;
  if (root.scrollWidth <= root.clientWidth) return null;
  const limit = root.clientWidth;
  const culprits = [];
  for (const el of document.body.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect();
    if (rect.right > limit + 1 && rect.width > 0) {
      // Only the outermost element that sticks out: its descendants follow it.
      if (culprits.some((c) => c.el.contains(el))) continue;
      culprits.push({ el, right: Math.round(rect.right) });
    }
  }
  const describe = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`;
  return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, culprits: culprits.sort((a, b) => b.right - a.right).slice(0, 3).map((c) => `${describe(c.el)} (right edge ${c.right}px)`) };
}

/** The home page's frame: its readout, read from the frame's own computed style, must be what
 * the compiled theme says density(4) and the active breakpoint are at each frame width. */
async function checkParadigm(page, report, where, inject) {
  const { resolveTheme } = require(path.join(ROOT, 'packages/uxdsl/dist/entries/engine'));
  const { inspectResponsiveValue } = require(path.join(ROOT, 'packages/uxdsl/dist/entries/language'));
  const { themes } = require(path.join(PLAYGROUND, 'themes.js'));
  const theme = resolveTheme(themes.default);
  if (inject === 'paradigm-mismatch') {
    await page.evaluate(() => {
      const doc = document.querySelector('.paradigm-frame__iframe').contentDocument;
      const style = doc.createElement('style');
      style.textContent = ':root { --uxdsl__density__4: 7px !important; }';
      doc.body.appendChild(style);
    });
  }
  const seen = [];
  for (const width of [390, 800, 1300]) {
    await page.evaluate((value) => {
      const input = document.querySelector('.paradigm-frame__control input[type="range"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, width);
    await page.waitForTimeout(250);
    const shown = await page.evaluate(() => { const el = document.querySelector('[data-testid="paradigm-readout"]'); return el ? { ...el.dataset } : null; });
    const expected = inspectResponsiveValue(theme.densities['4'], width, theme.breakpoints);
    const key = (/^space\(([\w-]+)\)$/.exec(expected.value) || [])[1];
    const density = key ? theme.spacing[key] : expected.value;
    if (!shown) { report.fail(where, 'paradigm-mismatch the home page rendered no frame readout'); return seen; }
    if (Number(shown.width) !== width) report.fail(where, `paradigm-mismatch the slider set ${width}px but the frame reports ${shown.width}px`);
    if (shown.breakpoint !== expected.active) report.fail(where, `paradigm-mismatch at ${width}px the frame says breakpoint "${shown.breakpoint}", the theme says "${expected.active}"`);
    if (shown.density !== density) report.fail(where, `paradigm-mismatch at ${width}px the frame's --uxdsl__density__4 is "${shown.density}", the theme says ${expected.value} = "${density}"`);
    seen.push(`${width}px: ${shown.breakpoint}, density(4) = ${shown.density} (${shown.padding}), h2 ${shown.fontSize}`);
  }
  return seen;
}

async function walk(browser, { routes, widths, schemes, inject = null, focusWidths = FOCUS_WIDTHS, contrastThemes = ['default', 'green'], overflowWidths = OVERFLOW_WIDTHS }) {
  const report = createReport();
  const stats = { pages: 0, focusChecked: 0, contrast: [], paradigm: [] };
  for (const scheme of schemes) {
    const context = await newContext(browser, scheme);
    const page = await context.newPage();
    let where = '';
    const detach = attachConsole(page, report, () => where);
    for (const route of routes) {
      for (const width of widths) {
        where = `${route} ${scheme} @${width}`;
        await page.setViewportSize({ width, height: 900 });
        await load(page, `http://localhost:${PORT}${route}`);
        if (inject === 'undefined-var') await page.addStyleTag({ content: 'body { outline-color: var(--uxdsl__palette__does-not-exist); }' });
        if (inject === 'console-error') await page.evaluate(() => console.error('negative control: injected console.error'));
        for (const problem of await page.evaluate(findUnresolvedVars)) report.fail(where, `unresolved-var ${problem}`);
        if (overflowWidths.includes(width)) {
          if (inject === 'overflow') await page.evaluate(() => { const el = document.createElement('div'); el.className = 'negative-control-wide'; el.style.width = '2000px'; el.style.height = '1px'; document.body.appendChild(el); });
          const overflow = await page.evaluate(findHorizontalOverflow);
          if (overflow) report.fail(where, `horizontal-overflow the page is ${overflow.scrollWidth}px wide in a ${overflow.clientWidth}px viewport: ${overflow.culprits.join(', ') || 'no element found'}`);
        }
        if (route === '/' && width === 1280) stats.paradigm.push(...(await checkParadigm(page, report, where, inject)).map((line) => `${scheme} ${line}`));
        stats.pages++;
        if (focusWidths.includes(width)) {
          if (inject === 'no-focus') await page.addStyleTag({ content: '*:focus-visible, *:focus { outline: none !important; box-shadow: none !important; }' });
          stats.focusChecked += await checkFocus(page, report, where);
        }
      }
      process.stdout.write(`  ${scheme} ${route}\n`);
    }
    // The contrast page against Node, for the default theme and after switching theme in the header.
    if (routes.includes('/docs/accessibility')) {
      where = `/docs/accessibility ${scheme}`;
      await page.setViewportSize({ width: 1280, height: 900 });
      await load(page, `http://localhost:${PORT}/docs/accessibility`);
      for (const themeName of contrastThemes) {
        if (themeName !== 'default') {
          await page.locator(`#AppHeader .theme-color-btn--${themeName}`).first().click();
          await page.waitForTimeout(300);
        }
        const compareAs = inject === 'contrast-mismatch' ? (themeName === 'default' ? 'slate' : 'default') : themeName;
        const result = await checkContrast(page, report, `${where} (${themeName})`, compareAs);
        if (result) stats.contrast.push({ scheme, ...result });
      }
    }
    detach();
    await context.close();
  }
  return { report, stats };
}

async function main() {
  if (flag('build')) {
    console.log('Building the playground (uxdsl build + next build)...');
    execFileSync('npm', ['run', 'uxdsl:build'], { cwd: PLAYGROUND, stdio: 'inherit' });
    execFileSync('npx', ['next', 'build'], { cwd: PLAYGROUND, stdio: 'inherit' });
  }
  if (!fs.existsSync(path.join(PLAYGROUND, '.next/BUILD_ID'))) throw new Error('no production build: run with --build');
  const routes = arg('routes') ? arg('routes').split(',') : discoverRoutes();
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { cwd: PLAYGROUND, stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: process.env.UXDSL_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  let exitCode = 0;
  try {
    await waitForServer(PORT);
    console.log(`Walking ${routes.length} routes × ${SCHEMES.length} schemes × ${WIDTHS.length} widths (focus at ${FOCUS_WIDTHS.join(', ')})...`);
    const { report, stats } = await walk(browser, { routes, widths: WIDTHS, schemes: SCHEMES });
    console.log(`\npages loaded: ${stats.pages}; focusable elements checked: ${stats.focusChecked}`);
    for (const line of stats.paradigm) console.log(`home frame = theme at ${line}`);
    for (const c of stats.contrast) console.log(`contrast page = Node for "${c.themeName}" (${c.scheme}): checked ${c.checked}, failing ${c.failures}, passed ${c.passed}`);
    console.log(`exempted (hosting-only, listed): ${report.exempt.length}${report.exempt.length ? ` — e.g. ${report.exempt[0]}` : ''}`);
    if (report.failures.length) {
      exitCode = 1;
      console.log(`\nFAIL: ${report.failures.length} problem(s) ${JSON.stringify(report.summary())}`);
      for (const f of [...new Set(report.failures)].slice(0, Number(arg('max', 60)))) console.log(`  - ${f}`);
    } else {
      console.log('\nPASS: no console errors, no UXDSL warnings, no unresolved var(), visible keyboard focus, contrast page = Node.');
    }

    if (!flag('no-negative-control')) {
      console.log('\nNegative controls (each must be reported):');
      const controls = [
        ['undefined-var', 'unresolved-var', { routes: ['/docs/tooling'], widths: [1280], schemes: ['light'], focusWidths: [] }],
        ['console-error', 'console-error', { routes: ['/docs/tooling'], widths: [1280], schemes: ['light'], focusWidths: [] }],
        ['no-focus', 'focus-invisible', { routes: ['/docs/runtime'], widths: [1280], schemes: ['light'], focusWidths: [1280] }],
        ['contrast-mismatch', 'contrast-mismatch', { routes: ['/docs/accessibility'], widths: [1280], schemes: ['light'], focusWidths: [], contrastThemes: ['default'] }],
        ['overflow', 'horizontal-overflow', { routes: ['/docs/tooling'], widths: [390], schemes: ['light'], focusWidths: [] }],
        ['paradigm-mismatch', 'paradigm-mismatch', { routes: ['/'], widths: [1280], schemes: ['light'], focusWidths: [] }],
      ];
      for (const [inject, kind, options] of controls) {
        const { report: r } = await walk(browser, { ...options, inject });
        const caught = r.failures.some((f) => f.split(': ')[1].startsWith(kind));
        console.log(`  ${caught ? 'caught' : 'MISSED'}: ${inject} -> ${kind}${caught ? ` (${r.failures.find((f) => f.split(': ')[1].startsWith(kind)).slice(0, 140)})` : ''}`);
        if (!caught) exitCode = 1;
      }
    }
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
  process.exitCode = exitCode;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
