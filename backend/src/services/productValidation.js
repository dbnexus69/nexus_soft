const prisma = require('../config/db');
const { AppError } = require('../errors/AppError');
const { normalizarDocumento, mensajeDocumento } = require('../utils/datosPersona');
const { CATALOG, SLUGS } = require('../catalog/products');

/**
 * La validación de los productos de un cuerpo de venta o de cotización (spec 007): los
 * catálogos que hacen falta para comprobarlos, y las dos reglas que antes vivían como
 * métodos privados de `SalesService` (`_precargarCatalogos`, `_validarTiquetes`,
 * `_validarPersonas`, `_planEquipajeId`, `_tipoDocumento`).
 *
 * Se sacó de ahí porque una cotización necesita exactamente la misma comprobación que
 * una venta (mismo aeropuerto, mismo plan de equipaje, mismo documento de cada
 * pasajero) antes de guardar — y la regla tiene que ser una sola, no una copia por
 * cada lado que termine divergiendo.
 */

const CAMPOS_DE_PRODUCTO = SLUGS.map(slug => CATALOG[slug].responseKey);

// Los catálogos que hacen falta para validar los productos del cuerpo, precargados
// fuera de la transacción: dentro de ella solo van escrituras.
async function precargarCatalogos(body) {
  const items = CAMPOS_DE_PRODUCTO.flatMap(c => Array.isArray(body[c]) ? body[c] : []);

  const codigosIata = new Set();
  const documentos = new Set();
  for (const it of items) {
    for (const leg of [...(it.legs || []), ...(it.outboundStops || []),
                       ...(it.returnLeg ? [it.returnLeg] : []), ...(it.returnStops || [])]) {
      if (leg?.origin) codigosIata.add(leg.origin);
      if (leg?.destination) codigosIata.add(leg.destination);
    }
    for (const p of [...(it.passengers || []), ...(it.guests || []),
                     ...(it.travelers || []), ...(it.members || [])]) {
      if (p?.docNumber) documentos.add(normalizarDocumento(p.docNumber));
    }
    if (it.docNumber) documentos.add(normalizarDocumento(it.docNumber));
  }
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
    politicasEquipaje: new Map(politicasEquipaje.map(p => [
      `${p.aerolineas.nombre} - ${p.tipo_tarifa}`.toLowerCase(), p.id,
    ])),
    idsPoliticasEquipaje: new Set(politicasEquipaje.map(p => p.id)),
    aeropuertos: new Map(aeropuertos.map(a => [a.codigo_iata, a.id])),
    personas: new Map(personas.map(p => [p.documento, p.id])),
    tiposDocumento: new Map(tiposDocumento.flatMap(t => [
      [t.abreviatura.toUpperCase(), t], [t.nombre.trim().toLowerCase(), t],
    ])),
  };
}

function tipoDocumento(valor, catalogos) {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  return catalogos.tiposDocumento.get(texto.toUpperCase()) || catalogos.tiposDocumento.get(texto.toLowerCase()) || undefined;
}

// El documento de cada persona (pasajeros, huéspedes, asegurados y el titular de los
// productos de un solo titular), con las mismas reglas que un cliente (spec 003, T4).
function validarPersonas(body, catalogos) {
  const detalles = [];
  const revisar = (ruta, p) => {
    if (!p || p.docNumber === undefined || p.docNumber === null || String(p.docNumber).trim() === '') return;
    const tipo = tipoDocumento(p.docType, catalogos);
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

// El id del plan de equipaje a partir de lo que manda el formulario: el texto
// "<aerolínea> - <tarifa>" o el id. `null` si no se eligió ninguno, `undefined` si se
// eligió uno que no existe.
function planEquipajeId(valor, catalogos) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;
  const texto = String(valor).trim();
  if (/^\d+$/.test(texto)) {
    const id = Number(texto);
    return catalogos.idsPoliticasEquipaje.has(id) ? id : undefined;
  }
  return catalogos.politicasEquipaje.get(texto.toLowerCase());
}

// Los aeropuertos y los planes de equipaje de los tiquetes, comprobados ANTES de
// guardar: un aeropuerto que no existe no se crea como "UNK", es un 422 con su campo.
//
// `exigirReserva`: la reserva del titular es obligatoria en una venta, pero una
// cotización no es una venta —todavía no hay reserva hecha— así que `quotes.service.js`
// llama esto con `false` y se salta solo esa regla; el resto (aeropuertos y plan de
// equipaje reales si se mandaron) sigue comprobándose igual en los dos casos.
function validarTiquetes(ticketData, catalogos, { exigirReserva = true } = {}) {
  const detalles = [];
  ticketData.forEach((t, i) => {
    const pasajeros = Array.isArray(t.passengers) ? t.passengers : [];
    const titular = pasajeros.find(p => p?.esTitular) || pasajeros[0];
    if (exigirReserva && titular && !String(titular.nroReserva || t.reservationNumber || '').trim()) {
      detalles.push({
        field: `ticketData.${i}.passengers.${pasajeros.indexOf(titular)}.nroReserva`,
        message: 'El número de reserva del titular es obligatorio',
      });
    }
    const nTramos = (t.legs || []).length + (t.outboundStops || []).length + (t.returnLeg ? 1 : 0) + (t.returnStops || []).length;
    pasajeros.forEach((p, j) => (Array.isArray(p?.asientos) ? p.asientos : []).forEach((a, k) => {
      if (Number(a?.tramo) > nTramos) {
        detalles.push({ field: `ticketData.${i}.passengers.${j}.asientos.${k}.tramo`, message: `El tiquete solo tiene ${nTramos} tramo(s)` });
      }
    }));
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
      if (planEquipajeId(leg.baggagePlan, catalogos) === undefined) {
        detalles.push({
          field: `ticketData.${i}.${ruta}.baggagePlan`,
          message: `El plan de equipaje "${leg.baggagePlan}" no existe en el catálogo`,
        });
      }
    }
    if (planEquipajeId(t.baggagePlan, catalogos) === undefined) {
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

module.exports = {
  CAMPOS_DE_PRODUCTO, precargarCatalogos, tipoDocumento, validarPersonas, planEquipajeId, validarTiquetes,
};
