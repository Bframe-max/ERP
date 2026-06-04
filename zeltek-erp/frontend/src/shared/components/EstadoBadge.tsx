import type { EstadoEquipo } from '@shared/types/equipo';

const ESTADO_ESTILOS: Record<EstadoEquipo, { bg: string; text: string; label: string }> = {
  COMPRADO:        { bg: 'bg-yellow-950/50', text: 'text-amber-400',   label: '🟡 Comprado' },
  EN_BODEGA_MIAMI: { bg: 'bg-orange-950/50', text: 'text-orange-400',  label: '🟠 Bodega Miami' },
  EN_TRANSITO:     { bg: 'bg-blue-950/50',   text: 'text-blue-400',    label: '🔵 En Tránsito' },
  EN_TALLER:       { bg: 'bg-violet-950/50', text: 'text-violet-400',  label: '🟣 En Taller' },
  DISPONIBLE:      { bg: 'bg-emerald-950/50',text: 'text-emerald-400', label: '🟢 Disponible' },
  VENDIDO:         { bg: 'bg-slate-800',     text: 'text-slate-300',   label: '⚫ Vendido' },
  EN_RECLAMO:      { bg: 'bg-rose-950/50',   text: 'text-rose-400',    label: '🚨 En Reclamo' },
  DEVUELTO:        { bg: 'bg-slate-900',     text: 'text-slate-500',   label: '❌ Devuelto' },
};

interface EstadoBadgeProps {
  estado: EstadoEquipo;
}

export function EstadoBadge({ estado }: EstadoBadgeProps) {
  const estilos = ESTADO_ESTILOS[estado];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${estilos.bg} ${estilos.text} ${estado === 'DEVUELTO' ? 'line-through' : ''}`}>
      {estilos.label}
    </span>
  );
}
