import fs from "fs";
import path from "path";
import { createRequire } from "module";
import type { Plugin, ResolvedConfig } from "vite";
import type uxdslPlugin from "postcss-uxdsl";

// Reuse the PostCSS plugin option typings so user options stay aligned with core
export type UxDslPluginOptions = Parameters<typeof uxdslPlugin>[0];

const nodeRequire = createRequire(__filename);

type ProcessFn = (
  source: string,
  options?: UxDslPluginOptions & { fileId?: string }
) => Promise<string>;

let cachedProcess: ProcessFn | null = null;
let cachedThemeFile: string | undefined;
let cachedThemeCss: string | null = null;
let cachedThemeMtime: number | null = null;

type BreakpointSpec =
  | Record<string, number>
  | Array<[string, number]>
  | Array<{ name: string; min?: number; px?: number }>;

const DEFAULT_BPS: Record<string, number> = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

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

      const source = fs.readFileSync(baseId, "utf-8");

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

      // Inject CSS at runtime, replacing existing tag on HMR to avoid duplicates
      const code =
        `const css = ${JSON.stringify(finalCss)};\n` +
        `const themeCss = ${JSON.stringify(themeCss)};\n` +
        `if (typeof document !== 'undefined') {\n` +
        `  if (themeCss) {\n` +
        `    let t = document.querySelector('style[data-uxdsl-theme="default-palette"]');\n` +
        `    if (!t) { t = document.createElement('style'); t.setAttribute('data-uxdsl-theme', 'default-palette'); document.head.appendChild(t); }\n` +
        `    if (t.textContent !== themeCss) t.textContent = themeCss;\n` +
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
