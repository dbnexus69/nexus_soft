// Acciones con alcance —todos / solo los suyos / ninguno— en vez de sí/no (spec 020).
// La comparten `services/roles.service.js` (leer y guardar el panel) y
// `middleware/authorize.js` (decidir): una sola lista, para que no discrepen.
//
// `responsables` entró en la spec 026, cuando su tabla tuvo dueño (`creado_por_id`).
const SCOPED_ACTIONS = {
  dashboard: ['view'],
  sales: ['view', 'edit', 'delete'],
  quotes: ['view', 'edit', 'delete'],
  clients: ['view', 'edit'],
  responsables: ['view', 'edit', 'delete'],
  itineraries: ['view', 'edit'],
};

const RANGO = { none: 0, own: 1, all: 2 };

const tieneAlcance = (modulo, accion) => (SCOPED_ACTIONS[modulo] || []).includes(accion);

/** Un valor guardado o por defecto como alcance: `true` (de antes de la spec 020) es 'all'; `false`, 'none'. */
function aAlcance(valor) {
  if (valor === 'all' || valor === 'own' || valor === 'none') return valor;
  return valor === true || valor === 'true' ? 'all' : 'none';
}

/** El más estrecho de los dos: no se edita ni se borra lo que no se puede ver. */
const masEstrecho = (a, b) => (RANGO[aAlcance(a)] <= RANGO[aAlcance(b)] ? aAlcance(a) : aAlcance(b));

/**
 * Sobre qué registros puede ESCRIBIR quien pide: el alcance de la acción, con el tope
 * del de ver. `authorize` ya lo deja así en `permissionScope` para las acciones con
 * alcance; aplicarlo aquí también cubre las que no lo tienen (un `create: true` es
 * 'all' y queda en el de ver, como antes de la spec 020).
 */
function alcanceDeEscritura({ permissionScope, viewScope } = {}) {
  if (typeof viewScope !== 'string') return aAlcance(permissionScope);
  return masEstrecho(permissionScope, viewScope);
}

module.exports = { SCOPED_ACTIONS, tieneAlcance, aAlcance, masEstrecho, alcanceDeEscritura };
