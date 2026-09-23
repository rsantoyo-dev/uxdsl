# MIG-B7-04 — CI real: tests, gate, adaptadores, navegador, VSIX

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P0 · M |
| Cierra | R-04, R-05 |
| Depende de | — |
| Bloquea | MIG-B7-05 (VSIX validado en CI antes de publicarlo), MIG-B7-11 |
| Archivos | Nuevo `.github/workflows/*.yml`, `package.json` raíz (si hace falta algún script agregador nuevo) |

## Por qué

MIG-B6-12, "Límites y seguimiento" (5):

> **CI real no se añadió** (paso 5 de la ficha: jobs, matriz de Node y
> bundlers). Los comandos existen y están documentados, pero no hay workflow
> que los ejecute; queda como seguimiento y no se presenta como hecho.

MIG-B6-26, criterios de aceptación sin marcar:

> La gramática es válida, generada y probada en CI. (válida, generada y
> probada con el motor Oniguruma real — no hay CI en este repositorio)
> No hay `.vsix` en el repositorio y el empaquetado corre en CI. (el
> empaquetado corre y se verifica localmente — no hay CI en este repositorio)

No hay ningún archivo bajo `.github/workflows/` en el repo (confirmado el
2026-09-22). Todo lo que sigue existe y pasa localmente; falta que algo lo
ejecute en cada push/PR.

## Resultado esperado

Un PR a `main` o a una rama de feature dispara, sin intervención manual:

1. Suite completa (`npm test`) en al menos una versión de Node soportada.
2. El gate de release (`npm run verify:beta6` o su sucesor de MIG-B7-11) desde
   tarballs reales.
3. Los dos adaptadores (`fixtures/vite-adapter`, `fixtures/webpack-adapter`).
4. El job de navegador (`verify:cssmodules-build`) con Chrome disponible, como
   job separado (ya es la convención de esta ficha y de MIG-B6-12).
5. Empaquetado y validación del `.vsix` de `uxdsl-vscode` (gramática JSON
   válida con el motor Oniguruma real, custom data generada, completado).
6. Matriz de versiones: al menos la mínima de Node soportada y una reciente;
   documentar cuáles son, no inventar un rango sin probarlo.

## Implementación

1. **Inventariar antes de escribir YAML.** Listar cada comando que hoy se
   ejecuta manualmente en esta sesión (ver "Comandos de verificación" de
   FEAT-008 y de MIG-B6-12) y decidir en qué job va cada uno — no duplicar
   `npm test` dentro de cada job si un job "base" ya lo cubre.
2. **Job `test`**: `npm test` sobre la matriz de Node. Cachear `node_modules`
   por paquete (hay varios `package-lock.json`, uno por paquete más el raíz).
3. **Job `gate`**: `npm run verify:beta6` (o el comando que MIG-B7-11 termine
   dejando). Depende de `test` sólo si comparten instalación de dependencias;
   si no, puede correr en paralelo.
4. **Job `adapters`**: los dos fixtures de adaptador. Pueden ir en paralelo con
   `gate`.
5. **Job `browser`**: instalar Chrome (o usar una imagen que ya lo traiga —
   verificar qué ofrece el runner de CI elegido) y exportar
   `UXDSL_CHROME_PATH` antes de `verify:cssmodules-build`. Job separado a
   propósito, como ya pide MIG-B6-12: un entorno sin Chrome no debe bloquear
   los demás jobs.
6. **Job `vscode`**: `npm --prefix packages/uxdsl-vscode run compile`,
   `node scripts/generate-language-artifacts.js --check`, empaquetar el VSIX
   (revisar qué comando usa hoy la verificación local de MIG-B6-26 y
   reutilizarlo, no inventar uno nuevo) y validar la gramática con el motor
   Oniguruma real — no basta con `JSON.parse`, según la propia lección de
   N-05 (una gramática JSON válida sintácticamente puede seguir sin cargar en
   el motor real de resaltado).
7. **Matriz de Node**: documentar la mínima probada hoy y agregar `engines` a
   los `package.json` relevantes si no existe (verificado: no existe hoy en
   el raíz). No inventar un rango — probar contra lo que realmente se declare.
8. Fallo en cualquier job bloquea el merge (branch protection), pero eso es
   configuración del repositorio en GitHub, fuera de lo que un commit puede
   expresar — dejarlo anotado como paso manual del dueño en la entrega.

## Fuera de alcance

- Publicar nada automáticamente desde CI (npm publish, dist-tags, VSIX a
  Marketplace) — sigue siendo acción explícita del dueño, ver MIG-B7-05.
- Notificaciones, badges de README, o integración con servicios externos más
  allá de GitHub Actions.
- Migrar el runner de tests (`node --test`) a otro framework.

## Pruebas

- Un PR de prueba (en una rama descartable) que efectivamente dispare los
  workflows y los deje en verde, con el link a la corrida real como evidencia
  — no basta con que el YAML "se vea correcto".
- Control negativo: introducir un fallo deliberado (por ejemplo, revertir un
  fix ya cerrado de FEAT-008) en esa misma rama descartable y confirmar que el
  job correspondiente falla en rojo, no en verde.

## Documentación

- `README.md` raíz: sección o badge de CI, con qué cubre y qué no (navegador,
  VSIX y matriz de Node, explícitamente).
- Este mismo directorio: si `MIG-B7-11` termina definiendo un comando nuevo
  (`verify:rc1` u otro), esta ficha se actualiza para apuntar a él en vez de
  a `verify:beta6`.

## Criterios de aceptación

- [ ] Un push a una rama de feature dispara los 6 jobs descritos.
- [ ] El job de navegador corre en su propio job, con Chrome declarado.
- [ ] El VSIX se valida con el motor Oniguruma real, no sólo `JSON.parse`.
- [ ] La matriz de Node está documentada y probada, no inventada.
- [ ] Un fallo deliberado en cada job produce rojo, no verde (control negativo).

## Verificación

```bash
# Cada comando exactamente como lo ejecutaría el job correspondiente
npm test
npm run verify:beta6
node fixtures/vite-adapter/run.js && node fixtures/webpack-adapter/run.js
UXDSL_CHROME_PATH=/ruta/a/chrome npm run verify:cssmodules-build
npm --prefix packages/uxdsl-vscode run compile
```

## Entrega

`ci(FEAT-009): MIG-B7-04 - add GitHub Actions workflows for tests, gate, adapters, browser and VSIX`

## Registro de implementación y evidencia

Estado de esta revisión documental: **Pendiente de implementación/verificación**.

| Campo | Evidencia |
| --- | --- |
| SHA base / entrega / PR | Pendiente |
| Reproducción antes del cambio | `find . -iname "*.yml" -not -path "*/node_modules/*"` → sin resultados, verificado 2026-09-22 |
| Criterio → regresión | Pendiente |
| Comandos y entorno | Pendiente |
| Resultado después / control negativo | Pendiente |
| Cambios visuales o API / migración | No aplica — sólo infraestructura de CI |
| README / CHANGELOG / migration | Pendiente |
| AGENTS / guías / arquitectura | Pendiente |
| Límites y seguimiento | Pendiente |
