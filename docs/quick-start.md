# Quick Start Guide

Welcome to **UXDSL**! This guide will help you get up and running with UXDSL in your project. We recommend using **Vite** for the best development experience.

## Starter Template

The fastest way to get started is using our official React starter template:

```bash
git clone https://github.com/rsantoyo-dev/uxdsl-react-starter.git my-uxdsl-app
cd my-uxdsl-app
npm install
npm run dev
```

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

### TypeScript Support

If you are using TypeScript, you may see an error like `Cannot find module './App.uxdsl'`. To fix this, create a declaration file (e.g., `src/uxdsl-env.d.ts`) with the following content:

```typescript
// src/uxdsl-env.d.ts
declare module '*.uxdsl' {
  const content: string;
  export default content;
}
```

## 3. Create a Theme (Optional but Recommended)

UXDSL shines when you define a design system. Create a file named `src/theme.uxdsl` to define your tokens.

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

Then, import this file in your application's entry point (usually `src/main.tsx`, `src/main.jsx`, or `src/App.tsx`).

```javascript
// src/main.tsx or src/App.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './theme.uxdsl'; // <--- Import your theme here

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
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

export function Button() {V
  return <button className="btn">Click Me</button>;
}
```

## Next Steps

- Explore **[Smart Mixins](./smart-mixins.md)** to learn how to build complex interactive components.
- Learn about **[Responsive Functions](./responsiveness.md)** for inline media queries.
- Check out the **[Playground](https://uxdsl.vercel.app/)** to experiment live.

## Troubleshooting

### "Cannot find module" Error

If you see `Cannot find module './file.uxdsl'`, ensure you have added the `src/uxdsl-env.d.ts` file as described in the **Configuration** section.

### Styles Not Applying

If your styles are not rendering:

1. **Restart the Dev Server**: Changes to `vite.config.js` require a restart.
2. **Check Imports**: Ensure you are importing the `.uxdsl` file in your component or entry file.
3. **Check Console**: Look for any build errors in the terminal.

