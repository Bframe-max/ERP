import { z } from 'zod';
import prisma from '../../infrastructure/prisma/client';
import { registrarAudit } from '../../infrastructure/audit/auditLogger';

// ─── Schemas de validación ────────────────────────────────────────────────────

export const depositarInboxSchema = z.object({
  fuente: z.enum(['GMAIL_EBAY', 'MANUAL']).default('MANUAL'),
  nombre_articulo: z.string().min(1),
  precio_usd: z.number().positive(),
  tracking_number: z.string().optional().nullable(),
  vendedor_ebay: z.string().optional().nullable(),
  url_ebay: z.string().url().optional().nullable(),
  raw_email_data: z.record(z.unknown()).optional().nullable(),
});

export const ingresarSchema = z.object({
  inversor_id: z.string().uuid(),
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
  requiere_cargador: z.boolean().default(true),
  notas: z.string().optional().nullable(),
});

export const descartarSchema = z.object({
  razon: z.string().min(1, 'La razón es requerida para descartar'),
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
      tracking_number: data.tracking_number ?? null,
      vendedor_ebay: data.vendedor_ebay ?? null,
      url_ebay: data.url_ebay ?? null,
      raw_email_data: (data.raw_email_data as object) ?? undefined,
      estado: 'pendiente_triage',
    },
  });

  return entrada;
}

// ─── Listar pendientes ────────────────────────────────────────────────────────

export async function listarInbox(soloAlerta = false) {
  const diasAlerta = await obtenerDiasAlerta();

  const donde = soloAlerta
    ? {
        estado: 'pendiente_triage' as const,
        created_at: {
          lt: new Date(Date.now() - diasAlerta * 24 * 60 * 60 * 1000),
        },
      }
    : {
        estado: { not: 'ingresado' as const },
      };

  const items = await prisma.compras_pendientes.findMany({
    where: donde,
    orderBy: { created_at: 'asc' },
  });

  return items.map(item => ({
    ...item,
    dias_en_inbox: Math.floor(
      (Date.now() - item.created_at.getTime()) / (24 * 60 * 60 * 1000)
    ),
    alerta_stale: diasAlerta > 0 &&
      item.estado === 'pendiente_triage' &&
      (Date.now() - item.created_at.getTime()) > diasAlerta * 24 * 60 * 60 * 1000,
  }));
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
  if (entrada.estado !== 'pendiente_triage') {
    throw { status: 400, message: `El inbox ya fue procesado (estado: ${entrada.estado})` };
  }

  // Verificar que número de serie no exista
  const serieExiste = await prisma.equipos.findFirst({
    where: { numero_serie: datos.numero_serie, deleted_at: null },
  });
  if (serieExiste) {
    throw { status: 409, message: `Número de serie "${datos.numero_serie}" ya existe en inventario` };
  }

  // CTR inicial = costo_base (sin logística ni acondicionamiento aún)
  const ctr = datos.costo_base_usd;

  const [equipo] = await prisma.$transaction([
    prisma.equipos.create({
      data: {
        inbox_id: inboxId,
        inversor_id: datos.inversor_id,
        numero_serie: datos.numero_serie,
        marca: datos.marca,
        modelo: datos.modelo,
        tipo: datos.tipo,
        condicion: datos.condicion,
        procesador: datos.procesador ?? null,
        ram_gb: datos.ram_gb ?? null,
        almacenamiento_gb: datos.almacenamiento_gb ?? null,
        tipo_almacenamiento: datos.tipo_almacenamiento ?? null,
        estado: 'COMPRADO',
        costo_base_usd: datos.costo_base_usd,
        ctr_usd: ctr,
        precio_venta_sugerido_usd: datos.precio_venta_sugerido_usd,
        requiere_cargador: datos.requiere_cargador,
      },
    }),
    prisma.compras_pendientes.update({
      where: { id: inboxId },
      data: {
        estado: 'ingresado',
        triaged_at: new Date(),
        triaged_by: usuarioId,
      },
    }),
  ]);

  await registrarAudit({
    usuarioId,
    accion: 'CREAR_EQUIPO',
    tablaAfectada: 'equipos',
    registroId: equipo.id,
    valorNuevo: { estado: 'COMPRADO', inbox_id: inboxId },
    ipAddress: ip,
    userAgent,
  });

  await registrarAudit({
    usuarioId,
    accion: 'TRIAGE_INBOX',
    tablaAfectada: 'compras_pendientes',
    registroId: inboxId,
    valorNuevo: { accion: 'ingresado', equipo_id: equipo.id },
    ipAddress: ip,
    userAgent,
  });

  return equipo;
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
  if (entrada.estado !== 'pendiente_triage') {
    throw { status: 400, message: `El inbox ya fue procesado (estado: ${entrada.estado})` };
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
