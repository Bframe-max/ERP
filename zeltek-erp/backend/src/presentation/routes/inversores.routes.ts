import { Router, Request, Response } from 'express';
import { verificaAuth } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as inversoresService from '../../application/finanzas/inversoresService';

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) res.status(e.status).json({ success: false, error: e.message });
  else { console.error('[INVERSORES]', err); res.status(500).json({ success: false, error: 'Error interno' }); }
}

// GET /inversores
router.get('/', verificaAuth, async (_req: Request, res: Response) => {
  try {
    const data = await inversoresService.listarInversores();
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// GET /inversores/:id
router.get('/:id', verificaAuth, async (req: Request, res: Response) => {
  try {
    const data = await inversoresService.obtenerInversor(req.params.id);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// POST /inversores (ADMIN only)
router.post('/', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = inversoresService.inversorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const data = await inversoresService.crearInversor(parsed.data, req.usuario!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// PATCH /inversores/:id (ADMIN only)
router.patch('/:id', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = await inversoresService.actualizarInversor(req.params.id, req.body, req.usuario!.userId);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// POST /inversores/perdidas (ADMIN only)
router.post('/perdidas', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = inversoresService.perderCapitalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const data = await inversoresService.registrarPerdida(parsed.data, req.usuario!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// POST /inversores/reintegros (ADMIN only)
router.post('/reintegros', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = inversoresService.reintegroSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const data = await inversoresService.registrarReintegro(parsed.data, req.usuario!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

export default router;
