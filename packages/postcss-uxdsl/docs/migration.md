# Migrando de UXDSL 0.3.x a los cambios de la beta 0.5

> **Alcance de este documento:** describe el comportamiento de este
> paquete tal como se publica (`postcss-uxdsl@0.3.0`). No hay un release
> `0.5.0-beta.x` real todavía — este documento existe para que la
> migración se pueda validar y ajustar antes de que exista uno. Ver el
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
| Spacing keys | `"space-1"` y `"1"` en el JSON emiten variables distintas (`--space-space-1` vs `--space-1`); density/radius apuntan solo a la forma sin prefijo | Ambas formas emiten `--space-1`; usar ambas en la misma config lanza `UXD_SPACING_COLLISION` | Corrección de bug, no sintaxis nueva |
| Entradas múltiples | Cada archivo compilado emite siempre `:root` completo (foundations, density, shadows, edges, surfaces, buttons, inputs) | `includeTheme: false` en la opción del plugin desactiva esos ocho emisores para una entrada que solo consume tokens de otra | Opt-in; por defecto (`true`) no cambia nada |
| Referencias indefinidas | `var(--token-inexistente)` se emitía igual; el navegador simplemente no aplicaba la propiedad | Falla el build con `UXD_REFERENCE_MISSING`/`UXD_REFERENCE_CYCLE`, indicando la cadena completa de dependencia | Ver "Qué hacer si tu build empieza a fallar" abajo |
| `border(1..5)` | Requería que el tema definiera `colors.gray.{300,400,500,600}` manualmente, o las propiedades quedaban inválidas en silencio | Ese `gray` por defecto se mezcla automáticamente (tus shades ganan por clave si los definís) | Nadie necesita cambiar código; los temas que ya definían `colors.gray` siguen ganando |
| Tamaño de surface/button/input | `@ds-surface(role size)` fija padding y radius juntos; para radio/sombra distintos había que sobreescribir la propiedad a mano después del mixin | `@ds-surface(role size radius(key) shadow(key))` fija radio/sombra de forma independiente | Sintaxis nueva, opt-in; ver tabla de sintaxis abajo |

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
- **`includeTheme: false` sin pasar `theme`** (para que el componente no
  necesite conocer el tema en absoluto) no está soportado — hoy hace falta
  pasar el mismo objeto `theme` a cada entrada para que las referencias
  validen y los nombres de variable coincidan.
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
  (`test/include-theme.test.js`); la verificación con un build real de
  Next.js + `css-loader` instalando paquetes empaquetados desde tarballs
  sigue pendiente.

## Qué hacer si tu build empieza a fallar con `UXD_REFERENCE_MISSING`

1. Leé la cadena completa del mensaje (`consumer -> ... -> token`): te dice
   exactamente qué propiedad, en qué archivo/línea, depende de qué
   variable indefinida.
2. Si el token es tuyo (por ejemplo `--ds__palette__text-secondary` de un
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

## Verificación

Los ejemplos de este documento están verificados contra los tests de este
checkout (`postcss-uxdsl@0.3.0`):
`test/spacing-normalization.test.js`, `test/include-theme.test.js`,
`test/border-colors.test.js`, `test/size-overrides.test.js`,
`test/codemod-size-overrides.test.js` — `npm test` corre los 103 casos,
incluidos estos.
