import { useState, useCallback } from 'react';
import { listSales, getSale, createSale, updateSale, voidSale, deleteSale, registerPayment, deletePayment, sendVoucher, updateReviewStatus } from '../api/sales';
import { Sale } from '../types';

export interface SalesMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const META_VACIA: SalesMeta = {
  page: 1, perPage: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [meta, setMeta] = useState<SalesMeta>(META_VACIA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Los filtros viajan al servidor: la tabla ya no filtra sobre una página suelta.
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSales({
        page,
        perPage,
        search: searchTerm || undefined,
        // 'all' es la opción vacía del selector, no un estado del enum.
        status: statusFilter && statusFilter !== 'all' ? statusFilter : undefined,
        dateFrom: startDate || undefined,
        dateTo: endDate ? `${endDate}T23:59:59` : undefined,
      });
      if (res.success && Array.isArray(res.data)) {
        setSales(res.data);
        setMeta(res.meta || META_VACIA);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar ventas';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, searchTerm, statusFilter, startDate, endDate]);

  // Cambiar un filtro devuelve a la primera página: si no, se puede quedar
  // pidiendo la página 5 de un resultado que ahora tiene 2.
  const conReinicio = <T,>(set: (v: T) => void) => (v: T) => { setPage(1); set(v); };

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
    meta,
    loading,
    error,
    searchTerm,
    setSearchTerm: conReinicio(setSearchTerm),
    statusFilter,
    setStatusFilter: conReinicio(setStatusFilter),
    startDate,
    setStartDate: conReinicio(setStartDate),
    endDate,
    setEndDate: conReinicio(setEndDate),
    page,
    setPage,
    perPage,
    setPerPage: conReinicio(setPerPage),
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
