# MIG-B6-23 — Watch robusto

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | D — CLI |
| Prioridad · Tamaño | P1 · M |
| Cierra | UX-11 |
| Depende de | MIG-B6-18 (`dependencies` por entrada), MIG-B6-24 (orden de `uxdsl.js`) |
| Bloquea | MIG-B6-21 (escribe el `.map` con esta escritura atómica) |
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
- Sólo escribe los archivos cuyo contenido cambió, y lo hace de forma atómica.
- Sólo recompila las entradas afectadas.

## Implementación

1. `main()`, rama `watch` (y `build --watch`): si el build inicial falla, loguear el
   error y seguir con `startWatch`. Si falla `loadConfig`, vigilar `CONFIG_CANDIDATES`
   y `THEME_CANDIDATES` en `cwd` y reintentar la carga ante cambios. `build` sin
   `--watch` sigue saliendo con 1.
2. Helper `writeFileAtomic(path, content)`: escribe un temporal en el mismo directorio
   (`.<nombre>.<pid>.tmp`) y hace `fs.renameSync`. Antes compara con el contenido
   actual y no escribe si es igual. Debe aceptar varios archivos por entrada, porque
   MIG-B6-21 agrega el `.map`. Se mantiene la regla de `buildOnce`: nada se escribe
   hasta que todas las entradas compilaron.
3. **Grafo de dependencias:** guardar el `dependencies[]` de cada entrada (de
   `compile()`, MIG-B6-18). Ante un cambio en `f`, recompilar las entradas cuyo
   conjunto incluye `f`. Si `f` es el config, el tema o una dependencia `require` de
   ellos, recompilar todas, como hoy.
4. Log: `[uxdsl] unchanged out/a.css` (o nada) cuando no se escribe; `built … (N bytes)`
   cuando sí.

## Fuera de alcance

- Cambiar la biblioteca de watch (chokidar).
- Watch en los adaptadores (su bundler lo hace).

## Pruebas

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
- [ ] La escritura es atómica y se aplica a varios archivos por entrada.

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-23 - watch survives errors, writes only changes atomically, rebuilds affected entries`
