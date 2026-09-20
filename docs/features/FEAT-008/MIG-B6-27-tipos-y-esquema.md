# MIG-B6-27 — Tipos y esquema de configuración

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | F — Editor y tipos |
| Prioridad · Tamaño | P2 · S-M |
| Cierra | UX-18 |
| Depende de | MIG-B6-01 (familias), MIG-B6-19 (config final), MIG-B6-21 (mapas), MIG-B6-29 (base final). Se puede diseñar tipos antes, pero se integra tras esos contratos |
| Bloquea | MIG-B6-12, MIG-B6-28, MIG-B6-30 |
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
```

En `uxdsl.config.cjs`:

```js
const { defineConfig } = require('postcss-uxdsl/config');

/** @type {import('postcss-uxdsl/config').UxdslConfig} */
module.exports = defineConfig({ entry: './src/a.uxdsl', outFile: './out/a.css' });
```

Y en JSON: `{ "$schema": "./node_modules/postcss-uxdsl/schema/theme.schema.json", … }`.

## Implementación

1. `src/types.ts`:
   - **`UxdslTheme`:** una propiedad por familia de `KNOWN_THEME_FAMILIES`;
     - `palette`: registro abierto de variantes string y las formas planas que
       acepta el motor. No exigir `main` a grupos semánticos: `action` no lo tiene
       en la base. Distinguir el tipo de familia válida del predicado de tono completo
       (`main`, `dark`, `contrast`) usado por Buttons/Inputs;
     - `typography_details: Record<string, Partial<Record<TypographyField, string>>>`,
       con `TypographyField` derivado de `TYPOGRAPHY_PROPERTIES`;
     - `fonts: { families?: Record<string, string>; google?: string[] }`;
     - `spacing`, `breakpoints`, `modes` (`{ dark?: { palette?: … } }`) y `typography`;
     - `densities`, `radii`, `shadows`, `borders`, `surfaces`, `buttons` e `inputs`
       con nombres de rol abiertos y campos/estados cerrados derivados de sus
       motores; no usar `Record<string, any>` para omitir la validación.
   - **`UxdslThemeOverride`:** parcial profundo de objetos, conservando arrays
     completos y sus tipos de elementos (no arrays de elementos opcionales).
     Tipar override y tema efectivo de forma coherente con `resolveTheme`.
   - **`UxdslOptions`:** opciones actuales más `discoverTheme` y `configRoot`
     de 19. Mantener `UxDslOptions` como alias deprecado.
   - **`UxdslConfig` y `UxdslBuild`:** la forma de `uxdsl.config.cjs` (`entry`,
     `outFile`, `builds`, `watch`, `breakpoints`, `includeTheme`, `strictTheme`,
     `themeFile`, `references`, `sourceMap` y `sourcesContent` de 21). Modelar
     entry/builds como variantes válidas; no permitir combinaciones que el CLI
     rechaza. Tipar también funciones públicas que aceptan overrides.
2. `postcss-uxdsl/config`: función identidad `defineConfig(c: UxdslConfig): UxdslConfig`
   con objetos de config y campos estructurados cerrados. Un genérico
   `T extends UxdslConfig` por sí solo acepta claves extra; no usarlo como garantía
   anti-typos. Probar la función real, no sólo una variable anotada. Para objetos
   construidos previamente recomendar `satisfies UxdslConfig`; explicar límites
   del tipado estructural. JSDoc CJS usa `require`, sin mezclar import ESM en `.cjs`.
   Preservar contratos de funciones async de config admitidos por el cargador.
3. JSON Schema en `schema/theme.schema.json`, **generado** por
   `generate-language-artifacts.js` desde `KNOWN_THEME_FAMILIES`,
   `TYPOGRAPHY_PROPERTIES` y los campos de los motores. Top-level cerrado
   (`additionalProperties: false`), con `$schema` declarado como metadata string;
   el validador no lo trata como familia ni emite warning. Registros abiertos (`palette.*`,
   `typography_details.*`, `fonts.families.*`) con claves que respetan el patrón de
   nombre y las formas válidas de cada motor, incluyendo keys de spacing
   normalizadas y palette parcial. Exportarlo en `package.json`; validar contra el
   mismo corpus positivo/negativo que los tipos y los motores.

## Fuera de alcance

- Validación en runtime con el esquema. `validateAndNormalizeTheme` sigue siendo el
  validador.

## Pruebas

- Compilar consumidores desde tarball en CJS/JSDoc (`checkJs`) y TypeScript con
  resolución Node16/NodeNext y bundler. Verificar exports públicos, conditions de
  tipos antes de import/require y JSON/schema incluidos por `files`.
- `defineConfig({ entry, outFile, includeThem: false })` debe fallar; también
  `theme` con `palette` válido y `palete` adicional. `@ts-expect-error` no usado
  debe hacer fallar el test. Probar `action` sin main, partial palette, arrays de
  fuentes y rol tipográfico custom; `$schema` válido sin warning de runtime.
- Campos y estados de Surface/Button/Input usan conjuntos cerrados del motor:
  errores como `focusVisible` o `outlne` se detectan sin cerrar nombres custom.

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

## Registro de implementación y evidencia

Estado de esta revisión documental: **Pendiente de implementación/verificación**
(salvo avances parciales señalados arriba). Completar en el mismo PR conforme al
[protocolo de agentes](README.md#cobertura-y-evidencia-obligatorias). No marcar
criterios por intención ni confundir una reproducción histórica con prueba actual.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | Comando/test, resultado observado y fecha: pendiente |
| Criterio → regresión | Nombre/path exacto del test por criterio: pendiente |
| Comandos y entorno | Comando, versión/OS relevante, exit code y log: pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente; justificar si no aplica |
| README / CHANGELOG / migration | Paths y secciones: pendiente |
| AGENTS / guías / arquitectura | Secciones actualizadas o sin cambio de contrato razonado: pendiente |
| Límites y seguimiento | Qué no se ejecutó, motivo y efecto sobre cierre: pendiente |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
