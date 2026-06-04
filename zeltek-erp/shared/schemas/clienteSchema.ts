import { z } from 'zod';

export const clienteSchema = z.object({
  nombre: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres' }),
  telefono: z.string().min(8, { message: 'Número de teléfono inválido (mínimo 8 dígitos)' }),
  whatsapp: z.string().optional().nullable(),
  cedula: z.string()
    .regex(/^[0-9]{3}-[0-9]{6}-[0-9]{4}[A-Z]$/, {
      message: 'Formato de cédula nicaragüense inválido (ej: 001-250596-0002A)',
    })
    .optional().nullable(),
  email: z.string().email({ message: 'Correo inválido' }).optional().nullable(),
  tipo_cliente: z.enum(['PERSONA_NATURAL', 'EMPRESA']).default('PERSONA_NATURAL'),
  nombre_empresa: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

export type ClienteInput = z.infer<typeof clienteSchema>;
