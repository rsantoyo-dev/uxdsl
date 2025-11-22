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

const DEFAULT_BREAKPOINTS = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

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
  console.log(`Usage: uxdsl build [options]

Options:
  --entry, -e   Entry .uxdsl file that contains @import statements
  --out, -o     Output CSS file path
  --config, -c  Path to configuration file (defaults to uxdsl.config.cjs)
  --watch, -w   Rebuild on file changes
  --help, -h    Show this help message

Configuration file format (CommonJS):

module.exports = {
  entry: './src/app/uxdsl-entry.uxdsl',
  outFile: './src/app/uxdsl.css',
  breakpoints: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 },
  watch: ['src/**/*.uxdsl', 'src/**/*.css']
};
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
      throw new Error(
        'No configuration found. Provide --entry/--out or add uxdsl.config.cjs'
      );
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
  if (!resolvedConfig.entry || !resolvedConfig.outFile) {
    throw new Error('Both entry and outFile must be provided');
  }
  resolvedConfig.watch = normalizeWatchGlobs(
    resolvedConfig.watch,
    process.cwd(),
    resolvedConfig.entry
  );
  return resolvedConfig;
}

async function buildOnce(config) {
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
  fs.mkdirSync(path.dirname(config.outFile), { recursive: true });
  fs.writeFileSync(config.outFile, result.css, 'utf8');
  console.log(
    `[uxdsl] built ${path.relative(process.cwd(), config.outFile)} (${result.css.length} bytes)`
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

  const cmd = argv._[0] || 'build';
  if (argv.help || cmd !== 'build') {
    printHelp();
    process.exit(0);
  }

  let config;
  try {
    config = await loadConfig(argv);
  } catch (err) {
    console.error('[uxdsl] ' + err.message);
    process.exit(1);
  }

  try {
    await buildOnce(config);
  } catch (err) {
    console.error('[uxdsl] build failed:', err.message);
    process.exit(1);
  }

  if (argv.watch) {
    startWatch(config, buildOnce);
  }
}

main();