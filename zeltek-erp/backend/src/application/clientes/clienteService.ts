import { z } from 'zod';
import prisma from '../../infrastructure/prisma/client';

export const clienteSchema = z.object({
  nombre: z.string().min(1),
  telefono: z.string().min(1),
  whatsapp: z.string().nullable().optional(),
  cedula: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  tipo_cliente: z.enum(['PERSONA_NATURAL', 'EMPRESA']).default('PERSONA_NATURAL'),
  nombre_empresa: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
});

export async function listarClientes(busqueda?: string) {
  const where = busqueda
    ? {
        OR: [
          { nombre: { contains: busqueda, mode: 'insensitive' as const } },
          { telefono: { contains: busqueda } },
          { cedula: { contains: busqueda } },
          { email: { contains: busqueda, mode: 'insensitive' as const } },
        ],
      }
    : {};

  return prisma.clientes.findMany({
    where,
    include: { _count: { select: { ventas: true } } },
    orderBy: { nombre: 'asc' },
    take: 50,
  });
}

export async function obtenerCliente(id: string) {
  const cliente = await prisma.clientes.findUnique({
    where: { id },
    include: {
      ventas: {
        include: { equipo: { select: { marca: true, modelo: true } } },
        orderBy: { fecha_venta: 'desc' },
      },
    },
  });
  if (!cliente) throw { status: 404, message: 'Cliente no encontrado' };
  return cliente;
}

export async function crearCliente(data: z.infer<typeof clienteSchema>) {
  return prisma.clientes.create({ data });
}

export async function actualizarCliente(id: string, data: Partial<z.infer<typeof clienteSchema>>) {
  const existe = await prisma.clientes.findUnique({ where: { id } });
  if (!existe) throw { status: 404, message: 'Cliente no encontrado' };
  return prisma.clientes.update({ where: { id }, data });
}
