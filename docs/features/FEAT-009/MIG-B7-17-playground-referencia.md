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
- [ ] Los candidatos de la Fase B están clasificados uno a uno; ninguna evasión
      de token queda sin sustituir o sin justificar.
- [ ] Cada capacidad ausente hoy tiene un ejemplo vivo que llama a la API real.
- [ ] Los 11 componentes de documentación y las 35 rutas tienen su fila revisada.
- [ ] Recorrido en Chrome real sin errores de consola, sin `var()` sin resolver ni
      avisos de UXDSL, en claro y oscuro y en los umbrales de breakpoint.
- [ ] Sin cambio visual involuntario, comprobado y registrado.

## Verificación

```bash
npm --prefix packages/playground-nextjs run build
npm --prefix packages/playground-nextjs run stylelint
npm --prefix packages/playground-nextjs run test:themes
UXDSL_CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node <smoke de la Fase E>
npm test
```

## Entrega

Por fases, una rama y un PR por fase: `feat(FEAT-009): MIG-B7-17 phase A - capability
matrix`, … cada una con su propio registro. La ficha cierra cuando la Fase E pasa.

## Registro de implementación y evidencia

Estado de esta revisión documental: **En curso — Fase A hecha (2026-09-24); Fase B, primera rebanada (`@media` → funciones responsivas) hecha; resto de B, C, D y E pendientes**.
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

### Tabla de revisión por componente/ruta (Fase D)

Pendiente. Una fila por ítem: tokens · responsive · estados · oscuro · contraste ·
semántica · nombres antiguos · ejemplo = prueba viva · notas.
