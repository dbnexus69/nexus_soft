const PdfPrinter = require('pdfmake');
const vfsFuentes = require('pdfmake/build/vfs_fonts.js');
const { META } = require('../../catalog/products');
const { fecha, dinero, SECCIONES, titulo, tarjeta, rejilla, bloqueTiquete } = require('../voucher/secciones');

/**
 * El PDF de una cotización (spec 007): cotización + configuración de la agencia → definición de
 * `pdfmake` → Buffer. Mismo mecanismo que el voucher de una venta (spec 011), y a partir de T13
 * las mismas secciones por categoría (`../voucher/secciones.js`): cada línea de la cotización
 * guarda el mismo objeto por categoría que una venta (`TicketData`/`HotelData`...), así que se
 * describe con el mismo detalle completo — destino, fechas, aerolínea, hotel, tipo de trámite...—
 * nunca solo el resumen de una línea. Lo único que SIGUE sin mostrarse es lo que no se le enseña
 * al cliente en ningún documento: costo de proveedor, ganancia, método de pago al proveedor
 * (ninguna sección los incluye). La tabla de precios por servicio sí es propia de la cotización
 * (un voucher de venta no la tiene). Subir `PLANTILLA_VERSION` invalida la caché.
 */
const PLANTILLA_VERSION = 2;

const vfs = (vfsFuentes.pdfMake && vfsFuentes.pdfMake.vfs) || vfsFuentes.vfs || vfsFuentes;
const fuente = (archivo) => Buffer.from(vfs[archivo], 'base64');
const impresora = new PdfPrinter({
  Roboto: {
    normal: fuente('Roboto-Regular.ttf'), bold: fuente('Roboto-Medium.ttf'),
    italics: fuente('Roboto-Italic.ttf'), bolditalics: fuente('Roboto-MediumItalic.ttf'),
  },
});

const ESTADO_LABEL = { borrador: 'Borrador', enviada: 'Enviada', aceptada: 'Aceptada', rechazada: 'Rechazada', vencida: 'Vencida' };

const cabecera = (texto, c) => ({ text: texto, style: 'cabecera', fillColor: c.fondo });

/** Las líneas con detalle, agrupadas por categoría — el mismo array que usaría `ticketData`/`hotelData`... de una venta. */
function porCategoria(lineas) {
  const grupos = {};
  for (const l of lineas) {
    if (!l.detalle) continue; // Líneas de antes de T2 (sin `detalle`): solo queda la descripción corta.
    (grupos[l.categoria] ??= []).push(l.detalle);
  }
  return grupos;
}

/**
 * La definición del documento.
 * @param cotizacion  como la devuelve `quotes.service.js` (`mapCotizacion`): { numero, name,
 *                    clientName, estado, fechaVencimiento, observations, creadoAt, lines:
 *                    [{categoria, descripcion, detalle, precio}], totals: { total } }
 * @param config      { nombre, nit, direccion, telefono, emailContacto, sitioWeb, colores, pie }
 * @param extra       { logo: Buffer|null, aeropuertos: { BOG: 'Bogotá' }, hoy: Date }
 */
function definicion(cotizacion, config, { logo = null, aeropuertos = {}, hoy = new Date() } = {}) {
  const c = {
    primario: config.colores?.primario || '#1e293b',
    acento: config.colores?.acento || '#2563eb',
    realce: config.colores?.realce || '#f59e0b',
    tenue: '#64748b', borde: '#e2e8f0', fondo: '#f1f5f9',
  };
  const agencia = config.nombre || 'Agencia';
  const contacto = [config.nit && `NIT ${config.nit}`, config.direccion, config.telefono, config.emailContacto, config.sitioWeb]
    .filter(Boolean).join('  ·  ');

  // El detalle completo de cada servicio, una sección por categoría — igual que el voucher de
  // una venta. Los tiquetes van primero y aparte (itinerario con tramos), como allá.
  const grupos = porCategoria(cotizacion.lines);
  const cuerpo = [];
  if (grupos.ticket?.length) {
    cuerpo.push(titulo('ITINERARIO DE VUELO', c), ...grupos.ticket.map(t => bloqueTiquete(t, aeropuertos, c)));
  }
  for (const [clave, nombreSeccion, campos] of SECCIONES) {
    const slug = Object.keys(META).find(s => META[s].responseKey === clave);
    const items = (grupos[slug] || []).map(x => rejilla(campos(x), c)).filter(Boolean);
    if (items.length) cuerpo.push(titulo(nombreSeccion, c), ...items.map(i => tarjeta([i], c)));
  }

  // La tabla de precios por servicio: la ve el cliente en una cotización (no en un voucher de
  // venta), con el mismo resumen corto que la lista de la pantalla.
  const filas = cotizacion.lines.map(l => [
    META[l.categoria]?.label || l.categoria,
    l.descripcion,
    { text: dinero(l.precio), alignment: 'right' },
  ]);

  const infoCabecera = [
    { stack: [{ text: 'CLIENTE', style: 'etiqueta', color: c.tenue }, { text: cotizacion.clientName || '—', bold: true }] },
    { stack: [{ text: 'FECHA DE EMISIÓN', style: 'etiqueta', color: c.tenue }, { text: fecha(cotizacion.creadoAt) }] },
    { stack: [{ text: 'COTIZACIÓN', style: 'etiqueta', color: c.tenue },
      { text: [{ text: `#${cotizacion.numero ?? cotizacion.id}  `, bold: true, color: c.acento },
        { text: ESTADO_LABEL[cotizacion.estado] || cotizacion.estado, color: c.realce, bold: true, fontSize: 8 }] }] },
  ];
  if (cotizacion.fechaVencimiento) {
    infoCabecera.push({ stack: [{ text: 'VÁLIDA HASTA', style: 'etiqueta', color: c.tenue }, { text: fecha(cotizacion.fechaVencimiento) }] });
  }

  return {
    pageSize: 'LETTER',
    pageMargins: [36, 36, 36, 48],
    info: { title: `Cotización ${cotizacion.numero ?? cotizacion.id}${cotizacion.name ? ` - ${cotizacion.name}` : ''} - ${agencia}`, author: agencia },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#0f172a' },
    styles: {
      seccion: { fontSize: 10, bold: true, characterSpacing: 0.5 },
      etiqueta: { fontSize: 7, bold: true },
      valor: { fontSize: 9 },
      cabecera: { fontSize: 7, bold: true, color: '#334155' },
    },
    footer: (pagina, total) => ({
      columns: [
        { text: config.pie || `© ${hoy.getFullYear()} ${agencia}. Documento generado electrónicamente.`, fontSize: 7, color: c.tenue },
        { text: `${pagina} / ${total}`, alignment: 'right', fontSize: 7, color: c.tenue },
      ],
      margin: [36, 16, 36, 0],
    }),
    content: [
      {
        table: { widths: [logo ? 90 : 0, '*'], body: [[
          logo ? { image: logo, fit: [80, 50], margin: [6, 6, 0, 6] } : { text: '' },
          { stack: [
            { text: agencia.toUpperCase(), fontSize: 16, bold: true, color: '#ffffff' },
            { text: 'COTIZACIÓN', fontSize: 8, color: '#ffffff', characterSpacing: 1 },
            ...(cotizacion.name ? [{ text: cotizacion.name, fontSize: 11, bold: true, color: '#ffffff', margin: [0, 2, 0, 0] }] : []),
            ...(contacto ? [{ text: contacto, fontSize: 7, color: '#ffffff', margin: [0, 4, 0, 0] }] : []),
          ], margin: [8, 8, 8, 8] },
        ]] },
        layout: { fillColor: () => c.primario, hLineWidth: () => 0, vLineWidth: () => 0 },
      },
      { columns: infoCabecera, margin: [0, 10, 0, 10] },
      ...cuerpo,
      titulo('DETALLE Y PRECIOS', c),
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto'],
          body: [[cabecera('Servicio', c), cabecera('Descripción', c), { ...cabecera('Precio', c), alignment: 'right' }], ...filas],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 6],
      },
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            table: { body: [[{ text: 'TOTAL', bold: true }, { text: dinero(cotizacion.totals.total), bold: true, alignment: 'right' }]] },
            layout: 'noBorders',
          },
        ],
      },
      ...(cotizacion.observations ? [
        { text: 'OBSERVACIONES', style: 'etiqueta', color: c.tenue, margin: [0, 14, 0, 2] },
        { text: cotizacion.observations, fontSize: 8 },
      ] : []),
    ],
  };
}

/** El PDF como Buffer. */
function generar(cotizacion, config, extra) {
  return new Promise((resolver, rechazar) => {
    const doc = impresora.createPdfKitDocument(definicion(cotizacion, config, extra));
    const partes = [];
    doc.on('data', p => partes.push(p));
    doc.on('end', () => resolver(Buffer.concat(partes)));
    doc.on('error', rechazar);
    doc.end();
  });
}

module.exports = { PLANTILLA_VERSION, definicion, generar };
