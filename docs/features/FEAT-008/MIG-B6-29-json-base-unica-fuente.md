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
      **(el gate mismo —`checkThemeContrast`— existe, se verificó
      exhaustivamente y reproduce con exactitud los ratios de la propia
      ficha (fase 2). La fase 3 corrigió 16 colores reales de `theme/base.json`
      siguiendo el paso 8 — ver fase 3 en "Registro de implementación y
      evidencia" para la tabla completa. `report.passed` sigue en `false`,
      a propósito: quedan 3 hallazgos reales de arquitectura/motor —no de
      color— sin excepción declarada (`placeholder` no sensible a tone;
      `light`/`dark`/`surface` usadas como tone de texto sobre su propia
      identidad de fondo; `warning.main` sin saturación suficiente para
      texto directo), cada uno con su recomendación de seguimiento en la
      evidencia. No marcado por intención — el dueño decidió explícitamente
      documentar estos tres como seguimiento en vez de forzar excepciones
      o cambios de color que no siguen las reglas del paso 8)**
- [x] Los cambios de color siguen las reglas del paso 8 y la tabla está en el PR.
      **(fase 3: 16 colores en `theme/base.json` + 10 en el tema `green` del
      playground + 15 en `slate`, cada uno movido sólo en L (OKLCH),
      preservando H/C, buscando en ambas direcciones, tocando `dark`/
      `contrast` antes que `main` — tabla completa con antes/después/ratio
      antes/ratio después en "Registro de implementación y evidencia".
      El paso 8 mismo prevé "si las restricciones no tienen solución,
      registrar combinación no soportada y motivo" — los 3 hallazgos que
      quedan abiertos son exactamente ese caso, no un incumplimiento de
      esta regla)**
- [x] README: la petición a Google Fonts y cómo desactivarla (`fonts: { google: [] }`),
      y el modo oscuro automático y cómo fijar el claro. Ambos tienen test.
- [x] El manifiesto no apunta a archivos inexistentes.
      **(sin cambio de esta historia; ya lo cubre MIG-B6-28. `tokens.paletteFamilies`
      además se corrigió aquí para listar las 14 claves reales, no una lista
      escrita a mano que omitía `text`/`divider`/`action`)**
- [x] CHANGELOG, README, `AGENTS.md` y migration guide están alineados **para las
      4 fases completas de esta historia** — fase 4 (paso 9, helper de fuentes de
      Google) cierra el último pendiente; cada documento ahora declara el estado
      real (gate de contraste corregido en lo posible, 3 hallazgos de motor
      documentados como seguimiento, no como color pendiente) en vez de
      sobre-afirmar o quedarse atrás de la entrega real.
- [x] **(paso 9)** Un solo motor construye la URL de Google Fonts; PostCSS y
      `generateThemeCss` emiten el mismo `@import` cuando corresponde emitir
      tema; lista vacía no emite ninguno; el compilador nunca ejecuta `fetch`.
      **(`encodeGoogleFontFamily`/`googleFontsImportUrls`, `src/fonts.ts`,
      exportadas desde `postcss-uxdsl/ds-runtime`; `test/fonts.test.js` verifica
      varias familias, caracteres que necesitan escape —incluido un hallazgo real,
      ver "Registro"—, y repetición de compilación, tal como pide este criterio)**

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

Fase 2 (motor de contraste `checkThemeContrast`):

`feat(FEAT-008): MIG-B6-29 (fase 2/4) - the accessibility contrast gate (checkThemeContrast)`

Fase 3 (corrección de colores según las reglas del paso 8):

`feat(FEAT-008): MIG-B6-29 (fase 3/4) - color correction per the story's own OKLCH rules`

Fase 4 (helper de fuentes de Google, paso 9 — cierra esta historia), esta entrega:

`feat(FEAT-008): MIG-B6-29 (fase 4/4) - the shared Google Fonts encoder (closes this story)`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Las 4 fases de esta historia están
implementadas y verificadas localmente** en `feat/feat-008-beta6-plan` (fase
1: mover el JSON, extraer las siete familias, migrar el playground; fase 2:
el motor de contraste `checkThemeContrast` y su suite de pruebas; fase 3: 16
colores de `theme/base.json` corregidos en OKLCH siguiendo las reglas del
paso 8, más los temas `green`/`slate` del playground — con 3 hallazgos
reales de arquitectura/motor documentados como seguimiento, no como color
pendiente; fase 4: el helper compartido de codificación de Google Fonts,
paso 9, cierra la historia). Integración a `main` pendiente.

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
| SHA base / entrega / PR | Base `1a98f37` (2026-09-21, HEAD de `feat/feat-008-beta6-plan` al iniciar esta fase). Entrega: `4917193` en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | No hay bug preexistente que reproducir — el paso 7 pide construir el gate desde cero. La "reproducción" relevante de esta fase son los tres bugs reales encontrados y corregidos durante su propio desarrollo, cada uno detectado comparando la salida real del motor contra los números de referencia de la propia ficha ("Reproducción" arriba: 6 pares en claro / 16 en oscuro) en vez de confiar en que la primera versión fuera correcta: (a) el primer intento devolvía 7200 pares evaluados, 1000 "unresolved" y 3055 fallos — `inspectSurfaceTheme` nunca se incluía en los mapas de variables de Button/Input, aunque `buttonDeclarations`/`inputDeclarations` literalmente reutilizan `surfaceDeclarations` por debajo y referencian sus mismas variables `--uxdsl__surface__*`; corregido incluyéndolo en los tres mapas, lo que llevó "unresolved" a 0. (b) Aun así persistían ~106/131 fallos sólo-sin-tone frente a los 6/16 esperados, porque `border` (que casi nunca varía por tone) se re-reportaba una vez por cada una de las 12 familias de tone aunque el color resuelto fuera idéntico; corregido con una deduplicación por firma de color resuelto (`mode+family+component+state+pair+fg+bg`), que preserva casos donde el tone sí cambia el color real (el borde de `outlined`, o un color sintéticamente responsive en los tests) y sólo colapsa repeticiones genuinamente idénticas. (c) `border: 'none'` (rol `flat`, rol `underline`) se resolvía como transparente, se componía sobre el fondo ambiente sin cambiarlo, y `contrastRatio(fondo, fondo)` daba 1.00 — un "fallo" perfecto y sin sentido, porque no hay borde visible que evaluar; corregido con un `skip` explícito cuando el color de borde resuelto tiene alpha 0. Tras (a)+(b)+(c), filtrando sólo a pares sin tone: 5 fallos en claro / 14 en oscuro (vs. 6/16 de la ficha), y tres coincidencias exactas con ejemplos nombrados por la propia ficha: `tertiary` contained hover = 2.77:1, `warning` outlined = 3.19:1, `light` outlined = 1.10:1 — evidencia fuerte de que la resolución de color y la matemática WCAG del motor son correctas, no perseguido más allá porque el "6/16" de la ficha es explícitamente una muestra manual ilustrativa, no un total exhaustivo (de hecho incluye casos con tone, como `tertiary`/`warning`/`light`, así que un total exhaustivo con las 11 familias reales de tone —775 pares evaluados, 223 fallos— siendo mayor no contradice la ficha, la completa). Un cuarto bug, de compatibilidad de build y no de matemática de contraste, se documenta en la fila "Comandos y entorno" |
| Criterio → regresión | El criterio de aceptación correspondiente ("el gate pasa en claro y oscuro, o cada excepción está declarada") sigue sin marcarse — `report.passed` es `false` contra el JSON base real, honestamente, porque la fase 3 (corrección de color) todavía no corrió. Lo que esta fase sí evidencia es que **el gate mismo es real y correcto**: `test/contrast.test.js` (24 tests) cubre las unidades (`contrastRatio` con 21:1/1:1 exactos y monotonía, `parseLiteralColor` con los 4 anchos de hex + rgb/rgba/hsl/hsla + rechazo de `oklch()`/basura, `compositeOver`, `resolveExpression` con cadenas de `var()`, fallback, ciclos, `color-mix()`, shorthand de borde y `"none"`→transparente) y la integración contra un tema con un rol propio aislado (kebab-case, ya que `getSurfaceTokens`/control-engine validan `/^[a-z][a-z0-9-]*$/`): un rol obviamente correcto da cero fallos, uno obviamente incorrecto falla, una referencia irresoluble falla (nunca pasa en silencio), una excepción de coincidencia exacta suprime sólo lo que nombra, la misma excepción deja de aplicar en cuanto un override cambia el color resuelto, un id de excepción duplicado se reporta en `exceptionIssues`, el estado `disabled` se computa pero nunca bloquea, el modo oscuro sólo se evalúa cuando `theme.modes.dark` existe, y dos llamadas con el mismo tema dan el mismo reporte (determinismo). `test/base-theme-contrast.test.js` (9 tests) corre el gate contra el `resolveTheme()` real con el archivo de excepciones real: confirma `passed === false` con `exceptionIssues === []` (la única excepción es válida), que se evalúan ambos modos, que cada breakpoint configurado se resuelve genuinamente (test reescrito para no contradecir la deduplicación — ver "Límites"), que se cubren los roles/tones reales de Surface/Button/Input, fija los tres ratios exactos (2.77/3.19/1.10) con `toFixed(2)`, confirma que la única excepción declarada está justificada y no cubre de más, que una excepción inventada nunca suprime nada, y una regresión simulada (`primary.contrast` igual a `primary.main`) que el gate debe detectar |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, TypeScript 5.9.3, desde el root del monorepo: `npm --prefix packages/postcss-uxdsl run build` (exit 0), `node --test packages/postcss-uxdsl/test/*.test.js` (exit 0, **291/291** — +36 sobre la fase 1: 24 de `contrast.test.js`, 9 de `base-theme-contrast.test.js`, 2 de `es5-consumer-compat.test.js`, más 1 neto de ajustes), `npm test` (exit 0, 560 líneas `ok`, las dos únicas líneas con "Error:" en la salida completa son de rutas negativas ya existentes — watcher y `UXD_REFERENCE_MISSING` — no fallos reales), `npm run verify:beta2`/`verify:beta3`/`verify:beta4`/`verify:beta5` (los cuatro exit 0), `npm run verify:consumer-fixture` (exit 0), `npm run verify:vscode-extension` (exit 0), `npm --prefix packages/playground-nextjs run build` (build de producción completo, 35/35 páginas, "Compiled successfully", exit 0). **Bug de compatibilidad encontrado por este último comando, no por la suite propia del paquete**: la primera versión de `contrast.ts` usaba `Map<string, number>` con `for (const [k, v] of map)`; `packages/playground-nextjs/tsconfig.json` compila `contrast.ts` una segunda vez (vía su alias de `postcss-uxdsl/ds-runtime` a este mismo código fuente) bajo `target: "es5"` sin `downlevelIteration`, donde esa forma de iterar un `Map` no compila — el `tsc` propio del paquete (ES2019) nunca lo detecta. Corregido usando `Record<string, number>` + `Object.entries(...)`, igual que el resto de `src/` (confirmado por grep que ningún otro archivo del paquete itera un `Map`/`Set` con `for...of` directo). `test/es5-consumer-compat.test.js` (nuevo) fija esto como regresión local usando el compilador real de TypeScript con los ajustes exactos del playground, para no depender de correr el build completo cada vez; verificado manualmente que falla contra el código con el bug y pasa con el fix (revertido temporalmente, confirmado el fallo, restaurado, confirmado el paso) |
| Resultado después / control negativo | Ver "Reproducción antes del cambio" para los tres números exactos que coinciden con la ficha. Control negativo de excepciones: una excepción con el hex correcto suprime sólo su fallo exacto; la misma excepción con un hex distinto al resuelto no suprime nada (deja de aplicar, no lanza); un id duplicado aparece en `exceptionIssues` y hace `passed=false` aunque no haya fallos de color; una excepción que nunca coincidió con nada ("obsoleta") también aparece en `exceptionIssues`. Control negativo de la deduplicación: un tema sintético con un color genuinamente responsive (`xs(#ffffff) md(#000000)`) sí produce ≥2 entradas de breakpoint distintas en `checked`, probando que la deduplicación no oculta variación real, sólo repetición idéntica. Control negativo del estado `disabled`: aparece en `checked` con `exempt:true` incluso cuando su ratio numérico fallaría, pero nunca en `failures`. La única excepción real embarcada (`surface-outlined-light-tone-base-text-light-mode`, `palette.light` como texto sobre `outlined` en modo claro, 1.10:1) es exactamente el caso que la propia ficha nombra en "Por qué" del paso 8 — deliberadamente **no** extendida al caso mecánicamente idéntico del rol `flat` en claro (mismo 1.10, verificado) ni a su equivalente en oscuro (1.38, hex distinto): la ficha sólo nombra ese caso, ampliar la excepción por cuenta propia habría sido inventar una decisión de diseño que le corresponde al dueño en la fase 3 |
| Cambios visuales o API / migración | Sin cambios visuales: ningún color de `theme/base.json` se tocó en esta fase (eso es la fase 3). Cambio de API aditivo: nuevo export `checkThemeContrast(theme, { exceptions? })` desde `postcss-uxdsl/ds-runtime`, y nuevo archivo servible `postcss-uxdsl/theme/base.contrast-exceptions.json`. `report.passed` es honestamente `false` contra el tema real — no es un contrato roto, es el resultado correcto y esperado antes de la fase 3, documentado como tal en el CHANGELOG y en `AGENTS.md` para que nadie lo lea como una regresión |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md`: nueva sección "Accessibility contrast gate (checkThemeContrast)" (firma, ejemplo, qué umbrales aplica, de qué funciones reales deriva cada par, la exención de `disabled`, la semántica de coincidencia exacta/obsolescencia del archivo de excepciones, y un párrafo explícito de "qué no certifica" — no es una certificación de DOM real, el borde sólo se compara contra el fondo ambiente, no también contra el fondo propio del componente). `packages/postcss-uxdsl/CHANGELOG.md`: nueva entrada "phase 2 of 4" (con los tres ratios exactos, la excepción embarcada y su motivo, y el bug de compatibilidad ES5) encima de la entrada de fase 1 (renombrada "(phase 1 of 4)" para consistencia). `docs/migration.md` sin cambios en esta fase (nada que migrar: el gate es aditivo, no reemplaza ningún comportamiento previo) |
| AGENTS / guías / arquitectura | `AGENTS.md`: (1) el párrafo "Build time, runtime and one source of truth" ahora menciona que `checkThemeContrast(theme, {exceptions})` existe y que `theme/base.json` "is not yet corrected to pass it (MIG-B6-29 phase 3, still pending)"; (2) el párrafo de "planned APIs, not shipped capabilities" reescrito para reflejar que el JSON empaquetado y el gate de contraste ya están construidos, sólo la corrección de color (fase 3) y el helper de fuentes (fase 4) siguen pendientes, aclarando explícitamente que correrlo hoy reporta fallos reales y abiertos por diseño, no un bug del gate; (3) los dos avisos genéricos preexistentes sobre contraste (sección Colors/Palette: "A variant named `contrast` is not automatic accessibility validation..."; sección Buttons: "Maintain keyboard focus and validate actual contrast; no automatic guarantee.") ahora apuntan a `checkThemeContrast` como la herramienta real para esto, preservando la advertencia original de que igual hay que verificar |
| Límites y seguimiento | (1) **`report.passed=false` contra el tema real es el resultado correcto de esta fase, no un defecto** — el propio paso 7 de la ficha construye el gate; el paso 8 (corrección de color) es una fase distinta, todavía no hecha. El criterio de aceptación correspondiente sigue sin marcar arriba por esta misma razón. (2) **El borde sólo se evalúa contra el fondo ambiente (`palette.surface.main`), nunca también contra el fondo propio del componente** — una simplificación deliberada y documentada (cabecera del archivo, README, aquí): un borde es la frontera entre un componente y la página que lo rodea, y la ficha habla de "cada rol sobre `surface.main`" sin pedir explícitamente el doble chequeo interior/exterior. (3) **La excepción embarcada no se generalizó** al caso mecánicamente idéntico del rol `flat` (mismo 1.10:1 en claro) ni al equivalente en modo oscuro (1.38:1) — sólo se declaró el caso que la ficha nombra explícitamente; los otros quedan como fallos reales y abiertos, pendientes de que la fase 3 los corrija o el dueño decida explícitamente extender la excepción. (4) **Tres bugs de matemática/cobertura y uno de compatibilidad de build encontrados y corregidos durante el desarrollo de esta misma fase** (detalle completo en "Reproducción antes del cambio" y en "Comandos y entorno") — ninguno reportado por el dueño, los cuatro encontrados comparando la salida real contra los números de referencia de la propia ficha y contra el build de producción real del playground, siguiendo el mismo hábito que encontró el bug de congelación de la fase 1. (5) Los totales exhaustivos (775 pares evaluados, 223 fallos con las 11 familias reales de tone) son mayores que el "6/16" ilustrativo de la ficha; entendido como que el gate automático es más completo que el análisis manual preliminar de la ficha, no como una discrepancia — tres coincidencias exactas de ratio con ejemplos nombrados por la ficha lo confirman. (6) No se corrigió ningún color de producción en esta fase — sería exactamente el error que el paso 8 previene explícitamente ("no inventar una corrección apresurada... sin el motor de contraste real") |

### Fase 3/4 — corrección de colores (paso 8)

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `91948d6` (2026-09-22, HEAD de `feat/feat-008-beta6-plan` al iniciar esta fase). Entrega: `d97ca95` en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | Sobre `91948d6`, `checkThemeContrast(resolveTheme(), {exceptions})` contra el `theme/base.json` de la fase 2 (sin corregir): 223 fallos (99 claro / 124 oscuro), la única excepción embarcada sigue válida. El propio algoritmo de corrección (nuevo, `scripts/fix-theme-contrast.js` + `scripts/lib/oklch.js`) encontró y corrigió tres bugs reales durante su propio desarrollo, cada uno detectado comparando la salida real contra un control independiente, nunca asumida correcta a la primera: (a) una búsqueda por bisección con puente exponencial (necesaria porque cada evaluación re-ejecuta el gate completo, ~150ms, y una búsqueda lineal de hasta 100 pasos por dirección se midió en minutos antes de esta optimización) puede perder una ventana válida y angosta cuando "el objetivo aún no se cumple" y "ya hay una regresión" caen en el mismo punto de muestreo exponencial — corregido bisecando cada condición por separado (`smallestStepWhere`) en vez de combinarlas antes de bisecar; verificado con `tertiary.dark` (claro), cuya ventana válida real es de sólo 3 pasos (L+0.09 a L+0.11 aprox.) entre "aún falla" (paso 8) y "ya rompe otra cosa" (paso 16). (b) Dos familias distintas del tema pueden compartir el mismo hex exacto por coincidencia (`light.dark` y `surface.dark`, ambos `#e2e8f0`); el propio gate deduplica por color resuelto sin importar el tone, así que sólo reporta una de las dos — al corregir una, la otra deja de coincidir y aparece por primera vez, indistinguible de una regresión real por firma exacta. Corregido comparando también por "forma sin tone + ratio redondeado": una firma nueva que coincide en ratio con una ya conocida no cuenta como regresión. (c) Forzar una corrección exclusivamente vía `main` cuando el único fallo real es que `palceholder` (`palette(neutral.dark)`, nunca sustituido por tone) no puede leerse sobre el fondo tonalizado, empuja `main` hacia blanco/negro puro — verificado en vivo: la primera corrección del tema `slate` del playground producía `success.main`, `warning.main`, `info.main` y `error.main` en modo oscuro casi blancos puros (p. ej. `#52e586` → `#f6fff8`), borrando la identidad de cada color. Corregido excluyendo los pares `placeholder` de la búsqueda de `main` (se documentan como hallazgo de arquitectura, no se fuerza un color para taparlos) — verificado que esto también *desbloquea* una corrección más pequeña y válida para `tertiary.main` en el tema base (antes fallaba al mezclar sus pares de texto, resolubles, con sus pares de `placeholder`, irresolubles vía `main`, en una sola búsqueda) |
| Criterio → regresión | "Los cambios de color siguen las reglas del paso 8 (OKLCH, cambio mínimo, dark/contrast antes que main, evaluar el rol completo) y la tabla está en el PR" → ver "Resultado después" para la tabla completa (16 colores en `theme/base.json`, 10 en `green`, 15 en `slate`); cada fila es un movimiento de sólo L en OKLCH, verificado con `scripts/lib/oklch.test.js` (6 tests: extremos blanco/negro, ida-y-vuelta hex↔OKLCH↔hex, monotonía de L, reducción de croma determinista). "El gate pasa o cada excepción está declarada" → sigue sin marcar (ver criterios de aceptación); `report.passed` es `false` a propósito, con los 3 hallazgos reales documentados abajo en vez de excepciones forzadas. Cada corrección aplicada se verificó libre de regresión con el propio `checkThemeContrast` real en cada paso candidato (nunca con un modelo propio de qué CSS produce el motor) — `test/base-theme-contrast.test.js` (existente, fase 2) se actualizó para el nuevo estado: `tertiary/contained/hover/text` (el ejemplo nombrado por la ficha, 2.77:1) ahora se verifica que YA NO falla (≥4.5:1 real, ~4.61:1), y `warning/outlined` y `light-tone/outlined` se verifican que siguen fallando en sus mismos ratios exactos (3.19:1, 1.10:1) — abiertos por diseño, no por omisión |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0. Herramienta nueva (mantenimiento, no API empaquetada): `node scripts/fix-theme-contrast.js <base\|green\|purple\|slate>` usa `scripts/lib/oklch.js` (conversión sRGB↔OKLCH, sólo para esta herramienta) y las funciones reales exportadas (`checkThemeContrast`, `resolveTheme`, `deepMergeTheme`, `contrastRatio` vía `postcss-uxdsl/dist/ds-runtime`) — nunca reimplementa resolución de color o CSS. Verificación final: `npm --prefix packages/postcss-uxdsl run build` (exit 0), `node --test packages/postcss-uxdsl/test/*.test.js` (exit 0, 291/291, sin tests nuevos esta fase — se actualizaron 3 aserciones en `base-theme-contrast.test.js` para el nuevo estado, ver "Criterio → regresión"), `node packages/playground-nextjs/scripts/test-theme-inheritance.cjs` (exit 0, 2/2), `npm test` (exit 0, 560 líneas `ok`), `npm run verify:beta2`/`verify:beta3`/`verify:beta4`/`verify:beta5` (exit 0), `npm run verify:consumer-fixture` (exit 0), `npm run verify:vscode-extension` (exit 0), `npm --prefix packages/playground-nextjs run build` (build de producción completo, OK) |
| Resultado después / control negativo | **Tabla completa (familia, modo, variante, antes, después, ratio antes, ratio después)** — `theme/base.json`: claro `surface.dark` `#e2e8f0`→`#8d929a` (borde propio vs. fondo ambiente 1.23→3.13), claro `tertiary.dark` `#475569`→`#68778c` (texto vs. este mismo color como fondo de hover 2.77→4.61, el ejemplo nombrado por la ficha), claro `tertiary.main` `#94a3b8`→`#68768a` (texto/borde directo vía tone `outlined`/`flat` vs. ambiente 2.56→4.62); oscuro `secondary.dark` `#be185d`→`#db3b74` (3.48→4.89), oscuro `surface.dark` `#000000`→`#606060` (borde propio vs. ambiente `#020617` 1.04→3.21), oscuro `tertiary.dark` `#68778c`→`#6b7a8f` (4.42→4.65, refinamiento fino, ya pasaba el umbral normativo de la propia guía pero no el margen adicional del paso 8), oscuro `success.dark` `#14532d`→`#4c875e` (2.30→4.93), oscuro `info.dark` `#075985`→`#3a7fae` (2.78→4.83), oscuro `error.dark` `#b91c1c`→`#dd443c` (3.25→4.97), oscuro `primary.main` `#c084fc`→`#ddbfff`, `secondary.main` `#f472b6`→`#ffb7d8`, `tertiary.main` `#94a3b8`→`#bccce2`, `success.main` `#4ade80`→`#52e586`, `info.main` `#38bdf8`→`#82d4ff`, `error.main` `#f87171`→`#ffb9b6`, `neutral.main` `#94a3b8`→`#c0cfe5` (estos 7: texto de `placeholder` —`neutral.dark`, sin cambiar— pasa de 1.75–4.35 a 4.62–4.70 sobre el fondo tonalizado de cada uno). Tema `green` (playground): claro `secondary.dark` `#F57C00`→`#b75b02`, `surface.dark` `#e7e5e4`→`#91908f`, `warning.main` `#f97316`→`#c05402`, `neutral.contrast` `#000000`→`#fcfcfc`; oscuro `secondary.dark` (nuevo, heredaba de la base) `#db3b74`→`#e6467d`, `surface.dark` `#0c0a09`→`#6a6766`, `tertiary.dark` (nuevo) `#6b7a8f`→`#77869b`, `success.dark` (nuevo) `#4c875e`→`#559067`, `info.dark` (nuevo) `#3a7fae`→`#478bbb`, `error.dark` (nuevo) `#dd443c`→`#e84e45`. Tema `slate` (playground): claro `surface.dark` `#DDE5EB`→`#8b9398`, `tertiary.main` `#BCCCDC`→`#677684`, `tertiary.contrast` `#102A43`→`#000000`, `warning.main` `#F59E0B`→`#a46802`, `warning.contrast` `#0B1220`→`#000000`, `neutral.main` `#E2E8F0`→`#8d929a`; oscuro `primary.dark` `#627D98`→`#7995b1`, `primary.contrast` `#102A43`→`#000b1c`, `secondary.dark` (nuevo) `→#f8578c`, `secondary.contrast` `#0B1220`→`#040917`, `surface.dark` `#0A1B2A`→`#627689`, `tertiary.dark` (nuevo) `→#8292a8`, `success.dark` (nuevo) `→#64a075`, `info.dark` (nuevo) `→#5397c8`, `error.dark` (nuevo) `→#fa5f54`. `default` y `purple` no necesitaron ningún cambio propio (ninguno sobrescribe `palette`; heredan la corrección de `theme/base.json` automáticamente — verificado, 172 fallos idénticos a la base antes de esta fase, 156 después). **Control negativo**: cada corrección se verificó regresión-libre contra el conjunto completo de pares ya evaluados (no sólo los que se intentaba arreglar) antes de aceptarse; el hallazgo (c) de arriba es exactamente ese control atrapando una corrección que habría "pasado" el gate a costa de destruir la identidad de 4 colores en `slate` — revertido y excluido de raíz, no sólo en ese tema. `report.exceptionIssues` se mantiene en `[]` para `theme/base.json` (la única excepción embarcada sigue exacta); al evaluar `green`/`slate` con esa misma excepción (cuyos valores resueltos son específicos de la base) aparece como "obsoleta" para esos temas porque su propio `light.main` difiere del de la base — comportamiento correcto del mecanismo de coincidencia exacta, no un defecto; por eso la comparación entre los 4 temas en esta ficha usa el conteo de fallos sin excepciones aplicadas (79/78 default y purple, 94/87 green, 68/98 slate), no `report.passed` |
| Cambios visuales o API / migración | Cambio visual real en el tema por defecto y en los temas `green`/`slate` del playground — 16+10+15 colores, cada uno documentado arriba con su antes/después y su ratio. Ninguna API cambia: `checkThemeContrast`, `resolveTheme`, `deepMergeTheme` mantienen su firma exacta; `scripts/fix-theme-contrast.js` y `scripts/lib/oklch.js` son herramientas de mantenimiento de este repositorio, no exports del paquete `postcss-uxdsl` — no aparecen en `ds-runtime`, no se documentan como API pública. `theme/base.json` sigue siendo válido contra todo el contrato de `resolveTheme`/`getDefaultTheme` (test dedicado de fase 1 sigue en verde) |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/CHANGELOG.md`: nueva entrada "phase 3 of 4" (antes de la de fase 2) con la tabla completa de colores corregidos y los 3 hallazgos no corregidos, cada uno con su recomendación de seguimiento. `AGENTS.md`: el párrafo "Build time, runtime and one source of truth" y el de "planned APIs, not shipped capabilities" actualizados para reflejar que la fase 3 ya corrió (ver commit); ninguna otra sección tocada. `docs/migration.md` sin cambios en esta fase — la receta de fijado a beta.5 (fase 1) no necesita mención de fase 3, ya que un proyecto que fija sus propios valores de beta.5 no recibe estos colores corregidos de todas formas |
| AGENTS / guías / arquitectura | Ver fila anterior — mismas dos secciones ya actualizadas en fases previas, ahora con el estado de fase 3 reflejado con precisión (ni "pendiente" ni "completo sin matices": corregido lo que las reglas del paso 8 permiten corregir, documentados los 3 casos que no) |
| Límites y seguimiento | (1) **Tres hallazgos reales de arquitectura/motor quedan abiertos, cada uno con su recomendación, no un color sin decidir**: **(a)** `inputs.*.base.placeholder` es una referencia literal a `palette(neutral.dark)` en las tres definiciones de rol de `theme/base.json`, la única propiedad de Surface/Input que el motor de control (`control-engine.ts`) nunca sustituye por tone (a diferencia de `bg`/`color`/`border`) — un solo gris no puede leerse a la vez sobre el fondo casi blanco (funciona hoy, sin tone) y sobre un fondo tonalizado saturado y a menudo oscuro (falla). Afecta el `placeholder` de `contained` tonalizado con casi cualquier familia de acento en modo claro (y con algunas en oscuro, según el tema — verificado en `slate`). Recomendación: dar a `placeholder` la misma sustitución por tone que ya reciben `bg`/`color`/`border`, en una historia dedicada al motor de Inputs, no en esta (que sólo corrige valores de color, no la composición de campos). **(b)** `light`, `dark` y `surface` son familias de identidad de fondo/lienzo (su `main`/`dark` deben permanecer casi blancos o casi negros para cumplir su función real de fondo) usadas explícitamente como `tone=` de texto/borde en `outlined`/`flat`/`underline`, lo que lee ese mismo valor directamente contra el fondo ambiente de la página — exactamente la misma clase de hallazgo que la única excepción ya embarcada (`light` como texto), que cubre sólo el caso literal que la ficha nombra; `light` como borde, `dark` como tone en modo oscuro y `surface` como tone en ambos modos quedan sin excepción. Recomendación: o bien excepcionar el patrón completo por familia tras revisión del dueño, o reconsiderar si estas tres familias deberían ser opciones válidas de `tone=` para roles que muestran texto. **(c)** `warning.main` (sólo en modo claro) no es suficientemente oscuro/saturado para leerse como texto/borde directo vía tone en `outlined`/`flat`/`underline`; corregirlo dentro de las reglas de esta misma ficha exigiría moverlo lo bastante como para perder su identidad de acento de advertencia reconocible, que la propia protección de `main` ("último recurso, identidad de marca") existe para evitar. Recomendación: excepción revisada por el dueño, o un re-elección deliberada de `warning.main` fuera del alcance de una pasada automática de cambio mínimo. (2) **La excepción embarcada es específica de los valores resueltos de `theme/base.json`**: al evaluar `green`/`slate` con ella, aparece como "obsoleta" (su `light.main` difiere del de la base) — comportamiento correcto y documentado del mecanismo de coincidencia exacta (ver "Resultado después"), pero significa que un proyecto real con su propio tema necesitaría su propia excepción si quiere excepcionar el mismo patrón para sus propios colores; fuera del alcance de esta ficha (que sólo corrige el tema por defecto y los temas de ejemplo del playground, no construye infraestructura de excepciones por proyecto — eso ya existe vía `{exceptions}` en `checkThemeContrast`, que MIG-B6-16 expone en la CLI). (3) **`scripts/fix-theme-contrast.js` no es determinista en el sentido de "un único resultado posible"**: cuando existen varias direcciones válidas (aclarar u oscurecer) se elige la de menor ΔL en valor absoluto, pero el orden de iteración de familias puede afectar qué combinación de fases A/B encuentra una solución primero en casos con dependencias cruzadas (verificado: una segunda pasada sobre la base ya corregida encontró una corrección adicional —`tertiary.main`— que la primera pasada no había encontrado, por la interacción con el hallazgo (c) de arriba; documentado y aplicado, no oculto). Se corrió cada tema hasta convergencia (pasadas repetidas hasta que ninguna produce cambios nuevos), no una sola pasada. (4) **El borde de un componente sigue evaluándose sólo contra el fondo ambiente** (simplificación ya documentada en la fase 2, sin cambios aquí). (5) No se tocó `light`/`light` (el campo `light` dentro de cada familia) en ningún caso — confirmado que ningún par verificado por el gate lee ese campo (sólo `main`/`dark`/`contrast` participan, vía sustitución de tone o referencia directa), así que no había nada que corregir ni que hubiera podido corregirse sin inventar un uso que el motor no emite. |

### Fase 4/4 — el helper compartido de Google Fonts (paso 9, cierra esta historia)

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `7b467d2` (2026-09-22, HEAD de `feat/feat-008-beta6-plan` al iniciar esta fase). Entrega: `11b9a78` en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | Sobre `7b467d2`: `src/index.ts` (el plugin de PostCSS) construía la URL con `` `https://fonts.googleapis.com/css2?family=${font}&display=swap` ``, una interpolación de plantilla sin ningún escapado — confirmado que una familia con espacio (p. ej. `"Open Sans:wght@400;700"`) producía un `@import` con un espacio literal, URL inválida; el valor por defecto (`"Inter:wght@400;500;600;700"`, sin espacio) no lo disparaba, por lo que el bug llevaba tiempo sin manifestarse en el camino zero-config. `generateThemeCss()` (`ds-runtime/theme-generator.ts`) no hacía referencia alguna a `theme.fonts` — confirmado leyendo el archivo completo (37 líneas) y con grep — así que un consumidor runtime/SSR de esa función nunca recibía el `@import`, sólo el plugin de PostCSS lo emitía. `packages/playground-nextjs/src/components/ThemeContext.tsx` ya tenía su propia segunda implementación independiente (`buildFontsHref`, líneas 101-108) precisamente para cubrir ese hueco del lado cliente — con su propio manejo parcial de espacios (`replace(/ /g, '+')`) pero sin escapado general. Ningún test existente cubría el caso con espacio ni comparaba la salida del plugin contra la de `generateThemeCss` |
| Criterio → regresión | "Un solo motor construye la URL; PostCSS y `generateThemeCss` emiten el mismo `@import`; lista vacía no emite ninguno; sin `fetch` en el compilador" → `test/fonts.test.js` (12 tests): `encodeGoogleFontFamily` preserva `:`/`@`/`;`/`,` sin escapar, convierte espacio en `+`, escapa con `%XX` cualquier otro carácter; comparación byte a byte de las URLs que emite el plugin compilado contra las que emite `generateThemeCss` para el mismo tema (idénticas, mismo orden); `googleFontsImportUrls([])`/`undefined` devuelve `[]`; guard de código fuente que confirma que `fonts.ts` nunca importa `fs`/`path`/`./config` ni llama a `fetch`. "Cubrir varias familias, caracteres escapados y repetición de compilación" → tests dedicados para múltiples familias con orden preservado, un nombre con espacio compilado por ambos caminos sin producir un espacio literal en la URL final, y dos compilaciones independientes de la misma fuente produciendo salida idéntica (`generateThemeCss` llamado dos veces, y el plugin compilando la misma fuente dos veces) |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0. `npm --prefix packages/postcss-uxdsl run build` (exit 0), `node --test packages/postcss-uxdsl/test/*.test.js` (exit 0, **303/303** — +12 sobre la fase 3: los 12 tests de `fonts.test.js`; `default-theme.test.js` reforzó una aserción existente sin agregar un test nuevo), `npm test` (exit 0, 578 líneas `ok`, +12 sobre la fase 3), `npm run verify:beta2`/`verify:beta3`/`verify:beta4`/`verify:beta5` (exit 0), `npm run verify:consumer-fixture` (exit 0), `npm run verify:vscode-extension` (exit 0), `npm --prefix packages/playground-nextjs run build` (build de producción completo, exit 0; `src/app/uxdsl.css` sin diff — la familia por defecto, `Inter:wght@400;500;600;700`, no tiene espacio ni caracteres a escapar, así que la salida es byte-idéntica antes y después del fix, como se esperaba) |
| Resultado después / control negativo | `encodeGoogleFontFamily('Open Sans:wght@400;700')` → `'Open+Sans:wght@400;700'`; `googleFontsImportUrls(['Inter:wght@400;700', 'Open Sans'])` → `['...family=Inter:wght@400;700&display=swap', '...family=Open+Sans&display=swap']`, orden preservado. **Hallazgo real encontrado escribiendo la propia suite de pruebas** (no reportado por el dueño): la primera versión de `encodeGoogleFontFamily` usaba `encodeURIComponent` como respaldo para "cualquier otro carácter" — pero `encodeURIComponent` deja sin escapar `` - _ . ! ~ * ' ( ) `` por especificación propia de JavaScript, y el valor resultante se incrusta en una cadena CSS `url('...')` con comillas simples en ambos consumidores: un apóstrofo sin escapar (p. ej. una familia hipotética `"O'Brien Sans"`) cierra esa cadena antes de tiempo y corrompe el CSS generado, no sólo produce una URL "fea". Confirmado en vivo: con la versión sin corregir, `postcss.parse()` sobre el CSS emitido para esa familia lanzaba un error de sintaxis; corregido reemplazando el respaldo por una función propia (`percentEncodeChar`) que escapa explícitamente `` ' ( ) ! ~ * `` sin depender de la lista de excepciones de `encodeURIComponent`. Test dedicado que compila con esa familia y confirma que `postcss.parse()` ya no lanza — verificado que el test falla contra el código previo (revertido temporalmente a `encodeURIComponent` puro) y pasa con el fix. Control negativo: `googleFontsImportUrls([])` y `googleFontsImportUrls(undefined)` devuelven `[]`, y `generateThemeCss({ fonts: { google: [] } })` no contiene `@import`, confirmando que la lista vacía sigue significando "ninguna", no "usar el default" |
| Cambios visuales o API / migración | Sin cambio visual: la familia por defecto (`Inter:wght@400;500;600;700`) no contiene ningún carácter afectado por el fix, confirmado por el `uxdsl.css` del playground sin diff. Cambio de API aditivo: nuevos exports `encodeGoogleFontFamily`/`googleFontsImportUrls` desde `postcss-uxdsl/ds-runtime`. Cambio de comportamiento, no de firma, en `generateThemeCss`: ahora antepone un `@import` cuando `theme.fonts.google` no está vacío — un consumidor que ya llamaba a esta función y asignaba su resultado a `textContent` de un `<style>` sigue funcionando igual (un `@import` al inicio de un `<style>` es CSS válido), pero AHORA también dispara la petición real a Google Fonts que antes sólo el plugin de PostCSS disparaba — documentado explícitamente en el CHANGELOG y en `AGENTS.md` como un cambio de comportamiento a tener en cuenta, no sólo un fix silencioso |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md`: el párrafo de "Known gaps" (que documentaba ambos huecos como pendientes) reescrito para reflejar que están cerrados; nueva sección "Google Fonts URL encoding" con ejemplo de uso y la explicación completa de por qué `encodeURIComponent` solo no basta. `packages/postcss-uxdsl/CHANGELOG.md`: nueva entrada "phase 4 of 4" (cierra la historia) con el hallazgo del apóstrofo documentado en detalle. `AGENTS.md`: el párrafo de "planned APIs, not shipped capabilities" actualizado para reflejar que las 4 fases están completas; el párrafo de "Build time, runtime and one source of truth" menciona el nuevo export y advierte que `generateThemeCss`'s `css` ahora puede empezar con un `@import`. `docs/migration.md` sin cambios — la receta de opt-out (`fonts: { google: [] }`) ya documentada en fase 1 sigue funcionando exactamente igual, esta fase no cambia esa semántica |
| AGENTS / guías / arquitectura | Ver fila anterior — mismas secciones ya actualizadas en fases previas, ahora reflejando el cierre completo de las 4 fases de esta historia |
| Límites y seguimiento | (1) **`packages/playground-nextjs/src/components/ThemeContext.tsx` no se tocó** — su propia implementación independiente de gestión de `<link id="uxdsl-google-fonts">` (líneas 101-144) sigue existiendo, ahora genuinamente redundante con lo que `generateThemeCss` ya hace correctamente, pero removerla es el alcance explícito de MIG-B6-30 ("30 retira la gestión duplicada de links del playground" — mencionado en el paso 9 de esta misma ficha), no de esta fase. Consecuencia temporal, documentada: hasta que MIG-B6-30 corra, el playground tiene MÁS caminos de carga de fuentes superpuestos que antes (el `<link>` de `ThemeContext.tsx`, el `@import` ahora presente en el `<style id="uxdsl-ssr-theme">` que genera `generateThemeCss`, y el `@import` estático ya compilado en `uxdsl.css`), no menos — orden esperado y correcto: el paso 9 tenía que existir antes de que el paso 30 pudiera remover con seguridad lo que cubría. Los navegadores deduplican peticiones idénticas a la misma URL razonablemente bien, así que el impacto de red práctico es mínimo, pero no se afirma que sea cero. (2) **La codificación asume que el nombre de familia no necesita normalización Unicode** — `encodeGoogleFontFamily` opera por code point (`for...of` sobre el string), no bytes UTF-8 crudos; para un nombre de familia con caracteres fuera de ASCII (poco común en Google Fonts, pero no imposible), el resultado depende de cómo `encodeURIComponent` codifica ese code point (UTF-8 percent-encoded, el comportamiento estándar) — no se añadió un caso de prueba dedicado para esto porque ninguna familia real de Google Fonts lo requiere hoy; queda como límite conocido, no como bug confirmado. (3) No se ejecutó una verificación de navegador real de que Google Fonts efectivamente sirve una respuesta válida para las URLs que este motor construye (requeriría una petición de red real desde este entorno, ya señalado como limitación en otras fichas de esta sesión) — la verificación aquí es que la URL tiene la forma sintácticamente correcta que la propia documentación de la API css2 de Google especifica, no una confirmación end-to-end contra el servicio real. |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
