import { z } from 'zod';

export const checkoutSchema = z.object({
  cliente_id: z.string().uuid({ message: 'Debe seleccionar un cliente válido' }),
  precio_venta_usd: z.number().positive({ message: 'El precio de venta debe ser mayor a 0' }),
  moneda_cobro: z.enum(['USD', 'NIO', 'MIXTO']),
  monto_cobrado_nio: z.number().nonnegative().optional().nullable(),
  monto_cobrado_usd_parte: z.number().nonnegative().optional().nullable(),
  metodo_pago: z.enum(['EFECTIVO', 'TRANSFERENCIA_BAC', 'USDT']),
  referencia_pago: z.string().optional().nullable(),
  evidencia_entrega_url: z.string().url({ message: 'La foto de evidencia de entrega es obligatoria' }),
  justificacion_precio: z.string().optional().nullable(),
}).refine((data) => {
  if (data.metodo_pago === 'TRANSFERENCIA_BAC' || data.metodo_pago === 'USDT') {
    return data.referencia_pago && data.referencia_pago.trim().length > 0;
  }
  return true;
}, {
  message: 'La referencia de pago es obligatoria para transferencias y USDT',
  path: ['referencia_pago'],
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
