import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { verificaAuth } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as reparacionService from '../../application/taller/reparacionService';

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) res.status(e.status).json({ success: false, error: e.message });
  else { console.error('[REPARACIONES]', err); res.status(500).json({ success: false, error: 'Error interno' }); }
}

function getIp(req: Request): string {
  const fw = req.headers['x-forwarded-for'];
  return typeof fw === 'string' ? fw.split(',')[0].trim() : (req.socket.remoteAddress ?? '');
}

router.get('/', verificaAuth, async (req: Request, res: Response) => {
  const params = z.object({
    estado: z.string().optional(),
    tipo: z.enum(['externa', 'garantia']).optional(),
    cliente_id: z.string().uuid().optional(),
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(50).default(20),
  }).parse(req.query);
  try {
    const resultado = await reparacionService.listarReparaciones(params);
    res.json({ success: true, ...resultado });
  } catch (err) { handleError(res, err); }
});

router.get('/:id', verificaAuth, async (req: Request, res: Response) => {
  try {
    const orden = await reparacionService.obtenerReparacion(req.params.id);
    res.json({ success: true, data: orden });
  } catch (err) { handleError(res, err); }
});

router.post('/', verificaAuth, verificaRol('ADMIN', 'TECNICO', 'VENDEDOR'), async (req: Request, res: Response) => {
  const parsed = reparacionService.crearReparacionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const orden = await reparacionService.crearReparacion(
      parsed.data, req.usuario!.userId, getIp(req), req.headers['user-agent']
    );
    res.status(201).json({ success: true, data: orden });
  } catch (err) { handleError(res, err); }
});

router.patch('/:id', verificaAuth, verificaRol('ADMIN', 'TECNICO'), async (req: Request, res: Response) => {
  const parsed = reparacionService.actualizarReparacionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const orden = await reparacionService.actualizarReparacion(
      req.params.id, parsed.data, req.usuario!.userId, getIp(req), req.headers['user-agent']
    );
    res.json({ success: true, data: orden });
  } catch (err) { handleError(res, err); }
});

export default router;
