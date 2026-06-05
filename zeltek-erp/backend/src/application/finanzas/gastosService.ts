import { z } from 'zod';
import prisma from '../../infrastructure/prisma/client';
import { registrarAudit } from '../../infrastructure/audit/auditLogger';

export const gastoSchema = z.object({
  concepto: z.string().min(1),
  moneda_original: z.enum(['USD', 'NIO', 'MIXTO']).default('USD'),
  monto_original: z.number().positive(),
  tasa_cambio_aplicada: z.number().positive().nullable().optional(),
  monto_usd: z.number().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  categoria: z.enum(['LOGISTICA', 'MARKETING', 'HERRAMIENTAS', 'RENTA', 'SERVICIOS', 'OTRO']).default('OTRO'),
  comprobante_url: z.string().nullable().optional(),
  recurrente: z.boolean().default(false),
  notas: z.string().nullable().optional(),
});

export async function registrarGasto(
  datos: z.infer<typeof gastoSchema>,
  usuarioId: string,
  ip?: string,
  userAgent?: string
) {
  const fondoOpex = await prisma.fondos_financieros.findFirst({
    where: { nombre: 'OPEX' },
  });

  const gasto = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.gastos_operativos.create({
      data: {
        concepto: datos.concepto,
        moneda_original: datos.moneda_original,
        monto_original: datos.monto_original,
        tasa_cambio_aplicada: datos.tasa_cambio_aplicada ?? null,
        monto_usd: datos.monto_usd,
        fecha: new Date(datos.fecha),
        categoria: datos.categoria,
        comprobante_url: datos.comprobante_url ?? null,
        recurrente: datos.recurrente,
        notas: datos.notas ?? null,
        registrado_por: usuarioId,
      },
    });

    // RN-FIN-001: debitar del fondo OPEX (permite saldo negativo, genera alerta)
    if (fondoOpex) {
      await tx.fondos_financieros.update({
        where: { id: fondoOpex.id },
        data: { saldo_usd: { decrement: datos.monto_usd } },
      });
      await tx.historial_fondos.create({
        data: {
          fondo_id: fondoOpex.id,
          monto_usd: datos.monto_usd,
          tipo: 'egreso',
          concepto: `Gasto OPEX: ${datos.concepto}`,
        },
      });
    }

    return nuevo;
  });

  // Verificar si OPEX quedó en negativo para alerta
  const fondoActualizado = fondoOpex
    ? await prisma.fondos_financieros.findUnique({ where: { id: fondoOpex.id } })
    : null;
  const opexNegativo = fondoActualizado
    ? parseFloat(fondoActualizado.saldo_usd.toString()) < 0
    : false;

  await registrarAudit({
    usuarioId,
    accion: 'REGISTRAR_GASTO',
    tablaAfectada: 'gastos_operativos',
    registroId: gasto.id,
    valorNuevo: { concepto: datos.concepto, monto_usd: datos.monto_usd },
    ipAddress: ip,
    userAgent,
  });

  return { gasto, alerta_opex_negativo: opexNegativo };
}

export async function listarGastos(params: {
  categoria?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  limit?: number;
}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(params.categoria && { categoria: params.categoria as 'LOGISTICA' }),
    ...(params.desde && { fecha: { gte: new Date(params.desde) } }),
    ...(params.hasta && { fecha: { lte: new Date(params.hasta) } }),
  };

  const [items, total, suma] = await prisma.$transaction([
    prisma.gastos_operativos.findMany({
      where,
      include: { usuario: { select: { nombre: true } } },
      orderBy: { fecha: 'desc' },
      skip,
      take: limit,
    }),
    prisma.gastos_operativos.count({ where }),
    prisma.gastos_operativos.aggregate({ where, _sum: { monto_usd: true } }),
  ]);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      total_usd: parseFloat((suma._sum.monto_usd ?? 0).toString()),
    },
  };
}

export async function listarFondos() {
  const fondos = await prisma.fondos_financieros.findMany({
    orderBy: { nombre: 'asc' },
  });
  return fondos.map(f => ({
    ...f,
    saldo_usd: parseFloat(f.saldo_usd.toString()),
    alerta: f.nombre === 'OPEX' && parseFloat(f.saldo_usd.toString()) < 0,
  }));
}

export async function historialFondo(fondoId: string, limit = 50) {
  const fondo = await prisma.fondos_financieros.findUnique({ where: { id: fondoId } });
  if (!fondo) throw { status: 404, message: 'Fondo no encontrado' };

  const historial = await prisma.historial_fondos.findMany({
    where: { fondo_id: fondoId },
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return { fondo, historial };
}
