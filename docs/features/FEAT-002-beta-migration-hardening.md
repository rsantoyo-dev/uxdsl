# FEAT-002 — Mejoras de confiabilidad y migración de UXDSL 0.5

| Campo | Valor |
| --- | --- |
| Estado | Completada y publicada como `0.5.0-beta.1` |
| Origen | Feedback de migración de 0.3.0 a 0.5.0-beta.0; reporte externo, no reproducción del artefacto original |
| Destino del contrato | `0.5.0-beta.1`, publicado en npm con los tags `latest` y `beta` |
| Prioridad | P0: integridad y multi-entrada; P1: controles, migración e integración; P2: naming |
| Relación | [FEAT-001](./FEAT-001-unified-language-engine.md) y [contrato de motores](../architecture/unified-engine-audit.md) |

## Contexto y responsabilidades

El reporte original describe Next.js 16, una entrada de tema y cuatro paneles
CSS Module, unos 82 usos de controles/surfaces y 320 usos de Typography.
Los números proceden del reporte. La fixture disponible usa Next.js 14 con
Pages Router y el loader real en modo estricto; no afirma reproducir Next.js 16
ni los nueve fragmentos de código originales que no se proporcionaron.

Preservar roles, referencias y progresiones responsive; usar CSS nativo para
excepciones deliberadas. El namespace nuevo cambia nombres CSS, no la sintaxis
del DSL ni las responsabilidades de sus primitivas. La implementación de esta
feature se publicó como `0.5.0-beta.1`; el hardening posterior de instalación
suave está separado en [FEAT-003](./FEAT-003-beta2-smooth-install.md).

## MIG-01 — Normalización compatible de Spacing (P0)

- [x] `"1"` y `"space-1"` producen `--uxdsl__space__1`.
- [x] Ambas claves juntas se rechazan con `UXD_SPACING_COLLISION`.
- [x] El prefijo histórico reservado se elimina una sola vez; identificadores
  arbitrarios no se reinterpretan silenciosamente.
- [x] Referencias, escalas nuevas y legacy tienen pruebas de contrato.
- [x] La fixture integrada verifica las dependencias responsive en el navegador.

Responsable: normalización en `language.ts`, emisión en `foundations.ts`.
Pruebas: `spacing-normalization.test.js` y fixture integrada.

## MIG-02 — Tema único y CSS Modules (P0)

- [x] `includeTheme: true` emite el tema; `false` conserva componentes
  y valida sus referencias sin introducir los emisores globales.
- [x] Las compilaciones no comparten estado.
- [x] Una entrada global y cuatro paneles pasan por Next.js y su
  `css-loader` estricto, usando el paquete instalado desde tarball.
- [x] Control negativo: el mismo tema importado como CSS Module falla con
  `is not pure`, sin workaround que elimine `:root`.

Ruta reproducible: `npm run verify:cssmodules-build`.
Una entrada sin objeto `theme` puede usar proveedores explícitos; no se
adivinan tokens de otras compilaciones. Pasar el mismo tema efectivo es la
ruta normal para las cinco entradas.

## MIG-03 — Integridad referencial (P0)

- [x] Referencias inexistentes, dependencias transitivas y ciclos generan errores.
- [x] Diagnósticos incluyen consumidor, referencia, cadena y ubicación disponible.
- [x] Fallbacks válidos y proveedores externos explícitos tienen cobertura.
- [x] Componentes validan contra tema declarado sin emitirlo.
- [x] La validación estricta no permite dependencias obligatorias ausentes.
- [x] Density personalizada 16 se acepta cuando está definida.
- [x] Pruebas estáticas de scope/breakpoints y pruebas reales de estilos en
  Chrome complementan la validación del grafo.
- [x] PostCSS y runtime comparten el validador; el playground registra el
  último tema válido solo después de generar y aplicar su CSS correctamente.

**Contrato:** el tema efectivo debe suministrar las dependencias de todos los
presets emitidos, aunque un componente concreto no los use. No se inventa una
escala de Spacing adicional ni se desactiva la validación para ocultar faltantes.
`generateThemeCss({})` puede fallar: no es un tema completo para los defaults.

**Límite explícito:** el análisis estático reconoce `:root`, selectores
idénticos y las condiciones soportadas; no es un motor DOM/CSS general para
herencia arbitraria, capas o combinaciones de selectores. Proveedores externos
se declaran mediante `references.css` o `references.externalTokens`.
CSS del host que no es consumidor generado por DSL permanece fuera del chequeo.

Pruebas dedicadas: `test/reference-integrity.test.js`. La prueba histórica
de imports de core sigue aislando imports con validación desactivada; no se
presenta como una prueba de integridad de temas.

## MIG-04 — Dependencias de Border (P0)

- [x] `DEFAULT_BORDER_COLORS` suministra gray 300/400/500/600 bajo overrides.
- [x] Un tema completo usa `border(1..5)` sin import extra de colores.
- [x] Overrides individuales y borders externos conservan sus responsabilidades.
- [x] Entradas de componente no reintroducen globals.
- [x] PostCSS/runtime y pruebas estrictas cubren el contrato.

La dependencia de Spacing de algunos bordes sigue el contrato de MIG-03;
no se afirma que un tema vacío compile.

## MIG-05 — Overrides independientes (P1)

- [x] `@ds-surface(contained 2 radius(4) shadow(1))` separa radio y sombra del size.
- [x] La misma sintaxis funciona en Button e Input, incluyendo roles con base propia.
- [x] Argumentos repetidos e indefinidos tienen diagnóstico.
- [x] El token referenciado conserva su comportamiento responsive.
- [x] El motor exporta metadatos de argumentos; VS Code ofrece snippets
  `radius(key)` y `shadow(key)` en las tres directivas.
- [x] Los artefactos se regeneran mediante `npm run generate:language`.

La composición existente de size y base se conserva. Los overrides explícitos
de radio/sombra ganan sobre la composición; CSS posterior conserva la cascada.
Las pruebas cubren el contrato, no los nueve usos externos cuyo código no se recibió.

## MIG-06 — Migración documentada y asistida (P1)

- [x] Guía y changelog viajan dentro del paquete.
- [x] Guía de cinco entradas, dependencias y versión objetivo explícita.
- [x] Codemod de size con preview, idempotencia y barreras de cascada
  (important, esquinas, all, múltiples mixins y bloques anidados).
- [x] Codemod de namespace con diff por línea, modo write y pruebas.
- [x] Roles tipográficos personalizados y nombres externos ambiguos requieren
  mapeo explícito; el preview es obligatorio en el procedimiento documentado.

Ver [guía](../../packages/postcss-uxdsl/docs/migration.md) y
[changelog](../../packages/postcss-uxdsl/CHANGELOG.md). Ejecutar el codemod
solo sobre archivos seleccionados cuyos prefijos históricos pertenezcan a UXDSL.
Un mapeo identidad protege nombres del host que coincidan con esos prefijos.
Las claves de `theme.typography` plano se revisan manualmente.

## MIG-07 — Consumidor desde tarball y navegador (P1)

- [x] Se construye el paquete antes de empaquetar, para evitar dist obsoleto.
- [x] Se instala el tarball de `postcss-uxdsl` y compilan cinco entradas estrictas.
- [x] La fixture Next.js consume esa misma instalación, no el fuente del monorepo.
- [x] Control negativo real de CSS Modules.
- [x] Paridad de variables PostCSS/runtime en modo estricto y determinismo.
- [x] Seis regresiones de comparación de cascada forman parte de `npm test`,
  incluyendo media queries min-width superpuestas.
- [x] Chrome comprueba padding, radio, borde y colores en light/dark en
  479/480/481, 767/768/769, 1023/1024/1025 y 1279/1280/1281px.
- [x] El artefacto contiene documentación, exports y dependencias necesarias.

Comando integrado: `npm run verify:cssmodules-build`. Requiere Chrome
instalado y `UXDSL_CHROME_PATH` si no está en la ruta macOS predeterminada.
La prueba computada usa CSS del tarball en un documento controlado;
no es una auditoría visual de todas las pantallas de la aplicación.
Solo se empaqueta `postcss-uxdsl`, el paquete utilizado por esta fixture;
CLI/Vite y un consumidor App Router/Next.js 16 requieren fixtures propias.

## MIG-08 — Namespace único y migración explícita (P2)

- [x] Contrato compartido: `--uxdsl__<familia>__<identificador>`.
- [x] Definiciones y referencias usan los helpers de naming.
- [x] Registro de colisiones y separación de identificadores.
- [x] Decisión: migración explícita en 0.5.0-beta.1, sin aliases automáticos.
- [x] Guía y codemod cubren referencias, definiciones, JSON y externalTokens.
- [x] Pruebas de idempotencia, overrides y preservación explícita del host.
- [x] Consumidor empaquetado y runtime usan el contrato nuevo.

| Anterior | Objetivo |
| --- | --- |
| `--ds__palette__primary-main` | `--uxdsl__palette__primary-main` |
| `--ds__color__gray-300` | `--uxdsl__color__gray-300` |
| `--space-1` | `--uxdsl__space__1` |
| `--density-2` | `--uxdsl__density__2` |
| `--radius-2` | `--uxdsl__radius__2` |
| `--border-1` | `--uxdsl__border__1` |
| `--shadow-1` | `--uxdsl__shadow__1` |
| `--surface-flat-padding` | `--uxdsl__surface__flat-padding` |
| `--button-contained-hover-bg` | `--uxdsl__button__contained-hover-bg` |
| `--input-outlined-focus-border` | `--uxdsl__input__outlined-focus-border` |
| `--h1-size` | `--uxdsl__typography__h1-size` |
| `--font-ui` | `--uxdsl__font__ui` |

Nombres externos y claves de Typography plano son responsabilidad del consumidor.
No se deduce la ausencia de consumidores por la versión local. Regenerar
componentes y tema juntos; no mezclar salidas antiguas con tema nuevo.

## Verificación y release

- `npm test`: motor, core, regresiones de cascada y artefactos.
- `npm --prefix packages/uxdsl-vscode run compile`: extensión.
- `npm run verify:cssmodules-build`: tarball, Next.js y Chrome.
- El build del playground se verifica aparte cuando cambie su integración.
- Release realizado y registrado en [docs/releases/0.5.0-beta.1.md](../releases/0.5.0-beta.1.md).
- La siguiente versión beta debe seguir el gate y el alcance de FEAT-003; no
  asumir que una publicación de beta.1 completa automáticamente beta.2.
