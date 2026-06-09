import { NavLink, useNavigate } from 'react-router-dom';
import {
  Package, ShoppingBag, BarChart3, Receipt, ShieldAlert,
  TrendingUp, UserCog, Settings2, LogOut, Wallet, Sun, Moon, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { usePendientesInbox } from '../../hooks/usePendientesInbox';

interface MenuItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  soloAdmin?: boolean;
}

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <NavLink
      to={item.href}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-800/30 transition-colors"
    >
      <span className="text-slate-400">{item.icon}</span>
      <span className="flex-1 text-slate-100 text-sm font-medium">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="bg-warning text-slate-900 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {item.badge}
        </span>
      )}
      <ChevronRight size={16} className="text-slate-600" />
    </NavLink>
  );
}

export function MasPage() {
  const { usuario, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const pendientesInbox = usePendientesInbox();

  const items: MenuItem[] = [
    { href: '/productos', icon: <Package size={18} />, label: 'Productos' },
    { href: '/compras', icon: <ShoppingBag size={18} />, label: 'Compras', badge: pendientesInbox },
    { href: '/reportes', icon: <BarChart3 size={18} />, label: 'Reportes' },
    { href: '/gastos', icon: <Receipt size={18} />, label: 'Gastos' },
    { href: '/garantias', icon: <ShieldAlert size={18} />, label: 'Garantías' },
    { href: '/inversores', icon: <TrendingUp size={18} />, label: 'Inversores' },
    { href: '/fondos', icon: <Wallet size={18} />, label: 'Fondos Virtuales' },
    { href: '/usuarios', icon: <UserCog size={18} />, label: 'Usuarios', soloAdmin: true },
    { href: '/configuracion', icon: <Settings2 size={18} />, label: 'Configuración' },
  ];

  async function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Más</h1>
        <p className="text-slate-500 text-sm mt-0.5">Módulos adicionales y ajustes</p>
      </div>

      {/* Usuario actual */}
      <div className="bg-app-surface rounded-card border border-app-border flex items-center gap-3 px-4 py-4">
        <div className="w-11 h-11 bg-brand/20 rounded-full flex items-center justify-center shrink-0">
          <span className="text-brand-light text-base font-bold">
            {usuario?.nombre?.[0]?.toUpperCase() ?? 'U'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-100 text-sm font-semibold truncate">{usuario?.nombre}</p>
          <p className="text-slate-500 text-xs">{usuario?.rol}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-slate-400 hover:text-danger transition-colors px-3 py-2 rounded-xl text-sm"
        >
          <LogOut size={16} />
          Salir
        </button>
      </div>

      {/* Tema */}
      <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-800/30 transition-colors"
        >
          <span className="text-slate-400">{theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}</span>
          <span className="flex-1 text-slate-100 text-sm font-medium text-left">
            {theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}
          </span>
          <span className="text-slate-500 text-xs">Cambiar a {theme === 'dark' ? 'claro' : 'oscuro'}</span>
        </button>
      </div>

      {/* Módulos */}
      <div className="bg-app-surface rounded-card border border-app-border divide-y divide-app-border overflow-hidden">
        {items.map((item) => (
          (!item.soloAdmin || usuario?.rol === 'ADMIN') && (
            <MenuRow key={item.href} item={item} />
          )
        ))}
      </div>
    </div>
  );
}
