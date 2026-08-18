// endpoints rest del microservicio de notificaciones

const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");

// este endpoint lo llama appointments-service directamente
// cuando se crea una cita nueva, sin pasar por el api gateway
router.post("/", async (req, res) => {
  try {
    const { appointmentId, clientId, message } = req.body;

    if (!appointmentId || !clientId || !message) {
      return res.status(400).json({ error: "faltan campos obligatorios" });
    }

    // aqui en un caso real se conectaria a un proveedor de correo
    // como sendgrid o nodemailer, por ahora solo lo dejamos registrado
    console.log(`notification-service: enviando correo -> ${message}`);

    const notificacion = await Notification.createNotification({
      appointmentId,
      clientId,
      message,
    });

    return res.status(201).json(notificacion);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "error al crear la notificacion" });
  }
});

// trae el historial de notificaciones de un cliente
router.get("/client/:clientId", async (req, res) => {
  try {
    const notificaciones = await Notification.findByClientId(req.params.clientId);
    return res.status(200).json(notificaciones);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "error al consultar notificaciones" });
  }
});

module.exports = router;