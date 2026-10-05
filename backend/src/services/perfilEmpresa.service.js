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
 * Sube el logo de `empresaId` al bucket y borra el anterior.
 *
 * El nombre lleva un hash del contenido: un logo nuevo es un objeto nuevo, y una URL firmada vieja que siga
 * en una pestaña abierta no enseña el logo nuevo con el nombre del viejo. Lo usa "Mi empresa" (empresa del
 * contexto) y `/companies/:id/logo` del superadministrador (la que diga la URL, que solo él puede pedir).
 */
async function guardarLogo(empresaId, fichero) {
  if (!fichero?.buffer?.length) {
    throw new AppError('No llegó ningún archivo', 422, 'VALIDATION_ERROR', [{ field: 'logo', message: 'Elige una imagen' }]);
  }
  const ext = TIPOS_LOGO[fichero.mimetype];
  if (!ext) {
    throw new AppError('El logo tiene que ser PNG, JPG o WebP', 422, 'VALIDATION_ERROR',
      [{ field: 'logo', message: 'El logo tiene que ser PNG, JPG o WebP' }]);
  }
  const empresa = await prisma.empresas.findFirst({ where: { id: Number(empresaId), deleted_at: null } });
  if (!empresa) throw new NotFoundError('Empresa no encontrada');

  const huella = crypto.createHash('sha256').update(fichero.buffer).digest('hex').slice(0, 16);
  const nombre = `logo-${huella}.${ext}`;
  await conEmpresa(empresa.id, () => almacenamiento.subir('logos', nombre, fichero.buffer, fichero.mimetype));
  await prisma.empresas.update({ where: { id: empresa.id }, data: { logo_url: nombre } });

  const anterior = empresa.logo_url;
  if (anterior && anterior !== nombre && !anterior.startsWith('/')) {
    // El logo nuevo ya está guardado; no poder borrar el viejo no es motivo para fallar.
    await conEmpresa(empresa.id, () => almacenamiento.borrar('logos', anterior))
      .catch(err => console.warn('[OLD_LOGO_DELETE_FAILED]', empresa.id, err.message));
  }
  return { ...empresa, logo_url: nombre };
}

module.exports = { perfil, actualizar, guardarLogo, urlDelLogo };
