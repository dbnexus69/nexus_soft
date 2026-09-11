/**
 * Borra del navegador las claves de la marca anterior.
 *
 * Todo lo que la aplicación guarda en `localStorage` pasó de `itea_*` a
 * `nexus_*`. Renombrar la clave no borra la vieja: se queda ahí, con el token y
 * las cachés de quien ya había entrado, para siempre y sin que nada la lea.
 *
 * No es una migración —los tokens anteriores ya no valen, porque no llevan
 * empresa— sino una limpieza: lo que no se va a volver a leer no debería seguir
 * ocupando el navegador de nadie, y menos un token.
 *
 * Se puede quitar dentro de unos meses, cuando todo el mundo haya entrado al
 * menos una vez.
 */
export function limpiarClavesViejas(): void {
  try {
    const viejas = Object.keys(localStorage).filter(k => k.startsWith('itea_'));
    viejas.forEach(k => localStorage.removeItem(k));
  } catch {
    // Un navegador con el almacenamiento bloqueado no tiene nada que limpiar.
  }
}
