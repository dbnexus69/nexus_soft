import React, { createContext, useContext, ReactNode } from 'react';
import { useUsers } from '../hooks/useUsers';

type UsersContextType = ReturnType<typeof useUsers>;

const UsersContext = createContext<UsersContextType | undefined>(undefined);

export const UsersProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const users = useUsers();
  return (
    <UsersContext.Provider value={users}>
      {children}
    </UsersContext.Provider>
  );
};

export const useUsersContext = () => {
  const context = useContext(UsersContext);
  if (context === undefined) {
    throw new Error('useUsersContext must be used within a UsersProvider');
  }
  return context;
};
