const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { AUTH_CACHE } = require('../middleware/auth');

/**
 * Lo que se puede configurar por rol. Es la ÚNICA lista: `getPermissions`
 * deriva los módulos de aquí en vez de repetirlos.
 *
 * `responsables`, `users` y `config` se añadieron porque no eran configurables:
 * responsables se cerraba con un `requireAdmin` escrito a mano en su archivo de
 * rutas —un chequeo por rol que saltaba este sistema— y `users`/`config`
 * estaban fijos en `view: true` dentro de authorize.js, sin forma de revocarlos
 * ni desde la interfaz ni desde la base.
 */
const MODULE_ACTIONS = {
  dashboard: ['view'],
  sales: ['view', 'create', 'edit'],
  clients: ['view', 'create', 'edit'],
  responsables: ['view', 'create', 'edit', 'delete'],
  itineraries: ['view', 'edit'],
  commissions: ['view', 'create', 'edit', 'delete'],
  users: ['view'],
  config: ['view'],
};

/**
 * Módulos cuyo `view` tiene alcance (all / own / none) en vez de sí/no.
 *
 * `itineraries` estaba fuera y no debía: `authorize.js` respeta un 'own'
 * guardado y `flights.service.js` lo aplica de verdad, pero la LECTURA
 * (`parseValor`) lo trataba como booleano y devolvía `false` para un 'own'.
 * O sea: la interfaz lo mostraba apagado mientras el backend seguía dejando
 * pasar con alcance propio. Read y write ahora coinciden.
 *
 * `responsables` queda fuera a propósito: su tabla no tiene columna de dueño
 * (solo persona_id, status, creado_at, deleted_at), así que un 'own' no se
 * podría aplicar y se comportaría como 'all' sin avisar. Es un sí/no.
 */
const SCOPED_VIEW_MODULES = ['dashboard', 'sales', 'clients', 'itineraries'];

const DEFAULT_ROLE_VALUES = {
  asesor: {
    dashboard: { view: 'own' },
    sales: { view: 'own', create: 'true', edit: 'true' },
    clients: { view: 'own', create: 'true', edit: 'true' },
    responsables: { view: 'false', create: 'false', edit: 'false', delete: 'false' },
    itineraries: { view: 'own', edit: 'false' },
    commissions: { view: 'false', create: 'false', edit: 'false', delete: 'false' },
    // Se mantienen en true: el asistente de ventas necesita los catálogos
    // (aerolíneas, métodos de pago) y la lista de asesores para asignar la
    // venta. Ahora son revocables, aunque revocarlos rompa crear ventas.
    users: { view: 'true' },
    config: { view: 'true' },
  },
  freelancer: {
    dashboard: { view: 'own' },
    sales: { view: 'own', create: 'true', edit: 'true' },
    clients: { view: 'own', create: 'true', edit: 'true' },
    responsables: { view: 'false', create: 'false', edit: 'false', delete: 'false' },
    itineraries: { view: 'own', edit: 'false' },
    commissions: { view: 'false', create: 'false', edit: 'false', delete: 'false' },
    users: { view: 'true' },
    config: { view: 'true' },
  },
  admin: {
    dashboard: { view: 'all' },
    sales: { view: 'all', create: 'true', edit: 'true' },
    clients: { view: 'all', create: 'true', edit: 'true' },
    responsables: { view: 'true', create: 'true', edit: 'true', delete: 'true' },
    itineraries: { view: 'all', edit: 'true' },
    commissions: { view: 'true', create: 'true', edit: 'true', delete: 'true' },
    users: { view: 'true' },
    config: { view: 'true' },
  },
};

function parseValor(accion, modulo, valor, role) {
  if (accion === 'view' && SCOPED_VIEW_MODULES.includes(modulo)) {
    if (valor === 'all') {
      if (modulo === 'dashboard' && role !== 'admin') return 'own';
      return 'all';
    }
    if (valor === 'own') return 'own';
    if (valor === 'true') {
      // Un 'true' guardado equivale a alcance total, salvo en el dashboard,
      // donde solo el admin puede ver el de toda la agencia.
      if (modulo === 'dashboard') return role === 'admin' ? 'all' : 'own';
      return 'all';
    }
    return 'none';
  }
  return valor === 'true' || valor === true;
}

function encodeValor(value) {
  if (value === 'all' || value === 'own' || value === 'none') return value;
  if (value === true) return 'true';
  if (value === false) return 'false';
  return String(value);
}

class RolesService {
  async getPermissions(role) {
    // Los roles válidos son los que existen en la base, no una lista fija:
    // 'admin' quedaba fuera y por eso el frontend usaba permisos inventados.
    const rolEnBd = await prisma.roles.findUnique({ where: { nombre: role } });
    if (!rolEnBd) throw new BadRequestError(`Rol inválido: ${role}`);

    const permisos = await prisma.permisos_rol.findMany({
      where: { roles: { nombre: role } },
      include: { permisos: true }
    });

    // Derivado de MODULE_ACTIONS: antes era una tercera copia de la lista y
    // añadir un módulo obligaba a acordarse de los tres sitios.
    const MODULES = Object.keys(MODULE_ACTIONS);
    const defaults = DEFAULT_ROLE_VALUES[role] || DEFAULT_ROLE_VALUES.asesor;
    const grouped = {};

    for (const mod of MODULES) {
      grouped[mod] = {};
      const actions = MODULE_ACTIONS[mod] || [];
      for (const act of actions) {
        const defVal = defaults[mod]?.[act];
        grouped[mod][act] = parseValor(act, mod, defVal ?? 'false', role);
      }
    }

    for (const pr of permisos) {
      const m = pr.permisos.modulo;
      const a = pr.permisos.accion;
      const v = pr.valor != null ? pr.valor : 'true';
      if (!grouped[m]) grouped[m] = {};
      grouped[m][a] = parseValor(a, m, v, role);
    }

    return grouped;
  }

  async updatePermissions(role, permissions) {
    // Validar ANTES de borrar nada. El borrado corría primero, así que un body
    // mal formado dejaba el rol sin ningún permiso y luego reventaba.
    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
      throw new BadRequestError('Se esperaba un objeto de permisos por módulo');
    }
    const entradas = Object.entries(permissions).filter(
      ([, accs]) => accs && typeof accs === 'object' && !Array.isArray(accs)
    );
    if (entradas.length === 0) {
      throw new BadRequestError('El objeto de permisos está vacío');
    }

    const roles = await prisma.roles.findUnique({ where: { nombre: role } });
    if (!roles) throw new NotFoundError('Rol no encontrado');

    // Los permisos que falten se crean fuera de la transacción: son un catálogo
    // compartido y no deben deshacerse si la escritura del rol falla.
    const aEscribir = [];
    for (const [modulo, accs] of entradas) {
      for (const [accion, value] of Object.entries(accs)) {
        let permiso = await prisma.permisos.findFirst({ where: { modulo, accion } });
        if (!permiso) {
          permiso = await prisma.permisos.create({
            data: { modulo, accion, descripcion: `${modulo} - ${accion}` }
          });
        }
        aEscribir.push({ rol_id: roles.id, permiso_id: permiso.id, valor: encodeValor(value) });
      }
    }

    // Borrado y alta van juntos: o se reemplazan todos, o no se toca ninguno.
    await prisma.$transaction([
      prisma.permisos_rol.deleteMany({ where: { rol_id: roles.id } }),
      prisma.permisos_rol.createMany({ data: aEscribir }),
    ]);

    AUTH_CACHE.clear();
    return { message: 'Permisos de rol actualizados', count: aEscribir.length };
  }
}

module.exports = new RolesService();
