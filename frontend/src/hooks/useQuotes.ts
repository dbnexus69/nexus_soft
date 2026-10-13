import { useState, useCallback } from 'react';
import * as api from '../api/quotes';
import type { Quote } from '../types';
import type { Paginacion } from '../api/tipos';

export function useQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesMeta, setQuotesMeta] = useState<Paginacion>({ page: 1, perPage: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false });
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  const fetchQuotes = useCallback(async (params: { page?: number; perPage?: number; search?: string; status?: string } = {}) => {
    setLoadingQuotes(true);
    try {
      const data = await api.listQuotes(params);
      setQuotes(data.data || []);
      if (data.meta) setQuotesMeta(data.meta);
    } catch (err) {
      console.error('Error fetching quotes:', err);
    } finally {
      setLoadingQuotes(false);
    }
  }, []);

  // Los errores se dejan pasar tal cual (ver el mismo criterio en useCommissions.ts): envolverlos
  // en `new Error(msg)` descartaría `error.details`, que es lo que pinta el formulario.
  const handleCreateQuote = async (quote: Record<string, unknown>) => {
    const created = await api.createQuote(quote);
    await fetchQuotes({ page: 1, perPage: quotesMeta.perPage });
    return created;
  };

  const handleUpdateQuote = async (id: number, quote: Record<string, unknown>) => {
    const updated = await api.updateQuote(id, quote);
    await fetchQuotes({ page: quotesMeta.page, perPage: quotesMeta.perPage });
    return updated;
  };

  const handleDeleteQuote = async (id: number) => {
    await api.deleteQuote(id);
    await fetchQuotes({ page: quotesMeta.page, perPage: quotesMeta.perPage });
  };

  const handleDuplicateQuote = async (id: number) => {
    const created = await api.duplicateQuote(id);
    await fetchQuotes({ page: 1, perPage: quotesMeta.perPage });
    return created;
  };

  const handleSendQuote = async (id: number) => {
    const updated = await api.sendQuote(id);
    await fetchQuotes({ page: quotesMeta.page, perPage: quotesMeta.perPage });
    return updated;
  };

  const handleRespondQuote = async (id: number, accepted: boolean) => {
    const updated = await api.respondQuote(id, accepted);
    await fetchQuotes({ page: quotesMeta.page, perPage: quotesMeta.perPage });
    return updated;
  };

  return {
    quotes,
    quotesMeta,
    loadingQuotes,
    fetchQuotes,
    handleCreateQuote,
    handleUpdateQuote,
    handleDeleteQuote,
    handleDuplicateQuote,
    handleSendQuote,
    handleRespondQuote,
  };
}
