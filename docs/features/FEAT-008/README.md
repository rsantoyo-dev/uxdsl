# FEAT-008 — Fichas de implementación para agentes

Estas fichas convierten el plan de [FEAT-008](../FEAT-008-beta6-reliability.md) en
trabajo que un agente puede tomar y entregar sin volver a investigar. Cada ficha
incluye:

- la reproducción del problema contra `main`, con la salida observada;
- los archivos y las líneas a tocar;
- los pasos de implementación y lo que queda fuera de alcance;
- las pruebas a escribir;
- la documentación que exige el repositorio;
- los criterios de aceptación y el formato de entrega.

Las referencias de línea corresponden a `main` en `3ceac6e` más el trabajo local de
MIG-B6-01. Si una línea se movió, hay que buscar el símbolo nombrado, no el número.

---

## Antes de repartir (dueño)

Resuelto el 2026-09-19:

1. **Trabajo local integrado** en la rama `feat/feat-008-beta6-plan`. Tiene tres
   commits:
   - la parte ya hecha de MIG-B6-01;
   - el arreglo de la gramática de VS Code (N-05; primer paso de MIG-B6-26);
   - este plan con sus fichas.

   **Esa rama tiene que estar en `main` antes de repartir**, porque las ramas de los
   agentes salen de `main`.
2. **Preguntas de MIG-B6-29 respondidas:** el JSON base completo es el default,
   incluidos `fonts.google` (Inter) y `modes.dark`.
3. **Colores:** los corrige el agente de MIG-B6-29 con las reglas de su paso 8. El
   dueño los aprueba en el PR.

Siguen fuera del release, sin commitear: los `package-lock.json` de `postcss-uxdsl` y
`uxdsl-cli` (sólo sincronizan versiones a beta.5) y `.vscode/settings.json` (es local).

---

## Protocolo para agentes

### Antes de empezar

1. Leer, en este orden:
   - la ficha;
   - de [FEAT-008](../FEAT-008-beta6-reliability.md), las secciones "Decisiones
     tomadas" y "Reglas de este release";
   - de [`AGENTS.md`](../../../AGENTS.md), las secciones "Build time, runtime and
     one source of truth" y "Maintaining this guide in the UXDSL repository";
   - [`docs/architecture/unified-engine-audit.md`](../../architecture/unified-engine-audit.md),
     si la ficha toca motores de tokens.
2. Verificar que las stories de **Depende de** estén integradas en `main`.
3. Si la ficha toca un archivo caliente (tabla al final), respetar el orden. Si la
   story anterior de la secuencia está en curso, esperar o rebasar sobre ella.
4. Ejecutar la **Reproducción** y confirmar que falla igual que en la ficha. Si no
   se reproduce, parar y reportarlo: la ficha puede estar desactualizada.
   Las reproducciones se ejecutan desde la raíz del repositorio; las que crean un
   proyecto temporal usan `$REPO`, que se define en la primera línea del bloque.

### Durante

- Primero convertir la reproducción en un test que falle; después corregir.
- Trabajar sólo el alcance de la ficha. Lo que aparezca fuera va a "Seguimiento" en
  el reporte; no se arregla en la misma rama.
- Reglas fijas:
  - `processUxdsl()` sigue devolviendo `Promise<string>`;
  - no se agrega sintaxis nueva al lenguaje;
  - ninguna familia de tokens puede depender de una caché global del proceso
    (`AGENTS.md`).
- Los artefactos generados no se editan a mano. Si cambian defaults o metadata del
  lenguaje, correr `npm run generate:language` e incluir lo generado.

### Documentación obligatoria

- **README de cada paquete con código tocado.** Lo exige `npm run verify:docs`, que
  corre en el pre-commit.
- **`packages/postcss-uxdsl/CHANGELOG.md`**, sección `## 0.5.0-beta.6 — unreleased`:
  un bullet por story que empiece con su ID. Si cambia algo visible, agregar la
  subsección `### Visual changes` con antes/después. El guard la exige para
  `default-theme.ts`, `typography-defaults.ts` y `typography.ts`, y la exigirá para
  el JSON base después de MIG-B6-29.
- **`packages/postcss-uxdsl/docs/migration.md`**, sección "Desde beta.6", cuando el
  usuario tenga que hacer algo: errores nuevos, cambios de API o de valores.
- **`AGENTS.md`**: la sección del primitivo afectado, si cambia su comportamiento.

### Verificación mínima antes de entregar

```bash
npm test                                          # raíz: motor, core, CLI, fixtures, guard de docs y artefactos
node scripts/generate-language-artifacts.js --check
npm run verify:beta5                              # gate histórico más reciente
```

Además, los comandos de la sección "Verificación" de la ficha. El pre-commit corre
`npm run verify:docs` y compila `packages/playground-nextjs`.

### Entrega

- Rama: `feat/feat-008-mig-b6-NN`.
- Commit, con la convención del repositorio:
  `feat(FEAT-008): MIG-B6-NN - <resumen en inglés, minúsculas>`. El cuerpo explica
  qué cambió, por qué y con qué comandos se verificó. Si el cambio es sólo
  documentación, usar `docs(FEAT-008): …`.
- Reporte final en el PR:
  - qué cambió;
  - qué tests se agregaron;
  - qué comandos se ejecutaron y con qué resultado;
  - qué **no** se verificó;
  - seguimiento.
- En el mismo PR, cambiar el estado de la story a `Integrada` en la tabla de abajo.
- Está prohibido: `npm publish`, cambiar dist-tags, publicar la extensión y hacer
  `git push --force` sobre `main`.

---

## Estado y orden

| Ola | ID | Ficha | Track | P | Tamaño | Depende de | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | MIG-B6-01 | [Familias top-level reconocidas](MIG-B6-01-familias-top-level.md) | A | P0 | S | — (parte ya integrada) | En curso |
| 1 | MIG-B6-02 | [Procedencia exacta de FEAT-002](MIG-B6-02-procedencia-feat-002.md) | G | P0 | S | — | Pendiente |
| 1 | MIG-B6-13 | [Errores con ubicación](MIG-B6-13-errores-con-ubicacion.md) | A | P0 | M | — | Pendiente |
| 1 | MIG-B6-14 | [Cero salidas silenciosas](MIG-B6-14-cero-salidas-silenciosas.md) | A | P0 | M | 13 | Pendiente |
| 1 | MIG-B6-15 | [Selectores funcionales e `!important`](MIG-B6-15-selectores-e-important.md) | B | P1 | S | 14 (orden de `index.ts`) | Pendiente |
| 1 | MIG-B6-22 | [Flags estrictos](MIG-B6-22-flags-estrictos.md) | D | P0 | S | 01 | Pendiente |
| 1 | MIG-B6-25 | [Referencias en tiempo casi lineal](MIG-B6-25-referencias-lineales.md) | E | P1 | M | 13 (forma de `ReferenceIssue`) | Pendiente |
| 1 | MIG-B6-27 | [Tipos y esquema](MIG-B6-27-tipos-y-esquema.md) | F | P2 | S-M | 01 | Pendiente |
| 1 | MIG-B6-28 | [Higiene de paquetes y npm](MIG-B6-28-higiene-npm.md) | G | P0 | S | — (paso 6 tras 18; parte de `index.ts` al final) | Pendiente |
| 1 | MIG-B6-29 | [El JSON base es la única fuente de defaults](MIG-B6-29-json-base-unica-fuente.md) | B | P0 | L | — | Pendiente |
| 2 | MIG-B6-18 | [`compile()` compartido](MIG-B6-18-compile-compartido.md) | C | P0 | L | — (su paso 0 empieza en la ola 1) | Pendiente |
| 2 | MIG-B6-19 | [Configuración única](MIG-B6-19-configuracion-unica.md) | C | P1 | M | 18 | Pendiente |
| 2 | MIG-B6-20 | [Adaptadores Vite y Webpack](MIG-B6-20-adaptadores-vite-webpack.md) | C | P1 | L | 18, 19, 29 | Pendiente |
| 2 | MIG-B6-21 | [Sourcemaps vía PostCSS](MIG-B6-21-sourcemaps.md) | C | P2 | M | 18, 20, 23, 17 | Pendiente |
| 2 | MIG-B6-30 | [`applyTheme(json)` en runtime](MIG-B6-30-apply-theme-runtime.md) | B | P1 | M | 29 | Pendiente |
| 2 | MIG-B6-16 | [Override parcial explícito](MIG-B6-16-override-parcial-explicito.md) | B | P1 | S | 29, 22 | Pendiente |
| 2 | MIG-B6-17 | [`@ds-typo` emite sólo lo que define el tema](MIG-B6-17-ds-typo-solo-tema.md) | B | P1 | M | 29, 15 | Pendiente |
| 2 | MIG-B6-23 | [Watch robusto](MIG-B6-23-watch-robusto.md) | D | P1 | M | 18, 24 | Pendiente |
| 2 | MIG-B6-24 | [Guardas de `builds`](MIG-B6-24-guardas-builds.md) | D | P1 | S | 18, 19 | Pendiente |
| 3 | MIG-B6-26 | [Extensión VS Code 0.1.0](MIG-B6-26-extension-vscode.md) | F | P1 | M | 14, 18 | Pendiente |
| 3 | MIG-B6-12 | [Gate de release beta.6](MIG-B6-12-gate-beta6.md) | G | P0 | M | todas | Pendiente |

**Camino crítico:** MIG-B6-18 → MIG-B6-20 → MIG-B6-21 → MIG-B6-12.

## Archivos calientes

Cada fila tiene un solo dueño a la vez; el orden es obligatorio.

| Archivo | Stories | Orden |
| --- | --- | --- |
| `packages/postcss-uxdsl/src/index.ts` | 13, 14, 15, 17, 21, 28 · cambios chicos de 19 y 27 | 13 → 14 → 15 → 17 → 21 → 28 (17 también espera a 29). 19 y 27 sólo tocan la entrada de opciones: commit chico, rebasado sobre la story en curso |
| `packages/uxdsl-cli/bin/uxdsl.js` | 22, 18, 19, 24, 23, 21, 16 | 22 → 18 → 19 → 24 → 23 → 21 → 16 |
| `default-theme.ts`, `typography.ts`, `typography-defaults.ts` | 29, 17 | 29 → 17 |
| `packages/postcss-uxdsl/src/reference-integrity.ts` | 13, 25 | 13 (mensajes y forma de `ReferenceIssue`) → 25 (algoritmo, sin cambiar esa forma) |
| `packages/vite-plugin-uxdsl/src/index.ts` y `packages/uxdsl-webpack-loader/index.js` | 20, 21 | 20 → 21 |
| `packages/uxdsl-core/src/index.ts` | 18, 21 | 18 → 21 |
| `packages/postcss-uxdsl/src/ds-runtime/index.ts` | 30 | sólo 30 |
