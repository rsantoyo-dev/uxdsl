# MIG-B7-07 — Higiene de paquetes, ronda 2

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P2 · S |
| Cierra | R-08, R-09, R-10 (seguimiento, no fix) |
| Depende de | — |
| Bloquea | — |
| Archivos | Nuevo `LICENSE` (raíz), `packages/vite-plugin-uxdsl/README.md`, `packages/uxdsl-cli/README.md` (nota de seguimiento) |

## Por qué

Tres residuos pequeños de MIG-B6-28, cada uno con su cita exacta:

1. **Sin `LICENSE`**, "Límites y seguimiento" (7): "La falta de un archivo
   `LICENSE` en el repo [...] sigue sin resolverse; los README de los 5
   paquetes siguen enlazando a un `LICENSE` que no existe."
2. **Imagen relativa en `vite-plugin-uxdsl`**, (5): "`vite-plugin-uxdsl/README.md`
   tiene el mismo patrón de imagen relativa (`<img src="./assets/logo-uxdsl.png">`)
   que se corrigió en `postcss-uxdsl` — no se tocó aquí [...] queda como gap
   conocido, no silencioso."
3. **`postcss-advanced-variables` en `^3`**: no es un fix — es mantener la nota
   de seguimiento actualizada. Confirmado el 2026-09-22 (ver README del CLI,
   sección 9) que `^4`/`^5` siguen rompiendo el mismo patrón de `@mixin`. Esta
   ficha sólo revisa si una versión más nueva (5.x.y posterior) resuelve el
   problema — no reintenta la misma versión ya probada.

## Implementación

1. **`LICENSE`**: los 5 `package.json` declaran `"license": "MIT"` (verificado).
   Añadir el archivo `LICENSE` en la raíz con el texto estándar MIT, año y
   titular reales — confirmar con el dueño el nombre exacto a usar antes de
   escribirlo (no asumir "Ricardo Santoyo" sin confirmación, aunque sea el
   autor de los commits).
2. **Imagen relativa**: aplicar exactamente el mismo cambio que MIG-B6-28 ya
   hizo en `postcss-uxdsl/README.md` (URL absoluta de GitHub en vez de ruta
   relativa) a `packages/vite-plugin-uxdsl/README.md`.
3. **`postcss-advanced-variables`**: repetir la comprobación del `@mixin` con
   la versión más reciente disponible en ese momento (no necesariamente 5.0.0,
   que ya se probó); si sigue rompiendo, no hay nada que hacer más que
   mantener la nota actualizada con la fecha y versión de la última
   comprobación.

## Fuera de alcance

- Migrar a una alternativa de `postcss-advanced-variables` — no está pedido ni
  evaluado en esta ficha.
- Cualquier otro README fuera de los dos archivos listados.

## Pruebas

- `npm run verify:pack-budget`: el `LICENSE` nuevo debe aparecer en el tarball
  de cada paquete que lo declare en `files` (o confirmar que `npm pack`
  incluye `LICENSE` automáticamente sin necesidad de listarlo — verificar,
  no asumir).
- Verificar que el enlace a `LICENSE` en cada README de paquete resuelve
  correctamente una vez publicado (URL absoluta o relativa según corresponda).

## Documentación

- Los propios archivos tocados son la documentación.
- `packages/uxdsl-cli/README.md`, sección 9: actualizar la fecha y el
  resultado de la reverificación de `postcss-advanced-variables`.

## Criterios de aceptación

- [ ] Existe `LICENSE` en la raíz, con contenido MIT real.
- [ ] `vite-plugin-uxdsl/README.md` usa URL absoluta para su imagen, igual que
      `postcss-uxdsl`.
- [ ] La sección 9 del README del CLI tiene fecha y versión de la
      reverificación más reciente de `postcss-advanced-variables`.

## Verificación

```bash
npm run verify:pack-budget
npm run verify:docs
```

## Entrega

`chore(FEAT-009): MIG-B7-07 - add LICENSE, fix vite-plugin-uxdsl's relative image, re-check postcss-advanced-variables`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Pendiente de implementación/verificación**.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | `test -f LICENSE` → no existe (verificado 2026-09-22); `grep 'src="./assets' packages/vite-plugin-uxdsl/README.md` → coincide |
| Criterio → regresión | Pendiente |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | No aplica |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | No aplica |
| Límites y seguimiento | Pendiente |
