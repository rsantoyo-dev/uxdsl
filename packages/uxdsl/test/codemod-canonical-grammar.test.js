'use strict';

// The canonical-grammar codemod, run as a consumer runs it: the shipped script
// as a subprocess, over files in a temporary directory. No shell tool is used,
// so the file runs the same on every platform.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '../scripts/codemod-canonical-grammar.js');
const { TYPOGRAPHY_PROPERTIES } = require('../dist/typography');

const PAST = new Date('2001-02-03T04:05:06Z');
const FORMER = { size: 'font-size', line: 'line-height', weight: 'font-weight', spacing: 'letter-spacing', transform: 'text-transform', decoration: 'text-decoration', style: 'font-style' };
// The canonical names that also read as a former name: a role ending in -font,
// -letter or -text followed by a former suffix.
const DUAL = ['font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-transform', 'text-decoration'];
const typo = (name) => `--uxdsl__typography__${name}`;

function tmp(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-grammar-codemod-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function run(cwd, ...args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, lines: result.stdout.split(/\r?\n/).filter((line) => line !== ''), stderr: result.stderr };
}

const lastLine = (lines) => lines[lines.length - 1] || '';
const summary = (lines) => lastLine(lines).trimEnd();

/** The report lines printed under a file's header (`W f`, `~ f` or `  f`). */
function block(lines, rel) {
  const start = lines.findIndex((line) => /^(W |~ | {2})\S/.test(line) && line.slice(2) === rel);
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length && lines[i].startsWith('     '); i++) out.push(lines[i]);
  return { header: lines[start], lines: out };
}

const headers = (lines) => lines.filter((line) => /^(W |~ | {2})\S/.test(line)).map((line) => line.slice(2));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out.sort();
}

/** Every file's bytes and modification time, after setting each one's time to PAST. */
function age(dir) {
  for (const file of walk(dir)) fs.utimesSync(file, PAST, PAST);
  return snapshot(dir);
}

function snapshot(dir) {
  const files = new Map();
  for (const file of walk(dir)) files.set(path.relative(dir, file), { bytes: fs.readFileSync(file), mtimeMs: fs.statSync(file).mtimeMs });
  return files;
}

function assertUnchanged(before, after, what) {
  assert.deepEqual([...after.keys()], [...before.keys()], `${what}: the same files`);
  for (const [rel, { bytes, mtimeMs }] of before) {
    const now = after.get(rel);
    assert.ok(now.bytes.equals(bytes), `${what}: ${rel} has the same bytes\n--- before\n${bytes}\n--- after\n${now.bytes}`);
    assert.equal(now.mtimeMs, mtimeMs, `${what}: ${rel} was not written`);
  }
}

const names = (text) => text.match(/--uxdsl__typography__[a-z0-9_-]*/g) || [];

// One former spelling of every family the codemod rewrites, and the six
// canonical typography names that also read as former ones.
const FIXTURE = [
  '.a { border-radius: rounded(2); box-shadow: elevation(3); }',
  '.b { border-radius: radius(full); background: palette(primary-main, 0.5); border-color: color(gray-300); }',
  '.c { @ds-button ("outlined", primary); }',
  '.d { @ds-surface (contained 2); }',
  '.e { @ds-input outlined primary; }',
  '.f { @ds-typo(h1, body); }',
  `.g { ${Object.keys(FORMER).map((suffix, i) => `${'abcdefg'[i]}: var(${typo(`h1-${suffix}`)});`).join(' ')} }`,
  `.h { ${DUAL.map((property, i) => `${'abcdef'[i]}: var(${typo(`h1-${property}`)});`).join(' ')} }`,
];
const EXPECTED = [
  '.a { border-radius: radius(2); box-shadow: shadow(3); }',
  '.b { border-radius: radius(pill); background: palette(primary.main, 0.5); border-color: color(gray.300); }',
  '.c { @ds-button(outlined primary); }',
  '.d { @ds-surface(contained 2); }',
  '.e { @ds-input(outlined primary); }',
  '.f { @ds-typo(h1 body); }',
  '.g { a: var(--uxdsl__typography__h1-font-size); b: var(--uxdsl__typography__h1-line-height); c: var(--uxdsl__typography__h1-font-weight); d: var(--uxdsl__typography__h1-letter-spacing); e: var(--uxdsl__typography__h1-text-transform); f: var(--uxdsl__typography__h1-text-decoration); g: var(--uxdsl__typography__h1-font-style); }',
  '.h { a: var(--uxdsl__typography__h1-font-size); b: var(--uxdsl__typography__h1-font-weight); c: var(--uxdsl__typography__h1-font-style); d: var(--uxdsl__typography__h1-letter-spacing); e: var(--uxdsl__typography__h1-text-transform); f: var(--uxdsl__typography__h1-text-decoration); }',
];

/** The fixture as a file of each type the codemod walks. */
function plant(ext, lines) {
  const body = `${lines.join('\n')}\n`;
  switch (ext) {
    case '.ts': case '.tsx': case '.js': case '.jsx':
      return `export const css = \`\n${body}\`;\n`;
    case '.md': case '.mdx':
      return `# Fixture\n\n\`\`\`css\n${body}\`\`\`\n`;
    case '.json':
      // A double quote inside a JSON string is an escape (`\"`), which the
      // directive rewrite does not handle; the quoted form uses single quotes.
      return `${JSON.stringify({ css: lines.map((line) => line.replace(/"/g, "'")) }, null, 2)}\n`;
    default:
      return body;
  }
}
const EXTENSIONS = ['.uxdsl', '.css', '.scss', '.ts', '.tsx', '.js', '.jsx', '.mdx', '.md', '.json'];

test('MIG-B9-29: a second --write run changes no file, in every file type the codemod walks', (t) => {
  const dir = tmp(t);
  for (const ext of EXTENSIONS) fs.writeFileSync(path.join(dir, `f${ext}`), plant(ext, FIXTURE));
  // Neither is walked: an extension outside the list, and a skipped directory.
  fs.writeFileSync(path.join(dir, 'f.txt'), plant('.css', FIXTURE));
  fs.mkdirSync(path.join(dir, 'node_modules'));
  fs.writeFileSync(path.join(dir, 'node_modules', 'x.css'), plant('.css', FIXTURE));

  const first = run(dir, '--write', '.');
  assert.equal(first.status, 0, first.stderr);
  for (const ext of EXTENSIONS) {
    assert.equal(fs.readFileSync(path.join(dir, `f${ext}`), 'utf8'), plant(ext, EXPECTED), `f${ext} after the first run`);
    assert.deepEqual(block(first.lines, `f${ext}`), {
      header: `W f${ext}`,
      lines: [
        '     rounded() -> radius() ×1',
        '     elevation() -> shadow() ×1',
        '     radius(full) -> radius(pill) ×1',
        '     palette()/color() dashed -> dotted ×2',
        '     directive arguments ×5',
        '     typography variable suffixes ×7',
      ],
    }, `f${ext}'s report on the first run`);
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'f.json'), 'utf8')), { css: EXPECTED });
  assert.equal(fs.readFileSync(path.join(dir, 'f.txt'), 'utf8'), plant('.css', FIXTURE));
  assert.equal(fs.readFileSync(path.join(dir, 'node_modules', 'x.css'), 'utf8'), plant('.css', FIXTURE));
  assert.deepEqual(headers(first.lines).sort(), EXTENSIONS.map((ext) => `f${ext}`).sort());
  assert.equal(summary(first.lines), '10 file(s) rewritten (10 with findings).');

  const before = age(dir);
  const second = run(dir, '--write', '.');
  assert.equal(second.status, 0, second.stderr);
  assertUnchanged(before, snapshot(dir), 'the second run');
  assert.ok(lastLine(second.lines).startsWith('0 file(s) rewritten'), lastLine(second.lines));
  assert.deepEqual(second.lines.map((line) => line.trimEnd()), ['0 file(s) rewritten (0 with findings).']);
});

test('MIG-B9-29: a second run without --write ends with "0 file(s) would change" and repeats only its unresolved lines', (t) => {
  const dir = tmp(t);
  fs.writeFileSync(path.join(dir, 'theme.json'), `${JSON.stringify({
    palette: { brand: { 'blue-main': '#1d4ed8' }, 'brand-blue': { main: '#1e40af' } },
    typography_details: { 'body-text': { textTransform: 'uppercase' }, 'lead-font': { fontWeight: '600' } },
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'src.css'), [
    '.a { background: palette(brand-blue-main); padding: densities(2); border-radius: rounded(2); }',
    `.b { text-transform: var(${typo('body-text-transform')}); font-size: var(${typo('lead-size')}); }`,
    '',
  ].join('\n'));

  const first = run(dir, '--write', '--theme', 'theme.json', 'src.css');
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(first.lines.map((line) => line.trimEnd()), [
    'W src.css',
    '     rounded() -> radius() ×1',
    '     unresolved: palette(brand-blue-main) (ambiguous: brand.blue-main or brand-blue.main)',
    '     typography variable suffixes ×1',
    "     unresolved: --uxdsl__typography__body-text-transform (ambiguous: role body's text-transform, or role body-text's former -transform, now --uxdsl__typography__body-text-text-transform)",
    "     unresolved: --uxdsl__typography__lead-font-size (ambiguous: role lead's font-size, or role lead-font's former -size, now --uxdsl__typography__lead-font-font-size)",
    '     unresolved: densities(…) ×1: define a Density token in the theme and use density(k)',
    '1 file(s) rewritten (1 with findings).',
  ]);
  assert.equal(fs.readFileSync(path.join(dir, 'src.css'), 'utf8'), [
    '.a { background: palette(brand-blue-main); padding: densities(2); border-radius: radius(2); }',
    `.b { text-transform: var(${typo('body-text-transform')}); font-size: var(${typo('lead-font-size')}); }`,
    '',
  ].join('\n'));
  const unresolved = block(first.lines, 'src.css').lines.filter((line) => line.startsWith('     unresolved: '));
  assert.equal(unresolved.length, 4);

  const before = age(dir);
  const second = run(dir, '--theme', 'theme.json', 'src.css');
  assert.equal(second.status, 0, second.stderr);
  assertUnchanged(before, snapshot(dir), 'the preview');
  assert.ok(lastLine(second.lines).startsWith('0 file(s) would change'), lastLine(second.lines));
  assert.deepEqual(second.lines.slice(0, -1), ['  src.css', ...unresolved]);
  assert.equal(summary(second.lines), '0 file(s) would change (1 with findings). Run again with --write to apply.');
});

const ROLES = ['h1', 'body-sm', 'title-style'];

test('MIG-B9-29: a canonical typography variable is left as it is, for every property name the engine gives one', (t) => {
  const dir = tmp(t);
  const properties = Object.values(TYPOGRAPHY_PROPERTIES);
  assert.equal(properties.length, 10);
  const text = `${properties.flatMap((property) => ROLES.map((role) => `.x { a: var(${typo(`${role}-${property}`)}); }`)).join('\n')}\n`;
  fs.writeFileSync(path.join(dir, 'canonical.css'), text);

  const result = run(dir, '--write', 'canonical.css');
  assert.equal(result.status, 0, result.stderr);
  const after = fs.readFileSync(path.join(dir, 'canonical.css'), 'utf8');
  assert.deepEqual(names(after), names(text));
  assert.equal(after, text);
  assert.deepEqual(result.lines.map((line) => line.trimEnd()), ['0 file(s) rewritten (0 with findings).']);
});

test('MIG-B9-29: every former typography suffix is still renamed to its CSS property (negative control)', (t) => {
  const dir = tmp(t);
  const formers = Object.keys(FORMER);
  const text = `${formers.flatMap((suffix) => ROLES.map((role) => `.x { a: var(${typo(`${role}-${suffix}`)}); }`)).join('\n')}\n`
    + `.y { a: var(${typo('h1-size-sm')}); b: var(${typo('h1-size_x')}); }\n`;
  const expected = `${formers.flatMap((suffix) => ROLES.map((role) => `.x { a: var(${typo(`${role}-${FORMER[suffix]}`)}); }`)).join('\n')}\n`
    + `.y { a: var(${typo('h1-size-sm')}); b: var(${typo('h1-size_x')}); }\n`;
  fs.writeFileSync(path.join(dir, 'former.css'), text);

  const result = run(dir, '--write', 'former.css');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(dir, 'former.css'), 'utf8'), expected);
  assert.deepEqual(result.lines.map((line) => line.trimEnd()), [
    'W former.css',
    `     typography variable suffixes ×${formers.length * ROLES.length}`,
    '1 file(s) rewritten (1 with findings).',
  ]);
});

test('MIG-B9-29: a canonical name that is also a theme role\'s former name is left and reported, in both runs', (t) => {
  // Each name, the role its former reading names, and the role and property
  // its canonical reading names.
  const AMBIGUOUS = [
    ['body-text-transform', 'body-text', 'transform', 'body', 'text-transform'],
    ['body-text-decoration', 'body-text', 'decoration', 'body', 'text-decoration'],
    ['lead-font-size', 'lead-font', 'size', 'lead', 'font-size'],
    ['lead-font-weight', 'lead-font', 'weight', 'lead', 'font-weight'],
    ['lead-font-style', 'lead-font', 'style', 'lead', 'font-style'],
    ['wide-letter-spacing', 'wide-letter', 'spacing', 'wide', 'letter-spacing'],
  ];
  // One name occurs twice: every occurrence gets its own report line.
  const TWICE = 'body-text-transform';
  const a = `${AMBIGUOUS.map(([name], i) => `.a${i} { a: var(${typo(name)}); }`).join('\n')}\n`
    + `.a${AMBIGUOUS.length} { b: var(${typo(TWICE)}); }\n`;
  const b = `.b { font-size: var(${typo('body-text-size')}); }\n`;
  const theme = {
    typography_details: {
      'body-text': { textTransform: 'uppercase' },
      'lead-font': { fontWeight: '600' },
      'wide-letter': { letterSpacing: '0.1em' },
    },
  };

  const dir = tmp(t);
  fs.writeFileSync(path.join(dir, 'roles.json'), `${JSON.stringify(theme, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'a.css'), a);
  fs.writeFileSync(path.join(dir, 'b.css'), b);

  const reports = [];
  for (const pass of ['first', 'second']) {
    const before = age(dir);
    const result = run(dir, '--write', '--theme', 'roles.json', 'a.css', 'b.css');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(dir, 'a.css'), 'utf8'), a, `the ${pass} run leaves a.css`);
    assert.equal(fs.statSync(path.join(dir, 'a.css')).mtimeMs, before.get('a.css').mtimeMs, `the ${pass} run does not write a.css`);
    const found = block(result.lines, 'a.css');
    assert.ok(found, `the ${pass} run lists a.css`);
    assert.equal(found.header, '  a.css');
    assert.equal(found.lines.length, AMBIGUOUS.length + 1, found.lines.join('\n'));
    for (const [name, formerRole, suffix, role, property] of AMBIGUOUS) {
      const lines = found.lines.filter((line) => line.startsWith(`     unresolved: ${typo(name)} `));
      const occurrences = name === TWICE ? 2 : 1;
      assert.equal(lines.length, occurrences, `the ${pass} run reports ${name} once per occurrence (${occurrences})`);
      for (const line of lines) {
        assert.ok(line.includes(`role ${role}'s ${property}`), line);
        assert.ok(line.includes(`role ${formerRole}'s former -${suffix}`), line);
        assert.ok(line.includes(typo(`${formerRole}-${FORMER[suffix]}`)), line);
      }
    }
    reports.push(found.lines);
    assert.equal(fs.readFileSync(path.join(dir, 'b.css'), 'utf8'), `.b { font-size: var(${typo('body-text-font-size')}); }\n`);
  }
  assert.deepEqual(reports[1], reports[0]);

  // The control: without the theme no role makes these names ambiguous, so
  // nothing is reported.
  const plain = tmp(t);
  fs.writeFileSync(path.join(plain, 'a.css'), a);
  fs.writeFileSync(path.join(plain, 'b.css'), b);
  const control = run(plain, '--write', 'a.css', 'b.css');
  assert.equal(control.status, 0, control.stderr);
  assert.deepEqual(control.lines.filter((line) => line.includes('unresolved:')), []);
  assert.deepEqual(headers(control.lines), ['b.css']);
  assert.equal(fs.readFileSync(path.join(plain, 'a.css'), 'utf8'), a);
  assert.equal(fs.readFileSync(path.join(plain, 'b.css'), 'utf8'), `.b { font-size: var(${typo('body-text-font-size')}); }\n`);
});

test('MIG-B9-29: run twice over a copy of the repository\'s own sources, the second run changes nothing', (t) => {
  const dir = tmp(t);
  fs.cpSync(path.join(__dirname, '../../playground-nextjs/src'), path.join(dir, 'playground-src'), { recursive: true });
  fs.cpSync(path.join(__dirname, '../../../fixtures/parity'), path.join(dir, 'parity'), { recursive: true });
  const canonical = walk(dir).filter((file) => file.endsWith('.uxdsl') && /--uxdsl__typography__[a-z0-9-]+-font-size(?![\w-])/.test(fs.readFileSync(file, 'utf8')));
  assert.ok(canonical.length > 0, 'the copy holds a canonical typography name in a .uxdsl file');

  const first = run(dir, '--write', '.');
  assert.equal(first.status, 0, first.stderr);
  const renamed = [];
  let current = null;
  for (const line of first.lines) {
    if (/^(W |~ | {2})\S/.test(line)) current = line.slice(2);
    else if (current && line.startsWith('     typography variable suffixes') && /\.(uxdsl|css)$/.test(current)) renamed.push(`${current}: ${line.trim()}`);
  }
  assert.deepEqual(renamed, [], 'the first run renames no typography name in a .uxdsl or .css file');

  const before = age(dir);
  const second = run(dir, '--write', '.');
  assert.equal(second.status, 0, second.stderr);
  assertUnchanged(before, snapshot(dir), 'the second run');
  assert.ok(lastLine(second.lines).startsWith('0 file(s) rewritten'), lastLine(second.lines));
});

test('MIG-B9-29: without --theme, every path given is read, the first one included', (t) => {
  const dir = tmp(t);
  const former = `.a { font-size: var(${typo('h1-size')}); }\n`;
  const renamed = `.a { font-size: var(${typo('h1-font-size')}); }\n`;
  fs.writeFileSync(path.join(dir, 'p.css'), former);
  fs.writeFileSync(path.join(dir, 'q.css'), former);
  const themeModule = 'module.exports = {}; // rounded(2)\n';
  fs.writeFileSync(path.join(dir, 't.js'), themeModule);

  const both = run(dir, 'p.css', 'q.css');
  assert.equal(both.status, 0, both.stderr);
  assert.deepEqual(headers(both.lines), ['p.css', 'q.css']);
  assert.ok(both.lines.includes('~ p.css') && both.lines.includes('~ q.css'), both.lines.join('\n'));
  assert.ok(lastLine(both.lines).startsWith('2 file(s) would change'), lastLine(both.lines));

  const one = run(dir, 'p.css');
  assert.equal(one.status, 0, one.stderr);
  assert.deepEqual(headers(one.lines), ['p.css']);
  assert.ok(lastLine(one.lines).startsWith('1 file(s) would change'), lastLine(one.lines));
  assert.equal(fs.readFileSync(path.join(dir, 'p.css'), 'utf8'), former);

  const written = run(dir, 'p.css', '--write');
  assert.equal(written.status, 0, written.stderr);
  assert.deepEqual(headers(written.lines), ['p.css']);
  assert.equal(fs.readFileSync(path.join(dir, 'p.css'), 'utf8'), renamed);
  assert.equal(fs.readFileSync(path.join(dir, 'q.css'), 'utf8'), former);

  // The value after --theme is the theme, never a path.
  const themed = run(dir, '--write', '--theme', 't.js', 'q.css');
  assert.equal(themed.status, 0, themed.stderr);
  assert.deepEqual(headers(themed.lines), ['q.css']);
  assert.equal(fs.readFileSync(path.join(dir, 'q.css'), 'utf8'), renamed);
  assert.equal(fs.readFileSync(path.join(dir, 't.js'), 'utf8'), themeModule);

  for (const args of [[], ['--write'], ['--theme', 't.js']]) {
    const usage = run(dir, ...args);
    assert.equal(usage.status, 2, `${args.join(' ') || '(no arguments)'} prints the usage line`);
    assert.deepEqual(usage.lines, []);
    assert.match(usage.stderr, /^usage: codemod-canonical-grammar\.js /);
  }
});
