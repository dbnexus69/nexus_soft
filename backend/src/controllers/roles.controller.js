const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');

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

function parseValor(accion, modulo, valor) {
  if (accion === 'view' && SCOPED_VIEW_MODULES.includes(modulo)) {
    // scope value: 'all', 'own', or 'none'
    if (valor === 'all' || valor === 'own') return valor;
    if (valor === 'true') return 'all';
    return 'none';
  }
  // boolean value
  return valor === 'true' || valor === true;
}

function encodeValor(value) {
  // Convert frontend value to stored string
  if (value === 'all' || value === 'own' || value === 'none') return value;
  if (value === true) return 'true';
  if (value === false) return 'false';
  return String(value);
}

exports.getPermissions = async (req, res, next) => {
  try {
    const { role } = req.params;
    const validRoles = ['asesor', 'freelancer'];
    if (!validRoles.includes(role)) {
      return error(res, 'Rol inválido. Use: asesor, freelancer', 400);
    }

    const permisos = await prisma.permisosRol.findMany({
      where: { rol: { nombre: role } },
      include: { permiso: true }
    });

    // Start with default structure for all modules the role can configure
    const MODULES = ['dashboard', 'sales', 'clients', 'itineraries', 'commissions'];
    const defaults = DEFAULT_ROLE_VALUES[role] || DEFAULT_ROLE_VALUES.asesor;
    const grouped = {};

    for (const mod of MODULES) {
      grouped[mod] = {};
      const actions = MODULE_ACTIONS[mod] || [];
      for (const act of actions) {
        const defVal = defaults[mod]?.[act];
        grouped[mod][act] = parseValor(act, mod, defVal ?? 'false');
      }
    }

    // Override with values stored in DB
    for (const pr of permisos) {
      const m = pr.permiso.modulo;
      const a = pr.permiso.accion;
      const v = pr.valor != null ? pr.valor : 'true';
      if (!grouped[m]) grouped[m] = {};
      grouped[m][a] = parseValor(a, m, v);
    }

    success(res, grouped);
  } catch (err) {
    next(err);
  }
};

exports.updatePermissions = async (req, res, next) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;

    const rol = await prisma.roles.findUnique({ where: { nombre: role } });
    if (!rol) return error(res, 'Rol no encontrado', 404);

    await prisma.permisosRol.deleteMany({ where: { rolId: rol.id } });

    for (const [modulo, accs] of Object.entries(permissions)) {
      for (const [accion, value] of Object.entries(accs)) {
        const encoded = encodeValor(value);

        // Buscar o crear el registro en el catálogo de permisos
        let permiso = await prisma.permisos.findFirst({ where: { modulo, accion } });
        if (!permiso) {
          permiso = await prisma.permisos.create({
            data: { modulo, accion, descripcion: `${modulo} - ${accion}` }
          });
        }

        await prisma.permisosRol.create({
          data: { rolId: rol.id, permisoId: permiso.id, valor: encoded }
        });
      }
    }

    success(res, { message: 'Permisos de rol actualizados' });
  } catch (err) {
    next(err);
  }
};
