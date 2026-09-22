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

- [ ] API síncrona exportada; fallo no sustituye el último tema válido.
- [ ] Hidratación mantiene el tema del proyecto y no duplica estilos/fuentes.
- [ ] Cambios estructurales fallan con instrucción de recompilación.
- [ ] Paridad de valores/estados/modos verificada desde tarball y navegador.
- [ ] Setters y sus excepciones legacy conservan comportamiento probado.
- [ ] Migración idempotente no pierde datos ante errores de storage.
- [ ] Editor agrupa actualizaciones y cancela pendientes al cambiar de contexto.
- [ ] Ficha, README, migration, arquitectura y AGENTS describen el contrato real.

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

Estado de esta revisión documental: **Pendiente de implementación/verificación**
(salvo avances parciales señalados arriba). Completar en el mismo PR conforme al
[protocolo de agentes](README.md#cobertura-y-evidencia-obligatorias). No marcar
criterios por intención ni confundir una reproducción histórica con prueba actual.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | Comando/test, resultado observado y fecha: pendiente |
| Criterio → regresión | Nombre/path exacto del test por criterio: pendiente |
| Comandos y entorno | Comando, versión/OS relevante, exit code y log: pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente; justificar si no aplica |
| README / CHANGELOG / migration | Paths y secciones: pendiente |
| AGENTS / guías / arquitectura | Secciones actualizadas o sin cambio de contrato razonado: pendiente |
| Límites y seguimiento | Qué no se ejecutó, motivo y efecto sobre cierre: pendiente |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
