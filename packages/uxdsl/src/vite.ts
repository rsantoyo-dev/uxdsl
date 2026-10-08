import fs from 'fs';
import path from 'path';
import type { Plugin, ResolvedConfig } from 'vite';
import { compile } from './compile';
import { discoverThemeAsync } from './config';

// The bundler delivers real CSS through its own pipeline; UXDSL only
// compiles. `resolveId` turns `./panel.uxdsl`
// into an id Vite's own `CSS_LANGS_RE` recognizes as CSS (ending in `.css`,
// `?inline` preserved verbatim so Vite's *own* css plugin honors it exactly as
// it would for a real `.css?inline` import — this plugin does not special-case
// it). `load` calls `compile()` (the same pipeline the CLI and the Webpack
// loader use) and hands back plain CSS text; Vite's built-in
// `vite:css`/`vite:css-post` plugins take it from there — extraction in
// `vite build`, native HMR, and an empty/no-op SSR module, all for free.
//
// There is no Sass pre-pass and no `breakpoints` option: `$var`, `@each` and
// `@mixin` are handled by the shared pipeline itself, and breakpoints are a
// theme family — declared under `breakpoints` in the theme file (or the
// `theme` option), the one place every integration reads them from.

export interface UxDslPluginOptions {
  /** Explicit theme override — skips discovery entirely when given. Its
   * `breakpoints` family is where thresholds are declared. */
  theme?: Record<string, unknown>;
  /** Same shape as the PostCSS plugin's `references` option. Always taken from
   * here (or left undefined): a theme file carries no references. */
  references?: Record<string, unknown>;
  /** Same meaning as the PostCSS plugin's own option: emit (or skip) the
   * global `:root` token definitions. Defaults to `true`. */
  includeTheme?: boolean;
  /** When `theme` is omitted, discover the theme file (`THEME_CANDIDATES`
   * in `uxdsl/config`) from `configRoot` — the same discovery the CLI and the
   * PostCSS plugin used directly both do. Default
   * `true`. Set `false` to always validate against the built-in default
   * theme. */
  discoverTheme?: boolean;
  /** Directory theme discovery searches from. Defaults to Vite's resolved
   * project root (`config.root`), not `process.cwd()` — the two commonly
   * differ (a monorepo running Vite with a non-default `root`). */
  configRoot?: string;
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
  let projectRoot = process.cwd();
  // Follows Vite's own resolved sourcemap settings
  // rather than adding a plugin option that could disagree with them —
  // `build.sourcemap` for a build, `css.devSourcemap` for the dev server.
  let viteSourceMapEnabled = false;

  return {
    name: 'uxdsl',
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
      // Discovery is resolved here, from this plugin's own `configRoot`
      // (which can legitimately differ from `process.cwd()`). A defined
      // `theme` — `{}` when nothing was found or discovery is off — is always
      // handed to compile(), so the PostCSS plugin's own discovery (which
      // only knows `process.cwd()`) never second-guesses it with the wrong
      // root.
      let discovered: Awaited<ReturnType<typeof discoverThemeAsync>> = null;
      if (userOptions.theme === undefined && discoverTheme) {
        discovered = await discoverThemeAsync(configRoot);
      }
      const theme = userOptions.theme !== undefined
        ? userOptions.theme
        : (discoverTheme ? (discovered ? discovered.theme : {}) : {});

      // Vite drives maps from its own `build.sourcemap`
      // / `css.devSourcemap` settings, so this follows the resolved config
      // instead of inventing a plugin option. 'external' (never 'inline'):
      // the map is handed back as a real object for Vite to chain, and an
      // embedded data URI would instead bury it inside the CSS text where
      // Vite's own pipeline can't compose it.
      const wantMap = viteSourceMapEnabled;
      const { css, map, dependencies, warnings } = await compile({ entry: absPath }, {
        theme: theme as Record<string, unknown>,
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
