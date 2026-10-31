# Tareas 035

## A — CSP
- [x] T1 Inventario de orígenes (2026-10-31): Google Fonts, DiceBear, Supabase Storage (URLs firmadas de logos e
  imágenes de cotización), `blob:` de la vista previa del voucher, favicon `data:`. Sin `dangerouslySetInnerHTML`.
  Los enlaces (`wa.me`, webs de aerolíneas, `/uploads` → 302) son navegación y la CSP no los limita.
- [x] T2 Cabeceras en `frontend/vercel.json`. `connect-src 'self'` desde que la API va por el rewrite (B).
- [ ] T3 Probar en vista previa de Vercel (spec, "Cómo se comprueba").

## B — Cookie `httpOnly`
- [x] T4 Decidido: se hace antes del despliegue (usuario, 2026-10-31).
- [x] T5 Puntos abiertos resueltos o acotados (spec, "Decisiones"); quedan sin confirmar el tope de cuerpo de Vercel
  y el hueco de `X-Forwarded-For` llamando a Render directamente.
- [x] T6 Backend: `tokenUtils.js` (cookies, `tokenDe`), `auth.js`, `auth.controller.js` (login/logout),
  `companies.controller.js` (suplantación), `index.js` (`TRUST_PROXY`), `render.yaml`.
- [x] T7 Frontend: `api/client.ts` (sin interceptor de token, `/api/v1` por defecto), `utils/sesionLocal.ts`, los
  cuatro cachés, `AuthContext`, `Companies.tsx`, `Layout.tsx`, `vite.config.ts` (proxy), `vercel.json` (rewrite).
- [x] T8 Pruebas: `montaje.js` saca el token de la cookie; `aislamiento-api` comprueba cookie `HttpOnly`/`Strict` y
  que el token no viaja en el cuerpo (login y suplantación); `voucher-api` lee la suplantación de la cookie.
- [x] T9 Verificado sin BD: `pnpm build` del frontend en verde; `node --check` de los archivos de backend y pruebas.
- [x] T10 `pnpm test:aislamiento-api` y `pnpm test:voucher` en verde (2026-10-31, con permiso; antes hubo que correr `pnpm db:generate`: el cliente generado era anterior a `limite_usuarios`).
- [ ] T11 En pantalla, en local: login con y sin "recordarme", recargar, cerrar sesión, suplantar y salir, sesión
  caducada (aviso y vuelta al login), subir un voucher.
- [ ] T12 En la vista previa de Vercel: lo de T11 más una subida de ~5 MB y comprobar en los logs de Render que
  `req.ip` es la del cliente.
