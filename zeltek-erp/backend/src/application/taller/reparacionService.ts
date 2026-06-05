import { z } from 'zod';
import prisma from '../../infrastructure/prisma/client';
import { registrarAudit } from '../../infrastructure/audit/auditLogger';

export const crearReparacionSchema = z.object({
  cliente_id: z.string().uuid(),
  tipo: z.enum(['externa', 'garantia']).default('externa'),
  venta_id: z.string().uuid().nullable().optional(),
  equipo_descripcion: z.string().min(1),
  numero_serie_externo: z.string().nullable().optional(),
  falla_reportada: z.string().min(1),
  notas: z.string().nullable().optional(),
});

export const actualizarReparacionSchema = z.object({
  diagnostico_tecnico: z.string().nullable().optional(),
  estado: z.enum(['RECIBIDO', 'EN_DIAGNOSTICO', 'PRESUPUESTADO', 'EN_REPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO']).optional(),
  presupuesto_usd: z.number().nonnegative().nullable().optional(),
  aprobado_cliente: z.boolean().nullable().optional(),
  costo_repuestos_usd: z.number().nonnegative().optional(),
  costo_mano_obra_usd: z.number().nonnegative().optional(),
  precio_cobrado_usd: z.number().nonnegative().nullable().optional(),
  metodo_pago: z.enum(['EFECTIVO', 'TRANSFERENCIA_BAC', 'USDT']).nullable().optional(),
  moneda_cobro: z.enum(['USD', 'NIO', 'MIXTO']).nullable().optional(),
  tasa_cambio_aplicada: z.number().nonnegative().nullable().optional(),
  tecnico_id: z.string().uuid().nullable().optional(),
  fecha_entrega: z.string().datetime().nullable().optional(),
  notas: z.string().nullable().optional(),
});

async function generarNumeroOrden(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ZLT-REP-${year}-`;
  const ultima = await prisma.ordenes_reparacion.findFirst({
    where: { numero_orden: { startsWith: prefix } },
    orderBy: { numero_orden: 'desc' },
    select: { numero_orden: true },
  });
  const num = ultima
    ? parseInt(ultima.numero_orden.split('-').pop()!, 10) + 1
    : 1;
  return `${prefix}${String(num).padStart(4, '0')}`;
}

export async function crearReparacion(
  datos: z.infer<typeof crearReparacionSchema>,
  usuarioId: string,
  ip?: string,
  userAgent?: string
) {
  const cliente = await prisma.clientes.findUnique({ where: { id: datos.cliente_id } });
  if (!cliente) throw { status: 404, message: 'Cliente no encontrado' };

  if (datos.tipo === 'garantia' && !datos.venta_id) {
    throw { status: 400, message: 'Las reparaciones de garantía requieren venta_id' };
  }

  const numeroOrden = await generarNumeroOrden();

  const orden = await prisma.ordenes_reparacion.create({
    data: {
      numero_orden: numeroOrden,
      cliente_id: datos.cliente_id,
      tipo: datos.tipo,
      venta_id: datos.venta_id ?? null,
      equipo_descripcion: datos.equipo_descripcion,
      numero_serie_externo: datos.numero_serie_externo ?? null,
      falla_reportada: datos.falla_reportada,
      notas: datos.notas ?? null,
      costo_total_usd: 0,
    },
  });

  await registrarAudit({
    usuarioId,
    accion: 'CREAR_REPARACION',
    tablaAfectada: 'ordenes_reparacion',
    registroId: orden.id,
    valorNuevo: { numero_orden: numeroOrden, tipo: datos.tipo },
    ipAddress: ip,
    userAgent,
  });

  return orden;
}

export async function listarReparaciones(params: {
  estado?: string;
  tipo?: 'externa' | 'garantia';
  cliente_id?: string;
  page?: number;
  limit?: number;
}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(params.estado && { estado: params.estado as 'RECIBIDO' }),
    ...(params.tipo && { tipo: params.tipo }),
    ...(params.cliente_id && { cliente_id: params.cliente_id }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.ordenes_reparacion.findMany({
      where,
      include: {
        cliente: { select: { nombre: true, telefono: true } },
        tecnico: { select: { nombre: true } },
        venta_original: {
          select: { numero_garantia: true, equipo: { select: { marca: true, modelo: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.ordenes_reparacion.count({ where }),
  ]);

  return { items, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

export async function obtenerReparacion(id: string) {
  const orden = await prisma.ordenes_reparacion.findUnique({
    where: { id },
    include: {
      cliente: true,
      tecnico: { select: { id: true, nombre: true } },
      venta_original: {
        include: { equipo: { select: { marca: true, modelo: true, numero_serie: true } } },
      },
    },
  });
  if (!orden) throw { status: 404, message: 'Orden de reparación no encontrada' };
  return orden;
}

export async function actualizarReparacion(
  id: string,
  datos: z.infer<typeof actualizarReparacionSchema>,
  usuarioId: string,
  ip?: string,
  userAgent?: string
) {
  const orden = await prisma.ordenes_reparacion.findUnique({ where: { id } });
  if (!orden) throw { status: 404, message: 'Orden no encontrada' };

  if (orden.estado === 'ENTREGADO' || orden.estado === 'CANCELADO') {
    throw { status: 400, message: `No se puede modificar una orden en estado ${orden.estado}` };
  }

  const costoTotal = (datos.costo_repuestos_usd ?? 0) + (datos.costo_mano_obra_usd ?? 0);
  const fechaEntrega = datos.fecha_entrega ? new Date(datos.fecha_entrega) : undefined;
  const fechaDiagnostico = datos.estado === 'EN_DIAGNOSTICO' ? new Date() : undefined;

  const actualizada = await prisma.ordenes_reparacion.update({
    where: { id },
    data: {
      ...datos,
      fecha_entrega: fechaEntrega,
      fecha_diagnostico: fechaDiagnostico,
      costo_total_usd: costoTotal > 0 ? costoTotal : orden.costo_total_usd,
    },
  });

  await registrarAudit({
    usuarioId,
    accion: 'CAMBIO_ESTADO_REPARACION',
    tablaAfectada: 'ordenes_reparacion',
    registroId: id,
    valorAnterior: { estado: orden.estado },
    valorNuevo: { estado: datos.estado, ...datos },
    ipAddress: ip,
    userAgent,
  });

  return actualizada;
}
