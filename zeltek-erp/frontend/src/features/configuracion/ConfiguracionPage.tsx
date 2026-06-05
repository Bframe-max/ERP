import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Save, Check } from 'lucide-react';
import api from '@/lib/api';

interface Setting {
  clave: string;
  valor: string;
  tipo: string;
  descripcion: string;
}

type Grupo = {
  titulo: string;
  claves: string[];
};

const GRUPOS: Grupo[] = [
  {
    titulo: 'Profit First — TAPs',
    claves: ['pf_tap_ganancia', 'pf_tap_garantias', 'pf_tap_opex', 'pf_tap_reparto'],
  },
  {
    titulo: 'Logística y tarifas',
    claves: ['tarifa_libra_aerea_usd', 'tarifa_libra_maritima_usd'],
  },
  {
    titulo: 'Tasa de cambio',
    claves: ['tasa_cambio_oficial', 'tasa_cambio_fecha', 'moneda_cobro_local'],
  },
  {
    titulo: 'Ventas y márgenes',
    claves: ['margen_minimo_pct'],
  },
  {
    titulo: 'Garantías',
    claves: ['dias_garantia_seminuevo', 'dias_garantia_nuevo'],
  },
  {
    titulo: 'Sistema',
    claves: ['alerta_inbox_dias', 'modo_migracion'],
  },
];

function InputSetting({
  setting,
  onSave,
}: {
  setting: Setting;
  onSave: (clave: string, valor: string) => Promise<void>;
}) {
  const [valor, setValor] = useState(setting.valor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = valor !== setting.valor;

  async function handleSave() {
    if (!dirty) return;
    setSaving(true);
    try {
      await onSave(setting.clave, valor);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function renderInput() {
    if (setting.tipo === 'BOOLEAN') {
      return (
        <div onClick={() => setValor(v => v === 'true' ? 'false' : 'true')}
          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${valor === 'true' ? 'bg-success' : 'bg-slate-600'}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${valor === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      );
    }
    if (setting.tipo === 'DATE') {
      return (
        <input type="date" value={valor} onChange={e => setValor(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500 w-44" />
      );
    }
    const isNum = setting.tipo === 'DECIMAL' || setting.tipo === 'INTEGER';
    return (
      <input
        type={isNum ? 'number' : 'text'}
        step={setting.tipo === 'DECIMAL' ? '0.01' : undefined}
        value={valor}
        onChange={e => setValor(e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-sm focus:outline-none focus:border-violet-500 w-36 text-right"
      />
    );
  }

  return (
    <div className="flex items-center gap-4 py-3 px-4 hover:bg-slate-800/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-slate-300 text-sm font-medium">{formatLabel(setting.clave)}</p>
        <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{setting.descripcion}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {renderInput()}
        {setting.tipo !== 'BOOLEAN' && (
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`p-1.5 rounded-lg transition-colors ${
              saved ? 'text-success' : dirty ? 'text-violet-400 hover:bg-violet-600/10' : 'text-slate-700'
            }`}
            title="Guardar">
            {saved ? <Check size={14} /> : <Save size={14} />}
          </button>
        )}
        {setting.tipo === 'BOOLEAN' && dirty && (
          <button onClick={handleSave} disabled={saving}
            className="px-3 py-1 rounded-lg text-xs bg-violet-600 hover:bg-violet-500 text-white transition-colors">
            {saving ? '...' : 'Guardar'}
          </button>
        )}
      </div>
    </div>
  );
}

function formatLabel(clave: string): string {
  const MAP: Record<string, string> = {
    tarifa_libra_aerea_usd: 'Tarifa aérea (USD/lb)',
    tarifa_libra_maritima_usd: 'Tarifa marítima (USD/lb)',
    margen_minimo_pct: 'Margen mínimo (%)',
    dias_garantia_seminuevo: 'Días garantía — seminuevo',
    dias_garantia_nuevo: 'Días garantía — nuevo',
    tasa_cambio_oficial: 'Tasa oficial (NIO/USD)',
    tasa_cambio_fecha: 'Fecha última actualización',
    moneda_cobro_local: 'Moneda de cobro local',
    alerta_inbox_dias: 'Alerta inbox (días sin triage)',
    pf_tap_ganancia: 'TAP Ganancia (%)',
    pf_tap_garantias: 'TAP Garantías (%)',
    pf_tap_opex: 'TAP OPEX (%)',
    pf_tap_reparto: 'TAP Reparto socios (%)',
    modo_migracion: 'Modo migración',
  };
  return MAP[clave] ?? clave.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function ConfiguracionPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Setting[] }>('/settings');
      setSettings(res.data.data);
    } catch {
      setError('No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardarSetting(clave: string, valor: string) {
    await api.patch(`/settings/${clave}`, { valor });
    setSettings(prev => prev.map(s => s.clave === clave ? { ...s, valor } : s));
  }

  const settingMap = Object.fromEntries(settings.map(s => [s.clave, s]));

  // Claves que no están en ningún grupo (mostrar al final)
  const clavesCubiertas = new Set(GRUPOS.flatMap(g => g.claves));
  const otrasSetting = settings.filter(s => !clavesCubiertas.has(s.clave));

  // Verificar que los TAPs sumen 100
  const tapTotal = ['pf_tap_ganancia', 'pf_tap_garantias', 'pf_tap_opex', 'pf_tap_reparto']
    .reduce((sum, k) => sum + parseFloat(settingMap[k]?.valor ?? '0'), 0);
  const tapOk = Math.abs(tapTotal - 100) < 0.01;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Configuración</h1>
          <p className="text-slate-500 text-sm mt-0.5">Parámetros operativos del sistema</p>
        </div>
        <button onClick={cargar} className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{error}</div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm animate-pulse">Cargando configuración...</div>
      ) : (
        <div className="space-y-5">
          {GRUPOS.map(grupo => {
            const items = grupo.claves.map(c => settingMap[c]).filter(Boolean);
            if (items.length === 0) return null;

            const esTap = grupo.titulo.includes('Profit First');

            return (
              <div key={grupo.titulo} className="bg-app-surface rounded-card border border-app-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
                  <h2 className="text-slate-300 text-sm font-semibold">{grupo.titulo}</h2>
                  {esTap && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tapOk ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                      Total: {tapTotal.toFixed(2)}% {tapOk ? '✓' : '≠ 100%'}
                    </span>
                  )}
                </div>
                <div className="divide-y divide-app-border">
                  {items.map(s => (
                    <InputSetting key={s.clave} setting={s} onSave={guardarSetting} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Claves sin grupo */}
          {otrasSetting.length > 0 && (
            <div className="bg-app-surface rounded-card border border-app-border overflow-hidden">
              <div className="px-4 py-3 border-b border-app-border">
                <h2 className="text-slate-300 text-sm font-semibold">Otros</h2>
              </div>
              <div className="divide-y divide-app-border">
                {otrasSetting.map(s => (
                  <InputSetting key={s.clave} setting={s} onSave={guardarSetting} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
