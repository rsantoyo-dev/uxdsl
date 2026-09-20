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

- [ ] La reproducción muestra el resumen de mezcla por stderr, y stdout sigue igual.
- [ ] `--contrast` lista los pares de `palette.primary` que no cumplen y sale con 1.
- [ ] La semántica del override está documentada con un ejemplo.

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-16 - theme --diff reports mixed entries, theme --contrast checks the effective theme`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Pendiente de implementación/verificación**
(salvo avances parciales señalados arriba). Completar en el mismo PR conforme al
[protocolo de agentes](README.md#cobertura-y-evidencia-obligatorias). No marcar
criterios por intención ni confundir una reproducción histórica con prueba actual.

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

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
