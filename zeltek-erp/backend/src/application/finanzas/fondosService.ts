import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../infrastructure/prisma/client';

function toNum(d: Decimal | null | undefined): number {
  return d ? parseFloat(d.toString()) : 0;
}

export async function obtenerFondos() {
  const [fondos, equipos, ventas] = await Promise.all([
    prisma.fondos_financieros.findMany({
      orderBy: { nombre: 'asc' },
    }),
    prisma.equipos.findMany({
      where: { deleted_at: null },
      select: { inversor_id: true, ctr_usd: true, estado: true },
    }),
    prisma.ventas.findMany({
      select: { capital_retorno_inversor_usd: true },
    }),
  ]);

  // Cálculo de Capital Global
  const capitalInvertidoTotal = equipos.reduce((sum, e) => sum + toNum(e.ctr_usd), 0);
  const capitalRetornadoTotal = ventas.reduce((sum, v) => sum + toNum(v.capital_retorno_inversor_usd), 0);
  // El capital histórico aportado podría venir de los datos históricos si existiera una columna de aporte inicial en la tabla

  // Para el resumen, iteraremos sobre los inversores para dar un detalle general si se requiere, pero por ahora solo el consolidado
  const capitalActivo = equipos.filter(e => e.estado !== 'VENDIDO').reduce((sum, e) => sum + toNum(e.ctr_usd), 0);

  return {
    fondos: fondos.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      saldo_usd: toNum(f.saldo_usd),
      updated_at: f.updated_at,
    })),
    capital_global: {
      capital_activo_usd: capitalActivo,
      capital_retornado_historico_usd: capitalRetornadoTotal,
      capital_invertido_total_usd: capitalInvertidoTotal,
    },
  };
}

export async function obtenerCapitalDinamico() {
  const [fondos, disponible, taller, accesorios] = await Promise.all([
    prisma.fondos_financieros.findMany({ select: { nombre: true, saldo_usd: true } }),
    prisma.equipos.aggregate({
      where: { estado: 'DISPONIBLE', deleted_at: null },
      _sum: { ctr_usd: true },
      _count: { id: true },
    }),
    prisma.equipos.aggregate({
      where: { estado: 'EN_TALLER', deleted_at: null },
      _sum: { ctr_usd: true },
      _count: { id: true },
    }),
    prisma.accesorios_inventario.aggregate({
      where: { estado: 'disponible' },
      _sum: { costo_unitario_usd: true },
      _count: { id: true },
    }),
  ]);

  const fondoMap: Record<string, number> = {};
  for (const f of fondos) fondoMap[f.nombre] = toNum(f.saldo_usd);

  const liquido = fondoMap['CAPITAL'] ?? 0;
  const enDisponible = toNum(disponible._sum.ctr_usd);
  const enTaller = toNum(taller._sum.ctr_usd);
  const enAccesorios = toNum(accesorios._sum.costo_unitario_usd);

  return {
    liquido,
    disponible: enDisponible,
    taller: enTaller,
    accesorios: enAccesorios,
    total: liquido + enDisponible + enTaller + enAccesorios,
    conteos: {
      equipos_disponibles: disponible._count.id,
      equipos_taller: taller._count.id,
      accesorios_libres: accesorios._count.id,
    },
  };
}

export async function obtenerResumenPeriodos(tipo: 'mensual' | 'quincenal', limite: number) {
  const fondos = await prisma.fondos_financieros.findMany({ orderBy: { nombre: 'asc' } });

  const monthsBack = tipo === 'quincenal' ? Math.ceil(limite / 2) + 1 : limite + 1;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  cutoff.setDate(1);
  cutoff.setHours(0, 0, 0, 0);

  const historial = await prisma.historial_fondos.findMany({
    where: { created_at: { gte: cutoff } },
    orderBy: { created_at: 'asc' },
  });

  type Entry = { ingreso: number; egreso: number };
  const periodos = new Map<string, Map<string, Entry>>();

  const OFFSET_NI_MS = -6 * 60 * 60 * 1000; // UTC-6

  for (const h of historial) {
    const niDate = new Date(new Date(h.created_at).getTime() + OFFSET_NI_MS);
    const year = niDate.getUTCFullYear();
    const month = String(niDate.getUTCMonth() + 1).padStart(2, '0');
    const day = niDate.getUTCDate();

    const key = tipo === 'mensual'
      ? `${year}-${month}`
      : `${year}-${month}-${day <= 15 ? '1' : '2'}`;

    if (!periodos.has(key)) periodos.set(key, new Map());
    const fondoMap = periodos.get(key)!;
    if (!fondoMap.has(h.fondo_id)) fondoMap.set(h.fondo_id, { ingreso: 0, egreso: 0 });
    const entry = fondoMap.get(h.fondo_id)!;

    const monto = toNum(h.monto_usd);
    if (h.tipo === 'ingreso') entry.ingreso += monto;
    else entry.egreso += monto;
  }

  const sortedKeys = Array.from(periodos.keys()).sort().reverse().slice(0, limite);

  return {
    fondos: fondos.map(f => ({
      id: f.id,
      nombre: f.nombre,
      saldo_usd: toNum(f.saldo_usd),
    })),
    periodos: sortedKeys.map(key => {
      const fondosEntry: Record<string, Entry> = {};
      for (const f of fondos) {
        fondosEntry[f.id] = periodos.get(key)?.get(f.id) ?? { ingreso: 0, egreso: 0 };
      }
      return { periodo: key, fondos: fondosEntry };
    }),
  };
}

export async function agregarMovimientoManual(params: {
  fondoId: string;
  monto_usd: number;
  tipo: 'ingreso' | 'egreso';
  concepto: string;
}) {
  const fondo = await prisma.fondos_financieros.findUnique({ where: { id: params.fondoId } });
  if (!fondo) throw { status: 404, message: 'Fondo no encontrado' };
  if (params.monto_usd <= 0) throw { status: 400, message: 'El monto debe ser mayor a cero' };

  const actualizado = await prisma.$transaction(async (tx) => {
    await tx.historial_fondos.create({
      data: {
        fondo_id: params.fondoId,
        monto_usd: params.monto_usd,
        tipo: params.tipo,
        concepto: params.concepto,
      },
    });
    return tx.fondos_financieros.update({
      where: { id: params.fondoId },
      data: {
        saldo_usd: params.tipo === 'ingreso'
          ? { increment: params.monto_usd }
          : { decrement: params.monto_usd },
      },
    });
  });

  return { ...actualizado, saldo_usd: toNum(actualizado.saldo_usd) };
}

export async function obtenerHistorialFondo(id: string) {
  const fondo = await prisma.fondos_financieros.findUnique({
    where: { id },
  });

  if (!fondo) {
    throw { status: 404, message: 'Fondo no encontrado' };
  }

  const historial = await prisma.historial_fondos.findMany({
    where: { fondo_id: id },
    orderBy: { created_at: 'desc' },
    take: 100, // Traemos los últimos 100 movimientos
  });

  return {
    fondo: {
      id: fondo.id,
      nombre: fondo.nombre,
      saldo_usd: toNum(fondo.saldo_usd),
    },
    historial: historial.map((h) => ({
      id: h.id,
      monto_usd: toNum(h.monto_usd),
      tipo: h.tipo, // 'ingreso' o 'egreso'
      concepto: h.concepto,
      created_at: h.created_at,
    })),
  };
}
