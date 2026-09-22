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

- [ ] Las cuatro consultas de mapa aciertan en la línea.
- [ ] `sourceMap: false` es idéntico byte a byte.
- [ ] Multi-entry no escribe ante error de compilación/preparación; recuperación
      de commit con mapas probada y límites de 23 documentados.
- [ ] Vite y Webpack sólo anuncian lo que sus fixtures prueban.

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
