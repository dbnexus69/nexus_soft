import React, { createContext, useContext, ReactNode } from 'react';
import { useCommissions } from '../hooks/useCommissions';

const CommissionsContext = createContext<ReturnType<typeof useCommissions> | undefined>(undefined);

export function CommissionsProvider({ children }: { children: ReactNode }) {
  // Sin carga al montar. El provider vive en la raíz de la app, así que la
  // hacía en cualquier pantalla —el login incluido, sin sesión: dos 401 en cada
  // arranque— y duplicaba la de `CommissionAgents`, su único consumidor, que
  // pide lo suyo al abrirse.
  const commissionsHook = useCommissions();

  return (
    <CommissionsContext.Provider value={commissionsHook}>
      {children}
    </CommissionsContext.Provider>
  );
}

export function useCommissionsContext() {
  const context = useContext(CommissionsContext);
  if (context === undefined) {
    throw new Error('useCommissionsContext must be used within a CommissionsProvider');
  }
  return context;
}
