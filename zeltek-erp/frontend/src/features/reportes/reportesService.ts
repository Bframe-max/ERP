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

export const reportesService = {
  async getReporteVentas(params: ReporteVentasParams) {
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
