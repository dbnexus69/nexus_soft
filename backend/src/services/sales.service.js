const prisma = require('../config/db');
const { AppError, NotFoundError, BadRequestError, ForbiddenError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');
const { recalcularVenta, aCentimos, bloquearVenta } = require('./saleTotals');
const emailService = require('../utils/emailService');
const { normalizarDocumento, mensajeDocumento } = require('../utils/datosPersona');

// Los includes, transforms y helpers de producto viven en el catálogo:
// una sola fuente de verdad para las 15 categorías.
const {
  CATALOG, SLUGS, CHILD_SLUGS,
  PRODUCT_INCLUDES, PRODUCT_TRANSFORMS,
  mapPassengers, mapLegs, labelOf
} = require('../catalog/products');

const { randomUUID: uuidv4 } = require('crypto');
const { soloLasSuyas, esDeOtro, ventaVisible } = require('./ventasAlcance');
const { listSales } = require('./ventasListado');
const { getCreditPortfolio, getClientCredits } = require('./ventasCartera');
const { escribirProductos } = require('./ventaProductos');

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
  ta: 'la ganancia la suman los productos',
  iva: 'el IVA lo calcula el servidor a partir de la ganancia',
  supplierCost: 'el costo de proveedor lo suman los productos',
  status: 'el estado lo deciden los pagos',
  paidAmount: 'lo suman los pagos',
  products: 'los productos se editan en /sales/:saleId/products/...',
  payments: 'los abonos se registran en POST /sales/:id/payments',
  asesorId: 'la venta no cambia de asesor por aquí',
  isReviewed: 'se marca en PATCH /sales/:id/review-status',
};

/**
 * Las referencias que trae una venta nueva, y de quién tienen que ser.
 *
 * `createSale` cogía `clientId`, `asesorId`, `responsableId` y
 * `commissionAgentId` del cuerpo y los escribía tal cual. Zod valida la forma
 * —que sea un entero—, no la pertenencia, y el controlador ni siquiera le
 * pasaba el usuario al servicio. Con la RLS puesta eso NO es una fuga de
 * lectura, pero sí algo peor de encontrar: las comprobaciones de clave ajena
 * de Postgres se saltan las políticas, así que la fila se escribía apuntando a
 * un cliente de otra agencia, y el listado —que hace JOIN con `clientes`, ya
 * filtrado— no la enseñaba nunca. Una venta guardada e invisible.
 *
 * Desde la migración `integridad_entre_empresas` la base lo rechaza, pero lo
 * haría con un 23503 y un 500. Comprobarlo aquí lo convierte en un 400 que
 * dice cuál de los cuatro ids no vale.
 *
 * "No existe" y no "no puede": leídos con la RLS puesta, un id de otra agencia
 * es indistinguible de uno inventado, y así debe contestarse.
 */
const REFERENCIAS_NUEVA_VENTA = {
  clientId:          { modelo: 'clientes',      vigente: true, etiqueta: 'El cliente' },
  asesorId:          { modelo: 'usuarios',                     etiqueta: 'El asesor' },
  responsableId:     { modelo: 'responsables',  vigente: true, etiqueta: 'El responsable' },
  commissionAgentId: { modelo: 'comisionistas',                etiqueta: 'El comisionista' },
};

/**
 * Comprueba que cada id exista DENTRO de la empresa activa.
 *
 * No hace falta filtrar por `empresa_id`: `prisma` va por la extensión que fija
 * el inquilino, así que la fila de otra agencia sencillamente no está.
 */
async function comprobarReferencias(definiciones, valores) {
  for (const [clave, def] of Object.entries(definiciones)) {
    const valor = valores[clave];
    if (!def.modelo || valor === null || valor === undefined) continue;
    const filtro = { id: Number(valor) };
    if (def.vigente) filtro.deleted_at = null;
    const existe = await prisma[def.modelo].findFirst({ where: filtro, select: { id: true } });
    if (!existe) throw new BadRequestError(`${def.etiqueta} no existe`);
  }
}

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
// Las quince listas de productos que trae el cuerpo de una venta.
const CAMPOS_DE_PRODUCTO = [
  'ticketData', 'hotelData', 'insuranceData', 'planData', 'checkInData',
  'migrationData', 'simCardData', 'carRentalData', 'fincaData', 'tourData',
  'conventionData', 'restaurantData', 'visaData', 'passportData', 'petServiceData',
];

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
    const items = CAMPOS_DE_PRODUCTO.flatMap(c => Array.isArray(body[c]) ? body[c] : []);

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
        if (p?.docNumber) documentos.add(normalizarDocumento(p.docNumber));
      }
      if (it.docNumber) documentos.add(normalizarDocumento(it.docNumber));
    }
    // Los códigos se buscan en mayúsculas: el catálogo los guarda así y un
    // "bog" tecleado a mano es el mismo aeropuerto.
    const codigosBuscados = [...codigosIata].map(c => String(c).trim().toUpperCase());

    const [proveedores, aerolineas, aeropuertos, personas, tarjetas, politicasEquipaje, tiposDocumento] = await Promise.all([
      prisma.proveedores.findMany({ select: { id: true, nombre: true } }),
      prisma.aerolineas.findMany({ select: { id: true, nombre: true } }),
      prisma.aeropuertos.findMany({
        where: { codigo_iata: { in: codigosBuscados } },
        select: { id: true, codigo_iata: true },
      }),
      documentos.size
        ? prisma.personas.findMany({
            where: { documento: { in: [...documentos] } },
            select: { id: true, documento: true },
          })
        : [],
      prisma.tarjetas_agencia.findMany({ select: { id: true, nombre: true } }),
      prisma.politicas_equipaje.findMany({
        select: { id: true, tipo_tarifa: true, aerolineas: { select: { nombre: true } } },
      }),
      prisma.tipos_documento.findMany({ select: { id: true, nombre: true, abreviatura: true } }),
    ]);

    return {
      proveedores,
      aerolineas,
      tarjetas,
      // Cada plan de equipaje por el texto que muestra el formulario, "<aerolínea> - <tarifa>".
      politicasEquipaje: new Map(politicasEquipaje.map(p => [
        `${p.aerolineas.nombre} - ${p.tipo_tarifa}`.toLowerCase(), p.id,
      ])),
      idsPoliticasEquipaje: new Set(politicasEquipaje.map(p => p.id)),
      // Se indexan para que la búsqueda dentro de la transacción sea O(1).
      aeropuertos: new Map(aeropuertos.map(a => [a.codigo_iata, a.id])),
      personas: new Map(personas.map(p => [p.documento, p.id])),
      // El tipo de documento por abreviatura ("CC") o por nombre, que es lo que mandan los formularios.
      tiposDocumento: new Map(tiposDocumento.flatMap(t => [
        [t.abreviatura.toUpperCase(), t], [t.nombre.trim().toLowerCase(), t],
      ])),
    };
  }

  _tipoDocumento(valor, catalogos) {
    const texto = String(valor ?? '').trim();
    if (!texto) return null;
    return catalogos.tiposDocumento.get(texto.toUpperCase()) || catalogos.tiposDocumento.get(texto.toLowerCase()) || undefined;
  }

  // El documento de cada persona de la venta (pasajeros, huéspedes, asegurados y el titular de los productos de
  // un solo titular) se comprueba ANTES de abrir la transacción, con las mismas reglas que un cliente (spec 003,
  // T4). Antes `findOrCreatePersona` lo guardaba sin mirar el formato y sin el tipo: una cédula con letras
  // entraba, y la persona quedaba con `tipo_documento_id` nulo. Un tipo que no existe es un 422 con su campo; un
  // documento sin tipo se juzga con la regla genérica, como hasta ahora los formularios que no lo piden.
  _validarPersonas(body, catalogos) {
    const detalles = [];
    const revisar = (ruta, p) => {
      if (!p || p.docNumber === undefined || p.docNumber === null || String(p.docNumber).trim() === '') return;
      const tipo = this._tipoDocumento(p.docType, catalogos);
      if (tipo === undefined) {
        detalles.push({ field: `${ruta}.docType`, message: `El tipo de documento "${p.docType}" no existe` });
        return;
      }
      const mensaje = mensajeDocumento(tipo?.abreviatura, normalizarDocumento(p.docNumber));
      if (mensaje) detalles.push({ field: `${ruta}.docNumber`, message: mensaje });
    };
    for (const campo of CAMPOS_DE_PRODUCTO) {
      (Array.isArray(body[campo]) ? body[campo] : []).forEach((it, i) => {
        revisar(`${campo}.${i}`, it);
        for (const lista of ['passengers', 'guests', 'travelers', 'members']) {
          (Array.isArray(it?.[lista]) ? it[lista] : []).forEach((p, j) => revisar(`${campo}.${i}.${lista}.${j}`, p));
        }
      });
    }
    if (detalles.length) {
      throw new AppError(
        `Datos de personas inválidos: ${detalles.map(d => `${d.field}: ${d.message}`).join('; ')}`,
        422, 'VALIDATION_ERROR', detalles,
      );
    }
  }

  // Los aeropuertos y los planes de equipaje de los tiquetes se comprueban ANTES
  // de abrir la transacción. Antes un aeropuerto que no existía se guardaba como
  // "UNK" (y se creaba en el catálogo compartido), y un plan de equipaje que el
  // formulario manda como texto ("Avianca - Light") se perdía: el vuelo salía
  // sin aeropuerto ni equipaje y nadie se enteraba.
  _validarTiquetes(ticketData, catalogos) {
    const detalles = [];
    ticketData.forEach((t, i) => {
      const tramos = [
        ...(t.legs || []).map((l, j) => [`legs.${j}`, l]),
        ...(t.outboundStops || []).map((l, j) => [`outboundStops.${j}`, l]),
        ...(t.returnLeg ? [['returnLeg', t.returnLeg]] : []),
        ...(t.returnStops || []).map((l, j) => [`returnStops.${j}`, l]),
      ];
      for (const [ruta, leg] of tramos) {
        if (!leg || !leg.origin || !leg.destination) continue;
        for (const campo of ['origin', 'destination']) {
          const codigo = String(leg[campo]).trim().toUpperCase();
          if (!catalogos.aeropuertos.has(codigo)) {
            detalles.push({
              field: `ticketData.${i}.${ruta}.${campo}`,
              message: `El aeropuerto "${leg[campo]}" no existe en el catálogo`,
            });
          }
        }
        if (this._planEquipajeId(leg.baggagePlan, catalogos) === undefined) {
          detalles.push({
            field: `ticketData.${i}.${ruta}.baggagePlan`,
            message: `El plan de equipaje "${leg.baggagePlan}" no existe en el catálogo`,
          });
        }
      }
      if (this._planEquipajeId(t.baggagePlan, catalogos) === undefined) {
        detalles.push({
          field: `ticketData.${i}.baggagePlan`,
          message: `El plan de equipaje "${t.baggagePlan}" no existe en el catálogo`,
        });
      }
    });
    if (detalles.length) {
      throw new AppError(
        `Datos de vuelo inválidos: ${detalles.map(d => d.message).join('; ')}`,
        422, 'VALIDATION_ERROR', detalles,
      );
    }
  }

  // El id del plan de equipaje a partir de lo que manda el formulario: el texto
  // "<aerolínea> - <tarifa>" o el id. `null` si no se eligió ninguno,
  // `undefined` si se eligió uno que no existe.
  _planEquipajeId(valor, catalogos) {
    if (valor === undefined || valor === null || String(valor).trim() === '') return null;
    const texto = String(valor).trim();
    if (/^\d+$/.test(texto)) {
      const id = Number(texto);
      return catalogos.idsPoliticasEquipaje.has(id) ? id : undefined;
    }
    return catalogos.politicasEquipaje.get(texto.toLowerCase());
  }

  async createSale(body, alcance = {}) {
    const {
      clientId, asesorId, total, paymentMethod, payments = [],
      status = 'credito', isCredit = false, creditDueDate,
      observations, products = [], responsableId,
      commissionAgentId, commissionAgentAmount, commissionAgentRetentionPercentage, commissionAgentNetPayment,
      ta = 0, supplierCost = 0,
      ticketData = [],
    } = body;

    // Quien solo puede ver sus propias ventas tampoco puede crear una a nombre
    // de otro asesor: sería la forma de escribir en un sitio que no puede leer.
    // Se rechaza en vez de reasignarla en silencio, que es la clase de arreglo
    // callado que hace que nadie entienda por qué la venta salió con otro
    // nombre.
    const asesorPedido = asesorId === undefined || asesorId === null ? null : Number(asesorId);
    if (soloLasSuyas(alcance) && asesorPedido !== null && asesorPedido !== alcance.user.id) {
      throw new ForbiddenError('No puede crear una venta a nombre de otro asesor');
    }
    // Sin asesor explícito, `usuario_id` cae más abajo en `alcance.user.id`
    // (quien crea la venta). Suplantando, ese id es el del superadministrador,
    // que no pertenece a esta agencia — `ventas.usuario_id` es una clave ajena
    // compuesta (id, empresa_id) y, a diferencia de `clientes.creado_por_id`,
    // no admite nulo. Se rechaza aquí, con un mensaje que dice qué pasó, en
    // vez de dejar que la base lo haga con un 400 de clave ajena sin sentido.
    if (asesorPedido === null && alcance.suplantando) {
      throw new BadRequestError('Elige un asesor: quien suplanta no puede quedar como el asesor de la venta');
    }

    // Los cuatro ids del cuerpo, comprobados contra la empresa activa.
    await comprobarReferencias(REFERENCIAS_NUEVA_VENTA, {
      clientId, asesorId, responsableId, commissionAgentId,
    });

    // Resolve payment method principal id
    let metodo_pago_principal_id = null;
    if (paymentMethod) {
      const mp = await prisma.metodos_pago.findFirst({ where: { nombre: { equals: String(paymentMethod).trim(), mode: 'insensitive' } } });
      if (mp) metodo_pago_principal_id = mp.id;
    }

    // Cada producto recibe en `_generatedId` el id de su línea (`detalle_venta`)
    // al crearse, dentro de la transacción: los hijos de un plan lo usan para
    // colgarse de él, y la respuesta lo devuelve para subir los vouchers.

    // Los métodos de pago de los abonos, también de la agencia.
    //
    // Antes, un id que no existiera —el de otra empresa, o uno que ya se borró—
    // se guardaba como NULL sin decir nada, y el abono se quedaba sin método
    // para siempre. Un abono cobrado del que no consta cómo entró el dinero es
    // justo lo que no puede perderse en silencio.
    const metodosDeAbono = new Map();
    for (const p of payments) {
      if (p.method === undefined || p.method === null || p.method === '') continue;
      const id = Number(p.method);
      if (!Number.isInteger(id)) throw new BadRequestError(`Método de pago inválido en un abono: ${p.method}`);
      if (metodosDeAbono.has(id)) continue;
      const mp = await prisma.metodos_pago.findFirst({ where: { id }, select: { id: true } });
      if (!mp) throw new BadRequestError('El método de pago de un abono no existe');
      metodosDeAbono.set(id, mp.id);
    }

    // Los catálogos se resuelven fuera: dentro de la transacción solo escrituras.
    const catalogos = await this._precargarCatalogos(body);
    this._validarTiquetes(ticketData, catalogos);
    this._validarPersonas(body, catalogos);

    // La tarjeta con la que se le paga al proveedor de cada producto. Antes no
    // se leía: el asistente la pedía (en los paquetes, obligatoria) y se perdía.
    // Llega por id; por nombre en los borradores guardados antes de que el
    // formulario mandara el id. Una que no existe —o es de otra agencia, que
    // con la RLS es lo mismo— es un 400, no un null callado.
    const tarjetaDe = (item) => {
      const valor = item?.supplierPaymentMethod;
      if (valor === undefined || valor === null || valor === '') return null;
      const id = Number(valor);
      const tarjeta = Number.isInteger(id) && id > 0
        ? catalogos.tarjetas.find(t => t.id === id)
        : catalogos.tarjetas.find(t => t.nombre === String(valor))
          || catalogos.tarjetas.find(t => t.nombre.toLowerCase() === String(valor).toLowerCase());
      if (!tarjeta) throw new BadRequestError(`La tarjeta de pago al proveedor no existe: "${valor}"`);
      return tarjeta.id;
    };
    for (const slug of SLUGS) {
      for (const item of body[CATALOG[slug].responseKey] || []) tarjetaDe(item);
    }

    const created = await prisma.transaccion(async (tx) => {
      // 1. Create sale record
      //
      // El número que verá la agencia no se pide: lo pone un disparador de la
      // base (`app_asignar_numero`), igual que en las otras ocho tablas que
      // enseñan un número. Aquí vivía el cerrojo y el MAX+1, y era el único
      // sitio del sistema que los tenía; con ocho tablas más habría sido copiar
      // ese bloque ocho veces y confiar en que la novena se acordara.
      const venta = await tx.ventas.create({
        data: {
          cliente_id: Number(clientId),
          // Sin `asesorId` en el cuerpo, la venta queda a nombre de quien la crea.
          // `Number(asesorId)` a secas daba `NaN` (500 crudo de Prisma) en vez de
          // esto: el asistente real siempre lo manda, pero cualquier otro
          // llamador de la API no debería poder tumbar el alta por omitirlo.
          usuario_id: asesorPedido ?? alcance.user.id,
          monto_total: Number(total) || 0,
          costo_proveedor_total: Number(supplierCost) || 0,
          ta_total: Number(ta) || 0,
          iva_total: 0,
          comisionista_id: commissionAgentId ? Number(commissionAgentId) : null,
          // Con `aCentimos`, igual que `updateSale`: `Number(x) || 0` guardaba
          // decimales de coma flotante que luego no cuadran al sumar comisiones.
          monto_comision_bruto: aCentimos(commissionAgentAmount),
          porcentaje_retencion_comision: Number(commissionAgentRetentionPercentage) || 0,
          monto_comision_neto: aCentimos(commissionAgentNetPayment),
          comision_liquidada: false,
          metodo_pago_principal_id,
          status,
          es_credito: Boolean(isCredit),
          fecha_vence_credito: creditDueDate ? new Date(creditDueDate) : null,
          monto_pagado_credito: aCentimos(payments.reduce((s, p) => s + Number(p.amount || 0), 0)),
          observaciones: observations || null,
          responsable_id: responsableId ? Number(responsableId) : null,
        }
      });

      const ventaId = venta.id;

      // Los productos y sus personas, a razón de una inserción por tabla (ventaProductos.js).
      await escribirProductos(tx, {
        ventaId, body, catalogos, tarjetaDe,
        planEquipajeId: (v) => this._planEquipajeId(v, catalogos),
        tipoDocumento: (v) => this._tipoDocumento(v, catalogos),
      });

      // Los abonos, en un solo viaje. Un método que no consta se guarda como NULL (ya se comprobó que existe).
      if (payments.length) {
        await tx.pagos_venta.createMany({
          data: payments.map(p => ({
            id: uuidv4(), venta_id: ventaId,
            monto: aCentimos(p.amount),
            metodo_pago_id: metodosDeAbono.get(Number(p.method)) ?? null,
            referencia: p.reference || null,
          })),
        });
      }

      // Con los productos y los pagos ya escritos, la cabecera se deriva de
      // ellos. El `total` del cuerpo de la petición deja de decidir cuánto
      // debe el cliente: solo lo dice la suma de lo que se le vendió.
      const cabecera = await recalcularVenta(tx, ventaId);
      // El mismo tope que `registerPayment`, contra el total que acaba de
      // calcular la base. Lanzar aquí deshace la venta entera.
      if (cabecera.monto_pagado_credito > cabecera.monto_total) {
        throw new BadRequestError(
          `Los abonos (${cabecera.monto_pagado_credito}) superan el total de la venta (${cabecera.monto_total})`
        );
      }
      return cabecera;
    });

    // Return the new sale in the same format used by listSales
    return {
      id: created.id,
      // El número que la agencia acaba de estrenar. Faltaba, y el listado sí lo
      // devuelve: quien creaba la venta no podía enseñar con qué número quedó
      // hasta que se recargaba la lista.
      numero: created.numero,
      clientId: created.cliente_id,
      asesorId: created.usuario_id,
      date: created.creado_at,
      total: created.monto_total,
      status: created.status,
      observations: created.observaciones,
      isCredit: created.es_credito,
      payments: [],
      servicesSummary: [],
      // Las líneas creadas, en el orden de cada lista del cuerpo. El navegador
      // sube a cada una su voucher, que no viaja en este JSON:
      // PUT /sales/:id/products/:detalleId/voucher.
      products: SLUGS.flatMap(slug =>
        (Array.isArray(body[CATALOG[slug].responseKey]) ? body[CATALOG[slug].responseKey] : [])
          .map((item, index) => ({ category: slug, index, detalleId: item?._generatedId ?? null }))
      ),
    };
  }


  async _loadProducts(where) {
    const base = await prisma.detalle_venta.findMany({
      where,
      include: {
        pasajeros_detalle: { include: { personas: true } },
        proveedores: true,
        tarjetas_agencia: true,
      }
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
      iva: venta.iva_total,
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
    // Anular otra vez solo añadiría un segundo "[ANULADA]" a las observaciones.
    if (venta.status === 'anulado') throw new BadRequestError('La venta ya está anulada');

    // Los importes no se tocan: el estado basta. La comisión pendiente deja de
    // contar porque el acumulado y la liquidación excluyen las anuladas
    // (`commissions.service.js`), y una sola regla ahí no puede desincronizarse
    // de un borrado aquí. Los pagos se conservan: registran dinero que entró, y
    // devolverlo es otra operación. Una comisión ya liquidada tampoco se revierte:
    // se pagó, y la liquidación que la incluye tiene que seguir cuadrando.
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
      // Primero el cerrojo, después la lectura: si no, dos cobros a la vez leen
      // el mismo pendiente y los dos caben.
      await bloquearVenta(tx, id);
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
      if (!(pendiente > 0)) throw new BadRequestError('La venta ya está pagada');
      const monto = isTotal ? pendiente : aCentimos(amount);
      if (!(monto > 0)) {
        throw new BadRequestError('El monto del pago debe ser mayor que cero');
      }
      // El tope valía solo para `isTotal`: un pago manual mayor que la deuda se
      // aceptaba y dejaba lo pagado por encima del total.
      if (monto > pendiente) {
        throw new BadRequestError(`El pago (${monto}) supera el saldo pendiente de la venta (${pendiente})`);
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

    // La misma comprobación que en el alta, con el mismo helper: los ids que
    // llegan tienen que ser de la empresa activa.
    await comprobarReferencias(
      Object.fromEntries(Object.keys(body).map(clave => [clave, CAMPOS_EDITABLES[clave]])),
      Object.fromEntries(Object.keys(body).map(clave => [clave, data[CAMPOS_EDITABLES[clave].columna]])),
    );

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
    // `is_reviewed`, que es como se llama la columna. Con `isReviewed` esta
    // guarda nunca saltaba —leía siempre undefined— y el update de abajo
    // rechazaba la petición entera: marcar una venta como revisada daba 500 sin
    // excepción. `check:prisma` no lo vio porque su regex pide `nombre:` y esto
    // iba abreviado.
    if (sale.is_reviewed) throw new BadRequestError('Esta venta ya fue revisada y no se puede modificar su estado');

    const updatedSale = await prisma.ventas.update({
      where: { id: saleId },
      data: { is_reviewed: isReviewed }
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

// El listado y la cartera viven en sus propios archivos; el controlador los sigue viendo aquí.
module.exports = Object.assign(new SalesService(), { listSales, getCreditPortfolio, getClientCredits });
