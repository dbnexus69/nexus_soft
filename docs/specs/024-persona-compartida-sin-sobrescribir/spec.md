# Spec 024 — Un alta no sobrescribe a la persona que ya existe

**Estado:** implementada (2026-10-21), probada por la API · **Rama:** `feat-bayrol` · **No toca el esquema** ·
**Origen:** [`022` T6](../022-cierre-de-pendientes/tasks.md) (efecto heredado de la [`009`](../009-sin-tabla-personas/spec.md), archivada)

## Por qué

Hay una sola `personas` por documento y agencia (`@@unique([empresa_id, documento])`); clientes, usuarios,
comisionistas y responsables apuntan a ella. Dar de alta cualquiera de los cuatro con un documento ya registrado:

1. sobrescribía nombre, correo, teléfono, foto y fecha de nacimiento de esa persona con lo del formulario, y
2. la reactivaba (`status: 'active'`, `deleted_at: null`): crear un comisionista o un usuario con el documento de un
   cliente desactivado lo volvía a activar (el estado del cliente vive en `personas.status`).

## Qué se quiere (aprobado por el usuario, 2026-10-21)

- **Persona en uso** (`deleted_at` vacío): el alta se enlaza a ella sin cambiar sus datos ni su estado; solo se
  llenan los campos que tenga vacíos. El 201 trae `meta.aviso` ("Este documento ya estaba registrado en la agencia;
  se conservaron los datos de esa persona.") y la pantalla lo muestra.
- **Persona dada de baja** (ningún rol vivo): se revive con los datos del formulario, como antes.
- **Sin cambios:** editar los datos personales de un rol los cambia en todos (es la misma persona).

## Cómo se comprueba

`test:aislamiento-api`, bloque "Datos de personas":

| Caso | Se espera |
|---|---|
| Cliente con el documento de un usuario | 201, el cliente trae el nombre del usuario, `meta.aviso`, el usuario sin cambios |
| Comisionista con el documento de un cliente desactivado | 201 con aviso; el cliente sigue inactivo y con su nombre |
| Cliente con el documento de un usuario borrado (persona dada de baja) | 201 con los datos nuevos, sin aviso |
