import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../infrastructure/prisma/client';

function toNum(d: Decimal | null | undefined): number {
  return d ? parseFloat(d.toString()) : 0;
}

export async function getKPIs() {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);

  const [
    equiposPorEstado,
    ventasMes,
    ventasMesAnterior,
    fondos,
    inboxPendiente,
    reparacionesActivas,
    gastosMes,
  ] = await Promise.all([
    prisma.equipos.groupBy({
      by: ['estado'],
      where: { deleted_at: null },
      _count: { id: true },
      orderBy: { estado: 'asc' },
    }),
    prisma.ventas.aggregate({
      where: { fecha_venta: { gte: inicioMes } },
      _count: { id: true },
      _sum: { precio_venta_usd: true, ganancia_bruta_venta_usd: true },
    }),
    prisma.ventas.aggregate({
      where: { fecha_venta: { gte: inicioMesAnterior, lte: finMesAnterior } },
      _count: { id: true },
      _sum: { precio_venta_usd: true, ganancia_bruta_venta_usd: true },
    }),
    prisma.fondos_financieros.findMany(),
    prisma.compras_pendientes.count({ where: { estado: 'pendiente_triage' } }),
    prisma.ordenes_reparacion.count({
      where: { estado: { notIn: ['ENTREGADO', 'CANCELADO'] } },
    }),
    prisma.gastos_operativos.aggregate({
      where: { fecha: { gte: inicioMes } },
      _sum: { monto_usd: true },
    }),
  ]);

  const estadoMap: Record<string, number> = {};
  for (const e of equiposPorEstado) {
    estadoMap[e.estado] = typeof e._count === 'object' ? (e._count.id ?? 0) : 0;
  }

  const ventasMesNum = toNum(ventasMes._sum.precio_venta_usd);
  const ventasMesAntNum = toNum(ventasMesAnterior._sum.precio_venta_usd);
  const gananciaMes = toNum(ventasMes._sum.ganancia_bruta_venta_usd);
  const gananciaMesAnt = toNum(ventasMesAnterior._sum.ganancia_bruta_venta_usd);

  const variacionVentas = ventasMesAntNum > 0
    ? ((ventasMesNum - ventasMesAntNum) / ventasMesAntNum) * 100
    : null;
  const variacionGanancia = gananciaMesAnt > 0
    ? ((gananciaMes - gananciaMesAnt) / gananciaMesAnt) * 100
    : null;

  const fondoMap: Record<string, number> = {};
  for (const f of fondos) fondoMap[f.nombre] = toNum(f.saldo_usd);

  return {
    inventario: {
      total: Object.values(estadoMap).reduce((a, b) => a + b, 0),
      por_estado: estadoMap,
      disponibles: estadoMap['DISPONIBLE'] ?? 0,
      en_taller: estadoMap['EN_TALLER'] ?? 0,
    },
    ventas_mes: {
      cantidad: ventasMes._count.id,
      ingresos_usd: ventasMesNum,
      ganancia_bruta_usd: gananciaMes,
      variacion_ingresos_pct: variacionVentas,
      variacion_ganancia_pct: variacionGanancia,
    },
    fondos: fondoMap,
    alerta_opex_negativo: (fondoMap['OPEX'] ?? 0) < 0,
    inbox_pendiente: inboxPendiente,
    reparaciones_activas: reparacionesActivas,
    gastos_mes_usd: toNum(gastosMes._sum.monto_usd),
  };
}

export async function getVentasRecientes(limit = 10) {
  return prisma.ventas.findMany({
    include: {
      equipo: { select: { marca: true, modelo: true } },
      cliente: { select: { nombre: true } },
      vendedor: { select: { nombre: true } },
    },
    orderBy: { fecha_venta: 'desc' },
    take: limit,
  });
}

export async function getInventarioAlerta() {
  const equipos = await prisma.equipos.findMany({
    where: { estado: 'EN_TALLER', deleted_at: null },
    select: {
      id: true, marca: true, modelo: true, numero_serie: true,
      estado: true, updated_at: true,
    },
    orderBy: { updated_at: 'asc' },
    take: 20,
  });

  const ahora = Date.now();
  return equipos.map(e => ({
    ...e,
    dias_en_estado: Math.floor((ahora - e.updated_at.getTime()) / 86400000),
  }));
}
