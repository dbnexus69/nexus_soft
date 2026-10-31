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
  /** Licenciamiento (spec 029): nulo = sin límite (plan Deluxe). */
  limiteUsuarios: number | null;
  nombrePlan: string | null;
  precioPlan: number | null;
  estado: 'activa' | 'suspendida';
  creadoAt: string;
  uso?: { usuarios: number; usuariosActivos: number; clientes: number; ventas: number };
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

// Crear y editar responden el id y lo que se mandó; el logo, su URL (spec 034).
export async function createCompany(datos: NuevaEmpresa) {
  const res = await api.post('/companies', datos);
  return res.data.data as Partial<Empresa> & { id: number };
}

export async function updateCompany(id: number, datos: Record<string, unknown>) {
  const res = await api.patch(`/companies/${id}`, datos);
  return res.data.data as Partial<Empresa> & { id: number };
}

export async function uploadCompanyLogo(id: number, archivo: File) {
  const cuerpo = new FormData();
  cuerpo.append('logo', archivo);
  const res = await api.put(`/companies/${id}/logo`, cuerpo, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data as Pick<Empresa, 'id' | 'logoUrl'>;
}

export async function getBranding() {
  const res = await api.get('/branding');
  return res.data.data;
}

export async function startImpersonation(id: number, motivo: string) {
  const res = await api.post(`/companies/${id}/impersonations`, { motivo });
  return res.data.data as { suplantacionId: string; empresa: Empresa; expiraAt: string; motivo: string };
}

export async function stopImpersonation(companyId: number, impersonationId: string) {
  const res = await api.delete(`/companies/${companyId}/impersonations/${impersonationId}`);
  // `restaurada`: el servidor devolvió la sesión del superadministrador; si no, no queda ninguna.
  return res.data.data as { restaurada: boolean };
}
