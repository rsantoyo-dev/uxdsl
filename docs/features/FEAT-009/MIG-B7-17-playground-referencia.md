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
muerto. **Regla dura: ningún cambio visual involuntario** — antes/después de cada
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

- [ ] La matriz capacidad → ejemplo se genera, cubre todas las capacidades
      derivadas, y un test la exige.
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

Estado de esta revisión documental: **Pendiente de implementación/verificación**.
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

### Tabla de revisión por componente/ruta (Fase D)

Pendiente. Una fila por ítem: tokens · responsive · estados · oscuro · contraste ·
semántica · nombres antiguos · ejemplo = prueba viva · notas.
