# MIG-B6-25 — Validación de referencias en tiempo casi lineal

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | E — Rendimiento |
| Prioridad · Tamaño | P1 · M |
| Cierra | UX-10 |
| Depende de | MIG-B6-13 (forma de `ReferenceIssue` y mensajes) |
| Bloquea | MIG-B6-12 |
| Archivos | `packages/postcss-uxdsl/src/reference-integrity.ts` (`inspectReferences`, ~53-130), nuevo `scripts/bench-references.js`, `packages/postcss-uxdsl/test/`, `package.json` raíz |
| Coordinación | Después de MIG-B6-13 en `reference-integrity.ts`. No cambia la forma de `ReferenceIssue` ni los mensajes |

## Por qué

La validación de referencias, que es estricta por defecto y es una de las fortalezas
de UXDSL, crece de forma cuadrática. En un módulo grande hace inutilizable el modo
watch.

## Reproducción

Se toma este bloque sintético y se repite N veces:

```css
.card-N {
  padding: density(2);
  margin: xs(space(1)) md(space(2)) lg(space(3));
  color: palette(primary);
  background: palette(surface);
  border-radius: radius(2);
  gap: xs(0.5rem) md(1rem);
  &:hover { color: palette(primary.dark); }
  .title-N { @ds-typo(h3); margin: 0; }
  @ds-surface(outlined primary);
}
```

Tiempos medidos el 2026-09-18 con `includeTheme: true`, comparando
`references: { mode: 'error' }` contra `mode: 'off'`:

| Líneas | Con referencias | Sin referencias |
| --- | --- | --- |
| 3.000 | 762 ms | 73 ms |
| 6.000 | 2.015 ms | 107 ms |
| 12.000 | 13.700 ms | 180 ms |
| 24.000 | **54.977 ms** | 358 ms |

## Causa

En `inspectReferences`, por **cada consumidor** se calculan los contextos candidatos
recorriendo **todas** las entradas (`entries.map(...).filter(...)`), lo que da
O(consumidores × entradas). Además, `resolve()` filtra y ordena linealmente
`definitions.get(name)` en cada llamada, y `checkValue` vuelve a analizar el mismo
valor en cada contexto.

## Resultado esperado

Con referencias activas, 24.000 líneas compilan en **menos de 2 s** en la máquina de
referencia, y el tiempo crece de forma casi lineal. Los `issues` son idénticos a los
de la implementación actual.

## Implementación

1. **Oráculo primero:** copiar la implementación actual compilada a
   `test/fixtures/reference-integrity-oracle.js` (sólo para tests, durante este
   release).
2. Indexar una sola vez:
   - las entradas por selector;
   - las definiciones por nombre de propiedad, ya ordenadas por la regla de `resolve`;
   - los contextos distintos por selector.
3. Indexar candidatos por selector y filtrar por las **condiciones del consumidor**.
   Dos declaraciones del mismo selector bajo medias distintas no comparten siempre
   los mismos contextos. Preservar el orden de visita original y los scopes :root
   de modo oscuro; no ordenar condiciones si cambia su identidad.
4. Memoizar `resolve(name, contextKey)` y el parseo de valores durante una pasada.
   `checkValue` actual también depende de `chain` y `stack`: no cachear sus arrays
   de errores sólo por valor/contexto. Separar resolución independiente del camino
   y reconstrucción de diagnósticos por consumidor, o conservar la recursión hasta
   demostrar equivalencia para ciclos y fallbacks. No compartir cachés entre builds.
5. No cambiar la semántica: `conditionsApply`, el orden por `!important`/selector/orden
   y el manejo de fallbacks y ciclos quedan igual.

## Fuera de alcance

- Cambiar qué se considera error.
- Paralelizar.

## Pruebas

- Oráculo fijado al commit posterior a 13, con procedencia y hash; el runner
  compara sin regenerarlo automáticamente. Mismo selector en medias y modos
  distintos, ciclos compartidos vistos desde dos consumidores, fallbacks anidados,
  `!important`, proveedores externos y compilaciones sucesivas con temas distintos.
- Benchmark con warmup y muestras secuenciales aisladas del runner paralelo;
  registrar Node, OS, CPU, commit, entrada y medianas. El umbral absoluto usa la
  máquina declarada; la razón usa tamaños suficientemente grandes y tiempos crudos
  adjuntos. No atribuir ruido de CI a mejora ni relajar el presupuesto sin evidencia.

- **Equivalencia:** sobre todos los casos de `test/reference-integrity.test.js`, las
  fixtures del repositorio y el bloque sintético (N = 50, con errores inyectados:
  tokens inexistentes y ciclos), la implementación nueva y el oráculo producen los
  mismos `issues`, en el mismo orden.
- **Escalado en CI** (`test/reference-performance.test.js`): mediana de 3 corridas.
  `tiempo(2N) / tiempo(N) ≤ 2.5` con N = 500 bloques. Es una razón, no un tiempo
  absoluto, para no depender de la máquina.
- `scripts/bench-references.js` (`npm run bench:references`) imprime la tabla de
  arriba. El PR registra antes y después.

## Documentación

- CHANGELOG beta.6, con la tabla antes/después.
- `docs/architecture/unified-engine-audit.md`: una nota sobre la complejidad esperada
  de la validación, si el documento describe el motor de referencias.

## Criterios de aceptación

- [x] 24.000 líneas en menos de 2 s con referencias activas (hoy tardan 55 s),
      registrado en el PR con la máquina usada. → **786 ms** (Apple M1 Pro,
      Node v20.19.0, macOS 25.2.0, mediana de 3 tras warmup), frente a
      **63.308 ms** de la implementación anterior en la misma máquina y con el
      mismo comando.
- [x] La equivalencia con el oráculo es exacta.
      → `packages/postcss-uxdsl/test/reference-integrity-equivalence.test.js`,
      10 tests, 39 entradas comparadas, 263 issues coincidentes uno a uno,
      0 diferencias.
- [x] El test de escalado pasa en CI.
      → `packages/postcss-uxdsl/test/reference-performance.test.js`, incluido en
      `npm --prefix packages/postcss-uxdsl test` y por tanto en `npm test`.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm run bench:references
npm test
```

## Entrega

`perf(FEAT-008): MIG-B6-25 - near-linear reference validation, equivalent to the previous implementation`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente** en
`feat/feat-008-beta6-plan`. Integración a `main` pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `511da96` (2026-09-22, HEAD de la rama al iniciar). Entrega: commit siguiente en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | `npm run bench:references` sobre `511da96`, en esta máquina y con la mediana de 3 muestras: 3.000 líneas 813 ms, 6.000 → 1.867 ms, 12.000 → 11.813 ms, 24.000 → **63.308 ms**, contra 79/193/296/1.012 ms con `references: { mode: 'off' }`. Duplicar la entrada multiplicaba el tiempo por 2,30 / 6,33 / 5,36: crecimiento claramente superlineal, y el 98 % del tiempo era la validación. La medición aislada de `inspectReferences` sobre un root ya compilado (500 → 1.000 bloques, 11.245 → 21.745 consumidores) daba 1.708 ms → 11.457 ms, **x6,71**, muy por encima del presupuesto de 2,5 de esta ficha. 2026-09-22 |
| Criterio → regresión | Equivalencia → `packages/postcss-uxdsl/test/reference-integrity-equivalence.test.js`: cada caso ejecuta la implementación nueva y el oráculo congelado sobre la *misma* entrada y compara los arrays de issues elemento a elemento, en orden. Cubre los 6 casos de `reference-integrity.test.js`, medias/modos/selectores repetidos, ámbitos `:root` de modo oscuro, anchos min-width iguales escritos distinto, ciclos compartidos por dos consumidores, ciclo alcanzado a través de un fallback, fallbacks anidados, `!important`, proveedores externos declarados y retirados, el bloque sintético N=50 con tokens inexistentes y ciclos inyectados, las 5 entradas `.uxdsl` de `fixtures/mig07-consumer/entries/` compiladas de verdad por el plugin, y tres compilaciones sucesivas con temas distintos. El hash SHA-256 del oráculo está fijado en el propio test, así que regenerar la fixture para que una discrepancia desaparezca falla primero ahí. Escalado → `packages/postcss-uxdsl/test/reference-performance.test.js`: razón `tiempo(2N)/tiempo(N) <= 2,5` con N = 500 bloques, mediana de 3, midiendo sólo `inspectReferences` sobre un root que produjo el compilador. Umbral absoluto → `npm run bench:references` (no es un test: imprime la curva junto a la máquina que la produjo) |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, Apple M1 Pro, desde el root del monorepo: `npm --prefix packages/postcss-uxdsl test` (exit 0, **321/321**, +11), `npm run bench:references` (exit 0), `npm test` (exit 0, **610** líneas `ok`, antes 599) |
| Resultado después / control negativo | Después: 3.000 líneas 119 ms, 6.000 → 204 ms, 12.000 → 410 ms, 24.000 → **786 ms** (−98,8 % frente a 63.308 ms; 80x). Duplicar la entrada cuesta ahora x1,72 / x2,01 / x1,92, esencialmente la misma curva que con la validación apagada (x1,88 / x2,05 / x1,94): la validación dejó de ser el término dominante. Aislada, `inspectReferences` pasa de 61,7 ms a 109,7 ms al duplicar (**x1,78**). **Control negativo del test de escalado**: el mismo procedimiento sobre el oráculo congelado da x6,71 y falla el presupuesto, así que el test distingue de verdad las dos implementaciones. **Control negativo de la equivalencia (mutación)**: se introdujeron 8 cambios semánticos uno a uno en la implementación nueva, recompilando cada vez. Seis los detectó la suite (quitar el ámbito `:root` de los modos, `>=` → `>` en min-width, cachear `resolve` sin el contexto, perder el texto del fallback, cachear la lista de contextos por selector en vez de por contexto completo, deduplicar contextos distintos sólo por selector, y cachear el contexto por propiedad en vez de por nodo). Los dos que no se detectan no son huecos: quitar el término `!important` del comparador no cambia nada porque es **código muerto demostrable** (PostCSS deja `decl.important` en `true` o `undefined`, y `Number(a)-Number(b)` sale NaN o 0 en las cuatro combinaciones posibles, siempre falsy), y quitar la deduplicación de contextos sólo duplica trabajo que el `Map` posterior vuelve a deduplicar. Las tres primeras versiones de la suite **sí pasaban** con mutaciones aplicadas; los casos que faltaban se añadieron y están marcados como tales en el test |
| Cambios visuales o API / migración | Ninguno, y es el punto de la historia: misma API pública, mismos issues, mismo orden, mismos mensajes, misma deduplicación, mismas ubicaciones. No hay nada que migrar. Cambio interno: `conditionsApply` acepta un lector memoizado de min-width como tercer parámetro con default, para no duplicar su lógica |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/CHANGELOG.md` (entrada MIG-B6-25 con la tabla antes/después y la máquina); `packages/postcss-uxdsl/README.md`, sección "Reference integrity (`references`)": nota de coste, con la invitación explícita a volver a activar la validación a quien la había apagado para poder usar watch. `docs/migration.md` sin cambios: no cambia ningún contrato |
| AGENTS / guías / arquitectura | `docs/architecture/unified-engine-audit.md`, sección "Explicit limits and follow-up scope": qué complejidad se espera de la validación, por qué sigue inspeccionando cada consumidor en cada contexto alcanzable, y que sus índices son por pasada y no una caché global entre builds. `AGENTS.md` sin cambio de contrato: la regla que ya recoge ("No token family should depend on a process-global compile cache") es precisamente la que esta implementación respeta |
| Límites y seguimiento | (1) **El oráculo es de alcance de release**: `packages/postcss-uxdsl/test/fixtures/reference-integrity-oracle.js` es una copia compilada de la implementación anterior y debe borrarse al publicar 0.5.0-beta.6, como dice el paso 1 de esta ficha. Su cabecera lo indica. (2) **El test de escalado mide tiempo**, con la fragilidad que eso implica en CI; se mitiga con una razón en vez de un presupuesto absoluto, mediana de 3, warmup de ambos tamaños y un margen de 2,5 frente al x1,78 medido — pero no es inmune a un runner muy cargado. (3) **Los números absolutos son de esta máquina**: un Apple M1 Pro. El criterio de "menos de 2 s" se declara sobre ella, como pide la ficha, no como promesa universal. (4) **Hallazgo abierto, fuera de alcance**: el término `!important` del comparador de `resolve` es código muerto (ver control negativo). Arreglarlo *cambiaría* qué definición gana cuando una declaración `!important` precede a otra normal, que es exactamente el tipo de cambio semántico que esta historia excluye. Queda pinchado por un caso de la suite de equivalencia ("important declared before a plain override") que fija el comportamiento actual, para que un arreglo futuro sea una decisión consciente y no un efecto colateral. (5) **Sin paralelizar y sin cambiar qué se considera error**, como pide "Fuera de alcance". (6) **Sin verificación en navegador**: no aplica, es un motor Node/browser-safe sin salida visual; el test que impide reintroducir APIs de Node sigue pasando |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
