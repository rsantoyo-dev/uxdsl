# MIG-B6-19 — Configuración única de tema y breakpoints

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | C — Un solo pipeline |
| Prioridad · Tamaño | P1 · M |
| Cierra | UX-13, UX-14 |
| Depende de | MIG-B6-18 |
| Bloquea | MIG-B6-12, MIG-B6-20, MIG-B6-24, MIG-B6-27 |
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
   CLI conserva flags y orquestación de build/watch. Compartir descubrimiento,
   normalización, precedencia y dependencias con dos envoltorios: sync para el
   plugin y async para CLI/adaptadores. El CLI ya admite funciones async CJS;
   conservarlo. Sync rechaza exports async con mensaje que indique pasar theme
   resuelto, sin cambiar silenciosamente al default.
2. **Descubrimiento en el plugin:** si `opts.theme === undefined` y
   `opts.discoverTheme !== false`, cargar el tema con el cargador, desde
   `opts.configRoot ?? process.cwd()`.
   - Tiene que ser **síncrono**: el factory del plugin es síncrono y hay usos con
     `.process().css`. Soportar `.cjs`, `.json` y `.js` CommonJS con `require`. Un
     tema ESM exige pasar `theme` explícito, con un error claro que lo diga.
   - Registrar config, tema y dependencias locales transitivas de carga como
     mensajes `dependency`. Invalidar su cache en cada rebuild; ver editar un
     archivo no basta si require sigue devolviendo el objeto anterior. Conservar
     aislamiento de dos proyectos compilados en el mismo proceso.
   - Hacer la resolución por compilación (Once), no congelarla al construir el
     plugin reutilizable. Registrar candidatos ausentes con el mecanismo del
     watcher para detectar la creación/eliminación del config.
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

- Plugin reutilizado: editar JSON requerido por tema cambia la siguiente salida;
  config/tema roto produce diagnóstico sin usar caché vieja como build válido.
- Dos configRoot en un proceso no comparten overrides; theme explícito gana;
  config/tema fuera de cwd resuelve rutas relativas a su archivo.
- Función async CJS sigue funcionando en CLI; plugin sync la rechaza claramente.
  Comprobar creación/eliminación de config y cambio de themeFile con watchers.
- El control negativo usa un token exclusivo, no `secondary`, que 29 agrega a base.

- `packages/postcss-uxdsl/test/config.test.js`: candidatos, orden de precedencia,
  export `{ theme, references }` o tema plano, tema ESM → error claro, archivo de tema
  en `result.messages` como dependencia.
- **Plugin con descubrimiento:** un fixture de proyecto con `uxdsl.theme.config.cjs`
  que define `palette.review-only-brand`. Un `.css` con `palette(review-only-brand)`, procesado con
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

- [x] La reproducción de UX-13 da `900px`.
- [x] El plugin valida contra el tema del proyecto sin configuración extra, y se
      puede desactivar.
- [x] Un solo cargador: el CLI no tiene lógica propia de descubrimiento.
- [x] El archivo de tema es dependencia observada.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm --prefix packages/uxdsl-cli test
node fixtures/mig-b2-03-cli-init/run.js
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-19 - one config loader for cli, core and the plugin; init stops overriding theme breakpoints`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada en
`feat/feat-008-beta6-plan`** (integración a `main` pendiente).

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `bfbf6ff` (2026-09-21). Entrega: `38f6b23` en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | UX-13: script exacto de la sección "Reproducción" ejecutado sobre `bfbf6ff` — `grep -o 'min-width: [0-9]*px' src/uxdsl.css` da `768px`, nunca `900px`, con `uxdsl.theme.config.cjs: { breakpoints: { md: 900 } }`. UX-14: `postcss([uxdsl({ includeTheme:false, theme:undefined })])` sobre `.a { color: palette(reviewonlybrand) }` con un `uxdsl.theme.config.cjs` que declara esa familia falla con `UXD_REFERENCE_MISSING` (valida contra `DEFAULT_THEME`, no descubre nada). 2026-09-21 |
| Criterio → regresión | "UX-13 da 900px" → manual (comando de "Reproducción" repetido, ver "Resultado después") + `fixtures/mig-b2-03-cli-init/run.js` (init ya no escribe `breakpoints:`, sigue en verde). "Plugin valida contra el tema del proyecto sin config extra, desactivable" → `packages/postcss-uxdsl/test/config.test.js`: "the plugin discovers uxdsl.theme.config.* from configRoot when theme is omitted", "discoverTheme: false keeps validating against the built-in default theme", "an explicit theme option always wins over discovery". "Un solo cargador" → `findThemeConfigPath`/`normalizeThemeExport`/`warnIfLooksLikeBuildConfig`/`collectLocalRequireTree` eliminados de `uxdsl-cli/bin/uxdsl.js` y reemplazados por re-exports de `postcss-uxdsl/config` (verificado por lectura del archivo); `uxdsl-cli/test/uxdsl-cli.test.js` (que llama `cli.THEME_CANDIDATES`/`cli.warnIfLooksLikeBuildConfig`) sigue en verde sin modificarse, porque son el mismo objeto/función reexportado. "Archivo de tema es dependencia observada" → `config.test.js`: "discovery registers the theme file as a PostCSS dependency message"; `discoverThemeAsync`/`discoverThemeSync` devuelven `dependencies` (tema + su árbol `require()` local), consumidos por `loadConfig`'s watch-list y por los mensajes `dependency` que emite el plugin |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, desde el root del monorepo: `npm --prefix packages/postcss-uxdsl test` (exit 0, 247/247, incluye las 20 pruebas nuevas de `config.test.js`), `npm --prefix packages/uxdsl-cli test` (exit 0, 132/132), `node fixtures/mig-b2-03-cli-init/run.js` (PASS, sin cambios necesarios en el fixture), `npm test` (exit 0, todas las suites), `npm run verify:consumer-fixture` (PASS), `npm run verify:beta2` (PASS), `npm run verify:beta3` (PASS), `npm run verify:beta4` (PASS), `npm run verify:beta5` (PASS) |
| Resultado después / control negativo | UX-13: mismo script de reproducción da `900px` (y ya no `768px`) tras el cambio. Conflicto real (config y tema declaran `md` con valores distintos): un único aviso `[uxdsl] Warning: uxdsl.config.cjs and uxdsl.theme.config.cjs both define breakpoint(s) md...`, config sigue ganando (sin cambio de precedencia), verificado manualmente. UX-14: el mismo `.css` con `palette(reviewonlybrand)` compila una vez que el plugin descubre `uxdsl.theme.config.cjs` desde `configRoot`. Control negativo: `discoverTheme: false` seguí fallando contra `DEFAULT_THEME` exactamente como antes de esta story (test dedicado); un `theme` explícito (incluso `{}`) sigue ganando sobre cualquier descubrimiento |
| Cambios visuales o API / migración | API aditiva en `postcss-uxdsl`: opciones nuevas `discoverTheme`/`configRoot` en `UxDslOptions` (ambas opcionales, `discoverTheme` por defecto `true`); nuevo subpath export `postcss-uxdsl/config`. Sin cambios de firma en APIs existentes. Cambio de comportamiento (no de API): `uxdsl init` ya no escribe `breakpoints:` en `uxdsl.config.cjs`; un proyecto existente con ese bloque generado por una versión anterior no cambia hasta que lo edite — documentado en migration.md |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md` (sección "Theme discovery (discoverTheme, configRoot)"); `packages/uxdsl-cli/README.md` (ejemplo de config sin `breakpoints:` + sección "Breakpoints and the theme file" con el aviso de conflicto); `packages/postcss-uxdsl/docs/migration.md` (sección "Desde beta.6: el plugin descubre el tema del proyecto solo, y init deja de escribir breakpoints"); no existe `CHANGELOG.md` propio en `uxdsl-core`/`uxdsl-cli` — cambios documentados en su propio README, mismo patrón que MIG-B6-18 |
| AGENTS / guías / arquitectura | No aplica: cambio interno de descubrimiento de configuración/tema (`uxdsl-cli`/`postcss-uxdsl`), no toca ninguna primitiva de diseño ni el contrato de `AGENTS.md` de este repo |
| Límites y seguimiento | (1) La resolución por-compilación (item 2 de "Implementación": mover `effectiveTheme`/`bps`/`bpNames` de la fábrica del plugin a `Once()`) se implementó y se probó con dos `configRoot` distintos en el mismo proceso y con una edición real en disco entre dos compilaciones de la misma instancia — no se probó explícitamente bajo Vite/Webpack real (esos adaptadores son MIG-B6-20, fuera de alcance). (2) El aviso de conflicto de breakpoints usa sólo nombre base de archivo, no ruta completa, en el mensaje — suficiente para el caso común (un solo config/tema por proyecto) pero podría ser ambiguo con `--config`/`themeFile` apuntando a una ruta con el mismo nombre base en otro directorio; no se consideró necesario para esta story. (3) No se agregó una prueba dedicada de fixture `fixtures/mig-b2-03-cli-init/` para "init ya no escribe breakpoints" porque el fixture existente no aserta sobre ese contenido y sigue en verde sin cambios — la cobertura real está en la reproducción manual de UX-13 y en `config.test.js`. (4) Rutas con espacios (mencionado en "Pruebas") no se probaron explícitamente para el descubrimiento del tema — mismo mecanismo (`fs.existsSync`/`require`) que el resto del CLI ya usa sin ese caso probado |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
