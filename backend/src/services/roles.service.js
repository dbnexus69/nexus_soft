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
};

function parseValor(accion, modulo, valor, role) {
  if (accion === 'view' && SCOPED_VIEW_MODULES.includes(modulo)) {
    if (valor === 'all') {
      if (modulo === 'dashboard' && role !== 'admin') return 'own';
      return 'all';
    }
    if (valor === 'own') return 'own';
    if (valor === 'true') {
      return modulo === 'dashboard' ? 'own' : 'all';
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
    const validRoles = ['asesor', 'freelancer'];
    if (!validRoles.includes(role)) throw new BadRequestError('Rol inválido. Use: asesor, freelancer');

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
    const roles = await prisma.roles.findUnique({ where: { nombre: role } });
    if (!roles) throw new NotFoundError('Rol no encontrado');

    await prisma.permisos_rol.deleteMany({ where: { rol_id: roles.id } });

    for (const [modulo, accs] of Object.entries(permissions)) {
      for (const [accion, value] of Object.entries(accs)) {
        const encoded = encodeValor(value);
        let permisos = await prisma.permisos.findFirst({ where: { modulo, accion } });
        if (!permisos) {
          permisos = await prisma.permisos.create({
            data: { modulo, accion, descripcion: `${modulo} - ${accion}` }
          });
        }
        await prisma.permisos_rol.create({
          data: { rol_id: roles.id, permiso_id: permisos.id, valor: encoded }
        });
      }
    }

    AUTH_CACHE.clear();
    return { message: 'Permisos de rol actualizados' };
  }
}

module.exports = new RolesService();
