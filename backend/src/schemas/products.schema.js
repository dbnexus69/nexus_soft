const { z } = require('zod');
const { Prisma } = require('@prisma/client');

/**
 * Validación de los productos de una venta, en su única puerta: `POST /sales`.
 *
 * La venta y sus productos se crean de una vez (el asistente arma el borrador
 * en el navegador y lo manda entero), así que cada lista de productos del
 * cuerpo —`ticketData`, `hotelData`…— se valida aquí, elemento a elemento.
 * Antes solo se comprobaba que fuesen listas (`z.array(z.any())`), y estas
 * reglas vivían en los POST de productos sueltos, que ninguna pantalla usaba y
 * se retiraron (spec 002): un `ta` de -500 bajaba el total de la venta sin
 * error, y un tipo de hotel fuera del enum tumbaba el alta con un 500.
 *
 * Lo que importa es el dinero: `precioProducto` mete `total`/`ta`/`supplierCost`
 * en `detalle_venta`, y de ahí salen el total de la venta y su estado de cobro.
 * Además, la FORMA de pasajeros y tramos, las fechas y los enums que
 * `createSale` escribe tal cual en columnas de Postgres.
 *
 * Las reglas comprueban y dejan pasar el original (`passthrough`, sin
 * transformar): `createSale` sigue leyendo el cuerpo tal como llegó.
 */

const VALORES_ENUM = Object.fromEntries(
  Prisma.dmmf.datamodel.enums.map(e => [e.name, e.values.map(v => v.name)])
);

const vacio = (v) => v === null || v === undefined || v === '';

/** Importe: número no negativo. Se acepta como string, que es como llega. */
const dinero = z.union([z.string(), z.number()]).nullable().optional()
  .refine(v => vacio(v) || (Number.isFinite(Number(v)) && Number(v) >= 0),
    'debe ser un número no negativo');

/** Cantidad libre (peso, noches, personas): número, y no negativo. */
const cantidad = dinero;

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
 * El sobre común a las quince categorías.
 *
 * Sin `supplierId` ni `supplierPaymentMethod`: el asistente manda el proveedor
 * y la tarjeta por NOMBRE, no por id, y exigir un id rechazaba cualquier venta
 * que los trajera.
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
  // `finca` era el valor que mandaba el formulario (el enum dice `fincas`); se
  // acepta por los borradores guardados antes de corregirlo, y `createSale` lo
  // traduce.
  hotel: { hotelType: valorEnum('TipoHotel', ['finca']), nights: cantidad, guestCount: cantidad },
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

module.exports = { esquemaDeCategoria };
