const { z } = require('zod');
const { SLUGS, CATALOG } = require('../catalog/products');

// Los ids llegan del frontend como string o número según el formulario.
const id = z.union([z.string(), z.number()]).nullable().optional();
const idRequerido = (que) => z.union([z.string().min(1), z.number()], {
  errorMap: () => ({ message: `${que} es obligatorio` }),
});
const dinero = z.coerce.number().min(0, 'No puede ser negativo').optional();
const fecha = z.string().datetime({ offset: true }).or(z.string().min(1)).nullable().optional();

// passthrough, igual que el schema de la venta: sin él Zod recorta las claves
// que no estén declaradas. El wizard envía `method` con el id del método de
// pago, y al no figurar aquí se perdía en silencio: el pago se guardaba sin
// método asociado.
const paymentSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor que cero'),
  method: id,
  methodId: id,
  methodName: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  date: fecha,
}).passthrough();

// El detalle de cada producto lo valida su transform del catálogo; aquí solo
// se comprueba que sea una lista. Las claves aceptadas salen del catálogo,
// así que añadir una categoría no obliga a tocar este archivo.
const productArrays = Object.fromEntries(
  SLUGS.map(slug => [CATALOG[slug].responseKey, z.array(z.any()).optional()])
);

const baseSale = {
  clientId: idRequerido('El cliente'),
  asesorId: id,
  responsableId: id,
  total: z.coerce.number().min(0, 'El total no puede ser negativo'),
  ta: dinero,
  supplierCost: dinero,
  paymentMethod: id,
  payments: z.array(paymentSchema).optional(),
  status: z.enum(['credito', 'abonado', 'pagado', 'anulado']).optional(),
  isCredit: z.boolean().optional(),
  creditDueDate: fecha,
  observations: z.string().nullable().optional(),
  commissionAgentId: id,
  commissionAgentAmount: dinero,
  commissionAgentRetentionPercentage: z.coerce.number().min(0).max(100).optional(),
  commissionAgentNetPayment: dinero,
  products: z.array(z.any()).optional(),
  ...productArrays,
};

// passthrough: el schema valida y normaliza lo que conoce, pero no descarta el
// resto del payload. Sin esto, Zod recortaría campos que el servicio sí usa.
const createSaleSchema = z.object(baseSale).passthrough().refine(
  s => !s.isCredit || !!s.creditDueDate,
  { message: 'Una venta a crédito necesita fecha de vencimiento', path: ['creditDueDate'] }
);

// En una actualización todo es opcional salvo lo que venga.
const updateSaleSchema = z.object({
  ...baseSale,
  clientId: id,
  total: z.coerce.number().min(0).optional(),
}).partial().passthrough();

const registerPaymentSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor que cero'),
  isTotal: z.boolean().optional(),
  method: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  currentPaidAmount: z.coerce.number().min(0).optional(),
  saleTotal: z.coerce.number().min(0).optional(),
});

const voidSaleSchema = z.object({
  reason: z.string().min(3, 'Indica el motivo de la anulación'),
});

const reviewStatusSchema = z.object({
  isReviewed: z.boolean(),
});

module.exports = {
  createSaleSchema,
  updateSaleSchema,
  registerPaymentSchema,
  voidSaleSchema,
  reviewStatusSchema,
};
