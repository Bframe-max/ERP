import { Router, Request, Response } from 'express';
import { verificaAuth } from '../middleware/verificaAuth';
import * as dashboardService from '../../application/dashboard/dashboardService';

const router = Router();

function handleError(res: Response, err: unknown) {
  console.error('[DASHBOARD]', err);
  res.status(500).json({ success: false, error: 'Error interno' });
}

// GET /dashboard/kpis — KPIs principales
router.get('/kpis', verificaAuth, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await dashboardService.getKPIs() });
  } catch (err) { handleError(res, err); }
});

// GET /dashboard/ventas-recientes
router.get('/ventas-recientes', verificaAuth, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string ?? '10', 10) || 10;
  try {
    res.json({ success: true, data: await dashboardService.getVentasRecientes(limit) });
  } catch (err) { handleError(res, err); }
});

// GET /dashboard/inventario-alerta — equipos en taller por más tiempo
router.get('/inventario-alerta', verificaAuth, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await dashboardService.getInventarioAlerta() });
  } catch (err) { handleError(res, err); }
});

export default router;
