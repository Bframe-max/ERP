import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../infrastructure/prisma/client';

function toNum(d: Decimal | null | undefined): number {
  return d ? parseFloat(d.toString()) : 0;
}

export const reporteVentasSchema = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendedor_id: z.string().uuid().optional(),
});

export const estadoCuentaSchema = z.object({
  inversor_id: z.string().uuid(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function reporteVentas(params: z.infer<typeof reporteVentasSchema>) {
  const where = {
    fecha_venta: {
      gte: new Date(params.desde),
      lte: new Date(params.hasta + 'T23:59:59Z'),
    },
    ...(params.vendedor_id && { vendedor_id: params.vendedor_id }),
  };

  const [ventas, resumen, inversores] = await Promise.all([
    prisma.ventas.findMany({
      where,
      include: {
        equipo: { select: { marca: true, modelo: true, numero_serie: true, condicion: true } },
        cliente: { select: { nombre: true, cedula: true } },
        vendedor: { select: { nombre: true } },
      },
      orderBy: { fecha_venta: 'asc' },
    }),
    prisma.ventas.aggregate({
      where,
      _count: { id: true },
      _sum: {
        precio_venta_usd: true,
        ctr_al_momento_usd: true,
        ganancia_bruta_venta_usd: true,
        pf_monto_ganancia_usd: true,
        pf_monto_garantias_usd: true,
        pf_monto_opex_usd: true,
        pf_monto_reparto_usd: true,
      },
    }),
    prisma.inversores.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, porcentaje_ganancia: true },
      orderBy: { nombre: 'asc' },
    }),
  ]);

  return {
    periodo: { desde: params.desde, hasta: params.hasta },
    resumen: {
      cantidad_ventas: resumen._count.id,
      ingresos_usd: toNum(resumen._sum.precio_venta_usd),
      ctr_total_usd: toNum(resumen._sum.ctr_al_momento_usd),
      ganancia_bruta_usd: toNum(resumen._sum.ganancia_bruta_venta_usd),
      pf_ganancia_usd: toNum(resumen._sum.pf_monto_ganancia_usd),
      pf_garantias_usd: toNum(resumen._sum.pf_monto_garantias_usd),
      pf_opex_usd: toNum(resumen._sum.pf_monto_opex_usd),
      pf_reparto_usd: toNum(resumen._sum.pf_monto_reparto_usd),
    },
    inversores: inversores.map(i => ({
      id: i.id,
      nombre: i.nombre,
      porcentaje: toNum(i.porcentaje_ganancia),
    })),
    ventas: ventas.map(v => ({
      ...v,
      precio_venta_usd: toNum(v.precio_venta_usd),
      ctr_al_momento_usd: toNum(v.ctr_al_momento_usd),
      ganancia_bruta_venta_usd: toNum(v.ganancia_bruta_venta_usd),
      pf_monto_opex_usd: toNum(v.pf_monto_opex_usd),
      pf_monto_garantias_usd: toNum(v.pf_monto_garantias_usd),
      pf_monto_ganancia_usd: toNum(v.pf_monto_ganancia_usd),
      pf_monto_reparto_usd: toNum(v.pf_monto_reparto_usd),
      pf_tap_opex_aplicado: toNum(v.pf_tap_opex_aplicado),
      pf_tap_garantias_aplicado: toNum(v.pf_tap_garantias_aplicado),
      pf_tap_ganancia_aplicado: toNum(v.pf_tap_ganancia_aplicado),
    })),
  };
}

export async function estadoCuentaInversor(params: z.infer<typeof estadoCuentaSchema>) {
  const inversor = await prisma.inversores.findUnique({ where: { id: params.inversor_id } });
  if (!inversor) throw { status: 404, message: 'Inversor no encontrado' };

  const fechaDesde = new Date(params.desde);
  const fechaHasta = new Date(params.hasta + 'T23:59:59Z');

  const [equipos, ventas, gastosPeriodo, perdidas, reintegros] = await Promise.all([
    prisma.equipos.findMany({
      where: { inversor_id: params.inversor_id, deleted_at: null },
      select: {
        id: true, marca: true, modelo: true, numero_serie: true,
        estado: true, ctr_usd: true, created_at: true,
      },
    }),
    prisma.ventas.findMany({
      where: {
        equipo: { inversor_id: params.inversor_id },
        fecha_venta: { gte: fechaDesde, lte: fechaHasta },
      },
      include: {
        equipo: { select: { marca: true, modelo: true } },
        cliente: { select: { nombre: true } },
      },
      orderBy: { fecha_venta: 'asc' },
    }),
    prisma.gastos_operativos.aggregate({
      where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
      _sum: { monto_usd: true },
    }),
    prisma.perdidas_capital.findMany({
      where: { inversor_id: params.inversor_id },
    }),
    prisma.reintegros_capital.findMany({
      where: {
        inversor_id: params.inversor_id,
        mes_aplicado: { gte: fechaDesde, lte: fechaHasta },
      },
    }),
  ]);

  const pctInversor = toNum(inversor.porcentaje_ganancia);
  const capitalTotal = equipos.reduce((s, e) => s + toNum(e.ctr_usd), 0);
  const capitalEnInventario = equipos
    .filter(e => e.estado !== 'VENDIDO')
    .reduce((s, e) => s + toNum(e.ctr_usd), 0);

  const ventasSummary = ventas.reduce(
    (acc, v) => {
      acc.ingresos += toNum(v.precio_venta_usd);
      acc.ctr += toNum(v.ctr_al_momento_usd);
      acc.ganancia_bruta += toNum(v.ganancia_bruta_venta_usd);
      acc.ganancia_inversor += toNum(v.ganancia_bruta_venta_usd) * pctInversor / 100;
      acc.capital_retornado += toNum(v.capital_retorno_inversor_usd);
      return acc;
    },
    { ingresos: 0, ctr: 0, ganancia_bruta: 0, ganancia_inversor: 0, capital_retornado: 0 }
  );

  const totalPerdido = perdidas.reduce((s, p) => s + toNum(p.monto_perdido_usd), 0);
  const totalReintegrado = reintegros.reduce((s, r) => s + toNum(r.monto_usd), 0);

  return {
    inversor: { ...inversor, porcentaje_ganancia: pctInversor },
    periodo: { desde: params.desde, hasta: params.hasta },
    resumen: {
      capital_total_usd: capitalTotal,
      capital_en_inventario_usd: capitalEnInventario,
      capital_retornado_usd: ventasSummary.capital_retornado,
      ganancia_inversor_periodo_usd: ventasSummary.ganancia_inversor,
      ventas_cantidad: ventas.length,
      ventas_ingresos_usd: ventasSummary.ingresos,
      opex_periodo_usd: toNum(gastosPeriodo._sum.monto_usd),
      perdidas_capital_usd: totalPerdido,
      reintegros_periodo_usd: totalReintegrado,
    },
    equipos,
    ventas: ventas.map(v => ({
      numero_factura: v.numero_factura,
      fecha_venta: v.fecha_venta,
      equipo: v.equipo,
      cliente: v.cliente,
      precio_venta_usd: toNum(v.precio_venta_usd),
      ctr_usd: toNum(v.ctr_al_momento_usd),
      ganancia_bruta_usd: toNum(v.ganancia_bruta_venta_usd),
      ganancia_inversor_usd: toNum(v.ganancia_bruta_venta_usd) * pctInversor / 100,
      reparto_liquidado: v.reparto_liquidado,
    })),
  };
}

export async function reporteOpex(params: { desde: string; hasta: string }) {
  const where = {
    fecha: {
      gte: new Date(params.desde),
      lte: new Date(params.hasta + 'T23:59:59Z'),
    },
  };

  const [gastos, porCategoria, resumen] = await Promise.all([
    prisma.gastos_operativos.findMany({
      where,
      include: { usuario: { select: { nombre: true } } },
      orderBy: { fecha: 'asc' },
    }),
    prisma.gastos_operativos.groupBy({
      by: ['categoria'],
      where,
      _sum: { monto_usd: true },
      _count: { id: true },
      orderBy: { categoria: 'asc' },
    }),
    prisma.gastos_operativos.aggregate({
      where,
      _sum: { monto_usd: true, monto_original: true },
      _count: { id: true },
    }),
  ]);

  return {
    periodo: params,
    resumen: {
      total_usd: toNum(resumen._sum.monto_usd),
      cantidad: resumen._count.id,
    },
    por_categoria: porCategoria.map(c => ({
      categoria: c.categoria,
      total_usd: toNum(c._sum.monto_usd),
      cantidad: c._count.id,
    })),
    gastos: gastos.map(g => ({
      ...g,
      monto_usd: toNum(g.monto_usd),
      monto_original: toNum(g.monto_original),
    })),
  };
}
