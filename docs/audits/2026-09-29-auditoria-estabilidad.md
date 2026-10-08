# UXDSL — Auditoría de estabilidad y plan hacia 1.0

Fecha: 2026-09-29. Base auditada: `main` en `0446d7c` (beta.7 integrada) más la
rama `docs/playground-page-audit` para el playground. Sin usuarios externos.

**Objetivo del dueño:** una versión estable al 100 % — cambios menores en el
futuro, ninguno mayor — antes de empezar a mostrar el proyecto en público.

**Método.** Cinco revisiones independientes (lenguaje y compilador; compatibilidad
SCSS; modelo de tema y runtime; instalación, CLI y empaquetado; documentación,
playground y posicionamiento) más pruebas propias sobre el compilador. Todo lo
afirmado aquí se ejecutó contra `dist/` compilado o contra tarballs reales; cada
hallazgo lleva su reproducción. Los scripts quedaron en el scratch de la sesión
(`audit-lang/`, `audit-scss/`, `audit-theme/`, `audit-dx/`, `audit-docs/`); los
comandos clave se repiten en el anexo para que se puedan volver a correr.

---

## 1. Veredicto

**El paradigma es sólido y defendible. La implementación no está lista para
congelarse, pero lo que falta es sobre todo restar, no añadir.**

1. La tesis — *los breakpoints pertenecen al tema, no a los componentes* — está
   implementada de verdad y se puede demostrar con una línea: `padding:
   density(4)` compila a una declaración y la responsividad vive en `:root` por
   breakpoint. Eso no lo hace Tailwind, Open Props ni Sass. Es el producto.
2. Alrededor de esa tesis hay tres promesas que hoy **no se sostienen** y que
   conviene retirar antes de publicar nada: "reemplaza a SCSS" (funciona ~40 %
   de Sass, y un 27 % adicional falla *en silencio*), "sin media queries" (la
   salida tiene entre 8 y 25 bloques `@media` y no hay container queries) y
   "type-safe" (es JSON validado, el CSS no tiene tipos).
3. Hay **un P0 de contrato**: para el mismo tema, el build y el runtime emiten CSS
   distinto cuando el tema usa funciones de token (`radius(2)` sale como
   `var(--uxdsl__radius__2)` en build y como `radius(2)` literal en runtime). La
   causa de fondo es que no existe *un* validador ni *una* gramática de valores
   compartida: hoy hay cinco respuestas distintas a "¿este tema es válido?".
4. La superficie pública es unas tres veces mayor de lo que el paradigma
   necesita: dos APIs de runtime que se pisan, siete formas de dar un tema, un
   parser legacy de `@theme` de 290 líneas sin usuarios, ~110 exports en
   `ds-runtime` de los que ~70 son internos del motor, aliases duplicados
   (`rounded`/`elevation`, `densities()`, `watch`), y cinco paquetes que se
   mueven en lockstep con pins exactos. Congelar eso es congelar deuda.
5. La instalación tiene tres baches que un recién llegado encuentra en la
   primera hora: Vite 8 no instala (rango de peer), `init` en Next.js apaga
   autoprefixer en silencio, y `generate-entry` borra lo que el README te dice
   que escribas.
6. Lo que ya está a nivel 1.0 y no hay que tocar: el motor responsivo, la
   emisión del tema por breakpoint, el modo oscuro, `applyTheme` y su gate
   estructural, los diagnósticos `UXD_*` con posición, `watch` (515 ms de
   arranque, 60–90 ms por rebuild, escrituras atómicas), el parseo estricto de
   flags, la integridad de referencias, los gates desde tarballs, 787 tests.

**Conclusión:** 1.0 es alcanzable con una fase concentrada de *sustracción y
unificación*, sin funcionalidades nuevas. Lo único aditivo que recomiendo es
pequeño y sirve a la estabilidad (una función `tone()` que reemplaza un contrato
por regex, y `space(0)`/`border(0)` por simetría). Todo lo demás son borrados,
renombrados de una sola vez, y documentación.

---

## 2. El paradigma, evaluado

### 2.1 La tesis en una frase

> Las decisiones de diseño —espaciado, tipografía, color, bordes, sombras y
> cómo cambian por breakpoint— viven una sola vez en un tema JSON; los
> componentes las nombran (`density(4)`, `palette(primary.main)`,
> `@ds-button(contained)`) y nunca escriben un breakpoint. El compilador lo
> convierte en CSS corriente, se niega a emitir nada que no resuelva, y el mismo
> JSON se aplica en runtime y se audita.

### 2.2 Lo que está bien sustentado (y la demo que lo prueba)

| Afirmación | Prueba |
| --- | --- |
| **Escribe el token una vez; el tema decide cómo responde.** | `density(4)` = 0.75rem a 390px y 1.5rem a 1280px; `space(4)` constante. Medido en Chrome sobre `/docs/densities`. |
| **Un JSON para build, runtime y auditoría.** | El mismo tema compila (`uxdsl build`), se aplica (`applyTheme`, que rechaza cambios estructurales con `UXD_THEME_STRUCTURE`) y se audita (`theme --diff`, `--contrast`). Las páginas Runtime y Contrast del playground llaman a las funciones reales. *Condición:* arreglar el P0 de paridad (§3.3). |
| **Nada falla en silencio.** | Token indefinido, breakpoint desconocido, directiva mal colocada, flag con typo → código `UXD_*` con archivo:línea:columna y sugerencia. *Condición:* cerrar los ~14 casos silenciosos que quedan (§3.1, §3.2). |

### 2.3 Lo que no se sostiene y hay que dejar de decir

| Claim | Realidad | Qué decir en su lugar |
| --- | --- | --- |
| "Reemplaza a SCSS / todo SCSS funciona" | Pipeline: `postcss-scss` (parser) → `postcss-import` → `postcss-advanced-variables@3` → `postcss-uxdsl`. Sin plugin de nesting. De 51 features de Sass: 21 iguales, 7 distintas (nesting nativo sin aplanar), **14 silenciosas**, 9 con error. `@include pad(density(2))` → `padding: densit;` exit 0. | "`.uxdsl` es CSS (incluido nesting nativo) más un subconjunto documentado: `$var`, `@if/@else`, `@each` de listas, `@for`, `@mixin/@include` posicional, `@content`, `@import` con ruta." |
| "Sin media queries" | 8 `@media` en una regla trivial, 25 en el playground. Todo compila a `min-width` de viewport; sin container queries. | "Los breakpoints pertenecen al tema, no a tus componentes." |
| "Type-safe" | JSON con schema + integridad de referencias. Nada en el CSS está tipado. | "Validado: cada referencia se comprueba en build." |
| "Fluid typography" | Escalonada por breakpoint; cero `clamp()` en el tema base. | "Tipografía responsiva por rol." |
| "Runtime sin rebuild" | Valores sí; estructura (campo nuevo, estado nuevo, umbral movido) no, y se rechaza explícitamente. | "Runtime opcional: los valores cambian sin rebuild; la estructura se rechaza en vez de fallar en silencio." |

### 2.4 Comparativa honesta (resumen)

- **Tailwind v4:** UXDSL pone la progresión en el token; Tailwind la pone en
  cada elemento (`p-3 md:p-4 xl:p-6`). Tailwind tiene container queries,
  variantes arbitrarias y un ecosistema enorme. Ese es el eje del artículo.
- **Open Props:** tokens sin build, con escalas fluidas `clamp()`. UXDSL añade
  roles, validación y JSON como fuente; carece de escalas fluidas.
- **Panda / vanilla-extract:** tipado completo, recetas, condiciones con
  container queries; Panda también puede expresar tokens responsivos. UXDSL se
  escribe en CSS, sin codegen, con runtime y diagnósticos localizados.
- **Sass:** es un lenguaje real. UXDSL no lo es ni debe fingirlo.
- **Style Dictionary / DTCG:** UXDSL cubre el lado del *consumo*; su JSON es
  propietario (no DTCG) y no exporta a iOS/Figma.

### 2.5 Objeciones que llegarán y su respuesta honesta

1. *"Es CSS variables + media queries; lo escribo yo."* Sí, esa es literalmente
   la salida. UXDSL genera y valida esa escalera desde una definición, la
   mantiene en JSON para que build, runtime, auditoría y agentes lean lo mismo,
   y convierte un `var()` sin definir en error de build. Con cinco tokens,
   escríbelo a mano.
2. *"Los componentes modernos necesitan container queries."* Cierto y es un
   hueco real: `xs()…xl()` compilan solo a viewport. Usa `@container` nativo al
   lado; soporte en hoja de ruta, no prometido.
3. *"Siete betas, un solo autor."* La congelación de este documento y una
   política escrita de soporte son la respuesta.
4. *"Tu tema por defecto falla tu propio gate de contraste."* Hoy sí (123
   pares). Con las tres decisiones de §5.3 pasa honestamente. Hay que
   resolverlo antes del artículo o será el titular.
5. *"`@ds-button` es un mixin; Sass lo tenía en 2010."* Es un mixin generado
   desde roles JSON con estados y tonos que además alimentan runtime y
   contraste. El valor es el motor compartido, no la sintaxis.

### 2.6 Titular y ejemplo recomendados

**Titular:** *Breakpoint-free components. Responsive tokens.*

```json
{ "densities": { "4": "xs(space(4)) md(space(5)) xl(space(6))" } }
```
```css
.card { @ds-surface(contained); padding: density(4); gap: xs(0.5rem) md(1rem); }
```
```css
:root { --uxdsl__density__4: var(--uxdsl__space__4); }
@media (min-width: 768px)  { :root { --uxdsl__density__4: var(--uxdsl__space__5); } }
@media (min-width: 1280px) { :root { --uxdsl__density__4: var(--uxdsl__space__6); } }
.card { /* superficie… */ padding: var(--uxdsl__density__4); gap: 0.5rem; }
@media (min-width: 768px) { .card { gap: 1rem; } }
```

---

## 3. Hallazgos por capa

Severidad: **P0** bloquea la congelación · **P1** antes de congelar · **P2**
después. "Rompe" = cambia sintaxis u opciones públicas hoy aceptadas.

### 3.1 Lenguaje y compilador

| Id | Sev | Hallazgo | Reproducción | Recomendación | Rompe |
| --- | --- | --- | --- | --- | --- |
| L1 | P1 | Función responsiva anidada dentro de otra función pasa sin tocar | `width: calc(100% - xs(1rem) md(2rem))` y `var(--x, xs(1rem) md(2rem))` → literal, CSS inválido, sin error | `UXD_BREAKPOINT_CONTEXT` | no |
| L2 | P1 | Responsivo dentro de `@keyframes`/`@font-face` genera `@media` dentro del at-rule | `@keyframes k{from{padding: xs(1rem) md(2rem)}}` → `@media` dentro del keyframe | error cuando el ancestro es `@keyframes`/`@font-face`/`@page` | no |
| L3 | P1 | Argumento vacío se descarta en silencio y deja reglas vacías | `padding: md(2rem)` → `.a{}` + media; `xs()` → nada | `UXD_BREAKPOINT_EMPTY`; borrar reglas vaciadas | no |
| L4 | P1 | Nombres sensibles a mayúsculas: otras grafías pasan como CSS inválido | `Space(1)`, `PALETTE(primary)`, `@DS-SURFACE(...)` → literal | normalizar a minúsculas antes de comparar | no |
| L5 | P1 | Argumentos extra: cada función reacciona distinto | `border(1, red, dashed)` → ignora; `radius(2, 3)` → "no existe"; `space(4, 0.5)` → error de alfa | una regla: un argumento para `space/density/radius/shadow/border`; alfa opcional solo en `palette/color`; `UXD_*_ARGUMENT` | sí (`border(n,color,style)` documentado como "ignorado") |
| L6 | P1 | `densities(1,2,3)` plural, sin documentar, salta la integridad de referencias | `gap: densities(99)` → `var(--uxdsl__space__99)` sin error | eliminar | sí |
| L7 | P1 | `space()/palette()/color()` no se validan al reescribir (solo la red de integridad, sin "did you mean") | `space(99)` → error de integridad en la columna de la declaración; con `references.mode:'off'` compila | validar todas las funciones en `rewriteFuncs` con `UXD_SPACE_REFERENCE` etc. | no |
| L8 | P1 | Gramática de directivas laxa e inconsistente | `@ds-surface(contained)`, `@ds-surface (contained)`, `@ds-surface contained`, `@ds-surface()`, `(contained, primary, 2)`, `(2 primary contained)` todas aceptadas; `(contained primary secondary)` usa primary en surface pero error en button | una gramática: `@ds-x(role [tone] [size] [radius(k)] [shadow(k)])`, paréntesis obligatorios, error en extra/duplicado | sí (formas sin documentar) |
| L9 | P1 | Tono no se valida si hay rol | `@ds-surface(contained bogus)` → 2 errores de referencia; `(contained text)` → falta `text-contrast` | validar con `getToneFamilies()`: `UXD_SURFACE_TONE` | no |
| L10 | P1 | Dos directivas de control en una regla dan precedencias contradictorias | `@ds-button(contained); @ds-button(outlined)` → base gana outlined, estados ganan contained | `UXD_DIRECTIVE_DUPLICATE` | no |
| L11 | P1 | Un tema no puede *quitar* un breakpoint por defecto; y `opts.breakpoints` del plugin reemplaza el mapa entero (tres formas aceptadas) | `breakpoints:{xs:0,tablet:600}` sigue teniendo `md`; `opts.breakpoints:{a:0,b:500}` + tema base → `UXD_EDGE_BP: xs` | `theme.breakpoints` como única fuente; documentar que el tema base reserva `xs sm md lg xl`; eliminar la opción del plugin | sí |
| L12 | P1 | Validación de breakpoints incidental y esquivable | `md:-5` → `UXD_TYPO_BP` (código de tipografía) sin archivo; con `references off` → `@media (min-width: 0px)` | `validateBreakpoints` una vez al inicio de `Once()` con `UXD_BP_INVALID` | no |
| L13 | P2 | Directiva + override emite ambas declaraciones | `@ds-surface(contained); padding: density(4)` → `padding` dos veces | documentar como cascada intencional o deduplicar misma propiedad | no |
| L14 | P2 | Aliases: `rounded()`, `elevation()`, `radius(full)`; y no funcionan como argumento de directiva | `@ds-surface(contained rounded(2))` → "Invalid palette family" | un nombre por concepto: `radius`, `shadow`, `pill` | sí |
| L15 | P2 | Comillas en directivas medio implementadas | `@ds-typo("h1")` → "¿Quisiste decir h1?" | borrar el código de comillas; error | no |
| L16 | P2 | Dos grafías de paleta conviven; el tema base mezcla ambas | README `palette(primary.main)`; playground 374× `palette(primary-main)`; base.json usa las dos | punto como canónica; guion eliminado con sugerencia (0 usuarios) | sí |
| L17 | P2 | Claves cero incoherentes | `density(0)`, `radius(0)`, `shadow(0)` existen; `space(0)`, `border(0)` no | añadir `space.0: "0"`, `border.0: "none"` | no |
| L18 | P2 | Grupos por slot sin documentar y con trampa | `padding: xs(1px) 5px md(2px)` → md con 3 valores | documentar; error si un grupo no tiene base | no |
| L19 | P2 | `!important` dentro de un grupo solo aplica a ese breakpoint | `xs(1px !important) md(2px)` | error | no |
| L20 | P2 | Nombres de variables tipográficas abreviados de forma irregular | `-size`, `-line`, `-weight`, `-spacing` vs `-font-family`, `-margin-block-start` | usar el nombre de la propiedad CSS: `-font-size`, `-line-height`, `-letter-spacing` | sí |
| L21 | P2 | Salud de `index.ts` | 1.040 líneas, un `Once()` de ~850, 16 recorridos del árbol, 42 `as any`, estado en `root.__btnPacks`, 288 líneas (28 %) de parser legacy `@theme`, 85 comentarios con IDs de story en `src/` | extraer `validateOptions / emitTheme / expandDirectives / expandResponsive`; borrar el parser legacy; mover la historia al CHANGELOG | no |

Verificado y correcto (no tocar): persistencia del valor base entre breakpoints;
independencia del orden (`md() xs()`); dedupe de valores iguales; `!important`
propagado; tokens dentro de `calc()`, gradientes, `var()` fallback, custom
properties, `rgb(from palette(…))`; alfa → `color-mix()`; `@media`/`@supports`/
`@container` envolventes; `&:hover` y reglas anidadas; salida **idempotente**
(recompilar la salida con `includeTheme:false` es byte-idéntico).

### 3.2 Compatibilidad SCSS

Matriz completa en el informe de origen (`audit-scss/results.txt`, 110 casos).
Resumen de 51 features de Sass:

| Estado | Cuántas | Ejemplos |
| --- | --- | --- |
| Igual que Sass | 21 (41 %) | `$var`, `!default`, ámbito de bloque, `#{$var}` en selector/valor/media, `@if/@else`, `@each` de lista, `@for`, `@mixin/@include` posicional, `@content`, `@import` con ruta, `//` comentarios, `$c: palette(primary.main)`, `calc(100% - space(2))` |
| Distinto (nesting nativo, sin aplanar) | 7 (14 %) | `.a{.b{}}`, `&:hover`, `& + &`, `.x &`, `@media` dentro de regla → se reenvían al navegador tal cual (Chrome 120+, Safari 17.2+, Firefox 117+; especificidad `:is()`) |
| **Silencioso** (exit 0, CSS inválido) | **14 (27 %)** | `@include pad(density(2))` → `padding: densit;` · `@include pad(xs(1px) md(2px))` → `padding: x;` · `&__elem`/`&--mod` (BEM) · `@extend`/`%placeholder` · `darken()`, `map-get()`, `nth()` · `10px * 2`, `$a + $b`, `1rem + 2px` (Sass lo rechaza; UXDSL lo envía) · `#{palette(…)}`, `#{$p}-top` · `!global` · `@while`, `@at-root`, `@use`, `@forward` |
| Error | 9 (18 %) | `@function`, argumentos con nombre y variádicos, `@else if` (mensaje engañoso), `@each $k, $v`, `@use "x" as p` |

**Causa del caso más grave:** `postcss-advanced-variables` parte los argumentos
de `@include` en el *primer* paréntesis (`params.split('(', 2)`), así que
cualquier llamada con paréntesis dentro se trunca. Es justo el idioma que un
usuario combina con tokens.

**¿Sass real como pre-paso? No.** Probado de punta a punta: Dart Sass rechaza
`palette(primary.main)` (`ident.ident` es miembro de módulo), no evalúa `$var`
en preludios de at-rules desconocidos (`@ds-surface($tone)` falla sin `#{}`),
y sus funciones no pueden tocar tokens (`darken(palette(primary), 10%)` → "no es
un color"). El rendimiento no es el problema (+33 %); la colisión de sintaxis sí.

**Recomendación (DE-2):** acotar el claim a "CSS + subconjunto documentado",
hacer que los 14 casos silenciosos **fallen** (extender la guarda "cero salida
silenciosa" de MIG-B6-14 a `$name` sobrante, `#{`, `%selector`, `!global`,
at-rules solo-Sass, funciones solo-Sass, `&-sufijo` → `UXD_NESTING_INVALID`), y
pre-validar los argumentos de `@include` (paréntesis balanceados) hasta que el
plugin upstream se arregle o se reemplace. Documentar el workaround verificado:
`$d: density(2); @include pad($d)`.

### 3.3 Modelo de tema y validación

| Id | Sev | Hallazgo | Reproducción | Recomendación | Rompe |
| --- | --- | --- | --- | --- | --- |
| T1 | **P0** | **Build y runtime emiten CSS distinto para el mismo tema.** El pase final del plugin reescribe funciones de token también dentro del `:root` generado; `generateThemeCss` (runtime/SSR/`applyTheme`) no | `radii.x:'radius(2)'` → build `var(--uxdsl__radius__2)`, runtime `radius(2)`; igual `shadows`, `palette.brand.main:'color(gray.300)'`, `palette(primary, 0.5)`. El runtime reporta `ok:true` | una gramática de valores para todas las familias, resuelta en los motores (`presetValueToCss`/`foundations.ts`) para que ambos caminos sean byte-idénticos; restringir el pase final a nodos del autor; test de paridad por familia | no |
| T2 | **P0** | **No hay un validador.** Cinco respuestas distintas a "¿es válido?": plugin (por motor), `validateAndNormalizeTheme` (solo `applyTheme` y CLI), `generateThemeCss` (nada), schema JSON (más estricto que los motores), CLI. Hojas numéricas/`null`/objeto se emiten literalmente | `spacing.1: 8` → `--uxdsl__space__1: 8;`; `palette.primary.main: 5` → `5`; `{}` → `[object Object]`; `null` → `null;` en plugin, CLI, `generateThemeCss` y `applyTheme` (`ok:true`); solo el schema lo rechaza | `validateTheme(theme)` único: toda hoja string no vacía, `null` inválido, familias/claves cerradas donde toca, breakpoints con las reglas de `validateBreakpoints`, roles en minúsculas; lo llaman plugin, `generateThemeCss`, `applyTheme` y CLI; el schema se deriva de él | no |
| T3 | P1 | Inyección de CSS por strings del tema (el CSS del tema se concatena y se parsea) | `typography:{'font-x':'a; } .hack { color: blue'}` → emite `.hack`; el editor JSON del playground alimenta este camino | cubierto por T2 (validar `;{}` y paréntesis) y construir el tema con nodos postcss, no strings | no |
| T4 | P1 | Coerciones del validador crean el desacuerdo runtime/build | `breakpoints.md:"768"` → plugin error, `applyTheme` ok (coerce); `fontWeight:700` igual; `fonts.google:"Inter"` → plugin ignora, runtime rechaza; `fonts.families.ui:'Inter Tight, sans-serif'` → plugin sin comillas, runtime con comillas | sin coerciones; error | no |
| T5 | P1 | El tema base usa nombres de variable compilada en vez del lenguaje | `palette.text.primary: "var(--uxdsl__palette__surface-contrast)"` mientras `borders` usa `color(gray.300)`; el autor del tema tiene que conocer el esquema de nombres para una familia y no para otra | con T1, `palette(surface.contrast)` en el tema; `var(--uxdsl__…)` solo como escape documentado | no |
| T6 | P1 | La sustitución de tono en botones/inputs es una regex sobre un literal mágico | `states.hover.bg: 'palette(primary.dark)'` no varía por tono; solo `var(--uxdsl__button__tone-X, var(--uxdsl__palette__primary-X))` exacto lo hace; base.json lleva ese literal | función `tone(main\|dark\|contrast)` de primera clase que compila a la cadena actual; reescribir base.json | no si el literal sigue funcionando |
| T7 | P1 | `modes` es un caso único sin documentar como API | solo `dark`, solo `palette`; `modes.light` se ignora en silencio; el interruptor público (`data-theme="dark\|light"` en `<html>`) no aparece en README ni AGENTS | congelar `modes: { dark: { palette } }` y documentar `data-theme`; generalizar más tarde es aditivo | no |
| T8 | P1 | Emisión por defecto grande, sobre todo por tonos | 1 regla → **50,6 KB, 745 declaraciones, 617 nombres, 19 `:root`, 8 `@media`**; 341 nombres son variantes `-tone-*` idénticas al valor sin tono (`…-tone-{11 tonos}-disabled-opacity: 0.6`) | emitir variante de tono solo cuando la sustitución cambió el valor | no |
| T9 | P1 | El playground define cada token dos veces | `uxdsl.css` (144 KB, 31 `:root`): `--uxdsl__space__4` ×2, `--uxdsl__typography__h1-size` ×8, `primary-main` ×6, porque la entrada importa 11 `default-*` legacy **y** el JSON emite lo mismo; solo `default-colors.css` aporta nombres nuevos | eliminar los imports legacy salvo colores; llevar esos colores a un override JSON | no |
| T10 | P1 | Un `:root` del autor pierde contra el tema | el tema se `append`a después de las reglas del autor (salvo densidad); el mantenedor ya lo sufrió y borró su override en vez de arreglar el orden | insertar *todo* el tema en un solo punto, tras el preludio y antes de las reglas del autor | no |
| T11 | P2 | Familia legacy `typography` plana | emite el único nombre sin namespace (`--font-code`); nadie lo consume | eliminar de base.json, tipos, schema, `KNOWN_THEME_FAMILIES` | sí |
| T12 | P2 | `colors` vestigial; la paleta no referencia colores | base: `colors.gray` con 4 tonos; `palette` 0 referencias a `colors`; AGENTS predica "preserva las referencias Palette→Color" | poblar `colors` (incl. `white`/`black`) y que la paleta base los referencie: valores, no contrato | no |
| T13 | P2 | Rangos numéricos irregulares | `densities` 0–15, `spacing` 1–16, `radii/shadows` 0–5, `borders` 1–5 | documentar en el schema; L17 | no |
| T14 | P2 | `theme-manifest.json` publicado y desactualizado | lista `--motion-*`, `--ds-btn-*`, `density min 1 max 16`, variantes de `ds-typo` incompletas | eliminar o generar | no |
| T15 | P2 | Botones sin `disabled` ni `focusvisible` por defecto; añadirlos luego es estructural bajo `applyTheme` | `.btn{@ds-button(contained)}` → solo `:hover` y selected | añadir ambos estados a base.json antes de congelar | no |

**Contraste (los 123 pares):** el gate no es demasiado estricto en lo que
comprueba, sí en su granularidad (excepciones por par resuelto). Descomposición
exacta: 95 por familias de identidad de lienzo (`surface`, `light`, `dark`)
usadas como tono de texto/borde; 13 por `warning.main` (3.19:1) en claro; 9 por
placeholder sin tono en oscuro; 6 por `neutral` en oscuro. **17 de los 123 son
valores del modo oscuro, no hallazgos de motor.** Con dos valores corregidos y
un `warning` re-elegido quedan 97, todos de identidad, cubribles con tres
excepciones por patrón (§5.3).

### 3.4 Runtime

| Id | Sev | Hallazgo | Reproducción | Recomendación | Rompe |
| --- | --- | --- | --- | --- | --- |
| R1 | **P0** | **Dos APIs de runtime con modelos de estado contradictorios.** Los setters legacy (`updatePalette`, `updateSpacing`, `updateBreakpoint`, `subscribe`, `link`… ~25 exports) son singletons que escriben `style` inline en `<html>`; `applyTheme` es por documento y escribe un `<style>`. El inline gana | `updatePalette('primary.main', red)` y luego `applyTheme({palette:{primary:{main: green}}})` → `ok:true` y la página sigue roja. El playground necesita un iframe aparte y `clearRuntimeInlineTokens()` para que no se peleen. El README "60 segundos" **todavía enseña `updatePalette`** | eliminar todo el runtime legacy, `legacy-storage.ts` (migración de claves pre-beta.6 que nadie tiene), el marcador `/*@uxdsl-bp*/` + `#uxdsl-bp-meta`; API única: `applyTheme / getAppliedTheme / resetTheme / subscribeTheme / loadPersistedTheme` | sí (0 usuarios) |
| R2 | P1 | `updateBreakpoint` reescribe por regex solo las hojas `data-uxdsl`; la hoja de `applyTheme` no cambia | layout cambia a 900, densidad sigue en 768; `getBreakpoints()` y `getAppliedTheme()` discrepan | cubierto por R1 | sí |
| R3 | P1 | El marcador de breakpoints miente bajo Vite/Webpack | `compile({source},{theme:{breakpoints:{md:800}}})` emite `@media 800px` y el marcador dice 768 | cubierto por R1 | sí |
| R4 | P1 | `ds-runtime` exporta ~110 nombres, ~70 internos del motor | `parseOverrideArguments`, `surfaceValueToCss`, `compile*Rules`, `*ComponentCss`… usados solo por el playground | separar `runtime` (navegador, sin importar postcss) / `theme` (isomórfico) / `engine` (declarado exento de semver) | sí |
| R5 | P1 | El bundle de runtime pesa 149 KB min / 47 KB gz porque arrastra el parser de PostCSS | `theme-generator`, `contrast`, `control-engine` hacen `require('postcss')` | el `runtime` 1.0 no importa postcss; separar generación de aplicación | interno |
| R6 | P2 | Gate estructural: `null` da tres resultados distintos según la familia | `palette.primary.light: null` aceptado (emite `null`); `fonts.families.code: null` rechazado; `modes: null` acepta y borra el oscuro | T2 lo unifica: `null` inválido en todas partes; documentar cómo se quita el oscuro (override estructural → rebuild) | no |
| R7 | P2 | `ThemeOverride = Record<string, any>` no distingue override de tema efectivo | el playground inicializa con el tema completo; `getAppliedTheme()` devuelve 475 líneas | tipar como `UxdslThemeOverride` | no |

Verificado y correcto: contrato de `applyTheme` (síncrono, valida → genera →
diff estructural → commit; `ok:false` no toca nada; estado por `document`;
adopción de `<style id>` para SSR); `generateThemeCss` puro; persistencia
coherente; modo oscuro.

### 3.5 Instalación, CLI y empaquetado

| Id | Sev | Hallazgo | Evidencia | Recomendación | Rompe |
| --- | --- | --- | --- | --- | --- |
| I1 | **P0** (seguridad) | El `package.json` raíz se llama `uxdsl`, versión 1.0.0, **sin `private: true`**; `uxdsl` está libre en npm | `npm view uxdsl` → 404 | `"private": true` hoy | no |
| I2 | P1 | Vite 8 no instala: rango de peer `^4 \|\| ^5 \|\| ^6 \|\| ^7`; `npm create vite@latest` da 8.3 | ERESOLVE en el paso 1 del README; con `--legacy-peer-deps` funciona | `vite: ">=4"`; añadir Vite 8 a la matriz | no |
| I3 | P1 | `init` en Next.js escribe un `postcss.config.js` que apaga los plugins por defecto de Next | `user-select:none` pierde `-webkit-` tras `init`; sin documentar | escribir los defaults de Next + `postcss-uxdsl` en el archivo generado; documentar | no |
| I4 | P1 | Sin CLI no se puede usar en Next.js: la emisión del tema es por compilación | plugin solo: `page.module.css` → `Selector ":root" is not pure`; `includeTheme:false` → nadie emite el tema | a corto plazo: el CLI es el camino documentado. Opcional (DE-9): marcador `@uxdsl theme;` en un solo CSS | aditivo |
| I5 | P1 | `generate-entry` borra lo escrito a mano en la entrada; el README dice que escribas ahí | `postcss-uxdsl/README.md:47` vs archivo "DO NOT EDIT" | `init` crea `src/styles.uxdsl` (tuyo) importado desde la entrada generada; corregir README | no |
| I6 | P1 | Primer `npm install` muestra "1 high severity, no fix available" | `postcss-advanced-variables@3` → `postcss@7` | `overrides` a postcss 8 y documentar; a medio plazo reemplazar el plugin (DE-2) | no |
| I7 | P1 | `postcss` es dependencia dura en 4 paquetes → 5 copias junto a Next | `node_modules` de S2 | `peerDependencies: { postcss: "^8.4" }` | no |
| I8 | P1 | Siete formas de dar un tema, tres nombres de config, dos formas de exportar, `references` en dos sitios, `breakpoints` en tres | `config.ts`, `uxdsl.js` | un config (`uxdsl.config.js`, `.cjs` aceptado), un tema (`uxdsl.theme.json`, `.js` para computados), tema exporta solo el tema, `references` solo en config, `breakpoints` solo en tema | sí |
| I9 | P1 | Los tarballs locales llevan el número de la versión publicada con código sin publicar | `dist/index.js` sha ≠ registro con el mismo `0.5.0-beta.6` | tras cada publicación, bump a `-dev` | no |
| I10 | P2 | Sin `--version`; sin ayuda por comando; `uxdsl` a secas construye en silencio | `--version` → "Unknown option" | añadir ambos; bare → ayuda | no |
| I11 | P2 | Duplicados: `watch` vs `build --watch`; `--strict-theme` vs `--strict`; `--sourcemap` vs `sourceMap`; `--out` sobrecargado; `theme --entry/--out` sin sentido | `bin/uxdsl.js` | tabla en §5.2 | sí |
| I12 | P2 | Cinco paquetes en lockstep con pins exactos; `postcss-uxdsl` y `uxdsl-core` ambos "core"; el CLI lleva 90 líneas para sobrevivir al desfase de versiones | READMEs, `bin/uxdsl.js:13-88` | **un paquete `uxdsl`** con subpaths (`uxdsl/postcss`, `uxdsl/vite`, `uxdsl/webpack`, `uxdsl/runtime`, `uxdsl/theme`, `uxdsl/config`, `uxdsl/engine`); extensión VS Code aparte | sí (0 usuarios) |
| I13 | P2 | Tarball de `postcss-uxdsl`: 626 KB desempaquetado, ~230 KB no es código | CHANGELOG 65 KB, README 54 KB, agent-guide 51 KB, packs legacy 50 KB | recortar `files` | no |
| I14 | P2 | Extensión VS Code: lista técnicamente; le faltan `icon`, `license` + LICENSE (Open VSX lo exige), `keywords`, README de marketplace | `packages/uxdsl-vscode` | completar y publicar (MIG-B7-05) | no |
| I15 | P2 | No hay `LICENSE` en el repo; los cinco README enlazan uno | arrastrado desde beta.6 | añadir MIT | no |

Verificado y correcto: `watch` (515 ms / 62–87 ms, atómico, recupera), parseo
estricto con sugerencias, códigos de salida vía `exitCode` (seguro con pipes),
Webpack funciona a la primera con el README, descubrimiento de tema coherente
entre CLI y Vite, Next.js con CLI funciona a la primera.

### 3.6 Documentación

| Id | Sev | Hallazgo | Recomendación |
| --- | --- | --- | --- |
| D1 | P1 | El README raíz es un changelog: abre con validación pendiente y 123 fallos antes de una línea de sintaxis; el quick start está bajo el título "beta.5"; cero `xs()`/`density()` en 356 líneas | README raíz ≤120 líneas: qué es, por qué, ejemplo de 5 líneas, instalación, tabla de paquetes, enlaces |
| D2 | P1 | `postcss-uxdsl/README.md`: 1.118 líneas, ~48 % historia/estado/evidencia; "as of 2026-09-28" ×25 | ≤150 por paquete; historia al CHANGELOG y `docs/releases/` |
| D3 | P1 | Faltan tres referencias: gramática de todas las funciones y directivas; forma de las 15 familias; catálogo de `UXD_*` (67 en código, 31 en doc, 12 en la web) | páginas generadas desde `LANGUAGE_COMPLETIONS`, el schema y el registro de códigos |
| D4 | P1 | La tesis nunca se enuncia en un párrafo; tres taglines distintos | §2.1 y §2.6 |
| D5 | P1 | APIs legacy enseñadas en el camino del recién llegado (`updatePalette` en "60 segundos", `breakpoints.update` en README y `/docs/breakpoints`) | con R1, solo `applyTheme` |
| D6 | P2 | `migration.md` en español (voseo), enlazada como "the migration guide"; historias FEAT en español; web en inglés | un idioma para todo lo público (inglés); las historias internas pueden seguir en español |
| D7 | P2 | Dos hosts sin redirección (`uxdsl.io` en AGENTS/schema; `uxdsl.vercel.app` en badges, metadata, sitemap) | un canónico + 301 |
| D8 | P2 | AGENTS.md: ~600 líneas de contrato + ~150 de historia + ~150 de proceso | contrato ≤600; proceso a `CONTRIBUTING.md`; historia fuera |

### 3.7 Playground

| Id | Sev | Hallazgo | Recomendación |
| --- | --- | --- | --- |
| P1 | P1 | La portada no demuestra el paradigma: sin código sobre el pliegue; la primera demo es el editor de umbrales (justo lo que `applyTheme` rechaza) | rehacer el pliegue: tesis en una frase, el `.uxdsl` de 5 líneas junto a su CSS, y un **marco redimensionable** con una tarjeta cuya `density(4)` cambia mientras un lector muestra el valor vivo |
| P2 | P1 | Desbordamiento horizontal a 390px en `/`, `/docs/buttons`, `/docs/cli` (1.526px), `/docs/productivity`; bloques de código sin `overflow-x` | arreglar |
| P3 | P1 | `/docs/productivity` renderiza 3.000 tarjetas: 387.585px de alto en móvil | limitar a 24–48 o quitar |
| P4 | P1 | Modo oscuro: la cabecera conserva el degradado claro; subtítulo del hero gris sobre negro | arreglar |
| P5 | P1 | Quick-start abre con banner naranja "Not Production Ready", recomienda Vite (los README recomiendan CLI) y nunca muestra un `.uxdsl` | un camino, un archivo real y su salida; línea de versión en vez de banner |
| P6 | P2 | 39 rutas: 12 duplicados sin sidebar, `/theming` sobrante, `/docs/home` ≈ `/` | ≈18 rutas: cortar duplicados, fusionar colors+palette, spacing+densities, config→theme |
| P7 | P2 | Cada página de token termina con 1,5–3k px de "AI implementation guide"; la demo queda a mitad de página tras muros de JSON | una página `/docs/for-ai-agents`; demo antes del JSON; ≤4k px por página |
| P8 | P2 | Botones: JSON/CSS como texto sin estilo; cabecera sin Docs/GitHub/npm; "UX-DSL" vs "UXDSL"; píldora "XL 1280px" sin explicar | pasada de consistencia |

### 3.8 Proceso y repositorio

- **Ceremonia:** commits "fix evidence table SHA reference", tablas de evidencia
  por story, 85 comentarios con IDs de story en el código. Rigor técnico sí
  (tests, gates desde tarballs); burocracia no.
- **Versionado:** `main` lleva versiones publicadas con código sin publicar; sin
  bump `-dev` tras publicar.
- **Worktrees de agentes** commiteados como submódulos en `docs/playground-page-audit`
  (`ba589ea`); no están en `main`. Sacar del índice y añadir `.claude/worktrees/`
  a `.gitignore`.
- **CI real** (MIG-B7-04) sigue pendiente. Con un solo desarrollador, es lo que
  protege la congelación.

---

## 4. Lo que está bien (y no hay que tocar)

- El mecanismo responsivo: base persistente, orden independiente, dedupe,
  `!important`, grupos por slot, tokens dentro de `calc()`/gradientes/`var()`.
- La emisión del tema por breakpoint en `:root` y el modo oscuro con
  `prefers-color-scheme` + `data-theme`.
- `applyTheme`: síncrono, atómico, con gate estructural explícito.
- Diagnósticos con código, posición y sugerencia; parseo estricto de flags.
- Integridad de referencias (24.000 líneas en 0,79 s).
- `watch` y las escrituras atómicas.
- Los gates desde tarballs (`verify:beta2…7`), el recorrido en Chrome del
  playground, los ejemplos de documentación compilados, la matriz de
  capacidades derivada del código.
- 787 tests en ~90 s.
- La guía de agentes como idea (nadie más la tiene); solo hay que adelgazarla.

---

## 5. Plan de estabilidad

### 5.1 Principio

**Congelar por sustracción.** Cada cosa que se congela hay que mantenerla para
siempre. Antes de congelar: borrar todo lo que no sostiene el paradigma,
unificar lo que está duplicado, renombrar de una sola vez lo que quedará mal
nombrado, y solo entonces declarar el contrato. Sin usuarios, cada borrado y
cada renombrado es gratis hoy y carísimo después de 1.0.

**Ninguna funcionalidad nueva** salvo las que reemplazan un contrato malo por
uno bueno (`tone()` en vez de una regex; `space(0)`/`border(0)` por simetría) y,
opcionalmente, el marcador `@uxdsl theme;` que hace opcional el CLI en Next.js.

### 5.2 Decisiones del dueño

Cada una con mi recomendación. Las marcadas ★ cambian sintaxis o API y hay que
tomarlas antes de tocar código.

| Id | Decisión | Recomendación | Por qué |
| --- | --- | --- | --- |
| DE-1 ★ | Un paquete `uxdsl` con subpaths, o cinco paquetes | **Uno.** | Ya se mueven en lockstep con pins exactos; dos "core" confunden; `npm i -D uxdsl` en todos los caminos; el rename es gratis hoy. Publicar los cinco nombres viejos una última vez como shims deprecados. |
| DE-2 ★ | Alcance SCSS | **CSS + subconjunto documentado; los casos silenciosos fallan; no Sass real.** | §3.2. Mantener `postcss-advanced-variables@3` con pre-validación de `@include` y `overrides` de postcss; evaluar reemplazarlo por una implementación propia mínima *después* de 1.0, no antes. |
| DE-3 ★ | Runtime: `applyTheme` solo | **Sí.** Borrar setters legacy, `breakpoints` API, `legacy-storage`, marcador `#uxdsl-bp-meta`. | R1–R3. El playground simula anchos con `inspectResponsiveValue`, que ya existe. |
| DE-4 ★ | `@theme` legacy, `default-*.uxdsl/.css`, `theme-manifest.json`, familia `typography` plana, `densities()`, `rounded()/elevation()/radius(full)`, opciones `themeVar/spaceVar/colorVar/breakpoints`, aliases `UxDslOptions`/`output`, `watch`, `theme --strict`, Vite `scss:'on'` | **Borrar todo.** | Cero usuarios; cada uno es una segunda forma de hacer algo. |
| DE-5 ★ | Gramática canónica: `palette(family.variant)` con punto; un argumento por función de preset; alfa solo en `palette/color`; directivas con paréntesis obligatorios `@ds-x(role [tone] [size] [radius(k)] [shadow(k)])` | **Sí; el guion en paleta se elimina con sugerencia.** | L5, L8, L16. Migrar el playground con un codemod (374 usos). |
| DE-6 ★ | Nombres de variables tipográficas con el nombre de la propiedad (`-font-size`, `-line-height`, `-letter-spacing`) | **Sí, ahora.** | L20. Después de 1.0 es un breaking change para cualquier `var()` escrito a mano. |
| DE-7 | Contraste (cierra D-8 y D-9 de FEAT-009) | **D-8 = (a) como excepción por patrón** (tres registros `{ tone: 'surface'\|'light'\|'dark' }` que cubren los 97 pares de identidad, en vez de 95 registros por par). **D-9 = (b)**: `warning = { main: #b45309, dark: #92400e, contrast: #fff }` y en oscuro `{ main: #fbbf24, dark: #f59e0b, contrast: #000 }`. **Además**: `modes.dark.palette.neutral.dark = #94a3b8` y `modes.dark.palette.light.dark = #334155`. | Verificado con el script `audit-theme/probe-contrast3.js`: con esos valores quedan 0 fallos no-identidad; con las tres excepciones el gate pasa con todas emparejadas. El informe sigue listando los 97 como exceptuados, no como aprobados: honesto. |
| DE-8 | `modes` | **Congelar `{ dark: { palette } }` y documentar `data-theme="dark\|light"` como API.** | Generalizar a `modes.<nombre>` después es aditivo. |
| DE-9 | Marcador `@uxdsl theme;` para usar el plugin sin CLI en Next.js | **Sí, si cabe en la fase 4; no bloquea.** | Es la única forma de "instalación mínima" en Next; pequeño y aditivo. Mientras tanto, el CLI es el camino y `init` escribe los defaults de Next en `postcss.config.js`. |
| DE-10 | Config: `uxdsl.config.js` (+`.cjs`) y `uxdsl.theme.json` (+`.js`); tema exporta solo el tema; `references` solo en config; `breakpoints` solo en tema | **Sí.** | I8, L11. |
| DE-11 | Tema base demuestra Colors → Palette | **Sí, como valores:** poblar `colors` (incl. `white`, `black`) y que la paleta base referencie con `color(...)`. | T12. Es el ejemplo pedagógico central; hoy el tema base contradice su propia guía. |
| DE-12 | Idioma público | **Inglés en todo lo público** (README, migration, web); historias internas pueden seguir en español. | D6. |
| DE-13 | Nombre del producto y host | **"UXDSL"** en todas partes; **`uxdsl.io`** canónico con 301 desde vercel.app. | P8, D7. |

### 5.3 El contrato que se congela (1.0)

**Lenguaje.** Funciones de valor: `space(k)`, `density(k)`, `color(family.shade[, alpha])`,
`palette(family[.variant][, alpha])` (sin variante ≡ `.main`), `radius(k|pill|circle)`,
`border(k)`, `shadow(k)`, `tone(main|dark|contrast)` (solo dentro de temas),
funciones de breakpoint con los nombres del tema, en el nivel superior del
valor, con `!important` fuera del grupo. Directivas: `@ds-surface`, `@ds-button`,
`@ds-input` con `(role [tone] [size] [radius(k)] [shadow(k)])`, `@ds-typo(role)`,
hijas directas de la regla. SCSS-subset: `$var` (+`!default`, ámbito de bloque,
`#{$var}` en selector/valor/media), `@if/@else`, `@each` de lista, `@for`,
`@mixin/@include` posicional, `@content`, `@import` con ruta. Nesting nativo
reenviado sin aplanar. Catálogo cerrado de códigos `UXD_*`.

**Tema JSON.** Familias: `breakpoints, spacing, densities, colors, palette,
modes, fonts, typography_details, borders, radii, shadows, surfaces, buttons,
inputs`. Toda hoja es string no vacío; `null` inválido; una gramática de valores
para todas (CSS literal, funciones de token, expresiones responsivas, `var()`
como escape); paleta = objetos; `modes = { dark: { palette } }`; merge: objetos
se fusionan, strings/arrays reemplazan. Esquema JSON derivado del validador.

**Variables emitidas.** `--uxdsl__<family>__<key>` sin excepciones; sufijos
tipográficos con el nombre de la propiedad.

**Paquete `uxdsl`.**
- `uxdsl` (bin): `init`, `generate-entry`, `build [--entry --out --config --watch --include-theme --sourcemap[=inline|external]]`, `theme [--diff] [--contrast] [--strict-theme=<familias>]`, `--version`, `<cmd> --help`.
- `uxdsl` (raíz): `compile()`, `resolveTheme`, `DEFAULT_THEME`, `defineConfig`, tipos.
- `uxdsl/postcss`: `uxdsl({ theme?, includeTheme?, references?, discoverTheme?, configRoot? })`.
- `uxdsl/vite`, `uxdsl/webpack`: `theme, references, includeTheme, discoverTheme, configRoot` (+`sourceMap` en webpack).
- `uxdsl/runtime` (navegador, sin postcss): `applyTheme, getAppliedTheme, resetTheme, subscribeTheme, loadPersistedTheme`.
- `uxdsl/theme` (isomórfico): `resolveTheme, deepMergeTheme, validateTheme, generateThemeCss, checkThemeContrast, googleFontsImportUrls, KNOWN_THEME_FAMILIES`; archivos `theme/base.json`, `theme/base.contrast-exceptions.json`, `schema/theme.schema.json`.
- `uxdsl/language` (editores): `resolveResponsiveValue, responsiveEntries, inspectResponsiveValue, validateResponsiveExpression, getToneFamilies, LANGUAGE_COMPLETIONS, KNOWN_CSS_FUNCTIONS`.
- `uxdsl/engine`: todo lo por-familia (`generate*Css`, `inspect*Theme`, `*Declarations`…), **declarado exento de semver** ("API de tooling; puede cambiar en minor").
- `peerDependencies`: `postcss ^8.4`, `vite >=4` (opcional), `webpack ^5` (opcional).

**Fuera del contrato (explícitamente):** container queries, escalas fluidas,
DTCG, generalización de `modes`, completado según el tema del proyecto. Se
listan como "no prometido" para que nadie los espere de 1.0.

### 5.4 Fases

Orden estricto: cada fase deja `npm test` y los gates en verde. Tamaño: S = una
sesión, M = dos o tres, L = una semana de trabajo con agentes.

| Fase | Contenido | Tamaño | Cierra |
| --- | --- | --- | --- |
| **0. Seguridad hoy** | `private: true` en la raíz; peer `vite >=4`; `postcss` a peer; `overrides` de postcss 8; bump a `0.6.0-dev`; sacar los worktrees del índice; `LICENSE` MIT; CI mínima (`npm test` + `verify:beta7` en PR). | S | I1, I2, I6, I7, I9, I15, 3.8 |
| **1. Un validador y paridad** | `validateTheme` único (T2), sin coerciones (T4), llamado por plugin, `generateThemeCss`, `applyTheme`, CLI; una gramática de valores en los motores (T1, T5, T6 con `tone()`); tema construido con nodos (T3); inserción del tema en un solo punto (T10); test de paridad build/runtime por familia y por tema del playground. | L | T1–T6, T10, R6 |
| **2. Sustracción** | Todo DE-3 y DE-4; `ds-runtime` → `runtime`/`theme`/`engine` (R4, R5); config única (DE-10); CLI sin duplicados, con `--version` y ayuda por comando (I10, I11); playground sin imports legacy (T9). | M | R1–R5, I8, I10–I13, L6, L14, T11, T14 |
| **3. Gramática canónica y casos silenciosos** | DE-5 y DE-6; L1–L5, L7–L12, L15, L17, L19; guarda "cero salida silenciosa" ampliada a Sass (DE-2); pre-validación de `@include`; `UXD_NESTING_INVALID`; codemod para el playground; catálogo `UXD_*` cerrado y exportado. | M | L*, 3.2 |
| **4. Un paquete** | DE-1: `uxdsl` con subpaths; shims deprecados de los cinco nombres; `files` recortado; `init` escribe defaults de Next; `init` crea `styles.uxdsl` aparte de la entrada (I5); opcional DE-9. | M | I3–I5, I12, I13 |
| **5. Tema base** | DE-7, DE-8, DE-11; `disabled`/`focusvisible` en botones (T15); `space.0`/`border.0` (L17); variantes de tono solo cuando cambian (T8). Todo son valores: no rompe. | S–M | T7, T8, T12, T13, T15, contraste |
| **6. Documentación y playground** | Arquitectura de docs de §3.6 (12 páginas, inglés, generadas donde son listas); README raíz ≤120; AGENTS ≤600 + `CONTRIBUTING.md`; playground ≈18 rutas, pliegue nuevo con marco redimensionable, bugs P1–P5; extensión VS Code publicada (I14). | L | D*, P* |
| **7. Gate 1.0** | `verify:1.0` desde tarballs (reutiliza beta.7 + paridad + SCSS-silencioso + recorrido Chrome); **ejercicio de prueba**: una app pequeña construida desde cero solo con la documentación pública, sin mirar el código, hasta que salga sin baches; `1.0.0-rc.1`; validación en tu otro proyecto; `1.0.0`. | M | — |

Estimación total: seis a ocho semanas de trabajo con agentes, con tu tiempo
concentrado en las 13 decisiones y en las revisiones del playground y del
ejercicio de prueba. Las fases 1–3 son el corazón; 4–6 son las que se ven.

### 5.5 Política de estabilidad después de 1.0

- **Semver estricto** sobre lo listado en §5.3. `uxdsl/engine` exento y dicho
  en su README.
- **Aditivo permitido en minor:** nuevas familias de tema, nuevos roles/estados
  en el tema base solo si son *valores* (un estado nuevo es estructural para
  `applyTheme`: documentarlo como "requiere rebuild", no como breaking), nuevas
  funciones de valor, nuevos códigos `UXD_*`, nuevas opciones con default
  compatible, `modes.<nombre>`.
- **Prohibido en minor:** cambiar nombres de variables emitidas, cambiar qué
  declaraciones emite una directiva, mover un breakpoint del tema base, cambiar
  la salida de un tema existente (salvo corrección de bug documentada bajo
  `Visual changes`).
- **Deprecación:** un minor de aviso (`UXD_DEPRECATED` con sugerencia) antes de
  quitar en el siguiente major.
- **Gate de release:** tarballs reales, paridad build/runtime, recorrido en
  Chrome, ejemplos de doc compilados, contraste con el conjunto exacto fijado.
- **Versionado del repo:** bump a `-dev` inmediatamente después de publicar.
- **Proceso:** PR con tests y CHANGELOG; sin tablas de evidencia por story ni
  commits de "fix SHA"; los comentarios del código describen comportamiento, no
  historia.

---

## 6. Anexo: reproducciones clave

```bash
# Paridad build/runtime (T1)
cd packages/postcss-uxdsl && node -e "
const postcss=require('./node_modules/postcss');const ux=require('./dist/index.js');const rt=require('./dist/ds-runtime.js');
const theme={radii:{x:'radius(2)'}};
postcss([ux({theme,includeTheme:true,discoverTheme:false})]).process('.a{color:red}',{from:'p.uxdsl'})
 .then(r=>console.log(r.css.match(/--uxdsl__radius__x[^;]*/)[0], '|', rt.generateThemeCss(rt.resolveTheme(theme)).match(/--uxdsl__radius__x[^;]*/)[0]))"
# → --uxdsl__radius__x: var(--uxdsl__radius__2) | --uxdsl__radius__x: radius(2)

# Validación (T2)
node -e "… theme:{palette:{primary:{main:5}},spacing:{1:{}}} …"   # emite `5` y `[object Object]`

# SCSS silencioso (3.2)
printf '@mixin pad($v){padding:$v}\n.a{@include pad(density(2))}\n.c{&__e{color:red}}\n' > /tmp/s.uxdsl
node -e "require('./packages/uxdsl-core/dist/index.js').compile({entry:'/tmp/s.uxdsl'},{includeTheme:false,theme:{}}).then(r=>console.log(r.css))"
# → .a{padding: densit;} .c{&__e{color:red}}   (exit 0, 0 warnings)

# Instalación Vite 8 (I2)
npm create vite@latest probe -- --template vanilla-ts && cd probe && npm i -D vite-plugin-uxdsl uxdsl-core   # ERESOLVE

# Runtime legacy vs applyTheme (R1): ver packages/playground-nextjs/src/runtime-sandbox/sandbox-entry.ts (comentario inicial) y ThemeContext.tsx:46-60

# Contraste con las decisiones DE-7: scratch audit-theme/probe-contrast3.js
```
