import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { InventarioPage } from './features/inventario/InventarioPage';
import { VentasPage } from './features/ventas/VentasPage';
import { ProductosPage } from './features/productos/ProductosPage';
import { ComprasPage } from './features/compras/ComprasPage';
import { ReparacionesPage } from './features/reparaciones/ReparacionesPage';
import { ReportesPage } from './features/reportes/ReportesPage';
import { GastosPage } from './features/gastos/GastosPage';
import { InversoresPage } from './features/inversores/InversoresPage';
import { useAuthStore } from './stores/authStore';

function PlaceholderPage({ titulo }: { titulo: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-100">{titulo}</h1>
        <p className="text-slate-400 mt-2">Módulo en desarrollo</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuthStore();
  if (!usuario) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="inbox" element={<PlaceholderPage titulo="Bandeja de Entrada" />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="reparaciones" element={<ReparacionesPage tipo="externa" />} />
          <Route path="ventas" element={<VentasPage />} />
          <Route path="productos" element={<ProductosPage />} />
          <Route path="compras" element={<ComprasPage />} />
          <Route path="reportes" element={<ReportesPage />} />
          <Route path="gastos" element={<GastosPage />} />
          <Route path="garantias" element={<ReparacionesPage tipo="garantia" />} />
          <Route path="inversores" element={<InversoresPage />} />
          <Route path="usuarios" element={<PlaceholderPage titulo="Usuarios" />} />
          <Route path="configuracion" element={<PlaceholderPage titulo="Configuración" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
