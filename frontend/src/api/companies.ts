import api from './client';

export interface Empresa {
  id: number;
  slug: string;
  nombre: string;
  nombreComercial: string | null;
  logoUrl: string | null;
  colorPrimario: string | null;
  colorAcento: string | null;
  colorRealce: string | null;
  emailRemitente: string | null;
  emailNombre: string | null;
  estado: 'activa' | 'suspendida';
  creadoAt: string;
  uso?: { usuarios: number; clientes: number; ventas: number };
}

export interface NuevaEmpresa {
  slug: string;
  nombre: string;
  colorPrimario?: string;
  colorAcento?: string;
  colorRealce?: string;
  admin: { firstName: string; lastName: string; email: string; password: string };
}

export async function listCompanies(params: Record<string, unknown> = {}) {
  const res = await api.get('/companies', { params });
  return res.data as { data: Empresa[]; meta: { total: number; totalPages: number; page: number } };
}

export async function getCompany(id: number) {
  const res = await api.get(`/companies/${id}`);
  return res.data.data as Empresa;
}

export async function createCompany(datos: NuevaEmpresa) {
  const res = await api.post('/companies', datos);
  return res.data.data as Empresa;
}

export async function updateCompany(id: number, datos: Record<string, unknown>) {
  const res = await api.patch(`/companies/${id}`, datos);
  return res.data.data as Empresa;
}

export async function uploadCompanyLogo(id: number, archivo: File) {
  const cuerpo = new FormData();
  cuerpo.append('logo', archivo);
  const res = await api.put(`/companies/${id}/logo`, cuerpo, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data as Empresa;
}

export async function getBranding() {
  const res = await api.get('/branding');
  return res.data.data;
}
