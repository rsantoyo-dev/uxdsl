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
  const GLOBAL_DENSITY_TOKENS: Record<string, string> = (uxdslPlugin as any).__density || Object.create(null);
  const GLOBAL_RADIUS_TOKENS: Record<string, string> = (uxdslPlugin as any).__radii || Object.create(null);
  const GLOBAL_SHADOW_TOKENS: Record<string, string> = (uxdslPlugin as any).__shadows || Object.create(null);
  const GLOBAL_BORDER_TOKENS: Record<string, string> = (uxdslPlugin as any).__borders || Object.create(null);
  // Ensure the function object holds the same reference so subsequent
  // plugin instances see the accumulated tokens.
  (uxdslPlugin as any).__density = GLOBAL_DENSITY_TOKENS;
  (uxdslPlugin as any).__radii = GLOBAL_RADIUS_TOKENS;
  (uxdslPlugin as any).__shadows = GLOBAL_SHADOW_TOKENS;
  (uxdslPlugin as any).__borders = GLOBAL_BORDER_TOKENS;

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
      const densityTokens: Record<string, string> = Object.create(null);
      const radiusTokens: Record<string, string> = Object.create(null);
      const shadowTokens: Record<string, string> = Object.create(null);
      const borderTokens: Record<string, string> = Object.create(null);

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
        });
        // Remove @theme blocks from output
        at.remove();
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
          if (node.type === "function" && (node.value === "density" || node.value === "densities")) {
            const ordered = Object.keys(bps)
              .map((name) => ({ name, px: (bps as any)[name] as number }))
              .filter((it) => typeof it.px === "number" && !Number.isNaN(it.px))
              .sort((a, b) => a.px - b.px);

            const innerText = valueParser.stringify(node.nodes).trim();

            if (node.value === "density") {
              let idx = innerText;
              if ((idx.startsWith('"') && idx.endsWith('"')) || (idx.startsWith("'") && idx.endsWith("'"))) idx = idx.slice(1, -1);
              const base = parseInt(idx.trim(), 10);
              if (!Number.isNaN(base) && ordered.length > 0) {
                const token = densityTokens[String(base)]
                  || GLOBAL_DENSITY_TOKENS[String(base)];
                if (token) {
                  node.type = "word";
                  node.value = token;
                  return;
                }
                const parts = ordered.map((bp, i) => `${bp.name}(space(${base + i}))`);
                node.type = "word";
                node.value = parts.join(" ");
                return;
              }
            } else {
              const rawVals = innerText.split(",").map((s) => s.trim()).filter(Boolean);
              const steps: number[] = rawVals.map((s) => parseInt(s.replace(/[^-\d]/g, ""), 10)).filter((n) => !Number.isNaN(n));
              if (steps.length > 0 && ordered.length > 0) {
                const parts = ordered.map((bp, i) => {
                  const step = typeof steps[i] === "number" ? steps[i] : steps[steps.length - 1];
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
          if (node.type === "function" && (node.value === "radius" || node.value === "rounded")) {
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
            if ((idx.startsWith('"') && idx.endsWith('"')) || (idx.startsWith("'") && idx.endsWith("'"))) idx = idx.slice(1, -1);
            const n = parseInt(idx.trim(), 10);
            if (!Number.isNaN(n)) {
              const tok = radiusTokens[String(n)] || GLOBAL_RADIUS_TOKENS[String(n)];
              if (tok) {
                node.type = "word";
                node.value = tok;
                return;
              }
              // Fallback simple ramp
              const ordered = Object.keys(bps)
                .map((name) => ({ name, px: (bps as any)[name] as number }))
                .filter((it) => typeof it.px === "number" && !Number.isNaN(it.px))
                .sort((a, b) => a.px - b.px);
              if (ordered.length) {
                const parts = ordered.map((bp, i) => {
                  const base = Math.max(2, n * 2);
                  const step = i === 0 ? base : i === 1 ? Math.round(base * 2) : Math.round(base * 3);
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
          if (node.type === "function" && (node.value === "shadow" || node.value === "elevation")) {
            const innerText = valueParser.stringify(node.nodes).trim();
            let idx = innerText;
            if ((idx.startsWith('"') && idx.endsWith('"')) || (idx.startsWith("'") && idx.endsWith("'"))) idx = idx.slice(1, -1);
            const n = parseInt(idx.trim(), 10);
            if (!Number.isNaN(n)) {
              const tok = shadowTokens[String(n)] || GLOBAL_SHADOW_TOKENS[String(n)];
              if (tok) {
                node.type = "word";
                node.value = tok;
                return;
              }
              // Fallback mapping 1..5
              const fallbacks: Record<number, string> = {
                1: '0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)',
                2: '0 1px 2px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.12)',
                3: '0 2px 4px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.14)',
                4: '0 4px 6px rgba(0,0,0,0.08), 0 10px 15px rgba(0,0,0,0.16)',
                5: '0 10px 15px rgba(0,0,0,0.10), 0 20px 25px rgba(0,0,0,0.20)'
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
            const parts = innerText.split(',').map((s) => s.trim()).filter(Boolean);
            let idx = parts[0] || '';
            if ((idx.startsWith('"') && idx.endsWith('"')) || (idx.startsWith("'") && idx.endsWith("'"))) idx = idx.slice(1, -1);
            const n = parseInt(idx, 10);
            // Determine optional color/style args if provided
            const arg1 = parts[1] || '';
            const arg2 = parts[2] || '';
            const looksColor = (s: string) => /^(color\(|palette\(|var\(|#|rgb\(|hsl\()/i.test(s);
            const looksStyle = (s: string) => /^(solid|dashed|dotted|double|groove|ridge|inset|outset)$/i.test(s);
            const colorArg = looksColor(arg1) ? arg1 : looksColor(arg2) ? arg2 : '';
            const styleArg = looksStyle(arg1) ? arg1 : looksStyle(arg2) ? arg2 : 'solid';
            if (!Number.isNaN(n)) {
              const comp = borderTokens[String(n)] || GLOBAL_BORDER_TOKENS[String(n)];
              if (comp) {
                node.type = 'word';
                node.value = comp;
                return;
              }
              const width = `space(${n})`;
              const color = colorArg || 'color(gray.300)';
              node.type = 'word';
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
