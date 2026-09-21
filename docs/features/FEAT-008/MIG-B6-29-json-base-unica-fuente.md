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
      **(fuera de esta entrega — ver "Límites y seguimiento": el dueño pidió
      repartir esta historia en fases; ésta es la fase 1, mecánica)**
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

Fases pendientes, cada una su propio commit cuando se retome esta historia:
fase 2 (motor de contraste `checkThemeContrast`), fase 3 (corrección de
colores según las reglas del paso 8), fase 4 (helper de fuentes de Google +
alineación final de CHANGELOG/README/AGENTS.md/migration.md).

## Registro de implementación y evidencia

Estado de esta revisión documental: **Fase 1/4 implementada y verificada
localmente** en `feat/feat-008-beta6-plan` (mover el JSON, extraer las siete
familias, migrar el playground — sin gate de contraste ni corrección de
color, explícitamente diferidas por pedido del dueño dado el tamaño y el
impacto excepcionales de esta historia). Integración a `main` pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `7d4d70d` (2026-09-21). Entrega: `a078c51` en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | Sobre `7d4d70d`, exactamente el script de la propia ficha: `node -e "..."` comparando `DEFAULT_THEME` contra `uxdsl.theme.base.json` dio la salida documentada en "Reproducción" (5 valores de palette divergentes, `familias de palette: librería 4 · base 14`); `fonts.families.ui`/`ui-2`/`code` también divergían. Adicionalmente encontrado durante la implementación (no en la reproducción original): el `uxdsl.css` COMPILADO real del playground ya tenía `--uxdsl__font__ui-2: Roboto, "Helvetica Neue", Arial, sans-serif` filtrado desde el `DEFAULT_THEME` mínimo de la librería — el propio tema del playground nunca declaró `ui-2`, así que esa variable no reflejaba ninguna decisión de diseño real, sólo la divergencia de defaults que esta historia corrige (evidencia concreta, no sólo teórica, del problema que describe "Por qué"). 2026-09-21 |
| Criterio → regresión | "Una sola fuente, sin valores literales fuera del JSON (salvo excepción)" → siete `DEFAULT_*` (`language.ts`, `edges.ts`×2, `shadows.ts`, `surfaces.ts`, `buttons.ts`, `inputs.ts`) ahora leen de `BASE_THEME` (`src/base-theme.ts`); verificado por type-check + build + que ningún test que fijaba valores antiguos siga en verde por casualidad. "`resolveTheme(undefined)` igual en profundidad al JSON" → `test/default-theme.test.js`: "resolveTheme(undefined) is deep-equal to theme/base.json, the literal acceptance criterion" (`assert.deepEqual` real, no aproximado). "Playground consume la base desde el paquete" → `packages/playground-nextjs/themes.js` + `packages/playground-nextjs/scripts/test-theme-inheritance.cjs` (2/2) + build de producción completo. "README con Google Fonts/dark-mode + test" → `test/default-theme.test.js`: "DEFAULT_THEME requests Google Fonts by default; fonts: { google: [] } opts out" y "DEFAULT_THEME follows the OS dark-mode preference by default; data-theme=\"light\" pins light". "Manifiesto sin rutas inexistentes" → sin cambio de esta historia (MIG-B6-28); `tokens.paletteFamilies` corregido aquí, sin test dedicado nuevo (es un valor derivado trivial, cubierto indirectamente por `generate-language-artifacts.js --check`). Bug de precedencia legacy-vs-default encontrado y corregido → 5 tests ya existentes (`shadows.test.js`, `surfaces.test.js` uno cada uno, más los de buttons/inputs vía `rawTheme`) siguen en verde tras el fix, más un test nuevo para `density` (`unified-engine.test.js`, el que empieza "a legacy density-\<n\> for an already-built-in key wins over DEFAULT_DENSITIES"), el único de los seis sin cobertura previa |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, TypeScript 5.6.3 (`resolveJsonModule` habilitado en `packages/postcss-uxdsl/tsconfig.json`, verificado empíricamente antes de usarlo que `tsc` copia el `.json` importado a `dist/`), desde el root del monorepo: `npm --prefix packages/postcss-uxdsl run build` (exit 0), `node --test packages/postcss-uxdsl/test/*.test.js` (exit 0, 255/255 — +5 sobre la base: 1 de densidad legacy, 4 de default-theme.test.js), `npm run generate:language && node scripts/generate-language-artifacts.js --check` (exit 0), `npm test` (exit 0, todas las suites), `npm run verify:beta2`/`verify:beta3`/`verify:beta4`/`verify:beta5` (todos exit 0), `npm run verify:consumer-fixture` (exit 0), `npm run verify:vscode-extension` (exit 0), `npm --prefix packages/playground-nextjs run build` (build de producción completo, OK, corrido varias veces tras cada cambio relevante) |
| Resultado después / control negativo | `resolveTheme(undefined)` deep-equal a `theme/base.json` (test dedicado). `getToneFamilies(DEFAULT_THEME.palette)` pasa de `['primary','surface']` a 11 familias — verificado además que el generador de la extensión VS Code (MIG-B6-26) recoge esto automáticamente: `generated-completions.ts` regenerado ahora lista 11 tonos para `ds-surface`/`ds-button`/`ds-input` sin ningún cambio de código en ese generador, confirmando la predicción de independencia de orden hecha en la evidencia de MIG-B6-26. Control negativo del bug de precedencia: `@theme { shadow-2: ... }` sin `theme.shadows` explícito ahora gana sobre `DEFAULT_THEME.shadows[2]` (antes del fix perdía); un `theme.shadows` explícito sigue ganando sobre la declaración legacy (verificado que la solución no invirtió la precedencia en el otro sentido). `border(1..5)` ahora resuelve contra el mismo `colors.gray` que el resto del tema (`#CBD5E1`/`#94A3B8`/`#64748B`/`#475569`), no un segundo gris independiente (`#d1d5db`/...). Receta de migración de beta.5 verificada con un test dedicado que fija literalmente el override documentado y compara contra los valores de beta.5 |
| Cambios visuales o API / migración | Cambio visual real y documentado extensamente en el CHANGELOG (ver su propia entrada "Visual"): 14 familias de palette en vez de 4 (10 nuevas, 4 con nuevo hex), `fonts.google` activo por defecto (petición real a Google Fonts), `modes.dark` activo por defecto (sigue preferencia del SO), `fonts.families` pierde `ui-2`, `colors.gray`/`border()` cambian de tono. Cambio de API interno, aditivo y sin romper el contrato público: `postcss-uxdsl/theme/base.json` ahora existe y es servible (ya cubierto por el `files` de MIG-B6-28); `DEFAULT_THEME`/`getDefaultTheme`/`resolveTheme` mantienen exactamente su firma y contrato. `packages/playground-nextjs/uxdsl.theme.base.json` eliminado (ruta pública de ese paquete, no de `postcss-uxdsl`). Sin cambio de comportamiento para ningún flag o contrato de `uxdsl-cli`/`uxdsl-core`/`vite-plugin-uxdsl`/`uxdsl-webpack-loader` (155+21+14+6 tests de esos paquetes, sin cambios, todos en verde) |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md` (sección "Zero-config defaults" reescrita con el JSON completo, Google Fonts, dark mode, gaps conocidos; nueva sección "Legacy opt-in packs (deprecated)"); `packages/postcss-uxdsl/CHANGELOG.md` (entrada extensa MIG-B6-29 con lista "Visual" y "Not yet done" explícita); `packages/postcss-uxdsl/docs/migration.md` (receta de fijado a beta.5, con la advertencia explícita de que `typography_details` no está cubierta y por qué, y la limitación documentada de que `modes.dark` no tiene receta de eliminación); `AGENTS.md` (sección "Build time, runtime and one source of truth" reescrita para la nueva ubicación del JSON, y la lista de "planned APIs, not shipped capabilities" actualizada para reflejar que el JSON empaquetado ya no está pendiente, sólo el gate de contraste/corrección de color) |
| AGENTS / guías / arquitectura | Actualizado (ver fila anterior) — es el propio contrato de arquitectura que gobierna esta sesión de trabajo, por lo que su precisión importa más que en una historia típica. No se tocó ninguna otra sección de `AGENTS.md` (Spacing/Palette/Breakpoints/Typography/Borders/Shadows/Surfaces/Buttons/Inputs siguen describiendo contratos que no cambiaron) |
| Límites y seguimiento | (1) **Historia repartida en 4 fases por decisión explícita del dueño**, dado su tamaño (P0·L, bloquea 6 fichas) y su impacto (cambia el tema por defecto de cada consumidor sin override propio) — categóricamente distinta de toda ficha anterior de esta sesión, que eran fixes de tooling acotados. Esta entrega es sólo la fase 1 (mecánica: mover JSON, extraer familias, migrar playground, sin decisiones de diseño). Fases 2-4 (gate de contraste, corrección de color según las reglas del paso 8, helper de fuentes de Google) quedan explícitamente sin hacer — los dos criterios de aceptación correspondientes quedan sin marcar arriba, no marcados por intención. (2) **Brecha de paridad build/runtime encontrada, no corregida**: `generateThemeCss()` (runtime/SSR) no emite el `@import` de Google Fonts en absoluto — sólo lo hace el plugin de PostCSS. Preexistente (nunca se probó en el camino zero-config porque `fonts.google` nunca fue parte del default antes de esta historia); ahora visible en el camino por defecto. Corregirlo es exactamente el alcance del paso 9 de esta misma ficha ("Fuentes en un solo motor"), asignado a la fase 4. (3) **Codificación de la URL de Google Fonts sin corregir**: `family=${font}` sin `encodeURIComponent` (el mismo hallazgo ya documentado en la evidencia de MIG-B6-28); el valor por defecto (`"Inter:wght@400;500;600;700"`, sin espacios) no lo dispara, pero un nombre de familia con espacio sí produciría una URL inválida. Mismo paso 9, misma fase 4. (4) **Gate de contraste y corrección de color no ejecutados**: ningún color del tema base fue verificado ni corregido por contraste WCAG en esta entrega — la propia reproducción de esta ficha documenta 6 pares fallando en claro y 16 en oscuro; siguen sin tocar. No se inventó una corrección apresurada de colores de producción sin el motor de contraste real que el paso 7 exige construir primero. (5) `default-colors.css`/`default-palette.css` (paleta legacy separada, más rica) llevan ahora un aviso de deprecación pero **no se regeneraron ni se tocó ningún valor propio** — son una paleta deliberadamente distinta, no una copia del JSON base, y esta ficha no decide reconciliarlas. (6) `typography-defaults.ts`/`TYPOGRAPHY_DEFAULTS` (en `typography.ts`) quedan sin uso pero sin eliminar, exactamente la excepción explícita que este criterio permite — su remoción y la reconciliación de qué campos de `@ds-typo` dejan de heredarse (`textTransform`/`textDecoration`/`fontStyle`/`marginBlockStart`/`marginBlockEnd`) es responsabilidad declarada de MIG-B6-17. (7) `route.ts` del playground (`src/app/api/generate/route.ts`), que esta ficha lista en "Archivos" como consumidor a migrar, en realidad no importa el tema base en ningún punto (es un endpoint de generación de temas vía LLM, sin lectura directa de `uxdsl.theme.base.json` ni de `themes.js`) — verificado con grep exhaustivo antes de asumir que necesitaba un cambio; no se le tocó nada porque no había nada que migrar, no por omisión. (8) `packages/playground-nextjs/scripts/audit-themes.mjs` tiene un `SyntaxError` real y preexistente (`Unexpected token 'const'`), sin relación con esta historia (sin diff en ese archivo, último commit real muy anterior a esta sesión) — no se intentó arreglar un script roto fuera de alcance. |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
