import { useEffect, useState, useCallback } from 'react';
import { Plus, RefreshCw, Package, ChevronDown, ChevronRight, ShoppingCart, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { Modal } from '@/components/Modal';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Categoria { id: string; nombre: string; requiere_asignacion_equipo: boolean; }
interface Inversor { id: string; nombre: string; }

interface CompraPendiente {
  id: string;
  fuente: 'GMAIL_EBAY' | 'MANUAL';
  nombre_articulo: string;
  precio_usd: string | number;
  tracking_number: string | null;
  vendedor_ebay: string | null;
  url_ebay: string | null;
  estado: 'pendiente_triage' | 'ingresado' | 'descartado';
  dias_en_inbox: number;
  alerta_stale: boolean;
  created_at: string;
}

interface Lote {
  id: string; numero_lote: string; descripcion: string;
  cantidad_total: number; precio_lote_usd: number | string;
  flete_lote_usd: number | string; costo_unitario_real: number | string;
  proveedor: string; fecha_compra: string; disponibles: number;
  categoria: { nombre: string }; inversor: { nombre: string };
  _count: { inventarios: number };
}

function fmt(n: number | string | null) {
  if (n === null || n === undefined) return '—';
  return `$${parseFloat(String(n)).toFixed(2)}`;
}
function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Form: Agregar compra manual ──────────────────────────────────────────────

function FormNuevaCompra({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [tracking, setTracking] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre || !precio) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/inbox', {
        fuente: 'MANUAL',
        nombre_articulo: nombre,
        precio_usd: parseFloat(precio),
        tracking_number: tracking || null,
        vendedor_ebay: vendedor || null,
        url_ebay: url || null,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al registrar compra');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Artículo <span className="text-danger">*</span></label>
        <input value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="ej. Dell Latitude 5420 i5 8GB 256GB"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Precio pagado (USD) <span className="text-danger">*</span></label>
          <input type="number" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)}
            placeholder="ej. 145.00"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Tracking</label>
          <input value={tracking} onChange={e => setTracking(e.target.value)}
            placeholder="ej. 1Z999AA10123456784"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Vendedor</label>
          <input value={vendedor} onChange={e => setVendedor(e.target.value)}
            placeholder="ej. techseller_usa, Marketplace local"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">URL del listing</label>
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://ebay.com/..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
      </div>
      <p className="text-slate-500 text-xs">Después del registro podrás hacer triage: asignarle número de serie, especificaciones y precio de venta.</p>
      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 text-sm">Cancelar</button>
        <button type="submit" disabled={!nombre || !precio || loading}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Registrando...' : 'Registrar compra'}
        </button>
      </div>
    </form>
  );
}

// ─── Form: Triage — Ingresar al inventario ────────────────────────────────────

function FormIngresar({ compra, onClose, onSuccess }: { compra: CompraPendiente; onClose: () => void; onSuccess: () => void }) {
  const [inversores, setInversores] = useState<Inversor[]>([]);
  const [inversorId, setInversorId] = useState('');
  const [serie, setSerie] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [tipo, setTipo] = useState<'laptop' | 'telefono' | 'tablet' | 'otro'>('laptop');
  const [condicion, setCondicion] = useState<'NUEVO' | 'SEMINUEVO'>('SEMINUEVO');
  const [procesador, setProcesador] = useState('');
  const [ram, setRam] = useState('');
  const [almacenamiento, setAlmacenamiento] = useState('');
  const [tipoAlmacenamiento, setTipoAlmacenamiento] = useState('SSD');
  const [costoBase, setCostoBase] = useState(String(parseFloat(String(compra.precio_usd)).toFixed(2)));
  const [precioVenta, setPrecioVenta] = useState('');
  const [requiereCargador, setRequiereCargador] = useState(true);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: Inversor[] }>('/inversores').then(r => {
      setInversores(r.data.data);
      if (r.data.data[0]) setInversorId(r.data.data[0].id);
    });
    // Pre-fill marca/modelo from nombre_articulo
    const parts = compra.nombre_articulo.split(' ');
    if (parts[0]) setMarca(parts[0]);
    if (parts.length > 1) setModelo(parts.slice(1).join(' '));
  }, [compra.nombre_articulo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inversorId || !serie || !marca || !modelo || !costoBase || !precioVenta) return;
    setError(null);
    setLoading(true);
    try {
      await api.post(`/inbox/${compra.id}/ingresar`, {
        inversor_id: inversorId,
        numero_serie: serie,
        marca,
        modelo,
        tipo,
        condicion,
        procesador: procesador || null,
        ram_gb: ram ? parseInt(ram) : null,
        almacenamiento_gb: almacenamiento ? parseInt(almacenamiento) : null,
        tipo_almacenamiento: tipoAlmacenamiento || null,
        costo_base_usd: parseFloat(costoBase),
        precio_venta_sugerido_usd: parseFloat(precioVenta),
        requiere_cargador: requiereCargador,
        notas: notas || null,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al ingresar al inventario');
    } finally {
      setLoading(false);
    }
  }

  const inp = "w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Info del artículo */}
      <div className="bg-slate-800/50 rounded-xl px-4 py-3 border border-app-border">
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Artículo a ingresar</p>
        <p className="text-slate-100 text-sm font-medium">{compra.nombre_articulo}</p>
        <p className="text-slate-500 text-xs">{fmt(compra.precio_usd)} pagado · {compra.vendedor_ebay ?? 'Manual'}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-slate-400 text-sm mb-1.5">Inversor <span className="text-danger">*</span></label>
          <select value={inversorId} onChange={e => setInversorId(e.target.value)} className={inp}>
            {inversores.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Número de serie <span className="text-danger">*</span></label>
          <input value={serie} onChange={e => setSerie(e.target.value)} placeholder="ej. 5CG1234XYZ" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)} className={inp}>
            <option value="laptop">Laptop</option>
            <option value="telefono">Teléfono</option>
            <option value="tablet">Tablet</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Marca <span className="text-danger">*</span></label>
          <input value={marca} onChange={e => setMarca(e.target.value)} placeholder="ej. Dell" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Modelo <span className="text-danger">*</span></label>
          <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="ej. Latitude 5420" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Condición</label>
          <select value={condicion} onChange={e => setCondicion(e.target.value as 'NUEVO' | 'SEMINUEVO')} className={inp}>
            <option value="SEMINUEVO">Seminuevo</option>
            <option value="NUEVO">Nuevo</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Procesador</label>
          <input value={procesador} onChange={e => setProcesador(e.target.value)} placeholder="ej. Intel i5-11th Gen" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">RAM (GB)</label>
          <input type="number" value={ram} onChange={e => setRam(e.target.value)} placeholder="ej. 8" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Almacenamiento (GB)</label>
          <input type="number" value={almacenamiento} onChange={e => setAlmacenamiento(e.target.value)} placeholder="ej. 256" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Tipo almacenamiento</label>
          <select value={tipoAlmacenamiento} onChange={e => setTipoAlmacenamiento(e.target.value)} className={inp}>
            <option value="SSD">SSD</option>
            <option value="HDD">HDD</option>
            <option value="eMMC">eMMC</option>
            <option value="NVMe">NVMe</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Costo base (USD) <span className="text-danger">*</span></label>
          <input type="number" step="0.01" value={costoBase} onChange={e => setCostoBase(e.target.value)} className={inp} />
          <p className="text-slate-600 text-xs mt-1">Pre-llenado del precio pagado</p>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Precio venta sugerido (USD) <span className="text-danger">*</span></label>
          <input type="number" step="0.01" value={precioVenta} onChange={e => setPrecioVenta(e.target.value)} placeholder="ej. 350" className={inp} />
        </div>
      </div>

      <div className="col-span-2">
        <label className="block text-slate-400 text-sm mb-1.5">Notas</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          placeholder="Condición física, detalles adicionales..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm resize-none focus:outline-none focus:border-violet-500" />
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={requiereCargador} onChange={e => setRequiereCargador(e.target.checked)}
          className="rounded border-slate-600 bg-slate-800 text-violet-600" />
        <span className="text-slate-400 text-sm">Requiere cargador (se asignará desde inventario de accesorios)</span>
      </label>

      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 text-sm">Cancelar</button>
        <button type="submit" disabled={!inversorId || !serie || !marca || !modelo || !costoBase || !precioVenta || loading}
          className="flex-1 py-2.5 rounded-xl bg-success hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Ingresando...' : 'Ingresar al inventario'}
        </button>
      </div>
    </form>
  );
}

// ─── Form: Triage — Descartar ─────────────────────────────────────────────────

function FormDescartar({ compra, onClose, onSuccess }: { compra: CompraPendiente; onClose: () => void; onSuccess: () => void }) {
  const [razon, setRazon] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!razon) return;
    setError(null);
    setLoading(true);
    try {
      await api.post(`/inbox/${compra.id}/descartar`, { razon });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al descartar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-slate-400 text-sm">
        Descartando: <span className="text-slate-200 font-medium">{compra.nombre_articulo}</span>
      </p>
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Razón <span className="text-danger">*</span></label>
        <textarea value={razon} onChange={e => setRazon(e.target.value)} rows={3}
          placeholder="ej. Artículo llegó dañado y se devolvió, compra cancelada, error de registro..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm resize-none focus:outline-none focus:border-violet-500" />
      </div>
      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 text-sm">Cancelar</button>
        <button type="submit" disabled={!razon || loading}
          className="flex-1 py-2.5 rounded-xl bg-danger hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Descartando...' : 'Confirmar descarte'}
        </button>
      </div>
    </form>
  );
}

// ─── Tab: Equipos (Inbox) ─────────────────────────────────────────────────────

function TabEquipos() {
  const [compras, setCompras] = useState<CompraPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'pendiente_triage' | 'ingresado' | 'descartado' | ''>('pendiente_triage');
  const [modalNueva, setModalNueva] = useState(false);
  const [ingresando, setIngresando] = useState<CompraPendiente | null>(null);
  const [descartando, setDescartando] = useState<CompraPendiente | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: CompraPendiente[] }>('/inbox');
      setCompras(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const mostradas = filtro ? compras.filter(c => c.estado === filtro) : compras;
  const pendientes = compras.filter(c => c.estado === 'pendiente_triage').length;
  const alertas = compras.filter(c => c.alerta_stale).length;

  const ESTADO_BADGE: Record<string, string> = {
    pendiente_triage: 'bg-warning/10 text-warning',
    ingresado: 'bg-success/10 text-success',
    descartado: 'bg-slate-700 text-slate-500',
  };
  const ESTADO_LABEL: Record<string, string> = {
    pendiente_triage: 'Pendiente', ingresado: 'Ingresado', descartado: 'Descartado',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {alertas > 0 && (
            <div className="flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-xl px-3 py-1.5">
              <AlertTriangle size={14} className="text-warning" />
              <span className="text-warning text-xs font-medium">{alertas} compra{alertas > 1 ? 's' : ''} sin triage &gt;5 días</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setModalNueva(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> Registrar compra
          </button>
        </div>
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-2">
        {[
          { val: 'pendiente_triage', label: `Pendientes (${pendientes})` },
          { val: 'ingresado', label: 'Ingresados' },
          { val: 'descartado', label: 'Descartados' },
          { val: '', label: 'Todos' },
        ].map(f => (
          <button key={f.val} onClick={() => setFiltro(f.val as typeof filtro)}
            className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
              filtro === f.val
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm animate-pulse">Cargando compras...</div>
      ) : mostradas.length === 0 ? (
        <div className="py-12 text-center">
          <ShoppingCart size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {filtro === 'pendiente_triage' ? 'No hay compras pendientes de triage' : 'No hay registros'}
          </p>
          {filtro === 'pendiente_triage' && (
            <button onClick={() => setModalNueva(true)}
              className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-xl">
              Registrar primera compra
            </button>
          )}
        </div>
      ) : (
        <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
          <div className="divide-y divide-app-border">
            {mostradas.map(c => (
              <div key={c.id} className={`flex items-center gap-4 px-4 py-3.5 hover:bg-slate-800/20 transition-colors ${c.alerta_stale ? 'border-l-2 border-warning' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-slate-100 text-sm font-medium">{c.nombre_articulo}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[c.estado]}`}>
                      {ESTADO_LABEL[c.estado]}
                    </span>
                    {c.fuente === 'GMAIL_EBAY' && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-400">eBay auto</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <p className="text-success text-sm font-semibold">{fmt(c.precio_usd)}</p>
                    {c.vendedor_ebay && <p className="text-slate-500 text-xs">{c.vendedor_ebay}</p>}
                    {c.tracking_number && (
                      <p className="text-slate-600 text-xs font-mono">{c.tracking_number}</p>
                    )}
                    <div className="flex items-center gap-1 text-slate-600 text-xs">
                      <Clock size={11} />
                      {c.dias_en_inbox === 0 ? 'Hoy' : `Hace ${c.dias_en_inbox} día${c.dias_en_inbox > 1 ? 's' : ''}`}
                      {c.alerta_stale && <span className="text-warning ml-1">⚠ Sin triage</span>}
                    </div>
                  </div>
                </div>
                {c.url_ebay && (
                  <a href={c.url_ebay} target="_blank" rel="noreferrer"
                    className="text-xs text-violet-400 hover:underline shrink-0">Ver listing</a>
                )}
                {c.estado === 'pendiente_triage' && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setIngresando(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/10 hover:bg-success/20 text-success text-xs font-semibold transition-colors">
                      <CheckCircle size={13} /> Ingresar
                    </button>
                    <button onClick={() => setDescartando(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-danger/10 hover:bg-danger/20 text-danger text-xs font-semibold transition-colors">
                      <XCircle size={13} /> Descartar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={modalNueva} onClose={() => setModalNueva(false)} title="Registrar compra de equipo">
        <FormNuevaCompra onClose={() => setModalNueva(false)} onSuccess={cargar} />
      </Modal>
      <Modal open={!!ingresando} onClose={() => setIngresando(null)} title="Ingresar al inventario" maxWidth="max-w-2xl">
        {ingresando && <FormIngresar compra={ingresando} onClose={() => setIngresando(null)} onSuccess={cargar} />}
      </Modal>
      <Modal open={!!descartando} onClose={() => setDescartando(null)} title="Descartar compra">
        {descartando && <FormDescartar compra={descartando} onClose={() => setDescartando(null)} onSuccess={cargar} />}
      </Modal>
    </div>
  );
}

// ─── Tab: Accesorios (Lotes) ──────────────────────────────────────────────────

function FormLote({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [inversores, setInversores] = useState<Inversor[]>([]);
  const [categoriaId, setCategoriaId] = useState('');
  const [inversorId, setInversorId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [precioLote, setPrecioLote] = useState('');
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
  const precioNum = parseFloat(precioLote) || 0;
  const fleteNum = parseFloat(flete) || 0;
  const costoUnitario = cantidadNum > 0 ? (precioNum + fleteNum) / cantidadNum : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoriaId || !inversorId || !descripcion || !cantidad || !precioLote || !proveedor) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/accesorios/lotes', {
        categoria_id: categoriaId, descripcion,
        cantidad_total: cantidadNum, precio_lote_usd: precioNum,
        flete_lote_usd: fleteNum, proveedor,
        url_compra: urlCompra || null, inversor_id: inversorId,
        fecha_compra: fechaCompra, notas: notas || null,
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

  const inp = "w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Categoría <span className="text-danger">*</span></label>
          <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} className={inp}>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Inversor <span className="text-danger">*</span></label>
          <select value={inversorId} onChange={e => setInversorId(e.target.value)} className={inp}>
            {inversores.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-slate-400 text-sm mb-1.5">Descripción <span className="text-danger">*</span></label>
          <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="ej. Cargadores Dell 65W Type-C — Lote Amazon" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Cantidad <span className="text-danger">*</span></label>
          <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="ej. 10" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Precio del lote (USD) <span className="text-danger">*</span></label>
          <input type="number" step="0.01" value={precioLote} onChange={e => setPrecioLote(e.target.value)} placeholder="ej. 120.00" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Flete (USD)</label>
          <input type="number" step="0.01" value={flete} onChange={e => setFlete(e.target.value)} placeholder="0.00" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Costo unitario (auto)</label>
          <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-success text-sm font-mono">
            {costoUnitario > 0 ? fmt(costoUnitario) : '—'}
          </div>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Proveedor <span className="text-danger">*</span></label>
          <input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="ej. Amazon, eBay" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Fecha de compra</label>
          <input type="date" value={fechaCompra} onChange={e => setFechaCompra(e.target.value)} className={inp} />
        </div>
        <div className="col-span-2">
          <label className="block text-slate-400 text-sm mb-1.5">URL de compra (opcional)</label>
          <input value={urlCompra} onChange={e => setUrlCompra(e.target.value)} placeholder="https://amazon.com/..." className={inp} />
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
          disabled={!categoriaId || !inversorId || !descripcion || !cantidad || !precioLote || !proveedor || loading}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Creando...' : `Crear lote (${cantidadNum} uds${costoUnitario > 0 ? ` · ${fmt(costoUnitario)}/u` : ''})`}
        </button>
      </div>
    </form>
  );
}

function LoteRow({ lote }: { lote: Lote }) {
  const [expandido, setExpandido] = useState(false);
  const vendidos = lote._count.inventarios - lote.disponibles;
  const pctDisp = lote._count.inventarios > 0 ? Math.round((lote.disponibles / lote._count.inventarios) * 100) : 0;

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
          <p className="text-slate-500 text-xs mt-0.5">{lote.categoria.nombre} · {lote.proveedor} · {fmtFecha(lote.fecha_compra)}</p>
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
        <div className="text-slate-500 shrink-0">{expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
      </button>
      {expandido && (
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/20">
          {[
            { label: 'Total unidades', val: String(lote._count.inventarios) },
            { label: 'Disponibles', val: String(lote.disponibles), color: 'text-success' },
            { label: 'Vendidos/Asignados', val: String(vendidos) },
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

function TabAccesorios() {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">{lotes.length} lotes · {totalDisp}/{totalUnidades} unidades disponibles</p>
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
          <div className="py-12 text-center text-slate-500 text-sm animate-pulse">Cargando...</div>
        ) : lotes.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-500 text-sm">No hay lotes registrados</p>
            <button onClick={() => setModalAbierto(true)}
              className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-xl">Crear primer lote</button>
          </div>
        ) : (
          lotes.map(l => <LoteRow key={l.id} lote={l} />)
        )}
      </div>
      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} title="Nuevo lote de accesorios" maxWidth="max-w-2xl">
        <FormLote onClose={() => setModalAbierto(false)} onSuccess={cargar} />
      </Modal>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function ComprasPage() {
  const [tab, setTab] = useState<'equipos' | 'accesorios'>('equipos');

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Compras</h1>
        <p className="text-slate-500 text-sm mt-0.5">Registro de equipos y lotes de accesorios</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-app-border">
        {([
          { key: 'equipos', label: 'Equipos' },
          { key: 'accesorios', label: 'Accesorios' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'text-violet-400 border-b-2 border-violet-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'equipos' ? <TabEquipos /> : <TabAccesorios />}
    </div>
  );
}
