# Tareas — Spec 003

Leyenda: `[x]` hecho · `[~]` hecho, con algo por confirmar · `[ ]` pendiente

**Estado (2026-10-03).** Hechas T1, T3, T5 y T6. T2 confirmada en el navegador. T4 hecha (por confirmar en pantalla). Con esto la 003 queda completa.

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

## T2 · El formulario `[x]`

`ClientModal.tsx` y `utils/datosPersona.ts` (espejo de las reglas): no se puede teclear lo que no
corresponde, cambiar el tipo revalida el número, la fecha de nacimiento muestra su error, y cada
detalle de un 422 se pinta en su campo. `useClients.ts` y `Clients.tsx` dejan pasar el error original.
`capitalizeName` respeta guion y apóstrofe.

**Comprobado:** `tsc --noEmit` limpio · las dos copias de las reglas comparadas sobre 237 entradas
(documentos por tipo, nombres, teléfonos y fechas): las únicas 8 diferencias son de redacción, con el
número vacío (el formulario dice "Obligatorio", como sus otros campos) · el formulario nunca altera
un valor válido al teclear · ninguna letra se cuela en un documento numérico.

**Confirmado en el navegador (2026-10-03)**, con una agencia desechable: un cliente de cada tipo (CC,
CE, NIT, PA, TI) se guarda; el nombre descarta los números, la cédula descarta letras, puntos y guiones;
cambiar de `PA` a `CC` con letras escritas muestra el error del número sin borrarlo ("La cédula de
ciudadanía lleva solo números…"); y un documento repetido sale junto a "No. Documento" ("Este número de
documento ya está registrado como cliente activo"). El 422 por otras reglas no se provocó aparte: el
formulario no deja enviar datos inválidos, y el servidor ya está cubierto por `test:validaciones`.

## T3 · El chequeo de arranque reintenta `[x]`

Ver `plan.md`. Comprobado: con la red bien, arranca; el rol `postgres` sigue abortando a la primera
(comprobado en la spec 002); el error de conexión se reintenta hasta 3 veces.

---

## Pendientes

## T4 · Los demás módulos que capturan personas `[x]`

**Decisión (2026-10-03, con el usuario): el contrato del tipo de documento es el id.** Las pantallas
eligen el tipo de la lista que trae la base (`tipos_documento`: id, nombre, abreviatura) y mandan su
`docTypeId`; el servidor busca la abreviatura por ese id para aplicar la regla del número, y el nombre se
muestra según el id elegido. No hay texto que pueda no coincidir con la base. `docType` (abreviatura, o el
nombre que usaba Responsables) se sigue aceptando para los clientes y las rutas anteriores. Un tipo que
no existe es un 422 con su campo (`docTypeId` o `docType`), nunca un `null` en silencio.

**Hecho — usuarios, comisionistas y responsables:**
- **Servidor.** `utils/tipoDocumento.js` (`resolverTipoDocumento`, `validarDocumento`) y
  `schemas/personaCampos.js` (los campos de una persona con sus reglas, compartidos). Los tres esquemas
  validan nombres (usuarios y responsables; el nombre de un comisionista puede ser una empresa y no se
  restringe a letras), teléfono, fecha de nacimiento y que tipo y número viajen juntos; el servicio resuelve
  el tipo y aplica la regla del número, con el dígito del NIT. Los controladores pasan `req.validatedBody`
  (antes pasaban el cuerpo crudo). Las respuestas de usuarios y comisionistas traen `docTypeId` además de
  `docType`. Ojo con la poda de Zod: al pasar el cuerpo validado, un campo que el esquema no declara se
  pierde, y salieron dos que se habrían perdido (`birthDate` de usuarios; `banco`, `tipoCuenta` y
  `numeroCuenta` de comisionistas): ya declarados.
- **Formularios.** `UserModal`, la modal de `CommissionAgents.tsx` y la de `Responsables.tsx`: el selector
  guarda el id y muestra el nombre del tipo, el número no admite lo que no corresponde (`limpiarDocumento`),
  los nombres y el teléfono usan las reglas compartidas, cambiar de tipo revalida el número sin borrarlo, y
  cada error del servidor (`error.details`) se pinta junto a su campo. `Users.tsx` deja de tragarse el error
  para que llegue a la modal. Comisionistas y Responsables tenían sus propias reglas de documento, que
  chocaban con las del servidor (CC de 8 a 10 dígitos, NIT "exactamente 11 caracteres", `123456789-0` como
  ejemplo, que ahora tiene el dígito mal): se reemplazan por las compartidas.
- **Comprobado:** 16 comprobaciones nuevas por la API real dentro de `pnpm test:aislamiento-api` (sección
  "Datos de personas"): cédula con letras, número sin tipo, id de tipo inexistente, nombre con números,
  alta por id (llega como texto del `<select>`), por abreviatura y, en responsables, por nombre; la
  respuesta trae el id y el tipo; editar con un número inválido; NIT con el dígito mal (el mensaje dice cuál
  es) y bien; teléfono con letras; un comisionista con nombre de empresa. `tsc` limpio, `check:prisma`
  limpio, `test:validaciones` y `test:reglas-espejo` en verde.
- **Por confirmar en pantalla (no se probó en el navegador):** los tres formularios. Crear uno de cada con
  cada tipo; teclear letras en una cédula y números en un nombre; cambiar de tipo con el número escrito;
  un NIT con el dígito mal; y, en Usuarios, provocar un correo repetido para ver el aviso general.

**Hecho después (2026-10-03) — los pasajeros del asistente y los formularios de producto:**
- **Servidor** (`sales.service.js`). `_validarPersonas` comprueba, antes de abrir la transacción, el
  documento de cada persona de la venta —`passengers`, `guests`, `travelers`, `members` y el titular de los
  productos de un solo titular— con las mismas reglas que un cliente (incluido el dígito del NIT). Un tipo
  que no existe da 422 en `<lista>.<i>.<pasajeros>.<j>.docType`; un número que no vale, en `…docNumber`;
  un documento sin tipo se juzga con la regla genérica, como hasta ahora los formularios que no lo piden.
  `findOrCreatePersona` normaliza el documento (recorta y pone en mayúsculas, también en la precarga) y
  **guarda el tipo**: antes la persona quedaba con `tipo_documento_id` nulo siempre. Los formularios de
  producto mandan el tipo por abreviatura (o, el de visa, por nombre) y el servidor acepta las dos; no hizo
  falta cambiarlos a id, y los borradores guardados en el navegador siguen valiendo.
- **Asistente** (`documentosDeLaVenta.ts`, llamado desde `validateStep(2)`). Una sola función revisa el
  documento de todas las personas de la venta con las mismas reglas y avisa al pasar de los productos
  ("Hotel #1, huésped 2: La cédula…"), en vez de dejar el 422 para el final. No se tocaron los nueve
  formularios uno por uno.
- **Comprobado:** 5 comprobaciones más por la API real: cédula con letras, tipo inexistente y NIT mal dan
  422 con la ruta del campo; huéspedes válidos (tipo en minúscula, por nombre, número con espacios) dan 201
  y las personas quedan con el documento normalizado y su tipo. `tsc` limpio.
- **Por confirmar en pantalla:** en el asistente, poner una cédula con letras en un huésped y pulsar
  Siguiente: debe avisar sin avanzar.

**Y los clientes (2026-10-03):** `ClientModal` manda `docTypeId` y su selector muestra el nombre del tipo; el
esquema acepta `docTypeId` o `docType` y, con id, la regla del número la aplica el servicio
(`validarDocumento`). Salió de paso un hueco: un tipo escrito con solo espacios pasaba el esquema y el
cliente quedaba sin tipo; ahora es "sin tipo" y da 422 (`tipoDocumentoPorTexto` recorta antes de mirar si
está vacío). Comprobado por la API (cliente por id, cédula con letras por id, tipo de espacios).

**Falta:** los nombres de los pasajeros no se validan (llegan en un solo campo libre).

## T5 · El dígito de verificación del NIT `[x]`

Módulo 11 de la DIAN (pesos 3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71 de derecha a
izquierda sobre la base), en las dos copias de las reglas (`datosPersona.js` y `datosPersona.ts`).

**Cuándo se comprueba.** Solo cuando se sabe cuál es el dígito sin adivinar: con guion
(`900123456-8`) o con 11 cifras. Un NIT de 10 cifras sin guion puede ser un NIT de persona natural sin
dígito, y no se rechaza; uno de 9 cifras tampoco. El mensaje dice cuál es el correcto:
"El dígito de verificación del NIT no coincide: para 900123456 es 8".

**Ojo:** el ejemplo que daban el mensaje de formato y la spec, `900123456-7`, tenía el dígito mal (el
correcto es 8); se corrigió en los dos sitios. Los clientes ya guardados no se revalidan: el dígito solo
se exige al crear o editar.

**Comprobado:** el algoritmo da el dígito de dos NIT reales conocidos (890903938-8 y 860034313-7); 119
comprobaciones en `test:validaciones` (con y sin dígito, bien y mal, 9, 10 y 11 cifras) y las dos copias
coinciden en las entradas nuevas; `tsc` limpio.

## T6 · Que las dos copias de las reglas no se separen `[x]`

`backend/tests/reglas-espejo.js` (`pnpm test:reglas-espejo`): compila `datosPersona.ts` con el
`typescript` del frontend, lo carga junto a la copia del servidor y las compara sobre 785 entradas
(documentos por tipo —incluidos tipos desconocidos y en minúscula—, nombres, teléfonos, fechas de
nacimiento relativas a hoy y las normalizaciones). Compara el veredicto (vale / no vale), no la
redacción, que difiere a propósito. No toca la base. Falla con un mensaje claro si no están instaladas
las dependencias del frontend.

**Comprobado:** en verde; y cambiando a propósito la regla de la CC en el frontend (6–10 → 6–11 dígitos)
se pone en rojo en las entradas que difieren, y vuelve a verde al restaurarla.

*Lo que fijó:* sin tipo de documento, el formulario no valida el número ("Elija primero el tipo") y el
servidor lo rechaza en el esquema antes de llegar a la regla; la prueba comprueba que las dos puertas
cierran en vez de comparar el número.

---

## T7 · Fecha de nacimiento en el alta de usuarios `[~]`

Pedido: en "Registrar usuario" no se podía escribir la fecha a mano, y una fecha válida salía
como "no es válida".

Causa: `UserModal.tsx` usaba `react-tailwindcss-datepicker` (solo calendario) y guardaba en
`birthDate` el objeto `Date` que devuelve la librería, no el texto `AAAA-MM-DD`. La validación
(`mensajeNacimiento`) recibía `String(Date)` y respondía "Fecha inválida".

Arreglo: `UserModal` usa el `DatePicker` compartido de `TicketForm.tsx`, como el módulo de
clientes. Emite `AAAA-MM-DD`, admite escribir a mano y mantiene la validación de no futura y de
edad máxima.

**Comprobado:** `tsc` sin errores. **Pendiente:** probar el alta en pantalla con una fecha escrita a
mano y una elegida en el calendario. Otros usos de la librería (dashboard, `DateTimePicker` de
vuelos) no se han tocado.

## Registro

| Fecha | Tarea | Qué pasó |
|---|---|---|
| 2026-10-06 | T7 | Fecha de nacimiento de usuarios: escribible y validada como texto `AAAA-MM-DD`; `tsc` sin errores. Sin probar en pantalla. |
|---|---|---|
| 2026-10-03 | T4 | Usuarios, comisionistas y responsables validan sus datos de persona y el tipo de documento por id (`docTypeId`), en el servidor y en sus formularios; 16 comprobaciones por la API. Y los pasajeros del asistente de venta, en el servidor y al pasar del paso de productos. |
| 2026-10-03 | T5, T6 | El dígito de verificación del NIT (módulo 11, solo cuando el dígito es inequívoco) en las dos copias, y `pnpm test:reglas-espejo` compara las dos sobre 785 entradas. Se corrigió el ejemplo de NIT, que tenía mal el dígito. |
| 2026-10-03 | T2 | Confirmado en el navegador: un cliente por tipo, teclado que descarta lo que no corresponde, revalidación al cambiar de tipo y duplicado junto a su campo. |
| 2026-09-25 | T3 | El chequeo de arranque de la 002 reintenta ante un corte de red. |
| 2026-09-25 | T2 | El formulario de clientes valida según el tipo de documento y pinta los errores del servidor junto a su campo. Sin probar en el navegador. |
| 2026-09-25 | T1 | El servidor valida clientes: 38 comprobaciones por la API. Salió que un tipo de documento inexistente se ignoraba en silencio, y que el esquema no se aplicaba (el controlador pasaba el cuerpo crudo). |
