# MIG-B6-20 — Adaptadores Vite y Webpack sobre `compile()`

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | C — Un solo pipeline (**camino crítico**) |
| Prioridad · Tamaño | P1 · L |
| Cierra | N-03, N-04, el resto de UX-16. Aplica D-4 |
| Depende de | MIG-B6-18 (`compile()`), MIG-B6-19 (cargador de configuración), MIG-B6-29 (retiro de packs legacy) |
| Bloquea | MIG-B6-12, MIG-B6-21 |
| Archivos | `packages/vite-plugin-uxdsl/src/index.ts` (974 líneas; se reescribe casi entero), `packages/vite-plugin-uxdsl/package.json`, `packages/uxdsl-webpack-loader/index.js`, `packages/uxdsl-webpack-loader/package.json`, nuevos `fixtures/vite-adapter/` y `fixtures/webpack-adapter/`, `fixtures/parity/` |
| Coordinación | Dueño único de los dos paquetes durante esta story |

## Por qué

**Decisión D-4:** el tema se aplica en build (una sola manera; el runtime sólo hace
live theming con el mismo JSON, en MIG-B6-30). Los bundlers deben entregar **CSS
real** por su propio pipeline. Hoy no lo hacen.

**Plugin de Vite:**

- convierte cada `.uxdsl` en un módulo JavaScript que inserta `<style>` en tiempo de
  ejecución (`load`, ~667-960): no hay extracción en `vite build` y SSR no tiene
  estilos;
- filtra rutas absolutas de la máquina de build al bundle de producción: el atributo
  `data-uxdsl` lleva `baseId` sin condición;
- no registra los parciales importados con `addWatchFile`, así que editar un parcial
  no dispara HMR;
- inyecta los packs legacy `default-*.css` (`resolveDefault*File`, `readCached*`);
- compila las densidades aparte y traga los errores (`catch {}`);
- activa un preproceso con Sass en modo `auto` si `sass` está instalado en el
  proyecto, así que una dependencia ajena cambia la semántica.

**Loader de Webpack** (`index.js`, 15 líneas):

- usa `this.query` en vez de `this.getOptions()`;
- no llama `this.addDependency` para los parciales, así que la caché y el watch no
  ven sus cambios;
- devuelve `module.exports = "css"`, que no se encadena con `css-loader`.

Ninguno de los dos lee el tema del proyecto.

## Reproducción

Por lectura de código (sin fixture ejecutable hoy):

```bash
grep -n "data-uxdsl'\|addWatchFile\|default-palette\|scssMode\|stripLineComments" packages/vite-plugin-uxdsl/src/index.ts
cat packages/uxdsl-webpack-loader/index.js
```

Parte del paso 1 es convertir cada problema en un test que falle.

## Resultado esperado

- **Vite:** `import './panel.uxdsl'` produce CSS que Vite trata como cualquier `.css`:
  extracción en build, HMR nativo, SSR y sin rutas absolutas.
  `import css from './panel.uxdsl?inline'` sigue devolviendo el string, como en el
  CSS de Vite.
- **Webpack:** `use: ['style-loader', 'css-loader', 'uxdsl-webpack-loader']`, o
  `MiniCssExtractPlugin`, funciona.
- Ambos: mismo CSS que el CLI para la misma entrada y el mismo tema.

## Implementación

1. **Fixtures primero:** `fixtures/vite-adapter/` y `fixtures/webpack-adapter/`,
   instalando desde tarballs con `fixtures/lib/tarball-consumer.js`, con los casos de
   los criterios de aceptación. Deben fallar con la implementación actual.
2. **Vite:**
   - `resolveId` lleva `x.uxdsl` a un id que Vite reconozca como CSS. La ruta
     candidata es un id terminado en `.css` (por ejemplo `/abs/x.uxdsl?uxdsl&lang.css`),
     conservando `?inline` cuando se pide. Es la opción 1 que ya evaluaba FEAT-007.
     Verificarla con la fixture antes de cerrar el diseño.
   - `load` llama a `compile({ entry })` con el tema del cargador de MIG-B6-19
     (las opciones del plugin tienen precedencia) y devuelve el CSS.
   - Llamar `this.addWatchFile(dep)` por cada entrada de `dependencies`, incluido el
     archivo de tema.
   - Eliminar la inyección en runtime, los packs legacy, `readCached*`,
     `resolveDefault*File`, la compilación aparte de densidades y
     `stripLineComments`.
   - **Sass:** el modo `auto` se elimina. `scss: 'on'` explícito puede quedar,
     documentado como fuera de la garantía de paridad. `$vars`, `@mixin` y `@each`
     ya los cubre `postcss-advanced-variables` dentro de `compile()`.
   - **Proyectos con `postcss-uxdsl` en su `postcss.config`:** Vite le pasará el CSS ya
     compilado. Sin funciones DSL aún puede duplicarse tema/imports. Fixture con
     ambos activos: evitar doble pasada por id/origen o configuración documentada
     y comprobada; contar temas y fuentes.
3. **Webpack:**
   ```js
   module.exports = async function uxdslLoader(source) {
     const callback = this.async();
     try {
       const options = this.getOptions();
       const config = { ...loadConfig(this.rootContext), ...options }; // MIG-B6-19
       const { css, map, dependencies } = await compile({ source, from: this.resourcePath }, config);
       dependencies.forEach((dep) => this.addDependency(dep));
       callback(null, css, map ? JSON.parse(map) : undefined);
     } catch (err) { callback(err); }
   };
   ```
4. Agregar Vite y Webpack a `fixtures/parity/`.
5. **D-4:** el tema llega por la configuración del proyecto o por `uxdsl.theme.json`,
   y el resultado es idéntico en los cuatro caminos. El live theming (MIG-B6-30)
   trabaja sobre variables CSS para cambios compatibles con la estructura
   compilada, según 30. No prometer regeneración de estados o umbrales locales.

## Fuera de alcance

- Sourcemaps (MIG-B6-21).
- Soporte de Vite 3 o anteriores. El rango de `peerDependencies` no cambia salvo que
  la fixture lo exija.

## Pruebas

- Editar tema y su JSON requerido cambia CSS sin reiniciar; import faltante se
  recupera al crearlo. Advertencias de compile aparecen en ambos bundlers.
- Assets relativos de un parcial se resuelven respecto de su origen tras cambiar
  a id CSS; probar url(), ?inline, nombres con espacios y base pública.
- SSR real de la fixture: import no accede a document y CSS queda disponible para
  el render/manifest del host; extracción sola no demuestra SSR.
- HMR: invalidación de grafo más actualización de computed style en navegador;
  declarar qué prueba cada nivel. Sin polyfills Node para ds-runtime en cliente.

- **`fixtures/vite-adapter/`:**
  - `vite build`: hay un `.css` extraído que contiene las reglas;
  - ningún archivo de `dist/` contiene la ruta absoluta del repositorio (grep);
  - `?inline` devuelve el string;
  - con `createServer`, editar un parcial importado invalida el módulo `.uxdsl`
    (usando el grafo de módulos, sin navegador);
  - el tema de `uxdsl.theme.config.cjs` se aplica.
- **`fixtures/webpack-adapter/`:**
  - build con `css-loader` y `MiniCssExtractPlugin` produce el CSS;
  - en modo watch, editar un parcial recompila;
  - las opciones del loader llegan con `getOptions()`.
- `fixtures/parity/` pasa por CLI, core, Vite y Webpack.

## Documentación

- `packages/vite-plugin-uxdsl/README.md` y `packages/uxdsl-webpack-loader/README.md`:
  configuración nueva, `?inline`, tema y Sass.
- `packages/postcss-uxdsl/docs/migration.md`: quien importaba el string en Vite pasa a
  `?inline`; quien usaba el loader de Webpack encadena `css-loader`; los packs legacy
  ya no se inyectan.
- CHANGELOG beta.6.

## Criterios de aceptación

- [x] Vite extrae CSS real y hay HMR al editar un parcial.
- [x] El build de producción no contiene rutas absolutas.
- [x] Webpack declara dependencias y se encadena con `css-loader`.
- [x] La paridad pasa por los cuatro caminos.
- [x] El tema del proyecto se aplica en Vite y en Webpack.

## Verificación

```bash
node fixtures/vite-adapter/run.js
node fixtures/webpack-adapter/run.js
npm run test:parity
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-20 - vite and webpack deliver real css through compile(), with dependencies and the project theme`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada en
`feat/feat-008-beta6-plan`** (integración a `main` pendiente).

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `c0ba93e` (2026-09-21). Entrega: commit siguiente en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | Por lectura de código sobre `c0ba93e`, confirmada además ejecutando el `vite-plugin-uxdsl` viejo: `import './panel.uxdsl'` compilaba a un módulo JS que hacía `document.head.appendChild(styleTag)` (`typeof document !== 'undefined'` — falso en SSR); `vite build` no generaba ningún `.css` en `dist/assets/`, sólo el JS con el string embebido; ese JS contenía la ruta absoluta del proyecto vía `JSON.stringify(baseId)` en el atributo `data-uxdsl`; `uxdsl-webpack-loader/index.js` devolvía `module.exports = ${JSON.stringify(css)}`, que `css-loader` no puede interpretar como CSS; no llamaba `this.addDependency()` para parciales `@import`ados; usaba `this.query` (siempre `undefined` en Webpack 5, que sólo expone `this.getOptions()`). 2026-09-21 |
| Criterio → regresión | "Vite extrae CSS real y hay HMR" → `fixtures/vite-adapter/run.js` ("vite build extracts a real .css asset...", "createServer registers the imported partial as a module-graph dependency") + `packages/vite-plugin-uxdsl/test/index.test.js` (14 tests unitarios de `resolveId`/`load`). "Build de producción sin rutas absolutas" → `fixtures/vite-adapter/run.js` ("no dist/ file contains the build machine's absolute path", recorre todo `dist/` recursivamente) + verificado manualmente en `packages/playground` (`npm run build`, `grep` sobre `dist/assets/*` sin coincidencias). "Webpack declara dependencias y se encadena con css-loader" → `fixtures/webpack-adapter/run.js` ("css-loader + MiniCssExtractPlugin produce a real CSS file...", "watch mode recompiles...") + `packages/uxdsl-webpack-loader/test/loader.test.js` (6 tests, incluye `this.addDependency()` verificado vía `stats.compilation.fileDependencies`). "Paridad en los cuatro caminos" → `fixtures/parity/run.js` extendido con `runVite`/`runWebpack` (llaman `resolveId`/`load` y el loader reales, no una re-implementación), 8/8 casos comparando CLI/compile()/Vite/Webpack. "Tema del proyecto se aplica" → ambos fixtures de adaptador tienen un caso con `uxdsl.theme.config.cjs` real y `palette(...)` de una familia custom, verificado en la salida compilada; también cubierto por los tests unitarios de ambos paquetes (`discoverTheme`/`configRoot`/`discoverTheme:false`/theme explícito) |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, Vite 5.4.21, Webpack 5.111.1, desde el root del monorepo: `npm --prefix packages/vite-plugin-uxdsl test` (exit 0, 14/14), `npm --prefix packages/uxdsl-webpack-loader test` (exit 0, 6/6), `npm --prefix packages/uxdsl-core test` (exit 0, 21/21, incluye 3 tests nuevos de MIG-B6-20), `node fixtures/vite-adapter/run.js` (PASS, 5/5, instala desde tarballs reales + `vite@^5` real del registro), `node fixtures/webpack-adapter/run.js` (PASS, 3/3, instala desde tarballs reales + `webpack@^5`/`css-loader@^7`/`mini-css-extract-plugin@^2` reales), `npm run test:parity` (PASS, 8/8, cuatro caminos), `npm test` (exit 0, todas las suites), `npm run verify:consumer-fixture`/`verify:beta2`/`verify:beta3`/`verify:beta4`/`verify:beta5` (todos PASS), `npm run build` en `packages/playground-nextjs` (build de producción completo, OK) y en `packages/playground` (build real con `vite-plugin-uxdsl`, CSS extraído verificado a mano, `npm run dev` levantado y consultado con `curl` confirmando HMR nativo de Vite sirviendo el CSS compilado) |
| Resultado después / control negativo | Las tres reproducciones de "antes" ahora dan el resultado correcto: `vite build` extrae un `.css` real (confirmado en `fixtures/vite-adapter/` y en `packages/playground/dist/assets/*.css`, con contenido compilado real, sin rutas absolutas); `uxdsl-webpack-loader` devuelve CSS real que `css-loader`/`MiniCssExtractPlugin` consumen; las opciones llegan por `getOptions()`. Control negativo: `discoverTheme: false` en ambos adaptadores sigue fallando contra `DEFAULT_THEME` exactamente como antes de MIG-B6-19; un `theme` explícito (incluso `{}`) sigue ganando sobre cualquier descubrimiento; CSS nativo sin DSL compila sin cambios (cubierto por la suite compartida de `uxdsl-core`) |
| Cambios visuales o API / migración | Cambio de comportamiento real y documentado en `vite-plugin-uxdsl`: `import './panel.uxdsl'` ya no tiene default export útil (antes era el string de CSS) — quien lo necesitaba usa `import css from './panel.uxdsl?inline'` (la misma convención nativa de Vite para CSS). Se eliminó el modo `scss: 'auto'` (comportamiento silencioso dependiente de una instalación ajena de `sass`); `scss: 'on'` sigue disponible, ahora explícito únicamente. Se eliminó la inyección de los diez packs legacy `default-*`. `uxdsl-webpack-loader`: mismo CSS real de salida, pero ahora requiere `css-loader` en la cadena (ya documentado así en su README desde antes; ahora es correcto). API aditiva en ambos: opciones `discoverTheme`/`configRoot` nuevas (paralelas a MIG-B6-19). Sin cambios de API en `uxdsl-core`/`postcss-uxdsl` salvo la corrección interna de `checkImportCycles`/`createImportResolver` para usar `from` en vez de sólo `entry` (no observable desde ningún call site existente, sólo activa una garantía que antes no se cumplía) |
| README / CHANGELOG / migration | `packages/vite-plugin-uxdsl/README.md` (reescrito: CSS real, `?inline`, descubrimiento de tema, SCSS explícito); `packages/uxdsl-webpack-loader/README.md` (reescrito: dependencias reales, `getOptions()`, descubrimiento de tema); `packages/postcss-uxdsl/docs/migration.md` (sección "Desde beta.6: Vite y Webpack entregan CSS real..."); `scripts/release.js` (`uxdsl-webpack-loader` ahora coordina también con `postcss-uxdsl`, no sólo `uxdsl-core`, reflejando su nueva dependencia directa). No existe `CHANGELOG.md` propio en ninguno de los dos paquetes — documentado en su propio README, mismo patrón que MIG-B6-18/19 |
| AGENTS / guías / arquitectura | No aplica: cambio interno de integración de bundlers (Vite/Webpack), no toca ninguna primitiva de diseño ni el contrato de `AGENTS.md` de este repo |
| Límites y seguimiento | (1) Sourcemaps siguen sin implementar (MIG-B6-21, fuera de alcance) — `compile()` sigue rechazando cualquier valor de `sourceMap` distinto de `false`, y ninguno de los dos adaptadores lo pasa a Vite/Webpack. (2) No se probó Vite 3 o anteriores (fuera de alcance explícito de la story); el rango de `peerDependencies` no cambió. (3) El caso "proyecto con `postcss-uxdsl` también en su propio `postcss.config` además de `vite-plugin-uxdsl`" (mencionado en el punto 2 de "Implementación" como riesgo de doble pasada/tema duplicado) no se implementó como prevención automática ni se agregó un fixture dedicado — quedó documentado como combinación a evitar en el README de `vite-plugin-uxdsl`, no verificado con un test que cuente temas/fuentes duplicados; es la opción "configuración documentada" que la story ofrece como alternativa válida a resolverlo en código, pero el conteo explícito de duplicados no se escribió. (4) Los checks de "HMR real" están limitados al grafo de módulos de Vite (`moduleGraph.getModulesByFile`) y a la recompilación real de Webpack en modo watch — ninguno usa un navegador real ni verifica un re-render/computed-style visual; ambos fixtures declaran explícitamente qué nivel prueban. (5) `fixtures/parity/`'s `runVite`/`runWebpack` llaman `resolveId`/`load`/el loader directamente (rápido, sin bundler real) en vez de correr un `vite build`/`webpack build` real por cada uno de los 8 casos — la cobertura de bundler-real (extracción, rutas, HMR, watch) vive sólo en `fixtures/vite-adapter/`/`fixtures/webpack-adapter/`, con casos más acotados (no los 8 de paridad). (6) Durante esta story se encontró y corrigió un bug real preexistente de MIG-B6-18: `compile({ source, from })` no detectaba ciclos de `@import` (sólo `compile({ entry })` lo hacía) — como Webpack sólo usa `{ source, from }`, esto habría dejado el loader sin protección de ciclos; corregido en el mismo cambio con tests dedicados en `uxdsl-core`, documentado en migration.md. (7) **Se implementó sin esperar MIG-B6-29** (retiro de packs legacy), a pedido explícito del dueño para seguir el orden 20→23→24→26→28. El punto de contacto real entre ambas stories es acotado: esta story elimina la *inyección en runtime* de los diez packs `default-*` desde `vite-plugin-uxdsl` (nunca los "retira" del paquete — siguen existiendo en `packages/postcss-uxdsl/src/theme/` para quien los use vía `@theme`/legacy explícitamente, sin cambios). Ningún consumidor de este cambio depende de qué JSON base termine siendo el default una vez 29 aterrice; cuando 29 cambie `DEFAULT_THEME`, los adaptadores heredan el nuevo default automáticamente vía `resolveTheme()`, sin requerir cambios aquí. |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
