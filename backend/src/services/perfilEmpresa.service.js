const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('../config/db');
const { conEmpresa, empresaActual } = require('../config/tenant');
const { NotFoundError, AppError } = require('../errors/AppError');
const almacenamiento = require('../utils/almacenamiento');

/**
 * El perfil de la agencia y su logo (spec 011).
 *
 * Siempre sobre la empresa del contexto (`empresaActual()`), nunca sobre un id de la URL: `empresas` tiene RLS
 * (`empresa_propia`) y cada agencia solo ve y escribe su fila. El superadministrador que suplanta edita la
 * agencia que visita, porque esa es la del contexto.
 */

const LOGO_SEGUNDOS = 3600;
const TIPOS_LOGO = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
// Buckets de logos y de las imágenes de encabezado/pie del voucher: mismo bucket `logos`, mismo patrón
// de nombre con hash de contenido — nunca el mismo nombre dos veces, aunque cambie el contenido.
const BUCKET_IMAGENES = 'logos';

// Campo de la API → columna de `empresas`.
const COLUMNAS = {
  nombreComercial: 'nombre_comercial',
  nit: 'nit',
  direccion: 'direccion',
  telefono: 'telefono',
  emailContacto: 'email_contacto',
  sitioWeb: 'sitio_web',
  colorPrimario: 'color_primario',
  colorAcento: 'color_acento',
  colorRealce: 'color_realce',
  voucherPie: 'voucher_pie',
  voucherTerminos: 'voucher_terminos',
};

/**
 * La URL firmada del logo de una empresa, o null.
 *
 * `logo_url` guarda el nombre dentro de la carpeta de la empresa en el bucket `logos`. Un valor viejo
 * (`/uploads/logos/…`, de antes del bucket) ya no se sirve: se trata como "sin logo" hasta que se suba otro.
 * Un fallo de Storage no tumba la pantalla: sin logo se ve el nombre.
 */
async function urlDelLogo(empresaId, logoUrl) {
  if (!logoUrl || logoUrl.startsWith('/')) return null;
  try {
    return await conEmpresa(empresaId, () => almacenamiento.firmar('logos', logoUrl, LOGO_SEGUNDOS));
  } catch (err) {
    console.warn('[LOGO_SIGN_FAILED]', empresaId, err.message);
    return null;
  }
}

async function empresaDelContexto() {
  const empresa = await prisma.empresas.findFirst({ where: { id: empresaActual(), deleted_at: null } });
  if (!empresa) throw new NotFoundError('Empresa no encontrada');
  return empresa;
}

async function aPerfil(e) {
  return {
    slug: e.slug,
    nombre: e.nombre,
    nombreComercial: e.nombre_comercial,
    nit: e.nit,
    direccion: e.direccion,
    telefono: e.telefono,
    emailContacto: e.email_contacto,
    sitioWeb: e.sitio_web,
    logoUrl: await urlDelLogo(e.id, e.logo_url),
    colorPrimario: e.color_primario,
    colorAcento: e.color_acento,
    colorRealce: e.color_realce,
    voucherPie: e.voucher_pie,
    // null = la agencia no escribió los suyos; el voucher usa los de por defecto.
    voucherTerminos: e.voucher_terminos ?? null,
    // Si hay encabezado propio, reemplaza del todo la banda de color + logo + nombre (decisión del
    // usuario, 2026-11-07); el de pie se suma al texto de `voucherPie`, que sigue aparte.
    voucherEncabezadoImagenUrl: await urlDelLogo(e.id, e.voucher_encabezado_imagen),
    voucherPieImagenUrl: await urlDelLogo(e.id, e.voucher_pie_imagen),
  };
}

async function perfil() {
  return aPerfil(await empresaDelContexto());
}

async function actualizar(datos) {
  const empresa = await empresaDelContexto();
  const data = {};
  for (const [campo, columna] of Object.entries(COLUMNAS)) {
    if (campo in datos) data[columna] = datos[campo];
  }
  // `voucher_terminos` es JSON: el null de la API se guarda como NULL de SQL, no como el JSON `null`.
  if ('voucher_terminos' in data && data.voucher_terminos === null) {
    data.voucher_terminos = Prisma.DbNull;
  }
  const actualizada = await prisma.empresas.update({ where: { id: empresa.id }, data });
  return aPerfil(actualizada);
}

/**
 * Sube una imagen de `empresaId` al bucket `logos` y borra la anterior en esa misma columna.
 *
 * El nombre lleva un hash del contenido: una imagen nueva es un objeto nuevo, y una URL firmada vieja que
 * siga en una pestaña abierta no enseña la nueva con el nombre de la vieja. La usan el logo ("Mi empresa"
 * y `/companies/:id/logo` del superadministrador) y las imágenes de encabezado/pie del voucher (solo
 * "Mi empresa": cada agencia pone las suyas).
 */
async function subirImagen(empresaId, fichero, { campo, columna, prefijo }) {
  if (!fichero?.buffer?.length) {
    throw new AppError('No llegó ningún archivo', 422, 'VALIDATION_ERROR', [{ field: campo, message: 'Elige una imagen' }]);
  }
  const ext = TIPOS_LOGO[fichero.mimetype];
  if (!ext) {
    throw new AppError('La imagen tiene que ser PNG, JPG o WebP', 422, 'VALIDATION_ERROR',
      [{ field: campo, message: 'La imagen tiene que ser PNG, JPG o WebP' }]);
  }
  const empresa = await prisma.empresas.findFirst({ where: { id: Number(empresaId), deleted_at: null } });
  if (!empresa) throw new NotFoundError('Empresa no encontrada');

  const huella = crypto.createHash('sha256').update(fichero.buffer).digest('hex').slice(0, 16);
  const nombre = `${prefijo}-${huella}.${ext}`;
  await conEmpresa(empresa.id, () => almacenamiento.subir(BUCKET_IMAGENES, nombre, fichero.buffer, fichero.mimetype));
  await prisma.empresas.update({ where: { id: empresa.id }, data: { [columna]: nombre } });

  const anterior = empresa[columna];
  if (anterior && anterior !== nombre && !anterior.startsWith('/')) {
    // La imagen nueva ya está guardada; no poder borrar la vieja no es motivo para fallar.
    await conEmpresa(empresa.id, () => almacenamiento.borrar(BUCKET_IMAGENES, anterior))
      .catch(err => console.warn('[OLD_IMAGE_DELETE_FAILED]', empresa.id, err.message));
  }
  return { ...empresa, [columna]: nombre };
}

function guardarLogo(empresaId, fichero) {
  return subirImagen(empresaId, fichero, { campo: 'logo', columna: 'logo_url', prefijo: 'logo' });
}

function guardarImagenEncabezado(empresaId, fichero) {
  return subirImagen(empresaId, fichero, { campo: 'imagen', columna: 'voucher_encabezado_imagen', prefijo: 'encabezado' });
}

function guardarImagenPie(empresaId, fichero) {
  return subirImagen(empresaId, fichero, { campo: 'imagen', columna: 'voucher_pie_imagen', prefijo: 'pie' });
}

module.exports = { perfil, actualizar, guardarLogo, guardarImagenEncabezado, guardarImagenPie, urlDelLogo };
