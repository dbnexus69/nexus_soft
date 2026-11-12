#!/usr/bin/env node
/**
 * Plantilla del voucher e imágenes que llegan al PDF, sin base ni servidor. `pnpm test:voucher-plantilla`
 *
 * El motor del PDF solo entiende PNG y JPG, y un PNG con los datos dañados no da un error que se pueda
 * capturar: revienta en un callback de zlib y se lleva el proceso. Por eso cada caso dañado se comprueba
 * con `imagenUtilizable`, sin entregárselo al motor antes. Las posiciones se leen del propio PDF.
 */
const zlib = require('zlib');
const PdfPrinter = require('pdfmake');
const vfsFuentes = require('pdfmake/build/vfs_fonts.js');
const { definicion, generar, imagenUtilizable, soloUtilizable } = require('../src/services/voucher/plantilla');

let fallos = 0;
function comprobar(descripcion, condicion, detalle = '') {
  if (!condicion) fallos++;
  console.log(`  ${condicion ? '✓' : '✗'} ${descripcion}${detalle ? `  → ${detalle}` : ''}`);
}

function chunk(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(cuerpo) >>> 0);
  return Buffer.concat([largo, cuerpo, crc]);
}
const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function ihdr(ancho, alto, tipoColor, entrelazado = 0) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(ancho, 0);
  b.writeUInt32BE(alto, 4);
  b[8] = 8;
  b[9] = tipoColor;
  b[12] = entrelazado;
  return chunk('IHDR', b);
}
const armar = (cabecera, idat) => Buffer.concat([FIRMA, cabecera, chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
const CANALES = { 2: 3, 6: 4 };
function png(ancho, alto, tipoColor = 2) {
  return armar(ihdr(ancho, alto, tipoColor), zlib.deflateSync(Buffer.alloc((ancho * CANALES[tipoColor] + 1) * alto, 0)));
}
const JPG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////'
  + 'wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z', 'base64');
const WEBP = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');

const venta = { id: 1, numero: 1, clientName: 'Cliente', status: 'credito', total: 1000, payments: [], restaurantData: [{ reservationName: 'X', peopleCount: 2 }] };
const config = (pie) => ({ nombre: 'Agencia', colores: {}, pie, terminos: [{ titulo: 'T', texto: 'x' }] });
const ALTO_PAGINA = 792;

const vfs = (vfsFuentes.pdfMake && vfsFuentes.pdfMake.vfs) || vfsFuentes.vfs || vfsFuentes;
const fuente = (a) => Buffer.from(vfs[a], 'base64');
const impresora = new PdfPrinter({ Roboto: { normal: fuente('Roboto-Regular.ttf'), bold: fuente('Roboto-Medium.ttf'), italics: fuente('Roboto-Italic.ttf'), bolditalics: fuente('Roboto-MediumItalic.ttf') } });

/** Las imágenes del PDF: `arriba`/`abajo` medidos desde el borde superior de la página. */
function imagenesDe(def) {
  return new Promise((resolver, rechazar) => {
    const doc = impresora.createPdfKitDocument({ ...def, compress: false });
    const partes = [];
    doc.on('data', p => partes.push(p));
    doc.on('error', rechazar);
    doc.on('end', () => {
      const texto = Buffer.concat(partes).toString('latin1');
      resolver([...texto.matchAll(/([\d.\-]+) 0 0 (-?[\d.]+) ([\d.\-]+) ([\d.\-]+) cm\s*\n?\/(I\d+|EX\d+) Do/g)].map(m => ({
        ancho: +m[1], alto: Math.abs(+m[2]), x: +m[3], abajo: +m[4],
      })));
    });
    doc.end();
  });
}
const cerca = (a, b) => Math.abs(a - b) < 0.5;

async function main() {
  console.log('\nPlantilla del voucher\n');

  console.log('  Qué imágenes acepta');
  comprobar('PNG sin transparencia', imagenUtilizable(png(10, 10)));
  comprobar('PNG con transparencia', imagenUtilizable(png(10, 10, 6)));
  comprobar('JPG', imagenUtilizable(JPG));
  comprobar('WebP válido: no', !imagenUtilizable(WEBP));
  comprobar('texto cualquiera: no', !imagenUtilizable(Buffer.from('no soy una imagen')));
  comprobar('vacío o sin buffer: no', !imagenUtilizable(Buffer.alloc(0)) && !imagenUtilizable(null));
  comprobar('solo la firma de PNG: no', !imagenUtilizable(Buffer.concat([FIRMA, Buffer.from('contenido falso')])));
  comprobar('PNG con el deflate roto: no', !imagenUtilizable(armar(ihdr(50, 50, 6), Buffer.from('basura que no es deflate'))));
  comprobar('PNG con un filtro imposible: no', !imagenUtilizable(armar(ihdr(50, 50, 6), zlib.deflateSync(Buffer.alloc((50 * 4 + 1) * 50, 0x99)))));
  comprobar('PNG con menos datos que su cabecera: no', !imagenUtilizable(armar(ihdr(50, 50, 6), zlib.deflateSync(Buffer.alloc(10)))));
  comprobar('PNG que declara dimensiones enormes: no', !imagenUtilizable(armar(ihdr(30000, 30000, 6), zlib.deflateSync(Buffer.alloc(10)))));
  comprobar('PNG entrelazado: no', !imagenUtilizable(armar(ihdr(10, 10, 6, 1), zlib.deflateSync(Buffer.alloc(410)))));
  comprobar('PNG válido y un chunk cortado al final: no', !imagenUtilizable(png(10, 10).subarray(0, 30)));

  console.log('\n  Al generar, lo guardado que no sirve se omite');
  comprobar('una buena pasa', Buffer.isBuffer(soloUtilizable(png(10, 10), 'prueba')));
  const aviso = console.warn;
  let avisos = 0;
  console.warn = () => { avisos++; };
  comprobar('una WebP se omite', soloUtilizable(WEBP, 'prueba') === null);
  console.warn = aviso;
  comprobar('…y queda el aviso', avisos === 1, String(avisos));
  comprobar('sin imagen no avisa', soloUtilizable(null, 'prueba') === null && avisos === 1);

  console.log('\n  Posición en la página');
  const panoramica = png(1018, 230);
  const altoReal = 612 * 230 / 1018;
  const [enc] = await imagenesDe(definicion(venta, config(), { encabezadoImagen: panoramica }));
  comprobar('el encabezado toca arriba y ocupa todo el ancho', enc && cerca(enc.abajo - enc.alto, 0) && cerca(enc.ancho, 612) && cerca(enc.x, 0), JSON.stringify(enc));

  const [pie] = await imagenesDe(definicion(venta, config('Corto'), { pieImagen: panoramica }));
  comprobar('el pie queda a ras del borde inferior', pie && cerca(pie.abajo, ALTO_PAGINA) && cerca(pie.ancho, 612) && cerca(pie.alto, altoReal), JSON.stringify(pie));

  const textoLargo = 'Texto legal de la agencia con contacto y condiciones. '.repeat(6).slice(0, 300);
  const conLargo = await imagenesDe(definicion(venta, config(textoLargo), { pieImagen: panoramica }));
  comprobar('con 300 caracteres de pie la imagen sigue y a ras', conLargo.length === 1 && cerca(conLargo[0].abajo, ALTO_PAGINA), JSON.stringify(conLargo));

  const [vertical] = await imagenesDe(definicion(venta, config(), { encabezadoImagen: png(300, 900) }));
  comprobar('una vertical se limita a 220 de alto y va centrada',
    vertical && cerca(vertical.alto, 220) && cerca(vertical.x, (612 - vertical.ancho) / 2), JSON.stringify(vertical));

  const [muyAncha] = await imagenesDe(definicion(venta, config(), { pieImagen: png(2000, 20) }));
  comprobar('una muy panorámica ocupa el ancho y sigue a ras', muyAncha && cerca(muyAncha.ancho, 612) && cerca(muyAncha.abajo, ALTO_PAGINA), JSON.stringify(muyAncha));

  console.log('\n  Sin imágenes, como siempre');
  const sin = definicion(venta, config('Pie'), {});
  comprobar('los márgenes de siempre', JSON.stringify(sin.pageMargins) === '[36,36,36,48]', JSON.stringify(sin.pageMargins));
  comprobar('no hay encabezado de página', sin.header === undefined);
  comprobar('la banda de color sigue en el cuerpo', Boolean(sin.content[0]?.table));
  comprobar('genera el PDF', (await generar(venta, config('Pie'), {})).length > 1000);
  comprobar('con imágenes también', (await generar(venta, config('Pie'), { encabezadoImagen: panoramica, pieImagen: png(1018, 230, 6) })).length > 1000);

  // El cliente ve que el IVA está incluido, nunca el monto; sin IVA en ninguna línea (spec 041) la fila no sale.
  console.log('\n  IVA en el resumen de pago');
  const textoDe = (v) => JSON.stringify(definicion(v, config(), {}).content);
  const conIva = textoDe({ ...venta, iva: 190 });
  comprobar('con IVA dice «Incluido»', conIva.includes('"IVA"') && conIva.includes('Incluido'));
  comprobar('con IVA no enseña el monto', !conIva.includes('190'));
  const sinIva = textoDe({ ...venta, iva: 0 });
  comprobar('sin IVA no hay fila de IVA', !sinIva.includes('"IVA"') && !sinIva.includes('Incluido'));

  console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)\n` : '\nTodo en orden\n');
  process.exit(fallos ? 1 : 0);
}

main().catch((err) => { console.error('\n  ✗ la prueba se cortó:', err.message || err); process.exit(1); });
