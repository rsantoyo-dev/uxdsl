# postcss-uxdsl

> A PostCSS plugin for **UXDSL** — a lightweight, type-safe CSS DSL designed for modern design systems.

[![npm version](https://img.shields.io/npm/v/postcss-uxdsl.svg)](https://www.npmjs.com/package/postcss-uxdsl)
[![License](https://img.shields.io/npm/l/postcss-uxdsl.svg)](LICENSE)

**[Visit the Official Documentation & Playground](https://uxdsl.vercel.app/)**

---

## Overview

`postcss-uxdsl` transforms standard CSS into a powerful design system engine. It introduces a superset of CSS features specifically tailored for managing tokens, responsive styles, and component variants without the overhead of a runtime-in-JS solution.

### Key Features

- **💲 Native Variables**: Scoped `$var: value` syntax that compiles to standard CSS.
- **📱 Inline Responsiveness**: `xs()`, `sm()`, `md()`, `lg()`, `xl()` functions for declaring responsive values directly in properties.
- **🎨 Theme System**: A dedicated `@theme` block for defining design tokens (density, radius, shadows, borders).
- **🧩 Smart Mixins**: Built-in, configurable mixins for complex components like Buttons, Inputs, and Surfaces (`@ds-button`, `@ds-input`, `@ds-surface`).
- **Component Packs**: Define component variants (e.g., `primary`, `outlined`) directly in your theme and consume them via mixins.

---

## Installation

```bash
npm install postcss-uxdsl --save-dev
```

## Configuration

Add `postcss-uxdsl` to your `postcss.config.js`:

```javascript
module.exports = {
  plugins: [
    require('postcss-uxdsl')({
      // Optional: Custom breakpoints (defaults shown)
      breakpoints: {
        xs: 0,
        sm: 480,
        md: 768,
        lg: 1024,
        xl: 1280,
      },
      // Optional: Custom theme variable resolver
      themeVar: (path) => `var(--ds__palette__${path.replace(/\./g, '-')})`
    })
  ]
}
```

---

## Core Concepts

### 1. Variables

Define variables with `$` syntax. These are compiled away or transformed, keeping your output clean.

```css
.card {
  $bg-color: #fff;
  background: $bg-color;
}
```

### 2. Inline Responsiveness

Stop writing verbose `@media` queries for single property changes. Use responsive functions directly in your values.

```css
.container {
  /* 100% on mobile, 50% on tablet, 33% on desktop */
  width: xs(100%) md(50%) lg(33%);
  
  /* Stack vertically on mobile, row on tablet */
  flex-direction: xs(column) md(row);
}
```

### 3. Theme Functions

Access your design tokens easily with helper functions.

- `palette(color.shade)`: Access color palette tokens.
- `space(n)`: Access spacing tokens (e.g., `space(4)` -> `1rem`).
- `radius(n)`: Access border-radius tokens.
- `shadow(n)`: Access box-shadow tokens.

```css
.btn {
  color: palette(primary-main);
  padding: space(2) space(4);
  border-radius: radius(md);
  box-shadow: shadow(sm);
}
```

---

## Theming System

The `@theme` block is a special construct where you define the "DNA" of your design system. These definitions are global and drive the behavior of Smart Mixins.

### Defining Tokens

```css
@theme {
  /* Density tokens (spacing/sizing multipliers) */
  density-1: 0.75;
  density-2: 1;
  density-3: 1.25;

  /* Radius tokens */
  radius-sm: 4px;
  radius-md: 8px;
  radius-lg: 16px;

  /* Shadow tokens */
  shadow-sm: 0 1px 2px rgba(0,0,0,0.1);
  shadow-md: 0 4px 6px rgba(0,0,0,0.1);
}
```

### Component Packs

Define the look and feel of your components (Buttons, Inputs, Surfaces) for different variants.

```css
@theme {
  /* Define a 'primary' button variant */
  button-primary: {
    bg: palette(blue.600);
    color: white;
    radius: radius(md);
    padding: space(2) space(4);
    
    /* State styles */
    :hover {
      bg: palette(blue.700);
    }
    :active {
      transform: translateY(1px);
    }
  }

  /* Define an 'outlined' input variant */
  input-outlined: {
    border: 1px solid palette(gray.300);
    bg: transparent;
    radius: radius(sm);
    
    :focus {
      border-color: palette(blue.500);
      shadow: 0 0 0 3px palette(blue.100);
    }
  }
}
```

---

## Smart Mixins

UXDSL provides powerful "Smart Mixins" that automatically consume your Theme Packs.

### `@ds-button`

Generates a complete button style based on a variant defined in your theme.

```css
.my-button {
  /* Applies the 'primary' variant styles defined in @theme */
  @ds-button primary; 
  
  /* You can override properties locally */
  width: 100%;
}
```

### `@ds-input`

Generates form input styles, handling states like `:focus`, `:disabled`, and validation states automatically.

```css
.text-field {
  @ds-input outlined;
}
```

### `@ds-surface`

Creates container styles (cards, panels, modals) with consistent background, border, and shadow handling.

```css
.card {
  @ds-surface elevated;
}
```

---

## License

MIT © [Ricardo Santoyo](https://github.com/rsantoyo-dev)
