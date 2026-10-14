// punto de entrada del microservicio de autenticacion

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const { initDb } = require("./db");
const authRoutes = require("./routes/authRoutes");

const app = express();

// P10 - observabilidad: latencia, errores y trafico por ruta, metricas en /metrics y logs JSON con trace_id
const { middlewareMetricas, endpointMetricas } = require("./observabilidad/metricas");
const logger = require("./observabilidad/logger");
app.use(middlewareMetricas);
app.get("/metrics", endpointMetricas);
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// endpoint simple para saber si el servicio esta vivo
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "auth-service" });
});

app.use("/api/auth", authRoutes);

// arrancamos el servidor solo despues de que la base de datos este lista
initDb()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`auth-service corriendo en el puerto ${PORT}`);
    });
  })
  .catch((error) => {
    logger.error("auth-service no pudo iniciar:", error);
    process.exit(1);
  });