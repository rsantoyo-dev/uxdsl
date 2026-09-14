# UXDSL — guide for AI agents

Use this guide when generating or modifying UI with UXDSL, or contributing to
UXDSL itself. Read the consuming project's instructions and active configuration
first. Examples below are illustrative theme excerpts, not universal defaults.
Check the installed package version before relying on an API.

## Core principle and responsibilities

**Preserve intent, not just the current computed value.**

UXDSL builds on standard CSS. The theme JSON defines shared design decisions;
components select configured tokens and roles; the compiler and runtime turn
those decisions into CSS. Native CSS remains available for intentional exceptions
and finer control. UXDSL does not replace semantic HTML or application logic.

| Primitive | Responsibility | Component use |
| --- | --- | --- |
| Spacing | Foundational spacing values | `space(n)` for intentionally stable spacing |
| Density | Responsive spacing built from the spacing scale | Prefer `density(n)` for component spacing |
| Colors | Reusable color collection | `color(token)` for an intentional color identity |
| Palette | Semantic interface color roles | Prefer `palette(role.variant)` for semantic UI |
| Breakpoints | Shared viewport transition thresholds | Named responsive declarations for local layout behavior |
| Borders | Shared composite edge treatments | `border(n)`; explicit longhands for local overrides |
| Radii | Shared corner shapes and progressions | `radius(n)` or intentional built-in shape keywords |
| Shadows | Shared visual depth and inset treatments | `shadow(key)` / `elevation(key)` for box shadows |
| Typography | Shared text roles and their responsive behavior | `@ds-typo(role)`; HTML retains document semantics |

A matching value does not imply a matching responsibility. Do not replace:

- Density with Spacing because they match at the current breakpoint.
- Palette with a Color or literal because they currently look identical.
- Typography with a fixed font size because it matches the current screen.

## Process before changing UI

1. Locate the active theme JSON and how the application passes it to PostCSS or
   the runtime. Inspect overrides, modes and existing component conventions.
2. Read relevant definitions and dependencies: `spacing`, `densities`, `colors`,
   `palette`, `breakpoints`, `fonts`, and `typography_details`.
3. Decide whether the request concerns one component, a shared role/progression,
   a foundational value, or a global threshold. Trace affected consumers.
4. Reuse a suitable existing token. Never reference an undefined token or assume
   a numeric key is a pixel count, multiplier, or another framework's scale.
5. For a local change, select a suitable token or an intentional local exception.
   Edit shared definitions only when their consumers should receive the change.
6. Compile or apply the updated configuration through the supported integration.
   Verify actual output and behavior; do not treat a screenshot as a contract.

## Spacing and Density

**Responsibility:** Spacing defines values; Density defines their shared responsive
progression. Density is the preferred component spacing abstraction.

```json
{
  "breakpoints": { "xs": 0, "md": 768, "xl": 1280 },
  "spacing": { "4": "0.75rem", "5": "1rem", "6": "1.5rem" },
  "densities": {
    "4": "xs(space(4)) md(space(5)) xl(space(6))"
  }
}
```

```css
.card {
  padding: density(4);
}
```

For this mapping, padding is `0.75rem` below 768px, `1rem` from 768px up to
1280px, and `1.5rem` at 1280px and above. It changes at thresholds, rather than
interpolating continuously. `density(4)` does not imply `space(4)` at every width.

- Choose padding for internal space, margin for external separation, and gap
  between items in a compatible layout.
- Prefer an appropriate existing Density token. Do not reproduce its mapping
  locally with `padding: xs(space(4)) md(space(5)) xl(space(6))` when the component
  should remain connected to that shared progression.
- Use `space(4)` directly when stable spacing across breakpoints is intentional.
  A `rem` value still depends on root font size; stable does not mean fixed pixels.
- If no Density fits, determine whether to define a new shared progression or use
  a deliberate local exception. Define any new token before referencing it.
- Changing `densities["4"]` changes its consumers after compilation/application.
  Changing `spacing["4"]` also affects direct references and any Density or
  Typography definitions that reference it. Check both dependency paths.

**Decision rule:** Prefer Density for component spacing. Use Spacing for
intentional stable values and CSS for finer control. Change shared definitions
only for intentional system-level changes.

Example request: “Make this card follow the application's responsive spacing.”
Inspect Density mappings, choose the appropriate token, apply it to the card,
and verify its entire progression. Do not simply copy the mobile padding.

## Colors and Palette

**Colors responsibility:** maintain the foundational color collection.
**Palette responsibility:** maintain semantic roles consumed by UI components.
Both live in the theme JSON.

```json
{
  "colors": {
    "blue": { "500": "#3b82f6", "700": "#1d4ed8" },
    "white": "#ffffff"
  },
  "palette": {
    "primary": {
      "main": "var(--ds__color__blue-700)",
      "contrast": "var(--ds__color__white)"
    }
  }
}
```

```css
.primary-action {
  background: palette(primary.main);
  color: palette(primary.contrast);
}
.blue-swatch {
  background: color(blue-700);
}
```

- Prefer Palette for interface roles. Primary does not inherently mean blue.
- Use Colors directly when a specific color identity is intentional, such as a
  swatch. Shade numbers are keys, not calculated brightness or contrast guarantees.
- Preserve explicit Palette-to-Color references. Matching hex values do not form
  a dependency. A literal Palette value is valid but does not track a Color token.
- Confirm roles, variants and referenced tokens exist. Inspect mode assignments
  and active overrides before changing them.
- A variant named `contrast` is not automatic accessibility validation. Check
  actual foreground/background pairs, states and themes.

**Colors decision rule:** modify a Color only when its direct and linked consumers
should receive the change. For “update blue-700 throughout the theme,” edit
`colors.blue["700"]`, preserve references, and verify swatches and linked roles.

**Palette decision rule:** reassign a role when its purpose stays the same but its
visual color should change. For “make primary actions blue-500,” change
`palette.primary.main` to `var(--ds__color__blue-500)` and keep components using
`palette(primary.main)`. Direct blue-700 consumers retain their token.

## Breakpoints

**Responsibility:** preserve shared responsive thresholds. Read configured widths;
do not infer devices or import another framework's defaults. These rules refer
to viewport width, not container width.

Using the illustrative breakpoints above:

```css
.layout {
  display: flex;
  flex-direction: xs(column) md(row);
  padding: density(4);
}
```

The direction is column below 768px and row at 768px and above. At 1280px it
remains row: the most recent applicable declaration persists until overridden.
The active viewport breakpoint and the rule supplying a property's value can differ.
Other CSS cascade rules still apply.

- Use configured names for explicit responsive layout changes. Define a base
  value when needed, and preserve intermediate rule persistence.
- Prefer Density for shared component spacing.
- For a local change, adjust component declarations using existing names or use
  an intentional local exception. Do not move a shared threshold for one card.
- Change a threshold only when all affected transitions should move. Inspect
  component declarations, Density mappings and Typography progressions.
- Define new thresholds through supported configuration before use. Check support
  in each installed integration; do not assume every editor accepts custom names.
- Omitted built-in breakpoint names can retain engine defaults. Inspect the
  effective map, not just the keys shown in a partial theme excerpt.

**Decision rule:** components define local behavior; breakpoints define when
transitions occur; Density defines shared responsive spacing.

For “move shared md to 800px,” confirm neighboring thresholds, change the source
configuration, apply it, and test 799px, 800px, 801px and a later breakpoint.

## Typography

**Responsibility: maintain shared text roles and their responsive behavior.**
Typography defines reusable visual text styles; components select a role without
hardcoding its resolved values. HTML preserves document semantics.

```json
{
  "breakpoints": { "xs": 0, "md": 768, "xl": 1280 },
  "spacing": { "7": "1.75rem", "8": "2rem", "10": "2.5rem" },
  "fonts": { "families": { "ui": "Inter, sans-serif" } },
  "typography_details": {
    "default": {
      "fontFamily": "var(--font-ui)",
      "fontWeight": "400",
      "lineHeight": "1.5"
    },
    "h1": {
      "fontSize": "xs(space(7)) md(space(8)) xl(space(10))",
      "fontWeight": "700",
      "lineHeight": "xs(1.2) md(1.3)"
    }
  }
}
```

```css
.page-title {
  @ds-typo(h1);
}
```

- Inspect `typography_details`, its `default` fields, referenced `fonts`, `spacing`
  and `breakpoints`. These are dependencies, not necessarily fields to edit.
- Reuse a configured role; do not invent roles or replace them with resolved CSS.
- Defaults supply missing fields. A role's own field replaces that default field
  as a whole; individual breakpoint expressions are not merged within that field.
- Responsive fields need a base value. In this example line height remains 1.3
  at xl because md supplies the most recent applicable value.
- Preserve units, nested CSS expressions, and token references. Do not convert a
  unitless line height into pixels. Typography may reference Spacing without
  following a Density mapping.
- Supported structured fields are `fontFamily`, `fontSize`, `lineHeight`,
  `fontWeight`, `letterSpacing`, `textTransform`, `textDecoration`, `fontStyle`,
  `marginBlockStart`, and `marginBlockEnd`. Values are nonempty strings.
- Keep heading levels appropriate to document hierarchy, independently of the
  visual role selected. Styling an element does not change its HTML semantics.
- Change a shared role only when all its consumers should change. Choose another
  configured role or intentional local CSS for an isolated exception.

**Decision rule:** choose the configured Typography role in the component. Define
and evolve its visual and responsive behavior in the theme. Use local CSS only
for intentional exceptions.

## Borders and Radii

**Borders responsibility:** maintain shared edge treatments (width, style, color).
**Radii responsibility:** maintain shared corner shapes and responsive behavior.

Define `borders` and `radii` as maps of token keys to CSS strings or responsive
progressions in the theme JSON. PostCSS, `generateThemeCss`, `generateEdgeCss` and
`inspectEdgeTheme` share the engine in `src/edges.ts`. Literal CSS values are still
supported; the former runtime copied them literally without resolving progressions.

```json
{
  "breakpoints": { "xs": 0, "md": 768 },
  "borders": { "1": "xs(1px solid #64748b) md(2px solid #64748b)" },
  "radii": { "2": "xs(8px) md(12px)" }
}
```

Legacy `border-n` and `radius-n` declarations in `@theme` remain supported in the
same compilation. JSON overrides matching legacy entries; both override shared
defaults. Import legacy definitions in each compilation that needs them. There
is no cross-compilation Borders/Radii cache. The default .uxdsl files are generated
from the shared module. Components consume `var(--border-n)`/`var(--radius-n)`;
replacing the generated theme stylesheet updates their responsive behavior.

```css
@theme {
  border-1: xs(1px solid #64748b) md(2px solid #64748b);
  radius-2: xs(8px) md(12px);
}
.card {
  border: border(1);
  border-radius: radius(2);
}
```

With xs=0 and md=768, these change from 1px edges/8px corners to 2px edges/12px
corners at 768px. The most recent applicable rule persists. Shared definitions
can reference configured `space()` and `palette()` values. Density is preferred
for component spacing, not automatically for border width or corner rounding.

- Reuse configured presets; numbers identify presets rather than pixel values.
  Preserve references instead of copying their current computed values.
- Change a shared definition only when all its consumers should follow. Edit
  source configuration and rebuild or use the runtime; preview edits do not save it.
- When a Border preset exists, optional arguments in
  `border(1, palette(primary.main), dashed)` are ignored in favor of that preset.
  For local changes, follow `border: border(1)` with explicit `border-color` or
  `border-style` longhands. The engine changes preset variables across thresholds; subsequent local
  longhands persist without repeating their breakpoint declarations. Do not
  alter the preset for a one-component request.
- `radius(pill)` and `radius(full)` both compile to `9999px`; `radius(circle)`
  compiles to `50%`. A circle needs equal width and height. `rounded()` is an alias.
  Keywords are built-ins, not editable numbered presets. Border radius alone
  does not clip child content.
- Define numbered presets before use. The default radius-0 is an explicit square corner (`0`). Unknown Border/Radius references now fail instead of inventing fallback
  values. Define the token before using it; do not rely on old fallback behavior.
- For local independent shapes, use intentional native CSS or per-corner values.
  Trace Spacing and Palette dependencies before changing foundational tokens.
- Verify just below/at/above configured thresholds, box sizing, content area,
  wrapping, nested corners, aspect ratios, overflow, states and focus indicators.
  Check edge contrast and other consumers of shared presets.
- The Borders demo consumes shared defaults, generation and inspection. Edits
  are scoped to the preview and invalid edits retain its last valid state.

**Borders decision rule:** choose a shared preset for a shared edge treatment;
use subsequent CSS longhands for intentional local exceptions.
**Radii decision rule:** choose a configured preset for shared shape behavior;
change the theme for shared progressions and native CSS for independent shapes.

Example: “Only the selected card should be dashed” means retain its Border and
add a local `border-style: dashed`. “All radius-2 cards should be rounder on
desktop” means update the shared radius-2 progression, rebuild and inspect every
consumer while preserving mobile behavior.

## Shadows

**Responsibility:** maintain shared shadow treatments and their responsive behavior.
Inspect the effective `shadows` map, breakpoints, legacy definitions and dependencies.
A preset key is not a pixel value, z-index or guaranteed strength ranking.

```json
{
  "breakpoints": { "xs": 0, "md": 768 },
  "shadows": {
    "0": "none",
    "2": "xs(0 2px 4px rgba(0, 0, 0, 0.12)) md(0 6px 16px rgba(0, 0, 0, 0.18))",
    "inset": "inset 0 1px 3px rgba(0, 0, 0, 0.2)"
  }
}
```

```css
.card { box-shadow: shadow(2); }
.inset-panel { box-shadow: elevation(inset); }
```

- Select an existing suitable preset. Preserve its reference instead of copying
  the current resolved value. Components consume `var(--shadow-key)`.
- Values can be static or responsive. Include a base value; the most recent
  applicable declaration persists until overridden. `elevation()` is an alias
  for `shadow()` and does not change stacking order.
- Preserve comma-separated layers, nested color functions, inset flags, units,
  and configured `space`, `density`, `color` or `palette` dependencies. Never
  parse a shadow list by splitting all commas. Not all box-shadow presets are
  valid for text-shadow or drop-shadow.
- Change a shared preset only for a shared change. For one component choose
  another appropriate preset, or use intentional native CSS. Default shadow-0
  is `none`; local `box-shadow: none` deliberately removes the effect.
- Define tokens before use. Missing references fail instead of using fallbacks.
- PostCSS, `generateThemeCss`, `generateShadowCss` and `inspectShadowTheme` share
  `src/shadows.ts` and the preset engine. The demo consumes that same engine.
  Defaults generate `default-shadows.uxdsl`; do not maintain a second default map.
- Legacy `shadow-n` in `@theme` remains supported in the same compilation. JSON
  overrides matching legacy definitions, followed by defaults. There is no
  process-global Shadow cache; import legacy definitions in each relevant build.
- Update source configuration and rebuild or replace managed runtime theme CSS.
  Preview edits are scoped and do not save JSON. Invalid edits preserve the last
  valid preview. Inspect actual CSS; validation is not a complete CSS validator.
- Check breakpoint boundaries, persistence at intermediate widths, multiple
  consumers, backgrounds/themes, states, ancestor clipping and focus visibility.

**Decision rule:** select a shared treatment in the component; define its visual
and responsive behavior in the theme; use native CSS for intentional exceptions.

Example: “less elevation on this card” means select a suitable existing preset
locally. “Soften shadow-2 throughout the product” means edit its definition,
preserve layers and references, apply the theme, and inspect all consumers.

## Build time, runtime and one source of truth

Edit source configuration, not generated CSS. Pass the same effective theme into
build/runtime integrations. PostCSS accepts a `theme` option. The runtime exposes
`generateThemeCss(theme)` from `postcss-uxdsl/ds-runtime` for theme CSS generation:

```ts
import { generateThemeCss } from 'postcss-uxdsl/ds-runtime'

// nextTheme is the effective configuration, not an unrelated partial patch.
// themeStyle is the application's existing managed <style> element.
const css = generateThemeCss(nextTheme)
themeStyle.textContent = css
```

Generate successfully before replacing the managed stylesheet. Do not continually
append stale overrides. Browser edits do not save the source JSON automatically.
Changing a token can update its consumers after the theme is applied; it does not
rewrite independently compiled component media rules automatically. Use the
supported breakpoint integration and verify actual stylesheet behavior.

The browser `breakpoints` API exposes `get()`, `update(name, width)` and
`subscribe(listener)`; the returned unsubscribe function is used for cleanup.
Its configuration notifications are not viewport-resize notifications.
Playground breakpoint simulation is inspection at a supplied width, not an actual
browser resize. Validate real layouts with a real viewport too.

Reuse shared language and Typography generators/resolvers. Do not add separate
parsers or hardcoded breakpoint behavior to the playground, runtime or editor.
This is an architectural rule, not a claim that every legacy default or token
family is already unified. Compiler success does not guarantee every reference,
CSS value or accessibility requirement was validated. Inspect actual output.

## Verification scenarios

- **Local change:** only intended components change; shared token values stay intact.
- **Shared mapping/role:** inspect all affected consumers, including nested links.
- **Responsive behavior:** test just below, at and just above each relevant
  threshold using valid nonnegative widths. Include intermediate breakpoints
  without overrides and confirm the supplying rule persists.
- **Spacing:** check padding, margin, gap, nesting, overflow and wrapping.
- **Colors:** verify direct and linked consumers, interaction states, modes,
  unrelated tokens and actual foreground/background contrast.
- **Typography:** check progression, wrapping, font loading, zoom, unitless line
  height and semantic heading hierarchy.
- **Runtime:** check theme switching, stylesheet replacement, persisted overrides,
  and agreement with build-time output for the same effective configuration.
- **Package integration:** verify the installed version exports the APIs used.
  Avoid stale compiled output masking source changes in a monorepo demo.

## Using this guide in another project

Installing UXDSL from npm does not guarantee an agent reads this repository's
`AGENTS.md`, and this root file is not automatically included in each npm package.
Agent discovery depends on the tool and project setup.

Copy this guide into a project-local reference such as `docs/uxdsl-agent-guide.md`
and add this instruction to the consuming project's existing `AGENTS.md` (or its
agent's supported instruction file), without overwriting project-specific rules:

> Before generating or modifying UXDSL UI, read `docs/uxdsl-agent-guide.md` and
> the active theme JSON. Preserve configured roles and responsive behavior.

Record the upstream commit and installed UXDSL version when copying. A link alone
may not be fetched automatically. A local copy is a snapshot; update it deliberately
when upgrading. The upstream guide is available at:
https://github.com/rsantoyo-dev/uxdsl/blob/main/AGENTS.md

## Maintaining this guide in the UXDSL repository

This file consolidates agent-facing guidance; it is not an automatic conversation
archive. When changing a primitive's behavior or its AI documentation, update the
relevant section here in the same change. Preserve distinct responsibilities and
replace obsolete instructions rather than accumulating contradictory rules.

Review these documentation sources for alignment:

- `packages/playground-nextjs/src/components/DensityAgentGuidance.tsx`
- `packages/playground-nextjs/src/components/SpacingAgentGuidance.tsx`
- `packages/playground-nextjs/src/components/SpacingPrinciple.tsx`
- `packages/playground-nextjs/src/components/ColorDocumentation.tsx`
- `packages/playground-nextjs/src/components/BreakpointDocumentation.tsx`
- `packages/playground-nextjs/src/components/TypographyDocumentation.tsx`
- `packages/playground-nextjs/src/components/BorderDocumentation.tsx`
- `packages/playground-nextjs/src/components/ShadowDocumentation.tsx`

For changes to shared engine behavior, run the relevant tests and `npm test` from
repository root. If language defaults or completion metadata change, run
`npm run generate:language` and include the generated artifacts. Do not hand-edit
those artifacts as another source of truth.

Surfaces, buttons and inputs have not yet been consolidated in
this guide. Before editing them, inspect their current source, configuration and
documentation. Add verified responsibilities, syntax and examples here as their
agent guides are formalized; do not infer unsupported APIs from another primitive.

Human documentation and playground: https://uxdsl.io/
Density reference: https://uxdsl.io/docs/densities
