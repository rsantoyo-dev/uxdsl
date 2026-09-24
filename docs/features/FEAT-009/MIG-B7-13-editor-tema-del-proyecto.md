# MIG-B7-13 — Editor: completado y hover según el tema del proyecto

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P2 · L |
| Estado | **Bloqueada — esperando decisión del dueño (D-11)** |
| Cierra | R-18 |
| Depende de | D-11. Sus dependencias técnicas (MIG-B6-13, MIG-B6-18, MIG-B6-26) ya están integradas |
| Bloquea | — (opcional para `rc.1`, según D-11) |
| Archivos | Provisional, hasta que D-11 se responda: un servicio de lenguaje en `postcss-uxdsl/language`, `packages/uxdsl-vscode/src/*`, `scripts/generate-language-artifacts.js` |

## Por qué

Es el "siguiente feature" que FEAT-008 dejó explícitamente fuera. Fuentes
exactas:

- MIG-B6-26, "Fuera de alcance": *"Completado según el tema del proyecto,
  diagnósticos en vivo, hover por breakpoint, ir a la definición e IntelliSense
  de CSS dentro de `.uxdsl`. Van a MIG-B6-08, después de 0.5.0."*
- MIG-B6-26, "Límites y seguimiento" (6): *"El completado de roles/tonos/tamaños
  usa el tema **por defecto** del compilador, no el tema real de un proyecto —
  declarado como gap conocido en el README de la extensión."*
- `FEAT-008-beta6-reliability.md`: *"MIG-B6-08 Tooling con conciencia del tema /
  LSP → Siguiente feature. Depende de MIG-B6-13, MIG-B6-18 y MIG-B6-26."*
- README de `uxdsl-vscode`: el completado es *"accurate for a project that
  hasn't customized those families, not necessarily for one that has"*.

Para un consumidor eso significa: una app con roles o tones propios
(`@ds-button(checkout)`) no los ve sugeridos, y sí ve sugeridos los del tema por
defecto aunque su tema los haya cambiado. [MIG-B7-12](MIG-B7-12-editor-support-consumidores.md)
entrega la línea base y **documenta** ese límite; esta story es la que lo
elimina.

## Por qué está bloqueada

FEAT-009 dice explícitamente, en "Qué NO entra aquí", que FEAT-007 (incluye
MIG-B6-08) sigue re-apuntada a después de `0.5.0`. Traer esta story es **revertir
esa decisión ya aprobada**, y eso es del dueño, no de un agente. Ver **D-11** en
el documento padre.

## Contrato heredado (no se reescribe aquí)

El diseño ya está escrito en
[FEAT-007, MIG-B6-08](../FEAT-007-beta6-pre1-foundations.md). Resumen de lo que
importa para decidir D-11:

- Una API de servicio de lenguaje, segura para browser/Node, que devuelva
  completados, hover y diagnósticos estructurados — para que la extensión **no
  vuelva a implementar reglas con regex independientes** (misma regla de una sola
  fuente de verdad que el resto del motor).
- **Descubrir config y tema sin ejecutar código no confiable dentro del
  extension host.** Ésta es la restricción que más pesa: `uxdsl.theme.config.cjs`
  es JavaScript ejecutable. El contrato lista "ejecución arbitraria de `.cjs` no
  confiable" como **no incluido**. El diseño tiene que decidir, con evidencia,
  qué hacer con un tema `.cjs` (por ejemplo: soportar sólo `uxdsl.theme.json`,
  exigir Workspace Trust, o delegar en el propio CLI del proyecto, que ya resuelve
  el tema efectivo para el build — no verificado aquí si `uxdsl theme` sirve
  como fuente).
- MVP acotado: completado theme-aware (Palette, Density, Spacing, Radius, Shadow
  y roles), hover con nombre lógico / variable emitida / valor, **status visible
  cuando no se pudo cargar el tema** y **fallback a defaults etiquetado
  "default", nunca silencioso**.
- Fuera del MVP: rename, formatter, semantic tokens avanzados, configs remotas,
  publicación automática.

Si D-11 = (a), esta ficha se completa (Implementación, Pruebas, Criterios y
Registro) tomando ese contrato como base, **antes** de escribir código.

## Pruebas heredadas (fixtures de proyecto)

Zero-config, tema JSON, CJS simple, config inválida, multi-entry, roles propios,
archivo importado, y un buffer con error sin guardar. Se conservan porque son
justo los casos donde el completado por defecto se equivoca.

## Fuera de alcance

- Diagnósticos en vivo, ir a la definición, IntelliSense de CSS dentro de
  `.uxdsl`: mismo contrato, pero fuera del MVP que D-11 evaluaría.
- Publicar la extensión (MIG-B7-05).

## Registro de implementación y evidencia

Estado de esta revisión documental: **Bloqueada — esperando D-11**. No empezar
antes de la respuesta.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | Pendiente — un proyecto con un rol propio (`@ds-button(checkout)`) y comprobar qué sugiere la extensión |
| Criterio → regresión | Pendiente |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | Pendiente |
| Límites y seguimiento | Pendiente |
