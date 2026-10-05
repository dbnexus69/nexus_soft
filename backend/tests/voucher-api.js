/**
 * Perfil de la empresa y voucher por la API real (spec 011). `pnpm test:voucher`
 *
 * Dos agencias, un asesor y un superadministrador de prueba; el servidor de prueba sube a Storage bajo la
 * carpeta `prueba/`, que se borra al desmontar. Hoy cubre el perfil y el logo (T3, T4); el voucher se añade
 * con T7–T8.
 */
const {
  comprobar, pedir, entrar, CLAVE,
  levantarServidor, montarAgencia, montarSuperadmin, ejecutar,
} = require('./montaje');

const { isDeepStrictEqual } = require('util');

const PREFIJO = 'prueba-vou-';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const GIF = Buffer.from('R0lGODlhAQABAAAAACw=', 'base64');

const conArchivo = (buffer, tipo, nombre) => {
  const form = new FormData();
  form.append('logo', new Blob([buffer], { type: tipo }), nombre);
  return form;
};
const camposDe = (r) => (r.json?.error?.details || []).map(d => d.field).sort();

async function main() {
  console.log('  Montando dos agencias y arrancando el servidor…');
  const A = await montarAgencia(PREFIJO, 'a');
  const B = await montarAgencia(PREFIJO, 'b');
  const correoSuper = await montarSuperadmin(A);
  await levantarServidor();
  const tokA = await entrar(A.correo);
  const tokB = await entrar(B.correo);
  const correoAsesor = `${A.slug}-asesor@prueba.local`;
  await pedir('POST', '/users', tokA, { firstName: 'Asesor', lastName: 'Prueba', email: correoAsesor, password: CLAVE, role: 'asesor' });
  const tokAsesor = await entrar(correoAsesor);

  // ── 1. Leer y editar el perfil (T3)
  console.log('\n  Perfil');
  const inicial = await pedir('GET', '/company-profile', tokA);
  comprobar('el admin lee el perfil de su agencia', inicial.status === 200 && inicial.json?.data?.slug === A.slug, `HTTP ${inicial.status}`);
  comprobar('sin términos propios: voucherTerminos es null', inicial.json?.data?.voucherTerminos === null);
  comprobar('el asesor también lo lee', (await pedir('GET', '/company-profile', tokAsesor)).status === 200);
  comprobar('el asesor no lo edita: 403', (await pedir('PATCH', '/company-profile', tokAsesor, { direccion: 'x' })).status === 403);

  const datos = {
    nombreComercial: 'Viajes A', nit: '900123456-8', direccion: 'Calle 1 # 2-3', telefono: '+57 300 123 4567',
    emailContacto: 'hola@viajes-a.co', sitioWeb: 'https://viajes-a.co', colorPrimario: '#112233',
    voucherPie: 'Gracias por viajar con nosotros',
    voucherTerminos: [{ titulo: 'Equipaje', texto: 'Según la tarifa de cada aerolínea.' }],
  };
  const guardado = await pedir('PATCH', '/company-profile', tokA, datos);
  const leido = (await pedir('GET', '/company-profile', tokA)).json?.data || {};
  comprobar('el admin guarda y lee lo guardado', guardado.status === 200
    && Object.entries(datos).every(([k, v]) => isDeepStrictEqual(leido[k], v)),
    `HTTP ${guardado.status} ${Object.keys(datos).filter(k => !isDeepStrictEqual(leido[k], datos[k])).map(k => `${k}=${JSON.stringify(leido[k])}`).join(' ')}`);

  const malo = await pedir('PATCH', '/company-profile', tokA, {
    nit: '900123456-0', colorPrimario: 'rojo', sitioWeb: 'viajes.co',
    voucherTerminos: Array.from({ length: 16 }, (_, i) => ({ titulo: `C${i}`, texto: 'x' })),
  });
  comprobar('NIT con dígito erróneo, color, web sin http y 16 cláusulas: 422 con cada campo',
    malo.status === 422 && ['colorPrimario', 'nit', 'sitioWeb', 'voucherTerminos'].every(c => camposDe(malo).includes(c)),
    `HTTP ${malo.status} ${camposDe(malo).join(',')}`);
  comprobar('lo rechazado no se guardó', (await pedir('GET', '/company-profile', tokA)).json?.data?.nit === '900123456-8');

  await pedir('PATCH', '/company-profile', tokA, { direccion: '', voucherTerminos: null });
  const vaciado = (await pedir('GET', '/company-profile', tokA)).json?.data || {};
  comprobar('un texto vacío borra el dato y null vuelve a los términos por defecto',
    vaciado.direccion === null && vaciado.voucherTerminos === null && vaciado.nit === '900123456-8');
  comprobar('B no ve nada de A', (await pedir('GET', '/company-profile', tokB)).json?.data?.nit == null);

  // La base, no solo el código: con el rol de la app y la empresa A en contexto, cambiar una columna que no es
  // del perfil (el estado) lanza, y escribir en la fila de B no toca nada.
  const { PrismaClient } = require('@prisma/client');
  const app = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  const comoA = (sql) => app.$transaction([
    app.$executeRawUnsafe(`SELECT set_config('app.empresa_id', '${Number(A.id)}', true)`),
    app.$executeRawUnsafe(sql),
  ]).then(([, n]) => n);
  const suspender = await comoA(`UPDATE empresas SET estado = 'suspendida' WHERE id = ${Number(A.id)}`).catch(e => e);
  comprobar('la agencia no puede cambiar su estado ni en la base', suspender instanceof Error && /perfil y su marca/.test(suspender.message));
  comprobar('ni tocar la fila de otra agencia',
    (await comoA(`UPDATE empresas SET telefono = '1' WHERE id = ${Number(B.id)}`)) === 0);
  await app.$disconnect();

  // ── 2. Logo en el bucket (T4)
  console.log('\n  Logo');
  comprobar('el asesor no cambia el logo: 403',
    (await pedir('PUT', '/company-profile/logo', tokAsesor, undefined, { form: conArchivo(PNG, 'image/png', 'l.png') })).status === 403);
  const conLogo = await pedir('PUT', '/company-profile/logo', tokA, undefined, { form: conArchivo(PNG, 'image/png', 'logo.png') });
  const url = conLogo.json?.data?.logoUrl || '';
  comprobar('el admin sube un PNG y recibe una URL firmada de su carpeta',
    conLogo.status === 200 && url.includes(`/logos/prueba/${A.id}/logo-`) && url.includes("token="), `HTTP ${conLogo.status} ${JSON.stringify(conLogo.json?.error)}`);
  comprobar('la URL firmada descarga el logo', url && (await fetch(url)).status === 200);
  comprobar('sin firma no se descarga',
    url && (await fetch(url.replace('/object/sign/', '/object/public/').split('?')[0])).status !== 200);
  comprobar('/branding también trae el logo firmado',
    ((await pedir('GET', '/branding', tokA)).json?.data?.logoUrl || '').includes(`/prueba/${A.id}/`));
  const gif = await pedir('PUT', '/company-profile/logo', tokA, undefined, { form: conArchivo(GIF, 'image/gif', 'l.gif') });
  comprobar('un GIF: 422 en el campo logo', gif.status === 422 && camposDe(gif).includes('logo'), `HTTP ${gif.status}`);
  comprobar('B sigue sin logo', (await pedir('GET', '/company-profile', tokB)).json?.data?.logoUrl === null);

  // ── 3. El superadministrador
  console.log('\n  Superadministrador');
  const tokSuper = await entrar(correoSuper);
  const sup = await pedir('POST', `/companies/${B.id}/impersonations`, tokSuper, { motivo: 'Prueba automática del perfil' });
  const tokSup = sup.json?.data?.token;
  const editaB = await pedir('PATCH', '/company-profile', tokSup, { nombreComercial: 'Editado por soporte' });
  comprobar('suplantando B, edita el perfil de B',
    editaB.status === 200 && (await pedir('GET', '/company-profile', tokB)).json?.data?.nombreComercial === 'Editado por soporte',
    `HTTP ${editaB.status}`);
  comprobar("y A no cambió", (await pedir("GET", "/company-profile", tokA)).json?.data?.nombreComercial === "Viajes A");
  const logoB = await pedir('PUT', `/companies/${B.id}/logo`, tokSuper, undefined, { form: conArchivo(PNG, 'image/png', 'b.png') });
  comprobar('el logo que sube desde /companies queda en la carpeta de B',
    logoB.status === 200 && (logoB.json?.data?.logoUrl || '').includes(`/prueba/${B.id}/logo-`), `HTTP ${logoB.status}`);

  // ── 4. El voucher (T7, T8)
  console.log('\n  Voucher');
  const cliente = (await pedir('POST', '/clients', tokA, { firstName: 'Cliente', lastName: 'Voucher', docType: 'CC', docNumber: '940000001' })).json?.data;
  const venta = (await pedir('POST', '/sales', tokA, {
    clientId: cliente.id, total: 1, status: 'credito', creditDueDate: '2027-12-31T00:00:00.000Z',
    restaurantData: [{ reservationName: 'Prueba', peopleCount: 2, supplierCost: 1000, ta: 500 }],
  })).json?.data;
  const pdfDe = async (url) => { const r = await fetch(url); return { status: r.status, cuerpo: Buffer.from(await r.arrayBuffer()) }; };

  const v1 = await pedir('GET', `/sales/${venta.id}/voucher`, tokA);
  const url1 = v1.json?.data?.url || '';
  const pdf1 = url1 ? await pdfDe(url1) : {};
  comprobar('descargar: URL firmada de la carpeta de la agencia, que baja un PDF',
    v1.status === 200 && url1.includes(`/vouchers/prueba/${A.id}/${venta.id}/`) && pdf1.status === 200
      && pdf1.cuerpo.subarray(0, 5).toString() === '%PDF-', `HTTP ${v1.status}`);
  const url2 = (await pedir('GET', `/sales/${venta.id}/voucher`, tokA)).json?.data?.url || '';
  const ruta = (u) => u.split('?')[0];
  comprobar('sin cambios, el mismo objeto (caché)', url2 && ruta(url2) === ruta(url1));
  await pedir('POST', `/sales/${venta.id}/payments`, tokA, { amount: 0.5, method: '' });
  const url3 = (await pedir('GET', `/sales/${venta.id}/voucher`, tokA)).json?.data?.url || '';
  comprobar('tras un abono, otro objeto', url3 && ruta(url3) !== ruta(url1));
  comprobar('B no obtiene el voucher de A: 404', (await pedir('GET', `/sales/${venta.id}/voucher`, tokB)).status === 404);

  const sinCorreo = await pedir('POST', `/sales/${venta.id}/send-voucher`, tokA);
  comprobar('enviar sin correo del cliente: 400 y no consta el envío', sinCorreo.status === 400
    && (await pedir('GET', `/sales/${venta.id}`, tokA)).json?.data?.lastVoucherSent === null, `HTTP ${sinCorreo.status}`);
  await pedir('PUT', `/clients/${cliente.id}`, tokA, { email: 'cliente-voucher@prueba.local' });
  const enviado = await pedir('POST', `/sales/${venta.id}/send-voucher`, tokA);
  const detalle = (await pedir('GET', `/sales/${venta.id}`, tokA)).json?.data;
  comprobar('enviar con correo: 200 y el detalle muestra el envío',
    enviado.status === 200 && detalle?.lastVoucherSent?.to === 'cliente-voucher@prueba.local', `HTTP ${enviado.status}`);
  comprobar('B no envía el voucher de A: 404', (await pedir('POST', `/sales/${venta.id}/send-voucher`, tokB)).status === 404);

  await pedir('POST', `/sales/${venta.id}/cancellation`, tokA, { reason: 'Prueba del voucher anulado' });
  const anulada = await pedir('GET', `/sales/${venta.id}/voucher`, tokA);
  comprobar('una venta anulada se descarga…', anulada.status === 200 && ruta(anulada.json?.data?.url || '') !== ruta(url3));
  comprobar('…pero no se envía: 400', (await pedir('POST', `/sales/${venta.id}/send-voucher`, tokA)).status === 400);

  // ── 5. Vista previa (no se guarda)
  const r = await fetch(`${require('./montaje').API}/company-profile/voucher-preview`, {
    method: 'POST', headers: { Authorization: `Bearer ${tokA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ colorPrimario: '#aa0000', voucherTerminos: [{ titulo: 'Borrador', texto: 'Sin guardar' }] }),
  });
  const previa = Buffer.from(await r.arrayBuffer());
  comprobar('vista previa: un PDF con el borrador', r.status === 200 && r.headers.get('content-type')?.includes('application/pdf')
    && previa.subarray(0, 5).toString() === '%PDF-', `HTTP ${r.status}`);
  comprobar('y el borrador no se guardó', (await pedir('GET', '/company-profile', tokA)).json?.data?.colorPrimario === '#112233');
  comprobar('el asesor no pide vista previa: 403', (await pedir('POST', '/company-profile/voucher-preview', tokAsesor, {})).status === 403);
}

ejecutar('Perfil de la empresa y voucher por la API', PREFIJO, main);
