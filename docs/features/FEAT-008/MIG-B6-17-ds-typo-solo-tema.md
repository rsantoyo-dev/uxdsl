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

- [ ] La reproducción ya no emite `auto`, `none` implícito ni `opacity`.
- [ ] No quedan respaldos literales en `applyTypo`, y `TYPOGRAPHY_DEFAULTS` ya no
      existe o se deriva del JSON base.
- [ ] Cada diferencia visual respecto del inventario está aprobada y documentada.
- [ ] Se registra el tamaño antes y después.

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
