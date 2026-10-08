#!/usr/bin/env node
'use strict';

// What the "UXDSL you write / CSS you get" panels of the site show is real compiler output,
// not text somebody typed.
//
// Each example below is a theme excerpt and a .uxdsl source (inline, or a file of the site
// — paradigm/card.uxdsl is the home page's example and also the card inside its resizable
// frame). This script compiles each one with `compile()` from `uxdsl`, the pipeline
// `uxdsl build` runs, against the excerpt merged over the base theme, and writes
// src/generated/examples.json: the excerpt, the source, and an excerpt of the output —
// every rule the source produced, plus the `:root` declarations of the tokens the example
// is about (with their @media wrappers), so the ladder a token compiles to is visible
// without the other few hundred theme variables.
//
//   node scripts/capture-examples.js          rewrite the JSON file
//   node scripts/capture-examples.js --check  fail when it differs from a fresh compile
//
// `--check` runs in `npm test`; `npm run uxdsl:build` rewrites it, so a build always shows
// what the current compiler produces.

const fs = require('node:fs');
const path = require('node:path');

const PLAYGROUND = path.resolve(__dirname, '..');
const OUT = path.join(PLAYGROUND, 'src/generated/examples.json');
const CHECK = process.argv.includes('--check');

const uxdslRoot = path.dirname(require.resolve('uxdsl/package.json', { paths: [PLAYGROUND] }));
const postcss = require(require.resolve('postcss', { paths: [uxdslRoot] }));
const { compile, resolveTheme } = require('uxdsl');

const file = (rel) => ({ path: rel, text: fs.readFileSync(path.join(PLAYGROUND, rel), 'utf8') });
const json = (value) => ({ path: 'uxdsl.theme.json', text: JSON.stringify(value, null, 2) });
const uxdsl = (text, name = 'example.uxdsl') => ({ path: name, text });

/**
 * id: how a page asks for it. theme: the excerpt shown (merged over the base theme to
 * compile). source: the .uxdsl shown. tokens: the custom properties whose :root ladder the
 * output excerpt keeps.
 */
const EXAMPLES = [
  {
    id: 'paradigm',
    theme: file('paradigm/theme.json'),
    source: file('paradigm/card.uxdsl'),
    tokens: ['--uxdsl__density__4', '--uxdsl__typography__h2-font-size'],
  },
  {
    // What `uxdsl init` writes into src/styles.uxdsl, compiled with no theme file at all.
    id: 'quick-start',
    theme: json({}),
    source: uxdsl('.example {\n  @ds-surface(contained);\n  padding: density(3);\n}\n', 'src/styles.uxdsl'),
    tokens: ['--uxdsl__density__3'],
  },
  {
    id: 'breakpoints',
    theme: json({ breakpoints: { xs: 0, sm: 480, md: 800, lg: 1024, xl: 1280 } }),
    source: uxdsl('.layout {\n  display: flex;\n  flex-direction: xs(column) md(row);\n  gap: density(3);\n}\n'),
    tokens: ['--uxdsl__density__3'],
  },
  {
    id: 'spacing',
    theme: json({ spacing: { 4: '0.75rem', 5: '1rem', 6: '1.5rem' }, densities: { 4: 'xs(space(4)) md(space(5)) xl(space(6))' } }),
    source: uxdsl('.card { padding: density(4); }\n.toolbar { gap: space(4); }\n'),
    tokens: ['--uxdsl__space__4', '--uxdsl__space__5', '--uxdsl__space__6', '--uxdsl__density__4'],
  },
  {
    id: 'colors',
    theme: json({
      colors: { blue: { 500: '#3b82f6', 700: '#1d4ed8' } },
      palette: { primary: { main: 'color(blue.700)', contrast: 'color(white)' } },
      modes: { dark: { palette: { primary: { main: 'color(blue.500)', contrast: 'color(black)' } } } },
    }),
    source: uxdsl('.cta {\n  background: palette(primary.main);\n  color: palette(primary.contrast);\n}\n.swatch { background: color(blue.700); }\n.scrim { background: color(black, 0.5); }\n'),
    tokens: ['--uxdsl__color__blue-500', '--uxdsl__color__blue-700', '--uxdsl__palette__primary-main', '--uxdsl__palette__primary-contrast'],
  },
  {
    id: 'typography',
    theme: json({ typography_details: { h2: { fontSize: 'xs(space(6)) md(space(7)) xl(space(9))', lineHeight: 'xs(1.25) md(1.3)' } } }),
    source: uxdsl('.section-title { @ds-typo(h2); }\n'),
    tokens: ['--uxdsl__typography__h2-font-size', '--uxdsl__typography__h2-line-height'],
  },
  {
    id: 'borders',
    theme: json({ borders: { 1: 'xs(1px solid palette(divider.main)) md(2px solid palette(divider.main))' }, radii: { 2: 'xs(space(2)) md(space(3))' } }),
    source: uxdsl('.card {\n  border: border(1);\n  border-radius: radius(2);\n}\n.chip { border-radius: radius(pill); }\n.avatar { border-radius: radius(circle); }\n'),
    tokens: ['--uxdsl__border__1', '--uxdsl__radius__2'],
  },
  {
    id: 'shadows',
    theme: json({ shadows: { 2: 'xs(0 1px 2px rgba(0, 0, 0, 0.12)) md(0 4px 12px rgba(0, 0, 0, 0.16))' } }),
    source: uxdsl('.card { box-shadow: shadow(2); }\n.flat { box-shadow: shadow(0); }\n'),
    tokens: ['--uxdsl__shadow__0', '--uxdsl__shadow__2'],
  },
  {
    id: 'surfaces',
    theme: json({ surfaces: { contained: { shadow: 'xs(shadow(1)) md(shadow(3))' } } }),
    source: uxdsl('.card { @ds-surface(contained); }\n.notice { @ds-surface(outlined info 2); }\n'),
    tokens: ['--uxdsl__surface__contained-shadow'],
  },
  {
    id: 'buttons',
    theme: json({ buttons: { checkout: { surface: 'contained', base: { padding: 'density(3)' }, states: { hover: { bg: 'tone(dark)' } } } } }),
    source: uxdsl('.checkout { @ds-button(checkout); }\n'),
    tokens: ['--uxdsl__button__checkout-base-padding', '--uxdsl__button__checkout-hover-bg'],
  },
  {
    id: 'inputs',
    theme: json({ inputs: { search: { surface: 'outlined', base: { placeholder: 'palette(neutral.dark)' }, states: { invalid: { border: '2px solid palette(error.main)' } } } } }),
    source: uxdsl('.search { @ds-input(search); }\n'),
    tokens: ['--uxdsl__input__search-base-placeholder', '--uxdsl__input__search-invalid-border'],
  },
];

const isThemeRule = (rule) => /:root|\[data-theme/.test(rule.selector);

/** Keeps the example's own rules and the named tokens' theme declarations. */
function excerpt(root, tokens) {
  const keep = (container) => {
    container.each((node) => {
      if (node.type === 'comment' || (node.type === 'atrule' && node.name === 'import')) { node.remove(); return; }
      if (node.type === 'rule' && isThemeRule(node)) {
        node.each((decl) => { if (decl.type !== 'decl' || !tokens.includes(decl.prop)) decl.remove(); });
        if (!node.nodes.length) node.remove();
        return;
      }
      if (node.type === 'atrule' && node.nodes) {
        keep(node);
        if (!node.nodes.length) node.remove();
      }
    });
  };
  keep(root);
  return root;
}

/** One declaration per line; a rule with a single declaration on one line. */
function print(container, indent = '') {
  const lines = [];
  container.each((node) => {
    if (node.type === 'rule') {
      const decls = node.nodes.filter((d) => d.type === 'decl').map((d) => `${d.prop}: ${d.value}${d.important ? ' !important' : ''};`);
      const selector = node.selector.replace(/\s*\n\s*/g, ' ');
      if (decls.length <= 1) lines.push(`${indent}${selector} { ${decls.join('')} }`);
      else lines.push(`${indent}${selector} {`, ...decls.map((d) => `${indent}  ${d}`), `${indent}}`);
    } else if (node.type === 'atrule') {
      const inner = print(node, `${indent}  `);
      const oneLine = inner.length === 1 && inner[0].length + node.params.length + indent.length < 90;
      if (oneLine) lines.push(`${indent}@${node.name} ${node.params} { ${inner[0].trim()} }`);
      else lines.push(`${indent}@${node.name} ${node.params} {`, ...inner, `${indent}}`);
    }
  });
  return lines;
}

async function captureOne(example) {
  const theme = JSON.parse(example.theme.text);
  const from = path.join(PLAYGROUND, example.source.path);
  const { css, warnings } = await compile({ source: example.source.text, from }, { theme });
  if (warnings && warnings.length) throw new Error(`${example.id}: the compiler warned:\n${warnings.map((w) => w.text).join('\n')}`);
  const output = print(excerpt(postcss.parse(css), example.tokens)).join('\n');
  for (const token of example.tokens) if (!output.includes(token)) throw new Error(`${example.id}: the output defines no ${token}`);
  return {
    id: example.id,
    themePath: example.theme.path,
    theme: example.theme.text.trim(),
    sourcePath: example.source.path,
    source: example.source.text.trim(),
    output,
    tokens: example.tokens,
    breakpoints: resolveTheme(theme).breakpoints,
    bytes: Buffer.byteLength(css),
  };
}

async function main() {
  const examples = {};
  for (const example of EXAMPLES) examples[example.id] = await captureOne(example);
  const text = `${JSON.stringify({ generatedBy: 'packages/playground-nextjs/scripts/capture-examples.js — do not edit; run it to refresh', examples }, null, 2)}\n`;
  if (CHECK) {
    if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== text) {
      console.error('Stale compiled examples: src/generated/examples.json no longer matches what the compiler produces.\nRun: node packages/playground-nextjs/scripts/capture-examples.js');
      process.exitCode = 1;
      return;
    }
    console.log(`Compiled examples are up to date (${EXAMPLES.length}).`);
    return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(PLAYGROUND, OUT)} (${EXAMPLES.length} examples)`);
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
