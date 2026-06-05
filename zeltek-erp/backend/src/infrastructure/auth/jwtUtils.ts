import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface AccessPayload {
  userId: string;
  rol: 'ADMIN' | 'VENDEDOR' | 'TECNICO';
}

export interface RefreshPayload {
  userId: string;
  sessionId: string;
}

export function generarAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });
}

export function generarRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });
}

export function verificarAccessToken(token: string): AccessPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as AccessPayload;
}

export function verificarRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as RefreshPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
