import { z } from 'zod';
import prisma from '../../infrastructure/prisma/client';
import { registrarAudit } from '../../infrastructure/audit/auditLogger';

export const actualizarSettingSchema = z.object({
  valor: z.string().min(0),
});

export const actualizarBulkSchema = z.object({
  updates: z.array(z.object({
    clave: z.string().min(1),
    valor: z.string(),
  })).min(1),
});

export async function listarSettings() {
  return prisma.settings.findMany({ orderBy: { clave: 'asc' } });
}

export async function actualizarSetting(clave: string, valor: string, usuarioId: string) {
  const setting = await prisma.settings.findUnique({ where: { clave } });
  if (!setting) throw { status: 404, message: `Configuración '${clave}' no encontrada` };

  const actualizado = await prisma.settings.update({
    where: { clave },
    data: { valor },
  });

  await registrarAudit({
    usuarioId,
    accion: 'ACTUALIZAR_SETTING',
    tablaAfectada: 'settings',
    registroId: clave,
    valorAnterior: { valor: setting.valor },
    valorNuevo: { valor },
  });

  return actualizado;
}

export async function actualizarBulk(
  updates: { clave: string; valor: string }[],
  usuarioId: string
) {
  const resultados = await prisma.$transaction(
    updates.map(u =>
      prisma.settings.update({ where: { clave: u.clave }, data: { valor: u.valor } })
    )
  );

  await registrarAudit({
    usuarioId,
    accion: 'ACTUALIZAR_SETTING',
    tablaAfectada: 'settings',
    registroId: 'bulk',
    valorNuevo: Object.fromEntries(updates.map(u => [u.clave, u.valor])),
  });

  return resultados;
}
