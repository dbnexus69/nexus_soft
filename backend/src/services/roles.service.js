const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { AUTH_CACHE } = require('../middleware/auth');

const MODULE_ACTIONS = {
  dashboard: ['view'],
  sales: ['view', 'create', 'edit'],
  clients: ['view', 'create', 'edit'],
  itineraries: ['view', 'edit'],
  commissions: ['view', 'create', 'edit', 'delete'],
};

const SCOPED_VIEW_MODULES = ['dashboard', 'sales', 'clients'];

const DEFAULT_ROLE_VALUES = {
  asesor: {
    dashboard: { view: 'own' },
    sales: { view: 'own', create: 'true', edit: 'true' },
    clients: { view: 'own', create: 'true', edit: 'true' },
    itineraries: { view: 'true', edit: 'false' },
    commissions: { view: 'false', create: 'false', edit: 'false', delete: 'false' },
  },
  freelancer: {
    dashboard: { view: 'own' },
    sales: { view: 'own', create: 'true', edit: 'true' },
    clients: { view: 'own', create: 'true', edit: 'true' },
    itineraries: { view: 'true', edit: 'false' },
    commissions: { view: 'false', create: 'false', edit: 'false', delete: 'false' },
  },
  admin: {
    dashboard: { view: 'all' },
    sales: { view: 'all', create: 'true', edit: 'true' },
    clients: { view: 'all', create: 'true', edit: 'true' },
    itineraries: { view: 'all', edit: 'true' },
    commissions: { view: 'true', create: 'true', edit: 'true', delete: 'true' },
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

    const MODULES = ['dashboard', 'sales', 'clients', 'itineraries', 'commissions'];
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
