import prisma from '../prisma/client';

type AccionAudit =
  | 'CREAR_EQUIPO' | 'CAMBIO_ESTADO' | 'EDITAR_PRECIO' | 'EDITAR_CTR'
  | 'REGISTRAR_VENTA' | 'ABRIR_RECLAMO' | 'RESOLVER_RECLAMO' | 'MODIFICAR_SETTING'
  | 'TRIAGE_INBOX' | 'LOGIN_EXITOSO' | 'MARCAR_LIQUIDADO' | 'REGISTRAR_GASTO'
  | 'CREAR_LOTE_ACCESORIOS' | 'ASIGNAR_ACCESORIO' | 'DESASIGNAR_ACCESORIO' | 'VENDER_ACCESORIO'
  | 'CREAR_REPARACION' | 'CAMBIO_ESTADO_REPARACION' | 'CREAR_USUARIO' | 'DESACTIVAR_USUARIO'
  | 'RESET_PASSWORD' | 'REGISTRAR_PERDIDA' | 'REGISTRAR_REINTEGRO' | 'MIGRACION_HISTORICA';

interface AuditParams {
  usuarioId?: string;
  accion: AccionAudit;
  tablaAfectada: string;
  registroId: string;
  campoModificado?: string;
  valorAnterior?: object;
  valorNuevo?: object;
  ipAddress?: string;
  userAgent?: string;
  notas?: string;
}

export async function registrarAudit(params: AuditParams): Promise<void> {
  await prisma.audit_logs.create({
    data: {
      usuario_id: params.usuarioId ?? null,
      accion: params.accion,
      tabla_afectada: params.tablaAfectada,
      registro_id: params.registroId,
      campo_modificado: params.campoModificado ?? null,
      valor_anterior: params.valorAnterior ?? undefined,
      valor_nuevo: params.valorNuevo ?? undefined,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      notas: params.notas ?? null,
    },
  });
}
