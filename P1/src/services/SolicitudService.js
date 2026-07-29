// aca van todas las reglas de negocio, osea que datos son validos y cuales no
// esta clase no sabe nada de sql ni de http, solo conoce el repositorio (inyectado)
// si mañana cambio de base de datos, esta clase no se toca para nada

const ValidationError = require('./ValidationError');

const ESTADOS_VALIDOS = ['registrada', 'en_proceso', 'finalizada'];

class SolicitudService {
  constructor(solicitudRepository) {
    // el repositorio me lo inyectan, no lo creo yo aca
    this.solicitudRepository = solicitudRepository;
  }

  // cada validacion revisa solo una cosa, para que sea facil de leer y de testear

  _validarTitulo(titulo) {
    if (typeof titulo !== 'string' || titulo.trim().length === 0) {
      throw new ValidationError(
        'el campo titulo es obligatorio y no puede estar vacio',
        'titulo'
      );
    }
  }

  _validarAreaSolicitante(areaSolicitante) {
    if (typeof areaSolicitante !== 'string' || areaSolicitante.trim().length === 0) {
      throw new ValidationError(
        'el campo area_solicitante es obligatorio y no puede estar vacio',
        'area_solicitante'
      );
    }
  }

  _validarPrioridad(prioridad) {
    const esEntero = Number.isInteger(prioridad);
    if (!esEntero || prioridad < 1 || prioridad > 5) {
      throw new ValidationError(
        `el campo prioridad debe ser un numero entero entre 1 y 5, se recibio: ${JSON.stringify(prioridad)}`,
        'prioridad'
      );
    }
  }

  _validarCostoEstimado(costoEstimado) {
    const esNumero = typeof costoEstimado === 'number' && !Number.isNaN(costoEstimado);
    if (!esNumero || costoEstimado <= 0) {
      throw new ValidationError(
        `el campo costo_estimado debe ser un numero positivo, se recibio: ${JSON.stringify(costoEstimado)}`,
        'costo_estimado'
      );
    }
  }

  _validarEstado(estado) {
    if (!ESTADOS_VALIDOS.includes(estado)) {
      throw new ValidationError(
        `el campo estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}. se recibio: ${JSON.stringify(estado)}`,
        'estado'
      );
    }
  }

  // valida todo lo necesario para crear una solicitud nueva
  _validarDatosCreacion(datosSolicitud) {
    const { titulo, area_solicitante, prioridad, costo_estimado, estado } = datosSolicitud;
    this._validarTitulo(titulo);
    this._validarAreaSolicitante(area_solicitante);
    this._validarPrioridad(prioridad);
    this._validarCostoEstimado(costo_estimado);
    this._validarEstado(estado || 'registrada');
  }

  // esta es para el PUT, pide TODOS los campos porque reemplaza la solicitud completa
  // (si solo validara lo que viene, dejaria huecos cuando el repository ya no usa coalesce)
  _validarDatosActualizacion(datosCompletos) {
    const { titulo, area_solicitante, prioridad, costo_estimado, estado } = datosCompletos;
    this._validarTitulo(titulo);
    this._validarAreaSolicitante(area_solicitante);
    this._validarPrioridad(prioridad);
    this._validarCostoEstimado(costo_estimado);
    this._validarEstado(estado);
  }

  _validarId(id) {
    if (id === undefined || id === null || Number.isNaN(Number(id))) {
      throw new ValidationError(
        `el id debe ser un identificador numerico valido, se recibio: ${JSON.stringify(id)}`,
        'id'
      );
    }
  }

  // de aca para abajo son los metodos que realmente usa el controller

  async listarSolicitudes() {
    return this.solicitudRepository.findAll();
  }

  async crearSolicitud(datosSolicitud) {
    this._validarDatosCreacion(datosSolicitud);
    const solicitudNormalizada = {
      ...datosSolicitud,
      estado: datosSolicitud.estado || 'registrada',
    };
    return this.solicitudRepository.create(solicitudNormalizada);
  }

  async actualizarSolicitud(id, datosCompletos) {
    this._validarId(id);
    this._validarDatosActualizacion(datosCompletos);
    return this.solicitudRepository.update(id, datosCompletos);
  }

  async eliminarSolicitud(id) {
    this._validarId(id);
    return this.solicitudRepository.delete(id);
  }

  async cambiarEstadoSolicitud(id, nuevoEstado) {
    this._validarId(id);
    this._validarEstado(nuevoEstado);
    return this.solicitudRepository.updateEstado(id, nuevoEstado);
  }
}

module.exports = SolicitudService;