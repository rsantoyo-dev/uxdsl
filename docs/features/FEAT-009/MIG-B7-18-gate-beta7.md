# MIG-B7-18 — Gate de `0.5.0-beta.7`

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · release `0.5.0-beta.7` |
| Prioridad · Tamaño | P0 · M |
| Cierra | El release `0.5.0-beta.7`. Último paso antes de la aprobación del dueño |
| Depende de | 01 (integrada), 09, 12, 14, 15, 16 y 17 |
| Bloquea | La publicación de `0.5.0-beta.7` |
| Archivos | `fixtures/mig-b7-18-beta7/run.js` (nuevo), `package.json` raíz (`verify:beta7`), `docs/releases/0.5.0-beta.7.md` (nuevo) |

## Por qué

Cada beta tuvo su propio `verify:betaN` (beta.2 a beta.6). Sin un gate propio, beta.7
saldría con la fe de que las fichas pasaron por separado — y beta.6 pasó su gate de
26 comprobaciones **con** el defecto del `@import` dentro, porque ninguna
comprobación miraba el CSS que produce el CLI en un navegador. Este gate existe para
mirar esa clase de cosas.

`MIG-B7-11` sigue siendo el gate de `rc.1`; éste no lo reemplaza ni lo reduce.

## Qué debe demostrar (desde tarballs reales de los cinco paquetes)

1. **MIG-B7-14:** el CSS que produce el CLI empieza por el `@import` de Google Fonts
   y, en Chrome real, provoca la petición a `fonts.googleapis.com`.
2. **MIG-B7-12:** `uxdsl init` deja el scaffold documentado y el `$schema` que el
   README cita existe dentro del paquete instalado.
3. **MIG-B7-15:** el flujo "antes de actualizar" (`uxdsl theme` antes y después) se
   ejecuta entre dos tarballs y su salida se registra.
4. **MIG-B7-16:** el arnés de ejemplos ejecutables pasa sobre las superficies del
   inventario.
5. **MIG-B7-17:** la matriz de cobertura está completa y el recorrido de Chrome real
   por el playground pasa (claro/oscuro, umbrales de breakpoint, sin errores de
   consola ni `var()` sin resolver).
6. **Contraste:** el conjunto exacto de fallos conocido, fijado por firma y no por
   `> 0` (hoy 123 pares tras MIG-B7-01; el número se fija **en ese momento**, no a
   ciegas).
7. **Todo lo de `verify:beta6`** sigue pasando.

Lo que **no** se puede automatizar aquí se lista aparte, **nunca como PASS**:
la comprobación manual en VS Code real (MIG-B7-12), la validación externa de
Press Craftor, y los dist-tags postpublicación.

## Implementación

1. Decidir, como MIG-B7-11, entre extender `mig-b6-12-release/run.js` o una fixture
   nueva que reutilice `fixtures/lib/tarball-consumer.js`. Preferir la nueva: cada
   gate prueba su propio release.
2. Cada comprobación como `check(id, label, fn)` **con `await`** — la lección de
   MIG-B6-12: sin `await`, una comprobación asíncrona devuelve una promesa pendiente
   (verdadera) y pasa siempre.
3. **Probar que el gate puede fallar:** revertir al menos dos fichas ya cerradas y
   confirmar que falla — por ejemplo MIG-B7-14 (el `@import` vuelve a la línea 2) y
   MIG-B7-01 (vuelven 33 fallos de contraste).
4. Release record `docs/releases/0.5.0-beta.7.md`, misma estructura que el de
   beta.6: qué cambió, cuatro categorías de verificación separadas (automatizado,
   navegador, externo, postpublicación), limitaciones conocidas.

## Fuera de alcance

- Publicar `0.5.0-beta.7` o cambiar dist-tags: acción del dueño.
- La validación externa de Press Craftor (se lista, no se sustituye).

## Criterios de aceptación

- [x] `npm run verify:beta7` pasa desde tarballs reales.
- [x] `verify:beta6` sigue pasando.
- [x] El gate falla de verdad al revertir al menos dos fichas cerradas.
- [x] Lo no automatizable está listado aparte, nunca como PASS.
- [ ] El dueño tiene todo lo necesario para decidir la publicación. (Falta la fase D de MIG-B7-17, que se hace con el dueño.)

## Verificación

```bash
npm run verify:beta7
npm run verify:beta6
npm test
```

## Entrega

`feat(FEAT-009): MIG-B7-18 - 0.5.0-beta.7 release gate`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente** (2026-09-28); PR pendiente de mergear.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Rama `feat/mig-b7-18-gate-beta7`, sobre `feat/mig-b7-17b-dogfooding`, con las ramas de #14–#19 integradas por merge local para correr el gate sobre beta.7 completa. SHA fijado al mergear |
| Reproducción antes del cambio | No aplica — story de construcción de gate |
| Criterio → regresión | `fixtures/mig-b7-18-release/run.js`: B7-12a/b/c (MIG-B7-12), B7-14a/b (MIG-B7-14, Chrome real), B7-15a/b (MIG-B7-15, contra la beta.6 publicada), `contrast` (123 firmas fijadas en `contrast-baseline.json`, re-fijables sólo con `--write-contrast-baseline`), B7-01, B7-16, B7-17 (matriz sin brechas registradas), B7-17E (`verify:playground-browser`), beta6 |
| Comandos y entorno | `npm run verify:beta7` exit 0, 13/13; `npm test` exit 0 (782/0); `npm run verify:doc-examples` exit 0. macOS 27.0, Node v20.19.0, Chrome 153.0.8010.53 |
| Resultado después / control negativo | Con MIG-B7-14 y MIG-B7-01 revertidos fallan B7-14a, B7-14b, contrast y B7-01. La primera versión de B7-01 filtraba por `inputs` (la familia es `input`) y quedó verde con el arreglo revertido; corregido. B7-17 falló mientras quedaban las 37 brechas |
| Cambios visuales o API / migración | No aplica |
| README / CHANGELOG / migration | `docs/releases/0.5.0-beta.7.md` (release record); script `verify:beta7` en el `package.json` raíz |
| AGENTS / guías / arquitectura | No aplica |
| Límites y seguimiento | Lo no automatizable se lista aparte en la salida del gate y en el release record (VS Code real, fase D con el dueño, validación externa, dist-tags). B7-16/B7-17/B7-17E leen el repositorio, no los tarballs, y lo dicen en su etiqueta. B7-15a necesita red (instala la beta.6 del registro) |
