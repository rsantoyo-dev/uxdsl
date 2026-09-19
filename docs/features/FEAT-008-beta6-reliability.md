# FEAT-008 — UXDSL 0.5.0-beta.6: confiabilidad antes de estable

| Campo | Valor |
| --- | --- |
| Estado | Plan aprobado. El dueño respondió D-1 a D-7 entre el 2026-09-18 y el 2026-09-19 (ver "Decisiones tomadas"). Las 21 stories tienen ficha para agentes en [`FEAT-008/`](FEAT-008/README.md). Nada implementado salvo lo que ya existe en el árbol local para MIG-B6-01 (parcial) |
| Objetivo | Cerrar todos los fallos de corrección y confiabilidad de la auditoría externa de beta.5 y los encontrados al verificarla, para que beta.6 pueda convertirse en `0.5.0-rc.1` sin trabajo funcional pendiente |
| Versión objetivo | `0.5.0-beta.6` para los cinco paquetes npm coordinados; `uxdsl-vscode@0.1.0` con versión propia |
| Relación con FEAT-007 | Reemplaza el alcance de FEAT-007 para beta.6. Conserva MIG-B6-01, MIG-B6-02 y MIG-B6-12 (re-alcanzado); difiere MIG-B6-03 a MIG-B6-11 a después de `0.5.0` (ver "Qué queda fuera") |
| Prioridad | P0: diagnósticos veraces, JSON base como única fuente de defaults, pipeline único, flags de CI, higiene de npm. P1: salida correcta, watch, rendimiento, configuración compartida, editor. P2: sourcemaps, tipos |
| Depende de | FEAT-006 (`0.5.0-beta.5`), publicada |
| Origen | Auditoría externa "Auditoría UXDSL 0.5.0-beta.5" (proyecto Press Craftor, 2026-09-18) y su verificación contra `main` el 2026-09-18, que confirmó los hallazgos y agregó ocho nuevos (N-01 a N-08) |
| Publicación | Fuera de la implementación automática. Requiere aprobación explícita del dueño después de ejecutar todos los gates |

---

## Resumen ejecutivo

### ¿Cabe todo en una feature?

**Sí, si la feature es sólo confiabilidad. No, si además incluye FEAT-007 completa.**

- Los 21 hallazgos de la auditoría más los 8 nuevos son, en su mayoría, correcciones
  acotadas: 21 stories, de las cuales 7 son chicas, 1 chica-mediana, 10 medianas y 3
  grandes. Caben en una beta si se ejecutan en paralelo por tracks, como propone
  este documento.
- FEAT-007 agrega trabajo de otra naturaleza: contrato 1.0, un sistema de
  procedencia de segmentos, servidor de lenguaje, benchmarks, migradores de
  Tailwind/MUI/Sass y un paquete frontal. Su propia tabla de riesgos ya advierte
  "beta.6 demasiado grande → release bloqueado indefinidamente". Sumado a la
  auditoría, esa advertencia se cumple.
- Además, escribir el contrato 1.0 **antes** de corregir estos fallos obligaría a
  documentar comportamiento que se va a cambiar (claves de palette mezcladas,
  directivas ignoradas, flags que no validan) y luego reescribirlo.

### Ruta recomendada a 0.5.0

1. **beta.6 = esta feature.** Cero fallos silenciosos, un solo pipeline de
   compilación, CLI estricto, npm limpio.
2. **Congelamiento → `0.5.0-rc.1`** cuando la Definition of done esté en verde. A
   partir de ahí sólo entran correcciones.
3. **rc.1 en Press Craftor durante al menos una semana** (builds diarios, `watch` en
   desarrollo, CI) sin P0/P1 nuevos.
4. **`0.5.0` estable** y `latest` apunta a ella.
5. **FEAT-007 re-apuntada a `0.6.0`/1.0**: contrato, tooling con conciencia del
   tema, benchmarks, migradores.

Regla de cadencia: no publicar una beta nueva hasta que la anterior se haya usado en
al menos un proyecto real. beta.0 a beta.5 salieron en 71 horas y casi todas
corrigieron deriva de la anterior; nadie alcanzó a validarlas.

---

## Estado verificado contra `main` (2026-09-18)

Cada fila se reprodujo ejecutando código del árbol actual: el plugin compilado, el
CLI del monorepo, `uxdsl-core` y los registros de npm. Ninguna se infiere sólo de
leer el código, salvo donde se indica. Las reproducciones se convierten en tests de
regresión dentro de la story que cierra cada hallazgo.

| ID | Hallazgo | Estado | Evidencia en `main` | Story |
| --- | --- | --- | --- | --- |
| UX-01 | Avisos falsos de claves desconocidas | **Parcial** | El aviso de claves anidadas está retirado en el árbol local. `modes` y `typography` siguen avisando: `uxdsl build` imprime `Unknown theme family "modes"` y `"typography"`, y ambas sí se compilan (`foundations.ts:55`, `typography.ts:91`) | MIG-B6-01 |
| UX-02 | `uxdsl-core` corrompe `url(https://…)` y comentarios con URL | Abierto | La entrada de la auditoría sale cortada en `url(https:` y el comentario queda abierto | MIG-B6-18 |
| UX-03 | Errores sin archivo:línea | Abierto | `density(16)`, `palette(primry)` y `radius(md)` con `from` definido lanzan errores sin `file`/`line`/`column`. En el CLI, un error dentro de un parcial importado no nombra el parcial | MIG-B6-13 |
| UX-04 | Flags de CI ignorados | Abierto | `--include-theme=false` emite 4 bloques `:root`. `--strict-theme=true`, `--strict-theme=pallete` y `theme --strict=true` terminan con exit 0. Un flag inexistente (`--strict-thme`) también da exit 0 | MIG-B6-22 |
| UX-05 | `@ds-button`/`@ds-input` rompen `:is()`/`:where()`/`:not()`/`:has()` | Abierto | Salida: `.btn:is(.x:hover, .y):hover` | MIG-B6-15 |
| UX-06 | Directivas sin procesar llegan al CSS | Abierto | `@ds-surface` en la raíz, dentro de `@media` anidado, `@ds-surfce` y `@ds-h1` salen tal cual. Además, un comentario de `index.ts` promete los alias `@ds(h1)` y `@ds-h1`, que no existen | MIG-B6-14 |
| UX-07 | `!important` perdido en overrides responsive | Abierto | `@media (min-width: 768px) {.a { padding: 2rem; } }` sin `!important` | MIG-B6-15 |
| UX-08 | Palette parcial mezcla la marca con defaults | Abierto | `resolveTheme({palette:{primary:{main:'#00aa00'}}})` → `dark: '#581c87'` (morado) | MIG-B6-16 |
| UX-09 | `@ds-typo` actúa como reset | Abierto | Emite `margin-block-*: …, auto`, `text-decoration: …, none` y `opacity: …, 0.8` en `caption` | MIG-B6-17 |
| UX-10 | Validación de referencias cuadrática | **Abierto, peor que lo reportado** | Módulo sintético con `palette()`, `density()`, responsive, `@ds-typo` y `@ds-surface`: 3.000 líneas 762 ms (sin referencias: 73 ms); 6.000 → 2.015 ms (107); 12.000 → 13.700 ms (180); 24.000 → **54.977 ms** (358) | MIG-B6-25 |
| UX-11 | Watch frágil | Abierto | Con error en el primer build, `uxdsl watch` termina con exit 1. Un rebuild sin cambios reescribe la salida (cambia el mtime). La escritura es `writeFileSync` directo, sin archivo temporal | MIG-B6-23 |
| UX-12 | `builds` emite el tema en cada entrada, sin aviso | Abierto | Dos entradas sin `includeTheme`: `panel.module.css` sale con `:root` y no hay aviso | MIG-B6-24 |
| UX-13 | `init` escribe breakpoints que anulan los del tema | **Abierto, también sin `--multi`** | `uxdsl init` (modo simple) + `theme.breakpoints.md = 900` → la salida sigue usando `min-width: 768px` | MIG-B6-19 |
| UX-14 | El `postcss.config` que genera `init` valida contra el tema equivocado | Abierto (verificado leyendo el código) | `POSTCSS_SNIPPET` no carga tema y `postcss-uxdsl` no descubre `uxdsl.theme.config.*` | MIG-B6-19 |
| UX-15 | Color relativo de CSS rechazado | Abierto | `color(from red srgb r g b / 0.5)` → `UXD_TOKEN_KEY: Expected a token key.` | MIG-B6-14 |
| UX-16 | Tres compiladores para el mismo lenguaje | Abierto | `$gap: xs(1rem) md(2rem)`: el CLI lo expande; el plugin y `uxdsl-core` dejan `xs(1rem) md(2rem)` como CSS inválido. En el plugin, la causa es el orden: las `$vars` se sustituyen (`index.ts:814-825`) después de la expansión responsive (`:730`) | MIG-B6-18, MIG-B6-20, MIG-B6-14 |
| UX-17 | Extensión VS Code no publicada y con autocompletado estático | **Abierto, más grave (ver N-05)** | Sin publicar en Marketplace/Open VSX; `' '` dispara completado; no conoce el tema; sin diagnósticos | MIG-B6-26 (parcial) |
| UX-18 | Sin tipos ni esquema de configuración | Abierto | `theme?: Record<string, any>`; `UxDslOptions` no se exporta | MIG-B6-27 |
| UX-19 | `@ds-typo` infla la salida | Abierto | 10-11 declaraciones por uso; depende de D-2 | MIG-B6-17 |
| UX-20 | Sin sourcemaps | Abierto | `uxdsl-core` usa `map: false`; el CLI no tiene opción | MIG-B6-21 |
| UX-21 | Higiene de release | **Parcial** | Ya corregidos en `main`: el CHANGELOG registra beta.5 como publicada y el README del CLI ya no menciona beta.4. Siguen abiertos: `latest` = beta en los 5 paquetes; `postcss-uxdsl` pesa 2.040 KB empaquetado (1.928 KB son imágenes, más 19 archivos de test); 4 paquetes sin campo `files`; `theme-manifest.json` apunta a `src/theme/default-motion.css`, que no existe; `postcss-advanced-variables` sigue en ^3 (la actual es 5.0.0) | MIG-B6-28 |
| **N-01** | Una función de breakpoint inexistente llega al CSS | Nuevo | `padding: xs(1rem) xxl(2rem)` → `padding: 1rem xxl(2rem)`, sin error | MIG-B6-14 |
| **N-02** | `uxdsl-core` (y por lo tanto Vite y Webpack) ignora un parcial inexistente | Nuevo | `@import "./missing-partial.uxdsl";` queda en la salida y el navegador pide un `.uxdsl` que no existe | MIG-B6-18 |
| **N-03** | El loader de Webpack no declara dependencias | Nuevo (verificado leyendo el código) | No llama `this.addDependency` para los parciales, así que la caché y el watch no ven sus cambios. Usa `this.query` en vez de `this.getOptions()` y devuelve JavaScript (`module.exports = "…"`), que no se encadena con `css-loader` | MIG-B6-20 |
| **N-04** | El plugin de Vite quedó en el camino legacy | Nuevo (verificado leyendo el código) | Incrusta rutas absolutas de la máquina de build en el bundle de producción (atributo `data-uxdsl`). Inyecta el CSS desde JavaScript, así que no hay extracción y SSR no renderiza estilos. No registra los parciales con `addWatchFile`, así que editar un parcial no dispara HMR. Inyecta los packs legacy `default-*.css` y hace una compilación extra de densidades que traga errores | MIG-B6-20 |
| **N-05** | La gramática de VS Code no es JSON válido | Nuevo | En `HEAD` y en el `.vsix` commiteado: `Bad escaped character in JSON at position 468`, así que el resaltado no carga. El `.vsix` es de diciembre de 2025. `uxdsl.custom-data.json` usa una clave `functions` que el formato de custom data de CSS no reconoce, no aplica al lenguaje `uxdsl` y no se genera desde la metadata. El arreglo de la gramática existe en el árbol local sin commitear | MIG-B6-26 |
| **N-07** | El JSON base no es el default de la librería | Nuevo | El JSON base completo (`packages/playground-nextjs/uxdsl.theme.base.json`: 14 familias de palette, 17 tags tipográficos, `modes.dark`) sólo lo usa el playground. La librería compila con `DEFAULT_THEME` (`default-theme.ts`, "deliberately minimal": 4 familias de palette) y con valores tipográficos escritos en el código. Los dos temas divergen: por ejemplo, `neutral.main` es `#e2e8f0` en la librería y `#64748b` en el JSON base (ver "Hallazgo al aplicar D-1 y D-2") | MIG-B6-29 |
| **N-08** | El JSON base no pasa un chequeo automático de contraste | Nuevo | Ratio WCAG 2.x de los pares que emite el motor de botones (`buttons.ts`) en cada estado: 6 pares por debajo de 4.5:1 en modo claro y 16 en modo oscuro. En `modes.dark`, 8 de 11 familias redefinen sólo `main` y `contrast`, así que el hover usa el `dark` del modo claro sobre fondo oscuro | MIG-B6-29 |
| **N-06** | `uxdsl-core` carga el plugin de forma frágil | Nuevo | Prueba rutas hermanas (`../postcss-uxdsl`, `../../postcss-uxdsl`) antes que su dependencia declarada y traga los errores de carga. Dentro de `node_modules` puede tomar una copia izada de otra versión. `index.js` trae una segunda implementación completa que se activa ante cualquier error al cargar `dist/` (que está en `.gitignore` y depende de que el release compile) | MIG-B6-18 |

Fortalezas que la auditoría verificó y que deben protegerse con tests (ninguna story
de este plan puede romperlas): build determinista; referencias estrictas por
defecto; `includeTheme: false` sin `:root`; `builds` compila todo en memoria antes
de escribir; `NameRegistry` detecta colisiones; códigos `UXD_*` estables;
`uxdsl theme --diff`; nesting nativo con responsive; `color(display-p3 …)`
preservado; alpha de palette vía `color-mix()`; `next build` sobre la salida.

---

## Decisiones tomadas

El dueño respondió el 2026-09-18. La filosofía que ordena D-1, D-2 y D-4: **UXDSL
entrega un tema base completo en JSON, muy parecido al CSS original, organizado y
revisado por el equipo para cumplir accesibilidad; cada proyecto sobrescribe sólo
lo que necesita**, desde su configuración, con un JSON de override o con live
theming que actualiza ese JSON.

| ID | Pregunta | Respuesta del dueño | Consecuencia en el plan |
| --- | --- | --- | --- |
| D-1 | Palette parcial (UX-08) | Hay un JSON base completo, organizado y revisado por el equipo para accesibilidad; el usuario sobrescribe lo que necesita | Se mantiene el merge por clave: no se deriva `dark` ni se avisa en el build. MIG-B6-16 se reduce a documentarlo y hacerlo visible con `uxdsl theme`. Nace **MIG-B6-29**: ese JSON base tiene que ser el default real de la librería, y su accesibilidad tiene que probarse en CI (N-07, N-08) |
| D-2 | `@ds-typo` (UX-09, UX-19) | Se define en el JSON base y se sobrescribe lo necesario: un archivo de configuración default, entregado por UXDSL, que cada proyecto actualiza | `@ds-typo` emite exactamente los campos que el tema efectivo define para ese tag. El compilador no aporta valores propios (hoy aporta `auto`, `none`, `normal` y `0.8`). Los valores que se quieran conservar se escriben primero en el JSON base |
| D-3 | Directivas fuera de contexto (UX-06) | Es sólo una surface, no recibe medias; en ese caso debe ser lo más genérica posible | Error, con **una regla genérica para todas las directivas**, sin casos especiales por directiva. Las surfaces no son responsive: el mensaje sugiere usar valores responsive en las propiedades (`padding: xs(…) md(…)`) en vez de cambiar de surface por breakpoint |
| D-4 | Contrato de Vite y Webpack (N-03, N-04) | El tema base se reescribe con un JSON; el live theming es opcional con `ds-runtime`; "siempre es mejor una sola manera" | **Una sola manera: el JSON de tema** (base + override, mismo esquema, misma función `resolveTheme()`). Por defecto se aplica **en build**, así que Vite y Webpack entregan CSS real por su pipeline (MIG-B6-20), con `?inline` en Vite para quien necesite el string. En runtime, sólo para live theming, `applyTheme(json)` aplica **el mismo JSON** con el mismo generador (**MIG-B6-30**, nueva). Los setters por familia de `ds-runtime` pasan a ser envoltorios deprecados de `applyTheme`. Los tres canales (config del proyecto, JSON de override, live theming) dan el mismo resultado en todos los caminos |
| D-5 | Flags desconocidos (UX-04) | No estoy seguro | Se aplica el comportamiento estándar de `tsc` y `eslint`: error con sugerencia. Es reversible si molesta |
| D-6 | dist-tags de npm (UX-21) | `latest` = beta | `latest` sigue a la beta más reciente, como hoy. MIG-B6-28 verifica que `latest` y `beta` apunten a la misma versión después de publicar, y la documentación lo dice. Los proyectos con `^0.4.0` no reciben la beta, porque los rangos semver excluyen prereleases; un `npm i postcss-uxdsl` nuevo sí |
| D-7 | Alcance de FEAT-007 | Seguir aquí | FEAT-008 es el plan de beta.6. FEAT-007 queda para después de `0.5.0` y su encabezado lo indica |

**Línea de versiones.** Última estable: `0.4.0`. Publicada hoy en `latest` y `beta`:
`0.5.0-beta.5` (2026-09-17). Este plan produce `0.5.0-beta.6`; después vienen
`0.5.0-rc.1` y `0.5.0`.

## Hallazgo al aplicar D-1 y D-2: el JSON base no es el default de la librería

Las respuestas de D-1 y D-2 describen un tema base completo y revisado. Ese tema
existe, pero **la librería no lo entrega**.

**Dónde vive cada fuente de defaults hoy:**

1. `packages/playground-nextjs/uxdsl.theme.base.json`: el JSON completo (14
   familias de palette, 17 tags tipográficos, `modes.dark`, `typography`). Lo usan
   el playground (`themes.js`) y su ruta `api/generate`. No está en ningún paquete
   npm.
2. `DEFAULT_THEME` (`postcss-uxdsl/src/default-theme.ts`): el que usa el compilador.
   Su comentario lo define como "deliberately minimal": 4 familias de palette, 3
   fuentes y la tipografía de `DEFAULT_TYPOGRAPHY`.
3. Valores escritos en el código: `TYPOGRAPHY_DEFAULTS` (`typography.ts`),
   `DEFAULT_TYPOGRAPHY` (`typography-defaults.ts`, con `margin-block: auto`) y los
   fallbacks literales de `applyTypo` en `index.ts` (`auto`, `none`, `normal`, `0.8`).
4. Los packs legacy `default-*.css`/`.uxdsl`: opt-in, pero el plugin de Vite los
   inyecta.

**Divergencias entre la librería y el JSON base** (mismas claves, valores distintos):

| Clave | `DEFAULT_THEME` (lo que recibe un proyecto sin tema) | JSON base (lo que revisó el equipo) |
| --- | --- | --- |
| `palette.surface.dark` | `#dde5eb` | `#e2e8f0` |
| `palette.surface.contrast` | `#102a43` | `#0f172a` |
| `palette.neutral.main` | `#e2e8f0` | `#64748b` |
| `palette.neutral.dark` | `#cbd5e1` | `#334155` |
| `palette.error.main` | `#c61625` | `#dc2626` |
| `fonts.families.ui`, `ui-2`, `code` | stacks distintos | stacks distintos |

Consecuencias: la revisión de accesibilidad del JSON base no cubre lo que recibe un
proyecto sin tema. La confusión sobre qué claves "existen" (UX-01, y la
contradicción de palette de UX-21) viene de tener cuatro fuentes. Y el caption de
`@ds-typo` recibe `opacity: 0.8` y márgenes `auto` que el JSON base no define
(UX-09).

**Contraste del JSON base (N-08).** Se calculó el ratio WCAG 2.x para los pares que
emite el motor de botones en cada estado (`buttons.ts`: `contained` usa fondo
`main`/texto `contrast`, y en hover y selected fondo `dark`/texto `contrast`;
`outlined` y `flat` usan texto `main` y, en hover, texto `dark` sobre la surface).
Umbral: 4.5:1 (AA, texto normal). El modo oscuro se calculó como lo compila
`foundations.ts`: `modes.dark.palette` encima de la base, clave por clave.

| Modo | Pares por debajo de 4.5:1 | Ejemplos |
| --- | --- | --- |
| Claro | 6 | `tertiary` contained hover 2.77:1 (`#475569` / `#000000`); `tertiary` outlined 2.56:1; `warning` outlined 3.19:1; `light` outlined 1.10:1 |
| Oscuro | 16 | `success` contained hover 2.30:1 (`#14532d` / `#000000`); `info` 2.78:1; `error` 3.25:1; `secondary` 3.48:1; `neutral` 2.77:1; `dark` outlined 1.04:1 |

La causa principal del modo oscuro: 8 de las 11 familias de `modes.dark`
redefinen sólo `main` y `contrast`, así que el hover conserva el `dark` del modo
claro sobre un fondo oscuro. Es el mismo merge parcial de UX-08, dentro del propio
tema base. Algunos pares pueden ser combinaciones que el sistema no pretende usar
(por ejemplo, `light` outlined sobre fondo claro), pero hoy nada lo impide ni lo
documenta.

## Reglas de este release

1. **Ningún fallo silencioso.** Toda entrada que UXDSL no puede compilar fielmente
   produce un error, o un aviso documentado, con archivo:línea:columna del origen.
2. **Un solo pipeline.** CLI, `uxdsl-core`, Vite y Webpack llaman a la misma función.
   Las diferencias con el plugin PostCSS usado solo (sin `$vars` ni imports
   `.uxdsl`) se documentan y se prueban.
3. **Cada hallazgo cierra con su reproducción convertida en test o fixture.** La
   tabla "Estado verificado" es la lista de regresiones mínima.
4. **Sin sintaxis nueva** (D4 de FEAT-007).
5. **Cambios visuales sólo con sección `Visual changes`** en el CHANGELOG. El guard
   `verify:docs` ya lo exige para los archivos de defaults.
6. **Sin publicar sin aprobación.** Ningún agente ejecuta `npm publish`, cambia
   dist-tags ni publica la extensión.
7. **Lo que no está en este documento va a la siguiente feature.**

---

# Track A — Diagnósticos veraces

## MIG-B6-01 (completar) — Familias top-level reconocidas

| P0 | Tamaño S | Cierra UX-01 |
| --- | --- | --- |

**Estado actual.** El aviso falso de claves dentro de `palette`, `fonts.families` y
`typography_details` ya está retirado en el árbol local y verificado (tests +
`verify:beta5`). Falta el primer nivel: `KNOWN_THEME_FAMILIES` omite `modes` y
`typography`.

**Implementación.**

1. Agregar `modes` y `typography` a `KNOWN_THEME_FAMILIES`.
2. Test de deriva: toda propiedad top-level que `src/` lee del tema (`theme.X`,
   `effectiveTheme.X`) está en la lista. Así, la próxima familia que el compilador
   empiece a leer no puede quedar fuera sin romper un test.
3. Exportar la lista (la usan MIG-B6-22 para validar `--strict-theme=<familias>` y
   MIG-B6-27 para el esquema).

**Criterios de aceptación.**

- El tema de la auditoría (`modes`, `typography`, `typography_details.lead`,
  `palette.brand`, `fonts.families.display`) compila con **cero** avisos.
- El ejemplo del README, los defaults del manifiesto y el tema de Press Craftor
  compilan con cero avisos.
- `palete` sigue avisando. `typography_details.h1.fontsize` sigue dando `UXD_TYPO_FIELD`.

## MIG-B6-13 — Errores y avisos con ubicación

| P0 | Tamaño M | Cierra UX-03 |
| --- | --- | --- |

**Implementación.**

1. Todo `throw new Error('UXD_…')` de `postcss-uxdsl/src` pasa a
   `node.error(message, { word })`, para que PostCSS adjunte archivo, línea,
   columna y el fragmento de código. `rewriteFuncs` recibe la declaración de origen.
2. `ReferenceIntegrityError` incluye `archivo:línea:columna` en cada línea del
   mensaje (hoy `ReferenceIssue` ya guarda `source`, `line` y `column`, pero el
   mensaje los descarta) y conserva `.issues`.
3. En modo `references: { mode: 'warn' }`, `result.warn(message, { node })` para que
   el aviso también tenga ubicación.
4. El CLI imprime la ruta del parcial de origen. Con `postcss-import` sale sola
   cuando se usa `node.error`.
5. Mensajes accionables:
   - `density(16) does not exist; available keys: 0–15`;
   - `radius(md) does not exist; available keys: 0–5`, y lo mismo para shadow y border;
   - sugerencia para errores de tipeo en tokens: `palette(primry) — did you mean primary?`
     (distancia de edición ≤ 2 contra las claves definidas).

**Pruebas.**

- Un script enumera todos los códigos `UXD_[A-Z_]+` que aparecen en `src/`.
- Un test por tabla, con una fixture por código, verifica que el error trae `file`,
  `line`, `column` y el código en el mensaje. El test falla si aparece un código
  nuevo sin fixture.
- Un test del CLI: un error dentro de un parcial importado nombra el parcial y su línea.

## MIG-B6-14 — Cero salidas silenciosas del lenguaje

| P0 | Tamaño M | Cierra UX-06, UX-15, N-01 |
| --- | --- | --- |

**Implementación.**

1. Pase final: cualquier at-rule `ds-*` que quede sin procesar lanza
   `UXD_DIRECTIVE_UNKNOWN` (con sugerencia si la distancia a una directiva real es
   ≤ 2) o `UXD_DIRECTIVE_CONTEXT` (directiva real en un lugar no soportado: raíz,
   `@media` anidado dentro de una regla). Lo mismo para `@theme` fuera de contexto.
   Según D-3, las surfaces no son responsive: es una sola regla genérica para todas
   las directivas, y el mensaje sugiere usar valores responsive en las propiedades
   (`padding: xs(…) md(…)`) en vez de cambiar de surface por breakpoint.
2. Corregir el comentario de `index.ts` que promete los alias `@ds(h1)` y `@ds-h1`.
   Ahora esos alias caen en `UXD_DIRECTIVE_UNKNOWN`.
3. `color()` es token UXDSL sólo cuando su argumento es una clave (`/^[\w.-]+$/`,
   con el alpha que ya se soporta). Cualquier otra forma (`color(from …)`,
   `color(display-p3 …)`) es CSS nativo y pasa sin tocarse.
4. `UXD_BREAKPOINT_UNKNOWN`: una función de nivel superior dentro de un valor
   responsive cuyo nombre no es un breakpoint configurado ni una función CSS, o que
   está a distancia 1 de un breakpoint configurado (`xxl`, `mdd`), produce un error
   que lista los breakpoints configurados.

**Criterios de aceptación.**

- Los cuatro casos de UX-06 y `@ds-h1` fallan con código y ubicación.
- `color(from red srgb r g b / 0.5)` pasa sin cambios.
- `padding: xs(1rem) xxl(2rem)` falla con `UXD_BREAKPOINT_UNKNOWN` y la lista `xs, sm, md, lg, xl`.
- **Control negativo:** `calc()`, `var()`, `min()`, `max()`, `clamp()`, `rgb()`,
  `hsl()`, `lab()`, `lch()`, `oklch()`, `color-mix()`, `url()`, `env()`,
  `fit-content()` y `repeat()` junto a funciones responsive **no** producen error.

---

# Track B — Tema base y salida correcta

## MIG-B6-29 — El JSON base es la única fuente de defaults

| P0 | Tamaño L | Cierra N-07, N-08; es la raíz de UX-01, UX-08, UX-09 y de la contradicción de palette de UX-21 |
| --- | --- | --- |

**Implementación.**

1. Mover el JSON base revisado a `postcss-uxdsl`, exportado (por ejemplo
   `postcss-uxdsl/theme/base.json`). El playground lo importa del paquete en vez de
   mantener su propia copia.
2. `DEFAULT_THEME` pasa a ser ese JSON (congelado), sin valores escritos a mano en
   TypeScript. `resolveTheme` no cambia: base más override por merge (D-1).
3. El compilador deja de aportar valores propios: se eliminan
   `TYPOGRAPHY_DEFAULTS`, los `auto`/`none`/`normal`/`0.8` de
   `DEFAULT_TYPOGRAPHY` y los fallbacks literales de `applyTypo`. Lo que deba
   conservarse se escribe en el JSON base; MIG-B6-17 hace la emisión.
4. Los packs legacy `default-*.css`/`.uxdsl` dejan de ser fuente de defaults: se
   marcan como deprecados y el plugin de Vite deja de inyectarlos (MIG-B6-20).
   `theme-manifest.json` se genera desde el JSON base.
5. **Gate de accesibilidad en CI.** Para el tema base, en modo claro y en
   `modes.dark` mezclado:
   - cada par texto/fondo que emiten los motores de surface, button e input en cada
     estado cumple 4.5:1 (texto normal);
   - los bordes que delimitan controles cumplen 3:1 (WCAG 1.4.11);
   - los pares se derivan de `buttons.ts`, `surfaces.ts` e `inputs.ts`, no de una
     lista escrita a mano;
   - las excepciones se declaran en el JSON con su motivo (por ejemplo, una familia
     que no se usa como texto).
6. Corregir los colores del JSON base hasta que pase el gate. **Los corrige el
   agente** (decisión del 2026-09-19): cambio mínimo de luminosidad en OKLCH,
   conservando tono y croma; primero `dark` y `contrast`, y `main` sólo si no hay otra
   salida. Cada cambio va en una tabla antes/después en el PR, que el dueño aprueba.
   Ver la ficha.
7. **Decisiones del dueño (2026-09-19):** el JSON base completo es el default de la
   librería, **incluidos `fonts.google` (Inter) y `modes.dark`**. Por eso el gate de
   contraste es bloqueante también en modo oscuro, y el README documenta la petición a
   Google Fonts (se desactiva con `fonts: { google: [] }`) y el modo oscuro automático
   (se fija con `data-theme="light"`).
7. Se mantiene D5 de FEAT-007: el gate certifica el tema base, pero un override del
   proyecto no queda certificado. MIG-B6-16 ofrece esa verificación como opt-in.
8. El JSON base se agrega a `VISUAL_DEFAULT_FILES` de `verify-docs-update.js`, así
   que todo cambio exige CHANGELOG.

**Criterios de aceptación.**

- Un proyecto sin tema compila exactamente con los valores del JSON base (test:
  `resolveTheme(undefined)` es igual, en profundidad, al JSON).
- No quedan valores de diseño literales en `src/` fuera del JSON base.
- El gate de contraste pasa en claro y oscuro, o cada excepción está declarada.
- El CHANGELOG tiene `Visual changes` con una tabla antes/después por token, porque
  los proyectos sin tema ven cambiar `neutral`, `error`, `surface`, las fuentes y los
  colores corregidos por contraste. Incluye una receta para fijar en el override
  los valores de beta.5 que se quieran conservar.

## MIG-B6-30 — `applyTheme(json)`: una sola manera de tematizar también en runtime

| P1 | Tamaño M | Aplica D-4 | Depende de MIG-B6-29 |
| --- | --- | --- | --- |

Hoy `ds-runtime` no tiene una forma de aplicar un JSON. Expone setters por familia
(`updatePalette`, `updateColor`, `updateSpacing`, `updateBreakpoint`, …), cada uno
con su propia clave de `localStorage`: en la práctica es un segundo modelo con otro
formato. El patrón correcto ya existe, pero en el código de la app del playground
(`ThemeContext.tsx`).

- `applyTheme(patch, { replace?, styleId?, persist? })` ejecuta `resolveTheme` y
  `generateThemeCss` y escribe un único `<style>` administrado. Si la generación
  falla, no toca el DOM.
- Guarda un solo JSON (`uxdsl:theme`) y migra las cuatro claves viejas.
- Los setters existentes se reimplementan sobre `applyTheme` y quedan deprecados
  (se eliminan después de 0.5.0).
- Agrupa las actualizaciones por frame (`requestAnimationFrame`).
- Paridad build ↔ runtime para el mismo JSON.

Detalle completo en la [ficha](FEAT-008/MIG-B6-30-apply-theme-runtime.md).

## MIG-B6-15 — Selectores funcionales y `!important`

| P1 | Tamaño S | Cierra UX-05, UX-07 |
| --- | --- | --- |

1. `control-engine.ts` (y cualquier otro sitio que haga `selector.split(',')`)
   separa con `postcss.list.comma()` o usa `rule.selectors`.
2. Copiar `decl.important` en los dos lugares donde se clona una declaración
   responsive.

**Fixtures:** `:is(.x, .y)`, `:where(…)`, `:not(.a, .b)`, `:has(> .a, + .b)`, listas
`.a, .b` y nesting con `&` sobre `@ds-button` y `@ds-input`. `!important` con
`xs()/md()` y con `density()` responsive.

## MIG-B6-16 — Override parcial explícito (según D-1)

| P1 | Tamaño S | Cierra UX-08 | Depende de MIG-B6-29 (verificador de contraste) |
| --- | --- | --- | --- |

**Decisión (D-1):** el merge por clave es la filosofía del producto: tema base más
override de lo necesario. No se deriva `dark` y el build no avisa.

1. README y migration guide lo dicen explícitamente: sobrescribir
   `palette.primary.main` conserva `dark` y `contrast` del tema base; para cambiar el
   hover hay que sobrescribir también `dark`.
2. `uxdsl theme --diff` marca las familias que mezclan valores del proyecto y del
   tema base.
3. `uxdsl theme --contrast` (opt-in) corre el verificador de MIG-B6-29 sobre el tema
   efectivo del proyecto y lista los pares por debajo de AA. No forma parte de
   `build`.

**Criterios de aceptación.** El caso de la auditoría (`primary.main = '#00aa00'` sin
`dark`) aparece marcado en `--diff`, y `--contrast` lista los pares de esa familia
que no cumplen.

## MIG-B6-17 — `@ds-typo` emite sólo lo que define el tema (según D-2)

| P1 | Tamaño M | Cierra UX-09, reduce UX-19 | Depende de MIG-B6-29 |
| --- | --- | --- | --- |

1. `@ds-typo(tag)` emite una declaración por cada campo que el tema efectivo define
   para ese tag, y nada más, sin fallbacks literales.
2. Antes de quitar los fallbacks, el JSON base recibe de forma explícita los valores
   que el equipo quiera conservar (por ejemplo `marginBlockStart: 0` en lugar del
   `auto` implícito). Así el cambio visual es una decisión, no un efecto secundario.
3. Documentar la precedencia: la directiva emite en su posición, y una declaración
   escrita después la sobrescribe (`.eyebrow { @ds-typo(caption); margin: 0; }`).

**Criterios de aceptación.**

- Con el JSON base actual, `@ds-typo(caption)` no emite `margin-block-*`,
  `text-decoration` ni `opacity`, y `.eyebrow { margin: 0; @ds-typo(caption); }`
  conserva el margen 0.
- Un override que define `typography_details.caption.opacity` hace que se emita.
- Se registra el tamaño de los módulos de Press Craftor antes y después.
- El CHANGELOG tiene `Visual changes` y una receta para restaurar el aspecto de beta.5.

---

# Track C — Un solo pipeline

## MIG-B6-18 — `compile()` compartido en `uxdsl-core`

| P0 | Tamaño L | Cierra UX-02, N-02, N-06 y la base de UX-16 y UX-20 |
| --- | --- | --- |

Éste es el camino crítico del release.

**Implementación.**

1. `uxdsl-core` expone una API aditiva
   `compile({ entry | source + from }, config) → { css, map?, dependencies[], warnings[] }`
   que usa **exactamente** el pipeline del CLI: sintaxis `postcss-scss` +
   `postcss-import` con resolución de `.uxdsl` + `postcss-advanced-variables` +
   `postcss-uxdsl`.
2. `processUxdsl(source, options): Promise<string>` se conserva como envoltorio
   (D3 de FEAT-007: no se cambia el callable).
3. Se eliminan `stripLineComments` y el `inlineImports` por strings, en core y en
   Vite. Un import inexistente pasa a ser error con archivo y línea del importador.
4. Se elimina la segunda implementación de `index.js`. `postcss-uxdsl` se resuelve
   por la dependencia declarada (`require('postcss-uxdsl')`), sin `catch` silencioso.
   `uxdsl-core` agrega `prepack` o `prepublishOnly` que compila `dist/`.
5. `compileEntryToCss` del CLI llama a `compile()` de core. Desaparece el pipeline
   duplicado.

**Suite de paridad (se escribe antes del refactor).** Crear `fixtures/parity/` con
estas entradas:

- `url()` sin comillas;
- comentario de bloque con URL;
- comentarios `//`;
- `$vars` con valores responsive;
- imports anidados;
- import inexistente;
- ciclo de imports.

Se capturan las salidas actuales del CLI como oráculo. Después del refactor, CLI,
core, Vite (build) y Webpack deben producir CSS idéntico o el mismo código de
error. El plugin PostCSS usado solo queda documentado como "funciones y directivas
UXDSL; sin `$vars` ni imports `.uxdsl`", y la suite verifica el error o la
diferencia documentada, no un resultado silencioso.

**Riesgo.** Cambia el grafo de dependencias: core pasa a depender de
`postcss-scss`, `postcss-import` y `postcss-advanced-variables`, y el CLI pasa a
depender de core. Hay que actualizar las notas de instalación y el `release.js`.

## MIG-B6-19 — Configuración única de tema y breakpoints

| P1 | Tamaño M | Cierra UX-13, UX-14 |
| --- | --- | --- |

1. Un solo cargador, `postcss-uxdsl/config`, que resuelve
   `uxdsl.config.cjs`, `uxdsl.theme.config.*` y `uxdsl.theme.json` con la regla
   actual del CLI. Vive en `postcss-uxdsl` porque el plugin lo necesita y el plugin
   no depende de core. Lo usan el CLI, core, Vite, Webpack y el propio plugin.
2. El plugin, cuando no recibe `theme`, descubre el tema desde `process.cwd()` o
   desde la opción `configRoot`. Se puede desactivar con `discoverTheme: false`.
3. `init` deja de escribir `breakpoints`, en modo simple y en `--multi`, porque los
   defaults ya aplican.
4. Si la configuración y el tema definen la misma clave de breakpoint con valores
   distintos, se avisa nombrando ambos archivos.

**Criterios de aceptación.**

- `init` + `theme.breakpoints.md = 900` → `min-width: 900px`.
- En un esqueleto de Next generado por `init`, `palette(secondary)` definido en el
  tema compila dentro de un `.css` procesado por `postcss-uxdsl`.

## MIG-B6-20 — Adaptadores Vite y Webpack sobre `compile()` (según D-4)

| P1 | Tamaño L | Cierra N-03, N-04 y el resto de UX-16 |
| --- | --- | --- |

**Vite.**

- El `.uxdsl` entra al pipeline CSS de Vite: extracción en `vite build`, HMR nativo y
  SSR.
- Cada entrada de `dependencies[]` se registra con `addWatchFile`.
- Se eliminan los packs legacy `default-*` (ver MIG-B6-29) y la inyección en tiempo de
  ejecución.
- La salida de producción no contiene rutas absolutas.
- El tema llega por el cargador de MIG-B6-19.

**Webpack.**

- `this.getOptions()`.
- `this.addDependency(dep)` para cada dependencia.
- Devuelve CSS (y mapa) para encadenar con `css-loader`, `style-loader` o
  `MiniCssExtractPlugin`.

**Fixtures reales.**

- `vite build`: el CSS extraído no contiene la ruta del repositorio (se verifica con
  grep).
- `vite dev`: editar un parcial dispara HMR.
- `webpack build` y `webpack --watch`: editar un parcial recompila.
- La suite de paridad de MIG-B6-18 pasa por ambos adaptadores.
- **Según D-4:** los tres canales de override (configuración del proyecto, JSON de
  override y live theming con `ds-runtime`) dan el mismo resultado en CLI, PostCSS,
  Vite y Webpack, y el live theming funciona sobre el CSS extraído.

## MIG-B6-21 — Sourcemaps vía PostCSS

| P2 | Tamaño M | Cierra UX-20; reemplaza la mayor parte de MIG-B6-04 de FEAT-007 |
| --- | --- | --- |

Sin preprocesado por strings (MIG-B6-18), PostCSS conserva el origen de cada archivo
importado. El sistema de segmentos que diseñó FEAT-007 deja de ser necesario.

1. CLI: `sourceMap: false | 'inline' | 'external'` y los flags `--sourcemap`,
   `--sourcemap=inline` y `--no-sourcemap`, con la precedencia y el comportamiento
   ya especificados en FEAT-007. Con `false`, la salida es idéntica byte a byte a la
   anterior.
2. Los nodos creados por directivas y por la expansión responsive heredan el
   `source` del nodo que los originó. Hoy se insertan como objetos planos, sin
   `source`.
3. Rutas relativas y reproducibles; `sourcesContent` configurable.

**Criterios de aceptación** (subconjunto de FEAT-007):

- una declaración generada por `density()` apunta a su línea en el `.uxdsl`;
- la salida de `@ds-button` apunta a la directiva;
- un parcial importado aparece como `source` propio;
- en multi-entry, CSS y mapas se escriben juntos o no se escribe nada;
- Vite y Webpack sólo se anuncian con sourcemaps si sus fixtures los verifican.

---

# Track D — CLI

## MIG-B6-22 — Flags estrictos

| P0 | Tamaño S | Cierra UX-04 |
| --- | --- | --- |

1. Declarar en minimist todos los booleanos (`include-theme`, `watch`, `help`,
   `multi`, …) y los strings.
2. `--strict-theme` y `theme --strict` aceptan la forma sin valor, `=true`,
   `=false` y `=<familias>`.
3. Los nombres de familia se validan contra la lista exportada por MIG-B6-01. Un
   nombre desconocido es un error con sugerencia.
4. Un flag desconocido es un error con sugerencia (D-5: comportamiento estándar de
   `tsc` y `eslint`; reversible).

**Pruebas:** las cuatro filas de la tabla de UX-04, el flag desconocido y
`--no-include-theme` como control.

## MIG-B6-23 — Watch robusto

| P1 | Tamaño M | Cierra UX-11 |
| --- | --- | --- |

1. Si el primer build falla, se imprime el error y watch sigue vigilando, como
   `tsc --watch`.
2. Sólo se escribe si el contenido cambió. La escritura es atómica (archivo temporal
   en el mismo directorio y `rename`). CSS y mapa se escriben juntos.
3. Sólo se recompilan las entradas cuyo `dependencies[]` (de MIG-B6-18) incluye el
   archivo cambiado. Un cambio de tema o configuración recompila todas.

**Pruebas** (extender `watch-mode.test.js`):

- falla inicial, luego corrección: la salida aparece;
- rebuild sin cambios: mtime e inode no cambian;
- editar un parcial de la entrada B no reescribe la entrada A.

## MIG-B6-24 — Guardas de `builds`

| P1 | Tamaño S | Cierra UX-12 |
| --- | --- | --- |

- **Error** si una entrada cuyo `outFile` termina en `.module.css` va a emitir
  `:root` o `#uxdsl-bp-meta`. El mensaje sugiere `includeTheme: false`. En CSS
  Modules eso rompe el build de Next de todos modos.
- **Aviso** si más de una entrada emite el tema.

---

# Track E — Rendimiento

## MIG-B6-25 — Validación de referencias en tiempo casi lineal

| P1 | Tamaño M | Cierra UX-10 |
| --- | --- | --- |

**Causa.** `inspectReferences` recalcula los contextos candidatos recorriendo
**todas** las entradas por cada consumidor, lo que da O(consumidores × entradas).
`resolve` filtra linealmente en cada llamada.

**Implementación.**

- Indexar las entradas por selector y por propiedad una sola vez.
- Precalcular los contextos por selector, no por declaración.
- Memoizar `resolve(name, context)` y `checkValue(value, context)`.

**Semántica sin cambios.**

- Pasan todos los tests de referencias existentes.
- Test de equivalencia: la implementación nueva y la anterior (que se conserva en
  el test como oráculo durante este release) producen los mismos `issues` sobre el
  corpus de tests y fixtures.

**Presupuesto.** Agregar el benchmark de este documento como
`npm run bench:references`. Con referencias activas, 24.000 líneas deben compilar
en menos de 2 s (hoy tardan 55 s). En CI, duplicar la entrada no puede más que
multiplicar por 2,5 el tiempo.

---

# Track F — Editor y tipos

## MIG-B6-26 — Extensión VS Code 0.1.0 confiable

| P1 | Tamaño M | Cierra N-05; cierra UX-17 en parte |
| --- | --- | --- |

1. Commitear el arreglo de la gramática. La lista de funciones y directivas de la
   gramática se genera desde `LANGUAGE_COMPLETIONS` (extender
   `generate-language-artifacts.js`; `--check` la cubre). Un test en CI parsea la
   gramática como JSON.
2. `uxdsl.custom-data.json` se genera desde la metadata del lenguaje, con sólo
   `atDirectives` y los nombres reales (`@theme`, `@ds-surface`, `@ds-button`,
   `@ds-input`, `@ds-typo`). Sirve para los `.css` procesados por `postcss-uxdsl`.
   Se elimina la clave `functions`, que el formato no reconoce, y los ejemplos
   inválidos (`radius(md)`, `typography()`, `@ds-typography`).
3. Completado:
   - sin `' '` como carácter de disparo;
   - funciones sólo en el valor de una declaración (fuera de selectores,
     comentarios y strings);
   - argumentos de directivas con roles, tonos y tamaños tomados de la metadata,
     no sólo `radius`/`shadow`.
4. `language-configuration.json`: corregir los pares `"{ "` (con espacio) y
   agregar `lineComment: "//"`.
5. Eliminar el `.vsix` commiteado. Empaquetar con `vsce package` en CI y publicar
   `0.1.0` en Marketplace y Open VSX (lo hace el dueño con sus tokens de
   publicador; si no están disponibles, el release lo dice).

**Fuera de beta.6:** completado con conciencia del tema, diagnósticos en vivo, hover
por breakpoint e ir a la definición. Van a MIG-B6-08 en la siguiente feature, que
necesita MIG-B6-13 y MIG-B6-18 como base.

## MIG-B6-27 — Tipos y esquema de configuración

| P2 | Tamaño S-M | Cierra UX-18 |
| --- | --- | --- |

- Exportar `UxdslOptions`, `UxdslTheme` (familias tipadas; registros abiertos como
  `Record<string, …>`), `UxdslConfig`, `UxdslBuild` y `defineConfig()` (función
  identidad; funciona con `/** @type {import('uxdsl-cli').UxdslConfig} */` en CJS).
- Publicar un JSON Schema de `uxdsl.theme.json` en `postcss-uxdsl`, referenciable
  con `$schema`, generado desde `KNOWN_THEME_FAMILIES` y `TYPOGRAPHY_PROPERTIES` o
  con test de deriva contra ambos.
- Test: `tsc --noEmit` sobre una configuración tipada con un typo deliberado falla
  (`@ts-expect-error`).

---

# Track G — Release

## MIG-B6-02 — Procedencia exacta de FEAT-002 (se conserva de FEAT-007)

| P0 | Tamaño S (docs) |
| --- | --- |

Sin cambios respecto de FEAT-007.

## MIG-B6-28 — Higiene de paquetes y npm

| P0 | Tamaño S | Cierra UX-21 |
| --- | --- | --- |

1. Campo `files` en los cinco paquetes: `dist`, `README`, `LICENSE` y los assets que
   se usan en tiempo de ejecución. Sin tests, sin fuentes `.ts` ni PNG. Las
   imágenes del README se enlazan con URLs absolutas de GitHub.
2. `release.js` corre `npm pack --dry-run` con un presupuesto de tamaño por paquete
   (`postcss-uxdsl` ≤ 250 KB empaquetado; hoy pesa 2.040 KB) y no publica si
   algún paquete lo excede.
3. Test: toda ruta de `theme-manifest.json` existe en el tarball (corrige
   `default-motion.css`).
4. Según D-6, `latest` sigue a la beta más reciente. Después de publicar, el script
   verifica que `latest` y `beta` apunten a la misma versión en los cinco paquetes.
   La documentación de instalación lo dice explícitamente.
5. Codificar la URL de Google Fonts (espacios como `+`, el resto con
   `encodeURIComponent`).
6. Evaluar `postcss-advanced-variables` 5.x con la suite de paridad. Actualizar sólo
   si la salida es idéntica; si no, documentar por qué queda fijada en ^3.
7. Actualizar el comentario de cabecera de `postcss-uxdsl/src/index.ts`.

## MIG-B6-12 (re-alcanzado) — Gate de release beta.6

| P0 | Tamaño M |
| --- | --- |

`fixtures/mig-b6-12-release/`, desde tarballs y sin links al monorepo:

1. Cada fila de "Estado verificado contra `main`" se ejecuta como regresión.
2. La suite de paridad pasa por CLI, core, Vite y Webpack.
3. Pasan las fixtures de beta.2 a beta.5 y `verify:consumer-fixture`.
4. `verify:cssmodules-build` corre en un job con Chrome declarado.
5. **Validación externa:** Press Craftor compila con los tarballs con cero avisos y
   CSS idéntico, salvo los cambios visuales documentados de D-1 y D-2, y
   `next build` pasa. El resultado queda registrado en el release doc.
6. No publica.

---

## Qué queda fuera de beta.6 y a dónde va

| Story de FEAT-007 | Destino | Motivo |
| --- | --- | --- |
| MIG-B6-03 Contrato 1.0 | FEAT-007 re-apuntada, después de `0.5.0` | Debe describir el comportamiento corregido. Escribirlo antes obliga a reescribirlo. Sí entra aquí el inventario de códigos `UXD_*` (MIG-B6-13) |
| MIG-B6-04 Sourcemaps con segmentos | Reemplazada en su mayor parte por MIG-B6-21 | Sin preprocesado por strings, PostCSS conserva el origen |
| MIG-B6-05 Contraste nominal vs WCAG | Después de `0.5.0` | Documentación. No bloquea la confiabilidad; puede entrar en rc si sobra capacidad |
| MIG-B6-06 Density formal | Después de `0.5.0` | Igual que MIG-B6-05 |
| MIG-B6-07 Arquitectura de paquetes | Después de `0.5.0` | MIG-B6-18 cambia el grafo; documentarlo después |
| MIG-B6-08 Tooling con conciencia del tema / LSP | Siguiente feature | Depende de MIG-B6-13, MIG-B6-18 y MIG-B6-26 |
| MIG-B6-09 Benchmarks | Siguiente feature | MIG-B6-25 deja un benchmark interno, no comparativo |
| MIG-B6-10 Migradores | Siguiente feature | Necesita el contrato |
| MIG-B6-11 Paquete frontal `uxdsl` | Siguiente feature | Necesita el grafo final de MIG-B6-18 |

---

## Orden de ejecución

**Ola 0.** Resuelta el 2026-09-19. El trabajo local está integrado en la rama
`feat/feat-008-beta6-plan`, que tiene que llegar a `main` antes de repartir. Las
preguntas de MIG-B6-29 están respondidas. Ver el
[README de las fichas](FEAT-008/README.md#antes-de-repartir-dueño).

**Ola 1, en paralelo, sin dependencias entre sí:** MIG-B6-01, MIG-B6-02, MIG-B6-13,
MIG-B6-14, MIG-B6-15, MIG-B6-22, MIG-B6-25, MIG-B6-27, MIG-B6-28 y MIG-B6-29. La
corrección de colores de MIG-B6-29 la hace el agente, con aprobación del dueño en el PR. También se escribe
la suite de paridad de MIG-B6-18, con la salida actual como oráculo.

**Ola 2:**

- MIG-B6-18 → MIG-B6-19 → MIG-B6-20 → MIG-B6-21 (camino crítico);
- MIG-B6-16, MIG-B6-17 y MIG-B6-30, después de MIG-B6-29;
- MIG-B6-23 y MIG-B6-24, después de MIG-B6-18 (usan `dependencies[]`).

**Ola 3:** MIG-B6-26, después de MIG-B6-14 y MIG-B6-18, con la metadata de
directivas y los errores ya estables. Luego MIG-B6-12.

**Después:** revisión humana, aprobación, publish de beta.6 y adopción en Press
Craftor. Congelamiento y `rc.1` según "Ruta recomendada".

**Archivos calientes:** varias stories editan los mismos archivos. Para evitar
conflictos, cada uno tiene un solo dueño o se trabaja en secuencia:

| Archivo | Stories | Secuencia |
| --- | --- | --- |
| `postcss-uxdsl/src/index.ts` | 13, 14, 15, 17, 21, 28 | 13 → 14 → 15 → 17 → 21 → 28 (17 espera también a 29; 19 y 27 hacen cambios chicos rebasados) |
| `uxdsl-cli/bin/uxdsl.js` | 16, 18, 19, 21, 22, 23, 24 | 22 → 18 → 19 → 24 → 23 → 21 → 16 |
| `default-theme.ts`, `typography.ts`, `typography-defaults.ts` | 29, 17 | 29 → 17 |

---

## Distribución recomendada entre agentes

| Track | Stories | Archivos principales | Depende de |
| --- | --- | --- | --- |
| A Diagnósticos | 01, 13, 14 | `theme-validate.ts`, `index.ts`, `reference-integrity.ts` (mensajes), `language.ts` | ninguno |
| B Tema base y salida | 29, 30, 15, 16, 17 | JSON base, `default-theme.ts`, `control-engine.ts`, `index.ts` (typo), `typography*.ts`, test de contraste | aprobación del dueño para los colores de 29; A para `index.ts` |
| C Pipeline | 18, 19, 20, 21 | `uxdsl-core`, `postcss-uxdsl/config`, `vite-plugin-uxdsl`, `uxdsl-webpack-loader`, compile del CLI | suite de paridad; D-4 |
| D CLI | 22, 23, 24 | argumentos, watch y build de `uxdsl.js` | 01 (lista de familias); 18 para 23 y 24 |
| E Rendimiento | 25 | `reference-integrity.ts` (algoritmo) | coordinar con A en mensajes |
| F Editor y tipos | 26, 27 | `uxdsl-vscode`, `generate-language-artifacts.js`, tipos y esquema | 14, 18 |
| G Release | 02, 28, 12 | docs, `package.json`, `release.js`, fixture beta.6 | todos para 12 |

---

## Definition of done de beta.6

- [ ] Cero avisos falsos: el ejemplo del README, el manifiesto, Press Craftor y un
      tema con familias propias, `modes` y `typography` compilan sin avisos. (UX-01)
- [ ] Ningún adaptador altera comentarios ni `url()`. La suite de paridad pasa por
      CLI, core, Vite y Webpack. (UX-02, UX-16, N-02)
- [ ] Cada error `UXD_*` trae archivo:línea:columna del parcial de origen,
      verificado por un test que descubre los códigos. (UX-03)
- [ ] Los flags aceptan `=true`/`=false`, y los flags o familias desconocidos
      producen error. (UX-04)
- [ ] Cualquier `@ds-*` sin procesar y cualquier breakpoint inexistente producen
      error. `color()` nativo pasa. (UX-06, UX-15, N-01)
- [ ] Selectores funcionales y `!important` responsive tienen fixtures. (UX-05, UX-07)
- [ ] El JSON base es el default de la librería (única fuente de defaults) y pasa el
      gate de contraste en claro y en oscuro, o declara sus excepciones. (N-07, N-08)
- [ ] El override parcial está documentado y visible en `uxdsl theme --diff`, y
      `uxdsl theme --contrast` verifica el tema efectivo. (UX-08)
- [ ] Una sola manera de tematizar: `applyTheme(json)` aplica en runtime el mismo JSON
      que el build, con paridad verificada; los setters por familia están deprecados.
      (D-4, MIG-B6-30)
- [ ] `@ds-typo` emite sólo lo que el tema define; el compilador no aporta valores
      propios. (UX-09)
- [ ] 24.000 líneas con referencias activas compilan en menos de 2 s. (UX-10)
- [ ] Watch sobrevive a un error inicial, no reescribe salidas sin cambios y escribe
      de forma atómica. (UX-11)
- [ ] Los scaffolds de `init` no se anulan entre sí y validan contra el tema del
      proyecto. Una salida `.module.css` nunca contiene `:root`. (UX-12, UX-13, UX-14)
- [ ] Vite y Webpack declaran dependencias, extraen CSS real y no filtran rutas
      absolutas. Los tres canales de override dan el mismo resultado en todos los
      caminos. (N-03, N-04, D-4)
- [ ] La gramática es JSON válido, generado y probado en CI. La extensión 0.1.0 está
      publicada o el release dice por qué no. (N-05, UX-17 parcial)
- [ ] Tipos exportados y JSON Schema con test. (UX-18)
- [ ] Sourcemaps en el CLI con las garantías de MIG-B6-21. (UX-20)
- [ ] `latest` y `beta` apuntan a la misma versión después de publicar; `files` en los
      cinco paquetes; presupuesto de tamaño aplicado por el script de release. (UX-21)
- [ ] La fixture de beta.6 pasa desde tarballs y las anteriores no regresionan.
- [ ] Press Craftor valida los tarballs: cero avisos y sólo los cambios visuales
      documentados.
- [ ] README, migration guide y CHANGELOG de cada paquete modificado están alineados;
      los cambios visuales tienen su sección.
- [ ] Publicación con aprobación explícita.

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| MIG-B6-18 es grande y cambia el grafo de paquetes | Retrasa todo el release | Suite de paridad con oráculo **antes** del refactor; es el único camino crítico; el resto avanza en paralelo |
| Los errores nuevos rompen builds existentes (UX-04, UX-06, N-01) | Proyectos que compilaban dejan de compilar | Es intencional: esos proyectos ya estaban rotos en silencio. La migration guide lista cada error nuevo con su corrección |
| El JSON base pasa a ser el default (N-07) y se corrigen colores por contraste (N-08) | Los proyectos sin tema, o con override parcial, ven cambiar colores, fuentes y márgenes | `Visual changes` con tabla antes/después por token, receta para fijar los valores de beta.5 y diff de Press Craftor registrado |
| `@ds-typo` deja de emitir lo que el tema no define (D-2) | Márgenes, decoración u opacidad cambian donde se dependía del valor implícito | Los valores a conservar se escriben en el JSON base antes de quitar los fallbacks |
| La reescritura de rendimiento cambia la semántica | Falsos positivos o negativos nuevos | Test de equivalencia contra la implementación anterior |
| El contrato de adaptadores rompe a quien usa el string (D-4) | Migración para consumidores de Vite y Webpack | Documentado en la migration guide; `?inline` como reemplazo en Vite |
| Publicar la extensión requiere cuentas | La extensión no llega a Marketplace | La acción queda con el dueño; si no ocurre, el release lo declara |
| El alcance crece | Se repite el problema de FEAT-007 | Regla 7: lo que no está aquí va a la siguiente feature |

---

## Comandos de verificación

```bash
# Motor, core y CLI
npm test
npm --prefix packages/uxdsl-vscode run compile
node scripts/generate-language-artifacts.js --check

# Nuevos (se agregan con su implementación)
npm run test:parity
npm run bench:references
npm run verify:beta6

# Históricos
npm run verify:docs
npm run verify:consumer-fixture
npm run verify:beta2 && npm run verify:beta3 && npm run verify:beta4 && npm run verify:beta5

# CSS Modules + navegador, en job con Chrome
UXDSL_CHROME_PATH=/ruta/a/chrome npm run verify:cssmodules-build
```

Un comando cuenta como evidencia sólo cuando su implementación existe y pasa.
