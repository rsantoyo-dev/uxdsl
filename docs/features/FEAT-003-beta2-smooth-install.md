# FEAT-003 — UXDSL 0.5.0-beta.2: instalación suave y tema por defecto

| Campo | Valor |
| --- | --- |
| Estado | MIG-B2-01, MIG-B2-02 y MIG-B2-03 completadas y verificadas. MIG-B2-04: codemod ampliado y probado; ejemplos legacy de FEAT-001 y el mapeo de nombres corregidos (ver su sección); falta una revisión final de que toda la documentación de consumidor quede alineada a beta.2. MIG-B2-05: las 5 tarballs coordinadas, el flujo zero-config, el tema parcial con `references.externalTokens`, CSS Modules y los controles negativos pasan (`fixtures/mig-b2-05-release/`); lockfiles modificados validados con `npm ci` limpio en los 5 paquetes. El dueño del proyecto dio la aprobación explícita de publicación y los 5 paquetes se publicaron como `0.5.0-beta.2` bajo los tags `latest` y `beta`; ver [docs/releases/0.5.0-beta.2.md](../releases/0.5.0-beta.2.md) |
| Objetivo | Que un proyecto consumidor compile UXDSL con defaults sin conocer detalles internos del motor |
| Versión objetivo | `0.5.0-beta.2` |
| Prioridad | P0: configuración y tema; P1: `init`, migración y empaquetado |
| Depende de | FEAT-002 y el contrato de [motores unificados](../architecture/unified-engine-audit.md) |

## Objetivo del release

Un proyecto nuevo debe poder ejecutar:

```bash
npm install -D uxdsl-cli postcss-uxdsl
npx uxdsl init
npx uxdsl build
```

y obtener CSS válido con el tema por defecto, sin crear manualmente una escala
de Spacing, Palette, Typography, Borders, Radii, Shadows, Surfaces, Buttons o
Inputs.

Un proyecto con tema propio debe poder añadir únicamente sus overrides:

```text
uxdsl.config.cjs          # entry, output, watch y opciones de build
uxdsl.theme.config.cjs    # overrides del tema y referencias externas
```

El consumidor no debe necesitar importar diez archivos `default-*.uxdsl` para
obtener los defaults, ni debe perder las variables de Next.js por validación de
build. Las importaciones legacy siguen soportadas durante beta.2, pero no son
la ruta documentada para un proyecto nuevo.

## Evidencia de baseline antes de MIG-B2-01

Estos eran los huecos confirmados al iniciar FEAT-003. MIG-B2-01 ya resolvió
los dos primeros y su estado se detalla en la story correspondiente:

- El CLI solo descubría `uxdsl.config.cjs`, `uxdsl.config.js` y
  `uxdsl.config.json`; no descubría `uxdsl.theme.config.cjs`.
- El CLI leía `theme`, pero no propagaba `references` al plugin PostCSS.
- El motor y el runtime ya aceptan `ReferenceOptions`, incluidos
  `externalTokens`; MIG-B2-01 ahora conecta esas opciones desde el CLI.
- Los defaults están distribuidos en varios archivos generados. La generación
  de tema runtime todavía puede fallar si recibe `{}` como tema incompleto.
- `uxdsl init` creaba históricamente una configuración básica y un entry con
  imports de defaults; MIG-B2-02 y MIG-B2-03 ahora hacen que el plugin emita
  el tema canónico y que el entry generado no duplique esos imports.
- `npm run uxdsl:build:theme` no es un script proporcionado por este monorepo;
  la interfaz oficial actual es `uxdsl build`.

Archivos de referencia:

- [CLI](../../packages/uxdsl-cli/bin/uxdsl.js)
- [opciones del plugin](../../packages/postcss-uxdsl/src/index.ts)
- [integridad referencial](../../packages/postcss-uxdsl/src/reference-integrity.ts)
- [generador runtime](../../packages/postcss-uxdsl/src/ds-runtime/theme-generator.ts)
- [guía de migración](../../packages/postcss-uxdsl/docs/migration.md)

## Contrato común de beta.2

### Separación entre configuración de build y tema

`uxdsl.config.cjs` controla el proceso:

```js
const path = require('node:path');

module.exports = {
  entry: path.resolve('src/uxdsl-entry.uxdsl'),
  outFile: path.resolve('src/uxdsl.css'),
  watch: ['src/**/*.uxdsl', 'uxdsl.theme.config.cjs'],
  references: {
    externalTokens: ['--font-geist-sans', '--font-geist-mono']
  }
};
```

`uxdsl.theme.config.cjs` controla el tema. Puede exportar directamente un
objeto de tema:

```js
module.exports = {
  fonts: {
    families: {
      ui: 'var(--font-geist-sans, Arial, sans-serif)',
      code: 'var(--font-geist-mono, ui-monospace, monospace)'
    }
  }
};
```

También puede exportar explícitamente tema y referencias:

```js
module.exports = {
  theme: {
    fonts: {
      families: {
        ui: 'var(--font-geist-sans)',
        code: 'var(--font-geist-mono)'
      }
    }
  },
  references: {
    externalTokens: ['--font-geist-sans', '--font-geist-mono']
  }
};
```

La forma `{ theme, references }` es la recomendada cuando hay variables
externas. Si `references` aparece tanto en `uxdsl.config.cjs` como en el tema,
la configuración de build gana. Las listas se reemplazan completas; no se
concatenan implícitamente.

### Precedencia

La resolución debe ser determinista:

```text
tema por defecto
  <- tema del proyecto
      <- overrides explícitos de la configuración de build
```

Los objetos anidados se combinan por clave. Arrays y valores escalares
reemplazan el valor anterior. `references` no se considera parte de los tokens
del tema y no debe emitirse como CSS.

### Naming

La migración de nombres continúa siendo explícita:

```text
--space-7       -> --uxdsl__space__7
--font-ui       -> --uxdsl__font__ui
--h1-size       -> --uxdsl__typography__h1-size
```

La sintaxis `space(7)`, `palette(primary.main)`, `radius(2)` y las directivas
`@ds-*` no cambian.

---

## MIG-B2-01 — Descubrimiento de configuración y propagación de referencias

**Estado:** completada en `a9cf447` y cubierta por 15 pruebas de CLI integradas
en `npm test`. La regresión adicional verifica que los globs de `watch` también
se resuelven relativos al archivo `uxdsl.config.*`. La verificación final del
release debe repetirse con el tarball cuando se ejecute MIG-B2-05.

**Implementado en este checkout** (`packages/uxdsl-cli/bin/uxdsl.js`):
`THEME_CANDIDATES` (las 4 extensiones, en el orden especificado),
`findThemeConfigPath`, `normalizeThemeExport` (distingue `{theme,
references}` de un tema plano por la presencia de esas claves, nunca deja
que `references` se filtre al objeto `theme`), y `loadConfig` reescrito
para: descubrir el archivo de tema relativo al directorio del `uxdsl.config.*`
que lo declara (o de `--config` cuando se usa explícitamente, nunca al cwd
ni al paquete del CLI); dar precedencia completa a `references` (y, por
simetría, a `theme`) del build config sobre el archivo de tema cuando
ambos están presentes; soportar `themeFile` explícito; agregar el archivo
de tema descubierto al `watch`; y (item 10) permitir compilar con
`uxdsl.theme.config.cjs` solo, sin `uxdsl.config.cjs`, cayendo en el
entry/output convencionales de `init` si existen, o fallando con un error
accionable (`Run "npx uxdsl init"...`) si no. `buildOnce` propaga
`config.references` al plugin, que antes se descartaba en silencio.
`UXDSL_DEBUG=1` imprime qué config/tema se descubrió y la lista de
`externalTokens` (nunca valores). `main()` quedó detrás de un guard
`require.main === module` y el archivo exporta sus funciones puras
(`loadConfig`, `findThemeConfigPath`, etc.) para poder probarlas sin
depender de `process.exit`.

Cobertura en `packages/uxdsl-cli/test/uxdsl-cli.test.js` (15 casos de
MIG-B2-01: los 10 pedidos en "Pruebas requeridas" más la extensión `.json`,
precedencia de `theme` inline vs. archivo, `themeFile` explícito, y los dos
sub-casos del item 10 de implementación; además hay un guard separado de
MIG-B2-03 para `generate-entry`). Agregado a `npm test` de la raíz
(`npm --prefix packages/uxdsl-cli test`) y a `packages/uxdsl-cli/package.json`
como script `test`.

**Verificado además con el binario real** (no solo las funciones
exportadas): `uxdsl init` + `uxdsl build` con un `uxdsl.theme.config.cjs`
completo (spacing 1-16, palette, `fonts.families` con `var(--font-geist-sans,
...)`, `typography_details.default/code`, `references.externalTokens`)
compila con éxito y emite `--uxdsl__font__ui: var(--font-geist-sans, Arial,
sans-serif);` en el CSS resultante — el caso Next.js exacto que motiva esta
historia.

**Resuelto por MIG-B2-02/MIG-B2-03:** `uxdsl build` sin tema propio, incluido
un tema vacío o un proyecto recién inicializado, usa el tema canónico y ya no
depende de que `default-typography.uxdsl` sea importado manualmente para
definir `typography_details.default`/`.code`.

### Historia

Como consumidor de UXDSL, quiero separar mi configuración de build de mi tema
para que el CLI encuentre automáticamente `uxdsl.theme.config.cjs` y valide
variables externas de mi framework.

### Alcance

Modificar el cargador de configuración del CLI. No cambiar la semántica del
validador de referencias ni inferir variables externas automáticamente.

### Implementación requerida

1. Mantener los candidatos de configuración de build existentes:

   ```text
   uxdsl.config.cjs
   uxdsl.config.js
   uxdsl.config.json
   ```

2. Añadir candidatos de tema, en este orden:

   ```text
   uxdsl.theme.config.cjs
   uxdsl.theme.config.js
   uxdsl.theme.config.json
   uxdsl.theme.json
   ```

3. Resolver paths relativos al directorio del archivo que los declara, no al
   directorio del paquete CLI.

4. Aceptar exports CommonJS, `default` interop y funciones async, igual que la
   configuración de build actual.

5. Normalizar el export del archivo de tema:

   - si contiene `theme` o `references`, usar esos campos;
   - si no, tratar el objeto completo como tema;
   - no introducir `references` dentro del objeto enviado como `theme`.

6. Leer `references` desde `uxdsl.config.*` y desde el archivo de tema.
   Las referencias del build tienen precedencia completa sobre las del tema.

7. Pasar al plugin todas las opciones relevantes:

   ```js
   uxdslPlugin({
     breakpoints: resolvedConfig.breakpoints,
     theme: resolvedConfig.theme,
     references: resolvedConfig.references
   });
   ```

8. En modo `UXDSL_DEBUG`, informar qué archivos fueron descubiertos y si se
   cargaron referencias externas. No imprimir valores secretos; las listas de
   nombres de variables sí son aceptables.

9. Si se especifica `--config`, cargar exclusivamente ese archivo como
   configuración de build; nunca sustituirlo silenciosamente por otro archivo.
   Si esa configuración no contiene `theme` ni `themeFile`, buscar el candidato
   de tema en el mismo directorio del archivo indicado. `themeFile`, cuando
   exista, gana sobre el nombre convencional y se resuelve relativo al archivo
   de build. Registrar esta regla en el código y en README.

10. Si solo existe `uxdsl.theme.config.cjs`, conservar los defaults de entry y
    output definidos por `init` cuando sea posible. Si no existe entry
    convencional, producir un error accionable que indique cómo crearla.

### Criterios de aceptación

- Un proyecto con `uxdsl.config.cjs` y `uxdsl.theme.config.cjs` compila sin
  importar manualmente el tema desde `uxdsl.config.cjs`.
- `references.externalTokens` permite compilar una fuente que usa
  `var(--font-geist-sans)` sin fallback.
- Un token externo no declarado sigue produciendo `UXD_REFERENCE_MISSING`.
- Una referencia en `uxdsl.theme.config.cjs` llega al plugin y no aparece como
  una variable CSS emitida.
- La configuración explícita de build gana sobre la configuración del tema.
- Un archivo de tema que exporta directamente tokens continúa funcionando.
- La ausencia de archivo de tema no rompe la compilación con defaults.
- El CLI conserva el comportamiento de `--entry`, `--out`, `--config` y `--watch`.

### Pruebas requeridas

Crear pruebas de Node para el CLI, preferiblemente extrayendo funciones puras de
normalización para no depender de `process.exit`:

1. descubre cada extensión soportada;
2. resuelve rutas relativas al proyecto;
3. acepta `module.exports = theme`;
4. acepta `module.exports = { theme, references }`;
5. propaga `externalTokens` y permite una fuente con `var(--host-token)`;
6. rechaza la misma fuente sin `externalTokens`;
7. verifica precedencia de `references` del build;
8. verifica que `theme.references` no se emite como token;
9. verifica que `--config missing.cjs` falla con mensaje claro;
10. verifica watch incluyendo el archivo de tema descubierto.

Comando mínimo de verificación:

```bash
npm --prefix packages/postcss-uxdsl run build
npm test
```

---

## MIG-B2-02 — Fuente única del tema por defecto y merge de temas parciales

**Implementado en este checkout:** `packages/postcss-uxdsl/src/default-theme.ts`
(nuevo) exporta `DEFAULT_THEME` (spacing 1-16, palette
`primary`/`surface`/`neutral`/`error` — exactamente lo que Surface/Button/
Input siempre-activos necesitan y no tenían default hasta ahora — y
`fonts.families` `ui`/`ui-2`/`code`, con los mismos valores visuales que
`postcss-uxdsl/theme/default-palette.css`/`default-spacing.css`/
`default-typography.uxdsl` ya usan, para que un proyecto que después
importe esos archivos más completos no vea un salto visual), `getDefaultTheme()`
(copia mutable vía `JSON.parse(JSON.stringify(...))`, sin depender de
`structuredClone`) y `resolveTheme(override)`. `deepMergeTheme`
(`ds-runtime/theme-validate.ts`) ya existía y ya cumplía exactamente las
reglas de merge pedidas (objetos por clave, arrays reemplazo completo,
`undefined` nunca sobrescribe) — `resolveTheme` lo reutiliza en vez de
reimplementarlo, y le agrega dos cosas: (1) normaliza las claves de
`override.spacing` con `normalizeSpacingDefinitions` *antes* de mezclar,
para que un override en forma `"space-1"` reemplace la clave por defecto
`"1"` en vez de mezclarse como una clave adicional distinta (o colisionar);
(2) rechaza con `UXD_THEME_INVALID` un override que no sea `undefined`/`null`
ni un objeto plano (`deepMergeTheme` por sí solo lo hubiera ignorado en
silencio, que es justo lo que el criterio de "inputs inválidos: error
estructurado" pide evitar). Deliberadamente NO se incluyó `theme.colors.gray`
aquí — `DEFAULT_BORDER_COLORS` (edges.ts) ya lo provee para `border(1..5)` y
mezclarlo de nuevo aquí, con valores propios, hubiera reintroducido
exactamente el bug de "dos fuentes default divergentes" que esta historia
existe para evitar.

`generateThemeCss()` (`ds-runtime/theme-generator.ts`) ahora resuelve
`resolveTheme(theme)` como primer paso — antes retornaba `''` de inmediato
si `theme` era falsy, lo que impedía que cualquier default pudiera aplicar
nunca; ahora `generateThemeCss()` sin argumentos genera CSS de tema válido.
El plugin PostCSS (`index.ts`) resuelve `effectiveTheme = resolveTheme(opts.theme)`
una sola vez al inicio de `uxdslPlugin(opts)` y lo usa en todos los puntos
donde antes leía `opts.theme` directamente — mismo punto de resolución que
`generateThemeCss`, no uno paralelo (criterio del item 6). Como efecto
correcto (no un bug): con `includeTheme: false` y sin `theme` declarado, la
validación cruzada contra "lo que la entrada de tema emitiría" ahora
también se ejecuta (antes se saltaba en silencio si no había `theme`),
porque esa entrada de tema virtual ahora sí existe — el tema por defecto.

Exportado desde `postcss-uxdsl/ds-runtime` (`DEFAULT_THEME`, `getDefaultTheme`,
`resolveTheme`) para que una app pueda construir el mismo tema efectivo
durante SSR/runtime (item 9).

Cobertura en `packages/postcss-uxdsl/test/default-theme.test.js` (10 casos,
uno por cada ítem de "Pruebas requeridas" abajo). Dos tests preexistentes
(`border-colors.test.js`, `reference-integrity.test.js`) tenían un "sanity
check" que asumía que `border(1)` sin tema fallaba siempre — ahora
`border(1..5)` resuelve por defecto incluso sin tema (exactamente el
objetivo de esta historia), así que esa aserción se volvió estructuralmente
incorrecta, no rota; se actualizó a una familia de palette que
deliberadamente no tiene default (`palette(brand-custom.main)`) para seguir
demostrando que el modo estricto rechaza lo que de verdad no está definido.
Suite completa: 137/137 en esta revisión. La verificación desde tarballs y la
fixture de Next.js/CSS Modules/Chrome permanecen como gates de MIG-B2-05; no se
marcan aquí como evidencia de esta ejecución.

**Decisión resuelta por MIG-B2-03:** se eligió la estrategia preferida del
item 7: el plugin emite el tema por defecto y `generate-entry` ya no inserta
los diez imports `default-*.uxdsl`/`.css`. Los imports públicos siguen
disponibles para compatibilidad explícita; el entry generado para proyectos
nuevos tiene una sola fuente de definiciones.

### Historia

Como consumidor de UXDSL, quiero configurar solo los tokens que necesito para
que el resto provenga del tema por defecto y todas las integraciones generen el
mismo CSS.

### Alcance

Crear una fuente canónica de datos de tema y hacer que PostCSS, runtime y CLI la
usen. Los archivos `default-*.css` y `default-*.uxdsl` siguen existiendo como
artefactos de compatibilidad generados.

### Implementación requerida

1. Inventariar los defaults actuales antes de moverlos. No cambiar valores,
   breakpoints, nombres CSS ni rangos como parte de esta story.

2. Crear una API browser-safe y clonable, por ejemplo:

   ```ts
   export const DEFAULT_THEME: Readonly<Record<string, any>>;
   export function getDefaultTheme(): Record<string, any>;
   export function resolveTheme(override?: unknown): Record<string, any>;
   ```

   El nombre exacto puede adaptarse al repositorio, pero debe existir una sola
   fuente semántica. No duplicar mapas completos en CLI, playground y runtime.

3. El tema por defecto debe cubrir las dependencias emitidas por los presets
   actuales, como mínimo:

   - Spacing 1–16;
   - Density y breakpoints canónicos;
   - Palette requerida por Surface, Button e Input;
   - colores requeridos por Borders;
   - Radii y Shadows usados por defaults;
   - roles Typography y familias de fuente con fallback CSS válido.

4. Implementar merge profundo con estas reglas:

   - objetos: merge por clave;
   - arrays: reemplazo completo;
   - strings, números, booleanos y `null`: reemplazo;
   - `undefined`: no sobrescribe;
   - inputs inválidos: error estructurado, no corrección silenciosa.

5. `generateThemeCss()` debe aceptar tema omitido o parcial y resolverlo contra
   el tema por defecto antes de generar y validar.

6. El plugin PostCSS debe resolver el mismo tema efectivo para sus mapas de
   tokens y validación. `includeTheme: false` debe continuar sin emitir bloques
   globales, pero validar contra el mismo tema efectivo.

7. El CLI debe usar esta resolución. Si `generate-entry` deja imports legacy de
   defaults, decidir y documentar una única estrategia para evitar duplicación:

   - preferido: el plugin emite el tema por defecto y el entry generado deja de
     importar los packs por defecto;
   - alternativa compatible: detectar imports de defaults y no volver a
     emitirlos automáticamente.

   No aceptar una solución que produzca dos fuentes divergentes de valores.

8. Mantener disponibles los imports públicos `postcss-uxdsl/theme/default-*` y
   regenerarlos desde la fuente canónica. Ejecutar el generador correspondiente;
   no editar los artefactos manualmente.

9. Exportar la resolución desde `postcss-uxdsl/ds-runtime` para que una app
   pueda construir el mismo tema efectivo durante SSR y runtime.

### Criterios de aceptación

- `generateThemeCss()` sin argumentos genera CSS válido y pasa validación
  estricta.
- `generateThemeCss({ palette: { primary: { main: '#123' } } })` conserva todos
  los defaults no reemplazados y cambia solo `primary.main`.
- Un array override reemplaza el array completo, según el contrato documentado.
- PostCSS y `generateThemeCss` producen las mismas declaraciones semánticas para
  el mismo tema efectivo.
- El tema efectivo contiene nombres `--uxdsl__...`; no reaparecen aliases
  legacy automáticos.
- `includeTheme: false` no emite `:root`, pero acepta `space()`, `density()`,
  `@ds-surface`, `@ds-button` y `@ds-input` contra el tema efectivo.
- Un override con `palette(missing)` sigue fallando con
  `UXD_REFERENCE_MISSING`.
- La compilación de una app sin tema propio funciona con solo los defaults.
- Los artefactos generados y el manifest no tienen drift.

### Pruebas requeridas

Añadir o ampliar pruebas del runtime y PostCSS:

1. tema vacío: `generateThemeCss()` compila;
2. tema parcial: merge de Palette, Typography, fonts y spacing;
3. arrays reemplazados y `undefined` ignorado;
4. objeto inválido rechazado;
5. paridad de variables entre PostCSS y runtime;
6. paridad de referencias responsive en 479/480/481, 767/768/769,
   1023/1024/1025 y 1279/1280/1281;
7. `includeTheme: false` sin `:root`;
8. ausencia de fugas entre dos resoluciones consecutivas;
9. generación de artefactos con `--uxdsl__`;
10. drift check del manifest y metadata.

Comandos mínimos:

```bash
npm --prefix packages/postcss-uxdsl test
npm run generate:language
npm run test:themes --prefix packages/playground-nextjs
npm run test
```

---

## MIG-B2-03 — `uxdsl init` y flujo zero-config

**Implementado y verificado en este checkout:** `init` crea la configuración,
el entry y los scripts faltantes sin sobrescribir archivos existentes; crea
PostCSS solo para Next.js cuando falta; muestra la integración manual cuando
ya existe; y deja el flujo Vite en una única ruta recomendada. `build` valida
entry, output y propiedades de configuración con mensajes accionables.
`generate-entry` deja de importar los packs legacy por defecto porque el
plugin ya emite el tema canónico. La fixture real
`fixtures/mig-b2-03-cli-init/run.js` cubre init/build, idempotencia, archivos
preexistentes, Next.js, errores y variables namespaced, y está conectada al
`npm test` raíz.

> **Corrección (auditoría, dos hallazgos P1 en `watch`):**
>
> 1. **`watch` recompilaba con config/tema viejos.** `startWatch` capturaba
>    `config` una sola vez al arrancar y `trigger()` siempre construía con
>    ese mismo objeto — editar `uxdsl.theme.config.cjs` (o `uxdsl.config.cjs`)
>    nunca se reflejaba en el CSS reconstruido. Peor: ni siquiera volver a
>    llamar `loadConfig()` en cada rebuild alcanzaba, porque `loadModuleExport`
>    usa `require()`, que Node cachea por ruta resuelta — sin invalidar esa
>    caché, un segundo `require()` del mismo archivo de tema devuelve el
>    módulo de antes de la edición. Reproducido exactamente como se reportó:
>    cambiar `palette.primary.main` mientras `watch` corre no cambiaba el
>    valor en `src/uxdsl.css`. Corregido: `loadConfig` ahora expone las rutas
>    resueltas de config/tema (`configPath`/`themeConfigPath`); `startWatch`
>    limpia `require.cache` para esas dos rutas y vuelve a llamar
>    `loadConfig()` en cada `trigger()`, antes de construir. Queda como
>    límite conocido, no resuelto aquí: si un cambio agrega/quita rutas de
>    `watch` en `uxdsl.config.cjs`, el `chokidar.watch()` ya creado no
>    recibe esas rutas nuevas hasta reiniciar el proceso — solo el
>    contenido de config/tema se recarga, no la lista de globs vigilados.
> 2. **El watcher vigilaba su propio archivo de salida.** `init` genera
>    `watch: ['src/**/*.uxdsl', 'src/**/*.css']`, y ese segundo glob
>    coincide con `outFile` (`src/uxdsl.css`) tanto como con cualquier CSS
>    real del proyecto. Sin excluirlo, cada escritura de build dispara un
>    evento `change`, que dispara otro build idéntico, indefinidamente.
>    Reproducido en vivo (proceso en background, `watch: [...]` igual al de
>    `init`): más de 30 reconstrucciones idénticas en 8 segundos sin tocar
>    ningún archivo. Corregido pasando `ignored: config.outFile` a
>    `chokidar.watch(...)`.
>
> **Segunda ronda (dos huecos más, también reproducidos antes de corregir):**
>
> 3. Limpiar `require.cache` solo del archivo de tema/config de nivel
>    superior no alcanza si ese archivo hace `theme: require('./datos.json')`
>    — un split real (JSON como datos puros, un `.cjs` delgado alrededor).
>    Node vuelve a ejecutar el archivo de nivel superior al recargar, pero
>    ese `require()` anidado sigue resolviendo a la entrada de caché sin
>    tocar del JSON. Corregido: `clearRequireCache` ahora recorre
>    recursivamente `.children` de cada entrada de caché (que Node ya
>    registra) y limpia cada dependencia local del proyecto — los paquetes
>    de `node_modules` (chokidar, postcss, ...) se dejan intactos, porque no
>    cambian entre reconstrucciones.
> 4. La exclusión de `outFile` de arriba se pasaba una sola vez a
>    `chokidar.watch()` al construir el watcher. Si una recarga posterior
>    cambia `outFile` a otra ruta, chokidar no tiene API pública para
>    actualizar `ignored` después — la ruta vieja queda excluida para
>    siempre (inofensivo) pero la nueva nunca lo está, así que el loop del
>    punto 2 puede reaparecer bajo el nombre nuevo. Corregido: la exclusión
>    ahora es un chequeo dinámico dentro del handler `watcher.on('all', ...)`
>    contra el `config.outFile` **actual** (reasignado por clausura en cada
>    recarga), no una opción estática fijada al construir.
>
> También en esta segunda ronda: `uxdsl.config.cjs` se agrega automáticamente
> a `watch`, igual que ya pasaba con el archivo de tema — antes, editarlo
> (por ejemplo para cambiar `outFile`) no se detectaba en absoluto.
>
> **Tercera ronda, en paralelo (retargeting dinámico completo):** una sesión
> concurrente fue más allá de los puntos 1-4 e hizo que el watcher
> reconfigure en caliente sus propios globs vigilados y su `themeFile`
> cuando la config cambia — no solo el *contenido* de config/tema, que es
> el alcance de las correcciones 1-4 de arriba. Ver el test "watch retargets
> themeFile and source globs without restarting the CLI" y la sección de
> `watch` del README de `uxdsl-cli` para ese comportamiento más completo.
> Con esto, los dos "límites conocidos" registrados en la primera ronda (la
> lista de `watch` y el `outFile` no se releían sin reiniciar el proceso)
> quedan resueltos también.
>
> Cobertura de regresión en `packages/uxdsl-cli/test/watch-mode.test.js` (4
> casos propios, más el de retargeting dinámico de la sesión concurrente:
> 5 en total), todos con un `uxdsl watch` real como subproceso y cambios
> reales en el filesystem, no un mock. Verificado manualmente que cada
> hallazgo falla de la manera esperada contra el código anterior a su
> corrección — para el punto 2, la primera corrida del test automatizado
> contra el código viejo dio un falso "ok" por una carrera con el
> `npm install` del propio fixture; la validación en vivo (proceso en
> background) fue la que realmente lo confirmó, y una segunda corrida del
> test sí lo detectó.

### Historia

Como desarrollador que instala UXDSL en una app nueva, quiero ejecutar `init`
y después `build` sin ensamblar manualmente el entry ni conocer la estructura
de los defaults.

### Implementación requerida

1. `uxdsl init` debe crear, sin sobreescribir archivos existentes:

   ```text
   uxdsl.config.cjs
   src/uxdsl-entry.uxdsl
   src/uxdsl.css       # puede crearse durante build, no necesariamente init
   ```

2. La configuración generada debe usar paths relativos al proyecto y contener
   defaults de entry, output, breakpoints y watch.

3. El entry generado debe ser válido aunque `src/` no contenga archivos `.uxdsl`
   propios. Debe compilar el tema por defecto mediante la estrategia definida
   en MIG-B2-02.

4. Añadir scripts al `package.json` solo si no existen y sin modificar scripts
   del usuario:

   ```json
   {
     "uxdsl:build": "uxdsl build",
     "uxdsl:watch": "uxdsl build --watch"
   }
   ```

   Si modificar `package.json` se considera demasiado invasivo para el CLI,
   dejar los scripts fuera de `init`, pero imprimir el bloque exacto y cubrirlo
   en README. La decisión debe quedar documentada y testeada.

5. Si el proyecto tiene Next.js, crear `postcss.config.js` solo cuando no
   exista. Si existe, no sobrescribirlo; mostrar una instrucción precisa para
   integrar UXDSL.

6. Si el proyecto tiene Vite, no insertar simultáneamente loader y plugin que
   procesen la misma entrada. Mostrar una única ruta recomendada.

7. `uxdsl build` debe dar errores con solución concreta:

   - entry inexistente: indicar `--entry` y el path esperado;
   - output inválido: indicar `--out`;
   - referencia faltante: mostrar código, consumidor y cadena;
   - configuración inválida: indicar archivo y propiedad.

8. Actualizar el help para distinguir claramente `init`, `build`, `watch` y
   `generate-entry`.

### Criterios de aceptación

- En un directorio temporal vacío con un `package.json` mínimo, `uxdsl init`
  crea los archivos esperados y termina con código cero.
- Ejecutar `uxdsl build` inmediatamente después produce `src/uxdsl.css` válido.
- El CSS contiene como mínimo variables namespaced de Spacing, Palette,
  Typography, Radius, Shadow y Density.
- Repetir `uxdsl init` no cambia archivos existentes.
- Un `uxdsl.config.cjs` preexistente no se sobreescribe.
- Un `postcss.config.js` preexistente no se sobreescribe ni se corrompe.
- Un `src` sin componentes sigue siendo un caso válido.
- La salida de `init` documenta el import CSS y el comando watch correctos.

### Pruebas requeridas

Crear una fixture de CLI en un directorio temporal o bajo `fixtures/` que:

1. ejecute `init` en proyecto vacío;
2. compruebe archivos y contenido;
3. ejecute `build` real;
4. inspeccione variables namespaced del CSS;
5. ejecute `init` por segunda vez y compare hashes;
6. preserve un `uxdsl.config.cjs` y `postcss.config.js` existentes;
7. pruebe Next.js y Vite solo si las dependencias ya están disponibles;
8. verifique mensajes de error para entry y configuración inválidos.

El test debe usar el CLI del checkout o un tarball construido explícitamente,
nunca resolver accidentalmente un `uxdsl-cli` global.

---

## MIG-B2-04 — Migración beta.1, codemod y documentación de consumidor

### Historia

Como equipo que migra desde beta.1, quiero una ruta automatizable y una guía
sin ambigüedades para actualizar referencias directas y fuentes externas.

### Implementación requerida

1. Mantener `space(7)` y demás helpers sin cambios. Migrar únicamente nombres
   CSS directos pertenecientes a UXDSL.

2. Revisar el codemod de namespace para que cubra, con preview obligatorio:

   ```text
   --space-*        -> --uxdsl__space__*
   --density-*      -> --uxdsl__density__*
   --radius-*       -> --uxdsl__radius__*
   --border-*       -> --uxdsl__border__*
   --shadow-*       -> --uxdsl__shadow__*
   --font-*         -> --uxdsl__font__*
   --h1-size        -> --uxdsl__typography__h1-size
   --ds__palette__* -> --uxdsl__palette__*
   ```

3. No cambiar automáticamente:

   - claves lógicas de `theme.spacing`;
   - claves de `theme.typography` plano elegidas por el host;
   - variables externas ambiguas;
   - nombres protegidos por `--map`.

4. Documentar dos soluciones para fuentes Next:

   - fallback CSS, válido sin configuración externa;
   - `references.externalTokens`, válido cuando el host garantiza la variable.

5. Actualizar README, migration guide, CHANGELOG y esta feature para que el
   nombre canónico sea beta.2 y no exista el comando ficticio
   `uxdsl:build:theme` como requisito general.

6. Corregir ejemplos obsoletos de FEAT-001 que todavía muestran variables
   `--space-*`, sin reescribir el historial de decisiones de beta.1.

### Criterios de aceptación

- Preview del codemod no modifica archivos.
- `--write` modifica solo referencias seleccionadas.
- Segunda ejecución es idempotente.
- Un mapeo identidad protege una variable del host.
- Fallbacks en `var()` pasan la validación sin declarar externals.
- Variables externas sin fallback pasan solo cuando están declaradas.
- La guía contiene una receta completa desde beta.1 hasta beta.2.
- La documentación distingue tema parcial, tema completo y CSS legacy.

### Pruebas requeridas

- ampliar `namespace-migration.test.js` con Typography y fonts;
- cubrir `--space-4` hasta `--space-10` en valores directos;
- cubrir referencias dentro de JSON, CSS y `externalTokens`;
- probar preview, write e idempotencia;
- probar fallback válido y fallback ausente;
- ejecutar `git diff --check` sobre el resultado documentado.

---

## MIG-B2-05 — Gate de integración, tarballs y release beta.2

**Estado:** `fixtures/mig-b2-05-release/run.js` — empaqueta y prueba las 5
tarballs coordinadas, el flujo zero-config (`init` + script de npm), un
tema parcial con `references.externalTokens` (incluido el caso Next.js con
fallback `var(--font-geist-sans, ...)`), paridad CLI/PostCSS/runtime,
`includeTheme: false` sin `:root`, dos controles negativos (`references`
faltantes y `palette(not-defined.main)`, ambos deben fallar con
`UXD_REFERENCE_MISSING` y preservar la salida previa en lugar de escribir
CSS roto) y la presencia de exports/manifest en el paquete instalado —
todo en verde.

> **Corrección (auditoría):** la comparación de paridad tras compilar
> componentes reales (`.card { @ds-surface(contained); } .button {
> @ds-button(contained primary 2); } ...`) comparaba **todas** las
> declaraciones `--` del CSS compilado contra `runtime.generateThemeCss()`
> — pero `@ds-button(... primary ...)`/`@ds-input(... primary ...)` con un
> tono explícito escriben variables de "hook" con scope de componente
> (`--uxdsl__button__tone-main`/`-dark`/`-contrast` directamente en el
> selector `.button`, no en `:root`), que `generateThemeCss()` nunca
> genera (no tiene noción de un uso concreto de `@ds-button`, solo de los
> tokens del tema). La comparación fallaba en cuanto el entry usaba un
> tono real, no porque el tema divergiera. Corregido filtrando a solo las
> declaraciones con scope `:root` (`rule::root`, incluidos sus `@media`
> anidados) antes de comparar — exactamente lo que `generateThemeCss()`
> produce y nada más.
>
> También se validaron con `npm ci` (instalación limpia desde el
> lockfile, sin reescritura posterior) los 5 lockfiles que el bump de
> versión a `0.5.0-beta.2` modificó (`postcss-uxdsl`, `uxdsl-cli`,
> `uxdsl-core`, `vite-plugin-uxdsl`, `uxdsl-webpack-loader`); los 5
> instalan limpio.
>
> Hallazgo adicional (documentación, no bloqueante para el gate): el
> comando `npm pack --dry-run --prefix packages/<paquete>` listado abajo
> **no empaqueta el paquete indicado** — con `--prefix` sigue empaquetando
> el `package.json` de la raíz del monorepo (`uxdsl@1.0.0`), no el del
> subpaquete. La forma que sí empaqueta el paquete correcto es `(cd
> packages/<paquete> && npm pack --dry-run)`. Corregido en "Comandos de
> verificación" abajo.

### Historia

Como mantenedor, quiero comprobar la experiencia desde paquetes instalados para
que beta.2 no funcione solo por aliases o `dist` stale del monorepo.

### Implementación requerida

1. Construir `postcss-uxdsl` antes de empaquetarlo.

2. Construir y probar el CLI usando la versión empaquetada de
   `postcss-uxdsl`, no una ruta accidental a `src/`.

3. Añadir una fixture de consumidor con:

   ```text
   uxdsl.config.cjs
   uxdsl.theme.config.cjs
   src/uxdsl-entry.uxdsl
   ```

   La fixture debe usar un tema parcial, una referencia externa de fuente y al
   menos una directiva `@ds-surface`, un `@ds-button` y un `@ds-input`.

4. Verificar que PostCSS, runtime y CLI reciben el mismo tema efectivo.

5. Ejecutar pruebas de CSS Modules con una entrada global y entradas de
   componentes `includeTheme: false`. No permitir `:root` en los módulos.

6. Mantener control negativo: un token desconocido debe fallar y no ser
   convertido en un fallback inventado.

7. Sincronizar versiones de los paquetes publicables a `0.5.0-beta.2`, revisar
   dependencias internas, exports, README, CHANGELOG y lockfiles. Usar el
   mecanismo de release del repositorio; no editar versiones generadas a mano
   si el script las administra.

8. No publicar automáticamente como parte de esta story. La publicación y el
   tag npm requieren una aprobación separada.

### Criterios de aceptación

- Una instalación desde tarball reproduce el flujo zero-config.
- Una instalación desde tarball reproduce el flujo con tema parcial.
- `references.externalTokens` funciona desde el CLI instalado.
- El CSS generado desde paquete instalado usa `--uxdsl__...`.
- La fixture de Next/CSS Modules pasa en los breakpoints definidos.
- PostCSS y runtime no divergen en valores, estados o temas.
- El paquete publicado contiene los defaults y exports requeridos.
- No hay dependencia accidental de archivos del monorepo.

### Comandos de verificación

Ejecutar desde la raíz:

```bash
npm test
npm run verify:consumer-fixture
npm run verify:cssmodules-build
npm run generate:language
npm --prefix packages/uxdsl-vscode run compile
```

Añadir comandos específicos del CLI cuando se cree su suite. El gate final debe
incluir además:

```bash
git diff --check
node fixtures/mig-b2-05-release/run.js
```

Nota: `npm pack --dry-run --prefix packages/<paquete>` **no** empaqueta ese
paquete — `--prefix` no cambia el objetivo de `pack`, así que termina
empaquetando la raíz del monorepo (`uxdsl@1.0.0`). Usar en su lugar:

```bash
(cd packages/postcss-uxdsl && npm pack --dry-run)
(cd packages/uxdsl-cli && npm pack --dry-run)
```

## Orden recomendado de implementación

No empezar por cambiar versiones. El orden es:

1. MIG-B2-01 — cargar config/tema y propagar `references`;
2. MIG-B2-02 — resolver tema por defecto y temas parciales;
3. MIG-B2-03 — hacer `init` realmente ejecutable;
4. MIG-B2-04 — actualizar codemod y documentación;
5. MIG-B2-05 — probar tarballs y preparar release.

Cada story debe mantener verdes las pruebas anteriores. Si una decisión de
compatibilidad cambia los valores actuales, detenerse y registrar una story
separada; beta.2 no debe esconder cambios visuales bajo la etiqueta de
instalación suave.

## Definition of done

- [x] Un proyecto nuevo compila con `init` + `build` usando defaults — verificado en un directorio temporal (MIG-B2-03) y desde las 5 tarballs reales (`fixtures/mig-b2-05-release/`, "installed CLI init + npm script build, zero-config runtime parity").
- [x] Un tema parcial se combina con un tema default completo — `resolveTheme`/`DEFAULT_THEME` (MIG-B2-02), probado también desde tarball con un tema parcial real (spacing/palette/fonts) en MIG-B2-05.
- [x] `uxdsl.theme.config.cjs` se descubre y se carga de forma documentada — MIG-B2-01, README de `uxdsl-cli`.
- [x] `references.externalTokens` funciona desde CLI, PostCSS y runtime donde corresponda — probado en los tres desde tarball (`fixtures/mig-b2-05-release/`), incluido el caso Next.js `var(--font-geist-sans, ...)`.
- [x] No se emiten aliases legacy automáticos — decisión tomada (sin aliases) y ya vigente desde el rename de MIG-08/FEAT-002.
- [x] Los fallbacks de fuentes y referencias externas tienen pruebas — `default-theme.test.js`, `uxdsl-cli.test.js`, `mig-b2-05-release/run.js`.
- [x] El flujo empaquetado no depende del monorepo — `fixtures/mig-b2-05-release/run.js` instala las 5 tarballs en un directorio aislado, sin symlinks ni resolución accidental a `src/`; confirmado también que cada `package-lock.json` modificado por el bump de versión instala limpio con `npm ci`.
- [ ] README, migration guide, CHANGELOG y manifest reflejan beta.2 — el manifest (`uxdslVersion`), el CHANGELOG (ahora `## 0.5.0-beta.2 — 2026-09-16`, actualizado tras la publicación) y el migration guide (título y tabla "de beta.1 a beta.2") ya están alineados; los ejemplos legacy de FEAT-001 que todavía mostraban nombres sin namespace se corrigieron en esta pasada. No se hizo una auditoría exhaustiva de *toda* la documentación de consumidor (playground, otros READMEs) — dejarlo marcado como pendiente hasta esa revisión final.
- [x] `npm test`, fixtures de consumidor, CSS Modules y `git diff --check` pasan — `npm test` (root), `verify:consumer-fixture`, `verify:cssmodules-build`, `mig-b2-05-release/run.js` y `git diff --check` verificados en esta pasada.
- [x] La publicación queda fuera de la implementación y requiere aprobación explícita — respetado hasta el momento de publicar (nada de esta historia publicó nada por su cuenta); el dueño del proyecto pidió explícitamente "npm publish them all" y eligió el esquema de dist-tags (`latest` y `beta`, igual que beta.1). Los 5 paquetes se publicaron en `0.5.0-beta.2` — ver [docs/releases/0.5.0-beta.2.md](../releases/0.5.0-beta.2.md).
