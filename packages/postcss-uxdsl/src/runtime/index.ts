// Runtime helpers for UXDSL
// - Palette: set/get/reset CSS variables for theme()/palette()
// - Breakpoints: adjust media query thresholds emitted by the UXDSL plugin at runtime

const PREFIX = "dsl__theme__";
const STORE_KEY = "uxdsl:palette";
const STORE_BP_KEY = "uxdsl:breakpoints";

type ScopeOption = Element | string | undefined;

type PaletteUpdate = Record<string, string>;

declare const document: Document;
declare const localStorage: Storage;

type UpdateOptions = {
  scope?: ScopeOption;
  persist?: boolean;
};

type ResetOptions = {
  scope?: ScopeOption;
  clearPersist?: boolean;
};

type LoadOptions = {
  scope?: ScopeOption;
};

function normalize(token: string): string {
  let s = String(token).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  )
    s = s.slice(1, -1);
  s = s.replace(/[\.\s_]+/g, "-");
  if (!s.includes("-")) s = `${s}-main`;
  return s;
}

function aliasVarName(token: string): string {
  return `--${normalize(token)}`;
}

function canonicalVarName(token: string): string {
  return `--${PREFIX}${normalize(token)}`;
}

function target(scope?: ScopeOption): Element {
  if (typeof document === "undefined") {
    throw new Error(
      "UXDSL runtime: document is not available in this environment."
    );
  }
  if (!scope) return document.documentElement;
  if (scope instanceof HTMLElement) return scope;
  const el = document.querySelector(scope as string);
  return el || document.documentElement;
}

export function updatePalette(
  token: string,
  value: string,
  opts: UpdateOptions = {}
): void {
  if (typeof document === "undefined") return;
  const el = target(opts.scope) as HTMLElement;
  el.style.setProperty(aliasVarName(token), value);
  el.style.setProperty(canonicalVarName(token), value);
  if (opts.persist) {
    try {
      const store = JSON.parse(
        localStorage.getItem(STORE_KEY) || "{}"
      ) as PaletteUpdate;
      store[normalize(token)] = value;
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      /* ignore persistence errors */
    }
  }
}

export function applyPalette(
  updates: PaletteUpdate,
  opts: UpdateOptions = {}
): void {
  Object.keys(updates).forEach((k) => updatePalette(k, updates[k], opts));
}

export function getPalette(token: string, opts: LoadOptions = {}): string {
  if (typeof document === "undefined") return "";
  const el = target(opts.scope) as HTMLElement;
  const cs = getComputedStyle(el);
  const alias = cs.getPropertyValue(aliasVarName(token)).trim();
  return alias || cs.getPropertyValue(canonicalVarName(token)).trim();
}

export function resetPalette(
  tokens?: string[] | string,
  opts: ResetOptions = {}
): void {
  if (typeof document === "undefined") return;
  const el = target(opts.scope) as HTMLElement;
  if (!tokens) {
    const style = el.style;
    const FAMILY_RE =
      /^(--)(primary|secondary|tertiary|success|info|warning|error|dark|neutral|light|surface)-/;
    for (let i = style.length - 1; i >= 0; i--) {
      const name = style.item(i);
      if (
        name &&
        name.startsWith("--") &&
        (name.includes(`${PREFIX}`) || FAMILY_RE.test(name))
      ) {
        style.removeProperty(name);
      }
    }
    if (opts.clearPersist) {
      try {
        localStorage.removeItem(STORE_KEY);
      } catch {
        /* ignore persistence errors */
      }
    }
    return;
  }

  const list = Array.isArray(tokens) ? tokens : [tokens];
  list.forEach((t) => {
    el.style.removeProperty(aliasVarName(t));
    el.style.removeProperty(canonicalVarName(t));
  });
}

export function loadPersisted(opts: LoadOptions = {}): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const store = JSON.parse(raw) as PaletteUpdate;
    applyPalette(store, opts);
  } catch {
    /* ignore persistence errors */
  }
}

const runtime = {
  updatePalette,
  applyPalette,
  getPalette,
  resetPalette,
  loadPersisted,
};

export default runtime;

// -----------------------------
// Breakpoint runtime utilities
// -----------------------------

type BreakpointMap = Record<string, number>;

const DEFAULT_BPS: BreakpointMap = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

function parseBpMeta(css: string): BreakpointMap | null {
  // Expects a trailer like: /*@uxdsl-bp {"xs":0,"sm":480,...}*/
  const m = css.match(/\/\*@uxdsl-bp\s+({[\s\S]*?})\s*\*\//);
  if (!m) return null;
  try {
    const map = JSON.parse(m[1]);
    if (map && typeof map === 'object') return map as BreakpointMap;
  } catch {}
  return null;
}

function replaceOrAppendBpMeta(css: string, map: BreakpointMap): string {
  const meta = `/*@uxdsl-bp ${JSON.stringify(map)}*/`;
  if (/\/\*@uxdsl-bp\s+/.test(css)) {
    return css.replace(/\/\*@uxdsl-bp\s+({[\s\S]*?})\s*\*\//, meta);
  }
  return css.endsWith('\n') ? css + meta : css + '\n' + meta;
}

function rewriteMediaQueries(css: string, fromMap: BreakpointMap, toMap: BreakpointMap): string {
  let out = css;
  const names = Array.from(new Set([...Object.keys(fromMap), ...Object.keys(toMap)]));
  names.forEach((name) => {
    const fromPx = fromMap[name];
    const toPx = toMap[name];
    if (typeof fromPx !== 'number' || typeof toPx !== 'number' || fromPx === toPx) return;
    const re = new RegExp(
      `@media\\s*\\(\\s*min-width\\s*:\\s*${fromPx}\\s*px\\s*\\)`,
      'g'
    );
    out = out.replace(re, (m) => m.replace(String(fromPx), String(toPx)));
  });
  return out;
}

function allUxdslStyleTags(): any[] {
  if (typeof document === 'undefined') return [] as any;
  return Array.from(document.querySelectorAll('style[data-uxdsl]')) as any[];
}

let __initialBp: BreakpointMap | null = null;
let __currentBp: BreakpointMap | null = null;

function ensureInitialBp(): void {
  if (__initialBp) return;
  const tags = allUxdslStyleTags();
  for (const t of tags) {
    const css = t.textContent || '';
    const meta = parseBpMeta(css);
    if (meta) {
      __initialBp = { ...meta };
      __currentBp = { ...meta };
      return;
    }
  }
  __initialBp = { ...DEFAULT_BPS };
  __currentBp = { ...DEFAULT_BPS };
}

export function getBreakpoints(): BreakpointMap {
  ensureInitialBp();
  return { ...(__currentBp as BreakpointMap) };
}

export function applyBreakpoints(map: BreakpointMap, opts: { persist?: boolean } = {}): void {
  if (typeof document === 'undefined') return;
  ensureInitialBp();
  const fromMap = __currentBp as BreakpointMap;
  const toMap = { ...fromMap, ...map } as BreakpointMap;
  const tags = allUxdslStyleTags();
  tags.forEach((t) => {
    const css = t.textContent || '';
    const bases = parseBpMeta(css) || fromMap;
    const rewritten = replaceOrAppendBpMeta(rewriteMediaQueries(css, bases, toMap), toMap);
    if (rewritten !== css) t.textContent = rewritten;
  });
  __currentBp = { ...toMap };
  if (opts.persist) {
    try { localStorage.setItem(STORE_BP_KEY, JSON.stringify(__currentBp)); } catch {}
  }
}

export function updateBreakpoint(name: string, px: number, opts: { persist?: boolean } = {}): void {
  if (!name || typeof px !== 'number' || Number.isNaN(px)) return;
  applyBreakpoints({ [name]: px }, opts);
}

export function resetBreakpoints(names?: string[] | string, opts: { clearPersist?: boolean } = {}): void {
  if (typeof document === 'undefined') return;
  ensureInitialBp();
  const initial = __initialBp as BreakpointMap;
  const current = __currentBp as BreakpointMap;
  let target: BreakpointMap;
  if (!names) {
    target = { ...initial };
  } else {
    const list = Array.isArray(names) ? names : [names];
    target = { ...current };
    list.forEach((n) => {
      if (Object.prototype.hasOwnProperty.call(initial, n)) target[n] = initial[n];
    });
  }
  applyBreakpoints(target, { persist: opts.clearPersist ? false : undefined } as any);
  if (opts.clearPersist) {
    try { localStorage.removeItem(STORE_BP_KEY); } catch {}
  }
}

export function loadPersistedBreakpoints(): void {
  if (typeof localStorage === 'undefined') return;
  ensureInitialBp();
  try {
    const raw = localStorage.getItem(STORE_BP_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as BreakpointMap;
    applyBreakpoints(map, { persist: false });
  } catch {}
}

export const breakpoints = {
  get: getBreakpoints,
  set: applyBreakpoints,
  update: updateBreakpoint,
  reset: resetBreakpoints,
  load: loadPersistedBreakpoints,
};
