const { z } = require('zod');
const { SLUGS, CATALOG } = require('../catalog/products');
// La misma regla de precio que usa la venta al guardar: si aquí se calculara
// aparte, la validación podría discrepar de lo que acaba en la base.
const { precioProducto } = require('../services/saleTotals');

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
const CLAVES_PRODUCTO = Object.keys(productArrays);

/**
 * ¿Es una venta a crédito? Lo dice el dinero, no una casilla.
 *
 * La regla anterior era `!s.isCredit || !!s.creditDueDate`: la fecha se exigía
 * solo si el cliente enviaba `isCredit: true`. Como el asistente pone ese
 * indicador a false en cuanto se elige el estado "pagado" a mano, bastaba con
 * declarar una venta pagada sin pagarla para colar un crédito sin fecha. Y un
 * crédito sin fecha de vencimiento es incobrable por construcción: no vence
 * nunca, no entra en ningún tramo de antigüedad y no aparece en ninguna alerta.
 * Hay una así en la base, con 1.250.000 pendientes.
 *
 * Ahora se compara lo que se paga contra lo que suman los productos. El
 * indicador y el estado declarado siguen contando —si el cliente dice que es
 * un crédito, lo es— pero ya no pueden decir que NO lo es.
 */
function esVentaACredito(s) {
  if (s.isCredit === true) return true;
  if (s.status === 'credito' || s.status === 'abonado') return true;

  const productos = CLAVES_PRODUCTO.reduce((total, clave) => {
    const lista = Array.isArray(s[clave]) ? s[clave] : [];
    return total + lista.reduce((suma, item) => suma + precioProducto(item), 0);
  }, 0);
  const pagado = (s.payments || []).reduce((suma, p) => suma + (Number(p.amount) || 0), 0);

  // Media unidad de céntimo de tolerancia: los importes son coma flotante y una
  // venta pagada al completo no debe caer del lado del crédito por un redondeo.
  return productos > 0 && pagado < productos - 0.005;
}

const createSaleSchema = z.object(baseSale).passthrough().refine(
  s => !esVentaACredito(s) || !!s.creditDueDate,
  {
    message: 'Una venta a crédito necesita fecha de vencimiento: sin ella la deuda no vence nunca y no se puede reclamar',
    path: ['creditDueDate'],
  }
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
  // Nombre o id del método de pago: el servicio acepta las dos formas.
  method: z.union([z.string(), z.number()]).nullable().optional(),
  reference: z.string().nullable().optional(),
  // `currentPaidAmount` y `saleTotal` estaban declarados aquí y el servicio los
  // usaba para calcular el estado de cobro. Se retiraron de la lógica por ser
  // cifras de dinero decididas por el cliente; el contrato deja de anunciarlas.
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
