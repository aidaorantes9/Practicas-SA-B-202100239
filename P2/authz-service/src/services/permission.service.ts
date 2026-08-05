// Single Responsibility: este archivo SOLO sabe de reglas de negocio
// de autorización (quién puede acceder a qué). No sabe nada de HTTP,
// ni de tokens, ni de la base de datos del auth-service.

export type Role = 'admin' | 'cliente';

// "route1" = ruta exclusiva de Admin
// "route2" = ruta compartida entre Admin y Cliente
const PERMISSIONS: Record<Role, string[]> = {
  admin: ['route1', 'route2'],
  cliente: ['route2'],
};

export class PermissionService {
  /**
   * Determina si un rol tiene permiso sobre un recurso específico.
   * Open/Closed: si mañana se agrega un nuevo rol o recurso, solo se
   * modifica esta matriz, no la lógica del controlador ni de las rutas.
   */
  public isAuthorized(role: Role, resource: string): boolean {
    const allowedResources = PERMISSIONS[role];
    if (!allowedResources) return false;
    return allowedResources.includes(resource);
  }
}