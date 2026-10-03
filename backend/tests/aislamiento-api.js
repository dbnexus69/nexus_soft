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
  comprobar('ve a sus compañeros (GET /users: 200)', (await pedir('GET', '/users', tokAsesor)).status === 200);
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
  const cMal = await cNit('900123456-7');
  comprobar('comisionista: NIT con el dígito de verificación mal: 422 que dice el correcto',
    cMal.status === 422 && /es 8/.test(cMal.json?.error?.details?.[0]?.message || ''), `HTTP ${cMal.status}`);
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
  comprobar('venta: un NIT con el dígito mal: 422', vNit.status === 422, `HTTP ${vNit.status}`);
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
  const tiquete = (pasajeros) => ({ ta: 50000, supplierCost: 300000, flightMode: 'one_way',
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
    comprobar('/auth/me sigue siendo el superadmin', (await pedir('GET', '/auth/me', tokSup)).json?.data?.email === correoSuper);
    const sinAsesor = await pedir('POST', '/sales', tokSup, ventaMinima(cliB.id));
    comprobar('suplantando, crear una venta sin asesor da 400 claro, no 500', sinAsesor.status === 400, `HTTP ${sinAsesor.status}`);
    comprobar('suplantando, el rol admin no se reescribe: 400',
      (await pedir('PUT', '/roles/admin/permissions', tokSup, { permissions: { users: { view: true } } })).status === 400);
    // Se sale con el propio token suplantado: es el que se invalida.
    const fin = await pedir('DELETE', `/companies/${B.id}/impersonations/${sup.json.data.suplantacionId}`, tokSup);
    comprobar('salir de la suplantación: 200', fin.status === 200, `HTTP ${fin.status}`);
    comprobar('el token suplantado ya no vale: 401', (await pedir('GET', '/sales', tokSup)).status === 401);
  }
}

ejecutar('Aislamiento por la API', PREFIJO, main);
