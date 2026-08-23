import api from './client';

const SECTION_MAP: Record<string, string> = {
  cards: 'cards',
  paymentMethods: 'payment-methods',
  documentTypes: 'document-types',
  airlines: 'airlines',
  suppliers: 'suppliers',
  airports: 'airports',
  baggage: 'baggage',
  packages: 'packages',
};

export async function getAllConfig() {
  const res = await api.get('/config/all');
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
