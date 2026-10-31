---
paths:
  - "backend/src/**"
  - "frontend/src/**"
---

# Seguridad, autenticación y autorización

- Trata todos los datos de agencias como datos aislados por `empresa`. Nunca confíes en un `empresaId` recibido desde URL, body o query; el contexto de la empresa autenticada debe venir de la sesión/token y del mecanismo de tenencia del backend.
- No agregues rutas protegidas solo con `auth` si deben respetar permisos por módulo/acción: deben ejecutar `authorize(...)` después de `auth`. `auth` por sí solo no establece `req.permissionScope`.
- Las mutaciones y listados deben respetar el alcance `all`/`own`/`none`. No basta con ocultar botones en el frontend.
- Los permisos persistidos están en PostgreSQL, tabla `permisos_rol`; la BD es la fuente de verdad. No inventes una tabla `permisos_usuario`: los overrides por usuario fueron retirados.
- Si agregas un módulo o acción, revisa los puntos sincronizados: `backend/src/services/roles.service.js` (`MODULE_ACTIONS` y, si corresponde, `SCOPED_VIEW_MODULES`), `backend/src/middleware/authorize.js` (`ADMIN_PERMISSIONS` y `ROLE_DEFAULT_PERMISSIONS`) y `frontend/src/types/index.tsx` (`RolePermissions` y constantes fallback). Una acción con alcance también debe incorporarse en `SCOPED_ACTIONS` en ambos lados.
- `superadmin` y `admin` son roles fijos; no los hagas editables. Durante la suplantación, `req.empresaOrigen`/`req.user.empresa_id` identifica la empresa original y `req.empresaId` puede representar la empresa suplantada. Operaciones sobre la sesión o fila propia del usuario deben usar la empresa de origen.
- Durante una suplantación, no escribas `req.user.id` en una FK compuesta `(x_id, empresa_id) → usuarios(id, empresa_id)` de la empresa suplantada. Usa la conducta definida en la especificación correspondiente: `null` si el campo es nullable o error 400 claro si es obligatorio.
- Las comprobaciones de propiedad que dependan de RLS deben hacerse con la configuración correcta de tenencia. No asumas que una consulta `findFirst` demuestra pertenencia si el rol de BD puede saltarse RLS.
- CORS debe mantener allowlist explícita; nunca usar wildcard como solución rápida. Conserva Helmet y los límites de solicitudes existentes.
- No devuelvas contraseñas, `empresa_id`, datos bancarios ni campos personales que el cliente no solicitó. Sigue el contrato de respuesta mínima del backend.
- No debilites validación, permisos, RLS, claves foráneas compuestas ni controles de almacenamiento para hacer pasar una prueba.

## Permisos: detalles que no se pueden perder
- **Un valor de permiso guardado se lee en UN solo sitio:** `leerValor` en `backend/src/utils/alcancePermisos.js` (`'true'` es `'all'`; `'false'` o cualquier valor desconocido es `'none'`). Lo usan `authorize.js` para decidir y `roles.service.js` para mostrar el panel. No reintroduzcas una segunda lectura. En el frontend, el equivalente es `scopeOf` en `PermissionsContext.tsx`: `canView/canCreate/canEdit/canDelete` son envoltorios de una línea sobre él.
- La pantalla de cada rol toma sus permisos de `GET /auth/me/permissions` (lo que aplica `authorize`), no de `GET /roles/:rol/permissions`, que es el panel de edición y requiere `permissions.view` (spec 027).
- Una escritura con alcance nunca es más amplia que ver: `authorize` pone la más estrecha de las dos en `req.permissionScope` (403 con `none`), `PUT /roles/:rol/permissions` la guarda recortada, y un `true`/`false` guardado se lee como `all`/`none`.
- Comprobación de propiedad: se lee con `viewScope` (404) y se escribe con `alcanceDeEscritura` (403) — `ventasAlcance.js`, `quotesAlcance.js`, `clients.service.js`, `flights.service.js`, `responsables.service.js`, `products.controller.js`.
- `PUT /roles/:rol/permissions` **reemplaza** el conjunto entero del rol, no lo mezcla.
- Un rechazo que vuelve como 404/422 en lugar de 403 delata que `authorize` no corrió en esa ruta.

## Superadministrador, ficheros y la tabla `empresas`
- El superadministrador es una fila normal de `usuarios` de alguna agencia real (`usuarios.empresa_id` es `NOT NULL` para todos), con rol `superadmin`. Administra agencias y puede suplantar una (`suplantaciones`, auditada y con caducidad). La RLS no le hace excepciones en las tablas de negocio. `req.suplantacion` (verdadero mientras suplanta) es la señal para el caso de las FKs compuestas.
- Los ficheros subidos se sirven por una ruta autenticada: `GET /uploads/:fichero` comprueba la fila que lo referencia y responde 302 a una URL firmada de 5 minutos del bucket `adjuntos` (la fila guarda `/uploads/<fichero>`, spec 031).
- `empresas` no es tabla de negocio: una agencia lee y actualiza solo su fila, y el trigger `app_empresa_solo_perfil` lo limita a columnas de perfil y marca (slug, razón social, estado, remitente, plan y fechas son solo del superadministrador).
- Sesiones: `middleware/auth.js` comprueba la fila de `sesiones` (cerrar sesión o cambiar la contraseña la revocan; caché en `authCache.js`). Cada fallo de caché la renueva: sin "recordarme" caduca tras 30 min de inactividad, y `GREATEST` nunca acorta una de 7 días. Los tokens anteriores a la multitenencia se rechazan con `SESSION_SIN_EMPRESA`.
