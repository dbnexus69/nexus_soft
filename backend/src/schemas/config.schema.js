const { z } = require('zod');

/**
 * Validación de los catálogos de Gestión Interna.
 *
 * Antes no había ninguna: `POST /config/:section` aceptaba cualquier cuerpo y
 * el `reverseTransform` hacía `d.name || 'Sin nombre'`, así que un cuerpo vacío
 * CREABA un registro llamado "Sin nombre" en vez de responder 422. El catálogo
 * se llenaba de basura sin que nadie se enterara.
 *
 * Cada sección declara su esquema. Los campos que el frontend ya envía se
 * aceptan tal cual; lo que se añade es que el nombre sea obligatorio y que las
 * claves ajenas se puedan pasar por id además de por nombre.
 */

const texto = (max = 255) => z.string().trim().max(max);
const opcional = (max = 255) => texto(max).nullable().optional();
const nombre = texto(160).min(1, 'El nombre es obligatorio');
/** Id de una relación: llega como número o como cadena según el formulario. */
const idRel = z.union([z.coerce.number().int().positive(), z.literal('')]).nullable().optional();

const COBERTURA = z.enum(['Nacional', 'Internacional', 'Ambos']);
const ESTADO = z.enum(['Activo', 'Inactivo']);

const ESQUEMAS = {
  'cards': z.object({
    name: nombre,
    // Por id o por nombre: el id es lo correcto, el nombre se mantiene porque
    // es lo que envía el formulario actual.
    paymentMethodId: idRel,
    paymentMethod: opcional(120),
    lastFourDigits: texto(4).regex(/^\d{4}$/, 'Son los cuatro últimos dígitos').nullable().optional(),
    description: opcional(500),
    status: ESTADO.optional(),
  }).passthrough(),

  'payment-methods': z.object({ name: nombre }).passthrough(),

  'document-types': z.object({
    name: nombre,
    abbreviation: texto(10).min(1, 'La abreviatura es obligatoria'),
  }).passthrough(),

  'airlines': z.object({
    name: nombre,
    code: texto(3).regex(/^[A-Za-z0-9]{2,3}$/, 'El código IATA son 2 o 3 caracteres').nullable().optional(),
    type: COBERTURA.optional(),
    website: opcional(300),
  }).passthrough(),

  'suppliers': z.object({
    name: nombre,
    type: opcional(80),
    email: z.string().trim().email('Correo inválido').max(160).nullable().optional().or(z.literal('')),
    phone: opcional(40),
    website: opcional(300),
    observations: opcional(1000),
  }).passthrough(),

  'airports': z.object({
    name: nombre,
    // `codigo_iata` es único y NO acepta null en la base, así que aquí es
    // obligatorio: sin él la creación fallaba con un error de Prisma.
    abbreviation: texto(4).min(3, 'El código IATA son 3 letras').max(4),
    city: opcional(120),
    country: opcional(120),
    type: COBERTURA.optional(),
    status: ESTADO.optional(),
  }).passthrough(),

  'baggage': z.object({
    airlineId: idRel,
    airlineName: opcional(160),
    fareType: texto(120).min(1, 'El tipo de tarifa es obligatorio'),
    personalItem: opcional(120),
    carryOn: opcional(120),
    checkedBag: opcional(120),
    notes: opcional(1000),
  }).passthrough()
    // `aerolinea_id` es obligatorio en la base y antes se caía a la aerolínea
    // número 1 cuando el nombre no casaba, atribuyendo la política a quien no
    // era. Ahora hay que decir de quién es, por id o por nombre.
    .refine(d => d.airlineId || d.airlineName, {
      message: 'Indica la aerolínea de la política',
      path: ['airlineName'],
    }),

  'packages': z.object({
    name: nombre,
    destination: texto(160).min(1, 'El destino es obligatorio'),
  }).passthrough(),
};

module.exports = { ESQUEMAS };
