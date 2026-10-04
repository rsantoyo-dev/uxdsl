const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;
const { resolveTheme, checkThemeContrast } = require('../dist/ds-runtime');
const base = require('../src/theme/base.json');
const exceptions = require('../src/theme/base.contrast-exceptions.json');

// Stability phase 5 (audit T15, L17, T13): the base Button roles ship
// `focusvisible` and `disabled`, the Input roles' `disabled` carries a cursor,
// and Spacing and Borders have an explicit zero like Density, Radii and
// Shadows already had. Adding a state later is structural under `applyTheme`
// (a rebuild), which is why they are in the base before the contract freezes.

const compile = (source) => postcss([plugin({})]).process(source, { from: undefined }).then((r) => r.css);
const rulesOf = (css, prefix) => {
  const out = [];
  postcss.parse(css).walkRules((rule) => { if (rule.selector.startsWith(prefix)) out.push({ selector: rule.selector, props: Object.fromEntries(rule.nodes.map((n) => [n.prop, n.value])) }); });
  return out;
};

test('every base Button role ships focusvisible (an outline in the tone) and disabled (opacity and cursor)', () => {
  for (const role of ['contained', 'outlined', 'flat']) {
    const states = base.buttons[role].states;
    assert.deepEqual(states.focusvisible, { outline: '2px solid tone(main)', 'outline-offset': '2px' }, role);
    assert.deepEqual(states.disabled, { opacity: '0.6', cursor: 'not-allowed' }, role);
    assert.deepEqual(Object.keys(states), ['hover', 'focusvisible', 'selected', 'disabled'], `${role}: state order is the emission order`);
  }
  for (const role of ['contained', 'outlined', 'underline']) {
    assert.equal(base.inputs[role].states.disabled.cursor, 'not-allowed', role);
    assert.equal(base.inputs[role].states.disabled.opacity, '0.6', role);
    assert.ok(base.inputs[role].states.focus, `${role}: an Input's visible focus is its focus state`);
  }
});

test('@ds-button emits the two new state rules, with the tone in the outline, and @ds-input a cursor on disabled', async () => {
  const css = await compile('.btn { @ds-button(outlined success); }\n.plain { @ds-button(contained); }\n.in { @ds-input(contained); }');
  const btn = rulesOf(css, '.btn');
  const focus = btn.find((r) => r.selector === '.btn:focus-visible');
  assert.ok(focus, 'a :focus-visible rule');
  assert.equal(focus.props.outline, 'var(--uxdsl__button__outlined-tone-success-focusvisible-outline, var(--uxdsl__button__outlined-focusvisible-outline))');
  assert.equal(focus.props['outline-offset'], 'var(--uxdsl__button__outlined-tone-success-focusvisible-outline-offset, var(--uxdsl__button__outlined-focusvisible-outline-offset))');
  const disabled = btn.find((r) => r.selector === '.btn:disabled, .btn[aria-disabled="true"]');
  assert.ok(disabled, 'a :disabled rule that also matches aria-disabled');
  assert.deepEqual(Object.keys(disabled.props), ['opacity', 'cursor']);
  assert.match(css, /--uxdsl__button__outlined-tone-success-focusvisible-outline: 2px solid var\(--uxdsl__palette__success-main\);/);
  assert.match(css, /--uxdsl__button__outlined-focusvisible-outline: 2px solid var\(--uxdsl__button__tone-main, var\(--uxdsl__palette__primary-main\)\);/);
  assert.match(css, /--uxdsl__button__contained-disabled-opacity: 0\.6;/);
  assert.match(css, /--uxdsl__button__contained-disabled-cursor: not-allowed;/);
  const plainFocus = rulesOf(css, '.plain').find((r) => r.selector === '.plain:focus-visible');
  assert.equal(plainFocus.props.outline, 'var(--uxdsl__button__contained-focusvisible-outline)', 'untoned: the role variable, which falls back to primary');
  const inDisabled = rulesOf(css, '.in').find((r) => r.selector === '.in:disabled, .in[aria-disabled="true"]');
  assert.equal(inDisabled.props.cursor, 'var(--uxdsl__input__contained-disabled-cursor)');
});

test('disclosed limitation: the hover rule precedes the disabled rule and still sets colors, so a hovered disabled button is dimmed, not frozen', async () => {
  // Values cannot fix this: `disabled` restating base colors would say
  // `tone(main)`, which is `primary` for an untoned button whose real base
  // is the Surface. The fix is the state selectors excluding :disabled — an
  // engine change this test pins the absence of, so it flips consciously.
  const css = await compile('.btn { @ds-button(contained); }');
  const selectors = rulesOf(css, '.btn').map((r) => r.selector);
  assert.ok(selectors.indexOf('.btn:hover') < selectors.indexOf('.btn:disabled, .btn[aria-disabled="true"]'));
  assert.doesNotMatch(selectors.join('\n'), /:hover:not\(/);
});

test('space(0) and border(0) compile with no theme of the project\'s own, to an explicit zero and none', async () => {
  assert.equal(base.spacing['0'], '0');
  assert.equal(base.borders['0'], 'none');
  assert.equal(Object.keys(base.spacing)[0], '0', 'the key sorts first');
  const css = await compile('.z { padding: space(0); border: border(0); margin: density(0); border-radius: radius(0); box-shadow: shadow(0); }');
  assert.match(css, /\.z\s*\{[^}]*padding:\s*var\(--uxdsl__space__0\)/);
  assert.match(css, /border:\s*var\(--uxdsl__border__0\)/);
  assert.match(css, /--uxdsl__space__0: 0;/);
  assert.match(css, /--uxdsl__border__0: none;/);
  assert.match(css, /--uxdsl__radius__0: 0;/);
  assert.match(css, /--uxdsl__shadow__0: none;/);
});

test('the new states keep the gate passing: focusvisible pairs are measured, disabled pairs are exempt', () => {
  const report = checkThemeContrast(resolveTheme(), { exceptions });
  assert.equal(report.passed, true);
  assert.deepEqual(report.failures, []);
  assert.ok(report.checked.some((c) => c.family === 'button' && c.state === 'focusvisible'));
  const disabled = report.checked.filter((c) => c.family === 'button' && c.state === 'disabled');
  assert.ok(disabled.length > 0 && disabled.every((c) => c.exempt));
  assert.ok(!report.excepted.some((e) => e.state === 'disabled'));
});
