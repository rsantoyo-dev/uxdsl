# MIG-B6-22 — Flags estrictos del CLI

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | D — CLI |
| Prioridad · Tamaño | P0 · S |
| Cierra | UX-04. Aplica D-5 |
| Depende de | MIG-B6-01 (`KNOWN_THEME_FAMILIES` exportada) |
| Bloquea | MIG-B6-16 y MIG-B6-21 (sus flags nuevos usan este parseo) |
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

- [ ] Todas las filas de la tabla se cumplen.
- [ ] Ningún flag desconocido pasa en silencio.
- [ ] La lista de familias se importa, no se copia.

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
npm run verify:beta5
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-22 - strict cli flags: true/false values, validated families, unknown options fail`
