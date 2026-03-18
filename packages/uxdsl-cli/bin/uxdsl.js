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
  build             Build CSS from UXDSL entry file
  watch             Watch for changes and rebuild
  init              Initialize UXDSL in the current project
  generate-entry    Auto-generate an entry file importing all .uxdsl files

Build/Watch Options:
  --entry, -e       Entry .uxdsl file that contains @import statements
  --out, -o         Output CSS file path
  --config, -c      Path to configuration file (defaults to uxdsl.config.cjs)
  --watch, -w       (Build only) Rebuild on file changes

Generate Entry Options:
  --src             Source directory to scan (default: ./src)
  --out, -o         Output file path (default: ./src/uxdsl-entry.uxdsl)
  --exclude         Comma-separated list of files to exclude

Examples:
  uxdsl init
  uxdsl build --entry src/main.uxdsl --out dist/styles.css
  uxdsl generate-entry --src ./src --out ./src/app/uxdsl-entry.uxdsl
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

async function loadConfig(argv) {
  const cwd = process.cwd();
  const directEntry = argv.entry || argv.e;
  const directOut = argv.out || argv.o;
  const configPathArg = argv.config || argv.c;
  let resolvedConfig = {};
  if (directEntry || directOut) {
    resolvedConfig.entry = resolvePath(directEntry, cwd);
    resolvedConfig.outFile = resolvePath(directOut, cwd);
    resolvedConfig.breakpoints = DEFAULT_BREAKPOINTS;
    resolvedConfig.watch = [];
  } else {
    const configPath = configPathArg
      ? resolvePath(configPathArg, cwd)
      : findConfigPath(cwd);
    if (!configPath) {
      // Return defaults if no config found, but warn if building without explicit args
      return null;
    }
    let configModule = require(configPath);
    if (configModule && typeof configModule === 'object' && 'default' in configModule) {
      configModule = configModule.default;
    }
    if (typeof configModule === 'function') {
      configModule = await configModule();
    }
    if (!configModule || typeof configModule !== 'object') {
      throw new Error(`Invalid configuration export in ${configPath}`);
    }
    const baseDir = path.dirname(configPath);
    resolvedConfig.entry = resolvePath(configModule.entry, baseDir);
    resolvedConfig.outFile = resolvePath(
      configModule.outFile || configModule.output,
      baseDir
    );
    resolvedConfig.breakpoints = configModule.breakpoints || DEFAULT_BREAKPOINTS;
    resolvedConfig.watch = configModule.watch || [];
    resolvedConfig.theme = configModule.theme;
  }
  
  // Final normalization
  if (resolvedConfig.entry && resolvedConfig.watch) {
      resolvedConfig.watch = normalizeWatchGlobs(
        resolvedConfig.watch,
        process.cwd(),
        resolvedConfig.entry
      );
  }
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
  if (!config || !config.entry || !config.outFile) {
      throw new Error('Invalid build configuration. Provide --entry and --out or a config file.');
  }
  if (config.theme) console.log('[uxdsl] Theme config detected');
  
  const source = fs.readFileSync(config.entry, 'utf8');
  const resolveImport = createImportResolver(config);
  const result = await postcss([
    postcssImport({ resolve: resolveImport }),
    postcssAdvancedVariables(),
    uxdslPlugin({ 
      breakpoints: config.breakpoints || DEFAULT_BREAKPOINTS,
      theme: config.theme
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

function startWatch(config, builder) {
  const watcher = chokidar.watch(config.watch, { ignoreInitial: true });
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

  watcher.on('all', (event, filePath) => {
    const rel = path.relative(process.cwd(), filePath);
    console.log(`[uxdsl] ${event} ${rel}`);
    trigger();
  });
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
  
  // Default core imports
  const CORE_IMPORTS = [
    "@import 'postcss-uxdsl/theme/default-colors.css';",
    "@import 'postcss-uxdsl/theme/default-palette.css';",
    "@import 'postcss-uxdsl/theme/default-spacing.css';",
    "@import 'postcss-uxdsl/theme/default-typography.uxdsl';",
    "@import 'postcss-uxdsl/theme/default-densities.uxdsl';",
    "@import 'postcss-uxdsl/theme/default-radii.uxdsl';",
    "@import 'postcss-uxdsl/theme/default-shadows.uxdsl';",
    "@import 'postcss-uxdsl/theme/default-borders.uxdsl';",
    "@import 'postcss-uxdsl/theme/default-surfaces.uxdsl';",
    "@import 'postcss-uxdsl/theme/default-buttons.uxdsl';",
    "@import 'postcss-uxdsl/theme/default-inputs.uxdsl';",
  ];

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
  lines.push("/* --- Core Library Imports --- */");
  CORE_IMPORTS.forEach(imp => lines.push(imp));
  lines.push("");
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
  const isNext = fs.existsSync(path.join(cwd, 'next.config.js')) || fs.existsSync(path.join(cwd, 'next.config.mjs'));
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
  if (isNext) {
    const postcssPath = path.join(cwd, 'postcss.config.js');
    if (!fs.existsSync(postcssPath)) {
      fs.writeFileSync(postcssPath, `module.exports = {
  plugins: {
    'postcss-uxdsl': {},
  },
};
`);
      console.log(`  -> Created postcss.config.js`);
    } else {
      console.log(`  -> postcss.config.js exists. Please ensure 'postcss-uxdsl' is added to plugins.`);
    }
  }

  // 4. Next Steps
  console.log('\n[uxdsl] Initialization complete.');
  console.log('Next steps:');
  if (isNext) {
    console.log('1. Import the generated CSS in your layout (e.g., src/app/layout.tsx):');
    console.log("   import '../uxdsl.css'; (or wherever your config.outFile points)");
    console.log('2. Add "uxdsl build --watch" to your dev script if you want separate processing,');
    console.log('   OR rely on PostCSS (recommended for Next.js).');
  } else if (isVite) {
    console.log('1. Add "vite-plugin-uxdsl" to your vite.config.js plugins.');
    console.log('2. Import your .uxdsl files directly in components.');
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
            startWatch(config, buildOnce);
          }
        }
        break;
      case 'watch':
        {
          const config = await loadConfig(argv);
          if (!config) throw new Error('No configuration found for watch.');
          await buildOnce(config);
          startWatch(config, buildOnce);
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

main();