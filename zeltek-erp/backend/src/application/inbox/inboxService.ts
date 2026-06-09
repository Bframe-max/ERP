import { z } from 'zod';
import prisma from '../../infrastructure/prisma/client';
import { registrarAudit } from '../../infrastructure/audit/auditLogger';
import { EquipoStateMachine } from '../../domain/equipos/EquipoStateMachine';

// ─── Schemas de validación ────────────────────────────────────────────────────

export const depositarInboxSchema = z.object({
  fuente: z.enum(['GMAIL_EBAY', 'MANUAL']).default('MANUAL'),
  nombre_articulo: z.string().min(1),
  precio_usd: z.number().positive(),
  costo_envio_usd: z.number().nonnegative().optional().nullable(),
  cantidad: z.number().int().positive().default(1),
  fecha_compra: z.string().optional().nullable(),
  producto_id: z.string().uuid().optional().nullable(),
  tracking_number: z.string().min(1, 'El tracking es requerido'),
  vendedor_ebay: z.string().optional().nullable(),
  url_ebay: z.string().url().optional().nullable(),
  raw_email_data: z.record(z.unknown()).optional().nullable(),
});

// Una "unidad" es un equipo individual dentro del lote a ingresar. Un inbox con
// cantidad > 1 (lote consolidado: un solo tracking/peso/ware) puede generar
// varias unidades, cada una con su propio número de serie y especificaciones
// (pueden variar entre sí aunque compartan marca/modelo — "lote variado").
const unidadEquipoSchema = z.object({
  numero_serie: z.string().min(1),
  marca: z.string().min(1),
  modelo: z.string().min(1),
  tipo: z.enum(['laptop', 'telefono', 'tablet', 'otro']).default('laptop'),
  condicion: z.enum(['NUEVO', 'SEMINUEVO']).default('SEMINUEVO'),
  procesador: z.string().optional().nullable(),
  ram_gb: z.number().int().positive().optional().nullable(),
  almacenamiento_gb: z.number().int().positive().optional().nullable(),
  tipo_almacenamiento: z.string().optional().nullable(),
  costo_base_usd: z.number().positive(),
  precio_venta_sugerido_usd: z.number().positive(),
  // RN: cada unidad de un mismo lote puede llegar en condiciones distintas — una
  // puede traer cargador y otra no, una puede llegar completa y otra sin disco —
  // por eso estos campos se evalúan por equipo y no de forma global para el lote.
  requiere_cargador: z.boolean().default(true),
  llego_completa: z.boolean().default(true),
  detalle_incompleta: z.string().optional().nullable(),
}).refine(
  data => data.llego_completa || !!(data.detalle_incompleta && data.detalle_incompleta.trim().length > 0),
  { message: 'Debes detallar qué le falta a esta unidad o qué necesita reparación', path: ['detalle_incompleta'] }
);

export const ingresarSchema = z.object({
  inversor_id: z.string().uuid(),
  equipos: z.array(unidadEquipoSchema).min(1, 'Debes ingresar al menos un equipo'),
  notas: z.string().optional().nullable(),
}).refine(
  data => new Set(data.equipos.map(e => e.numero_serie)).size === data.equipos.length,
  { message: 'Hay números de serie duplicados en el lote', path: ['equipos'] }
);

export const descartarSchema = z.object({
  razon: z.string().min(1, 'La razón es requerida para descartar'),
});

export const marcarEnMiamiSchema = z.object({
  tracking_interno: z.string().min(1, 'El tracking interno (warehouse track) es requerido'),
  peso_real_libras: z.number().positive('El peso debe ser mayor a 0'),
  tipo_envio: z.enum(['aereo', 'maritimo']),
});

// ─── Depositar desde n8n ─────────────────────────────────────────────────────

export async function depositarInbox(data: z.infer<typeof depositarInboxSchema>) {
  // RN-INBOX-001: deduplicación por tracking_number
  if (data.tracking_number) {
    const existente = await prisma.compras_pendientes.findUnique({
      where: { tracking_number: data.tracking_number },
    });
    if (existente) {
      throw { status: 409, message: `Tracking ${data.tracking_number} ya existe en el inbox` };
    }
  }

  const entrada = await prisma.compras_pendientes.create({
    data: {
      fuente: data.fuente,
      nombre_articulo: data.nombre_articulo,
      precio_usd: data.precio_usd,
      costo_envio_usd: data.costo_envio_usd ?? null,
      cantidad: data.cantidad,
      fecha_compra: data.fecha_compra ? new Date(data.fecha_compra) : null,
      producto_id: data.producto_id ?? null,
      tracking_number: data.tracking_number ?? null,
      vendedor_ebay: data.vendedor_ebay ?? null,
      url_ebay: data.url_ebay ?? null,
      raw_email_data: (data.raw_email_data as object) ?? undefined,
      estado: 'pendiente',
    },
    include: { producto: true },
  });

  return entrada;
}

// ─── Listar pendientes ────────────────────────────────────────────────────────

const ESTADOS_EN_CURSO: ('pendiente' | 'en_miami' | 'en_transito_nicaragua' | 'recibido')[] =
  ['pendiente', 'en_miami', 'en_transito_nicaragua', 'recibido'];

export async function listarInbox(soloAlerta = false) {
  const diasAlerta = await obtenerDiasAlerta();
  const limiteAlerta = new Date(Date.now() - diasAlerta * 24 * 60 * 60 * 1000);

  const donde = soloAlerta
    ? {
        estado: { in: ESTADOS_EN_CURSO },
        created_at: { lt: limiteAlerta },
      }
    : undefined;

  const items = await prisma.compras_pendientes.findMany({
    where: donde,
    orderBy: { created_at: 'desc' },
    include: { producto: true },
  });

  return items.map(item => ({
    ...item,
    dias_en_inbox: Math.floor(
      (Date.now() - item.created_at.getTime()) / (24 * 60 * 60 * 1000)
    ),
    alerta_stale: diasAlerta > 0 &&
      (ESTADOS_EN_CURSO as string[]).includes(item.estado) &&
      item.created_at < limiteAlerta,
  }));
}

// ─── Avanzar logística: Pendiente → En Bodega Miami → En tránsito a Nicaragua ──
// La agencia recibe el equipo en su bodega de Miami y, en ese mismo momento,
// asigna su tracking interno (warehouse track) para traerlo a Nicaragua. Por eso
// ambos datos se capturan juntos, en una sola acción/transición.

export async function marcarEnMiami(
  inboxId: string,
  datos: z.infer<typeof marcarEnMiamiSchema>,
  usuarioId: string,
  ip?: string,
  userAgent?: string
) {
  const entrada = await prisma.compras_pendientes.findUnique({ where: { id: inboxId } });
  if (!entrada) throw { status: 404, message: 'Compra no encontrada' };
  if (entrada.estado !== 'pendiente') {
    throw { status: 400, message: `La compra está en estado "${entrada.estado}"; no se puede marcar como recibida en Miami` };
  }

  // Costo logístico = peso × tarifa por libra (según tipo de envío), configurada en Ajustes
  const tarifaPorLibra = await obtenerTarifaPorLibra(datos.tipo_envio);
  const costoLogistico = datos.peso_real_libras * tarifaPorLibra;

  const ahora = new Date();
  const actualizada = await prisma.compras_pendientes.update({
    where: { id: inboxId },
    data: {
      estado: 'en_transito_nicaragua',
      tracking_interno: datos.tracking_interno,
      peso_real_libras: datos.peso_real_libras,
      tipo_envio: datos.tipo_envio,
      costo_logistico_usd: costoLogistico,
      en_miami_at: ahora,
      en_transito_at: ahora,
    },
    include: { producto: true },
  });

  await registrarAudit({
    usuarioId, accion: 'AVANZAR_ESTADO_COMPRA', tablaAfectada: 'compras_pendientes',
    registroId: inboxId,
    valorNuevo: {
      estado: 'en_transito_nicaragua',
      tracking_interno: datos.tracking_interno,
      peso_real_libras: datos.peso_real_libras,
      tipo_envio: datos.tipo_envio,
      costo_logistico_usd: costoLogistico,
    },
    ipAddress: ip, userAgent,
  });

  return actualizada;
}

// ─── Avanzar logística: En tránsito → Recibido (compra completada) ────────────

export async function marcarRecibido(inboxId: string, usuarioId: string, ip?: string, userAgent?: string) {
  const entrada = await prisma.compras_pendientes.findUnique({ where: { id: inboxId } });
  if (!entrada) throw { status: 404, message: 'Compra no encontrada' };
  if (entrada.estado !== 'en_transito_nicaragua') {
    throw { status: 400, message: `La compra está en estado "${entrada.estado}"; primero debe estar en tránsito a Nicaragua` };
  }

  const actualizada = await prisma.compras_pendientes.update({
    where: { id: inboxId },
    data: { estado: 'recibido', recibido_at: new Date() },
    include: { producto: true },
  });

  await registrarAudit({
    usuarioId, accion: 'AVANZAR_ESTADO_COMPRA', tablaAfectada: 'compras_pendientes',
    registroId: inboxId, valorNuevo: { estado: 'recibido' }, ipAddress: ip, userAgent,
  });

  return actualizada;
}

// ─── Ingresar al inventario ───────────────────────────────────────────────────

export async function ingresarAlInventario(
  inboxId: string,
  datos: z.infer<typeof ingresarSchema>,
  usuarioId: string,
  ip?: string,
  userAgent?: string
) {
  const entrada = await prisma.compras_pendientes.findUnique({
    where: { id: inboxId },
  });

  if (!entrada) throw { status: 404, message: 'Entrada de inbox no encontrada' };
  if (entrada.estado !== 'recibido') {
    throw { status: 400, message: `La compra debe estar "recibida" en Nicaragua antes de pasar al inventario (estado actual: ${entrada.estado})` };
  }

  // Verificar que ningún número de serie del lote ya exista en inventario
  const series = datos.equipos.map(e => e.numero_serie);
  const seriesExistentes = await prisma.equipos.findMany({
    where: { numero_serie: { in: series }, deleted_at: null },
    select: { numero_serie: true },
  });
  if (seriesExistentes.length > 0) {
    throw {
      status: 409,
      message: `Número(s) de serie ya existen en inventario: ${seriesExistentes.map(e => e.numero_serie).join(', ')}`,
    };
  }

  // El costo logístico y peso son del ENVÍO CONSOLIDADO (un solo tracking/ware/peso
  // para todo el lote, ver compras_pendientes) — cada equipo hereda esos valores y
  // los usa para su propio CTR, ya que el costo se prorratea vía costo_base_usd por unidad.
  const costoLogistico = entrada.costo_logistico_usd ? parseFloat(entrada.costo_logistico_usd.toString()) : 0;

  // RN: el equipo ya está recibido en Nicaragua al llegar a este punto (no "COMPRADO"
  // en tránsito). Entra como EN_TALLER y, si llegó completo y cumple RN-STATE-001
  // (peso registrado + cargador resuelto), se promueve a DISPONIBLE más abajo.
  const estadoInicial = 'EN_TALLER';

  const { equiposFinales, cargadoresAsignados } = await prisma.$transaction(async (tx) => {
    const equiposFinales: Awaited<ReturnType<typeof tx.equipos.create>>[] = [];
    const cargadoresAsignados: { id: string; costo_unitario_usd: string; equipoId: string }[] = [];

    for (const item of datos.equipos) {
      const ctr = item.costo_base_usd + costoLogistico;
      // RN: cada unidad de un mismo lote puede llegar en condiciones distintas
      // (una con cargador, otra sin disco, etc.) — se evalúa por equipo.
      const notasItem = item.llego_completa
        ? (datos.notas ?? null)
        : `[Llegó incompleta / requiere reparación]: ${item.detalle_incompleta}${datos.notas ? ` — ${datos.notas}` : ''}`;
      const equipoCreado = await tx.equipos.create({
        data: {
          inbox_id: inboxId,
          inversor_id: datos.inversor_id,
          numero_serie: item.numero_serie,
          marca: item.marca,
          modelo: item.modelo,
          tipo: item.tipo,
          condicion: item.condicion,
          procesador: item.procesador ?? null,
          ram_gb: item.ram_gb ?? null,
          almacenamiento_gb: item.almacenamiento_gb ?? null,
          tipo_almacenamiento: item.tipo_almacenamiento ?? null,
          estado: estadoInicial,
          costo_base_usd: item.costo_base_usd,
          peso_real_libras: entrada.peso_real_libras,
          tipo_envio: entrada.tipo_envio,
          costo_logistico_usd: entrada.costo_logistico_usd,
          ctr_usd: ctr,
          precio_venta_sugerido_usd: item.precio_venta_sugerido_usd,
          requiere_cargador: item.requiere_cargador,
          notas: notasItem,
        },
      });

      // RN: si la laptop NO vino con cargador, se asigna automáticamente una unidad
      // disponible del inventario de accesorios (FIFO: la más antigua) y su costo
      // unitario se suma al costo de accesorios y al CTR del equipo. Si vino con
      // cargador (requiere_cargador = false) no se hace nada.
      let cargador: { id: string; costo_unitario_usd: string } | null = null;
      let equipoFinal = equipoCreado;
      if (item.requiere_cargador) {
        const unidadDisponible = await tx.accesorios_inventario.findFirst({
          where: {
            estado: 'disponible',
            categoria: { nombre: { contains: 'cargador', mode: 'insensitive' } },
          },
          orderBy: { created_at: 'asc' },
        });

        if (unidadDisponible) {
          const costoUnitario = parseFloat(String(unidadDisponible.costo_unitario_usd));
          await tx.accesorios_inventario.update({
            where: { id: unidadDisponible.id },
            data: { estado: 'asignado_equipo', tipo_asignacion: 'incluido', equipo_asignado_id: equipoCreado.id },
          });
          equipoFinal = await tx.equipos.update({
            where: { id: equipoCreado.id },
            data: {
              costo_accesorios_usd: { increment: costoUnitario },
              ctr_usd: { increment: costoUnitario },
              requiere_cargador: false,
            },
          });
          cargador = { id: unidadDisponible.id, costo_unitario_usd: String(unidadDisponible.costo_unitario_usd) };
        }
      }

      // RN: si llegó completo y cumple RN-STATE-001 (peso real + cargador resuelto),
      // se promueve automáticamente a DISPONIBLE para que aparezca como stock vendible.
      if (item.llego_completa) {
        try {
          EquipoStateMachine.validarDisponible({
            peso_real_libras: equipoFinal.peso_real_libras ? parseFloat(equipoFinal.peso_real_libras.toString()) : null,
            requiere_cargador: equipoFinal.requiere_cargador,
            tiene_cargador_asignado: cargador !== null,
          });
          EquipoStateMachine.validarTransicion(equipoFinal.estado, 'DISPONIBLE');
          equipoFinal = await tx.equipos.update({
            where: { id: equipoFinal.id },
            data: { estado: 'DISPONIBLE' },
          });
        } catch {
          // No cumple las condiciones para DISPONIBLE: queda en EN_TALLER para revisión manual.
        }
      }

      equiposFinales.push(equipoFinal);
      if (cargador) cargadoresAsignados.push({ ...cargador, equipoId: equipoFinal.id });
    }

    await tx.compras_pendientes.update({
      where: { id: inboxId },
      data: {
        estado: 'ingresado',
        triaged_at: new Date(),
        triaged_by: usuarioId,
      },
    });

    return { equiposFinales, cargadoresAsignados };
  });

  for (let i = 0; i < equiposFinales.length; i++) {
    const equipo = equiposFinales[i];
    await registrarAudit({
      usuarioId,
      accion: 'CREAR_EQUIPO',
      tablaAfectada: 'equipos',
      registroId: equipo.id,
      valorNuevo: { estado: equipo.estado, inbox_id: inboxId, llego_completa: datos.equipos[i].llego_completa },
      ipAddress: ip,
      userAgent,
    });
  }

  for (const cargador of cargadoresAsignados) {
    await registrarAudit({
      usuarioId,
      accion: 'ASIGNAR_ACCESORIO',
      tablaAfectada: 'accesorios_inventario',
      registroId: cargador.id,
      valorNuevo: {
        equipo_id: cargador.equipoId,
        tipo: 'incluido',
        costo_unitario_usd: cargador.costo_unitario_usd,
        motivo: 'Auto-asignado al ingresar compra: laptop llegó sin cargador',
      },
      ipAddress: ip,
      userAgent,
    });
  }

  await registrarAudit({
    usuarioId,
    accion: 'TRIAGE_INBOX',
    tablaAfectada: 'compras_pendientes',
    registroId: inboxId,
    valorNuevo: { accion: 'ingresado', equipos_ids: equiposFinales.map(e => e.id) },
    ipAddress: ip,
    userAgent,
  });

  return equiposFinales;
}

// ─── Descartar del inbox ──────────────────────────────────────────────────────

export async function descartarInbox(
  inboxId: string,
  razon: string,
  usuarioId: string,
  ip?: string,
  userAgent?: string
) {
  const entrada = await prisma.compras_pendientes.findUnique({
    where: { id: inboxId },
  });

  if (!entrada) throw { status: 404, message: 'Entrada de inbox no encontrada' };
  if (entrada.estado === 'ingresado' || entrada.estado === 'descartado') {
    throw { status: 400, message: `La compra ya fue procesada (estado: ${entrada.estado})` };
  }

  const actualizada = await prisma.compras_pendientes.update({
    where: { id: inboxId },
    data: {
      estado: 'descartado',
      descartado_razon: razon,
      triaged_at: new Date(),
      triaged_by: usuarioId,
    },
  });

  await registrarAudit({
    usuarioId,
    accion: 'TRIAGE_INBOX',
    tablaAfectada: 'compras_pendientes',
    registroId: inboxId,
    valorNuevo: { accion: 'descartado', razon },
    ipAddress: ip,
    userAgent,
  });

  return actualizada;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function obtenerDiasAlerta(): Promise<number> {
  const setting = await prisma.settings.findUnique({
    where: { clave: 'alerta_inbox_dias' },
  });
  return setting ? parseInt(setting.valor, 10) : 5;
}

async function obtenerTarifaPorLibra(tipoEnvio: 'aereo' | 'maritimo'): Promise<number> {
  const clave = tipoEnvio === 'aereo' ? 'tarifa_libra_aerea_usd' : 'tarifa_libra_maritima_usd';
  const setting = await prisma.settings.findUnique({ where: { clave } });
  if (!setting) throw { status: 500, message: `Configuración '${clave}' no encontrada` };
  return parseFloat(setting.valor);
}
