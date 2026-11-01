---
paths:
  - "backend/**"
---

# Convenciones del backend

- Stack: Express 5, Prisma 6, CommonJS y JavaScript (no TypeScript), PostgreSQL en Supabase.
- Arquitectura de una funcionalidad: ruta → middleware (`auth`, `authorize`, `validate`) → controller → service → Prisma. `routes/index.js` monta los recursos.
- Valida entradas con esquemas Zod en `schemas/*.schema.js`. No omitas validación para aceptar entradas inválidas.
- `src/index.js` configura Helmet, CORS con allowlist explícita (`FRONTEND_URL` y localhost), rate limits y el prefijo `/api/v1` (el único desde la spec 036; `GET /api/health` se declara aparte).
- Usa `utils/apiResponse.js`: respuestas correctas con `{ success, data, meta }` y errores con `{ success: false, error: { message, code } }`. Los errores se procesan en `middleware/errorHandler.js` y `errors/AppError.js`.
- Colecciones paginadas: valor predeterminado 10, máximo 100; `meta` incluye `page`, `perPage`, `total`, `totalPages`, `hasNext` y `hasPrev`.
- `POST` devuelve 201 y `DELETE` devuelve 204, salvo excepciones documentadas. Los errores de validación devuelven 422 con `error.details: [{ field, message }]`.
- Las escrituras devuelven la respuesta mínima necesaria, no todo el registro: ediciones devuelven `id` y campos enviados con valores persistidos; creaciones incluyen `numero`; cambios de estado devuelven `id` y `status`. No devuelvas contraseña, `empresa_id`, datos bancarios ni campos personales no solicitados. Sigue `utils/respuestaMinima.js::soloLoPedido(...)`. Cotizaciones y `PATCH /company-profile` mantienen sus respuestas completas según sus contratos.
- Comentarios, documentación y mensajes de UI van en español. Los `console.error`/`console.warn` ad hoc que no pasan por `errorHandler.js` van en inglés y llevan una etiqueta corta `SCREAMING_SNAKE_CASE`, por ejemplo `[EMAIL_SEND_FAILED]`. No reutilices `[ERROR]` para fallos esperados; esa etiqueta y `[ERROR META]`/`[ERROR STACK]` se reservan para errores 500 inesperados en `errorHandler.js`. Los rechazos esperados usan `[REQUEST_REJECTED]` sin stack.
- No cambies la arquitectura de tenencia ni los patrones de transacción; consulta `.claude/rules/database.md`.
- Las convenciones de dominio detalladas (datos personales, ventas por lotes, IVA de la TA, días de Bogotá, categorías de producto) deben permanecer en `backend/CLAUDE.md`.
- Antes de cambiar multitenencia, permisos o transacciones, lee `docs/specs/001-multi-tenant/{spec,plan,tasks}.md` y la decisión arquitectónica pertinente. Lee las specs relacionadas con la funcionalidad y su `tasks.md` antes de tocarla.
- Para rutas que suben archivos usa `middleware/upload.js` (`upload.single/array`) o `uploadLogo`; no uses Multer directamente. Debe conservarse el contexto AsyncLocalStorage mediante el middleware del proyecto.
- La pantalla/API de vuelos usa `/flights`, aunque la clave de permisos persistida sigue siendo `itineraries`.
