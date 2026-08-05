import { Request, Response } from 'express';
import { PermissionService, Role } from '../services/permission.service';

// Dependency Inversion: el controlador depende de la clase PermissionService
// (una abstracción de la regla de negocio), no de un switch/if hardcodeado
// aquí mismo. Si mañana cambia la fuente de permisos (ej. de memoria a BD),
// solo se reemplaza la implementación de PermissionService.
const permissionService = new PermissionService();

export function checkAuthorization(req: Request, res: Response): void {
  const { role, resource } = req.body as { role?: Role; resource?: string };

  if (!role || !resource) {
    res.status(400).json({
      authorized: false,
      message: 'Se requieren los campos "role" y "resource".',
    });
    return;
  }

  const authorized = permissionService.isAuthorized(role, resource);

  res.status(200).json({
    authorized,
    role,
    resource,
  });
}