// PostCSS plugin for a tiny UX DSL
// Features:
// - Root-level "$var: value;" variable declarations
// - $var substitutions inside declaration values
// - theme(path.to.token) -> var(--path-to-token)
// - Responsive value functions: xs(...), sm(...), md(...), lg(...), xl(...)
//   Example: gap: xs(6px) lg(20px);

const postcss = require('postcss');
const valueParser = require('postcss-value-parser');

const DEFAULT_BPS = { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 };
const defaultThemeVar = (path) => `var(--${String(path).trim().replace(/\./g, '-')})`;

function normalizeBreakpoints(input) {
  if (!input) return { map: { ...DEFAULT_BPS }, ordered: Object.entries(DEFAULT_BPS).map(([n, px]) => ({ name: n, px })) };
  if (Array.isArray(input)) {
    // Accept [ [name, px], ... ] or [ { name, min }, ... ]
    const entries = input.map((it) => Array.isArray(it) ? { name: it[0], px: Number(it[1]) } : { name: it.name, px: Number(it.min ?? it.px) });
    const map = {};
    entries.forEach(({ name, px }) => { if (name) map[name] = px; });
    const ordered = entries.slice().sort((a, b) => a.px - b.px);
    return { map, ordered };
  }
  // Object map
  const map = { ...input };
  const ordered = Object.keys(map).map((k) => ({ name: k, px: Number(map[k]) })).sort((a, b) => a.px - b.px);
  return { map, ordered };
}

module.exports = function uxdslPlugin(opts = {}) {
  const { map: bps } = normalizeBreakpoints(opts.breakpoints || {});
  const toVar = typeof opts.themeVar === 'function' ? opts.themeVar : defaultThemeVar;
  const bpNames = new Set(Object.keys(bps));

  return {
    postcssPlugin: 'postcss-uxdsl',
    Once(root) {
      const vars = Object.create(null);

      // Collect root-level $vars and remove the declarations
      root.each((node) => {
        if (node.type === 'decl' && typeof node.prop === 'string' && node.prop.startsWith('$')) {
          const name = node.prop.slice(1);
          vars[name] = node.value;
          node.remove();
        }
      });

      // Walk declarations to handle theme() and responsive bp(...) values
      root.walkDecls((decl) => {
        if (typeof decl.value !== 'string') return;

        const parsed = valueParser(decl.value);
        const bpValues = [];
        let hasResponsive = false;

        parsed.walk((node) => {
          // theme(foo.bar) -> var(--foo-bar)
          if (node.type === 'function' && node.value === 'theme') {
            const inner = valueParser.stringify(node.nodes).trim();
            node.type = 'word';
            node.value = toVar(inner);
            return;
          }

          // xs(...), md(...), etc...
          if (node.type === 'function' && bpNames.has(node.value)) {
            hasResponsive = true;
            const bp = node.value;
            const valueString = valueParser.stringify(node.nodes).trim();

            // Store the pair then remove this function node from the base value
            bpValues.push({ bp, text: valueString });
            node.type = 'word';
            node.value = '';
          }
        });

        if (!hasResponsive) {
          // theme() may have been rewritten above
          decl.value = parsed.toString().replace(/\s+/g, ' ').trim();
          return;
        }

        // Determine base value: pick the smallest bp present (usually xs)
        const present = bpValues
          .map((p) => ({ ...p, px: bps[p.bp] }))
          .sort((a, b) => a.px - b.px);

        const base = present[0];
        const others = present.slice(1);

        // Base decl value: prefer the smallest bp value
        const nonBp = parsed.toString().replace(/\s+/g, ' ').trim();
        decl.value = (base && base.text) ? base.text : nonBp;

        // For each remaining bp, clone the rule into a media query
        const parentRule = decl.parent;
        const rootNode = parentRule.root();
        others.forEach(({ bp, text }) => {
          const at = postcss.atRule({ name: 'media', params: `(min-width: ${bps[bp]}px)` });
          const cloned = parentRule.clone({ nodes: [] });
          cloned.append({ prop: decl.prop, value: text });
          at.append(cloned);
          rootNode.insertAfter(parentRule, at);
        });
      });

      // $var substitutions across all declarations
      const varNames = Object.keys(vars);
      if (varNames.length > 0) {
        const varRefRE = /\$([a-zA-Z_][\w-]*)/g;
        root.walkDecls((decl) => {
          if (typeof decl.value !== 'string') return;
          decl.value = decl.value.replace(varRefRE, (m, name) => {
            return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m;
          });
        });
      }
    },
  };
};

module.exports.postcss = true;
