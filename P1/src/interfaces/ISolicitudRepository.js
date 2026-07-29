/**
 * ISolicitudRepository
 * ---------------------
 * Contrato (abstracción) que define las operaciones disponibles
 * para gestionar solicitudes, independientemente del motor de
 * persistencia que se use por debajo (PostgreSQL, MySQL, memoria, etc).
 *
 * Cualquier clase que implemente esta interfaz debe exponer estos
 * métodos con la misma firma. En Node.js no existen interfaces
 * nativas, así que la modelamos como una clase base que lanza error
 * si un método no fue implementado por la subclase.
 */
class ISolicitudRepository {
  /**
   * @returns {Promise<Array<Object>>} Lista de todas las solicitudes
   */
  async findAll() {
    throw new Error('Método "findAll" no implementado');
  }

  /**
   * @param {Object} solicitud - Datos de la nueva solicitud
   * @returns {Promise<Object>} Solicitud creada (con id generado)
   */
  async create(solicitud) {
    throw new Error('Método "create" no implementado');
  }

  /**
   * @param {number} id - Id de la solicitud a actualizar
   * @param {Object} camposActualizados - Campos a modificar
   * @returns {Promise<Object|null>} Solicitud actualizada o null si no existe
   */
  async update(id, camposActualizados) {
    throw new Error('Método "update" no implementado');
  }

  /**
   * @param {number} id - Id de la solicitud a eliminar
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async delete(id) {
    throw new Error('Método "delete" no implementado');
  }

  /**
   * @param {number} id - Id de la solicitud
   * @param {string} nuevoEstado - "registrada" | "en_proceso" | "finalizada"
   * @returns {Promise<Object|null>} Solicitud con estado actualizado o null si no existe
   */
  async updateEstado(id, nuevoEstado) {
    throw new Error('Método "updateEstado" no implementado');
  }
}

module.exports = ISolicitudRepository;