/**
 * usersCache.ts
 * Caché en localStorage para la lista de usuarios.
 * TTL: 3 minutos — los usuarios cambian con menor frecuencia que las ventas.
 * Al crear/editar/eliminar usuarios, el caché se invalida automáticamente.
 */

import { claveCache } from './sesionLocal';

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos

function getCacheKey(baseKey: string): string {
  return claveCache(baseKey);
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

/** Guarda la lista de usuarios en caché */
/** Guarda la lista de usuarios en caché */
export function saveUsersCache(users: unknown[]): void {
  writeCache(getCacheKey('nexus_users_cache'), users);
}

/** Retorna usuarios desde caché si TTL no expiró, null si expirado */
export function loadUsersCache(): unknown[] | null {
  return readCache<unknown[]>(getCacheKey('nexus_users_cache'));
}

/** Invalida el caché de usuarios. Usar al crear/editar/eliminar. */
export function invalidateUsersCache(): void {
  deleteCache(getCacheKey('nexus_users_cache'));
}
