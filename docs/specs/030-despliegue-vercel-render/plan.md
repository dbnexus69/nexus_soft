# Plan — Spec 030

## Frontend (Vercel)

- `frontend/vercel.json`: un solo rewrite `/(.*)` → `/index.html` (B5). Vercel detecta Vite y pnpm solo.
- En el panel: *Root Directory* `frontend`, variable `VITE_API_URL=https://<servicio>.onrender.com/api/v1`
  (se hornea en el build: cambiarla exige redeploy).

## Backend (Render)

- `render.yaml` en la raíz (Blueprint, un solo servicio web):
  `rootDir: backend`, `region: virginia`, `buildCommand: pnpm install --frozen-lockfile --prod=false && pnpm build`,
  `startCommand: pnpm start`, `healthCheckPath: /api/health`; variables con `sync: false` (se cargan a mano en el
  panel, nunca en el repo): `DATABASE_URL` (rol `app_nexus`), `DIRECT_URL`, `JWT_SECRET`, `FRONTEND_URL`,
  `RESEND_API_KEY`, `EMAIL_FROM`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NODE_ENV=production`.
- `backend/package.json` y `frontend/package.json`: `"engines": { "node": "22.x" }` (B6).
- `src/index.js`: `app.set('trust proxy', 1)` (B2).
- `src/config/env.js`: si `NODE_ENV === 'production'` y falta `JWT_SECRET` (o `FRONTEND_URL`), `exit(1)` con
  mensaje, igual que el chequeo de RLS (B3).

## Archivos subidos (B1) — depende de la decisión del usuario

- **Opción A (recomendada): Supabase Storage**, reusando `utils/almacenamiento.js` (ya prefija la carpeta de la
  empresa y firma URLs). `upload.js` pasa a `memoryStorage`; cada sitio que hoy guarda `/uploads/<fichero>` sube al
  bucket y guarda la ruta; `uploads.routes.js` responde con URL firmada; `flights.service.js` descarga del bucket
  para adjuntar al correo. Los ficheros que hoy hay en `backend/uploads/` local se migran con un script de una vez o
  se dan por perdidos (son de desarrollo). Probablemente merece su propia spec (031) por tamaño.
- **Opción B: disco persistente de Render.** Cero código, pero exige plan pago (Starter + disco), una sola
  instancia y deploys con corte.

## Documentación

- CLAUDE.md: cambiar "Not deployed anywhere yet" por el destino real y las variables de cada lado.
- README: sección corta "Despliegue" (pasos de panel, orden: backend → copiar URL → `VITE_API_URL` → frontend →
  copiar URL → `FRONTEND_URL` en Render).
