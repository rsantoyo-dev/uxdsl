#!/usr/bin/env node
'use strict';

/**
 * Compiles the same 5 entries MIG-07's consumer fixture uses (1 theme +
 * 4 CSS-Module-style panels) with the monorepo's own postcss-uxdsl build
 * (not a packaged tarball — that fidelity is MIG-07's job; this fixture is
 * only about the Next.js/css-loader build behavior) into real files a
 * Next.js app can import: styles/theme.css (global, no CSS Modules) and
 * styles/panel-*.module.css (CSS Modules, includeTheme: false, so no
 * `:root`).
 */

const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = __dirname;
const MIG07_DIR = path.resolve(FIXTURE_DIR, '..', 'mig07-consumer');
const PACKAGE_DIR = path.resolve(FIXTURE_DIR, '..', '..', 'packages', 'postcss-uxdsl');
const STYLES_DIR = path.join(FIXTURE_DIR, 'styles');

const plugin = require(PACKAGE_DIR);
const postcss = require(path.join(PACKAGE_DIR, 'node_modules', 'postcss'));
const uxdsl = plugin.default || plugin;

async function compile(source, theme, includeTheme) {
  const result = await postcss([uxdsl({ theme, includeTheme })]).process(source, { from: undefined });
  return result.css;
}

async function main() {
  const theme = JSON.parse(fs.readFileSync(path.join(MIG07_DIR, 'theme.json'), 'utf8'));
  fs.mkdirSync(STYLES_DIR, { recursive: true });

  const themeSource = fs.readFileSync(path.join(MIG07_DIR, 'entries', 'theme.uxdsl'), 'utf8');
  const themeCss = await compile(themeSource, theme, true);
  fs.writeFileSync(path.join(STYLES_DIR, 'theme.css'), themeCss);

  const panels = ['panel-surface', 'panel-button', 'panel-input', 'panel-border'];
  for (const panel of panels) {
    const source = fs.readFileSync(path.join(MIG07_DIR, 'entries', `${panel}.uxdsl`), 'utf8');
    const css = await compile(source, theme, false);
    fs.writeFileSync(path.join(STYLES_DIR, `${panel}.module.css`), css);
  }

  console.log(`Compiled theme.css + ${panels.length} panel .module.css files into ${path.relative(process.cwd(), STYLES_DIR)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
