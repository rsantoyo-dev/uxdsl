# MIG-B6-13 — Errores y avisos con ubicación

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | A — Diagnósticos veraces |
| Prioridad · Tamaño | P0 · M |
| Cierra | UX-03 |
| Depende de | — |
| Bloquea | MIG-B6-12, MIG-B6-14, MIG-B6-25 |
| Archivos | `packages/postcss-uxdsl/src/index.ts`, `preset-engine.ts`, `control-engine.ts`, `surfaces.ts`, `reference-integrity.ts`, nuevo `src/diagnostics.ts`, `packages/uxdsl-cli/bin/uxdsl.js` |
| Coordinación | Primero en la secuencia de `index.ts` (13 → 14 → 15 → 17 → 21). En `reference-integrity.ts` va antes que MIG-B6-25 |

## Por qué

Ningún error `UXD_*` dice dónde está el problema. Los errores de sintaxis de
PostCSS sí traen archivo, línea y columna, así que el mismo build muestra la
ubicación de un `}` faltante pero no la de un token mal escrito. En módulos de
miles de líneas, cada error obliga a buscar a mano.

## Reproducción

```bash
npm --prefix packages/postcss-uxdsl run build
node -e "
const postcss = require('./packages/postcss-uxdsl/node_modules/postcss');
const uxdsl = require('./packages/postcss-uxdsl/dist');
for (const css of ['.a {\n  padding: density(16);\n}', '.a {\n  color: palette(primry);\n}', '.a {\n  border-radius: radius(md);\n}'])
  postcss([uxdsl({ includeTheme: false })]).process(css, { from: '/proj/src/panel.uxdsl' })
    .then(() => console.log('OK'), e => console.log(e.message.split('\n')[0], '| file:', e.file, '| line:', e.line));
"
```

Salida actual:

```
UXD_DENSITY_REFERENCE: Invalid key 16; define and use a token key without decimal coercion. | file: undefined | line: undefined
UXD_REFERENCE_MISSING: color -> --uxdsl__palette__primry-main has no definition in the active theme/scope. … | file: undefined | line: undefined
UXD_EDGE_REFERENCE: Undefined radius md. | file: undefined | line: undefined
```

El CLI tampoco nombra el parcial. Con `src/a.uxdsl` = `@import "./partial.uxdsl";`
y `padding: density(16);` en la línea 3 de `src/partial.uxdsl`, `uxdsl build` imprime
sólo `[uxdsl] Error: UXD_DENSITY_REFERENCE: …`.

## Causa

- Los errores se lanzan con `throw new Error(...)` desde funciones que no reciben el
  nodo:
  - `rewriteFuncs` (`index.ts:663`, `:699`, `:707`, `:715`);
  - `normalizeTokenKey` y `presetValueToCss` (`preset-engine.ts:7`, `:24`);
  - `fail()` de `control-engine.ts:18`;
  - `surfaces.ts` (líneas 48 a 152).
- `ReferenceIntegrityError` (`reference-integrity.ts:23-28`) arma el mensaje con
  `issue.message` y descarta `source`, `line` y `column`, aunque `ReferenceIssue` los
  guarda.
- En modo `warn`, `index.ts:842` llama `result.warn(issue.message, { plugin })` sin
  `node`.
- Algunos códigos se arman con un prefijo dinámico: `UXD_${FAMILY}` en
  `control-engine.ts:17` y `${errorPrefix}_ALPHA|_MAP|_VALUE` en `preset-engine.ts`.
  Un grep de literales no los encuentra.

## Resultado esperado

- Todo error que nace en el CSS del usuario trae archivo, línea y columna del
  archivo de origen (el parcial, si viene de un import) y el fragmento de código que
  PostCSS agrega a `CssSyntaxError`.
- Todo error que nace en el tema trae la ruta de la clave (por ejemplo
  `typography_details.h1.fontsize`).
- Los mensajes dicen qué valores son válidos.

## Implementación

1. Crear `src/diagnostics.ts` con:
   - el catálogo de códigos: los literales y los compuestos por prefijo;
   - un helper que convierte un error de UXDSL en `node.error(message, { word })`,
     con el código al inicio del mensaje y el error original en `cause`;
   - un helper de distancia de edición para sugerencias. MIG-B6-14 lo reutiliza.
2. En `index.ts`, envolver cada punto que procesa una declaración o una directiva
   para que los errores de los helpers se relancen con el nodo:
   - la fase `rewriteFuncs` de `walkDecls` (~730);
   - la pasada final (~829);
   - `applyTypo`;
   - los `walkAtRules` de `ds-input`, `ds-surface` y `ds-button` (586-640).

   Los helpers pueden seguir lanzando `Error` simple: la ubicación la agrega quien
   los llama.
3. `ReferenceIntegrityError`: cada línea del mensaje empieza con
   `ruta:línea:columna`. Se conserva `.issues`. En modo `warn`, pasar el nodo a
   `result.warn(message, { node, plugin })`.

   **Decisión de arquitectura (registrada tras revisión de código):** la ruta es
   exactamente `node.source.input.file` — lo que PostCSS resolvió a partir de la
   opción `from`, sin relativizar contra `process.cwd()` en el motor. El motor es
   browser-safe (sin globals de Node); relativizar contra cwd para mostrarla en
   terminal es responsabilidad exclusiva del CLI, ya resuelta por
   `formatCliDiagnostic` en `packages/uxdsl-cli/bin/uxdsl.js`. No reintroducir
   `process.cwd()`/`path.relative` en `packages/postcss-uxdsl/src/`.
4. Mensajes accionables, sin cambiar los códigos:
   - `density(16)` → `UXD_DENSITY_REFERENCE: density(16) does not exist; available keys: 0–15`.
     Usar las claves reales de `effectiveDensities` y un rango compacto cuando sean
     consecutivas.
   - `radius`, `shadow` y `border`: la misma forma, con sus claves (`0–5`, `1–5`).
   - `palette`, `color` y `space`: agregar `did you mean "primary"?` cuando hay una
     clave definida a distancia de edición ≤ 2.
5. Errores del tema (los que validan el objeto del tema en `typography.ts`,
   `language.ts` y `surfaces.ts`): incluyen la ruta de la clave. El CLI antepone la
   ruta del archivo de tema cuando la conoce (`loadConfig` resuelve
   `themeConfigPath`).
6. `uxdsl.js`, `catch` de `main()` (~1357): un `CssSyntaxError` ya trae la ubicación
   en `message`. Comprobar que el prefijo `builds[i] (…)` de `buildOnce` no la tape y
   que se imprima el fragmento (`err.showSourceCode()` cuando exista).

## Fuera de alcance

- El formato estructurado completo `UxdslDiagnostic` (MIG-B6-03 de FEAT-007, después
  de 0.5.0). Aquí sólo entran el catálogo y la garantía de ubicación.
- Traducir mensajes: siguen en inglés.

## Pruebas

- Directiva que genera una referencia inválida y `$var` expandida conservan el
  origen del usuario; copiar source mínimo aquí cuando haga falta para diagnóstico,
  sin esperar a 21. 21 completa mapas. Error de JSON nombra archivo y key, sin
  inventar línea CSS ni pasar un nodo inexistente al helper.
- Catálogo distingue códigos de CSS, tema, runtime y config; ubicar según origen,
  no exigir file/line a una llamada runtime sin archivo. Códigos dinámicos se
  registran desde sus prefijos de familia, con casos ejecutables.

- `test/diagnostics-catalog.test.js`: un script descubre en `src/` cada código
  emitido, literal o compuesto. El test falla si hay un código fuera del catálogo o
  un código del catálogo sin fixture.
- `test/diagnostics-location.test.js`: una fixture por código que puede nacer en el
  CSS. Debe cumplirse:
  - errores de una declaración/directiva: `err.name === 'CssSyntaxError'`;
    errores agregados de referencias conservan `ReferenceIntegrityError` e `.issues`;
  - `err.file`, `err.line` y `err.column` están definidos;
  - `reason` contiene el código al inicio; `message` de PostCSS puede anteponer
    plugin/archivo/posición, no exigirle empezar por UXD;
  - `err.cause` existe cuando el error se envolvió.
- Códigos que nacen en el tema: el mensaje contiene la ruta de la clave.
- `ReferenceIntegrityError`: cada línea empieza con `archivo:línea:columna`. En modo
  `warn`, `result.warnings()[i].line` está definido.
- CLI (`uxdsl-cli.test.js`): un error en un parcial importado nombra el parcial y la
  línea 3.
- Mensajes: `density(16)` lista `0–15` y `palette(primry)` sugiere `primary`.

## Documentación

- `packages/postcss-uxdsl/README.md`: sección de errores con un ejemplo de salida
  con ubicación.
- `packages/uxdsl-cli/README.md`: igual para el CLI.
- CHANGELOG beta.6.

## Criterios de aceptación

- [x] Las tres reproducciones traen `file`, `line` y `column`.
- [x] El error en un parcial nombra el parcial.
- [x] El test de catálogo falla ante un código nuevo sin fixture.
- [x] Si un test existente que compara mensajes cambió, el PR explica por qué.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm --prefix packages/uxdsl-cli test
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-13 - every UXD_* diagnostic carries its source location`

## Registro de implementación y evidencia

### Revisión 2026-09-20 — base parcial, no cerrada (histórico)

Base `60fdd76599fcc62b7da48d4770f576de2b4d0062` más cambios locales sin commit.
Los bloqueos anteriores de `node:path`, iteración ES5 y códigos compuestos ausentes
ya no se reproducían; los tests de ubicación cubrían declaraciones generadas por
directivas. Cuatro pendientes quedaron registrados para el siguiente agente:
claves de tema sin `keyPath` en surfaces/densities/radii, un catálogo que no exigía
fixture por código, una matriz criterio→caso incompleta ($var, `cause`, rutas de
tema), y documentar la decisión de mantener el motor browser-safe. Los cuatro se
cierran en la revisión de 2026-09-21 de abajo.

### Revisión 2026-09-21 — cierra los cuatro pendientes

**1. Claves de tema.** `themeError` (ya usado en `typography.ts`) ahora también
se usa en `surfaces.ts` (`getSurfaceTokens`: `UXD_SURFACE_MAP`/`_ROLE`/`_FIELD`)
y `language.ts` (`getDensityTokens`: `UXD_DENSITY_MAP`/`_VALUE`). `mergePresetTokens`
(`preset-engine.ts`) ganó un `keyPathPrefix` opcional — sin romper a sus llamadores
existentes (`surfaces.ts`, `control-engine.ts`, que no lo pasan) — usado por
`edges.ts` (`radii`/`borders`) y `shadows.ts` (`shadows`). Las tres reproducciones
exactas de la revisión, más `borders`/`shadows` (mismo patrón, no pedidos pero
igual de baratos de arreglar), ahora traen `.keyPath` y `(at family.key)` en el
mensaje; el CLI (`annotateThemeError`, ya existente) antepone la ruta del archivo
de tema automáticamente en cuanto `.keyPath` está presente — no necesitó cambios,
solo que las fuentes empezaran a poblar `.keyPath`. **Gap conocido, no cerrado:**
los errores de rol/estado de Button/Input (`UXD_BUTTON_*`/`UXD_INPUT_*` en
`control-engine.ts`) siguen sin `keyPath` — su anidamiento (role.base/states.estado.campo)
hace el fix bastante más grande que el de surfaces/densities/edges/shadows y quedó
fuera de esta pasada; el README lo dice explícitamente.

**2. Catálogo y fixtures.** `diagnostics-catalog.test.js` ahora también comprueba
la dirección inversa (todo código del catálogo debe poder producirse desde `src/`,
literal o compuesto) y rechaza un emisor `${prefix}_SUFFIX` en un archivo no
inventariado en `COMPOSED_PREFIXES_BY_FILE` (antes ambos pasaban en silencio). La
lógica de escaneo se extrajo a `scanDiagnosticCodes()`, con fixtures positivas y
negativas propias (no solo "hoy no hay violaciones en `src/`"). Ejecutándolo de
verdad encontró dos problemas reales: `UXD_PRESET_VIEWPORT` nunca se emite (ningún
llamador de `preset-engine.ts` omite `errorPrefix`, así que el default `'UXD_PRESET'`
nunca se usa) — se quitó del catálogo; `UXD_TOKEN_ALPHA` sí se emite
(`index.ts` llama `presetValueToCss(..., 'UXD_TOKEN', ...)`) pero no había forma de
confirmarlo con el inventario por archivo — se agregó un escaneo dedicado para
llamadas a `presetValueToCss` con prefijo literal. **Gap conocido, no cerrado:**
los otros cinco `UXD_PRESET_*` (`ALPHA`/`MAP`/`VALUE`/`BP`/`BASE`/`NAME_COLLISION`)
quedan en el catálogo sin confirmar reachability — la aproximación textual no
distingue "este archivo define la plantilla" de "algún llamador realmente usa este
prefijo", y `preset-engine.ts` se auto-satisface al listarse a sí mismo con
`UXD_PRESET` en el inventario; requeriría análisis de call-graph, no solo texto.
Tampoco es literalmente "una fixture ejecutable por código" (la palabra exacta del
hallazgo P2) — es una prueba de alcanzabilidad textual más fuerte que antes, no un
`postcss.process()` real por cada uno de los ~85 códigos del catálogo.

**3. Matriz criterio → caso ejecutable.** Se agregaron los dos casos que
`Pruebas` pedía y no existían: expansión `$var` (una referencia inválida alcanzada
solo a través de `$bad: density(16); .a { padding: $bad; }` conserva la ubicación
de la declaración que consume la variable, no la que la declara) y `.cause`
(un error CSS localizado conserva el error original sin envolver en `.cause`).

**4. Motor browser-safe.** El motor nunca relativizaba contra `process.cwd()`
(confirmado: cero ocurrencias de `process.cwd`/`node:path` en
`reference-integrity.ts`, y el test `reference-integrity.test.js` ya lo garantizaba);
solo faltaba registrar la decisión. Se documentó en el punto 3 de "Implementación"
de esta ficha y con un comentario en `formatReferenceIssue` (`reference-integrity.ts`).

No se cambió la semántica de ningún código existente ni el formato de mensajes ya
comparados por un test — los mensajes que ganaron `(at key.path)` no tenían ningún
test anterior que comparara su forma exacta (verificado corriendo la suite completa
antes y después: 0 fallos en ambos casos, mismo conteo salvo los tests nuevos).

Estado de implementación: **Cerrada** (con los dos gaps conocidos documentados
arriba, no bloqueantes: Button/Input keyPath y los cinco `UXD_PRESET_*` restantes).
Completar el resto en una story de seguimiento si se decide que valen la pena, no
como parte de reabrir 13.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `887622c` (MIG-B6-13 previo, catálogo+ES5 fix); entrega en `afa571f` en `feat/feat-008-beta6-plan`; sin PR abierto todavía |
| Reproducción antes del cambio | Los tres repros exactos de la revisión 2026-09-20, ejecutados contra `887622c` vía `postcss([uxdsl({ theme })]).process('.a {}', { from: '/tmp/review.uxdsl' })`: `{ surfaces: { contained: { bogus: 'red' } } }` → `UXD_SURFACE_FIELD: Unknown contained.bogus.` sin `.keyPath`; `{ densities: { x: '' } }` → `UXD_DENSITY_VALUE: Invalid x.` sin `.keyPath`; `{ radii: { '1': '' } }` → `UXD_EDGE_VALUE: Invalid token 1.` sin `.keyPath`. Fecha: 2026-09-21. |
| Criterio → regresión | Claves de tema → `packages/postcss-uxdsl/test/diagnostics-location.test.js`: 8 casos parametrizados "carries the theme key path" (surfaces×3, densities×2, radii, borders, shadows) + 2 tests CLI nuevos en `error-location.test.js` ("theme file location for UXD_*") × 4 familias. Catálogo → `diagnostics-catalog.test.js`: "every literal or family-prefix UXD code is cataloged" (con el nuevo chequeo de códigos obsoletos y de archivos no inventariados) + 3 tests directos de `scanDiagnosticCodes`. $var/`cause` → los dos tests nuevos homónimos en `diagnostics-location.test.js`. |
| Comandos y entorno | `node --test packages/postcss-uxdsl/test/*.test.js` (macOS, Node del repo): 179/179, exit 0. `npm --prefix packages/uxdsl-cli test`: 131/131, exit 0. `npm run verify:beta5` (5 tarballs reales): 4/4 PASS, exit 0. `npm test` desde la raíz: 332 subtests, 0 fallos, exit 0. Mutación probada manualmente: reintroducir `UXD_PRESET_VIEWPORT` en el catálogo hace fallar "every literal or family-prefix UXD code is cataloged" (confirmado y revertido, `git diff` limpio). |
| Resultado después / control negativo | Los tres repros ahora traen `.keyPath` (`surfaces.contained.bogus`, `densities.x`, `radii.1`) y `(at ...)` en el mensaje; el CLI antepone `uxdsl.theme.config.cjs:` automáticamente (probado end-to-end vía `spawnSync`). El catálogo detecta (control negativo real, no solo teórico) un código nunca emitido (`UXD_PRESET_VIEWPORT`, eliminado) y una omisión de inventario (`UXD_TOKEN_ALPHA`, resuelta con un escaneo dedicado en vez de ensanchar el inventario por archivo, lo que habría generado falsos positivos para `UXD_TOKEN_MAP`/`_VALUE`/`_BP`/`_BASE` — verificado y corregido durante esta misma revisión). |
| Cambios visuales o API / migración | Ningún cambio visual ni de superficie pública de API. Cambio de comportamiento de diagnóstico (mensajes más largos con `(at key.path)`, un código de catálogo menos): documentado en `packages/postcss-uxdsl/README.md` (§Diagnostics) y `packages/uxdsl-cli/README.md` (§Diagnostics), ambos con ejemplo de salida real. Sin CHANGELOG: MIG-B6-13 (la entrega original que introdujo el catálogo) tampoco lo tenía todavía en `main`; se deja para cuando esa entrega registre su propio CHANGELOG. |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md` (§Diagnostics, ejemplo con `radii.1` y lista explícita de qué familias tienen keyPath hoy); `packages/uxdsl-cli/README.md` (§Diagnostics, mismo ejemplo end-to-end vía CLI). `docs/features/FEAT-008/MIG-B6-13-errores-con-ubicacion.md` (esta ficha), punto 3 de Implementación actualizado con la decisión de arquitectura. |
| AGENTS / guías / arquitectura | Sin cambio de contrato de AGENTS.md. Decisión de arquitectura registrada (browser-safe boundary, ver punto 4 arriba) en la propia ficha y como comentario en `reference-integrity.ts`, no en AGENTS.md — es una decisión de implementación de este paquete, no una regla transversal del repo. |
| Límites y seguimiento | Dos gaps conocidos documentados en la sección de arriba (Button/Input keyPath; cinco `UXD_PRESET_*` sin reachability confirmada) — ninguno bloquea el cierre de esta story porque ninguno estaba entre los tres repros exactos ni en los criterios de aceptación tal como están redactados; quedan anotados para quien retome MIG-B6-14/25 (que dependen de esta) o una futura limpieza de catálogo. El check de catálogo sigue siendo un escaneo de texto, no ejecuta cada código realmente — más fuerte que antes, no una prueba de alcanzabilidad en runtime completa. |

Si cambia un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
