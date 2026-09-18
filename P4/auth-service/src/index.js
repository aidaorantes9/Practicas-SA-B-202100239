// punto de entrada del microservicio de autenticacion

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const { initDb } = require("./db");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// endpoint simple para saber si el servicio esta vivo
app.get("/health", (req, res) => {
  res.status(500).json({ status: "error", service: "auth-service" }); // FALLO INDUCIDO para demostrar la reversion automatica de P8
});

app.use("/api/auth", authRoutes);

// arrancamos el servidor solo despues de que la base de datos este lista
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`auth-service corriendo en el puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("auth-service no pudo iniciar:", error);
    process.exit(1);
  });