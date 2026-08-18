// este middleware revisa que la cookie con el token venga presente y sea valida
// si todo esta bien, guarda los datos del usuario en req.user para usarlos despues

const { verifyToken } = require("../utils/jwt");

function requireAuth(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "no hay token, inicia sesion primero" });
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: "token invalido o expirado" });
  }
}

// middleware extra para revisar el rol del usuario en una ruta especifica
// se usa asi: requireRole('admin')
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.role)) {
      return res.status(403).json({ error: "no tienes permiso para esto" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };