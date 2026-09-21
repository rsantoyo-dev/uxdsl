# MIG-B6-18 — `compile()` compartido en `uxdsl-core`

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | C — Un solo pipeline (**camino crítico**) |
| Prioridad · Tamaño | P0 · L |
| Cierra | UX-02, N-02, N-06. Es la base de UX-16 (con MIG-B6-20) y de UX-20 (con MIG-B6-21) |
| Depende de | MIG-B6-22 para integrar cambios del CLI. El corpus y oráculo (paso 0) pueden prepararse antes |
| Bloquea | MIG-B6-12, MIG-B6-19, MIG-B6-20, MIG-B6-21, MIG-B6-23, MIG-B6-24, MIG-B6-26, MIG-B6-28 |
| Archivos | `packages/uxdsl-core/src/index.ts`, `packages/uxdsl-core/index.js`, `packages/uxdsl-core/package.json`, `packages/uxdsl-core/test/`, `packages/uxdsl-cli/bin/uxdsl.js` (`compileEntryToCss` ~666-722, `createImportResolver` ~96), `packages/uxdsl-cli/package.json`, `scripts/release.js` (~58-63), nuevo `fixtures/parity/`, `package.json` raíz |
| Coordinación | Segundo en la secuencia de `uxdsl.js` (22 → 18 → …). **No toca** `vite-plugin-uxdsl` ni `uxdsl-webpack-loader`: los migra MIG-B6-20 |

## Por qué

Hoy hay tres compiladores para el mismo lenguaje:

- **CLI:** `postcss-scss`, `postcss-import`, `postcss-advanced-variables` y
  `postcss-uxdsl`.
- **`uxdsl-core`, y a través de él Vite y Webpack:** quita comentarios con un recorte
  línea por línea, inlinea imports con regex sobre strings y después corre
  `postcss-uxdsl`.
- **`postcss-uxdsl` usado solo.**

El recorte de comentarios de core corrompe CSS válido sin avisar. El inline por
strings ignora imports inexistentes y destruye la información de origen, así que
tampoco hay errores con ubicación ni sourcemaps en esos caminos.

## Reproducción

```bash
npm --prefix packages/postcss-uxdsl run build && npm --prefix packages/uxdsl-core run build
node -e "
const core = require('./packages/uxdsl-core');
core('.a { background: url(https://example.com/a.png); color: palette(primary); }\n/* docs: https://uxdsl.dev */\n.b { padding: density(2); }\n', { includeTheme: false })
  .then(css => console.log(css.slice(0, 120)));
const fs = require('fs'), os = require('os'), path = require('path');
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'uxc-'));
fs.writeFileSync(path.join(d, 'main.uxdsl'), '@import \"./missing-partial.uxdsl\";\n.a { color: palette(primary); }\n');
core(fs.readFileSync(path.join(d, 'main.uxdsl'), 'utf8'), { includeTheme: false, fileId: path.join(d, 'main.uxdsl') })
  .then(css => console.log('sin error:', css.split('\n')[0]), e => console.log('error:', e.message));
"
```

Salida actual:

```
.a { background: url(https:
/* docs: https:
.b { padding: density(2); }
sin error: @import "./missing-partial.uxdsl";
```

El mismo archivo compilado con el CLI sale bien. `$gap: xs(1rem) md(2rem); .a { gap:
$gap; }` también sale distinto: el CLI lo expande y core deja `xs(1rem) md(2rem)`.

## Causa

- `stripLineComments` (`uxdsl-core/src/index.ts:54`) corta todo lo que sigue a `//`
  en cada línea, salvo dentro de comillas. No entiende `url()` sin comillas ni
  comentarios de bloque.
- `inlineImports` (~85-130) sólo inlinea si `fs.existsSync(dep)`. Si no existe, deja
  la línea `@import` tal cual.
- El plugin se resuelve probando `../postcss-uxdsl` y `../../postcss-uxdsl` antes que
  la dependencia declarada, con `catch {}` vacíos (líneas 20-45). Dentro de
  `node_modules` puede tomar una copia izada de otra versión.
- `index.js` trae una segunda implementación completa que se usa si
  `require('./dist/index.js')` lanza **cualquier** error, y `dist/` está en
  `.gitignore`.

## Resultado esperado

Una sola función de compilación, usada por el CLI ahora y por los adaptadores después
(MIG-B6-20). La misma entrada da el mismo CSS, o el mismo código de error, en todos
los caminos.

## Implementación

0. **Suite de paridad, antes del refactor.** Puede prepararse antes de las
   dependencias de integración, según el índice.
   - Crear `fixtures/parity/` con una entrada por caso: `url()` sin comillas,
     comentario de bloque con URL, comentarios `//`, `$vars` con valores responsive,
     imports anidados, import inexistente, ciclo de imports, import duplicado.
   - Un runner (`fixtures/parity/run.js`, con `npm run test:parity` en la raíz)
     compila cada caso con el CLI y guarda una vez la salida en
     `fixtures/parity/expected/`, con commit/opciones de captura. Ejecución normal
     compara; regenerar requiere opción explícita y diff revisado. Bugs corregidos
     por 14/15/17/29 llevan expectativas corregidas y la story que explica el cambio;
     la salida anterior no es oráculo de corrección.
   - Los casos que hoy fallan en el CLI (import inexistente) guardan el código de
     error esperado.
1. **API aditiva** en `uxdsl-core`:
   ```ts
   compile(input: { entry: string } | { source: string; from?: string }, config?: {
     theme?; references?; breakpoints?; includeTheme?;
     to?: string; sourcesContent?: boolean;
     sourceMap?: false | 'inline' | 'external';
   }): Promise<{ css: string; map?: string; dependencies: string[]; warnings: Array<{ text: string; file?: string; line?: number; column?: number }> }>
   ```
   Usa exactamente el pipeline del CLI: sintaxis `postcss-scss`, `postcss-import`
   con el resolvedor de `.uxdsl` (mover `createImportResolver` del CLI a core),
   `postcss-advanced-variables` y `postcss-uxdsl`. Llevar a `compile()` también el
   metadata de breakpoints que hoy agrega sólo el CLI (`/*@uxdsl-bp …*/` y
   `#uxdsl-bp-meta`, `uxdsl.js:710-720`), con la misma condición `includeTheme`.
   `dependencies` sale de `result.messages` de tipo `dependency`. `sourceMap` queda
   declarado pero lo implementa MIG-B6-21: por ahora sólo `false`; otro modo da
   error de opción no implementada, nunca se ignora. Reenviar warnings en cada
   adaptador; dependencias incluyen entry con orden estable.
2. **Compatibilidad** (D3 de FEAT-007): `processUxdsl(source, options)` sigue siendo
   el export callable y sigue devolviendo `Promise<string>`, ahora como envoltorio de
   `compile()`. Exportar `compile` como propiedad:
   `module.exports = processUxdsl; module.exports.compile = compile`.
3. **Eliminar** `stripLineComments`, el `inlineImports` por strings y la segunda
   implementación de `index.js`. `main` apunta a `dist/index.js`. Agregar `prepack`
   (o `prepublishOnly`) que compile `dist/`. El campo `files` es de MIG-B6-28.
4. **Resolver el plugin** sólo con `require('postcss-uxdsl')`, sin `catch`
   silencioso. Comprobar que el monorepo lo resuelve, con un link local o una
   dependencia `file:` en desarrollo, y documentar cómo.
5. **Imports:**
   - un import inexistente da un error que nombra el archivo importador y la línea;
   - **ciclos:** hoy core lanza error y el CLI los omite en silencio (`postcss-import`
     descarta duplicados). Unificar en **error** (regla 1 de FEAT-008), con la
     detección en el resolvedor compartido;
   - los imports duplicados no cíclicos se omiten, como hoy.
6. **CLI:** `compileEntryToCss` llama a `compile()` de core. Se elimina el pipeline
   duplicado del CLI. `uxdsl-cli` pasa a depender de `uxdsl-core` con versión exacta
   coordinada. En `scripts/release.js`, agregar `uxdsl-core` a los `deps` de
   `uxdsl-cli`.
7. **Dependencias:** core agrega `postcss-scss`, `postcss-import` y
   `postcss-advanced-variables` con las versiones del CLI. El CLI puede eliminar las
   que ya no use directamente.

## Fuera de alcance

- Migrar Vite y Webpack (MIG-B6-20).
- Sourcemaps (MIG-B6-21).
- El orden de `$vars` en el plugin usado solo: lo corrige MIG-B6-14.
- Cargar el tema desde archivos: lo hace MIG-B6-19 (`compile()` recibe `theme` ya
  resuelto).

## Pruebas

- Imports con media/supports/layer y duplicados en condiciones diferentes:
  preservar semántica, no deduplicar por path global. Ciclo con cadena completa,
  rutas con espacios y fuentes en memoria con from.
- CSS nativo, $vars y error de parcial se comparan por contrato; normalizar sólo
  envoltorios de bundler, nunca ordenar reglas/declaraciones ni ocultar cascada.
- Consumo limpio sin paquetes hermanos ni fallback: dependencia exacta publicada,
  callable CSS string, compile, warnings y errores equivalentes.

- `fixtures/parity/`: CLI y `compile()` dan salidas idénticas al oráculo, o el mismo
  código de error.
- `packages/uxdsl-core/test/`:
  - migrar `inline-imports.test.js` a `node --test`;
  - ciclo → error que nombra la cadena de archivos;
  - duplicado → se omite;
  - import inexistente → error con archivo importador y línea;
  - `url()` sin comillas y comentario con URL → CSS intacto.
- **Consumo CJS:** `require('uxdsl-core')` es callable y `require('uxdsl-core').compile`
  existe.
- El tarball de `uxdsl-core` (`npm pack`) incluye `dist/` y no incluye la
  implementación de respaldo.
- Siguen verdes: `npm --prefix packages/uxdsl-cli test`, `npm run
  verify:consumer-fixture`, `verify:beta2` a `verify:beta5`.

## Documentación

- `packages/uxdsl-core/README.md`: `compile()`, el contrato de `processUxdsl()` y el
  comportamiento de imports (inexistente y ciclo → error).
- `packages/uxdsl-cli/README.md`: la nueva dependencia de core.
- `packages/postcss-uxdsl/docs/migration.md`: los cambios para quien usaba core
  directamente (comentarios y ciclos).
- CHANGELOG beta.6.

## Criterios de aceptación

- [x] Las dos reproducciones dan CSS correcto y error, respectivamente.
- [x] La suite de paridad pasa para CLI y core.
- [x] `processUxdsl()` mantiene su firma y tipo de retorno.
- [x] No quedan `stripLineComments`, inline por strings ni implementación de respaldo
      en `uxdsl-core`.
- [x] El CLI no tiene un pipeline propio.

## Verificación

```bash
npm run test:parity
npm --prefix packages/uxdsl-core test
npm --prefix packages/uxdsl-cli test
npm run verify:consumer-fixture
npm run verify:beta2 && npm run verify:beta3 && npm run verify:beta4 && npm run verify:beta5
npm test
```

## Entrega

Dos commits:

1. `test(FEAT-008): MIG-B6-18 - parity suite with the current CLI output as oracle`
   (el paso 0; puede integrarse antes).
2. `feat(FEAT-008): MIG-B6-18 - one shared compile() in uxdsl-core, used by the CLI`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada en
`feat/feat-008-beta6-plan`** (integración a `main` pendiente).

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `cb1cbd4` (2026-09-21). Entrega: commit siguiente en `feat/feat-008-beta6-plan` (dos commits, ver "Entrega" arriba); PR pendiente de abrir |
| Reproducción antes del cambio | Script exacto de la sección "Reproducción" ejecutado sobre `cb1cbd4`: `url()`/comentario con `//` corrompidos (`.a { background: url(https:` cortado a mitad, `/* docs: https:` idem); `@import` inexistente compilaba sin error (`sin error: @import "./missing-partial.uxdsl";`); `$gap` responsive sin expandir. 2026-09-21 |
| Criterio → regresión | "CSS correcto y error" → `packages/uxdsl-core/test/compile.test.js` (tests `unquoted url()`, `block comment`, `nonexistent import`, `real import cycle`) + `fixtures/parity/` (`url-unquoted`, `comment-with-url`, `missing-import`, `import-cycle`). "Suite de paridad" → `fixtures/parity/run.js` (8 casos, oráculo en `fixtures/parity/expected/`). "`processUxdsl()` firma" → `compile.test.js`: "processUxdsl(source, options) keeps returning a Promise<string>". "Sin stripLineComments/inline por strings/respaldo" → verificado por lectura de `packages/uxdsl-core/src/index.ts` (reescrito completo) y `npm pack --dry-run` (sin `index.js` de respaldo en el tarball). "CLI sin pipeline propio" → `packages/uxdsl-cli/test/plugin-option-parity.test.js` (test `MIG-B6-18`, guarda estructural de que `uxdsl.js` reenvía a `uxdslCore.compile(...)`, no a un `postcss([...])` propio) |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, desde el root del monorepo: `npm run test:parity` (exit 0, 8/8), `npm --prefix packages/uxdsl-core test` (exit 0, 18/18), `npm --prefix packages/uxdsl-cli test` (exit 0, 132/132), `npm --prefix packages/postcss-uxdsl test` (exit 0, 227/227), `npm run verify:consumer-fixture` (PASS), `npm run verify:beta2` (PASS), `npm run verify:beta3` (PASS), `npm run verify:beta4` (PASS), `npm run verify:beta5` (PASS), `npm test` (exit 0, todas las suites en verde incluyendo `test:parity` ahora en la cadena), `npm --prefix packages/playground-nextjs run uxdsl:build` (OK) y `npx next build` en `packages/playground-nextjs` (build de producción completo, OK) |
| Resultado después / control negativo | Los tres casos de "Reproducción" ahora dan el resultado correcto (ver comando repetido arriba): `url()`/comentario intactos, `@import` inexistente falla con `Failed to find './missing-partial.uxdsl'` ubicado, `$gap` se expande a `gap: 1rem;` + `@media (min-width: 768px)`. Control negativo: CSS nativo sin funciones UXDSL compila sin cambios (`compile.test.js`, "positive control"); un import bare a un paquete real (`postcss-uxdsl/theme/default-colors.css`) sigue resolviendo (regresión real encontrada y corregida durante esta story — ver "Límites" abajo) |
| Cambios visuales o API / migración | API aditiva: `compile(input, config)` nuevo, exportado como `module.exports.compile`. `processUxdsl(source, options)` sin cambio de firma/retorno (D3 de FEAT-007). Cambio de comportamiento (no de API): un `@import` inexistente y un ciclo de imports ahora fallan en vez de compilar en silencio con salida incorrecta — documentado en migration.md |
| README / CHANGELOG / migration | `packages/uxdsl-core/README.md` (sección `compile(input, config?)` + nota en "Demo update notes"); `packages/uxdsl-cli/README.md` (nota sobre el pipeline compartido y los dos cambios de comportamiento visibles); `packages/postcss-uxdsl/docs/migration.md` (sección "Desde beta.6: un solo `compile()` compartido..."); no existe `CHANGELOG.md` propio en `uxdsl-core` ni `uxdsl-cli` — ambos paquetes documentan cambios en su propio README, siguiendo el patrón ya establecido en `uxdsl-core/README.md` ("Demo update notes") |
| AGENTS / guías / arquitectura | No aplica: este cambio es interno al pipeline de compilación (`uxdsl-core`/`uxdsl-cli`), no toca ninguna primitiva de diseño (`spacing`, `palette`, `surfaces`, etc.) ni el contrato documentado en `AGENTS.md` de este repo, que describe el motor unificado de forma agnóstica a cuál paquete corre el pipeline |
| Límites y seguimiento | (1) `uxdsl-core@0.5.0-beta.5` también está publicado en npm real, así que un `npm install --prefix packages/uxdsl-cli` en blanco lo resolvía desde el registro, pisando el enlace local — se detectó exactamente así al correr `npm --prefix packages/playground-nextjs run build` (su script `local-deps` reinstala `uxdsl-cli`). Corregido en este mismo cambio: `npm install ../uxdsl-core` dentro de `uxdsl-cli` (mismo mecanismo que ya traía `postcss-uxdsl`) hace que npm registre `"resolved": "../uxdsl-core", "link": true` en `package-lock.json`; se revirtió a mano la versión exacta (`0.5.0-beta.5`, no `file:../uxdsl-core`) en `package.json` y en el lockfile para mantener el estilo de dependencia coordinada por versión. Verificado con `npm install` repetido y con el flujo real de `playground-nextjs` (`local-deps` + `uxdsl:build` + `next build`): el symlink ya sobrevive. (2) `fixtures/parity/` compara el CLI (subproceso real) contra `compile()` (en proceso) para 8 casos representativos, no un corpus exhaustivo — cubre los bugs de esta story y de MIG-B6-14/15/17/29, no cada combinación de `@import`/condición documentada en "Pruebas" (p. ej. `@media`/`@supports`/`@layer` con duplicados en condiciones distintas está cubierto en `compile.test.js`, no en `fixtures/parity/`). (3) No se migró la resolución de imports condicionados (`media`/`supports`/`layer`) a un caso de paridad dedicado — cubierta sólo por el test unitario de `uxdsl-core`. (4) `sourceMap` sigue sin implementar (declarado, rechaza cualquier valor salvo `false`) — la implementación real es MIG-B6-21, fuera de alcance |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
