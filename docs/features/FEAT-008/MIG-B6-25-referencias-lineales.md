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
3. Calcular los contextos candidatos **por selector**, no por consumidor. Todos los
   consumidores de un selector comparten la lista.
4. Memoizar `resolve(name, contextKey)` y `checkValue(value, contextKey)` durante una
   pasada.
5. No cambiar la semántica: `conditionsApply`, el orden por `!important`/selector/orden
   y el manejo de fallbacks y ciclos quedan igual.

## Fuera de alcance

- Cambiar qué se considera error.
- Paralelizar.

## Pruebas

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

- [ ] 24.000 líneas en menos de 2 s con referencias activas (hoy tardan 55 s),
      registrado en el PR con la máquina usada.
- [ ] La equivalencia con el oráculo es exacta.
- [ ] El test de escalado pasa en CI.

## Verificación

```bash
npm --prefix packages/postcss-uxdsl test
npm run bench:references
npm test
```

## Entrega

`perf(FEAT-008): MIG-B6-25 - near-linear reference validation, equivalent to the previous implementation`
