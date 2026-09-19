# MIG-B6-27 — Tipos y esquema de configuración

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | F — Editor y tipos |
| Prioridad · Tamaño | P2 · S-M |
| Cierra | UX-18 |
| Depende de | MIG-B6-01 (`KNOWN_THEME_FAMILIES`). Si MIG-B6-19 no está integrada, esta story crea el entry `postcss-uxdsl/config` sólo con tipos y `defineConfig`, y MIG-B6-19 le agrega el cargador |
| Bloquea | — |
| Archivos | `packages/postcss-uxdsl/src/index.ts` (sólo la interfaz de opciones), nuevo `src/types.ts`, `src/config.ts` (compartido con MIG-B6-19), nuevo `packages/postcss-uxdsl/schema/theme.schema.json`, `packages/postcss-uxdsl/package.json` (exports y `files`), `scripts/generate-language-artifacts.js` |
| Coordinación | En `index.ts` sólo cambia el tipo exportado. Hacerlo en un commit chico y rebasar sobre la story de `index.ts` que esté en curso |

## Por qué

Los errores de tipeo nacen al escribir `uxdsl.config.cjs`, `uxdsl.theme.config.*` y
`uxdsl.theme.json`, y hoy el editor no ayuda en ninguno:

- `theme?: Record<string, any>`;
- la interfaz de opciones (`UxDslOptions`) no se exporta;
- no hay esquema para el JSON de tema.

## Reproducción

```bash
grep -n "interface UxDslOptions\|theme?: Record<string, any>" packages/postcss-uxdsl/dist/index.d.ts
grep -n "export" packages/postcss-uxdsl/dist/index.d.ts
```

Salida actual: la interfaz existe pero no se exporta, y `theme` es `Record<string, any>`.

## Resultado esperado

```ts
import type { UxdslOptions, UxdslTheme, UxdslThemeOverride } from 'postcss-uxdsl';
import { defineConfig } from 'postcss-uxdsl/config';

/** @type {import('postcss-uxdsl/config').UxdslConfig} */
module.exports = defineConfig({ entry: './src/a.uxdsl', outFile: './out/a.css' });
```

Y en JSON: `{ "$schema": "./node_modules/postcss-uxdsl/schema/theme.schema.json", … }`.

## Implementación

1. `src/types.ts`:
   - **`UxdslTheme`:** una propiedad por familia de `KNOWN_THEME_FAMILIES`;
     - `palette: Record<string, { main: string; dark?: string; light?: string; contrast?: string; [variant: string]: string | undefined }>`;
     - `typography_details: Record<string, Partial<Record<TypographyField, string>>>`,
       con `TypographyField` derivado de `TYPOGRAPHY_PROPERTIES`;
     - `fonts: { families?: Record<string, string>; google?: string[] }`;
     - `spacing`, `breakpoints`, `modes` (`{ dark?: { palette?: … } }`) y `typography`;
     - `densities`, `radii`, `shadows`, `borders`, `surfaces`, `buttons` e `inputs`
       con los campos de sus motores cuando existan como constantes; si no, un
       `Record`.
   - **`UxdslThemeOverride`:** `DeepPartial<UxdslTheme>`.
   - **`UxdslOptions`:** las opciones actuales, más `discoverTheme` y `configRoot` si
     MIG-B6-19 ya está integrada. Mantener `UxDslOptions` como alias deprecado.
   - **`UxdslConfig` y `UxdslBuild`:** la forma de `uxdsl.config.cjs` (`entry`,
     `outFile`, `builds`, `watch`, `breakpoints`, `includeTheme`, `strictTheme`,
     `themeFile`, `references`, y `sourceMap` si MIG-B6-21 existe).
2. `postcss-uxdsl/config`: `defineConfig<T extends UxdslConfig>(c: T): T`, una función
   identidad que sirve en CJS con JSDoc.
3. JSON Schema en `schema/theme.schema.json`, **generado** por
   `generate-language-artifacts.js` desde `KNOWN_THEME_FAMILIES`,
   `TYPOGRAPHY_PROPERTIES` y los campos de los motores. Top-level cerrado
   (`additionalProperties: false`); registros abiertos (`palette.*`,
   `typography_details.*`, `fonts.families.*`) con claves que respetan el patrón de
   nombre. Exportarlo en `package.json`.

## Fuera de alcance

- Validación en runtime con el esquema. `validateAndNormalizeTheme` sigue siendo el
  validador.

## Pruebas

- `test/types/config.ts`, compilado con `tsc --noEmit` en el test:
  - una configuración válida compila;
  - `typography_details.h1.fontsize` (typo) falla con `@ts-expect-error`;
  - una familia `palete` falla.
- **Esquema:** el JSON base (MIG-B6-29) valida contra el esquema; un tema con
  `palete` o `fontsize` no valida. Se puede usar un validador como devDependency
  (por ejemplo `ajv`), anotándolo en el PR.
- `--check` detecta un esquema desactualizado.

## Documentación

- `packages/postcss-uxdsl/README.md` y `packages/uxdsl-cli/README.md`: cómo tipar
  `uxdsl.config.cjs` y cómo usar `$schema`.
- CHANGELOG beta.6.

## Criterios de aceptación

- [ ] Los tipos están exportados y `defineConfig` existe.
- [ ] El esquema es generado y está exportado.
- [ ] Los errores de tipeo en tipos y esquema fallan en los tests.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm run generate:language && node scripts/generate-language-artifacts.js --check
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-27 - exported config and theme types, defineConfig, generated theme json schema`
