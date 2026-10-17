const { z } = require('zod');
const { productArrays } = require('./productArrays');

// Mismo cuerpo que una venta (`sales.schema.js`): un campo por categoría —`ticketData`,
// `hotelData`...—, cada uno validado con el esquema de su categoría (origen/destino,
// ida o ida y vuelta, fecha, hora...). Pero una cotización no es una venta: nada aquí
// es obligatorio, ni el cliente ni el costo del proveedor (`productArrays({relajado:
// true})` — ver `products.schema.js::esquemaDeCategoria`); eso se exige recién al
// convertirla, con la validación normal de `sales.schema.js`.
const id = z.union([z.string(), z.number()]).nullable().optional();

const createQuoteSchema = z.object({
  clientId: id,
  // Sin asesor explícito, el servicio lo toma de quien crea. Igual patrón que
  // `createSale`: rechaza si quien suplanta se quedaría como el asesor.
  asesorId: id,
  // Libre, para identificarla en la lista ("Cartagena plan para 2"); opcional como
  // el resto de la cabecera.
  name: z.string().trim().min(1).max(120).nullable().optional(),
  fechaVencimiento: z.string().nullable().optional(),
  observations: z.string().nullable().optional(),
  ...productArrays({ mensajeMax: 'Demasiados productos de este tipo en una cotización', relajado: true }),
}).passthrough();

// PUT reemplaza cabecera y líneas por igual: una cotización en borrador o enviada se
// reescribe entera (plan.md). El asesor no se reasigna al editar.
const updateQuoteSchema = createQuoteSchema.omit({ asesorId: true });

const respondSchema = z.object({ accepted: z.boolean() });

const linkSaleSchema = z.object({ saleId: z.union([z.string(), z.number()]) });

// `.passthrough()`: `page`/`perPage`/`search`/`sortBy`/`sortOrder` los valida `paginate`,
// no este esquema (ver middleware/validate.js).
const listQuotesQuerySchema = z.object({
  status: z.enum(['borrador', 'enviada', 'aceptada', 'rechazada']).optional(),
}).passthrough();

module.exports = { createQuoteSchema, updateQuoteSchema, respondSchema, linkSaleSchema, listQuotesQuerySchema };
