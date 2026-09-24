'use strict';

// MIG-B7-09 (FEAT-009): component tests for ThemeContext.tsx, the playground's
// one component with real logic. Until now it was covered only through the
// pieces extracted from it (theme-scheduler.js) and by the runtime's own tests;
// nothing exercised the component — which is where two real defects were.
//
// Each scenario is a function of the component under test, so the same body runs
// twice: against the real component (must pass) and against a copy with one
// behavior deliberately broken (must fail). A component test that cannot be made
// to fail proves nothing. Two of those copies are the code as it was before this
// story's fixes.
//
// Every scenario installs its own jsdom document: the runtime keeps its state per
// document, so reusing one would let a scenario see the previous one's theme.

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const harness = require('./lib/component-harness.cjs');

harness.installDom();
const { render, act, cleanup } = require('@testing-library/react');
const { themes } = require('../themes.js');

afterEach(() => cleanup());

const STYLE_ID = 'uxdsl-ssr-theme';
const frame = () => new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
const settle = () => act(async () => { await frame(); await frame(); });
const themeCss = () => (document.getElementById(STYLE_ID) || { textContent: '' }).textContent;
const has = (hex) => new RegExp(hex.replace('#', '#?'), 'i').test(themeCss());
const primaryOf = (name) => themes[name].palette.primary.main;
// The light-mode `--uxdsl__palette__primary-main` actually on the page. Searching
// the whole stylesheet for a hex is a weak proxy: green's primary also appears in
// purple's CSS under another role, so a wrong theme still "contained" it.
const appliedPrimary = () => ((themeCss().match(/--uxdsl__palette__primary-main:\s*([^;]+);/) || [])[1] || '').trim().toLowerCase();

/** Mounts the provider, exposing the latest context value as `.ctx`. */
async function mount({ ThemeContextProvider, useTheme }) {
  const seen = { ctx: null };
  const Probe = () => { seen.ctx = useTheme(); return null; };
  render(React.createElement(ThemeContextProvider, null, React.createElement(Probe)));
  await settle();
  return seen;
}

/** Captures console output the component writes on purpose (rejected themes). */
function captureConsole() {
  const errors = [];
  const original = { error: console.error, warn: console.warn };
  console.error = (...args) => errors.push(args.join(' '));
  console.warn = () => {};
  return { errors, restore: () => Object.assign(console, original) };
}

// --- scenarios: each takes the loaded component and throws when it does not hold ---

const scenarios = {
  async initialization(component) {
    harness.installDom();
    const seen = await mount(component);
    assert.equal(document.querySelectorAll(`#${STYLE_ID}`).length, 1, 'exactly one managed stylesheet');
    assert.ok(themeCss().length > 1000, 'the default theme was applied on mount');
    assert.equal(appliedPrimary(), primaryOf('default').toLowerCase(), 'the applied CSS carries the default theme\'s primary colour');
    assert.equal(seen.ctx.currentTheme, 'default');
    assert.equal(seen.ctx.isDark, false);
  },

  async initializationRemovesOnlyWhatItRetired(component) {
    harness.installDom();
    // Elements the provider used to manage (retired), one it never did, and inline
    // properties: a runtime-owned one and an app-owned one.
    document.head.insertAdjacentHTML('beforeend', '<link id="uxdsl-google-fonts"><style id="uxdsl-typography-theme"></style><style id="app-owned"></style>');
    document.documentElement.style.setProperty('--uxdsl__space__1', '99px');
    document.documentElement.style.setProperty('--app-token', 'keep');
    await mount(component);
    assert.equal(document.getElementById('uxdsl-google-fonts'), null, 'retired font <link> removed');
    assert.equal(document.getElementById('uxdsl-typography-theme'), null, 'retired typography <style> removed');
    assert.ok(document.getElementById('app-owned'), 'an element the app owns is left alone');
    assert.equal(document.documentElement.style.getPropertyValue('--uxdsl__space__1'), '', 'a stale inline runtime token no longer covers the stylesheet');
    assert.equal(document.documentElement.style.getPropertyValue('--app-token'), 'keep', 'an inline property the app owns is left alone');
  },

  async switchTheme(component) {
    harness.installDom();
    const seen = await mount(component);
    const initial = themeCss();
    act(() => seen.ctx.switchTheme('green'));
    await settle();
    assert.equal(seen.ctx.currentTheme, 'green');
    assert.equal(appliedPrimary(), primaryOf('green').toLowerCase(), 'the green theme\'s primary colour is on the page, not another theme\'s');
    assert.notEqual(themeCss(), initial);
    assert.equal(document.querySelectorAll(`#${STYLE_ID}`).length, 1, 'switching swaps the stylesheet, it does not add one');
    act(() => seen.ctx.switchTheme('default'));
    await settle();
    assert.equal(themeCss(), initial, 'switching back restores the default CSS exactly');
  },

  async customEdit(component) {
    harness.installDom();
    const seen = await mount(component);
    act(() => seen.ctx.setCustomTheme('mine', { palette: { primary: { main: '#123456' } } }));
    await settle();
    assert.ok(has('#123456'), 'the edit reached the page');
    assert.equal(seen.ctx.currentTheme, 'custom');
    assert.equal(seen.ctx.customThemeName, 'mine');
  },

  async editsLayerUnlessReplaced(component) {
    harness.installDom();
    const seen = await mount(component);
    act(() => seen.ctx.setCustomTheme('a', { palette: { primary: { main: '#111111' } } }));
    await settle();
    act(() => seen.ctx.setCustomTheme('a', { palette: { secondary: { main: '#222222' } } }));
    await settle();
    assert.ok(has('#111111') && has('#222222'), 'a later edit layers over the earlier one');
    act(() => seen.ctx.setCustomTheme('b', { palette: { secondary: { main: '#333333' } } }, { replace: true }));
    await settle();
    assert.ok(has('#333333'), 'the replacing edit applied');
    assert.ok(!has('#111111') && !has('#222222'), '`replace` starts again from the common base, not from the earlier edits');
  },

  async independentEditsInOneFrame(component) {
    harness.installDom();
    const seen = await mount(component);
    act(() => {
      seen.ctx.setCustomTheme('two', { palette: { primary: { main: '#123456' } } });
      seen.ctx.setCustomTheme('two', { palette: { secondary: { main: '#654321' } } });
    });
    await settle();
    assert.ok(has('#123456'), 'the first of two independent edits in one frame survives');
    assert.ok(has('#654321'), 'and so does the second');
  },

  async abandonedEditNeverLands(component) {
    harness.installDom();
    const seen = await mount(component);
    act(() => {
      seen.ctx.setCustomTheme('abandoned', { palette: { primary: { main: '#abcdef' } } });
      seen.ctx.switchTheme('green'); // the user moves on before the frame
    });
    await settle();
    assert.ok(!has('#abcdef'), 'an edit queued before switching theme must not land on the new theme');
    assert.equal(seen.ctx.currentTheme, 'green');
    assert.equal(appliedPrimary(), primaryOf('green').toLowerCase());
  },

  async refusedEditKeepsTheAppliedTheme(component) {
    harness.installDom();
    const spy = captureConsole();
    try {
      const seen = await mount(component);
      const before = themeCss();
      // Moving an existing breakpoint threshold changes what compiled components
      // would emit, so the runtime refuses it (UXD_THEME_STRUCTURE).
      act(() => seen.ctx.setCustomTheme('refused', { breakpoints: { md: 900 } }));
      await settle();
      assert.equal(themeCss(), before, 'the page keeps the CSS it had');
      assert.ok(spy.errors.some((line) => /rejected; the applied theme was kept/.test(line)), 'the refusal is reported');
      assert.equal(seen.ctx.currentTheme, 'default', 'the UI must not claim a theme that is not on the page');
      assert.equal(seen.ctx.customThemeName, null);
      // …and the refusal must not poison what comes next.
      act(() => seen.ctx.setCustomTheme('fine', { palette: { primary: { main: '#123456' } } }));
      await settle();
      assert.ok(has('#123456'), 'an edit after a refused one is not refused with it');
      assert.equal(seen.ctx.currentTheme, 'custom');
    } finally { spy.restore(); }
  },

  async invalidThemeThrowsAndChangesNothing(component) {
    harness.installDom();
    const seen = await mount(component);
    const before = themeCss();
    assert.throws(() => seen.ctx.setCustomTheme('bad', { densities: { 99: 'bogus(' } }), /UXD_DENSITY_VALUE/);
    await settle();
    assert.equal(themeCss(), before);
    assert.equal(seen.ctx.currentTheme, 'default');
  },

  async darkModeToggle(component) {
    harness.installDom();
    const seen = await mount(component);
    act(() => seen.ctx.toggleDarkMode());
    assert.equal(seen.ctx.isDark, true);
    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
    act(() => seen.ctx.toggleDarkMode());
    assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  },

  async useThemeNeedsItsProvider({ useTheme }) {
    harness.installDom();
    const spy = captureConsole();
    try {
      const Orphan = () => { useTheme(); return null; };
      assert.throws(() => render(React.createElement(Orphan)), /useTheme must be used within a ThemeContextProvider/);
    } finally { spy.restore(); }
  },
};

const real = harness.loadComponent('src/components/ThemeContext.tsx');

for (const [name, run] of Object.entries(scenarios)) {
  test(`ThemeContext: ${name}`, async () => { await run(real); });
}

// --- negative controls -------------------------------------------------------
// Each entry breaks one behavior in a copy of the source and names the scenario
// that has to notice. The first two restore the code as it was before this
// story's fixes.

const mutations = [
  {
    label: 'before the fix: a refused edit still reaches React state',
    scenario: 'refusedEditKeepsTheAppliedTheme',
    edit: (src) => src.replace('if (lastApplyRef.current && !lastApplyRef.current.ok) return\n', ''),
  },
  {
    label: 'before the fix: an edit is built from the stale theme, not from what is pending',
    scenario: 'independentEditsInOneFrame',
    edit: (src) => src.replace('pendingCustomRef.current?.theme || activeThemeData || defaultTheme', 'activeThemeData || defaultTheme'),
  },
  {
    label: 'switching to "green" applies the purple theme (the doubled-case bug MIG-B6-30 fixed)',
    scenario: 'switchTheme',
    edit: (src) => src.replace("case 'green':\n        themeToApply = greenTheme;", "case 'green':\n        themeToApply = purpleTheme;"),
  },
  {
    label: 'switching theme no longer cancels the queued edit',
    scenario: 'abandonedEditNeverLands',
    edit: (src) => src.replace("scheduler?.cancel()\n    pendingCustomRef.current = null\n\n    let themeToApply", "pendingCustomRef.current = null\n\n    let themeToApply"),
  },
  {
    label: 'stale inline runtime tokens are no longer cleared',
    scenario: 'initializationRemovesOnlyWhatItRetired',
    edit: (src) => src.replace('      clearRuntimeInlineTokens()\n', ''),
  },
  {
    label: 'the retired managed elements are no longer removed',
    scenario: 'initializationRemovesOnlyWhatItRetired',
    edit: (src) => src.replace('      retireOldManagedElements()\n', ''),
  },
];

for (const { label, scenario, edit } of mutations) {
  test(`negative control: ${scenario} fails when ${label}`, async () => {
    const broken = harness.loadComponent('src/components/ThemeContext.tsx', { transform: edit });
    await assert.rejects(() => scenarios[scenario](broken), undefined, `${scenario} did not notice: ${label}`);
    // The same scenario must still pass on the real component (already covered above).
    await scenarios[scenario](real);
  });
}
