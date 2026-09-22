import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import uxdsl from 'vite-plugin-uxdsl';

export default defineConfig({
  // `postcss-uxdsl`/`vite-plugin-uxdsl` are `file:` monorepo deps, symlinked
  // into node_modules. Rollup's production build resolves a symlink to its
  // real path before deciding whether a module is "in node_modules" (dev's
  // esbuild pre-bundling is more permissive and doesn't hit this) — the
  // real path here is packages/postcss-uxdsl/dist/..., which contains no
  // "node_modules" segment, so @rollup/plugin-commonjs's default
  // `include: [/node_modules/]` never matches it and its CJS `exports.x = …`
  // is left unconverted, parsed as plain (named-export-less) ESM. Resolving
  // symlinked deps at their apparent node_modules path instead of their
  // real path is the standard fix for this exact monorepo-symlink case.
  resolve: {
    preserveSymlinks: true,
  },
  optimizeDeps: {
    include: ['postcss-uxdsl/ds-runtime'],
  },
  plugins: [
    react(),
    // Configure custom breakpoints via array for clarity/order (optional)
    uxdsl({
      breakpoints: [
        ['xs', 0],
        ['sm', 480],
        ['md', 790],
        ['lg', 1024],
        ['xl', 1280],
      ],
      // src/**/*.uxdsl references these on top of DEFAULT_THEME's own
      // primary/surface/neutral/error (deep-merged in, not replacing them —
      // see postcss-uxdsl's resolveTheme): a "light" family for the page's
      // light background/text, a "light" variant on primary for the
      // responsive showcase gradient, and full main/dark/contrast secondary/
      // tertiary families (Button/Input/Surface tone generation needs all
      // three on any family passed as a tone argument, e.g.
      // `@ds-button(contained secondary)`). theme-def.uxdsl's own
      // `:root { --primary-main: ... }` overrides predate the
      // --uxdsl__<family>__<key> namespace migration and no longer apply
      // to anything the compiler emits.
      theme: {
        palette: {
          light: { main: '#ffffff', contrast: '#102a43' },
          primary: { light: '#c084fc' },
          secondary: { main: '#0891b2', dark: '#155e75', contrast: '#ffffff' },
          tertiary: { main: '#d97706', dark: '#92400e', contrast: '#ffffff', light: '#fcd34d' },
        },
      },
    }),
  ],
});
