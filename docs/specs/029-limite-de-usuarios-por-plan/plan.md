# Plan — Spec 029

Orden: base → servidor (crear agencia, editar agencia, crear usuario) → pruebas → pantalla. Cada paso deja la
aplicación funcionando: mientras el campo no exista en pantalla, nadie lo toca y ninguna agencia se ve afectada.

## Decisiones

1. **Tres columnas sueltas en `empresas`, no una tabla de planes.** Razonado en la spec ("Riesgos"): sin un
   segundo límite que justifique un catálogo, una tabla aparte sería mantenimiento sin beneficio.
2. **Un solo punto de aplicación.** El límite se comprueba una vez, en `users.service.js::createUser`, antes de
   escribir. Ningún otro lugar (login, impersonación, migraciones de datos) necesita saberlo.
3. **Contar usuarios activos con una consulta simple** (`prisma.usuarios.count({ where: { status: 'active',
   deleted_at: null } })`, dentro del contexto de la agencia — la RLS ya lo filtra, no hace falta `empresa_id` en
   el `where`, igual que el resto del código).
4. **Agencia nueva con el plan base por defecto**, salvo que `createCompanySchema` traiga esos campos explícitos
   (para una agencia que empiece directo en otro plan, si hiciera falta alguna vez).
5. **Los tres campos del plan se validan igual de sueltos que se guardan**: `limiteUsuarios` entero positivo o
   nulo, `nombrePlan` texto corto o nulo, `precioPlan` entero no negativo o nulo. Sin relación cruzada entre
   ellos (el superadmin puede, a propósito, poner un límite sin un nombre, por ejemplo).
6. **Mensaje de error completo (decisión revisada el 2026-10-24).** La primera versión era fija y sin
   variables; el usuario pidió que diga el plan, el límite permitido y a dónde escribir para ampliarlo:
   "Llegaste al límite de usuarios de {nombrePlan}: permite hasta {limiteUsuarios} usuario(s) activos, y ya los
   tenés todos en uso. Si necesitás más licencias, escribinos por WhatsApp al 301 231 6848 y te ayudamos a
   ampliar tu plan." El número de WhatsApp queda fijo en el código (no hay un campo de contacto de soporte en
   el sistema); si cambia, se edita a mano en `users.service.js::_comprobarLimiteDeUsuarios`.

## Pasos

| Paso | Dónde | Qué |
|---|---|---|
| 1 | `prisma/migrations/…_limite_de_usuarios_por_plan`, `schema.prisma` | `empresas.limite_usuarios` (Int?), `empresas.nombre_plan` (String?), `empresas.precio_plan` (Int?). `migrate diff` → leer → `migrate deploy` |
| 2 | `backend/src/schemas/companies.schema.js` | `limiteUsuarios`/`nombrePlan`/`precioPlan` opcionales en `createCompanySchema` y `updateCompanySchema` |
| 3 | `backend/src/services/companies.service.js::create` | Valores por defecto (decisión 4) si no llegan explícitos |
| 4 | `backend/src/services/companies.service.js::update` | Los tres campos en el mapa `columnas` de `update()`, igual que `nombre`/`estado` |
| 5 | `backend/src/services/users.service.js::createUser` | Comprobación del límite antes de crear (decisión 2 y 3); 422 con el mensaje fijo |
| 6 | `backend/tests/` (nuevo o ampliar `aislamiento-api.js`) | Casos de "Cómo se comprueba" de la spec |
| 7 | `frontend/src/types/index.tsx`, `api/companies.ts` | Los tres campos en el tipo de empresa y en la llamada de `updateCompany` |
| 8 | `frontend/src/pages/Companies.tsx` | Sección "Plan" en el formulario de edición de una agencia |

## Qué hace falta del usuario

- Permiso para `migrate deploy`/`db:generate` y la prueba con BD, cuando llegue el momento.
- La prueba en pantalla.
