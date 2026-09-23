'use strict';

// MIG-B6-30 (FEAT-008), phase 4: `applyTheme` in a real browser.
//
// The unit tests run against a DOM stub, which proves what the API *does* —
// what it writes, what it refuses, what it leaves alone. It cannot prove what
// any of that looks like on a page: whether the swapped stylesheet actually
// wins the cascade, whether a state selector matches, whether a rejected patch
// leaves the pixels where they were. That is what this file is for, and it
// deliberately asserts computed styles rather than CSS text.
//
// The runtime under test is the one from the **packed tarball** installed in
// ../mig07-consumer, bundled for the browser with esbuild. Importing the
// monorepo's TypeScript source instead would test something no consumer ever
// receives.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = require('playwright-core');

const installed = createRequire(path.resolve(__dirname, '../mig07-consumer/package.json'));
const postcss = installed('postcss');
const plugin = installed('postcss-uxdsl');
const { generateThemeCss } = installed('postcss-uxdsl/ds-runtime');
const sourceTheme = require('../mig07-consumer/theme.json');

const playgroundRequire = createRequire(path.resolve(__dirname, '../../packages/playground-nextjs/package.json'));
const esbuild = playgroundRequire('esbuild');

const CHROME = process.env.UXDSL_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const STYLE_ID = 'uxdsl-ssr-theme';

/** The installed runtime, bundled as an IIFE on `window.UXDSL`. */
function bundleInstalledRuntime() {
  const entry = installed.resolve('postcss-uxdsl/ds-runtime');
  const result = esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    globalName: 'UXDSL',
    platform: 'browser',
    write: false,
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

const checks = [];
function check(label, condition) {
  checks.push({ label, ok: !!condition });
  console.log(`  ${condition ? 'ok ' : 'FAIL'} - ${label}`);
}

async function main() {
  const theme = {
    ...sourceTheme,
    modes: { dark: { palette: { surface: { main: '#111111', contrast: '#eeeeee' } } } },
  };

  // Component CSS compiled ahead of time, exactly as a build would produce it.
  // Nothing below recompiles it — that is the point: applyTheme moves values
  // underneath rules that are already fixed.
  const componentCss = (await postcss([plugin({ theme, includeTheme: false })]).process(
    `.probe { @ds-surface(contained 2); border: border(2); }
     .action { @ds-button(contained primary); }
     .field { @ds-input(outlined); }`,
    { from: undefined })).css;

  const runtimeBundle = bundleInstalledRuntime();
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  try {
    const page = await browser.newPage();

    // Every Google Fonts request is answered locally, so the assertions below
    // are about *what the page asks for*, deterministically, with no network.
    const fontRequests = [];
    await page.route('**://fonts.googleapis.com/**', (route) => {
      fontRequests.push(route.request().url());
      route.fulfill({ status: 200, contentType: 'text/css', body: '/* local font stub */' });
    });

    // A server-rendered theme tag, the way ThemeScript emits one.
    await page.setContent(
      `<style id="${STYLE_ID}">${generateThemeCss(theme)}</style>` +
      `<style id="components">${componentCss}</style>` +
      '<div class="probe">surface</div>' +
      '<button class="action">action</button>' +
      '<input class="field" placeholder="hint" required>');
    await page.addScriptTag({ content: runtimeBundle });

    const styleTagCount = () => page.evaluate((id) => document.querySelectorAll(`style#${id}`).length, STYLE_ID);
    const probeStyles = () => page.locator('.probe').evaluate((el) => {
      const s = getComputedStyle(el);
      return { padding: s.paddingTop, radius: s.borderTopLeftRadius, bg: s.backgroundColor, color: s.color };
    });

    assert.equal(await styleTagCount(), 1, 'setup: one server-rendered theme tag');
    const beforeInit = await probeStyles();

    // --- initialization adopts the server tag ---
    const init = await page.evaluate(({ theme, id }) =>
      window.UXDSL.applyTheme(theme, { replace: true, styleId: id }), { theme, id: STYLE_ID });
    check('applyTheme initializes against the server-rendered tag', init.ok);
    check('no second theme stylesheet appears (the SSR tag was adopted)', (await styleTagCount()) === 1);
    check('adopting the tag does not change what is on screen',
      JSON.stringify(await probeStyles()) === JSON.stringify(beforeInit));

    // --- a value patch really repaints ---
    const patched = await page.evaluate(() =>
      window.UXDSL.applyTheme({ palette: { surface: { main: '#ff0000' } } }));
    const afterPatch = await probeStyles();
    check('a value patch is applied', patched.ok);
    check('and the computed background really changed', afterPatch.bg === 'rgb(255, 0, 0)');

    // --- a structural patch is refused, and the pixels do not move ---
    const rejected = await page.evaluate(() => window.UXDSL.applyTheme({ breakpoints: { md: 900 } }));
    check('a structural patch is refused in the browser too', rejected.ok === false);
    check('the refusal names the code', /UXD_THEME_STRUCTURE/.test(rejected.error?.message || ''));
    check('and nothing on screen moved after the refusal',
      JSON.stringify(await probeStyles()) === JSON.stringify(afterPatch));

    // Restore before the responsive sweep.
    await page.evaluate(() => window.UXDSL.applyTheme({ palette: { surface: { main: '#ffffff' } } }));

    // --- modes, explicit and automatic ---
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    check('explicit dark mode resolves through the applied stylesheet',
      (await probeStyles()).bg === 'rgb(17, 17, 17)');
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
    await page.emulateMedia({ colorScheme: 'dark' });
    check('prefers-color-scheme: dark resolves with no attribute set',
      (await probeStyles()).bg === 'rgb(17, 17, 17)');
    await page.emulateMedia({ colorScheme: 'light' });
    check('and light again', (await probeStyles()).bg === 'rgb(255, 255, 255)');

    // --- responsive boundaries, under a runtime-applied theme ---
    let boundariesOk = true;
    for (const width of [479, 480, 481, 767, 768, 769, 1023, 1024, 1025, 1279, 1280, 1281]) {
      await page.setViewportSize({ width, height: 600 });
      const { padding, radius } = await probeStyles();
      const expected = {
        padding: `${width >= 1280 ? 16 : width >= 768 ? 12 : 8}px`,
        radius: `${width >= 1024 ? 12 : 8}px`,
      };
      if (padding !== expected.padding || radius !== expected.radius) {
        boundariesOk = false;
        console.log(`    @${width}: got ${padding}/${radius}, expected ${expected.padding}/${expected.radius}`);
      }
    }
    check('12 breakpoint boundaries still resolve after a runtime theme application', boundariesOk);

    // --- interaction states reach the compiled rules ---
    await page.setViewportSize({ width: 1280, height: 600 });
    const restColor = await page.locator('.action').evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.locator('.action').hover();
    const hoverColor = await page.locator('.action').evaluate((el) => getComputedStyle(el).backgroundColor);
    check('a Button :hover state resolves against the applied theme', hoverColor !== restColor);

    await page.keyboard.press('Tab');
    const focusOutline = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? { tag: el.tagName, outline: getComputedStyle(el).outlineStyle } : null;
    });
    check('keyboard focus lands on the Button', focusOutline && focusOutline.tag === 'BUTTON');

    const placeholderColor = await page.locator('.field').evaluate((el) => {
      const value = getComputedStyle(el, '::placeholder').color;
      return value;
    });
    check('the Input placeholder pseudo-element is styled', !!placeholderColor);
    const invalidBorder = await page.locator('.field').evaluate((el) => getComputedStyle(el).borderBottomColor);
    check('an :invalid Input resolves a border colour', !!invalidBorder);

    // --- fonts, without depending on Google ---
    fontRequests.length = 0;
    const fontPatch = await page.evaluate(() =>
      window.UXDSL.applyTheme({ fonts: { google: ['Roboto:wght@400'] } }));
    await page.waitForTimeout(250);
    check('changing fonts.google is applied', fontPatch.ok);
    check('and the page requests exactly the new family',
      fontRequests.length === 1 && /family=Roboto%3Awght%40400|family=Roboto:wght@400/.test(fontRequests[0]));

    fontRequests.length = 0;
    const emptyFonts = await page.evaluate(() => window.UXDSL.applyTheme({ fonts: { google: [] } }));
    await page.waitForTimeout(250);
    check('an empty fonts.google list is applied', emptyFonts.ok);
    check('and issues no further managed font request', fontRequests.length === 0);

    const failed = checks.filter((entry) => !entry.ok);
    if (failed.length) {
      console.error(`\nFAIL: ${failed.length} of ${checks.length} browser checks failed.`);
      process.exitCode = 1;
    } else {
      console.log(`\nPASS: ${checks.length} browser checks against the packaged runtime ` +
        '(adoption, value patch, structural refusal, modes, 12 boundaries, states, fonts).');
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
