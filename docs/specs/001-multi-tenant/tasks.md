# Tareas — Spec 001

Cada tarea deja el sistema funcionando. Ninguna se da por hecha sin su comprobación.

Leyenda: `[x]` hecho · `[~]` en curso · `[ ]` pendiente

---

## T0 · Desbloquear el schema `[x]`

`DIRECT_URL` apuntaba a `db.<ref>.supabase.co`, que solo tiene registro IPv6, y esta red
no tiene salida IPv6: `prisma generate --sql` y `db push` fallaban con `P1001`. Ahora
apunta al pooler en modo sesión (mismo host que `DATABASE_URL`, puerto 5432, sin los
parámetros de pgbouncer).

**Comprobado:** `pnpm db:generate` termina bien · el cliente tipado de SQL sigue ahí ·
`codigos_recuperacion` ya aparece en el cliente · `migrate diff` sale vacío, o sea que
schema y base están sincronizados · 23 endpoints de lectura en 200.

*De paso:* `.gitignore` pasó de enumerar variantes de `.env` a `.env*`, porque un backup
del `.env` con la contraseña dentro apareció como fichero sin seguir.

---

## T1 · El mecanismo de contexto, en vacío `[x]`

- `src/config/tenant.js` — la empresa activa en un `AsyncLocalStorage`, con `conEmpresa`,
  `sinEmpresa` y la bandera de transacción.
- `src/config/db.js` — la extensión en forma de lote y el helper `transaccion`.
- Los 18 `$transaction` de 8 archivos pasan por el helper. No queda ninguno suelto.

Mientras no haya empresa en el contexto la extensión no interviene, así que hoy el
comportamiento es idéntico al de antes. Se activa sola en T5, cuando el token traiga la
empresa.

**Comprobado:**
1. El contexto llega tanto a una operación de modelo como a un `$queryRawUnsafe` (`"7"`),
   y dentro del helper sobrevive a las operaciones intermedias.
2. Sin empresa, la latencia no se mueve: 319 ms por consulta, igual que antes. Con empresa
   serán 447 ms (**x1,40**), que es el precio de la barrera y coincide con lo medido al
   diseñar.
3. **Una transacción que falla a mitad no deja nada**, con y sin empresa en el contexto.
4. 24 endpoints de lectura en 200, y el ciclo completo de escritura con transacción
   —POST, PATCH y DELETE de un producto— deja la venta en su importe original.

**Dos cosas que aparecieron al probar, y que el diseño no tenía:**

- **La transacción interactiva de la extensión no fijaba el contexto.** `query(args)` no
  corre dentro de ella, así que el `SET LOCAL` iba a otra conexión y llegaba vacío. La
  forma de lote sí funciona. Ya estaba anotado en las decisiones; aquí quedó confirmado en
  código.
- **`prisma.$transaction([a, b, c])` deja de ser atómico con la extensión activa**, y en
  silencio: un lote con la segunda operación imposible dejó **la primera escrita**. Cada
  elemento pasa por la extensión y se envuelve en su propia transacción antes de que el
  lote exista. Afectaba a 7 sitios reales, entre ellos borrar un usuario y restablecer una
  contraseña. Los 7 están convertidos a la forma interactiva y la de lote queda prohibida,
  documentado en `db.js`.

## T2 · La tabla `empresas` y el rol de aplicación `[ ]`

Migración de Prisma con `empresas` y `suplantaciones`; alta de la empresa 1 con la marca
actual; rol de Postgres sin `BYPASSRLS` y que no sea dueño de las tablas; `DATABASE_URL`
apuntando a él.

**Comprobación:** la aplicación arranca con el rol nuevo y los 23 endpoints siguen en 200.

## T3 · `empresa_id` en las 42 tablas `[ ]`

Columna nullable → relleno con 1 → `NOT NULL` → índices → claves ajenas compuestas → los
cuatro `@unique` rehechos. Todo en una migración.

**Comprobación:** `pnpm check:prisma` limpio y ninguna fila con `empresa_id` nulo en
ninguna de las 42.

## T4 · Encender la RLS `[ ]`

`ENABLE` + `FORCE ROW LEVEL SECURITY` y política en las 42, más `empresas` y las métricas.

**Comprobación:** criterios **A1 y A2** con dos empresas sembradas y datos en las dos.
Automatizada, no manual: es la prueba que se queda en el repo.

## T5 · Autenticación, URL y empresa suspendida `[ ]`

`empresa_id` en el token y en `sesiones`; middleware que rellena el contexto; slugs
reservados; 403 si el slug de la URL no es el de tu empresa; login bloqueado para empresa
suspendida; alta de empresa sembrando sus 4 roles y su matriz. Aquí se corrigen los 11
`findUnique` por documento y por nombre de rol que T3 habrá roto.

**Comprobación:** criterios **A3, A6, A8**.

## T6 · Numeración propia por empresa `[ ]`

`ventas.numero` y sustituirlo en los cinco sitios donde hoy se pinta el id, incluido el
voucher que recibe el cliente. La búsqueda por id del listado pasa a `numero`.

**Comprobación:** criterio **A4**.

## T7 · Ficheros y cachés `[ ]`

`/uploads` deja de ser estático y se sirve con `auth`; `empresaId` entra en la clave de
las cuatro cachés del navegador.

**Comprobación:** criterio **A9**, y que al suplantar y volver se pinten los catálogos de
la empresa en la que se está.

## T8 · Suplantación con auditoría `[ ]`

Entrar, salir, token con caducidad, tabla de auditoría y pantalla del superadmin.

**Comprobación:** criterio **A7**.

## T9 · La marca `[ ]`

`GET /branding`, colores aplicados en caliente sobre los canales CSS, logo y nombre desde
la base en los seis sitios, remitente y asuntos de correo por empresa.

**Comprobación:** criterios **A10 y A11**.

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-09-11 | T0 | Cerrada. El bloqueo era una línea del `.env`, no el TypedSQL: con `DIRECT_URL` bueno, la migración de las 42 tablas ya no hay que escribirla a mano. |
| 2026-09-11 | T1 | Cerrada. El mecanismo funciona y está inerte hasta T5. Encontrado de paso que la forma de lote de `$transaction` pierde la atomicidad con la extensión puesta: 7 sitios convertidos. |
