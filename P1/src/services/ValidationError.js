// error personalizado para cuando algo no cumple una regla de negocio
// (ej: prioridad fuera de rango, titulo vacio, etc)
// asi en el controller puedo diferenciar esto de un error raro del servidor
// y responder 400 en vez de 500

class ValidationError extends Error {
  constructor(mensaje, campo) {
    super(mensaje);
    this.name = 'ValidationError';
    this.campo = campo; // guardo cual campo fallo, para dar un mensaje mas claro
  }
}

module.exports = ValidationError;