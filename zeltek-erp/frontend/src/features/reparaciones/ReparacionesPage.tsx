import { useEffect, useState, useCallback } from 'react';
import { Plus, RefreshCw, ChevronLeft, ChevronRight, Edit, ShieldCheck, Wrench, Cpu } from 'lucide-react';
import { reparacionesService, Reparacion, CrearReparacionDTO } from './reparacionesService';
import { ModalCambioEstado, type EquipoRow } from '@/features/inventario/InventarioPage';
import { Modal } from '@/components/Modal';
import api from '@/lib/api';
import { TIMEZONE_NI } from '@/lib/utils';

function fmtFecha(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TIMEZONE_NI });
}

// ─── Equipos internos enviados a taller (EN_TALLER) ──────────────────────────
// Distinto de las órdenes de reparación de clientes: estos son equipos propios
// del inventario (enviados desde Compras o Inventario) en proceso de reparación
// antes de quedar DISPONIBLE para la venta.

// Última vez que el equipo entró a EN_TALLER — alimenta "Problema reportado" / "Fecha ingreso"
function ingresoTaller(eq: EquipoRow) {
  const entrada = eq.historial_estados?.find(h => h.estado_nuevo === 'EN_TALLER');
  return { problema: entrada?.notas ?? '—', fecha: entrada?.created_at ?? null };
}

function diasEnTaller(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// Umbral de alerta por tiempo en taller — RN informal: >7 días es demora notable, 3-7 días a vigilar
function BadgeDiasTaller({ dias }: { dias: number | null }) {
  if (dias == null) return <span className="text-slate-500 text-xs">—</span>;

  const estilo = dias >= 7
    ? 'bg-danger/10 text-danger border-danger/30'
    : dias >= 3
      ? 'bg-warning/10 text-warning border-warning/30'
      : 'bg-slate-800 text-slate-400 border-slate-700';

  const etiqueta = dias === 0 ? 'Hoy' : dias === 1 ? '1 día' : `${dias} días`;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${estilo}`}>
      {dias >= 7 && '⚠️ '}{etiqueta}
    </span>
  );
}

function EquiposEnTallerList() {
  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<EquipoRow | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: EquipoRow[] }>('/equipos?estados=EN_TALLER&limit=100');
      setEquipos(res.data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <>
      <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando...</div>
        ) : equipos.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">No hay equipos en taller actualmente</div>
        ) : (
          <>
            {/* Tarjetas — Mobile (< md): la tabla completa no entra cómodamente en pantallas angostas */}
            <div className="md:hidden divide-y divide-app-border">
              {equipos.map(eq => {
                const { problema, fecha } = ingresoTaller(eq);
                const dias = diasEnTaller(fecha);
                return (
                  <div key={eq.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-slate-100 font-medium truncate">{eq.marca} {eq.modelo}</p>
                        <p className="text-slate-500 text-xs">
                          {eq.condicion === 'NUEVO' ? 'Nuevo' : 'Seminuevo'} · <span className="font-mono">{eq.numero_serie}</span>
                        </p>
                      </div>
                      <BadgeDiasTaller dias={dias} />
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="text-slate-500">Problema: <span className="text-slate-300">{problema}</span></p>
                      <p className="text-slate-500">Ingreso: <span className="text-slate-300">{fmtFecha(fecha)}</span></p>
                    </div>
                    <button
                      onClick={() => setEquipoSeleccionado(eq)}
                      className="w-full py-2 rounded-lg bg-success/10 hover:bg-success/20 text-success text-xs font-semibold transition-colors border border-success/30"
                    >
                      ✓ Marcar reparado
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Tabla — Desktop (md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-app-border bg-slate-800/50">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Producto</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Serie / ID</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Problema reportado</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Fecha ingreso</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Tiempo en taller</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {equipos.map(eq => {
                    const { problema, fecha } = ingresoTaller(eq);
                    const dias = diasEnTaller(fecha);
                    return (
                      <tr key={eq.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-slate-100 font-medium">{eq.marca} {eq.modelo}</p>
                            <p className="text-slate-500 text-xs">{eq.condicion === 'NUEVO' ? 'Nuevo' : 'Seminuevo'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-slate-400 text-xs">{eq.numero_serie}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-400 text-xs truncate max-w-[220px] block">{problema}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-400 text-xs">{fmtFecha(fecha)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <BadgeDiasTaller dias={dias} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setEquipoSeleccionado(eq)}
                            className="px-3 py-1.5 rounded-lg bg-success/10 hover:bg-success/20 text-success text-xs font-semibold transition-colors border border-success/30"
                          >
                            ✓ Marcar reparado
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Modal open={!!equipoSeleccionado} onClose={() => setEquipoSeleccionado(null)} title={equipoSeleccionado ? `${equipoSeleccionado.marca} ${equipoSeleccionado.modelo}` : ''}>
        {equipoSeleccionado && (
          <ModalCambioEstado
            equipo={equipoSeleccionado}
            onClose={() => setEquipoSeleccionado(null)}
            onSuccess={cargar}
          />
        )}
      </Modal>
    </>
  );
}

// ─── Modal Crear Reparación/Garantía ─────────────────────────────────────────

function ReparacionForm({ 
  tipo, 
  onClose, 
  onSuccess 
}: { 
  tipo: 'externa' | 'garantia'; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const [clientes, setClientes] = useState<{id: string, nombre: string, telefono: string}[]>([]);
  const [ventas, setVentas] = useState<{id: string, numero_factura: string, equipo: {marca: string, modelo: string, numero_serie: string}}[]>([]);
  
  const [clienteId, setClienteId] = useState('');
  const [ventaId, setVentaId] = useState('');
  const [equipoDesc, setEquipoDesc] = useState('');
  const [serieExterno, setSerieExterno] = useState('');
  const [falla, setFalla] = useState('');
  const [notas, setNotas] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Cargar clientes para el select (idealmente sería un autocompletado, pero para simplificar usamos los últimos o todos si no son muchos)
    api.get('/clientes?limit=100').then(r => setClientes(r.data.items || []));
    if (tipo === 'garantia') {
      // Cargar ventas recientes para seleccionar
      api.get('/ventas?limit=100').then(r => setVentas(r.data.items || []));
    }
  }, [tipo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data: CrearReparacionDTO = {
        cliente_id: clienteId,
        tipo,
        venta_id: tipo === 'garantia' ? ventaId : undefined,
        equipo_descripcion: equipoDesc,
        numero_serie_externo: serieExterno || undefined,
        falla_reportada: falla,
        notas: notas || undefined,
      };
      await reparacionesService.create(data);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al crear la orden');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Cliente <span className="text-danger">*</span></label>
        <select required value={clienteId} onChange={e => setClienteId(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
          <option value="">Seleccione un cliente...</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.telefono})</option>)}
        </select>
      </div>

      {tipo === 'garantia' && (
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Venta Original <span className="text-danger">*</span></label>
          <select required value={ventaId} onChange={e => setVentaId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
            <option value="">Seleccione la venta...</option>
            {ventas.map(v => <option key={v.id} value={v.id}>{v.numero_factura} - {v.equipo?.marca} {v.equipo?.modelo} ({v.equipo?.numero_serie})</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Descripción del Equipo <span className="text-danger">*</span></label>
        <input required value={equipoDesc} onChange={e => setEquipoDesc(e.target.value)}
          placeholder={tipo === 'garantia' ? 'Se autocompleta con la venta pero puedes detallar...' : 'Ej: Dell Latitude 5420...'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
      </div>

      {tipo === 'externa' && (
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Número de Serie (opcional)</label>
          <input value={serieExterno} onChange={e => setSerieExterno(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
      )}

      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Falla Reportada <span className="text-danger">*</span></label>
        <textarea required value={falla} onChange={e => setFalla(e.target.value)} rows={3}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
      </div>

      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Notas Adicionales</label>
        <input value={notas} onChange={e => setNotas(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
      </div>

      {error && <div className="text-danger text-sm bg-danger/10 p-3 rounded-xl">{error}</div>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors disabled:opacity-50">
          {loading ? 'Guardando...' : 'Crear Orden'}
        </button>
      </div>
    </form>
  );
}

// ─── Modal Cambiar Estado ────────────────────────────────────────────────────

function CambioEstadoModal({ 
  reparacion, 
  onClose, 
  onSuccess 
}: { 
  reparacion: Reparacion; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const [estado, setEstado] = useState(reparacion.estado);
  const [costoRepuestos, setCostoRepuestos] = useState(reparacion.costo_repuestos_usd || 0);
  const [costoManoObra, setCostoManoObra] = useState(reparacion.costo_mano_obra_usd || 0);
  const [precioCobrado, setPrecioCobrado] = useState(reparacion.precio_cobrado_usd || 0);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ESTADOS = ['RECIBIDO', 'EN_DIAGNOSTICO', 'PRESUPUESTADO', 'EN_REPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO'] as const;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await reparacionesService.update(reparacion.id, {
        estado,
        costo_repuestos_usd: Number(costoRepuestos),
        costo_mano_obra_usd: Number(costoManoObra),
        precio_cobrado_usd: Number(precioCobrado) || undefined,
        fecha_entrega: estado === 'ENTREGADO' ? new Date().toISOString() : undefined
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al actualizar el estado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Estado</label>
        <select value={estado} onChange={e => setEstado(e.target.value as any)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500">
          {ESTADOS.map(st => <option key={st} value={st}>{st.replace('_', ' ')}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Costo Repuestos (USD)</label>
          <input type="number" step="0.01" value={costoRepuestos} onChange={e => setCostoRepuestos(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Costo Mano Obra (USD)</label>
          <input type="number" step="0.01" value={costoManoObra} onChange={e => setCostoManoObra(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
        </div>
      </div>

      {estado === 'ENTREGADO' && (
        <div>
          <label className="block text-slate-400 text-sm mb-1.5">Precio Cobrado al Cliente (USD)</label>
          <input type="number" step="0.01" value={precioCobrado} onChange={e => setPrecioCobrado(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500" />
          {reparacion.tipo === 'garantia' && (
            <p className="text-xs text-slate-500 mt-1">Si está cubierto por garantía, normalmente es $0.</p>
          )}
        </div>
      )}

      {error && <div className="text-danger text-sm bg-danger/10 p-3 rounded-xl">{error}</div>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors disabled:opacity-50">
          {loading ? 'Guardando...' : 'Actualizar Orden'}
        </button>
      </div>
    </form>
  );
}

// ─── Componente de Pólizas Vigentes ──────────────────────────────────────────

function PolizasVigentesList() {
  const [polizas, setPolizas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      // Usar limit alto o paginación. Para simplificar, traemos las vigentes
      const res = await api.get('/ventas?garantias_vigentes=true&limit=100');
      setPolizas(res.data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando pólizas...</div>
      ) : polizas.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-sm">No hay pólizas vigentes registradas.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-app-border bg-slate-800/50">
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Teléfono</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Producto</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Factura / Garantía</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Vencimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {polizas.map(p => (
                <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-slate-100">{p.cliente?.nombre}</td>
                  <td className="px-4 py-3 text-slate-400">{p.cliente?.telefono}</td>
                  <td className="px-4 py-3 text-slate-300">{p.equipo?.marca} {p.equipo?.modelo} <span className="text-xs text-slate-500 font-mono block">{p.equipo?.numero_serie}</span></td>
                  <td className="px-4 py-3 font-mono text-slate-400 text-xs">
                    <div>{p.numero_factura}</div>
                    <div className="text-violet-400">{p.numero_garantia}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                      Vigente hasta {fmtFecha(p.garantia_vence)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Página Principal ────────────────────────────────────────────────────────

export function ReparacionesPage({ tipo }: { tipo: 'externa' | 'garantia' }) {
  const [reparaciones, setReparaciones] = useState<Reparacion[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [reparacionToEdit, setReparacionToEdit] = useState<Reparacion | null>(null);
  
  // Tabs: garantía (reclamos/pólizas) o externa (órdenes/equipos propios en taller)
  const [tab, setTab] = useState<'reclamos' | 'polizas' | 'ordenes' | 'taller'>(tipo === 'garantia' ? 'reclamos' : 'taller');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reparacionesService.getAll({ tipo, page, limit: 20 });
      setReparaciones(res.items);
      setMeta(res.meta);
    } finally {
      setLoading(false);
    }
  }, [tipo, page]);

  useEffect(() => { cargar(); }, [cargar]);

  const title = tipo === 'garantia' ? 'Reclamos de Garantía' : 'Reparaciones Externas';

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">{title}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{meta.total} registros</p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={16} />
            Nueva {tipo === 'garantia' ? 'Garantía' : 'Reparación'}
          </button>
        </div>
      </div>

      {tipo === 'garantia' && (
        <div className="flex gap-2 border-b border-app-border pb-px mb-4">
          <button onClick={() => setTab('reclamos')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors ${tab === 'reclamos' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <Wrench size={16} />
            Reclamos Activos
          </button>
          <button onClick={() => setTab('polizas')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors ${tab === 'polizas' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <ShieldCheck size={16} />
            Pólizas Vigentes
          </button>
        </div>
      )}

      {tipo === 'externa' && (
        <div className="flex gap-2 border-b border-app-border pb-px mb-4">
          <button onClick={() => setTab('taller')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors ${tab === 'taller' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <Cpu size={16} />
            Equipos en Taller
          </button>
          <button onClick={() => setTab('ordenes')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors ${tab === 'ordenes' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <Wrench size={16} />
            Órdenes de Clientes
          </button>
        </div>
      )}

      {tipo === 'garantia' && tab === 'polizas' ? (
        <PolizasVigentesList />
      ) : tipo === 'externa' && tab === 'taller' ? (
        <EquiposEnTallerList />
      ) : (
        <>
          <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando...</div>
            ) : reparaciones.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-slate-500 text-sm">No hay registros</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-app-border bg-slate-800/50">
                      <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Orden</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Cliente</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Equipo</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Falla</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Estado</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Fecha</th>
                      <th className="text-right px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {reparaciones.map(r => (
                      <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-100 text-xs">{r.numero_orden}</td>
                        <td className="px-4 py-3 text-slate-300">{r.cliente?.nombre}</td>
                        <td className="px-4 py-3 text-slate-300">{r.equipo_descripcion}</td>
                        <td className="px-4 py-3 text-slate-400 truncate max-w-[200px]">{r.falla_reportada}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300`}>
                            {r.estado.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{fmtFecha(r.fecha_recepcion)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setReparacionToEdit(r)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-400/10 transition-colors">
                            <Edit size={16} />
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
        </>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={`Nueva ${tipo === 'garantia' ? 'Garantía' : 'Reparación'}`}>
        <ReparacionForm tipo={tipo} onClose={() => setShowForm(false)} onSuccess={cargar} />
      </Modal>

      <Modal open={!!reparacionToEdit} onClose={() => setReparacionToEdit(null)} title="Gestionar Orden">
        {reparacionToEdit && (
          <CambioEstadoModal reparacion={reparacionToEdit} onClose={() => setReparacionToEdit(null)} onSuccess={cargar} />
        )}
      </Modal>
    </div>
  );
}
