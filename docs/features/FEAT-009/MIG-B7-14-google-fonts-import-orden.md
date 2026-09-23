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
5. **Los tres caminos no son equivalentes.** `generateThemeCss` (runtime/SSR)
   sí lo deja primero (verificado). El CLI/`compile()` no. El plugin llamado
   directamente sobre un CSS mínimo no emitió `@import` en la prueba que se
   hizo (una sola línea de salida, sin import) — **no se investigó por qué**;
   registrarlo en el paso 0 en vez de suponerlo.
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
3. **Corregir en el dueño (`index.ts`)**, sin parser ni paso paralelo: que ningún
   `prepend` posterior pase por delante de los `@import`. Decidir y justificar
   entre insertar la densidad después del último `@import` o anteponer los
   `@import` como último paso. Comprobar con `grep` que no hay otro
   `prepend`/inserción al inicio (hoy sólo ~195 y ~590) y que no aparece
   `@charset` ni `@layer` que también deban ir antes.
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

- [ ] En la salida del CLI, plugin y `generateThemeCss`, todo `@import` va
      antes de cualquier regla.
- [ ] Un test de posición falla con el código anterior y pasa con el nuevo.
- [ ] En Chrome real, el CSS compilado provoca la petición a Google Fonts.
- [ ] El CHANGELOG declara el cambio visual y la nueva petición de red.
- [ ] `fonts: { google: [] }` sigue funcionando como salida.

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

Estado de esta revisión documental: **Pendiente de implementación/verificación**.
Completar en el mismo PR conforme al
[protocolo de agentes](README.md#protocolo-de-implementación).

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | Ya observada el 2026-09-23 (ver "Estado verificado"); repetir sobre el SHA base y registrar el punto 5 |
| Criterio → regresión | Pendiente |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente — **cambio visual y de red esperado** (puntos 5a y 5b) |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | Pendiente |
| Límites y seguimiento | Pendiente — declarar qué bundlers se probaron (punto 6) |
