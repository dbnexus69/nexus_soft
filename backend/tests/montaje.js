/**
 * El montaje que comparten las pruebas por la API (`aislamiento-api.js`, `vuelos-api.js`).
 *
 * Levanta un servidor propio en otro puerto (`TEST_PORT`, 3917 por defecto) con el rol de la
 * aplicación, monta agencias con el servicio real de altas y, al terminar, lo desmonta todo
 * —agencias, usuarios, ficheros subidos— pase lo que pase. Solo toca agencias cuyo slug empieza
 * por el prefijo de cada prueba.
 *
 * Necesita `DATABASE_URL` (rol `app_nexus`) y `DIRECT_URL` (para montar y desmontar).
 */
require('dotenv').config();
const { spawn, spawnSync } = require('child_process');
const net = require('net');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient, Prisma } = require('@prisma/client');
const companiesService = require('../src/services/companies.service');
const { sinEmpresa } = require('../src/config/tenant');

const PUERTO = Number(process.env.TEST_PORT) || 3917;
const BASE = `http://127.0.0.1:${PUERTO}`;
const API = `${BASE}/api/v1`;
const CLAVE = 'Prueba-api-1!';
// Lo que el servidor de prueba sube a Storage va bajo esta carpeta, y se borra entera al desmontar.
const PREFIJO_ALMACEN = 'prueba';
const RAIZ = path.join(__dirname, '..');

const admin = new PrismaClient({
  datasourceUrl: (process.env.DIRECT_URL || process.env.DATABASE_URL || '').split('?')[0],
});

let fallos = 0;
let servidor = null;

const vivo = () => servidor && servidor.exitCode === null && servidor.signalCode === null;

/**
 * Cierra el servidor de prueba y espera a que salga. En Windows `kill()` no siempre lo cerraba y
 * quedaba escuchando en el puerto: la prueba siguiente se colgaba esperando el suyo. `taskkill /T /F`
 * cierra el proceso y lo que haya abierto.
 */
function pararServidor() {
  if (!vivo()) return Promise.resolve();
  return new Promise((resolver) => {
    servidor.once('exit', resolver);
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' });
    else servidor.kill();
    setTimeout(resolver, 5000);
  });
}

// Si la prueba muere sin pasar por el `finally` (Ctrl+C, un `timeout`, un error sin capturar), el
// servidor tampoco se queda vivo. En `exit` solo vale lo síncrono.
process.on('exit', () => {
  if (!vivo()) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' });
  else servidor.kill();
});
for (const senal of ['SIGINT', 'SIGTERM']) process.on(senal, () => process.exit(130));

/** Falla en el acto, y diciendo por qué, si el puerto ya está ocupado (otro servidor de prueba vivo). */
function puertoLibre() {
  return new Promise((resolver, rechazar) => {
    const prueba = net.createServer()
      .once('error', () => rechazar(new Error(
        `el puerto ${PUERTO} ya está en uso: probablemente un servidor de prueba anterior sigue vivo. Ciérralo o usa TEST_PORT.`)))
      .once('listening', () => prueba.close(resolver))
      .listen(PUERTO, '127.0.0.1');
  });
}

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
  // El token de sesión ya no va en el cuerpo, solo en la cookie (spec 035); las pruebas lo sacan de ahí.
  const cookie = r.headers.getSetCookie().find((c) => c.startsWith('nexus_sesion=') && !c.startsWith('nexus_sesion=;'));
  return { status: r.status, json, token: cookie ? decodeURIComponent(cookie.split(';')[0].slice('nexus_sesion='.length)) : null };
}

const entrar = async (email) => {
  const r = await pedir('POST', '/auth/login', null, { email, password: CLAVE });
  if (r.status !== 200) throw new Error(`login de ${email}: ${r.status} ${JSON.stringify(r.json?.error)}`);
  return r.token;
};

const una = (status, ...validos) => validos.includes(status);

async function levantarServidor() {
  await puertoLibre();
  servidor = spawn(process.execPath, ['src/index.js'], {
    cwd: RAIZ, env: { ...process.env, PORT: String(PUERTO), EMAIL_SIMULADO: '1', ALMACENAMIENTO_PREFIJO: PREFIJO_ALMACEN }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let salida = '';
  servidor.stderr.on('data', d => { salida += d; });
  await new Promise((resolver, rechazar) => {
    const limite = setTimeout(() => rechazar(new Error(`el servidor no arrancó en 60 s:\n${salida}`)), 60000);
    servidor.stdout.on('data', d => { if (String(d).includes('Servidor corriendo')) { clearTimeout(limite); resolver(); } });
    servidor.on('exit', c => { clearTimeout(limite); rechazar(new Error(`el servidor salió con código ${c}:\n${salida}`)); });
  });
}

async function montarAgencia(prefijo, sufijo) {
  const slug = `${prefijo}${sufijo}-${Date.now()}`;
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
async function desmontar(prefijo) {
  const empresas = await admin.empresas.findMany({ where: { slug: { startsWith: prefijo } }, select: { id: true, slug: true } });
  if (!empresas.length) return;
  const ids = empresas.map(e => e.id);
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
  await limpiarAlmacenamiento(ids);
}

/** Borra de los buckets las carpetas de prueba de esas agencias (hasta dos niveles: `vouchers/<p>/<id>/<venta>/x.pdf`). */
async function limpiarAlmacenamiento(ids) {
  if (!process.env.SUPABASE_URL) return;
  const { storage, BUCKETS } = require('../src/utils/almacenamiento');
  const listar = async (bucket, carpeta) => {
    const { data } = await storage().from(bucket).list(carpeta, { limit: 1000 });
    const rutas = [];
    for (const o of data || []) {
      const ruta = `${carpeta}/${o.name}`;
      if (o.id) rutas.push(ruta); else rutas.push(...await listar(bucket, ruta));
    }
    return rutas;
  };
  for (const bucket of Object.keys(BUCKETS)) {
    for (const id of ids) {
      const rutas = await listar(bucket, `${PREFIJO_ALMACEN}/${id}`);
      if (rutas.length) await storage().from(bucket).remove(rutas);
    }
  }
}

/** Comprueba el rol, desmonta restos de una corrida anterior, corre la prueba y lo deja todo limpio. */
function ejecutar(titulo, prefijo, prueba) {
  (async () => {
    console.log(`\n${titulo}\n`);
    const [app] = await new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })
      .$queryRawUnsafe(`SELECT current_user AS usuario, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS salta`);
    comprobar('DATABASE_URL conecta con un rol que no salta la RLS', app.salta === false, `rol "${app.usuario}"`);
    if (app.salta) return;
    await desmontar(prefijo);
    await prueba();
  })()
    .catch(err => { fallos++; console.error('\n  ✗ la prueba se cortó:', err.message || err); })
    .finally(async () => {
      await pararServidor();
      try { await desmontar(prefijo); console.log('\n  Agencias de prueba desmontadas.'); }
      catch (err) { fallos++; console.error('\n  ✗ no se pudo desmontar:', err.message); }
      await admin.$disconnect();
      console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)\n` : '\nTodo en orden\n');
      process.exit(fallos ? 1 : 0);
    });
}

module.exports = {
  admin, BASE, API, CLAVE, comprobar, pedir, entrar, una,
  levantarServidor, montarAgencia, montarSuperadmin, ventaMinima, ejecutar,
};
