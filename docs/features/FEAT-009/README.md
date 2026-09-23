# FEAT-009 — Fichas de implementación para agentes

Estas 18 fichas definen el alcance ejecutable de
[FEAT-009](../FEAT-009-path-to-0.5.0.md), repartido en dos releases: **`beta.7`**
(primer corte) y **`rc.1`** (destino) — ver la columna "Release" y la sección
"Alcance por release" del documento padre. Cada ficha cita, en su propio "Por qué",
el campo exacto de una ficha de FEAT-008 del que viene — ninguna nace de una
auditoría nueva — **con excepciones declaradas: MIG-B7-12, 14, 15, 16 y 17** nacen
de peticiones y de feedback externo del dueño del 2026-09-23, medidos o
verificados ese día, y lo dicen en su propio "Por qué". El documento padre mantiene
decisiones/alcance; este índice mantiene coordinación.

## Estado

**Al escribir este plan (2026-09-22):** ninguna story implementada; las 21
fichas de FEAT-008 recién cerradas. Tres stories (02, 03, 10) bloqueadas por
decisiones del dueño (D-8, D-9, D-10 en el documento padre).

**Actualización 2026-09-23:** MIG-B7-01 integrada en `main` (PR #8). Se añaden
MIG-B7-12 (editor support para consumidores), MIG-B7-13 (completado según el
tema del proyecto, **bloqueada por D-11**), **MIG-B7-14 (P0: el `@import` de
Google Fonts queda tras `:root` y el navegador lo ignora — defecto de beta.6 ya
publicada, reproducido y comprobado en Chrome real)** y MIG-B7-15 (actualizar
sin sorpresas; su paso 3 espera D-12). `0.5.0-beta.6` ya está publicada.

**Segunda actualización 2026-09-23:** el dueño pide un release intermedio
`0.5.0-beta.7` que incluya además la revisión de toda la documentación y del
playground. Se añaden MIG-B7-16 (documentación ejecutable), MIG-B7-17 (playground
como implementador de referencia, XL por fases) y MIG-B7-18 (gate de beta.7), y
se mueve MIG-B7-09 a `beta.7` porque 17 depende de ella. `beta.7` = 01, 09, 12, 14,
15, 16, 17, 18; el resto queda para `rc.1`.

## Protocolo de implementación

El mismo que [FEAT-008/README.md](../FEAT-008/README.md#protocolo-de-implementación),
con un paso adicional al principio:

0. Antes de reproducir nada, releer la cita exacta de FEAT-008 que originó esta
   story (columna "Fuente exacta" de la tabla del documento padre). Si el estado
   del código cambió desde esa cita (por ejemplo, alguien ya tocó el archivo por
   otra razón), actualizar la reproducción con esa evidencia nueva y registrar
   por qué difiere — no asumir que la cita sigue siendo exacta sin comprobarlo.
1. Leer ficha, este índice, el documento padre, [AGENTS.md](../../../AGENTS.md)
   y [arquitectura](../../architecture/unified-engine-audit.md) para cambios de motor.
2. Confirmar dependencias integradas o presentes en la rama base revisada.
3. Reproducir el problema (paso 0) y guardar evidencia.
4. Convertir el fallo en test que falle con la implementación anterior. Corregir
   mediante el motor dueño, no con parser/defaults/cache paralelo en el adaptador.
5. Añadir controles válidos, negativos y recuperación según la ficha.
6. Ejecutar pruebas de la ficha y checks comunes. Completar el registro de
   evidencia de su Markdown y la documentación de usuario/agentes en el mismo PR.

## Cobertura y evidencia obligatorias

Idéntico al protocolo de FEAT-008: test/fixture con nombre, comando reproducible,
resultado y SHA por criterio; tabla de registro en cada ficha (Estado, Base y
entrega, Reproducción, Criterio → test, Verificación, Cambios visuales/API,
Documentación, Límites). No marcar Integrada antes de merge.

## Checks comunes

```bash
npm test
node scripts/generate-language-artifacts.js --check
npm run verify:beta6
npm run verify:docs
```

Si una story toca `theme/base.json`, `default-theme.ts` o cualquier archivo de
`VISUAL_DEFAULT_FILES` (ver `scripts/verify-docs-update.js`), el guard exige una
entrada en `packages/postcss-uxdsl/CHANGELOG.md` con sección `Visual changes`.

## Orden de integración

| ID | Ficha | Release | Prioridad · Tamaño | Depende de | Estado |
| --- | --- | --- | --- | --- | --- |
| MIG-B7-01 | [Contraste: placeholder de Input](MIG-B7-01-placeholder-tone.md) | `beta.7` | P0 · M | — | **Integrada** en `main` (PR #8, 2026-09-23) |
| MIG-B7-02 | [Contraste: light/dark/surface como tone](MIG-B7-02-tono-identidad-fondo.md) | `rc.1` | P0 · M | D-8 | **Bloqueada — esperando decisión del dueño** |
| MIG-B7-03 | [Contraste: warning.main](MIG-B7-03-warning-main.md) | `rc.1` | P0 · S | D-9 | **Bloqueada — esperando decisión del dueño** |
| MIG-B7-04 | [CI real](MIG-B7-04-ci-real.md) | `rc.1` | P0 · M | — | Pendiente |
| MIG-B7-05 | [Publicación de la extensión VS Code](MIG-B7-05-publicar-extension.md) | `rc.1` | P1 · S | 04 (VSIX validado en CI primero) | Pendiente |
| MIG-B7-06 | [Sourcemaps de Vite](MIG-B7-06-vite-sourcemaps.md) | `rc.1` | P1 · M | — | Pendiente |
| MIG-B7-07 | [Higiene de paquetes, ronda 2](MIG-B7-07-higiene-ronda-2.md) | `rc.1` | P2 · S | — | Pendiente |
| MIG-B7-08 | [`theme --diff` extendido](MIG-B7-08-diff-surfaces-buttons-inputs.md) | `rc.1` | P2 · S | — | Pendiente |
| MIG-B7-09 | [Limpieza del playground](MIG-B7-09-limpieza-playground.md) | `beta.7` | P2 · S-M | — | Pendiente |
| MIG-B7-10 | [Decisión sobre `!important`](MIG-B7-10-important-comparador.md) | `rc.1` | P2 · S | D-10 | **Bloqueada — esperando decisión del dueño** |
| MIG-B7-11 | [Gate hacia `0.5.0-rc.1`](MIG-B7-11-gate-rc1.md) | `rc.1` | P0 · M | todas las demás (12 a 17 siempre; 13 sólo si D-11 = (a)) | Pendiente |
| MIG-B7-12 | [Editor support para apps consumidoras](MIG-B7-12-editor-support-consumidores.md) | `beta.7` | P1 · M | — (su paso de `.vscode/extensions.json` espera a 05) | Pendiente |
| MIG-B7-13 | [Editor: completado y hover según el tema del proyecto](MIG-B7-13-editor-tema-del-proyecto.md) | `rc.1` | P2 · L | D-11 | **Bloqueada — esperando decisión del dueño** |
| MIG-B7-14 | [`@import` de Google Fonts tras `:root`](MIG-B7-14-google-fonts-import-orden.md) | `beta.7` | **P0** · S | — | **Implementada, PR pendiente de mergear** — defecto de beta.6 publicada |
| MIG-B7-15 | [Actualizar sin sorpresas](MIG-B7-15-actualizar-sin-sorpresas.md) | `beta.7` | P1 · S | — (su paso 3 espera D-12) | Pendiente |
| MIG-B7-16 | [Documentación ejecutable y revisión de todas las superficies](MIG-B7-16-documentacion-ejecutable.md) | `beta.7` | P1 · L | — (coordinar con 12 y 15) | Pendiente |
| MIG-B7-17 | [Playground: mejor implementador y prueba viva de cada capacidad](MIG-B7-17-playground-referencia.md) | `beta.7` | P1 · **XL** (por fases) | 09 y 16 | Pendiente |
| MIG-B7-18 | [Gate de `0.5.0-beta.7`](MIG-B7-18-gate-beta7.md) | `beta.7` | P0 · M | 01, 09, 12, 14, 15, 16, 17 | Pendiente |

01, 04, 07, 08, 09, 10, 12, 14, 15 y 16 no dependen entre sí. **17 depende de 09 y
de 16** (limpieza primero; arnés de ejemplos después). 05 depende de que el VSIX ya
se valide en CI (04) antes de publicarlo, aunque la acción de publicar es
independiente. 12 puede avanzar sin 04/05: sólo su paso de recomendar la
extensión desde `.vscode/` espera a que exista en Marketplace. **18 cierra
`beta.7`** (tras 01, 09, 12, 14, 15, 16, 17) y **11 cierra `rc.1`** (tras todas). Los
IDs 12 a 18 están después de 11 por orden de creación, no de ejecución.

## Archivos compartidos

| Archivo/responsabilidad | Coordinación |
| --- | --- |
| `packages/postcss-uxdsl/src/control-engine.ts` | 01 (placeholder) y 02 (tone de identidad) tocan el mismo motor; 02 espera D-8 así que 01 puede ir primero sin conflicto real |
| `packages/postcss-uxdsl/src/index.ts` | Sólo 14 (orden de los `prepend` del `@import` y de la densidad, ~líneas 195 y 590). 06 (sourcemaps de Vite) toca otras zonas del compilador; si coinciden, integrar 14 primero |
| `packages/postcss-uxdsl/src/theme/base.json` | 01 (si D-8/D-9 ya resueltas afectan valores), 02, 03 — coordinar con `scripts/fix-theme-contrast.js` (MIG-B6-29) en vez de editar colores a mano |
| `.github/workflows/` (nuevo) | Sólo 04 lo crea; 05 lo consume (el job de VSIX) sin modificarlo |
| `packages/uxdsl-cli/bin/uxdsl.js` | 08 toca `MIXED_ENTRY_FAMILIES`/`summarizeMixedEntries`; 12 toca el bloque `init` (~líneas 1760–1900). Regiones distintas, pero mismo archivo: si van en paralelo, integrar una y rebasar la otra |
| `packages/uxdsl-cli/README.md`, `packages/postcss-uxdsl/README.md` | 12 añade la sección "Editor support"; 07 también edita README de paquetes (higiene) — coordinar el orden |
| `packages/uxdsl-vscode/*` | Sólo 12 (README) y 13 (código, si D-11 = (a)); 04/05 lo consumen (VSIX) sin modificarlo |
| `packages/playground-nextjs/**` | 09 limpia (archivos muertos, `audit-themes.mjs`, arnés de tests) y va **primero**; 17 revisa y cambia el playground por fases y depende de 09. No en paralelo sobre los mismos archivos: 17 rebasa sobre 09 |
| `scripts/` (arnés de ejemplos, matriz de cobertura) | 16 crea el arnés; 17 lo consume y añade la matriz de cobertura. `scripts/verify-docs-update.js` sólo lo toca 16 |
| `AGENTS.md`, README de paquetes, `docs/releases/` | 12, 14, 15 y 16 editan documentación; 16 además **verifica** lo que las demás escriben. Integrar 12/14/15 antes que 16 evita que el arnés se ejecute contra texto a medio escribir |

## Entrega y release

Rama sugerida `feat/feat-009-mig-b7-NN`. 11 verifica el candidato desde tarballs
(reutilizando `fixtures/lib/tarball-consumer.js` y, en lo que aplique,
`fixtures/mig-b6-12-release/run.js`) y registra evidencia externa de Press
Craftor para `rc.1` — la misma validación que FEAT-008 dejó pendiente, no una
segunda ronda distinta. Publicar `0.5.0-rc.1`, cambiar dist-tags y publicar la
extensión son acciones separadas fuera del trabajo automático de estas fichas.
