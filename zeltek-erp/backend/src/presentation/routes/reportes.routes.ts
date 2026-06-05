import { Router, Request, Response } from 'express';
import { verificaAuth } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as reportesService from '../../application/reportes/reportesService';

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) res.status(e.status).json({ success: false, error: e.message });
  else { console.error('[REPORTES]', err); res.status(500).json({ success: false, error: 'Error interno' }); }
}

// GET /reportes/ventas?desde=&hasta=&vendedor_id=
router.get('/ventas', verificaAuth, async (req: Request, res: Response) => {
  const parsed = reportesService.reporteVentasSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    res.json({ success: true, data: await reportesService.reporteVentas(parsed.data) });
  } catch (err) { handleError(res, err); }
});

// GET /reportes/estado-cuenta?inversor_id=&desde=&hasta=
router.get('/estado-cuenta', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = reportesService.estadoCuentaSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    res.json({ success: true, data: await reportesService.estadoCuentaInversor(parsed.data) });
  } catch (err) { handleError(res, err); }
});

// GET /reportes/opex?desde=&hasta=
router.get('/opex', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const { desde, hasta } = req.query as { desde?: string; hasta?: string };
  if (!desde || !hasta) {
    res.status(400).json({ success: false, error: 'Se requieren parámetros desde y hasta (YYYY-MM-DD)' });
    return;
  }
  try {
    res.json({ success: true, data: await reportesService.reporteOpex({ desde, hasta }) });
  } catch (err) { handleError(res, err); }
});

export default router;
