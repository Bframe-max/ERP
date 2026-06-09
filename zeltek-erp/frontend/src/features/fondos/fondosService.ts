import api from '../../lib/api';

export interface Fondo {
  id: string;
  nombre: string;
  saldo_usd: number;
  updated_at: string;
}

export interface CapitalGlobal {
  capital_activo_usd: number;
  capital_retornado_historico_usd: number;
  capital_invertido_total_usd: number;
}

export interface MovimientoFondo {
  id: string;
  monto_usd: number;
  tipo: 'ingreso' | 'egreso';
  concepto: string;
  created_at: string;
}

export interface HistorialFondoResponse {
  fondo: { id: string; nombre: string; saldo_usd: number };
  historial: MovimientoFondo[];
}

export interface FondosResponse {
  fondos: Fondo[];
  capital_global: CapitalGlobal;
}

export interface FondoSaldo {
  id: string;
  nombre: string;
  saldo_usd: number;
}

export interface PeriodoEntry {
  ingreso: number;
  egreso: number;
}

export interface PeriodoData {
  periodo: string;
  fondos: Record<string, PeriodoEntry>;
}

export interface ResumenPeriodosData {
  fondos: FondoSaldo[];
  periodos: PeriodoData[];
}

export async function getFondos() {
  const res = await api.get<{ data: FondosResponse }>('/fondos');
  return res.data.data;
}

export async function getHistorialFondo(id: string) {
  const res = await api.get<{ data: HistorialFondoResponse }>(`/fondos/${id}/historial`);
  return res.data.data;
}

export async function getResumenPeriodos(tipo: 'mensual' | 'quincenal', limite: number): Promise<ResumenPeriodosData> {
  const res = await api.get<{ data: ResumenPeriodosData }>('/fondos/resumen-periodos', { params: { tipo, limite } });
  return res.data.data;
}

export interface CapitalDinamicoData {
  liquido: number;
  disponible: number;
  taller: number;
  accesorios: number;
  total: number;
  conteos: { equipos_disponibles: number; equipos_taller: number; accesorios_libres: number };
}

export async function getCapitalDinamico(): Promise<CapitalDinamicoData> {
  const res = await api.get<{ data: CapitalDinamicoData }>('/fondos/capital-dinamico');
  return res.data.data;
}

export async function postMovimientoManual(
  fondoId: string,
  monto_usd: number,
  tipo: 'ingreso' | 'egreso',
  concepto: string,
): Promise<FondoSaldo> {
  const res = await api.post<{ data: FondoSaldo }>(`/fondos/${fondoId}/movimiento`, { monto_usd, tipo, concepto });
  return res.data.data;
}
