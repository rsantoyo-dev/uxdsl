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

function loadUxDslPlugin() {
  const tryProjectRequire = () => {
    try {
      const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
      const resolved = projectRequire.resolve('postcss-uxdsl');
      const plugin = projectRequire(resolved);
      if (process.env.UXDSL_DEBUG) {
        console.log(`[uxdsl] using postcss-uxdsl from ${resolved}`);
      }
      return plugin;
    } catch (_) {
      return null;
    }
  };

  const projectPlugin = tryProjectRequire();
  if (projectPlugin) {
    return projectPlugin;
  }

  const localPath = (() => {
    try {
      return require.resolve('postcss-uxdsl', { paths: [__dirname] });
    } catch (_) {
      return null;
    }
  })();
  if (localPath) {
    if (process.env.UXDSL_DEBUG) {
      console.warn('[uxdsl] Using CLI-bundled postcss-uxdsl.');
    }
    return require(localPath);
  }

  throw new Error('postcss-uxdsl package not found. Install it in your project or alongside the CLI.');
}

const uxdslPlugin = loadUxDslPlugin();

const FALLBACK_BREAKPOINTS = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

let DEFAULT_BREAKPOINTS = { ...FALLBACK_BREAKPOINTS };
try {
  const runtime = require('postcss-uxdsl/ds-runtime');
  if (runtime && runtime.DEFAULT_BREAKPOINTS) {
    DEFAULT_BREAKPOINTS = { ...runtime.DEFAULT_BREAKPOINTS };
  }
} catch (_) {
  // Keep fallback defaults for older/partial installs.
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

Generate Entry Options:
  --src             Source directory to scan (default: ./src)
  --out, -o         Output file path (default: ./src/uxdsl-entry.uxdsl)
  --exclude         Comma-separated list of files to exclude

Examples:
  uxdsl init
  uxdsl build
  uxdsl build --entry src/main.uxdsl --out dist/styles.css
  uxdsl generate-entry --src ./src --out ./src/app/uxdsl-entry.uxdsl

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

async function loadThemeConfig(themeConfigPath) {
  const themeModule = await loadModuleExport(themeConfigPath);
  if (!themeModule || typeof themeModule !== 'object') {
    throw new Error(`Invalid theme configuration export in ${themeConfigPath}`);
  }
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

  if (directEntry || directOut) {
    resolvedConfig.entry = resolvePath(directEntry, cwd);
    resolvedConfig.outFile = resolvePath(directOut, cwd);
    resolvedConfig.breakpoints = DEFAULT_BREAKPOINTS;
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
      const baseDir = path.dirname(configPath);
      resolvedConfig.entry = resolvePath(configModule.entry, baseDir);
      resolvedConfig.outFile = resolvePath(configModule.outFile || configModule.output, baseDir);
      resolvedConfig.breakpoints = configModule.breakpoints || DEFAULT_BREAKPOINTS;
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
    resolvedConfig.breakpoints = DEFAULT_BREAKPOINTS;
    resolvedConfig.watch = [];
  }

  if (!resolvedConfig.entry) {
    // No build config, no direct --entry/--out, and no theme file either —
    // same "nothing to build" signal callers already handle (print help).
    return null;
  }

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
  if (config.theme) console.log('[uxdsl] Theme config detected');

  const source = fs.readFileSync(config.entry, 'utf8');
  const resolveImport = createImportResolver(config);
  const result = await postcss([
    postcssImport({ resolve: resolveImport }),
    postcssAdvancedVariables(),
    uxdslPlugin({
      breakpoints: config.breakpoints || DEFAULT_BREAKPOINTS,
      theme: config.theme,
      references: config.references,
    }),
  ]).process(source, {
    from: config.entry,
    to: config.outFile,
    syntax: postcssScss,
  });

  // Inject breakpoint metadata for runtime
  const bpMap = normalizeBpMap(config.breakpoints || DEFAULT_BREAKPOINTS);
  const bpJson = JSON.stringify(bpMap);
  const bpMeta = `/*@uxdsl-bp ${bpJson}*/`;
  // Also inject a marker rule for CSSOM detection
  const bpMarker = `#uxdsl-bp-meta { --bp: '${bpJson}'; display: none; }`;
  const finalCss = result.css + '\n' + bpMeta + '\n' + bpMarker;

  fs.mkdirSync(path.dirname(config.outFile), { recursive: true });
  fs.writeFileSync(config.outFile, finalCss, 'utf8');
  console.log(
    `[uxdsl] built ${path.relative(process.cwd(), config.outFile)} (${finalCss.length} bytes)`
  );
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
  loadThemeConfig,
  loadConfig,
  resolvePath,
  normalizeWatchGlobs,
  normalizeBpMap,
  buildOnce,
  startWatch,
  clearRequireCache,
  init,
  generateEntry,
  main,
};
