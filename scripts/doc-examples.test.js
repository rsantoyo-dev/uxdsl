'use strict';

// MIG-B7-16 (FEAT-009): executable documentation. See scripts/lib/doc-examples.js
// for what an example may rely on. Three kinds of test live here:
//   1. the harness itself, on inline fixtures — including that it goes RED when
//      it should (a harness that cannot fail is decoration);
//   2. every example in the real documentation surfaces, compiled with the real
//      compiler;
//   3. the guide's own list of files to keep aligned.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT, discoverSurfaces, extractMarkdown, extractJsx, statementsOf, runExample, verifySurfaces, validateThemes,
} = require('./lib/doc-examples');

const blocks = (events) => events.filter((event) => event.type === 'block');

// --- 1. the harness -------------------------------------------------------

test('markdown: fenced blocks are found with their language, line and indentation stripped', () => {
  const text = ['# T', '', '```css', '.a { color: red; }', '```', '', '- item', '  ```json', '  {"spacing":{"1":"1px"}}', '  ```'].join('\n');
  const found = blocks(extractMarkdown(text));
  assert.deepEqual(found.map((b) => [b.lang, b.line]), [['css', 4], ['json', 9]]);
  assert.equal(found[1].code, '{"spacing":{"1":"1px"}}');
});

test('markdown: `<!-- doc-example: output -->` marks the next block as shown output and only that one', () => {
  const text = ['<!-- doc-example: output -->', '```css', '.a { padding: 1px; }', '```', '', '```css', '.b { padding: density(2); }', '```'].join('\n');
  assert.deepEqual(blocks(extractMarkdown(text)).map((b) => b.skip), [true, false]);
});

test('jsx: a template literal, a constant rendered as {name}, and a JSON.stringify literal are all found', () => {
  const text = [
    'const theme = `{ "spacing": { "1": "1px" } }`',
    'export const A = () => (<div>',
    '  <pre><code className="language-json">{theme}</code></pre>',
    '  <pre><code className="language-css">{`.a { padding: space(1); }`}</code></pre>',
    '  <pre><code className="language-json">{JSON.stringify({ spacing: { 2: "2px" } }, null, 2)}</code></pre>',
    '  <pre><code className="language-css">{`.b { padding: ${dynamic}; }`}</code></pre>',
    '</div>)',
  ].join('\n');
  const found = extractJsx(text);
  assert.deepEqual(found.map((b) => b.lang), ['json', 'css', 'json'], 'the ${…} example is built at runtime and is not a static example');
  assert.deepEqual(JSON.parse(found[2].code), { spacing: { 2: '2px' } });
});

test('a valid example holds; an unknown token fails, and says so', async () => {
  assert.deepEqual(await runExample({ code: '.a { padding: density(2); }', theme: null }), []);
  const problems = await runExample({ code: '.a { background: palette(nope.main); }', theme: null });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /fails to compile as shown/);
});

test('an example is compiled against the theme excerpt shown for it — and fails without it', async () => {
  const code = '.a { padding: density(99); }';
  const theme = { densities: { 99: 'xs(space(3)) md(space(4))' } };
  assert.deepEqual(await runExample({ code, theme }), []);
  assert.equal((await runExample({ code, theme: null })).length, 1, 'negative control: the same CSS without its excerpt must fail');
});

test('a documented error must be that exact error', async () => {
  const ok = '.a { padding: xs(1rem) xxl(2rem); }  /* UXD_BREAKPOINT_UNKNOWN: xxl is not configured */';
  assert.deepEqual(await runExample({ code: ok, theme: null }), []);

  const wrongCode = '.a { padding: xs(1rem) xxl(2rem); }  /* UXD_DIRECTIVE_CONTEXT: not what happens */';
  const [wrong] = await runExample({ code: wrongCode, theme: null });
  assert.match(wrong, /documented as UXD_DIRECTIVE_CONTEXT but fails with UXD_BREAKPOINT_UNKNOWN/);

  const notAnError = '.a { padding: density(2); }  /* UXD_DIRECTIVE_CONTEXT: this actually compiles */';
  const [noFail] = await runExample({ code: notAnError, theme: null });
  assert.match(noFail, /documented as UXD_DIRECTIVE_CONTEXT but compiles/);
});

test('in a block that documents an error, every other statement must still compile', async () => {
  const code = ['.a { padding: density(2); }            /* fine */', '.b { padding: xs(1rem) xxl(2rem); }  /* UXD_BREAKPOINT_UNKNOWN: xxl */', '.c { background: palette(nope.main); }'].join('\n');
  const problems = await runExample({ code, theme: null });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /palette\(nope\.main\).*fails to compile as shown/);
});

test('a claimed output (`/* var(--…) */`) must appear in the compiled CSS', async () => {
  const good = '.a { color: color(gray-300); }  /* var(--uxdsl__color__gray-300) */';
  assert.deepEqual(await runExample({ code: `${good}\n.b { padding: xs(1rem) xxl(2rem); }  /* UXD_BREAKPOINT_UNKNOWN */`, theme: null }), []);
  const bad = '.a { color: color(gray-300); }  /* var(--uxdsl__color__gray-999) */\n.b { padding: xs(1rem) xxl(2rem); }  /* UXD_BREAKPOINT_UNKNOWN */';
  const [problem] = await runExample({ code: bad, theme: null });
  assert.match(problem, /documented as producing var\(--uxdsl__color__gray-999\) but does not/);
});

test('statementsOf keeps @theme with every statement and reads only same-line trailing comments', () => {
  const found = statementsOf('@theme { space-1: 4px; }\n.a { padding: space(1); }  /* UXD_X: boom */\n/* not trailing */\n.b { color: red; }');
  assert.equal(found.length, 2);
  assert.match(found[0].css, /@theme/);
  assert.equal(found[0].expectCode, 'UXD_X');
  assert.equal(found[1].expectCode, null);
});

// --- 2. the real documentation --------------------------------------------

const surfaces = discoverSurfaces();
let report;
const verified = async () => (report = report || (await verifySurfaces(surfaces)));

test('every documentation surface with examples is found (the extractor cannot silently find nothing)', async () => {
  const { examples } = await verified();
  const per = {};
  for (const example of examples) per[example.file] = (per[example.file] || 0) + 1;
  // Floors, not exact counts: removing an example is fine; the extractor breaking is not.
  const floors = {
    'AGENTS.md': 8,
    'packages/postcss-uxdsl/README.md': 8,
    'packages/uxdsl-cli/README.md': 1,
    'packages/playground-nextjs/src/components/ButtonDocumentation.tsx': 2,
    'packages/playground-nextjs/src/components/SurfaceDocumentation.tsx': 3,
    'packages/playground-nextjs/src/components/ColorDocumentation.tsx': 1,
  };
  for (const [file, floor] of Object.entries(floors)) assert.ok((per[file] || 0) >= floor, `${file}: expected at least ${floor} examples, found ${per[file] || 0}`);
  assert.ok(examples.length >= 40, `expected at least 40 examples across the documentation, found ${examples.length}`);
});

test('every UXDSL example in the documentation compiles as shown, or fails with the error it documents', async () => {
  const { problems } = await verified();
  assert.deepEqual(problems.map((p) => `${p.file}:${p.line}  ${p.problem}`), []);
});

test('every theme excerpt shown in the documentation is itself a valid theme', async () => {
  const { themes } = await verified();
  assert.ok(themes.length >= 20, `expected at least 20 theme excerpts, found ${themes.length}`);
  assert.deepEqual(validateThemes(themes).map((p) => `${p.file}:${p.line}  ${p.problem}`), []);
});

// --- 3. the guide's own alignment list -------------------------------------

test('AGENTS.md: every file it tells contributors to keep aligned exists', () => {
  const text = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  const section = text.slice(text.indexOf('Review these documentation sources'));
  const listed = [...section.slice(0, section.indexOf('\n\n', section.indexOf('- `'))).matchAll(/^- `([^`]+)`$/gm)].map((m) => m[1]);
  const all = [...section.matchAll(/^- `(packages\/[^`]+)`$/gm)].map((m) => m[1]);
  assert.ok(listed.length >= 11 || all.length >= 11, 'the list itself was not found');
  const missing = all.filter((file) => !fs.existsSync(path.join(ROOT, file)));
  assert.deepEqual(missing, [], 'AGENTS.md lists a file that does not exist');
});
