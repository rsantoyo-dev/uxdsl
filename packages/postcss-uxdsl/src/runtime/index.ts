// Runtime palette helpers for UXDSL
// Provides a tiny API to set/get/reset CSS variables that back theme()/palette().

const PREFIX = "dsl__theme__";
const STORE_KEY = "uxdsl:palette";

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
