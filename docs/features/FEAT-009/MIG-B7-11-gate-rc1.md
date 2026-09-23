# MIG-B7-11 — Gate hacia `0.5.0-rc.1`

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P0 · M |
| Cierra | La feature. Último paso antes de la aprobación del dueño para congelar `0.5.0-rc.1` |
| Depende de | Todas las demás fichas de FEAT-009 (sin dependencia de sí misma) |
| Bloquea | La publicación de `0.5.0-rc.1` |
| Archivos | `fixtures/mig-b7-11-rc1-release/run.js` (nuevo, o extender `fixtures/mig-b6-12-release/run.js` in situ — decidir en el paso 1), `package.json` raíz (`verify:rc1`), nuevo `docs/releases/0.5.0-rc.1.md` |

## Por qué

MIG-B6-12 cerró el gate de beta.6 con 26/26 comprobaciones automatizadas, pero
dejó explícitamente pendientes: la validación externa de Press Craftor, la
verificación de dist-tags (sólo posible post-publicación) y — el motivo de que
exista esta feature entera — el residuo documentado en cada ficha de FEAT-008.
Este gate es el mismo tipo de comprobación que MIG-B6-12, mirando ahora el
resultado de FEAT-009 encima del de FEAT-008.

## Relación con `fixtures/mig-b6-12-release/run.js`

No hay que reescribir esa fixture desde cero. Decidir en el paso 1 de
Implementación si este gate:
(a) extiende esa misma fixture con las comprobaciones nuevas de FEAT-009, o
(b) es una fixture nueva que reutiliza `fixtures/lib/tarball-consumer.js` igual
que la anterior y sólo prueba lo que FEAT-009 agregó, dejando que `verify:beta6`
se siga ejecutando por separado.
La opción (b) es más simple de mantener (cada gate prueba su propia feature) y
es la que sigue el patrón de esta sesión (cada beta tuvo su propio
`verify:betaN`); preferirla salvo que haya una razón concreta para fusionar.

## Resultado esperado

`npm run verify:rc1` (nombre a confirmar; puede ser
`verify:beta6` extendido si se elige la opción (a) de arriba) pasa desde
tarballs reales de los cinco paquetes, cubriendo:

1. Todo lo que MIG-B7-01 a MIG-B7-10 hayan cerrado (D-8/D-9/D-10 respondidas,
   o explícitamente documentadas como diferidas si el dueño decide no
   responderlas antes de `rc.1`).
2. El conjunto de fallos de contraste conocido, fijado exactamente — no un
   `> 0`. Éste es el punto donde se cierra el hueco que el propio feedback
   externo de esta sesión señaló sobre `base-theme-contrast.test.js`
   (`assert.ok(report.failures.length > 0)` no detecta un empeoramiento). Si
   D-8/D-9 se responden antes de este gate, el número baja de 156; fijar el
   número real en ese momento, no 156 a ciegas.
3. CI real en verde (MIG-B7-04) sobre el candidato exacto.
4. Editor support (MIG-B7-12): `uxdsl init` desde los **tarballs reales**
   deja el scaffold documentado y el `$schema` que el README del CLI cita
   resuelve dentro del paquete instalado. Que VS Code real resalte y complete
   se lista aparte como comprobación manual del dueño — nunca como PASS. Si
   D-11 = (a), añadir aquí lo que MIG-B7-13 defina.
5. **`@import` de Google Fonts primero (MIG-B7-14):** desde los tarballs
   reales, el CSS que produce el CLI empieza por el `@import`, y el job de
   navegador comprueba que se hace la petición a `fonts.googleapis.com`. Este
   gate no puede darse por bueno si esta comprobación sólo mira texto: beta.6
   pasó su gate de 26 comprobaciones con este defecto dentro.
6. **Flujo de actualización (MIG-B7-15):** el procedimiento documentado
   (`uxdsl theme` antes y después) se ejecuta desde dos tarballs y se registra
   su salida, no sólo su prosa.

## Implementación

1. Decidir (a) vs (b) de la sección anterior.
2. Igual que MIG-B6-12: cada comprobación automatizable como una función
   `check(id, label, fn)`, con lo no automatizable (Press Craftor, dist-tags
   postpublish, VS Code Marketplace si sigue sin publicarse) listado aparte,
   nunca como PASS.
3. **Fijar el conjunto exacto de fallos de contraste conocido** — la
   recomendación más concreta y accionable del feedback externo recibido
   sobre `base-theme-contrast.test.js`: en vez de `assert.ok(report.failures.length
   > 0)`, comparar la lista completa de firmas (familia+componente+tono+estado+
   modo+par, sin el ratio exacto) contra una lista fija en el propio test, con
   un comentario explicando cómo actualizarla cuando una corrección real
   cambie el conjunto — mismo patrón que el oráculo congelado de MIG-B6-25.
4. **Probar que el gate puede fallar**, como ya exige el protocolo: revertir al
   menos dos fichas de FEAT-009 ya cerradas (elegir dos con comprobación
   automatizable clara, por ejemplo MIG-B7-01 y MIG-B7-08) y confirmar que el
   gate falla — con el `await` correcto en cada `check()`, la misma lección
   que MIG-B6-12 aprendió de la manera difícil.
5. Release record `docs/releases/0.5.0-rc.1.md`, misma estructura que
   `0.5.0-beta.6.md`: qué cambió, resultados de Press Craftor (repetidos para
   `rc.1`, no reutilizados de beta.6 — FEAT-008's propio roadmap pide "rc.1 en
   Press Craftor durante al menos una semana" como paso separado), dist-tags
   esperados, limitaciones conocidas remanentes.

## Fuera de alcance

- Publicar `0.5.0-rc.1` — sigue siendo del dueño.
- Congelar `0.5.0` estable — ese es un paso posterior al propio `rc.1`, según
  la "Ruta recomendada a 0.5.0" del documento padre de FEAT-008.

## Pruebas

- El gate mismo, con al menos dos reversiones probadas y confirmadas en rojo.
- Corrupción controlada de al menos un fixture del gate anterior
  (`mig-b6-12-release`), sin revertir trabajo real de otros, para confirmar
  que el gate detecta el tipo de fallo que dice detectar.

## Documentación

- `docs/releases/0.5.0-rc.1.md` (nuevo).
- `README.md` raíz: actualizar la sección de versión.
- Cierre del índice de FEAT-009 con el estado final de cada story.

## Criterios de aceptación

- [ ] El gate nuevo pasa desde tarballs reales.
- [ ] El conjunto de fallos de contraste está fijado exactamente, no por `> 0`.
- [ ] El gate falla de verdad al revertir al menos dos fichas ya cerradas.
- [ ] El dueño tiene todo lo necesario para decidir sobre Press Craftor y la
      publicación de `rc.1`.

## Verificación

```bash
npm run verify:rc1   # o el nombre que el paso 1 decida
npm run verify:beta6
npm test
```

## Entrega

`feat(FEAT-009): MIG-B7-11 - 0.5.0-rc.1 gate, closes the feature`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Pendiente de implementación/verificación**.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | No aplica — story de construcción de gate, como MIG-B6-12 |
| Criterio → regresión | Pendiente |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente — debe incluir al menos 2 reversiones probadas |
| Cambios visuales o API / migración | No aplica |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | No aplica |
| Límites y seguimiento | Pendiente |
