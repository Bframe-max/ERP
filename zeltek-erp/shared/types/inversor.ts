export interface Inversor {
  id: string;
  nombre: string;
  porcentaje_ganancia: number;
  telefono: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  // Calculados en tiempo real (no persisten en BD)
  capital_activo_usd?: number;
  capital_perdido_usd?: number;
  total_reintegrado_usd?: number;
  pendiente_reintegrar_usd?: number;
}

export interface FondoFinanciero {
  id: string;
  nombre: 'GANANCIA' | 'GARANTIAS' | 'OPEX' | 'REPARTO_SOCIO_A' | 'REPARTO_ZELTEK';
  saldo_usd: number;
  updated_at: string;
}
