import api from './client';
import type { Recurso } from './tipos';

/** Una cláusula del voucher. */
export interface Clausula { titulo: string; texto: string }

/** El perfil de la agencia (spec 011): lo ve cualquiera de ella y lo edita su admin. */
export interface PerfilEmpresa {
  slug: string;
  nombre: string;
  nombreComercial: string | null;
  nit: string | null;
  direccion: string | null;
  telefono: string | null;
  emailContacto: string | null;
  sitioWeb: string | null;
  logoUrl: string | null;
  colorPrimario: string | null;
  colorAcento: string | null;
  colorRealce: string | null;
  voucherPie: string | null;
  /** null = la agencia usa los términos por defecto. */
  voucherTerminos: Clausula[] | null;
}

export type CambiosPerfil = Partial<Omit<PerfilEmpresa, 'slug' | 'nombre' | 'logoUrl'>>;

export async function getCompanyProfile() {
  const res = await api.get<Recurso<PerfilEmpresa>>('/company-profile');
  return res.data.data;
}

export async function updateCompanyProfile(cambios: CambiosPerfil) {
  const res = await api.patch<Recurso<PerfilEmpresa>>('/company-profile', cambios);
  return res.data.data;
}

export async function uploadCompanyProfileLogo(archivo: File) {
  const form = new FormData();
  form.append('logo', archivo);
  const res = await api.put<Recurso<PerfilEmpresa>>('/company-profile/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data.data;
}

/** El PDF de una venta de ejemplo con el borrador sin guardar. */
export async function previewVoucher(borrador: CambiosPerfil) {
  const res = await api.post<Blob>('/company-profile/voucher-preview', borrador, { responseType: 'blob' });
  return res.data;
}
