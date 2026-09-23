# MIG-B6-21 — Sourcemaps vía PostCSS

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | C — Un solo pipeline (**camino crítico**) |
| Prioridad · Tamaño | P2 · M |
| Cierra | UX-20. Reemplaza la mayor parte de MIG-B6-04 de FEAT-007 |
| Depende de | MIG-B6-18, MIG-B6-20, MIG-B6-23 (commit por archivo), MIG-B6-17 (orden de `index.ts`) |
| Bloquea | MIG-B6-12, MIG-B6-16, MIG-B6-27, MIG-B6-28 |
| Archivos | `packages/uxdsl-core/src/index.ts` (`compile`), `packages/postcss-uxdsl/src/index.ts` (nodos creados: ~762, ~809, `insert` de `applyTypo`, directivas), `surfaces.ts`, `control-engine.ts`, `packages/uxdsl-cli/bin/uxdsl.js`, los dos adaptadores |
| Coordinación | En `index.ts` después de 17 y antes de 28; 27 cambia tipos después. En `uxdsl.js`: 22 → 18 → 19 → 24 → 23 → 21 → 16 |

## Por qué

Ningún CSS generado tiene sourcemap: en las devtools, las reglas apuntan al CSS
compilado y no al `.uxdsl`. Con MIG-B6-18 ya no hay preprocesado por strings, así que
PostCSS conserva el origen de cada archivo importado. El sistema de segmentos que
diseñaba FEAT-007 deja de ser necesario. Falta:

- pedir el mapa;
- que los nodos generados hereden `source`;
- escribirlo en el CLI;
- pasarlo por los adaptadores.

## Reproducción

```bash
grep -n "map: false" packages/uxdsl-core/src/index.ts
grep -n "append({ prop: decl.prop" packages/postcss-uxdsl/src/index.ts   # nodos sin source
```

Tras MIG-B6-18, el CLI tampoco acepta ninguna opción de mapa.

## Resultado esperado

- **CLI:** `sourceMap: false | 'inline' | 'external'` en `uxdsl.config.cjs`, y los
  flags `--sourcemap`, `--sourcemap=inline` y `--no-sourcemap`. Precedencia: flag >
  config > `false`.
  - `external`: escribe `<outFile>.map` y agrega
    `/*# sourceMappingURL=<basename>.map */`.
  - `inline`: data URI, sin `.map`.
  - `false`: salida **idéntica byte a byte** al mismo compilador sin opción de mapa.
- En multi-entry, modo compartido: error de compilación/preparación no modifica
  salidas. Commit y recuperación siguen 23; no hay atomicidad de varios paths
  frente a lectores concurrentes o caída del proceso.
- El log informa por separado los bytes de CSS y los de mapa.

## Implementación

1. **`compile()`:** con `sourceMap`, pasar a PostCSS
   `map: { inline: false, annotation: false, sourcesContent }` y devolver
   `result.map.toString()`. Añadir `to?: string` y `sourcesContent?: boolean` a
   compile; CLI proporciona outFile absoluto como `to`. `sources` se resuelve
   respecto de la ubicación final del mapa externo (o CSS para inline), no del
   config. In-memory sin `to` usa una base documentada derivada de `from`; el
   adaptador rebasa al emitir. Evitar paths absolutos mediante to/map location,
   no recortando prefijos. `sourcesContent` vale true por defecto.
2. **Plugin:** todo nodo creado hereda el `source` del nodo que lo origina.
   - Declaraciones responsive: `cloned.append(...)` (~762) y `targetRule.append(...)`
     (~809) → `source: decl.source`.
   - Las reglas `@media` y las reglas clonadas → `source` de la declaración.
   - `applyTypo` (`insert`) → `source` de la directiva.
   - `@ds-surface`, `@ds-button` y `@ds-input`: si se generan con `postcss.parse(css)`,
     recorrer los nodos resultantes y asignarles el `source` de la directiva.
   - Globals generados sólo desde el tema (`:root`): sin línea de usuario. Quedan con
     un `source` que no finja una ubicación en el `.uxdsl`.
3. **CLI:** flag y config con el parseo estricto de MIG-B6-22. Escribir el `.map`
   junto al CSS con preparación/commit de MIG-B6-23. Cambiar external a inline/off
   retira sólo el mapa administrado de esa salida, sin borrar archivos ajenos.
4. **Vite:** devolver el mapa desde `load` para el id CSS y comprobar con la fixture
   que Vite lo encadena. Si no lo hace, **no** anunciar soporte y documentarlo.
   Prohibido devolver un mapa CSS como mapa del módulo JavaScript.
5. **Webpack:** deserializar el mapa string de compile y entregar el objeto por
   `callback(null, css, parsedMap)`; probar `css-loader` con sourceMap true y el
   encadenado de un mapa de entrada. Declarar explícitamente las opciones del
   adaptador que activan mapas; no ignorar `this.sourceMap`.

## Fuera de alcance

- Mapas para el CSS del tema generado en runtime (`ds-runtime`).
- Overrides de mapa por entrada.

## Pruebas

- Config en raíz, fuente en src y salida/mapa en dist/css: resolver sources desde
  URL final encuentra el archivo correcto. Repetir desde otro cwd y dos carpetas
  temporales; no afirmar reproducibilidad sólo porque paths son relativos.
- Consultar línea y columna, parcial anidado y sourcesContent false. Componer
  mapa entrante del loader cuando corresponda; callback Webpack recibe objeto.
- external → inline → false: anotación/archivos coherentes, sin mapas huérfanos ni
  borrar archivos ajenos. Fallos de escritura de 23.
- `sourceMap: false` se compara con el mismo compilador corregido sin opción;
  no exigir identidad con bugs/defaults de beta.5 que otras stories cambian.

Consultas reales al mapa con `SourceMapConsumer` (`source-map-js`, dependencia de
PostCSS):

- **`compile()`:**
  - una declaración normal → su línea en el `.uxdsl`;
  - una declaración generada por `density()` → la declaración original;
  - una regla de `@ds-button` → la línea de la directiva;
  - una declaración de un parcial importado → el parcial como `source` propio y su
    línea.
- **Rutas:** ninguna entrada de `sources` es absoluta.
- **CLI:**
  - `external`: el `.map` existe y la anotación es correcta;
  - `inline`: data URI;
  - `false`: salida idéntica al mismo compilador sin opción; comparar con el
    oráculo de paridad corregido según las stories integradas, no el bug original;
  - multi-entry con una entrada que falla → no se escribe ningún CSS ni `.map`.
- **Adaptadores:** las fixtures de MIG-B6-20 consultan una posición mapeada, o
  documentan que no hay soporte.

## Documentación

- `packages/uxdsl-cli/README.md`: opción y flags.
- `packages/uxdsl-core/README.md`: `sourceMap` en `compile()`.
- READMEs de los adaptadores: soporte real verificado.
- CHANGELOG beta.6.

## Criterios de aceptación

- [x] Las cuatro consultas de mapa aciertan en la línea.
      **(`uxdsl-core/test/compile.test.js`, "MIG-B6-21: every required map query
      lands on the right .uxdsl line" — con `SourceMapConsumer` real: declaración
      normal → línea 4, declaración reescrita por `density()` → línea 8 (la
      original), declaración generada por `@ds-button` → línea 12 (la directiva),
      declaración de un parcial importado → `partial.uxdsl` línea 2)**
- [x] `sourceMap: false` es idéntico byte a byte.
      **("MIG-B6-21: sourceMap: false is byte-identical to the same compiler
      without the option" compara `false`, opción omitida y `external` — los tres
      producen el mismo CSS, porque `external` deja la anotación al escritor.
      En el CLI, el test "no sourcemap option produces byte-identical CSS to
      --no-sourcemap" lo comprueba sobre la salida real en disco)**
- [x] Multi-entry no escribe ante error de compilación/preparación; recuperación
      de commit con mapas probada y límites de 23 documentados.
      **("MIG-B6-21: a multi-entry build that fails writes neither CSS nor map
      for any entry" — `dist/` queda vacío. `commitCompiled` trata CSS y `.map`
      como objetivos del mismo commit/rollback por archivo; los límites de 23
      (atomicidad por archivo, no transacción multi-archivo) siguen vigentes y
      se repiten en "Límites y seguimiento")**
- [x] Vite y Webpack sólo anuncian lo que sus fixtures prueban.
      **(Webpack: soporte verificado end-to-end en `fixtures/webpack-adapter/run.js`
      con `devtool: 'source-map'` + `css-loader`, resolviendo una posición real
      hasta `panel.uxdsl`; README lo declara. Vite: su fixture comprueba y
      **no** encuentra la fuente `.uxdsl` en el `.css.map` emitido, así que el
      README declara explícitamente que NO se anuncia soporte)**

## Verificación

```bash
npm --prefix packages/uxdsl-core test
npm --prefix packages/uxdsl-cli test
node fixtures/vite-adapter/run.js && node fixtures/webpack-adapter/run.js
npm run test:parity
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-21 - source maps through postcss, with generated nodes mapped to their directive`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente** en
`feat/feat-008-beta6-plan`. Integración a `main` pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `5f8cd34` (2026-09-22, HEAD de la rama al iniciar). Entrega: `7478f9d` en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | Sobre `5f8cd34`, los dos comandos de la propia ficha: `grep -n "map: false" packages/uxdsl-core/src/index.ts` → línea 303, `map: false` fijo en la llamada a PostCSS; y el CLI no aceptaba ninguna opción de mapa (`sourceMap` estaba *declarada* en `CompileConfig` desde MIG-B6-18 pero lanzaba `sourceMap option "inline" is not implemented yet`). Tres hallazgos al inventariar el estado real, que cambian lo que la ficha daba por pendiente: (a) el paso 2 ya estaba hecho en su mayor parte — MIG-B6-13 introdujo `inheritSource(node, at.source)` y las declaraciones responsive (`cloned.append`/`targetRule.append`, hoy líneas 874/921, no ~762/~809) ya llevaban `source: decl.source`, así que las cuatro consultas de mapa acertaron sin tocar esos sitios; (b) el `rule.append({ prop, value })` de las densidades (línea 592) no lleva `source` **a propósito** y así se deja: son globals sólo-de-tema, el caso que la propia ficha excluye; (c) lo que sí faltaba y la ficha no anticipaba: los siete bloques `postcss.parse(generate*Css(...))` daban a cada nodo un `Input` anónimo, que PostCSS listaba como siete "archivos fuente" con todo su cuerpo en `sourcesContent` — 58.366 bytes de mapa para una hoja de 30 líneas. 2026-09-22 |
| Criterio → regresión | Las cuatro consultas → `uxdsl-core/test/compile.test.js`, "MIG-B6-21: every required map query lands on the right .uxdsl line" (`SourceMapConsumer` real, una aserción de `source` + `line` por caso). Rutas → "no sources entry is absolute, and theme-only globals invent no source file" (ninguna absoluta; exactamente dos `.uxdsl`; cero `<input css …>`). Byte-identidad → "sourceMap: false is byte-identical to the same compiler without the option". Inline → "inline embeds the map as a data URI, last in the file, and returns it too" (una sola anotación, al final, y el base64 decodifica al mismo mapa devuelto). `sourcesContent` → "sourcesContent is included by default and omitted when turned off". Independencia del cwd → "sources resolve against the map location, from any cwd" (mismo resultado desde dos cwd distintos, resuelto contra la ubicación del mapa). CLI → ocho tests nuevos en `uxdsl-cli/test/uxdsl-cli.test.js` que cubren external/inline/off, el log con ambos tamaños, la precedencia flag > config > off, el rechazo de valores inválidos (incluido `--sourcemap=0`, que minimist convierte en el número 0), la retirada del mapa propio sin borrar un archivo ajeno en la misma ruta, y el multi-entry que falla sin escribir nada. Adaptadores → aserciones nuevas dentro de `fixtures/webpack-adapter/run.js` y `fixtures/vite-adapter/run.js`. El test de MIG-B6-18 que afirmaba "no implementado" se reescribió en vez de borrarse: ahora fija la mitad que no cambió (un valor no reconocido es error duro) y comprueba que los tres valores documentados se aceptan |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, desde el root del monorepo: `npm --prefix packages/uxdsl-core test` (exit 0, **27/27**, +6), `npm --prefix packages/uxdsl-cli test` (exit 0, **163/163**, +8), `node fixtures/vite-adapter/run.js` (exit 0), `node fixtures/webpack-adapter/run.js` (exit 0), `npm run test:parity` (exit 0, 8 casos — CLI, `compile()` y ambos adaptadores siguen coincidiendo con el oráculo), `npm test` (exit 0, 591 líneas `ok`), `npm run verify:beta2`/`beta3`/`beta4`/`beta5` (exit 0), `npm run verify:consumer-fixture` (exit 0), `npm run verify:vscode-extension` (exit 0) |
| Resultado después / control negativo | Las cuatro consultas aciertan: declaración normal → `entry.uxdsl` 4; `density()` → `entry.uxdsl` 8 (la original, no donde quedó el valor generado); `@ds-button` → `entry.uxdsl` 12 (la directiva); parcial importado → `partial.uxdsl` 2. `sources` pasó de 10 entradas (8 inventadas) a 3, y el mapa de 58.366 a **9.045 bytes (−85%)**. CLI end-to-end: `--sourcemap` → `out.css.map` + anotación final + log `built … (50854 bytes) + out.css.map (8702 bytes)`; `--sourcemap=inline` → data URI y ningún `.map`; sin opción → 50.818 bytes, exactamente los 36 de la anotación menos. **Controles negativos**: un archivo que *no* es un sourcemap colocado en `<outFile>.map` sobrevive intacto al cambiar de modo (sólo se retira un mapa que parsea como `version: 3` con `sources`); un `builds` con una entrada que falla deja `dist/` vacío; `--sourcemap=yes`, `--sourcemap=0` y `sourceMap: 'External'` fallan antes de compilar. **Resultado negativo real y aceptado**: la fixture de Vite comprueba el `.css.map` emitido y **no** encuentra la fuente `.uxdsl`, así que el soporte no se anuncia — la fixture imprime ese resultado en cada corrida en vez de asumirlo |
| Cambios visuales o API / migración | Sin cambio visual: con la opción apagada (el default) el CSS es byte-idéntico. API aditiva: `compile()` implementa `sourceMap` y devuelve `map`; el CLI gana `--sourcemap`/`--no-sourcemap` y `sourceMap` en config; el loader de Webpack entrega el mapa como objeto por `callback(null, css, map)`; el plugin de Vite devuelve el mapa del módulo CSS. Ningún default cambia, así que no hay receta de migración: un proyecto que no pida mapas compila exactamente igual que antes |
| README / CHANGELOG / migration | `packages/uxdsl-core/README.md` (`sourceMap`/`sourcesContent`/`to` en `compile()`, qué mapea cada nodo generado y por qué los globals del tema quedan sin mapear); `packages/uxdsl-cli/README.md` (nueva sección "Source maps" con los tres modos, precedencia, el log de dos tamaños, la retirada del mapa propio y el multi-entry, más la fila de `--sourcemap` en la tabla de parseo estricto de flags); `packages/uxdsl-webpack-loader/README.md` (soporte verificado, con qué lo verifica); `packages/vite-plugin-uxdsl/README.md` (declara explícitamente que **no** se anuncia soporte y por qué, y remite a CLI/Webpack); `packages/postcss-uxdsl/CHANGELOG.md` (entrada MIG-B6-21). `docs/migration.md` sin cambios: no hay nada que migrar cuando el default no cambia |
| AGENTS / guías / arquitectura | Sin cambio de contrato: `AGENTS.md` describe responsabilidades de primitivas y el contrato de tema/runtime, ninguno de los cuales cambia al añadir una opción de mapa opcional y apagada por defecto. No se tocó |
| Límites y seguimiento | (1) **Vite no propaga el mapa**, verificado, no supuesto: el plugin entrega un mapa correcto pero el pipeline CSS de Vite no lleva la fuente `.uxdsl` hasta el asset emitido. No se anuncia soporte; la fixture deja registro en cada corrida y pasará a afirmar la consulta real si una versión futura lo encadena. (2) **Mapas para el CSS de tema generado en runtime (`ds-runtime`) siguen fuera de alcance**, como dice la ficha. (3) **Sin overrides de mapa por entrada**: `sourceMap` es compartido por todo el build, igual que el tema. (4) **La atomicidad sigue siendo por archivo**, el límite que MIG-B6-23 ya documenta: CSS y `.map` se escriben y revierten juntos dentro del mismo commit, pero un lector concurrente puede observar una mezcla mientras un rollback está en curso; no es una transacción de varios paths. (5) **La retirada del mapa obsoleto usa una heurística deliberada** — mismo nombre *y* que parsee como sourcemap v3 — para no borrar nunca un archivo ajeno; el precio es que un `.map` propio corrupto no se limpia solo. (6) **Sin verificación en un navegador real**: lo verificado son consultas con `SourceMapConsumer` sobre el mapa emitido, que es lo que hace un devtools, pero no se abrió Chromium (limitación ya registrada en otras fichas de esta sesión) |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
