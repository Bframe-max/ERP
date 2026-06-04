import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Monitor, ShoppingCart, Wrench, MoreHorizontal } from 'lucide-react';

export function BottomNav() {
  const items = [
    { href: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { href: '/inventario', icon: <Monitor size={20} />, label: 'Inventario' },
    { href: '/ventas', icon: <ShoppingCart size={20} />, label: 'Ventas' },
    { href: '/reparaciones', icon: <Wrench size={20} />, label: 'Taller' },
    { href: '/mas', icon: <MoreHorizontal size={20} />, label: 'Más' },
  ];

  return (
    <div className="bg-app-sidebar border-t border-app-border flex items-center justify-around px-2 py-2 safe-area-bottom">
      {items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
              isActive ? 'text-violet-400' : 'text-slate-500'
            }`
          }
        >
          {item.icon}
          <span className="text-xs">{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}
