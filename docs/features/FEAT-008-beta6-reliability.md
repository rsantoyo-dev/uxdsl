# FEAT-008 — UXDSL 0.5.0-beta.6: confiabilidad antes de estable

| Campo | Valor |
| --- | --- |
| Estado | Plan de implementación revisado contra `60fdd76` el 2026-09-19. D-1 a D-7 se conservan; contratos, pruebas y coordinación corregidos en las [21 fichas](FEAT-008/README.md). Esta revisión no implementa stories ni certifica el release; 01 y gramática tienen trabajo parcial existente |
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
  acotadas: 21 stories. Defaults/contraste, pipeline, adaptadores y runtime son
  trabajos grandes; estimar después de sus fixtures. El paralelismo sigue las
  dependencias reales del índice, no una promesa de duración del release.
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
| D-4 | Contrato de Vite y Webpack (N-03, N-04) | El tema base se reescribe con un JSON; el live theming es opcional con `ds-runtime`; "siempre es mejor una sola manera" | **Una sola manera: el JSON de tema** (base + override, mismo esquema, misma función `resolveTheme()`). Por defecto se aplica **en build**, así que Vite y Webpack entregan CSS real por su pipeline (MIG-B6-20), con `?inline` en Vite para quien necesite el string. En runtime, sólo para live theming, `applyTheme(json)` aplica **el mismo JSON** con el mismo generador (**MIG-B6-30**, nueva). Los setters globales representables delegan al JSON; scope local y ajuste de media queries conservan adaptadores legacy probados. `applyTheme` es síncrono; el editor agrupa por frame. La paridad runtime cubre valores compatibles con la estructura compilada; cambios de estados/campos/Surface/umbrales requieren recompilar (MIG-B6-30) |
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
   El plugin solo conserva sus `$vars` simples (MIG-B6-14); imports/preprocesado
   completo pertenecen a core. Documentar y probar esa frontera.
3. **Cada hallazgo cierra con su reproducción convertida en test o fixture.** La
   tabla "Estado verificado" es la lista de regresiones mínima.
4. **Sin sintaxis nueva** (D4 de FEAT-007).
5. **Cambios visuales sólo con sección `Visual changes`** en el CHANGELOG. El guard
   `verify:docs` ya lo exige para los archivos de defaults.
6. **Sin publicar sin aprobación.** Ningún agente ejecuta `npm publish`, cambia
   dist-tags ni publica la extensión.
7. **Lo que no está en este documento o sus fichas va a seguimiento.**
8. **Contratos y evidencia en las fichas.** Cada criterio enlaza su regresión,
   comando y resultado; actualizar README, migration, AGENTS y guías afectadas en
   el mismo PR. El [protocolo](FEAT-008/README.md) define estado y cierre.
9. **No confundir plan con API publicada.** Las fichas norman el trabajo pendiente;
   la guía actual sólo cambia su descripción de runtime cuando exista implementación.

---

## Contratos de implementación

Las fichas son la única especificación detallada de cada story. Se retiran de
este documento las copias de sus pasos de implementación para evitar instrucciones
contradictorias. La filosofía y D-1 a D-7 siguen arriba; contratos de API, límites,
pruebas, documentación y aceptación se mantienen en los enlaces siguientes.

- [MIG-B6-01 — Familias top-level reconocidas (completar)](FEAT-008/MIG-B6-01-familias-top-level.md)
- [MIG-B6-13 — Errores y avisos con ubicación](FEAT-008/MIG-B6-13-errores-con-ubicacion.md)
- [MIG-B6-14 — Cero salidas silenciosas del lenguaje](FEAT-008/MIG-B6-14-cero-salidas-silenciosas.md)
- [MIG-B6-29 — El JSON base es la única fuente de defaults](FEAT-008/MIG-B6-29-json-base-unica-fuente.md)
- [MIG-B6-15 — Selectores funcionales y `!important` responsive](FEAT-008/MIG-B6-15-selectores-e-important.md)
- [MIG-B6-16 — Override parcial explícito](FEAT-008/MIG-B6-16-override-parcial-explicito.md)
- [MIG-B6-17 — `@ds-typo` emite sólo lo que define el tema](FEAT-008/MIG-B6-17-ds-typo-solo-tema.md)
- [MIG-B6-30 — applyTheme(json): un modelo de tema en build y runtime](FEAT-008/MIG-B6-30-apply-theme-runtime.md)
- [MIG-B6-18 — `compile()` compartido en `uxdsl-core`](FEAT-008/MIG-B6-18-compile-compartido.md)
- [MIG-B6-19 — Configuración única de tema y breakpoints](FEAT-008/MIG-B6-19-configuracion-unica.md)
- [MIG-B6-20 — Adaptadores Vite y Webpack sobre `compile()`](FEAT-008/MIG-B6-20-adaptadores-vite-webpack.md)
- [MIG-B6-21 — Sourcemaps vía PostCSS](FEAT-008/MIG-B6-21-sourcemaps.md)
- [MIG-B6-22 — Flags estrictos del CLI](FEAT-008/MIG-B6-22-flags-estrictos.md)
- [MIG-B6-23 — Watch robusto](FEAT-008/MIG-B6-23-watch-robusto.md)
- [MIG-B6-24 — Guardas de `builds`](FEAT-008/MIG-B6-24-guardas-builds.md)
- [MIG-B6-25 — Validación de referencias en tiempo casi lineal](FEAT-008/MIG-B6-25-referencias-lineales.md)
- [MIG-B6-26 — Extensión VS Code 0.1.0 confiable](FEAT-008/MIG-B6-26-extension-vscode.md)
- [MIG-B6-27 — Tipos y esquema de configuración](FEAT-008/MIG-B6-27-tipos-y-esquema.md)
- [MIG-B6-02 — Procedencia exacta de la validación de FEAT-002](FEAT-008/MIG-B6-02-procedencia-feat-002.md)
- [MIG-B6-28 — Higiene de paquetes y npm](FEAT-008/MIG-B6-28-higiene-npm.md)
- [MIG-B6-12 — Gate de release beta.6 (re-alcanzado)](FEAT-008/MIG-B6-12-gate-beta6.md)

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

## Orden y coordinación

El [índice de agentes](FEAT-008/README.md#orden-de-integración) es la única tabla de
dependencias/estado. Sus filas están ordenadas para integrar sin ciclos e incluyen
la serialización de archivos compartidos. Preparar fixtures o inventarios antes
no equivale a integrar una story antes de sus dependencias.

01, 02 y 13 pueden empezar independientemente. 29 y 28 pueden inventariar datos y
tarballs; 18 puede capturar el corpus. La implementación del pipeline espera flags;
runtime espera base, tipografía y tipos definitivos. 12 cierra tras las demás.
No cambiar la filosofía ni abrir sintaxis nueva para sortear una dependencia.

La revisión humana de colores se hace sobre tabla/diff producido por 29, en su PR;
no hace falta detener la preparación de cambios ya autorizados por D-1/D-2.

---

## Definition of done prepublish de beta.6

- [ ] Cero avisos falsos: el ejemplo del README, el manifiesto, Press Craftor y un
      tema con familias propias, `modes` y `typography` compilan sin avisos. (UX-01)
- [ ] Ningún adaptador altera comentarios ni `url()`. La suite de paridad pasa por
      CLI, core, Vite y Webpack. (UX-02, UX-16, N-02)
- [ ] Diagnóstico CSS trae archivo:línea:columna de origen; tema/config trae ruta
      de archivo/key cuando existe. Runtime sin archivo no inventa ubicación;
      catálogo y fixtures comprueban cada clase de error. (UX-03)
- [ ] Los flags aceptan `=true`/`=false`, y los flags o familias desconocidos
      producen error. (UX-04)
- [ ] Directivas reservadas sin procesar y typos responsive identificados por el
      contrato de 14 dan error; funciones CSS nativas/custom conservan sus controles
      positivos. No se promete validación CSS exhaustiva. (UX-06, UX-15, N-01)
- [ ] Selectores funcionales y `!important` responsive tienen fixtures. (UX-05, UX-07)
- [ ] El JSON base es el default de la librería (única fuente de defaults) y pasa el
      gate de contraste en claro y en oscuro, o declara sus excepciones. (N-07, N-08)
- [ ] El override parcial está documentado y visible en `uxdsl theme --diff`, y
      `uxdsl theme --contrast` verifica el tema efectivo. (UX-08)
- [ ] `applyTheme(json)` síncrono inicializado con el tema de build/SSR: valores
      compatibles tienen paridad; cambios estructurales fallan con guía de recompilación.
      Fuentes, eventos y excepciones legacy documentados/probados. (D-4, MIG-B6-30)
- [ ] `@ds-typo` emite sólo lo que el tema define; el compilador no aporta valores
      propios. (UX-09)
- [ ] 24.000 líneas con referencias activas en menos de 2 s en máquina declarada,
      equivalencia semántica y razón de escalado verificadas según 25. (UX-10)
- [ ] Watch se recupera de error inicial/import faltante, no pierde eventos ni
      reescribe salidas iguales. Preparación conjunta y reemplazo atómico por
      archivo con recuperación; no se promete transacción multipath. (UX-11)
- [ ] Los scaffolds de `init` no se anulan entre sí y validan contra el tema del
      proyecto. Una salida `.module.css` nunca contiene `:root`. (UX-12, UX-13, UX-14)
- [ ] Vite y Webpack declaran dependencias, extraen CSS real y no filtran rutas
      absolutas. Config/JSON dan el mismo resultado; runtime respeta el alcance
      de estructura compatible de 30. (N-03, N-04, D-4)
- [ ] La gramática es JSON válido, generado y probado en CI. La extensión 0.1.0 está
      publicada o el release dice por qué no. (N-05, UX-17 parcial)
- [ ] Tipos exportados y JSON Schema con test. (UX-18)
- [ ] Sourcemaps en el CLI con las garantías de MIG-B6-21. (UX-20)
- [ ] Los cinco tarballs tienen exports/bin/assets y dependencias válidas, allowlists
      y presupuestos comprobados; hashes identifican el candidato probado. Script
      soporta beta/RC/estable y preflight sin publicar. (UX-21)
- [ ] La fixture de beta.6 pasa desde tarballs y las anteriores no regresionan.
- [ ] Press Craftor valida los tarballs: cero avisos y sólo los cambios visuales
      documentados.
- [ ] README, migration guide y CHANGELOG de cada paquete modificado están alineados;
      los cambios visuales tienen su sección.
- [ ] Candidato listo para solicitar aprobación explícita; no se ha publicado
      durante el gate ni convertido un check externo pendiente en PASS.

## Comprobaciones posteriores a publicación

No forman parte de la DoD prepublish. Sólo tras la aprobación y publicación:

- [ ] Para beta.6, latest y beta apuntan a la versión aprobada en los cinco paquetes.
- [ ] Tarballs publicados corresponden al candidato probado; resultado registrado.
- [ ] Estado real de Marketplace/Open VSX registrado sin afirmar publicación por
      haber generado un VSIX. RC y estable tendrán política de tags explícita propia.

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| MIG-B6-18 es grande y cambia el grafo de paquetes | Retrasa todo el release | Suite de paridad con oráculo **antes** del refactor; converge con defaults, mapas y runtime; seguir dependencias del índice |
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
El SHA/entorno/resultado se registra en cada ficha y el release record. El paso
externo de Press Craftor exige evidencia del equipo; no se sustituye por una fixture.
