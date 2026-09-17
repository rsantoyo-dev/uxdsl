# FEAT-006 — UXDSL 0.5.0-beta.5: `--strict-theme` con alcance por familia

| Campo | Valor |
| --- | --- |
| Estado | Propuesta. Ninguna story implementada. Baseline verificado contra el código publicado en `0.5.0-beta.4` |
| Objetivo | Que `--strict-theme`/`uxdsl theme --strict` sirvan como gate de CI real, sin entrar en conflicto con el propio diseño de partial theme que la librería documenta y celebra |
| Versión objetivo | `0.5.0-beta.5` |
| Prioridad | P0: alcance por familia (corrige un falso positivo que hace el flag inutilizable en la práctica); P2: warning de claves desconocidas dentro de familias matriz |
| Depende de | FEAT-005 (`0.5.0-beta.4`), ya publicado — ver [release](../releases/0.5.0-beta.4.md) |
| Origen | Reporte de un proyecto consumidor real usando `--strict-theme` en CI, verificado contra el código en esta pasada |

## Objetivo del release

`--strict-theme`/`strictTheme: true` hoy chequean que **toda** familia de tema
que el proyecto tocó quede 100% especificada por el proyecto, sin ningún
leaf heredado de `DEFAULT_THEME`. El problema, verificado en código: ese
chequeo se contradice con el propio diseño de partial theme que beta.2
introdujo y que el resto de esta documentación celebra como la feature
principal de "instalación suave".

Un proyecto debe poder decir explícitamente **para qué familias** quiere esa
garantía de completitud, en vez de que la herramienta decida por él:

```bash
uxdsl build --strict-theme=palette,breakpoints
```

```js
// uxdsl.config.cjs
module.exports = {
  strictTheme: ['palette', 'breakpoints'], // typography_details queda afuera, a propósito
};
```

## Evidencia de baseline (verificada en código, no asumida)

| Hallazgo | Estado | Evidencia |
| --- | --- | --- |
| Un solo override de `typography_details.h2.line` marca **toda** la familia como incompleta | ✅ Confirmado | Reproducido contra `findPartiallyDefaultedFamilies`: con `{ typography_details: { h2: { line: '1.15' } } }`, devuelve `['typography_details']` — 124 filas de diff, incluyendo `h1` completo, que nunca se tocó |
| El propio comentario del código documenta el partial override como el diseño, no una excepción | ✅ Confirmado | [`theme-validate.ts:261`](../../packages/postcss-uxdsl/src/ds-runtime/theme-validate.ts#L261) (`// Typography details (partial allowed)`) y [`:311`](../../packages/postcss-uxdsl/src/ds-runtime/theme-validate.ts#L311) (`// Partial override: merge default -> tag`) |
| El problema **no** es exclusivo de `typography_details` — "familias todo-o-nada" no es una categoría real | ✅ Confirmado, y es el hallazgo central de esta propuesta | El ejemplo que el propio README de `postcss-uxdsl` usa para *celebrar* el zero-config theme (`palette: { primary: { main: '#123456' } }`, dejando `dark`/`contrast`/el resto de `palette` en default) también marca `'palette'` como incompleta. El override parcial de `spacing` que el propio fixture `mig-b2-05-release` usa (`spacing: { 4: '0.875rem' }`) también marca `'spacing'`. Las cuatro familias que `resolveTheme()` mergea (`spacing`, `palette`, `fonts`, `typography_details`) documentan el partial override como el patrón esperado — no hay una familia "segura" para chequear completitud incondicionalmente por defecto |
| `resolveTheme()` no mergea nada para `buttons`/`surfaces`/`inputs`/`densities`/`shadows`/`borders`/`radii` | ✅ Confirmado, acota el alcance del bug | `effective.buttons === raw.buttons` (misma referencia) — esas familias tienen sus propios defaults (`DEFAULT_BUTTONS` etc.) fuera de `DEFAULT_THEME`, así que `--strict-theme` estructuralmente no puede detectar nada ahí, para bien o para mal; el bug reportado solo aplica a las 4 familias que sí mergea `resolveTheme` |

### Por qué la categorización "todo-o-nada vs. matriz" no es la corrección correcta

La primera reacción natural es clasificar familias: `palette`/`breakpoints`
"todo-o-nada", `typography_details` "matriz, override parcial esperado". Esa
clasificación no resiste la prueba: el override parcial de `palette` (y de
`spacing`) está tan documentado y celebrado como el de `typography_details`.
Una tabla fija de tipos de familia le habría funcionado a este consumidor
hoy —porque su proyecto en particular especifica `palette`/`breakpoints`
completos— pero se habría roto en cuanto otro proyecto hiciera con `palette`
exactamente lo que el README recomienda. "¿Espero que esta familia quede
completa?" es una decisión del proyecto, no una propiedad intrínseca de la
familia — por eso el fix es una lista que el proyecto declara, no una
clasificación que la herramienta adivina.

## MIG-B5-01 — Alcance por familia en `--strict-theme` y `uxdsl theme --strict` (P0)

### Historia

Como consumidor que corre `--strict-theme` en CI, quiero declarar
explícitamente qué familias deben quedar completas, para poder usar el
partial override documentado en el resto (típicamente `typography_details`)
sin que el gate falle por eso.

### Alcance

- `packages/uxdsl-cli/bin/uxdsl.js`: `resolveStrictTheme`,
  `findPartiallyDefaultedFamilies`, `buildOnce`, `themeCommand`, validación
  de `uxdsl.config.cjs`, `printHelp`.
- No cambia el motor de detección (`diffThemeSubtree`) ni introduce un
  concepto nuevo — solo filtra qué familias tocadas se le pasan.
- **No rompe nada existente**: `strictTheme: true`/`--strict-theme` sin
  valor siguen significando exactamente lo mismo que en beta.4 (chequear
  toda familia tocada) — sigue siendo una opción legítima para un proyecto
  que de verdad quiere esa exigencia máxima. Lo que se agrega es una
  tercera forma, no un reemplazo.

### Implementación requerida

1. `strictTheme` acepta tres formas: `false`/ausente (como hoy), `true`
   (como hoy — toda familia tocada), o un array de nombres de familia
   (`['palette', 'breakpoints']`) — chequea solo esas, entre las tocadas.
2. `resolveStrictTheme(flagValue, configValue)` pasa a normalizar ambos
   lados a `false | true | string[]` antes de aplicar la precedencia
   flag > config > `false` ya existente. Un flag CLI de valor string
   (`--strict-theme=palette,breakpoints`) se separa por comas y se
   recorta (`trim`) cada nombre; un array vacío (`[]`, o una cadena vacía)
   se trata como "no especificado en este nivel", no como `true` ni `false`.
3. Validación de `uxdsl.config.cjs`: `strictTheme` debe ser `boolean` o un
   array de strings — mismo patrón de error accionable que el resto
   (nombra el archivo y la propiedad).
4. `findPartiallyDefaultedFamilies(rawTheme, effectiveTheme, scope)` recibe
   un tercer parámetro opcional: si `scope` es un array, solo evalúa la
   intersección con las familias tocadas; si es `true`/ausente, comportamiento
   idéntico a hoy (todas las tocadas). `diffThemeAgainstDefaults` no cambia
   — `--diff` sigue mostrando todo lo tocado, el alcance es exclusivo de la
   pregunta de completitud (`--strict`).
5. `uxdsl theme --strict` recibe el mismo alcance:
   `uxdsl theme --strict=palette,breakpoints` (o `--strict` a secas para
   "todas", igual que hoy).
6. Mensaje de error de `--strict-theme` (en `build`/`watch`) y de `--strict`
   (en `theme`) sin cambios en su forma — sigue nombrando las familias
   incompletas — pero ahora esas familias son necesariamente un subconjunto
   del alcance pedido, nunca familias que el proyecto explícitamente decidió
   no chequear.
7. README de `uxdsl-cli`: la recomendación pasa a ser el alcance explícito
   como la forma normal de usar el flag en CI; `true` se documenta como
   "estrictez máxima, es probable que choque con cualquier partial theme
   documentado — la mayoría de los proyectos quiere una lista explícita".

### Criterios de aceptación

- `uxdsl build --strict-theme=palette` con `palette` completa y
  `typography_details` parcial: pasa (typography_details no está en el
  alcance).
- `uxdsl build --strict-theme=palette` con `palette` parcial: falla,
  nombrando `palette`, sin escribir nada — igual que hoy pero acotado.
- `uxdsl build --strict-theme` (sin valor) se comporta exactamente igual
  que en beta.4 — cero regresión para quien ya lo usa así.
- `strictTheme: ['palette']` en `uxdsl.config.cjs` tiene el mismo efecto
  que el flag; `--strict-theme=breakpoints` en la línea de comandos anula
  el array del config por completo (mismo "flag gana siempre" que
  `includeTheme`), no lo mergea.
- Una familia nombrada en el alcance que el proyecto nunca tocó no genera
  ningún error ni falso positivo — simplemente no hay nada que chequear ahí.
- `uxdsl theme --strict=palette,breakpoints` tiene el mismo alcance que su
  equivalente en `build`.
- Un `strictTheme` con un tipo inválido (ni boolean ni array de strings)
  falla con un error que nombra el archivo y la propiedad.

### Pruebas requeridas

- Unitarias de `resolveStrictTheme`/normalización: string CSV → array,
  array JS → array, `true`/`false` sin cambios, array vacío o string vacío
  → "no especificado".
- `findPartiallyDefaultedFamilies` con alcance: solo evalúa la
  intersección; una familia fuera del alcance nunca aparece en el
  resultado aunque esté incompleta.
- `buildOnce` con `strictTheme: ['palette']`: pasa con `typography_details`
  parcial, falla con `palette` parcial.
- Regresión explícita: el repro exacto de este reporte
  (`typography_details.h2.line` solo, `strictTheme: true`) sigue fallando
  igual que en beta.4 — este fix no cambia el comportamiento de `true`, solo
  agrega la alternativa.
- `uxdsl.config.cjs` con `strictTheme` de tipo inválido falla nombrando la
  propiedad.

## MIG-B5-02 — Aviso de claves desconocidas dentro de familias matriz (P2, opcional)

### Historia

Como consumidor que declaró `strictTheme: ['palette']` para dejar
`typography_details` fuera del chequeo de completitud, quiero seguir
teniendo protección real contra un typo dentro de esa familia (`h9` en vez
de `h2`, `fontsize` en vez de `fontSize`), ya que "completa" no es la
pregunta correcta ahí pero "typo" sí lo es.

### Alcance

- `packages/postcss-uxdsl/src/ds-runtime/theme-validate.ts`, extendiendo el
  mismo mecanismo de MIG-B3-03 (aviso de familia top-level desconocida) un
  nivel más adentro, para las familias con forma de "registro de claves
  conocidas": `typography_details` (tags), `palette` (roles), `fonts.families`
  (roles).
- No reemplaza ni depende de MIG-B5-01 — es una mejora complementaria y
  puede implementarse o publicarse por separado sin bloquear el gate de
  release de esta feature.

### Implementación requerida

1. Reusar las claves de `DEFAULT_THEME.typography_details`,
   `DEFAULT_THEME.palette` y `DEFAULT_THEME.fonts.families` como la lista de
   nombres conocidos — no duplicar una lista aparte que se pueda desincronizar.
2. Al validar el tema, por cada una de esas tres familias presente en el
   input: por cada clave de nivel superior dentro de la familia que no esté
   en el set conocido, agregar un `warning` (no error) con el mismo formato
   que el de MIG-B3-03 (`Unknown theme family "..."`), adaptado a
   `Unknown <familia> key "..."`.
3. Un rol/tag nuevo declarado deliberadamente (una familia de color
   adicional, por ejemplo) es una decisión legítima del proyecto — por eso
   es warning, no error, igual que el resto de esta línea de trabajo.

### Criterios de aceptación

- `typography_details: { h9: { ... } }` (tag inexistente) produce un
  warning nombrando `h9`.
- `palette: { primry: { main: '#fff' } }` (typo) produce un warning
  nombrando `primry`.
- Un tag/rol válido no produce ningún warning nuevo.

### Pruebas requeridas

- Unitarias en el estilo de `theme-validate-unknown-family.test.js`
  (MIG-B3-03), una por familia (`typography_details`, `palette`,
  `fonts.families`).

## MIG-B5-03 — Gate de release beta.5 (P1)

### Historia

Como mantenedor, quiero probar el alcance por familia contra tarballs
reales antes de publicar, igual que en los releases anteriores.

### Implementación requerida

1. `fixtures/mig-b5-03-release/`, reutilizando
   [`fixtures/lib/tarball-consumer.js`](../../fixtures/lib/tarball-consumer.js).
2. Escenario: el repro exacto de este reporte — un tema con
   `typography_details` parcial (patrón documentado) y `palette` completa,
   compilado con `uxdsl build --strict-theme=palette` (pasa) y con
   `uxdsl build --strict-theme` sin alcance (sigue fallando, sin regresión
   de lo que beta.4 ya hacía).
3. **No publicar** como parte de esta story. La publicación y el dist-tag
   requieren aprobación explícita del dueño, igual que en cada release
   anterior.

### Criterios de aceptación

- El fixture pasa contra las 5 tarballs, sin resolución accidental al
  monorepo.
- Ambos comportamientos (`--strict-theme` acotado y sin acotar) se prueban
  contra el paquete instalado.

## Orden recomendado de implementación

1. **MIG-B5-01** — corrige el bloqueador real; sin esto el flag sigue
   siendo inutilizable para cualquier proyecto con partial theme.
2. **MIG-B5-02** — independiente, puede ir antes, después, o quedar para
   otro release sin afectar a MIG-B5-01.
3. **MIG-B5-03** — cierra el release.

## Definition of done

- [ ] `--strict-theme=familia1,familia2` (y su equivalente en
      `uxdsl.config.cjs`) chequea solo esas familias, entre las tocadas.
- [ ] `strictTheme: true`/`--strict-theme` sin valor se comportan
      exactamente igual que en beta.4 — cero regresión.
- [ ] El mismo alcance funciona en `uxdsl theme --strict`.
- [ ] Un `strictTheme` de tipo inválido falla nombrando el archivo y la
      propiedad.
- [ ] (Opcional) Claves desconocidas dentro de `typography_details`,
      `palette` y `fonts.families` producen un warning.
- [ ] El fixture de release reproduce el escenario original del reporte
      contra tarballs reales.
- [ ] README, migration guide y CHANGELOG reflejan beta.5.
- [ ] La publicación queda fuera de la implementación y requiere aprobación
      explícita del dueño.
