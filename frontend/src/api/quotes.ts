import api from './client';
import type { Quote } from '../types';
import type { Pagina, Recurso } from './tipos';

export async function listQuotes(params: Record<string, unknown> = {}) {
  const res = await api.get<Pagina<Quote>>('/quotes', { params });
  return res.data;
}

export async function getQuote(id: number) {
  const res = await api.get<Recurso<Quote>>(`/quotes/${id}`);
  return res.data.data;
}

export async function createQuote(data: Record<string, unknown>) {
  const res = await api.post<Recurso<Quote>>('/quotes', data);
  return res.data.data;
}

export async function updateQuote(id: number, data: Record<string, unknown>) {
  const res = await api.put<Recurso<Quote>>(`/quotes/${id}`, data);
  return res.data.data;
}

export async function deleteQuote(id: number) {
  await api.delete(`/quotes/${id}`);
}

export async function duplicateQuote(id: number) {
  const res = await api.post<Recurso<Quote>>(`/quotes/${id}/duplicate`);
  return res.data.data;
}

export async function sendQuote(id: number) {
  const res = await api.post<Recurso<Quote>>(`/quotes/${id}/send`);
  return res.data.data;
}

export async function respondQuote(id: number, accepted: boolean) {
  const res = await api.post<Recurso<Quote>>(`/quotes/${id}/respond`, { accepted });
  return res.data.data;
}

/**
 * Lo que el asistente de venta necesita para precargar su borrador. No escribe ninguna venta.
 * `products` trae el detalle completo de cada servicio, agrupado por categoría (la misma forma
 * que `ticketData`/`hotelData`... del cuerpo de una venta), listo para asignar tal cual a cada
 * array de `WizardFormData`.
 */
export interface QuoteDraft {
  quoteId: number;
  clientId: number | null;
  client: Record<string, unknown> | null;
  products: Record<string, Record<string, unknown>[]>;
}

export async function convertQuoteToSale(id: number) {
  const res = await api.post<Recurso<QuoteDraft>>(`/quotes/${id}/convert-to-sale`);
  return res.data.data;
}

/** Se llama justo después de que `POST /sales` cree la venta, para enlazarla de vuelta. */
export async function linkQuoteSale(id: number, saleId: number) {
  const res = await api.patch<Recurso<Quote>>(`/quotes/${id}/link-sale`, { saleId });
  return res.data.data;
}

/** URL firmada (5 min) del PDF de la cotización; lo genera y lo guarda el servidor. */
export async function getQuotePdfUrl(id: number) {
  const res = await api.get<Recurso<{ url: string; expiraEn: number }>>(`/quotes/${id}/pdf`);
  return res.data.data;
}
