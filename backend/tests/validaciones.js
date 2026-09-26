#!/usr/bin/env node
/**
 * Las reglas de los datos de una persona. `pnpm test:validaciones`
 *
 * No toca la base ni levanta el servidor: prueba las funciones puras y el esquema de clientes.
 * Sin marco de pruebas, como `aislamiento.js`.
 */
const {
  normalizarDocumento, mensajeDocumento, normalizarNombre, mensajeNombre, mensajeTelefono, mensajeNacimiento,
} = require('../src/utils/datosPersona');
const { createClientSchema, updateClientSchema } = require('../src/schemas/clients.schema');

let fallos = 0;
let total = 0;
function comprobar(descripcion, condicion, detalle = '') {
  total++;
  if (!condicion) fallos++;
  if (!condicion) console.log(`  ✗ ${descripcion}${detalle ? `  → ${detalle}` : ''}`);
}

const documento = (tipo, numero) => mensajeDocumento(tipo, normalizarDocumento(numero));
const acepta = (tipo, numero) => comprobar(`${tipo} acepta "${numero}"`, documento(tipo, numero) === null, documento(tipo, numero));
const rechaza = (tipo, numero) => comprobar(`${tipo} rechaza "${numero}"`, documento(tipo, numero) !== null);

console.log('\nReglas de datos de una persona\n');

// ── Documento, según el tipo
['1234567', '123456', '1234567890'].forEach(n => acepta('CC', n));
['12345', 'ABC1234', '1.234.567', '1234 567', '12345678901', '', '123-4567', '１２３４５６７'].forEach(n => rechaza('CC', n));
['1234567890', '12345678901'].forEach(n => acepta('TI', n));
['123456789', 'A234567890', '123456789012'].forEach(n => rechaza('TI', n));
['123456', '1234567890'].forEach(n => acepta('CE', n));
['A123456', '12345'].forEach(n => rechaza('CE', n));
['900123456-7', '9001234567', '900123456', '12345678901', '1234567890-1'].forEach(n => acepta('NIT', n));
['12345678', 'ABC123456', '900123456-77', '900.123.456-7', '90012345-7'].forEach(n => rechaza('NIT', n));
['AB123456', 'ab123456', 'XA12345', '123456789012345'].forEach(n => acepta('PA', n));
['A123', 'AB-123456', 'AB 123456', '1234567890123456', 'AB12345!'].forEach(n => rechaza('PA', n));
acepta('cc', '1234567');
rechaza('cc', 'ABC1234');
acepta('XX', 'AB1234');
rechaza('XX', 'AB');
rechaza('XX', 'AB 1234');
comprobar('el documento se guarda en mayúsculas y sin bordes', normalizarDocumento('  ab123456 ') === 'AB123456');
comprobar('la letra minúscula de un pasaporte vale, porque se normaliza antes', documento('PA', 'ab123456') === null);

// ── Nombres y apellidos
const nombre = (v) => mensajeNombre(normalizarNombre(v));
['Juan Pablo', 'María José', "O'Brien", 'García-Márquez', 'Müller', 'Ñandú', 'Ana', 'Jean-Luc', 'D’Angelo'].forEach(v =>
  comprobar(`nombre acepta "${v}"`, nombre(v) === null, nombre(v)));
['Juan2', '123', 'Ana_', 'A', '', '   ', '-Ana', 'Ana-', "Ana'", 'Ana@Gomez', 'J0hn', 'x'.repeat(41)].forEach(v =>
  comprobar(`nombre rechaza "${v}"`, nombre(v) !== null));
comprobar('un nombre con espacios de sobra se guarda limpio', normalizarNombre('  Ana   María ') === 'Ana María');
comprobar('un número dentro del nombre nunca pasa', nombre('María2') !== null && nombre('2María') !== null && nombre('Ma2ría') !== null);

// ── Teléfono
['3001234567', '+57 300 123 4567', '300-123-4567', '', '6011234567', '1234567'].forEach(v =>
  comprobar(`teléfono acepta "${v}"`, mensajeTelefono(v) === null, mensajeTelefono(v)));
['123', 'abc1234567', '300+1234567', '1234567890123456', '300 123 45 6a', '++573001234567'].forEach(v =>
  comprobar(`teléfono rechaza "${v}"`, mensajeTelefono(v) !== null));

// ── Fecha de nacimiento
const anio = new Date().getFullYear();
['1990-05-20', `${anio - 1}-01-01`, `${anio - 119}-12-31`, ''].forEach(v =>
  comprobar(`nacimiento acepta "${v}"`, mensajeNacimiento(v) === null, mensajeNacimiento(v)));
[`${anio + 1}-01-01`, `${anio - 121}-01-01`, '2020-02-30', 'ayer', '1990-13-01'].forEach(v =>
  comprobar(`nacimiento rechaza "${v}"`, mensajeNacimiento(v) !== null));

// ── El esquema de clientes, con lo que manda el formulario
const valido = { firstName: '  juan   pablo ', lastName: 'Pérez', docType: 'CC', docNumber: '1234567', email: 'A@B.CO', phone: '300 123 4567', birthDate: '1990-05-20' };
const alta = createClientSchema.safeParse(valido);
comprobar('un alta válida pasa', alta.success, alta.success ? '' : JSON.stringify(alta.error.issues));
comprobar('y llega normalizada: nombre sin espacios de sobra y email en minúsculas',
  alta.success && alta.data.firstName === 'juan pablo' && alta.data.email === 'a@b.co');
const camposConError = (datos, esquema = createClientSchema) => {
  const r = esquema.safeParse(datos);
  return r.success ? [] : [...new Set(r.error.issues.map(i => i.path.join('.')))].sort();
};
comprobar('una cédula con letras falla en docNumber', camposConError({ ...valido, docNumber: 'ABC1234' }).join() === 'docNumber');
comprobar('un pasaporte con letras pasa', camposConError({ ...valido, docType: 'PA', docNumber: 'AB123456' }).length === 0);
comprobar('un nombre con números falla en firstName', camposConError({ ...valido, firstName: 'Juan2' }).join() === 'firstName');
comprobar('un apellido con números falla en lastName', camposConError({ ...valido, lastName: 'P3rez' }).join() === 'lastName');
comprobar('sin tipo ni número, fallan los dos', camposConError({ firstName: 'Ana', lastName: 'Gómez' }).join() === 'docNumber,docType');
comprobar('sin nombre ni apellido, fallan los dos', camposConError({ docType: 'CC', docNumber: '1234567' }).join() === 'firstName,lastName');
comprobar('el email y el teléfono vacíos no estorban', camposConError({ ...valido, email: '', phone: '', birthDate: '' }).length === 0);
comprobar('un email mal formado falla', camposConError({ ...valido, email: 'no-es-email' }).join() === 'email');
comprobar('un teléfono con letras falla', camposConError({ ...valido, phone: 'abc' }).join() === 'phone');
comprobar('un nacimiento futuro falla', camposConError({ ...valido, birthDate: `${anio + 1}-01-01` }).join() === 'birthDate');
comprobar('el esquema no deja pasar campos que no conoce', alta.success && !('name' in alta.data) && !('rol' in alta.data)
  && createClientSchema.safeParse({ ...valido, rol: 'admin', name: 'x' }).data.rol === undefined);

// ── La edición, parcial
comprobar('editar solo el teléfono pasa', camposConError({ phone: '3001234567' }, updateClientSchema).length === 0);
comprobar('editar solo el nombre pasa', camposConError({ firstName: 'Ana' }, updateClientSchema).length === 0);
comprobar('editar solo el número, sin el tipo, se rechaza', camposConError({ docNumber: '1234567' }, updateClientSchema).join() === 'docType');
comprobar('editar solo el tipo, sin el número, se rechaza', camposConError({ docType: 'PA' }, updateClientSchema).join() === 'docNumber');
comprobar('editar tipo y número juntos valida el número contra el tipo nuevo', camposConError({ docType: 'CC', docNumber: 'AB123456' }, updateClientSchema).join() === 'docNumber');
comprobar('editar un nombre a algo con números falla', camposConError({ lastName: 'G0mez' }, updateClientSchema).join() === 'lastName');
comprobar('editar sin campos pasa (no hay nada que validar)', camposConError({}, updateClientSchema).length === 0);

console.log(fallos === 0 ? `\nTodo en orden (${total} comprobaciones).\n` : `\n${fallos} de ${total} comprobación(es) en rojo.\n`);
process.exit(fallos === 0 ? 0 : 1);
