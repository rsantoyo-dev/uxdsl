#!/usr/bin/env node
'use strict';

/**
 * Compiles the same 5 entries MIG-07's consumer fixture uses (1 theme +
 * 4 CSS-Module-style panels) with MIG-07's freshly installed tarball
 * into real files a
 * Next.js app can import: styles/theme.css (global, no CSS Modules) and
 * styles/panel-*.module.css (CSS Modules: no `@uxdsl theme;`, so no
 * `:root`). Then the installed CLI builds styles/panel.module.uxdsl (Dart
 * Sass: `@use "sass:math"`, `$variables`, nesting with `&__title`) into
 * styles/panel.generated.module.css, from uxdsl-cli/uxdsl.config.cjs and the
 * theme file next to it.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const FIXTURE_DIR = __dirname;
const MIG07_DIR = path.resolve(FIXTURE_DIR, '..', 'mig07-consumer');
const STYLES_DIR = path.join(FIXTURE_DIR, 'styles');
// The CLI's project: its build config and theme file. They sit in their own
// directory because a theme file at the fixture's root would be discovered by
// browser-import-order.js, which compiles with the plugin's theme discovery.
const CLI_PROJECT_DIR = path.join(FIXTURE_DIR, 'uxdsl-cli');
const CLI_MODULE = path.join(STYLES_DIR, 'panel.generated.module.css');

const installedRequire = require('module').createRequire(path.join(MIG07_DIR, 'package.json'));
const plugin = installedRequire('uxdsl/postcss');
const postcss = installedRequire('postcss');
const uxdsl = plugin.default || plugin;

// The plugin takes no theme switch: theme.uxdsl writes `@uxdsl theme;`, so
// it alone emits the theme.
async function compile(source, theme) {
  const result = await postcss([uxdsl({ theme })]).process(source, { from: undefined });
  return result.css;
}

async function main() {
  const theme = JSON.parse(fs.readFileSync(path.join(MIG07_DIR, 'theme.json'), 'utf8'));
  fs.mkdirSync(STYLES_DIR, { recursive: true });

  const themeSource = fs.readFileSync(path.join(MIG07_DIR, 'entries', 'theme.uxdsl'), 'utf8');
  const themeCss = await compile(themeSource, theme);
  fs.writeFileSync(path.join(STYLES_DIR, 'theme.css'), themeCss);

  const panels = ['panel-surface', 'panel-button', 'panel-input', 'panel-border'];
  for (const panel of panels) {
    const source = fs.readFileSync(path.join(MIG07_DIR, 'entries', `${panel}.uxdsl`), 'utf8');
    const css = await compile(source, theme);
    fs.writeFileSync(path.join(STYLES_DIR, `${panel}.module.css`), css);
  }

  console.log(`Compiled theme.css + ${panels.length} panel .module.css files into ${path.relative(process.cwd(), STYLES_DIR)}/`);

  // The installed CLI, as a Next.js project runs it beside `next build`.
  fs.rmSync(CLI_MODULE, { force: true });
  const cli = path.join(path.dirname(installedRequire.resolve('uxdsl/package.json')), 'bin', 'uxdsl.js');
  const built = spawnSync(process.execPath, [cli, 'build'], { cwd: CLI_PROJECT_DIR, encoding: 'utf8' });
  process.stdout.write(built.stdout || '');
  if (built.status !== 0) throw new Error(`uxdsl build exited ${built.status}:\n${built.stderr}`);
  if (/\[uxdsl\] Warning/.test(built.stderr || '')) throw new Error(`uxdsl build warned:\n${built.stderr}`);
  const moduleCss = fs.readFileSync(CLI_MODULE, 'utf8');
  if (/:root/.test(moduleCss)) throw new Error(`${path.relative(FIXTURE_DIR, CLI_MODULE)} holds :root; a CSS Module must not`);
  if (!moduleCss.includes('.panel__title')) throw new Error(`${path.relative(FIXTURE_DIR, CLI_MODULE)} has no .panel__title rule:\n${moduleCss}`);
  console.log(`The installed CLI built ${path.relative(FIXTURE_DIR, CLI_MODULE)} (${Buffer.byteLength(moduleCss)} bytes, no :root).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
