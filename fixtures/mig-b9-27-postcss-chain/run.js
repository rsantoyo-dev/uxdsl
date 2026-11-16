#!/usr/bin/env node
'use strict';

// uxdsl/postcss in one PostCSS run with the real postcss-nested,
// postcss-simple-vars and tailwindcss/nesting, in both plugin orders, each
// compared with the documented two passes (the other plugin in a pass of its
// own, then uxdsl/postcss). See README.md.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const USAGE = `node fixtures/mig-b9-27-postcss-chain/run.js [--uxdsl <package dir>]

Installs postcss-nested@7.0.2, postcss-simple-vars@7.0.1 and tailwindcss@3.4.19,
and separately postcss-nested@latest, into a temporary directory (network), and
runs each input through uxdsl/postcss and one of them in one PostCSS run, in both
orders. Prints "ok" when the run gives the two passes' CSS, or the error.
Exits 1 when a registered chain does not compile, or when a run gives anything
but the two passes' CSS or the plugin alone's error for its input.

  --uxdsl <dir>  the uxdsl package whose dist/plugin.js runs (default: packages/uxdsl)`;

const PINNED = { 'postcss-nested': '7.0.2', 'postcss-simple-vars': '7.0.1', tailwindcss: '3.4.19' };
const FROM = '/project/src/app.css';

function parseArgs(argv) {
  const options = { uxdsl: path.resolve(__dirname, '../../packages/uxdsl') };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--uxdsl' && argv[index + 1]) options.uxdsl = path.resolve(argv[++index]);
    else throw new Error(`unknown argument ${arg}\n\n${USAGE}`);
  }
  return options;
}

function install(dir, specs) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"private":true}\n');
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error', ...specs], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] });
}

const nested = (inner) => `.phone {\n  &_title {\n    ${inner}\n  }\n}\n`;

/**
 * Each case: the installation, the package and the plugin it exports, the
 * input, its label, and whether it is one of the registered chains (C5), which
 * must compile in both orders. The others are evidence: each gives the two
 * passes' CSS or the plugin alone's error (C4).
 */
function cases() {
  const list = [];
  for (const [install, pkg, plugin] of [['pinned', 'postcss-nested', 'postcss-nested'], ['latest', 'postcss-nested', 'postcss-nested'], ['pinned', 'tailwindcss', 'tailwindcss/nesting']]) {
    list.push({ install, pkg, plugin, source: nested('padding: space(2);'), label: '"&_title {"', registered: install === 'pinned' });
    for (const inner of ['padding: xs(1rem) md(2rem);', '@ds-surface(contained);', '@ds-button(contained);']) {
      list.push({ install, pkg, plugin, source: nested(inner), label: JSON.stringify(`&_title { ${inner} }`), registered: false });
    }
  }
  for (const [source, registered] of [
    ['$gap: 4px;\n.card {\n  padding: $gap;\n  margin: space(2);\n}\n', true],
    ['$n: 2;\n.card {\n  padding: space($n);\n}\n', false],
    ['$pad: space(2);\n.card {\n  padding: $pad;\n}\n', false],
    ['$pad: xs(1rem) md(2rem);\n.card {\n  padding: $pad;\n}\n', false],
  ]) {
    list.push({ install: 'pinned', pkg: 'postcss-simple-vars', plugin: 'postcss-simple-vars', source, label: JSON.stringify(source.split('\n')[0]), registered });
  }
  return list;
}

const describe = (error) => `${error.line}:${error.column} ${String(error.reason || error.message).split(';')[0]}`;
const sameError = (a, b) => a.name === b.name && a.reason === b.reason && a.line === b.line && a.column === b.column;

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  const postcss = require(require.resolve('postcss', { paths: [options.uxdsl] }));
  const exported = require(path.join(options.uxdsl, 'dist/plugin.js'));
  const uxdsl = () => (exported.default || exported)({ discoverTheme: false });
  const normalized = (css) => {
    const root = postcss.parse(css);
    root.cleanRaws();
    return root.toString();
  };
  const run = async (plugins, source) => {
    try {
      return { css: (await postcss(plugins).process(source, { from: FROM })).css };
    } catch (error) {
      return { error };
    }
  };

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-postcss-chain-'));
  try {
    const dirs = { pinned: path.join(work, 'pinned'), latest: path.join(work, 'latest') };
    install(dirs.pinned, Object.entries(PINNED).map(([name, version]) => `${name}@${version}`));
    install(dirs.latest, ['postcss-nested@latest']);
    const version = (where, pkg) => require(require.resolve(`${pkg}/package.json`, { paths: [dirs[where]] })).version;
    for (const [pkg, expected] of Object.entries(PINNED)) {
      if (version('pinned', pkg) !== expected) throw new Error(`${pkg} installed ${version('pinned', pkg)}, not ${expected}`);
    }
    const load = (where, name) => {
      const loaded = require(require.resolve(name, { paths: [dirs[where]] }));
      return loaded.default || loaded;
    };
    console.log(`uxdsl: ${options.uxdsl}`);
    console.log(`postcss ${require(require.resolve('postcss/package.json', { paths: [options.uxdsl] })).version}; postcss-nested latest is ${version('latest', 'postcss-nested')}`);

    let failed = 0;
    for (const entry of cases()) {
      const other = () => load(entry.install, entry.plugin)();
      const first = await run([other()], entry.source);
      const passes = first.error ? first : await run([uxdsl()], first.css);
      const alone = await run([uxdsl()], entry.source);
      // A plugin that resolves in its own Once, listed first, reaches
      // uxdsl/postcss resolved: that run gives the two passes' CSS.
      const flattensFirst = entry.plugin === 'tailwindcss/nesting';
      for (const order of ['other first', 'uxdsl first']) {
        const plugins = order === 'other first' ? [other(), uxdsl()] : [uxdsl(), other()];
        const { css, error } = await run(plugins, entry.source);
        const label = `${entry.plugin} ${version(entry.install, entry.pkg)}, ${order}, ${entry.label}`;
        const asPasses = css !== undefined && passes.css !== undefined && normalized(css) === normalized(passes.css);
        let verdict;
        if (asPasses) verdict = 'ok';
        else if (css !== undefined) verdict = `CSS that differs from the two passes' (${passes.error ? `which fail: ${describe(passes.error)}` : JSON.stringify(passes.css)}): ${JSON.stringify(css)}`;
        else verdict = describe(error);
        const mustCompile = entry.registered || (flattensFirst && order === 'other first' && passes.css !== undefined);
        const allowedError = error && alone.error && sameError(error, alone.error);
        const pass = mustCompile ? asPasses : asPasses || allowedError;
        if (!pass) failed++;
        console.log(`${label}: ${verdict}${pass ? '' : mustCompile ? '  <- FAIL: must give the two passes\' CSS' : '  <- FAIL: neither the two passes\' CSS nor the plugin alone\'s error'}`);
      }
    }
    console.log(failed ? `FAIL: ${failed} run(s)` : 'PASS: every registered chain compiles, and every other run gives the two passes\' CSS or the plugin alone\'s error');
    return failed ? 1 : 0;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArgs, cases };
