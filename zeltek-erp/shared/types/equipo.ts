export type EstadoEquipo =
  | 'COMPRADO'
  | 'EN_BODEGA_MIAMI'
  | 'EN_TRANSITO'
  | 'EN_TALLER'
  | 'DISPONIBLE'
  | 'VENDIDO'
  | 'EN_RECLAMO'
  | 'DEVUELTO';

export type TipoEquipo = 'laptop' | 'telefono' | 'tablet' | 'otro';
export type CondicionEquipo = 'NUEVO' | 'SEMINUEVO';
export type TipoEnvio = 'aereo' | 'maritimo';
export type OrigenDato = 'SISTEMA' | 'MIGRACION';

export interface Equipo {
  id: string;
  numero_serie: string;
  inbox_id: string | null;
  inversor_id: string;
  marca: string;
  modelo: string;
  tipo: TipoEquipo;
  condicion: CondicionEquipo;
  procesador: string | null;
  ram_gb: number | null;
  almacenamiento_gb: number | null;
  tipo_almacenamiento: string | null;
  bateria_ciclos: number | null;
  bateria_salud_pct: number | null;
  estado: EstadoEquipo;
  costo_base_usd: number;
  peso_real_libras: number | null;
  tipo_envio: TipoEnvio;
  costo_logistico_usd: number | null;
  costo_acondicionamiento_usd: number;
  reembolso_parcial_usd: number;
  ctr_usd: number;
  precio_venta_sugerido_usd: number;
  precio_venta_usd: number | null;
  visible_en_inventario: boolean;
  requiere_cargador: boolean;
  costo_accesorios_usd: number;
  origen: OrigenDato;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
