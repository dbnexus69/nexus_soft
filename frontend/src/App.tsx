import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ClientsProvider } from './context/ClientsContext';
import { UsersProvider } from './context/UsersContext';
import { SalesProvider } from './context/SalesContext';
import { ConfigProvider } from './context/ConfigContext';
import { CommissionsProvider } from './context/CommissionsContext';
import { PermissionsProvider } from './context/PermissionsContext';
import { Layout } from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StatsView from './pages/StatsView';
import Sales from './pages/Sales';
import Clients from './pages/Clients';
import Responsables from './pages/Responsables';
import Itineraries from './pages/Itineraries';
import Users from './pages/Users';
import Config from './pages/Config';
import CommissionAgents from './pages/CommissionAgents';

import { LoadingScreen } from './components/ui/LoadingScreen';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <LoadingScreen />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <PermissionsProvider user={user}>{children}</PermissionsProvider>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="stats" element={<StatsView />} />
        <Route path="sales" element={<Sales />} />
        <Route path="clients" element={<Clients />} />
        <Route path="responsables" element={<AdminRoute><Responsables /></AdminRoute>} />
        <Route path="itineraries" element={<Itineraries />} />
        <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
        <Route path="config" element={<AdminRoute><Config /></AdminRoute>} />
        <Route path="commissions" element={<CommissionAgents />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <UsersProvider>
              <ClientsProvider>
                <SalesProvider>
                  <ConfigProvider>
                    <CommissionsProvider>
                      <DataProvider>
                        <AppRoutes />
                      </DataProvider>
                    </CommissionsProvider>
                  </ConfigProvider>
                </SalesProvider>
              </ClientsProvider>
            </UsersProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}