export type TipoCliente = 'PERSONA_NATURAL' | 'EMPRESA';

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  whatsapp: string | null;
  cedula: string | null;
  email: string | null;
  tipo_cliente: TipoCliente;
  nombre_empresa: string | null;
  total_compras: number;
  valor_total_comprado_usd: number;
  notas: string | null;
  created_at: string;
}
