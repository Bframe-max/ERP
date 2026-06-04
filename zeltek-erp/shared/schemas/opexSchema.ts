import { z } from 'zod';

export const opexSchema = z.object({
  concepto: z.string().min(3, { message: 'El concepto debe tener al menos 3 caracteres' }),
  moneda_original: z.enum(['USD', 'NIO']),
  monto_original: z.number().positive({ message: 'El monto debe ser positivo' }),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe estar en formato YYYY-MM-DD' }),
  categoria: z.enum(['LOGISTICA', 'MARKETING', 'HERRAMIENTAS', 'RENTA', 'SERVICIOS', 'OTRO']),
  comprobante_url: z.string().url().optional().nullable(),
  recurrente: z.boolean().default(false),
  notas: z.string().optional().nullable(),
});

export type OpexInput = z.infer<typeof opexSchema>;
