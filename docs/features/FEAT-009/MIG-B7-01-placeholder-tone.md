# MIG-B7-01 — Contraste: placeholder de Input recibe sustitución por tone

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P0 · M |
| Cierra | R-01 |
| Depende de | — (no bloqueada por D-8/D-9; ver "Por qué") |
| Bloquea | MIG-B7-11 |
| Archivos | `packages/postcss-uxdsl/src/control-engine.ts` (`declarations()`) — no `theme/base.json`; ver "Lo que realmente pasó" abajo para por qué el archivo previsto originalmente cambió |

## Por qué

MIG-B6-29 fase 3, "Límites y seguimiento", hallazgo (a):

> `inputs.*.base.placeholder` es una referencia literal a `palette(neutral.dark)`
> en las tres definiciones de rol de `theme/base.json`, la única propiedad de
> Surface/Input que el motor de control (`control-engine.ts`) nunca sustituye
> por tone (a diferencia de `bg`/`color`/`border`) — un solo gris no puede
> leerse a la vez sobre el fondo casi blanco (funciona hoy, sin tone) y sobre
> un fondo tonalizado saturado y a menudo oscuro (falla).

## Diagnóstico (verificado el 2026-09-22, no asumido)

Hay **dos mecanismos de tone distintos** en el motor, y `placeholder` cae en
ninguno de los dos correctamente:

1. **Composición de Surface** (`surfaces.ts:113-136`, `surfaceDeclarations`):
   cuando se pasa un `tone`, esta función calcula `background`/`color`/`border`
   **en TypeScript**, directamente como `var(--uxdsl__palette__<tone>-main)`
   (o `-contrast`, según el rol). No lee ningún patrón de JSON. `placeholder`
   no es una `SURFACE_PROPERTIES` (`padding`/`radius`/`bg`/`color`/`border`/
   `shadow`), así que esta función nunca la toca.
2. **Sustitución por patrón en JSON** (`control-engine.ts:63-78`,
   `compileRules`): para cada campo de `base`/`states` de cada rol, genera
   una variable `<rol>-tone-<tone>-<estado>-<campo>` reemplazando, por regex,
   cualquier aparición literal de
   `var(--uxdsl__<family>__tone-main, var(--uxdsl__palette__primary-main))`
   (o `-dark`/`-contrast`) por el tone real pedido. Es el mecanismo que ya usan
   los estados de Button (`hover.bg`, `selected.bg`, etc. en `theme/base.json`).
   `declarations()` (`control-engine.ts:92`) siempre referencia esa variable
   con fallback: `var(...-tone-<tone>-..., var(...-base...))`.

`placeholder` sí pasa por el mecanismo 2 (se genera una variable
`<rol>-tone-<tone>-base-placeholder` para cada tone), **pero su valor en
`theme/base.json` es el literal `"palette(neutral.dark)"`**, sin el patrón
`tone-main`/`tone-dark` que el regex busca. La sustitución no encuentra nada
que reemplazar, así que la variable "tone-aware" resultante es, para
cualquier tone, exactamente `var(--uxdsl__palette__neutral-dark)` — la
sustitución existe mecánicamente pero nunca cambia nada.

**Consecuencia práctica (como se planeó originalmente, antes de implementar):**
esto parecía, en principio, un cambio de valor en `theme/base.json`, no un
cambio de motor — el mecanismo de sustitución por patrón ya es genérico sobre
cualquier campo cuyo valor use ese patrón; sólo faltaría que `placeholder` lo
use. **Esta conclusión resultó incorrecta al probarla — ver "Lo que realmente
pasó" abajo.** Se deja aquí, sin borrar, como registro de por qué el paso 1 de
Implementación (confirmar con una prueba real antes de tocar nada) existe: una
lectura de código, por detallada que sea, no reemplaza correr el compilador
real, y en este caso la lectura por sí sola habría llevado a un cambio que no
funciona.

## Lo que realmente pasó (durante la implementación, 2026-09-22)

El diagnóstico de arriba sobre *por qué* el mecanismo 2 no sustituye nada hoy
es correcto. Su conclusión sobre *cómo arreglarlo* no lo era, en tres puntos
distintos, cada uno encontrado ejecutando el paso 1 antes de tocar
`theme/base.json`:

1. **El alcance real era mucho mayor que 3 fallos.** `checkThemeContrast`
   contra el tema base reportaba **42** fallos con `pair: 'placeholder'`, no
   3 — en tres grupos causales: 27 tonalizados en modo claro (`contained`),
   6 tonalizados en modo oscuro (`contained`), y **9 sin ningún tone, sólo en
   modo oscuro, en los tres roles** — este tercer grupo es un hallazgo nuevo,
   no descrito en MIG-B6-29 ni anticipado por este documento.
2. **El fix propuesto (reescribir `placeholder` en `theme/base.json` para
   reusar literalmente `var(--uxdsl__input__tone-main, var(--uxdsl__palette__
   primary-main))`) no tiene ningún efecto.** El regex de `compileRules` sólo
   sustituye cuando el fallback es exactamente `palette__primary-<variant>`;
   cualquier otro texto de fallback (incluido `neutral-dark`, el que
   `placeholder` necesita conservar sin tone) nunca se sustituye. Verificado
   escribiendo ese JSON exacto y confirmando que `checkThemeContrast` reporta
   los mismos 42 fallos, sin cambio.
3. **La variante propuesta (`tone-main`) es incorrecta.** `tone-main`
   coincide con el *fondo* ya tonalizado de `contained`, así que el
   placeholder quedaría del mismo color que el fondo — invisible. La
   variante correcta es `tone-contrast`, la misma que ya usa el texto
   tecleado de ese rol.
4. **El alcance propuesto (las tres definiciones de rol) es incorrecto.**
   `outlined`/`underline` nunca tuvieron un fallo *tonalizado* — su fondo
   nunca se tonaliza (permanece blanco/transparente) — y aplicarles la misma
   sustitución introduce fallos nuevos: un placeholder forzado a
   `tone-contrast` desaparece para cualquier tone cuyo `contrast` sea blanco
   sobre ese fondo. El alcance correcto es **sólo `contained`**.

Consecuencia: el fix real es un cambio de motor (`control-engine.ts`,
función `declarations()`), no de `theme/base.json`, activando el paso 4 de
Implementación ("si el paso 1 revela que el mecanismo 2 no alcanza..."). Se
reutiliza la misma señal que `surfaceDeclarations` ya calcula
(`background === 'transparent'`) para distinguir `contained` (fondo
tonalizado) de `outlined`/`flat` (no lo está), y se sobreescribe
`base.placeholder` con una referencia directa a
`var(--uxdsl__palette__<tone>-contrast)` cuando hay tone, el rol define
`placeholder` y el fondo no es transparente — sin tocar `compileRules` ni
`theme/base.json`. Esto también significa que la variable `:root` que
`compileRules`/`generateInputCss` sigue generando para
`<rol>-tone-<tone>-base-placeholder` queda sin usar para `contained` con
tone (nunca se referencia desde el componente compilado) — no es un error,
es el mismo patrón que ya existe para `bg`/`color`/`border`, que tampoco
pasan por una variable `:root` intermedia cuando `surfaceDeclarations` los
calcula directamente.

## Reproducción

```bash
node -e "
const { generateInputCss, resolveTheme } = require('./packages/postcss-uxdsl/dist/ds-runtime');
const css = generateInputCss(resolveTheme({}));
const lines = css.split('\n').filter(l => l.includes('outlined-tone-') && l.includes('placeholder'));
console.log(lines.slice(0, 3).join('\n'));
"
```

Salida esperada hoy: todas las variables `outlined-tone-<X>-base-placeholder`
resuelven al mismo `var(--uxdsl__palette__neutral-dark)`, sin importar `<X>`.

## Resultado esperado

`@ds-input(outlined error)` y `@ds-input(outlined success)` deben producir
`::placeholder` con un color que dependa del tone pedido, de la misma forma
que ya lo hace `color`/`border` para esos mismos roles — y ese color debe
cumplir 4.5:1 (AA, texto) contra el fondo real del campo, en ambos modos.

## Implementación

1. **Confirmar el diagnóstico con una prueba real** antes de tocar
   `theme/base.json`: escribir un test que falle hoy (dos tones distintos dan
   el mismo `::placeholder`) y quede como regresión permanente.
2. Elegir qué variante de tone usa `placeholder` — probablemente `tone-main`,
   igual que `color`/`border` en `outlined`, para que "escribir en un campo
   `error`" se sienta consistente entre el borde, el texto tecleado y el
   placeholder. Verificar contraste de esa elección contra el fondo real de
   cada rol (`contained`/`outlined`/`underline`) en claro y oscuro, para las
   11 familias de tone, con `checkThemeContrast` — no a mano.
3. Reescribir `placeholder` en las tres definiciones de rol de
   `theme/base.json` usando el patrón ya existente, por ejemplo:
   `"placeholder": "var(--uxdsl__input__tone-main, var(--uxdsl__palette__neutral-dark))"`
   — el fallback (`neutral.dark`) es intencional: preserva el comportamiento
   actual cuando no se pasa tone.
4. Si el paso 1 revela que el mecanismo 2 no alcanza (por ejemplo, si algún
   rol necesita una variante de tone distinta a las otras dos, algo que el
   patrón actual no permite expresar por campo), documentar exactamente qué
   falta antes de tocar `control-engine.ts` — no generalizar el motor sin una
   necesidad demostrada.
5. Re-correr `checkThemeContrast` sobre el tema completo: esta corrección no
   debe introducir fallos nuevos en pares que hoy pasan.

## Fuera de alcance

- Cambiar qué campos son "tone-aware" en Surface/Button — sólo Input/placeholder.
- Tocar `light`/`dark`/`surface`/`warning.main` (MIG-B7-02, MIG-B7-03).
- El hallazgo nuevo encontrado durante la implementación (punto 1 de "Lo que
  realmente pasó"): 9 fallos de `placeholder` **sin tone**, sólo en modo
  oscuro, en los tres roles (`palette(neutral.dark)` no es suficientemente
  oscuro-modo-consciente contra el fondo real de esos roles en modo oscuro).
  Es un cambio de color, no de mecanismo de sustitución por tone — no lo
  toca esta historia. Pinneado explícitamente por el test de contraste (ver
  Pruebas) para que MIG-B7-11 lo vea como el conjunto restante esperado, y
  recomendado como seguimiento futuro (posible MIG-B7-12 o revisión directa
  de `neutral.dark`).

## Pruebas

`packages/postcss-uxdsl/test/input-placeholder-tone.test.js` (6 tests):

- Test de regresión: dos tones distintos producen `::placeholder` distinto
  en `contained` (compilando `@ds-input(...)` real a través del plugin, no
  inspeccionando una variable de tema intermedia — ver el comentario de
  cabecera del archivo para por qué esa distinción importa aquí).
- Sin tone: sigue resolviendo al gris sin tone, nunca a `primary`.
- `outlined`/`underline`: la referencia compilada no cambia con o sin tone
  (el fondo nunca se tonaliza ahí).
- Control: Button no emite ninguna regla `placeholder` (el campo no existe
  en esa familia).
- Contraste: `checkThemeContrast` — cero fallos tonalizados de `placeholder`
  restantes; el conjunto exacto de 9 fallos no-tonalizados restantes
  (fuera de alcance, ver arriba) queda pinneado explícitamente, para que un
  cambio que lo altere sin querer se note.
- Control: el recuento de fallos de Button (47) no cambia.
- Control negativo (ejecutado manualmente, no en CI): revertir
  `control-engine.ts` a su versión sin el fix hace fallar exactamente los
  tests 1 y 5 de la lista de arriba, y ningún otro — confirmado
  revirtiendo con `git stash`, reconstruyendo y re-corriendo el archivo.

## Documentación

- `packages/postcss-uxdsl/CHANGELOG.md`: entrada con sección `Visual changes`
  (el color del placeholder cambia para cualquier `@ds-input(rol tone)` que
  ya se use hoy).
- `packages/postcss-uxdsl/README.md`, sección de Inputs: mencionar que
  `placeholder` ahora sigue el tone, con ejemplo.

## Criterios de aceptación

- [x] `::placeholder` varía con el tone pedido — **corregido**: sólo en
      `contained`, el único rol cuyo fondo se tonaliza. El criterio original
      decía "los tres roles"; `outlined`/`underline` deliberadamente no
      varían (ver "Lo que realmente pasó" y el test que lo pin-ea).
- [x] Cumple 4.5:1 contra el fondo real, en las 11 familias de tone reales de
      `theme/base.json`, claro y oscuro — verificado por
      `checkThemeContrast` contra el tema completo, no sólo el fixture de 5
      familias del test unitario.
- [x] `checkThemeContrast` no reporta fallos nuevos — 156 → 123 fallos
      totales (33 resueltos, 0 nuevos); Button, sin cambio (47, mismo
      conjunto exacto de firmas).

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
node -e "require('./packages/postcss-uxdsl/dist/ds-runtime').checkThemeContrast(require('./packages/postcss-uxdsl/dist/ds-runtime').resolveTheme(), { exceptions: require('./packages/postcss-uxdsl/src/theme/base.contrast-exceptions.json') })"
npm test
```

## Entrega

`fix(FEAT-009): MIG-B7-01 - Input placeholder follows the requested tone`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente**
en `feat/mig-b7-01-placeholder-tone`. Integración a `main` pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `049b5c0` (2026-09-22, HEAD de `main` y de esta rama al crearla). Entrega: `88828d5` en `feat/mig-b7-01-placeholder-tone`. PR: pendiente de abrir; no puede auto-mergearse (el clasificador de auto-modo bloquea `gh pr merge` con "Merge Without Review") — requiere que el usuario lo ejecute. |
| Reproducción antes del cambio | Sobre `049b5c0`, antes de escribir cualquier código: `node -e` llamando a `checkThemeContrast(resolveTheme(), { exceptions })` contra el tema base sin ningún cambio → **156 fallos totales, 42 con `pair: 'placeholder'`** (no los 3 que citaba la ficha original — ver el desglose en 3 grupos causales en "Lo que realmente pasó"). Probado también, antes de tocar el motor: escribir literalmente el patrón `"placeholder": "var(--uxdsl__input__tone-main, var(--uxdsl__palette__neutral-dark))"` en una copia de `theme/base.json` no cambia ese número (0 de 42 resueltos) — confirma que `compileRules` sólo sustituye un fallback que sea exactamente `palette__primary-<variant>`. 2026-09-22. |
| Criterio → regresión | Los tres criterios → `packages/postcss-uxdsl/test/input-placeholder-tone.test.js` (6 tests). Varía por tone, sólo `contained` → "contained placeholder varies with the requested tone" + "outlined and underline placeholders are untouched — the surface never tints there". Sin tone → "no tone at all still resolves to the untoned gray, never to primary". 4.5:1 en las 11 familias reales, ambos modos, y sin fallos nuevos → "the contrast gate no longer reports the tinted-placeholder failures, and nothing else moved" (pinnea el conjunto exacto de 9 fallos restantes) + "Button's own tone-state pattern (hover.bg etc.) is unaffected" (control: cuenta de Button sin cambio). Control adicional → "Button is untouched — it has no placeholder field to trigger this at all". |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, desde la raíz del monorepo. `npm --prefix packages/postcss-uxdsl test` → exit 0, **384/384** (incluye el archivo nuevo de 6 tests) + 1 test de rendimiento (exit 0). `node -e "...checkThemeContrast(resolveTheme(), { exceptions })..."` → exit 0. `npm test` (raíz) → exit 0, **684 líneas `ok`, 0 `not ok`**, 12 suites. Control negativo (manual, no en CI): `git stash` sólo sobre `control-engine.ts` → rebuild → re-correr el archivo nuevo → exactamente 2 de 6 fallan (tests 1 y 5, los únicos que dependen del fix; 2, 3, 4, 6 siguen en verde porque pinnean comportamiento que el fix no toca) → `git stash pop` → rebuild → 6/6 de nuevo. |
| Resultado después / control negativo | Compilando `@ds-input(...)` real a través del plugin (no `generateInputCss`, un camino de compilación distinto que este fix deliberadamente no toca — ver el comentario de cabecera del test para la distinción): `contained primary` → `.a::placeholder { color: var(--uxdsl__palette__primary-contrast); }`; `contained secondary` → `--uxdsl__palette__secondary-contrast`; `contained` sin tone → `var(--uxdsl__input__contained-base-placeholder)` (idéntico a antes); `outlined error` → `var(--uxdsl__input__outlined-tone-error-base-placeholder, var(--uxdsl__input__outlined-base-placeholder))` (idéntico a antes). Contraste sobre el tema base completo: 156 → **123** fallos totales; exactamente los 33 fallos tonalizados de `contained` resueltos (27 modo claro + 6 modo oscuro); **0 nuevos**; Button sin cambio (47, mismas firmas exactas antes/después). Restan 9 fallos `placeholder`, todos `tone: null`, modo oscuro, los tres roles × {base, focus, invalid} — grupo nuevo, fuera de alcance (ver esa sección), pinneado por el test para que MIG-B7-11 lo vea como el conjunto esperado. Control negativo: ver fila anterior. |
| Cambios visuales o API / migración | Visual (ver CHANGELOG, `0.5.0-rc.1`, entrada MIG-B7-01): cualquier `@ds-input(contained <tone>)` ya en uso con un tone explícito cambia el color de `::placeholder` de `palette(neutral.dark)` a `palette(<tone>.contrast)`. `outlined`/`underline` y cualquier uso sin tone: sin cambio. Sin cambio de API pública — mismos argumentos de `@ds-input(...)`, sin exports nuevos ni removidos. |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/CHANGELOG.md`: nueva sección `## 0.5.0-rc.1 — unreleased` (no existía — `0.5.0-beta.6` era hasta ahora la sección `unreleased` más reciente) con la entrada MIG-B7-01 completa, incluyendo `### Visual changes` y el resumen del diagnóstico corregido. `packages/postcss-uxdsl/README.md`: párrafo "Current status against theme/base.json" actualizado (de 3 hallazgos sin resolver a 2 + 1 nuevo, citando MIG-B7-01) y ejemplo nuevo "Input placeholder tone (MIG-B7-01, FEAT-009)" con `@ds-input(contained error)`. `docs/migration.md`: sin cambios — ningún default de API cambia, sólo el color de un caso que antes no variaba. |
| AGENTS / guías / arquitectura | Sin cambio de contrato: `AGENTS.md` ya describe Inputs como responsables de "campos, caret, placeholder y estados visuales"; este fix corrige qué color usa un campo ya documentado, no añade ni redefine una responsabilidad. No se tocó. |
| Límites y seguimiento | (1) El hallazgo nuevo descubierto implementando esto (9 fallos `placeholder` sin tone, sólo modo oscuro, los tres roles) queda abierto — ver "Fuera de alcance"; recomendado como seguimiento futuro (revisión directa de `neutral.dark` en modo oscuro, al estilo MIG-B6-29 fase 3). (2) Sin verificación en navegador real: lo verificado es CSS compilado por el PostCSS real y el reporte de `checkThemeContrast`, no una captura de pantalla ni Chromium — misma limitación ya registrada en otras fichas de esta sesión. (3) La variable `:root` que `compileRules`/`generateInputCss` sigue emitiendo para `<rol>-tone-<tone>-base-placeholder` en `contained` queda sin usar tras este cambio (nunca referenciada desde el componente compilado) — no es un defecto, replica el patrón ya existente para `bg`/`color`/`border` (que tampoco pasan por una variable `:root` intermedia), pero un futuro trabajo de limpieza podría dejar de emitirla para no generar CSS muerto en la hoja de tema. (4) MIG-B7-11 (la puerta de release) depende de que el conjunto de 9 fallos restantes documentado aquí siga siendo exactamente ese; el test de este story ya lo fija como regresión explícita. (5) **Hallazgo nuevo, no accionado aquí**: `scripts/verify-docs-update.js`'s `VISUAL_DEFAULT_FILES` no incluye `control-engine.ts` (sólo `default-theme.ts`, `typography.ts`, `theme/base.json` y `theme/base.contrast-exceptions.json`), así que el guard automático de `npm run verify:docs` no habría exigido la entrada de CHANGELOG que este story sí añadió por criterio propio — un cambio de motor puro puede alterar el resultado visual por defecto (este mismo fix es la prueba) sin que el guard lo detecte. No corregido aquí: expandir esa lista es una decisión de alcance de MIG-B6-28/el propio guard, no de esta story de contraste. |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado.
