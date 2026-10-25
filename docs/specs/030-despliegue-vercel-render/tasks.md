# Tareas — Spec 030

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-25).** Configuración lista en el árbol de trabajo. Falta el despliegue en los paneles (T8) y
mover los archivos a Storage (spec 031).

- [x] T1 · `frontend/vercel.json` con el rewrite SPA (B5).
- [x] T2 · `render.yaml` en la raíz: free, virginia, pnpm 10 por `npx` (el de CI), `--prod=false`, health check,
  `JWT_SECRET` generado, el resto `sync: false` (B4, R3).
- [x] T3 · `engines.node` 22.x en los dos `package.json` (B6).
- [~] T4 · `app.set('trust proxy', 1)` en `src/index.js` (B2). Confirmar en Render que `req.ip` es la del cliente
  (6 logins fallidos desde una IP no bloquean otra); si no, subir el número de saltos.
- [x] T5 · `config/env.js` sale con `[MISSING_ENV]` en producción sin `JWT_SECRET`/`FRONTEND_URL`/`DATABASE_URL`
  (B3). Comprobado: sin `JWT_SECRET` → exit 1; con las tres → carga.
- [x] T6 · Archivos subidos a Supabase Storage (B1) → hecho en la spec 031.
- [x] T7 · CLAUDE.md (destino, BD compartida, uploads) y README (sección "Despliegue").
- [ ] T8 · Despliegue real y comprobaciones de `spec.md` (en los paneles de Render y Vercel).
