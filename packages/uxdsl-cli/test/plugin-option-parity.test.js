'use strict';

// MIG-B3-01 (FEAT-004): structural regression guard. `includeTheme` went
// unreachable from the CLI for an entire release because `buildOnce` bridged
// config to the plugin through a hardcoded allowlist of keys, and nothing
// caught a new plugin option falling outside that list. This test enumerates
// `UxDslOptions` from postcss-uxdsl's own source and fails if a forwardable
// key isn't literally present in the object literal that ends up calling
// `uxdslPlugin(...)`.
//
// MIG-B6-18 (FEAT-008) update: the CLI no longer calls `uxdslPlugin(...)`
// directly — `uxdsl-core`'s shared `compile()` does, and the CLI forwards
// its own config into `compile()` instead. The guard now checks both
// links in that chain: uxdsl-core's own `uxdslPlugin({...})` call still
// forwards every `UxDslOptions` key (so the plugin's own contract can't
// silently drift, same as before), and the CLI's `uxdslCore.compile(...)`
// call still forwards every one of those same keys through to `compile()`'s
// `config` argument (so *this* boundary can't quietly become the next
// place a key like `includeTheme` goes unreachable from).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// MIG-B6-27 (FEAT-008): the interface moved out of the plugin's index.ts into
// its public `types.ts` and was renamed `UxdslOptions` (`UxDslOptions` is now a
// deprecated alias). This guard is pointed at the new home rather than relaxed:
// it caught the move on the first run, which is exactly what it is for.
const PLUGIN_SRC = path.resolve(__dirname, '..', '..', 'postcss-uxdsl', 'src', 'types.ts');
const CORE_SRC = path.resolve(__dirname, '..', '..', 'uxdsl-core', 'src', 'index.ts');
const CLI_SRC = path.resolve(__dirname, '..', 'bin', 'uxdsl.js');

// Function-valued escape hatches (custom var-name generators). These are
// legitimately callable from a project's own postcss.config.js/direct plugin
// use, but forwarding them through a CommonJS `uxdsl.config.cjs` (or
// `compile()`'s own JSON-shaped config) is a separate, unscoped feature
// (FEAT-004 doesn't ask for it) — excluded here on purpose, not by oversight.
//
// MIG-B6-19 (FEAT-008): `discoverTheme`/`configRoot` control the plugin's
// own theme *discovery* for when it's used directly with no `theme`
// option at all (e.g. a project's own postcss.config.js). The CLI/core
// path always resolves and passes an explicit `theme` itself (its own
// uxdsl.config.cjs/uxdsl.theme.config.* discovery, now shared with the
// plugin via postcss-uxdsl/config — see loadConfig/discoverThemeAsync), so
// these two never have anything to do there; forwarding them would be
// dead weight, not a fix for a real gap.
//
// Every other option must be forwarded.
const KNOWN_UNFORWARDED_PLUGIN_OPTIONS = new Set(['themeVar', 'spaceVar', 'colorVar', 'discoverTheme', 'configRoot']);

function extractInterfaceKeys(source, interfaceName, fromFile) {
  const match = source.match(new RegExp(`interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `could not find "interface ${interfaceName}" in ${fromFile} — did it get renamed?`);
  const body = match[1];
  const keys = [];
  const lineRe = /^\s*(\w+)\??:/gm;
  let m;
  while ((m = lineRe.exec(body))) keys.push(m[1]);
  assert.ok(keys.length > 0, `found "interface ${interfaceName}" but extracted no keys — check the parsing regex`);
  return keys;
}

function extractObjectLiteralKeys(source, callPattern, describeFor) {
  const match = source.match(callPattern);
  assert.ok(match, `could not find a "${describeFor}" call`);
  const body = match[1];
  const keys = [];
  const lineRe = /^\s*(\w+)[,:]/gm;
  let m;
  while ((m = lineRe.exec(body))) keys.push(m[1]);
  return keys;
}

test('MIG-B3-01: every forwardable UxdslOptions key is reachable from uxdsl-core\'s uxdslPlugin(...) call', () => {
  const pluginSource = fs.readFileSync(PLUGIN_SRC, 'utf8');
  const coreSource = fs.readFileSync(CORE_SRC, 'utf8');

  const optionKeys = extractInterfaceKeys(pluginSource, 'UxdslOptions', PLUGIN_SRC);
  const forwardedKeys = new Set(extractObjectLiteralKeys(coreSource, /uxdslPlugin\(\{([\s\S]*?)\}\)/, 'uxdslPlugin({ ... }) in ' + CORE_SRC));

  const missing = optionKeys.filter(
    (key) => !KNOWN_UNFORWARDED_PLUGIN_OPTIONS.has(key) && !forwardedKeys.has(key)
  );

  assert.deepEqual(
    missing,
    [],
    `UxdslOptions key(s) ${JSON.stringify(missing)} are not forwarded by uxdsl-core's uxdslPlugin(...) call in ${CORE_SRC}. ` +
    'Either forward them in compile(), or add them to KNOWN_UNFORWARDED_PLUGIN_OPTIONS with a reason.'
  );
});

test('MIG-B6-18: every one of those same UxdslOptions keys is also forwarded by the CLI\'s uxdslCore.compile(...) call', () => {
  const pluginSource = fs.readFileSync(PLUGIN_SRC, 'utf8');
  const cliSource = fs.readFileSync(CLI_SRC, 'utf8');

  const optionKeys = extractInterfaceKeys(pluginSource, 'UxdslOptions', PLUGIN_SRC);
  // The CLI's compile() call passes { entry } as the first argument and a
  // config object as the second — the second (curly) argument is what a
  // plugin option must appear in.
  const forwardedKeys = new Set(extractObjectLiteralKeys(
    cliSource,
    /uxdslCore\.compile\(\s*\{[\s\S]*?\},\s*\{([\s\S]*?)\}\s*\)/,
    'uxdslCore.compile({ entry }, { ... }) in ' + CLI_SRC
  ));

  const missing = optionKeys.filter(
    (key) => !KNOWN_UNFORWARDED_PLUGIN_OPTIONS.has(key) && !forwardedKeys.has(key)
  );

  assert.deepEqual(
    missing,
    [],
    `UxdslOptions key(s) ${JSON.stringify(missing)} are not forwarded by the CLI's uxdslCore.compile(...) call in ${CLI_SRC}. ` +
    'Either forward them in compileEntryToCss(), or add them to KNOWN_UNFORWARDED_PLUGIN_OPTIONS with a reason.'
  );
});
