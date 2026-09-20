# MIG-B6-01 — Familias top-level reconocidas

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | A — Diagnósticos veraces |
| Prioridad · Tamaño | P0 · S |
| Cierra | UX-01 |
| Depende de | — (la parte de claves anidadas existe en la rama base; verificar su SHA antes de empezar) |
| Bloquea | MIG-B6-12, MIG-B6-22, MIG-B6-27 |
| Archivos | `packages/postcss-uxdsl/src/ds-runtime/theme-validate.ts`, `packages/postcss-uxdsl/test/`, `packages/uxdsl-cli/test/uxdsl-cli.test.js`, `packages/postcss-uxdsl/README.md` |

## Por qué

Contexto histórico de la reproducción; estado actual y evidencia al final.

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

Salida anterior a la implementación (reproducida con el validador de `60fdd76`):

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
   `effectiveTheme.X`, `theme['X']`). Usar AST o justificar cobertura del extractor;
   incluir destructuring y accesos opcionales/computados literales. El test falla
   si alguna no está en la lista; accesos dinámicos requieren inventario explícito.
   Si el patrón captura algo que no es una familia, dejarlo en una lista de
   excepciones explícita y comentada dentro del test.
4. Actualizar el comentario que describe la lista en `theme-validate.ts`: el
   conjunto top-level es cerrado y lo protege el test de deriva.

## Fuera de alcance

- Validar el contenido de `modes`. Hoy sólo se usa `modes.dark.palette`, y D6 de
  FEAT-007 prohíbe agregar modos.
- Convertir el aviso en error.

## Pruebas

- La base vigente se importa de su ubicación real (29 la mueve al paquete).
  Nombres custom permanecen abiertos; metadata `$schema` de 27 no es una familia
  ni un warning. No excluir del guard nombres que sí se consumen.
- Diferenciar lista pública de familias y lista de tonos completos: `action` o
  `divider` válidos no implican main/dark/contrast.

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

- [x] La reproducción no imprime avisos.
- [x] El tema de la auditoría, el ejemplo del README y
      `packages/playground-nextjs/uxdsl.theme.base.json` pasan por
      `validateAndNormalizeTheme` sin avisos `Unknown`.
- [x] `palete` sigue avisando y `h1.fontsize` sigue dando `UXD_TYPO_FIELD`.
- [x] El test de deriva falla si se agrega una lectura `theme.nuevaFamilia` sin
      listarla. Verificado mediante fixture negativa del mismo extractor y
      aserción; trasladar la evidencia al PR al crearlo.
- [x] Ningún archivo copia la lista: todos la importan.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm --prefix packages/uxdsl-cli test
npm run verify:beta5
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-01 - modes and typography are known theme families`

## Registro de implementación y evidencia

Estado: **Implementada/verificada localmente — pendiente de commit e integración**.
Revisión del 2026-09-20, Node v20.19.0 en macOS. El cierre funcional de 01 no
cierra 13, no publica beta.6 y no representa un merge.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `60fdd76599fcc62b7da48d4770f576de2b4d0062`; implementación en working tree, sin SHA de entrega ni PR todavía |
| Reproducción antes del cambio | `git show 60fdd76:packages/postcss-uxdsl/src/ds-runtime/theme-validate.ts`, transpilar/evaluar en memoria contra dependencias actuales: emite los dos avisos de la reproducción. Verificado 2026-09-20; no es una suite completa del checkout histórico |
| Criterio → regresión | `test/theme-validate-open-registries.test.js`: auditoría, README JSON leído directamente, base real, export público idéntico al interno, `palete` y `h1.fontsize`; `test/theme-families-drift.test.js`: inventario del código y controles negativos; `packages/uxdsl-cli/test/uxdsl-cli.test.js`: warnings CLI y deduplicación |
| Comandos y entorno | Ver tabla de ejecución debajo; Node v20.19.0/macOS |
| Resultado después / control negativo | 12 tests focalizados pasan. Ocho formas de lectura `nuevaFamilia` disparan la misma aserción usada por el guard; sustituir por `modes` pasa. Incluye optional chaining, literal computado y destructuring con alias. No se añadieron lecturas ficticias al código de producción |
| Cambios visuales o API / migración | Sin cambio visual/CSS ni flags. Export aditivo `KNOWN_THEME_FAMILIES`; desaparecen avisos falsos, sin cerrar nombres de roles anidados |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/README.md`: Recognized theme families; `CHANGELOG.md`: MIG-B6-01; `docs/migration.md`: adelanto beta.6 sin publicar |
| AGENTS / guías / arquitectura | `AGENTS.md`: registro compartido, roles abiertos y límite de publicación. Sin cambio de arquitectura ni comportamiento visual del playground |
| Límites y seguimiento | Commit/merge pendientes. `verify:docs` falla por índice previo sin README staged; README actualizado en working tree. Preparar sólo archivos pertinentes y repetir guard antes del commit. No se alteró el índice del usuario |

| Comando ejecutado | Resultado / log local (no artefacto versionado) |
| --- | --- |
| `node --test packages/postcss-uxdsl/test/theme-families-drift.test.js packages/postcss-uxdsl/test/theme-validate-open-registries.test.js` | exit 0, 12/12; `/tmp/uxdsl-b6-01-focused.log` |
| `npm test` | exit 0; `/tmp/uxdsl-b6-close-tests.log`. Incluye CLI 91/91; después de añadir los dos controles de cierre se repitió el paquete afectado |
| `npm --prefix packages/postcss-uxdsl test` | exit 0, 166/166 después de los cambios finales de tests; `/tmp/uxdsl-b6-close-postcss.log` |
| `npm run verify:beta5` | exit 0, tarballs instalados; `/tmp/uxdsl-b6-close-beta5.log`. Repetido fuera del sandbox tras fallo inicial de permisos de caché npm |
| `node node_modules/next/dist/bin/next build` desde `packages/playground-nextjs` | exit 0, 35 páginas generadas; `/tmp/uxdsl-b6-close-next.log`. No ejecuta instalación `local-deps` ni auditoría de navegador |
| `node scripts/generate-language-artifacts.js --check` | exit 0 |
| `git diff --check` y `git diff --cached --check` | exit 0 |
| `npm run verify:docs` | exit 1 por README no staged; repetir al preparar el commit, no omitir hook |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
