# Spec 026 — El rol freelancer: lo suyo, su ganancia y sus responsables

**Estado:** diseño aprobado (2026-10-21), pendiente de permiso para desarrollar · **Rama:** `feat-bayrol` · **Toca la base
compartida** (columna nueva en `responsables` y migración de datos en `permisos_rol`) · **Relacionadas:**
[`020`](../020-alcance-de-editar-y-borrar/spec.md) (alcance de editar y borrar), [`025`](../025-auditoria-de-permisos/spec.md) (H2: el freelancer no lista usuarios)

## Por qué

El freelancer es un vendedor externo. Hoy es casi un asesor: no se distingue en nada salvo en no ver la lista de
usuarios (025), no ve lo que gana y no puede manejar responsables. El usuario quiere ver lo que gana, limitar lo que ve
y separarlo bien del asesor.

## Qué se quiere (decidido con el usuario, 2026-10-21)

El admin le asigna los permisos en el panel de roles, como a un asesor. **Por defecto** el freelancer solo ve lo suyo:
sus ventas, su ganancia en el dashboard, sus clientes, sus responsables, sus cotizaciones y sus vuelos.

1. **Ganancia en el dashboard.** "Su ganancia" es la TA de sus ventas: la suma de `ta_total` (sin IVA) de las ventas no
   anuladas del periodo. Indicador nuevo "Ganancia (TA)" en el dashboard de todos los roles, con el alcance del dashboard
   (con `own`, la suya; el admin, la de la agencia). No incluye comisiones.
2. **Responsables con dueño.** "Sus responsables" son los que él creó. `responsables.creado_por_id` (nuevo); el módulo
   pasa a tener alcance en ver, editar y borrar, como clientes. Los existentes quedan sin dueño (solo los ve quien tiene
   `all`). Suplantando, el creador se guarda vacío (002 T19).
3. **Valores por defecto del freelancer:** responsables `{ view: 'own', create: true, edit: 'own', delete: 'none' }`; el
   resto como está (ventas, cotizaciones, clientes, vuelos y dashboard `own`; sin usuarios, comisionistas ni Gestión
   Interna). El asesor no cambia.
4. **Agencias existentes: se migran.** Una migración de datos pone el freelancer de todas las agencias en los nuevos
   valores (`users.view` false y los cuatro de responsables), aunque un admin los hubiera cambiado (decisión del usuario).

## Cómo se comprueba

| Caso | Se espera |
|---|---|
| Freelancer crea un responsable | 201; lo ve (200) y lo edita (200) |
| Freelancer y el responsable del admin | GET 404, PUT 403, no aparece en su lista |
| Admin | ve y edita los dos |
| Freelancer borra su responsable | 403 (`delete: 'none'`) |
| Dashboard del freelancer | `totalProfit` = TA de sus ventas; menor que la del admin |
| Superadmin suplantando crea un responsable | 201 con `creado_por_id` vacío |
| `permisos_rol` tras la migración | en cada agencia, el freelancer con `users.view` false y responsables `own/true/own/none` |

Más `check:prisma`, `tsc`, `prisma migrate status` y los advisors de Supabase sin avisos nuevos.

## Fuera de alcance

- Comisiones o pagos propios del freelancer (su ganancia es la TA; no hay modelo de comisión de usuarios).
- Ocultar costos de proveedor u otros campos al freelancer.
