// MIG-B6-27 (FEAT-008): the generated JSON Schema is what an editor reads
// through `"$schema"` in a theme file, so it has to agree with the compiler
// twice over — accept every theme the engines accept, and reject the typos the
// engines would silently ignore. Both directions are checked here against real
// themes from this repository, not hand-written samples.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Ajv = require('ajv');

const { KNOWN_THEME_FAMILIES, THEME_SCHEMA_KEY, validateAndNormalizeTheme } = require('../dist/ds-runtime');
const { TYPOGRAPHY_PROPERTIES } = require('../dist/typography');
const { BUTTON_PROPERTIES, BUTTON_STATES } = require('../dist/buttons');
const { INPUT_PROPERTIES, INPUT_STATES } = require('../dist/inputs');
const { SURFACE_PROPERTIES } = require('../dist/surfaces');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const schemaPath = path.join(__dirname, '..', 'schema', 'theme.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// `strict: false`: ajv's strict mode objects to `propertyNames` alongside
// `additionalProperties` in ways draft-07 permits and editors accept. The
// schema is still compiled and enforced — only ajv's extra authoring lint is off.
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

function why(value) {
  validate(value);
  return (validate.errors || []).map((e) => `${e.instancePath || '(root)'} ${e.message}`).join('; ');
}

test('MIG-B6-27: every theme shipped in this repository validates', () => {
  const themes = [
    ['packaged base', 'packages/postcss-uxdsl/src/theme/base.json'],
    ['playground default', 'packages/playground-nextjs/uxdsl.theme.default.json'],
    ['playground green', 'packages/playground-nextjs/uxdsl.theme.green.json'],
    ['playground purple', 'packages/playground-nextjs/uxdsl.theme.purple.json'],
    ['playground slate', 'packages/playground-nextjs/uxdsl.theme.slate.json'],
    ['consumer fixture', 'fixtures/mig07-consumer/theme.json'],
  ];
  for (const [label, rel] of themes) {
    const file = path.join(repoRoot, rel);
    assert.ok(fs.existsSync(file), `${label}: ${rel} is missing — update this list rather than dropping the coverage`);
    const theme = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.ok(validate(theme), `${label} (${rel}) does not validate: ${why(theme)}`);
  }
});

test('MIG-B6-27: the closed sets come from the engines, not from a copy', () => {
  // If an engine gains a field and the schema is regenerated, these follow. If
  // the schema were hand-edited, they would not.
  assert.deepEqual(
    Object.keys(schema.properties).filter((key) => key !== THEME_SCHEMA_KEY).sort(),
    Array.from(KNOWN_THEME_FAMILIES).sort());
  assert.deepEqual(
    Object.keys(schema.properties.typography_details.additionalProperties.properties).sort(),
    Object.keys(TYPOGRAPHY_PROPERTIES).sort());
  assert.deepEqual(
    Object.keys(schema.properties.surfaces.additionalProperties.properties).sort(),
    Object.keys(SURFACE_PROPERTIES).sort());
  assert.deepEqual(
    Object.keys(schema.properties.buttons.additionalProperties.properties.states.properties).sort(),
    Object.keys(BUTTON_STATES).sort());
  assert.deepEqual(
    Object.keys(schema.properties.buttons.additionalProperties.properties.base.properties).sort(),
    Object.keys(BUTTON_PROPERTIES).sort());
  assert.deepEqual(
    Object.keys(schema.properties.inputs.additionalProperties.properties.states.properties).sort(),
    Object.keys(INPUT_STATES).sort());
  assert.deepEqual(
    Object.keys(schema.properties.inputs.additionalProperties.properties.base.properties).sort(),
    Object.keys(INPUT_PROPERTIES).sort());
});

test('MIG-B6-27: typos the compiler would silently ignore are rejected', () => {
  const rejected = [
    ['unknown family', { palete: { primary: { main: '#000' } } }],
    ['typography field typo', { typography_details: { h1: { fontsize: '2rem' } } }],
    ['button state camelCased', { buttons: { cta: { states: { focusVisible: { bg: 'red' } } } } }],
    ['button field typo', { buttons: { cta: { base: { outlne: '1px solid red' } } } }],
    ['input state that belongs to buttons', { inputs: { search: { states: { selected: { bg: 'red' } } } } }],
    ['surface field typo', { surfaces: { card: { paddng: 'density(2)' } } }],
    ['input field typo', { inputs: { search: { base: { placeholdr: 'red' } } } }],
    ['control role key typo', { buttons: { cta: { surfce: 'contained' } } }],
    ['breakpoint as a string', { breakpoints: { md: '768' } }],
    ['google fonts as a bare string', { fonts: { google: 'Inter' } }],
    ['unknown fonts key', { fonts: { familes: { ui: 'Inter' } } }],
    ['mode typo', { modes: { darkk: { palette: {} } } }],
    ['mode field typo', { modes: { dark: { palete: {} } } }],
    ['spacing value as a number', { spacing: { 1: 4 } }],
  ];
  for (const [label, theme] of rejected) {
    assert.equal(validate(theme), false, `${label} should not validate: ${JSON.stringify(theme)}`);
  }
});

test('MIG-B6-27: open registries stay open', () => {
  // Rejecting these would be worse than accepting a typo: they are valid
  // themes, and a schema that flags them trains people to ignore it.
  const accepted = [
    ['custom palette family', { palette: { brand: { main: '#000', contrast: '#fff' } } }],
    ['palette family with no main', { palette: { action: { disabled: 'var(--x)' } } }],
    ['partial palette family', { palette: { primary: { dark: '#000' } } }],
    ['custom typography role', { typography_details: { 'display-xl': { fontSize: '4rem' } } }],
    ['custom font family role', { fonts: { families: { marketing: 'Georgia, serif' } } }],
    ['custom surface role', { surfaces: { panel: { padding: 'density(3)' } } }],
    ['custom button role', { buttons: { checkout: { surface: 'contained', base: { padding: 'density(2)' } } } }],
    ['prefixed spacing keys', { spacing: { 'space-1': '0.25rem' } }],
    ['bare spacing keys', { spacing: { 1: '0.25rem' } }],
    ['named shadow key', { shadows: { inset: 'inset 0 1px 3px rgba(0,0,0,.2)' } }],
    ['standalone color', { colors: { white: '#ffffff' } }],
    ['color scale', { colors: { gray: { 300: '#CBD5E1' } } }],
    ['empty theme', {}],
  ];
  for (const [label, theme] of accepted) {
    assert.ok(validate(theme), `${label} should validate: ${why(theme)}`);
  }
});

test('MIG-B6-27: $schema is accepted by the schema and ignored by the validator', () => {
  const theme = { $schema: './node_modules/postcss-uxdsl/schema/theme.schema.json', spacing: { 1: '0.25rem' } };
  assert.ok(validate(theme), `a theme pointing at this schema must validate: ${why(theme)}`);
  // The runtime validator used to report it as an unknown family, which
  // advised against the very line the README tells people to add.
  const result = validateAndNormalizeTheme(theme);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.errors, []);
  // A real typo is still reported — the exemption is for this one key only.
  assert.deepEqual(
    validateAndNormalizeTheme({ palete: {} }).warnings.map((w) => w.path),
    ['palete']);
});

test('MIG-B6-27: the schema is generated, and --check detects drift', () => {
  const generator = path.join(repoRoot, 'scripts', 'generate-language-artifacts.js');
  const clean = spawnSync(process.execPath, [generator, '--check'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(clean.status, 0, `--check should pass on a clean tree: ${clean.stderr}`);

  const original = fs.readFileSync(schemaPath, 'utf8');
  try {
    const tampered = JSON.parse(original);
    tampered.properties.typography_details.additionalProperties.properties.fontsize = { type: 'string' };
    fs.writeFileSync(schemaPath, JSON.stringify(tampered, null, 2) + '\n');
    const drifted = spawnSync(process.execPath, [generator, '--check'], { cwd: repoRoot, encoding: 'utf8' });
    assert.notEqual(drifted.status, 0, '--check must fail on a hand-edited schema');
    assert.match(drifted.stderr, /theme\.schema\.json/);
  } finally {
    fs.writeFileSync(schemaPath, original);
  }
});

test('MIG-B6-27: the schema ships with the package', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.ok(pkg.files.includes('schema'), 'the schema directory must be in "files" or it is never published');
  assert.equal(pkg.exports['./schema/theme.schema.json'], './schema/theme.schema.json');
  // Types conditions must come first: Node16/NodeNext matches conditions in
  // order, so a `require`/`import` listed before `types` wins and the types
  // entry is never reached.
  for (const [subpath, conditions] of Object.entries(pkg.exports)) {
    if (typeof conditions !== 'object' || !conditions.types) continue;
    assert.equal(Object.keys(conditions)[0], 'types',
      `exports["${subpath}"] must list "types" first, before require/import`);
  }
});
