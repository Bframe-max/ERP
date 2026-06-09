import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, TrendingUp, Wallet, Shield, Users,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight,
  PlusCircle, MinusCircle, Landmark, Package, Wrench as Tool, Boxes,
} from 'lucide-react';
import {
  getResumenPeriodos, getHistorialFondo, postMovimientoManual, getCapitalDinamico,
  FondoSaldo, MovimientoFondo, ResumenPeriodosData, PeriodoData, CapitalDinamicoData,
} from './fondosService';
import { Modal } from '@/components/Modal';
import { TIMEZONE_NI } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => `$${n.toFixed(2)}`;

const fmtFechaHora = (iso: string) =>
  new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: TIMEZONE_NI,
  }).format(new Date(iso));

function nombreFondo(nombre: string): string {
  if (nombre === 'CAPITAL') return 'Capital del Negocio';
  if (nombre === 'OPEX') return 'Fondo Operativo';
  if (nombre === 'GANANCIA') return 'Fondo Ganancia';
  if (nombre === 'GARANTIAS') return 'Fondo Reinversión';
  if (nombre.startsWith('REPARTO_')) {
    const raw = nombre.replace('REPARTO_', '');
    return `Pago ${raw.charAt(0) + raw.slice(1).toLowerCase()}`;
  }
  return nombre;
}

type ColorSet = { card: string; text: string; dot: string };

function colorFondo(nombre: string): ColorSet {
  if (nombre === 'OPEX')
    return { card: 'border-blue-500/30 bg-blue-500/5 hover:border-blue-400/60', text: 'text-blue-400', dot: 'bg-blue-500' };
  if (nombre === 'GARANTIAS')
    return { card: 'border-amber-500/30 bg-amber-500/5 hover:border-amber-400/60', text: 'text-amber-400', dot: 'bg-amber-500' };
  if (nombre === 'GANANCIA')
    return { card: 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-400/60', text: 'text-emerald-400', dot: 'bg-emerald-500' };
  if (nombre.startsWith('REPARTO_'))
    return { card: 'border-violet-500/30 bg-violet-500/5 hover:border-violet-400/60', text: 'text-violet-400', dot: 'bg-violet-500' };
  return { card: 'border-slate-600 bg-slate-800/20 hover:border-slate-500', text: 'text-slate-300', dot: 'bg-slate-500' };
}

function colorFondoCapital(): ColorSet {
  return { card: 'border-sky-500/30 bg-sky-500/5 hover:border-sky-400/60', text: 'text-sky-400', dot: 'bg-sky-500' };
}

function IconFondo({ nombre, size = 15 }: { nombre: string; size?: number }) {
  const color = nombre === 'CAPITAL' ? colorFondoCapital().text : colorFondo(nombre).text;
  if (nombre === 'CAPITAL') return <Landmark size={size} className={color} />;
  if (nombre === 'OPEX') return <TrendingUp size={size} className={color} />;
  if (nombre === 'GARANTIAS') return <Shield size={size} className={color} />;
  if (nombre === 'GANANCIA') return <Wallet size={size} className={color} />;
  return <Users size={size} className={color} />;
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function labelPeriodo(key: string, tipo: 'mensual' | 'quincenal'): string {
  if (tipo === 'mensual') {
    const [year, month] = key.split('-');
    return `${MESES[parseInt(month) - 1]} ${year}`;
  }
  const [year, month, q] = key.split('-');
  const mes = MESES[parseInt(month) - 1];
  if (q === '1') return `1–15 ${mes}`;
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  return `16–${lastDay} ${mes}`;
}

function periodoTotal(p: PeriodoData, fondos: FondoSaldo[]): number {
  return fondos.reduce((s, f) => {
    const e = p.fondos[f.id];
    return s + (e ? e.ingreso - e.egreso : 0);
  }, 0);
}

// ─── Componente: Panel Capital Dinámico ──────────────────────────────────────

const SEGMENTOS_CAPITAL = [
  { key: 'liquido'    as const, label: 'Líquido',           desc: 'Capital disponible para reinvertir',   color: 'text-sky-400',     bar: 'bg-sky-500',     icon: Landmark  },
  { key: 'disponible' as const, label: 'Inventario',        desc: 'Equipos disponibles para vender',      color: 'text-emerald-400', bar: 'bg-emerald-500', icon: Package   },
  { key: 'taller'     as const, label: 'En taller',         desc: 'Equipos en reparación o servicio',     color: 'text-amber-400',   bar: 'bg-amber-500',   icon: Tool      },
  { key: 'accesorios' as const, label: 'Accesorios',        desc: 'Accesorios libres en inventario',      color: 'text-violet-400',  bar: 'bg-violet-500',  icon: Boxes     },
] as const;

function PanelCapital({
  capital, onAportarCapital,
}: { capital: CapitalDinamicoData; onAportarCapital: () => void }) {
  const total = capital.total;

  return (
    <div className="bg-app-surface border border-app-border rounded-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">Capital del Negocio</p>
          <p className="text-3xl font-bold text-slate-100 tabular-nums">${total.toFixed(2)}</p>
          <p className="text-xs text-slate-600 mt-1">Suma de todo el capital activo en el sistema</p>
        </div>
        <button
          onClick={onAportarCapital}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-medium hover:bg-sky-500/20 transition-colors"
        >
          <PlusCircle size={13} /> Aportar / Retirar
        </button>
      </div>

      {/* Barra apilada */}
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-5">
        {total === 0 ? (
          <div className="flex-1 bg-slate-800 rounded-full" />
        ) : (
          SEGMENTOS_CAPITAL.map(s => {
            const pct = (capital[s.key] / total) * 100;
            return pct > 0.5 ? (
              <div key={s.key} className={`${s.bar} rounded-sm transition-all`} style={{ width: `${pct}%` }}
                title={`${s.label}: $${capital[s.key].toFixed(2)} (${pct.toFixed(1)}%)`} />
            ) : null;
          })
        )}
      </div>

      {/* Desglose en grid 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {SEGMENTOS_CAPITAL.map(s => {
          const valor = capital[s.key];
          const pct = total > 0 ? (valor / total) * 100 : 0;
          const Icon = s.icon;
          const conteoKey = s.key === 'disponible' ? 'equipos_disponibles'
            : s.key === 'taller' ? 'equipos_taller'
            : s.key === 'accesorios' ? 'accesorios_libres'
            : null;
          const conteo = conteoKey ? capital.conteos[conteoKey] : null;

          return (
            <div key={s.key} className={`rounded-xl border p-3.5 ${
              s.key === 'liquido'
                ? 'border-sky-500/20 bg-sky-500/5'
                : 'border-app-border bg-slate-800/20'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={13} className={s.color} />
                <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
                {pct > 0 && (
                  <span className="ml-auto text-xs text-slate-700 tabular-nums">{pct.toFixed(0)}%</span>
                )}
              </div>
              <p className={`text-lg font-bold tabular-nums ${valor < 0 ? 'text-danger' : s.color}`}>
                ${valor.toFixed(2)}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {conteo !== null ? `${conteo} unid.` : s.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Nota líquido */}
      {capital.liquido === 0 && (
        <p className="text-xs text-slate-600 mt-3 text-center">
          El capital líquido está en $0. Usa "Aportar" para registrar capital disponible.
        </p>
      )}
    </div>
  );
}

// ─── Modal: Movimiento Manual ─────────────────────────────────────────────────

function ModalMovimiento({
  fondo, onClose, onSuccess,
}: { fondo: FondoSaldo; onClose: () => void; onSuccess: () => void }) {
  const esCapital = fondo.nombre === 'CAPITAL';
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0 || !concepto.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await postMovimientoManual(fondo.id, montoNum, tipo, concepto.trim());
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
      <p className="text-slate-400 text-sm">
        {esCapital
          ? 'Registra un aporte o retiro de capital del negocio.'
          : `Añadir un movimiento manual al fondo ${nombreFondo(fondo.nombre)}.`}
      </p>

      {/* Tipo */}
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Tipo de movimiento</label>
        <div className="flex gap-2">
          <button type="button"
            onClick={() => setTipo('ingreso')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${tipo === 'ingreso' ? 'bg-success/10 border-success/50 text-success' : 'border-app-border text-slate-400 hover:text-slate-200'}`}>
            <PlusCircle size={15} /> {esCapital ? 'Aporte de capital' : 'Ingreso'}
          </button>
          <button type="button"
            onClick={() => setTipo('egreso')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${tipo === 'egreso' ? 'bg-danger/10 border-danger/50 text-danger' : 'border-app-border text-slate-400 hover:text-slate-200'}`}>
            <MinusCircle size={15} /> {esCapital ? 'Retiro de capital' : 'Egreso'}
          </button>
        </div>
      </div>

      {/* Monto */}
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Monto (USD) <span className="text-danger">*</span></label>
        <input
          type="number" step="0.01" min="0.01" value={monto}
          onChange={e => setMonto(e.target.value)}
          placeholder="0.00"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500"
        />
        <p className="text-slate-600 text-xs mt-1">
          Saldo actual: <strong className="text-slate-400">{fmt(fondo.saldo_usd)}</strong>
          {monto && !isNaN(parseFloat(monto)) && (
            <> → Nuevo saldo: <strong className={tipo === 'ingreso' ? 'text-success' : 'text-danger'}>
              {fmt(tipo === 'ingreso' ? fondo.saldo_usd + parseFloat(monto) : fondo.saldo_usd - parseFloat(monto))}
            </strong></>
          )}
        </p>
      </div>

      {/* Concepto */}
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">Concepto / Descripción <span className="text-danger">*</span></label>
        <input
          value={concepto} onChange={e => setConcepto(e.target.value)}
          placeholder={esCapital ? 'ej. Aporte inicial socio, Reinversión de ganancias...' : 'ej. Ajuste manual, Transferencia...'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500"
        />
      </div>

      {error && <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-app-border text-slate-400 hover:text-slate-100 text-sm transition-colors">
          Cancelar
        </button>
        <button type="submit"
          disabled={!monto || parseFloat(monto) <= 0 || !concepto.trim() || loading}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 ${
            tipo === 'ingreso'
              ? 'bg-success/20 hover:bg-success/30 border border-success/50 text-success'
              : 'bg-danger/20 hover:bg-danger/30 border border-danger/50 text-danger'
          }`}>
          {loading ? 'Guardando...' : tipo === 'ingreso' ? '+ Confirmar ingreso' : '− Confirmar egreso'}
        </button>
      </div>
    </form>
  );
}

// ─── Componente: Saldo Card ───────────────────────────────────────────────────

function FondoCard({
  fondo, selected, onClick, onMovimiento,
}: { fondo: FondoSaldo; selected: boolean; onClick: () => void; onMovimiento: () => void }) {
  const esCapital = fondo.nombre === 'CAPITAL';
  const color = esCapital ? colorFondoCapital() : colorFondo(fondo.nombre);
  return (
    <div className={`p-4 rounded-xl border transition-all ${color.card} ${selected ? 'ring-2 ring-violet-500/70' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <IconFondo nombre={fondo.nombre} />
        <div className="flex items-center gap-1">
          {/* Botón + / − siempre visible en CAPITAL, hover en otros */}
          <button
            onClick={e => { e.stopPropagation(); onMovimiento(); }}
            title={esCapital ? 'Aportar / Retirar capital' : 'Movimiento manual'}
            className={`p-1 rounded-lg transition-colors ${color.text} hover:bg-white/10`}
          >
            <PlusCircle size={14} />
          </button>
          <button onClick={onClick} className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors">
            {selected ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 font-medium leading-snug mb-1">
        {nombreFondo(fondo.nombre)}
      </p>
      <p className={`text-xl font-bold tabular-nums ${fondo.saldo_usd < 0 ? 'text-danger' : color.text}`}>
        {fmt(fondo.saldo_usd)}
      </p>
      <p className="text-xs text-slate-600 mt-1.5">
        {esCapital ? 'Capital activo en el negocio' : 'Clic ↓ para historial'}
      </p>
    </div>
  );
}

// ─── Componente: Historial Inline ─────────────────────────────────────────────

function HistorialInline({
  fondo, movimientos, loading, onClose,
}: { fondo: FondoSaldo; movimientos: MovimientoFondo[]; loading: boolean; onClose: () => void }) {
  const color = colorFondo(fondo.nombre);
  return (
    <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
      <div className="px-4 py-3 border-b border-app-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
          <span className={`text-sm font-semibold ${color.text}`}>{nombreFondo(fondo.nombre)}</span>
          <span className="text-xs text-slate-500 hidden sm:inline">
            — Saldo: <strong className="text-slate-200">{fmt(fondo.saldo_usd)}</strong>
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-200 text-xs px-2 py-1 rounded hover:bg-slate-700 transition-colors shrink-0"
        >
          Cerrar ✕
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-slate-500 text-sm animate-pulse">
          Cargando movimientos...
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm">
              <tr className="border-b border-app-border">
                <th className="px-4 py-2.5 text-left text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Fecha
                </th>
                <th className="px-4 py-2.5 text-left text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Concepto
                </th>
                <th className="px-4 py-2.5 text-right text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Monto
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {movimientos.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-slate-500 text-sm">
                    Sin movimientos registrados
                  </td>
                </tr>
              ) : (
                movimientos.map(mov => (
                  <tr key={mov.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                      {fmtFechaHora(mov.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 text-xs">{mov.concepto}</td>
                    <td className="px-4 py-2.5 text-right">
                      {mov.tipo === 'ingreso' ? (
                        <span className="text-success text-xs font-mono font-semibold flex items-center justify-end gap-1">
                          <ArrowUpRight size={12} />+{fmt(mov.monto_usd)}
                        </span>
                      ) : (
                        <span className="text-danger text-xs font-mono font-semibold flex items-center justify-end gap-1">
                          <ArrowDownRight size={12} />-{fmt(mov.monto_usd)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Componente: Tabla de Períodos ────────────────────────────────────────────

function TablaPeriodos({
  data, tipo,
}: { data: ResumenPeriodosData; tipo: 'mensual' | 'quincenal' }) {
  if (data.periodos.length === 0) {
    return (
      <div className="py-10 text-center text-slate-500 text-sm">
        No hay movimientos en el período seleccionado
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-800/70">
          <tr>
            <th className="px-4 py-3 text-left text-xs text-slate-400 uppercase font-medium tracking-wider sticky left-0 bg-slate-800/70 z-10">
              Período
            </th>
            {data.fondos.map(f => (
              <th
                key={f.id}
                className={`px-4 py-3 text-right text-xs uppercase font-medium tracking-wider ${f.nombre === 'CAPITAL' ? colorFondoCapital().text : colorFondo(f.nombre).text}`}
              >
                {nombreFondo(f.nombre)}
              </th>
            ))}
            <th className="px-4 py-3 text-right text-xs text-slate-300 uppercase font-medium tracking-wider">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border">
          {data.periodos.map(p => {
            const total = periodoTotal(p, data.fondos);
            return (
              <tr key={p.periodo} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-slate-200 font-medium text-xs sticky left-0 bg-app-surface group-hover:bg-slate-800/30">
                  {labelPeriodo(p.periodo, tipo)}
                </td>
                {data.fondos.map(f => {
                  const entry = p.fondos[f.id];
                  const net = entry ? entry.ingreso - entry.egreso : 0;
                  const color = f.nombre === 'CAPITAL' ? colorFondoCapital().text : colorFondo(f.nombre).text;
                  return (
                    <td key={f.id} className="px-4 py-3 text-right font-mono text-xs">
                      {net === 0 ? (
                        <span className="text-slate-700">—</span>
                      ) : net > 0 ? (
                        <span className={color}>+{fmt(net)}</span>
                      ) : (
                        <span className="text-danger">{fmt(net)}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                  {total === 0 ? (
                    <span className="text-slate-700">—</span>
                  ) : (
                    <span className={total > 0 ? 'text-success' : 'text-danger'}>
                      {total > 0 ? '+' : ''}{fmt(total)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        {/* Fila de totales generales */}
        <tfoot className="border-t-2 border-slate-600 bg-slate-800/80">
          <tr>
            <td className="px-4 py-3 text-xs text-slate-400 uppercase font-semibold sticky left-0 bg-slate-800/80">
              Acumulado
            </td>
            {data.fondos.map(f => {
              const totalFondo = data.periodos.reduce((s, p) => {
                const e = p.fondos[f.id];
                return s + (e ? e.ingreso - e.egreso : 0);
              }, 0);
              return (
                <td key={f.id} className={`px-4 py-3 text-right font-mono text-xs font-bold ${f.nombre === 'CAPITAL' ? colorFondoCapital().text : colorFondo(f.nombre).text}`}>
                  {totalFondo === 0 ? '—' : (totalFondo > 0 ? '+' : '') + fmt(totalFondo)}
                </td>
              );
            })}
            <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-100">
              {(() => {
                const gt = data.periodos.reduce((s, p) => s + periodoTotal(p, data.fondos), 0);
                return gt === 0 ? '—' : (gt > 0 ? '+' : '') + fmt(gt);
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export function FondosPage() {
  const [data, setData] = useState<ResumenPeriodosData | null>(null);
  const [capital, setCapital] = useState<CapitalDinamicoData | null>(null);
  const [loading, setLoading] = useState(true);

  const [tipoPeriodo, setTipoPeriodo] = useState<'mensual' | 'quincenal'>('mensual');
  const [limitePeriodos, setLimitePeriodos] = useState(6);

  const [fondoSel, setFondoSel] = useState<FondoSaldo | null>(null);
  const [historial, setHistorial] = useState<MovimientoFondo[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);

  const [movimientoFondo, setMovimientoFondo] = useState<FondoSaldo | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [resumen, cap] = await Promise.all([
        getResumenPeriodos(tipoPeriodo, limitePeriodos),
        getCapitalDinamico(),
      ]);
      setData(resumen);
      setCapital(cap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tipoPeriodo, limitePeriodos]);

  useEffect(() => { cargar(); }, [cargar]);

  async function toggleFondo(fondo: FondoSaldo) {
    if (fondoSel?.id === fondo.id) {
      setFondoSel(null);
      return;
    }
    setFondoSel(fondo);
    setHistorialLoading(true);
    try {
      const res = await getHistorialFondo(fondo.id);
      setHistorial(res.historial);
    } catch (err) {
      console.error(err);
    } finally {
      setHistorialLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl pb-10">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Fondos Virtuales</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Saldos en tiempo real, acumulado por período e historial de movimientos
          </p>
        </div>
        <button
          onClick={cargar}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Panel Capital Dinámico */}
      {capital && data && (
        <PanelCapital
          capital={capital}
          onAportarCapital={() => {
            const fondoCapital = data.fondos.find(f => f.nombre === 'CAPITAL');
            if (fondoCapital) setMovimientoFondo(fondoCapital);
          }}
        />
      )}
      {loading && !capital && (
        <div className="h-48 rounded-card bg-slate-800/40 animate-pulse" />
      )}

      {/* Saldo Cards */}
      {loading && !data ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.fondos.filter(f => f.nombre !== 'CAPITAL').map(f => (
            <FondoCard
              key={f.id}
              fondo={f}
              selected={fondoSel?.id === f.id}
              onClick={() => toggleFondo(f)}
              onMovimiento={() => setMovimientoFondo(f)}
            />
          ))}
        </div>
      )}

      {/* Historial Inline */}
      {fondoSel && (
        <HistorialInline
          fondo={fondoSel}
          movimientos={historial}
          loading={historialLoading}
          onClose={() => setFondoSel(null)}
        />
      )}

      {/* Sección Acumulado por Período */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-base font-semibold text-slate-200">Acumulado por Período</h2>
          <div className="flex items-center gap-2">
            {/* Toggle mensual / quincenal */}
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-app-border">
              {(['mensual', 'quincenal'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTipoPeriodo(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    tipoPeriodo === t
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'mensual' ? 'Mensual' : 'Quincenal'}
                </button>
              ))}
            </div>

            {/* Selector de cantidad */}
            <select
              value={limitePeriodos}
              onChange={e => setLimitePeriodos(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
            >
              <option value={3}>Últimos 3</option>
              <option value={6}>Últimos 6</option>
              <option value={12}>Últimos 12</option>
            </select>
          </div>
        </div>

        <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
          {loading ? (
            <div className="py-10 text-center text-slate-500 text-sm animate-pulse">
              Calculando períodos...
            </div>
          ) : data ? (
            <TablaPeriodos data={data} tipo={tipoPeriodo} />
          ) : null}
        </div>
      </div>

      {/* Modal movimiento manual */}
      <Modal
        open={!!movimientoFondo}
        onClose={() => setMovimientoFondo(null)}
        title={
          movimientoFondo?.nombre === 'CAPITAL'
            ? 'Aporte / Retiro de Capital'
            : `Movimiento: ${movimientoFondo ? nombreFondo(movimientoFondo.nombre) : ''}`
        }
        maxWidth="max-w-md"
      >
        {movimientoFondo && (
          <ModalMovimiento
            fondo={movimientoFondo}
            onClose={() => setMovimientoFondo(null)}
            onSuccess={cargar}
          />
        )}
      </Modal>

    </div>
  );
}
