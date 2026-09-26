# Tareas — Spec 003

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-09-25).** Hechas T1 y T3. Por confirmar en pantalla T2. Pendientes T4 a T6.

---

## T1 · Las reglas y el servidor `[x]`

Reglas en `backend/src/utils/datosPersona.js`; esquema Zod en `schemas/clients.schema.js`; el
controlador pasa `req.validatedBody`; el servicio rechaza un tipo inexistente y devuelve los
duplicados con su campo. Detalle en `plan.md`.

**Comprobado**, con el servidor real, `app_nexus` y una agencia de prueba montada y desmontada
(38 comprobaciones, 0 fallos):
- 15 altas inválidas dan 422 con el campo exacto: cédula con letras, con puntos y muy corta;
  tarjeta de identidad con 7 dígitos; cédula de extranjería con letras; NIT con letras; nombre,
  apellido y ambos con números o símbolos; sin nombre; sin tipo ni número; tipo inexistente; email
  mal formado; teléfono con letras; nacimiento futuro. **Ninguna crea un cliente.**
- Se aceptan un pasaporte con letras (guardado en mayúsculas), un NIT con dígito de verificación,
  una tarjeta de identidad con `Ñañez Müller` y una cédula de extranjería sin email ni teléfono.
- Un documento repetido: 400 con su campo, al crear y al editar.
- Edición: solo el teléfono pasa; solo el tipo o solo el número, 422; cédula con letras, 422;
  cambiar a pasaporte con letras, 200 y queda en mayúsculas.
- Los campos que el esquema no conoce (`empresa_id`, `rol`) no dan error y no llegan al servicio.
- **La fecha de nacimiento se guarda.** Se sospechó que no, porque el esquema declaraba
  `birth_date` y el formulario manda `birthDate`; el controlador pasaba el cuerpo crudo, así que
  nunca se perdía. Ahora el esquema declara `birthDate`, que es lo que lee el servicio.

`pnpm test:validaciones`: 110 comprobaciones, sin base de datos.

## T2 · El formulario `[~]`

`ClientModal.tsx` y `utils/datosPersona.ts` (espejo de las reglas): no se puede teclear lo que no
corresponde, cambiar el tipo revalida el número, la fecha de nacimiento muestra su error, y cada
detalle de un 422 se pinta en su campo. `useClients.ts` y `Clients.tsx` dejan pasar el error original.
`capitalizeName` respeta guion y apóstrofe.

**Comprobado:** `tsc --noEmit` limpio · las dos copias de las reglas comparadas sobre 237 entradas
(documentos por tipo, nombres, teléfonos y fechas): las únicas 8 diferencias son de redacción, con el
número vacío (el formulario dice "Obligatorio", como sus otros campos) · el formulario nunca altera
un valor válido al teclear · ninguna letra se cuela en un documento numérico.

**Por confirmar:** **no se ha probado en el navegador.** Falta recorrer: crear un cliente con cada
tipo, teclear letras en una cédula y números en un nombre, cambiar de `PA` a `CC` con letras
escritas, y provocar un 422 y un duplicado para ver el error junto a su campo.

## T3 · El chequeo de arranque reintenta `[x]`

Ver `plan.md`. Comprobado: con la red bien, arranca; el rol `postgres` sigue abortando a la primera
(comprobado en la spec 002); el error de conexión se reintenta hasta 3 veces.

---

## Pendientes

## T4 · Los demás módulos que capturan personas `[ ]`

Usuarios (`UserModal`), responsables, comisionistas, los pasajeros del asistente de venta
(`PassengerManager`) y los formularios de producto con `docType`/`docNumber` (`MigrationForm`,
`VisaForm`, …). Las reglas ya son reutilizables; cada módulo necesita su esquema en el servidor y su
formulario. Tres avisos del código actual, comprobados:
- Usuarios y comisionistas resuelven el tipo de documento por abreviatura e **ignoran en silencio**
  uno que no existe (`if (dt) …`), como hacía clientes.
- Responsables lo busca **por nombre** ("Cédula de Ciudadanía"), no por abreviatura, y también lo
  ignora si no existe. Es una inconsistencia con los otros tres: hay que decidir cuál es el contrato
  antes de aplicarle las reglas por abreviatura.
- Los pasajeros del asistente de venta se crean con `findOrCreatePersona`, una sola función dentro de
  `createSale` (`sales.service.js`), a partir de `name`, `docType` y `docNumber` sin validar su
  formato. La validación de productos de la spec 002 comprueba la forma del JSON, no el documento.

## T5 · El dígito de verificación del NIT `[ ]`

Hoy se comprueba la forma, no que el dígito sea el que corresponde (módulo 11 sobre los nueve
dígitos). Es una regla de la DIAN y se puede añadir sin tocar el resto.

## T6 · Que las dos copias de las reglas no se separen `[ ]`

Ahora se comprueba a mano. Una forma barata: una prueba que compile el módulo del frontend y lo
compare con el del servidor sobre un conjunto de entradas, como se hizo aquí, dentro de
`backend/tests/`.

---

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-09-25 | T3 | El chequeo de arranque de la 002 reintenta ante un corte de red. |
| 2026-09-25 | T2 | El formulario de clientes valida según el tipo de documento y pinta los errores del servidor junto a su campo. Sin probar en el navegador. |
| 2026-09-25 | T1 | El servidor valida clientes: 38 comprobaciones por la API. Salió que un tipo de documento inexistente se ignoraba en silencio, y que el esquema no se aplicaba (el controlador pasaba el cuerpo crudo). |
