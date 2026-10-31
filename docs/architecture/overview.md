# Arquitectura general — Nexus Soft

## Producto y paquetes
Nexus Soft es un sistema de gestión para agencias de viaje: ventas/reservas, clientes, comisiones, itinerarios/vuelos, usuarios/roles y estadísticas. Cada agencia es una `empresa` con datos aislados.

Hay dos paquetes pnpm independientes, sin workspace compartido:
- `backend/`: Express 5 + Prisma 6, CommonJS, JavaScript y PostgreSQL en Supabase.
- `frontend/`: React 19 + Vite + TypeScript + Tailwind.

El código, comentarios, documentación y la interfaz están en español.

## Despliegue
Según la configuración documentada del proyecto (spec 032):
- Frontend en Vercel, con `frontend/` como Root Directory. El navegador llama a `/api` del propio sitio y un rewrite de `vercel.json` lo reenvía a Render; la sesión va en una cookie `httpOnly` (spec 035).
- Backend en Render, en la región Virginia, junto a Supabase us-east-1.
- Render no conserva archivos locales entre despliegues. Vouchers de proveedores y documentos de check-in se guardan en el bucket privado `adjuntos` de Supabase Storage (spec 031).
- Las migraciones no se ejecutan durante el build ni al iniciar el backend.

**Advertencia operativa:** desarrollo y producción usan la misma base de datos compartida de Supabase. Las pruebas con BD, scripts de datos y migraciones pueden afectar datos reales y requieren autorización explícita.

## Backend
Flujo habitual: ruta → middleware (`auth`, `authorize`, `validate`) → controller → service → Prisma. `routes/index.js` monta los recursos. Las validaciones usan Zod en `schemas/*.schema.js`; las respuestas se normalizan con `utils/apiResponse.js`; los errores se procesan en `middleware/errorHandler.js`.

El frontend apunta a `/api/v1`. El backend mantiene `/api` y `/api/v1` sobre el mismo router.

## Aislamiento multiempresa
El JWT autenticado identifica `empresaId`. El contexto de empresa se establece con `conEmpresa(...)` en `config/tenant.js`, usando AsyncLocalStorage. El cliente extendido de Prisma configura `app.empresa_id` para que las políticas RLS de PostgreSQL apliquen el aislamiento. No dupliques el aislamiento con filtros `where empresa_id` ni asignaciones manuales en `create`.

Las claves foráneas compuestas `(id, empresa_id)` evitan referencias entre empresas. Las transacciones deben usar el helper `transaccion(fn)` de `config/db.js`. Los detalles y casos límite están en `.claude/rules/database.md`, la especificación multiempresa y la decisión de arquitectura correspondiente.

## Permisos
Los permisos por rol viven en PostgreSQL (`permisos_rol`); la BD es la fuente de verdad. Las rutas que requieren alcance por rol deben ejecutar `authorize(...)` después de `auth`. Los permisos de vista/escritura pueden limitarse a `all`, `own` o `none`. Consulta `.claude/rules/security.md` antes de modificar autorización.

## Documentación fuente
- `README.md`: convenciones técnicas y mediciones de rendimiento.
- `docs/specs/`: especificaciones, planes y tareas por funcionalidad.
- `docs/decisions/`: decisiones de arquitectura y alternativas descartadas.
- `docs/designs/`: diseños de funcionalidades concretas.
- `backend/CLAUDE.md` y `frontend/CLAUDE.md`: reglas específicas de cada paquete.

Antes de cambiar multitenencia, permisos, paginación o listado de ventas, consulta la especificación, el registro de tareas y las decisiones relacionadas.
