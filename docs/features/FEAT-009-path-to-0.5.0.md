# FEAT-009 — Camino a UXDSL 0.5.0-rc.1, con 0.5.0-beta.7 como primer corte

| Campo | Valor |
| --- | --- |
| Estado | Plan nuevo, escrito el 2026-09-22 sobre el estado real de `feat/feat-008-beta6-plan` (HEAD `29fb2fb`) tras cerrar las 21 fichas de FEAT-008. No implementa ninguna story; sólo las define |
| Objetivo | Cerrar el residuo que FEAT-008 dejó explícitamente documentado (no descubierto de nuevo aquí) para que `0.5.0-beta.6` pueda congelarse en `0.5.0-rc.1` sin deuda oculta |
| Versión objetivo | `0.5.0-rc.1` para los cinco paquetes npm coordinados, según la propia "Ruta recomendada a 0.5.0" de [FEAT-008](FEAT-008-beta6-reliability.md#ruta-recomendada-a-050). **Actualización 2026-09-23:** el plan original (2026-09-22) apuntaba sólo a `rc.1` y decía expresamente que no introducía una "beta.7". El dueño pidió después un release intermedio, `0.5.0-beta.7`, que incluya además la revisión de toda la documentación y del playground. Este documento lo trata así: **`beta.7` es el primer corte** (ver "Alcance por release") y `rc.1` sigue siendo el destino de lo demás. `scripts/release.js` acepta ambos nombres (`isValidSemver` admite `-beta.N` y `-rc.N`). Los IDs `MIG-B7-*` ya nombraban "beta.7" desde el inicio |
| Relación con FEAT-008 | No la reemplaza ni la reabre. FEAT-008 cerró sus 21 stories; cada una documentó, en su propio registro de evidencia, límites y hallazgos que quedaban fuera de su alcance. R-01 a R-16 son exclusivamente la lista de esos residuos, con su fuente citada — cero hallazgos nuevos, cero alcance inventado. **Excepción declarada:** R-17, R-19, R-20, R-21 y R-22 nacen de peticiones y de feedback externo del 2026-09-23, verificados ese día (ver "Ampliaciones posteriores"); R-18 sí es residuo de FEAT-008 |
| Prioridad | P0: las tres brechas de contraste (bloquean el criterio de aceptación abierto de MIG-B6-29), CI real (bloquea los dos criterios abiertos de MIG-B6-26) y **el orden del `@import` de Google Fonts (MIG-B7-14), un defecto de beta.6 ya publicada** que hace que el navegador ignore la fuente sin avisar. P1: sourcemaps de Vite, publicación de la extensión. P2: higiene de paquetes ronda 2, extensión del resumen de `theme --diff`, limpieza del playground, decisión sobre el comparador muerto de MIG-B6-25 |
| Depende de | El merge de [PR #4](https://github.com/rsantoyo-dev/uxdsl/pull/4) (las 8 stories de FEAT-008 que faltaban en `main`) |
| Origen | Cierre de evidencia de FEAT-008: cada fila R-01 a R-16 y R-18 cita el campo exacto de la ficha que la originó. **Excepción, declarada el 2026-09-23:** R-17, R-19, R-20, R-21 y R-22 vienen de peticiones del dueño y de feedback externo de un consumidor real de beta.6, y cada una está medida o reproducida (contra los paquetes publicados o el repositorio) antes de entrar (ver "Ampliaciones posteriores", que registra también qué afirmaciones del feedback se descartaron y por qué) |
| Publicación | Fuera de la implementación automática, igual que en FEAT-008. Ningún agente ejecuta `npm publish`, cambia dist-tags ni publica la extensión |

---

## Resumen ejecutivo

FEAT-008 no dejó nada "roto y sin saberlo" — su propio protocolo de evidencia
exigía registrar cada límite conocido en el momento de cerrar cada story, y así
se hizo en las 21 fichas. Esta feature es la conversión de esos límites, uno por
uno, en trabajo planeado. No hay hallazgos nuevos que reproducir: la
"Reproducción" de cada story de aquí es, literalmente, releer el campo exacto
de la ficha de FEAT-008 que la documentó.

Tres de los diez ítems (contraste) necesitan una **decisión del dueño** antes de
implementarse, de la misma forma que D-1/D-2 en FEAT-008 fueron decisiones del
dueño antes de que existieran MIG-B6-16/17. Esta ficha no inventa esas
respuestas.

## Estado heredado de FEAT-008 (2026-09-22)

| ID | Hallazgo | Fuente exacta | Story aquí |
| --- | --- | --- | --- |
| R-01 | `inputs.*.base.placeholder` nunca recibe sustitución por tone (a diferencia de `bg`/`color`/`border`); falla sobre fondos tonalizados saturados | MIG-B6-29, "Límites y seguimiento" fase 3, hallazgo (a) | MIG-B7-01 |
| R-02 | `light`/`dark`/`surface` son familias de identidad de fondo usadas como `tone=` de texto/borde en `outlined`/`flat`/`underline`; sólo un caso literal (`light` como texto) tiene excepción | MIG-B6-29, "Límites y seguimiento" fase 3, hallazgo (b) | MIG-B7-02 |
| R-03 | `warning.main` (sólo modo claro) no es suficientemente oscuro/saturado para texto/borde directo vía tone sin perder su identidad de acento | MIG-B6-29, "Límites y seguimiento" fase 3, hallazgo (c) | MIG-B7-03 |
| R-04 | CI real (jobs, matriz de Node/bundlers) nunca se añadió; los comandos existen pero nada los ejecuta automáticamente | MIG-B6-12, "Límites y seguimiento" (5) | MIG-B7-04 |
| R-05 | Gramática de VS Code y empaquetado del VSIX sin CI que los pruebe (criterios de aceptación sin marcar) | MIG-B6-26, criterios de aceptación 1 y 3 | MIG-B7-04 |
| R-06 | Extensión `uxdsl-vscode@0.1.0` sigue sin publicar en Marketplace/Open VSX | MIG-B6-26, criterio de aceptación 4 (declarado, no resuelto); MIG-B6-12 lo lista como `external` | MIG-B7-05 |
| R-07 | El plugin de Vite entrega un mapa correcto, pero Vite no lo encadena hasta el asset emitido; soporte no anunciado | `packages/vite-plugin-uxdsl/README.md`, sección "Source maps" | MIG-B7-06 |
| R-08 | No existe `LICENSE` en el repo; los 5 README de paquete enlazan a uno que no existe | MIG-B6-28, "Límites y seguimiento" (7) | MIG-B7-07 |
| R-09 | `vite-plugin-uxdsl/README.md` tiene el mismo patrón de imagen relativa que se corrigió en `postcss-uxdsl` | MIG-B6-28, "Límites y seguimiento" (5) | MIG-B7-07 |
| R-10 | `postcss-advanced-variables` sigue en `^3`; `^4`/`^5` rompen la expansión de parámetros `$var` de `@mixin` usados como argumento de directiva (reproducción exacta ya documentada) | MIG-B6-28, README del CLI sección 9, y re-verificación 2026-09-22 | MIG-B7-07 (seguimiento, no fix) |
| R-11 | El resumen de mezcla de `theme --diff` cubre `palette`/`typography_details`; `surfaces`/`buttons`/`inputs` tienen la misma forma un nivel más abajo | MIG-B6-16, "Límites y seguimiento" (1) | MIG-B7-08 |
| R-12 | Dos archivos muertos en el playground (`src/components/ThemeProvider.tsx`, `src/app/InlineStyles.tsx`); ninguno importado | MIG-B6-30, "Límites y seguimiento" (6) | MIG-B7-09 |
| R-13 | `packages/playground-nextjs/scripts/audit-themes.mjs` tiene un `SyntaxError` preexistente (`Unexpected token 'const'`), sin relación con FEAT-008 | MIG-B6-29, "Límites y seguimiento" fase 1, (8) | MIG-B7-09 |
| R-14 | El playground no tiene arnés de tests de componente; `ThemeContext.tsx` no tiene tests unitarios propios | MIG-B6-30, "Límites y seguimiento" (2) | MIG-B7-09 |
| R-15 | `BreakpointsProvider` sigue en el adaptador legacy de breakpoints (reescribe media queries por texto) — es justo la capacidad que `applyTheme` rechaza a propósito | MIG-B6-30, "Límites y seguimiento" (4) | MIG-B7-09 |
| R-16 | El término `!important` del comparador de `resolve()` en `reference-integrity.ts` es código muerto demostrable, dejado así a propósito porque arreglarlo cambiaría semántica | MIG-B6-25, "Límites y seguimiento" (4) | MIG-B7-10 |
| R-17 | Un consumidor no tiene camino documentado ni scaffolded a colores/autocompletado: `uxdsl init` no escribe nada de editor support, y ni el README del CLI ni el de `postcss-uxdsl` dicen cómo obtener la extensión | **No es residuo de FEAT-008.** Petición del dueño, 2026-09-23, más verificación directa ese día (bloque `init` de `uxdsl.js`; lectura de los README) | MIG-B7-12 |
| R-18 | El completado de roles/tones/tamaños usa el tema por defecto del compilador, no el del proyecto | MIG-B6-26, "Límites y seguimiento" (6) y "Fuera de alcance"; FEAT-008, tabla de stories diferidas (MIG-B6-08) | MIG-B7-13 (**bloqueada por D-11**) |
| R-19 | El `@import` de Google Fonts queda **después** de un bloque `:root` en la salida del CLI de beta.6, y el navegador lo ignora (Chrome real, comprobado). Sólo `generateThemeCss` lo deja primero | **No es residuo de FEAT-008.** Feedback de un consumidor real en beta.6, 2026-09-23, reproducido ese día contra los paquetes publicados | MIG-B7-14 (P0) |
| R-20 | `theme --diff` y `theme --strict` sólo ven las familias que el proyecto declara; tras una actualización, el consumidor no tiene un flujo documentado para ver qué cambió en las que no declaró | **No es residuo de FEAT-008.** Mismo feedback, 2026-09-23; el alcance de ambos flags está documentado así en el README del CLI | MIG-B7-15 |
| R-21 | Ningún ejemplo de documentación se compila: los de README/`AGENTS.md` son Markdown y los del playground son cadenas en JSX (69 `<pre>`). Medido: 11 de 19 bloques compilan tal cual; entre los que no, hay 1 defecto real (`color(primary)` en el README de `postcss-uxdsl`). La deriva ya ocurrió (cifra de contraste, `AGENTS.md`) y `verify:docs` no la detecta | **No es residuo de FEAT-008.** Petición del dueño, 2026-09-23 (revisar toda la documentación); medición ese día con el compilador actual | MIG-B7-16 |
| R-22 | El playground no demuestra varias capacidades de beta.6 (0 archivos mencionan el gate de contraste, `theme --diff`, source maps, `includeTheme`, códigos `UXD_*`, `--strict`, integridad de referencias) y su propio código evade tokens en varios lugares (21 `@media` a mano, 21 hex, 5 `.module.css`, 177 estilos en línea). Es aplicación no conducida en navegador real | **No es residuo de FEAT-008 salvo lo último**, que es el límite 6 de `docs/releases/0.5.0-beta.6.md`. Petición del dueño, 2026-09-23; cifras medidas ese día | MIG-B7-17 (depende de MIG-B7-09 y MIG-B7-16) |

No listado aquí porque **no** es un residuo abierto: el aviso de `theme-manifest.json`
sobre `default-motion.css` (UX-21 original) — verificado el 2026-09-22, el
manifiesto no referencia ningún archivo inexistente; `theme-manifest-files.test.js`
pasa 3/3. Tampoco `TYPOGRAPHY_DEFAULTS`/`typography-defaults.ts` (eliminados por
MIG-B6-17), ni `route.ts` del playground (verificado sin relación con el tema
base), ni el bug de congelación de `base-theme.ts` (corregido y con test de
regresión dentro de la propia MIG-B6-29).

---

## Decisiones pendientes del dueño

Igual que D-1/D-2 en FEAT-008, estas preguntas necesitan respuesta antes
de implementar sus stories. No se responden aquí.

| ID | Pregunta | Opciones documentadas por MIG-B6-29 |
| --- | --- | --- |
| D-8 | ¿`light`, `dark` y `surface` deben seguir siendo válidas como `tone=` para roles que muestran texto/borde (`outlined`/`flat`/`underline`)? | (a) Excepcionar el patrón completo por familia, revisado por el dueño. (b) Reconsiderar si esas tres familias deberían ser opciones válidas de `tone=` para esos roles en absoluto — en cuyo caso el motor de control las rechazaría en vez de excepcionarlas |
| D-9 | ¿Qué hacer con `warning.main` en modo claro? | (a) Excepción revisada por el dueño (como ya existe para `light`). (b) Re-elección deliberada de `warning.main` fuera de las reglas de "cambio mínimo" que gobernaron la fase 3 de MIG-B6-29 — el dueño decide el nuevo valor, no un algoritmo |
| D-10 | ¿Vale la pena mover `!important` en el comparador de `resolve()`, sabiendo que cambia qué definición gana cuando una declaración `!important` precede a otra normal? | (a) Dejarlo como está (código muerto documentado, comportamiento actual fijado por test). (b) Corregirlo como cambio semántico consciente, con su propia migration guide |
| D-11 | ¿El completado y hover **según el tema del proyecto** (MIG-B6-08, MVP acotado) entra en este release o sigue diferido a después de `0.5.0`, como decidió FEAT-008? | (a) Entra: MIG-B7-13 se completa y se implementa; tamaño L, amplía el release y arrastra la decisión de cómo leer un tema `.cjs` sin ejecutar código no confiable en el extension host. (b) Sigue diferido: el release record declara el límite y [MIG-B7-12](FEAT-009/MIG-B7-12-editor-support-consumidores.md) se asegura de que el consumidor lo sepa (ya está en su alcance). MIG-B7-12 entrega la línea base en ambos casos |
| D-12 | ¿`uxdsl theme --diff` gana un modo que liste también las familias que el proyecto nunca declaró? | (a) No: basta documentar el flujo de snapshot (`uxdsl theme` antes y después de actualizar, y `diff`), que ya funciona; cero superficie nueva de CLI. (b) Sí: flag nuevo (contrato de CLI y de salida JSON a mantener). Ojo: (b) muestra lo heredado **hoy**, no lo que cambió **entre versiones**; para eso hay que comparar dos salidas igualmente. Sólo el paso 3 de [MIG-B7-15](FEAT-009/MIG-B7-15-actualizar-sin-sorpresas.md) depende de esta respuesta |

MIG-B7-02 y MIG-B7-03 quedan en estado **Bloqueada — esperando D-8/D-9** hasta
que el dueño responda, y MIG-B7-13 en **Bloqueada — esperando D-11**.
MIG-B7-01 (placeholder) no depende de ninguna decisión: es un fix de motor
puro, la misma sustitución por tone que `bg`/`color`/`border` ya reciben.

---

## Ampliaciones posteriores al plan original

Este plan se escribió el 2026-09-22 y su regla era "cero hallazgos nuevos". El
2026-09-23, después de publicar `0.5.0-beta.6`, entraron tres cosas:

1. El dueño preguntó cómo lograr autocompletado y colores en código para una app
   que usa UXDSL, y pidió que eso quede en el documento del siguiente release.
2. El dueño pegó feedback de un consumidor real de beta.6 (calidad, detección de
   errores, autocompletado, highlight, instalación, packaging, bugs).
3. El dueño pidió que **este release** revise toda la documentación y el
   playground, para que UXDSL sea el mejor implementador de sí mismo y sus
   ejemplos sean pruebas vivas de todas sus capacidades, "revisando todos los
   componentes". Se **midió primero** (compilando los ejemplos de documentación
   con el compilador real, contando literales y evasiones de token en los 45
   `.uxdsl` y cruzando las capacidades de beta.6 con lo que el playground
   demuestra), y de ahí salieron R-21 y R-22. Dos hallazgos propios de esa
   medición: una frase de `AGENTS.md` que la entrega de MIG-B7-01 dejó falsa
   (corregida) y cifras de dogfooding que se inflaban al contar código
   comentado (descartadas; las de la ficha son sin comentarios).

**Ese feedback no se incorporó tal cual: se verificó afirmación por afirmación
contra los paquetes publicados** (proyectos limpios con `npm i` desde el
registro, Chrome real donde hacía falta). El resultado, para que quede
registrado qué se aceptó y qué no:

| Afirmación del feedback | Veredicto verificado | Dónde queda |
| --- | --- | --- |
| `@import` de Google Fonts mal ubicado | **Confirmado, defecto real de beta.6.** Línea 2 tras un `:root`; Chrome lo ignora | R-19 → MIG-B7-14 (P0) |
| `--diff`/`--strict` no ven familias no declaradas | **Confirmado, pero por diseño y documentado.** El hueco real es de flujo: `uxdsl theme` antes/después ya lo cubre y funciona | R-20 → MIG-B7-15; D-12 |
| `uxdsl build` dice `unchanged` con el archivo cambiado | **No reproducido** en 4 escenarios; `unchanged` = salida idéntica al archivo en disco. Sólo se propone aclarar el texto | MIG-B7-15 paso 5 |
| Parche `uxdsl-cli+0.5.0-beta.1.patch` rompe `npm install` | **No es de UXDSL.** `patches/` no existe en este repo; `npm i` de beta.6 desde el registro instala limpio. Lo verificado: beta.6 ya reenvía `includeTheme`/`references`, así que el parche sobra | MIG-B7-15 paso 4 (nota de migración) |
| La guía de agentes copiada quedó en la forma de beta.5 | **Es una copia del consumidor.** El problema de fondo (la guía no viaja con el paquete) es real | MIG-B7-15 paso 6 (a evaluar) |
| La "trampa conocida" de `border(n)` (variable indefinida) | **No está en `AGENTS.md` de este repo**; hoy `--uxdsl__color__gray-300` sí se define en la salida de beta.6 | Sin acción |
| No hay extensión, highlight ni autocompletado | **Falso para el repo, cierto para quien instala desde npm**: la extensión existe y no está publicada | MIG-B7-05 / 12 / 13 (ya existían) |
| "Cuatro paquetes" | Son cinco (falta `uxdsl-webpack-loader`) | Sin acción |

Filas nuevas de la tabla "Estado heredado":

- **R-17** (MIG-B7-12): no viene de FEAT-008; se comprobó leyendo `init` y los
  README.
- **R-18** (MIG-B7-13): sí es residuo de FEAT-008 (MIG-B6-26, MIG-B6-08
  diferida); esta ampliación sólo lo pone en la lista y lo condiciona a D-11.
- **R-19** (MIG-B7-14) y **R-20** (MIG-B7-15): del feedback de arriba. La tabla
  lo dice en su columna de fuente en vez de citar una ficha que no existe.

Lo que **no** se añadió: publicar la extensión (ya es R-06 / MIG-B7-05) ni
validarla en CI (ya es R-05 / MIG-B7-04). MIG-B7-12 depende de ellas para el
paso de `.vscode/extensions.json`, no las duplica.

**Sobre el canal de MIG-B7-14:** es un defecto en una versión ya publicada. Con
`beta.7` como primer corte, es lo primero que entra en él; publicarlo sigue siendo
decisión del dueño.

---

## Alcance por release

| Release | Historias | Notas |
| --- | --- | --- |
| **`0.5.0-beta.7`** (primer corte) | 01 ✅ integrada · **09** (limpieza del playground: prerrequisito de 17) · **12** (editor support) · **14** (`@import`, P0) · **15** (actualizar sin sorpresas) · **16** (documentación ejecutable) · **17** (playground como referencia, por fases) · **18** (gate de beta.7) | 17 es XL y se entrega por fases; el release puede cortar en el límite de una fase **declarando** qué quedó revisado y qué no, nunca implícito. Sin CI real todavía (04): el gate 18 corre a mano |
| **`0.5.0-rc.1`** (destino) | 02, 03 (contraste; esperan D-8/D-9) · 04 (CI real) · 05 (publicar extensión) · 06 (Vite) · 07 (higiene) · 08 (`theme --diff`) · 10 (`!important`; espera D-10) · 13 (esperando D-11) · **11** (gate de `rc.1`) | Todo lo que no entra en `beta.7`. El gate 11 no se reduce por la existencia del 18 |

**Nota de honestidad sobre 09:** no estaba en el recorte propuesto para `beta.7`;
entra porque 17 no puede empezar sobre archivos muertos, un script de auditoría
roto y sin arnés de tests de componente. Si el dueño prefiere no moverla, 17 pierde
su base de limpieza y su Fase D tendría que hacer esa limpieza por su cuenta.

---

## Reglas de esta feature

Las mismas de FEAT-008, sin repetirlas todas:

1. Ningún fallo silencioso nuevo.
2. Cada story cierra con su reproducción (la cita de la tabla de arriba) convertida
   en test de regresión, cuando aplique.
3. Sin sintaxis nueva.
4. Cambios visuales sólo con sección `Visual changes` en el CHANGELOG.
5. Sin publicar sin aprobación explícita.
6. Contratos y evidencia en las fichas, con el mismo protocolo que
   [FEAT-008/README.md](FEAT-008/README.md#cobertura-y-evidencia-obligatorias).

## Contratos de implementación

- [MIG-B7-01 — Contraste: placeholder de Input recibe sustitución por tone](FEAT-009/MIG-B7-01-placeholder-tone.md)
- [MIG-B7-02 — Contraste: light/dark/surface como tone de texto/borde](FEAT-009/MIG-B7-02-tono-identidad-fondo.md) — **bloqueada por D-8**
- [MIG-B7-03 — Contraste: identidad de warning.main en modo claro](FEAT-009/MIG-B7-03-warning-main.md) — **bloqueada por D-9**
- [MIG-B7-04 — CI real: tests, gate, adaptadores, navegador, VSIX](FEAT-009/MIG-B7-04-ci-real.md)
- [MIG-B7-05 — Publicación de la extensión VS Code](FEAT-009/MIG-B7-05-publicar-extension.md)
- [MIG-B7-06 — Sourcemaps de Vite: investigar y cerrar si es posible](FEAT-009/MIG-B7-06-vite-sourcemaps.md)
- [MIG-B7-07 — Higiene de paquetes, ronda 2](FEAT-009/MIG-B7-07-higiene-ronda-2.md)
- [MIG-B7-08 — `theme --diff`: resumen de mezcla para surfaces/buttons/inputs](FEAT-009/MIG-B7-08-diff-surfaces-buttons-inputs.md)
- [MIG-B7-09 — Limpieza del playground](FEAT-009/MIG-B7-09-limpieza-playground.md)
- [MIG-B7-10 — Decisión sobre el comparador muerto de `!important`](FEAT-009/MIG-B7-10-important-comparador.md) — **bloqueada por D-10**
- [MIG-B7-11 — Gate hacia `0.5.0-rc.1`](FEAT-009/MIG-B7-11-gate-rc1.md)
- [MIG-B7-12 — Editor support para apps consumidoras: colores, autocompletado y tipos](FEAT-009/MIG-B7-12-editor-support-consumidores.md) — añadida 2026-09-23
- [MIG-B7-13 — Editor: completado y hover según el tema del proyecto](FEAT-009/MIG-B7-13-editor-tema-del-proyecto.md) — añadida 2026-09-23, **bloqueada por D-11**
- [MIG-B7-14 — El `@import` de Google Fonts queda tras `:root` y el navegador lo ignora](FEAT-009/MIG-B7-14-google-fonts-import-orden.md) — añadida 2026-09-23, **P0, defecto de beta.6 publicada**
- [MIG-B7-15 — Actualizar sin sorpresas: ver qué cambió en las familias que nunca declaraste](FEAT-009/MIG-B7-15-actualizar-sin-sorpresas.md) — añadida 2026-09-23 (su paso 3 espera D-12)
- [MIG-B7-16 — Documentación: ejemplos que se ejecutan y revisión de todas las superficies](FEAT-009/MIG-B7-16-documentacion-ejecutable.md) — añadida 2026-09-23, `beta.7`
- [MIG-B7-17 — Playground: el mejor implementador de UXDSL y prueba viva de cada capacidad](FEAT-009/MIG-B7-17-playground-referencia.md) — añadida 2026-09-23, `beta.7`, XL por fases
- [MIG-B7-18 — Gate de `0.5.0-beta.7`](FEAT-009/MIG-B7-18-gate-beta7.md) — añadida 2026-09-23, cierra `beta.7`

---

## Orden y coordinación

01 (placeholder), 04 (CI), 07 (higiene), 08 (diff extendido), 09 (playground) y
10 (decisión de important) no tienen dependencias entre sí y pueden avanzar en
paralelo. 02 y 03 esperan D-8/D-9. 05 es una acción del dueño, sin código que
bloquee nada más. 06 es una investigación que puede no tener fix (ver su propia
ficha). 12 (editor support para consumidores) tampoco depende de nadie, salvo su
paso de `.vscode/extensions.json`, que espera a 05; 13 espera D-11. **14 (el
`@import`) es P0, no depende de nadie y es lo primero que conviene hacer**: es un
defecto de una versión ya publicada. 15 avanza sin depender de nadie salvo su
paso 3 (D-12). **Para `beta.7`:** 09 → (16 en paralelo) → 17 por fases, con 12, 14
y 15 independientes, y 18 al final. 16 antes que 17 porque 17 usa su arnés. **Para
`rc.1`:** 11 cierra tras todas las demás (12, 14, 15, 16, 17 siempre; 13 sólo si
D-11 = (a)), igual que MIG-B6-12 cerró FEAT-008.

## Qué NO entra aquí

- Nueva sintaxis o primitivas de UXDSL — nada en esta feature lo pide.
- FEAT-007 (contrato 1.0, LSP, benchmarks comparativos, migradores, paquete
  frontal `uxdsl`): sigue re-apuntada a después de `0.5.0`. **Única porción
  que D-11 puede traer:** el MVP acotado de MIG-B6-08 (completado y hover según
  el tema del proyecto), como MIG-B7-13. Todo lo demás de FEAT-007, incluido el
  LSP completo, queda fuera.
- Publicar `0.5.0-rc.1` o `0.5.0`: decisión y acción del dueño, después de que
  esta feature cierre y de la validación de Press Craftor que FEAT-008 ya dejó
  pendiente (no se duplica aquí; MIG-B7-11 la referencia, no la reemplaza).

## Comandos de verificación

```bash
npm test
npm run verify:beta6
node scripts/generate-language-artifacts.js --check
UXDSL_CHROME_PATH=/ruta/a/chrome npm run verify:cssmodules-build

# Nuevos, se agregan con su implementación
npm run verify:rc1   # MIG-B7-11
```
