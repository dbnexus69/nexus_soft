/**
 * Imágenes en los servicios de una cotización, por la API real (spec 021). `pnpm test:cotizacion-imagenes`
 *
 * Dos agencias y un asesor de prueba; el servidor de prueba sube al bucket `cotizacion-imagenes` bajo la
 * carpeta `prueba/`, que se borra al desmontar (igual que `test:voucher`).
 */
const {
  comprobar, pedir, entrar,
  levantarServidor, montarAgencia, ejecutar,
} = require('./montaje');

const PREFIJO = 'prueba-coti-img-';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const GIF = Buffer.from('R0lGODlhAQABAAAAACw=', 'base64');

const conArchivo = (buffer, tipo, nombre) => {
  const form = new FormData();
  form.append('image', new Blob([buffer], { type: tipo }), nombre);
  return form;
};

const cotizacionMinima = () => ({
  hotelData: [{ hotelName: 'Hotel Test', destination: 'San Andrés', supplierCost: 0, ta: 100000 }],
});

async function main() {
  console.log('  Montando dos agencias y arrancando el servidor…');
  const A = await montarAgencia(PREFIJO, 'a');
  const B = await montarAgencia(PREFIJO, 'b');
  await levantarServidor();
  const tokA = await entrar(A.correo);
  const tokB = await entrar(B.correo);

  const creada = await pedir('POST', '/quotes', tokA, cotizacionMinima());
  comprobar('se crea la cotización con una línea de hotel', creada.status === 201 && creada.json?.data?.lines?.length === 1, `HTTP ${creada.status}`);
  const cotizacionId = creada.json.data.id;
  const lineId = creada.json.data.lines[0].id;

  // ── 1. Subir
  console.log('\n  Subir imágenes');
  const subida1 = await pedir('POST', `/quotes/${cotizacionId}/lines/${lineId}/images`, tokA, undefined, { form: conArchivo(PNG, 'image/png', 'foto1.png') });
  comprobar('sube la primera imagen: 201 y queda 1 en la línea',
    subida1.status === 201 && subida1.json?.data?.lines?.[0]?.detalle?.images?.length === 1, `HTTP ${subida1.status}`);
  comprobar('la imagen viene como URL firmada, no la ruta cruda',
    /^https?:\/\//.test(subida1.json?.data?.lines?.[0]?.detalle?.images?.[0] || ''));

  const tipoInvalido = await pedir('POST', `/quotes/${cotizacionId}/lines/${lineId}/images`, tokA, undefined, { form: conArchivo(GIF, 'image/gif', 'foto.gif') });
  comprobar('un GIF se rechaza: 422', tipoInvalido.status === 422, `HTTP ${tipoInvalido.status}`);

  for (let i = 0; i < 4; i++) {
    await pedir('POST', `/quotes/${cotizacionId}/lines/${lineId}/images`, tokA, undefined, { form: conArchivo(PNG, 'image/png', `foto${i + 2}.png`) });
  }
  const conCinco = await pedir('GET', `/quotes/${cotizacionId}`, tokA);
  comprobar('llegó a 5 imágenes', conCinco.json?.data?.lines?.[0]?.detalle?.images?.length === 5,
    String(conCinco.json?.data?.lines?.[0]?.detalle?.images?.length));

  const sexta = await pedir('POST', `/quotes/${cotizacionId}/lines/${lineId}/images`, tokA, undefined, { form: conArchivo(PNG, 'image/png', 'foto6.png') });
  comprobar('una sexta imagen se rechaza: 400', sexta.status === 400, `HTTP ${sexta.status}`);

  // ── 2. Ajena y cerrada
  console.log('\n  Alcance y estado');
  const deB = await pedir('POST', `/quotes/${cotizacionId}/lines/${lineId}/images`, tokB, undefined, { form: conArchivo(PNG, 'image/png', 'x.png') });
  comprobar('B no sube a una cotización de A: 404', deB.status === 404, `HTTP ${deB.status}`);

  const lineaAjena = await pedir('POST', '/quotes', tokB, cotizacionMinima());
  const subeEnLineaAjena = await pedir(
    'POST', `/quotes/${cotizacionId}/lines/${lineaAjena.json.data.lines[0].id}/images`, tokA, undefined,
    { form: conArchivo(PNG, 'image/png', 'x.png') },
  );
  comprobar('una línea que no es de esta cotización: 404', subeEnLineaAjena.status === 404, `HTTP ${subeEnLineaAjena.status}`);

  await pedir('PUT', `/quotes/${cotizacionId}`, tokA, cotizacionMinima());
  await pedir('POST', `/quotes/${cotizacionId}/send`, tokA);
  await pedir('POST', `/quotes/${cotizacionId}/respond`, tokA, { accepted: true });
  const enCerrada = await pedir('POST', `/quotes/${cotizacionId}/lines/${lineId}/images`, tokA, undefined, { form: conArchivo(PNG, 'image/png', 'x.png') });
  comprobar('una cotización aceptada no admite imágenes nuevas: 400', enCerrada.status === 400, `HTTP ${enCerrada.status}`);

  // ── 3. Borrar (en una cotización nueva, todavía en borrador)
  console.log('\n  Borrar');
  const otra = await pedir('POST', '/quotes', tokA, cotizacionMinima());
  const otraLineId = otra.json.data.lines[0].id;
  await pedir('POST', `/quotes/${otra.json.data.id}/lines/${otraLineId}/images`, tokA, undefined, { form: conArchivo(PNG, 'image/png', 'a.png') });
  await pedir('POST', `/quotes/${otra.json.data.id}/lines/${otraLineId}/images`, tokA, undefined, { form: conArchivo(PNG, 'image/png', 'b.png') });
  const borrada = await pedir('DELETE', `/quotes/${otra.json.data.id}/lines/${otraLineId}/images/0`, tokA);
  comprobar('borra la primera: queda 1', borrada.status === 200 && borrada.json?.data?.lines?.[0]?.detalle?.images?.length === 1, `HTTP ${borrada.status}`);

  const indiceInvalido = await pedir('DELETE', `/quotes/${otra.json.data.id}/lines/${otraLineId}/images/9`, tokA);
  comprobar('un índice que no existe: 400', indiceInvalido.status === 400, `HTTP ${indiceInvalido.status}`);

  // ── 3b. Guardar la cotización entera con las fotos que devolvió el GET (URLs firmadas) — spec 023 T5
  console.log('\n  Guardar con fotos');
  const leida = await pedir('GET', `/quotes/${otra.json.data.id}`, tokA);
  const detalleLeido = leida.json?.data?.lines?.[0]?.detalle || {};
  const guardada = await pedir('PUT', `/quotes/${otra.json.data.id}`, tokA, {
    hotelData: [{ ...detalleLeido, images: [...(detalleLeido.images || []), 'otra-cotizacion/inventada.png'] }],
  });
  const fotosTrasGuardar = guardada.json?.data?.lines?.[0]?.detalle?.images || [];
  comprobar('guardar con fotos conserva la suya y descarta la inventada: 1',
    guardada.status === 200 && fotosTrasGuardar.length === 1 && /^https?:\/\//.test(fotosTrasGuardar[0]),
    `HTTP ${guardada.status}, ${fotosTrasGuardar.length} fotos`);

  // ── 4. El PDF no falla con imágenes incluidas (y tras guardar, descarga la foto por su ruta)
  console.log('\n  PDF');
  const pdf = await pedir('GET', `/quotes/${otra.json.data.id}/pdf`, tokA);
  comprobar('el PDF se genera sin fallar con una imagen en la línea', pdf.status === 200 && typeof pdf.json?.data?.url === 'string', `HTTP ${pdf.status}`);

  // ── 5. Duplicar copia los archivos; guardar sin una foto la borra del bucket (spec 023)
  console.log('\n  Duplicar y limpiar');
  const { storage } = require('../src/utils/almacenamiento');
  const archivosDe = async (carpeta) => {
    const { data } = await storage().from('cotizacion-imagenes').list(carpeta, { limit: 1000 });
    const rutas = [];
    for (const o of data || []) {
      if (o.id) rutas.push(`${carpeta}/${o.name}`); else rutas.push(...await archivosDe(`${carpeta}/${o.name}`));
    }
    return rutas;
  };
  const carpetaDe = (quoteId) => `prueba/${A.id}/${quoteId}`;
  const otraId = otra.json.data.id;

  const dup = await pedir('POST', `/quotes/${otraId}/duplicate`, tokA);
  const dupId = dup.json?.data?.id;
  const dupLinea = dup.json?.data?.lines?.[0];
  comprobar('duplicar trae la foto: 1', [200, 201].includes(dup.status) && dupLinea?.detalle?.images?.length === 1,
    `HTTP ${dup.status}, ${dupLinea?.detalle?.images?.length} fotos`);
  const archivosCopia = (await archivosDe(carpetaDe(dupId))).length;
  comprobar('la copia tiene su propio archivo en el bucket', archivosCopia === 1, `${archivosCopia} archivos`);

  const borradaEnCopia = await pedir('DELETE', `/quotes/${dupId}/lines/${dupLinea?.id}/images/0`, tokA);
  const original = await pedir('GET', `/quotes/${otraId}`, tokA);
  comprobar('borrar la foto en la copia no rompe el original',
    borradaEnCopia.status === 200 && original.status === 200 && original.json?.data?.lines?.[0]?.detalle?.images?.length === 1,
    `DELETE ${borradaEnCopia.status}, GET original ${original.status}`);

  const sinFotos = await pedir('PUT', `/quotes/${otraId}`, tokA, {
    hotelData: [{ ...original.json.data.lines[0].detalle, images: [] }],
  });
  const quedan = (await archivosDe(carpetaDe(otraId))).length;
  comprobar('guardar sin la foto la borra del bucket', sinFotos.status === 200 && quedan === 0,
    `HTTP ${sinFotos.status}, ${quedan} archivos`);
}

ejecutar('Imágenes en los servicios de una cotización', PREFIJO, main);
