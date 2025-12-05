// PostCSS plugin for a tiny UX DSL (TypeScript)
// Features:
// - Root-level "$var: value;" variable declarations
// - $var substitutions inside declaration values
// - palette(path-to-token) -> CSS var mapping
// - Responsive value functions: xs(...), sm(...), md(...), lg(...), xl(...)

import type { AtRule, Declaration, Result, Root, Rule } from "postcss";
import postcss from "postcss";
import valueParser from "postcss-value-parser";

type BreakpointSpec =
  | Record<string, number>
  | Array<[string, number]>
  | Array<{ name: string; min?: number; px?: number }>;

interface UxDslOptions {
  breakpoints?: BreakpointSpec;
  themeVar?: (path: string) => string;
  spaceVar?: (index: string) => string;
  colorVar?: (path: string) => string;
  theme?: Record<string, any>;
}

const DEFAULT_BPS: Record<string, number> = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

// Map palette(foo.bar|foo-bar) -> resolve to --ds__palette__*
const defaultThemeVar = (path: string) => {
  const key = String(path).trim().replace(/\./g, "-");
  return `var(--ds__palette__${key})`;
};

// Map space(2) -> var(--space-2)
const defaultSpaceVar = (index: string) =>
  `var(--space-${String(index).trim()})`;

// Map color(blue.500|blue-500) -> resolve to --ds__color__*
const defaultColorVar = (path: string) => {
  const key = String(path).trim().replace(/\./g, "-");
  return `var(--ds__color__${key})`;
};

function normalizeBreakpoints(input?: BreakpointSpec) {
  if (!input) {
    const ordered = Object.entries(DEFAULT_BPS).map(([n, px]) => ({
      name: n,
      px,
    }));
    return { map: { ...DEFAULT_BPS }, ordered };
  }
  if (Array.isArray(input)) {
    const entries = input.map((it) =>
      Array.isArray(it)
        ? { name: it[0], px: Number(it[1]) }
        : { name: it.name, px: Number(it.min ?? (it as any).px) }
    );
    const map: Record<string, number> = {};
    entries.forEach(({ name, px }) => {
      if (name) map[name] = px;
    });
    const ordered = entries.slice().sort((a, b) => a.px - b.px);
    return { map, ordered };
  }
  const map: Record<string, number> = { ...(input as Record<string, number>) };
  const ordered = Object.keys(map)
    .map((k) => ({ name: k, px: Number(map[k]) }))
    .sort((a, b) => a.px - b.px);
  return { map, ordered };
}

function normalizeTokenPath(input: string): string {
  if (!input) return "";
  let s = String(input).trim();
  // Strip wrapping quotes
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  // Normalize separators to hyphen
  s = s.replace(/[\.\s_]+/g, "-");
  // Default shade to '-main' if only a family name is provided
  if (!s.includes("-")) s = `${s}-main`;
  return s;
}

function uxdslPlugin(opts: UxDslOptions = {}) {
  // Global density token cache across files processed in this process.
  // Allows defaults to be provided from a separate @theme file.
  const GLOBAL_DENSITY_TOKENS: Record<string, string> =
    (uxdslPlugin as any).__density || Object.create(null);
  const GLOBAL_RADIUS_TOKENS: Record<string, string> =
    (uxdslPlugin as any).__radii || Object.create(null);
  const GLOBAL_SHADOW_TOKENS: Record<string, string> =
    (uxdslPlugin as any).__shadows || Object.create(null);
  const GLOBAL_BORDER_TOKENS: Record<string, string> =
    (uxdslPlugin as any).__borders || Object.create(null);
  // Global button packs (e.g. button-contained/outlined/flat) so they can be
  // defined in a separate @theme file and used across files in the same process.
  const GLOBAL_BUTTON_PACKS: Record<string, Record<string, string>> = (
    uxdslPlugin as any
  ).__buttonPacks || Object.create(null);
  const GLOBAL_INPUT_PACKS: Record<string, any> =
    (uxdslPlugin as any).__inputPacks || Object.create(null);
  const GLOBAL_SURFACE_PACKS: Record<string, Record<string, string>> = (
    uxdslPlugin as any
  ).__surfacePacks || Object.create(null);
  // Ensure the function object holds the same reference so subsequent
  // plugin instances see the accumulated tokens.
  (uxdslPlugin as any).__density = GLOBAL_DENSITY_TOKENS;
  (uxdslPlugin as any).__radii = GLOBAL_RADIUS_TOKENS;
  (uxdslPlugin as any).__shadows = GLOBAL_SHADOW_TOKENS;
  (uxdslPlugin as any).__borders = GLOBAL_BORDER_TOKENS;
  (uxdslPlugin as any).__buttonPacks = GLOBAL_BUTTON_PACKS;
  (uxdslPlugin as any).__inputPacks = GLOBAL_INPUT_PACKS;
  (uxdslPlugin as any).__surfacePacks = GLOBAL_SURFACE_PACKS;

  const { map: bps, ordered } = normalizeBreakpoints(opts.breakpoints);
  const toVar =
    typeof opts.themeVar === "function" ? opts.themeVar : defaultThemeVar;
  const toSpaceVar =
    typeof opts.spaceVar === "function" ? opts.spaceVar : defaultSpaceVar;
  const toColorVar =
    typeof opts.colorVar === "function" ? opts.colorVar : defaultColorVar;
  const bpNames = new Set(Object.keys(bps));
  const mediaRuleCache = new WeakMap<Rule, Map<string, Rule>>();
  const lastMediaByRule = new WeakMap<Rule, AtRule>();

  return {
    postcssPlugin: "postcss-uxdsl",
    Once(root: Root) {
      if (opts.theme) {
        const themeDecls: Declaration[] = [];
        const addVar = (prop: string, value: string) => {
           themeDecls.push(postcss.decl({ prop: `--${prop}`, value }));
        };
        if (opts.theme.palette) {
            Object.entries(opts.theme.palette).forEach(([key, val]) => {
                if (typeof val === 'object' && val !== null) {
                    Object.entries(val).forEach(([subKey, subVal]) => {
                        addVar(`ds__palette__${key}-${subKey}`, String(subVal));
                    });
                } else {
                    addVar(`ds__palette__${key}`, String(val));
                }
            });
        }
        if (opts.theme.spacing) {
             Object.entries(opts.theme.spacing).forEach(([key, val]) => {
                addVar(key, String(val));
            });
        }
        if (opts.theme.typography) {
             Object.entries(opts.theme.typography).forEach(([key, val]) => {
                addVar(key, String(val));
            });
        }
        if (opts.theme.fonts && opts.theme.fonts.families) {
             Object.entries(opts.theme.fonts.families).forEach(([key, val]) => {
                addVar(`font-${key}`, String(val));
            });
        }
        if (themeDecls.length > 0) {
            const rootRule = postcss.rule({ selector: ':root' });
            rootRule.append(themeDecls);
            root.append(rootRule);
        }

        if (opts.theme.fonts) {
            if (opts.theme.fonts.google && Array.isArray(opts.theme.fonts.google)) {
                // Reverse order so they end up in correct order when prepended
                [...opts.theme.fonts.google].reverse().forEach((font: string) => {
                    const url = `https://fonts.googleapis.com/css2?family=${font}&display=swap`;
                    const importRule = postcss.atRule({ name: 'import', params: `url('${url}')` });
                    root.prepend(importRule);
                });
            }
        }
      }
      const vars: Record<string, string> = Object.create(null);
      // Selector-scoped typography directives
      // Supports: @ds-typo(h1), @ds(h1), and @ds-h1 (no params)
      root.walkRules((rule) => {
        const applyTypo = (at: any, variantRaw: string) => {
          let tag = String(variantRaw || "").trim();
          if (
            (tag.startsWith('"') && tag.endsWith('"')) ||
            (tag.startsWith("'") && tag.endsWith("'"))
          ) {
            tag = tag.slice(1, -1);
          }
          if (tag.startsWith("(") && tag.endsWith(")")) {
            tag = tag.slice(1, -1).trim();
          }
          tag = tag.toLowerCase();

          const insert = (prop: string, value: string) => {
            at.parent.insertBefore(at, { prop, value });
          };

          // Typography Configuration Data
          // Defines defaults for each known variant. 
          // If a variant isn't here, we can still attempt to generate generic vars for it (future proofing).
          const defaults: Record<string, any> = {
            h1: { weight: "700", family: "ui", line: "1.1", spacing: "-0.02em" },
            h2: { weight: "700", family: "ui", line: "1.2", spacing: "-0.01em" },
            h3: { weight: "600", family: "ui", line: "1.3", spacing: "normal" },
            h4: { weight: "600", family: "ui", line: "1.4", spacing: "normal" },
            h5: { weight: "600", family: "ui-2", line: "1.4", spacing: "normal" },
            h6: { weight: "600", family: "ui-2", line: "1.4", spacing: "normal" },
            p: { weight: "400", family: "ui", line: "1.6", spacing: "normal" },
            span: { weight: "400", family: "ui", line: "1.5", spacing: "normal" },
            body: { weight: "400", family: "ui", line: "1.6", spacing: "normal" },
            small: { opacity: "0.8", family: "ui-2", line: "1.4", spacing: "normal" },
            caption: { opacity: "0.8", family: "ui-2", line: "1.4", spacing: "normal" },
            pre: { family: "code", line: "1.5" },
            code: { family: "code", line: "1.5" }
          };

          const config = defaults[tag] || { weight: "400", family: "ui", line: "1.5", spacing: "normal" };
          const isCode = tag === "pre" || tag === "code";

          // 1. Font Family
          // Logic: var(--tag-font-family, var(--font-configFamily))
          const fontRef = config.family === "code" ? "var(--font-code)" : (config.family === "ui-2" ? "var(--font-ui-2, var(--font-ui))" : "var(--font-ui)");
          // Special case: code/pre often append 'monospace' directly in fallback
          const familyFallback = isCode ? `${fontRef}, monospace` : fontRef;
          insert("font-family", `var(--${tag}-font-family, ${familyFallback})`);

          // 2. Font Size
          insert("font-size", `var(--${tag}-size)`);

          // 3. Line Height
          if (config.line) {
             insert("line-height", `var(--${tag}-line, ${config.line})`);
          }

          // 4. Font Weight (Skip for code usually, but consistent to add)
          if (config.weight) {
             insert("font-weight", `var(--${tag}-weight, ${config.weight})`);
          }

          // 5. Letter Spacing
          if (config.spacing) {
             insert("letter-spacing", `var(--${tag}-spacing, ${config.spacing})`);
          }

          // 6. Text Transform
          insert("text-transform", `var(--${tag}-transform, none)`);

          // 7. Text Decoration
          insert("text-decoration", `var(--${tag}-decoration, none)`);

          // 8. Font Style
          insert("font-style", `var(--${tag}-style, normal)`);

          // 9. Margin Block Start
          insert("margin-block-start", `var(--${tag}-margin-block-start, auto)`);

          // 10. Margin Block End
          insert("margin-block-end", `var(--${tag}-margin-block-end, auto)`);

          // 11. Opacity (Special for caption/small)
          if (config.opacity) {
             insert("opacity", `var(--${tag}-opacity, ${config.opacity})`);
          }

          at.remove();
        };

        // @ds-typo(h1)
        rule.walkAtRules("ds-typo", (at) => applyTypo(at, at.params || ""));
      });
      const densityTokens: Record<string, string> = Object.create(null);
      const radiusTokens: Record<string, string> = Object.create(null);
      const shadowTokens: Record<string, string> = Object.create(null);
      const borderTokens: Record<string, string> = Object.create(null);

      // Parse a button pack body "{ ... }" into base + states maps
      function parseButtonPack(rawVal: string): {
        base: Record<string, string>;
        states: Record<string, Record<string, string>>;
      } {
        const outBase: Record<string, string> = Object.create(null);
        const outStates: Record<string, Record<string, string>> = Object.create(
          null
        );
        let s = String(rawVal || "").trim();
        if (s.startsWith("{") && s.endsWith("}")) s = s.slice(1, -1);
        let i = 0;
        const N = s.length;
        const isWs = (ch: string) => /\s/.test(ch);
        function skipWs() {
          while (i < N && isWs(s[i]!)) i++;
        }
        function readUntilTopLevelSemi(): string {
          let depth = 0;
          let buf = "";
          while (i < N) {
            const ch = s[i]!;
            if (ch === "{") {
              depth++;
              buf += ch;
              i++;
              continue;
            }
            if (ch === "}" && depth > 0) {
              depth--;
              buf += ch;
              i++;
              continue;
            }
            if (ch === ";" && depth === 0) {
              i++;
              break;
            }
            buf += ch;
            i++;
          }
          return buf.trim();
        }
        while (i < N) {
          skipWs();
          if (i >= N) break;
          if (s[i] === "&" || s[i] === ":") {
            // Read state key up to '{'
            let key = "";
            while (i < N && s[i] !== "{") {
              key += s[i];
              i++;
            }
            key = key.trim();
            if (i < N && s[i] === "{") {
              i++; // skip '{'
              let depth = 1;
              let inner = "";
              while (i < N && depth > 0) {
                const ch = s[i]!;
                if (ch === "{") {
                  depth++;
                  inner += ch;
                  i++;
                  continue;
                }
                if (ch === "}") {
                  depth--;
                  if (depth === 0) {
                    i++;
                    break;
                  }
                  inner += ch;
                  i++;
                  continue;
                }
                inner += ch;
                i++;
              }
              const norm = key
                .replace(/^&/, "")
                .replace(/^:/, "")
                .trim()
                .toLowerCase();
              const stateDecls: Record<string, string> = Object.create(null);
              // Split inner by top-level ';'
              let j = 0;
              const M = inner.length;
              function readInnerUntilSemi(): string {
                let d = 0,
                  b = "";
                while (j < M) {
                  const ch2 = inner[j]!;
                  if (ch2 === "{") {
                    d++;
                    b += ch2;
                    j++;
                    continue;
                  }
                  if (ch2 === "}" && d > 0) {
                    d--;
                    b += ch2;
                    j++;
                    continue;
                  }
                  if (ch2 === ";" && d === 0) {
                    j++;
                    break;
                  }
                  b += ch2;
                  j++;
                }
                return b.trim();
              }
              while (j < M) {
                while (j < M && /\s/.test(inner[j]!)) j++;
                const line = readInnerUntilSemi();
                if (!line) break;
                const idx = line.indexOf(":");
                if (idx > 0) {
                  const k = line.slice(0, idx).trim().toLowerCase();
                  const v = line.slice(idx + 1).trim();
                  if (k) stateDecls[k] = v;
                }
              }
              if (Object.keys(stateDecls).length) outStates[norm] = stateDecls;
            }
            continue;
          }
          const chunk = readUntilTopLevelSemi();
          if (!chunk) break;
          const idx = chunk.indexOf(":");
          if (idx > 0) {
            const k = chunk.slice(0, idx).trim().toLowerCase();
            const v = chunk.slice(idx + 1).trim();
            if (k) outBase[k] = v;
          }
        }
        return { base: outBase, states: outStates };
      }

      // Collect theme-driven density tokens (generic only) and store globally
      root.walkAtRules("theme", (at) => {
        at.walkDecls((decl) => {
          const prop = String((decl as any).prop || "").trim();
          // Accept only generic: density-<n>
          const m = prop.match(/^density-(\d+)$/);
          if (m) {
            const n = m[1];
            const key = `${n}`;
            const val = String((decl as any).value || "").trim();
            densityTokens[key] = val;
            GLOBAL_DENSITY_TOKENS[key] = val;
          }
          // radius-<n>
          const r = prop.match(/^radius-(\d+)$/);
          if (r) {
            const n = r[1];
            const key = `${n}`;
            const val = String((decl as any).value || "").trim();
            radiusTokens[key] = val;
            GLOBAL_RADIUS_TOKENS[key] = val;
          }
          // shadow-<n>
          const s = prop.match(/^shadow-(\d+)$/);
          if (s) {
            const n = s[1];
            const key = `${n}`;
            const val = String((decl as any).value || "").trim();
            shadowTokens[key] = val;
            GLOBAL_SHADOW_TOKENS[key] = val;
          }
          // border-<n> (composite)
          const b = prop.match(/^border-(\d+)$/);
          if (b) {
            const n = b[1];
            const key = `${n}`;
            const val = String((decl as any).value || "").trim();
            borderTokens[key] = val;
            GLOBAL_BORDER_TOKENS[key] = val;
          }
          // button packs: button-<variant>: { padding:..; radius:..; bg:..; color:..; border:..; }
          const pack = prop.match(/^button-([a-zA-Z][\w-]*)$/);
          if (pack) {
            const vname = pack[1].toLowerCase();
            const rawVal = String((decl as any).value || "").trim();
            if (rawVal.startsWith("{") && rawVal.endsWith("}")) {
              const parsed = parseButtonPack(rawVal);
              (root as any).__btnPacks =
                (root as any).__btnPacks || Object.create(null);
              (root as any).__btnPacks[vname] = parsed;
              GLOBAL_BUTTON_PACKS[vname] = parsed as any;
            }
          }
          // surface packs: surface-<variant>: { padding:..; radius:..; bg:..; color:..; border:..; shadow:.. }
          const surf = prop.match(/^surface-([a-zA-Z][\w-]*)$/);
          if (surf) {
            const vname = surf[1].toLowerCase();
            const rawVal = String((decl as any).value || "").trim();
            if (rawVal.startsWith("{") && rawVal.endsWith("}")) {
              const parsed = parseButtonPack(rawVal);
              (root as any).__surfacePacks =
                (root as any).__surfacePacks || Object.create(null);
              (root as any).__surfacePacks[vname] = parsed.base;
              (GLOBAL_SURFACE_PACKS as any)[vname] = parsed.base;
            }
          }
          // input packs: input-<variant>: { padding.., radius.., bg.., color.., border.., shadow.., caret.., placeholder.. }
          const inp = prop.match(/^input-([a-zA-Z][\w-]*)$/);
          if (inp) {
            const vname = inp[1].toLowerCase();
            const rawVal = String((decl as any).value || "").trim();
            if (rawVal.startsWith("{") && rawVal.endsWith("}")) {
              const parsed = parseButtonPack(rawVal);
              (root as any).__inputPacks =
                (root as any).__inputPacks || Object.create(null);
              (root as any).__inputPacks[vname] = {
                base: parsed.base,
                states: parsed.states,
              };
              (GLOBAL_INPUT_PACKS as any)[vname] = {
                base: parsed.base,
                states: parsed.states,
              };
            }
          }
        });

        // Also support rule-form packs: `button-contained: { ... }`, `surface-contained: { ... }`, `input-contained: { ... }`
        at.walkRules((r) => {
          const sel = String((r as any).selector || "").trim();
          const mBtn = sel.match(/^button-([a-zA-Z][\w-]*):?$/);
          const mSurf = sel.match(/^surface-([a-zA-Z][\w-]*):?$/);
          const mInp = sel.match(/^input-([a-zA-Z][\w-]*):?$/);
          if (!mBtn && !mSurf && !mInp) return;
          const isSurface = !!mSurf;
          const isInput = !!mInp;
          const vname = (
            mBtn ? mBtn[1] : mSurf ? mSurf[1] : mInp![1]
          ).toLowerCase();
          const base: Record<string, string> = Object.create(null);
          const states: Record<string, Record<string, string>> = Object.create(
            null
          );
          (r.nodes || []).forEach((n: any) => {
            if (!n) return;
            if (n.type === "decl") {
              const k = String(n.prop || "")
                .trim()
                .toLowerCase();
              const v = String(n.value || "").trim();
              if (k) base[k] = v;
            } else if (!isSurface && n.type === "rule") {
              // Selector can be ':hover' or '&:hover'
              let st = String(n.selector || "").trim();
              st = st.replace(/^&/, "").replace(/^:/, "").toLowerCase();
              const sd: Record<string, string> = Object.create(null);
              (n.nodes || []).forEach((dn: any) => {
                if (dn && dn.type === "decl") {
                  const k = String(dn.prop || "")
                    .trim()
                    .toLowerCase();
                  const v = String(dn.value || "").trim();
                  if (k) sd[k] = v;
                }
              });
              if (st && Object.keys(sd).length) states[st] = sd;
            }
          });
          if (isSurface) {
            (root as any).__surfacePacks =
              (root as any).__surfacePacks || Object.create(null);
            (root as any).__surfacePacks[vname] = base;
            (GLOBAL_SURFACE_PACKS as any)[vname] = base;
          } else if (isInput) {
            (root as any).__inputPacks =
              (root as any).__inputPacks || Object.create(null);
            (root as any).__inputPacks[vname] = { base, states };
            (GLOBAL_INPUT_PACKS as any)[vname] = { base, states };
          } else {
            const parsed = { base, states };
            (root as any).__btnPacks =
              (root as any).__btnPacks || Object.create(null);
            (root as any).__btnPacks[vname] = parsed;
            GLOBAL_BUTTON_PACKS[vname] = parsed as any;
          }
        });
        // Remove @theme blocks from output
        at.remove();
      });

      // Generate CSS variables for density tokens
      const densityRoot = postcss.rule({ selector: ":root" });
      const densityMediaRules: Record<string, Rule> = {};

      Object.keys(GLOBAL_DENSITY_TOKENS).forEach((key) => {
        const val = GLOBAL_DENSITY_TOKENS[key];
        // Resolve for base (xs)
        const baseVal = rewriteFuncs(resolveValueForBp(val, ordered[0].name));
        densityRoot.append({ prop: `--density-${key}`, value: baseVal });
        
        let lastVal = baseVal;
        
        for (let i = 1; i < ordered.length; i++) {
            const bp = ordered[i];
            const currVal = rewriteFuncs(resolveValueForBp(val, bp.name));
            if (currVal !== lastVal) {
                if (!densityMediaRules[bp.name]) {
                    const mediaAt = postcss.atRule({ 
                        name: 'media', 
                        params: `(min-width: ${bp.px}px)` 
                    });
                    const rootRule = postcss.rule({ selector: ":root" });
                    mediaAt.append(rootRule);
                    densityMediaRules[bp.name] = rootRule;
                    root.append(mediaAt);
                }
                densityMediaRules[bp.name].append({ prop: `--density-${key}`, value: currVal });
                lastVal = currVal;
            }
        }
      });
      
      if (densityRoot.nodes.length > 0) {
          root.prepend(densityRoot);
      }

      // Helper to compute surface base props for a given variant/tone/size
      function computeSurfaceBase(
        packsObj: any,
        variant: string,
        toneFamily: string,
        sizeToken?: string
      ): Record<string, string> {
        const base =
          (packsObj && (packsObj[variant] || packsObj["contained"])) || {};
        const out: Record<string, string> = Object.create(null);
        const copyKeys = [
          ["padding", "padding"],
          ["radius", "border-radius"],
          ["bg", "background"],
          ["color", "color"],
          ["border", "border"],
          ["shadow", "box-shadow"],
        ] as Array<[string, string]>;
        copyKeys.forEach(([k, css]) => {
          const v = (base as any)[k];
          if (typeof v === "string" && v) out[css] = v;
        });
        if (toneFamily) {
          const main = `palette(${toneFamily}-main)`;
          const dark = `palette(${toneFamily}-dark)`;
          const contrast = `palette(${toneFamily}-contrast)`;
          if (variant === "outlined") {
            out["background"] = "transparent";
            out["color"] = main;
            out["border"] = `1px solid ${main}`;
          } else if (variant === "flat") {
            out["background"] = "transparent";
            out["color"] = main;
            out["border"] = out["border"] || "none";
          } else {
            out["background"] = main;
            out["color"] = contrast;
            out["border"] = out["border"] || "none";
          }
        }
        if (sizeToken && /^\d+$/.test(sizeToken)) {
          const n = parseInt(sizeToken, 10);
          if (!Number.isNaN(n)) {
            out["padding"] = `density(${n})`;
            out["border-radius"] = `radius(${n})`;
          }
        }
        return out;
      }

      // After tokens are known, expand @ds-surface and @ds-button using packs
      root.walkRules((rule) => {
        // @ds-input(variant [tone] [size])
        rule.walkAtRules("ds-input", (at) => {
          let inner = String((at.params || "").trim());
          if (
            (inner.startsWith('"') && inner.endsWith('"')) ||
            (inner.startsWith("'") && inner.endsWith("'"))
          )
            inner = inner.slice(1, -1);
          if (inner.startsWith("(") && inner.endsWith(")"))
            inner = inner.slice(1, -1).trim();
          const parts = inner
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          const known = new Set(["contained", "outlined", "underline"]);
          let variant = (
            parts.find((p) => known.has(p.toLowerCase())) || "contained"
          ).toLowerCase();
          const toneToken = parts.find(
            (p) => !known.has(p.toLowerCase()) && !/^\d+$/.test(p)
          );
          const sizeToken = parts.find((p) => /^\d+$/.test(p));
          const toneFamily = toneToken
            ? (() => {
                let fam = normalizeTokenPath(toneToken);
                if (fam.includes("-")) fam = fam.split("-")[0];
                return fam;
              })()
            : "";
          const surfPacks: any =
            (root as any).__surfacePacks ||
            (uxdslPlugin as any).__surfacePacks ||
            {};
          const inputPacks: any =
            (root as any).__inputPacks ||
            (uxdslPlugin as any).__inputPacks ||
            {};
          // Use flat surface as base for underline variant, otherwise named variant
          const surfVariant = variant === "underline" ? "flat" : variant;
          const baseProps = computeSurfaceBase(
            surfPacks,
            surfVariant,
            toneFamily,
            sizeToken
          );
          const insert = (prop: string, value: string) => {
            (rule as any).insertBefore(at, { prop, value });
          };
          // Normalize input element defaults
          insert("box-sizing", "border-box");
          insert("outline", "none");
          insert("appearance", "none");
          insert("width", "100%");
          // Apply base surface props
          Object.keys(baseProps).forEach((k) => insert(k, baseProps[k]!));
          // Underline variant: enforce bottom-only border
          if (variant === "underline") {
            insert("border", "none");
            const main = toneFamily
              ? `palette(${toneFamily}-main)`
              : baseProps["border"] || "1px solid currentColor";
            insert(
              "border-bottom",
              typeof main === "string" && main.startsWith("palette(")
                ? `1px solid ${main}`
                : String(main)
            );
            insert("box-shadow", "none");
          }
          // Apply input pack extras + states
          const pack = inputPacks[variant] ||
            inputPacks["contained"] || { base: {}, states: {} };
          const base = pack.base || {};
          // caret-color
          if (base.caret) insert("caret-color", base.caret);
          // placeholder creates ::placeholder rule
          if (base.placeholder) {
            const ph = postcss.rule({
              selector: `${(rule as any).selector}::placeholder`,
            });
            ph.append({ prop: "color", value: base.placeholder });
            (rule.parent as any).insertAfter(rule, ph);
          }
          // States
          const stateToSels: Record<string, string[]> = {
            hover: [":hover"],
            focus: [":focus"],
            disabled: [":disabled", '[aria-disabled="true"]'],
            invalid: [":invalid", '[aria-invalid="true"]'],
          };
          Object.keys(pack.states || {}).forEach((kRaw: string) => {
            const decls = pack.states[kRaw] || {};
            const key = kRaw.replace(/^&/, "").replace(/^:/, "").toLowerCase();
            const pseudos = stateToSels[key] || [":" + key];
            pseudos.forEach((pz) => {
              const newRule = postcss.rule({
                selector: `${(rule as any).selector}${pz}`,
              });
              Object.keys(decls).forEach((dk) => {
                const dv = decls[dk];
                if (dk === "caret")
                  newRule.append({ prop: "caret-color", value: dv });
                else if (dk === "placeholder") {
                  const phr = postcss.rule({
                    selector: `${(rule as any).selector}${pz}::placeholder`,
                  });
                  phr.append({ prop: "color", value: dv });
                  (rule.parent as any).insertAfter(newRule, phr);
                } else if (dk === "underline") {
                  newRule.append({ prop: "border", value: "none" });
                  newRule.append({ prop: "border-bottom", value: dv });
                } else {
                  newRule.append({ prop: dk, value: dv });
                }
              });
              (rule.parent as any).insertAfter(rule, newRule);
            });
          });
          at.remove();
        });
        // @ds-surface(variant [tone])
        rule.walkAtRules("ds-surface", (at) => {
          if (at.parent !== rule) return;
          let inner = String((at.params || "").trim());
          if (
            (inner.startsWith('"') && inner.endsWith('"')) ||
            (inner.startsWith("'") && inner.endsWith("'"))
          )
            inner = inner.slice(1, -1);
          if (inner.startsWith("(") && inner.endsWith(")"))
            inner = inner.slice(1, -1).trim();
          const parts = inner
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          const known = new Set(["contained", "outlined", "flat"]);
          let variant = (
            parts.find((p) => known.has(p.toLowerCase())) || "contained"
          ).toLowerCase();
          const toneToken = parts.find(
            (p) => !known.has(p.toLowerCase()) && !/^\d+$/.test(p)
          );
          const sizeToken = parts.find((p) => /^\d+$/.test(p));
          const toneFamily = toneToken
            ? (() => {
                let fam = normalizeTokenPath(toneToken);
                if (fam.includes("-")) fam = fam.split("-")[0];
                return fam;
              })()
            : "";
          const packs: any =
            (root as any).__surfacePacks ||
            (uxdslPlugin as any).__surfacePacks ||
            {};
          const props = computeSurfaceBase(
            packs,
            variant,
            toneFamily,
            sizeToken
          );
          const insert = (prop: string, value: string) => {
            (rule as any).insertBefore(at, { prop, value });
          };
          Object.keys(props).forEach((k) => insert(k, props[k]!));
          at.remove();
        });

        // @ds-button(variant?) using packs
        rule.walkAtRules("ds-button", (at) => {
          if (at.parent !== rule) return;
          const rawIn = String((at.params || "").trim());
          let inner = rawIn;
          if (
            (inner.startsWith('"') && inner.endsWith('"')) ||
            (inner.startsWith("'") && inner.endsWith("'"))
          ) {
            inner = inner.slice(1, -1);
          }
          if (inner.startsWith("(") && inner.endsWith(")")) {
            inner = inner.slice(1, -1).trim();
          }
          const parts = inner
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          const known = new Set(["contained", "outlined", "flat"]);
          let variant = (
            parts.find((p) => known.has(p.toLowerCase())) || "contained"
          ).toLowerCase();
          const toneToken = parts.find(
            (p) => !known.has(p.toLowerCase()) && !/^\d+$/.test(p)
          );
          const sizeToken = parts.find((p) => /^\d+$/.test(p));
          const toneFamily = toneToken
            ? (() => {
                let fam = normalizeTokenPath(toneToken);
                if (fam.includes("-")) fam = fam.split("-")[0];
                return fam;
              })()
            : "";
          // Prefer packs defined in the same file; fall back to global packs
          const packs: any =
            (root as any).__btnPacks || GLOBAL_BUTTON_PACKS || {};
          const pack: any = packs[variant] || packs["contained"];
          const insert = (
            prop: string,
            value: string,
            targetRule: Rule | null = null
          ) => {
            const trg: any = targetRule || rule;
            trg.insertBefore(at, { prop, value });
          };
          // Apply surface base first, then states from button pack
          const surfPacks: any =
            (root as any).__surfacePacks ||
            (uxdslPlugin as any).__surfacePacks ||
            {};
          const surfProps = computeSurfaceBase(
            surfPacks,
            variant,
            toneFamily,
            sizeToken
          );

          // PRODUCTION OPTIMIZATION: Generate direct CSS values instead of complex variables
          if (surfProps["padding"]) insert("padding", surfProps["padding"]);
          if (surfProps["border-radius"])
            insert("border-radius", surfProps["border-radius"]);
          if (surfProps["background"])
            insert("background", surfProps["background"]);
          if (surfProps["color"]) insert("color", surfProps["color"]);
          if (surfProps["border"]) insert("border", surfProps["border"]);

          // Generate optimized state rules without excessive variables
          if (pack && pack.states) {
            const states = pack.states as Record<
              string,
              Record<string, string>
            >;
            const sel = String((rule as any).selector || "");
            const baseSels = sel
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);

            Object.keys(states).forEach((stateKey) => {
              const stateProps = states[stateKey];
              if (!stateProps) return;

              // Map state keys to CSS pseudo-classes
              const pseudoMap: Record<string, string[]> = {
                hover: [":hover"],
                active: [":active"],
                focus: [":focus"],
                disabled: [":disabled", '[aria-disabled="true"]'],
                selected: [
                  ".is-selected",
                  '[aria-pressed="true"]',
                  '[aria-selected="true"]',
                ],
                focusvisible: [":focus-visible"],
              };

              const pseudos = pseudoMap[stateKey] || [":" + stateKey];
              pseudos.forEach((pseudo) => {
                const newSel = baseSels.map((s) => `${s}${pseudo}`).join(", ");
                const newRule = postcss.rule({ selector: newSel });

                // Apply state properties directly
                Object.keys(stateProps).forEach((prop) => {
                  const value = stateProps[prop];
                  if (value) {
                    let cssProp = prop;
                    if (prop === "bg") cssProp = "background";
                    else if (prop === "radius") cssProp = "border-radius";
                    else if (prop === "shadow") cssProp = "box-shadow";
                    
                    newRule.insertBefore(at, { prop: cssProp, value });
                  }
                });

                (rule.parent as any).insertAfter(rule, newRule);
              });
            });
          }

          at.remove();
        });
      });

      // Collect root-level $vars and remove the declarations
      root.each((node) => {
        if (
          node.type === "decl" &&
          typeof (node as Declaration).prop === "string" &&
          (node as Declaration).prop.startsWith("$")
        ) {
          const d = node as Declaration;
          const name = d.prop.slice(1);
          vars[name] = d.value as string;
          d.remove();
        }
      });

      function resolveValueForBp(input: string, targetBp: string): string {
        const p = valueParser(input);
        const nodes = p.nodes;
        const newNodes: any[] = [];
        
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i] as any;
            if (n.type === 'function' && bpNames.has(n.value)) {
                // Start of a responsive group
                const group: any[] = [n];
                let j = i + 1;
                while (j < nodes.length) {
                    const next = nodes[j] as any;
                    if (next.type === 'space') {
                        j++;
                        continue;
                    }
                    if (next.type === 'function' && bpNames.has(next.value)) {
                        group.push(next);
                        j++;
                    } else {
                        break;
                    }
                }
                
                // Process group
                // Find best match for targetBp
                const targetPx = bps[targetBp];
                let best: any = null;
                let bestPx = -1;
                
                for (const g of group) {
                    const gPx = bps[g.value];
                    if (gPx <= targetPx && gPx > bestPx) {
                        best = g;
                        bestPx = gPx;
                    }
                }
                
                if (best) {
                    const inner = valueParser.stringify(best.nodes).trim();
                    const resolved = resolveValueForBp(inner, targetBp);
                    newNodes.push({ type: 'word', value: resolved });
                }
                
                // Skip processed nodes
                i = j - 1;
            } else {
                newNodes.push(n);
            }
        }
        
        return valueParser.stringify(newNodes).trim();
      }

      function rewriteFuncs(input: string, _forProp?: string): string {
        const p = valueParser(input);
        p.walk((node: any) => {
          // Token-aware density helpers
          if (
            node.type === "function" &&
            (node.value === "density" || node.value === "densities")
          ) {
            const ordered = Object.keys(bps)
              .map((name) => ({ name, px: (bps as any)[name] as number }))
              .filter((it) => typeof it.px === "number" && !Number.isNaN(it.px))
              .sort((a, b) => a.px - b.px);

            const innerText = valueParser.stringify(node.nodes).trim();

            if (node.value === "density") {
              let idx = innerText;
              if (
                (idx.startsWith('"') && idx.endsWith('"')) ||
                (idx.startsWith("'") && idx.endsWith("'"))
              )
                idx = idx.slice(1, -1);
              const base = parseInt(idx.trim(), 10);
              if (!Number.isNaN(base) && ordered.length > 0) {
                // Use CSS variable for density
                node.type = "word";
                node.value = `var(--density-${base})`;
                return;
              }
            } else {
              const rawVals = innerText
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              const steps: number[] = rawVals
                .map((s) => parseInt(s.replace(/[^-\d]/g, ""), 10))
                .filter((n) => !Number.isNaN(n));
              if (steps.length > 0 && ordered.length > 0) {
                const parts = ordered.map((bp, i) => {
                  const step =
                    typeof steps[i] === "number"
                      ? steps[i]
                      : steps[steps.length - 1];
                  return `${bp.name}(space(${step}))`;
                });
                node.type = "word";
                node.value = parts.join(" ");
                return;
              }
            }
            return;
          }
          // Radius helpers: radius(n) or rounded(n)
          if (
            node.type === "function" &&
            (node.value === "radius" || node.value === "rounded")
          ) {
            const innerText = valueParser.stringify(node.nodes).trim();
            // Keyword support
            if (/^['"]?(pill|full)['"]?$/.test(innerText)) {
              node.type = "word";
              node.value = "9999px";
              return;
            }
            if (/^['"]?(circle)['"]?$/.test(innerText)) {
              node.type = "word";
              node.value = "50%";
              return;
            }
            let idx = innerText;
            if (
              (idx.startsWith('"') && idx.endsWith('"')) ||
              (idx.startsWith("'") && idx.endsWith("'"))
            )
              idx = idx.slice(1, -1);
            const n = parseInt(idx.trim(), 10);
            if (!Number.isNaN(n)) {
              const tok =
                radiusTokens[String(n)] || GLOBAL_RADIUS_TOKENS[String(n)];
              if (tok) {
                node.type = "word";
                node.value = tok;
                return;
              }
              // Fallback simple ramp
              const ordered = Object.keys(bps)
                .map((name) => ({ name, px: (bps as any)[name] as number }))
                .filter(
                  (it) => typeof it.px === "number" && !Number.isNaN(it.px)
                )
                .sort((a, b) => a.px - b.px);
              if (ordered.length) {
                const parts = ordered.map((bp, i) => {
                  const base = Math.max(2, n * 2);
                  const step =
                    i === 0
                      ? base
                      : i === 1
                      ? Math.round(base * 2)
                      : Math.round(base * 3);
                  return `${bp.name}(${step}px)`;
                });
                node.type = "word";
                node.value = parts.join(" ");
                return;
              }
            }
            return;
          }
          // Shadow helpers: shadow(n) or elevation(n)
          if (
            node.type === "function" &&
            (node.value === "shadow" || node.value === "elevation")
          ) {
            const innerText = valueParser.stringify(node.nodes).trim();
            let idx = innerText;
            if (
              (idx.startsWith('"') && idx.endsWith('"')) ||
              (idx.startsWith("'") && idx.endsWith("'"))
            )
              idx = idx.slice(1, -1);
            const n = parseInt(idx.trim(), 10);
            if (!Number.isNaN(n)) {
              const tok =
                shadowTokens[String(n)] || GLOBAL_SHADOW_TOKENS[String(n)];
              if (tok) {
                node.type = "word";
                node.value = tok;
                return;
              }
              // Fallback mapping 1..5
              const fallbacks: Record<number, string> = {
                1: "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",
                2: "0 1px 2px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.12)",
                3: "0 2px 4px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.14)",
                4: "0 4px 6px rgba(0,0,0,0.08), 0 10px 15px rgba(0,0,0,0.16)",
                5: "0 10px 15px rgba(0,0,0,0.10), 0 20px 25px rgba(0,0,0,0.20)",
              };
              const fb = fallbacks[n] || fallbacks[1];
              node.type = "word";
              node.value = fb;
              return;
            }
            return;
          }
          // Border helper: border(n[, color][, style])
          if (node.type === "function" && node.value === "border") {
            const innerText = valueParser.stringify(node.nodes).trim();
            const parts = innerText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            let idx = parts[0] || "";
            if (
              (idx.startsWith('"') && idx.endsWith('"')) ||
              (idx.startsWith("'") && idx.endsWith("'"))
            )
              idx = idx.slice(1, -1);
            const n = parseInt(idx, 10);
            // Determine optional color/style args if provided
            const arg1 = parts[1] || "";
            const arg2 = parts[2] || "";
            const looksColor = (s: string) =>
              /^(color\(|palette\(|var\(|#|rgb\(|hsl\()/i.test(s);
            const looksStyle = (s: string) =>
              /^(solid|dashed|dotted|double|groove|ridge|inset|outset)$/i.test(
                s
              );
            const colorArg = looksColor(arg1)
              ? arg1
              : looksColor(arg2)
              ? arg2
              : "";
            const styleArg = looksStyle(arg1)
              ? arg1
              : looksStyle(arg2)
              ? arg2
              : "solid";
            if (!Number.isNaN(n)) {
              const comp =
                borderTokens[String(n)] || GLOBAL_BORDER_TOKENS[String(n)];
              if (comp) {
                node.type = "word";
                node.value = comp;
                return;
              }
              const width = `space(${n})`;
              const color = colorArg || "color(gray.300)";
              node.type = "word";
              node.value = `${width} ${styleArg} ${color}`;
              return;
            }
            return;
          }
          if (node.type === "function" && node.value === "palette") {
            const inner = valueParser.stringify(node.nodes).trim();
            // Support palette(token[, alpha]) where alpha is 0..1
            const parts = inner
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const token = parts[0] || "";
            const normalized = normalizeTokenPath(token);
            const alphaRaw = parts[1];
            if (alphaRaw != null && alphaRaw !== "") {
              const a = Math.max(0, Math.min(1, Number(alphaRaw)));
              const pct = Math.round(a * 100);
              node.type = "word";
              node.value = `color-mix(in srgb, ${toVar(normalized)} ${pct}%, transparent)`;
              return;
            }
            node.type = "word";
            node.value = toVar(normalized);
            return;
          }
          if (node.type === "function" && node.value === "color") {
            const inner = valueParser.stringify(node.nodes).trim();
            const normalized = normalizeTokenPath(inner);
            node.type = "word";
            node.value = toColorVar(normalized);
            return;
          }
          if (node.type === "function" && node.value === "space") {
            const inner = valueParser.stringify(node.nodes).trim();
            let idx = inner;
            if (
              (idx.startsWith('"') && idx.endsWith('"')) ||
              (idx.startsWith("'") && idx.endsWith("'"))
            ) {
              idx = idx.slice(1, -1);
            }
            const numLike = idx.trim();
            if (/^\d{1,3}$/.test(numLike)) {
              node.type = "word";
              node.value = toSpaceVar(numLike);
              return;
            }
          }
        });
        return p.toString().replace(/\s+/g, " ").trim();
      }

      // Walk declarations to handle palette()/space() and responsive bp(...) values
      root.walkDecls((decl) => {
        if (typeof decl.value !== "string") return;
        // Phase 1: replace palette()/space() so nested calls inside xs()/md() are resolved
        const phase1Text = rewriteFuncs(decl.value, (decl as any).prop);

        // Phase 2: extract responsive values
        const parsed = valueParser(phase1Text);
        const bpValues: Array<{ bp: string; text: string; px?: number }> = [];
        let hasResponsive = false;
        parsed.walk((node) => {
          const n: any = node as any;
          if (n.type === "function" && bpNames.has(n.value)) {
            hasResponsive = true;
            const bp = n.value as string;
            // Ensure functions inside the responsive value are also normalized
            const raw = valueParser.stringify(n.nodes).trim();
            const resolvedRaw = resolveValueForBp(raw, bp);
            const valueString = rewriteFuncs(resolvedRaw, (decl as any).prop);
            bpValues.push({ bp, text: valueString });
            n.type = "word";
            n.value = "";
          }
        });

        if (!hasResponsive) {
          decl.value = parsed.toString().replace(/\s+/g, " ").trim();
          return;
        }

        const present = bpValues
          .map((p) => ({ ...p, px: bps[p.bp] }))
          .sort((a, b) => a.px! - b.px!);
        const base = present[0];
        const others = present.slice(1);

        const nonBp = parsed.toString().replace(/\s+/g, " ").trim();
        const baseOut = base && base.text ? rewriteFuncs(base.text) : nonBp;
        decl.value = baseOut;

        const parentNode = decl.parent;
        if (!parentNode || parentNode.type !== "rule") {
          const parentFallback: any = parentNode;
          const rootFallback =
            typeof parentFallback?.root === "function"
              ? parentFallback.root()
              : root;
          others.forEach(({ bp, text }) => {
            const bpPx = bps[bp];
            if (typeof bpPx !== "number" || Number.isNaN(bpPx)) return;
            const at = postcss.atRule({
              name: "media",
              params: `(min-width: ${bpPx}px)`,
            });
            const cloned = parentFallback?.clone
              ? parentFallback.clone({ nodes: [] })
              : postcss.rule();
            cloned.append({ prop: decl.prop, value: text });
            (at as any).append(cloned);
            if (
              parentFallback &&
              parentFallback !== rootFallback &&
              typeof rootFallback?.insertAfter === "function"
            ) {
              rootFallback.insertAfter(parentFallback, at as any);
            } else if (typeof rootFallback?.append === "function") {
              rootFallback.append(at as any);
            }
          });
          return;
        }

        const parentRule = parentNode as Rule;
        const rootNode = parentRule.root();
        let bucket = mediaRuleCache.get(parentRule);
        if (!bucket) {
          bucket = new Map<string, Rule>();
          mediaRuleCache.set(parentRule, bucket);
        }

        others.forEach(({ bp, text }) => {
          const bpPx = bps[bp];
          if (typeof bpPx !== "number" || Number.isNaN(bpPx)) return;
          let targetRule = bucket.get(bp);
          if (!targetRule) {
            const at = postcss.atRule({
              name: "media",
              params: `(min-width: ${bpPx}px)`,
            });
            const cloned = parentRule.clone({ nodes: [] });
            at.append(cloned);
            const lastInserted = lastMediaByRule.get(parentRule);
            const parentContainer = parentRule.parent || rootNode;
            
            if (lastInserted) {
              parentContainer.insertAfter(lastInserted, at);
            } else {
              parentContainer.insertAfter(parentRule, at);
            }
            lastMediaByRule.set(parentRule, at);
            bucket.set(bp, cloned);
            targetRule = cloned;
          }
          targetRule.append({ prop: decl.prop, value: rewriteFuncs(text) });
        });
      });

      // $var substitutions across all declarations
      const varNames = Object.keys(vars);
      if (varNames.length > 0) {
        const varRefRE = /\$([a-zA-Z_][\w-]*)/g;
        root.walkDecls((decl) => {
          if (typeof decl.value !== "string") return;
          decl.value = decl.value.replace(varRefRE, (_m, name) => {
            return Object.prototype.hasOwnProperty.call(vars, name)
              ? vars[name]
              : _m;
          });
        });
      }

      // Final safety pass: resolve any remaining palette()/space() calls that
      // might appear in non-responsive declarations or media clones.
      root.walkDecls((decl) => {
        if (typeof decl.value !== "string") return;
        const parsed = valueParser(decl.value);
        let changed = false;
        parsed.walk((node) => {
          const n: any = node as any;
          if (n.type === "function" && n.value === "palette") {
            const inner = valueParser.stringify(n.nodes).trim();
            const parts = inner
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const token = parts[0] || "";
            const normalized = normalizeTokenPath(token);
            const alphaRaw = parts[1];
            if (alphaRaw != null && alphaRaw !== "") {
              const a = Math.max(0, Math.min(1, Number(alphaRaw)));
              const pct = Math.round(a * 100);
              n.type = "word";
              n.value = `color-mix(in srgb, ${toVar(normalized)} ${pct}%, transparent)`;
              changed = true;
              return;
            }
            n.type = "word";
            n.value = toVar(normalized);
            changed = true;
            return;
          }
          if (n.type === "function" && n.value === "color") {
            const inner = valueParser.stringify(n.nodes).trim();
            const normalized = normalizeTokenPath(inner);
            n.type = "word";
            n.value = toColorVar(normalized);
            changed = true;
            return;
          }
          if (n.type === "function" && n.value === "space") {
            const inner = valueParser.stringify(n.nodes).trim();
            let idx = inner;
            if (
              (idx.startsWith('"') && idx.endsWith('"')) ||
              (idx.startsWith("'") && idx.endsWith("'"))
            ) {
              idx = idx.slice(1, -1);
            }
            const numLike = idx.trim();
            if (/^\d{1,3}$/.test(numLike)) {
              n.type = "word";
              n.value = toSpaceVar(numLike);
              changed = true;
              return;
            }
          }
        });
        if (changed) {
          decl.value = parsed.toString().replace(/\s+/g, " ").trim();
        }
      });
    },
  };
}

(uxdslPlugin as any).postcss = true;

export = uxdslPlugin;
