# MIG-B6-21 — Sourcemaps vía PostCSS

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | C — Un solo pipeline (**camino crítico**) |
| Prioridad · Tamaño | P2 · M |
| Cierra | UX-20. Reemplaza la mayor parte de MIG-B6-04 de FEAT-007 |
| Depende de | MIG-B6-18, MIG-B6-20, MIG-B6-23 (escritura atómica), MIG-B6-17 (orden de `index.ts`) |
| Bloquea | MIG-B6-12 |
| Archivos | `packages/uxdsl-core/src/index.ts` (`compile`), `packages/postcss-uxdsl/src/index.ts` (nodos creados: ~762, ~809, `insert` de `applyTypo`, directivas), `surfaces.ts`, `control-engine.ts`, `packages/uxdsl-cli/bin/uxdsl.js`, los dos adaptadores |
| Coordinación | Último en la secuencia de `index.ts`. En `uxdsl.js` va después de MIG-B6-23 (22 → 18 → 19 → 24 → 23 → 21 → 16) |

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
  - `false`: salida **idéntica byte a byte** a la anterior.
- En multi-entry, el modo es compartido, y CSS y mapas se escriben juntos o no se
  escribe nada.
- El log informa por separado los bytes de CSS y los de mapa.

## Implementación

1. **`compile()`:** con `sourceMap`, pasar a PostCSS
   `map: { inline: false, annotation: false, sourcesContent }` y devolver
   `result.map.toString()`. Las rutas de `sources` son relativas al directorio del
   config (reproducibles, sin rutas absolutas). `sourcesContent` es configurable y vale
   `true` por defecto.
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
   junto al CSS con la escritura atómica de MIG-B6-23.
4. **Vite:** devolver el mapa desde `load` para el id CSS y comprobar con la fixture
   que Vite lo encadena. Si no lo hace, **no** anunciar soporte y documentarlo.
   Prohibido devolver un mapa CSS como mapa del módulo JavaScript.
5. **Webpack:** `callback(null, css, map)`; `css-loader` con `sourceMap: true` lo
   consume. Verificarlo con la fixture.

## Fuera de alcance

- Mapas para el CSS del tema generado en runtime (`ds-runtime`).
- Overrides de mapa por entrada.

## Pruebas

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
  - `false`: salida idéntica a la de la versión anterior (comparar contra el oráculo
    de `fixtures/parity/`);
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
- [ ] Multi-entry es atómico con mapas.
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
