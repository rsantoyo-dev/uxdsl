# MIG-B7-15 — Actualizar sin sorpresas: ver qué cambió en las familias que nunca declaraste

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P1 · S |
| Cierra | R-20 |
| Depende de | — (el paso 3 depende de la decisión D-12; los demás no) |
| Bloquea | MIG-B7-11 |
| Archivos | `packages/uxdsl-cli/README.md`, `packages/postcss-uxdsl/docs/migration.md`, `packages/uxdsl-cli/bin/uxdsl.js` (sólo el texto del mensaje, y el flag si D-12 = (b)), `AGENTS.md`, `scripts/` (sólo si se publica la guía dentro del paquete) |

## Por qué

Feedback de un consumidor real, pegado por el dueño el 2026-09-23. Tras
actualizar a beta.6 descubrió tarde que los defaults habían cambiado en familias
que **nunca había declarado** (`fonts.google`, `modes.dark`), y comprobó que ni
`theme --diff` ni `theme --strict` se lo habrían dicho. No es residuo de
FEAT-008; se verificó ese día contra los paquetes publicados.

## Estado verificado (2026-09-23, no asumido)

1. **`--diff` sólo lista familias declaradas — y así está documentado.** Con un
   override de una sola clave (`typography_details.h1.fontWeight`), `theme --diff`
   devolvió 78 filas, **todas** de `typography_details`; ninguna de `modes`,
   `fonts` ni `palette`. El README del CLI lo dice: *"`--diff` prints only the
   families your own config mentions"*. No es un defecto: es el alcance
   declarado.
2. **`--strict=modes` sale con 0 con `modes` 100 % heredado.** Igual: el README
   dice *"exits non-zero if any family you **declared** ended up partially
   filled"*. `modes` no se declaró, así que no hay nada parcial que reportar.
3. **El hueco real no es un bug sino una promesa a medias.** La tabla D-1 del
   release record de beta.6 presenta `theme --diff` como respuesta a "¿qué
   valores son míos y cuáles heredados?". Para las familias declaradas lo es;
   para las no declaradas, que es donde ocurrió la sorpresa, no dice nada.
4. **Ya existe una forma de ver el cambio completo, y funciona.** `uxdsl theme`
   sin flags imprime el tema **efectivo** completo. Con el mismo override en dos
   proyectos limpios, uno con beta.5 y otro con beta.6:

   | | beta.5 | beta.6 |
   | --- | --- | --- |
   | bytes de `uxdsl theme` | 8 438 | 13 159 |
   | familias de primer nivel | 4 (`spacing`, `palette`, `fonts`, `typography_details`) | 15 |

   Claves de hoja por familia, beta.6 respecto de beta.5:

   | Familia | añadidas | cambiadas | quitadas |
   | --- | --- | --- | --- |
   | `modes` | 33 | — | — |
   | `palette` | 43 | 5 | — |
   | `inputs` | 23 | — | — |
   | `surfaces` | 18 | — | — |
   | `buttons` | 14 | — | — |
   | `densities` | 16 | — | — |
   | `fonts` | 1 | 2 | 1 |
   | `typography_details` | 24 | 18 | 69 |

   (otras familias nuevas: `colors` 4, `breakpoints` 5, `borders` 5, `radii` 6,
   `shadows` 6, `typography` 1.) Es decir: **guardar la salida de `uxdsl theme`
   antes y después de actualizar y compararlas habría mostrado, por familia, todo
   lo que cambió sin que el proyecto lo tocara.**
5. **Límite de ese flujo:** compara el *tema*, no el CSS compilado. Un cambio de
   comportamiento del motor (como el orden del `@import` de
   [MIG-B7-14](MIG-B7-14-google-fonts-import-orden.md)) no aparece ahí; sólo el
   CHANGELOG puede avisarlo, por eso su sección `### Visual changes` importa.
6. **Ningún documento del repo le dice al consumidor que haga esto antes de
   actualizar.** La guía de migración no tiene un paso "antes de actualizar".
7. **Distinto de MIG-B7-08 (R-11).** Aquélla extiende el resumen de mezcla de
   stderr a `surfaces`/`buttons`/`inputs`; no toca las familias no declaradas.

### Otros puntos del mismo feedback, verificados

- **Parche local de beta.1 que ya sobra.** El consumidor tenía un
  `patches/uxdsl-cli+0.5.0-beta.1.patch` (patch-package) para reenviar
  `includeTheme`/`references` de la config al plugin; hoy falla al aplicarse.
  `patches/` y `patch-package` **no existen en este repositorio**: el parche vive
  en la app del consumidor. Verificado en el código publicado de beta.6 que
  `uxdsl-core` reenvía `config.includeTheme` y `config.references` al plugin, y
  funcionalmente: una config con `includeTheme: false` y
  `references.externalTokens: ['--host-token']` compiló sin `:root` y sin error.
  **`npm i` de beta.6 desde el registro funciona limpio** (38 paquetes, sin
  errores de instalación). Lo que sí falta: ningún documento avisa de que ese
  tipo de parche sobra tras actualizar.
- **Copia local de la guía de agentes desactualizada.** `AGENTS.md` ya dice que
  una copia local es una instantánea; es responsabilidad de quien la copia. El
  problema de fondo es que la guía **no viaja con el paquete**, así que toda copia
  envejece. (La "trampa conocida" de `border(n)` que ese consumidor citó no está
  en `AGENTS.md` de este repo; verificado además que hoy
  `--uxdsl__color__gray-300: #CBD5E1` sí se define en la salida de beta.6.)
- **`[uxdsl] unchanged` con el archivo cambiado: no reproducido.** Cuatro
  escenarios con el CLI publicado (sin cambios; cambio del tema; cambio de un
  `.uxdsl`; `uxdsl.css` editado a mano y reconstruido) dieron cada uno el mensaje
  correcto. `unchanged` significa que la **salida** es idéntica al archivo que ya
  hay en disco (`writeIfChanged` compara contenido) y por eso no se reescribió.
  Lo más probable es que otro proceso — un `watch` — ya lo hubiera reescrito, o
  que lo que cambió fue el tema y no la salida. No se abre como defecto; sólo se
  propone aclarar el texto (paso 5).

## Resultado esperado

Un consumidor que va a actualizar sabe, sin leer código: (1) guardar el tema
efectivo antes, (2) actualizar, (3) comparar, (4) leer las secciones
`Visual changes` del CHANGELOG, y (5) qué parches locales revisar.

## Implementación

1. **Documentar el flujo de actualización** en `packages/uxdsl-cli/README.md`
   (sección "Before you upgrade") y como primer paso de `docs/migration.md`:
   `uxdsl theme > effective.before.json` → actualizar → `uxdsl theme >
   effective.after.json` → `diff`. Incluir la tabla del punto 4 como evidencia de
   que sirve. Decir el límite del punto 5 con todas las letras.
2. **Hacer explícita la consecuencia** en los párrafos de `--diff` y `--strict`
   del README: no ven las familias que no declaraste; apuntar al flujo.
3. **D-12 (opcional).** — **D-12 = (a), decidida por el dueño 2026-09-28: no se
   implementa.** Sólo si el dueño elige (b): un modo de `theme --diff` que
   liste también las familias no declaradas. Ojo con lo que aporta: muestra lo
   heredado **hoy**, no lo que cambió **entre versiones**; para eso hace falta
   comparar dos salidas de todos modos.
4. **"Parches locales que ya no hacen falta"** en la guía de migración, con el
   ejemplo verificado (reenvío de `includeTheme`/`references`) y el
   procedimiento genérico: antes de actualizar, listar `patches/`; si
   `patch-package` falla después, comprobar contra la fuente publicada y borrar el
   parche. No prometer más de lo verificado.
5. **Aclarar el mensaje** `[uxdsl] unchanged <archivo>` para que diga qué
   significa (salida idéntica al archivo existente). Sólo texto.
6. **Guía de agentes versionada con el paquete.** Evaluar publicar la guía dentro
   de `postcss-uxdsl` (p. ej. `docs/agent-guide.md` en `files`) y que
   `AGENTS.md`, en "Using this guide in another project", recomiende apuntar a
   `node_modules/postcss-uxdsl/…` en lugar de copiar. Condiciones: la copia
   empaquetada se **genera** desde `AGENTS.md` con un `--check`, igual que
   `generate-language-artifacts.js` (nunca una segunda fuente de verdad), y cabe
   en el presupuesto de paquete (250 KB; hoy `postcss-uxdsl` pesa 146,4 KB).

## Fuera de alcance

- Un comparador de versiones integrado en el CLI.
- Cambiar qué familias analizan `--diff`/`--strict` por defecto: su alcance
  declarado no es un defecto.
- El orden del `@import` (MIG-B7-14).

## Pruebas

- La documentación no se prueba con prosa: **el flujo del paso 1 se ejecuta**
  desde tarballs reales de dos versiones y se registra la salida.
- Si D-12 = (b): tests del flag nuevo (todas las familias con su `source`; salida
  JSON pura por stdout, como el resto de `theme`).
- Si se publica la guía: el `--check` de igualdad con `AGENTS.md` y el
  presupuesto de `verify:pack-budget`.

## Documentación

- `packages/uxdsl-cli/README.md`, `packages/postcss-uxdsl/docs/migration.md`,
  `AGENTS.md` (sólo si cambia la recomendación del paso 6).
- CHANGELOG del CLI si cambia el texto del mensaje o se añade el flag.

## Criterios de aceptación

- [x] La guía de migración abre con "antes de actualizar" y el flujo funciona
      entre dos versiones publicadas, con evidencia registrada.
- [x] Los README de `--diff`/`--strict` dicen qué no ven.
- [x] La guía de migración lista los parches locales a revisar, con el ejemplo
      verificado.
- [x] El mensaje `unchanged` explica lo que significa.
- [x] D-12 respondida y, si es (b), implementada; si es (a), registrada. —
      **D-12 = (a), decidida por el dueño 2026-09-28.**
- [x] La decisión sobre publicar la guía dentro del paquete queda registrada
      (hecha o descartada con motivo). — **Hecha** (ver evaluación del paso 6).

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
npm run verify:docs
npm run verify:pack-budget
npm test
```

## Entrega

`docs(FEAT-009): MIG-B7-15 - upgrade-without-surprises workflow, stale-workaround note, clearer unchanged message`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente** en
`feat/mig-b7-15-upgrade-flow` (apilada sobre `feat/mig-b7-12-editor-support`).
Integración a `main` pendiente. Pasos 1, 2, 4, 5 y 6 hechos; **paso 3 no aplica:
D-12 = (a), decidida por el dueño 2026-09-28** — sólo documentación, sin flag
nuevo de CLI.

### Evaluación del paso 6 (guía de agentes dentro del paquete)

Las dos condiciones se cumplen, así que se implementó:

- **Generada, nunca segunda fuente:** `scripts/generate-agent-guide.js` escribe
  `packages/postcss-uxdsl/docs/agent-guide.md` = cabecera generada + `AGENTS.md`
  byte a byte; `--check` sale con 1 ante cualquier deriva y corre en `npm test`
  (igual que `generate-language-artifacts.js --check`). Copia literal, sin
  filtrar secciones: filtrar habría sido un segundo formato a mantener, y la guía
  ya pedía copiarla entera.
- **Presupuesto:** `npm run verify:pack-budget` → `postcss-uxdsl` **165,0 KB /
  250 KB** (149,2 KB sin la guía, con MIG-B7-12 incluida; +15,8 KB empaquetados).
- Sólo `docs/agent-guide.md` entra en `files`; `docs/migration.md` sigue siendo
  sólo del repositorio (el test lo comprueba). Sin entrada en `exports`: se lee
  por ruta, no se importa.
- `AGENTS.md` ("Using this guide in another project") recomienda ahora apuntar a
  `node_modules/postcss-uxdsl/docs/agent-guide.md`; la copia local queda como
  alternativa, con su advertencia de que envejece. "Maintaining this guide" dice
  cómo regenerarla.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base: `feat/mig-b7-12-editor-support` (sobre `main` `dcd8a26`). Entrega: rama `feat/mig-b7-15-upgrade-flow`, SHA fijado al mergear. PR: pendiente de mergear (base `feat/mig-b7-12-editor-support`) |
| Reproducción antes del cambio | Repetida el 2026-09-28. **Flujo del paso 1 desde el registro** (tarballs publicados, un solo proyecto limpio actualizado en sitio): `uxdsl-cli`+`postcss-uxdsl@0.5.0-beta.5`, tema `{ typography_details: { h1: { fontWeight: "800" } } }` → `uxdsl theme > effective.before.json` (8 438 bytes, 4 familias, stderr vacío); `npm install -D …@0.5.0-beta.6` → `effective.after.json` (13 159 bytes, 15 familias); `diff` exit 1, 566 líneas. Recuento por familia (añadidas/cambiadas/quitadas) idéntico a la tabla del "Estado verificado": `modes` 33/0/0, `palette` 43/5/0, `inputs` 23/0/0, `surfaces` 18/0/0, `buttons` 14/0/0, `densities` 16/0/0, `fonts` 1/2/1, `typography_details` 24/18/69, más `colors` 4, `breakpoints` 5, `borders` 5, `radii` 6, `shadows` 6, `typography` 1. **Sobre el SHA base** (CLI del checkout, mismo proyecto): `theme --diff` → 78 filas, todas `typography_details`; `theme --strict=modes` → exit 0; beta.6 publicada, también 78 filas. **Reenvío de `includeTheme`/`references`** (ejemplo del paso 4), con `uxdsl-cli@0.5.0-beta.6` del registro: `includeTheme: false` → 0 `:root`; tema con `palette.primary.main: "var(--host-token)"` y `.p { color: palette(primary.main); }` → sin `references` **falla** con `UXD_REFERENCE_MISSING` (exit 1), con `references.externalTokens: ['--host-token']` compila (exit 0). **Mensaje `unchanged`:** `[uxdsl] unchanged src/uxdsl.css`, sin explicación |
| Criterio → regresión | Flujo de actualización → ejecutado y registrado arriba (la story pide ejecutarlo, no testear prosa). Mensaje → `packages/uxdsl-cli/test/uxdsl-cli.test.js` "MIG-B7-15: a rebuild with identical output says what "unchanged" means…" (build real dos veces: `built` y luego el texto nuevo completo; control: salida editada a mano → `built`, sin `unchanged`) y la aserción añadida al test de watch "MIG-B6-23: a rebuild triggered by an unrelated watched file…". Guía empaquetada → `scripts/agent-guide.test.js` (3 tests: copia = cabecera + `AGENTS.md` byte a byte; `--check` falla con una copia editada, con una de otra versión de `AGENTS.md` y con el archivo ausente — control negativo; `npm pack --dry-run` de `postcss-uxdsl` contiene `docs/agent-guide.md` y ningún otro `docs/*`) + `node scripts/generate-agent-guide.js --check` en `npm test`. D-12 (a) → sin código, registrado aquí |
| Comandos y entorno | macOS (Darwin 27.0.0), Node v20.19.0, npm 10.8.2, registro público de npm (`0.5.0-beta.5` y `0.5.0-beta.6`). `node --test --test-name-pattern "MIG-B7-15\|MIG-B6-23" packages/uxdsl-cli/test/{uxdsl-cli,watch-mode}.test.js` → 18/18. `node --test scripts/agent-guide.test.js` → 3/3. `node scripts/generate-agent-guide.js --check` → exit 0. `npm run verify:pack-budget` → exit 0 (`postcss-uxdsl` 165,0 KB / 250 KB). `npm run verify:doc-examples` → exit 0. `node scripts/generate-language-artifacts.js --check` → exit 0. `npm test` (raíz) → ver fila siguiente |
| Resultado después / control negativo | `npm test` (raíz) → exit 0, **742 pass / 0 fail** en los tests `node --test` (738 tras MIG-B7-12 + 1 del mensaje + 3 de la guía), más fixtures y los dos `--check` en PASS. **Control negativo del mensaje:** con el texto anterior (`[uxdsl] unchanged ${rel}`), el test nuevo y la aserción de watch fallan (su regex exige el sufijo); el de `built` tras editar la salida es el control de que el cambio es sólo de texto. **Control negativo de la guía:** los tres casos de deriva de `agent-guide.test.js` |
| Cambios visuales o API / migración | Sin cambio visual. **Texto de CLI:** `[uxdsl] unchanged <archivo> (compiled output identical to the file on disk; not rewritten)`; cuándo se escribe o no, igual. Un script que compare la línea exacta necesita el sufijo (en `CHANGELOG`). **Paquete:** `postcss-uxdsl` gana `docs/agent-guide.md` en `files` (sin `exports`). Sin flag nuevo (D-12 = (a)) |
| README / CHANGELOG / migration | `packages/uxdsl-cli/README.md`: sección **"Before you upgrade"** (flujo, las dos tablas medidas, el límite "compara el tema, no el CSS" con el ejemplo de MIG-B7-14 y el puntero a `Visual changes`, parches locales, `UXDSL_DEBUG`); párrafos de `--diff` y `--strict` con lo que no ven (78 filas; `--strict=modes` exit 0) y enlace al flujo; explicación de `unchanged` junto a "Writes only what changed". `packages/postcss-uxdsl/docs/migration.md`: abre con **"Antes de actualizar (cualquier versión)"** y **"Parches locales que ya no hacen falta"** (procedimiento + ejemplo verificado del reenvío `includeTheme`/`references`). `packages/postcss-uxdsl/README.md`: "Guide for AI agents". `packages/postcss-uxdsl/CHANGELOG.md` `0.5.0-beta.7`: entrada MIG-B7-15 |
| AGENTS / guías / arquitectura | `AGENTS.md`: "Using this guide in another project" recomienda la copia empaquetada; "Maintaining this guide…" explica `npm run generate:agent-guide` y el `--check`. `packages/postcss-uxdsl/docs/agent-guide.md` regenerado (no editado a mano). Scripts nuevos en `package.json` raíz: `generate:agent-guide`; `npm test` añade `scripts/agent-guide.test.js` y el `--check` |
| Límites y seguimiento | (1) El flujo se ejecutó entre **beta.5 y beta.6** (las dos últimas publicadas); no entre beta.6 y beta.7, que no está publicada. (2) El flujo compara el tema; los cambios del compilador sólo los anuncia el CHANGELOG — dicho en ambos documentos. (3) La guía empaquetada llega a los consumidores **con la próxima publicación** (beta.7); hasta entonces el texto de `AGENTS.md` que la recomienda describe algo que ningún paquete publicado contiene todavía — por eso dice "Since `0.5.0-beta.7`". (4) Las rutas internas de la guía (`docs/features/…`, `packages/…`) son del repositorio, no del paquete; la cabecera generada lo dice. (5) Sólo se verificó el ejemplo de parche descrito en el feedback (reenvío de `includeTheme`/`references`); la guía no promete nada de otros parches. (6) `[uxdsl] unchanged` con el archivo cambiado sigue sin reproducirse; el cambio es sólo de texto, como pedía la story |
