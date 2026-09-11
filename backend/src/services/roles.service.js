const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { olvidarTodo } = require('../middleware/authCache');

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
  // `delete` faltaba y `authorize('sales', 'delete')` sí lo exige: la acción se
  // aplicaba en la ruta pero no se podía ni consultar ni delegar. Esta lista es
  // ahora exactamente el conjunto de pares (módulo, acción) que aparecen en
  // `authorize(...)` en src/routes.
  sales: ['view', 'create', 'edit', 'delete'],
  clients: ['view', 'create', 'edit'],
  responsables: ['view', 'create', 'edit', 'delete'],
  itineraries: ['view', 'edit'],
  commissions: ['view', 'create', 'edit', 'delete'],
  users: ['view', 'create', 'edit', 'delete'],
  config: ['view', 'edit'],
  // Reescribir los permisos de un rol es su propia llave, no `config.edit`:
  // esa la comparten las aerolíneas y los proveedores del catálogo.
  permissions: ['view', 'edit'],
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

/**
 * Rótulos de los módulos y de las acciones, para que la API pueda DESCRIBIR el
 * esquema de permisos en vez de que la pantalla lo adivine.
 *
 * La rejilla del frontend llevaba su propia lista de módulos escrita a mano, y
 * declaraba cuatro de los nueve. Peor: su plantilla conocía 21 de los 26
 * permisos, y como la normalización recorría las claves de ESA plantilla,
 * guardar desde la pantalla descartaba los otros cinco —config.edit,
 * sales.delete y las tres de users— y `updatePermissions` reemplaza todas las
 * filas del rol. Es decir, abrir la pantalla y guardar borraba permisos que
 * nadie había tocado.
 *
 * Con el esquema servido desde aquí, añadir un módulo no obliga a tocar el
 * frontend y no hay dos listas que puedan discrepar.
 */
const ETIQUETAS_MODULO = {
  dashboard: 'Panel',
  sales: 'Ventas',
  clients: 'Clientes',
  responsables: 'Responsables',
  itineraries: 'Vuelos',
  commissions: 'Comisionistas',
  users: 'Usuarios',
  config: 'Gestión interna',
  permissions: 'Permisos de rol',
};

const ETIQUETAS_ACCION = {
  view: 'Ver',
  create: 'Crear',
  edit: 'Editar',
  delete: 'Eliminar',
};

/** Todas las acciones que puede tener un módulo, en el orden de la matriz. */
const ORDEN_ACCIONES = ['view', 'create', 'edit', 'delete'];

/**
 * Los roles administrativos: los que gobiernan la agencia entera y no un
 * conjunto propio de ventas.
 *
 * Existía como la comparación `role !== 'admin'` dentro de `parseValor`, que
 * degradaba el dashboard de `superadmin` a alcance 'own' — el rol creado para
 * poder MÁS que un admin veía menos que él.
 */
const ROLES_ADMINISTRATIVOS = ['admin', 'superadmin'];

/**
 * Roles que NO se pueden editar. Es el mismo conjunto que el de arriba, y por
 * el mismo motivo: su autorización no sale de la base.
 *
 * `superadmin` porque si alguien pudiera quitarle permisos nadie podría
 * devolvérselos, y `admin` porque `authorize.js` le da todo sin mirar la base:
 * la pantalla dejaba editarlo y no pasaba nada, que es peor que no dejarlo.
 */
const ROLES_FIJOS = ROLES_ADMINISTRATIVOS;

const DEFAULT_ROLE_VALUES = {
  asesor: {
    dashboard: { view: 'own' },
    sales: { view: 'own', create: 'true', edit: 'true', delete: 'false' },
    clients: { view: 'own', create: 'true', edit: 'true' },
    responsables: { view: 'false', create: 'false', edit: 'false', delete: 'false' },
    itineraries: { view: 'own', edit: 'false' },
    commissions: { view: 'false', create: 'false', edit: 'false', delete: 'false' },
    // Se mantienen en true: el asistente de ventas necesita los catálogos
    // (aerolíneas, métodos de pago) y la lista de asesores para asignar la
    // venta. Ahora son revocables, aunque revocarlos rompa crear ventas.
    users: { view: 'true', create: 'false', edit: 'false', delete: 'false' },
    config: { view: 'true', edit: 'false' },
    permissions: { view: 'false', edit: 'false' },
  },
  freelancer: {
    dashboard: { view: 'own' },
    sales: { view: 'own', create: 'true', edit: 'true', delete: 'false' },
    clients: { view: 'own', create: 'true', edit: 'true' },
    responsables: { view: 'false', create: 'false', edit: 'false', delete: 'false' },
    itineraries: { view: 'own', edit: 'false' },
    commissions: { view: 'false', create: 'false', edit: 'false', delete: 'false' },
    users: { view: 'true', create: 'false', edit: 'false', delete: 'false' },
    config: { view: 'true', edit: 'false' },
    permissions: { view: 'false', edit: 'false' },
  },
  admin: {
    dashboard: { view: 'all' },
    sales: { view: 'all', create: 'true', edit: 'true', delete: 'true' },
    clients: { view: 'all', create: 'true', edit: 'true' },
    responsables: { view: 'true', create: 'true', edit: 'true', delete: 'true' },
    itineraries: { view: 'all', edit: 'true' },
    commissions: { view: 'true', create: 'true', edit: 'true', delete: 'true' },
    users: { view: 'true', create: 'true', edit: 'true', delete: 'true' },
    config: { view: 'true', edit: 'true' },
    permissions: { view: 'true', edit: 'false' },
  },
  superadmin: {
    dashboard: { view: 'all' },
    sales: { view: 'all', create: 'true', edit: 'true', delete: 'true' },
    clients: { view: 'all', create: 'true', edit: 'true' },
    responsables: { view: 'true', create: 'true', edit: 'true', delete: 'true' },
    itineraries: { view: 'all', edit: 'true' },
    commissions: { view: 'true', create: 'true', edit: 'true', delete: 'true' },
    users: { view: 'true', create: 'true', edit: 'true', delete: 'true' },
    config: { view: 'true', edit: 'true' },
    permissions: { view: 'true', edit: 'true' },
  },
};

function parseValor(accion, modulo, valor, role) {
  if (accion === 'view' && SCOPED_VIEW_MODULES.includes(modulo)) {
    if (valor === 'all') {
      if (modulo === 'dashboard' && !ROLES_ADMINISTRATIVOS.includes(role)) return 'own';
      return 'all';
    }
    if (valor === 'own') return 'own';
    if (valor === 'true') {
      // Un 'true' guardado equivale a alcance total, salvo en el dashboard,
      // donde solo un rol administrativo ve el de toda la agencia.
      if (modulo === 'dashboard') return ROLES_ADMINISTRATIVOS.includes(role) ? 'all' : 'own';
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
  /**
   * El esquema de permisos: qué módulos hay, qué acciones tiene cada uno y de
   * qué tipo es cada acción.
   *
   * Se sirve para que la pantalla no lleve su propia lista. `ORDEN_ACCIONES`
   * fija las columnas de la matriz, y cada módulo dice cuáles de ellas tiene:
   * el panel no tiene "crear", y esa ausencia es información —dice que la
   * acción no existe—, no un hueco que rellenar.
   *
   * `tipo: 'scope'` es la vista de los módulos con alcance: no es un sí/no sino
   * todas / solo las propias / ninguna.
   */
  getSchema() {
    const modules = Object.entries(MODULE_ACTIONS).map(([clave, acciones]) => ({
      key: clave,
      label: ETIQUETAS_MODULO[clave] || clave,
      actions: ORDEN_ACCIONES.filter(a => acciones.includes(a)).map(a => ({
        key: a,
        label: ETIQUETAS_ACCION[a] || a,
        type: a === 'view' && SCOPED_VIEW_MODULES.includes(clave) ? 'scope' : 'boolean',
      })),
    }));

    return {
      // Las columnas de la matriz, en orden.
      actions: ORDEN_ACCIONES.map(a => ({ key: a, label: ETIQUETAS_ACCION[a] })),
      modules,
      // Valores del selector de alcance, para no escribirlos en la pantalla.
      scopes: [
        { value: 'all', label: 'Todas' },
        { value: 'own', label: 'Solo las propias' },
        { value: 'none', label: 'Ninguna' },
      ],
      // Qué roles se pueden editar. `admin` y `superadmin` no: su autorización
      // la resuelve `authorize.js` sin mirar la base, así que la pantalla debe
      // mostrarlos en lectura y no ofrecer un guardado que no haría nada.
      roles: Object.keys(DEFAULT_ROLE_VALUES).map(nombre => ({
        name: nombre,
        editable: !ROLES_FIJOS.includes(nombre),
      })),
    };
  }

  async getPermissions(role) {
    // Los roles válidos son los que existen en la base, no una lista fija:
    // 'admin' quedaba fuera y por eso el frontend usaba permisos inventados.
    const rolEnBd = await prisma.roles.findFirst({ where: { nombre: role } });
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

    if (ROLES_FIJOS.includes(role)) {
      throw new BadRequestError(
        `El rol ${role} no es editable: sus permisos están fijados en el código.`
      );
    }

    // El PUT reemplaza TODAS las filas del rol, así que un envío incompleto
    // borra los permisos que no menciona. Es exactamente lo que hacía la
    // pantalla: su plantilla conocía 21 de los 26 y guardaba sin los otros
    // cinco, que desaparecían de la base sin que nadie los hubiera tocado.
    //
    // Ahora se rechaza. Un PUT es un reemplazo completo por definición, así que
    // si falta algo es un error del cliente, no una instrucción de borrarlo.
    const declarados = [];
    for (const [modulo, acciones] of Object.entries(MODULE_ACTIONS)) {
      for (const accion of acciones) {
        if (permissions[modulo]?.[accion] === undefined) declarados.push(`${modulo}.${accion}`);
      }
    }
    if (declarados.length) {
      throw new BadRequestError(
        `Faltan ${declarados.length} permisos en el envío: ${declarados.join(', ')}. ` +
        'Un PUT reemplaza todos los permisos del rol, así que tienen que venir completos.'
      );
    }

    const roles = await prisma.roles.findFirst({ where: { nombre: role } });
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
    await prisma.transaccion(async (tx) => {
      await tx.permisos_rol.deleteMany({ where: { rol_id: roles.id } });
      await tx.permisos_rol.createMany({ data: aEscribir });
    });

    olvidarTodo();
    return { message: 'Permisos de rol actualizados', count: aEscribir.length };
  }
}

// El orden importa: asignar `module.exports` entero DESPUÉS de colgarle una
// propiedad la descartaba, así que `ROLES_FIJOS` se exportaba como undefined.
// Nadie lo importaba todavía, y por eso no se notaba.
const servicio = new RolesService();
servicio.ROLES_FIJOS = ROLES_FIJOS;
servicio.ROLES_ADMINISTRATIVOS = ROLES_ADMINISTRATIVOS;
servicio.MODULE_ACTIONS = MODULE_ACTIONS;
servicio.DEFAULT_ROLE_VALUES = DEFAULT_ROLE_VALUES;
module.exports = servicio;
