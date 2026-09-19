# MIG-B6-15 — Selectores funcionales y `!important` responsive

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | B — Tema base y salida correcta |
| Prioridad · Tamaño | P1 · S |
| Cierra | UX-05, UX-07 |
| Depende de | MIG-B6-14 (sólo por el orden de `index.ts`) |
| Bloquea | MIG-B6-17, MIG-B6-21 (siguientes en `index.ts`) |
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
2. En las dos llamadas de `index.ts`, pasar `important: decl.important`. No agregar
   `source` aquí: eso le toca a MIG-B6-21.

## Fuera de alcance

- Sourcemaps (MIG-B6-21).

## Pruebas

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

- [ ] Las dos reproducciones dan la salida esperada.
- [ ] Las fixtures cubren las cuatro pseudo-clases funcionales en los tres
      componentes.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-15 - comma-aware selectors in control directives, !important kept across breakpoints`
