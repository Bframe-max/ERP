import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { useAuthStore } from './stores/authStore';

// Lazy pages — se agregan en las fases siguientes
function PlaceholderPage({ titulo }: { titulo: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-100">{titulo}</h1>
        <p className="text-slate-400 mt-2">Módulo en desarrollo — Fase siguiente</p>
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
          <Route path="dashboard" element={<PlaceholderPage titulo="Dashboard" />} />
          <Route path="inbox" element={<PlaceholderPage titulo="Bandeja de Entrada" />} />
          <Route path="inventario" element={<PlaceholderPage titulo="Inventario" />} />
          <Route path="reparaciones" element={<PlaceholderPage titulo="Reparaciones" />} />
          <Route path="ventas" element={<PlaceholderPage titulo="Ventas" />} />
          <Route path="productos" element={<PlaceholderPage titulo="Productos" />} />
          <Route path="compras" element={<PlaceholderPage titulo="Compras / Lotes" />} />
          <Route path="reportes" element={<PlaceholderPage titulo="Reportes" />} />
          <Route path="gastos" element={<PlaceholderPage titulo="Gastos" />} />
          <Route path="garantias" element={<PlaceholderPage titulo="Garantías" />} />
          <Route path="inversores" element={<PlaceholderPage titulo="Inversores" />} />
          <Route path="usuarios" element={<PlaceholderPage titulo="Usuarios" />} />
          <Route path="configuracion" element={<PlaceholderPage titulo="Configuración" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
