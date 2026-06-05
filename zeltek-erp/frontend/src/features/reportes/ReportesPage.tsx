import { useState } from 'react';
import { RefreshCw, FileText, TrendingUp, User, Archive } from 'lucide-react';
import { reportesService } from './reportesService';

// ─── Componente: Reporte de Ventas ──────────────────────────────────────────

function ReporteVentas() {
  const [desde, setDesde] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const res = await reportesService.getReporteVentas({ desde, hasta });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-end bg-slate-800/30 p-4 rounded-xl border border-app-border">
        <div>
          <label className="block text-slate-400 text-xs mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </div>
        <button onClick={cargar} disabled={loading}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />}
          Generar
        </button>
      </div>

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-app-surface p-4 rounded-xl border border-app-border">
              <p className="text-slate-500 text-xs font-medium uppercase">Ingresos Totales</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">{fmt(data.resumen.ingresos_usd)}</p>
              <p className="text-slate-500 text-xs mt-1">{data.resumen.cantidad_ventas} ventas</p>
            </div>
            <div className="bg-app-surface p-4 rounded-xl border border-app-border">
              <p className="text-slate-500 text-xs font-medium uppercase">CTR Total</p>
              <p className="text-2xl font-bold text-slate-300 mt-1">{fmt(data.resumen.ctr_total_usd)}</p>
            </div>
            <div className="bg-app-surface p-4 rounded-xl border border-app-border">
              <p className="text-slate-500 text-xs font-medium uppercase">Ganancia Bruta</p>
              <p className="text-2xl font-bold text-success mt-1">{fmt(data.resumen.ganancia_bruta_usd)}</p>
            </div>
            <div className="bg-app-surface p-4 rounded-xl border border-app-border border-l-4 border-l-violet-500">
              <p className="text-slate-500 text-xs font-medium uppercase">Fondo Reparto (Socios)</p>
              <p className="text-2xl font-bold text-violet-400 mt-1">{fmt(data.resumen.pf_reparto_usd)}</p>
            </div>
          </div>
          
          <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-slate-400 font-medium text-xs uppercase">Factura</th>
                  <th className="px-4 py-3 text-slate-400 font-medium text-xs uppercase">Equipo</th>
                  <th className="px-4 py-3 text-slate-400 font-medium text-xs uppercase text-right">Precio</th>
                  <th className="px-4 py-3 text-slate-400 font-medium text-xs uppercase text-right">Ganancia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {data.ventas.map((v: any) => (
                  <tr key={v.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-slate-300">{v.numero_factura}</td>
                    <td className="px-4 py-3 text-slate-300">{v.equipo?.marca} {v.equipo?.modelo}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(v.precio_venta_usd)}</td>
                    <td className="px-4 py-3 text-right font-mono text-success">{fmt(v.ganancia_bruta_venta_usd)}</td>
                  </tr>
                ))}
                {data.ventas.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No hay ventas en este período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente: Estado de Cuenta Inversor ──────────────────────────────────

function ReporteEstadoCuenta() {
  const [desde, setDesde] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0]);
  const [inversorId, setInversorId] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [inversores, setInversores] = useState<any[]>([]);

  // TODO: Fetch inversores list when component mounts (using standard fetch for now since it's simple)
  useState(() => {
    fetch('/api/v1/inversores').then(r => r.json()).then(d => {
      if(d.data) setInversores(d.data);
    }).catch(() => {});
  });

  async function cargar() {
    if (!inversorId) return;
    setLoading(true);
    try {
      const res = await reportesService.getEstadoCuenta({ inversor_id: inversorId, desde, hasta });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-end bg-slate-800/30 p-4 rounded-xl border border-app-border">
        <div>
          <label className="block text-slate-400 text-xs mb-1">Inversor / Socio</label>
          <select value={inversorId} onChange={e => setInversorId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 min-w-[200px]">
            <option value="">Seleccione...</option>
            {inversores.map(inv => <option key={inv.id} value={inv.id}>{inv.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </div>
        <button onClick={cargar} disabled={loading || !inversorId}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />}
          Generar PDF
        </button>
      </div>

      {data && (
        <div className="space-y-4">
          <div className="bg-app-surface p-6 rounded-xl border border-app-border max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-start border-b border-app-border pb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-100">Estado de Cuenta</h2>
                <p className="text-slate-400">{data.inversor.nombre}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-sm">Período</p>
                <p className="text-slate-300 font-mono text-sm">{desde} al {hasta}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Resumen de Capital</h3>
                <div className="flex justify-between"><span className="text-slate-300">Capital Total Aportado:</span><span className="font-mono">{fmt(data.resumen.capital_total_usd)}</span></div>
                <div className="flex justify-between"><span className="text-slate-300">Capital en Inventario:</span><span className="font-mono">{fmt(data.resumen.capital_en_inventario_usd)}</span></div>
                <div className="flex justify-between"><span className="text-danger">Pérdidas Acumuladas:</span><span className="font-mono text-danger">-{fmt(data.resumen.perdidas_capital_usd)}</span></div>
                <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-slate-100 font-medium">Salud del Capital:</span><span className="font-mono font-bold text-success">{fmt(data.resumen.capital_total_usd - data.resumen.perdidas_capital_usd + data.resumen.reintegros_periodo_usd)}</span></div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Resultados del Período</h3>
                <div className="flex justify-between"><span className="text-slate-300">Ganancia Bruta (Participación):</span><span className="font-mono">{fmt(data.resumen.ganancia_inversor_periodo_usd)}</span></div>
                <div className="flex justify-between"><span className="text-slate-300">Reintegros Recibidos:</span><span className="font-mono text-success">+{fmt(data.resumen.reintegros_periodo_usd)}</span></div>
                <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-slate-100 font-medium">Total a Liquidar:</span><span className="font-mono font-bold text-violet-400">{fmt(data.resumen.ganancia_inversor_periodo_usd + data.resumen.reintegros_periodo_usd)}</span></div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Ventas del Período ({data.ventas.length})</h3>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-2 text-slate-400 font-medium">Factura</th>
                    <th className="px-4 py-2 text-slate-400 font-medium">Equipo</th>
                    <th className="px-4 py-2 text-slate-400 font-medium text-right">Ganancia Inversor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {data.ventas.map((v: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2 font-mono text-slate-300">{v.numero_factura}</td>
                      <td className="px-4 py-2 text-slate-300">{v.equipo?.marca} {v.equipo?.modelo}</td>
                      <td className="px-4 py-2 text-right font-mono text-success">{fmt(v.ganancia_inversor_usd)}</td>
                    </tr>
                  ))}
                  {data.ventas.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-500">No hay ventas registradas</td></tr>}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente: Reporte OPEX ───────────────────────────────────────────────

function ReporteOpex() {
  const [desde, setDesde] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const res = await reportesService.getReporteOpex({ desde, hasta });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-end bg-slate-800/30 p-4 rounded-xl border border-app-border">
        <div>
          <label className="block text-slate-400 text-xs mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </div>
        <button onClick={cargar} disabled={loading}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />}
          Generar
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1 space-y-4">
            <div className="bg-app-surface p-4 rounded-xl border border-app-border">
              <p className="text-slate-500 text-xs font-medium uppercase">OPEX Total del Período</p>
              <p className="text-3xl font-bold text-danger mt-1">{fmt(data.resumen.total_usd)}</p>
              <p className="text-slate-500 text-sm mt-1">{data.resumen.cantidad} transacciones</p>
            </div>
            
            <div className="bg-app-surface p-4 rounded-xl border border-app-border space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">Desglose por Categoría</h3>
              {data.por_categoria.map((cat: any) => (
                <div key={cat.categoria} className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 capitalize">{cat.categoria.toLowerCase()}</span>
                  <span className="font-mono text-slate-200">{fmt(cat.total_usd)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="col-span-1 md:col-span-2">
             <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden h-full">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-slate-400 font-medium text-xs uppercase">Fecha</th>
                    <th className="px-4 py-3 text-slate-400 font-medium text-xs uppercase">Concepto</th>
                    <th className="px-4 py-3 text-slate-400 font-medium text-xs uppercase">Categoría</th>
                    <th className="px-4 py-3 text-slate-400 font-medium text-xs uppercase text-right">Monto (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {data.gastos.map((g: any) => (
                    <tr key={g.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-400 text-xs">{g.fecha.substring(0, 10)}</td>
                      <td className="px-4 py-3 text-slate-300">{g.concepto}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs capitalize">{g.categoria.toLowerCase()}</td>
                      <td className="px-4 py-3 text-right font-mono text-danger">{fmt(g.monto_usd)}</td>
                    </tr>
                  ))}
                  {data.gastos.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No hay gastos en este período</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página Principal ────────────────────────────────────────────────────────

export function ReportesPage() {
  const [tab, setTab] = useState<'ventas' | 'estado_cuenta' | 'opex'>('ventas');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Reportes Financieros</h1>
        <p className="text-slate-500 text-sm mt-0.5">Analíticas, estados de cuenta y gastos operativos</p>
      </div>

      <div className="flex gap-2 border-b border-app-border pb-px">
        <button onClick={() => setTab('ventas')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors ${tab === 'ventas' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
          <TrendingUp size={16} />
          Reporte de Ventas
        </button>
        <button onClick={() => setTab('estado_cuenta')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors ${tab === 'estado_cuenta' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
          <User size={16} />
          Estado de Cuenta
        </button>
        <button onClick={() => setTab('opex')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors ${tab === 'opex' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
          <Archive size={16} />
          Reporte OPEX
        </button>
      </div>

      <div>
        {tab === 'ventas' && <ReporteVentas />}
        {tab === 'estado_cuenta' && <ReporteEstadoCuenta />}
        {tab === 'opex' && <ReporteOpex />}
      </div>
    </div>
  );
}
