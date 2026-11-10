// MIG-B7-12 (FEAT-009): what `uxdsl init` writes for editor support, run as a
// real subprocess in real temp projects — all four branches (plain, --multi,
// Next.js, Vite).
//
// - The config is type-checked by an editor (JSDoc + `// @ts-check`), without
//   a run-time `require` of uxdsl.
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

const CLI_BIN = path.join(__dirname, '..', '..', 'bin', 'uxdsl.js');
const UXDSL_DIR = path.resolve(__dirname, '..', '..');
const TSC = path.join(fs.realpathSync(UXDSL_DIR), 'node_modules', 'typescript', 'bin', 'tsc');

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
 * would, with uxdsl resolvable through the project's node_modules. */
function typeCheck(dir, file, { module, moduleResolution }) {
  const nm = path.join(dir, 'node_modules');
  if (!fs.existsSync(path.join(nm, 'uxdsl'))) {
    fs.mkdirSync(nm, { recursive: true });
    fs.symlinkSync(fs.realpathSync(UXDSL_DIR), path.join(nm, 'uxdsl'), 'dir');
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
    assert.match(config, /\/\*\* @type \{import\('uxdsl\/config'\)\.UxdslConfig\} \*\/\nconst config = \{/);
    assert.match(config, /\nmodule\.exports = config;\n$/);
    assert.doesNotMatch(config, /require\(/, 'no run-time require: an unresolvable uxdsl must never fail the build');
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
    for (const name of ['uxdsl.theme.json', 'uxdsl.theme.cjs', 'uxdsl.theme.js', '.vscode']) {
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

test('MIG-B7-12: the typed config still builds when uxdsl is not resolvable from the project root', () => {
  // The npx / global-CLI case: the temp project has no node_modules at all;
  // the CLI compiles with the package it ships in. A run-time
  // require('uxdsl/config') in the config would throw instead.
  const dir = mkProject('plain');
  assert.equal(run(['init'], dir).status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'node_modules')), false);
  const built = run(['build'], dir);
  assert.equal(built.status, 0, built.stdout + built.stderr);

  const withRequire = "const { defineConfig } = require('uxdsl/config');\nmodule.exports = defineConfig({ entry: './src/uxdsl-entry.uxdsl', outFile: './src/uxdsl.css' });\n";
  fs.writeFileSync(path.join(dir, 'uxdsl.config.cjs'), withRequire);
  const broken = run(['build'], dir);
  assert.notEqual(broken.status, 0, 'control: variant (a) must fail here, or this test proves nothing');
  assert.match(broken.stdout + broken.stderr, /uxdsl\/config/);
});

test('MIG-B7-12: "Next steps" points to editor support without naming a marketplace', () => {
  for (const branch of Object.keys(BRANCHES)) {
    const dir = mkProject(branch);
    const r = run(BRANCHES[branch].args, dir);
    assert.match(r.stdout, /Editor support: uxdsl\.config\.cjs is type-checked/);
    assert.match(r.stdout, /\.vsix/);
    assert.match(r.stdout, /"Editor support" in the uxdsl README/);
    assert.doesNotMatch(r.stdout, /marketplace/i);
  }
});

// --- Stability phase 2 (3): what `init` scaffolds and says, exactly ---------

test('phase 2 (3): init scaffolds src/styles.uxdsl — the file to edit — imported by the generated entry, and prints one import path', () => {
  for (const branch of ['plain', 'next', 'vite']) {
    const dir = mkProject(branch);
    const r = run(BRANCHES[branch].args, dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const styles = fs.readFileSync(path.join(dir, 'src/styles.uxdsl'), 'utf8');
    assert.match(styles, /write here, not there/, `[${branch}] styles.uxdsl says what it is for`);
    const entry = fs.readFileSync(path.join(dir, 'src/uxdsl-entry.uxdsl'), 'utf8');
    assert.match(entry, /^@use '\.\/styles\.uxdsl' as styles;$/m, `[${branch}] the generated entry loads it with @use`);
    const importLines = r.stdout.split('\n').map((l) => l.trim()).filter((l) => /^import '/.test(l));
    assert.deepEqual(importLines, ["import './src/uxdsl.css';"], `[${branch}] exactly one import path:\n${r.stdout}`);
    assert.match(r.stdout, /Edit src\/styles\.uxdsl/, `[${branch}] the next steps point at the file to edit`);
    assert.doesNotMatch(r.stdout, /\.\.\/uxdsl\.css/, `[${branch}] no second, framework-relative spelling of the path`);
    // The scaffolded rule compiles: a first build is not blank.
    const built = run(['build'], dir);
    assert.equal(built.status, 0, built.stdout + built.stderr);
    assert.match(fs.readFileSync(path.join(dir, 'src/uxdsl.css'), 'utf8'), /\.example\s*\{/);
  }
});

test('phase 2 (3): init for Next.js writes a postcss.config.js that keeps Next\'s default plugins, then uxdsl/postcss', () => {
  const dir = mkProject('next');
  assert.equal(run(['init'], dir).status, 0);
  const config = fs.readFileSync(path.join(dir, 'postcss.config.js'), 'utf8');
  // Exactly the modules and options Next uses for its own default config
  // (next/dist/build/webpack/config/blocks/css/plugins.js), in that order,
  // because a custom postcss.config.js replaces them.
  const loaded = require(path.join(dir, 'postcss.config.js'));
  assert.deepEqual(Object.keys(loaded.plugins), ['next/dist/compiled/postcss-flexbugs-fixes', 'next/dist/compiled/postcss-preset-env', 'uxdsl/postcss']);
  assert.deepEqual(loaded.plugins['next/dist/compiled/postcss-preset-env'], { autoprefixer: { flexbox: 'no-2009' }, stage: 3, features: { 'custom-properties': false } });
  assert.deepEqual(loaded.plugins['uxdsl/postcss'], { includeTheme: false });
  assert.match(config, /replaces Next's defaults/);
});

// --- Stability phase 4: one package, one install line ------------------------

test('phase 4: init says `npm i -D uxdsl` when the project does not list uxdsl, and only then', () => {
  const missing = mkProject('plain');
  const told = run(['init'], missing);
  assert.equal(told.status, 0, told.stdout + told.stderr);
  const installLines = told.stdout.split('\n').filter((line) => /npm i/.test(line));
  assert.deepEqual(installLines.map((line) => line.trim()), ['Install it in this project: npm i -D uxdsl'], told.stdout);
  assert.doesNotMatch(told.stdout, /postcss-uxdsl|uxdsl-cli|uxdsl-core|vite-plugin-uxdsl|uxdsl-webpack-loader/);

  for (const field of ['devDependencies', 'dependencies']) {
    const listed = mkProject('plain');
    const pkgFile = path.join(listed, 'package.json');
    fs.writeFileSync(pkgFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(pkgFile, 'utf8')), [field]: { uxdsl: '^1.0.0' } }, null, 2));
    const quiet = run(['init'], listed);
    assert.equal(quiet.status, 0, quiet.stdout + quiet.stderr);
    assert.doesNotMatch(quiet.stdout, /npm i/, `[${field}] already installed: no install line`);
  }
});

// --- The config comment that names the `sass` key ----------------------------

test("MIG-B9-14: init's config comment names the sass key; uncommented it type-checks and builds, and the exported object is unchanged", () => {
  const commented = "  // sass: { silenceDeprecations: ['import'], quietDeps: true },\n";
  for (const branch of ['plain', 'multi']) {
    const dir = mkProject(branch);
    assert.equal(run(BRANCHES[branch].args, dir).status, 0);
    const configPath = path.join(dir, 'uxdsl.config.cjs');
    const generated = fs.readFileSync(configPath, 'utf8');
    assert.ok(generated.includes(commented), `[${branch}] the comment names the key:\n${generated}`);
    assert.match(generated, /\n {2}\/\/ Dart Sass options for every entry/, `[${branch}] the comment says what the key is for`);

    // Commented out, it changes nothing: the object is the one init always wrote.
    const legacyFile = path.join(dir, 'legacy.config.cjs');
    fs.writeFileSync(legacyFile, branch === 'multi' ? LEGACY_MULTI : LEGACY_SINGLE);
    assert.deepEqual(require(configPath), require(legacyFile));

    // Uncommented, the line type-checks and builds.
    fs.writeFileSync(configPath, generated.replace(commented, "  sass: { silenceDeprecations: ['import'], quietDeps: true },\n"));
    for (const opts of RESOLUTIONS) {
      const clean = typeCheck(dir, 'uxdsl.config.cjs', opts);
      assert.equal(clean.status, 0, `[${branch} ${opts.moduleResolution}] expected a clean check:\n${clean.output}`);
    }
    const built = run(['build'], dir);
    assert.equal(built.status, 0, `[${branch}] ${built.stdout}${built.stderr}`);

    // Negative control: a misspelled key is reported by the editor and refused by the build.
    fs.writeFileSync(configPath, generated.replace(commented, "  sass: { silenceDeprecation: ['import'], quietDeps: true },\n"));
    for (const opts of RESOLUTIONS) {
      const bad = typeCheck(dir, 'uxdsl.config.cjs', opts);
      assert.notEqual(bad.status, 0, `[${branch} ${opts.moduleResolution}] the misspelled key must be reported`);
      assert.match(bad.output, /TS2353|TS2561/, bad.output);
    }
    const refused = run(['build'], dir);
    assert.equal(refused.status, 1, `[${branch}] ${refused.stdout}${refused.stderr}`);
    assert.match(refused.stderr, /Invalid configuration in uxdsl\.config\.cjs: "sass\.silenceDeprecation" is not a sass option;.* Did you mean "sass\.silenceDeprecations"\?/);
  }
});

// --- The entry init writes ---------------------------------------------------

/** Every file init scaffolded under `dir` (package.json and markers excluded), relative path → text. */
function scaffolded(dir, branch) {
  const out = {};
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const child = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) walk(child);
      else if (child !== 'package.json' && !(child in BRANCHES[branch].markers)) out[child] = fs.readFileSync(path.join(dir, child), 'utf8');
    }
  };
  walk('');
  return out;
}

test("MIG-B9-14: init's entry uses @use and the project builds", () => {
  for (const branch of ['plain', 'next', 'vite']) {
    const dir = mkProject(branch);
    const r = run(BRANCHES[branch].args, dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.stderr, '', `[${branch}] there was no entry to replace, so no warning`);
    const entry = fs.readFileSync(path.join(dir, 'src/uxdsl-entry.uxdsl'), 'utf8');
    assert.deepEqual(entry.split('\n').filter((line) => line.startsWith('@')), ["@use './uxdsl-theme.uxdsl' as uxdsl-theme;", "@use './styles.uxdsl' as styles;"], `[${branch}] the entry:\n${entry}`);
    const styles = fs.readFileSync(path.join(dir, 'src/styles.uxdsl'), 'utf8');
    assert.match(styles, /src\/uxdsl-entry\.uxdsl loads this file with @use/, `[${branch}] styles.uxdsl says how it is loaded`);
    assert.match(styles, /`uxdsl generate-entry`/, `[${branch}] and what regenerates the entry`);
    assert.match(styles, /write here, not there/, `[${branch}]`);
    const built = run(['build'], dir);
    assert.equal(built.status, 0, `[${branch}] ${built.stdout}${built.stderr}`);
    assert.equal(built.stderr, '', `[${branch}] the build prints nothing on stderr`);
    assert.match(fs.readFileSync(path.join(dir, 'src/uxdsl.css'), 'utf8'), /\.example\s*\{/);
  }

  // No scaffolded .uxdsl file of any branch, --multi included, has an @import;
  // exactly one writes the theme marker, and Next's PostCSS config still passes
  // includeTheme: false.
  for (const branch of Object.keys(BRANCHES)) {
    const dir = mkProject(branch);
    assert.equal(run(BRANCHES[branch].args, dir).status, 0);
    const files = scaffolded(dir, branch);
    const uxdslFiles = Object.keys(files).filter((file) => file.endsWith('.uxdsl'));
    assert.ok(uxdslFiles.length >= 2, `[${branch}] scaffolded .uxdsl files: ${uxdslFiles.join(', ')}`);
    for (const file of uxdslFiles) assert.doesNotMatch(files[file], /@import/, `[${branch}] ${file}`);
    assert.equal(uxdslFiles.filter((file) => /^@uxdsl theme;$/m.test(files[file])).length, 1, `[${branch}] one .uxdsl file writes the marker`);
    if (branch === 'next') assert.deepEqual(require(path.join(dir, 'postcss.config.js')).plugins['uxdsl/postcss'], { includeTheme: false });
  }

  // Negative control: the entry init used to write reports a deprecation in the
  // same build, so the empty stderr above is the @use entry's doing.
  const control = mkProject('plain');
  assert.equal(run(['init'], control).status, 0);
  fs.writeFileSync(path.join(control, 'src/uxdsl-entry.uxdsl'), "@import './styles.uxdsl';\n");
  const legacy = run(['build'], control);
  assert.equal(legacy.status, 0, legacy.stdout + legacy.stderr);
  assert.match(legacy.stderr, /^\[uxdsl\] Warning: src\/uxdsl-entry\.uxdsl:1:9: UXD_SASS_WARNING: \[import\] /m);
});

// Every init branch carries `@uxdsl theme;` in exactly one scaffolded .uxdsl
// file: the single-entry branches in the theme file generate-entry writes next
// to the entry (loaded first), --multi in its theme entry, src/theme.uxdsl.
test('MIG-B9-20: init and init --multi build with the theme defined exactly once', () => {
  const definitions = (dir, branch) => outFiles(branch).reduce((n, f) => n + (fs.readFileSync(path.join(dir, f), 'utf8').match(/--uxdsl__space__5:/g) || []).length, 0);
  for (const branch of Object.keys(BRANCHES)) {
    const dir = mkProject(branch);
    const r = run(BRANCHES[branch].args, dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const files = scaffolded(dir, branch);
    const marked = Object.keys(files).filter((file) => file.endsWith('.uxdsl') && /^@uxdsl theme;$/m.test(files[file]));
    assert.deepEqual(marked, [branch === 'multi' ? path.join('src', 'theme.uxdsl') : path.join('src', 'uxdsl-theme.uxdsl')], `[${branch}] the one marked file`);
    if (branch !== 'multi') {
      assert.match(r.stdout, /\[uxdsl\] Generated theme file at src[\\/]uxdsl-theme\.uxdsl: `@uxdsl theme;`, loaded first by the entry\.\n/, `[${branch}]`);
      const entry = files[path.join('src', 'uxdsl-entry.uxdsl')];
      assert.deepEqual(entry.split('\n').filter((line) => line.startsWith('@')), ["@use './uxdsl-theme.uxdsl' as uxdsl-theme;", "@use './styles.uxdsl' as styles;"], `[${branch}] the theme file is loaded first`);
    }
    const built = run(['build'], dir);
    assert.equal(built.status, 0, `[${branch}] ${built.stdout}${built.stderr}`);
    assert.equal(built.stderr, '', `[${branch}] no warning`);
    assert.equal(definitions(dir, branch), 1, `[${branch}] the theme is defined exactly once across ${outFiles(branch).join(', ')}`);
    if (branch !== 'multi') {
      const css = fs.readFileSync(path.join(dir, 'src', 'uxdsl.css'), 'utf8');
      assert.ok(css.indexOf(':root') < css.indexOf('.example'), `[${branch}] the theme precedes the styles`);
    }
  }

  // Negative control: a second marker, in the --multi panel entry, defines the
  // theme twice across the outputs, which the count above would report.
  const dir = mkProject('multi');
  assert.equal(run(['init', '--multi'], dir).status, 0);
  fs.writeFileSync(path.join(dir, 'src', 'panel-a.uxdsl'), `@uxdsl theme;\n${fs.readFileSync(path.join(dir, 'src', 'panel-a.uxdsl'), 'utf8')}`);
  assert.equal(run(['build'], dir).status, 0);
  assert.equal(definitions(dir, 'multi'), 2);
});
