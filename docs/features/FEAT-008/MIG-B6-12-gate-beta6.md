# MIG-B6-12 — Gate de release beta.6 (re-alcanzado)

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | G — Release |
| Prioridad · Tamaño | P0 · M |
| Cierra | La feature. Es el último paso antes de la aprobación del dueño |
| Depende de | Todas las demás stories de FEAT-008 (sin dependencia de sí misma) |
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
   FEAT-008 (UX-01 a UX-21 y N-01 a N-08) tiene evidencia y expected de su ficha:
   ejecutar las reproducciones automatizables y referenciar explícitamente los
   checks documentales/externos, sin fingir que todo se ejecuta en una fixture.
2. **Paridad:** `fixtures/parity/` por CLI, core, Vite y Webpack.
3. **Tema base:** `resolveTheme(undefined)` coincide con el JSON base del tarball y el
   gate de contraste pasa (MIG-B6-29).
4. **Runtime:** paridad para valores compatibles con la estructura compilada,
   hidratación con override real, fuentes/modos y rechazos sin perder tema válido
   (MIG-B6-30). No aceptar sólo igualdad plana de variables.
5. **Sourcemaps:** `external` e `inline` con consultas de posición; `false` byte a byte
   (MIG-B6-21).
6. **Fixtures anteriores:** `verify:consumer-fixture` y `verify:beta2` a
   `verify:beta5` en verde. Las expectativas históricas que cambian por decisiones de
   beta.6 se actualizan con un comentario que nombre la story, como se hizo con el gate
   de beta.5 en MIG-B6-01.
7. **`verify:cssmodules-build`** en job obligatorio separado con Chrome declarado,
   incluyendo runtime de 30. `verify:beta6` automatiza los checks locales de tarballs;
   la aprobación prepublish requiere también este job, no confundir ambos estados.
8. **Validación externa: Press Craftor** con los tarballs. La corre el dueño o el
   equipo de ese proyecto, y el resultado se registra en el release record:
   - cero avisos de UXDSL;
   - diff de CSS contra beta.5: cada cambio corresponde a una corrección o cambio
     visual documentado (incluidos selectores/important/typo/defaults), sin deltas
     inexplicados. Adjuntar diff y resultado visual de los consumidores afectados;
   - `next build` pasa;
   - un día de `uxdsl watch` en desarrollo sin reinicios forzados.
9. **La extensión VS Code** `0.1.0` empaqueta, y queda registrado si se publicó.

El gate **no publica**: no ejecuta `npm publish`, no cambia dist-tags y no pide
secretos.

## Implementación

1. Crear fixture con `fixtures/lib/tarball-consumer.js`. Cada check automatizable
   imprime PASS/FAIL y registra comando, commit, versión y hash de tarball.
   Separar `automated`, `browser`, `external` y `postpublish` en el release record;
   los pasos humanos pendientes nunca se convierten en PASS ni skip exitoso.
2. `npm run verify:beta6` en el `package.json` raíz.
3. Release record `docs/releases/0.5.0-beta.6.md`, con la misma estructura que el de
   beta.5:
   - qué cambió;
   - la tabla de procedencia (D1);
   - los resultados de Press Craftor;
   - los dist-tags esperados (D-6);
   - las limitaciones conocidas.
4. Actualizar FEAT-008 con evidencia por casilla; DoD prepublish puede cerrarse
   antes de publicar. Dist-tags quedan pendientes en sección postpublish y se
   verifican sólo después de aprobación/publicación. No existe dependencia circular.
5. Añadir CI real con jobs de tests/artefactos, fixtures de tarballs, navegador y
   VSIX. Fijar Node y versiones de bundlers probadas, con versiones mínimas y una
   versión objetivo dentro de los rangos anunciados; registrar matriz soportada.
   Una incompatibilidad reduce/documenta el rango o bloquea release.
6. Tabla de cobertura por cada UX/N: fixture, test, expected, comando y resultado.
   No todos los hallazgos se ejecutan dentro de Node: procedencia, publicación de
   VSIX y validación externa se verifican por sus mecanismos y quedan identificados.

## Fuera de alcance

- Publicar.

## Pruebas

- Corromper controladamente fixtures o usar inyección de fallo (sin revertir
  trabajo de otros): selectores, flags, mapa, runtime inválido y asset ausente
  deben producir FAIL. El comando normal no regenera expected para ponerse verde.
- Repetir con instalación limpia: ningún paquete usa rutas hermanas del repo;
  el hash que probó Press Craftor coincide con el candidato final. Cambios tras
  la validación invalidan evidencia afectada y obligan a repetir esos checks.

- La fixture misma. Tiene que fallar si se revierte cualquiera de las correcciones:
  comprobarlo al menos con dos stories (por ejemplo, revirtiendo MIG-B6-15 y
  MIG-B6-22) y anotarlo.

## Documentación

- El release record, el README raíz (sección de la versión) y el cierre de FEAT-008.

## Criterios de aceptación

- [ ] `npm run verify:beta6` pasa desde tarballs.
- [ ] Todas las fixtures anteriores pasan.
- [ ] Press Craftor está validado y registrado.
- [ ] La DoD **prepublish** de FEAT-008 está completa con evidencia por casilla;
      comprobaciones postpublish quedan explícitamente pendientes.
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
