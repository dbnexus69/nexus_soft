import type { WizardFormData } from '../components/sales/wizardData';

const PREFIJO = 'nexus_new_sale_draft_';

/** El borrador del asistente de venta mientras la página sigue abierta; en localStorage solo cabe sin archivos. */
export const borradoresEnMemoria = new Map<string, WizardFormData>();

/**
 * Olvida los borradores de un usuario: llevan documentos y fechas de nacimiento de pasajeros, y en un equipo
 * compartido no deben quedar para el siguiente. Solo al cerrar sesión a mano: si la sesión caduca, una venta a
 * medias se conserva (spec 039, H14).
 */
export function olvidarBorradoresDe(usuarioId: number | string) {
  const delUsuario = (clave: string) => clave.startsWith(PREFIJO) && clave.endsWith(`_${usuarioId}`);
  for (const clave of [...borradoresEnMemoria.keys()]) {
    if (delUsuario(clave)) borradoresEnMemoria.delete(clave);
  }
  try {
    for (const clave of Object.keys(localStorage)) {
      if (delUsuario(clave)) localStorage.removeItem(clave);
    }
  } catch (error) {
    console.warn('[DRAFT_CLEANUP_FAILED]', error);
  }
}
