const { createClient } = require('@supabase/supabase-js');
const { AppError } = require('../errors/AppError');
const { empresaActual } = require('../config/tenant');

/**
 * El único sitio que habla con Supabase Storage (spec 011).
 *
 * Los buckets son privados y solo el backend llega a ellos, con la service role key: esa clave salta
 * cualquier política de Storage, así que el aislamiento entre agencias lo pone ESTE archivo. Los nombres
 * que reciben las funciones son relativos y aquí se les antepone siempre la carpeta de la empresa activa
 * (`<empresa_id>/…`), sacada del contexto y nunca de la petición: ningún llamador puede leer, firmar ni
 * escribir en la carpeta de otra agencia. Sin empresa en el contexto, se lanza.
 *
 * `ALMACENAMIENTO_PREFIJO` (solo pruebas) mete todo bajo `<prefijo>/<empresa_id>/…` para poder borrarlo al
 * terminar sin tocar los objetos reales.
 */

const BUCKETS = {
  logos: { public: false, fileSizeLimit: 2 * 1024 * 1024, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] },
  vouchers: { public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ['application/pdf'] },
};

let cliente = null;
function storage() {
  if (!cliente) {
    const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: clave } = process.env;
    if (!url || !clave) throw new AppError('Falta configurar Supabase Storage', 500, 'STORAGE_NOT_CONFIGURED');
    cliente = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return cliente.storage;
}

function carpeta() {
  const empresa = empresaActual();
  if (empresa === null || empresa === undefined) {
    throw new AppError('Storage sin empresa en el contexto', 500, 'STORAGE_WITHOUT_TENANT');
  }
  const prefijo = process.env.ALMACENAMIENTO_PREFIJO;
  return prefijo ? `${prefijo}/${empresa}` : String(empresa);
}

/** La ruta completa dentro del bucket. Rechaza nombres que intenten salirse de la carpeta. */
function ruta(nombre) {
  const limpio = String(nombre).replace(/^\/+/, '');
  if (!limpio || limpio.split('/').some(parte => parte === '..' || parte === '.')) {
    throw new AppError('Nombre de archivo inválido', 400, 'BAD_REQUEST');
  }
  return `${carpeta()}/${limpio}`;
}

function bucketValido(bucket) {
  if (!BUCKETS[bucket]) throw new Error(`Bucket desconocido: ${bucket}`);
  return bucket;
}

function fallo(accion, error) {
  console.error('[STORAGE_FAILED]', accion, error?.message || error);
  return new AppError('El almacenamiento de archivos no responde. Inténtalo de nuevo en un momento.', 502, 'STORAGE_UNAVAILABLE');
}

async function subir(bucket, nombre, contenido, tipo) {
  const { error } = await storage().from(bucketValido(bucket)).upload(ruta(nombre), contenido, { contentType: tipo, upsert: true });
  if (error) throw fallo('upload', error);
}

async function existe(bucket, nombre) {
  const { data, error } = await storage().from(bucketValido(bucket)).exists(ruta(nombre));
  // Un objeto que no existe responde 400/404 sin cuerpo (es un HEAD): eso es "no", no un fallo.
  if (error && [400, 404].includes(Number(error.status))) return false;
  if (error) throw fallo('exists', error);
  return Boolean(data);
}

/** El contenido como Buffer, o null si no existe. */
async function leer(bucket, nombre) {
  const { data, error } = await storage().from(bucketValido(bucket)).download(ruta(nombre));
  if (error) {
    if (error.statusCode === '404' || error.status === 404 || /not found/i.test(error.message || '')) return null;
    throw fallo('download', error);
  }
  return Buffer.from(await data.arrayBuffer());
}

/** URL firmada de solo lectura, válida `segundos`. Con `descarga`, el navegador lo baja con ese nombre. */
async function firmar(bucket, nombre, segundos, { descarga } = {}) {
  const { data, error } = await storage().from(bucketValido(bucket))
    .createSignedUrl(ruta(nombre), segundos, descarga ? { download: descarga } : undefined);
  if (error) throw fallo('sign', error);
  return data.signedUrl;
}

async function borrar(bucket, nombres) {
  const lista = (Array.isArray(nombres) ? nombres : [nombres]).map(ruta);
  if (!lista.length) return;
  const { error } = await storage().from(bucketValido(bucket)).remove(lista);
  if (error) throw fallo('remove', error);
}

module.exports = { BUCKETS, storage, subir, existe, leer, firmar, borrar };
