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
   `ruta/relativa.uxdsl:línea:columna` (relativa a `process.cwd()`). Se conserva
   `.issues`. En modo `warn`, pasar el nodo a `result.warn(message, { node, plugin })`.
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

- [ ] Las tres reproducciones traen `file`, `line` y `column`.
- [ ] El error en un parcial nombra el parcial.
- [ ] El test de catálogo falla ante un código nuevo sin fixture.
- [ ] Si un test existente que compara mensajes cambió, el PR explica por qué.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm --prefix packages/uxdsl-cli test
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-13 - every UXD_* diagnostic carries its source location`

## Registro de implementación y evidencia

### Revisión 2026-09-20 — base parcial, no cerrada

Base `60fdd76599fcc62b7da48d4770f576de2b4d0062` más cambios locales sin commit.
Los bloqueos anteriores de `node:path`, iteración ES5 y códigos compuestos ausentes
ya no se reproducen: `npm test` exit 0 y build Next.js completo exit 0
(`/tmp/uxdsl-b6-close-tests.log`, `/tmp/uxdsl-b6-close-next.log`, logs locales).
Los tests de ubicación cubren ahora declaraciones generadas por directivas.
El README limita correctamente sus garantías para errores de tema sin key path.

Pendientes para cerrar la historia completa:

- **P2 — claves de tema:** `{ surfaces: { contained: { bogus: 'red' } } }`
  produce `UXD_SURFACE_FIELD: Unknown contained.bogus.` sin `keyPath`;
  `{ densities: { x: '' } }` produce `UXD_DENSITY_VALUE: Invalid x.` sin
  `keyPath`. `{ radii: { '1': '' } }` tampoco identifica `radii.1`.
  Reproducido con `postcss([uxdsl({ theme })]).process('.a {}', { from:
  '/tmp/review.uxdsl' })`. Incluir la ruta completa sin inventar ubicación CSS,
  y probar archivo de tema en CLI. Un README acotado no satisface este contrato.
- **P2 — catálogo y fixtures:** el guard actual comprueba literales y
  combinaciones de prefijos/sufijos inventariados, pero no exige una fixture
  ejecutable por código. Añadir un código al Set sin fixture sigue pasando;
  tampoco rechaza por sí mismo un emisor compuesto en un archivo sin inventario.
  Añadir controles negativos de ambas situaciones y clasificación por origen.
- Completar la matriz criterio → caso ejecutable, incluida expansión `$var`,
  `cause`, rutas de tema y códigos restantes; no sustituirla por el PASS global.
- Mantener el motor browser-safe: rutas relativas a cwd pertenecen a la CLI.
  Ajustar el punto 3 del contrato al registrar esa decisión, sin reintroducir Node
  en el runtime compartido.

No se cambió la implementación de 13 durante esta revisión. Los pendientes se
registran aquí para el siguiente agente; 01 se verifica de forma independiente.

Estado de implementación: **En curso; base parcial verificada, pendientes arriba**
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
