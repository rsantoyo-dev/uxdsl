# MIG-B6-30 — applyTheme(json): un modelo de tema en build y runtime

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | B — Tema base y salida correcta |
| Prioridad · Tamaño | P1 · L |
| Cierra | D-4, aplicación validada del JSON y compatibilidad runtime |
| Depende de | MIG-B6-29 (base y fuentes compartidas), MIG-B6-17 (estructura tipográfica final), MIG-B6-27 (tipos públicos) |
| Bloquea | MIG-B6-12 |
| Archivos | `packages/postcss-uxdsl/src/ds-runtime/index.ts`, `src/ds-runtime.ts`, `src/ds-runtime/theme-generator.ts`, `src/control-engine.ts` (inspección compartida), `packages/playground-nextjs/src/components/ThemeContext.tsx`, `ThemeScript.tsx`, consumidores de setters, tests y fixture de navegador |

## Por qué y estado actual

D-4 mantiene un JSON de tema: base más override. Build es el camino habitual;
runtime sirve para editar valores y preferencias sin recompilar la aplicación.

Hoy no existe `applyTheme`. El playground genera CSS y sustituye
`uxdsl-ssr-theme`, valida antes de aplicar y gestiona fuentes con un enlace
separado. Los setters públicos tienen semántica adicional: scope por elemento,
links entre tokens, eventos y ajuste de media queries. No basta con renombrarlos.

~~~bash
npm --prefix packages/postcss-uxdsl run build
node -e "const r = require('./packages/postcss-uxdsl/dist/ds-runtime'); console.log('applyTheme' in r)"
~~~

Baseline: `false`. La auditoría de 2026-09-19 también verificó que agregar
`buttons.contained.states.focusvisible.outline` sólo crea el selector
correspondiente al regenerar CSS del componente, no al cambiar variables.

## Contrato de la API nueva

~~~ts
type ThemeResult =
  | { ok: true; override: UxdslThemeOverride; warnings: string[] }
  | { ok: false; error: Error };

applyTheme(patch: UxdslThemeOverride, opts?: {
  replace?: boolean;
  styleId?: string;           // default: 'uxdsl-theme'
  persist?: boolean | string; // default false; true usa 'uxdsl:theme'
}): ThemeResult;

getAppliedTheme(): UxdslThemeOverride;
resetTheme(opts?: { clearPersist?: boolean }): ThemeResult;
loadPersistedTheme(opts?: { key?: string }): ThemeResult;
subscribeTheme(listener: (override: UxdslThemeOverride) => void): () => void;
~~~

- `applyTheme` es **síncrono**: valida y genera antes de tocar DOM/estado. Al
  devolver éxito, CSS y estado aplicado ya coinciden. No usa rAF internamente.
- Primera llamada: la app pasa el override completo usado en build/SSR, con
  `replace: true` y el mismo styleId. Esa llamada establece el tema inicial y la
  estructura compatible con el CSS de componentes. En zero-config se pasa `{}`.
  Leer CSS de una etiqueta no permite reconstruir el JSON del proyecto.
- Llamadas siguientes: default mezcla sobre el override aplicado; `replace: true`
  parte del JSON base. `resetTheme` restaura el override inicial del proyecto.
  Reemplazar por `{}` restaura la base sólo si su estructura es compatible.
- Una instancia por documento y una etiqueta administrada en beta.6. Cambiar
  styleId tras inicializar da error; no se crean dos estilos globales que compitan.
  Estado/overrides devueltos son copias defensivas.
- Antes de inicializar, getAppliedTheme devuelve `{}`; load/reset dan error de
  inicialización. Cada llamada persist afecta sólo a esa operación, no activa
  persistencia implícita para todas las siguientes. reset sólo borra la clave
  administrada cuando clearPersist es true.
- Sin document, apply/load/reset devuelven error de entorno y no modifican estado
  compartido. SSR usa exclusivamente el generador puro por petición.
- Un fallo de validación, estructura o generación conserva CSS, override,
  persistencia y suscripciones sin notificar éxito.
- Persistencia es posterior al commit visual. Un fallo de storage devuelve éxito
  visual con warning explícito; no finge que el JSON se guardó. Un listener que
  lance no impide notificar a los demás ni invalida un commit ya realizado.

## Alcance de la paridad y cambios estructurales

La paridad se garantiza para cambios de valores con la misma estructura compilada.
La primera llamada exige que la app entregue el tema utilizado para compilar; la
librería no puede deducir esa estructura inspeccionando todo el CSS del host.

Derivar una firma estructural del motor compartido, sin otro parser: roles,
campos emitidos (incluidos los heredados), estados/pseudo-elementos, selección de
Surface, dependencias de composición y mapa de breakpoints. Cuando cambia una
decisión que altera declaraciones de componentes, rechazar el parche con un error
accionable que indique recompilar y reinicializar. Es válido ser conservador,
pero enumerar y probar los rechazos; no rechazar un simple cambio de valor.

Casos obligatorios: agregar/quitar un campo tipográfico, introducir focusvisible,
cambiar Surface de un Button/Input y mover un umbral. Cambiar valores de tokens,
expresiones responsive sobre los mismos umbrales y colores de modo conserva la
estructura. Sustituir sólo variables no reescribe reglas ni media queries locales.

La documentación debe distinguir igualdad de variables, de estructura emitida y
de computed styles. Los setters legacy de breakpoints conservan su integración
anterior; no convierten applyTheme en un recompilador de componentes.

## Implementación

1. Implementar estado por documento y API; reexportar por el entry público
   `postcss-uxdsl/ds-runtime`. Usar resolveTheme y el generador compartido.
   La ruta browser no puede arrastrar el cargador Node de configuración.
2. Migrar ThemeContext: inicializar con el override activo del proyecto antes de
   aceptar parches o cargar persistencia. Reutilizar SSR sin etiquetas duplicadas.
   Al alternar temas, aplicar resultados antes de reflejar éxito en React.
   Validar que el id existente sea una etiqueta style administrada; no sobrescribir
   otro elemento. Inventariar estilos inline de los setters antiguos: retirar sólo
   los que el runtime posee al migrarlos para que no tapen el CSS nuevo; conservar
   estilos ajenos y probar la convivencia.
3. El editor agrupa parches por frame **fuera** de applyTheme. Usa deepMergeTheme,
   cancela pendientes al reset/cambio de tema/unmount y gestiona el resultado
   síncrono. Sin rAF aplica directamente. Medir generación y commit por separado.
4. Fuentes: usar el generador de URLs/CSS de MIG-B6-29. Al unificar su emisión,
   retirar el enlace administrado antiguo del playground, sin borrar recursos
   ajenos. `{ fonts: { google: [] } }` retira las peticiones administradas futuras;
   no promete descargar una fuente ya almacenada por el navegador.
5. Compatibilidad: inventariar exports y consumidores antes de cambiar setters.
   Setters globales representables delegan al JSON. Preservar firmas, getters,
   reset por token, links y el evento existente de `subscribe`
   (`{ type, detail }`). La API nueva usa subscribeTheme, sin cambiar ese evento.
   Scope por elemento y modificación de media queries quedan como adaptadores
   legacy explícitos, deprecados, con tests; no aplicar un scope local a :root.
   Documentar estas excepciones a la migración, sin afirmar que todo setter es un
   wrapper idéntico. No eliminar APIs en beta.6.
6. Migración de storage: con clave nueva válida, ésta gana y no se mezcla con
   claves antiguas. Si falta, convertir las cuatro claves antiguas con el
   normalizador kind-aware (no partir todos los guiones: los nombres son abiertos).
   Validar el candidato antes de aplicarlo. Borrar antiguas sólo tras escribir y
   verificar el JSON nuevo. JSON corrupto, storage bloqueado y escritura fallida
   conservan los datos previos y producen diagnóstico. Repetir la carga es idempotente.
   No silenciar un valor nuevo corrupto sustituyéndolo por otro tema.

## Pruebas

- `test/ds-runtime-apply-theme.test.js`: merge, replace, reset al proyecto,
  copias defensivas, estado sólo tras generación válida, error sin DOM, colisión de
  styleId, listeners/unsubscribe y listener que lanza.
- SSR de dos temas distintos en el mismo proceso: no comparten estado. Primera
  aplicación e hidratación con tema no default conservan propiedades no incluidas
  en el primer parche. Una sola etiqueta con el id esperado.
- Rechazo de cada cambio estructural descrito arriba; cambio de valor permitido.
  Error deja CSS y estado anteriores intactos.
- `test/ds-runtime-persistence.test.js`: claves viejas, precedencia de nueva,
  nombres con guiones, datos corruptos, storage que lanza en read/write/remove,
  migración repetida y fallo que nunca borra la única copia válida.
- Tests del scheduler del playground: 60 inputs producen una generación por frame;
  reset/unmount cancela la cola; parche inválido seguido de válido no deja estado
  rechazado; parches independientes se combinan sin perder campos.
- Tests existentes y nuevos de compatibilidad: scope local no altera un hermano,
  links, reset selectivo, lectura inmediata y forma/cantidad de eventos.
- Paridad desde tarball: mismo JSON para PostCSS y runtime; comparar variables,
  condiciones, orden y fuentes, no sólo un mapa plano de :root.
- Extender `fixtures/mig02-nextjs-cssmodules/browser.js` y su runner para
  cargar el runtime empaquetado: claro/oscuro automático y explícito, debajo/en/
  encima de umbrales, hover, teclado/focus-visible, invalid y placeholder. Verificar
  computed styles tras parches y después de rechazos. Interceptar fuentes con
  recurso local determinista; probar cambio de URL y lista vacía sin depender de Google.
  El stub de DOM prueba operaciones; el navegador prueba su efecto.

## Documentación

README del paquete: contrato síncrono, inicialización SSR, estructura compatible,
fonts, persistencia y compatibilidad legacy. Migration guide: setter → JSON y
excepciones scope/breakpoints, conservación de eventos, storage y rollback.
AGENTS.md: patrón público sólo cuando esté implementado, generador puro para SSR
y límites estructurales. Actualizar arquitectura y guías del playground afectadas.
CHANGELOG beta.6 y registro de evidencia en esta ficha según README de FEAT-008.

## Criterios de aceptación

- [x] API síncrona exportada; fallo no sustituye el último tema válido.
      → `applyTheme`/`getAppliedTheme`/`resetTheme`/`loadPersistedTheme`/
      `subscribeTheme` en `postcss-uxdsl/ds-runtime`; en `ok: false` no se
      mueven CSS, estado, persistencia ni suscriptores.
- [x] Hidratación mantiene el tema del proyecto y no duplica estilos/fuentes.
      → El runtime **adopta** la etiqueta con el id indicado en vez de crear
      otra (verificado en navegador: una sola `style#uxdsl-ssr-theme`), y el
      `<link>` de fuentes del playground se retiró en favor del `@import` que
      ya emite `generateThemeCss`.
- [x] Cambios estructurales fallan con instrucción de recompilación.
      → `UXD_THEME_STRUCTURE`, con cada cambio enumerado; 13 tests en
      `test/ds-runtime-theme-structure.test.js` más la comprobación en navegador.
- [x] Paridad de valores/estados/modos verificada desde tarball y navegador.
      → `fixtures/mig02-nextjs-cssmodules/browser-runtime.js`: 20
      comprobaciones sobre el runtime **empaquetado** (bundleado desde el
      tarball instalado), incluyendo hover, foco por teclado, placeholder,
      `:invalid`, modo oscuro explícito y por `prefers-color-scheme`, y 12
      fronteras de breakpoint.
- [x] Setters y sus excepciones legacy conservan comportamiento probado.
      → No se ha eliminado ni cambiado ningún setter; las tres excepciones que
      **no** son wrappers equivalentes (scope por elemento, mover umbrales en
      caliente, links entre tokens) están documentadas en la guía de migración.
- [x] Migración idempotente no pierde datos ante errores de storage.
      → 13 tests en `test/ds-runtime-persistence.test.js`, incluidos escritura
      bloqueada, escritura silenciosamente descartada, `removeItem` que falla,
      lectura que lanza, JSON corrupto y tres cargas seguidas.
- [x] Editor agrupa actualizaciones y cancela pendientes al cambiar de contexto.
      → `src/lib/theme-scheduler.js` con 8 tests; `switchTheme` cancela la cola
      y el editor JSON cancela su debounce al cambiar de tema.
- [x] Ficha, README, migration, arquitectura y AGENTS describen el contrato real.

## Verificación

~~~bash
npm --prefix packages/postcss-uxdsl test
npm run verify:consumer-fixture
npm --prefix packages/playground-nextjs run build
npm run verify:cssmodules-build
npm test
~~~

El runner de navegador requiere Chrome disponible por el mecanismo documentado
de la fixture; su ausencia es un bloqueo de esa evidencia, no un PASS.

## Entrega

`feat(FEAT-008): MIG-B6-30 - synchronous json theme application with tested runtime compatibility`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente** en
`feat/feat-008-beta6-plan`, en 4 fases. Integración a `main` pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `8d9ea5f` (2026-09-22, HEAD de la rama al iniciar). Entrega en 4 fases: `13ff49f` (API + puerta estructural), `ed529d7` (migración de las cuatro claves), `f7824ef` (playground), y `4e97969` (navegador y documentación). PR pendiente de abrir |
| Reproducción antes del cambio | El comando de la propia ficha sobre `8d9ea5f`: `node -e "const r = require('./packages/postcss-uxdsl/dist/ds-runtime'); console.log('applyTheme' in r)"` → `false`, igual que `getAppliedTheme`, `resetTheme`, `loadPersistedTheme` y `subscribeTheme`. El playground generaba CSS y sustituía `#uxdsl-ssr-theme` con su propia copia de «generar y cambiar la etiqueta», mantenía un `<link>` de Google Fonts aparte con un codificador propio más débil, y no cancelaba su debounce al cambiar de tema. 2026-09-22 |
| Criterio → regresión | API y commit único → `test/ds-runtime-apply-theme.test.js` (19 tests: adopción de la etiqueta SSR, merge/replace/reset, copias defensivas, parche inválido y referencia irresoluble sin mover nada, colisión de `styleId`, elemento que no es `<style>`, listeners con uno que lanza, dos documentos con estado separado, SSR puro, persistencia por llamada, fallo de storage como aviso sobre un éxito real). Puerta estructural → `test/ds-runtime-theme-structure.test.js` (13 tests: los cuatro rechazos obligatorios de la ficha, estados de Input, pérdida de tono, y el lado positivo — valores, modo oscuro, expresiones responsive sobre los mismos umbrales, tokens y breakpoints nuevos). Persistencia → `test/ds-runtime-persistence.test.js` (13 tests). Batching → `packages/playground-nextjs/scripts/test-theme-scheduler.cjs` (8 tests). Navegador → `fixtures/mig02-nextjs-cssmodules/browser-runtime.js` (20 comprobaciones), enganchado en `npm run verify:cssmodules-build` |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, Apple M1 Pro, Chrome via `playwright-core`: `npm --prefix packages/postcss-uxdsl test` (exit 0, **377 + 1**), `npm test` (exit 0, **668** líneas `ok`, antes 622), `npm --prefix packages/playground-nextjs run build` (35/35 páginas), `npm --prefix packages/playground-nextjs run lint` (limpio), `test:themes` (2), `test:scheduler` (8), `npm run verify:cssmodules-build` (exit 0, incluye las 20 comprobaciones de navegador), `npm run verify:consumer-fixture` y `verify:beta5` (exit 0) |
| Resultado después / control negativo | **Controles negativos ejecutados, no supuestos**: (1) el mismo procedimiento del navegador con un `styleId` distinto produce de verdad **dos** hojas (`{ssr:1, other:1}`), así que la comprobación «no aparece una segunda hoja» no es vacua; (2) un parche estructural en el navegador deja el `textContent` de la hoja byte a byte idéntico; (3) la suite de persistencia pasó a la primera, así que se aplicaron tres mutaciones —borrar las claves antiguas antes de verificar la escritura (2 fallos), dejar que una clave nueva corrupta caiga a las antiguas (2 fallos), y resolver el corte de familia por coincidencia más corta (1 fallo)— y las tres se detectan; (4) antes de tocar el playground se comprobó que **las doce** transiciones entre sus cuatro temas son cambios de valor puros, así que la puerta estructural no rompe el conmutador del sitio de documentación. **Hallazgo corregido de paso**: `validateAndNormalizeTheme` mutaba el tema recibido — su «copia» era `deepMergeTheme({}, input)`, que comparte todos los objetos anidados por referencia — lo que hacía que `validateAndNormalizeTheme(resolveTheme(x))` lanzara `Cannot assign to read only property 'ui'` contra la base congelada. Ahora copia de verdad (`cloneThemeValue`) y no toca su entrada |
| Cambios visuales o API / migración | API aditiva: cinco funciones nuevas, ningún setter eliminado ni cambiado. Cambio visual en el playground: ninguno intencionado — el CSS aplicado es el mismo que generaba antes; lo que cambia es quién lo aplica, que ahora se valida y se rechaza en vez de escribirse a ciegas, y que las propiedades inline `--uxdsl__*` dejadas por los setters antiguos se limpian para que no tapen el tema nuevo. Migración documentada en `docs/migration.md` con la tabla setter → JSON y las tres excepciones que **no** son wrappers equivalentes |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md`: nueva sección "Applying a theme at run time (`applyTheme`)" con la tabla de qué se rechaza y qué se aplica, y "Upgrading from the per-token setters". `packages/postcss-uxdsl/CHANGELOG.md`: entradas de fase 1 y fase 2. `packages/postcss-uxdsl/docs/migration.md`: sección "Tema en runtime: de los setters por token a `applyTheme`" |
| AGENTS / guías / arquitectura | `AGENTS.md`: reescrita la parte de runtime de "Build time, runtime and one source of truth" (contrato síncrono, inicialización, qué se rechaza y por qué, migración de storage, generador puro para SSR), y corregidas dos afirmaciones que quedaban obsoletas — que `applyTheme` estaba pendiente y que el `<link>` de fuentes del playground seguía sin retirar. `docs/architecture/unified-engine-audit.md`: límite explícito de que `applyTheme` aplica valores y no es un compilador, y que su firma estructural sale de los mismos emisores que usa el compilador |
| Límites y seguimiento | (1) **Sin navegador sobre la app del playground**: lo verificado en Chrome es el runtime empaquetado en un documento controlado —que es donde está la lógica— y la app se verifica con su build de producción y su lint, no abriendo sus 35 páginas. Revisión visual de la web sigue sin cubrirse, como ya declara la fixture. (2) **El playground no tiene arnés de tests de componente**, así que `ThemeContext.tsx` no tiene tests unitarios; por eso la lógica con sustancia (el batching) se extrajo a `src/lib/theme-scheduler.js`, en JS plano, para poder probarla con `node --test`. (3) **Los setters antiguos siguen sin tests** (no los tenían antes y esta historia no los añade); lo que sí está documentado es cuáles de sus capacidades no tienen equivalente. (4) **`BreakpointsProvider` sigue usando el adaptador legacy** de breakpoints, que reescribe media queries por texto: es justo la capacidad que `applyTheme` rechaza a propósito, así que migrarlo exigiría recompilar y queda fuera de alcance. (5) **No se ha medido generación y commit por separado** como sugiere el paso 3 de la ficha; el batching se validó por número de aplicaciones, no por tiempos. (6) **Dos archivos muertos detectados y no tocados** (`src/components/ThemeProvider.tsx`, `src/app/InlineStyles.tsx`): no los importa nadie, borrarlos es limpieza ajena a esta historia |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
