'use strict';

// MIG-B3-01 (FEAT-004): structural regression guard. `includeTheme` went
// unreachable from the CLI for an entire release because `buildOnce` bridged
// config to the plugin through a hardcoded allowlist of keys, and nothing
// caught a new plugin option falling outside that list. This test enumerates
// `UxDslOptions` from postcss-uxdsl's own source and fails if a forwardable
// key isn't literally present in the object literal `uxdsl.js` passes to
// `uxdslPlugin(...)`, so the next new option can't go silently unreachable
// the same way.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_SRC = path.resolve(__dirname, '..', '..', 'postcss-uxdsl', 'src', 'index.ts');
const CLI_SRC = path.resolve(__dirname, '..', 'bin', 'uxdsl.js');

// Function-valued escape hatches (custom var-name generators). These are
// legitimately callable from a project's own postcss.config.js/direct plugin
// use, but forwarding them through a CommonJS `uxdsl.config.cjs` is a
// separate, unscoped feature (FEAT-004 doesn't ask for it) — excluded here
// on purpose, not by oversight. Every other option must be forwarded.
const KNOWN_UNFORWARDED_PLUGIN_OPTIONS = new Set(['themeVar', 'spaceVar', 'colorVar']);

function extractInterfaceKeys(source, interfaceName) {
  const match = source.match(new RegExp(`interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `could not find "interface ${interfaceName}" in ${PLUGIN_SRC} — did it get renamed?`);
  const body = match[1];
  const keys = [];
  const lineRe = /^\s*(\w+)\??:/gm;
  let m;
  while ((m = lineRe.exec(body))) keys.push(m[1]);
  assert.ok(keys.length > 0, `found "interface ${interfaceName}" but extracted no keys — check the parsing regex`);
  return keys;
}

function extractForwardedKeys(source) {
  const match = source.match(/uxdslPlugin\(\{([\s\S]*?)\}\)/);
  assert.ok(match, `could not find a "uxdslPlugin({ ... })" call in ${CLI_SRC}`);
  const body = match[1];
  const keys = [];
  const lineRe = /^\s*(\w+)[,:]/gm;
  let m;
  while ((m = lineRe.exec(body))) keys.push(m[1]);
  return keys;
}

test('MIG-B3-01: every forwardable UxDslOptions key is reachable from the CLI\'s uxdslPlugin(...) call', () => {
  const pluginSource = fs.readFileSync(PLUGIN_SRC, 'utf8');
  const cliSource = fs.readFileSync(CLI_SRC, 'utf8');

  const optionKeys = extractInterfaceKeys(pluginSource, 'UxDslOptions');
  const forwardedKeys = new Set(extractForwardedKeys(cliSource));

  const missing = optionKeys.filter(
    (key) => !KNOWN_UNFORWARDED_PLUGIN_OPTIONS.has(key) && !forwardedKeys.has(key)
  );

  assert.deepEqual(
    missing,
    [],
    `UxDslOptions key(s) ${JSON.stringify(missing)} are not forwarded by the CLI's uxdslPlugin(...) call in ${CLI_SRC}. ` +
    'Either forward them in buildOnce(), or add them to KNOWN_UNFORWARDED_PLUGIN_OPTIONS with a reason.'
  );
});
