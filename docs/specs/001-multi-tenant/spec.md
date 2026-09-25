# Spec 001 — Varias agencias independientes en el mismo software

**Estado:** completada (2026-09-12) · **Rama:** `feat-bayrol` · **Sigue en:** [`002-estabilizacion-multi-tenant`](../002-estabilizacion-multi-tenant/spec.md) · **Decisiones:** [`docs/decisions/multi-tenant-agencias-independientes.md`](../../decisions/multi-tenant-agencias-independientes.md)

Este documento dice **qué** tiene que pasar y **cómo se comprueba**. El *cómo* técnico
está en `plan.md`; el reparto en tareas, en `tasks.md`.

## Problema

El software sirve hoy a una sola agencia. Para venderlo a agencias distintas —clientes
independientes, sin relación entre ellas— falta todo lo que separa los datos de una de
los de otra. No hay ninguna noción de empresa en las 47 tablas, y cuatro índices únicos
globales impiden siquiera que convivan dos: dos agencias no podrían tener el mismo cliente
(`personas.documento`), ni su propio método de pago "Efectivo", ni —lo más grave— su
propia matriz de permisos, porque los roles son globales y cambiar lo que puede hacer un
asesor lo cambiaría en todas.

## Qué será posible al terminar

1. El superadmin da de alta una agencia con su nombre, su logo y sus colores, y esa
   agencia entra y trabaja el mismo día.
2. Ningún usuario de una agencia ve un solo registro de otra, ni por listado, ni por URL
   directa, ni por un descuido del código.
3. Cada agencia decide qué puede hacer cada rol suyo sin afectar a las demás.
4. El superadmin entra en una agencia para dar soporte, y esa entrada queda registrada y
   caduca sola.
5. Ninguna agencia puede deducir cuánto vende otra a partir de lo que ve.

## Criterios de aceptación

Cada uno es comprobable y debe seguir siéndolo en cada despliegue.

| # | Criterio | Cómo se comprueba |
|---|---|---|
| A1 | Un usuario de la empresa 1 no obtiene datos de la 2 ni aunque la consulta olvide filtrar | Con el rol de aplicación y la empresa 1 fijada, `SELECT count(*) FROM ventas` no cuenta las de la 2 |
| A2 | La barrera está en la base, no en el código | La misma consulta cruda, sin `WHERE empresa_id`, devuelve solo lo del inquilino |
| A3 | Un id de otra empresa responde "no existe", no "no puedes" | `GET /sales/:id` de otra empresa: 404. Editarla: 403 |
| A4 | Los números de venta que ve cada agencia empiezan en 1 y no tienen huecos | Dos agencias vendiendo a la vez: las dos numeradas desde 1 |
| A5 | Una venta que falla a mitad no deja nada escrito | Forzar un fallo en la creación de una venta con varios productos: cero filas |
| A6 | Cada agencia tiene su matriz de permisos | Cambiar un permiso en la empresa 1 no altera el de la 2 |
| A7 | El superadmin no ve datos sin entrar, y al entrar queda registrado | Sin suplantar: no ve ventas. Suplantando: las ve, y hay fila con motivo y hora |
| A8 | Una agencia suspendida no deja entrar a nadie | Login de cualquiera de sus usuarios: rechazado |
| A9 | Los ficheros subidos no se leen sin permiso | La URL de un voucher sin sesión: 401. Con sesión de otra empresa: 403 |
| A10 | La marca es la de la empresa en la que estás | Dos empresas con logo, nombre y colores distintos, en claro y en oscuro |
| A11 | Un correo sale con la marca de su agencia | Correo de prueba de cada empresa, con su remitente |
| A12 | Lo que ya funcionaba sigue funcionando | Los 23 endpoints de lectura en 200 y las ventas con sus importes intactos |

## Fuera de alcance

- Facturación, planes y límites por empresa.
- Dominio propio por agencia (queda el slug preparado).
- Un usuario en dos agencias a la vez.
- Roles a medida: cada empresa recibe los cuatro conocidos, con su matriz editable.
- Exportar o borrar los datos de una agencia que se va. Solo se implementa suspender.
- Unificar los cuatro nombres de marca que conviven en el repo.

## Riesgo principal

Que la barrera parezca puesta y no lo esté. Es el único fallo que anula el trabajo
entero y no avisa: las políticas se crean sin error, se aplican sin error y no filtran
nada si el rol de la conexión las ignora. Por eso A1 es una prueba automática que corre
en cada despliegue, y no una comprobación de una vez.
