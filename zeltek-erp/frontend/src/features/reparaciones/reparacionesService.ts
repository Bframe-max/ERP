import api from '../../lib/api';

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
}

export interface Tecnico {
  id: string;
  nombre: string;
}

export interface VentaOriginal {
  numero_garantia: string | null;
  equipo: {
    marca: string;
    modelo: string;
    numero_serie: string;
  };
}

export interface Reparacion {
  id: string;
  numero_orden: string;
  cliente_id: string;
  tipo: 'externa' | 'garantia';
  venta_id: string | null;
  equipo_descripcion: string;
  numero_serie_externo: string | null;
  falla_reportada: string;
  diagnostico_tecnico: string | null;
  estado: 'RECIBIDO' | 'EN_DIAGNOSTICO' | 'PRESUPUESTADO' | 'EN_REPARACION' | 'LISTO' | 'ENTREGADO' | 'CANCELADO';
  presupuesto_usd: number | null;
  aprobado_cliente: boolean | null;
  costo_repuestos_usd: number;
  costo_mano_obra_usd: number;
  costo_total_usd: number;
  precio_cobrado_usd: number | null;
  metodo_pago: 'EFECTIVO' | 'TRANSFERENCIA_BAC' | 'USDT' | null;
  moneda_cobro: 'USD' | 'NIO' | 'MIXTO' | null;
  tasa_cambio_aplicada: number | null;
  tecnico_id: string | null;
  fecha_recepcion: string;
  fecha_diagnostico: string | null;
  fecha_entrega: string | null;
  notas: string | null;
  cliente?: Cliente;
  tecnico?: Tecnico;
  venta_original?: VentaOriginal | null;
}

export interface ReparacionResponse {
  success: boolean;
  items: Reparacion[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface CrearReparacionDTO {
  cliente_id: string;
  tipo: 'externa' | 'garantia';
  venta_id?: string | null;
  equipo_descripcion: string;
  numero_serie_externo?: string | null;
  falla_reportada: string;
  notas?: string | null;
}

export interface ActualizarReparacionDTO {
  estado?: Reparacion['estado'];
  diagnostico_tecnico?: string | null;
  presupuesto_usd?: number | null;
  aprobado_cliente?: boolean | null;
  costo_repuestos_usd?: number;
  costo_mano_obra_usd?: number;
  precio_cobrado_usd?: number | null;
  metodo_pago?: Reparacion['metodo_pago'];
  moneda_cobro?: Reparacion['moneda_cobro'];
  tasa_cambio_aplicada?: number | null;
  tecnico_id?: string | null;
  fecha_entrega?: string | null;
  notas?: string | null;
}

export const reparacionesService = {
  async getAll(params?: {
    estado?: string;
    tipo?: 'externa' | 'garantia';
    cliente_id?: string;
    page?: number;
    limit?: number;
  }): Promise<ReparacionResponse> {
    const response = await api.get('/reparaciones', { params });
    return response.data;
  },

  async getById(id: string): Promise<{ success: boolean; data: Reparacion }> {
    const response = await api.get(`/reparaciones/${id}`);
    return response.data;
  },

  async create(data: CrearReparacionDTO): Promise<{ success: boolean; data: Reparacion }> {
    const response = await api.post('/reparaciones', data);
    return response.data;
  },

  async update(id: string, data: ActualizarReparacionDTO): Promise<{ success: boolean; data: Reparacion }> {
    const response = await api.patch(`/reparaciones/${id}`, data);
    return response.data;
  },
};
