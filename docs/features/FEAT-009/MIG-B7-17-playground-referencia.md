# MIG-B7-17 — Playground: el mejor implementador de UXDSL y prueba viva de cada capacidad

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · release `0.5.0-beta.7` |
| Prioridad · Tamaño | P1 · **XL** (se entrega por fases; cada fase cierra con su propia evidencia) |
| Cierra | R-22 |
| Depende de | [MIG-B7-09](MIG-B7-09-limpieza-playground.md) (limpiar antes de revisar: archivos muertos, `audit-themes.mjs` roto, arnés de tests) y el arnés de ejemplos de [MIG-B7-16](MIG-B7-16-documentacion-ejecutable.md) |
| Bloquea | MIG-B7-18 |
| Archivos | `packages/playground-nextjs/**` (45 `.uxdsl`, 101 componentes, 35 rutas), `scripts/` (matriz de cobertura), `fixtures/` (smoke de navegador) |

## Por qué

Petición del dueño, 2026-09-23: el playground *"debe ser el mejor implementador
de UXDSL, y sus ejemplos son pruebas vivas de todas sus capacidades, … revisando
todos los componentes"*. Hoy es buen implementador en lo grueso y no demuestra
varias de las capacidades que beta.6 entregó. Esta ficha lo mide y define cómo
cerrarlo.

Es también el cierre de un límite ya declarado: el release record de beta.6 dice
*"The playground app itself was not driven in a browser"* (límite 6, en inglés como está escrito). Lo cubierto
hasta ahora es que compila (35/35 páginas en el hook de pre-commit) y la lógica de
runtime en Chrome sobre un documento controlado, no la aplicación real.

## Estado verificado (2026-09-23, no asumido)

Todas las cifras son de esa fecha, de texto y **sin comentarios** (329 líneas de
los `.uxdsl` son comentarios, casi todas un bloque de alias heredado en
`app/theme-def.uxdsl`; una primera medición sin quitarlas inflaba varios números
— se descartó). Son **candidatos a clasificar, no defectos**: `AGENTS.md` dice que
"un valor que coincide no implica una responsabilidad que coincide", y un `px`
puede ser una medida estable intencional.

**Lo que ya está bien (no tocar sin motivo):** 45 archivos `.uxdsl`; el playground
usa el paquete local (`file:../postcss-uxdsl`), es decir, corre código aún no
publicado. Uso de tokens: `palette(` 444, `density(` 332, `radius(` 88, `space(`
85, `@ds-typo(` 61, `shadow(` 31, `@ds-surface(` 22.

**Candidatos a clasificar:**

| Qué | Cantidad | Por qué importa |
| --- | --- | --- |
| `@media (min-width: …)` escrito a mano | 21 (768 px ×14, 1024 px ×6, **600 px ×1**) | Existen `md()`/`lg()`; el 600 ni siquiera es un breakpoint configurado (`xs 0, sm 480, md 768, lg 1024, xl 1280`). No seguirán un `breakpoints.update`. Puede haber casos legítimos (regla anidada que no es una declaración): clasificar |
| Colores literales | 21 hex (`DemoProductivity` 11, `HomeDemo` 5, `PageToolbar` 3, `AIPrompt` 2) y 17 `rgb()`/`hsl()` | Candidatos a `palette()`/`color()`; algunos pueden ser una demostración deliberada de un color |
| `px` en propiedades con equivalente en token | `border` 51, `padding` 17, `border-radius` 17, `box-shadow` 11, `gap` 7 (de 362 `px` en total; `width`/`height`/`min-`/`max-` suelen ser medidas intencionales) | `border()`, `density()`, `radius()`, `shadow()` |
| `var(--…)` crudas | 43 | Muchas son `--uxdsl__typography…`/`--uxdsl__font…` leídas a mano en vez de `@ds-typo()` (medición previa sin quitar comentarios; recontar) |
| CSS que no es UXDSL | 5 `.module.css` (76 líneas): `AgentGuidance`, `DensityExplanation`, `ColorDocumentation`, `SpacingExplanation`, `BreakpointDocumentation` | El implementador de referencia escribe su propio CSS en UXDSL |
| Estilos en línea | 177 `style={{` y 30 hex en `.tsx` | Los valores calculados en runtime son legítimos; los estáticos no |
| Alias sin uso | `rounded()` 0 veces y `elevation()` 0 veces en los `.uxdsl`; `color()` 1; `@ds-button(` 3 y `@ds-input(` 8 | Demuestran poco de lo que existe |
| Código muerto comentado | 329 líneas comentadas en `.uxdsl` | Ruido; `theme-def.uxdsl` es casi todo un bloque desactivado |

**Cobertura de capacidades** — archivos `.tsx`/`.mdx`/`.ts` del playground que
mencionan cada una (búsqueda de texto; **cota inferior de la ausencia**: mencionar
no es demostrar, y no mencionar no prueba que falte una demo — el paso 1 lo
confirma página por página):

| Capacidad de beta.6 | Archivos que la mencionan |
| --- | --- |
| Gate de contraste (`checkThemeContrast`, `theme --contrast`) | **0** |
| Procedencia del tema (`theme --diff`) | **0** |
| Source maps | **0** |
| `$schema` / tipos (`defineConfig`) | **0** / 1 (`quick-start.mdx`) |
| `includeTheme` y entradas múltiples | **0** |
| Códigos `UXD_*` | **0** |
| `--strict` / `strictTheme` | **0** |
| Integridad de referencias (`references`) | **0** |
| `applyTheme` (runtime) | 1 (`ThemeContext.tsx`) |
| Modo oscuro (`modes`) | 6 |

**Los ejemplos son texto:** 69 `<pre>` en `.tsx`, cero fences en los `.mdx`, separados
de las demos vivas. Nada garantiza que el código que se muestra sea el que se
ejecuta (medido en [MIG-B7-16](MIG-B7-16-documentacion-ejecutable.md)).

## Resultado esperado

1. **Cada capacidad tiene un ejemplo vivo**, y la lista de capacidades no se escribe
   a mano: se **deriva** del metadata del lenguaje (`LANGUAGE_COMPLETIONS`,
   `KNOWN_THEME_FAMILIES`, los campos y estados de Surface/Button/Input), de los
   exports de `postcss-uxdsl/ds-runtime` y de los comandos del CLI. Un test falla
   si una capacidad no tiene ejemplo.
2. **El código que se muestra es el que se ejecuta**, o lo verifica el arnés de
   MIG-B7-16.
3. **El playground sigue las reglas de `AGENTS.md`**: tokens en vez de valores,
   nombres de breakpoint configurados, roles en vez de píxeles, Density para
   espacio de componente.
4. **Comportamiento verificado en un navegador real**, no sólo compilado: modos
   claro/oscuro, los umbrales de breakpoint, estados de interacción, contraste,
   foco visible.

## Implementación (por fases)

**Fase A — Inventario y matriz.** Generar la lista de capacidades (fuente única) y
la matriz capacidad → ejemplo vivo (ruta/componente). Confirmar a mano las
ausencias medidas arriba. Recontar los candidatos con criterio, sin comentarios.

**Fase B — El playground como implementador.** Clasificar cada candidato como
*intencional* (con una línea de justificación) o *evasión de un token*, y sustituir
las evasiones: `@media` a mano → funciones de breakpoint donde la regla sea una
declaración (si es una regla anidada, justificarla); literales → `palette()`/
`color()`/`border()`/`radius()`/`shadow()`/`density()`/`@ds-typo()`; los 5
`.module.css` → `.uxdsl`; `style={{` estático → CSS; retirar el código comentado
muerto. Incluye `scripts/audit-themes.mjs`, que reimplementa parseo responsive, px y luminancia en vez de usar el motor compartido y hoy da un veredicto más estrecho que `checkThemeContrast` (hallazgo de MIG-B7-09; sustituirla lo volvería FAIL con los fallos conocidos). **Regla dura: ningún cambio visual involuntario** — antes/después de cada
área (comparación de estilos computados o capturas), y si algo cambia a propósito
se declara.

**Fase C — Capacidades sin ejemplo vivo.** Añadir lo que falte, **llamando a la API
real y no describiéndola**: p. ej. la página de contraste ejecuta
`checkThemeContrast` sobre el tema activo y pinta el informe; una sección de
errores muestra un `UXD_*` real capturado del compilador; la de procedencia usa la
salida de `theme --diff`. Incluir modo oscuro (`modes`), `includeTheme`/multi-entry,
`$schema`, source maps, integridad de referencias, `--strict`, y editor support
(MIG-B7-12).

**Fase D — Revisión por página y por componente** (35 rutas, 101 componentes; los
11 `*Documentation`/`*AgentGuidance` primero). Una **tabla en el registro de esta
ficha**, una fila por ítem, con: tokens correctos (Density vs Spacing, Palette vs
Color, Typography role), responsive con nombres configurados, estados (hover,
`focus-visible`, disabled, selected, invalid), oscuro, contraste, semántica HTML,
sin variables de nombres antiguos, y si su ejemplo es prueba viva. No 101 fichas.

**Fase E — Navegador real.** Conducir la aplicación en Chrome (ya existe
`playwright-core` en `fixtures/mig02-nextjs-cssmodules`): por ruta, sin errores de
consola, sin `var()` sin resolver (estilo computado), sin avisos de UXDSL; alternar
claro/oscuro; probar 767/768 y 1023/1024. Cierra el límite 6 de beta.6.

Un bug del motor que el playground revele **no se arregla aquí**: se abre como
historia aparte (como MIG-B7-14), con su reproducción.

## Fuera de alcance

- Rediseño visual o de marca; contenido pedagógico nuevo más allá de cubrir las
  capacidades ausentes.
- Cambios de comportamiento de UXDSL (cualquier hallazgo va a su propia ficha).
- SEO, analítica, rendimiento del sitio.
- La limpieza de archivos muertos, `audit-themes.mjs` y el arnés de componentes:
  son de MIG-B7-09, de la que esta ficha depende.

## Pruebas

- **Matriz de cobertura como test:** falla si una capacidad derivada no tiene
  ejemplo. Control negativo: quitar un ejemplo hace fallar el test.
- **Arnés de MIG-B7-16** aplicado a los ejemplos de texto del playground.
- **Smoke de navegador** (Fase E), con control negativo: introducir a propósito una
  `var()` inexistente en una página y confirmar que se detecta.
- Para cada evasión sustituida en la Fase B: la comprobación antes/después de que
  no cambió el estilo computado.
- `stylelint` y el build de producción del playground (ya corren en el pre-commit).

## Documentación

- Documentación del playground (las páginas de la Fase C) y el listado de
  fuentes alineadas de `AGENTS.md` si aparecen archivos nuevos.
- README raíz si cambia lo que el playground afirma demostrar.
- CHANGELOG sólo si un cambio visual del playground afecta a consumidores (no debería).

## Criterios de aceptación

- [x] La matriz capacidad → ejemplo se genera, cubre todas las capacidades
      derivadas, y un test la exige. **(Fase A.)** Ojo: "la exige" significa que las
      brechas están registradas y sólo pueden encogerse; **no** que ya no haya brechas
      (hay 37, todas para las fases B y C).
- [x] Los candidatos de la Fase B están clasificados uno a uno; ninguna evasión
      de token queda sin sustituir o sin justificar.
- [x] Cada capacidad ausente hoy tiene un ejemplo vivo que llama a la API real.
- [ ] Los 11 componentes de documentación y las 35 rutas tienen su fila revisada.
- [x] Recorrido en Chrome real sin errores de consola, sin `var()` sin resolver ni
      avisos de UXDSL, en claro y oscuro y en los umbrales de breakpoint.
- [x] Sin cambio visual involuntario, comprobado y registrado.

## Verificación

```bash
npm --prefix packages/playground-nextjs run build
npm --prefix packages/playground-nextjs run stylelint
npm --prefix packages/playground-nextjs run test:themes
UXDSL_CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run verify:playground-browser   # Fase E: fixtures/playground-browser/walk.js --build
npm test
```

## Entrega

Por fases, una rama y un PR por fase: `feat(FEAT-009): MIG-B7-17 phase A - capability
matrix`, … cada una con su propio registro. La ficha cierra cuando la Fase E pasa.

## Registro de implementación y evidencia

Estado de esta revisión documental: **En curso — Fases A, B (cinco rebanadas, `audit-themes.mjs` incluido), C y E hechas (2026-09-28); queda la Fase D (revisión por página y componente), que se hará con el dueño.** La matriz no tiene brechas (113/113) y el recorrido en Chrome real de las 32 rutas pasa, con sus controles negativos.
Completar por fase conforme al
[protocolo de agentes](README.md#protocolo-de-implementación).

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente, por fase |
| Reproducción antes del cambio | Medición del 2026-09-23 (ver "Estado verificado"); repetir sobre el SHA base de cada fase |
| Criterio → regresión | Pendiente |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente — declarar cualquier cambio visual deliberado |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | Pendiente |
| Límites y seguimiento | Pendiente — qué rutas/componentes quedaron sin revisar y por qué |

### Fase A — hecha (2026-09-24)

Entrega: `1d0d697` en `feat/mig-b7-17a-capability-matrix` (apilada sobre `feat/mig-b7-09-playground-cleanup`, PR #11). PR: pendiente de mergear; el SHA se fijó en un commit posterior, mismo patrón que MIG-B6-21.

**Qué se construyó.** `scripts/lib/capabilities.js` deriva las capacidades de las fuentes de
UXDSL — nunca de una lista escrita a mano — y detecta dónde las muestra el playground;
`scripts/generate-capability-matrix.js` escribe
[`docs/architecture/playground-capability-matrix.md`](../../architecture/playground-capability-matrix.md)
(con `--check`); `scripts/capability-matrix.test.js` sostiene tres ratchets; y
`packages/playground-nextjs/capability-evidence.json` guarda la evidencia manual, las
brechas registradas y el baseline de dogfooding.

| Fuente de UXDSL | Capacidades derivadas |
| --- | --- |
| Directivas y funciones (`LANGUAGE_COMPLETIONS`) | 5 directivas, 9 funciones de valor, 5 de breakpoint |
| Familias de tema (`KNOWN_THEME_FAMILIES`) | 15 |
| Roles y estados que declara cada motor | 9 roles, 12 estados |
| API de runtime que la documentación del paquete nombra | 35 |
| `--help` del CLI | 5 comandos, 12 flags |
| `exports` del `package.json` | 5 subrutas |
| Diagnósticos | 1 (los códigos `UXD_*`) |

**Resultado: 113 capacidades, 76 mostradas al nivel que exigen, 37 brechas.** Las brechas: 19 de
la API de runtime (`checkThemeContrast`, `resetTheme`, `getAppliedTheme`, `loadPersistedTheme`,
`subscribeTheme`, `resolveTheme`, `getDefaultTheme`, `inspectReferences`, los setters
`updatePalette`/`updateColor`/`updateSpacing`/`updateBreakpoint`…), 12 del CLI (10 flags y 2
comandos), 2 exports (`./config`, `./schema/theme.schema.json`), los alias `elevation()` y
`rounded()`, `xl()`, y los códigos `UXD_*`.

**Lo que se corrigió leyendo el código, no el texto** (la primera versión del detector daba 43
brechas, 6 de ellas falsas):
- `DemoButtons`, `ButtonDemo` e `InputDemo` **no contienen ninguna directiva `@ds-button` ni
  `@ds-input`**: renderizan con `buttonComponentCss()`/`inputComponentCss()` en tiempo de
  ejecución y enumeran los roles con `Object.keys(getButtonTokens(theme)).map(…)`. Así
  que todos los roles, incluidos los personalizados, están vivos aunque ninguno aparezca como
  literal. El detector conoce ahora esas dos vías.
- `postcss-uxdsl` (el plugin) no se importa en ningún sitio: el sitio se compila con
  `uxdsl build`. Es evidencia manual verificable (`package.json` contiene `uxdsl build`).
- La `uxdsl.config.cjs` del propio playground es un objeto plano sin `defineConfig`: brecha
  real de dogfooding, no del detector.
- `xl()` no se usa nunca fuera de comentarios en un `.uxdsl` (las apariciones que ve un
  `grep` están en bloques comentados).
- Las demos de paleta, color y espaciado escriben las variables CSS con `setProperty` a
  mano en vez de llamar a `updatePalette`/`updateColor`/`updateSpacing`.

**Confirmado a mano contra las páginas** (las ausencias que la ficha medía por texto):
el quick-start sólo enseña `init`, `build --watch` y `generate-entry`; el playground importa de
`ds-runtime` decenas de generadores e inspectores pero no `checkThemeContrast`, `resetTheme`,
`getAppliedTheme`, `loadPersistedTheme` ni `subscribeTheme`; `ThemeContext.tsx` sólo importa
`applyTheme`, `deepMergeTheme` y `validateAndNormalizeTheme`.

**Los tres ratchets** (`scripts/capability-matrix.test.js`, 7 tests):
1. Una capacidad sin ejemplo vivo que no está registrada **falla** (una capacidad nueva no
   puede quedar sin mostrar), y un registro que ya se muestra **también falla** hasta
   quitarlo — la lista sólo encoge, y la Fase C tiene una meta medible: lista vacía.
2. Una familia de tema sin regla de consumo **falla** (no puede saltarse una familia nueva).
3. Los seis conteos de estilo que el playground escribe fuera de UXDSL (`@media` a mano 21,
   hex en `.uxdsl` 21, `rgb()`/`hsl()` 17, `.module.css` 5, `style={{` 177, hex en `.tsx` 30,
   **sin comentarios**) **no pueden crecer**: es la meta de la Fase B. (Desde la Fase B
   tampoco pueden quedarse por encima de lo real: una mejora obliga a bajar el baseline.)

**Control negativo, ejecutado a mano contra el playground real** (cada uno falla en el test
correcto y se restauró): quitar una brecha conocida; registrar como brecha algo ya mostrado;
añadir un `@media` a mano en un `.uxdsl`; quitar la evidencia manual del plugin; apuntar la
evidencia manual a una cadena que no existe.

**Límites de la Fase A.**
- **Es una cota inferior.** Lee texto fuente, no páginas renderizadas: "vivo" quiere decir que
  el código lo ejecuta, no que se haya visto en pantalla (eso es la Fase E). Para roles y
  estados se apoya en que un archivo use el generador *y* lo enumere o lo nombre, no en que
  la página lo muestre.
- Los estados de interacción (`hover`, `focus`…) cuentan como vivos si existe una demo que
  renderiza el componente: el lector puede pasar el ratón, pero no hay una guía que lo pida.
- Las brechas registradas **no están aceptadas**: son el trabajo de las fases B y C.
- Los flags del CLI sólo pueden ser "vivos" si tienen un equivalente de runtime (hoy sólo
  `--contrast` ↔ `checkThemeContrast`); el resto queda en "documentado" como máximo.

### Fase B, primera rebanada — `@media` a mano → funciones responsivas (2026-09-24)

Rama `feat/mig-b7-17b-dogfooding` (apilada sobre `feat/mig-b7-17a-capability-matrix`, PR #12,
que a su vez va sobre #11). Orden de merge: #11 → #12 → esta. SHA de entrega: `a3c594a`.

**Qué se cambió.** 19 bloques `@media (min-width: …)` escritos a mano en 13 archivos `.uxdsl`
pasan a la función responsiva de UXDSL sobre la propiedad, con el breakpoint configurado que
ya tenían por valor: 14 de `768px` → `md(…)` y 5 de `1024px` → `lg(…)`. El patrón:

```css
/* antes */
.hero-content { flex-direction: column; }
@media (min-width: 768px) { .hero-content { flex-direction: row; } }
/* después */
.hero-content { flex-direction: xs(column) md(row); }
```

Archivos: `app/layout`, `app/page`, `app/docs/breakpoints/breakpoints`, `HomeInteractiveDemos`,
`PageToolbar`, `DemoColors`, `DemoPalette`, `DemoSurfaces`, `DemoShadows`, `DemoBorders`,
`DemoProductivity`, `DemoSpacing`, `DemoBreakpoints`. `@media` a mano en `.uxdsl`: **21 → 2**.

**Lo que se dejó, y por qué (clasificado, no omitido).**

| Candidato | Decisión |
| --- | --- |
| `app/not-found.uxdsl` `@media (min-width: 600px)` | **Excepción intencionada.** 600px no es `sm` (480) ni `md` (768); pasarlo a un breakpoint configurado cambiaría el diseño entre 600 y 767px. Se documentó con un comentario en el propio archivo. Es una excepción CSS-nativa local, como pide AGENTS.md. |
| `components/SideNav.uxdsl` `@media (min-width: 1024px)` | **Diferido.** Es un bloque anidado grande (varias reglas, estados); convertirlo propiedad a propiedad es un cambio de otro tamaño y lo acompaña su propia comparación. |
| 5 `.module.css` | Diferidos a la siguiente rebanada (usar `space()` sólo donde el valor coincide exactamente; conservar el literal donde no hay token). |
| Hex/`rgb()` en `.uxdsl` y `.tsx` | Pendiente de clasificar uno a uno. Ya se sabe que son legítimos los colores de la maqueta de VS Code en `DemoProductivity.uxdsl` y `HomeDemo.uxdsl` (imitan otra aplicación) y los blancos con alfa de superposición en `AppHeader`. **Deriva real, no arreglada aquí:** los círculos de tema de `PageToolbar` usan `#2C415C`, `#15803D` y `#7b1fa2`; el morado no es el primario del tema (`#7e22ce`). |
| 177 `style={{…}}` | 152 son literales estáticos (46 sólo en `PalettePlayground.tsx`); los otros 25 dependen de estado o props y hay que revisarlos uno a uno. Los estáticos pasan a CSS en una rebanada propia. |
| 329 líneas comentadas en `.uxdsl` | Código muerto por retirar, sin cambio de comportamiento. |
| `scripts/audit-themes.mjs` | Duplica parsers que el motor ya expone (AGENTS.md: no añadir parsers aparte). Seguimiento propio. |

**Evidencia — cómo se sabe que no cambió el aspecto.** Un `@media` a mano y una función
responsiva compilan a CSS distinto, así que "se ve igual" no se puede afirmar leyendo el diff.
Se construyó un arnés que lo mide en Chrome real
([`fixtures/playground-browser`](../../../fixtures/playground-browser/README.md)): sirve la
build de producción, visita **28 rutas × 10 anchos** (390, 479, 480, 767, 768, 1023, 1024,
1279, 1280, 1440 — a ambos lados de cada umbral) y guarda, por cada elemento del `<body>`, su
caja y 68 propiedades calculadas: **193,930 registros por snapshot**.

| Comprobación | Resultado |
| --- | --- |
| **Ruido**: dos snapshots de la misma build (antes) | **0 diferencias** — el arnés es determinista (animaciones congeladas, `Math.random` con semilla, `Date.now` fijo, red local, `requestAnimationFrame` avanzado a mano; sin ello las manchas animadas de la portada diferían) |
| **Después**: build con los 19 bloques convertidos vs. la línea base | **0 diferencias** sobre los mismos 193,930 registros (dos ejecuciones: tras convertir, y de nuevo tras el resto de la rebanada) |
| **Control negativo**: `md` → `lg` a propósito en un componente (`DemoColors`) | **3,146 diferencias**, en `/colors` y `/docs/colors` a 768 y 1023 px (`flexDirection row -> column`) — y sólo ahí. Se revirtió y se volvió a medir: 0 |

CSS compilado: bloques `@media` en `src/app/uxdsl.css` (archivo versionado): **50 en HEAD → 52**.
Es un cambio de forma del CSS generado; el comportamiento lo cubre la tabla anterior.

**El ratchet ahora fija también las mejoras.** `capability-matrix.test.js` pedía que los
conteos de dogfooding no crecieran; ahora exige además que **coincidan** con el baseline: si
mejoran, el test falla hasta que se baje la cifra en `capability-evidence.json`, y la mejora
ya no se puede perder en silencio. Baseline nuevo: `handWrittenMediaQueries` 21 → **2**; el
resto sin cambios (`hexColorsInUxdsl` 21, `rgbHslInUxdsl` 17, `cssModuleFiles` 5,
`inlineStyleObjects` 177, `hexColorsInTsx` 30).

**Límites de esta rebanada.**
- El arnés compara estilos calculados y cajas, no píxeles; sólo Chrome, sólo tema claro, sin
  estados `hover`/`focus`, y sin abrir el editor de tema (eso es la Fase E).
- Cubre las 28 rutas que existen como archivos; no rutas dinámicas ni `api`.
- Sólo se probó que no cambia nada; no se ha vuelto a revisar el resultado *con una persona
  mirándolo* — es la Fase E.
- Cinco de las seis métricas de dogfooding siguen sin mover (hex en `.uxdsl` y en `.tsx`,
  `rgb`/`hsl`, `.module.css`, `style={{}}`): son las siguientes rebanadas de la Fase B.

### Fase B, rebanada 2 — `@media` restantes, colores literales, `var()` leídas a mano y `px` en los `.uxdsl` (2026-09-28)

Rama `feat/mig-b7-17b2-dogfooding` (apilada sobre `feat/mig-b7-17b-dogfooding`, PR #13); SHA
fijado al mergear.

**Qué se cambió** (sólo `.uxdsl`; recuento sin comentarios, con el mismo contador del ratchet):

| Métrica | Antes | Después |
| --- | --- | --- |
| `@media` a mano | 2 | 2 (los dos clasificados intencionales, abajo) |
| Hex en `.uxdsl` | 21 | **16** |
| `rgb()`/`hsl()` en `.uxdsl` | 17 | **2** |
| Líneas con `var(--uxdsl__…)` leída a mano en `.uxdsl` | 38 | **6** (abajo, por qué quedan) |
| `padding`/`gap` en `px` con un valor exacto de la escala | 17 | **0** |

- **Superposiciones blancas/negras → `color(white, α)` / `color(black, α)`** (18): la velo del
  modal de carga (`AIPrompt`), la del menú móvil (`SideNav`), los botones translúcidos de la
  cabecera sobre el degradado primario (`AppHeader`, 8) y el borde sutil de `PageToolbar`. Son
  una *identidad* de color intencional (AGENTS.md: "`color(token)` for an intentional color
  identity"), no un rol de Palette: pasarlas a `palette(primary-contrast, α)` cambiaría el modo
  oscuro — ver hallazgos. `color: white` y `#ffffff` → `color(white)`.
- **Círculos de tema de `PageToolbar` → `color(slate-800)`, `color(green-600)`,
  `color(purple-600)`**: son muestras de *otro* tema, que la Palette del tema activo no puede
  dar; un Color es el token correcto.
- `HomeDemo` `@keyframes pulse`: `rgba(0,0,0,0)` → `transparent` (es el mismo valor).
- **Lecturas de tipografía a mano → `@ds-typo()`**: los dos bucles `@each` de
  `ResponsiveSyntaxExplainer` (`.editable-typography-element.<rol>` y `.showcase-text.sample-<rol>`,
  14 roles × 10 campos) y `.sample-code` pasan a `@ds-typo(#{$tag})` / `@ds-typo(pre)`. Antes
  emitían también `text-transform`/`text-decoration`/`font-style` de variables que el tema no
  define (el navegador las trataba como `unset`); `@ds-typo` sólo emite lo definido (MIG-B6-17).
- `PaletteThemeExplorer`: `var(--uxdsl__palette__surface-main)` / `…neutral-light` →
  `palette(surface-main)` / `palette(neutral-light)` (compilan a lo mismo).
- **`px` → `space(n)`** en 17 `padding`/`gap` cuyo valor está exactamente en la escala
  (2 = `space(1)`, 4 = `space(2)`, 8 = `space(3)`, 12 = `space(4)`): chips, etiquetas y
  separaciones pequeñas que deben ser estables — por eso `space()` y no `density()`, que
  cambiaría su valor en los umbrales. `DemoBreakpoints`, `DemoColors`, `DemoPalette`,
  `DemoDensity` (5), `DemoSurfaces` (3), `ResponsiveSyntaxExplainer` (5), `AppHeader`.
- `DensityPlayground.uxdsl` tenía tres reglas repetidas dos veces, idénticas; se quitó la copia.

**Clasificación de lo que queda (intencional, una línea cada una):**

| Candidato | Por qué se queda |
| --- | --- |
| `app/not-found.uxdsl` `@media (min-width: 600px)` | Umbral local deliberado (ya justificado en la rebanada 1). |
| `SideNav.uxdsl` `@media (min-width: 1024px)` | Cambia el componente entero de cajón a barra fija **y aplica `@ds-surface(flat)` sólo desde `lg`**: una directiva no es responsiva (AGENTS.md: "Directives style a whole rule and are not themselves responsive"), así que pasarlo a funciones obligaría a desplegar a mano los campos del Surface — una evasión peor. Límite: no seguirá un `breakpoints.update` de `lg` (ver hallazgos). |
| 11 hex en `DemoProductivity.uxdsl`, 5 en `HomeDemo.uxdsl` | Imitan el tema *Dark+* de VS Code (`#1e1e1e`, `#252526`, `#d4d4d4`, `#9cdcfe`, `#ce9178`, `#6a9955`, `#333`): son la identidad de otra aplicación, no de este tema. |
| `page.uxdsl` `filter: drop-shadow(0 4px 12px rgba(0,0,0,0.1))` | Es un `filter`, no un `box-shadow`: AGENTS.md avisa de que los presets de Shadow no valen para `drop-shadow`. |
| `DensityPlayground.uxdsl` `text-shadow: 0 0 8px rgba(255,77,77,0.4)` | Brillo decorativo del resaltado; no es un rol de UI ni hay token. (El componente, además, no se usa: ver hallazgos.) |
| `var(--uxdsl__font__ui, …)` (`layout`) y `var(--uxdsl__font__code, monospace)` (`ThemeBackground`) | No existe una función de fuente: el propio `theme/base.json` referencia las familias así (`"fontFamily": "var(--uxdsl__font__ui)"`). |
| `DemoTypography.uxdsl` `.sample-h2`: `var(--uxdsl__typography__h3-size)` y `…p-weight` | Mezcla deliberada de campos de dos roles sobre `@ds-typo(h2)`; no hay función que lea *un* campo de un rol. (Componente sin uso: ver hallazgos.) |
| `var(--uxdsl__density__#{$i})` en `DemoDensity`/`RussianDoll` (`inset: calc(… * -1)`) | Negar un token dentro de `calc()` en un bucle: `density()` no se puede interpolar ahí con `#{$i}` y el valor es el mismo. |
| `var(--theme-color)`, `var(--blob-opacity)`, `var(--side-nav-sticky-top)` | Propiedades propias del componente (las fija el TSX o el propio archivo), no tokens. |
| `border: 1px/2px solid palette(…)` (≈75) | Trazo fino con el color **ya** en Palette. `border(n)` trae su propio color (`gray-300`), así que usarlo exigiría un `border-color` en cada uno; el ancho de 1–2px es una medida estable, no una decisión del sistema de bordes. |
| `border-radius` en `px` (≈17: 2, 4, 6, 8px) | Esquinas pequeñas estables; los presets `radius(n)` son responsivos (cambian en `lg`), así que ninguno es igual. Adoptarlos es un cambio de diseño, para la Fase D. |
| `box-shadow: 0 0 0 Npx palette(…)` (anillos, ≈10) | Técnica de anillo/contorno con color de Palette, no una elevación: ningún preset de Shadow es un anillo. |
| `padding` con 1px, 6px, 10px o 30px (10) | No existen en la escala (`space(1)` = 2px); mezclar `space()` y `px` en la misma declaración no aclara nada. |

**Cambio visual declarado (uno):** el círculo "purple" de `PageToolbar` pasa de `#7b1fa2` a
`color(purple-600)` = `#7e22ce`, que es el primario real del tema *purple* (y el que ya usa el
botón equivalente de `AppHeader`). En el snapshot es exactamente eso: 280 diferencias = 1
elemento × `backgroundColor` × 28 rutas × 10 anchos, `rgb(123,31,162)` → `rgb(126,34,206)`.

**Evidencia — cómo se sabe que no cambió nada más.** El arnés de la rebanada 1
([`fixtures/playground-browser`](../../../fixtures/playground-browser/README.md)), ahora también
en **modo oscuro** (`--scheme dark`, que emula `prefers-color-scheme: dark`; `ThemeContext` lo
sigue cuando no hay `data-theme` guardado) — comprobado que el snapshot oscuro es oscuro (la
cabecera pasa a `rgb(221,191,255)` con texto negro).

| Comprobación (28 rutas × 10 anchos) | Resultado |
| --- | --- |
| Claro: base vs. después | **280 diferencias, todas el círculo declarado**; nada más |
| Oscuro: base vs. después | **280 diferencias, las mismas** (el círculo declarado); nada más |
| Ruido oscuro: dos snapshots oscuros de la misma build | **0 diferencias** sobre 189,510 registros |

`compare.js` ahora **normaliza la serialización del color**: `rgba(0, 0, 0, 0.5)` (un literal)
y `color(srgb 0 0 0 / 0.5)` (lo que da el `color-mix(…, transparent)` al que compilan
`palette(x, α)`/`color(x, α)`) se escriben como un único `rgba()` de 8 bits con α a 3
decimales; una diferencia real de 1/255 sigue saliendo. Sin normalizar (`--exact`) la
comparación clara da 5,470 diferencias, todas de esa serialización.

**Hallazgos (registrados, no arreglados aquí):**
- **Modo oscuro de `AppHeader`**: en oscuro el primario es `#ddbfff` y su contraste negro, pero
  los botones translúcidos, el separador y el icono del tema siguen siendo blancos (antes
  literal, ahora `color(white)`: mismo aspecto). Semánticamente son "sobre primario" y deberían
  ser `palette(primary-contrast, α)`; hacerlo cambia el modo oscuro. Para la Fase D (oscuro/contraste).
- **Círculo "default" de `PageToolbar`**: es `slate-800` (`#2C415C`), el primario del tema *slate*;
  el tema *default* es el base, cuyo primario es morado. Deriva de diseño; decisión del dueño.
- **Componentes sin uso**: `DensityPlayground.tsx` y `DemoTypography.tsx` no se importan en
  ningún sitio, pero sus `.uxdsl` se compilan en la hoja global; y `EditTypographyDialog` sólo lo
  abre `DemoTypography`, así que es inalcanzable. MIG-B7-09 no los detectó. Seguimiento: retirarlos
  (con su propia comparación, porque sus clases podrían estar compartidas).
- **Posible hueco del motor (no un bug):** no hay forma de aplicar una regla ni una directiva
  "desde el breakpoint `lg`" con un nombre configurado; `SideNav` necesita un `@media` con
  `1024px` literal que no seguirá un `breakpoints.update`. Repro: `.a { @media (min-width: 1024px)
  { @ds-surface(flat); } }` es la única forma de expresarlo. Candidato a historia propia.

**Comandos** (macOS, Node 20, Chrome estable): `npm test` → exit 0; `npm run
verify:doc-examples` → exit 0 (45 ejemplos, 29 extractos de tema); `node
scripts/generate-language-artifacts.js --check` → exit 0; ratchet de dogfooding bajado a
`hexColorsInUxdsl` 16 y `rgbHslInUxdsl` 2 y matriz regenerada. `npm run stylelint` del
playground **ya fallaba antes** (385 problemas en HEAD, casi todos de formato: líneas vacías,
`rgba` → `rgb`…); no es parte del pre-commit. En los 13 archivos tocados baja de 225 a 176; el
total, de 385 a 336.

**Límites.** Los del arnés (sin píxeles, sin `hover`/`focus`, sin editor de tema); los estados
`hover` de `AppHeader` (`color(white, 0.2)`, idéntico por construcción) no se midieron.

### Fase B, rebanada 3 — los 5 `.module.css` pasan a `.uxdsl` (2026-09-28)

Misma rama; SHA fijado al mergear. `.module.css` en el playground: **5 → 0**.

**Qué se cambió.** Cada módulo pasa a un `.uxdsl` del componente, con las clases prefijadas
porque un `.uxdsl` es global (el nombre con hash de CSS Modules ya no las aísla):

| Antes | Después | Lo importan |
| --- | --- | --- |
| `AgentGuidance.module.css` | `AgentGuidance.uxdsl` (`.agent-guidance*`) | `AgentGuidance` |
| `DensityExplanation.module.css` | `DensityExplanation.uxdsl` (`.density-explanation*`) | `DensityExplanation` |
| `ColorDocumentation.module.css` | `ColorDocumentation.uxdsl` (`.color-documentation*`) | `ColorDocumentation` |
| `SpacingExplanation.module.css` | `SpacingExplanation.uxdsl` (`.spacing-explanation*`) | `SpacingExplanation` **y `DemoSpacing`** (sus cajas "Try it" y el botón *Edit space(4)* usaban este módulo) |
| `BreakpointDocumentation.module.css` | `DocumentationSection.uxdsl` (`.doc-section*`) | `BreakpointDocumentation`, `BorderDocumentation`, `ShadowDocumentation`, `SurfaceDocumentation`, `TypographyDocumentation` — era de las cinco, así que se nombra por lo que es |

Dentro, los valores pasan a tokens **sólo cuando son exactos**: márgenes, `padding` y `gap` en
`rem` que están en la escala → `space(n)` (0.5rem = `space(3)`, 0.75 = 4, 1 = 5, 1.5 = 6, 2 = 7);
los que no (1.25rem, 0.65rem, 3rem, 5rem) quedan literales; los tamaños de letra son la escala de
prosa propia de estas secciones, no un rol (cambiarlos a `@ds-typo` es de la Fase D). Colores:
`#94a3b8` → `color(gray-400)`, `#e2e8f0` → `color(gray-200)`, `#64748b` → `color(gray-500)`,
`#2563eb` → `color(blue-500)`, `#fff`/`white` → `color(white)` (iguales). La caja de
`DensityExplanation` tomaba su `padding` de un `style={{}}` con un ternario; ahora cada variante
lo declara en su clase (`density(4)` / `space(4)`).

**Cambios visuales declarados** — los hex del módulo que no tienen un Color igual se llevan al más
cercano, en vez de dejar literales nuevos en un `.uxdsl`:

| Uso | Antes | Después | Diferencias medidas (claro = oscuro) |
| --- | --- | --- | --- |
| Fondo de los bloques de código | `#101827` | `color(gray-900)` `#0B1220` | 824 (`backgroundColor`) |
| Texto de las cajas "Content" | `#172554` | `color(slate-900)` `#102A43` | 154 (`color`) |
| Fondo de las cajas responsivas | `#bfdbfe` | `color(blue-100)` `#BBDEFB` | 110 (`backgroundColor`) |
| Botón *Edit density(4)* / *Edit space(4)* | `#1d4ed8` | `color(blue-500)` `#2563EB` | 44 (`backgroundColor`) |
| Su `:hover` / anillo `:focus-visible` | `#1e40af` / `#60a5fa` | `color(blue-900)` / `color(blue-300)` | (estados, no medidos) |

El botón *Edit* sigue siendo un botón estilado a mano, no `@ds-button`: adoptarlo cambia forma y
color (a primario morado) — decisión de diseño para la Fase D, anotada.

**Evidencia.** Snapshot de la build de la rebanada 2 (ahora con los tres diálogos abiertos, ver
abajo) contra la build de esta rebanada, 28 rutas × 10 anchos + 3 diálogos × 2 anchos, claro y
oscuro: **1,132 diferencias en claro y 1,132 en oscuro, todas y sólo las cuatro de la tabla**
— ninguna de caja, margen, `padding`, tipografía ni orden de la cascada. (La primera versión
llevaba `#172554` a `indigo-900`; se cambió a `slate-900`, más cercano, y se volvió a medir en
`/densities`, `/docs/densities`, `/spacing` y `/docs/spacing`: la única diferencia con la anterior
son esas 154, con el valor nuevo.) Control cruzado: las builds de las rebanadas 1→2 comparadas
dos veces por separado (claro 193,930 y oscuro 192,554 registros) dan 0 — el snapshot es
reproducible entre builds, no sólo dentro de una.

**Arnés.** `snapshot.js` ahora abre también tres diálogos que sólo existen tras un clic (editar
Density, editar Space, el editor de breakpoints de tipografía) y los guarda como
`<ruta>#<nombre>` a 390 y 1280px. Se comprobó que se abren: cada uno añade sus 9–22 elementos
(fondo `position: fixed`, el diálogo, su `h3`…).

**Formato.** Los cinco `.uxdsl` nuevos pasan `stylelint` sin problemas (se expandieron los
bloques de una línea del módulo; el CSS compilado es idéntico ignorando espacios y comentarios).

**Comandos:** `npm test` → exit 0 (ratchet con `cssModuleFiles` 0 e `inlineStyleObjects` 176 — el
`style={{}}` de `DensityExplanation` —, matriz regenerada); `npm run verify:doc-examples` → exit 0;
`node scripts/generate-language-artifacts.js --check` → exit 0.

### Fase B, rebanada 4 — `style={{}}` estáticos a CSS y código muerto (2026-09-28)

Misma rama; SHA fijado al mergear.

| Métrica (ratchet, sin comentarios) | Antes | Después |
| --- | --- | --- |
| `style={{` en `.tsx` | 176 | **50** (todos clasificados, abajo) |
| `style={{` en `.mdx` (el ratchet no los cuenta) | 12 | **0** |
| Hex en `.tsx` | 30 | **27** |
| Hex en `.uxdsl` | 16 | **17** — subida deliberada, ver abajo |
| Líneas de comentario con código muerto en `.uxdsl` | 99 | **0** (queda un falso positivo del contador: un comentario que cita `style={{}}`) |

**Qué se cambió.** 126 objetos `style={{}}` estáticos de 24 archivos `.tsx` (y los 12 de dos `.mdx`) pasan a clases en el `.uxdsl`
del componente (o a uno nuevo: `EditDialog`, `ThemeConfigJsonEditor`, `CodeBlock`,
`InteractiveLogo`, `app/typography/typography-page`, `app/docs/palette/palette-docs`), con los
valores a token donde son exactos (`rem` de la escala → `space(n)`, `var(--uxdsl__palette__x)` →
`palette(x)`, `var(--uxdsl__space__n)` → `space(n)`, `var(--uxdsl__radius__1, 6px)` → `radius(1)` —
el *fallback* nunca se usaba —, `rgba(0,0,0,α)` → `color(black, α)`). Los más grandes:
`PalettePlayground` (46: barra de controles, panel "CSS Usage"), `PaletteThemeExplorer` (15),
los diálogos de edición de Density y de Space (19, **escritos dos veces**: ahora comparten
`EditDialog.uxdsl`), `ThemeConfigJsonEditor` (8), el `textarea` JSON de seis demos (una sola
`.code-textarea` en `app.uxdsl`), `quick-start.mdx` (10) y los tres círculos de tema de
`AppHeader`, cuyo `--theme-color` hex pasa a `color(purple-600|green-600|slate-800)`. Donde el
objeto mezclaba estado y constantes, las constantes van a CSS y sólo el valor calculado queda en
línea (el color de cada muestra de paleta); donde era un ternario sobre estado, pasa a una clase
de estado (`.is-selected`, `.is-invalid`).

**Lo que queda en línea (50), clasificado:**

| Qué | Cuántos | Por qué se queda |
| --- | --- | --- |
| Calculados en runtime | 22 | Color de cada token/preview elegido por el usuario (`DemoColors` 2, `DemoPaletteConfig`, `PalettePlayground`, `PaletteThemeExplorer` 2), un preset enumerado del tema (`DemoBorders` 3, `DemoShadows`), anchos y `padding` medidos (`DemoBreakpoints`, `DemoDensity`, `DemoSpacing`, `ResponsiveSyntaxExplainer`), la posición de las partículas (`InteractiveLogo` 3), la opacidad de carga (`ThemeBackground`), el color del breakpoint activo (`ResponsiveSyntaxExplainer` 3) y el degradado del tema *custom* de `AppHeader` (sólo existe con un tema del usuario; sin token) |
| Componentes inalcanzables | 22 | `EditTypographyDialog` (13; sólo lo abre `DemoTypography`, que no se importa), `ButtonDemo` (6) y `HomeDemo` (3) no se importan en ninguna ruta: no hay página donde medir un cambio. Ver hallazgos |
| Páginas de error | 6 | `global-error.tsx` (2) sustituye al layout raíz y se pinta aunque la hoja no cargue: debe llevar su estilo. `error.tsx` (4) lleva *fallbacks* (`red`, `#333`) a propósito y el arnés no puede provocarlo |

Hex que quedan en `.tsx` (27): ejemplos de código dentro de cadenas (`BorderDocumentation`,
`ColorDocumentation`), el negro/blanco que devuelve el cálculo de contraste YIQ (`DemoColors`,
`DemoPaletteConfig`), la hoja de "salida compilada" que inyecta la demo de estrés de
`DemoProductivity` (paleta propia de la demo), el valor por defecto de un `<input type="color">`
y el rojo del breakpoint activo (`ResponsiveSyntaxExplainer`), y el degradado *custom*. **Subida
deliberada de hex en `.uxdsl` (16 → 17):** el borde de la tarjeta de Vite en `quick-start`
(`#646cff`, el color de marca de Vite, identidad de otro producto) salió de un `style={{}}` de
`.mdx` — que ningún contador mide — a CSS; el número de literales no crece, sólo pasa a ser visible.

**Código muerto retirado.** `app/theme-def.uxdsl` era todo muerto y se verificó uno a uno:
~95 líneas comentadas (alias de paleta, familias de fuente, una escala tipográfica y otra de
espaciado de antes del JSON); `--uxdsl__font__code: "JetBrains Mono"…` en `:root`, **sin efecto**
— el `:root` del tema generado va después en la misma hoja y lo devuelve a `monospace`
(comprobado en Chrome leyendo el valor calculado) —; `--uxdsl__radius__full`, que nada lee; y un
bloque `@theme` de `density-1..6` que el JSON de densidades reemplaza (el CSS compilado de Density
no cambia al quitarlo). El archivo queda con un comentario que lo explica, porque
`generate-uxdsl-entry.js` lo importa por nombre. Además, cuatro declaraciones comentadas sueltas
(`layout`, `page` ×2, `DemoSpacing`); donde había un motivo, queda el motivo sin el código.

**Cambio visual declarado (uno):** el borde de los `input` de los diálogos de Density y Space,
`#ccc` → `color(gray-300)` `#CBD5E1`. Son `input` estilados a mano; pasarlos a `@ds-input` es
de la Fase D.

**Evidencia.** Build de la rebanada 3 contra esta, 28 rutas × 10 anchos + los 3 diálogos
abiertos, claro y oscuro: **48 diferencias en claro y 48 en oscuro, todas el borde declarado**
(6 `input` × 4 lados × 2 anchos); cero en cualquier otra propiedad, incluidos la portada, las
páginas de paleta, `/docs/config`, `quick-start` y los tres diálogos. Después se fusionaron los
bloques añadidos con el `#Id {` que ya abría cada archivo (para no duplicar el selector) y se
volvió a medir en las 8 rutas afectadas: 0 diferencias con la medición anterior.

**Comandos:** `npm test` → exit 0 (ratchet: `inlineStyleObjects` 50, `hexColorsInTsx` 27,
`hexColorsInUxdsl` 17; matriz regenerada); `npm run verify:doc-examples` → exit 0; `node
scripts/generate-language-artifacts.js --check` → exit 0; la build de producción (`next build`,
con su comprobación de tipos) pasó en cada snapshot `--build` y en el pre-commit.

**Límites.** No se midieron estados (`:hover`, `.is-invalid` del editor JSON, el botón del tema
*custom*), ni `error.tsx`. `stylelint` en los archivos tocados: 192 → 204 problemas; los nuevos
son la convención del repo de IDs en PascalCase (`#AppHeader`, `#WelcomePage`… contra
`selector-id-pattern`) y el `var(--uxdsl__font__code)` que no tiene función; los seis `.uxdsl`
nuevos pasan salvo ese.

**Hallazgos de esta rebanada:**
- **Más componentes sin uso**: `ButtonDemo.tsx` y `HomeDemo.tsx` tampoco se importan (se suman a
  `DensityPlayground`, `DemoTypography` y, por arrastre, `EditTypographyDialog`).
- **La página `/theming` miente**: dice que los *overrides* viven en `theme-def.uxdsl` y que se
  cambian con `--primary-main`; eso es el código comentado que se acaba de retirar. Contenido para la
  Fase D.
- **`theme-def.uxdsl` no podía hacer lo que prometía** (un `:root` del autor pierde contra el
  `:root` del tema generado, que va después). Es la precedencia documentada (el tema JSON manda),
  no un bug del motor; si se quisiera JetBrains Mono, va en `fonts.families.code` del JSON.

**Lo que queda de la Fase B.** `scripts/audit-themes.mjs` (reimplementa parseo responsivo, `px` y
luminancia en vez de usar el motor): no se tocó en estas rebanadas. Por eso el criterio de la
Fase B sigue sin marcar: los candidatos del playground están clasificados, pero ese script no.

### Fase B, rebanada 5 — `audit-themes.mjs` sobre el motor, componentes muertos, `/theming`, círculo *default* (2026-09-28)

Rama `feat/mig-b7-17c-capabilities` (apilada sobre `feat/mig-b7-17b2-dogfooding`); SHA fijado al mergear.

**`scripts/audit-themes.mjs` usa el motor compartido.** Se retiraron sus parsers propios
(`parseResponsive`/`resolveResponsive`, `parsePx` con su `calc()`, `hexToRgb`, `srgbToLin`/`relLuminance`/
`contrastRatio`, `deepMerge`) y los 11 pares `main`/`contrast` que comprobaba. Ahora:

- **Contraste:** `checkThemeContrast(resolveTheme(theme), { exceptions })` con las excepciones
  empaquetadas — la misma llamada que `uxdsl theme --contrast` — por cada tema con nombre, con el
  resumen por modo/familia/par. **Es el veredicto**: el script sale con 1 mientras el gate falle,
  como el CLI. Hoy: `default` 123, `green` 142, `purple` 123, `slate` 124 → 512 pares, **exit 1**
  (antes decía `PASSED` y salía con 0). Es el "se volvería FAIL con los fallos conocidos" que
  anotó MIG-B7-09: se acepta, porque es la verdad. Además deja ver algo que antes no se veía:
  la excepción empaquetada `surface-outlined-light-tone-base-text-light-mode` queda **obsoleta** en
  `green` y `slate` (sus colores resueltos ya no aparecen), lo que el gate cuenta como fallo.
- **Tipografía:** `resolveTypographyRole` (los campos del rol sobre `default`, igual que emite
  `@ds-typo`) y `resolveResponsiveValue` (el valor de cada breakpoint, con persistencia). Sólo se
  comparan tamaños que resuelven a `space(n)` o a `px`/`rem` literales; lo demás se informa como
  "no comparable" en vez de adivinarse. Resultado igual al anterior: sin avisos en los cuatro temas.
- `test-audit-themes.cjs` (4 tests): parsea; audita los 4 temas desde el paquete y desde la raíz con
  exit 1 y el total igual al de `checkThemeContrast`; el recuento por tema coincide; y el script no
  vuelve a definir un parser propio (y sigue llamando a las cuatro funciones del motor).
  **Controles negativos** ejecutados: forzar `exitCode = 0` hace fallar el segundo test; añadir un
  `function relLuminance` hace fallar el cuarto.

**Componentes muertos retirados** (búsqueda de importaciones estáticas, `import()` y `.mdx` desde
cada `page`/`layout`/`error`/`not-found`/`mdx-components`, con un grafo de alcanzabilidad):
`ButtonDemo`, `DemoTypography`, `DensityPlayground`, `HomeDemo` (con sus `.uxdsl`) y, además de los que
listaba la rebanada 4, **`CardDemo`** (+ `.uxdsl`) y **`HomeTypographyDemo`**, que el grafo encontró
también inalcanzables; y el `src/uxdsl-entry.uxdsl` suelto (una salida vieja de `generate-entry` que
nada compila: la entrada real es `src/app/uxdsl-entry.uxdsl`). **`EditTypographyDialog`** estaba
importado (por `TypographyInteractivePlayground`, que sí se usa en la portada y `/typography`), pero
sólo se montaba con un `editingTag` que únicamente ponía `DemoTypography`: inalcanzable en ejecución.
Se retiró junto con su montaje; el hallazgo de la rebanada 2 ("sólo lo abre `DemoTypography`") era
correcto en efecto, no en el grafo.

**Una regla compartida escondida en código muerto.** La comparación detectó que
`DensityPlayground.uxdsl` (global, sin `#id`) daba `font-weight: 600` a `.json-key`, que usa el editor de
`ResponsiveSyntaxExplainer`: al retirarlo, 320 diferencias `fontWeight 600 → 400` en `/` y `/typography`.
La regla se movió a su único consumidor (`ResponsiveSyntaxExplainer.uxdsl`) y volvió a medirse: 0.

**`/theming`** dejaba de ser cierta (mandaba a `theme-def.uxdsl` y `--primary-main`, código muerto
retirado en la rebanada 4). Ahora describe lo que existe: base empaquetada + un override por tema
fusionados con `deepMergeTheme` en `themes.js`, `uxdsl build` con `uxdsl.config.cjs`, y `applyTheme`
para cambiar de tema sin recompilar. **Cambio de contenido declarado.**

**Cambio visual declarado:** el círculo *default* de `PageToolbar` pasa de `color(slate-800)` (el
primario de *slate*) a `color(purple-600)` = `#7e22ce`, el primario real del tema *default* — el mismo que
ya usa el botón *default* de `AppHeader`. Consecuencia honesta: los círculos *default* y *purple* de la
barra son ahora del mismo color, porque el override *purple* no cambia el primario de la base.

**Evidencia** (arnés de la rebanada 1, build de la rebanada 4 contra esta, 28 rutas × 10 anchos + 3
diálogos, claro y oscuro): **1,248 diferencias en claro y 1,248 en oscuro**: 276 son el círculo
declarado (27 rutas × 10 anchos + 3 diálogos × 2; el de `/theming` cuenta dentro de su página) y 972
están en `/theming` (866 cajas, 90 elementos nuevos, 10 del círculo y 6 `top`/`bottom` del texto nuevo).
Ninguna en otra ruta ni propiedad.

**Métricas del ratchet:** `hexColorsInUxdsl` 17 → **12**, `rgbHslInUxdsl` 2 → **1**,
`inlineStyleObjects` 50 → **28** (los 22 de componentes inalcanzables de la rebanada 4 se fueron con
ellos). Y una brecha **nueva, registrada a propósito**: `cli-flag:--out` — `HomeDemo`, código muerto,
era el único sitio que nombraba `--out`; la cierra la página del CLI de la Fase C.

### Fase C — las 37 brechas cerradas llamando a la API real (2026-09-28)

Rama `feat/mig-b7-17c-capabilities`, SHA fijado al mergear. **`knownGaps` vacío: 113 capacidades, 113
mostradas al nivel que exigen, 0 brechas** (`docs/architecture/playground-capability-matrix.md`
regenerada; `node --test scripts/capability-matrix.test.js` 7/7). La brecha `cli-flag:--out` que abrió
la rebanada 5 también se cerró (38 en total).

**Cuatro páginas nuevas en `/docs` (con entrada en el menú lateral y en `sitemap.ts`):**

| Página | Qué ejecuta de verdad |
| --- | --- |
| `/docs/runtime` | Lectura del sitio: `getAppliedTheme`, `subscribeTheme`, `getPalette` sobre lo que aplicó `ThemeContext` (no cambian nada). **Sandbox**: un `iframe` (`public/runtime-sandbox/`, generado por `scripts/build-runtime-sandbox.js` en `uxdsl:build`) con su propio documento y **su propio realm** — la hoja se compila con `uxdsl-core` y el tema por defecto del sitio; el script (`src/runtime-sandbox/sandbox-entry.ts`) se empaqueta con esbuild y expone las funciones reales. Ahí corren los 15 pasos que cambian estado: `loadPersistedTheme` antes de iniciar (`UXD_THEME_NOT_INITIALIZED`), `applyTheme` de inicio, con `persist`, un umbral movido (`UXD_THEME_STRUCTURE`), `resetTheme`, `loadPersistedTheme`, `getAppliedTheme`, `resetTheme({ clearPersist })`; y los setters `updatePalette`/`getPalette`/`resetPalette`/`updateColor`/`updateSpacing`/`updateBreakpoint` con `subscribe`. Cada paso muestra el valor devuelto, lo que oyeron las suscripciones y lo que mide el sandbox después (variable calculada, muestras, `padding`, `flex-direction`, `md` legacy vs aplicado). Recargar el iframe lo deshace todo. Puras, sobre el tema activo: `resolveTheme` + `getDefaultTheme` (un override editable, con qué hoja viene de dónde), `buttonDeclarations`/`inputDeclarations`/`resolveTypographyRole` (lo que emite cada directiva, por rol y tono), `googleFontsImportUrls` (y si la hoja del tema de la página importa exactamente esa URL) y `encodeGoogleFontFamily` |
| `/docs/contrast` | `checkThemeContrast(resolveTheme(tema activo), { exceptions })` con las excepciones empaquetadas — la llamada de `uxdsl theme --contrast` —; se recalcula al cambiar de tema; resumen, grupos y cada par que falla, filtrable por modo |
| `/docs/cli` | Salida real del CLI (stdout, stderr, exit) sobre `capability-fixtures/cli-project`: `generate-entry --src --out --exclude`, `build`, `--config`, `--entry --out`, `--include-theme`/`--no-include-theme`, `--sourcemap` (con el `.map`), `--strict-theme` (falla) y `--strict-theme=breakpoints` (pasa), `theme`, `theme --diff`, `theme --strict`, `--strict=breakpoints`, `theme --contrast`, y una sesión de `uxdsl watch` (arranque, edición, error `UXD_BREAKPOINT_UNKNOWN`, recuperación) |
| `/docs/diagnostics` | 12 `UXD_*` reales impresos por `uxdsl build` sobre fuentes y temas rotos (`UXD_BREAKPOINT_UNKNOWN`, `_SHADOW_REFERENCE`, `_EDGE_REFERENCE`, `_DENSITY_REFERENCE`, `_TYPO_REFERENCE`, `_SURFACE_REFERENCE`, `_DIRECTIVE_CONTEXT`, `_DIRECTIVE_UNKNOWN`, `_TOKEN_ALPHA`, `_TYPO_BP`, `_TYPO_FIELD`, `_REFERENCE_MISSING`); y los alias `elevation()`/`rounded()` compilados contra `shadow()`/`radius()` y **medidos en la página** (estilo calculado idéntico) |

**Salida capturada que no puede quedarse vieja.** `packages/playground-nextjs/scripts/capture-capabilities.js`
ejecuta el CLI real (con el `postcss-uxdsl` local) sobre una copia del proyecto de ejemplo y escribe
`src/generated/cli-captures.json` y `compiler-captures.json` (rutas normalizadas a `<project>`; nada
depende de hora ni máquina). Cada caso de diagnóstico declara el código que debe producir y la captura
**falla** si produce otro. `npm test` lo ejecuta con `--check` (script `test:captures` del playground):
si el CLI o el compilador cambian lo que imprimen, el test falla hasta regenerar. Probado: dos
`--check` seguidos sin cambios → 0; la sesión de `watch` es determinista (espera líneas concretas, no
tiempos).

**Dónde se demuestra cada brecha y a qué nivel** (el detector lo confirma; los dos `manual` son punteros
comprobados):

| Brechas | Dónde | Nivel |
| --- | --- | --- |
| `function:elevation`, `function:rounded`, `breakpoint-function:xl` | `CapabilityDocs.uxdsl` (hoja de las cuatro páginas: cajas de alias medidas, marco del sandbox; `xl()` en la rejilla del resumen de contraste) | live |
| 19 de runtime (`checkThemeContrast`, `resolveTheme`, `getDefaultTheme`, `getAppliedTheme`, `subscribeTheme`, `getPalette`, `resetTheme`, `loadPersistedTheme`, `updatePalette`, `resetPalette`, `updateColor`, `updateSpacing`, `updateBreakpoint`, `subscribe`, `buttonDeclarations`, `inputDeclarations`, `resolveTypographyRole`, `googleFontsImportUrls`, `encodeGoogleFontFamily`) | `ContrastReport.tsx`, `RuntimeEngines.tsx`, `RuntimeLab.tsx`, `src/runtime-sandbox/sandbox-entry.ts` | live (importación nombrada y llamada ejecutada) |
| `cli-flag:--contrast` | `ContrastReport.tsx` (mismo motor) + salida real en `/docs/cli` | live |
| `cli-command:theme`, `cli-command:watch`, 10 flags (`--config`, `--diff`, `--entry`, `--exclude`, `--include-theme`, `--out`, `--sourcemap`, `--src`, `--strict`, `--strict-theme`) | `/docs/cli` (prosa + salida capturada) | documented (lo que exige el detector para flags sin equivalente de runtime); la salida es real |
| `package-export:./config` | `uxdsl.config.cjs` del propio playground usa `defineConfig` de `postcss-uxdsl/config` (antes objeto plano) | live |
| `package-export:./schema/theme.schema.json` | **manual**: `uxdsl.theme.{green,purple,slate}.json` declaran `"$schema"` apuntando al esquema empaquetado; `test-theme-inheritance.cjs` resuelve el export y comprueba cada puntero y que las claves de primer nivel estén en el esquema (control negativo: un puntero roto falla) | live (manual) |
| `diagnostics:UXD_* error codes` | **manual**: `src/generated/compiler-captures.json` (capturado y comprobado) + `UXD_THEME_*` en vivo en el sandbox | live (manual) |

**Corrección del detector (no se relajó):** `scripts/lib/capabilities.js` listaba `uxdsl.config.cjs` pero
sólo leía `.ts/.tsx/.js/.jsx`, así que nunca lo leía; ahora lee `.cjs/.mjs`. Y deja de contar como código
el JSON capturado de `src/generated/` (citaba el `require('postcss-uxdsl/config')` del proyecto de
ejemplo, un falso positivo que habría "cerrado" `./config` sin que el playground lo usara).

**Ratchet:** `hexColorsInTsx` 27 → **32, subida deliberada**: cinco literales son los valores que los
pasos del laboratorio pasan al runtime (`#0f766e`, `#e11d48`, `#1d4ed8`, `#fde68a` y el del override de
ejemplo) — datos de tema, no estilo de la página; se declararon una vez como constantes para no contar
cada uno dos veces. `inlineStyleObjects` no sube (el laboratorio no usa `style={{}}`).

**Setters antiguos y `applyTheme`: el conflicto se enseña, no se esconde.** Llamados en la página
competirían con `ThemeContext` (`resetTheme` devolvería el tema de inicio a sus espaldas;
`updateBreakpoint` notifica al adaptador `BreakpointsProvider`, que lo reenvía a `setCustomTheme` y
`applyTheme` lo rechaza). Por eso van al sandbox, donde se ven tal cual: tras `updatePalette`, un
`applyTheme` posterior devuelve `ok: true` y el color **no cambia** (el valor en línea gana; es lo que
`clearRuntimeInlineTokens` de `ThemeContext` corrige); tras `updateBreakpoint('md', 900)`,
`getBreakpoints().md` = 900 y `getAppliedTheme().breakpoints.md` = 768, y a 820px el layout compilado ya
está por debajo de `md` mientras Density sigue en su valor de `md`. `loadPersistedTheme` se llama siempre
con la clave del laboratorio y `migrateLegacy: false`: por defecto migraría **y borraría** las cuatro
claves legacy que las demos antiguas del playground (`DemoColors`, `DemoSpacing`, `DemoPaletteConfig`,
`DemoBreakpoints`) todavía escriben con `persist: true`.

**Hallazgos del motor/CLI (registrados, no arreglados aquí; candidatos a historia propia):**

1. **`updateBreakpoint` no reescribe la hoja que gestiona `applyTheme`.** Repro (en el sandbox, 820px):
   `applyTheme(project, { replace: true })` → `updateBreakpoint('md', 900)` → `.lab-layout` pasa a
   `column` (hoja compilada `style[data-uxdsl]`, reescrita) pero `density(4)` sigue valiendo lo de `md`
   (la hoja del tema lleva `data-uxdsl-theme`, que `allUxdslStyleTags()` no selecciona). Dos verdades
   sobre el mismo umbral. Es el API legacy; el nuevo lo rechaza por diseño.
2. **Un `palette` con una referencia inexistente produce ~20 `UXD_REFERENCE_MISSING` en cascada**
   (cada variable de Button/Input que depende de ella), visible en `/docs/diagnostics`. Correcto pero
   ruidoso: la causa es una.
3. **Un breakpoint negativo en el tema se informa como `UXD_TYPO_BP`** ("Typography requires distinct
   non-negative breakpoint widths…"): lo valida primero el motor de tipografía, no `validateBreakpoints`
   (`UXD_BP_INVALID`). El mensaje nombra la tipografía para un error del mapa de breakpoints.
4. **`$schema` aparece como hoja `project` en `uxdsl theme --diff`** (y en la lista de familias de
   `uxdsl theme`): es metadato, no un valor del tema.
5. (Del script de auditoría, rebanada 5) la excepción empaquetada
   `surface-outlined-light-tone-base-text-light-mode` está obsoleta para `green` y `slate`.

**Sin cambio visual involuntario en las páginas existentes** (arnés de *snapshot*, build de la rebanada 5
contra esta, 28 rutas existentes × 10 anchos + 3 diálogos): **1,786 diferencias en claro y 1,786 en oscuro**, todas
declaradas — 1,530 son el menú lateral de las 15 páginas `/docs/*` existentes (102 cada una: los cuatro
enlaces nuevos, `li`/`a` presentes, y la caja y `gridTemplateRows` del `nav` que crece) y 256 son
`/theming` (la frase nueva que enlaza la página Runtime). Ninguna en otra ruta ni propiedad. El `$schema`
de los overrides y `defineConfig` no cambian nada visible (el tema efectivo lleva `$schema`, que
`applyTheme` y `generateThemeCss` ignoran).

**Límites.** Los flags del CLI quedan en "documented" porque así lo exige el detector para opciones sin
equivalente de runtime, aunque lo que se muestra es su salida real. `--sourcemap=inline` y `init` no se
capturan (no eran brechas). El sandbox reproduce un proyecto compilado, no esta aplicación: lo que
demuestra de `updateBreakpoint` vale para cualquier hoja etiquetada, pero el adaptador de breakpoints del
propio sitio (`/docs/breakpoints`) no se recorrió con el ratón.

### Fase E — el playground conducido en Chrome real (2026-09-28)

Rama `feat/mig-b7-17c-capabilities`, SHA fijado al mergear. **Cierra el límite 6 de beta.6** ("the
playground app itself was not driven in a browser").

**Qué se construyó.** `fixtures/playground-browser/walk.js` (raíz: `npm run verify:playground-browser`,
que construye y recorre). Sirve la build de producción (`next start`) y, para **cada ruta que la app
tiene** (leídas de su árbol de archivos: las 4 nuevas entran solas), en **claro y oscuro**
(`prefers-color-scheme`) y a **10 anchos** (390, 479, 480, 767, 768, 1023, 1024, 1279, 1280, 1440 — a
ambos lados de cada umbral, 767/768 y 1023/1024 incluidos):

- ningún error de consola ni excepción no capturada;
- ningún aviso de UXDSL en consola (`warning` que mencione `uxdsl`/`UXD_`);
- **ningún `var()` sin resolver**: por cada regla aplicable (con sus `@media`/`@supports` que casan) que
  lee una custom property sin *fallback*, se comprueba en el **estilo calculado** de los elementos que
  casan que la propiedad resuelve (una cadena rota `--a: var(--b)` también se detecta, porque `--a`
  calcula vacío);
- **foco visible** (a 390 y 1280): `Tab` hasta dar la vuelta; cada elemento que recibe el foco debe casar
  `:focus-visible` y **verse distinto** que sin foco (contorno dibujado, sombra, color de borde o de fondo,
  subrayado — comparando el mismo elemento enfocado y desenfocado);
- **`/docs/contrast` = Node**: el resumen y la lista ordenada de pares que fallan que pinta la página son
  los de `checkThemeContrast(resolveTheme(themes[name]), { exceptions })` en Node, para el tema *default* y
  otra vez **tras cambiar a *green*** con el botón de la cabecera.

**Resultado final: PASS.** 32 rutas × 2 esquemas × 10 anchos = **640 páginas cargadas**, **3,029 elementos
enfocables** comprobados; contraste página = Node para *default* (824 pares, 123 fallan) y *green* (737,
142), en claro y en oscuro. Única exención, por ruta exacta y listada en la salida (2,572 mensajes): los
dos scripts de Vercel (`/_vercel/insights/script.js`, `/_vercel/speed-insights/script.js`) responden 404
fuera del hosting de Vercel; las peticiones externas (fuentes) se contestan en local, como en `snapshot.js`.

**Fallos encontrados y cómo se resolvieron.** La primera pasada (28 rutas existentes, 390 y 1280, claro y
oscuro) dio **44 fallos, todos de foco invisible**, en tres causas — sin errores de consola, sin `var()`
sin resolver, sin avisos:

| Causa | Dónde | Arreglo (cambio visual declarado, sólo en estado de foco de teclado) |
| --- | --- | --- |
| La regla global `input[type="range"]` quitaba el contorno (`outline: none`) | todos los sliders: `/`, `/densities`, `/docs/breakpoints`, `/docs/densities`, `/productivity`, `/docs/productivity`, `/spacing`, `/docs/spacing` | `input[type="range"]:focus-visible { outline: 2px solid palette(primary-main); outline-offset: 4px; }` en `app.uxdsl` |
| `.ai-input` con `outline: none` | `/` (el prompt de IA) | `&:focus-visible` con el mismo anillo en `AIPrompt.uxdsl` |
| Las muestras editables (`contentEditable`) con `outline: none` | `/typography`, `/docs/typography` | `.editable-typography-element:focus-visible { outline: 2px dashed palette(primary-main); … }` en `ResponsiveSyntaxExplainer.uxdsl` |

Tras el arreglo, el recorrido completo pasa. El arnés de *snapshot* (sin foco) no ve estos estados, así
que no cambian su comparación.

**Controles negativos** (el propio `walk.js` los ejecuta al final y falla si alguno no se detecta):
un `var(--uxdsl__palette__does-not-exist)` inyectado → `unresolved-var`; un `console.error` inyectado →
`console-error`; un estilo que quita todo indicador de foco → `focus-invisible` (en `/docs/runtime`, el
botón *green* de la cabecera); la comparación de contraste contra el tema equivocado (*slate*) →
`contrast-mismatch`. **Los cuatro, detectados.**

**Límites.** Sin estados `:hover` ni puntero, sin táctil, sin lector de pantalla, sin píxeles; el orden
del foco se comprueba en visibilidad, no en si es el orden correcto. Los dos scripts de Vercel se eximen
(no se prueba el hosting). No se abren diálogos ni se usan editores (el de breakpoints, el JSON de
`/docs/config`, los pasos del sandbox): los pasos del sandbox se ejercitaron en Chrome aparte, a mano con
un script, y dieron los resultados que describe la Fase C, pero el recorrido no los repite. Sólo Chrome.

### Tabla de revisión por componente/ruta (Fase D)

Pendiente. Una fila por ítem: tokens · responsive · estados · oscuro · contraste ·
semántica · nombres antiguos · ejemplo = prueba viva · notas.
