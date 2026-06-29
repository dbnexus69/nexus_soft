import React, { createContext, useContext, ReactNode } from 'react';
import { useSales } from '../hooks/useSales';

type SalesContextType = ReturnType<typeof useSales>;

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export const SalesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const sales = useSales();
  return (
    <SalesContext.Provider value={sales}>
      {children}
    </SalesContext.Provider>
  );
};

export const useSalesContext = () => {
  const context = useContext(SalesContext);
  if (context === undefined) {
    throw new Error('useSalesContext must be used within a SalesProvider');
  }
  return context;
};
