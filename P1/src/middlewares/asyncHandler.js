// esto envuelve las funciones async de las rutas
// si algo truena adentro (una promesa rechazada), lo manda a next()
// asi no tengo que escribir try/catch en cada metodo del controller

function asyncHandler(controlador) {
  return (req, res, next) => {
    Promise.resolve(controlador(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;