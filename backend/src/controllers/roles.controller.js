const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');

const ROLE_PERMISSIONS_MAP = {
  asesor: {
    dashboard: { view: 'own' },
    sales: { create: true, edit: 'own', delete: false },
    clients: { view: 'all', create: true, edit: 'none' },
    itineraries: { view: true, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    config: { view: false, edit: false },
  },
  freelancer: {
    dashboard: { view: 'own' },
    sales: { create: true, edit: 'own', delete: false },
    clients: { view: 'own', create: true, edit: 'none' },
    itineraries: { view: true, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    config: { view: false, edit: false },
  },
};

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
      acc[m][a] = true;
      return acc;
    }, {});

    // Ensure all 6 modules exist (fill missing with empty object)
    const MODULES = ['dashboard', 'sales', 'clients', 'itineraries', 'users', 'config'];
    const ACTIONS = ['view', 'create', 'edit', 'delete'];
    for (const mod of MODULES) {
      if (!grouped[mod]) grouped[mod] = {};
      for (const act of ACTIONS) {
        if (grouped[mod][act] === undefined) grouped[mod][act] = false;
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
