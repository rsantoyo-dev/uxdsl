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

- [ ] `init` (single, `--multi`, Next, Vite) deja una config tipada según la
      variante elegida con evidencia en el paso 2.
- [ ] El `$schema` queda scaffoldado, o la ficha registra con evidencia por qué
      no (el CSS cambia o el build emite algo nuevo).
- [ ] `init` es idempotente y no sobrescribe nada existente.
- [ ] La salida compilada de un proyecto recién inicializado es byte-idéntica.
- [ ] El README del CLI explica, sin salir de él, cómo obtener colores,
      completado y tipos.
- [ ] La verificación en VS Code real está registrada como manual y pendiente
      o hecha por el dueño — nunca marcada como automatizada.

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

Estado de esta revisión documental: **Pendiente de implementación/verificación**.
Completar en el mismo PR conforme al
[protocolo de agentes](README.md#protocolo-de-implementación).

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | Pendiente — los tres ramales de `init` con salida real |
| Criterio → regresión | Pendiente |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente; sin cambio visual esperado. `init` cambia lo que escribe: registrarlo como cambio de comportamiento del CLI |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | Pendiente; `AGENTS.md` no describe hoy la extensión ni `init`, valorar si debe |
| Límites y seguimiento | Pendiente |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado.
