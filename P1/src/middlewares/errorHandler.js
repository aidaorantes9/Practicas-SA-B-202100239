// este es el unico lugar de todo el proyecto que decide que codigo http devolver
// segun el tipo de error, asi el controller y el service no tienen que saber de eso

const ValidationError = require('../services/ValidationError');

function errorHandler(error, req, res, next) {
  if (error instanceof ValidationError) {
    // si fue un error de validacion, el usuario mando mal los datos -> 400
    return res.status(400).json({
      error: error.message,
      campo: error.campo,
    });
  }

  // cualquier otro error es raro (bug, fallo de conexion, etc) -> 500
  // el detalle solo se ve en la consola del servidor, nunca se lo mando al cliente
  console.error('error no controlado:', error);
  return res.status(500).json({
    error: 'ocurrio un error interno en el servidor',
  });
}

module.exports = errorHandler;