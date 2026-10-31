/**
 * Lo único de la sesión que el navegador guarda a la vista: quién es (empresa y
 * usuario), nunca el token. El token vive en una cookie `httpOnly` que ningún
 * script puede leer (spec 035).
 *
 * Sirve para dos cosas: saber al recargar si vale la pena preguntar `/auth/me`,
 * y componer la clave de los cachés de `localStorage`. La empresa entra en la
 * clave, no solo el usuario: al suplantar, el superadministrador conserva su id
 * y el navegador le serviría los datos de la agencia anterior dentro de la
 * siguiente, sin error y sin aviso.
 */
const CLAVE = 'nexus_sesion';

/** Hasta que `/auth/me` confirme quién es, ningún caché usa la clave de antes. */
export const PENDIENTE = 'pendiente';

export function haySesionLocal(): boolean {
  try {
    return Boolean(localStorage.getItem(CLAVE));
  } catch {
    return false;
  }
}

export function guardarSesionLocal(valor: { empresaId?: number; id: number } | typeof PENDIENTE): void {
  try {
    localStorage.setItem(CLAVE, typeof valor === 'string' ? valor : `${valor.empresaId ?? 'sin-empresa'}_${valor.id}`);
  } catch {
    // Sin almacenamiento la sesión sigue en la cookie; solo se pierden los cachés.
  }
}

export function borrarSesionLocal(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que borrar.
  }
}

export function claveCache(base: string): string {
  try {
    return `${base}_${localStorage.getItem(CLAVE) || 'anonymous'}`;
  } catch {
    return `${base}_anonymous`;
  }
}
