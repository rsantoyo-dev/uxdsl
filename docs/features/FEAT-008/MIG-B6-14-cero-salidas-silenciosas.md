# MIG-B6-14 — Cero salidas silenciosas del lenguaje

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | A — Diagnósticos veraces |
| Prioridad · Tamaño | P0 · M |
| Cierra | UX-06, UX-15, N-01 y la parte de UX-16 que corresponde al plugin (`$vars` responsive) |
| Depende de | MIG-B6-13 (helper de ubicación y de sugerencias) |
| Bloquea | MIG-B6-12, MIG-B6-15, MIG-B6-26 |
| Archivos | `packages/postcss-uxdsl/src/index.ts`, `preset-engine.ts`, `language.ts` |
| Coordinación | Segundo en la secuencia de `index.ts` |

## Por qué

Hay tres casos en los que la salida no refleja la entrada y nadie avisa:

- directivas que el compilador no procesó llegan al CSS y el navegador las
  descarta;
- una función de breakpoint inexistente llega al CSS como texto inválido;
- al revés, CSS nativo válido (color relativo) se rechaza.

## Reproducción

```bash
npm --prefix packages/postcss-uxdsl run build
node -e "
const postcss = require('./packages/postcss-uxdsl/node_modules/postcss');
const uxdsl = require('./packages/postcss-uxdsl/dist');
const cases = {
  'directiva en la raíz': '@ds-surface(contained);',
  'directiva en @media anidado': '.a { @media (min-width: 10px) { @ds-surface(outlined primary); } }',
  'directiva mal escrita': '.a { @ds-surfce(contained); }',
  'alias inexistente': '.a { @ds-h1; }',
  'breakpoint inexistente': '.a { padding: xs(1rem) xxl(2rem); }',
  'color relativo': '.a { color: color(from red srgb r g b / 0.5); }',
  '\$var responsive': '\$gap: xs(1rem) md(2rem);\n.a { gap: \$gap; }',
};
for (const [k, css] of Object.entries(cases))
  postcss([uxdsl({ includeTheme: false })]).process(css, { from: 'x.uxdsl' })
    .then(r => console.log(k, '→ OK:', r.css.trim()), e => console.log(k, '→ ERROR:', e.message.split('\n')[0]));
"
```

Salida actual:

- Los cinco primeros compilan sin error, y la salida contiene la directiva o
  `xxl(2rem)` tal cual (por ejemplo `.a { padding: 1rem xxl(2rem); }`).
- El color relativo falla con `UXD_TOKEN_KEY: Expected a token key.`
- El `$var` responsive compila a `.a { gap: xs(1rem) md(2rem); }`: CSS inválido, sin
  error. El CLI, en cambio, lo expande.

## Causa

- **Directivas.** Se buscan con `rule.walkAtRules(...)` dentro de `root.walkRules`
  (`index.ts:232`, `586`, `597`, `616`) y se ignoran cuando no son hijas directas de
  la regla. Nada revisa las que quedan. Además, un comentario de `applyTypo` (~150)
  dice "Supports: @ds-typo(h1), @ds(h1), and @ds-h1", pero sólo existe `ds-typo`.
- **Breakpoints.** La expansión responsive (`index.ts:738`) sólo reconoce funciones
  cuyo nombre está en `bpNames`; deja cualquier otra tal cual.
- **Color relativo.** `presetValueToCss` (`preset-engine.ts:17`) trata `color(...)`
  como token, salvo que empiece con un espacio de color de una lista fija. `from` no
  está en esa lista.
- **`$vars`.** El plugin junta las `$vars` de la raíz (~637), expande los valores
  responsive (~730) y **después** sustituye las `$vars` (~814-825). Un valor responsive
  dentro de una variable llega tarde y nunca se expande.

## Resultado esperado

- Los cinco primeros casos fallan con código, ubicación y, cuando aplica, una
  sugerencia.
- El color relativo pasa sin cambios.
- El `$var` responsive se expande igual que en el CLI.

## Implementación

1. **Pasada final** en `index.ts`, después de procesar todas las directivas y antes
   de `enforceReferences`. Cada at-rule del namespace reservado (`ds-*`
   o exactamente `ds`), o un `@theme` fuera de su contexto, lanza:
   - `UXD_DIRECTIVE_UNKNOWN` si el nombre no es una directiva conocida. La lista sale
     de `LANGUAGE_COMPLETIONS.directives` (`language.ts:58`); no se copia. Incluye
     `did you mean @ds-surface?` con el helper de MIG-B6-13.
   - `UXD_DIRECTIVE_CONTEXT` si la directiva existe pero está en la raíz o dentro de
     un at-rule (`@media`, `@supports`) anidado en la regla. Mensaje (D-3):
     `Directives apply to a whole rule and are not responsive; use responsive values
     on the properties instead, e.g. padding: xs(…) md(…).`

   Es una sola regla genérica, sin casos especiales por directiva (D-3).
2. Corregir el comentario de alias. `@ds-h1` y `@ds(h1)` caen en
   `UXD_DIRECTIVE_UNKNOWN`.
3. **`color()`** es token sólo si su primer argumento cumple `/^[\w.-]+$/` (con el
   alpha opcional que ya existe como segundo argumento). Cualquier otra forma se deja
   sin tocar. Esto reemplaza la lista fija de espacios de color.
4. **`UXD_BREAKPOINT_UNKNOWN`** durante la expansión responsive. Se lanza cuando una
   función de nivel superior del valor no es un breakpoint configurado ni una función
   CSS conocida, y además cumple una de estas condiciones:
   - aparece junto a funciones de breakpoint en el mismo valor;
   - está a distancia de edición 1 de un breakpoint configurado.

   El mensaje lista los breakpoints configurados del tema, no los defaults.
5. **Lista de funciones CSS conocidas** en `language.ts`, exportada y con test.
   Incluye:
   - matemáticas: `calc`, `min`, `max`, `clamp`, `round`, `mod`, `rem`, `abs`, `sign`,
     `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `pow`, `sqrt`, `hypot`,
     `log`, `exp`;
   - color: `rgb`, `rgba`, `hsl`, `hsla`, `hwb`, `lab`, `lch`, `oklab`, `oklch`,
     `color`, `color-mix`, `light-dark`;
   - otras: `var`, `env`, `attr`, `url`, `image-set`, gradientes, `fit-content`,
     `repeat`, `minmax`, `cubic-bezier`, `steps`, transformaciones, filtros,
     `anchor`, `anchor-size`;
   - las funciones de UXDSL.

   **Trampa conocida:** `log` está a distancia 1 de `lg`. Por eso la lista se
   consulta antes que la distancia.
6. **Orden de `$vars`** en el plugin: sustituir las `$vars` **antes** de la expansión
   responsive, para que un valor responsive dentro de una variable se expanda. Con
   el pipeline de MIG-B6-18, `postcss-advanced-variables` ya las resuelve antes del
   plugin; esto corrige el caso del plugin usado solo (por ejemplo, desde el
   `postcss.config` de Next.js).

## Fuera de alcance

- Soportar directivas dentro de `@media` (D-3: las surfaces no son responsive).
- Validar la gramática CSS completa.

## Pruebas

- Regla dentro de @media/@supports de nivel superior con directiva hija directa
  sigue válida; directiva dentro de at-rule anidado bajo esa regla da contexto
  inválido. Distinguir ambas estructuras y documentarlas.
- Strings, URLs, comentarios y custom properties con contenido literal no sufren
  detección por regex sobre todo el CSS. Funciones CSS conocidas se consultan
  antes de distancia; funciones custom con prefijo `--` no se confunden con bp.
- `color()` con espacios nativos y color relativo permanece intacto; token válido
  con alpha inválido sigue fallando. No convertir el passthrough en bypass del
  validador de tokens. Variables se resuelven antes de responsive también solas.
- Cada heurística de typo tiene control positivo CSS; este guard no pretende ser
  un validador exhaustivo del lenguaje CSS.

- `test/directives-leftover.test.js`: los cuatro casos de directivas, cada uno con
  código, ubicación y sugerencia cuando aplica.
- `test/breakpoint-unknown.test.js`: `xxl(2rem)` falla con la lista `xs, sm, md, lg,
  xl`. Un breakpoint `xxl` definido en el tema no falla.
- `test/color-native.test.js`: `color(from …)` y `color(display-p3 …)` pasan sin
  cambios; `color(primary)` y `color(primary, 0.5)` siguen siendo tokens.
- `test/vars-responsive.test.js`: `$gap: xs(1rem) md(2rem); .a { gap: $gap; }` produce
  `.a { gap: 1rem; }` y el `@media` de `md`, igual que el CLI.
- **Control negativo:** cada función de la lista, junto a `xs()` y `md()`, compila
  sin error.

## Documentación

- `packages/postcss-uxdsl/README.md`: dónde se puede usar cada directiva y los
  errores nuevos.
- `packages/postcss-uxdsl/docs/migration.md`, "Desde beta.6": los tres errores
  nuevos y cómo corregir cada uno.
- `AGENTS.md`: las secciones Surfaces y Breakpoints, si describen dónde se usan las
  directivas.
- CHANGELOG beta.6.

## Criterios de aceptación

- [x] Los cinco primeros casos fallan con código y ubicación.
- [x] `color(from …)` pasa sin cambios.
- [x] Ninguna función CSS de la lista produce un falso positivo.
- [x] La lista de directivas viene de `LANGUAGE_COMPLETIONS`.
- [x] Un `$var` responsive se expande en el plugin usado solo.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm test
npm run verify:beta5
```

## Entrega

`feat(FEAT-008): MIG-B6-14 - leftover directives and unknown breakpoints fail, native color() passes`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada/verificada** en la rama
`feat/feat-008-beta6-plan`, conforme al
[protocolo de agentes](README.md#cobertura-y-evidencia-obligatorias).
Integración (merge a `main`) sigue pendiente.

Hallazgo durante la verificación: el build real de `packages/playground-nextjs`
dejó de compilar tras este cambio, porque `AIPrompt.uxdsl` usaba
`@ds-surface nombre-de-clase { ... }` (tres veces) en vez de
`.nombre-de-clase { ... }` — exactamente el silencio que esta story cierra.
Esas tres reglas nunca se aplicaron al componente real (el navegador
descartaba el at-rule completo); se corrigieron a sintaxis de regla normal
en el mismo cambio, y el `uxdsl.css` generado del playground quedó con esas
tres reglas presentes por primera vez. No es un efecto secundario de la
story: es exactamente el tipo de bug que declara cerrar.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `afa571f` (MIG-B6-13, entrega previa); entrega en el commit siguiente en `feat/feat-008-beta6-plan`; sin PR abierto todavía |
| Reproducción antes del cambio | El script completo de la sección "Reproducción" de este archivo, ejecutado contra `afa571f`: los cinco primeros casos compilan sin error con la directiva/`xxl(2rem)` tal cual en la salida; `color(from red srgb r g b / 0.5)` falla con `UXD_TOKEN_KEY: Expected a token key.`; el `$var` responsive compila a `.a { gap: xs(1rem) md(2rem); }` (CSS inválido, sin error). Fecha: 2026-09-21. |
| Criterio → regresión | Directivas → `test/directives-leftover.test.js` (8 tests: raíz, `@media` anidado, `@supports` anidado, typo con sugerencia, `@ds-h1`/`@ds(h1)`, `@ds` a secas, controles positivos). Breakpoints → `test/breakpoint-unknown.test.js` (5 tests, incluida la trampa `log`/`lg` y un control positivo que ejercita cada entrada de `KNOWN_CSS_FUNCTIONS`) + 3 tests en `test/language.test.js` para `validateResponsiveExpression`. `color()` nativo → `test/color-native.test.js` (8 tests: 3 formas nativas, referencia externa dentro de una forma nativa, token con y sin alpha, alpha inválida, y la forma "cualquier espacio es nativa por diseño"). `$var` responsive → `test/vars-responsive.test.js` (4 tests). |
| Comandos y entorno | `node --test packages/postcss-uxdsl/test/*.test.js` (macOS, Node del repo): 207/207, exit 0. `npm --prefix packages/uxdsl-cli test`: 131/131, exit 0. `npm run verify:beta5`: 4/4 PASS. `npm run verify:consumer-fixture` (tarball real, 5 entradas del reporte de migración original): todos los checks PASS. `npm test` desde la raíz: 360 subtests, 0 fallos, exit 0. `npm run build` completo de `packages/playground-nextjs` (Next.js, contenido real de 43 imports): exit 0 tras corregir `AIPrompt.uxdsl` (ver hallazgo arriba). |
| Resultado después / control negativo | Los siete casos del script de reproducción confirmados uno por uno tras el cambio: los cinco primeros fallan con código, ubicación y sugerencia cuando aplica; `color(from …)` compila sin cambios; el `$var` responsive expande a valor base + `@media`. Controles negativos: cada función de `KNOWN_CSS_FUNCTIONS` compila sola junto a `xs()`/`md()` sin disparar `UXD_BREAKPOINT_UNKNOWN`; `log(...)` nunca se confunde con `lg`; una directiva correctamente anidada (regla dentro de `@media` de nivel superior, con su propia directiva como hija directa) sigue compilando; un token `color(primary)` sigue resolviendo a `var(...)`; un `$var` no responsive sigue sustituyendo como valor plano. |
| Cambios visuales o API / migración | Cambio de comportamiento del compilador (nuevos códigos de error; ningún cambio de significado en output previamente válido). Documentado en `packages/postcss-uxdsl/README.md` (nueva sección "Zero silent output"), `packages/postcss-uxdsl/docs/migration.md` (nueva sección "Desde beta.6: cero salidas silenciosas del lenguaje"), `packages/postcss-uxdsl/CHANGELOG.md` (entrada MIG-B6-14 en beta.6) y `AGENTS.md` (sección Surfaces, restricción de posición de `@ds-surface`). Cambio visual real y deliberado en `packages/playground-nextjs` (ver hallazgo arriba): tres reglas de `AIPrompt.uxdsl` que nunca se aplicaban ahora sí — paquete privado, no sujeto al guard de CHANGELOG de `postcss-uxdsl`. |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md` §"Zero silent output: leftover directives and unknown breakpoints (MIG-B6-14)"; `packages/postcss-uxdsl/docs/migration.md` §"Desde beta.6: cero salidas silenciosas del lenguaje (MIG-B6-14)"; `packages/postcss-uxdsl/CHANGELOG.md` entrada MIG-B6-14; `AGENTS.md` sección Surfaces. |
| AGENTS / guías / arquitectura | `AGENTS.md` sección Surfaces actualizada con la restricción de posición de las directivas (hijo directo de la regla) y la referencia a `UXD_DIRECTIVE_CONTEXT`. Sección Breakpoints revisada; no describe uso de directivas, sin cambio. |
| Límites y seguimiento | Fuera de alcance según la propia story: soportar directivas dentro de `@media` (no implementado, D-3) y validar la gramática CSS completa. `@theme` "fuera de su contexto" (mencionado en Implementación punto 1) no se implementó como caso separado: el `walkAtRules("theme", ...)` existente ya procesa `@theme` en cualquier posición sin distinguir contexto, y ninguno de los siete repros de esta story lo ejercita; queda para una revisión de código si se decide que hace falta. `KNOWN_CSS_FUNCTIONS` es una lista curada, no generada desde la especificación CSS — una función CSS legítima pero no listada seguiría sin producir `UXD_BREAKPOINT_UNKNOWN` por sí sola (correcto, ya que el chequeo solo dispara con co-ocurrencia o distancia 1), pero podría dar un falso positivo si además está a distancia 1 de un breakpoint configurado; no se encontró ningún caso real de esto en el playground. |

Si cambia un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
