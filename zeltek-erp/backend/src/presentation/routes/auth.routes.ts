import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { verificaAuth } from '../middleware/verificaAuth';
import * as authService from '../../application/auth/authService';

const router = Router();

// 10 intentos de login por IP en 15 minutos (solo cuenta los fallidos)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Demasiados intentos. Intenta en 15 minutos.' },
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

function cookieAccess() {
  return { ...COOKIE_BASE, maxAge: 15 * 60 * 1000 };
}

function cookieRefresh() {
  return { ...COOKIE_BASE, maxAge: 30 * 24 * 60 * 60 * 1000, path: '/api/v1/auth' };
}

function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress ?? '';
}

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) {
    res.status(e.status).json({ success: false, error: e.message });
  } else {
    console.error('[AUTH]', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// ─── POST /login ─────────────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' });
    return;
  }

  try {
    const result = await authService.login({
      email: parsed.data.email,
      password: parsed.data.password,
      ip: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.cookie('access_token', result.accessToken, cookieAccess());
    res.cookie('refresh_token', result.refreshToken, cookieRefresh());

    res.json({ success: true, data: { usuario: result.usuario } });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── POST /refresh ────────────────────────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies['refresh_token'] as string | undefined;

  if (!refreshToken) {
    res.status(401).json({ success: false, error: 'No autenticado' });
    return;
  }

  try {
    const result = await authService.refresh({
      refreshToken,
      ip: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.cookie('access_token', result.accessToken, cookieAccess());
    res.cookie('refresh_token', result.refreshToken, cookieRefresh());

    res.json({ success: true, data: { message: 'Tokens renovados' } });
  } catch (err) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    handleError(res, err);
  }
});

// ─── POST /logout ─────────────────────────────────────────────────────────────
router.post('/logout', async (req: Request, res: Response) => {
  const refreshToken = req.cookies['refresh_token'] as string | undefined;

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });

  res.json({ success: true, data: { message: 'Sesión cerrada' } });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────
router.get('/me', verificaAuth, async (req: Request, res: Response) => {
  try {
    const usuario = await authService.obtenerMe(req.usuario!.userId);
    res.json({ success: true, data: { usuario } });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
