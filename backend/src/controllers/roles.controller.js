const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');

const MODULE_ACTIONS = {
  dashboard: ['view'],
  sales: ['view', 'create', 'edit', 'delete'],
  clients: ['view', 'create', 'edit'],
  itineraries: ['view', 'edit'],
  users: ['view', 'create', 'edit', 'delete'],
  config: ['view', 'edit'],
};

const ROLE_PERMISSIONS_MAP = {
  asesor: {
    dashboard: { view: 'own' },
    sales: { view: 'own', create: true, edit: true, delete: false },
    clients: { view: 'own', create: true, edit: false },
    itineraries: { view: true, edit: false },
    users: { view: false, create: false, edit: false, delete: false },
    config: { view: false, edit: false },
  },
  freelancer: {
    dashboard: { view: 'own' },
    sales: { view: 'own', create: true, edit: true, delete: false },
    clients: { view: 'own', create: true, edit: false },
    itineraries: { view: true, edit: false },
    users: { view: false, create: false, edit: false, delete: false },
    config: { view: false, edit: false },
  },
};

const SCOPED_VIEW_MODULES = ['dashboard', 'sales', 'clients'];

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

    const grouped = permisos.reduce((acc, pr) => {
      const m = pr.permiso.modulo;
      const a = pr.permiso.accion;
      if (!acc[m]) acc[m] = {};
      acc[m][a] = (a === 'view' && SCOPED_VIEW_MODULES.includes(m)) ? 'all' : true;
      return acc;
    }, {});

    // Ensure all 6 modules exist (fill missing with empty object)
    const MODULES = ['dashboard', 'sales', 'clients', 'itineraries', 'users', 'config'];
    for (const mod of MODULES) {
      if (!grouped[mod]) grouped[mod] = {};
      const actions = MODULE_ACTIONS[mod] || [];
      for (const act of actions) {
        if (grouped[mod][act] === undefined) grouped[mod][act] = (act === 'view' && SCOPED_VIEW_MODULES.includes(mod)) ? 'none' : false;
      }
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
        if (value === true || value === 'all' || value === 'own') {
          const permiso = await prisma.permisos.findFirst({
            where: { modulo, accion }
          });
          if (permiso) {
            await prisma.permisosRol.create({
              data: { rolId: rol.id, permisoId: permiso.id }
            });
          }
        }
      }
    }

    success(res, { message: 'Permisos de rol actualizados' });
  } catch (err) {
    next(err);
  }
};
