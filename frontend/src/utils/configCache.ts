/**
 * configCache.ts
 * Módulo de caché en localStorage para la configuración de catálogos (tarjetas, formas de pago, aerolíneas, etc.).
 * TTL: 15 minutos — ya que los catálogos cambian con menos frecuencia que las ventas.
 * Al crear, modificar o eliminar elementos de los catálogos, el caché se invalida o se actualiza automáticamente.
 */

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

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
    // ignorar silenciosamente en caso de cuota excedida
  }
}

function deleteCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// ---------- API pública ----------

export function saveConfigCache(config: Record<string, any>): void {
  // Guardamos solo las listas de catálogos, excluyendo permisos de rol si estuviesen presentes
  const cacheData = { ...config };
  delete cacheData.rolePermissions; // Los permisos de roles siempre deben consultarse frescos
  writeCache(getCacheKey('itea_config_cache_v2'), cacheData);
}

export function loadConfigCache(): Record<string, any[]> | null {
  return readCache<Record<string, any[]>>(getCacheKey('itea_config_cache_v2'));
}

export function invalidateConfigCache(): void {
  deleteCache(getCacheKey('itea_config_cache_v2'));
}
