import { useState } from 'react';
import { RefreshCw, FileText, TrendingUp, User, Archive, TableProperties } from 'lucide-react';
import { reportesService, ReporteVentasData, InversorDesglose, VentaDesglose } from './reportesService';
import { hoyNI, primerDiaMesNI, TIMEZONE_NI } from '@/lib/utils';

// ─── Componente: Reporte de Ventas ──────────────────────────────────────────

function ReporteVentas() {
  const [desde, setDesde] = useState(primerDiaMesNI());
  const [hasta, setHasta] = useState(hoyNI());
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
  const [desde, setDesde] = useState(primerDiaMesNI());
  const [hasta, setHasta] = useState(hoyNI());
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
  const [desde, setDesde] = useState(primerDiaMesNI());
  const [hasta, setHasta] = useState(hoyNI());
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

// ─── Componente: Desglose por Venta ─────────────────────────────────────────

function ReporteDesglose() {
  const [desde, setDesde] = useState(primerDiaMesNI());
  const [hasta, setHasta] = useState(hoyNI());
  const [data, setData] = useState<ReporteVentasData | null>(null);
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
  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TIMEZONE_NI });

  const inversores: InversorDesglose[] = data?.inversores ?? [];
  const totalPct = inversores.reduce((s, i) => s + i.porcentaje, 0);

  function repartoPorInversor(v: VentaDesglose, inv: InversorDesglose): number {
    if (totalPct === 0) return 0;
    return v.pf_monto_reparto_usd * inv.porcentaje / totalPct;
  }

  const totales = data
    ? data.ventas.reduce(
        (acc, v) => {
          acc.precio += v.precio_venta_usd;
          acc.ctr += v.ctr_al_momento_usd;
          acc.ganancia_bruta += v.ganancia_bruta_venta_usd;
          acc.opex += v.pf_monto_opex_usd;
          acc.reserva += v.pf_monto_garantias_usd;
          acc.ganancia_neta += v.pf_monto_ganancia_usd;
          acc.reparto += v.pf_monto_reparto_usd;
          return acc;
        },
        { precio: 0, ctr: 0, ganancia_bruta: 0, opex: 0, reserva: 0, ganancia_neta: 0, reparto: 0 }
      )
    : null;

  const pctLabel = (tap: number) => tap > 0 ? ` (${tap}%)` : '';
  const firstVenta = data?.ventas[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end bg-slate-800/30 p-4 rounded-xl border border-app-border">
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
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <TableProperties size={16} />}
          Generar
        </button>
      </div>

      {data && data.ventas.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-8">No hay ventas en este período</p>
      )}

      {data && data.ventas.length > 0 && (
        <div className="space-y-3">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-app-surface p-3 rounded-xl border border-app-border">
              <p className="text-slate-500 text-xs uppercase font-medium">Ventas</p>
              <p className="text-xl font-bold text-slate-100 mt-0.5">{data.resumen.cantidad_ventas}</p>
            </div>
            <div className="bg-app-surface p-3 rounded-xl border border-app-border">
              <p className="text-slate-500 text-xs uppercase font-medium">Ganancia Bruta</p>
              <p className="text-xl font-bold text-success mt-0.5">{fmt(data.resumen.ganancia_bruta_usd)}</p>
            </div>
            <div className="bg-app-surface p-3 rounded-xl border border-app-border">
              <p className="text-slate-500 text-xs uppercase font-medium">Fondo OPEX</p>
              <p className="text-xl font-bold text-blue-400 mt-0.5">{fmt(data.resumen.pf_opex_usd)}</p>
            </div>
            <div className="bg-app-surface p-3 rounded-xl border border-app-border border-l-4 border-l-violet-500">
              <p className="text-slate-500 text-xs uppercase font-medium">Total Reparto</p>
              <p className="text-xl font-bold text-violet-400 mt-0.5">{fmt(data.resumen.pf_reparto_usd)}</p>
            </div>
          </div>

          {/* Wide table */}
          <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-slate-800/70">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium text-xs uppercase tracking-wider sticky left-0 bg-slate-800/70 z-10">Fecha</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium text-xs uppercase tracking-wider">Serial</th>
                    <th className="px-4 py-3 text-right text-slate-400 font-medium text-xs uppercase tracking-wider">Precio Venta</th>
                    <th className="px-4 py-3 text-right text-slate-400 font-medium text-xs uppercase tracking-wider">Costo Repos.</th>
                    <th className="px-4 py-3 text-right text-success font-medium text-xs uppercase tracking-wider">Ganancia Bruta</th>
                    <th className="px-4 py-3 text-right text-blue-400 font-medium text-xs uppercase tracking-wider">
                      F. Operativo{pctLabel(firstVenta?.pf_tap_opex_aplicado ?? 0)}
                    </th>
                    <th className="px-4 py-3 text-right text-amber-400 font-medium text-xs uppercase tracking-wider">
                      F. Reserva{pctLabel(firstVenta?.pf_tap_garantias_aplicado ?? 0)}
                    </th>
                    <th className="px-4 py-3 text-right text-emerald-400 font-medium text-xs uppercase tracking-wider">
                      G. Neta Real{pctLabel(firstVenta?.pf_tap_ganancia_aplicado ?? 0)}
                    </th>
                    {inversores.map(inv => (
                      <th key={inv.id} className="px-4 py-3 text-right text-violet-400 font-medium text-xs uppercase tracking-wider">
                        {inv.nombre.split(' ')[0]} ({inv.porcentaje}%)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {data.ventas.map(v => (
                    <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs sticky left-0 bg-app-surface hover:bg-slate-800/30">{fmtFecha(v.fecha_venta)}</td>
                      <td className="px-4 py-3">
                        <p className="text-slate-100 text-xs font-mono">{v.equipo.numero_serie}</p>
                        <p className="text-slate-500 text-xs">{v.equipo.marca} {v.equipo.modelo}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-100">{fmt(v.precio_venta_usd)}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">{fmt(v.ctr_al_momento_usd)}</td>
                      <td className="px-4 py-3 text-right font-mono text-success font-semibold">{fmt(v.ganancia_bruta_venta_usd)}</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-300">{fmt(v.pf_monto_opex_usd)}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-300">{fmt(v.pf_monto_garantias_usd)}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-300 font-semibold">{fmt(v.pf_monto_ganancia_usd)}</td>
                      {inversores.map(inv => (
                        <td key={inv.id} className="px-4 py-3 text-right font-mono text-violet-300 font-semibold">
                          {fmt(repartoPorInversor(v, inv))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {totales && (
                  <tfoot className="bg-slate-800/80 border-t-2 border-slate-600">
                    <tr>
                      <td className="px-4 py-3 text-slate-300 font-semibold text-xs uppercase sticky left-0 bg-slate-800/80" colSpan={2}>
                        TOTAL ({data.resumen.cantidad_ventas} ventas)
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-100">{fmt(totales.precio)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-400">{fmt(totales.ctr)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-success">{fmt(totales.ganancia_bruta)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-300">{fmt(totales.opex)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-300">{fmt(totales.reserva)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-300">{fmt(totales.ganancia_neta)}</td>
                      {inversores.map(inv => (
                        <td key={inv.id} className="px-4 py-3 text-right font-mono font-bold text-violet-300">
                          {fmt(totalPct > 0 ? totales.reparto * inv.porcentaje / totalPct : 0)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
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
  const [tab, setTab] = useState<'ventas' | 'estado_cuenta' | 'opex' | 'desglose'>('ventas');

  const tabs = [
    { id: 'ventas' as const, label: 'Reporte de Ventas', icon: TrendingUp },
    { id: 'desglose' as const, label: 'Desglose por Venta', icon: TableProperties },
    { id: 'estado_cuenta' as const, label: 'Estado de Cuenta', icon: User },
    { id: 'opex' as const, label: 'Reporte OPEX', icon: Archive },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Reportes Financieros</h1>
        <p className="text-slate-500 text-sm mt-0.5">Analíticas, estados de cuenta y gastos operativos</p>
      </div>

      <div className="flex gap-2 border-b border-app-border pb-px overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'ventas' && <ReporteVentas />}
        {tab === 'desglose' && <ReporteDesglose />}
        {tab === 'estado_cuenta' && <ReporteEstadoCuenta />}
        {tab === 'opex' && <ReporteOpex />}
      </div>
    </div>
  );
}
