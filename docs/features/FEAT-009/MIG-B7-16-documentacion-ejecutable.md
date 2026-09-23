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

- [ ] Todo ejemplo UXDSL de las superficies del inventario compila en `npm test`,
      o está marcado como error intencional con su código verificado.
- [ ] El ejemplo de `color(primary)` deja de presentar como salida real algo que
      no compila por defecto.
- [ ] Romper un ejemplo hace fallar el test (control negativo registrado).
- [ ] Las afirmaciones numéricas/de estado de las superficies tienen test, comando
      o fecha.
- [ ] La decisión sobre ampliar `VISUAL_DEFAULT_FILES` queda registrada con su
      evidencia (hecha o descartada con motivo).

## Verificación

```bash
npm test
npm run verify:docs
node scripts/generate-language-artifacts.js --check
```

## Entrega

`docs(FEAT-009): MIG-B7-16 - executable documentation examples and full docs review`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Pendiente de implementación/verificación**.
Completar en el mismo PR conforme al
[protocolo de agentes](README.md#protocolo-de-implementación).

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | Hecha el 2026-09-23 (ver "Estado verificado"); repetir sobre el SHA base con el arnés ya escrito |
| Criterio → regresión | Pendiente |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente; sin cambio visual. Cambia lo que se exige al contribuir si se amplía el guard |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | Pendiente — `AGENTS.md` cambia en esta ficha |
| Límites y seguimiento | Pendiente — declarar las superficies no revisadas |
