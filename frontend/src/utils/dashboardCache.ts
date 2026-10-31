
import { claveCache } from './sesionLocal';
import type { DashboardStats } from '../types';
/**
 * dashboardCache.ts
 * Módulo de caché en localStorage para el Dashboard.
 * TTL: 5 minutos. La caché es por usuario para evitar fugas de datos.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function getCacheKey(): string {
  return claveCache('nexus_dashboard_cache');
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function saveDashboardCache(data: DashboardStats): void {
  try {
    const entry: CacheEntry<DashboardStats> = { data, timestamp: Date.now() };
    localStorage.setItem(getCacheKey(), JSON.stringify(entry));
  } catch {
    // Ignorar si localStorage está lleno
  }
}

export function loadDashboardCache(): DashboardStats | null {
  try {
    const raw = localStorage.getItem(getCacheKey());
    if (!raw) return null;
    const entry: CacheEntry<DashboardStats> = JSON.parse(raw);
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
