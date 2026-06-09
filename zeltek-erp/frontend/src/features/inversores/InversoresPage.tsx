import { useEffect, useState, useCallback } from 'react';
import { Plus, RefreshCw, ChevronRight, TrendingUp, Wallet, Package, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { Modal } from '@/components/Modal';
import { TIMEZONE_NI } from '@/lib/utils';

interface Inversor {
  id: string;
  nombre: string;
  porcentaje_ganancia: number;
  telefono: string | null;
  notas: string | null;
  fondo_reparto_nombre: string;
  saldo_reparto_usd: number;
}

interface EquipoResumen {
  id: string;
  marca: string;
  modelo: string;
  estado: string;
  ctr_usd: string | number;
  precio_venta_sugerido_usd: string | number | null;
}

interface VentaResumen {
  id: string;
  numero_factura: string;
  fecha_venta: string;
  precio_venta_usd: string | number;
  ganancia_bruta_venta_usd: string | number;
  capital_retorno_inversor_usd: string | number;
  reparto_liquidado: boolean;
}

interface InversorDetalle {
  inversor: Inversor;
  resumen: {
    equipos_activos: number;
    equipos_total: number;
    capital_invertido_usd: number;
    capital_recuperado_usd: number;
    ganancias_est_usd: number;
  };
  equipos: EquipoResumen[];
  ventas: VentaResumen[];
}

function fmt(n: number | string | null | undefined) {
  if (n === null || n === undefined) return '—';
  return `$${parseFloat(String(n)).toFixed(2)}`;
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TIMEZONE_NI });
}

const ESTADO_COLORS: Record<string, string> = {
  COMPRADO: 'bg-slate-700 text-slate-300',
  EN_BODEGA_MIAMI: 'bg-blue-500/10 text-blue-400',
  EN_TRANSITO: 'bg-amber-500/10 text-amber-400',
  EN_TALLER: 'bg-orange-500/10 text-orange-400',
  DISPONIBLE: 'bg-success/10 text-success',
  VENDIDO: 'bg-slate-600/10 text-slate-500',
  EN_RECLAMO: 'bg-danger/10 text-danger',
  DEVUELTO: 'bg-slate-700 text-slate-400',
};

// ─── Formulario crear/editar inversor ────────────────────────────────────────

function FormInversor({
  inicial,
  onClose,
  onSuccess,
}: {
  inicial?: Inversor;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [porcentaje, setPorcentaje] = useState(String(inicial?.porcentaje_ganancia ?? ''));
  const [telefono, setTelefono] = useState(inicial?.telefono ?? '');
  const [notas, setNotas] = useState(inicial?.notas ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre || !porcentaje) return;
    setError(null);
    setLoading(true);
    try {
      const body = {
        nombre,
        porcentaje_ganancia: parseFloat(porcentaje),
        telefono: telefono || null,
        notas: notas || null,
      };
      if (inicial) {
        await api.patch(`/inversores/${inicial.id}`, body);
      } else {
        await api.post('/inversores', body);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Nombre del inversor <span className="text-danger">*</span></label>
        <input value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="ej. Socio A, Zeltek (Capital Propio)"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        {!inicial && (
          <p className="text-slate-600 text-xs mt-1">Se creará automáticamente el fondo de reparto</p>
        )}
      </div>

      <div>
        <label className="block text-slate-400 text-sm mb-1.5">
          % de ganancia sobre ventas <span className="text-danger">*</span>
        </label>
        <div className="relative">
          <input type="number" step="0.01" min="0" max="100" value={porcentaje} onChange={e => setPorcentaje(e.target.value)}
            placeholder="ej. 50"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 pr-8 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
        </div>
        <p className="text-slate-600 text-xs mt-1">Porcentaje de la ganancia bruta que corresponde a este inversor (del 55% REPARTO)</p>
      </div>

      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Teléfono</label>
        <input value={telefono} onChange={e => setTelefono(e.target.value)}
          placeholder="+505 8888-8888"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
      </div>

      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Notas</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm resize-none focus:outline-none focus:border-violet-500" />
      </div>

      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 text-sm">
          Cancelar
        </button>
        <button type="submit" disabled={!nombre || !porcentaje || loading}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Guardando...' : inicial ? 'Guardar cambios' : 'Crear inversor'}
        </button>
      </div>
    </form>
  );
}

// ─── Panel de detalle ─────────────────────────────────────────────────────────

function DetalleInversor({ inversorId, onEdit }: { inversorId: string; onEdit: () => void }) {
  const [data, setData] = useState<InversorDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'equipos' | 'ventas'>('equipos');

  useEffect(() => {
    setLoading(true);
    api.get<{ data: InversorDetalle }>(`/inversores/${inversorId}`)
      .then(r => setData(r.data.data))
      .finally(() => setLoading(false));
  }, [inversorId]);

  if (loading) return <div className="py-12 text-center text-slate-500 text-sm animate-pulse">Cargando...</div>;
  if (!data) return null;

  const { resumen, equipos, ventas, inversor } = data;
  const capitalPendiente = resumen.capital_invertido_usd - resumen.capital_recuperado_usd;

  return (
    <div className="space-y-5">
      {/* Header: nombre + editar */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">{inversor.nombre}</h2>
          <p className="text-slate-500 text-sm">{inversor.porcentaje_ganancia}% de ganancia · {inversor.fondo_reparto_nombre}</p>
          {inversor.telefono && <p className="text-slate-600 text-xs mt-0.5">{inversor.telefono}</p>}
        </div>
        <button onClick={onEdit} className="px-3 py-1.5 rounded-lg border border-app-border text-slate-400 hover:text-slate-100 text-sm">
          Editar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-app-border">
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-slate-500" />
            <span className="text-slate-500 text-xs uppercase tracking-wider">Capital invertido</span>
          </div>
          <p className="text-xl font-bold text-slate-100">{fmt(resumen.capital_invertido_usd)}</p>
          <p className="text-slate-500 text-xs">{resumen.equipos_activos} equipos activos de {resumen.equipos_total}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-app-border">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={14} className="text-slate-500" />
            <span className="text-slate-500 text-xs uppercase tracking-wider">Capital pendiente</span>
          </div>
          <p className={`text-xl font-bold ${capitalPendiente > 0 ? 'text-warning' : 'text-success'}`}>
            {fmt(capitalPendiente)}
          </p>
          <p className="text-slate-500 text-xs">Recuperado: {fmt(resumen.capital_recuperado_usd)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-app-border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-slate-500" />
            <span className="text-slate-500 text-xs uppercase tracking-wider">Ganancias est.</span>
          </div>
          <p className="text-xl font-bold text-success">{fmt(resumen.ganancias_est_usd)}</p>
          <p className="text-slate-500 text-xs">{ventas.length} ventas realizadas</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-app-border">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={14} className="text-violet-400" />
            <span className="text-slate-500 text-xs uppercase tracking-wider">Fondo reparto</span>
          </div>
          <p className={`text-xl font-bold ${inversor.saldo_reparto_usd >= 0 ? 'text-success' : 'text-danger'}`}>
            {fmt(inversor.saldo_reparto_usd)}
          </p>
          <p className="text-slate-500 text-xs">Disponible para retirar</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-app-border">
        {(['equipos', 'ventas'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'text-violet-400 border-b-2 border-violet-500' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {t === 'equipos' ? `Equipos (${equipos.length})` : `Ventas (${ventas.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'equipos' && (
        equipos.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">Sin equipos asignados</p>
        ) : (
          <div className="divide-y divide-app-border max-h-72 overflow-y-auto">
            {equipos.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 text-sm">{e.marca} {e.modelo}</p>
                  <p className="text-slate-500 text-xs">CTR: {fmt(e.ctr_usd)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[e.estado] ?? 'bg-slate-700 text-slate-400'}`}>
                  {e.estado.replace(/_/g, ' ')}
                </span>
                {e.precio_venta_sugerido_usd && (
                  <p className="text-slate-400 text-sm shrink-0">{fmt(e.precio_venta_sugerido_usd)}</p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'ventas' && (
        ventas.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">Sin ventas aún</p>
        ) : (
          <div className="divide-y divide-app-border max-h-72 overflow-y-auto">
            {ventas.map(v => (
              <div key={v.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 text-sm font-mono">{v.numero_factura}</p>
                  <p className="text-slate-500 text-xs">{fmtFecha(v.fecha_venta)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-slate-100 text-sm">{fmt(v.precio_venta_usd)}</p>
                  <p className="text-success text-xs">+{fmt(v.ganancia_bruta_venta_usd)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-slate-400 text-xs">Capital</p>
                  <p className="text-slate-300 text-sm">{fmt(v.capital_retorno_inversor_usd)}</p>
                </div>
                {!v.reparto_liquidado && (
                  <span title="Reparto pendiente"><AlertCircle size={14} className="text-warning shrink-0" /></span>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function InversoresPage() {
  const [inversores, setInversores] = useState<Inversor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalFormAbierto, setModalFormAbierto] = useState(false);
  const [modalDetalleId, setModalDetalleId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Inversor | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Inversor[] }>('/inversores');
      setInversores(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const inversorDetalle = inversores.find(i => i.id === modalDetalleId);

  const totalCapital = inversores.reduce((s, i) => s + i.saldo_reparto_usd, 0);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Inversores</h1>
          <p className="text-slate-500 text-sm mt-0.5">{inversores.length} inversores registrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setEditando(null); setModalFormAbierto(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> Nuevo inversor
          </button>
        </div>
      </div>

      {/* Total pendiente de reparto */}
      {totalCapital > 0 && (
        <div className="bg-violet-600/10 border border-violet-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <Wallet size={16} className="text-violet-400 shrink-0" />
          <p className="text-violet-300 text-sm">
            <span className="font-bold">{fmt(totalCapital)}</span> acumulado en fondos de reparto pendiente de liquidar
          </p>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando inversores...</div>
      ) : inversores.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-slate-500 text-sm">No hay inversores registrados</p>
          <button onClick={() => setModalFormAbierto(true)}
            className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-xl">
            Agregar primer inversor
          </button>
        </div>
      ) : (
        <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
          <div className="divide-y divide-app-border">
            {inversores.map(inv => (
              <button key={inv.id} onClick={() => setModalDetalleId(inv.id)}
                className="w-full flex items-center gap-4 px-4 py-4 hover:bg-slate-800/30 transition-colors text-left">
                <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 font-bold shrink-0">
                  {inv.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 text-sm font-medium">{inv.nombre}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{inv.porcentaje_ganancia}% de ganancia · {inv.fondo_reparto_nombre}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-slate-500 text-xs">Reparto disponible</p>
                  <p className={`font-bold text-sm ${inv.saldo_reparto_usd > 0 ? 'text-success' : 'text-slate-500'}`}>
                    {fmt(inv.saldo_reparto_usd)}
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal detalle */}
      <Modal
        open={modalDetalleId !== null && !modalFormAbierto}
        onClose={() => setModalDetalleId(null)}
        title={inversorDetalle?.nombre ?? 'Detalle'}
        maxWidth="max-w-2xl"
      >
        {modalDetalleId && (
          <DetalleInversor
            inversorId={modalDetalleId}
            onEdit={() => {
              const inv = inversores.find(i => i.id === modalDetalleId);
              if (inv) { setEditando(inv); setModalDetalleId(null); setModalFormAbierto(true); }
            }}
          />
        )}
      </Modal>

      {/* Modal crear/editar */}
      <Modal
        open={modalFormAbierto}
        onClose={() => { setModalFormAbierto(false); setEditando(null); }}
        title={editando ? `Editar — ${editando.nombre}` : 'Nuevo inversor'}
      >
        <FormInversor
          inicial={editando ?? undefined}
          onClose={() => { setModalFormAbierto(false); setEditando(null); }}
          onSuccess={cargar}
        />
      </Modal>
    </div>
  );
}
