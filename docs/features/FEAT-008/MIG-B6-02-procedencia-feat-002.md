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

- [x] Un lector puede copiar un comando por cada afirmación.
- [x] Ninguna frase usa "fixture integrada" de manera ambigua.
- [x] El test documental está en `npm test` y pasa.
- [x] `git grep -n -i "navegador\|browser" -- docs README.md fixtures/*/README.md` no
      muestra afirmaciones contradictorias.

## Verificación

```bash
node --test scripts/docs-provenance.test.js
npm test
```

## Entrega

`docs(FEAT-008): MIG-B6-02 - exact provenance for FEAT-002 coverage claims`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada/verificada** — documentación
y test agregados y verificados en la rama `feat/feat-008-beta6-plan`, conforme
al [protocolo de agentes](README.md#cobertura-y-evidencia-obligatorias).
**Integración** (merge a `main` / PR) sigue pendiente; no confundir "verificada
en la rama" con "integrada". Ver el estado equivalente en el índice
(`docs/features/FEAT-008/README.md`).

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `60fdd76`; entrega en `887622c` (documentación + test) y `b00b84d` (test en `npm test`); hardening tras revisión de código (filas de la tabla verificadas por celda, detector de contradicciones extraído a `scripts/lib/doc-provenance-checks.js` con fixtures positivas/negativas propias, mutación probada manualmente: atribuir Chrome a la fila del tarball hace fallar el test) en el commit siguiente a `b00b84d` en `feat/feat-008-beta6-plan`; sin PR abierto todavía |
| Reproducción antes del cambio | `grep -n "navegador\|Chrome" docs/features/FEAT-002-beta-migration-hardening.md` mostraba la línea 32 "La fixture integrada verifica las dependencias responsive en el navegador" (sin nombrar fixture) y el título de línea 121 "MIG-07 — Consumidor desde tarball y navegador"; `sed -n '50,59p' fixtures/mig07-consumer/README.md` confirmaba la negación real ("No headless browser is available…", "does not run that loader"). Fecha: 2026-09-20. |
| Criterio → regresión | `scripts/docs-provenance.test.js`: comandos citados → "FEAT-002 names every provenance command…"; fila del tarball no reclama Chrome → "the tarball row claims install/build coverage, not Chrome"; fila Next.js/CSS Modules no reclama Chrome y nombra sus huecos → "the Next.js/CSS Modules row claims the production build…"; fila Chrome reclama computed styles → "the Chrome row is the one that actually claims…"; frase ambigua eliminada → "no longer makes an ambiguous…"; título de MIG-07 → "MIG-07's own heading…"; sin contradicciones cruzadas → "no doc line attributes browser/navegador…" (delega en `scripts/lib/doc-provenance-checks.js`); detector con fixtures propias → "isUnqualifiedMig07BrowserClaim flags…" / "…does not flag qualified mentions"; fixtures siguen documentando sus límites → "fixtures still document what they do not verify…" |
| Comandos y entorno | `node --test scripts/docs-provenance.test.js` (macOS, Node del repo): 10/10 `ok`, exit 0. `npm test` desde la raíz: 275 subtests, 0 fallos, exit 0. `git grep -n -i "navegador\|browser" -- docs README.md fixtures/*/README.md`: sin afirmaciones contradictorias en los archivos que hacen afirmaciones de cobertura (tarball, Next.js/CSS Modules, releases); menciones dentro de fichas de planificación de FEAT-007/FEAT-008 son citas históricas o meta-descripción del propio fix, no afirmaciones de cobertura, y quedan fuera del alcance de este grep manual y del escaneo automatizado (ver Límites). |
| Resultado después / control negativo | FEAT-002 ahora nombra `verify:consumer-fixture`, `verify:cssmodules-build` y `fixtures/mig02-nextjs-cssmodules/browser.js` explícitamente, con la tabla de procedencia insertada tal cual en MIG-07, y cada fila afirma solo lo que su propio runner ejecuta (verificado celda por celda, no solo por presencia de la etiqueta). Controles negativos ejecutados y confirmados: (1) revertir la tabla o el título de MIG-07 hace fallar el test (verificado durante el desarrollo, antes de las correcciones); (2) mutar en memoria la fila del tarball para que su columna "Verifica" incluya "Chrome computed styles" hace fallar "the tarball row claims install/build coverage, not Chrome" — probado manualmente con `sed`, restaurado después, `git diff` limpio; (3) la frase adversarial "MIG-07 verifica browser sin limitaciones." y una fila con negación no adyacente ("MIG-07 no navegador") están fijadas como fixtures que `isUnqualifiedMig07BrowserClaim` debe seguir marcando como violación. |
| Cambios visuales o API / migración | No aplica: cambio de documentación y de tests documentales; ningún archivo de `src/` ni comportamiento de build cambia. |
| README / CHANGELOG / migration | No se tocan `README.md` raíz ni READMEs de fixtures (ya eran correctos, ver Fuera de alcance); se edita únicamente `docs/features/FEAT-002-beta-migration-hardening.md` y este story. Sin CHANGELOG de paquete: esta story no afecta ningún paquete publicado. |
| AGENTS / guías / arquitectura | Sin cambio de contrato de AGENTS.md ni de arquitectura; no requiere actualización. |
| Límites y seguimiento | No se agregó cobertura nueva (App Router, Next.js 16) ni se tocaron las fixtures, conforme a "Fuera de alcance". El escaneo de contradicciones (`scripts/lib/doc-provenance-checks.js`) es heurístico por línea con una lista fija de frases de negación conocidas, no un parser semántico: reconoce las negaciones realmente usadas en este repo hoy, pero una negación repartida en dos líneas, o una frase nueva y legítima que no calce ninguna de las frases registradas, exigiría ampliar `NEGATION_PHRASE_PATTERNS` en ese archivo. El escaneo automatizado solo cubre FEAT-002, `README.md`, los dos READMEs de fixtures y `docs/releases/*.md` — deliberadamente no incluye `docs/features/FEAT-007-*` ni las fichas de `docs/features/FEAT-008/*` (incluida esta), que citan y describen la contradicción histórica en prosa y activarían falsos positivos si se escanearan igual; su corrección queda sujeta a revisión manual, no a este test. Integración a `main` sigue pendiente (ver Estado arriba). |

Si cambia un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
