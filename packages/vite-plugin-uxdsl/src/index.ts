import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import type { Plugin, ResolvedConfig } from 'vite';

// MIG-B6-20 (FEAT-008), decision D-4: the bundler delivers real CSS through
// its own pipeline; UXDSL only compiles. This plugin used to convert every
// `.uxdsl` file into a JS module that injected a runtime <style> tag
// (`typeof document !== 'undefined'`) — no extraction in `vite build`, no
// styles at all during SSR (that check is false on the server), and the
// absolute build-machine file path baked unconditionally into the
// `data-uxdsl` attribute of every production bundle. It also injected ten
// legacy `default-*.css`/`.uxdsl` packs on every single module regardless
// of whether the project used them, silently pre-processed every `.uxdsl`
// file through Sass whenever the *host project* happened to have `sass`
// installed for an unrelated reason, and never read the project's own
// theme file at all.
//
// The rewrite: `resolveId` turns `./panel.uxdsl` into an id Vite's own
// `CSS_LANGS_RE` recognizes as CSS (ending in `.css`, `?inline` preserved
// verbatim so Vite's *own* css plugin honors it exactly as it would for a
// real `.css?inline` import — this plugin does not special-case it).
// `load` calls uxdsl-core's `compile()` (the same pipeline the CLI and
// uxdsl-core's own tests exercise) and hands back plain CSS text; Vite's
// built-in `vite:css`/`vite:css-post` plugins take it from there —
// extraction in `vite build`, native HMR, and an empty/no-op SSR module,
// all for free, instead of reimplemented here.

const nodeRequire = createRequire(__filename);

type BreakpointSpec =
  | Record<string, number>
  | Array<[string, number]>
  | Array<{ name: string; min?: number; px?: number }>;

export interface UxDslPluginOptions {
  theme?: Record<string, unknown>;
  references?: Record<string, unknown>;
  breakpoints?: BreakpointSpec;
  /** Same meaning as postcss-uxdsl's own option: emit (or skip) the
   * global `:root` token definitions. Defaults to `true`. */
  includeTheme?: boolean;
  /** MIG-B6-19 parity: when `theme` is omitted, discover
   * `uxdsl.theme.config.*`/`uxdsl.theme.json` from `configRoot` — the same
   * discovery uxdsl-cli and the plugin used directly both do. Default
   * `true`. Set `false` to always validate against the built-in default
   * theme, as every version of this plugin before this story did. */
  discoverTheme?: boolean;
  /** Directory theme discovery searches from. Defaults to Vite's resolved
   * project root (`config.root`), not `process.cwd()` — the two commonly
   * differ (a monorepo running Vite with a non-default `root`). */
  configRoot?: string;
  /**
   * Explicit-only SCSS pre-pass. The previous `'auto'` mode (silently
   * activated whenever the *host project* had `sass` installed, for any
   * reason) is removed: a `.uxdsl` file's own syntax ($var, xs()/md(),
   * palette(), @ds-*) is not valid SCSS, so an unrelated dependency
   * silently changing how every `.uxdsl` file compiles was never safe.
   * `'on'` keeps working exactly as before and is opt-in only. Plain
   * `$var`, `@each` and `@mixin` don't need this at all —
   * postcss-advanced-variables (already inside `compile()`) covers them.
   * Not covered by this story's CLI/core/Webpack parity guarantee.
   */
  scss?: 'on' | 'off';
  /** Additional Sass load paths. Only consulted when `scss: 'on'`. */
  scssLoadPaths?: string[];
}

interface CoreModule {
  compile(
    input: { entry: string } | { source: string; from?: string },
    config?: Record<string, unknown>
  ): Promise<{ css: string; map?: string; dependencies: string[]; warnings: Array<{ text: string }> }>;
}

interface ConfigModule {
  discoverThemeAsync(dir: string): Promise<{ theme: unknown; references: unknown; dependencies: string[] } | null>;
}

function resolveCore(): CoreModule {
  const attempts: Array<() => unknown> = [
    () => nodeRequire('uxdsl-core'),
    () => nodeRequire(nodeRequire.resolve('uxdsl-core', { paths: [__dirname] })),
  ];
  for (const attempt of attempts) {
    try {
      const mod = attempt() as CoreModule;
      if (mod && typeof mod.compile === 'function') return mod;
    } catch {
      // Try the next strategy.
    }
  }
  throw new Error('vite-plugin-uxdsl: unable to locate uxdsl-core (with a compile() export). Install it as a dependency.');
}

function resolveConfigModule(): ConfigModule {
  const attempts: Array<() => unknown> = [
    () => nodeRequire('postcss-uxdsl/config'),
    () => nodeRequire(nodeRequire.resolve('postcss-uxdsl/config', { paths: [__dirname] })),
  ];
  for (const attempt of attempts) {
    try {
      const mod = attempt() as ConfigModule;
      if (mod && typeof mod.discoverThemeAsync === 'function') return mod;
    } catch {
      // Try the next strategy.
    }
  }
  throw new Error('vite-plugin-uxdsl: unable to locate postcss-uxdsl/config (with discoverThemeAsync). Install postcss-uxdsl 0.5.0-beta.6 or later.');
}

// A previously-resolved id of ours always carries this marker in its query
// string — distinguishes "a raw `./panel.uxdsl` specifier, resolve it" from
// "an id we already resolved, being asked about again" (Vite/Rollup can
// call resolveId more than once for the same final id).
const virtualMarkerRE = /[?&]uxdsl\b/;
// Vite's own inline-CSS marker (see vite/dist/node's `inlineRE`) — read
// here only to decide whether to preserve it into our virtual id; Vite's
// own `vite:css` plugin is what actually acts on it.
const inlineRE = /[?&]inline\b/;

function isVirtualId(id: string): boolean {
  return virtualMarkerRE.test(id);
}

function realPathFromVirtualId(id: string): string {
  const queryIndex = id.indexOf('?');
  return queryIndex === -1 ? id : id.slice(0, queryIndex);
}

// Vite's CSS_LANGS_RE requires the extension immediately followed by `$`
// or `?` — `&lang.css` at the very end of the id satisfies that. `?uxdsl`
// is our own marker (see isVirtualId); `&inline` is preserved so Vite's
// *own* inlineRE still matches, letting its css plugin handle `?inline`
// exactly as it would for a real `.css?inline` import.
function buildVirtualId(absPath: string, inline: boolean): string {
  return `${absPath}?uxdsl${inline ? '&inline' : ''}&lang.css`;
}

// MIG-B6-20 item 2 (Sass): preserved near-verbatim from the previous
// implementation, adapted to feed `compile({ source, from })` instead of
// the old bare `processUxdsl` call. Explicit opt-in only (`scss: 'on'`) —
// see UxDslPluginOptions.scss's own doc for why 'auto' is gone.
function inlineUxdslImportsForSass(content: string, filePath: string, seen: Set<string> = new Set()): string {
  const dir = path.dirname(filePath);
  const importRe = /^\s*@import\s+["']([^"']+\.uxdsl)["']\s*;?\s*$/;
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(importRe);
    if (m) {
      const dep = path.resolve(dir, m[1]);
      if (fs.existsSync(dep) && !seen.has(dep)) {
        seen.add(dep);
        out.push(inlineUxdslImportsForSass(fs.readFileSync(dep, 'utf-8'), dep, seen));
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

function compileWithSass(absPath: string, options: UxDslPluginOptions, projectRoot: string): string {
  const rawSource = fs.readFileSync(absPath, 'utf-8');
  let sass: unknown;
  try {
    sass = createRequire(path.join(projectRoot, 'package.json'))('sass');
  } catch {
    // Fall through — try the plugin's own resolution below.
  }
  if (!sass) {
    try {
      sass = nodeRequire('sass');
    } catch {
      throw new Error("vite-plugin-uxdsl: scss: 'on' requires 'sass' to be installed. Install it, or set scss: 'off'/omit the option.");
    }
  }
  const basedir = path.dirname(absPath);
  const loadPaths = [basedir, ...(options.scssLoadPaths || [])];
  const preInlined = inlineUxdslImportsForSass(rawSource, absPath);
  const importer = {
    canonicalize(urlStr: string, opts2: { containingUrl?: URL }) {
      if (!/\.uxdsl($|\?|#)/.test(urlStr)) return null;
      const { pathToFileURL } = require('url');
      const tryResolve = (from: string) => {
        const abs = path.isAbsolute(urlStr) ? urlStr : path.resolve(from, urlStr);
        return fs.existsSync(abs) ? pathToFileURL(abs) : null;
      };
      for (const lp of loadPaths) {
        const u = tryResolve(lp);
        if (u) return u;
      }
      const containing = opts2?.containingUrl?.pathname ? path.dirname(opts2.containingUrl.pathname) : basedir;
      return tryResolve(containing);
    },
    load(canonicalUrl: URL) {
      try {
        return { contents: fs.readFileSync(canonicalUrl.pathname, 'utf-8'), syntax: 'scss' as const };
      } catch {
        return null;
      }
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (sass as any).compileString(preInlined, { syntax: 'scss', loadPaths, importers: [importer] });
  return result.css as string;
}

export default function uxdsl(userOptions: UxDslPluginOptions = {}): Plugin {
  const core = resolveCore();
  const configModule = resolveConfigModule();
  let projectRoot = process.cwd();
  // MIG-B6-21 (FEAT-008): follows Vite's own resolved sourcemap settings
  // rather than adding a plugin option that could disagree with them —
  // `build.sourcemap` for a build, `css.devSourcemap` for the dev server.
  let viteSourceMapEnabled = false;

  return {
    name: 'vite-plugin-uxdsl',
    enforce: 'pre',
    configResolved(config: ResolvedConfig) {
      projectRoot = config.root || projectRoot;
      viteSourceMapEnabled = Boolean(config.build?.sourcemap) || Boolean(config.css?.devSourcemap);
    },
    resolveId(id: string, importer: string | undefined) {
      // A leading "/" is ambiguous on POSIX: `path.isAbsolute` can't tell
      // a real absolute filesystem path apart from Vite's own
      // root-relative id/URL form. Confirmed by reproducing under
      // `server.ssrLoadModule()`: Vite's SSR import rewriting round-trips
      // an id we already resolved through its dev-server URL space,
      // which strips the project-root prefix (but keeps our own query
      // string), then asks `resolveId` again with that root-relative
      // form — landing right back in the `isVirtualId` branch below. Both
      // branches here re-derive and verify a real absolute path instead
      // of ever trusting a leading "/" at face value.
      if (isVirtualId(id)) {
        const filePart = realPathFromVirtualId(id);
        if (path.isAbsolute(filePart) && fs.existsSync(filePart)) return id;
        const rebuiltAbs = path.resolve(projectRoot, filePart.replace(/^[/\\]/, ''));
        return fs.existsSync(rebuiltAbs) ? buildVirtualId(rebuiltAbs, inlineRE.test(id)) : null;
      }
      const queryIndex = id.indexOf('?');
      const rawPath = queryIndex === -1 ? id : id.slice(0, queryIndex);
      if (!rawPath.endsWith('.uxdsl')) return null;
      const absPath = path.isAbsolute(rawPath) && fs.existsSync(rawPath)
        ? rawPath
        : path.resolve(path.dirname(importer || projectRoot), rawPath);
      if (!fs.existsSync(absPath)) return null;
      return buildVirtualId(absPath, inlineRE.test(id));
    },
    async load(id: string) {
      if (!isVirtualId(id)) return null;
      const absPath = realPathFromVirtualId(id);

      const configRoot = userOptions.configRoot ?? projectRoot;
      const discoverTheme = userOptions.discoverTheme !== false;
      // MIG-B6-19 parity, resolved authoritatively here: this plugin's own
      // `configRoot` (which can legitimately differ from `process.cwd()`)
      // is the one correct place to discover from. A defined `theme` —
      // `{}` when nothing was found or discovery is off — is always
      // handed to compile(), so postcss-uxdsl's own MIG-B6-19
      // auto-discovery (which only knows `process.cwd()`) never
      // second-guesses this with the wrong root.
      let discovered: Awaited<ReturnType<ConfigModule['discoverThemeAsync']>> = null;
      if (userOptions.theme === undefined && discoverTheme) {
        discovered = await configModule.discoverThemeAsync(configRoot);
      }
      const theme = userOptions.theme !== undefined
        ? userOptions.theme
        : (discoverTheme ? (discovered ? discovered.theme : {}) : {});
      const references = userOptions.references !== undefined
        ? userOptions.references
        : discovered?.references;

      const input = userOptions.scss === 'on'
        ? { source: compileWithSass(absPath, userOptions, projectRoot), from: absPath }
        : { entry: absPath };

      // MIG-B6-21 (FEAT-008): Vite drives maps from its own `build.sourcemap`
      // / `css.devSourcemap` settings, so this follows the resolved config
      // instead of inventing a plugin option. 'external' (never 'inline'):
      // the map is handed back as a real object for Vite to chain, and an
      // embedded data URI would instead bury it inside the CSS text where
      // Vite's own pipeline can't compose it.
      const wantMap = viteSourceMapEnabled;
      const { css, map, dependencies, warnings } = await core.compile(input, {
        theme,
        references,
        breakpoints: userOptions.breakpoints,
        includeTheme: userOptions.includeTheme,
        sourceMap: wantMap ? 'external' : false,
        to: absPath,
      });

      for (const dep of dependencies) this.addWatchFile(dep);
      if (discovered) for (const dep of discovered.dependencies) this.addWatchFile(dep);
      for (const warning of warnings) this.warn(warning.text);

      // This is the map for the CSS this hook just produced. It is returned
      // as the module's own map only because the module *is* that CSS —
      // never as the map of a JavaScript module wrapping it.
      return { code: css, map: map ? JSON.parse(map) : null };
    },
  };
}

const cjsCompat = Object.assign(uxdsl, { default: uxdsl });
if (typeof module !== 'undefined') {
  module.exports = cjsCompat;
}
