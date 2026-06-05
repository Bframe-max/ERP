import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import prisma from '../../infrastructure/prisma/client';
import {
  generarAccessToken,
  generarRefreshToken,
  verificarRefreshToken,
  hashToken,
} from '../../infrastructure/auth/jwtUtils';
import { registrarAudit } from '../../infrastructure/audit/auditLogger';

const MAX_INTENTOS = 5;
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutos

interface LoginParams {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

interface RefreshParams {
  refreshToken: string;
  ip?: string;
  userAgent?: string;
}

interface AppError {
  status: number;
  message: string;
}

function appError(status: number, message: string): AppError {
  return { status, message };
}

async function registrarIntento(
  email: string,
  exitoso: boolean,
  ip?: string,
  userAgent?: string
) {
  await prisma.login_intentos.create({
    data: {
      email_intentado: email,
      ip_address: ip ?? null,
      user_agent: userAgent ?? null,
      exitoso,
    },
  });
}

export async function login(params: LoginParams) {
  const { email, password, ip, userAgent } = params;
  const emailNorm = email.toLowerCase().trim();

  const usuario = await prisma.usuarios.findUnique({
    where: { email: emailNorm },
  });

  // Timing-safe: run bcrypt even when user not found to avoid enumeration
  if (!usuario) {
    await bcrypt.compare(password, '$2a$12$invalidsaltXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    await registrarIntento(emailNorm, false, ip, userAgent);
    throw appError(401, 'Credenciales inválidas');
  }

  if (!usuario.activo) {
    await registrarIntento(emailNorm, false, ip, userAgent);
    throw appError(403, 'Cuenta desactivada. Contacta al administrador.');
  }

  // Check lockout
  if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > new Date()) {
    const mins = Math.ceil((usuario.bloqueado_hasta.getTime() - Date.now()) / 60000);
    await registrarIntento(emailNorm, false, ip, userAgent);
    throw appError(429, `Cuenta bloqueada. Intenta en ${mins} minuto(s).`);
  }

  const passwordOk = await bcrypt.compare(password, usuario.password_hash);

  if (!passwordOk) {
    const nuevosIntentos = usuario.intentos_fallidos + 1;
    const bloquear = nuevosIntentos >= MAX_INTENTOS;

    await prisma.usuarios.update({
      where: { id: usuario.id },
      data: {
        intentos_fallidos: nuevosIntentos,
        ...(bloquear && { bloqueado_hasta: new Date(Date.now() + LOCKOUT_MS) }),
      },
    });

    await registrarIntento(emailNorm, false, ip, userAgent);

    if (bloquear) {
      throw appError(429, `Demasiados intentos fallidos. Cuenta bloqueada por 30 minutos.`);
    }

    const restantes = MAX_INTENTOS - nuevosIntentos;
    throw appError(401, `Credenciales inválidas. ${restantes} intento(s) restante(s).`);
  }

  // Success — create session
  const sesionId = randomUUID();
  const refreshToken = generarRefreshToken({ userId: usuario.id, sessionId: sesionId });
  const refreshHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.sesiones.create({
      data: {
        id: sesionId,
        usuario_id: usuario.id,
        refresh_token_hash: refreshHash,
        ip_address: ip ?? null,
        user_agent: userAgent ?? null,
        expires_at: expiresAt,
      },
    }),
    prisma.usuarios.update({
      where: { id: usuario.id },
      data: {
        intentos_fallidos: 0,
        bloqueado_hasta: null,
        ultimo_login: new Date(),
        ultimo_login_ip: ip ?? null,
      },
    }),
  ]);

  await registrarIntento(emailNorm, true, ip, userAgent);

  await registrarAudit({
    usuarioId: usuario.id,
    accion: 'LOGIN_EXITOSO',
    tablaAfectada: 'usuarios',
    registroId: usuario.id,
    ipAddress: ip,
    userAgent,
  });

  const accessToken = generarAccessToken({ userId: usuario.id, rol: usuario.rol });

  return {
    accessToken,
    refreshToken,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    },
  };
}

export async function refresh(params: RefreshParams) {
  const { refreshToken, ip, userAgent } = params;

  let payload: { userId: string; sessionId: string };
  try {
    payload = verificarRefreshToken(refreshToken);
  } catch {
    throw appError(401, 'Refresh token inválido o expirado');
  }

  const refreshHash = hashToken(refreshToken);

  const sesion = await prisma.sesiones.findFirst({
    where: {
      id: payload.sessionId,
      usuario_id: payload.userId,
      refresh_token_hash: refreshHash,
    },
    include: { usuario: true },
  });

  if (!sesion) {
    throw appError(401, 'Sesión no encontrada. Inicia sesión nuevamente.');
  }

  if (sesion.expires_at < new Date()) {
    await prisma.sesiones.delete({ where: { id: sesion.id } });
    throw appError(401, 'Sesión expirada. Inicia sesión nuevamente.');
  }

  if (!sesion.usuario.activo) {
    await prisma.sesiones.delete({ where: { id: sesion.id } });
    throw appError(403, 'Cuenta desactivada.');
  }

  // Rotate refresh token
  const newRefreshToken = generarRefreshToken({
    userId: sesion.usuario_id,
    sessionId: sesion.id,
  });
  const newRefreshHash = hashToken(newRefreshToken);

  await prisma.sesiones.update({
    where: { id: sesion.id },
    data: {
      refresh_token_hash: newRefreshHash,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ultima_actividad: new Date(),
      ip_address: ip ?? null,
      user_agent: userAgent ?? null,
    },
  });

  const accessToken = generarAccessToken({
    userId: sesion.usuario_id,
    rol: sesion.usuario.rol,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(refreshToken: string) {
  try {
    const payload = verificarRefreshToken(refreshToken);
    const refreshHash = hashToken(refreshToken);

    await prisma.sesiones.deleteMany({
      where: {
        id: payload.sessionId,
        refresh_token_hash: refreshHash,
      },
    });
  } catch {
    // Token inválido/expirado — ignorar, igual se limpian las cookies
  }
}

export async function obtenerMe(userId: string) {
  const usuario = await prisma.usuarios.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      ultimo_login: true,
      created_at: true,
    },
  });

  if (!usuario || !usuario.activo) {
    throw appError(401, 'Usuario no encontrado');
  }

  return usuario;
}
