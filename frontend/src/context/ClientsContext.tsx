import React, { createContext, useContext, ReactNode } from 'react';
import { useClients } from '../hooks/useClients';

type ClientsContextType = ReturnType<typeof useClients>;

const ClientsContext = createContext<ClientsContextType | undefined>(undefined);

export const ClientsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const clients = useClients();
  return (
    <ClientsContext.Provider value={clients}>
      {children}
    </ClientsContext.Provider>
  );
};

export const useClientsContext = () => {
  const context = useContext(ClientsContext);
  if (context === undefined) {
    throw new Error('useClientsContext must be used within a ClientsProvider');
  }
  return context;
};
