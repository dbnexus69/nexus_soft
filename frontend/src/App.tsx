import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ClientsProvider } from './context/ClientsContext';
import { UsersProvider } from './context/UsersContext';
import { SalesProvider } from './context/SalesContext';
import { CommissionsProvider } from './context/CommissionsContext';
import { QuotesProvider } from './context/QuotesContext';
import { PermissionsProvider, usePermissions } from './context/PermissionsContext';
import type { RolePermissions } from './types';
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
const Empresa = lazy(() => import('./pages/Empresa'));
const CommissionAgents = lazy(() => import('./pages/CommissionAgents'));
const Quotes = lazy(() => import('./pages/Quotes'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <LoadingScreen />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <PermissionsProvider user={user}>{children}</PermissionsProvider>;
}

/**
 * Pantalla según el permiso de ver del rol (spec 025, H3), no según ser admin.
 * Va dentro de `ProtectedRoute`, que es quien monta el `PermissionsProvider`.
 */
function PermisoRoute({ modulo, editar = false, children }: { modulo: keyof RolePermissions; editar?: boolean; children: React.ReactNode }) {
  const { canView, canEdit } = usePermissions();
  if (!(editar ? canEdit(modulo) : canView(modulo))) return <Navigate to="/" replace />;
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
        <Route path="quotes" element={<Quotes />} />
        <Route path="clients" element={<Clients />} />
        <Route path="responsables" element={<PermisoRoute modulo="responsables"><Responsables /></PermisoRoute>} />
        <Route path="flights" element={<Itineraries />} />
        {/* La pantalla vivía en /itineraries. Sin este redirect, un marcador
            viejo caería en el catch-all de abajo y aterrizaría en el Dashboard
            sin explicación. */}
        <Route path="itineraries" element={<Navigate to="/flights" replace />} />
        <Route path="users" element={<PermisoRoute modulo="users"><Users /></PermisoRoute>} />
        <Route path="companies" element={<SuperadminRoute><Companies /></SuperadminRoute>} />
        {/* Gestión Interna administra los catálogos: pide editar. Ver `config` lo tiene todo rol porque el asistente
            de venta lee esos catálogos, y no por eso tiene que entrar a esta pantalla. */}
        <Route path="config" element={<PermisoRoute modulo="config" editar><Config /></PermisoRoute>} />
        <Route path="empresa" element={<Empresa />} />
        <Route path="commissions" element={<PermisoRoute modulo="commissions"><CommissionAgents /></PermisoRoute>} />
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
                    <QuotesProvider>
                      <DataProvider>
                        <AppRoutes />
                      </DataProvider>
                    </QuotesProvider>
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