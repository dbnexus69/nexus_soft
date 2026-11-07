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
  /** Si está, reemplaza del todo la banda de color + logo + nombre del voucher. */
  voucherEncabezadoImagenUrl: string | null;
  /** Se agrega sobre el texto de `voucherPie`, que sigue aparte. */
  voucherPieImagenUrl: string | null;
}

export type CambiosPerfil = Partial<Omit<PerfilEmpresa, 'slug' | 'nombre' | 'logoUrl' | 'voucherEncabezadoImagenUrl' | 'voucherPieImagenUrl'>>;

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

/** Imagen propia para el encabezado del voucher: reemplaza del todo la banda de color + logo + nombre. */
export async function uploadVoucherHeaderImage(archivo: File) {
  const form = new FormData();
  form.append('imagen', archivo);
  const res = await api.put<Recurso<PerfilEmpresa>>('/company-profile/voucher-encabezado', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data.data;
}

/** Imagen propia para el pie del voucher, además del texto de `voucherPie`. */
export async function uploadVoucherFooterImage(archivo: File) {
  const form = new FormData();
  form.append('imagen', archivo);
  const res = await api.put<Recurso<PerfilEmpresa>>('/company-profile/voucher-pie-imagen', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data.data;
}

/** El PDF de una venta de ejemplo con el borrador sin guardar. */
export async function previewVoucher(borrador: CambiosPerfil) {
  const res = await api.post<Blob>('/company-profile/voucher-preview', borrador, { responseType: 'blob' });
  return res.data;
}
