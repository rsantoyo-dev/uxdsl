# Scripts de reproducción de la auditoría del 2026-09-29

Acompañan a `../2026-09-29-auditoria-estabilidad.md`. Son los scripts que
ejecutaron las cinco revisiones, copiados tal cual desde el scratch de la sesión:
no son tests del repositorio y no los ejecuta `npm test`.

Referencian el repositorio por su ruta absoluta en la máquina del autor
(`/Users/ricardosantoyo/Documents/projects/uxdsl`) y requieren `dist/` compilado
(`npm run build` en `packages/postcss-uxdsl` y `packages/uxdsl-core`). Para
correrlos en otra máquina, sustituir esa ruta.

- `p1.js`, `p2.js`, `scss.uxdsl` — sondas propias (funciones responsivas,
  directivas, formas de token, escalas, breakpoints personalizados, modos,
  tamaño de salida; el caso SCSS silencioso).
- `lang/` — lenguaje y compilador: `run.js p1.txt…p5.txt` (sondas de autor),
  `emit.js` (emisión del tema), `parity.js` (build vs runtime, idempotencia),
  `size.js`, `core.js` (camino uxdsl-core).
- `scss/` — `make-cases.js` genera 110 casos; `run.js` los compila con
  `compile()` y con Dart Sass; `run-two-stage.js` prueba Sass como pre-paso;
  `csstree-check.js` valida la salida. `results.txt`, `two-stage.txt` y
  `csstree.txt` son las salidas registradas.
- `theme/` — `probe-validation.js` (matriz de validación por capa),
  `probe-structure.js` (gate estructural de `applyTheme`), `probe-model.js`,
  `probe-divergence.js` (paridad build/runtime), `probe-contrast*.js`
  (descomposición de los 123 pares y las decisiones DE-7), `usage.sh`.

Las revisiones de instalación (`audit-dx`, proyectos de prueba de 1,1 GB) y de
playground (`audit-docs`, 68 capturas) no se copian; sus hallazgos están
íntegros en la auditoría y son reproducibles con los comandos que describe.
