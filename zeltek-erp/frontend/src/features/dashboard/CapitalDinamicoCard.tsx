import { Landmark, Package, Wrench, Boxes } from 'lucide-react';

interface CapitalDinamicoProps {
  liquido: number;
  disponible: number;
  taller: number;
  accesorios: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtExact = (n: number) => `$${n.toFixed(2)}`;

interface Segmento {
  label: string;
  valor: number;
  color: string;
  barColor: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  desc: string;
}

export function CapitalDinamicoCard({ liquido, disponible, taller, accesorios }: CapitalDinamicoProps) {
  const total = liquido + disponible + taller + accesorios;

  const segmentos: Segmento[] = [
    {
      label: 'Líquido',
      valor: liquido,
      color: 'text-sky-400',
      barColor: 'bg-sky-500',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/20',
      icon: <Landmark size={16} />,
      desc: 'Capital disponible',
    },
    {
      label: 'Inventario',
      valor: disponible,
      color: 'text-emerald-400',
      barColor: 'bg-emerald-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      icon: <Package size={16} />,
      desc: 'Equipos disponibles',
    },
    {
      label: 'En taller',
      valor: taller,
      color: 'text-amber-400',
      barColor: 'bg-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      icon: <Wrench size={16} />,
      desc: 'Equipos en reparación',
    },
    {
      label: 'Accesorios',
      valor: accesorios,
      color: 'text-violet-400',
      barColor: 'bg-violet-500',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/20',
      icon: <Boxes size={16} />,
      desc: 'Accesorios sin asignar',
    },
  ];

  return (
    <div className="bg-app-surface border border-app-border rounded-card p-5">
      <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 sm:items-stretch">

        {/* Left: total + bar */}
        <div className="sm:w-52 shrink-0 flex flex-col justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1.5">Capital del Negocio</p>
            <p className="text-3xl font-bold text-slate-100 tabular-nums">{fmt(total)}</p>
          </div>
          <div>
            {total > 0 ? (
              <div className="flex h-2 rounded-full overflow-hidden gap-px">
                {segmentos.map(s => {
                  const pct = (s.valor / total) * 100;
                  return pct > 0 ? (
                    <div
                      key={s.label}
                      className={`${s.barColor} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${s.label}: ${fmtExact(s.valor)} (${pct.toFixed(1)}%)`}
                    />
                  ) : null;
                })}
              </div>
            ) : (
              <div className="h-2 rounded-full bg-slate-800" />
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {segmentos.map(s => (
                <div key={s.label} className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${s.barColor}`} />
                  <span className="text-xs text-slate-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px bg-app-border" />
        <div className="block sm:hidden h-px bg-app-border" />

        {/* Right: 4 segment tiles */}
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {segmentos.map(s => {
            const pct = total > 0 ? (s.valor / total) * 100 : 0;
            return (
              <div
                key={s.label}
                className={`${s.bgColor} border ${s.borderColor} rounded-xl p-3.5 flex flex-col gap-2`}
              >
                <div className={`flex items-center gap-1.5 ${s.color}`}>
                  {s.icon}
                  <span className="text-xs font-semibold">{s.label}</span>
                </div>
                <p className={`text-xl font-bold font-mono tabular-nums ${s.color}`}>
                  {fmtExact(s.valor)}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs text-slate-500">{s.desc}</span>
                  {pct > 0 && (
                    <span className={`text-xs font-medium tabular-nums ${s.color} opacity-70`}>
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
