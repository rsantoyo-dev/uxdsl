# MIG-B7-08 — `theme --diff`: resumen de mezcla para surfaces/buttons/inputs

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P2 · S |
| Cierra | R-11 |
| Depende de | — |
| Bloquea | — |
| Archivos | `packages/uxdsl-cli/bin/uxdsl.js` (`MIXED_ENTRY_FAMILIES`, `summarizeMixedEntries`) |

## Por qué

MIG-B6-16, "Límites y seguimiento" (1):

> El resumen cubre `palette` y `typography_details`, las dos familias que la
> ficha nombra. `surfaces`, `buttons` e `inputs` tienen la misma forma un
> nivel más abajo (sobrescribir `base` y heredar `states`) y quedan como
> seguimiento; la lista está en una constante con nombre para que ampliarla
> sea una línea.

Verificado el 2026-09-22:

```js
// packages/uxdsl-cli/bin/uxdsl.js:1319
const MIXED_ENTRY_FAMILIES = ['palette', 'typography_details'];
```

`summarizeMixedEntries` agrupa por `${familia}.${segundo-nivel}` — para
`palette`/`typography_details` eso es `palette.primary`/`typography_details.h1`.
Para `surfaces`/`buttons`/`inputs`, el segundo nivel es el nombre del rol
(`buttons.contained`), y lo que se mezcla es un nivel más abajo todavía:
`base` sobrescrito con `states` heredado, o viceversa — no es la misma forma
exacta, así que agregar los tres nombres a la constante sin más **no** produce
el resumen correcto; hay que decidir qué segmento agrupar.

## Reproducción

```bash
node -e "
const cli = require('./packages/uxdsl-cli/bin/uxdsl.js');
console.log(cli.summarizeMixedEntries([
  { path: 'buttons.checkout.base.padding', source: 'project' },
  { path: 'buttons.checkout.states.hover.bg', source: 'default' },
]));
"
```

Salida hoy: `[]` (array vacío) — ninguna línea, porque `buttons` no está en
`MIXED_ENTRY_FAMILIES`.

## Resultado esperado

Una entrada de `buttons`/`inputs`/`surfaces` cuyo `base` viene del proyecto y
cuyos `states` (o algún campo de `states`) vienen del default —o viceversa—
produce una línea de resumen en stderr, con la misma redacción que ya usan
`palette`/`typography_details`: `buttons.checkout mixes your values (base) with
base values (states.hover)`, o una forma equivalente que distinga claramente
qué mitad es del proyecto.

## Implementación

1. Decidir el nivel de agrupación correcto para estas tres familias — no es
   `${familia}.${rol}` a secas como palette, es `${familia}.${rol}` pero
   comparando `base` como un bloque contra cada entrada de `states` por
   separado (o el nivel que la reproducción del paso anterior confirme que
   tiene sentido para un humano leyendo el resumen).
2. Generalizar `summarizeMixedEntries` (o añadir una función hermana) sin
   romper el comportamiento ya probado de `palette`/`typography_details` —
   correr los tests existentes de MIG-B6-16 antes y después de cada cambio.
3. Añadir `'surfaces'`, `'buttons'`, `'inputs'` a `MIXED_ENTRY_FAMILIES` sólo
   una vez que la agrupación nueva esté correcta para las tres.

## Fuera de alcance

- Cambiar el formato de stdout de `--diff` — sigue siendo JSON limpio, sin
  tocar.
- `theme --contrast` — no cambia con esta ficha.

## Pruebas

- Casos de `buttons`/`inputs`/`surfaces` con mezcla real, verificando la línea
  exacta de stderr.
- Control negativo: una entrada de estas tres familias completamente del
  proyecto (o completamente default) no produce línea — igual que ya se prueba
  para `palette`.
- Los 8 tests existentes de MIG-B6-16 siguen pasando sin cambios.

## Documentación

- `packages/postcss-uxdsl/README.md`, sección de override parcial: actualizar
  el ejemplo o la lista de familias cubiertas.
- `packages/uxdsl-cli/README.md`, sección de `theme --diff`.

## Criterios de aceptación

- [ ] Una mezcla real en `surfaces`/`buttons`/`inputs` produce línea de resumen.
- [ ] Los tests existentes de `palette`/`typography_details` no cambian de
      comportamiento.
- [ ] Una entrada no mezclada de estas tres familias no produce línea (control
      negativo).

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
npm test
```

## Entrega

`feat(FEAT-009): MIG-B7-08 - theme --diff summarizes mixed surfaces/buttons/inputs entries too`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Pendiente de implementación/verificación**.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | Ver arriba, ejecutada el 2026-09-22 — salida `[]` confirmada |
| Criterio → regresión | Pendiente |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Aditivo — nadie que no use estas tres familias ve cambio |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | No aplica |
| Límites y seguimiento | Pendiente |
