#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const chokidar = require('chokidar');
const postcss = require('postcss');
const { createRequire } = require('module');

// Project's own postcss-uxdsl install first (so `theme`'s introspection and
// the actual build always agree on which install is authoritative), the
// CLI-bundled copy as a fallback for older/partial project installs.
function resolveUxDslModule(specifier, { warnLabel } = {}) {
  try {
    const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
    const resolved = projectRequire.resolve(specifier);
    const mod = projectRequire(resolved);
    if (process.env.UXDSL_DEBUG) {
      console.log(`[uxdsl] using ${specifier} from ${resolved}`);
    }
    return mod;
  } catch (_) {
    // Fall through to the CLI-bundled copy below.
  }

  const localPath = (() => {
    try {
      return require.resolve(specifier, { paths: [__dirname] });
    } catch (_) {
      return null;
    }
  })();
  if (localPath) {
    if (process.env.UXDSL_DEBUG) {
      console.warn(`[uxdsl] Using CLI-bundled ${warnLabel || specifier}.`);
    }
    return require(localPath);
  }
  return null;
}

function loadUxDslPlugin() {
  const plugin = resolveUxDslModule('postcss-uxdsl', { warnLabel: 'postcss-uxdsl' });
  if (!plugin) {
    throw new Error('postcss-uxdsl package not found. Install it in your project or alongside the CLI.');
  }
  return plugin;
}

// MIG-B3-04 (FEAT-004): `uxdsl theme` needs `resolveTheme`/`DEFAULT_THEME`
// from the exact same postcss-uxdsl install the actual build resolves —
// resolveUxDslModule's project-first order guarantees introspection can
// never silently disagree with what `uxdsl build` itself would produce.
function loadUxDslRuntime() {
  return resolveUxDslModule('postcss-uxdsl/ds-runtime', { warnLabel: 'postcss-uxdsl/ds-runtime' });
}

// MIG-B6-18 (FEAT-008): the CLI's own build pipeline (postcss-scss syntax,
// postcss-import, postcss-advanced-variables, postcss-uxdsl) is retired in
// favor of uxdsl-core's compile() — the exact same pipeline, now shared
// with any other adapter (Vite/Webpack, MIG-B6-20) instead of drifting
// independently. Same project-first resolution order as postcss-uxdsl
// itself, for the same reason: a project's own uxdsl-core install (or the
// version this CLI release pins) must be the one actually compiling.
function loadUxDslCore() {
  const core = resolveUxDslModule('uxdsl-core', { warnLabel: 'uxdsl-core' });
  if (!core || typeof core.compile !== 'function') {
    throw new Error('uxdsl-core package (with a compile() export) not found. Install it in your project or alongside the CLI.');
  }
  return core;
}

// MIG-B6-19 (FEAT-008): theme-file discovery/loading — candidates, module
// loading, `{ theme, references }`/bare-theme normalization, the
// looks-like-a-build-config warning — moved to postcss-uxdsl/config so the
// plugin itself can discover a project's theme too, without duplicating
// (and risking drifting from) this exact contract. The CLI keeps its own
// build-config (uxdsl.config.cjs) discovery and build/watch orchestration.
function loadUxDslConfig() {
  const mod = resolveUxDslModule('postcss-uxdsl/config', { warnLabel: 'postcss-uxdsl/config' });
  if (!mod || typeof mod.discoverThemeAsync !== 'function') {
    throw new Error(
      'postcss-uxdsl/config (with discoverThemeAsync) not found. Install postcss-uxdsl 0.5.0-beta.6 ' +
      'or later in your project, or alongside the CLI.'
    );
  }
  return mod;
}

const uxdslPlugin = loadUxDslPlugin();
const uxdslRuntime = loadUxDslRuntime() || {};
const uxdslCore = loadUxDslCore();
const uxdslConfig = loadUxDslConfig();

// MIG-B6-01 (FEAT-008): the shared top-level family registry the compiler
// itself validates against. Only defined when the resolved postcss-uxdsl
// install is new enough to export it — an older install falls back to
// `undefined`, in which case callers skip family-name validation entirely
// rather than reject every family name as unknown.
function getKnownThemeFamilies() {
  return uxdslRuntime.KNOWN_THEME_FAMILIES instanceof Set ? uxdslRuntime.KNOWN_THEME_FAMILIES : undefined;
}

// MIG-B6-22 (FEAT-008): same edit-distance-based suggestion shape as
// postcss-uxdsl's own diagnostics (`closestKey` in src/diagnostics.ts) —
// duplicated in a handful of lines here because that module has no public
// export path a CLI dependency could import (postcss-uxdsl's package export
// is the PostCSS plugin function itself, nothing else). Used both for
// unknown-flag suggestions and unknown-theme-family suggestions.
function editDistance(left, right) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= right.length; column++) rows[0][column] = column;
  for (let row = 1; row <= left.length; row++) {
    for (let column = 1; column <= right.length; column++) {
      const substitution = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + substitution,
      );
    }
  }
  return rows[left.length][right.length];
}

function closestMatch(value, candidates) {
  let closest;
  let distance = 3;
  for (const candidate of candidates) {
    const candidateDistance = editDistance(value.toLowerCase(), candidate.toLowerCase());
    if (candidateDistance > 2 || candidateDistance >= distance) continue;
    closest = candidate;
    distance = candidateDistance;
  }
  return closest;
}

// Two files, two jobs (stability phase 2, DE-10): the build config says what
// to compile and where (entry/outFile/builds/watch/references/strictTheme/
// sourceMap); the theme file next to it holds the theme, breakpoints
// included. The build config is JavaScript only — a `.json` build config was
// a third spelling of the same thing, and the theme file already covers the
// "plain data" case.
const CONFIG_CANDIDATES = [
  'uxdsl.config.cjs',
  'uxdsl.config.js',
];

// The theme-file candidate list lives in postcss-uxdsl/config (the plugin
// discovers the same file) — re-exported here so tests/tooling that reference
// `THEME_CANDIDATES` from this module keep working against the one real list.
const THEME_CANDIDATES = uxdslConfig.THEME_CANDIDATES;

// Build-config keys that used to exist and now have another home. Each is a
// hard error naming that home, never a silent no-op: a `theme:` that nobody
// reads would compile the project against the wrong theme without a word.
const REMOVED_CONFIG_KEYS = {
  theme: 'put the theme in a theme file next to this config (uxdsl.theme.json, or uxdsl.theme.config.{js,cjs} exporting the theme object)',
  themeFile: 'name the theme file uxdsl.theme.json or uxdsl.theme.config.{js,cjs} next to this config; it is discovered automatically',
  breakpoints: 'declare "breakpoints" in the theme file — the theme is the one source of thresholds for every integration',
  output: 'use "outFile"',
  sourceMap: 'the key is spelled "sourcemap", like the --sourcemap flag',
};

// Commands that used to exist. Each maps to what replaces it, so the error is
// one line with the answer in it.
const REMOVED_COMMANDS = {
  watch: 'uxdsl build --watch',
};

const DEFAULT_ENTRY_REL = path.join('src', 'uxdsl-entry.uxdsl');
const DEFAULT_OUT_REL = path.join('src', 'uxdsl.css');

const CLI_VERSION = require('../package.json').version;

// Help is per command: `uxdsl --help` lists the commands and the global flags;
// `uxdsl <command> --help` prints that command's options and nothing else.
// The capability matrix (scripts/lib/capabilities.js) reads both, so a flag
// documented here is a flag the playground has to show.
const GENERAL_HELP = `Usage: uxdsl <command> [options]

Commands:
  init              First-run setup: uxdsl.config.cjs, src/styles.uxdsl (the file you
                    edit), the generated src/uxdsl-entry.uxdsl that imports it and,
                    in a Next.js project, postcss.config.js. Never overwrites a file.
  generate-entry    Rewrite the entry file's @import list from the .uxdsl files
                    found under a directory. Run it after adding or removing files.
  build             Compile the entry (or every entry in "builds") to CSS, once;
                    --watch keeps rebuilding as files change.
  theme             Print the effective theme as JSON: the same discovery and
                    resolution as build, no CSS written.

Global options:
  --help, -h        This help. "uxdsl <command> --help" describes one command.
  --version, -v     Print the versions of uxdsl-cli and the packages it resolved.

Set UXDSL_DEBUG=1 to log which config and theme files were discovered.
An unrecognized flag, or a flag used on the wrong command, fails with a
suggestion instead of being ignored.
`;

const COMMAND_HELP = {
  init: `Usage: uxdsl init [--multi]

Creates, without ever overwriting an existing file:
  uxdsl.config.cjs         the build config (typed; your editor checks it)
  src/styles.uxdsl         the file you edit — imported by the generated entry
  src/uxdsl-entry.uxdsl    generated by "generate-entry"; do not edit it
  postcss.config.js        Next.js projects only: Next's own default plugins
                           plus postcss-uxdsl, since a custom file replaces
                           Next's defaults
and adds the uxdsl:build / uxdsl:watch scripts to package.json when missing.

Options:
  --multi           Scaffold a theme entry plus one example component entry
                    (a "builds" array) instead of the single-entry form.
`,
  'generate-entry': `Usage: uxdsl generate-entry [--src <dir>] [--out <file>] [--exclude <a,b>]

Rewrites the entry file's @import list to match every .uxdsl file found.

Options:
  --src             Source directory to scan (default: ./src)
  --out, -o         Output file path (default: ./src/uxdsl-entry.uxdsl)
  --exclude         Comma-separated list of file names to leave out
`,
  build: `Usage: uxdsl build [options]

Compiles the entry from uxdsl.config.cjs (or --config, or --entry/--out) to
one CSS file. The theme comes from the theme file next to the config
(uxdsl.theme.json, or uxdsl.theme.config.cjs/.js exporting the theme).

Options:
  --config, -c      Path to the build config (default: uxdsl.config.cjs or
                    uxdsl.config.js in the current directory).
  --entry, -e       Entry .uxdsl file; with --out, compiles it without a config.
  --out, -o         Output CSS file path (with --entry).
  --watch, -w       Rebuild on file changes. Survives a broken edit: the last
                    good CSS stays on disk until the next valid save.
  --include-theme, --no-include-theme
                    Emit (or skip) the global :root token definitions.
                    Default true. Pass --no-include-theme for a component or
                    CSS-Module entry that consumes tokens another entry
                    defines. Overrides "includeTheme" in the config.
  --sourcemap, --sourcemap=inline, --no-sourcemap
                    Emit a source map. Bare --sourcemap means "external":
                    writes <outFile>.map and a sourceMappingURL comment;
                    =inline embeds it as a data URI. Default off. Overrides
                    "sourcemap" in the config.
  --strict-theme=<family,...>, --no-strict-theme
                    Fail the build, before writing anything, when one of the
                    named theme families is only partly declared by the
                    project and the rest was filled from the base theme
                    (e.g. --strict-theme=palette,breakpoints). A scope is
                    required: the theme model is partial overrides, so an
                    unscoped check flagged the recommended usage as
                    incomplete. --no-strict-theme turns off "strictTheme"
                    from the config for one run.
`,
  theme: `Usage: uxdsl theme [--config <file>] [--diff | --contrast] [--strict-theme=<family,...>]

Prints the effective theme as JSON on stdout — the base theme with the
project's theme file merged over it — using the same discovery as build,
without writing CSS. Works from a theme file alone, with no build config.
Unknown theme families are reported on stderr, as build reports them.

Options:
  --config, -c      Path to the build config, when the theme file sits next
                    to a config outside the current directory.
  --diff            Print only the families the theme file mentions, one row
                    per leaf labeled "project" or "default"; a family mixing
                    both is summarized on stderr. $schema is not a leaf.
  --contrast        Check the effective theme's text and border pairs against
                    WCAG, print the JSON report and exit 1 if any pair fails
                    or a shipped exception is stale. Pairs a shipped exception
                    covers are listed under "excepted", never counted as
                    passing. Cannot be combined with --diff or --strict-theme.
  --strict-theme=<family,...>
                    Exit non-zero when one of the named families is only
                    partly declared by the project. Same check as build's.
`,
};

function printHelp(command) {
  console.log(command && COMMAND_HELP[command] ? COMMAND_HELP[command] : GENERAL_HELP);
}

function resolvedVersion(specifier) {
  try {
    const mod = resolveUxDslModule(`${specifier}/package.json`);
    return mod && mod.version ? mod.version : 'not found';
  } catch (_) {
    return 'not found';
  }
}

function printVersion() {
  console.log(`uxdsl-cli ${CLI_VERSION}`);
  console.log(`postcss-uxdsl ${resolvedVersion('postcss-uxdsl')}`);
  console.log(`uxdsl-core ${resolvedVersion('uxdsl-core')}`);
}

function resolvePath(maybePath, baseDir) {
  if (!maybePath) return undefined;
  return path.isAbsolute(maybePath)
    ? maybePath
    : path.resolve(baseDir, maybePath);
}

function findConfigPath(cwd) {
  for (const candidate of CONFIG_CANDIDATES) {
    const full = path.resolve(cwd, candidate);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

// MIG-B6-19 (FEAT-008): theme candidate lookup, module loading/normalizing
// and the looks-like-a-build-config warning all moved to
// postcss-uxdsl/config — re-exported here so existing tests/call sites in
// this file keep working unchanged against the one real implementation.
const findThemeConfigPath = uxdslConfig.findThemeConfigPath;
const warnIfLooksLikeBuildConfig = uxdslConfig.warnIfLooksLikeBuildConfig;

/** Same CommonJS/`default`-interop/async-function contract as the build
 * config, applied to any config-shaped file. */
async function loadModuleExport(filePath) {
  let mod = require(filePath);
  if (mod && typeof mod === 'object' && 'default' in mod) mod = mod.default;
  if (typeof mod === 'function') mod = await mod();
  return mod;
}

async function loadThemeConfig(themeConfigPath) {
  return uxdslConfig.loadThemeConfigAsync(themeConfigPath);
}

// `entryOrEntries` is a single path for a single-entry config, or (MIG-B3-02)
// an array of paths for a `builds` config — the default watch list then
// covers every entry plus its own directory's *.uxdsl files, deduplicated
// (two build entries commonly share a directory).
function normalizeWatchGlobs(globs, cwd, entryOrEntries) {
  if (Array.isArray(globs) && globs.length > 0) {
    return globs.map((glob) =>
      path.isAbsolute(glob) ? glob : path.resolve(cwd, glob)
    );
  }
  const entries = Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries];
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    const entryDir = path.dirname(entry);
    for (const g of [entry, path.join(entryDir, '**/*.uxdsl')]) {
      if (!seen.has(g)) {
        seen.add(g);
        result.push(g);
      }
    }
  }
  return result;
}

// `themeOnly` is what `uxdsl theme` asks for: the same discovery, but a
// project with a theme file and no build config (or no entry) is a valid
// answer rather than "nothing to build".
async function loadConfig(argv, cwd = process.cwd(), { themeOnly = false } = {}) {
  const directEntry = argv.entry || argv.e;
  const directOut = argv.out || argv.o;
  const configPathArg = argv.config || argv.c;
  const debug = !!process.env.UXDSL_DEBUG;
  let resolvedConfig = {};
  let configPath = null;
  let configModule = null;

  // Raw, unresolved values tracked across every branch below and combined
  // into `resolvedConfig.includeTheme`/`strictTheme`/`sourceMap` in one place
  // — see resolveIncludeTheme/resolveStrictTheme below.
  let rawIncludeTheme;
  let rawStrictTheme;
  let rawSourceMap;

  if (directEntry || directOut) {
    resolvedConfig.entry = resolvePath(directEntry, cwd);
    resolvedConfig.outFile = resolvePath(directOut, cwd);
    resolvedConfig.watch = [];
  } else {
    // MIG-B2-01 item 9: an explicit --config is never silently swapped for
    // another file — a missing one is a hard, clearly-worded error, not a
    // silent fall-through to "no config found".
    if (configPathArg) {
      configPath = resolvePath(configPathArg, cwd);
      if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      if (/\.json$/i.test(configPath)) {
        throw new Error(
          `${configPath}: a build config is a JavaScript module (uxdsl.config.js or uxdsl.config.cjs). ` +
          'JSON is for the theme: put theme data in uxdsl.theme.json next to the build config.'
        );
      }
    } else {
      configPath = findConfigPath(cwd);
    }
    if (configPath) {
      configModule = await loadModuleExport(configPath);
      if (!configModule || typeof configModule !== 'object') {
        throw new Error(`Invalid configuration export in ${configPath}: expected an object (or a function/promise resolving to one).`);
      }
      rejectRemovedConfigKeys(configModule, configPath);
      // MIG-B2-03 item 7: name the file AND the property, not just "invalid
      // configuration" — these two are required for buildOnce to do
      // anything at all, so catch a wrong type here instead of surfacing a
      // confusing failure several steps later.
      if (configModule.entry !== undefined && typeof configModule.entry !== 'string') {
        throw new Error(`Invalid configuration in ${configPath}: "entry" must be a string path.`);
      }
      if (configModule.outFile !== undefined && typeof configModule.outFile !== 'string') {
        throw new Error(`Invalid configuration in ${configPath}: "outFile" must be a string path.`);
      }
      // MIG-B3-01: same treatment as entry/outFile above — a wrong type
      // here used to be silently swallowed by the plugin's own `!== false`
      // check (a typo'd string or number reads as "true"), which is a
      // confusing way to discover a config mistake.
      if (configModule.includeTheme !== undefined && typeof configModule.includeTheme !== 'boolean') {
        throw new Error(`Invalid configuration in ${configPath}: "includeTheme" must be a boolean.`);
      }
      // MIG-B6-21 (FEAT-008): validated here for the same reason as
      // includeTheme — a typo'd value ('External', true) must fail loudly
      // rather than read as "no map" and leave the user hunting for one.
      if (configModule.sourcemap !== undefined && configModule.sourcemap !== false && configModule.sourcemap !== 'inline' && configModule.sourcemap !== 'external') {
        throw new Error(`Invalid configuration in ${configPath}: "sourcemap" must be false, "inline" or "external".`);
      }
      // Shared across every entry (single or `builds`) — the theme is one
      // thing per build, so this is validated once here regardless of which
      // branch below runs. A boolean falls through to
      // normalizeStrictThemeScope, which explains why a scope is required.
      if (
        configModule.strictTheme !== undefined &&
        typeof configModule.strictTheme !== 'boolean' &&
        !(Array.isArray(configModule.strictTheme) && configModule.strictTheme.every((f) => typeof f === 'string'))
      ) {
        throw new Error(`Invalid configuration in ${configPath}: "strictTheme" must be an array of family names (e.g. ['palette', 'breakpoints']).`);
      }
      rawStrictTheme = configModule.strictTheme;
      rawSourceMap = configModule.sourcemap;
      const baseDir = path.dirname(configPath);

      // MIG-B3-02: "builds" is mutually exclusive with top-level entry/
      // outFile/includeTheme — a project declares either one entry inline
      // or a list of them, never both, so there's exactly one place to look
      // for "what does this build actually compile".
      if (configModule.builds !== undefined) {
        if (!Array.isArray(configModule.builds) || configModule.builds.length === 0) {
          throw new Error(`Invalid configuration in ${configPath}: "builds" must be a non-empty array of { entry, outFile } objects.`);
        }
        if (configModule.entry !== undefined || configModule.outFile !== undefined) {
          throw new Error(`Invalid configuration in ${configPath}: "builds" cannot be combined with a top-level "entry"/"outFile" — declare every entry inside "builds" instead.`);
        }
        resolvedConfig.builds = configModule.builds.map((buildEntry, index) => {
          if (!buildEntry || typeof buildEntry !== 'object') {
            throw new Error(`Invalid configuration in ${configPath}: "builds[${index}]" must be an object.`);
          }
          rejectRemovedConfigKeys(buildEntry, configPath, `builds[${index}].`);
          if (typeof buildEntry.entry !== 'string') {
            throw new Error(`Invalid configuration in ${configPath}: "builds[${index}].entry" must be a string path.`);
          }
          if (typeof buildEntry.outFile !== 'string') {
            throw new Error(`Invalid configuration in ${configPath}: "builds[${index}].outFile" must be a string path.`);
          }
          if (buildEntry.includeTheme !== undefined && typeof buildEntry.includeTheme !== 'boolean') {
            throw new Error(`Invalid configuration in ${configPath}: "builds[${index}].includeTheme" must be a boolean.`);
          }
          return {
            entry: resolvePath(buildEntry.entry, baseDir),
            outFile: resolvePath(buildEntry.outFile, baseDir),
            // Resolved to a definite boolean below, alongside the
            // single-entry case — see the `--include-theme` precedence
            // comment near the end of this function.
            includeTheme: buildEntry.includeTheme,
          };
        });
      } else {
        resolvedConfig.entry = resolvePath(configModule.entry, baseDir);
        resolvedConfig.outFile = resolvePath(configModule.outFile, baseDir);
        rawIncludeTheme = configModule.includeTheme;
      }
      resolvedConfig.watch = configModule.watch || [];
      // `references` has exactly one home: the build config. A theme file
      // carries none (its loader refuses the old { theme, references } wrapper).
      resolvedConfig.references = configModule.references;
    }
  }

  // --- The theme file, discovered next to whichever build config was used
  // (the build config's directory when one was found, cwd otherwise), never
  // the CLI package's. It is the only place a theme comes from. ---
  const themeSearchDir = configPath ? path.dirname(configPath) : cwd;
  const themeConfigPath = findThemeConfigPath(themeSearchDir);
  if (themeConfigPath) {
    const { theme: fileTheme } = await loadThemeConfig(themeConfigPath);
    resolvedConfig.theme = fileTheme;
  }

  if (themeOnly) {
    // `uxdsl theme`: the theme (possibly none, meaning the base theme) and
    // where it came from. No entry is needed and none is invented.
    resolvedConfig.configPath = configPath;
    resolvedConfig.themeConfigPath = themeConfigPath;
    return resolvedConfig;
  }

  // --- item 10: a theme file with no uxdsl.config.cjs at all still works,
  // falling back to the conventional entry/output `init` would have
  // created — but only if that entry actually exists; otherwise this is an
  // actionable error, not a silent no-op. ---
  if (!configModule && !resolvedConfig.entry && themeConfigPath) {
    const defaultEntry = path.resolve(cwd, DEFAULT_ENTRY_REL);
    if (!fs.existsSync(defaultEntry)) {
      throw new Error(
        `Found ${path.basename(themeConfigPath)} but no ${path.relative(cwd, defaultEntry)} and no uxdsl.config.cjs. ` +
        'Run "npx uxdsl init" to create the conventional entry, or pass --entry/--out explicitly.'
      );
    }
    resolvedConfig.entry = defaultEntry;
    resolvedConfig.outFile = path.resolve(cwd, DEFAULT_OUT_REL);
    resolvedConfig.watch = [];
  }

  const hasBuilds = Array.isArray(resolvedConfig.builds) && resolvedConfig.builds.length > 0;
  if (!resolvedConfig.entry && !hasBuilds) {
    // No build config, no direct --entry/--out, and no theme file either —
    // same "nothing to build" signal callers already handle (print help).
    return null;
  }

  // A `--include-theme`/`--no-include-theme` flag always wins over the build
  // config's own `includeTheme` — for `builds`, that means the flag overrides
  // every entry uniformly; each entry's own `includeTheme` is only consulted
  // when the flag is absent.
  if (hasBuilds) {
    resolvedConfig.builds = resolvedConfig.builds.map((buildEntry) => ({
      ...buildEntry,
      includeTheme: resolveIncludeTheme(argv['include-theme'], buildEntry.includeTheme),
    }));
  } else {
    resolvedConfig.includeTheme = resolveIncludeTheme(argv['include-theme'], rawIncludeTheme);
  }
  // MIG-B4-01: independent of `builds` — the theme is shared across every
  // entry, so this is resolved once here regardless of single/multi mode.
  resolvedConfig.strictTheme = resolveStrictTheme(argv['strict-theme'], rawStrictTheme, { knownFamilies: getKnownThemeFamilies(), requireKnownFamilies: true });
  // MIG-B6-21 (FEAT-008): shared across every entry, like the theme itself —
  // one build emits maps or it doesn't; there are no per-entry overrides.
  resolvedConfig.sourceMap = resolveSourceMap(argv.sourcemap, rawSourceMap);

  if (debug) {
    console.log(`[uxdsl:debug] config file: ${configPath || '(none)'}`);
    console.log(`[uxdsl:debug] theme file: ${themeConfigPath || '(none)'}`);
    console.log(`[uxdsl:debug] external tokens: ${JSON.stringify((resolvedConfig.references && resolvedConfig.references.externalTokens) || [])}`);
  }

  // Final normalization
  if ((resolvedConfig.entry || hasBuilds) && resolvedConfig.watch) {
    // Build-config-relative globs must follow the same base directory as
    // entry/outFile. This matters when `--config` points outside cwd.
    const watchBaseDir = configPath ? path.dirname(configPath) : cwd;
    const entryOrEntries = hasBuilds ? resolvedConfig.builds.map((b) => b.entry) : resolvedConfig.entry;
    resolvedConfig.watch = normalizeWatchGlobs(resolvedConfig.watch, watchBaseDir, entryOrEntries);
    // MIG-B4-02 (FEAT-005): watch every local module the theme/build
    // config requires transitively, not just the top-level file itself —
    // `require.cache` already holds the full tree at this point
    // (loadModuleExport/loadThemeConfig already ran the real require()
    // above), so this is free information, not a second resolution pass.
    // The build config itself is watched for the same reason the theme
    // file is: so `build --watch` picks up an edit without the user having
    // to list uxdsl.config.cjs (or whatever it requires) in their own
    // `watch` array.
    const addRequireTreeToWatch = (filePath) => {
      if (!filePath) return;
      // The root is recorded using the caller's own string (the exact
      // form `resolvedConfig.themeConfigPath`/`configPath` already use)
      // rather than whatever `collectLocalRequireTree` resolved it to —
      // `require.resolve()` can return a realpath-resolved variant of the
      // same file (e.g. macOS's /tmp -> /private/tmp symlink), which
      // would otherwise add one physical file to the watch list twice
      // under two different spellings.
      if (!resolvedConfig.watch.includes(filePath)) resolvedConfig.watch.push(filePath);
      let rootId;
      try { rootId = require.resolve(filePath); } catch (_) { rootId = null; }
      for (const id of collectLocalRequireTree(filePath)) {
        if (id === rootId) continue; // Already recorded above as `filePath` itself.
        if (!resolvedConfig.watch.includes(id)) resolvedConfig.watch.push(id);
      }
    };
    addRequireTreeToWatch(themeConfigPath);
    addRequireTreeToWatch(configPath);
  }
  // Exposed so the watcher can invalidate require()'s module cache for
  // exactly these two files before reloading config on a change (they are
  // `require()`d in loadModuleExport/loadThemeConfig, and Node caches by
  // resolved path — a bare re-call of loadConfig() would otherwise keep
  // serving the pre-edit module forever).
  resolvedConfig.configPath = configPath;
  resolvedConfig.themeConfigPath = themeConfigPath;
  return resolvedConfig;
}

// MIG-B3-01 (FEAT-004): `--include-theme`/config `includeTheme` resolve at
// one point, after every "found a config" branch, so the flag/config/default
// precedence is written once.
// MIG-B6-22 (FEAT-008): `--include-theme`/`--no-include-theme` arrive as
// real booleans from minimist (bare flag or `--no-` negation), but
// `--include-theme=false`/`=true` arrive as the strings `"false"`/`"true"`
// — previously only `typeof flagValue === 'boolean'` was accepted, so the
// `=value` form silently fell through to the config value/default instead
// of taking effect. Any other explicit value is a hard error instead of
// silently reading as `true`, matching the bare-boolean-flag contract
// minimist itself already provides — including a *number*, which is the
// case a code review caught this missing for: minimist auto-parses an
// undeclared flag's numeric-looking value (`--include-theme=0`) into the
// actual JS number `0`, which is neither `'true'`/`'false'` (so the old
// string-only check skipped it) nor a real boolean, and fell all the way
// through to the config value/default — silently accepting a value never
// documented as valid. Checking "not already a real boolean" up front,
// rather than "is a string", catches every such explicit-but-invalid value.
// MIG-B6-21 (FEAT-008): `--sourcemap` (bare) means `external`, the mode that
// actually needs a filename; `--sourcemap=inline` and `--sourcemap=external`
// name the mode outright, and `--no-sourcemap` turns it off. `=true`/`=false`
// are accepted as synonyms of the bare/negated forms so the flag behaves like
// every other boolean-ish flag here (MIG-B6-22 made that consistency a rule),
// and — for the same reason resolveIncludeTheme checks "not already a real
// boolean" — a numeric value like `--sourcemap=0`, which minimist parses into
// the JS number 0, is rejected instead of quietly reading as a mode.
// Precedence is flag > config > false.
function resolveSourceMap(flagValue, configValue) {
  if (flagValue !== undefined) {
    if (flagValue === true || flagValue === 'true' || flagValue === 'external') return 'external';
    if (flagValue === false || flagValue === 'false') return false;
    if (flagValue === 'inline') return 'inline';
    throw new Error(`Invalid value for --sourcemap: "${flagValue}". Expected "inline" or "external" (bare --sourcemap means external, --no-sourcemap turns it off).`);
  }
  if (configValue === 'inline' || configValue === 'external') return configValue;
  if (configValue === false || configValue === undefined) return false;
  throw new Error(`Invalid "sourcemap" in configuration: ${JSON.stringify(configValue)}. Expected false, "inline" or "external".`);
}

function resolveIncludeTheme(flagValue, configValue) {
  if (flagValue !== undefined && typeof flagValue !== 'boolean') {
    if (flagValue === 'true') flagValue = true;
    else if (flagValue === 'false') flagValue = false;
    else throw new Error(`Invalid value for --include-theme: "${flagValue}". Expected true or false (or --no-include-theme).`);
  }
  if (typeof flagValue === 'boolean') return flagValue;
  if (typeof configValue === 'boolean') return configValue;
  return true;
}

// MIG-B5-01 (FEAT-006): `strictTheme`/`--strict-theme` accepts three
// shapes — `false`/absent, `true` (check every touched family — beta.4's
// original behavior, unchanged), or a list of family names (check only
// those, among the touched ones). A project declares which families it
// wants completeness enforced for, instead of the tool guessing: every
// family `resolveTheme()` actually merges (spacing, palette, fonts,
// typography_details) documents partial override as the intended
// pattern, so there is no family that's safe to check unconditionally by
// default — verified against the library's own README example
// (`palette.primary.main` alone) and the mig-b2-05-release fixture's own
// partial `spacing` override, both of which `true` already flags as
// "incomplete" today, same as `typography_details`.
//
// A CLI flag value arrives as a comma-separated string
// (`--strict-theme=palette,breakpoints`); a config value can already be a
// real array. Both normalize to the same `string[]`. Returns `undefined`
// for anything that isn't a meaningful value at this level (absent, or an
// empty string/array) so the flag > config > default chain below falls
// through correctly instead of treating "nothing here" as "off".
//
// MIG-B6-22 (FEAT-008): a bare `--strict-theme` (no declared minimist type —
// see main()) arrives here as the real boolean `true`, and `--no-strict-theme`
// as `false`. `--strict-theme=true`/`=false` arrive as strings (undeclared,
// `=value` always does); they used to fall into the CSV branch below and be
// misread as a family named "true"/"false" — a silent no-op gate. Each of the
// four now gets its own answer (see strictThemeScopeRequired above), matched
// by exact, case-insensitive value: "True,false" is a two-element family
// list, since a real family name can't contain a comma anyway.
//
// `knownFamilies` (MIG-B6-01's `KNOWN_THEME_FAMILIES`) is optional so the
// large existing pure-parsing test suite for this function keeps working
// unchanged when it isn't passed; passing it validates every family name
// and throws with an edit-distance suggestion for a typo (e.g. "pallete"),
// describing where the value came from via `source` ("--strict-theme" or
// "strictTheme (in the config file)") so the message names what was
// actually used, not just a fixed flag name.
//
// `requireKnownFamilies` is a separate opt-in (only the real CLI call
// sites in loadConfig/themeCommand pass it) for a case a code review
// caught: `knownFamilies` comes from whatever postcss-uxdsl install the
// *project* resolves (see getKnownThemeFamilies/resolveUxDslModule's
// project-first order), which can be older than this CLI and simply not
// export `KNOWN_THEME_FAMILIES` yet. Silently skipping validation in that
// case would quietly re-open exactly the "pallete never gets flagged"
// hole this story closes, for any project on an older postcss-uxdsl —
// worse than never having added the check, since it would look enabled.
// A plain boolean scope (`true`/`false`, no specific families named)
// never needed a family list to validate, so it's unaffected either way.
// Stability phase 2: a scope is required. The bare flag (and `strictTheme:
// true`) checked every family the project touched, and the theme model is
// partial overrides — one `palette.primary.main` over the base, one
// `typography_details` field — so the unscoped check flagged the usage the
// documentation recommends as "incomplete". It had no correct use; naming
// the families that must be complete is the only meaningful form.
function strictThemeScopeRequired(source) {
  const isFlag = source.startsWith('--');
  return new Error(
    `${source} needs a scope: name the families that must be completely declared, ` +
    (isFlag ? `e.g. ${source}=palette,breakpoints` : "e.g. strictTheme: ['palette', 'breakpoints']") +
    '. An unscoped check treats every partial override — the theme model itself — as incomplete, so it is not accepted.'
  );
}

function normalizeStrictThemeScope(value, { knownFamilies, requireKnownFamilies = false, source = '--strict-theme' } = {}) {
  if (value === undefined || value === null) return undefined;
  if (value === false) return false; // --no-strict-theme: off for this run.
  if (value === true) throw strictThemeScopeRequired(source);
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true') throw strictThemeScopeRequired(source);
    if (lower === 'false') {
      throw new Error(`Invalid value for ${source}: "false". To turn the check off, omit it${source.startsWith('--') ? ' or pass --no-strict-theme' : ''}.`);
    }
  }

  // MIG-B6-22 fix (code review): an empty overall value (`''`/`[]`) still
  // means "nothing here" — falls through to config/default, matching the
  // pre-existing contract a config like `strictTheme: someEnvVar || ''`
  // already relies on. But a NON-empty value that contains an empty
  // element after splitting (a stray comma: `--strict-theme=,` or
  // `=palette,,fonts`) is a different case — the user clearly tried to
  // name families and got the list wrong, so this is a hard error instead
  // of silently discarding the empty slot and continuing (which, for
  // `--strict-theme=,`, previously discarded *every* slot and silently
  // turned strict-theme off).
  const toValidatedFamilyList = (rawFamilies, describeInput) => {
    const families = rawFamilies.map((f) => String(f).trim());
    const emptyIndex = families.findIndex((f) => f === '');
    if (emptyIndex !== -1) {
      throw new Error(`Invalid value for ${source}: ${describeInput()}. A family list cannot contain an empty entry — check for a stray or trailing comma.`);
    }
    if (!knownFamilies) {
      if (requireKnownFamilies) {
        throw new Error(
          `Cannot validate family names for ${source}: this postcss-uxdsl install does not export ` +
          'KNOWN_THEME_FAMILIES (added in 0.5.0-beta.6). Upgrade postcss-uxdsl in this project, or pass ' +
          `a plain boolean (${source}=true or =false) instead of scoping to specific families.`
        );
      }
      return families;
    }
    for (const family of families) {
      if (!knownFamilies.has(family)) {
        const suggestion = closestMatch(family, knownFamilies);
        throw new Error(
          `Unknown theme family "${family}" in ${source}.` +
          (suggestion ? ` Did you mean "${suggestion}"?` : '')
        );
      }
    }
    return families;
  };

  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    return toValidatedFamilyList(value, () => `[${value.map((f) => JSON.stringify(f)).join(', ')}]`);
  }
  if (typeof value === 'string') {
    if (value.trim() === '') return undefined;
    return toValidatedFamilyList(value.split(','), () => JSON.stringify(value));
  }
  // Reachable when minimist auto-parses an undeclared flag's numeric-looking
  // value into a real number (`--strict-theme=5`) — not a documented form.
  throw new Error(`Invalid value for ${source}: ${JSON.stringify(value)}. Expected a comma-separated list of family names.`);
}

function resolveStrictTheme(flagValue, configValue, { knownFamilies, requireKnownFamilies } = {}) {
  const flag = normalizeStrictThemeScope(flagValue, { knownFamilies, requireKnownFamilies, source: '--strict-theme' });
  if (flag !== undefined) return flag;
  const config = normalizeStrictThemeScope(configValue, { knownFamilies, requireKnownFamilies, source: 'strictTheme (in the config file)' });
  if (config !== undefined) return config;
  return false;
}

/** Fails on a build-config key that has moved elsewhere, naming the new
 * home. `prefix` labels a `builds[n].` entry. */
function rejectRemovedConfigKeys(object, configPath, prefix = '') {
  for (const key of Object.keys(REMOVED_CONFIG_KEYS)) {
    if (!Object.prototype.hasOwnProperty.call(object, key)) continue;
    throw new Error(
      `Invalid configuration in ${configPath}: "${prefix}${key}" is not a build-config key any more — ${REMOVED_CONFIG_KEYS[key]}.`
    );
  }
}

// Compiles one { entry, outFile, includeTheme } pair against the theme/
// references every entry in a build shares. Returns the CSS to
// write without writing it — MIG-B3-02's multi-entry buildOnce compiles
// every entry to memory first, so a failure partway through a `builds`
// array leaves nothing written at all rather than some files updated and
// others stale.
async function compileEntryToCss(entryConfig, sharedConfig) {
  // MIG-B2-03 item 7: each of these has a concrete, actionable fix, not a
  // generic "invalid configuration".
  if (!entryConfig || !entryConfig.entry) {
    throw new Error('No entry file configured. Pass --entry <path>, or set "entry" in uxdsl.config.cjs (run "npx uxdsl init" to create one).');
  }
  if (!entryConfig.outFile) {
    throw new Error('No output file configured. Pass --out <path>, or set "outFile" in uxdsl.config.cjs.');
  }
  if (!fs.existsSync(entryConfig.entry)) {
    throw new Error(`Entry file not found: ${entryConfig.entry}. Pass --entry <path> pointing at an existing .uxdsl file, or run "npx uxdsl generate-entry" to create one.`);
  }
  // MIG-B3-01: `includeTheme` defaults to true, matching the plugin's own
  // default — an omitted config/flag means "this entry defines the theme".
  const includeTheme = entryConfig.includeTheme !== false;
  // Don't claim a theme was "detected" (i.e. will be emitted) for an entry
  // that only uses it to resolve/validate references against — that's
  // exactly what includeTheme: false means.
  if (sharedConfig.theme && includeTheme) console.log('[uxdsl] Theme config detected');

  // MIG-B6-18 (FEAT-008): delegates to uxdsl-core's compile() — the exact
  // pipeline this function used to run inline (postcss-scss syntax,
  // postcss-import with the shared resolver, postcss-advanced-variables,
  // postcss-uxdsl), plus the breakpoint metadata this function used to
  // append itself, both moved into core so every compile() caller gets
  // them identically instead of the CLI having its own copy that could
  // drift from core's (the exact bug this story closes).
  // MIG-B6-21 (FEAT-008): `to` is the absolute outFile, which is also where
  // an external `.map` lands, so PostCSS resolves `sources` relative to the
  // right place for both modes without any prefix trimming.
  const sourceMap = sharedConfig.sourceMap || false;
  const { css: compiledCss, map, dependencies } = await uxdslCore.compile(
    { entry: entryConfig.entry },
    {
      theme: sharedConfig.theme,
      references: sharedConfig.references,
      includeTheme,
      to: entryConfig.outFile,
      sourceMap,
    }
  );

  // 'inline' is already complete (core appended its own data URI). 'external'
  // needs the annotation only this side can write, since only the CLI knows
  // the `.map` filename — and it must come last, after core's breakpoint
  // metadata, because only the final sourceMappingURL in a file counts.
  let finalCss = compiledCss;
  let mapFile;
  if (sourceMap === 'external') {
    mapFile = `${entryConfig.outFile}.map`;
    finalCss = `${finalCss}\n/*# sourceMappingURL=${path.basename(mapFile)} */`;
  }

  // MIG-B6-23 (FEAT-008): `dependencies` (entry first, every transitively
  // @import-ed file) lets watch mode rebuild only the entries a changed
  // file actually affects, instead of every entry on every change.
  return { outFile: entryConfig.outFile, finalCss, dependencies, mapFile, mapContent: map };
}

// MIG-B5-02 (FEAT-006): deduplicated across watch-mode rebuilds, same
// reasoning as `warnedBuildConfigShapes` above — without this, an unfixed
// typo'd family name would reprint on every unrelated save. Unlike that
// Map (keyed by file, cleared when the specific file's shape changes),
// this is a flat Set of exact warning strings: simpler, at the cost of
// not re-warning if the *same* message recurs later in one process after
// being fixed in between — an acceptable trade-off for best-effort
// diagnostic output, not a build-correctness gate.
const warnedUnknownThemeKeys = new Set();

function warnUnknownThemeKeys(theme) {
  if (theme === undefined || typeof uxdslRuntime.validateTheme !== 'function') return;
  let warnings;
  try {
    ({ warnings } = uxdslRuntime.validateTheme(theme));
  } catch (_) {
    return; // Diagnostic-only — must never be the reason a build fails.
  }
  for (const w of warnings || []) {
    if (!/^Unknown /.test(w.message)) continue;
    const key = `${w.path}: ${w.message}`;
    if (warnedUnknownThemeKeys.has(key)) continue;
    warnedUnknownThemeKeys.add(key);
    console.warn(`[uxdsl] Warning: ${key}`);
  }
}

function annotateThemeError(err, config) {
  if (!err || typeof err !== 'object' || !err.keyPath || err.name === 'CssSyntaxError' || err.themeFile) return err;
  const themeFile = config.themeConfigPath;
  if (!themeFile) return err;
  err.themeFile = themeFile;
  err.message = `${path.relative(process.cwd(), themeFile)}: ${err.message}`;
  return err;
}

// MIG-B6-24 (FEAT-008): a real, parsed CSS rule selector — never a
// substring match, so `content: ":root";` or `/* see :root above */`
// (both legal, unrelated CSS) never trip this. `postcss.list.comma`
// splits a compound selector (`:root, .a`) into each individual selector,
// matching the same comma-aware handling MIG-B6-15 already established
// for control directives.
function findThemeLeakSelector(css) {
  let found = null;
  postcss.parse(css).walkRules((rule) => {
    if (found) return;
    for (const selector of postcss.list.comma(rule.selector)) {
      if (selector.trim() === ':root') {
        found = ':root';
        return;
      }
    }
  });
  return found;
}

// MIG-B6-24 (FEAT-008): before writing anything (called from buildOnce
// against each entry's already-compiled, in-memory CSS), refuses an entry
// whose outFile is named like a CSS Module and would still define :root —
// Next.js (and other CSS Modules loaders) reject a bare `:root` selector
// ("Selector :root is not pure"), and the CLI previously never noticed.
// `includeTheme: false` is the normal way to avoid this; this only catches
// the actual output, not just the config flag, since a legacy import or
// explicit native CSS could still reintroduce the selector even with
// `includeTheme: false`. Not a general CSS Modules purity validator — only
// the one selector this compiler itself produces for the theme.
function assertNoThemeLeakIntoCssModule(outFile, css, label) {
  if (!/\.module\.css$/i.test(outFile)) return;
  const leaked = findThemeLeakSelector(css);
  if (!leaked) return;
  throw new Error(
    `${label}this entry would emit :root, which CSS Modules reject ` +
    '("Selector :root is not pure"). Set includeTheme: false for component entries.'
  );
}

// Deduplicated the same way warnUnknownThemeKeys already is (see its own
// comment) — keyed by the exact set of entries involved, so a config edit
// that changes *which* entries emit the theme warns again, but repeating
// the same rebuild in watch mode does not.
const warnedMultipleThemeEntries = new Set();

function warnIfMultipleEntriesEmitTheme(themeEmittingLabels) {
  if (themeEmittingLabels.length <= 1) return;
  const key = themeEmittingLabels.join(',');
  if (warnedMultipleThemeEntries.has(key)) return;
  warnedMultipleThemeEntries.add(key);
  console.warn(
    `[uxdsl] Warning: ${themeEmittingLabels.length} entries emit the theme (${themeEmittingLabels.join(', ')}); ` +
    'usually only one theme entry should.'
  );
}

function formatCliDiagnostic(message) {
  const cwdPrefix = `${process.cwd()}${path.sep}`;
  return String(message).split('\n').map(line => line.split(cwdPrefix).join('')).join('\n');
}

// MIG-B6-23 (FEAT-008): writes only what actually changed, and does so
// atomically per file. Reads the existing file first — identical content
// means no write at all, so an unaffected entry keeps its mtime/inode
// (previously every rebuild rewrote every entry unconditionally, so a dev
// server watching the output directory reloaded stylesheets nothing
// changed in). A real write goes to a freshly, exclusively created temp
// file in the *same* directory (`flag: 'wx'` — fails instead of silently
// reusing a stale leftover; a name derived only from pid isn't unique
// enough across two rapid rebuilds) and is committed with `renameSync`,
// atomic on any filesystem where source and destination share a volume —
// true here since both live in the same directory. Returns 'unchanged' or
// 'written' so the caller can log accordingly.
function commitFileIfChanged(outFile, content) {
  let existing = null;
  try {
    existing = fs.readFileSync(outFile, 'utf8');
  } catch (_) {
    existing = null; // Doesn't exist yet — falls through to a real write.
  }
  if (existing === content) return 'unchanged';
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const tmpFile = path.join(
    path.dirname(outFile),
    `.${path.basename(outFile)}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`
  );
  fs.writeFileSync(tmpFile, content, { encoding: 'utf8', flag: 'wx' });
  try {
    fs.renameSync(tmpFile, outFile);
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch (_) { /* best effort cleanup */ }
    throw err;
  }
  return 'written';
}

// Commits every already-compiled output (each entry was compiled to CSS in
// memory before this runs — a failure partway through *compiling* never
// reaches here at all, so it can't leave some outputs written and others
// stale). A failure *committing* (the rename itself) is different: this
// entry and every earlier one in `compiled` already touched disk, so this
// rolls those back to what was on disk before this call started, and
// reports (rather than hides) a rollback that itself fails. This is
// per-file atomicity composed across files, not one filesystem
// transaction — a reader could still observe a mix of old/new content
// while a rollback is in progress.
// MIG-B6-21 (FEAT-008): `<outFile>.map` is only removed when it really is
// the map this tool manages for that output — same name *and* recognisable
// as a source map. Switching an entry from `external` to `inline`/off must
// retire its own stale map without ever deleting an unrelated file that
// happens to sit at that path.
function isManagedSourceMap(file) {
  let content;
  try { content = fs.readFileSync(file, 'utf8'); } catch (_) { return false; }
  try {
    const parsed = JSON.parse(content);
    return parsed && parsed.version === 3 && Array.isArray(parsed.sources);
  } catch (_) { return false; }
}

function commitCompiled(compiled) {
  // MIG-B6-21: an entry can own two files now (the CSS and, in `external`
  // mode, its `.map`). Both go through the same per-file atomic write and
  // the same rollback, so a failure part-way can never leave a stylesheet
  // annotated with a map from a previous build. `content: null` means
  // "retire this entry's own managed map", used when a build that used to
  // emit `external` no longer does.
  const targets = [];
  for (const item of compiled) {
    targets.push({ file: item.outFile, content: item.finalCss });
    if (item.mapFile && item.mapContent !== undefined) {
      targets.push({ file: item.mapFile, content: item.mapContent });
    } else {
      const staleMap = `${item.outFile}.map`;
      if (fs.existsSync(staleMap) && isManagedSourceMap(staleMap)) targets.push({ file: staleMap, content: null });
    }
  }

  const previousContent = targets.map(({ file }) => {
    try { return fs.readFileSync(file, 'utf8'); } catch (_) { return undefined; }
  });
  const statuses = [];
  try {
    for (const { file, content } of targets) {
      if (content === null) {
        fs.unlinkSync(file);
        statuses.push('written');
        continue;
      }
      statuses.push(commitFileIfChanged(file, content));
    }
  } catch (commitErr) {
    for (let i = 0; i < statuses.length; i++) {
      if (statuses[i] !== 'written') continue; // 'unchanged' never touched disk — nothing to roll back.
      const { file } = targets[i];
      try {
        if (previousContent[i] === undefined) fs.unlinkSync(file);
        else fs.writeFileSync(file, previousContent[i], 'utf8');
      } catch (rollbackErr) {
        commitErr.message += `\n[uxdsl] additionally failed to restore the previous ${path.relative(process.cwd(), file)}: ${rollbackErr.message}`;
      }
    }
    throw commitErr;
  }
  // The caller logs one line per compiled entry, so report per entry (the
  // CSS file's own status), not per written file.
  const byEntry = [];
  let cursor = 0;
  for (const item of compiled) {
    byEntry.push(statuses[cursor]);
    cursor += 1;
    if (item.mapFile && item.mapContent !== undefined) cursor += 1;
    else if (targets[cursor] && targets[cursor].content === null) cursor += 1;
  }
  return byEntry;
}

// MIG-B3-02 (FEAT-004): `config.builds` (an array of { entry, outFile,
// includeTheme }) compiles several entries against the one shared theme/
// references in a single `uxdsl build`/`watch` invocation,
// instead of running the CLI once per entry. Single-entry configs
// (config.builds absent) take the exact same path they always did —
// entries becomes a one-element array built from config.entry/outFile/
// includeTheme, so this refactor changes nothing observable for them.
//
// MIG-B6-23 (FEAT-008): `entryIndices` (optional) compiles/commits only
// those entries — used by watch mode's dependency-graph-based selective
// rebuild — instead of always every entry. Omitted (every existing call
// site: `build`, `build --watch`'s and `watch`'s own initial build)
// behaves exactly as before. Returns each compiled entry's own
// `dependencies` (from compile(), MIG-B6-18) so a caller can build/update
// that graph; entries not included in `entryIndices` are left completely
// untouched — not recompiled, not rewritten, not part of the return value.
async function buildOnce(config, entryIndices) {
  // MIG-B4-01 (FEAT-005): fails fast, before compiling or writing
  // anything, if the project explicitly declared a theme family that
  // ended up partially filled from DEFAULT_THEME — the same question
  // `uxdsl theme --strict-theme` already answers (MIG-B3-04), now reachable
  // from `build`/`watch` directly instead of requiring a separate command.
  // Checked once here, not per-entry: the theme is shared across every
  // entry, `builds` or not.
  if (config && config.strictTheme) {
    if (typeof uxdslRuntime.resolveTheme !== 'function') {
      throw new Error('postcss-uxdsl/ds-runtime not found (or too old to export resolveTheme) — required for --strict-theme. Install a current postcss-uxdsl in your project or alongside the CLI.');
    }
    const effectiveTheme = uxdslRuntime.resolveTheme(config.theme);
    const incomplete = findPartiallyDefaultedFamilies(config.theme, effectiveTheme, config.strictTheme);
    if (incomplete.length > 0) {
      throw new Error(
        `--strict-theme (scoped to: ${config.strictTheme.join(', ')}): the following theme families you declared are partially filled from defaults: ${incomplete.join(', ')}. ` +
        'Provide every key of these families explicitly, or drop --strict-theme/strictTheme if inheriting some of them is intentional.'
      );
    }
  }

  // MIG-B5-02 (FEAT-006): `validateTheme`'s "Unknown theme
  // family" warning (MIG-B3-03) was never actually reachable from a real
  // build — only the playground's theme editor called this function at
  // all. Surfacing just `/^Unknown /`-prefixed warnings here (not the
  // others `validateTheme` can produce, e.g. color-format
  // hints, which nobody asked to see from `build` and the plugin's own
  // reference-integrity pass already covers differently) closes that gap
  // without changing what a normal build reports beyond it. MIG-B5-02
  // also briefly added a second, one-level-deeper "Unknown <family> key"
  // warning (typography_details/palette/fonts.families); MIG-B6-01
  // (FEAT-007) removed that check at the source for being a false
  // positive on any project with a richer palette/fonts/typography set
  // than DEFAULT_THEME's minimal fallback — nothing here needed to change
  // for that fix, since this just forwards whatever the runtime reports.
  // Checked once per build, same as `--strict-theme`.
  warnUnknownThemeKeys(config && config.theme);

  const entries = config && config.builds && config.builds.length
    ? config.builds
    : [{ entry: config && config.entry, outFile: config && config.outFile, includeTheme: config && config.includeTheme }];
  const multi = entries.length > 1;
  const indices = entryIndices || entries.map((_, i) => i);

  const compiled = [];
  for (const i of indices) {
    try {
      compiled.push({ index: i, ...(await compileEntryToCss(entries[i], config || {})) });
    } catch (err) {
      annotateThemeError(err, config || {});
      if (multi) {
        const label = entries[i] && entries[i].outFile
          ? path.relative(process.cwd(), entries[i].outFile)
          : `#${i}`;
        err.message = `builds[${i}] (${label}): ${err.message}`;
      }
      throw err;
    }
  }

  // MIG-B6-24 (FEAT-008): checked against every entry's actual compiled
  // output, before any of them are written — a CSS-Module-named outFile
  // that would still define :root fails the whole build
  // here, same as any other compile error (item 4: nothing partial gets
  // written). More than one entry emitting the theme at all (regardless
  // of outFile name) is a warning, not an error — usually intentional to
  // have exactly one, but not necessarily wrong to have more.
  const themeEmittingLabels = [];
  for (const { index, outFile, finalCss } of compiled) {
    const entryConfig = entries[index] || {};
    const label = multi ? `builds[${index}] (${path.relative(process.cwd(), outFile)}): ` : '';
    try {
      assertNoThemeLeakIntoCssModule(outFile, finalCss, label);
    } catch (err) {
      annotateThemeError(err, config || {});
      throw err;
    }
    if (entryConfig.includeTheme !== false) {
      themeEmittingLabels.push(multi ? `builds[${index}]` : path.relative(process.cwd(), outFile));
    }
  }
  warnIfMultipleEntriesEmitTheme(themeEmittingLabels);

  // Every entry is compiled before anything is written — item 4: a failure
  // in entry 3 of 5 must not leave entries 1-2 written and 3-5 missing.
  const statuses = commitCompiled(compiled);
  for (let k = 0; k < compiled.length; k++) {
    const { outFile, finalCss, mapFile, mapContent } = compiled[k];
    const rel = path.relative(process.cwd(), outFile);
    if (statuses[k] === 'written') {
      // MIG-B6-21 (FEAT-008): CSS and map bytes are reported separately, so
      // a jump in output size is attributable to one or the other rather
      // than reading as the stylesheet itself having grown.
      const mapNote = mapFile && mapContent !== undefined
        ? ` + ${path.basename(mapFile)} (${mapContent.length} bytes)`
        : '';
      console.log(`[uxdsl] built ${rel} (${finalCss.length} bytes)${mapNote}`);
    } else {
      // MIG-B7-15 (FEAT-009): say what "unchanged" is about — the compiled
      // output equals the file already on disk (writeIfChanged compares
      // content), so it was not rewritten. It does not mean no input changed.
      console.log(`[uxdsl] unchanged ${rel} (compiled output identical to the file on disk; not rewritten)`);
    }
  }

  return compiled.map(({ index, outFile, dependencies }) => ({ index, outFile, dependencies }));
}

// --- Command: Theme introspection (MIG-B3-04, FEAT-004) ---
//
// Answers "what theme did my build actually resolve, and where did each
// value come from?" without diffing compiled CSS by hand. Uses the exact
// same discovery (`loadConfig`) and resolution (`resolveTheme`) the real
// build uses, so this can never silently disagree with `uxdsl build`.

function isPlainThemeObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Presence in the project's own *raw* theme object, not value equality
// against the default, decides provenance: a project that happens to set
// `palette.primary.main` to the exact same hex the default uses wrote that
// value — it isn't "inherited" just because it matches. Walks the
// *effective* theme's own shape (so every resolved leaf is visited, whether
// or not it's one of `DEFAULT_THEME`'s known families) and asks, at each
// leaf, whether `rawNode` supplied a value there.
function diffThemeSubtree(rawNode, effectiveNode, pathPrefix) {
  if (isPlainThemeObject(effectiveNode)) {
    const rows = [];
    for (const key of Object.keys(effectiveNode)) {
      rows.push(...diffThemeSubtree(
        isPlainThemeObject(rawNode) ? rawNode[key] : undefined,
        effectiveNode[key],
        [...pathPrefix, key]
      ));
    }
    return rows;
  }
  return [{
    path: pathPrefix.join('.'),
    value: effectiveNode,
    source: rawNode !== undefined ? 'project' : 'default',
  }];
}

// Only families the project's own theme actually mentions are shown —
// per-leaf, labeled by provenance. A family the project never touched is
// pure default top to bottom and adds nothing to "what's mine vs. inherited".
// `$schema` (and any other `$`-prefixed key) is editor metadata, not a theme
// family: it is not a project leaf and never counts as partially declared.
function projectFamilies(rawTheme) {
  return isPlainThemeObject(rawTheme) ? Object.keys(rawTheme).filter((key) => !key.startsWith('$')) : [];
}

function diffThemeAgainstDefaults(rawTheme, effectiveTheme) {
  const touchedFamilies = projectFamilies(rawTheme);
  const rows = [];
  for (const family of touchedFamilies) {
    rows.push(...diffThemeSubtree(rawTheme[family], effectiveTheme[family], [family]));
  }
  return rows;
}

// --strict-theme's question is narrower than the diff itself: not "what's mine",
// but "did any family I explicitly declared end up partially filled by
// defaults anyway" — the exact silent-fallback gap the CLI plugin-parity
// report flagged as invisible.
// MIG-B5-01 (FEAT-006): `scope` is the normalized `resolveStrictTheme`
// result — `true`/undefined checks every touched family (unchanged from
// beta.4); an array checks only its intersection with the touched
// families, so a family the project deliberately left out of scope (e.g.
// `typography_details`, mid partial-override) is never evaluated at all,
// not just tolerated when it happens to fail.
function findPartiallyDefaultedFamilies(rawTheme, effectiveTheme, scope) {
  const touchedFamilies = projectFamilies(rawTheme);
  const candidates = Array.isArray(scope)
    ? touchedFamilies.filter((family) => scope.includes(family))
    : touchedFamilies;
  return candidates.filter((family) => {
    const rows = diffThemeSubtree(rawTheme[family], effectiveTheme[family], [family]);
    return rows.some((row) => row.source === 'default');
  });
}

// MIG-B6-16 (FEAT-008): decision D-1 is that a theme is a base plus an override
// merged key by key, and that stays. What was missing is that the merge is
// *invisible*: override `palette.primary.main` and you keep the base's `dark`
// and `contrast`, so a green button's hover comes out purple and nothing says
// so. This reports the mix without changing what `--diff` puts on stdout —
// scripts already parse that — and without adding noise to `build`, which D-1
// explicitly rules out.
//
// Only the two registries where a partial override silently keeps sibling
// values that *look* related: a Palette family's variants and a typography
// role's fields. (Buttons, Inputs and Surfaces have the same shape one level
// deeper — see this story's follow-up notes.)
const MIXED_ENTRY_FAMILIES = ['palette', 'typography_details'];

function summarizeMixedEntries(rows) {
  const entries = new Map();
  for (const row of rows) {
    const segments = row.path.split('.');
    if (segments.length < 3 || !MIXED_ENTRY_FAMILIES.includes(segments[0])) continue;
    const key = `${segments[0]}.${segments[1]}`;
    if (!entries.has(key)) entries.set(key, { project: [], default: [] });
    const bucket = entries.get(key);
    const leaf = segments.slice(2).join('.');
    if (row.source === 'project') bucket.project.push(leaf);
    else bucket.default.push(leaf);
  }
  const lines = [];
  for (const [key, bucket] of entries) {
    if (!bucket.project.length || !bucket.default.length) continue;
    lines.push(`${key} mixes your values (${bucket.project.join(', ')}) with base values (${bucket.default.join(', ')})`);
  }
  return lines;
}

/** The exceptions shipped with the packaged base theme: contrast findings that
 * are knowingly accepted, each with a recorded reason. Today they are three
 * patterns — the canvas-identity families `surface`, `light` and `dark` used
 * as a tone and drawn on the page itself — so they follow the tone, not a hex:
 * a project that recolors one of those families keeps the exception, and one
 * that makes the tone pass everywhere is told the pattern is stale. Every pair
 * a pattern covers is printed under `excepted`. Missing file (an older
 * postcss-uxdsl) is not fatal: the check just runs without them. */
function packagedContrastExceptions() {
  try {
    const loaded = require('postcss-uxdsl/theme/base.contrast-exceptions.json');
    if (Array.isArray(loaded)) return loaded;
    return Array.isArray(loaded && loaded.exceptions) ? loaded.exceptions : [];
  } catch {
    return [];
  }
}

async function themeCommand(argv, cwd = process.cwd()) {
  if (typeof uxdslRuntime.resolveTheme !== 'function') {
    throw new Error('postcss-uxdsl/ds-runtime not found (or too old to export resolveTheme). Install a current postcss-uxdsl in your project or alongside the CLI.');
  }
  // MIG-B6-16 (FEAT-008): `--contrast` prints a different document on stdout, so
  // combining it with `--diff` (or with `--strict-theme`, which can throw before
  // the report is read) would mean two formats on one stream. Refused explicitly
  // rather than letting one silently win.
  if (argv.contrast && (argv.diff || argv['strict-theme'] !== undefined)) {
    throw new Error(
      `--contrast cannot be combined with ${argv.diff ? '--diff' : '--strict-theme'}: ` +
      'each prints its own JSON document on stdout. Run them as separate commands.'
    );
  }
  // A usage error (no scope, an unknown family, a stray comma) is reported
  // before anything is printed; the check itself runs after the JSON, so a
  // script still gets the document together with the exit status.
  const strictScope = normalizeStrictThemeScope(argv['strict-theme'], { knownFamilies: getKnownThemeFamilies(), requireKnownFamilies: true, source: '--strict-theme' });

  // The same discovery as build, from a theme file alone if that is all the
  // project has. No theme file at all means "what a zero-config build uses",
  // i.e. the base theme.
  const config = await loadConfig(argv, cwd, { themeOnly: true });
  const rawTheme = config.theme;
  // Same diagnostic `build` prints, on stderr so stdout stays one JSON document.
  warnUnknownThemeKeys(rawTheme);
  const effectiveTheme = uxdslRuntime.resolveTheme(rawTheme);

  if (argv.contrast) {
    if (typeof uxdslRuntime.checkThemeContrast !== 'function') {
      throw new Error('postcss-uxdsl/ds-runtime is too old to export checkThemeContrast (added in 0.5.0-beta.6). Upgrade postcss-uxdsl in this project.');
    }
    const report = uxdslRuntime.checkThemeContrast(effectiveTheme, { exceptions: packagedContrastExceptions() });
    // The full report is printed either way: a failing check is exactly when
    // its detail is worth having, so it is never truncated to an error line.
    console.log(JSON.stringify(report, null, 2));
    // Excepted is not passing: say how many pairs an exception covers, in
    // both outcomes, so a clean exit never reads as "every pair passed".
    const excepted = Array.isArray(report.excepted) ? report.excepted.length : 0;
    const exceptedNote = excepted
      ? `${excepted} more ${excepted === 1 ? 'pair fails' : 'pairs fail'} and ${excepted === 1 ? 'is' : 'are'} covered by an exception (listed under "excepted", not passing)`
      : '';
    if (!report.passed) {
      const issues = report.exceptionIssues || [];
      const error = new Error(
        `--contrast: ${report.failures.length} contrast ${report.failures.length === 1 ? 'pair fails' : 'pairs fail'} WCAG for this theme. ` +
        'The JSON report on stdout lists each one with its mode, component, state, breakpoint and resolved colors.' +
        (issues.length ? ` ${issues.length} exception ${issues.length === 1 ? 'issue' : 'issues'}: ${issues[0]}${issues.length > 1 ? ' (and more under "exceptionIssues")' : ''}.` : '') +
        (exceptedNote ? ` ${exceptedNote}.` : '')
      );
      error.uxdslQuiet = true;
      throw error;
    }
    if (exceptedNote) console.error(`[uxdsl] --contrast: no blocking failure. ${exceptedNote}.`);
    return;
  }

  const output = argv.diff ? diffThemeAgainstDefaults(rawTheme, effectiveTheme) : effectiveTheme;
  // Always valid, parseable JSON on stdout — no log lines mixed in — so
  // `uxdsl theme` composes with `| jq`/scripts. (UXDSL_DEBUG=1 still prints
  // its own discovery lines, same as `build`; the two are not meant to be
  // combined when a script needs clean JSON.)
  console.log(JSON.stringify(output, null, 2));

  // MIG-B6-16 (FEAT-008): the mix summary goes to stderr precisely so stdout
  // stays a clean JSON document for `| jq` and scripts.
  if (argv.diff) {
    for (const line of summarizeMixedEntries(output)) console.error(`[uxdsl] ${line}`);
  }

  // The same flag, the same scope rule and the same check as `build`.
  if (strictScope) {
    const incomplete = findPartiallyDefaultedFamilies(rawTheme, effectiveTheme, strictScope);
    if (incomplete.length > 0) {
      throw new Error(
        `--strict-theme (scoped to: ${strictScope.join(', ')}): the following theme families you declared are partially filled from defaults: ${incomplete.join(', ')}. ` +
        'Provide every key of these families explicitly, or drop --strict-theme if inheriting some of them is intentional.'
      );
    }
  }
}

/** Walks `filePath`'s require() tree — the file itself plus, recursively,
 * every project-local module it itself required (tracked by Node on each
 * cache entry's `.children`) — and returns the `Set` of resolved module
 * ids visited. A config or theme file that does `theme: require('./theme.json')`
 * (or requires any other local helper) has that nested module as part of
 * this tree. node_modules dependencies (chokidar, postcss, ...) are
 * deliberately excluded from the walk: they don't change between
 * rebuilds, re-executing them on every keystroke would be pure waste
 * (and, for some packages, unsafe to do more than once), and nothing
 * needs them invalidated or watched.
 *
 * Shared by two different needs that both require walking this exact
 * tree: `clearRequireCache` (delete every visited id so a reload
 * re-executes fresh code) and `loadConfig`'s watch-list population
 * (MIG-B4-02, FEAT-005) — watching only the top-level config/theme file
 * and not what it transitively `require()`s meant editing a nested
 * module produced no filesystem event chokidar could react to at all,
 * even though the cache was already being invalidated correctly on the
 * *next* unrelated rebuild. Calling this after the real require() already
 * ran (as `loadModuleExport`/`loadThemeConfig` do) costs nothing extra —
 * `require.cache` already holds the full tree by then.
 *
 * MIG-B6-19 (FEAT-008): this exact tree-walk now lives once in
 * postcss-uxdsl/config (the plugin's own theme discovery needs it too) —
 * re-exported here under the same names for existing tests/call sites. */
const collectLocalRequireTree = uxdslConfig.collectLocalRequireTree;
const clearRequireCache = uxdslConfig.clearLocalRequireCache;

// MIG-B3-02: a `builds` config has no single `config.outFile` — every
// entry's own outFile must be excluded from triggering a rebuild, the same
// way the single-entry case already excludes `config.outFile`.
function isOwnOutputFile(config, filePath) {
  const resolvedFilePath = path.resolve(filePath);
  if (config.outFile && path.resolve(config.outFile) === resolvedFilePath) return true;
  if (Array.isArray(config.builds)) {
    return config.builds.some((b) => b.outFile && path.resolve(b.outFile) === resolvedFilePath);
  }
  return false;
}

// MIG-B6-23 (FEAT-008): the candidates a `watch`/`build --watch` falls
// back to watching when it has never had a working config to read a real
// `watch` list from — a broken/missing `uxdsl.config.cjs` at startup, or
// an explicit `--config`/`--entry` that doesn't exist yet. Once any of
// these changes, `runFullBuild` retries `loadConfig` and, on success,
// switches to the real config's own watch list the same way a later
// config edit already does.
function bootstrapWatchTargets(argv, cwd) {
  const targets = new Set();
  for (const c of CONFIG_CANDIDATES) targets.add(path.resolve(cwd, c));
  for (const c of THEME_CANDIDATES) targets.add(path.resolve(cwd, c));
  const explicitConfig = argv.config || argv.c;
  if (explicitConfig) targets.add(resolvePath(explicitConfig, cwd));
  const explicitEntry = argv.entry || argv.e;
  if (explicitEntry) targets.add(resolvePath(explicitEntry, cwd));
  return [...targets];
}

// `initialConfig` may be `null` — the caller's own initial `loadConfig`/
// `buildOnce` already failed and was logged; this starts in "bootstrap"
// mode (watching config/theme candidates only) instead of never reaching
// watch mode at all (MIG-B6-23 item 1).
function startWatch(initialConfig, argv, cwd, builder) {
  let config = initialConfig;
  // Entry index -> Set<absolute dependency path>, from each entry's own
  // `compile()` result (MIG-B6-18). Populated after every successful full
  // build; a selective build only updates the indices it actually
  // recompiled, leaving every other entry's last-known set alone. A failed
  // build (full or selective) never touches this — the last valid graph is
  // what a subsequent change is still checked against (item 3).
  let dependencyGraph = new Map();
  let watcher = chokidar.watch(config ? config.watch : bootstrapWatchTargets(argv, cwd), { ignoreInitial: true });
  console.log('[uxdsl] watching for changes...');
  let building = false;
  // 'full' once any queued change requires one; otherwise a Set of the
  // specific changed files queued for a selective follow-up batch. No
  // build already committed is ever overwritten by a stale one: a change
  // arriving mid-build is queued, never dropped, and always evaluated
  // against the *current* config/graph once its turn comes.
  let queued = null;

  function configRelatedPaths() {
    const paths = new Set();
    if (!config) return paths; // Bootstrap mode — see isRelevantChange below.
    if (config.configPath) {
      paths.add(path.resolve(config.configPath));
      for (const id of collectLocalRequireTree(config.configPath)) paths.add(id);
    }
    if (config.themeConfigPath) {
      paths.add(path.resolve(config.themeConfigPath));
      for (const id of collectLocalRequireTree(config.themeConfigPath)) paths.add(id);
    }
    return paths;
  }

  function entriesAffectedBy(resolvedFile) {
    const indices = [];
    for (const [index, deps] of dependencyGraph) {
      if (deps.has(resolvedFile)) indices.push(index);
    }
    return indices;
  }

  async function runFullBuild() {
    // The changed file could be uxdsl.config.cjs or the theme file
    // itself — reload both from disk (past their require() cache)
    // before building, instead of reusing whatever was resolved when
    // watch mode started or after the previous change.
    clearRequireCache(config && config.configPath);
    clearRequireCache(config && config.themeConfigPath);
    let reloaded;
    try {
      reloaded = await loadConfig(argv, cwd);
    } catch (err) {
      // MIG-B6-23 item 1: a broken config must not end the process — log
      // and keep watching (the bootstrap/previous watcher is untouched).
      console.error(`[uxdsl] Error: ${formatCliDiagnostic(err.message)} — watching for a fix...`);
      return;
    }
    if (!reloaded) {
      if (!config) console.error('[uxdsl] No configuration found — watching for one to appear...');
      return;
    }
    const previousWatch = (config ? config.watch : bootstrapWatchTargets(argv, cwd)).slice().sort();
    const nextWatch = [...reloaded.watch].sort();
    config = reloaded;
    if (JSON.stringify(previousWatch) !== JSON.stringify(nextWatch)) {
      // Recreate to handle overlapping globs without unwatch() leaving
      // exclusions behind. Keep config errors recoverable on the old watcher.
      await watcher.close();
      watcher = chokidar.watch(config.watch, { ignoreInitial: true });
      watcher.on('all', onChange);
      await new Promise((resolve, reject) => {
        watcher.once('ready', resolve);
        watcher.once('error', reject);
      });
    }
    try {
      const results = await builder(config);
      dependencyGraph = new Map(results.map(({ index, dependencies }) => [index, new Set(dependencies)]));
    } catch (err) {
      console.error(`[uxdsl] build failed: ${formatCliDiagnostic(err.message)}`);
      // Keep the previous dependencyGraph (item 3): a failed rebuild
      // doesn't invalidate what the last successful one already knew.
    }
  }

  async function runSelectiveBuild(indices) {
    try {
      const results = await builder(config, indices);
      for (const { index, dependencies } of results) {
        dependencyGraph.set(index, new Set(dependencies));
      }
    } catch (err) {
      console.error(`[uxdsl] build failed: ${formatCliDiagnostic(err.message)}`);
    }
  }

  // Decides full vs. selective for one changed file, without yet running
  // anything — shared between a fresh event and a queued-batch replay.
  function classify(resolvedFile) {
    if (!config || configRelatedPaths().has(resolvedFile)) return { full: true };
    const indices = entriesAffectedBy(resolvedFile);
    // Not found in any entry's known dependency set — either a graph we
    // never had (first run failed before compiling anything) or a file
    // outside every entry's *previous* import graph, e.g. a previously
    // missing partial just created. Rebuilding everything is the safe
    // fallback (item 3's "recuperar el build"), not silently doing nothing.
    if (indices.length === 0) return { full: true };
    return { full: false, indices };
  }

  const trigger = async (resolvedFile) => {
    if (building) {
      if (queued !== 'full') {
        if (resolvedFile === undefined || classify(resolvedFile).full) {
          queued = 'full';
        } else {
          queued = queued instanceof Set ? queued : new Set();
          queued.add(resolvedFile);
        }
      }
      return;
    }
    building = true;
    try {
      if (resolvedFile === undefined) {
        await runFullBuild();
      } else {
        const decision = classify(resolvedFile);
        if (decision.full) await runFullBuild();
        else await runSelectiveBuild(decision.indices);
      }
    } finally {
      building = false;
      const next = queued;
      queued = null;
      if (next === 'full') {
        trigger();
      } else if (next instanceof Set && next.size > 0) {
        // One combined pass for everything that arrived mid-build, not one
        // trigger() per file — a config-related file among them still
        // forces the whole batch to a full rebuild.
        const indices = new Set();
        let full = false;
        for (const f of next) {
          const decision = classify(f);
          if (decision.full) { full = true; break; }
          for (const i of decision.indices) indices.add(i);
        }
        if (full) trigger();
        else runSelectiveBuild([...indices]).finally(() => { /* not building's own promise chain; fire and forget is fine, errors are already logged inside */ });
      }
    }
  };

  function onChange(event, filePath) {
    // The output file itself must never trigger a rebuild: `init`'s
    // default `watch: ['src/**/*.uxdsl', 'src/**/*.css']` matches
    // `src/uxdsl.css` (the very file `builder` writes) as much as any
    // real source file. Left unguarded, every build's own write would
    // re-trigger chokidar, which triggers another identical build,
    // indefinitely. Checked here — against the *current* `config.outFile`,
    // which a reload may have changed — rather than passed once to
    // `chokidar.watch()`'s `ignored` option at construction time, which
    // has no public API to update after the fact: a static `ignored`
    // would keep excluding the *original* outFile forever and never learn
    // about a new one after a config change moved it. MIG-B3-02: a `builds`
    // config has no single `config.outFile` — check every entry's outFile.
    if (filePath && config && isOwnOutputFile(config, filePath)) {
      return;
    }
    const rel = path.relative(process.cwd(), filePath);
    console.log(`[uxdsl] ${event} ${rel}`);
    trigger(filePath ? path.resolve(filePath) : undefined);
  }
  watcher.on('all', onChange);
}

// --- Command: Generate Entry ---

function findFiles(dir, extension, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && !file.startsWith('.')) {
        findFiles(filePath, extension, fileList);
      }
    } else if (filePath.endsWith(extension)) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

async function generateEntry(argv) {
  const cwd = process.cwd();
  // Default source to src/ or current dir if src doesn't exist
  const srcDirArg = argv.src || (fs.existsSync(path.join(cwd, 'src')) ? './src' : '.');
  const srcDir = path.resolve(cwd, srcDirArg);
  
  // Default output
  const outArg = argv.out || argv.o || path.join(srcDir, 'uxdsl-entry.uxdsl');
  const outFile = path.resolve(cwd, outArg);
  
  const excludedArg = argv.exclude || '';
  const excludedFiles = excludedArg.split(',').map(s => s.trim()).filter(Boolean);
  // Always exclude the output file itself to prevent self-import loop
  excludedFiles.push(path.basename(outFile));

  console.log(`[uxdsl] Scanning ${srcDirArg} for .uxdsl files...`);
  
  const allFiles = findFiles(srcDir, '.uxdsl');
  const validFiles = allFiles.filter(file => {
    return !excludedFiles.includes(path.basename(file));
  });

  const outputDir = path.dirname(outFile);
  
  // Prioritize certain files like theme definitions
  const PRIORITY_PATTERNS = ['theme-def', 'layout', 'app', 'variables'];

  const importLines = validFiles.map(file => {
      let relPath = path.relative(outputDir, file);
      relPath = relPath.split(path.sep).join('/');
      if (!relPath.startsWith('.')) relPath = './' + relPath;
      
      const basename = path.basename(file);
      const isPriority = PRIORITY_PATTERNS.some(p => basename.includes(p));
      return { path: relPath, isPriority, basename };
  });

  importLines.sort((a, b) => {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;
      return a.path.localeCompare(b.path);
  });

  let lines = [];
  lines.push("/* AUTO-GENERATED FILE - DO NOT EDIT MANUALLY */");
  lines.push(`/* Generated by uxdsl generate-entry */`);
  lines.push("");
  // MIG-B2-03: the PostCSS plugin emits the canonical default theme. Do not
  // import the legacy default packs here as well, otherwise a fresh init
  // produces duplicate declarations. The public postcss-uxdsl/theme/* files
  // remain available for explicit compatibility imports.
  lines.push("/* --- Application & Component Imports --- */");
  importLines.forEach(item => lines.push(`@import '${item.path}';`));
  lines.push("");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outFile, lines.join('\n'));
  console.log(`[uxdsl] Generated entry file at ${path.relative(cwd, outFile)} with ${importLines.length} imports.`);
}

// --- Command: Init ---

// MIG-B7-12 (FEAT-009): the config `init` writes is type-checked by the
// editor, with nothing added at run time. Three details, each measured
// (see docs/features/FEAT-009/MIG-B7-12-*.md):
// - JSDoc only, no `require('postcss-uxdsl/config')`: under pnpm's strict
//   node_modules a project that installed only uxdsl-cli cannot resolve
//   postcss-uxdsl from its root, and that `require` failed the build
//   ("Cannot find module"); a type import there only loses the type.
// - The annotation sits on a `const`, not on `module.exports = {…}`:
//   TypeScript checks nothing through the latter — not a typo, not even
//   `entry: 123`.
// - `// @ts-check`: editors do not check plain JavaScript by default
//   (VS Code's `checkJs` is off), so without it the type only completes.
// The object itself is unchanged, so the compiled CSS is byte-identical.
const CONFIG_TYPE_HEADER = `// @ts-check
// Checked by your editor against UXDSL's config type (a mistyped key such as
// "includeThem" is flagged as you type). Type-only: nothing is loaded at build
// time. See "Editor support" in the uxdsl-cli README.
/** @type {import('postcss-uxdsl/config').UxdslConfig} */
`;

async function init(argv) {
  const cwd = process.cwd();
  const isNext = ['next.config.js', 'next.config.mjs', 'next.config.ts'].some(file => fs.existsSync(path.join(cwd, file)));
  const isVite = fs.existsSync(path.join(cwd, 'vite.config.js')) || fs.existsSync(path.join(cwd, 'vite.config.ts'));
  // MIG-B4-03 (FEAT-005): opt-in only — without --multi, behavior is
  // byte-identical to before this story (see fixtures/mig-b2-03-cli-init/).
  const isMulti = !!argv.multi;

  console.log('[uxdsl] Initializing...');
  if (isNext) console.log('  -> Detected Next.js');
  if (isVite) console.log('  -> Detected Vite');
  if (isMulti) console.log('  -> Multi-entry mode (--multi): a theme entry plus one example component entry');

  const srcDir = path.join(cwd, 'src');

  // 1. Create uxdsl.config.cjs
  const configPath = path.join(cwd, 'uxdsl.config.cjs');
  if (!fs.existsSync(configPath)) {
    // No `breakpoints:` here: they are a theme family, declared in the
    // theme file — a build config that carries them is rejected.
    const configContent = CONFIG_TYPE_HEADER + (isMulti
      ? `const config = {
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
`
      : `const config = {
  // Entry point for your styles (generated or manual)
  entry: './src/uxdsl-entry.uxdsl',
  // Output CSS file
  outFile: './src/uxdsl.css',
  // Watch patterns for HMR/Rebuilds
  watch: ['src/**/*.uxdsl', 'src/**/*.css']
};
`) + '\nmodule.exports = config;\n';
    fs.writeFileSync(configPath, configContent);
    console.log(`  -> Created uxdsl.config.cjs`);
  } else {
    console.log(`  -> uxdsl.config.cjs already exists.`);
  }

  // 2. Create initial entry file(s)
  if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir);

  // The file the user edits. The entry generate-entry writes is rewritten
  // every time it runs, so styles go here and the entry imports them — it
  // exists before generateEntry runs so the first entry already lists it.
  const stylesPath = path.join(srcDir, 'styles.uxdsl');
  if (!isMulti && !fs.existsSync(stylesPath)) {
    fs.writeFileSync(stylesPath, `/* Your styles. src/uxdsl-entry.uxdsl imports this file; that entry is
   regenerated by \`uxdsl generate-entry\`, so write here, not there. */

.example {
  @ds-surface(contained);
  padding: density(3);
}
`);
    console.log('  -> Created src/styles.uxdsl (edit this one)');
  }

  if (isMulti) {
    const themeEntryPath = path.join(srcDir, 'theme.uxdsl');
    if (!fs.existsSync(themeEntryPath)) {
      fs.writeFileSync(themeEntryPath, '/* Theme-only entry — no component rules here. Emits the shared\n * :root definitions every other entry in "builds" consumes. */\n');
      console.log('  -> Created src/theme.uxdsl');
    }
    // A real example, not an empty file, so the very first build produces
    // something visible instead of a blank stylesheet.
    const panelEntryPath = path.join(srcDir, 'panel-a.uxdsl');
    if (!fs.existsSync(panelEntryPath)) {
      fs.writeFileSync(panelEntryPath, '.example {\n  @ds-surface(contained);\n}\n');
      console.log('  -> Created src/panel-a.uxdsl');
    }
  } else {
    const entryPath = path.join(srcDir, 'uxdsl-entry.uxdsl');
    if (!fs.existsSync(entryPath)) {
      // Run generate logic to create initial file
      await generateEntry({ src: './src', out: entryPath });
    }
  }

  // 3. Setup PostCSS (Required for Next.js, Optional/Good for Vite if not using plugin)
  // For Next.js, we must ensure postcss-uxdsl is in postcss.config.js.
  // A custom postcss.config.js REPLACES Next's default plugin list, so the
  // file written here names Next's own defaults first — the same modules
  // Next loads for its default config, with the same options (see
  // next/dist/build/webpack/config/blocks/css/plugins.js) — and only then
  // postcss-uxdsl. Without them a project silently lost autoprefixing.
  // No `theme` option: the plugin discovers the project's theme file itself.
  const POSTCSS_SNIPPET = `module.exports = {
  plugins: {
    // Next.js's own default PostCSS plugins, with Next's own options. A custom
    // postcss.config.js replaces Next's defaults, so they are named here; these
    // are the modules Next ships and uses for its default configuration. To
    // pin your own versions instead, install postcss-flexbugs-fixes and
    // postcss-preset-env and use those names.
    'next/dist/compiled/postcss-flexbugs-fixes': {},
    'next/dist/compiled/postcss-preset-env': {
      autoprefixer: { flexbox: 'no-2009' },
      stage: 3,
      features: { 'custom-properties': false },
    },
    // The CLI-generated global CSS already contains the theme; the project's
    // uxdsl.theme.json / uxdsl.theme.config.{js,cjs} (if any) is discovered
    // automatically for everything else.
    'postcss-uxdsl': { includeTheme: false },
  },
};
`;
  if (isNext) {
    const existingPostcss = ['postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs', 'postcss.config.json'].find(file => fs.existsSync(path.join(cwd, file)));
    let esm = false;
    try { esm = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).type === 'module'; } catch (_) {}
    const postcssPath = path.join(cwd, existingPostcss || (esm ? 'postcss.config.cjs' : 'postcss.config.js'));
    if (!existingPostcss) {
      fs.writeFileSync(postcssPath, POSTCSS_SNIPPET);
      console.log(`  -> Created ${path.basename(postcssPath)}`);
    } else {
      // MIG-B2-03 item 5: never overwrite or append to an existing
      // postcss.config.js (its plugin list, order and options are the
      // project's own) — print the exact snippet to merge in by hand.
      console.log(`  -> ${existingPostcss} already exists — not modified. For direct UXDSL compilation, merge these options using your config's module syntax:`);
      console.log(POSTCSS_SNIPPET.trim().split('\n').map((l) => `       ${l}`).join('\n'));
    }
  }

  // 4. package.json scripts — added only if absent, existing scripts of
  // any name are never touched (MIG-B2-03 item 4).
  const NEW_SCRIPTS = { 'uxdsl:build': 'uxdsl build', 'uxdsl:watch': 'uxdsl build --watch' };
  const pkgPath = path.join(cwd, 'package.json');
  let addedScripts = false;
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.scripts = pkg.scripts || {};
      const missing = Object.entries(NEW_SCRIPTS).filter(([name]) => !(name in pkg.scripts));
      if (missing.length) {
        missing.forEach(([name, cmd]) => { pkg.scripts[name] = cmd; });
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log(`  -> Added script(s) to package.json: ${missing.map(([name]) => name).join(', ')}`);
        addedScripts = true;
      } else {
        console.log('  -> package.json already has uxdsl:build/uxdsl:watch scripts — not modified.');
      }
    } catch (err) {
      console.log(`  -> Could not update package.json scripts (${err.message}). Add these by hand if you want them:`);
      console.log(`       "uxdsl:build": "${NEW_SCRIPTS['uxdsl:build']}", "uxdsl:watch": "${NEW_SCRIPTS['uxdsl:watch']}"`);
    }
  }

  // 5. Next Steps
  console.log('\n[uxdsl] Initialization complete.');
  console.log('Next steps:');
  if (isMulti) {
    const themeCssRel = path.relative(cwd, path.join(srcDir, 'theme.css')).split(path.sep).join('/');
    const panelCssRel = path.relative(cwd, path.join(srcDir, 'panel-a.css')).split(path.sep).join('/');
    console.log('1. Import the generated CSS files (once you run a build) — e.g.:');
    console.log(`   import './${themeCssRel}';`);
    console.log(`   import './${panelCssRel}';`);
    console.log(`2. Build: ${addedScripts ? 'npm run uxdsl:build' : 'npx uxdsl build'}`);
    console.log(`   Watch:  ${addedScripts ? 'npm run uxdsl:watch' : 'npx uxdsl build --watch'}`);
    console.log('3. Add more component entries to the "builds" array in uxdsl.config.cjs as the project grows.');
  } else {
    const outFileRel = path.relative(cwd, path.join(srcDir, 'uxdsl.css')).split(path.sep).join('/');
    console.log(`1. Edit src/styles.uxdsl. The entry src/uxdsl-entry.uxdsl is generated: run "npx uxdsl generate-entry" after adding or removing .uxdsl files.`);
    console.log(`2. Build: ${addedScripts ? 'npm run uxdsl:build' : 'npx uxdsl build'}`);
    console.log(`   Watch:  ${addedScripts ? 'npm run uxdsl:watch' : 'npx uxdsl build --watch'}${isNext ? ' (alongside next dev)' : isVite ? ' (alongside vite)' : ''}`);
    console.log(`3. Import the generated CSS once, from your root layout or app entry (path relative to that file):`);
    console.log(`   import './${outFileRel}';`);
    if (isVite) {
      console.log('   For direct .uxdsl imports instead of a generated file, use vite-plugin-uxdsl.');
    }
  }
  // MIG-B7-12 (FEAT-009): only what is true today — the extension ships as
  // a .vsix built from the repository, not from a marketplace (MIG-B7-05).
  console.log('\nEditor support: uxdsl.config.cjs is type-checked by your editor (// @ts-check).');
  console.log('For .uxdsl highlighting and completion (VS Code extension, installed from a .vsix)');
  console.log('and theme JSON completion ("$schema"), see "Editor support" in the uxdsl-cli README.');
}

const KNOWN_COMMANDS = ['init', 'generate-entry', 'build', 'theme'];

// MIG-B6-22 (FEAT-008): every flag each command actually reads, as one
// registry instead of scattered `argv.foo` reads scattered through each
// command's own function — printHelp, the CLI README and parseCommandArgv's
// validation below all have to agree on exactly this list, so a future
// story (MIG-B6-16's `--contrast`, MIG-B6-21's `--sourcemap`) adds its flag
// here once, not in three places that can drift apart.
//
// `manual` lists flags declared in neither `boolean` nor `string` — minimist
// then applies its own default inference (bare flag → `true`, `--no-x` →
// `false`, `--x=value` → the raw string `value`) exactly like an
// undeclared flag always has, and the flag's own resolver function (e.g.
// `resolveIncludeTheme`) does its own validation on that raw value instead
// of trusting minimist's implicit boolean coercion — which silently turns
// ANY unrecognized string into `true` (`--include-theme=banana` bug this
// story closes). `manual` still counts as "known" for unknown-flag
// detection; only its type declaration is deliberately left out.
const COMMAND_FLAG_SPECS = {
  init: { boolean: ['multi'], string: [], manual: [], alias: {} },
  'generate-entry': { boolean: [], string: ['src', 'out', 'exclude'], manual: [], alias: { out: 'o' } },
  // `strict-theme` is deliberately `manual`, not `string`: a minimist
  // `string`-typed flag turns a BARE flag (no `=value`) into `''` instead of
  // `true`, and `''` normalizes to "nothing here" — the bare flag would then
  // be silently ignored instead of refused with the scoped form.
  // MIG-B6-21: `sourcemap` is `manual` for the same reason as
  // `strict-theme` — a minimist `string`-typed flag turns the bare
  // `--sourcemap` into `''` instead of `true`, which would lose the
  // "bare flag means external" case entirely.
  build: { boolean: ['watch'], string: ['entry', 'out', 'config'], manual: ['include-theme', 'strict-theme', 'sourcemap'], alias: { watch: 'w', entry: 'e', out: 'o', config: 'c' } },
  // `theme` reads a theme, not an entry: --entry/--out have nothing to say to
  // it. Its strictness flag is build's, same name, same scope rule.
  theme: { boolean: ['diff', 'contrast'], string: ['config'], manual: ['strict-theme'], alias: { config: 'c' } },
};

const GLOBAL_FLAGS = ['help', 'version'];

function canonicalFlagName(rawArg) {
  return rawArg.replace(/^--?/, '').replace(/=.*$/, '').replace(/^no-/, '');
}

/** Parses argv scoped to the command actually invoked, so a flag valid for
 * one command but used on another (`--strict` on `build` instead of
 * `--strict-theme`) is unknown for THAT command, not silently accepted
 * because the name happens to exist elsewhere — and a typo (`--strict-thme`)
 * or a nonexistent flag fails loudly with a suggestion instead of being
 * ignored outright the way plain minimist does for anything undeclared.
 * The command itself is read directly off `rawArgs[0]`, never parsed by
 * minimist, so a mistyped flag immediately after it can't eat the command
 * token as its own value (minimist does exactly that for an undeclared
 * flag followed by a bare word — verified while building this). */
function parseCommandArgv(rawArgs) {
  const cmd = rawArgs[0] && !rawArgs[0].startsWith('-') ? rawArgs[0] : undefined;
  const rest = cmd !== undefined ? rawArgs.slice(1) : rawArgs;
  // No command: only the global flags mean anything. Anything else is not
  // silently treated as "build" — that is how `uxdsl` alone used to compile.
  if (cmd === undefined) {
    const stray = rest.filter((arg) => !['--help', '-h', '--version', '-v'].includes(arg));
    if (stray.length > 0) {
      throw new Error(`No command given (got ${stray.map((a) => JSON.stringify(a)).join(' ')}). To compile, run "uxdsl build ..."; "uxdsl --help" lists the commands.`);
    }
  }
  // An unrecognized command still needs *some* spec to parse its flags
  // with — "build" is as good as any, since main() reports "Unknown command"
  // for it regardless and that flag-validation result is discarded below.
  const spec = COMMAND_FLAG_SPECS[cmd] || COMMAND_FLAG_SPECS.build;
  const boolean = [...GLOBAL_FLAGS, ...spec.boolean];
  const string = [...spec.string];
  const alias = { help: 'h', version: 'v', ...spec.alias };
  const knownFlags = new Set([...boolean, ...string, ...spec.manual]);

  const unknownFlags = [];
  const argv = minimist(rest, {
    boolean, string, alias,
    unknown: (arg) => {
      if (arg.startsWith('-') && !knownFlags.has(canonicalFlagName(arg))) unknownFlags.push(arg);
      return true;
    },
  });

  // None of this CLI's flags are meant to accept multiple values — but
  // minimist collects a repeated flag (`--entry a --entry b`) into an
  // array instead of keeping only the last one, which every consumer
  // below (`path.resolve`, `String(...).split(',')`, ...) would either
  // choke on or silently misuse. The last occurrence winning is the
  // documented contract (see this story's Pruebas section), so collapse
  // any array here, once, instead of at every call site.
  for (const key of Object.keys(argv)) {
    if (key !== '_' && Array.isArray(argv[key])) argv[key] = argv[key][argv[key].length - 1];
  }

  // A command that isn't one of the four real ones gets its own clear
  // "Unknown command" error from main() — reporting every one of its flags
  // as "unknown option" too would only bury that message under noise for a
  // typo'd command name.
  if ((cmd === undefined || KNOWN_COMMANDS.includes(cmd)) && unknownFlags.length > 0) {
    const knownLongFlags = [...knownFlags];
    const message = unknownFlags.map((rawArg) => {
      const displayArg = rawArg.replace(/=.*$/, '');
      const suggestion = closestMatch(canonicalFlagName(rawArg), knownLongFlags);
      return `Unknown option ${displayArg}.` + (suggestion ? ` Did you mean --${suggestion}?` : '');
    }).join(' ');
    throw new Error(message);
  }

  return { cmd, argv };
}

// MIG-B6-23 (FEAT-008): the initial load+build a watch session starts
// from. Any failure here is fatal for a one-shot `build` (`watching:
// false` — unchanged: the error propagates to main()'s own outer
// try/catch, which exits 1). For `watch`/`build --watch`, the same
// failure is logged and this returns whatever it has (a real config, or
// `null`) instead of ending the process before a single file is even
// watched — `startWatch` accepts `null` and falls back to watching
// config/theme candidates until one loads successfully.
async function loadAndBuildForWatch(argv, watching) {
  let config = null;
  try {
    config = await loadConfig(argv);
  } catch (err) {
    if (!watching) throw err;
    console.error(`[uxdsl] Error: ${formatCliDiagnostic(err.message)} — watching for a fix...`);
    return null;
  }
  if (!config) {
    if (watching) console.error('[uxdsl] No configuration found — watching for one to appear...');
    return config;
  }
  try {
    await buildOnce(config);
  } catch (err) {
    if (!watching) throw err;
    console.error(`[uxdsl] Error: ${formatCliDiagnostic(err.message)}`);
  }
  return config;
}

// MIG-B6-12 (FEAT-008): `process.exitCode` everywhere, never `process.exit()`.
//
// Found by the beta.6 release gate: `uxdsl theme --contrast | jq` produced
// truncated JSON. `process.exit()` terminates immediately, and a write to a
// *pipe* is asynchronous — so anything still buffered is discarded. Redirected
// to a file the same command wrote 302,816 bytes; piped, it wrote 65,536 and
// the JSON ended mid-string. `--contrast` is the command large enough to show
// it today (302 KB, against 13 KB for `theme` and 5 KB for `theme --diff`),
// but the defect is in the exit path, not in any one command's size, so every
// documented `| jq` usage was one large theme away from the same truncation.
//
// Setting `exitCode` and returning lets Node exit once stdout has drained,
// with the same status. Watch mode is unaffected: it keeps the process alive
// through its own handles, which is what it did before.
async function main() {
  let cmd, argv;
  try {
    ({ cmd, argv } = parseCommandArgv(process.argv.slice(2)));
  } catch (err) {
    console.error(`[uxdsl] Error: ${formatCliDiagnostic(err.message)}`);
    process.exitCode = 1;
    return;
  }

  if (argv.version) {
    printVersion();
    return;
  }
  // Bare `uxdsl` is a question, not a build: answer with the help, exit 0.
  if (cmd === undefined) {
    printHelp();
    return;
  }
  if (!KNOWN_COMMANDS.includes(cmd)) {
    const replacement = REMOVED_COMMANDS[cmd];
    const suggestion = replacement ? `use "${replacement}"` : (closestMatch(cmd, KNOWN_COMMANDS) ? `did you mean "uxdsl ${closestMatch(cmd, KNOWN_COMMANDS)}"?` : 'run "uxdsl --help" for the list of commands');
    console.error(`[uxdsl] Unknown command "${cmd}": ${suggestion}`);
    process.exitCode = 1;
    return;
  }
  if (argv.help) {
    printHelp(cmd);
    return;
  }

  try {
    switch (cmd) {
      case 'init':
        await init(argv);
        break;
      case 'generate-entry':
        await generateEntry(argv);
        break;
      case 'build':
        {
          const watching = !!argv.watch;
          const config = await loadAndBuildForWatch(argv, watching);
          if (!config && !watching) {
            throw new Error('Nothing to build: no uxdsl.config.cjs, no theme file and no --entry/--out. Run "npx uxdsl init" to set a project up, or pass --entry <file> --out <file>.');
          }
          if (watching) {
            startWatch(config, argv, process.cwd(), buildOnce);
          }
        }
        break;
      case 'theme':
        await themeCommand(argv);
        break;
    }
  } catch (err) {
    console.error(`[uxdsl] Error: ${formatCliDiagnostic(err.message)}`);
    const frame = err && typeof err.showSourceCode === 'function' ? err.showSourceCode(false) : '';
    if (frame) console.error(frame);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

// Exported for tests (bin/uxdsl.test.js): pure-ish normalization functions
// that don't call process.exit, so they can be exercised directly instead
// of spawning the CLI as a subprocess for every case.
module.exports = {
  summarizeMixedEntries,
  packagedContrastExceptions,
  resolveSourceMap,
  isManagedSourceMap,
  CONFIG_CANDIDATES,
  THEME_CANDIDATES,
  DEFAULT_ENTRY_REL,
  DEFAULT_OUT_REL,
  findConfigPath,
  findThemeConfigPath,
  warnIfLooksLikeBuildConfig,
  loadThemeConfig,
  loadConfig,
  resolvePath,
  normalizeWatchGlobs,
  resolveIncludeTheme,
  resolveStrictTheme,
  normalizeStrictThemeScope,
  getKnownThemeFamilies,
  closestMatch,
  canonicalFlagName,
  COMMAND_FLAG_SPECS,
  parseCommandArgv,
  buildOnce,
  warnUnknownThemeKeys,
  diffThemeAgainstDefaults,
  findPartiallyDefaultedFamilies,
  themeCommand,
  startWatch,
  clearRequireCache,
  collectLocalRequireTree,
  init,
  generateEntry,
  main,
  printHelp,
  printVersion,
  GENERAL_HELP,
  COMMAND_HELP,
  KNOWN_COMMANDS,
  REMOVED_COMMANDS,
  REMOVED_CONFIG_KEYS,
  commitFileIfChanged,
  commitCompiled,
  bootstrapWatchTargets,
  loadAndBuildForWatch,
  findThemeLeakSelector,
  assertNoThemeLeakIntoCssModule,
  warnIfMultipleEntriesEmitTheme,
};
