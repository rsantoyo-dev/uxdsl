# MIG-B6-15 — Selectores funcionales y `!important` responsive

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | B — Tema base y salida correcta |
| Prioridad · Tamaño | P1 · S |
| Cierra | UX-05, UX-07 |
| Depende de | MIG-B6-14 (sólo por el orden de `index.ts`) |
| Bloquea | MIG-B6-12, MIG-B6-17, MIG-B6-29 |
| Archivos | `packages/postcss-uxdsl/src/control-engine.ts`, `packages/postcss-uxdsl/src/index.ts` |
| Coordinación | Tercero en la secuencia de `index.ts` |

## Por qué

Dos patrones comunes de CSS producen salida incorrecta sin error:

- `@ds-button` y `@ds-input` parten el selector en cada coma, incluso las comas
  dentro de `:is()`, `:where()`, `:not()` y `:has()`;
- un valor responsive con `!important` pierde el `!important` en los `@media`, así que
  la versión de breakpoint nunca gana.

## Reproducción

```bash
npm --prefix packages/postcss-uxdsl run build
node -e "
const postcss = require('./packages/postcss-uxdsl/node_modules/postcss');
const uxdsl = require('./packages/postcss-uxdsl/dist');
const run = css => postcss([uxdsl({ includeTheme: false })]).process(css, { from: 'x.uxdsl' }).then(r => r.css);
run('.btn:is(.x, .y) { @ds-button(outlined primary 2); }').then(css => console.log(css.split('\n').find(l => l.includes(':hover'))));
run('.a { padding: xs(1rem) md(2rem) !important; }').then(console.log);
"
```

Salida actual:

```
.btn:is(.x:hover, .y):hover { … }
.a { padding: 1rem !important; }@media (min-width: 768px) {.a { padding: 2rem; } }
```

## Causa

- `control-engine.ts:128`: `selector.split(',')`.
- `index.ts:762` (`cloned.append({ prop: decl.prop, value: text })`) e `index.ts:809`
  (`targetRule.append({ prop: decl.prop, value: … })`) crean la declaración sin
  `important`.

## Resultado esperado

```
.btn:is(.x, .y):hover { … }
@media (min-width: 768px) { .a { padding: 2rem !important; } }
```

## Implementación

1. Separar el selector con `postcss.list.comma(selector)`, que respeta los
   paréntesis. Buscar en `src/` otros `split(',')` aplicados a **selectores** (no a
   argumentos de funciones) y corregirlos igual. `@ds-surface` usa otro camino:
   comprobar que no tenga el mismo problema.
2. En las declaraciones generadas de `index.ts`, preservar `important` y el
   source que 13 requiere para errores. Preferir clonar la declaración de origen;
   21 completa el encadenado de mapas, no se descarta procedencia mientras tanto.

## Fuera de alcance

- Sourcemaps (MIG-B6-21).

## Pruebas

- Comas en atributos con strings, escapes y listas de selectores anidados.
  Pseudo-elementos: estados se insertan en posición válida o entrada no soportada
  da error explícito; nunca producir un selector inválido al concatenar `:hover`.
- Verificar AST de cada media y el efecto en navegador ante una declaración
  competidora, no sólo que el texto contenga una vez `!important`.
- Surface no genera estados de control; su prueba asegura selector base intacto.
  Estados seleccionados y placeholder se prueban sólo donde el motor los emite.

- `test/control-selectors.test.js`: `:is(.x, .y)`, `:where(.x, .y)`,
  `:not(.a, .b)`, `:has(> .a, + .b)`, una lista `.a, .b` y nesting con `&`, sobre
  `@ds-button`, `@ds-input` y `@ds-surface`. Cada estado (`:hover`, `.is-selected`,
  `[aria-pressed="true"]`, …) se aplica a cada selector de la lista, sin romper los
  paréntesis.
- `test/responsive-important.test.js`: `xs()/md()` con `!important`, `density()`
  responsive con `!important`, y una custom property responsive con `!important`.

## Documentación

- CHANGELOG beta.6.
- `packages/postcss-uxdsl/README.md`: una línea en la sección de valores
  responsive: `!important` se conserva en cada breakpoint.

## Criterios de aceptación

- [x] Las dos reproducciones dan la salida esperada.
- [x] Las fixtures cubren las cuatro pseudo-clases funcionales en los tres
      componentes.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-15 - comma-aware selectors in control directives, !important kept across breakpoints`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada/verificada** en la rama
`feat/feat-008-beta6-plan`, conforme al
[protocolo de agentes](README.md#cobertura-y-evidencia-obligatorias).
Integración (merge a `main`) sigue pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `72747e7` (MIG-B6-14, entrega previa); entrega en `7084d7a` en `feat/feat-008-beta6-plan`; sin PR abierto todavía |
| Reproducción antes del cambio | El script de la sección "Reproducción" de este archivo, ejecutado antes del cambio: `.btn:is(.x:hover, .y):hover { … }` (selector partido dentro de `:is()`) y `.a { padding: 1rem !important; }@media (min-width: 768px) {.a { padding: 2rem; } }` (`!important` perdido en el `@media`). Fecha: 2026-09-21. |
| Criterio → regresión | Selectores → `test/control-selectors.test.js` (14 tests: las 4 pseudo-clases funcionales `:is`/`:where`/`:not`/`:has` × `@ds-button`/`@ds-input`/`@ds-surface`, más un caso multi-estado/multi-sufijo y un control de lista simple `.a, .b`). `!important` → `test/responsive-important.test.js` (6 tests: `xs()/md()`, 3 breakpoints, control positivo sin `!important`, `density()`, custom property, y una declaración anidada bajo una regla ya existente). |
| Comandos y entorno | `node --test packages/postcss-uxdsl/test/*.test.js` (macOS, Node del repo): 227/227, exit 0. `npm --prefix packages/uxdsl-cli test`: 131/131, exit 0. `npm run verify:beta5`: 4/4 PASS. `npm run verify:consumer-fixture` (tarball real): todos los checks PASS. `npm test` desde la raíz: 377 subtests, 0 fallos, exit 0. `packages/playground-nextjs`: `npm run uxdsl:build` compila los 43 imports reales sin cambios de tamaño de salida (433961 bytes, igual que antes — el contenido real no usa las formas que este fix corrige, confirmando ausencia de regresión). |
| Resultado después / control negativo | `.btn:is(.x, .y) { @ds-button(outlined primary 2); }` ahora genera `.btn:is(.x, .y):hover { … }` (selector intacto). `.a { padding: xs(1rem) md(2rem) !important; }` ahora genera `!important` tanto en la regla base como en el `@media`. Controles negativos: una lista simple `.a, .b` sigue generando `.a:hover, .b:hover` (sin regresión); un valor responsive sin `!important` nunca gana `!important` en ningún breakpoint; `@ds-surface` nunca dividió el selector (confirmado explícitamente para las 4 pseudo-clases, no solo asumido). |
| Cambios visuales o API / migración | Cambio de comportamiento del compilador: selectores antes rotos ahora se generan correctamente (posible cambio visual si un proyecto real dependía, sin saberlo, del selector roto — no se encontró ningún caso así en `playground-nextjs`); `!important` ahora se propaga donde antes se perdía (un build real con `!important` responsive puede ver una declaración de breakpoint ganar la cascada donde antes no lo hacía — es el comportamiento correcto documentado, no uno nuevo). Documentado en `packages/postcss-uxdsl/README.md` y `CHANGELOG.md`. |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md`: nota sobre `!important` en la sección de valores responsive ("See it in 60 seconds") y nota sobre selectores con pseudo-clases funcionales en la sección "A full component, one line". `packages/postcss-uxdsl/CHANGELOG.md`: entrada MIG-B6-15 en beta.6. |
| AGENTS / guías / arquitectura | Sin cambio de contrato de AGENTS.md — este fix no cambia responsabilidades de ninguna primitiva, corrige un bug de implementación en cómo `@ds-button`/`@ds-input` procesan su selector host. |
| Límites y seguimiento | Fuera de alcance según la propia story: sourcemaps (MIG-B6-21). No se investigó nesting con `&` (mencionado en Pruebas) porque este plugin no resuelve nesting por sí mismo — es responsabilidad de un plugin de nesting anterior en el pipeline (p. ej. `postcss-nested`), fuera del código que esta story toca; si un proyecto usa `&` sin ese plugin, no llega a `@ds-button`/`@ds-input` como selector válido en absoluto, así que no hay una forma correcta de reproducir "nesting roto por esta story" en aislamiento. |

Si cambia un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
