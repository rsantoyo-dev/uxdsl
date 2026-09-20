# FEAT-007 — UXDSL 0.5.0-beta.6: fundamentos verificables hacia 1.0

| Campo | Valor |
| --- | --- |
| Estado | **Re-planificada el 2026-09-18 (decisión D-7 del dueño):** el alcance de beta.6 pasa a [FEAT-008](FEAT-008-beta6-reliability.md), que conserva MIG-B6-01, MIG-B6-02 y MIG-B6-12. MIG-B6-03 a MIG-B6-11 quedan para después de `0.5.0`, y MIG-B6-04 queda reemplazada en su mayor parte por MIG-B6-21 de FEAT-008. Estado anterior: **MIG-B6-01 parcial:** el warning falso de claves dentro de `palette`/`fonts.families`/`typography_details` está retirado y verificado (`npm test`: 249 tests, 0 fallos; `npm run verify:beta5` en verde), pero `modes` y `typography` — familias top-level que el compilador sí lee (`foundations.ts:55`, `typography.ts:91`) — siguen produciendo `Unknown theme family` (reproducido el 2026-09-18). La especificación activa de beta.6 es [FEAT-008](FEAT-008-beta6-reliability.md) y su [índice de agentes](FEAT-008/README.md). Los apartados siguientes conservan el diseño histórico; sus gates/DoD no se suman al release activo. El resto de estas stories sigue sin empezar; publicar requiere la DoD activa y aprobación explícita |
| Objetivo | Corregir afirmaciones y diagnósticos que exceden la evidencia real, publicar un contrato candidato de 1.0 y construir la infraestructura mínima de origen/sourcemaps sobre la que deben apoyarse el tooling consciente del tema y las migraciones |
| Versión objetivo | `0.5.0-beta.6` para los cinco paquetes npm coordinados; la extensión VS Code conserva versionado y publicación independientes |
| Prioridad | P0: verdad de documentación y regresión de registros abiertos; P1: contrato candidato y sourcemaps; P2: semántica de contraste, contrato formal de Density y arquitectura de paquetes; tracks paralelos: tooling, benchmarks y migradores |
| Depende de | FEAT-006 (`0.5.0-beta.5`), publicada |
| Origen | Revisión pre-1.0 de confiabilidad, adopción y posicionamiento; auditoría del árbol actual realizada el 2026-09-17 |
| Publicación | Fuera de la implementación automática. Requiere aprobación explícita del dueño después de ejecutar todos los gates |

## Resumen ejecutivo

Esta beta no debe intentar presentar nueve líneas de trabajo grandes como si todas
estuvieran terminadas. El objetivo es establecer una base verificable y evitar tres
errores de producto:

1. afirmar cobertura que una fixture concreta no ejecuta;
2. construir tooling y migradores sobre una gramática todavía implícita;
3. aumentar transformaciones del compilador sin preservar el origen del código.

La beta.6 tiene dos niveles de compromiso:

### Bloqueadores de publicación

- **MIG-B6-01:** retirar el warning falso sobre claves válidas de registros abiertos.
- **MIG-B6-02:** corregir la procedencia exacta de las verificaciones de FEAT-002.
- **MIG-B6-03:** publicar el contrato candidato de 1.0 y su política de cambios.
- **MIG-B6-04:** entregar el primer vertical slice real de sourcemaps, sin romper la
  API que hoy devuelve un string.
- **MIG-B6-05:** separar terminológicamente token `contrast` de contraste WCAG
  verificado.
- **MIG-B6-06:** formalizar Density tal como existe, sin anunciar modos futuros.
- **MIG-B6-07:** documentar la arquitectura de paquetes y ofrecer una decisión
  explícita sobre instalación, sin publicar un agregador no verificado.
- **MIG-B6-12:** gate coordinado de release desde tarballs.

### Tracks paralelos que comienzan en beta.6 pero no pueden fingirse completos

- **MIG-B6-08:** base de tooling consciente del tema; entrega de un servicio de
  lenguaje reutilizable y un MVP de diagnósticos/completado, no un LSP completo.
- **MIG-B6-09:** harness reproducible de benchmarks y baseline etiquetado como tal;
  no publicar una afirmación de superioridad sin revisión metodológica.
- **MIG-B6-10:** especificación y fixtures de migración de Tailwind, MUI `sx` y
  Sass; sólo automatizar subconjuntos estáticos demostrablemente seguros.
- **MIG-B6-11:** RFC ejecutable para un paquete frontal `uxdsl`; su publicación
  depende de verificar nombre, ownership, contenido y compatibilidad del release.

Un track paralelo puede quedar pendiente sin bloquear beta.6 sólo si el release y
el changelog lo dicen expresamente. Ningún checkbox se marca por tener un diseño o
un prototipo: cada story exige pruebas y evidencia.

---

## Decisiones rectoras

### D1 — Evidencia atribuible

Toda frase como “verificado en navegador”, “probado en CSS Modules”, “SSR-safe” o
“sin runtime” debe nombrar:

- fixture o test exacto;
- comando exacto;
- entorno relevante;
- qué se comprobó;
- qué no se comprobó.

Una fixture puede invocar otra, pero la documentación debe distinguir quién
compila, quién ejecuta Next.js y quién abre Chrome.

### D2 — Contrato antes que conveniencia

El contrato candidato de 1.0 es la entrada para tooling, migraciones y benchmarks.
No se duplicarán listas de directivas, familias, argumentos o diagnostics en cada
adaptador. Si una lista no puede derivarse de una fuente compartida, el delivery
debe declarar temporalmente al dueño y añadir un test de deriva.

### D3 — Compatibilidad aditiva durante beta.6

`processUxdsl(source, options)` debe seguir devolviendo `Promise<string>`. Los
sourcemaps y diagnostics estructurados se introducen mediante una API aditiva. No
se cambia silenciosamente el tipo de retorno usado por Vite, Webpack o consumidores
directos.

### D4 — Source provenance antes de lenguaje más complejo

No se agregará sintaxis nueva a Density, temas o componentes en este release. El
vertical slice de sourcemaps debe cubrir primero la sintaxis existente y documentar
los casos que todavía no puede mapear con precisión.

### D5 — `contrast` es un rol, no un resultado de auditoría

Un nombre como `primary.contrast` representa el foreground elegido por el tema.
No certifica ratio WCAG, tamaño de texto, estado, modo, transparencia, imagen de
fondo ni `forced-colors`.

### D6 — Density se formaliza sin inventar modos

En beta.6 Density sigue siendo una referencia a una progresión responsive de
Spacing. `compact`, `comfortable`, `spacious`, touch density, preferencias globales
y density por familia son ideas futuras, no aliases reservados ni promesas públicas.

### D7 — Cinco paquetes internos no deben convertirse en cinco decisiones del usuario

Se explicará la separación entre motor, core, CLI y adapters. Un paquete frontal
sólo se publica cuando pueda garantizar una instalación coherente; no se resuelve
la fricción renombrando el `package.json` raíz ni publicando un paquete vacío.

---

## Baseline verificado

| Área | Estado actual verificado | Consecuencia para beta.6 |
| --- | --- | --- |
| Paquetes publicados | `postcss-uxdsl`, `uxdsl-core`, `uxdsl-cli`, `vite-plugin-uxdsl` y `uxdsl-webpack-loader` están coordinados en `0.5.0-beta.5` | El root `package.json` con nombre `uxdsl` y versión `1.0.0` no prueba que exista un agregador publicable |
| VS Code | `uxdsl-vscode@0.0.1` registra sólo completion provider y gramática | No describirlo como tooling consciente del tema |
| Core | `uxdsl-core/src/index.ts` fuerza `map: false` y retorna CSS string | Hace falta API aditiva de resultado para sourcemaps |
| CLI | `compileEntryToCss` conserva `Result` internamente pero devuelve sólo `finalCss` | Puede adoptar la API de resultado sin romper escritura atómica |
| Vite | El transform termina en `{ code, map: null }` y embebe CSS en JavaScript | Un mapa CSS no puede pasarse ingenuamente como mapa JS; requiere contrato explícito |
| Webpack | El loader devuelve un módulo JS string y no usa el tercer argumento `sourceMap` del callback | Debe definirse si el loader seguirá exportando string o se alineará con una cadena CSS estándar |
| Diagnostics | La mayoría de módulos lanza `Error(string)`; `ReferenceIssue` ya tiene `source`, `line`, `column` | Usar `ReferenceIssue` como precedente, no crear un formato incompatible |
| Density | `language.ts` centraliza defaults, parser responsive, generación y metadata | Formalizar este comportamiento; no añadir modos |
| Contraste | AGENTS y algunas páginas ya advierten que `contrast` no garantiza accesibilidad | Convertir la advertencia dispersa en contrato terminológico consistente |
| MIG-07 | `fixtures/mig07-consumer/run.js` instala tarball, compila cinco entradas, compara paridad/determinismo y usa inspectores | No atribuirle navegador ni build real de CSS Modules |
| CSS Modules | `fixtures/mig02-nextjs-cssmodules/run.js` ejecuta un `next build` positivo y un control negativo `is not pure` | Ésta es la evidencia real de CSS Modules/Next.js 14 Pages Router |
| Navegador | `fixtures/mig02-nextjs-cssmodules/browser.js` lanza Chrome mediante `playwright-core` y compara computed styles | Ésta es la evidencia real de navegador controlado; no es auditoría visual de una aplicación completa |
| Registros de tema | `palette`, `fonts.families` y `typography_details` aceptan nombres de proyecto que cumplen forma; `DEFAULT_THEME` es mínimo | No usar las claves de `DEFAULT_THEME` como catálogo cerrado |

---

# MIG-B6-01 — Registros abiertos sin warnings falsos (P0)

## Historia

Como consumidor con roles propios de Palette, fuentes o Typography, quiero que un
nombre válido definido por mi proyecto compile sin un warning falso que diga que no
será emitido.

## Problema reproducido

MIG-B5-02 comparó nombres de `typography_details`, `palette` y `fonts.families`
contra las claves mínimas de `DEFAULT_THEME`. Esa comparación confunde dos conceptos:

- defaults suficientes para zero-config;
- catálogo completo de nombres permitidos.

El catálogo cerrado no existe. `typography.ts` valida la forma del role y sus
campos; `foundations.ts` emite nombres suministrados por el proyecto.

## Alcance

- `packages/postcss-uxdsl/src/ds-runtime/theme-validate.ts`.
- Tests de validación de tema.
- Tests CLI que retransmiten warnings.
- `fixtures/mig-b5-03-release/run.js`, para conservar el gate histórico con la
  expectativa corregida.
- CHANGELOG y migration guide de beta.6.

## Implementación requerida

1. Eliminar la comparación de nombres internos contra `DEFAULT_THEME`.
2. Mantener el warning de familias **top-level** desconocidas: el conjunto de
   familias top-level sí forma parte del contrato.
3. Mantener errores duros sobre campos cerrados reales, por ejemplo
   `typography_details.h1.fontsize` cuando el campo soportado es `fontSize`.
4. Mantener validación de forma de nombres (`role`, token key) en el motor dueño.
5. No sustituir el check eliminado por una lista manual más grande.
6. No silenciar errores reales de referencia: definir un role no implica que sus
   dependencias puedan quedar sin resolver.
7. Actualizar comentarios que todavía digan “unknown nested key” como capacidad.

## Criterios de aceptación

- Un role nuevo `palette.brand`, una fuente `fonts.families.marketing` y un tag
  `typography_details.display-xl` no producen warning sólo por no estar en
  `DEFAULT_THEME`.
- Una familia top-level `palete` sí produce warning.
- Un campo tipográfico `fontsize` sigue produciendo `UXD_TYPO_FIELD`.
- El build real del CLI imprime warnings top-level una sola vez por proceso watch.
- El fixture beta.5 sigue pasando con la expectativa histórica corregida.

## Pruebas requeridas

- `theme-validate-open-registries.test.js`: tres registros abiertos y control
  negativo top-level.
- Test de field cerrado en Typography.
- Test CLI de no-warning para role custom.
- Test CLI de warning top-level y deduplicación.
- Fixture desde tarballs en MIG-B6-12.

## Evidencia (D1)

| Evidencia | Comando | Verifica | No verifica |
| --- | --- | --- | --- |
| Registros abiertos en el motor | `npm --prefix packages/postcss-uxdsl test` (suite `test/theme-validate-open-registries.test.js`) | `palette.brand`, `fonts.families.marketing` y `typography_details.display-xl` sin warning; `palete` top-level con warning; `typography_details.h1.fontsize` como error `UXD_TYPO_FIELD` | El build real del CLI, la extensión VS Code, navegador |
| Retransmisión desde el CLI | `npm --prefix packages/uxdsl-cli test` (tests `MIG-B5-02`/`MIG-B6-01` sobre `warnUnknownThemeKeys`) | que el CLI imprima el warning top-level, lo deduplique por mensaje exacto y no imprima nada para un tag custom | Un `build` en disco; eso lo cubre la fixture |
| Gate histórico beta.5, desde tarballs | `npm run verify:beta5` | que un `uxdsl build` real sobre los cinco paquetes empaquetados imprima `Unknown theme family "color"`, no imprima el warning retirado para `typography_details.h9`, y escriba el CSS igual | Publicación en npm, navegador, CSS Modules |
| Suite completa del repo | `npm test` | 249 tests, 0 fallos: sin regresión en motor, core, CLI, fixture MIG-07, guard de docs y artefactos de lenguaje | Los tracks paralelos de beta.6, aún sin empezar |

Estado: las cuatro filas ejecutadas en verde el 2026-09-18, pero no cubren `modes`/`typography` top-level, que siguen avisando en falso; la story no está cerrada. La fixture propia de
beta.6 (MIG-B6-12) sigue pendiente; hasta que exista, la evidencia desde tarballs
para esta story es la del gate de beta.5 con su expectativa corregida.

---

# MIG-B6-02 — Procedencia exacta de la validación FEAT-002 (P0)

## Historia

Como lector de un delivery document, quiero saber exactamente qué ejecutó cada
fixture, para poder reproducir una afirmación de navegador o CSS Modules sin confiar
en una frase agregada.

## Archivos

- `docs/features/FEAT-002-beta-migration-hardening.md`.
- `fixtures/mig07-consumer/README.md`.
- `fixtures/mig02-nextjs-cssmodules/README.md`.
- Root `README.md` y release records que atribuyan cobertura.

## Redacción contractual requerida

FEAT-002 debe contener una tabla equivalente a ésta:

| Evidencia | Comando | Verifica | No verifica |
| --- | --- | --- | --- |
| Consumidor de tarball | `npm run verify:consumer-fixture` | build de `postcss-uxdsl`, `npm pack`, instalación local, cinco entradas, `includeTheme`, integridad de referencias, paridad runtime/PostCSS, determinismo e inspectores | Browser, css-loader, Next.js, revisión visual completa, instalación coordinada de cinco paquetes |
| Next.js/CSS Modules | `npm run verify:cssmodules-build` | invoca primero el consumidor de tarball, compila outputs, ejecuta Next.js 14 Pages Router production build con cuatro `.module.css`, y control negativo `:root`/`is not pure` | App Router, Next.js 16, revisión visual completa |
| Chrome controlado | `fixtures/mig02-nextjs-cssmodules/browser.js`, invocado por el comando anterior | computed styles light/dark para padding, radius, border y background en 12 anchos de frontera; generación inválida no reemplaza CSS aplicado | Auditoría visual de producto, todos los componentes, todos los navegadores, accesibilidad |

## Implementación requerida

1. Dividir MIG-07 en “packaged consumer” y referencias a gates externos.
2. No decir que `mig07-consumer/run.js` abre Chrome o ejecuta css-loader.
3. Explicar que `mig02-nextjs-cssmodules/run.js` invoca MIG-07 antes de compilar.
4. Nombrar Pages Router y Next.js 14.
5. Mantener explícitos los gaps de App Router/Next.js 16.
6. Si Chrome no está disponible, el comando debe fallar o documentar un skip
   detectable; nunca convertir un inspector en “browser verified”.
7. Añadir un test documental simple que compruebe que FEAT-002 contiene las tres
   rutas y no vuelve a atribuir browser a MIG-07.

## Criterios de aceptación

- Un lector puede copiar un comando por afirmación.
- Ninguna frase usa “fixture integrada” de manera ambigua.
- El release record distingue coverage ejecutado de coverage no ejecutado.
- `git grep` no encuentra una afirmación contradictoria en README/release docs.

---

# MIG-B6-03 — Contrato candidato de UXDSL 1.0 (P1)

## Historia

Como autor de una integración, herramienta o migrador, quiero un contrato candidato
versionado que diga qué sintaxis, defaults, configuración y diagnostics deben
permanecer compatibles en 1.0.

## Entregables

Crear `docs/contracts/1.0/` con:

1. `language.md` — léxico, gramática, precedencia y convivencia con CSS.
2. `theme.md` — esquema, familias abiertas/cerradas, merge y defaults.
3. `configuration.md` — PostCSS, core, CLI, Vite y Webpack; precedencias.
4. `diagnostics.md` — forma estructurada, catálogo de códigos y severidades.
5. `visual-defaults.md` — defaults que afectan output visible y cómo se versionan.
6. `compatibility.md` — SemVer, deprecaciones, breaking changes, migraciones.
7. `verification.md` — matriz afirmación → test/fixture/comando.
8. `README.md` — índice, estado `candidate`, versión del contrato y owners.

## Requisitos de `language.md`

Documentar sin reinterpretar el comportamiento actual:

- CSS nativo válido permanece CSS nativo.
- Funciones de token: `space`, `density`, `color`, `palette`, `radius`,
  `rounded`, `border`, `shadow`, `elevation`.
- Grupos responsive por breakpoint configurado.
- Directivas soportadas: `@theme`, `@ds-surface`, `@ds-button`, `@ds-input`,
  `@ds-typo` y aliases que realmente estén cubiertos por tests.
- Gramática de argumentos y precedencia de role/tone/size/`radius()`/`shadow()`.
- Precedencia: defaults, legacy same-compilation, JSON, argumentos del mixin,
  declaración CSS posterior y `!important`.
- Manejo de expresiones nativas anidadas.
- Requisitos de base responsive.
- Identificadores permitidos y casos rechazados, incluidos decimales de Density.
- Namespace CSS `--uxdsl__<family>__<key>` y excepción legacy documentada de
  `theme.typography` plano.
- Qué no valida UXDSL: gramática CSS completa, DOM/cascade arbitraria y a11y.

La gramática debe incluir una representación formal EBNF o equivalente y ejemplos
positivos/negativos. La EBNF no puede aceptar formas que el parser rechaza ni omitir
aliases públicos cubiertos.

## Requisitos de `theme.md`

Clasificar cada nivel:

- **Familias top-level cerradas:** lista reconocida por el validador.
- **Registros abiertos:** nombres de roles/tags/tokens definidos por proyecto.
- **Objetos de campos cerrados:** campos permitidos dentro de Surface/Button/Input/
  Typography y states permitidos.

Documentar:

- `resolveTheme` y deep merge;
- arrays/scalars replace, object keys merge, `undefined` no reemplaza;
- normalización de Spacing;
- `includeTheme` y multi-entry;
- `references` y proveedores externos;
- modos realmente soportados (`modes.dark.palette`), sin generalizar a un sistema
  multimarca aún inexistente;
- defaults exactos mediante fuente generada o link al artefacto; no copiar tablas
  manuales sin drift test.

## Requisitos de `diagnostics.md`

Definir un shape objetivo común:

```ts
interface UxdslDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  source?: string;
  range?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  hint?: string;
  before?: string;
  after?: string;
  related?: Array<{ source?: string; message: string; range?: UxdslDiagnostic['range'] }>;
}
```

Decisiones:

- líneas/columnas públicas son 1-based; adapters convierten a LSP 0-based;
- `code` es estable dentro de major;
- cambiar significado o eliminar un código es breaking;
- el mensaje humano puede mejorar sin breaking si el código y los datos siguen;
- `before/after` sólo es obligatorio cuando existe una corrección mecánica no
  ambigua; no inventar patches para errores semánticos;
- todo error conserva `cause` cuando envuelve otro error.

Inventariar todos los `UXD_*` actuales y decidir para cada uno: público estable,
legacy/deprecado o interno. Añadir test que detecte códigos emitidos no inventariados.

## Requisitos de `visual-defaults.md`

- Definir qué archivos son dueños de defaults visibles.
- Ampliar el guard actual si existen defaults visuales fuera de
  `default-theme.ts`, `typography-defaults.ts` y `typography.ts`.
- Exigir sección `Visual changes` con impacto, afectados, before/after y migración.
- Un cambio de default puede ser SemVer minor antes de 1.0 sólo si el release lo
  declara; después de 1.0 sigue la política aprobada en `compatibility.md`.

## Política objetivo de breaking changes

Todo breaking change debe incluir:

1. decisión SemVer explícita;
2. deprecación previa cuando técnicamente sea viable;
3. guía de migración;
4. codemod si la transformación es determinista;
5. reporte de casos no automatizables;
6. diagnostic accionable durante la ventana de migración;
7. changelog con consecuencias visuales y operativas;
8. fixture de consumidor anterior y posterior;
9. aprobación humana para publish.

“No hay codemod seguro” es una conclusión válida si se documentan los casos y se
provee detector/preview. Crear un codemod que adivina no satisface el contrato.

## Criterios de aceptación

- Cada sintaxis pública actual aparece en el contrato o queda marcada legacy.
- Tests de contrato compilan ejemplos positivos y rechazan negativos.
- Un script detecta diagnostics no inventariados.
- Los docs enlazan fuentes canónicas en lugar de duplicar defaults sin control.
- El contrato lleva estado `candidate`; no se anuncia como 1.0 final.

---

# MIG-B6-04 — Sourcemaps y origen estructurado, vertical slice (P1)

## Historia

Como consumidor que depura CSS generado o recibe un diagnostic, quiero llegar al
archivo y rango `.uxdsl` original, incluidos imports, antes de que el compilador
incorpore más transformaciones.

## Restricciones de compatibilidad

- `processUxdsl()` continúa devolviendo CSS string.
- La opción por defecto sigue sin emitir comentario de sourcemap ni archivo `.map`.
- No se devuelve un mapa CSS como si fuera mapa del módulo JavaScript de Vite.
- Multi-entry conserva compilación atómica: CSS y `.map` se escriben sólo cuando
  todas las entradas compilan.
- Paths del mapa deben ser reproducibles; no filtrar rutas absolutas por defecto.

## API aditiva propuesta en `uxdsl-core`

```ts
interface ProcessUxdslResult {
  css: string;
  map?: string;
  diagnostics: UxdslDiagnostic[];
  dependencies: string[];
}

interface SourceMapOptions {
  enabled?: boolean;
  inline?: boolean;
  annotation?: boolean;
  sourcesContent?: boolean;
}

processUxdsl.result(source, options): Promise<ProcessUxdslResult>
// o export nombrado equivalente si CommonJS/TypeScript lo requiere.
```

El nombre final debe aprobarse con un test de consumo CJS. No cambiar el callable
CommonJS existente.

## Trabajo de origen previo a PostCSS

El preprocesado actual elimina comentarios e inlinea imports mediante strings. Eso
destruye origen. Reemplazarlo por una representación que conserve segmentos:

```ts
interface SourceSegment {
  generatedStart: number;
  generatedEnd: number;
  source: string;
  originalStart: number;
  originalEnd: number;
}
```

Requisitos:

1. `stripLineComments` conserva saltos y offsets, sustituyendo texto removido por
   espacios cuando sea necesario.
2. El inliner devuelve contenido, dependencias y segmentos.
3. Imports duplicados/ciclos mantienen diagnostics relacionados con ambos archivos.
4. PostCSS recibe `from` y `to` reales.
5. Nodos generados por una directiva heredan la fuente de la directiva consumida.
6. Globals generados exclusivamente desde JSON se mapean al theme file cuando se
   conoce; de lo contrario quedan como generados por UXDSL, sin fingir una línea.
7. Metadata agregada por CLI no se atribuye a una declaración del usuario.

## PostCSS plugin

- Evitar `postcss.parse(generatedString)` sin reasignar `source` cuando el CSS
  generado proviene de una directiva localizada.
- Crear helpers únicos para insertar nodos generados y copiar source/range.
- Conservar `Result.messages` para warnings/dependencies.
- Añadir diagnostics estructurados sin eliminar errores existentes hasta definir
  la compatibilidad.

## CLI

Añadir configuración:

```js
module.exports = {
  sourceMap: false | 'inline' | 'external'
}
```

Y flags:

```bash
uxdsl build --sourcemap
uxdsl build --sourcemap=inline
uxdsl build --no-sourcemap
```

Precedencia: flag > build config > `false`.

Comportamiento:

- `external`: escribe `<outFile>.map` y annotation relativa en CSS.
- `inline`: data URI, sin `.map` separado.
- `false`: output byte-compatible salvo cambios previamente aprobados.
- En multi-entry, el modo es compartido inicialmente; no añadir override por entry
  sin una necesidad demostrada.
- El log informa bytes CSS y bytes map por separado.

## Webpack

Antes de implementar, decidir y probar el contrato real del loader. El estado actual
devuelve JavaScript (`module.exports = "css"`), no CSS puro. El vertical slice debe:

- consumir `processUxdsl.result`;
- pasar mapa y dependencias a Webpack de manera compatible con su cadena;
- usar `this.addDependency` para imports;
- añadir una fixture webpack real que compruebe `sources` y una posición mapeada;
- no declarar soporte si el mapa se pierde al envolver CSS en JS.

Si el contrato actual impide un mapa CSS útil, beta.6 debe documentar el loader como
“pendiente de migración de contrato” en vez de emitir un mapa inválido.

## Vite

Vite embebe CSS en un módulo JS. Separar:

- mapa JS del módulo transformado;
- mapa CSS del contenido insertado.

Para beta.6 son aceptables dos rutas, a decidir con fixture real:

1. migrar a virtual CSS module que Vite procese y pueda encadenar;
2. conservar inyección y exponer el mapa CSS para devtools mediante annotation/blob
   demostrablemente funcional.

`return { code, map: cssMap }` sin demostrar que el mapa corresponde al JavaScript
queda prohibido.

## Criterios de aceptación mínimos del release

- Core API aditiva retorna mapa para un archivo simple.
- Una declaración generada por `density()` apunta a la declaración `.uxdsl`.
- Una declaración generada por `@ds-button` apunta a esa directiva.
- Un archivo importado aparece como source separado y mapea a su línea original.
- CLI external/inline/false funcionan y multi-entry es atómico.
- Paths son relativos/reproducibles y `sourcesContent` sigue configuración.
- Vite/Webpack sólo se anuncian como soportados si sus fixtures verifican el mapa.

## Pruebas

- Unitarias de segmentos y comment stripping.
- Core CJS compatibility.
- Tests con `@import` anidado y ciclo.
- Snapshot/consumer de source-map queries por línea/columna.
- CLI single/multi-entry.
- Fixtures reales de adapters soportados.
- Control negativo: un mapa CSS no puede aceptarse como mapa JS.

---

# MIG-B6-05 — Contraste nominal versus WCAG (P2)

## Historia

Como consumidor, quiero saber si `contrast` es un nombre de rol o una garantía
medida, para no interpretar un token como certificación de accesibilidad.

## Contrato terminológico

Usar consistentemente:

- **contrast token / token de foreground recomendado:** valor elegido por el tema
  para acompañar un rol;
- **WCAG contrast result / contraste WCAG verificado:** ratio calculado para una
  combinación concreta, bajo algoritmo, tamaño/peso, estado y modo declarados.

Prohibido en documentación pública sin evidencia:

- “accessible contrast” para un token por nombre;
- “maximum contrast” sin medición;
- “WCAG compliant palette” por existir `.contrast`;
- “high contrast” cuando sólo significa fondo oscuro.

## Implementación requerida

1. Añadir una nota normativa en contrato `theme.md`.
2. Actualizar `postcss-uxdsl/README.md`, AGENTS y páginas Palette/Colors/Button/
   Input/Surface.
3. Renombrar labels descriptivos del playground que impliquen validación no hecha.
4. No renombrar la clave pública `.contrast` en beta.6; eso sería breaking.
5. Si existe helper visual heurístico, llamarlo “foreground preview”, no auditor.
6. Añadir una página/sección “Accessibility status” con matriz:
   - asignación de tokens: soportada;
   - cálculo WCAG: no soportado en compiler;
   - forced colors: CSS nativo, sin receta UXDSL específica;
   - reduced motion: CSS nativo, sin diagnostic específico.
7. Reservar un futuro diagnostic de contraste sólo después de definir resolución de
   colores, alpha, modos y pares de consumo; no inventar ratios sobre `var()` sin
   poder resolverlos.

## Criterios de aceptación

- Toda mención pública relevante distingue rol de resultado medido.
- Tests/docs no afirman auditoría de accesibilidad.
- `.contrast` sigue compilando igual.
- CHANGELOG declara cambio documental, no garantía nueva.

---

# MIG-B6-06 — Density como diferenciador formal existente (P2)

## Historia

Como evaluador o agente, quiero una definición precisa de Density que pueda aplicar
y verificar sin asumir que es pixels, multiplicador, interpolación o un modo futuro.

## Definición normativa

> Density es un token de spacing responsive. Cada clave identifica una progresión
> configurada que selecciona valores, normalmente referencias `space()`, en los
> breakpoints activos. La selección es escalonada e inclusiva; no interpola. La
> referencia se conserva como CSS variable para que cambios compartidos se propaguen.

## Comportamiento que debe congelarse como candidato

- keys numéricas enteras o nombres válidos; nunca coerción decimal silenciosa;
- Density 0 explícita;
- defaults dentro de Spacing 1–16;
- base requerida;
- persistencia del último breakpoint aplicable;
- referencias `space()` preservadas;
- JSON gana sobre legacy same-compilation, que gana sobre defaults;
- compilaciones aisladas;
- media query por defecto y emitter container explícito donde ya existe;
- supresión de reglas redundantes sin alterar semántica;
- `density(n)` no implica `space(n)` en todos los anchos;
- el size numérico de Surface/Button/Input compone Density y Radius, mientras
  `radius()`/`shadow()` permiten overrides independientes.

## Fuera de alcance y lenguaje prohibido

No implementar ni anunciar en beta.6:

- `compact`, `comfortable`, `spacious`;
- preferencias de usuario o globales de Density;
- density por subtree como API formal;
- density por familia de componente;
- curvas continuas;
- touch density;
- target size accesible automático;
- vínculo conceptual obligatorio entre padding y radius.

Puede existir un roadmap no vinculante, claramente marcado “exploración”.

## Entregables

- Sección normativa en `docs/contracts/1.0/language.md`.
- Página Density alineada con el contrato.
- README breve con enlace al contrato, sin absolutos como “siempre más aire”.
- AGENTS alineado con namespace actual `--uxdsl__`, corrigiendo ejemplos legacy.
- Fixtures contractuales de bordes de breakpoint y token nombrado.
- Test de deriva entre `DEFAULT_DENSITIES`, manifest y completions.

## Criterios de aceptación

- Misma definición en compiler docs, playground y guía de agentes.
- Ningún ejemplo promete modos inexistentes.
- Ejemplos comparan Density y Spacing a través de varios breakpoints.
- Tests cubren debajo/en/encima de cada transición relevante.

---

# MIG-B6-07 — Arquitectura e instalación de los cinco paquetes (P2)

## Historia

Como usuario, quiero saber qué instalar sin entender la organización interna del
monorepo, y como integrador quiero saber por qué los paquetes están separados.

## Mapa contractual

| Paquete | Responsabilidad | Usuario típico |
| --- | --- | --- |
| `postcss-uxdsl` | Plugin, semántica compartida, runtime/theme helpers | Integraciones PostCSS y dependencias internas |
| `uxdsl-core` | Preprocesado/imports y API programática de compilación | Autores de adapters |
| `uxdsl-cli` | build/watch/init/theme para cualquier framework | Camino recomendado framework-agnostic |
| `vite-plugin-uxdsl` | integración/HMR de Vite | Proyectos Vite |
| `uxdsl-webpack-loader` | adapter Webpack | Proyectos Webpack |
| `uxdsl-vscode` | soporte de editor, versionado separado | Desarrollo local; no forma parte de los cinco npm coordinados |

## Implementación requerida para beta.6

1. Añadir “Which package should I install?” al root README.
2. Documentar matrices de instalación, peer dependencies y quién instala transitivos.
3. Corregir frases que llamen “core” tanto a `postcss-uxdsl` como a `uxdsl-core`
   sin explicar la diferencia.
4. Auditar si Vite/Webpack requieren que el usuario instale `uxdsl-core` además del
   adapter; si dependency normal ya lo incluye, eliminar instrucciones redundantes.
5. Documentar que los cinco paquetes se publican coordinados hoy y qué problema
   resuelve cada frontera.
6. No presentar el root package como release 1.0.

## Criterios de aceptación

- Para Next/CLI, Vite y Webpack existe un comando recomendado único y verificable.
- Ningún README recomienda instalar una dependencia transitiva innecesaria.
- Una fixture limpia por camino instala sólo lo documentado y compila.
- La extensión queda claramente separada del release npm coordinado.

---

# MIG-B6-08 — Tooling consciente del tema, foundation track (P1 paralelo)

## Objetivo de beta.6

No construir todavía todo el LSP. Entregar una capa reutilizable que impida que la
extensión vuelva a implementar reglas con regex independientes.

## Arquitectura propuesta

Crear una API browser/Node-safe de servicio de lenguaje, dentro de
`postcss-uxdsl/language` o un módulo interno aprobado, con:

```ts
interface UxdslProjectContext {
  configPath?: string;
  themePath?: string;
  effectiveTheme: Record<string, unknown>;
  breakpoints: Record<string, number>;
  sourceFiles: string[];
}

interface UxdslCompletion {
  label: string;
  kind: 'directive' | 'function' | 'role' | 'token' | 'state' | 'argument';
  insertText: string;
  detail?: string;
  source?: string;
}
```

Servicios mínimos:

- descubrir config/tema sin ejecutar código no confiable dentro del extension host;
- resolver JSON y configuraciones soportadas mediante una estrategia explícita;
- listar tokens/roles reales del tema;
- validar buffer en memoria con debounce/cancelación;
- devolver diagnostics estructurados y ranges;
- invalidar cache al cambiar config, theme o requires locales;
- no tocar DOM ni localStorage.

## MVP VS Code

- completado theme-aware de Palette, Density, Spacing, Radius, Shadow y roles;
- diagnostics al guardar y, si performance lo permite, tras debounce;
- hover con nombre lógico, variable emitida y valor/progresión;
- go-to-definition sólo donde hay source conocida;
- status visible cuando no se pudo cargar el tema;
- fallback explícito a defaults, etiquetado “default”, nunca silencioso.

## No incluido en el MVP

- rename cross-language completo;
- formatter oficial;
- semantic tokens avanzados;
- remote configs;
- ejecución arbitraria de `.cjs` no confiable;
- publicación automática en Marketplace.

## Tests

- fixtures de proyecto: zero-config, JSON theme, CJS simple, config inválido,
  multi-entry, custom roles y archivo importado;
- buffer con error no guardado;
- cambio de theme invalida completions;
- ranges 1-based → LSP 0-based;
- extensión compila y sus providers no duplican listas del compiler.

## Gate

El MVP puede publicarse como VSIX prerelease independiente. El changelog npm no
debe afirmar que la extensión fue publicada si sólo compiló localmente.

---

# MIG-B6-09 — Benchmarks reproducibles, foundation track (P2 paralelo)

## Principio

El objetivo es reproducibilidad, no ganar una tabla. UXDSL no puede comparar output
sin minificación contra Tailwind minificado y presentar la diferencia como producto.

## Escenarios equivalentes

Crear `benchmarks/css-output/` con una UI canónica implementada en:

- `plain-css/`;
- `tailwind/`;
- `uxdsl/`.

La UI debe incluir el mismo conjunto de componentes/estados/breakpoints y no cargar
una biblioteca completa en un lado si el otro sólo contiene una página.

Escenarios mínimos:

1. una página, pocos componentes;
2. diez páginas con componentes repetidos;
3. multi-entry theme + CSS Modules;
4. tema light/dark;
5. build incremental tras editar un componente.

## Métricas

- bytes CSS raw;
- bytes minificados mediante la misma herramienta externa cuando aplique;
- gzip y Brotli;
- cantidad de reglas/declaraciones/media queries/custom properties;
- build frío, warm e incremental;
- versión de Node, OS, CPU, paquetes y configuración;
- media, mediana, desviación y número de runs;
- tamaño por entrada y total desplegado.

## Reglas metodológicas

- fijar lockfiles y versiones;
- Tailwind `content` configurado correctamente;
- no contar source maps dentro de CSS productivo, reportarlos aparte;
- separar theme CSS compartido de component CSS;
- ejecutar suficientes warmups;
- guardar resultados JSON y script de render, no editar la tabla a mano;
- CI detecta regresiones, pero budgets sólo se fijan después del baseline;
- publicar limitaciones y evitar causalidad no medida.

## Comandos objetivo

```bash
npm run benchmark:css
npm run benchmark:css -- --json artifacts/benchmark.json
npm run benchmark:verify
```

## Criterios para publicar resultados

- otra máquina puede reproducir el comando;
- las tres implementaciones pasan screenshots/computed-style equivalentes en los
  casos medidos;
- metodología revisada por una persona distinta del autor;
- README muestra fecha, commit y versiones;
- cualquier claim enlaza el JSON y explica el escenario.

Si esto no se cumple, beta.6 publica sólo el harness y un baseline “no comparable
para marketing”.

---

# MIG-B6-10 — Migraciones reales, foundation track (P2 paralelo)

## Regla de seguridad

Cada migrador comienza como analizador y preview. Sólo transforma construcciones
estáticas cuya equivalencia esté cubierta por fixture. Todo lo demás se reporta con
archivo, rango, razón y sugerencia manual.

## Tailwind → UXDSL

### Subconjunto automatizable inicial

- clases literales en `class`/`className`;
- spacing, color, radius, shadow y breakpoints con mapping explícito;
- extracción hacia una clase CSS/UXDSL estable;
- configuración Tailwind estática legible.

### Debe omitirse

- clases construidas dinámicamente;
- plugins no reconocidos;
- arbitrary values sin mapping aprobado;
- variantes complejas sin equivalente;
- orden/cascade cuya equivalencia no pueda probarse.

### Salida

- `.uxdsl` generado;
- patch de markup sólo en modo write;
- reporte de coverage: transformado, omitido, manual;
- mapping config versionado por proyecto.

## MUI `sx` → UXDSL

### Automatizable

- objetos literales;
- responsive object con keys conocidas;
- props visuales directas con mapping inequívoco;
- tokens de theme mediante mapping explícito.

### Omitir

- callback `sx={(theme) => ...}`;
- spread dinámico;
- condicionales runtime;
- arrays de precedencia no reducibles;
- behavior/props de componente que no son CSS.

No reemplazar componentes MUI ni comportamiento. Sólo migrar styling estático.

## Sass → UXDSL

### Automatizable

- variables y maps estáticos;
- usos directos en declaraciones;
- escalas seleccionadas por mapping hacia theme UXDSL.

### Omitir

- funciones/mixins con control flow;
- módulos dinámicos;
- aritmética cuya unidad/resultado dependa del contexto;
- side effects de import.

## Infraestructura compartida

Cada herramienta debe ofrecer:

```text
analyze → preview diff → write → second write no-op
```

Y producir JSON machine-readable:

```json
{
  "transformed": [],
  "skipped": [{ "file": "...", "range": {}, "reason": "dynamic-class" }],
  "manual": []
}
```

## Entregable beta.6

- tres fixtures representativas;
- especificación de mapping y reporte;
- al menos un vertical slice seguro por origen, o marcar el migrador como diseño si
  no existe equivalencia validada;
- guías manuales útiles aunque el codemod no cubra todo.

No usar la palabra “automatic migration” sin porcentaje/reporte de coverage.

---

# MIG-B6-11 — Instalación frontal `uxdsl`, RFC ejecutable (P2 paralelo)

## Problema

El usuario común instala al menos CLI + compiler. La separación interna es útil,
pero aparece como fricción de onboarding.

## Investigación obligatoria antes de código

1. Verificar disponibilidad y ownership real del nombre npm `uxdsl`.
2. Decidir si el package root actual es publicable o sólo metadata del monorepo.
3. Definir qué instala el agregador y qué queda peer/optional.
4. Evitar instalar Vite y Webpack simultáneamente como dependencias pesadas.
5. Decidir cómo expone el bin `uxdsl` sin colisión.
6. Definir política de versiones coordinadas y rollback parcial.
7. Probar npm/pnpm/yarn en proyectos limpios.

## Diseño recomendado

Un metapaquete delgado puede depender de:

- `uxdsl-cli`;
- `postcss-uxdsl`.

Vite/Webpack permanecen adapters explícitos o extras documentados. La extensión no
se instala desde npm como parte del metapaquete.

## Criterios antes de publicar

```bash
npm install -D uxdsl@beta
npx uxdsl init
npx uxdsl build
```

Debe funcionar desde un directorio vacío y desde Next/Vite sin hoisting accidental.
La tarball debe contener README, licencia, bin resoluble y dependencias coordinadas.

Si el nombre no está disponible o el diseño no está aprobado, beta.6 entrega el RFC
y mejora los comandos actuales; no publica un paquete diferente bajo un nombre
improvisado.

---

# MIG-B6-12 — Gate de release beta.6 (P1)

## Fixture nueva

Crear `fixtures/mig-b6-12-release/` reutilizando
`fixtures/lib/tarball-consumer.js`.

## Escenario obligatorio

1. Construir y empaquetar los cinco paquetes coordinados.
2. Instalar desde tarballs, sin links al monorepo.
3. Verificar custom Palette/font/Typography roles sin warnings falsos.
4. Verificar warning top-level y error de campo cerrado.
5. Compilar single-entry con sourcemap external e inline.
6. Compilar multi-entry y confirmar escritura atómica de CSS + maps.
7. Consultar mappings para declaración normal, `density()`, directiva y archivo
   importado.
8. Ejecutar los tests documentales de procedencia.
9. Ejecutar contrato examples positive/negative.
10. Confirmar output sin sourcemap compatible con baseline aprobado.
11. Ejecutar fixtures anteriores beta.2–beta.5.
12. Ejecutar `verify:cssmodules-build` sólo en entorno con Chrome declarado; registrar
    si el gate de release exige ese entorno o se corre en job separado obligatorio.

## No publicación automática

La fixture prepara evidencia. No ejecuta `npm publish`, no cambia dist-tags y no
solicita secretos. Publicar requiere aprobación explícita después de revisar:

- diff;
- tests;
- tarball contents;
- changelogs;
- resultado del benchmark etiquetado correctamente;
- known limitations.

---

## Distribución recomendada entre agentes

Los agentes deben trabajar en branches/PRs separables y no editar la misma fuente
canónica en paralelo sin coordinación.

| Track | Agente | Archivos principales | Depende de |
| --- | --- | --- | --- |
| A | Registros abiertos | validator, tests, fixture beta.5 | ninguno |
| B | Evidencia documental | FEAT-002, READMEs, test documental | ninguno |
| C | Contrato 1.0 | `docs/contracts/1.0`, inventarios/scripts | A para clasificación final |
| D | Source provenance/core | `uxdsl-core`, plugin helpers, tests | C diagnostics shape |
| E | CLI sourcemaps | CLI config/build/tests | D |
| F | Adapter sourcemaps | Vite/Webpack + fixtures | D; puede concluir “no soportado aún” con evidencia |
| G | Contraste y Density docs | contrato/README/playground/AGENTS | C |
| H | Package architecture | READMEs/fixtures install | ninguno |
| I | Tooling MVP | language service + VS Code | C y D |
| J | Benchmarks | `benchmarks/` aislado | contrato de Density y package install |
| K | Migradores | `packages/uxdsl-migrate` o ubicación aprobada | C; no bloquea sourcemaps |
| L | Release gate | fixture beta.6, release docs | todos los bloqueadores |

### Reglas de coordinación

- C define el shape de diagnostic antes de D/I.
- D no cambia el callable export existente.
- E/F no inventan mapas distintos; consumen el resultado de D.
- G no introduce sintaxis.
- I consume metadata compartida; no copia listas.
- J guarda datos generados; no convierte una medición local en claim universal.
- K no escribe sobre casos omitidos.
- L no publica.

---

## Orden recomendado

1. MIG-B6-01 y MIG-B6-02 en paralelo.
2. MIG-B6-03: contrato candidato e inventario de diagnostics.
3. MIG-B6-04 core provenance; después CLI; adapters al final.
4. MIG-B6-05, MIG-B6-06 y MIG-B6-07, alineados contra el contrato.
5. Iniciar MIG-B6-08/09/10/11 en paralelo una vez estable el contrato relevante.
6. MIG-B6-12 y regresión completa.
7. Revisión humana de release.
8. Sólo tras aprobación: bump, tarballs finales, publish y dist-tags.

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Cambiar retorno de core | Rompe Vite/Webpack/consumidores | API aditiva y test CJS |
| Inline imports destruye ubicación | Mapa convincente pero incorrecto | Segment map antes de PostCSS y queries de mapping |
| Pasar CSS map como JS map en Vite | Devtools engañoso | Virtual CSS o soporte declarado pendiente |
| Webpack loader contract ambiguo | Source map perdido | Fixture real y decisión de output |
| Contrato copia defaults | Drift inmediato | Generación/enlaces y drift tests |
| Diagnostic catalog incompleto | Tooling inconsistente | Script que descubre `UXD_*` emitidos |
| Benchmark injusto | Pérdida de credibilidad | metodología, JSON, revisión independiente |
| Migrador modifica código dinámico | Regresión de consumidor | analyze/preview, conservative skip, idempotencia |
| Agregador instala todo | Peso/conflictos | core frontal mínimo, adapters explícitos |
| Beta.6 demasiado grande | Release bloqueado indefinidamente | distinguir blockers y foundation tracks; no fingir completion |

---

## Matriz de comandos de verificación

```bash
# Motor y contrato
npm --prefix packages/postcss-uxdsl test
npm --prefix packages/uxdsl-core test
npm --prefix packages/uxdsl-cli test
npm --prefix packages/uxdsl-vscode run compile
node scripts/generate-language-artifacts.js --check

# Documentación y gates históricos
npm run verify:docs
npm run verify:consumer-fixture
npm run verify:beta2
npm run verify:beta3
npm run verify:beta4
npm run verify:beta5

# Nuevo gate
npm run verify:beta6

# CSS Modules + navegador, en job con Chrome
UXDSL_CHROME_PATH=/ruta/a/chrome npm run verify:cssmodules-build

# Tracks paralelos cuando existan
npm run benchmark:verify
npm run test:migrations
```

Los nombres de scripts nuevos se agregan al root `package.json` sólo cuando su
implementación exista. El documento no considera un comando como evidencia por
estar escrito aquí.

---

## Definition of done de beta.6

### Obligatoria

- [ ] Los registros abiertos no producen warnings falsos y los campos cerrados
      siguen validándose. (Parcial: falta `modes`/`typography` top-level; ver FEAT-008.)
- [ ] FEAT-002 atribuye tarball, CSS Modules y Chrome a sus fixtures exactas.
- [ ] Existe contrato candidato 1.0 para lenguaje, tema, config, diagnostics,
      defaults visuales, compatibilidad y verificación.
- [ ] Todos los códigos `UXD_*` emitidos están inventariados o marcados internos.
- [ ] Core conserva API string y ofrece API aditiva con mapa/diagnostics/dependencies.
- [ ] CLI soporta sourcemap false/inline/external sin romper multi-entry atómico.
- [ ] Una declaración normal, `density()`, una directiva y un import tienen mapping
      verificado.
- [ ] Vite/Webpack sólo declaran sourcemaps si pasan fixtures reales; los gaps quedan
      explícitos.
- [ ] Docs distinguen token `contrast` de contraste WCAG medido.
- [ ] Density está formalizada sin modos futuros.
- [ ] Los cinco paquetes y la extensión tienen responsabilidades e instalación
      explicadas.
- [ ] Fixture beta.6 pasa desde tarballs y las fixtures anteriores no regresionan.
- [ ] README, migration guide y CHANGELOG de cada paquete modificado están alineados.
- [ ] Publicación requiere aprobación explícita.

### Tracks paralelos, reportados por separado

- [ ] Tooling MVP consume theme/metadata compartida o se declara pendiente con los
      blockers técnicos restantes.
- [ ] Benchmark harness reproduce resultados JSON; cualquier tabla pública incluye
      metodología y limitaciones.
- [ ] Tailwind/MUI/Sass tienen fixtures y preview conservador; ningún caso dinámico
      se modifica silenciosamente.
- [ ] RFC del paquete `uxdsl` resuelve ownership, dependencies, bin y fixtures; no se
      publica un agregador vacío.

---

## Criterio de comunicación del release

El anuncio de beta.6 puede decir, sólo si los gates correspondientes pasan:

- “publicamos un contrato candidato hacia 1.0”;
- “el CLI puede emitir sourcemaps en los modos verificados”;
- “corregimos la atribución de fixtures y un warning falso para roles custom”;
- “formalizamos Density como responsive spacing basado en tokens”;
- “contrast sigue siendo un rol de tema, no una certificación WCAG”.

No puede decir todavía, salvo entregable y evidencia adicional:

- “tooling completo consciente del tema”;
- “migración automática desde Tailwind/MUI/Sass”;
- “UXDSL genera menos CSS que Tailwind”;
- “instalación de un solo paquete”;
- “sourcemaps soportados en todas las integraciones”;
- “contraste accesible garantizado”;
- “Density tiene modos compact/comfortable/spacious”.
