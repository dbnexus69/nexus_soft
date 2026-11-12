#!/usr/bin/env node
/**
 * IVA opcional por servicio (spec 041), por la API real. `pnpm test:iva-opcional`
 *
 * Una venta y una cotización con una línea con IVA y otra sin: el IVA que se guarda por línea, el de la cabecera,
 * el total, que el interruptor se lea de vuelta y que un total que no cuadra se rechace.
 *
 * Levanta su propio servidor y solo toca agencias cuyo slug empieza por `prueba-iva041-`.
 */
const { admin, comprobar, pedir, entrar, levantarServidor, montarAgencia, ventaMinima, ejecutar } = require('./montaje');

const PREFIJO = 'prueba-iva041-';
// TA 500 + costo 1000 → IVA 95; TA 1000 + costo 2000 sin IVA → 0. Total de la venta: 1595 + 3000 = 4595.
const CON_IVA = { reservationName: 'Con IVA', peopleCount: 2, supplierCost: 1000, ta: 500 };
const SIN_IVA = { reservationName: 'Sin IVA', peopleCount: 2, supplierCost: 2000, ta: 1000, incluyeIva: false };

async function main() {
  const A = await montarAgencia(PREFIJO, 'a');
  await levantarServidor();
  const tok = await entrar(A.correo);
  const cliente = (await pedir('POST', '/clients', tok, { firstName: 'Cliente', lastName: 'Iva', docType: 'CC', docNumber: '959041001' })).json?.data;

  console.log('  Venta con una línea con IVA y otra sin');
  const alta = await pedir('POST', '/sales', tok, ventaMinima(cliente.id, { restaurantData: [CON_IVA, SIN_IVA] }));
  comprobar('POST /sales: 201', alta.status === 201, `HTTP ${alta.status} ${JSON.stringify(alta.json?.error || '')}`);
  const ventaId = alta.json?.data?.id;

  const lineas = await admin.detalle_venta.findMany({ where: { venta_id: ventaId }, orderBy: { ta: 'asc' } });
  comprobar('la línea con IVA guarda 95 y el interruptor encendido',
    lineas[0]?.iva === 95 && lineas[0]?.incluye_iva === true, JSON.stringify(lineas[0] && { iva: lineas[0].iva, inc: lineas[0].incluye_iva }));
  comprobar('la línea sin IVA guarda 0 y el interruptor apagado',
    lineas[1]?.iva === 0 && lineas[1]?.incluye_iva === false, JSON.stringify(lineas[1] && { iva: lineas[1].iva, inc: lineas[1].incluye_iva }));

  const cabecera = (await pedir('GET', `/sales/${ventaId}`, tok)).json?.data;
  comprobar('la cabecera suma solo el IVA de la línea que lo lleva', Number(cabecera?.iva) === 95, String(cabecera?.iva));
  comprobar('el total es costo + TA + IVA de cada línea', Number(cabecera?.total) === 4595, String(cabecera?.total));

  const productos = (await pedir('GET', `/sales/${ventaId}/products/restaurant`, tok)).json?.data || [];
  const leido = (nombre) => productos.find(p => Number(p.ta) === nombre)?.incluyeIva;
  comprobar('la venta devuelve el interruptor de cada servicio', leido(500) === true && leido(1000) === false,
    JSON.stringify(productos.map(p => ({ ta: p.ta, incluyeIva: p.incluyeIva }))));

  console.log('\n  El total por producto tiene que cuadrar con su IVA');
  const mal = await pedir('POST', '/sales', tok, ventaMinima(cliente.id, { restaurantData: [{ ...SIN_IVA, total: 3190 }] }));
  comprobar('sin IVA y un total con IVA: 422', mal.status === 422, `HTTP ${mal.status}`);
  const bien = await pedir('POST', '/sales', tok, ventaMinima(cliente.id, { restaurantData: [{ ...SIN_IVA, total: 3000 }] }));
  comprobar('sin IVA y un total sin IVA: 201', bien.status === 201, `HTTP ${bien.status} ${JSON.stringify(bien.json?.error || '')}`);

  console.log('\n  Cotización con una línea con IVA y otra sin');
  const hotel = (ta, extra = {}) => ({ hotelName: 'Hotel Test', destination: 'San Andrés', supplierCost: 0, ta, ...extra });
  const cot = await pedir('POST', '/quotes', tok, { hotelData: [hotel(100000), hotel(200000, { incluyeIva: false })] });
  comprobar('POST /quotes: 201', cot.status === 201, `HTTP ${cot.status} ${JSON.stringify(cot.json?.error || '')}`);
  const leida = (await pedir('GET', `/quotes/${cot.json?.data?.id}`, tok)).json?.data;
  const porTa = (ta) => leida?.lines?.find(l => l.ta === ta);
  comprobar('la línea con IVA lo calcula', porTa(100000)?.iva === 19000, String(porTa(100000)?.iva));
  comprobar('la línea sin IVA queda en 0', porTa(200000)?.iva === 0, String(porTa(200000)?.iva));
  comprobar('al reabrirla, el interruptor vuelve apagado', porTa(200000)?.detalle?.incluyeIva === false);
  const filas = await admin.detalle_cotizacion.findMany({ where: { cotizacion_id: cot.json?.data?.id }, orderBy: { ta: 'asc' } });
  comprobar('la columna guarda lo elegido', filas[0]?.incluye_iva === true && filas[1]?.incluye_iva === false);
}

ejecutar('IVA opcional por servicio (spec 041)', PREFIJO, main);
