import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface UsuarioPayload {
  userId: string;
  rol: 'ADMIN' | 'VENDEDOR' | 'TECNICO';
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioPayload;
    }
  }
}

export function verificaAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies['access_token'] as string | undefined;

  if (!token) {
    res.status(401).json({ success: false, error: 'No autenticado' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as UsuarioPayload;
    req.usuario = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token inválido o expirado' });
  }
}
