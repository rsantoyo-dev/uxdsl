# FEAT-008 — Fichas de implementación para agentes

Estas 21 fichas definen el alcance ejecutable de [FEAT-008](../FEAT-008-beta6-reliability.md).
MIG-B6-03 a 11 de FEAT-007 siguen diferidos; 04 es reemplazada por 21.
Cada ficha es la fuente normativa de su contrato, pruebas y aceptación.
El documento padre mantiene decisiones/alcance; este índice mantiene coordinación.

## Estado verificado y cómo empezar

Actualización 2026-09-20: 01 implementada/verificada localmente; 13 en curso con
pendientes concretos registrados en su ficha. Suite, tarballs beta.5 y build Next
pasan en el working tree revisado. No hay commit de entrega ni integración aún;
el guard documental debe repetirse con los README preparados en el índice.
Los registros de cada historia prevalecen sobre la auditoría histórica siguiente.

Revisión documental contra §60fdd76§, rama §feat/feat-008-beta6-plan§, el
2026-09-19. Paquetes npm actuales: beta.5. Las nuevas APIs y comandos de las fichas
son entregables pendientes, no capacidades ya disponibles. §npm test§ pasó durante
la auditoría previa; esto no demuestra resueltos los bugs de beta.6.

El plan y arreglos parciales de 01/gramática deben formar parte del commit base
común. Verificar ese commit antes de repartir; no asumir que la rama ya llegó a
main. Las líneas de reproducciones históricas corresponden a §3ceac6e§ más cambios
locales de entonces: localizar por símbolo y registrar el SHA real de cada prueba.

Cambios locales previos de settings/lockfiles pertenecen al usuario. Preservarlos;
si una implementación necesita actualizar dependencias, revisar y conciliar el
lockfile correspondiente, no descartarlo ni excluirlo para siempre del release.

## Evidencia de la revisión del plan (2026-09-19)

Esta revisión cambia documentación, no implementa las APIs pendientes.

| Comprobación | Resultado y límite |
| --- | --- |
| Baseline de código | `60fdd76`; settings y dos lockfiles locales previos preservados |
| Suite existente | `npm test` exit 0 en la auditoría previa de esta conversación; no se repite por cambios sólo documentales |
| Reproducciones del motor | Confirmados selectores funcionales rotos y pérdida de important responsive |
| Tema/fuentes | JSON con 8 familias; defaults restantes en motores; build emite Google Fonts, runtime no |
| Tipos/estructura | Firma genérica de defineConfig acepta extras; agregar focusvisible necesita CSS nuevo del componente |
| Revisión documental | 25 Markdown, 93 enlaces locales y 57 dependencias: checker sin incidencias (fences, anchors, evidencia, orden e inversas); `git diff --check` exit 0 |
| Guard de docs | `npm run verify:docs` exit 0; inspecciona staged y no había archivos staged, por lo que no sustituye al checker del working tree |
| No ejecutado para este cambio | Gates nuevos aún inexistentes, tarballs beta.6, navegador de runtime futuro y validación externa |

Las reproducciones se convierten en regresiones durante cada implementación.
El PASS de la suite actual no cierra las historias. Este registro no sustituye sus
tablas de evidencia ni el release record.

## Protocolo de implementación

1. Leer ficha, este índice, decisiones de FEAT-008, [AGENTS.md](../../../AGENTS.md)
   y [arquitectura](../../architecture/unified-engine-audit.md) para cambios de motor.
2. Confirmar dependencias integradas o presentes en la rama base revisada. La
   tabla ordena **integración**, no prohíbe preparar fixtures/inventarios antes.
3. Reproducir el problema y guardar evidencia. Si una dependencia ya cambió la
   salida, actualizar la reproducción justificadamente y conservar el caso como
   regresión; no detener trabajo útil por un número de línea o mensaje cambiado.
   Si contradice una decisión de producto, registrar el conflicto antes de alterar
   el contrato.
4. Convertir el fallo en test que falle con la implementación anterior. Corregir
   mediante el motor dueño, no con parser/defaults/cache paralelo en el adaptador.
5. Añadir controles válidos, negativos y recuperación según la ficha. Probar API
   pública además del helper. Expectativas representan comportamiento correcto;
   no regenerar snapshots/oráculos automáticamente para hacer pasar un fallo.
6. Ejecutar pruebas de la ficha y checks comunes. Completar el registro de
   evidencia de su Markdown y la documentación de usuario/agentes en el mismo PR.

Preservar responsabilidades de Density/Spacing, Palette/Colors y Typography/HTML,
referencias, precedencia, aislamiento entre compilaciones y excepciones CSS nativas.
No se agrega sintaxis. §processUxdsl§ conserva §Promise<string>§. Un cambio
estructural de componentes no se resuelve sólo sustituyendo variables.

## Cobertura y evidencia obligatorias

Por cada criterio: test/fixture con nombre, comando reproducible, resultado y SHA.
Un test debe comprobar efecto observable (CSS/AST, diagnóstico, filesystem,
computed style o API pública); no sólo que se llamó a un helper.

Según alcance:

- Motor: defaults/overrides/legacy, herencia, campos y keys custom, casos inválidos,
  compilaciones secuenciales, referencias y límites responsive.
- Integración: configuración efectiva y precedencia, propagación de warnings,
  origen del parcial y dependencias/watch con recuperación.
- Runtime: tema inicial SSR, estructura compatible, estados/modos/fuentes, último
  válido, storage fallido y compatibilidad legacy.
- Paquete: tarball limpio, exports/bin/schema/assets reales y dependencias exactas.
- Visual: navegador para comportamiento; snapshot CSS no prueba layout,
  accesibilidad ni hidratación. Usar recursos locales para pruebas deterministas.
- Release: checks locales, navegador, externos y postpublish separados.
  Un comando inexistente, no ejecutado o un skip no es evidencia positiva.

Registro en **cada ficha**, no sólo en conversación o PR:

| Campo | Contenido al entregar |
| --- | --- |
| Estado | Pendiente → En curso → Implementada/verificada → Integrada |
| Base y entrega | SHA base, SHA implementado y PR/merge cuando exista |
| Reproducción | comando/test y fallo observado antes |
| Criterio → test | nombre/path exacto y por qué detecta la regresión |
| Verificación | comando, fecha, entorno, exit code y enlace/log del resultado |
| Cambios visuales/API | antes/después y migración, o no aplica razonado |
| Documentación | paths actualizados, sección de AGENTS y guías afectadas |
| Límites | checks no ejecutados, motivo y efecto sobre cierre/release |

No marcar Integrada antes de merge. No rellenar PASS por herencia del resultado
de otra rama o por la intención de ejecutar después.

## Documentación obligatoria

- README de cada paquete con código modificado (§verify:docs§).
- CHANGELOG beta.6 con ID de story y §Visual changes§ cuando corresponda.
- Migration guide para cambios de valores, errores, API o instalación.
- Esta ficha y estado en este índice; enlazar evidencia y seguimiento.
- AGENTS.md en la sección afectada, sustituyendo reglas obsoletas al implementar;
  registrar «sin cambio de contrato» si no requiere edición. No presentar APIs
  futuras como disponibles.
- Guías del playground y arquitectura cuando describan el comportamiento cambiado.
  La guía para agentes queda después del demo en páginas de documentación.

La documentación se verifica igual que el código: ejemplos ejecutables en fixture,
enlaces válidos y comandos existentes al cerrar la historia.

## Checks comunes

~~~bash
npm test
node scripts/generate-language-artifacts.js --check
npm run verify:beta5
npm run verify:docs
~~~

Además, comandos de la ficha. Si cambian defaults/metadata, ejecutar
§npm run generate:language§ y revisar su diff antes de --check. Si se toca
playground/runtime/theme, compilar playground; comportamiento browser requiere
la fixture real. El hook no reemplaza checks de CI y puede inspeccionar sólo staged.
Una revisión sólo documental no exige repetir toda la suite: comprobar enlaces,
consistencia y diff; no atribuirle validación del código futuro.

## Orden de integración

La tabla incluye dependencias técnicas y serialización de archivos calientes.
El orden por filas es topológico. Se pueden preparar en paralelo 01, 02, 13,
inventarios de 29/28 y corpus de 18; 14/15/22/25 esperan a sus predecesoras para
integrarse. No hay una «ola 1» completa sin dependencias.

| ID | Ficha | Track | Prioridad · Tamaño | Depende de | Estado |
| --- | --- | --- | --- | --- | --- |
| MIG-B6-01 | [Familias top-level reconocidas](MIG-B6-01-familias-top-level.md) | A — Diagnósticos veraces | P0 · S | — | Verificada localmente; commit/integración pendientes |
| MIG-B6-02 | [Procedencia exacta de la validación de FEAT-002](MIG-B6-02-procedencia-feat-002.md) | G — Release | P0 · S (sólo documentación y un test documental) | — | Implementada/verificada en `feat/feat-008-beta6-plan` (`887622c`, `b00b84d`, `34c6daf`); integración a `main` pendiente |
| MIG-B6-13 | [Errores y avisos con ubicación](MIG-B6-13-errores-con-ubicacion.md) | A — Diagnósticos veraces | P0 · M | — | Implementada/verificada en `feat/feat-008-beta6-plan` (`afa571f`); dos gaps conocidos no bloqueantes en ficha (keyPath de Button/Input, 5 códigos UXD_PRESET_* sin confirmar); integración a `main` pendiente |
| MIG-B6-14 | [Cero salidas silenciosas del lenguaje](MIG-B6-14-cero-salidas-silenciosas.md) | A — Diagnósticos veraces | P0 · M | 13 | Implementada/verificada en `feat/feat-008-beta6-plan` (`72747e7`); integración a `main` pendiente |
| MIG-B6-15 | [Selectores funcionales y `!important` responsive](MIG-B6-15-selectores-e-important.md) | B — Tema base y salida correcta | P1 · S | 14 | Implementada/verificada en `feat/feat-008-beta6-plan` (`7084d7a`); integración a `main` pendiente |
| MIG-B6-22 | [Flags estrictos del CLI](MIG-B6-22-flags-estrictos.md) | D — CLI | P0 · S | 1 | Implementada/verificada en `feat/feat-008-beta6-plan` (`097ee88`, correcciones de revisión en `fd1f432`); integración a `main` pendiente |
| MIG-B6-25 | [Validación de referencias en tiempo casi lineal](MIG-B6-25-referencias-lineales.md) | E — Rendimiento | P1 · M | 13 | Implementada/verificada en `feat/feat-008-beta6-plan` (`6d64fac`) — 24.000 líneas pasan de **63,3 s a 0,79 s** en la máquina declarada, y duplicar la entrada cuesta x1,9 en vez de hasta x6,3. Equivalencia exacta contra un oráculo congelado (39 entradas, 263 issues, hash fijado) y test de escalado por razón, no por presupuesto absoluto; 8 mutaciones semánticas probadas contra la suite — ver "Límites y seguimiento" para las dos que no se detectan y por qué; integración a `main` pendiente |
| MIG-B6-18 | [`compile()` compartido en `uxdsl-core`](MIG-B6-18-compile-compartido.md) | C — Un solo pipeline (**camino crítico**) | P0 · L | 22 | Implementada/verificada en `feat/feat-008-beta6-plan` (`63babfe`, `aa3ae27`); integración a `main` pendiente |
| MIG-B6-19 | [Configuración única de tema y breakpoints](MIG-B6-19-configuracion-unica.md) | C — Un solo pipeline | P1 · M | 18 | Implementada/verificada en `feat/feat-008-beta6-plan` (`38f6b23`); integración a `main` pendiente |
| MIG-B6-24 | [Guardas de `builds`](MIG-B6-24-guardas-builds.md) | D — CLI | P1 · S | 18, 19 | Implementada/verificada en `feat/feat-008-beta6-plan` (`1661ca0`), implementada después de 23 (orden 20→23→24→26→28 pedido por el dueño); integración a `main` pendiente |
| MIG-B6-23 | [Watch robusto](MIG-B6-23-watch-robusto.md) | D — CLI | P1 · M | 18, 24 | Implementada/verificada en `feat/feat-008-beta6-plan` (`c878169`) sin esperar 24 — ver "Límites y seguimiento" de la ficha; integración a `main` pendiente |
| MIG-B6-29 | [El JSON base es la única fuente de defaults](MIG-B6-29-json-base-unica-fuente.md) | B — Tema base y salida correcta | P0 · L | 15 | **Las 4 fases implementadas/verificadas, historia cerrada** en `feat/feat-008-beta6-plan` (fase 1: `a078c51`, corrección de revisión en `fe23608`; fase 2: `4917193`; fase 3: `d97ca95`; fase 4: `11b9a78`) — fase 1 movió el JSON + extrajo 7 familias + migró el playground; fase 2 construyó el gate de contraste `checkThemeContrast`; fase 3 corrigió 16 colores de `theme/base.json` (y 10+15 de los temas `green`/`slate` del playground) en OKLCH, mínimo cambio; fase 4 unificó la codificación de Google Fonts entre PostCSS y `generateThemeCss` (paso 9). `report.passed` sigue en `false` a propósito: quedan 3 hallazgos reales de arquitectura/motor (no de color, no de esta historia) documentados con recomendación de seguimiento — ver "Límites y seguimiento" de la ficha; integración a `main` pendiente |
| MIG-B6-17 | [`@ds-typo` emite sólo lo que define el tema](MIG-B6-17-ds-typo-solo-tema.md) | B — Tema base y salida correcta | P1 · M | 29, 15 | Implementada/verificada en `feat/feat-008-beta6-plan` (`9218691`) — la directiva emite un campo por cada uno que el tema define, sin respaldos inventados; `TYPOGRAPHY_DEFAULTS` y `typography-defaults.ts` eliminados; cambio visual real documentado (enlaces conservan subrayado, márgenes dejan de romper flex/grid, `caption`/`small` sin `opacity`), −36,5% de salida en 100 usos; sin verificación en navegador — ver "Límites y seguimiento"; integración a `main` pendiente |
| MIG-B6-20 | [Adaptadores Vite y Webpack sobre `compile()`](MIG-B6-20-adaptadores-vite-webpack.md) | C — Un solo pipeline (**camino crítico**) | P1 · L | 18, 19, 29 | Implementada/verificada en `feat/feat-008-beta6-plan` (`1a4d59d`) sin esperar 29 (retiro de packs legacy) — ver "Límites y seguimiento" de la ficha; integración a `main` pendiente |
| MIG-B6-21 | [Sourcemaps vía PostCSS](MIG-B6-21-sourcemaps.md) | C — Un solo pipeline (**camino crítico**) | P2 · M | 18, 20, 23, 17 | Implementada/verificada en `feat/feat-008-beta6-plan` (`7478f9d`) — `compile()` implementa `sourceMap` inline/external, CLI con `--sourcemap`/config, las cuatro consultas de mapa aciertan con `SourceMapConsumer`, `false` es byte-idéntico; los globals del tema dejan de inventar archivos fuente (mapa −85%). Webpack: soporte verificado end-to-end; **Vite: no se anuncia soporte**, su fixture comprueba que no propaga la fuente `.uxdsl` — ver "Límites y seguimiento"; integración a `main` pendiente |
| MIG-B6-27 | [Tipos y esquema de configuración](MIG-B6-27-tipos-y-esquema.md) | F — Editor y tipos | P2 · S-M | 1, 19, 21, 29 | Implementada/verificada en `feat/feat-008-beta6-plan` (`ad65114`) — tipos públicos exportados (`theme` deja de ser `Record<string, any>`), `defineConfig` no genérico a propósito, y `schema/theme.schema.json` generado desde las constantes de motor y publicado. Verificado con `tsc` contra el `exports` map real bajo node16 y bundler, y contra el tarball instalado. Dos defectos encontrados de paso y corregidos: la condición `types` iba **después** de `require`/`import` en tres entradas de `exports`, y `"$schema"` en un tema disparaba un aviso de familia desconocida. Ver "Límites y seguimiento"; integración a `main` pendiente |
| MIG-B6-30 | [applyTheme(json): un modelo de tema en build y runtime](MIG-B6-30-apply-theme-runtime.md) | B — Tema base y salida correcta | P1 · L | 29, 17, 27 | Implementada/verificada en `feat/feat-008-beta6-plan` en 4 fases (`13ff49f`, `ed529d7`, `f7824ef`, `4e97969`) — API síncrona por documento, puerta estructural derivada de los propios emisores del compilador, migración de las cuatro claves antiguas que nunca deja al usuario sin ninguna copia, y el playground aplicando su tema por el runtime en vez de por su propia copia. 20 comprobaciones en Chrome sobre el runtime **empaquetado**. Ningún setter antiguo eliminado; las tres capacidades sin equivalente están documentadas. Ver "Límites y seguimiento"; integración a `main` pendiente |
| MIG-B6-16 | [Override parcial explícito](MIG-B6-16-override-parcial-explicito.md) | B — Tema base y salida correcta | P1 · S | 29, 22, 21 | Implementada/verificada en `feat/feat-008-beta6-plan` (`4332ea6`) — `theme --diff` resume por **stderr** las entradas que mezclan valores propios y de base (stdout sigue siendo JSON limpio), y `theme --contrast` audita el tema efectivo contra WCAG con las excepciones publicadas, saliendo con 1. D-1 intacta: sigue sin derivarse nada ni avisarse en `build`. 8 tests nuevos con captura separada de stdout/stderr; integración a `main` pendiente |
| MIG-B6-26 | [Extensión VS Code 0.1.0 confiable](MIG-B6-26-extension-vscode.md) | F — Editor y tipos | P1 · M | 14, 18, 29 | Implementada/verificada en `feat/feat-008-beta6-plan` (`07dd397`) sin esperar 29 (metadata deriva de `DEFAULT_THEME` actual, se actualiza sola cuando 29 aterrice) — ver "Límites y seguimiento" de la ficha; integración a `main` pendiente |
| MIG-B6-28 | [Higiene de paquetes y npm](MIG-B6-28-higiene-npm.md) | G — Release | P0 · S | 18, 21, 27, 29 | Implementada/verificada en `feat/feat-008-beta6-plan` (`a103344`, corrección de revisión en `c899127`, criterio diferido cerrado en `eb1408c`) — el grueso avanzó sin esperar 21/27/29 — la parte de Google Fonts en `index.ts`, diferida en su momento porque la propia ficha la secuenciaba después de 21, quedó cerrada al entregarse 21 (ver criterios de la ficha); resto del alcance (files, manifiesto, release.js) completo — ver "Límites y seguimiento" de la ficha; integración a `main` pendiente |
| MIG-B6-12 | [Gate de release beta.6 (re-alcanzado)](MIG-B6-12-gate-beta6.md) | G — Release | P0 · M | todas las demás | Implementada/verificada en `feat/feat-008-beta6-plan` (`02f4c7e`) — `npm run verify:beta6`: 26/26 comprobaciones sobre los cinco tarballs; release record en `docs/releases/0.5.0-beta.6.md` con `automated`/`browser`/`external`/`postpublish` separados. Verificado que el gate **puede fallar** revirtiendo MIG-B6-15 y MIG-B6-22 — esa comprobación destapó que el propio gate no hacía `await`, y de paso encontró un bug real: `theme --contrast \| jq` truncaba el JSON. **Press Craftor y los dist-tags siguen pendientes y son del dueño**; integración a `main` pendiente |

Rutas que convergen antes del gate: 01 → 22 → 18 → 19 → 20 → 21;
13 → 14 → 15 → 29 → 17 → 21; 19 → 24 → 23 → 21;
21 → 27 → 30/28, con 16 y 26 según tabla. No hay un único camino crítico
independiente de los defaults y del runtime.

## Archivos compartidos

| Archivo/responsabilidad | Orden o coordinación |
| --- | --- |
| `postcss-uxdsl/src/index.ts` | 13 → 14 → 15 → 29 (fuentes) → 17 → 21 → 28; 19 entrada/config y 27 tipos, commits pequeños rebasados |
| `uxdsl-cli/bin/uxdsl.js` | 22 → 18 → 19 → 24 → 23 → 21 → 16 |
| Defaults/motores/JSON | 29 dueño de extracción; 17 herencia/emisión tipográfica después; 30 inspección de estructura después |
| `reference-integrity.ts` | 13 diagnósticos → 25 rendimiento, conservando forma/cadenas |
| Core/adaptadores | 18 core → 20 adaptadores → 21 mapas |
| `generate-language-artifacts.js` | Coordinar 29 defaults, 26 editor y 27 schema; regenerar sobre metadata integrada |
| Manifests/exports/lockfiles | 18 grafo, 19 config, 27 tipos/schema, 28 allowlists/versionado final |
| Runtime/fixture de navegador | 29 fuentes → 30 estado/compatibilidad; 12 orquesta evidencia |

## Entrega y release

Rama sugerida `feat/feat-008-mig-b6-NN`. Commit con ID, razón y verificación.
Tests y documentación forman parte de la misma entrega. Cambios fuera de alcance
se registran con reproducción y prioridad para seguimiento, sin esconder P0/P1.

12 verifica candidato desde tarballs y registra evidencia externa de Press Craftor.
Después viene aprobación humana. Publicar, cambiar dist-tags y publicar VSIX son
acciones separadas fuera del trabajo automático de estas fichas. Los checks
postpublish no bloquean circularmente la preparación prepublish.
