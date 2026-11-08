#!/usr/bin/env node
/**
 * Lo corregido de la revisión de la spec 039, por la API real. `pnpm test:revision-039`
 *
 * Alta de agencia con la sesión del superadministrador (H21), edición de usuario atómica (H3), auditoría de
 * suplantación (H4), pago con método inexistente (H12), paquetes (H17), dashboard por días de Bogotá (H18) y
 * convertir una cotización (H19), más las decisiones del 2026-11-08: comisión (H7), precio por producto (H6), abonos
 * (H9, H16), eliminar ventas (H10), catálogos compartidos (H15) y cambio de rol (H2).
 *
 * Levanta su propio servidor y solo toca agencias cuyo slug empieza por `prueba-rev039-`.
 */
const { PrismaClient } = require('@prisma/client');
const {
  admin, CLAVE, comprobar, pedir, entrar,
  levantarServidor, montarAgencia, montarSuperadmin, ventaMinima, ejecutar,
} = require('./montaje');

const PREFIJO = 'prueba-rev039-';
const cotizacionMinima = () => ({
  hotelData: [{ hotelName: 'Hotel Test', destination: 'San Andrés', supplierCost: 0, ta: 100000 }],
});

async function main() {
  const A = await montarAgencia(PREFIJO, 'a');
  const B = await montarAgencia(PREFIJO, 'b');
  const C = await montarAgencia(PREFIJO, 'c');
  const H = await montarAgencia(PREFIJO, 'casa');
  const correoSuper = await montarSuperadmin(H);
  const correoOtroSuper = await montarSuperadmin(A);
  await levantarServidor();

  const tokA = await entrar(A.correo);
  const tokB = await entrar(B.correo);
  const tokC = await entrar(C.correo);
  const tokS = await entrar(correoSuper);
  const tokOtroS = await entrar(correoOtroSuper);
  await pedir('PATCH', `/companies/${A.id}`, tokS, { limiteUsuarios: null });

  const crearUsuario = (tok, slug, sufijo, role = 'asesor') => pedir('POST', '/users', tok, {
    firstName: 'Usuario', lastName: 'Prueba', email: `${slug}-${sufijo}@prueba.local`, password: CLAVE, role,
  });

  console.log('  H21 · alta de agencia con la sesión del superadministrador');
  const sufijoAlta = Date.now();
  const cuerpoAlta = {
    slug: `${PREFIJO}alta-${sufijoAlta}`, nombre: 'Agencia Alta', colorPrimario: '#2B2D42',
    admin: { firstName: 'Ana', lastName: 'Admin', email: `${PREFIJO}alta-${sufijoAlta}@prueba.local`, password: CLAVE },
  };
  const alta = await pedir('POST', '/companies', tokS, cuerpoAlta);
  comprobar('POST /companies: 201', alta.status === 201, `HTTP ${alta.status} ${JSON.stringify(alta.json?.error || '')}`);
  const [roles, metodos] = await Promise.all([
    admin.roles.count({ where: { empresa_id: alta.json?.data?.id } }),
    admin.metodos_pago.count({ where: { empresa_id: alta.json?.data?.id } }),
  ]);
  comprobar('nace con 3 roles y 6 métodos de pago', roles === 3 && metodos === 6, `${roles}/${metodos}`);
  comprobar('su admin entra', (await pedir('POST', '/auth/login', null, { email: cuerpoAlta.admin.email, password: CLAVE })).status === 200);
  const sinApellido = await pedir('POST', '/companies', tokS, {
    ...cuerpoAlta, slug: `${PREFIJO}alta2-${sufijoAlta}`,
    admin: { ...cuerpoAlta.admin, email: `${PREFIJO}alta2-${sufijoAlta}@prueba.local`, lastName: 'A' },
  });
  comprobar('un apellido corto: 422 con el mensaje en español',
    sinApellido.status === 422 && /Mínimo 2 caracteres/.test(sinApellido.json?.error?.message || ''), sinApellido.json?.error?.message);

  console.log('\n  H3 · editar un usuario es todo o nada');
  const u1 = (await crearUsuario(tokC, C.slug, 'u1')).json?.data;
  await crearUsuario(tokC, C.slug, 'u2');
  const u3 = (await crearUsuario(tokC, C.slug, 'u3')).json?.data;
  await pedir('PUT', `/users/${u3.id}`, tokC, { status: 'inactive' });
  await crearUsuario(tokC, C.slug, 'u4');
  const sinCupo = await pedir('PUT', `/users/${u3.id}`, tokC, { firstName: 'Cambiado', status: 'active' });
  const filaU3 = await admin.usuarios.findUnique({ where: { id: u3.id }, include: { personas: true } });
  comprobar('reactivar con el plan lleno: 422', sinCupo.status === 422, `HTTP ${sinCupo.status}`);
  comprobar('…y el nombre no cambió', filaU3.personas.nombres !== 'Cambiado' && filaU3.status === 'inactive', filaU3.personas.nombres);
  comprobar('con cupo, editar sigue funcionando', (await pedir('PUT', `/users/${u1.id}`, tokC, { firstName: 'Renombrado' })).status === 200);

  console.log('\n  H4 · auditoría de suplantación');
  const sup = await pedir('POST', `/companies/${B.id}/impersonations`, tokS, { motivo: 'Prueba automática de la revisión' });
  const tokSup = sup.token;
  const idSup = sup.json?.data?.suplantacionId;
  comprobar('terminarla con la empresa equivocada: 404', (await pedir('DELETE', `/companies/${A.id}/impersonations/${idSup}`, tokSup)).status === 404);
  comprobar('terminarla siendo otro superadmin: 404', (await pedir('DELETE', `/companies/${B.id}/impersonations/${idSup}`, tokOtroS)).status === 404);
  comprobar('…y sigue abierta', (await admin.suplantaciones.findUnique({ where: { id: idSup } })).terminada_at === null);
  const yo = (await pedir('GET', '/auth/me', tokSup)).json?.data;
  comprobar('/auth/me da la agencia visitada, la que la pantalla usa para salir', Number(yo?.empresaId) === B.id, String(yo?.empresaId));
  comprobar('salir como lo hace la pantalla: 200', (await pedir('DELETE', `/companies/${yo?.empresaId}/impersonations/${idSup}`, tokSup)).status === 200);
  const caduca = await pedir('POST', `/companies/${B.id}/impersonations`, tokS, { motivo: 'Prueba automática de caducidad' });
  const idCaduca = caduca.json?.data?.suplantacionId;
  const pasado = new Date(Date.now() - 60000);
  await admin.suplantaciones.update({ where: { id: idCaduca }, data: { expira_at: pasado } });
  const historial = (await pedir('GET', '/companies/impersonations?perPage=100', tokS)).json?.data || [];
  const filaCaduca = historial.find(f => f.id === idCaduca);
  comprobar('una caducada sin salir se muestra terminada', Boolean(filaCaduca?.terminadaAt), JSON.stringify(filaCaduca?.terminadaAt));
  comprobar('…sin escribir en la base', (await admin.suplantaciones.findUnique({ where: { id: idCaduca } })).terminada_at === null);

  console.log('\n  H12 · pago con un método que no existe');
  const cliA = (await pedir('POST', '/clients', tokA, { firstName: 'Cliente', lastName: 'Rev', docType: 'CC', docNumber: '959000001' })).json?.data;
  const ventaPago = (await pedir('POST', '/sales', tokA, ventaMinima(cliA.id))).json?.data;
  comprobar('un id de método inexistente: 400', (await pedir('POST', `/sales/${ventaPago.id}/payments`, tokA, { amount: 1, method: 999999 })).status === 400);
  comprobar('…y no se guardó ningún pago', (await admin.pagos_venta.count({ where: { venta_id: ventaPago.id } })) === 0);

  console.log('\n  H17 · editar un paquete es todo o nada');
  const paquete = await pedir('POST', '/config/packages', tokA, {
    name: 'Paquete Rev', destination: 'Cartagena', nights: 3, accommodation: { hotel: 'Hotel Rev' }, rates: { adult: 100, child: 50 },
  });
  comprobar('se crea el paquete', paquete.status === 201, `HTTP ${paquete.status} ${JSON.stringify(paquete.json?.error || '')}`);
  const idPaquete = paquete.json?.data?.id;
  const fallida = await pedir('PUT', `/config/packages/${idPaquete}`, tokA, {
    name: 'Paquete Rev', destination: 'Cartagena', accommodation: { hotel: 'Otro' }, rates: { adult: 'no es un número', child: 0 },
  });
  const [hoteles, tarifas] = await Promise.all([
    admin.paquete_hotel.findMany({ where: { paquete_id: idPaquete } }),
    admin.paquete_tarifas.count({ where: { paquete_id: idPaquete } }),
  ]);
  comprobar('una edición que falla no responde 2xx', fallida.status >= 400, `HTTP ${fallida.status}`);
  comprobar('…y conserva hotel y tarifas', hoteles.length === 1 && hoteles[0].hotel_nombre === 'Hotel Rev' && tarifas === 1, `${hoteles.length}/${tarifas}`);
  comprobar('una edición válida los reemplaza', (await pedir('PUT', `/config/packages/${idPaquete}`, tokA, {
    name: 'Paquete Rev', destination: 'Cartagena', accommodation: { hotel: 'Nuevo' }, rates: { adult: 200, child: 0 },
  })).status === 200 && (await admin.paquete_hotel.findMany({ where: { paquete_id: idPaquete } })).map(h => h.hotel_nombre).join() === 'Nuevo');

  console.log('\n  H18 · dashboard por días de Bogotá');
  const cliB = (await pedir('POST', '/clients', tokB, { firstName: 'Cliente', lastName: 'Dia', docType: 'CC', docNumber: '959000002' })).json?.data;
  const ventaDia = (await pedir('POST', '/sales', tokB, ventaMinima(cliB.id))).json?.data;
  // El 10 a las 04:30 UTC todavía es el 9 a las 23:30 en Bogotá.
  await admin.ventas.update({ where: { id: ventaDia.id }, data: { creado_at: new Date('2026-03-10T04:30:00.000Z') } });
  const operaciones = async (dia) => (await pedir('GET', `/stats/dashboard?dateFrom=${dia}&dateTo=${dia}`, tokB)).json?.data?.totalOperations;
  comprobar('cuenta en su día de Bogotá', (await operaciones('2026-03-09')) === 1, String(await operaciones('2026-03-09')));
  comprobar('y no en el día UTC', (await operaciones('2026-03-10')) === 0, String(await operaciones('2026-03-10')));
  const iva = async (dia) => (await pedir('GET', `/stats/iva?dateFrom=${dia}&dateTo=${dia}`, tokB)).json?.meta?.total;
  comprobar('el desglose de IVA usa los mismos días', (await iva('2026-03-09')) === 1 && (await iva('2026-03-10')) === 0, `${await iva('2026-03-09')}/${await iva('2026-03-10')}`);
  comprobar('un ISO de una pestaña vieja no da 500',
    (await pedir('GET', '/stats/dashboard?dateFrom=2026-03-09T05:00:00.000Z&dateTo=2026-03-10T04:59:59.999Z', tokB)).status < 500);

  console.log('\n  H19 · convertir una cotización');
  const aceptada = async (tok) => {
    const id = (await pedir('POST', '/quotes', tok, cotizacionMinima())).json?.data?.id;
    await pedir('POST', `/quotes/${id}/send`, tok);
    await pedir('POST', `/quotes/${id}/respond`, tok, { accepted: true });
    return id;
  };
  const ventasDeA = () => admin.ventas.count({ where: { empresa_id: A.id } });
  comprobar('el endpoint suelto ya no existe: 404', (await pedir('PATCH', `/quotes/1/link-sale`, tokA, { saleId: 1 })).status === 404);

  const q1 = await aceptada(tokA);
  const convertida = await pedir('POST', '/sales', tokA, ventaMinima(cliA.id, { quoteId: q1 }));
  comprobar('convertir una aceptada: 201 y queda enlazada',
    convertida.status === 201 && (await admin.cotizaciones.findUnique({ where: { id: q1 } })).venta_id === convertida.json?.data?.id, `HTTP ${convertida.status}`);
  let antes = await ventasDeA();
  comprobar('convertirla otra vez: 409', (await pedir('POST', '/sales', tokA, ventaMinima(cliA.id, { quoteId: q1 }))).status === 409);
  comprobar('…y no se creó otra venta', (await ventasDeA()) === antes);

  const borrador = (await pedir('POST', '/quotes', tokA, cotizacionMinima())).json?.data?.id;
  comprobar('una sin aceptar: 409', (await pedir('POST', '/sales', tokA, ventaMinima(cliA.id, { quoteId: borrador }))).status === 409);
  comprobar('…y tampoco crea venta', (await ventasDeA()) === antes);

  await crearUsuario(tokA, A.slug, 'asesor');
  const tokAsesor = await entrar(`${A.slug}-asesor@prueba.local`);
  const cliAsesor = (await pedir('POST', '/clients', tokAsesor, { firstName: 'Cliente', lastName: 'Asesor', docType: 'CC', docNumber: '959000003' })).json?.data;
  const deOtro = await aceptada(tokA);
  antes = await ventasDeA();
  comprobar('un asesor no convierte la de otro: 409', (await pedir('POST', '/sales', tokAsesor, ventaMinima(cliAsesor.id, { quoteId: deOtro }))).status === 409);
  comprobar('…sin venta y sin enlace', (await ventasDeA()) === antes && (await admin.cotizaciones.findUnique({ where: { id: deOtro } })).venta_id === null);
  const propia = await aceptada(tokAsesor);
  comprobar('un asesor convierte la suya: 201', (await pedir('POST', '/sales', tokAsesor, ventaMinima(cliAsesor.id, { quoteId: propia }))).status === 201);
  comprobar('una venta normal, sin cotización, sigue igual: 201', (await pedir('POST', '/sales', tokA, ventaMinima(cliA.id))).status === 201);

  console.log('\n  H15 · catálogos compartidos');
  const unaAerolinea = await admin.aerolineas.findFirst({ select: { id: true } });
  const estadoDe = async (metodo, ruta, tok, cuerpo) => (await pedir(metodo, ruta, tok, cuerpo)).status;
  comprobar('un admin no crea una aerolínea: 403', (await estadoDe('POST', '/config/airlines', tokA, { name: 'Aerolinea Rev', code: 'Q7' })) === 403);
  comprobar('…ni un aeropuerto: 403', (await estadoDe('POST', '/config/airports', tokA, { name: 'Aeropuerto Rev', abbreviation: 'ZZQ' })) === 403);
  comprobar('…ni un tipo de documento: 403', (await estadoDe('POST', '/config/document-types', tokA, { name: 'Tipo Rev', abbreviation: 'R39' })) === 403);
  comprobar('…ni edita uno: 403', (await estadoDe('PUT', `/config/airlines/${unaAerolinea.id}`, tokA, { name: 'Cambiada' })) === 403);
  comprobar('…ni lo borra: 403', (await estadoDe('DELETE', `/config/airlines/${unaAerolinea.id}`, tokA)) === 403);
  comprobar('leerlos sigue abierto: 200', (await estadoDe('GET', '/config/airlines', tokA)) === 200);
  comprobar('sus proveedores, que son suyos, sí: 201', (await estadoDe('POST', '/config/suppliers', tokA, { name: 'Proveedor Rev' })) === 201);
  const creada = await pedir('POST', '/config/airlines', tokS, { name: 'Aerolinea Rev', code: 'Q7' });
  comprobar('el superadmin crea una: 201', creada.status === 201, `HTTP ${creada.status} ${JSON.stringify(creada.json?.error || '')}`);
  comprobar('…y la borra: 204', (await estadoDe('DELETE', `/config/airlines/${creada.json?.data?.id}`, tokS)) === 204);
  const app = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  try {
    const [{ n }] = await app.$queryRawUnsafe('SELECT count(*)::int AS n FROM aerolineas');
    comprobar('en la base, el rol de la aplicación las lee', n > 0, String(n));
    let rechazo = '';
    await app.$executeRawUnsafe(`INSERT INTO aerolineas (nombre, codigo_iata) VALUES ('Sin permiso', 'Q8')`).catch((e) => { rechazo = e.message; });
    comprobar('…y sin ser superadmin la base rechaza escribir', /row-level security/i.test(rechazo), rechazo.slice(0, 120));
  } finally {
    await app.$disconnect();
  }

  console.log('\n  H2 · cambio de rol');
  const degradado = (await crearUsuario(tokA, A.slug, 'degradado', 'admin')).json?.data;
  const tokDegradado = await entrar(`${A.slug}-degradado@prueba.local`);
  comprobar('como admin lista usuarios: 200', (await estadoDe('GET', '/users', tokDegradado)) === 200);
  const tokOtroSuperA = await entrar(correoOtroSuper);
  await pedir('PUT', `/users/${degradado.id}`, tokOtroSuperA, { role: 'asesor' });
  comprobar('al bajarlo a asesor deja de poder, sin esperar: 403', (await estadoDe('GET', '/users', tokDegradado)) === 403);
  comprobar('…y sigue con su sesión: 200', (await estadoDe('GET', '/auth/me', tokDegradado)) === 200);

  console.log('\n  H6 · precio por producto');
  const conPrecio = (extra) => ventaMinima(cliA.id, { restaurantData: [{ reservationName: 'X', peopleCount: 2, supplierCost: 1000, ta: 500, ...extra }] });
  const noCuadra = await pedir('POST', '/sales', tokA, conPrecio({ total: 1 }));
  comprobar('un total que no cuadra: 422 en su campo', noCuadra.status === 422 && (noCuadra.json?.error?.details || []).some(d => d.field === 'restaurantData.0.total'), `HTTP ${noCuadra.status}`);
  comprobar('un subtotal que no cuadra: 422', (await pedir('POST', '/sales', tokA, conPrecio({ subtotal: 999 }))).status === 422);
  comprobar('uno que cuadra (costo + TA + IVA): 201', (await pedir('POST', '/sales', tokA, conPrecio({ total: 1595 }))).status === 201);

  console.log('\n  H7 · comisión');
  const agente = (await pedir('POST', '/commissions/agents', tokA, { name: 'Comisionista Rev', type: 'freelance', docType: 'CC', docNumber: '959000009', paymentThreshold: 1 })).json?.data;
  const conComision = await pedir('POST', '/sales', tokA, ventaMinima(cliA.id, {
    commissionAgentId: agente.id, commissionAgentAmount: 100, commissionAgentRetentionPercentage: 10, commissionAgentNetPayment: 999999,
  }));
  const idCom = conComision.json?.data?.id;
  comprobar('el neto lo calcula el servidor', (await admin.ventas.findUnique({ where: { id: idCom } })).monto_comision_neto === 90, `HTTP ${conComision.status}`);
  antes = await ventasDeA();
  comprobar('un bruto mayor que la TA: 400', (await pedir('POST', '/sales', tokA, ventaMinima(cliA.id, { commissionAgentId: agente.id, commissionAgentAmount: 501 }))).status === 400);
  comprobar('…y no crea la venta', (await ventasDeA()) === antes);
  comprobar('al editar también se recalcula', (await pedir('PUT', `/sales/${idCom}`, tokA, { commissionAgentAmount: 200, commissionAgentRetentionPercentage: 50, commissionAgentNetPayment: 5 })).status === 200
    && (await admin.ventas.findUnique({ where: { id: idCom } })).monto_comision_neto === 100);
  comprobar('al editar, un bruto mayor que la TA: 400', (await pedir('PUT', `/sales/${idCom}`, tokA, { commissionAgentAmount: 501 })).status === 400);

  console.log('\n  H9 y H16 · borrar abonos');
  const idPagoDe = async (idVenta, tok) => (await pedir('GET', `/sales/${idVenta}/payments`, tok)).json?.data?.[0]?.id;
  const abonada = (await pedir('POST', '/sales', tokAsesor, ventaMinima(cliAsesor.id, { payments: [{ amount: 500 }] }))).json?.data;
  const pagoAbonada = await idPagoDe(abonada.id, tokAsesor);
  comprobar('un asesor no borra un abono de su venta: 403', (await estadoDe('DELETE', `/sales/${abonada.id}/payments/${pagoAbonada}`, tokAsesor)) === 403);
  comprobar('…y el abono sigue', (await admin.pagos_venta.count({ where: { venta_id: abonada.id } })) === 1);
  comprobar('un admin sí: 200', (await estadoDe('DELETE', `/sales/${abonada.id}/payments/${pagoAbonada}`, tokA)) === 200);
  const pagada = (await pedir('POST', '/sales', tokA, ventaMinima(cliA.id, { payments: [{ amount: 1595 }] }))).json?.data;
  const pagoPagada = await idPagoDe(pagada.id, tokA);
  comprobar('de una venta pagada no se borra: 400', (await estadoDe('DELETE', `/sales/${pagada.id}/payments/${pagoPagada}`, tokA)) === 400);
  await pedir('PATCH', `/sales/${pagada.id}/review-status`, tokA, { isReviewed: true });
  comprobar('…ni si ya está revisada: 400', (await estadoDe('DELETE', `/sales/${pagada.id}/payments/${pagoPagada}`, tokA)) === 400);
  const filaPagada = await admin.ventas.findUnique({ where: { id: pagada.id } });
  comprobar('…y sigue pagada y revisada', filaPagada.status === 'pagado' && filaPagada.is_reviewed === true, `${filaPagada.status}/${filaPagada.is_reviewed}`);

  console.log('\n  H10 · eliminar ventas');
  comprobar('eliminar una venta ya no existe: 404', (await estadoDe('DELETE', `/sales/${pagada.id}`, tokA)) === 404);
  comprobar('…y la venta sigue viva', (await admin.ventas.findUnique({ where: { id: pagada.id } })).deleted_at === null);
  comprobar('anular sigue funcionando: 200', (await pedir('POST', `/sales/${abonada.id}/cancellation`, tokA, { reason: 'Prueba de la revisión' })).status === 200);
}

ejecutar('Revisión de la spec 039', PREFIJO, main);
