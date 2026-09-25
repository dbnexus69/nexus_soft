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
  // Arranca en `true` porque el hook pide los datos al montarse: con `false`,
  // el primer render caía en el estado vacío —"no hay ventas"— antes de
  // que la petición empezara, y el esqueleto salía después. Se veía el mensaje
  // equivocado durante un fotograma.
  const [loading, setLoading] = useState(true);
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

  // Los errores se dejan pasar tal cual. Antes cada manejador los envolvía en
  // `new Error(err.message)`, que descarta la respuesta de la API: el asistente
  // enseñaba "error interno" en vez del campo que la validación señalaba.
  const handleCreateSale = async (sale: any) => {
    const created = await createSale(sale);
    await fetchSales();
    return created;
  };

  const handleUpdateSale = async (id: number, saleUpdate: any) => {
    await updateSale(id, saleUpdate);
    await fetchSales();
  };

  const handleVoidSale = async (id: number, reason: string) => {
    await voidSale(id, reason);
    await fetchSales();
  };

  const handleDeleteSale = async (id: number) => {
    await deleteSale(id);
    await fetchSales();
  };

  const handleRegisterPayment = async (saleId: number, data: Record<string, unknown>) => {
    const res = await registerPayment(saleId, data);
    await fetchSales();
    return res;
  };

  const handleDeletePayment = async (saleId: number, paymentId: string, body?: Record<string, unknown>) => {
    const res = await deletePayment(saleId, paymentId, body);
    await fetchSales();
    return res;
  };

  const handleSendVoucher = async (saleId: number, pdfBase64: string) => {
    return await sendVoucher(saleId, pdfBase64);
  };

  const handleToggleReviewStatus = async (id: number, isReviewed: boolean) => {
    await updateReviewStatus(id, isReviewed);
    await fetchSales();
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
