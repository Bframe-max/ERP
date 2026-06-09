import { Router, Request, Response } from 'express';
import { verificaAuth } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as fondosService from '../../application/finanzas/fondosService';

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) res.status(e.status).json({ success: false, error: e.message });
  else { console.error('[FONDOS]', err); res.status(500).json({ success: false, error: 'Error interno' }); }
}

// GET /api/v1/fondos
router.get('/', verificaAuth, async (_req: Request, res: Response) => {
  try {
    const data = await fondosService.obtenerFondos();
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// GET /api/v1/fondos/capital-dinamico
router.get('/capital-dinamico', verificaAuth, async (_req: Request, res: Response) => {
  try {
    const data = await fondosService.obtenerCapitalDinamico();
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// GET /api/v1/fondos/resumen-periodos?tipo=mensual|quincenal&limite=6
router.get('/resumen-periodos', verificaAuth, async (req: Request, res: Response) => {
  const tipo = req.query.tipo === 'quincenal' ? 'quincenal' : 'mensual';
  const limite = Math.min(Math.max(parseInt(String(req.query.limite ?? '6')), 1), 24);
  try {
    const data = await fondosService.obtenerResumenPeriodos(tipo, limite);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// POST /api/v1/fondos/:id/movimiento  — ingreso o egreso manual (ADMIN)
router.post('/:id/movimiento', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const { monto_usd, tipo, concepto } = req.body as { monto_usd: number; tipo: string; concepto: string };
  if (!monto_usd || !tipo || !concepto) {
    res.status(400).json({ success: false, error: 'Se requieren: monto_usd, tipo (ingreso|egreso), concepto' });
    return;
  }
  if (tipo !== 'ingreso' && tipo !== 'egreso') {
    res.status(400).json({ success: false, error: 'tipo debe ser "ingreso" o "egreso"' });
    return;
  }
  try {
    const data = await fondosService.agregarMovimientoManual({
      fondoId: req.params.id,
      monto_usd: Number(monto_usd),
      tipo: tipo as 'ingreso' | 'egreso',
      concepto,
    });
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// GET /api/v1/fondos/:id/historial
router.get('/:id/historial', verificaAuth, async (req: Request, res: Response) => {
  try {
    const data = await fondosService.obtenerHistorialFondo(req.params.id);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

export default router;
