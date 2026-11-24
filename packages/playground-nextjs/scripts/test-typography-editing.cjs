// The Live theme handler's Typography tab: the fields a role emits and the patches that edit them.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { deepMergeTheme, validateTheme, generateThemeCss } = require('uxdsl/theme');
const { baseTheme } = require('../themes');
const t = require('../src/lib/typography-editing');

const details = baseTheme.typography_details;

test('roles come in the theme order, default last', () => {
  const roles = t.roleOrder(details);
  assert.equal(roles[roles.length - 1], 'default');
  assert.ok(roles.indexOf('h1') < roles.indexOf('h2'));
  assert.equal(new Set(roles).size, Object.keys(details).length);
});

test('a role emits its own fields over default’s, and says which is which', () => {
  const h1 = Object.fromEntries(t.fieldsOf(details, 'h1').map((f) => [f.field, f]));
  assert.equal(h1.fontSize.own, true);
  assert.equal(h1.fontSize.value, details.h1.fontSize);
  // h1 has no fontFamily of its own: it takes default's.
  assert.equal(h1.fontFamily.own, false);
  assert.equal(h1.fontFamily.value, details.default.fontFamily);
  assert.deepEqual(t.fieldsOf(details, 'h1').map((f) => f.field).slice(0, 2), ['fontFamily', 'fontSize']);
  // default inherits from nothing.
  assert.ok(t.fieldsOf(details, 'default').every((f) => f.own));
});

test('an edited field, own or inherited, moves only that role’s variable', () => {
  const edited = deepMergeTheme(baseTheme, t.fieldPatch('h1', 'fontFamily', 'var(--uxdsl__font__code)'));
  assert.equal(validateTheme(edited).ok, true);
  const css = generateThemeCss(edited);
  assert.match(css, /--uxdsl__typography__h1-font-family: var\(--uxdsl__font__code\)/);
  assert.match(css, /--uxdsl__typography__h2-font-family: var\(--uxdsl__font__ui\)/);
  // The same fields are emitted, so this is a value change, not a structural one.
  assert.deepEqual(t.fieldsOf(edited.typography_details, 'h1').map((f) => f.field), t.fieldsOf(details, 'h1').map((f) => f.field));
  assert.equal(t.cssName('marginBlockEnd'), 'margin-block-end');
});

test('a font preset writes the family and its Google entry, and drops fonts nothing names', () => {
  const lora = t.FONT_PRESETS.find((p) => p.name === 'Lora');
  const patch = t.fontPresetPatch(baseTheme.fonts, 'ui', lora);
  assert.deepEqual(patch.fonts.families, { ui: 'Lora, serif' });
  // Inter was only the ui font, so its @import goes; Lora's comes.
  assert.deepEqual(patch.fonts.google, [lora.google]);
  const edited = deepMergeTheme(baseTheme, patch);
  assert.equal(validateTheme(edited).ok, true);
  assert.match(generateThemeCss(edited), /@import url\(['"]https:\/\/fonts\.googleapis\.com\/css2\?family=Lora/);
  assert.equal(t.presetOf('Lora, serif'), lora);
  // Control: a Google font another family still names is kept.
  const both = { google: ['Inter:wght@400', 'Fira Code:wght@400'], families: { ui: 'Inter, sans-serif', code: '"Fira Code", monospace' } };
  assert.deepEqual(t.fontPresetPatch(both, 'ui', lora).fonts.google, ['Fira Code:wght@400', lora.google]);
  assert.deepEqual(t.familyOptions(baseTheme.fonts).map((o) => o.value), Object.keys(baseTheme.fonts.families).map((k) => `var(--uxdsl__font__${k})`));
  assert.equal(t.googleName('Space+Grotesk:wght@400'), 'Space Grotesk');
});
