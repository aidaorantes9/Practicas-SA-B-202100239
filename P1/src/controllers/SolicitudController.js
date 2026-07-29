// este archivo solo traduce entre http y el service
// osea: recibe el request, le pasa los datos al service, y devuelve la respuesta
// aca no debe haber ninguna regla de negocio ni sql, solo "trafico" de datos

const ValidationError = require('../services/ValidationError');

class SolicitudController {
  constructor(solicitudService) {
    this.solicitudService = solicitudService;
  }

  // los parametros de la url siempre llegan como texto, aca reviso que sea un numero
  // esto no es una regla de negocio, es un detalle de como funciona http, por eso va aca
  _obtenerIdValidado(req) {
    const idComoTexto = req.params.id;
    if (!/^\d+$/.test(idComoTexto)) {
      throw new ValidationError(
        `el parametro id de la url debe ser numerico, se recibio: "${idComoTexto}"`,
        'id'
      );
    }
    return Number(idComoTexto);
  }

  // uso arrow functions para que el "this" no se pierda cuando express llama estos metodos

  listarSolicitudes = async (req, res) => {
    const solicitudes = await this.solicitudService.listarSolicitudes();
    res.status(200).json(solicitudes);
  };

  crearSolicitud = async (req, res) => {
    const solicitudCreada = await this.solicitudService.crearSolicitud(req.body);
    res.status(201).json(solicitudCreada);
  };

  actualizarSolicitud = async (req, res) => {
    const id = this._obtenerIdValidado(req);
    const solicitudActualizada = await this.solicitudService.actualizarSolicitud(id, req.body);
    if (!solicitudActualizada) {
      return res.status(404).json({ error: `no existe una solicitud con id ${id}` });
    }
    res.status(200).json(solicitudActualizada);
  };

  eliminarSolicitud = async (req, res) => {
    const id = this._obtenerIdValidado(req);
    const fueEliminada = await this.solicitudService.eliminarSolicitud(id);
    if (!fueEliminada) {
      return res.status(404).json({ error: `no existe una solicitud con id ${id}` });
    }
    res.status(200).json({ mensaje: `solicitud ${id} eliminada correctamente` });
  };

  cambiarEstadoSolicitud = async (req, res) => {
    const id = this._obtenerIdValidado(req);
    const solicitudActualizada = await this.solicitudService.cambiarEstadoSolicitud(id, req.body.estado);
    if (!solicitudActualizada) {
      return res.status(404).json({ error: `no existe una solicitud con id ${id}` });
    }
    res.status(200).json(solicitudActualizada);
  };
}

module.exports = SolicitudController;