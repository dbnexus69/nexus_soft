const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { AUTH_CACHE } = require('../middleware/auth');

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
  async getPermissions(role) {
    // Los roles válidos son los que existen en la base, no una lista fija:
    // 'admin' quedaba fuera y por eso el frontend usaba permisos inventados.
    const rolEnBd = await prisma.roles.findUnique({ where: { nombre: role } });
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

// El orden importa: asignar `module.exports` entero DESPUÉS de colgarle una
// propiedad la descartaba, así que `ROLES_FIJOS` se exportaba como undefined.
// Nadie lo importaba todavía, y por eso no se notaba.
const servicio = new RolesService();
servicio.ROLES_FIJOS = ROLES_FIJOS;
servicio.ROLES_ADMINISTRATIVOS = ROLES_ADMINISTRATIVOS;
servicio.MODULE_ACTIONS = MODULE_ACTIONS;
servicio.DEFAULT_ROLE_VALUES = DEFAULT_ROLE_VALUES;
module.exports = servicio;
