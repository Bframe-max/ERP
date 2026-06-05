import { Router, Request, Response } from 'express';
import { verificaAuth } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as inboxService from '../../application/inbox/inboxService';

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

// ─── POST /inbox — n8n deposita correo (API Key auth) ────────────────────────
router.post('/', async (req: Request, res: Response) => {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey !== process.env.API_KEY_N8N) {
    res.status(401).json({ success: false, error: 'API key inválida' });
    return;
  }

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

// ─── POST /inbox/:id/ingresar — Triage: ingresar a inventario ─────────────────
router.post('/:id/ingresar', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = inboxService.ingresarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' });
    return;
  }

  try {
    const equipo = await inboxService.ingresarAlInventario(
      req.params.id,
      parsed.data,
      req.usuario!.userId,
      getIp(req),
      req.headers['user-agent']
    );
    res.status(201).json({ success: true, data: equipo });
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
