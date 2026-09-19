# MIG-B6-28 — Higiene de paquetes y npm

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | G — Release |
| Prioridad · Tamaño | P0 · S |
| Cierra | UX-21. Aplica D-6 |
| Depende de | Nada para empezar. La evaluación de `postcss-advanced-variables` (paso 6) necesita la suite de paridad de MIG-B6-18. Los cambios en `index.ts` (paso 5) van al final de la secuencia de ese archivo |
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
   que se usan en tiempo de ejecución. En `postcss-uxdsl`, `src/theme/` sigue incluido
   porque se exporta `./theme/*`. Nada de tests, fuentes `.ts` sueltas ni PNG. Las
   imágenes del README pasan a URLs absolutas de GitHub.
2. **`scripts/release.js`:**
   - antes de publicar, ejecuta `npm pack --dry-run --json` por paquete y aborta si
     alguno supera su presupuesto (`postcss-uxdsl` 250 KB; el resto, su tamaño
     actual + 50 %);
   - después de publicar, consulta `npm view <pkg> dist-tags --json` y falla si
     `latest` y `beta` no apuntan a la versión recién publicada (D-6).
3. **Manifiesto:** si MIG-B6-29 ya se integró, el generador lo produce desde el JSON
   base; si no, quitar la entrada `motion`. Test:
   `test/theme-manifest-files.test.js` comprueba que toda ruta de
   `defaults.files` existe dentro del tarball (usar `npm pack --dry-run --json`).
4. **Tests dentro del paquete:** con `files`, `test/` deja de publicarse. Así
   desaparece el test que fallaba fuera del monorepo (requería
   `../../../fixtures/mig07-consumer/theme.json`).
5. **`index.ts`** (commit separado, al final de la secuencia de ese archivo):
   - codificar la familia de Google Fonts: espacios como `+` y el resto con
     `encodeURIComponent`, conservando `:` y `@` según la sintaxis de la API css2;
   - reescribir el comentario de cabecera con las capacidades reales.
6. **`postcss-advanced-variables` 5.x:** probar la actualización con
   `npm run test:parity` (MIG-B6-18). Actualizar sólo si la salida es idéntica; si no,
   documentar en el PR y en el README del CLI por qué queda fijada en ^3.

## Fuera de alcance

- Publicar o cambiar dist-tags: lo hace el dueño.
- Mover la documentación visual fuera del README.

## Pruebas

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

- [ ] `postcss-uxdsl` ≤ 250 KB empaquetado, y ningún tarball incluye tests ni PNG.
- [ ] El manifiesto no tiene rutas inexistentes y lo cubre un test.
- [ ] `release.js` aplica los presupuestos y verifica los dist-tags después de
      publicar.
- [ ] La URL de Google Fonts está codificada.

## Verificación

```bash
for p in postcss-uxdsl uxdsl-cli uxdsl-core uxdsl-webpack-loader vite-plugin-uxdsl; do (cd packages/$p && npm pack --dry-run); done
npm --prefix packages/postcss-uxdsl test
node scripts/release.js --dry-run --version 0.5.0-beta.6 --skip-publish
npm test
```

## Entrega

`chore(FEAT-008): MIG-B6-28 - lean tarballs, size budgets, manifest without dead paths, dist-tag check`
