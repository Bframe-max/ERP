import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string()
    .email({ message: 'Debe ser un correo electrónico válido' })
    .min(5, { message: 'El correo debe tener al menos 5 caracteres' }),
  password: z.string()
    .min(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
    .regex(/[A-Z]/, { message: 'Debe contener al menos una mayúscula' })
    .regex(/[a-z]/, { message: 'Debe contener al menos una minúscula' })
    .regex(/[0-9]/, { message: 'Debe contener al menos un número' })
    .regex(/[^A-Za-z0-9]/, { message: 'Debe contener al menos un carácter especial' }),
});

export type LoginInput = z.infer<typeof loginSchema>;
