// este middleware protege las rutas que necesitan login
// llama a auth-service para saber si el token es valido
// si todo esta bien, agrega el id y el rol del usuario en los headers
// para que el siguiente microservicio no tenga que repetir la logica de jwt

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;

async function requireAuth(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "no hay sesion, inicia sesion primero" });
  }

  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (!data.valid) {
      return res.status(401).json({ error: "sesion invalida o expirada" });
    }

    // aqui agregamos los datos del usuario a los headers de la peticion
    // el proxy va a mandar estos headers al microservicio destino
    req.headers["x-user-id"] = String(data.user.id);
    req.headers["x-user-role"] = data.user.role;

    next();
  } catch (error) {
    console.error("api-gateway: error validando token", error.message);
    return res.status(503).json({ error: "no se pudo validar la sesion" });
  }
}

module.exports = requireAuth;