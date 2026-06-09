import { useEffect, useState, useCallback } from 'react';
import { Plus, RefreshCw, Package, ChevronDown, ChevronRight, ShoppingCart, Clock, CheckCircle, XCircle, AlertTriangle, DollarSign, Search, Plane, Wrench } from 'lucide-react';
import api from '@/lib/api';
import { Modal } from '@/components/Modal';
import { EstadoBadge } from '@/shared/components/EstadoBadge';
import { ModalCambioEstado, ESTADO_LABELS, type EquipoRow } from '@/features/inventario/InventarioPage';
import { TIMEZONE_NI, hoyNI } from '@/lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Categoria { id: string; nombre: string; requiere_asignacion_equipo: boolean; }
interface Inversor { id: string; nombre: string; }
interface Producto { id: string; nombre: string; marca: string; categoria: string | null; }

interface CompraPendiente {
  id: string;
  fuente: 'GMAIL_EBAY' | 'MANUAL';
  nombre_articulo: string;
  precio_usd: string | number;
  costo_envio_usd: string | number | null;
  cantidad: number;
  fecha_compra: string | null;
  producto: { id: string; nombre: string; marca: string } | null;
  tracking_number: string | null;
  tracking_interno: string | null;
  vendedor_ebay: string | null;
  url_ebay: string | null;
  estado: 'pendiente' | 'en_miami' | 'en_transito_nicaragua' | 'recibido' | 'ingresado' | 'descartado';
  dias_en_inbox: number;
  alerta_stale: boolean;
  created_at: string;
}

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-slate-700 text-slate-300',
  en_miami: 'bg-blue-500/10 text-blue-400',
  en_transito_nicaragua: 'bg-violet-500/10 text-violet-300',
  recibido: 'bg-warning/10 text-warning',
  ingresado: 'bg-success/10 text-success',
  descartado: 'bg-slate-800 text-slate-500',
};
const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_miami: 'En Bodega Miami',
  en_transito_nicaragua: 'En Tránsito a Nicaragua',
  recibido: 'Recibido',
  ingresado: 'Ingresado',
  descartado: 'Descartado',
};

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
  return new Date(iso).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TIMEZONE_NI });
}

// ─── Form: Registrar Compra eBay ──────────────────────────────────────────────

function FormCompraEbay({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [vendedor, setVendedor] = useState('');
  const [tracking, setTracking] = useState('');
  const [fecha, setFecha] = useState(hoyNI());
  const [productoId, setProductoId] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [mostrarLista, setMostrarLista] = useState(false);
  const [esLoteVariado, setEsLoteVariado] = useState(false);
  const [descripcionLote, setDescripcionLote] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [costoTotal, setCostoTotal] = useState('');
  const [costoEnvio, setCostoEnvio] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: Producto[] }>('/productos', { params: { activo: true } }).then(r => setProductos(r.data.data));
  }, []);

  const productoSeleccionado = productos.find(p => p.id === productoId) ?? null;
  const sugeridos = productos
    .filter(p => `${p.marca} ${p.nombre}`.toLowerCase().includes(busquedaProducto.trim().toLowerCase()))
    .slice(0, 8);

  const cantidadNum = parseInt(cantidad) || 0;
  const totalNum = parseFloat(costoTotal) || 0;
  const envioNum = parseFloat(costoEnvio) || 0;
  const costoUnitario = cantidadNum > 0 ? (totalNum + envioNum) / cantidadNum : 0;

  const articuloValido = esLoteVariado ? !!descripcionLote.trim() : !!productoSeleccionado;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendedor || !tracking.trim() || !articuloValido || !cantidad || !costoTotal) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/inbox', {
        fuente: 'MANUAL',
        nombre_articulo: esLoteVariado ? descripcionLote.trim() : `${productoSeleccionado!.marca} ${productoSeleccionado!.nombre}`,
        precio_usd: totalNum,
        costo_envio_usd: envioNum,
        cantidad: cantidadNum,
        fecha_compra: fecha,
        producto_id: esLoteVariado ? null : productoSeleccionado!.id,
        tracking_number: tracking.trim(),
        vendedor_ebay: vendedor,
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

  const inp = "w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Vendedor <span className="text-danger">*</span></label>
          <input value={vendedor} onChange={e => setVendedor(e.target.value)}
            placeholder="ej. techseller_usa" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Tracking (eBay / courier) <span className="text-danger">*</span></label>
          <input value={tracking} onChange={e => setTracking(e.target.value)}
            placeholder="ej. 1Z999AA10123456784" className={inp} />
          <p className="text-slate-600 text-xs mt-1">No se permiten trackings repetidos. Es obligatorio para registrar la compra.</p>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Cantidad <span className="text-danger">*</span></label>
          <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} className={inp} />
        </div>

        <div className="col-span-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={esLoteVariado}
              onChange={e => { setEsLoteVariado(e.target.checked); setProductoId(''); setBusquedaProducto(''); }}
              className="rounded border-slate-600 bg-slate-800 text-violet-600" />
            <span className="text-slate-400 text-sm">Es un lote variado (productos o modelos distintos en un solo paquete consolidado — no corresponde a un único modelo del catálogo)</span>
          </label>
        </div>

        {esLoteVariado ? (
          <div className="col-span-2">
            <label className="block text-slate-400 text-sm mb-1.5">Descripción del lote <span className="text-danger">*</span></label>
            <input
              value={descripcionLote}
              onChange={e => setDescripcionLote(e.target.value)}
              placeholder="ej. Lote variado de laptops Dell/HP — modelos y especificaciones mixtas"
              className={inp} />
            <p className="text-slate-600 text-xs mt-1">No se vincula a un modelo del catálogo; al ingresar al inventario detallarás cada unidad por separado.</p>
          </div>
        ) : (
          <div className="col-span-2 relative">
            <label className="block text-slate-400 text-sm mb-1.5">Producto <span className="text-danger">*</span></label>
            <input
              value={productoSeleccionado ? `${productoSeleccionado.marca} ${productoSeleccionado.nombre}` : busquedaProducto}
              onChange={e => { setProductoId(''); setBusquedaProducto(e.target.value); setMostrarLista(true); }}
              onFocus={() => setMostrarLista(true)}
              onBlur={() => setTimeout(() => setMostrarLista(false), 150)}
              placeholder="Buscar modelo en el catálogo de productos..."
              className={inp} />
            {mostrarLista && sugeridos.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl max-h-56 overflow-y-auto shadow-xl">
                {sugeridos.map(p => (
                  <button type="button" key={p.id}
                    onMouseDown={() => { setProductoId(p.id); setBusquedaProducto(''); setMostrarLista(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-700/50 text-sm text-slate-200 transition-colors">
                    <span className="font-medium">{p.marca} {p.nombre}</span>
                    {p.categoria && <span className="text-slate-500 text-xs ml-2">{p.categoria}</span>}
                  </button>
                ))}
              </div>
            )}
            <p className="text-slate-600 text-xs mt-1">Selecciona un modelo del catálogo para vincular esta compra</p>
          </div>
        )}

        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Costo Total Compra (USD) <span className="text-danger">*</span></label>
          <input type="number" step="0.01" value={costoTotal} onChange={e => setCostoTotal(e.target.value)}
            placeholder="ej. 435.00" className={inp} />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Costo Envío Total (USD)</label>
          <input type="number" step="0.01" value={costoEnvio} onChange={e => setCostoEnvio(e.target.value)}
            placeholder="0.00" className={inp} />
        </div>

        <div className="col-span-2">
          <label className="block text-slate-400 text-sm mb-1.5">Costo unitario (auto)</label>
          <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-success text-sm font-mono">
            {costoUnitario > 0 ? `${fmt(costoUnitario)} / unidad` : '—'}
            {cantidadNum > 0 && <span className="text-slate-500 text-xs ml-2">({cantidadNum} ud{cantidadNum > 1 ? 's' : ''})</span>}
          </div>
        </div>
      </div>

      <p className="text-slate-500 text-xs">Cuando lleguen las unidades, podrás ingresarlas al inventario asignando número de serie y especificaciones desde "En Tránsito".</p>
      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 text-sm">Cancelar</button>
        <button type="submit" disabled={!vendedor || !tracking.trim() || !articuloValido || !cantidad || !costoTotal || loading}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Registrando...' : 'Registrar compra'}
        </button>
      </div>
    </form>
  );
}

// ─── Form: Triage — Ingresar al inventario ────────────────────────────────────

// Valores fijos: evita errores de captura sin sentido (ej. "laptop con 300GB de RAM")
const RAM_OPCIONES = [4, 8, 12, 16, 20, 24, 32, 64];
const ALMACENAMIENTO_OPCIONES: { valor: number; etiqueta: string }[] = [
  { valor: 128, etiqueta: '128 GB' },
  { valor: 256, etiqueta: '256 GB' },
  { valor: 512, etiqueta: '512 GB' },
  { valor: 1024, etiqueta: '1 TB' },
  { valor: 2048, etiqueta: '2 TB' },
];

interface UnidadForm {
  serie: string;
  marca: string;
  modelo: string;
  tipo: 'laptop' | 'telefono' | 'tablet' | 'otro';
  condicion: 'NUEVO' | 'SEMINUEVO';
  procesador: string;
  ram: string;
  almacenamiento: string;
  tipoAlmacenamiento: string;
  costoBase: string;
  precioVenta: string;
  // RN: cada unidad de un lote puede llegar en condiciones distintas — una puede
  // traer cargador y otra no, una puede llegar completa y otra sin disco — por
  // eso se evalúa por equipo y no de forma global para todo el lote.
  requiereCargador: boolean;
  llegoCompleta: boolean;
  detalleIncompleta: string;
}

function unidadVacia(marca: string, modelo: string, costoBase: string): UnidadForm {
  return {
    serie: '', marca, modelo, tipo: 'laptop', condicion: 'SEMINUEVO',
    procesador: '', ram: '', almacenamiento: '', tipoAlmacenamiento: 'SSD',
    costoBase, precioVenta: '',
    requiereCargador: true, llegoCompleta: true, detalleIncompleta: '',
  };
}

// Búsqueda rápida en el catálogo de productos para autocompletar marca/modelo
// de una unidad — útil sobre todo en lotes mixtos, donde cada equipo puede ser
// un modelo distinto y conviene tomar el nombre tal como está registrado.
function ProductoPicker({ productos, onSelect }: { productos: Producto[]; onSelect: (p: Producto) => void }) {
  const [busqueda, setBusqueda] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const sugeridos = busqueda.trim()
    ? productos.filter(p => `${p.marca} ${p.nombre}`.toLowerCase().includes(busqueda.trim().toLowerCase())).slice(0, 6)
    : productos.slice(0, 6);

  return (
    <div className="relative">
      <label className="block text-slate-400 text-xs mb-1.5">Buscar en catálogo (opcional — autocompleta marca y modelo)</label>
      <input
        value={busqueda}
        onChange={e => { setBusqueda(e.target.value); setMostrar(true); }}
        onFocus={() => setMostrar(true)}
        onBlur={() => setTimeout(() => setMostrar(false), 150)}
        placeholder="ej. Dell Latitude 5420..."
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
      {mostrar && sugeridos.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl max-h-48 overflow-y-auto shadow-xl">
          {sugeridos.map(p => (
            <button type="button" key={p.id}
              onMouseDown={() => { onSelect(p); setBusqueda(''); setMostrar(false); }}
              className="w-full text-left px-3 py-2 hover:bg-slate-700/50 text-sm text-slate-200 transition-colors">
              <span className="font-medium">{p.marca} {p.nombre}</span>
              {p.categoria && <span className="text-slate-500 text-xs ml-2">{p.categoria}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FormIngresar({ compra, onClose, onSuccess }: { compra: CompraPendiente; onClose: () => void; onSuccess: () => void }) {
  const [inversores, setInversores] = useState<Inversor[]>([]);
  const [inversorId, setInversorId] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [unidades, setUnidades] = useState<UnidadForm[]>([]);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esLote = compra.cantidad > 1;

  useEffect(() => {
    api.get<{ data: Inversor[] }>('/inversores').then(r => {
      setInversores(r.data.data);
      if (r.data.data[0]) setInversorId(r.data.data[0].id);
    });
    api.get<{ data: Producto[] }>('/productos', { params: { activo: true } }).then(r => setProductos(r.data.data));
    // Pre-fill marca/modelo from nombre_articulo y reparte el costo total entre las unidades
    // (el envío de un lote llega consolidado: un solo tracking/peso/ware para todas)
    const parts = compra.nombre_articulo.split(' ');
    const marcaBase = parts[0] ?? '';
    const modeloBase = parts.length > 1 ? parts.slice(1).join(' ') : '';
    const cantidad = Math.max(1, compra.cantidad || 1);
    const costoUnitario = (parseFloat(String(compra.precio_usd)) / cantidad).toFixed(2);
    setUnidades(Array.from({ length: cantidad }, () => unidadVacia(marcaBase, modeloBase, costoUnitario)));
  }, [compra.nombre_articulo, compra.cantidad, compra.precio_usd]);

  function actualizarUnidad(idx: number, cambios: Partial<UnidadForm>) {
    setUnidades(prev => prev.map((u, i) => (i === idx ? { ...u, ...cambios } : u)));
  }

  const unidadesValidas = unidades.length > 0 && unidades.every(u =>
    u.serie.trim() && u.marca.trim() && u.modelo.trim() && u.costoBase && u.precioVenta
    && (u.llegoCompleta || !!u.detalleIncompleta.trim())
  );
  const formValido = !!inversorId && unidadesValidas;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formValido) return;
    setError(null);
    setLoading(true);
    try {
      await api.post(`/inbox/${compra.id}/ingresar`, {
        inversor_id: inversorId,
        equipos: unidades.map(u => ({
          numero_serie: u.serie.trim(),
          marca: u.marca.trim(),
          modelo: u.modelo.trim(),
          tipo: u.tipo,
          condicion: u.condicion,
          procesador: u.procesador.trim() || null,
          ram_gb: u.ram ? parseInt(u.ram) : null,
          almacenamiento_gb: u.almacenamiento ? parseInt(u.almacenamiento) : null,
          tipo_almacenamiento: u.tipoAlmacenamiento || null,
          costo_base_usd: parseFloat(u.costoBase),
          precio_venta_sugerido_usd: parseFloat(u.precioVenta),
          requiere_cargador: u.requiereCargador,
          llego_completa: u.llegoCompleta,
          detalle_incompleta: u.llegoCompleta ? null : u.detalleIncompleta.trim(),
        })),
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
  const inpSm = "w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-slate-100 text-sm focus:outline-none focus:border-violet-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Info del artículo */}
      <div className="bg-slate-800/50 rounded-xl px-4 py-3 border border-app-border">
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Artículo a ingresar</p>
        <p className="text-slate-100 text-sm font-medium">{compra.nombre_articulo}</p>
        <p className="text-slate-500 text-xs">{fmt(compra.precio_usd)} pagado · {compra.vendedor_ebay ?? 'Manual'}</p>
        {esLote && (
          <p className="text-violet-300 text-xs mt-2 flex items-start gap-1.5 bg-violet-500/10 border border-violet-500/30 rounded-lg px-2.5 py-2">
            <Package size={14} className="shrink-0 mt-0.5" />
            <span>
              Envío consolidado de <strong>{compra.cantidad} unidades</strong> — un solo tracking, peso y costo logístico para todo el lote.
              Detalla cada unidad por separado abajo: cada una tiene su propio número de serie y puede traer especificaciones distintas (RAM, procesador, etc.) aunque sea el mismo modelo.
            </span>
          </p>
        )}
      </div>

      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Inversor <span className="text-danger">*</span></label>
        <select value={inversorId} onChange={e => setInversorId(e.target.value)} className={inp}>
          {inversores.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
      </div>

      {/* Unidades — una tarjeta por equipo individual */}
      <div className="space-y-3">
        {unidades.map((u, idx) => (
          <div key={idx} className="bg-slate-800/30 rounded-xl border border-app-border p-3 space-y-3">
            {esLote && (
              <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                Unidad {idx + 1} de {unidades.length}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Número de serie <span className="text-danger">*</span></label>
                <input value={u.serie} onChange={e => actualizarUnidad(idx, { serie: e.target.value })} placeholder="ej. 5CG1234XYZ" className={inpSm} />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Tipo</label>
                <select value={u.tipo} onChange={e => actualizarUnidad(idx, { tipo: e.target.value as UnidadForm['tipo'] })} className={inpSm}>
                  <option value="laptop">Laptop</option>
                  <option value="telefono">Teléfono</option>
                  <option value="tablet">Tablet</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="col-span-2">
                <ProductoPicker productos={productos} onSelect={p => actualizarUnidad(idx, { marca: p.marca, modelo: p.nombre })} />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Marca <span className="text-danger">*</span></label>
                <input value={u.marca} onChange={e => actualizarUnidad(idx, { marca: e.target.value })} placeholder="ej. Dell" className={inpSm} />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Modelo <span className="text-danger">*</span></label>
                <input value={u.modelo} onChange={e => actualizarUnidad(idx, { modelo: e.target.value })} placeholder="ej. Latitude 5420" className={inpSm} />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Condición</label>
                <select value={u.condicion} onChange={e => actualizarUnidad(idx, { condicion: e.target.value as UnidadForm['condicion'] })} className={inpSm}>
                  <option value="SEMINUEVO">Seminuevo</option>
                  <option value="NUEVO">Nuevo</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Procesador</label>
                <input value={u.procesador} onChange={e => actualizarUnidad(idx, { procesador: e.target.value })} placeholder="ej. Intel i5-11th Gen" className={inpSm} />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">RAM</label>
                <select value={u.ram} onChange={e => actualizarUnidad(idx, { ram: e.target.value })} className={inpSm}>
                  <option value="">— Sin especificar —</option>
                  {RAM_OPCIONES.map(v => <option key={v} value={v}>{v} GB</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Almacenamiento</label>
                <select value={u.almacenamiento} onChange={e => actualizarUnidad(idx, { almacenamiento: e.target.value })} className={inpSm}>
                  <option value="">— Sin especificar —</option>
                  {ALMACENAMIENTO_OPCIONES.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Tipo almacenamiento</label>
                <select value={u.tipoAlmacenamiento} onChange={e => actualizarUnidad(idx, { tipoAlmacenamiento: e.target.value })} className={inpSm}>
                  <option value="SSD">SSD</option>
                  <option value="HDD">HDD</option>
                  <option value="eMMC">eMMC</option>
                  <option value="NVMe">NVMe</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Costo base (USD) <span className="text-danger">*</span></label>
                <input type="number" step="0.01" value={u.costoBase} onChange={e => actualizarUnidad(idx, { costoBase: e.target.value })} className={inpSm} />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 text-xs mb-1.5">Precio venta sugerido (USD) <span className="text-danger">*</span></label>
                <input type="number" step="0.01" value={u.precioVenta} onChange={e => actualizarUnidad(idx, { precioVenta: e.target.value })} placeholder="ej. 350" className={inpSm} />
              </div>
            </div>

            {/* Cargador y estado de llegada — por unidad: una puede traer cargador y otra no,
                una puede llegar completa y otra sin disco, etc. */}
            <div className="pt-2 border-t border-app-border/60 space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={u.requiereCargador} onChange={e => actualizarUnidad(idx, { requiereCargador: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-800 text-violet-600" />
                <span className="text-slate-400 text-xs">Requiere cargador (se asignará desde inventario de accesorios)</span>
              </label>

              <div>
                <p className="text-slate-400 text-xs mb-1.5">¿Llegó completa y lista para la venta?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => actualizarUnidad(idx, { llegoCompleta: true })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      u.llegoCompleta ? 'bg-success/15 text-success border border-success/30' : 'text-slate-500 border border-app-border'
                    }`}>
                    Sí, completa
                  </button>
                  <button type="button" onClick={() => actualizarUnidad(idx, { llegoCompleta: false })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      !u.llegoCompleta ? 'bg-warning/15 text-warning border border-warning/30' : 'text-slate-500 border border-app-border'
                    }`}>
                    No, le falta algo / necesita reparación
                  </button>
                </div>
                {!u.llegoCompleta && (
                  <div className="mt-2">
                    <label className="block text-slate-400 text-xs mb-1.5">¿Qué le falta o qué necesita reparación? <span className="text-danger">*</span></label>
                    <textarea value={u.detalleIncompleta} onChange={e => actualizarUnidad(idx, { detalleIncompleta: e.target.value })} rows={2}
                      placeholder="ej. Vino sin disco duro, pantalla con manchas..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-xs resize-none focus:outline-none focus:border-violet-500" />
                    <p className="text-slate-600 text-xs mt-1">Esta unidad se enviará a Taller en lugar de pasar directo a disponible para venta.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {esLote && (
          <p className="text-slate-600 text-xs">
            Costo base pre-llenado repartiendo {fmt(compra.precio_usd)} entre {unidades.length} unidades — ajústalo si el costo real por unidad difiere.
          </p>
        )}
      </div>

      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Notas</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          placeholder="Condición física, detalles adicionales..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm resize-none focus:outline-none focus:border-violet-500" />
      </div>

      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 text-sm">Cancelar</button>
        <button type="submit" disabled={!formValido || loading}
          className="flex-1 py-2.5 rounded-xl bg-success hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading
            ? 'Procesando...'
            : esLote
              ? `Procesar lote (${unidades.length})`
              : (unidades[0]?.llegoCompleta ? 'Ingresar al inventario' : 'Enviar a Taller')}
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

// ─── Form: Logística — Recibido en Bodega Miami + tracking interno (warehouse track) ──
// La agencia recibe el equipo en su bodega de Miami y, en ese mismo momento, asigna
// su tracking interno para traerlo a Nicaragua. Ambos datos se capturan juntos:
// la compra pasa directo a "En Tránsito a Nicaragua".

function FormEnMiami({ compra, onClose, onSuccess }: { compra: CompraPendiente; onClose: () => void; onSuccess: () => void }) {
  const [tracking, setTracking] = useState('');
  const [peso, setPeso] = useState('');
  const [tipoEnvio, setTipoEnvio] = useState<'aereo' | 'maritimo'>('aereo');
  const [tarifas, setTarifas] = useState<{ aereo: number; maritimo: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: { clave: string; valor: string }[] }>('/settings').then(res => {
      const porClave = Object.fromEntries(res.data.data.map(s => [s.clave, parseFloat(s.valor)]));
      setTarifas({
        aereo: porClave['tarifa_libra_aerea_usd'] ?? 0,
        maritimo: porClave['tarifa_libra_maritima_usd'] ?? 0,
      });
    }).catch(() => {});
  }, []);

  const pesoNum = parseFloat(peso);
  const tarifaActual = tarifas?.[tipoEnvio] ?? 0;
  const costoLogistico = Number.isFinite(pesoNum) && pesoNum > 0 ? pesoNum * tarifaActual : null;
  const valido = tracking.trim() && Number.isFinite(pesoNum) && pesoNum > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    setError(null);
    setLoading(true);
    try {
      await api.post(`/inbox/${compra.id}/en-miami`, {
        tracking_interno: tracking.trim(),
        peso_real_libras: pesoNum,
        tipo_envio: tipoEnvio,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al registrar la recepción en Miami');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-slate-400 text-sm">
        Compra: <span className="text-slate-200 font-medium">{compra.nombre_articulo}</span>
      </p>
      <div className="bg-slate-800/50 rounded-xl px-4 py-3 border border-app-border">
        <p className="text-slate-300 text-sm">La agencia confirmó que recibió el equipo en su bodega de Miami.</p>
        <p className="text-slate-500 text-xs mt-1">Para continuar, registra el <span className="text-slate-300">tracking interno (warehouse track)</span>, el <span className="text-slate-300">peso</span> y el <span className="text-slate-300">tipo de envío</span>. El costo de envío a Nicaragua se calcula automáticamente (peso × tarifa configurada en Ajustes) y la compra pasará directo a "En Tránsito a Nicaragua".</p>
      </div>
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Tracking interno / warehouse track <span className="text-danger">*</span></label>
        <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="ej. WH-AG-00123"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        <p className="text-slate-600 text-xs mt-1">Obligatorio: es el tracking de la agencia que trae el equipo a Nicaragua (distinto del tracking original de la compra).</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Peso real (libras) <span className="text-danger">*</span></label>
          <input type="number" step="0.01" min="0" value={peso} onChange={e => setPeso(e.target.value)} placeholder="ej. 5.5"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Tipo de envío <span className="text-danger">*</span></label>
          <select value={tipoEnvio} onChange={e => setTipoEnvio(e.target.value as 'aereo' | 'maritimo')}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
            <option value="aereo">Aéreo {tarifas ? `($${tarifas.aereo.toFixed(2)}/lb)` : ''}</option>
            <option value="maritimo">Marítimo {tarifas ? `($${tarifas.maritimo.toFixed(2)}/lb)` : ''}</option>
          </select>
        </div>
      </div>
      {costoLogistico !== null && (
        <div className="bg-slate-800/50 rounded-xl px-4 py-3 border border-app-border flex items-center justify-between">
          <span className="text-slate-400 text-sm">Costo de envío a Nicaragua estimado</span>
          <span className="text-slate-100 text-sm font-semibold">${costoLogistico.toFixed(2)}</span>
        </div>
      )}
      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 text-sm">Cancelar</button>
        <button type="submit" disabled={!valido || loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Guardando...' : 'Confirmar recepción y enviar a tránsito'}
        </button>
      </div>
    </form>
  );
}

// ─── Tab: Equipos (Inbox) ─────────────────────────────────────────────────────

function TabEquipos() {
  const [compras, setCompras] = useState<CompraPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'transito' | 'historial'>('transito');
  const [busqueda, setBusqueda] = useState('');
  const [modalNueva, setModalNueva] = useState(false);
  const [ingresando, setIngresando] = useState<CompraPendiente | null>(null);
  const [descartando, setDescartando] = useState<CompraPendiente | null>(null);
  const [marcandoEnMiami, setMarcandoEnMiami] = useState<CompraPendiente | null>(null);

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

  const ESTADOS_ACTIVOS = ['pendiente', 'en_miami', 'en_transito_nicaragua', 'recibido'];
  const enTransito = compras.filter(c => ESTADOS_ACTIVOS.includes(c.estado));
  const historial = compras.filter(c => !ESTADOS_ACTIVOS.includes(c.estado));
  const alertas = enTransito.filter(c => c.alerta_stale).length;

  const [avanzando, setAvanzando] = useState<string | null>(null);
  async function marcarRecibido(id: string) {
    setAvanzando(id);
    try {
      await api.post(`/inbox/${id}/recibido`, {});
      await cargar();
    } finally {
      setAvanzando(null);
    }
  }

  const inversionFlotante = enTransito.reduce(
    (s, c) => s + parseFloat(String(c.precio_usd)) + parseFloat(String(c.costo_envio_usd ?? 0)),
    0
  );

  const base = vista === 'transito' ? enTransito : historial;
  const q = busqueda.trim().toLowerCase();
  const mostradas = q
    ? base.filter(c =>
        c.nombre_articulo.toLowerCase().includes(q) ||
        (c.vendedor_ebay ?? '').toLowerCase().includes(q) ||
        (c.tracking_number ?? '').toLowerCase().includes(q) ||
        ESTADO_LABEL[c.estado].toLowerCase().includes(q)
      )
    : base;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-app-surface border border-app-border rounded-card px-5 py-4 flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl shrink-0">
            <Package size={20} className="text-blue-400" />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider">Pedidos Activos</p>
            <p className="text-2xl font-bold text-slate-100 mt-0.5">{enTransito.length}</p>
            <p className="text-slate-500 text-xs mt-0.5">En proceso de importación</p>
          </div>
        </div>
        <div className="bg-app-surface border border-app-border rounded-card px-5 py-4 flex items-center gap-4">
          <div className="p-3 bg-warning/10 rounded-xl shrink-0">
            <DollarSign size={20} className="text-warning" />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider">Inversión Flotante (Riesgo)</p>
            <p className="text-2xl font-bold text-warning mt-0.5">{fmt(inversionFlotante)}</p>
            <p className="text-slate-500 text-xs mt-0.5">Dinero pendiente de llegar</p>
          </div>
        </div>
      </div>

      {alertas > 0 && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-xl px-3 py-1.5 w-fit">
          <AlertTriangle size={14} className="text-warning" />
          <span className="text-warning text-xs font-medium">{alertas} compra{alertas > 1 ? 's' : ''} sin triage &gt;5 días</span>
        </div>
      )}

      {/* Buscador + acciones */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por Tienda, Tracking o Estado..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={cargar} className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setModalNueva(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> Nueva Compra
          </button>
        </div>
      </div>

      {/* Tabs En Tránsito / Historial */}
      <div className="flex gap-2">
        <button onClick={() => setVista('transito')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            vista === 'transito'
              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
              : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}>
          <Plane size={14} /> En Tránsito
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300">{enTransito.length}</span>
        </button>
        <button onClick={() => setVista('historial')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            vista === 'historial'
              ? 'bg-success/15 text-success border border-success/30'
              : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}>
          <CheckCircle size={14} /> Historial
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm animate-pulse">Cargando compras...</div>
      ) : mostradas.length === 0 ? (
        <div className="py-12 text-center">
          <ShoppingCart size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {q ? 'Ningún resultado coincide con la búsqueda' : vista === 'transito' ? 'No hay pedidos en tránsito' : 'No hay historial todavía'}
          </p>
          {vista === 'transito' && !q && (
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
                    {c.cantidad > 1 && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-violet-500/10 text-violet-300 font-mono">x{c.cantidad}</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[c.estado]}`}>
                      {ESTADO_LABEL[c.estado]}
                    </span>
                    {c.fuente === 'GMAIL_EBAY' && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-400">eBay auto</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <p className="text-success text-sm font-semibold">{fmt(c.precio_usd)}</p>
                    {c.costo_envio_usd != null && parseFloat(String(c.costo_envio_usd)) > 0 && (
                      <p className="text-slate-500 text-xs">+ {fmt(c.costo_envio_usd)} envío</p>
                    )}
                    {c.vendedor_ebay && <p className="text-slate-500 text-xs">{c.vendedor_ebay}</p>}
                    {c.tracking_number && (
                      <p className="text-slate-600 text-xs font-mono">📦 {c.tracking_number}</p>
                    )}
                    {c.tracking_interno && (
                      <p className="text-slate-600 text-xs font-mono">🚚 {c.tracking_interno}</p>
                    )}
                    <div className="flex items-center gap-1 text-slate-600 text-xs">
                      <Clock size={11} />
                      {c.dias_en_inbox === 0 ? 'Hoy' : `Hace ${c.dias_en_inbox} día${c.dias_en_inbox > 1 ? 's' : ''}`}
                      {c.alerta_stale && <span className="text-warning ml-1">⚠ Sin avance</span>}
                    </div>
                  </div>
                </div>
                {c.url_ebay && (
                  <a href={c.url_ebay} target="_blank" rel="noreferrer"
                    className="text-xs text-violet-400 hover:underline shrink-0">Ver listing</a>
                )}
                <div className="flex gap-2 shrink-0">
                  {c.estado === 'pendiente' && (
                    <button onClick={() => setMarcandoEnMiami(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-semibold transition-colors">
                      <Plane size={13} /> Marcar en Bodega Miami
                    </button>
                  )}
                  {c.estado === 'en_transito_nicaragua' && (
                    <button onClick={() => marcarRecibido(c.id)} disabled={avanzando === c.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-warning/10 hover:bg-warning/20 text-warning text-xs font-semibold transition-colors disabled:opacity-40">
                      <CheckCircle size={13} /> {avanzando === c.id ? 'Marcando...' : 'Marcar Recibido en Nicaragua'}
                    </button>
                  )}
                  {c.estado === 'recibido' && (
                    <button onClick={() => setIngresando(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/10 hover:bg-success/20 text-success text-xs font-semibold transition-colors">
                      <CheckCircle size={13} /> Ingresar al inventario
                    </button>
                  )}
                  {ESTADOS_ACTIVOS.includes(c.estado) && (
                    <button onClick={() => setDescartando(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-danger/10 hover:bg-danger/20 text-danger text-xs font-semibold transition-colors">
                      <XCircle size={13} /> Descartar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={modalNueva} onClose={() => setModalNueva(false)} title="Registrar Compra eBay" maxWidth="max-w-2xl">
        <FormCompraEbay onClose={() => setModalNueva(false)} onSuccess={cargar} />
      </Modal>
      <Modal open={!!ingresando} onClose={() => setIngresando(null)} title="Ingresar al inventario" maxWidth="max-w-2xl">
        {ingresando && <FormIngresar compra={ingresando} onClose={() => setIngresando(null)} onSuccess={cargar} />}
      </Modal>
      <Modal open={!!descartando} onClose={() => setDescartando(null)} title="Descartar compra">
        {descartando && <FormDescartar compra={descartando} onClose={() => setDescartando(null)} onSuccess={cargar} />}
      </Modal>
      <Modal open={!!marcandoEnMiami} onClose={() => setMarcandoEnMiami(null)} title="Recibido en Bodega Miami">
        {marcandoEnMiami && <FormEnMiami compra={marcandoEnMiami} onClose={() => setMarcandoEnMiami(null)} onSuccess={cargar} />}
      </Modal>
    </div>
  );
}

// ─── Tab: Equipos en Preparación (ciclo de vida del equipo hasta Disponible) ──

const ESTADOS_PREPARACION: EquipoRow['estado'][] = ['COMPRADO', 'EN_BODEGA_MIAMI', 'EN_TRANSITO', 'EN_TALLER'];

// Próximo estado "natural" en el camino hacia Disponible (para la etiqueta del botón)
const TRANSICIONES_PREP: Partial<Record<EquipoRow['estado'], EquipoRow['estado']>> = {
  COMPRADO: 'EN_BODEGA_MIAMI',
  EN_BODEGA_MIAMI: 'EN_TRANSITO',
  EN_TRANSITO: 'EN_TALLER',
  EN_TALLER: 'DISPONIBLE',
};

function TabPreparacionEquipos() {
  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionado, setSeleccionado] = useState<EquipoRow | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '50', estados: ESTADOS_PREPARACION.join(',') });
      const res = await api.get<{ items: EquipoRow[] }>(`/equipos?${params}`);
      setEquipos(res.data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">
          Equipos ya ingresados que aún no están listos para vender — avanza su estado paso a paso hasta <span className="text-violet-400 font-medium">Disponible</span>.
        </p>
        <button onClick={cargar} className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm animate-pulse">Cargando equipos...</div>
      ) : equipos.length === 0 ? (
        <div className="py-12 text-center">
          <Wrench size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No hay equipos en preparación — todo lo ingresado ya está disponible o vendido.</p>
        </div>
      ) : (
        <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
          <div className="divide-y divide-app-border">
            {equipos.map(eq => (
              <div key={eq.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-800/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-slate-100 text-sm font-medium">{eq.marca} {eq.modelo}</p>
                    <span className="font-mono text-slate-500 text-xs">{eq.numero_serie}</span>
                    <EstadoBadge estado={eq.estado} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <p className="text-slate-400 text-xs">CTR: <span className="font-mono text-slate-200">{fmt(eq.ctr_usd)}</span></p>
                    <p className="text-slate-400 text-xs">P. Sugerido: <span className="font-mono text-success">{fmt(eq.precio_venta_sugerido_usd)}</span></p>
                    <p className="text-slate-500 text-xs">Inversor: {eq.inversor.nombre}</p>
                  </div>
                </div>
                <button onClick={() => setSeleccionado(eq)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 text-xs font-semibold transition-colors border border-violet-600/30 shrink-0">
                  <Wrench size={13} /> Avanzar a {ESTADO_LABELS[(TRANSICIONES_PREP[eq.estado] ?? eq.estado)]}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={!!seleccionado}
        onClose={() => setSeleccionado(null)}
        title={seleccionado ? `${seleccionado.marca} ${seleccionado.modelo} · ${seleccionado.numero_serie}` : ''}
      >
        {seleccionado && (
          <ModalCambioEstado
            equipo={seleccionado}
            onClose={() => setSeleccionado(null)}
            onSuccess={cargar}
          />
        )}
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
  const [fechaCompra, setFechaCompra] = useState(hoyNI());
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
  const [tab, setTab] = useState<'equipos' | 'preparacion' | 'accesorios'>('equipos');

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Compras e Importaciones</h1>
        <p className="text-slate-500 text-sm mt-0.5">Gestión de inbound y rastreo de pedidos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-app-border">
        {([
          { key: 'equipos', label: 'Equipos' },
          { key: 'preparacion', label: 'Equipos en Preparación' },
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

      {tab === 'equipos' ? <TabEquipos /> : tab === 'preparacion' ? <TabPreparacionEquipos /> : <TabAccesorios />}
    </div>
  );
}
