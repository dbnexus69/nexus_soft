# Plan — Spec 036

## A · SQL crudo vigilado
`scripts/check-prisma-fields.js` ya recorre el código del backend. Se le suma una pasada: para cada
`$queryRawUnsafe(`/`$executeRawUnsafe(` con plantilla, extraer los `${…}` del texto SQL (no los argumentos de después)
y fallar si alguno no está en `FRAGMENTOS_PERMITIDOS` — los que hoy se construyen sin datos del usuario (`whereSql`,
`fromSql`, `sqlOrderBy`, `orderDirection`, `VENTA_CON_COMISION_PENDIENTE`…; la lista sale del inventario). Cada
nombre de la lista lleva al lado el archivo donde se arma, para que añadir uno obligue a mirarlo. `config/db.js`
(el `set_config` del contexto) queda fuera por nombre de archivo.

## B · Una sola capa de datos
1. Inventario (sin tocar código): por cada función y lista de `DataContext` y de los hooks, quién la usa.
2. Lo que nadie usa, fuera. Lo duplicado se queda donde lo usa la mayoría: las páginas de usuarios, clientes y
   comisionistas ya van por sus hooks; `DataContext` conserva solo lo que necesitan el asistente de venta y los
   selectores (listas de catálogo y de personas para buscar), sin funciones de escritura que dupliquen las del hook.
3. Un cambio por recurso, con `tsc` en cada paso.

## C · `avatar`
`schemas/personaCampos.js` (o donde vivan los campos comunes): un `avatar` compartido —
`z.string().url().max(300).refine(origen permitido)` — usado en usuarios, clientes y comisionistas, nullable y
opcional como hoy. Si el usuario decide servirlos desde el frontend (decisión 1), el origen permitido pasa a ser la
ruta propia y `AvatarPicker.tsx` genera esas rutas; los avatares ya guardados con la URL vieja se siguen mostrando.

## D · Código muerto
Según las decisiones 2–4. `deleteResponsable` de `DataContext` se quita en cualquier caso (B).

## Comprobación
`check:prisma`, `test:validaciones`, `tsc` sin permiso; `test:aislamiento-api` con permiso si D toca rutas.
