import { z } from 'zod';

export const equipoSchema = z.object({
  numero_serie: z.string()
    .min(3, { message: 'El número de serie debe tener al menos 3 caracteres' })
    .toUpperCase(),
  marca: z.string().min(2, { message: 'La marca es obligatoria' }),
  modelo: z.string().min(2, { message: 'El modelo es obligatorio' }),
  tipo: z.enum(['laptop', 'telefono', 'tablet', 'otro']),
  condicion: z.enum(['NUEVO', 'SEMINUEVO']),
  inbox_id: z.string().uuid().nullable().optional(),
  inversor_id: z.string().uuid({ message: 'Debe seleccionar un inversor válido' }),
  costo_base_usd: z.number().positive({ message: 'El costo base debe ser un número positivo' }),
  requiere_cargador: z.boolean().default(true),
  procesador: z.string().optional().nullable(),
  ram_gb: z.number().int().positive().optional().nullable(),
  almacenamiento_gb: z.number().int().positive().optional().nullable(),
  tipo_almacenamiento: z.enum(['ssd_nvme', 'ssd_sata', 'hdd']).optional().nullable(),
  bateria_ciclos: z.number().int().nonnegative().optional().nullable(),
  bateria_salud_pct: z.number().int().min(0).max(100).optional().nullable(),
  notas: z.string().optional().nullable(),
});

export type EquipoInput = z.infer<typeof equipoSchema>;
