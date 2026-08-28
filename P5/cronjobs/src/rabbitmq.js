// conexion simple a rabbitmq solo para publicar, un cronjob no se queda escuchando

const amqp = require("amqplib");

const RABBITMQ_HOST = process.env.RABBITMQ_HOST;
const RABBITMQ_PORT = process.env.RABBITMQ_PORT;
const RABBITMQ_USER = process.env.RABBITMQ_USER;
const RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD;

const QUEUE_NAME = "cron_summary";

async function publishSummary(resumen) {
  const url = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`;
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: true });

  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(resumen)), {
    persistent: true,
  });

  console.log("cronjob-2: resumen publicado en la cola cron_summary");

  // cerramos la conexion porque el cronjob debe terminar, no quedarse corriendo
  await channel.close();
  await connection.close();
}

module.exports = { publishSummary };