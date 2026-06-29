import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useCommissions } from '../hooks/useCommissions';

const CommissionsContext = createContext<ReturnType<typeof useCommissions> | undefined>(undefined);

export function CommissionsProvider({ children }: { children: ReactNode }) {
  const commissionsHook = useCommissions();

  useEffect(() => {
    commissionsHook.fetchCommissionAgents();
    commissionsHook.fetchSettlements();
  }, [commissionsHook.fetchCommissionAgents, commissionsHook.fetchSettlements]);

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
