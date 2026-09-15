'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = require('playwright-core');
const installed = createRequire(path.resolve(__dirname, '../mig07-consumer/package.json'));
const postcss = installed('postcss');
const plugin = installed('postcss-uxdsl');
const { generateThemeCss } = installed('postcss-uxdsl/ds-runtime');
const sourceTheme = require('../mig07-consumer/theme.json');

async function main() {
  const theme = { ...sourceTheme, modes: { dark: { palette: { surface: { main: '#111111', contrast: '#eeeeee' } } } } };
  const css = (await postcss([plugin({ theme, includeTheme: false })]).process('.probe { @ds-surface(contained 2); border: border(2); }', { from: undefined })).css;
  const browser = await chromium.launch({ executablePath: process.env.UXDSL_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
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
main().catch(error => { console.error(error); process.exitCode = 1; });
