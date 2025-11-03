import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import uxdsl from 'vite-plugin-uxdsl';

export default defineConfig({
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
      // themeVar: (path) => `var(--${path.replace(/\./g, '-')})`,
    }),
  ],
});
