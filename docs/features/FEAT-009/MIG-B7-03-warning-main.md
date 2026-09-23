# MIG-B7-03 — Contraste: identidad de warning.main en modo claro

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P0 · S |
| Cierra | R-03 |
| Depende de | **D-9 — decisión del dueño, sin responder** |
| Bloquea | MIG-B7-11 |
| Coordinación | 3 de los 16 pares afectados son `input.contained.placeholder`, que MIG-B7-01 también toca. Aplicar MIG-B7-01 primero: cambia *cómo* se sustituye el color, no lo hace pasar — `warning.main` seguirá siendo el mismo color de fondo/fallback demasiado claro hasta que esta ficha se resuelva |

## Estado: bloqueada

Igual que MIG-B7-02: no se implementa hasta D-9. Contrato completo abajo.

## Por qué

MIG-B6-29 fase 3, "Límites y seguimiento", hallazgo (c), cita completa:

> `warning.main` (sólo en modo claro) no es suficientemente oscuro/saturado
> para leerse como texto/borde directo vía tone en `outlined`/`flat`/
> `underline`; corregirlo dentro de las reglas de esta misma ficha exigiría
> moverlo lo bastante como para perder su identidad de acento de advertencia
> reconocible, que la propia protección de `main` ("último recurso, identidad
> de marca") existe para evitar.

## Reproducción (verificado el 2026-09-22)

```bash
node -e "
const { checkThemeContrast, resolveTheme } = require('./packages/postcss-uxdsl/dist/ds-runtime');
const exceptions = require('./packages/postcss-uxdsl/src/theme/base.contrast-exceptions.json');
const r = checkThemeContrast(resolveTheme(), { exceptions });
console.log(r.failures.filter(f => f.tone === 'warning').length, 'fallos con tone warning');
"
```

**16 fallos**, todos en modo claro, todos texto/borde/placeholder de la familia
`warning` vía tone directo (`outlined`/`flat`/`underline`), ratios entre 3.19:1
y 4.29:1 (todos por debajo de 4.5:1). El color real es `palette.warning.main`
= `#d97706` sobre fondo blanco/ambiente.

## Decisión que bloquea esta ficha (D-9)

| Opción | Qué implica |
| --- | --- |
| (a) Excepción revisada, como ya existe para `light` | Cero cambio de color. Se declaran los 16 pares (o el patrón que los cubre) como excepción aceptada, con motivo explícito: `warning.main` es una identidad de marca que este release decide no oscurecer |
| (b) Re-elegir `warning.main` deliberadamente | El dueño (o quien el dueño designe) elige un naranja distinto que cumpla 4.5:1 directo y siga siendo reconociblemente "advertencia". Esto NO es un trabajo de `scripts/fix-theme-contrast.js` (que sólo mueve L en OKLCH preservando el hue, buscando el cambio mínimo) — es una elección de diseño consciente, potencialmente con un hue distinto, no una optimización automática |

## Implementación (una vez decidido)

**Si (a):** igual mecánica que MIG-B7-02 opción (a) — extender
`base.contrast-exceptions.json` con un registro por cada uno de los 16 pares
(o agruparlos si el mecanismo de excepciones lo permite por patrón; verificar
antes de asumirlo, ya que hoy matchea por color resuelto exacto, no por regla).

**Si (b):** el nuevo valor de `warning.main` se aplica con
`scripts/fix-theme-contrast.js` **no** para encontrarlo (ese script asume
"cambio mínimo", que es exactamente lo que el dueño está decidiendo no hacer
aquí) sino para **verificar** que el valor elegido por el dueño no rompe otros
pares que hoy pasan (`warning.dark`, `warning.contrast`, y cualquier
referencia cruzada). Recompilar todo el playground después — `green`, `slate`
y cualquier tema que no sobrescriba `warning` heredan el cambio.

## Fuera de alcance

- `light`/`dark`/`surface` (MIG-B7-02) y `placeholder` (MIG-B7-01) — hallazgos
  independientes, aunque compartan 3 filas de la reproducción.
- Ajustar `warning.dark`/`warning.contrast` salvo que la elección de (b) los
  vuelva inconsistentes entre sí.

## Pruebas

- (a): test que fija los 16 ids de excepción y confirma `matched: true` para
  todos, `exceptionIssues: []`.
- (b): test que confirma que las 16 combinaciones ahora pasan 4.5:1 (o 3:1 para
  `pair: 'border'`, si aplica), y que ningún par de `warning` que hoy pasa deja
  de hacerlo.

## Documentación

- `packages/postcss-uxdsl/CHANGELOG.md`, sección `Visual changes` si (b) —
  cualquier proyecto sin override propio de `palette.warning` ve cambiar el
  color literal en pantalla.
- `docs/migration.md` si (b), con el valor antes/después.

## Criterios de aceptación

- [ ] D-9 respondida por el dueño y citada aquí textualmente antes de implementar.
- [ ] La opción elegida está implementada y probada.
- [ ] Ningún par de `warning` que hoy pasa (fuera de los 16) deja de pasar.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm --prefix packages/playground-nextjs run build
npm test
```

## Entrega

`fix(FEAT-009): MIG-B7-03 - <resumen según la opción elegida>`

## Registro de implementación y evidencia

Estado: **Bloqueada — esperando D-9**.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente de D-9 |
| Reproducción antes del cambio | Ver arriba, ya ejecutada — 16 fallos confirmados el 2026-09-22 |
| Criterio → regresión | Pendiente de D-9 |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente de D-9 |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | Pendiente |
| Límites y seguimiento | Pendiente |
