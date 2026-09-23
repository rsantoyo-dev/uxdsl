# MIG-B7-05 — Publicación de la extensión VS Code

| Campo | Valor |
| --- | --- |
| Feature | [FEAT-009](../FEAT-009-path-to-0.5.0.md) · camino a `0.5.0-rc.1` |
| Prioridad · Tamaño | P1 · S |
| Cierra | R-06 |
| Depende de | MIG-B7-04 (el VSIX se valida en CI antes de publicarlo) |
| Bloquea | — |
| Archivos | Ninguno de código — esta ficha es una acción del dueño, no una implementación |

## Por qué

MIG-B6-26, criterio de aceptación 4: "La extensión `0.1.0` está publicada, o
el release declara por qué no." MIG-B6-12 la lista explícitamente en la
categoría `external` de su release record: publicar la extensión requiere
cuentas del dueño en Visual Studio Marketplace y/o Open VSX, que ningún agente
puede crear ni usar por su cuenta.

## Qué hace falta

1. Cuenta de publisher en [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
   y, opcionalmente, en [Open VSX](https://open-vsx.org/).
2. Un Personal Access Token con permiso de "Marketplace: Manage" (Azure DevOps),
   guardado como secreto — nunca en el repositorio ni en un commit.
3. `vsce publish` (o `ovsx publish` para Open VSX) con ese token, apuntando al
   `.vsix` ya validado por MIG-B7-04 en CI — nunca un `.vsix` compilado a mano
   fuera de ese pipeline, para que lo publicado sea exactamente lo que CI probó.

## Qué no hace esta ficha

- No genera el token ni crea la cuenta — eso es del dueño, fuera de cualquier
  entorno de agente.
- No agrega el paso de publicación automática a CI (MIG-B7-04): ese workflow
  valida y empaqueta, no publica, siguiendo la misma regla de "sin publicar
  sin aprobación explícita" que rige todo el resto del plan.

## Criterios de aceptación

- [ ] La extensión `uxdsl-vscode@0.1.0` está publicada en Marketplace, o el
      release de `0.5.0-rc.1` declara explícitamente por qué no, con la causa
      real (por ejemplo, "cuenta pendiente de creación").
- [ ] Si se publica, el VSIX publicado corresponde exactamente al que MIG-B7-04
      validó en CI — mismo hash, registrado en el release record.

## Entrega

No aplica un commit de código. El release record de MIG-B7-11 registra el
resultado (publicado / no publicado y por qué).

## Registro

| Campo | Evidencia |
| --- | --- |
| Estado | Pendiente — acción del dueño |
| Resultado | Pendiente |
