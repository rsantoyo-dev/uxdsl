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

- [ ] La reproducción ya no termina el proceso ni cambia el mtime sin cambios.
- [ ] Hay recompilación selectiva por dependencias.
- [ ] Reemplazo atómico por archivo, preparación conjunta y recuperación probados;
      límite entre renames documentado para CSS y mapas.

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-23 - watch survives errors, writes only changes atomically, rebuilds affected entries`

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
