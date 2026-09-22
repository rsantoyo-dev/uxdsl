# Migración a UXDSL 0.5.0-beta.2

## Adelanto beta.6 — MIG-B6-29: el tema por defecto cambió (sin publicar)

`DEFAULT_THEME` pasó de un subconjunto mínimo (4 familias de palette, 3
familias de fuente, sin `modes.dark` ni `fonts.google`) al JSON base completo
(`postcss-uxdsl/theme/base.json`) que antes sólo usaba el playground. Un
proyecto **sin tema propio** ve un cambio visual real al actualizar. Uno con
tema propio no ve cambio en ninguna clave que su propio tema ya declare —
`deepMergeTheme` sigue mezclando por clave; sólo lo que el proyecto nunca
mencionó cambia.

Para conservar el mismo `main`/`dark`/`contrast`/`ui`/`ui-2`/`code` de
beta.5, agregar este override (sustituye únicamente esas claves; todo lo
demás del JSON base —incluidas las 10 familias de palette nuevas, y las
siete familias densities/borders/radii/shadows/surfaces/buttons/inputs,
sin cambio de valor respecto a beta.5— sigue disponible pero simplemente
no lo usa ningún componente que sólo referencie
`primary`/`surface`/`neutral`/`error`). No es bit-a-bit idéntico a beta.5:
`primary`/`surface`/`neutral`/`error` ganan además un `light` que beta.5
nunca definió (mezcla por clave, no hay forma de quitarlo) — una variable
CSS más por familia, sin efecto visual salvo que el propio proyecto
empiece a referenciar `palette(<familia>.light)` a propósito):

```json
{
  "palette": {
    "primary": { "main": "#7e22ce", "dark": "#581c87", "contrast": "#ffffff" },
    "surface": { "main": "#ffffff", "dark": "#dde5eb", "contrast": "#102a43" },
    "neutral": { "main": "#e2e8f0", "dark": "#cbd5e1" },
    "error": { "main": "#c61625" }
  },
  "fonts": {
    "google": [],
    "families": {
      "ui": "Inter, system-ui, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      "ui-2": "Roboto, \"Helvetica Neue\", Arial, sans-serif",
      "code": "Menlo, \"SF Mono\", Monaco, Inconsolata, \"Roboto Mono\", \"Source Code Pro\", monospace"
    }
  }
}
```

`fonts.google: []` reemplaza el array completo (no lo vacía por partes) y
evita la petición real a Google Fonts que el nuevo default hace por defecto.

**Esta receta no cubre `typography_details`.** `DEFAULT_THEME.typography_details`
ya no viene de `typography-defaults.ts`'s `DEFAULT_TYPOGRAPHY` (ver más abajo);
viene del JSON base, con una forma de campos distinta (por ejemplo, `h1.lineHeight`
pasa de `xs(1.1) md(1.1)` a `xs(1.2) md(1.3)`, y ningún rol trae ya
`fontFamily`/`textTransform`/`textDecoration`/`fontStyle`/`marginBlockStart`/
`marginBlockEnd` por defecto salvo que el propio rol los declare). Reconciliar
esa forma es responsabilidad explícita de MIG-B6-17, no de esta receta — un
proyecto que también quiera fijar `typography_details` exactamente como en
beta.5 debe copiar el bloque completo desde la versión de `typography-defaults.ts`
de beta.5 a su propio override.

**`modes.dark` no tiene receta de eliminación.** `deepMergeTheme` mezcla
objetos por clave y nunca borra una clave — no existe un valor de override
que quite `modes.dark` una vez que `DEFAULT_THEME` lo define (`modes: {}`
es un no-op, exactamente como no mencionar `modes` en absoluto: ver la
sección "Zero-config defaults" del README). Esto es una decisión explícita
del dueño de esta historia, no un vacío de esta guía. Lo único soportado:
- Fijar el modo claro en pantalla con `data-theme="light"` en `<html>` — el
  CSS de modo oscuro se sigue emitiendo (el selector `:root:not([data-theme='light'])`
  simplemente no aplica), no es una reducción de bytes, es una fijación visual.
- Si además se quiere que el modo oscuro sea visualmente un no-op (no sólo
  fijado, sino idéntico al claro), sobrescribir cada clave de
  `modes.dark.palette.<familia>` con el mismo valor que su
  `palette.<familia>` correspondiente — sigue emitiéndose el CSS, deja de
  cambiar nada visible.

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

### Desde beta.6: el plugin descubre el tema del proyecto solo, y `init` deja de escribir `breakpoints` (MIG-B6-19)

Usado directamente (por ejemplo desde el `postcss.config.js` propio de un
proyecto Next.js), el plugin ya no valida siempre contra el tema por
defecto. Si se omite `theme`, busca un `uxdsl.theme.config.{cjs,js,json}` o
`uxdsl.theme.json` convencional en `configRoot` (por defecto
`process.cwd()`) — el mismo descubrimiento que `uxdsl-cli` siempre tuvo,
ahora compartido vía `postcss-uxdsl/config`. Si tu `postcss.config.js`
necesitaba pasar `theme` a mano porque el tema real vivía en un archivo así,
ya no hace falta: quitalo y dejá que el plugin lo descubra, o pasá
`discoverTheme: false` si preferís seguir validando contra el tema por
defecto a propósito.

Quien use `postcss-uxdsl/config` directamente (un adaptador de bundler, o
una integración propia) encuentra ahí `findThemeConfigPath`,
`loadThemeConfigAsync`/`loadThemeConfigSync`, `discoverThemeAsync`/
`discoverThemeSync`, `normalizeThemeExport` y `warnIfLooksLikeBuildConfig` —
la misma resolución que antes vivía sólo dentro de `uxdsl-cli`. La versión
sync (la que usa el plugin) rechaza un archivo de tema que exporta una
función async, con un mensaje que indica pasar `theme` ya resuelto en su
lugar.

Aparte, `uxdsl init` ya no escribe `breakpoints:` en el `uxdsl.config.cjs`
que genera. Si tenías un `uxdsl.config.cjs` generado por una versión
anterior con el mapa completo de breakpoints por defecto copiado ahí, y
también declarás `breakpoints` en tu `uxdsl.theme.config.*`, ese
`uxdsl.config.cjs` viejo va a seguir ganando clave por clave (sin cambios de
precedencia) — pero ahora vas a ver un aviso una vez, nombrando los dos
archivos, en vez de que el valor del tema desaparezca en silencio. Si el
tema es la fuente real, borrá `breakpoints` de `uxdsl.config.cjs` para que
el aviso desaparezca y el tema mande.

### Desde beta.6: Vite y Webpack entregan CSS real, no un `<style>` inyectado en runtime (MIG-B6-20)

**`vite-plugin-uxdsl`:** un `import './panel.uxdsl'` ya no compila a un módulo
JS que inserta un `<style>` en `document.head` en tiempo de ejecución. Ahora
compila a un id que Vite reconoce como CSS, así que `vite build` extrae un
`.css` real, el HMR es el nativo de Vite (no uno propio) y SSR recibe un
módulo vacío en vez de un `typeof document !== 'undefined'` que nunca era
`true` en el servidor. Si tu código hacía `import css from './panel.uxdsl'`
esperando el string compilado, cambialo a
`import css from './panel.uxdsl?inline'` — el mismo sufijo que ya usa
cualquier import CSS de Vite. Se eliminó también la inyección automática de
los packs legacy `default-*.css`/`.uxdsl` (tema, spacing, colors,
typography, densities, radii, shadows, borders, surfaces, inputs, buttons):
el `compile()` que corre ahora ya emite las mismas definiciones globales
cuando `includeTheme` es `true` (el default), así que esos packs nunca
hicieron falta para un proyecto usando el compilador real. El modo
`scss: 'auto'` (activado en silencio si el proyecto tenía `sass` instalado
por cualquier motivo) se eliminó; `scss: 'on'` sigue andando igual, ahora
como opción explícita únicamente. El plugin también descubre
`uxdsl.theme.config.*`/`uxdsl.theme.json` del proyecto solo, igual que
`uxdsl-cli` (ver la sección de MIG-B6-19 arriba) — si le pasabas `theme`
manualmente sólo para que compile contra el tema real, ya no hace falta.

**`uxdsl-webpack-loader`:** encadenalo antes de `css-loader` (con
`style-loader` o `MiniCssExtractPlugin.loader` delante de ese) — antes
devolvía `module.exports = "css compilado como string"`, que `css-loader`
no podía interpretar como CSS real en absoluto. El loader ahora también
llama a `this.addDependency()` por cada parcial importado (y por el archivo
de tema descubierto), así que el caché y el modo watch de Webpack ven sus
ediciones; antes no los veían en absoluto. Las opciones llegan por
`this.getOptions()` (la API real de Webpack 5), no por `this.query`.

**Los cuatro caminos (CLI, `uxdsl-core` usado directo, Vite, Webpack)**
ahora comparten exactamente el mismo `compile()` y dan el mismo CSS para la
misma entrada y el mismo tema — verificado en `fixtures/parity/`. Un efecto
colateral real de unificar Webpack sobre `compile({ source, from })`: un
ciclo de `@import` alcanzado sólo por ese camino (nunca por `{ entry }`) no
fallaba antes de esta story, aunque sí fallaba correctamente vía `{ entry }`
desde MIG-B6-18 — corregido en el mismo cambio, para los cuatro caminos por
igual.

### Desde beta.6: `uxdsl watch` sobrevive errores, escribe sólo lo que cambió, y recompila selectivamente (MIG-B6-23)

Antes, un error de compilación inicial (o un `uxdsl.config.cjs`/tema roto
al arrancar) terminaba el proceso — con `concurrently
--kill-others-on-fail`, eso además tumbaba el `next dev`/`vite`/etc. que
corría en paralelo. Ahora `uxdsl watch` (y `uxdsl build --watch`) imprime
el error y sigue vigilando: un config roto se recupera solo al corregirlo,
sin reiniciar el proceso. `uxdsl build` sin `--watch` no cambia — sigue
saliendo con código 1 ante cualquier error, como siempre.

Cada rebuild ahora también:

- **Escribe sólo lo que cambió, atómicamente.** Una entrada cuya salida
  compilada es idéntica byte a byte a la que ya está en disco no se
  reescribe — mismo mtime, mismo inode — en vez de reescribirse siempre.
  Si tenías un flujo que dependía de que el archivo *siempre* se
  reescribiera (por ejemplo, para forzar un reload en una herramienta que
  no mira el contenido), ese comportamiento cambió a propósito: es
  exactamente lo que evita que un HMR externo recargue hojas de estilo que
  no cambiaron.
- **Recompila sólo las entradas afectadas** en un `builds` con más de una
  entrada — editar un parcial que sólo importa la entrada B ya no
  recompila (ni reescribe) la entrada A. Editar el config, el tema, o
  cualquier `require()` de cualquiera de los dos sigue recompilando todo,
  como corresponde a algo compartido entre entradas.

Ninguno de los dos cambios altera qué CSS final produce una entrada dada —
sólo cuándo y con qué frecuencia se escribe a disco, y cuáles otras
entradas un cambio dispara.

### Desde beta.6: una entrada `.module.css` que emitiría `:root` ahora falla antes de escribir (MIG-B6-24)

En un `builds` con una entrada de tema y varios paneles CSS Modules, una
entrada cuyo `outFile` termina en `.module.css` pero cuyo `includeTheme`
efectivo sigue siendo `true` (u otra vía, como un import legacy, sigue
introduciendo `:root`/`#uxdsl-bp-meta`) ahora falla, antes de escribir nada,
en vez de compilar en silencio un archivo que Next.js (u otro loader de CSS
Modules) rechaza igual en tiempo de build real ("Selector :root is not
pure"). El mensaje nombra la entrada exacta y sugiere el fix:

```
[uxdsl] Error: builds[1] (src/panel.module.css): this entry would emit :root and #uxdsl-bp-meta, which CSS Modules reject ("Selector :root is not pure"). Set includeTheme: false for component entries.
```

Si tu `uxdsl.config.cjs` nombra la entrada de tema compartida con sufijo
`.module.css` (por ejemplo, `theme.module.css`, para mantener una
convención de nombres uniforme con los paneles), renombrala sin ese sufijo
— `theme.css` — y dejá `.module.css` sólo para las entradas
`includeTheme: false` que de verdad se importan como CSS Modules. La
detección es sobre el CSS ya compilado (un selector real, vía parseo, no
una búsqueda de texto), así que un comentario o un `content: ":root"` en
tu propio CSS nunca la dispara.

Por separado, más de una entrada emitiendo el tema (con cualquier nombre de
archivo) ahora avisa una sola vez, sin fallar — normalmente es un error de
configuración, no necesariamente algo que rompa un CSS Modules build:

```
[uxdsl] Warning: 2 entries emit the theme (builds[0], builds[1]); usually only one theme entry should.
```

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

### Desde beta.6: `@ds-typo` emite sólo lo que define el tema (MIG-B6-17)

`@ds-typo(rol)` emitía 10-11 declaraciones fijas por uso, con valores de
respaldo que venían de un mapa dentro del compilador, no del tema. Ahora emite
**una declaración por campo que el tema efectivo define para ese rol**, sin
ningún respaldo literal.

Cambios visibles, todos deliberados:

- **Los enlaces conservan su subrayado.** Antes se aplicaba
  `text-decoration: none` a todo uso de `@ds-typo`, incluso sobre un `<a>`
  (problema de WCAG 1.4.1).
- **Los márgenes ya no rompen flex ni grid.** `auto` colapsa a `0` en flujo
  normal pero *absorbe el espacio libre* dentro de un contenedor flex o grid.
  `theme/base.json` ahora define `marginBlockStart`/`marginBlockEnd` como
  `"0"`: el render en flujo normal es idéntico, sin la trampa.
- **`caption` y `small` ya no se atenúan con `opacity: 0.8`.** Reducía el
  contraste y era imposible de sobrescribir desde el tema, porque `opacity`
  no es un campo de tipografía. Si se quiere un caption atenuado, expresarlo
  con un color de palette en el componente.
- **`text-transform` y `font-style` ya no se resetean.** Sus valores iniciales
  de CSS ya son `none`/`normal`, así que en aislamiento no cambia nada — pero
  ambos se heredan, así que un elemento con `@ds-typo` dentro de un padre en
  mayúsculas o en cursiva ahora hereda ese padre en vez de resetearlo.
- `code` y `pre` ahora sí emiten `font-weight` y `letter-spacing`: el tema ya
  los definía, la directiva simplemente nunca los leía.
- Un rol que el tema efectivo no define falla como `UXD_TYPO_REFERENCE`,
  señalando la directiva y listando los roles disponibles. Nunca cae en
  silencio a `default`.

**Para recuperar el aspecto de beta.5**, definir los campos en el propio tema.
Ahora son campos de tipografía normales, así que además son sobrescribibles,
cosa que los respaldos hardcodeados nunca fueron:

```json
{
  "typography_details": {
    "default": {
      "textTransform": "none",
      "textDecoration": "none",
      "fontStyle": "normal",
      "marginBlockStart": "auto",
      "marginBlockEnd": "auto"
    }
  }
}
```

`opacity` no tiene equivalente: nunca fue un campo de tipografía, así que no
se puede restaurar desde el tema. Aplicarlo en el componente si hace falta.

Tamaño de salida: una fixture con 100 usos de `@ds-typo` sobre 13 roles pasa
de 63.455 a 40.296 bytes (−36,5%).

## Tema en runtime: de los setters por token a `applyTheme` (0.5.0-beta.6)

Hasta beta.5, cambiar un tema en el navegador se hacía token a token:
`updatePalette('primary.main', '#e11d48')`, `updateColor`, `updateSpacing`,
`breakpoints.update(...)`. Cada uno escribía un *estilo inline* en `<html>` y,
opcionalmente, una de cuatro claves de `localStorage`.

Desde beta.6 hay un solo modelo: el mismo JSON que compila el build.

```ts
import { applyTheme } from 'postcss-uxdsl/ds-runtime'

// Una vez, al arrancar: el override con el que se compiló el proyecto.
applyTheme(projectOverride, { replace: true, styleId: 'uxdsl-ssr-theme' })

// Después: un parche se mezcla sobre lo aplicado.
const result = applyTheme({ palette: { primary: { main: '#e11d48' } } })
if (!result.ok) console.error(result.error.message)
```

| Antes | Ahora |
| --- | --- |
| `updatePalette('primary.main', v)` | `applyTheme({ palette: { primary: { main: v } } })` |
| `updateColor('gray.300', v)` | `applyTheme({ colors: { gray: { 300: v } } })` |
| `updateSpacing(4, v)` | `applyTheme({ spacing: { 4: v } })` |
| `breakpoints.update('md', 800)` | No equivale: mover un umbral exige recompilar (ver abajo) |
| `loadPersisted()` y sus tres variantes | `loadPersistedTheme()`, que además migra las cuatro claves |
| `subscribe(({ type, detail }) => …)` | `subscribeTheme((override) => …)` |

**Nada se ha eliminado en beta.6.** Los setters antiguos, sus getters, el
`reset` por token, los links entre tokens y el evento `{ type, detail }` de
`subscribe` siguen exactamente igual. Son dos APIs conviviendo, no un rename.

### Lo que no es un wrapper equivalente

Tres capacidades de los setters antiguos **no** tienen equivalente en
`applyTheme`, y conviene saberlo antes de migrar:

- **Scope por elemento.** `updatePalette(token, valor, { scope: '#panel' })`
  escribe en ese elemento. `applyTheme` gestiona una hoja global por documento;
  no aplica un scope local a `:root`. Si necesitas un valor sólo dentro de un
  subárbol, sigue usando el setter con `scope`, o escribe tu propia regla CSS.
- **Mover breakpoints en caliente.** `breakpoints.update('md', 800)` reescribe
  el texto de las media queries ya compiladas. `applyTheme` **rechaza** mover un
  umbral con `UXD_THEME_STRUCTURE`, porque las reglas de tus componentes se
  compilaron con el valor anterior y cambiar sólo las variables las dejaría
  inconsistentes. El adaptador antiguo sigue disponible para quien acepte esa
  reescritura textual; la vía soportada es recompilar.
- **Links entre tokens.** `link(alias, source)` propaga un cambio de un color a
  los tokens de paleta que lo usan. No hay equivalente: en el modelo JSON eso se
  expresa escribiendo el valor en los dos sitios, o refiriendo uno al otro con
  `var()` en el propio tema.

### Qué rechaza `applyTheme`

`applyTheme` sustituye variables; no puede reescribir las reglas que tu build ya
compiló. Un parche que cambie *qué declaraciones emitiría una directiva* falla
con `UXD_THEME_STRUCTURE`, nombrando cada cambio y pidiendo recompilar: añadir o
quitar un campo de `typography_details`, introducir un estado como
`focusvisible`, cambiar el Surface del que compone un Button o un Input, mover
un umbral existente, o que una familia de Palette deje de tener
`main`/`dark`/`contrast`. Cambiar valores, expresiones responsive sobre los
mismos umbrales, colores de modo oscuro y añadir tokens nuevos se aplica con
normalidad.

### Migración del almacenamiento

La primera llamada a `loadPersistedTheme()` que no encuentre nada bajo
`uxdsl:theme` convierte las cuatro claves antiguas en un único override, lo
aplica, escribe la clave nueva, **la vuelve a leer** y sólo entonces borra las
antiguas. Un parche rechazado, una escritura bloqueada o una que el navegador
descarte en silencio dejan las cuatro claves intactas: nunca te quedas sin
ninguna de las dos copias. `{ migrateLegacy: false }` lo desactiva.

Deshacer el formato antiguo no se hace partiendo por guiones —
`primary-dark-hover` es `primary` + `dark-hover` mientras que
`brand-accent-main` es `brand-accent` + `main`, y la cadena sola no lo
distingue. El corte se resuelve contra los nombres de familia que declara tu
tema, de más largo a más corto; un token que no case con ninguno se reporta en
`warnings` y se omite, en vez de archivarse bajo una familia inventada.

Una clave `uxdsl:theme` válida gana siempre y no se mezcla con las antiguas. Una
clave nueva **corrupta** es un error, no un silencioso volver a las antiguas:
eso sustituiría tu tema por otro distinto y lo llamaría éxito.

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
