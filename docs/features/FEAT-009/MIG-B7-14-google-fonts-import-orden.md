# MIG-B7-14 — El `@import` de Google Fonts queda después de `:root` y el navegador lo ignora

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | **P0** · S |
| Cierra | R-19 |
| Depende de | — |
| Bloquea | MIG-B7-11 |
| Archivos | `packages/postcss-uxdsl/src/index.ts` (orden de los `prepend`, ~líneas 195 y 590), `packages/postcss-uxdsl/test/fonts.test.js`, `packages/postcss-uxdsl/test/default-theme.test.js`, `fixtures/mig02-nextjs-cssmodules/` (job de navegador), `packages/postcss-uxdsl/CHANGELOG.md` |

## Por qué

**Es un defecto de `0.5.0-beta.6` ya publicada**, no un residuo de FEAT-008.
Lo reportó un consumidor real en beta.6 (feedback pegado por el dueño el
2026-09-23) como "`@import` mal ubicado"; se verificó ese mismo día contra los
paquetes publicados, no contra el repositorio.

## Estado verificado (2026-09-23, no asumido)

1. **Reproducción con el paquete publicado.** Proyecto limpio,
   `npm i -D postcss-uxdsl@0.5.0-beta.6 uxdsl-cli@0.5.0-beta.6`, `uxdsl init`,
   `uxdsl build`. En `src/uxdsl.css`: la línea 1 es
   `:root { --uxdsl__density__0: 0; …` y la línea 2 es
   `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`.
   Sólo hay una regla antes del `@import`, y basta una.
2. **El navegador lo ignora.** CSS exige que `@import` preceda a cualquier otra
   regla (salvo `@charset` y `@layer`). Comprobado en Chrome real
   (`playwright-core` + `/Applications/Google Chrome.app`), con un import
   `data:` local para no depender de la red:

   | CSS | `background-color` de `body` |
   | --- | --- |
   | control: `@import` primero, luego `:root{--a:1}` | `rgb(255, 0, 0)` — aplica |
   | `:root{--a:1}` y luego el mismo `@import` | `rgba(0, 0, 0, 0)` — **ignorado** |
   | el `src/uxdsl.css` real compilado por beta.6, con su `@import` de Google sustituido por el import `data:` | `rgba(0, 0, 0, 0)` — **ignorado** |

   Consecuencia: Inter no se descarga; el texto cae a `Inter, sans-serif` con lo
   que tenga el sistema, **sin ningún aviso** del compilador ni del navegador.
3. **Causa.** En `packages/postcss-uxdsl/src/index.ts`, el `@import` se antepone
   en ~195 (`root.prepend(importRule)`). Más adelante, en ~590, las reglas
   `:root` de densidad sin media query también se anteponen
   (`if (compiled.minWidth === null) root.prepend(rule)`). Cada `prepend`
   inserta en el índice 0, así que la última en ejecutarse queda primera: la
   densidad queda por delante del `@import`.
4. **Por qué ningún test lo atrapó.** `fonts.test.js:98` afirma que
   `generateThemeCss` **empieza** con el `@import`. Lo que se afirma sobre el
   plugin (`fonts.test.js:72`, `default-theme.test.js:198`) es la URL y la
   presencia, no la posición. Es decir: "el import va primero" está probado para
   el camino de runtime/SSR y no para el de build, que es el que usa el CLI.
5. **Los caminos no son equivalentes.** `generateThemeCss` (runtime/SSR) sí lo deja
   primero (verificado). El CLI/`compile()` no. **Corrección del 2026-09-23, al
   implementar:** este punto decía que el plugin llamado directamente sobre un CSS
   mínimo "no emitió `@import`" y que no se sabía por qué. Fue un artefacto de la
   medición: se buscó por texto (`línea que empieza con @import`) y esa salida
   venía en una sola línea. Medido sobre el árbol (AST), el plugin con cualquier
   opción (`{}`, `includeTheme: true`, `theme: {}`), sobre cualquier fuente, deja el
   `@import` en la **posición 2 de 21**, detrás del `:root` de densidad — igual que
   el CLI. Sólo `generateThemeCss` lo deja en la posición 1.
5b. **Mismo defecto, dos casos más que el reporte original no mencionaba**
   (medidos con el plugin real, `includeTheme: true`): un `@import url(…)` que
   escribe el propio autor queda **también** detrás del `:root` y se descarta; y un
   `@charset` del autor queda detrás de él, cuando sólo se respeta como primer
   elemento del archivo. Misma causa, así que se corrigen juntos.
6. **Alcance.** Toda salida con `includeTheme: true` (el valor por defecto) y un
   tema con `fonts.google` — y el tema base lo trae. Las entradas con
   `includeTheme: false` no emiten el import. **No verificado:** si el pipeline
   de un bundler concreto (Next, Vite) reubica el `@import` antes de entregarlo
   al navegador; lo comprobado es la salida cruda del CLI.
7. **Mitigación conocida (según el consumidor, no verificada aquí):**
   `fonts: { google: [] }` en el tema quita el import por completo.

## Reproducción

```bash
mkdir /tmp/probe && cd /tmp/probe && npm init -y
npm i -D postcss-uxdsl@0.5.0-beta.6 uxdsl-cli@0.5.0-beta.6
npx uxdsl init && npx uxdsl build
head -3 src/uxdsl.css | cut -c1-90          # línea 1: :root…  línea 2: @import…
awk '/@import/{exit} {n++} END{print n" línea(s) antes del @import"}' src/uxdsl.css
```

Salida esperada hoy: `1 línea(s) antes del @import`.

## Resultado esperado

En el CSS compilado, todo `@import` es lo primero que hay (comentarios aparte).
La URL no cambia; sólo su posición.

## Implementación

1. **Reproducir (paso 0)** con el bloque de arriba, más el plugin llamado
   directamente con el mismo tema, y registrar por qué esa salida no mostró
   `@import` (punto 5).
2. **Test que falle con el código actual:** compilar con el plugin y con
   `compile()` de `uxdsl-core` (el camino del CLI) y afirmar que el primer nodo
   no-comentario de la raíz es un `@import`. **Posición, no sólo presencia.**
   Incluir el caso de varias familias (varios `@import`, en orden).
3. **Corregir en el dueño (`index.ts`)**, sin parser ni paso paralelo. **Ver "Lo que
   realmente pasó" abajo: la estrategia prevista (reordenar los `prepend`, o
   hoistear los `@import` al final) se descartó por una razón concreta.** Se
   comprobó con `grep` que sólo había dos inserciones al inicio (~195 y ~590) y que
   sí aparecía `@charset` desplazado (punto 5b).
4. **Navegador real, no sólo texto.** El job de navegador ya existente
   (`verify:cssmodules-build`) intercepta localmente las peticiones a
   `fonts.googleapis.com`. Extenderlo: cargar el CSS **compilado** y afirmar que
   la petición **se hace**. Es la única prueba que cubre lo que importa (que el
   navegador honre el import); una aserción de texto no lo prueba.
5. **CHANGELOG con `### Visual changes`** — y con dos consecuencias explícitas,
   porque este arreglo cambia lo que ven y hacen los usuarios finales:
   (a) la tipografía **cambia**: Inter empieza a cargarse donde antes se
   ignoraba; (b) los navegadores **empiezan a pedir** `fonts.googleapis.com`
   donde antes no lo hacían. Quien no quiera esa petición ya tiene la salida
   documentada: `fonts: { google: [] }`.
6. **Corregir el registro, no reescribirlo:** anotar en la evidencia de
   MIG-B6-29 fase 4 (o en su lugar, en esta ficha) que la equivalencia
   plugin/runtime que se dio por cerrada comparaba URLs, y que la posición sólo
   estaba probada en `generateThemeCss`.

## Lo que realmente pasó (durante la implementación, 2026-09-23)

1. **Primer intento: hoistear.** Un paso final que movía todo `@import` de nivel
   superior delante del primer nodo bloqueante. Arregló el caso de Google Fonts y
   el del `@import` del autor, y dejó 10 de los 11 tests de ese momento en verde (después se añadió el de orden de capas, el 12.º).
2. **Lo descartó su propio test de `@charset`/`@layer`.** El test mostró que el
   `@charset` del autor seguía detrás del `:root` (y ahora además detrás de los
   imports movidos). Al razonar el caso de `@layer` apareció un problema más
   serio: hoistear **mueve nodos del autor**, y `@layer y, x;` seguido de
   `@import url(a) layer(x);` se rompe si el import pasa por delante de la
   sentencia que ordena las capas — el import menciona `x` primero y la cascada se
   invierte **en silencio**, en una entrada que antes era válida.
3. **Estrategia final: insertar, no mover.** Los nodos del tema se insertan
   *después* del preludio del autor (`@charset`, `@layer` sin cuerpo, `@import` y
   comentarios iniciales) con un helper (`insertAfterLeading`, `src/index.ts`): los
   imports del tema tras el `@charset`, la densidad tras todo el preludio. Nada de
   lo escrito por el autor cambia de orden — ni sus imports entre sí ni su
   `@layer` respecto de su import — y un árbol que ya estaba bien no se toca.
   Resultado: `@charset` → imports del tema → preludio del autor tal cual →
   `:root`.
4. **Ámbito ampliado respecto de la ficha:** además del `@import` de Google Fonts,
   quedan arreglados el `@import` del propio autor y su `@charset` (punto 5b).
   Es un cambio de comportamiento observable para consumidores (un import que se
   descartaba en silencio ahora se aplica); por eso el CHANGELOG lo declara en
   `Visual changes` junto con el de Inter.

## Fuera de alcance

- Cambiar la URL, la lista por defecto de `fonts.google` o el tema base.
- Autoalojar fuentes (self-hosting).
- **Elegir el canal de publicación.** Es un defecto en una versión publicada:
  si sale en un `beta` adelantado o junto con el siguiente release es decisión
  del dueño, no de esta ficha.

## Pruebas

- Posición del `@import` en plugin y en `compile()`, cero-config y con tema
  propio; varios `@import` en orden.
- Control válido: `fonts: { google: [] }` → sin `@import` y sin cambios en el
  resto de la salida.
- Control: `generateThemeCss` sigue empezando por el `@import` (ya cubierto).
- Navegador: la petición a `fonts.googleapis.com` ocurre al cargar el CSS
  compilado.
- **Control negativo:** revertir el arreglo debe hacer fallar el test de
  posición y el de navegador.

## Documentación

- `packages/postcss-uxdsl/CHANGELOG.md`: entrada con `Visual changes` (punto 5).
- `AGENTS.md`: la frase sobre `generateThemeCss` y el `@import` es exacta para
  ese camino; añadir que el CLI/plugin ahora también lo garantiza sólo después
  de este arreglo, no antes.

## Criterios de aceptación

- [x] En la salida del CLI, plugin y `generateThemeCss`, todo `@import` va
      antes de cualquier regla (después de `@charset`).
- [x] Un test de posición falla con el código anterior y pasa con el nuevo
      (7 fallan en `postcss-uxdsl` y 2 en `uxdsl-core` sin el arreglo).
- [x] En Chrome real, el CSS compilado provoca la petición a Google Fonts (una,
      a `family=Inter`) y aplica el `@import` del autor.
- [x] El CHANGELOG declara el cambio visual y la nueva petición de red.
- [x] `fonts: { google: [] }` sigue funcionando como salida.

## Verificación

```bash
node --test packages/postcss-uxdsl/test/fonts.test.js
npm --prefix packages/postcss-uxdsl test
npm test
UXDSL_CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run verify:cssmodules-build
npm run verify:beta6
```

## Entrega

`fix(FEAT-009): MIG-B7-14 - Google Fonts @import must precede every other rule in compiled output`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente** en
`feat/mig-b7-14-google-fonts-import-order`. Integración a `main` pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `b53e061` (rama del plan `docs/feat-009-beta7-plan`, sobre `main` `73c7146`). Entrega: `43c3e18` en `feat/mig-b7-14-google-fonts-import-orden` (nombre real de la rama: `feat/mig-b7-14-google-fonts-import-order`). PR: pendiente de mergear; el SHA se fijó en un commit posterior, mismo patrón que MIG-B6-21 |
| Reproducción antes del cambio | 2026-09-23, sobre el paquete **publicado** (`postcss-uxdsl@0.5.0-beta.6`, `uxdsl-cli@0.5.0-beta.6`, proyecto limpio): `src/uxdsl.css` con el `:root` de densidad en la línea 1 y el `@import` en la 2. Sobre el repo, medido en el AST: plugin `{}`/`{includeTheme:true}`/`{theme:{}}`, sobre cualquier fuente, `@import` en la **posición 2 de 21**; `generateThemeCss` en la posición 1. Con `@import` propio del autor: `:root -> @import(Google) -> @import(autor) -> .a` (ambos detrás). Con `@charset`, `@layer` e `@import` del autor: `@import, @import, :root, @charset, @layer, …` |
| Criterio → regresión | Posición en el plugin y casos límite → `packages/postcss-uxdsl/test/import-order.test.js` (12 tests: cero-config, cualquier fuente, varias familias, `@import` propio, varios propios en orden, `fonts.google: []`, `includeTheme: false`, `@charset`+`@layer`, orden de capas del autor, `@import` anidado en `@media`, idempotencia, `generateThemeCss`). Camino del CLI → `packages/uxdsl-core/test/import-order.test.js` (4 tests, incluido un import remoto que llega vía un parcial inlineado por `postcss-import`). Navegador → `fixtures/mig02-nextjs-cssmodules/browser-import-order.js`, ejecutado por `npm run verify:cssmodules-build` |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, Chrome vía `playwright-core`. `npm --prefix packages/postcss-uxdsl test` → exit 0, **396/396** (384 + 12) + 1 de rendimiento. `npm --prefix packages/uxdsl-core test` → los 4 nuevos pasan (desde su suite). `npm test` (raíz) → exit 0, **700 ok / 0 not ok** (684 + 12 + 4), incluidos parity y adaptadores. `UXDSL_CHROME_PATH=… npm run verify:cssmodules-build` → exit 0, PASS (incluye el chequeo nuevo). `npm run verify:beta6` → **26/26**, exit 0, **al segundo intento**: el primero falló con `ETIMEDOUT` (`spawnSync npm`, límite de 3 min de la fixture) durante la descarga de dependencias del registro para instalar los tarballs, sin ninguna comprobación fallida; el reintento, sin otra carga en la máquina, pasó |
| Resultado después / control negativo | Después: `import-order.test.js` 12/12; `uxdsl-core` 4/4; en Chrome, con el CSS compilado por el paquete **empaquetado** (`npm pack`, instalado en `fixtures/mig07-consumer`): **una** petición a `fonts.googleapis.com` con `family=Inter` y el `@import` del autor aplicado (`rgb(255, 0, 0)`). **Controles negativos:** (a) revirtiendo sólo `src/index.ts` (`git stash` de ese archivo), reconstruyendo y re-corriendo: fallan **7 de 12** en `postcss-uxdsl` y **2 de 4** en `uxdsl-core`; restaurado, 12/12 y 4/4. (b) El mismo script de Chrome corrido contra `postcss-uxdsl@0.5.0-beta.6` **publicado** falla en su primera aserción (`compiled output must start with an @import, started with :root`). (c) Dentro del script, cargar el mismo CSS con los imports movidos detrás de `:root` (la disposición de beta.6) da **cero** peticiones y descarta el `@import` del autor |
| Cambios visuales o API / migración | **Cambio visual y de red esperado**, declarado en `CHANGELOG.md` (`0.5.0-beta.7`, `### Visual changes`): Inter se solicita y se usa (la tipografía puede cambiar sin Inter instalada); los navegadores empiezan a contactar `fonts.googleapis.com` (privacidad, CSP); un `@import` propio que antes se descartaba ahora se aplica. Salida: `fonts: { google: [] }`. Sin cambio de API |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/CHANGELOG.md` (entrada MIG-B7-14 con `Visual changes` y el porqué de insertar en vez de hoistear); `packages/postcss-uxdsl/README.md` (párrafo "Placement" en la sección de codificación de Google Fonts); `packages/uxdsl-core/README.md` (garantía de orden en la lista de `compile()`, la nota que el guard `verify:docs` exigió al añadir un test en ese paquete). `docs/migration.md`: sin cambios — no hay nada que migrar salvo el opt-out ya documentado |
| AGENTS / guías / arquitectura | `AGENTS.md`: la frase de "byte-identical `@import`s" ahora aclara que idénticas en URL no era lo mismo que en posición, y que la salida compilada garantiza el orden desde MIG-B7-14 |
| Límites y seguimiento | (1) **No se probó en un bundler concreto** (Next/Vite) si su pipeline reubica el `@import` por su cuenta; lo verificado es la salida cruda del compilador y Chrome cargando ese CSS. (2) **La petición real a Google no se hace**: en Chrome se intercepta y se responde localmente (como ya hace `browser-runtime.js`); lo que se prueba es que el navegador *emite* la petición. (3) **No se comprobó un `@charset` con comentario delante** (un comentario antes de `@charset` ya lo invalida por sí solo, y no es un efecto de este cambio). (4) El `@import` de `data:` que usa el chequeo de Chrome es un sustituto de un import remoto del autor para poder observarlo sin red. (5) **Beta.6 sigue publicada con el defecto**; cómo y cuándo llega el arreglo (un beta adelantado o con el resto de este plan) es decisión de publicación del dueño |
