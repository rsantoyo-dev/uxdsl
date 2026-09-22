# MIG-B6-17 — `@ds-typo` emite sólo lo que define el tema

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | B — Tema base y salida correcta |
| Prioridad · Tamaño | P1 · M |
| Cierra | UX-09; reduce UX-19 |
| Depende de | MIG-B6-29 (el JSON base es el default), MIG-B6-15 (orden de `index.ts`) |
| Bloquea | MIG-B6-12, MIG-B6-21, MIG-B6-30 |
| Archivos | `packages/postcss-uxdsl/src/index.ts` (`applyTypo`, ~152-230), `src/typography.ts` (`TYPOGRAPHY_DEFAULTS` en la línea 16, `TYPOGRAPHY_PROPERTIES`, `generateTypographyCss`), `src/typography-defaults.ts`, `src/theme/base.json` |
| Coordinación | Cuarto en la secuencia de `index.ts`; después de MIG-B6-29 en `typography*.ts` |

## Por qué

**Decisión D-2:** lo que emite `@ds-typo` se define en el JSON base y cada proyecto
lo sobrescribe. El compilador no debe inventar valores.

Hoy `applyTypo` emite, para cada uso, declaraciones con valores literales de
respaldo que no vienen del tema:

- `margin-block-start/end: var(…, auto)`. En un contenedor flex o grid, `auto`
  absorbe el espacio libre y empuja el elemento.
- `text-decoration: var(…, none)`: quita el subrayado si se aplica a un `<a>`
  (WCAG 1.4.1).
- `text-transform: none` y `font-style: normal`.
- `opacity: var(…, 0.8)` en `caption` y `small`. **Es imposible sobrescribirlo desde
  el JSON**, porque `opacity` no está en `TYPOGRAPHY_PROPERTIES`. Los campos válidos
  son `fontFamily`, `fontSize`, `lineHeight`, `fontWeight`, `letterSpacing`,
  `textTransform`, `textDecoration`, `fontStyle`, `marginBlockStart` y
  `marginBlockEnd`.
- La familia de fuente, el peso, el interlineado y el espaciado de respaldo salen de
  `TYPOGRAPHY_DEFAULTS` (`typography.ts:16`), no del tema.

## Reproducción

```bash
npm --prefix packages/postcss-uxdsl run build
node -e "
const postcss = require('./packages/postcss-uxdsl/node_modules/postcss');
const uxdsl = require('./packages/postcss-uxdsl/dist');
postcss([uxdsl({ includeTheme: false })]).process('.eyebrow { margin: 0; @ds-typo(caption); }', { from: 'x.uxdsl' }).then(r => console.log(r.css));
"
```

Salida actual (resumida):

```
.eyebrow { margin: 0; font-family: var(--uxdsl__typography__caption-font-family, var(--uxdsl__font__ui-2, var(--uxdsl__font__ui))); font-size: …; line-height: var(…, 1.4); letter-spacing: var(…, normal); text-transform: var(…, none); text-decoration: var(…, none); font-style: var(…, normal); margin-block-start: var(…, auto); margin-block-end: var(…, auto); opacity: var(--uxdsl__typography__caption-opacity, 0.8); }
```

El JSON base define para `caption` sólo `fontSize`, `fontWeight`, `lineHeight` y
`letterSpacing`.

## Resultado esperado

`@ds-typo(tag)` emite una declaración por cada campo que el tema efectivo define para
ese tag, y nada más. No hay respaldos literales.

## Implementación

1. **Inventario antes de cambiar nada.** Con un script, generar una tabla con el valor
   efectivo actual de cada tag y cada propiedad, en flujo normal y en flex. Adjuntarla
   al PR: después del cambio, cada diferencia tiene que ser deliberada.
2. **Pasar al JSON base lo que se quiera conservar**, decidido con el dueño o con
   diseño. Recomendaciones:
   - familia, tamaño, peso, interlineado y espaciado: definirlos para cada tag en el
     JSON base (hoy varios salen de `TYPOGRAPHY_DEFAULTS`);
   - márgenes: hoy el efecto en flujo normal es 0 (`auto` → 0). Para conservarlo sin
     el problema de flex/grid, definir `marginBlockStart: "0"` y
     `marginBlockEnd: "0"`. La alternativa, no definirlos, deja los márgenes del
     navegador (≈1em en `p` y `h*`): es un cambio visible;
   - `textDecoration`: no definirla, para no quitar el subrayado de enlaces;
   - `opacity` de `caption`/`small`: **eliminarla** (reduce contraste y no es un
     campo del tema). Si diseño quiere un caption atenuado, que lo exprese con un
     color de palette en el componente. Agregar `opacity` a `TYPOGRAPHY_PROPERTIES`
     sería ampliar un conjunto cerrado; sólo con aprobación explícita.
3. **Cambiar `applyTypo`:** usar un resolvedor compartido con
   `compileTypographyRules`: `{ ...details.default, ...details[tag] }` para un rol
   existente, sin mezclar expresiones responsive campo a campo. Validar rol antes
   de heredar: un nombre inexistente no se convierte en `default` silenciosamente.
   Emitir sólo campos efectivos con el mapeo de propiedad CSS y
   `TYPOGRAPHY_PROPERTIES` para el sufijo (`fontSize` → `size`, `lineHeight` →
   `line`, `fontWeight` → `weight`); no construir nombres desde camelCase.
   Las declaraciones referencian variables sin respaldo literal. La cadena de
   fuentes (`ui-2` → `ui`, `code` → `monospace`) pasa al JSON base.
4. Eliminar `TYPOGRAPHY_DEFAULTS` y `DEFAULT_TYPOGRAPHY`, o derivarlos del JSON base
   si otro módulo los necesita. Comprobarlo con `grep`.
5. Documentar la precedencia: la directiva emite en su posición, así que una
   declaración escrita después la sobrescribe
   (`.eyebrow { @ds-typo(caption); margin: 0; }`).
6. Correr `npm run generate:language` si cambia la metadata.

## Fuera de alcance

- Ampliar `TYPOGRAPHY_PROPERTIES` sin aprobación.
- Salida basada en clases compartidas (`composes:`); queda para después de 0.5.0.

## Pruebas

- Rol custom con sólo `fontSize`: hereda los campos de `default` tanto en
  directiva como en generador/inspector. Override responsive sustituye el campo
  completo; rol inexistente falla con ubicación. Dos directivas en la misma regla
  respetan su posición y declaraciones CSS anteriores/posteriores.
- Navegador: flujo normal, flex y grid con p/h1/a/caption; margen declarado 0,
  subrayado del enlace no eliminado y opacity no inventada. Registrar diferencias
  deliberadas contra beta.5; no mantener snapshots incorrectos por compatibilidad.

- `test/typography.test.js`:
  - con el JSON base, `@ds-typo(caption)` no emite `margin-block-*` (salvo que la base
    los defina), `text-decoration` ni `opacity`;
  - `.eyebrow { margin: 0; @ds-typo(caption); }` conserva el margen 0;
  - un override que define `typography_details.caption.textDecoration` hace que se
    emita.
- Un test de snapshot por tag contra el inventario del paso 1, con las diferencias
  aprobadas anotadas.
- Tamaño: medir la salida de una fixture con 100 usos de `@ds-typo` antes y después.
  Registrar el número en el PR y en el CHANGELOG.

## Documentación

- CHANGELOG beta.6, con `### Visual changes`. Es obligatorio: `typography.ts` y
  `typography-defaults.ts` están en el guard. Incluir la tabla antes/después del
  inventario y la receta para restaurar el aspecto de beta.5 definiendo los campos
  en `typography_details`.
- `packages/postcss-uxdsl/README.md` y `AGENTS.md`, sección Typography: qué emite
  `@ds-typo` y la precedencia.
- `packages/postcss-uxdsl/docs/migration.md`: la receta.

## Criterios de aceptación

- [x] La reproducción ya no emite `auto`, `none` implícito ni `opacity`.
      **(la reproducción exacta de esta ficha ahora emite 7 declaraciones, todas
      `var(--…)` sin respaldo; test dedicado en `test/typography.test.js` que
      además recorre todos los valores emitidos y falla si alguno contiene una
      coma, la firma de un respaldo literal)**
- [x] No quedan respaldos literales en `applyTypo`, y `TYPOGRAPHY_DEFAULTS` ya no
      existe o se deriva del JSON base.
      **(`TYPOGRAPHY_DEFAULTS` eliminado de `typography.ts` y
      `src/typography-defaults.ts` borrado entero — ninguno tenía importador
      real, verificado con grep antes de borrar; `applyTypo` ahora recorre
      `TYPOGRAPHY_CSS_PROPERTIES` y emite sólo los campos del rol resuelto)**
- [x] Cada diferencia visual respecto del inventario está aprobada y documentada.
      **(tabla antes/después completa en el CHANGELOG bajo `### Visual changes`,
      con las cuatro diferencias deliberadas explicadas una por una, y la receta
      para recuperar el aspecto de beta.5; misma tabla en `docs/migration.md`)**
- [x] Se registra el tamaño antes y después.
      **(100 usos de `@ds-typo` sobre 13 roles: 63.455 → 40.296 bytes, −36,5%;
      medido compilando la misma fixture contra el estado previo en un
      `git worktree` aislado, no reconstruido a mano)**

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm run generate:language && node scripts/generate-language-artifacts.js --check
npm --prefix packages/playground-nextjs run build
npm test
npm run verify:beta5
```

## Entrega

`feat(FEAT-008): MIG-B6-17 - @ds-typo emits only what the theme defines`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente** en
`feat/feat-008-beta6-plan`. Integración a `main` pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `159c357` (2026-09-22, el merge de PR #3 a `main`, HEAD de la rama al iniciar). Entrega: commit siguiente en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | Sobre `159c357`, exactamente el comando de esta ficha: `.eyebrow { margin: 0; @ds-typo(caption); }` emitía 10 declaraciones, 7 de ellas con un respaldo literal que el tema nunca pidió (`text-transform: var(…, none)`, `text-decoration: var(…, none)`, `font-style: var(…, normal)`, `margin-block-start/end: var(…, auto)`, `opacity: var(…, 0.8)`, más la cadena de familia armada en el compilador). **Inventario del paso 1**, generado con un script que compila cada rol con el plugin real y resuelve cada `var()` contra las variables que el tema efectivamente define: 16 roles, 10 declaraciones cada uno (8 para `code`/`pre`), y por propiedad — `font-size` 16/16 desde el tema, `line-height` 16/16, `font-weight` 12/16, `letter-spacing` 14/16, pero `text-transform`, `text-decoration`, `font-style` y `margin-block-start` **0/16 desde el tema** (100% inventados), `margin-block-end` 1/16 (sólo `h1`), `opacity` 0/2. Dos hallazgos del inventario que la ficha no anticipaba: (a) el JSON base **no definía `fontFamily` para ningún rol**, así que emitir sólo lo definido habría hecho desaparecer `font-family` de todo — por eso la cadena de familias se movió al JSON base antes de tocar `applyTypo`; (b) `code`/`pre` emitían 8 y no 10 porque `TYPOGRAPHY_DEFAULTS` no les daba `weight`/`spacing`, **aunque el JSON base sí los definía**: el tema declaraba dos valores que la directiva nunca leía. 2026-09-22 |
| Criterio → regresión | "La reproducción ya no emite `auto`/`none`/`opacity`" → `test/typography.test.js`, "MIG-B6-17: the ficha's own reproduction no longer emits auto, an implicit none, or opacity" (afirma la ausencia de las cuatro propiedades y recorre todos los valores emitidos rechazando cualquier coma, la firma de un respaldo). "No quedan respaldos literales" → el mismo test, más el snapshot "MIG-B6-17 snapshot: every base-theme role emits exactly its theme-defined fields, and nothing dangles", que para los 16 roles del tema base exige exactamente las 7 propiedades esperadas y que **cada `var()` referenciado exista** en `inspectTypographyTheme` (sin respaldo, una referencia colgante renderizaría nada en silencio). "Rol inexistente falla con ubicación" → "MIG-B6-17: a role the theme does not define fails with a location instead of silently becoming default" (`UXD_TYPO_REFERENCE`, línea 2). "Rol custom con sólo `fontSize` hereda `default`" → "a custom role with only fontSize inherits default's other fields, in the directive and the generator alike", que además comprueba que el generador define cada variable que la directiva acaba de referenciar. "Un override de `textDecoration` hace que se emita" → "defining textDecoration in the theme makes it emitted again". "Posición y declaraciones anteriores/posteriores" → "a later declaration still overrides the directive, and two directives keep their positions". Dos tests preexistentes se actualizaron en vez de borrarse (ver "Resultado después") |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, desde el root del monorepo: `npm --prefix packages/postcss-uxdsl run build` (exit 0), `npm --prefix packages/postcss-uxdsl test` (exit 0, **310/310** — +7 sobre la base), `npm run generate:language && node scripts/generate-language-artifacts.js --check` (exit 0; `default-typography.uxdsl` se regeneró porque el JSON base cambió), `npm test` (exit 0, 585 líneas `ok`), `npm run verify:beta2`/`beta3`/`beta4`/`beta5` (exit 0), `npm run verify:consumer-fixture` (exit 0), `npm run verify:vscode-extension` (exit 0), `node packages/playground-nextjs/scripts/test-theme-inheritance.cjs` (exit 0, 2/2), `npm --prefix packages/playground-nextjs run build` (exit 0, 35/35 páginas) |
| Resultado después / control negativo | La reproducción emite 7 declaraciones, todas `var(--…)` sin respaldo. Los 16 roles del tema base emiten exactamente `font-family, font-size, line-height, font-weight, letter-spacing, margin-block-start, margin-block-end`, con **0 referencias colgantes** (verificado contra las variables reales del tema, no por inspección visual). `code`/`pre` ganan `font-weight` y `letter-spacing`, que el tema ya definía. Rol desconocido: `UXD_TYPO_REFERENCE: ds-typo(nope) does not exist; available keys: …`, en la línea de la directiva. **Control negativo real**: el snapshot falla si un rol emite una propiedad de más o de menos, y el test de la reproducción falla si cualquier valor vuelve a llevar una coma. **Dos tests preexistentes cambiaron de expectativa, documentado por qué**: (1) `diagnostics-location.test.js` esperaba `ReferenceIntegrityError` para `@ds-typo(nonexistent)` — antes el fallo sólo aparecía aguas abajo, como variable colgante; ahora falla en la directiva misma con `UXD_TYPO_REFERENCE`. Lo que ese caso realmente fijaba (que la salida sintetizada conserva el `source` del at-rule, así que el error apunta a la línea 2 y no al inicio del archivo) se mantiene y se sigue afirmando para ambos casos. (2) `typography.test.js`, "packaged data-typo selectors consume all configured properties", afirmaba literalmente `var(…, none)`, `var(…, normal)` y `var(…, auto)` para campos que el tema nunca definió; ahora afirma la forma correcta y, además, que `text-transform`/`font-style`/`text-decoration` **no** se emitan. El `uxdsl.css` compilado del playground perdió 422 líneas que cargaban respaldos inventados (418 insertions, 587 deletions netas) |
| Cambios visuales o API / migración | Cambio visual real, documentado campo por campo en el CHANGELOG bajo `### Visual changes`. Cuatro diferencias deliberadas: los enlaces conservan su subrayado (antes `text-decoration: none` se aplicaba a todo uso, incluido sobre un `<a>` — WCAG 1.4.1); los márgenes dejan de romper flex/grid (`auto` absorbe espacio libre en un contenedor flex o grid, `"0"` en el JSON base deja el render en flujo normal idéntico sin la trampa); `caption`/`small` dejan de atenuarse a `opacity: 0.8` (reducía contraste y era imposible de sobrescribir desde el tema, porque `opacity` no es un campo de tipografía); `text-transform`/`font-style` dejan de resetearse (sus valores iniciales de CSS ya son `none`/`normal`, pero ambos se heredan, así que dentro de un padre en mayúsculas o cursiva ahora se hereda el padre). Cambio de API: `TYPOGRAPHY_DEFAULTS` y `DEFAULT_TYPOGRAPHY` eliminados (sin importadores reales); `typography.ts` gana `TYPOGRAPHY_CSS_PROPERTIES` y `resolveTypographyRole`; nuevo código de diagnóstico `UXD_TYPO_REFERENCE`. Receta de restauración de beta.5 en CHANGELOG y `docs/migration.md`. Tamaño: 63.455 → 40.296 bytes (−36,5%) para 100 usos |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/CHANGELOG.md`: entrada MIG-B6-17 con `### Visual changes`, tabla antes/después por declaración, las cuatro diferencias deliberadas explicadas, el número de tamaño y la receta de restauración. `packages/postcss-uxdsl/README.md`: nueva sección "What `@ds-typo` emits" con entrada/salida real, la regla de precedencia por posición y el fallo por rol desconocido. `packages/postcss-uxdsl/docs/migration.md`: nueva sección "Desde beta.6: `@ds-typo` emite sólo lo que define el tema (MIG-B6-17)" con la misma receta |
| AGENTS / guías / arquitectura | `AGENTS.md`, sección Typography: qué emite exactamente `@ds-typo` (un campo definido = una declaración, sin respaldos), que un rol inexistente falla como `UXD_TYPO_REFERENCE` en vez de caer a `default`, la precedencia por posición con los dos ejemplos, y que `opacity` no es un campo a propósito. No se tocó ninguna otra sección |
| Límites y seguimiento | (1) **Sin verificación en navegador real.** La ficha pide comprobar flujo normal, flex y grid con `p`/`h1`/`a`/`caption`. No hay Chromium disponible en este entorno (limitación ya registrada en otras fichas de esta sesión). Lo verificado es la salida CSS compilada: que `margin-block-*` ya no vale `auto` sino la variable que el tema define como `"0"`, y que `text-decoration` ya no se emite. El razonamiento sobre flex/grid (`auto` absorbe espacio libre, `0` no) es comportamiento especificado de CSS, no una medición propia. (2) **Los márgenes se conservaron como `"0"`, la alternativa conservadora que la propia ficha recomienda primero.** La otra opción que la ficha plantea —no definirlos y dejar los márgenes del navegador (≈1em en `p`/`h*`)— es un cambio visible mayor y no se tomó sin decisión de diseño. Un proyecto que prefiera los márgenes del navegador ya puede conseguirlo, porque ahora es un campo normal del tema. (3) **La cadena `ui-2` → `ui` se preservó tal cual** para `h5`/`h6`/`small`/`caption`, aunque `fonts.families` del tema base no define `ui-2` hoy (MIG-B6-29 lo quitó), así que hoy siempre resuelve a `ui`. Se conserva porque es la intención original del diseño y un proyecto que sí defina `ui-2` la recupera sin tocar nada. (4) **`opacity` no se agregó a `TYPOGRAPHY_PROPERTIES`.** La ficha lo marca como ampliación de un conjunto cerrado que necesita aprobación explícita; no se pidió, así que `caption`/`small` pierden el atenuado sin equivalente en el tema, documentado como tal. (5) El snapshot por rol fija las 7 propiedades del tema base actual; si una futura historia agrega un campo al JSON base, ese test falla a propósito y hay que revisar la diferencia, que es exactamente su función |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
