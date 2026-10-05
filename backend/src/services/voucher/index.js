const crypto = require('crypto');
const prisma = require('../../config/db');
const { empresaActual } = require('../../config/tenant');
const { AppError, BadRequestError, NotFoundError } = require('../../errors/AppError');
const almacenamiento = require('../../utils/almacenamiento');
const emailService = require('../../utils/emailService');
const { PLANTILLA_VERSION, generar } = require('./plantilla');
const VENTA_DE_EJEMPLO = require('./ventaDeEjemplo');

/**
 * Generar, guardar y entregar el voucher de una venta (spec 011).
 *
 * Caché por contenido: la huella resume todo lo que entra en el PDF (venta, configuración de la agencia, logo,
 * versión de la plantilla). Si ya hay un PDF con esa huella en `vouchers/<empresa>/<venta>/`, se reutiliza; si
 * algo cambió (un abono, otro logo, otros términos), se genera otro. Los envíos quedan en `vouchers_venta`, y
 * solo si el correo salió.
 */

const DESCARGA_SEGUNDOS = 300;

async function empresaYConfig(borrador = {}) {
  const e = await prisma.empresas.findFirst({ where: { id: empresaActual(), deleted_at: null } });
  if (!e) throw new NotFoundError('Empresa no encontrada');
  const valor = (campo, columna) => (campo in borrador ? borrador[campo] : e[columna]);
  const terminos = 'voucherTerminos' in borrador ? borrador.voucherTerminos : e.voucher_terminos;
  return {
    config: {
      nombre: valor('nombreComercial', 'nombre_comercial') || e.nombre,
      nit: valor('nit', 'nit'),
      direccion: valor('direccion', 'direccion'),
      telefono: valor('telefono', 'telefono'),
      emailContacto: valor('emailContacto', 'email_contacto'),
      sitioWeb: valor('sitioWeb', 'sitio_web'),
      colores: {
        primario: valor('colorPrimario', 'color_primario'),
        acento: valor('colorAcento', 'color_acento'),
        realce: valor('colorRealce', 'color_realce'),
      },
      pie: valor('voucherPie', 'voucher_pie'),
      terminos: Array.isArray(terminos) ? terminos : null,
    },
    // Un `logo_url` de antes del bucket (`/uploads/…`) no se usa: se vuelve a subir.
    logo: e.logo_url && !e.logo_url.startsWith('/') ? e.logo_url : null,
  };
}

/** Los nombres de ciudad de los aeropuertos de los tiquetes, por código IATA. */
async function ciudades(venta) {
  const codigos = new Set();
  for (const t of venta.ticketData || []) {
    for (const l of [...(t.legs || []), ...(t.outboundStops || []), ...(t.returnLeg ? [t.returnLeg] : []), ...(t.returnStops || [])]) {
      if (l?.origin) codigos.add(l.origin);
      if (l?.destination) codigos.add(l.destination);
    }
  }
  if (!codigos.size) return {};
  const filas = await prisma.aeropuertos.findMany({
    where: { codigo_iata: { in: [...codigos] } }, select: { codigo_iata: true, ciudad: true },
  });
  return Object.fromEntries(filas.filter(f => f.ciudad).map(f => [f.codigo_iata, f.ciudad]));
}

async function ventaCompleta(ventaId, alcance) {
  // Lo mismo que lee el detalle de la venta: el PDF muestra lo que muestra la pantalla.
  const sales = require('../sales.service');
  const [cabecera, productos] = await Promise.all([sales.getSaleById(ventaId, alcance), sales.getSaleProducts(ventaId, alcance)]);
  return { ...cabecera, ...productos };
}

async function generarCon(venta, { config, logo }) {
  const [buffer, aeropuertos] = await Promise.all([
    logo ? almacenamiento.leer('logos', logo) : null,
    ciudades(venta),
  ]);
  return generar(venta, config, { logo: buffer, aeropuertos });
}

/** El voucher guardado de la venta (generándolo si hace falta): `{ nombre, huella, venta, buffer? }`. */
async function obtenerVoucher(ventaId, alcance) {
  const venta = await ventaCompleta(ventaId, alcance);
  const agencia = await empresaYConfig();
  // Fuera de la huella lo que no sale en el PDF y cambia solo (la revisión interna, la comisión).
  const { isReviewed, lastVoucherSent, commissionAgentAmount, commissionAgentNetPayment, isSettled, ...visible } = venta;
  const huella = crypto.createHash('sha256')
    .update(JSON.stringify({ v: PLANTILLA_VERSION, venta: visible, ...agencia }))
    .digest('hex');
  const nombre = `${venta.id}/${huella}.pdf`;

  if (await almacenamiento.existe('vouchers', nombre)) return { nombre, huella, venta };
  const buffer = await generarCon(venta, agencia);
  await almacenamiento.subir('vouchers', nombre, buffer, 'application/pdf');
  return { nombre, huella, venta, buffer };
}

async function urlDeDescarga(ventaId, alcance) {
  const { nombre, venta } = await obtenerVoucher(ventaId, alcance);
  const url = await almacenamiento.firmar('vouchers', nombre, DESCARGA_SEGUNDOS, {
    descarga: `Voucher-${venta.numero ?? venta.id}.pdf`,
  });
  return { url, expiraEn: DESCARGA_SEGUNDOS };
}

async function enviarVoucher(ventaId, alcance) {
  const { nombre, huella, venta, buffer } = await obtenerVoucher(ventaId, alcance);
  if (venta.status === 'anulado') throw new BadRequestError('Una venta anulada no se envía al cliente');
  if (!venta.clientEmail) throw new BadRequestError('El cliente no tiene correo registrado: regístralo para enviarle el voucher');

  const pdf = buffer || await almacenamiento.leer('vouchers', nombre);
  const { nombre: agencia } = await emailService.marcaDeCorreo();
  const numero = venta.numero ?? venta.id;
  const res = await emailService.sendEmail({
    to: venta.clientEmail,
    subject: `${agencia} · Voucher de tu reserva #${numero}`,
    html: `<p>Hola <strong>${venta.clientName}</strong>,</p><p>Adjunto encontrarás el voucher de tu reserva.</p><p>${agencia}</p>`,
    attachments: [{ filename: `Voucher-${numero}.pdf`, content: pdf }],
  });
  if (!res.success) throw new AppError('No se pudo enviar el correo al cliente: vuelve a intentarlo', 502, 'EMAIL_SEND_FAILED');

  // Lo que no salió no consta como enviado. Suplantando, el id del superadministrador es de otra agencia
  // (spec 002, T19): el envío queda sin autor en vez de romper la clave compuesta.
  const fila = await prisma.vouchers_venta.create({
    data: {
      venta_id: venta.id, huella, ruta: nombre, enviado_a: venta.clientEmail,
      enviado_por_id: alcance.suplantando ? null : (alcance.user?.id ?? null),
    },
  });
  return { enviadoA: fila.enviado_a, enviadoAt: fila.enviado_at };
}

/** El PDF de la venta de ejemplo con la configuración guardada más el borrador sin guardar. No se guarda nada. */
async function vistaPrevia(borrador) {
  return generarCon(VENTA_DE_EJEMPLO, await empresaYConfig(borrador));
}

module.exports = { obtenerVoucher, urlDeDescarga, enviarVoucher, vistaPrevia };
