const prisma = require('../config/db');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');
const { enHoraColombia } = require('../utils/fechas');
const { recalcularVenta, aCentimos, precioProducto } = require('./saleTotals');
const { empresaActual } = require('../config/tenant');
const emailService = require('../utils/emailService');

// Los includes, transforms y helpers de producto viven en el catálogo:
// una sola fuente de verdad para las 15 categorías.
const {
  CATALOG, SLUGS, CHILD_SLUGS,
  PRODUCT_INCLUDES, PRODUCT_TRANSFORMS,
  mapPassengers, mapLegs, labelOf
} = require('../catalog/products');

const { randomUUID: uuidv4 } = require('crypto');

// El selector de tamaño de mascota envía "pequeño" con eñe, pero el enum
// TamanoMascota de Postgres es `pequeno`. Un valor fuera del enum hace fallar
// el insert entero, así que se normaliza aquí.
const TAMANOS_MASCOTA = { pequeno: 'pequeno', 'pequeño': 'pequeno', mediano: 'mediano', grande: 'grande', gigante: 'gigante' };
function normalizarTamanoMascota(valor) {
  if (!valor) return null;
  return TAMANOS_MASCOTA[String(valor).trim().toLowerCase()] || null;
}

/**
 * Lo que se puede editar de la CABECERA de una venta, y lo que no.
 *
 * `PUT /sales/:id` devolvía 200 con "Sale updated" sin escribir nada. Al
 * implementarlo, la pregunta de verdad no es cómo guardar, es QUÉ se acepta:
 * el schema que lo custodiaba declaraba `total`, `status`, `payments` y los
 * quince arrays de producto, así que un cliente podía mandar el total de la
 * venta y el estado de cobro.
 *
 * Esos campos son DERIVADOS desde 8006dfa: `recalcularVenta` calcula
 * `monto_total`, `ta_total`, `costo_proveedor_total` y `monto_pagado_credito`
 * sumando las líneas y los pagos, y `estadoSegunPago` decide el estado. Si el
 * cliente pudiera escribirlos volveríamos a lo de antes: totales que no cuadran
 * con sus líneas y ventas con saldo marcadas como pagadas.
 *
 * Llegar con un campo derivado es un 400 que lo nombra y dice por dónde se
 * cambia. Recortarlo en silencio —lo que hacía el `.partial()` de Zod— es peor
 * que rechazarlo: quien lo manda cree que se guardó.
 */
const CAMPOS_EDITABLES = {
  clientId: {
    columna: 'cliente_id', tipo: 'idRel', obligatorio: true,
    modelo: 'clientes', vigente: true, etiqueta: 'El cliente',
  },
  responsableId: {
    columna: 'responsable_id', tipo: 'idRel',
    modelo: 'responsables', vigente: true, etiqueta: 'El responsable',
  },
  paymentMethod: {
    columna: 'metodo_pago_principal_id', tipo: 'idRel',
    modelo: 'metodos_pago', etiqueta: 'El método de pago',
  },
  commissionAgentId: {
    columna: 'comisionista_id', tipo: 'idRel',
    modelo: 'comisionistas', etiqueta: 'El comisionista',
  },
  commissionAgentAmount: { columna: 'monto_comision_bruto', tipo: 'dinero' },
  commissionAgentRetentionPercentage: { columna: 'porcentaje_retencion_comision', tipo: 'porcentaje' },
  commissionAgentNetPayment: { columna: 'monto_comision_neto', tipo: 'dinero' },
  isCredit: { columna: 'es_credito', tipo: 'bool' },
  creditDueDate: { columna: 'fecha_vence_credito', tipo: 'fecha' },
  observations: { columna: 'observaciones', tipo: 'texto' },
};

/** Por qué se rechaza cada campo que el cliente podría creer editable. */
const NO_EDITABLES = {
  // Las quince claves de producto salen del catálogo, así que añadir una
  // categoría no obliga a acordarse de este archivo.
  ...Object.fromEntries(SLUGS.map(slug => [
    CATALOG[slug].responseKey,
    'los productos se editan en /sales/:saleId/products/:categoria',
  ])),
  total: 'el total lo suman los productos',
  ta: 'el TA lo suman los productos',
  supplierCost: 'el costo de proveedor lo suman los productos',
  status: 'el estado lo deciden los pagos',
  paidAmount: 'lo suman los pagos',
  products: 'los productos se editan en /sales/:saleId/products/...',
  payments: 'los abonos se registran en POST /sales/:id/payments',
  asesorId: 'la venta no cambia de asesor por aquí',
  isReviewed: 'se marca en PATCH /sales/:id/review-status',
};

const CLAVES_COMISION = [
  'commissionAgentId',
  'commissionAgentAmount',
  'commissionAgentRetentionPercentage',
  'commissionAgentNetPayment',
];

/**
 * Los nombres de columna se comprueban contra el schema al arrancar.
 *
 * `updateSale` escribe con `data[def.columna]` y valida las relaciones con
 * `prisma[def.modelo]`: claves dinámicas, y `scripts/check-prisma-fields.js`
 * solo mira los objetos literales, así que este mapa es invisible para él. Un
 * `costo_proveedor` mal escrito no fallaría al programar sino al guardar una
 * venta. Es exactamente el fallo que dio el 500 de las aerolíneas
 * (`prod_tiqueteria.aerolinea_id`, que en realidad es `aerolineaId`).
 */
function comprobarCamposEditables() {
  const { Prisma } = require('@prisma/client');
  const modelos = new Map(
    Prisma.dmmf.datamodel.models.map(m => [m.name, new Set(m.fields.map(f => f.name))])
  );
  const ventas = modelos.get('ventas');
  const errores = [];
  for (const [clave, def] of Object.entries(CAMPOS_EDITABLES)) {
    if (!ventas.has(def.columna)) errores.push(`${clave}: ventas.${def.columna} no existe`);
    if (!def.modelo) continue;
    const campos = modelos.get(def.modelo);
    if (!campos) errores.push(`${clave}: el modelo ${def.modelo} no existe`);
    else if (def.vigente && !campos.has('deleted_at')) {
      errores.push(`${clave}: ${def.modelo} no tiene deleted_at y se filtra por él`);
    }
  }
  for (const clave of CLAVES_COMISION) {
    if (!(clave in CAMPOS_EDITABLES)) errores.push(`${clave} no está en CAMPOS_EDITABLES`);
  }
  if (errores.length) {
    throw new Error(`Campos editables mal declarados en sales.service:\n  ${errores.join('\n  ')}`);
  }
}
comprobarCamposEditables();

/** Convierte un valor del cliente al tipo de su columna, o lo rechaza. */
function leerCampo(clave, def, valor) {
  const vacio = valor === null || valor === undefined || valor === '';
  switch (def.tipo) {
    case 'idRel': {
      if (vacio) {
        if (def.obligatorio) throw new BadRequestError(`${def.etiqueta} no puede quedar vacío`);
        return null;
      }
      const n = Number(valor);
      if (!Number.isInteger(n) || n <= 0) throw new BadRequestError(`${def.etiqueta} no es válido`);
      return n;
    }
    case 'dinero': {
      if (vacio) return 0;
      const n = Number(valor);
      if (!Number.isFinite(n) || n < 0) throw new BadRequestError(`${clave} debe ser un importe positivo`);
      return aCentimos(n);
    }
    case 'porcentaje': {
      if (vacio) return 0;
      const n = Number(valor);
      if (!Number.isFinite(n) || n < 0 || n > 100) throw new BadRequestError(`${clave} debe estar entre 0 y 100`);
      return n;
    }
    case 'bool':
      return valor === true || valor === 'true' || valor === 1 || valor === '1';
    case 'fecha': {
      if (vacio) return null;
      const d = new Date(valor);
      if (Number.isNaN(d.getTime())) throw new BadRequestError(`${clave} no es una fecha válida`);
      return d;
    }
    case 'texto':
      return vacio ? null : String(valor).trim();
    default:
      throw new Error(`Tipo no soportado en CAMPOS_EDITABLES: ${def.tipo}`);
  }
}

/**
 * Tramos del informe de antigüedad de cartera, el estándar en cobranza:
 * corriente (aún no vence) y mora repartida en 1-30, 31-60, 61-90 y +90 días.
 *
 * `undated` no es un tramo de verdad: recoge los créditos sin fecha de
 * vencimiento, que desde 863c468 ya no se pueden crear y solo quedan como
 * datos heredados. Existe para que los tramos sumen el pendiente en vez de
 * perder dinero por el camino.
 */
const TRAMOS_MORA = ['days1_30', 'days31_60', 'days61_90', 'days90plus'];
const TRAMOS_ANTIGUEDAD = ['current', ...TRAMOS_MORA, 'undated'];

/**
 * La venta, comprobada contra el alcance de quien pide.
 *
 * El alcance solo se aplicaba al LEER. `listSales` y la cartera filtran por
 * `usuario_id` cuando el permiso de ver es 'own', pero ninguna mutación miraba
 * nada: con la venta de otro en la URL se podía cobrar, anular, editar y
 * borrar. Leer una venta por su id tampoco se comprobaba, así que la lista
 * ocultaba lo que la URL directa enseñaba.
 *
 * Hoy no cambia nada en la práctica —ningún rol tiene el alcance en 'own' en
 * la base—, y ese es justamente el momento de cerrarlo: el día que alguien lo
 * ponga desde la pantalla de permisos, tiene que valer para todo y no solo
 * para los listados.
 *
 * `leer` responde 404 y `escribir` 403, igual que en vuelos: al leer no se
 * confirma que exista la venta de otro; al escribir, quien lo intenta ya sabe
 * que existe porque tiene su id.
 */
/**
 * Sobre qué ventas puede actuar. Es el alcance de VER, no el de la acción
 * pedida: las acciones de escritura son booleanas y no tienen alcance, así que
 * mirar el de la acción dejaba pasar todas las mutaciones.
 */
const soloLasSuyas = (alcance = {}) =>
  (alcance.viewScope || alcance.permissionScope) === 'own' && Boolean(alcance.user);

function esDeOtro(venta, alcance = {}) {
  return soloLasSuyas(alcance) && venta.usuario_id !== alcance.user.id;
}

async function ventaVisible(id, alcance = {}, { paraEscribir = false } = {}) {
  const where = { id: Number(id), deleted_at: null };
  if (!paraEscribir && soloLasSuyas(alcance)) {
    where.usuario_id = alcance.user.id;
  }
  const venta = await prisma.ventas.findFirst({ where });
  if (!venta) throw new NotFoundError('Venta no encontrada');
  if (paraEscribir && esDeOtro(venta, alcance)) {
    throw new ForbiddenError('No puede modificar una venta de otro asesor');
  }
  return venta;
}


/**
 * Los CTE que clasifican cada crédito. UNA sola definición, compartida por el
 * listado de la cartera y por el detalle de un cliente.
 *
 * Cobro y vencimiento son dos ejes independientes. El CASE original los
 * colapsaba en uno y evaluaba 'partial' antes que 'overdue', así que un abono
 * parcial tapaba el vencimiento: 4.600.000 de mora se reportaban como cero.
 * Aquí `liquidada` responde "¿queda algo por cobrar?" y `dias_mora` responde
 * "¿cuánto se pasó de fecha?". Se cruzan, no compiten.
 */
function ctesDeCredito(extraSql) {
  return `
      WITH creditos AS (
        SELECT
          v.id AS venta_id,
          v.cliente_id,
          v.creado_at,
          v.status::text AS venta_status,
          v.monto_total,
          COALESCE(v.monto_pagado_credito, 0) AS pagado,
          GREATEST(v.monto_total - COALESCE(v.monto_pagado_credito, 0), 0) AS pendiente,
          v.fecha_vence_credito,
          (COALESCE(v.monto_pagado_credito, 0) >= v.monto_total) AS liquidada,
          -- El ::date es obligatorio: fecha_vence_credito es timestamp, y
          -- restarlo de CURRENT_DATE devuelve un interval que no castea a int.
          CASE
            WHEN v.fecha_vence_credito IS NOT NULL
             AND v.fecha_vence_credito::date < CURRENT_DATE
            THEN (CURRENT_DATE - v.fecha_vence_credito::date)
          END AS dias_mora
        FROM ventas v
        JOIN clientes c ON v.cliente_id = c.id
        JOIN personas cp ON c.persona_id = cp.id
        WHERE v.deleted_at IS NULL
          AND v.status <> 'anulado'
          AND (v.es_credito = true OR v.status IN ('credito', 'abonado'))
          ${extraSql}
      ),
      -- Tramo de cada crédito. Los liquidados no tienen tramo: ya no se cobran.
      por_credito AS (
        SELECT
          cr.*,
          CASE
            WHEN cr.liquidada                       THEN NULL
            WHEN cr.fecha_vence_credito IS NULL     THEN 'undated'
            WHEN cr.dias_mora IS NULL               THEN 'current'
            WHEN cr.dias_mora <= 30                 THEN 'days1_30'
            WHEN cr.dias_mora <= 60                 THEN 'days31_60'
            WHEN cr.dias_mora <= 90                 THEN 'days61_90'
            ELSE 'days90plus'
          END AS tramo
        FROM creditos cr
      )`;
}

/** Agregado por cliente. Se apoya en `por_credito`. */
const CTE_POR_CLIENTE = `
      por_cliente AS (
        SELECT
          cliente_id,
          SUM(monto_total)::float                                             AS "totalCredit",
          SUM(pagado)::float                                                  AS "paidAmount",
          SUM(CASE WHEN NOT liquidada    THEN pendiente ELSE 0 END)::float    AS "pendingAmount",
          SUM(CASE WHEN tramo = 'current'    THEN pendiente ELSE 0 END)::float AS "agingCurrent",
          SUM(CASE WHEN tramo = 'days1_30'   THEN pendiente ELSE 0 END)::float AS "aging1_30",
          SUM(CASE WHEN tramo = 'days31_60'  THEN pendiente ELSE 0 END)::float AS "aging31_60",
          SUM(CASE WHEN tramo = 'days61_90'  THEN pendiente ELSE 0 END)::float AS "aging61_90",
          SUM(CASE WHEN tramo = 'days90plus' THEN pendiente ELSE 0 END)::float AS "aging90plus",
          SUM(CASE WHEN tramo = 'undated'    THEN pendiente ELSE 0 END)::float AS "agingUndated",
          -- "Activos" son los que quedan por cobrar: contar los liquidados hacía
          -- que un cliente al día siguiera sumando créditos.
          COUNT(*) FILTER (WHERE NOT liquidada)::int                          AS "activeCredits",
          -- El próximo vencimiento sale solo de lo pendiente. Con MIN sobre
          -- todo, la fecha de un crédito ya pagado podía ser la más antigua y la
          -- pantalla mostraba un vencimiento que no se debe.
          MIN(CASE WHEN NOT liquidada THEN fecha_vence_credito END)           AS "nextDueDate",
          COALESCE(MAX(dias_mora) FILTER (WHERE NOT liquidada), 0)::int       AS "daysOverdue"
        FROM por_credito
        GROUP BY cliente_id
        -- Un cliente sin nada por cobrar no pertenece a una lista de cobros.
        HAVING COUNT(*) FILTER (WHERE NOT liquidada) > 0
      ),
      clasificados AS (
        SELECT
          pc.*,
          ("aging1_30" + "aging31_60" + "aging61_90" + "aging90plus")::float  AS "overdueAmount",
          -- Tramo del CLIENTE: el peor en el que tenga dinero. Undated va por
          -- delante de current porque un crédito que no vence nunca es un
          -- problema que atender, no una cuenta tranquila.
          CASE
            WHEN pc."aging90plus"  > 0 THEN 'days90plus'
            WHEN pc."aging61_90"   > 0 THEN 'days61_90'
            WHEN pc."aging31_60"   > 0 THEN 'days31_60'
            WHEN pc."aging1_30"    > 0 THEN 'days1_30'
            WHEN pc."agingUndated" > 0 THEN 'undated'
            ELSE 'current'
          END AS tramo,
          -- Clasificación anterior, por urgencia del próximo vencimiento. Se
          -- mantiene mientras la pantalla la siga usando; el informe de
          -- antigüedad es la columna tramo.
          CASE
            WHEN ("aging1_30" + "aging31_60" + "aging61_90" + "aging90plus") > 0 THEN 'overdue'
            WHEN pc."nextDueDate" IS NOT NULL
             AND pc."nextDueDate" <= CURRENT_DATE + INTERVAL '3 days' THEN 'urgent'
            WHEN pc."nextDueDate" IS NOT NULL
             AND pc."nextDueDate" <= CURRENT_DATE + INTERVAL '7 days' THEN 'pending'
            ELSE 'ok'
          END AS estado
        FROM por_cliente pc
      )`;

/**
 * Ordenaciones admitidas de la cartera. Lista blanca: la clave del cliente
 * elige una expresión ya escrita, nunca se interpola en el SQL.
 *
 * `priority` es el orden por defecto y es fijo —lo más vencido primero y, a
 * igualdad, lo que vence antes—, que es el orden en que se cobra. Las demás
 * llevan su propio sentido natural: los nombres suben, el dinero y los días
 * bajan, porque nadie ordena una cartera para ver quién debe menos.
 */
const ORDENES_CARTERA = {
  priority: { sql: 'c2."overdueAmount" DESC, c2."nextDueDate" ASC NULLS LAST', fijo: true },
  client:   { sql: "cp.nombres || ' ' || cp.apellidos", defecto: 'asc' },
  credits:  { sql: 'c2."activeCredits"', defecto: 'desc' },
  overdue:  { sql: 'c2."overdueAmount"', defecto: 'desc' },
  pending:  { sql: 'c2."pendingAmount"', defecto: 'desc' },
  days:     { sql: 'c2."daysOverdue"', defecto: 'desc' },
  // Un crédito sin fecha no debe encabezar la lista en ningún sentido.
  dueDate:  { sql: 'c2."nextDueDate"', defecto: 'asc', nulos: 'NULLS LAST' },
};

/** Fila de resumen por cliente, en la forma que consume la pantalla. */
function mapearResumenCliente(f) {
  return {
    totalCredit: f.totalCredit,
    paidAmount: f.paidAmount,
    pendingAmount: f.pendingAmount,
    overdueAmount: f.overdueAmount,
    daysOverdue: f.daysOverdue,
    activeCredits: f.activeCredits,
    nextDueDate: f.nextDueDate,
    // Los seis tramos suman `pendingAmount`.
    aging: {
      current: f.agingCurrent,
      days1_30: f.aging1_30,
      days31_60: f.aging31_60,
      days61_90: f.aging61_90,
      days90plus: f.aging90plus,
      undated: f.agingUndated,
    },
    agingBucket: f.tramo,
    status: f.estado,
  };
}

class SalesService {
  // Resuelve de una vez todos los catálogos que la venta va a necesitar
  // (proveedores, aerolíneas, aeropuertos y personas por documento).
  //
  // Estas consultas son solo lectura y antes vivían dentro de la transacción,
  // repetidas dentro de los bucles de producto. Con ~150 ms por consulta contra
  // Supabase, una venta con muchos productos superaba el timeout de 5 s de
  // Prisma y la transacción moría a media escritura:
  //   "Transaction not found ... refers to an old closed transaction".
  //
  // Sacarlas fuera deja dentro de la transacción solo las escrituras.
  async _precargarCatalogos(body) {
    const CAMPOS = [
      'ticketData', 'hotelData', 'insuranceData', 'planData', 'checkInData',
      'migrationData', 'simCardData', 'carRentalData', 'fincaData', 'tourData',
      'conventionData', 'restaurantData', 'visaData', 'passportData', 'petServiceData',
    ];
    const items = CAMPOS.flatMap(c => Array.isArray(body[c]) ? body[c] : []);

    const codigosIata = new Set();
    const documentos = new Set();
    for (const it of items) {
      for (const leg of [...(it.legs || []), ...(it.outboundStops || []),
                         ...(it.returnLeg ? [it.returnLeg] : []), ...(it.returnStops || [])]) {
        if (leg?.origin) codigosIata.add(leg.origin);
        if (leg?.destination) codigosIata.add(leg.destination);
      }
      // `members` son los asegurados, y faltaba: su documento no se precargaba,
      // así que findOrCreatePersona no lo encontraba en la caché y creaba una
      // persona con un documento que ya existía -> P2002 -> 409 al registrar.
      for (const p of [...(it.passengers || []), ...(it.guests || []),
                       ...(it.travelers || []), ...(it.members || [])]) {
        if (p?.docNumber) documentos.add(String(p.docNumber));
      }
      if (it.docNumber) documentos.add(String(it.docNumber));
    }
    codigosIata.add('UNK'); // el comodín para tramos sin aeropuerto conocido

    const [proveedores, aerolineas, aeropuertos, personas] = await Promise.all([
      prisma.proveedores.findMany({ select: { id: true, nombre: true } }),
      prisma.aerolineas.findMany({ select: { id: true, nombre: true } }),
      prisma.aeropuertos.findMany({
        where: { codigo_iata: { in: [...codigosIata] } },
        select: { id: true, codigo_iata: true },
      }),
      documentos.size
        ? prisma.personas.findMany({
            where: { documento: { in: [...documentos] } },
            select: { id: true, documento: true },
          })
        : [],
    ]);

    return {
      proveedores,
      aerolineas,
      // Se indexan para que la búsqueda dentro de la transacción sea O(1).
      aeropuertos: new Map(aeropuertos.map(a => [a.codigo_iata, a.id])),
      personas: new Map(personas.map(p => [p.documento, p.id])),
    };
  }

  async createSale(body) {
    const {
      clientId, asesorId, total, paymentMethod, payments = [],
      status = 'credito', isCredit = false, creditDueDate,
      observations, products = [], responsableId,
      commissionAgentId, commissionAgentAmount, commissionAgentRetentionPercentage, commissionAgentNetPayment,
      ta = 0, supplierCost = 0,
      ticketData = [], hotelData = [], insuranceData = [], planData = [],
      checkInData = [], migrationData = [], simCardData = [], carRentalData = [],
      fincaData = [], tourData = [], conventionData = [], restaurantData = [],
      visaData = [], passportData = [], petServiceData = []
    } = body;

    // Resolve payment method principal id
    let metodo_pago_principal_id = null;
    if (paymentMethod) {
      const mp = await prisma.metodos_pago.findFirst({ where: { nombre: { contains: paymentMethod, mode: 'insensitive' } } });
      if (mp) metodo_pago_principal_id = mp.id;
    }

        // Inject UUID for all items to enable linking
    const allDataFields = [
      'ticketData', 'hotelData', 'insuranceData', 'planData',
      'checkInData', 'migrationData', 'simCardData', 'carRentalData',
      'fincaData', 'tourData', 'conventionData', 'restaurantData',
      'visaData', 'passportData', 'petServiceData'
    ];
    for (const field of allDataFields) {
      if (Array.isArray(body[field])) {
        for (let item of body[field]) {
          if (item && Object.keys(item).length > 0) {
            item._generatedId = require('crypto').randomUUID();
          }
        }
      }
    }

    // Los catálogos se resuelven fuera: dentro de la transacción solo escrituras.
    const catalogos = await this._precargarCatalogos(body);

    const created = await prisma.transaccion(async (tx) => {
      // 0. El número que verá la agencia.
      //
      // El cerrojo es por empresa y muere con la transacción. Sin él, dos ventas
      // creadas a la vez leerían el mismo máximo y una de las dos se estrellaría
      // contra el índice único — o peor, si no lo hubiera, compartirían número.
      // Con él, la segunda espera a que la primera confirme. Dos agencias
      // vendiendo a la vez no se estorban: el cerrojo lleva su empresa dentro.
      // En dos sentencias y no en una: `pg_advisory_xact_lock` devuelve `void`,
      // y Prisma no sabe deserializar esa columna en un `$queryRaw`.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ventas.numero'), ${empresaActual()}::int)`;
      const [{ siguiente }] = await tx.$queryRaw`SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente FROM ventas`;

      // 1. Create sale record
      const venta = await tx.ventas.create({
        data: {
          numero: Number(siguiente),
          cliente_id: Number(clientId),
          usuario_id: Number(asesorId),
          monto_total: Number(total) || 0,
          costo_proveedor_total: Number(supplierCost) || 0,
          ta_total: Number(ta) || 0,
          comisionista_id: commissionAgentId ? Number(commissionAgentId) : null,
          monto_comision_bruto: Number(commissionAgentAmount) || 0,
          porcentaje_retencion_comision: Number(commissionAgentRetentionPercentage) || 0,
          monto_comision_neto: Number(commissionAgentNetPayment) || 0,
          comision_liquidada: false,
          metodo_pago_principal_id,
          status,
          es_credito: Boolean(isCredit),
          fecha_vence_credito: creditDueDate ? new Date(creditDueDate) : null,
          monto_pagado_credito: payments.reduce((s, p) => s + Number(p.amount || 0), 0),
          observaciones: observations || null,
          responsable_id: responsableId ? Number(responsableId) : null,
        }
      });

      const ventaId = venta.id;

      // Helper: find or create persona
      // La búsqueda por documento ya viene resuelta; solo el alta toca la base.
      // El mapa se actualiza al crear, para que dos pasajeros con el mismo
      // documento en la misma venta reutilicen la persona en vez de duplicarla.
      const findOrCreatePersona = async (name, docType, docNumber) => {
        if (!name && !docNumber) return null;
        const doc = docNumber ? String(docNumber) : null;
        if (doc && catalogos.personas.has(doc)) return catalogos.personas.get(doc);

        const parts = (name || '').trim().split(' ');
        const nombres = parts.slice(0, Math.ceil(parts.length / 2)).join(' ') || name || '';
        const apellidos = parts.slice(Math.ceil(parts.length / 2)).join(' ') || '';

        // `upsert`, no `create`. La caché es el camino rápido, no la garantía:
        // basta con que alguien añada un array de personas nuevo y se olvide de
        // sumarlo a la precarga para que volvamos a crear un documento
        // duplicado y la venta entera falle con un 409. Con upsert un fallo de
        // caché devuelve la persona existente en lugar de reventar, y sigue
        // siendo UN solo viaje a la base.
        //
        // Sin documento no hay con qué identificar a la persona, así que ahí no
        // queda más que crear.
        const created = doc
          ? await tx.personas.upsert({
              where: { documento: doc },
              update: {},
              create: { nombres, apellidos, documento: doc, tipo_documento_id: null },
              select: { id: true },
            })
          : await tx.personas.create({
              data: { nombres, apellidos, documento: null, tipo_documento_id: null },
              select: { id: true },
            });

        if (doc) catalogos.personas.set(doc, created.id);
        return created.id;
      };

      // Del catálogo precargado, con el mismo criterio que antes:
      // igualdad de nombre sin distinguir mayúsculas.
      const findProveedorId = (nombre) => {
        if (!nombre) return null;
        const buscado = String(nombre).toLowerCase();
        const p = catalogos.proveedores.find(x => (x.nombre || '').toLowerCase() === buscado);
        return p ? p.id : null;
      };

      // Mismo criterio que el findFirst con `contains`, insensible a mayúsculas.
      const findAerolineaId = (nombre) => {
        if (!nombre) return null;
        const buscado = String(nombre).toLowerCase();
        const a = catalogos.aerolineas.find(x => (x.nombre || '').toLowerCase().includes(buscado));
        return a ? a.id : null;
      };

      const getParentDetalleId = (item) => {
        if (item && item.linkedToPlanIndex !== undefined && item.linkedToPlanIndex !== null) {
          const parentPlan = planData[item.linkedToPlanIndex];
          if (parentPlan && parentPlan._generatedId) {
            return parentPlan._generatedId;
          }
        }
        return null;
      };

      // ── PLANES (Se procesan primero para generar IDs de vínculo) ──
      for (const p of planData) {
        const detalleId = uuidv4();
        p._generatedId = detalleId;
        const proveedorId = await findProveedorId(p.supplier);
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'plan', subtotal: precioProducto(p), ta: Number(p.ta || 0), costo_proveedor: Number(p.supplierCost || 0), proveedor_id: proveedorId } });
        let planAirlineId = null;
        if (p.airline) {
          const al = findAerolineaId(p.airline) ? { id: findAerolineaId(p.airline) } : null;
          if (al) planAirlineId = al.id;
        }
        await tx.prod_planes.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nombre_plan: p.planName || null, nombre_hotel: p.hotelName || null,
            aerolineaId: planAirlineId,
            nro_vuelo: p.flightNumber || null, nro_reserva: p.reservationNumber || null,
            nro_tiquete: p.ticketNumber || null,
            fecha_viaje_inicio: p.startDate ? new Date(p.startDate) : null,
            fecha_viaje_fin: p.endDate ? new Date(p.endDate) : null,
            // Las cuatro fechas de vuelo se perdían aquí. El asistente las
            // exige —no deja continuar sin la de ida y la de vuelta— y esta
            // función no las guardaba, así que un plan vendido nacía sin
            // vuelos: ni en el itinerario, ni en los check-ins, ni en el
            // detalle. En hora de Colombia, igual que los tramos: con
            // `new Date('2026-11-01')` el vuelo se muestra el día anterior en
            // cuanto el servidor no está en Bogotá.
            fecha_salida_vuelo: enHoraColombia(p.flightDepartureDate),
            fecha_llegada_vuelo: enHoraColombia(p.flightDepartureArrivalDate),
            fecha_regreso_vuelo: enHoraColombia(p.flightReturnDate),
            fecha_llegada_regreso_vuelo: enHoraColombia(p.flightReturnArrivalDate),
            paquete_tarifa_id: p.packageRateId ? Number(p.packageRateId) : null,
            paqueteId: p.packageId ? Number(p.packageId) : null,
            numero_confirmacion: p.confirmationNumber || null,
            tipo_paquete: p.packageType || 'own',
            tipo_transporte: p.transportType || 'Aereo',
            adultos_count: Number(p.adultsCount || 1),
            menores_count: Number(p.childrenCount || 0),
            observaciones: p.observations || null,
          }
        });
        for (const g of (p.guests || [])) {
          const personaId = await findOrCreatePersona(g.name, g.docType, g.docNumber);
          if (personaId) await tx.pasajeros_detalle.create({ data: { id: uuidv4(), detalle_venta_id: detalleId, persona_id: personaId, es_titular: false } });
        }
      }

      // ── TIQUETERÍA ──
      for (const t of ticketData) {
        const parentDetalleId = getParentDetalleId(t);
        const detalleId = uuidv4();
        const proveedorId = await findProveedorId(t.supplier);
        await tx.detalle_venta.create({
          data: { id: detalleId, venta_id: ventaId, categoria: 'ticket', parentDetalleId: parentDetalleId,
            subtotal: precioProducto(t),
            ta: Number(t.ta || 0),
            costo_proveedor: Number(t.supplierCost || 0),
            observaciones: t.observations || null,
            proveedor_id: proveedorId,
            origen: t.legs?.[0]?.origin || null,
            destino: t.legs?.[t.legs.length - 1]?.destination || null,
          }
        });
        const ticketId = uuidv4();
        let airlineId = null;
        if (t.airline) {
          const al = findAerolineaId(t.airline) ? { id: findAerolineaId(t.airline) } : null;
          if (al) airlineId = al.id;
        }
        await tx.prod_tiqueteria.create({
          data: {
            id: ticketId, detalle_venta_id: detalleId,
            aerolineaId: airlineId,
            nro_reserva: t.reservationNumber || null,
            nro_vuelo: t.flightNumber || null,
            nro_tiquete: t.passengers?.[0]?.nroTiquete || null,
            modo_vuelo: t.flightMode || 'one_way',
            checkin_status: 'pendiente',
            planEquipajeId: t.baggagePlan ? Number(t.baggagePlan) : null,
          }
        });
        // Tramos de vuelo
        const allLegs = [];
        if (t.legs) allLegs.push(...t.legs);
        if (t.outboundStops) allLegs.push(...t.outboundStops);
        if (t.returnLeg) allLegs.push(t.returnLeg);
        if (t.returnStops) allLegs.push(...t.returnStops);

        for (let i = 0; i < allLegs.length; i++) {
          const leg = allLegs[i];
          if (!leg || !leg.origin || !leg.destination) continue;

          // Del mapa precargado. Si el aeropuerto no existe se usa el comodín
          // UNK, que solo se crea la primera vez que hace falta.
          const idComodin = async () => {
            if (catalogos.aeropuertos.has('UNK')) return catalogos.aeropuertos.get('UNK');
            const creado = await tx.aeropuertos.create({
              data: { codigo_iata: 'UNK', nombre: 'Desconocido', ciudad: '' }
            });
            catalogos.aeropuertos.set('UNK', creado.id);
            return creado.id;
          };
          const origAirport = { id: catalogos.aeropuertos.get(leg.origin) ?? await idComodin() };
          const destAirport = { id: catalogos.aeropuertos.get(leg.destination) ?? await idComodin() };
          
          // `enHoraColombia` en vez de `new Date('...T06:40:00')`: esa forma,
          // sin designador de zona, se interpreta como hora LOCAL DEL PROCESO,
          // así que el instante guardado dependía de dónde corriera el servidor.
          // En una máquina colombiana salía bien; en un servidor UTC los vuelos
          // se corrían cinco horas y los de madrugada cambiaban de día.
          const salidaDt = enHoraColombia(leg.date, leg.departureTime || leg.time) || new Date();

          // Sin hora de llegada se asume una hora de vuelo, como antes.
          const llegadaDt = enHoraColombia(leg.arrivalDate, leg.arrivalTime)
            || new Date(salidaDt.getTime() + 3600000);

          let legAirlineId = airlineId;
          if (leg.airline && leg.airline !== t.airline) {
            const al2 = findAerolineaId(leg.airline) ? { id: findAerolineaId(leg.airline) } : null;
            if (al2) legAirlineId = al2.id;
          }
          await tx.tramos_vuelo.create({
            data: {
              id: uuidv4(), prod_tiqueteria_id: ticketId,
              aeropuerto_origen_id: origAirport.id,
              aeropuerto_destino_id: destAirport.id,
              salida: salidaDt, llegada: llegadaDt,
              nro_vuelo_tramo: leg.flightNumber || null,
              asiento: leg.seat || null,
              orden: i + 1,
              nro_tiquete: leg.ticketNumber || null,
              aerolinea_id: legAirlineId,
              plan_equipaje_id: leg.baggagePlan ? Number(leg.baggagePlan) : null,
            }
          });
        }
        // Pasajeros
        for (const pax of (t.passengers || [])) {
          const personaId = await findOrCreatePersona(pax.name, pax.docType, pax.docNumber);
          if (personaId) {
            await tx.pasajeros_detalle.create({
              data: {
                id: uuidv4(), detalle_venta_id: detalleId,
                persona_id: personaId, es_titular: pax.esTitular || false,
                nro_reserva: pax.nroReserva || null, nro_tiquete: pax.nroTiquete || null,
              }
            });
          }
        }
      }

      // ── HOTELERÍA ──
      for (const h of hotelData) {
        const parentDetalleId = getParentDetalleId(h);
        const detalleId = uuidv4();
        const proveedorId = await findProveedorId(h.supplier);
        await tx.detalle_venta.create({
          data: { id: detalleId, venta_id: ventaId, categoria: 'hotel', parentDetalleId: parentDetalleId,
            subtotal: precioProducto(h),
            ta: Number(h.ta || 0), costo_proveedor: Number(h.supplierCost || 0),
            destino: h.destination || null,
            proveedor_id: proveedorId,
          }
        });
        await tx.prod_hoteleria.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            hotel_nombre: h.hotelName || null, tipo_hotel: h.hotelType || 'hotel',
            destino: h.destination || null, nro_reserva: h.reservationNumber || null,
            fecha_entrada: h.startDate ? new Date(h.startDate) : null,
            fecha_salida: h.endDate ? new Date(h.endDate) : null,
            observaciones: h.observations || null,
          }
        });
        for (const g of (h.guests || [])) {
          const personaId = await findOrCreatePersona(g.name, g.docType, g.docNumber);
          if (personaId) await tx.pasajeros_detalle.create({ data: { id: uuidv4(), detalle_venta_id: detalleId, persona_id: personaId, es_titular: false } });
        }
      }

      // ── SEGUROS DE VIAJE ──
      for (const s of insuranceData) {
        const parentDetalleId = getParentDetalleId(s);
        const detalleId = uuidv4();
        const proveedorId = await findProveedorId(s.supplier);
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'insurance', parentDetalleId: parentDetalleId, subtotal: precioProducto(s), ta: Number(s.ta || 0), costo_proveedor: Number(s.supplierCost || 0), proveedor_id: proveedorId } });
        await tx.prod_seguros.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            tipo_seguro: s.insuranceType || null,
            cobertura_usd: Number(s.coverage || 0),
            dias_cobertura: Number(s.coverageDays || 0),
            fecha_inicio_vigencia: s.startDate ? new Date(s.startDate) : null,
            fecha_fin_vigencia: s.endDate ? new Date(s.endDate) : null,
            telefono_contacto: s.phone || null,
          }
        });
        for (const m of (s.members || [])) {
          const personaId = await findOrCreatePersona(m.name, m.docType, m.docNumber);
          if (personaId) await tx.pasajeros_detalle.create({ data: { id: uuidv4(), detalle_venta_id: detalleId, persona_id: personaId, es_titular: false } });
        }
      }

      // ── CHECK-IN ──
      for (const c of checkInData) {
        const parentDetalleId = getParentDetalleId(c);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'checkin', parentDetalleId: parentDetalleId, subtotal: precioProducto(c), ta: Number(c.ta || 0), costo_proveedor: Number(c.supplierCost || 0) } });
        await tx.prod_checkins.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nro_vuelo_reserva: c.flightOrReservation || null,
            fecha_viaje: c.travelDate ? new Date(c.travelDate) : null,
            asiento: c.seat || null,
            maletas_contadas: c.baggage || null,
            telefono_contacto: c.phone || null,
            necesidades_especiales: c.specialNeeds || null,
          }
        });
        if (c.passengerName) {
          const personaId = await findOrCreatePersona(c.passengerName, c.docType, c.docNumber);
          if (personaId) await tx.pasajeros_detalle.create({ data: { id: uuidv4(), detalle_venta_id: detalleId, persona_id: personaId, es_titular: true } });
        }
      }

      // ── MIGRACIÓN ──
      for (const m of migrationData) {
        const parentDetalleId = getParentDetalleId(m);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'migration', parentDetalleId: parentDetalleId, subtotal: precioProducto(m), ta: Number(m.ta || 0), costo_proveedor: Number(m.supplierCost || 0) } });
        await tx.prod_migracion.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            tipo_tramite_migratorio: m.tramiteType || null, nacionalidad: m.nationality || null,
            tipo_documento: m.docType || 'Pasaporte', pasaporte_nro: m.docNumber || null,
            pasaporte_vence: m.passportExpiry ? new Date(m.passportExpiry) : null,
            pais_destino: m.destinationCountry || null,
          }
        });
      }

      // ── SIM CARD ──
      for (const s of simCardData) {
        const parentDetalleId = getParentDetalleId(s);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'simcard', parentDetalleId: parentDetalleId, subtotal: precioProducto(s), ta: Number(s.ta || 0), costo_proveedor: Number(s.supplierCost || 0) } });
        await tx.prod_simcards.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            pais_destino: s.destinationCountry || null,
            fecha_llegada: s.arrivalDate ? new Date(s.arrivalDate) : null,
            duracion_viaje: s.tripDuration ? String(s.tripDuration) : null,
            plan_datos: s.dataPlan || null, tipo_sim: s.simType || null,
            metodo_entrega: s.deliveryMethod || null,
          }
        });
      }

      // ── RENTA DE VEHÍCULOS ──
      for (const c of carRentalData) {
        const parentDetalleId = getParentDetalleId(c);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'car', parentDetalleId: parentDetalleId, subtotal: precioProducto(c), ta: Number(c.ta || 0), costo_proveedor: Number(c.supplierCost || 0) } });
        await tx.prod_autos.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            conductor_nombre: c.driverName || null, licencia_nro: c.licenseNumber || null,
            fecha_recogida: c.pickupDate ? new Date(c.pickupDate) : null,
            fecha_devolucion: c.returnDate ? new Date(c.returnDate) : null,
            lugar_recogida: c.pickupLocation || null, categoria_auto: c.vehicleCategory || null,
            conductores_adicionales: Number(c.additionalDrivers || 0),
            tipo_seguro: c.insuranceType || null, tarjeta_garantia_info: c.guaranteeCreditCard || null,
          }
        });
      }

      // ── RENTA DE FINCAS ──
      for (const f of fincaData) {
        const parentDetalleId = getParentDetalleId(f);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'finca', parentDetalleId: parentDetalleId, subtotal: precioProducto(f), ta: Number(f.ta || 0), costo_proveedor: Number(f.supplierCost || 0) } });
        await tx.prod_fincas.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nombre_finca: f.fincaName || null, ciudad_pueblo: f.city || null,
            direccion_finca: f.address || null,
            responsable_nombre: f.responsible || null,
            documento_responsable: f.docNumber || null,
            fecha_entrada: f.checkInDate ? new Date(f.checkInDate) : null,
            fecha_salida: f.checkOutDate ? new Date(f.checkOutDate) : null,
            adultos_count: Number(f.adultsCount || 1), ninos_count: Number(f.childrenCount || 0),
            tiene_mascotas: Boolean(f.hasPets), tipo_mascota: f.petType || null,
            observaciones: f.observations || null,
          }
        });
      }

      // ── TOURS ──
      for (const t of tourData) {
        const parentDetalleId = getParentDetalleId(t);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'tour', parentDetalleId: parentDetalleId, subtotal: precioProducto(t), ta: Number(t.ta || 0), costo_proveedor: Number(t.supplierCost || 0) } });
        await tx.prod_tours.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            tour_nombre: t.selectedTour || null,
            fecha_preferida: t.preferredDate ? new Date(t.preferredDate) : null,
            adultos_count: Number(t.adultsCount || 1),
            menores_count: Number(t.childrenCount || 0),
            edades_menores: t.childrenAges || null,
            idioma_guia: t.guideLanguage || null,
            requiere_transporte: t.needsTransport ?? false,
            punto_encuentro: t.pickupPoint || null,
            condiciones_medicas: t.medicalConditions || null,
            observaciones: t.observations || null,
            telefono_contacto: t.phone || null,
          }
        });
        for (const g of (t.guests || [])) {
          const personaId = await findOrCreatePersona(g.name, g.docType, g.docNumber);
          if (personaId) await tx.pasajeros_detalle.create({ data: { id: uuidv4(), detalle_venta_id: detalleId, persona_id: personaId, es_titular: false } });
        }
      }

      // ── CENTROS DE CONVENCIÓN ──
      for (const c of conventionData) {
        const parentDetalleId = getParentDetalleId(c);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'convention', parentDetalleId: parentDetalleId, subtotal: precioProducto(c), ta: Number(c.ta || 0), costo_proveedor: Number(c.supplierCost || 0) } });
        await tx.prod_eventos.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            organizacion: c.organization || null, nombre_contacto: c.contactName || null,
            email_contacto: c.email || null,
            fechaInicio: c.startDate ? new Date(c.startDate) : null,
            fechaFin: c.endDate ? new Date(c.endDate) : null,
            asistencia_estimada: Number(c.estimatedAttendance || 0),
            espacio_requerido: c.spaceRequired || null, tipo_evento: c.eventType || null,
            notas_catering: c.cateringNotes || null,
            nombre_lugar: c.venueName || null, ciudad: c.city || null, direccion: c.address || null,
          }
        });
      }

      // ── RESTAURANTES ──
      for (const r of restaurantData) {
        const parentDetalleId = getParentDetalleId(r);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'restaurant', parentDetalleId: parentDetalleId, subtotal: precioProducto(r), ta: Number(r.ta || 0), costo_proveedor: Number(r.supplierCost || 0) } });
        await tx.prod_restaurantes.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nombre_reserva: r.reservationName || null,
            fecha_hora_reserva: r.dateTime ? new Date(r.dateTime) : null,
            personas_count: Number(r.personsCount || 1),
            preferencia_mesa: r.tablePreference || null,
            tipo_menu: r.menuType || null,
            restricciones_dieta: r.dietRestrictions || null,
            ocasion_especial: r.specialOccasion || null,
            telefono_contacto: r.phone || null,
          }
        });
      }

      // ── VISAS ──
      for (const v of visaData) {
        const parentDetalleId = getParentDetalleId(v);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'visa', parentDetalleId: parentDetalleId, subtotal: precioProducto(v), ta: Number(v.ta || 0), costo_proveedor: Number(v.supplierCost || 0) } });
        await tx.prod_visas.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nombre_completo: v.fullName || null, nacionalidad: v.nationality || null,
            tipo_documento: v.docType || 'Pasaporte', nro_pasaporte: v.docNumber || null,
            vencimiento_pasaporte: v.passportExpiration ? new Date(v.passportExpiration) : null,
            pais_aplicacion: v.countryApplying || null, tipo_visa: v.visaType || null,
            fecha_estimada_viaje: v.estimatedTravelDate ? new Date(v.estimatedTravelDate) : null,
            email_contacto: v.email || null,
          }
        });
      }

      // ── PASAPORTES ──
      for (const p of passportData) {
        const parentDetalleId = getParentDetalleId(p);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'passport', parentDetalleId: parentDetalleId, subtotal: precioProducto(p), ta: Number(p.ta || 0), costo_proveedor: Number(p.supplierCost || 0) } });
        await tx.prod_pasaportes.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            nombre_completo: p.fullName || null,
            // El formulario envía idNumber y processType; se aceptan ambos nombres.
            nro_documento: p.idNumber || p.docNumber || null,
            ciudad_residencia: p.residenceCity || null,
            tipo_tramite: p.processType || p.tramiteType || null,
            fecha_nacimiento: p.birthDate ? new Date(p.birthDate) : null,
            fecha_estimada_viaje: p.estimatedTravelDate ? new Date(p.estimatedTravelDate) : null,
            telefono_contacto: p.phone || null,
          }
        });
      }

      // ── MASCOTAS ──
      for (const m of petServiceData) {
        const parentDetalleId = getParentDetalleId(m);
        const detalleId = uuidv4();
        await tx.detalle_venta.create({ data: { id: detalleId, venta_id: ventaId, categoria: 'pet', parentDetalleId: parentDetalleId, subtotal: precioProducto(m), ta: Number(m.ta || 0), costo_proveedor: Number(m.supplierCost || 0) } });
        await tx.prod_mascotas.create({
          data: {
            id: uuidv4(), detalle_venta_id: detalleId,
            mascota_nombre: m.petName || null, especie: m.species || null,
            raza: m.breed || null, peso_kg: Number(m.weight || 0),
            // tamanoMascota es un enum de Postgres sin eñe y el formulario envía
            // "pequeño": hay que normalizarlo antes de guardar.
            tamanoMascota: normalizarTamanoMascota(m.size),
            // travelType es cómo viaja (cabina/bodega/terrestre) y transportCompany
            // la empresa: son dos columnas distintas.
            transporte_tipo: m.travelType || null,
            empresa_transporte: m.transportCompany || null,
            fecha_viaje: m.travelDate ? new Date(m.travelDate) : null,
            pais_destino: m.destinationCountry || null,
            condiciones_medicas: m.medicalConditions || null,
            observaciones: m.observations || null,
            telefono_contacto: m.phone || null,
          }
        });
      }

      // 3. Payments
      const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      for (const p of payments) {
        let mpId = null;
        if (p.method) {
          const mp = await tx.metodos_pago.findUnique({ where: { id: Number(p.method) } });
          if (mp) mpId = mp.id;
        }
        await tx.pagos_venta.create({
          data: {
            id: uuidv4(), venta_id: ventaId,
            monto: Number(p.amount),
            metodo_pago_id: mpId,
            referencia: p.reference || null,
          }
        });
      }

      // Con los productos y los pagos ya escritos, la cabecera se deriva de
      // ellos. El `total` del cuerpo de la petición deja de decidir cuánto
      // debe el cliente: solo lo dice la suma de lo que se le vendió.
      return recalcularVenta(tx, ventaId);
    }, {
      // Con los catálogos ya resueltos, una venta grande cabe de sobra en este
      // margen. Se deja explícito porque el defecto de Prisma son 5 s y una
      // venta con muchos productos los rozaba.
      timeout: 30000,
      maxWait: 10000,
    });

    // Return the new sale in the same format used by listSales
    return {
      id: created.id,
      clientId: created.cliente_id,
      asesorId: created.usuario_id,
      date: created.creado_at,
      total: created.monto_total,
      status: created.status,
      observations: created.observaciones,
      isCredit: created.es_credito,
      payments: [],
      servicesSummary: [],
    };
  }

  async listSales({ pagination, search, status, asesorId, clientId, responsableId, commissionAgentId, dateFrom, dateTo, permissionScope, viewScope, user, sortBy, sortOrder }) {
    const { page, perPage, skip } = pagination;

    // Un solo constructor de filtros para las dos consultas: el count de Prisma
    // y el SQL del listado. Los valores van como parámetros, nunca interpolados.
    const filtros = [];
    const params = [];
    // Cada '?' del fragmento consume un valor y se convierte en $1, $2, ...
    const push = (sql, ...valores) => {
      const resuelto = sql.replace(/\?/g, () => `$${params.push(valores.shift())}`);
      filtros.push(resuelto);
    };

    // El filtro se escribe UNA vez.
    //
    // Antes cada una de las nueve condiciones se duplicaba: el texto del SQL
    // para las filas y un objeto `where` de Prisma para el count. Mantener ese
    // par a mano es el origen del error recurrente del repo. Esta consulta no
    // puede dejar de ser cruda (json_agg de pagos y detalles), así que la
    // solución es que el count también sea crudo y comparta el mismo `whereSql`
    // y los mismos parámetros: ya no hay dos versiones que discrepen.
    if (search) {
      // La búsqueda cubre lo mismo que cubría el filtro en cliente: cliente,
      // asesor, comisionista, número de venta y observaciones.
      const q = `%${search}%`;
      // Si el término es un número, se interpreta como número de venta exacto.
      // Ambas consultas usan la misma regla para que el total nunca discrepe.
      const comoId = /^\d+$/.test(search.trim()) ? parseInt(search.trim(), 10) : null;

      push(`(
        v.observaciones ILIKE ?
        OR (cp.nombres || ' ' || cp.apellidos) ILIKE ?
        OR (up.nombres || ' ' || up.apellidos) ILIKE ?
        OR (comp.nombres || ' ' || comp.apellidos) ILIKE ?
        ${comoId !== null ? 'OR v.numero = ?' : ''}
      )`, ...(comoId !== null ? [q, q, q, q, comoId] : [q, q, q, q]));

    }
    if (status) {
      push('v.status = ?::"SaleStatus"', status);
    }
    if (clientId) {
      push('v.cliente_id = ?', parseInt(clientId));
    }
    if (responsableId) {
      push('v.responsable_id = ?', parseInt(responsableId));
    }
    if (commissionAgentId) {
      push('v.comisionista_id = ?', parseInt(commissionAgentId));
    }
    if (dateFrom) {
      push('v.creado_at >= ?', new Date(dateFrom));
    }
    if (dateTo) {
      push('v.creado_at <= ?', new Date(dateTo));
    }
    // El alcance 'own' manda sobre el filtro de asesor que venga por query.
    const asesorEfectivo = soloLasSuyas({ permissionScope, viewScope, user }) ? user.id : (asesorId ? parseInt(asesorId) : null);
    if (asesorEfectivo !== null) {
      push('v.usuario_id = ?', asesorEfectivo);
    }

    const whereSql = filtros.length ? 'AND ' + filtros.join(' AND ') : '';

    const sortFieldMap = { 'creadoAt': 'creadoAt', 'date': 'creadoAt', 'total': 'montoTotal', 'status': 'status', 'clientName': 'cliente_id' };
    const effectiveSortBy = sortFieldMap[sortBy] || 'creadoAt';
    const sqlOrderBy = effectiveSortBy === 'montoTotal' ? 'v.monto_total' : (effectiveSortBy === 'status' ? 'v.status' : 'v.creado_at');

    // Mismo FROM y mismo WHERE que las filas, con los mismos parámetros.
    const fromSql = `
        FROM ventas v
        JOIN clientes c ON v.cliente_id = c.id
        JOIN personas cp ON c.persona_id = cp.id
        JOIN usuarios u ON v.usuario_id = u.id
        JOIN personas up ON u.persona_id = up.id
        LEFT JOIN comisionistas com ON v.comisionista_id = com.id
        LEFT JOIN personas comp ON com.persona_id = comp.id
        WHERE v.deleted_at IS NULL ${whereSql}`;

    const [totalRows, ventasRaw] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS total ${fromSql}`, ...params),
      prisma.$queryRawUnsafe(`
        SELECT 
          v.id,
          v.numero,
          v.cliente_id as "cliente_id",
          v.usuario_id as "usuarioId",
          v.creado_at as "creadoAt",
          v.monto_total as "montoTotal",
          v.status,
          v.observaciones,
          v.es_credito as "esCredito",
          v.fecha_vence_credito as "fechaVenceCredito",
          v.monto_pagado_credito as "montoPagadoCredito",
          v.is_reviewed as "isReviewed",
          v.comisionista_id as "comisionistaId",
          v.monto_comision_bruto as "montoComisionBruto",
          v.porcentaje_retencion_comision as "porcentajeRetencionComision",
          v.monto_comision_neto as "montoComisionNeto",
          v.costo_proveedor_total as "costoProveedorTotal",
          v.ta_total as "taTotal",
          v.comision_liquidada as "comision_liquidada",
          v.responsable_id as "responsableId",
          cp.nombres || ' ' || cp.apellidos as "clientName",
          cp.email as "clientEmail",
          cp.avatar_url as "clientAvatar",
          up.nombres || ' ' || up.apellidos as "asesorName",
          comp.nombres || ' ' || comp.apellidos as "commissionAgentName",
          
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', p.id,
              'fechaPago', p.fecha_pago,
              'monto', p.monto,
              'metodoPago', (SELECT json_build_object('nombre', mp.nombre) FROM metodos_pago mp WHERE mp.id = p.metodo_pago_id)
            ))
            FROM pagos_venta p WHERE p.venta_id = v.id
          ), '[]'::json) as "pagosVenta",

          COALESCE((
            SELECT json_agg(json_build_object(
              'categoria', dv.categoria,
              'nombreServicio', dv.nombre_servicio,
              'origen', dv.origen,
              'destino', dv.destino,
              'pasajerosDetalle', COALESCE((
                SELECT json_agg(json_build_object(
                  'persona', (SELECT json_build_object('nombres', paxp.nombres, 'apellidos', paxp.apellidos) FROM personas paxp WHERE paxp.id = pd.persona_id)
                ))
                FROM pasajeros_detalle pd WHERE pd.detalle_venta_id = dv.id
              ), '[]'::json)
            ))
            FROM detalle_venta dv WHERE dv.venta_id = v.id
          ), '[]'::json) as "detalleVentas"

        ${fromSql}
        ORDER BY ${sqlOrderBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, ...params, perPage, skip)
    ]);

    const data = ventasRaw.map(v => {
      const servicesSummary = (v.detalleVentas || []).map(d => {
        const tipo = d.categoria;
        const label = labelOf(tipo);
        const route = (d.origen && d.destino) ? `${d.origen}→${d.destino}` : null;
        const pax = d.pasajerosDetalle?.[0]?.persona;
        const paxName = pax ? `${pax.nombres} ${pax.apellidos}` : null;
        const hasCustomName = d.nombreServicio && d.nombreServicio !== label;
        const detail = [hasCustomName ? d.nombreServicio : null, route, paxName].filter(Boolean).join(' · ');
        return { tipo, label, detail: detail || null };
      });

      return {
        id: v.id,
        clientId: v.cliente_id,
        clientName: v.clientName,
        clientEmail: v.clientEmail,
        clientAvatar: v.clientAvatar,
        responsableId: v.responsableId,
        asesorId: v.usuarioId,
        asesorName: v.asesorName,
        date: v.creadoAt,
        numero: v.numero,
        total: v.montoTotal,
        status: v.status,
        observations: v.observaciones,
        isCredit: v.esCredito,
        creditDueDate: v.fechaVenceCredito,
        creditPaidAmount: v.montoPagadoCredito,
        isReviewed: v.isReviewed,
        commissionAgentId: v.comisionistaId,
        commissionAgentName: v.commissionAgentName,
        commissionAgentAmount: v.montoComisionBruto,
        commissionAgentRetentionPercentage: v.porcentajeRetencionComision || 0,
        commissionAgentNetPayment: v.montoComisionNeto,
        supplierCost: v.costoProveedorTotal,
        ta: v.taTotal,
        isSettled: v.comision_liquidada,
        payments: (v.pagosVenta || []).map(p => ({
          id: p.id,
          date: p.fechaPago,
          amount: p.monto,
          method: p.metodoPago?.nombre || null
        })),
        servicesSummary
      };
    });

    return { data, meta: buildMeta(Number(totalRows[0]?.total || 0), page, perPage) };
  }

  // Cartera de crédito agrupada por cliente.
  //
  // Antes esto se calculaba en el navegador recorriendo la lista de ventas, que
  // viene paginada: la cartera salía calculada sobre una página. Aquí se agrupa
  // en SQL sobre todas las ventas a crédito del cliente.
  //
  // Reglas (las mismas que aplicaba creditUtils):
  //   venta a crédito = es_credito OR status IN ('credito','abonado')
  //   pagada  -> pagado >= total
  //   parcial -> pagado > 0          (tiene prioridad sobre vencida)
  //   vencida -> vence < hoy
  //   pendiente en cualquier otro caso
  /**
   * Cartera por cliente, con informe de antigüedad.
   *
   * `?bucket=` filtra por tramo ('overdue' agrupa los cuatro de mora) y
   * `?status=` por la clasificación anterior de urgencia. Los dos se aplican en
   * SQL y el count comparte su predicado con las filas: antes se filtraba el
   * array del LIMIT, así que `?status=overdue` devolvía 0 filas informando de
   * `meta.total: 2` y todas las páginas salían vacías.
   */
  async getCreditPortfolio({ pagination, search, status, bucket, sortBy, sortOrder, permissionScope, viewScope, user }) {
    const { page, perPage, skip } = pagination;
    const ESTADOS = ['overdue', 'urgent', 'pending', 'ok'];

    if (status && status !== 'all' && !ESTADOS.includes(status)) {
      throw new BadRequestError(
        `Estado de cartera inválido: ${status}. Válidos: all, ${ESTADOS.join(', ')}`
      );
    }
    if (bucket && bucket !== 'all' && bucket !== 'overdue' && !TRAMOS_ANTIGUEDAD.includes(bucket)) {
      throw new BadRequestError(
        `Tramo de antigüedad inválido: ${bucket}. Válidos: all, overdue, ${TRAMOS_ANTIGUEDAD.join(', ')}`
      );
    }
    if (sortBy && !ORDENES_CARTERA[sortBy]) {
      throw new BadRequestError(
        `Orden inválido: ${sortBy}. Válidos: ${Object.keys(ORDENES_CARTERA).join(', ')}`
      );
    }
    // Sin distinguir mayúsculas: 'ASC' es lo que escribe cualquiera y rechazarlo
    // no protege de nada.
    const sentido = sortOrder ? String(sortOrder).toLowerCase() : null;
    if (sentido && sentido !== 'asc' && sentido !== 'desc') {
      throw new BadRequestError(`Sentido de orden inválido: ${sortOrder}. Válidos: asc, desc`);
    }

    // El desempate por cliente va siempre al final: sin él, dos clientes con el
    // mismo importe pueden cambiar de sitio entre páginas y una fila se ve dos
    // veces o ninguna.
    const orden = ORDENES_CARTERA[sortBy] || ORDENES_CARTERA.priority;
    const ordenSql = orden.fijo
      ? orden.sql
      : `${orden.sql} ${(sentido || orden.defecto).toUpperCase()}${orden.nulos ? ` ${orden.nulos}` : ''}`;

    const filtros = [];
    const params = [];
    const push = (sql, ...valores) => {
      filtros.push(sql.replace(/\?/g, () => `$${params.push(valores.shift())}`));
    };

    if (soloLasSuyas({ permissionScope, viewScope, user })) push('v.usuario_id = ?', user.id);
    if (search) {
      const q = `%${search}%`;
      push(`((cp.nombres || ' ' || cp.apellidos) ILIKE ? OR cp.documento ILIKE ? OR CAST(v.id AS TEXT) ILIKE ?)`, q, q, q);
    }
    const extraSql = filtros.length ? 'AND ' + filtros.join(' AND ') : '';
    const baseSql = `${ctesDeCredito(extraSql)},${CTE_POR_CLIENTE}`;

    const iEstado = params.length + 1;
    const iTramo = params.length + 2;
    const filtroSql = `
      WHERE ($${iEstado}::text IS NULL OR c2.estado = $${iEstado}::text)
        AND ($${iTramo}::text IS NULL OR
             CASE WHEN $${iTramo}::text = 'overdue'
                  THEN c2.tramo IN ('days1_30','days31_60','days61_90','days90plus')
                  ELSE c2.tramo = $${iTramo}::text END)`;
    const pEstado = status && status !== 'all' ? status : null;
    const pTramo = bucket && bucket !== 'all' ? bucket : null;

    const [filas, conteo, totales] = await Promise.all([
      prisma.$queryRawUnsafe(`
        ${baseSql}
        SELECT
          c2.*,
          cp.nombres || ' ' || cp.apellidos AS "clientName",
          cp.documento  AS "clientDocNumber",
          cp.email      AS "clientEmail",
          cp.avatar_url AS "clientAvatar"
        FROM clasificados c2
        JOIN clientes c ON c2.cliente_id = c.id
        JOIN personas cp ON c.persona_id = cp.id
        ${filtroSql}
        ORDER BY ${ordenSql}, c2.cliente_id ASC
        LIMIT $${iTramo + 1} OFFSET $${iTramo + 2}
      `, ...params, pEstado, pTramo, perPage, skip),

      prisma.$queryRawUnsafe(`
        ${baseSql}
        SELECT COUNT(*)::int AS total FROM clasificados c2 ${filtroSql}
      `, ...params, pEstado, pTramo),

      // Los contadores van SIN los filtros, para que al pulsar un tramo los
      // demás sigan mostrando su cifra. Tramos y estados son excluyentes y
      // exhaustivos, así que cada familia suma el total de la cartera: es un
      // invariante comprobable.
      prisma.$queryRawUnsafe(`
        ${baseSql}
        SELECT
          COUNT(*)::int                                              AS "clientsCount",
          COALESCE(SUM("pendingAmount"), 0)::float                   AS "totalPending",
          COALESCE(SUM("overdueAmount"), 0)::float                   AS "totalOverdue",
          COALESCE(SUM("agingCurrent"), 0)::float                    AS "totalCurrent",
          COALESCE(SUM("aging1_30"), 0)::float                       AS "total1_30",
          COALESCE(SUM("aging31_60"), 0)::float                      AS "total31_60",
          COALESCE(SUM("aging61_90"), 0)::float                      AS "total61_90",
          COALESCE(SUM("aging90plus"), 0)::float                     AS "total90plus",
          COALESCE(SUM("agingUndated"), 0)::float                    AS "totalUndated",
          COALESCE(MAX("daysOverdue"), 0)::int                       AS "maxDaysOverdue",
          COALESCE(SUM(CASE WHEN estado = 'urgent'
                       THEN "pendingAmount" ELSE 0 END), 0)::float   AS "totalUrgent",
          COUNT(*) FILTER (WHERE tramo = 'current')::int             AS "countCurrent",
          COUNT(*) FILTER (WHERE tramo = 'days1_30')::int            AS "count1_30",
          COUNT(*) FILTER (WHERE tramo = 'days31_60')::int           AS "count31_60",
          COUNT(*) FILTER (WHERE tramo = 'days61_90')::int           AS "count61_90",
          COUNT(*) FILTER (WHERE tramo = 'days90plus')::int          AS "count90plus",
          COUNT(*) FILTER (WHERE tramo = 'undated')::int             AS "countUndated",
          COUNT(*) FILTER (WHERE estado = 'overdue')::int            AS "countOverdue",
          COUNT(*) FILTER (WHERE estado = 'urgent')::int             AS "countUrgent",
          COUNT(*) FILTER (WHERE estado = 'pending')::int            AS "countPending",
          COUNT(*) FILTER (WHERE estado = 'ok')::int                 AS "countOk"
        FROM clasificados
      `, ...params),
    ]);

    const t = totales[0] || {};

    const data = filas.map(f => ({
      client: {
        id: f.cliente_id,
        name: f.clientName,
        docNumber: f.clientDocNumber,
        email: f.clientEmail,
        avatar: f.clientAvatar,
      },
      ...mapearResumenCliente(f),
    }));

    return {
      data,
      meta: {
        ...buildMeta(conteo[0]?.total || 0, page, perPage),
        totals: {
          clientsCount: t.clientsCount || 0,
          totalPending: t.totalPending || 0,
          totalOverdue: t.totalOverdue || 0,
          totalUrgent: t.totalUrgent || 0,
          maxDaysOverdue: t.maxDaysOverdue || 0,
          aging: {
            current: t.totalCurrent || 0,
            days1_30: t.total1_30 || 0,
            days31_60: t.total31_60 || 0,
            days61_90: t.total61_90 || 0,
            days90plus: t.total90plus || 0,
            undated: t.totalUndated || 0,
          },
          bucketCounts: {
            current: t.countCurrent || 0,
            days1_30: t.count1_30 || 0,
            days31_60: t.count31_60 || 0,
            days61_90: t.count61_90 || 0,
            days90plus: t.count90plus || 0,
            undated: t.countUndated || 0,
          },
          countOverdue: t.countOverdue || 0,
          countUrgent: t.countUrgent || 0,
          countPending: t.countPending || 0,
          countOk: t.countOk || 0,
        },
      },
    };
  }

  /**
   * Los créditos de UN cliente: el ítem de la colección `/sales/credit`.
   *
   * La pantalla los sacaba de `listSales({ clientId, perPage: 50 })` y los
   * filtraba y clasificaba en el navegador: se traía la venta entera con todos
   * sus productos para leer cuatro campos, se cortaba en 50 sin mirar
   * `meta.totalPages`, y el estado se calculaba con una tercera copia de la
   * regla. Aquí van ya clasificados por el MISMO SQL que el listado.
   */
  async getClientCredits(clientId, { pagination, permissionScope, viewScope, user } = {}) {
    const id = Number(clientId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestError('El identificador del cliente debe ser un número entero');
    }
    const { page = 1, perPage = 20, skip = 0 } = pagination || {};

    const filtros = [];
    const params = [];
    const push = (sql, ...valores) => {
      filtros.push(sql.replace(/\?/g, () => `$${params.push(valores.shift())}`));
    };

    push('v.cliente_id = ?', id);
    // Mismo ámbito que el listado: con alcance 'own' un asesor no ve la cartera
    // de un cliente atendido por otro, ni por su URL directa.
    if (soloLasSuyas({ permissionScope, viewScope, user })) push('v.usuario_id = ?', user.id);
    const extraSql = 'AND ' + filtros.join(' AND ');
    const baseSql = ctesDeCredito(extraSql);

    const [resumen, creditos, conteo] = await Promise.all([
      prisma.$queryRawUnsafe(`
        ${baseSql},${CTE_POR_CLIENTE}
        SELECT
          c2.*,
          cp.nombres || ' ' || cp.apellidos AS "clientName",
          cp.documento  AS "clientDocNumber",
          cp.email      AS "clientEmail",
          cp.avatar_url AS "clientAvatar"
        FROM clasificados c2
        JOIN clientes c ON c2.cliente_id = c.id
        JOIN personas cp ON c.persona_id = cp.id
      `, ...params),

      prisma.$queryRawUnsafe(`
        ${baseSql}
        SELECT
          venta_id, creado_at, venta_status, fecha_vence_credito,
          monto_total::float AS total, pagado::float AS paid, pendiente::float AS pending,
          COALESCE(dias_mora, 0)::int AS "daysOverdue", liquidada, tramo
        FROM por_credito
        WHERE NOT liquidada
        -- Lo más atrasado primero, que es el orden en que se cobra. Los sin
        -- fecha van al final: no tienen vencimiento con el que ordenarlos.
        ORDER BY dias_mora DESC NULLS LAST, fecha_vence_credito ASC NULLS LAST, venta_id ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, ...params, perPage, skip),

      prisma.$queryRawUnsafe(`
        ${baseSql}
        SELECT COUNT(*)::int AS total FROM por_credito WHERE NOT liquidada
      `, ...params),
    ]);

    const r = resumen[0];
    if (!r) throw new NotFoundError('El cliente no tiene créditos pendientes');

    return {
      data: creditos.map(c => ({
        saleId: c.venta_id,
        date: c.creado_at,
        saleStatus: c.venta_status,
        dueDate: c.fecha_vence_credito,
        total: c.total,
        paidAmount: c.paid,
        pendingAmount: c.pending,
        daysOverdue: c.daysOverdue,
        agingBucket: c.tramo,
      })),
      meta: {
        ...buildMeta(conteo[0]?.total || 0, page, perPage),
        client: {
          id: r.cliente_id,
          name: r.clientName,
          docNumber: r.clientDocNumber,
          email: r.clientEmail,
          avatar: r.clientAvatar,
        },
        summary: mapearResumenCliente(r),
      },
    };
  }

  async _loadProducts(where) {
    const base = await prisma.detalle_venta.findMany({
      where,
      include: { pasajeros_detalle: { include: { personas: true } }, proveedores: true }
    });

    const detalles = await Promise.all(base.map(async (d) => {
      const entry = CATALOG[d.categoria];
      if (!entry) return d;
      const inner = entry.include[entry.relationKey];
      const queryOptions = { where: { detalle_venta_id: d.id } };
      if (inner && typeof inner === 'object' && inner.include) queryOptions.include = inner.include;
      const productData = await prisma[entry.relationKey].findUnique(queryOptions);
      return { ...d, [entry.relationKey]: productData };
    }));

    const byCategory = {};
    for (const d of detalles) {
      const entry = CATALOG[d.categoria];
      if (!entry) continue;
      const arr = byCategory[d.categoria] = byCategory[d.categoria] || [];
      // El transform emite el id del prod_*, no el del detalle_venta. El vínculo
      // padre-hijo va por detalle_venta, así que lo sellamos aquí.
      const desde = arr.length;
      entry.transform(d, mapPassengers(d), arr);
      for (let i = desde; i < arr.length; i++) arr[i].detalleId = d.id;
    }
    return byCategory;
  }

  // Cabecera de la venta, sin los datos de los productos.
  // Los productos se piden aparte con getSaleProducts / getSaleProductsByCategory.

  _saleHeader(venta) {
    return {
      id: venta.id,
      clientId: venta.cliente_id,
      clientName: `${venta.clientes.personas.nombres} ${venta.clientes.personas.apellidos}`,
      clientDocType: venta.clientes.personas.tipo_documento || null,
      clientDocNumber: venta.clientes.personas.documento || null,
      clientEmail: venta.clientes.personas.email || null,
      clientPhone: venta.clientes.personas.telefono || null,
      asesorId: venta.usuario_id,
      asesorName: `${venta.usuarios.personas.nombres} ${venta.usuarios.personas.apellidos}`,
      responsableId: venta.responsable_id || null,
      responsableName: venta.responsables ? `${venta.responsables.personas.nombres} ${venta.responsables.personas.apellidos}` : null,
      date: venta.creado_at,
      total: venta.monto_total,
      paymentMethod: venta.metodos_pago?.nombre || null,
      // El número que ve la agencia. El `id` sigue siendo la clave interna y
      // lo que va en la URL; esto es lo que se pinta.
      numero: venta.numero,
      status: venta.status,
      observations: venta.observaciones,
      isCredit: venta.es_credito,
      creditDueDate: venta.fecha_vence_credito,
      creditPaidAmount: venta.monto_pagado_credito,
      isReviewed: venta.is_reviewed,
      commissionAgentId: venta.comisionista_id,
      commissionAgentName: venta.comisionistas ? `${venta.comisionistas.personas.nombres} ${venta.comisionistas.personas.apellidos}` : null,
      commissionAgentAmount: venta.monto_comision_bruto,
      commissionAgentRetentionPercentage: venta.porcentaje_retencion_comision || 0,
      commissionAgentNetPayment: venta.monto_comision_neto,
      supplierCost: venta.costo_proveedor_total,
      ta: venta.ta_total,
      isSettled: venta.comision_liquidada,
      payments: venta.pagos_venta.map(p => ({
        id: p.id,
        date: p.fecha_pago,
        amount: p.monto,
        method: p.metodos_pago?.nombre || null
      }))
    };
  }

  async getSaleById(id, alcance = {}) {
    await ventaVisible(id, alcance);
    const [venta, inventario] = await Promise.all([
      // `findFirst` con `deleted_at: null`, no `findUnique`: una venta eliminada
      // seguía devolviendo 200 por su id aunque no apareciera en ningún listado.
      prisma.ventas.findFirst({
        where: { id, deleted_at: null },
        include: {
          clientes: { include: { personas: true } },
          usuarios: { include: { personas: true } },
          comisionistas: { include: { personas: true } },
          responsables: { include: { personas: true } },
          metodos_pago: true,
          pagos_venta: { include: { metodos_pago: true } }
        }
      }),
      // Inventario: solo productos de primer nivel. Los hijos de un plan
      // se cuentan dentro de su plan, no como entradas propias.
      prisma.detalle_venta.groupBy({
        by: ['categoria'],
        where: { venta_id: id, parentDetalleId: null },
        _count: { _all: true }
      })
    ]);

    if (!venta) throw new NotFoundError('Venta no encontrada');

    return {
      ...this._saleHeader(venta),
      products: inventario
        .filter(r => CATALOG[r.categoria])
        .map(r => ({ category: r.categoria, label: labelOf(r.categoria), count: r._count._all }))
    };
  }

  // Todos los productos de la venta. Lo usa el voucher, que necesita la venta entera.
  async getSaleProducts(id, alcance = {}) {
    await ventaVisible(id, alcance);
    const venta = await prisma.ventas.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
    if (!venta) throw new NotFoundError('Venta no encontrada');

    const byCategory = await this._loadProducts({ venta_id: id, parentDetalleId: null });
    const children = await this._loadProducts({ venta_id: id, parentDetalleId: { not: null } });
    this._attachChildren(byCategory, children);

    const out = {};
    for (const slug of SLUGS) out[CATALOG[slug].responseKey] = byCategory[slug] || [];
    return out;
  }

  // Una sola categoría. Un producto hijo de un plan no sale aquí:
  // solo aparece dentro del GET de su plan.
  async getSaleProductsByCategory(id, category, alcance = {}) {
    await ventaVisible(id, alcance);
    const entry = CATALOG[category];
    if (!entry) throw new NotFoundError(`Categoría de producto desconocida: ${category}`);

    const venta = await prisma.ventas.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
    if (!venta) throw new NotFoundError('Venta no encontrada');

    const byCategory = await this._loadProducts({
      venta_id: id, categoria: category, parentDetalleId: null
    });

    if (category === 'plan') {
      const children = await this._loadProducts({
        venta_id: id, parentDetalleId: { not: null }
      });
      this._attachChildren(byCategory, children);
    }

    return byCategory[category] || [];
  }

  // Cuelga cada producto hijo bajo el plan al que pertenece.
  _attachChildren(byCategory, children) {
    const planes = byCategory.plan || [];
    if (!planes.length) return;
    const porId = new Map(planes.map(p => [p.detalleId, p]));
    for (const slug of CHILD_SLUGS) {
      for (const child of children[slug] || []) {
        const padre = porId.get(child.parentDetalleId);
        if (!padre) continue;
        padre.includedProducts = padre.includedProducts || {};
        padre.includedProducts[slug] = padre.includedProducts[slug] || [];
        padre.includedProducts[slug].push(child);
      }
    }
  }


  async voidSale(id, reason, alcance = {}) {
    if (!reason) throw new BadRequestError('Debe proporcionar un motivo para anular la venta');
    const venta = await ventaVisible(id, alcance, { paraEscribir: true });

    const newObservaciones = venta.observaciones ? `${venta.observaciones}\n[ANULADA] Motivo: ${reason}` : `[ANULADA] Motivo: ${reason}`;
    await prisma.ventas.update({
      where: { id },
      data: { status: 'anulado', observaciones: newObservaciones }
    });

    return { message: 'Venta anulada correctamente' };
  }

  async removeSale(id, alcance = {}) {
    await ventaVisible(id, alcance, { paraEscribir: true });
    await prisma.ventas.update({ where: { id }, data: { deleted_at: new Date() } });
    return { message: 'Venta eliminada' };
  }

  async registerPayment(id, { amount, isTotal, method, reference }, alcance = {}) {
    await ventaVisible(id, alcance, { paraEscribir: true });
    const { randomUUID } = require('crypto');
    // `method` llega como NOMBRE ("Efectivo"): así lo envía el modal de venta y
    // así se buscaba. Se acepta también el id, porque `createSale` sí usa el id
    // para el mismo campo y enviarlo aquí guardaba el pago sin método, en
    // silencio. Con las dos formas, ninguna de las dos convenciones pierde el
    // dato mientras se unifican.
    let metodo_pago_id = null;
    if (method !== undefined && method !== null && method !== '') {
      const comoId = Number(method);
      const m = Number.isInteger(comoId) && comoId > 0
        ? await prisma.metodos_pago.findUnique({ where: { id: comoId } })
        : await prisma.metodos_pago.findFirst({ where: { nombre: String(method) } });
      if (m) metodo_pago_id = m.id;
    }

    // Antes había dos ramas: si el cuerpo traía `saleTotal` y `currentPaidAmount`
    // se calculaba con ellos, y solo si faltaban se miraba la base. Eso ponía el
    // importe de la deuda en manos del cliente: un POST de un peso con
    // `saleTotal: 1` dejaba una venta de 3.000.000 en `pagado`. Ningún cliente
    // los enviaba —eran superficie de ataque y nada más—, así que se van.
    const resultado = await prisma.transaccion(async (tx) => {
      const venta = await tx.ventas.findFirst({
        where: { id, deleted_at: null },
        select: { monto_total: true, monto_pagado_credito: true, status: true },
      });
      if (!venta) throw new NotFoundError('Venta no encontrada');
      if (venta.status === 'anulado') {
        throw new BadRequestError('No se pueden registrar pagos sobre una venta anulada');
      }

      // `isTotal` significa "salda lo que queda", y cuánto queda lo sabe la base.
      const pendiente = aCentimos(venta.monto_total - (venta.monto_pagado_credito || 0));
      const monto = isTotal ? pendiente : aCentimos(amount);
      if (!(monto > 0)) {
        throw new BadRequestError('El monto del pago debe ser mayor que cero');
      }

      const pago = await tx.pagos_venta.create({
        data: { id: randomUUID(), venta_id: id, monto, metodo_pago_id, referencia: reference || null },
      });

      // El monto pagado y el estado salen de la suma de los pagos, no de un
      // acumulado que se va arrastrando y puede desviarse.
      const actualizada = await recalcularVenta(tx, id);
      return { pago, actualizada };
    });

    return {
      creditPaidAmount: resultado.actualizada.monto_pagado_credito,
      status: resultado.actualizada.status,
      payment: {
        id: resultado.pago.id,
        date: resultado.pago.fecha_pago,
        amount: resultado.pago.monto,
        method: method || null,
        reference: resultado.pago.referencia,
      },
    };
  }

  async deletePayment(saleId, paymentId, alcance = {}) {
    await ventaVisible(saleId, alcance, { paraEscribir: true });
    // Misma corrección que en `registerPayment`: la rama que aceptaba
    // `currentPayments` y `saleTotal` del cuerpo dejaba que el cliente
    // decidiera el estado de cobro resultante.
    const actualizada = await prisma.transaccion(async (tx) => {
      const pago = await tx.pagos_venta.findUnique({
        where: { id: paymentId },
        select: { id: true, venta_id: true },
      });
      if (!pago) throw new NotFoundError('Pago no encontrado');
      if (pago.venta_id !== saleId) throw new BadRequestError('El pago no pertenece a esta venta');

      await tx.pagos_venta.delete({ where: { id: paymentId } });
      return recalcularVenta(tx, saleId);
    });

    return {
      message: 'Pago eliminado',
      creditPaidAmount: actualizada.monto_pagado_credito,
      status: actualizada.status,
    };
  }

  /**
   * Editar la cabecera de una venta.
   *
   * Antes de esto el endpoint devolvía `200 {"message":"Sale updated"}` sin
   * tocar la base: la interfaz decía que había guardado y no guardaba nada.
   *
   * Lo editable es la cabecera y solo lo que no se deriva —ver
   * `CAMPOS_EDITABLES` y `NO_EDITABLES`, donde está el razonamiento—. El
   * cuerpo se compara contra esa lista y lo que no encaje sale por un 400 que
   * dice por dónde se cambia; los productos y los abonos tienen sus propios
   * endpoints, y el total y el estado no los decide nadie desde fuera.
   *
   * Tres invariantes que se comprueban antes de escribir, porque después ya no
   * se pueden distinguir de un dato válido:
   *
   * - **Las relaciones existen.** Un `clientId` inexistente daría un error de
   *   clave ajena de Postgres, que llega como 500 y sin decir qué campo era.
   * - **La comisión liquidada no se toca.** Ya se pagó al comisionista;
   *   cambiar el importe ahora descuadra la liquidación que lo incluyó.
   * - **A crédito, con fecha de vencimiento.** El alta ya lo exige; aquí hay
   *   que reevaluarlo porque una edición puede dejar a crédito una venta sin
   *   fecha, y sin fecha no hay mora que reclamar.
   */
  async updateSale(id, body = {}, alcance = {}) {
    const ventaId = Number(id);

    const invalidos = Object.keys(body)
      .filter(clave => !(clave in CAMPOS_EDITABLES))
      .map(clave => (NO_EDITABLES[clave] ? `${clave} (${NO_EDITABLES[clave]})` : clave));
    if (invalidos.length) {
      throw new BadRequestError(
        `Campos no editables: ${invalidos.join('; ')}. ` +
        `Se aceptan: ${Object.keys(CAMPOS_EDITABLES).join(', ')}`
      );
    }
    if (!Object.keys(body).length) throw new BadRequestError('No se envió ningún campo que editar');

    const venta = await ventaVisible(ventaId, alcance, { paraEscribir: true });
    // Una venta anulada ya salió del circuito de cobro, y `voidSale` deja el
    // motivo en las observaciones: reescribirlas borraría la traza.
    if (venta.status === 'anulado') throw new BadRequestError('Una venta anulada no se puede editar');

    const data = {};
    for (const [clave, valor] of Object.entries(body)) {
      data[CAMPOS_EDITABLES[clave].columna] = leerCampo(clave, CAMPOS_EDITABLES[clave], valor);
    }

    if (venta.comision_liquidada && CLAVES_COMISION.some(clave => clave in body)) {
      throw new BadRequestError('La comisión de esta venta ya fue liquidada y no se puede modificar');
    }
    // Quitar el comisionista sin borrar sus importes dejaría una comisión sin
    // dueño en el informe de liquidaciones.
    if ('commissionAgentId' in body && data.comisionista_id === null) {
      data.monto_comision_bruto = 0;
      data.porcentaje_retencion_comision = 0;
      data.monto_comision_neto = 0;
    }

    for (const clave of Object.keys(body)) {
      const def = CAMPOS_EDITABLES[clave];
      const valor = data[def.columna];
      if (!def.modelo || valor === null) continue;
      const filtro = { id: valor };
      if (def.vigente) filtro.deleted_at = null;
      const existe = await prisma[def.modelo].findFirst({ where: filtro, select: { id: true } });
      if (!existe) throw new BadRequestError(`${def.etiqueta} no existe`);
    }

    const esCredito = 'es_credito' in data ? data.es_credito : Boolean(venta.es_credito);
    const conSaldo = aCentimos(venta.monto_pagado_credito) < aCentimos(venta.monto_total);
    const vence = 'fecha_vence_credito' in data ? data.fecha_vence_credito : venta.fecha_vence_credito;
    if ((esCredito || conSaldo) && !vence) {
      throw new BadRequestError('Una venta a crédito necesita fecha de vencimiento (creditDueDate)');
    }

    await prisma.transaccion(async (tx) => {
      await tx.ventas.update({ where: { id: ventaId }, data });
      // Ningún campo editable mueve dinero, así que el recálculo es un no-op
      // hoy. Va igual: si mañana entra un campo que sí lo mueva, el total y el
      // estado no podrán quedarse atrás sin que nadie se acuerde.
      await recalcularVenta(tx, ventaId);
    });

    // La venta entera, no el parche: quien edita necesita ver el resultado, y
    // el estado y el total pueden haber cambiado sin que los mandara.
    return this.getSaleById(ventaId);
  }

  async updateReviewStatus(saleId, isReviewed, alcance = {}) {
    await ventaVisible(saleId, alcance, { paraEscribir: true });
    const sale = await prisma.ventas.findFirst({ where: { id: saleId, deleted_at: null } });
    if (!sale) throw new NotFoundError('Venta no encontrada');
    if (sale.status !== 'pagado') throw new BadRequestError('La venta debe estar pagada para ser revisada');
    if (sale.isReviewed) throw new BadRequestError('Esta venta ya fue revisada y no se puede modificar su estado');

    const updatedSale = await prisma.ventas.update({
      where: { id: saleId },
      data: { isReviewed }
    });

    return updatedSale;
  }

  async listPayments(saleId, alcance = {}) {
    await ventaVisible(saleId, alcance);
    // Los pagos de una venta eliminada tampoco se leen: era el último hueco
    // por el que una venta borrada seguía asomando.
    const payments = await prisma.pagos_venta.findMany({
      where: { venta_id: saleId, ventas: { deleted_at: null } },
      select: { id: true, fecha_pago: true, monto: true, metodos_pago: { select: { nombre: true } } },
      orderBy: { fecha_pago: 'asc' }
    });

    return payments.map(p => ({
      id: p.id,
      date: p.fecha_pago,
      amount: p.monto,
      method: p.metodos_pago?.nombre || null
    }));
  }

  async sendVoucher(saleId, pdfBase64, alcance = {}) {
    await ventaVisible(saleId, alcance);
    if (!pdfBase64) throw new BadRequestError('El PDF es requerido (base64)');
    const venta = await prisma.ventas.findFirst({
      where: { id: saleId, deleted_at: null },
      include: { clientes: { include: { personas: true } }, usuarios: { include: { personas: true } } }
    });

    if (!venta) throw new NotFoundError('Venta no encontrada');
    const clientEmail = venta.clientes.personas.email;
    if (!clientEmail) throw new BadRequestError('El cliente no tiene correo electrónico registrado');

    const clientName = `${venta.clientes.personas.nombres} ${venta.clientes.personas.apellidos}`;
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const pdfBuffer = Buffer.from(base64Data, 'base64');

    // El cliente final recibe esto con el nombre de SU agencia, y con el número
    // de venta que esa agencia usa —no el id interno, que es global y con huecos.
    const { nombre: agencia } = await emailService.marcaDeCorreo();
    const numero = venta.numero ?? saleId;

    await emailService.sendEmail({
      to: clientEmail,
      subject: `${agencia} · Voucher de tu reserva #${numero}`,
      html: `<p>Hola <strong>${clientName}</strong>,</p><p>Adjunto encontrarás el voucher de tu reserva.</p><p>${agencia}</p>`,
      attachments: [{ filename: `Voucher_Reserva_${numero}.pdf`, content: pdfBuffer }]
    });

    return { message: `Voucher enviado exitosamente a ${clientEmail}` };
  }
}

module.exports = new SalesService();
