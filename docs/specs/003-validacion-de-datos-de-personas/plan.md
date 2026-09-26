# Plan técnico — Spec 003

## Decisiones

**1. Las reglas viven en el código, por abreviatura del tipo.** `REGLAS_DOCUMENTO` en
`backend/src/utils/datosPersona.js`, con una `REGLA_GENERICA` para lo que no esté. Se descartó una
columna en `tipos_documento` (configurable desde gestión interna): es una tabla compartida y cada
cambio de esquema en la base compartida obliga a la otra rama a traer la migración. Si algún día hace
falta un tipo con regla propia y sin tocar código, será una entrega aparte.

**2. El servidor manda; el navegador avisa.** `POST /clients` y `PUT /clients/:id` validan con Zod
(`schemas/clients.schema.js`) y el controlador pasa `req.validatedBody` al servicio, no `req.body`.
Antes el esquema solo validaba y el servicio recibía el cuerpo crudo, así que ninguna normalización
podía llegar a la base. El servicio recibe ya recortado, sin espacios de sobra, con el documento en
mayúsculas y el email en minúsculas, y **solo con los campos que el esquema declara**.

**3. El tipo y el número de documento van juntos.** El número solo se puede juzgar sabiendo el tipo.
En la edición, si llega uno sin el otro, es 422: el formulario siempre envía los dos, y así no hay
que leer el tipo guardado para validar.

**4. Un tipo inexistente es un error, no un `null`.** El servicio comprueba el tipo contra
`tipos_documento` y responde 422 con su campo. Antes se ignoraba y el cliente quedaba sin tipo.

**5. Los errores viajan con su campo hasta el input.** El servidor responde `error.details:
[{ field, message }]` en los 422 y en los duplicados (400 `DUPLICATE_DOCUMENT`). `useClients` y
`Clients.tsx` dejan de envolver el error, y `ClientModal` reparte cada detalle a su campo; lo que no
corresponda a un campo va en el aviso general.

**6. El formulario no deja teclear lo que no corresponde.** En un tipo numérico solo entran dígitos
(el NIT admite un guion), en un nombre no entran números ni símbolos, y pegar `1.234.567` deja
`1234567`. Al cambiar el tipo se **revalida** el número ya escrito y se avisa, sin borrarlo.

**7. `capitalizeName` respeta guion y apóstrofe.** Ponía mayúscula solo tras un espacio: al permitir
`García-Márquez` y `O'Brien` los dejaba como `García-márquez` y `O'brien`. Sigue colapsando los
espacios repetidos, como antes.

**8. Una prueba de las reglas que no necesita la base.** `backend/tests/validaciones.js`
(`pnpm test:validaciones`): 110 comprobaciones sobre las funciones y el esquema, sin marco de pruebas,
como `aislamiento.js`.

## Superficie de API

| Cambio | Detalle |
|---|---|
| `POST /clients` | 422 con `error.details` por campo. Exige nombres, apellidos, tipo y número de documento. |
| `PUT /clients/:id` | Parcial. Tipo y número juntos. 422 con `details`. |
| Documento repetido | 400 `DUPLICATE_DOCUMENT` con `details` en `docNumber`. En la edición el mensaje deja de decir "en el sistema" (solo mira la agencia) y pasa a decir "de la agencia". |
| Tipo de documento inexistente | 422 con `details` en `docType` (antes se ignoraba). |
| Campos que el esquema no declara | Se descartan antes de llegar al servicio. |

No hay endpoints nuevos ni retirados, y no hay migraciones.

## Un cambio que no es de esta spec

El chequeo de arranque de la spec 002 (`src/index.js`) abortaba ante **cualquier** error al comprobar
el rol. Un corte de red de un segundo al arrancar lo tumbaba, y en esta máquina el pooler se vuelve
inalcanzable de forma intermitente. Ahora reintenta hasta 3 veces, con 2 s de espera, **solo** si no
llega a la base; un rol que salta la RLS sigue abortando a la primera.

## Orden de ejecución

Primero el servidor (esquema, controlador, servicio) y su comprobación contra la API real, porque es
lo que manda. Después el formulario y el desenvolver de errores, y por último la comprobación de que
las dos copias de las reglas coinciden.
