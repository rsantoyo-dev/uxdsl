# MIG-B6-12 — Gate de release beta.6 (re-alcanzado)

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | G — Release |
| Prioridad · Tamaño | P0 · M |
| Cierra | La feature. Es el último paso antes de la aprobación del dueño |
| Depende de | Todas las stories de FEAT-008 |
| Bloquea | La publicación de `0.5.0-beta.6` |
| Archivos | nuevo `fixtures/mig-b6-12-release/run.js`, `fixtures/lib/tarball-consumer.js` (reutilizar), `package.json` raíz (`verify:beta6`), nuevo `docs/releases/0.5.0-beta.6.md`, `README.md` (raíz), FEAT-008 (estado y DoD) |

## Por qué

Cada release anterior cerró con un gate desde tarballs reales (`verify:beta2` a
`verify:beta5`). beta.6 cambia mucho más: el pipeline, los adaptadores, los defaults,
los errores y el runtime. El gate tiene que ejecutar **cada hallazgo de la auditoría
como regresión** y validar en un proyecto real.

## Escenario obligatorio

`fixtures/mig-b6-12-release/run.js`, desde tarballs de los cinco paquetes, sin links
al monorepo:

1. **Regresiones de la auditoría.** Cada fila de "Estado verificado contra `main`" de
   FEAT-008 (UX-01 a UX-21 y N-01 a N-08) se ejecuta con su reproducción y se compara
   con el resultado esperado de su ficha.
2. **Paridad:** `fixtures/parity/` por CLI, core, Vite y Webpack.
3. **Tema base:** `resolveTheme(undefined)` coincide con el JSON base del tarball y el
   gate de contraste pasa (MIG-B6-29).
4. **Runtime:** hay paridad de `applyTheme` con el build (MIG-B6-30).
5. **Sourcemaps:** `external` e `inline` con consultas de posición; `false` byte a byte
   (MIG-B6-21).
6. **Fixtures anteriores:** `verify:consumer-fixture` y `verify:beta2` a
   `verify:beta5` en verde. Las expectativas históricas que cambian por decisiones de
   beta.6 se actualizan con un comentario que nombre la story, como se hizo con el gate
   de beta.5 en MIG-B6-01.
7. **`verify:cssmodules-build`** en un job con Chrome declarado. Registrar si es parte
   del gate o un job obligatorio separado.
8. **Validación externa: Press Craftor** con los tarballs. La corre el dueño o el
   equipo de ese proyecto, y el resultado se registra en el release record:
   - cero avisos de UXDSL;
   - CSS idéntico al de beta.5, salvo los cambios visuales documentados (D-2, JSON
     base, contraste), con el diff adjunto;
   - `next build` pasa;
   - un día de `uxdsl watch` en desarrollo sin reinicios forzados.
9. **La extensión VS Code** `0.1.0` empaqueta, y queda registrado si se publicó.

El gate **no publica**: no ejecuta `npm publish`, no cambia dist-tags y no pide
secretos.

## Implementación

1. Crear la fixture reutilizando `fixtures/lib/tarball-consumer.js`, con un paso por
   punto del escenario. Cada paso imprime `PASS:` o `FAIL:` como los gates anteriores.
2. `npm run verify:beta6` en el `package.json` raíz.
3. Release record `docs/releases/0.5.0-beta.6.md`, con la misma estructura que el de
   beta.5:
   - qué cambió;
   - la tabla de procedencia (D1);
   - los resultados de Press Craftor;
   - los dist-tags esperados (D-6);
   - las limitaciones conocidas.
4. Actualizar el estado de FEAT-008 y marcar su Definition of done con evidencia
   (comando y resultado por casilla).

## Fuera de alcance

- Publicar.

## Pruebas

- La fixture misma. Tiene que fallar si se revierte cualquiera de las correcciones:
  comprobarlo al menos con dos stories (por ejemplo, revirtiendo MIG-B6-15 y
  MIG-B6-22) y anotarlo.

## Documentación

- El release record, el README raíz (sección de la versión) y el cierre de FEAT-008.

## Criterios de aceptación

- [ ] `npm run verify:beta6` pasa desde tarballs.
- [ ] Todas las fixtures anteriores pasan.
- [ ] Press Craftor está validado y registrado.
- [ ] La Definition of done de FEAT-008 está completa, con evidencia por casilla.
- [ ] El dueño tiene todo lo necesario para aprobar la publicación: diff, tests,
      contenido de los tarballs, changelogs y limitaciones conocidas.

## Verificación

```bash
npm run verify:beta6
npm run verify:consumer-fixture
npm run verify:beta2 && npm run verify:beta3 && npm run verify:beta4 && npm run verify:beta5
npm test
UXDSL_CHROME_PATH=/ruta/a/chrome npm run verify:cssmodules-build
```

## Entrega

`feat(FEAT-008): MIG-B6-12 - beta.6 release gate, closes the feature`
