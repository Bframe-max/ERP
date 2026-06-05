import { Router, Request, Response } from 'express';
import { verificaAuth } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as usuariosService from '../../application/usuarios/usuariosService';

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) res.status(e.status).json({ success: false, error: e.message });
  else { console.error('[USUARIOS]', err); res.status(500).json({ success: false, error: 'Error interno' }); }
}

// GET /usuarios — listar (ADMIN)
router.get('/', verificaAuth, verificaRol('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const data = await usuariosService.listarUsuarios();
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// POST /usuarios — crear (ADMIN)
router.post('/', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = usuariosService.crearUsuarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const data = await usuariosService.crearUsuario(parsed.data, req.usuario!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// PATCH /usuarios/:id — actualizar (ADMIN)
router.patch('/:id', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = usuariosService.actualizarUsuarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const data = await usuariosService.actualizarUsuario(req.params.id, parsed.data, req.usuario!.userId);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// POST /usuarios/:id/cambiar-password (ADMIN)
router.post('/:id/cambiar-password', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = usuariosService.cambiarPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  try {
    const data = await usuariosService.cambiarPassword(req.params.id, parsed.data.nueva_password, req.usuario!.userId);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

// POST /usuarios/:id/desbloquear (ADMIN)
router.post('/:id/desbloquear', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = await usuariosService.desbloquearUsuario(req.params.id, req.usuario!.userId);
    res.json({ success: true, data });
  } catch (err) { handleError(res, err); }
});

export default router;
