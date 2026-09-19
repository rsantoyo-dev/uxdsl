# MIG-B6-30 — `applyTheme(json)`: una sola manera de tematizar también en runtime

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | B — Tema base y salida correcta |
| Prioridad · Tamaño | P1 · M |
| Cierra | D-4 ("una sola manera de personalizar el tema") |
| Depende de | MIG-B6-29 (tema base en la librería) |
| Bloquea | MIG-B6-12 |
| Archivos | `packages/postcss-uxdsl/src/ds-runtime/index.ts`, `src/ds-runtime/theme-generator.ts`, `packages/playground-nextjs/src/components/ThemeContext.tsx`, `ThemeScript.tsx`, `AGENTS.md` |

## Por qué

Decisión D-4: hay **una sola manera** de personalizar el tema, y es el JSON (base más
override del proyecto, con el mismo esquema).

- **En build, por defecto:** CLI, PostCSS, Vite y Webpack leen el JSON y generan el
  CSS. No necesita JavaScript, no hay parpadeo, funciona con SSR y los errores se
  detectan en CI.
- **En runtime, sólo para live theming** (editor de temas, preferencias del usuario,
  tema por cliente): el mismo JSON, aplicado con el mismo generador.

Hoy `ds-runtime` no tiene una forma de aplicar un JSON. Ofrece un segundo modelo con
otro formato:

- setters por familia: `updatePalette`, `updateColor`, `updateSpacing`,
  `updateBreakpoint`, más sus variantes `apply*`, `reset*` y `loadPersisted*`;
- cuatro claves de `localStorage`: `uxdsl:palette`, `uxdsl:spacing`, `uxdsl:colors`
  y `uxdsl:breakpoints` (`index.ts:9-12`).

El patrón correcto ya existe, pero en el código de la app del playground:
`ThemeContext.tsx:87-121` genera con `generateThemeCss`, valida antes de reemplazar y
escribe en un único `<style id="uxdsl-ssr-theme">`. `ThemeScript.tsx` lo hace en SSR.

## Reproducción

```bash
npm --prefix packages/postcss-uxdsl run build
node -e "const r = require('./packages/postcss-uxdsl/dist/ds-runtime'); console.log('applyTheme' in r, Object.keys(r).filter(k => /^(update|apply|load|reset)/.test(k)).join(', '))"
```

Salida actual: `false`, seguido de la lista de setters por familia.

Los setters se usan en `packages/playground-nextjs/src/components/`
(`DemoSpacing.tsx`, `DemoColors.tsx`, `PaletteThemeExplorer.tsx`,
`ThemeProvider.tsx` y `DemoPaletteConfig.tsx`) y en
`packages/playground/src/App.jsx`.

## Resultado esperado (API)

```ts
applyTheme(patch: UxdslThemeOverride, opts?: {
  replace?: boolean;          // true: parte de la base; false (default): mezcla sobre el override aplicado
  styleId?: string;           // <style> administrado; default 'uxdsl-theme'
  persist?: boolean | string; // guarda un solo JSON; default key 'uxdsl:theme'
}): { ok: true; override: UxdslThemeOverride } | { ok: false; error: Error }

getAppliedTheme(): UxdslThemeOverride
resetTheme(opts?): void
loadPersistedTheme(opts?): void
subscribe(listener)           // existente; ahora notifica con el override aplicado
```

- Semántica de AGENTS.md: "Custom edits merge over the active effective theme;
  replace starts from the common base".
- `applyTheme` ejecuta `resolveTheme` sobre el override acumulado y luego
  `generateThemeCss`. Si la generación falla, no toca el DOM y devuelve
  `ok: false`: el último tema válido queda aplicado (AGENTS.md: "Generate
  successfully before replacing the managed stylesheet").
- Para SSR, se documenta el patrón de `ThemeScript.tsx` con el mismo `styleId`, así
  `applyTheme` reutiliza la etiqueta en el cliente.

## Implementación

1. Implementar la API en `ds-runtime/index.ts`, llevando la lógica de
   `ThemeContext.tsx` a la librería.
2. Reimplementar los setters existentes sobre `applyTheme`. Por ejemplo,
   `updatePalette('primary.main', v)` pasa a ser
   `applyTheme({ palette: { primary: { main: v } } })`. Marcarlos `@deprecated` en
   JSDoc y README. Siguen funcionando; se eliminan después de 0.5.0.
3. Migración de persistencia: `loadPersistedTheme` lee una vez las cuatro claves
   viejas, las convierte a un override JSON, lo guarda en `uxdsl:theme` y borra las
   viejas.
4. Rendimiento: con el tema base, cada llamada regenera unos 55 KB de CSS. Un slider
   que llama a un setter en cada `input` debe agrupar los parches por frame con
   `requestAnimationFrame` dentro de `applyTheme` (una generación por frame). Si
   `requestAnimationFrame` no existe (SSR o tests), aplicar de forma síncrona.
5. Playground: `ThemeContext.tsx` usa `applyTheme` en lugar de su implementación
   propia. Los componentes que usan setters pueden quedar como están, porque siguen
   funcionando.

## Fuera de alcance

- Eliminar los setters (después de 0.5.0).
- Rediseñar el editor del playground.

## Pruebas

- `test/ds-runtime-apply-theme.test.js`, con un stub mínimo de `document` y
  `localStorage`. Si `jsdom` ya está en `devDependencies`, se puede usar; si no, no
  agregarlo sin anotarlo en el PR. Casos:
  - un parche mezcla sobre el anterior y `replace: true` parte de la base;
  - un tema inválido devuelve `ok: false` y no toca el `<style>`;
  - se persiste un solo JSON y las claves viejas se migran y se borran;
  - con un `requestAnimationFrame` falso, 60 parches en un frame producen una sola
    generación.
- **Paridad build ↔ runtime:** para el tema base y un override de ejemplo, las
  variables de `:root` que genera `applyTheme` son iguales a las del build con el
  mismo JSON. Extender la paridad runtime/PostCSS que ya verifica
  `fixtures/mig07-consumer/run.js`.
- Los setters deprecados siguen pasando sus tests actuales.

## Documentación

- `packages/postcss-uxdsl/README.md`, sección runtime: el JSON es la única manera;
  `applyTheme` es para live theming; los setters están deprecados.
- `AGENTS.md`, "Build time, runtime and one source of truth": reemplazar el
  fragmento de `generateThemeCss` con el `<style>` administrado por `applyTheme`, y
  mantener `generateThemeCss` para SSR.
- `packages/postcss-uxdsl/docs/migration.md`: tabla setter → `applyTheme`.
- CHANGELOG beta.6.

## Criterios de aceptación

- [ ] `applyTheme(json)` existe, valida antes de reemplazar y persiste un solo JSON.
- [ ] Hay paridad build ↔ runtime para el mismo JSON.
- [ ] Los setters funcionan sobre `applyTheme` y están marcados como deprecados.
- [ ] Las cuatro claves viejas de `localStorage` se migran.
- [ ] El playground compila y su tema funciona con `applyTheme`.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm run verify:consumer-fixture
npm --prefix packages/playground-nextjs run build
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-30 - applyTheme(json): one theming model at build time and runtime`
