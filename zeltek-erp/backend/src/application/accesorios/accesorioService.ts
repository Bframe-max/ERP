import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../infrastructure/prisma/client';
import { registrarAudit } from '../../infrastructure/audit/auditLogger';

function toNum(d: Decimal | null | undefined): number {
  return d ? parseFloat(d.toString()) : 0;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const loteSchema = z.object({
  categoria_id: z.string().uuid(),
  descripcion: z.string().min(1),
  cantidad_total: z.number().int().positive(),
  precio_lote_usd: z.number().positive(),
  flete_lote_usd: z.number().nonnegative().default(0),
  proveedor: z.string().min(1),
  url_compra: z.string().nullable().optional(),
  inversor_id: z.string().uuid(),
  fecha_compra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().nullable().optional(),
});

export const asignarSchema = z.object({
  accesorio_id: z.string().uuid(),
  equipo_id: z.string().uuid(),
  tipo_asignacion: z.enum(['incluido', 'regalia']).default('incluido'),
});

export const venderAccesoriosSchema = z.object({
  accesorio_ids: z.array(z.string().uuid()).min(1),
  cliente_id: z.string().uuid().nullable().optional(),
  precio_venta_usd: z.number().positive(),
  moneda_cobro: z.enum(['USD', 'NIO', 'MIXTO']).default('USD'),
  monto_cobrado_nio: z.number().nonnegative().nullable().optional(),
  tasa_cambio_aplicada: z.number().positive(),
  metodo_pago: z.enum(['EFECTIVO', 'TRANSFERENCIA_BAC', 'USDT']),
});

// ─── Lotes ────────────────────────────────────────────────────────────────────

async function generarNumeroLote(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ZLT-LOT-${year}-`;
  const ultimo = await prisma.lotes_accesorios.findFirst({
    where: { numero_lote: { startsWith: prefix } },
    orderBy: { numero_lote: 'desc' },
    select: { numero_lote: true },
  });
  const num = ultimo ? parseInt(ultimo.numero_lote.split('-').pop()!, 10) + 1 : 1;
  return `${prefix}${String(num).padStart(4, '0')}`;
}

export async function crearLote(datos: z.infer<typeof loteSchema>, usuarioId: string) {
  const categoria = await prisma.categorias_accesorio.findUnique({ where: { id: datos.categoria_id } });
  if (!categoria) throw { status: 404, message: 'Categoría de accesorio no encontrada' };

  const costoUnitario = (datos.precio_lote_usd + datos.flete_lote_usd) / datos.cantidad_total;
  const numeroLote = await generarNumeroLote();

  const lote = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.lotes_accesorios.create({
      data: {
        numero_lote: numeroLote,
        categoria_id: datos.categoria_id,
        descripcion: datos.descripcion,
        cantidad_total: datos.cantidad_total,
        precio_lote_usd: datos.precio_lote_usd,
        flete_lote_usd: datos.flete_lote_usd,
        costo_unitario_real: costoUnitario,
        proveedor: datos.proveedor,
        url_compra: datos.url_compra ?? null,
        inversor_id: datos.inversor_id,
        fecha_compra: new Date(datos.fecha_compra),
        notas: datos.notas ?? null,
      },
    });

    // Crear registros de inventario individual
    await tx.accesorios_inventario.createMany({
      data: Array.from({ length: datos.cantidad_total }, () => ({
        lote_id: nuevo.id,
        categoria_id: datos.categoria_id,
        costo_unitario_usd: costoUnitario,
      })),
    });

    return nuevo;
  });

  await registrarAudit({
    usuarioId,
    accion: 'CREAR_LOTE_ACCESORIOS',
    tablaAfectada: 'lotes_accesorios',
    registroId: lote.id,
    valorNuevo: { numero_lote: numeroLote, cantidad: datos.cantidad_total, costo_unitario: costoUnitario },
  });

  return lote;
}

export async function listarLotes(categoriaId?: string) {
  const lotes = await prisma.lotes_accesorios.findMany({
    where: categoriaId ? { categoria_id: categoriaId } : undefined,
    include: {
      categoria: { select: { nombre: true } },
      inversor: { select: { nombre: true } },
      _count: { select: { inventarios: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  // Contar disponibles
  const disponiblesCount = await prisma.accesorios_inventario.groupBy({
    by: ['lote_id'],
    where: { estado: 'disponible' },
    _count: { id: true },
  });
  const dispMap = Object.fromEntries(disponiblesCount.map(d => [d.lote_id, d._count.id]));

  return lotes.map(l => ({
    ...l,
    precio_lote_usd: toNum(l.precio_lote_usd),
    flete_lote_usd: toNum(l.flete_lote_usd),
    costo_unitario_real: toNum(l.costo_unitario_real),
    disponibles: dispMap[l.id] ?? 0,
  }));
}

// ─── Inventario ───────────────────────────────────────────────────────────────

export async function listarDisponibles(categoriaId?: string) {
  return prisma.accesorios_inventario.findMany({
    where: {
      estado: 'disponible',
      ...(categoriaId && { categoria_id: categoriaId }),
    },
    include: {
      categoria: { select: { nombre: true, requiere_asignacion_equipo: true } },
      lote: { select: { numero_lote: true, descripcion: true } },
    },
    orderBy: { created_at: 'asc' },
  });
}

// ─── Asignación a equipo ──────────────────────────────────────────────────────

export async function asignarAccesorio(
  datos: z.infer<typeof asignarSchema>,
  usuarioId: string
) {
  const accesorio = await prisma.accesorios_inventario.findUnique({
    where: { id: datos.accesorio_id },
    include: { categoria: true },
  });
  if (!accesorio) throw { status: 404, message: 'Accesorio no encontrado' };
  if (accesorio.estado !== 'disponible') {
    throw { status: 400, message: `Accesorio no está disponible (estado: ${accesorio.estado})` };
  }

  const equipo = await prisma.equipos.findFirst({
    where: { id: datos.equipo_id, deleted_at: null },
  });
  if (!equipo) throw { status: 404, message: 'Equipo no encontrado' };

  const actualizado = await prisma.$transaction(async (tx) => {
    const acc = await tx.accesorios_inventario.update({
      where: { id: datos.accesorio_id },
      data: {
        estado: 'asignado_equipo',
        tipo_asignacion: datos.tipo_asignacion,
        equipo_asignado_id: datos.equipo_id,
      },
    });

    // Actualizar CTR del equipo: suma el costo del accesorio
    await tx.equipos.update({
      where: { id: datos.equipo_id },
      data: {
        costo_accesorios_usd: { increment: toNum(accesorio.costo_unitario_usd) },
        ctr_usd: { increment: toNum(accesorio.costo_unitario_usd) },
      },
    });

    return acc;
  });

  await registrarAudit({
    usuarioId,
    accion: 'ASIGNAR_ACCESORIO',
    tablaAfectada: 'accesorios_inventario',
    registroId: datos.accesorio_id,
    valorNuevo: { equipo_id: datos.equipo_id, tipo: datos.tipo_asignacion },
  });

  return actualizado;
}

export async function desasignarAccesorio(accesorioId: string, usuarioId: string) {
  const accesorio = await prisma.accesorios_inventario.findUnique({ where: { id: accesorioId } });
  if (!accesorio) throw { status: 404, message: 'Accesorio no encontrado' };
  if (accesorio.estado !== 'asignado_equipo') {
    throw { status: 400, message: 'Accesorio no está asignado a ningún equipo' };
  }

  const actualizado = await prisma.$transaction(async (tx) => {
    const acc = await tx.accesorios_inventario.update({
      where: { id: accesorioId },
      data: { estado: 'disponible', tipo_asignacion: null, equipo_asignado_id: null },
    });

    if (accesorio.equipo_asignado_id) {
      await tx.equipos.update({
        where: { id: accesorio.equipo_asignado_id },
        data: {
          costo_accesorios_usd: { decrement: toNum(accesorio.costo_unitario_usd) },
          ctr_usd: { decrement: toNum(accesorio.costo_unitario_usd) },
        },
      });
    }

    return acc;
  });

  await registrarAudit({
    usuarioId,
    accion: 'DESASIGNAR_ACCESORIO',
    tablaAfectada: 'accesorios_inventario',
    registroId: accesorioId,
    valorNuevo: { equipo_id: accesorio.equipo_asignado_id },
  });

  return actualizado;
}

// ─── Venta suelta de accesorios ───────────────────────────────────────────────

async function generarNumeroVentaAccesorio(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ZLT-ACC-${year}-`;
  const ultima = await prisma.ventas_accesorios.findFirst({
    where: { numero_factura: { startsWith: prefix } },
    orderBy: { numero_factura: 'desc' },
    select: { numero_factura: true },
  });
  const num = ultima ? parseInt(ultima.numero_factura.split('-').pop()!, 10) + 1 : 1;
  return `${prefix}${String(num).padStart(4, '0')}`;
}

export async function venderAccesorios(
  datos: z.infer<typeof venderAccesoriosSchema>,
  vendedorId: string
) {
  const accesorios = await prisma.accesorios_inventario.findMany({
    where: { id: { in: datos.accesorio_ids }, estado: 'disponible' },
  });

  if (accesorios.length !== datos.accesorio_ids.length) {
    throw { status: 400, message: 'Uno o más accesorios no están disponibles para venta' };
  }

  const numeroFactura = await generarNumeroVentaAccesorio();

  const venta = await prisma.$transaction(async (tx) => {
    const nueva = await tx.ventas_accesorios.create({
      data: {
        numero_factura: numeroFactura,
        cliente_id: datos.cliente_id ?? null,
        precio_venta_usd: datos.precio_venta_usd,
        monto_cobrado_nio: datos.monto_cobrado_nio ?? null,
        tasa_cambio_aplicada: datos.tasa_cambio_aplicada,
        moneda_cobro: datos.moneda_cobro,
        metodo_pago: datos.metodo_pago,
        vendedor_id: vendedorId,
      },
    });

    await tx.accesorios_inventario.updateMany({
      where: { id: { in: datos.accesorio_ids } },
      data: { estado: 'vendido', venta_accesorio_id: nueva.id },
    });

    return nueva;
  });

  await registrarAudit({
    usuarioId: vendedorId,
    accion: 'VENDER_ACCESORIO',
    tablaAfectada: 'ventas_accesorios',
    registroId: venta.id,
    valorNuevo: { numero_factura: numeroFactura, cantidad: datos.accesorio_ids.length },
  });

  return venta;
}

// ─── Historial de ventas de accesorios ────────────────────────────────────────

export async function listarAccesoriosVendidos() {
  const vendidos = await prisma.accesorios_inventario.findMany({
    where: { estado: 'vendido' },
    include: {
      categoria: { select: { nombre: true } },
      venta_accesorio: {
        include: { cliente: { select: { nombre: true } } },
      },
    },
    orderBy: { updated_at: 'desc' },
  });

  return vendidos.map(a => ({
    id: a.id,
    categoria: a.categoria,
    costo_unitario_usd: toNum(a.costo_unitario_usd),
    venta: a.venta_accesorio ? {
      numero_factura: a.venta_accesorio.numero_factura,
      precio_venta_usd: toNum(a.venta_accesorio.precio_venta_usd),
      fecha_venta: a.venta_accesorio.fecha_venta,
      cliente: a.venta_accesorio.cliente?.nombre ?? null,
    } : null,
  }));
}

// ─── Categorías ───────────────────────────────────────────────────────────────

export async function listarCategorias() {
  return prisma.categorias_accesorio.findMany({ orderBy: { nombre: 'asc' } });
}
