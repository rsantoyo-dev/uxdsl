# MIG-B6-01 — Familias top-level reconocidas (completar)

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | A — Diagnósticos veraces |
| Prioridad · Tamaño | P0 · S |
| Cierra | UX-01 |
| Depende de | — (la parte de claves anidadas ya está integrada: commit `feat(FEAT-008): MIG-B6-01 - …` en `feat/feat-008-beta6-plan`) |
| Bloquea | MIG-B6-22 (valida familias con esta lista), MIG-B6-27 (esquema) |
| Archivos | `packages/postcss-uxdsl/src/ds-runtime/theme-validate.ts`, `packages/postcss-uxdsl/test/`, `packages/uxdsl-cli/test/uxdsl-cli.test.js`, `packages/postcss-uxdsl/README.md` |

## Por qué

beta.5 imprime avisos que afirman que partes válidas del tema "no se compilan". Ya
hay una mitad resuelta en el árbol local: el aviso sobre claves dentro de
`palette`, `fonts.families` y `typography_details`. Falta el nivel superior.

`KNOWN_THEME_FAMILIES` (`theme-validate.ts:31-34`) no incluye `modes` ni
`typography`, y el compilador lee las dos: `foundations.ts:55` usa
`modes.dark.palette` y `typography.ts:91` usa `theme.typography`. Resultado:
cualquier tema con modo oscuro recibe un aviso falso en cada build.

## Reproducción

```bash
npm --prefix packages/postcss-uxdsl run build
node -e "
const { validateAndNormalizeTheme } = require('./packages/postcss-uxdsl/dist/ds-runtime/theme-validate');
const r = validateAndNormalizeTheme({ modes: { dark: { palette: { primary: { main: '#000' } } } }, typography: { hero: '2rem' } });
console.log(r.warnings.map(w => w.message).join('\n'));
"
```

Salida actual:

```
Unknown theme family "modes" — it will not be compiled into any CSS.
Unknown theme family "typography" — it will not be compiled into any CSS.
```

Un `uxdsl build` con ese tema en `uxdsl.theme.config.cjs` imprime las mismas dos
líneas como `[uxdsl] Warning: …`.

## Resultado esperado

Ningún aviso para `modes` ni para `typography`. Un error de tipeo como `palete`
sigue avisando.

## Implementación

1. Agregar `'modes'` y `'typography'` a `KNOWN_THEME_FAMILIES`.
2. Exportar la lista y reexportarla desde `postcss-uxdsl/ds-runtime`, para que el
   CLI (MIG-B6-22) y el esquema (MIG-B6-27) la importen en vez de copiarla.
3. Test de deriva: recorrer `packages/postcss-uxdsl/src/**/*.ts` y extraer cada
   propiedad de primer nivel que el código lee del tema (`theme.X`, `theme?.X`,
   `effectiveTheme.X`, `theme['X']`). El test falla si alguna no está en la lista.
   Si el patrón captura algo que no es una familia, dejarlo en una lista de
   excepciones explícita y comentada dentro del test.
4. Actualizar el comentario que describe la lista en `theme-validate.ts`: el
   conjunto top-level es cerrado y lo protege el test de deriva.

## Fuera de alcance

- Validar el contenido de `modes`. Hoy sólo se usa `modes.dark.palette`, y D6 de
  FEAT-007 prohíbe agregar modos.
- Convertir el aviso en error.

## Pruebas

- `test/theme-validate-open-registries.test.js`: agregar un caso con el tema de la
  auditoría (`modes.dark.palette`, `typography.hero`, `typography_details.lead`,
  `palette.brand`, `fonts.families.display`). Debe dar cero avisos `Unknown`.
- Nuevo `test/theme-families-drift.test.js` (paso 3).
- `packages/uxdsl-cli/test/uxdsl-cli.test.js`: `warnUnknownThemeKeys` no imprime
  nada para `modes` y `typography`, y sí imprime para `palete`. Usar nombres únicos
  por test: el Set de deduplicación se comparte en el proceso.
- Siguen verdes los casos existentes: `palete` avisa y `typography_details.h1.fontsize`
  da `UXD_TYPO_FIELD`.

## Documentación

- `packages/postcss-uxdsl/README.md`: el apartado de `validateAndNormalizeTheme`
  enumera las familias top-level. Agregar `modes` y `typography`.
- CHANGELOG beta.6: ampliar el bullet de MIG-B6-01 que ya existe.

## Criterios de aceptación

- [ ] La reproducción no imprime avisos.
- [ ] El tema de la auditoría, el ejemplo del README y
      `packages/playground-nextjs/uxdsl.theme.base.json` pasan por
      `validateAndNormalizeTheme` sin avisos `Unknown`.
- [ ] `palete` sigue avisando y `h1.fontsize` sigue dando `UXD_TYPO_FIELD`.
- [ ] El test de deriva falla si se agrega una lectura `theme.nuevaFamilia` sin
      listarla. Comprobarlo a mano una vez y dejarlo anotado en el PR.
- [ ] Ningún archivo copia la lista: todos la importan.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm --prefix packages/uxdsl-cli test
npm run verify:beta5
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-01 - modes and typography are known theme families`
