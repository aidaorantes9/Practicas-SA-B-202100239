// punto de entrada del microservicio de notificaciones

const express = require("express");
const cors = require("cors");

const { initDb } = require("./db");
const { startConsumer } = require("./rabbitmq");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();
const PORT = process.env.PORT || 4003;

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "notification-service" });
});

app.use("/api/notifications", notificationRoutes);

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`notification-service corriendo en el puerto ${PORT}`);
    });
    // el consumidor arranca aparte, no bloquea que el servidor http empiece a responder
    startConsumer().catch((error) => {
      console.error("notification-service: error en el consumidor", error.message);
    });
  })
  .catch((error) => {
    console.error("notification-service no pudo iniciar:", error);
    process.exit(1);
  });