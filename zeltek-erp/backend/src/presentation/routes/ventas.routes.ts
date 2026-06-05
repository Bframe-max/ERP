import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { verificaAuth } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as ventaService from '../../application/ventas/ventaService';

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) res.status(e.status).json({ success: false, error: e.message });
  else { console.error('[VENTAS]', err); res.status(500).json({ success: false, error: 'Error interno' }); }
}

function getIp(req: Request): string {
  const fw = req.headers['x-forwarded-for'];
  return typeof fw === 'string' ? fw.split(',')[0].trim() : (req.socket.remoteAddress ?? '');
}

// POST /ventas — Checkout completo
router.post('/', verificaAuth, verificaRol('ADMIN', 'VENDEDOR'), async (req: Request, res: Response) => {
  const parsed = ventaService.checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const venta = await ventaService.registrarVenta(
      parsed.data,
      req.usuario!.userId,
      getIp(req),
      req.headers['user-agent']
    );
    res.status(201).json({ success: true, data: venta });
  } catch (err) { handleError(res, err); }
});

// GET /ventas — Listar
router.get('/', verificaAuth, async (req: Request, res: Response) => {
  const params = z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    vendedor_id: z.string().uuid().optional(),
  }).parse(req.query);
  try {
    const resultado = await ventaService.listarVentas(params);
    res.json({ success: true, ...resultado });
  } catch (err) { handleError(res, err); }
});

// GET /ventas/:id — Detalle
router.get('/:id', verificaAuth, async (req: Request, res: Response) => {
  try {
    const venta = await ventaService.obtenerVenta(req.params.id);
    res.json({ success: true, data: venta });
  } catch (err) { handleError(res, err); }
});

// PATCH /ventas/:id/liquidar — Marcar reparto como liquidado
router.patch('/:id/liquidar', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  try {
    const venta = await ventaService.marcarLiquidado(req.params.id, req.usuario!.userId);
    res.json({ success: true, data: venta });
  } catch (err) { handleError(res, err); }
});

export default router;
