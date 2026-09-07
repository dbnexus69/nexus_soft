import api from './client';

import { CATALOGOS } from '../components/config/catalogos';

/**
 * Traducción de la clave del frontend (camelCase) a la sección de la API
 * (kebab-case). Se deriva de la definición de los catálogos: era un mapa
 * literal aquí, una quinta lista de las mismas ocho secciones que había que
 * mantener a mano.
 */
const SECTION_MAP: Record<string, string> =
  Object.fromEntries(CATALOGOS.map(c => [c.id, c.seccion]));

export async function getAllConfig() {
  const res = await api.get('/config/all');
  return res.data.data;
}

// Detalle completo de un elemento. El listado viene ligero: esto se pide
// cuando el usuario elige uno concreto.
export async function getConfigItem(section: string, id: number) {
  const urlSection = SECTION_MAP[section] || section;
  const res = await api.get(`/config/${urlSection}/${id}`);
  return res.data.data;
}

export async function getConfigSection(section: string, params: any = {}) {
  const urlSection = SECTION_MAP[section] || section;
  const res = await api.get(`/config/${urlSection}`, { params });
  return res.data;
}

export async function createConfigItem(section: string, data: Record<string, unknown>) {
  const urlSection = SECTION_MAP[section] || section;
  const res = await api.post(`/config/${urlSection}`, data);
  return res.data.data;
}

export async function updateConfigItem(section: string, id: number, data: Record<string, unknown>) {
  const urlSection = SECTION_MAP[section] || section;
  const res = await api.put(`/config/${urlSection}/${id}`, data);
  return res.data.data;
}

export async function deleteConfigItem(section: string, id: number) {
  const urlSection = SECTION_MAP[section] || section;
  await api.delete(`/config/${urlSection}/${id}`);
}
