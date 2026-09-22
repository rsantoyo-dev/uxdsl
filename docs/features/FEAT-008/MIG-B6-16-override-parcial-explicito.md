# MIG-B6-16 — Override parcial explícito

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | B — Tema base y salida correcta |
| Prioridad · Tamaño | P1 · S |
| Cierra | UX-08 |
| Depende de | MIG-B6-29 (`checkThemeContrast`), MIG-B6-22 (flags), MIG-B6-21 (orden del CLI) |
| Bloquea | MIG-B6-12 |
| Archivos | `packages/uxdsl-cli/bin/uxdsl.js` (`themeCommand` ~898, `diffThemeAgainstDefaults` ~868, `diffThemeSubtree` ~846), `packages/uxdsl-cli/test/theme-command.test.js`, READMEs |
| Coordinación | Último en la secuencia de `uxdsl.js` (22 → 18 → 19 → 24 → 23 → 21 → 16) |

## Por qué

**Decisión D-1:** el merge por clave es la filosofía del producto (tema base más
override de lo necesario). No se deriva `dark` y el build no avisa.

Lo que la auditoría señaló sigue siendo real. Quien sobrescribe sólo
`palette.primary.main` conserva el `dark` y el `contrast` del tema base: el hover de
su botón verde sale morado, y nadie se lo dice. La solución respetando D-1 es hacerlo
**explícito y verificable**, sin ruido en el build.

## Reproducción

```bash
REPO=$(git rev-parse --show-toplevel)   # ejecutar desde cualquier carpeta del repo
d=$(mktemp -d) && cd $d && mkdir src && touch src/uxdsl-entry.uxdsl
echo "module.exports = { theme: { palette: { primary: { main: '#00aa00' } } } };" > uxdsl.theme.config.cjs
node $REPO/packages/uxdsl-cli/bin/uxdsl.js theme --diff
```

Salida actual: filas JSON `{ path, value, source }` en las que `palette.primary.main`
es `project` y `dark`/`contrast` son `default`. No hay resumen de la mezcla ni forma
de verificar el contraste resultante. El par `#00aa00`/`#ffffff` (main/contrast) da
aproximadamente 3.1:1, por debajo de AA.

## Resultado esperado

- `uxdsl theme --diff` imprime por **stderr** un resumen de las entradas de registro
  que mezclan valores del proyecto y del tema base:
  `[uxdsl] palette.primary mixes your values (main) with base values (dark, contrast)`.
  El JSON de stdout no cambia: ya lo consumen scripts.
- `uxdsl theme --contrast` ejecuta `checkThemeContrast` (MIG-B6-29) sobre el tema
  efectivo del proyecto. Imprime en stdout un reporte JSON
  con el tipo compartido de 29 (`passed`, `failures`, `exceptions`, contexto de
  modo/fondo/breakpoint y causa de valores unresolved), y
  sale con código 1 si hay fallos. No forma parte de `build`.

## Implementación

1. Calcular la mezcla por entrada de registro: por cada `palette.<familia>` y cada
   `typography_details.<tag>` con filas `project` y `default` a la vez.
2. Imprimir el resumen por stderr, respetando la regla de `themeCommand` de dejar
   stdout como JSON limpio.
3. Agregar `--contrast` al parseo estricto de 22. No combinar con `--diff` ni
   `--strict`: error claro sin mezclar dos formatos de stdout. Errores de carga van
   por stderr; un reporte de contraste válido se imprime completo aunque falle.
4. Documentar la semántica del override en el README de `postcss-uxdsl`, sección de
   defaults: sobrescribir `main` conserva `dark` y `contrast`, y para cambiar el hover
   también hay que sobrescribir `dark`. Con un ejemplo.

## Fuera de alcance

- Derivar variantes o avisar en `build` (D-1).
- Cambiar el formato de stdout de `--diff`.

## Pruebas

- JSON stdout parseable; logs sólo stderr. Modo oscuro, placeholder y estado
  selected incluidos. Valor unresolved sale con 1; excepción exacta de base se
  enumera, override que cambia ese par deja de heredar la excepción.

En `packages/uxdsl-cli/test/theme-command.test.js`:

- `--diff` con el tema de la reproducción: stdout sin cambios; stderr contiene la
  línea de `palette.primary`.
- `--contrast` con el mismo tema: exit 1, y el reporte incluye
  `palette.primary contained main/contrast` con un ratio menor que 4.5.
- `--contrast` sin tema (tema base): exit 0 si el gate de MIG-B6-29 pasa, o con las
  excepciones declaradas.
- Un flag combinado no soportado da error claro.

## Documentación

- `packages/postcss-uxdsl/README.md` y `packages/uxdsl-cli/README.md`.
- `packages/postcss-uxdsl/docs/migration.md`: "cómo verificar el contraste de tu
  override".
- CHANGELOG beta.6.

## Criterios de aceptación

- [x] La reproducción muestra el resumen de mezcla por stderr, y stdout sigue igual.
      → `[uxdsl] palette.primary mixes your values (main) with base values (light,
      dark, contrast)`. Nota: la ficha escribía `(dark, contrast)`; el tema base
      también define `light`, así que la línea real lo incluye.
- [x] `--contrast` lista los pares de `palette.primary` que no cumplen y sale con 1.
      → 18 fallos con `tone: primary`, entre ellos el par ~3,11:1 que la propia
      ficha predecía, y salida con código 1.
- [x] La semántica del override está documentada con un ejemplo.
      → `packages/postcss-uxdsl/README.md`, sección "What a partial override
      actually inherits", con el caso verde/morado completo.

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-16 - theme --diff reports mixed entries, theme --contrast checks the effective theme`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente** en
`feat/feat-008-beta6-plan`. Integración a `main` pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `80dedad` (2026-09-22, HEAD de la rama al iniciar). Entrega: commit siguiente en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | La reproducción literal de la ficha, ejecutada tal cual: `uxdsl theme --diff` imprime las filas JSON con `palette.primary.main` en `project` y `light`/`dark`/`contrast` en `default`, y **stderr queda vacío** — ninguna señal de que la familia está mezclada. `uxdsl theme --contrast` respondía `Unknown option --contrast` y salía con 1. 2026-09-22 |
| Criterio → regresión | Ocho tests nuevos en `packages/uxdsl-cli/test/theme-command.test.js`, todos con captura separada de stdout y stderr: el resumen de mezcla aparece en stderr y stdout sigue parseando como JSON; una familia sobrescrita por completo **no** genera línea (control negativo, para que el resumen sea señal y no ruido); los roles tipográficos se resumen igual; `--contrast` sobre el override parcial sale con error, nombra los pares de `primary` y comprueba que cada fallo lleva modo, estado, breakpoint, ratio y razón; `--contrast` sobre el tema base enumera la excepción publicada y la marca `matched: true`; sobrescribir el color exacto de esa excepción la deja `matched: false` y la reporta como obsoleta; combinar `--contrast` con `--diff` o con `--strict` falla sin imprimir nada; y `--contrast` deja stdout como un único documento JSON |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0: `npm --prefix packages/uxdsl-cli test` (exit 0, **171/171**, +8), `npm test` (exit 0, **676** líneas `ok`, antes 668), `npm run verify:beta5` y `npm run verify:consumer-fixture` (exit 0) |
| Resultado después / control negativo | stderr: `[uxdsl] palette.primary mixes your values (main) with base values (light, dark, contrast)`; stdout sigue dando 52 filas JSON parseables. `--contrast` sale con 1 y reporta 172 pares fallidos para ese tema, 18 de ellos con `tone: primary`, incluido el ~3,11:1 que la ficha predecía. **Controles negativos**: (1) una familia completamente sobrescrita no produce línea de mezcla; (2) `--contrast` combinado con `--diff` o `--strict` falla **antes** de escribir nada en stdout; (3) sobrescribir el color de la excepción publicada la vuelve obsoleta en vez de seguir disculpando un par ya cambiado. **Corrección sobre la marcha**: el primer texto de ayuda que escribí contenía backticks dentro del template literal de `--help` y rompía el parseo del propio CLI (`SyntaxError: missing ) after argument list`); además duplicaba la sección "Theme Options" que ya existía. Ambos corregidos y verificados ejecutando `--help` |
| Cambios visuales o API / migración | Sin cambio visual. API del CLI aditiva: `--contrast` es nuevo y `--diff` gana una línea en **stderr**, deliberadamente no en stdout, porque el contrato de `uxdsl theme` es que stdout sea JSON limpio para `\| jq` y scripts. Ningún consumidor existente cambia de comportamiento. No aplica migración |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md`: nueva sección "What a partial override actually inherits" con el ejemplo verde/morado, las dos órdenes y la advertencia de que el tema base aún no pasa su propia puerta. `packages/uxdsl-cli/README.md`: "Verifying a partial override (`theme --diff`, `theme --contrast`)". `packages/postcss-uxdsl/docs/migration.md`: "Cómo verificar el contraste de tu override". `packages/postcss-uxdsl/CHANGELOG.md`: entrada MIG-B6-16. Ayuda del CLI (`--help`) ampliada en la sección "Theme Options" que ya existía, no en una segunda |
| AGENTS / guías / arquitectura | Sin cambio de contrato: la decisión D-1 (merge por clave, sin derivar variantes ni avisar en `build`) se mantiene intacta; esta historia sólo la hace visible y verificable bajo demanda. `AGENTS.md` ya describe Palette y el contraste (`checkThemeContrast`) correctamente y no necesitaba edición |
| Límites y seguimiento | (1) **El resumen cubre `palette` y `typography_details`**, las dos familias que la ficha nombra. `surfaces`, `buttons` e `inputs` tienen la misma forma un nivel más abajo (sobrescribir `base` y heredar `states`) y quedan como seguimiento; la lista está en una constante con nombre para que ampliarla sea una línea. (2) **El tema base publicado no pasa `--contrast`**: 156 fallos con las excepciones aplicadas, que son las tres brechas de motor/arquitectura que MIG-B6-29 fase 3 dejó abiertas y documentadas. El test lo fija como está en vez de afirmar `passed: true`, y fallará —obligando a revisarlo— cuando se cierren. Es información real, no un fallo de esta historia, pero significa que un usuario de cero configuración ve fallos ajenos en su primera ejecución; por eso se advierte en los tres documentos. (3) **Sin verificación en navegador**: es una orden de CLI que imprime JSON; no hay salida visual que comprobar |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
