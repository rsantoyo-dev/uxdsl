# MIG-B7-16 — Documentación: ejemplos que se ejecutan y revisión de todas las superficies

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · release `0.5.0-beta.7` |
| Prioridad · Tamaño | P1 · L |
| Cierra | R-21 |
| Depende de | — (coordinar con [MIG-B7-12](MIG-B7-12-editor-support-consumidores.md) y [MIG-B7-15](MIG-B7-15-actualizar-sin-sorpresas.md), que escriben documentación de consumidor: esta ficha no la duplica, la verifica) |
| Bloquea | [MIG-B7-17](MIG-B7-17-playground-referencia.md) (usa el arnés del paso 2), MIG-B7-18 |
| Archivos | `scripts/` (arnés nuevo), todas las superficies del inventario del paso 1, `scripts/verify-docs-update.js` (sólo si se amplía `VISUAL_DEFAULT_FILES`), `package.json` raíz |

## Por qué

Petición del dueño, 2026-09-23: *"debemos revisar toda nuestra documentación y
playground; [UXDSL] debe ser el mejor implementador de sí mismo, y sus ejemplos
son pruebas vivas de todas sus capacidades"*. Esta ficha es la mitad de
documentación; el playground es [MIG-B7-17](MIG-B7-17-playground-referencia.md).

El principio, tomado de una recomendación externa ya evaluada en esta feature y
que se comprobó cierta: **un ejemplo de documentación que nadie compila es una
afirmación sin prueba, y envejece en silencio.** Hoy ninguno se compila.

## Estado verificado (2026-09-23, no asumido)

1. **Ningún ejemplo se ejecuta.** Los bloques de código de los README y de
   `AGENTS.md` son Markdown; los del playground son cadenas dentro de JSX
   (`<pre><code className="language-css">{`…`}</code></pre>`: 69 `<pre>` en los
   `.tsx`, cero bloques con valla en los 15 `.mdx`). No hay un solo test que los
   compile.
2. **Medido con el compilador actual** (plugin real, `includeTheme: false`):

   | Superficie | Bloques UXDSL encontrados | Compilan tal cual | No compilan |
   | --- | --- | --- | --- |
   | `README.md`, `AGENTS.md`, README de paquetes | 19 | 11 | 8 |
   | Componentes del playground (un solo patrón de extracción) | 21 | 17 | 4 |

   El segundo número es una **cota inferior**: sólo alcanza los bloques con la
   forma `language-css">{`…`}`; el resto de los `<pre>` no se extrajo.
3. **Clasificación de los 12 que fallan** (revisada a mano, no por conteo):
   - **Dependen del bloque de tema JSON que se muestra justo antes** y por eso no
     compilan aislados: 4 en `AGENTS.md` (`buttons.checkout`, `inputs.search`,
     `colors.blue-700`, `shadows.inset`) y los 4 del playground, que son los mismos
     cuatro ejemplos. No son defectos, pero prueban que **el arnés tiene que
     emparejar cada ejemplo con su tema**.
   - **Errores mostrados a propósito:** 2 en el README de `postcss-uxdsl`
     (`UXD_DIRECTIVE_CONTEXT`, `UXD_BREAKPOINT_UNKNOWN`), marcados sólo con un
     comentario. El arnés necesita un marcador explícito de "este error es el
     ejemplo".
   - **Necesita el pipeline del CLI**, no el plugin solo: 1 (`@mixin` con `$var`,
     README del CLI).
   - **Defecto real, 1:** README de `postcss-uxdsl` (~línea 742), en el mismo
     bloque que ilustra `color()`:
     `.a { color: color(primary); }  /* var(--uxdsl__color__primary) */`. Con el
     tema por defecto **no compila** (`UXD_REFERENCE_MISSING`: no existe
     `colors.primary`; los colores por defecto son `gray-300`, etc.). El ejemplo
     se presenta como salida real y no lo es sin definir antes ese color. Las otras
     dos líneas del bloque (`color(from red …)`, `color(display-p3 …)`) sí pasan
     intactas, como el texto promete: verificado una a una.
4. **La deriva ya ocurrió, varias veces, en esta misma feature:**
   - `docs/releases/0.5.0-beta.6.md` decía "156 pares" después de que MIG-B7-01
     los dejara en 123 (corregido el 2026-09-23).
   - `AGENTS.md` decía, en dos lugares, que quedaban "tres hallazgos" de contraste
     con el `placeholder` sin resolver, **después de que MIG-B7-01 lo cerrara** — un
     descuido de esa entrega, que la ficha de MIG-B7-01 declaró "no se tocó"
     (corregido el 2026-09-23; ver la nota en su tabla de evidencia).
   - Un consumidor externo reportó una copia de la guía atascada en la forma de
     beta.5 (copia suya; el problema de fondo, que la guía no viaja con el paquete,
     es de [MIG-B7-15](MIG-B7-15-actualizar-sin-sorpresas.md)).
   - El CHANGELOG de `postcss-uxdsl` rotula su sección `## 0.5.0-beta.6 —
     unreleased`, pero esa versión está publicada (`npm view postcss-uxdsl version`
     devuelve `0.5.0-beta.6`; el release record la da por publicada el 2026-09-23).
     El propio CHANGELOG dice que quita la fecha sólo mientras no se publica.
   - El guard `verify:docs` **no** habría avisado de nada de esto:
     `VISUAL_DEFAULT_FILES` no incluye `control-engine.ts` (límite (5) de la ficha
     de MIG-B7-01).
5. **Lo que sí está bien** (para no arreglar lo que no está roto): los 11 archivos
   que `AGENTS.md` manda mantener alineados (`DensityAgentGuidance.tsx` …
   `InputDocumentation.tsx`) **existen todos**; `npm run verify:docs` y
   `docs-provenance.test.js` pasan (18/18).

## Superficies (inventario a cerrar en el paso 1)

`README.md` raíz · README de `postcss-uxdsl`, `uxdsl-core`, `uxdsl-cli`,
`vite-plugin-uxdsl`, `uxdsl-webpack-loader`, `uxdsl-vscode` ·
`packages/postcss-uxdsl/docs/migration.md` · `AGENTS.md` · los 15 `.mdx` de
`playground-nextjs/src/app/docs/` más `docs/config/page.tsx` · los 11
`*Documentation`/`*AgentGuidance` de `src/components/` · `docs/architecture/` ·
los CHANGELOG · `docs/releases/`.

## Resultado esperado

1. Todo ejemplo UXDSL de esas superficies se compila en `npm test` con el
   compilador real, emparejado con su tema, y **falla si deriva**.
2. Ninguna afirmación verificable (un número, un "ya no", un "ahora") vive en
   prosa sin un test o un comando que la respalde, o sin fecha.
3. Cambiar el motor de forma visible no puede pasar sin tocar la documentación.

## Implementación

1. **Cerrar el inventario** de superficies con su dueño (quién debe actualizarla al
   cambiar qué). Registrar las que **no** se revisan y por qué.
2. **Arnés de ejemplos ejecutables.** Un script en `scripts/` que extrae los
   bloques de `.md`/`.mdx` y de los `.tsx` (`language-css`/`language-uxdsl`),
   **los empareja con el bloque de tema JSON que declaran** ("This excerpt
   assumes…" / el `<pre>` JSON anterior), y los compila con el plugin real y con
   `resolveTheme` — sin parser propio ni valores por defecto propios. Necesita:
   (a) un **marcador explícito** para errores intencionales (p. ej. un comentario
   `/* expect: UXD_… */`) que además **verifique el código** del error, para que un
   ejemplo de error no pase por fallar de otra manera; (b) una vía para los que
   requieren el pipeline del CLI (`@mixin`); (c) salida que nombre archivo y línea.
   Corre en `npm test`. **Control negativo obligatorio:** romper a mano un ejemplo
   y confirmar que falla.
3. **Arreglar lo real:** el `color(primary)` del README (definir el color en el
   ejemplo o mostrar uno que exista por defecto), y marcar los dos errores
   intencionales con el marcador del paso 2.
4. **Revisión línea a línea de cada superficie** contra el comportamiento real
   de beta.6 más lo que entregue esta feature. Buscar en particular las
   afirmaciones que envejecen: números ("156", "123", "tres hallazgos", "26/26"),
   "ya no"/"ahora"/"todavía", y estados de release. Cada una se convierte en (a) un
   test o un comando reproducible, o (b) una referencia con fecha.
5. **Cerrar el hueco del guard.** Evaluar ampliar `VISUAL_DEFAULT_FILES`
   (`scripts/verify-docs-update.js`) con `control-engine.ts` y los demás motores
   que pueden cambiar la salida por defecto, con la misma exigencia de
   `Visual changes`. Cierra el límite (5) de MIG-B7-01. Decidir con un test que
   demuestre qué archivos cambian salida visible, no por intuición.
6. **`AGENTS.md`**: mantener el listado "Review these documentation sources"
   sincronizado con los archivos reales (hoy coincide, ver punto 5 del estado) y,
   si el arnés lo permite, verificarlo con un test en vez de a ojo.

## Lo que realmente pasó (durante la implementación, 2026-09-23)

1. **La primera pasada del arnés no encontraba ningún excerpt de tema (0 de 25).**
   `KNOWN_THEME_FAMILIES` es un `Set` y lo traté como un array; el `.includes`
   lanzaba un `TypeError` que mi propio `try/catch` se tragaba, así que todo excerpt
   parecía "no es un tema" y los ejemplos que dependían de uno fallaban sin causa
   real. Se quitó el `try/catch` que ocultaba el error (ahora sólo protege el
   `JSON.parse`). Es exactamente la clase de fallo que MIG-B6-12 descubrió en su
   gate (un `await` que faltaba): un chequeo que no puede fallar por la razón
   correcta también es decoración.
2. **El emparejamiento con el excerpt resolvió 4 de los 12 fallos de la medición
   previa**, y sacó a la luz los que sí eran reales. Con el arnés funcionando, los
   ejemplos que fallan son exactamente los defectos de documentación, no ruido.
3. **Defectos reales encontrados y corregidos** — todos en superficies que ya
   estaban mal *antes* de este trabajo:
   - `AGENTS.md`, sección Colors and Palette: el excerpt enseñaba
     `var(--ds__color__blue-700)` y `var(--ds__color__white)`, con el prefijo
     `--ds__` que la propia guía de migración lista como el nombre **antiguo**.
     Es el mismo tipo de "trampa" que un consumidor externo reportó en su copia de
     la guía; estaba también en la nuestra. (Corregido: `--uxdsl__color__…`.)
   - `AGENTS.md`, sección Typography: `"fontFamily": "var(--font-ui)"`, una variable
     que no existe; el tema base usa `var(--uxdsl__font__ui)`. (Corregido.)
   - `packages/postcss-uxdsl/README.md`: `color(primary)` con la salida
     `var(--uxdsl__color__primary)`, que no compila con el tema por defecto
     (`gray` es la única colección de colores que trae). (Corregido; el bloque
     ahora también documenta el error real, `UXD_REFERENCE_MISSING`, y el arnés lo
     verifica.)
4. **El guard, decisión distinta de la que preveía la ficha.** La ficha pedía
   evaluar ampliar `VISUAL_DEFAULT_FILES`. Se consideró invertir la regla (todo lo de
   `src/` es visual salvo lo declarado) y se descartó: cambiaría la política para
   todos los contribuyentes y rompe un test existente que codifica que un cambio
   "ordinario" sólo pide README. Se hizo lo que pedía la ficha (ampliar con los
   motores) **más** un test de completitud: todo archivo bajo `src/` está en la lista
   visual o en una lista no visual **con motivo**, así que un motor nuevo no puede
   quedar sin decidir. Esto sí cambia el comportamiento del hook: tocar un motor
   ahora exige tener el CHANGELOG en el commit.
5. **La clasificación es un juicio, no una medición.** Se leyó el código de cada
   archivo; no se probó mutando cada uno. Una búsqueda por texto de "quién emite
   CSS" se descartó como evidencia por demasiado tosca.

## Fuera de alcance

- Reescribir la prosa por estilo, traducir, o rediseñar la estructura de la
  documentación. Sólo se corrige lo incorrecto, lo desactualizado y lo sin prueba.
- Documentación de consumidor nueva (editor support: MIG-B7-12; actualizar:
  MIG-B7-15). Esta ficha **verifica** que compile y esté al día, no la escribe.
- El playground como aplicación (MIG-B7-17); aquí sólo sus ejemplos de texto, vía
  el arnés.

## Pruebas

- El arnés mismo: extrae, empareja, compila, distingue error intencional de
  error real, y falla con nombre de archivo y línea.
- Control negativo del paso 2; control válido (un ejemplo correcto pasa).
- Un test por cada afirmación verificable convertida en el paso 4.

## Documentación

Esta ficha **es** documentación; deja registrado en `AGENTS.md` ("Maintaining this
guide") que los ejemplos se ejecutan en `npm test` y cómo marcar un error
intencional. CHANGELOG sólo si el guard cambia lo que exige a los contribuyentes.

## Criterios de aceptación

- [x] Todo ejemplo UXDSL de las superficies del inventario compila en `npm test`,
      o está marcado como error intencional con su código verificado. (45
      ejemplos y 29 excerpts de tema, en 14 archivos de 110 superficies.)
- [x] El ejemplo de `color(primary)` deja de presentar como salida real algo que
      no compila por defecto.
- [x] Romper un ejemplo hace fallar el test (control negativo registrado: con las
      tres correcciones de documentación revertidas, el test falla con los 5
      problemas originales).
- [x] Las afirmaciones numéricas/de estado de las superficies de consumidor
      tienen test, comando o fecha (paso 4, 2026-09-28, ver "Paso 4" abajo):
      `README.md` raíz, `AGENTS.md` (y su copia generada), los seis README de
      paquete y `docs/migration.md`, revisados línea a línea contra el código; el
      CHANGELOG sólo contra contradicciones. **Fuera de este paso, decidido por el
      dueño:** las páginas MDX y componentes del playground (los revisa él tras
      MIG-B7-17), `docs/architecture/`, `docs/releases/` y las demás fichas. La
      cifra total de contraste (123) tiene comando reproducible y fecha, **no
      test** — lo fijará MIG-B7-11.
- [x] La decisión sobre ampliar `VISUAL_DEFAULT_FILES` queda registrada con su
      evidencia: ampliada, más un test de completitud (punto 4 de arriba).

## Verificación

```bash
npm test
npm run verify:docs
node scripts/generate-language-artifacts.js --check
```

## Entrega

`docs(FEAT-009): MIG-B7-16 - executable documentation examples and full docs review`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente;
paso 4 con PR pendiente de mergear.** Arnés, correcciones y guard (pasos 1–3, 5,
6) integrados en `main` (PR #10). Paso 4 (revisión línea a línea, 2026-09-28) en
`feat/mig-b7-16-prose-review`, apilada sobre `feat/mig-b7-15-upgrade-flow`; ver
"Paso 4" al final.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `bdcc997` (rama sobre `main` `c09be61`). Entrega: `ecdf995` en `feat/mig-b7-16-executable-docs`. PR: pendiente de mergear; el SHA se fijó en un commit posterior, mismo patrón que MIG-B6-21 |
| Reproducción antes del cambio | Medición del 2026-09-23 (ver "Estado verificado"): 19 bloques en README/`AGENTS.md`, 21 en el playground; sin ningún test que los compile |
| Criterio → regresión | `scripts/doc-examples.test.js` (13 tests: extractor de markdown y JSX, ejemplo válido/inválido, emparejado con excerpt y su control sin excerpt, error documentado exacto / código equivocado / no falla, resto de sentencias, salida reclamada, y los tres de superficies reales: ejemplos, excerpts válidos, lista de alineación de `AGENTS.md`). Guard → `scripts/verify-docs-update.test.js` (+6: completitud de la clasificación, sin entradas muertas, motivo obligatorio, motores cubiertos, motor exige CHANGELOG, archivo no visual sigue pidiendo sólo README) |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0. `node scripts/verify-doc-examples.js` → 45 ejemplos, 29 excerpts, 110 archivos, sin problemas. `node --test scripts/doc-examples.test.js` → 13/13. `node --test scripts/verify-docs-update.test.js` → 14/14. `npm test` (raíz) → exit 0, **719 ok / 0 not ok** (700 + 13 + 6) |
| Resultado después / control negativo | Antes de las correcciones el arnés reportaba 5 problemas: los dos excerpts de `AGENTS.md` y tres ejemplos. Control negativo: revertir sólo `AGENTS.md` y el README (`git stash`) hace fallar los tests 11 y 12 con esos 5 problemas; restaurados, 13/13. Además, cada uno de los casos de fallo del arnés tiene su test (token desconocido, sin excerpt, código de error equivocado, error documentado que compila, salida reclamada que no aparece) |
| Cambios visuales o API / migración | Sin cambio visual. **Cambia el hook de pre-commit**: tocar cualquiera de los 14 motores/archivos de defaults recién cubiertos exige el CHANGELOG en el commit. `package.json` raíz: `npm test` ejecuta el test nuevo y hay un `verify:doc-examples` |
| README / CHANGELOG / migration | `README.md` raíz (sección de beta.6: publicada, no "prepared"); `packages/postcss-uxdsl/README.md` (bloque de `color()`); `packages/postcss-uxdsl/CHANGELOG.md` (rótulo de beta.6 con su fecha). `docs/migration.md`: sin cambios |
| AGENTS / guías / arquitectura | `AGENTS.md`: los dos excerpts corregidos; párrafos de estado de beta.6 actualizados (publicada, gate automatizado pasó, validación externa pendiente); nueva sección sobre cómo se ejecutan los ejemplos y cómo marcar un error intencional; cifra de contraste fechada |
| Límites y seguimiento | (1) **Revisión línea a línea:** hecha en el paso 4 (2026-09-28, ver abajo) para los README, `AGENTS.md` y la guía de migración; MDX, componentes del playground y arquitectura quedan fuera por decisión del dueño. (2) **Alcance de la extracción de ejemplos del playground:** `language-css`/`uxdsl`/`json` como plantilla, constante `{name}` y `JSON.stringify` de un literal, y `CodeBlock`; **no** los `<pre>{…}</pre>` sin clase de lenguaje (6) ni los que se generan en runtime (`{usage}` calculado, `buttonComponentCss(...)`) — estos últimos ya son salida del compilador. (3) Los ejemplos de tipo pipeline (`@mixin`) sólo verifican que compilan, y en el README del CLI el `@mixin` no se incluye, así que su cuerpo no se ejercita. (4) **La clasificación visual/no visual del guard es un juicio, no una medición.** (5) El guard sólo protege lo que se commitea con el hook; nada obliga a que el CHANGELOG diga algo *correcto* (pide que esté en el commit, no su contenido). (6) La cifra de contraste de `AGENTS.md` sigue sin test |

### Paso 4 — revisión línea a línea (2026-09-28)

Rama `feat/mig-b7-16-prose-review` (base `origin/feat/mig-b7-15-upgrade-flow`
`d8c185e`, que apila MIG-B7-12 y MIG-B7-15 sobre `main` `dcd8a26`); SHA fijado al
mergear. Es una revisión de exactitud, no de estilo: no se reestructuró ni se
cambió alcance o voz. Cada afirmación se comprobó leyendo el código o
ejecutándolo: el plugin sobre `dist/` recién compilado, el CLI en directorios
temporales, los tarballs publicados de 0.4.0, beta.1, beta.5 y beta.6 vía
`npm pack`, `npm view … dist-tags` y el historial de git.

**Criterio para lo que envejece:**

- Un número o estado pasa a tener (a) un comando reproducible o un test citado,
  o (b) una fecha ("as of 2026-09-28").
- Un "now", "ya no" o "yet" que sólo marca un cambio pasado se reemplaza por la
  versión en que ocurrió (`since 0.5.0-beta.6`), comprobada contra el commit y el
  orden de releases.
- Lo de `0.5.0-beta.7` se rotula "unreleased as of 2026-09-28".
- La cifra de contraste es la misma en todas las superficies: **123 pares con
  `theme/base.contrast-exceptions.json`** (el que usa `uxdsl theme --contrast`),
  **124 sin él**. Antes de MIG-B7-01 eran 156 y 157. Ambos pares se midieron
  compilando el commit anterior y el propio `88828d5`.

| Superficie | Errores de hecho corregidos | Afirmaciones que envejecen | Ejemplos |
| --- | --- | --- | --- |
| `AGENTS.md` (+ `packages/postcss-uxdsl/docs/agent-guide.md` regenerado) | `var(--border-n)`, `var(--radius-n)` y `var(--shadow-key)` pasan a los nombres que se compilan de verdad (`--uxdsl__border__n`, `--uxdsl__radius__n`, `--uxdsl__shadow__key`). FEAT-002 "targets" → "moved … in beta.1". `responsiveEntries` y `resolveResponsiveValue` se exportan desde `postcss-uxdsl/language`, no desde `ds-runtime`. La advertencia de familia desconocida la emiten `validateAndNormalizeTheme` y el CLI; el plugin, no | Cifra de contraste fechada, con comando reproducible y la aclaración 123/124. MIG-B7-11 "will pin" → pendiente. Los 9 fallos de placeholder citan el test que los fija. MIG-B7-01, 12 y 14 y "la guía viaja en el paquete" quedan rotulados como beta.7 sin publicar: se comprobó que el tarball de beta.6 no trae `agent-guide.md` y que su `init` no escribe `@ts-check`. Validación externa de beta.6 fechada. "stories describe planned work" → no publicadas, aunque algunas ya estén en `main` | — |
| `README.md` raíz | Los defaults de breakpoints se definen en `theme/base.json`; `ds-runtime/breakpoints.ts` sólo los reexporta. `generate:language` genera más de lo listado (schema, grammar, CSS custom data). "Density-15 → space-17 se preserva" era falso: se reconcilió antes de beta.1. "buttons/inputs no unificados" era falso desde beta.1. Faltaba la regla del hook que exige el CHANGELOG | Dist-tags fechados (hoy apuntan a beta.6). "next release" → `0.5.0-beta.1`, verificado en los tarballs de 0.4.0 y beta.1. Extensión fuera de Marketplace y Open VSX, fechado, con MIG-B7-05. Contraste con 123/124 | — |
| `packages/postcss-uxdsl/README.md` | `init` no crea tema. `includeTheme: false` también suprime el `@import` de Google Fonts. El "Known caveat" de spacing parcial era falso: `resolveTheme` conserva 1–16 y `{ spacing: { 1: '4px' } }` compila. Códigos reales de argumentos repetidos o indefinidos (`UXD_SURFACE_ARGUMENT`, `UXD_SURFACE_REFERENCE`). El ejemplo de colisión era imposible; se reemplazó por uno real (`colors['gray-300']` → `UXD_FOUNDATION_NAME_COLLISION`), con los códigos `*_NAME_COLLISION` por familia. El tema base emite `--font-code` sin prefijo. `getToneFamilies` sí es público vía `postcss-uxdsl/language`. Los `DEFAULT_*` se leen de `base.json`. `fontsize` y `focusVisible` sí fallan al compilar. El informe de `--contrast` no incluye colores resueltos. Vite y Webpack sí soportan el tema asíncrono | Contraste fechado con 123/124. MIG-B7-01 y MIG-B7-14 rotulados beta.7. El coste de validación lleva máquina, fecha y `npm run bench:references`. Packs legacy sin retiro programado (fechado). Versiones para el alias de palette (beta.1), `exports` (beta.1), el discovery del plugin (beta.6) y `sources` de los mapas (beta.6); key paths de diagnóstico fechados | El snippet de `checkThemeContrast` usaba `resolveTheme` sin importarlo |
| `packages/uxdsl-cli/README.md` | "futuro adaptador Vite/Webpack" → ya usan `compile()` y el discovery. `init` también crea `postcss.config.js` en un proyecto Next.js que no lo tiene. Un override parcial conserva también `light`. El informe de `--contrast` no incluye colores resueltos. Ancla rota `#compile-input-config` → `#compileinput-config` | Versiones para `UXD_IMPORT_CYCLE`, las escrituras atómicas y el resumen de `--diff` (beta.6), y para la config tipada y el mensaje "unchanged" (beta.7). Límites de la extensión y de los key paths fechados. Contraste con 123 | Al JSON de `--diff` le faltaban las filas reales `light` y `contrast` |
| `packages/postcss-uxdsl/docs/migration.md` | La receta de MIG-B6-29 omitía variantes nuevas y el cambio de `colors.gray` (el gris de `border()`). El párrafo de tipografía decía que ningún rol trae `fontFamily` ni márgenes (el rol `default` los trae) y mandaba copiar `typography-defaults.ts`, que se borró en beta.6. "ocho emisores" listaba siete. `includeTheme: false` sin `theme` omitía el discovery de beta.6. Citaba un patrón que nunca se documentó. "Did you mean" sólo aparece cuando hay un flag cercano. Decía "tres casos" sobre cuatro puntos. Ancla rota. El informe de contraste no trae colores | Título "0.5.0-beta.2" → las betas de 0.5.0. "Adelanto beta.6 (sin publicar)" → publicada el 2026-09-23. beta.2 "preparada" → publicada el 2026-09-16. beta.7 marcada sin publicar. Contraste con 123. "hoy" fechado. "Verificación" apunta al arnés en vez de a "este checkout beta.2" | `palette(text-secondary)` ya no fallaba porque el base define `text.secondary`; pasa a `palette(brand-secondary)`. Se añadió la forma de uso del codemod `size-overrides` desde un proyecto consumidor |
| `packages/uxdsl-core/README.md` | `fileId` lee el archivo e **ignora `source`** (reproducido). Vite y Webpack ya usan `compile()`. `includeTheme` también controla los tokens `:root`. La nota "v0.1.9" corresponde a una versión que nunca se publicó. La nota "v0.3.0" era en realidad de beta.1: commit `ee645d8`, posterior a 0.4.0 y anterior a `133f4a8` | MIG-B6-28 rotulado beta.6 | — |
| `packages/vite-plugin-uxdsl/README.md` | El discovery busca en el `root` de Vite, no "junto a" él | Modo `'auto'` "used to" → hasta beta.5 | — |
| `packages/uxdsl-webpack-loader/README.md` | `rootContext` es la opción `context` de webpack (por defecto `process.cwd()`), no el directorio del config | MIG-B6-28 rotulado beta.6 | — |
| `packages/uxdsl-vscode/README.md` | Sólo resalta y completa los breakpoints por defecto, no los del tema del proyecto | Estado de publicación fechado y apuntando a MIG-B7-05. El completado del tema del proyecto → MIG-B7-13, bloqueada por D-11 | — |
| `packages/postcss-uxdsl/CHANGELOG.md` | Sin contradicciones con las demás superficies. No se reescribió historia; sólo se aclaró en la sección `unreleased` de beta.7 que "156 → 123" se cuenta con el archivo de excepciones (157 → 124 sin él) | — | — |

**Comprobado y sin cambios** (muestra):

- Existen los 11 archivos que `AGENTS.md` manda alinear.
- Coinciden con el código:
  - las listas de campos y estados de Typography, Surface, Button e Input;
  - los keywords de radius;
  - los roles y estados por defecto;
  - los códigos `UXD_*` citados y las opciones de `applyTheme`;
  - las claves de almacenamiento legacy.
- Salidas que coinciden al ejecutarlas:
  - la de "See it in 60 seconds";
  - la del codificador de Google Fonts;
  - los flags y mensajes del CLI;
  - el ratio 3.11:1 del ejemplo verde.
- El base tiene 14 familias de palette, 11 de ellas en modo oscuro.

**Hallazgos en el código (registrados, no corregidos):**

1. **Validación de tema: valores no-string aceptados en silencio.** Un tema con
   `palette.primary.main: 5` o `spacing: { "1": {} }` compila con exit 0, sin
   advertencia, y emite CSS inválido. Reproducción, en un directorio vacío
   (`$REPO` = raíz del monorepo):

   ```bash
   mkdir -p src
   printf '.a { color: palette(primary.main); padding: space(1); }\n' > src/a.uxdsl
   printf "module.exports = { entry: './src/a.uxdsl', outFile: './out.css' };\n" > uxdsl.config.cjs
   printf '{ "palette": { "primary": { "main": 5 } }, "spacing": { "1": {} } }\n' > uxdsl.theme.json
   node "$REPO/packages/uxdsl-cli/bin/uxdsl.js" build   # exit 0
   grep -o -- '--uxdsl__space__1:[^;]*;' out.css         # --uxdsl__space__1: [object Object];
   ```

   `out.css` contiene `--uxdsl__palette__primary-main: 5;` y
   `--uxdsl__space__1: [object Object];`.
2. **`{ modes: { dark: null } }` (o `modes: null`) elimina todo el CSS de modo
   oscuro**, porque `deepMergeTheme` asigna `null`. Contradice dos textos:
   `docs/migration.md` ("no existe un valor de override que quite
   `modes.dark`") y un comentario de `test/default-theme.test.js`. Falta decidir
   si `null` es una forma soportada de quitarlo o un hueco que debería
   rechazarse. La prosa no se cambió hasta esa decisión.
3. **Mensajes de código desactualizados:**
   - El error de `uxdsl theme --contrast` dice que el informe lista "resolved
     colors" (`packages/uxdsl-cli/bin/uxdsl.js`, ~l. 1390), pero
     `ContrastFailure` no los trae.
   - `src/config.ts` (~l. 171) todavía sugiere "a future bundler adapter" para
     un tema asíncrono, cuando Vite y Webpack ya lo soportan.
4. **`processUxdsl(source, { fileId })` ignora `source`** (lee el archivo). Ahora
   está documentado; queda anotado por si no es lo que un llamador espera.
5. `test/fixtures/reference-integrity-oracle.js` sigue en el repo, aunque la
   ficha de MIG-B6-25 pedía borrarlo al publicar beta.6. El README dice que
   existe, lo cual hoy es cierto.

**Fuera de alcance, anotado y sin tocar:**

- `docs/releases/0.5.0-beta.6.md` dice "not published" (se corrige en el PR #14).
- La fila de MIG-B7-14 del índice dice "PR pendiente", aunque `43c3e18` ya está
  en `main`.

**Recomendaciones editoriales (no hechas):**

1. `AGENTS.md` y el README raíz cargan mucha historia de release: las fases de
   MIG-B6-29, la sección "Beta.6 implementation planning" y el historial de
   beta.1 a beta.5. Podría vivir en las fichas y los release records, dejando
   sólo el contrato en la guía.
2. La URL de la documentación es inconsistente: `uxdsl.vercel.app` en los README,
   `uxdsl.io` en `AGENTS.md` y en el `$id` del schema. Ambas responden 200.
3. Los README describen `main` (beta.7) mientras `@beta` instala beta.6. Una
   línea "este README describe la versión X" ayudaría.
4. "See it in 60 seconds" invita a escribir en el entry que genera `init`, que
   está marcado "AUTO-GENERATED — DO NOT EDIT" y que `generate-entry`
   sobrescribe.
5. El anidamiento cronológico de `migration.md` y la numeración de secciones del
   README del CLI son irregulares.

**No verificado:**

- Comportamiento en navegador.
- `import type` desde `postcss-uxdsl` con `tsc`: sólo se leyó el `.d.ts`.
- Las cifras de registry de beta.5 frente a beta.6 del README del CLI.
- npm 10.8, pnpm 9.15 y Yarn 1.22.
- Los pasos de build del `.vsix`.
- Una sesión real de `watch`: se confió en `test/watch-mode.test.js`.
- La rotura de `postcss-advanced-variables` ^4/^5.

**Comandos (macOS 27.0, Darwin 27.0.0, Node v20.19.0), desde la raíz:**

- `npm run verify:doc-examples` → exit 0 (45 ejemplos, 29 excerpts, 110 archivos).
- `node scripts/generate-agent-guide.js` → exit 0; `--check` → exit 0.
- `node scripts/generate-language-artifacts.js --check` → exit 0.
- `npm test` → exit 0, **742 `# pass` / 0 `# fail`** (antes hay que `npm install` en `vite-plugin-uxdsl`, `uxdsl-webpack-loader` y `uxdsl-vscode` de un worktree nuevo: sin ello el primer intento terminó en exit 127, `tsc: command not found`; sus lockfiles no se commitean).
- `uxdsl theme --contrast` sin override → exit 1, con 123 pares, como se
  documenta.
