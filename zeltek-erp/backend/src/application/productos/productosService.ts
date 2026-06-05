import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../infrastructure/prisma/client';

function toNum(d: Decimal | null | undefined): number | null {
  return d ? parseFloat(d.toString()) : null;
}

export const productoSchema = z.object({
  nombre: z.string().min(1),
  marca: z.string().min(1),
  tipo: z.enum(['laptop', 'telefono', 'tablet', 'otro']).default('laptop'),
  categoria: z.string().nullable().optional(),
  especificaciones_default: z.record(z.unknown()).nullable().optional(),
  precio_venta_sugerido_usd: z.number().positive().nullable().optional(),
  notas: z.string().nullable().optional(),
});

export async function listarProductos(params: { busqueda?: string; tipo?: string; activo?: boolean }) {
  const where = {
    ...(params.activo !== undefined && { activo: params.activo }),
    ...(params.tipo && { tipo: params.tipo as 'laptop' }),
    ...(params.busqueda && {
      OR: [
        { nombre: { contains: params.busqueda, mode: 'insensitive' as const } },
        { marca: { contains: params.busqueda, mode: 'insensitive' as const } },
        { categoria: { contains: params.busqueda, mode: 'insensitive' as const } },
      ],
    }),
  };
  const items = await prisma.catalogo_productos.findMany({
    where,
    orderBy: [{ marca: 'asc' }, { nombre: 'asc' }],
  });
  return items.map(p => ({ ...p, precio_venta_sugerido_usd: toNum(p.precio_venta_sugerido_usd) }));
}

export async function crearProducto(datos: z.infer<typeof productoSchema>) {
  return prisma.catalogo_productos.create({
    data: {
      nombre: datos.nombre,
      marca: datos.marca,
      tipo: datos.tipo,
      categoria: datos.categoria ?? null,
      especificaciones_default: (datos.especificaciones_default as object) ?? undefined,
      precio_venta_sugerido_usd: datos.precio_venta_sugerido_usd ?? undefined,
      notas: datos.notas ?? null,
    },
  });
}

export async function actualizarProducto(id: string, datos: Partial<z.infer<typeof productoSchema>> & { activo?: boolean }) {
  const existe = await prisma.catalogo_productos.findUnique({ where: { id } });
  if (!existe) throw { status: 404, message: 'Producto no encontrado' };
  return prisma.catalogo_productos.update({
    where: { id },
    data: {
      ...(datos.nombre && { nombre: datos.nombre }),
      ...(datos.marca && { marca: datos.marca }),
      ...(datos.tipo && { tipo: datos.tipo }),
      ...(datos.categoria !== undefined && { categoria: datos.categoria }),
      ...(datos.especificaciones_default !== undefined && { especificaciones_default: (datos.especificaciones_default as object) ?? undefined }),
      ...(datos.precio_venta_sugerido_usd !== undefined && { precio_venta_sugerido_usd: datos.precio_venta_sugerido_usd }),
      ...(datos.activo !== undefined && { activo: datos.activo }),
      ...(datos.notas !== undefined && { notas: datos.notas }),
    },
  });
}
