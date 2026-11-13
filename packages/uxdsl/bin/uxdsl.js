#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { EventEmitter } = require('events');
const chokidar = require('chokidar');
const picomatch = require('picomatch');
const postcss = require('postcss');
// The CLI is part of the `uxdsl` package, so it compiles with the exact
// compiler, theme model and theme-file discovery shipped next to it — there is
// no second install to resolve and no version skew to survive.
const uxdslCore = require('../dist/compile');
const uxdslConfig = require('../dist/config');
const uxdslRuntime = {
  ...require('../dist/entries/theme'),
  ...require('../dist/entries/engine'),
};

// The top-level family registry the compiler itself validates against.
function getKnownThemeFamilies() {
  return uxdslRuntime.KNOWN_THEME_FAMILIES;
}

// Same edit-distance suggestion as the compiler's own diagnostics, case-
// insensitive: used for unknown flags, commands and theme families.
const { editDistance } = require('../dist/diagnostics');

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

// The theme-file candidate list lives in uxdsl/config (the plugin discovers
// the same file) — re-exported here so tests/tooling that reference
// `THEME_CANDIDATES` from this module keep working against the one real list.
const THEME_CANDIDATES = uxdslConfig.THEME_CANDIDATES;

// Build-config keys that used to exist and now have another home. Each is a
// hard error naming that home, never a silent no-op: a `theme:` that nobody
// reads would compile the project against the wrong theme without a word.
const REMOVED_CONFIG_KEYS = {
  theme: 'put the theme in a theme file next to this config (uxdsl.theme.json, or uxdsl.theme.js/.cjs exporting the theme object)',
  themeFile: 'name the theme file uxdsl.theme.json (or uxdsl.theme.js/.cjs) next to this config; it is discovered automatically',
  breakpoints: 'declare "breakpoints" in the theme file — the theme is the one source of thresholds for every integration',
  output: 'use "outFile"',
  sourceMap: 'the key is spelled "sourcemap", like the --sourcemap flag',
  includeTheme: 'write `@uxdsl theme;` in the stylesheet that defines the tokens; an entry without it emits no theme',
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
                    edit), the generated src/uxdsl-entry.uxdsl that loads it after
                    the generated src/uxdsl-theme.uxdsl (\`@uxdsl theme;\`) and,
                    in a Next.js project, postcss.config.js. Never overwrites a file.
  generate-entry    Rewrite the entry file: one @use per .uxdsl file found under a
                    directory, the options recorded in its header. With no
                    option, run again what the build's entry records, as
                    build --watch does when a .uxdsl file is added or removed.
  build             Compile the entry (or every entry in "builds") to CSS, once;
                    --watch keeps rebuilding as files change.
  theme             Print the effective theme as JSON: the same discovery and
                    resolution as build, no CSS written.

Global options:
  --help, -h        This help. "uxdsl <command> --help" describes one command.
  --version, -v     Print the installed uxdsl version.

Set UXDSL_DEBUG=1 to log which config and theme files were discovered.
An unrecognized flag, or a flag used on the wrong command, fails with a
suggestion instead of being ignored.
`;

const COMMAND_HELP = {
  init: `Usage: uxdsl init [--multi]

Creates, without ever overwriting an existing file:
  uxdsl.config.cjs         the build config (typed; your editor checks it)
  src/styles.uxdsl         the file you edit — loaded by the generated entry
  src/uxdsl-entry.uxdsl    generated by "generate-entry"; do not edit it
  src/uxdsl-theme.uxdsl    generated by "generate-entry" with the entry, which
                           loads it first: its \`@uxdsl theme;\` is where the
                           theme is emitted
  postcss.config.js        Next.js projects only: Next's own default plugins
                           plus uxdsl/postcss, since a custom file replaces
                           Next's defaults
and adds the uxdsl:build / uxdsl:watch scripts to package.json when missing.

Options:
  --multi           Scaffold a theme entry plus one example component entry
                    (a "builds" array) instead of the single-entry form. The
                    theme entry, src/theme.uxdsl, writes \`@uxdsl theme;\`.
`,
  'generate-entry': `Usage: uxdsl generate-entry [--src <dir>] [--out <file>] [--first <a,b>] [--exclude <a,b>] [--no-theme]

Rewrites the entry file: one "@use '<path>.uxdsl' as <namespace>;" per .uxdsl
file found under --src, each namespace unique and made from the file's path
relative to --src, after the first, which loads uxdsl-theme.uxdsl: a file
generate-entry writes next to the entry, whose \`@uxdsl theme;\` is where the
theme is emitted, before every listed file. Each file is its own Sass module,
so a file that reads another file's variables, mixins or functions loads it
with its own @use, "as *" or with each member written through the namespace:
under a namespaced @use, a function called by its bare name stays in the CSS
as written, with no error.

The entry's header records the invocation that wrote it, its paths relative
to the working directory. With no option, generate-entry runs again the
invocation each entry of the build config records (paths relative to the
config's directory); when none records one, the invocation the default
--out records, or the defaults below when it records none. build --watch
runs it again when a .uxdsl file under --src is added or removed. The file is
written only when its content changes.

Options:
  --src             Source directory to scan (default: ./src, or the current
                    directory when it has no src/)
  --out, -o         Output file path (default: uxdsl-entry.uxdsl in the --src
                    directory). The entry never lists itself or its theme
                    file.
  --first           Comma-separated files to load first, in that order (paths
                    relative to --src; ./ and .uxdsl optional). Without it,
                    the files are listed by path.
  --exclude         Comma-separated list of file names to leave out
  --no-theme        Write no theme file and no @use of it: an entry whose CSS
                    reads tokens another entry defines. Recorded with the
                    invocation. A theme file already there is left as it is.
`,
  build: `Usage: uxdsl build [options]

Compiles the entry from uxdsl.config.cjs (or --config, or --entry/--out) to
one CSS file. The theme comes from the theme file next to the config
(uxdsl.theme.json, or uxdsl.theme.js/.cjs exporting a computed theme).

Options:
  --config, -c      Path to the build config (default: uxdsl.config.cjs or
                    uxdsl.config.js in the current directory).
  --entry, -e       Entry .uxdsl file; with --out, compiles it without a config.
  --out, -o         Output CSS file path (with --entry).
  --watch, -w       Rebuild on file changes. Survives a broken edit: the last
                    good CSS stays on disk until the next valid save. An entry
                    that records the generate-entry run that wrote it is
                    regenerated when a .uxdsl file that run scans is added or
                    removed.
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

function printVersion() {
  console.log(`uxdsl ${CLI_VERSION}`);
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

// Theme candidate lookup, module loading/normalizing and the
// looks-like-a-build-config warning live in the shared config module —
// aliased here so the call sites in this file read the one implementation.
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
  // into `resolvedConfig.strictTheme`/`sourceMap` in one place — see
  // resolveStrictTheme/resolveSourceMap below.
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
      // MIG-B6-21 (FEAT-008): validated here, naming the file, like entry and
      // outFile above — a typo'd value ('External', true) must fail loudly
      // rather than read as "no map" and leave the user hunting for one.
      if (configModule.sourcemap !== undefined && configModule.sourcemap !== false && configModule.sourcemap !== 'inline' && configModule.sourcemap !== 'external') {
        throw new Error(`Invalid configuration in ${configPath}: "sourcemap" must be false, "inline" or "external".`);
      }
      // `sass` is checked here, naming this file, rather than by compile() at
      // build time; a Dart Sass option written outside it is refused rather
      // than ignored.
      validateSassConfig(configModule.sass, configPath);
      for (const key of SASS_OPTION_KEYS) {
        if (Object.prototype.hasOwnProperty.call(configModule, key)) {
          throw new Error(`Invalid configuration in ${configPath}: "${key}" is a Dart Sass option; write it inside "sass": sass: { ${key}: … }.`);
        }
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
      // outFile — a project declares either one entry inline
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
          if (buildEntry.sass !== undefined) {
            throw new Error(`Invalid configuration in ${configPath}: "builds[${index}].sass" is not a per-entry key: "sass" applies to every entry; set it once at the top level.`);
          }
          if (typeof buildEntry.entry !== 'string') {
            throw new Error(`Invalid configuration in ${configPath}: "builds[${index}].entry" must be a string path.`);
          }
          if (typeof buildEntry.outFile !== 'string') {
            throw new Error(`Invalid configuration in ${configPath}: "builds[${index}].outFile" must be a string path.`);
          }
          return {
            entry: resolvePath(buildEntry.entry, baseDir),
            outFile: resolvePath(buildEntry.outFile, baseDir),
          };
        });
      } else {
        resolvedConfig.entry = resolvePath(configModule.entry, baseDir);
        resolvedConfig.outFile = resolvePath(configModule.outFile, baseDir);
      }
      resolvedConfig.watch = configModule.watch || [];
      // `references` has exactly one home: the build config. A theme file
      // carries none (its loader refuses the old { theme, references } wrapper).
      resolvedConfig.references = configModule.references;
      // Dart Sass's options, passed to compile() for every entry.
      resolvedConfig.sass = configModule.sass;
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

// MIG-B6-21 (FEAT-008): `--sourcemap` (bare) means `external`, the mode that
// actually needs a filename; `--sourcemap=inline` and `--sourcemap=external`
// name the mode outright, and `--no-sourcemap` turns it off. `=true`/`=false`
// are accepted as synonyms of the bare/negated forms so the flag behaves like
// every other boolean-ish flag here (MIG-B6-22 made that consistency a rule),
// and any other explicit value is a hard error: a numeric value like
// `--sourcemap=0`, which minimist parses into the JS number 0, is rejected
// instead of quietly reading as a mode. Precedence is flag > config > false.
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
// `requireKnownFamilies` (passed by the real CLI call sites in
// loadConfig/themeCommand) makes a missing family list an error rather than
// a silently skipped check: an unvalidated scope would let "pallete" through
// while looking enabled.
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
          `Cannot validate family names for ${source}: no list of known theme families was given.`
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

// The keys of the build config's `sass`: compile()'s `sass` option, passed to
// Dart Sass for every entry.
const SASS_OPTION_KEYS = ['silenceDeprecations', 'quietDeps'];

/** The build config's `sass`, absent or an object of SASS_OPTION_KEYS: by the
 * rules compile() applies to its own `sass` option, each failure naming the
 * file and the key. */
function validateSassConfig(sass, configPath) {
  if (sass === undefined) return;
  if (sass === null || typeof sass !== 'object' || Array.isArray(sass)) {
    throw new Error(`Invalid configuration in ${configPath}: "sass" must be an object: { silenceDeprecations?: string[], quietDeps?: boolean }.`);
  }
  for (const key of Object.keys(sass)) {
    if (SASS_OPTION_KEYS.includes(key)) continue;
    const suggestion = closestMatch(key, SASS_OPTION_KEYS);
    throw new Error(
      `Invalid configuration in ${configPath}: "sass.${key}" is not a sass option; "sass" passes only silenceDeprecations and quietDeps to Dart Sass.` +
      (suggestion ? ` Did you mean "sass.${suggestion}"?` : '')
    );
  }
  const { silenceDeprecations, quietDeps } = sass;
  if (silenceDeprecations !== undefined && (!Array.isArray(silenceDeprecations) || silenceDeprecations.some((id) => typeof id !== 'string'))) {
    throw new Error(`Invalid configuration in ${configPath}: "sass.silenceDeprecations" must be an array of Dart Sass deprecation ids (strings), e.g. ['import'].`);
  }
  if (quietDeps !== undefined && typeof quietDeps !== 'boolean') {
    throw new Error(`Invalid configuration in ${configPath}: "sass.quietDeps" must be a boolean.`);
  }
}

// Compiles one { entry, outFile } pair against the theme, references and Dart
// Sass options every entry in a build shares. Returns the CSS to write without
// writing it: buildOnce compiles every entry to memory first, so a failure
// partway through a `builds` array leaves nothing written rather than some
// files updated and others stale. Also returns what the build counts the theme
// from: whether the entry emitted it (compile()'s `themeEmitted`, true when it
// reached `@uxdsl theme;`) and whether its CSS references a --uxdsl__ token.
async function compileEntryToCss(entryConfig, sharedConfig) {
  // Each of these names its concrete fix, not a generic "invalid
  // configuration".
  if (!entryConfig || !entryConfig.entry) {
    throw new Error('No entry file configured. Pass --entry <path>, or set "entry" in uxdsl.config.cjs (run "npx uxdsl init" to create one).');
  }
  if (!entryConfig.outFile) {
    throw new Error('No output file configured. Pass --out <path>, or set "outFile" in uxdsl.config.cjs.');
  }
  if (!fs.existsSync(entryConfig.entry)) {
    throw new Error(`Entry file not found: ${entryConfig.entry}. Pass --entry <path> pointing at an existing .uxdsl file, or run "npx uxdsl generate-entry" to create one.`);
  }
  // Delegates to compile(), the one pipeline every integration runs (protect,
  // Dart Sass, restore, the UXDSL plugin), so the CLI has no copy of its own
  // to drift. `to` is the absolute outFile, which is also where an external
  // `.map` lands, so the map's `sources` are relative to the right place in
  // both modes. `sass` is the config's Dart Sass options, shared by every
  // entry.
  const sourceMap = sharedConfig.sourceMap || false;
  const { css: compiledCss, map, dependencies, warnings, themeEmitted } = await uxdslCore.compile(
    { entry: entryConfig.entry },
    {
      theme: sharedConfig.theme,
      references: sharedConfig.references,
      to: entryConfig.outFile,
      sourceMap,
      sass: sharedConfig.sass,
    }
  );

  // The theme file is "detected" for an entry that emitted the theme, not for
  // one that only resolves and validates its references against it.
  if (sharedConfig.theme && themeEmitted) console.log('[uxdsl] Theme config detected');

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

  // `dependencies` (the entry first, then every file Dart Sass loaded, then
  // the theme files discovered) lets watch mode rebuild only the entries a
  // changed file affects. `warnings` are compile()'s, each at the author's
  // file, line and column when it has a position; buildOnce prints them.
  return {
    outFile: entryConfig.outFile, finalCss, dependencies, warnings, mapFile, mapContent: map,
    themeEmitted: themeEmitted === true, referencesTokens: uxdslCore.referencesThemeTokens(compiledCss),
  };
}

// The theme's "Unknown …" warnings (validateTheme's), printed as
// `[uxdsl] Warning: <path>: <message>` once per process: an unfixed misspelled
// family does not reprint on every save of a watch session. The set holds the
// exact printed strings, so the same message is not printed again in one
// process even after it was fixed in between; it is a diagnostic, not a gate.
const warnedUnknownThemeKeys = new Set();
// The texts of those warnings, printed or not. compile() reports the same
// theme warnings with no file and no path; buildOnce skips them, so each is
// printed once, in the form above that names its path.
const themeWarningTexts = new Set();

function warnUnknownThemeKeys(theme) {
  if (theme === undefined) return;
  let warnings;
  try {
    ({ warnings } = uxdslRuntime.validateTheme(theme));
  } catch (_) {
    return; // Diagnostic-only — must never be the reason a build fails.
  }
  for (const w of warnings || []) {
    if (!/^Unknown /.test(w.message)) continue;
    themeWarningTexts.add(w.message);
    const key = `${w.path}: ${w.message}`;
    if (warnedUnknownThemeKeys.has(key)) continue;
    warnedUnknownThemeKeys.add(key);
    console.warn(`[uxdsl] Warning: ${key}`);
  }
}

// One compile() warning as one line, with the working directory removed from
// every path in it, as from an error's message:
// `[uxdsl] Warning: <file>:<line>:<column>: <text>`, `<file>:<line>: <text>`
// without a column, `<file>: <text>` with a file only, and the text alone
// without a position (Dart Sass's summary of the deprecations it omitted, an
// unknown deprecation id).
function formatCompileWarning(warning) {
  const where = warning.file
    ? (warning.line != null
      ? `${warning.file}:${warning.line}${warning.column != null ? `:${warning.column}` : ''}: `
      : `${warning.file}: `)
    : '';
  return formatCliDiagnostic(`[uxdsl] Warning: ${where}${warning.text}`);
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
// ("Selector :root is not pure"). An entry that does not reach
// `@uxdsl theme;` emits no theme; this checks the actual output, not the
// source, since explicit native CSS can still write the selector. Not a
// general CSS Modules purity validator — only the one selector this compiler
// itself produces for the theme.
function assertNoThemeLeakIntoCssModule(outFile, css, label) {
  if (!/\.module\.css$/i.test(outFile)) return;
  const leaked = findThemeLeakSelector(css);
  if (!leaked) return;
  throw new Error(
    `${label}this entry would emit :root, which CSS Modules reject ` +
    '("Selector :root is not pure"). A CSS Module carries no theme: remove `@uxdsl theme;` (or the :root rule) from this entry and the files it loads, and write it in the global stylesheet.'
  );
}

// The build's UXD_THEME_MARKER warning, from the last result of every entry
// (compile()'s own text, shared with the Vite plugin and the webpack loader),
// with what to do about an entry generate-entry wrote. Null when one entry
// emits the theme, or none does and nothing needs it.
function themeEmissionMessage(states) {
  const warning = uxdslCore.themeEmissionWarning(states, 'entry');
  if (!warning) return null;
  const hint = warning.kind === 'many'
    ? ' A component entry written by generate-entry leaves it out with --no-theme.'
    : ' For an entry generate-entry wrote, run uxdsl generate-entry again.';
  return `[uxdsl] Warning: ${warning.text}${hint}`;
}

function formatCliDiagnostic(message) {
  const cwdPrefix = `${process.cwd()}${path.sep}`;
  return String(message).split('\n').map(line => line.split(cwdPrefix).join('')).join('\n');
}

// The frame printed under a failure's message, chosen by the error's own
// `code`, never parsed from its message. A UXD_SASS error carries Sass's own
// frame and stack, drawn with the author's text and columns and without the
// message line (`sassFrame`), printed verbatim with every line indented by two
// spaces; its stack paths are already relative to the working directory. A
// PostCSS error carries a frame of the author's source (`showSourceCode`).
// `error.cause` is never printed: it shows the text Sass compiled, not the
// author's.
function errorFrame(err) {
  if (err && err.code === 'UXD_SASS' && typeof err.sassFrame === 'string' && err.sassFrame.trim()) {
    return err.sassFrame.split('\n').map((line) => `  ${line}`).join('\n');
  }
  return err && typeof err.showSourceCode === 'function' ? err.showSourceCode(false) : '';
}

// One failure on stderr: `prefix` and the message with the working directory
// removed from its paths, then the frame when there is one.
function printFailure(prefix, err) {
  console.error(`${prefix}${formatCliDiagnostic(err && err.message)}`);
  const frame = errorFrame(err);
  if (frame) console.error(frame);
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

// One build: every entry of `config.builds` (or the single entry/outFile)
// compiled against the one shared theme and references, all of them to
// memory before anything is written, so a failure leaves every output as it
// was. `entryIndices` compiles and commits only those entries (watch mode's
// selective rebuild); the others are not recompiled, rewritten or returned.
// Returns each compiled entry's `dependencies`, from which watch mode builds
// its graph.
//
// Each entry's compile() warnings print as soon as that entry compiles, so
// they come before a later entry's error and before anything is written, one
// line each (formatCompileWarning). A warning with a file is the same warning
// whichever entry reports it: a line identical to one already printed in this
// build is not printed again (a partial two entries load warns once). A
// warning without a position is the reporting entry's own (Dart Sass's count
// of the deprecations it omitted for that entry), so each entry prints its
// own, though two entries' lines read the same. Every build that recompiles an
// entry prints its warnings again. A theme warning compile() reports without a
// file is skipped: warnUnknownThemeKeys prints it with its path.
//
// The theme is counted over the last result of every entry: this build's, and,
// for an entry a selective build did not recompile, the one `session` (a watch
// session's { themeStates, themeWarning }) holds. No entry emitting it while
// the CSS references its tokens, or more than one emitting it, is one
// UXD_THEME_MARKER warning; with a session it is printed when it differs from
// the one printed last, and the session is updated only by a build that
// succeeds.
async function buildOnce(config, entryIndices, session) {
  // MIG-B4-01 (FEAT-005): fails fast, before compiling or writing
  // anything, if the project explicitly declared a theme family that
  // ended up partially filled from DEFAULT_THEME — the same question
  // `uxdsl theme --strict-theme` already answers (MIG-B3-04), now reachable
  // from `build`/`watch` directly instead of requiring a separate command.
  // Checked once here, not per-entry: the theme is shared across every
  // entry, `builds` or not.
  if (config && config.strictTheme) {
    const effectiveTheme = uxdslRuntime.resolveTheme(config.theme);
    const incomplete = findPartiallyDefaultedFamilies(config.theme, effectiveTheme, config.strictTheme);
    if (incomplete.length > 0) {
      throw new Error(
        `--strict-theme (scoped to: ${config.strictTheme.join(', ')}): the following theme families you declared are partially filled from defaults: ${incomplete.join(', ')}. ` +
        'Provide every key of these families explicitly, or drop --strict-theme/strictTheme if inheriting some of them is intentional.'
      );
    }
  }

  // The theme's "Unknown …" warnings (an unknown top-level family), with
  // their path, checked once per build like `--strict-theme`.
  warnUnknownThemeKeys(config && config.theme);

  const entries = config && config.builds && config.builds.length
    ? config.builds
    : [{ entry: config && config.entry, outFile: config && config.outFile }];
  const multi = entries.length > 1;
  const indices = entryIndices || entries.map((_, i) => i);

  const compiled = [];
  const printedWarnings = new Set();
  for (const i of indices) {
    try {
      const result = await compileEntryToCss(entries[i], config || {});
      for (const warning of result.warnings || []) {
        if (!warning.file && themeWarningTexts.has(warning.text)) continue;
        const line = formatCompileWarning(warning);
        const key = warning.file ? line : `${i}\n${line}`;
        if (printedWarnings.has(key)) continue;
        printedWarnings.add(key);
        console.warn(line);
      }
      compiled.push({ index: i, ...result });
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
  // written).
  for (const { index, outFile, finalCss } of compiled) {
    const label = multi ? `builds[${index}] (${path.relative(process.cwd(), outFile)}): ` : '';
    try {
      assertNoThemeLeakIntoCssModule(outFile, finalCss, label);
    } catch (err) {
      annotateThemeError(err, config || {});
      throw err;
    }
  }

  // The theme, counted over the last result of every entry. A CSS Module
  // cannot carry it (the check above refuses its :root).
  const themeStates = new Map(session ? session.themeStates : []);
  for (const { index, outFile, themeEmitted, referencesTokens } of compiled) {
    themeStates.set(index, {
      label: multi ? `builds[${index}]` : path.relative(process.cwd(), outFile),
      themeEmitted, referencesTokens, canCarryTheme: !/\.module\.css$/i.test(outFile),
    });
  }
  for (const index of themeStates.keys()) if (index >= entries.length) themeStates.delete(index);
  const themeWarning = themeEmissionMessage([...themeStates.keys()].sort((a, b) => a - b).map((index) => themeStates.get(index)));
  if (themeWarning && (!session || session.themeWarning !== themeWarning)) console.warn(themeWarning);

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

  if (session) {
    session.themeStates = themeStates;
    session.themeWarning = themeWarning;
  }
  return compiled.map(({ index, outFile, dependencies, themeEmitted, referencesTokens }) => ({
    index, outFile, dependencies, themeEmitted, referencesTokens, canCarryTheme: !/\.module\.css$/i.test(outFile),
  }));
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
 * a pattern covers is printed under `excepted`. */
function packagedContrastExceptions() {
  const loaded = require('../src/theme/base.contrast-exceptions.json');
  if (Array.isArray(loaded)) return loaded;
  return Array.isArray(loaded && loaded.exceptions) ? loaded.exceptions : [];
}

async function themeCommand(argv, cwd = process.cwd()) {
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
 * This tree-walk lives once, in the shared config module (the plugin's own
 * theme discovery needs it too) — aliased here under the CLI's names. */
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

// chokidar 4 watches paths, not globs, so the watch list is split here into
// what to watch and what to report. An entry is a glob when it has `*`, `?`,
// a `[…]` class, a `{…}` set or an extglob (`@(…)`, `!(…)`, `+(…)`); a
// parenthesis alone is a literal path character, so a Next.js route group
// (`app/(marketing)/…`) or `file (1).uxdsl` is a path. A path is watched as
// is — a file, a directory (recursively) or one that does not exist yet. A
// glob watches its static base directory, and an event is reported only when
// its path matches the glob (picomatch, `dot: true`: what chokidar 3 matched
// with); directories no glob can reach below are not traversed, and files no
// glob matches are not watched.
//
// Beside the list, `follow(files)` names exact files to report as well: the
// entries and every file their builds loaded. Each is watched through its
// directory, never as a root of its own, because chokidar stops reporting a
// file root once it is deleted, while a directory keeps reporting its file
// when it is created again. A followed directory's other files and its
// subdirectories stay unwatched unless the list reaches them. The directories
// above a followed directory are not ignored either (their other entries are,
// unless the list reaches them), so a followed directory that does not exist,
// or no longer does, is reported when it appears below one that is watched.
// `follow` replaces the followed files and returns the directories of those
// not followed before, for the watcher to add; the directories it returned
// stay followed. `followedDirsIn(dir)` is the followed directories at or below
// `dir`.
const toPosixPath = (file) => file.split(path.sep).join('/');

function watchSelection(targets) {
  const plain = new Set();
  const globs = [];
  const roots = new Set();
  for (const target of targets) {
    const posix = toPosixPath(target);
    const scan = picomatch.scan(posix, { noparen: true });
    if (!scan.isGlob) {
      const resolved = path.resolve(target);
      plain.add(resolved);
      roots.add(resolved);
      continue;
    }
    const base = path.resolve(scan.base || '/');
    roots.add(base);
    const rest = scan.glob;
    const segments = rest.split('/');
    globs.push({
      base,
      matches: picomatch(posix, { dot: true }),
      // A brace or an extglob may span a `/`; such a glob is never used to prune.
      segments: /[{(]/.test(rest) ? null : segments.map((s) => (s === '**' ? s : picomatch(s, { dot: true }))),
    });
  }
  const plainList = [...plain];
  const inside = (file, dir) => file.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);
  // A plain target, a directory inside one, or an ancestor chokidar needs to
  // reach one that does not exist yet.
  const nearPlain = (file) => plain.has(file) || plainList.some((p) => inside(file, p) || inside(p, file));
  const followed = new Set();
  const followedDirs = new Set();
  // Every directory above a followed directory, up to the file system's root.
  const aboveFollowed = new Set();
  const selects = (file) => {
    const resolved = path.resolve(file);
    if (followed.has(resolved)) return true;
    if (plain.has(resolved) || plainList.some((p) => inside(resolved, p))) return true;
    const posix = toPosixPath(resolved);
    return globs.some((g) => g.matches(posix));
  };
  const mayContainMatches = (dir) => globs.some((g) => {
    if (dir === g.base || inside(g.base, dir)) return true;
    if (!inside(dir, g.base)) return false;
    if (!g.segments) return true;
    const parts = toPosixPath(path.relative(g.base, dir)).split('/');
    for (let i = 0; i < parts.length; i++) {
      const segment = g.segments[i];
      if (segment === '**') return true;
      // The last segment names files; a directory has to sit above it.
      if (i >= g.segments.length - 1 || !segment(parts[i])) return false;
    }
    return true;
  });
  const ignored = (file, stats) => {
    const resolved = path.resolve(file);
    if (followed.has(resolved) || followedDirs.has(resolved) || aboveFollowed.has(resolved)) return false;
    if (nearPlain(resolved)) return false;
    if (!stats) return false; // chokidar asks again with the stats
    if (stats.isDirectory()) return !mayContainMatches(resolved);
    return !globs.some((g) => g.matches(toPosixPath(resolved)));
  };
  const follow = (files) => {
    const before = new Set(followed);
    followed.clear();
    const dirs = new Set();
    for (const file of files) {
      const resolved = path.resolve(file);
      followed.add(resolved);
      if (!before.has(resolved)) dirs.add(path.dirname(resolved));
    }
    for (const dir of dirs) {
      followedDirs.add(dir);
      for (let up = path.dirname(dir); !aboveFollowed.has(up); up = path.dirname(up)) {
        aboveFollowed.add(up);
        if (path.dirname(up) === up) break;
      }
    }
    return [...dirs];
  };
  const followedDirsIn = (dir) => {
    const resolved = path.resolve(dir);
    return [...followedDirs].filter((followedDir) => followedDir === resolved || inside(followedDir, resolved));
  };
  return { roots: [...roots], selects, ignored, follow, followedDirsIn };
}

// The CLI's watcher: chokidar 4 over `watchSelection(targets)`, emitting only
// the selected paths' events (`all`), plus `ready` and `error`. `follow(files)`
// adds the directories of newly followed files to this same watcher, so no
// event is lost to a restart.
//
// chokidar stops watching a directory once it is deleted. It watches a path
// that does not exist through its parent, for that one name, and a parent it
// watches for two such names reports only one of them. So a followed directory
// that does not exist when it is followed, or that is deleted (an `unlinkDir`
// of it or of a directory above it), is watched through the nearest directory
// above it that exists, as a directory: when the followed directory appears,
// its followed files are reported as added, and it is watched again.
//
// Once a file it was ignoring is followed, chokidar reports it as `add` when
// a change in its directory next makes chokidar read that directory, though
// nothing changed the file: the save of a file beside it, when the build of
// that save is what starts loading it. `follow(files, loadedSince)` is told
// when the build that loaded the files started; a newly followed file the
// watch list does not select, last modified before then by more than the file
// system's time resolution (so the build read its current content), keeps its
// stats, and an event that finds them unchanged is dropped. The first event
// that finds them changed, or the file gone, is reported, and the file is then
// reported like any other.
//
// `keep(file)` does the same for a selected file the session has just written
// itself (a regenerated entry): the event of that write finds the stats kept
// and is dropped; a later change is reported.
function fileStats(file) {
  try {
    return fs.statSync(file, { throwIfNoEntry: false }) || null;
  } catch (_) {
    return null;
  }
}

// A time in whole seconds comes from a file system that keeps seconds (FAT
// keeps two): two seconds then; otherwise a margin for a coarse kernel clock.
function fileTimeResolutionMs(stats) {
  return stats.mtimeMs % 1000 === 0 ? 2000 : 100;
}

function createWatcher(targets) {
  const { roots, selects, ignored, follow, followedDirsIn } = watchSelection(targets);
  const events = new EventEmitter();
  const watcher = chokidar.watch(roots, { ignoreInitial: true, ignored });
  // Watches each of `dirs`, or the nearest directory above it that exists.
  const watchDirs = (dirs) => {
    const watched = new Set();
    for (const dir of dirs) {
      let existing = dir;
      while (!fs.existsSync(existing) && path.dirname(existing) !== existing) existing = path.dirname(existing);
      watched.add(existing);
    }
    if (watched.size) watcher.add([...watched]);
  };
  // Absolute file -> its stats when it was followed, for the files above.
  const unchanged = new Map();
  watcher.on('all', (event, file) => {
    if (event === 'unlinkDir') watchDirs(followedDirsIn(file));
    if (!selects(file)) return;
    const resolved = path.resolve(file);
    const known = unchanged.get(resolved);
    if (known) {
      const now = fileStats(resolved);
      if (now && now.mtimeMs === known.mtimeMs && now.size === known.size && now.ino === known.ino) return;
      unchanged.delete(resolved);
    }
    events.emit('all', event, file);
  });
  watcher.on('ready', () => events.emit('ready'));
  watcher.on('error', (error) => events.emit('error', error));
  events.close = () => watcher.close();
  // Returns the newly followed files that keep their stats.
  events.follow = (files, loadedSince) => {
    const unselected = files.map((file) => path.resolve(file)).filter((file) => !selects(file));
    const dirs = follow(files);
    for (const file of unchanged.keys()) if (!selects(file)) unchanged.delete(file);
    const kept = [];
    if (loadedSince !== undefined) {
      for (const file of unselected) {
        const stats = fileStats(file);
        if (stats && stats.mtimeMs < loadedSince - fileTimeResolutionMs(stats)) {
          unchanged.set(file, stats);
          kept.push(file);
        }
      }
    }
    watchDirs(dirs);
    return kept;
  };
  events.keep = (file) => {
    const resolved = path.resolve(file);
    const stats = fileStats(resolved);
    if (stats) unchanged.set(resolved, stats);
  };
  return events;
}

// Watches and rebuilds until the process ends. `initialConfig` is `null` when
// the first load failed (already printed): the session then watches the
// config and theme candidates until one loads. `initialResults` are the
// first build's results, absent when it failed; they seed the dependency
// graph, so the first change after start already rebuilds only the entries
// it affects. `initialSession` is the theme count the first build seeded
// (buildOnce's `session`); every later build, full or selective, reads and
// updates it, so a selective build counts the theme over every entry.
//
// Beside the config's `watch` patterns, the session follows every entry of
// the current config and every file the graph holds (each file an entry's
// last successful build loaded: a `.scss` or `.css` partial, a file outside
// the entry's directory or in node_modules), through their directories on the
// same watcher; a directory of them that is deleted is watched for again, so
// restoring it rebuilds the entries that load its files. A file a build fails
// to find is not followed, since Dart Sass does not report the paths it tried:
// a missing partial is noticed when it appears only where a `watch` pattern
// matches it.
//
// An entry of the config whose header records the invocation that generated
// it (recordedEntryOptions) is kept current: every .uxdsl file under its --src
// is watched too, from the first build (full or not) after its header records
// the invocation, and the `add` or `unlink` of one, before it is built, plans
// the entry again from that invocation and writes it when its content changed,
// printing `[uxdsl] regenerated <entry> (<n> files)`. The event of that write
// is dropped (`keep`), so the add or unlink builds once. A `change` never
// regenerates, nor does an event on an entry itself; an entry whose header
// records no invocation is never written. A regeneration that fails prints
// `[uxdsl] Error: regenerating <entry>: …` and writes nothing; the event is
// then built as any other.
function startWatch(initialConfig, argv, cwd, builder, initialResults, initialSession) {
  let config = initialConfig;
  const session = initialSession || { themeStates: new Map(), themeWarning: null };
  // Entry index -> Set<absolute dependency path>, from each entry's own
  // compile() result: seeded by the first build, replaced by every successful
  // full build, and updated for the entries a selective build recompiled. A
  // failed build never touches it, so a later change is checked against the
  // last valid graph.
  let dependencyGraph = new Map((initialResults || []).map(({ index, dependencies }) => [index, new Set(dependencies)]));
  // The configured entries that record their invocation, each with the
  // options it gives or the error reading them gave. Read from the entries'
  // headers each time.
  function generatedEntries() {
    if (!config) return [];
    const base = config.configPath ? path.dirname(config.configPath) : cwd;
    const generated = [];
    for (const entry of configEntryFiles(config)) {
      try {
        const options = recordedEntryOptions(entry, base);
        if (options) generated.push({ entry, options });
      } catch (error) {
        generated.push({ entry, error });
      }
    }
    return generated;
  }
  // The config's `watch` patterns and, for each generated entry, every .uxdsl
  // file under its --src.
  function watchTargets() {
    const targets = [...config.watch];
    for (const { options } of generatedEntries()) {
      if (!options) continue;
      const sources = path.join(options.srcDir, '**/*.uxdsl');
      if (!targets.includes(sources)) targets.push(sources);
    }
    return targets;
  }
  let watchedTargets = config ? watchTargets() : bootstrapWatchTargets(argv, cwd);
  let watcher = createWatcher(watchedTargets);
  // Follows every entry of the current config and every file of the graph.
  // `loadedSince` is when the successful build that produced the graph
  // started (see createWatcher).
  function followAll(loadedSince) {
    if (!config) return;
    const files = new Set(configEntryFiles(config));
    for (const dependencies of dependencyGraph.values()) for (const file of dependencies) files.add(file);
    watcher.follow([...files], loadedSince);
  }
  followAll();
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

  // Recreates the watcher when watchTargets() differs from what it watches: a
  // reloaded config, or an entry whose header started or stopped recording an
  // invocation or records another --src. Returns whether it was recreated.
  async function refreshWatcher() {
    const nextTargets = watchTargets();
    if (JSON.stringify([...watchedTargets].sort()) === JSON.stringify([...nextTargets].sort())) return false;
    // Recreate to handle overlapping globs without unwatch() leaving
    // exclusions behind. Keep config errors recoverable on the old watcher.
    await watcher.close();
    watchedTargets = nextTargets;
    watcher = createWatcher(watchedTargets);
    watcher.on('all', onChange);
    await new Promise((resolve, reject) => {
      watcher.once('ready', resolve);
      watcher.once('error', reject);
    });
    return true;
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
      // A config that fails to load does not end the process: it is printed
      // and the session keeps watching with the watcher it has.
      console.error(`[uxdsl] Error: ${formatCliDiagnostic(err.message)} — watching for a fix...`);
      return;
    }
    if (!reloaded) {
      if (!config) console.error('[uxdsl] No configuration found — watching for one to appear...');
      return;
    }
    config = reloaded;
    await refreshWatcher();
    // The reloaded config's entries are followed before it builds, so an
    // entry whose first build fails is still watched.
    followAll();
    try {
      const startedAt = Date.now();
      const results = await builder(config, undefined, session);
      dependencyGraph = new Map(results.map(({ index, dependencies }) => [index, new Set(dependencies)]));
      followAll(startedAt);
    } catch (err) {
      // The message and its frame, as a one-shot build prints them. The
      // previous dependency graph is kept: a failed rebuild does not
      // invalidate what the last successful one knew.
      printFailure('[uxdsl] build failed: ', err);
    }
  }

  async function runSelectiveBuild(indices) {
    // A change of an entry can make its header record an invocation: its
    // --src is watched from this build on.
    if (await refreshWatcher()) followAll();
    try {
      const startedAt = Date.now();
      const results = await builder(config, indices, session);
      for (const { index, dependencies } of results) {
        dependencyGraph.set(index, new Set(dependencies));
      }
      followAll(startedAt);
    } catch (err) {
      printFailure('[uxdsl] build failed: ', err);
    }
  }

  // Decides full vs. selective for one changed file, without yet running
  // anything — shared between a fresh event and a queued-batch replay.
  function classify(resolvedFile) {
    if (!config || configRelatedPaths().has(resolvedFile)) return { full: true };
    const indices = entriesAffectedBy(resolvedFile);
    // In no entry's known dependencies: a graph the session never had (the
    // first build failed before compiling anything), or a file outside every
    // entry's last graph, such as a missing partial just created. Rebuilding
    // everything recovers the build rather than doing nothing.
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
    // about a new one after a config change moved it. With `builds`, every
    // entry's outFile is checked.
    if (filePath && config && isOwnOutputFile(config, filePath)) {
      return;
    }
    const rel = path.relative(process.cwd(), filePath);
    console.log(`[uxdsl] ${event} ${rel}`);
    if ((event === 'add' || event === 'unlink') && filePath && filePath.endsWith('.uxdsl')) regenerateEntries(path.resolve(filePath));
    trigger(filePath ? path.resolve(filePath) : undefined);
  }

  // Writes again, before the event of `resolvedFile` is built, each generated
  // entry whose --src holds that file, or whose theme file it is, when its plan
  // differs from the file: its theme file first, then the entry.
  function regenerateEntries(resolvedFile) {
    if (!config || configEntryFiles(config).includes(resolvedFile)) return;
    for (const { entry, options, error } of generatedEntries()) {
      const entryRel = path.relative(process.cwd(), entry);
      try {
        if (error) throw error;
        const isThemeFile = options.theme && resolvedFile === themeFileOf(entry);
        if (!isThemeFile && !resolvedFile.startsWith(options.srcDir.endsWith(path.sep) ? options.srcDir : options.srcDir + path.sep)) continue;
        const plan = planRecordedEntry(options);
        if (plan.theme && commitFileIfChanged(plan.theme.file, plan.theme.content) === 'written') {
          watcher.keep(plan.theme.file);
          console.log(`[uxdsl] regenerated ${path.relative(process.cwd(), plan.theme.file)} (the theme file ${entryRel} loads first)`);
        }
        if (commitFileIfChanged(entry, plan.content) !== 'written') continue;
        watcher.keep(entry);
        console.log(`[uxdsl] regenerated ${entryRel} (${plan.count} file${plan.count === 1 ? '' : 's'})`);
      } catch (err) {
        console.error(`[uxdsl] Error: regenerating ${entryRel}: ${formatCliDiagnostic(err.message)}`);
      }
    }
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

// The entry generate-entry writes loads every .uxdsl file found under --src
// with one `@use '<url>' as <namespace>;`, so each listed file is its own Sass
// module: a file reads another file's variables, mixins, functions or
// placeholders only through its own @use. Its first @use loads the theme file
// generate-entry writes next to it, uxdsl-theme.uxdsl, whose one statement is
// `@uxdsl theme;`: the theme is emitted there, before every listed file
// (--no-theme leaves out both the file and the line).
//
// Its header records the invocation that wrote it, on the line after the
// first two (invocationLine): `uxdsl generate-entry` with no option, and
// `build --watch` when a .uxdsl file under --src is added or removed, run that
// line again for an entry of the build config.

const ENTRY_HEADER_START = [
  '/* AUTO-GENERATED FILE - DO NOT EDIT MANUALLY */',
  '/* Generated by uxdsl generate-entry */',
];
const ENTRY_HEADER_END = "/* As the build's entry, it is regenerated by uxdsl build --watch when a .uxdsl file under --src is added or removed, and by uxdsl generate-entry with no arguments, from the line above. */";
const RECORDED_INVOCATION_START = '/* uxdsl generate-entry';

// The second file generate-entry writes, next to the entry, which loads it
// first. Its comments are Sass's silent ones, so they never reach the CSS; its
// content names no entry, so two entries in one directory write the same bytes.
// A file there counts as generate-entry's when it starts with the header.
const THEME_FILE_NAME = 'uxdsl-theme.uxdsl';
const THEME_NAMESPACE = 'uxdsl-theme';
const THEME_FILE_HEADER = '// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY';
const THEME_FILE_CONTENT = [
  THEME_FILE_HEADER,
  '// Written by uxdsl generate-entry next to the entry, which loads it first: the',
  '// theme (every --uxdsl__ token) is emitted where the line below is, before the',
  "// entry's other files. generate-entry --no-theme leaves this file out.",
  '@uxdsl theme;',
  '',
].join('\n');

// The theme file of the entry `outFile`: next to it, whether or not it loads it.
function themeFileOf(outFile) {
  return path.join(path.dirname(outFile), THEME_FILE_NAME);
}

// A file at the theme file's path that generate-entry did not write is
// refused rather than overwritten or silently left out.
function assertThemeFileOwned(themeFile) {
  if (fs.existsSync(themeFile) && !fs.readFileSync(themeFile, 'utf8').startsWith(THEME_FILE_HEADER)) {
    throw new Error(`${path.relative(process.cwd(), themeFile)} was not written by generate-entry, which writes its theme file under that name next to the entry. Rename that file.`);
  }
}

// The characters a URL reads as something else (a percent escape, a fragment,
// a query), that end the quoted string, or that start an escape in it (a
// backslash, which a POSIX file name may hold), percent-encoded; every other
// character is written as it is.
function encodeEntryUrl(urlPath) {
  return urlPath.replace(/[%#?'\\]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

// A file's path as Sass names it: its directory, and its file name without
// `.uxdsl` and without the underscore before a partial's name (a file named
// `_.uxdsl` keeps it).
function sassPathParts(posixPath) {
  const stem = path.posix.basename(posixPath, '.uxdsl');
  return { dir: path.posix.dirname(posixPath), name: stem.length > 1 ? stem.replace(/^_/, '') : stem };
}

// A file's natural namespace, from its path relative to --src as Sass names it:
// lowercased, every character outside [a-z0-9-] a `-`, and `f-` before a
// leading digit (Sass does not start an identifier with one) or `-`.
function entryNamespace(fromSrc) {
  const { dir, name } = sassPathParts(fromSrc);
  const natural = path.posix.join(dir, name).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return /^[0-9-]/.test(natural) ? `f-${natural}` : natural;
}

// A --first item as a path relative to --src: without `./`, with `.uxdsl`.
function firstItemPath(item) {
  const relative = toPosixPath(item).replace(/^\.\//, '');
  return relative.endsWith('.uxdsl') ? relative : `${relative}.uxdsl`;
}

// A path as the recorded invocation writes it: POSIX, relative to `base`,
// starting with `./` (or `../`), and `.` for `base` itself.
function invocationPath(file, base) {
  const relative = toPosixPath(path.relative(base, file));
  if (relative === '') return '.';
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('../')) return relative;
  return `./${relative}`;
}

// A recorded value as one word: as it is, or as a JSON string when it holds
// whitespace, a `"`, a `\`, `*/` or `#{`. In the JSON string `*/` is written
// `*\/`, so the comment does not end there, and `#{` as `\u0023{`, since Dart
// Sass interpolates `#{…}` in a comment.
function invocationWord(value) {
  if (!/[\s"\\]/.test(value) && !value.includes('*/') && !value.includes('#{')) return value;
  return JSON.stringify(value).split('*/').join('*\\/').split('#{').join('\\u0023{');
}

// The header line that records a run: `uxdsl generate-entry`, --src and --out
// (always, relative to `base`), then --first (each item relative to --src) and
// --exclude when the run had them, and --no-theme last when it had it. A value
// that starts with `-` follows an `=`, since on its own it would read as a flag.
function invocationLine(options) {
  const words = ['uxdsl', 'generate-entry'];
  const flag = (name, value) => {
    if (value.startsWith('-')) words.push(`--${name}=${invocationWord(value)}`);
    else words.push(`--${name}`, invocationWord(value));
  };
  flag('src', invocationPath(options.srcDir, options.base));
  flag('out', invocationPath(options.outFile, options.base));
  if (options.first) flag('first', options.first.map(firstItemPath).join(','));
  if (options.exclude.length) flag('exclude', options.exclude.join(','));
  if (!options.theme) words.push('--no-theme');
  return `/* ${words.join(' ')} */`;
}

// The words of a recorded invocation, separated by whitespace. A word is a run
// of characters other than whitespace and `"`, a JSON string, or both side by
// side (`--first="a b.uxdsl"`).
function invocationWords(text) {
  const words = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i += 1;
      continue;
    }
    let word = '';
    while (i < text.length && !/\s/.test(text[i])) {
      if (text[i] !== '"') {
        word += text[i];
        i += 1;
        continue;
      }
      let end = i + 1;
      while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
      if (end >= text.length) throw new Error(`a quoted value does not end: ${text.slice(i)}`);
      word += JSON.parse(text.slice(i, end + 1));
      i = end + 1;
    }
    words.push(word);
  }
  return words;
}

// The line of an entry's header that records its invocation, or null. The
// header is the file's comment lines up to its first other line.
function recordedInvocationLine(text) {
  for (const raw of text.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line.trim() === '') continue;
    if (!line.startsWith('/*') || !line.endsWith('*/')) return null;
    if (line === `${RECORDED_INVOCATION_START} */` || (line.startsWith(`${RECORDED_INVOCATION_START} `) && line.endsWith(' */'))) return line;
  }
  return null;
}

// The options the invocation an entry records gives, every path resolved
// against `base` (the directory of the build config, or the working directory
// without one), or null when the entry records none or does not exist. The
// line's words are parsed by parseCommandArgv, as the command line is. Throws
// when the line does not parse, has a word generate-entry does not take, or
// writes another file than that entry.
function recordedEntryOptions(entryFile, base) {
  let text;
  try {
    text = fs.readFileSync(entryFile, 'utf8');
  } catch (_) {
    return null;
  }
  const line = recordedInvocationLine(text);
  if (line === null) return null;
  const recorded = line.slice(3, -3).trim();
  let options;
  try {
    const { argv } = parseCommandArgv(invocationWords(recorded).slice(1));
    const extra = [...argv._.map((word) => JSON.stringify(String(word))), ...['help', 'version'].filter((name) => argv[name]).map((name) => `--${name}`)];
    if (extra.length) throw new Error(`generate-entry does not take ${extra.join(', ')} there`);
    options = entryOptions(argv, base);
  } catch (err) {
    throw new Error(`its recorded invocation does not parse (${err.message}): ${recorded}`);
  }
  if (options.outFile !== path.resolve(entryFile)) {
    const baseRel = path.relative(process.cwd(), base) || '.';
    throw new Error(`its recorded invocation writes ${path.relative(process.cwd(), options.outFile)}, not this file: its paths are resolved against ${baseRel}, the directory of the build config (the working directory without one), so run generate-entry with its options from there: ${recorded}`);
  }
  return options;
}

// One generate-entry run's options, every path resolved against `base`: --src
// defaults to ./src, or to `base` itself when it has no src/; --out to
// uxdsl-entry.uxdsl in the --src directory; the theme file is written unless
// --no-theme is given.
function entryOptions(argv, base) {
  const srcArg = argv.src || (fs.existsSync(path.join(base, 'src')) ? './src' : '.');
  const srcDir = path.resolve(base, srcArg);
  const outArg = argv.out || argv.o;
  const outFile = outArg ? path.resolve(base, outArg) : path.join(srcDir, 'uxdsl-entry.uxdsl');
  const exclude = String(argv.exclude || '').split(',').map((s) => s.trim()).filter(Boolean);
  let first = null;
  if (argv.first !== undefined) {
    first = String(argv.first).split(',').map((s) => s.trim()).filter(Boolean);
    if (first.length === 0) throw new Error('--first needs at least one path (comma-separated, relative to --src).');
  }
  // minimist reads `--no-theme=<v>` as the key `no-theme`, not as theme
  // false: a value in either spelling is refused, never ignored.
  if (argv['no-theme'] !== undefined) {
    throw new Error(`--no-theme takes no value (got --no-theme=${argv['no-theme']}).`);
  }
  if (argv.theme !== undefined && typeof argv.theme !== 'boolean') {
    throw new Error(`--no-theme takes no value (got --theme=${argv.theme}).`);
  }
  return { base, srcArg, srcDir, outFile, exclude, first, theme: argv.theme !== false };
}

// The entry one run writes, as `{ outFile, content, count, theme }`, from what
// is on disk under --src; nothing is written here. The entry loads its theme
// file first (`theme` is that file's `{ file, content }`, or null with
// --no-theme), then lists every .uxdsl file found under --src except itself,
// its theme file and the files whose name --exclude gives. Every --first item
// is checked here, so a mistake writes nothing.
function planEntry(options) {
  const { srcArg, srcDir, outFile, exclude, first, theme } = options;
  const outputDir = path.dirname(outFile);
  // The theme file's path is generate-entry's, with or without --no-theme: it
  // is never listed, and a file there that generate-entry did not write is
  // refused.
  const themeFile = themeFileOf(outFile);
  assertThemeFileOwned(themeFile);
  const found = findFiles(srcDir, '.uxdsl').map((file) => {
    // The path relative to the entry as on disk, with `./`, a partial's
    // underscore and `.uxdsl`: the key of the entry's path order.
    let key = toPosixPath(path.relative(outputDir, file));
    if (!key.startsWith('.')) key = `./${key}`;
    const fromSrc = toPosixPath(path.relative(srcDir, file));
    // Sass's URL, relative to the entry: the extension written, so a .scss or
    // .sass file of the same name beside it is never the one loaded.
    const url = sassPathParts(key);
    return {
      key,
      fromSrc,
      url: encodeEntryUrl(`${url.dir}/${url.name}.uxdsl`),
      natural: entryNamespace(fromSrc),
      isEntry: path.resolve(file) === outFile,
      isTheme: path.resolve(file) === themeFile,
      excluded: exclude.includes(path.basename(file)),
    };
  });
  const listed = found.filter((file) => !file.isEntry && !file.isTheme && !file.excluded);
  const byKey = [...listed].sort((a, b) => a.key.localeCompare(b.key));

  // One namespace per file, whatever the order: in key order, the first file
  // keeps a name several files share, and each later one takes the smallest
  // `-<n>` (n >= 2) that is no file's own name and not already taken. The
  // theme file's namespace is taken before any file's, with or without
  // --no-theme, so a file's namespace does not change with it.
  const naturals = new Set([THEME_NAMESPACE, ...listed.map((file) => file.natural)]);
  const taken = new Set([THEME_NAMESPACE]);
  for (const file of byKey) {
    let name = file.natural;
    if (taken.has(name)) {
      let n = 2;
      while (naturals.has(`${file.natural}-${n}`) || taken.has(`${file.natural}-${n}`)) n += 1;
      name = `${file.natural}-${n}`;
    }
    taken.add(name);
    file.namespace = name;
  }

  // The files in path order (the key's), or, with --first, its files first in
  // the order given, then every other file in path order.
  let ordered = byKey;
  if (first) {
    const seen = new Set();
    const firsts = first.map((item) => {
      const wanted = firstItemPath(item);
      if (seen.has(wanted)) throw new Error(`--first lists "${item}" twice.`);
      seen.add(wanted);
      const match = listed.find((file) => file.fromSrc === wanted);
      if (match) return match;
      if (found.some((file) => file.isEntry && file.fromSrc === wanted)) {
        throw new Error(`--first "${item}" names the entry itself (${path.relative(process.cwd(), outFile)}), which never lists itself.`);
      }
      if (path.resolve(srcDir, wanted) === themeFile) {
        throw new Error(`--first "${item}" names the theme file generate-entry writes, which the entry always loads first.`);
      }
      if (found.some((file) => file.excluded && file.fromSrc === wanted)) {
        throw new Error(`--first "${item}" names a file --exclude leaves out.`);
      }
      const suggestion = closestMatch(wanted, listed.map((file) => file.fromSrc));
      throw new Error(`--first "${item}" matches no .uxdsl file under ${srcArg} (paths are relative to --src).${suggestion ? ` Did you mean "${suggestion}"?` : ''}`);
    });
    ordered = [...firsts, ...byKey.filter((file) => !firsts.includes(file))];
  }

  const content = [
    ...ENTRY_HEADER_START,
    invocationLine(options),
    ENTRY_HEADER_END,
    '',
    '/* --- Application & Component Imports --- */',
    ...(theme ? [`@use './${THEME_FILE_NAME}' as ${THEME_NAMESPACE};`] : []),
    ...ordered.map((file) => `@use '${file.url}' as ${file.namespace};`),
    '',
  ].join('\n');
  return { outFile, content, count: ordered.length + (theme ? 1 : 0), theme: theme ? { file: themeFile, content: THEME_FILE_CONTENT } : null };
}

// Writes one planned entry when its content changed (atomically, through
// commitFileIfChanged), its theme file first, and says which. An entry that
// listed its files with @import gave them one shared scope; with @use each is
// its own module: said once, when such an entry is replaced.
function writeEntry(plan) {
  const { outFile, content, count } = plan;
  if (plan.theme) {
    const themeRel = path.relative(process.cwd(), plan.theme.file);
    if (commitFileIfChanged(plan.theme.file, plan.theme.content) === 'unchanged') {
      console.log(`[uxdsl] Theme file at ${themeRel} is up to date (identical to the file on disk; not rewritten).`);
    } else {
      console.log(`[uxdsl] Generated theme file at ${themeRel}: \`@uxdsl theme;\`, loaded first by the entry.`);
    }
  }
  const previous = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : null;
  const outRel = path.relative(process.cwd(), outFile);
  const rules = `${count} @use rule${count === 1 ? '' : 's'}`;
  if (commitFileIfChanged(outFile, content) === 'unchanged') {
    console.log(`[uxdsl] Entry file at ${outRel} is up to date with ${rules} (identical to the file on disk; not rewritten).`);
    return;
  }
  console.log(`[uxdsl] Generated entry file at ${outRel} with ${rules}.`);
  if (previous !== null && /^\s*@import\b/m.test(previous)) {
    console.warn(`[uxdsl] Warning: ${outRel} listed its files with @import; it now loads each with @use, so each file is its own Sass module: a file that reads another file's $variable, mixin or placeholder now fails (UXD_SASS), and one that calls another file's @function (one named like a UXDSL function included) or relies on a value an earlier file set for a variable it declares !default compiles differently, without an error. Give each such file its own @use, with as * (for example @use './variables' as *;) or with each member written through the namespace, since under a namespaced @use a function called by its bare name also stays in the CSS without an error; see "Regenerate the entry" in the migration guide.`);
  }
}

// The entry files of a config, in config order: each entry of "builds", or the
// single entry.
function configEntryFiles(config) {
  const entries = config.builds && config.builds.length ? config.builds.map((b) => b.entry) : [config.entry];
  return [...new Set(entries.filter(Boolean).map((entry) => path.resolve(entry)))];
}

// The entries build compiles, found as build finds them, and the directory
// their recorded invocations resolve against: the build config's, or the
// working directory without one. Without a config and without
// src/uxdsl-entry.uxdsl there is no entry yet (generate-entry is what writes
// it), rather than build's "no entry" error.
async function configuredEntries(cwd) {
  if (!findConfigPath(cwd) && !fs.existsSync(path.resolve(cwd, DEFAULT_ENTRY_REL))) return { base: cwd, entries: [] };
  const config = await loadConfig({}, cwd);
  if (!config) return { base: cwd, entries: [] };
  return { base: config.configPath ? path.dirname(config.configPath) : cwd, entries: configEntryFiles(config) };
}

// Plans an entry from the invocation it records, `options`; a failure says
// it is the recorded invocation's.
function planRecordedEntry(options) {
  try {
    return planEntry(options);
  } catch (err) {
    throw new Error(`its recorded invocation fails: ${err.message}`);
  }
}

// The plans of those of `entries` whose header records an invocation, from
// that invocation, in order; nothing is written here. Throws, naming the
// entry, at the first that cannot be planned.
function planRecordedEntries(entries, base, cwd) {
  const plans = [];
  for (const entry of entries) {
    const rel = path.relative(cwd, entry);
    try {
      const options = recordedEntryOptions(entry, base);
      if (!options) continue;
      console.log(`[uxdsl] ${rel} records: ${invocationLine(options).slice(3, -3)}`);
      console.log(`[uxdsl] Scanning ${options.srcArg} for .uxdsl files...`);
      plans.push(planRecordedEntry(options));
    } catch (err) {
      throw new Error(`${rel}: ${err.message}`);
    }
  }
  return plans;
}

// With an option, one run with those options. With none (and no argument),
// every entry of the build config whose header records an invocation is
// written again from it, in config order, each checked before any is written.
// When no entry of the config records one, the file the defaults write is
// written again from the invocation its own header records, when it records
// one, and otherwise with the defaults.
async function generateEntry(argv) {
  const cwd = process.cwd();
  const bare = ['src', 'out', 'o', 'first', 'exclude', 'theme'].every((name) => argv[name] === undefined) && !(argv._ && argv._.length);
  if (bare) {
    const { base, entries } = await configuredEntries(cwd);
    let plans = planRecordedEntries(entries, base, cwd);
    if (!plans.length) plans = planRecordedEntries([entryOptions(argv, cwd).outFile], base, cwd);
    if (plans.length) {
      for (const plan of plans) writeEntry(plan);
      return;
    }
  }
  const options = entryOptions(argv, cwd);
  console.log(`[uxdsl] Scanning ${options.srcArg} for .uxdsl files...`);
  writeEntry(planEntry(options));
}

// --- Command: Init ---

// MIG-B7-12 (FEAT-009): the config `init` writes is type-checked by the
// editor, with nothing added at run time. Three details, each measured
// (see docs/features/FEAT-009/MIG-B7-12-*.md):
// - JSDoc only, no `require('uxdsl/config')`: nothing is loaded at build
//   time, so a project where `uxdsl` does not resolve from the config's
//   directory (a global or npx-run CLI) still builds; a type import there
//   only loses the type.
// - The annotation sits on a `const`, not on `module.exports = {…}`:
//   TypeScript checks nothing through the latter — not a typo, not even
//   `entry: 123`.
// - `// @ts-check`: editors do not check plain JavaScript by default
//   (VS Code's `checkJs` is off), so without it the type only completes.
// The object itself is unchanged, so the compiled CSS is byte-identical.
const CONFIG_TYPE_HEADER = `// @ts-check
// Checked by your editor against UXDSL's config type (a mistyped key such as
// "outfile" is flagged as you type). Type-only: nothing is loaded at build
// time. See "Editor support" in the uxdsl README.
/** @type {import('uxdsl/config').UxdslConfig} */
`;

// The last lines of both config templates: the `sass` key, commented out, so
// the exported object stays what it is without them.
const SASS_CONFIG_COMMENT = `  // Dart Sass options for every entry: the deprecations to silence (they are
  // printed as UXD_SASS_WARNING) and whether to silence those of packages.
  // sass: { silenceDeprecations: ['import'], quietDeps: true },
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
  // The generated entry writes its theme file next to it: a project file
  // already at that path is refused before anything is written, so a refusal
  // never leaves half a scaffold.
  const entryPath = path.join(srcDir, 'uxdsl-entry.uxdsl');
  if (!isMulti && !fs.existsSync(entryPath)) assertThemeFileOwned(themeFileOf(entryPath));

  // 1. Create uxdsl.config.cjs
  const configPath = path.join(cwd, 'uxdsl.config.cjs');
  if (!fs.existsSync(configPath)) {
    // No `breakpoints:` here: they are a theme family, declared in the
    // theme file — a build config that carries them is rejected.
    const configContent = CONFIG_TYPE_HEADER + (isMulti
      ? `const config = {
  // A theme entry (src/theme.uxdsl writes @uxdsl theme;, so it emits the
  // shared :root definitions once) plus any number of component/CSS-Module
  // entries — no marker, no :root of their own — compiled together from
  // this one config. Add more entries here as the project grows; see the
  // CLI README's "Multiple entries, one shared theme" section for the full
  // contract.
  builds: [
    { entry: './src/theme.uxdsl', outFile: './src/theme.css' },
    { entry: './src/panel-a.uxdsl', outFile: './src/panel-a.css' },
  ],
  // Watch patterns for HMR/Rebuilds
  watch: ['src/**/*.uxdsl'],
${SASS_CONFIG_COMMENT}};
`
      : `const config = {
  // Entry point for your styles (generated or manual)
  entry: './src/uxdsl-entry.uxdsl',
  // Output CSS file
  outFile: './src/uxdsl.css',
  // Watch patterns for HMR/Rebuilds
  watch: ['src/**/*.uxdsl', 'src/**/*.css'],
${SASS_CONFIG_COMMENT}};
`) + '\nmodule.exports = config;\n';
    fs.writeFileSync(configPath, configContent);
    console.log(`  -> Created uxdsl.config.cjs`);
  } else {
    console.log(`  -> uxdsl.config.cjs already exists.`);
  }

  // 2. Create initial entry file(s)
  if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir);

  // The file the user edits. The entry generate-entry writes is rewritten
  // every time it runs, so styles go here and the entry loads them with @use;
  // the file exists before generateEntry runs, so the first entry lists it.
  const stylesPath = path.join(srcDir, 'styles.uxdsl');
  if (!isMulti && !fs.existsSync(stylesPath)) {
    fs.writeFileSync(stylesPath, `/* Your styles. src/uxdsl-entry.uxdsl loads this file with @use; that entry is
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
      fs.writeFileSync(themeEntryPath, '/* Theme-only entry — no component rules here. Emits the shared\n * :root definitions every other entry in "builds" consumes. */\n@uxdsl theme;\n');
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
    if (!fs.existsSync(entryPath)) {
      // Run generate logic to create initial file
      await generateEntry({ src: './src', out: entryPath });
    }
  }

  // 3. Setup PostCSS (Required for Next.js, Optional/Good for Vite if not using plugin)
  // For Next.js, we must ensure uxdsl/postcss is in postcss.config.js.
  // A custom postcss.config.js REPLACES Next's default plugin list, so the
  // file written here names Next's own defaults first — the same modules
  // Next loads for its default config, with the same options (see
  // next/dist/build/webpack/config/blocks/css/plugins.js) — and only then
  // uxdsl/postcss. Without them a project silently lost autoprefixing.
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
    // The theme is emitted only where @uxdsl theme; is written: the
    // CLI-generated global CSS has it (src/uxdsl-theme.uxdsl), so a CSS
    // Module gets none. The project's uxdsl.theme.json (or
    // uxdsl.theme.js/.cjs), if any, is discovered automatically.
    'uxdsl/postcss': {},
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
  // One package: the only install line there is. Printed only when the
  // project does not list it yet (init run through npx before installing).
  let listsUxdsl = false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    listsUxdsl = Boolean((pkg.devDependencies && pkg.devDependencies.uxdsl) || (pkg.dependencies && pkg.dependencies.uxdsl));
  } catch (_) {}
  if (!listsUxdsl) console.log('Install it in this project: npm i -D uxdsl');
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
    console.log(`1. Edit src/styles.uxdsl. The entry src/uxdsl-entry.uxdsl is generated: the watch below regenerates it when a .uxdsl file is added or removed; without it, run "npx uxdsl generate-entry".`);
    console.log(`2. Build: ${addedScripts ? 'npm run uxdsl:build' : 'npx uxdsl build'}`);
    console.log(`   Watch:  ${addedScripts ? 'npm run uxdsl:watch' : 'npx uxdsl build --watch'}${isNext ? ' (alongside next dev)' : isVite ? ' (alongside vite)' : ''}`);
    console.log(`3. Import the generated CSS once, from your root layout or app entry (path relative to that file):`);
    console.log(`   import './${outFileRel}';`);
    if (isVite) {
      console.log("   For direct .uxdsl imports instead of a generated file, add uxdsl/vite to vite.config's plugins.");
    }
  }
  // MIG-B7-12 (FEAT-009): only what is true today — the extension ships as
  // a .vsix built from the repository, not from a marketplace (MIG-B7-05).
  console.log('\nEditor support: uxdsl.config.cjs is type-checked by your editor (// @ts-check).');
  console.log('For .uxdsl highlighting and completion (VS Code extension, installed from a .vsix)');
  console.log('and theme JSON completion ("$schema"), see "Editor support" in the uxdsl README.');
}

const KNOWN_COMMANDS = ['init', 'generate-entry', 'build', 'theme'];

// Every flag each command reads, as one registry: printHelp, the CLI guide
// and parseCommandArgv's validation below agree on exactly this list, so a
// new flag is added here once.
//
// `manual` lists flags declared in neither `boolean` nor `string`: minimist
// then applies its own inference (bare flag → `true`, `--no-x` → `false`,
// `--x=value` → the raw string `value`), and the flag's own resolver (e.g.
// `resolveSourceMap`) validates that raw value instead of trusting
// minimist's boolean coercion, which turns any unrecognized string into
// `true` (`--sourcemap=banana`). A `manual` flag still counts as known
// for unknown-flag detection; only its type declaration is left out.
//
// `removed` maps a flag that used to exist to what replaces it: in any form
// (`--x`, `--no-x`, `--x=<value>`) it is refused with that text, never read
// as an unknown option. The removal is the command's own: another command
// reports the same flag as unknown.
const COMMAND_FLAG_SPECS = {
  init: { boolean: ['multi'], string: [], manual: [], alias: {} },
  // A bare `--first` reads as `''`, which generate-entry refuses: the flag
  // needs at least one path.
  // `theme` is `manual`: minimist would default a declared boolean to false,
  // and a bare run (no option at all) has to stay distinguishable from
  // --no-theme.
  'generate-entry': { boolean: [], string: ['src', 'out', 'exclude', 'first'], manual: ['theme'], alias: { out: 'o' } },
  // `strict-theme` is `manual`, not `string`: a minimist `string`-typed flag
  // turns a bare flag (no `=value`) into `''` instead of `true`, and `''`
  // normalizes to "nothing here", so the bare flag would be ignored instead
  // of refused with the scoped form. `sourcemap` is `manual` for the same
  // reason: as a `string` flag, the bare `--sourcemap` would read as `''`
  // and lose the "bare flag means external" case.
  build: {
    boolean: ['watch'], string: ['entry', 'out', 'config'], manual: ['strict-theme', 'sourcemap'], alias: { watch: 'w', entry: 'e', out: 'o', config: 'c' },
    removed: {
      'include-theme': 'the theme is emitted only where `@uxdsl theme;` is written. Write it once, at the top level of the stylesheet that defines the tokens, and leave it out of component entries',
    },
  },
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
    const removed = cmd !== undefined && spec.removed
      ? unknownFlags.find((rawArg) => Object.prototype.hasOwnProperty.call(spec.removed, canonicalFlagName(rawArg)))
      : undefined;
    if (removed) throw new Error(`${removed.replace(/=.*$/, '')} was removed: ${spec.removed[canonicalFlagName(removed)]}.`);
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

// The first load and build of `uxdsl build`, with or without `--watch`.
// Without it, any failure propagates to main(), which prints it and exits 1.
// With it, a failure never ends the process before a file is watched: a
// config that fails to load prints `[uxdsl] Error: … — watching for a fix...`
// and returns `null`, so `startWatch` watches the config and theme candidates
// until one loads; a build that fails prints `[uxdsl] build failed: ` with the
// message and its frame, as every later failed build of the session does, and
// returns the config. A successful build's results go to `report.results`,
// from which `startWatch` seeds its dependency graph; with `--watch`, the
// session that counts the theme over every entry's last result goes to
// `report.session`, seeded by this first build.
async function loadAndBuildForWatch(argv, watching, report) {
  const session = { themeStates: new Map(), themeWarning: null };
  if (report && watching) report.session = session;
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
    const results = await buildOnce(config, undefined, watching ? session : undefined);
    if (report) report.results = results;
  } catch (err) {
    if (!watching) throw err;
    printFailure('[uxdsl] build failed: ', err);
  }
  return config;
}

// Sets `process.exitCode` and returns, never `process.exit()`: a write to a
// pipe is asynchronous, so exiting at once discards whatever is still
// buffered (`uxdsl theme --contrast | jq` would read JSON cut at 64 KiB).
// Node exits once stdout has drained, with the same status. Watch mode keeps
// the process alive through its own handles.
//
// A failure prints `[uxdsl] Error: ` with the message, then its frame
// (errorFrame), and exits 1.
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
          const report = {};
          const config = await loadAndBuildForWatch(argv, watching, report);
          if (!config && !watching) {
            throw new Error('Nothing to build: no uxdsl.config.cjs, no theme file and no --entry/--out. Run "npx uxdsl init" to set a project up, or pass --entry <file> --out <file>.');
          }
          if (watching) {
            startWatch(config, argv, process.cwd(), buildOnce, report.results, report.session);
          }
        }
        break;
      case 'theme':
        await themeCommand(argv);
        break;
    }
  } catch (err) {
    printFailure('[uxdsl] Error: ', err);
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
  watchSelection,
  createWatcher,
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
  themeEmissionMessage,
};
