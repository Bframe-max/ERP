import { Router } from 'express';

const router = Router();

// TODO: Implementar en Fase correspondiente
router.get('/', (_req, res) => {
  res.json({ success: true, data: [], meta: { modulo: 'dashboard', estado: 'pendiente_implementacion' } });
});

export default router;
