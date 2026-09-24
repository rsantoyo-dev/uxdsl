# MIG-B7-09 — Limpieza del playground

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P2 · S-M |
| Cierra | R-12, R-13, R-14 |
| Depende de | — |
| Bloquea | — |
| Archivos | `packages/playground-nextjs/src/components/ThemeProvider.tsx` (eliminar), `packages/playground-nextjs/src/app/InlineStyles.tsx` (eliminar), `packages/playground-nextjs/scripts/audit-themes.mjs`, nuevo arnés de tests de componente (`scripts/lib/component-harness.cjs`), `src/components/ThemeContext.tsx` (dos arreglos, ver "Lo que realmente pasó") |

## Por qué

Tres residuos de MIG-B6-30, cada uno independiente entre sí:

1. **Archivos muertos**, "Límites y seguimiento" (6): "Dos archivos muertos
   detectados y no tocados (`src/components/ThemeProvider.tsx`,
   `src/app/InlineStyles.tsx`): no los importa nadie, borrarlos es limpieza
   ajena a esta historia."
2. **Script roto preexistente**, citado en MIG-B6-29 fase 1, (8):
   "`packages/playground-nextjs/scripts/audit-themes.mjs` tiene un
   `SyntaxError` real y preexistente (`Unexpected token 'const'`), sin
   relación con esta historia."
3. **Sin arnés de tests de componente**, MIG-B6-30 (2): "El playground no
   tiene arnés de tests de componente, así que `ThemeContext.tsx` no tiene
   tests unitarios; por eso la lógica con sustancia (el batching) se extrajo
   a `src/lib/theme-scheduler.js`."

## Implementación

1. **Confirmar que los dos archivos siguen sin importarse** (repetir el `grep`
   exhaustivo que MIG-B6-30 ya hizo, por si algo cambió desde entonces) y
   borrarlos.
2. **Reproducir y arreglar el `SyntaxError`** de `audit-themes.mjs` —
   diagnóstico primero (¿sintaxis de módulo ESM mal declarada? ¿top-level
   `await` sin soporte?), luego el fix mínimo. Correr el script después del
   fix para confirmar que hace lo que su nombre promete, no sólo que ya no
   lanza.
3. **Elegir un arnés de tests de componente** (React Testing Library es el
   candidato estándar para Next.js; confirmar que no colisiona con nada del
   setup existente antes de instalarlo) y escribir al menos los tests que
   `ThemeContext.tsx` necesita: inicialización, `switchTheme`, `setCustomTheme`
   con `replace`, y que un tema rechazado no reemplaza el aplicado — el mismo
   contrato que ya prueban los tests de motor de `applyTheme`, pero ejercitando
   el componente React real, no sólo el runtime que envuelve.

## Lo que realmente pasó (durante la implementación, 2026-09-24)

1. **Archivos muertos: confirmado y borrado.** `grep` sobre todo el paquete y el
   resto del repo: las únicas apariciones de `ThemeProvider`/`InlineStyles` son sus
   propias definiciones. Con los dos borrados, `tsc --noEmit` limpio y el build de
   producción del playground sigue en **35/35 páginas**.
2. **`audit-themes.mjs`: la causa era trivial, pero "corre sin error" no bastaba.**
   - **Causa del `SyntaxError`:** un `+` suelto en la línea 105, restos de una marca
     de diff, justo antes de `const map = {}`. Se quitó.
   - **Dependía del directorio de ejecución** (`ROOT = process.cwd()`): el comando de
     verificación de esta misma ficha, corrido desde la raíz del repo, habría leído los
     `uxdsl.theme.*.json` del directorio equivocado. Ahora se resuelve desde el propio
     archivo.
   - **Su veredicto engañaba.** Decía `Accessibility audit PASSED (no contrast
     failures)`, mientras el gate compartido (`checkThemeContrast`) reporta
     **123 / 142 / 123 / 124** pares fallando en `default` / `green` / `purple` /
     `slate` (512 en total). El script revisa sólo 11 pares `main` vs `contrast` por
     modo, con su propia matemática de luminancia. Ahora dice `Palette audit PASSED`,
     y añade cuántos pares reporta el gate completo. **No** se sustituyó su lógica por
     el motor compartido: eso lo volvería FAIL y es una decisión aparte (ver límites).
3. **Arnés de componentes: jsdom + React Testing Library sobre `node:test`, con
   esbuild como transformador de TSX.** Se descartó Vitest: añade un segundo runner y
   su configuración, y todos los demás tests del repo usan `node:test`. `jsdom` 26 y
   no 29 porque 29 exige Node `^20.19.0`, justo la versión de esta máquina. `esbuild`
   ya estaba instalado como dependencia transitiva (`@vercel/analytics → nuxt → vite`);
   se declaró explícito. No toca el build de Next.
4. **Los tests encontraron dos defectos reales en `ThemeContext.tsx`**, los dos
   contradiciendo lo que los comentarios del propio archivo prometen:
   - **Un edit rechazado envenenaba el editor.** `setCustomTheme` marcaba
     `currentTheme = 'custom'` y guardaba el tema rechazado como base aunque el
     runtime lo hubiera rechazado (`UXD_THEME_STRUCTURE`), así que la UI decía un tema
     que no estaba en la página y **todos los edits siguientes se apilaban sobre el
     rechazado y también se rechazaban** hasta cambiar de tema. `switchTheme` sí lo
     hacía bien ("apply first, reflect in React only once it really landed"). Ahora el
     commit de React comprueba el resultado de la aplicación.
   - **Dos ediciones independientes en el mismo frame perdían la primera.** Cada
     edición se construía sobre `activeThemeData`, que sólo se actualiza al commitear el
     frame, así que ambas partían del mismo tema viejo y la fusión del scheduler dejaba
     el valor viejo del primer edit. Ahora se construye sobre el edit pendiente si lo
     hay.
   - **Sobre el alcance:** esta ficha excluye cambios de comportamiento del playground.
     Se arreglaron igualmente porque el test que la ficha exige ("un tema rechazado no
     reemplaza el aplicado") no puede pasar si el defecto sigue, y el segundo está en las
     mismas líneas y con el mismo síntoma de estado obsoleto. Cada arreglo son unas
     pocas líneas y cada uno tiene su control negativo. Se pueden separar si se prefiere.
   - Una primera exploración sugería un tercer defecto (ediciones en frames distintos
     también perdidas). **Era un artefacto de mi propio helper**: reutilizar el mismo
     documento tras `resetTheme` rompe los montajes siguientes. El estado del runtime
     es por documento, y por eso cada escenario instala un jsdom nuevo.
5. **Un control negativo detectó un test débil.** La primera versión de `switchTheme`
   buscaba el hex del color primario de `green` en todo el CSS; con la mutación
   "green aplica el tema purple" seguía pasando, porque ese hex aparece también en el
   CSS de `purple` bajo otro rol. Se fortaleció para comprobar la declaración exacta
   de `--uxdsl__palette__primary-main`.

## Fuera de alcance

- Migrar `BreakpointsProvider` fuera del adaptador legacy de breakpoints — eso
  exige recompilar y es exactamente la capacidad que `applyTheme` rechaza a
  propósito (MIG-B6-30, límite (4)); no forma parte de esta limpieza.
- Cualquier cambio visual o de comportamiento del playground — esta ficha es
  limpieza y cobertura de tests, no una feature.

## Pruebas

- Build de producción del playground sigue en verde después de borrar los dos
  archivos muertos (control negativo de que de verdad no los usa nadie).
- `audit-themes.mjs` corre sin error y produce la salida que su propósito
  declarado espera.
- Los tests nuevos de `ThemeContext.tsx` fallan contra una versión del
  componente con un bug introducido deliberadamente (por ejemplo, revertir el
  fix de la doble sección `case 'purple'` que MIG-B6-30 ya corrigió) y pasan
  con el código actual — así se confirma que el arnés realmente prueba algo.

## Documentación

- `packages/playground-nextjs/README.md` (si existe) o un comentario en
  `package.json`: cómo correr los tests de componente nuevos.

## Criterios de aceptación

- [x] Los dos archivos muertos ya no existen; el build sigue pasando (35/35).
- [x] `audit-themes.mjs` corre sin `SyntaxError`, desde cualquier directorio, y su
      salida ya no afirma más de lo que comprueba. **Con reserva:** "hace lo que su
      nombre promete" no se cumple en sentido fuerte — es una comprobación estrecha de
      pares `main`/`contrast`, no la puerta de accesibilidad. Ahora lo dice y da el
      recuento del gate real; sustituir su lógica por el motor compartido queda como
      seguimiento.
- [x] `ThemeContext.tsx` tiene tests de componente reales (11 escenarios) con 6
      controles negativos que confirman que detectan una regresión real, dos de ellos
      el código previo a los arreglos de esta ficha.

## Verificación

```bash
npm --prefix packages/playground-nextjs run build
node packages/playground-nextjs/scripts/audit-themes.mjs
npm --prefix packages/playground-nextjs test   # una vez exista el script
```

## Entrega

`chore(FEAT-009): MIG-B7-09 - remove dead playground files, fix audit-themes.mjs, add a component test harness`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente** en
`feat/mig-b7-09-playground-cleanup`. Integración a `main` pendiente.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `dcd8a26` (`main` tras el PR #10). Entrega: `dfa464b` en `feat/mig-b7-09-playground-cleanup`. PR: pendiente de mergear; el SHA se fijó en un commit posterior, mismo patrón que MIG-B6-21 |
| Reproducción antes del cambio | 2026-09-24: `grep` sobre el paquete y el repo (sólo las definiciones de los dos archivos); `node scripts/audit-themes.mjs` → `SyntaxError: Unexpected token 'const'` en la línea 106. Comparación del veredicto: el script decía PASSED mientras `checkThemeContrast` da 123/142/123/124 pares fallando para los mismos cuatro temas. Con el arnés, los dos defectos de `ThemeContext` se observaron antes de arreglarlos: tras un edit rechazado `currentTheme` pasaba a `custom` y el siguiente edit válido no se aplicaba; dos ediciones independientes en un frame dejaban `primary` ausente y `secondary` presente |
| Criterio → regresión | Archivos muertos → `npm run build` del playground (35/35) + `tsc --noEmit`. Script → `scripts/test-audit-themes.cjs` (3 tests: parsea y el `+` original reproduce el `SyntaxError` exacto; audita los 4 temas y sale 0 desde el paquete y desde la raíz; el aviso del gate coincide con `checkThemeContrast`). Componente → `scripts/test-theme-context.cjs` (11 escenarios: inicialización, retiro sólo de lo retirado, `switchTheme`, edit custom, capas y `replace`, dos ediciones en un frame, edit abandonado, edit rechazado, tema inválido, modo oscuro, guardia de `useTheme`) y 6 controles negativos |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, React 18.3.1, jsdom 26.1.0, `@testing-library/react` 16.3.3. `npm --prefix packages/playground-nextjs test` → 2 + 8 + 17 + 3 = **30/30**. `node packages/playground-nextjs/scripts/audit-themes.mjs` (desde la raíz) → exit 0. `npm --prefix packages/playground-nextjs run build` → exit 0, 35/35 páginas. `npm test` (raíz, ahora incluye los tests del playground) → exit 0, **749 ok / 0 not ok** (719 + 30) |
| Resultado después / control negativo | Los 6 controles: revertir el gate del commit de React → falla `refusedEditKeepsTheAppliedTheme`; base sin lo pendiente → falla `independentEditsInOneFrame`; `green` aplica `purple` (el bug de la doble sección `case` de MIG-B6-30) → falla `switchTheme`; `switchTheme` sin `scheduler.cancel()` → falla `abandonedEditNeverLands`; sin `clearRuntimeInlineTokens()` y sin `retireOldManagedElements()` → falla `initializationRemovesOnlyWhatItRetired`. Cada mutación además **debe cambiar el código** (el cargador lanza si la sustitución ya no coincide), así que un control no puede pasar en vacío |
| Cambios visuales o API / migración | Sin cambio visual. **Cambio de comportamiento en `ThemeContext.tsx`** (dos arreglos, ver arriba): tras un edit rechazado la UI ya no cambia a `custom`, y dos ediciones independientes en un frame ya no pierden la primera |
| README / CHANGELOG / migration | `packages/playground-nextjs/README.md` (nuevo: cómo correr los tests, cómo funciona el arnés, qué es y qué no es `theme:audit`). El playground es privado: sin CHANGELOG ni migración |
| AGENTS / guías / arquitectura | No aplica |
| Límites y seguimiento | (1) **`audit-themes.mjs` sigue duplicando lógica del motor** (`parseResponsive`, `parsePx`, su propia luminancia): `AGENTS.md` pide no añadir parsers propios. Reemplazarla por `checkThemeContrast` la volvería FAIL con los fallos conocidos, así que es una decisión aparte; anotado en MIG-B7-17. (2) **Las dos correcciones de `ThemeContext` no tienen prueba en navegador real**; los tests corren en jsdom con `requestAnimationFrame` de jsdom. La Fase E de MIG-B7-17 debe recorrer el editor de temas. (3) El arnés carga un componente a la vez y no cubre componentes que dependan de Next (`next/navigation`, etc.). (4) `package-lock.json` del playground: se regeneró al añadir dependencias; su diff incluye lo que ya cambiaba por la publicación de beta.6 (versiones de los paquetes locales) y la retirada de algunas marcas `peer`. (5) `BreakpointsProvider` sigue en el adaptador legacy: fuera de alcance, como decía la ficha |
