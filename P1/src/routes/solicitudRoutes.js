// aca conecto cada url con el metodo del controller que le toca
// recibo el controller ya armado desde afuera, no lo creo aca

const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');

function crearSolicitudRoutes(solicitudController) {
  const router = Router();

  router.get('/solicitudes', asyncHandler(solicitudController.listarSolicitudes));
  router.post('/solicitudes', asyncHandler(solicitudController.crearSolicitud));
  router.put('/solicitudes/:id', asyncHandler(solicitudController.actualizarSolicitud));
  router.delete('/solicitudes/:id', asyncHandler(solicitudController.eliminarSolicitud));
  router.patch('/solicitudes/:id/estado', asyncHandler(solicitudController.cambiarEstadoSolicitud));

  return router;
}

module.exports = crearSolicitudRoutes;