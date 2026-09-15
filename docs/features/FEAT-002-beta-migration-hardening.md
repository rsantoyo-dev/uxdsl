# FEAT-002 — Mejoras de confiabilidad y migración de UXDSL 0.5

| Campo | Valor |
| --- | --- |
| Estado | MIG-01 a MIG-06 implementados y auditados en este checkout (0.3.0, sin publicar); suite de `postcss-uxdsl` en 103/103. MIG-07 y MIG-08 pendientes |
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

- [x] `"1"` y `"space-1"`, en configuraciones separadas, producen `--space-1` y referencias compatibles.
- [x] Si ambas keys aparecen en una configuración, se detecta la colisión; nunca gana una por orden accidental.
- [x] No se eliminan prefijos de identificadores arbitrarios sin una regla documentada.
- [x] Density y radius conservan sus referencias y resuelven con el spacing configurado (comprobado en el CSS emitido; validación de navegador en MIG-07).
- [x] Hay cobertura con configuraciones legacy, nuevas y escalas personalizadas.

## MIG-02 — Tema único y entradas CSS Module

Usar `includeTheme` para expresar quién emite las definiciones globales. Una entrada de componente puede consumir tokens definidos por la entrada de tema sin volver a declararlos globalmente.

Implementado en este checkout (paquete identificado como 0.3.0): opción
`includeTheme` en el plugin PostCSS de `postcss-uxdsl`, sin cambiar versiones
ni publicar. Lo verificado aquí es a nivel de compilación PostCSS con pruebas
de contrato (`test/include-theme.test.js`); la fixture de consumidor con
Next.js y CSS Modules real (instalando tarballs empaquetados) sigue
pendiente de MIG-07.

Criterios de aceptación:

- [x] Con `includeTheme: false`, los emisores de foundations, shadows, edges, surfaces, buttons e inputs no añaden `:root` globales. Density y typography comparten el mismo defecto (también emitían `:root` sin condición) y quedan cubiertos por la misma bandera, aunque el hallazgo original no los nombró explícitamente.
- [x] Con `includeTheme: true` (valor por defecto), el tema emite todas las definiciones necesarias sin duplicados evitables — comportamiento idéntico al existente antes de este cambio; los tests de regresión de `unified-engine`, `surfaces`, `buttons`, `inputs`, `shadows`, `edges` y `typography` siguen pasando sin modificarse.
- [ ] La fixture de cinco entradas compila en Next.js con CSS Modules sin el plugin que elimina `:root`. Pendiente: requiere la fixture de consumidor de MIG-07 (instalación desde tarballs, build real de Next.js con `css-loader` en modo estricto). Lo probado en este checkout es el equivalente a nivel de PostCSS: una entrada compilada con `includeTheme:false` no contiene la cadena `:root` en su salida.
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
> completo que no necesita. `uxdsl-core` vuelve a pasar. Se revisó también
> `vite-plugin-uxdsl`: no tiene carpeta `test/` en este checkout (no hay
> nada que romper ahí todavía).
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

## MIG-05 — Tamaño y overrides independientes

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
- [x] Compartir parsing, diagnósticos, ejemplos y sugerencias del editor con el motor unificado — reutiliza `RADIUS_KEYWORDS`, `getEdgeTokens`, `getShadowTokens` y los mismos códigos de error que las funciones de valor sueltas. Sugerencias del editor (VS Code) no actualizadas en este parche — el registro de lenguaje (`LANGUAGE_COMPLETIONS` en `language.ts`) no incluye todavía `radius()`/`shadow()` como argumentos de `@ds-surface`/`@ds-button`/`@ds-input`; queda pendiente.

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

Criterios de aceptación:

- [ ] Instalación y build correctos con versiones coordinadas de los paquetes UXDSL utilizados.
- [ ] Cero referencias UXDSL obligatorias sin resolver y cero globals generados en los módulos.
- [ ] Verificación visual y de estilos computados para padding, radio y border, en varios breakpoints.
- [ ] Paridad PostCSS/runtime y salida determinista en compilaciones repetidas.
- [ ] La fixture migrada funciona sin los workarounds para prefijos y eliminación de globals.
- [ ] El artefacto incluye documentación, exports y dependencias necesarios para un consumidor externo.

## MIG-08 — Nombres consistentes sin ruptura silenciosa

Inventariar nombres como `--ds__palette__primary-main`, `--ds__color__gray-300`, `--space-1`, `--density-1` y `--surface-flat-padding`. Centralizar su construcción aunque inicialmente se conserven las formas públicas actuales.

Criterios de aceptación:

- [ ] Un único contrato construye nombres y referencias para todas las familias.
- [ ] Separar el identificador lógico del prefijo CSS; detectar colisiones.
- [ ] Decidir si es necesario renombrar variables públicas y cuándo, con evidencia de consumidores.
- [ ] Si hay renombres, incluir aliases o una migración explícita, plazo de deprecación y pruebas de overrides del usuario.

## Orden recomendado y salida de beta

1. Reproducir los dos bloqueantes con fixtures pequeñas y capturar el escenario multi-entrada.
2. Resolver MIG-01 y MIG-02; desarrollar MIG-03 con los casos de spacing y borders, y cerrar MIG-04.
3. Acordar la gramática de MIG-05 antes de congelar el codemod de MIG-06.
4. Cerrar MIG-07 desde los paquetes empaquetados y publicar las notas de migración junto a la siguiente beta.
5. Centralizar naming como parte de FEAT-001; posponer renombres públicos si no son necesarios para corregir los fallos.

La salida de beta requiere P0 reproducidos y corregidos, decisiones P1 documentadas y la fixture de consumidor pasando. Una tarea pendiente no se considera resuelta por existir un workaround en la aplicación.

## Fuera de alcance

Este documento no implementa cambios, modifica dependencias ni publica paquetes. Tampoco propone rediseñar la aplicación consumidora, relajar toda la validación ni eliminar el modelo responsive. La aprobación editorial y la procedencia de imágenes de Story Radar pertenecen a ese producto, no a UXDSL.
