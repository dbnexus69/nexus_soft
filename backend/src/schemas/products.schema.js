const { z } = require('zod');
const { Prisma } = require('@prisma/client');
const { BadRequestError } = require('../errors/AppError');

/**
 * Validación de los productos de una venta: las 30 rutas de POST/PUT que no
 * tenían ninguna.
 *
 * Las 45 rutas de producto salen de un solo `productHandler`, así que esto se
 * comprueba en un sitio y no en treinta declaraciones de ruta que alguien
 * puede olvidar al añadir la categoría dieciséis.
 *
 * Son dos capas, porque protegen cosas distintas:
 *
 * 1. **El sobre común** (`esquemaProducto`): el dinero, los ids de proveedor,
 *    las fechas y la FORMA de los pasajeros y los tramos. Las claves son las
 *    del cliente, así que el error puede nombrar su propio campo. Aquí está lo
 *    que de verdad importa: `precioProducto` mete `total`/`ta`/`supplierCost`
 *    en `detalle_venta`, y de ahí salen el total de la venta y su estado de
 *    cobro. Un `ta` negativo bajaba el total de la venta, y `Number('abc')||0`
 *    convertía la basura en un cero silencioso.
 *
 * 2. **Los tipos de la columna** (`comprobarColumnas`): se aplica al resultado
 *    del transform, contra el schema de Prisma. Cubre las quince categorías sin
 *    quince esquemas que puedan discrepar de sus transforms —y cubre la que
 *    venga después—. Es lo que convierte en 422 los `parseInt` que daban NaN
 *    (`aerolineaId`), las fechas inválidas y los valores fuera de un enum, que
 *    hoy salen como 500 de Prisma.
 *
 * Ninguna de las dos capas reescribe el cuerpo: comprueban y dejan pasar el
 * original. El handler sigue leyendo `req.body`, así que la validación no
 * puede cambiar por sorpresa lo que se guarda.
 */

const VALORES_ENUM = Object.fromEntries(
  Prisma.dmmf.datamodel.enums.map(e => [e.name, e.values.map(v => v.name)])
);
const COLUMNAS = new Map(
  Prisma.dmmf.datamodel.models.map(m => [m.name, new Map(m.fields.map(f => [f.name, f]))])
);

const vacio = (v) => v === null || v === undefined || v === '';

/** Importe: número no negativo. Se acepta como string, que es como llega. */
const dinero = z.union([z.string(), z.number()]).nullable().optional()
  .refine(v => vacio(v) || (Number.isFinite(Number(v)) && Number(v) >= 0),
    'debe ser un número no negativo');

/** Cantidad libre (peso, noches, personas): número, y no negativo. */
const cantidad = dinero;

/** Referencia a un catálogo: id entero positivo. */
const idRef = z.union([z.string(), z.number()]).nullable().optional()
  .refine(v => vacio(v) || (Number.isInteger(Number(v)) && Number(v) > 0),
    'debe ser un id numérico');

/**
 * Fecha interpretable. No se convierte: el handler la pasa por
 * `new Date(...)` o por `enHoraColombia(...)`, y este último espera la cadena
 * 'YYYY-MM-DD' tal como llega.
 */
const fecha = z.union([z.string(), z.number(), z.date()]).nullable().optional()
  .refine(v => vacio(v) || !Number.isNaN(new Date(v).getTime()), 'no es una fecha válida');

const texto = (max) => z.string().max(max, `no puede pasar de ${max} caracteres`).nullable().optional();

/** Un valor del enum de Postgres, con los alias que el transform normaliza. */
const valorEnum = (nombre, alias = []) => {
  const validos = [...VALORES_ENUM[nombre], ...alias];
  return z.union([z.string(), z.number()]).nullable().optional()
    .refine(v => vacio(v) || validos.includes(String(v)),
      `debe ser uno de: ${validos.join(', ')}`);
};

/**
 * Un pasajero. `passthrough` porque cada categoría llama al titular a su
 * manera —`mainDriver`, `ownerName`, `responsibleName`— y el handler ya sabe
 * resolverlo; aquí solo se comprueba lo que se usa.
 */
const pasajero = z.object({
  name: texto(180),
  passengerName: texto(180),
  fullName: texto(180),
  docType: texto(20),
  docNumber: z.union([z.string().max(40), z.number()]).nullable().optional(),
  esTitular: z.boolean().optional(),
  asiento: texto(20),
  seat: texto(20),
  nroReserva: texto(60),
  nroTiquete: texto(60),
}).passthrough();

const tramo = z.object({
  origin: texto(10),
  destination: texto(10),
  date: fecha,
  time: texto(10),
  departureTime: texto(10),
  arrivalDate: fecha,
  arrivalTime: texto(10),
  flightNumber: texto(30),
  seat: texto(20),
  ticketNumber: texto(60),
}).passthrough();

/**
 * El sobre común a las quince categorías: lo que lee `createDetalleProducto`.
 *
 * `passengers`, `guests` y `legs` se declaran como array a propósito. El
 * handler hace `for (const p of passengers)`, y una cadena también es
 * iterable: `passengers: "abc"` daba tres pasajeros llamados como el titular
 * de la venta, uno por letra, sin error ninguno.
 */
const SOBRE = {
  total: dinero,
  subtotal: dinero,
  ta: dinero,
  supplierCost: dinero,
  supplierId: idRef,
  supplierPaymentMethod: idRef,
  nombre_servicio: texto(200),
  observations: texto(2000),
  startDate: fecha,
  endDate: fecha,
  origin: texto(120),
  destination: texto(120),
  voucher_url: texto(500),
  passengers: z.array(pasajero).max(60, 'demasiados pasajeros').optional(),
  guests: z.array(pasajero).max(60, 'demasiados huéspedes').optional(),
  passengerInfo: pasajero.nullable().optional(),
  legs: z.array(tramo).max(24, 'demasiados tramos').optional(),
  returnLeg: tramo.nullable().optional(),
};

/**
 * Lo propio de cada categoría que no se puede dejar al azar: los enums de
 * Postgres y las cantidades. El resto de campos de cada transform son texto o
 * fecha y los cubre `comprobarColumnas`.
 */
const EXTRAS = {
  ticket: { flightMode: valorEnum('FlightMode') },
  hotel: { hotelType: valorEnum('TipoHotel'), nights: cantidad, guestCount: cantidad },
  // El transform traduce "pequeño" con eñe al `pequeno` del enum.
  pet: { size: valorEnum('TamanoMascota', ['pequeño']), weight: cantidad },
  insurance: { travelers: cantidad },
  simcard: { dataAmount: cantidad, days: cantidad },
  car: { days: cantidad },
  finca: { nights: cantidad, guestCount: cantidad },
  tour: { people: cantidad },
  convention: { attendees: cantidad },
  restaurant: { people: cantidad },
};

const ESQUEMAS = Object.fromEntries(
  Object.keys(require('../catalog/products').CATALOG).map(slug => [
    slug,
    z.object({ ...SOBRE, ...(EXTRAS[slug] || {}) }).passthrough(),
  ])
);

/** El esquema de una categoría. Sin esquema es un fallo de programación. */
function esquemaDeCategoria(slug) {
  const esquema = ESQUEMAS[slug];
  if (!esquema) throw new Error(`No hay esquema de producto para la categoría ${slug}`);
  return esquema;
}

/**
 * Comprueba el resultado del transform contra los tipos de la tabla.
 *
 * Prisma es estricto: un NaN en una columna Int, una cadena en un Float o un
 * valor fuera del enum abortan la transacción con un error suyo, que llega al
 * cliente como 500 y sin decir qué mandó mal. Esto lo adelanta a un 400 que
 * nombra la columna y el valor.
 *
 * Una columna que no existe en la tabla no es culpa del cliente sino del
 * transform, así que esa sale como error de servidor: es el fallo que dio el
 * 500 de las aerolíneas (`aerolinea_id` por `aerolineaId`).
 */
function comprobarColumnas(tabla, datos) {
  const campos = COLUMNAS.get(tabla);
  if (!campos) throw new Error(`La tabla ${tabla} no existe en el schema`);

  const desconocidas = [];
  const fallos = [];
  for (const [clave, valor] of Object.entries(datos)) {
    const campo = campos.get(clave);
    if (!campo) { desconocidas.push(clave); continue; }
    if (valor === null || valor === undefined) continue;

    // `JSON.stringify(NaN)` es "null", justo el valor que más veces aparece
    // aquí (un `parseInt` de algo que no era número), así que se muestra tal cual.
    const mostrar = (v) => (typeof v === 'number' && Number.isNaN(v) ? 'NaN' : JSON.stringify(v));
    const mal = (que) => fallos.push(`${clave}: ${que} (recibido ${mostrar(valor)})`);
    if (VALORES_ENUM[campo.type]) {
      if (!VALORES_ENUM[campo.type].includes(String(valor))) {
        mal(`debe ser uno de ${VALORES_ENUM[campo.type].join(', ')}`);
      }
      continue;
    }
    switch (campo.type) {
      case 'Int':
      case 'BigInt':
        if (!Number.isInteger(valor)) mal('debe ser un número entero');
        break;
      case 'Float':
      case 'Decimal':
        if (typeof valor !== 'number' || !Number.isFinite(valor)) mal('debe ser un número');
        break;
      case 'DateTime':
        if (Number.isNaN(new Date(valor).getTime())) mal('no es una fecha válida');
        break;
      case 'Boolean':
        if (typeof valor !== 'boolean') mal('debe ser verdadero o falso');
        break;
      case 'String':
        if (typeof valor !== 'string') mal('debe ser texto');
        break;
      default:
        break;
    }
  }

  if (desconocidas.length) {
    throw new Error(`El transform de ${tabla} produjo columnas que no existen: ${desconocidas.join(', ')}`);
  }
  if (fallos.length) throw new BadRequestError(`Datos inválidos: ${fallos.join('; ')}`);
}

module.exports = { esquemaDeCategoria, comprobarColumnas };
