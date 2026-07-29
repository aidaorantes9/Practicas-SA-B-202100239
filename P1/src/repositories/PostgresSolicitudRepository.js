// aca esta toda la conexion real con la base de datos
// esta es la unica clase de todo el proyecto que sabe que existe sql
// el resto del codigo (service, controller) no deberia saber nada de esto

const ISolicitudRepository = require('../interfaces/ISolicitudRepository');

const ESTADOS_VALIDOS = ['registrada', 'en_proceso', 'finalizada'];

class PostgresSolicitudRepository extends ISolicitudRepository {
  constructor(pool) {
    super();
    // el pool me lo pasan desde afuera (app.js), no lo creo aca adentro
    // asi puedo cambiar de base de datos despues sin tocar esta clase
    this.pool = pool;
  }

  // funcion privada para no repetir el try/catch en cada metodo
  async _ejecutarQuery(texto, parametros, mensajeError) {
    try {
      return await this.pool.query(texto, parametros);
    } catch (error) {
      throw new Error(`${mensajeError}: ${error.message}`);
    }
  }

  // reviso que el estado sea uno de los 3 permitidos antes de tocar la bd
  _validarEstado(estado) {
    if (!ESTADOS_VALIDOS.includes(estado)) {
      throw new Error(
        `estado invalido "${estado}". valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`
      );
    }
  }

  // trae todas las solicitudes ordenadas por id
  async findAll() {
    const resultado = await this._ejecutarQuery(
      'SELECT id, titulo, area_solicitante, prioridad, costo_estimado, estado FROM solicitudes ORDER BY id',
      [],
      'error al obtener las solicitudes'
    );
    return resultado.rows;
  }

  // crea una solicitud nueva, si no mandan estado le pongo "registrada" por defecto
  async create(solicitud) {
    const { titulo, area_solicitante, prioridad, costo_estimado, estado } = solicitud;
    const estadoInicial = estado || 'registrada';
    this._validarEstado(estadoInicial);

    // uso $1, $2, etc en vez de meter las variables directo en el texto
    // esto evita inyeccion sql, nunca hay que concatenar strings con datos del usuario
    const resultado = await this._ejecutarQuery(
      `INSERT INTO solicitudes (titulo, area_solicitante, prioridad, costo_estimado, estado)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, titulo, area_solicitante, prioridad, costo_estimado, estado`,
      [titulo, area_solicitante, prioridad, costo_estimado, estadoInicial],
      'error al crear la solicitud'
    );
    return resultado.rows[0];
  }

  // actualiza TODA la solicitud (esto es para el PUT, no un patch parcial)
  // por eso pido todos los campos y los reemplazo todos, sin dejar nada "a medias"
  async update(id, datosCompletos) {
    const { titulo, area_solicitante, prioridad, costo_estimado, estado } = datosCompletos;
    this._validarEstado(estado);

    const resultado = await this._ejecutarQuery(
      `UPDATE solicitudes
       SET titulo = $1,
           area_solicitante = $2,
           prioridad = $3,
           costo_estimado = $4,
           estado = $5
       WHERE id = $6
       RETURNING id, titulo, area_solicitante, prioridad, costo_estimado, estado`,
      [titulo, area_solicitante, prioridad, costo_estimado, estado, id],
      `error al actualizar la solicitud con id ${id}`
    );
    return resultado.rows[0] || null;
  }

  // borra una solicitud por id, devuelve true/false segun si encontro algo que borrar
  async delete(id) {
    const resultado = await this._ejecutarQuery(
      'DELETE FROM solicitudes WHERE id = $1',
      [id],
      `error al eliminar la solicitud con id ${id}`
    );
    return resultado.rowCount > 0;
  }

  // este es el que solo cambia el estado, sin tocar el resto de campos (para el PATCH)
  async updateEstado(id, nuevoEstado) {
    this._validarEstado(nuevoEstado);

    const resultado = await this._ejecutarQuery(
      `UPDATE solicitudes
       SET estado = $1
       WHERE id = $2
       RETURNING id, titulo, area_solicitante, prioridad, costo_estimado, estado`,
      [nuevoEstado, id],
      `error al actualizar el estado de la solicitud con id ${id}`
    );
    return resultado.rows[0] || null;
  }
}

module.exports = PostgresSolicitudRepository;