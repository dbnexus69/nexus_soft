const { error } = require('../utils/apiResponse');

const ADMIN_PERMISSIONS = {
  dashboard: { view: 'all' },
  sales: { view: 'all', create: true, edit: 'all', delete: true },
  clients: { view: 'all', create: true, edit: 'all' },
  itineraries: { view: true, edit: true, delete: true },
  users: { view: true, create: true, edit: true, delete: true },
  config: { view: true, edit: true },
};

const ROLE_DEFAULT_PERMISSIONS = {
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

function getEffectivePermissions(user) {
  if (user.role === 'admin') {
    return { permissions: ADMIN_PERMISSIONS, scope: 'all' };
  }

  const rolePerms = ROLE_DEFAULT_PERMISSIONS[user.role] || ROLE_DEFAULT_PERMISSIONS.asesor;
  const permissions = { ...rolePerms };

  const userPermMap = {};
  if (user.permisosUsuario) {
    for (const pu of user.permisosUsuario) {
      const key = `${pu.modulo}.${pu.accion}`;
      userPermMap[key] = true;
    }
  }

  return { permissions, scope: 'own' };
}

function getActionScope(permissions, modulo, accion) {
  const mod = permissions[modulo];
  if (!mod) return false;
  const val = mod[accion];
  if (val === true || val === 'all') return 'all';
  if (val === 'own') return 'own';
  return false;
}

function authorize(modulo, accion) {
  return (req, res, next) => {
    const { permissions } = getEffectivePermissions(req.user);
    const scope = getActionScope(permissions, modulo, accion);

    if (!scope) {
      return error(res, `No tienes permiso para ${accion} en ${modulo}`, 403, 'FORBIDDEN');
    }

    req.permissionScope = scope;
    next();
  };
}

module.exports = { authorize, getEffectivePermissions, getActionScope };
