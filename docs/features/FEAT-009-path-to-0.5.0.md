# FEAT-009 — UXDSL 0.5.0-rc.1: cerrar contraste, CI real y publicación

| Campo | Valor |
| --- | --- |
| Estado | Plan nuevo, escrito el 2026-09-22 sobre el estado real de `feat/feat-008-beta6-plan` (HEAD `29fb2fb`) tras cerrar las 21 fichas de FEAT-008. No implementa ninguna story; sólo las define |
| Objetivo | Cerrar el residuo que FEAT-008 dejó explícitamente documentado (no descubierto de nuevo aquí) para que `0.5.0-beta.6` pueda congelarse en `0.5.0-rc.1` sin deuda oculta |
| Versión objetivo | `0.5.0-rc.1` para los cinco paquetes npm coordinados, según la propia "Ruta recomendada a 0.5.0" de [FEAT-008](FEAT-008-beta6-reliability.md#ruta-recomendada-a-050). Esta ficha **no** introduce una "beta.7": ese salto no está en el plan ya aprobado por el dueño, y renombrarlo aquí sería una decisión de producto que esta ficha no toma por su cuenta |
| Relación con FEAT-008 | No la reemplaza ni la reabre. FEAT-008 cerró sus 21 stories; cada una documentó, en su propio registro de evidencia, límites y hallazgos que quedaban fuera de su alcance. Esta feature es exclusivamente la lista de esos residuos, con su fuente citada — cero hallazgos nuevos, cero alcance inventado |
| Prioridad | P0: las tres brechas de contraste (bloquean el criterio de aceptación abierto de MIG-B6-29) y CI real (bloquea los dos criterios abiertos de MIG-B6-26). P1: sourcemaps de Vite, publicación de la extensión. P2: higiene de paquetes ronda 2, extensión del resumen de `theme --diff`, limpieza del playground, decisión sobre el comparador muerto de MIG-B6-25 |
| Depende de | El merge de [PR #4](https://github.com/rsantoyo-dev/uxdsl/pull/4) (las 8 stories de FEAT-008 que faltaban en `main`) |
| Origen | Cierre de evidencia de FEAT-008: cada fila de la tabla siguiente cita el campo "Límites y seguimiento" exacto de la ficha que la originó — no una auditoría externa nueva |
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

No listado aquí porque **no** es un residuo abierto: el aviso de `theme-manifest.json`
sobre `default-motion.css` (UX-21 original) — verificado el 2026-09-22, el
manifiesto no referencia ningún archivo inexistente; `theme-manifest-files.test.js`
pasa 3/3. Tampoco `TYPOGRAPHY_DEFAULTS`/`typography-defaults.ts` (eliminados por
MIG-B6-17), ni `route.ts` del playground (verificado sin relación con el tema
base), ni el bug de congelación de `base-theme.ts` (corregido y con test de
regresión dentro de la propia MIG-B6-29).

---

## Decisiones pendientes del dueño

Igual que D-1/D-2 en FEAT-008, estas tres preguntas necesitan respuesta antes
de implementar sus stories. No se responden aquí.

| ID | Pregunta | Opciones documentadas por MIG-B6-29 |
| --- | --- | --- |
| D-8 | ¿`light`, `dark` y `surface` deben seguir siendo válidas como `tone=` para roles que muestran texto/borde (`outlined`/`flat`/`underline`)? | (a) Excepcionar el patrón completo por familia, revisado por el dueño. (b) Reconsiderar si esas tres familias deberían ser opciones válidas de `tone=` para esos roles en absoluto — en cuyo caso el motor de control las rechazaría en vez de excepcionarlas |
| D-9 | ¿Qué hacer con `warning.main` en modo claro? | (a) Excepción revisada por el dueño (como ya existe para `light`). (b) Re-elección deliberada de `warning.main` fuera de las reglas de "cambio mínimo" que gobernaron la fase 3 de MIG-B6-29 — el dueño decide el nuevo valor, no un algoritmo |
| D-10 | ¿Vale la pena mover `!important` en el comparador de `resolve()`, sabiendo que cambia qué definición gana cuando una declaración `!important` precede a otra normal? | (a) Dejarlo como está (código muerto documentado, comportamiento actual fijado por test). (b) Corregirlo como cambio semántico consciente, con su propia migration guide |

MIG-B7-02 y MIG-B7-03 quedan en estado **Bloqueada — esperando D-8/D-9** hasta
que el dueño responda. MIG-B7-01 (placeholder) no depende de ninguna decisión:
es un fix de motor puro, la misma sustitución por tone que `bg`/`color`/`border`
ya reciben.

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

---

## Orden y coordinación

01 (placeholder), 04 (CI), 07 (higiene), 08 (diff extendido), 09 (playground) y
10 (decisión de important) no tienen dependencias entre sí y pueden avanzar en
paralelo. 02 y 03 esperan D-8/D-9. 05 es una acción del dueño, sin código que
bloquee nada más. 06 es una investigación que puede no tener fix (ver su propia
ficha). 11 cierra tras todas las demás, igual que MIG-B6-12 cerró FEAT-008.

## Qué NO entra aquí

- Nueva sintaxis o primitivas de UXDSL — nada en esta feature lo pide.
- FEAT-007 (contrato 1.0, LSP, benchmarks comparativos, migradores, paquete
  frontal `uxdsl`): sigue re-apuntada a después de `0.5.0`, sin cambios.
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
