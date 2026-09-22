# MIG-B6-24 — Guardas de `builds`

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | D — CLI |
| Prioridad · Tamaño | P1 · S |
| Cierra | UX-12 |
| Depende de | MIG-B6-18, MIG-B6-19 (orden de `uxdsl.js`) |
| Bloquea | MIG-B6-12, MIG-B6-23 |
| Archivos | `packages/uxdsl-cli/bin/uxdsl.js` (`buildOnce` ~757, `resolveIncludeTheme` ~577), `packages/uxdsl-cli/test/uxdsl-cli.test.js` |
| Coordinación | Cuarto en la secuencia de `uxdsl.js` |

## Por qué

En `builds`, una entrada sin `includeTheme` emite el tema completo (`:root` y
`#uxdsl-bp-meta`). En un CSS Module, eso rompe el build de Next.js ("Selector :root
is not pure"), y el CLI no avisa. Press Craftor lo sufrió dos veces.

## Reproducción

```bash
REPO=$(git rev-parse --show-toplevel)   # ejecutar desde cualquier carpeta del repo
d=$(mktemp -d) && cd $d && mkdir src
cat > uxdsl.config.cjs <<'C'
module.exports = { builds: [ { entry: './src/theme.uxdsl', outFile: './out/theme.css' }, { entry: './src/panel.uxdsl', outFile: './out/panel.module.css' } ] };
C
echo '' > src/theme.uxdsl; printf '.p { padding: density(2); }\n' > src/panel.uxdsl
node $REPO/packages/uxdsl-cli/bin/uxdsl.js build; grep -c ':root' out/panel.module.css   # ≥ 1, sin aviso
```

## Resultado esperado

- **Error antes de escribir** si una entrada cuyo `outFile` termina en `.module.css`
  va a emitir el tema:
  `builds[1] (out/panel.module.css): this entry would emit :root and #uxdsl-bp-meta, which CSS Modules reject ("Selector :root is not pure"). Set includeTheme: false for component entries.`
  Aplica también a una sola entrada con `--out x.module.css` sin
  `--no-include-theme`.
- **Aviso** si más de una entrada emite el tema:
  `[uxdsl] Warning: 2 entries emit the theme (builds[0], builds[1]); usually only one theme entry should.`

## Implementación

1. En `buildOnce`, antes de compilar, calcular `includeTheme` efectivo por entrada (la
   misma resolución de flag > entrada > config > `true`) y aplicar las dos reglas.
   Después de compilar, inspeccionar selectores del AST antes de escribir: con
   includeTheme false, un import legacy o CSS explícito aún puede introducir
   :root/#uxdsl-bp-meta. Detectar esos selectores, no texto en strings/comentarios.
   No presentar la guarda como validador completo de pureza de CSS Modules.
2. El aviso se deduplica igual que los demás avisos del proceso watch
   (`warnedUnknownThemeKeys` es el precedente).

## Fuera de alcance

- Cambiar el default de `includeTheme`.

## Pruebas

- `.module.css` con includeTheme false y :root importado falla antes de escribir;
  string/comentario que contiene ':root' no dispara falso positivo.
- Tras salida válida, error en otra entry conserva bytes previos de todas. Flags
  ausentes no pisan config, y `--no-include-theme` explícito sí lo hace.

- El caso de la reproducción → error, sin escribir ningún archivo.
- Una entrada `.module.css` con `includeTheme: false` → sin error.
- Dos entradas `.css` con tema → aviso una sola vez.
- Una sola entrada `--out x.module.css` → error. Con `--no-include-theme` → OK.

## Documentación

- `packages/uxdsl-cli/README.md`: sección "Multiple entries, one shared theme".
- `packages/postcss-uxdsl/docs/migration.md`, "Desde beta.6": el error nuevo.
- CHANGELOG beta.6.

## Criterios de aceptación

- [x] La reproducción falla antes de escribir, con el mensaje indicado.
- [x] El aviso de varios emisores aparece una sola vez.

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
npm run verify:beta3 && npm run verify:beta4
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-24 - css module outputs never emit the theme; warn on multiple theme entries`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada en
`feat/feat-008-beta6-plan`** (integración a `main` pendiente).

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `0441b13` (2026-09-21). Entrega: `1661ca0` en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | Script exacto de la sección "Reproducción" ejecutado sobre `0441b13`: `grep -c ':root' out/panel.module.css` da `1`, sin ningún aviso ni error — el build termina en 0 y escribe el archivo `.module.css` con `:root` incluido. 2026-09-21 |
| Criterio → regresión | "Falla antes de escribir, con el mensaje indicado" → `packages/uxdsl-cli/test/uxdsl-cli.test.js` ("the exact reproduction fails before writing, naming the offending entry" — reproduce el script exacto de la story y compara el mensaje de error; "a single entry with --out ending in .module.css fails; --no-include-theme fixes it"). "Aviso de varios emisores una sola vez" → `uxdsl-cli.test.js` ("two .css entries that both emit the theme warn exactly once, naming both", usa `captureWarningsAsync` para contar apariciones exactas). Detección real por AST (no substring) → `uxdsl-cli.test.js` ("findThemeLeakSelector finds a real :root rule, not text inside a string or comment", cubre selector compuesto con coma, comentario y `content: ":root"`) |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, desde el root del monorepo: `npm --prefix packages/uxdsl-cli test` (exit 0, 155/155, incluye 6 tests nuevos de MIG-B6-24), `npm test` (exit 0, todas las suites), `npm run verify:beta3` (PASS — requirió corregir `fixtures/mig-b3-06-release/run.js`, ver "Límites y seguimiento"), `npm run verify:beta4` (PASS), `npm run verify:consumer-fixture`/`verify:beta2`/`verify:beta5`/`verify:cssmodules-build` (todos PASS; `verify:cssmodules-build` en particular corre un `next build` real que rechaza un `.module.css` con `:root`, corroborando independientemente que el error de este guard describe un fallo real de Next.js, no uno inventado), `npm run build` en `packages/playground-nextjs` (build de producción completo, OK) |
| Resultado después / control negativo | La reproducción exacta ahora falla con el mensaje literal de la story (`builds[1] (out/panel.module.css): this entry would emit :root and #uxdsl-bp-meta...`), sin escribir `out/` en absoluto (verificado: el directorio ni siquiera se crea). Controles negativos verificados manualmente y en tests: `.module.css` con `includeTheme: false` compila sin error; dos entradas `.css` con tema avisan exactamente una vez citando ambos índices; una sola entrada `--out x.module.css` falla, y `--no-include-theme` la corrige; un comentario o `content: ":root"` en el CSS propio nunca dispara un falso positivo; `includeTheme: false` NO exime a una entrada cuyo propio contenido nativo aún define `:root` (detectado sobre el CSS compilado real, no sobre el flag de config) |
| Cambios visuales o API / migración | Cambio de comportamiento real y documentado: una entrada `builds[]` (o una sola entrada vía `--out`) cuyo `outFile` termina en `.module.css` y aún emitiría `:root`/`#uxdsl-bp-meta` ahora falla el build — antes compilaba en silencio. Más de una entrada emitiendo el tema ahora avisa (antes, silencio total). `postcss` pasó de `devDependencies` a `dependencies` en `uxdsl-cli/package.json` (ya se usaba sólo en tests; ahora también en código de producción para el parseo AST del guard) |
| README / CHANGELOG / migration | `packages/uxdsl-cli/README.md` (sección "Multiple entries, one shared theme" ampliada con el guard y el aviso); `packages/postcss-uxdsl/docs/migration.md` (sección "Desde beta.6: una entrada .module.css que emitiría :root ahora falla antes de escribir"). No existe `CHANGELOG.md` propio en `uxdsl-cli` — documentado en su README, mismo patrón que las stories anteriores de esta feature |
| AGENTS / guías / arquitectura | No aplica: cambio interno del CLI (validación de `builds[]` antes de escribir), no toca ninguna primitiva de diseño ni el contrato de `AGENTS.md` de este repo |
| Límites y seguimiento | (1) **Implementada después de MIG-B6-23** (orden 20→23→24→26→28 pedido explícitamente por el dueño), invirtiendo el orden de coordinación que la ficha sugiere ("Cuarto en la secuencia... antes de 23"). Sin conflicto real: ambas tocan `buildOnce` pero en mitades distintas (23 reestructuró la escritura/commit; 24 agrega una validación previa a esa escritura) — verificado en la práctica: los 155 tests de `uxdsl-cli` (incluidos los 17 nuevos de 23) siguen en verde después de agregar 24. (2) Al implementar el guard se descubrió que el fixture preexistente `fixtures/mig-b3-06-release/run.js` (de MIG-B3-06, beta.3, ya integrado) nombraba su propia entrada de tema `theme.module.css` — exactamente el anti-patrón que esta story hace fallar. Corregido en el mismo cambio (renombrado a `theme.css`, sin alterar ninguna otra aserción del fixture) — no es un ajuste cosmético: ese fixture ahora es un ejemplo correcto de la convención que el propio mensaje de error de esta story recomienda. (3) El guard cubre exactamente los dos selectores que este compilador puede emitir (`:root`, `#uxdsl-bp-meta`); no es un validador general de pureza de CSS Modules (no detecta, por ejemplo, un `:global()` mal usado o selectores compuestos sin clase local que no sean estos dos) — documentado explícitamente como tal en el código y en el README. (4) No se agregó una prueba dedicada para "flags ausentes no pisan config" en el contexto específico de este guard — se apoya en la resolución de `includeTheme` ya existente y probada (`resolveIncludeTheme`), que este guard sólo lee, no reimplementa. |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
