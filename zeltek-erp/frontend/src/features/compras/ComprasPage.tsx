import { useEffect, useState, useCallback } from 'react';
import { Plus, RefreshCw, Package, ChevronDown, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { Modal } from '@/components/Modal';

interface Categoria {
  id: string;
  nombre: string;
  requiere_asignacion_equipo: boolean;
}

interface Inversor {
  id: string;
  nombre: string;
}

interface Lote {
  id: string;
  numero_lote: string;
  descripcion: string;
  cantidad_total: number;
  precio_lote_usd: number | string;
  flete_lote_usd: number | string;
  costo_unitario_real: number | string;
  proveedor: string;
  fecha_compra: string;
  disponibles: number;
  categoria: { nombre: string };
  inversor: { nombre: string };
  _count: { inventarios: number };
}

function fmt(n: number | string) {
  return `$${parseFloat(String(n)).toFixed(2)}`;
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Formulario nuevo lote ────────────────────────────────────────────────────

function FormLote({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [inversores, setInversores] = useState<Inversor[]>([]);
  const [categoriaId, setCategoriaId] = useState('');
  const [inversorId, setInversorId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [preciLote, setPrecioLote] = useState('');
  const [flete, setFlete] = useState('0');
  const [proveedor, setProveedor] = useState('');
  const [urlCompra, setUrlCompra] = useState('');
  const [fechaCompra, setFechaCompra] = useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ data: Categoria[] }>('/accesorios/categorias'),
      api.get<{ data: Inversor[] }>('/inversores'),
    ]).then(([c, i]) => {
      setCategorias(c.data.data);
      setInversores(i.data.data);
      if (c.data.data[0]) setCategoriaId(c.data.data[0].id);
      if (i.data.data[0]) setInversorId(i.data.data[0].id);
    });
  }, []);

  const cantidadNum = parseInt(cantidad) || 0;
  const precioNum = parseFloat(preciLote) || 0;
  const fleteNum = parseFloat(flete) || 0;
  const costoUnitario = cantidadNum > 0 ? (precioNum + fleteNum) / cantidadNum : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoriaId || !inversorId || !descripcion || !cantidad || !preciLote || !proveedor) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/accesorios/lotes', {
        categoria_id: categoriaId,
        descripcion,
        cantidad_total: cantidadNum,
        precio_lote_usd: precioNum,
        flete_lote_usd: fleteNum,
        proveedor,
        url_compra: urlCompra || null,
        inversor_id: inversorId,
        fecha_compra: fechaCompra,
        notas: notas || null,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al crear lote');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Categoría <span className="text-danger">*</span></label>
          <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Inversor <span className="text-danger">*</span></label>
          <select value={inversorId} onChange={e => setInversorId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
            {inversores.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-slate-400 text-sm mb-1.5">Descripción <span className="text-danger">*</span></label>
          <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="ej. Cargadores Dell 65W Type-C — Lote Amazon"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Cantidad <span className="text-danger">*</span></label>
          <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)}
            placeholder="ej. 10"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Precio del lote (USD) <span className="text-danger">*</span></label>
          <input type="number" step="0.01" value={preciLote} onChange={e => setPrecioLote(e.target.value)}
            placeholder="ej. 120.00"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Flete (USD)</label>
          <input type="number" step="0.01" value={flete} onChange={e => setFlete(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Costo unitario (auto)</label>
          <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-success text-sm font-mono">
            {costoUnitario > 0 ? fmt(costoUnitario) : '—'}
          </div>
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Proveedor <span className="text-danger">*</span></label>
          <input value={proveedor} onChange={e => setProveedor(e.target.value)}
            placeholder="ej. Amazon, eBay, Tienda local"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Fecha de compra</label>
          <input type="date" value={fechaCompra} onChange={e => setFechaCompra(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>

        <div className="col-span-2">
          <label className="block text-slate-400 text-sm mb-1.5">URL de compra (opcional)</label>
          <input type="url" value={urlCompra} onChange={e => setUrlCompra(e.target.value)}
            placeholder="https://amazon.com/..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>

        <div className="col-span-2">
          <label className="block text-slate-400 text-sm mb-1.5">Notas</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm resize-none focus:outline-none focus:border-violet-500" />
        </div>
      </div>

      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 text-sm">Cancelar</button>
        <button type="submit"
          disabled={!categoriaId || !inversorId || !descripcion || !cantidad || !preciLote || !proveedor || loading}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Creando...' : `Crear lote (${cantidadNum} uds · ${costoUnitario > 0 ? fmt(costoUnitario) + '/u' : '—'})`}
        </button>
      </div>
    </form>
  );
}

// ─── Fila de lote expandible ──────────────────────────────────────────────────

function LoteRow({ lote }: { lote: Lote }) {
  const [expandido, setExpandido] = useState(false);
  const vendidos = lote._count.inventarios - lote.disponibles;
  const pctDisp = lote._count.inventarios > 0
    ? Math.round((lote.disponibles / lote._count.inventarios) * 100) : 0;

  return (
    <div className="border-b border-app-border last:border-0">
      <button onClick={() => setExpandido(v => !v)}
        className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-800/30 text-left transition-colors">
        <div className="p-2 bg-violet-600/10 rounded-xl shrink-0">
          <Package size={16} className="text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-slate-100 text-sm font-medium truncate">{lote.descripcion}</p>
            <span className="shrink-0 text-xs text-slate-500 font-mono">{lote.numero_lote}</span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            {lote.categoria.nombre} · {lote.proveedor} · {fmtFecha(lote.fecha_compra)}
          </p>
        </div>
        <div className="shrink-0 text-right hidden sm:block">
          <p className="text-slate-100 text-sm font-semibold">{fmt(lote.costo_unitario_real)}<span className="text-slate-500 text-xs">/u</span></p>
          <p className="text-slate-500 text-xs">{fmt(lote.precio_lote_usd)} lote</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-bold ${lote.disponibles > 0 ? 'text-success' : 'text-slate-500'}`}>
            {lote.disponibles}/{lote._count.inventarios}
          </p>
          <p className="text-slate-500 text-xs">{pctDisp}% disp.</p>
        </div>
        <div className="text-slate-500 shrink-0">
          {expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {expandido && (
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/20">
          {[
            { label: 'Total unidades', val: String(lote._count.inventarios) },
            { label: 'Disponibles', val: String(lote.disponibles), color: 'text-success' },
            { label: 'Vendidos/Asignados', val: String(vendidos), color: 'text-slate-300' },
            { label: 'Inversor', val: lote.inversor.nombre },
            { label: 'Precio lote', val: fmt(lote.precio_lote_usd) },
            { label: 'Flete', val: fmt(lote.flete_lote_usd) },
            { label: 'Costo unitario', val: fmt(lote.costo_unitario_real), color: 'text-violet-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-slate-800/50 rounded-xl p-3">
              <p className="text-slate-500 text-xs">{label}</p>
              <p className={`text-sm font-semibold mt-0.5 ${color ?? 'text-slate-100'}`}>{val}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function ComprasPage() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Lote[] }>('/accesorios/lotes');
      setLotes(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const totalDisp = lotes.reduce((s, l) => s + l.disponibles, 0);
  const totalUnidades = lotes.reduce((s, l) => s + l._count.inventarios, 0);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Compras / Lotes</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {lotes.length} lotes · {totalDisp}/{totalUnidades} unidades disponibles
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setModalAbierto(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> Nuevo lote
          </button>
        </div>
      </div>

      <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando...</div>
        ) : lotes.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-500 text-sm">No hay lotes registrados</p>
            <button onClick={() => setModalAbierto(true)}
              className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-xl">
              Crear primer lote
            </button>
          </div>
        ) : (
          <div>
            {lotes.map(l => <LoteRow key={l.id} lote={l} />)}
          </div>
        )}
      </div>

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} title="Nuevo lote de accesorios" maxWidth="max-w-2xl">
        <FormLote onClose={() => setModalAbierto(false)} onSuccess={cargar} />
      </Modal>
    </div>
  );
}
