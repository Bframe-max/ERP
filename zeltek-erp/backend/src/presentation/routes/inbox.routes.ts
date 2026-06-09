import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verificaAuth, UsuarioPayload } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as inboxService from '../../application/inbox/inboxService';

// Acepta API Key (n8n) o JWT (usuario manual)
function authApiKeyOJwt(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    if (apiKey === process.env.API_KEY_N8N) { next(); return; }
    res.status(401).json({ success: false, error: 'API key inválida' });
    return;
  }
  const token = req.cookies['access_token'] as string | undefined;
  if (!token) { res.status(401).json({ success: false, error: 'No autenticado' }); return; }
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET!) as UsuarioPayload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token inválido o expirado' });
  }
}

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) {
    res.status(e.status).json({ success: false, error: e.message });
  } else {
    console.error('[INBOX]', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

function getIp(req: Request): string {
  const fw = req.headers['x-forwarded-for'];
  if (typeof fw === 'string') return fw.split(',')[0].trim();
  return req.socket.remoteAddress ?? '';
}

// ─── POST /inbox — n8n (API Key) o usuario manual (JWT ADMIN) ────────────────
router.post('/', authApiKeyOJwt, async (req: Request, res: Response) => {
  const parsed = inboxService.depositarInboxSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' });
    return;
  }
  try {
    const entrada = await inboxService.depositarInbox(parsed.data);
    res.status(201).json({ success: true, data: entrada });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /inbox — Lista pendientes (ADMIN) ────────────────────────────────────
router.get('/', verificaAuth, verificaRol('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const items = await inboxService.listarInbox();
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /inbox/alertas — Items con > N días sin triage ───────────────────────
router.get('/alertas', verificaAuth, verificaRol('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const items = await inboxService.listarInbox(true);
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── POST /inbox/:id/en-miami — Logística: recibido en bodega Miami + tracking interno ─
// La agencia recibe el equipo en Miami y asigna su tracking interno (warehouse
// track) en el mismo momento → pasa directo a "en tránsito a Nicaragua".
router.post('/:id/en-miami', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = inboxService.marcarEnMiamiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' });
    return;
  }
  try {
    const entrada = await inboxService.marcarEnMiami(
      req.params.id, parsed.data, req.usuario!.userId, getIp(req), req.headers['user-agent']
    );
    res.json({ success: true, data: entrada });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── POST /inbox/:id/recibido — Logística: marcar recibido en Nicaragua ───────
router.post('/:id/recibido', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  try {
    const entrada = await inboxService.marcarRecibido(req.params.id, req.usuario!.userId, getIp(req), req.headers['user-agent']);
    res.json({ success: true, data: entrada });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── POST /inbox/:id/ingresar — Triage: ingresar a inventario ─────────────────
router.post('/:id/ingresar', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = inboxService.ingresarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' });
    return;
  }

  try {
    const equipos = await inboxService.ingresarAlInventario(
      req.params.id,
      parsed.data,
      req.usuario!.userId,
      getIp(req),
      req.headers['user-agent']
    );
    res.status(201).json({ success: true, data: equipos });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── POST /inbox/:id/descartar — Triage: descartar ────────────────────────────
router.post('/:id/descartar', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = inboxService.descartarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' });
    return;
  }

  try {
    const entrada = await inboxService.descartarInbox(
      req.params.id,
      parsed.data.razon,
      req.usuario!.userId,
      getIp(req),
      req.headers['user-agent']
    );
    res.json({ success: true, data: entrada });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
