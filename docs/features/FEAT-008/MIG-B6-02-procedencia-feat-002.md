# MIG-B6-02 — Procedencia exacta de la validación de FEAT-002

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` (se conserva de FEAT-007) |
| Track | G — Release |
| Prioridad · Tamaño | P0 · S (sólo documentación y un test documental) |
| Cierra | La historia MIG-B6-02 de FEAT-007 |
| Depende de | — |
| Bloquea | MIG-B6-12 |
| Archivos | `docs/features/FEAT-002-beta-migration-hardening.md`, `fixtures/mig07-consumer/README.md`, `fixtures/mig02-nextjs-cssmodules/README.md`, `README.md` (raíz), `docs/releases/*.md` que atribuyan cobertura, nuevo `scripts/docs-provenance.test.js`, `package.json` raíz (script `test`) |

## Por qué

Cada afirmación de cobertura ("verificado en navegador", "probado con CSS Modules")
tiene que nombrar la fixture, el comando, qué verifica y qué no verifica (D1 de
FEAT-007). Hoy FEAT-002 le atribuye a MIG-07 cosas que MIG-07 no ejecuta, y el
README de la propia fixture dice lo contrario.

## Reproducción

```bash
grep -n "navegador\|Chrome" docs/features/FEAT-002-beta-migration-hardening.md
sed -n '50,59p' fixtures/mig07-consumer/README.md
```

Contradicciones actuales:

- `FEAT-002:32`: "La fixture integrada verifica las dependencias responsive en el
  navegador." Es ambiguo: no dice qué fixture.
- `FEAT-002:121`: el título "MIG-07 — Consumidor desde tarball y navegador" le
  atribuye navegador a MIG-07.
- `fixtures/mig07-consumer/README.md:50-59`: "No headless browser is available…";
  "does not run that loader". MIG-07 no abre Chrome ni ejecuta `css-loader`.
- La evidencia real de navegador es `fixtures/mig02-nextjs-cssmodules/browser.js`.
  `fixtures/mig02-nextjs-cssmodules/run.js` invoca primero a MIG-07 y después ejecuta
  `next build` (Next.js 14, Pages Router) con un control negativo.

## Resultado esperado

FEAT-002 contiene una tabla equivalente a ésta, y ninguna frase de README o release
docs la contradice:

| Evidencia | Comando | Verifica | No verifica |
| --- | --- | --- | --- |
| Consumidor de tarball | `npm run verify:consumer-fixture` | build de `postcss-uxdsl`, `npm pack`, instalación local, cinco entradas, `includeTheme`, integridad de referencias, paridad runtime/PostCSS, determinismo e inspectores | navegador, `css-loader`, Next.js, revisión visual completa, instalación coordinada de cinco paquetes |
| Next.js/CSS Modules | `npm run verify:cssmodules-build` | invoca primero el consumidor de tarball; compila las salidas; ejecuta el build de producción de Next.js 14 Pages Router con cuatro `.module.css`, y un control negativo `:root`/`is not pure` | App Router, Next.js 16, revisión visual completa |
| Chrome controlado | `fixtures/mig02-nextjs-cssmodules/browser.js`, invocado por el comando anterior | computed styles light/dark de padding, radius, border y background en 12 anchos de frontera; una generación inválida no reemplaza el CSS aplicado | auditoría visual de producto, todos los componentes, todos los navegadores, accesibilidad |

## Implementación

Seguir los siete puntos de MIG-B6-02 en FEAT-007 (sección "Implementación
requerida"):

1. Dividir MIG-07 en "packaged consumer" y referencias a gates externos.
2. No decir que `mig07-consumer/run.js` abre Chrome o ejecuta `css-loader`.
3. Explicar que `mig02-nextjs-cssmodules/run.js` invoca a MIG-07 antes de compilar.
4. Nombrar Pages Router y Next.js 14.
5. Mantener explícitos los gaps de App Router y Next.js 16.
6. Si Chrome no está disponible, `verify:cssmodules-build` falla o registra un skip
   detectable (comprobar cuál hace hoy y documentarlo). Nunca convierte un inspector
   en "browser verified".
7. Agregar el test documental (abajo) a `npm test`.

## Fuera de alcance

- Cambiar las fixtures.
- Agregar cobertura nueva (App Router, Next.js 16).

## Pruebas

`scripts/docs-provenance.test.js` (agregarlo al script `test` de la raíz, junto a
`scripts/verify-docs-update.test.js`) comprueba que:

- FEAT-002 contiene los tres comandos de la tabla;
- la tabla de procedencia identifica runner, cobertura y límites. Comprobar
  enlaces/comandos y fixtures positivas/negativas de afirmaciones; no fallar sólo
  porque una línea contenga a la vez `mig07-consumer` y `browser`: la negación
  «MIG-07 no ejecuta browser» es correcta. Las frases históricas se contextualizan
  por versión, sin reescribir evidencia pasada como si la nueva cobertura existiera.

## Documentación

Es la propia story. No requiere CHANGELOG de paquete.

## Criterios de aceptación

- [ ] Un lector puede copiar un comando por cada afirmación.
- [ ] Ninguna frase usa "fixture integrada" de manera ambigua.
- [ ] El test documental está en `npm test` y pasa.
- [ ] `git grep -n -i "navegador\|browser" -- docs README.md fixtures/*/README.md` no
      muestra afirmaciones contradictorias.

## Verificación

```bash
node --test scripts/docs-provenance.test.js
npm test
```

## Entrega

`docs(FEAT-008): MIG-B6-02 - exact provenance for FEAT-002 coverage claims`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Pendiente de implementación/verificación**
(salvo avances parciales señalados arriba). Completar en el mismo PR conforme al
[protocolo de agentes](README.md#cobertura-y-evidencia-obligatorias). No marcar
criterios por intención ni confundir una reproducción histórica con prueba actual.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | Comando/test, resultado observado y fecha: pendiente |
| Criterio → regresión | Nombre/path exacto del test por criterio: pendiente |
| Comandos y entorno | Comando, versión/OS relevante, exit code y log: pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | Pendiente; justificar si no aplica |
| README / CHANGELOG / migration | Paths y secciones: pendiente |
| AGENTS / guías / arquitectura | Secciones actualizadas o sin cambio de contrato razonado: pendiente |
| Límites y seguimiento | Qué no se ejecutó, motivo y efecto sobre cierre: pendiente |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
