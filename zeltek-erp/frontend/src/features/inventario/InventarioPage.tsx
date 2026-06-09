import { useEffect, useState, useCallback } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, ArrowRight, Wallet, Cpu, Plug } from 'lucide-react';
import api from '@/lib/api';
import { EstadoBadge } from '@/shared/components/EstadoBadge';
import { Modal } from '@/components/Modal';
import { CheckoutModal, type EquipoDisponible } from '@/features/ventas/VentasPage';
import type { EstadoEquipo } from '@/types/equipo';
import { TIMEZONE_NI } from '@/lib/utils';

export interface EquipoRow {
  id: string;
  numero_serie: string;
  marca: string;
  modelo: string;
  procesador: string | null;
  ram_gb: number | null;
  almacenamiento_gb: number | null;
  estado: EstadoEquipo;
  condicion: 'NUEVO' | 'SEMINUEVO';
  ctr_usd: number | string;
  precio_venta_sugerido_usd: number | string;
  peso_real_libras: number | string | null;
  requiere_cargador: boolean;
  inversor: { nombre: string };
  historial_estados?: { estado_nuevo: EstadoEquipo; notas: string | null; created_at: string }[];
}

interface Meta { total: number; page: number; limit: number; pages: number; }

interface ResumenInventario {
  equipos_count: number;
  equipos_valor_usd: number;
  accesorios_count: number;
  accesorios_valor_usd: number;
  valor_total_usd: number;
}

interface LoteRow {
  id: string;
  categoria: { nombre: string };
  disponibles: number;
  costo_unitario_real: number | string | null;
  created_at: string;
}

interface AccesorioVendidoRow {
  id: string;
  categoria: { nombre: string };
  costo_unitario_usd: number | string;
  venta: {
    numero_factura: string;
    precio_venta_usd: number | string;
    fecha_venta: string;
    cliente: string | null;
  } | null;
}

export const TRANSICIONES: Record<EstadoEquipo, EstadoEquipo[]> = {
  COMPRADO:        ['EN_BODEGA_MIAMI', 'EN_RECLAMO'],
  EN_BODEGA_MIAMI: ['EN_TRANSITO', 'EN_RECLAMO'],
  EN_TRANSITO:     ['EN_TALLER', 'EN_RECLAMO'],
  EN_TALLER:       ['DISPONIBLE'],
  DISPONIBLE:      ['EN_TALLER', 'EN_RECLAMO'],
  VENDIDO:         ['EN_RECLAMO', 'EN_TALLER'],
  EN_RECLAMO:      ['DISPONIBLE', 'DEVUELTO'],
  DEVUELTO:        [],
};

export const ESTADO_LABELS: Record<EstadoEquipo, string> = {
  COMPRADO: 'Comprado', EN_BODEGA_MIAMI: 'Bodega Miami', EN_TRANSITO: 'En Tránsito',
  EN_TALLER: 'En Taller', DISPONIBLE: 'Disponible', VENDIDO: 'Vendido',
  EN_RECLAMO: 'En Reclamo', DEVUELTO: 'Devuelto',
};

export function fmt(n: number | string | null) {
  return `$${parseFloat(String(n ?? 0)).toFixed(2)}`;
}

// ─── Pestañas de ciclo de vida (agrupan estados de equipo) ────────────────────

const TABS = [
  { key: 'en_stock', label: 'En Stock', estados: ['DISPONIBLE'] as EstadoEquipo[] },
  { key: 'historial', label: 'Historial', estados: ['VENDIDO', 'EN_RECLAMO', 'DEVUELTO'] as EstadoEquipo[] },
] as const;

type TabKey = typeof TABS[number]['key'];
type SubVista = 'dispositivos' | 'accesorios';

// ─── Modal cambio de estado ───────────────────────────────────────────────────

export function ModalCambioEstado({
  equipo, onClose, onSuccess,
}: {
  equipo: EquipoRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const transiciones = TRANSICIONES[equipo.estado] ?? [];
  const [estadoNuevo, setEstadoNuevo] = useState<EstadoEquipo | ''>('');
  const [notas, setNotas] = useState('');
  const [peso, setPeso] = useState(equipo.peso_real_libras ? String(equipo.peso_real_libras) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const necesitaPeso = estadoNuevo === 'DISPONIBLE';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!estadoNuevo) return;
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = { estado_nuevo: estadoNuevo, notas: notas || undefined };
      if (necesitaPeso && peso) body.peso_real_libras = parseFloat(peso);
      await api.patch(`/equipos/${equipo.id}/estado`, body);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al cambiar estado');
    } finally {
      setLoading(false);
    }
  }

  if (transiciones.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-slate-400 text-sm">Este equipo está en estado terminal — no admite más cambios.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Estado actual → nuevo */}
      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl">
        <EstadoBadge estado={equipo.estado} />
        <ArrowRight size={16} className="text-slate-500 shrink-0" />
        <div className="flex-1">
          <select
            value={estadoNuevo}
            onChange={e => setEstadoNuevo(e.target.value as EstadoEquipo)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-violet-500"
          >
            <option value="">— Seleccionar nuevo estado</option>
            {transiciones.map(t => (
              <option key={t} value={t}>{ESTADO_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Campos extra para DISPONIBLE */}
      {estadoNuevo === 'DISPONIBLE' && (
        <div className="space-y-3 p-4 bg-violet-950/20 border border-violet-800/30 rounded-xl">
          <p className="text-violet-400 text-xs font-semibold uppercase tracking-wider">
            Requisitos para DISPONIBLE
          </p>
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">
              Peso real (libras) <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={peso}
              onChange={e => setPeso(e.target.value)}
              placeholder="ej. 3.75"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
          {equipo.requiere_cargador && (
            <p className="text-warning text-xs">
              ⚠️ Este equipo requiere cargador asignado. Asegúrate de haberlo asignado en Accesorios.
            </p>
          )}
        </div>
      )}

      {/* Notas */}
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Notas (opcional)</label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm resize-none focus:outline-none focus:border-violet-500"
          placeholder="Motivo del cambio..."
        />
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 text-sm transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={!estadoNuevo || loading}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
          {loading ? 'Guardando...' : 'Cambiar estado'}
        </button>
      </div>
    </form>
  );
}

// ─── Tarjeta de resumen ───────────────────────────────────────────────────────

function TarjetaResumen({ icono, etiqueta, valor, sub }: {
  icono: React.ReactNode; etiqueta: string; valor: string; sub?: string;
}) {
  return (
    <div className="bg-app-surface border border-app-border rounded-card px-5 py-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-violet-600/10 text-violet-400 flex items-center justify-center shrink-0">
        {icono}
      </div>
      <div className="min-w-0">
        <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">{etiqueta}</p>
        <p className="text-slate-100 text-lg font-bold font-mono leading-tight">{valor}</p>
        {sub && <p className="text-slate-500 text-xs mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function InventarioPage() {
  const [tab, setTab] = useState<TabKey>('en_stock');
  const [subVista, setSubVista] = useState<SubVista>('dispositivos');
  const [resumen, setResumen] = useState<ResumenInventario | null>(null);

  // Dispositivos (equipos)
  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<EquipoRow | null>(null);
  const [equipoAVender, setEquipoAVender] = useState<EquipoRow | null>(null);

  // Accesorios (lotes con stock / vendidos)
  const [lotes, setLotes] = useState<LoteRow[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [vendidos, setVendidos] = useState<AccesorioVendidoRow[]>([]);
  const [loadingVendidos, setLoadingVendidos] = useState(false);

  const cargarResumen = useCallback(async () => {
    try {
      const res = await api.get<{ data: ResumenInventario }>('/equipos/resumen');
      setResumen(res.data.data);
    } catch {
      // el resumen es informativo — un fallo aquí no debe bloquear la página
    }
  }, []);

  const cargarEquipos = useCallback(async () => {
    setLoading(true);
    try {
      const tabActual = TABS.find(t => t.key === tab)!;
      const params = new URLSearchParams({ page: String(page), limit: '20', estados: tabActual.estados.join(',') });
      if (busqueda) params.set('q', busqueda);
      const res = await api.get<{ items: EquipoRow[]; meta: Meta }>(`/equipos?${params}`);
      setEquipos(res.data.items);
      setMeta(res.data.meta);
    } finally {
      setLoading(false);
    }
  }, [tab, page, busqueda]);

  const cargarLotes = useCallback(async () => {
    setLoadingLotes(true);
    try {
      const res = await api.get<{ data: LoteRow[] }>('/accesorios/lotes');
      setLotes(res.data.data.filter(l => l.disponibles > 0));
    } finally {
      setLoadingLotes(false);
    }
  }, []);

  const cargarVendidos = useCallback(async () => {
    setLoadingVendidos(true);
    try {
      const res = await api.get<{ data: AccesorioVendidoRow[] }>('/accesorios/vendidos');
      setVendidos(res.data.data);
    } finally {
      setLoadingVendidos(false);
    }
  }, []);

  useEffect(() => { cargarResumen(); }, [cargarResumen]);
  useEffect(() => { if (subVista === 'dispositivos') cargarEquipos(); }, [subVista, cargarEquipos]);
  useEffect(() => {
    if (subVista !== 'accesorios') return;
    if (tab === 'historial') cargarVendidos();
    else cargarLotes();
  }, [subVista, tab, cargarLotes, cargarVendidos]);
  useEffect(() => { setPage(1); }, [busqueda, tab]);

  function refrescar() {
    cargarResumen();
    if (subVista === 'dispositivos') cargarEquipos();
    else if (tab === 'historial') cargarVendidos();
    else cargarLotes();
  }

  const equipoParaCheckout: EquipoDisponible | null = equipoAVender ? {
    id: equipoAVender.id,
    marca: equipoAVender.marca,
    modelo: equipoAVender.modelo,
    numero_serie: equipoAVender.numero_serie,
    ctr_usd: equipoAVender.ctr_usd,
    precio_venta_sugerido_usd: equipoAVender.precio_venta_sugerido_usd,
    condicion: equipoAVender.condicion,
  } : null;

  const accesoriosUnidades = lotes.reduce((acc, l) => acc + l.disponibles, 0);
  const accesoriosValor = lotes.reduce((acc, l) => acc + parseFloat(String(l.costo_unitario_real ?? 0)) * l.disponibles, 0);

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Inventario</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestión de dispositivos y accesorios</p>
        </div>
        <button onClick={refrescar}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
          <RefreshCw size={16} className={(loading || loadingLotes || loadingVendidos) ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Resumen general */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TarjetaResumen
          icono={<Cpu size={18} />}
          etiqueta="Equipos con serie"
          valor={resumen ? String(resumen.equipos_count) : '—'}
          sub={resumen ? `Costo en inventario: ${fmt(resumen.equipos_valor_usd)}` : 'Cargando...'}
        />
        <TarjetaResumen
          icono={<Plug size={18} />}
          etiqueta="Accesorios sin serie"
          valor={resumen ? String(resumen.accesorios_count) : '—'}
          sub={resumen ? `Cargadores y otros · costo: ${fmt(resumen.accesorios_valor_usd)}` : 'Cargando...'}
        />
        <TarjetaResumen
          icono={<Wallet size={18} />}
          etiqueta="Capital total en inventario"
          valor={resumen ? fmt(resumen.valor_total_usd) : '—'}
          sub="Suma del costo (CTR) de equipos + accesorios"
        />
      </div>

      {/* Sub-toggle Dispositivos / Accesorios */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSubVista('dispositivos')}
          className={`flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${subVista === 'dispositivos' ? 'bg-violet-600/15 border-violet-500/50 text-violet-300' : 'bg-app-surface border-app-border text-slate-400 hover:text-slate-200'}`}>
          🖥️ Dispositivos
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${subVista === 'dispositivos' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {subVista === 'dispositivos' ? meta.total : (resumen?.equipos_count ?? '—')}
          </span>
        </button>
        <span className="text-slate-700 text-xs">•</span>
        <button onClick={() => setSubVista('accesorios')}
          className={`flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${subVista === 'accesorios' ? 'bg-violet-600/15 border-violet-500/50 text-violet-300' : 'bg-app-surface border-app-border text-slate-400 hover:text-slate-200'}`}>
          🔌 Accesorios
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${subVista === 'accesorios' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {subVista === 'accesorios' ? (tab === 'historial' ? vendidos.length : lotes.length) : (resumen?.accesorios_count ?? '—')}
          </span>
        </button>
      </div>

      {/* Pestañas: En Stock / Historial */}
      <div className="flex gap-1 border-b border-app-border">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {subVista === 'dispositivos' ? (
        <>
          {/* Búsqueda */}
          <div className="relative sm:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por serie, marca, modelo..."
              className="w-full bg-app-surface border border-app-border rounded-xl pl-9 pr-4 py-2.5 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
          </div>

          <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando...</div>
            ) : equipos.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">No se encontraron equipos en esta vista</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-app-border">
                      <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Equipo</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider hidden md:table-cell">N° Serie</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider hidden lg:table-cell">Specs</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Estado</th>
                      <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">CTR</th>
                      <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">P. Sugerido</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {equipos.map(eq => (
                      <tr key={eq.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-slate-100 font-medium">{eq.marca} {eq.modelo}</p>
                            <p className="text-slate-500 text-xs">{eq.condicion === 'NUEVO' ? 'Nuevo' : 'Seminuevo'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="font-mono text-slate-400 text-xs">{eq.numero_serie}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-slate-400 text-xs">
                            {[eq.procesador, eq.ram_gb ? `${eq.ram_gb}GB RAM` : null, eq.almacenamiento_gb ? `${eq.almacenamiento_gb}GB` : null]
                              .filter(Boolean).join(' · ') || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3"><EstadoBadge estado={eq.estado} /></td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-slate-100 text-sm">{fmt(eq.ctr_usd)}</span>
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          <span className="font-mono text-success text-sm">{fmt(eq.precio_venta_sugerido_usd)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {eq.estado === 'DISPONIBLE' && (
                              <button
                                onClick={() => setEquipoAVender(eq)}
                                className="px-3 py-1.5 rounded-lg bg-success/10 hover:bg-success/20 text-success text-xs font-semibold transition-colors border border-success/30"
                              >
                                $ Vender
                              </button>
                            )}
                            {eq.estado !== 'DEVUELTO' && eq.estado !== 'VENDIDO' && (
                              <button
                                onClick={() => setEquipoSeleccionado(eq)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-violet-600/20 hover:text-violet-400 text-slate-400 text-xs font-medium transition-colors border border-slate-700 hover:border-violet-600/50"
                              >
                                Estado
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {meta.pages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-sm">Página {meta.page} de {meta.pages} · {meta.total} equipos</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setPage(p => Math.min(meta.pages, p + 1))} disabled={page === meta.pages}
                  className="p-2 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      ) : tab === 'historial' ? (
        <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
          {loadingVendidos ? (
            <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando...</div>
          ) : vendidos.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">Aún no se han vendido accesorios sueltos</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-app-border">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Categoría</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Factura</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Cliente</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Fecha</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Costo</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Vendido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {vendidos.map(v => (
                    <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-slate-100 font-medium">🔌 {v.categoria.nombre}</p>
                        <p className="text-slate-500 text-xs">Sin número de serie</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="font-mono text-slate-400 text-xs">{v.venta?.numero_factura ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-slate-400 text-xs">{v.venta?.cliente ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-slate-400 text-xs">
                          {v.venta ? new Date(v.venta.fecha_venta).toLocaleDateString('es-NI', { timeZone: TIMEZONE_NI }) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-slate-300 text-sm">{fmt(v.costo_unitario_usd)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-success text-sm">{v.venta ? fmt(v.venta.precio_venta_usd) : '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
          {loadingLotes ? (
            <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando...</div>
          ) : lotes.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">No hay accesorios disponibles en inventario</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-app-border">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Categoría</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Lote</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Disponibles</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Costo unitario</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Valor en stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {lotes.map(l => {
                    const costoUnitario = parseFloat(String(l.costo_unitario_real ?? 0));
                    return (
                      <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-slate-100 font-medium">🔌 {l.categoria.nombre}</p>
                          <p className="text-slate-500 text-xs">Sin número de serie</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="font-mono text-slate-500 text-xs">#{l.id.slice(0, 8)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-slate-100 font-semibold">{l.disponibles}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-slate-300 text-sm">{fmt(costoUnitario)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-success text-sm">{fmt(costoUnitario * l.disponibles)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-app-border bg-slate-800/30">
                    <td colSpan={2} className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      Total · solo accesorios sin serie (cargadores y otros)
                    </td>
                    <td className="px-4 py-3 text-right text-slate-100 font-semibold">{accesoriosUnidades}</td>
                    <td></td>
                    <td className="px-4 py-3 text-right font-mono text-success font-semibold">{fmt(accesoriosValor)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal cambio de estado */}
      <Modal
        open={!!equipoSeleccionado}
        onClose={() => setEquipoSeleccionado(null)}
        title={equipoSeleccionado ? `${equipoSeleccionado.marca} ${equipoSeleccionado.modelo}` : ''}
      >
        {equipoSeleccionado && (
          <ModalCambioEstado
            equipo={equipoSeleccionado}
            onClose={() => setEquipoSeleccionado(null)}
            onSuccess={cargarEquipos}
          />
        )}
      </Modal>

      {/* Modal vender — checkout reutilizado de Ventas, pre-seleccionando el equipo */}
      <Modal
        open={!!equipoAVender}
        onClose={() => setEquipoAVender(null)}
        title={equipoAVender ? `Vender · ${equipoAVender.marca} ${equipoAVender.modelo}` : 'Vender equipo'}
        maxWidth="max-w-xl"
      >
        {equipoParaCheckout && (
          <CheckoutModal
            equipoInicial={equipoParaCheckout}
            onClose={() => setEquipoAVender(null)}
            onSuccess={() => { setEquipoAVender(null); refrescar(); }}
          />
        )}
      </Modal>
    </div>
  );
}
