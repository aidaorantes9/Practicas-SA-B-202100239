import { Request, Response, NextFunction } from 'express';
import { AuthorizationClient, Role } from '../services/authorization-client.service';

const authorizationClient = new AuthorizationClient();

export function requireResource(resource: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const role = (req as any).user?.role as Role | undefined;

    if (!role) {
      res.status(401).json({ message: 'No autenticado.' });
      return;
    }

    const authorized = await authorizationClient.isAuthorized(role, resource);

    if (!authorized) {
      res.status(403).json({
        message: `Acceso denegado: el rol "${role}" no tiene permiso sobre "${resource}".`,
      });
      return;
    }

    next();
  };
}