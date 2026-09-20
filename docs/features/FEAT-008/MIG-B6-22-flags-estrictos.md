# MIG-B6-22 — Flags estrictos del CLI

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | D — CLI |
| Prioridad · Tamaño | P0 · S |
| Cierra | UX-04. Aplica D-5 |
| Depende de | MIG-B6-01 (`KNOWN_THEME_FAMILIES` exportada) |
| Bloquea | MIG-B6-12, MIG-B6-16, MIG-B6-18 |
| Archivos | `packages/uxdsl-cli/bin/uxdsl.js` (`main` ~1299-1310, `normalizeStrictThemeScope` ~602, `resolveStrictTheme` ~616, `resolveIncludeTheme` ~577, `themeCommand` ~898, `printHelp` ~110-196, `loadConfig` ~392-398), `packages/uxdsl-cli/test/uxdsl-cli.test.js`, `packages/uxdsl-cli/test/theme-command.test.js` |
| Coordinación | Primero en la secuencia de `uxdsl.js` |

## Por qué

`--strict-theme` se presenta como gate de CI. Hoy puede quedar apagado sin avisar:

- `=true` se interpreta como el nombre de una familia llamada "true";
- una familia mal escrita no se valida;
- `--include-theme=false` se ignora;
- un flag mal escrito se ignora.

Un gate que se apaga en silencio es peor que no tenerlo: el equipo cree estar
protegido.

## Reproducción

```bash
REPO=$(git rev-parse --show-toplevel)   # ejecutar desde cualquier carpeta del repo
d=$(mktemp -d) && cd $d && mkdir src
echo "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css' };" > uxdsl.config.cjs
echo "module.exports = { theme: { palette: { primary: { main: '#00aa00' } } } };" > uxdsl.theme.config.cjs
printf '.a { color: palette(primary); }\n' > src/a.uxdsl
CLI=$REPO/packages/uxdsl-cli/bin/uxdsl.js
node $CLI build --include-theme=false >/dev/null 2>&1; grep -c ':root' out/a.css   # ≥ 1: se emitió el tema (con --no-include-theme da 0)
node $CLI build --strict-theme        >/dev/null 2>&1; echo $?                     # 1 (control)
node $CLI build --strict-theme=true   >/dev/null 2>&1; echo $?                     # 0 (busca la familia "true")
node $CLI build --strict-theme=pallete >/dev/null 2>&1; echo $?                    # 0 (no revisa nada)
node $CLI theme --strict=true         >/dev/null 2>&1; echo $?                     # 0
node $CLI build --strict-thme         >/dev/null 2>&1; echo $?                     # 0 (flag inexistente ignorado)
```

## Causa

- minimist declara como booleanos sólo `watch` y `help` (~1301). `--include-theme=false`
  llega como el string `"false"`, y `resolveIncludeTheme` sólo acepta booleanos.
- `normalizeStrictThemeScope` convierte cualquier string en una lista de familias, sin
  interpretar `true`/`false` y sin validar nombres.
- minimist acepta cualquier flag desconocido.

## Resultado esperado

| Comando | Resultado |
| --- | --- |
| `--include-theme=false` | igual que `--no-include-theme` |
| `--strict-theme` · `--strict-theme=true` | revisa todas las familias tocadas |
| `--strict-theme=false` · `--no-strict-theme` | desactivado |
| `--strict-theme=palette,breakpoints` | revisa sólo esas |
| `--strict-theme=pallete` | error: `Unknown theme family "pallete" in --strict-theme. Did you mean "palette"?` |
| `theme --strict=…` | mismas reglas que `--strict-theme` |
| `--strict-thme` | error: `Unknown option --strict-thme. Did you mean --strict-theme?`, exit 1 |

## Implementación

1. Enumerar los flags válidos **por comando** a partir de `printHelp` y de los
   `argv.*` que lee el código: `entry`/`e`, `out`/`o`, `config`/`c`, `watch`/`w`,
   `help`/`h`, `include-theme`, `strict-theme`, `multi` (init), `src` y `exclude`
   (generate-entry), `diff` y `strict` (theme). MIG-B6-16 agrega `--contrast` y
   MIG-B6-21 agrega `--sourcemap`.
2. minimist:
   - `include-theme` como `boolean`, y verificar que `=false` produzca `false`;
   - `strict-theme` y `strict` como `string`: `''` (flag sin valor) o `'true'` → `true`,
     `'false'` → `false`, el resto → lista de familias;
   - la opción `unknown` junta los flags desconocidos. Sólo cuentan los argumentos que
     empiezan con `-`, no los posicionales.
3. Un flag desconocido produce error con sugerencia (distancia ≤ 2 contra los flags
   de ese comando) y exit 1 (D-5).
4. Los nombres de familia de `--strict-theme`, de `theme --strict` y de `strictTheme`
   en `uxdsl.config.cjs` se validan contra `KNOWN_THEME_FAMILIES` (MIG-B6-01), con
   sugerencia.

## Fuera de alcance

- Cambiar la semántica de `--strict-theme` en sí.

## Pruebas

- Tabla por comando con formas bare/true/false/no-, aliases, flags repetidos
  (última aparición gana), `--` y valores inválidos. Preservar precedencia cuando
  minimist crea un false implícito: flag ausente no debe anular config.
- Para opciones booleanas rechazar `--include-theme=banana` antes de coerción;
  para strict rechazar listas vacías/con elementos vacíos. Comando desconocido y
  opciones válidas sólo para otro comando fallan con ayuda apropiada.
- Nuevos flags de 16/21 se añaden al mismo registro y a su matriz de tests.

- Cada fila de la tabla "Resultado esperado", como test en `uxdsl-cli.test.js` o en
  `theme-command.test.js` (usar la función de parseo expuesta en `module.exports`, o
  procesos hijos).
- `--no-include-theme` sigue funcionando (control).
- Un argumento posicional (una ruta) no se trata como flag desconocido.
- `strictTheme: ['pallete']` en el config da error con sugerencia.

## Documentación

- `packages/uxdsl-cli/README.md` y `printHelp`: valores aceptados por cada flag y el
  error para flags desconocidos.
- `packages/postcss-uxdsl/docs/migration.md`: los scripts que pasaban flags
  inexistentes ahora fallan.
- CHANGELOG beta.6.

## Criterios de aceptación

- [x] Todas las filas de la tabla se cumplen.
- [x] Ningún flag desconocido pasa en silencio.
- [x] La lista de familias se importa, no se copia.

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
npm run verify:beta5
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-22 - strict cli flags: true/false values, validated families, unknown options fail`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada/verificada** en la rama
`feat/feat-008-beta6-plan`, conforme al
[protocolo de agentes](README.md#cobertura-y-evidencia-obligatorias).
Integración (merge a `main`) sigue pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `f742378`; entrega en `097ee88` en `feat/feat-008-beta6-plan`; sin PR abierto todavía |
| Reproducción antes del cambio | El script de la sección "Reproducción" de este archivo, ejecutado contra `f742378`: `--strict-theme=true`/`=pallete` exit 0 (sin efecto), `--strict-thme` exit 0 (flag ignorado), `--include-theme=false` dejaba `:root` en la salida (≥1 aparición) igual que sin el flag. Fecha: 2026-09-20. |
| Criterio → regresión | Cada fila de "Resultado esperado" tiene un test dedicado: `--include-theme=…` → `resolveIncludeTheme coerces…`/`rejects any other string…`/`(subprocess): --include-theme=false emits zero :root…`/`(subprocess): --include-theme=banana is a hard error…`; `--strict-theme`/`=true`/`=false` → `normalizeStrictThemeScope treats the strings "true"/"false"…`/`(subprocess): --strict-theme=true…=false…`; `--strict-theme=palette,breakpoints` → tests preexistentes de MIG-B5-01 (sin regresión, ver Comandos); `--strict-theme=pallete` → `loadConfig rejects an unknown family name…`/`(subprocess): --strict-theme=pallete…`; `theme --strict=…` → todo el bloque MIG-B6-22 en `theme-command.test.js`; `--strict-thme` → `parseCommandArgv rejects a mistyped flag…`/`(subprocess): --strict-thme…`. Todos en `packages/uxdsl-cli/test/uxdsl-cli.test.js` y `theme-command.test.js`. |
| Comandos y entorno | `npm --prefix packages/uxdsl-cli test` (macOS, Node del repo): 119/119, exit 0. `npm run verify:beta5` (5 tarballs reales): 4/4 PASS, exit 0 — confirma que el alcance por familia de MIG-B5-01 y el aviso de familia desconocida de MIG-B5-02 no cambiaron. `npm test` desde la raíz: 307 subtests, 0 fallos, exit 0. Reproducción manual del script completo de la sección "Reproducción" contra el código corregido: todas las filas de "Resultado esperado" confirmadas (ver Resultado después). |
| Resultado después / control negativo | Confirmado manualmente uno por uno: `--include-theme=false` ahora deja 0 `:root` (igual que `--no-include-theme`); `--strict-theme`/`=true` fallan igual (exit 1, misma familia parcial); `--strict-theme=false`/`--no-strict-theme` exit 0; `--strict-theme=pallete` exit 1 con "Did you mean \"palette\"?"; `theme --strict=true`/`=false`/`=pallete` mismo comportamiento que su equivalente de build; `--strict-thme` exit 1 con "Did you mean --strict-theme?"; `--include-theme=banana` exit 1 con mensaje explícito; `build --strict` (flag de otro comando) exit 1 "Unknown option --strict." sin sugerencia (fuera de distancia 2); comando desconocido con flags (`bogus --whatever`) sigue mostrando solo "Unknown command: bogus", no ruido de flags; un positional no se trata como flag desconocido; flags repetidos resuelven a la última aparición (regresión encontrada y corregida durante esta misma story: minimist agrupa repeticiones en un array por defecto). |
| Cambios visuales o API / migración | No hay cambios visuales. Cambio de comportamiento del CLI (no de API de paquete): documentado en `packages/postcss-uxdsl/docs/migration.md` (sección "Desde beta.6: flags del CLI estrictos") y en `packages/uxdsl-cli/README.md` (sección "Strict flag parsing"). No se creó `packages/uxdsl-cli/CHANGELOG.md`: el paquete no mantiene ese archivo hoy (no existe en el repo); crear uno de cero es una decisión de higiene de paquete fuera del alcance de esta story — señalado también como límite abajo. |
| README / CHANGELOG / migration | `packages/uxdsl-cli/README.md` §"Strict flag parsing" (tabla de formas aceptadas + ejemplos de error); `packages/uxdsl-cli/bin/uxdsl.js`'s `printHelp()` (nota breve + referencia al README); `packages/postcss-uxdsl/docs/migration.md` nueva sección "Desde beta.6: flags del CLI estrictos (MIG-B6-22)". Sin `packages/uxdsl-cli/CHANGELOG.md` (ver fila anterior). |
| AGENTS / guías / arquitectura | Sin cambio de contrato de AGENTS.md ni de arquitectura compartida; `KNOWN_THEME_FAMILIES` se sigue importando desde `postcss-uxdsl/ds-runtime` (MIG-B6-01), no se copia ni se reimplementa. |
| Límites y seguimiento | No se implementó `--contrast` (MIG-B6-16) ni `--sourcemap` (MIG-B6-21) — el registro `COMMAND_FLAG_SPECS`/`manual` queda preparado como el único punto de extensión para que esas stories agreguen su flag ahí, según pide la Implementación. No se creó un `CHANGELOG.md` nuevo para `uxdsl-cli` (el paquete no tenía uno); si una story de higiene de paquetes (p. ej. MIG-B6-28) decide que debería tenerlo, ese es el lugar para iniciarlo. El detector de sugerencias (`closestMatch`) es una duplicación deliberada de `closestKey` de `postcss-uxdsl/src/diagnostics.ts`, no una reexportación — ese módulo no tiene un punto de export público que un dependiente pueda importar (el export de `postcss-uxdsl` es únicamente la función del plugin PostCSS); documentado en el comentario junto a la función. |

Si cambia un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
