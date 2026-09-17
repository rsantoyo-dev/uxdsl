# FEAT-005 — UXDSL 0.5.0-beta.4: cero fricción residual en el CLI

| Campo | Valor |
| --- | --- |
| Estado | MIG-B4-01 y MIG-B4-02 implementadas y probadas (unitarias + subprocess real de `uxdsl watch`, incluido el escenario exacto reportado: config delegando a otro módulo vía `require()`; verificado también a mano contra el CLI real). Faltan MIG-B4-03 y MIG-B4-04 |
| Objetivo | Cerrar las fricciones de superficie que quedaron después de FEAT-004: invocar `--strict-theme` sin salir de `build`, que editar un módulo transitivo del config/tema dispare rebuild, y que `init` arranque un proyecto multi-entrada sin copiar el README a mano |
| Versión objetivo | `0.5.0-beta.4` |
| Prioridad | P0: auto-watch de requires transitivos (bug real, no feature); P1: `--strict-theme` en build/watch; P2: `init --multi` |
| Depende de | FEAT-004 (`0.5.0-beta.3`), ya publicado — ver [release](../releases/0.5.0-beta.3.md) |
| Origen | Segunda ronda de verificación de un proyecto consumidor real sobre beta.3, con corrección propia de framing en dos de los cinco puntos reportados (uno ya estaba resuelto, otro tenía alcance más chico de lo reportado) |
| Explícitamente fuera de alcance | Diagnostics de editor (subrayar errores en `.uxdsl` mientras se escribe) — es un proyecto de naturaleza distinta (LSP/`DiagnosticCollection`, ciclo de versión de `.vsix` separado del de los paquetes npm) con decisiones de arquitectura propias (debounce, mapeo de errores a rangos del editor). Mezclarlo aquí repetiría exactamente el patrón que produjo el ritmo de tres betas con cambios de forma en FEAT-004. Ver la nota al final de este documento. |

## Objetivo del release

Un consumidor que ya usa beta.3 no debería tener que:

- Acordarse de correr `uxdsl theme --diff --strict` aparte para saber si algo
  quedó heredado del default sin querer — `uxdsl build --strict-theme` hace
  la misma pregunta en el momento en que realmente importa, al compilar.
- Perder media hora en vivo, tocando archivos con el watcher corriendo, para
  descubrir que un módulo que su `uxdsl.config.js` importa con `require()` no
  dispara rebuild — solo el archivo que declara el `require()` está en el
  watch list; lo que ese archivo importa a su vez, no.
- Escribir a mano un `builds: [...]` de tema + N paneles leyendo el README,
  cuando `uxdsl init` ya sabe detectar Next.js/Vite y generar la forma
  single-entry sin preguntarle nada al usuario.

## Evidencia de baseline (verificada en código y en vivo, no asumida)

| Hallazgo | Estado | Evidencia |
| --- | --- | --- |
| `theme.breakpoints` shadowed por el CLI | ✅ Ya resuelto en beta.3 (MIG-B3-01) | Confirmado compilando contra el paquete publicado: `uxdsl.theme.json` con `breakpoints.xl` produce `@media (min-width: <valor>px)` correctamente |
| Config/tema editado con watch corriendo no dispara rebuild | ✅ Ya resuelto en beta.3 (MIG-B3-02/pre-existente) | [`uxdsl.js:490-491`](../../packages/uxdsl-cli/bin/uxdsl.js#L490-L491): tanto `configPath` como `themeConfigPath` se auto-agregan al watch list; probado con un `uxdsl watch` real en [`watch-mode.test.js:56`](../../packages/uxdsl-cli/test/watch-mode.test.js#L56) |
| Un módulo que el config/tema importa con `require()` (no el config/tema mismo) no dispara rebuild | ✅ Confirmado, es un bug real | [`clearRequireCache`](../../packages/uxdsl-cli/bin/uxdsl.js#L757-L779) camina `require.cache[id].children` recursivamente para *invalidar* el caché, pero esa misma información nunca se usa para *agregar* esos módulos al watch list de chokidar — solo `configPath`/`themeConfigPath` en sí están vigilados. El propio README ya documenta el síntoma como si fuera el comportamiento esperado (`packages/uxdsl-cli/README.md`, sección "Running the CLI": *"Local modules required by the config are reloaded too; include their source paths in `watch` to trigger a rebuild when edited"*) — la limitación se resolvió con una nota, no con código |
| `--strict` solo existe en `uxdsl theme` | ✅ Confirmado | `argv.strict` aparece una sola vez en todo `uxdsl.js`, dentro de `themeCommand`. `findPartiallyDefaultedFamilies`/`diffThemeAgainstDefaults` ya existen y están probadas, pero `buildOnce`/`compileEntryToCss` no las llaman |
| `init` no scaffoldea multi-entry | ✅ Confirmado, decisión explícita de FEAT-004 (MIG-B3-02), no descuido | El template en [`init()`](../../packages/uxdsl-cli/bin/uxdsl.js#L945) genera siempre `entry`/`outFile` de nivel superior; nunca `builds: [...]` |
| "Falla fuerte por defecto si algo queda sin definir" | ❌ Framing corregido durante la revisión, no es un gap | `UXD_REFERENCE_MISSING` ya es fail-by-default para una variable sin ninguna definición. Heredar parcialmente de `DEFAULT_THEME` es la feature de beta.2 funcionando como se diseñó — pedirle que falle por defecto rompería el zero-config. El gap real es de superficie (`--strict-theme` inalcanzable desde `build`), no de postura, y es lo que MIG-B4-01 cierra |

## MIG-B4-01 — `--strict-theme` en `build`/`watch` (P1)

### Historia

Como consumidor que corre `npm run build` en CI, quiero que el build falle si
una familia de tema que declaré quedó parcialmente completada por defaults,
sin tener que acordarme de correr `uxdsl theme --strict` como paso aparte.

### Alcance

- `packages/uxdsl-cli/bin/uxdsl.js`: `loadConfig`, `buildOnce`, `printHelp`.
- Reutiliza `findPartiallyDefaultedFamilies`/`uxdslRuntime.resolveTheme`, ya
  implementadas y probadas para `uxdsl theme --strict` (MIG-B3-04). No
  requiere cambios en el motor ni en el plugin.

### Implementación requerida

1. Flag `--strict-theme` (booleano, mismo patrón que `--include-theme`: no
   declarado en la lista `boolean` de `minimist` para poder distinguir
   "no pasado" de `false` explícito vía `--no-strict-theme`) y
   `strictTheme: true` en `uxdsl.config.cjs`. Precedencia: flag > config >
   `false` (a diferencia de `includeTheme`, el default de `strictTheme` es
   `false` — no queremos que un `uxdsl init` sin pedirlo empiece a fallar
   builds que antes pasaban).
2. `resolveStrictTheme(flagValue, configValue)`, mismo esqueleto que
   `resolveIncludeTheme` pero con default `false`. Resuelto en `loadConfig`
   junto a `includeTheme`/`breakpoints`, después de conocer el tema.
3. En `buildOnce`, antes de compilar cualquier entrada (falla rápido, sin
   gastar tiempo de compilación si ya se sabe que va a fallar): si
   `config.strictTheme`, calcular
   `uxdslRuntime.resolveTheme(config.theme)` y pasar el resultado junto con
   `config.theme` a `findPartiallyDefaultedFamilies`. Si devuelve alguna
   familia, `throw` con el mismo mensaje accionable que ya usa
   `themeCommand` (nombrando las familias), antes de escribir cualquier
   archivo — coherente con la garantía de escritura atómica de MIG-B3-02.
4. Esta comprobación es independiente de `builds`: el tema es compartido
   entre todas las entradas, así que se hace una sola vez por build, no por
   entrada.
5. `uxdsl theme --strict` sigue existiendo tal cual — no se fusiona con el
   flag de build. Son dos superficies distintas (introspección vs. gate de
   build) que comparten el mismo motor de detección.

### Criterios de aceptación

- `uxdsl build --strict-theme` con una familia declarada parcialmente
  (ej. `palette.primary` sin el resto de `palette`) falla, nombra la
  familia, y no escribe ningún archivo de salida.
- `uxdsl build --strict-theme` con la familia completa, o sin ningún tema
  declarado, pasa igual que sin el flag.
- `strictTheme: true` en `uxdsl.config.cjs` tiene el mismo efecto que el
  flag; `--no-strict-theme` en la línea de comandos lo anula.
- `uxdsl watch --strict-theme` falla el build inicial de la misma forma
  (no solo `build`).
- Un `uxdsl.config.cjs` con `builds: [...]` solo evalúa el tema compartido
  una vez, no una vez por entrada.

### Pruebas requeridas

- Unitarias de precedencia (flag/config/default) igual que
  `resolveIncludeTheme`.
- `buildOnce` con `strictTheme: true` y una familia parcial: falla, no
  escribe archivos.
- `buildOnce` con `strictTheme: true` y una familia completa, o sin tema:
  pasa.
- Con `builds: [...]`, confirmar una sola evaluación (mock o conteo) del
  tema compartido.

## MIG-B4-02 — Auto-watch de módulos locales transitivos (P0)

### Historia

Como consumidor con un `uxdsl.config.js` que importa otro módulo local
(`module.exports = require('./config/build.js')`, o un tema que separa datos
en un JSON aparte), quiero que editar ese módulo transitivo dispare rebuild,
sin tener que descubrir la limitación probando en vivo y agregar la ruta a
mano en `watch`.

### Alcance

- `packages/uxdsl-cli/bin/uxdsl.js`: extraer la caminata de
  `clearRequireCache` a una función compartida, reutilizada tanto para
  invalidar el caché como para poblar el watch list.
- No cambia el contrato de `uxdsl.config.cjs`/`uxdsl.theme.config.*` — es
  una corrección de comportamiento, no una opción nueva.

### Implementación requerida

1. Extraer `collectLocalRequireTree(filePath)`: la misma caminata que
   [`clearRequireCache`](../../packages/uxdsl-cli/bin/uxdsl.js#L757-L779)
   ya hace sobre `require.cache[id].children` (excluyendo `node_modules`,
   incluyendo el archivo mismo), pero devolviendo el `Set` de ids
   visitados en vez de borrarlos. `clearRequireCache` pasa a ser
   `collectLocalRequireTree(filePath).forEach(id => delete require.cache[id])`
   — mismo comportamiento exacto, sin duplicar la recursión.
2. En `loadConfig`, en la sección de normalización final donde hoy se hace
   `resolvedConfig.watch.push(configPath)`/`push(themeConfigPath)`,
   reemplazar por: para cada uno de `themeConfigPath`/`configPath` (en ese
   orden, si existen), agregar al watch list *todo* su
   `collectLocalRequireTree(...)`, no solo el archivo top-level. Esto
   funciona porque `loadModuleExport`/`loadThemeConfig` ya corrieron el
   `require()` real antes de este punto — `require.cache` ya tiene el
   árbol completo, incluidos los módulos que el archivo importó a su vez.
3. En modo watch, esto se recalcula en cada `trigger()` (que ya llama a
   `loadConfig` de cero tras invalidar el caché) — si un edit agrega o
   quita un `require()` local, el próximo rebuild ajusta el watch list
   automáticamente, reutilizando el mecanismo existente de "si el watch
   list cambió, recrear el watcher" que ya maneja `startWatch`.
4. No agrega nada nuevo a `packages/uxdsl-cli/README.md` — al contrario,
   la nota actual ("*include their source paths in watch to trigger a
   rebuild when edited*") queda obsoleta y se reemplaza por una que
   describa el comportamiento correcto: los módulos locales transitivos
   se descubren y vigilan solos.

### Criterios de aceptación

- Un `uxdsl.config.cjs` que hace `module.exports = require('./real-config.js')`:
  editar únicamente `real-config.js` (sin tocar `uxdsl.config.cjs`) dispara
  rebuild con el watcher real corriendo.
- Un `uxdsl.theme.config.cjs` que hace `require('./theme-data.json')`:
  editar únicamente `theme-data.json` dispara rebuild — sin el workaround
  de tocar el archivo padre que el test existente usa hoy.
- Un módulo bajo `node_modules` que el config importe (ej. una librería de
  colores) nunca se agrega al watch list.
- Agregar un nuevo `require()` local a mitad de una sesión de `watch` (que
  antes no estaba) se detecta en el próximo rebuild sin reiniciar el CLI.

### Pruebas requeridas

- Regresión real con `uxdsl watch` como subproceso (no solo unitaria):
  reproducir exactamente el escenario que encontró el consumidor —
  `uxdsl.config.js` requiriendo otro módulo, editar solo el módulo hijo.
- La misma prueba para `uxdsl.theme.config.cjs` con un JSON anidado, sin el
  `fs.utimesSync` del test actual — debe pasar solo por el edit real.
- `collectLocalRequireTree` unitaria: excluye `node_modules`, incluye el
  archivo raíz, sigue anidamiento de 2+ niveles.

## MIG-B4-03 — `uxdsl init --multi` (P2)

### Historia

Como consumidor que sabe de entrada que va a tener un tema y varios paneles
en CSS Modules, quiero que `init` me arranque con esa forma, en vez de
escribir `builds: [...]` a mano copiando el README.

### Alcance

- `packages/uxdsl-cli/bin/uxdsl.js`: `init`.
- No cambia el flujo single-entry por defecto — `--multi` es opt-in
  explícito.

### Implementación requerida

1. Flag `--multi` en `uxdsl init --multi`. Sin el flag, comportamiento
   idéntico al actual (ninguna regresión para el caso ya cubierto por
   FEAT-004).
2. Con `--multi`, generar `uxdsl.config.cjs` con `builds: [...]`: una
   entrada de tema (`src/theme.uxdsl`, `includeTheme` por defecto) y una
   entrada de panel de ejemplo (`src/panel-a.uxdsl`, `includeTheme: false`),
   con un comentario mostrando cómo agregar más paneles al array.
3. Crear `src/theme.uxdsl` (comentario, sin imports — igual que el patrón
   ya usado en los fixtures de release) y `src/panel-a.uxdsl` (un ejemplo
   mínimo real, no vacío — ej. `.example { @ds-surface(contained); }` — para
   que el primer `build` produzca algo visible, no un archivo en blanco).
4. Mismas reglas de "nunca sobrescribir" que el resto de `init`: si
   `uxdsl.config.cjs` ya existe (sea cual sea su forma), no se toca; solo
   imprime que ya existe.
5. Mensajes de "Next steps" ajustados para nombrar ambos archivos de salida
   generados, no solo uno.

### Criterios de aceptación

- `uxdsl init --multi` en un directorio vacío crea `uxdsl.config.cjs` con
  `builds`, `src/theme.uxdsl` y `src/panel-a.uxdsl`; `uxdsl build` produce
  `src/theme.css` (con `:root`) y `src/panel-a.css` (sin `:root`).
- `uxdsl init` sin `--multi` sigue produciendo exactamente el mismo
  resultado que antes de esta story (verificado contra
  `fixtures/mig-b2-03-cli-init/`).
- `uxdsl init --multi` sobre un proyecto con `uxdsl.config.cjs` existente
  no lo modifica, sea cual sea su forma.

### Pruebas requeridas

- `fixtures/mig-b2-03-cli-init/run.js` extendido (o un caso nuevo en el
  mismo estilo): `init --multi` en un proyecto vacío, build, hash-compare
  de una segunda corrida de `init --multi` (idempotencia, mismo criterio
  que el resto de `init`).
- Confirmar que `init` sin `--multi` no cambia de comportamiento (correr
  la suite existente de `mig-b2-03-cli-init` sin modificarla y verla pasar
  igual).

## MIG-B4-04 — Gate de release beta.4 (P1)

### Historia

Como mantenedor, quiero probar los tres puntos anteriores contra tarballs
reales antes de publicar, igual que en beta.2 y beta.3.

### Implementación requerida

1. `fixtures/mig-b4-04-release/`, reutilizando
   [`fixtures/lib/tarball-consumer.js`](../../fixtures/lib/tarball-consumer.js)
   — no reimplementar el empaquetado/instalación.
2. Escenario: `init --multi`, un `uxdsl.config.js` que hace
   `require('./theme-data.json')` para el tema, `build --strict-theme` con
   una familia parcial (falla, nombra la familia, no escribe nada) y con la
   familia completa (pasa), y un `uxdsl watch` real editando únicamente
   `theme-data.json` (sin tocar el archivo padre) para confirmar el
   rebuild.
3. **No publicar** como parte de esta story. La publicación y el dist-tag
   requieren aprobación explícita del dueño, igual que en beta.2 y beta.3.

### Criterios de aceptación

- El fixture pasa contra las 5 tarballs, sin resolución accidental al
  monorepo.
- Los tres escenarios (`--strict-theme`, auto-watch transitivo, `init --multi`)
  se prueban contra el paquete instalado, no solo en el monorepo.

## Orden recomendado de implementación

1. **MIG-B4-02** — es la corrección de un bug real (no una feature), y no
   tiene ninguna dependencia de las otras dos.
2. **MIG-B4-01** — depende solo de código ya existente (`resolveTheme`,
   `findPartiallyDefaultedFamilies`); independiente de MIG-B4-02.
3. **MIG-B4-03** — la de menos urgencia; puede viajar con cualquiera de
   las dos anteriores sin fricción.
4. **MIG-B4-04** — cierra el release.

## Definition of done

- [x] `uxdsl build --strict-theme` (y `watch --strict-theme`) fallan antes
      de escribir cualquier archivo cuando una familia declarada quedó
      parcialmente completada por defaults, y pasan en cualquier otro caso.
- [x] Editar un módulo que el config o el tema `require()` transitivamente
      dispara rebuild con el watcher real corriendo, sin workarounds.
- [x] El README de `uxdsl-cli` ya no describe la limitación de módulos
      transitivos como comportamiento esperado.
- [ ] `uxdsl init --multi` produce un proyecto `builds` funcional; `init`
      sin el flag no cambia.
- [ ] El fixture de release reproduce los tres escenarios contra tarballs
      reales.
- [ ] README, migration guide y CHANGELOG reflejan beta.4.
- [ ] La publicación queda fuera de la implementación y requiere aprobación
      explícita del dueño.

---

## Nota: diagnostics de editor (fuera de alcance, proyecto propio)

El punto de mayor impacto real detectado en la revisión — cero feedback en
el editor mientras se escribe `.uxdsl`, todo error se descubre recién al
correr `build` — queda **deliberadamente fuera de beta.4**. No por ser menos
importante (es, al contrario, el de más impacto en el día a día), sino
porque es un proyecto de otra naturaleza:

- Requiere que el motor (`postcss-uxdsl`) adjunte posición estructurada
  (`{ line, column, source }`) a sus errores (`UXD_DENSITY_REFERENCE`,
  `UXD_BUTTON_ARGUMENT`, etc.), hoy `throw new Error(string)` planos desde
  funciones puras que no reciben el nodo PostCSS con su posición.
- Requiere decisiones de arquitectura propias en `packages/uxdsl-vscode`
  (hoy solo `registerCompletionItemProvider`, sin `DiagnosticCollection`):
  ¿corre el compilador sobre el buffer en cada keystroke o con debounce?,
  ¿sobre el archivo guardado o el contenido en memoria?, ¿cómo mapea un
  error de un archivo importado (`@import`) de vuelta al archivo que el
  usuario tiene abierto?
- Tiene su propio ciclo de empaquetado (`.vsix`, versionado independiente
  de los 5 paquetes npm coordinados).

Mezclar esto con MIG-B4-01/02/03 — cambios chicos, aditivos, de una tarde —
detrás de un mismo release repetiría el patrón que produjo el ritmo de tres
betas con cambios de forma en FEAT-004: lo trivial esperando a lo grande sin
necesidad. Se deja registrado acá para no perderlo, con su propio feature
doc (FEAT-006, a escribir cuando se decida encararlo) en vez de una story
más de este documento.
