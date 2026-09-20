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
  - después de `padding: ` sí;
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

- [ ] La gramática es válida, generada y probada en CI.
- [ ] La custom data es generada y correcta.
- [ ] El completado no se dispara con espacios y respeta el contexto.
- [ ] No hay `.vsix` en el repositorio y el empaquetado corre en CI.
- [ ] La extensión `0.1.0` está publicada, o el release declara por qué no.

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
