// funciones para crear y verificar el token jwt
// el tiempo de vida es configurable por variable de entorno como pide el enunciado

const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN_SECONDS = parseInt(process.env.JWT_EXPIRES_IN_SECONDS, 10);

// crea un token nuevo con los datos basicos del usuario
// nunca metemos el password ni datos encriptados dentro del token
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    SECRET,
    { expiresIn: EXPIRES_IN_SECONDS }
  );
}

// verifica el token, si es invalido o expiro lanza un error
function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { generateToken, verifyToken };