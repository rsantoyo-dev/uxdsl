# MIG-B7-09 — Limpieza del playground

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P2 · S-M |
| Cierra | R-12, R-13, R-14 |
| Depende de | — |
| Bloquea | — |
| Archivos | `packages/playground-nextjs/src/components/ThemeProvider.tsx` (eliminar), `packages/playground-nextjs/src/app/InlineStyles.tsx` (eliminar), `packages/playground-nextjs/scripts/audit-themes.mjs`, nuevo arnés de tests de componente |

## Por qué

Tres residuos de MIG-B6-30, cada uno independiente entre sí:

1. **Archivos muertos**, "Límites y seguimiento" (6): "Dos archivos muertos
   detectados y no tocados (`src/components/ThemeProvider.tsx`,
   `src/app/InlineStyles.tsx`): no los importa nadie, borrarlos es limpieza
   ajena a esta historia."
2. **Script roto preexistente**, citado en MIG-B6-29 fase 1, (8):
   "`packages/playground-nextjs/scripts/audit-themes.mjs` tiene un
   `SyntaxError` real y preexistente (`Unexpected token 'const'`), sin
   relación con esta historia."
3. **Sin arnés de tests de componente**, MIG-B6-30 (2): "El playground no
   tiene arnés de tests de componente, así que `ThemeContext.tsx` no tiene
   tests unitarios; por eso la lógica con sustancia (el batching) se extrajo
   a `src/lib/theme-scheduler.js`."

## Implementación

1. **Confirmar que los dos archivos siguen sin importarse** (repetir el `grep`
   exhaustivo que MIG-B6-30 ya hizo, por si algo cambió desde entonces) y
   borrarlos.
2. **Reproducir y arreglar el `SyntaxError`** de `audit-themes.mjs` —
   diagnóstico primero (¿sintaxis de módulo ESM mal declarada? ¿top-level
   `await` sin soporte?), luego el fix mínimo. Correr el script después del
   fix para confirmar que hace lo que su nombre promete, no sólo que ya no
   lanza.
3. **Elegir un arnés de tests de componente** (React Testing Library es el
   candidato estándar para Next.js; confirmar que no colisiona con nada del
   setup existente antes de instalarlo) y escribir al menos los tests que
   `ThemeContext.tsx` necesita: inicialización, `switchTheme`, `setCustomTheme`
   con `replace`, y que un tema rechazado no reemplaza el aplicado — el mismo
   contrato que ya prueban los tests de motor de `applyTheme`, pero ejercitando
   el componente React real, no sólo el runtime que envuelve.

## Fuera de alcance

- Migrar `BreakpointsProvider` fuera del adaptador legacy de breakpoints — eso
  exige recompilar y es exactamente la capacidad que `applyTheme` rechaza a
  propósito (MIG-B6-30, límite (4)); no forma parte de esta limpieza.
- Cualquier cambio visual o de comportamiento del playground — esta ficha es
  limpieza y cobertura de tests, no una feature.

## Pruebas

- Build de producción del playground sigue en verde después de borrar los dos
  archivos muertos (control negativo de que de verdad no los usa nadie).
- `audit-themes.mjs` corre sin error y produce la salida que su propósito
  declarado espera.
- Los tests nuevos de `ThemeContext.tsx` fallan contra una versión del
  componente con un bug introducido deliberadamente (por ejemplo, revertir el
  fix de la doble sección `case 'purple'` que MIG-B6-30 ya corrigió) y pasan
  con el código actual — así se confirma que el arnés realmente prueba algo.

## Documentación

- `packages/playground-nextjs/README.md` (si existe) o un comentario en
  `package.json`: cómo correr los tests de componente nuevos.

## Criterios de aceptación

- [ ] Los dos archivos muertos ya no existen; el build sigue pasando.
- [ ] `audit-themes.mjs` corre sin `SyntaxError` y hace lo que su nombre promete.
- [ ] `ThemeContext.tsx` tiene tests de componente reales, con al menos un
      control negativo que confirma que detectan una regresión real.

## Verificación

```bash
npm --prefix packages/playground-nextjs run build
node packages/playground-nextjs/scripts/audit-themes.mjs
npm --prefix packages/playground-nextjs test   # una vez exista el script
```

## Entrega

`chore(FEAT-009): MIG-B7-09 - remove dead playground files, fix audit-themes.mjs, add a component test harness`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Pendiente de implementación/verificación**.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | Grep de MIG-B6-30 (ningún import de los dos archivos); `SyntaxError` de `audit-themes.mjs` citado en MIG-B6-29 |
| Criterio → regresión | Pendiente |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | No aplica |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | No aplica |
| Límites y seguimiento | Pendiente |
