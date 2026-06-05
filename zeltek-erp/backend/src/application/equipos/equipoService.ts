import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../infrastructure/prisma/client';
import { EquipoStateMachine, EquipoStateMachineError } from '../../domain/equipos/EquipoStateMachine';
import { registrarAudit } from '../../infrastructure/audit/auditLogger';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const actualizarEquipoSchema = z.object({
  marca: z.string().min(1).optional(),
  modelo: z.string().min(1).optional(),
  procesador: z.string().nullable().optional(),
  ram_gb: z.number().int().positive().nullable().optional(),
  almacenamiento_gb: z.number().int().positive().nullable().optional(),
  tipo_almacenamiento: z.string().nullable().optional(),
  bateria_ciclos: z.number().int().nonnegative().nullable().optional(),
  bateria_salud_pct: z.number().int().min(0).max(100).nullable().optional(),
  peso_real_libras: z.number().positive().nullable().optional(),
  tipo_envio: z.enum(['aereo', 'maritimo']).nullable().optional(),
  costo_logistico_usd: z.number().nonnegative().nullable().optional(),
  costo_acondicionamiento_usd: z.number().nonnegative().optional(),
  reembolso_parcial_usd: z.number().nonnegative().optional(),
  precio_venta_usd: z.number().positive().nullable().optional(),
  precio_venta_sugerido_usd: z.number().positive().optional(),
  visible_en_inventario: z.boolean().optional(),
  requiere_cargador: z.boolean().optional(),
  notas_resolucion: z.string().nullable().optional(),
});

export const cambiarEstadoSchema = z.object({
  estado_nuevo: z.enum([
    'COMPRADO', 'EN_BODEGA_MIAMI', 'EN_TRANSITO',
    'EN_TALLER', 'DISPONIBLE', 'VENDIDO', 'EN_RECLAMO', 'DEVUELTO',
  ]),
  notas: z.string().optional().nullable(),
  // Para EN_RECLAMO
  estado_incidencia: z.enum(['DISPUTA_ABIERTA', 'RESUELTO']).optional().nullable(),
  plataforma_disputa: z.enum(['PAYPAL', 'EBAY', 'OTRO']).optional().nullable(),
  notas_resolucion: z.string().optional().nullable(),
});

export const filtrosEquipoSchema = z.object({
  estado: z.enum([
    'COMPRADO', 'EN_BODEGA_MIAMI', 'EN_TRANSITO',
    'EN_TALLER', 'DISPONIBLE', 'VENDIDO', 'EN_RECLAMO', 'DEVUELTO',
  ]).optional(),
  inversor_id: z.string().uuid().optional(),
  marca: z.string().optional(),
  tipo: z.enum(['laptop', 'telefono', 'tablet', 'otro']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcularCTR(params: {
  costo_base: number;
  costo_logistico?: number | null;
  costo_acondicionamiento?: number;
  costo_accesorios?: number;
  reembolso?: number;
}): number {
  return (
    params.costo_base +
    (params.costo_logistico ?? 0) +
    (params.costo_acondicionamiento ?? 0) +
    (params.costo_accesorios ?? 0) -
    (params.reembolso ?? 0)
  );
}

function toNumber(d: Decimal | null | undefined): number {
  return d ? parseFloat(d.toString()) : 0;
}

// ─── Listar ───────────────────────────────────────────────────────────────────

export async function listarEquipos(filtros: z.infer<typeof filtrosEquipoSchema>) {
  const { estado, inversor_id, marca, tipo, page, limit } = filtros;
  const skip = (page - 1) * limit;

  const where = {
    deleted_at: null,
    ...(estado && { estado }),
    ...(inversor_id && { inversor_id }),
    ...(marca && { marca: { contains: marca, mode: 'insensitive' as const } }),
    ...(tipo && { tipo }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.equipos.findMany({
      where,
      include: {
        inversor: { select: { id: true, nombre: true } },
        inbox: { select: { nombre_articulo: true, fuente: true } },
        _count: { select: { accesorios_asignados: true } },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.equipos.count({ where }),
  ]);

  return {
    items,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// ─── Disponibles ──────────────────────────────────────────────────────────────

export async function listarDisponibles() {
  const equipos = await prisma.equipos.findMany({
    where: { estado: 'DISPONIBLE', deleted_at: null, visible_en_inventario: true },
    include: {
      inversor: { select: { id: true, nombre: true, porcentaje_ganancia: true } },
      accesorios_asignados: {
        where: { estado: 'asignado_equipo' },
        include: { categoria: { select: { nombre: true } } },
      },
    },
    orderBy: { updated_at: 'desc' },
  });

  return equipos.map(e => ({
    ...e,
    ganancia_estimada_usd: toNumber(e.precio_venta_sugerido_usd) - toNumber(e.ctr_usd),
    margen_pct: toNumber(e.ctr_usd) > 0
      ? ((toNumber(e.precio_venta_sugerido_usd) - toNumber(e.ctr_usd)) / toNumber(e.ctr_usd) * 100).toFixed(1)
      : null,
  }));
}

// ─── Detalle ──────────────────────────────────────────────────────────────────

export async function obtenerEquipo(id: string) {
  const equipo = await prisma.equipos.findFirst({
    where: { id, deleted_at: null },
    include: {
      inversor: { select: { id: true, nombre: true, porcentaje_ganancia: true } },
      inbox: true,
      historial_estados: {
        include: { usuario: { select: { id: true, nombre: true } } },
        orderBy: { created_at: 'desc' },
      },
      accesorios_asignados: {
        where: { estado: { in: ['asignado_equipo', 'disponible'] } },
        include: { categoria: { select: { nombre: true } } },
      },
      ventas: { select: { id: true, numero_factura: true, fecha_venta: true } },
    },
  });

  if (!equipo) throw { status: 404, message: 'Equipo no encontrado' };
  return equipo;
}

// ─── Buscar por serie ─────────────────────────────────────────────────────────

export async function buscarPorSerie(numeroSerie: string) {
  const equipo = await prisma.equipos.findFirst({
    where: { numero_serie: numeroSerie, deleted_at: null },
    include: { inversor: { select: { id: true, nombre: true } } },
  });
  if (!equipo) throw { status: 404, message: `Equipo con serie "${numeroSerie}" no encontrado` };
  return equipo;
}

// ─── Actualizar ───────────────────────────────────────────────────────────────

export async function actualizarEquipo(
  id: string,
  datos: z.infer<typeof actualizarEquipoSchema>,
  usuarioId: string,
  ip?: string,
  userAgent?: string
) {
  const equipo = await prisma.equipos.findFirst({ where: { id, deleted_at: null } });
  if (!equipo) throw { status: 404, message: 'Equipo no encontrado' };

  // Recalcular CTR si cambiaron costos relevantes
  const costoLogistico = datos.costo_logistico_usd !== undefined
    ? (datos.costo_logistico_usd ?? 0)
    : toNumber(equipo.costo_logistico_usd);

  const costoAcondicionamiento = datos.costo_acondicionamiento_usd !== undefined
    ? datos.costo_acondicionamiento_usd
    : toNumber(equipo.costo_acondicionamiento_usd);

  const reembolso = datos.reembolso_parcial_usd !== undefined
    ? datos.reembolso_parcial_usd
    : toNumber(equipo.reembolso_parcial_usd);

  const nuevoCTR = calcularCTR({
    costo_base: toNumber(equipo.costo_base_usd),
    costo_logistico: costoLogistico,
    costo_acondicionamiento: costoAcondicionamiento,
    costo_accesorios: toNumber(equipo.costo_accesorios_usd),
    reembolso,
  });

  const actualizado = await prisma.equipos.update({
    where: { id },
    data: {
      ...datos,
      ctr_usd: nuevoCTR,
    },
  });

  await registrarAudit({
    usuarioId,
    accion: 'EDITAR_CTR',
    tablaAfectada: 'equipos',
    registroId: id,
    valorAnterior: { ctr_usd: equipo.ctr_usd },
    valorNuevo: { ctr_usd: nuevoCTR, ...datos },
    ipAddress: ip,
    userAgent,
  });

  return actualizado;
}

// ─── Cambiar estado (via StateMachine) ───────────────────────────────────────

export async function cambiarEstado(
  id: string,
  datos: z.infer<typeof cambiarEstadoSchema>,
  usuarioId: string,
  ip?: string,
  userAgent?: string
) {
  const equipo = await prisma.equipos.findFirst({
    where: { id, deleted_at: null },
    include: {
      accesorios_asignados: {
        where: { estado: 'asignado_equipo', categoria: { requiere_asignacion_equipo: true } },
      },
    },
  });

  if (!equipo) throw { status: 404, message: 'Equipo no encontrado' };

  const estadoActual = equipo.estado;
  const estadoNuevo = datos.estado_nuevo;

  try {
    EquipoStateMachine.validarTransicion(estadoActual, estadoNuevo);

    // RN-STATE-001: validaciones adicionales para EN_TALLER → DISPONIBLE
    if (estadoActual === 'EN_TALLER' && estadoNuevo === 'DISPONIBLE') {
      EquipoStateMachine.validarDisponible({
        peso_real_libras: toNumber(equipo.peso_real_libras) || null,
        foto_urls: equipo.foto_urls,
        requiere_cargador: equipo.requiere_cargador,
        tiene_cargador_asignado: equipo.accesorios_asignados.length > 0,
      });
    }
  } catch (err) {
    if (err instanceof EquipoStateMachineError) {
      throw { status: 422, message: err.message };
    }
    throw err;
  }

  const [actualizado] = await prisma.$transaction([
    prisma.equipos.update({
      where: { id },
      data: {
        estado: estadoNuevo,
        ...(datos.estado_incidencia && { estado_incidencia: datos.estado_incidencia }),
        ...(datos.plataforma_disputa && { plataforma_disputa: datos.plataforma_disputa }),
        ...(datos.notas_resolucion !== undefined && { notas_resolucion: datos.notas_resolucion }),
      },
    }),
    prisma.historial_estados.create({
      data: {
        equipo_id: id,
        estado_anterior: estadoActual,
        estado_nuevo: estadoNuevo,
        notas: datos.notas ?? null,
        usuario_id: usuarioId,
      },
    }),
  ]);

  await registrarAudit({
    usuarioId,
    accion: 'CAMBIO_ESTADO',
    tablaAfectada: 'equipos',
    registroId: id,
    campoModificado: 'estado',
    valorAnterior: { estado: estadoActual },
    valorNuevo: { estado: estadoNuevo, notas: datos.notas },
    ipAddress: ip,
    userAgent,
  });

  return actualizado;
}
