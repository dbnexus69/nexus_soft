/**
 * clientsCache.ts
 * Caché en localStorage del catálogo de clientes.
 * TTL: 5 minutos; pasado ese tiempo se recarga desde red.
 *
 * Antes guardaba también las ventas, en la misma operación: invalidar una
 * borraba la otra. Las ventas ya no se cachean en el cliente — su listado vive
 * en SalesContext, paginado y filtrado por el servidor.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function getCacheKey(baseKey: string): string {
  try {
    const token = localStorage.getItem('itea_token');
    if (!token) return `${baseKey}_anonymous`;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return `${baseKey}_${payload.userId || 'unknown'}`;
  } catch {
    return `${baseKey}_anonymous`;
  }
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage puede estar lleno — ignorar silenciosamente
  }
}

function deleteCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// ---------- API pública ----------

// Ventas y clientes se guardaban en la misma llamada, y al invalidar una se
// borraba también la otra. Ahora cada colección va por su lado: cuando la rama
// de ventas salga del DataContext, la de clientes no se ve afectada.


/** Guarda los clientes en caché con timestamp actual */
export function saveClientsCache(clients: unknown[]): void {
  writeCache(getCacheKey('itea_clients_cache'), clients);
}


/** Retorna clientes desde caché si TTL no expiró, null si expirado */
export function loadClientsCache(): unknown[] | null {
  return readCache<unknown[]>(getCacheKey('itea_clients_cache'));
}


/** Invalida la caché de clientes. */
export function invalidateClientsCache(): void {
  deleteCache(getCacheKey('itea_clients_cache'));
}
