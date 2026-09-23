const { DEFAULT_INPUTS } = require('../packages/postcss-uxdsl/dist/inputs');
const { DEFAULT_BUTTONS } = require('../packages/postcss-uxdsl/dist/buttons');
// The compiled browser-safe language module is the authoritative source.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { DEFAULT_DENSITIES, DEFAULT_BREAKPOINTS, LANGUAGE_COMPLETIONS, getToneFamilies } = require('../packages/postcss-uxdsl/dist/language');
const { DEFAULT_BORDERS, DEFAULT_RADII } = require('../packages/postcss-uxdsl/dist/edges');
const { DEFAULT_SHADOWS } = require('../packages/postcss-uxdsl/dist/shadows');
const { DEFAULT_SURFACES } = require('../packages/postcss-uxdsl/dist/surfaces');
const { DEFAULT_THEME } = require('../packages/postcss-uxdsl/dist/default-theme');
const { TYPOGRAPHY_PROPERTIES } = require('../packages/postcss-uxdsl/dist/typography');
// MIG-B6-27 (FEAT-008): the JSON Schema is generated from the very constants
// the compiler branches on, so it cannot drift into describing a theme the
// engine would reject (or rejecting one it accepts).
const { KNOWN_THEME_FAMILIES } = require('../packages/postcss-uxdsl/dist/ds-runtime');
const { SURFACE_PROPERTIES } = require('../packages/postcss-uxdsl/dist/surfaces');
const { BUTTON_PROPERTIES, BUTTON_STATES } = require('../packages/postcss-uxdsl/dist/buttons');
const { INPUT_PROPERTIES, INPUT_STATES } = require('../packages/postcss-uxdsl/dist/inputs');
const manifestPath = 'packages/postcss-uxdsl/src/theme/theme-manifest.json';
const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'));
manifest.uxdslVersion = require('../packages/postcss-uxdsl/package.json').version;
manifest.defaults.breakpoints = DEFAULT_BREAKPOINTS;
manifest.tokens.density = { min: 1, max: Object.keys(DEFAULT_DENSITIES).length };
// MIG-B6-29 (FEAT-008), step 5: the real palette keys, not a hand-maintained
// list — this used to omit `text`/`divider`/`action` (real top-level
// DEFAULT_THEME.palette keys that just don't qualify as a "tone" family)
// because it was copied from getToneFamilies' own output once, by hand.
manifest.tokens.paletteFamilies = Object.keys(DEFAULT_THEME.palette);

// MIG-B6-26 (FEAT-008): the vscode extension's directive-argument
// completions, its TextMate grammar's function/directive alternations,
// and its CSS custom-data atDirectives list are all generated from real
// engine defaults here — never hand-typed — so they can't silently drift
// the way the previous hand-written uxdsl.custom-data.json had (a
// `functions` key the CSS custom-data format doesn't recognize, a
// `typography()`/`@ds-typography` that don't exist, a `radius(md)`
// example that doesn't compile, a missing `@ds-input`).
const directiveRoles = {
  'ds-surface': Object.keys(DEFAULT_SURFACES),
  'ds-button': Object.keys(DEFAULT_BUTTONS),
  'ds-input': Object.keys(DEFAULT_INPUTS),
};
const toneFamilies = getToneFamilies(DEFAULT_THEME.palette);
// Intersection, not the union of either family's own numeric keys — a
// size argument selects both a Density and a Radius token by the same
// number, so only a size valid for *both* is ever accepted.
const radiusKeySet = new Set(Object.keys(DEFAULT_RADII));
const sizeKeys = Object.keys(DEFAULT_DENSITIES).filter((key) => radiusKeySet.has(key));
const fullCompletions = {
  ...LANGUAGE_COMPLETIONS,
  directiveArguments: Object.fromEntries(
    Object.entries(LANGUAGE_COMPLETIONS.directiveArguments).map(([directive, overrides]) => [
      directive,
      { roles: directiveRoles[directive] || [], tones: toneFamilies, sizes: sizeKeys, overrides },
    ])
  ),
};
const directiveDescriptions = {
  theme: 'Legacy shared token pack (borders, radii, shadows, surfaces, buttons, inputs) inlined into the compiled theme. Prefer the theme JSON for new tokens.',
  'ds-surface': "Applies a shared container role (padding, radius, background, border, shadow) composed from the theme. Optional tone and numeric size: @ds-surface(role [tone] [size]).",
  'ds-button': 'Applies a shared button role and its interaction states (hover, focus, disabled, selected). Optional tone and numeric size: @ds-button(role [tone] [size]).',
  'ds-input': 'Applies a shared field role and its interaction states (focus, invalid, disabled, readonly). Optional tone and numeric size: @ds-input(role [tone] [size]).',
  'ds-typo': 'Applies a shared typography role\'s responsive font styles: @ds-typo(role).',
};
const customData = {
  version: 1.1,
  atDirectives: LANGUAGE_COMPLETIONS.directives.map((name) => ({
    name: `@${name}`,
    description: directiveDescriptions[name] || '',
  })),
};
const grammar = {
  $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
  name: 'UXDSL',
  scopeName: 'source.uxdsl',
  // #strings before #directives/#functions: a TextMate pattern list is
  // tried in order at each scan position, and a matched begin/end block
  // (a string) consumes everything up to its own end before any later
  // pattern gets a chance to look inside it. Discovered via a real
  // Oniguruma tokenization test (MIG-B6-26, FEAT-008): without this,
  // `content: "@ds-button xs(1rem)"` highlighted the text inside the
  // string as if it were a real directive and function call.
  patterns: [{ include: '#comments' }, { include: '#strings' }, { include: '#directives' }, { include: '#functions' }, { include: 'source.css' }],
  repository: {
    comments: { patterns: [{ name: 'comment.block.uxdsl', begin: '/\\*', end: '\\*/' }] },
    strings: {
      patterns: [
        { name: 'string.quoted.double.uxdsl', begin: '"', end: '"', patterns: [{ match: '\\\\.' }] },
        { name: 'string.quoted.single.uxdsl', begin: "'", end: "'", patterns: [{ match: '\\\\.' }] },
      ],
    },
    directives: { patterns: [{ name: 'keyword.control.at-rule.uxdsl', match: `@(${LANGUAGE_COMPLETIONS.directives.join('|')})\\b` }] },
    functions: { patterns: [{ match: `\\b(${LANGUAGE_COMPLETIONS.functions.join('|')})\\s*(?=\\()`, name: 'support.function.uxdsl' }] },
  },
};

// MIG-B6-29 (FEAT-008), step 6: every legacy `@theme` pack below is
// deprecated (still generated, still supported, not removed in beta.6 —
// see packages/postcss-uxdsl/README.md) now that postcss-uxdsl/theme/base.json
// supplies the same defaults to every built-in preset with no import
// needed. Deprecating does not authorize a second, hand-maintained map or
// a precedence change: these still come from the exact same engine
// defaults theme/base.json feeds, regenerated by this same script.
const banner = '/* Generated by scripts/generate-language-artifacts.js. Do not edit.\n' +
  ' * Deprecated (FEAT-008, MIG-B6-29): every built-in preset already reads\n' +
  ' * these defaults from postcss-uxdsl/theme/base.json directly, with no\n' +
  ' * import needed. Kept, unchanged in meaning, for a project that already\n' +
  ' * imports this pack explicitly. Not removed in 0.5.0-beta.6. */\n';
const files = {
  'packages/postcss-uxdsl/src/theme/default-densities.uxdsl': banner + '@theme {\n' + Object.entries(DEFAULT_DENSITIES).map(([key, value]) => `  density-${key}: ${value};`).join('\n') + '\n}\n',
  'packages/uxdsl-vscode/src/generated-completions.ts': '// Generated by scripts/generate-language-artifacts.js. Do not edit.\nexport const completions = ' + JSON.stringify(fullCompletions, null, 2) + ' as const;\n',
  'packages/uxdsl-vscode/uxdsl.custom-data.json': JSON.stringify(customData, null, 2) + '\n',
  'packages/uxdsl-vscode/syntaxes/uxdsl.tmLanguage.json': JSON.stringify(grammar, null, 2) + '\n',
  [manifestPath]: JSON.stringify(manifest, null, 2) + '\n',
};
files['packages/postcss-uxdsl/src/theme/default-spacing.css'] = banner + ':root {\n' + Object.entries(DEFAULT_THEME.spacing).map(([key, value]) => `  --uxdsl__space__${key}: ${value};`).join('\n') + '\n}\n';
const typography = Object.entries(DEFAULT_THEME.fonts.families).map(([key, value]) => `  --uxdsl__font__${key}: ${value};`);
for (const [role, fields] of Object.entries(DEFAULT_THEME.typography_details)) {
  for (const [field, value] of Object.entries(fields)) typography.push(`  --uxdsl__typography__${role}-${TYPOGRAPHY_PROPERTIES[field]}: ${value};`);
}
files['packages/postcss-uxdsl/src/theme/default-typography.uxdsl'] = banner + ':root {\n' + typography.join('\n') + '\n}\n' + fs.readFileSync(path.join(__dirname, 'templates/typography-selectors.css'), 'utf8');
for (const [family, prefix, tokens] of [['borders', 'border', DEFAULT_BORDERS], ['radii', 'radius', DEFAULT_RADII], ['shadows', 'shadow', DEFAULT_SHADOWS]]) {
  files[`packages/postcss-uxdsl/src/theme/default-${family}.uxdsl`] = banner + '@theme {\n' + Object.entries(tokens).map(([key, value]) => `  ${prefix}-${key}: ${value};`).join('\n') + '\n}\n';
}
files['packages/postcss-uxdsl/src/theme/default-buttons.uxdsl'] = banner + '@theme {\n' + Object.entries(DEFAULT_BUTTONS).map(([role, pack]) => `  button-${role}: {\n    @ds-surface(${pack.surface});\n${Object.entries(pack.states).map(([state, fields]) => `    :${state} {\n${Object.entries(fields).map(([key,value]) => `      ${key}: ${value};`).join('\n')}\n    }`).join('\n')}\n  }`).join('\n') + '\n}\n';
files['packages/postcss-uxdsl/src/theme/default-inputs.uxdsl'] = banner + '@theme {\n' + Object.entries(DEFAULT_INPUTS).map(([role, pack]) => `  input-${role}: {\n    @ds-surface(${pack.surface});\n${Object.entries(pack.base).map(([key,value]) => `    ${key}: ${value};`).join('\n')}\n${Object.entries(pack.states).map(([state, fields]) => `    :${state} {\n${Object.entries(fields).map(([key,value]) => `      ${key}: ${value};`).join('\n')}\n    }`).join('\n')}\n  }`).join('\n') + '\n}\n';
files['packages/postcss-uxdsl/src/theme/default-surfaces.uxdsl'] = banner + '@theme {\n' + Object.entries(DEFAULT_SURFACES).map(([role, style]) => `  surface-${role}: {\n${Object.entries(style).map(([key, value]) => `    ${key}: ${value};`).join('\n')}\n  }`).join('\n') + '\n}\n';
// --- MIG-B6-27 (FEAT-008): theme JSON Schema -------------------------------
//
// Editors read this through `"$schema"` in a `uxdsl.theme.json`, so it has to
// agree with the compiler on exactly two things: which family names exist, and
// which fields each engine accepts. Both come from the engines themselves
// below. The name registries a project extends — palette families, typography
// roles, font family names, role names — stay open, with only a key *pattern*
// enforced; closing them would reject `palette.brand`, which is valid.
const NAME_PATTERN = '^[A-Za-z0-9][A-Za-z0-9_-]*$';
const stringMap = (pattern = NAME_PATTERN) => ({
  type: 'object',
  propertyNames: { pattern },
  additionalProperties: { type: 'string' },
});
const closedFields = (properties) => ({
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(Object.keys(properties).map((field) => [field, { type: 'string' }])),
});
const paletteSchema = {
  type: 'object',
  propertyNames: { pattern: NAME_PATTERN },
  // A family needs no `main`: `action` in the base theme has only `disabled`.
  // The main/dark/contrast trio is the *tone* predicate Buttons and Inputs
  // apply, not the definition of a valid family.
  additionalProperties: stringMap(),
};
const controlSchema = (properties, states) => ({
  type: 'object',
  propertyNames: { pattern: NAME_PATTERN },
  additionalProperties: {
    type: 'object',
    additionalProperties: false,
    properties: {
      surface: { type: 'string' },
      base: closedFields(properties),
      states: {
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(Object.keys(states).map((state) => [state, closedFields(properties)])),
      },
    },
  },
});
const familySchemas = {
  breakpoints: { type: 'object', propertyNames: { pattern: NAME_PATTERN }, additionalProperties: { type: 'number' } },
  // `spacing` accepts the bare key (`"1"`) and the prefixed form (`"space-1"`).
  spacing: stringMap('^(space-)?[A-Za-z0-9][A-Za-z0-9_-]*$'),
  palette: paletteSchema,
  fonts: {
    type: 'object',
    additionalProperties: false,
    properties: { families: stringMap(), google: { type: 'array', items: { type: 'string' } } },
  },
  colors: {
    type: 'object',
    propertyNames: { pattern: NAME_PATTERN },
    // A standalone color (`white`) or a shade scale (`gray.300`).
    additionalProperties: { anyOf: [{ type: 'string' }, stringMap()] },
  },
  typography_details: {
    type: 'object',
    propertyNames: { pattern: NAME_PATTERN },
    additionalProperties: closedFields(TYPOGRAPHY_PROPERTIES),
  },
  densities: stringMap(),
  inputs: controlSchema(INPUT_PROPERTIES, INPUT_STATES),
  buttons: controlSchema(BUTTON_PROPERTIES, BUTTON_STATES),
  surfaces: { type: 'object', propertyNames: { pattern: NAME_PATTERN }, additionalProperties: closedFields(SURFACE_PROPERTIES) },
  shadows: stringMap(),
  borders: stringMap(),
  radii: stringMap(),
  // Only `modes.dark.palette` is compiled (foundations.ts), so anything else
  // here would be silently ignored — which is precisely what a schema is for.
  modes: {
    type: 'object',
    additionalProperties: false,
    properties: { dark: { type: 'object', additionalProperties: false, properties: { palette: paletteSchema } } },
  },
  typography: stringMap(),
};
const knownFamilies = Array.from(KNOWN_THEME_FAMILIES);
const missingFamilySchemas = knownFamilies.filter((family) => !familySchemas[family]);
if (missingFamilySchemas.length) {
  // A family added to KNOWN_THEME_FAMILIES without a shape here would silently
  // become "anything goes" in the schema. Fail the generator instead.
  throw new Error(`generate-language-artifacts: no JSON Schema shape for theme ${missingFamilySchemas.length === 1 ? 'family' : 'families'} ${missingFamilySchemas.join(', ')}. Add one next to the others in familySchemas.`);
}
const extraFamilySchemas = Object.keys(familySchemas).filter((family) => !KNOWN_THEME_FAMILIES.has(family));
if (extraFamilySchemas.length) {
  throw new Error(`generate-language-artifacts: JSON Schema describes ${extraFamilySchemas.join(', ')}, which KNOWN_THEME_FAMILIES does not list.`);
}
const themeSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://uxdsl.io/schema/theme.schema.json',
  title: 'UXDSL theme',
  description: 'Generated by scripts/generate-language-artifacts.js from the engine constants. Do not edit.',
  type: 'object',
  additionalProperties: false,
  properties: {
    // Declared so a theme may point at this schema without the top-level
    // `additionalProperties: false` rejecting the pointer itself. The runtime
    // validator skips it for the same reason: it is metadata, not a family.
    $schema: { type: 'string', description: 'Path or URL of this schema.' },
    ...Object.fromEntries(knownFamilies.map((family) => [family, familySchemas[family]])),
  },
};
files['packages/postcss-uxdsl/schema/theme.schema.json'] = JSON.stringify(themeSchema, null, 2) + '\n';

for (const [file, content] of Object.entries(files)) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
      console.error(`Generated artifact drift: ${file}`);
      process.exitCode = 1;
    }
  } else fs.writeFileSync(target, content);
}
