# MIG-B6-18 — `compile()` compartido en `uxdsl-core`

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | C — Un solo pipeline (**camino crítico**) |
| Prioridad · Tamaño | P0 · L |
| Cierra | UX-02, N-02, N-06. Es la base de UX-16 (con MIG-B6-20) y de UX-20 (con MIG-B6-21) |
| Depende de | — (el paso 0, la suite de paridad, empieza en la ola 1) |
| Bloquea | MIG-B6-19, MIG-B6-20, MIG-B6-21, MIG-B6-23, MIG-B6-24, MIG-B6-26, MIG-B6-28 (evaluación de `postcss-advanced-variables`) |
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

0. **Suite de paridad, antes del refactor.** Se puede empezar en la ola 1.
   - Crear `fixtures/parity/` con una entrada por caso: `url()` sin comillas,
     comentario de bloque con URL, comentarios `//`, `$vars` con valores responsive,
     imports anidados, import inexistente, ciclo de imports, import duplicado.
   - Un runner (`fixtures/parity/run.js`, con `npm run test:parity` en la raíz)
     compila cada caso con el CLI y guarda la salida como oráculo en
     `fixtures/parity/expected/`.
   - Los casos que hoy fallan en el CLI (import inexistente) guardan el código de
     error esperado.
1. **API aditiva** en `uxdsl-core`:
   ```ts
   compile(input: { entry: string } | { source: string; from?: string }, config?: {
     theme?; references?; breakpoints?; includeTheme?; sourceMap?: false | 'inline' | 'external';
   }): Promise<{ css: string; map?: string; dependencies: string[]; warnings: Array<{ text: string; file?: string; line?: number; column?: number }> }>
   ```
   Usa exactamente el pipeline del CLI: sintaxis `postcss-scss`, `postcss-import`
   con el resolvedor de `.uxdsl` (mover `createImportResolver` del CLI a core),
   `postcss-advanced-variables` y `postcss-uxdsl`. Llevar a `compile()` también el
   metadata de breakpoints que hoy agrega sólo el CLI (`/*@uxdsl-bp …*/` y
   `#uxdsl-bp-meta`, `uxdsl.js:710-720`), con la misma condición `includeTheme`.
   `dependencies` sale de `result.messages` de tipo `dependency`. `sourceMap` queda
   declarado pero lo implementa MIG-B6-21: por ahora, sólo `false`.
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

- [ ] Las dos reproducciones dan CSS correcto y error, respectivamente.
- [ ] La suite de paridad pasa para CLI y core.
- [ ] `processUxdsl()` mantiene su firma y tipo de retorno.
- [ ] No quedan `stripLineComments`, inline por strings ni implementación de respaldo
      en `uxdsl-core`.
- [ ] El CLI no tiene un pipeline propio.

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
