const { error } = require('../utils/apiResponse');

const ADMIN_PERMISSIONS = {
  dashboard: { view: 'all' },
  sales: { view: 'all', create: true, edit: true, delete: true },
  clients: { view: 'all', create: true, edit: true },
  itineraries: { view: true, edit: true },
  users: { view: true, create: true, edit: true, delete: true },
  config: { view: true, edit: true },
};

const ROLE_DEFAULT_PERMISSIONS = {
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

function getEffectivePermissions(user) {
  if (user.role === 'admin') {
    return { permissions: ADMIN_PERMISSIONS, scope: 'all' };
  }

  const rolePerms = ROLE_DEFAULT_PERMISSIONS[user.role] || ROLE_DEFAULT_PERMISSIONS.asesor;
  const permissions = JSON.parse(JSON.stringify(rolePerms));

  if (user.permisosUsuario) {
    for (const pu of user.permisosUsuario) {
      const mod = permissions[pu.modulo];
      if (mod && pu.accion in mod) {
        const currentVal = mod[pu.accion];
        mod[pu.accion] = typeof currentVal === 'boolean' ? true : 'own';
      }
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
