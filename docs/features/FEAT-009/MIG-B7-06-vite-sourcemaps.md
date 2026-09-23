# MIG-B7-06 — Sourcemaps de Vite: investigar y cerrar si es posible

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P1 · M |
| Cierra | R-07 |
| Depende de | — |
| Bloquea | — |
| Archivos | `packages/vite-plugin-uxdsl/src/index.ts`, `fixtures/vite-adapter/run.js` |

## Por qué

`packages/vite-plugin-uxdsl/README.md`, sección "Source maps":

> **Not advertised as supported.** When Vite's own `build.sourcemap` (or
> `css.devSourcemap`) is on, this plugin does hand Vite a correct source map
> [...] The plugin never returns a CSS map as the source map of a JavaScript
> module. Use the CLI (`uxdsl build --sourcemap`) or the Webpack loader, both
> of which have verified map support, if source maps are a requirement today.

MIG-B6-21 (FEAT-008) verificó con la fixture real que Vite no encadena el mapa
hasta el asset CSS emitido, y decidió correctamente **no anunciar** soporte que
no estaba probado — pero no investigó **por qué** Vite lo descarta, porque esa
investigación no era parte de su alcance.

## Objetivo

Determinar la causa exacta de por qué Vite no propaga el mapa que el plugin sí
entrega correctamente, y arreglarlo si el arreglo está dentro del plugin — no
forzar un cambio en el propio Vite.

## Reproducción

```bash
node fixtures/vite-adapter/run.js
```

Imprime hoy una nota explícita de que Vite no propaga la fuente `.uxdsl` y
escribe `vite-sourcemap-result.txt` con el resultado exacto — punto de partida
de esta investigación, no algo que reproducir desde cero.

## Implementación

1. Releer `fixtures/vite-adapter/run.js` y su nota exacta antes de tocar nada
   — probablemente ya indica en qué punto del pipeline de Vite se pierde el
   mapa.
2. Confirmar si el plugin devuelve el mapa en el formato/momento que la API de
   plugins de Vite espera (`transform` debe devolver `{ code, map }`, y para
   CSS específicamente Vite tiene su propio pipeline de post-procesamiento que
   puede regenerar o descartar mapas entrantes según su configuración interna).
3. Probar con distintas configuraciones de Vite (`css.devSourcemap: true` vs
   `build.sourcemap` en modo build vs dev server) — el comportamiento puede
   diferir entre ellos y la fixture actual puede sólo cubrir uno.
4. Si la causa es un defecto corregible en cómo el plugin entrega el mapa,
   corregirlo y volver a correr la fixture hasta que la consulta de posición
   real funcione, igual que ya funciona para Webpack.
5. Si la causa es una limitación real de la versión de Vite instalada o de su
   arquitectura (por ejemplo, Vite regenera el mapa de CSS en su propio paso de
   optimización y no hay forma de que un plugin lo evite), documentar
   exactamente eso, con la versión de Vite probada, y dejar la fixture como
   evidencia permanente de la limitación real — no reintentar indefinidamente
   sin nueva información.

## Fuera de alcance

- Cambiar Vite mismo o pedir un fix upstream (se puede reportar, no forzar).
- Sourcemaps del CSS de tema generado en runtime (`ds-runtime`) — mismo límite
  que ya declaró MIG-B6-21, no cambia aquí.

## Pruebas

- La fixture existente, extendida: si se encuentra un fix, una consulta de
  posición real (`SourceMapConsumer`) debe resolver a la línea correcta del
  `.uxdsl`, igual que ya lo hace la fixture de Webpack.
- Si no hay fix, la fixture documenta la versión de Vite probada y el punto
  exacto del pipeline donde se pierde el mapa, de forma que una versión futura
  de Vite pueda volver a probarse sin reinvestigar desde cero.

## Documentación

- `packages/vite-plugin-uxdsl/README.md`: actualizar la sección "Source maps"
  con el resultado — anunciar soporte si se corrigió, o documentar la causa
  exacta y la versión probada si sigue sin funcionar.
- `packages/postcss-uxdsl/CHANGELOG.md` si hay cambio de comportamiento.

## Criterios de aceptación

- [ ] La causa exacta está documentada, con la versión de Vite probada.
- [ ] Si es corregible dentro del plugin, está corregido y la fixture lo prueba
      con una consulta de posición real.
- [ ] Si no es corregible, el README lo dice explícitamente y por qué, sin
      dejarlo como "pendiente" sin explicación.

## Verificación

```bash
node fixtures/vite-adapter/run.js
npm --prefix packages/vite-plugin-uxdsl test
```

## Entrega

`fix(FEAT-009): MIG-B7-06 - <resumen según el resultado de la investigación>`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Pendiente de implementación/verificación**.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | `node fixtures/vite-adapter/run.js`, resultado actual documentado en `vite-sourcemap-result.txt` |
| Criterio → regresión | Pendiente |
| Comandos y entorno | Pendiente, incluir versión exacta de Vite probada |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente; probablemente no aplica salvo que se corrija el soporte |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | Pendiente |
| Límites y seguimiento | Pendiente |
