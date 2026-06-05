import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../../infrastructure/prisma/client';
import { registrarAudit } from '../../infrastructure/audit/auditLogger';

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  rol: z.enum(['ADMIN', 'VENDEDOR', 'TECNICO']).default('VENDEDOR'),
});

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(2).optional(),
  rol: z.enum(['ADMIN', 'VENDEDOR', 'TECNICO']).optional(),
  activo: z.boolean().optional(),
});

export const cambiarPasswordSchema = z.object({
  nueva_password: z.string().min(6),
});

const CAMPOS_PUBLICOS = {
  id: true, nombre: true, email: true, rol: true, activo: true,
  intentos_fallidos: true, bloqueado_hasta: true, ultimo_login: true,
  ultimo_login_ip: true, created_at: true,
};

export async function listarUsuarios() {
  return prisma.usuarios.findMany({
    select: CAMPOS_PUBLICOS,
    orderBy: { nombre: 'asc' },
  });
}

export async function crearUsuario(datos: z.infer<typeof crearUsuarioSchema>, adminId: string) {
  const existe = await prisma.usuarios.findUnique({ where: { email: datos.email } });
  if (existe) throw { status: 409, message: 'Ya existe un usuario con ese email' };

  const password_hash = await bcrypt.hash(datos.password, 12);
  const usuario = await prisma.usuarios.create({
    data: {
      nombre: datos.nombre,
      email: datos.email,
      password_hash,
      rol: datos.rol,
    },
    select: CAMPOS_PUBLICOS,
  });

  await registrarAudit({
    usuarioId: adminId,
    accion: 'CREAR_USUARIO',
    tablaAfectada: 'usuarios',
    registroId: usuario.id,
    valorNuevo: { nombre: datos.nombre, email: datos.email, rol: datos.rol },
  });

  return usuario;
}

export async function actualizarUsuario(
  id: string,
  datos: z.infer<typeof actualizarUsuarioSchema>,
  adminId: string
) {
  const actual = await prisma.usuarios.findUnique({ where: { id }, select: CAMPOS_PUBLICOS });
  if (!actual) throw { status: 404, message: 'Usuario no encontrado' };

  const actualizado = await prisma.usuarios.update({
    where: { id },
    data: {
      ...(datos.nombre !== undefined && { nombre: datos.nombre }),
      ...(datos.rol !== undefined && { rol: datos.rol }),
      ...(datos.activo !== undefined && { activo: datos.activo }),
    },
    select: CAMPOS_PUBLICOS,
  });

  await registrarAudit({
    usuarioId: adminId,
    accion: 'ACTUALIZAR_USUARIO',
    tablaAfectada: 'usuarios',
    registroId: id,
    valorAnterior: { rol: actual.rol, activo: actual.activo },
    valorNuevo: datos,
  });

  return actualizado;
}

export async function cambiarPassword(id: string, nuevaPassword: string, adminId: string) {
  const usuario = await prisma.usuarios.findUnique({ where: { id }, select: { id: true, nombre: true } });
  if (!usuario) throw { status: 404, message: 'Usuario no encontrado' };

  const password_hash = await bcrypt.hash(nuevaPassword, 12);
  await prisma.usuarios.update({ where: { id }, data: { password_hash } });

  // Invalidar todas las sesiones activas del usuario
  await prisma.sesiones.deleteMany({ where: { usuario_id: id } });

  await registrarAudit({
    usuarioId: adminId,
    accion: 'CAMBIAR_PASSWORD',
    tablaAfectada: 'usuarios',
    registroId: id,
    valorNuevo: { accion: 'reset_password', nombre: usuario.nombre },
  });

  return { ok: true };
}

export async function desbloquearUsuario(id: string, adminId: string) {
  const usuario = await prisma.usuarios.findUnique({ where: { id }, select: { id: true } });
  if (!usuario) throw { status: 404, message: 'Usuario no encontrado' };

  await prisma.usuarios.update({
    where: { id },
    data: { bloqueado_hasta: null, intentos_fallidos: 0 },
  });

  await registrarAudit({
    usuarioId: adminId,
    accion: 'DESBLOQUEAR_USUARIO',
    tablaAfectada: 'usuarios',
    registroId: id,
  });

  return { ok: true };
}
