'use strict';

// MIG-B3-04 (FEAT-004): `uxdsl theme` introspection. Answers "what theme did
// my build actually resolve, and where did each value come from" using the
// exact same loadConfig()/resolveTheme() path `build` uses, instead of
// diffing compiled CSS by hand.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const cli = require('../bin/uxdsl.js');
const { DEFAULT_THEME } = require('postcss-uxdsl/ds-runtime');

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-theme-cmd-test-'));
}

function write(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

function captureStdout(fn) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  try {
    return { result: fn(), output: () => lines.join('\n') };
  } finally {
    console.log = original;
  }
}

async function captureStdoutAsync(fn) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  try {
    await fn();
    return lines.join('\n');
  } finally {
    console.log = original;
  }
}

test('MIG-B3-04: diffThemeAgainstDefaults only lists families the raw theme actually mentions', () => {
  const raw = { fonts: { families: { ui: 'Georgia' } } };
  const effective = { fonts: { families: { ui: 'Georgia', 'ui-2': DEFAULT_THEME.fonts.families['ui-2'], code: DEFAULT_THEME.fonts.families.code } }, spacing: DEFAULT_THEME.spacing };
  const rows = cli.diffThemeAgainstDefaults(raw, effective);
  const paths = rows.map((r) => r.path).sort();
  assert.deepEqual(paths, ['fonts.families.code', 'fonts.families.ui', 'fonts.families.ui-2']);
  assert.ok(!paths.some((p) => p.startsWith('spacing')), 'an untouched family must not appear at all');
});

test('MIG-B3-04: diffThemeAgainstDefaults labels the overridden leaf "project" and untouched siblings "default"', () => {
  const raw = { fonts: { families: { ui: 'Georgia' } } };
  const effective = { fonts: { families: { ui: 'Georgia', 'ui-2': DEFAULT_THEME.fonts.families['ui-2'], code: DEFAULT_THEME.fonts.families.code } } };
  const rows = cli.diffThemeAgainstDefaults(raw, effective);
  const byPath = Object.fromEntries(rows.map((r) => [r.path, r.source]));
  assert.equal(byPath['fonts.families.ui'], 'project');
  assert.equal(byPath['fonts.families.ui-2'], 'default');
  assert.equal(byPath['fonts.families.code'], 'default');
});

test('MIG-B3-04: a leaf explicitly set to the same value the default already uses still counts as "project" (presence, not value equality)', () => {
  const raw = { fonts: { families: { ui: DEFAULT_THEME.fonts.families.ui } } };
  const effective = { fonts: { families: { ui: DEFAULT_THEME.fonts.families.ui } } };
  const rows = cli.diffThemeAgainstDefaults(raw, effective);
  assert.deepEqual(rows, [{ path: 'fonts.families.ui', value: DEFAULT_THEME.fonts.families.ui, source: 'project' }]);
});

test('MIG-B3-04: a family with no built-in default at all (e.g. colors) is entirely "project"', () => {
  const raw = { colors: { brand: { main: '#123456' } } };
  const effective = { colors: { brand: { main: '#123456' } } };
  const rows = cli.diffThemeAgainstDefaults(raw, effective);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.source === 'project'));
});

test('MIG-B3-04: findPartiallyDefaultedFamilies flags a family declared partially, not one declared completely', () => {
  const raw = { palette: { primary: { main: '#123456' } } };
  const effective = {
    palette: {
      primary: { main: '#123456', dark: DEFAULT_THEME.palette.primary.dark, contrast: DEFAULT_THEME.palette.primary.contrast },
      surface: DEFAULT_THEME.palette.surface,
      neutral: DEFAULT_THEME.palette.neutral,
      error: DEFAULT_THEME.palette.error,
    },
  };
  assert.deepEqual(cli.findPartiallyDefaultedFamilies(raw, effective), ['palette']);

  const fullPalette = { palette: DEFAULT_THEME.palette };
  assert.deepEqual(cli.findPartiallyDefaultedFamilies(fullPalette, fullPalette), []);
});

test('MIG-B3-04: `uxdsl theme` with no project theme prints DEFAULT_THEME verbatim as valid JSON', async () => {
  const dir = mkTmpDir();
  const output = await captureStdoutAsync(() => cli.themeCommand({}, dir));
  const parsed = JSON.parse(output);
  assert.deepEqual(parsed, DEFAULT_THEME);
});

test('MIG-B3-04: `uxdsl theme` reflects a project theme file through the same discovery build uses', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { palette: { primary: { main: '#654321' } } };`);
  const output = await captureStdoutAsync(() => cli.themeCommand({}, dir));
  const parsed = JSON.parse(output);
  assert.equal(parsed.palette.primary.main, '#654321');
  assert.equal(parsed.palette.primary.contrast, DEFAULT_THEME.palette.primary.contrast, 'untouched sibling keeps its default');
});

test('MIG-B3-04: `uxdsl theme --diff` output is parseable JSON limited to the touched path', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { fonts: { families: { ui: 'var(--font-geist-sans)' } } };`);
  const output = await captureStdoutAsync(() => cli.themeCommand({ diff: true }, dir));
  const rows = JSON.parse(output);
  assert.ok(Array.isArray(rows));
  const projectRows = rows.filter((r) => r.source === 'project');
  assert.deepEqual(projectRows.map((r) => r.path), ['fonts.families.ui']);
  assert.equal(projectRows[0].value, 'var(--font-geist-sans)');
});

test('MIG-B3-04: `uxdsl theme --strict` fails with a non-zero-signaling throw when a declared family is partially defaulted', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { palette: { primary: { main: '#111111' } } };`);
  await assert.rejects(
    () => captureStdoutAsync(() => cli.themeCommand({ strict: true }, dir)),
    /--strict:.*palette/
  );
});

test('MIG-B3-04: `uxdsl theme --strict` passes when every key of a declared family is explicit', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { palette: ${JSON.stringify(DEFAULT_THEME.palette)} };`);
  // Must not throw.
  await captureStdoutAsync(() => cli.themeCommand({ strict: true }, dir));
});

// --- MIG-B5-01 (FEAT-006): `--strict` scoped by family, same as build's ---
// `--strict-theme` — a project names which families it wants completeness
// enforced for, instead of the tool checking every touched family
// unconditionally (which conflicts with typography_details' own
// documented partial-override pattern).

test('MIG-B5-01: `uxdsl theme --strict=palette` passes despite a partial typography_details override', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { palette: ${JSON.stringify(DEFAULT_THEME.palette)}, typography_details: { h2: { fontSize: '2.2rem' } } };`);
  // Must not throw — the exact reported repro, scoped out.
  await captureStdoutAsync(() => cli.themeCommand({ strict: 'palette' }, dir));
});

test('MIG-B5-01: `uxdsl theme --strict=palette` still fails when palette itself is partial', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { palette: { primary: { main: '#111111' } } };`);
  await assert.rejects(
    () => captureStdoutAsync(() => cli.themeCommand({ strict: 'palette' }, dir)),
    /--strict \(scoped to: palette\):.*palette/
  );
});

test('MIG-B5-01: bare `uxdsl theme --strict` (no scope) is unchanged — still fails on the exact reported typography_details repro', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { typography_details: { h2: { line: '1.15' } } };`);
  await assert.rejects(
    () => captureStdoutAsync(() => cli.themeCommand({ strict: true }, dir)),
    /--strict:.*typography_details/
  );
});

// --- MIG-B6-22 (FEAT-008): `--strict=true`/`=false` string forms and
// unknown-family validation, reachable the same way from `theme --strict`
// as from `build --strict-theme` (both go through normalizeStrictThemeScope).

test('MIG-B6-22: `uxdsl theme --strict=true` (string) fails the same way the bare flag does', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { typography_details: { h2: { line: '1.15' } } };`);
  await assert.rejects(
    () => captureStdoutAsync(() => cli.themeCommand({ strict: 'true' }, dir)),
    /--strict:.*typography_details/
  );
});

test('MIG-B6-22: `uxdsl theme --strict=false` (string) does not fail despite a partial family', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { typography_details: { h2: { line: '1.15' } } };`);
  await captureStdoutAsync(() => cli.themeCommand({ strict: 'false' }, dir)); // Must not throw.
});

test('MIG-B6-22: `uxdsl theme --strict=pallete` (typo) fails with a suggestion, before the incompleteness check ever runs', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { palette: ${JSON.stringify(DEFAULT_THEME.palette)} };`);
  await assert.rejects(
    () => captureStdoutAsync(() => cli.themeCommand({ strict: 'pallete' }, dir)),
    /Unknown theme family "pallete" in --strict\. Did you mean "palette"\?/
  );
});

// MIG-B6-22 code-review fix: `uxdsl theme --strict` goes through the same
// normalizeStrictThemeScope as `build --strict-theme` (see uxdsl-cli.test.js
// for the equivalent build-side coverage), so a stray comma must fail here
// too instead of silently normalizing to "no families" (strict off).
test('MIG-B6-22: `uxdsl theme --strict=,` (stray comma) fails instead of silently turning strict off', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  await assert.rejects(
    () => captureStdoutAsync(() => cli.themeCommand({ strict: ',' }, dir)),
    /Invalid value for --strict: ","\. A family list cannot contain an empty entry/
  );
});

// --- MIG-B6-16 (FEAT-008): explicit partial overrides -----------------------
//
// Decision D-1 keeps key-by-key merging: a theme is a base plus an override.
// The gap was that the merge is invisible — overriding `palette.primary.main`
// silently keeps the base's `dark` and `contrast`, so a green button's hover
// comes out purple and nothing says so. These cover making it visible without
// changing what scripts parse, and the contrast audit that proves the result.

/** Captures stdout and stderr separately: the whole point of the summary is
 * that it goes to stderr and leaves stdout a clean JSON document. */
async function captureStreamsAsync(fn) {
  const originalLog = console.log;
  const originalError = console.error;
  const out = [];
  const err = [];
  console.log = (...args) => { out.push(args.join(' ')); };
  console.error = (...args) => { err.push(args.join(' ')); };
  try {
    let thrown = null;
    try { await fn(); } catch (cause) { thrown = cause; }
    return { stdout: out.join('\n'), stderr: err.join('\n'), thrown };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

function partialPaletteProject() {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { theme: { palette: { primary: { main: '#00aa00' } } } };`);
  return dir;
}

test('MIG-B6-16: `theme --diff` reports the mixed entry on stderr and leaves stdout untouched', async () => {
  const dir = partialPaletteProject();
  const { stdout, stderr, thrown } = await captureStreamsAsync(() => cli.themeCommand({ diff: true }, dir));
  assert.equal(thrown, null);

  // stdout is still exactly what it was: parseable JSON rows, nothing else.
  const rows = JSON.parse(stdout);
  assert.ok(Array.isArray(rows));
  const primary = rows.filter((r) => r.path.startsWith('palette.primary.'));
  assert.equal(primary.find((r) => r.path === 'palette.primary.main').source, 'project');
  assert.equal(primary.find((r) => r.path === 'palette.primary.contrast').source, 'default');

  assert.match(stderr, /\[uxdsl\] palette\.primary mixes your values \(main\) with base values \([^)]*contrast[^)]*\)/,
    `expected the mix summary on stderr, got: ${stderr}`);
});

test('MIG-B6-16: a family the project overrides completely produces no mix line', () => {
  // The negative control: if every entry reported a mix, the summary would be
  // noise rather than a signal.
  const mixed = cli.summarizeMixedEntries([
    { path: 'palette.primary.main', source: 'project' },
    { path: 'palette.primary.dark', source: 'default' },
    { path: 'palette.brand.main', source: 'project' },
    { path: 'palette.brand.dark', source: 'project' },
    { path: 'colors.gray.300', source: 'project' },
    { path: 'colors.gray.400', source: 'default' },
  ]);
  assert.deepEqual(mixed, ['palette.primary mixes your values (main) with base values (dark)'],
    'only partially-overridden palette/typography entries are reported');
});

test('MIG-B6-16: typography roles are summarized the same way', () => {
  const mixed = cli.summarizeMixedEntries([
    { path: 'typography_details.h1.fontSize', source: 'project' },
    { path: 'typography_details.h1.lineHeight', source: 'default' },
  ]);
  assert.deepEqual(mixed, ['typography_details.h1 mixes your values (fontSize) with base values (lineHeight)']);
});

test('MIG-B6-16: `theme --contrast` fails on the partial override and names the failing pair', async () => {
  const dir = partialPaletteProject();
  const { stdout, thrown } = await captureStreamsAsync(() => cli.themeCommand({ contrast: true }, dir));
  assert.ok(thrown, 'a theme with failing pairs must exit non-zero');
  assert.match(thrown.message, /--contrast: \d+ contrast pairs? fail WCAG/);

  // The report is printed in full even though the command failed: that is when
  // its detail is worth having.
  const report = JSON.parse(stdout);
  assert.equal(report.passed, false);
  assert.ok(Array.isArray(report.failures) && report.failures.length > 0);

  // The green the project chose against the base's inherited white contrast.
  const primaryText = report.failures.filter((f) => f.tone === 'primary' && f.pair === 'text');
  assert.ok(primaryText.length > 0, 'expected the primary tone text pairs to be reported');
  assert.ok(primaryText.every((f) => f.ratio < f.required));
  assert.ok(primaryText.some((f) => Math.abs(f.ratio - 3.11) < 0.05),
    `expected the ~3.11:1 main/contrast pair, got ${JSON.stringify(primaryText.map((f) => f.ratio))}`);
  // Every failure carries the context needed to act on it.
  for (const failure of report.failures) {
    for (const field of ['mode', 'state', 'breakpoint', 'required', 'ratio', 'reason']) {
      assert.ok(field in failure, `failure is missing ${field}: ${JSON.stringify(failure)}`);
    }
  }
});

test('MIG-B6-16: `theme --contrast` on the base theme enumerates the shipped exception', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  const { stdout, thrown } = await captureStreamsAsync(() => cli.themeCommand({ contrast: true }, dir));
  const report = JSON.parse(stdout);

  assert.equal(report.exceptions.length, 1, 'the packaged exception is loaded and enumerated');
  assert.equal(report.exceptions[0].matched, true, 'and it matches the base theme it was written for');
  assert.deepEqual(report.exceptionIssues, [], 'so it is not stale');

  // MIG-B6-29 phase 3 left three engine/architecture gaps open by design, so
  // the base theme does not pass yet. Asserting `passed: true` here would be
  // asserting a fiction; this pins the real state instead, and will fail
  // loudly (forcing this test to be revisited) once those gaps close.
  assert.equal(report.passed, false);
  assert.ok(thrown, 'a failing gate exits non-zero even for the base theme');
  assert.ok(report.failures.length > 0);
});

test('MIG-B6-16: overriding an excepted pair stops inheriting its exception', async () => {
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  // The shipped exception records palette.light.main (#f1f5f9) on white.
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { theme: { palette: { light: { main: '#334155' } } } };`);
  const { stdout } = await captureStreamsAsync(() => cli.themeCommand({ contrast: true }, dir));
  const report = JSON.parse(stdout);

  assert.equal(report.exceptions[0].matched, false, 'the recorded colors no longer occur');
  assert.ok(report.exceptionIssues.some((issue) => /stale exception/.test(issue)),
    `a no-longer-applicable exception must be reported, got ${JSON.stringify(report.exceptionIssues)}`);
});

test('MIG-B6-16: --contrast refuses to share stdout with --diff or --strict', async () => {
  const dir = partialPaletteProject();
  for (const [label, argv] of [
    ['--diff', { contrast: true, diff: true }],
    ['--strict', { contrast: true, strict: true }],
  ]) {
    const { thrown, stdout } = await captureStreamsAsync(() => cli.themeCommand(argv, dir));
    assert.ok(thrown, `${label}: expected a refusal`);
    assert.match(thrown.message, /--contrast cannot be combined with/);
    assert.equal(stdout, '', `${label}: nothing should be printed before the refusal`);
  }
});

test('MIG-B6-16: --contrast keeps stdout a pure JSON document', async () => {
  const dir = partialPaletteProject();
  const { stdout, stderr } = await captureStreamsAsync(() => cli.themeCommand({ contrast: true }, dir));
  assert.doesNotThrow(() => JSON.parse(stdout), 'stdout must parse as one JSON document');
  assert.equal(stderr, '', 'the failure message belongs to the caller, not to stdout or a log line here');
});

test('MIG-B6-12: a large JSON report is not truncated when stdout is a pipe', async () => {
  // Found by the beta.6 release gate: `uxdsl theme --contrast | jq` produced
  // malformed JSON. `process.exit()` terminates immediately and a write to a
  // *pipe* is asynchronous, so whatever was still buffered was discarded —
  // the same command redirected to a file wrote 302,816 bytes while piped it
  // wrote 65,536, ending mid-string.
  //
  // `--contrast` is the command that exceeds a pipe buffer today (302 KB, vs
  // 13 KB for `theme` and 5 KB for `theme --diff`), so it is the one that can
  // demonstrate the truncation. The others are checked for a parseable
  // document, which is the property that must hold for `| jq` whatever their
  // size. Driving the real binary through a pipe is the only way to observe
  // any of this: an in-process call to themeCommand cannot reproduce it.
  const { spawnSync } = require('node:child_process');
  const dir = mkTmpDir();
  write(dir, 'uxdsl.config.cjs', `module.exports = { entry: './src/entry.uxdsl', outFile: './src/out.css' };`);
  write(dir, 'src/entry.uxdsl', '.x { color: red; }');
  write(dir, 'uxdsl.theme.config.cjs', `module.exports = { theme: { palette: { primary: { main: '#00aa00' } } } };`);
  const bin = path.join(__dirname, '..', 'bin', 'uxdsl.js');

  for (const [label, args, expectedStatus, mustExceedPipeBuffer] of [
    ['theme', ['theme'], 0, false],
    ['theme --diff', ['theme', '--diff'], 0, false],
    ['theme --contrast', ['theme', '--contrast'], 1, true],
  ]) {
    const piped = spawnSync(process.execPath, [bin, ...args], {
      cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    assert.equal(piped.status, expectedStatus, `${label}: unexpected exit status`);
    if (mustExceedPipeBuffer) {
      assert.ok(piped.stdout.length > 65536,
        `${label}: this case must be big enough to demonstrate truncation, got ${piped.stdout.length} bytes`);
    }
    assert.doesNotThrow(() => JSON.parse(piped.stdout),
      `${label}: stdout was truncated mid-document at ${piped.stdout.length} bytes`);
  }
});
