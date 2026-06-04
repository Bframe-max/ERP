import { z } from 'zod';

export const reparacionSchema = z.object({
  cliente_id: z.string().uuid({ message: 'Cliente inválido' }),
  tipo: z.enum(['externa', 'garantia']),
  venta_id: z.string().uuid().optional().nullable(),
  equipo_descripcion: z.string().min(5, { message: 'Debe describir la marca, modelo y specs del equipo' }),
  numero_serie_externo: z.string().optional().nullable(),
  falla_reportada: z.string().min(10, { message: 'Describa detalladamente la falla (mínimo 10 caracteres)' }),
  tecnico_id: z.string().uuid().optional().nullable(),
  notas: z.string().optional().nullable(),
}).refine((data) => {
  if (data.tipo === 'garantia') {
    return data.venta_id && data.venta_id.trim().length > 0;
  }
  return true;
}, {
  message: 'Para reparaciones de garantía se debe vincular la venta original',
  path: ['venta_id'],
});

export type ReparacionInput = z.infer<typeof reparacionSchema>;
