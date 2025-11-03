// Minimal PostCSS plugin for a tiny UX DSL
// Features:
// - Root-level "$var: value;" variable declarations
// - $var substitutions inside declaration values

module.exports = function uxdslPlugin() {
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

      if (Object.keys(vars).length === 0) return;

      const varRefRE = /\$([a-zA-Z_][\w-]*)/g;

      root.walkDecls((decl) => {
        if (typeof decl.value !== 'string') return;
        decl.value = decl.value.replace(varRefRE, (m, name) => {
          return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m;
        });
      });
    },
  };
};

module.exports.postcss = true;

