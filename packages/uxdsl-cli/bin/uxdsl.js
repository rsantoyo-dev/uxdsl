#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const chokidar = require('chokidar');
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

const uxdslPlugin = loadUxDslPlugin();
const uxdslRuntime = loadUxDslRuntime() || {};
const uxdslCore = loadUxDslCore();

const FALLBACK_BREAKPOINTS = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

const DEFAULT_BREAKPOINTS = uxdslRuntime.DEFAULT_BREAKPOINTS
  ? { ...uxdslRuntime.DEFAULT_BREAKPOINTS }
  : { ...FALLBACK_BREAKPOINTS };

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

const CONFIG_CANDIDATES = [
  'uxdsl.config.cjs',
  'uxdsl.config.js',
  'uxdsl.config.json',
];

// MIG-B2-01: build config (entry/outFile/watch/references) and theme
// (tokens + the theme's own `references`) are discovered separately, so a
// project can add `uxdsl.theme.config.cjs` without touching
// `uxdsl.config.cjs` at all.
const THEME_CANDIDATES = [
  'uxdsl.theme.config.cjs',
  'uxdsl.theme.config.js',
  'uxdsl.theme.config.json',
  'uxdsl.theme.json',
];

const DEFAULT_ENTRY_REL = path.join('src', 'uxdsl-entry.uxdsl');
const DEFAULT_OUT_REL = path.join('src', 'uxdsl.css');

function printHelp() {
  console.log(`Usage: uxdsl <command> [options]

Commands:
  init              First-run setup: creates uxdsl.config.cjs, src/uxdsl-entry.uxdsl
                    and (Next.js) postcss.config.js if they don't exist yet.
                    Never overwrites an existing file. Run this once per project.
                    --multi: scaffold a theme entry + one example
                    component entry (a "builds" array) instead — for a
                    project that starts with a theme + several CSS-Module
                    panels, so it doesn't need to be hand-written from
                    the README.
  generate-entry    Run after adding or removing .uxdsl files.
                    Re-scan a source directory and rewrite the entry file's
                    @import list to match every .uxdsl file found.
  build             Compile the entry file (from uxdsl.config.cjs, --config,
                    or --entry/--out) into a single CSS file, once.
  watch             Same as "build", then keep rebuilding as files change.
  theme             Print the resolved effective theme as JSON — same
                    discovery and resolution as "build", no CSS written.

Theme Options (theme command only):
  --diff            Print only the theme families your own config/theme
                    file mentions, one row per leaf value, each labeled
                    "project" (your value) or "default" (silently
                    inherited from DEFAULT_THEME) instead of the full tree.
  --strict          Exit non-zero if any family you declared ended up
                    partially filled from defaults. Combine with --diff to
                    see exactly which leaves triggered it.
                    --strict=<family1>,<family2> scopes the check to only
                    those families — see --strict-theme's own note under
                    build/watch above for why this is usually what you want.

Build/Watch Options:
  --entry, -e       Entry .uxdsl file that contains @import statements
  --out, -o         Output CSS file path
  --config, -c      Path to the build config file (default: discovers
                    uxdsl.config.cjs/.js/.json in the current directory).
                    A theme file (uxdsl.theme.config.cjs/.js/.json, or
                    uxdsl.theme.json) is discovered the same way, next to
                    whichever build config was used — see that package's
                    README for the full contract.
  --watch, -w       (Build only) Rebuild on file changes
  --include-theme, --no-include-theme
                    Emit (or skip) the global :root token definitions.
                    Defaults to true. Pass --no-include-theme for a
                    component/CSS-Module entry that only consumes tokens
                    a separate includeTheme entry already defines — see
                    postcss-uxdsl's includeTheme option. Overrides
                    "includeTheme" in uxdsl.config.cjs when passed.
  --strict-theme, --no-strict-theme
                    Fail the build (before writing anything) if a theme
                    family you declared ended up partially filled from
                    DEFAULT_THEME. Defaults to false — an existing
                    project never starts failing builds it didn't ask to
                    be stricter about. Same check as "uxdsl theme
                    --strict", reachable from build/watch directly.
                    Overrides "strictTheme" in uxdsl.config.cjs when
                    passed.
                    --strict-theme=<family1>,<family2> checks only the
                    named families instead of every family you declared.
                    Recommended over the bare flag for most projects: a
                    family like typography_details documents per-key
                    partial override as the intended pattern, so checking
                    "every touched family" tends to fail on exactly the
                    usage the library recommends. Scope it to the
                    families you actually want fully specified (e.g.
                    palette, breakpoints).

Generate Entry Options:
  --src             Source directory to scan (default: ./src)
  --out, -o         Output file path (default: ./src/uxdsl-entry.uxdsl)
  --exclude         Comma-separated list of files to exclude

Examples:
  uxdsl init
  uxdsl init --multi
  uxdsl build
  uxdsl build --entry src/main.uxdsl --out dist/styles.css
  uxdsl generate-entry --src ./src --out ./src/app/uxdsl-entry.uxdsl
  uxdsl theme --diff --strict
  uxdsl build --strict-theme

Set UXDSL_DEBUG=1 to log which config/theme files were discovered.

An unrecognized flag, or a real flag used on the wrong command, fails
immediately with a suggestion (e.g. "Did you mean --strict-theme?")
instead of being silently ignored. See the CLI README's "Strict flag
parsing" section for the full accepted-value table.
`);
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

function findThemeConfigPath(dir) {
  for (const candidate of THEME_CANDIDATES) {
    const full = path.resolve(dir, candidate);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

/** Same CommonJS/`default`-interop/async-function contract as the build
 * config, applied to any config-shaped file. */
async function loadModuleExport(filePath) {
  let mod = require(filePath);
  if (mod && typeof mod === 'object' && 'default' in mod) mod = mod.default;
  if (typeof mod === 'function') mod = await mod();
  return mod;
}

/** `uxdsl.theme.config.*`'s export is either `{ theme, references }`
 * (recommended when there are external variables) or a bare theme object —
 * distinguished by the presence of a `theme` or `references` key, not by
 * guessing at the shape of theme data itself. Never lets a `references` key
 * leak into the object that becomes `theme` (and, from there, generated
 * CSS): a plain theme object legitimately could have a key literally named
 * "theme" or "references" as a token family, but that's exactly the
 * ambiguity this contract accepts as the tradeoff for two vs. three files. */
function normalizeThemeExport(themeModule) {
  if (
    themeModule && typeof themeModule === 'object' && !Array.isArray(themeModule) &&
    (Object.prototype.hasOwnProperty.call(themeModule, 'theme') || Object.prototype.hasOwnProperty.call(themeModule, 'references'))
  ) {
    return { theme: themeModule.theme, references: themeModule.references };
  }
  return { theme: themeModule, references: undefined };
}

// MIG-B3-03 (FEAT-004): keys that only make sense on a build config
// (uxdsl.config.cjs), never on theme data. Used only as a heuristic for the
// warning below — not an exhaustive/validated list, since a real theme
// family could coincidentally use one of these names.
const BUILD_CONFIG_SHAPED_KEYS = ['entry', 'outFile', 'output', 'watch', 'themeFile', 'plugins', 'builds'];

/** A theme file with no `theme`/`references` key has its entire export
 * treated as theme data (see normalizeThemeExport's own doc) — so a
 * uxdsl.config.cjs accidentally renamed/copied to a theme-file name
 * silently "works" (no throw anywhere), with its entry/outFile/watch keys
 * quietly ignored as unknown theme tokens. This is a warning, not an
 * error: a project could legitimately have a token family literally named
 * "watch" or "plugins", and warning-then-continuing costs nothing there. */
// MIG-B3-03 item 3: `loadThemeConfig` re-runs on every rebuild in watch
// mode — without dedup this warning would repeat on every keystroke.
// Keyed by path so an unrelated project (or a second theme file) still
// gets its own warning, and cleared/replaced when the shape actually
// changes so a later-introduced or later-fixed collision is still caught.
const warnedBuildConfigShapes = new Map();

function warnIfLooksLikeBuildConfig(themeModule, themeConfigPath) {
  if (
    Object.prototype.hasOwnProperty.call(themeModule, 'theme') ||
    Object.prototype.hasOwnProperty.call(themeModule, 'references')
  ) {
    warnedBuildConfigShapes.delete(themeConfigPath); // Fixed since a previous warning, if any.
    return; // Unambiguous shape (the { theme, references } form) — nothing to warn about.
  }
  const suspects = BUILD_CONFIG_SHAPED_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(themeModule, key)
  );
  if (suspects.length === 0) {
    warnedBuildConfigShapes.delete(themeConfigPath);
    return;
  }
  const signature = suspects.join(',');
  if (warnedBuildConfigShapes.get(themeConfigPath) === signature) return; // Same shape already warned this session.
  warnedBuildConfigShapes.set(themeConfigPath, signature);
  const keyList = suspects.map((k) => `"${k}"`).join(', ');
  console.warn(
    `[uxdsl] Warning: ${themeConfigPath} looks like a build config (found ${keyList}), but has no ` +
    '"theme" or "references" key, so it is being treated entirely as theme data — ' +
    `${suspects.length > 1 ? 'those keys are' : 'that key is'} silently ignored as unknown tokens. ` +
    'If this is really a theme file, wrap your data as { theme: { ... } }. ' +
    'If it is a build config, rename it away from uxdsl.theme.config.*/uxdsl.theme.json.'
  );
}

async function loadThemeConfig(themeConfigPath) {
  const themeModule = await loadModuleExport(themeConfigPath);
  if (!themeModule || typeof themeModule !== 'object') {
    throw new Error(`Invalid theme configuration export in ${themeConfigPath}`);
  }
  warnIfLooksLikeBuildConfig(themeModule, themeConfigPath);
  return normalizeThemeExport(themeModule);
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

async function loadConfig(argv, cwd = process.cwd()) {
  const directEntry = argv.entry || argv.e;
  const directOut = argv.out || argv.o;
  const configPathArg = argv.config || argv.c;
  const debug = !!process.env.UXDSL_DEBUG;
  let resolvedConfig = {};
  let configPath = null;
  let configModule = null;

  // Raw, unresolved values tracked across every branch below and combined
  // into `resolvedConfig.breakpoints`/`includeTheme`/`strictTheme` in one
  // place, once the theme (and thus `theme.breakpoints`) is known — see
  // resolveBreakpoints/resolveIncludeTheme/resolveStrictTheme above for
  // why this can't happen eagerly per-branch.
  let rawBreakpoints;
  let rawIncludeTheme;
  let rawStrictTheme;

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
    } else {
      configPath = findConfigPath(cwd);
    }
    if (configPath) {
      configModule = await loadModuleExport(configPath);
      if (!configModule || typeof configModule !== 'object') {
        throw new Error(`Invalid configuration export in ${configPath}: expected an object (or a function/promise resolving to one).`);
      }
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
      // MIG-B4-01 (FEAT-005): shared across every entry (single or
      // `builds`) — the theme is one thing per build, so this is
      // validated once here regardless of which branch below runs.
      // MIG-B5-01 (FEAT-006): also accepts an array of family names —
      // see resolveStrictTheme/normalizeStrictThemeScope for why `true`
      // (check every touched family) isn't the only meaningful value.
      if (
        configModule.strictTheme !== undefined &&
        typeof configModule.strictTheme !== 'boolean' &&
        !(Array.isArray(configModule.strictTheme) && configModule.strictTheme.every((f) => typeof f === 'string'))
      ) {
        throw new Error(`Invalid configuration in ${configPath}: "strictTheme" must be a boolean or an array of family names.`);
      }
      rawStrictTheme = configModule.strictTheme;
      const baseDir = path.dirname(configPath);

      // MIG-B3-02: "builds" is mutually exclusive with top-level entry/
      // outFile/includeTheme — a project declares either one entry inline
      // or a list of them, never both, so there's exactly one place to look
      // for "what does this build actually compile".
      if (configModule.builds !== undefined) {
        if (!Array.isArray(configModule.builds) || configModule.builds.length === 0) {
          throw new Error(`Invalid configuration in ${configPath}: "builds" must be a non-empty array of { entry, outFile } objects.`);
        }
        if (configModule.entry !== undefined || configModule.outFile !== undefined || configModule.output !== undefined) {
          throw new Error(`Invalid configuration in ${configPath}: "builds" cannot be combined with a top-level "entry"/"outFile" — declare every entry inside "builds" instead.`);
        }
        resolvedConfig.builds = configModule.builds.map((buildEntry, index) => {
          if (!buildEntry || typeof buildEntry !== 'object') {
            throw new Error(`Invalid configuration in ${configPath}: "builds[${index}]" must be an object.`);
          }
          if (typeof buildEntry.entry !== 'string') {
            throw new Error(`Invalid configuration in ${configPath}: "builds[${index}].entry" must be a string path.`);
          }
          if (typeof buildEntry.outFile !== 'string' && typeof buildEntry.output !== 'string') {
            throw new Error(`Invalid configuration in ${configPath}: "builds[${index}].outFile" must be a string path.`);
          }
          if (buildEntry.includeTheme !== undefined && typeof buildEntry.includeTheme !== 'boolean') {
            throw new Error(`Invalid configuration in ${configPath}: "builds[${index}].includeTheme" must be a boolean.`);
          }
          return {
            entry: resolvePath(buildEntry.entry, baseDir),
            outFile: resolvePath(buildEntry.outFile || buildEntry.output, baseDir),
            // Resolved to a definite boolean below, alongside the
            // single-entry case — see the `--include-theme` precedence
            // comment near the end of this function.
            includeTheme: buildEntry.includeTheme,
          };
        });
      } else {
        resolvedConfig.entry = resolvePath(configModule.entry, baseDir);
        resolvedConfig.outFile = resolvePath(configModule.outFile || configModule.output, baseDir);
        rawIncludeTheme = configModule.includeTheme;
      }
      rawBreakpoints = configModule.breakpoints;
      resolvedConfig.watch = configModule.watch || [];
      resolvedConfig.theme = configModule.theme;
      resolvedConfig.references = configModule.references;
    }
  }

  // --- MIG-B2-01: theme file discovery, resolved relative to whichever
  // file declares it (the build config's directory when one was found,
  // the theme file's own directory otherwise), never the CLI package's. ---
  const themeSearchDir = configPath ? path.dirname(configPath) : cwd;
  let themeConfigPath = null;
  if (configModule && configModule.themeFile) {
    // `themeFile` wins over the conventional name and is resolved relative
    // to the build config that declared it.
    themeConfigPath = resolvePath(configModule.themeFile, themeSearchDir);
    if (!fs.existsSync(themeConfigPath)) {
      throw new Error(`themeFile not found: ${themeConfigPath}`);
    }
  } else if (!configModule || resolvedConfig.theme === undefined) {
    // Only look for a conventional theme file when the build config didn't
    // already declare `theme` inline — same "complete precedence" rule
    // item 6 states for `references`, applied symmetrically to `theme` so
    // there is one predictable rule instead of two.
    themeConfigPath = findThemeConfigPath(themeSearchDir);
  }

  if (themeConfigPath) {
    const { theme: fileTheme, references: fileReferences } = await loadThemeConfig(themeConfigPath);
    if (resolvedConfig.theme === undefined) resolvedConfig.theme = fileTheme;
    // Build config's `references` has complete precedence over the theme
    // file's — never merged, matching item 6 exactly.
    if (resolvedConfig.references === undefined) resolvedConfig.references = fileReferences;
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

  // MIG-B3-01: resolved once the theme is known, not eagerly per-branch
  // above — see resolveBreakpoints/resolveIncludeTheme for why order
  // matters here. A `--include-theme`/`--no-include-theme` flag always
  // wins over the build config's own `includeTheme` — for `builds`, that
  // means the flag overrides every entry uniformly; each entry's own
  // `includeTheme` is only consulted when the flag is absent.
  resolvedConfig.breakpoints = resolveBreakpoints(rawBreakpoints, resolvedConfig.theme && resolvedConfig.theme.breakpoints);
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
    // file is: so `uxdsl watch` picks up an edit without the user having
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

// MIG-B3-01 (FEAT-004): `--include-theme`/config `includeTheme` and
// `--config`'s/theme's `breakpoints` both need one resolution point,
// applied after the theme is known, instead of being resolved eagerly
// inside `loadConfig`'s three separate "found a config" branches — that
// eager resolution is exactly why `theme.breakpoints` (already supported
// and validated by the plugin) was permanently shadowed by
// `config.breakpoints || DEFAULT_BREAKPOINTS`: the fallback ran before
// there was ever a theme to consult.
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
// MIG-B6-22 (FEAT-008): a bare `--strict-theme`/`--strict` (no declared
// minimist type — see main()) already arrives here as the real boolean
// `true`, and `--no-strict-theme`/`--no-strict` as `false`; those are
// unaffected by this function. What minimist cannot know on its own is that
// `--strict-theme=true`/`=false` should mean the same thing as the bare
// boolean forms — undeclared, `=value` always arrives as a string, so
// those two literal strings used to fall into the CSV branch below and be
// misread as a family named "true"/"false" (a silent no-op gate: "true"
// never matches a real family, so nothing is ever flagged incomplete).
// Matched by exact, case-insensitive value — "True,false" is a two-element
// family list, not a mix of booleans, since a real family name can't
// contain a comma anyway and this keeps the special case narrow.
//
// `knownFamilies` (MIG-B6-01's `KNOWN_THEME_FAMILIES`) is optional so the
// large existing pure-parsing test suite for this function keeps working
// unchanged when it isn't passed; passing it validates every family name
// and throws with an edit-distance suggestion for a typo (e.g. "pallete"),
// describing where the value came from via `source` ("--strict-theme",
// "--strict", or "strictTheme (in the config file)") so the message names
// what was actually used, not just a fixed flag name.
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
function normalizeStrictThemeScope(value, { knownFamilies, requireKnownFamilies = false, source = '--strict-theme' } = {}) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;

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
    const trimmedLower = value.trim().toLowerCase();
    if (trimmedLower === 'true') return true;
    if (trimmedLower === 'false') return false;
    return toValidatedFamilyList(value.split(','), () => JSON.stringify(value));
  }
  // Reachable when minimist auto-parses an undeclared flag's numeric-looking
  // value into a real number (`--strict-theme=5`) — not a documented form.
  throw new Error(`Invalid value for ${source}: ${JSON.stringify(value)}. Expected true, false, or a comma-separated list of family names.`);
}

function resolveStrictTheme(flagValue, configValue, { knownFamilies, requireKnownFamilies } = {}) {
  const flag = normalizeStrictThemeScope(flagValue, { knownFamilies, requireKnownFamilies, source: '--strict-theme' });
  if (flag !== undefined) return flag;
  const config = normalizeStrictThemeScope(configValue, { knownFamilies, requireKnownFamilies, source: 'strictTheme (in the config file)' });
  if (config !== undefined) return config;
  return false;
}

// Config-level breakpoints and theme-level breakpoints both merge onto
// DEFAULT_BREAKPOINTS (config wins key-for-key on collision), mirroring
// the partial-merge semantics beta.2 already established for the theme
// itself — a project can override just `xl` without repeating `xs`/`sm`/
// `md`/`lg`. `normalizeBpMap` already accepts every BreakpointSpec shape
// (map, array of pairs, array of {name,min|px}), so both inputs reuse it.
function resolveBreakpoints(configBreakpoints, themeBreakpoints) {
  const merged = { ...DEFAULT_BREAKPOINTS };
  if (themeBreakpoints !== undefined) Object.assign(merged, normalizeBpMap(themeBreakpoints));
  if (configBreakpoints !== undefined) Object.assign(merged, normalizeBpMap(configBreakpoints));
  return merged;
}

function normalizeBpMap(input) {
  if (!input) return { ...DEFAULT_BREAKPOINTS };
  if (Array.isArray(input)) {
    const map = {};
    input.forEach((it) => {
      if (Array.isArray(it)) {
        map[String(it[0])] = Number(it[1]);
      } else if (it && typeof it === 'object') {
        const name = String(it.name || '').trim();
        const px = Number(it.min ?? it.px);
        if (name && !Number.isNaN(px)) map[name] = px;
      }
    });
    return map;
  }
  const map = {};
  Object.keys(input || {}).forEach((k) => {
    const v = input[k];
    if (typeof v === 'number' && !Number.isNaN(v)) map[k] = v;
  });
  return map;
}

// Compiles one { entry, outFile, includeTheme } pair against the theme/
// references/breakpoints every entry in a build shares. Returns the CSS to
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
  const { css: finalCss } = await uxdslCore.compile(
    { entry: entryConfig.entry },
    {
      breakpoints: sharedConfig.breakpoints || DEFAULT_BREAKPOINTS,
      theme: sharedConfig.theme,
      references: sharedConfig.references,
      includeTheme,
      to: entryConfig.outFile,
    }
  );

  return { outFile: entryConfig.outFile, finalCss };
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
  if (theme === undefined || typeof uxdslRuntime.validateAndNormalizeTheme !== 'function') return;
  let warnings;
  try {
    ({ warnings } = uxdslRuntime.validateAndNormalizeTheme(theme));
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
  const themeFile = config.themeConfigPath || (config.theme !== undefined ? config.configPath : null);
  if (!themeFile) return err;
  err.themeFile = themeFile;
  err.message = `${path.relative(process.cwd(), themeFile)}: ${err.message}`;
  return err;
}

function formatCliDiagnostic(message) {
  const cwdPrefix = `${process.cwd()}${path.sep}`;
  return String(message).split('\n').map(line => line.split(cwdPrefix).join('')).join('\n');
}

// MIG-B3-02 (FEAT-004): `config.builds` (an array of { entry, outFile,
// includeTheme }) compiles several entries against the one shared theme/
// references/breakpoints in a single `uxdsl build`/`watch` invocation,
// instead of running the CLI once per entry. Single-entry configs
// (config.builds absent) take the exact same path they always did —
// entries becomes a one-element array built from config.entry/outFile/
// includeTheme, so this refactor changes nothing observable for them.
async function buildOnce(config) {
  // MIG-B4-01 (FEAT-005): fails fast, before compiling or writing
  // anything, if the project explicitly declared a theme family that
  // ended up partially filled from DEFAULT_THEME — the same question
  // `uxdsl theme --strict` already answers (MIG-B3-04), now reachable
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
      const scopeNote = Array.isArray(config.strictTheme) ? ` (scoped to: ${config.strictTheme.join(', ')})` : '';
      throw new Error(
        `--strict-theme${scopeNote}: the following theme families you declared are partially filled from defaults: ${incomplete.join(', ')}. ` +
        'Provide every key of these families explicitly, or drop --strict-theme/strictTheme if inheriting some of them is intentional.'
      );
    }
  }

  // MIG-B5-02 (FEAT-006): `validateAndNormalizeTheme`'s "Unknown theme
  // family" warning (MIG-B3-03) was never actually reachable from a real
  // build — only the playground's theme editor called this function at
  // all. Surfacing just `/^Unknown /`-prefixed warnings here (not the
  // others `validateAndNormalizeTheme` can produce, e.g. color-format
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

  const compiled = [];
  for (let i = 0; i < entries.length; i++) {
    try {
      compiled.push(await compileEntryToCss(entries[i], config || {}));
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

  // Every entry is compiled before anything is written — item 4: a failure
  // in entry 3 of 5 must not leave entries 1-2 written and 3-5 missing.
  for (const { outFile, finalCss } of compiled) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, finalCss, 'utf8');
    console.log(
      `[uxdsl] built ${path.relative(process.cwd(), outFile)} (${finalCss.length} bytes)`
    );
  }
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
function diffThemeAgainstDefaults(rawTheme, effectiveTheme) {
  const touchedFamilies = isPlainThemeObject(rawTheme) ? Object.keys(rawTheme) : [];
  const rows = [];
  for (const family of touchedFamilies) {
    rows.push(...diffThemeSubtree(rawTheme[family], effectiveTheme[family], [family]));
  }
  return rows;
}

// --strict's question is narrower than the diff itself: not "what's mine",
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
  const touchedFamilies = isPlainThemeObject(rawTheme) ? Object.keys(rawTheme) : [];
  const candidates = Array.isArray(scope)
    ? touchedFamilies.filter((family) => scope.includes(family))
    : touchedFamilies;
  return candidates.filter((family) => {
    const rows = diffThemeSubtree(rawTheme[family], effectiveTheme[family], [family]);
    return rows.some((row) => row.source === 'default');
  });
}

async function themeCommand(argv, cwd = process.cwd()) {
  if (typeof uxdslRuntime.resolveTheme !== 'function') {
    throw new Error('postcss-uxdsl/ds-runtime not found (or too old to export resolveTheme). Install a current postcss-uxdsl in your project or alongside the CLI.');
  }
  const config = await loadConfig(argv, cwd);
  // No build config/theme file/direct args at all is not an error here —
  // it just means "what would a zero-config build use", i.e. DEFAULT_THEME.
  const rawTheme = config ? config.theme : undefined;
  const effectiveTheme = uxdslRuntime.resolveTheme(rawTheme);

  const output = argv.diff ? diffThemeAgainstDefaults(rawTheme, effectiveTheme) : effectiveTheme;
  // Always valid, parseable JSON on stdout — no log lines mixed in — so
  // `uxdsl theme` composes with `| jq`/scripts. (UXDSL_DEBUG=1 still prints
  // its own discovery lines, same as `build`; the two are not meant to be
  // combined when a script needs clean JSON.)
  console.log(JSON.stringify(output, null, 2));

  // MIG-B5-01 (FEAT-006): same scoping as `build --strict-theme` — bare
  // `--strict` still means "every touched family" (unchanged);
  // `--strict=palette,breakpoints` checks only those.
  const strictScope = normalizeStrictThemeScope(argv.strict, { knownFamilies: getKnownThemeFamilies(), requireKnownFamilies: true, source: '--strict' });
  if (strictScope) {
    const incomplete = findPartiallyDefaultedFamilies(rawTheme, effectiveTheme, strictScope);
    if (incomplete.length > 0) {
      const scopeNote = Array.isArray(strictScope) ? ` (scoped to: ${strictScope.join(', ')})` : '';
      throw new Error(
        `--strict${scopeNote}: the following theme families you declared are partially filled from defaults: ${incomplete.join(', ')}. ` +
        'Provide every key of these families explicitly, or drop --strict if inheriting some of them is intentional.'
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
 * `require.cache` already holds the full tree by then. */
function collectLocalRequireTree(filePath) {
  const ids = new Set();
  let resolved;
  try {
    resolved = require.resolve(filePath);
  } catch (_) {
    return ids; // Not required yet (or already gone) — nothing to report.
  }
  const visit = (id) => {
    if (ids.has(id)) return;
    ids.add(id);
    const mod = require.cache[id];
    if (!mod) return;
    for (const child of mod.children || []) {
      if (child.id && !child.id.split(path.sep).includes('node_modules')) {
        visit(child.id);
      }
    }
  };
  visit(resolved);
  return ids;
}

function clearRequireCache(filePath) {
  if (!filePath) return;
  for (const id of collectLocalRequireTree(filePath)) delete require.cache[id];
}

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

function startWatch(initialConfig, argv, cwd, builder) {
  let config = initialConfig;
  let watcher = chokidar.watch(config.watch, { ignoreInitial: true });
  console.log('[uxdsl] watching for changes...');
  let building = false;
  let queued = false;

  const trigger = async () => {
    if (building) {
      queued = true;
      return;
    }
    building = true;
    try {
      // The changed file could be uxdsl.config.cjs or the theme file
      // itself — reload both from disk (past their require() cache)
      // before building, instead of reusing whatever was resolved when
      // watch mode started or after the previous change.
      clearRequireCache(config.configPath);
      clearRequireCache(config.themeConfigPath);
      const reloaded = await loadConfig(argv, cwd);
      if (reloaded) {
        const previous = [...config.watch].sort();
        const next = [...reloaded.watch].sort();
        config = reloaded;
        if (JSON.stringify(previous) !== JSON.stringify(next)) {
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
      }
      await builder(config);
    } catch (err) {
      console.error('[uxdsl] build failed:', err.message);
    } finally {
      building = false;
      if (queued) {
        queued = false;
        trigger();
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
    if (filePath && isOwnOutputFile(config, filePath)) {
      return;
    }
    const rel = path.relative(process.cwd(), filePath);
    console.log(`[uxdsl] ${event} ${rel}`);
    trigger();
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
    const defaultBpJson = JSON.stringify(DEFAULT_BREAKPOINTS);
    const configContent = isMulti
      ? `module.exports = {
  // A theme entry (emits the shared :root definitions once) plus any
  // number of component/CSS-Module entries — includeTheme: false, no
  // :root of their own — compiled together from this one config. Add
  // more entries here as the project grows; see the CLI README's
  // "Multiple entries, one shared theme" section for the full contract.
  builds: [
    { entry: './src/theme.uxdsl', outFile: './src/theme.css' },
    { entry: './src/panel-a.uxdsl', outFile: './src/panel-a.css', includeTheme: false },
  ],
  // Default breakpoints
  breakpoints: ${defaultBpJson},
  // Watch patterns for HMR/Rebuilds
  watch: ['src/**/*.uxdsl']
};
`
      : `module.exports = {
  // Entry point for your styles (generated or manual)
  entry: './src/uxdsl-entry.uxdsl',
  // Output CSS file
  outFile: './src/uxdsl.css',
  // Default breakpoints
  breakpoints: ${defaultBpJson},
  // Watch patterns for HMR/Rebuilds
  watch: ['src/**/*.uxdsl', 'src/**/*.css']
};
`;
    fs.writeFileSync(configPath, configContent);
    console.log(`  -> Created uxdsl.config.cjs`);
  } else {
    console.log(`  -> uxdsl.config.cjs already exists.`);
  }

  // 2. Create initial entry file(s)
  if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir);

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
  // For Next.js, we must ensure postcss-uxdsl is in postcss.config.js
  const POSTCSS_SNIPPET = `module.exports = {
  plugins: {
    // The CLI-generated global CSS already contains the theme.
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
    console.log(`1. Import the generated CSS (once you run a build) — e.g.:`);
    console.log(`   import './${outFileRel}';`);
    console.log(`2. Build: ${addedScripts ? 'npm run uxdsl:build' : 'npx uxdsl build'}`);
    console.log(`   Watch:  ${addedScripts ? 'npm run uxdsl:watch' : 'npx uxdsl build --watch'}`);
    if (isNext) {
      console.log('3. Next.js: import "../uxdsl.css" from src/app/layout.tsx. Run uxdsl:watch alongside next dev to rebuild this generated file.');
    } else if (isVite) {
      console.log('3. Vite: import the generated CSS and run uxdsl:watch alongside vite. For direct .uxdsl imports, use vite-plugin-uxdsl instead of the generated-CSS workflow.');
    }
    console.log('\nTry adding a file named "src/components/Button.uxdsl" and run:');
    console.log('  npx uxdsl generate-entry');
  }
}

const KNOWN_COMMANDS = ['init', 'generate-entry', 'build', 'watch', 'theme'];

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
  // `strict-theme`/`strict` are deliberately `manual`, not `string`: a
  // minimist `string`-typed flag turns a BARE flag (no `=value`) into `''`
  // instead of `true` — which silently disabled the bare `--strict-theme`/
  // `--strict` control case entirely (caught by the manual repro in this
  // story's test file, not by any prior automated test) since `''`
  // normalizes to "no families", not "check everything".
  build: { boolean: ['watch'], string: ['entry', 'out', 'config'], manual: ['include-theme', 'strict-theme'], alias: { watch: 'w', entry: 'e', out: 'o', config: 'c' } },
  watch: { boolean: [], string: ['entry', 'out', 'config'], manual: ['include-theme', 'strict-theme'], alias: { entry: 'e', out: 'o', config: 'c' } },
  theme: { boolean: ['diff'], string: ['entry', 'out', 'config'], manual: ['strict'], alias: { entry: 'e', out: 'o', config: 'c' } },
};

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
  // An unrecognized command still needs *some* spec to parse its flags
  // with — "build" (also the default-command spec) is as good as any,
  // since main()'s switch reports "Unknown command" for it regardless and
  // that flag-validation result is discarded below.
  const spec = COMMAND_FLAG_SPECS[cmd] || COMMAND_FLAG_SPECS.build;
  const boolean = ['help', ...spec.boolean];
  const string = [...spec.string];
  const alias = { help: 'h', ...spec.alias };
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

  // A command that isn't one of the five real ones gets its own clear
  // "Unknown command" error from main()'s switch statement — reporting
  // every one of its flags as "unknown option" too would only bury that
  // message under noise for a typo'd command name.
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

async function main() {
  let cmd, argv;
  try {
    ({ cmd, argv } = parseCommandArgv(process.argv.slice(2)));
  } catch (err) {
    console.error(`[uxdsl] Error: ${formatCliDiagnostic(err.message)}`);
    process.exit(1);
  }

  if (argv.help) {
    printHelp();
    process.exit(0);
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
      case undefined: // Default to build if no command but args present
        {
          const config = await loadConfig(argv);
          if (!config) {
             // No config and no command -> Print help
             printHelp();
             process.exit(0);
          }
          await buildOnce(config);
          if (argv.watch) {
            startWatch(config, argv, process.cwd(), buildOnce);
          }
        }
        break;
      case 'watch':
        {
          const config = await loadConfig(argv);
          if (!config) throw new Error('No configuration found for watch.');
          await buildOnce(config);
          startWatch(config, argv, process.cwd(), buildOnce);
        }
        break;
      case 'theme':
        await themeCommand(argv);
        break;
      default:
        console.error(`Unknown command: ${cmd}`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`[uxdsl] Error: ${formatCliDiagnostic(err.message)}`);
    const frame = err && typeof err.showSourceCode === 'function' ? err.showSourceCode(false) : '';
    if (frame) console.error(frame);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

// Exported for tests (bin/uxdsl.test.js): pure-ish normalization functions
// that don't call process.exit, so they can be exercised directly instead
// of spawning the CLI as a subprocess for every case.
module.exports = {
  CONFIG_CANDIDATES,
  THEME_CANDIDATES,
  DEFAULT_ENTRY_REL,
  DEFAULT_OUT_REL,
  findConfigPath,
  findThemeConfigPath,
  normalizeThemeExport,
  warnIfLooksLikeBuildConfig,
  loadThemeConfig,
  loadConfig,
  resolvePath,
  normalizeWatchGlobs,
  normalizeBpMap,
  resolveIncludeTheme,
  resolveStrictTheme,
  normalizeStrictThemeScope,
  getKnownThemeFamilies,
  closestMatch,
  canonicalFlagName,
  COMMAND_FLAG_SPECS,
  parseCommandArgv,
  resolveBreakpoints,
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
};
