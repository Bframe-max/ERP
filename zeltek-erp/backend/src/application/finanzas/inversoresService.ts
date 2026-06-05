import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../infrastructure/prisma/client';
import { registrarAudit } from '../../infrastructure/audit/auditLogger';

function toNum(d: Decimal | null | undefined): number {
  return d ? parseFloat(d.toString()) : 0;
}

export const inversorSchema = z.object({
  nombre: z.string().min(1),
  porcentaje_ganancia: z.number().min(0).max(100),
  telefono: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
});

export const perderCapitalSchema = z.object({
  inversor_id: z.string().uuid(),
  equipo_id: z.string().uuid().nullable().optional(),
  motivo: z.enum(['EXTRAVIO', 'ROBO', 'DISPUTA_PERDIDA', 'DANO_IRREPARABLE', 'OTRO']),
  descripcion: z.string().min(1),
  monto_perdido_usd: z.number().positive(),
  fecha_perdida: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const reintegroSchema = z.object({
  perdida_id: z.string().uuid(),
  monto_usd: z.number().positive(),
  mes_aplicado: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().nullable().optional(),
});

export async function listarInversores() {
  const inversores = await prisma.inversores.findMany({
    orderBy: { nombre: 'asc' },
  });

  // Enriquecer con fondos virtuales de reparto
  const fondos = await prisma.fondos_financieros.findMany();
  const fondoMap = Object.fromEntries(fondos.map(f => [f.nombre, f]));

  return inversores.map(inv => {
    const slug = fondoSlug(inv.nombre);
    const fondo = fondoMap[`REPARTO_${slug}`] ?? fondoMap['REPARTO'];
    return {
      ...inv,
      porcentaje_ganancia: toNum(inv.porcentaje_ganancia),
      fondo_reparto_nombre: `REPARTO_${slug}`,
      saldo_reparto_usd: fondo ? toNum(fondo.saldo_usd) : 0,
    };
  });
}

export async function obtenerInversor(id: string) {
  const inversor = await prisma.inversores.findUnique({ where: { id } });
  if (!inversor) throw { status: 404, message: 'Inversor no encontrado' };

  // Equipos del inversor (activos)
  const [equipos, ventas, perdidas] = await prisma.$transaction([
    prisma.equipos.findMany({
      where: { inversor_id: id, deleted_at: null },
      select: { id: true, marca: true, modelo: true, estado: true, ctr_usd: true, precio_venta_sugerido_usd: true },
      orderBy: { created_at: 'desc' },
    }),
    prisma.ventas.findMany({
      where: { equipo: { inversor_id: id } },
      select: {
        id: true, numero_factura: true, fecha_venta: true,
        precio_venta_usd: true, ganancia_bruta_venta_usd: true,
        capital_retorno_inversor_usd: true, reparto_liquidado: true,
      },
      orderBy: { fecha_venta: 'desc' },
    }),
    prisma.perdidas_capital.findMany({
      where: { inversor_id: id },
      include: { reintegros: true },
      orderBy: { fecha_perdida: 'desc' },
    }),
  ]);

  const capitalInvertido = equipos.reduce((sum, e) => sum + toNum(e.ctr_usd), 0);
  const capitalRecuperado = ventas.reduce((sum, v) => sum + toNum(v.capital_retorno_inversor_usd), 0);
  const totalGanancias = ventas.reduce((sum, v) => sum + toNum(v.ganancia_bruta_venta_usd) * toNum(inversor.porcentaje_ganancia) / 100, 0);

  return {
    inversor: { ...inversor, porcentaje_ganancia: toNum(inversor.porcentaje_ganancia) },
    resumen: {
      equipos_activos: equipos.filter(e => e.estado !== 'VENDIDO').length,
      equipos_total: equipos.length,
      capital_invertido_usd: capitalInvertido,
      capital_recuperado_usd: capitalRecuperado,
      ganancias_est_usd: totalGanancias,
    },
    equipos,
    ventas,
    perdidas: perdidas.map(p => ({
      ...p,
      monto_perdido_usd: toNum(p.monto_perdido_usd),
      monto_reintegrado_usd: toNum(p.monto_reintegrado_usd),
    })),
  };
}

export async function crearInversor(datos: z.infer<typeof inversorSchema>, usuarioId: string) {
  const inversor = await prisma.inversores.create({
    data: {
      nombre: datos.nombre,
      porcentaje_ganancia: datos.porcentaje_ganancia,
      telefono: datos.telefono ?? null,
      notas: datos.notas ?? null,
    },
  });

  // Crear fondo de reparto asociado
  const slug = fondoSlug(datos.nombre);
  await prisma.fondos_financieros.create({
    data: {
      nombre: `REPARTO_${slug}`,
      saldo_usd: 0,
    },
  });

  await registrarAudit({
    usuarioId,
    accion: 'CREAR_INVERSOR',
    tablaAfectada: 'inversores',
    registroId: inversor.id,
    valorNuevo: { nombre: datos.nombre, porcentaje_ganancia: datos.porcentaje_ganancia },
  });

  return inversor;
}

export async function actualizarInversor(
  id: string,
  datos: Partial<z.infer<typeof inversorSchema>>,
  usuarioId: string
) {
  const actual = await prisma.inversores.findUnique({ where: { id } });
  if (!actual) throw { status: 404, message: 'Inversor no encontrado' };

  const actualizado = await prisma.inversores.update({
    where: { id },
    data: {
      ...(datos.nombre && { nombre: datos.nombre }),
      ...(datos.porcentaje_ganancia !== undefined && { porcentaje_ganancia: datos.porcentaje_ganancia }),
      ...(datos.telefono !== undefined && { telefono: datos.telefono }),
      ...(datos.notas !== undefined && { notas: datos.notas }),
    },
  });

  await registrarAudit({
    usuarioId,
    accion: 'ACTUALIZAR_INVERSOR',
    tablaAfectada: 'inversores',
    registroId: id,
    valorAnterior: { porcentaje_ganancia: toNum(actual.porcentaje_ganancia) },
    valorNuevo: datos,
  });

  return actualizado;
}

export async function registrarPerdida(
  datos: z.infer<typeof perderCapitalSchema>,
  usuarioId: string
) {
  const inversor = await prisma.inversores.findUnique({ where: { id: datos.inversor_id } });
  if (!inversor) throw { status: 404, message: 'Inversor no encontrado' };

  const perdida = await prisma.perdidas_capital.create({
    data: {
      inversor_id: datos.inversor_id,
      equipo_id: datos.equipo_id ?? null,
      motivo: datos.motivo,
      descripcion: datos.descripcion,
      monto_perdido_usd: datos.monto_perdido_usd,
      fecha_perdida: new Date(datos.fecha_perdida),
      registrado_por: usuarioId,
    },
  });

  await registrarAudit({
    usuarioId,
    accion: 'REGISTRAR_PERDIDA',
    tablaAfectada: 'perdidas_capital',
    registroId: perdida.id,
    valorNuevo: { motivo: datos.motivo, monto: datos.monto_perdido_usd },
  });

  return perdida;
}

export async function registrarReintegro(
  datos: z.infer<typeof reintegroSchema>,
  usuarioId: string
) {
  const perdida = await prisma.perdidas_capital.findUnique({
    where: { id: datos.perdida_id },
  });
  if (!perdida) throw { status: 404, message: 'Pérdida no encontrada' };

  const totalYaReintegrado = toNum(perdida.monto_reintegrado_usd);
  const pendiente = toNum(perdida.monto_perdido_usd) - totalYaReintegrado;
  if (datos.monto_usd > pendiente) {
    throw { status: 400, message: `Monto excede el pendiente de reintegro (${pendiente.toFixed(2)} USD)` };
  }

  const fondoGanancia = await prisma.fondos_financieros.findFirst({ where: { nombre: 'GANANCIA' } });

  const reintegro = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.reintegros_capital.create({
      data: {
        perdida_id: datos.perdida_id,
        inversor_id: perdida.inversor_id,
        monto_usd: datos.monto_usd,
        mes_aplicado: new Date(datos.mes_aplicado),
        notas: datos.notas ?? null,
        registrado_por: usuarioId,
      },
    });

    const nuevoTotalReintegrado = totalYaReintegrado + datos.monto_usd;
    const nuevoEstado = nuevoTotalReintegrado >= toNum(perdida.monto_perdido_usd)
      ? 'RECUPERADO'
      : 'EN_RECUPERACION';

    await tx.perdidas_capital.update({
      where: { id: datos.perdida_id },
      data: {
        monto_reintegrado_usd: nuevoTotalReintegrado,
        estado: nuevoEstado,
        ...(nuevoEstado === 'RECUPERADO' && { fecha_recuperacion: new Date() }),
      },
    });

    // Debitar del fondo GANANCIA
    if (fondoGanancia) {
      await tx.fondos_financieros.update({
        where: { id: fondoGanancia.id },
        data: { saldo_usd: { decrement: datos.monto_usd } },
      });
      await tx.historial_fondos.create({
        data: {
          fondo_id: fondoGanancia.id,
          monto_usd: datos.monto_usd,
          tipo: 'egreso',
          concepto: `Reintegro capital pérdida — ${perdida.descripcion.substring(0, 50)}`,
        },
      });
    }

    return nuevo;
  });

  await registrarAudit({
    usuarioId,
    accion: 'REGISTRAR_REINTEGRO',
    tablaAfectada: 'reintegros_capital',
    registroId: reintegro.id,
    valorNuevo: { monto_usd: datos.monto_usd, perdida_id: datos.perdida_id },
  });

  return reintegro;
}

// Shared helper
export function fondoSlug(nombre: string): string {
  const palabras = nombre.replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/).filter(p => p.length > 0);
  if (palabras.length >= 2 && palabras[1].length <= 2) {
    return `${palabras[0]}_${palabras[1]}`.toUpperCase();
  }
  return palabras[0].toUpperCase();
}
