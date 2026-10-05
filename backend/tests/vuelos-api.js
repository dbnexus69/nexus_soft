#!/usr/bin/env node
/**
 * Vuelos y check-in por la API de verdad. `pnpm test:vuelos-api`
 *
 * La prueba de la spec 004 (T8), que vivía fuera del repositorio: alta de tiquetes validada,
 * días de Bogotá y dirección deducida en `/flights`, contadores, check-in (registrar, revertir,
 * cancelar con motivo), los vuelos de paquete (check-in y cancelación, T6), el panel "requiere
 * atención" con los vuelos de paquete (T7), la carrera de check-ins simultáneos, otra agencia,
 * ids mal formados y una venta anulada.
 *
 * Mismo montaje que `aislamiento-api.js` (`montaje.js`): servidor propio, agencias `prueba-vue-*`
 * y todo desmontado al final. Los clientes no llevan correo, así que el check-in no envía nada.
 */
const { admin, comprobar, pedir, entrar, una, levantarServidor, montarAgencia, ejecutar } = require('./montaje');

const PREFIJO = 'prueba-vue-';

// El día de Bogotá a `n` días de hoy, 'AAAA-MM-DD'.
const dia = (n) => new Date(Date.now() - 5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const pax = (n, base) => Array.from({ length: n }, (_, i) => ({
  name: `Viajero ${base}${i} Prueba`, docType: 'CC', docNumber: String(1040000000 + base * 10 + i), esTitular: i === 0,
}));
const tramo = (origin, destination, n, hora = '08:00', extra = {}) => ({ origin, destination, date: dia(n), departureTime: hora, ...extra });
const tiquete = (legs, extra = {}) => ({ ta: 50000, supplierCost: 300000, flightMode: 'one_way', legs, passengers: pax(1, 1), ...extra });

async function main() {
  console.log('  Montando dos agencias y arrancando el servidor…');
  const A = await montarAgencia(PREFIJO, 'a');
  const B = await montarAgencia(PREFIJO, 'b');
  await levantarServidor();
  const tokA = await entrar(A.correo);
  const tokB = await entrar(B.correo);

  const cliA = (await pedir('POST', '/clients', tokA, { firstName: 'Cliente', lastName: 'Vuelos', docTypeId: 1, docNumber: '930000001' })).json?.data;
  const cliB = (await pedir('POST', '/clients', tokB, { firstName: 'Cliente', lastName: 'Ajeno', docTypeId: 1, docNumber: '930000002' })).json?.data;
  comprobar('cada agencia tiene su cliente (A, de momento, sin correo)', cliA?.id && cliB?.id);
  const vender = (tok, cliente, productos) => pedir('POST', '/sales', tok, {
    clientId: cliente.id, total: 1, status: 'credito', creditDueDate: `${dia(60)}T00:00:00.000Z`, ...productos,
  });

  // ── 1. Alta de tiquetes validada (T2)
  console.log('\n  Alta de tiquetes');
  const aeropuertoFalso = await vender(tokA, cliA, { ticketData: [tiquete([tramo('BOG', 'ZZZ', 10)])] });
  comprobar('un aeropuerto que no existe: 422 en su campo',
    aeropuertoFalso.status === 422 && (aeropuertoFalso.json?.error?.details || []).some(d => d.field === 'ticketData.0.legs.0.destination'), `HTTP ${aeropuertoFalso.status}`);
  const planFalso = await vender(tokA, cliA, { ticketData: [tiquete([tramo('BOG', 'MDE', 10)], { baggagePlan: 'Aerolínea Fantasma - Oro' })] });
  comprobar('un plan de equipaje que no existe: 422', planFalso.status === 422, `HTTP ${planFalso.status}`);
  const politica = await admin.politicas_equipaje.findFirst({ include: { aerolineas: true } });
  const conPlan = await vender(tokA, cliA, { ticketData: [
    tiquete([tramo('bog', 'mde', 11)], { baggagePlan: `${politica.aerolineas.nombre} - ${politica.tipo_tarifa}`, reservationNumber: 'MINUS1' }),
    tiquete([tramo('MDE', 'BOG', 12)], { baggagePlan: String(politica.id), reservationNumber: 'PORID1' }),
  ] });
  comprobar('aeropuertos en minúscula y plan de equipaje por texto y por id: 201', conPlan.status === 201, `HTTP ${conPlan.status} ${JSON.stringify(conPlan.json?.error)}`);

  // ── 2. El calendario: días de Bogotá y dirección deducida (T1)
  console.log('\n  Calendario');
  const idaVuelta = await vender(tokA, cliA, { ticketData: [tiquete([
    tramo('BOG', 'CTG', 5, '07:30'), tramo('CTG', 'BOG', 9, '18:00'),
  ], { flightMode: 'round_trip', reservationNumber: 'RT0001', passengers: pax(2, 2) })] });
  const tresTramos = await vender(tokA, cliA, { ticketData: [tiquete([
    tramo('BOG', 'MDE', 13, '06:00'), tramo('MDE', 'CTG', 13, '10:00'), tramo('CTG', 'BAQ', 13, '14:00'), tramo('BAQ', 'BOG', 17, '09:00'),
  ], { flightMode: 'round_trip', reservationNumber: 'MULTI1' })] });
  const nocturno = await vender(tokA, cliA, { ticketData: [tiquete([tramo('BOG', 'MIA', 20, '23:30')], { reservationNumber: 'NOCHE1' })] });
  const critico = await vender(tokA, cliA, { ticketData: [tiquete([tramo('BOG', 'CLO', 1, '10:00')], { reservationNumber: 'CRIT01' })] });
  const ahora = Date.now();
  const planes = await vender(tokA, cliA, { planData: [
    { ta: 100000, supplierCost: 900000, planName: 'Plan Aéreo', transportType: 'Aéreo', guests: pax(2, 3),
      flightDepartureDate: new Date(ahora + 30 * 3600e3).toISOString(), flightReturnDate: new Date(ahora + 6 * 86400e3).toISOString() },
    { ta: 100000, supplierCost: 900000, planName: 'Plan en Bus', transportType: 'Terrestre',
      flightDepartureDate: new Date(ahora + 4 * 86400e3).toISOString() },
  ] });
  comprobar('las ventas del calendario se crean', [idaVuelta, tresTramos, nocturno, critico, planes].every(r => r.status === 201),
    [idaVuelta, tresTramos, nocturno, critico, planes].map(r => r.status).join(','));

  const mes = await pedir('GET', `/flights?dateFrom=${dia(0)}&dateTo=${dia(25)}&perPage=100`, tokA);
  const filas = mes.json?.data || [];
  const de = (pnr) => filas.filter(f => f.reservationNumber === pnr);
  const rt = de('RT0001');
  comprobar('ida y vuelta: la ida y el regreso deducidos', rt.length === 2 && rt.find(f => f.type === 'ida')?.origin === 'BOG' && rt.find(f => f.type === 'regreso')?.origin === 'CTG',
    rt.map(f => `${f.origin}-${f.destination}:${f.type}`).join(' '));
  comprobar('la hora y el día son los de Bogotá', rt.find(f => f.type === 'ida')?.time === '07:30' && rt.find(f => f.type === 'ida')?.date === dia(5),
    `${rt[0]?.date} ${rt[0]?.time}`);
  const multi = de('MULTI1');
  comprobar('tres tramos de ida y uno de vuelta: el corte va en el hueco más largo',
    multi.filter(f => f.type === 'ida').length === 3 && multi.filter(f => f.type === 'regreso').length === 1, multi.map(f => f.type).join(','));
  comprobar('la salida de las 23:30 cae en su día de Bogotá', de('NOCHE1')[0]?.date === dia(20) && de('NOCHE1')[0]?.time === '23:30');
  const soloEseDia = (await pedir('GET', `/flights?dateFrom=${dia(20)}&dateTo=${dia(20)}`, tokA)).json?.data || [];
  const diaSiguiente = (await pedir('GET', `/flights?dateFrom=${dia(21)}&dateTo=${dia(21)}`, tokA)).json?.data || [];
  comprobar('…y solo en ese día', soloEseDia.some(f => f.reservationNumber === 'NOCHE1') && !diaSiguiente.some(f => f.reservationNumber === 'NOCHE1'));
  const dePlan = filas.filter(f => f.source === 'plan');
  comprobar('el plan aéreo da sus dos vuelos; el plan en bus no aparece', dePlan.length === 2 && dePlan.every(f => /plan:.*:(ida|regreso)/.test(f.id)), `${dePlan.length} vuelos de plan`);

  const contadores = async () => (await pedir('GET', `/flights/checkins?dateFrom=${dia(0)}&dateTo=${dia(25)}&perPage=1`, tokA)).json?.meta?.counts || {};
  const c = await contadores();
  comprobar('contadores: pendiente + realizado + cancelado = total', c.pendiente + c.realizado + c.cancelado === c.total, JSON.stringify(c));
  comprobar('contadores: crítico ≤ pendiente, y hay 2 críticos (un tramo y un vuelo de plan)', c.critico <= c.pendiente && c.critico === 2, `crítico ${c.critico}`);

  // ── 3. El panel "requiere atención" cuenta también los vuelos de paquete (T7)
  const atencion = (await pedir('GET', '/stats/attention', tokA)).json?.data;
  comprobar('el panel cuenta los check-ins críticos de tiquetes y de paquetes', atencion?.criticalCheckins?.count === 2, `count ${atencion?.criticalCheckins?.count}`);

  // ── 4. Check-in de un tramo
  console.log('\n  Check-in');
  const tramoRt = rt.find(f => f.type === 'ida');
  // Sin correo del cliente el check-in no se le puede enviar, así que no se marca como realizado.
  const sinCorreo = await pedir('PUT', `/flights/${tramoRt.id}/checkin`, tokA, { checkin: 'realizado' });
  const tramoTras = await admin.tramos_vuelo.findUnique({ where: { id: tramoRt.id }, select: { checkin_status: true } });
  comprobar('cliente sin correo: 400 y el tramo sigue pendiente',
    sinCorreo.status === 400 && tramoTras.checkin_status !== 'realizado', `HTTP ${sinCorreo.status}, ${tramoTras.checkin_status}`);
  const conCorreo = await pedir('PUT', `/clients/${cliA.id}`, tokA, { email: 'cliente-vuelos@prueba.local' });
  comprobar('se le registra un correo al cliente', conCorreo.status === 200, `HTTP ${conCorreo.status}`);
  const hecho = await pedir('PUT', `/flights/${tramoRt.id}/checkin`, tokA, { checkin: 'realizado' });
  comprobar('registrar el check-in: realizado', hecho.status === 200 && hecho.json?.data?.checkinStatus === 'realizado' && hecho.json?.data?.emailSent === true, `HTTP ${hecho.status}`);
  const revertido = await pedir('PUT', `/flights/${tramoRt.id}/checkin`, tokA, { checkin: 'pendiente' });
  comprobar('revertirlo: pendiente', revertido.json?.data?.checkinStatus === 'pendiente');
  for (const malo of ['cancelado', 'critico']) {
    comprobar(`no se escribe "${malo}" por el PUT: 400`, (await pedir('PUT', `/flights/${tramoRt.id}/checkin`, tokA, { checkin: malo })).status === 400);
  }
  const corto = await pedir('POST', `/flights/${tramoRt.id}/checkin/cancellation`, tokA, { reasonCanceled: '   abc   ' });
  comprobar('cancelar con un motivo corto (recortado): 422', corto.status === 422, `HTTP ${corto.status}`);
  const cancelado = await pedir('POST', `/flights/${tramoRt.id}/checkin/cancellation`, tokA, { reasonCanceled: '  El cliente cambió la fecha  ' });
  comprobar('cancelar con motivo: cancelado y motivo recortado', cancelado.json?.data?.checkinStatus === 'cancelado' && cancelado.json?.data?.reasonCanceled === 'El cliente cambió la fecha',
    JSON.stringify(cancelado.json?.data?.reasonCanceled));
  comprobar('cancelarlo otra vez: 400', (await pedir('POST', `/flights/${tramoRt.id}/checkin/cancellation`, tokA, { reasonCanceled: 'Otra vez el mismo motivo' })).status === 400);

  // ── 5. Vuelos de paquete: check-in y cancelación (T6)
  console.log('\n  Vuelos de paquete');
  const idaPlan = dePlan.find(f => f.type === 'ida');
  comprobar('un vuelo de plan por su id', (await pedir('GET', `/flights/${encodeURIComponent(idaPlan.id)}`, tokA)).json?.data?.id === idaPlan.id);
  const planHecho = await pedir('PUT', `/flights/${encodeURIComponent(idaPlan.id)}/checkin`, tokA, { checkin: 'realizado' });
  comprobar('check-in de un vuelo de plan', planHecho.json?.data?.checkinStatus === 'realizado', `HTTP ${planHecho.status}`);
  const planCancelado = await pedir('POST', `/flights/${encodeURIComponent(idaPlan.id)}/checkin/cancellation`, tokA, { reasonCanceled: 'Cambio de fecha del paquete' });
  comprobar('cancelar un vuelo de plan con motivo (antes: 400 "falta la columna")',
    planCancelado.status === 200 && planCancelado.json?.data?.checkinStatus === 'cancelado' && planCancelado.json?.data?.reasonCanceled === 'Cambio de fecha del paquete',
    `HTTP ${planCancelado.status} ${JSON.stringify(planCancelado.json?.error)}`);
  const enLista = ((await pedir('GET', `/flights/checkins?status=cancelado&perPage=50`, tokA)).json?.data || []).find(f => f.id === idaPlan.id);
  comprobar('el vuelo de plan cancelado sale en la lista con su motivo', enLista?.reasonCanceled === 'Cambio de fecha del paquete');
  const detallePlan = (await pedir('GET', `/sales/${planes.json.data.id}/products/plan`, tokA)).json?.data?.[0];
  comprobar('el detalle de la venta trae el motivo', detallePlan?.checkinStatusOutbound === 'cancelado' && detallePlan?.checkinReasonOutbound === 'Cambio de fecha del paquete');
  const planRevertido = await pedir('PUT', `/flights/${encodeURIComponent(idaPlan.id)}/checkin`, tokA, { checkin: 'pendiente' });
  const trasRevertir = (await pedir('GET', `/flights/${encodeURIComponent(idaPlan.id)}`, tokA)).json?.data;
  comprobar('volver a pendiente borra la cancelación', planRevertido.status === 200 && trasRevertir?.checkin === 'pendiente' && trasRevertir?.reasonCanceled === null);

  // ── 6. Cuatro check-ins a la vez sobre el mismo tiquete (T1)
  console.log('\n  Check-ins simultáneos');
  const tramosMulti = (await pedir('GET', `/flights?dateFrom=${dia(13)}&dateTo=${dia(17)}&search=MULTI1`, tokA)).json?.data || [];
  let bien = 0;
  for (let ronda = 0; ronda < 2; ronda++) {
    await Promise.all(tramosMulti.map(f => pedir('PUT', `/flights/${f.id}/checkin`, tokA, { checkin: 'realizado' })));
    const producto = await admin.prod_tiqueteria.findFirst({ where: { nro_reserva: 'MULTI1', empresa_id: A.id }, select: { checkin_status: true } });
    if (producto?.checkin_status === 'realizado') bien++;
    await Promise.all(tramosMulti.map(f => pedir('PUT', `/flights/${f.id}/checkin`, tokA, { checkin: 'pendiente' })));
  }
  comprobar('con los 4 tramos hechos a la vez, el producto queda realizado (2 de 2 rondas)', tramosMulti.length === 4 && bien === 2, `${bien}/2 con ${tramosMulti.length} tramos`);

  // ── 7. Otra agencia, ids y búsqueda
  console.log('\n  Otra agencia e ids');
  comprobar('un tramo de A pedido desde B: 404', (await pedir('GET', `/flights/${tramoRt.id}`, tokB)).status === 404);
  comprobar('el check-in de un tramo de A desde B: 404', (await pedir('PUT', `/flights/${tramoRt.id}/checkin`, tokB, { checkin: 'realizado' })).status === 404);
  comprobar('un vuelo de plan de A desde B: 404', (await pedir('GET', `/flights/${encodeURIComponent(idaPlan.id)}`, tokB)).status === 404);
  comprobar('B no ve vuelos de A', ((await pedir('GET', `/flights?dateFrom=${dia(0)}&dateTo=${dia(25)}&perPage=100`, tokB)).json?.data || []).length === 0);
  comprobar('un id mal formado: 400', (await pedir('GET', '/flights/no-es-un-id', tokA)).status === 400);
  comprobar('una búsqueda con dos palabras no da 500', una((await pedir('GET', '/flights/checkins?search=Viajero%20Prueba', tokA)).status, 200));

  // ── 8. Una venta anulada sale del calendario y de los contadores
  console.log('\n  Venta anulada');
  const anular = await pedir('POST', `/sales/${critico.json.data.id}/cancellation`, tokA, { reason: 'Prueba de vuelos: anular' });
  const trasAnular = await pedir('GET', `/flights?dateFrom=${dia(0)}&dateTo=${dia(25)}&perPage=100`, tokA);
  const cTras = await contadores();
  comprobar('sus vuelos desaparecen del calendario y de los contadores',
    una(anular.status, 200, 201) && !(trasAnular.json?.data || []).some(f => f.reservationNumber === 'CRIT01') && cTras.total === c.total - 1,
    `total ${c.total} -> ${cTras.total}`);

  // ── 9. Una venta de grupo se escribe por lotes (spec 010 T5): el tiempo no crece con las filas
  console.log('\n  Venta de grupo');
  const grupo = (k) => tiquete(
    [tramo('BOG', 'MDE', 14 + k), tramo('MDE', 'CTG', 14 + k, '12:00'), tramo('CTG', 'BAQ', 15 + k), tramo('BAQ', 'SMR', 15 + k, '15:00'),
      tramo('SMR', 'CLO', 16 + k), tramo('CLO', 'BOG', 16 + k, '18:00')],
    { reservationNumber: `GRUPO${k}`, passengers: pax(8, 40 + k) });
  const inicio = Date.now();
  const ventaGrupo = await vender(tokA, cliA, { ticketData: [grupo(0), grupo(1), grupo(2)] });
  const segundos = (Date.now() - inicio) / 1000;
  const lineas = await admin.detalle_venta.findMany({
    where: { venta_id: ventaGrupo.json?.data?.id },
    include: { prod_tiqueteria: { include: { tramos_vuelo: true } }, pasajeros_detalle: true },
  });
  comprobar('3 tiquetes de 6 tramos y 8 pasajeros: 201, con todas sus filas y en menos de 15 s',
    ventaGrupo.status === 201 && lineas.length === 3
      && lineas.every(l => l.prod_tiqueteria?.tramos_vuelo.length === 6 && l.pasajeros_detalle.length === 8) && segundos < 15,
    `HTTP ${ventaGrupo.status}, ${segundos.toFixed(1)} s`);
}

ejecutar('Vuelos y check-in por la API', PREFIJO, main);
