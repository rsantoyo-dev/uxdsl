import fs from "fs";
import path from "path";
import { createRequire } from "module";
import type { Plugin, ResolvedConfig } from "vite";
import type uxdslPlugin from "postcss-uxdsl";

// Reuse the PostCSS plugin option typings so user options stay aligned with core
export type UxDslPluginOptions = Parameters<typeof uxdslPlugin>[0] & {
  /**
   * Enable SCSS pre-pass for .uxdsl files.
   * - 'auto' (default): try to compile with 'sass' if available; skip silently otherwise
   * - 'on': require 'sass' and throw if not found
   * - 'off': do not run SCSS pre-pass
   */
  scss?: 'auto' | 'on' | 'off';
  /** Additional load paths for Sass resolver */
  scssLoadPaths?: string[];
};

const nodeRequire = createRequire(__filename);

type ProcessFn = (
  source: string,
  options?: UxDslPluginOptions & { fileId?: string }
) => Promise<string>;

let cachedProcess: ProcessFn | null = null;
let cachedThemeFile: string | undefined;
let cachedThemeCss: string | null = null;
let cachedThemeMtime: number | null = null;
let cachedSpacingFile: string | undefined;
let cachedSpacingCss: string | null = null;
let cachedSpacingMtime: number | null = null;
let cachedColorsFile: string | undefined;
let cachedColorsCss: string | null = null;
let cachedColorsMtime: number | null = null;
let cachedTypeFile: string | undefined;
let cachedTypeCss: string | null = null;
let cachedTypeMtime: number | null = null;
let cachedDensFile: string | undefined;
let cachedDensCss: string | null = null;
let cachedDensMtime: number | null = null;
let cachedRadiiFile: string | undefined;
let cachedRadiiCss: string | null = null;
let cachedRadiiMtime: number | null = null;
let cachedShadowsFile: string | undefined;
let cachedShadowsCss: string | null = null;
let cachedShadowsMtime: number | null = null;
let cachedBordersFile: string | undefined;
let cachedBordersCss: string | null = null;
let cachedBordersMtime: number | null = null;
let cachedSurfacesFile: string | undefined;
let cachedSurfacesCss: string | null = null;
let cachedSurfacesMtime: number | null = null;
let cachedInputsFile: string | undefined;
let cachedInputsCss: string | null = null;
let cachedInputsMtime: number | null = null;
let cachedButtonsFile: string | undefined;
let cachedButtonsCss: string | null = null;
let cachedButtonsMtime: number | null = null;

type BreakpointSpec =
  | Record<string, number>
  | Array<[string, number]>
  | Array<{ name: string; min?: number; px?: number }>;

const DEFAULT_BPS: Record<string, number> = (() => {
  const fallback = { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runtime: any = nodeRequire("postcss-uxdsl/ds-runtime");
    if (runtime && runtime.DEFAULT_BREAKPOINTS) {
      return { ...runtime.DEFAULT_BREAKPOINTS };
    }
  } catch {
    // Keep fallback for compatibility with environments that don't expose subpath exports to TS.
  }
  return fallback;
})();

function normalizeBpMap(input?: BreakpointSpec): Record<string, number> {
  if (!input) return { ...DEFAULT_BPS };
  if (Array.isArray(input)) {
    const map: Record<string, number> = {};
    input.forEach((it: any) => {
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
  const map: Record<string, number> = {};
  Object.keys(input || {}).forEach((k) => {
    const v = (input as Record<string, number>)[k];
    if (typeof v === 'number' && !Number.isNaN(v)) map[k] = v;
  });
  return map;
}

function resolveProcessUxdsl(): ProcessFn {
  if (cachedProcess) return cachedProcess;

  const attempts: Array<() => unknown> = [
    () => nodeRequire("uxdsl-core"),
    () => {
      const resolved = nodeRequire.resolve("uxdsl-core", {
        paths: [__dirname],
      });
      return nodeRequire(resolved);
    },
    () => {
      const localPath = path.resolve(__dirname, "../uxdsl-core");
      return nodeRequire(localPath);
    },
  ];

  for (const attempt of attempts) {
    try {
      const mod = attempt();
      if (typeof mod === "function") {
        cachedProcess = mod as ProcessFn;
        return cachedProcess;
      }
    } catch (err) {
      // Try next strategy
    }
  }

  throw new Error(
    "vite-plugin-uxdsl: Unable to locate uxdsl-core. Install it as a dependency."
  );
}

function resolveDefaultThemeFile(): string {
  if (cachedThemeFile !== undefined) return cachedThemeFile;
  try {
    const pkgPath = nodeRequire.resolve("postcss-uxdsl");
    const resolvedDir = path.dirname(pkgPath); // may be package root or dist/
    const pkgRoot = fs.existsSync(path.resolve(resolvedDir, "package.json"))
      ? resolvedDir
      : path.resolve(resolvedDir, "..");
    const candidates = [
      // package root src (monorepo/dev)
      path.resolve(pkgRoot, "src/theme/default-palette.css"),
      // package root dist (published)
      path.resolve(pkgRoot, "dist/theme/default-palette.css"),
      // resolved dir sibling 'theme' (if main points to dist/index.js and theme shipped alongside)
      path.resolve(resolvedDir, "theme/default-palette.css"),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        cachedThemeFile = f;
        return cachedThemeFile;
      }
    }
  } catch (err) {
    // Ignore resolution errors
  }
  cachedThemeFile = "";
  return cachedThemeFile;
}

function resolveDefaultSpacingFile(): string {
  if (cachedSpacingFile !== undefined) return cachedSpacingFile;
  try {
    const pkgPath = nodeRequire.resolve("postcss-uxdsl");
    const resolvedDir = path.dirname(pkgPath); // may be package root or dist/
    const pkgRoot = fs.existsSync(path.resolve(resolvedDir, "package.json"))
      ? resolvedDir
      : path.resolve(resolvedDir, "..");
    const candidates = [
      // package root src (monorepo/dev)
      path.resolve(pkgRoot, "src/theme/default-spacing.css"),
      // package root dist (published)
      path.resolve(pkgRoot, "dist/theme/default-spacing.css"),
      // resolved dir sibling 'theme' (if main points to dist/index.js and theme shipped alongside)
      path.resolve(resolvedDir, "theme/default-spacing.css"),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        cachedSpacingFile = f;
        return cachedSpacingFile;
      }
    }
  } catch (err) {
    // Ignore resolution errors
  }
  cachedSpacingFile = "";
  return cachedSpacingFile;
}

function resolveDefaultColorsFile(): string {
  if (cachedColorsFile !== undefined) return cachedColorsFile;
  try {
    const pkgPath = nodeRequire.resolve("postcss-uxdsl");
    const resolvedDir = path.dirname(pkgPath); // may be package root or dist/
    const pkgRoot = fs.existsSync(path.resolve(resolvedDir, "package.json"))
      ? resolvedDir
      : path.resolve(resolvedDir, "..");
    const candidates = [
      path.resolve(pkgRoot, "src/theme/default-colors.css"),
      path.resolve(pkgRoot, "dist/theme/default-colors.css"),
      path.resolve(resolvedDir, "theme/default-colors.css"),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        cachedColorsFile = f;
        return cachedColorsFile;
      }
    }
  } catch (err) {
    // ignore
  }
  cachedColorsFile = "";
  return cachedColorsFile;
}

function resolveDefaultTypographyFile(): string {
  if (cachedTypeFile !== undefined) return cachedTypeFile;
  try {
    const pkgPath = nodeRequire.resolve("postcss-uxdsl");
    const resolvedDir = path.dirname(pkgPath);
    const pkgRoot = fs.existsSync(path.resolve(resolvedDir, "package.json"))
      ? resolvedDir
      : path.resolve(resolvedDir, "..");
    const candidates = [
      // Prefer .uxdsl if present
      path.resolve(pkgRoot, "src/theme/default-typography.uxdsl"),
      path.resolve(pkgRoot, "dist/theme/default-typography.uxdsl"),
      path.resolve(resolvedDir, "theme/default-typography.uxdsl"),
      path.resolve(pkgRoot, "src/theme/default-typography.css"),
      path.resolve(pkgRoot, "dist/theme/default-typography.css"),
      path.resolve(resolvedDir, "theme/default-typography.css"),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        cachedTypeFile = f;
        return cachedTypeFile;
      }
    }
  } catch (err) {}
  cachedTypeFile = "";
  return cachedTypeFile;
}

function resolveDefaultDensitiesFile(): string {
  if (cachedDensFile !== undefined) return cachedDensFile;
  try {
    const pkgPath = nodeRequire.resolve("postcss-uxdsl");
    const resolvedDir = path.dirname(pkgPath);
    const pkgRoot = fs.existsSync(path.resolve(resolvedDir, "package.json"))
      ? resolvedDir
      : path.resolve(resolvedDir, "..");
    const candidates = [
      path.resolve(pkgRoot, "src/theme/default-densities.uxdsl"),
      path.resolve(pkgRoot, "dist/theme/default-densities.uxdsl"),
      path.resolve(resolvedDir, "theme/default-densities.uxdsl"),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        cachedDensFile = f;
        return cachedDensFile;
      }
    }
  } catch (err) {}
  cachedDensFile = "";
  return cachedDensFile;
}

function resolveDefaultRadiiFile(): string {
  if (cachedRadiiFile !== undefined) return cachedRadiiFile;
  try {
    const pkgPath = nodeRequire.resolve("postcss-uxdsl");
    const resolvedDir = path.dirname(pkgPath);
    const pkgRoot = fs.existsSync(path.resolve(resolvedDir, "package.json"))
      ? resolvedDir
      : path.resolve(resolvedDir, "..");
    const candidates = [
      path.resolve(pkgRoot, "src/theme/default-radii.uxdsl"),
      path.resolve(pkgRoot, "dist/theme/default-radii.uxdsl"),
      path.resolve(resolvedDir, "theme/default-radii.uxdsl"),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        cachedRadiiFile = f;
        return cachedRadiiFile;
      }
    }
  } catch {}
  cachedRadiiFile = "";
  return cachedRadiiFile;
}

function resolveDefaultShadowsFile(): string {
  if (cachedShadowsFile !== undefined) return cachedShadowsFile;
  try {
    const pkgPath = nodeRequire.resolve("postcss-uxdsl");
    const resolvedDir = path.dirname(pkgPath);
    const pkgRoot = fs.existsSync(path.resolve(resolvedDir, "package.json"))
      ? resolvedDir
      : path.resolve(resolvedDir, "..");
    const candidates = [
      path.resolve(pkgRoot, "src/theme/default-shadows.uxdsl"),
      path.resolve(pkgRoot, "dist/theme/default-shadows.uxdsl"),
      path.resolve(resolvedDir, "theme/default-shadows.uxdsl"),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        cachedShadowsFile = f;
        return cachedShadowsFile;
      }
    }
  } catch {}
  cachedShadowsFile = "";
  return cachedShadowsFile;
}

function resolveDefaultBordersFile(): string {
  if (cachedBordersFile !== undefined) return cachedBordersFile;
  try {
    const pkgPath = nodeRequire.resolve("postcss-uxdsl");
    const resolvedDir = path.dirname(pkgPath);
    const pkgRoot = fs.existsSync(path.resolve(resolvedDir, "package.json"))
      ? resolvedDir
      : path.resolve(resolvedDir, "..");
    const candidates = [
      path.resolve(pkgRoot, "src/theme/default-borders.uxdsl"),
      path.resolve(pkgRoot, "dist/theme/default-borders.uxdsl"),
      path.resolve(resolvedDir, "theme/default-borders.uxdsl"),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        cachedBordersFile = f;
        return cachedBordersFile;
      }
    }
  } catch {}
  cachedBordersFile = "";
  return cachedBordersFile;
}

function resolveDefaultSurfacesFile(): string {
  if (cachedSurfacesFile !== undefined) return cachedSurfacesFile;
  try {
    const pkgPath = nodeRequire.resolve("postcss-uxdsl");
    const resolvedDir = path.dirname(pkgPath);
    const pkgRoot = fs.existsSync(path.resolve(resolvedDir, "package.json"))
      ? resolvedDir
      : path.resolve(resolvedDir, "..");
    const candidates = [
      path.resolve(pkgRoot, "src/theme/default-surfaces.uxdsl"),
      path.resolve(pkgRoot, "dist/theme/default-surfaces.uxdsl"),
      path.resolve(resolvedDir, "theme/default-surfaces.uxdsl"),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        cachedSurfacesFile = f;
        return cachedSurfacesFile;
      }
    }
  } catch {}
  cachedSurfacesFile = "";
  return cachedSurfacesFile;
}

function resolveDefaultInputsFile(): string {
  if (cachedInputsFile !== undefined) return cachedInputsFile;
  try {
    const pkgPath = nodeRequire.resolve("postcss-uxdsl");
    const resolvedDir = path.dirname(pkgPath);
    const pkgRoot = fs.existsSync(path.resolve(resolvedDir, "package.json"))
      ? resolvedDir
      : path.resolve(resolvedDir, "..");
    const candidates = [
      path.resolve(pkgRoot, "src/theme/default-inputs.uxdsl"),
      path.resolve(pkgRoot, "dist/theme/default-inputs.uxdsl"),
      path.resolve(resolvedDir, "theme/default-inputs.uxdsl"),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        cachedInputsFile = f;
        return cachedInputsFile;
      }
    }
  } catch {}
  cachedInputsFile = "";
  return cachedInputsFile;
}

function resolveDefaultButtonsFile(): string {
  if (cachedButtonsFile !== undefined) return cachedButtonsFile;
  try {
    const pkgPath = nodeRequire.resolve("postcss-uxdsl");
    const resolvedDir = path.dirname(pkgPath);
    const pkgRoot = fs.existsSync(path.resolve(resolvedDir, "package.json"))
      ? resolvedDir
      : path.resolve(resolvedDir, "..");
    const candidates = [
      path.resolve(pkgRoot, "src/theme/default-buttons.uxdsl"),
      path.resolve(pkgRoot, "dist/theme/default-buttons.uxdsl"),
      path.resolve(resolvedDir, "theme/default-buttons.uxdsl"),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        cachedButtonsFile = f;
        return cachedButtonsFile;
      }
    }
  } catch {}
  cachedButtonsFile = "";
  return cachedButtonsFile;
}

function readCachedThemeCss(file: string): string {
  if (!file) return "";
  try {
    const stat = fs.statSync(file);
    if (cachedThemeCss === null || cachedThemeMtime !== stat.mtimeMs) {
      cachedThemeCss = fs.readFileSync(file, "utf-8");
      cachedThemeMtime = stat.mtimeMs;
    }
    return cachedThemeCss ?? "";
  } catch (err) {
    cachedThemeCss = null;
    cachedThemeMtime = null;
    return "";
  }
}

function readCachedSpacingCss(file: string): string {
  if (!file) return "";
  try {
    const stat = fs.statSync(file);
    if (cachedSpacingCss === null || cachedSpacingMtime !== stat.mtimeMs) {
      cachedSpacingCss = fs.readFileSync(file, "utf-8");
      cachedSpacingMtime = stat.mtimeMs;
    }
    return cachedSpacingCss ?? "";
  } catch (err) {
    cachedSpacingCss = null;
    cachedSpacingMtime = null;
    return "";
  }
}

function readCachedDensities(file: string): string {
  if (!file) return "";
  try {
    const stat = fs.statSync(file);
    if (cachedDensCss === null || cachedDensMtime !== stat.mtimeMs) {
      cachedDensCss = fs.readFileSync(file, "utf-8");
      cachedDensMtime = stat.mtimeMs;
    }
    return cachedDensCss ?? "";
  } catch (err) {
    cachedDensCss = null;
    cachedDensMtime = null;
    return "";
  }
}

function readCachedRadii(file: string): string {
  if (!file) return "";
  try {
    const stat = fs.statSync(file);
    if (cachedRadiiCss === null || cachedRadiiMtime !== stat.mtimeMs) {
      cachedRadiiCss = fs.readFileSync(file, "utf-8");
      cachedRadiiMtime = stat.mtimeMs;
    }
    return cachedRadiiCss ?? "";
  } catch (err) {
    cachedRadiiCss = null;
    cachedRadiiMtime = null;
    return "";
  }
}

function readCachedShadows(file: string): string {
  if (!file) return "";
  try {
    const stat = fs.statSync(file);
    if (cachedShadowsCss === null || cachedShadowsMtime !== stat.mtimeMs) {
      cachedShadowsCss = fs.readFileSync(file, "utf-8");
      cachedShadowsMtime = stat.mtimeMs;
    }
    return cachedShadowsCss ?? "";
  } catch (err) {
    cachedShadowsCss = null;
    cachedShadowsMtime = null;
    return "";
  }
}

function readCachedBorders(file: string): string {
  if (!file) return "";
  try {
    const stat = fs.statSync(file);
    if (cachedBordersCss === null || cachedBordersMtime !== stat.mtimeMs) {
      cachedBordersCss = fs.readFileSync(file, "utf-8");
      cachedBordersMtime = stat.mtimeMs;
    }
    return cachedBordersCss ?? "";
  } catch (err) {
    cachedBordersCss = null;
    cachedBordersMtime = null;
    return "";
  }
}

function readCachedSurfaces(file: string): string {
  if (!file) return "";
  try {
    const stat = fs.statSync(file);
    if (cachedSurfacesCss === null || cachedSurfacesMtime !== stat.mtimeMs) {
      cachedSurfacesCss = fs.readFileSync(file, "utf-8");
      cachedSurfacesMtime = stat.mtimeMs;
    }
    return cachedSurfacesCss ?? "";
  } catch (err) {
    cachedSurfacesCss = null;
    cachedSurfacesMtime = null;
    return "";
  }
}

function readCachedInputs(file: string): string {
  if (!file) return "";
  try {
    const stat = fs.statSync(file);
    if (cachedInputsCss === null || cachedInputsMtime !== stat.mtimeMs) {
      cachedInputsCss = fs.readFileSync(file, "utf-8");
      cachedInputsMtime = stat.mtimeMs;
    }
    return cachedInputsCss ?? "";
  } catch (err) {
    cachedInputsCss = null;
    cachedInputsMtime = null;
    return "";
  }
}

function readCachedButtons(file: string): string {
  if (!file) return "";
  try {
    const stat = fs.statSync(file);
    if (cachedButtonsCss === null || cachedButtonsMtime !== stat.mtimeMs) {
      cachedButtonsCss = fs.readFileSync(file, "utf-8");
      cachedButtonsMtime = stat.mtimeMs;
    }
    return cachedButtonsCss ?? "";
  } catch (err) {
    cachedButtonsCss = null;
    cachedButtonsMtime = null;
    return "";
  }
}

function readCachedColorsCss(file: string): string {
  if (!file) return "";
  try {
    const stat = fs.statSync(file);
    if (cachedColorsCss === null || cachedColorsMtime !== stat.mtimeMs) {
      cachedColorsCss = fs.readFileSync(file, "utf-8");
      cachedColorsMtime = stat.mtimeMs;
    }
    return cachedColorsCss ?? "";
  } catch (err) {
    cachedColorsCss = null;
    cachedColorsMtime = null;
    return "";
  }
}

function readCachedTypographyCss(file: string): string {
  if (!file) return "";
  try {
    const stat = fs.statSync(file);
    if (cachedTypeCss === null || cachedTypeMtime !== stat.mtimeMs) {
      cachedTypeCss = fs.readFileSync(file, "utf-8");
      cachedTypeMtime = stat.mtimeMs;
    }
    return cachedTypeCss ?? "";
  } catch (err) {
    cachedTypeCss = null;
    cachedTypeMtime = null;
    return "";
  }
}

function getPostcss() {
  // Try local resolution first
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    return nodeRequire("postcss");
  } catch (err) {
    // Continue to fallback strategies below
  }
  // Try requiring from the app root (Vite project)
  try {
    const projectRoot = process.cwd();
    const appRequire = createRequire(path.join(projectRoot, "package.json"));
    return appRequire("postcss");
  } catch (err) {
    // Continue to fallback strategies below
  }
  // Try CWD as fallback
  try {
    const appRequire = createRequire(path.join(process.cwd(), "package.json"));
    return appRequire("postcss");
  } catch (err) {
    // Final failure: throw a helpful error
  }
  throw new Error(
    "vite-plugin-uxdsl: Cannot find 'postcss'. Please add it to your app devDependencies (e.g. npm i -D postcss)."
  );
}

function cleanId(id: string): string {
  return (id || "").replace(/[?#].*$/, "");
}

function stripLineComments(input: string): string {
  // Remove // comments naively, line-by-line, ignoring those inside quotes
  return input
    .split(/\r?\n/g)
    .map((line) => {
      let inSingle = false;
      let inDouble = false;
      for (let i = 0; i < line.length - 1; i++) {
        const ch = line[i];
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        if (ch === '"' && !inSingle) inDouble = !inDouble;
        if (!inSingle && !inDouble && line[i] === "/" && line[i + 1] === "/") {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
}

export default function uxdsl(userOptions: UxDslPluginOptions = {}): Plugin {
  const processUxdsl = resolveProcessUxdsl();
  let projectRoot = process.cwd();
  let isDev = false;

  return {
    name: "vite-plugin-uxdsl",
    enforce: "pre",
    configResolved(config: ResolvedConfig) {
      projectRoot = config.root || projectRoot;
      isDev = config.command === "serve" || config.mode === "development";
    },
    resolveId(id: string, importer: string | undefined) {
      const base = cleanId(id);
      if (base && base.endsWith(".uxdsl")) {
        return path.isAbsolute(base)
          ? base
          : path.resolve(path.dirname(importer || ""), base);
      }
      return null;
    },
    async load(id: string) {
      const baseId = cleanId(id);
      if (!baseId.endsWith(".uxdsl")) return null;

      const rawSource = fs.readFileSync(baseId, "utf-8");
      const scssMode = (userOptions as any)?.scss ?? 'auto';

      // Optional SCSS pre-pass: compile SCSS features inside .uxdsl before UXDSL transform
      let source = rawSource;
      if (scssMode !== 'off') {
        // Inline @import "*.uxdsl" before handing to Sass (Sass doesn't resolve unknown extensions)
        const inlineUxdslImports = (content: string, filePath: string, seen = new Set<string>()): string => {
          if (!filePath) return content;
          const dir = path.dirname(filePath);
          const importRe = /^\s*@import\s+["']([^"']+\.uxdsl)["']\s*;?\s*$/;
          const lines = content.split(/\r?\n/);
          const out: string[] = [];
          for (const line of lines) {
            const m = line.match(importRe);
            if (m) {
              const rel = m[1];
              const dep = path.resolve(dir, rel);
              if (fs.existsSync(dep) && !seen.has(dep)) {
                seen.add(dep);
                const src = fs.readFileSync(dep, 'utf-8');
                out.push(inlineUxdslImports(src, dep, seen));
                continue;
              }
            }
            out.push(line);
          }
          return out.join('\n');
        };
        const preInlined = inlineUxdslImports(rawSource, baseId);
        let sass: any = null;
        try {
          // prefer app's sass if installed
          const appRequire = createRequire(path.join(projectRoot, 'package.json'));
          sass = appRequire('sass');
        } catch {}
        if (!sass) {
          try { sass = nodeRequire('sass'); } catch {}
        }
        if (sass) {
          try {
            const basedir = path.dirname(baseId);
            const loadPaths = [basedir].concat((userOptions as any)?.scssLoadPaths || []);
            // Custom importer so @import/@use of .uxdsl works in Sass
            const importer: any = {
              canonicalize(urlStr: string, opts2: any) {
                // Only handle .uxdsl targets
                if (!/\.uxdsl($|\?|#)/.test(urlStr)) return null;
                const { pathToFileURL } = require('url');
                const tryResolve = (from: string) => {
                  const abs = path.isAbsolute(urlStr) ? urlStr : path.resolve(from, urlStr);
                  if (fs.existsSync(abs)) return pathToFileURL(abs);
                  return null;
                };
                // Try load paths
                for (const lp of loadPaths) {
                  const u = tryResolve(lp);
                  if (u) return u;
                }
                // Try relative to containing file
                const containing = (opts2 && opts2.containingUrl && (opts2.containingUrl as URL).pathname)
                  ? path.dirname((opts2.containingUrl as URL).pathname)
                  : basedir;
                const rel = tryResolve(containing);
                if (rel) return rel;
                return null;
              },
              load(canonicalUrl: URL) {
                try {
                  const filepath = canonicalUrl.pathname;
                  const contents = fs.readFileSync(filepath, 'utf-8');
                  return { contents, syntax: 'scss' };
                } catch {
                  return null;
                }
              }
            };
            const opts: any = {
              syntax: 'scss',
              loadPaths,
              importers: [importer],
            };
            const res = sass.compileString(preInlined, opts);
            source = res.css as string;
          } catch (e: any) {
            if ((scssMode as string) === 'on') throw e;
            // degrade gracefully in 'auto'
            try { console.warn('[uxdsl] SCSS pre-pass failed for', baseId, e?.message || e); } catch {}
            source = rawSource;
          }
        } else if (scssMode === 'on') {
          throw new Error("vite-plugin-uxdsl: 'sass' not found. Install 'sass' or set scss: 'off'.");
        }
      }

      // Ensure default density tokens are loaded BEFORE processing this file,
      // so density(n) can resolve to theme tokens during the same pass.
      const densFileEarly = resolveDefaultDensitiesFile();
      if (densFileEarly) {
        try { this.addWatchFile(densFileEarly); } catch {}
        const densSrc = readCachedDensities(densFileEarly);
        if (densSrc) {
          try { await processUxdsl(densSrc, { ...userOptions, fileId: densFileEarly }); } catch {}
        }
      }

      // Ensure default radii tokens are loaded before processing
      const radiiFileEarly = resolveDefaultRadiiFile();
      if (radiiFileEarly) {
        try { this.addWatchFile(radiiFileEarly); } catch {}
        const radiiSrc = readCachedRadii(radiiFileEarly);
        if (radiiSrc) {
          try { await processUxdsl(radiiSrc, { ...userOptions, fileId: radiiFileEarly }); } catch {}
        }
      }

      // Ensure default shadow tokens are loaded before processing
      const shadowsFileEarly = resolveDefaultShadowsFile();
      if (shadowsFileEarly) {
        try { this.addWatchFile(shadowsFileEarly); } catch {}
        const shSrc = readCachedShadows(shadowsFileEarly);
        if (shSrc) {
          try { await processUxdsl(shSrc, { ...userOptions, fileId: shadowsFileEarly }); } catch {}
        }
      }

      // Ensure default borders tokens are loaded before processing
      const bordersFileEarly = resolveDefaultBordersFile();
      if (bordersFileEarly) {
        try { this.addWatchFile(bordersFileEarly); } catch {}
        const bSrc = readCachedBorders(bordersFileEarly);
        if (bSrc) {
          try { await processUxdsl(bSrc, { ...userOptions, fileId: bordersFileEarly }); } catch {}
        }
      }

      // Ensure default surface packs are loaded before processing
      const surfacesFileEarly = resolveDefaultSurfacesFile();
      if (surfacesFileEarly) {
        try { this.addWatchFile(surfacesFileEarly); } catch {}
        const sSrc = readCachedSurfaces(surfacesFileEarly);
        if (sSrc) {
          try { await processUxdsl(sSrc, { ...userOptions, fileId: surfacesFileEarly }); } catch {}
        }
      }

      // Ensure default inputs packs are loaded before processing
      const inputsFileEarly = resolveDefaultInputsFile();
      if (inputsFileEarly) {
        try { this.addWatchFile(inputsFileEarly); } catch {}
        const iSrc = readCachedInputs(inputsFileEarly);
        if (iSrc) {
          try { await processUxdsl(iSrc, { ...userOptions, fileId: inputsFileEarly }); } catch {}
        }
      }

      // Ensure default button packs are loaded before processing so @ds-button works
      const buttonsFileEarly = resolveDefaultButtonsFile();
      if (buttonsFileEarly) {
        try { this.addWatchFile(buttonsFileEarly); } catch {}
        const btnSrc = readCachedButtons(buttonsFileEarly);
        if (btnSrc) {
          try { await processUxdsl(btnSrc, { ...userOptions, fileId: buttonsFileEarly }); } catch {}
        }
      }

      // Process with core
      const css = await processUxdsl(source, { ...userOptions, fileId: baseId });

      // Embed breakpoint metadata so the runtime can adjust media queries if desired
      const bpMap = normalizeBpMap((userOptions as any)?.breakpoints);
      const bpMeta = `/*@uxdsl-bp ${JSON.stringify(bpMap)}*/`;

      const finalCss =
        css +
        `\n${bpMeta}` +
        (isDev ? `\n/*# sourceURL=${baseId} */` : "");

      // Load default palette CSS and watch it in dev so edits apply live
      let themeCss = "";
      const themeFile = resolveDefaultThemeFile();
      if (themeFile) {
        try {
          this.addWatchFile(themeFile);
        } catch (err) {
          // Ignore if watcher not available
        }
        themeCss = readCachedThemeCss(themeFile);
      }

      // Load default spacing CSS and watch it in dev so edits apply live
      let spacingCss = "";
      const spacingFile = resolveDefaultSpacingFile();
      if (spacingFile) {
        try {
          this.addWatchFile(spacingFile);
        } catch (err) {
          // Ignore if watcher not available
        }
        spacingCss = readCachedSpacingCss(spacingFile);
      }

      // Load default colors CSS
      let colorsCss = "";
      const colorsFile = resolveDefaultColorsFile();
      if (colorsFile) {
        try {
          this.addWatchFile(colorsFile);
        } catch (err) {
          // Ignore
        }
        colorsCss = readCachedColorsCss(colorsFile);
      }

      // Load default typography CSS and process via UXDSL so xs()/md() expand
      let typeCss = "";
      const typeFile = resolveDefaultTypographyFile();
      if (typeFile) {
        try {
          this.addWatchFile(typeFile);
        } catch (err) {
          // Ignore
        }
        const src = readCachedTypographyCss(typeFile);
        if (src) {
          try {
            typeCss = await processUxdsl(src, { ...userOptions, fileId: typeFile });
          } catch (err) {
            typeCss = src;
          }
        }
      }

      // Load default densities tokens (@theme) and process via UXDSL
      // This primarily populates the plugin's global density token cache.
      const densFile = resolveDefaultDensitiesFile();
      if (densFile) {
        try { this.addWatchFile(densFile); } catch {}
        const src = readCachedDensities(densFile);
        if (src) {
          try { await processUxdsl(src, { ...userOptions, fileId: densFile }); } catch {}
        }
      }

      // Inject CSS at runtime, replacing existing tag on HMR to avoid duplicates
      const code =
        `const css = ${JSON.stringify(finalCss)};\n` +
        `const themeCss = ${JSON.stringify(themeCss)};\n` +
        `const spacingCss = ${JSON.stringify(spacingCss)};\n` +
        `const colorsCss = ${JSON.stringify(colorsCss)};\n` +
        `const typeCss = ${JSON.stringify(typeCss)};\n` +
        `if (typeof document !== 'undefined') {\n` +
        `  if (themeCss) {\n` +
        `    let t = document.querySelector('style[data-uxdsl-theme="default-palette"]');\n` +
        `    if (!t) { t = document.createElement('style'); t.setAttribute('data-uxdsl-theme', 'default-palette'); document.head.appendChild(t); }\n` +
        `    if (t.textContent !== themeCss) t.textContent = themeCss;\n` +
        `  }\n` +
        `  if (spacingCss) {\n` +
        `    let sp = document.querySelector('style[data-uxdsl-theme=\"default-spacing\"]');\n` +
        `    if (!sp) { sp = document.createElement('style'); sp.setAttribute('data-uxdsl-theme', 'default-spacing'); document.head.appendChild(sp); }\n` +
        `    if (sp.textContent !== spacingCss) sp.textContent = spacingCss;\n` +
        `  }\n` +
        `  if (colorsCss) {\n` +
          `    let c = document.querySelector('style[data-uxdsl-theme=\"default-colors\"]');\n` +
          `    if (!c) { c = document.createElement('style'); c.setAttribute('data-uxdsl-theme', 'default-colors'); document.head.appendChild(c); }\n` +
          `    if (c.textContent !== colorsCss) c.textContent = colorsCss;\n` +
          `  }\n` +
        `  if (typeCss) {\n` +
        `    let ty = document.querySelector('style[data-uxdsl-theme=\"default-typography\"]');\n` +
        `    if (!ty) { ty = document.createElement('style'); ty.setAttribute('data-uxdsl-theme', 'default-typography'); document.head.appendChild(ty); }\n` +
        `    if (ty.textContent !== typeCss) ty.textContent = typeCss;\n` +
        `  }\n` +
        `  const sel = 'style[data-uxdsl=' + JSON.stringify(${JSON.stringify(
          baseId
        )}) + ']';\n` +
        `  let s = document.querySelector(sel);\n` +
        `  if (!s) {\n` +
        `    s = document.createElement('style');\n` +
        `    s.setAttribute('data-uxdsl', ${JSON.stringify(baseId)});\n` +
        (isDev
          ? `    s.setAttribute('data-source-url', ${JSON.stringify(baseId)});\n`
          : "") +
        `    document.head.appendChild(s);\n` +
        `  }\n` +
        `  s.textContent = css;\n` +
        `}\n` +
        `export default css;`;

      return { code, map: null };
    },
  };
}

const cjsCompat = Object.assign(uxdsl, {
  default: uxdsl,
  stripLineComments,
  getPostcss,
});

if (typeof module !== "undefined") {
  module.exports = cjsCompat;
}

export { stripLineComments, getPostcss };
