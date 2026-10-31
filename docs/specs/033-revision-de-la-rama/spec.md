# Spec 033 — Correcciones de la revisión de `feat-bayrol` contra `main`

**Estado:** completada (2026-10-30), probada por la API y confirmada en pantalla por el usuario · **Rama:** `feat-bayrol` · **Toca la base compartida:** no (ninguna migración) ·
**Origen:** revisión de código del 2026-10-30 (12 commits, unos 54 archivos de código) · **Relacionadas:**
[`029`](../029-limite-de-usuarios-por-plan/spec.md) (límite de usuarios), [`031`](../031-adjuntos-en-storage/spec.md)
(adjuntos en Storage), [`032`](../032-despliegue-vercel-render/spec.md) (despliegue), [`026`](../026-rol-freelancer/spec.md)
(responsables del freelancer)

## Por qué

La revisión encontró un hueco de licenciamiento (el límite de usuarios se saltaba) y una serie de problemas menores
en lo que llegó con las specs 026 a 032. Nada de esto cambia el esquema.

## Qué tiene que pasar y cómo se comprueba

| # | Gravedad | Qué | Cómo se comprueba |
|---|---|---|---|
| 1 | Alta | Reactivar a un usuario inactivo (`PUT /users/:id` con `status: 'active'`) respeta el límite del plan. | `test:limite-usuarios`: con el cupo lleno, reactivar da 422. |
| 2 | Media | Dos altas simultáneas con un solo cupo libre: entra una sola. | `test:limite-usuarios`: dos `POST /users` a la vez → exactamente un 201. |
| 3 | Media | Reemplazar los documentos de un check-in borra del bucket `adjuntos` los anteriores. | Prueba por la API: tras reemplazarlos, el fichero viejo da 404 en `GET /uploads/:fichero`. |
| 4 | Media | En producción el servidor no arranca sin `SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY`. | Con `NODE_ENV=production` y sin una de ellas → exit 1 con `[MISSING_ENV]`. |
| 5 | Baja | Las subidas en memoria no ponen en riesgo los 512 MB de Render. | Revisión del tope por petición (ficheros × tamaño). |
| 6 | Baja | El nombre de un adjunto no es predecible (`crypto.randomUUID`). | Lectura del código; `test:aislamiento-api` en verde. |
| 7 | Baja | Abrir un adjunto hace un solo viaje a Storage. | Un fichero que no existe sigue dando 404. |
| 8 | Baja | `sales.service.js` no importa el middleware para leer el permiso de responsables. | `test:aislamiento-api` (casos de la 026) en verde. |
| 9 | Baja | Comentarios y textos al día: el comentario viejo de `roles.service.js` y el voseo del mensaje del límite. | Lectura. |
| 10 | Baja | `status` de un usuario solo acepta `active`/`inactive` (hoy `z.string()`). | `test:validaciones` o prueba por la API: otro valor → 422 con el campo. |
| 11 | — | Pruebas que faltaban: un fallo de Storage en el check-in no envía el correo ni deja huérfanos; `GET /auth/me/permissions` mientras se suplanta. | Las pruebas nuevas en verde. |
| 12 | Baja | Una respuesta de permisos que llega tarde no pisa los del usuario que entró después. | Lectura; `tsc`. |
| 13 | Baja | Un responsable que quedó en un borrador no se envía si el usuario no puede ver responsables. | En pantalla: venta a crédito sin el campo → 201, no 403. |
| 14 | Baja | La ficha de la agencia avisa si el límite queda por debajo de los usuarios activos. | En pantalla. |
| 15 | Baja | Los 422 de la ficha de la agencia salen junto a su campo. | En pantalla: límite 0 → error en "Límite de usuarios". |
| 16 | Baja | Si `GET /auth/me/permissions` falla, no se queda la copia vieja del caché. | Lectura; `tsc`. |
| 17 | Media | Desactivar un responsable no reescribe nombres ni tipo de documento de la persona. | Prueba por la API: desactivar con solo `{ status }` deja la persona igual. |
| 18 | Baja | `PermissionsContext` lee los permisos de una sola forma (`scopeOf`) y cierra si falta algo. | `tsc`; pruebas en pantalla de T16. |

## Fuera de alcance

- Confirmar `trust proxy` en Render: sigue siendo la T4 de la [`032`](../032-despliegue-vercel-render/tasks.md).
- El número de WhatsApp del mensaje del límite está escrito en el código a propósito (spec 029: no hay un campo de
  contacto de donde sacarlo). Moverlo a una variable de entorno es una decisión del usuario, no un error.
