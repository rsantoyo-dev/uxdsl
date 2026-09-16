#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const chokidar = require('chokidar');
const postcss = require('postcss');
const postcssImport = require('postcss-import');
const postcssAdvancedVariables = require('postcss-advanced-variables');
const postcssScss = require('postcss-scss');
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

const uxdslPlugin = loadUxDslPlugin();
const uxdslRuntime = loadUxDslRuntime() || {};

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

function createImportResolver(config) {
  const entryDir = path.dirname(config.entry);
  return (id, basedir) => {
    const request = id.startsWith('~') ? id.slice(1) : id;
    try {
      return require.resolve(request, {
        paths: [basedir, entryDir, process.cwd()],
      });
    } catch (_) {
      return path.resolve(basedir, request);
    }
  };
}

function printHelp() {
  console.log(`Usage: uxdsl <command> [options]

Commands:
  init              First-run setup: creates uxdsl.config.cjs, src/uxdsl-entry.uxdsl
                    and (Next.js) postcss.config.js if they don't exist yet.
                    Never overwrites an existing file. Run this once per project.
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

Generate Entry Options:
  --src             Source directory to scan (default: ./src)
  --out, -o         Output file path (default: ./src/uxdsl-entry.uxdsl)
  --exclude         Comma-separated list of files to exclude

Examples:
  uxdsl init
  uxdsl build
  uxdsl build --entry src/main.uxdsl --out dist/styles.css
  uxdsl generate-entry --src ./src --out ./src/app/uxdsl-entry.uxdsl
  uxdsl theme --diff --strict

Set UXDSL_DEBUG=1 to log which config/theme files were discovered.
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

function normalizeWatchGlobs(globs, cwd, entry) {
  if (Array.isArray(globs) && globs.length > 0) {
    return globs.map((glob) =>
      path.isAbsolute(glob) ? glob : path.resolve(cwd, glob)
    );
  }
  const entryDir = path.dirname(entry);
  return [
    entry,
    path.join(entryDir, '**/*.uxdsl'),
  ];
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
  // into `resolvedConfig.breakpoints`/`includeTheme` in one place, once the
  // theme (and thus `theme.breakpoints`) is known — see resolveBreakpoints/
  // resolveIncludeTheme above for why this can't happen eagerly per-branch.
  let rawBreakpoints;
  let rawIncludeTheme;

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
      const baseDir = path.dirname(configPath);
      resolvedConfig.entry = resolvePath(configModule.entry, baseDir);
      resolvedConfig.outFile = resolvePath(configModule.outFile || configModule.output, baseDir);
      rawBreakpoints = configModule.breakpoints;
      rawIncludeTheme = configModule.includeTheme;
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

  if (!resolvedConfig.entry) {
    // No build config, no direct --entry/--out, and no theme file either —
    // same "nothing to build" signal callers already handle (print help).
    return null;
  }

  // MIG-B3-01: resolved once the theme is known, not eagerly per-branch
  // above — see resolveBreakpoints/resolveIncludeTheme for why order
  // matters here. A `--include-theme`/`--no-include-theme` flag always
  // wins over the build config's own `includeTheme`.
  resolvedConfig.breakpoints = resolveBreakpoints(rawBreakpoints, resolvedConfig.theme && resolvedConfig.theme.breakpoints);
  resolvedConfig.includeTheme = resolveIncludeTheme(argv['include-theme'], rawIncludeTheme);

  if (debug) {
    console.log(`[uxdsl:debug] config file: ${configPath || '(none)'}`);
    console.log(`[uxdsl:debug] theme file: ${themeConfigPath || '(none)'}`);
    console.log(`[uxdsl:debug] external tokens: ${JSON.stringify((resolvedConfig.references && resolvedConfig.references.externalTokens) || [])}`);
  }

  // Final normalization
  if (resolvedConfig.entry && resolvedConfig.watch) {
    // Build-config-relative globs must follow the same base directory as
    // entry/outFile. This matters when `--config` points outside cwd.
    const watchBaseDir = configPath ? path.dirname(configPath) : cwd;
    resolvedConfig.watch = normalizeWatchGlobs(resolvedConfig.watch, watchBaseDir, resolvedConfig.entry);
    if (themeConfigPath && !resolvedConfig.watch.includes(themeConfigPath)) {
      resolvedConfig.watch.push(themeConfigPath);
    }
    // The build config itself can change entry/outFile/watch/theme/
    // references too — watch it for the same reason the theme file is
    // watched, so `uxdsl watch` picks up a config edit without the user
    // having to list uxdsl.config.cjs in their own `watch` array.
    if (configPath && !resolvedConfig.watch.includes(configPath)) {
      resolvedConfig.watch.push(configPath);
    }
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
function resolveIncludeTheme(flagValue, configValue) {
  if (typeof flagValue === 'boolean') return flagValue;
  if (typeof configValue === 'boolean') return configValue;
  return true;
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

async function buildOnce(config) {
  // MIG-B2-03 item 7: each of these has a concrete, actionable fix, not a
  // generic "invalid configuration".
  if (!config || !config.entry) {
    throw new Error('No entry file configured. Pass --entry <path>, or set "entry" in uxdsl.config.cjs (run "npx uxdsl init" to create one).');
  }
  if (!config.outFile) {
    throw new Error('No output file configured. Pass --out <path>, or set "outFile" in uxdsl.config.cjs.');
  }
  if (!fs.existsSync(config.entry)) {
    throw new Error(`Entry file not found: ${config.entry}. Pass --entry <path> pointing at an existing .uxdsl file, or run "npx uxdsl generate-entry" to create one.`);
  }
  // MIG-B3-01: `includeTheme` defaults to true, matching the plugin's own
  // default — an omitted config/flag means "this entry defines the theme".
  const includeTheme = config.includeTheme !== false;
  // Don't claim a theme was "detected" (i.e. will be emitted) for an entry
  // that only uses it to resolve/validate references against — that's
  // exactly what includeTheme: false means.
  if (config.theme && includeTheme) console.log('[uxdsl] Theme config detected');

  const source = fs.readFileSync(config.entry, 'utf8');
  const resolveImport = createImportResolver(config);
  const result = await postcss([
    postcssImport({ resolve: resolveImport }),
    postcssAdvancedVariables(),
    uxdslPlugin({
      breakpoints: config.breakpoints || DEFAULT_BREAKPOINTS,
      theme: config.theme,
      references: config.references,
      includeTheme,
    }),
  ]).process(source, {
    from: config.entry,
    to: config.outFile,
    syntax: postcssScss,
  });

  // Breakpoint metadata is global-theme information (consumed by the
  // runtime to detect the active breakpoint from the CSSOM) — it belongs
  // to the entry that defines the theme, not to every component entry
  // compiled against it. Forwarding `includeTheme: false` naively without
  // this guard would trade one duplication (global `:root`, fixed by
  // includeTheme itself) for another: a `#uxdsl-bp-meta` marker per
  // component entry.
  let finalCss = result.css;
  if (includeTheme) {
    const bpMap = normalizeBpMap(config.breakpoints || DEFAULT_BREAKPOINTS);
    const bpJson = JSON.stringify(bpMap);
    const bpMeta = `/*@uxdsl-bp ${bpJson}*/`;
    // Also inject a marker rule for CSSOM detection
    const bpMarker = `#uxdsl-bp-meta { --bp: '${bpJson}'; display: none; }`;
    finalCss = finalCss + '\n' + bpMeta + '\n' + bpMarker;
  }

  fs.mkdirSync(path.dirname(config.outFile), { recursive: true });
  fs.writeFileSync(config.outFile, finalCss, 'utf8');
  console.log(
    `[uxdsl] built ${path.relative(process.cwd(), config.outFile)} (${finalCss.length} bytes)`
  );
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
function findPartiallyDefaultedFamilies(rawTheme, effectiveTheme) {
  const touchedFamilies = isPlainThemeObject(rawTheme) ? Object.keys(rawTheme) : [];
  return touchedFamilies.filter((family) => {
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

  if (argv.strict) {
    const incomplete = findPartiallyDefaultedFamilies(rawTheme, effectiveTheme);
    if (incomplete.length > 0) {
      throw new Error(
        `--strict: the following theme families you declared are partially filled from defaults: ${incomplete.join(', ')}. ` +
        'Provide every key of these families explicitly, or drop --strict if inheriting some of them is intentional.'
      );
    }
  }
}

/** Clears `filePath` from require()'s cache — and, recursively, every
 * project-local module it itself required (tracked by Node on each
 * cache entry's `.children`). A config or theme file that does
 * `theme: require('./theme.json')` (or requires any other local helper)
 * would otherwise keep serving THAT nested module's pre-edit content even
 * after the top-level file's own cache entry is cleared and re-required —
 * Node re-executes the top-level file, but its own `require('./theme.json')`
 * call still resolves to the untouched cache entry for that JSON file.
 * node_modules dependencies (chokidar, postcss, ...) are deliberately left
 * alone: they don't change between rebuilds, and re-executing them on
 * every keystroke would be pure waste (and, for some packages, unsafe to
 * do more than once). */
function clearRequireCache(filePath) {
  if (!filePath) return;
  let resolved;
  try {
    resolved = require.resolve(filePath);
  } catch (_) {
    return; // Not required yet (or already gone) — nothing to invalidate.
  }
  const seen = new Set();
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const mod = require.cache[id];
    if (!mod) return;
    for (const child of mod.children || []) {
      if (child.id && !child.id.split(path.sep).includes('node_modules')) {
        visit(child.id);
      }
    }
    delete require.cache[id];
  };
  visit(resolved);
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
    // about a new one after a config change moved it.
    if (filePath && config.outFile && path.resolve(filePath) === path.resolve(config.outFile)) {
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
  
  console.log('[uxdsl] Initializing...');
  if (isNext) console.log('  -> Detected Next.js');
  if (isVite) console.log('  -> Detected Vite');

  // 1. Create uxdsl.config.cjs
  const configPath = path.join(cwd, 'uxdsl.config.cjs');
  if (!fs.existsSync(configPath)) {
    const defaultBpJson = JSON.stringify(DEFAULT_BREAKPOINTS);
    const configContent = `module.exports = {
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

  // 2. Create initial entry file
  const srcDir = path.join(cwd, 'src');
  if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir);
  
  const entryPath = path.join(srcDir, 'uxdsl-entry.uxdsl');
  if (!fs.existsSync(entryPath)) {
    // Run generate logic to create initial file
    await generateEntry({ src: './src', out: entryPath });
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
  const outFileRel = path.relative(cwd, path.join(srcDir, 'uxdsl.css')).split(path.sep).join('/');
  console.log('\n[uxdsl] Initialization complete.');
  console.log('Next steps:');
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

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['watch', 'help'],
    alias: {
      watch: 'w',
      help: 'h',
      entry: 'e',
      out: 'o',
      config: 'c',
    },
  });

  const cmd = argv._[0];

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
    console.error(`[uxdsl] Error: ${err.message}`);
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
  resolveBreakpoints,
  buildOnce,
  diffThemeAgainstDefaults,
  findPartiallyDefaultedFamilies,
  themeCommand,
  startWatch,
  clearRequireCache,
  init,
  generateEntry,
  main,
};
