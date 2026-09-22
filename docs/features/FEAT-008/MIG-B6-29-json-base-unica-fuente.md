# MIG-B6-29 — El JSON base es la única fuente de defaults

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | B — Tema base y salida correcta |
| Prioridad · Tamaño | P0 · L |
| Cierra | N-07, N-08. Es la raíz de UX-01, UX-08, UX-09 y de la contradicción de palette de UX-21 |
| Depende de | MIG-B6-15 para integrar el cambio acotado de fuentes en index. Inventario/extracción JSON y contraste pueden prepararse antes; decisiones del dueño resueltas |
| Bloquea | MIG-B6-12, MIG-B6-16, MIG-B6-17, MIG-B6-20, MIG-B6-26, MIG-B6-27, MIG-B6-28, MIG-B6-30 |
| Archivos | `packages/playground-nextjs/uxdsl.theme.base.json` (se mueve), `packages/postcss-uxdsl/src/default-theme.ts`, `packages/postcss-uxdsl/src/theme/`, nuevo `src/ds-runtime/contrast.ts`, `src/{language,edges,shadows,surfaces,buttons,inputs,foundations}.ts`, `src/ds-runtime/theme-generator.ts`, `src/ds-runtime.ts`, nuevo helper puro de fuentes, `scripts/generate-language-artifacts.js`, `scripts/verify-docs-update.js`, `packages/playground-nextjs/themes.js`, `AGENTS.md` |
| Coordinación | Dueño de los defaults de todos los motores, antes de 17. La integración de fuentes en `index.ts` se hace en un commit pequeño coordinado con 15; no toca `applyTypo`. 28 reutiliza el helper de fuentes, no lo duplica |

## Por qué

Decisiones D-1 y D-2: UXDSL entrega un tema base completo en JSON, organizado y
revisado por el equipo para cumplir accesibilidad, y cada proyecto sobrescribe sólo
lo que necesita. Hoy la librería no hace eso:

| Fuente de defaults | Dónde | Quién la usa |
| --- | --- | --- |
| JSON base completo: 14 familias de palette, 17 tags, `modes.dark`, `fonts.google` | `packages/playground-nextjs/uxdsl.theme.base.json` | Sólo el playground (`themes.js`, `src/app/api/generate/route.ts`). No está en ningún paquete npm |
| `DEFAULT_THEME`, "deliberately minimal": 4 familias de palette | `packages/postcss-uxdsl/src/default-theme.ts` | El compilador, para todo proyecto |
| Valores escritos en el código | `typography.ts:16` (`TYPOGRAPHY_DEFAULTS`), `typography-defaults.ts` (`DEFAULT_TYPOGRAPHY`, con `auto`) | `@ds-typo` (a cargo de MIG-B6-17) |
| Packs legacy `default-*.css`/`.uxdsl` | `packages/postcss-uxdsl/src/theme/` | Opt-in; el plugin de Vite los inyecta |

Consecuencias:

- La revisión de accesibilidad del JSON base no cubre lo que recibe un proyecto sin
  tema.
- Hay cuatro respuestas distintas a "qué claves existen" (origen de UX-01 y de la
  contradicción de UX-21).
- Los valores divergen (ver reproducción).

## Reproducción

**Divergencia de valores:**

```bash
npm --prefix packages/postcss-uxdsl run build
node -e "
const { DEFAULT_THEME } = require('./packages/postcss-uxdsl/dist/default-theme');
const base = require('./packages/playground-nextjs/uxdsl.theme.base.json');
for (const fam of Object.keys(DEFAULT_THEME.palette)) for (const [k, v] of Object.entries(DEFAULT_THEME.palette[fam]))
  if (base.palette[fam][k] !== v) console.log('palette.' + fam + '.' + k, 'librería', v, '≠ base', base.palette[fam][k]);
console.log('familias de palette: librería', Object.keys(DEFAULT_THEME.palette).length, '· base', Object.keys(base.palette).length);
"
```

Salida actual:

```
palette.surface.dark librería #dde5eb ≠ base #e2e8f0
palette.surface.contrast librería #102a43 ≠ base #0f172a
palette.neutral.main librería #e2e8f0 ≠ base #64748b
palette.neutral.dark librería #cbd5e1 ≠ base #334155
palette.error.main librería #c61625 ≠ base #dc2626
familias de palette: librería 4 · base 14
```

También difieren `fonts.families.ui`, `ui-2` y `code`.

**Contraste del JSON base (N-08).** Se calculó el ratio WCAG 2.x (luminancia
relativa) de los pares que emite `buttons.ts:13-15` en cada estado:

- `contained`: fondo `main`, texto `contrast`; en hover y selected, fondo `dark`;
- `outlined` y `flat`: texto `main` sobre la surface; en hover, texto `dark`.

El modo oscuro se calculó como lo compila `foundations.ts:55`: `modes.dark.palette`
encima de la base, clave por clave. Pares por debajo de 4.5:1:

| Modo | Pares | Ejemplos |
| --- | --- | --- |
| Claro | 6 | `tertiary` contained hover 2.77:1 (`#475569`/`#000000`); `tertiary` outlined 2.56:1; `warning` outlined 3.19:1; `warning` outlined hover 4.29:1; `light` outlined 1.10:1; `light` outlined hover 1.23:1 |
| Oscuro | 16 | `success` contained hover 2.30:1 (`#14532d`/`#000000`); `info` 2.78:1; `error` 3.25:1; `secondary` 3.48:1; `neutral` 2.77:1; `dark` outlined 1.04:1; … |

La causa principal del modo oscuro: 8 de las 11 familias de `modes.dark`
(`secondary`, `tertiary`, `success`, `info`, `warning`, `error`, `light`, `dark`)
redefinen sólo `main` y `contrast`. El hover conserva el `dark` del modo claro sobre
un fondo oscuro.

**Tamaño.** `generateThemeCss()` genera 23.910 bytes con el tema actual y 54.881 con
el JSON base (2.401 y 4.655 bytes con gzip).

## Decisiones del dueño (2026-09-19)

1. **UXDSL define un tema base por defecto: el JSON completo.** No se recorta a un
   subconjunto "mínimo".
2. **`fonts.google` (Inter) entra en el default.** Consecuencia: todo proyecto sin
   tema propio emite `@import url('https://fonts.googleapis.com/css2?family=Inter…')`.
   Es una petición externa a Google. Hay que documentarla en el README, con la forma
   de desactivarla: `fonts: { google: [] }` en el override. El merge reemplaza los
   arrays completos, así que la lista vacía la anula (comprobarlo con un test).
3. **`modes.dark` entra en el default.** Consecuencia: todo proyecto sin tema propio
   sigue la preferencia oscura del sistema operativo (`foundations.ts` emite
   `@media (prefers-color-scheme: dark)` y `:root[data-theme='dark']`). Por eso **el
   gate de contraste del modo oscuro es bloqueante**, igual que el claro. Hay que
   documentar cómo fijar el modo claro: `data-theme="light"` en `<html>`.
   Un override `modes: {}` no desactiva dark: los objetos se mezclan por clave.
   No documentar una receta de eliminación de modos sin contrato y test.
4. **Los colores los corrige el agente** (paso 8), con las reglas de abajo. El dueño
   revisa los cambios en el PR.

## Implementación

1. Mover el JSON base a `packages/postcss-uxdsl/src/theme/base.json`. Queda
   exportado como `postcss-uxdsl/theme/base.json`, porque `package.json` ya mapea
   `./theme/*` a `./src/theme/*`.
2. Todo el JSON base entra en el default, incluidos `fonts.google` y `modes.dark`
   (decisiones 1 a 3). Sólo sale lo que dependa del entorno del playground, si lo
   hay. Anotar en el PR qué se dejó fuera y por qué.
3. `DEFAULT_THEME` pasa a ser el JSON, con deep-freeze, sin valores escritos a mano
   en TypeScript. `getDefaultTheme()` y `resolveTheme()` mantienen su contrato,
   incluida la normalización de spacing. `DEFAULT_TYPOGRAPHY` deja de alimentar a
   `DEFAULT_THEME`; MIG-B6-17 elimina sus fallbacks de consumo.
   **Completar las siete familias que faltan en el JSON actual:** `densities`,
   `borders`, `radii`, `shadows`, `surfaces`, `buttons`, `inputs`. Extraer los mapas
   `DEFAULT_*` y las dependencias gray desde sus motores; también los breakpoints
   deben derivarse del JSON. Exportar vistas congeladas para mantener APIs, sin
   circularidades entre JSON, resolver y motores. No importar el resolver desde
   el módulo de datos. Los keywords de sintaxis (`pill`, `circle`) y la mecánica
   nativa de controles no son presets editables: enumerar esas excepciones.
   Preservar defaults < legacy de esta compilación < override explícito por campo:
   pasar un tema resuelto como si todo fuera override no debe tapar packs legacy.
   Probar además los helpers de familia usados solos, y copias sin mutación compartida.
4. Playground:
   - `themes.js` importa la base desde `postcss-uxdsl/theme/base.json` y mezcla su
     propio override;
   - se borra `packages/playground-nextjs/uxdsl.theme.base.json`;
   - `src/app/api/generate/route.ts` usa la misma fuente.
5. `theme-manifest.json` se genera desde el JSON base con
   `scripts/generate-language-artifacts.js`:
   - `tokens.paletteFamilies` son las claves reales;
   - `defaults.files` no apunta a archivos inexistentes (hoy `motion` →
     `default-motion.css`);
   - los packs legacy quedan marcados como deprecados.
6. Packs legacy: agregar un aviso de deprecación en su cabecera y en el README. No
   borrarlos en beta.6, porque hay proyectos que los importan explícitamente.
   MIG-B6-20 deja de inyectarlos en Vite. Regenerarlos desde la misma fuente;
   deprecar no autoriza mantener un segundo mapa ni cambiar su precedencia.
7. **Gate de accesibilidad.** Crear `src/ds-runtime/contrast.ts` con
   `checkThemeContrast(effectiveTheme)`, exportada: MIG-B6-16 la usa para
   `uxdsl theme --contrast`.
   - Los pares se derivan de las definiciones reales (`buttons.ts`, `surfaces.ts`,
     `inputs.ts`, con texto, placeholder y bordes), no de una lista escrita a mano.
   - Se evalúa el modo claro y, si existe, `modes.dark` mezclado clave por clave.
   - Umbrales: 4.5:1 para texto normal y 3:1 para los bordes que delimitan controles
     (WCAG 1.4.11).
   - Se resuelven las referencias `color(x.y)` y `var(--uxdsl__…)` del propio tema.
     Si un valor no se puede resolver a un color, el gate falla: no lo ignora.
   - Definir un contexto reproducible: cada rol sobre `surface.main`, con tone
     sólo para familias compatibles, todos sus estados emitidos y cada intervalo
     responsive. Componer transparencia/alpha y foreground heredado sobre ese fondo;
     resolver `var()` con fallbacks y detectar ciclos. Incluir selected, placeholder
     y focus cuando el motor los define. No inventar CSS que el motor no emite.
   - Colores no resolubles se reportan como `unresolved` y hacen fallar el chequeo,
     no como ratio cero ni como excepción automática. Registrar entorno/fondo;
     este chequeo no certifica un DOM arbitrario ni toda la accesibilidad.
     Derivar contexto también para opacity/disabled: documentar estados exentos
     del umbral normativo y reportarlos aparte; no alterar colores de controles
     inactivos para satisfacer un requisito inventado.
   - Excepciones en `src/theme/base.contrast-exceptions.json`: id, modo, rol,
     tone, estado, par, intervalo/fondo, valores resueltos y motivo. Coincidencia
     exacta: ninguna excepción de base se aplica a valores alterados por un override.
     Una excepción obsoleta o duplicada falla en CI. Reportar excepciones separadas
     de pares aprobados. `passed` significa cero fallos no exceptuados; no significa
     que todos los pares cumplan. Listar cada excepción incluso cuando passed=true.
   - Exportar reporte tipado compartido con 16: `passed`, `failures`, `exceptions`;
     cada fallo incluye `mode`, `family`, `component`, `state`, `pair`, `background`,
     `breakpoint`, `ratio` (null si unresolved), `required` y `reason`.
8. **Colores (decisión 4: los corrige el agente).** Reglas para preservar la
   intención del diseño:
   - **Cambio mínimo, en OKLCH.** Conservar tono (H) y croma (C) y mover sólo la
     luminosidad (L), en pasos de 0.01, hasta pasar el umbral con un margen mínimo
     (≥ 4.6:1 para texto y ≥ 3.1:1 para bordes). Buscar en ambas direcciones y elegir
     el menor cambio válido. Medir de nuevo sobre el hex final redondeado. Si sale
     del gamut sRGB, reducir C lo mínimo con algoritmo determinista y registrar la
     desviación; no recortar canales silenciosamente ni prometer H/C idénticos.
   - **Qué se toca primero:** las variantes de estado (`dark`) y `contrast`. `main`
     sólo cambia si no hay `contrast` (blanco o negro) que cumpla con él, porque
     `main` es la identidad de la marca. Evaluar todos los pares del rol juntos:
     mejorar contained no garantiza outlined. Si las restricciones no tienen
     solución, registrar combinación no soportada y motivo; no oscilar ajustes.
   - **Modo oscuro:** las 8 familias de `modes.dark` que hoy sólo redefinen `main` y
     `contrast` (`secondary`, `tertiary`, `success`, `info`, `warning`, `error`,
     `light` y `dark`) reciben su propio `dark` (el tono de hover) calculado con la
     misma regla, en vez de heredar el del modo claro.
   - **Excepciones sólo con justificación.** Un par imposible por la naturaleza del
     rol (por ejemplo, `light` outlined sobre una surface clara, 1.10:1, porque `light`
     es un rol de fondo y no de texto) va a
     `base.contrast-exceptions.json` con su motivo, y la documentación dice que esa
     combinación no está soportada.
   - **Tabla en el PR:** familia, modo, variante, antes, después, ratio antes y ratio
     después. El dueño la aprueba en la revisión; si algún cambio no le convence, se
     ajusta en el mismo PR.
9. **Fuentes en un solo motor.** Extraer un helper puro que codifique Google Fonts
   preservando separadores css2 (`:`, `@`, `;`, comas), espacios como `+` y escapado
   seguro del resto. PostCSS y `generateThemeCss` emiten los mismos imports al
   principio del CSS cuando corresponde emitir tema; lista vacía no emite ninguno.
   No ejecutar fetch desde el compilador. 30 retira la gestión duplicada de links
   del playground. Cubrir varias familias, caracteres escapados y repetición de
   compilación; el browser bundle no importa `fs` ni el cargador de config.
10. Agregar el JSON base (y el archivo de excepciones) a `VISUAL_DEFAULT_FILES` en
   `scripts/verify-docs-update.js:49`, para que todo cambio exija CHANGELOG.

## Fuera de alcance

- Cambiar la semántica del merge: sigue siendo por clave (D-1).
- La emisión de `@ds-typo` (MIG-B6-17) y `applyTheme` (MIG-B6-30).
- Borrar los packs legacy.

## Pruebas

- `test/default-theme.test.js`: `resolveTheme(undefined)` es igual, en profundidad,
  al JSON base final publicado. Las exclusiones del playground se hacen antes de
  publicar ese JSON, no como excepciones del resolver. Adaptar aserciones que fijaban
  valores del tema mínimo.
- `test/base-theme-contrast.test.js`: el gate (paso 7), siempre en claro y oscuro,
  todos los roles/estados/intervalos; una regresión de cada modo debe fallar.
- `test/contrast.test.js`: unidades de `checkThemeContrast`. Casos: pares conocidos
  (`#ffffff`/`#000000` = 21:1), referencias `color()` resueltas y un valor sin
  resolver que hace fallar el gate. Añadir alpha/transparencia, fallbacks, ciclos,
  excepciones exactas, override que invalida una excepción y redondeo final.
- `node scripts/generate-language-artifacts.js --check` pasa con el manifiesto
  regenerado.
- Defaults: las siete familias extraídas coinciden con sus mapas anteriores salvo
  cambios visuales declarados; helpers aislados, compilaciones consecutivas y
  precedencia defaults/legacy/JSON conservan el contrato. Congelación profunda.
- Fuentes: igualdad build/runtime, lista vacía, múltiples familias; fuentes/modos
  se completan con la prueba de navegador de 30. JSON público presente en tarball.
- Playground: `npm --prefix packages/playground-nextjs run build` compila, y
  `scripts/test-theme-inheritance.cjs` pasa.

## Documentación

- `packages/postcss-uxdsl/README.md`: la sección de defaults describe el JSON base,
  cómo sobrescribirlo, qué certifica el gate y qué no (un override del proyecto no
  queda certificado; D5 de FEAT-007).
- `AGENTS.md`, "Build time, runtime and one source of truth": reemplazar "The Next.js
  playground stores shared configuration in `uxdsl.theme.base.json`" por la nueva
  ubicación.
- CHANGELOG beta.6 con `### Visual changes`. Incluir una tabla antes/después por
  token para proyectos sin tema, más los colores corregidos por contraste.
- `packages/postcss-uxdsl/docs/migration.md`: una receta para fijar en el override
  los valores de beta.5 que se quieran conservar.

## Criterios de aceptación

- [x] Existe una sola fuente de defaults: el JSON base dentro de `postcss-uxdsl`, y
      no quedan valores de diseño literales en `src/` fuera de él. Excepción: los que
      MIG-B6-17 retira, si todavía no se integró, y los keywords/mecanismos
      no configurables enumerados en el inventario. **(las siete familias antes
      hardcodeadas —densities/borders/radii/shadows/surfaces/buttons/inputs— y
      colors/fonts/breakpoints/spacing/palette/modes/typography_details ahora
      derivan todas de `theme/base.json`; `typography-defaults.ts` queda como
      la única excepción explícita, sin uso, tal como permite este criterio)**
- [x] `resolveTheme(undefined)` es igual, en profundidad, al JSON base.
      **(test dedicado: `deepEqual(resolveTheme(undefined), require('theme/base.json'))`)**
- [x] El playground consume la base desde el paquete.
- [ ] El gate de contraste pasa en claro **y en oscuro** (bloqueante, porque
      `modes.dark` es default), o cada excepción está declarada con su motivo.
      **(el gate mismo —`checkThemeContrast`— ya existe, se verificó
      exhaustivamente y reproduce con exactitud los ratios de la propia
      ficha (2.77:1, 3.19:1, 1.10:1) — ver fase 2 en "Registro de
      implementación y evidencia". Pero `report.passed` sigue en `false`
      contra el JSON base real: la corrección de color de la fase 3 es lo
      que falta para que este criterio se cumpla, no la construcción del
      gate. No marcado por intención — sería falso afirmar que "pasa"
      cuando el propio reporte dice que no)**
- [ ] Los cambios de color siguen las reglas del paso 8 y la tabla está en el PR.
      **(fuera de esta entrega, misma razón — ver "Límites y seguimiento")**
- [x] README: la petición a Google Fonts y cómo desactivarla (`fonts: { google: [] }`),
      y el modo oscuro automático y cómo fijar el claro. Ambos tienen test.
- [x] El manifiesto no apunta a archivos inexistentes.
      **(sin cambio de esta historia; ya lo cubre MIG-B6-28. `tokens.paletteFamilies`
      además se corrigió aquí para listar las 14 claves reales, no una lista
      escrita a mano que omitía `text`/`divider`/`action`)**
- [x] CHANGELOG, README, `AGENTS.md` y migration guide están alineados **para el
      alcance de esta fase** — cada uno declara explícitamente qué queda pendiente
      (gate de contraste, corrección de color) para no sobre-afirmar.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm run generate:language && node scripts/generate-language-artifacts.js --check
npm --prefix packages/playground-nextjs run build
npm test
npm run verify:beta5
```

## Entrega

Repartida en fases por pedido explícito del dueño (alcance excepcionalmente
grande y de alto impacto para una sola entrega — ver "Registro de
implementación y evidencia"). Fase 1 (esta entrega, mecánica: mover el JSON,
extraer las siete familias, migrar el playground, sin tocar ningún valor de
color):

`feat(FEAT-008): MIG-B6-29 (fase 1/4) - theme/base.json is the single source for every engine default`

Fase 2 (motor de contraste `checkThemeContrast`), esta entrega:

`feat(FEAT-008): MIG-B6-29 (fase 2/4) - the accessibility contrast gate (checkThemeContrast)`

Fases pendientes, cada una su propio commit cuando se retome esta historia:
fase 3 (corrección de colores según las reglas del paso 8), fase 4 (helper de
fuentes de Google + alineación final de CHANGELOG/README/AGENTS.md/migration.md).

## Registro de implementación y evidencia

Estado de esta revisión documental: **Fases 1 y 2 de 4 implementadas y
verificadas localmente** en `feat/feat-008-beta6-plan` (fase 1: mover el
JSON, extraer las siete familias, migrar el playground; fase 2: el motor de
contraste `checkThemeContrast` y su suite de pruebas — sin corrección de
color, explícitamente diferida a la fase 3 por pedido del dueño dado el
tamaño y el impacto excepcionales de esta historia). Integración a `main`
pendiente.

### Fase 1/4 — mover el JSON base, extraer las siete familias

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `7d4d70d` (2026-09-21). Entrega: `a078c51` en `feat/feat-008-beta6-plan`. Corrección de revisión (bug real reportado por el dueño en vivo, ver Límites (9)): `fe23608`. PR pendiente de abrir |
| Reproducción antes del cambio | Sobre `7d4d70d`, exactamente el script de la propia ficha: `node -e "..."` comparando `DEFAULT_THEME` contra `uxdsl.theme.base.json` dio la salida documentada en "Reproducción" (5 valores de palette divergentes, `familias de palette: librería 4 · base 14`); `fonts.families.ui`/`ui-2`/`code` también divergían. Adicionalmente encontrado durante la implementación (no en la reproducción original): el `uxdsl.css` COMPILADO real del playground ya tenía `--uxdsl__font__ui-2: Roboto, "Helvetica Neue", Arial, sans-serif` filtrado desde el `DEFAULT_THEME` mínimo de la librería — el propio tema del playground nunca declaró `ui-2`, así que esa variable no reflejaba ninguna decisión de diseño real, sólo la divergencia de defaults que esta historia corrige (evidencia concreta, no sólo teórica, del problema que describe "Por qué"). 2026-09-21 |
| Criterio → regresión | "Una sola fuente, sin valores literales fuera del JSON (salvo excepción)" → siete `DEFAULT_*` (`language.ts`, `edges.ts`×2, `shadows.ts`, `surfaces.ts`, `buttons.ts`, `inputs.ts`) ahora leen de `BASE_THEME` (`src/base-theme.ts`); verificado por type-check + build + que ningún test que fijaba valores antiguos siga en verde por casualidad. "`resolveTheme(undefined)` igual en profundidad al JSON" → `test/default-theme.test.js`: "resolveTheme(undefined) is deep-equal to theme/base.json, the literal acceptance criterion" (`assert.deepEqual` real, no aproximado). "Playground consume la base desde el paquete" → `packages/playground-nextjs/themes.js` + `packages/playground-nextjs/scripts/test-theme-inheritance.cjs` (2/2) + build de producción completo. "README con Google Fonts/dark-mode + test" → `test/default-theme.test.js`: "DEFAULT_THEME requests Google Fonts by default; fonts: { google: [] } opts out" y "DEFAULT_THEME follows the OS dark-mode preference by default; data-theme=\"light\" pins light". "Manifiesto sin rutas inexistentes" → sin cambio de esta historia (MIG-B6-28); `tokens.paletteFamilies` corregido aquí, sin test dedicado nuevo (es un valor derivado trivial, cubierto indirectamente por `generate-language-artifacts.js --check`). Bug de precedencia legacy-vs-default encontrado y corregido → 5 tests ya existentes (`shadows.test.js`, `surfaces.test.js` uno cada uno, más los de buttons/inputs vía `rawTheme`) siguen en verde tras el fix, más un test nuevo para `density` (`unified-engine.test.js`, el que empieza "a legacy density-\<n\> for an already-built-in key wins over DEFAULT_DENSITIES"), el único de los seis sin cobertura previa |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, TypeScript 5.6.3 (`resolveJsonModule` habilitado en `packages/postcss-uxdsl/tsconfig.json`, verificado empíricamente antes de usarlo que `tsc` copia el `.json` importado a `dist/`), desde el root del monorepo: `npm --prefix packages/postcss-uxdsl run build` (exit 0), `node --test packages/postcss-uxdsl/test/*.test.js` (exit 0, 255/255 — +5 sobre la base: 1 de densidad legacy, 4 de default-theme.test.js), `npm run generate:language && node scripts/generate-language-artifacts.js --check` (exit 0), `npm test` (exit 0, todas las suites), `npm run verify:beta2`/`verify:beta3`/`verify:beta4`/`verify:beta5` (todos exit 0), `npm run verify:consumer-fixture` (exit 0), `npm run verify:vscode-extension` (exit 0), `npm --prefix packages/playground-nextjs run build` (build de producción completo, OK, corrido varias veces tras cada cambio relevante) |
| Resultado después / control negativo | `resolveTheme(undefined)` deep-equal a `theme/base.json` (test dedicado). `getToneFamilies(DEFAULT_THEME.palette)` pasa de `['primary','surface']` a 11 familias — verificado además que el generador de la extensión VS Code (MIG-B6-26) recoge esto automáticamente: `generated-completions.ts` regenerado ahora lista 11 tonos para `ds-surface`/`ds-button`/`ds-input` sin ningún cambio de código en ese generador, confirmando la predicción de independencia de orden hecha en la evidencia de MIG-B6-26. Control negativo del bug de precedencia: `@theme { shadow-2: ... }` sin `theme.shadows` explícito ahora gana sobre `DEFAULT_THEME.shadows[2]` (antes del fix perdía); un `theme.shadows` explícito sigue ganando sobre la declaración legacy (verificado que la solución no invirtió la precedencia en el otro sentido). `border(1..5)` ahora resuelve contra el mismo `colors.gray` que el resto del tema (`#CBD5E1`/`#94A3B8`/`#64748B`/`#475569`), no un segundo gris independiente (`#d1d5db`/...). Receta de migración de beta.5 verificada con un test dedicado que fija literalmente el override documentado y compara contra los valores de beta.5 |
| Cambios visuales o API / migración | Cambio visual real y documentado extensamente en el CHANGELOG (ver su propia entrada "Visual"): 14 familias de palette en vez de 4 (10 nuevas, 4 con nuevo hex), `fonts.google` activo por defecto (petición real a Google Fonts), `modes.dark` activo por defecto (sigue preferencia del SO), `fonts.families` pierde `ui-2`, `colors.gray`/`border()` cambian de tono. Cambio de API interno, aditivo y sin romper el contrato público: `postcss-uxdsl/theme/base.json` ahora existe y es servible (ya cubierto por el `files` de MIG-B6-28); `DEFAULT_THEME`/`getDefaultTheme`/`resolveTheme` mantienen exactamente su firma y contrato. `packages/playground-nextjs/uxdsl.theme.base.json` eliminado (ruta pública de ese paquete, no de `postcss-uxdsl`). Sin cambio de comportamiento para ningún flag o contrato de `uxdsl-cli`/`uxdsl-core`/`vite-plugin-uxdsl`/`uxdsl-webpack-loader` (155+21+14+6 tests de esos paquetes, sin cambios, todos en verde) |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md` (sección "Zero-config defaults" reescrita con el JSON completo, Google Fonts, dark mode, gaps conocidos; nueva sección "Legacy opt-in packs (deprecated)"); `packages/postcss-uxdsl/CHANGELOG.md` (entrada extensa MIG-B6-29 con lista "Visual" y "Not yet done" explícita); `packages/postcss-uxdsl/docs/migration.md` (receta de fijado a beta.5, con la advertencia explícita de que `typography_details` no está cubierta y por qué, y la limitación documentada de que `modes.dark` no tiene receta de eliminación); `AGENTS.md` (sección "Build time, runtime and one source of truth" reescrita para la nueva ubicación del JSON, y la lista de "planned APIs, not shipped capabilities" actualizada para reflejar que el JSON empaquetado ya no está pendiente, sólo el gate de contraste/corrección de color) |
| AGENTS / guías / arquitectura | Actualizado (ver fila anterior) — es el propio contrato de arquitectura que gobierna esta sesión de trabajo, por lo que su precisión importa más que en una historia típica. No se tocó ninguna otra sección de `AGENTS.md` (Spacing/Palette/Breakpoints/Typography/Borders/Shadows/Surfaces/Buttons/Inputs siguen describiendo contratos que no cambiaron) |
| Límites y seguimiento | (1) **Historia repartida en 4 fases por decisión explícita del dueño**, dado su tamaño (P0·L, bloquea 6 fichas) y su impacto (cambia el tema por defecto de cada consumidor sin override propio) — categóricamente distinta de toda ficha anterior de esta sesión, que eran fixes de tooling acotados. Esta entrega es sólo la fase 1 (mecánica: mover JSON, extraer familias, migrar playground, sin decisiones de diseño). Fases 2-4 (gate de contraste, corrección de color según las reglas del paso 8, helper de fuentes de Google) quedan explícitamente sin hacer — los dos criterios de aceptación correspondientes quedan sin marcar arriba, no marcados por intención. (2) **Brecha de paridad build/runtime encontrada, no corregida**: `generateThemeCss()` (runtime/SSR) no emite el `@import` de Google Fonts en absoluto — sólo lo hace el plugin de PostCSS. Preexistente (nunca se probó en el camino zero-config porque `fonts.google` nunca fue parte del default antes de esta historia); ahora visible en el camino por defecto. Corregirlo es exactamente el alcance del paso 9 de esta misma ficha ("Fuentes en un solo motor"), asignado a la fase 4. (3) **Codificación de la URL de Google Fonts sin corregir**: `family=${font}` sin `encodeURIComponent` (el mismo hallazgo ya documentado en la evidencia de MIG-B6-28); el valor por defecto (`"Inter:wght@400;500;600;700"`, sin espacios) no lo dispara, pero un nombre de familia con espacio sí produciría una URL inválida. Mismo paso 9, misma fase 4. (4) **Gate de contraste y corrección de color no ejecutados**: ningún color del tema base fue verificado ni corregido por contraste WCAG en esta entrega — la propia reproducción de esta ficha documenta 6 pares fallando en claro y 16 en oscuro; siguen sin tocar. No se inventó una corrección apresurada de colores de producción sin el motor de contraste real que el paso 7 exige construir primero. (5) `default-colors.css`/`default-palette.css` (paleta legacy separada, más rica) llevan ahora un aviso de deprecación pero **no se regeneraron ni se tocó ningún valor propio** — son una paleta deliberadamente distinta, no una copia del JSON base, y esta ficha no decide reconciliarlas. (6) `typography-defaults.ts`/`TYPOGRAPHY_DEFAULTS` (en `typography.ts`) quedan sin uso pero sin eliminar, exactamente la excepción explícita que este criterio permite — su remoción y la reconciliación de qué campos de `@ds-typo` dejan de heredarse (`textTransform`/`textDecoration`/`fontStyle`/`marginBlockStart`/`marginBlockEnd`) es responsabilidad declarada de MIG-B6-17. (7) `route.ts` del playground (`src/app/api/generate/route.ts`), que esta ficha lista en "Archivos" como consumidor a migrar, en realidad no importa el tema base en ningún punto (es un endpoint de generación de temas vía LLM, sin lectura directa de `uxdsl.theme.base.json` ni de `themes.js`) — verificado con grep exhaustivo antes de asumir que necesitaba un cambio; no se le tocó nada porque no había nada que migrar, no por omisión. (8) `packages/playground-nextjs/scripts/audit-themes.mjs` tiene un `SyntaxError` real y preexistente (`Unexpected token 'const'`), sin relación con esta historia (sin diff en ese archivo, último commit real muy anterior a esta sesión) — no se intentó arreglar un script roto fuera de alcance. (9) **Bug real encontrado por el dueño en vivo, no por revisión propia**: `base-theme.ts` congelaba `theme/base.json` en el mismo objeto que `require()` cachea — y ese mismo archivo es también la exportación pública del paquete (`"./theme/*": "./src/theme/*"`), así que cualquier otro código que lo importe por esa ruta pública, incluido el propio `next.config.js` del playground (que alía `postcss-uxdsl/*` directo a su código fuente "para consumir el motor actual, no un dist local desactualizado"), recibía el mismo objeto ya congelado. El playground crasheaba al cargar (`TypeError: Cannot assign to read only property 'ui'`) en cuanto `ThemeContext.tsx` (cliente) mezclaba ese tema compartido y mutaba en el sitio un `fonts.families` no tocado por el override. Ninguna verificación de esta sesión lo detectó porque todas corrían contra `dist/` (un archivo físicamente distinto de `src/theme/base.json` bajo resolución normal de Node) — sólo una herramienta de bundling real que alía a `src/` (como hace el propio `next.config.js` del playground) colapsa ambos en el mismo objeto. Corregido congelando un clon independiente, nunca el módulo importado; test de regresión dedicado (`default-theme.test.js`, el que empieza "MIG-B6-29 (regression): freezing DEFAULT_THEME never freezes..."), confirmado que falla contra el código previo y pasa con el fix. No se pudo levantar un navegador real para reproducir el crash tal cual lo vio el dueño (sin Chromium disponible en este entorno, limitación ya documentada en otras fichas de esta sesión); la evidencia es el rastreo preciso del mecanismo end-to-end (archivo compartido exacto, componente exacto, línea exacta) más el test que reproduce la invariante subyacente, no una captura de un navegador real. |

### Fase 2/4 — el gate de contraste (`checkThemeContrast`)

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `1a98f37` (2026-09-21, HEAD de `feat/feat-008-beta6-plan` al iniciar esta fase). Entrega: commit siguiente en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | No hay bug preexistente que reproducir — el paso 7 pide construir el gate desde cero. La "reproducción" relevante de esta fase son los tres bugs reales encontrados y corregidos durante su propio desarrollo, cada uno detectado comparando la salida real del motor contra los números de referencia de la propia ficha ("Reproducción" arriba: 6 pares en claro / 16 en oscuro) en vez de confiar en que la primera versión fuera correcta: (a) el primer intento devolvía 7200 pares evaluados, 1000 "unresolved" y 3055 fallos — `inspectSurfaceTheme` nunca se incluía en los mapas de variables de Button/Input, aunque `buttonDeclarations`/`inputDeclarations` literalmente reutilizan `surfaceDeclarations` por debajo y referencian sus mismas variables `--uxdsl__surface__*`; corregido incluyéndolo en los tres mapas, lo que llevó "unresolved" a 0. (b) Aun así persistían ~106/131 fallos sólo-sin-tone frente a los 6/16 esperados, porque `border` (que casi nunca varía por tone) se re-reportaba una vez por cada una de las 12 familias de tone aunque el color resuelto fuera idéntico; corregido con una deduplicación por firma de color resuelto (`mode+family+component+state+pair+fg+bg`), que preserva casos donde el tone sí cambia el color real (el borde de `outlined`, o un color sintéticamente responsive en los tests) y sólo colapsa repeticiones genuinamente idénticas. (c) `border: 'none'` (rol `flat`, rol `underline`) se resolvía como transparente, se componía sobre el fondo ambiente sin cambiarlo, y `contrastRatio(fondo, fondo)` daba 1.00 — un "fallo" perfecto y sin sentido, porque no hay borde visible que evaluar; corregido con un `skip` explícito cuando el color de borde resuelto tiene alpha 0. Tras (a)+(b)+(c), filtrando sólo a pares sin tone: 5 fallos en claro / 14 en oscuro (vs. 6/16 de la ficha), y tres coincidencias exactas con ejemplos nombrados por la propia ficha: `tertiary` contained hover = 2.77:1, `warning` outlined = 3.19:1, `light` outlined = 1.10:1 — evidencia fuerte de que la resolución de color y la matemática WCAG del motor son correctas, no perseguido más allá porque el "6/16" de la ficha es explícitamente una muestra manual ilustrativa, no un total exhaustivo (de hecho incluye casos con tone, como `tertiary`/`warning`/`light`, así que un total exhaustivo con las 11 familias reales de tone —775 pares evaluados, 223 fallos— siendo mayor no contradice la ficha, la completa). Un cuarto bug, de compatibilidad de build y no de matemática de contraste, se documenta en la fila "Comandos y entorno" |
| Criterio → regresión | El criterio de aceptación correspondiente ("el gate pasa en claro y oscuro, o cada excepción está declarada") sigue sin marcarse — `report.passed` es `false` contra el JSON base real, honestamente, porque la fase 3 (corrección de color) todavía no corrió. Lo que esta fase sí evidencia es que **el gate mismo es real y correcto**: `test/contrast.test.js` (24 tests) cubre las unidades (`contrastRatio` con 21:1/1:1 exactos y monotonía, `parseLiteralColor` con los 4 anchos de hex + rgb/rgba/hsl/hsla + rechazo de `oklch()`/basura, `compositeOver`, `resolveExpression` con cadenas de `var()`, fallback, ciclos, `color-mix()`, shorthand de borde y `"none"`→transparente) y la integración contra un tema con un rol propio aislado (kebab-case, ya que `getSurfaceTokens`/control-engine validan `/^[a-z][a-z0-9-]*$/`): un rol obviamente correcto da cero fallos, uno obviamente incorrecto falla, una referencia irresoluble falla (nunca pasa en silencio), una excepción de coincidencia exacta suprime sólo lo que nombra, la misma excepción deja de aplicar en cuanto un override cambia el color resuelto, un id de excepción duplicado se reporta en `exceptionIssues`, el estado `disabled` se computa pero nunca bloquea, el modo oscuro sólo se evalúa cuando `theme.modes.dark` existe, y dos llamadas con el mismo tema dan el mismo reporte (determinismo). `test/base-theme-contrast.test.js` (9 tests) corre el gate contra el `resolveTheme()` real con el archivo de excepciones real: confirma `passed === false` con `exceptionIssues === []` (la única excepción es válida), que se evalúan ambos modos, que cada breakpoint configurado se resuelve genuinamente (test reescrito para no contradecir la deduplicación — ver "Límites"), que se cubren los roles/tones reales de Surface/Button/Input, fija los tres ratios exactos (2.77/3.19/1.10) con `toFixed(2)`, confirma que la única excepción declarada está justificada y no cubre de más, que una excepción inventada nunca suprime nada, y una regresión simulada (`primary.contrast` igual a `primary.main`) que el gate debe detectar |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, TypeScript 5.9.3, desde el root del monorepo: `npm --prefix packages/postcss-uxdsl run build` (exit 0), `node --test packages/postcss-uxdsl/test/*.test.js` (exit 0, **291/291** — +36 sobre la fase 1: 24 de `contrast.test.js`, 9 de `base-theme-contrast.test.js`, 2 de `es5-consumer-compat.test.js`, más 1 neto de ajustes), `npm test` (exit 0, 560 líneas `ok`, las dos únicas líneas con "Error:" en la salida completa son de rutas negativas ya existentes — watcher y `UXD_REFERENCE_MISSING` — no fallos reales), `npm run verify:beta2`/`verify:beta3`/`verify:beta4`/`verify:beta5` (los cuatro exit 0), `npm run verify:consumer-fixture` (exit 0), `npm run verify:vscode-extension` (exit 0), `npm --prefix packages/playground-nextjs run build` (build de producción completo, 35/35 páginas, "Compiled successfully", exit 0). **Bug de compatibilidad encontrado por este último comando, no por la suite propia del paquete**: la primera versión de `contrast.ts` usaba `Map<string, number>` con `for (const [k, v] of map)`; `packages/playground-nextjs/tsconfig.json` compila `contrast.ts` una segunda vez (vía su alias de `postcss-uxdsl/ds-runtime` a este mismo código fuente) bajo `target: "es5"` sin `downlevelIteration`, donde esa forma de iterar un `Map` no compila — el `tsc` propio del paquete (ES2019) nunca lo detecta. Corregido usando `Record<string, number>` + `Object.entries(...)`, igual que el resto de `src/` (confirmado por grep que ningún otro archivo del paquete itera un `Map`/`Set` con `for...of` directo). `test/es5-consumer-compat.test.js` (nuevo) fija esto como regresión local usando el compilador real de TypeScript con los ajustes exactos del playground, para no depender de correr el build completo cada vez; verificado manualmente que falla contra el código con el bug y pasa con el fix (revertido temporalmente, confirmado el fallo, restaurado, confirmado el paso) |
| Resultado después / control negativo | Ver "Reproducción antes del cambio" para los tres números exactos que coinciden con la ficha. Control negativo de excepciones: una excepción con el hex correcto suprime sólo su fallo exacto; la misma excepción con un hex distinto al resuelto no suprime nada (deja de aplicar, no lanza); un id duplicado aparece en `exceptionIssues` y hace `passed=false` aunque no haya fallos de color; una excepción que nunca coincidió con nada ("obsoleta") también aparece en `exceptionIssues`. Control negativo de la deduplicación: un tema sintético con un color genuinamente responsive (`xs(#ffffff) md(#000000)`) sí produce ≥2 entradas de breakpoint distintas en `checked`, probando que la deduplicación no oculta variación real, sólo repetición idéntica. Control negativo del estado `disabled`: aparece en `checked` con `exempt:true` incluso cuando su ratio numérico fallaría, pero nunca en `failures`. La única excepción real embarcada (`surface-outlined-light-tone-base-text-light-mode`, `palette.light` como texto sobre `outlined` en modo claro, 1.10:1) es exactamente el caso que la propia ficha nombra en "Por qué" del paso 8 — deliberadamente **no** extendida al caso mecánicamente idéntico del rol `flat` en claro (mismo 1.10, verificado) ni a su equivalente en oscuro (1.38, hex distinto): la ficha sólo nombra ese caso, ampliar la excepción por cuenta propia habría sido inventar una decisión de diseño que le corresponde al dueño en la fase 3 |
| Cambios visuales o API / migración | Sin cambios visuales: ningún color de `theme/base.json` se tocó en esta fase (eso es la fase 3). Cambio de API aditivo: nuevo export `checkThemeContrast(theme, { exceptions? })` desde `postcss-uxdsl/ds-runtime`, y nuevo archivo servible `postcss-uxdsl/theme/base.contrast-exceptions.json`. `report.passed` es honestamente `false` contra el tema real — no es un contrato roto, es el resultado correcto y esperado antes de la fase 3, documentado como tal en el CHANGELOG y en `AGENTS.md` para que nadie lo lea como una regresión |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md`: nueva sección "Accessibility contrast gate (checkThemeContrast)" (firma, ejemplo, qué umbrales aplica, de qué funciones reales deriva cada par, la exención de `disabled`, la semántica de coincidencia exacta/obsolescencia del archivo de excepciones, y un párrafo explícito de "qué no certifica" — no es una certificación de DOM real, el borde sólo se compara contra el fondo ambiente, no también contra el fondo propio del componente). `packages/postcss-uxdsl/CHANGELOG.md`: nueva entrada "phase 2 of 4" (con los tres ratios exactos, la excepción embarcada y su motivo, y el bug de compatibilidad ES5) encima de la entrada de fase 1 (renombrada "(phase 1 of 4)" para consistencia). `docs/migration.md` sin cambios en esta fase (nada que migrar: el gate es aditivo, no reemplaza ningún comportamiento previo) |
| AGENTS / guías / arquitectura | `AGENTS.md`: (1) el párrafo "Build time, runtime and one source of truth" ahora menciona que `checkThemeContrast(theme, {exceptions})` existe y que `theme/base.json` "is not yet corrected to pass it (MIG-B6-29 phase 3, still pending)"; (2) el párrafo de "planned APIs, not shipped capabilities" reescrito para reflejar que el JSON empaquetado y el gate de contraste ya están construidos, sólo la corrección de color (fase 3) y el helper de fuentes (fase 4) siguen pendientes, aclarando explícitamente que correrlo hoy reporta fallos reales y abiertos por diseño, no un bug del gate; (3) los dos avisos genéricos preexistentes sobre contraste (sección Colors/Palette: "A variant named `contrast` is not automatic accessibility validation..."; sección Buttons: "Maintain keyboard focus and validate actual contrast; no automatic guarantee.") ahora apuntan a `checkThemeContrast` como la herramienta real para esto, preservando la advertencia original de que igual hay que verificar |
| Límites y seguimiento | (1) **`report.passed=false` contra el tema real es el resultado correcto de esta fase, no un defecto** — el propio paso 7 de la ficha construye el gate; el paso 8 (corrección de color) es una fase distinta, todavía no hecha. El criterio de aceptación correspondiente sigue sin marcar arriba por esta misma razón. (2) **El borde sólo se evalúa contra el fondo ambiente (`palette.surface.main`), nunca también contra el fondo propio del componente** — una simplificación deliberada y documentada (cabecera del archivo, README, aquí): un borde es la frontera entre un componente y la página que lo rodea, y la ficha habla de "cada rol sobre `surface.main`" sin pedir explícitamente el doble chequeo interior/exterior. (3) **La excepción embarcada no se generalizó** al caso mecánicamente idéntico del rol `flat` (mismo 1.10:1 en claro) ni al equivalente en modo oscuro (1.38:1) — sólo se declaró el caso que la ficha nombra explícitamente; los otros quedan como fallos reales y abiertos, pendientes de que la fase 3 los corrija o el dueño decida explícitamente extender la excepción. (4) **Tres bugs de matemática/cobertura y uno de compatibilidad de build encontrados y corregidos durante el desarrollo de esta misma fase** (detalle completo en "Reproducción antes del cambio" y en "Comandos y entorno") — ninguno reportado por el dueño, los cuatro encontrados comparando la salida real contra los números de referencia de la propia ficha y contra el build de producción real del playground, siguiendo el mismo hábito que encontró el bug de congelación de la fase 1. (5) Los totales exhaustivos (775 pares evaluados, 223 fallos con las 11 familias reales de tone) son mayores que el "6/16" ilustrativo de la ficha; entendido como que el gate automático es más completo que el análisis manual preliminar de la ficha, no como una discrepancia — tres coincidencias exactas de ratio con ejemplos nombrados por la ficha lo confirman. (6) No se corrigió ningún color de producción en esta fase — sería exactamente el error que el paso 8 previene explícitamente ("no inventar una corrección apresurada... sin el motor de contraste real") |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
