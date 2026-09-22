# MIG-B6-28 — Higiene de paquetes y npm

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | G — Release |
| Prioridad · Tamaño | P0 · S |
| Cierra | UX-21. Aplica D-6 |
| Depende de | MIG-B6-18 (paridad), MIG-B6-21 (orden de index), MIG-B6-27 (exports/schema), MIG-B6-29 (fuentes/defaults). Inventario de paquetes puede empezar antes |
| Bloquea | MIG-B6-12 |
| Archivos | los cinco `package.json` publicables, `packages/postcss-uxdsl/README.md` (imágenes), `scripts/release.js`, `packages/postcss-uxdsl/src/theme/theme-manifest.json` (vía el generador), nuevo test del manifiesto, `packages/postcss-uxdsl/src/index.ts` (líneas ~11-16 y ~141) |
| Coordinación | La parte de `index.ts` va en un commit separado, después de MIG-B6-21 |

## Por qué

- `postcss-uxdsl` pesa 2.040 KB empaquetado: 1.928 KB son imágenes del README
  (`assets/uxdsl-intro-page.png` 1.544 KB, `assets/logo-uxdsl.png` 193 KB y
  `assets/code-example.png` 192 KB), y además incluye 19 archivos de test y las
  fuentes `.ts`.
- Cuatro paquetes no tienen campo `files`.
- `theme-manifest.json` apunta a `src/theme/default-motion.css`, que no existe.
- La URL de Google Fonts no se codifica (`family=${font}`, `index.ts:141`).
- El comentario de cabecera de `index.ts` (~11-16) describe una versión anterior.
- `postcss-advanced-variables` está en `^3` y la versión actual es 5.0.0.

**D-6:** `latest` sigue a la beta más reciente. Hay que verificar que `latest` y
`beta` apunten a la misma versión en los cinco paquetes después de publicar.

## Reproducción

```bash
for p in postcss-uxdsl uxdsl-cli uxdsl-core uxdsl-webpack-loader vite-plugin-uxdsl; do
  (cd packages/$p && npm pack --dry-run --json 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s)[0];console.log('$p', (j.size/1024).toFixed(0)+'KB', j.entryCount+' archivos')})")
done
node -e "const p=['postcss-uxdsl','uxdsl-cli','uxdsl-core','uxdsl-webpack-loader','vite-plugin-uxdsl'];for(const n of p)console.log(n,'files=',JSON.stringify(require('./packages/'+n+'/package.json').files))"
grep -n motion packages/postcss-uxdsl/src/theme/theme-manifest.json; ls packages/postcss-uxdsl/src/theme | grep -c motion
```

## Resultado esperado

- Tarballs con sólo lo necesario. `postcss-uxdsl` ≤ 250 KB empaquetado.
- El manifiesto sin rutas inexistentes, verificado por test.
- El script de release aplica presupuestos de tamaño y verifica los dist-tags.

## Implementación

1. **Campo `files`** en los cinco paquetes: `dist`, `README.md`, `LICENSE` y los assets
   que se usan en tiempo de ejecución. Enumerar también `bin/`, shims de entrada,
   codemods documentados, schema, config y archivos referenciados por exports;
   no copiar el mismo allowlist a paquetes con estructuras distintas.
   En `postcss-uxdsl`, `src/theme/` sigue incluido
   porque se exporta `./theme/*`. Nada de tests, fuentes `.ts` sueltas ni PNG. Las
   imágenes del README pasan a URLs absolutas de GitHub.
2. **`scripts/release.js`:**
   - antes de publicar, ejecuta `npm pack --dry-run --json` por paquete y aborta si
     alguno supera su presupuesto (`postcss-uxdsl` 250 KB; el resto, su tamaño
     actual + 50 %);
   - para beta.6, después de publicar consulta dist-tags con reintentos acotados
     y verifica latest/beta (D-6). Separar resultado postpublish de gate prepublish.
     No intentar republicar versiones ya existentes para reparar un tag.
   - admitir la ruta anunciada `0.5.0-rc.1`: hoy el regex sólo acepta beta/estable.
     Validar SemVer y política de tags por canal con tests; beta.6 usa latest/beta,
     RC y estable tienen expectativas explícitas en su propio release record,
     sin aplicar automáticamente la regla beta a todos los canales.
   - publicar exactamente los tarballs inspeccionados/validados, registrando hash;
     detectar cambios de fuentes/dependencias después de los gates. Actualizar
     manifests y lockfiles coordinadamente, comprobar instalación limpia.
3. **Manifiesto:** si MIG-B6-29 ya se integró, el generador lo produce desde el JSON
   base; si no, quitar la entrada `motion`. Test:
   `test/theme-manifest-files.test.js` comprueba que toda ruta de
   `defaults.files` existe dentro del tarball (usar `npm pack --dry-run --json`).
4. **Tests dentro del paquete:** con `files`, `test/` deja de publicarse. Así
   desaparece el test que fallaba fuera del monorepo (requería
   `../../../fixtures/mig07-consumer/theme.json`).
5. **`index.ts`** (commit separado, al final de la secuencia de ese archivo):
   - verificar/reutilizar el helper de Google Fonts de 29: no crear otra
     codificación sólo en index. Incluir `;` y comas de ejes en sus tests;
   - reescribir el comentario de cabecera con las capacidades reales.
6. **`postcss-advanced-variables` 5.x:** probar la actualización con
   `npm run test:parity` (MIG-B6-18). Actualizar sólo si la salida es idéntica; si no,
   documentar en el PR y en el README del CLI por qué queda fijada en ^3.

## Fuera de alcance

- Publicar o cambiar dist-tags: lo hace el dueño.
- Mover la documentación visual fuera del README.

## Pruebas

- Consumidor limpio instalado desde tarballs: sólo imports públicos, CLI bin,
  runtime browser, config, schema, base JSON y codemods documentados resolubles;
  nada de links al monorepo ni fallback a dist viejo.
- `--check-pack` debe ejecutar comprobación local real sin mutar versiones/publicar;
  `--dry-run` de release hoy sólo imprime comandos y no prueba contenidos.
- Simular tamaño excedido, export faltante, versión interna desalineada, rc.1,
  tag incorrecto y publicación parcial usando procesos/npm falsos, nunca registry
  real. El guard debe fallar antes de cualquier publish en errores preflight.

- `test/theme-manifest-files.test.js` (paso 3).
- Un test del presupuesto: un script que el release usa y que se puede correr solo
  (`node scripts/release.js --check-pack` o equivalente) y falla si se excede.
- **Google Fonts:** `fonts.google: ['Open Sans:wght@400;700']` produce
  `family=Open+Sans:wght@400;700`.

## Documentación

- READMEs con imágenes absolutas.
- `packages/uxdsl-cli/README.md`: estado de `postcss-advanced-variables`.
- `docs/releases/`: la nota de dist-tags según D-6, en el release record de beta.6
  (MIG-B6-12).
- CHANGELOG beta.6.

## Criterios de aceptación

- [x] `postcss-uxdsl` ≤ 250 KB empaquetado, y ningún tarball incluye tests ni PNG.
      **(86.9 KB empaquetado, 61 archivos, cero `test/*.js` y cero `.png` — ver evidencia)**
- [x] El manifiesto no tiene rutas inexistentes y lo cubre un test.
- [x] `release.js` aplica los presupuestos y verifica los dist-tags después de
      publicar. **(presupuesto + exports antes de publicar; dist-tags después,
      nunca ejercido contra el registro real en esta sesión — ver "Límites y
      seguimiento")**
- [ ] La URL de Google Fonts está codificada. **(diferido a propósito: esta
      parte de `index.ts` está explícitamente secuenciada por esta misma
      ficha para ir "en un commit separado, después de MIG-B6-21", que no
      forma parte de la secuencia 20→23→24→26→28 pedida; ver "Límites y
      seguimiento")**

## Verificación

```bash
for p in postcss-uxdsl uxdsl-cli uxdsl-core uxdsl-webpack-loader vite-plugin-uxdsl; do (cd packages/$p && npm pack --dry-run); done
npm --prefix packages/postcss-uxdsl test
node scripts/release.js --dry-run --version 0.5.0-beta.6 --skip-publish
npm test
```

## Entrega

`chore(FEAT-008): MIG-B6-28 - lean tarballs, size budgets, manifest without dead paths, dist-tag check`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente en
`feat/feat-008-beta6-plan`** — parcial por diseño (Google Fonts/`index.ts`
diferido; ver criterios y "Límites y seguimiento"); integración a `main`
pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `fbe097c` (2026-09-21). Entrega: `a103344` en `feat/feat-008-beta6-plan`; corrección de revisión (bug del hash en `release.js`, ver Límites (8)): `c899127`; PR pendiente de abrir |
| Reproducción antes del cambio | Sobre `fbe097c`, exactamente los comandos de la propia ficha: `npm pack --dry-run --json` por paquete dio `postcss-uxdsl 2086KB 117 archivos` (incluye tres PNG de README ≈1928KB, 19 `test/*.js`, y cada `.ts` suelto de `src/` junto a su `dist/` compilado), `uxdsl-cli 61KB 8 archivos`, `uxdsl-core 16KB 12 archivos`, `uxdsl-webpack-loader 5KB 4 archivos`, `vite-plugin-uxdsl 8KB 4 archivos`. `node -e "...files"` confirmó `files: undefined` en los cuatro primeros (`vite-plugin-uxdsl` ya tenía `files:["dist"]`). `grep -n motion .../theme-manifest.json` + `ls .../theme \| grep -c motion` confirmó `defaults.files.motion` → `src/theme/default-motion.css`, 0 coincidencias en disco. 2026-09-21 |
| Criterio → regresión | "`postcss-uxdsl` ≤ 250KB, sin tests ni PNG" → medido con el mismo `npm pack --dry-run --json` de la reproducción (86.9KB, 61 archivos, ver Resultado). "Manifiesto sin rutas inexistentes + test" → `packages/postcss-uxdsl/test/theme-manifest-files.test.js` (3 tests: toda ruta de `defaults.files` existe en el tarball real y en disco; `motion` ya no está en el objeto; control negativo confirmando que `src/theme/default-motion.css` seguiría ausente si alguien la reintrodujera) — confirmado que 2 de los 3 tests fallan contra el manifiesto pre-fix (`git stash` temporal + re-run). "`release.js` aplica presupuestos y verifica dist-tags" → `scripts/release.test.js` (18 tests: unitarios sobre `isValidSemver`/`getChannel`/`bumpSemver`/`parseArgs`/`checkPackBudgets`/`checkExportsPresent`/`checkVersionAlignment`/`verifyDistTags` con datos falsos inyectados, cubriendo explícitamente cada escenario que pide la sección Pruebas de esta ficha — tamaño excedido, export faltante, versión interna desalineada, rc.1, tag incorrecto —, más 4 tests de subproceso real con un `npm` falso en el `PATH` que prueban que el guard aborta *antes* de tocar cualquier `package.json`, y que una falla de `npm publish` a mitad de la lista detiene el resto sin continuar con los paquetes siguientes ("publicación parcial")) |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, desde el root del monorepo: `npm test` (exit 0, 250+21+155+14+6+30+6+6+10+18 tests en verde — el +3 de `postcss-uxdsl` es `theme-manifest-files.test.js`, el +18 es `release.test.js`), `node scripts/release.js --dry-run --version 0.5.0-beta.6 --skip-publish` (exit 0, ver Resultado), `node scripts/release.js --check-pack` (exit 0, con build real de los 3 paquetes que compilan), `npm run verify:beta2`/`verify:beta3`/`verify:beta4`/`verify:beta5` (todos PASS), `npm run verify:consumer-fixture` (PASS, tras corregir su propia expectativa sobre `docs/migration.md` — ver Cambios), `npm --prefix packages/playground-nextjs run build` (build de producción completo, OK) |
| Resultado después / control negativo | `postcss-uxdsl`: 86.9KB empaquetado / 61 archivos (antes: 2086KB / 117). `uxdsl-cli`: 35.7KB/3 archivos (`README.md`, `bin/uxdsl.js`, `package.json`). `uxdsl-core`: 9.8KB/4 archivos. `uxdsl-webpack-loader`: 3.1KB/3 archivos. `vite-plugin-uxdsl`: sin cambios (7.6KB/4, ya tenía `files`). `node scripts/release.js --check-pack` sobre los 5 reales: los 5 dentro de su presupuesto (`postcss-uxdsl` fijo en 250KB por la propia ficha; el resto = tamaño medido tras el fix × 1.5, redondeado arriba: `uxdsl-cli` 55KB, `uxdsl-core` 15KB, `uxdsl-webpack-loader` 5KB, `vite-plugin-uxdsl` 12KB) y `exports: every main/types/bin/exports path is present in every tarball.`. Control negativo (subproceso con `npm` falso, nunca el registro real): forzar un tamaño de 999MB en un paquete → exit 1, `Pack budget exceeded`, y los 5 `package.json` del repo falso siguen en `0.0.1` (el guard corrió *antes* de escribir nada); forzar que `dist/index.js` falte del tarball reportado → exit 1, `missing from the tarball`, mismo resultado de "nada tocado"; forzar que `npm publish` falle en el 2º paquete → el script aborta con `Publish failed`/el mensaje simulado, y los `package.json` sí quedan con la versión nueva (el bump ya había corrido, sólo publicar es parcial — exactamente el estado real que un operador necesita ver). `verifyDistTags` con tags desalineados: reintenta (delay simulado, nunca `sleep` real) y al agotar reintentos recomienda `npm dist-tag add ... latest/beta`, nunca sugiere republicar. Para `rc`/estable, `verifyDistTags` nunca invoca la función de red inyectada — confirmado con una función que lanza si se llama. **Intento de actualizar `postcss-advanced-variables` (paso 6 de Implementación):** probado `^4.0.0` y `^5.0.0` — ambos rompen un patrón real ya usado en `packages/playground-nextjs/src/components/DemoPalette.uxdsl` (un `@mixin` cuyo parámetro SCSS se usa como argumento directo de `@ds-surface($tone, 1)` e interpolado en `palette(#{$tone}-#{$variant})`): con `^4`/`^5`, `$tone` llega sin expandir a `@ds-surface`, y `postcss-uxdsl` falla con `UXD_SURFACE_REFERENCE: Undefined surface or palette family $tone`; con `^3` compila correctamente. Ni la suite de paridad (8/8) ni los gates beta2–beta5 detectaron esto — ninguno ejercita ese patrón exacto —, sólo el build real de `packages/playground-nextjs` lo hizo. Revertido a `^3.0.0` (lockfile de `uxdsl-core` idéntico al original, confirmado con `git diff --stat`); documentado con la reproducción exacta en `packages/uxdsl-cli/README.md`, sección 9 |
| Cambios visuales o API / migración | Cambio de comportamiento real, no sólo interno: instalar cualquiera de los 5 paquetes ahora trae menos archivos (`npm install` más rápido, menos superficie); nada que un consumidor real importaba deja de existir (todo lo removido eran tests/fuente/PNG/docs no referenciados por `main`/`types`/`exports`/`bin`). Las imágenes y el enlace a `docs/migration.md` en el README/CHANGELOG de `postcss-uxdsl` pasan de rutas relativas (sólo válidas dentro de este repositorio) a URLs absolutas de GitHub — corrige un enlace roto preexistente en la página de npm, no sólo un efecto secundario del `files` nuevo. `scripts/release.js` gana `--check-pack` (nuevo, aditivo), un gate previo a cualquier escritura (presupuesto de tamaño + exports declarados vs. empaquetados; corre siempre, también con `--skip-build`, porque ese flag significa "no recompiles", no "no revises"), una validación final de los artefactos exactos ya bumpeados/compilados que registra el `shasum` de cada tarball en el log, un recheck de ese `shasum` inmediatamente antes de cada `npm publish` individual (aborta nombrando qué ya se publicó y qué no), y la verificación de dist-tags después de publicar. Ningún flag existente cambió de significado ni de exit code (verificado re-corriendo `--dry-run --version X --skip-publish`, con y sin `--skip-build`, sin argumentos, `--version X --bump Y` juntos, y una versión inválida); la única diferencia de salida respecto del script original son las líneas informativas del gate, que ahora aparecen también con `--skip-build`. `postcss-advanced-variables` permanece en `^3.0.0` (sin cambio neto; el intento y su resultado quedan documentados) |
| README / CHANGELOG / migration | `packages/postcss-uxdsl/CHANGELOG.md` (nueva entrada MIG-B6-28: packaging + fix del manifiesto; además corregidos dos enlaces preexistentes a `docs/migration.md` que quedaban rotos una vez que `docs/` no se publica); `packages/postcss-uxdsl/README.md` (imágenes + enlace a migration.md absolutos); `packages/uxdsl-cli/README.md` (nueva sección 9, con la reproducción exacta de por qué `postcss-advanced-variables` sigue en `^3`); `packages/uxdsl-core/README.md` (nota sobre el nuevo `files`, referencia cruzada a la sección 9 de `uxdsl-cli`); `packages/uxdsl-webpack-loader/README.md` (nota sobre el nuevo `files`); `fixtures/mig07-consumer/README.md` y `fixtures/mig07-consumer/run.js` (expectativa corregida: ya no exige `docs/migration.md` en el tarball instalado, exige en cambio que el README instalado enlace esa página con URL absoluta) |
| AGENTS / guías / arquitectura | No aplica: higiene de empaquetado npm y del script de release, sin tocar ninguna primitiva de diseño ni el contrato de `AGENTS.md` de este repositorio |
| Límites y seguimiento | (1) **Google Fonts / `index.ts` diferido a propósito, sin implementar en este commit.** Esta misma ficha (`Coordinación`) exige que esa parte vaya "en un commit separado, después de MIG-B6-21" — MIG-B6-21 sigue "Pendiente" y no forma parte de la secuencia 20→23→24→26→28 que pidió el dueño para esta sesión. A diferencia de las desviaciones de MIG-B6-20/23/24/26 (que sí avanzaron sin esperar su dependencia, con una razón concreta de por qué era seguro), aquí la propia ficha pide explícitamente *no* tocar ese archivo todavía — se respeta esa instrucción interna en vez de forzarla. El criterio de aceptación correspondiente queda sin marcar. (2) **`release.js` sólo se verificó con un `npm` falso y `--dry-run`/`--skip-publish`/`--check-pack` reales; nunca se ejecutó un `npm publish` real ni se consultó el registro real de npm** — publicar es explícitamente responsabilidad del dueño ("Fuera de alcance"). La verificación post-publish de dist-tags (`verifyDistTags`) tiene cobertura unitaria completa con funciones inyectadas, pero jamás corrió contra `https://registry.npmjs.org` real; su primera ejecución real ocurrirá en el próximo release real de beta.6. (3) **La nota de política de dist-tags para D-6 en un "release record" de beta.6** (que pide la sección Documentación) no se escribió porque ese release record vive en MIG-B6-12 (el gate final), que todavía no existe como documento — mismo patrón de dependencia-no-creada-aún ya usado en fichas anteriores de esta sesión. (4) Los presupuestos de tamaño de los 4 paquetes distintos de `postcss-uxdsl` (55/15/5/12 KB) son medidas fijas tomadas hoy × 1.5, no recalculadas dinámicamente — si una futura story agrega contenido legítimo que supere ese presupuesto, `release.js` fallará y alguien deberá subir el número a propósito, no es un techo que se ajuste solo. (5) `vite-plugin-uxdsl/README.md` tiene el mismo patrón de imagen relativa (`<img src="./assets/logo-uxdsl.png">`) que se corrigió en `postcss-uxdsl` — no se tocó aquí porque esa ficha no lo listó en "Archivos" y ese tarball ya estaba dentro de presupuesto; queda como gap conocido, no silencioso. (6) `npm audit` sigue reportando 2 vulnerabilidades altas preexistentes (`nanoid`, `postcss` transitivos) sin relación con `postcss-advanced-variables`; no se tocaron, fuera del alcance de esta ficha. (7) La falta de un archivo `LICENSE` en el repo (ya documentada en la evidencia de MIG-B6-26) sigue sin resolverse; los README de los 5 paquetes siguen enlazando a un `LICENSE` que no existe — no es nuevo de esta ficha, no se fabricó aquí. (8) **Bug encontrado y corregido en la revisión posterior a `a103344`:** la primera versión registraba el `shasum` de cada tarball *antes* del loop de bump (que reescribe `version` en los 5 `package.json`) y de `generate-language-artifacts.js` (que reescribe `theme-manifest.json`, que se publica), y comparaba *después* — en un release real sin `--dry-run`/`--skip-build`/`--skip-publish` los 5 paquetes cambian legítimamente, así que el script abortaba siempre antes de publicar nada. No lo detectó ningún test porque ninguno ejercitaba el flujo completo, y el `npm` falso devolvía un `shasum` constante que lo habría enmascarado igual. Corregido: el hash se registra sobre los artefactos finales (tras bump/build/generate) y se re-verifica por paquete justo antes de cada `publish`; el `npm` falso ahora deriva el `shasum` del contenido real, y `scripts/release.test.js` suma dos tests de subproceso (release completo limpio que publica los 5 — falla contra `a103344` con el mensaje exacto del bug —, y una mutación de fuentes a mitad del loop que se detecta antes de publicar el 2º paquete, dejando constancia de "Already published: postcss-uxdsl"). Sigue sin ejecutarse un `npm publish` real (límite (2)). |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
