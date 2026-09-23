'use strict';

/**
 * MIG-B7-14 (FEAT-009): a compiled stylesheet's `@import` is only honored by a
 * browser when it precedes every other rule. Beta.6 emitted the Google Fonts
 * import behind a `:root`, so the request was never made. The existing browser
 * check (browser.js) builds its theme with generateThemeCss — the runtime path,
 * which was always correct — and so never looked at what a *build* produces.
 *
 * This one compiles with the installed package's plugin and includeTheme:true
 * (the output the CLI writes to disk), loads it in real Chrome, and asserts on
 * what the browser actually does: that it REQUESTS fonts.googleapis.com, and
 * honors the author's own @import. It then loads the same CSS with the imports
 * moved back behind `:root` — the beta.6 ordering — and asserts the browser
 * ignores them, which is what proves the checks above can go red.
 *
 * The author's import is a `data:` URL so its effect is observable without a
 * network. Requests to Google are intercepted and answered locally.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = require('playwright-core');
const installed = createRequire(path.resolve(__dirname, '../mig07-consumer/package.json'));
const postcss = installed('postcss');
const plugin = installed('postcss-uxdsl');

const RED = 'rgb(255, 0, 0)';
const AUTHOR_IMPORT = '@import url("data:text/css,.probe%7Bbackground-color:rgb(255,0,0)%7D");';

/** The beta.6 layout: every @import moved behind the first non-import rule. */
function withImportsBehindRoot(css) {
  const root = postcss.parse(css);
  const imports = root.nodes.filter((node) => node.type === 'atrule' && node.name === 'import');
  const firstRule = root.nodes.find((node) => node.type === 'rule');
  assert.ok(firstRule && imports.length >= 2, 'the compiled output must contain the theme :root and both imports');
  imports.forEach((node) => node.remove());
  imports.reverse().forEach((node) => root.insertAfter(firstRule, node));
  return root.toString();
}

async function load(browser, css) {
  const page = await browser.newPage();
  const googleRequests = [];
  await page.route('**://fonts.googleapis.com/**', (route) => {
    googleRequests.push(route.request().url());
    route.fulfill({ status: 200, contentType: 'text/css', body: '/* local font stub */' });
  });
  await page.setContent(`<style>${css}</style><div class="probe">probe</div>`);
  await page.waitForTimeout(500);
  const background = await page.locator('.probe').evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.close();
  return { googleRequests, background };
}

async function main() {
  const source = `${AUTHOR_IMPORT}\n.probe { padding: density(2); }`;
  const css = (await postcss([plugin({ includeTheme: true })]).process(source, { from: undefined })).css;

  const nodes = postcss.parse(css).nodes.filter((node) => node.type !== 'comment');
  assert.ok(nodes[0].type === 'atrule' && nodes[0].name === 'import', `compiled output must start with an @import, started with ${nodes[0].selector || '@' + nodes[0].name}`);

  const browser = await chromium.launch({ executablePath: process.env.UXDSL_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const good = await load(browser, css);
    assert.equal(good.googleRequests.length, 1, `Chrome must request Google Fonts exactly once, requested ${JSON.stringify(good.googleRequests)}`);
    assert.match(good.googleRequests[0], /family=Inter/);
    assert.equal(good.background, RED, "the author's own @import must be honored too");

    const beta6 = await load(browser, withImportsBehindRoot(css));
    assert.deepEqual(beta6.googleRequests, [], 'negative control: with the imports behind :root Chrome makes no request — the check above can go red');
    assert.notEqual(beta6.background, RED, "negative control: an author import behind :root is discarded, too");

    console.log('PASS: the compiled stylesheet makes Chrome request Google Fonts and honors the author\'s @import; the beta.6 ordering (imports behind :root) does neither.');
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
