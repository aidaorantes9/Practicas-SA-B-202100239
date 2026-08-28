// conexion a rabbitmq y publicacion de eventos
// aqui se implementa el patron productor: se publica el mensaje y se retorna
// de inmediato, sin esperar a que nadie lo procese

const amqp = require("amqplib");

const RABBITMQ_HOST = process.env.RABBITMQ_HOST;
const RABBITMQ_PORT = process.env.RABBITMQ_PORT;
const RABBITMQ_USER = process.env.RABBITMQ_USER;
const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD;

const QUEUE_NAME = "appointment_created";

let channel = null;

// arma la url de conexion y abre el canal una sola vez
// se reutiliza el mismo canal para todas las publicaciones siguientes
async function connectRabbitMQ() {
  const url = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`;

  let intentos = 0;
  const maxIntentos = 10;

  while (intentos < maxIntentos) {
    try {
      const connection = await amqp.connect(url);
      channel = await connection.createChannel();

      // la cola durable sobrevive a un reinicio de rabbitmq
      // sin durable, si rabbitmq se reinicia la cola y sus mensajes se pierden
      await channel.assertQueue(QUEUE_NAME, { durable: true });

      console.log("appointments-service: conectado a rabbitmq");
      return;
    } catch (error) {
      intentos++;
      console.log(`appointments-service: esperando rabbitmq, intento ${intentos}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error("appointments-service: no se pudo conectar a rabbitmq");
}

// publica el evento de que una cita nueva quedo creada
// no espera respuesta de nadie, solo confirma que el mensaje se metio a la cola
function publishAppointmentCreated(appointment) {
  if (!channel) {
    console.log("appointments-service: no hay conexion a rabbitmq, evento no publicado");
    return;
  }

  const mensaje = {
    appointmentId: appointment.id,
    clientId: appointment.client_id,
    date: appointment.date,
    bodyPart: appointment.body_part,
    design: appointment.design,
  };

  // persistent true hace que el mensaje se guarde en disco, no solo en memoria
  // esto es necesario para que sobreviva si rabbitmq se cae y se levanta de nuevo
  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(mensaje)), {
    persistent: true,
  });

  console.log(`appointments-service: evento publicado para la cita ${appointment.id}`);
}

module.exports = { connectRabbitMQ, publishAppointmentCreated };