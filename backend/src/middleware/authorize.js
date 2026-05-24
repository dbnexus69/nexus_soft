const { error } = require('../utils/apiResponse');

const ADMIN_PERMISSIONS = {
  dashboard: { view: 'all' },
  sales: { view: 'all', create: true, edit: true },
  clients: { view: 'all', create: true, edit: true },
  itineraries: { view: true, edit: true },
  commissions: { view: true, create: true, edit: true, delete: true },
  users: { view: true, create: true, edit: true, delete: true },
  config: { view: true, edit: true },
};

const ROLE_DEFAULT_PERMISSIONS = {
  asesor: {
    dashboard: { view: 'own' },
    sales: { view: 'own', create: true, edit: true },
    clients: { view: 'own', create: true, edit: true },
    itineraries: { view: true, edit: false },
    commissions: { view: false, create: false, edit: false, delete: false },
  },
  freelancer: {
    dashboard: { view: 'own' },
    sales: { view: 'own', create: true, edit: true },
    clients: { view: 'own', create: true, edit: true },
    itineraries: { view: true, edit: false },
    commissions: { view: false, create: false, edit: false, delete: false },
  },
};

function getEffectivePermissions(user) {
  if (user.role === 'admin') {
    return { permissions: ADMIN_PERMISSIONS, scope: 'all' };
  }

  const rolePerms = ROLE_DEFAULT_PERMISSIONS[user.role] || ROLE_DEFAULT_PERMISSIONS.asesor;
  const permissions = JSON.parse(JSON.stringify(rolePerms));

  // Aplicar permisos globales de DB
  if (user.permisosRol) {
    for (const pr of user.permisosRol) {
      const mod = permissions[pr.modulo];
      if (mod && pr.accion in mod) {
        const currentVal = mod[pr.accion];
        if (typeof currentVal === 'boolean') {
          mod[pr.accion] = pr.valor === 'true' || pr.valor === true;
        } else {
          mod[pr.accion] = ['all', 'own', 'none'].includes(pr.valor) ? pr.valor : 'own';
        }
      }
    }
  }

  // Aplicar overrides específicos del usuario
  if (user.permisosUsuario) {
    for (const pu of user.permisosUsuario) {
      const mod = permissions[pu.modulo];
      if (mod && pu.accion in mod) {
        const currentVal = mod[pu.accion];
        if (typeof currentVal === 'boolean') {
          mod[pu.accion] = pu.valor === 'true' || pu.valor === true;
        } else {
          mod[pu.accion] = ['all', 'own', 'none'].includes(pu.valor) ? pu.valor : 'own';
        }
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
