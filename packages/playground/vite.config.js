import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import uxdsl from 'vite-plugin-uxdsl';

export default defineConfig({
  optimizeDeps: {
    include: ['postcss-uxdsl/runtime'],
  },
  plugins: [
    react(),
    // Configure custom breakpoints via array for clarity/order (optional)
    uxdsl({
      breakpoints: [
        ['xs', 0],
        ['sm', 480],
        ['md', 768],
        ['lg', 1024],
        ['xl', 1280],
      ],
      // Map palette(foo.bar|foo-bar) -> var(--foo-bar, var(--dsl__palette__foo-bar), var(--dsl__color__foo-bar))
      // Hyphen vars for DX; canonical prefixed vars as fallback
      themeVar: (path) => {
        const hy = String(path).replace(/\./g, '-');
        return `var(--${hy}, var(--dsl__palette__${hy}, var(--dsl__color__${hy})))`;
      },
      // Map color(foo.bar|foo-bar) -> var(--foo-bar, var(--dsl__color__foo-bar))
      colorVar: (path) => {
        const hy = String(path).replace(/\./g, '-');
        return `var(--${hy}, var(--dsl__color__${hy}))`;
      },
    }),
  ],
});
