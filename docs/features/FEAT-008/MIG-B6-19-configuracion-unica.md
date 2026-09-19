# MIG-B6-19 — Configuración única de tema y breakpoints

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | C — Un solo pipeline |
| Prioridad · Tamaño | P1 · M |
| Cierra | UX-13, UX-14 |
| Depende de | MIG-B6-18 |
| Bloquea | MIG-B6-20, MIG-B6-24, MIG-B6-27 (`defineConfig` vive en el mismo entry) |
| Archivos | `packages/uxdsl-cli/bin/uxdsl.js` (`CONFIG_CANDIDATES` ~76, `THEME_CANDIDATES` ~86, `findConfigPath` ~204, `findThemeConfigPath` ~212, `loadModuleExport` ~222, `normalizeThemeExport` ~237, `loadThemeConfig` ~295, `loadConfig` ~329-575, `resolveBreakpoints` ~630, `init` ~1144-1245), nuevo `packages/postcss-uxdsl/src/config.ts`, `packages/postcss-uxdsl/package.json` (exports), `packages/postcss-uxdsl/src/index.ts` (sólo la entrada de opciones del plugin), `fixtures/mig-b2-03-cli-init/` |
| Coordinación | Tercero en la secuencia de `uxdsl.js`. En `index.ts` sólo toca la lectura de opciones al inicio de `uxdslPlugin`; hacerlo en un commit chico y rebasar sobre la story de `index.ts` que esté en curso |

## Por qué

Cada adaptador resuelve la configuración a su manera:

- el CLI descubre `uxdsl.config.cjs` y `uxdsl.theme.config.*`;
- el plugin PostCSS no descubre nada, así que en Next.js valida contra el tema por
  defecto;
- Vite y Webpack no leen el tema del proyecto.

Además, `init` escribe `breakpoints` completos en el config, y esos valores anulan,
clave por clave, los del tema, sin aviso.

## Reproducción

**UX-13:**

```bash
REPO=$(git rev-parse --show-toplevel)   # ejecutar desde cualquier carpeta del repo
d=$(mktemp -d) && cd $d && echo '{"name":"x","version":"1.0.0"}' > package.json
node $REPO/packages/uxdsl-cli/bin/uxdsl.js init >/dev/null
grep -n breakpoints uxdsl.config.cjs            # 7:  breakpoints: {"xs":0,"sm":480,"md":768,"lg":1024,"xl":1280},
echo "module.exports = { theme: { breakpoints: { md: 900 } } };" > uxdsl.theme.config.cjs
printf '.a { padding: xs(1rem) md(2rem); }\n' > src/uxdsl-entry.uxdsl
node $REPO/packages/uxdsl-cli/bin/uxdsl.js build >/dev/null && grep -o 'min-width: [0-9]*px' src/uxdsl.css | sort -u
```

La salida incluye `min-width: 768px`; `900px` no aparece. Pasa igual con y sin
`--multi`.

**UX-14:** el snippet que escribe `init` para Next.js (`POSTCSS_SNIPPET`, ~1223) es
`{ 'postcss-uxdsl': { includeTheme: false } }`, sin tema. Un `.css` normal con
`palette(secondary)` definido en el tema del proyecto falla con
`UXD_REFERENCE_MISSING`, porque se valida contra el tema por defecto.

## Resultado esperado

- Un único cargador, usado por el CLI, core, los adaptadores y el propio plugin.
- `init` no escribe breakpoints.
- Un conflicto entre configuración y tema avisa.

## Implementación

1. Crear `postcss-uxdsl/config` (`src/config.ts`, exportado en `package.json`) con
   la resolución que hoy está en el CLI: candidatos, carga del módulo,
   `normalizeThemeExport`, `warnIfLooksLikeBuildConfig` y `references`. Vive en
   `postcss-uxdsl` porque el plugin lo necesita y el plugin no depende de core. El
   CLI conserva sólo el manejo de flags.
2. **Descubrimiento en el plugin:** si `opts.theme === undefined` y
   `opts.discoverTheme !== false`, cargar el tema con el cargador, desde
   `opts.configRoot ?? process.cwd()`.
   - Tiene que ser **síncrono**: el factory del plugin es síncrono y hay usos con
     `.process().css`. Soportar `.cjs`, `.json` y `.js` CommonJS con `require`. Un
     tema ESM exige pasar `theme` explícito, con un error claro que lo diga.
   - Registrar el archivo de tema como dependencia
     (`result.messages.push({ type: 'dependency', plugin: 'postcss-uxdsl', file })`),
     para que Next, Vite y Webpack lo vigilen.
3. **`init`:** quitar `breakpoints:` de las dos plantillas (~1164-1190). Actualizar
   `fixtures/mig-b2-03-cli-init/`, que compara la salida de `init`.
4. **Conflicto:** en `resolveBreakpoints`, si el config y el tema definen la misma
   clave con valores distintos, avisar una vez nombrando los dos archivos. El config
   sigue ganando, como hoy.
5. Actualizar el comentario de `POSTCSS_SNIPPET`: con el descubrimiento, el snippet
   valida contra el tema del proyecto sin cambios.

## Fuera de alcance

- Migrar Vite y Webpack al cargador (MIG-B6-20).
- Cambiar la precedencia config > tema.

## Pruebas

- `packages/postcss-uxdsl/test/config.test.js`: candidatos, orden de precedencia,
  export `{ theme, references }` o tema plano, tema ESM → error claro, archivo de tema
  en `result.messages` como dependencia.
- **Plugin con descubrimiento:** un fixture de proyecto con `uxdsl.theme.config.cjs`
  que define `palette.secondary`. Un `.css` con `palette(secondary)`, procesado con
  `postcss([uxdsl({ includeTheme: false, configRoot })])`, compila. Con
  `discoverTheme: false` falla, como hoy.
- **CLI:** `init` + `theme.breakpoints.md = 900` → `min-width: 900px`. Un conflicto
  config/tema avisa una vez.
- `fixtures/mig-b2-03-cli-init/` actualizado y en verde.

## Documentación

- `packages/postcss-uxdsl/README.md`: descubrimiento del tema, `discoverTheme` y
  `configRoot`.
- `packages/uxdsl-cli/README.md`: `init` ya no escribe breakpoints y aviso de
  conflicto.
- `packages/postcss-uxdsl/docs/migration.md`: quien tenga `breakpoints` copiados por
  `init` en su config puede borrarlos para que manden los del tema.
- CHANGELOG beta.6.

## Criterios de aceptación

- [ ] La reproducción de UX-13 da `900px`.
- [ ] El plugin valida contra el tema del proyecto sin configuración extra, y se
      puede desactivar.
- [ ] Un solo cargador: el CLI no tiene lógica propia de descubrimiento.
- [ ] El archivo de tema es dependencia observada.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm --prefix packages/uxdsl-cli test
node fixtures/mig-b2-03-cli-init/run.js
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-19 - one config loader for cli, core and the plugin; init stops overriding theme breakpoints`
