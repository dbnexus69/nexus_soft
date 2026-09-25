const crypto = require('crypto');
const { verifyToken, VENTANA_INACTIVIDAD_MS } = require('../utils/tokenUtils');
const prisma = require('../config/db');
const { error } = require('../utils/apiResponse');
// La caché vive en su propio archivo: quien cierra sesión o cambia una
// contraseña necesita invalidarla sin importar este middleware.
const { AUTH_CACHE, leer, recordar } = require('./authCache');
const { conEmpresa } = require('../config/tenant');

/**
 * Autentica y, sobre todo, **fija la empresa de la petición**.
 *
 * El contexto se abre ANTES de resolver nada contra la base y envuelve al resto
 * de la petición: es lo que leen las políticas para decidir qué filas existen.
 * Sin él, con la RLS encendida, una petición autenticada no vería ni sus
 * propios datos.
 *
 * La empresa sale del token, no de la URL. La URL la lleva para que el enlace
 * sea legible y para saber qué marca pintar, pero quien manda es el token
 * firmado; la comprobación de que una cosa y otra coinciden se hace aparte.
 */
async function auth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return error(res, 'Token de autorización faltante o formato inválido', 401, 'UNAUTHORIZED');
    }

    const token = header.split(' ')[1];
    const decoded = verifyToken(token);

    // Los tokens emitidos antes del multi-tenant no traen empresa. No se les da
    // un valor por defecto: sin empresa no hay contexto, y sin contexto las
    // políticas no dejan ver nada. Es preferible pedir que vuelvan a entrar a
    // dejar que una sesión antigua trabaje sin aislamiento.
    if (decoded.empresaId == null) {
      return error(res, 'La sesión es anterior a la separación por empresas, vuelve a iniciar sesión', 401, 'SESSION_SIN_EMPRESA');
    }
    req.empresaId = decoded.empresaId;
    // Al suplantar, la empresa de trabajo y la del usuario son distintas: el
    // superadministrador trabaja en la agencia ajena, pero su propia fila vive
    // en la suya. Se lee cada cosa en su contexto, y así `usuarios` no necesita
    // una excepción en su política — que le habría dejado ver los usuarios de
    // todas las agencias, con o sin suplantar.
    const empresaDelUsuario = decoded.empresaOrigen ?? decoded.empresaId;
    // La empresa donde vive la fila del usuario y su sesión. Al suplantar no es
    // la misma que `empresaId`, que es en la que se está trabajando.
    req.empresaOrigen = empresaDelUsuario;
    req.suplantacion = decoded.suplantacion ?? null;
    // El mismo hash que guarda `login`. La sesión se identifica por él, así que
    // la caché se indexa igual y una sesión cerrada se puede olvidar sola.
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // La bandera de superadministrador sale del token porque hace falta ANTES de
    // poder leer la base: la política de `empresas` la necesita para dejar leer.
    // No concede nada por sí sola —las 42 tablas de negocio siguen cerradas— y
    // los endpoints que sí dependen de ella la vuelven a comprobar contra la
    // fila del usuario, que es la que manda.
    return conEmpresa(empresaDelUsuario, async () => {
      // 1. Revisar si esta sesión está en RAM Cache
      const cached = leer(tokenHash);
      if (cached) {
        req.user = cached;
        return conEmpresa(decoded.empresaId, () => next(), { esSuperadmin: decoded.role === 'superadmin' });
      }

      // 2. La sesión tiene que existir en la base y estar en plazo.
      //
      // Sin esta comprobación el JWT era irrevocable: `logout` no borraba nada,
      // y aunque lo hubiera borrado el token seguía valiendo hasta caducar.
      // Una contraseña cambiada o un usuario dado de baja tampoco cortaban las
      // sesiones abiertas. Ahora la fila de `sesiones` es lo que manda.
      //
      // Y en el mismo viaje se RENUEVA: la sesión caduca tras 30 minutos sin
      // actividad, no a los 30 minutos de entrar. Solo se llega aquí cuando la
      // caché (5 min) no tiene la sesión, así que un usuario activo la alarga
      // cada pocos minutos sin una escritura por petición. `GREATEST` no acorta
      // nunca: una sesión con "recordarme" (7 días) queda igual. El JWT sigue
      // caducando a su hora (1 día, o 1 hora al suplantar), así que la
      // renovación no estira una sesión más allá de su token.
      const [sesion] = await prisma.$queryRaw`
        UPDATE sesiones
           SET expires_at = GREATEST(expires_at, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${VENTANA_INACTIVIDAD_MS / 1000}))
         WHERE usuario_id = ${decoded.userId}
           AND token_hash = ${tokenHash}
           AND expires_at > (now() AT TIME ZONE 'UTC')
        RETURNING id`;
      if (!sesion) {
        return error(res, 'La sesión ya no es válida, vuelve a iniciar sesión', 401, 'SESSION_REVOKED');
      }

      // 3. Si no está en caché, consultar a Supabase (viaje pesado)
      const usuario = await prisma.usuarios.findUnique({
        where: { id: decoded.userId },
        include: {
          personas: true,
          roles: {
            include: {
              permisos_rol: { include: { permisos: true } }
            }
          },
        }
      });

      if (!usuario || usuario.status === 'inactive') {
        return error(res, 'Usuario no encontrado o inactivo', 401, 'USER_INACTIVE');
      }

      const userData = {
        id: usuario.id,
        persona_id: usuario.persona_id,
        email: usuario.email,
        nombre: `${usuario.personas.nombres} ${usuario.personas.apellidos}`,
        avatar_url: usuario.personas.avatar_url,
        role: usuario.roles.nombre,
        // La empresa a la que PERTENECE el usuario, que no es la que se está
        // visitando al suplantar. Se guarda para poder invalidar la caché de una
        // agencia entera: suspenderla borra sus filas de `sesiones`, pero sin
        // esto no había forma de tirar las entradas ya cacheadas y quien
        // estuviera dentro seguía trabajando hasta que expirasen.
        empresa_id: usuario.empresa_id,
        permisos_rol: usuario.roles.permisos_rol.map(pr => ({
          modulo: pr.permisos.modulo,
          accion: pr.permisos.accion,
          valor: pr.valor
        })),

      };

      // 4. Guardar en RAM Cache para la próxima vez
      recordar(tokenHash, userData);

      req.user = userData;
      // A partir de aquí se trabaja en la empresa de destino. Si no se suplanta,
      // es la misma y esto no cambia nada.
      return conEmpresa(decoded.empresaId, () => next(), { esSuperadmin: decoded.role === 'superadmin' });
    }, { esSuperadmin: decoded.role === 'superadmin' });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return error(res, 'Token inválido o expirado', 401, 'INVALID_TOKEN');
    }
    next(err);
  }
}

module.exports = auth;
module.exports.AUTH_CACHE = AUTH_CACHE;
