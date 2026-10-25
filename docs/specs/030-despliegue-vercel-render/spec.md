# Spec 030 — Despliegue: frontend en Vercel, backend en Render

**Estado:** configuración implementada; despliegue real y B1 (spec 031) pendientes · **Rama:** `feat-bayrol` · **Toca la base compartida:** no (ninguna migración)
· **Relacionadas:** 011 (Storage por empresa), 022 (CI)

## Por qué

Hasta hoy todo corre en local (CLAUDE.md: "Not deployed anywhere yet"). El usuario fija el destino: el frontend
(Vite estático) en **Vercel** y el backend (Express de larga vida) en **Render**. La base sigue en Supabase.

## Análisis del proyecto (2026-10-25)

Lo que ya está listo y no hay que tocar:

- **Sesión por `Authorization: Bearer`** (token en `localStorage`), no por cookie: dominios distintos
  (`*.vercel.app` ↔ `*.onrender.com`) no rompen nada por cookies de terceros.
- **CORS explícito** con `FRONTEND_URL`; el comodín `*.vercel.app` ya se retiró a propósito (`src/index.js`).
- `PORT` sale del entorno (Render lo inyecta); `/api/health` existe para el health check.
- El frontend lee la API de `VITE_API_URL` (`src/api/client.ts`); `pnpm build` = `tsc && vite build` → `dist/`.
- Logos, vouchers e imágenes de cotización ya viven en Supabase Storage (specs 011 y 021).
- Sin cron ni `setInterval`: nada se pierde si Render duerme el servicio.

Lo que bloquea o rompe en producción:

| # | Problema | Efecto en Render/Vercel |
|---|---|---|
| B1 | **Archivos en disco local** (`middleware/upload.js` → `uploads/`): vouchers de proveedor (`products.controller.js`), documentos de check-in (`flights.service.js`, también los adjunta al correo leyendo el disco), avatares de clientes y usuarios. | El disco de Render es efímero: cada deploy o reinicio borra todo lo subido. Las filas quedan apuntando a `/uploads/…` que ya no existe. |
| B2 | Sin `app.set('trust proxy', 1)`. | Detrás del proxy de Render todas las peticiones llegan con la misma IP: el límite de 5/min de login vale **para todos los usuarios juntos**, y `express-rate-limit` v7 avisa `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`. |
| B3 | `JWT_SECRET` tiene un valor por defecto conocido (`config/env.js`). | Si falta la variable en Render, el servidor arranca firmando con una clave pública en el repo: cualquiera fabrica tokens de cualquier agencia. Debe negarse a arrancar en `production`. |
| B4 | `prisma` está en `devDependencies` y `build` = `prisma generate --sql` (necesita la BD). | Con `NODE_ENV=production` en el build, pnpm no instala devDeps → no hay CLI de Prisma. El build necesita `--prod=false` y `DATABASE_URL`/`DIRECT_URL` disponibles. |
| B5 | `BrowserRouter` sin rewrite. | En Vercel, recargar `/sales` da 404: falta `vercel.json` que mande todo a `index.html`. |
| B6 | Sin versión de Node fijada. | Render usa su default; CI usa 22. Fijar `engines.node` para que coincidan. |

Riesgos que hay que decidir (no son de código):

- **R1 · Misma BD para producción y desarrollo.** Las suites con BD (`test:aislamiento-api`, etc.) crean y borran
  agencias en la base compartida, y `migrate deploy` se corre desde local. Con usuarios reales en esa base, una
  prueba o una migración a medias los afecta. Lo sano es un proyecto Supabase aparte para producción.
- **R2 · Plan gratuito de Render** duerme el servicio tras 15 min sin tráfico (primer request ~30–60 s) y no
  admite disco persistente.
- **R3 · Región.** Supabase está en `us-east-1`; Render debe ir en `virginia` para no sumar latencia por consulta
  (el README mide lo caro que es cada viaje al pooler).
- Los deploys de vista previa de Vercel tienen otra URL y CORS los rechaza: aceptado (solo se permite la de
  producción, explícita).

## Decisiones del usuario (2026-10-25)

- B1 → **Supabase Storage**, en su propia spec (031). Mientras tanto lo subido se pierde en cada deploy.
- R1 → **la base compartida actual** también para producción. Riesgo aceptado y escrito en CLAUDE.md.
- R2 → **plan free** de Render.

## Qué se quiere

1. Frontend desplegado en Vercel desde `frontend/`, con navegación directa a cualquier ruta.
2. Backend desplegado en Render desde `backend/`, con health check, en la región de la BD.
3. Nada subido por los usuarios se pierde en un redeploy (B1).
4. El servidor no arranca en producción con una configuración insegura (B3, y el chequeo de RLS que ya existe).
5. Las migraciones **no** se corren en el build ni al arrancar: siguen siendo un paso manual
   (`migrate diff` → leer SQL → `migrate deploy`), como manda CLAUDE.md.

## Cómo se comprueba

- `pnpm build` del frontend y CI en verde; `check:prisma` en verde si se tocan consultas.
- En producción: `GET https://<render>/api/health` → 200; login desde la URL de Vercel; recargar una ruta
  profunda (`/sales`) no da 404; subir un voucher, redeployar el backend y volver a abrirlo.
- Seis intentos de login fallidos desde una IP no bloquean a otra IP (B2).
- Arrancar con `NODE_ENV=production` sin `JWT_SECRET` → el proceso sale con error (B3).
