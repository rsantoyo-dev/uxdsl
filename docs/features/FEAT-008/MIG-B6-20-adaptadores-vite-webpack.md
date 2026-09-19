# MIG-B6-20 — Adaptadores Vite y Webpack sobre `compile()`

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | C — Un solo pipeline (**camino crítico**) |
| Prioridad · Tamaño | P1 · L |
| Cierra | N-03, N-04, el resto de UX-16. Aplica D-4 |
| Depende de | MIG-B6-18 (`compile()`), MIG-B6-19 (cargador de configuración), MIG-B6-29 (retiro de packs legacy) |
| Bloquea | MIG-B6-21, MIG-B6-12 |
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
     compilado. Verificar que eso es idempotente (no quedan funciones de UXDSL) o
     documentar cómo excluir los `.uxdsl`.
3. **Webpack:**
   ```js
   module.exports = async function uxdslLoader(source) {
     const callback = this.async();
     try {
       const options = this.getOptions();
       const config = { ...loadConfig(this.rootContext), ...options }; // MIG-B6-19
       const { css, map, dependencies } = await compile({ source, from: this.resourcePath }, config);
       dependencies.forEach((dep) => this.addDependency(dep));
       callback(null, css, map);
     } catch (err) { callback(err); }
   };
   ```
4. Agregar Vite y Webpack a `fixtures/parity/`.
5. **D-4:** el tema llega por la configuración del proyecto o por `uxdsl.theme.json`,
   y el resultado es idéntico en los cuatro caminos. El live theming (MIG-B6-30)
   trabaja sobre variables CSS, así que no depende de la entrega.

## Fuera de alcance

- Sourcemaps (MIG-B6-21).
- Soporte de Vite 3 o anteriores. El rango de `peerDependencies` no cambia salvo que
  la fixture lo exija.

## Pruebas

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

- [ ] Vite extrae CSS real y hay HMR al editar un parcial.
- [ ] El build de producción no contiene rutas absolutas.
- [ ] Webpack declara dependencias y se encadena con `css-loader`.
- [ ] La paridad pasa por los cuatro caminos.
- [ ] El tema del proyecto se aplica en Vite y en Webpack.

## Verificación

```bash
node fixtures/vite-adapter/run.js
node fixtures/webpack-adapter/run.js
npm run test:parity
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-20 - vite and webpack deliver real css through compile(), with dependencies and the project theme`
