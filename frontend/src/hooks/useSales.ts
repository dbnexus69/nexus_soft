import { useState, useCallback } from 'react';
import { listSales, getSale, createSale, updateSale, voidSale, deleteSale, registerPayment, deletePayment, sendVoucher, updateReviewStatus } from '../api/sales';
import { Sale } from '../types';

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSales({ search: searchTerm, status: statusFilter });
      if (res.success && Array.isArray(res.data)) {
        setSales(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar ventas';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  const handleGetSaleDetail = async (id: number) => {
    return await getSale(id);
  };

  const handleCreateSale = async (sale: any) => {
    try {
      const created = await createSale(sale);
      await fetchSales();
      return created;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear venta';
      throw new Error(msg);
    }
  };

  const handleUpdateSale = async (id: number, saleUpdate: any) => {
    try {
      await updateSale(id, saleUpdate);
      await fetchSales();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar venta';
      throw new Error(msg);
    }
  };

  const handleVoidSale = async (id: number, reason: string) => {
    try {
      await voidSale(id, reason);
      await fetchSales();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al anular venta';
      throw new Error(msg);
    }
  };

  const handleDeleteSale = async (id: number) => {
    try {
      await deleteSale(id);
      await fetchSales();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar venta';
      throw new Error(msg);
    }
  };

  const handleRegisterPayment = async (saleId: number, data: Record<string, unknown>) => {
    try {
      const res = await registerPayment(saleId, data);
      await fetchSales();
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar pago';
      throw new Error(msg);
    }
  };

  const handleDeletePayment = async (saleId: number, paymentId: string, body?: Record<string, unknown>) => {
    try {
      const res = await deletePayment(saleId, paymentId, body);
      await fetchSales();
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar pago';
      throw new Error(msg);
    }
  };

  const handleSendVoucher = async (saleId: number, pdfBase64: string) => {
    return await sendVoucher(saleId, pdfBase64);
  };

  const handleToggleReviewStatus = async (id: number, isReviewed: boolean) => {
    try {
      await updateReviewStatus(id, isReviewed);
      await fetchSales();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar estado de revisión';
      throw new Error(msg);
    }
  };

  return {
    sales,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    fetchSales,
    handleGetSaleDetail,
    handleCreateSale,
    handleUpdateSale,
    handleVoidSale,
    handleDeleteSale,
    handleRegisterPayment,
    handleDeletePayment,
    handleSendVoucher,
    handleToggleReviewStatus
  };
}
