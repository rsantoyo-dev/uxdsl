# FEAT-002 — Mejoras de confiabilidad y migración de UXDSL 0.5

| Campo | Valor |
| --- | --- |
| Estado | Propuesta; hallazgos pendientes de reproducción en este repositorio |
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

## MIG-04 — Borders con dependencias completas

Decidir y documentar cómo se suministran los colores que usan los presets. Propuesta: la entrada de tema incluye las dependencias de los presets por defecto activos, respetando los overrides del usuario; si el proyecto opta por un tema sin defaults, debe recibir un diagnóstico claro cuando falte una dependencia.

Criterios de aceptación:

- [ ] `border(1..5)` funciona con el tema por defecto configurado sin un import CSS adicional no documentado.
- [ ] Un tema personalizado puede reemplazar los colores sin ser sobrescrito por defaults.
- [ ] Las entradas de componente no reintroducen globals para resolver estos colores.
- [ ] Se prueban ambas modalidades: tema generado y colores suministrados mediante import explícito.

## MIG-05 — Tamaño y overrides independientes

Conservar size como preset útil, pero permitir ajustar radio y sombra sin reemplazar manualmente las propiedades que acaba de emitir el mixin.

Opciones por evaluar: argumentos opcionales `radius(...)`/`shadow(...)`, tamaños compuestos o recetas configurables. Esta propuesta no declara ninguna sintaxis nueva como soportada.

Criterios de aceptación:

- [ ] Reproducir los nueve casos del reporte con padding y radio independientes.
- [ ] Elegir una gramática y documentar la precedencia entre preset, argumento explícito y declaración CSS posterior.
- [ ] Definir tratamiento de argumentos repetidos, incompatibles y responsive.
- [ ] Mantener coherencia entre surface, button e input cuando el concepto aplique.
- [ ] Compartir parsing, diagnósticos, ejemplos y sugerencias del editor con el motor unificado.

## MIG-06 — Migración documentada y asistida

Incluir en los paquetes publicados una referencia de gramática y un changelog con ejemplos 0.3.0 → 0.5.x. La documentación no debe depender únicamente de una web que puede describir otra versión.

Criterios de aceptación:

- [ ] Tabla de sintaxis anterior, equivalente nuevo, cambios de comportamiento y casos sin equivalencia exacta.
- [ ] Guía para cinco entradas, CSS Modules, `includeTheme` y dependencias de tokens.
- [ ] Codemod con modo de previsualización y diff; ejecutarlo dos veces no produce cambios adicionales.
- [ ] Preservar comentarios, valores responsive y propiedades existentes.
- [ ] Señalar casos ambiguos para revisión manual; no inventar un único size que pierda el radio original.
- [ ] Los ejemplos compilan con los paquetes de la versión documentada.

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
