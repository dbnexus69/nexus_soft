import api from './client';

export async function listSales(params: Record<string, unknown>) {
  const res = await api.get('/sales', { params });
  return res.data;
}

export async function getSale(id: number) {
  const res = await api.get(`/sales/${id}`);
  return res.data.data;
}

export async function createSale(data: Record<string, unknown>) {
  const res = await api.post('/sales', data);
  return res.data.data;
}

export async function updateSale(id: number, data: Record<string, unknown>) {
  const res = await api.put(`/sales/${id}`, data);
  return res.data.data;
}

export async function deleteSale(id: number) {
  await api.delete(`/sales/${id}`);
}

export async function voidSale(id: number, reason: string) {
  const res = await api.post(`/sales/${id}/void`, { reason });
  return res.data.data;
}

export async function registerPayment(saleId: number, data: Record<string, unknown>) {
  const res = await api.post(`/sales/${saleId}/payments`, data);
  return res.data.data;
}

export async function deletePayment(saleId: number, paymentId: string, body?: Record<string, unknown>) {
  const res = await api.delete(`/sales/${saleId}/payments/${paymentId}`, { data: body });
  return res.data.data;
}

export async function getSalePayments(saleId: number) {
  const res = await api.get(`/sales/${saleId}/payments`);
  return res.data.data;
}

// Productos (15 tipos)
export async function createProduct(saleId: number, category: string, data: Record<string, unknown>) {
  const res = await api.post(`/sales/${saleId}/products/${category}`, data);
  return res.data.data;
}

export async function updateProduct(saleId: number, category: string, id: string, data: Record<string, unknown>) {
  const res = await api.put(`/sales/${saleId}/products/${category}/${id}`, data);
  return res.data.data;
}

export async function deleteProduct(saleId: number, category: string, id: string) {
  await api.delete(`/sales/${saleId}/products/${category}/${id}`);
}

export async function sendVoucher(saleId: number, pdfBase64: string) {
  const res = await api.post(`/sales/${saleId}/send-voucher`, { pdfBase64 });
  return res.data.data;
}

export async function updateReviewStatus(id: number, isReviewed: boolean) {
  const res = await api.patch(`/sales/${id}/review-status`, { isReviewed });
  return res.data.data;
}
