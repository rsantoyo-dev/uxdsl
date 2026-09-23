# FEAT-009 — Fichas de implementación para agentes

Estas 11 fichas definen el alcance ejecutable de
[FEAT-009](../FEAT-009-path-to-0.5.0.md). Cada una cita, en su propio "Por qué",
el campo exacto de una ficha de FEAT-008 del que viene — ninguna nace de una
auditoría nueva. El documento padre mantiene decisiones/alcance; este índice
mantiene coordinación.

## Estado al escribir este plan (2026-09-22)

Ninguna story está implementada. Este índice se escribe el mismo día que se
cierran las 21 fichas de FEAT-008 (PR #4, sin mergear a `main` todavía). Tres
stories (02, 03, 10) están bloqueadas por decisiones del dueño (D-8, D-9, D-10
en el documento padre) y no deben empezar antes de esa respuesta.

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

| ID | Ficha | Prioridad · Tamaño | Depende de | Estado |
| --- | --- | --- | --- | --- |
| MIG-B7-01 | [Contraste: placeholder de Input](MIG-B7-01-placeholder-tone.md) | P0 · M | — | Implementada, PR pendiente de abrir |
| MIG-B7-02 | [Contraste: light/dark/surface como tone](MIG-B7-02-tono-identidad-fondo.md) | P0 · M | D-8 | **Bloqueada — esperando decisión del dueño** |
| MIG-B7-03 | [Contraste: warning.main](MIG-B7-03-warning-main.md) | P0 · S | D-9 | **Bloqueada — esperando decisión del dueño** |
| MIG-B7-04 | [CI real](MIG-B7-04-ci-real.md) | P0 · M | — | Pendiente |
| MIG-B7-05 | [Publicación de la extensión VS Code](MIG-B7-05-publicar-extension.md) | P1 · S | 04 (VSIX validado en CI primero) | Pendiente |
| MIG-B7-06 | [Sourcemaps de Vite](MIG-B7-06-vite-sourcemaps.md) | P1 · M | — | Pendiente |
| MIG-B7-07 | [Higiene de paquetes, ronda 2](MIG-B7-07-higiene-ronda-2.md) | P2 · S | — | Pendiente |
| MIG-B7-08 | [`theme --diff` extendido](MIG-B7-08-diff-surfaces-buttons-inputs.md) | P2 · S | — | Pendiente |
| MIG-B7-09 | [Limpieza del playground](MIG-B7-09-limpieza-playground.md) | P2 · S-M | — | Pendiente |
| MIG-B7-10 | [Decisión sobre `!important`](MIG-B7-10-important-comparador.md) | P2 · S | D-10 | **Bloqueada — esperando decisión del dueño** |
| MIG-B7-11 | [Gate hacia `0.5.0-rc.1`](MIG-B7-11-gate-rc1.md) | P0 · M | todas las demás | Pendiente |

01, 04, 07, 08, 09 y 10 no dependen entre sí. 05 depende de que el VSIX ya se
valide en CI (04) antes de publicarlo, aunque la acción de publicar es
independiente. 11 cierra tras todas.

## Archivos compartidos

| Archivo/responsabilidad | Coordinación |
| --- | --- |
| `packages/postcss-uxdsl/src/control-engine.ts` | 01 (placeholder) y 02 (tone de identidad) tocan el mismo motor; 02 espera D-8 así que 01 puede ir primero sin conflicto real |
| `packages/postcss-uxdsl/src/theme/base.json` | 01 (si D-8/D-9 ya resueltas afectan valores), 02, 03 — coordinar con `scripts/fix-theme-contrast.js` (MIG-B6-29) en vez de editar colores a mano |
| `.github/workflows/` (nuevo) | Sólo 04 lo crea; 05 lo consume (el job de VSIX) sin modificarlo |
| `packages/uxdsl-cli/bin/uxdsl.js` (`MIXED_ENTRY_FAMILIES`, `summarizeMixedEntries`) | Sólo 08 |
| `packages/playground-nextjs/src/components/` | Sólo 09 |

## Entrega y release

Rama sugerida `feat/feat-009-mig-b7-NN`. 11 verifica el candidato desde tarballs
(reutilizando `fixtures/lib/tarball-consumer.js` y, en lo que aplique,
`fixtures/mig-b6-12-release/run.js`) y registra evidencia externa de Press
Craftor para `rc.1` — la misma validación que FEAT-008 dejó pendiente, no una
segunda ronda distinta. Publicar `0.5.0-rc.1`, cambiar dist-tags y publicar la
extensión son acciones separadas fuera del trabajo automático de estas fichas.
