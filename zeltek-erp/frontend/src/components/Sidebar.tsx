import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, Monitor, Wrench, ShoppingCart,
  Package, ShoppingBag, BarChart3, Receipt, ShieldAlert,
  TrendingUp, UserCog, Settings2, LogOut,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { usePendientesInbox } from '../hooks/usePendientesInbox';

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  soloAdmin?: boolean;
}

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          isActive
            ? 'bg-violet-600 text-white'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
        }`
      }
    >
      {item.icon}
      <span className="flex-1">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="bg-warning text-slate-900 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { usuario, logout } = useAuthStore();
  const navigate = useNavigate();
  const pendientesInbox = usePendientesInbox();

  const navPrincipal: NavItem[] = [
    { href: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { href: '/inbox', icon: <Inbox size={18} />, label: 'Inbox', badge: pendientesInbox },
    { href: '/inventario', icon: <Monitor size={18} />, label: 'Inventario' },
    { href: '/reparaciones', icon: <Wrench size={18} />, label: 'Reparaciones' },
    { href: '/ventas', icon: <ShoppingCart size={18} />, label: 'Ventas' },
  ];

  const navAdmin: NavItem[] = [
    { href: '/productos', icon: <Package size={18} />, label: 'Productos' },
    { href: '/compras', icon: <ShoppingBag size={18} />, label: 'Compras / Lotes' },
    { href: '/reportes', icon: <BarChart3 size={18} />, label: 'Reportes' },
    { href: '/gastos', icon: <Receipt size={18} />, label: 'Gastos' },
    { href: '/garantias', icon: <ShieldAlert size={18} />, label: 'Garantías' },
    { href: '/inversores', icon: <TrendingUp size={18} />, label: 'Inversores' },
  ];

  const navSistema: NavItem[] = [
    { href: '/usuarios', icon: <UserCog size={18} />, label: 'Usuarios', soloAdmin: true },
    { href: '/configuracion', icon: <Settings2 size={18} />, label: 'Configuración' },
  ];

  async function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="w-64 h-full bg-app-sidebar border-r border-app-border flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-app-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">Z</span>
          </div>
          <div>
            <p className="text-slate-100 font-bold text-sm">ZELTEK</p>
            <p className="text-slate-500 text-xs">ERP Nicaragua</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider px-3 mb-2">
            Principal
          </p>
          <div className="space-y-0.5">
            {navPrincipal.map((item) => (
              <NavItemLink key={item.href} item={item} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider px-3 mb-2">
            Administración
          </p>
          <div className="space-y-0.5">
            {navAdmin.map((item) => (
              (!item.soloAdmin || usuario?.rol === 'ADMIN') && (
                <NavItemLink key={item.href} item={item} />
              )
            ))}
          </div>
        </div>

        <div>
          <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider px-3 mb-2">
            Sistema
          </p>
          <div className="space-y-0.5">
            {navSistema.map((item) => (
              (!item.soloAdmin || usuario?.rol === 'ADMIN') && (
                <NavItemLink key={item.href} item={item} />
              )
            ))}
          </div>
        </div>
      </div>

      {/* Footer — usuario actual */}
      <div className="px-3 py-4 border-t border-app-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
          <div className="w-8 h-8 bg-violet-600/20 rounded-full flex items-center justify-center">
            <span className="text-violet-400 text-sm font-bold">
              {usuario?.nombre?.[0]?.toUpperCase() ?? 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-100 text-sm font-medium truncate">{usuario?.nombre}</p>
            <p className="text-slate-500 text-xs">{usuario?.rol}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-danger transition-colors p-1"
            title="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
