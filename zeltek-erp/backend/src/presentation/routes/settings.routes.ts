import { Router, Request, Response } from 'express';
import { verificaAuth } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as settingsService from '../../application/settings/settingsService';

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) res.status(e.status).json({ success: false, error: e.message });
  else { console.error('[SETTINGS]', err); res.status(500).json({ success: false, error: 'Error interno' }); }
}

// GET /configuracion
router.get('/', verificaAuth, async (_req: Request, res: Response) => {
  try {
    const data = await settingsService.listarSettings();
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// PATCH /configuracion/:clave (ADMIN)
router.patch('/:clave', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = settingsService.actualizarSettingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const data = await settingsService.actualizarSetting(req.params.clave, parsed.data.valor, req.usuario!.userId);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// POST /configuracion/bulk (ADMIN) — guardar múltiples en una sola llamada
router.post('/bulk', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = settingsService.actualizarBulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const data = await settingsService.actualizarBulk(parsed.data.updates, req.usuario!.userId);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

export default router;
