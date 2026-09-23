# MIG-B7-10 — Decisión sobre el comparador muerto de `!important`

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P2 · S |
| Cierra | R-16 |
| Depende de | **D-10 — decisión del dueño, sin responder** |
| Bloquea | — |
| Archivos | `packages/postcss-uxdsl/src/reference-integrity.ts` (`resolve()`), si se decide corregir |

## Estado: bloqueada

## Por qué

MIG-B6-25, "Límites y seguimiento" (4), cita completa:

> El término `!important` del comparador de `resolve` es código muerto
> demostrable, dejado así a propósito porque arreglarlo cambiaría semántica.
> Arreglarlo *cambiaría* qué definición gana cuando una declaración
> `!important` precede a otra normal, que es exactamente el tipo de cambio
> semántico que esta historia excluye. Queda pinchado por un caso de la suite
> de equivalencia ("important declared before a plain override") que fija el
> comportamiento actual, para que un arreglo futuro sea una decisión consciente
> y no un efecto colateral.

## Diagnóstico (heredado de MIG-B6-25, no repetido aquí)

El término es matemáticamente muerto porque PostCSS deja `decl.important` como
`true` o `undefined` únicamente — nunca `false` — así que
`Number(a.node.important) - Number(b.node.important)` es `NaN` o `0` en las
cuatro combinaciones posibles, siempre "falsy" para el propósito de un
comparador de `sort`. El orden real hoy lo decide el siguiente criterio
(selector/orden de aparición), no `!important`.

## Reproducción

```bash
grep -n "important declared before a plain override" packages/postcss-uxdsl/test/reference-integrity-equivalence.test.js
node --test packages/postcss-uxdsl/test/reference-integrity-equivalence.test.js
```

El caso vive dentro del test "MIG-B6-25: equivalent on shared cycles, nested
fallbacks and !important" (no imprime su propia línea salvo que falle; el
`grep` confirma que existe). Verificado el 2026-09-22: el archivo lo contiene
en la línea 183, y la suite completa pasa (10/10), fijando el comportamiento
actual descrito arriba.

## Decisión que bloquea esta ficha (D-10)

| Opción | Qué implica |
| --- | --- |
| (a) Dejarlo como está | Cero cambio. El comportamiento actual (orden de aparición decide, no `!important`) sigue fijado por el test de equivalencia de MIG-B6-25 |
| (b) Corregirlo | Una declaración `!important` que precede a una normal empezaría a ganar la resolución de referencias — cambio semántico real, con su propia migration guide, en el caso (probablemente raro) de un proyecto con dos definiciones del mismo token donde una usa `!important` |

## Implementación (si se decide (b))

1. Cambiar el comparador en `resolve()` (`reference-integrity.ts`) para que el
   término de `!important` realmente decida — probablemente
   `(b.node.important ? 1 : 0) - (a.node.important ? 1 : 0)` o equivalente,
   verificado contra casos reales de las cuatro combinaciones.
2. Actualizar el caso "important declared before a plain override" de la suite
   de equivalencia de MIG-B6-25 para fijar el **nuevo** comportamiento
   correcto, no el viejo — y verificar que el resto de la suite de
   equivalencia sigue pasando (el oráculo congelado de esa historia representa
   el comportamiento **anterior**, así que este caso específico dejará de
   coincidir con el oráculo a propósito; documentarlo explícitamente para que
   no se lea como una regresión).
3. Migration guide: cualquier proyecto con dos definiciones del mismo custom
   property, una con `!important`, puede ver cambiar cuál gana.

## Fuera de alcance

- Cualquier otro criterio de orden de `resolve()` (selector, orden de
  aparición) — sólo el término de `!important`.

## Pruebas

- (a): ningún cambio de código; el test existente sigue fijando el comportamiento.
- (b): el caso de equivalencia actualizado, más un caso nuevo que confirme la
  dirección contraria (normal antes que `!important`) sigue funcionando igual
  que antes (`!important` sigue ganando, sin importar el orden de escritura).

## Documentación

- `packages/postcss-uxdsl/CHANGELOG.md`, sección `Visual changes` si (b).
- `packages/postcss-uxdsl/docs/migration.md` si (b).

## Criterios de aceptación

- [ ] D-10 respondida por el dueño y citada aquí textualmente antes de implementar.
- [ ] Si (b), el nuevo comportamiento está probado en ambas direcciones de orden
      de escritura.

## Verificación

```bash
node --test packages/postcss-uxdsl/test/reference-integrity-equivalence.test.js
npm --prefix packages/postcss-uxdsl test
```

## Entrega

`fix(FEAT-009): MIG-B7-10 - <resumen según la opción elegida>`

## Registro de implementación y evidencia

Estado: **Bloqueada — esperando D-10**.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente de D-10 |
| Reproducción antes del cambio | Ver arriba, ya ejecutable |
| Criterio → regresión | Pendiente de D-10 |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente de D-10 |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | No aplica |
| Límites y seguimiento | Pendiente |
