import { useEffect, useState, useCallback } from 'react';
import { Plus, RefreshCw, AlertTriangle, TrendingDown } from 'lucide-react';
import api from '@/lib/api';
import { Modal } from '@/components/Modal';
import { TIMEZONE_NI, hoyNI, primerDiaMesNI } from '@/lib/utils';

const CATEGORIAS = ['LOGISTICA', 'MARKETING', 'HERRAMIENTAS', 'RENTA', 'SERVICIOS', 'OTRO'] as const;
type Categoria = typeof CATEGORIAS[number];

interface Gasto {
  id: string;
  concepto: string;
  monto_usd: string | number;
  monto_original: string | number;
  moneda_original: 'USD' | 'NIO' | 'MIXTO';
  tasa_cambio_aplicada: string | number | null;
  fecha: string;
  categoria: Categoria;
  comprobante_url: string | null;
  recurrente: boolean;
  notas: string | null;
  usuario?: { nombre: string };
}

interface Fondo {
  id: string;
  nombre: string;
  saldo_usd: number;
  alerta: boolean;
}

function fmt(n: number | string | null | undefined) {
  if (n === null || n === undefined) return '—';
  return `$${parseFloat(String(n)).toFixed(2)}`;
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TIMEZONE_NI });
}

const CAT_LABELS: Record<Categoria, string> = {
  LOGISTICA: 'Logística', MARKETING: 'Marketing', HERRAMIENTAS: 'Herramientas',
  RENTA: 'Renta', SERVICIOS: 'Servicios', OTRO: 'Otro',
};
const CAT_COLORS: Record<Categoria, string> = {
  LOGISTICA: 'bg-blue-500/10 text-blue-400', MARKETING: 'bg-pink-500/10 text-pink-400',
  HERRAMIENTAS: 'bg-amber-500/10 text-amber-400', RENTA: 'bg-purple-500/10 text-purple-400',
  SERVICIOS: 'bg-cyan-500/10 text-cyan-400', OTRO: 'bg-slate-700 text-slate-400',
};

// ─── Formulario ──────────────────────────────────────────────────────────────

function FormGasto({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const today = hoyNI();
  const [concepto, setConcepto] = useState('');
  const [monedaOriginal, setMonedaOriginal] = useState<'USD' | 'NIO' | 'MIXTO'>('USD');
  const [montoOriginal, setMontoOriginal] = useState('');
  const [tasa, setTasa] = useState('');
  const [montoUsd, setMontoUsd] = useState('');
  const [fecha, setFecha] = useState(today);
  const [categoria, setCategoria] = useState<Categoria>('OTRO');
  const [comprobanteUrl, setComprobanteUrl] = useState('');
  const [recurrente, setRecurrente] = useState(false);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill montoUsd when moneda is USD
  function handleMontoOriginal(v: string) {
    setMontoOriginal(v);
    if (monedaOriginal === 'USD') setMontoUsd(v);
  }

  function handleMoneda(v: 'USD' | 'NIO' | 'MIXTO') {
    setMonedaOriginal(v);
    if (v === 'USD') { setMontoUsd(montoOriginal); setTasa(''); }
    else { setMontoUsd(''); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!concepto || !montoOriginal || !montoUsd || !fecha) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/gastos', {
        concepto,
        moneda_original: monedaOriginal,
        monto_original: parseFloat(montoOriginal),
        tasa_cambio_aplicada: tasa ? parseFloat(tasa) : null,
        monto_usd: parseFloat(montoUsd),
        fecha,
        categoria,
        comprobante_url: comprobanteUrl || null,
        recurrente,
        notas: notas || null,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al registrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Concepto <span className="text-danger">*</span></label>
        <input value={concepto} onChange={e => setConcepto(e.target.value)}
          placeholder="ej. Envío Miami → Managua, Renta oficina mayo"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Categoría</label>
          <select value={categoria} onChange={e => setCategoria(e.target.value as Categoria)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
            {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Fecha <span className="text-danger">*</span></label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Moneda</label>
          <select value={monedaOriginal} onChange={e => handleMoneda(e.target.value as 'USD' | 'NIO' | 'MIXTO')}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
            <option value="USD">USD</option>
            <option value="NIO">NIO (C$)</option>
            <option value="MIXTO">Mixto</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Monto original <span className="text-danger">*</span></label>
          <input type="number" step="0.01" value={montoOriginal} onChange={e => handleMontoOriginal(e.target.value)}
            placeholder={monedaOriginal === 'NIO' ? 'C$' : '$'}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
        {monedaOriginal !== 'USD' && (
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">Tasa (NIO/USD)</label>
            <input type="number" step="0.01" value={tasa} onChange={e => setTasa(e.target.value)}
              placeholder="ej. 36.8"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
          </div>
        )}
      </div>

      {monedaOriginal !== 'USD' && (
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Equivalente en USD <span className="text-danger">*</span></label>
          <input type="number" step="0.01" value={montoUsd} onChange={e => setMontoUsd(e.target.value)}
            placeholder="Monto en dólares"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
      )}

      <div>
        <label className="block text-slate-400 text-sm mb-1.5">URL comprobante</label>
        <input value={comprobanteUrl} onChange={e => setComprobanteUrl(e.target.value)}
          placeholder="Link a foto/PDF del comprobante"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
      </div>

      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Notas</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm resize-none focus:outline-none focus:border-violet-500" />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={recurrente} onChange={e => setRecurrente(e.target.checked)}
          className="rounded border-slate-600 bg-slate-800 text-violet-600" />
        <span className="text-slate-400 text-sm">Gasto recurrente</span>
      </label>

      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 text-sm">
          Cancelar
        </button>
        <button type="submit" disabled={!concepto || !montoOriginal || !montoUsd || loading}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Registrando...' : 'Registrar gasto'}
        </button>
      </div>
    </form>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [totalUsd, setTotalUsd] = useState(0);
  const [meta, setMeta] = useState({ total: 0, pages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);

  // Filtros
  const [desde, setDesde] = useState(primerDiaMesNI());
  const [hasta, setHasta] = useState(hoyNI());
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [page, setPage] = useState(1);

  const cargarFondos = useCallback(async () => {
    try {
      const res = await api.get<{ data: Fondo[] }>('/gastos/fondos');
      setFondos(res.data.data);
    } catch { /* silencioso */ }
  }, []);

  const cargarGastos = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      if (categoriaFiltro) params.categoria = categoriaFiltro;
      const res = await api.get<{ items: Gasto[]; meta: typeof meta & { total_usd: number } }>('/gastos', { params });
      setGastos(res.data.items);
      setMeta(res.data.meta);
      setTotalUsd(res.data.meta.total_usd ?? 0);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, categoriaFiltro, page]);

  useEffect(() => { cargarFondos(); }, [cargarFondos]);
  useEffect(() => { setPage(1); }, [desde, hasta, categoriaFiltro]);
  useEffect(() => { cargarGastos(); }, [cargarGastos]);

  const opexFondo = fondos.find(f => f.nombre === 'OPEX');

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Gastos Operativos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{meta.total} gastos registrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { cargarGastos(); cargarFondos(); }}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setModalAbierto(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> Registrar gasto
          </button>
        </div>
      </div>

      {/* Banner OPEX */}
      {opexFondo && (
        <div className={`rounded-xl border px-5 py-4 flex items-center justify-between gap-4 ${
          opexFondo.saldo_usd < 0
            ? 'bg-danger/10 border-danger/40'
            : opexFondo.saldo_usd < 50
            ? 'bg-warning/10 border-warning/40'
            : 'bg-blue-500/5 border-blue-500/30'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg ${opexFondo.saldo_usd < 0 ? 'bg-danger/20' : 'bg-blue-500/15'}`}>
              <TrendingDown size={18} className={opexFondo.saldo_usd < 0 ? 'text-danger' : 'text-blue-400'} />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Fondo Operativo disponible para gastos</p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${opexFondo.saldo_usd < 0 ? 'text-danger' : opexFondo.saldo_usd < 50 ? 'text-warning' : 'text-blue-300'}`}>
                {fmt(opexFondo.saldo_usd)}
              </p>
            </div>
          </div>
          {opexFondo.saldo_usd < 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <AlertTriangle size={15} className="text-danger" />
              <span className="text-danger text-xs font-medium">Fondo en negativo</span>
            </div>
          )}
          {opexFondo.saldo_usd >= 0 && opexFondo.saldo_usd < 50 && (
            <div className="flex items-center gap-2 shrink-0">
              <AlertTriangle size={15} className="text-warning" />
              <span className="text-warning text-xs font-medium">Saldo bajo</span>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-sm">Desde</span>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-sm">Hasta</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
        <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}
          className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
        </select>
        {(desde || hasta || categoriaFiltro) && (
          <div className="ml-auto flex items-center gap-2 text-slate-400 text-sm">
            <TrendingDown size={14} className="text-danger" />
            Total período: <span className="font-bold text-danger">{fmt(totalUsd)}</span>
          </div>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando gastos...</div>
      ) : gastos.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-slate-500 text-sm">No hay gastos en el período seleccionado</p>
          <button onClick={() => setModalAbierto(true)}
            className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-xl">
            Registrar primer gasto
          </button>
        </div>
      ) : (
        <>
          <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
            <div className="divide-y divide-app-border">
              {gastos.map(g => (
                <div key={g.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-800/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-slate-100 text-sm font-medium">{g.concepto}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CAT_COLORS[g.categoria]}`}>
                        {CAT_LABELS[g.categoria]}
                      </span>
                      {g.recurrente && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-violet-600/10 text-violet-400">Recurrente</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-slate-500 text-xs">{fmtFecha(g.fecha)}</p>
                      {g.usuario && <p className="text-slate-600 text-xs">· {g.usuario.nombre}</p>}
                      {g.moneda_original !== 'USD' && (
                        <p className="text-slate-600 text-xs">
                          · {g.moneda_original === 'NIO' ? 'C$' : ''}{parseFloat(String(g.monto_original)).toFixed(2)}
                          {g.tasa_cambio_aplicada && ` @ ${parseFloat(String(g.tasa_cambio_aplicada)).toFixed(2)}`}
                        </p>
                      )}
                    </div>
                    {g.notas && <p className="text-slate-600 text-xs mt-0.5 truncate max-w-md">{g.notas}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-danger font-semibold text-sm">{fmt(g.monto_usd)}</p>
                    {g.comprobante_url && (
                      <a href={g.comprobante_url} target="_blank" rel="noreferrer"
                        className="text-xs text-violet-400 hover:underline">comprobante</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Paginación */}
          {meta.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-sm">Página {meta.page} de {meta.pages}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-app-border text-slate-400 disabled:opacity-40 hover:text-slate-100 text-sm">
                  Anterior
                </button>
                <button disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-app-border text-slate-400 disabled:opacity-40 hover:text-slate-100 text-sm">
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} title="Registrar Gasto Operativo" maxWidth="max-w-xl">
        <FormGasto onClose={() => setModalAbierto(false)} onSuccess={() => { cargarGastos(); cargarFondos(); }} />
      </Modal>
    </div>
  );
}
