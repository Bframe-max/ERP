import { useEffect, useState, useCallback } from 'react';
import { Plus, RefreshCw, ChevronLeft, ChevronRight, Search, Eye, CheckCircle, Wallet, Banknote, User, Phone, IdCard } from 'lucide-react';
import api from '@/lib/api';
import { Modal } from '@/components/Modal';
import { TIMEZONE_NI } from '@/lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EquipoDisponible {
  id: string;
  marca: string;
  modelo: string;
  numero_serie: string;
  ctr_usd: number | string;
  precio_venta_sugerido_usd: number | string;
  condicion: string;
}

interface ClienteItem {
  id: string;
  nombre: string;
  telefono: string;
  cedula: string | null;
}

interface VentaRow {
  id: string;
  numero_factura: string;
  fecha_venta: string;
  precio_venta_usd: number | string;
  ctr_al_momento_usd: number | string;
  ganancia_bruta_venta_usd: number | string;
  pf_monto_opex_usd: number | string;
  pf_monto_garantias_usd: number | string;
  pf_monto_ganancia_usd: number | string;
  pf_monto_reparto_usd: number | string;
  reparto_liquidado: boolean;
  equipo: { marca: string; modelo: string; numero_serie: string };
  cliente: ClienteItem;
  vendedor: { nombre: string };
}

interface Meta { total: number; page: number; limit: number; pages: number; }

function fmt(n: number | string) {
  return `$${parseFloat(String(n)).toFixed(2)}`;
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TIMEZONE_NI });
}

// ─── Modal Checkout ───────────────────────────────────────────────────────────

export function CheckoutModal({ onClose, onSuccess, equipoInicial }: { onClose: () => void; onSuccess: () => void; equipoInicial?: EquipoDisponible }) {
  const [step, setStep] = useState<'equipo' | 'cliente' | 'pago'>(equipoInicial ? 'cliente' : 'equipo');
  const [equipos, setEquipos] = useState<EquipoDisponible[]>([]);
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [busqCliente, setBusqCliente] = useState('');
  const [equipoSel, setEquipoSel] = useState<EquipoDisponible | null>(equipoInicial ?? null);
  const [clienteSel, setClienteSel] = useState<ClienteItem | null>(null);
  const [precio, setPrecio] = useState(equipoInicial ? String(parseFloat(String(equipoInicial.precio_venta_sugerido_usd)).toFixed(2)) : '');
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'TRANSFERENCIA_BAC' | 'USDT'>('EFECTIVO');
  const [moneda, setMoneda] = useState<'USD' | 'NIO' | 'MIXTO'>('USD');
  const [referencia, setReferencia] = useState('');
  const [evidenciaUrl, setEvidenciaUrl] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (equipoInicial) return;
    api.get<{ data: EquipoDisponible[] }>('/equipos/disponibles').then(r => setEquipos(r.data.data));
  }, [equipoInicial]);

  useEffect(() => {
    const q = busqCliente.trim();
    if (q.length < 2) { setClientes([]); return; }
    api.get<{ items: ClienteItem[] }>(`/clientes?q=${encodeURIComponent(q)}`).then(r => setClientes(r.data.items));
  }, [busqCliente]);

  const ctr = equipoSel ? parseFloat(String(equipoSel.ctr_usd)) : 0;
  const precioNum = parseFloat(precio) || 0;
  const ganancia = precioNum - ctr;
  const margen = ctr > 0 ? (ganancia / ctr) * 100 : 0;
  const margenBajo = precioNum > 0 && margen < 20;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!equipoSel || !clienteSel || !precio || !evidenciaUrl) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/ventas', {
        equipo_id: equipoSel.id,
        cliente_id: clienteSel.id,
        precio_venta_usd: precioNum,
        metodo_pago: metodoPago,
        moneda_cobro: moneda,
        referencia_pago: referencia || undefined,
        evidencia_entrega_url: evidenciaUrl,
        justificacion_precio: justificacion || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Error al registrar venta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {(['equipo', 'cliente', 'pago'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px bg-slate-700" />}
            <button type="button" onClick={() => setStep(s)}
              className={`px-3 py-1 rounded-full font-medium transition-colors ${step === s ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          </div>
        ))}
      </div>

      {/* Step 1 — Equipo */}
      {step === 'equipo' && (
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">Selecciona el equipo a vender</p>
          {equipos.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No hay equipos disponibles</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {equipos.map(eq => (
                <button key={eq.id} type="button"
                  onClick={() => { setEquipoSel(eq); setPrecio(String(parseFloat(String(eq.precio_venta_sugerido_usd)).toFixed(2))); setStep('cliente'); }}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${equipoSel?.id === eq.id ? 'border-violet-500 bg-violet-600/10' : 'border-app-border hover:border-slate-600 bg-slate-800/30'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-100 text-sm font-medium">{eq.marca} {eq.modelo}</p>
                      <p className="text-slate-500 text-xs font-mono">{eq.numero_serie} · {eq.condicion}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-success text-sm font-semibold">{fmt(eq.precio_venta_sugerido_usd)}</p>
                      <p className="text-slate-500 text-xs">CTR: {fmt(eq.ctr_usd)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Cliente */}
      {step === 'cliente' && (
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">Busca o selecciona el cliente</p>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={busqCliente} onChange={e => setBusqCliente(e.target.value)}
              placeholder="Nombre, teléfono o cédula..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
          </div>
          {clientes.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {clientes.map(c => (
                <button key={c.id} type="button"
                  onClick={() => { setClienteSel(c); setStep('pago'); }}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${clienteSel?.id === c.id ? 'border-violet-500 bg-violet-600/10' : 'border-app-border hover:border-slate-600 bg-slate-800/30'}`}>
                  <p className="text-slate-100 text-sm font-medium">{c.nombre}</p>
                  <p className="text-slate-500 text-xs">{c.telefono}{c.cedula ? ` · CI: ${c.cedula}` : ''}</p>
                </button>
              ))}
            </div>
          )}
          {clienteSel && (
            <div className="p-3 bg-violet-600/10 border border-violet-500/30 rounded-xl">
              <p className="text-violet-300 text-sm font-medium">{clienteSel.nombre}</p>
              <p className="text-violet-400/70 text-xs">{clienteSel.telefono}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Pago */}
      {step === 'pago' && (
        <div className="space-y-4">
          {/* Resumen */}
          {equipoSel && (
            <div className="p-3 bg-slate-800/50 rounded-xl text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-400">Equipo</span><span className="text-slate-100">{equipoSel.marca} {equipoSel.modelo}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Cliente</span><span className="text-slate-100">{clienteSel?.nombre}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">CTR</span><span className="font-mono text-slate-300">{fmt(equipoSel.ctr_usd)}</span></div>
            </div>
          )}

          {/* Precio */}
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">Precio de venta (USD) <span className="text-danger">*</span></label>
            <input type="number" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
            {precioNum > 0 && (
              <div className={`mt-1.5 text-xs ${margenBajo ? 'text-warning' : 'text-success'}`}>
                Ganancia: {fmt(ganancia)} ({margen.toFixed(1)}% margen){margenBajo && ' ⚠️ Margen bajo'}
              </div>
            )}
          </div>

          {margenBajo && (
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">Justificación de precio bajo <span className="text-danger">*</span></label>
              <input value={justificacion} onChange={e => setJustificacion(e.target.value)}
                placeholder="ej. Cliente preferencial, lote negociado..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
            </div>
          )}

          {/* Método de pago */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">Método de pago</label>
              <select value={metodoPago} onChange={e => setMetodoPago(e.target.value as typeof metodoPago)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA_BAC">Transferencia BAC</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value as typeof moneda)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
                <option value="USD">USD</option>
                <option value="NIO">NIO</option>
                <option value="MIXTO">Mixto</option>
              </select>
            </div>
          </div>

          {metodoPago !== 'EFECTIVO' && (
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">Referencia de pago</label>
              <input value={referencia} onChange={e => setReferencia(e.target.value)}
                placeholder="Número de transferencia..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
            </div>
          )}

          {/* Evidencia */}
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">URL evidencia de entrega <span className="text-danger">*</span></label>
            <input type="url" value={evidenciaUrl} onChange={e => setEvidenciaUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
            <p className="text-slate-500 text-xs mt-1">Foto del cliente con el equipo (Google Drive, etc.)</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>
      )}

      {/* Navegación */}
      <div className="flex gap-3 pt-1">
        {step !== 'equipo' && !(equipoInicial && step === 'cliente') && (
          <button type="button"
            onClick={() => setStep(step === 'pago' ? 'cliente' : 'equipo')}
            className="px-4 py-2.5 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 text-sm transition-colors">
            ← Atrás
          </button>
        )}
        {step !== 'pago' ? (
          <button type="button"
            disabled={step === 'equipo' ? !equipoSel : !clienteSel}
            onClick={() => setStep(step === 'equipo' ? 'cliente' : 'pago')}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
            Siguiente →
          </button>
        ) : (
          <button type="submit"
            disabled={!equipoSel || !clienteSel || !precio || !evidenciaUrl || loading || (margenBajo && !justificacion)}
            className="flex-1 py-2.5 rounded-xl bg-success/20 hover:bg-success/30 border border-success/50 text-success text-sm font-semibold transition-colors disabled:opacity-40">
            {loading ? 'Registrando...' : `✓ Registrar venta ${precioNum > 0 ? fmt(precioNum) : ''}`}
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Modal Detalle Venta ──────────────────────────────────────────────────────

export function DetalleVentaModal({ venta, onClose, onLiquidar }: { venta: VentaRow; onClose: () => void; onLiquidar: () => void }) {
  const [loading, setLoading] = useState(false);

  async function liquidar() {
    if (!confirm('¿Estás seguro de marcar esta venta como liquidada? Se asume que el dinero físico ya fue entregado.')) return;
    setLoading(true);
    try {
      await api.patch(`/ventas/${venta.id}/liquidar`);
      onLiquidar();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al liquidar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Información General */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/40 p-4 rounded-xl border border-app-border">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1"><User size={14} /> Cliente</p>
          <p className="text-slate-100 font-medium">{venta.cliente.nombre}</p>
          <p className="text-slate-400 text-sm flex items-center gap-1 mt-1"><Phone size={12} /> {venta.cliente.telefono}</p>
          {venta.cliente.cedula && <p className="text-slate-400 text-sm flex items-center gap-1 mt-1"><IdCard size={12} /> {venta.cliente.cedula}</p>}
        </div>
        <div className="bg-slate-800/40 p-4 rounded-xl border border-app-border">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Equipo Vendido</p>
          <p className="text-slate-100 font-medium">{venta.equipo.marca} {venta.equipo.modelo}</p>
          <p className="text-slate-400 text-sm font-mono mt-1">S/N: {venta.equipo.numero_serie}</p>
        </div>
      </div>

      {/* Matemática de Venta */}
      <div className="bg-slate-800/40 rounded-xl border border-app-border overflow-hidden">
        <div className="p-3 bg-slate-800/80 border-b border-app-border">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Matemática de Venta</p>
        </div>
        <div className="p-4 space-y-2 text-sm">
          <div className="flex justify-between items-center text-slate-100">
            <span>Precio de Venta</span>
            <span className="font-mono font-medium">{fmt(venta.precio_venta_usd)}</span>
          </div>
          <div className="flex justify-between items-center text-danger">
            <span>Menos (-) Capital Retornado (CTR)</span>
            <span className="font-mono font-medium">-{fmt(venta.ctr_al_momento_usd)}</span>
          </div>
          <div className="pt-2 border-t border-app-border/50 flex justify-between items-center text-success font-semibold text-base">
            <span>Ganancia Bruta</span>
            <span className="font-mono">{fmt(venta.ganancia_bruta_venta_usd)}</span>
          </div>
        </div>
      </div>

      {/* Distribución Profit First */}
      <div className="bg-slate-800/40 rounded-xl border border-app-border overflow-hidden">
        <div className="p-3 bg-slate-800/80 border-b border-app-border">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Distribución Profit First</p>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-2"><Banknote size={14} className="text-blue-400" /> Fondo OPEX</span>
            <span className="font-mono font-medium">{fmt(venta.pf_monto_opex_usd)}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-2"><RefreshCw size={14} className="text-amber-400" /> Fondo Reinversión</span>
            <span className="font-mono font-medium">{fmt(venta.pf_monto_garantias_usd)}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-2"><Wallet size={14} className="text-emerald-400" /> Ganancia Neta Zeltek</span>
            <span className="font-mono font-medium">{fmt(venta.pf_monto_ganancia_usd)}</span>
          </div>
          
          {parseFloat(String(venta.pf_monto_reparto_usd)) > 0 && (
            <div className="pt-3 border-t border-app-border/50 flex justify-between items-center text-indigo-300">
              <span className="flex items-center gap-2"><User size={14} /> Reparto Socio(s)</span>
              <span className="font-mono font-semibold">{fmt(venta.pf_monto_reparto_usd)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Acción Liquidar */}
      {venta.reparto_liquidado ? (
        <div className="bg-success/10 border border-success/30 text-success p-4 rounded-xl flex items-center justify-center gap-2 font-medium">
          <CheckCircle size={18} />
          Fondos Liquidados (Dinero físico separado)
        </div>
      ) : (
        <button 
          onClick={liquidar}
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? 'Liquidando...' : 'Apartar Fondos / Liquidar Reparto'}
        </button>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function VentasPage() {
  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showCheckout, setShowCheckout] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<VentaRow | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: VentaRow[]; meta: Meta }>(`/ventas?page=${page}&limit=20`);
      setVentas(res.data.items);
      setMeta(res.data.meta);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Ventas</h1>
          <p className="text-slate-500 text-sm mt-0.5">{meta.total} ventas registradas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowCheckout(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} />
            Nueva venta
          </button>
        </div>
      </div>

      <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando...</div>
        ) : ventas.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-500 text-sm">No hay ventas registradas</p>
            <button onClick={() => setShowCheckout(true)}
              className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-xl transition-colors">
              Registrar primera venta
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-app-border">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Factura</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Equipo</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Cliente</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider hidden lg:table-cell">Fecha</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Precio</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Ganancia</th>
                  <th className="text-center px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider hidden lg:table-cell">Reparto</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {ventas.map(v => (
                  <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-slate-100 font-mono text-xs">{v.numero_factura}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-100 text-sm">{v.equipo.marca} {v.equipo.modelo}</p>
                      <p className="text-slate-500 text-xs font-mono">{v.equipo.numero_serie}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-slate-300 text-sm">{v.cliente.nombre}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-slate-400 text-xs">{fmtFecha(v.fecha_venta)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-slate-100 text-sm font-semibold">{fmt(v.precio_venta_usd)}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="font-mono text-success text-sm">+{fmt(v.ganancia_bruta_venta_usd)}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v.reparto_liquidado ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        {v.reparto_liquidado ? 'Liquidado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => setVentaSeleccionada(v)}
                        className="p-1.5 text-slate-400 hover:text-violet-400 hover:bg-violet-400/10 rounded-lg transition-colors"
                        title="Ver detalle"
                      >
                        <Eye size={16} />
                      </button>
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
          <span className="text-slate-500 text-sm">Página {page} de {meta.pages}</span>
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

      <Modal open={showCheckout} onClose={() => setShowCheckout(false)} title="Nueva Venta" maxWidth="max-w-xl">
        <CheckoutModal onClose={() => setShowCheckout(false)} onSuccess={cargar} />
      </Modal>

      <Modal open={!!ventaSeleccionada} onClose={() => setVentaSeleccionada(null)} title={`Desglose: ${ventaSeleccionada?.numero_factura}`} maxWidth="max-w-2xl">
        {ventaSeleccionada && (
          <DetalleVentaModal 
            venta={ventaSeleccionada} 
            onClose={() => setVentaSeleccionada(null)} 
            onLiquidar={() => {
              setVentaSeleccionada(null);
              cargar();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
