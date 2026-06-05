import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { verificaAuth } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as gastosService from '../../application/finanzas/gastosService';

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) res.status(e.status).json({ success: false, error: e.message });
  else { console.error('[GASTOS]', err); res.status(500).json({ success: false, error: 'Error interno' }); }
}

function getIp(req: Request): string {
  const fw = req.headers['x-forwarded-for'];
  return typeof fw === 'string' ? fw.split(',')[0].trim() : (req.socket.remoteAddress ?? '');
}

// GET /gastos — listar con filtros
router.get('/', verificaAuth, async (req: Request, res: Response) => {
  const params = z.object({
    categoria: z.string().optional(),
    desde: z.string().optional(),
    hasta: z.string().optional(),
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(50).default(20),
  }).parse(req.query);
  try {
    const resultado = await gastosService.listarGastos(params);
    res.json({ success: true, ...resultado });
  } catch (err) { handleError(res, err); }
});

// POST /gastos — registrar gasto (ADMIN only)
router.post('/', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = gastosService.gastoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const resultado = await gastosService.registrarGasto(
      parsed.data, req.usuario!.userId, getIp(req), req.headers['user-agent']
    );
    res.status(201).json({ success: true, data: resultado.gasto, alerta_opex_negativo: resultado.alerta_opex_negativo });
  } catch (err) { handleError(res, err); }
});

// GET /gastos/fondos — listar todos los fondos con saldo
router.get('/fondos', verificaAuth, async (_req: Request, res: Response) => {
  try {
    const fondos = await gastosService.listarFondos();
    res.json({ success: true, data: fondos });
  } catch (err) { handleError(res, err); }
});

// GET /gastos/fondos/:id/historial
router.get('/fondos/:id/historial', verificaAuth, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string ?? '50', 10) || 50;
  try {
    const resultado = await gastosService.historialFondo(req.params.id, limit);
    res.json({ success: true, data: resultado });
  } catch (err) { handleError(res, err); }
});

export default router;
