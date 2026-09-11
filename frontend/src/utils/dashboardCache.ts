/**
 * dashboardCache.ts
 * Módulo de caché en localStorage para el Dashboard.
 * TTL: 5 minutos. La caché es por usuario para evitar fugas de datos.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function getCacheKey(): string {
  try {
    // Obtener el userId del token guardado en localStorage
    const token = localStorage.getItem('itea_token');
    if (!token) return 'itea_dashboard_cache_anonymous';
    // Decodificar el payload del JWT (sin verificar firma, solo para obtener userId)
    const payload = JSON.parse(atob(token.split('.')[1]));
    // La empresa entra en la clave, no solo el usuario: al suplantar, el
    // superadministrador conserva su userId y el navegador le serviría las
    // cifras de la agencia anterior dentro de la siguiente.
    return `itea_dashboard_cache_${payload.empresaId || 'sin-empresa'}_${payload.userId || 'unknown'}`;
  } catch {
    return 'itea_dashboard_cache_anonymous';
  }
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function saveDashboardCache(data: any): void {
  try {
    const entry: CacheEntry<any> = { data, timestamp: Date.now() };
    localStorage.setItem(getCacheKey(), JSON.stringify(entry));
  } catch {
    // Ignorar si localStorage está lleno
  }
}

export function loadDashboardCache(): any | null {
  try {
    const raw = localStorage.getItem(getCacheKey());
    if (!raw) return null;
    const entry: CacheEntry<any> = JSON.parse(raw);
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey());
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function invalidateDashboardCache(): void {
  try {
    localStorage.removeItem(getCacheKey());
  } catch {}
}
