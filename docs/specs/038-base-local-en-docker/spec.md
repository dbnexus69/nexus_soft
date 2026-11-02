# Spec 038 — Base de datos y Storage locales en Docker

**Estado:** en ejecución · **Rama:** `feat-bayrol` · **Toca la base compartida:** no (al contrario: deja de tocarla en
desarrollo) · **Origen:** punto 1 de la revisión del 2026-11-01 · **Relacionadas:**
[`031`](../031-adjuntos-en-storage/spec.md) (adjuntos en Storage), [`032`](../032-despliegue-vercel-render/spec.md)
(despliegue), [`036`](../036-deuda-tecnica-de-la-revision/spec.md) (quitó `db:seed`)

## Por qué

Desarrollo, pruebas y producción usan la misma base de Supabase. Cada suite crea y borra agencias de prueba en
producción, las migraciones salen de una máquina local y las pruebas dependen de la red (en la 036 se colgaron por
latencia y pérdida de paquetes). Cada desarrollador tiene que trabajar contra su propia base.

## Decisiones (usuario, 2026-11-02)

- **Docker Compose, no Supabase CLI:** el peso en la máquina es un limitante.
- **Storage también en local**, si es factible: la API de Storage de Supabase (`supabase/storage-api`) con backend de
  archivos. El código no cambia, porque habla con la misma API que en producción.
- **`ALMACENAMIENTO_PREFIJO` sigue obligatorio** si en desarrollo alguien apunta a un Storage real.
- **Variables:** las de producción pasan a `backend/.env.produ` (sin versionar); `backend/.env` y `.env.example` quedan
  con las locales.

## Qué tiene que pasar y cómo se comprueba

| # | Qué | Cómo se comprueba |
|---|---|---|
| A | `docker compose up` levanta Postgres, Storage y su pasarela, solo en `127.0.0.1`. | Los servicios quedan sanos; `docker stats` da el consumo real. |
| B | Las migraciones corren desde cero en la base local, con el rol `app_nexus` sin `BYPASSRLS`. | `prisma migrate deploy` termina; `src/index.js` arranca. |
| C | Storage local funciona igual: subir, leer, firmar, abrir la URL firmada, copiar, borrar. | `test:voucher` y `test:cotizacion-imagenes` en verde contra local. |
| D | Una base nueva queda usable con un solo comando: buckets, catálogos, una agencia y un superadministrador de desarrollo. Sin datos reales. | Entrar con esos usuarios; `pnpm local:preparar` es repetible. |
| E | Todas las suites corren contra local. | `test:aislamiento`, `test:aislamiento-api`, `test:vuelos-api`, `test:ventas-filtros`, `test:clientes-destinos`, `test:voucher`, `test:limite-usuarios` en verde. |
| F | Nada de lo local puede tocar producción por descuido: `tests/montaje.js` se niega si la base no es local; el arranque en desarrollo se niega contra un Storage real sin prefijo; migrar producción es un script explícito. | Probar cada negativa. |
| G | Documentación al día, para que Darío haga lo mismo. | README y `.claude/rules/` describen el flujo. |

## Fuera de alcance

- Pooler local: en local la conexión es directa, así que un fallo propio del pooler no se ve aquí.
- Copiar datos de producción (son datos personales de clientes).
- Correr las suites con base en la CI: queda posible, pero es otra tarea.
- Producción no cambia: Supabase, Render y Vercel siguen igual.
