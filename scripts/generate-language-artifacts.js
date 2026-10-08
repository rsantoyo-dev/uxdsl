const { DEFAULT_INPUTS } = require('../packages/uxdsl/dist/inputs');
const { DEFAULT_BUTTONS } = require('../packages/uxdsl/dist/buttons');
// The compiled browser-safe language module is the authoritative source.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { DEFAULT_DENSITIES, LANGUAGE_COMPLETIONS, getToneFamilies } = require('../packages/uxdsl/dist/language');
const { DEFAULT_RADII } = require('../packages/uxdsl/dist/edges');
const { DEFAULT_SURFACES } = require('../packages/uxdsl/dist/surfaces');
const { DEFAULT_THEME } = require('../packages/uxdsl/dist/default-theme');
const { TYPOGRAPHY_PROPERTIES } = require('../packages/uxdsl/dist/typography');
// MIG-B6-27 (FEAT-008): the JSON Schema is generated from the very constants
// the compiler branches on, so it cannot drift into describing a theme the
// engine would reject (or rejecting one it accepts).
const { KNOWN_THEME_FAMILIES } = require('../packages/uxdsl/dist/entries/engine');
const { SURFACE_PROPERTIES } = require('../packages/uxdsl/dist/surfaces');
const { BUTTON_PROPERTIES, BUTTON_STATES } = require('../packages/uxdsl/dist/buttons');
const { INPUT_PROPERTIES, INPUT_STATES } = require('../packages/uxdsl/dist/inputs');
const { DIRECTIVE_USAGE } = require('../packages/uxdsl/dist/directives');

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
// The usage string of each directive comes from the grammar itself (src/directives.ts).
const directiveDescriptions = {
  'ds-surface': `Applies a shared container role (padding, radius, background, border, shadow) composed from the theme. Optional tone, numeric size and overrides: ${DIRECTIVE_USAGE['ds-surface']}.`,
  'ds-button': `Applies a shared button role and its interaction states (hover, focus, disabled, selected). Optional tone, numeric size and overrides: ${DIRECTIVE_USAGE['ds-button']}.`,
  'ds-input': `Applies a shared field role and its interaction states (focus, invalid, disabled, readonly). Optional tone, numeric size and overrides: ${DIRECTIVE_USAGE['ds-input']}.`,
  'ds-typo': `Applies a shared typography role's responsive font styles: ${DIRECTIVE_USAGE['ds-typo']}.`,
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

const files = {
  'packages/uxdsl-vscode/src/generated-completions.ts': '// Generated by scripts/generate-language-artifacts.js. Do not edit.\nexport const completions = ' + JSON.stringify(fullCompletions, null, 2) + ' as const;\n',
  'packages/uxdsl-vscode/uxdsl.custom-data.json': JSON.stringify(customData, null, 2) + '\n',
  'packages/uxdsl-vscode/syntaxes/uxdsl.tmLanguage.json': JSON.stringify(grammar, null, 2) + '\n',
};
// --- MIG-B6-27 (FEAT-008): theme JSON Schema -------------------------------
//
// Editors read this through `"$schema"` in a `uxdsl.theme.json`, so it has to
// agree with the compiler on exactly two things: which family names exist, and
// which fields each engine accepts. Both come from the engines themselves
// below. The name registries a project extends — palette families, typography
// roles, font family names, role names — stay open, with only a key *pattern*
// enforced; closing them would reject `palette.brand`, which is valid.
//
// Stability phase 1: the patterns are `validateTheme`'s own
// (THEME_NAME_PATTERN, THEME_KEY_PATTERN, THEME_VALUE_PATTERN in
// ds-runtime/theme-validate.ts), so the schema and the compiler reject the
// same names and the same leaves — a number, `null` or object where a string
// belongs, an empty string, `;`/`{`/`}` in a value. What a regex cannot say
// (balanced parentheses, a zero-width base breakpoint, a dangling reference)
// the validator still checks and the schema documents in `description`.
const { THEME_NAME_PATTERN, THEME_KEY_PATTERN, THEME_VALUE_PATTERN } = require('../packages/uxdsl/dist/entries/engine');
const NAME_PATTERN = THEME_NAME_PATTERN.source;
const KEY_PATTERN = THEME_KEY_PATTERN.source;
const leaf = {
  type: 'string',
  minLength: 1,
  pattern: THEME_VALUE_PATTERN.source,
  description: 'A CSS value, a token reference (space(2), palette(primary.main), radius(2), …), a responsive expression (xs(…) md(…)) or var(). Nonempty; no ";", "{" or "}"; parentheses must balance.',
};
const stringMap = (pattern = KEY_PATTERN) => ({
  type: 'object',
  propertyNames: { pattern },
  additionalProperties: leaf,
});
const closedFields = (properties) => ({
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(Object.keys(properties).map((field) => [field, leaf])),
});
const paletteSchema = {
  type: 'object',
  propertyNames: { pattern: NAME_PATTERN },
  // A family needs no `main`: `action` in the base theme has only `disabled`.
  // The main/dark/contrast trio is the *tone* predicate Buttons and Inputs
  // apply, not the definition of a valid family. A family is always an
  // object of variants, never a single color string.
  additionalProperties: stringMap(),
};
const controlSchema = (properties, states) => ({
  type: 'object',
  propertyNames: { pattern: NAME_PATTERN },
  additionalProperties: {
    type: 'object',
    additionalProperties: false,
    properties: {
      surface: leaf,
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
  breakpoints: {
    type: 'object',
    propertyNames: { pattern: NAME_PATTERN },
    additionalProperties: { type: 'number', minimum: 0, description: 'Viewport width in pixels. Widths must be distinct and one breakpoint must be 0.' },
  },
  spacing: stringMap(),
  palette: paletteSchema,
  fonts: {
    type: 'object',
    additionalProperties: false,
    properties: { families: stringMap(NAME_PATTERN), google: { type: 'array', items: { type: 'string', minLength: 1, pattern: '\\S', description: 'A Google Fonts css2 family spec, e.g. "Inter:wght@400;700". Percent-encoded into the @import URL, never emitted as CSS.' } } },
  },
  colors: {
    type: 'object',
    propertyNames: { pattern: NAME_PATTERN },
    // A standalone color (`white`) or a shade scale (`gray.300`).
    additionalProperties: { anyOf: [leaf, stringMap()] },
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
files['packages/uxdsl/schema/theme.schema.json'] = JSON.stringify(themeSchema, null, 2) + '\n';

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
