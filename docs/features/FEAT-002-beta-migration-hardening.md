# FEAT-002 — Mejoras de confiabilidad y migración de UXDSL 0.5

| Campo | Valor |
| --- | --- |
| Estado | MIG-01, MIG-02, MIG-04 y MIG-06 implementados; MIG-03, MIG-05, MIG-07 y MIG-08 siguen parcialmente cerrados (ver la sección de cada uno para el detalle exacto — MIG-05 le falta el autocompletado del editor). Suite de `postcss-uxdsl` en 116/116, `uxdsl-core` pasa, la fixture de consumidor (MIG-07) está en verde para sus comprobaciones no visuales, y `fixtures/mig02-nextjs-cssmodules/` verifica un build real de Next.js contra `css-loader` en modo estricto (con control negativo). Nota cruzada MIG-02/MIG-07: son dos fixtures separadas — ninguna verifica todavía instalar desde un tarball empaquetado *y* pasar por ese build de Next.js a la vez. |
| Origen | Feedback de migración real de 0.3.0 a 0.5.0-beta.0 |
| Prioridad general | P0 para integridad de tokens y compatibilidad multi-entrada |
| Objetivo | Resolver bloqueantes durante la beta y definir los contratos antes de estable |
| Responsables y fechas | Por asignar; sin compromiso de release |
| Relación | Complementa [FEAT-001 — Unified Language Engine](./FEAT-001-unified-language-engine.md) |

## Contexto y evidencia

El reporte describe una aplicación Next.js 16 con CSS Modules y cinco configuraciones: una entrada de tema con `includeTheme: true` y cuatro bundles de panel. La migración abarcó aproximadamente 82 usos de `@ds-surface`, `@ds-button` y `@ds-input`, y 320 usos de `@ds-typo`.

Los números y comportamientos siguientes proceden del feedback, no de una reproducción independiente. Las referencias a líneas de código del reporte pueden corresponder al paquete publicado y deben localizarse de nuevo antes de implementar.

| Hallazgo reportado | Impacto observado |
| --- | --- |
| Keys de spacing como `space-1` reciben otro prefijo | Se emite `--space-space-1`, pero las densidades apuntan a `--space-1`; 174 referencias colgantes en un bundle |
| Entradas de componente reciben bloques globales `:root` | Las cuatro entradas CSS Module fallan con `Selector ":root" is not pure` |
| Tokens globales repetidos | Nueve bloques `:root` con 116 declaraciones, reportadas como duplicados exactos del tema |
| Un único size controla padding y radius | Nueve de 38 usos de surface necesitaron sobrescribir el radio después del mixin |
| Presets `border(1..5)` referencian colores no emitidos | Sin el import de colores por defecto, las propiedades quedan inválidas silenciosamente |
| Cambio de gramática sin guía incluida ni codemod oficial | La migración requirió leer implementación y tests para deducir la sintaxis |

## Capacidades que debemos conservar

- Validación estricta con diagnósticos accionables. El reporte confirma que `UXD_DENSITY_REFERENCE` detectó un `density(16)` inexistente en el tema usado.
- Paridad entre las variables producidas por PostCSS y runtime, extendida a condiciones y comportamiento en navegador.
- Valores responsive dentro de tokens, como `xs(space(2)) md(space(3))`.
- Modelo role × tone × size, manteniendo suficiente control sobre cada propiedad.
- Salida CSS utilizable sin JavaScript de runtime obligatorio y compatible con CSS Modules, Tailwind y CSS plano.

## Prioridades y entregables

P0 bloquea una beta utilizable en este escenario. P1 debe resolverse o tener una decisión explícita antes de estable. P2 mejora la arquitectura sin justificar otra ruptura inmediata del CSS público.

| ID | Prioridad | Mejora | Esfuerzo relativo estimado | Dependencias |
| --- | --- | --- | --- | --- |
| MIG-01 | P0 | Normalizar keys de spacing sin doble prefijo | Bajo–medio | Fixture del caso reportado |
| MIG-02 | P0 | Separar emisión de tema y emisión de componentes | Medio | Contrato explícito de `includeTheme` |
| MIG-03 | P0 | Validar integridad referencial de tokens | Medio–alto | Inventario de tokens y contexto multi-entrada |
| MIG-04 | P0 | Resolver dependencias de colores de los presets border | Bajo–medio | MIG-03 para prevenir regresiones |
| MIG-05 | P1 | Recuperar control independiente de padding, radius y shadow | Medio | Decisión de gramática compartida con FEAT-001 |
| MIG-06 | P1 | Publicar guía de migración, changelog y codemod | Medio | Contratos finales de MIG-01, MIG-02 y MIG-05 |
| MIG-07 | P1 | Probar una instalación real multi-entrada desde paquetes | Medio | Fixtures iniciales desde el comienzo; cierre tras MIG-01–06 |
| MIG-08 | P2 | Centralizar la convención de nombres de variables | Alto si cambia nombres públicos | Inventario y estrategia de compatibilidad |

Las estimaciones sirven para ordenar trabajo, no como plazos. Los parches P0 no deben esperar a completar toda la extracción arquitectónica de FEAT-001.

## MIG-01 — Normalización compatible de spacing

Implementado en este checkout (paquetes identificados como 0.3.0): normalización
compartida por PostCSS y `generateThemeCss`, sin cambiar versiones ni publicar.
La reproducción sobre el artefacto 0.5.0-beta.0 sigue pendiente de MIG-07.

> **Corrección (auditoría posterior a MIG-04/05/06):** esta sección se marcó
> "Implementado" con las casillas en `[x]` mientras el código real vivía solo
> en un `git stash` sin aplicar (creado durante el rebase a la arquitectura
> unificada de FEAT-001) — `foundations.ts` seguía emitiendo `--space-${key}`
> directo, sin normalizar, y no existía ningún test cubriendo la
> normalización. El doc describía trabajo que no estaba en el árbol. Ya se
> porteó `normalizeSpacingKey`/`normalizeSpacingDefinitions` (`language.ts`)
> a la arquitectura actual, se conectó en `foundations.ts`, y se agregó
> `test/spacing-normalization.test.js` (5 casos, uno por criterio de
> aceptación). Las casillas de abajo ahora reflejan el estado real y
> verificado. Lección: al recuperar un archivo de un stash con
> `git checkout stash@{n} -- <path>`, si es un `.md` que describe una
> implementación, hay que recuperar o re-portear el código correspondiente
> en el mismo paso — nunca dejar la documentación por delante del código.

Definir una representación interna única para los identificadores. Durante la migración, aceptar la forma numérica y la forma histórica prefijada cuando su interpretación sea inequívoca; emitir el nombre público una sola vez.

Criterios de aceptación:

- [x] `"1"` y `"space-1"`, en configuraciones separadas, producen `--uxdsl__space__1` y referencias compatibles; `--space-1` queda solo como nombre histórico del reporte.
- [x] Si ambas keys aparecen en una configuración, se detecta la colisión; nunca gana una por orden accidental.
- [x] No se eliminan prefijos de identificadores arbitrarios sin una regla documentada.
- [x] Density y radius conservan sus referencias y resuelven con el spacing configurado (comprobado en el CSS emitido; validación de navegador en MIG-07).
- [x] Hay cobertura con configuraciones legacy, nuevas y escalas personalizadas.

## MIG-02 — Tema único y entradas CSS Module

Usar `includeTheme` para expresar quién emite las definiciones globales. Una entrada de componente puede consumir tokens definidos por la entrada de tema sin volver a declararlos globalmente.

Implementado en este checkout (paquete identificado como 0.3.0): opción
`includeTheme` en el plugin PostCSS de `postcss-uxdsl`, sin cambiar versiones
ni publicar. Verificado a nivel de compilación PostCSS con pruebas de
contrato (`test/include-theme.test.js`) y, ahora también, con un build real
de Next.js contra `css-loader` en modo estricto
([`fixtures/mig02-nextjs-cssmodules/`](../../fixtures/mig02-nextjs-cssmodules/),
detalle en el criterio de aceptación correspondiente abajo). Sigue
pendiente de MIG-07 la combinación de ambos: instalar desde un tarball
empaquetado *y* pasar por ese mismo build de Next.js (hoy son dos
fixtures separadas — MIG-07 verifica el tarball, este fixture verifica
Next.js/css-loader, cada una contra el código fuente del monorepo o el
tarball respectivamente, pero no las dos cosas a la vez).

Criterios de aceptación:

- [x] Con `includeTheme: false`, los emisores de foundations, shadows, edges, surfaces, buttons e inputs no añaden `:root` globales. Density y typography comparten el mismo defecto (también emitían `:root` sin condición) y quedan cubiertos por la misma bandera, aunque el hallazgo original no los nombró explícitamente.
- [x] Con `includeTheme: true` (valor por defecto), el tema emite todas las definiciones necesarias sin duplicados evitables — comportamiento idéntico al existente antes de este cambio; los tests de regresión de `unified-engine`, `surfaces`, `buttons`, `inputs`, `shadows`, `edges` y `typography` siguen pasando sin modificarse.
- [x] La fixture de cinco entradas compila en Next.js con CSS Modules sin el plugin que elimina `:root` —
  [`fixtures/mig02-nextjs-cssmodules/`](../../fixtures/mig02-nextjs-cssmodules/)
  (`npm run verify:cssmodules-build` desde la raíz) compila los mismos 5
  entries que usa MIG-07 y corre un `next build` real (no un `webpack.config`
  aproximado): el código fuente de Next.js
  (`next/dist/build/webpack/config/blocks/css/loaders/modules.js`) fija
  `modules: { mode: "pure" }` sin condición para todo `.module.css`, que es
  exactamente el modo que rechaza un selector sin clase/id local (incluido
  `:root`). El build pasa limpio con los cuatro paneles reales (sin
  `:global()` ni ningún otro workaround) y, como control negativo, el mismo
  contenido de la entrada de tema guardado con extensión `.module.css` hace
  fallar el build con el error real de css-loader (`"... is not pure (pure
  selectors must contain at least one local class or id)"`) — así el check
  anterior no es "cualquier CSS pasa". No usa navegador (`next build` es un
  paso Node-only). No cubierto: render real en navegador de las páginas
  compiladas, y el pipeline específico del App Router (`app/`) — este
  fixture usa el Pages Router; el loader de CSS Modules es el mismo para
  ambos, pero no se ejerció el build de `app/` en particular.
- [x] Se documentan el valor por defecto, la importación del tema y el caso standalone de una sola entrada (README de `postcss-uxdsl`, sección "Multi-entry theming (`includeTheme`)").
- [x] Se preservan reglas del usuario y reglas de componente necesarias: `includeTheme: false` solo desactiva los ocho emisores globales listados arriba; `@ds-surface`, `@ds-button`, `@ds-input`, `@ds-typo` y las funciones de valor (`space()`, `palette()`, `density()`, `radius()`, `shadow()`, `border()`) se siguen expandiendo y validando igual, y siguen rechazando referencias indefinidas (`@ds-surface(missing)`, `shadow(missing)`, temas inválidos) con `includeTheme` en cualquier valor.
- [x] Compilaciones consecutivas con distintos valores de `includeTheme` no comparten estado — probado intercalando `false`/`true`/`false` sobre el mismo tema y comparando la salida. No se probó concurrencia real (`Promise.all` sobre el mismo proceso PostCSS) más allá de lo ya cubierto por los tests de aislamiento de FEAT-001.

Pendiente de decisión, fuera de este parche: si `includeTheme: false` debería
además aceptar una entrada sin `theme` (asumiendo que el tema vive en otro
archivo) para simplificar la configuración de las cuatro entradas de panel
del reporte; hoy sigue siendo necesario pasar el mismo objeto `theme` a cada
entrada para que las referencias validen y generen los mismos nombres de
variable.

## MIG-03 — Integridad referencial

Construir un grafo de definiciones y referencias UXDSL antes de emitir CSS. Cada referencia debe poder resolverse contra el tema efectivo, las otras entradas declaradas del proyecto o una dependencia externa explícita.

No basta con exigir que cada `var()` exista en el mismo archivo: eso rechazaría entradas de componente válidas. Tampoco corresponde rechazar variables CSS escritas por el usuario que no pertenecen a UXDSL.

Criterios de aceptación:

- [ ] Detectar tokens inexistentes, dependencias transitivas ausentes y ciclos.
- [ ] Informar código, token consumidor, referencia faltante, cadena de dependencias y ubicación cuando esté disponible.
- [ ] Distinguir referencias emitidas por UXDSL de CSS externo y reconocer fallbacks válidos.
- [ ] Validar componentes contra el tema declarado sin obligarlos a emitir sus definiciones.
- [ ] Fallar ante una dependencia UXDSL obligatoria ausente; nunca emitir silenciosamente un valor inválido.
- [ ] Respetar las escalas del tema: `density(16)` es válido si está definido, aunque no exista en los defaults.
- [ ] Comprobar scope, cascade y breakpoints con pruebas de navegador; encontrar un nombre en el grafo no demuestra que aplique al elemento.
- [ ] PostCSS y runtime comparten la validación; una actualización inválida de runtime conserva el último tema válido.

> **Nota de consecuencia (auditoría MIG-04/05/06):** `enforceReferences`
> quedó conectado en `index.ts` validando *todos* los bloques `:root` que
> el plugin siempre emite (density 1-15, los tres surfaces/buttons/inputs
> por defecto), no solo lo que la fuente `.uxdsl` de entrada referencia.
> Esto rompió la suite propia del paquete (34/70 tests fallando) porque
> los fixtures de test usan temas mínimos, deliberadamente parciales, para
> aislar lo que cada test verifica. Se decidió (ver pregunta al usuario)
> completar los fixtures — no acotar el alcance de `enforceReferences` ni
> cambiar comportamiento de producto — agregando una escala completa de
> spacing (1-16) y las familias de palette (`primary`/`surface`/`neutral`/
> `error`) que los defaults siempre-activos necesitan, en cada archivo de
> test afectado (`buttons`, `edges`, `inputs`, `shadows`, `surfaces`,
> `typography`, `unified-engine`, `language`, `include-theme`). Suite
> recuperada a 103/103. Si en el futuro se decide acotar el alcance de la
> validación a lo que la fuente realmente usa, esos fixtures dejarían de
> necesitar la escala completa — pero ese es un cambio de diseño de MIG-03
> en sí, no algo que MIG-04/05/06 deba decidir.
>
> El mismo problema alcanzaba a `uxdsl-core` (paquete separado que envuelve
> `postcss-uxdsl`): su test de deduplicación de imports (`npm test`,
> `test/inline-imports.test.js`) compila sin tema alguno y terminaba
> abortando el proceso completo (excepción no capturada, no un fallo de
> test individual) por la misma cadena `--density-1 -> --space-1`. Ese test
> no verifica nada de estilos — es sobre resolución de `@import` — así que
> se le pasó `references: { mode: 'off' }` en vez de fabricarle un tema
> completo que no necesita. `uxdsl-core` vuelve a pasar.
>
> **Aclaración importante (no dar por resuelto MIG-03 en `uxdsl-core`):**
> este fix hace que el test de `@import` de `uxdsl-core` pase porque
> *desactiva* la validación referencial para ese caso puntual — verifica
> que los imports se resuelvan bien, no que las dependencias de los
> defaults por defecto (spacing 1-16, palette primary/surface/neutral/
> error) se resuelvan en modo estricto. `uxdsl-core` no tiene ningún test
> que compile en modo estricto contra un tema completo — ese hueco sigue
> abierto ahí, igual que en `postcss-uxdsl` antes de la sección "Nota de
> consecuencia" de arriba. Se revisó también `vite-plugin-uxdsl`: no tiene
> carpeta `test/` en este checkout (no hay nada que romper ahí todavía).
>
> Al correr `npm test` desde la raíz para confirmar esto se encontró un
> tercer problema, preexistente y no relacionado con MIG-01 a MIG-06:
> `packages/postcss-uxdsl/src/theme/theme-manifest.json` tenía
> `tokens.density.max: 15` desincronizado de `DEFAULT_DENSITIES` (16
> entradas, `0`..`15`), haciendo fallar
> `node scripts/generate-language-artifacts.js --check` (exit 1) — el
> último paso del `npm test` raíz. Corregido regenerando el artefacto
> (`node scripts/generate-language-artifacts.js`, sin `--check`); `npm
> test` en la raíz vuelve a pasar.

## MIG-04 — Borders con dependencias completas

Decidir y documentar cómo se suministran los colores que usan los presets. Propuesta: la entrada de tema incluye las dependencias de los presets por defecto activos, respetando los overrides del usuario; si el proyecto opta por un tema sin defaults, debe recibir un diagnóstico claro cuando falte una dependencia.

Implementado en este checkout (paquete identificado como 0.3.0): `edges.ts`
exporta `DEFAULT_BORDER_COLORS` (`gray.{300,400,500,600}`, la dependencia de
`DEFAULT_BORDERS`); `generateFoundationCss` (`foundations.ts`) lo mezcla bajo
`theme.colors.gray`, con los shades del usuario ganando por clave, antes de
emitir `--ds__color__*`. Un único punto de mezcla mantiene en paridad al
compilador PostCSS y a `generateThemeCss` (runtime), que ambos llaman a
`generateFoundationCss`. Sin cambiar versiones ni publicar. Cobertura en
`test/border-colors.test.js` (6 casos).

Criterios de aceptación:

- [x] `border(1..5)` funciona con el tema por defecto configurado sin un import CSS adicional no documentado — probado con `theme: {}`.
- [x] Un tema personalizado puede reemplazar los colores sin ser sobrescrito por defaults — probado por shade individual (`colors.gray.300` override conserva 400/500/600 por defecto) y a nivel de familia completa (un tema que redefine `borders[1..5]` para no usar `color(gray.*)` en absoluto sigue emitiendo el `gray` por defecto sin efecto, ya que nada lo referencia).
- [x] Las entradas de componente no reintroducen globals para resolver estos colores — con `includeTheme: false`, ni `--border-N` ni `--ds__color__gray-*` se emiten localmente; se validan contra la entrada de tema (mecanismo ya provisto por MIG-02/MIG-03).
- [x] Se prueban ambas modalidades: tema generado (el merge por defecto) y un preset de border suministrado enteramente por una hoja de estilos externa del consumidor, declarado vía `references.externalTokens` sin generar tema alguno.

Fuera de alcance de este parche: `DEFAULT_DENSITIES` (`space(1)`..`space(16)`)
no tiene una dependencia por-defecto equivalente — un tema que no defina la
escala completa de spacing sigue fallando la validación estricta al usar
density/radius/surface por defecto. Ese es el gap documentado al cierre de
MIG-03 (34/70 tests propios del paquete), no algo que MIG-04 prometiera
resolver; queda como trabajo relacionado a decidir (¿debería `space()` tener
también un `DEFAULT_SPACING` con overrides por clave, igual que `gray`?).

## MIG-05 — Tamaño y overrides independientes (parcial: falta autocompletado del editor)

Conservar size como preset útil, pero permitir ajustar radio y sombra sin reemplazar manualmente las propiedades que acaba de emitir el mixin.

**Gramática elegida e implementada en este checkout** (paquete identificado
como 0.3.0, sin cambiar versiones ni publicar): argumentos opcionales
`radius(<key>)` / `shadow(<key>)`, añadidos a la lista de argumentos ya
aceptada por `@ds-surface`, `@ds-button` y `@ds-input`:

```text
@ds-surface(contained 2 radius(4));
@ds-surface(contained primary 2 radius(pill) shadow(3));
@ds-button(outlined 2 radius(1));
@ds-input(contained 2 shadow(0));
```

`<key>` es exactamente el mismo tipo de clave que aceptan las funciones de
valor `radius()` / `shadow()` sueltas: un keyword (`pill`, `full`, `circle`)
o una clave numérica configurada en `theme.radii` / `theme.shadows`. No se
introduce sintaxis responsive nueva: como el token referenciado ya puede ser
responsive en el tema (`radii: { 4: 'xs(space(4)) lg(space(6))' }`), el
override hereda esa capacidad sin necesidad de expresarla en el argumento.

Precedencia (de menor a mayor prioridad):

1. Defaults del rol/tono del preset (bg, color, border, etc.).
2. `size`, si está presente, fija padding y radius juntos (comportamiento
   legado, sin cambios).
3. Un `radius(...)`/`shadow(...)` explícito reemplaza solo esa propiedad,
   de forma independiente entre sí y de `size`; `size` puede omitirse por
   completo si solo se necesita el override.
4. Una declaración CSS plana posterior en la misma regla sigue ganando al
   final, igual que cualquier otra propiedad generada (sin cambios).

Implementación: `parseOverrideArguments` (nuevo, en `surfaces.ts`) extrae
`radius(...)`/`shadow(...)` de la lista de argumentos antes de que corra la
detección existente de role/tone/size, compartido por `parseSurfaceArguments`
y por `parseArguments` (control-engine.ts, usado por button e input).
`surfaceDeclarations` aplica el override después de `size`, reutilizando
`RADIUS_KEYWORDS`/`getEdgeTokens`/`getShadowTokens` — el mismo camino de
validación que usan `radius()`/`shadow()` sueltos, así que un `radius(99)`
indefinido lanza `UXD_SURFACE_REFERENCE`, igual que fuera del mixin.
Cobertura en `test/size-overrides.test.js` (10 casos).

> **Corrección (auditoría):** la precedencia declarada arriba no se cumplía
> para button/input cuando el rol define sus propios campos `radius`/`shadow`
> en `base`. `declarations()` (`control-engine.ts`) componía
> `{ ...surfaceDeclarations(...override incluido...), ...refs('base', pack.base) }`
> — el spread de `pack.base` iba último y volvía a pisar el override con el
> valor del rol. Reproducido con
> `@ds-button(custom 2 radius(4) shadow(0))` sobre un rol `custom` con
> `base: { radius: ..., shadow: ... }`: el override se ignoraba
> silenciosamente. Corregido reasignando `border-radius`/`box-shadow` desde
> el resultado ya validado de `surfaceDeclarations` después del spread de
> `pack.base`, sin duplicar la lógica de validación. Test de regresión
> agregado en `test/size-overrides.test.js`.

Criterios de aceptación:

- [x] Reproducir los nueve casos del reporte con padding y radio independientes — cubierto a nivel de contrato (`@ds-surface(role size radius(key))` dejando padding intacto); no se reprodujeron los nueve usos exactos del reporte original porque el reporte no incluyó ese código fuente.
- [x] Elegir una gramática y documentar la precedencia entre preset, argumento explícito y declaración CSS posterior — ver arriba.
- [x] Definir tratamiento de argumentos repetidos, incompatibles y responsive — repetidos lanzan `UXD_SURFACE_ARGUMENT`/`UXD_BUTTON_ARGUMENT`/`UXD_INPUT_ARGUMENT` explícito; claves indefinidas lanzan `UXD_SURFACE_REFERENCE`; responsive se hereda del token referenciado, sin gramática nueva.
- [x] Mantener coherencia entre surface, button e input cuando el concepto aplique — mismo parser y misma composición para los tres, probado explícitamente para button e input.
- [ ] Compartir parsing, diagnósticos, ejemplos y sugerencias del editor con el motor unificado — parsing, diagnósticos y ejemplos sí: reutiliza `RADIUS_KEYWORDS`, `getEdgeTokens`, `getShadowTokens` y los mismos códigos de error que las funciones de valor sueltas. **Pendiente:** sugerencias del editor (VS Code) — el registro de lenguaje (`LANGUAGE_COMPLETIONS` en `language.ts`) no incluye todavía `radius()`/`shadow()` como argumentos de `@ds-surface`/`@ds-button`/`@ds-input`, así que el autocompletado del editor no ofrece la sintaxis nueva. MIG-05 no se da por cerrado hasta que esto se complete.

## MIG-06 — Migración documentada y asistida

Incluir en los paquetes publicados una referencia de gramática y un changelog con ejemplos 0.3.0 → 0.5.x. La documentación no debe depender únicamente de una web que puede describir otra versión.

Implementado en este checkout (paquete identificado como 0.3.0, sin cambiar
versiones ni publicar): guía de migración y changelog **dentro del
paquete** —
[`packages/postcss-uxdsl/docs/migration.md`](../../packages/postcss-uxdsl/docs/migration.md)
y
[`packages/postcss-uxdsl/CHANGELOG.md`](../../packages/postcss-uxdsl/CHANGELOG.md) —
para que viajen con el tarball publicado (`npm pack` los incluye; no hay
`files` en `package.json`, así que todo lo no ignorado por git se
publica). Codemod en
`packages/postcss-uxdsl/scripts/codemod-size-overrides.js`
(`npm run codemod:size-overrides` desde ese paquete, también incluido en
el tarball), con 14 tests en `test/codemod-size-overrides.test.js`.

> **Nota (auditoría, dos rondas):** la primera versión del codemod tenía
> dos bugs de cascada: (1) recogía cualquier declaración
> `border-radius`/`box-shadow` de la regla sin importar su posición,
> incluyendo una anterior al mixin — que ya es código muerto bajo la
> cascada normal, no el override vigente — y la trataba como si fuera la
> intencional; (2) descartaba `!important` silenciosamente al fundirlo en
> el argumento del mixin. Corregido: solo considera declaraciones
> posteriores a la llamada del mixin, y una declaración con `!important`
> se reporta como caso a revisar manualmente en vez de tocarse.
>
> Una segunda ronda de revisión encontró dos casos más, también de
> cascada, en esa misma corrección: (3) con dos llamadas `@ds-*`
> consecutivas en la misma regla, una declaración final se fundía en la
> **primera** en vez de la más cercana, dejando que la segunda llamada
> (con su propio `size`) volviera a ganar al final — el codemod ahora
> limita la búsqueda a antes de la siguiente llamada `@ds-*` en la misma
> regla; (4) una declaración de esquina (`border-top-left-radius` y
> equivalentes) entre el mixin y el `border-radius` candidato cambiaba de
> "sobrescrita por el shorthand posterior" a "última y ganadora" al
> eliminar ese shorthand — ahora se detecta y se reporta como caso a
> revisar manualmente. Los cuatro casos tienen test de regresión.
>
> Una tercera ronda encontró un quinto caso, de la misma familia que (4)
> pero más general: (5) una declaración `all` (`all: initial`/`unset`/
> `revert`) entre el mixin y la declaración candidata. `all` resetea
> *cualquier* propiedad, no solo las de una familia de shorthand
> específica — así que mover el radio/sombra al argumento del mixin (que
> se genera antes en la salida) hace que ese `all` posterior lo borre,
> cuando hoy la declaración manual corre después del `all` y sobrevive.
> Generalizada la detección de (4) para cubrir tanto las esquinas de
> `border-radius` como `all` para ambas propiedades (`border-radius` y
> `box-shadow`). Test de regresión agregado para ambos casos
> (`test/codemod-size-overrides.test.js`, ahora 16 casos).
>
> Una cuarta ronda encontró un sexto caso: (6) una regla o at-rule anidada
> (`@media`, `@supports`, `&:hover`, etc.) entre el mixin y la declaración
> candidata — por ejemplo `@media (min-width: 768px) { border-radius:
> radius(1); }` antes de un `border-radius: radius(4);` final. La posición
> relativa de la declaración final respecto al bloque anidado es
> justamente lo que hoy decide qué gana (a igual especificidad, la
> declaración posterior gana siempre, dentro o fuera del alcance del
> `@media`); fundirla eliminaría esa posición y podría dejar que el bloque
> anidado empiece a aplicar. En vez de intentar razonar sobre cascada
> dentro de bloques anidados caso por caso, cualquier `rule`/`atrule`
> intermedio ahora se trata como barrera dura y detiene el fold sin
> inspeccionar su contenido — tal como se sugirió en la revisión. Test de
> regresión agregado (`test/codemod-size-overrides.test.js`, ahora 17
> casos).
>
> Además, la primera versión de este documento apuntaba a
> `docs/migration/0.3-to-0.5-beta.md` en la raíz del monorepo — un
> directorio que nunca se publica a npm, incumpliendo el propio objetivo
> de MIG-06 ("incluir en los paquetes publicados"). Movido dentro del
> paquete; se agregó también el `CHANGELOG.md` que faltaba.

Criterios de aceptación:

- [x] Tabla de sintaxis anterior, equivalente nuevo, cambios de comportamiento y casos sin equivalencia exacta — ver la guía de migración.
- [x] Guía para cinco entradas, CSS Modules, `includeTheme` y dependencias de tokens — sección dedicada en la guía; nivel de verificación igual al de MIG-02 (compilación PostCSS, no build real de Next.js con paquetes empaquetados — eso es MIG-07).
- [x] Codemod con modo de previsualización y diff; ejecutarlo dos veces no produce cambios adicionales — por defecto solo previsualiza (imprime línea antes/después y qué se elimina); `--write` aplica. Idempotencia probada explícitamente.
- [x] Preservar comentarios, valores responsive y propiedades existentes — probado; el codemod nunca reescribe una expresión responsive (`xs(radius(2)) md(radius(3))`) ni una que no sea una llamada `radius()`/`shadow()` pura, las reporta como `SKIPPED` en cambio.
- [x] Señalar casos ambiguos para revisión manual; no inventar un único size que pierda el radio original — múltiples declaraciones candidatas, valores no-función, y `!important` se reportan como `SKIPPED`, nunca se adivina.
- [x] Los ejemplos compilan con los paquetes de la versión documentada — verificado contra `test/spacing-normalization.test.js`, `test/include-theme.test.js`, `test/border-colors.test.js`, `test/size-overrides.test.js` y `test/codemod-size-overrides.test.js` de este mismo checkout (0.3.0, sin publicar); no se verificó contra un artefacto `0.5.0-beta.x` real porque no existe todavía (eso es MIG-07).

## MIG-07 — Validación desde artefactos publicados

Crear una fixture de consumidor que instale tarballs producidos por `npm pack`, sin depender de imports al código fuente del monorepo. Usar una entrada de tema y cuatro entradas CSS Module con las familias del reporte.

Implementado en este checkout (paquete identificado como 0.3.0, sin cambiar
versiones ni publicar):
[`fixtures/mig07-consumer/`](../../fixtures/mig07-consumer/) — `npm run
verify:consumer-fixture` desde la raíz (o `node run.js` parado ahí). Cada
corrida: empaqueta `postcss-uxdsl` con `npm pack`, borra cualquier
instalación previa e instala el tarball recién producido en su propio
`node_modules` (nunca el código fuente del monorepo), compila una entrada
de tema (`includeTheme: true`) más cuatro paneles estilo CSS Module
(`includeTheme: false`) cubriendo `@ds-surface`/`@ds-button`/`@ds-input`/
`@ds-typo`/`border()`/`radius()`, y corre las verificaciones automatizadas
descritas abajo. Ver el `README.md` de la fixture para el detalle completo
de qué prueba y qué no.

**Hallazgo real durante la implementación:** el `package.json` publicado no
incluía `"./package.json"` en `exports`, así que cualquier consumidor
externo (herramientas que hacen `require('postcss-uxdsl/package.json')`
para leer la versión, patrón común) recibía `ERR_PACKAGE_PATH_NOT_EXPORTED`
— un error que la importación directa desde el monorepo nunca hubiera
revelado, porque ahí nada pasa por la resolución de `exports` de Node.
Corregido agregando esa entrada al mapa de `exports`.

Criterios de aceptación:

- [x] Instalación y build correctos con versiones coordinadas de los paquetes UXDSL utilizados — verificado para `postcss-uxdsl`. `uxdsl-core`/`uxdsl-cli`/`vite-plugin-uxdsl` no se empaquetaron ni instalaron en esta fixture (ver alcance abajo).
- [x] Cero referencias UXDSL obligatorias sin resolver y cero globals generados en los módulos — las cinco entradas compilan sin lanzar (MIG-03 corre en modo estricto por defecto) y los cuatro paneles no contienen la cadena `:root`.
- [ ] Verificación visual y de estilos computados para padding, radio y border, en varios breakpoints — **parcial**. No hay navegador headless disponible en este entorno (mismo bloqueo que ya registró FEAT-001 con la descarga de Chromium). Sustituido por el mismo método sin-navegador que ya usa el resto de la suite: las funciones `inspectSurfaceTheme`/`inspectEdgeTheme` del paquete instalado, en un par de anchos. Esto no es "verificación visual" real; queda documentado como pendiente, no como resuelto.
- [x] Paridad PostCSS/runtime y salida determinista en compilaciones repetidas — la entrada de tema compilada por PostCSS y `generateThemeCss` (del paquete instalado) coinciden en el valor que efectivamente gana la cascada para cada declaración, no solo en el conjunto de declaraciones; compilar dos veces produce CSS idéntico byte a byte.

  > **Corrección (auditoría):** la comparación anterior (`variableSet`) juntaba
  > cada declaración `--` en una lista plana y la ordenaba con `.sort()` antes
  > de comparar. Eso pierde dos cosas que sí cambian el resultado real en un
  > navegador: (1) el orden dentro de un mismo scope — `:root { --x: 1px;
  > --x: 2px; }` y las mismas dos declaraciones invertidas producen el mismo
  > array ordenado, aunque la cascada real aplica la última (2px vs 1px) — y
  > el `.sort()` también descartaba `!important` sin más; (2) el orden
  > *entre* bloques `@media (min-width: …)` que se solapan: invertir dos
  > bloques `min-width: 600px` y `min-width: 800px` cambia qué valor gana
  > desde 800px en adelante (gana el que aparece más tarde en la hoja de
  > estilos, no el de umbral más alto), pero cada `@media` se trataba como un
  > scope independiente, así que invertir el orden no cambiaba nada que la
  > comparación mirara. Corregido con `cascadedVariables`
  > (`fixtures/mig07-consumer/lib/css-cascade-compare.js`): para cada par
  > (scope, propiedad) calcula, en cada umbral de ancho relevante, qué
  > declaración gana realmente (importancia y luego orden de aparición,
  > igual que `reference-integrity.ts`'s `resolve()`), y compara esos
  > valores ya resueltos en vez de las declaraciones crudas. Cobertura de
  > regresión en `fixtures/mig07-consumer/test/cascade-compare.test.js` (6
  > casos, incluida la inversión de bloques reportada), que `run.js` corre
  > automáticamente al inicio de cada verificación — si esta comparación
  > alguna vez deja de detectar el caso, la fixture falla ahí antes de
  > confiar en su veredicto para la paridad real. Fuera de alcance,
  > documentado en el propio archivo: una condición de `@media` que no sea
  > `min-width` (p. ej. `prefers-color-scheme`) se trata como un scope propio,
  > no como un umbral de ancho — no modela dos condiciones de ese tipo
  > compitiendo entre sí de una forma que hoy no reconoce.
- [x] La fixture migrada funciona sin los workarounds para prefijos y eliminación de globals — ningún panel declara `:root` propio ni necesita normalizar prefijos de spacing a mano (MIG-01/MIG-02 ya resuelven eso).
- [x] El artefacto incluye documentación, exports y dependencias necesarios para un consumidor externo — verificado que el tarball instalado contiene `README.md`, `CHANGELOG.md` y `docs/migration.md`, y que `package.json` declara `main`/`types`/`exports` resolubles (el hallazgo de `exports` de arriba salió de este mismo chequeo).

**Fuera de alcance de este parche, documentado explícitamente:** instalación
coordinada de los otros paquetes UXDSL (`uxdsl-core`, `uxdsl-cli`,
`vite-plugin-uxdsl`); verificación con navegador real. Ambos quedan como
trabajo futuro si se decide cerrar esta fixture con mayor fidelidad. El
build real de CSS Modules (`css-loader` en modo estricto) sí está cubierto
— pero en una fixture separada,
[`fixtures/mig02-nextjs-cssmodules/`](../../fixtures/mig02-nextjs-cssmodules/)
(ver MIG-02), que compila los paneles contra el código fuente del monorepo,
no contra este tarball empaquetado. Ninguna de las dos fixtures verifica
todavía instalar desde el tarball *y* pasar por ese build de Next.js a la
vez.

## MIG-08 — Nombres consistentes sin ruptura silenciosa

Inventariar nombres como `--ds__palette__primary-main`, `--ds__color__gray-300`, `--space-1`, `--density-1` y `--surface-flat-padding`. Centralizar su construcción y migrarlos a un namespace común `--uxdsl__` que permita identificar las variables de UXDSL durante el debugging.

Implementado en este checkout (paquete identificado como 0.3.0, sin cambiar
versiones ni publicar): `src/naming.ts` exporta `buildVarName`
(`--uxdsl__<family>__<key>`, usado por density, spacing, edges, shadows,
surfaces, buttons, inputs, typography y font), `buildNamespacedVarName`
(el mismo contrato, usado por palette y color — hoy delega en
`buildVarName`, se mantiene como nombre separado porque "namespace" lee
mejor que "family" en esos call sites) y `NameRegistry` — una clase
pequeña que recuerda qué identificador lógico (`"surface.
contained.shadow"`, `"palette.primary-main"`) reclamó cada nombre generado
dentro de una compilación, y lanza un diagnóstico claro
(`UXD_*_NAME_COLLISION`) si un identificador *distinto* reclama el mismo
nombre, en vez de que uno pise al otro en silencio.

Conectado en todos los puntos que construían un nombre a mano:

- `preset-engine.ts`'s `compilePresetRules` — el punto ya compartido por
  `edges.ts`, `shadows.ts`, `surfaces.ts` y (vía `control-engine.ts`)
  `buttons.ts`/`inputs.ts`. Antes: `rules[i].values[`--${family}-${key}`]
  = value` sobrescribía en silencio si dos pares `(family, key)`
  distintos concatenaban al mismo string. El separador `__` entre familia
  y clave ya cierra la mayoría de esos casos por construcción (familia
  `"x"` clave `"a-b"` y familia `"x-a"` clave `"b"` ahora producen
  `--uxdsl__x__a-b` y `--uxdsl__x-a__b`, distintos); lo que sigue siendo
  alcanzable — y sigue cubierto por `NameRegistry` — es una clave que
  contiene literalmente `__` y aterriza justo sobre el separador (familia
  `"x"` clave `"y__z"` vs. familia `"x__y"` clave `"z"`, ambos
  `--uxdsl__x__y__z`; las claves de preset admiten `_` vía
  `/^[\w-]+$/`).
- `control-engine.ts`'s `compileRules` (buttons/inputs) — reestructurado
  para que `surface-${role}`/`button-${role}-${state}` dejen de ser la
  "familia": ahora hay una única familia (`button`/`input`) con clave
  compuesta `${role}-${state}-${key}` (o `${role}-tone-${tone}-${state}-
  ${key}`), reclamada contra un `NameRegistry` propio *antes* de
  ensamblar el objeto que recibe `compilePresetRules` — de otro modo dos
  triples `(role, state, key)` que concatenan al mismo string chocarían
  como propiedad de objeto plano, invisible para el registro compartido
  que solo ve el resultado ya ensamblado.
- `surfaces.ts` — mismo cambio de forma: familia única `surface`, clave
  `${role}-${field}` (antes familia `surface-${role}`, clave `field`).
- `typography.ts`'s `compileTypographyRules` — familia única
  `typography`, clave `${role}-${field}` (antes el `role` mismo era la
  familia).
- `foundations.ts`'s `generateFoundationCss` — sin cambios de forma
  (palette/color ya usaban `buildNamespacedVarName`); un `theme.palette`
  con la clave plana `"primary-main"` junto con la estructurada
  `primary: { main }` ya emitía `--uxdsl__palette__primary-main` dos
  veces con valores distintos, sin ningún aviso (CSS solo aplica el
  último). El modo oscuro usa su propio `NameRegistry` porque es un scope
  distinto (`@media`/`[data-theme]`) donde redefinir el mismo nombre es
  la intención, no una colisión.
- `language.ts` (`--uxdsl__space__*`, `--uxdsl__density__*`),
  `ds-runtime/index.ts`'s `updateSpacing`/`getSpacing`/`resetSpacing`
  (los únicos puntos del runtime que construían `--space-*` a mano) y
  `index.ts`'s consumidores — `@ds-typo` (antes construía
  `--${tag}-font-family` etc. directamente) y `rewriteFuncs`'s
  `density()`/`radius()`/`rounded()`/`shadow()`/`elevation()`/`border()`
  (antes `` `var(--radius-${key})` `` etc.) — ahora llaman a
  `buildVarName` en vez de interpolar el prefijo a mano, así que
  definición y referencia no pueden divergir.

Cobertura en `test/naming.test.js` (8 casos), más las suites existentes de
cada familia actualizadas a la forma `--uxdsl__<familia>__<clave>`. Los
116 tests del paquete pasan contra la forma final.

**Decisión de renombre (tomada el 2026-09-15, implementada el mismo
checkout):** todas las familias usan `--uxdsl__<familia>__<identificador>`
como contrato común. El prefijo `uxdsl__` reemplaza `ds__` (antes solo en
palette/color) y también se aplica a las familias que antes no llevaban
namespace, para facilitar su identificación en DevTools, CSS generado y
diagnósticos.

| Nombre anterior | Nombre actual |
| --- | --- |
| `--ds__palette__primary-main` | `--uxdsl__palette__primary-main` |
| `--ds__color__gray-300` | `--uxdsl__color__gray-300` |
| `--space-1` | `--uxdsl__space__1` |
| `--density-1` | `--uxdsl__density__1` |
| `--radius-2` | `--uxdsl__radius__2` |
| `--border-1` | `--uxdsl__border__1` |
| `--shadow-2` | `--uxdsl__shadow__2` |
| `--surface-flat-padding` | `--uxdsl__surface__flat-padding` |
| `--button-contained-hover-bg` | `--uxdsl__button__contained-hover-bg` |
| `--input-outlined-focus-border` | `--uxdsl__input__outlined-focus-border` |
| `--h1-size` | `--uxdsl__typography__h1-size` |
| `--font-ui` | `--uxdsl__font__ui` |

La sintaxis del DSL (`palette()`, `space()`, `@ds-surface`, etc.) y las
claves lógicas del tema no cambian por esta decisión — solo el nombre de
la variable CSS generada. La única excepción deliberada es un
`theme.typography` plano (no `theme.typography_details`): su clave JSON
se sigue emitiendo tal cual (`{ typography: { "h1-size": "2rem" } }` sigue
generando `--h1-size: 2rem;`), porque ese nombre lo elige el consumidor,
no este compilador.

El runtime ya no genera aliases de Palette fuera de `uxdsl__`: `updatePalette`,
`getPalette` y `resetPalette` usan únicamente el nombre canónico. Los nombres
anteriores se conservan aquí solo como referencias históricas de migración; no
se debe inferir la ausencia de consumidores a partir de que este checkout local
no tenga un release publicado. Antes de una versión estable falta decidir y
probar la estrategia de compatibilidad para consumidores que ya hayan usado
variables antiguas (aliases temporales o una migración explícita).

Verificado además en `packages/playground-nextjs` (el consumidor real del
monorepo): build de producción completo, `scripts/test-theme-inheritance.cjs`,
y una revisión exhaustiva de referencias hardcodeadas a nombres de
variables (incluyendo interpolación SCSS `#{$tag}` dentro de `var(--...)`,
que un `grep` ingenuo con límites de palabra no detecta) — sin residuos de
la forma anterior fuera del escape hatch de `theme.typography` plano
documentado arriba. También verificado en `fixtures/mig07-consumer/`
(MIG-07): el fixture instala el tarball real y sus propias comprobaciones
de "valor computado aproximado" fueron actualizadas a los nombres nuevos.

Criterios de aceptación:

- [x] Un único contrato construye nombres y referencias para todas las familias con `--uxdsl__<familia>__<identificador>`; completada la integración de `naming.ts` en `preset-engine.ts`, `control-engine.ts`, `surfaces.ts`, `typography.ts`, `language.ts`, `ds-runtime/index.ts` e `index.ts`, y eliminadas las construcciones paralelas (`` `--${family}-${key}` ``, `` `--${tag}-size` ``, etc.).
- [x] Separar el identificador lógico del prefijo CSS; detectar colisiones — `NameRegistry`; colisiones reales encontradas y bloqueadas (`compilePresetRules`, `generateFoundationCss`, y el registro defensivo agregado en `control-engine.ts`'s `compileRules` para el ensamblado de claves compuestas antes de llegar al registro compartido).
- [x] Decidir si es necesario renombrar variables públicas y cuándo — se eligió el namespace `uxdsl__` para todas las familias y se implementó en este checkout; la compatibilidad con consumidores de nombres anteriores sigue pendiente.
- [ ] Aliases o migración explícita, plazo de deprecación si corresponde, y pruebas de referencias y overrides del usuario. La guía, el changelog y el codemod documentan la forma final, y el runtime ya no genera aliases de Palette; falta decidir la compatibilidad para consumidores de nombres antiguos.
- [ ] Verificar el namespace nuevo y la estrategia de compatibilidad en PostCSS, runtime y la fixture empaquetada de MIG-07, sin renombrar variables externas del consumidor — el namespace canónico está verificado y ningún nombre elegido por el consumidor (temas JSON, `theme.typography` plano, `externalTokens`) fue tocado; falta verificar la estrategia para nombres anteriores.

## Orden recomendado y salida de beta

1. Reproducir los dos bloqueantes con fixtures pequeñas y capturar el escenario multi-entrada.
2. Resolver MIG-01 y MIG-02; desarrollar MIG-03 con los casos de spacing y borders, y cerrar MIG-04.
3. Acordar la gramática de MIG-05 antes de congelar el codemod de MIG-06.
4. Cerrar MIG-07 desde los paquetes empaquetados y publicar las notas de migración junto a la siguiente beta.
5. Completar MIG-08 con el namespace `uxdsl__`, coordinando el contrato compartido con FEAT-001, la migración documentada con MIG-06 y la verificación desde paquetes con MIG-07.

La salida de beta requiere P0 reproducidos y corregidos, decisiones P1 documentadas y la fixture de consumidor pasando. Una tarea pendiente no se considera resuelta por existir un workaround en la aplicación.

## Fuera de alcance

Este documento no implementa cambios, modifica dependencias ni publica paquetes. Tampoco propone rediseñar la aplicación consumidora, relajar toda la validación ni eliminar el modelo responsive. La aprobación editorial y la procedencia de imágenes de Story Radar pertenecen a ese producto, no a UXDSL.
