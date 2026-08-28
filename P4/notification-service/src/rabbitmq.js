// conexion a rabbitmq y consumo de eventos
// aqui se implementa el patron consumidor: se procesa el mensaje de forma
// independiente, y solo se confirma (ack) si se guardo bien en la base de datos

const amqp = require("amqplib");
const Notification = require("./models/Notification");
const RABBITMQ_HOST = process.env.RABBITMQ_HOST;
const RABBITMQ_PORT = process.env.RABBITMQ_PORT;
const RABBITMQ_USER = process.env.RABBITMQ_USER;
const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD;

const QUEUE_NAME = "appointment_created";
const CRON_SUMMARY_QUEUE = "cron_summary";

// arma la fecha en un formato mas facil de leer, mismo formato que ya usabamos
function formatearMensaje(evento) {
  const fecha = new Date(evento.date);
  const fechaLegible = fecha.toLocaleDateString("es-GT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const horaLegible = fecha.toLocaleTimeString("es-GT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `Tu cita quedo confirmada para el ${fechaLegible} a las ${horaLegible}. Zona: ${evento.bodyPart}${evento.design ? `, diseno: ${evento.design}` : ""}.`;
}

// se conecta a rabbitmq y se queda escuchando ambas colas de forma indefinida
// esto corre en paralelo al servidor express, no bloquea las peticiones http
async function startConsumer() {
  const url = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`;

  let intentos = 0;
  const maxIntentos = 10;
  let connection = null;

  while (intentos < maxIntentos) {
    try {
      connection = await amqp.connect(url);
      break;
    } catch (error) {
      intentos++;
      console.log(`notification-service: esperando rabbitmq, intento ${intentos}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  if (!connection) {
    throw new Error("notification-service: no se pudo conectar a rabbitmq");
  }

  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.assertQueue(CRON_SUMMARY_QUEUE, { durable: true });

  channel.prefetch(1);

  console.log("notification-service: escuchando la cola appointment_created");
  console.log("notification-service: escuchando la cola cron_summary");

  // consumidor de citas nuevas, ya existente
  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const evento = JSON.parse(msg.content.toString());
      console.log(`notification-service: procesando evento de la cita ${evento.appointmentId}`);

      const mensaje = formatearMensaje(evento);
      console.log(`notification-service: enviando correo -> ${mensaje}`);

      await Notification.createNotification({
        appointmentId: evento.appointmentId,
        clientId: evento.clientId,
        message: mensaje,
      });

      channel.ack(msg);
    } catch (error) {
      console.log("notification-service: error procesando evento", error.message);
      channel.nack(msg, false, true);
    }
  });

  // consumidor nuevo del resumen que publica el cronjob 2
  channel.consume(CRON_SUMMARY_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const resumen = JSON.parse(msg.content.toString());
      console.log("notification-service: procesando resumen de cronjob", resumen);

      await Notification.saveCronSummary(resumen);

      channel.ack(msg);
    } catch (error) {
      console.log("notification-service: error procesando resumen de cronjob", error.message);
      channel.nack(msg, false, true);
    }
  });
}

module.exports = { startConsumer };