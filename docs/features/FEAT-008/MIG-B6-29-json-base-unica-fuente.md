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

- [ ] Existe una sola fuente de defaults: el JSON base dentro de `postcss-uxdsl`, y
      no quedan valores de diseño literales en `src/` fuera de él. Excepción: los que
      MIG-B6-17 retira, si todavía no se integró, y los keywords/mecanismos
      no configurables enumerados en el inventario.
- [ ] `resolveTheme(undefined)` es igual, en profundidad, al JSON base.
- [ ] El playground consume la base desde el paquete.
- [ ] El gate de contraste pasa en claro **y en oscuro** (bloqueante, porque
      `modes.dark` es default), o cada excepción está declarada con su motivo.
- [ ] Los cambios de color siguen las reglas del paso 8 y la tabla está en el PR.
- [ ] README: la petición a Google Fonts y cómo desactivarla (`fonts: { google: [] }`),
      y el modo oscuro automático y cómo fijar el claro. Ambos tienen test.
- [ ] El manifiesto no apunta a archivos inexistentes.
- [ ] CHANGELOG, README, `AGENTS.md` y migration guide están alineados.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm run generate:language && node scripts/generate-language-artifacts.js --check
npm --prefix packages/playground-nextjs run build
npm test
npm run verify:beta5
```

## Entrega

`feat(FEAT-008): MIG-B6-29 - the reviewed base theme json is the library default, with a contrast gate`

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
