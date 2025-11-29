// Runtime helpers for UXDSL
// - Palette: set/get/reset CSS variables consumed by palette()
// - Breakpoints: adjust media query thresholds emitted by the UXDSL plugin at runtime

const PREFIX = "ds__palette__"; // canonical prefix for palette vars
const STORE_KEY = "uxdsl:palette";
const STORE_BP_KEY = "uxdsl:breakpoints";

// Dependency graph: source -> Set<dependent>
// e.g. "green-600" -> Set("primary-main", "success-main")
const dependencies: Record<string, Set<string>> = {};

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

// Event Listener System
type Listener = (event: { type: 'palette' | 'breakpoint'; detail: any }) => void;
const listeners: Set<Listener> = new Set();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(type: 'palette' | 'breakpoint', detail: any) {
  listeners.forEach(l => l({ type, detail }));
}

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

export function link(alias: string, source: string): void {
  const s = normalize(source);
  const a = normalize(alias);
  if (!dependencies[s]) {
    dependencies[s] = new Set();
  }
  dependencies[s].add(a);
}

export function unlink(alias: string, source: string): void {
  const s = normalize(source);
  const a = normalize(alias);
  if (dependencies[s]) {
    dependencies[s].delete(a);
  }
}

export function updatePalette(
  token: string,
  value: string,
  opts: UpdateOptions = {}
): void {
  if (typeof document === "undefined") return;
  const el = target(opts.scope) as HTMLElement;
  const normToken = normalize(token);
  
  // Update the token itself
  el.style.setProperty(aliasVarName(token), value);
  el.style.setProperty(canonicalVarName(token), value);
  
  // Propagate to dependents
  if (dependencies[normToken]) {
    dependencies[normToken].forEach(dep => {
      // Recursively update dependents, but don't persist them individually
      // (unless we want to snapshot the whole state, but usually we persist the source)
      updatePalette(dep, value, { ...opts, persist: false });
    });
  }

  if (opts.persist) {
    try {
      const store = JSON.parse(
        localStorage.getItem(STORE_KEY) || "{}"
      ) as PaletteUpdate;
      store[normToken] = value;
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      /* ignore persistence errors */
    }
  }
  
  notify('palette', { token: normToken, value });
}

export function updateColor(
  token: string,
  value: string,
  opts: UpdateOptions = {}
): void {
  if (typeof document === "undefined") return;
  const el = target(opts.scope) as HTMLElement;
  const normToken = normalize(token);
  
  // Update the color token variable
  // Assuming standard UXDSL naming: --ds__color__<token>
  const varName = `--ds__color__${normToken}`;
  el.style.setProperty(varName, value);
  
  // Propagate to dependents (palette tokens)
  if (dependencies[normToken]) {
    dependencies[normToken].forEach(dep => {
      updatePalette(dep, value, { ...opts, persist: false });
    });
  }
  
  // We don't currently persist color token updates in the default palette store
  // If needed, we could add a separate store or mix them in.
  
  notify('palette', { token: normToken, value, isColor: true });
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
  updateColor,
  applyPalette,
  getPalette,
  resetPalette,
  loadPersisted,
  link,
  unlink,
  getBreakpoints,
  applyBreakpoints,
  updateBreakpoint,
  resetBreakpoints,
  loadPersistedBreakpoints,
  subscribe,
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
  const tagged = Array.from(document.querySelectorAll('style[data-uxdsl]'));
  if (tagged.length > 0) return tagged as any[];

  // Fallback 1: search all style tags for the marker (e.g. Next.js dev mode)
  const allStyles = Array.from(document.querySelectorAll('style'));
  const foundStyles = allStyles.filter(s => s.textContent && s.textContent.includes('/*@uxdsl-bp'));
  if (foundStyles.length > 0) return foundStyles as any[];

  // Fallback 2: Search document.styleSheets for the marker rule and convert <link> to <style>
  // This handles Next.js production/dev builds that use <link rel="stylesheet">
  try {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        // Check for the marker rule: #uxdsl-bp-meta
        // We iterate rules safely
        const rules = sheet.cssRules;
        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];
          if (rule instanceof CSSStyleRule && rule.selectorText === '#uxdsl-bp-meta') {
            // Found it!
            const owner = sheet.ownerNode;
            if (owner && owner.nodeName === 'LINK') {
              const href = (owner as HTMLLinkElement).href;
              // We need to fetch the content and replace the link with a style tag
              // We can't do this synchronously easily, but we can try to fetch and replace.
              // However, this function is synchronous.
              // We'll trigger the fetch and return empty for now, but the NEXT call will succeed.
              // Or better: we can't return it yet.
              // But wait, if we can't return it, the current update will fail.
              // Let's try to fetch it immediately if possible or just log a warning.
              
              // Actually, we can't block. But we can start the process.
              if (!(owner as any).__uxdsl_fetching) {
                (owner as any).__uxdsl_fetching = true;
                fetch(href).then(r => r.text()).then(css => {
                  const style = document.createElement('style');
                  style.setAttribute('data-uxdsl', 'converted-link');
                  style.textContent = css;
                  owner.parentNode?.replaceChild(style, owner);
                  // Trigger a re-apply if possible? 
                  // We can't easily re-trigger the caller.
                  // But the next update will work.
                  console.log('[uxdsl] Converted <link> to <style> for runtime updates.');
                }).catch(e => console.error('[uxdsl] Failed to convert link', e));
              }
            }
            break; 
          }
        }
      } catch (e) {
        // CORS or other access error, ignore this sheet
      }
    }
  } catch (e) {}

  return [] as any[];
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
  notify('breakpoint', { map: toMap });
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
  notify('breakpoint', { reset: true, names });
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
  subscribe,
};
