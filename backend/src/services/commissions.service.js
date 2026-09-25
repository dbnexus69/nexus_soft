const prisma = require('../config/db');
const { NotFoundError, BadRequestError, ConflictError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');
const { formatName } = require('../utils/stringUtils');
const { aCentimos } = require('./saleTotals');
const { enHoraColombia, fechaEnColombia } = require('../utils/fechas');

/**
 * Qué ventas deben comisión todavía. Una sola definición: la usan el acumulado
 * que ve la pantalla y la liquidación que lo paga, y si no coincidieran se
 * pagaría una cifra distinta de la mostrada.
 *
 * Las anuladas y las borradas no cuentan: antes el acumulado solo miraba
 * `comision_liquidada`, así que anular una venta dejaba su comisión viva y
 * lista para pagarse. Espera el alias `v` para `ventas`.
 */
const VENTA_CON_COMISION_PENDIENTE = `
  v.comision_liquidada = false
  AND v.deleted_at IS NULL
  AND v.status <> 'anulado'
`;

// Los importes de los mensajes, como los pinta la pantalla: pesos sin
// decimales salvo que los haya. Si no, un 409 por céntimos diría "ahora es
// $170, no $170".
const pesos = (valor) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(valor);

/** "la venta N.º 7", "las ventas N.º 7 y 9", "las ventas N.º 7, 9 y 12". */
function nombrarVentas(numeros) {
  const lista = numeros.length === 1
    ? String(numeros[0])
    : `${numeros.slice(0, -1).join(', ')} y ${numeros[numeros.length - 1]}`;
  return `${numeros.length === 1 ? 'la venta' : 'las ventas'} N.º ${lista}`;
}

const splitFullName = (fullName) => {
  const parts = fullName ? fullName.trim().split(/\s+/) : [];
  let firstName = fullName || '';
  let lastName = '';
  if (parts.length > 1) {
    if (parts.length === 2) {
      firstName = parts[0];
      lastName = parts[1];
    } else if (parts.length === 3) {
      firstName = parts.slice(0, 2).join(' ');
      lastName = parts[2];
    } else {
      firstName = parts.slice(0, 2).join(' ');
      lastName = parts.slice(2).join(' ');
    }
  }
  return { firstName, lastName };
};

class CommissionsService {
  async listAgents({ pagination, search, status }) {
    const { page, perPage, skip } = pagination;
    // El filtro se escribe UNA vez, con parámetros posicionales. Antes cada
    // condición se duplicaba: el texto del SQL para las filas y un objeto
    // `where` de Prisma para el count. Esta consulta no puede dejar de ser
    // cruda (`acumulado` es un SUM correlacionado), así que el count también es
    // crudo y comparte el mismo `whereSql` y los mismos parámetros.
    const filtros = [];
    const params = [];
    const push = (sql, ...valores) => {
      filtros.push(sql.replace(/\?/g, () => `$${params.push(valores.shift())}`));
    };
    if (status) push('c.status = ?::"AgentStatus"', status);
    if (search) {
      const q = `%${search}%`;
      push('(p.nombres ILIKE ? OR p.apellidos ILIKE ?)', q, q);
    }
    const whereSql = filtros.length ? 'AND ' + filtros.join(' AND ') : '';

    const [totalRows, agentsRaw] = await prisma.transaccion(async (tx) => {
      return Promise.all([
        tx.$queryRawUnsafe(`
          SELECT COUNT(*)::int AS total
          FROM comisionistas c
          JOIN personas p ON c.persona_id = p.id
          WHERE c.deleted_at IS NULL ${whereSql}
        `, ...params),
        tx.$queryRawUnsafe(`
          SELECT 
            c.id,
            c.numero,
            c.tipo as "type",
            c.status,
            -- El acumulado se suma aquí, no en el cliente: c.acumulado es un campo
            -- denormalizado que se desincroniza, y sumarlo en el frontend obligaba
            -- a traerse todas las ventas para calcularlo.
            COALESCE((
              SELECT SUM(v.monto_comision_neto)
              FROM ventas v
              WHERE v.comisionista_id = c.id AND ${VENTA_CON_COMISION_PENDIENTE}
            ), 0) as "accumulated",
            c.umbral_pago as "paymentThreshold",
            c.banco,
            c.tipo_cuenta as "tipoCuenta",
            c.numero_cuenta as "numeroCuenta",
            p.nombres as "firstName",
            p.apellidos as "lastName",
            p.telefono as "phone",
            p.email,
            p.documento as "docNumber",
            p.avatar_url as "avatar",
            td.abreviatura as "docType"
          FROM comisionistas c
          JOIN personas p ON c.persona_id = p.id
          LEFT JOIN tipos_documento td ON p.tipo_documento_id = td.id
          WHERE c.deleted_at IS NULL ${whereSql}
          ORDER BY c.id DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, ...params, perPage, skip)
      ]);
    });

    const data = agentsRaw.map(a => ({
      id: a.id,
      name: `${a.firstName} ${a.lastName}`.trim(),
      type: a.type,
      docType: a.docType || '',
      docNumber: a.docNumber || '',
      status: a.status,
      accumulated: a.accumulated,
      paymentThreshold: a.paymentThreshold,
      phone: a.phone,
      email: a.email,
      avatar: a.avatar || null,
      banco: a.banco || null,
      tipoCuenta: a.tipoCuenta || null,
      numeroCuenta: a.numeroCuenta || null
    }));

    return {
      data,
      meta: buildMeta(Number(totalRows[0]?.total || 0), page, perPage)
    };
  }

  async createAgent(data) {
    let tipo_documento_id = null;
    if (data.docType) {
      const dt = await prisma.tipos_documento.findUnique({ where: { abreviatura: data.docType } });
      if (dt) tipo_documento_id = dt.id;
    }

    if (data.docNumber) {
      const existingAgent = await prisma.comisionistas.findFirst({
        where: { deleted_at: null, personas: { documento: data.docNumber } },
        include: { personas: true }
      });
      if (existingAgent && !existingAgent.personas.deleted_at) {
        throw new BadRequestError('Este número de documento ya está registrado como comisionista activo');
      }
    }

    let persona;
    if (data.docNumber) {
      const existingPersona = await prisma.personas.findFirst({
        where: { documento: data.docNumber }
      });
      if (existingPersona) {
        const { firstName, lastName } = splitFullName(data.name || `${existingPersona.nombres} ${existingPersona.apellidos}`);
        persona = await prisma.personas.update({
          where: { id: existingPersona.id },
          data: {
            nombres: formatName(firstName) || existingPersona.nombres,
            apellidos: formatName(lastName) || existingPersona.apellidos,
            tipo_documento_id: tipo_documento_id || existingPersona.tipo_documento_id,
            email: data.email || existingPersona.email,
            telefono: data.phone || existingPersona.telefono,
            avatar_url: data.avatar || existingPersona.avatar_url,
            status: 'active',
            deleted_at: null
          }
        });
      }
    }

    if (!persona) {
      const { firstName, lastName } = splitFullName(data.name);
      persona = await prisma.personas.create({
        data: {
          nombres: formatName(firstName),
          apellidos: formatName(lastName),
          tipo_documento_id: tipo_documento_id,
          documento: data.docNumber || null,
          email: data.email || null,
          telefono: data.phone || null,
          avatar_url: data.avatar || null
        }
      });
    }

    const agent = await prisma.comisionistas.create({
      data: {
        persona_id: persona.id,
        tipo: data.type || null,
        umbral_pago: parseFloat(data.paymentThreshold) || 0,
        acumulado: 0,
        status: data.status || 'Activo',
        banco: data.banco || null,
        tipo_cuenta: data.tipoCuenta || null,
        numero_cuenta: data.numeroCuenta || null
      },
      include: { personas: { include: { tipos_documento: true } } }
    });

    return {
      id: agent.id,
      name: `${agent.personas.nombres} ${agent.personas.apellidos}`.trim(),
      type: agent.tipo,
      docType: agent.personas.tipos_documento?.abreviatura || '',
      docNumber: agent.personas.documento || '',
      status: agent.status,
      accumulated: agent.acumulado,
      paymentThreshold: agent.umbral_pago,
      phone: agent.personas.telefono,
      email: agent.personas.email,
      avatar: agent.personas.avatar_url || null,
      banco: agent.banco || null,
      tipoCuenta: agent.tipo_cuenta || null,
      numeroCuenta: agent.numero_cuenta || null
    };
  }

  async updateAgent(id, data) {
    const agent = await prisma.comisionistas.findFirst({
      where: { id, deleted_at: null },
      include: { personas: { include: { tipos_documento: true } } }
    });
    if (!agent) {
      throw new NotFoundError('Comisionista no encontrado');
    }

    const personaUpdate = {};
    if (data.name) {
      const { firstName, lastName } = splitFullName(data.name);
      personaUpdate.nombres = formatName(firstName);
      personaUpdate.apellidos = formatName(lastName);
    }

    if (data.docNumber !== undefined) {
      if (data.docNumber) {
        const existingDoc = await prisma.personas.findFirst({
          where: { documento: data.docNumber }
        });
        if (existingDoc && existingDoc.id !== agent.persona_id) {
          throw new BadRequestError('Este número de documento ya está asignado a otra persona en el sistema');
        }
      }
      personaUpdate.documento = data.docNumber || null;
    }

    if (data.phone !== undefined) personaUpdate.telefono = data.phone;
    if (data.email !== undefined) personaUpdate.email = data.email;
    if (data.avatar !== undefined) personaUpdate.avatar_url = data.avatar;

    if (data.docType) {
      const dt = await prisma.tipos_documento.findUnique({ where: { abreviatura: data.docType } });
      if (dt) personaUpdate.tipo_documento_id = dt.id;
    }

    if (Object.keys(personaUpdate).length > 0) {
      personaUpdate.updated_at = new Date();
      await prisma.personas.update({
        where: { id: agent.persona_id },
        data: personaUpdate
      });
    }

    const agentUpdate = {};
    if (data.type !== undefined) agentUpdate.tipo = data.type;
    if (data.status !== undefined) agentUpdate.status = data.status;
    if (data.paymentThreshold !== undefined) {
      agentUpdate.umbral_pago = parseFloat(data.paymentThreshold) || 0;
    }
    if (data.banco !== undefined) agentUpdate.banco = data.banco || null;
    if (data.tipoCuenta !== undefined) agentUpdate.tipo_cuenta = data.tipoCuenta || null;
    if (data.numeroCuenta !== undefined) agentUpdate.numero_cuenta = data.numeroCuenta || null;

    if (Object.keys(agentUpdate).length > 0) {
      await prisma.comisionistas.update({ where: { id }, data: agentUpdate });
    }

    return { message: 'Comisionista actualizado' };
  }

  async deleteAgent(id) {
    const agent = await prisma.comisionistas.findFirst({ where: { id, deleted_at: null } });
    if (!agent) {
      throw new NotFoundError('Comisionista no encontrado');
    }
    // Baja, no borrado. Borrar la fila reutilizaba su número, y además dejaba
    // sin dueño las comisiones ya liquidadas que la nombran.
    await prisma.comisionistas.update({
      where: { id },
      data: { deleted_at: new Date(), status: 'Inactivo' },
    });
    return { message: 'Comisionista eliminado' };
  }

  async listSettlements({ pagination, agentId, dateFrom, dateTo }) {
    const { page, perPage, skip } = pagination;
    // Un solo filtro, con parámetros posicionales.
    //
    // Antes los valores se metían en el texto del SQL: el id con `parseInt` y
    // las fechas con `toISOString()`. No había hueco de inyección, pero era
    // seguro por accidente de la coerción, no por construcción — y una fecha
    // inválida hacía que `toISOString()` lanzara un RangeError en vez de un 422.
    // Y el filtro estaba duplicado con el `where` de Prisma del count.
    const filtros = [];
    const params = [];
    const push = (sql, ...valores) => {
      filtros.push(sql.replace(/\?/g, () => `$${params.push(valores.shift())}`));
    };
    if (agentId) push('lc.comisionista_id = ?', parseInt(agentId));
    // Días de Colombia, como se guardan: desde la medianoche de `dateFrom` hasta
    // antes de la medianoche siguiente a `dateTo`, para que el último día entre.
    if (dateFrom) push('lc.fecha >= ?', enHoraColombia(dateFrom));
    if (dateTo) push('lc.fecha < ?', new Date(enHoraColombia(dateTo).getTime() + 24 * 3600 * 1000));
    const whereLiq = filtros.length ? 'AND ' + filtros.join(' AND ') : '';

    const [totalLiqRows, settlementsRaw] = await prisma.transaccion(async (tx) => {
      return Promise.all([
        tx.$queryRawUnsafe(`
          SELECT COUNT(*)::int AS total
          FROM liquidaciones_comision lc
          WHERE 1=1 ${whereLiq}
        `, ...params),
        tx.$queryRawUnsafe(`
          SELECT 
            lc.id,
            lc.comisionista_id as "agentId",
            lc.monto as "amount",
            lc.fecha as "date",
            lc.referencia as "reference",
            lc.notas as "notes",
            p.nombres as "firstName",
            p.apellidos as "lastName",
            mp.nombre as "paymentMethod",
            COALESCE((
              SELECT json_agg(lv.venta_id)
              FROM liquidacion_ventas lv WHERE lv.liquidacion_id = lc.id
            ), '[]'::json) as "salesIds"
          FROM liquidaciones_comision lc
          JOIN comisionistas c ON lc.comisionista_id = c.id
          JOIN personas p ON c.persona_id = p.id
          LEFT JOIN metodos_pago mp ON lc.metodo_pago_id = mp.id
          WHERE 1=1 ${whereLiq}
          ORDER BY lc.creado_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, ...params, perPage, skip)
      ]);
    });

    const data = settlementsRaw.map(s => {
      const dateStr = fechaEnColombia(s.date);

      return {
        id: s.id,
        agentId: s.agentId,
        agentName: `${s.firstName} ${s.lastName}`.trim(),
        amount: s.amount,
        date: dateStr,
        paymentMethod: s.paymentMethod || null,
        reference: s.reference,
        notes: s.notes,
        salesIds: s.salesIds || []
      };
    });

    return {
      data,
      meta: buildMeta(Number(totalLiqRows[0]?.total || 0), page, perPage)
    };
  }

  /**
   * Liquida las comisiones pendientes de un comisionista.
   *
   * Qué se paga y cuánto lo decide el servidor, no el cuerpo de la petición.
   * Antes se guardaba el `amount` que llegara y solo se marcaban las ventas de
   * `salesIds`, que la pantalla nunca mandaba: la liquidación quedaba sin
   * ventas, ninguna pasaba a liquidada y el mismo acumulado se podía volver a
   * pagar. Y una venta anulada se podía liquidar.
   *
   * - Sin `salesIds`, se liquida todo lo pendiente (lo que muestra la pantalla).
   *   Con `salesIds`, solo esas, y todas tienen que estar pendientes.
   * - Las ventas se bloquean (`FOR UPDATE`) antes de sumar: dos liquidaciones a
   *   la vez no pagan dos veces lo mismo. La segunda espera, vuelve a evaluar
   *   el filtro y ya no las encuentra pendientes.
   * - `amount`, si llega, es lo que el operador vio. Si no coincide con lo que
   *   la base suma ahora (entró o se anuló una venta mientras tanto), 409: mejor
   *   que pagar una cifra distinta de la que aprobó.
   */
  async createSettlement(data) {
    return await prisma.transaccion(async (tx) => {
      const comisionista = await tx.comisionistas.findFirst({
        where: { id: data.agentId, deleted_at: null },
        select: { id: true, personas: { select: { nombres: true, apellidos: true } } },
      });
      if (!comisionista) throw new NotFoundError('Este comisionista ya no existe o fue eliminado.');
      const nombre = `${comisionista.personas.nombres} ${comisionista.personas.apellidos}`.trim();

      let metodo_pago_id = null;
      if (data.paymentMethod !== undefined && data.paymentMethod !== null && data.paymentMethod !== '') {
        const id = Number(data.paymentMethod);
        const mp = Number.isInteger(id)
          ? await tx.metodos_pago.findFirst({ where: { id }, select: { id: true } })
          : null;
        if (!mp) {
          throw new BadRequestError(
            'El canal de pago elegido ya no existe. Elige otro para registrar la liquidación.',
            'PAYMENT_METHOD_NOT_FOUND',
            [{ field: 'paymentMethod', message: 'Este canal de pago ya no existe' }],
          );
        }
        metodo_pago_id = mp.id;
      }

      const pendientes = await tx.$queryRawUnsafe(`
        SELECT v.id, v.monto_comision_neto AS neto
        FROM ventas v
        WHERE v.comisionista_id = $1 AND ${VENTA_CON_COMISION_PENDIENTE}
        ORDER BY v.id
        FOR UPDATE
      `, comisionista.id);

      let ventas = pendientes;
      if (data.salesIds && data.salesIds.length > 0) {
        const porId = new Map(pendientes.map(v => [v.id, v]));
        const ajenas = data.salesIds.filter(id => !porId.has(id));
        if (ajenas.length) {
          // El mensaje nombra el número que ve la agencia, nunca el id interno.
          // Las que no se encuentran son de otra agencia o no existen: para
          // quien liquida es lo mismo, y no se distingue.
          const vistas = await tx.ventas.findMany({
            where: { id: { in: ajenas } }, select: { numero: true }, orderBy: { numero: 'asc' },
          });
          const numeros = vistas.map(v => v.numero);
          const partes = [];
          if (numeros.length) {
            partes.push(`${nombrarVentas(numeros)} ya no ${numeros.length === 1 ? 'tiene' : 'tienen'} comisión pendiente para ${nombre}: ${numeros.length === 1 ? 'está liquidada, anulada o es' : 'están liquidadas, anuladas o son'} de otro comisionista.`);
          }
          if (numeros.length < ajenas.length) {
            const faltan = ajenas.length - numeros.length;
            partes.push(faltan === 1 ? 'Una de las ventas elegidas no existe.' : `${faltan} de las ventas elegidas no existen.`);
          }
          partes.push(`${ajenas.length === 1 ? 'Quítala' : 'Quítalas'} de la liquidación y vuelve a confirmar.`);
          const mensaje = partes.join(' ');
          throw new BadRequestError(mensaje[0].toUpperCase() + mensaje.slice(1), 'SALES_NOT_SETTLEABLE', [
            { field: 'salesIds', message: 'Hay ventas sin comisión pendiente', value: numeros },
          ]);
        }
        ventas = [...new Set(data.salesIds)].map(id => porId.get(id));
      }
      if (!ventas.length) {
        throw new BadRequestError(
          `${nombre} no tiene comisiones pendientes. Si esperabas alguna, revisa que su venta no esté anulada ni liquidada.`,
          'NO_PENDING_COMMISSIONS',
          [{ field: 'amount', message: 'No hay nada pendiente', value: 0 }],
        );
      }

      const monto = aCentimos(ventas.reduce((s, v) => s + Number(v.neto || 0), 0));
      if (data.amount !== undefined && data.amount !== null && aCentimos(data.amount) !== monto) {
        throw new ConflictError(
          `El acumulado de ${nombre} cambió mientras preparabas la liquidación: ahora es ${pesos(monto)}, ` +
          `no ${pesos(aCentimos(data.amount))}. Revisa la nueva cifra y confirma otra vez.`,
          'SETTLEMENT_AMOUNT_CHANGED',
          [{ field: 'amount', message: `El acumulado actual es ${pesos(monto)}`, value: monto }],
        );
      }

      const ventasIds = ventas.map(v => v.id);
      const settlement = await tx.liquidaciones_comision.create({
        data: {
          comisionista_id: comisionista.id,
          // El día que eligió el operador, como día de Colombia. `new Date('2026-09-25')`
          // es medianoche UTC, que en Bogotá todavía es el 24.
          fecha: (data.date && enHoraColombia(data.date)) || new Date(),
          monto,
          metodo_pago_id,
          referencia: data.reference || null,
          notas: data.notes || null
        }
      });

      await tx.liquidacion_ventas.createMany({
        data: ventasIds.map(venta_id => ({ liquidacion_id: settlement.id, venta_id })),
      });
      await tx.ventas.updateMany({
        where: { id: { in: ventasIds } },
        data: { comision_liquidada: true },
      });

      const fullSettlement = await tx.liquidaciones_comision.findUnique({
        where: { id: settlement.id },
        include: {
          comisionistas: { include: { personas: true } },
          metodos_pago: true,
        }
      });

      const dateStr = fechaEnColombia(fullSettlement.fecha);

      return {
        id: fullSettlement.id,
        agentId: fullSettlement.comisionista_id,
        agentName: `${fullSettlement.comisionistas.personas.nombres} ${fullSettlement.comisionistas.personas.apellidos}`.trim(),
        amount: fullSettlement.monto,
        date: dateStr,
        paymentMethod: fullSettlement.metodos_pago?.nombre || null,
        reference: fullSettlement.referencia,
        notes: fullSettlement.notas,
        salesIds: ventasIds,
      };
    });
  }
}

module.exports = new CommissionsService();
