# MIG-B7-15 — Actualizar sin sorpresas: ver qué cambió en las familias que nunca declaraste

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P1 · S |
| Cierra | R-20 |
| Depende de | — (el paso 3 depende de la decisión D-12; los demás no) |
| Bloquea | MIG-B7-11 |
| Archivos | `packages/uxdsl-cli/README.md`, `packages/postcss-uxdsl/docs/migration.md`, `packages/uxdsl-cli/bin/uxdsl.js` (sólo el texto del mensaje, y el flag si D-12 = (b)), `AGENTS.md`, `scripts/` (sólo si se publica la guía dentro del paquete) |

## Por qué

Feedback de un consumidor real, pegado por el dueño el 2026-09-23. Tras
actualizar a beta.6 descubrió tarde que los defaults habían cambiado en familias
que **nunca había declarado** (`fonts.google`, `modes.dark`), y comprobó que ni
`theme --diff` ni `theme --strict` se lo habrían dicho. No es residuo de
FEAT-008; se verificó ese día contra los paquetes publicados.

## Estado verificado (2026-09-23, no asumido)

1. **`--diff` sólo lista familias declaradas — y así está documentado.** Con un
   override de una sola clave (`typography_details.h1.fontWeight`), `theme --diff`
   devolvió 78 filas, **todas** de `typography_details`; ninguna de `modes`,
   `fonts` ni `palette`. El README del CLI lo dice: *"`--diff` prints only the
   families your own config mentions"*. No es un defecto: es el alcance
   declarado.
2. **`--strict=modes` sale con 0 con `modes` 100 % heredado.** Igual: el README
   dice *"exits non-zero if any family you **declared** ended up partially
   filled"*. `modes` no se declaró, así que no hay nada parcial que reportar.
3. **El hueco real no es un bug sino una promesa a medias.** La tabla D-1 del
   release record de beta.6 presenta `theme --diff` como respuesta a "¿qué
   valores son míos y cuáles heredados?". Para las familias declaradas lo es;
   para las no declaradas, que es donde ocurrió la sorpresa, no dice nada.
4. **Ya existe una forma de ver el cambio completo, y funciona.** `uxdsl theme`
   sin flags imprime el tema **efectivo** completo. Con el mismo override en dos
   proyectos limpios, uno con beta.5 y otro con beta.6:

   | | beta.5 | beta.6 |
   | --- | --- | --- |
   | bytes de `uxdsl theme` | 8 438 | 13 159 |
   | familias de primer nivel | 4 (`spacing`, `palette`, `fonts`, `typography_details`) | 15 |

   Claves de hoja por familia, beta.6 respecto de beta.5:

   | Familia | añadidas | cambiadas | quitadas |
   | --- | --- | --- | --- |
   | `modes` | 33 | — | — |
   | `palette` | 43 | 5 | — |
   | `inputs` | 23 | — | — |
   | `surfaces` | 18 | — | — |
   | `buttons` | 14 | — | — |
   | `densities` | 16 | — | — |
   | `fonts` | 1 | 2 | 1 |
   | `typography_details` | 24 | 18 | 69 |

   (otras familias nuevas: `colors` 4, `breakpoints` 5, `borders` 5, `radii` 6,
   `shadows` 6, `typography` 1.) Es decir: **guardar la salida de `uxdsl theme`
   antes y después de actualizar y compararlas habría mostrado, por familia, todo
   lo que cambió sin que el proyecto lo tocara.**
5. **Límite de ese flujo:** compara el *tema*, no el CSS compilado. Un cambio de
   comportamiento del motor (como el orden del `@import` de
   [MIG-B7-14](MIG-B7-14-google-fonts-import-orden.md)) no aparece ahí; sólo el
   CHANGELOG puede avisarlo, por eso su sección `### Visual changes` importa.
6. **Ningún documento del repo le dice al consumidor que haga esto antes de
   actualizar.** La guía de migración no tiene un paso "antes de actualizar".
7. **Distinto de MIG-B7-08 (R-11).** Aquélla extiende el resumen de mezcla de
   stderr a `surfaces`/`buttons`/`inputs`; no toca las familias no declaradas.

### Otros puntos del mismo feedback, verificados

- **Parche local de beta.1 que ya sobra.** El consumidor tenía un
  `patches/uxdsl-cli+0.5.0-beta.1.patch` (patch-package) para reenviar
  `includeTheme`/`references` de la config al plugin; hoy falla al aplicarse.
  `patches/` y `patch-package` **no existen en este repositorio**: el parche vive
  en la app del consumidor. Verificado en el código publicado de beta.6 que
  `uxdsl-core` reenvía `config.includeTheme` y `config.references` al plugin, y
  funcionalmente: una config con `includeTheme: false` y
  `references.externalTokens: ['--host-token']` compiló sin `:root` y sin error.
  **`npm i` de beta.6 desde el registro funciona limpio** (38 paquetes, sin
  errores de instalación). Lo que sí falta: ningún documento avisa de que ese
  tipo de parche sobra tras actualizar.
- **Copia local de la guía de agentes desactualizada.** `AGENTS.md` ya dice que
  una copia local es una instantánea; es responsabilidad de quien la copia. El
  problema de fondo es que la guía **no viaja con el paquete**, así que toda copia
  envejece. (La "trampa conocida" de `border(n)` que ese consumidor citó no está
  en `AGENTS.md` de este repo; verificado además que hoy
  `--uxdsl__color__gray-300: #CBD5E1` sí se define en la salida de beta.6.)
- **`[uxdsl] unchanged` con el archivo cambiado: no reproducido.** Cuatro
  escenarios con el CLI publicado (sin cambios; cambio del tema; cambio de un
  `.uxdsl`; `uxdsl.css` editado a mano y reconstruido) dieron cada uno el mensaje
  correcto. `unchanged` significa que la **salida** es idéntica al archivo que ya
  hay en disco (`writeIfChanged` compara contenido) y por eso no se reescribió.
  Lo más probable es que otro proceso — un `watch` — ya lo hubiera reescrito, o
  que lo que cambió fue el tema y no la salida. No se abre como defecto; sólo se
  propone aclarar el texto (paso 5).

## Resultado esperado

Un consumidor que va a actualizar sabe, sin leer código: (1) guardar el tema
efectivo antes, (2) actualizar, (3) comparar, (4) leer las secciones
`Visual changes` del CHANGELOG, y (5) qué parches locales revisar.

## Implementación

1. **Documentar el flujo de actualización** en `packages/uxdsl-cli/README.md`
   (sección "Before you upgrade") y como primer paso de `docs/migration.md`:
   `uxdsl theme > effective.before.json` → actualizar → `uxdsl theme >
   effective.after.json` → `diff`. Incluir la tabla del punto 4 como evidencia de
   que sirve. Decir el límite del punto 5 con todas las letras.
2. **Hacer explícita la consecuencia** en los párrafos de `--diff` y `--strict`
   del README: no ven las familias que no declaraste; apuntar al flujo.
3. **D-12 (opcional).** Sólo si el dueño elige (b): un modo de `theme --diff` que
   liste también las familias no declaradas. Ojo con lo que aporta: muestra lo
   heredado **hoy**, no lo que cambió **entre versiones**; para eso hace falta
   comparar dos salidas de todos modos.
4. **"Parches locales que ya no hacen falta"** en la guía de migración, con el
   ejemplo verificado (reenvío de `includeTheme`/`references`) y el
   procedimiento genérico: antes de actualizar, listar `patches/`; si
   `patch-package` falla después, comprobar contra la fuente publicada y borrar el
   parche. No prometer más de lo verificado.
5. **Aclarar el mensaje** `[uxdsl] unchanged <archivo>` para que diga qué
   significa (salida idéntica al archivo existente). Sólo texto.
6. **Guía de agentes versionada con el paquete.** Evaluar publicar la guía dentro
   de `postcss-uxdsl` (p. ej. `docs/agent-guide.md` en `files`) y que
   `AGENTS.md`, en "Using this guide in another project", recomiende apuntar a
   `node_modules/postcss-uxdsl/…` en lugar de copiar. Condiciones: la copia
   empaquetada se **genera** desde `AGENTS.md` con un `--check`, igual que
   `generate-language-artifacts.js` (nunca una segunda fuente de verdad), y cabe
   en el presupuesto de paquete (250 KB; hoy `postcss-uxdsl` pesa 146,4 KB).

## Fuera de alcance

- Un comparador de versiones integrado en el CLI.
- Cambiar qué familias analizan `--diff`/`--strict` por defecto: su alcance
  declarado no es un defecto.
- El orden del `@import` (MIG-B7-14).

## Pruebas

- La documentación no se prueba con prosa: **el flujo del paso 1 se ejecuta**
  desde tarballs reales de dos versiones y se registra la salida.
- Si D-12 = (b): tests del flag nuevo (todas las familias con su `source`; salida
  JSON pura por stdout, como el resto de `theme`).
- Si se publica la guía: el `--check` de igualdad con `AGENTS.md` y el
  presupuesto de `verify:pack-budget`.

## Documentación

- `packages/uxdsl-cli/README.md`, `packages/postcss-uxdsl/docs/migration.md`,
  `AGENTS.md` (sólo si cambia la recomendación del paso 6).
- CHANGELOG del CLI si cambia el texto del mensaje o se añade el flag.

## Criterios de aceptación

- [ ] La guía de migración abre con "antes de actualizar" y el flujo funciona
      entre dos versiones publicadas, con evidencia registrada.
- [ ] Los README de `--diff`/`--strict` dicen qué no ven.
- [ ] La guía de migración lista los parches locales a revisar, con el ejemplo
      verificado.
- [ ] El mensaje `unchanged` explica lo que significa.
- [ ] D-12 respondida y, si es (b), implementada; si es (a), registrada.
- [ ] La decisión sobre publicar la guía dentro del paquete queda registrada
      (hecha o descartada con motivo).

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
npm run verify:docs
npm run verify:pack-budget
npm test
```

## Entrega

`docs(FEAT-009): MIG-B7-15 - upgrade-without-surprises workflow, stale-workaround note, clearer unchanged message`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Pendiente de implementación/verificación**.
Completar en el mismo PR conforme al
[protocolo de agentes](README.md#protocolo-de-implementación).

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | Hecha el 2026-09-23 (ver "Estado verificado"); repetir sobre el SHA base |
| Criterio → regresión | Pendiente |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente; sin cambio visual. Si D-12 = (b), API nueva de CLI |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | Pendiente |
| Límites y seguimiento | Pendiente |
