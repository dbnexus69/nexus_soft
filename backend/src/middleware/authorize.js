const { error } = require('../utils/apiResponse');
const { tieneAlcance, masEstrecho, leerValor } = require('../utils/alcancePermisos');

/**
 * Punto de partida por rol. NO es la fuente: `getEffectivePermissions`
 * superpone encima lo que diga `permisos_rol` en la base, que es quien manda.
 *
 * Importa que cada módulo/acción configurable APAREZCA aquí: la superposición
 * solo aplica un valor de la base `if (pr.accion in mod)`, así que un permiso
 * que no exista en este objeto se guarda en la base y se ignora en silencio.
 */
const ADMIN_PERMISSIONS = {
  dashboard: { view: 'all' },
  // Editar y borrar con alcance (spec 020): 'all' | 'own' | 'none'.
  sales: { view: 'all', create: true, edit: 'all', delete: 'all' },
  quotes: { view: 'all', create: true, edit: 'all', delete: 'all' },
  clients: { view: 'all', create: true, edit: 'all', delete: true },
  responsables: { view: 'all', create: true, edit: 'all' },
  itineraries: { view: 'all', edit: 'all', delete: true },
  commissions: { view: true, create: true, edit: true, delete: true },
  users: { view: true, create: true, edit: true, delete: true },
  config: { view: true, create: true, edit: true, delete: true },
  // Editar los permisos de un rol NO es `config.edit`.
  //
  // Compartían llave con el catálogo (aerolíneas, proveedores, métodos de
  // pago), así que cualquiera que pudiera añadir una aerolínea podía además
  // reescribir los permisos de todos los roles. Ahora es su propio módulo, y el
  // admin solo puede mirarlo.
  permissions: { view: true, edit: false },
};

/**
 * `superadmin`: el único que puede reescribir permisos.
 *
 * Como el atajo del admin, ignora la base a propósito: si alguien pudiera
 * quitarle permisos al superadmin desde la interfaz, nadie podría devolvérselos.
 */
const SUPERADMIN_PERMISSIONS = {
  ...ADMIN_PERMISSIONS,
  permissions: { view: true, edit: true },
};

const ROLE_DEFAULT_PERMISSIONS = {
  asesor: {
    dashboard: { view: 'own' },
    // 'own' donde antes era `true` con `view: 'own'`: es lo mismo que ya valía (spec 020).
    sales: { view: 'own', create: true, edit: 'own', delete: 'none' },
    quotes: { view: 'own', create: true, edit: 'own', delete: 'none' },
    clients: { view: 'own', create: true, edit: 'own' },
    // Por defecto los responsables son cosa de admin, como cuando esto se
    // cerraba con un `requireAdmin` a mano. La diferencia es que ahora se
    // puede delegar desde la interfaz. Con alcance desde la spec 026: 'none' y no
    // `false`, o un 'own'/'all' guardado se leería como booleano.
    responsables: { view: 'none', create: false, edit: 'none' },
    permissions: { view: false, edit: false },
    itineraries: { view: 'own', edit: 'none' },
    commissions: { view: false, create: false, edit: false, delete: false },
    // Las acciones tienen que APARECER aquí aunque sean false: la superposición
    // de la base solo aplica un valor `if (pr.accion in mod)`, así que sin la
    // llave el permiso se guarda y se ignora en silencio. Faltaban justo las
    // que las rutas exigen: users.create/edit/delete y config.edit.
    users: { view: false, create: false, edit: false, delete: false },
    config: { view: true, edit: false },
  },
  freelancer: {
    dashboard: { view: 'own' },
    // 'own' donde antes era `true` con `view: 'own'`: es lo mismo que ya valía (spec 020).
    sales: { view: 'own', create: true, edit: 'own', delete: 'none' },
    quotes: { view: 'own', create: true, edit: 'own', delete: 'none' },
    clients: { view: 'own', create: true, edit: 'own' },
    // Los suyos: los que creó (spec 026). Borrar, no.
    responsables: { view: 'own', create: true, edit: 'own' },
    permissions: { view: false, edit: false },
    itineraries: { view: 'own', edit: 'none' },
    commissions: { view: false, create: false, edit: false, delete: false },
    // Las acciones tienen que APARECER aquí aunque sean false: la superposición
    // de la base solo aplica un valor `if (pr.accion in mod)`, así que sin la
    // llave el permiso se guarda y se ignora en silencio. Faltaban justo las
    // que las rutas exigen: users.create/edit/delete y config.edit.
    users: { view: false, create: false, edit: false, delete: false },
    config: { view: true, edit: false },
  },
};

function getEffectivePermissions(user) {
  if (user.role === 'superadmin') {
    return { permissions: SUPERADMIN_PERMISSIONS, scope: 'all' };
  }

  if (user.role === 'admin') {
    return { permissions: ADMIN_PERMISSIONS, scope: 'all' };
  }

  const rolePerms = ROLE_DEFAULT_PERMISSIONS[user.role] || ROLE_DEFAULT_PERMISSIONS.asesor;
  const permissions = JSON.parse(JSON.stringify(rolePerms));

  if (user.permisos_rol) {
    for (const pr of user.permisos_rol) {
      const mod = permissions[pr.modulo];
      // Una sola lectura (spec 027), la misma que muestra el panel de roles.
      if (mod && pr.accion in mod) mod[pr.accion] = leerValor(pr.modulo, pr.accion, pr.valor);
    }
  }


  // Regla de negocio: los no-admin nunca pueden tener scope 'all' en el dashboard.
  // Los módulos de ventas y clientes SÍ son configurables por roles.
  if (permissions['dashboard'] && permissions['dashboard'].view === 'all') {
    permissions['dashboard'].view = 'own';
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
    if (!req.user) {
      return error(res, 'No autenticado', 401);
    }

    const { permissions } = getEffectivePermissions(req.user);
    const actionScope = getActionScope(permissions, modulo, accion);

    if (actionScope === false) {
      return error(res, 'No tienes permiso para realizar esta acción', 403);
    }

    const alcanceDeVer = permissions?.[modulo]?.view;

    // Editar y borrar con alcance (spec 020): nunca más amplio que ver. Con ver
    // 'none' no se escribe nada, aunque la acción diga otra cosa.
    if (accion !== 'view' && tieneAlcance(modulo, accion) && typeof alcanceDeVer === 'string') {
      const efectivo = masEstrecho(actionScope, alcanceDeVer);
      if (efectivo === 'none') return error(res, 'No tienes permiso para realizar esta acción', 403);
      req.permissionScope = efectivo;
    } else {
      req.permissionScope = actionScope;
    }

    // El alcance de VER ese módulo, que es el que dice sobre qué registros
    // puede actuar este usuario.
    //
    // `permissionScope` es el de la acción pedida, y las de escribir son
    // booleanas: `edit: true` no tiene alcance, así que al comprobar una
    // mutación siempre valía 'true' y la comprobación de propiedad no se
    // cumplía nunca. Con un asesor de alcance 'own' se veía: los GET daban 404
    // y el PUT, el cobro y el alta de producto sobre la MISMA venta daban 200.
    // Quien no puede ver un registro tampoco puede escribirlo.
    req.viewScope = typeof alcanceDeVer === 'string' ? alcanceDeVer : null;

    next();
  };
}

// Las plantillas se exportan para que el alta de una empresa siembre sus roles
// desde la MISMA fuente que usa `authorize` para decidir. Copiarlas en el
// servicio de empresas sería garantizar que un día discrepen.
module.exports = {
  authorize, getEffectivePermissions, getActionScope,
  ADMIN_PERMISSIONS, SUPERADMIN_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS,
};
