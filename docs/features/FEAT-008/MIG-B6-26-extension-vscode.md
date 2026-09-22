# MIG-B6-26 — Extensión VS Code 0.1.0 confiable

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-008](../FEAT-008-beta6-reliability.md) · `0.5.0-beta.6` |
| Track | F — Editor y tipos |
| Prioridad · Tamaño | P1 · M |
| Cierra | N-05; UX-17 en parte |
| Depende de | MIG-B6-14 (lenguaje), MIG-B6-18 (pipeline), MIG-B6-29 (defaults/tonos para metadata) |
| Bloquea | MIG-B6-12 |
| Archivos | `packages/uxdsl-vscode/` (`package.json`, `src/extension.ts`, `src/generated-completions.ts`, `syntaxes/uxdsl.tmLanguage.json`, `uxdsl.custom-data.json`, `language-configuration.json`, `uxdsl-vscode-0.0.1.vsix`), `packages/postcss-uxdsl/src/language.ts` (`LANGUAGE_COMPLETIONS`), `scripts/generate-language-artifacts.js`, `.gitignore` |
| Coordinación | Dueño único de `packages/uxdsl-vscode` |

## Por qué

El editor es donde más se nota la distancia entre UXDSL y una librería de confianza.
Hoy:

- **La gramática no era JSON válido**, ni en `3ceac6e` ni en el `.vsix`
  (`Bad escaped character in JSON at position 468`), así que el resaltado no cargaba.
  El arreglo ya está integrado, pero la gramática sigue escrita a mano y sin test.
- **El `.vsix` commiteado es de diciembre de 2025** y la extensión no está publicada
  en Marketplace ni en Open VSX.
- **`uxdsl.custom-data.json` está escrito a mano y es incorrecto:**
  - usa una clave `functions` que el formato de custom data de CSS no reconoce (sólo
    existen `properties`, `atDirectives`, `pseudoClasses` y `pseudoElements`);
  - documenta `typography()` y `@ds-typography`, que no existen;
  - su ejemplo `radius(md)` lanza `UXD_EDGE_REFERENCE`.
- **El completado:**
  - se dispara con cada espacio (`' '` es carácter de disparo);
  - sugiere funciones también en selectores y comentarios;
  - en los argumentos de directivas sólo ofrece `radius` y `shadow`.
- **`language-configuration.json`:** usa pares `"{ "` (con espacio) y no declara
  comentario de línea `//`.

## Reproducción

```bash
git show 3ceac6e:packages/uxdsl-vscode/syntaxes/uxdsl.tmLanguage.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{JSON.parse(s);console.log('válido')}catch(e){console.log('INVÁLIDO:',e.message)}})"
node -e "const d=require('./packages/uxdsl-vscode/uxdsl.custom-data.json'); console.log(Object.keys(d), d.atDirectives.map(x=>x.name))"
grep -n "' '" packages/uxdsl-vscode/src/extension.ts
```

## Resultado esperado

- Gramática válida, generada desde la metadata del lenguaje y verificada en CI.
- Custom data generada: sólo `atDirectives`, con los nombres reales. Sirve para los
  `.css` que procesa `postcss-uxdsl`.
- Completado sensible al contexto, sin ruido.
- Extensión `0.1.0` empaquetada en CI y publicada por el dueño.

## Implementación

1. El arreglo de escapes de la gramática ya está integrado (commit
   `fix(uxdsl-vscode): …` en `feat/feat-008-beta6-plan`). Esta story parte de una
   gramática válida y la vuelve generada.
2. **Generar lo que hoy está escrito a mano**, extendiendo
   `generate-language-artifacts.js` (que ya genera `generated-completions.ts`):
   - en la gramática: las alternativas de las reglas `functions` y `directives`, desde
     `LANGUAGE_COMPLETIONS`;
   - `uxdsl.custom-data.json`: `{ version: 1.1, atDirectives: [...] }` con
     descripciones reales, sin `functions` y sin ejemplos inválidos;
   - `--check` cubre los dos archivos.
3. **Metadata de argumentos de directivas.** Extender `LANGUAGE_COMPLETIONS` en
   `language.ts`, derivando los valores de los motores y del tema base, sin
   escribirlos a mano:
   - roles de `@ds-surface`, `@ds-button` y `@ds-input` (de `DEFAULT_SURFACES`, los
     botones y los inputs);
   - tonos (familias con main/dark/contrast, usando el mismo predicado del motor;
     no ofrecer grupos semánticos parciales como action/divider);
   - tamaños válidos para el componente (intersección Density/Radius, no todas
     las claves numéricas de cualquiera de las dos familias).
4. **Completado** (`extension.ts`):
   - quitar `' '` de los caracteres de disparo;
   - extraer la detección de contexto a una función pura
     (`src/completion-context.ts`) para poder probarla sin la API de VS Code;
   - funciones sólo en el valor de una declaración (después de `prop:` y antes de `;`,
     fuera de comentarios y strings);
   - directivas después de `@`;
   - dentro de `@ds-*(`, roles, tonos, tamaños y overrides.
5. **`language-configuration.json`:** `"{"` en `brackets` y `autoClosingPairs`, y
   `"lineComment": "//"`.
6. **Empaquetado:**
   - eliminar `uxdsl-vscode-0.0.1.vsix` del repositorio y agregar `*.vsix` a
     `.gitignore`;
   - devDependency `@vscode/vsce` y script `package`;
   - versión `0.1.0`, con `CHANGELOG.md` propio de la extensión;
   - CI empaqueta el `.vsix` como artefacto.
   - **Publicar en Marketplace y Open VSX lo hace el dueño** con sus tokens. Si no
     ocurre, el release lo dice.

## Fuera de alcance

Completado según el tema del proyecto, diagnósticos en vivo, hover por breakpoint, ir
a la definición e IntelliSense de CSS dentro de `.uxdsl`. Van a MIG-B6-08, después
de 0.5.0. Mientras tanto, el README de la extensión documenta el trade-off de
`"files.associations": { "*.uxdsl": "scss" }`: se gana IntelliSense de SCSS y se
pierde la gramática de UXDSL.

## Pruebas

- Completado multilinea, nesting, pseudoselectores con ':', valores con strings
  escapados y argumentos de directiva; ningún token sugerido del default falla
  al compilar con el motor. Distinguir función nativa color de token.
- VSIX empaquetado: manifest, paths de gramática, activación del lenguaje y assets
  existen dentro del archivo, y extensión carga en un smoke test de host. Conectar
  compile/test/package a CI (12 integra el gate final); compilación sola no prueba
  resaltado ni publicación. Documentar la versión de VS Code usada.

- CI: `JSON.parse` más tokenización con el motor TextMate/Oniguruma que consume
  VS Code; `new RegExp` JavaScript no demuestra compatibilidad de la gramática.
  Probar funciones, directivas, strings, comentarios y URL https:// sin cortar
  contenido como comentario de línea. Fijar versiones de las dependencias de test.
- `node scripts/generate-language-artifacts.js --check` cubre la gramática y la
  custom data.
- `test/completion-context.test.js` (node --test, en el paquete de la extensión):
  - un selector, un comentario o un string no ofrecen funciones;
  - después de `padding:` sí;
  - `@ds-button(` ofrece roles;
  - `@` ofrece directivas;
  - un espacio en un selector no dispara nada.
- `npm --prefix packages/uxdsl-vscode run compile` y `package` producen el `.vsix`.

## Documentación

- `packages/uxdsl-vscode/README.md`: qué hace y qué no hace, instalación,
  `files.associations`.
- `packages/uxdsl-vscode/CHANGELOG.md`: nuevo.
- CHANGELOG de `postcss-uxdsl`: la metadata de directivas ampliada.

## Criterios de aceptación

- [ ] La gramática es válida, generada y probada en CI. **(válida, generada y
      probada con el motor Oniguruma real — no hay CI en este repositorio; ver
      "Límites y seguimiento")**
- [x] La custom data es generada y correcta.
- [x] El completado no se dispara con espacios y respeta el contexto.
- [ ] No hay `.vsix` en el repositorio y el empaquetado corre en CI. **(no hay
      `.vsix` en el repositorio; el empaquetado corre y se verifica localmente —
      no hay CI en este repositorio; ver "Límites y seguimiento")**
- [x] La extensión `0.1.0` está publicada, o el release declara por qué no.
      **(el release declara por qué no: requiere los tokens del dueño)**

## Verificación

```bash
npm run generate:language && node scripts/generate-language-artifacts.js --check
npm --prefix packages/uxdsl-vscode run compile
npm --prefix packages/uxdsl-vscode test
npm test
```

## Entrega

`feat(FEAT-008): MIG-B6-26 - vscode extension 0.1.0: valid generated grammar, context-aware completion, ci packaging`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Implementada y verificada localmente en
`feat/feat-008-beta6-plan`** (integración a `main` y wiring de CI pendientes —
ver "Límites y seguimiento").

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Base `9be6956` (2026-09-21). Entrega: `07dd397` en `feat/feat-008-beta6-plan`; PR pendiente de abrir |
| Reproducción antes del cambio | Sobre `9be6956`: `node -e "const d=require('./packages/uxdsl-vscode/uxdsl.custom-data.json'); console.log(Object.keys(d), d.atDirectives.map(x=>x.name))"` da `[ 'version', 'functions', 'atDirectives' ] [ '@theme', '@ds-surface', '@ds-button', '@ds-typography' ]` — confirma la clave `functions` inválida para el formato de CSS custom data, `@ds-typography` (no existe) y falta de `@ds-input`. `grep -n "' '" packages/uxdsl-vscode/src/extension.ts` confirma `' '` como carácter de disparo. Escrito a mano en `uxdsl.custom-data.json`: el ejemplo `radius(md)` (falla `UXD_EDGE_REFERENCE` real, verificado). 2026-09-21 |
| Criterio → regresión | "Gramática válida, generada, tokenización real" → `packages/uxdsl-vscode/test/grammar.test.js` (9 tests, usa `vscode-textmate`+`vscode-oniguruma`, el motor real de VS Code — no `new RegExp`; incluye la regresión real encontrada durante esta story: contenido dentro de un string se resaltaba como directiva/función real). "Custom data generada y correcta" → `scripts/generate-language-artifacts.js --check` cubre `uxdsl.custom-data.json`; verificado manualmente que no tiene `functions`, no tiene `@ds-typography`/`typography()`, y sí tiene `@ds-input`. "Completado sin espacio, sensible al contexto" → `packages/uxdsl-vscode/test/completion-context.test.js` (21 tests: selector/comentario/string sin funciones, `padding:` con funciones, `@ds-button(` con argumentos de esa directiva, `@` con directivas, multilínea, anidamiento, pseudo-selectores con `:`, comillas escapadas) + lectura de `extension.ts` (trigger characters ya no incluyen `' '`). "Sin `.vsix` en el repo, empaquetado real" → `git rm packages/uxdsl-vscode/uxdsl-vscode-0.0.1.vsix` + `.gitignore` (`*.vsix`) + `fixtures/vscode-extension/run.js` (6 checks sobre un `.vsix` real producido por `vsce package`, incluyendo extracción y parseo del manifest/grammar/package.json empaquetados) |
| Comandos y entorno | macOS (Darwin 25.2.0), Node v20.19.0, `@vscode/vsce` 3.9.2, `vscode-textmate` 9.3.2, `vscode-oniguruma` 2.0.1, desde el root del monorepo: `npm run generate:language && node scripts/generate-language-artifacts.js --check` (exit 0), `npm --prefix packages/uxdsl-vscode run compile` (exit 0), `npm --prefix packages/uxdsl-vscode test` (exit 0, 30/30 — 21 de completion-context + 9 de grammar), `npm test` (exit 0, todas las suites, incluye ahora `uxdsl-vscode` en la cadena), `node fixtures/vscode-extension/run.js` (PASS, 6/6, empaqueta un `.vsix` real y lo inspecciona), `npm run verify:beta2`/`verify:beta3`/`verify:beta4`/`verify:beta5` (todos PASS, confirman que el refactor de `control-engine.ts`/`language.ts` no cambió ningún comportamiento del compilador), `npm run build` en `packages/playground-nextjs` (build de producción completo, OK) |
| Resultado después / control negativo | `uxdsl.custom-data.json` regenerado: `{ version: 1.1, atDirectives: [...] }`, sin `functions`, con `@ds-input`, sin `@ds-typography`. La gramática regenerada tokeniza `xs(` como función real y `@ds-button` como directiva real bajo Oniguruma; un string que contiene literalmente `@ds-button xs(1rem)` ya NO se resalta como código real (control negativo que además reveló y corrigió un bug real de la gramática — ver "Límites y seguimiento"). El completado: un espacio en un selector no dispara nada; `padding:` ofrece funciones; `@ds-button(` ofrece roles/tonos/tamaños/overrides reales derivados de `DEFAULT_BUTTONS`/`getToneFamilies`/la intersección Density∩Radius, no una lista fija. `getToneFamilies` con el theme por defecto da exactamente `['primary', 'surface']` (verificado que `neutral`/`error` correctamente NO califican por no tener las tres claves) |
| Cambios visuales o API / migración | Cambio de comportamiento real: la gramática ya no resalta un `@ds-*` arbitrario vía wildcard (`ds-[a-zA-Z0-9-]+`) — sólo los cinco nombres reales; un directive typo'd deja de highlightearse como si fuera válido (regresión visual intencional, mejor señal que un falso positivo). El completado ya no se dispara con espacio. `uxdsl-vscode` pasa de `0.0.1` a `0.1.0`. Nueva exportación pública en `postcss-uxdsl`: `getToneFamilies` (aditiva, sin cambio de comportamiento en `control-engine.ts`, que sólo pasó a importarla en vez de tener el predicado inline — 247/247 tests de `postcss-uxdsl` siguen en verde) |
| README / CHANGELOG / migration | `packages/uxdsl-vscode/README.md` (reescrito: features reales, gaps conocidos, trade-off documentado de `files.associations: { "*.uxdsl": "scss" }`, instrucciones de desarrollo/empaquetado); `packages/uxdsl-vscode/CHANGELOG.md` (nuevo); `packages/postcss-uxdsl/CHANGELOG.md` (entrada MIG-B6-26 documentando `getToneFamilies`) |
| AGENTS / guías / arquitectura | No aplica: cambio interno de tooling de editor (gramática/completado/empaquetado de `uxdsl-vscode`) y una extracción de utilidad ya existente (`getToneFamilies`) sin cambio de contrato del compilador; no toca ninguna primitiva de diseño ni el contrato de `AGENTS.md` de este repo |
| Límites y seguimiento | (1) **No existe ningún workflow de CI en este repositorio** (`.github/workflows/` no existe, ni ningún otro archivo de CI) — los criterios que piden "probado/empaquetado en CI" se verificaron localmente (`npm test`, `node fixtures/vscode-extension/run.js`) pero NO están conectados a un pipeline real; conectar eso es una story de infraestructura aparte (MIG-B6-12 aparece como bloqueador final en el índice de esta feature, consistente con esa lectura). Marcado explícitamente sin tildar en los criterios de aceptación de arriba, no asumido como cumplido. (2) **Publicación a Marketplace/Open VSX no se hizo** — corresponde al dueño con sus propios tokens, declarado en el CHANGELOG de la extensión. (3) Durante esta story se encontró y corrigió un bug real de la gramática (no mencionado explícitamente en la reproducción original de la story): el contenido dentro de un string literal (`content: "@ds-button xs(1rem)"`) se resaltaba como una directiva/función real, porque la gramática no tenía ninguna regla de `#strings` — corregido agregando una con prioridad antes de `#directives`/`#functions`, descubierto por el propio test de tokenización real con Oniguruma que esta story agrega. (4) No se agregó un archivo `LICENSE`/`LICENSE.md` — `vsce package` avisa de su ausencia (warning, no error); es un gap preexistente de TODO el monorepo (ningún paquete tiene LICENSE propio pese a declarar `"license": "MIT"`), fuera del alcance acotado de esta story sobre `uxdsl-vscode` específicamente — no se inventó un texto de licencia/copyright como efecto secundario. (5) No se lanzó un Extension Development Host real ni `@vscode/test-electron` — verificado en su lugar con el motor Oniguruma real (gramática) y una función pura unit-testeada (completado), ambos corriendo en Node plano, sin descargar un binario de VS Code; documentado explícitamente como el nivel de prueba alcanzado, no como equivalente a un smoke test de host real. (6) El completado de roles/tonos/tamaños usa el tema **por defecto** del compilador, no el tema real de un proyecto — declarado como gap conocido en el README de la extensión, ítem explícitamente fuera de alcance de esta story (ver "Fuera de alcance" arriba). (7) **Esta story se implementó sin esperar a MIG-B6-29** (listada arriba como dependencia, "defaults/tonos para metadata"), por instrucción explícita de secuenciar 20→23→24→26→28 en este repositorio. Esto es seguro porque `getToneFamilies`/`directiveRoles`/`sizeKeys` en `scripts/generate-language-artifacts.js` se derivan del `DEFAULT_THEME` **actual** de `postcss-uxdsl` (hoy: tonos `['primary','surface']`), no de un valor hardcodeado ni copiado a mano; cuando MIG-B6-29 amplíe o cambie esos defaults, el mismo generador los recogerá automáticamente en la siguiente ejecución de `npm run generate:language`, sin requerir ningún cambio adicional en esta story. Es la misma independencia de orden ya documentada para MIG-B6-20 (Vite/Webpack antes de MIG-B6-29) y MIG-B6-24 en este mismo plan. |

Al cerrar, reemplazar «Pendiente» por evidencia o «No aplica» justificado. Si cambia
un contrato del plan, actualizar también índice/dependencias y las fichas consumidoras.
