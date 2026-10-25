# Plan — Spec 030

## Decisiones

1. **Lista en `companies.service.js`, no en una migración.** Son datos, no esquema;
   `PROVEEDORES_INICIALES` vive junto a `METODOS_DE_PAGO_INICIALES`, mismo lugar,
   mismo criterio.
2. **Se exporta desde el módulo** (`module.exports.PROVEEDORES_INICIALES`) para que
   el script de siembra use la misma lista — nunca una copia que se pueda
   desalinear con el tiempo.
3. **El script de respaldo entra en el contexto de cada agencia** (`conEmpresa`),
   usando el cliente de Prisma de la aplicación (`config/db.js`), no una conexión de
   administrador aparte: así la política de la base decide, igual que en producción,
   y no hay que acordarse de poner `empresa_id` a mano en cada fila.
4. **Idempotente por nombre.** `proveedores` no tiene un único por
   `(empresa_id, nombre)` (a diferencia de `metodos_pago`), así que el script
   comprueba a mano qué nombres ya tiene cada agencia antes de insertar los que
   falten — correrlo dos veces no duplica nada.

## Pasos

| Paso | Dónde | Qué |
|---|---|---|
| 1 | `companies.service.js` | `PROVEEDORES_INICIALES` + `createMany` en `create()`, junto a métodos de pago |
| 2 | `companies.service.js` | Exportar la lista para el script |
| 3 | `prisma/seed-proveedores-iniciales.js` (nuevo) | Siembra en las agencias que ya existen |
| 4 | `package.json` | `db:seed:proveedores` |
