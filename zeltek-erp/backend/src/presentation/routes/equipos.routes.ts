import { Router, Request, Response } from 'express';
import { verificaAuth } from '../middleware/verificaAuth';
import { verificaRol } from '../middleware/verificaRol';
import * as equipoService from '../../application/equipos/equipoService';

const router = Router();

function handleError(res: Response, err: unknown) {
  const e = err as { status?: number; message?: string };
  if (e.status) {
    res.status(e.status).json({ success: false, error: e.message });
  } else {
    console.error('[EQUIPOS]', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

function getIp(req: Request): string {
  const fw = req.headers['x-forwarded-for'];
  if (typeof fw === 'string') return fw.split(',')[0].trim();
  return req.socket.remoteAddress ?? '';
}

// ─── GET /equipos — Listar con filtros ───────────────────────────────────────
router.get('/', verificaAuth, async (req: Request, res: Response) => {
  const parsed = equipoService.filtrosEquipoSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  try {
    const resultado = await equipoService.listarEquipos(parsed.data);
    res.json({ success: true, ...resultado });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /equipos/resumen — Resumen de inventario (equipos + accesorios) ─────
router.get('/resumen', verificaAuth, async (_req: Request, res: Response) => {
  try {
    const resumen = await equipoService.obtenerResumenInventario();
    res.json({ success: true, data: resumen });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /equipos/disponibles — Inventario disponible ────────────────────────
router.get('/disponibles', verificaAuth, async (_req: Request, res: Response) => {
  try {
    const items = await equipoService.listarDisponibles();
    res.json({ success: true, data: items, meta: { total: items.length } });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /equipos/serie/:serie — Buscar por número de serie ──────────────────
router.get('/serie/:serie', verificaAuth, async (req: Request, res: Response) => {
  try {
    const equipo = await equipoService.buscarPorSerie(req.params.serie);
    res.json({ success: true, data: equipo });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /equipos/:id — Detalle con historial ─────────────────────────────────
router.get('/:id', verificaAuth, async (req: Request, res: Response) => {
  try {
    const equipo = await equipoService.obtenerEquipo(req.params.id);
    res.json({ success: true, data: equipo });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── PATCH /equipos/:id — Actualizar campos ───────────────────────────────────
router.patch('/:id', verificaAuth, verificaRol('ADMIN'), async (req: Request, res: Response) => {
  const parsed = equipoService.actualizarEquipoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  try {
    const equipo = await equipoService.actualizarEquipo(
      req.params.id,
      parsed.data,
      req.usuario!.userId,
      getIp(req),
      req.headers['user-agent']
    );
    res.json({ success: true, data: equipo });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── PATCH /equipos/:id/estado — Cambiar estado via StateMachine ──────────────
router.patch('/:id/estado', verificaAuth, verificaRol('ADMIN', 'TECNICO'), async (req: Request, res: Response) => {
  const parsed = equipoService.cambiarEstadoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  try {
    const equipo = await equipoService.cambiarEstado(
      req.params.id,
      parsed.data,
      req.usuario!.userId,
      getIp(req),
      req.headers['user-agent']
    );
    res.json({ success: true, data: equipo });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
