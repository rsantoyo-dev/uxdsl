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
}

const DEFAULT_BPS: Record<string, number> = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

// Map palette(foo.bar|foo-bar) -> var(--dsl__palette__foo-bar)
const defaultThemeVar = (path: string) =>
  `var(--dsl__palette__${String(path).trim().replace(/\./g, "-")})`;

// Map space(2) -> var(--space-2)
const defaultSpaceVar = (index: string) =>
  `var(--space-${String(index).trim()})`;

// Map color(blue.500|blue-500) -> var(--dsl__color__blue-500)
const defaultColorVar = (path: string) =>
  `var(--dsl__color__${String(path).trim().replace(/\./g, "-")})`;

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
  (uxdslPlugin as any).__surfacePacks = GLOBAL_SURFACE_PACKS;

  const { map: bps } = normalizeBreakpoints(opts.breakpoints);
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
      const vars: Record<string, string> = Object.create(null);
      // Selector-scoped typography directives
      // Supports: @ds-typo(h1), @ds(h1), and @ds-h1 (no params)
      root.walkRules((rule) => {
        const applyTypo = (at: any, variantRaw: string) => {
          let tag = String(variantRaw || "").trim();
          // Strip optional wrapping quotes
          if (
            (tag.startsWith('"') && tag.endsWith('"')) ||
            (tag.startsWith("'") && tag.endsWith("'"))
          ) {
            tag = tag.slice(1, -1);
          }
          // Strip optional parentheses, e.g. "(h1)"
          if (tag.startsWith("(") && tag.endsWith(")")) {
            tag = tag.slice(1, -1).trim();
          }
          tag = tag.toLowerCase();
          const insert = (prop: string, value: string) => {
            (rule as any).insertBefore(at, { prop, value });
          };
          // Default block margin behavior for typographic elements
          // Use 'auto' per request (computes to 0 for top/bottom in most cases)
          insert("margin-block-start", "auto");
          insert("margin-block-end", "auto");
          switch (tag) {
            case "h1":
              insert("font-size", "var(--h1-size)");
              insert("font-weight", "var(--h1-weight, 700)");
              break;
            case "h2":
              insert("font-size", "var(--h2-size)");
              insert("font-weight", "var(--h2-weight, 700)");
              break;
            case "h3":
              insert("font-size", "var(--h3-size)");
              insert("font-weight", "var(--h3-weight, 600)");
              break;
            case "h4":
              insert("font-size", "var(--h4-size)");
              insert("font-weight", "var(--h4-weight, 600)");
              break;
            case "h5":
              insert("font-size", "var(--h5-size)");
              insert("font-weight", "var(--h5-weight, 600)");
              break;
            case "h6":
              insert("font-size", "var(--h6-size)");
              insert("font-weight", "var(--h6-weight, 600)");
              break;
            case "p":
              insert("font-size", "var(--p-size)");
              insert("line-height", "var(--p-line, normal)");
              insert("font-weight", "var(--p-weight, 400)");
              break;
            case "span":
              insert("font-size", "var(--span-size)");
              insert("font-weight", "var(--span-weight, 400)");
              break;
            case "small":
              insert("font-size", "var(--small-size)");
              break;
            case "caption":
              insert("font-size", "var(--caption-size)");
              insert("opacity", "var(--caption-opacity, 0.8)");
              break;
            case "pre":
            case "code":
              insert("font-family", "var(--font-code), monospace");
              insert("font-size", "var(--pre-size)");
              break;
            default:
              break;
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
              (root as any).__surfacePacks = (root as any).__surfacePacks || Object.create(null);
              (root as any).__surfacePacks[vname] = parsed.base;
              (GLOBAL_SURFACE_PACKS as any)[vname] = parsed.base;
            }
          }
        });

        // Also support rule-form packs: `button-contained: { ... }` and `surface-contained: { ... }`
        at.walkRules((r) => {
          const sel = String((r as any).selector || "").trim();
          const mBtn = sel.match(/^button-([a-zA-Z][\w-]*):?$/);
          const mSurf = sel.match(/^surface-([a-zA-Z][\w-]*):?$/);
          if (!mBtn && !mSurf) return;
          const isSurface = !!mSurf;
          const vname = (mBtn ? mBtn[1] : mSurf![1]).toLowerCase();
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

      // Helper to compute surface base props for a given variant/tone/size
      function computeSurfaceBase(
        packsObj: any,
        variant: string,
        toneFamily: string,
        sizeToken?: string
      ): Record<string, string> {
        const base = (packsObj && (packsObj[variant] || packsObj["contained"])) || {};
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
        // @ds-surface(variant [tone])
        rule.walkAtRules("ds-surface", (at) => {
          let inner = String((at.params || "").trim());
          if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'"))) inner = inner.slice(1, -1);
          if (inner.startsWith("(") && inner.endsWith(")")) inner = inner.slice(1, -1).trim();
          const parts = inner.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
          const known = new Set(["contained", "outlined", "flat"]);
          let variant = (parts.find((p) => known.has(p.toLowerCase())) || "contained").toLowerCase();
          const toneToken = parts.find((p) => !known.has(p.toLowerCase()) && !/^\d+$/.test(p));
          const sizeToken = parts.find((p) => /^\d+$/.test(p));
          const toneFamily = toneToken ? (() => { let fam = normalizeTokenPath(toneToken); if (fam.includes("-")) fam = fam.split("-")[0]; return fam; })() : "";
          const packs: any = (root as any).__surfacePacks || (uxdslPlugin as any).__surfacePacks || {};
          const props = computeSurfaceBase(packs, variant, toneFamily, sizeToken);
          const insert = (prop: string, value: string) => { (rule as any).insertBefore(at, { prop, value }); };
          Object.keys(props).forEach((k) => insert(k, props[k]!));
          at.remove();
        });

        // @ds-button(variant?) using packs
        rule.walkAtRules("ds-button", (at) => {
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
          const parts = inner.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
          const known = new Set(["contained", "outlined", "flat"]);
          let variant = (parts.find((p) => known.has(p.toLowerCase())) || "contained").toLowerCase();
          const toneToken = parts.find((p) => !known.has(p.toLowerCase()) && !/^\d+$/.test(p));
          const sizeToken = parts.find((p) => /^\d+$/.test(p));
          const toneFamily = toneToken ? (() => { let fam = normalizeTokenPath(toneToken); if (fam.includes("-")) fam = fam.split("-")[0]; return fam; })() : "";
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
          const wrapBtnVar = (
            k: string,
            raw: string,
            stateKey?: string
          ): string => {
            const suffix = stateKey
              ? stateKey === "focusvisible"
                ? "-focus-visible"
                : `-${stateKey}`
              : "";
            if (k === "bg") return `var(--ds-btn-bg${suffix}, ${raw})`;
            if (k === "color") return `var(--ds-btn-fg${suffix}, ${raw})`;
            if (k === "border") return `var(--ds-btn-border${suffix}, ${raw})`;
            return raw;
          };
          const applyPack = (
            p: Record<string, string>,
            targetRule: Rule | null = null,
            stateKey?: string
          ) => {
            const map: Array<[keyof typeof p, string]> = [
              ["padding" as any, "padding"],
              ["radius" as any, "border-radius"],
              ["bg" as any, "background"],
              ["color" as any, "color"],
              ["border" as any, "border"],
            ];
            map.forEach(([k, css]) => {
              const val: any = (p as any)[k];
              if (typeof val === "string" && val) {
                const out =
                  k === ("bg" as any) ||
                  k === ("color" as any) ||
                  k === ("border" as any)
                    ? wrapBtnVar(String(k), val, stateKey)
                    : val;
                insert(css, out, targetRule);
              }
            });
          };
          function emitStateRules(
            states: Record<string, Record<string, string>> | undefined
          ) {
            if (!states) return;
            const sel = String((rule as any).selector || "");
            const baseSels = sel
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const stateToSels: Record<string, string[]> = {
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
            Object.keys(states).forEach((kRaw) => {
              const key = kRaw
                .replace(/^&/, "")
                .replace(/^:/, "")
                .toLowerCase();
              const pseudos = stateToSels[key] || [":" + key];
              const decls = states[kRaw] || states[key] || {};
              pseudos.forEach((pz) => {
                const newSel = baseSels.map((s) => `${s}${pz}`).join(", ");
                const newRule = postcss.rule({ selector: newSel });
                applyPack(decls, newRule as any, key);
                (rule.parent as any).insertAfter(rule, newRule);
              });
            });
          }
          // Apply surface base first, then states from button pack
          const surfPacks: any = (root as any).__surfacePacks || (uxdslPlugin as any).__surfacePacks || {};
          const surfProps = computeSurfaceBase(surfPacks, variant, toneFamily, sizeToken);
          // Insert padding/border-radius directly; var-wrap color/bg/border
          if (surfProps["padding"]) insert("padding", surfProps["padding"]);
          if (surfProps["border-radius"]) insert("border-radius", surfProps["border-radius"]);
          if (surfProps["background"]) insert("background", `var(--ds-btn-bg, ${surfProps["background"]})`);
          if (surfProps["color"]) insert("color", `var(--ds-btn-fg, ${surfProps["color"]})`);
          if (surfProps["border"]) insert("border", `var(--ds-btn-border, ${surfProps["border"]})`);

          if (pack) {
            const st =
              pack.states && typeof pack.states === "object"
                ? (pack.states as any)
                : undefined;
            emitStateRules(st);
          } else {
            // Minimal fallback if no packs are defined
            insert("padding", "density(2)");
            insert("border-radius", "radius(2)");
            if (variant === "outlined") {
              insert("background", "transparent");
              insert("color", "palette(primary-main)");
              insert("border", "border(1, palette(primary-main))");
            } else if (variant === "flat") {
              insert("background", "transparent");
              insert("color", "palette(primary-main)");
              insert("border", "none");
            } else {
              insert("background", "palette(primary-main)");
              insert("color", "palette(primary-contrast)");
              insert("border", "none");
            }
          }
          // Optional inline tone mapping: second token adjusts CSS variables consumed by btn packs
          if (toneFamily) {
            const main = `palette(${toneFamily}-main)`;
            const dark = `palette(${toneFamily}-dark)`;
            const contrast = `palette(${toneFamily}-contrast)`;
            const insertVar = (name: string, value: string) => {
              (rule as any).insertBefore(at, { prop: `--${name}`, value });
            };
            if (variant === "outlined") {
              insertVar("ds-btn-bg", "transparent");
              insertVar("ds-btn-fg", main);
              insertVar("ds-btn-border", `1px solid ${main}`);
              insertVar("ds-btn-fg-hover", dark);
              insertVar("ds-btn-border-hover", `1px solid ${dark}`);
              insertVar("ds-btn-bg-selected", main);
              insertVar("ds-btn-fg-selected", contrast);
              insertVar("ds-btn-border-selected", `1px solid ${main}`);
            } else if (variant === "flat") {
              insertVar("ds-btn-bg", "transparent");
              insertVar("ds-btn-fg", main);
              insertVar("ds-btn-border", "none");
              insertVar("ds-btn-fg-hover", dark);
              insertVar("ds-btn-fg-selected", dark);
            } else {
              insertVar("ds-btn-bg", main);
              insertVar("ds-btn-fg", contrast);
              insertVar("ds-btn-border", "none");
              insertVar("ds-btn-bg-hover", dark);
              insertVar("ds-btn-fg-hover", contrast);
              insertVar("ds-btn-bg-selected", dark);
              insertVar("ds-btn-fg-selected", contrast);
            }
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
                const token =
                  densityTokens[String(base)] ||
                  GLOBAL_DENSITY_TOKENS[String(base)];
                if (token) {
                  node.type = "word";
                  node.value = token;
                  return;
                }
                const parts = ordered.map(
                  (bp, i) => `${bp.name}(space(${base + i}))`
                );
                node.type = "word";
                node.value = parts.join(" ");
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
            const normalized = normalizeTokenPath(inner);
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
            const valueString = rewriteFuncs(raw, (decl as any).prop);
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
            if (lastInserted) {
              (rootNode as Root).insertAfter(lastInserted, at);
            } else {
              (rootNode as Root).insertAfter(parentRule, at);
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
            const normalized = normalizeTokenPath(inner);
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
