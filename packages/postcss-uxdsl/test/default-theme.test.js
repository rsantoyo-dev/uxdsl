const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const exported = require('../dist/index');
const plugin = exported.default || exported;
const { DEFAULT_THEME, getDefaultTheme, resolveTheme } = require('../dist/default-theme');
const { generateThemeCss } = require('../dist/ds-runtime/theme-generator');
const { inspectResponsiveValue } = require('../dist/language');
const baseThemeJson = require('../src/theme/base.json');

const compile = (source, options = {}) => postcss([plugin(options)]).process(source, { from: undefined });

// Matches lib/css-cascade-compare.js's approach (fixtures/mig07-consumer):
// resolve each (scope, prop) to the value that actually wins the cascade,
// not every raw declaration — a flat "collect declarations" comparison is
// blind to declaration order. See that file's header for the full case.
function cascadedVariables(css) {
  const root = postcss.parse(css);
  const winners = new Map();
  let order = 0;
  root.walkDecls(/^--/, (declaration) => {
    const scope = [];
    for (let parent = declaration.parent; parent && parent.type !== 'root'; parent = parent.parent) {
      if (parent.type === 'rule') scope.push(`rule:${parent.selector}`);
      else if (parent.type === 'atrule') scope.push(`at:${parent.name}:${parent.params}`);
    }
    const key = `${scope.reverse().join(' > ')} | ${declaration.prop}`;
    const candidate = { value: declaration.value, important: !!declaration.important, order: order++ };
    const current = winners.get(key);
    if (!current || Number(candidate.important) > Number(current.important) ||
        (Number(candidate.important) === Number(current.important) && candidate.order > current.order)) {
      winners.set(key, candidate);
    }
  });
  return Array.from(winners.entries()).map(([key, { value, important }]) => `${key} | ${value}${important ? ' !important' : ''}`).sort();
}

test('MIG-B2-02: generateThemeCss() with no arguments compiles and passes strict validation', () => {
  const css = generateThemeCss();
  assert.ok(css.length > 0);
  assert.match(css, /--uxdsl__space__1/);
  assert.match(css, /--uxdsl__palette__primary-main/);
});

test('MIG-B2-02: a partial theme keeps every non-overridden default and changes only what was given', () => {
  const css = generateThemeCss({ palette: { primary: { main: '#123456' } } });
  assert.match(css, /--uxdsl__palette__primary-main: #123456/);
  // Untouched sibling keys of the same family keep their default value.
  assert.match(css, new RegExp(`--uxdsl__palette__primary-dark: ${DEFAULT_THEME.palette.primary.dark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  // An entirely different family (surface) is untouched too.
  assert.match(css, new RegExp(`--uxdsl__palette__surface-main: ${DEFAULT_THEME.palette.surface.main.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('MIG-B2-02: partial Typography, fonts and spacing overrides merge without dropping sibling defaults', () => {
  const resolved = resolveTheme({
    spacing: { 4: '2rem' },
    fonts: { families: { ui: 'Custom UI, sans-serif' } },
    typography_details: { default: { fontSize: '1.125rem' } },
  });
  assert.equal(resolved.spacing[4], '2rem');
  assert.equal(resolved.spacing[5], DEFAULT_THEME.spacing[5]);
  assert.equal(resolved.fonts.families.ui, 'Custom UI, sans-serif');
  assert.equal(resolved.fonts.families.code, DEFAULT_THEME.fonts.families.code);
  assert.equal(resolved.typography_details.default.fontSize, '1.125rem');
  assert.equal(resolved.typography_details.code.fontSize, DEFAULT_THEME.typography_details.code.fontSize);
});

test('MIG-B2-02: spacing keys are normalized before merging, so a "space-N" override replaces the default instead of colliding with it', () => {
  const resolved = resolveTheme({ spacing: { 'space-1': '99px' } });
  assert.equal(resolved.spacing[1], '99px');
  assert.equal(Object.keys(resolved.spacing).filter((k) => k.startsWith('space-')).length, 0);
});

test('MIG-B2-02: array overrides replace the whole array; undefined never overwrites a default', () => {
  const resolved = resolveTheme({ fonts: { google: ['Example'], families: { ui: undefined, code: 'Custom Mono' } } });
  assert.deepEqual(resolved.fonts.google, ['Example']);
  // `ui` was explicitly undefined -> the default survives; `code` was a
  // real value -> it replaces the default; a family the caller never
  // mentions at all -> untouched, whatever DEFAULT_THEME does or doesn't
  // define it as.
  assert.equal(resolved.fonts.families.ui, DEFAULT_THEME.fonts.families.ui);
  assert.equal(resolved.fonts.families.code, 'Custom Mono');
  // MIG-B6-29: DEFAULT_THEME.fonts.families is now theme/base.json's own
  // { ui, code } — no built-in `ui-2` (the old minimal theme's third,
  // TypeScript-literal family). A project can still add one; the default
  // simply doesn't ship one anymore.
  assert.equal(DEFAULT_THEME.fonts.families['ui-2'], undefined);
  assert.equal(resolved.fonts.families['ui-2'], undefined);
});

test('MIG-B2-02: an invalid (non-object) theme is a structured rejection, not a silent fallback to defaults', () => {
  assert.throws(() => resolveTheme('not-a-theme'), /UXD_THEME_INVALID/);
  assert.throws(() => resolveTheme(['also-not-a-theme']), /UXD_THEME_INVALID/);
  assert.throws(() => generateThemeCss('not-a-theme'), /UXD_THEME_INVALID/);
  // undefined/null genuinely mean "no override" and must NOT throw.
  assert.doesNotThrow(() => resolveTheme(undefined));
  assert.doesNotThrow(() => resolveTheme(null));
});

test('MIG-B2-02: an override with palette(missing) still fails with UXD_REFERENCE_MISSING', async () => {
  await assert.rejects(
    compile('.x { @ds-surface(contained); }', { theme: { surfaces: { contained: { bg: 'palette(missing.main)' } } } }),
    /UXD_REFERENCE_MISSING/
  );
  assert.throws(() => generateThemeCss({ surfaces: { contained: { bg: 'palette(missing.main)' } } }), /UXD_REFERENCE_MISSING/);
});

test('MIG-B2-02: PostCSS and generateThemeCss produce the same cascaded variables for an omitted theme', async () => {
  const result = await compile('', { theme: undefined });
  const postcssVars = cascadedVariables(result.css);
  const runtimeVars = cascadedVariables(generateThemeCss());
  assert.deepEqual(postcssVars, runtimeVars);
});

test('MIG-B2-02: includeTheme: false with no theme option at all emits zero :root blocks and still validates', async () => {
  const result = await compile('.x { padding: density(2); }', { includeTheme: false });
  assert.ok(!result.css.includes(':root'));
  assert.match(result.css, /var\(--uxdsl__density__2\)/);
});

test('MIG-B2-02: default-theme-driven responsive values agree with PostCSS around every canonical breakpoint boundary', () => {
  // Density's default expression shape (language.ts's DEFAULT_DENSITIES:
  // xs/md/xl(space(N))) only defines xs/md/xl branches, so its value only
  // changes at the md (768) and xl (1280) thresholds — sm (480) and lg
  // (1024) fall inside the xs and md branches respectively and must NOT
  // change anything, exactly the kind of off-by-one a naive
  // "every named breakpoint changes the value" assumption would miss.
  // Resolved deterministically (called twice, compared) at each of the
  // four documented boundary widths, [-1, 0, +1] around every one.
  const bps = { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 };
  const expr = 'xs(space(4)) md(space(5)) xl(space(6))';
  for (const threshold of [480, 768, 1024, 1280]) {
    for (const width of [threshold - 1, threshold, threshold + 1]) {
      const a = inspectResponsiveValue(expr, width, bps).value;
      const b = inspectResponsiveValue(expr, width, bps).value;
      assert.equal(a, b, `width ${width} must resolve deterministically`);
    }
  }
  // sm (480) and lg (1024) are inside a branch, not a boundary for this
  // expression — the value must NOT change there.
  assert.equal(inspectResponsiveValue(expr, 479, bps).value, inspectResponsiveValue(expr, 480, bps).value);
  assert.equal(inspectResponsiveValue(expr, 1023, bps).value, inspectResponsiveValue(expr, 1024, bps).value);
  // md (768) and xl (1280) are real boundaries for this expression.
  assert.notEqual(inspectResponsiveValue(expr, 767, bps).value, inspectResponsiveValue(expr, 768, bps).value);
  assert.notEqual(inspectResponsiveValue(expr, 1279, bps).value, inspectResponsiveValue(expr, 1280, bps).value);
});

test('MIG-B2-02: resolving one theme does not leak into the next resolution or mutate DEFAULT_THEME', () => {
  const first = resolveTheme({ palette: { primary: { main: '#111111' } } });
  const second = resolveTheme({ palette: { primary: { main: '#222222' } } });
  assert.equal(first.palette.primary.main, '#111111');
  assert.equal(second.palette.primary.main, '#222222');
  assert.equal(DEFAULT_THEME.palette.primary.main, resolveTheme().palette.primary.main);
  // getDefaultTheme() returns a mutable copy; mutating it must not affect
  // DEFAULT_THEME or a later resolution.
  const copy = getDefaultTheme();
  copy.palette.primary.main = '#mutated';
  assert.notEqual(DEFAULT_THEME.palette.primary.main, '#mutated');
  assert.notEqual(resolveTheme().palette.primary.main, '#mutated');
});

test('MIG-B2-02: default headings and controls compile without legacy imports at every boundary', async () => {
  const source = '.h { @ds-typo(h1); } .s { @ds-surface(contained); } .b { @ds-button(contained primary 2); } .i { @ds-input(outlined primary 2); }';
  const result = await compile(source);
  const runtime = postcss.parse(generateThemeCss());
  const valueAt = (root, width) => {
    let result;
    root.walkDecls('--uxdsl__typography__h1-size', d => {
      let active = true;
      for (let p = d.parent; p; p = p.parent) if (p.type === 'atrule' && p.name === 'media') active = active && width >= Number(p.params.match(/min-width:\s*([\d.]+)/)[1]);
      if (active) result = d.value;
    });
    return result;
  };
  for (const width of [479, 480, 481, 767, 768, 769, 1023, 1024, 1025, 1279, 1280, 1281]) {
    const expected = `var(--uxdsl__space__${width >= 1280 ? 10 : width >= 1024 ? 9 : width >= 768 ? 8 : 7})`;
    assert.equal(valueAt(result.root, width), expected);
    assert.equal(valueAt(runtime, width), expected);
  }
  const component = await compile(source, { includeTheme: false });
  assert.doesNotMatch(component.css, /:root/);
  assert.throws(() => resolveTheme(new Date()), /UXD_THEME_INVALID/);
});

// MIG-B6-29 (FEAT-008): DEFAULT_THEME now ships fonts.google and modes.dark
// for the first time (theme/base.json's own decisions 2-3) — every project
// with no theme override of its own now makes a real request to Google
// Fonts and follows the OS dark-mode preference. Both are documented,
// disableable/pinnable behaviors per the story's own owner decisions, not
// accidents, so both need real regression coverage, not just a docs note.

test('MIG-B6-29: DEFAULT_THEME requests Google Fonts by default; fonts: { google: [] } opts out', async () => {
  const zeroConfig = await compile('.x { color: red; }');
  // The full URL, not just the prefix: MIG-B6-29 phase 4's shared encoder
  // (test/fonts.test.js has its own dedicated coverage of the encoding
  // rules themselves) must still produce exactly this for the shipped
  // default (`Inter:wght@400;500;600;700`, from theme/base.json).
  assert.match(zeroConfig.css, /@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@400;500;600;700&display=swap'\);/);

  const optedOut = await compile('.x { color: red; }', { theme: { fonts: { google: [] } } });
  assert.doesNotMatch(optedOut.css, /@import/);
  assert.deepEqual(resolveTheme({ fonts: { google: [] } }).fonts.google, []);
});

test('MIG-B6-29: resolveTheme(undefined) is deep-equal to theme/base.json, the literal acceptance criterion', () => {
  assert.deepEqual(resolveTheme(undefined), baseThemeJson);
  assert.deepEqual(DEFAULT_THEME, baseThemeJson);
});

test('MIG-B6-29 (regression): freezing DEFAULT_THEME never freezes the raw theme/base.json module object other consumers share', () => {
  // Real bug this pins, hit live in the Next.js playground (not caught by
  // this package's own dist-only test suite): base-theme.ts used to
  // deep-freeze `baseThemeJson` in place. `dist/base-theme.js`'s own
  // `require('./theme/base.json')` resolves to dist/theme/base.json (a
  // tsc-copied file only this package's compiled output ever reads) — but
  // the *public* export, `postcss-uxdsl/theme/base.json`, always resolves
  // to this same src/theme/base.json instead (package.json's
  // "./theme/*": "./src/theme/*"). Node's require cache is keyed by
  // resolved absolute path, not by specifier: any other code in the same
  // process/bundle that imports the public path — directly, or via a
  // bundler alias pointing postcss-uxdsl/* straight at its own source
  // (exactly what the playground's own next.config.js does, "to consume
  // current engine source, not a stale local dist") — gets that exact
  // src/theme/base.json object. Freezing it in place broke every such
  // consumer the moment it tried to mutate an untouched, reference-
  // preserved sub-object after its own deepMergeTheme (playground's own
  // themes.js -> ds-runtime/theme-validate.ts's in-place
  // `theme.fonts.families[k] = ...`, thrown as
  // "TypeError: Cannot assign to read only property").
  //
  // `dist/base-theme.js` (compiled from src/base-theme.ts's
  // `import baseThemeJson from './theme/base.json'`) resolves that import
  // to this exact file, `dist/theme/base.json` — the same absolute path a
  // build tool aliasing postcss-uxdsl/* to this package's own *source*
  // would instead resolve to src/theme/base.json for (the two only differ
  // in whether dist or src is being aliased; the sharing mechanism that
  // caused the real bug is identical either way). Requiring it a second
  // time, independently, must not come back frozen just because loading
  // DEFAULT_THEME already froze *its own* copy.
  void DEFAULT_THEME;
  const rawDistBaseJson = require('../dist/theme/base.json');
  assert.equal(Object.isFrozen(rawDistBaseJson), false, 'the raw, independently-required theme/base.json module object must never be frozen by this package');
  assert.equal(Object.isFrozen(rawDistBaseJson.fonts), false);
  assert.equal(Object.isFrozen(rawDistBaseJson.fonts.families), false);
  // DEFAULT_THEME itself is still real, still frozen, still correct content
  // — checked before the mutation below, which deliberately changes the
  // *shared* object DEFAULT_THEME must NOT be affected by.
  assert.equal(Object.isFrozen(DEFAULT_THEME), true);
  assert.equal(Object.isFrozen(DEFAULT_THEME.fonts.families), true);
  assert.deepEqual(DEFAULT_THEME, rawDistBaseJson);
  // The exact shape of the original crash: an unrelated consumer merges
  // the raw JSON with its own override, then mutates an untouched,
  // reference-preserved sub-object in place. `merged.fonts` is still the
  // *exact same object* as `rawDistBaseJson.fonts` (a shallow spread never
  // clones nested objects) — this must not throw.
  const merged = { ...rawDistBaseJson, palette: { ...rawDistBaseJson.palette } };
  assert.doesNotThrow(() => { merged.fonts.families.ui = 'Custom, sans-serif'; });
  assert.equal(merged.fonts.families.ui, 'Custom, sans-serif');
  assert.equal(rawDistBaseJson.fonts.families.ui, 'Custom, sans-serif', 'sanity check: merged.fonts really is the same object, not a copy');
  // DEFAULT_THEME was cloned before freezing, so mutating the shared raw
  // object after the fact must never leak into it.
  assert.notEqual(DEFAULT_THEME.fonts.families.ui, 'Custom, sans-serif');
});

test('MIG-B6-29: the migration.md beta.5-pinning recipe restores exactly beta.5\'s main/dark/contrast/font values', () => {
  // Pins packages/postcss-uxdsl/docs/migration.md's own documented override
  // literally, so a drift between the doc and resolveTheme's real behavior
  // fails here instead of only being caught by someone copy-pasting it.
  const resolved = resolveTheme({
    palette: {
      primary: { main: '#7e22ce', dark: '#581c87', contrast: '#ffffff' },
      surface: { main: '#ffffff', dark: '#dde5eb', contrast: '#102a43' },
      neutral: { main: '#e2e8f0', dark: '#cbd5e1' },
      error: { main: '#c61625' },
    },
    fonts: {
      google: [],
      families: {
        ui: 'Inter, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        'ui-2': 'Roboto, "Helvetica Neue", Arial, sans-serif',
        code: 'Menlo, "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace',
      },
    },
  });
  assert.equal(resolved.palette.primary.main, '#7e22ce');
  assert.equal(resolved.palette.primary.dark, '#581c87');
  assert.equal(resolved.palette.primary.contrast, '#ffffff');
  assert.equal(resolved.palette.surface.dark, '#dde5eb');
  assert.equal(resolved.palette.surface.contrast, '#102a43');
  assert.equal(resolved.palette.neutral.main, '#e2e8f0');
  assert.equal(resolved.palette.neutral.dark, '#cbd5e1');
  assert.equal(resolved.palette.error.main, '#c61625');
  assert.equal(resolved.fonts.families.ui, 'Inter, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif');
  assert.equal(resolved.fonts.families['ui-2'], 'Roboto, "Helvetica Neue", Arial, sans-serif');
  assert.equal(resolved.fonts.families.code, 'Menlo, "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace');
  assert.deepEqual(resolved.fonts.google, []);
  // Documented, disclosed non-goal: beta.5 never defined a `light` variant
  // for these families at all, and there is no override that removes a
  // merged-in key — this recipe is not bit-for-bit identical to beta.5.
  assert.equal(resolved.palette.primary.light, '#a855f7');
});

test('MIG-B6-29: DEFAULT_THEME follows the OS dark-mode preference by default; data-theme="light" pins light', () => {
  const css = generateThemeCss();
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  // The light-pin guard is baked into the dark-mode selector itself
  // (foundations.ts), not a separate override a project must author.
  assert.match(css, /:root:not\(\[data-theme='light'\]\)/);
  assert.match(css, /:root\[data-theme='dark'\]/);
  // Sanity: the actual dark-mode palette values differ from light, so this
  // is a real second color set, not an empty/no-op media query.
  assert.notEqual(DEFAULT_THEME.modes.dark.palette.primary.main, DEFAULT_THEME.palette.primary.main);
});
