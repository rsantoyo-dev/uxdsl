'use strict';

// compile() resolves the theme once per compilation: from `theme` when it is
// given, otherwise from the theme file it discovers in `configRoot` (the
// working directory by default), asynchronously, unless `discoverTheme` is
// false. The discovered file and the local modules it requires are listed in
// `dependencies`.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const postcss = require('postcss');

const DIST = path.resolve(__dirname, '../../dist');
const config = require(path.join(DIST, 'config'));
const { compile } = require(path.join(DIST, 'compile'));
const uxdsl = require(path.join(DIST, 'plugin'));

function project(t, files) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-compile-discovery-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  return dir;
}

/** Counts calls of the two discovery functions compile() and the plugin read from dist/config. */
function countDiscoveries(t) {
  const counts = { async: 0, sync: 0 };
  const { discoverThemeAsync, discoverThemeSync } = config;
  config.discoverThemeAsync = (...args) => { counts.async += 1; return discoverThemeAsync(...args); };
  config.discoverThemeSync = (...args) => { counts.sync += 1; return discoverThemeSync(...args); };
  t.after(() => {
    config.discoverThemeAsync = discoverThemeAsync;
    config.discoverThemeSync = discoverThemeSync;
  });
  return counts;
}

/** Runs `fn` with the working directory set to `dir`. */
async function inDirectory(t, dir, fn) {
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(cwd);
  }
}

const THEME_FILES = {
  'theme/uxdsl.theme.cjs': "const tokens = require('./tokens.cjs');\nmodule.exports = { spacing: { 2: tokens.two } };\n",
  'theme/tokens.cjs': "module.exports = { two: '9px' };\n",
  'src/a.uxdsl': '@uxdsl theme;\n.a { padding: space(2); }\n',
};

test('MIG-B9-21: compile() discovers the theme once, from configRoot, and lists its require tree in dependencies', async (t) => {
  const dir = project(t, THEME_FILES);
  const entry = path.join(dir, 'src/a.uxdsl');
  const counts = countDiscoveries(t);
  // The working directory is elsewhere: only configRoot decides.
  const result = await inDirectory(t, path.join(dir, 'src'), () => compile({ entry }, { configRoot: path.join(dir, 'theme') }));
  assert.match(result.css, /--uxdsl__space__2: 9px/);
  assert.deepEqual(result.dependencies, [entry, path.join(dir, 'theme/uxdsl.theme.cjs'), path.join(dir, 'theme/tokens.cjs')]);
  assert.deepEqual(counts, { async: 1, sync: 0 });

  // Without configRoot, the working directory is searched, once.
  counts.async = 0;
  const fromCwd = await inDirectory(t, path.join(dir, 'theme'), () => compile({ entry }));
  assert.match(fromCwd.css, /--uxdsl__space__2: 9px/);
  assert.deepEqual(counts, { async: 1, sync: 0 });

  // Negative controls: discoverTheme: false and a given theme read no theme file.
  counts.async = 0;
  const off = await compile({ entry }, { configRoot: path.join(dir, 'theme'), discoverTheme: false });
  assert.match(off.css, /--uxdsl__space__2: 0\.25rem/);
  assert.deepEqual(off.dependencies, [entry]);
  const given = await compile({ entry }, { configRoot: path.join(dir, 'theme'), theme: {} });
  assert.match(given.css, /--uxdsl__space__2: 0\.25rem/);
  assert.deepEqual(given.dependencies, [entry]);
  assert.deepEqual(counts, { async: 0, sync: 0 });
});

test('MIG-B9-21: compile() without a theme accepts an async theme factory, as the adapters do; the plugin alone still refuses it', async (t) => {
  const dir = project(t, {
    'uxdsl.theme.cjs': "module.exports = async () => ({ spacing: { 2: '7px' } });\n",
    'a.uxdsl': '@uxdsl theme;\n.a { padding: space(2); }\n',
  });
  const result = await compile({ entry: path.join(dir, 'a.uxdsl') }, { configRoot: dir });
  assert.match(result.css, /--uxdsl__space__2: 7px/);
  // Negative control: the plugin used alone discovers synchronously and refuses it.
  await assert.rejects(
    postcss([uxdsl({ configRoot: dir })]).process('@uxdsl theme;\n.a { padding: space(2); }', { from: path.join(dir, 'a.css') }),
    /exports an async function/
  );
});
