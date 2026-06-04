import { Request, Response, NextFunction } from 'express';

type Rol = 'ADMIN' | 'VENDEDOR' | 'TECNICO';

export function verificaRol(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ success: false, error: 'No autenticado' });
      return;
    }

    if (!roles.includes(req.usuario.rol)) {
      res.status(403).json({ success: false, error: 'No tienes permisos para esta acción' });
      return;
    }

    next();
  };
}
