# MIG-B7-01 — Contraste: placeholder de Input recibe sustitución por tone

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P0 · M |
| Cierra | R-01 |
| Depende de | — (no bloqueada por D-8/D-9; ver "Por qué") |
| Bloquea | MIG-B7-11 |
| Archivos | `packages/postcss-uxdsl/src/theme/base.json` (`inputs.{contained,outlined,underline}.base.placeholder`), posiblemente `packages/postcss-uxdsl/src/control-engine.ts` si el diagnóstico de abajo resulta insuficiente, `scripts/fix-theme-contrast.js` (reutilizar, no reescribir) |

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

**Consecuencia práctica:** esto es, en principio, **un cambio de valor en
`theme/base.json`, no un cambio de motor** — el mecanismo de sustitución por
patrón ya es genérico sobre cualquier campo cuyo valor use ese patrón; sólo
falta que `placeholder` lo use. Confirmar esto con una prueba mínima antes de
tocar nada (paso 1 de Implementación) porque una lectura de código, por
detallada que sea, no reemplaza correr el compilador real.

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

## Pruebas

- Test de regresión: dos tones distintos producen `::placeholder` distinto,
  para los tres roles (`contained`/`outlined`/`underline`), en ambos modos.
- Contraste: `checkThemeContrast` sin nuevos fallos introducidos; el conjunto
  de fallos conocidos (ver MIG-B7-11 y el test que lo fija) sólo puede
  reducirse con este cambio, nunca crecer.
- Control negativo: revertir el valor de `placeholder` a `palette(neutral.dark)`
  debe hacer fallar el test de regresión del paso 1.

## Documentación

- `packages/postcss-uxdsl/CHANGELOG.md`: entrada con sección `Visual changes`
  (el color del placeholder cambia para cualquier `@ds-input(rol tone)` que
  ya se use hoy).
- `packages/postcss-uxdsl/README.md`, sección de Inputs: mencionar que
  `placeholder` ahora sigue el tone, con ejemplo.

## Criterios de aceptación

- [ ] `::placeholder` varía con el tone pedido, para los tres roles de Input.
- [ ] Cumple 4.5:1 contra el fondo real, en las 11 familias de tone, claro y oscuro.
- [ ] `checkThemeContrast` no reporta fallos nuevos.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
node -e "require('./packages/postcss-uxdsl/dist/ds-runtime').checkThemeContrast(require('./packages/postcss-uxdsl/dist/ds-runtime').resolveTheme(), { exceptions: require('./packages/postcss-uxdsl/src/theme/base.contrast-exceptions.json') })"
npm test
```

## Entrega

`fix(FEAT-009): MIG-B7-01 - Input placeholder follows the requested tone`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Pendiente de implementación/verificación**.
Completar en el mismo PR conforme al
[protocolo de agentes](../FEAT-009/README.md#protocolo-de-implementación).

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | Comando/test, resultado observado y fecha: pendiente |
| Criterio → regresión | Nombre/path exacto del test por criterio: pendiente |
| Comandos y entorno | Comando, versión/OS relevante, exit code y log: pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente; justificar si no aplica |
| README / CHANGELOG / migration | Paths y secciones: pendiente |
| AGENTS / guías / arquitectura | Secciones actualizadas o sin cambio de contrato razonado: pendiente |
| Límites y seguimiento | Qué no se ejecutó, motivo y efecto sobre cierre: pendiente |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado.
