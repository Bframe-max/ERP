import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-app-bg overflow-hidden">
      {/* Sidebar — Desktop (lg+) */}
      <aside className="hidden lg:flex">
        <Sidebar />
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        <div className="p-4 lg:p-6 h-full">
          <Outlet />
        </div>
      </main>

      {/* Bottom Nav — Mobile (< lg) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNav />
      </nav>
    </div>
  );
}
