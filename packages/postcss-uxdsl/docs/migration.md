# Migración a UXDSL 0.5.0-beta.2

## Adelanto beta.6 — MIG-B6-01 (sin publicar)

No requiere cambiar el JSON ni el CSS: `modes` y `typography` legacy dejan de
producir avisos falsos de familia desconocida. Los roles custom de Palette,
fuentes y Typography siguen abiertos; `palete` sigue avisando y `fontsize`
en un rol tipográfico sigue fallando. No cambia `--strict-theme`.
Las herramientas pueden importar `KNOWN_THEME_FAMILIES` desde
`postcss-uxdsl/ds-runtime` en la implementación beta.6, sin duplicar la lista.
Esto no implica disponibilidad en la versión beta.5 publicada.

## Contexto beta.2

Beta.2 está preparada en este checkout; la publicación en npm es un paso separado.
El namespace `--uxdsl__` ya se introdujo en beta.1. Beta.2 añade defaults y
temas parciales; los helpers `space(7)`, `density(2)` y las directivas no cambian.

## De beta.1 a beta.2

1. Tras publicar beta.2, instalar versiones coordinadas:

   ```bash
   npm install -D uxdsl-cli@0.5.0-beta.2 postcss-uxdsl@0.5.0-beta.2
   npx uxdsl init
   ```

2. Conservar el build config existente (`entry`, `outFile`, `watch`). `init`
   añade solo archivos y scripts faltantes. Para proyectos nuevos genera
   `src/uxdsl-entry.uxdsl` sin imports legacy: el plugin emite los defaults.
   Un entry antiguo puede seguir importando los packs públicos. Si se retiran,
   revisar primero usos de selectores `.ds-typo`, colores o Palette ampliada
   proporcionados por esos packs; no eliminarlos ciegamente.

3. El tema es opcional. Un **tema parcial** contiene overrides; `resolveTheme`
   lo combina con defaults para obtener el **tema efectivo**. Objetos mezclan
   por clave; arrays, strings responsive y escalares reemplazan; `undefined`
   conserva defaults. **CSS legacy** es una entrada explícita de compatibilidad,
   no un parche JSON. Pasar los mismos overrides a CLI, PostCSS y runtime.

4. Para fuentes Next, elegir una de estas configuraciones:

   ```js
   // uxdsl.theme.config.cjs: fallback válido sin declarar externos
   module.exports = {
     fonts: { families: {
       ui: 'var(--font-geist-sans, Arial, sans-serif)',
       code: 'var(--font-geist-mono, ui-monospace, monospace)'
     } }
   };
   ```

   ```js
   // Alternativa: el host garantiza las variables durante render.
   module.exports = {
     theme: { fonts: { families: { ui: 'var(--font-geist-sans)' } } },
     references: { externalTokens: ['--font-geist-sans'] }
   };
   ```

   `references` del build config gana completo sobre el archivo de tema.
   PostCSS recibe `{ theme, references }`; runtime usa
   `generateThemeCss(theme, references)`. Declarar un externo permite validar,
   pero no crea ni carga la fuente: Next debe aplicar su clase/variable al DOM.

5. Si aún quedan nombres anteriores a beta.1, ejecutar primero el preview:

   ```bash
   node node_modules/postcss-uxdsl/scripts/codemod-namespace.js styles.css theme.json
   node node_modules/postcss-uxdsl/scripts/codemod-namespace.js --write styles.css theme.json
   npm run uxdsl:build
   ```

   Solo `--font-ui`, `--font-ui-2` y `--font-code` se migran automáticamente.
   `--font-geist-sans`, `--font-geist-mono` y fuentes personalizadas se preservan;
   usar `--map mapping.json` para fuentes propias de UXDSL y roles personalizados.
   Un mapping identidad protege un prefijo del host. Las claves lógicas y
   `theme.typography` plano permanecen; revisar sus consumidores manualmente.

6. Importar `../uxdsl.css` desde `src/app/layout.tsx`; ejecutar
   `npm run uxdsl:watch` junto a `next dev`. PostCSS por sí solo no vuelve a
   ejecutar el CLI ni descubre archivos nuevos. `npx uxdsl generate-entry`
   actualiza los imports tras agregar o quitar componentes.

Para CSS Modules, emitir el tema una vez en la entrada global y usar
`includeTheme: false` en módulos con los mismos overrides y `references`.
Sin overrides, ambas entradas usan defaults. No cargar CSS precompilado de
otra versión junto al tema nuevo.

> **Alcance de este documento:** describe la migración desde las versiones
> anteriores hacia beta.1 (publicada) y beta.2 (preparada). Ver el
> historial de cambios en [`CHANGELOG.md`](../CHANGELOG.md) y el contexto
> completo (hallazgos, prioridades, estado de cada mejora) en el
> [monorepo, FEAT-002](https://github.com/rsantoyo-dev/uxdsl/blob/main/docs/features/FEAT-002-beta-migration-hardening.md).

## Qué cambió y qué no

Ningún cambio de esta ronda (MIG-01 a MIG-06) rompe sintaxis existente por
sí solo. Todo es aditivo u opt-in, excepto la validación de referencias
(MIG-03), que es un cambio de comportamiento: código que antes compilaba
generando CSS con `var()` sin resolver (silenciosamente inválido en el
navegador) ahora **falla el build** con un diagnóstico. Esa es la
intención de MIG-03, no un bug — pero es lo primero que vas a notar al
actualizar.

| Área | Antes | Ahora | Cambio de comportamiento |
| --- | --- | --- | --- |
| Spacing keys | `"space-1"` y `"1"` en el JSON emiten variables distintas (`--uxdsl__space__space-1` vs `--uxdsl__space__1`); density/radius apuntan solo a la forma sin prefijo | Ambas formas emiten `--uxdsl__space__1`; usar ambas en la misma config lanza `UXD_SPACING_COLLISION` | Corrección de bug, no sintaxis nueva |
| Entradas múltiples | Cada archivo compilado emite siempre `:root` completo (foundations, density, shadows, edges, surfaces, buttons, inputs) | `includeTheme: false` en la opción del plugin desactiva esos ocho emisores para una entrada que solo consume tokens de otra | Opt-in; por defecto (`true`) no cambia nada |
| Referencias indefinidas | `var(--token-inexistente)` se emitía igual; el navegador simplemente no aplicaba la propiedad | Falla el build con `UXD_REFERENCE_MISSING`/`UXD_REFERENCE_CYCLE`, indicando la cadena completa de dependencia | Ver "Qué hacer si tu build empieza a fallar" abajo |
| `border(1..5)` | Requería que el tema definiera `colors.gray.{300,400,500,600}` manualmente, o las propiedades quedaban inválidas en silencio | Ese `gray` por defecto se mezcla automáticamente (tus shades ganan por clave si los definís) | Nadie necesita cambiar código; los temas que ya definían `colors.gray` siguen ganando |
| Tamaño de surface/button/input | `@ds-surface(role size)` fija padding y radius juntos; para radio/sombra distintos había que sobreescribir la propiedad a mano después del mixin | `@ds-surface(role size radius(key) shadow(key))` fija radio/sombra de forma independiente | Sintaxis nueva, opt-in; ver tabla de sintaxis abajo |
| Nombres de variables CSS | Cada familia usaba su propia forma: `--space-1`, `--radius-2`, `--surface-contained-padding`, `--h1-size`, y solo palette/color llevaban un namespace (`--ds__palette__primary-main`) | Todas las familias comparten `--uxdsl__<familia>__<clave>`: `--uxdsl__space__1`, `--uxdsl__radius__2`, `--uxdsl__surface__contained-padding`, `--uxdsl__typography__h1-size`, `--uxdsl__palette__primary-main` | Cambio publicado en `0.5.0-beta.1`; requiere migrar referencias directas y no mezclar CSS precompilado antiguo con el tema nuevo |

## Nombres de variables CSS (`--uxdsl__<familia>__<clave>`)

Cada variable CSS que este compilador genera o consume comparte una sola
forma: `--uxdsl__<familia>__<clave>`. Esto es una centralización (todo
pasa por `src/naming.ts`), no un cambio de sintaxis del DSL — `palette()`,
`space()`, `@ds-surface`, etc. y las claves lógicas del tema (`theme.spacing`,
`theme.palette`, ...) no cambian.

| Familia | Ejemplo anterior | Ejemplo actual |
| --- | --- | --- |
| Spacing | `--space-1` | `--uxdsl__space__1` |
| Density | `--density-1` | `--uxdsl__density__1` |
| Radius | `--radius-2` | `--uxdsl__radius__2` |
| Border | `--border-1` | `--uxdsl__border__1` |
| Shadow | `--shadow-2` | `--uxdsl__shadow__2` |
| Surface | `--surface-flat-padding` | `--uxdsl__surface__flat-padding` |
| Button | `--button-contained-hover-bg` | `--uxdsl__button__contained-hover-bg` |
| Input | `--input-outlined-focus-border` | `--uxdsl__input__outlined-focus-border` |
| Typography | `--h1-size` | `--uxdsl__typography__h1-size` |
| Font family | `--font-ui` | `--uxdsl__font__ui` |
| Palette | `--ds__palette__primary-main` | `--uxdsl__palette__primary-main` |
| Color | `--ds__color__gray-300` | `--uxdsl__color__gray-300` |

Si tu propio CSS lee o escribe alguna de estas variables directamente
(por ejemplo, `getComputedStyle(el).getPropertyValue('--h1-size')`, o un
`element.style.setProperty('--surface-contained-padding', ...)` fuera del
runtime de UXDSL), actualizá esas referencias al nuevo nombre — este
compilador ya no emite la forma anterior. La única excepción es
`theme.typography` (el mapa plano, no `theme.typography_details`): su
clave JSON pasa a ser el nombre de variable tal cual (`{ typography: {
"h1-size": "2rem" } }` sigue emitiendo `--h1-size: 2rem;`), porque ese
nombre lo elegiste vos, no este compilador.

## Tabla de sintaxis: anterior → equivalente nuevo

| Sintaxis anterior | Equivalente nuevo | Notas |
| --- | --- | --- |
| `spacing: { "space-1": "4px" }` | Sin cambios — sigue aceptado; equivalente a `{ "1": "4px" }` | No hace falta migrar nada; ambas formas conviven |
| Un solo archivo con `theme` + componentes | Un archivo con `includeTheme: true` (o sin la opción) + N archivos con `includeTheme: false` y el mismo objeto `theme` | Ver "Guía de 5 entradas" abajo |
| `@ds-surface(contained 2); border-radius: radius(4);` | `@ds-surface(contained 2 radius(4));` | El codemod (`npm run codemod:size-overrides`) automatiza este caso puntual |
| `@ds-button(role size); box-shadow: shadow(1);` | `@ds-button(role size shadow(1));` | Mismo codemod, mismo caso para button/input |
| Colores de `border(1..5)` importados por separado | Nada que hacer si usás los presets por defecto | Si tu tema reemplaza las 5 claves de `borders`, la dependencia de `gray` deja de aplicarse — no hace falta declarar nada |

### Casos sin equivalencia exacta

- **Tamaños compuestos o "recetas" configurables** (por ejemplo, un `size`
  que además ajuste tipografía o densidad de ícono) no están soportados.
  Solo `radius()`/`shadow()` son overridables hoy.
- **`includeTheme: false` sin pasar `theme`** usa defaults desde beta.2.
  Si hay overrides, compartirlos con la entrada global para que ambas
  compilaciones validen contra el mismo tema efectivo.
- **Migración automática cuando el manual override no es una llamada
  `radius()`/`shadow()` pura** (un literal, `calc()`, o una expresión
  responsive), cuando hay más de una declaración candidata en la regla, o
  cuando tiene `!important` — el codemod deliberadamente no toca esos
  casos; hay que decidirlos a mano (ver más abajo).

## Guía de 5 entradas (tema + 4 paneles con CSS Modules)

```js
// theme.entry.uxdsl — compilado con includeTheme: true (o sin la opción)
uxdsl({ theme, includeTheme: true })

// panel-a.module.uxdsl, panel-b.module.uxdsl, ... — mismo theme, sin :root propio
uxdsl({ theme, includeTheme: false })
```

Puntos clave:

- Las cinco entradas deben compilarse con el **mismo objeto `theme`**
  (mismos breakpoints, misma escala de spacing, mismo palette) — de lo
  contrario los nombres de variable pueden no coincidir entre entradas.
- Con `includeTheme: false`, la validación de referencias de esa entrada se
  hace automáticamente contra lo que la entrada de tema emitiría — no hace
  falta pasar `references.css` a mano para ese caso.
- Ningún panel vuelve a declarar `:root`, así que un loader de CSS Modules
  en modo estricto (que rechaza `:root` como selector "impuro") no debería
  fallar. Esto está verificado a nivel de compilación PostCSS
  (`test/include-theme.test.js`) y con Next.js + `css-loader` desde tarballs
  (`verify:cssmodules-build`), con control negativo y estilos computados en Chrome.

### Desde beta.3: lo mismo, vía `uxdsl-cli` (`builds`)

Hasta beta.2, reproducir esta guía con el CLI (en vez de llamar al plugin
directamente) requería correr `uxdsl build` cinco veces — `includeTheme` no
llegaba del CLI al plugin (era el guard que FEAT-004 identificó y cerró).
Desde beta.3, un `builds` array en `uxdsl.config.cjs` compila las cinco
entradas de una sola invocación, contra el mismo `theme`/`references`/
`breakpoints` compartido:

```js
// uxdsl.config.cjs
module.exports = {
  builds: [
    { entry: './src/theme.uxdsl', outFile: './src/theme.css' }, // includeTheme: true es el default
    { entry: './src/panel-a.module.uxdsl', outFile: './src/panel-a.module.css', includeTheme: false },
    { entry: './src/panel-b.module.uxdsl', outFile: './src/panel-b.module.css', includeTheme: false },
    { entry: './src/panel-c.module.uxdsl', outFile: './src/panel-c.module.css', includeTheme: false },
    { entry: './src/panel-d.module.uxdsl', outFile: './src/panel-d.module.css', includeTheme: false },
  ],
};
```

`builds` no se combina con `entry`/`outFile` de nivel superior. Cada entrada
se compila en memoria antes de escribir cualquier archivo, así que un error
en una no deja a las demás a medio escribir. `--include-theme`/
`--no-include-theme` siguen disponibles y, cuando se pasan, anulan el
`includeTheme` de **todas** las entradas por igual. `uxdsl theme --diff`
muestra qué valores del tema resuelto vienen del proyecto y cuáles de
`DEFAULT_THEME`; `--strict` falla si alguna familia que declaraste quedó
parcialmente completada por defaults. Detalles completos en el
[README de uxdsl-cli](../../uxdsl-cli/README.md) y en
[FEAT-004](../../../docs/features/FEAT-004-beta3-cli-plugin-parity.md).

### Desde beta.4: sin pasos de migración, tres frictions menos

beta.4 ([FEAT-005](../../../docs/features/FEAT-005-beta4-zero-friction-cli.md))
no cambia contratos existentes — es aditivo y opt-in en los tres puntos:

- `uxdsl build --strict-theme` (o `strictTheme: true` en `uxdsl.config.cjs`)
  hace la misma pregunta que `uxdsl theme --strict`, pero como gate de
  build/watch — falla antes de escribir nada si una familia declarada quedó
  parcialmente heredada del default. Por defecto sigue en `false`, así que
  ningún proyecto existente empieza a fallar por actualizar el CLI.
- Editar un módulo que `uxdsl.config.cjs`/`uxdsl.theme.config.cjs` requiere
  transitivamente (`module.exports = require('./real-config.js')`, o un
  tema que lee `require('./theme-data.json')`) ahora dispara rebuild en
  `uxdsl watch` por sí solo — antes solo el archivo de nivel superior
  estaba vigilado.
- `uxdsl init --multi` scaffoldea la forma de "Guía de 5 entradas" de
  arriba directamente (`builds` con una entrada de tema y un panel de
  ejemplo), en vez de escribirla a mano.

### Desde beta.5: `--strict-theme` con alcance por familia

beta.5 ([FEAT-006](../../../docs/features/FEAT-006-beta5-scoped-strict-theme.md))
corrige un falso positivo real de `--strict-theme`/`uxdsl theme --strict`:
declarar solo `typography_details.h2.fontSize` (el patrón documentado en
"Guía de 5 entradas" arriba) marcaba **toda** la familia como incompleta —
y lo mismo le pasa al ejemplo de `palette.primary.main` de la sección
"Zero-config defaults" del README de este paquete. Si usás `--strict-theme`
en CI, acotalo a las familias que de verdad querés completas:

```bash
uxdsl build --strict-theme=palette,breakpoints
```

`strictTheme: true`/`--strict-theme` sin acotar siguen funcionando
exactamente igual que en beta.4 — no hace falta cambiar nada si no usabas
el flag, o si tu tema ya especifica cada familia por completo. Además,
`uxdsl build`/`watch` ahora avisan (sin fallar el build) si una familia de
tema top-level es desconocida — antes ese aviso solo lo veía el editor del
playground. beta.5 también avisaba de claves desconocidas *dentro* de
`typography_details`/`palette`/`fonts.families`; ese segundo aviso era un
falso positivo y beta.6 lo retira (ver abajo).

### Desde beta.6: sin warnings falsos en registros abiertos

beta.6 ([FEAT-007](../../../docs/features/FEAT-007-beta6-pre1-foundations.md),
MIG-B6-01) elimina el aviso `Unknown <familia> key` que beta.5 introdujo
para `typography_details`, `palette` y `fonts.families`. Esas tres
familias son **registros abiertos**: el nombre de cada role o tag lo
define tu proyecto y se compila igual, esté o no en los defaults mínimos
del paquete. El aviso comparaba contra las claves de `DEFAULT_THEME` —
que es un fallback para no romper en zero-config, no un catálogo de
nombres permitidos — así que cualquier tema con una paleta más rica que
las 4 roles por defecto (o una fuente propia, o un tag tipográfico
propio) recibía en cada build un aviso incorrecto de que su tema "no se
compilará", sin flag que lo pidiera.

No hay pasos de migración: si veías esos avisos, desaparecen. Lo que
sigue igual:

- el aviso de familia top-level desconocida (`palete` por `palette`)
  sigue existiendo — ese conjunto sí es cerrado;
- un campo mal escrito dentro de un tag tipográfico (`fontsize` por
  `fontSize`) sigue siendo error duro `UXD_TYPO_FIELD`, no un aviso;
- `--strict-theme` y su alcance por familia no cambian.

### Desde beta.6: flags del CLI estrictos (MIG-B6-22)

beta.6 corrige tres formas en las que `uxdsl-cli` aceptaba un flag mal
escrito o un valor inválido en silencio, en vez de fallar:

- **Un flag desconocido, o de otro comando, ahora falla con sugerencia.**
  Un script que hoy pasa `--strict-thme` (typo) o `--strict` a `build`
  (ese flag es de `theme`, la forma correcta es `--strict-theme`) dejaba de
  aplicar esa opción sin ningún aviso; ahora falla con exit 1 y "Unknown
  option ... Did you mean ...?". Revisá tus scripts de build/CI si usan
  flags que nunca existieron o que pertenecen a otro comando — antes
  "funcionaban" porque `uxdsl` los ignoraba.
- **`--include-theme=false`/`=true` ahora sí surten efecto.** Antes solo
  la forma sin `=` (`--include-theme`/`--no-include-theme`) cambiaba algo;
  `--include-theme=false` se leía como texto y cambiaba, en la práctica,
  el criterio de omitir la tabla. Si tu build dependía de que
  `--include-theme=false` **no** desactivara el tema (comportamiento
  previo, no documentado como contrato), usá `--no-include-theme`
  explícitamente para conservar el tema.
- **`--strict-theme=true`/`--strict-theme=false` (y `theme --strict=...`)
  ahora significan lo mismo que la forma sin `=`.** Antes se interpretaban
  como una familia de tema llamada literalmente "true"/"false" (que nunca
  existe, así que el chequeo no hacía nada). Un proyecto que ya pasaba
  `--strict-theme=true` esperando el chequeo completo empieza a recibirlo
  de verdad a partir de beta.6 — puede que un build que antes pasaba en
  silencio ahora falle con una familia parcial real; ver la sección
  "`--strict-theme` con alcance por familia" arriba para acotarlo.
- **Un nombre de familia inválido en `--strict-theme`/`--strict`/
  `strictTheme` falla con sugerencia** (`Unknown theme family "pallete"...
  Did you mean "palette"?`) en vez de aceptarse y no comprobar nada.
- **Una coma suelta en la lista de familias también falla.**
  `--strict-theme=,` o `--strict-theme=palette,,fonts` antes descartaban el
  elemento vacío en silencio (el primer caso, sin ninguna familia real,
  terminaba desactivando el chequeo por completo); ahora fallan con "A
  family list cannot contain an empty entry". `--include-theme=0`/`=1`
  fallan igual que `=banana` — antes se leían como texto y se ignoraban.
  Si tu proyecto tiene un `postcss-uxdsl` anterior a beta.6 (sin el
  registro de familias), acotar `--strict-theme`/`--strict` a familias
  específicas falla pidiendo actualizar el paquete, en vez de aceptar
  cualquier nombre sin validarlo; la forma sin acotar (`--strict-theme`
  a secas, o `=false`) sigue funcionando igual.

Ningún cambio afecta la semántica de `--strict-theme` en sí (qué cuenta
como "familia parcialmente heredada de los defaults") — solo qué formas de
escribir el flag el CLI reconoce y valida. Ver la sección "Strict flag
parsing" del [README de uxdsl-cli](../../uxdsl-cli/README.md) para la
tabla completa de formas aceptadas por flag.

### Desde beta.6: cero salidas silenciosas del lenguaje (MIG-B6-14)

beta.6 corrige tres casos en los que la salida no reflejaba la entrada, y
nadie avisaba:

- **Una directiva (`@ds-typo`/`@ds-surface`/`@ds-button`/`@ds-input`) que no
  es hija directa de la regla que estiliza ahora falla** con
  `UXD_DIRECTIVE_CONTEXT` en vez de compilar sin cambios y que el navegador
  la descarte en silencio junto con todo lo que había adentro. Esto incluye
  la directiva en la raíz del documento y una directiva anidada dentro de
  `@media`/`@supports` bajo la regla — las directivas no son responsive por
  sí mismas; poné el valor responsive en cada propiedad
  (`padding: xs(1rem) md(2rem);`), no en la directiva. Un at-rule del
  namespace reservado `ds`/`ds-*` que no es ninguna de esas cuatro
  directivas (un typo, o un alias que nunca existió como `@ds-h1`/`@ds(h1)`)
  falla como `UXD_DIRECTIVE_UNKNOWN`, con sugerencia cuando hay una
  directiva real a distancia de edición 1. Si tu build tenía contenido con
  este error — un componente real de este mismo repo lo tenía
  (`@ds-surface nombre-de-clase { ... }` en vez de `.nombre-de-clase { ... }`,
  ver el commit de esta story) — sus estilos nunca llegaron al navegador;
  corregilo a la sintaxis de regla normal.
- **Una función de nivel superior que no es un breakpoint configurado ni una
  función CSS conocida ahora falla** con `UXD_BREAKPOINT_UNKNOWN` cuando
  aparece junto a una función de breakpoint real en el mismo valor, o está a
  distancia de edición 1 de un breakpoint configurado —
  `padding: xs(1rem) xxl(2rem);` con `xxl` no configurado, o
  `padding: xd(1rem);` a secas. Antes compilaba con el texto inválido tal
  cual. La lista de funciones CSS conocidas (`KNOWN_CSS_FUNCTIONS` en
  `./language`) se consulta antes que la distancia de edición, así que
  `log(...)` nunca se confunde con un typo de `lg`.
- **`color()` ahora distingue un token de la sintaxis nativa por la forma
  del primer argumento**, no por una lista fija de espacios de color:
  `color(from red srgb r g b / 0.5)` y `color(display-p3 1 0 0)` pasan sin
  cambios; `color(primary)`/`color(blue.500)` siguen siendo tokens. Si tu
  build fallaba antes con `UXD_TOKEN_KEY: Expected a token key.` al usar
  sintaxis de color relativo o un espacio de color que esa lista fija no
  cubría, ahora compila.
- **Un `$var` con una expresión responsive se expande igual con el plugin
  usado solo**, no solo desde el CLI: `$gap: xs(1rem) md(2rem); .a { gap:
  $gap; }` produce el valor base más el `@media`, en vez de compilar el
  texto sin expandir `gap: xs(1rem) md(2rem);` (CSS inválido, sin error).

Ninguno de los tres primeros cambios altera el resultado de una compilación
que ya era correcta — solo convierten una salida silenciosamente inválida en
un error accionable. Revisá tu contenido `.uxdsl` si alguno de estos errores
aparece al actualizar: probablemente ya estaba mal, solo que nadie lo veía.

### Desde beta.6: un solo `compile()` compartido entre `uxdsl-cli` y `uxdsl-core` (MIG-B6-18)

`uxdsl-cli` ya no arma su propio pipeline PostCSS in-line; ahora llama al
`compile()` de `uxdsl-core`, el mismo que usará cualquier adaptador de
bundler futuro (Vite/Webpack). `uxdsl-core` en sí mismo pasó de un inliner
de `@import` basado en strings (que cortaba comentarios línea por línea,
sin entender `url(...)` ni bloques `/* */`) a un pipeline real basado en
`postcss-scss`/`postcss-import`/`postcss-advanced-variables`. Esto no
cambia la sintaxis `.uxdsl` ni las opciones del CLI — cambia qué builds que
antes compilaban en silencio ahora fallan, o qué salidas que antes se
corrompían en silencio ahora salen intactas:

- **Un `@import` inexistente ahora falla** con un error ubicado (archivo y
  línea de origen, más `Failed to find '...' in [...]`), en vez de dejar la
  línea `@import` sin resolver en la salida (CSS inválido, sin ningún
  error).
- **Un ciclo de `@import` real (`a.uxdsl` → `b.uxdsl` → `a.uxdsl`) ahora
  falla siempre**, nombrando la cadena completa de archivos, en vez de
  duplicar el contenido una vez en silencio.
- **Un `url(...)` sin comillas que contiene `//`** (por ejemplo
  `background: url(https://ejemplo.com/a.png);`) y **un comentario de
  bloque `/* ... */` que contiene una URL** ya no se corrompen: el inliner
  anterior cortaba todo lo que seguía a un `//` en cada línea, sin entender
  que estaba dentro de un `url()` o de un comentario de bloque.
- Un comentario `//` real (fuera de cualquier `url()`) se sigue eliminando
  de la salida, como lo haría un compilador Sass real.

`processUxdsl(source, options)` de `uxdsl-core` conserva su firma y su
`Promise<string>`; `compile(input, config)` es una exportación nueva. Ver
[`uxdsl-core`'s README](../../uxdsl-core/README.md#compile-input-config)
para su contrato completo.

## Qué hacer si tu build empieza a fallar con `UXD_REFERENCE_MISSING`

1. Leé la cadena completa del mensaje (`consumer -> ... -> token`): te dice
   exactamente qué propiedad, en qué archivo/línea, depende de qué
   variable indefinida.
2. Si el token es tuyo (por ejemplo `--uxdsl__palette__text-secondary` de un
   `palette(text-secondary)` que escribiste), definilo en el tema
   (`theme.palette.text = { secondary: '...' }`).
3. Si el token lo genera un preset por defecto que no usás con esa forma
   (por ejemplo cambiaste todos los `borders[1..5]` pero uno quedó sin
   override), revisá que el override esté completo.
4. Si el token lo provee una hoja de estilos externa que vos mismo
   escribiste (no generada por UXDSL), declaralo explícitamente:
   `references: { externalTokens: ['--mi-variable'] }`.
5. Si necesitás una migración gradual antes de resolver todo, `references:
   { mode: 'warn' }` imprime los mismos diagnósticos como warnings en vez
   de fallar el build — pensado como paso intermedio, no como
   configuración final.

## Codemod: `radius()`/`shadow()` en argumentos de mixin

Parado en `packages/postcss-uxdsl` (o en la raíz de este paquete si lo
instalaste solo):

```bash
# Vista previa (no escribe nada)
npm run codemod:size-overrides -- src/**/*.uxdsl

# Aplica los cambios
npm run codemod:size-overrides -- --write src/**/*.uxdsl

# Equivalente directo
node scripts/codemod-size-overrides.js [--write] <archivos...>
```

Qué hace: busca `@ds-surface(role size)` (o `@ds-button`/`@ds-input`)
seguido, en la misma regla, por una declaración `border-radius: radius(N);`
y/o `box-shadow: shadow(N);` posterior al mixin — y las funde en
`@ds-surface(role size radius(N) shadow(N))`, eliminando la declaración
manual redundante.

Es **idempotente**: correrlo dos veces sobre el mismo archivo no produce
cambios la segunda vez. Preserva comentarios, el resto de las
declaraciones, y el orden. Nunca inventa un tamaño ni descarta información
— los siguientes casos se reportan como `SKIPPED` para revisión manual en
vez de tocarse:

- Más de una declaración `border-radius`/`box-shadow` candidata en la
  misma regla.
- El valor no es una llamada `radius()`/`shadow()` pura (un literal,
  `calc()`, una expresión responsive).
- La declaración tiene `!important` (el argumento del mixin no puede
  expresarlo).
- Hay una segunda llamada a `@ds-surface`/`@ds-button`/`@ds-input` en la
  misma regla antes de la declaración candidata — la declaración se asigna
  a la llamada más cercana, nunca a una anterior.
- Una declaración `border-top-left-radius` (u otra esquina, incluidas las
  lógicas `border-start-start-radius`, etc.) queda entre el mixin y el
  `border-radius` candidato — fundir el shorthand ahí cambiaría cuál gana
  en esa esquina.
- Una declaración `all` (`all: initial`, `all: unset`, `all: revert`, ...)
  queda entre el mixin y la declaración candidata — `all` resetea
  cualquier propiedad, así que mover el radio/sombra al argumento del
  mixin (que corre *antes* del `all`) haría que ese `all` posterior lo
  borre, cuando hoy la declaración manual corre *después* del `all` y
  sobrevive.
- Una regla o at-rule anidada (`@media`, `@supports`, `&:hover`, etc.)
  queda entre el mixin y la declaración candidata — su posición relativa a
  la declaración final es justamente lo que hoy decide qué gana; fundir la
  declaración final la eliminaría de esa posición y podría dejar que la
  regla anidada empiece a aplicar (o deje de ser sobrescrita) sin forma
  genérica de saberlo. Cualquier regla/at-rule anidada en el medio se trata
  como barrera, sin inspeccionar su contenido.

## Decisión de compatibilidad de FEAT-002

La versión de destino de este contrato es **0.5.0-beta.1**, ya publicada.
Se adopta una migración explícita a
`--uxdsl__<familia>__<clave>`, sin aliases automáticos. Los consumidores
existentes deben migrar definiciones y referencias en la misma actualización;
no mezclar CSS precompilado antiguo con un tema generado por la versión nueva.
Esto no depende de asumir que no existen consumidores publicados.

Ejecutar desde el paquete instalado, primero sin `--write`:

```bash
node node_modules/postcss-uxdsl/scripts/codemod-namespace.js styles.css theme.json
node node_modules/postcss-uxdsl/scripts/codemod-namespace.js --write styles.css theme.json
```

La vista previa muestra un diff por línea. Solo seleccionar archivos cuyos
prefijos antiguos pertenecen a UXDSL; también se actualizan referencias en
JSON, overrides CSS y listas `externalTokens`. Las claves lógicas JSON no
cambian. El comando no cambia nombres de propiedades de `theme.typography`
plano: ese escape hatch requiere revisión manual de sus claves y consumidores.
No infiere que `--primary-main` sea un token de Palette.

Para roles tipográficos personalizados y nombres que pertenecen al host,
pasar `--map mapping.json`: un objeto de nombre anterior a nombre destino.
Un mapeo a sí mismo protege un token externo que coincida con un prefijo de
UXDSL. Ejemplo: `{ "--space-host": "--space-host",
"--custom-title-size": "--uxdsl__typography__custom-title-size" }`.
Revisar el diff antes de escribir; conservar el commit anterior permite
revertir la migración. Una segunda ejecución no produce cambios adicionales.

El modo estricto exige un **tema efectivo completo** para las dependencias de
los presets emitidos (incluyendo Spacing 1–16 y Palette de controles). Desde
beta.2, `resolveTheme` combina los overrides con los defaults canónicos antes
de validar. Las referencias desconocidas siguen fallando; no se desactiva la
validación. CSS externo sin DSL permanece fuera de esa validación; proveedores
externos alcanzados desde tokens deben declararse explícitamente.

La validación estática prueba `:root`, selectores idénticos y condiciones
reconocidas; no sustituye un motor CSS para selectores arbitrarios, herencia,
capas o estados combinados. La fixture de navegador comprueba el contrato
responsive usado por el consumidor. Antes de reemplazar una hoja runtime,
generar el CSS completo correctamente; ante una excepción conservar la hoja
y el último tema válido.

## Verificación

Los ejemplos de este documento están verificados contra los tests de este
checkout (`postcss-uxdsl@0.5.0-beta.2`):
`test/spacing-normalization.test.js`, `test/include-theme.test.js`,
`test/border-colors.test.js`, `test/size-overrides.test.js`,
`test/codemod-size-overrides.test.js`, `test/naming.test.js` — `npm test`
corre los casos, incluidos estos. `fixtures/mig07-consumer/` (`npm run
verify:consumer-fixture` desde la raíz del monorepo) verifica además el
nombrado `--uxdsl__<familia>__<clave>` instalando el paquete desde un
tarball real, no desde el código fuente del monorepo.
