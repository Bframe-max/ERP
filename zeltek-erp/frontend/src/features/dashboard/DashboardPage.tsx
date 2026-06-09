import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Monitor, ShoppingCart, AlertTriangle, Inbox, Wrench } from 'lucide-react';
import api from '@/lib/api';
import { CapitalDinamicoCard } from './CapitalDinamicoCard';

interface KPIs {
  inventario: {
    total: number;
    por_estado: Record<string, number>;
    disponibles: number;
    en_taller: number;
  };
  ventas_mes: {
    cantidad: number;
    ingresos_usd: number;
    ganancia_bruta_usd: number;
    variacion_ingresos_pct: number | null;
    variacion_ganancia_pct: number | null;
  };
  fondos: Record<string, number>;
  alerta_opex_negativo: boolean;
  inbox_pendiente: number;
  reparaciones_activas: number;
  gastos_mes_usd: number;
  capital_dinamico: {
    liquido: number;
    disponible: number;
    taller: number;
    accesorios: number;
  };
}

interface VentaReciente {
  id: string;
  numero_factura: string;
  fecha_venta: string;
  precio_venta_usd: number;
  ganancia_bruta_venta_usd: number;
  equipo: { marca: string; modelo: string };
  cliente: { nombre: string };
  vendedor: { nombre: string };
}

function fmt(n: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(parseFloat(String(n)));
}

function Variacion({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-500 text-xs">— sin datos</span>;
  const pos = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${pos ? 'text-success' : 'text-danger'}`}>
      {pos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {pos ? '+' : ''}{pct.toFixed(1)}% vs mes anterior
    </span>
  );
}

function KPICard({ titulo, valor, sub, icon, alerta }: {
  titulo: string; valor: string; sub?: React.ReactNode; icon: React.ReactNode; alerta?: boolean;
}) {
  return (
    <div className={`bg-app-surface rounded-card border p-5 flex flex-col gap-3 ${alerta ? 'border-danger/50' : 'border-app-border'}`}>
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{titulo}</p>
        <div className={`p-2 rounded-xl ${alerta ? 'bg-danger/10 text-danger' : 'bg-violet-600/10 text-violet-400'}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-100">{valor}</p>
      {sub && <div>{sub}</div>}
    </div>
  );
}

function FondoRow({ nombre, saldo, alerta }: { nombre: string; saldo: number; alerta?: boolean }) {
  const label = nombre.replace('REPARTO_', 'REPARTO ').replace('_', ' ');
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-app-border last:border-0 ${alerta ? 'text-danger' : ''}`}>
      <span className={`text-sm ${alerta ? 'text-danger' : 'text-slate-300'}`}>{label}</span>
      <span className={`text-sm font-mono font-semibold ${alerta ? 'text-danger' : 'text-slate-100'}`}>
        {fmt(saldo)}
        {alerta && <AlertTriangle size={12} className="inline ml-1" />}
      </span>
    </div>
  );
}

export function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [ventas, setVentas] = useState<VentaReciente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ data: KPIs }>('/dashboard/kpis'),
      api.get<{ data: VentaReciente[] }>('/dashboard/ventas-recientes?limit=8'),
    ]).then(([k, v]) => {
      setKpis(k.data.data);
      setVentas(v.data.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500 text-sm animate-pulse">Cargando dashboard...</div>
      </div>
    );
  }

  if (!kpis) return null;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Resumen operativo del mes actual</p>
      </div>

      {/* Capital del Negocio — full width */}
      <CapitalDinamicoCard
        liquido={kpis.capital_dinamico.liquido}
        disponible={kpis.capital_dinamico.disponible}
        taller={kpis.capital_dinamico.taller}
        accesorios={kpis.capital_dinamico.accesorios}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          titulo="Disponibles"
          valor={String(kpis.inventario.disponibles)}
          sub={<span className="text-slate-500 text-xs">{kpis.inventario.total} equipos en total</span>}
          icon={<Monitor size={18} />}
        />
        <KPICard
          titulo="Ventas este mes"
          valor={String(kpis.ventas_mes.cantidad)}
          sub={<Variacion pct={null} />}
          icon={<ShoppingCart size={18} />}
        />
        <KPICard
          titulo="Ingresos mes"
          valor={fmt(kpis.ventas_mes.ingresos_usd)}
          sub={<Variacion pct={kpis.ventas_mes.variacion_ingresos_pct} />}
          icon={<TrendingUp size={18} />}
        />
        <KPICard
          titulo="Ganancia bruta"
          valor={fmt(kpis.ventas_mes.ganancia_bruta_usd)}
          sub={<Variacion pct={kpis.ventas_mes.variacion_ganancia_pct} />}
          icon={<TrendingUp size={18} />}
        />
      </div>

      {/* Alertas rápidas */}
      {(kpis.alerta_opex_negativo || kpis.inbox_pendiente > 0 || kpis.reparaciones_activas > 0) && (
        <div className="flex flex-wrap gap-3">
          {kpis.alerta_opex_negativo && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-xl px-4 py-2.5 text-danger text-sm">
              <AlertTriangle size={15} />
              Fondo OPEX en negativo
            </div>
          )}
          {kpis.inbox_pendiente > 0 && (
            <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-xl px-4 py-2.5 text-warning text-sm">
              <Inbox size={15} />
              {kpis.inbox_pendiente} compra{kpis.inbox_pendiente !== 1 ? 's' : ''} pendiente{kpis.inbox_pendiente !== 1 ? 's' : ''} de triage
            </div>
          )}
          {kpis.reparaciones_activas > 0 && (
            <div className="flex items-center gap-2 bg-violet-600/10 border border-violet-600/30 rounded-xl px-4 py-2.5 text-violet-400 text-sm">
              <Wrench size={15} />
              {kpis.reparaciones_activas} reparación{kpis.reparaciones_activas !== 1 ? 'es' : ''} activa{kpis.reparaciones_activas !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Grid inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ventas recientes */}
        <div className="lg:col-span-2 bg-app-surface rounded-card border border-app-border">
          <div className="px-5 py-4 border-b border-app-border">
            <h2 className="text-sm font-semibold text-slate-100">Ventas recientes</h2>
          </div>
          {ventas.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-500 text-sm">No hay ventas registradas</div>
          ) : (
            <div className="divide-y divide-app-border">
              {ventas.map(v => (
                <div key={v.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-slate-100 text-sm font-medium truncate">
                      {v.equipo.marca} {v.equipo.modelo}
                    </p>
                    <p className="text-slate-500 text-xs">{v.cliente.nombre} · {v.numero_factura}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-slate-100 text-sm font-semibold">{fmt(v.precio_venta_usd)}</p>
                    <p className="text-success text-xs">+{fmt(v.ganancia_bruta_venta_usd)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fondos */}
        <div className="bg-app-surface rounded-card border border-app-border">
          <div className="px-5 py-4 border-b border-app-border">
            <h2 className="text-sm font-semibold text-slate-100">Fondos virtuales</h2>
          </div>
          <div className="px-5 py-2">
            {Object.entries(kpis.fondos).map(([nombre, saldo]) => (
              <FondoRow
                key={nombre}
                nombre={nombre}
                saldo={saldo}
                alerta={nombre === 'OPEX' && saldo < 0}
              />
            ))}
          </div>
          <div className="px-5 py-3 border-t border-app-border">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Gastos OPEX este mes</span>
              <span className="text-slate-200 font-mono">{fmt(kpis.gastos_mes_usd)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inventario por estado */}
      <div className="bg-app-surface rounded-card border border-app-border">
        <div className="px-5 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-slate-100">Inventario por estado</h2>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-3">
          {Object.entries(kpis.inventario.por_estado).map(([estado, count]) => (
            <div key={estado} className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-4 py-2">
              <span className="text-slate-400 text-xs">{estado.replace(/_/g, ' ')}</span>
              <span className="text-slate-100 text-sm font-bold">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
