#!/usr/bin/env node
/**
 * El aislamiento visto desde fuera, por la API de verdad. `pnpm test:aislamiento-api`
 *
 * `aislamiento.js` comprueba la base (RLS, claves compuestas, disparadores).
 * Esta comprueba lo que ve y puede hacer quien llama a la API: que un id de
 * otra agencia responde "no existe", que un fichero ajeno no se lee, que un
 * asesor no pasa de su rol, que liquidar una comisión ajena no se puede y que
 * la suplantación del superadministrador ve la agencia que visita y nada más
 * (spec 001, A3 y A9; spec 002, T11), y que usuarios, comisionistas y responsables
 * validan sus datos de persona y el tipo de documento por id (spec 003, T4).
 *
 * Levanta su propio servidor en otro puerto (`TEST_PORT`, 3917 por defecto) con
 * el rol de la aplicación, monta dos agencias con el servicio real de altas, y
 * al terminar lo desmonta todo —agencias, usuarios, ficheros subidos— pase lo
 * que pase. Solo toca agencias cuyo slug empieza por `prueba-api-`.
 *
 * Necesita `DATABASE_URL` (rol `app_nexus`) y `DIRECT_URL` (para montar el
 * superadministrador de prueba y desmontar). Tarda ~1-2 min: cada petición
 * viaja al pooler. Sin marco de pruebas, igual que `aislamiento.js`.
 */
const {
  admin, BASE, CLAVE, comprobar, pedir, entrar, una,
  levantarServidor, montarAgencia, montarSuperadmin, ventaMinima, ejecutar,
} = require('./montaje');

const PREFIJO = 'prueba-api-';

// ── La prueba ──────────────────────────────────────────────────────────────

async function main() {
  console.log('  Montando dos agencias y arrancando el servidor…');
  const A = await montarAgencia(PREFIJO, 'a');
  const B = await montarAgencia(PREFIJO, 'b');
  const correoSuper = await montarSuperadmin(A);
  await levantarServidor();

  const tokA = await entrar(A.correo);
  const tokB = await entrar(B.correo);

  // A es una agencia de pruebas que da de alta muchos usuarios para probar roles
  // y validaciones (spec 003), no una clienta real atada al plan base (spec 029):
  // sin esto, el tope de 4 usuarios corta la mitad de los casos de abajo con un
  // 422 de "límite de usuarios" en vez del que cada caso quiere comprobar.
  await pedir('PATCH', `/companies/${A.id}`, await entrar(correoSuper), { limiteUsuarios: null });

  // Un asesor de A, creado por su admin como lo haría la pantalla de Usuarios.
  const correoAsesor = `${A.slug}-asesor@prueba.local`;
  const asesorCreado = await pedir('POST', '/users', tokA, {
    firstName: 'Asesor', lastName: 'Prueba', email: correoAsesor, password: CLAVE, role: 'asesor',
  });
  comprobar('el admin de A crea un asesor', asesorCreado.status === 201, `HTTP ${asesorCreado.status}`);
  const tokAsesor = await entrar(correoAsesor);

  // Datos propios de cada agencia.
  const cliA = (await pedir('POST', '/clients', tokA, { firstName: 'Cliente', lastName: 'Ay', docType: 'CC', docNumber: '910000001' })).json?.data;
  const cliB = (await pedir('POST', '/clients', tokB, { firstName: 'Cliente', lastName: 'Be', docType: 'CC', docNumber: '910000001' })).json?.data;
  comprobar('el mismo documento se puede registrar en dos agencias', cliA?.id && cliB?.id);
  const ventaA = (await pedir('POST', '/sales', tokA, ventaMinima(cliA.id))).json?.data;
  const ventaB = (await pedir('POST', '/sales', tokB, ventaMinima(cliB.id))).json?.data;
  comprobar('cada agencia crea su venta', ventaA?.id && ventaB?.id);

  // ── 1. Sin sesión
  console.log('\n  Sin sesión');
  comprobar('GET /sales sin token: 401', (await pedir('GET', '/sales')).status === 401);
  comprobar('GET /sales con un token inventado: 401', (await pedir('GET', '/sales', 'no.es.un.token')).status === 401);

  // ── 2. A3: un id de otra agencia responde "no existe"
  console.log('\n  Ids de otra agencia (A3)');
  const ajena = await pedir('GET', `/sales/${ventaA.id}`, tokB);
  comprobar('GET /sales/:id de otra agencia: 404', ajena.status === 404, `HTTP ${ajena.status}`);
  comprobar('…y el mensaje no revela que existe', !/otra|empresa|agencia|permiso/i.test(ajena.json?.error?.message || ''), ajena.json?.error?.message);
  const edicion = await pedir('PUT', `/sales/${ventaA.id}`, tokB, { observations: 'intruso' });
  comprobar('editar la venta de otra agencia: 403 o 404, nunca 200', una(edicion.status, 403, 404), `HTTP ${edicion.status}`);
  comprobar('borrar la venta de otra agencia: 403 o 404', una((await pedir('DELETE', `/sales/${ventaA.id}`, tokB)).status, 403, 404));
  comprobar('los productos de la venta de otra agencia: 404', (await pedir('GET', `/sales/${ventaA.id}/products`, tokB)).status === 404);
  comprobar('abonar en la venta de otra agencia: 403 o 404',
    una((await pedir('POST', `/sales/${ventaA.id}/payments`, tokB, { amount: 1 })).status, 400, 403, 404));
  comprobar('GET /clients/:id de otra agencia: 404', (await pedir('GET', `/clients/${cliA.id}`, tokB)).status === 404);

  const listaB = await pedir('GET', '/sales?perPage=100', tokB);
  const idsB = (listaB.json?.data || []).map(v => v.id);
  comprobar('el listado de B tiene solo su venta', idsB.length === 1 && idsB[0] === ventaB.id && listaB.json?.meta?.total === 1,
    `${idsB.length} filas, total ${listaB.json?.meta?.total}`);
  const clientesB = await pedir('GET', '/clients?perPage=100', tokB);
  comprobar('el listado de clientes de B tiene solo el suyo', clientesB.json?.meta?.total === 1, `total ${clientesB.json?.meta?.total}`);

  const detalleA = (await pedir('GET', `/sales/${ventaA.id}`, tokA)).json?.data;
  const detalleB = (await pedir('GET', `/sales/${ventaB.id}`, tokB)).json?.data;
  const numA = detalleA?.numero ?? detalleA?.number;
  const numB = detalleB?.numero ?? detalleB?.number;
  comprobar('cada agencia numera sus ventas desde 1', numA === 1 && numB === 1, `A: ${numA}, B: ${numB}`);

  // ── 3. A9: los ficheros subidos
  console.log('\n  Ficheros subidos (A9)');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'prueba-aislamiento.png');
  const subida = await pedir('PUT', `/sales/${ventaA.id}/products/${ventaA.products[0].detalleId}/voucher`, tokA, undefined, { form });
  const urlFichero = subida.json?.data?.voucher_url;
  comprobar('A sube el voucher de su venta', subida.status === 200 && urlFichero, `HTTP ${subida.status}`);
  const f = (token) => pedir('GET', urlFichero, token, undefined, { base: BASE });
  comprobar('el fichero sin sesión: 401', (await f(null)).status === 401);
  const fB = await f(tokB);
  comprobar('el fichero con la sesión de otra agencia: 404', fB.status === 404, `HTTP ${fB.status}`);
  const resA = await fetch(BASE + urlFichero, { headers: { Authorization: `Bearer ${tokA}` } });
  comprobar('el fichero con la sesión de su agencia: 200', resA.status === 200, `HTTP ${resA.status}`);
  const subidaAjena = await pedir('PUT', `/sales/${ventaA.id}/products/${ventaA.products[0].detalleId}/voucher`, tokB, undefined, { form: (() => {
    const g = new FormData(); g.append('file', new Blob([png], { type: 'image/png' }), 'intruso.png'); return g;
  })() });
  comprobar('subir un voucher a la venta de otra agencia: 404', subidaAjena.status === 404, `HTTP ${subidaAjena.status}`);

  // ── 4. Un asesor no pasa de su rol
  console.log('\n  Un asesor de la agencia');
  const ventaPropia = (await pedir('POST', '/sales', tokAsesor, ventaMinima(cliA.id))).json?.data;
  comprobar('el asesor crea su propia venta', Boolean(ventaPropia?.id));
  const idUsuarioAsesor = asesorCreado.json?.data?.id;
  comprobar('no lista al personal (GET /users: 403, spec 027)', (await pedir('GET', '/users', tokAsesor)).status === 403);
  comprobar('crear un usuario: 403, no 404 ni 422', (await pedir('POST', '/users', tokAsesor, {
    firstName: 'X', lastName: 'Y', email: `${A.slug}-x@prueba.local`, password: CLAVE, role: 'asesor',
  })).status === 403);
  comprobar('editar un usuario: 403', (await pedir('PUT', `/users/${idUsuarioAsesor}`, tokAsesor, { firstName: 'Z' })).status === 403);
  comprobar('borrar un usuario: 403', (await pedir('DELETE', `/users/${idUsuarioAsesor}`, tokAsesor)).status === 403);
  comprobar('ver los permisos de un rol: 403', (await pedir('GET', '/roles/asesor/permissions', tokAsesor)).status === 403);
  comprobar('reescribir permisos de un rol: 403',
    (await pedir('PUT', '/roles/asesor/permissions', tokAsesor, { permissions: { users: { view: true, create: true } } })).status === 403);
  comprobar('administrar agencias: 403', (await pedir('GET', '/companies', tokAsesor)).status === 403);

  const propias = await pedir('GET', '/sales?perPage=100', tokAsesor);
  const idsAsesor = (propias.json?.data || []).map(v => v.id);
  comprobar('su listado de ventas son solo las propias', idsAsesor.length === 1 && idsAsesor[0] === ventaPropia?.id,
    `${idsAsesor.length} filas de ${(await pedir('GET', '/sales?perPage=100', tokA)).json?.meta?.total} de la agencia`);
  comprobar('la venta de un compañero no se ve: 403 o 404', una((await pedir('GET', `/sales/${ventaA.id}`, tokAsesor)).status, 403, 404));
  comprobar('…ni se edita', una((await pedir('PUT', `/sales/${ventaA.id}`, tokAsesor, { observations: 'x' })).status, 403, 404));
  comprobar('…ni se anula', una((await pedir('POST', `/sales/${ventaA.id}/cancellation`, tokAsesor, { reason: 'prueba de aislamiento' })).status, 400, 403, 404));

  // Spec 022: los ficheros siguen el alcance de ver ventas, no solo la agencia.
  comprobar('…ni se abre su voucher: 404', (await f(tokAsesor)).status === 404);
  const subidaPropia = await pedir('PUT', `/sales/${ventaPropia?.id}/products/${ventaPropia?.products?.[0]?.detalleId}/voucher`, tokAsesor, undefined, { form: (() => {
    const g = new FormData(); g.append('file', new Blob([png], { type: 'image/png' }), 'propio.png'); return g;
  })() });
  const urlPropia = subidaPropia.json?.data?.voucher_url;
  comprobar('el voucher de su propia venta sí se abre: 200', Boolean(urlPropia) && (await fetch(BASE + urlPropia, { headers: { Authorization: `Bearer ${tokAsesor}` } })).status === 200,
    `subida HTTP ${subidaPropia.status}`);
  comprobar('el admin abre el voucher del asesor: 200', Boolean(urlPropia) && (await fetch(BASE + urlPropia, { headers: { Authorization: `Bearer ${tokA}` } })).status === 200);

  // Spec 019: el alcance 'own' de clientes vale también por id, no solo en la lista.
  const estado = async (metodo, ruta, cuerpo) => (await pedir(metodo, ruta, tokAsesor, cuerpo)).status;
  comprobar('el cliente del admin no se lee por id: 404', (await estado('GET', `/clients/${cliA.id}`)) === 404);
  comprobar('…ni se edita: 403', (await estado('PUT', `/clients/${cliA.id}`, { phone: '3009998877' })) === 403);
  comprobar('…ni se le cambian los destinos: 403', (await estado('PUT', `/clients/${cliA.id}`, { destinations: ['Cali'] })) === 403);
  comprobar('…ni se desactiva: 403', (await estado('PATCH', `/clients/${cliA.id}/toggle-status`)) === 403);
  const cliAsesor = (await pedir('POST', '/clients', tokAsesor, { firstName: 'Cliente', lastName: 'Asesor', docType: 'CC', docNumber: '930000001' })).json?.data;
  comprobar('su propio cliente sí se lee: 200', (await estado('GET', `/clients/${cliAsesor?.id}`)) === 200);
  comprobar('…y se edita: 200', (await estado('PUT', `/clients/${cliAsesor?.id}`, { phone: '3009998877' })) === 200);
  comprobar('el admin sigue leyendo el cliente del asesor: 200', (await pedir('GET', `/clients/${cliAsesor?.id}`, tokA)).status === 200);

  // ── Spec 025: permisos por rol. Va ANTES de la spec 020, que reconfigura el rol asesor:
  // aquí el asesor está con los valores por defecto.
  console.log('\n  Permisos por rol (spec 025)');
  // 1. Pantallas de gestión cerradas al asesor por defecto (H3).
  const estadoAs = async (metodo, ruta, cuerpo) => (await pedir(metodo, ruta, tokAsesor, cuerpo)).status;
  comprobar('asesor: GET /commissions/agents: 403', (await estadoAs('GET', '/commissions/agents')) === 403);
  comprobar('asesor: POST /commissions/agents: 403', (await estadoAs('POST', '/commissions/agents', { name: 'X', type: 'freelance', docType: 'CC', docNumber: '920000009', paymentThreshold: 1000 })) === 403);
  comprobar('asesor: GET /commissions/settlements: 403', (await estadoAs('GET', '/commissions/settlements')) === 403);
  comprobar('asesor: GET /responsables: 403', (await estadoAs('GET', '/responsables')) === 403);
  comprobar('asesor: POST /responsables: 403', (await estadoAs('POST', '/responsables', { firstName: 'X', lastName: 'Y' })) === 403);
  comprobar('asesor: GET /config/all (config.view): 200', (await estadoAs('GET', '/config/all')) === 200);
  comprobar('asesor: POST /config/payment-methods (config.edit): 403', (await estadoAs('POST', '/config/payment-methods', { name: 'Intruso' })) === 403);

  // 2. La cotización del admin no se ve ni se edita.
  const cotA = (await pedir('POST', '/quotes', tokA, { clientId: cliA.id, hotelData: [{ hotelName: 'Hotel Test', destination: 'San Andrés', supplierCost: 0, ta: 100000 }] })).json?.data;
  comprobar('el admin crea una cotización', Boolean(cotA?.id));
  comprobar('asesor: GET de la cotización del admin: 404', (await estadoAs('GET', `/quotes/${cotA?.id}`)) === 404);
  comprobar('asesor: PUT de la cotización del admin: 403 o 404',
    una(await estadoAs('PUT', `/quotes/${cotA?.id}`, { observations: 'x' }), 403, 404));

  // 3. Cobrar una venta ajena.
  const cobro = await estadoAs('POST', `/sales/${ventaA.id}/payments`, { amount: 1 });
  comprobar('asesor: cobrar la venta del admin: 403 o 404', una(cobro, 403, 404), `HTTP ${cobro}`);

  // 4. Estadísticas con ámbito: el asesor suma solo lo suyo (una venta propia, dos del admin en la agencia).
  const stAs = await pedir('GET', '/stats/dashboard', tokAsesor);
  const stAd = await pedir('GET', '/stats/dashboard', tokA);
  comprobar('asesor: GET /stats/dashboard: 200', stAs.status === 200 && stAd.status === 200, `HTTP ${stAs.status}/${stAd.status}`);
  const opsAs = stAs.json?.data?.totalOperations, opsAd = stAd.json?.data?.totalOperations;
  comprobar('el dashboard del asesor cuenta menos operaciones que el del admin', opsAs < opsAd, `asesor ${opsAs}, admin ${opsAd}`);
  comprobar('…y son solo las suyas (1)', opsAs === 1, `asesor ${opsAs}`);

  // 5. H1: marcar revisada es solo de quien edita ventas en 'all'.
  const ventaPagada = (await pedir('POST', '/sales', tokAsesor, ventaMinima(cliA.id))).json?.data;
  const pago = await estadoAs('POST', `/sales/${ventaPagada?.id}/payments`, { amount: 1, isTotal: true });
  comprobar('el asesor salda una venta suya (queda pagada)', pago === 201 || pago === 200, `HTTP ${pago}`);
  const revAs = await estadoAs('PATCH', `/sales/${ventaPagada?.id}/review-status`, { isReviewed: true });
  comprobar('asesor: marcar revisada su propia venta pagada: 403', revAs === 403, `HTTP ${revAs}`);
  const revAd = await pedir('PATCH', `/sales/${ventaPagada?.id}/review-status`, tokA, { isReviewed: true });
  comprobar('admin: marcar revisada esa venta: 200', revAd.status === 200, `HTTP ${revAd.status}`);

  // 6. H2: el freelancer no lista usuarios y vende a su nombre. Los permisos del rol se
  // siembran al crear la agencia desde ROLE_DEFAULT_PERMISSIONS (companies.service.js), así
  // que el nuevo default (users.view false) ya está en la base de esta agencia de prueba.
  const correoFree = `${A.slug}-freelancer@prueba.local`;
  const free = await pedir('POST', '/users', tokA, { firstName: 'Free', lastName: 'Lancer', email: correoFree, password: CLAVE, role: 'freelancer' });
  comprobar('el admin crea un freelancer', free.status === 201, `HTTP ${free.status}`);
  const tokFree = await entrar(correoFree);
  comprobar('freelancer: GET /users: 403', (await pedir('GET', '/users', tokFree)).status === 403);
  const ventaFree = await pedir('POST', '/sales', tokFree, ventaMinima(cliA.id));
  comprobar('freelancer: vende a su nombre (sin asesorId): 201', ventaFree.status === 201, `HTTP ${ventaFree.status}`);
  const ajenoFree = await pedir('POST', '/sales', tokFree, ventaMinima(cliA.id, { asesorId: asesorCreado.json?.data?.id }));
  comprobar('freelancer: vender a nombre de otro asesor: 403', ajenoFree.status === 403, `HTTP ${ajenoFree.status}`);

  // 7. Vuelos: itineraries.edit es 'none' por defecto. `authorize` corta antes de buscar el
  // vuelo, así que basta un uuid cualquiera (con forma de uuid: `paramsUuid` responde 400 antes
  // de `authorize` a un id mal formado); montar un vuelo con tiquete no añade nada a esta prueba.
  const checkinAs = await estadoAs('PUT', `/flights/${require('crypto').randomUUID()}/checkin`);
  comprobar('asesor: check-in de un vuelo (itineraries.edit ninguno): 403', checkinAs === 403, `HTTP ${checkinAs}`);

  // ── Spec 026: el freelancer solo maneja los responsables que creó.
  console.log('\n  Responsables del freelancer (spec 026)');
  const respFree = await pedir('POST', '/responsables', tokFree, { firstName: 'Resp', lastName: 'Free' });
  comprobar('freelancer: crea un responsable: 201', respFree.status === 201, `HTTP ${respFree.status}`);
  const idRespFree = respFree.json?.data?.id;
  comprobar('freelancer: ve el suyo: 200', (await pedir('GET', `/responsables/${idRespFree}`, tokFree)).status === 200);
  const editRespFree = await pedir('PUT', `/responsables/${idRespFree}`, tokFree, { firstName: 'Resp', lastName: 'Editado' });
  comprobar('freelancer: edita el suyo: 200', editRespFree.status === 200, `HTTP ${editRespFree.status}`);
  const respAdmin = await pedir('POST', '/responsables', tokA, { firstName: 'Resp', lastName: 'Admin' });
  const idRespAdmin = respAdmin.json?.data?.id;
  comprobar('el admin crea un responsable', respAdmin.status === 201, `HTTP ${respAdmin.status}`);
  comprobar('freelancer: GET del responsable del admin: 404', (await pedir('GET', `/responsables/${idRespAdmin}`, tokFree)).status === 404);
  const putAjeno = await pedir('PUT', `/responsables/${idRespAdmin}`, tokFree, { firstName: 'Intruso', lastName: 'Ajeno' });
  comprobar('freelancer: PUT del responsable del admin: 403', putAjeno.status === 403, `HTTP ${putAjeno.status}`);
  const listaFree = ((await pedir('GET', '/responsables?perPage=100', tokFree)).json?.data || []).map(r => r.id);
  comprobar('freelancer: su lista trae el suyo y no el del admin', listaFree.includes(idRespFree) && !listaFree.includes(idRespAdmin), JSON.stringify(listaFree));
  comprobar('admin: ve el del freelancer: 200', (await pedir('GET', `/responsables/${idRespFree}`, tokA)).status === 200);
  comprobar('admin: edita el del freelancer: 200', (await pedir('PUT', `/responsables/${idRespFree}`, tokA, { firstName: 'Resp', lastName: 'Free' })).status === 200);

  // Spec 033: desactivar manda y devuelve solo el estado; la persona (compartida por documento) no cambia.
  const ccResp = (await admin.tipos_documento.findMany()).find(t => t.abreviatura === 'CC');
  const respCompuesto = await pedir('POST', '/responsables', tokA, {
    firstName: 'Juan Carlos', lastName: 'Pérez Gómez', docTypeId: ccResp.id, docNumber: '1098765432',
  });
  const idCompuesto = respCompuesto.json?.data?.id;
  const desactivar = await pedir('PATCH', `/responsables/${idCompuesto}/status`, tokA, { status: 'inactive' });
  comprobar('desactivar un responsable: 200 con solo { id, status }',
    desactivar.status === 200 && JSON.stringify(Object.keys(desactivar.json?.data || {}).sort()) === '["id","status"]' && desactivar.json?.data?.status === 'inactive',
    `HTTP ${desactivar.status}, ${JSON.stringify(desactivar.json?.data)}`);
  const trasDesactivar = (await pedir('GET', `/responsables/${idCompuesto}`, tokA)).json?.data;
  comprobar('desactivar no toca nombres ni tipo de documento',
    trasDesactivar?.firstName === 'Juan Carlos' && trasDesactivar?.lastName === 'Pérez Gómez' && trasDesactivar?.docTypeId === ccResp.id,
    JSON.stringify([trasDesactivar?.firstName, trasDesactivar?.lastName, trasDesactivar?.docTypeId]));
  comprobar('un estado que no existe: 422',
    (await pedir('PATCH', `/responsables/${idCompuesto}/status`, tokA, { status: 'borrado' })).status === 422);
  comprobar('el estado no acepta otros campos: 422',
    (await pedir('PATCH', `/responsables/${idCompuesto}/status`, tokA, { status: 'active', firstName: 'Otro' })).status === 422);
  const ponerSoloEstado = await pedir('PUT', `/responsables/${idCompuesto}`, tokA, { status: 'active' });
  const trasPut = (await pedir('GET', `/responsables/${idCompuesto}`, tokA)).json?.data;
  comprobar('un PUT con solo el estado no borra el tipo de documento',
    ponerSoloEstado.status === 200 && trasPut?.docTypeId === ccResp.id, `HTTP ${ponerSoloEstado.status}, tipo ${trasPut?.docTypeId}`);
  comprobar('un PUT responde solo lo que se mandó: { id, status }',
    JSON.stringify(Object.keys(ponerSoloEstado.json?.data || {}).sort()) === '["id","status"]', JSON.stringify(ponerSoloEstado.json?.data));
  const renombrar = await pedir('PUT', `/responsables/${idCompuesto}`, tokA, { firstName: 'Juan Carlos', lastName: 'Pérez Gómez' });
  comprobar('un PUT de nombres responde id, firstName, lastName y name, sin documento ni deuda',
    JSON.stringify(Object.keys(renombrar.json?.data || {}).sort()) === '["firstName","id","lastName","name"]', JSON.stringify(renombrar.json?.data));
  comprobar('freelancer: desactivar uno ajeno: 403',
    (await pedir('PATCH', `/responsables/${idRespAdmin}/status`, tokFree, { status: 'inactive' })).status === 403);
  const borraFree = await pedir('DELETE', `/responsables/${idRespFree}`, tokFree);
  comprobar('freelancer: borrar el suyo (delete none): 403', borraFree.status === 403, `HTTP ${borraFree.status}`);
  const ventaRespAjeno = await pedir('POST', '/sales', tokFree, ventaMinima(cliA.id, { responsableId: idRespAdmin }));
  comprobar('freelancer: vender con el responsable del admin: 403', ventaRespAjeno.status === 403, `HTTP ${ventaRespAjeno.status}`);
  const ventaRespPropio = await pedir('POST', '/sales', tokFree, ventaMinima(cliA.id, { responsableId: idRespFree }));
  comprobar('freelancer: vender con su responsable: 201', ventaRespPropio.status === 201, `HTTP ${ventaRespPropio.status}`);
  const ventaRespAsesor = await pedir('POST', '/sales', tokAsesor, ventaMinima(cliA.id, { responsableId: idRespAdmin }));
  comprobar('asesor (responsables ninguno): vender con un responsable: 403', ventaRespAsesor.status === 403, `HTTP ${ventaRespAsesor.status}`);
  const panelFree = (await pedir('GET', '/roles/freelancer/permissions', tokA)).json?.data;
  comprobar('panel: el freelancer sin usuarios y con responsables own/true/own/none',
    panelFree?.users?.view === false && JSON.stringify(panelFree?.responsables) === JSON.stringify({ view: 'own', create: true, edit: 'own', delete: 'none' }),
    JSON.stringify([panelFree?.users?.view, panelFree?.responsables]));

  // ── Spec 027: lo que muestra la pantalla es lo que aplica la API.
  console.log('\n  Permisos coherentes (spec 027)');
  const misAs = await pedir('GET', '/auth/me/permissions', tokAsesor);
  comprobar('asesor: GET /auth/me/permissions: 200, ventas propias y sin usuarios',
    misAs.status === 200 && misAs.json?.data?.sales?.view === 'own' && misAs.json?.data?.users?.view === false, `HTTP ${misAs.status}`);
  const tokPerm27 = await entrar(correoSuper);
  const originalesFree = (await pedir('GET', '/roles/freelancer/permissions', tokPerm27)).json?.data || {};
  const guardarFree = (permisos) => pedir('PUT', '/roles/freelancer/permissions', tokPerm27, { permissions: permisos });
  const sinVentas = { ...originalesFree, sales: { ...originalesFree.sales, view: 'none' } };
  comprobar('el superadmin le quita las ventas al freelancer: 200', (await guardarFree(sinVentas)).status === 200);
  const misFree = await pedir('GET', '/auth/me/permissions', tokFree);
  comprobar('…y su /auth/me/permissions lo refleja (ventas ninguna)', misFree.json?.data?.sales?.view === 'none', JSON.stringify(misFree.json?.data?.sales));
  comprobar('…y GET /sales da 403', (await pedir('GET', '/sales', tokFree)).status === 403);
  comprobar('el freelancer recupera sus permisos: 200', (await guardarFree(originalesFree)).status === 200);

  // Valores heredados escritos a mano: el panel y la API tienen que decir lo mismo, y uno
  // desconocido no da acceso (antes `authorize` lo aplicaba como 'own').
  const ventasFree = { roles: { nombre: 'freelancer', empresa_id: A.id }, permisos: { modulo: 'sales', accion: 'view' } };
  for (const [guardado, esperado] of [['true', 'all'], ['false', 'none'], ['xyz', 'none']]) {
    await admin.permisos_rol.updateMany({ where: ventasFree, data: { valor: guardado } });
    const tokFresco = await entrar(correoFree);
    const api = (await pedir('GET', '/auth/me/permissions', tokFresco)).json?.data?.sales?.view;
    const panel = (await pedir('GET', '/roles/freelancer/permissions', tokA)).json?.data?.sales?.view;
    comprobar(`ventas guardado como '${guardado}': la API y el panel dicen '${esperado}'`, api === esperado && panel === esperado, `API ${api}, panel ${panel}`);
    if (esperado === 'none') comprobar(`…y GET /sales: 403`, (await pedir('GET', '/sales', tokFresco)).status === 403);
  }
  await admin.permisos_rol.updateMany({ where: ventasFree, data: { valor: 'own' } });

  // Spec 028: con ventas en 'own', el freelancer no ve las ajenas ni sus costos.
  const tokFree28 = await entrar(correoFree);
  comprobar('freelancer (ventas own): la venta del admin: 404', (await pedir('GET', `/sales/${ventaA.id}`, tokFree28)).status === 404);
  const idsFree = ((await pedir('GET', '/sales?perPage=100', tokFree28)).json?.data || []).map(v => v.id);
  comprobar('…y su lista no trae la del admin', idsFree.length > 0 && !idsFree.includes(ventaA.id), JSON.stringify(idsFree));

  // Spec 020: editar y borrar con alcance propio. El superadmin reconfigura el rol
  // asesor de A: "ver todas, editar solo las suyas, no borrar".
  console.log('\n  Editar y borrar con alcance propio (spec 020)');
  const tokPermisos = await entrar(correoSuper);
  const guardarAsesor = async (cambios) => {
    const actuales = (await pedir('GET', '/roles/asesor/permissions', tokPermisos)).json?.data || {};
    const permisos = Object.fromEntries(Object.entries(actuales).map(([m, a]) => [m, { ...a, ...(cambios[m] || {}) }]));
    return pedir('PUT', '/roles/asesor/permissions', tokPermisos, { permissions: permisos });
  };
  const r1 = await guardarAsesor({ sales: { view: 'all', edit: 'own', delete: 'none' }, clients: { view: 'all', edit: 'own' } });
  comprobar('el superadmin guarda "ver todas · editar las suyas · borrar ninguna"', r1.status === 200, `HTTP ${r1.status}`);
  comprobar('el asesor ve la venta del admin: 200', (await estado('GET', `/sales/${ventaA.id}`)) === 200);
  comprobar('…pero no la edita: 403', (await estado('PUT', `/sales/${ventaA.id}`, { observations: 'spec 020' })) === 403);
  comprobar('…ni la cobra: 403', (await estado('POST', `/sales/${ventaA.id}/payments`, { amount: 1 })) === 403);
  comprobar('…ni la borra: 403', (await estado('DELETE', `/sales/${ventaA.id}`)) === 403);
  comprobar('edita la suya: 200', (await estado('PUT', `/sales/${ventaPropia?.id}`, { observations: 'spec 020' })) === 200);
  comprobar('borrar la suya tampoco (borrar: ninguna): 403', (await estado('DELETE', `/sales/${ventaPropia?.id}`)) === 403);
  comprobar('ve el cliente del admin: 200', (await estado('GET', `/clients/${cliA.id}`)) === 200);
  comprobar('…pero no lo edita: 403', (await estado('PUT', `/clients/${cliA.id}`, { phone: '3009998877' })) === 403);
  comprobar('edita el suyo: 200', (await estado('PUT', `/clients/${cliAsesor?.id}`, { phone: '3009998866' })) === 200);

  await guardarAsesor({ sales: { view: 'all', edit: 'all' } });
  comprobar('con "editar: todas" edita la del admin: 200', (await estado('PUT', `/sales/${ventaA.id}`, { observations: 'spec 020' })) === 200);

  await guardarAsesor({ clients: { view: 'own', edit: 'all' } });
  const recortado = (await pedir('GET', '/roles/asesor/permissions', tokPermisos)).json?.data?.clients;
  comprobar('"ver: las suyas · editar: todas" se guarda recortado a "las suyas"', recortado?.edit === 'own', JSON.stringify(recortado));
  const esquema = (await pedir('GET', '/roles/schema', tokPermisos)).json?.data;
  const tiposVentas = esquema?.modules?.find(m => m.key === 'sales')?.actions?.map(a => `${a.key}:${a.type}`).join(',');
  comprobar('el esquema del panel describe editar y borrar de ventas como alcance', tiposVentas === 'view:scope,create:boolean,edit:scope,delete:scope', tiposVentas);

  // ── 5. Liquidaciones de comisiones
  console.log('\n  Liquidación de comisiones');
  const agente = (await pedir('POST', '/commissions/agents', tokA, { name: 'Comisionista A', type: 'freelance', docType: 'CC', docNumber: '920000001', paymentThreshold: 1000 })).json?.data;
  const ventaCom = (await pedir('POST', '/sales', tokA, ventaMinima(cliA.id, {
    commissionAgentId: agente?.id, commissionAgentAmount: 60000, commissionAgentRetentionPercentage: 0, commissionAgentNetPayment: 60000,
    restaurantData: [{ reservationName: 'Comisión', peopleCount: 2, supplierCost: 100000, ta: 600000 }],
  }))).json?.data;
  comprobar('A vende con comisionista', Boolean(agente?.id && ventaCom?.id));
  comprobar('B no ve al comisionista de A en su directorio',
    ((await pedir('GET', '/commissions/agents?perPage=100', tokB)).json?.data || []).every(a => a.id !== agente.id));
  const liqB = await pedir('POST', '/commissions/settlements', tokB, { agentId: agente.id });
  comprobar('B no puede liquidar al comisionista de A: 404 o 400', una(liqB.status, 400, 404), `HTTP ${liqB.status}`);
  const liqA = await pedir('POST', '/commissions/settlements', tokA, { agentId: agente.id });
  const monto = liqA.json?.data?.amount ?? liqA.json?.data?.monto;
  comprobar('A liquida a su comisionista: 201 por el neto de la venta', liqA.status === 201 && Number(monto) === 60000, `HTTP ${liqA.status}, monto ${monto}`);
  comprobar('liquidar otra vez, sin ventas pendientes, no es 201', liqA.status === 201 && (await pedir('POST', '/commissions/settlements', tokA, { agentId: agente.id })).status !== 201);
  comprobar('B no ve la liquidación de A',
    (await pedir('GET', '/commissions/settlements', tokB)).json?.meta?.total === 0);
  comprobar('A sí la ve',
    (await pedir('GET', '/commissions/settlements', tokA)).json?.meta?.total === 1);

  // ── 5b. Datos de personas: el tipo de documento por id (spec 003, T4)
  console.log('\n  Datos de personas: usuarios, comisionistas y responsables');
  const tipos = await admin.tipos_documento.findMany();
  const tipo = (abr) => tipos.find(t => t.abreviatura === abr);
  const cc = tipo('CC'); const nit = tipo('NIT');
  const campoDe = (r) => (r.json?.error?.details || []).map(d => d.field);
  const usuario = (extra) => ({ firstName: 'Persona', lastName: 'Prueba', password: CLAVE, role: 'asesor', ...extra });
  let n = 0;
  const correo = () => `${A.slug}-p${++n}@prueba.local`;

  const uMalDoc = await pedir('POST', '/users', tokA, usuario({ email: correo(), docTypeId: cc.id, docNumber: '12ab34' }));
  comprobar('usuario: cédula con letras: 422 en docNumber', uMalDoc.status === 422 && campoDe(uMalDoc).includes('docNumber'), `HTTP ${uMalDoc.status} ${campoDe(uMalDoc)}`);
  const uSinTipo = await pedir('POST', '/users', tokA, usuario({ email: correo(), docNumber: '1020304050' }));
  comprobar('usuario: número sin tipo: 422', uSinTipo.status === 422, `HTTP ${uSinTipo.status} ${campoDe(uSinTipo)}`);
  const uTipoFalso = await pedir('POST', '/users', tokA, usuario({ email: correo(), docTypeId: 999999, docNumber: '1020304050' }));
  comprobar('usuario: un id de tipo que no existe: 422 en docTypeId (antes se ignoraba)', uTipoFalso.status === 422 && campoDe(uTipoFalso).includes('docTypeId'), `HTTP ${uTipoFalso.status}`);
  const uNombre = await pedir('POST', '/users', tokA, usuario({ email: correo(), firstName: 'Ana1' }));
  comprobar('usuario: un nombre con números: 422 en firstName', uNombre.status === 422 && campoDe(uNombre).includes('firstName'), `HTTP ${uNombre.status}`);
  const uOk = await pedir('POST', '/users', tokA, usuario({ email: correo(), docTypeId: String(cc.id), docNumber: ' 1020304050 ' }));
  comprobar('usuario: por id (llega como texto del <select>): 201', uOk.status === 201, `HTTP ${uOk.status} ${JSON.stringify(uOk.json?.error)}`);
  const uLeido = (await pedir('GET', `/users/${uOk.json?.data?.id}`, tokA)).json?.data;
  comprobar('usuario: la respuesta trae el id y el tipo, y el número normalizado',
    uLeido?.docTypeId === cc.id && uLeido?.docType === 'CC' && uLeido?.docNumber === '1020304050', JSON.stringify([uLeido?.docTypeId, uLeido?.docType, uLeido?.docNumber]));
  const uAbr = await pedir('POST', '/users', tokA, usuario({ email: correo(), docType: 'CC', docNumber: '1020304051' }));
  comprobar('usuario: por abreviatura (lo de antes) sigue valiendo', uAbr.status === 201, `HTTP ${uAbr.status}`);
  const uEdita = await pedir('PUT', `/users/${uOk.json?.data?.id}`, tokA, { docTypeId: cc.id, docNumber: 'ABC1234' });
  comprobar('usuario: editar con un número inválido: 422', uEdita.status === 422 && campoDe(uEdita).includes('docNumber'), `HTTP ${uEdita.status}`);

  const cNit = (num) => pedir('POST', '/commissions/agents', tokA, { name: 'Comisionista NIT', type: 'freelance', docTypeId: nit.id, docNumber: num });
  const cOtroDigito = await cNit('900123456-7');
  comprobar('comisionista: el dígito de verificación del NIT no se comprueba: 201', cOtroDigito.status === 201, `HTTP ${cOtroDigito.status}`);
  const cBien = await cNit('900123456-8');
  comprobar('comisionista: NIT con el dígito bien: 201 con el id del tipo', cBien.status === 201 && cBien.json?.data?.docTypeId === nit.id, `HTTP ${cBien.status}`);
  const cTel = await pedir('POST', '/commissions/agents', tokA, { name: 'Con teléfono malo', phone: 'abc' });
  comprobar('comisionista: teléfono con letras: 422', cTel.status === 422 && campoDe(cTel).includes('phone'), `HTTP ${cTel.status}`);
  const cEmpresa = await pedir('POST', '/commissions/agents', tokA, { name: 'Agencia Z S.A.S. 2' });
  comprobar('comisionista: el nombre puede ser una empresa (con puntos y números)', cEmpresa.status === 201, `HTTP ${cEmpresa.status}`);

  const rMal = await pedir('POST', '/responsables', tokA, { firstName: 'Resp', lastName: 'Onsable', docTypeId: cc.id, docNumber: 'XYZ' });
  comprobar('responsable: cédula con letras: 422 en docNumber', rMal.status === 422 && campoDe(rMal).includes('docNumber'), `HTTP ${rMal.status}`);
  const rOk = await pedir('POST', '/responsables', tokA, { firstName: 'Resp', lastName: 'Onsable', docTypeId: cc.id, docNumber: '1020304060' });
  comprobar('responsable: por id: 201', rOk.status === 201, `HTTP ${rOk.status} ${JSON.stringify(rOk.json?.error)}`);
  const rNombre = await pedir('POST', '/responsables', tokA, { firstName: 'Resp', lastName: 'Antiguo', docType: cc.nombre, docNumber: '1020304061' });
  comprobar('responsable: por el nombre del tipo (lo de antes) sigue valiendo', rNombre.status === 201, `HTTP ${rNombre.status}`);
  const rLeido = (await pedir('GET', `/responsables/${rOk.json?.data?.id}`, tokA)).json?.data;
  comprobar('responsable: la respuesta trae el id del tipo y su nombre', rLeido?.docTypeId === cc.id && rLeido?.docType === cc.nombre, JSON.stringify([rLeido?.docTypeId, rLeido?.docType]));

  // Spec 024: un alta con el documento de otra persona de la agencia no le sobrescribe los datos.
  const cliDeUsuario = await pedir('POST', '/clients', tokA, { firstName: 'Otro', lastName: 'Nombre', docType: 'CC', docNumber: '1020304050', email: 'otro@prueba.local' });
  const usuarioTras = (await pedir('GET', `/users/${uOk.json?.data?.id}`, tokA)).json?.data;
  comprobar('persona compartida: el cliente con el documento de un usuario conserva sus datos y avisa',
    cliDeUsuario.status === 201 && cliDeUsuario.json?.data?.firstName === 'Persona' && Boolean(cliDeUsuario.json?.meta?.aviso)
      && usuarioTras?.firstName === 'Persona' && usuarioTras?.lastName === 'Prueba',
    `HTTP ${cliDeUsuario.status}, cliente ${cliDeUsuario.json?.data?.firstName}, usuario ${usuarioTras?.firstName} ${usuarioTras?.lastName}`);

  const cliInactivo = (await pedir('POST', '/clients', tokA, { firstName: 'Cliente', lastName: 'Inactivo', docType: 'CC', docNumber: '1020304080' })).json?.data;
  await pedir('PATCH', `/clients/${cliInactivo?.id}/toggle-status`, tokA);
  const comiDeCliente = await pedir('POST', '/commissions/agents', tokA, { name: 'Comisionista Encima', docTypeId: cc.id, docNumber: '1020304080' });
  const cliTras = (await pedir('GET', `/clients/${cliInactivo?.id}`, tokA)).json?.data;
  comprobar('persona compartida: el comisionista no reactiva ni renombra al cliente desactivado',
    comiDeCliente.status === 201 && Boolean(comiDeCliente.json?.meta?.aviso) && cliTras?.status === 'inactive' && cliTras?.firstName === 'Cliente',
    `HTTP ${comiDeCliente.status}, cliente ${cliTras?.status} ${cliTras?.firstName}`);

  const uBaja = await pedir('POST', '/users', tokA, usuario({ email: correo(), docTypeId: cc.id, docNumber: '1020304090' }));
  await pedir('DELETE', `/users/${uBaja.json?.data?.id}`, tokA);
  const cliRevive = await pedir('POST', '/clients', tokA, { firstName: 'Nuevo', lastName: 'Dueño', docType: 'CC', docNumber: '1020304090' });
  comprobar('persona compartida: el documento de una persona dada de baja se revive con los datos nuevos, sin aviso',
    cliRevive.status === 201 && cliRevive.json?.data?.firstName === 'Nuevo' && !cliRevive.json?.meta?.aviso,
    `HTTP ${cliRevive.status}, ${cliRevive.json?.data?.firstName}, aviso ${cliRevive.json?.meta?.aviso || 'no'}`);

  // Los pasajeros de una venta (createSale): el documento se valida y la persona guarda su tipo.
  const conHuespedes = (huespedes) => ventaMinima(cliA.id, {
    restaurantData: undefined,
    tourData: [{ supplierCost: 1000, ta: 500, guests: huespedes }],
  });
  const vMal = await pedir('POST', '/sales', tokA, conHuespedes([{ name: 'Ana Prueba', docType: 'CC', docNumber: '12ab' }]));
  comprobar('venta: la cédula de un huésped con letras: 422 con la ruta del campo',
    vMal.status === 422 && campoDe(vMal).includes('tourData.0.guests.0.docNumber'), `HTTP ${vMal.status} ${campoDe(vMal)}`);
  const vTipo = await pedir('POST', '/sales', tokA, conHuespedes([{ name: 'Ana Prueba', docType: 'ZZ', docNumber: '1020304070' }]));
  comprobar('venta: un tipo de documento que no existe: 422 en docType', vTipo.status === 422 && campoDe(vTipo).includes('tourData.0.guests.0.docType'), `HTTP ${vTipo.status}`);
  const vNit = await pedir('POST', '/sales', tokA, conHuespedes([{ name: 'Empresa Prueba', docType: 'NIT', docNumber: '900123456-7' }]));
  comprobar('venta: el dígito de verificación del NIT no se comprueba: 201', vNit.status === 201, `HTTP ${vNit.status}`);
  const vBien = await pedir('POST', '/sales', tokA, conHuespedes([
    { name: 'Ana Prueba', docType: 'cc', docNumber: ' 1020304070 ' },
    { name: 'Pedro Prueba', docType: 'Pasaporte', docNumber: 'ab123456' },
  ]));
  comprobar('venta: huéspedes válidos (tipo en minúscula, por nombre, número con espacios): 201', vBien.status === 201, `HTTP ${vBien.status} ${JSON.stringify(vBien.json?.error)}`);
  const personas = await admin.personas.findMany({
    where: { empresa_id: A.id, documento: { in: ['1020304070', 'AB123456'] } }, include: { tipos_documento: true },
  });
  comprobar('venta: las personas se guardan con el documento normalizado y su tipo',
    personas.length === 2 && personas.every(x => x.tipos_documento),
    personas.map(x => `${x.documento}/${x.tipos_documento?.abreviatura}`).join(', '));

  // ── 5c. El dashboard de B (agencia sin más ventas que las de esta sección y la mínima de arriba)
  console.log('\n  Dashboard');
  const pax = (n) => Array.from({ length: n }, (_, k) => ({ name: `Viajero ${k} Prueba`, docType: 'CC', docNumber: String(1030000000 + k) }));
  const tiquete = (pasajeros) => ({ ta: 50000, supplierCost: 300000, flightMode: 'one_way', reservationNumber: 'DASH01',
    legs: [{ origin: 'BOG', destination: 'MDE', date: '2027-03-10', departureTime: '08:00' }], passengers: pasajeros });
  const dashAntes = (await pedir('GET', '/stats/dashboard', tokB)).json?.data;
  const vTiq = await pedir('POST', '/sales', tokB, ventaMinima(cliB.id, {
    restaurantData: undefined,
    ticketData: [tiquete(pax(2)), tiquete([])],
    hotelData: [{ ta: 1000, supplierCost: 1000, hotelType: 'hotel', hotelName: 'Hotel Prueba', guests: [] }],
    insuranceData: [{ ta: 1000, supplierCost: 1000, members: [] }],
  }));
  comprobar('B vende 2 tiquetes (uno con 2 pasajeros, otro sin), un hotel y un seguro', vTiq.status === 201, `HTTP ${vTiq.status} ${JSON.stringify(vTiq.json?.error)}`);
  const dash = (await pedir('GET', '/stats/dashboard', tokB)).json?.data;
  const delta = (campo) => (dash?.[campo] ?? 0) - (dashAntes?.[campo] ?? 0);
  comprobar('tiquetes emitidos: uno por pasajero (2) más uno sin pasajeros = 3', delta('totalFlights') === 3, `+${delta('totalFlights')}`);
  comprobar('el desglose trae las categorías con su clave (hotel, insurance)',
    dash?.categoryBreakdown?.hotel?.count >= 1 && dash?.categoryBreakdown?.insurance?.count >= 1, JSON.stringify(Object.keys(dash?.categoryBreakdown || {})));
  const ops = dash?.totalOperations;
  const anul = await pedir('POST', `/sales/${vTiq.json?.data?.id}/cancellation`, tokB, { reason: 'Prueba del dashboard: anular' });
  const dashAnulada = (await pedir('GET', '/stats/dashboard', tokB)).json?.data;
  comprobar('una venta anulada sale de las operaciones y de los tiquetes',
    una(anul.status, 200, 201) && dashAnulada?.totalOperations === ops - 1 && dashAnulada?.totalFlights === dashAntes?.totalFlights,
    `HTTP ${anul.status}; operaciones ${ops} -> ${dashAnulada?.totalOperations}; tiquetes ${dash?.totalFlights} -> ${dashAnulada?.totalFlights}`);

  // Clientes por id del tipo (el contrato nuevo) y el mínimo para retirar de cada comisionista.
  const cliPorId = await pedir('POST', '/clients', tokA, { firstName: 'Cliente', lastName: 'Por Id', docTypeId: cc.id, docNumber: '1050000001' });
  comprobar('cliente por docTypeId: 201 y la respuesta trae el id del tipo', cliPorId.status === 201 && cliPorId.json?.data?.docTypeId === cc.id, `HTTP ${cliPorId.status}`);
  const cliMal = await pedir('POST', '/clients', tokA, { firstName: 'Cliente', lastName: 'Mal', docTypeId: cc.id, docNumber: '12ab' });
  comprobar('cliente por docTypeId con una cédula con letras: 422 en docNumber', cliMal.status === 422 && campoDe(cliMal).includes('docNumber'), `HTTP ${cliMal.status}`);
  const cliEspacios = await pedir('POST', '/clients', tokA, { firstName: 'Cliente', lastName: 'Sin Tipo', docType: '   ', docNumber: '1050000002' });
  comprobar('cliente con un tipo de solo espacios: 422 (antes quedaba sin tipo)', cliEspacios.status === 422, `HTTP ${cliEspacios.status}`);
  const agenteMin = (await pedir('POST', '/commissions/agents', tokA, { name: 'Comisionista Mínimo', type: 'freelance' })).json?.data;
  comprobar('un comisionista sin mínimo propio tiene el de por defecto (50.000)', Number(agenteMin?.paymentThreshold) === 50000, String(agenteMin?.paymentThreshold));
  await pedir('POST', '/sales', tokA, ventaMinima(cliA.id, {
    commissionAgentId: agenteMin?.id, commissionAgentAmount: 5000, commissionAgentRetentionPercentage: 0, commissionAgentNetPayment: 5000,
  }));
  const bajoMinimo = await pedir('POST', '/commissions/settlements', tokA, { agentId: agenteMin?.id });
  comprobar('liquidar por debajo del mínimo: 400 que dice cuál es', bajoMinimo.status === 400 && bajoMinimo.json?.error?.code === 'BELOW_MINIMUM' && /50\.000/.test(bajoMinimo.json?.error?.message || ''),
    `HTTP ${bajoMinimo.status} ${bajoMinimo.json?.error?.message}`);
  const minNegativo = await pedir('PUT', `/commissions/agents/${agenteMin?.id}`, tokA, { paymentThreshold: -5 });
  comprobar('un mínimo negativo: 422', minNegativo.status === 422, `HTTP ${minNegativo.status}`);

  // ── 6. El superadministrador y la suplantación
  console.log('\n  Suplantación');
  comprobar('el admin de una agencia no puede suplantar: 403',
    (await pedir('POST', `/companies/${B.id}/impersonations`, tokA, { motivo: 'Intento de un admin corriente' })).status === 403);
  const tokSuper = await entrar(correoSuper);
  comprobar('el superadmin lista agencias', (await pedir('GET', '/companies', tokSuper)).status === 200);
  comprobar('suplantar la propia agencia: 400',
    (await pedir('POST', `/companies/${A.id}/impersonations`, tokSuper, { motivo: 'Prueba automática de aislamiento' })).status === 400);
  const sup = await pedir('POST', `/companies/${B.id}/impersonations`, tokSuper, { motivo: 'Prueba automática de aislamiento' });
  comprobar('suplantar B: 201 con token', sup.status === 201 && sup.json?.data?.token, `HTTP ${sup.status}`);
  const tokSup = sup.json?.data?.token;
  if (tokSup) {
    const ve = await pedir('GET', '/sales?perPage=100', tokSup);
    const idsSup = (ve.json?.data || []).map(v => v.id);
    const idsDeB = ((await pedir('GET', '/sales?perPage=100', tokB)).json?.data || []).map(v => v.id).sort();
    comprobar('suplantando B ve las ventas de B y solo esas', JSON.stringify([...idsSup].sort()) === JSON.stringify(idsDeB) && idsSup.includes(ventaB.id), `${idsSup.length} filas, B tiene ${idsDeB.length}`);
    comprobar('suplantando B, la venta de A: 404', (await pedir('GET', `/sales/${ventaA.id}`, tokSup)).status === 404);
    const yo = (await pedir('GET', '/auth/me', tokSup)).json?.data;
    comprobar('/auth/me sigue siendo el superadmin, y trae la agencia en la que opera (para pintar su perfil)',
      yo?.email === correoSuper && yo?.empresaNombre === 'Agencia b' && Boolean(yo?.suplantacionId), JSON.stringify([yo?.email === correoSuper, yo?.empresaNombre, Boolean(yo?.suplantacionId)]));
    // Spec 033: la pantalla toma sus permisos de aquí; suplantando son los de administrador, no un 403.
    const misSup = await pedir('GET', '/auth/me/permissions', tokSup);
    comprobar('suplantando, /auth/me/permissions: 200 con ventas en all y el panel de permisos',
      misSup.status === 200 && misSup.json?.data?.sales?.view === 'all' && misSup.json?.data?.permissions?.view === true,
      `HTTP ${misSup.status}, ${JSON.stringify([misSup.json?.data?.sales?.view, misSup.json?.data?.permissions?.view])}`);
    const sinAsesor = await pedir('POST', '/sales', tokSup, ventaMinima(cliB.id));
    comprobar('suplantando, crear una venta sin asesor da 400 claro, no 500', sinAsesor.status === 400, `HTTP ${sinAsesor.status}`);
    comprobar('suplantando, el rol admin no se reescribe: 400',
      (await pedir('PUT', '/roles/admin/permissions', tokSup, { permissions: { users: { view: true } } })).status === 400);
    // Spec 026: el creador de un responsable es de la agencia de origen; se guarda vacío.
    const respSup = await pedir('POST', '/responsables', tokSup, { firstName: 'Resp', lastName: 'Suplantado' });
    const creadorSup = (await pedir('GET', `/responsables/${respSup.json?.data?.id}`, tokB)).json?.data?.createdBy;
    comprobar('suplantando, crear un responsable: 201 con el creador vacío', respSup.status === 201 && creadorSup === null, `HTTP ${respSup.status}, createdBy ${creadorSup}`);
    // Se sale con el propio token suplantado: es el que se invalida.
    // Estando dentro de B, suplantar la agencia del propio superadmin (A): 400 claro. Antes la "empresa de
    // origen" que se usaba era la visitada (B) y salía un error de clave ajena sin explicación.
    const aPropia = await pedir('POST', `/companies/${A.id}/impersonations`, tokSup, { motivo: 'Prueba automática anidada' });
    comprobar('dentro de B, suplantar la agencia propia: 400 claro (no un error de clave ajena)', aPropia.status === 400 && aPropia.json?.error?.code !== 'FOREIGN_KEY_ERROR', `HTTP ${aPropia.status} ${aPropia.json?.error?.code}`);
    const fin = await pedir('DELETE', `/companies/${B.id}/impersonations/${sup.json.data.suplantacionId}`, tokSup);
    comprobar('salir de la suplantación: 200', fin.status === 200, `HTTP ${fin.status}`);
    comprobar('el token suplantado ya no vale: 401', (await pedir('GET', '/sales', tokSup)).status === 401);
  }
}

ejecutar('Aislamiento por la API', PREFIJO, main);
