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

- [x] Los tipos están exportados y `defineConfig` existe.
      → `import type { UxdslTheme, UxdslThemeOverride, UxdslOptions, UxdslConfig }
      from 'postcss-uxdsl'` resuelve bajo Node16 y bundler, verificado también
      contra el tarball instalado; `defineConfig` en `postcss-uxdsl/config`.
- [x] El esquema es generado y está exportado.
      → `packages/postcss-uxdsl/schema/theme.schema.json`, generado por
      `scripts/generate-language-artifacts.js`, en `files` y en `exports`,
      presente en el tarball.
- [x] Los errores de tipeo en tipos y esquema fallan en los tests.
      → 19 directivas `@ts-expect-error` en `test/types/typos.ts` (una no usada
      hace fallar el test) y 14 casos negativos de esquema en
      `test/theme-schema.test.js`.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm run generate:language && node scripts/generate-language-artifacts.js --check
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-27 - exported config and theme types, defineConfig, generated theme json schema`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente** en
`feat/feat-008-beta6-plan`. Integración a `main` pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `55756da` (2026-09-22, HEAD de la rama al iniciar). Entrega: `ad65114` en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | Los dos comandos de la propia ficha, sobre `55756da`: `grep -n "interface UxDslOptions\|theme?: Record<string, any>" packages/postcss-uxdsl/dist/index.d.ts` → líneas 8 y 13 (la interfaz existe y `theme` es `Record<string, any>`); `grep -n "export" .../dist/index.d.ts` → una sola línea, `export = uxdslPlugin` (52): ningún tipo público. No existía `defineConfig` (`postcss-uxdsl/config` sólo exportaba los helpers de descubrimiento de tema) ni directorio `schema/`. **Tres hallazgos al inventariar, que la ficha no anticipaba o daba por distintos**: (a) `exports` listaba la condición `types` **después** de `require`/`import` en `.`, `./ds-runtime` y `./config` — las condiciones se resuelven en orden, así que bajo `node16`/`nodenext` la entrada de tipos no se alcanzaba nunca (sólo `./language` estaba bien); (b) un tema con `"$schema"` — la línea que la documentación recomienda añadir — producía el aviso `Unknown theme family "$schema" — it will not be compiled into any CSS`, es decir, la herramienta desaconsejaba su propia recomendación; (c) `sourcesContent` **no** es una opción del CLI (sólo de `compile()`), pese a que esta ficha la lista junto a `sourceMap` como parte de `UxdslConfig`. 2026-09-22 |
| Criterio → regresión | Tipos → `packages/postcss-uxdsl/test/types.test.js` (5 tests). Monta un proyecto temporal con `node_modules/postcss-uxdsl` enlazado al paquete real y ejecuta `tsc --noEmit` dentro: resuelve por el `exports` map de verdad, no por un alias `paths` que se saltaría justo lo que suele estar mal. Cubre `module/moduleResolution: node16` y `bundler`, y `allowJs`+`checkJs` para la forma `.cjs` con JSDoc. `test/types/valid.ts` debe compilar limpio (config de una entrada, config con `builds`, `satisfies`, el alias heredado `output`, tema completo con familia Palette propia, `action` sin `main`, palette parcial, rol tipográfico custom, arrays de fuentes, alias deprecado `UxDslOptions`); `test/types/typos.ts` es el corpus negativo, **19 directivas `@ts-expect-error`** — una directiva sin usar es el error TS2578, así que un tipo que deje de detectar un typo hace fallar el test en vez de pasarlo en silencio. Esquema → `packages/postcss-uxdsl/test/theme-schema.test.js` (7 tests): los 6 temas reales del repositorio validan; los conjuntos cerrados se comparan contra las constantes de motor (no contra una copia); 14 casos negativos; 13 casos de registro abierto que **deben** seguir validando; `$schema` aceptado por el esquema e ignorado por el validador de runtime; `--check` detecta un esquema editado a mano; y el paquete declara `schema` en `files` y en `exports`, con `types` primero en cada condición. Tarball → `fixtures/mig07-consumer/run.js` añade cuatro comprobaciones sobre la instalación real: el esquema viaja en el tarball, el tema de la fixture valida contra el **esquema instalado**, `dist/types.d.ts` viaja, y un consumidor TypeScript type-checkea contra el tarball bajo Node16 |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, Apple M1 Pro, desde el root del monorepo: `npm --prefix packages/postcss-uxdsl test` (exit 0, **332 + 1**, +12 frente a 321), `npm run generate:language` seguido de `node scripts/generate-language-artifacts.js --check` (ambos exit 0), `npm test` (exit 0, **622** líneas `ok`, antes 610), `npm run verify:consumer-fixture`, `verify:beta2`/`beta3`/`beta4`/`beta5`, `verify:vscode-extension`, `verify:pack-budget` y ambas fixtures de adaptador (todos exit 0) |
| Resultado después / control negativo | `import type { UxdslTheme, UxdslConfig, UxdslOptions } from 'postcss-uxdsl'` y `import('postcss-uxdsl/config').UxdslConfig` resuelven bajo Node16 y bundler, desde el árbol y desde el tarball. **Controles negativos, cada uno ejecutado**: (1) quitando todas las directivas `@ts-expect-error` de `typos.ts`, la compilación debe fallar — falla con ≥15 errores reales y **ningún** TS2307, lo que descarta que "falle" por no resolver el módulo; (2) `defineConfig` no es genérico a propósito: con `defineConfig<T extends UxdslConfig>` el literal infiere `T` con sus claves extra y `includeThem` pasaría; (3) el esquema manipulado a mano hace fallar `--check`; (4) los 13 casos de registro abierto comprueban que el esquema **no** se pasa de estricto — un falso positivo aquí sería peor que un typo no detectado, porque enseña a ignorar la anotación; (5) el alias `output` se modeló tras comprobar que el CLI lo acepta (`configModule.outFile \|\| configModule.output`): tiparlo como error habría roto configuraciones que funcionan. Tamaño del tarball: 120,9 KB → **128,1 KB**, dentro del presupuesto de 250 KB |
| Cambios visuales o API / migración | Sin cambio visual ni de comportamiento de compilación. API aditiva salvo dos correcciones: `theme` pasa de `Record<string, any>` a `UxdslThemeOverride` en `UxdslOptions` (un consumidor TypeScript que pasara un objeto arbitrario ahora recibe el error que la historia persigue — intencionado), y el orden de condiciones de `exports` cambia (corrección de un defecto, no un cambio de contrato). `UxDslOptions` sigue resolviendo como alias deprecado, sin fecha de retirada dentro de 0.5.x. `BUTTON_PROPERTIES`/`BUTTON_STATES`/`INPUT_PROPERTIES`/`INPUT_STATES` pierden su anotación `Record<string, …>` para que sus claves sean literales: mismos valores, mismo runtime |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md`, nueva sección "Typed config and theme (`defineConfig`, `$schema`)": las tres formas (JSDoc en `.cjs`, TypeScript, `$schema` en JSON), por qué `defineConfig` no es genérico, el límite del chequeo a literales frescos y `satisfies`, y una tabla de qué está cerrado y qué queda abierto. `packages/uxdsl-cli/README.md`, dentro de "1. Configuration": la misma receta en el sitio donde se escribe el archivo, señalando que una clave desconocida hoy no es un error sino silencio. `packages/postcss-uxdsl/CHANGELOG.md` (entrada MIG-B6-27, incluidas las dos correcciones). `docs/migration.md` sin cambios: nada que migrar |
| AGENTS / guías / arquitectura | Sin cambio de contrato en `AGENTS.md`: añadir tipos y un esquema no cambia responsabilidades de primitivas, precedencia de temas ni el contrato de build/runtime. Los nombres abiertos que la guía ya describe (roles propios, familias Palette propias) siguen siendo válidos, y el test de registros abiertos existe para garantizarlo |
| Límites y seguimiento | (1) **El esquema no valida en runtime**, como pide "Fuera de alcance": `validateAndNormalizeTheme` sigue siendo el validador; el esquema es para el editor. Son dos mecanismos con dos alcances, y sólo el segundo es un error de compilación. (2) **`sourcesContent` no está en `UxdslConfig`** aunque esta ficha lo liste: el CLI no lo lee (es opción de `compile()`), y tiparlo como aceptado habría documentado algo que se ignora en silencio. Si se quiere exponer, es trabajo de CLI, no de tipos. (3) **El tipado es estructural**: `satisfies`/anotación en el punto de definición son necesarios para un objeto construido antes de la llamada, y así se documenta; pasar una variable ya ensanchada por `defineConfig` no recupera información que la asignación anterior ya descartó. (4) **`ajv@8.20.0` añadido como devDependency** de `postcss-uxdsl` (fijado exacto) sólo para los tests; no entra en `dependencies` ni en el tarball. (5) **Sin validación externa**: no se ha abierto VS Code para comprobar la experiencia de autocompletado real; lo verificado es que `tsc` y `ajv` aceptan y rechazan lo que deben, que es el mecanismo del que depende el editor, no una captura de la UI. (6) **Efecto colateral corregido en otra historia**: el guard `plugin-option-parity.test.js` detectó el traslado de la interfaz en la primera corrida y se reapuntó a `src/types.ts`/`UxdslOptions` sin relajarlo; y el test de escalado de MIG-B6-25 resultó ser sensible al runner paralelo de `node --test` — se aisló en `test/performance/` con su propia pasada, registrado en la ficha de aquella historia |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
