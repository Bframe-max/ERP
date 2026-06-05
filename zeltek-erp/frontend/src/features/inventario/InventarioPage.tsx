import { useEffect, useState, useCallback } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { EstadoBadge } from '@/shared/components/EstadoBadge';
import { Modal } from '@/components/Modal';
import type { EstadoEquipo } from '@/types/equipo';

interface EquipoRow {
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
  foto_urls: string[];
  requiere_cargador: boolean;
  inversor: { nombre: string };
}

interface Meta { total: number; page: number; limit: number; pages: number; }

const TRANSICIONES: Record<EstadoEquipo, EstadoEquipo[]> = {
  COMPRADO:        ['EN_BODEGA_MIAMI', 'EN_RECLAMO'],
  EN_BODEGA_MIAMI: ['EN_TRANSITO', 'EN_RECLAMO'],
  EN_TRANSITO:     ['EN_TALLER', 'EN_RECLAMO'],
  EN_TALLER:       ['DISPONIBLE'],
  DISPONIBLE:      ['EN_TALLER', 'EN_RECLAMO'],
  VENDIDO:         ['EN_RECLAMO', 'EN_TALLER'],
  EN_RECLAMO:      ['DISPONIBLE', 'DEVUELTO'],
  DEVUELTO:        [],
};

const ESTADO_LABELS: Record<EstadoEquipo, string> = {
  COMPRADO: 'Comprado', EN_BODEGA_MIAMI: 'Bodega Miami', EN_TRANSITO: 'En Tránsito',
  EN_TALLER: 'En Taller', DISPONIBLE: 'Disponible', VENDIDO: 'Vendido',
  EN_RECLAMO: 'En Reclamo', DEVUELTO: 'Devuelto',
};

const ESTADOS_FILTRO = [
  { value: '', label: 'Todos' },
  { value: 'COMPRADO', label: 'Comprado' },
  { value: 'EN_BODEGA_MIAMI', label: 'Bodega Miami' },
  { value: 'EN_TRANSITO', label: 'En Tránsito' },
  { value: 'EN_TALLER', label: 'En Taller' },
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'VENDIDO', label: 'Vendido' },
  { value: 'EN_RECLAMO', label: 'En Reclamo' },
];

function fmt(n: number | string) {
  return `$${parseFloat(String(n)).toFixed(2)}`;
}

// ─── Modal cambio de estado ───────────────────────────────────────────────────

function ModalCambioEstado({
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
  const [fotoUrl, setFotoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const necesitaPeso = estadoNuevo === 'DISPONIBLE';
  const necesitaFoto = estadoNuevo === 'DISPONIBLE' && equipo.foto_urls.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!estadoNuevo) return;
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = { estado_nuevo: estadoNuevo, notas: notas || undefined };
      if (necesitaPeso && peso) body.peso_real_libras = parseFloat(peso);
      if (necesitaFoto && fotoUrl) body.foto_urls = [fotoUrl];
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
          {necesitaFoto && (
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">
                URL de foto <span className="text-danger">*</span>
              </label>
              <input
                type="url"
                value={fotoUrl}
                onChange={e => setFotoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-violet-500"
              />
              <p className="text-slate-500 text-xs mt-1">Al menos 1 foto requerida</p>
            </div>
          )}
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

// ─── Página principal ─────────────────────────────────────────────────────────

export function InventarioPage() {
  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<EquipoRow | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (busqueda) params.set('q', busqueda);
      if (estado) params.set('estado', estado);
      const res = await api.get<{ items: EquipoRow[]; meta: Meta }>(`/equipos?${params}`);
      setEquipos(res.data.items);
      setMeta(res.data.meta);
    } finally {
      setLoading(false);
    }
  }, [page, busqueda, estado]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPage(1); }, [busqueda, estado]);

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Inventario</h1>
          <p className="text-slate-500 text-sm mt-0.5">{meta.total} equipos en total</p>
        </div>
        <button onClick={cargar}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por serie, marca, modelo..."
            className="w-full bg-app-surface border border-app-border rounded-xl pl-9 pr-4 py-2.5 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {ESTADOS_FILTRO.map(e => (
            <button key={e.value} onClick={() => setEstado(e.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${estado === e.value ? 'bg-violet-600 text-white' : 'bg-app-surface border border-app-border text-slate-400 hover:text-slate-100'}`}>
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando...</div>
        ) : equipos.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">No se encontraron equipos</div>
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
                      <div className="flex items-center gap-3">
                        {eq.foto_urls?.[0] ? (
                          <img src={eq.foto_urls[0]} alt="" className="w-8 h-8 rounded-lg object-cover bg-slate-700" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-600 text-xs">📷</div>
                        )}
                        <div>
                          <p className="text-slate-100 font-medium">{eq.marca} {eq.modelo}</p>
                          <p className="text-slate-500 text-xs">{eq.condicion === 'NUEVO' ? 'Nuevo' : 'Seminuevo'}</p>
                        </div>
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
                      {eq.estado !== 'DEVUELTO' && eq.estado !== 'VENDIDO' && (
                        <button
                          onClick={() => setEquipoSeleccionado(eq)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-violet-600/20 hover:text-violet-400 text-slate-400 text-xs font-medium transition-colors border border-slate-700 hover:border-violet-600/50"
                        >
                          Estado
                        </button>
                      )}
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
            onSuccess={cargar}
          />
        )}
      </Modal>
    </div>
  );
}
