import React, { createContext, useContext, ReactNode } from 'react';
import { useQuotes } from '../hooks/useQuotes';

const QuotesContext = createContext<ReturnType<typeof useQuotes> | undefined>(undefined);

export function QuotesProvider({ children }: { children: ReactNode }) {
  // Sin carga al montar, mismo criterio que CommissionsProvider: el único consumidor
  // (Quotes.tsx) pide lo suyo al abrirse.
  const quotesHook = useQuotes();

  return (
    <QuotesContext.Provider value={quotesHook}>
      {children}
    </QuotesContext.Provider>
  );
}

export function useQuotesContext() {
  const context = useContext(QuotesContext);
  if (context === undefined) {
    throw new Error('useQuotesContext must be used within a QuotesProvider');
  }
  return context;
}
