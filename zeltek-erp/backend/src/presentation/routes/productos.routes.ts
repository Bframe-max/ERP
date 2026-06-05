import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { verificaAuth } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as productosService from '../../application/productos/productosService';

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) res.status(e.status).json({ success: false, error: e.message });
  else { console.error('[PRODUCTOS]', err); res.status(500).json({ success: false, error: 'Error interno' }); }
}

// GET /productos?busqueda=&tipo=&activo=
router.get('/', verificaAuth, async (req: Request, res: Response) => {
  const params = z.object({
    busqueda: z.string().optional(),
    tipo: z.string().optional(),
    activo: z.coerce.boolean().optional(),
  }).parse(req.query);
  try {
    res.json({ success: true, data: await productosService.listarProductos(params) });
  } catch (err) { handleError(res, err); }
});

// POST /productos (ADMIN)
router.post('/', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = productosService.productoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    res.status(201).json({ success: true, data: await productosService.crearProducto(parsed.data) });
  } catch (err) { handleError(res, err); }
});

// PATCH /productos/:id (ADMIN)
router.patch('/:id', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await productosService.actualizarProducto(req.params.id, req.body) });
  } catch (err) { handleError(res, err); }
});

export default router;
