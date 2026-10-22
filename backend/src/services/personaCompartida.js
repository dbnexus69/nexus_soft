/**
 * Una persona por documento y agencia (`@@unique([empresa_id, documento])` en `personas`):
 * clientes, usuarios, comisionistas y responsables apuntan a la misma fila (spec 024).
 *
 * Antes, dar de alta cualquier rol con un documento ya registrado sobrescribía el nombre, el
 * correo y el teléfono de esa persona con lo del formulario, y la reactivaba (`status: 'active'`,
 * `deleted_at: null`): crear un comisionista reactivaba a un cliente desactivado, sin aviso.
 *
 * Ahora:
 * - Persona en uso por otro rol (`deleted_at` vacío): se enlaza tal cual. Solo se llenan los
 *   campos que tenga vacíos; su estado no se toca. Devuelve `aviso` para que la pantalla lo diga.
 * - Persona dada de baja (ningún rol vivo): se revive con los datos del formulario.
 * - Documento nuevo o sin documento: `persona` null, el servicio la crea como siempre.
 */
const PERSONA_EN_USO = 'Este documento ya estaba registrado en la agencia; se conservaron los datos de esa persona.';

const CAMPOS = ['nombres', 'apellidos', 'tipo_documento_id', 'email', 'telefono', 'avatar_url', 'birth_date'];
const vacio = v => v === null || v === undefined || v === '';

/**
 * @param db         `prisma` o el `tx` de una `transaccion`
 * @param documento  número de documento del formulario
 * @param datos      { nombres, apellidos, tipo_documento_id, email, telefono, avatar_url, birth_date, status? }
 * @returns { persona, aviso }
 */
async function reutilizarPersona(db, documento, datos) {
  if (!documento) return { persona: null, aviso: null };
  const existente = await db.personas.findFirst({ where: { documento } });
  if (!existente) return { persona: null, aviso: null };

  if (existente.deleted_at) {
    const nuevos = Object.fromEntries(CAMPOS.filter(c => !vacio(datos[c])).map(c => [c, datos[c]]));
    const persona = await db.personas.update({
      where: { id: existente.id },
      data: { ...nuevos, status: datos.status || 'active', deleted_at: null },
    });
    return { persona, aviso: null };
  }

  const huecos = Object.fromEntries(CAMPOS.filter(c => vacio(existente[c]) && !vacio(datos[c])).map(c => [c, datos[c]]));
  const persona = Object.keys(huecos).length
    ? await db.personas.update({ where: { id: existente.id }, data: huecos })
    : existente;
  return { persona, aviso: PERSONA_EN_USO };
}

module.exports = { reutilizarPersona, PERSONA_EN_USO };
