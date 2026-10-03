import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ClientsProvider } from './context/ClientsContext';
import { UsersProvider } from './context/UsersContext';
import { SalesProvider } from './context/SalesContext';
import { CommissionsProvider } from './context/CommissionsContext';
import { PermissionsProvider } from './context/PermissionsContext';
import { Layout } from './components/layout/Layout';
import Login from './pages/Login';

import { LoadingScreen } from './components/ui/LoadingScreen';

// Cada pantalla se descarga al entrar en ella, no todas juntas al abrir la aplicación: el paquete único
// pesaba 2,3 MB y el login cargaba también las quince pantallas que aún no se ven.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const StatsView = lazy(() => import('./pages/StatsView'));
const Sales = lazy(() => import('./pages/Sales'));
const Clients = lazy(() => import('./pages/Clients'));
const Responsables = lazy(() => import('./pages/Responsables'));
const Itineraries = lazy(() => import('./pages/Itineraries'));
const Users = lazy(() => import('./pages/Users'));
const Companies = lazy(() => import('./pages/Companies'));
const Config = lazy(() => import('./pages/Config'));
const CommissionAgents = lazy(() => import('./pages/CommissionAgents'));

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

/**
 * Solo el superadministrador del sistema.
 *
 * No es `isAdmin`: un administrador lo es DE su agencia, y administrar agencias
 * es del sistema. La guarda de verdad está en el backend; esta solo evita
 * enseñar una pantalla que iba a responder 403.
 */
function SuperadminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'superadmin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<LoadingScreen />}>
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="stats" element={<StatsView />} />
        <Route path="sales" element={<Sales />} />
        <Route path="clients" element={<Clients />} />
        <Route path="responsables" element={<AdminRoute><Responsables /></AdminRoute>} />
        <Route path="flights" element={<Itineraries />} />
        {/* La pantalla vivía en /itineraries. Sin este redirect, un marcador
            viejo caería en el catch-all de abajo y aterrizaría en el Dashboard
            sin explicación. */}
        <Route path="itineraries" element={<Navigate to="/flights" replace />} />
        <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
        <Route path="companies" element={<SuperadminRoute><Companies /></SuperadminRoute>} />
        <Route path="config" element={<AdminRoute><Config /></AdminRoute>} />
        <Route path="commissions" element={<CommissionAgents />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
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
                  <CommissionsProvider>
                    <DataProvider>
                      <AppRoutes />
                    </DataProvider>
                  </CommissionsProvider>
                </SalesProvider>
              </ClientsProvider>
            </UsersProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}