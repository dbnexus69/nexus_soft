# Spec 035 — La sesión en el navegador: CSP ya, cookie `httpOnly` a decidir

**Estado:** A (CSP) y B (cookie) implementadas (2026-10-31), sin probar con BD ni en Vercel
· **Rama:** `feat-bayrol` · **Toca la base compartida:** no · **Relacionadas:** 032 (despliegue), 001 (sesiones)

## Por qué

El token de sesión vive en `localStorage['nexus_token']` y viaja como `Authorization: Bearer`. Cualquier script que
corra en la página (un XSS, una dependencia comprometida) puede leerlo y llevárselo. La sesión ya es revocable (fila
de `sesiones`, 30 min de inactividad), pero mientras viva, el token robado vale desde cualquier sitio.

No hay refresh token y no hace falta: la sesión se renueva sola en `auth.js` y el JWT (1 día / 7 con "recordarme")
casi nunca llega a caducar antes que la inactividad. Se descartó reemitir el JWT: quitaría la vida máxima del token.

Aún no hay despliegue, así que es el momento más barato para decidir dónde vive la sesión.

## A — Content-Security-Policy (implementada)

Cabeceras en `frontend/vercel.json`, para todas las rutas:

| Directiva | Valor | Por qué |
|---|---|---|
| `script-src` | `'self'` | Ni scripts en línea ni de terceros: es lo que frena un XSS. |
| `style-src` | `'self' 'unsafe-inline'` + Google Fonts | Las librerías (recharts, datepicker) pueden inyectar estilos; un estilo inyectado no roba el token. |
| `font-src` | `'self'` + `fonts.gstatic.com` | Outfit y Plus Jakarta Sans. |
| `img-src` | `'self' data:` + `api.dicebear.com` + `*.supabase.co` | Favicon `data:`, avatares de DiceBear, logos e imágenes de cotización por URL firmada. |
| `connect-src` | `'self'` | La API va por el mismo sitio (rewrite de B). |
| `frame-src` | `blob:` | Vista previa del voucher en `Empresa.tsx` (`URL.createObjectURL` en un `iframe`). |
| `object-src`, `frame-ancestors` | `'none'` | Sin plugins; nadie puede meter la app en un `iframe` (clickjacking). |
| `base-uri`, `form-action` | `'self'` | Evitan redirigir rutas relativas o formularios a otro dominio. |

Además `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin`.

Un `avatar_url` con un dominio fuera de la lista deja de pintarse: es intencionado (el schema acepta cualquier cadena).

### Cómo se comprueba
En el primer despliegue de vista previa de Vercel, con la consola abierta, recorrer: login, panel, ventas (detalle con
imágenes), cotizaciones con fotos, Empresa (logo y vista previa del voucher), usuarios (avatar), vuelos. Cero errores
`Refused to …` en consola. `curl -I` a la URL de vista previa muestra la cabecera. En local (`pnpm dev`) no aplica.

## B — Cookie `httpOnly` con Vercel como proxy (implementada)

**Idea:** el token deja de estar al alcance de JavaScript. El servidor lo pone en una cookie `httpOnly; Secure;
SameSite=Strict` y el navegador la manda sola. Para que la cookie sea "de la casa" (no de terceros, que Safari bloquea
y Chrome restringe), el navegador debe hablar con un único dominio: Vercel reenvía `/api/*` a Render con un rewrite.

| Hoy | Con B |
|---|---|
| `localStorage['nexus_token']` | Cookie `httpOnly`, invisible para JS |
| `Authorization: Bearer` en cada petición | El navegador manda la cookie solo |
| Frontend → `onrender.com` (otro sitio, CORS) | Frontend → `/api` en su propio dominio → Vercel → Render |
| Un XSS se lleva el token | Un XSS puede actuar mientras la página está abierta, pero no llevarse la sesión |

### Decisiones
1. **Cookies** (`utils/tokenUtils.js`): `nexus_sesion` con el token, `httpOnly; SameSite=Strict; Path=/api`, `Secure`
   solo en producción. Con "recordarme" dura 7 días; sin él es cookie de sesión del navegador. El token **no** va en
   el cuerpo del login ni de la suplantación.
2. **Suplantación:** al entrar, el token del superadministrador pasa a `nexus_sesion_original` (solo si no hay uno);
   al salir se restaura y la respuesta dice `restaurada`. Cerrar sesión en mitad de una suplantación revoca también
   la sesión original. La restaurada vuelve como cookie de sesión del navegador, aunque fuese de "recordarme".
3. **`Bearer` sigue valiendo** (`tokenDe`): la cookie manda si está. Lo usan las suites y no abre nada, porque el
   navegador ya no tiene el token.
4. **IP real:** `trust proxy` sale de `TRUST_PROXY` (por defecto 1; `render.yaml` pone 2: Vercel + balanceador de
   Render). Vercel sobrescribe el `X-Forwarded-For` del cliente ([docs](https://vercel.com/docs/headers/request-headers)).
   **Hueco conocido:** quien llame a Render directamente (sin pasar por Vercel) con un `X-Forwarded-For` inventado
   puede esquivar el límite por IP. Con `trust proxy 1` eso no pasaba. Cerrarlo pide que Render solo acepte tráfico
   de Vercel (un secreto en una cabecera), que un rewrite de `vercel.json` no puede añadir.
5. **Límites de Vercel:** espera máxima de 120 s hasta el primer byte de Render
   ([changelog](https://vercel.com/changelog/cdn-origin-timeout-increased-to-two-minutes)); basta para un arranque en
   frío. **Sin confirmar:** si el cuerpo de un rewrite externo tiene el tope de 4,5 MB de las funciones; las subidas
   aceptan hasta 5 MB (`middleware/upload.js`). Probar una subida de ~5 MB en la vista previa.
6. **CSRF:** `SameSite=Strict` + CORS, que sigue comprobando el `Origin` que Vercel reenvía. Por eso `FRONTEND_URL`
   sigue siendo la URL de producción de Vercel, y en una vista previa los `POST` fallarán por CORS, como antes.
7. **Navegador:** solo guarda `nexus_sesion` en `localStorage` con `empresa_usuario` (`utils/sesionLocal.ts`), para
   las claves de los cachés y para saber que un 401 es una sesión que terminó. Al recargar vale `pendiente` hasta
   que `/auth/me` confirma quién es, para no leer cachés de la agencia anterior tras suplantar.
8. **Local:** `VITE_API_URL` es opcional; sin ella Vite reenvía `/api` a `localhost:3000`. Con ella
   (`http://localhost:3000/api/v1`) también funciona: `localhost` con otro puerto es el mismo sitio para la cookie.
   Con `127.0.0.1` no.

### Cómo se comprobaría
`test:aislamiento-api` en verde con cookie; login, recarga, logout, suplantar y volver; `document.cookie` no muestra
el token; subir un voucher grande a través del proxy.
