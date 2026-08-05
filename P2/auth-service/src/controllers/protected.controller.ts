import { Request, Response } from 'express';

export function adminOnlyResource(req: Request, res: Response): void {
  const role = (req as any).user?.role;
  res.status(200).json({
    message: 'Acceso concedido a la Ruta 1 (solo Admin).',
    role,
  });
}

export function sharedResource(req: Request, res: Response): void {
  const role = (req as any).user?.role;
  res.status(200).json({
    message: 'Acceso concedido a la Ruta 2 (Admin y Cliente).',
    role,
  });
}