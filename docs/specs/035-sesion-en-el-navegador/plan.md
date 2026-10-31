# Plan 035

## A — CSP
1. Inventario de orígenes que usa el frontend sin ejecutar nada (`index.html`, `src/` por URLs, `img`, `iframe`,
   `createObjectURL`; backend por URLs firmadas de Storage).
2. Cabeceras en `frontend/vercel.json` (spec, tabla A).
3. Probar en la vista previa de Vercel.

## B — Cookie (aprobada el 2026-10-31, antes del primer despliegue)
1. Resolver los puntos 1–5 de la spec (documentación de Vercel y Render, decisión sobre suplantación y CSRF).
2. Backend: `login` responde `Set-Cookie`; `auth.js` lee la cookie (y `Bearer` mientras dure la transición);
   `logout` la borra; `trust proxy` ajustado.
3. Frontend: `VITE_API_URL=/api/v1`, `withCredentials`, fuera `localStorage` del token y del token original.
4. `vercel.json`: rewrite `/api/(.*)` → Render, antes del de la SPA; `connect-src 'self'` y quitar Render de la CSP.
5. CORS se queda: Vercel reenvía el `Origin`, y comprobarlo contra `FRONTEND_URL` es una defensa más contra CSRF.
