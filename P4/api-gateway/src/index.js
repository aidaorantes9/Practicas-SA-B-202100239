// punto de entrada del api gateway
// este es el unico servicio que el cliente conoce
// cada ruta se reenvia (proxy) al microservicio correspondiente

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");

const requireAuth = require("./middleware/requireAuth");

const app = express();
const PORT = process.env.PORT || 3000;

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const ARTISTS_SERVICE_URL = process.env.ARTISTS_SERVICE_URL;
const APPOINTMENTS_SERVICE_URL = process.env.APPOINTMENTS_SERVICE_URL;
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL;

// no usamos express.json() aqui a proposito
// si lo usare, el body ya vendria leido cuando el proxy intenta reenviarlo
// y eso rompe las peticiones. el gateway solo reenvia el body tal cual llega

app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "api-gateway" });
});

// rutas de autenticacion, publicas, no necesitan token todavia
app.use(
  "/api/auth",
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
  })
);

// catalogo de artistas, publico, cualquiera puede verlo sin iniciar sesion
app.use(
  "/api/artists",
  createProxyMiddleware({
    target: ARTISTS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/artists": "" },
  })
);

// citas, aqui si se necesita estar logueado
app.use(
  "/api/appointments",
  requireAuth,
  createProxyMiddleware({
    target: APPOINTMENTS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/appointments": "" },
  })
);

// notificaciones, tambien necesita estar logueado
app.use(
  "/api/notifications",
  requireAuth,
  createProxyMiddleware({
    target: NOTIFICATION_SERVICE_URL,
    changeOrigin: true,
  })
);

app.listen(PORT, () => {
  console.log(`api-gateway corriendo en el puerto ${PORT}`);
});