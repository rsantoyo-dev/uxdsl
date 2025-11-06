// PostCSS plugin for a tiny UX DSL (TypeScript)
// Features:
// - Root-level "$var: value;" variable declarations
// - $var substitutions inside declaration values
// - theme(path.to.token) / palette(path-to-token) -> CSS var mapping
// - Responsive value functions: xs(...), sm(...), md(...), lg(...), xl(...)

import type { AtRule, Declaration, Result, Root } from 'postcss';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';

type BreakpointSpec = Record<string, number> | Array<[string, number]> | Array<{ name: string; min?: number; px?: number }>;

interface UxDslOptions {
  breakpoints?: BreakpointSpec;
  themeVar?: (path: string) => string;
}

const DEFAULT_BPS: Record<string, number> = { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 };

// Map theme(foo.bar|foo-bar) -> var(--dsl__theme__foo-bar)
const defaultThemeVar = (path: string) => `var(--dsl__theme__${String(path).trim().replace(/\./g, '-')})`;

function normalizeBreakpoints(input?: BreakpointSpec) {
  if (!input) {
    const ordered = Object.entries(DEFAULT_BPS).map(([n, px]) => ({ name: n, px }));
    return { map: { ...DEFAULT_BPS }, ordered };
  }
  if (Array.isArray(input)) {
    const entries = input.map((it) => Array.isArray(it)
      ? { name: it[0], px: Number(it[1]) }
      : { name: it.name, px: Number(it.min ?? (it as any).px) });
    const map: Record<string, number> = {};
    entries.forEach(({ name, px }) => { if (name) map[name] = px; });
    const ordered = entries.slice().sort((a, b) => a.px - b.px);
    return { map, ordered };
  }
  const map: Record<string, number> = { ...(input as Record<string, number>) };
  const ordered = Object.keys(map).map((k) => ({ name: k, px: Number(map[k]) })).sort((a, b) => a.px - b.px);
  return { map, ordered };
}

function normalizeTokenPath(input: string): string {
  if (!input) return '';
  let s = String(input).trim();
  // Strip wrapping quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  // Normalize separators to hyphen
  s = s.replace(/[\.\s_]+/g, '-');
  // Default shade to '-main' if only a family name is provided
  if (!s.includes('-')) s = `${s}-main`;
  return s;
}

function uxdslPlugin(opts: UxDslOptions = {}) {
  const { map: bps } = normalizeBreakpoints(opts.breakpoints);
  const toVar = typeof opts.themeVar === 'function' ? opts.themeVar : defaultThemeVar;
  const bpNames = new Set(Object.keys(bps));

  return {
    postcssPlugin: 'postcss-uxdsl',
    Once(root: Root) {
      const vars: Record<string, string> = Object.create(null);

      // Collect root-level $vars and remove the declarations
      root.each((node) => {
        if (node.type === 'decl' && typeof (node as Declaration).prop === 'string' && (node as Declaration).prop.startsWith('$')) {
          const d = node as Declaration;
          const name = d.prop.slice(1);
          vars[name] = d.value as string;
          d.remove();
        }
      });

      // Walk declarations to handle theme()/palette() and responsive bp(...) values
      root.walkDecls((decl) => {
        if (typeof decl.value !== 'string') return;

        const parsed = valueParser(decl.value);
        const bpValues: Array<{ bp: string; text: string; px?: number }> = [];
        let hasResponsive = false;

        parsed.walk((node) => {
          const n: any = node as any;
          // theme(foo.bar) or palette(foo-bar) -> CSS var
          if (n.type === 'function' && (n.value === 'theme' || n.value === 'palette')) {
            const inner = valueParser.stringify(n.nodes).trim();
            const normalized = normalizeTokenPath(inner);
            n.type = 'word';
            n.value = toVar(normalized);
            return;
          }

          // xs(...), md(...), etc...
          if (n.type === 'function' && bpNames.has(n.value)) {
            hasResponsive = true;
            const bp = n.value as string;
            const valueString = valueParser.stringify(n.nodes).trim();
            bpValues.push({ bp, text: valueString });
            n.type = 'word';
            n.value = '';
          }
        });

        if (!hasResponsive) {
          // theme()/palette() may have been rewritten above
          decl.value = parsed.toString().replace(/\s+/g, ' ').trim();
          return;
        }

        const present = bpValues.map((p) => ({ ...p, px: bps[p.bp] })).sort((a, b) => (a.px! - b.px!));
        const base = present[0];
        const others = present.slice(1);

        const nonBp = parsed.toString().replace(/\s+/g, ' ').trim();
        decl.value = (base && base.text) ? base.text : nonBp;

        const parentRule = decl.parent! as any;
        const rootNode = (parentRule as any).root();
        others.forEach(({ bp, text }) => {
          const at = postcss.atRule({ name: 'media', params: `(min-width: ${bps[bp]}px)` });
          const cloned = (parentRule as any).clone({ nodes: [] });
          cloned.append({ prop: decl.prop, value: text });
          (at as any).append(cloned);
          (rootNode as any).insertAfter(parentRule, at as any);
        });
      });

      // $var substitutions across all declarations
      const varNames = Object.keys(vars);
      if (varNames.length > 0) {
        const varRefRE = /\$([a-zA-Z_][\w-]*)/g;
        root.walkDecls((decl) => {
          if (typeof decl.value !== 'string') return;
          decl.value = decl.value.replace(varRefRE, (_m, name) => {
            return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : _m;
          });
        });
      }
    },
  };
}

(uxdslPlugin as any).postcss = true;

export = uxdslPlugin;
