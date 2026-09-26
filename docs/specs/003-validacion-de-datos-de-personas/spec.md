# Spec 003 — Validación de los datos de una persona

**Estado:** en ejecución · **Rama:** `feat-dbmoon` · **Alcance de esta entrega:** el módulo de clientes · **Relacionada:** [`002-estabilizacion-multi-tenant`](../002-estabilizacion-multi-tenant/spec.md)

Este documento dice **qué** tiene que pasar y **cómo se comprueba**. El *cómo* está en `plan.md`; lo
hecho y lo pendiente, en `tasks.md`.

## Problema

El formulario de clientes validaba en el navegador, con huecos, y el servidor no validaba nada:

- **El documento aceptaba letras para cualquier tipo.** La regla era `letras y números, de 5 a 20`,
  sin mirar el tipo: una cédula de ciudadanía con letras pasaba.
- **Los nombres rechazaban a gente real.** Aceptaban solo `a-z` con cinco vocales acentuadas, así que
  "García-Márquez", "O'Brien" y "Müller" no se podían escribir.
- **El servidor no comprobaba nada** (todo opcional, sin formato). Cualquier regla del formulario se
  saltaba con una llamada directa a la API.
- **Un tipo de documento que no existe se ignoraba en silencio**: el cliente se guardaba sin tipo.
- **Los errores del servidor no llegaban a la pantalla.** Se envolvían en un `Error` genérico en tres
  sitios y se perdía `error.details`, que trae cada mensaje con su campo.

## Qué será posible al terminar

1. Un documento se valida según su tipo: en una cédula no entran letras, en un pasaporte sí.
2. Nombres y apellidos aceptan las letras de cualquier persona (tildes, ñ, ü, guion, apóstrofe) y
   ningún número ni símbolo.
3. Las reglas las impone el servidor; el formulario las replica para avisar mientras se escribe.
4. Cada error aparece junto a su campo, venga del formulario o del servidor.

## Reglas (decididas con el equipo)

| Campo | Regla |
|---|---|
| Cédula de ciudadanía (`CC`) | Solo números, 6 a 10 dígitos |
| Tarjeta de identidad (`TI`) | Solo números, 10 u 11 dígitos |
| Cédula de extranjería (`CE`) | Solo números, 6 a 10 dígitos |
| `NIT` | 9 a 11 números, con o sin guion antes del dígito de verificación (`900123456-7`) |
| Pasaporte (`PA`) | Letras y números, 5 a 15 caracteres |
| Tipo nuevo, sin regla propia | Letras y números, 4 a 20 caracteres |
| Todo documento | Sin espacios ni puntos; se guarda en mayúsculas |
| Nombres y apellidos | Letras (con tildes, ñ, ü), espacios, guion y apóstrofe; 2 a 40; sin números ni símbolos |
| Teléfono | 7 a 15 dígitos; admite `+` al inicio, espacios y guiones. Opcional |
| Email | Formato válido, máximo 180. Opcional |
| Fecha de nacimiento | No futura y no anterior a 120 años. Opcional |

El servidor exige nombres, apellidos, tipo y número de documento. En el formulario, el email y el
teléfono siguen siendo obligatorios; por la API son opcionales, pero si llegan se validan.

## Criterios de aceptación

| # | Criterio | Cómo se comprueba | Estado |
|---|---|---|---|
| C1 | Una cédula no acepta letras, un pasaporte sí | `POST /clients` con `CC` y `ABC1234`: 422 en `docNumber`. Con `PA` y `ab123456`: 201 y se guarda `AB123456` | cumplido |
| C2 | Los nombres no aceptan números ni símbolos, y sí guion y apóstrofe | `Juan2`, `P3rez`, `Ana@`: 422 en su campo. `O'Brien`, `Ñañez Müller`: 201 | cumplido |
| C3 | Cada error vuelve con su campo | `error.details` = `[{ field, message }]`, un elemento por campo que falla | cumplido |
| C4 | Un tipo de documento inexistente se rechaza | `docType: 'ZZ'`: 422 en `docType`, y no se crea nada | cumplido |
| C5 | Tipo y número de documento se envían juntos al editar | `PUT` con solo uno de los dos: 422. Con los dos: el número se valida contra el tipo nuevo | cumplido |
| C6 | Un documento repetido se rechaza con su campo | 400 `DUPLICATE_DOCUMENT` con `details` en `docNumber`, al crear y al editar | cumplido |
| C7 | El servidor guarda lo normalizado y descarta lo que no conoce | Nombre sin espacios de sobra, email en minúsculas, documento en mayúsculas; `empresa_id` y `rol` en el cuerpo no llegan al servicio | cumplido |
| C8 | En el formulario no se puede teclear lo que no corresponde y el error sale junto al campo | Letras en un documento numérico y números en un nombre no entran; cambiar el tipo revalida el número; un 422 del servidor se pinta en su campo | hecho, sin probar en el navegador |
| C9 | Las reglas del servidor y las del formulario no discrepan | Las dos versiones comparadas sobre 237 entradas | cumplido |

## Fuera de alcance

- **Los demás módulos que capturan personas**: usuarios, responsables, comisionistas, los pasajeros
  del asistente de venta y los campos `docType`/`docNumber` de sus formularios de producto. Las
  reglas ya están en un módulo reutilizable; conectarlos es una entrega por módulo.
- **Reglas configurables por tipo desde gestión interna.** Habría que añadir una columna a
  `tipos_documento`, una tabla compartida de la base que usan las dos ramas. Se descartó por ahora.
- **El dígito de verificación del NIT** (cálculo módulo 11): hoy solo se comprueba la forma.
- **Comprobar que el documento exista** en una fuente oficial.

## Riesgos

**Reglas duplicadas a mano.** Viven en `backend/src/utils/datosPersona.js` y en
`frontend/src/utils/datosPersona.ts`, sin un paquete compartido. Se comprobó que coinciden (C9), pero
nada lo vigila: cambiar una obliga a cambiar la otra.

**Un tipo nuevo cae en la regla genérica.** Quien cree un tipo de documento en gestión interna lo
verá aceptar letras y números hasta que se le agregue su regla en el código.

**Datos históricos.** Hoy hay 4 clientes reales, todos cumplen. Si un cliente antiguo tuviera un
documento o un nombre que no cumple, no se podría editar hasta corregirlo.
