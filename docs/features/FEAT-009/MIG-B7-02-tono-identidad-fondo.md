# MIG-B7-02 — Contraste: light/dark/surface como tone de texto/borde

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P0 · M |
| Cierra | R-02 |
| Depende de | **D-8 — decisión del dueño, sin responder** |
| Bloquea | MIG-B7-11 |
| Archivos | Depende de la decisión — ver "Implementación" |

## Estado: bloqueada

Esta ficha no se implementa hasta que el dueño responda D-8 (documento padre,
"Decisiones pendientes"). Lo que sigue es el contrato completo para cuando eso
ocurra; no es trabajo parcial.

## Por qué

MIG-B6-29 fase 3, "Límites y seguimiento", hallazgo (b), cita completa:

> `light`, `dark` y `surface` son familias de identidad de fondo/lienzo (su
> `main`/`dark` deben permanecer casi blancos o casi negros para cumplir su
> función real de fondo) usadas explícitamente como `tone=` de texto/borde en
> `outlined`/`flat`/`underline`, lo que lee ese mismo valor directamente contra
> el fondo ambiente de la página — exactamente la misma clase de hallazgo que
> la única excepción ya embarcada (`light` como texto), que cubre sólo el caso
> literal que la ficha nombra; `light` como borde, `dark` como tone en modo
> oscuro y `surface` como tone en ambos modos quedan sin excepción.

## Reproducción

```bash
node -e "
const { checkThemeContrast, resolveTheme } = require('./packages/postcss-uxdsl/dist/ds-runtime');
const exceptions = require('./packages/postcss-uxdsl/src/theme/base.contrast-exceptions.json');
const r = checkThemeContrast(resolveTheme(), { exceptions });
const affected = r.failures.filter(f => ['light','dark','surface'].includes(f.tone));
console.log(affected.length, 'fallos con tone en {light,dark,surface}');
console.log(affected.slice(0, 6));
"
```

Salida verificada el 2026-09-22, sobre `theme/base.json` con la única excepción
publicada: **104 de los 156 fallos totales** tienen `tone` en `{light, dark,
surface}` — la mayoría del residuo de contraste de MIG-B6-29 fase 3 viene de
este único hallazgo.

## Decisión que bloquea esta ficha (D-8)

| Opción | Qué implica |
| --- | --- |
| (a) Excepcionar el patrón completo por familia | `checkThemeContrast` sigue reportando estos pares como fallos técnicos, pero con una excepción declarada y revisada — igual que ya existe para `light` como texto. Cero cambio de comportamiento compilado; sólo se documenta que es un uso conocido y aceptado |
| (b) Reconsiderar si `light`/`dark`/`surface` deben ser `tone=` válidos para roles de texto en absoluto | Cambio de comportamiento real: `@ds-button(outlined surface)` (por ejemplo) dejaría de compilar, o compilaría distinto. Requiere migration guide y es un cambio que puede romper proyectos existentes que ya usan ese patrón — verificar consumidores reales (playground incluido) antes de decidir esto |

## Implementación (una vez decidido)

**Si (a):** extender `packages/postcss-uxdsl/src/theme/base.contrast-exceptions.json`
con un registro por cada par afectado, cada uno con su propio `id`, `resolved`
(colores exactos) y `reason` — siguiendo el formato ya usado por la excepción
de `light` como texto (ver ese archivo). No agrupar varios pares bajo una sola
excepción: el mecanismo de `checkThemeContrast` matchea por color resuelto
exacto, uno por uno.

**Si (b):** decidir en qué motor se aplica el rechazo — probablemente
`control-engine.ts` (`parseButtonArguments`/`parseInputArguments`, la misma
validación que ya rechaza un tone inexistente) — y qué mensaje de error da,
con sugerencia de qué familia usar en su lugar. Requiere:
1. Verificar todo el repo (playground incluido) por usos de `light`/`dark`/
   `surface` como segundo argumento de `@ds-button`/`@ds-input`.
2. Migration guide con cada uso encontrado y su reemplazo.
3. Decidir si es error o warning en la primera beta que lo introduce.

## Fuera de alcance

- `warning.main` (MIG-B7-03) y `placeholder` (MIG-B7-01) — hallazgos
  independientes de éste.
- Publicar la excepción/el cambio sin revisión del dueño, cualquiera sea la
  opción elegida — D-8 exige revisión explícita en ambos casos.

## Pruebas

Dependen de la opción elegida:
- (a): `checkThemeContrast` reporta las excepciones como `matched: true`,
  `exceptionIssues` vacío; un test fija el conjunto exacto de ids esperados.
- (b): un test que confirma que `@ds-button(outlined light)` (o la familia que
  corresponda) falla con el nuevo error, con control positivo de que las
  familias de acento siguen funcionando sin cambios.

## Documentación

- `packages/postcss-uxdsl/CHANGELOG.md`, con sección `Visual changes` si (b).
- `packages/postcss-uxdsl/docs/migration.md` si (b).
- `AGENTS.md`, sección de Buttons/Inputs, si (b) cambia qué tones son válidos.

## Criterios de aceptación

- [ ] D-8 respondida por el dueño y citada aquí textualmente antes de implementar.
- [ ] La opción elegida está implementada y probada según su propia sección de Pruebas.
- [ ] `checkThemeContrast` no reporta estos pares como fallos sin excepción ni
      sin la nueva regla del motor, según corresponda.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm test
```

## Entrega

`fix(FEAT-009): MIG-B7-02 - <resumen según la opción elegida>`

## Registro de implementación y evidencia

Estado: **Bloqueada — esperando D-8**. No completar el registro de evidencia
hasta que la decisión exista.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente de D-8 |
| Reproducción antes del cambio | Ver arriba, ya ejecutable |
| Criterio → regresión | Pendiente de D-8 |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente de D-8 (la opción (b) sí tiene; la (a) no) |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | Pendiente |
| Límites y seguimiento | Pendiente |
