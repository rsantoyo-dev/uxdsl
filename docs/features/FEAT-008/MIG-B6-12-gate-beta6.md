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

- [x] `npm run verify:beta6` pasa desde tarballs. → 26/26 comprobaciones
      automatizadas sobre los cinco tarballs instalados.
- [x] Todas las fixtures anteriores pasan. → `verify:beta2` a `verify:beta5`,
      `verify:consumer-fixture`, ambos adaptadores, `verify:vscode-extension`
      y `verify:cssmodules-build`, todas exit 0.
- [ ] **Press Craftor está validado y registrado.** → Pendiente, y no es
      ejecutable desde aquí: la corre el dueño o el equipo de ese proyecto.
      El release record lo lista como sección `external` con los cuatro
      requisitos exactos. **Este criterio bloquea el cierre de la feature.**
- [x] La DoD **prepublish** de FEAT-008 está completa con evidencia por casilla;
      comprobaciones postpublish quedan explícitamente pendientes. → El release
      record separa `automated`, `browser`, `external` y `postpublish`; ningún
      paso humano pendiente aparece como PASS ni como skip exitoso.
- [x] El dueño tiene todo lo necesario para aprobar la publicación: diff, tests,
      contenido de los tarballs, changelogs y limitaciones conocidas. →
      `docs/releases/0.5.0-beta.6.md`.

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

Estado de esta revisión documental: **Implementada y verificada localmente** en
`feat/feat-008-beta6-plan`, salvo la validación externa (Press Craftor), que es
del dueño y bloquea el cierre de la feature. Integración a `main` pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `1eb9346` (2026-09-22, HEAD de la rama al iniciar). Entrega: commit siguiente en `feat/feat-008-beta6-plan`; PR pendiente de abrir. Los paquetes siguen en `0.5.0-beta.5`: el bump pertenece a la publicación, fuera de alcance |
| Reproducción antes del cambio | No aplica en el sentido habitual: esta historia no arregla un defecto, construye el gate. Lo que sí se reprodujo es su ausencia — no existía `fixtures/mig-b6-12-release/`, ni `verify:beta6`, ni `docs/releases/0.5.0-beta.6.md`, así que no había forma de ejecutar los hallazgos de la auditoría contra los tarballs. 2026-09-22 |
| Criterio → regresión | `fixtures/mig-b6-12-release/run.js`, ejecutado por `npm run verify:beta6`: 26 comprobaciones sobre los cinco tarballs instalados, una por hallazgo automatizable (UX-01 a UX-21 y N-01, N-02, N-06, N-07, N-08), más paridad, el runtime de MIG-B6-30 con stub de DOM, y los sourcemaps con consulta de posición real. Los hallazgos que **no** se ejecutan aquí se imprimen en una lista aparte con su dueño y su mecanismo (navegador, adaptadores, VSIX, Press Craftor, dist-tags), nunca como PASS ni como skip |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, Apple M1 Pro, Chrome vía `playwright-core`: `npm run verify:beta6` (exit 0, **26/26**), `npm test` (exit 0), `npm run verify:consumer-fixture`, `verify:beta2`/`beta3`/`beta4`/`beta5`, `verify:vscode-extension`, `verify:pack-budget`, `verify:cssmodules-build`, ambos fixtures de adaptador y `node scripts/generate-language-artifacts.js --check` (todos exit 0) |
| Resultado después / control negativo | **El gate se verificó revirtiendo dos historias, como pide esta ficha, y esa verificación encontró un defecto en el propio gate**: la primera versión no hacía `await` de sus comprobaciones asíncronas, así que `fn()` devolvía una promesa pendiente —verdadera— y **todas** las comprobaciones async pasaban dijeran lo que dijeran. Sólo se detectó porque revertir MIG-B6-15 dejó el gate en verde. Corregido; con el `await` en su sitio: revertir MIG-B6-15 (el corte de selectores) hace fallar `UX-05` con `split inside :is()`, y revertir MIG-B6-22 (parseo estricto de flags) hace fallar `UX-04` con `nonexistent flag: exited 0`. **Bug de producto encontrado por el gate**: `uxdsl theme --contrast \| jq` devolvía JSON truncado — `process.exit()` descarta lo que queda en el búfer de una tubería. Redirigido a archivo escribía 302.816 bytes; por tubería, 65.536, cortado a mitad de una cadena. Corregido usando `process.exitCode` en todo el CLI, con su propio test de regresión que falla al revertirlo |
| Cambios visuales o API / migración | Sin cambio visual. Cambio de comportamiento del CLI: todas las salidas terminan de escribirse antes de salir, así que un documento JSON grande ya no se trunca al canalizarlo. Los códigos de salida no cambian (0/1 igual que antes) y `watch` sigue vivo por sus propios handles |
| README / CHANGELOG / migration | `docs/releases/0.5.0-beta.6.md` (nuevo): qué cambió, procedencia D-1, las cuatro categorías de verificación separadas, las limitaciones conocidas y la demostración de que el gate puede fallar. `README.md` raíz: sección `0.5.0-beta.6 — prepared, not published`. `package.json` raíz: `verify:beta6` |
| AGENTS / guías / arquitectura | Sin cambio de contrato: el gate no altera el comportamiento de ninguna primitiva. `AGENTS.md` ya se actualizó en MIG-B6-30 para describir el runtime real |
| Límites y seguimiento | (1) **Press Craftor sigue pendiente y bloquea el cierre de la feature.** No es ejecutable desde aquí; el release record lista los cuatro requisitos exactos. (2) **Nada se publicó**: ni `npm publish`, ni dist-tags, ni consulta al registro real. `verifyDistTags` sigue sin haberse ejecutado nunca contra `registry.npmjs.org`; su primera ejecución real será el release. (3) **Los paquetes siguen en `0.5.0-beta.5`**, así que el gate dice "Gate for 0.5.0-beta.5": el bump es parte de publicar. (4) **El tema base no pasa su propia puerta de contraste** (156 fallos con las excepciones aplicadas). El gate lo ejecuta y **no** afirma `passed`, porque afirmarlo sería mentir; registra el número para que un cambio en cualquier dirección se vea. (5) **CI real no se añadió** (paso 5 de la ficha: jobs, matriz de Node y bundlers). Los comandos existen y están documentados, pero no hay workflow que los ejecute; queda como seguimiento y no se presenta como hecho. (6) **UX-11 (watch atómico) no se ejecuta en el gate**: necesita un watcher de vida larga, no una fixture de una pasada; se cubre en la suite de `uxdsl-cli` y así se declara |

Completar en el mismo PR conforme al
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
