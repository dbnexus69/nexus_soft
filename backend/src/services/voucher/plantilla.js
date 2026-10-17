const PdfPrinter = require('pdfmake');
const vfsFuentes = require('pdfmake/build/vfs_fonts.js');
const TERMINOS_POR_DEFECTO = require('./terminosPorDefecto');
const { fecha, dinero, SECCIONES, titulo, tarjeta, rejilla, bloqueTiquete, bloquesDeHijos } = require('./secciones');

/**
 * El voucher en PDF (spec 011): venta + configuración de la agencia → definición de `pdfmake` → Buffer.
 *
 * Reproduce lo que mostraba `VoucherPDF.tsx` en el navegador, con la marca de la agencia (logo, colores, datos de
 * contacto, términos y pie). Cada categoría de producto es una entrada de `SECCIONES` (`./secciones.js`, compartida
 * con el PDF de la cotización): título y pares etiqueta/valor; un valor vacío no se pinta. Subir
 * `PLANTILLA_VERSION` cuando cambie el diseño invalida la caché.
 */
const PLANTILLA_VERSION = 5;

const vfs = (vfsFuentes.pdfMake && vfsFuentes.pdfMake.vfs) || vfsFuentes.vfs || vfsFuentes;
const fuente = (archivo) => Buffer.from(vfs[archivo], 'base64');
const impresora = new PdfPrinter({
  Roboto: {
    normal: fuente('Roboto-Regular.ttf'), bold: fuente('Roboto-Medium.ttf'),
    italics: fuente('Roboto-Italic.ttf'), bolditalics: fuente('Roboto-MediumItalic.ttf'),
  },
});

/**
 * La definición del documento.
 * @param venta   la venta como la devuelve `getSaleById` + `getSaleProducts`
 * @param config  { nombre, nit, direccion, telefono, emailContacto, sitioWeb, colores: { primario, acento, realce }, pie, terminos }
 * @param extra   { logo: Buffer|null, aeropuertos: { BOG: 'Bogotá' } , hoy: Date }
 */
function definicion(venta, config, { logo = null, aeropuertos = {}, hoy = new Date() } = {}) {
  const c = {
    primario: config.colores?.primario || '#1e293b',
    acento: config.colores?.acento || '#2563eb',
    realce: config.colores?.realce || '#f59e0b',
    tenue: '#64748b', borde: '#e2e8f0', fondo: '#f1f5f9',
  };
  const agencia = config.nombre || 'Agencia';
  const contacto = [config.nit && `NIT ${config.nit}`, config.direccion, config.telefono, config.emailContacto, config.sitioWeb]
    .filter(Boolean).join('  ·  ');
  const pagado = (venta.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const terminos = (Array.isArray(config.terminos) ? config.terminos : TERMINOS_POR_DEFECTO)
    .map(t => ({ titulo: t.titulo, texto: String(t.texto).replaceAll('{agencia}', agencia) }));

  const cuerpo = [];
  if (venta.ticketData?.length) {
    cuerpo.push(titulo('ITINERARIO DE VUELO', c), ...venta.ticketData.map(t => bloqueTiquete(t, aeropuertos, c)));
  }
  for (const [clave, nombre, campos] of SECCIONES) {
    const items = (venta[clave] || []).map(x => rejilla(campos(x), c)).filter(Boolean);
    if (items.length) cuerpo.push(titulo(nombre, c), ...items.map(i => tarjeta([i], c)));
    // Los servicios que cuelgan de un paquete no están en su sección: salen debajo de él.
    if (clave === 'planData') {
      for (const plan of venta.planData || []) cuerpo.push(...bloquesDeHijos(plan, aeropuertos, c));
    }
  }

  return {
    pageSize: 'LETTER',
    pageMargins: [36, 36, 36, 48],
    info: { title: `Voucher ${venta.numero ?? venta.id} - ${agencia}`, author: agencia },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#0f172a' },
    styles: {
      seccion: { fontSize: 10, bold: true, characterSpacing: 0.5 },
      etiqueta: { fontSize: 7, bold: true },
      valor: { fontSize: 9 },
      cabecera: { fontSize: 7, bold: true, color: '#334155' },
    },
    ...(venta.status === 'anulado' ? { watermark: { text: 'ANULADA', color: '#dc2626', opacity: 0.15, bold: true } } : {}),
    footer: (pagina, total) => ({
      columns: [
        { text: config.pie || `© ${hoy.getFullYear()} ${agencia}. Documento generado electrónicamente.`, fontSize: 7, color: c.tenue },
        { text: `${pagina} / ${total}`, alignment: 'right', fontSize: 7, color: c.tenue },
      ],
      margin: [36, 16, 36, 0],
    }),
    content: [
      // Cabecera con el color principal de la agencia.
      {
        table: { widths: [logo ? 90 : 0, '*'], body: [[
          logo ? { image: logo, fit: [80, 50], margin: [6, 6, 0, 6] } : { text: '' },
          { stack: [
            { text: agencia.toUpperCase(), fontSize: 16, bold: true, color: '#ffffff' },
            { text: 'CONFIRMACIÓN DE SERVICIOS', fontSize: 8, color: '#ffffff', characterSpacing: 1 },
            ...(contacto ? [{ text: contacto, fontSize: 7, color: '#ffffff', margin: [0, 4, 0, 0] }] : []),
          ], margin: [8, 8, 8, 8] },
        ]] },
        layout: { fillColor: () => c.primario, hLineWidth: () => 0, vLineWidth: () => 0 },
      },
      {
        columns: [
          { stack: [{ text: 'PASAJERO PRINCIPAL', style: 'etiqueta', color: c.tenue }, { text: venta.clientName || '—', bold: true }] },
          { stack: [{ text: 'FECHA DE EMISIÓN', style: 'etiqueta', color: c.tenue }, { text: fecha(hoy) }] },
          { stack: [{ text: 'ORDEN', style: 'etiqueta', color: c.tenue },
            { text: [{ text: `#${venta.numero ?? venta.id}  `, bold: true, color: c.acento },
              { text: String(venta.status || '').toUpperCase(), color: c.realce, bold: true, fontSize: 8 }] }] },
        ],
        margin: [0, 10, 0, 4],
      },
      ...cuerpo,
      titulo('RESUMEN DE PAGO', c),
      tarjeta([rejilla([
        ['Método de pago', venta.paymentMethod || ((venta.payments || []).length > 1 ? 'Mixto' : venta.payments?.[0]?.method)],
        ['Emisor', agencia],
        ['Valor total', dinero(venta.total)],
        // El valor del IVA no se enseña al cliente: solo que está incluido.
        ['IVA', 'Incluido'],
        ['Abonado', dinero(pagado)],
        ['Saldo', dinero(Math.max(0, (Number(venta.total) || 0) - pagado))],
      ], c)], c),
      titulo('CONDICIONES DEL SERVICIO', c),
      // El título de cada cláusula va encima de su texto, no en la misma línea.
      ...terminos.map(t => ({
        stack: [
          ...(t.titulo ? [{ text: t.titulo, bold: true, fontSize: 8.5, margin: [0, 0, 0, 1] }] : []),
          { text: t.texto, fontSize: 8, lineHeight: 1.25 },
        ],
        margin: [0, 0, 0, 6],
        unbreakable: true,
      })),
    ],
  };
}

/** El PDF como Buffer. */
function generar(venta, config, extra) {
  return new Promise((resolver, rechazar) => {
    const doc = impresora.createPdfKitDocument(definicion(venta, config, extra));
    const partes = [];
    doc.on('data', p => partes.push(p));
    doc.on('end', () => resolver(Buffer.concat(partes)));
    doc.on('error', rechazar);
    doc.end();
  });
}

module.exports = { PLANTILLA_VERSION, definicion, generar, SECCIONES };
