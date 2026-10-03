#!/usr/bin/env node
/**
 * Que las dos copias de las reglas de una persona no se separen. `pnpm test:reglas-espejo`
 *
 * Las reglas viven dos veces, a mano: `backend/src/utils/datosPersona.js`
 * (manda) y `frontend/src/utils/datosPersona.ts` (avisa mientras se escribe).
 * Si una cambia y la otra no, el formulario deja pasar lo que el servidor
 * rechaza, o al revés. Esta prueba compila la copia del frontend y compara
 * las dos sobre un conjunto de entradas (spec 003, T6).
 *
 * Compara el VEREDICTO (vale / no vale) y las normalizaciones, no la redacción:
 * el formulario dice "Obligatorio" donde el servidor dice "El número de
 * documento es obligatorio", y eso es a propósito.
 *
 * No toca la base ni levanta el servidor. Necesita las dependencias del
 * frontend instaladas (usa su `typescript` para compilar el archivo).
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const back = require('../src/utils/datosPersona');
const { fechaEnColombia } = require('../src/utils/fechas');

const RAIZ_FRONT = path.join(__dirname, '../../frontend');
const FUENTE = path.join(RAIZ_FRONT, 'src/utils/datosPersona.ts');

let ts;
try { ts = require(path.join(RAIZ_FRONT, 'node_modules/typescript')); }
catch {
  console.error('\n  ✗ no encuentro `typescript` en frontend/node_modules: instala las dependencias del frontend (pnpm install) para comparar las reglas.\n');
  process.exit(1);
}

/** Compila el .ts del frontend y lo carga; su única dependencia (`todayStr`) se reemplaza por el mismo "hoy" del servidor. */
function cargarFrontend() {
  const js = ts.transpileModule(fs.readFileSync(FUENTE, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const m = new Module(FUENTE);
  m.filename = FUENTE;
  m.paths = [];
  const requerir = (id) => {
    if (id === './formatters') return { todayStr: () => fechaEnColombia(new Date()) };
    throw new Error(`datosPersona.ts importa algo nuevo: "${id}". Añádelo a cargarFrontend().`);
  };
  new Function('exports', 'require', 'module', '__filename', '__dirname', js)(m.exports, requerir, m, FUENTE, path.dirname(FUENTE));
  return m.exports;
}
const front = cargarFrontend();

let fallos = 0;
let total = 0;
function igual(descripcion, a, b) {
  total++;
  if (a !== b) { fallos++; console.log(`  ✗ ${descripcion}  → servidor: ${JSON.stringify(a)}, formulario: ${JSON.stringify(b)}`); }
}
const vale = (mensaje) => mensaje === null;

console.log('\nReglas de personas: servidor y formulario\n');

// ── Documento, por tipo (incluidos los desconocidos, que caen en la regla genérica)
const TIPOS = ['CC', 'TI', 'CE', 'NIT', 'PA', 'cc', ' nit ', 'XX', 'DNI'];
const NUMEROS = [
  '', '   ', '1', '12345', '123456', '1234567', '1234567890', '12345678901', '123456789012',
  'ABC1234', 'abc1234', 'AB12345', 'ab12345', 'AB1234567890123', 'AB12345678901234', '1.234.567', '1 234 567',
  '123-4567', '900123456', '900123456-7', '900123456-8', '890903938-8', '890903938-9', '860034313-7', '9001234567', '9001234567-8', '9001234567-2', '12345678902', '90012345-67', '900123456--7',
  '１２３４５６７', '12345é', 'A1B2', 'A1B2C', 'ABCDEFGHIJKLMNOPQRST', 'ABCDEFGHIJKLMNOPQRSTU', '12 34', '00000000',
];
for (const tipo of TIPOS) {
  for (const n of NUMEROS) {
    const nb = back.normalizarDocumento(n);
    const nf = front.normalizarDocumento(n);
    igual(`normalizar documento ${JSON.stringify(n)}`, nb, nf);
    igual(`documento ${JSON.stringify(tipo)} ${JSON.stringify(n)}`,
      vale(back.mensajeDocumento(tipo, nb)), vale(front.mensajeDocumento(tipo, nf)));
  }
}

// ── Sin tipo: el formulario pide primero el tipo y el servidor lo exige en el
// esquema (no llega a la regla del número), así que aquí no se comparan los
// números sino que las DOS puertas cierran.
const { createClientSchema } = require('../src/schemas/clients.schema');
const base = { firstName: 'Ana', lastName: 'Pérez', docNumber: '1234567' };
for (const sinTipo of [undefined, '', '   ']) {
  // El desplegable del formulario nunca produce un tipo de solo espacios.
  if (sinTipo !== '   ') igual(`el formulario no valida un número sin tipo (${JSON.stringify(sinTipo)})`, false, vale(front.mensajeDocumento(sinTipo, '1234567')));
  igual(`el esquema de clientes rechaza un cliente sin tipo (${JSON.stringify(sinTipo)})`, false,
    createClientSchema.safeParse({ ...base, docType: sinTipo }).success);
}
igual('el esquema acepta el mismo cliente con tipo', true, createClientSchema.safeParse({ ...base, docType: 'CC' }).success);

// ── Nombres
const NOMBRES = [
  '', ' ', 'A', 'Ana', 'ana  maría', ' Ana María ', 'José Luis', "O'Brien", 'O’Brien', 'García-Márquez', 'Ñandú', 'Çelik',
  'Ana1', '1Ana', 'Ana_', 'Ana.', 'Ana,', '-Ana', 'Ana-', "'Ana", 'Ana--María', 'Ana  ', 'A'.repeat(40), 'A'.repeat(41),
  'Ana María Josefina de los Ángeles Pérez', '李', '李小龍', 'Ana\tMaría', 'Ana\nMaría', '😀',
];
for (const n of NOMBRES) {
  const nb = back.normalizarNombre(n);
  const nf = front.normalizarNombre(n);
  igual(`normalizar nombre ${JSON.stringify(n)}`, nb, nf);
  igual(`nombre ${JSON.stringify(n)}`, vale(back.mensajeNombre(nb)), vale(front.mensajeNombre(nf)));
}

// ── Teléfono
const TELEFONOS = [
  '', '123456', '1234567', '3001234567', '+573001234567', '+57 300 123 4567', '300-123-4567', '(300) 123 4567',
  '++573001234567', '300 123 45a7', '123456789012345', '1234567890123456', '+', '- - -', '３００１２３４５６７', '300.123.4567',
];
for (const t of TELEFONOS) igual(`teléfono ${JSON.stringify(t)}`, vale(back.mensajeTelefono(t)), vale(front.mensajeTelefono(t)));

// ── Fecha de nacimiento (relativa a hoy, para que no caduque)
const hoy = fechaEnColombia(new Date());
const [y, mo, d] = hoy.split('-').map(Number);
const fecha = (anio, mes, dia) => `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
const NACIMIENTOS = [
  '', hoy, `${hoy}T00:00:00.000Z`, fecha(y - 1, mo, d), fecha(y + 1, mo, d), fecha(y - 120, mo, d), fecha(y - 121, mo, d),
  fecha(y - 119, mo, d), '1990-01-15', '1990-02-30', '2001-02-29', '2000-02-29', '0000-01-01', '9999-12-31',
  '15/01/1990', '1990-1-15', 'ayer', '1990-13-01', '1990-00-10',
];
for (const n of NACIMIENTOS) igual(`nacimiento ${JSON.stringify(n)}`, vale(back.mensajeNacimiento(n)), vale(front.mensajeNacimiento(n)));

console.log(fallos
  ? `\n${fallos} diferencia(s) entre el servidor y el formulario, de ${total} comparaciones\n`
  : `\nLas dos copias coinciden en ${total} comparaciones\n`);
process.exit(fallos ? 1 : 0);
