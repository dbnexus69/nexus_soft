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
require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient, Prisma } = require('@prisma/client');
const companiesService = require('../src/services/companies.service');
const { sinEmpresa } = require('../src/config/tenant');

const PREFIJO = 'prueba-api-';
const PUERTO = Number(process.env.TEST_PORT) || 3917;
const BASE = `http://127.0.0.1:${PUERTO}`;
const API = `${BASE}/api/v1`;
const CLAVE = 'Prueba-api-1!';
const RAIZ = path.join(__dirname, '..');

const admin = new PrismaClient({
  datasourceUrl: (process.env.DIRECT_URL || process.env.DATABASE_URL || '').split('?')[0],
});

let fallos = 0;
let servidor = null;

function comprobar(descripcion, condicion, detalle = '') {
  const ok = Boolean(condicion);
  if (!ok) fallos++;
  console.log(`  ${ok ? '✓' : '✗'} ${descripcion}${detalle ? `  → ${detalle}` : ''}`);
}

/** Una petición; devuelve `{ status, json }` sin lanzar por un 4xx. */
async function pedir(metodo, ruta, token, cuerpo, { base = API, form } = {}) {
  const cabeceras = {};
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  let body;
  if (form) body = form;
  else if (cuerpo !== undefined) { cabeceras['Content-Type'] = 'application/json'; body = JSON.stringify(cuerpo); }
  const r = await fetch(base + ruta, { method: metodo, headers: cabeceras, body });
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

const entrar = async (email) => {
  const r = await pedir('POST', '/auth/login', null, { email, password: CLAVE });
  if (r.status !== 200) throw new Error(`login de ${email}: ${r.status} ${JSON.stringify(r.json?.error)}`);
  return r.json.data.token;
};

const una = (status, ...validos) => validos.includes(status);

// ── Montaje ────────────────────────────────────────────────────────────────

async function levantarServidor() {
  servidor = spawn(process.execPath, ['src/index.js'], {
    cwd: RAIZ, env: { ...process.env, PORT: String(PUERTO) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let salida = '';
  servidor.stderr.on('data', d => { salida += d; });
  await new Promise((resolver, rechazar) => {
    const limite = setTimeout(() => rechazar(new Error(`el servidor no arrancó en 60 s:\n${salida}`)), 60000);
    servidor.stdout.on('data', d => { if (String(d).includes('Servidor corriendo')) { clearTimeout(limite); resolver(); } });
    servidor.on('exit', c => { clearTimeout(limite); rechazar(new Error(`el servidor salió con código ${c}:\n${salida}`)); });
  });
}

async function montarAgencia(sufijo) {
  const slug = `${PREFIJO}${sufijo}-${Date.now()}`;
  const correo = `${slug}@prueba.local`;
  // Como lo hace el superadministrador: sin empresa, pero con ese permiso, que
  // es lo que la política de `empresas` pide para dejar crear una.
  await sinEmpresa(() => companiesService.create({
    slug, nombre: `Agencia ${sufijo}`,
    admin: { firstName: 'Admin', lastName: sufijo, email: correo, password: CLAVE },
  }), { esSuperadmin: true });
  const empresa = await admin.empresas.findFirst({ where: { slug } });
  return { slug, correo, id: empresa.id };
}

/** Un superadministrador de prueba, dentro de la agencia A (como el real). */
async function montarSuperadmin(A) {
  const rol = await admin.roles.create({ data: { empresa_id: A.id, nombre: 'superadmin' } });
  const persona = await admin.personas.create({
    data: { empresa_id: A.id, nombres: 'Super', apellidos: 'Prueba', email: `${A.slug}-super@prueba.local`, status: 'active' },
  });
  await admin.usuarios.create({
    data: {
      empresa_id: A.id, persona_id: persona.id, email: `${A.slug}-super@prueba.local`,
      password_hash: await bcrypt.hash(CLAVE, 4), rol_id: rol.id, status: 'active',
    },
  });
  return `${A.slug}-super@prueba.local`;
}

const ventaMinima = (clienteId, extra = {}) => ({
  clientId: clienteId, total: 1, status: 'credito', creditDueDate: '2027-12-31T00:00:00.000Z',
  restaurantData: [{ reservationName: 'Prueba', peopleCount: 2, supplierCost: 1000, ta: 500 }],
  ...extra,
});

/** Todo lo que cuelga de las agencias de prueba, y los ficheros que subieron. */
async function desmontar() {
  const empresas = await admin.empresas.findMany({ where: { slug: { startsWith: PREFIJO } }, select: { id: true, slug: true } });
  if (!empresas.length) return;
  const ids = empresas.map(e => e.id);
  const subidos = await admin.detalle_venta.findMany({
    where: { empresa_id: { in: ids }, voucher_url: { not: null } }, select: { voucher_url: true },
  });
  const tablas = Prisma.dmmf.datamodel.models
    .filter(m => m.name !== 'empresas' && m.fields.some(f => f.name === 'empresa_id')).map(m => m.name);
  // Pasadas repetidas sobre TODAS las agencias a la vez: una suplantación vive
  // en la agencia visitada pero cuelga del superadministrador de otra, y borrar
  // las agencias de una en una se atascaba en esa clave ajena.
  for (let pasada = 0; pasada < 10; pasada++) {
    let pendientes = 0;
    for (const t of tablas) {
      try { await admin[t].deleteMany({ where: { empresa_id: { in: ids } } }); } catch { pendientes++; }
    }
    if (!pendientes) break;
  }
  await admin.empresas.deleteMany({ where: { id: { in: ids } } });
  for (const { voucher_url } of subidos) {
    try { fs.unlinkSync(path.join(RAIZ, 'uploads', path.basename(voucher_url))); } catch { /* ya no está */ }
  }
}

// ── La prueba ──────────────────────────────────────────────────────────────

async function main() {
  console.log('\nAislamiento por la API\n');

  const [rol] = await admin.$queryRawUnsafe(`SELECT current_user AS usuario`);
  const [app] = await new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })
    .$queryRawUnsafe(`SELECT current_user AS usuario, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS salta`);
  comprobar('DATABASE_URL conecta con un rol que no salta la RLS', app.salta === false, `rol "${app.usuario}" (migraciones: "${rol.usuario}")`);
  if (app.salta) return;

  await desmontar(); // por si una corrida anterior murió a medias
  console.log('  Montando dos agencias y arrancando el servidor…');
  const A = await montarAgencia('a');
  const B = await montarAgencia('b');
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
    comprobar('suplantando B ve las ventas de B y solo esas', idsSup.length === 1 && idsSup[0] === ventaB.id, `${idsSup.length} filas`);
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

main()
  .catch(err => { fallos++; console.error('\n  ✗ la prueba se cortó:', err.message || err); })
  .finally(async () => {
    if (servidor) servidor.kill();
    try { await desmontar(); console.log('\n  Agencias de prueba desmontadas.'); }
    catch (err) { fallos++; console.error('\n  ✗ no se pudo desmontar:', err.message); }
    await admin.$disconnect();
    console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)\n` : '\nTodo en orden\n');
    process.exit(fallos ? 1 : 0);
  });
