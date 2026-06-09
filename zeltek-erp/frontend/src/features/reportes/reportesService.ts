import api from '../../lib/api';

export interface ReporteVentasParams {
  desde: string;
  hasta: string;
  vendedor_id?: string;
}

export interface EstadoCuentaParams {
  inversor_id: string;
  desde: string;
  hasta: string;
}

export interface ReporteOpexParams {
  desde: string;
  hasta: string;
}

export interface InversorDesglose {
  id: string;
  nombre: string;
  porcentaje: number;
}

export interface VentaDesglose {
  id: string;
  numero_factura: string;
  fecha_venta: string;
  equipo: { marca: string; modelo: string; numero_serie: string };
  precio_venta_usd: number;
  ctr_al_momento_usd: number;
  ganancia_bruta_venta_usd: number;
  pf_monto_opex_usd: number;
  pf_monto_garantias_usd: number;
  pf_monto_ganancia_usd: number;
  pf_monto_reparto_usd: number;
  pf_tap_opex_aplicado: number;
  pf_tap_garantias_aplicado: number;
  pf_tap_ganancia_aplicado: number;
  reparto_liquidado: boolean;
}

export interface ReporteVentasData {
  periodo: { desde: string; hasta: string };
  resumen: {
    cantidad_ventas: number;
    ingresos_usd: number;
    ctr_total_usd: number;
    ganancia_bruta_usd: number;
    pf_ganancia_usd: number;
    pf_garantias_usd: number;
    pf_opex_usd: number;
    pf_reparto_usd: number;
  };
  inversores: InversorDesglose[];
  ventas: VentaDesglose[];
}

export const reportesService = {
  async getReporteVentas(params: ReporteVentasParams): Promise<ReporteVentasData> {
    const response = await api.get('/reportes/ventas', { params });
    return response.data.data;
  },

  async getEstadoCuenta(params: EstadoCuentaParams) {
    const response = await api.get('/reportes/estado-cuenta', { params });
    return response.data.data;
  },

  async getReporteOpex(params: ReporteOpexParams) {
    const response = await api.get('/reportes/opex', { params });
    return response.data.data;
  },
};
