# Tareas — Spec 029

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-24).** Implementada y comprobada de punta a punta: migración aplicada, `check:prisma` y
`test:limite-usuarios` en verde.

## T1 · Base: tres columnas en `empresas` `[x]`

Migración aditiva: `limite_usuarios` (Int?), `nombre_plan` (String?), `precio_plan` (Int?). Ninguna fila existente
cambia. Al escribir la migración se encontró, leyendo `20261004130000_la_agencia_edita_su_perfil`, que
`app_empresa_solo_perfil` ya bloquea a una agencia editar columnas que no son su perfil/marca — las tres nuevas
son del superadministrador igual que `estado`, así que la misma migración vuelve a crear ese disparador con las
tres agregadas a la lista (si no, una agencia podría subirse su propio límite desde "Mi empresa"). Migración
aplicada (`prisma migrate deploy`) y cliente regenerado (`db:generate`).

## T2 · Crear y editar agencia `[x]`

`createCompanySchema`/`updateCompanySchema` con los tres campos opcionales (`schemas/companies.schema.js`).
`companies.service.js::create` con los valores por defecto del plan base si no llegan explícitos; `update()` los
agrega a su mapa de columnas; `aFicha()` los devuelve en la respuesta.

## T3 · El servidor frena el alta por encima del límite `[x]`

`users.service.js::_comprobarLimiteDeUsuarios()`, llamado al principio de `createUser` (cubre también
`reactivarUsuario`, que solo se llama desde ahí): cuenta usuarios activos (`status: 'active', deleted_at: null`)
de la agencia actual, 422 con el mensaje fijo si ya llegó al límite y el límite no es nulo.

## T4 · Prueba por la API `[x]`

`tests/limite-usuarios-api.js` (`pnpm test:limite-usuarios`): agencia nueva nace en plan base (límite 4, "Plan
Base", 300000); alta hasta el límite, el 5.º da 422; el superadministrador —de una agencia "casa" separada, que
no cuenta para el límite de la agencia de prueba, como en producción— sube el límite y el 5.º entra; dar de baja
libera un cupo de inmediato; límite nulo (plan Deluxe) sin tope. Corrida contra la base: todo en orden.

## T5 · Pantalla: sección "Plan" en la edición de una agencia `[x]`

`pages/Companies.tsx` (`FichaDeAgencia`): sección "Plan y licenciamiento" con "Límite de usuarios" (vacío = sin
límite), "Nombre del plan" y "Precio", tres campos sueltos sin selector de combinaciones fijas; `api/companies.ts`
con los tres campos en `Empresa`. `tsc` en verde.

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-24 | — | Diseño completo vía `/brainstorming` con el usuario: se descartó la idea original (candado manual, alta de usuarios a cargo del equipo) por un tope que aplica el servidor solo; sin facturación en el sistema; tres campos sueltos por agencia en vez de un catálogo de planes. Spec y plan escritos; nada implementado. |
| 2026-10-24 | T1-T5 | Implementado de punta a punta tras la aprobación ("esta bien empieza"): migración + disparador, schemas, servicio de agencias, el frenado en `createUser`, la prueba por la API y la pantalla. `node --check`, `tsc`, migración aplicada, `check:prisma` y `test:limite-usuarios` (`tests/limite-usuarios-api.js`) en verde. Sin commit ni push. |
| 2026-10-24 | — | Durante una auditoría general de fuga de datos entre agencias, `test:aislamiento-api` quedó en rojo (7 casos): la agencia de prueba de ese archivo da de alta muchos usuarios para probar roles y validaciones, y con el tope de 4 del plan base se topaba a mitad de camino con el 422 de "límite de usuarios" en vez del resultado que cada caso quería comprobar. No era un hueco: se corrigió subiendo el límite de esa agencia a `null` justo después de montarla (`tests/aislamiento-api.js`), y quedó en verde. También se corrigió `tests/aislamiento.js` (sin relación con esta spec): el contador fijo de claves ajenas compuestas (61) no se había subido a 62 tras spec 022. |
| 2026-10-24 | — | A pedido del usuario, el mensaje del 422 pasó de fijo ("Llegaste al límite de usuarios de tu plan...") a uno completo: nombre del plan, límite exacto y el WhatsApp de soporte (301 231 6848, fijo en el código a falta de un campo de contacto en el sistema) para pedir más licencias. `node --check` en verde; sin commit ni push. |
