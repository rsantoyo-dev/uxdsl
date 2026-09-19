# MIG-B6-24 — Guardas de `builds`

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | D — CLI |
| Prioridad · Tamaño | P1 · S |
| Cierra | UX-12 |
| Depende de | MIG-B6-18, MIG-B6-19 (orden de `uxdsl.js`) |
| Bloquea | MIG-B6-23 (siguiente en `uxdsl.js`) |
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
2. El aviso se deduplica igual que los demás avisos del proceso watch
   (`warnedUnknownThemeKeys` es el precedente).

## Fuera de alcance

- Cambiar el default de `includeTheme`.

## Pruebas

- El caso de la reproducción → error, sin escribir ningún archivo.
- Una entrada `.module.css` con `includeTheme: false` → sin error.
- Dos entradas `.css` con tema → aviso una sola vez.
- Una sola entrada `--out x.module.css` → error. Con `--no-include-theme` → OK.

## Documentación

- `packages/uxdsl-cli/README.md`: sección "Multiple entries, one shared theme".
- `packages/postcss-uxdsl/docs/migration.md`, "Desde beta.6": el error nuevo.
- CHANGELOG beta.6.

## Criterios de aceptación

- [ ] La reproducción falla antes de escribir, con el mensaje indicado.
- [ ] El aviso de varios emisores aparece una sola vez.

## Verificación

```bash
npm --prefix packages/uxdsl-cli test
npm run verify:beta3 && npm run verify:beta4
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-24 - css module outputs never emit the theme; warn on multiple theme entries`
