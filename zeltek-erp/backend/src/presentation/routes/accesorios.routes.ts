import { Router, Request, Response } from 'express';
import { verificaAuth } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as accesorioService from '../../application/accesorios/accesorioService';

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) res.status(e.status).json({ success: false, error: e.message });
  else { console.error('[ACCESORIOS]', err); res.status(500).json({ success: false, error: 'Error interno' }); }
}

// GET /accesorios/categorias
router.get('/categorias', verificaAuth, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await accesorioService.listarCategorias() });
  } catch (err) { handleError(res, err); }
});

// GET /accesorios/lotes?categoria_id=
router.get('/lotes', verificaAuth, async (req: Request, res: Response) => {
  try {
    const data = await accesorioService.listarLotes(req.query.categoria_id as string | undefined);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// POST /accesorios/lotes (ADMIN only)
router.post('/lotes', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = accesorioService.loteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const data = await accesorioService.crearLote(parsed.data, req.usuario!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// GET /accesorios/disponibles?categoria_id=
router.get('/disponibles', verificaAuth, async (req: Request, res: Response) => {
  try {
    const data = await accesorioService.listarDisponibles(req.query.categoria_id as string | undefined);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// POST /accesorios/asignar (ADMIN/TECNICO)
router.post('/asignar', verificaAuth, verificaRol('ADMIN', 'TECNICO'), async (req: Request, res: Response) => {
  const parsed = accesorioService.asignarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const data = await accesorioService.asignarAccesorio(parsed.data, req.usuario!.userId);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// POST /accesorios/:id/desasignar (ADMIN/TECNICO)
router.post('/:id/desasignar', verificaAuth, verificaRol('ADMIN', 'TECNICO'), async (req: Request, res: Response) => {
  try {
    const data = await accesorioService.desasignarAccesorio(req.params.id, req.usuario!.userId);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// POST /accesorios/vender (ADMIN/VENDEDOR)
router.post('/vender', verificaAuth, verificaRol('ADMIN', 'VENDEDOR'), async (req: Request, res: Response) => {
  const parsed = accesorioService.venderAccesoriosSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const data = await accesorioService.venderAccesorios(parsed.data, req.usuario!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

export default router;
