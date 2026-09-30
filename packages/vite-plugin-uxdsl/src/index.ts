import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import type { Plugin, ResolvedConfig } from 'vite';

// MIG-B6-20 (FEAT-008), decision D-4: the bundler delivers real CSS through
// its own pipeline; UXDSL only compiles. `resolveId` turns `./panel.uxdsl`
// into an id Vite's own `CSS_LANGS_RE` recognizes as CSS (ending in `.css`,
// `?inline` preserved verbatim so Vite's *own* css plugin honors it exactly as
// it would for a real `.css?inline` import — this plugin does not special-case
// it). `load` calls uxdsl-core's `compile()` (the same pipeline the CLI and the
// Webpack loader use) and hands back plain CSS text; Vite's built-in
// `vite:css`/`vite:css-post` plugins take it from there — extraction in
// `vite build`, native HMR, and an empty/no-op SSR module, all for free.
//
// Stability phase 2: the `scss`/`scssLoadPaths` pre-pass and the `breakpoints`
// option are gone. A `.uxdsl` file's own syntax is not valid SCSS, so a Sass
// pass over it was a second, unguaranteed compiler; `$var`, `@each` and
// `@mixin` are handled by the shared pipeline itself. Breakpoints are a theme
// family: declare them under `breakpoints` in the theme file (or the `theme`
// option), the one place every integration reads them from.

const nodeRequire = createRequire(__filename);

export interface UxDslPluginOptions {
  /** Explicit theme override — skips discovery entirely when given. Its
   * `breakpoints` family is where thresholds are declared. */
  theme?: Record<string, unknown>;
  /** Same shape as postcss-uxdsl's `references` option. Always taken from
   * here (or left undefined): a theme file carries no references. */
  references?: Record<string, unknown>;
  /** Same meaning as postcss-uxdsl's own option: emit (or skip) the
   * global `:root` token definitions. Defaults to `true`. */
  includeTheme?: boolean;
  /** MIG-B6-19 parity: when `theme` is omitted, discover
   * `uxdsl.theme.json`/`uxdsl.theme.config.{js,cjs}` from `configRoot` — the
   * same discovery uxdsl-cli and the plugin used directly both do. Default
   * `true`. Set `false` to always validate against the built-in default
   * theme. */
  discoverTheme?: boolean;
  /** Directory theme discovery searches from. Defaults to Vite's resolved
   * project root (`config.root`), not `process.cwd()` — the two commonly
   * differ (a monorepo running Vite with a non-default `root`). */
  configRoot?: string;
}

interface CoreModule {
  compile(
    input: { entry: string } | { source: string; from?: string },
    config?: Record<string, unknown>
  ): Promise<{ css: string; map?: string; dependencies: string[]; warnings: Array<{ text: string }> }>;
}

interface ConfigModule {
  discoverThemeAsync(dir: string): Promise<{ theme: unknown; dependencies: string[] } | null>;
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

      // MIG-B6-21 (FEAT-008): Vite drives maps from its own `build.sourcemap`
      // / `css.devSourcemap` settings, so this follows the resolved config
      // instead of inventing a plugin option. 'external' (never 'inline'):
      // the map is handed back as a real object for Vite to chain, and an
      // embedded data URI would instead bury it inside the CSS text where
      // Vite's own pipeline can't compose it.
      const wantMap = viteSourceMapEnabled;
      const { css, map, dependencies, warnings } = await core.compile({ entry: absPath }, {
        theme,
        references: userOptions.references,
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
