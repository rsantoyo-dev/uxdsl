# Quick Start Guide

Welcome to **UXDSL**! This guide will help you get up and running with UXDSL in your project. We recommend using **Vite** for the best development experience.

## 1. Installation

First, install the necessary packages. You'll need the Vite plugin and the core library.

```bash
npm install vite-plugin-uxdsl uxdsl-core --save-dev
```

## 2. Configuration

Configure Vite to use the UXDSL plugin. Open your `vite.config.js` or `vite.config.ts` and add the plugin to the `plugins` array.

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import vitePluginUxdsl from 'vite-plugin-uxdsl';

export default defineConfig({
  plugins: [
    vitePluginUxdsl({
      // Optional: Define your project's breakpoints here
      breakpoints: {
        xs: 0,
        sm: 480,
        md: 768,
        lg: 1024,
        xl: 1280,
      },
    }),
  ],
});
```

## 3. Create a Theme (Optional but Recommended)

UXDSL shines when you define a design system. Create a file named `theme.uxdsl` (or include it in your main entry) to define your tokens.

```css
/* src/theme.uxdsl */
@theme {
  /* Colors */
  color-primary: #3b82f6;
  color-secondary: #10b981;

  /* Spacing */
  space-1: 0.25rem;
  space-2: 0.5rem;
  space-4: 1rem;

  /* Radius */
  radius-md: 8px;
  
  /* Component Packs */
  button-primary: {
    bg: var(--color-primary);
    color: white;
    padding: var(--space-2) var(--space-4);
    radius: var(--radius-md);
    
    :hover {
      opacity: 0.9;
    }
  }
}
```

## 4. Write Your Styles

Now, create a component style file, e.g., `Button.uxdsl`. You can use the variables and mixins defined in your theme.

```css
/* src/components/Button.uxdsl */

.btn {
  /* Use the smart mixin defined in your theme */
  @ds-button primary;
  
  /* Or write standard CSS with responsive utilities */
  font-size: xs(14px) md(16px);
  width: xs(100%) md(auto);
}
```

## 5. Import in Your App

Finally, import the `.uxdsl` files in your JavaScript/TypeScript components.

```javascript
// src/components/Button.jsx
import './Button.uxdsl';

export function Button() {
  return <button className="btn">Click Me</button>;
}
```

## Next Steps

- Explore **[Smart Mixins](./smart-mixins.md)** to learn how to build complex interactive components.
- Learn about **[Responsive Functions](./responsiveness.md)** for inline media queries.
- Check out the **[Playground](https://uxdsl.vercel.app/)** to experiment live.
