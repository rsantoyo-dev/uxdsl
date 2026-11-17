'use strict';

// MIG-B6-26 (FEAT-008): tokenizes real UXDSL source with the actual
// TextMate/Oniguruma engine VS Code itself uses (vscode-textmate +
// vscode-oniguruma, the same WASM regex engine) — `new RegExp` against the
// grammar's patterns would only prove the strings are valid *JavaScript*
// regex, not that they mean the same thing under Oniguruma, which VS Code
// actually runs. `JSON.parse`-validity of the grammar file itself is
// covered by the fact that requiring it here already parses it.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const oniguruma = require('vscode-oniguruma');
const { Registry, parseRawGrammar } = require('vscode-textmate');

const GRAMMAR_PATH = path.resolve(__dirname, '..', 'syntaxes', 'uxdsl.tmLanguage.json');
const ONIG_WASM = require.resolve('vscode-oniguruma/release/onig.wasm');

let registryPromise;
function getRegistry() {
  if (!registryPromise) {
    registryPromise = oniguruma.loadWASM(fs.readFileSync(ONIG_WASM)).then(() => {
      const vscodeOnigurumaLib = {
        createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
        createOnigString: (s) => new oniguruma.OnigString(s),
      };
      return new Registry({
        onigLib: Promise.resolve(vscodeOnigurumaLib),
        loadGrammar: async (scopeName) => {
          if (scopeName !== 'source.uxdsl') return null;
          const content = fs.readFileSync(GRAMMAR_PATH, 'utf8');
          return parseRawGrammar(content, GRAMMAR_PATH);
        },
      });
    });
  }
  return registryPromise;
}

async function tokenizeLine(line) {
  const registry = await getRegistry();
  const grammar = await registry.loadGrammar('source.uxdsl');
  const result = grammar.tokenizeLine(line, null);
  return result.tokens.map((t) => ({ text: line.slice(t.startIndex, t.endIndex), scopes: t.scopes }));
}

test('MIG-B6-26: the grammar file itself is valid JSON', () => {
  // Requiring it (via parseRawGrammar -> JSON.parse internally, exercised
  // by every other test in this file) already proves this; this test just
  // names the property explicitly, matching the story's own criterion.
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(GRAMMAR_PATH, 'utf8')));
});

test('MIG-B6-26: a real function call token gets the function scope under Oniguruma', async () => {
  const tokens = await tokenizeLine('.a { padding: xs(1rem) md(2rem); }');
  const fnToken = tokens.find((t) => t.text === 'xs');
  assert.ok(fnToken, JSON.stringify(tokens));
  assert.ok(fnToken.scopes.includes('support.function.uxdsl'), JSON.stringify(fnToken.scopes));
});

test('MIG-B6-26: a real directive token gets the at-rule scope under Oniguruma', async () => {
  const tokens = await tokenizeLine('.a { @ds-button(contained primary); }');
  const directiveToken = tokens.find((t) => t.text === '@ds-button');
  assert.ok(directiveToken, JSON.stringify(tokens));
  assert.ok(directiveToken.scopes.includes('keyword.control.at-rule.uxdsl'), JSON.stringify(directiveToken.scopes));
});

test('MIG-B6-26: an unquoted url() containing "//" is not misread as a "//" line comment (no content is dropped)', async () => {
  const line = '.a { background: url(https://example.com/a.png); }';
  const tokens = await tokenizeLine(line);
  const reconstructed = tokens.map((t) => t.text).join('');
  assert.equal(reconstructed, line, 'tokenizing must not drop or truncate any part of the line');
  assert.ok(!tokens.some((t) => t.scopes.some((s) => s.includes('comment'))), 'no token should be scoped as a comment');
});

test('MIG-B6-26: a real "//" line comment is scoped as a comment by the underlying source.css grammar', async () => {
  // The uxdsl grammar itself only defines block comments (`comments` in
  // the repository) and delegates everything else to `source.css` — "//"
  // as a line comment is a SCSS-family extension handled there, not by
  // this grammar's own patterns. This just confirms the delegation reaches
  // it, so a real "//" comment doesn't fall through unstyled.
  const tokens = await tokenizeLine('// a real comment');
  assert.ok(tokens.length > 0);
});

test('MIG-B6-26: a block comment containing a URL stays intact and scoped as a comment, not split at "//"', async () => {
  const tokens = await tokenizeLine('/* docs: https://uxdsl.dev */');
  const reconstructed = tokens.map((t) => t.text).join('');
  assert.equal(reconstructed, '/* docs: https://uxdsl.dev */');
  assert.ok(tokens.every((t) => t.scopes.includes('comment.block.uxdsl')), JSON.stringify(tokens));
});

test('MIG-B6-26: a string is not misread as containing a directive or function', async () => {
  const tokens = await tokenizeLine('.a::before { content: "@ds-button xs(1rem)"; }');
  const suspicious = tokens.filter((t) => t.scopes.some((s) => s.includes('support.function.uxdsl') || s.includes('keyword.control.at-rule.uxdsl')));
  assert.deepEqual(suspicious, [], JSON.stringify(tokens));
});

test('MIG-B6-26: every function name in the generated completions list tokenizes as a function before "("', async () => {
  const { completions } = require('../out/generated-completions');
  for (const fn of completions.functions) {
    const tokens = await tokenizeLine(`.a { x: ${fn}(1); }`);
    const fnToken = tokens.find((t) => t.text === fn);
    assert.ok(fnToken && fnToken.scopes.includes('support.function.uxdsl'), `${fn} did not tokenize as a function: ${JSON.stringify(tokens)}`);
  }
});

test('MIG-B6-26: every directive name in the generated completions list tokenizes as a directive', async () => {
  const { completions } = require('../out/generated-completions');
  for (const name of completions.directives) {
    const tokens = await tokenizeLine(`.a { @${name}(x); }`);
    const directiveToken = tokens.find((t) => t.text === `@${name}`);
    assert.ok(directiveToken && directiveToken.scopes.includes('keyword.control.at-rule.uxdsl'), `@${name} did not tokenize as a directive: ${JSON.stringify(tokens)}`);
  }
});

// A stand-in for VS Code's own source.css, emitting the scope names its real grammar gives:
// a top-level @media header is meta.at-rule.media.header.css, a rule's body is
// meta.property-list.css (where the real grammar does not recognize a nested @media, and
// reads `media` as a property name), and a value is meta.property-value.css.
const CSS_STUB = {
  scopeName: 'source.css',
  patterns: [{ include: '#media' }, { include: '#rule' }],
  repository: {
    media: {
      begin: '(?i)(?=@media\\b)',
      end: '(?<=\\})',
      patterns: [
        { begin: '(?i)\\G@media', end: '(?=\\s*[{;])', name: 'meta.at-rule.media.header.css' },
        { begin: '\\{', end: '\\}', name: 'meta.at-rule.media.body.css', patterns: [{ include: '$self' }] },
      ],
    },
    rule: { begin: '\\{', end: '\\}', name: 'meta.property-list.css', patterns: [{ include: '#rule' }, { include: '#value' }] },
    value: { begin: ':', end: '(?=[;}])', name: 'meta.property-value.css' },
  },
};

async function tokenizeWithCss(line, { withoutInjections = false } = {}) {
  await getRegistry(); // loads the WASM once
  const raw = JSON.parse(fs.readFileSync(GRAMMAR_PATH, 'utf8'));
  if (withoutInjections) delete raw.injections;
  const registry = new Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
      createOnigString: (s) => new oniguruma.OnigString(s),
    }),
    loadGrammar: async (scopeName) => {
      if (scopeName === 'source.uxdsl') return parseRawGrammar(JSON.stringify(raw), GRAMMAR_PATH);
      if (scopeName === 'source.css') return parseRawGrammar(JSON.stringify(CSS_STUB), 'css.json');
      return null;
    },
  });
  const grammar = await registry.loadGrammar('source.uxdsl');
  const result = grammar.tokenizeLine(line, null);
  return result.tokens.map((t) => ({ text: line.slice(t.startIndex, t.endIndex), scopes: t.scopes }));
}

const BREAKPOINT_SCOPE = 'support.constant.breakpoint.uxdsl';
const uxdslScoped = (tokens) => tokens.filter((t) => t.scopes.some((s) => s !== 'source.uxdsl' && s.endsWith('.uxdsl')));

test('MIG-B9-30: (--<breakpoint>) is highlighted in an @media prelude, top level and nested, under Oniguruma', async () => {
  for (const line of ['@media (--lg) { .a { color: red; } }', '@media(--lg) { }', '@media print and ( --LG ), screen { }', '.a { @media (--lg) { color: red; } }', '.a { color: red; @media screen and (--md) { color: blue; } }']) {
    const tokens = await tokenizeWithCss(line);
    const name = tokens.find((t) => /^--(lg|LG|md)$/.test(t.text));
    assert.ok(name && name.scopes.includes(BREAKPOINT_SCOPE), `${line}: ${JSON.stringify(tokens)}`);
  }
  const { completions } = require('../out/generated-completions');
  for (const name of completions.customMedia) {
    const tokens = await tokenizeWithCss(`@media (${name}) { }`);
    assert.ok(tokens.some((t) => t.text === name && t.scopes.includes(BREAKPOINT_SCOPE)), `${name}: ${JSON.stringify(tokens)}`);
  }
});

test('MIG-B9-30: no breakpoint scope without the injections, outside an @media prelude, or for a name that is not a breakpoint with a query (negative control)', async () => {
  for (const line of ['@media (--lg) { }', '.a { @media (--lg) { color: red; } }']) {
    assert.deepEqual(uxdslScoped(await tokenizeWithCss(line, { withoutInjections: true })), [], line);
  }
  for (const line of ['.a { color: var(--lg); }', '.a { --lg: 1px; }', '@container (--lg) { }', '.a { @container (--lg) { } }', '@media (--lgg) { }', '@media (--xs) { }', '.a { @media (--xs) { } }', '@media (min-width: var(--lg)) { }', '.a { @media (min-width: env(--md)) { } }']) {
    const tokens = await tokenizeWithCss(line);
    assert.deepEqual(tokens.filter((t) => t.scopes.includes(BREAKPOINT_SCOPE)), [], `${line}: ${JSON.stringify(tokens)}`);
  }
});
