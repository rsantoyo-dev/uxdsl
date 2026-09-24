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
- [ ] **Parcial, no cerrado:** las afirmaciones numéricas/de estado de las
      superficies tienen test, comando o fecha. Se buscaron por texto las de estado
      de release en los 9 documentos principales y se corrigieron las tres que
      estaban desactualizadas (README raíz, `AGENTS.md`, rótulo del CHANGELOG); la
      cifra de contraste de `AGENTS.md` ahora lleva fecha pero **no tiene test**
      (lo fijará MIG-B7-11). **No** se hizo una revisión línea a línea de la prosa de
      los README de paquete, la guía de migración, las páginas MDX ni la
      arquitectura.
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

Estado de esta revisión documental: **Implementada parcialmente y verificada
localmente** en `feat/mig-b7-16-executable-docs`: el arnés, sus correcciones y el
guard están hechos; la revisión línea a línea de la prosa **no** (ver criterio 4).
Integración a `main` pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `bdcc997` (rama sobre `main` `c09be61`). Entrega y PR: pendiente de commitear |
| Reproducción antes del cambio | Medición del 2026-09-23 (ver "Estado verificado"): 19 bloques en README/`AGENTS.md`, 21 en el playground; sin ningún test que los compile |
| Criterio → regresión | `scripts/doc-examples.test.js` (13 tests: extractor de markdown y JSX, ejemplo válido/inválido, emparejado con excerpt y su control sin excerpt, error documentado exacto / código equivocado / no falla, resto de sentencias, salida reclamada, y los tres de superficies reales: ejemplos, excerpts válidos, lista de alineación de `AGENTS.md`). Guard → `scripts/verify-docs-update.test.js` (+6: completitud de la clasificación, sin entradas muertas, motivo obligatorio, motores cubiertos, motor exige CHANGELOG, archivo no visual sigue pidiendo sólo README) |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0. `node scripts/verify-doc-examples.js` → 45 ejemplos, 29 excerpts, 110 archivos, sin problemas. `node --test scripts/doc-examples.test.js` → 13/13. `node --test scripts/verify-docs-update.test.js` → 14/14. `npm test` (raíz) → exit 0, **719 ok / 0 not ok** (700 + 13 + 6) |
| Resultado después / control negativo | Antes de las correcciones el arnés reportaba 5 problemas: los dos excerpts de `AGENTS.md` y tres ejemplos. Control negativo: revertir sólo `AGENTS.md` y el README (`git stash`) hace fallar los tests 11 y 12 con esos 5 problemas; restaurados, 13/13. Además, cada uno de los casos de fallo del arnés tiene su test (token desconocido, sin excerpt, código de error equivocado, error documentado que compila, salida reclamada que no aparece) |
| Cambios visuales o API / migración | Sin cambio visual. **Cambia el hook de pre-commit**: tocar cualquiera de los 14 motores/archivos de defaults recién cubiertos exige el CHANGELOG en el commit. `package.json` raíz: `npm test` ejecuta el test nuevo y hay un `verify:doc-examples` |
| README / CHANGELOG / migration | `README.md` raíz (sección de beta.6: publicada, no "prepared"); `packages/postcss-uxdsl/README.md` (bloque de `color()`); `packages/postcss-uxdsl/CHANGELOG.md` (rótulo de beta.6 con su fecha). `docs/migration.md`: sin cambios |
| AGENTS / guías / arquitectura | `AGENTS.md`: los dos excerpts corregidos; párrafos de estado de beta.6 actualizados (publicada, gate automatizado pasó, validación externa pendiente); nueva sección sobre cómo se ejecutan los ejemplos y cómo marcar un error intencional; cifra de contraste fechada |
| Límites y seguimiento | (1) **Revisión línea a línea no hecha** (criterio 4): prosa de los README de paquete, guía de migración, MDX y arquitectura. (2) **Alcance de la extracción de ejemplos del playground:** `language-css`/`uxdsl`/`json` como plantilla, constante `{name}` y `JSON.stringify` de un literal, y `CodeBlock`; **no** los `<pre>{…}</pre>` sin clase de lenguaje (6) ni los que se generan en runtime (`{usage}` calculado, `buttonComponentCss(...)`) — estos últimos ya son salida del compilador. (3) Los ejemplos de tipo pipeline (`@mixin`) sólo verifican que compilan, y en el README del CLI el `@mixin` no se incluye, así que su cuerpo no se ejercita. (4) **La clasificación visual/no visual del guard es un juicio, no una medición.** (5) El guard sólo protege lo que se commitea con el hook; nada obliga a que el CHANGELOG diga algo *correcto* (pide que esté en el commit, no su contenido). (6) La cifra de contraste de `AGENTS.md` sigue sin test |
