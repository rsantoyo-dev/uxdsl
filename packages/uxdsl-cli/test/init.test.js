// MIG-B7-12 (FEAT-009): what `uxdsl init` writes for editor support, run as a
// real subprocess in real temp projects — all four branches (plain, --multi,
// Next.js, Vite).
//
// - The config is type-checked by an editor (JSDoc + `// @ts-check`), without
//   a run-time `require` of postcss-uxdsl.
// - The object it exports is the one `init` wrote before this story, so the
//   compiled CSS and the build log are byte-identical (the control that stops
//   "editor support" from changing a consumer's output).
// - No theme file and no `.vscode/` are scaffolded (step 3: a `$schema`-only
//   `uxdsl.theme.json` adds a "Theme config detected" line to every build;
//   step 5 waits for MIG-B7-05), and nothing existing is ever overwritten.
// - A second run changes nothing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const CLI_BIN = path.join(__dirname, '..', 'bin', 'uxdsl.js');
const POSTCSS_UXDSL_DIR = path.dirname(require.resolve('postcss-uxdsl/package.json'));
const TSC = path.join(fs.realpathSync(POSTCSS_UXDSL_DIR), 'node_modules', 'typescript', 'bin', 'tsc');

// Exactly what `init` wrote before MIG-B7-12 (packages/uxdsl-cli/bin/uxdsl.js
// at dcd8a26). Kept verbatim: it is the byte-identical-output baseline.
const LEGACY_SINGLE = `module.exports = {
  // Entry point for your styles (generated or manual)
  entry: './src/uxdsl-entry.uxdsl',
  // Output CSS file
  outFile: './src/uxdsl.css',
  // Watch patterns for HMR/Rebuilds
  watch: ['src/**/*.uxdsl', 'src/**/*.css']
};
`;
const LEGACY_MULTI = `module.exports = {
  // A theme entry (emits the shared :root definitions once) plus any
  // number of component/CSS-Module entries — includeTheme: false, no
  // :root of their own — compiled together from this one config. Add
  // more entries here as the project grows; see the CLI README's
  // "Multiple entries, one shared theme" section for the full contract.
  builds: [
    { entry: './src/theme.uxdsl', outFile: './src/theme.css' },
    { entry: './src/panel-a.uxdsl', outFile: './src/panel-a.css', includeTheme: false },
  ],
  // Watch patterns for HMR/Rebuilds
  watch: ['src/**/*.uxdsl']
};
`;

const BRANCHES = {
  plain: { args: ['init'], markers: {} },
  multi: { args: ['init', '--multi'], markers: {} },
  next: { args: ['init'], markers: { 'next.config.js': 'module.exports = {};\n' } },
  vite: { args: ['init'], markers: { 'vite.config.js': 'export default {};\n' } },
};

function mkProject(branch) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `uxdsl-init-${branch}-`)));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: `init-${branch}`, version: '0.0.0', private: true }, null, 2));
  for (const [file, content] of Object.entries(BRANCHES[branch].markers)) fs.writeFileSync(path.join(dir, file), content);
  return dir;
}

function run(args, cwd) {
  const r = spawnSync(process.execPath, [CLI_BIN, ...args], { cwd, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Every file under `dir` (node_modules excluded) → sha256. */
function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(dir, full)] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    }
  };
  walk(dir);
  return out;
}

function outFiles(branch) {
  return branch === 'multi' ? ['src/theme.css', 'src/panel-a.css'] : ['src/uxdsl.css'];
}

/** Runs tsc on `file` inside `dir` the way an editor's implicit project
 * would, with postcss-uxdsl resolvable through the project's node_modules. */
function typeCheck(dir, file, { module, moduleResolution }) {
  const nm = path.join(dir, 'node_modules');
  if (!fs.existsSync(path.join(nm, 'postcss-uxdsl'))) {
    fs.mkdirSync(nm, { recursive: true });
    fs.symlinkSync(fs.realpathSync(POSTCSS_UXDSL_DIR), path.join(nm, 'postcss-uxdsl'), 'dir');
  }
  const r = spawnSync(process.execPath, [TSC, '--noEmit', '--allowJs', '--skipLibCheck', '--target', 'es2022', '--module', module, '--moduleResolution', moduleResolution, file], { cwd: dir, encoding: 'utf8' });
  return { status: r.status, output: `${r.stdout}${r.stderr}` };
}

// VS Code's implicit project for a file with no jsconfig (TypeScript >= 5.4)
// is module Preserve + moduleResolution Bundler; Node16 is what a project
// with its own tsconfig for Node would use.
const RESOLUTIONS = [
  { module: 'preserve', moduleResolution: 'bundler' },
  { module: 'node16', moduleResolution: 'node16' },
];

for (const branch of Object.keys(BRANCHES)) {
  test(`MIG-B7-12 [${branch}]: init writes a typed, require-free config exporting the same object as before`, () => {
    const dir = mkProject(branch);
    const r = run(BRANCHES[branch].args, dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const config = fs.readFileSync(path.join(dir, 'uxdsl.config.cjs'), 'utf8');
    assert.match(config, /^\/\/ @ts-check\n/, 'first line must enable checking: editors do not check plain JS by default');
    assert.match(config, /\/\*\* @type \{import\('postcss-uxdsl\/config'\)\.UxdslConfig\} \*\/\nconst config = \{/);
    assert.match(config, /\nmodule\.exports = config;\n$/);
    assert.doesNotMatch(config, /require\(/, 'no run-time require: an unresolvable postcss-uxdsl must never fail the build');
    assert.doesNotMatch(config, /\/\*\* @type[^\n]*\*\/\nmodule\.exports/, '@type on module.exports checks nothing');

    const legacyFile = path.join(dir, 'legacy.config.cjs');
    fs.writeFileSync(legacyFile, branch === 'multi' ? LEGACY_MULTI : LEGACY_SINGLE);
    assert.deepEqual(require(path.join(dir, 'uxdsl.config.cjs')), require(legacyFile));
  });

  test(`MIG-B7-12 [${branch}]: compiled CSS and build log are byte-identical to the pre-change config`, () => {
    const dir = mkProject(branch);
    assert.equal(run(BRANCHES[branch].args, dir).status, 0);
    const built = run(['build'], dir);
    assert.equal(built.status, 0, built.stdout + built.stderr);
    const cssNew = outFiles(branch).map((f) => fs.readFileSync(path.join(dir, f)));

    fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), branch === 'multi' ? LEGACY_MULTI : LEGACY_SINGLE);
    for (const f of outFiles(branch)) fs.rmSync(path.join(dir, f));
    const legacy = run(['build'], dir);
    assert.equal(legacy.status, 0, legacy.stdout + legacy.stderr);
    const cssLegacy = outFiles(branch).map((f) => fs.readFileSync(path.join(dir, f)));

    cssNew.forEach((buf, i) => assert.ok(buf.equals(cssLegacy[i]), `${outFiles(branch)[i]} differs from the pre-change output`));
    assert.equal(built.stdout, legacy.stdout, 'the build log must not gain or lose a line');
    assert.equal(built.stderr, legacy.stderr);
    assert.doesNotMatch(built.stdout, /Theme config detected/);
  });

  test(`MIG-B7-12 [${branch}]: a second init changes nothing; no theme file or .vscode/ is scaffolded`, () => {
    const dir = mkProject(branch);
    assert.equal(run(BRANCHES[branch].args, dir).status, 0);
    const first = snapshot(dir);
    assert.equal(run(BRANCHES[branch].args, dir).status, 0);
    assert.deepEqual(snapshot(dir), first);
    for (const name of ['uxdsl.theme.json', 'uxdsl.theme.config.cjs', 'uxdsl.theme.config.js', 'uxdsl.theme.config.json', '.vscode']) {
      assert.equal(fs.existsSync(path.join(dir, name)), false, `${name} must not be scaffolded`);
    }
  });

  test(`MIG-B7-12 [${branch}]: never overwrites an existing config, theme file or .vscode/extensions.json`, () => {
    const dir = mkProject(branch);
    const canaries = {
      'uxdsl.config.cjs': "module.exports = { entry: './src/x.uxdsl', outFile: './src/x.css' };\n// CANARY\n",
      'uxdsl.theme.json': '{ "palette": { "primary": { "main": "#123456" } } }\n',
      '.vscode/extensions.json': '{ "recommendations": ["someone.else"] }\n',
    };
    for (const [file, content] of Object.entries(canaries)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), content);
    }
    const r = run(BRANCHES[branch].args, dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const [file, content] of Object.entries(canaries)) {
      assert.equal(fs.readFileSync(path.join(dir, file), 'utf8'), content, `${file} must survive init untouched`);
    }
    assert.deepEqual(fs.readdirSync(path.join(dir, '.vscode')), ['extensions.json']);
  });
}

test('MIG-B7-12: the generated configs type-check clean, and a typo in them is an error', () => {
  for (const branch of ['plain', 'multi']) {
    const dir = mkProject(branch);
    assert.equal(run(BRANCHES[branch].args, dir).status, 0);
    const configPath = path.join(dir, 'uxdsl.config.cjs');
    const generated = fs.readFileSync(configPath, 'utf8');
    for (const opts of RESOLUTIONS) {
      const clean = typeCheck(dir, 'uxdsl.config.cjs', opts);
      assert.equal(clean.status, 0, `[${branch} ${opts.moduleResolution}] expected a clean check:\n${clean.output}`);
    }
    // Negative control: the typo the header comment promises to catch.
    const typo = branch === 'multi'
      ? generated.replace("includeTheme: false }", 'includeThem: false }')
      : generated.replace("  outFile: './src/uxdsl.css',\n", "  outFile: './src/uxdsl.css',\n  includeThem: false,\n");
    assert.notEqual(typo, generated);
    fs.writeFileSync(configPath, typo);
    for (const opts of RESOLUTIONS) {
      const bad = typeCheck(dir, 'uxdsl.config.cjs', opts);
      assert.notEqual(bad.status, 0, `[${branch} ${opts.moduleResolution}] the typo must be reported`);
      assert.match(bad.output, /TS2561|TS2353/, bad.output);
      assert.doesNotMatch(bad.output, /TS2307/, 'the type must resolve, not merely fail to load');
    }
    // And without `// @ts-check` nothing is reported: that line is load-bearing.
    fs.writeFileSync(configPath, typo.replace(/^\/\/ @ts-check\n/, ''));
    assert.equal(typeCheck(dir, 'uxdsl.config.cjs', RESOLUTIONS[0]).status, 0);
  }
});

test('MIG-B7-12: the typed config still builds when postcss-uxdsl is not resolvable from the project root', () => {
  // The pnpm-strict case (uxdsl-cli installed, postcss-uxdsl only as its
  // dependency). Here the temp project has no node_modules at all; the CLI
  // resolves the compiler from its own install. A run-time
  // require('postcss-uxdsl/config') in the config would throw instead.
  const dir = mkProject('plain');
  assert.equal(run(['init'], dir).status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'node_modules')), false);
  const built = run(['build'], dir);
  assert.equal(built.status, 0, built.stdout + built.stderr);

  const withRequire = "const { defineConfig } = require('postcss-uxdsl/config');\nmodule.exports = defineConfig({ entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css' });\n";
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), withRequire);
  const broken = run(['build'], dir);
  assert.notEqual(broken.status, 0, 'control: variant (a) must fail here, or this test proves nothing');
  assert.match(broken.stdout + broken.stderr, /postcss-uxdsl\/config/);
});

test('MIG-B7-12: "Next steps" points to editor support without naming a marketplace', () => {
  for (const branch of Object.keys(BRANCHES)) {
    const dir = mkProject(branch);
    const r = run(BRANCHES[branch].args, dir);
    assert.match(r.stdout, /Editor support: uxdsl\.config\.cjs is type-checked/);
    assert.match(r.stdout, /\.vsix/);
    assert.match(r.stdout, /"Editor support" in the uxdsl-cli README/);
    assert.doesNotMatch(r.stdout, /marketplace/i);
  }
});
