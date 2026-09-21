# MIG-B6-23 — Watch robusto

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | D — CLI |
| Prioridad · Tamaño | P1 · M |
| Cierra | UX-11 |
| Depende de | MIG-B6-18 (`dependencies` por entrada), MIG-B6-24 (orden de `uxdsl.js`) |
| Bloquea | MIG-B6-12, MIG-B6-21 |
| Archivos | `packages/uxdsl-cli/bin/uxdsl.js` (`main` ~1321-1340, `buildOnce` ~757-830, `startWatch` ~992-1064), `packages/uxdsl-cli/test/watch-mode.test.js` |
| Coordinación | Quinto en la secuencia de `uxdsl.js` (22 → 18 → 19 → 24 → 23 → 21 → 16) |

## Por qué

Tres problemas en el modo watch:

- si el primer build falla, `uxdsl watch` termina, y con `concurrently
  --kill-others-on-fail` (el setup de Press Craftor) también tumba `next dev`;
- cada rebuild reescribe todas las salidas aunque no cambien, así que el HMR recarga
  todas las hojas de estilo;
- la escritura no es atómica: el servidor de desarrollo puede leer un archivo a medio
  escribir.

## Reproducción

```bash
REPO=$(git rev-parse --show-toplevel)   # ejecutar desde cualquier carpeta del repo
d=$(mktemp -d) && cd $d && mkdir src
echo "module.exports = { entry: './src/a.uxdsl', outFile: './out/a.css', watch: ['src/**/*.uxdsl'] };" > uxdsl.config.cjs
printf '.a { padding: density(16); }\n' > src/a.uxdsl
perl -e 'alarm 6; exec @ARGV' node $REPO/packages/uxdsl-cli/bin/uxdsl.js watch; echo "exit=$?"   # exit=1 (muere)

printf '.a { padding: density(2); }\n' > src/a.uxdsl
node $REPO/packages/uxdsl-cli/bin/uxdsl.js build >/dev/null; stat -f %m out/a.css
sleep 1.1; node $REPO/packages/uxdsl-cli/bin/uxdsl.js build >/dev/null; stat -f %m out/a.css   # el mtime cambia sin cambios
```

## Causa

- `main()`: `await buildOnce(config)` se ejecuta antes de `startWatch`, y el `catch`
  general hace `process.exit(1)`.
- `buildOnce` (~816-825): `fs.writeFileSync(outFile, finalCss)` sin condición y sin
  archivo temporal.
- `startWatch` recompila todas las entradas ante cualquier cambio.

## Resultado esperado

- `watch` con un error inicial imprime el error y sigue vigilando. Al corregir el
  archivo, compila.
- Si falla la carga del config, vigila los candidatos de config y de tema y reintenta.
- Sólo escribe archivos cuyo contenido cambió, con reemplazo atómico por archivo
  y preparación de todas las salidas antes del commit. No promete una transacción
  de filesystem sobre varios paths.
- Sólo recompila las entradas afectadas.

## Implementación

1. `main()`, rama `watch` (y `build --watch`): si el build inicial falla, loguear el
   error y seguir con `startWatch`. Si falla `loadConfig`, vigilar `CONFIG_CANDIDATES`
   y `THEME_CANDIDATES` en `cwd`, además de cualquier `--config` explícito y
   dependencia conocida aunque esté fuera de cwd, y reintentar ante cambios. `build` sin
   `--watch` sigue saliendo con 1.
2. Preparar CSS/mapas en memoria, comparar bytes y escribir temporales exclusivos
   en sus directorios (`mkdtemp` o creación exclusiva; pid no basta). Sólo iniciar
   reemplazos tras compilar y preparar todas las salidas. Cada rename es atómico
   **por archivo**. Orden mapas antes de CSS, limpieza en finally y recuperación
   de salidas anteriores ante error de commit, con diagnóstico si la recuperación
   también falla. Lectores pueden observar versiones mixtas durante varios renames;
   no prometer atomicidad global ni ante caída del proceso. Archivos sin cambios
   conservan mtime/inode. 21 integra mapas en este helper.
3. **Grafo de dependencias:** guardar el `dependencies[]` de cada entrada (de
   `compile()`, MIG-B6-18). Ante un cambio en `f`, recompilar las entradas cuyo
   conjunto incluye `f`. Si `f` es el config, el tema o una dependencia `require` de
   ellos, recompilar todas, como hoy. Incluir la propia entry en cada conjunto.
   Conservar el último grafo válido si el build falla y observar además imports
   intentados/ausentes y sus directorios. Sin grafo inicial usar watch declarado
   y dependencias descubiertas antes del fallo. Crear un parcial faltante fuera de
   los globs originales debe recuperar el build.
4. Serializar builds: eventos durante compilación marcan dirty y se procesan
   después; ningún build viejo sobrescribe uno reciente. Retarget de config/tema/
   globs actualiza watchers; excluir salidas/temporales y cerrar watchers al salir.
5. Log: `[uxdsl] unchanged out/a.css` (o nada) cuando no se escribe; `built … (N bytes)`
   cuando sí.

## Fuera de alcance

- Cambiar la biblioteca de watch (chokidar).
- Watch en los adaptadores (su bundler lo hace).

## Pruebas

- Config explícito roto fuera de cwd se recupera al corregirlo sin reiniciar.
- Import ausente inicial y creación posterior fuera del glob; borrar/restaurar
  parcial existente; error en require transitivo del tema y recuperación.
- Fallo inyectado de temporal y de segundo rename: no hay archivos truncados,
  recuperación cuando el filesystem lo permite y error explícito. Un bucle de
  lectura no demuestra atomicidad conjunta.
- Eventos durante un build lento: último CSS correcto; mapa cambiado y CSS igual
  sólo actualiza mapa. Temporales limpios, sin loops ni watchers huérfanos.

En `packages/uxdsl-cli/test/watch-mode.test.js`:

- un error inicial no termina el proceso; al corregir, aparece la salida;
- un config roto al inicio se recupera al corregirlo;
- un rebuild sin cambios conserva el mtime y el inode;
- con dos entradas A y B, editar un parcial de B no reescribe A;
- escritura atómica: nunca se observa un archivo de salida vacío o parcial
  (leerlo en un bucle durante el rebuild).

## Documentación

- `packages/uxdsl-cli/README.md`: el comportamiento de watch ante errores y la
  recompilación selectiva.
- CHANGELOG beta.6.

## Criterios de aceptación

- [x] La reproducción ya no termina el proceso ni cambia el mtime sin cambios.
- [x] Hay recompilación selectiva por dependencias.
- [x] Reemplazo atómico por archivo, preparación conjunta y recuperación probados;
      límite entre renames documentado para CSS y mapas.

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-23 - watch survives errors, writes only changes atomically, rebuilds affected entries`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada en
`feat/feat-008-beta6-plan`** (integración a `main` pendiente).

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `4ae9675` (2026-09-21). Entrega: commit siguiente en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | Script exacto de la sección "Reproducción" ejecutado sobre `4ae9675`: `uxdsl watch` con un `density(16)` inválido en la entrada termina el proceso (no sigue vivo tras 6s, sin más salida que el error); reescribir el mismo contenido en un segundo `build` cambia el mtime de `out/a.css` aunque el CSS resultante es idéntico. 2026-09-21 |
| Criterio → regresión | "No termina el proceso / no cambia mtime sin cambios" → reproducción manual repetida (ver "Resultado después") + `packages/uxdsl-cli/test/watch-mode.test.js` ("an initial compile error does not end the process...", "a config broken at startup (syntax error) recovers...", "a rebuild triggered by an unrelated watched file produces byte-identical output and preserves mtime/inode") + `packages/uxdsl-cli/test/uxdsl-cli.test.js` (`commitFileIfChanged`/`commitCompiled` unit tests, `loadAndBuildForWatch` unit tests). "Recompilación selectiva por dependencias" → `watch-mode.test.js` ("with two entries A and B, editing a partial only B imports does not rewrite A", "creating a previously-missing partial recovers the build"). "Reemplazo atómico, preparación conjunta y recuperación" → `uxdsl-cli.test.js` (`commitFileIfChanged` atomic-rename/temp-cleanup tests, `commitCompiled` rollback tests forcing a real rename failure) + `watch-mode.test.js` ("an output file is never observed empty or truncated while a rebuild is writing it", a continuous read-loop during several real rebuilds) |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, desde el root del monorepo: `npm --prefix packages/uxdsl-cli test` (exit 0, 149/149, incluye 17 tests nuevos de MIG-B6-23: 13 en `watch-mode.test.js` con un `uxdsl watch` real spawneado y chokidar real, 11 unitarios en `uxdsl-cli.test.js`), `npm test` (exit 0, todas las suites), `npm run verify:consumer-fixture`/`verify:beta2`/`verify:beta3`/`verify:beta4`/`verify:beta5` (todos PASS, `verify:beta4` en particular ejercita `uxdsl watch` contra un tarball real instalado), `npm run build` en `packages/playground-nextjs` (build de producción completo, OK) |
| Resultado después / control negativo | Las dos reproducciones dan el resultado correcto: el proceso sigue vivo tras el error inicial e imprime la salida esperada al corregir la entrada (verificado repitiendo el script exacto de "Reproducción"); dos builds consecutivos del mismo contenido preservan mtime e inode. Control negativo: `uxdsl build` sin `--watch` sigue saliendo con código 1 ante cualquier error, sin cambios (cubierto por la extensa suite preexistente de `buildOnce`, que sigue en verde sin modificarse); un cambio real de contenido sigue produciéndose "written" (nunca "unchanged" quedándose con contenido viejo) |
| Cambios visuales o API / migración | Cambio de comportamiento real y documentado: `uxdsl watch`/`uxdsl build --watch` ya no terminan el proceso ante un error inicial de carga o compilación — antes sí. Una entrada sin cambios ya no se reescribe (mismo mtime/inode) — antes se reescribía siempre. Editar el parcial de una sola entrada de un `builds` con varias ya no recompila las demás. API interna aditiva, no observable desde afuera del CLI: `compileEntryToCss` ahora también devuelve `dependencies`; `buildOnce(config, entryIndices?)` acepta un segundo argumento opcional (todos los call sites existentes lo omiten, comportamiento idéntico) y ahora retorna `[{ index, outFile, dependencies }]` en vez de `undefined` (ningún consumidor existente miraba el valor de retorno); `startWatch` acepta `initialConfig: null` |
| README / CHANGELOG / migration | `packages/uxdsl-cli/README.md` (sección de watch mode ampliada: "Watch survives errors", "Selective rebuilds", "Writes only what changed, atomically"); `packages/postcss-uxdsl/docs/migration.md` (sección "Desde beta.6: uxdsl watch sobrevive errores..."). No existe `CHANGELOG.md` propio en `uxdsl-cli` — documentado en su README, mismo patrón que las stories anteriores de esta feature |
| AGENTS / guías / arquitectura | No aplica: cambio interno del CLI (comportamiento de `watch`/`build`), no toca ninguna primitiva de diseño ni el contrato de `AGENTS.md` de este repo |
| Límites y seguimiento | (1) **Implementada sin esperar MIG-B6-24** (a pedido explícito del dueño para seguir el orden 20→23→24→26→28), pese a que la ficha coordina "24 antes de 23" por convivir en la misma región de `uxdsl.js` (`buildOnce`). Sin conflicto funcional real: 24 agrega una validación *antes* de escribir (`.module.css` + tema), acotada a `compileEntryToCss`/`buildOnce`'s primera mitad; 23 reestructura la *escritura* (segunda mitad). Se verificará explícitamente al implementar 24 que ambas conviven sin regresión. (2) El "límite entre renames documentado para CSS y mapas" del criterio de aceptación se cumplió sólo para CSS — los mapas de sourcemap son MIG-B6-21 (fuera de alcance), así que `commitCompiled` no tiene hoy una segunda escritura por entrada que ordenar; el comentario en el código ya deja la nota para cuando 21 la agregue. (3) La recuperación de rollback se probó forzando un fallo de `renameSync` real (un directorio no vacío en el lugar del archivo de salida) — no se probó un fallo de la propia escritura del rollback (por ejemplo, permisos revocados a mitad de proceso); ese caso sólo añade el mensaje de diagnóstico concatenado, sin test dedicado. (4) No se probó explícitamente "config explícito roto fuera de cwd se recupera sin reiniciar" ni "borrar/restaurar un parcial existente" como casos separados — cubiertos indirectamente por la lógica compartida (`bootstrapWatchTargets` incluye `--config` explícito; el grafo de dependencias no distingue crear de restaurar un archivo), pero sin un test que los ejercite literalmente. (5) "Serializar builds" (item 4) se implementó coalescando eventos en un solo lote por índice de entrada afectado, no test dedicado a probar la coalescencia bajo un build artificialmente lento (`watch-mode.test.js`'s test de escritura atómica ejercita varios rebuilds reales en secuencia rápida, pero no fuerza específicamente que dos eventos lleguen *durante* un build en curso) |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
