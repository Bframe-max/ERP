import { Router, Request, Response } from 'express';
import { verificaAuth } from '../middleware/verificaAuth';
import * as clienteService from '../../application/clientes/clienteService';

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) res.status(e.status).json({ success: false, error: e.message });
  else { console.error('[CLIENTES]', err); res.status(500).json({ success: false, error: 'Error interno' }); }
}

router.get('/', verificaAuth, async (req: Request, res: Response) => {
  try {
    const items = await clienteService.listarClientes(req.query.q as string | undefined);
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (err) { handleError(res, err); }
});

router.get('/:id', verificaAuth, async (req: Request, res: Response) => {
  try {
    const cliente = await clienteService.obtenerCliente(req.params.id);
    res.json({ success: true, data: cliente });
  } catch (err) { handleError(res, err); }
});

router.post('/', verificaAuth, async (req: Request, res: Response) => {
  const parsed = clienteService.clienteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const cliente = await clienteService.crearCliente(parsed.data);
    res.status(201).json({ success: true, data: cliente });
  } catch (err) { handleError(res, err); }
});

router.patch('/:id', verificaAuth, async (req: Request, res: Response) => {
  const parsed = clienteService.clienteSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const cliente = await clienteService.actualizarCliente(req.params.id, parsed.data);
    res.json({ success: true, data: cliente });
  } catch (err) { handleError(res, err); }
});

export default router;
