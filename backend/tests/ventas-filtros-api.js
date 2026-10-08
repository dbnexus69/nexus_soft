/**
 * Los filtros del listado de ventas y de la cartera, por la API. `pnpm test:ventas-filtros`
 *
 * - Las fechas son días de Bogotá, los dos incluidos: una venta de las 22:00 del 7 es del 7, no del 8
 *   (antes "desde" se leía como medianoche UTC y "hasta" en la zona del servidor).
 * - Un filtro inválido es un 422 que nombra el campo: antes un estado fuera del enum llegaba al SQL y
 *   respondía 500.
 */
const { admin, comprobar, pedir, entrar, levantarServidor, montarAgencia, ejecutar } = require('./montaje');

const PREFIJO = 'prueba-filtros-';

ejecutar('Filtros del listado de ventas', PREFIJO, async () => {
  const A = await montarAgencia(PREFIJO, 'a');
  await levantarServidor();
  const token = await entrar(A.correo);

  const usuario = await admin.usuarios.findFirst({ where: { email: A.correo } });
  const persona = await admin.personas.create({ data: { empresa_id: A.id, nombres: 'Cliente', apellidos: 'Filtros', status: 'active' } });
  const cliente = await admin.clientes.create({ data: { empresa_id: A.id, persona_id: persona.id, creado_por_id: usuario.id } });
  // 2026-10-08T03:00Z son las 22:00 del 7 de octubre en Bogotá.
  await admin.ventas.create({
    data: { empresa_id: A.id, cliente_id: cliente.id, usuario_id: usuario.id, monto_total: 100, status: 'credito', creado_at: new Date('2026-10-08T03:00:00Z') },
  });

  const total = async (query) => {
    const r = await pedir('GET', `/sales?${query}`, token);
    return r.status === 200 ? r.json.meta.total : `HTTP ${r.status}`;
  };

  console.log('  Fechas: días de Bogotá');
  comprobar('la venta de las 22:00 del 7 sale filtrando el 7', (await total('dateFrom=2026-10-07&dateTo=2026-10-07')) === 1);
  comprobar('…y no filtrando el 8', (await total('dateFrom=2026-10-08&dateTo=2026-10-08')) === 0);
  comprobar('solo "hasta" el 7: sale', (await total('dateTo=2026-10-07')) === 1);
  comprobar('"hasta" con el formato anterior (T23:59:59) sigue valiendo', (await total('dateFrom=2026-10-07&dateTo=2026-10-07T23:59:59')) === 1);

  console.log('\n  Un filtro inválido es un 422 que nombra el campo');
  const invalido = async (descripcion, ruta, campo) => {
    const r = await pedir('GET', ruta, token);
    const campos = (r.json?.error?.details || []).map(d => d.field);
    comprobar(`${descripcion}: 422 en ${campo}`, r.status === 422 && campos.includes(campo), `${r.status} ${r.json?.error?.details?.[0]?.message || ''}`);
  };
  await invalido('estado fuera del enum (antes 500)', '/sales?status=foo', 'status');
  await invalido('búsqueda de 101 caracteres', `/sales?search=${'x'.repeat(101)}`, 'search');
  await invalido('rango al revés', '/sales?dateFrom=2026-10-09&dateTo=2026-10-08', 'dateFrom');
  await invalido('fecha que no es fecha', '/sales?dateFrom=ayer', 'dateFrom');
  await invalido('cliente que no es un id', '/sales?clientId=abc', 'clientId');
  await invalido('orden fuera de la lista', '/sales?sortBy=otro', 'sortBy');
  await invalido('cartera con búsqueda de 101 caracteres', `/sales/credit?search=${'y'.repeat(101)}`, 'search');

  console.log('\n  Lo válido sigue pasando');
  comprobar('estado válido', (await total('status=credito')) === 1);
  comprobar('estado vacío (?status=) es "sin filtro"', (await total('status=')) === 1);
  comprobar('búsqueda de 100 caracteres', typeof (await total(`search=${'x'.repeat(100)}`)) === 'number');
  const cartera = await pedir('GET', '/sales/credit?search=abc', token);
  comprobar('cartera con búsqueda normal: 200', cartera.status === 200, `${cartera.status}`);
});
