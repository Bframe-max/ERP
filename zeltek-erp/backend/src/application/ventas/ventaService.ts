import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../infrastructure/prisma/client';
import { EquipoStateMachine, EquipoStateMachineError } from '../../domain/equipos/EquipoStateMachine';
import { registrarAudit } from '../../infrastructure/audit/auditLogger';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const checkoutSchema = z.object({
  equipo_id: z.string().uuid(),
  cliente_id: z.string().uuid(),
  precio_venta_usd: z.number().positive(),
  moneda_cobro: z.enum(['USD', 'NIO', 'MIXTO']).default('USD'),
  monto_cobrado_nio: z.number().nonnegative().nullable().optional(),
  monto_cobrado_usd_parte: z.number().nonnegative().nullable().optional(),
  metodo_pago: z.enum(['EFECTIVO', 'TRANSFERENCIA_BAC', 'USDT']),
  referencia_pago: z.string().nullable().optional(),
  evidencia_entrega_url: z.string().min(1, 'La evidencia de entrega es obligatoria'),
  justificacion_precio: z.string().nullable().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(d: Decimal | null | undefined): number {
  return d ? parseFloat(d.toString()) : 0;
}

async function getSetting(clave: string): Promise<number> {
  const s = await prisma.settings.findUnique({ where: { clave } });
  return s ? parseFloat(s.valor) : 0;
}

async function generarNumeroFactura(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ZLT-${year}-`;
  const ultima = await prisma.ventas.findFirst({
    where: { numero_factura: { startsWith: prefix } },
    orderBy: { numero_factura: 'desc' },
    select: { numero_factura: true },
  });
  const num = ultima
    ? parseInt(ultima.numero_factura.split('-').pop()!, 10) + 1
    : 1;
  return `${prefix}${String(num).padStart(4, '0')}`;
}

async function generarNumeroGarantia(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ZLT-GAR-${year}-`;
  const ultima = await prisma.ventas.findFirst({
    where: { numero_garantia: { startsWith: prefix } },
    orderBy: { numero_garantia: 'desc' },
    select: { numero_garantia: true },
  });
  const num = ultima
    ? parseInt(ultima.numero_garantia.split('-').pop()!, 10) + 1
    : 1;
  return `${prefix}${String(num).padStart(4, '0')}`;
}

// ─── Checkout principal ───────────────────────────────────────────────────────

export async function registrarVenta(
  datos: z.infer<typeof checkoutSchema>,
  vendedorId: string,
  ip?: string,
  userAgent?: string
) {
  // Cargar equipo con relaciones necesarias
  const equipo = await prisma.equipos.findFirst({
    where: { id: datos.equipo_id, deleted_at: null },
    include: {
      inversor: true,
      accesorios_asignados: {
        where: { estado: 'asignado_equipo', categoria: { requiere_asignacion_equipo: true } },
      },
    },
  });

  if (!equipo) throw { status: 404, message: 'Equipo no encontrado' };
  if (equipo.estado !== 'DISPONIBLE') {
    throw { status: 400, message: `El equipo no está disponible para venta (estado: ${equipo.estado})` };
  }

  // Validar transición DISPONIBLE → VENDIDO
  try {
    EquipoStateMachine.validarTransicion('DISPONIBLE', 'VENDIDO');
  } catch (err) {
    if (err instanceof EquipoStateMachineError) {
      throw { status: 422, message: err.message };
    }
    throw err;
  }

  // Cargar cliente
  const cliente = await prisma.clientes.findUnique({ where: { id: datos.cliente_id } });
  if (!cliente) throw { status: 404, message: 'Cliente no encontrado' };

  // Settings
  const [tasaCambio, diasGarantiaSeminuevo, diasGarantiaNuevo, margenMinimo,
    pfGanancia, pfGarantias, pfOpex, pfReparto] = await Promise.all([
    getSetting('tasa_cambio_oficial'),
    getSetting('dias_garantia_seminuevo'),
    getSetting('dias_garantia_nuevo'),
    getSetting('margen_minimo_pct'),
    getSetting('pf_tap_ganancia'),
    getSetting('pf_tap_garantias'),
    getSetting('pf_tap_opex'),
    getSetting('pf_tap_reparto'),
  ]);

  // Cálculos financieros
  const ctrAlMomento = toNum(equipo.ctr_usd);
  const precioVenta = datos.precio_venta_usd;
  const gananciaBruta = precioVenta - ctrAlMomento;
  const margenReal = ctrAlMomento > 0 ? (gananciaBruta / ctrAlMomento) * 100 : 0;

  // Advertencia si margen < mínimo (no bloquea, pero requiere justificación)
  if (margenReal < margenMinimo && !datos.justificacion_precio) {
    throw {
      status: 400,
      message: `Margen de ganancia (${margenReal.toFixed(1)}%) está por debajo del mínimo (${margenMinimo}%). Proveer justificación_precio.`,
    };
  }

  // Profit First
  const pfMontoGanancia = gananciaBruta * pfGanancia / 100;
  const pfMontoGarantias = gananciaBruta * pfGarantias / 100;
  const pfMontoOpex = gananciaBruta * pfOpex / 100;
  const pfMontoReparto = gananciaBruta * pfReparto / 100;

  // Participación del inversor en la ganancia
  const pctInversor = toNum(equipo.inversor.porcentaje_ganancia);
  const gananciaBrutaInversor = gananciaBruta * pctInversor / 100;
  const gananciaBrutaZeltek = gananciaBruta * (100 - pctInversor) / 100;
  const capitalRetornoInversor = ctrAlMomento; // El CTR completo vuelve al inversor

  // Garantía
  const diasGarantia = equipo.condicion === 'NUEVO' ? diasGarantiaNuevo : diasGarantiaSeminuevo;
  const fechaVenta = new Date();
  const garantiaVence = new Date(fechaVenta.getTime() + diasGarantia * 24 * 60 * 60 * 1000);

  // Generar números únicos
  const [numeroFactura, numeroGarantia] = await Promise.all([
    generarNumeroFactura(),
    generarNumeroGarantia(),
  ]);

  // Cargar fondos activos para distribución de reparto
  const fondos = await prisma.fondos_financieros.findMany();
  const fondoMap = Object.fromEntries(fondos.map(f => [f.nombre, f]));

  // Cargar inversores activos para split del reparto
  const inversores = await prisma.inversores.findMany({ where: { activo: true } });
  const totalPctInversores = inversores.reduce((s, i) => s + toNum(i.porcentaje_ganancia), 0);

  // ─── TRANSACCIÓN ─────────────────────────────────────────────────────────────
  const venta = await prisma.$transaction(async (tx) => {
    // 1. Crear la venta
    const nuevaVenta = await tx.ventas.create({
      data: {
        numero_factura: numeroFactura,
        numero_garantia: numeroGarantia,
        equipo_id: datos.equipo_id,
        cliente_id: datos.cliente_id,
        precio_venta_usd: precioVenta,
        moneda_cobro: datos.moneda_cobro,
        monto_cobrado_nio: datos.monto_cobrado_nio ?? null,
        monto_cobrado_usd_parte: datos.monto_cobrado_usd_parte ?? null,
        tasa_cambio_aplicada: tasaCambio,
        ctr_al_momento_usd: ctrAlMomento,
        ganancia_bruta_venta_usd: gananciaBruta,
        porcentaje_inversor_aplicado: pctInversor,
        ganancia_bruta_inversor_est: gananciaBrutaInversor,
        ganancia_bruta_zeltek_est: gananciaBrutaZeltek,
        capital_retorno_inversor_usd: capitalRetornoInversor,
        metodo_pago: datos.metodo_pago,
        referencia_pago: datos.referencia_pago ?? null,
        dias_garantia: diasGarantia,
        garantia_vence: garantiaVence,
        evidencia_entrega_url: datos.evidencia_entrega_url,
        justificacion_precio: datos.justificacion_precio ?? null,
        pf_tap_ganancia_aplicado: pfGanancia,
        pf_tap_garantias_aplicado: pfGarantias,
        pf_tap_opex_aplicado: pfOpex,
        pf_tap_reparto_aplicado: pfReparto,
        pf_monto_ganancia_usd: pfMontoGanancia,
        pf_monto_garantias_usd: pfMontoGarantias,
        pf_monto_opex_usd: pfMontoOpex,
        pf_monto_reparto_usd: pfMontoReparto,
        vendedor_id: vendedorId,
        fecha_venta: fechaVenta,
      },
    });

    // 2. Cambiar estado del equipo a VENDIDO
    await tx.equipos.update({
      where: { id: datos.equipo_id },
      data: { estado: 'VENDIDO', visible_en_inventario: false },
    });

    // 3. Registrar historial de estado
    await tx.historial_estados.create({
      data: {
        equipo_id: datos.equipo_id,
        estado_anterior: 'DISPONIBLE',
        estado_nuevo: 'VENDIDO',
        notas: `Venta ${numeroFactura} — Cliente: ${cliente.nombre}`,
        usuario_id: vendedorId,
      },
    });

    // 4. Distribuir Profit First a los fondos
    const updatesFondos: Promise<unknown>[] = [];

    const distribuirFondo = (nombre: string, monto: number, concepto: string) => {
      const fondo = fondoMap[nombre];
      if (!fondo || monto <= 0) return;
      updatesFondos.push(
        tx.fondos_financieros.update({
          where: { id: fondo.id },
          data: { saldo_usd: { increment: monto } },
        }),
        tx.historial_fondos.create({
          data: {
            fondo_id: fondo.id,
            monto_usd: monto,
            tipo: 'ingreso',
            concepto: `${concepto} — Venta ${numeroFactura}`,
          },
        })
      );
    };

    distribuirFondo('GANANCIA', pfMontoGanancia, 'Profit First: Ganancia');
    distribuirFondo('GARANTIAS', pfMontoGarantias, 'Profit First: Garantías');
    distribuirFondo('OPEX', pfMontoOpex, 'Profit First: OPEX');

    // Split REPARTO entre inversores activos
    // Nomenclatura: REPARTO_SOCIO_A, REPARTO_ZELTEK, etc.
    // Regla: tomar primeras palabras del nombre hasta que haya 2 palabras cortas (≤2 chars) o solo primera palabra
    function fondoSlug(nombre: string): string {
      const palabras = nombre.replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/).filter(p => p.length > 0);
      if (palabras.length >= 2 && palabras[1].length <= 2) {
        return `${palabras[0]}_${palabras[1]}`.toUpperCase();
      }
      return palabras[0].toUpperCase();
    }

    if (totalPctInversores > 0) {
      for (const inversor of inversores) {
        const pct = toNum(inversor.porcentaje_ganancia);
        const montoReparto = pfMontoReparto * pct / totalPctInversores;
        const slug = fondoSlug(inversor.nombre);
        const fondoReparto = fondoMap[`REPARTO_${slug}`] ?? fondoMap['REPARTO'];
        if (fondoReparto && montoReparto > 0) {
          updatesFondos.push(
            tx.fondos_financieros.update({
              where: { id: fondoReparto.id },
              data: { saldo_usd: { increment: montoReparto } },
            }),
            tx.historial_fondos.create({
              data: {
                fondo_id: fondoReparto.id,
                monto_usd: montoReparto,
                tipo: 'ingreso',
                concepto: `Reparto ${inversor.nombre} (${pct}%) — Venta ${numeroFactura}`,
              },
            })
          );
        }
      }
    }

    await Promise.all(updatesFondos);

    return nuevaVenta;
  });

  await registrarAudit({
    usuarioId: vendedorId,
    accion: 'REGISTRAR_VENTA',
    tablaAfectada: 'ventas',
    registroId: venta.id,
    valorNuevo: {
      numero_factura: numeroFactura,
      equipo_id: datos.equipo_id,
      precio_venta_usd: precioVenta,
      ganancia_bruta: gananciaBruta,
    },
    ipAddress: ip,
    userAgent,
  });

  return venta;
}

// ─── Listar ventas ────────────────────────────────────────────────────────────

export async function listarVentas(params: {
  page?: number;
  limit?: number;
  vendedor_id?: string;
}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = params.vendedor_id ? { vendedor_id: params.vendedor_id } : {};

  const [items, total] = await prisma.$transaction([
    prisma.ventas.findMany({
      where,
      include: {
        equipo: { select: { marca: true, modelo: true, numero_serie: true } },
        cliente: { select: { nombre: true, telefono: true } },
        vendedor: { select: { nombre: true } },
      },
      orderBy: { fecha_venta: 'desc' },
      skip,
      take: limit,
    }),
    prisma.ventas.count({ where }),
  ]);

  return { items, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

// ─── Detalle de venta ─────────────────────────────────────────────────────────

export async function obtenerVenta(id: string) {
  const venta = await prisma.ventas.findUnique({
    where: { id },
    include: {
      equipo: { include: { inversor: { select: { nombre: true } } } },
      cliente: true,
      vendedor: { select: { nombre: true, email: true } },
    },
  });
  if (!venta) throw { status: 404, message: 'Venta no encontrada' };
  return venta;
}

// ─── Marcar reparto como liquidado ───────────────────────────────────────────

export async function marcarLiquidado(id: string, usuarioId: string) {
  const venta = await prisma.ventas.findUnique({ where: { id } });
  if (!venta) throw { status: 404, message: 'Venta no encontrada' };
  if (venta.reparto_liquidado) throw { status: 400, message: 'El reparto ya está liquidado' };

  const actualizado = await prisma.ventas.update({
    where: { id },
    data: { reparto_liquidado: true, fecha_liquidacion: new Date() },
  });

  await registrarAudit({
    usuarioId,
    accion: 'MARCAR_LIQUIDADO',
    tablaAfectada: 'ventas',
    registroId: id,
    valorNuevo: { liquidado: true },
  });

  return actualizado;
}
