# MIG-B7-12 — Editor support para apps consumidoras: colores, autocompletado y tipos

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P1 · M |
| Cierra | R-17 |
| Depende de | — (el paso 5, recomendar la extensión desde el proyecto, sólo se activa cuando [MIG-B7-05](MIG-B7-05-publicar-extension.md) esté cumplida; ver el paso) |
| Bloquea | MIG-B7-11 (como todas las demás) |
| Archivos | `packages/uxdsl-cli/bin/uxdsl.js` (bloque `init`), `packages/uxdsl-cli/README.md`, `packages/postcss-uxdsl/README.md`, `packages/uxdsl-vscode/README.md`, `README.md` raíz, `fixtures/mig-b2-03-cli-init/run.js` |

## Por qué

Petición del dueño, 2026-09-23: *"¿cómo hago para que una app que la usa tenga
autocompletado y colores en código?"*. La respuesta honesta a esa pregunta hoy
es "hay dos mecanismos y ninguno llega solo al consumidor". Esta story cierra
esa distancia **sin construir nada nuevo en el motor ni en la extensión**: sólo
conecta y documenta lo que ya existe.

No es residuo de FEAT-008 — es la única fila (R-17) de este plan que nace de
una petición posterior, y por eso su "Por qué" cita verificación directa, no
una ficha anterior.

## Estado verificado (2026-09-23, no asumido)

Cada punto se comprobó ese día contra el repositorio o el registro:

1. **Colores y completado en `.uxdsl`** los da la extensión `uxdsl-vscode@0.1.0`
   (gramática TextMate + completado contextual + `uxdsl.custom-data.json`).
   **No está publicada** (R-06 → MIG-B7-05): sólo se instala desde un `.vsix`.
2. **`uxdsl init` no conecta nada de esto.** Leído en el bloque `init` de
   `packages/uxdsl-cli/bin/uxdsl.js` (líneas ~1760–1900): escribe
   `uxdsl.config.cjs`, el/los entry `.uxdsl`, `postcss.config.*` (sólo Next) y
   los scripts `uxdsl:build`/`uxdsl:watch`. No escribe `.vscode/`, no crea un
   tema con `$schema`, y la config que genera es un `module.exports = {…}`
   plano, sin `defineConfig` ni tipo JSDoc.
3. **Los README que un consumidor lee no dicen cómo obtener el resaltado.** El
   del CLI y el de `postcss-uxdsl` documentan `$schema` y `defineConfig`
   (secciones "Typed config") pero ninguno menciona la extensión ni cómo
   instalarla. El README raíz dice "VS Code now suggests `radius(key)` y
   `shadow(key)`…" sin decir cómo. La única instrucción de instalación vive en
   `packages/uxdsl-vscode/README.md`.
4. **Lo que sí funciona hoy sin la extensión:** `schema/theme.schema.json` está
   en `files` y en `exports` de `postcss-uxdsl` (`./schema/theme.schema.json`),
   y `defineConfig` sale de `postcss-uxdsl/config`. Es decir: autocompletado del
   JSON de tema y tipos de la config funcionan con beta.6 ya publicada; falta
   que alguien se lo diga al consumidor y que `init` lo deje puesto.
5. **El `.vsix` local no está desactualizado en tones**: el construido el
   2026-09-22 ya trae las 11 tones (leído de `out/generated-completions.js`
   dentro del zip). Pero es un artefacto local, ignorado por git
   (`.gitignore: *.vsix`), no reproducible desde CI hasta MIG-B7-04.

## Reproducción

```bash
# Paso 0: comprobar con salida real, no con lectura de código
mkdir /tmp/uxdsl-init-probe && cd /tmp/uxdsl-init-probe
npm init -y >/dev/null
node /ruta/al/repo/packages/uxdsl-cli/bin/uxdsl.js init
ls -la . src        # ¿existe .vscode/? ¿algún uxdsl.theme.json?
cat uxdsl.config.cjs
```

Salida esperada hoy: `uxdsl.config.cjs` plano, sin `.vscode/`, sin tema. Repetir
con `init --multi` y dentro de un proyecto con `next` y con `vite` en
`package.json` (los tres ramales de `init`).

## Resultado esperado

Un desarrollador que instala UXDSL en una app nueva siguiendo **sólo el README
del CLI** llega a:

1. Colores y completado en sus `.uxdsl` (con un `.vsix` hoy; con Marketplace
   cuando MIG-B7-05 se cumpla), sabiendo exactamente qué da y qué no.
2. Autocompletado en su JSON de tema, vía `$schema`.
3. Tipos y detección de typos en `uxdsl.config.cjs`.

…sin tener que abrir el README de otro paquete ni adivinar rutas.

## Implementación

1. **Reproducir** (paso 0 de arriba) y registrar los tres ramales de `init`.
2. **Config generada, tipada.** Cambiar la config que `init` escribe a la forma
   ya documentada en el README del CLI. Decidir con evidencia entre dos
   variantes, y **preferir la segunda salvo que la primera resuelva siempre**:
   (a) `const { defineConfig } = require('postcss-uxdsl/config')` +
   `@type` JSDoc; (b) sólo el `@type` JSDoc
   (`/** @type {import('postcss-uxdsl/config').UxdslConfig} */`), que no ejecuta
   nada en tiempo de ejecución. Riesgo real de (a): si `postcss-uxdsl` no es
   resoluble desde la raíz del proyecto (por ejemplo pnpm con `node_modules`
   estricto), el `require` **rompe el build** en vez de sólo perder el tipo.
   Comprobarlo bajo npm, pnpm y yarn antes de elegir; con (b) la peor
   consecuencia es que el editor no tipe, no que el build falle.
3. **Tema con `$schema`.** Investigar si `init` puede crear un
   `uxdsl.theme.json` mínimo con sólo `$schema`, **sin cambiar el CSS
   compilado** (comparar byte a byte contra cero-config) **ni añadir mensajes**
   al build (por ejemplo el log `Theme config detected`). Si cambia cualquiera
   de las dos cosas, **no scaffoldar**: documentar en su lugar el archivo y la
   línea a añadir. La ruta relativa
   `./node_modules/postcss-uxdsl/schema/theme.schema.json` puede no resolver en
   un monorepo o con node_modules hoisted: documentar la alternativa, no
   asumir la ruta.
4. **Línea de "Next steps" de `init`** sobre editor support, con lo que hoy es
   verdad (VSIX / README), sin nombrar el Marketplace mientras la extensión no
   esté publicada.
5. **Recomendar la extensión desde el proyecto (`.vscode/extensions.json`) —
   condicionada a MIG-B7-05.** Sólo cuando la extensión exista en Marketplace.
   Aplicar la misma política que `init` ya tiene para `postcss.config.*`
   (MIG-B2-03 ítem 5): **nunca sobrescribir ni anexar** a un archivo existente;
   si existe, imprimir el fragmento para fusionar a mano. Antes de escribir la
   recomendación, comprobar en un VS Code real qué hace con un ID recomendado
   que aún no existe — no está verificado aquí.
6. **Documentación** (ver abajo). Es la mitad del valor de la story: hoy el
   consumidor no tiene por dónde enterarse.
7. **Otros editores.** `uxdsl.custom-data.json` sigue el formato de CSS custom
   data, que otros editores pueden leer. Documentar sólo lo que se probó; no
   prometer WebStorm/Neovim sin haberlo verificado.

## Fuera de alcance

- Completado según el tema **del proyecto** (roles/tones propios): es
  [MIG-B7-13](MIG-B7-13-editor-tema-del-proyecto.md), bloqueada por D-11.
  Esta story documenta ese límite tal como lo declara el README de la
  extensión, no lo resuelve.
- Publicar la extensión (MIG-B7-05) y validarla en CI (MIG-B7-04).
- Diagnósticos en vivo, hover, ir a la definición, LSP.
- Cambiar la gramática o el completado de la extensión.

## Pruebas

- Tests de `init` en `packages/uxdsl-cli/test/` para `init`, `init --multi` y los
  ramales Next/Vite: escribe lo esperado; **es idempotente** (una segunda
  corrida no cambia nada); **nunca sobrescribe** una config, un tema o un
  `.vscode/extensions.json` existentes.
- **Salida compilada idéntica:** el CSS que produce un proyecto recién
  inicializado es byte-idéntico antes y después de este cambio. Es el control
  que impide que "scaffoldar editor support" cambie el comportamiento de un
  consumidor sin querer.
- Extender `fixtures/mig-b2-03-cli-init/run.js` (ya corre en `npm test`) para
  comprobar desde **tarballs reales** que la ruta del `$schema` que se
  documenta existe dentro del paquete instalado.
- **Lo que NO se puede automatizar aquí y se lista aparte, nunca como PASS:**
  que VS Code real resalte y complete. Checklist manual del dueño: abrir el
  proyecto; un `.uxdsl` se resalta; `padding:` ofrece funciones;
  `@ds-button(` ofrece roles y tones; el JSON de tema completa `palette`; un
  typo en `uxdsl.config.cjs` se marca.

## Documentación

- `packages/uxdsl-cli/README.md`: nueva sección **"Editor support"**, que es
  donde el consumidor empieza. Los dos mecanismos (extensión y `$schema`/tipos),
  qué da cada uno, qué no da, y cómo instalar el `.vsix` hoy.
- `packages/postcss-uxdsl/README.md`: enlace a esa sección desde "Typed config".
- `packages/uxdsl-vscode/README.md`: instalación desde un `.vsix` construido por
  CI (cuando MIG-B7-04 exista) en lugar de "compílalo tú"; el trade-off de
  `files.associations → scss` se mantiene tal cual.
- `README.md` raíz: donde dice que VS Code sugiere `radius(key)`/`shadow(key)`,
  decir cómo obtenerlo.
- `packages/postcss-uxdsl/CHANGELOG.md` y del CLI, sólo si cambia lo que `init`
  escribe (es un cambio de comportamiento del CLI, aunque no visual).

## Criterios de aceptación

- [x] `init` (single, `--multi`, Next, Vite) deja una config tipada según la
      variante elegida con evidencia en el paso 2.
- [x] El `$schema` queda scaffoldado, o la ficha registra con evidencia por qué
      no (el CSS cambia o el build emite algo nuevo). — **No se scaffolda**: el
      build emite `[uxdsl] Theme config detected`.
- [x] `init` es idempotente y no sobrescribe nada existente.
- [x] La salida compilada de un proyecto recién inicializado es byte-idéntica.
- [x] El README del CLI explica, sin salir de él, cómo obtener colores,
      completado y tipos.
- [x] La verificación en VS Code real está registrada como manual y pendiente
      o hecha por el dueño — nunca marcada como automatizada. — **Pendiente del
      dueño** (ver "Límites y seguimiento").

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
node fixtures/mig-b2-03-cli-init/run.js
npm test
npm run verify:docs
```

## Entrega

`feat(FEAT-009): MIG-B7-12 - editor support for consumer apps (init scaffolding, docs)`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente** en
`feat/mig-b7-12-editor-support`. Integración a `main` pendiente. Pasos 1–4, 6 y 7
hechos; **paso 5 (`.vscode/extensions.json`) diferido**: su condición
(MIG-B7-05, extensión en Marketplace) no se cumple.

### Decisión del paso 2, con evidencia

La story prefería (b) "sólo el `@type` JSDoc". Medido el 2026-09-28 con tarballs
reales (`npm pack` de `postcss-uxdsl`, `uxdsl-core` y `uxdsl-cli` del SHA base),
TypeScript 5.9.3, bajo **npm 10.8.2, pnpm 9.15.0 y Yarn 1.22.22** (los dos
últimos vía `corepack`), cada uno con ambos paquetes instalados y con sólo
`uxdsl-cli` instalado (`postcss-uxdsl` transitivo):

| Gestor · instalación | `postcss-uxdsl` resoluble desde la raíz | build con (a) `require` + `defineConfig` | build con (b) | tipo resuelto (a) / (b) |
| --- | --- | --- | --- | --- |
| npm · ambos | sí | 0 | 0 | sí / sí |
| npm · sólo CLI | sí (hoisted) | 0 | 0 | sí / sí |
| pnpm · ambos | sí | 0 | 0 | sí / sí |
| **pnpm · sólo CLI** | **no** | **1 — `Cannot find module 'postcss-uxdsl/config'`** | **0** | TS2307 / TS2307 |
| Yarn 1 · ambos | sí | 0 | 0 | sí / sí |
| Yarn 1 · sólo CLI | sí (hoisted) | 0 | 0 | sí / sí |

El riesgo de (a) que la story anticipaba es real: pnpm estricto rompe el build.
**Hallazgo al medir (b) tal como estaba escrita:** `/** @type {…UxdslConfig} */`
justo encima de `module.exports = {…}` **no comprueba nada** — ni el typo
`includeThem` ni `entry: 123` (tsc exit 0 en `node16` y `bundler`). Con el
`@type` sobre un `const` que luego se exporta: typo → TS2561, tipo erróneo →
TS2322, `entry` y `builds` a la vez → TS2322, typo dentro de `builds[]` →
TS2561; config válida → 0. Y sin `// @ts-check` no se reporta nada (tsc exit 0
con el typo), porque `checkJs` está apagado por defecto, también en VS Code. Por
eso la variante elegida es **(b) corregida**: `// @ts-check` + `@type` sobre
`const config` + `module.exports = config`. Sin `require`: en el caso
pnpm-sólo-CLI se pierde el tipo (el editor marca TS2307 en el import de tipo),
pero el build pasa. La resolución que VS Code 1.139.1 usa para un `.cjs` sin
`jsconfig` (`module: Preserve`, `moduleResolution: Bundler`, leída del
`typescript-language-features` instalado) se probó con tsc; `node10` no resuelve
el mapa `exports` (TS2307) y no es la de un VS Code actual.

Efecto en la documentación: el README del CLI y el de `postcss-uxdsl` mostraban
`@type` encima de `module.exports = defineConfig({…})` y decían que "VS Code
type-checks JSDoc in plain .js/.cjs files". Lo que comprobaba era `defineConfig`
(su parámetro está tipado), no el `@type`; y sin `// @ts-check` el editor no
reporta nada. Ambos README corregidos.

### Decisión del paso 3, con evidencia

Proyecto instalado desde tarballs (npm), mismo entry. Cero-config →
`src/uxdsl.css` de 50 783 bytes, sha256 `8e813e1a…`, stdout
`[uxdsl] built src/uxdsl.css (50783 bytes)`. Con un `uxdsl.theme.json` que sólo
contiene `{ "$schema": "./node_modules/postcss-uxdsl/schema/theme.schema.json" }`:
**mismo CSS byte a byte** (mismo sha256) **pero stdout gana
`[uxdsl] Theme config detected`** (igual con `{}`). Por la regla de la story,
**no se scaffolda**: se documentan el archivo y la línea (README del CLI,
"Editor support"), con la alternativa para monorepos (ruta relativa al
`node_modules` hoisted, o `json.schemas` en `.vscode/settings.json`). Además,
`theme --diff` con ese archivo lista `$schema` como fila `source: "project"`
(ver "Límites y seguimiento").

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `dcd8a26` (`origin/main`). Entrega: rama `feat/mig-b7-12-editor-support`, SHA fijado al mergear. PR: pendiente de mergear |
| Reproducción antes del cambio | 2026-09-28, CLI de este checkout en el SHA base, directorios vacíos con `npm init -y`: **plain** → `package.json`, `src/uxdsl-entry.uxdsl`, `uxdsl.config.cjs`; **`--multi`** → además `src/theme.uxdsl` y `src/panel-a.uxdsl`; **Next** (`next.config.js`) → además `postcss.config.js`; **Vite** (`vite.config.js`) → como plain. En los cuatro: sin `.vscode/`, sin `uxdsl.theme*`, config `module.exports = {…}` plana y sin tipo; "Next steps" sin mención de editor. Coincide con el "Estado verificado" del 2026-09-23 |
| Criterio → regresión | `packages/uxdsl-cli/test/init.test.js` (19 tests, subproceso real en directorios temporales). Por ramal (plain, multi, next, vite): config tipada sin `require` que exporta el mismo objeto que la plantilla anterior (`deepEqual`); CSS y log de build byte-idénticos a los de la config anterior literal; segunda corrida sin cambios (hash de todos los archivos) y sin tema ni `.vscode/`; nunca sobrescribe config, `uxdsl.theme.json` ni `.vscode/extensions.json` existentes. Además: config generada limpia con tsc en `preserve`/`bundler` y `node16` (plain y multi), typo → TS2561 sin TS2307, y sin `// @ts-check` → nada (la línea es necesaria); build con la config tipada sin `node_modules` en el proyecto pasa, y con `require('postcss-uxdsl/config')` falla (control); "Next steps" nombra editor support y `.vsix`, no un marketplace. `fixtures/mig-b2-03-cli-init/run.js` sección (10), desde un **tarball real** de `postcss-uxdsl`: la ruta `$schema` documentada existe, es un JSON Schema y es la que resuelve el mapa `exports`; `dist/config.d.ts` viaja; la config de `init` compila limpia contra el paquete instalado y un typo da TS2561, no TS2307 |
| Comandos y entorno | macOS (Darwin 27.0.0), Node v20.19.0, npm 10.8.2, pnpm 9.15.0 y Yarn 1.22.22 vía corepack, TypeScript 5.9.3; VS Code 1.139.1 instalado (sólo se leyó su configuración de proyecto implícito; no se abrió). `node --test packages/uxdsl-cli/test/init.test.js` → 19/19. `node fixtures/mig-b2-03-cli-init/run.js` → PASS. `npm run verify:doc-examples` → exit 0 (45 ejemplos, 29 excerpts). `npm run verify:docs` → exit 0. `node scripts/generate-language-artifacts.js --check` → exit 0. `npm run verify:vscode-extension` → PASS (el `npm run package` que indica el README produce el `.vsix`). `npm test` (raíz) → exit 0, **738 pass / 0 fail** en los tests `node --test` (719 en el SHA base + 19), más las fixtures de script (parity, `mig-b2-03-cli-init`, generación de lenguaje) en PASS |
| Resultado después / control negativo | Después: 19/19. **Control negativo:** con `packages/uxdsl-cli/bin/uxdsl.js` de `origin/main` y los tests nuevos fallan **6 de 19** (los 4 de "config tipada", el de tsc y el de "Next steps"); los 13 que pasan son los invariantes que ya se cumplían (CSS idéntico, idempotencia, no sobrescribir), como debe ser. CSS de un proyecto inicializado con el CLI anterior frente a uno inicializado con el nuevo: `cmp` idéntico, sha256 `9449e110…` en ambos (50 883 bytes) |
| Cambios visuales o API / migración | Sin cambio visual. **Cambio de comportamiento del CLI**: lo que `init` escribe en `uxdsl.config.cjs` (tipado) y tres líneas nuevas al final de "Next steps". Proyectos existentes: nada cambia (`init` no reescribe una config existente). Sin migración |
| README / CHANGELOG / migration | `packages/uxdsl-cli/README.md`: sección nueva **"Editor support"** (tabla de los tres mecanismos; config tipada y por qué importa cada detalle; `$schema`, por qué `init` no lo crea, ruta en monorepo y `json.schemas`; extensión: qué da, qué no y cómo instalar el `.vsix` hoy; otros editores: sólo VS Code probado) y el párrafo "Let your editor check it" corregido. `packages/postcss-uxdsl/README.md` "Typed config": enlace a esa sección y ejemplo corregido (`const` + `// @ts-check`; `defineConfig` como alternativa, con su riesgo). `packages/uxdsl-vscode/README.md`: `code --install-extension`, nota de CI futura (MIG-B7-04), enlace; la frase "work in any editor that supports the CSS custom data format" rebajada a lo probado (paso 7). `README.md` raíz: de dónde sale la sugerencia de VS Code y cómo obtenerla. `packages/postcss-uxdsl/CHANGELOG.md` `0.5.0-beta.7`: entrada MIG-B7-12 (el CLI no tiene CHANGELOG propio; sus cambios se registran ahí, como en entradas anteriores). `docs/migration.md`: sin cambios |
| AGENTS / guías / arquitectura | `AGENTS.md`: sección nueva "Editor support in a consuming project" (la forma de la config que no hay que romper, no crear un tema sólo para `$schema`, alcance de la extensión) |
| Límites y seguimiento | (1) **Manual, pendiente del dueño — no automatizado:** en un VS Code real con el `.vsix` instalado, abrir un proyecto recién inicializado: un `.uxdsl` se resalta; `padding:` ofrece funciones; `@ds-button(` ofrece roles y tones; el JSON de tema con `$schema` completa `palette`; `includeThem` en `uxdsl.config.cjs` se subraya; y la variante `json.schemas` con `url` relativa resuelve. Lo automatizado es tsc con las opciones que VS Code usa, no el editor. (2) **Paso 5 diferido** hasta MIG-B7-05; el test de "no sobrescribir `.vscode/extensions.json`" ya existe y seguirá valiendo. (3) Otros editores (paso 7): **no probados**; la documentación lo dice sin prometer nada. (4) pnpm y Yarn sólo en 9.15.0 y 1.22.22 (Yarn Berry/PnP no probado). (5) **Hallazgo, no corregido (fuera de alcance):** `uxdsl theme --diff` lista `$schema` como fila `source: "project"` aunque sea metadato que no compila; documentado en el README del CLI. Candidato para MIG-B7-08 o una story propia |
