# Spec 036 — Deuda técnica de la revisión del 2026-11-01

**Estado:** completada (2026-11-01), probada con base y confirmada en pantalla por el usuario · **Rama:** `feat-bayrol` · **Toca la base compartida:** no (ninguna migración) ·
**Origen:** revisión del proyecto entero del 2026-11-01, puntos 3, 4, 5 y 7 · **Relacionadas:**
[`034`](../034-respuestas-minimas/spec.md) (respuestas mínimas; quitó los primeros `add*` muertos de `DataContext`),
[`035`](../035-sesion-en-el-navegador/spec.md) (sesión en cookie)

## Por qué

Nada de esto falla hoy. Son cuatro sitios donde el código deja la puerta abierta a un error futuro o carga con
peso que nadie usa.

## Qué tiene que pasar y cómo se comprueba

| # | Qué | Cómo se comprueba |
|---|---|---|
| A | **SQL crudo vigilado.** Las ~20 consultas `$queryRawUnsafe` (`ventasListado.js`, `ventasCartera.js`, `stats.service.js`, `commissions.service.js`, `responsables.service.js`) hoy son seguras: valores por parámetro y orden de listas cerradas. Una interpolación nueva con un dato del usuario no la detecta nada. `check:prisma` falla si dentro de un `$queryRawUnsafe`/`$executeRawUnsafe` hay un `${…}` que no está en una lista corta de fragmentos permitidos. | `pnpm check:prisma` en verde con el código de hoy; una interpolación de prueba (`${req.query.x}`) lo hace fallar. Va en la CI, que ya corre `check:prisma`. |
| B | **Una sola capa de datos por lista en la pantalla.** `DataContext.tsx` (613 líneas) guarda usuarios, clientes, comisionistas y responsables, y los hooks (`useUsers`, `useClients`, `useCommissions`) tienen su copia. Lo que ninguna pantalla usa sale de `DataContext`; lo que se usa en los dos lados queda en uno solo. | Un inventario en `tasks.md` (quién usa qué); `tsc` en verde; repaso en pantalla de usuarios, clientes, comisionistas, responsables y el asistente de venta. |
| C | **`avatar` acotado.** Hoy es `z.string()` sin largo (cabe hasta el tope de 5 MB del JSON) en usuarios, clientes y comisionistas, y se devuelve en cada listado. Pasa a URL con largo máximo y del origen de los avatares. | `test:validaciones` (o una prueba por la API): un texto que no es URL, una URL de otro dominio y una de más de 300 caracteres → 422 en `avatar`; una del selector → 200. |
| D | **Código muerto fuera.** `deleteResponsable` de `DataContext` (sin uso), y lo que se decida de: `DELETE /responsables/:id` (sin botón), el montaje doble del router en `/api` y `/api/v1`, y `db:seed`/`db:reset` (roto el primero, prohibido el segundo). | `tsc`, `check:prisma`; `test:aislamiento-api` si se toca una ruta (con permiso). |

## Decisiones del usuario (antes de implementar)

**Tomadas el 2026-11-01:** 1 → solo se acota el campo; 2 → se quita la ruta; 3 → solo `/api/v1`; 4 → se quitan.

1. **Avatares (C):** ¿solo se acota el campo, o además se dejan de cargar de `api.dicebear.com` (servicio externo que
   recibe la IP de quien ve una lista) y se sirven desde el propio frontend?
2. **`DELETE /responsables/:id` (D):** ¿se quita la ruta (hoy se desactiva, no se borra), o se le pone botón para el
   admin?
3. **`/api` sin `v1` (D):** el frontend solo usa `/api/v1`. ¿Se quita el montaje en `/api`? `GET /api/health` (el
   health check de Render) no depende de él y se queda.
4. **`db:seed` y `db:reset` (D):** ¿se quitan de `package.json` (y `prisma/seed.js`), o se deja `db:seed` documentado
   como roto?

## Fuera de alcance

- Separar la base de desarrollo y pruebas de la de producción (punto 1 de la revisión): decisión de infraestructura
  del usuario.
- Pasar las consultas a `$queryRawTyped` (`prisma/sql/*.sql`): necesita `db:generate`, que toca la base, y reescribir
  ~20 consultas. A deja la puerta vigilada sin eso.
