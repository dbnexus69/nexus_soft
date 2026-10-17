/**
 * Destinos de preferencia del cliente, por la API (spec 017). `pnpm test:clientes-destinos`
 *
 * Hasta 5 por cliente, el último es el reciente; un repetido pasa a reciente; el filtro va por
 * el reciente y, con `destinationAll`, por cualquiera; las sugerencias son de toda la agencia
 * aunque el asesor solo vea sus clientes.
 */
const { admin, comprobar, pedir, entrar, levantarServidor, montarAgencia, ejecutar, CLAVE } = require('./montaje');

const PREFIJO = 'prueba-destinos-';

ejecutar('Destinos de preferencia del cliente', PREFIJO, async () => {
  const A = await montarAgencia(PREFIJO, 'a');
  await levantarServidor();
  const token = await entrar(A.correo);

  const campos = (r) => (r.json?.error?.details || []).map(d => d.field);
  const crear = (doc, destinations) => pedir('POST', '/clients', token, {
    firstName: 'Cliente', lastName: 'Destinos', docType: 'CC', docNumber: doc, destinations,
  });
  const detalle = async (id) => (await pedir('GET', `/clients/${id}`, token)).json?.data;
  const total = async (query, tok = token) => {
    const r = await pedir('GET', `/clients?${query}`, tok);
    return r.status === 200 ? r.json.meta.total : `HTTP ${r.status}`;
  };

  console.log('  Alta y edición');
  const c1 = await crear('920000001', ['Cartagena', ' Medellín ', 'San Andrés']);
  comprobar('alta con 3 destinos: 201', c1.status === 201, `HTTP ${c1.status}`);
  const id = c1.json?.data?.id;
  let d = await detalle(id);
  comprobar('el detalle trae los 3 en orden', d?.destinations?.join() === 'Cartagena,Medellín,San Andrés', d?.destinations?.join());
  comprobar('el reciente es el último', d?.recentDestination === 'San Andrés', d?.recentDestination);

  const r5 = await pedir('PUT', `/clients/${id}`, token, { destinations: ['Cartagena', 'Medellín', 'San Andrés', 'Cusco', 'Madrid'] });
  comprobar('editar a 5: 200', r5.status === 200, `HTTP ${r5.status}`);
  const r6 = await pedir('PUT', `/clients/${id}`, token, { destinations: ['Aa', 'Bb', 'Cc', 'Dd', 'Ee', 'Ff'] });
  comprobar('un sexto: 422 en destinations', r6.status === 422 && campos(r6).includes('destinations'), `HTTP ${r6.status}`);
  const rCorto = await pedir('PUT', `/clients/${id}`, token, { destinations: ['Cali', 'B'] });
  comprobar('un destino de 1 carácter: 422 en destinations.1', rCorto.status === 422 && campos(rCorto).includes('destinations.1'), `HTTP ${rCorto.status}`);
  d = await detalle(id);
  comprobar('lo rechazado no tocó la lista', d?.destinations?.length === 5 && d?.recentDestination === 'Madrid', d?.destinations?.join());

  await pedir('PUT', `/clients/${id}`, token, { destinations: ['Medellín', 'San Andrés', 'Cusco', 'Madrid', 'cartagena'] });
  d = await detalle(id);
  // "cartagena" pasa a reciente con la escritura que la agencia ya tenía ("Cartagena").
  comprobar('un repetido con otras mayúsculas no duplica, pasa a reciente y conserva la escritura existente',
    d?.destinations?.length === 5 && d?.recentDestination === 'Cartagena', d?.destinations?.join());

  const sinCampo = await pedir('PUT', `/clients/${id}`, token, { phone: '3001234567' });
  d = await detalle(id);
  comprobar('editar sin `destinations` no los toca', sinCampo.status === 200 && d?.destinations?.length === 5);

  console.log('\n  Filtro de la lista');
  await crear('920000002', ['Madrid', 'Cusco']);
  comprobar('por el reciente: "carta" encuentra 1', (await total('destination=carta')) === 1);
  comprobar('por el reciente: "cusco" encuentra 1 (el del 2.º cliente)', (await total('destination=cusco')) === 1);
  comprobar('con anteriores: "cusco" encuentra 2', (await total('destination=cusco&destinationAll=true')) === 2);
  comprobar('con anteriores: "medell" encuentra 1', (await total('destination=medell&destinationAll=true')) === 1);
  const largo = await pedir('GET', `/clients?destination=${'x'.repeat(61)}`, token);
  comprobar('filtro de 61 caracteres: 422 en destination', largo.status === 422 && campos(largo).includes('destination'), `HTTP ${largo.status}`);

  const otraEscritura = await crear('920000003', ['mADRID']);
  comprobar('un destino que la agencia ya tiene con otras mayúsculas toma la escritura existente',
    otraEscritura.json?.data?.recentDestination === 'Madrid', otraEscritura.json?.data?.recentDestination);

  console.log('\n  Sugerencias');
  const sug = await pedir('GET', '/clients/destinations?search=c', token);
  comprobar('"c" sugiere Cusco (el más usado) primero', sug.status === 200 && sug.json?.data?.[0] === 'Cusco', JSON.stringify(sug.json?.data));

  const correoAsesor = `${A.slug}-asesor@prueba.local`;
  await pedir('POST', '/users', token, { firstName: 'Asesor', lastName: 'Prueba', email: correoAsesor, password: CLAVE, role: 'asesor' });
  const tokAsesor = await entrar(correoAsesor);
  comprobar('el asesor no ve los clientes del admin', (await total('destination=cusco&destinationAll=true', tokAsesor)) === 0);
  const sugAsesor = await pedir('GET', '/clients/destinations?search=madr', tokAsesor);
  comprobar('…pero sí las sugerencias de toda la agencia', sugAsesor.json?.data?.includes('Madrid'), JSON.stringify(sugAsesor.json?.data));

  const filas = await admin.cliente_destinos.count({ where: { empresa_id: A.id } });
  comprobar('en la base: 8 filas (5 + 2 + 1)', filas === 8, `${filas}`);
  const madrid = await admin.cliente_destinos.groupBy({ by: ['destino'], where: { empresa_id: A.id, destino: { equals: 'madrid', mode: 'insensitive' } } });
  comprobar('…y "Madrid" escrito de una sola forma', madrid.length === 1, JSON.stringify(madrid));
});
