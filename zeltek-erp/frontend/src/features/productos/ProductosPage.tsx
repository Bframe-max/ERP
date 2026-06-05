import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, RefreshCw, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '@/lib/api';
import { Modal } from '@/components/Modal';

interface Producto {
  id: string;
  nombre: string;
  marca: string;
  tipo: 'laptop' | 'telefono' | 'tablet' | 'otro';
  categoria: string | null;
  precio_venta_sugerido_usd: number | null;
  activo: boolean;
  notas: string | null;
  especificaciones_default: Record<string, unknown> | null;
}

const TIPOS = ['laptop', 'telefono', 'tablet', 'otro'] as const;
const MARCAS_COMUNES = ['Dell', 'HP', 'Lenovo', 'Apple', 'ASUS', 'Acer', 'Microsoft', 'Samsung', 'Otro'];

function fmt(n: number | string | null) {
  if (n === null || n === undefined) return '—';
  return `$${parseFloat(String(n)).toFixed(0)}`;
}

// ─── Formulario crear/editar ──────────────────────────────────────────────────

function FormProducto({
  inicial,
  onClose,
  onSuccess,
}: {
  inicial?: Producto;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [marca, setMarca] = useState(inicial?.marca ?? 'Dell');
  const [marcaCustom, setMarcaCustom] = useState(!MARCAS_COMUNES.includes(inicial?.marca ?? 'Dell') ? inicial?.marca ?? '' : '');
  const [tipo, setTipo] = useState<typeof TIPOS[number]>(inicial?.tipo ?? 'laptop');
  const [categoria, setCategoria] = useState(inicial?.categoria ?? '');
  const [precio, setPrecio] = useState(inicial?.precio_venta_sugerido_usd ? String(inicial.precio_venta_sugerido_usd) : '');
  const [notas, setNotas] = useState(inicial?.notas ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marcaFinal = marca === 'Otro' ? marcaCustom : marca;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre || !marcaFinal) return;
    setError(null);
    setLoading(true);
    try {
      const body = {
        nombre,
        marca: marcaFinal,
        tipo,
        categoria: categoria || null,
        precio_venta_sugerido_usd: precio ? parseFloat(precio) : null,
        notas: notas || null,
      };
      if (inicial) {
        await api.patch(`/productos/${inicial.id}`, body);
      } else {
        await api.post('/productos', body);
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
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-slate-400 text-sm mb-1.5">Nombre del modelo <span className="text-danger">*</span></label>
          <input value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="ej. Latitude 5420 i5-11th 8GB 256GB"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Marca <span className="text-danger">*</span></label>
          <select value={marca} onChange={e => setMarca(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
            {MARCAS_COMUNES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {marca === 'Otro' && (
            <input value={marcaCustom} onChange={e => setMarcaCustom(e.target.value)}
              placeholder="Nombre de la marca"
              className="mt-2 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
          )}
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as typeof TIPOS[number])}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
            {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Categoría</label>
          <input value={categoria} onChange={e => setCategoria(e.target.value)}
            placeholder="ej. Business, Gaming, Ultrabook"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Precio sugerido (USD)</label>
          <input type="number" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)}
            placeholder="ej. 350"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>

        <div className="col-span-2">
          <label className="block text-slate-400 text-sm mb-1.5">Notas</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            placeholder="Notas internas sobre este modelo..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm resize-none focus:outline-none focus:border-violet-500" />
        </div>
      </div>

      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 text-sm">
          Cancelar
        </button>
        <button type="submit" disabled={!nombre || !marcaFinal || loading}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {loading ? 'Guardando...' : inicial ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </form>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloActivos, setSoloActivos] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set('busqueda', busqueda);
      params.set('activo', String(soloActivos));
      const res = await api.get<{ data: Producto[] }>(`/productos?${params}`);
      setProductos(res.data.data);
    } finally {
      setLoading(false);
    }
  }, [busqueda, soloActivos]);

  useEffect(() => { cargar(); }, [cargar]);

  async function toggleActivo(p: Producto) {
    try {
      await api.patch(`/productos/${p.id}`, { activo: !p.activo });
      cargar();
    } catch { /* ignore */ }
  }

  const porMarca = productos.reduce<Record<string, Producto[]>>((acc, p) => {
    (acc[p.marca] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Catálogo de Productos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{productos.length} modelos registrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setEditando(null); setModalAbierto(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} /> Nuevo modelo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por marca, nombre, categoría..."
            className="w-full bg-app-surface border border-app-border rounded-xl pl-9 pr-4 py-2.5 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500" />
        </div>
        <button onClick={() => setSoloActivos(v => !v)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors ${soloActivos ? 'border-violet-500/50 text-violet-400 bg-violet-600/10' : 'border-app-border text-slate-400'}`}>
          {soloActivos ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          Solo activos
        </button>
      </div>

      {/* Lista agrupada por marca */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando...</div>
      ) : productos.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-slate-500 text-sm">No hay productos en el catálogo</p>
          <button onClick={() => setModalAbierto(true)}
            className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-xl">
            Agregar primer modelo
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(porMarca).map(([marca, items]) => (
            <div key={marca}>
              <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 px-1">{marca}</h2>
              <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
                <div className="divide-y divide-app-border">
                  {items.map(p => (
                    <div key={p.id} className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-800/30 transition-colors ${!p.activo ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-slate-100 text-sm font-medium truncate">{p.nombre}</p>
                          {p.categoria && (
                            <span className="shrink-0 px-2 py-0.5 bg-slate-800 rounded-full text-slate-400 text-xs">{p.categoria}</span>
                          )}
                          <span className="shrink-0 px-2 py-0.5 bg-slate-800 rounded-full text-slate-500 text-xs capitalize">{p.tipo}</span>
                        </div>
                        {p.notas && <p className="text-slate-500 text-xs mt-0.5 truncate">{p.notas}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-success text-sm font-semibold">{fmt(p.precio_venta_sugerido_usd)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setEditando(p); setModalAbierto(true); }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-100 hover:bg-slate-800 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => toggleActivo(p)}
                          className={`p-1.5 rounded-lg transition-colors ${p.activo ? 'text-success hover:bg-success/10' : 'text-slate-600 hover:bg-slate-800'}`}
                          title={p.activo ? 'Desactivar' : 'Activar'}>
                          {p.activo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)}
        title={editando ? `Editar — ${editando.nombre}` : 'Nuevo modelo'}>
        <FormProducto
          inicial={editando ?? undefined}
          onClose={() => setModalAbierto(false)}
          onSuccess={cargar}
        />
      </Modal>
    </div>
  );
}
