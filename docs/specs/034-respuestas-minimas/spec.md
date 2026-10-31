# Spec 034 — Respuestas mínimas: una escritura devuelve lo que se pidió

**Estado:** en ejecución · **Rama:** `feat-bayrol` · **Toca la base compartida:** no · **Origen:** pedido del
usuario al revisar la 033 (2026-10-30): "no puede mandar como respuesta toda la info, hay que mandar solo la info
solicitada" · **Relacionadas:** [`033`](../033-revision-de-la-rama/tasks.md) T17 (el precedente: responsables)

## Por qué

Hoy casi todo `POST`/`PUT`/`PATCH` responde la ficha entera del recurso, con datos personales (documento, teléfono,
correo, fecha de nacimiento) y datos internos (deuda, creador, totales) que quien escribió no pidió. Cada campo de más
es algo que puede quedar en la caché del navegador, en un log o en la pestaña de red de un equipo compartido.

## Regla

1. **Editar** (`PUT`/`PATCH`) responde `{ id, ...los campos que se mandaron }`, con su valor ya guardado y
   normalizado. Nada más.
2. **Cambiar un estado** responde `{ id, status }` (o el nombre del campo de estado del recurso).
3. **Crear** (`POST`) responde el `id`, el `numero` visible y los campos que se mandaron; lo que el servidor calcula y
   la pantalla necesita para pintar la fila (un total, un estado inicial) se nombra uno a uno en la spec de cada
   recurso, nunca "la ficha".
4. **Nunca** viajan en una respuesta de escritura: contraseñas o sus hashes, tokens que no sean el del login, ids de
   otra agencia, `empresa_id`, ni datos de la persona que el formulario no tocó.
5. La pantalla mezcla la respuesta con la fila que ya tiene (`{ ...fila, ...respuesta }`), como `DataContext`
   hace desde la 033 con responsables.

## Cómo se comprueba

Por recurso, una prueba por la API (en la suite que ya cubre ese módulo) que compara las **claves** de la respuesta
con la lista esperada, como `aislamiento-api` con responsables (033 T17). Y `tsc` en verde con los tipos de la API
ajustados (`Partial<…> & { id }`).

## Alcance

Las escrituras de: usuarios, clientes, comisionistas, configuración (catálogos), agencias (superadmin), perfil de la
empresa, cotizaciones, ventas (cabecera, pagos, voucher de producto), vuelos/check-in y roles. Responsables ya está
hecho (033).

## Fuera de alcance

- Las lecturas (`GET`): devuelven lo que la pantalla muestra; recortarlas es otra conversación (qué campo ve cada rol).
- `POST /sales`: ya responde lo justo para subir los vouchers (`products: [{ category, index, detalleId }]`); se revisa,
  pero no se rehace.
- El login: su respuesta (token y usuario) es la sesión.
