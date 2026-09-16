# FEAT-004 — UXDSL 0.5.0-beta.3: paridad CLI↔plugin y tema observable

| Campo | Valor |
| --- | --- |
| Estado | Propuesta. Ninguna story implementada. Baseline verificado contra el código publicado en `0.5.0-beta.2` |
| Objetivo | Que todo lo que el plugin sabe hacer sea alcanzable desde el CLI, y que el tema resuelto sea inspeccionable |
| Versión objetivo | `0.5.0-beta.3` |
| Prioridad | P0: puente de opciones CLI→plugin; P1: entradas múltiples, diagnóstico de tema; P2: política de cambios visuales |
| Depende de | FEAT-003 (`0.5.0-beta.2`), ya publicado — ver [release](../releases/0.5.0-beta.2.md) |
| Origen | Reporte de migración beta.1→beta.2 de un proyecto consumidor real, verificado contra el código en esta pasada |

## Objetivo del release

beta.2 resolvió el descubrimiento de configuración y el tema por defecto. Lo
que queda expuesto es una asimetría: **el plugin PostCSS acepta opciones que el
CLI nunca le entrega**, y el consumidor no tiene forma de ver qué tema terminó
usando. beta.3 cierra las dos cosas.

Un consumidor debe poder compilar una entrada de tema y N entradas de
componente desde el CLI, sin `:root` duplicado y sin guards propios:

```bash
npx uxdsl build --entry src/theme.uxdsl   --out src/theme.css
npx uxdsl build --entry src/panel-a.uxdsl --out src/panel-a.css --no-include-theme
```

Y debe poder responder "¿de dónde salió este valor?" sin diffear CSS compilado:

```bash
npx uxdsl theme --diff
```

## Evidencia de baseline (verificada en código, no asumida)

Cada punto se verificó contra el árbol publicado como `0.5.0-beta.2`
(commit `4ad9a66`). El reporte del consumidor acertó en casi todo; un punto
está **subestimado** y otro tiene un efecto secundario que nadie mencionó.

| Hallazgo | Estado | Evidencia |
| --- | --- | --- |
| `includeTheme` nunca viaja del CLI al plugin | ✅ Confirmado | [`uxdsl.js:393-397`](../../packages/uxdsl-cli/bin/uxdsl.js#L393-L397) invoca `uxdslPlugin({ breakpoints, theme, references })`. No hay ninguna ruta que lo pase |
| `:root` duplicado en cada CSS Module | ✅ Confirmado, consecuencia del anterior | Todo build vía `uxdsl build`/`watch` recibe `includeTheme: true` por defecto del plugin |
| `theme.breakpoints` ignorado en la práctica | ⚠️ **Peor que lo reportado: es un bug, no una feature pendiente** | El plugin **sí** honra `theme.breakpoints` ([`index.ts:108`](../../packages/postcss-uxdsl/src/index.ts#L108)) y el validador **sí** los valida ([`theme-validate.ts:119-148`](../../packages/postcss-uxdsl/src/ds-runtime/theme-validate.ts#L119-L148)), pero el CLI siempre pasa `config.breakpoints \|\| DEFAULT_BREAKPOINTS` — nunca `undefined` — así que el fallback del plugin queda permanentemente tapado |
| Colisión de nombre de `uxdsl.theme.config.*` sin red de seguridad | ✅ Confirmado | [`uxdsl.js:176-191`](../../packages/uxdsl-cli/bin/uxdsl.js#L176-L191): sin clave `theme` ni `references`, el módulo entero **es** el tema. Un build-config renombrado pasa como tema y sus claves se ignoran en silencio |
| Fallback parcial a `DEFAULT_THEME` invisible | ✅ Confirmado | `validateTheme` no emite ningún warning por familia de nivel superior desconocida; no hay registro de procedencia de tokens |
| Sin comando de introspección de tema | ✅ Confirmado, y barato | `DEFAULT_THEME`, `getDefaultTheme` y `resolveTheme` ya se exportan desde [`ds-runtime.ts:22`](../../packages/postcss-uxdsl/src/ds-runtime.ts#L22). Falta solo el subcomando |
| Cambio de line-height h2/h3 sin aviso | ✅ Confirmado | [`typography-defaults.ts`](../../packages/postcss-uxdsl/src/typography-defaults.ts) es nuevo en beta.2: `h2: "xs(1.2) md(1.15)"`, `h3: "xs(1.3) md(1.25)"`, contra `1.2`/`1.3` planos en [`typography.ts:18-19`](../../packages/postcss-uxdsl/src/typography.ts#L18-L19). El CHANGELOG no lo menciona como cambio visual |
| `references: { mode: 'warn' }` | ✅ Ya existe y funciona | Sin trabajo pendiente |

### Causa raíz común

El reporte trata `includeTheme` y `breakpoints` como dos problemas distintos
(🔴 y 🟢). Son el mismo: **`buildOnce` traduce la configuración al plugin con
una lista blanca de tres claves y defaults tempranos**. Cualquier opción del
plugin que no esté en esa lista es inalcanzable desde el CLI, y cualquier
default que el CLI resuelva antes de tiempo desactiva el fallback del plugin.
Mientras el puente sea una lista blanca hardcodeada, cada opción nueva del
plugin nace rota para todos los consumidores del CLI.

Por eso MIG-B3-01 no es "el fix de una línea" que sugiere el reporte: arreglar
el reenvío sin tocar la precedencia de breakpoints desincroniza el marcador
`#uxdsl-bp-meta` (ver más abajo).

### Efecto secundario no reportado

[`uxdsl.js:405-410`](../../packages/uxdsl-cli/bin/uxdsl.js#L405-L410) añade
**siempre** el comentario `/*@uxdsl-bp …*/` y la regla marcadora
`#uxdsl-bp-meta { --bp: …; display: none; }` al final de la salida. Con
`includeTheme: false` reenviado ingenuamente, cada entrada de componente
emitiría su propia copia de ese marcador: se elimina la duplicación de `:root`
y se introduce una duplicación nueva del mismo tipo. Los metadatos de
breakpoints pertenecen a la entrada de tema y deben omitirse cuando
`includeTheme` es `false`.

## MIG-B3-01 — Puente de opciones CLI→plugin (P0)

### Historia

Como consumidor que compila con `uxdsl build`, quiero acceso a las mismas
opciones que tendría llamando al plugin directamente, para no necesitar un
guard propio que borre los `:root` duplicados.

### Alcance

- `packages/uxdsl-cli/bin/uxdsl.js`: `buildOnce`, `loadConfig`, parsing de
  flags y `printHelp`.
- No cambia el motor. El plugin ya soporta todo lo que hace falta.

### Implementación requerida

1. Reenviar `includeTheme` desde la configuración de build y desde un flag
   nuevo. `minimist` ya está en uso ([`uxdsl.js:714-723`](../../packages/uxdsl-cli/bin/uxdsl.js#L714-L723));
   declarar `include-theme` como booleano da `--no-include-theme` gratis.
   Precedencia: flag > config > `true`.

2. Resolver los breakpoints **una sola vez** en el CLI y pasar el valor
   resuelto tanto al plugin como a `normalizeBpMap`, para que el CSS y el
   marcador `#uxdsl-bp-meta` no puedan divergir:

   ```text
   config.breakpoints  >  theme.breakpoints  >  DEFAULT_BREAKPOINTS
   ```

3. Decidir explícitamente la semántica de un mapa de breakpoints parcial. Hoy
   es inconsistente: el plugin fusiona `theme.breakpoints` sobre
   `DEFAULT_BPS`, pero usa `opts.breakpoints` tal cual. **Recomendación:**
   fusionar ambos sobre los defaults, porque el merge parcial es la semántica
   que beta.2 ya estableció para el tema. Cualquiera que sea la decisión, debe
   quedar cubierta por una prueba y anotada en el CHANGELOG si cambia el
   comportamiento de un `uxdsl.config.cjs` existente.

4. Omitir la inyección de metadatos de breakpoints (`/*@uxdsl-bp …*/` y
   `#uxdsl-bp-meta`) cuando `includeTheme` sea `false`. Son parte del tema
   global, no de una entrada de componente.

5. No emitir `[uxdsl] Theme config detected` cuando `includeTheme` es `false`
   y el tema solo se usa para resolver referencias: el mensaje sugiere que se
   está emitiendo el tema.

6. Añadir un guard contra la regresión estructural: una prueba que enumere las
   claves de [`UxDslOptions`](../../packages/postcss-uxdsl/src/index.ts#L31) y
   falle si alguna no es alcanzable desde el CLI. Esto es lo que impide que la
   lista blanca vuelva a quedarse atrás.

### Criterios de aceptación

- `uxdsl build --no-include-theme` produce CSS sin ninguna declaración `:root`
  y sin `#uxdsl-bp-meta`.
- Dos entradas compiladas por separado (una con tema, otra sin) se concatenan
  sin ninguna definición duplicada.
- Un `uxdsl.theme.config.cjs` que declara `breakpoints` y un
  `uxdsl.config.cjs` que no los declara producen media queries en esos
  breakpoints, y el marcador `#uxdsl-bp-meta` refleja el mismo mapa.
- `includeTheme: false` sigue validando referencias (comportamiento existente
  del plugin, no debe regresionar).
- El guard de paridad falla si se añade una opción al plugin sin exponerla.

### Pruebas requeridas

- Unitarias de CLI para precedencia de `includeTheme` (flag, config, default) y
  de breakpoints (config, tema, defaults).
- Prueba de composición: salida de entrada-tema + entrada-componente sin
  duplicados, comparada con la salida que produce el plugin llamado
  directamente con las mismas opciones — deben ser equivalentes.
- Control negativo: `--no-include-theme` con un token desconocido sigue
  fallando con `UXD_REFERENCE_MISSING`.

## MIG-B3-02 — Entradas múltiples en un solo build (P1)

### Historia

Como consumidor con una entrada de tema y cuatro paneles en CSS Modules,
quiero declarar las cinco entradas en un solo config, para no correr cinco
procesos con cinco watchers sobre los mismos archivos.

### Alcance

MIG-B3-01 ya desbloquea el caso corriendo el CLI N veces. Esta story es la capa
ergonómica encima; no la precede.

### Implementación requerida

1. Aceptar `builds: [{ entry, outFile, includeTheme }]` en `uxdsl.config.cjs`,
   mutuamente excluyente con `entry`/`outFile` de nivel superior. Declarar
   ambos es un error duro que nombra el conflicto.
2. `theme`, `references`, `breakpoints` y `watch` siguen siendo de nivel
   superior: son del proyecto, no de una entrada.
3. Un solo watcher para todas las entradas. Un cambio recompila solo las
   entradas afectadas cuando eso sea determinable por el resolvedor de
   imports; si no lo es, recompila todas y lo dice.
4. El fallo de una entrada no debe dejar a las demás a medio escribir: compilar
   todo en memoria y escribir al final, o escribir por entrada y reportar un
   resumen con el código de salida correcto.
5. `uxdsl init` no genera `builds` por defecto — el caso de una sola entrada
   sigue siendo el documentado para proyectos nuevos.

### Criterios de aceptación

- Cinco entradas declaradas producen cinco archivos con un solo `:root`, en una
  sola invocación.
- `--watch` con `builds` levanta un único watcher.
- Un error de compilación en la entrada 3 devuelve exit code distinto de cero y
  nombra la entrada.

## MIG-B3-03 — Diagnóstico de colisión y familias desconocidas (P1)

### Historia

Como consumidor que migra un proyecto existente, quiero que UXDSL me avise
cuando mi archivo de tema no parece un tema, en vez de ignorarlo en silencio.

### Implementación requerida

1. En [`normalizeThemeModule`](../../packages/uxdsl-cli/bin/uxdsl.js#L176-L191):
   si el export no tiene `theme` ni `references` **y** tiene claves de
   build-config en el nivel superior (`entry`, `outFile`, `watch`, `themeFile`,
   `plugins`), emitir un warning explícito que nombre el archivo, las claves
   detectadas y la corrección (envolver en `{ theme: … }` o renombrar el
   archivo). Warning, no error: el consumidor podría tener legítimamente una
   familia de tokens con uno de esos nombres.
2. En `validateTheme`: emitir un warning por cada familia de nivel superior
   desconocida. Hoy el validador solo conoce `breakpoints`, `fonts`, `colors`,
   `typography_details`, `densities`, `inputs`, `buttons`, `surfaces` y
   `shadows`, y no dice nada de lo demás — que es exactamente por qué la
   colisión pasa inadvertida.
3. Los warnings se emiten una vez por build, no por rebuild en watch, para no
   inundar la consola.

### Criterios de aceptación

- Un `uxdsl.theme.config.cjs` que en realidad contiene `{ entry, outFile }`
  produce un warning accionable y el build sigue.
- Un tema con una familia mal escrita (`color` en vez de `colors`) la nombra.
- Un tema válido no produce ningún warning nuevo.

## MIG-B3-04 — `uxdsl theme`: introspección y procedencia (P1)

### Historia

Como consumidor, quiero ver el tema resuelto y saber qué vino de mis archivos
y qué vino de los defaults de la librería, sin diffear CSS compilado.

### Implementación requerida

1. Subcomando `uxdsl theme` que imprime el tema resuelto como JSON, usando el
   mismo `loadConfig` que `build` (mismo descubrimiento, misma precedencia) y
   `resolveTheme`/`DEFAULT_THEME`, ya exportados desde
   [`ds-runtime.ts:22`](../../packages/postcss-uxdsl/src/ds-runtime.ts#L22).
2. `--diff`: imprime solo lo que difiere de `DEFAULT_THEME`, marcando cada
   token como `[project]` o `[default]`. Esto es la respuesta concreta al
   "fallback parcial invisible": la procedencia se calcula comparando el tema
   del proyecto contra el resuelto, sin instrumentar el motor.
3. `--strict`: exit code distinto de cero si alguna familia declarada
   parcialmente por el proyecto se completó con defaults. Es el `--strict-theme`
   pedido, acotado a algo verificable: no "todo es mío", sino "no hay relleno
   silencioso en las familias que sí toqué".
4. Respeta `UXDSL_DEBUG=1` para reportar qué archivos se descubrieron, con la
   regla existente de nunca imprimir valores de tokens externos.

### Criterios de aceptación

- `uxdsl theme` sin tema de proyecto imprime `DEFAULT_THEME` íntegro.
- `uxdsl theme --diff` con un override de `fonts.families.ui` muestra esa ruta
  como `[project]` y no lista el resto.
- `uxdsl theme --strict` falla en un proyecto que define `colors.brand` pero
  hereda el resto de `colors`, y pasa cuando la familia está completa.
- La salida es JSON parseable (sin logs mezclados en stdout).

## MIG-B3-05 — Política de cambios visuales en defaults (P2)

### Historia

Como consumidor que actualiza una versión beta, quiero que un cambio en el
aspecto por defecto aparezca en el CHANGELOG, aunque sea menor.

### Implementación requerida

1. Documentar retroactivamente en el CHANGELOG de `postcss-uxdsl`, bajo
   `0.5.0-beta.2`, el cambio de line-height de h2/h3 (`h2: xs(1.2) md(1.15)`,
   `h3: xs(1.3) md(1.25)`), marcado como cambio de comportamiento visual. Ya lo
   recibieron los consumidores; el registro se corrige, no se oculta.
2. Añadir una sección `### Cambios visuales` al formato del CHANGELOG.
3. Extender el guard existente [`scripts/verify-docs-update.js`](../../scripts/verify-docs-update.js):
   si un commit toca `default-theme.ts`, `typography-defaults.ts` o
   `typography.ts` sin tocar el CHANGELOG del paquete, falla con un mensaje que
   explique por qué. El guard ya corre en pre-commit para paquetes npm; esto
   es una regla más, no un mecanismo nuevo.

### Criterios de aceptación

- El CHANGELOG de beta.2 nombra el cambio de h2/h3.
- Un cambio de prueba en `typography-defaults.ts` sin entrada de CHANGELOG es
  rechazado por el guard.

## MIG-B3-06 — Gate de release beta.3 (P1)

### Historia

Como mantenedor, quiero probar que el guard del consumidor ya no hace falta,
antes de publicar.

### Implementación requerida

1. `fixtures/mig-b3-06-release/` que reproduzca el escenario real reportado:
   `uxdsl.theme.config.cjs` con overrides parciales y `externalTokens`, una
   entrada de tema y cuatro entradas de componente en CSS Modules, compiladas
   **solo** con el CLI, sin postprocesado propio.
2. Aserción central: **cero** declaraciones `:root` duplicadas y **cero**
   `#uxdsl-bp-meta` duplicados en el conjunto de salidas.
3. Aserción de breakpoints: los definidos únicamente en el archivo de tema
   aparecen en las media queries generadas.
4. Instalar desde las 5 tarballs coordinadas en un directorio aislado, como
   hace [`fixtures/mig-b2-05-release/run.js`](../../fixtures/mig-b2-05-release/run.js);
   reutilizar ese mecanismo, no reescribirlo.
5. Controles negativos: un token desconocido sigue fallando; un
   `--no-include-theme` sobre la entrada de tema produce CSS sin tokens y la
   prueba lo detecta.
6. **No publicar** como parte de esta story. La publicación y el dist-tag
   requieren aprobación explícita del dueño, igual que en beta.2.

### Criterios de aceptación

- El fixture pasa contra tarballs, sin resolución accidental al monorepo.
- El escenario del consumidor compila sin guard.

## Orden recomendado de implementación

1. **MIG-B3-01** — desbloquea al consumidor por sí sola; todo lo demás es
   mejora encima.
2. **MIG-B3-03** — independiente y barata; evita que la próxima migración
   tropiece con la misma colisión.
3. **MIG-B3-04** — depende solo de exports que ya existen.
4. **MIG-B3-02** — la de más superficie; se beneficia de que B3-01 haya
   estabilizado la precedencia.
5. **MIG-B3-05** — puede ir en cualquier momento; hacerla antes de publicar.
6. **MIG-B3-06** — cierra el release.

## Definition of done

- [ ] Toda opción documentada del plugin es alcanzable desde el CLI, con una
      prueba que lo garantice a futuro.
- [ ] `--no-include-theme` produce entradas de componente sin `:root` ni
      metadatos de breakpoints, y las referencias se siguen validando.
- [ ] La precedencia de breakpoints es única, documentada y probada; el CSS y
      `#uxdsl-bp-meta` no pueden divergir.
- [ ] Un archivo de tema con forma de build-config produce un warning
      accionable.
- [ ] `uxdsl theme`, `--diff` y `--strict` cubren introspección y procedencia.
- [ ] El CHANGELOG registra los cambios visuales de beta.2 y el guard impide
      que se repita la omisión.
- [ ] El fixture de release reproduce el escenario del consumidor sin guard.
- [ ] README, migration guide y CHANGELOG reflejan beta.3.
- [ ] La publicación queda fuera de la implementación y requiere aprobación
      explícita del dueño.
